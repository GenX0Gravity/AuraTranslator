import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const translateSchema = z.object({
  text: z.string().min(1).max(5000),
  sourceLang: z.string().min(2).max(10),
  targetLang: z.string().min(2).max(10),
  workspaceId: z.string().optional(),
});

// Capped in-memory cache for fast repeated lookups
const cache = new Map<string, { translatedText: string; detectedSourceLanguage?: string }>();
const MAX_CACHE_SIZE = 1000;

function detectLanguageMock(text: string): string {
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  const clean = text.toLowerCase().trim();
  if (/\b(hola|gracias|buenos|amigo|como|está|sí)\b/i.test(clean) || /[¿¡ñáéíóú]/.test(text)) return 'es';
  if (/\b(bonjour|merci|oui|s'il|comment|aller|et)\b/i.test(clean) || /[çéèàùûâô]/.test(text)) return 'fr';
  if (/\b(hallo|danke|ja|bitte|guten|tag|und)\b/i.test(clean) || /[äöüß]/.test(text)) return 'de';
  if (/\b(ciao|grazie|si|buongiorno|come|stai)\b/i.test(clean) || /[ìòù]/.test(text)) return 'it';
  if (/\b(olá|obrigado|sim|como|vai|tudo|bem)\b/i.test(clean) || /[ãõçáéíóúêâô]/.test(text)) return 'pt';
  return 'en';
}

export async function POST(request: Request): Promise<NextResponse> {
  // Rate limiting
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`translate:${ip}`, RATE_LIMITS.translate);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  try {
    const body = await request.json();
    const parsed = translateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request: ' + parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { text, sourceLang, targetLang, workspaceId } = parsed.data;
    const trimmedText = text.trim();

    // Check in-memory cache first
    const cacheKey = `${sourceLang}:${targetLang}:${trimmedText}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!;
      return NextResponse.json({
        translatedText: cached.translatedText,
        detectedSourceLanguage: cached.detectedSourceLanguage,
        isCached: true,
        isMock: false,
      });
    }

    // Check Translation Memory in Firestore (for authenticated users)
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as { id?: string }).id) {
      const userId = (session.user as { id: string }).id;
      try {
        const db = getAdminDb();
        const tmRef = db.collection('translation_memory');
        const tmQuery = workspaceId
          ? tmRef
              .where('workspaceId', '==', workspaceId)
              .where('sourceLang', '==', sourceLang)
              .where('targetLang', '==', targetLang)
              .where('sourceText', '==', trimmedText)
              .limit(1)
          : tmRef
              .where('userId', '==', userId)
              .where('sourceLang', '==', sourceLang)
              .where('targetLang', '==', targetLang)
              .where('sourceText', '==', trimmedText)
              .limit(1);

        const tmSnapshot = await tmQuery.get();
        if (!tmSnapshot.empty) {
          const tmDoc = tmSnapshot.docs[0].data();
          return NextResponse.json({
            translatedText: tmDoc.translatedText,
            detectedSourceLanguage: sourceLang !== 'auto' ? sourceLang : undefined,
            isCached: true,
            isMock: false,
            source: 'translation_memory',
          });
        }
      } catch (dbErr) {
        // TM lookup failure is non-fatal — continue to translation API
        logger.warn('Translation memory lookup failed', { error: String(dbErr) });
      }
    }

    const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    const libreKey = process.env.LIBRETRANSLATE_API_KEY;
    const libreUrl = process.env.LIBRETRANSLATE_API_URL || 'https://libretranslate.com';

    // 1. Google Translate API (Primary)
    if (googleKey) {
      const url = `https://translation.googleapis.com/language/translate/v2?key=${googleKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: [trimmedText],
          target: targetLang,
          source: sourceLang === 'auto' ? undefined : sourceLang,
        }),
      });

      if (!response.ok) {
        // Don't expose raw Google error to client
        logger.error('Google Translate API error', { status: response.status });
        throw new Error('Translation service temporarily unavailable.');
      }

      const result = await response.json();
      const translation = result.data?.translations?.[0];

      if (translation) {
        const translatedText: string = translation.translatedText;
        const detectedSourceLanguage: string | undefined = translation.detectedSourceLanguage;

        if (cache.size >= MAX_CACHE_SIZE) cache.clear();
        cache.set(cacheKey, { translatedText, detectedSourceLanguage });

        return NextResponse.json({ translatedText, detectedSourceLanguage, isMock: false });
      }
    }

    // 2. LibreTranslate API (Secondary)
    if (libreKey || process.env.LIBRETRANSLATE_API_URL) {
      const response = await fetch(`${libreUrl.replace(/\/$/, '')}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: trimmedText,
          source: sourceLang === 'auto' ? 'auto' : sourceLang,
          target: targetLang,
          api_key: libreKey || undefined,
        }),
      });

      if (!response.ok) {
        logger.error('LibreTranslate API error', { status: response.status });
        throw new Error('Fallback translation service unavailable.');
      }

      const result = await response.json();
      if (result.translatedText) {
        const translatedText: string = result.translatedText;
        const detectedSourceLanguage: string | undefined =
          result.detectedSourceLanguage?.language;

        if (cache.size >= MAX_CACHE_SIZE) cache.clear();
        cache.set(cacheKey, { translatedText, detectedSourceLanguage });

        return NextResponse.json({ translatedText, detectedSourceLanguage, isMock: false });
      }
    }

    // 3. Mock fallback
    await new Promise((resolve) => setTimeout(resolve, 600));
    const detectedMockLang = sourceLang === 'auto' ? detectLanguageMock(trimmedText) : sourceLang;
    const lowerText = trimmedText.toLowerCase();

    const dictionary: Record<string, Record<string, string>> = {
      hello: { es: 'Hola', fr: 'Bonjour', de: 'Hallo', it: 'Ciao', pt: 'Olá', hi: 'नमस्ते', zh: '你好', ja: 'こんにちは', ko: '안녕하세요' },
      'thank you': { es: 'Gracias', fr: 'Merci', de: 'Danke', it: 'Grazie', pt: 'Obrigado', hi: 'धन्यवाद', zh: '谢谢', ja: 'ありがとう', ko: '감사합니다' },
      goodbye: { es: 'Adiós', fr: 'Au revoir', de: 'Auf Wiedersehen', it: 'Arrivederci', pt: 'Adeus', hi: 'अलविदा', zh: '再见', ja: 'さようなら', ko: '안녕히 가세요' },
      'how are you?': { es: '¿Cómo estás?', fr: 'Comment ça va?', de: 'Wie geht es dir?', it: 'Come stai?', pt: 'Como você está?', hi: 'आप कैसे हैं?', zh: '你好吗？', ja: 'お元気ですか？', ko: '어떻게 지내세요?' },
    };

    const mockResult =
      dictionary[lowerText]?.[targetLang] ??
      `[Demo Mode] Translated "${trimmedText}" from ${detectedMockLang.toUpperCase()} to ${targetLang.toUpperCase()}.`;

    return NextResponse.json({ translatedText: mockResult, detectedSourceLanguage: detectedMockLang, isMock: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Translation failed';
    logger.error('Translation backend error', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
