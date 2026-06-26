import { logger } from '@/lib/logger';
import type { TranslationRequest, TranslationResult } from '../types';

export async function translateWithLibre(
  request: TranslationRequest
): Promise<TranslationResult | null> {
  const libreKey = process.env.LIBRETRANSLATE_API_KEY;
  const libreUrl = process.env.LIBRETRANSLATE_API_URL || 'https://libretranslate.com';

  if (!libreKey && !process.env.LIBRETRANSLATE_API_URL) return null;

  const start = Date.now();
  const response = await fetch(`${libreUrl.replace(/\/$/, '')}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: request.text.trim(),
      source: request.sourceLang === 'auto' ? 'auto' : request.sourceLang,
      target: request.targetLang,
      api_key: libreKey || undefined,
    }),
  });

  if (!response.ok) {
    logger.error('LibreTranslate API error', { status: response.status });
    return null;
  }

  const result = await response.json();
  if (!result.translatedText) return null;

  return {
    translatedText: result.translatedText,
    detectedSourceLanguage: result.detectedSourceLanguage?.language,
    model: 'libretranslate',
    confidence: 0.78,
    latencyMs: Date.now() - start,
  };
}
