import type { TranslationModelId } from './types';

const MODEL_BASE_CONFIDENCE: Record<TranslationModelId, number> = {
  'translation-memory': 0.98,
  'domain-finetuned': 0.92,
  indictrans2: 0.90,
  'nllb-200': 0.88,
  m2m100: 0.85,
  'seamless-m4t': 0.89,
  marianmt: 0.82,
  'opus-mt': 0.80,
  'google-translate': 0.87,
  libretranslate: 0.78,
  'free-translate': 0.65,
  'browser-offline': 0.75,
  'gemini': 0.95,
};

export function estimateConfidence(
  model: TranslationModelId,
  options: {
    textLength?: number;
    mlConfidence?: number;
    isCached?: boolean;
  } = {}
): number {
  let score = options.mlConfidence ?? MODEL_BASE_CONFIDENCE[model] ?? 0.7;

  if (options.isCached) score = Math.min(0.99, score + 0.02);

  const len = options.textLength ?? 0;
  if (len > 2000) score -= 0.05;
  if (len > 4000) score -= 0.08;
  if (len < 10) score -= 0.03;

  return Math.max(0.1, Math.min(0.99, Math.round(score * 100) / 100));
}

export function shouldFallback(confidence: number, threshold = 0.6): boolean {
  return confidence < threshold;
}
