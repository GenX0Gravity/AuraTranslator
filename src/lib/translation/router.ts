import { logger } from '@/lib/logger';
import type { TranslationModelId, TranslationRequest, TranslationResult, TranslationDomain } from './types';
import { selectModelForPair } from './domains';
import { detectLanguage } from './language-detection';
import { estimateConfidence, shouldFallback } from './confidence';
import { translateWithMlService, isMlServiceAvailable, ML_SERVICE_URL, classifyDomain } from './providers/ml-service';
import { translateWithGoogle } from './providers/google-translate';
import { translateWithLibre } from './providers/libretranslate';
import { translateWithFreeApi } from './providers/free-translate';
import { lookupTranslationMemory, storeTranslationMemory } from './providers/translation-memory';
import { translateWithGemini } from './providers/gemini';
import { INDIAN_LANGUAGE_CODES } from './types';
import { getUserProfile, applyVocabularyGlossary, preProcessGlossary, postProcessGlossary, GlossaryMapping } from './profile';


const cache = new Map<string, TranslationResult>();
const MAX_CACHE_SIZE = 2000;

function cacheKey(req: TranslationRequest): string {
  return `${req.sourceLang}:${req.targetLang}:${req.domain ?? 'general'}:${req.text.trim()}`;
}

async function tryModel(
  model: TranslationModelId,
  request: TranslationRequest
): Promise<TranslationResult | null> {
  switch (model) {
    case 'indictrans2':
    case 'nllb-200':
    case 'm2m100':
    case 'seamless-m4t':
    case 'marianmt':
    case 'opus-mt':
    case 'domain-finetuned':
      return translateWithMlService(request, model);
    case 'google-translate':
      return translateWithGoogle(request);
    case 'libretranslate':
      return translateWithLibre(request);
    case 'free-translate':
      return translateWithFreeApi(request);
    case 'gemini':
      return translateWithGemini(request);
    default:
      return null;
  }
}

export interface HybridTranslateOptions {
  userId?: string;
  skipCache?: boolean;
}

