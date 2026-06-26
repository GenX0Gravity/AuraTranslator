import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

export const maxDuration = 120; // 2 minutes max duration

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`subtitles-translate:${ip}`, RATE_LIMITS.translate);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 });
  }

  try {
    const { segments, sourceLang, targetLang } = await request.json();

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: 'Subtitle segments are required' }, { status: 400 });
    }

    if (!targetLang) {
      return NextResponse.json({ error: 'Target language is required' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

    logger.info('Requesting subtitles translation from Gemini', {
      segmentsCount: segments.length,
      sourceLang,
      targetLang,
    });

    const prompt = `You are a professional subtitle translator. Translate the following subtitle segments from "${sourceLang || 'auto'}" to "${targetLang}".
    
    IMPORTANT INSTRUCTIONS:
    1. Maintain the exact same 'id' for each segment. Do not skip any segments.
    2. Translate the text naturally and in context. Keep in mind that a single sentence can be split across consecutive segments, so ensure the translation flows naturally across segment boundaries.
    3. Keep translations concise and appropriate for subtitle readability.
    4. Do not explain anything, return only the JSON output matching the requested schema.
    
    Subtitle segments to translate:
    ${JSON.stringify(segments, null, 2)}
    
    Return the response in JSON format matching this schema:
    {
      "translatedSegments": [
        {
          "id": number,
          "text": string
        }
      ]
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const outputText = response.text || '';
    if (!outputText) {
      throw new Error('Gemini returned an empty translation response');
    }

    const parsedData = JSON.parse(outputText);
    if (!parsedData.translatedSegments || !Array.isArray(parsedData.translatedSegments)) {
      throw new Error('Invalid JSON format returned from Gemini: missing translatedSegments array');
    }

    logger.info('Subtitles translation complete', { translatedCount: parsedData.translatedSegments.length });

    return NextResponse.json({
      success: true,
      translatedSegments: parsedData.translatedSegments,
    });

  } catch (error) {
    logger.error('Subtitles translation service error', { error: String(error) });
    return NextResponse.json({ error: 'Translation failed: ' + String(error) }, { status: 500 });
  }
}
