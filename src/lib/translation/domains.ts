import type { TranslationDomain, TranslationModelId } from './types';
import { INDIAN_LANGUAGE_CODES } from './types';

export interface RoutingDecision {
  primaryModel: TranslationModelId;
  fallbackModels: TranslationModelId[];
  reason: string;
}

const DOMAIN_MODEL_MAP: Partial<Record<TranslationDomain, TranslationModelId>> = {
  medical: 'domain-finetuned',
  legal: 'domain-finetuned',
  education: 'domain-finetuned',
  finance: 'domain-finetuned',
  technology: 'domain-finetuned',
  engineering: 'domain-finetuned',
  software_development: 'domain-finetuned',
  government: 'domain-finetuned',
  academic_research: 'domain-finetuned',
};

const OPUS_PAIRS = new Set([
  'en-de', 'de-en', 'en-fr', 'fr-en', 'en-es', 'es-en', 'en-it', 'it-en',
  'en-pt', 'pt-en', 'en-ru', 'ru-en', 'en-ja', 'ja-en', 'en-zh', 'zh-en'
]);

const SEAMLESS_LANGS = new Set([
  'af', 'am', 'ar', 'as', 'ast', 'az', 'be', 'bn', 'bs', 'bg', 'ca', 'ceb', 'cs', 'cy', 'da', 'de', 'el', 'en', 'es', 'et',
  'eu', 'fa', 'fi', 'fr', 'fy', 'ga', 'gd', 'gl', 'gu', 'ha', 'he', 'hi', 'hr', 'hu', 'hy', 'id', 'ig', 'is', 'it', 'ja',
  'jv', 'ka', 'kk', 'km', 'kn', 'ko', 'ku', 'ky', 'lo', 'lt', 'lv', 'mg', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my', 'ne',
  'nl', 'no', 'ny', 'or', 'pa', 'pl', 'ps', 'pt', 'ro', 'ru', 'sd', 'si', 'sk', 'sl', 'so', 'sq', 'sr', 'su', 'sv', 'sw',
  'ta', 'te', 'tg', 'th', 'tl', 'tr', 'uk', 'ur', 'uz', 'vi', 'xh', 'yi', 'yo', 'zu'
]);

export function isModelSupported(
  modelId: TranslationModelId,
  src: string,
  tgt: string,
  domain: TranslationDomain = 'general'
): boolean {
  if (modelId === 'domain-finetuned') {
    return domain !== 'general';
  }

  const s = src.split('-')[0].toLowerCase();
  const t = tgt.split('-')[0].toLowerCase();

  if (modelId === 'indictrans2') {
    const isSrcIndian = INDIAN_LANGUAGE_CODES.has(s);
    const isTgtIndian = INDIAN_LANGUAGE_CODES.has(t);
    const isSrcEn = s === 'en';
    const isTgtEn = t === 'en';
    return (isSrcIndian && isTgtIndian) || (isSrcEn && isTgtIndian) || (isSrcIndian && isTgtEn);
  }

  if (modelId === 'opus-mt' || modelId === 'marianmt') {
    return OPUS_PAIRS.has(`${s}-${t}`);
  }

  if (modelId === 'seamless-m4t') {
    return SEAMLESS_LANGS.has(s) && SEAMLESS_LANGS.has(t);
  }

  if (modelId === 'm2m100') {
    return SEAMLESS_LANGS.has(s) && SEAMLESS_LANGS.has(t);
  }

  if (modelId === 'nllb-200') {
    return true;
  }

  if (['google-translate', 'libretranslate', 'free-translate', 'browser-offline'].includes(modelId)) {
    return true;
  }

  return false;
}

export function getModelQualityScore(
  modelId: TranslationModelId,
  src: string,
  tgt: string,
  domain: TranslationDomain = 'general'
): number {
  if (!isModelSupported(modelId, src, tgt, domain)) {
    return -1;
  }

  const scores: Record<TranslationModelId, number> = {
    'translation-memory': 98,
    'domain-finetuned': 95,
    'indictrans2': 92,
    'opus-mt': 88,
    'marianmt': 88,
    'google-translate': 87,
    'seamless-m4t': 85,
    'nllb-200': 82,
    'libretranslate': 78,
    'm2m100': 75,
    'browser-offline': 75,
    'free-translate': 65,
    'gemini': 95,
  };

  return scores[modelId] ?? 0;
}

