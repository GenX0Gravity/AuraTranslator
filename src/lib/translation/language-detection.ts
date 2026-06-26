import { normalizeLangCode } from './language-codes';

interface DetectionResult {
  language: string;
  confidence: number;
}

const SCRIPT_PATTERNS: Array<{ lang: string; pattern: RegExp; weight: number }> = [
  { lang: 'hi', pattern: /[\u0900-\u097F]/, weight: 0.95 },
  { lang: 'bn', pattern: /[\u0980-\u09FF]/, weight: 0.92 },
  { lang: 'ta', pattern: /[\u0B80-\u0BFF]/, weight: 0.92 },
  { lang: 'te', pattern: /[\u0C00-\u0C7F]/, weight: 0.92 },
  { lang: 'kn', pattern: /[\u0C80-\u0CFF]/, weight: 0.92 },
  { lang: 'ml', pattern: /[\u0D00-\u0D7F]/, weight: 0.92 },
  { lang: 'gu', pattern: /[\u0A80-\u0AFF]/, weight: 0.92 },
  { lang: 'pa', pattern: /[\u0A00-\u0A7F]/, weight: 0.90 },
  { lang: 'or', pattern: /[\u0B00-\u0B7F]/, weight: 0.90 },
  { lang: 'ja', pattern: /[\u3040-\u309F\u30A0-\u30FF]/, weight: 0.95 },
  { lang: 'zh', pattern: /[\u4E00-\u9FFF]/, weight: 0.90 },
  { lang: 'ko', pattern: /[\uAC00-\uD7AF]/, weight: 0.95 },
  { lang: 'ru', pattern: /[\u0400-\u04FF]/, weight: 0.85 },
  { lang: 'ar', pattern: /[\u0600-\u06FF]/, weight: 0.90 },
  { lang: 'ur', pattern: /[\u0600-\u06FF\u0750-\u077F]/, weight: 0.75 },
  { lang: 'he', pattern: /[\u0590-\u05FF]/, weight: 0.95 },
  { lang: 'th', pattern: /[\u0E00-\u0E7F]/, weight: 0.95 },
];

const KEYWORD_PATTERNS: Array<{ lang: string; pattern: RegExp; weight: number }> = [
  { lang: 'es', pattern: /\b(hola|gracias|buenos|amigo|como|está|sí|por favor)\b/i, weight: 0.7 },
  { lang: 'fr', pattern: /\b(bonjour|merci|oui|comment|aller|et|je|nous)\b/i, weight: 0.7 },
  { lang: 'de', pattern: /\b(hallo|danke|ja|bitte|guten|und|ich|wir)\b/i, weight: 0.7 },
  { lang: 'it', pattern: /\b(ciao|grazie|si|buongiorno|come|stai|per favore)\b/i, weight: 0.7 },
  { lang: 'pt', pattern: /\b(olá|obrigado|sim|como|vai|tudo|bem|por favor)\b/i, weight: 0.7 },
  { lang: 'hi', pattern: /\b(है|और|में|के|की|को|से|यह|वह|नमस्ते)\b/, weight: 0.8 },
  { lang: 'bn', pattern: /\b(আমি|এবং|হয়|কর|তোমার|আপনার|ধন্যবাদ)\b/, weight: 0.8 },
];

export function detectLanguageLocal(text: string): DetectionResult {
  const trimmed = text.trim();
  if (!trimmed) return { language: 'en', confidence: 0.5 };

  for (const { lang, pattern, weight } of SCRIPT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { language: lang, confidence: weight };
    }
  }

  for (const { lang, pattern, weight } of KEYWORD_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { language: lang, confidence: weight };
    }
  }

  return { language: 'en', confidence: 0.55 };
}

export async function detectLanguage(
  text: string,
  mlServiceUrl?: string
): Promise<DetectionResult> {
  const local = detectLanguageLocal(text);

  if (mlServiceUrl) {
    try {
      const response = await fetch(`${mlServiceUrl.replace(/\/$/, '')}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 1000) }),
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.language) {
          return {
            language: normalizeLangCode(data.language),
            confidence: data.confidence ?? 0.85,
          };
        }
      }
    } catch {
      // Fall through to local detection
    }
  }

  return local;
}