export async function hybridTranslate(
  request: TranslationRequest,
  options: HybridTranslateOptions = {}
): Promise<TranslationResult> {
  const start = Date.now();
  const trimmed = request.text.trim();
  const key = cacheKey(request);

  // Load user translation profile if available
  const activeProfile = request.profile || (options.userId ? await getUserProfile(options.userId) : null);
  
  // Apply preferred tone override if profile has one and it is not specified in request
  if (activeProfile && activeProfile.tone && activeProfile.tone !== 'neutral' && !request.tone) {
    request.tone = activeProfile.tone as any;
  }

  if (!options.skipCache && cache.has(key)) {
    const cached = cache.get(key)!;
    return { ...cached, isCached: true };
  }

  // 1. Translation Memory
  if (options.userId) {
    const tmResult = await lookupTranslationMemory(request, options.userId);
    if (tmResult) return tmResult;
  }


  // 2. Resolve source language if auto
  let resolvedSource = request.sourceLang;
  if (resolvedSource === 'auto') {
    const detected = await detectLanguage(trimmed, ML_SERVICE_URL);
    resolvedSource = detected.language;
  }

  // 2.1 Resolve domain if auto
  let resolvedDomain = request.domain === 'auto' ? 'general' : (request.domain ?? 'general');
  let detectedDomain: TranslationDomain | null = null;
  if (request.domain === 'auto') {
    try {
      const classification = await classifyDomain(trimmed);
      if (classification && classification.domain && classification.domain !== 'general') {
        resolvedDomain = classification.domain as TranslationDomain;
        detectedDomain = classification.domain as TranslationDomain;
      }
    } catch (err) {
      logger.warn('Domain classification failed, using general', { error: String(err) });
    }
  }

  // Check cache again with resolved language & domain if request domain was 'auto' or sourceLang was 'auto'
  if (request.domain === 'auto' || request.sourceLang === 'auto') {
    const resolvedKey = `${resolvedSource}:${request.targetLang}:${resolvedDomain}:${trimmed}`;
    if (!options.skipCache && cache.has(resolvedKey)) {
      const cached = cache.get(resolvedKey)!;
      return { ...cached, isCached: true };
    }
  }

  const enrichedRequest = { ...request, sourceLang: resolvedSource, domain: resolvedDomain, profile: activeProfile || undefined };

  // 2b. Context-Aware Translation using Gemini
  const hasContext = (request.contextHistory && request.contextHistory.length > 0) || request.documentContext;
  if (hasContext && process.env.GEMINI_API_KEY) {
    const geminiResult = await translateWithGemini(enrichedRequest);
    if (geminiResult) {
      // Apply vocabulary glossary post-processing
      if (activeProfile?.vocabulary && Object.keys(activeProfile.vocabulary).length > 0) {
        geminiResult.translatedText = applyVocabularyGlossary(geminiResult.translatedText, activeProfile.vocabulary);
      }

      if (options.userId) {
        storeTranslationMemory(options.userId, {
          sourceText: request.text,
          translatedText: geminiResult.translatedText,
          sourceLang: resolvedSource,
          targetLang: request.targetLang,
          workspaceId: request.workspaceId,
          model: 'gemini',
          domain: resolvedDomain
        }).catch((err) => logger.warn('Failed to store translation memory in background', { error: String(err) }));
      }
      return geminiResult;
    }
  }


  // 3. Route to best model
  const routing = selectModelForPair(resolvedSource, request.targetLang, {
    domain: resolvedDomain,
    lightweight: request.lightweight,
    preferIndian:
      INDIAN_LANGUAGE_CODES.has(request.targetLang) ||
      INDIAN_LANGUAGE_CODES.has(resolvedSource),
  });

  const modelsToTry: TranslationModelId[] = [
    routing.primaryModel,
    ...routing.fallbackModels,
  ];

  // If ML service offline, skip OSS models and go to API fallbacks
  const effectiveModels = isMlServiceAvailable()
    ? modelsToTry
    : modelsToTry.filter(
        (m) =>
          !['indictrans2', 'nllb-200', 'm2m100', 'seamless-m4t', 'marianmt', 'opus-mt', 'domain-finetuned'].includes(m)
      );

  let lastResult: TranslationResult | null = null;

  for (const model of effectiveModels) {
    try {
      const usePlaceholders = model !== 'gemini' && activeProfile?.vocabulary && Object.keys(activeProfile.vocabulary).length > 0;
      let modelRequest = enrichedRequest;
      let glossaryMappings: GlossaryMapping[] = [];

      if (usePlaceholders) {
        const preprocessed = preProcessGlossary(enrichedRequest.text, activeProfile.vocabulary!);
        modelRequest = { ...enrichedRequest, text: preprocessed.text };
        glossaryMappings = preprocessed.mappings;
      }


      const result = await tryModel(model, modelRequest);
      if (!result) continue;

      if (usePlaceholders && result.translatedText) {
        result.translatedText = postProcessGlossary(result.translatedText, glossaryMappings);
      }


      const confidence = estimateConfidence(result.model, {
        textLength: trimmed.length,
        mlConfidence: result.confidence,
      });

      result.confidence = confidence;
      result.latencyMs = result.latencyMs || Date.now() - start;
      result.detectedSourceLanguage =
        result.detectedSourceLanguage ?? (request.sourceLang === 'auto' ? resolvedSource : request.sourceLang);
      result.metadata = {
        routingReason: routing.reason,
        attemptedModel: model,
        detectedDomain: detectedDomain || undefined,
      };

      if (!shouldFallback(confidence)) {
        lastResult = result;
        break;
      }

      lastResult = result;
    } catch (err) {
      logger.warn('Model attempt failed', { model, error: String(err) });
    }
  }

  if (lastResult) {
    // Apply vocabulary glossary post-processing
    if (activeProfile?.vocabulary && Object.keys(activeProfile.vocabulary).length > 0) {
      lastResult.translatedText = applyVocabularyGlossary(lastResult.translatedText, activeProfile.vocabulary);
    }

    if (cache.size >= MAX_CACHE_SIZE) cache.clear();
    cache.set(key, lastResult);
    // Also cache under resolved key
    const resolvedKey = `${resolvedSource}:${request.targetLang}:${resolvedDomain}:${trimmed}`;
    if (resolvedKey !== key) {
      cache.set(resolvedKey, lastResult);
    }
    return lastResult;
  }


  // Mock fallback
  return {
    translatedText: `[Translation unavailable] "${trimmed.slice(0, 100)}${trimmed.length > 100 ? '...' : ''}" → ${request.targetLang.toUpperCase()}`,
    detectedSourceLanguage: resolvedSource,
    model: 'free-translate',
    confidence: 0.1,
    latencyMs: Date.now() - start,
    isMock: true,
  };
}

export { selectModelForPair, isMlServiceAvailable };