export function selectModelForPair(
  sourceLang: string,
  targetLang: string,
  options: {
    domain?: TranslationDomain;
    lightweight?: boolean;
    preferIndian?: boolean;
  } = {}
): RoutingDecision {
  const src = sourceLang === 'auto' ? 'en' : sourceLang.split('-')[0].toLowerCase();
  const tgt = targetLang.split('-')[0].toLowerCase();
  const { domain = 'general', lightweight = false } = options;

  if (domain !== 'general' && isModelSupported('domain-finetuned', src, tgt, domain)) {
    return {
      primaryModel: 'domain-finetuned',
      fallbackModels: ['indictrans2', 'nllb-200', 'google-translate'],
      reason: `Domain-specific model for ${domain}`,
    };
  }

  let candidates: TranslationModelId[] = [
    'indictrans2',
    'opus-mt',
    'marianmt',
    'seamless-m4t',
    'nllb-200',
    'm2m100',
    'google-translate',
    'libretranslate',
    'free-translate'
  ];

  if (lightweight) {
    if (isModelSupported('marianmt', src, tgt, domain)) {
      return {
        primaryModel: 'marianmt',
        fallbackModels: ['opus-mt', 'nllb-200', 'free-translate'],
        reason: 'Lightweight request — MarianMT preferred',
      };
    }
    if (isModelSupported('opus-mt', src, tgt, domain)) {
      return {
        primaryModel: 'opus-mt',
        fallbackModels: ['marianmt', 'nllb-200', 'free-translate'],
        reason: 'Lightweight request — OPUS-MT preferred',
      };
    }
  }

  const scoredCandidates = candidates
    .map(model => ({ model, score: getModelQualityScore(model, src, tgt, domain) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scoredCandidates.length === 0) {
    return {
      primaryModel: 'nllb-200',
      fallbackModels: ['google-translate', 'free-translate'],
      reason: 'Fallback to default models due to unsupported language pair'
    };
  }

  const primaryModel = scoredCandidates[0].model;
  const fallbackModels = scoredCandidates.slice(1).map(c => c.model);

  let reason = `Selected ${primaryModel} as optimal based on language pair quality score (${getModelQualityScore(primaryModel, src, tgt, domain)})`;
  if (primaryModel === 'indictrans2') {
    reason = 'Indian language pair — IndicTrans2 optimized';
  } else if (primaryModel === 'opus-mt' || primaryModel === 'marianmt') {
    reason = `Well-supported ${primaryModel.toUpperCase()} language pair`;
  }

  return {
    primaryModel,
    fallbackModels,
    reason,
  };
}

export function getDomainPromptPrefix(domain: TranslationDomain, tone?: string): string {
  const tonePrefix =
    tone === 'formal'
      ? 'Use formal register. '
      : tone === 'casual'
        ? 'Use casual, conversational register. '
        : '';

  const domainPrompts: Record<TranslationDomain, string> = {
    general: '',
    medical: 'Translate using medical terminology accurately. Preserve drug names and clinical terms. ',
    legal: 'Translate using precise legal terminology. Maintain contractual meaning. ',
    education: 'Translate for educational clarity. Use accessible language for learners. ',
    finance: 'Translate financial terms precisely. Preserve numerical and currency context. ',
    technology: 'Translate technical terms accurately. Keep standard IT/software terminology. ',
    engineering: 'Translate using engineering and technical specifications accurately. ',
    software_development: 'Translate using software development and programming terminology. Keep code keywords and syntax unchanged. ',
    government: 'Translate official government document style. Use formal administrative language. ',
    academic_research: 'Translate using formal academic and scientific research style. ',
  };

  return tonePrefix + domainPrompts[domain];
}
