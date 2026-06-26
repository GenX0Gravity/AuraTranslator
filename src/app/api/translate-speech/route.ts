import { NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { ML_SERVICE_URL } from '@/lib/translation/providers/ml-service';

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`translate-speech:${ip}`, RATE_LIMITS.translate);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  if (!ML_SERVICE_URL) {
    return NextResponse.json({ error: 'Speech translation service offline.' }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;
    const sourceLang = formData.get('sourceLang') as string;
    const targetLang = formData.get('targetLang') as string;
    const task = formData.get('task') as string || 'speech_to_speech';

    if (!file) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    const mlFormData = new FormData();
    mlFormData.append('file', file, 'audio.wav');
    mlFormData.append('source_lang', sourceLang);
    mlFormData.append('target_lang', targetLang);
    mlFormData.append('task', task);

    const response = await fetch(`${ML_SERVICE_URL.replace(/\/$/, '')}/translate-speech`, {
      method: 'POST',
      body: mlFormData,
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('ML service speech translation failed', { error: errText });
      return NextResponse.json({ error: 'Speech translation failed' }, { status: response.status });
    }

    if (task === 'speech_to_text') {
      const data = await response.json();
      return NextResponse.json(data);
    }

    const translatedText = response.headers.get('X-Translated-Text') || '';
    const audioBlob = await response.blob();

    return new Response(audioBlob, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'X-Translated-Text': encodeURIComponent(translatedText),
      },
    });
  } catch (error) {
    logger.error('Speech translation proxy error', { error: String(error) });
    return NextResponse.json({ error: 'Internal speech proxy error' }, { status: 500 });
  }
}
