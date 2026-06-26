import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { GoogleGenAI } from '@google/genai';

export interface UserTranslationProfile {
  userId: string;
  style: 'neutral' | 'formal' | 'informal' | 'business' | 'academic' | 'technical';
  tone: 'neutral' | 'formal' | 'casual';
  vocabulary: Record<string, string>;
  frequentWords: Array<{ source: string; target: string; count: number }>;
  autoLearnEnabled: boolean;
}

export async function getUserProfile(userId: string): Promise<UserTranslationProfile | null> {
  try {
    const db = getAdminDb();
    const doc = await db.collection('translation_profiles').doc(userId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as UserTranslationProfile;
  } catch (err) {
    logger.warn('Failed to retrieve user translation profile', { userId, error: String(err) });
    return null;
  }
}

export async function saveUserProfile(userId: string, profile: Partial<UserTranslationProfile>): Promise<void> {
  try {
    const db = getAdminDb();
    await db.collection('translation_profiles').doc(userId).set(profile, { merge: true });
  } catch (err) {
    logger.error('Failed to save user translation profile', { userId, error: String(err) });
  }
}

export async function autoLearnUserProfile(userId: string, apiKey: string): Promise<UserTranslationProfile | null> {
  try {
    const db = getAdminDb();
    
    // 1. Fetch past 20 translation memory items
    const tmSnapshot = await db.collection('translation_memory')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
      
    // 2. Fetch past 20 translation corrections
    const corrSnapshot = await db.collection('translation_corrections')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const translations = tmSnapshot.docs.map(doc => {
      const data = doc.data();
      return { source: data.sourceText, target: data.translatedText };
    });

    const corrections = corrSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        source: data.sourceText,
        predicted: data.predictedTranslation,
        corrected: data.correctedTranslation
      };
    });

    if (translations.length === 0 && corrections.length === 0) {
      logger.info('No translation history or corrections found to learn from', { userId });
      return null;
    }

    // 3. Prompt Gemini to analyze writing style and vocabulary mappings
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are an advanced linguistic classifier. We have gathered a user's translation history and correction logs in AuraTranslator.
    Your task is to analyze these logs to automatically calibrate a Personalized Translation Profile:
    
    1. Determine their dominant writing style preference (neutral, formal, informal, business, academic, or technical).
    2. Determine their preferred writing tone (neutral, formal, or casual).
    3. Extract custom vocabulary mapping rules (any specific words or jargon they consistently use or corrected, especially in the corrections list).
    4. Compile their top frequently translated word/phrase pairs.
    
    Logs:
    Recent Translations:
    ${JSON.stringify(translations, null, 2)}
    
    Recent Corrections:
    ${JSON.stringify(corrections, null, 2)}
    
    Return the response in ONLY a valid JSON object matching this schema:
    {
      "style": "neutral" | "formal" | "informal" | "business" | "academic" | "technical",
      "tone": "neutral" | "formal" | "casual",
      "vocabulary": {
        "source_word_or_phrase": "target_preferred_translation"
      },
      "frequentWords": [
        {
          "source": "source word/phrase",
          "target": "target word/phrase",
          "count": number
        }
      ]
    }`;

    logger.info('Sending profile learning request to Gemini', { userId });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    
    const learnedProfile: Partial<UserTranslationProfile> = {
      style: parsed.style || 'neutral',
      tone: parsed.tone || 'neutral',
      vocabulary: parsed.vocabulary || {},
      frequentWords: parsed.frequentWords || [],
      autoLearnEnabled: true
    };

    // 4. Save learned profile back to Firestore
    await saveUserProfile(userId, learnedProfile);
    logger.info('Auto-learned user translation profile successfully updated', { userId });

    return {
      userId,
      style: learnedProfile.style!,
      tone: learnedProfile.tone!,
      vocabulary: learnedProfile.vocabulary!,
      frequentWords: learnedProfile.frequentWords!,
      autoLearnEnabled: true
    };

  } catch (error) {
    logger.error('Failed to auto-learn user translation profile', { userId, error: String(error) });
    return null;
  }
}

// Utility to apply vocabulary overrides (glossary) post-translation
export function applyVocabularyGlossary(text: string, vocabulary: Record<string, string>): string {
  if (!text || !vocabulary || Object.keys(vocabulary).length === 0) return text;
  
  let modifiedText = text;
  
  // Sort vocabulary keys by length descending to replace longer phrases first (avoids sub-string collision)
  const sortedKeys = Object.keys(vocabulary).sort((a, b) => b.length - a.length);
  
  for (const key of sortedKeys) {
    const target = vocabulary[key];
    if (!target) continue;
    
    try {
      // Escape special regex chars
      const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      
      // If it's a word-character phrase, replace with word boundary checks (\b) to avoid replacing subparts of larger words
      // Note: for character-based scripts like Chinese/Japanese, \b doesn't apply, so we replace directly
      const hasWordBoundaries = /^[a-zA-Z0-9_\u00C0-\u017F]+$/.test(key);
      const regex = hasWordBoundaries 
        ? new RegExp(`\\b${escapedKey}\\b`, 'gi')
        : new RegExp(escapedKey, 'gi');
        
      modifiedText = modifiedText.replace(regex, (match) => {
        // Try to match case style (Capitalized, UPPERCASE, lowercase)
        if (match === match.toUpperCase() && match.length > 1) {
          return target.toUpperCase();
        }
        if (match[0] === match[0].toUpperCase()) {
          return target[0].toUpperCase() + target.slice(1);
        }
        return target;
      });
    } catch (e) {
      // Fallback: simple string split-join
      modifiedText = modifiedText.split(key).join(target);
    }
  }
  
  return modifiedText;
}

export interface GlossaryMapping {
  placeholder: string;
  target: string;
}

export function preProcessGlossary(text: string, vocabulary: Record<string, string>): { text: string; mappings: GlossaryMapping[] } {
  if (!text || !vocabulary || Object.keys(vocabulary).length === 0) {
    return { text, mappings: [] };
  }
  
  let processedText = text;
  const mappings: GlossaryMapping[] = [];
  
  // Sort vocabulary keys by length descending to replace longer phrases first (avoids sub-string collision)
  const sortedKeys = Object.keys(vocabulary).sort((a, b) => b.length - a.length);
  
  let placeholderCounter = 0;
  
  for (const key of sortedKeys) {
    const target = vocabulary[key];
    if (!target) continue;
    
    try {
      // Escape special regex chars
      const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      
      const hasWordBoundaries = /^[a-zA-Z0-9_\u00C0-\u017F]+$/.test(key);
      const regex = hasWordBoundaries 
        ? new RegExp(`\\b${escapedKey}\\b`, 'gi')
        : new RegExp(escapedKey, 'gi');
        
      processedText = processedText.replace(regex, () => {
        const placeholder = `__GLOS_${placeholderCounter}__`;
        placeholderCounter++;
        mappings.push({ placeholder, target });
        return placeholder;
      });
    } catch (e) {
      const placeholder = `__GLOS_${placeholderCounter}__`;
      placeholderCounter++;
      if (processedText.includes(key)) {
        processedText = processedText.split(key).join(placeholder);
        mappings.push({ placeholder, target });
      }
    }
  }
  
  return { text: processedText, mappings };
}

export function postProcessGlossary(text: string, mappings: GlossaryMapping[]): string {
  if (!text || !mappings || mappings.length === 0) return text;
  
  let processedText = text;
  
  for (const mapping of mappings) {
    try {
      const regex = new RegExp(mapping.placeholder, 'gi');
      processedText = processedText.replace(regex, mapping.target);
    } catch (e) {
      processedText = processedText.split(mapping.placeholder).join(mapping.target);
    }
  }
  
  return processedText;
}

