import { GoogleGenAI } from '@google/genai';
import { logger } from '@/lib/logger';
import type { TranslationRequest, TranslationResult } from '../types';
import { getUserProfile } from '../profile';

export async function translateWithGemini(
  request: TranslationRequest
): Promise<TranslationResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.warn('GEMINI_API_KEY not configured. Skipping Gemini translation.');
    return null;
  }

  const start = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey });

    const { text, sourceLang, targetLang, domain = 'general', tone = 'neutral', contextHistory = [], documentContext = '' } = request;

    // Load user translation profile if available
    const activeProfile = request.profile || (request.userId ? await getUserProfile(request.userId) : null);
    let styleRule = '';
    let toneRule = '';
    let vocabRule = '';

    if (activeProfile) {
      if (activeProfile.style && activeProfile.style !== 'neutral') {
        styleRule = `Writing Style Preference: Translate in a strictly "${activeProfile.style}" writing style (formal, informal, business, academic, or technical).\n`;
      }
      if (activeProfile.tone && activeProfile.tone !== 'neutral') {
        toneRule = `Tone Register Preference: Translate in a strictly "${activeProfile.tone}" tone register.\n`;
      }
      if (activeProfile.vocabulary && Object.keys(activeProfile.vocabulary).length > 0) {
        vocabRule = `Terminology Glossary: You MUST enforce these specific terminology rules:
        ${JSON.stringify(activeProfile.vocabulary)}
        If a word/phrase matching a key in the glossary appears in the source, translate it to its corresponding value in the output.\n`;
      }
    }

    let prompt = `You are an expert translator. Translate the following Source text from "${sourceLang}" to "${targetLang}".\n\n`;

    if (styleRule) prompt += styleRule;
    if (toneRule) prompt += toneRule;
    if (vocabRule) prompt += vocabRule;


    if (domain && domain !== 'general') {
      prompt += `Subject Matter Domain: ${domain}\n`;
    }
    if (tone && tone !== 'neutral') {
      prompt += `Tone Register: ${tone}\n`;
    }
    if (documentContext) {
      prompt += `Document Broad Context: "${documentContext}"\n`;
    }
    if (contextHistory && contextHistory.length > 0) {
      prompt += `Conversation/Paragraph Sliding Context Window (previous sentences):\n`;
      contextHistory.forEach((ctx, idx) => {
        prompt += `- Previous sentence ${idx + 1}: "${ctx}"\n`;
      });
    }

    prompt += `\nText to translate: "${text}"\n\n`;
    prompt += `Return ONLY the translated text, preserving formatting and punctuation. Do not include any notes, explanations, or quotes.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const translatedText = response.text || '';

    return {
      translatedText: translatedText.trim(),
      detectedSourceLanguage: request.sourceLang !== 'auto' ? request.sourceLang : undefined,
      model: 'gemini',
      confidence: 0.95,
      latencyMs: Date.now() - start,
      source: 'gemini',
    };
  } catch (error) {
    logger.error('Gemini translation provider error', { error: String(error) });
    return null;
  }
}

export interface SemanticTranslationResult {
  translatedText: string;
  entities: Array<{
    id: string;
    name: string;
    translatedName: string;
    category: 'Person' | 'Place' | 'Organization' | 'Technical Term';
    description: string;
    preservationReason: string;
  }>;
  relationships: Array<{
    source: string;
    target: string;
    type: string;
  }>;
  detectedSourceLanguage?: string;
  model: string;
  confidence: number;
  latencyMs: number;
  source: string;
  isMock?: boolean;
}

export async function translateWithGeminiSemantic(
  request: TranslationRequest
): Promise<SemanticTranslationResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.warn('GEMINI_API_KEY not configured. Skipping Gemini semantic translation.');
    return null;
  }

  const start = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey });

    const { text, sourceLang, targetLang, domain = 'general', tone = 'neutral', documentContext = '' } = request;

    // Load user translation profile if available
    const activeProfile = request.profile || (request.userId ? await getUserProfile(request.userId) : null);
    let personalizationRules = '';
    if (activeProfile) {
      if (activeProfile.style && activeProfile.style !== 'neutral') {
        personalizationRules += `- Preferred Style: Translate in a strictly "${activeProfile.style}" writing style (formal, informal, business, academic, or technical).\n`;
      }
      if (activeProfile.tone && activeProfile.tone !== 'neutral') {
        personalizationRules += `- Preferred Tone: Use a "${activeProfile.tone}" tone register.\n`;
      }
      if (activeProfile.vocabulary && Object.keys(activeProfile.vocabulary).length > 0) {
        personalizationRules += `- Terminology Glossary mappings: Enforce these rules:\n${JSON.stringify(activeProfile.vocabulary)}\n`;
      }
    }

    const prompt = `You are an advanced semantic translation engine.
    Your task is two-fold:
    1. Translate the Source Text from "${sourceLang}" to "${targetLang}" with high accuracy, preserving formatting and punctuation.
    2. Build a Knowledge Graph of the key entities (People, Places, Organizations, Technical Terms) and their relationships mentioned in the text.
    
    ${personalizationRules ? `PERSONALIZED TRANSLATION PREFERENCES:\n${personalizationRules}\n` : ''}
    
    CRITICAL RULE FOR PROPER NOUNS & TERMINOLOGY:
    - Prevent literal/mistranslation of proper nouns (e.g. do not translate personal names like "Gary Brush" or brand names like "Apple" or "Microsoft" literally into target language nouns).
    - Preserves semantic meaning of technical terms (e.g. keep them as standardized technical jargon in the target language).
    
    Source Text: "${text}"
    Subject Domain: ${domain}
    Tone Register: ${tone}
    ${documentContext ? `Context: ${documentContext}` : ''}
    
    Return the response in ONLY a valid JSON object matching this schema:
    {
      "translatedText": "the translated text in ${targetLang}",
      "entities": [
        {
          "id": "e1, e2, etc. (unique identifiers)",
          "name": "entity name in source language",
          "translatedName": "entity name in target language (ensuring proper nouns are preserved and technical terms are accurate)",
          "category": "Person" | "Place" | "Organization" | "Technical Term",
          "description": "brief contextual description of who or what this entity is based on the text",
          "preservationReason": "detailed explanation of why this name was preserved/translated this way to ensure semantic meaning matches across languages"
        }
      ],
      "relationships": [
        {
          "source": "source entity id (e.g. e1)",
          "target": "target entity id (e.g. e2)",
          "type": "the relationship type (e.g. 'founder of', 'located in', 'member of', 'associated with')"
        }
      ]
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const raw = response.text || '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      translatedText: parsed.translatedText || '',
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
      detectedSourceLanguage: sourceLang !== 'auto' ? sourceLang : undefined,
      model: 'gemini',
      confidence: 0.98,
      latencyMs: Date.now() - start,
      source: 'gemini-semantic'
    };
  } catch (error) {
    logger.error('Gemini semantic translation provider error', { error: String(error) });
    return null;
  }
}

