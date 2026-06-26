import { NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { ML_SERVICE_URL } from '@/lib/translation/providers/ml-service';

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`tts:${ip}`, RATE_LIMITS.translate);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  if (!ML_SERVICE_URL) {
    return NextResponse.json({ error: 'Text-to-speech service offline.' }, { status: 503 });
  }

  try {
    const { text, sourceLang, targetLang } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const response = await fetch(`${ML_SERVICE_URL.replace(/\/$/, '')}/text-to-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        source_lang: sourceLang,
        target_lang: targetLang,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('ML service TTS failed', { error: errText });
      return NextResponse.json({ error: 'Text-to-speech failed' }, { status: response.status });
    }

    const audioBlob = await response.blob();

    return new Response(audioBlob, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
      },
    });
  } catch (error) {
    logger.error('TTS proxy error', { error: String(error) });
    return NextResponse.json({ error: 'Internal TTS proxy error' }, { status: 500 });
  }
}
