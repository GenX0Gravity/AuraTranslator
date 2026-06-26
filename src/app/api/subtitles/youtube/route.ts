import { NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`subtitles-youtube:${ip}`, RATE_LIMITS.translate);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  try {
    const { url: videoUrl, lang } = await request.json();
    if (!videoUrl) {
      return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
    }

    // Extract video ID
    const regExp = /^.*(?:(?:youtu.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = videoUrl.match(regExp);
    const videoId = (match && match[1].length === 11) ? match[1] : null;

    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL format' }, { status: 400 });
    }

    logger.info('Fetching YouTube watch page for transcript', { videoId });
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!pageRes.ok) {
      throw new Error(`YouTube watch page fetch failed with status ${pageRes.status}`);
    }

    const html = await pageRes.text();
    const keyMatch = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/i);
    if (!keyMatch) {
      return NextResponse.json({ error: 'YouTube transcript service currently unavailable (API key not found)' }, { status: 503 });
    }
    
    const apiKey = keyMatch[1];
    const playerUrl = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false`;
    const body = {
      videoId: videoId,
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '20.10.38',
          hl: 'en',
          gl: 'US',
          utcOffsetMinutes: 0
        }
      }
    };

    logger.info('Calling Innertube API for player details', { videoId });
    const playerRes = await fetch(playerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000)
    });

    if (!playerRes.ok) {
      throw new Error(`Innertube player API returned status ${playerRes.status}`);
    }

    const data = await playerRes.json();
    const captions = data.captions?.playerCaptionsTracklistRenderer;
    
    if (!captions || !captions.captionTracks || captions.captionTracks.length === 0) {
      return NextResponse.json({ error: 'No captions/subtitles available for this YouTube video.' }, { status: 404 });
    }

    const availableLanguages = captions.captionTracks.map((t: any) => ({
      code: t.languageCode,
      name: t.name?.runs?.[0]?.text || t.name?.simpleText || t.languageCode,
      isTranslatable: t.isTranslatable ?? false
    }));

    // Find the requested language, or fallback to English, or fallback to the first track
    let track = captions.captionTracks.find((t: any) => t.languageCode === lang);
    if (!track) {
      track = captions.captionTracks.find((t: any) => t.languageCode === 'en');
    }
    if (!track) {
      track = captions.captionTracks[0];
    }

    logger.info('Fetching selected timedtext caption track', { videoId, lang: track.languageCode });
    const captionRes = await fetch(track.baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!captionRes.ok) {
      throw new Error(`Timedtext track download failed with status ${captionRes.status}`);
    }

    const xmlText = await captionRes.text();
    if (!xmlText) {
      return NextResponse.json({ error: 'Timedtext track returned empty content' }, { status: 502 });
    }

    const regex = /<p t="(\d+)" d="(\d+)"[^>]*>([\s\S]*?)<\/p>/gi;
    let m;
    const segments = [];
    let count = 1;
    
    while ((m = regex.exec(xmlText)) !== null) {
      const startMs = parseInt(m[1], 10);
      const durationMs = parseInt(m[2], 10);
      const rawText = m[3].replace(/<[^>]*>/g, '').trim(); // Strip formatting tags like <s>
      const text = decodeHtmlEntities(rawText);
      
      if (!text) continue;

      segments.push({
        id: count++,
        start: startMs / 1000,
        end: (startMs + durationMs) / 1000,
        text
      });
    }

    logger.info('Successfully parsed subtitles', { videoId, segmentsCount: segments.length });

    return NextResponse.json({
      videoId,
      segments,
      language: track.languageCode,
      availableLanguages
    });

  } catch (error) {
    logger.error('YouTube subtitles fetch error', { error: String(error) });
    return NextResponse.json({ error: 'Failed to fetch YouTube subtitles: ' + String(error) }, { status: 500 });
  }
}
