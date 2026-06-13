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

    const { sourceText, translatedText, sourceLang, targetLang } = parsed.data;

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

Return ONLY valid JSON with these exact keys:
- "score": integer 0-100 (accuracy + fluency + naturalness)
- "feedback": string max 2 sentences (explain score, suggest improvement if needed)

Example: {"score": 95, "feedback": "Excellent translation that preserves meaning and tone."}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const output = response.text || '';

    let parsed2: { score: number | null; feedback: string };
    try {
      const jsonStr = output.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed2 = JSON.parse(jsonStr);
    } catch {
      logger.warn('Failed to parse Gemini score output', { output: output.substring(0, 200) });
      parsed2 = { score: null, feedback: 'Unable to generate a score at this time.' };
    }

    return NextResponse.json(parsed2);
  } catch (error: unknown) {
    logger.error('Score generation error', { error: String(error) });
    return NextResponse.json({ error: 'Scoring service unavailable' }, { status: 500 });
  }
}
