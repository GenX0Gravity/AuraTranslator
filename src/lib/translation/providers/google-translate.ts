import { logger } from '@/lib/logger';
import type { TranslationRequest, TranslationResult } from '../types';

export async function translateWithGoogle(
  request: TranslationRequest
): Promise<TranslationResult | null> {
  const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!googleKey) return null;

  const start = Date.now();
  const url = `https://translation.googleapis.com/language/translate/v2?key=${googleKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: [request.text.trim()],
      target: request.targetLang,
      source: request.sourceLang === 'auto' ? undefined : request.sourceLang,
    }),
  });

  if (!response.ok) {
    logger.error('Google Translate API error', { status: response.status });
    return null;
  }

  const result = await response.json();
  const translation = result.data?.translations?.[0];
  if (!translation) return null;

  return {
    translatedText: translation.translatedText,
    detectedSourceLanguage: translation.detectedSourceLanguage,
    model: 'google-translate',
    confidence: 0.87,
    latencyMs: Date.now() - start,
  };
}
