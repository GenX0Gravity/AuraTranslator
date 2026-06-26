import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const scoreSchema = z.object({
  sourceText: z.string().min(1).max(5000),
  translatedText: z.string().min(1).max(10000),
  sourceLang: z.string().min(2).max(10),
  targetLang: z.string().min(2).max(10),
  domain: z.string().optional(),
  tone: z.string().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`score:${ip}`, RATE_LIMITS.score);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = scoreSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request: ' + parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { sourceText, translatedText, sourceLang, targetLang, domain, tone } = parsed.data;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.error('GEMINI_API_KEY not configured');
      return NextResponse.json({ error: 'AI scoring is not configured' }, { status: 503 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an expert linguistic evaluator. Evaluate this translation:
Source text: "${sourceText}"
Source Language: ${sourceLang}
Translated text: "${translatedText}"
Target Language: ${targetLang}
${domain ? `Intended Domain: ${domain}` : ''}
${tone ? `Intended Tone/Register: ${tone}` : ''}

Please evaluate the translation across multiple dimensions:
1. Accuracy: How well does the translation preserve the semantic meaning, nuances, and facts of the source?
2. Fluency: How natural and native does the translated text sound?
3. Grammar: Are there grammatical errors, spelling issues, or syntax mistakes?
4. Domain matching: Does the translation use terminology and style appropriate for the domain?
5. BLEU (0-100): Estimate the sentence-level BLEU score (lexical overlap).
6. COMET (0-100): Estimate the COMET-QE metric (reference-free semantic quality).
7. BERTScore (0-100): Estimate the contextual similarity score (BERTScore) between source meaning and translation.
8. Overall Confidence (0-100): An aggregated confidence score based on the above metrics.

Also, provide exactly 2 alternative translations with slightly different phrasings, style, or vocabulary to help the user, especially if the confidence score is low.

Return ONLY valid JSON with these exact keys:
- "accuracyScore": integer 0-100
- "confidenceScore": integer 0-100
- "fluencyScore": integer 0-100
- "grammarScore": integer 0-100
- "domainAccuracyScore": integer 0-100
- "bleuScore": integer 0-100
- "cometScore": integer 0-100
- "bertScore": integer 0-100
- "feedback": string max 2 sentences (explain the evaluation feedback and any suggested corrections)
- "alternativeTranslations": array of strings (2 high-quality alternative translations)

Example:
{
  "accuracyScore": 95,
  "confidenceScore": 92,
  "fluencyScore": 90,
  "grammarScore": 98,
  "domainAccuracyScore": 95,
  "bleuScore": 88,
  "cometScore": 92,
  "bertScore": 94,
  "feedback": "Excellent translation that accurately renders the medical terms with natural phrasing.",
  "alternativeTranslations": [
    "Alternative phrasing one...",
    "Alternative phrasing two..."
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const output = response.text || '';

    let scoreData;
    try {
      const jsonStr = output.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      scoreData = JSON.parse(jsonStr);
    } catch {
      logger.warn('Failed to parse Gemini score output', { output: output.substring(0, 200) });
      return NextResponse.json({ error: 'Failed to evaluate translation' }, { status: 500 });
    }

    return NextResponse.json(scoreData);
  } catch (error: unknown) {
    logger.error('Score generation error', { error: String(error) });
    return NextResponse.json({ error: 'Scoring service unavailable' }, { status: 500 });
  }
}
