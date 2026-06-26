import { logger } from '@/lib/logger';
import type { TranslationRequest, TranslationResult } from '../types';

export async function translateWithFreeApi(
  request: TranslationRequest
): Promise<TranslationResult | null> {
  const start = Date.now();

  try {
    const translateLib = (await import('google-translate-api-x')).default;
    const result = await translateLib(request.text.trim(), {
      from: request.sourceLang === 'auto' ? 'auto' : request.sourceLang,
      to: request.targetLang,
    });

    if (!result?.text) return null;

    return {
      translatedText: result.text,
      detectedSourceLanguage: result.from?.language?.iso || request.sourceLang,
      model: 'free-translate',
      confidence: 0.65,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    logger.error('Free translate API error', { error: String(err) });
    return null;
  }
}
