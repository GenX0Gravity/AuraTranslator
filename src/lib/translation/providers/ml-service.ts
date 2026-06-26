import { logger } from '@/lib/logger';
import type { TranslationModelId, TranslationRequest, TranslationResult } from '../types';
import { toNllbCode, toIndicTransCode } from '../language-codes';
import { getDomainPromptPrefix } from '../domains';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || process.env.NEXT_PUBLIC_ML_SERVICE_URL;

export function isMlServiceAvailable(): boolean {
  return Boolean(ML_SERVICE_URL);
}

interface MlTranslateResponse {
  translated_text: string;
  detected_language?: string;
  model: string;
  confidence?: number;
  latency_ms?: number;
}

async function callMlService(
  endpoint: string,
  body: Record<string, unknown>
): Promise<MlTranslateResponse | null> {
  if (!ML_SERVICE_URL) return null;

  try {
    const response = await fetch(`${ML_SERVICE_URL.replace(/\/$/, '')}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      logger.warn('ML service error', { status: response.status, endpoint });
      return null;
    }

    return (await response.json()) as MlTranslateResponse;
  } catch (err) {
    logger.warn('ML service unreachable', { endpoint, error: String(err) });
    return null;
  }
}

export async function translateWithMlService(
  request: TranslationRequest,
  model: TranslationModelId
): Promise<TranslationResult | null> {
  const start = Date.now();
  const resolvedDomain = request.domain === 'auto' ? 'general' : (request.domain ?? 'general');
  const domainPrefix = getDomainPromptPrefix(resolvedDomain, request.tone);
  const text = domainPrefix ? `${domainPrefix}${request.text}` : request.text;

  const result = await callMlService('/translate', {
    text,
    source_lang: request.sourceLang,
    target_lang: request.targetLang,
    model,
    domain: resolvedDomain,
    source_nllb: toNllbCode(request.sourceLang === 'auto' ? 'en' : request.sourceLang),
    target_nllb: toNllbCode(request.targetLang),
    source_indic: toIndicTransCode(request.sourceLang === 'auto' ? 'en' : request.sourceLang),
    target_indic: toIndicTransCode(request.targetLang),
  });

  if (!result?.translated_text) return null;

  return {
    translatedText: result.translated_text,
    detectedSourceLanguage: result.detected_language,
    model: (result.model as TranslationModelId) || model,
    confidence: result.confidence ?? 0.85,
    latencyMs: result.latency_ms ?? Date.now() - start,
  };
}

export async function benchmarkModels(
  sourceLang: string,
  targetLang: string,
  samples: string[]
): Promise<unknown> {
  if (!ML_SERVICE_URL) {
    return { error: 'ML service not configured' };
  }

  const response = await fetch(`${ML_SERVICE_URL.replace(/\/$/, '')}/benchmark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_lang: sourceLang, target_lang: targetLang, samples }),
    signal: AbortSignal.timeout(300000),
  });

  if (!response.ok) {
    throw new Error(`Benchmark failed: ${response.status}`);
  }

  return response.json();
}

export async function listAvailableModels(): Promise<unknown> {
  if (!ML_SERVICE_URL) {
    return {
      models: ['nllb-200', 'm2m100', 'marianmt', 'indictrans2', 'opus-mt'],
      status: 'ml_service_offline',
    };
  }

  try {
    const response = await fetch(`${ML_SERVICE_URL.replace(/\/$/, '')}/models`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) return response.json();
  } catch {
    // fall through
  }

  return { models: [], status: 'unreachable' };
}

interface MlClassifyDomainResponse {
  domain: string;
  confidence: number;
  scores: Record<string, number>;
}

export async function classifyDomain(text: string): Promise<MlClassifyDomainResponse | null> {
  if (!ML_SERVICE_URL) return null;

  try {
    const response = await fetch(`${ML_SERVICE_URL.replace(/\/$/, '')}/classify-domain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.warn('ML service domain classification error', { status: response.status });
      return null;
    }

    return (await response.json()) as MlClassifyDomainResponse;
  } catch (err) {
    logger.warn('ML service domain classification unreachable', { error: String(err) });
    return null;
  }
}

export { ML_SERVICE_URL };
