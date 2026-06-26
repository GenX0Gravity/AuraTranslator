export type TranslationModelId =
  | 'indictrans2'
  | 'nllb-200'
  | 'm2m100'
  | 'seamless-m4t'
  | 'marianmt'
  | 'opus-mt'
  | 'domain-finetuned'
  | 'translation-memory'
  | 'google-translate'
  | 'libretranslate'
  | 'free-translate'
  | 'browser-offline'
  | 'gemini';

export type TranslationDomain =
  | 'general'
  | 'medical'
  | 'legal'
  | 'education'
  | 'finance'
  | 'technology'
  | 'engineering'
  | 'software_development'
  | 'government'
  | 'academic_research';

export type TranslationTone = 'formal' | 'casual' | 'neutral';

export interface TranslationRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
  domain?: TranslationDomain | 'auto';
  tone?: TranslationTone;
  workspaceId?: string;
  userId?: string;
  preferOffline?: boolean;
  lightweight?: boolean;
  contextHistory?: string[];
  documentContext?: string;
  profile?: {
    style?: string;
    tone?: string;
    vocabulary?: Record<string, string>;
  };
}

export interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage?: string;
  model: TranslationModelId;
  confidence: number;
  latencyMs: number;
  isCached?: boolean;
  isMock?: boolean;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface ModelBenchmarkEntry {
  model: TranslationModelId;
  languagePair: string;
  bleuScore?: number;
  cometScore?: number;
  latencyMs: number;
  memoryMb?: number;
  sampleCount: number;
  lastUpdated: string;
}

export interface TranslationFeedback {
  id?: string;
  userId?: string;
  workspaceId?: string;
  sourceText: string;
  predictedTranslation: string;
  correctedTranslation?: string;
  rating?: number;
  sourceLang: string;
  targetLang: string;
  model: TranslationModelId;
  domain?: TranslationDomain;
  createdAt?: string;
}

export const INDIAN_LANGUAGE_CODES = new Set([
  'bn', 'hi', 'mr', 'ta', 'te', 'kn', 'ml', 'gu', 'pa', 'as', 'or', 'ur',
]);

export const DOMAIN_LABELS: Record<TranslationDomain, string> = {
  general: 'General',
  medical: 'Medical',
  legal: 'Legal',
  education: 'Education',
  finance: 'Finance',
  technology: 'Technology',
  engineering: 'Engineering',
  software_development: 'Software Development',
  government: 'Government',
  academic_research: 'Academic Research',
};

export interface QualityScore {
  accuracyScore: number;
  confidenceScore: number;
  fluencyScore: number;
  grammarScore: number;
  domainAccuracyScore: number;
  bleuScore: number;
  cometScore: number;
  bertScore: number;
  feedback: string;
  alternativeTranslations?: string[];
}
