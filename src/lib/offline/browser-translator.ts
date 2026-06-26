/**
 * Browser-based offline translation using IndexedDB cache.
 * Full WASM/transformers.js integration can be enabled when models are downloaded.
 */

import { get, set } from 'idb-keyval';

export interface OfflineTranslationResult {
  translatedText: string;
  fromCache: boolean;
}

const HISTORY_KEY = 'auratranslator-offline-history';

export async function getOfflineTranslation(
  sourceLang: string,
  targetLang: string,
  text: string
): Promise<OfflineTranslationResult | null> {
  const cacheKey = `translation_${sourceLang}_${targetLang}_${text.trim()}`;
  const cached = await get(cacheKey);
  if (cached?.translatedText) {
    return { translatedText: cached.translatedText, fromCache: true };
  }
  return null;
}

export async function saveOfflineTranslation(
  sourceLang: string,
  targetLang: string,
  sourceText: string,
  translatedText: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const cacheKey = `translation_${sourceLang}_${targetLang}_${sourceText.trim()}`;
  await set(cacheKey, { translatedText, ...metadata, savedAt: Date.now() });

  const history = ((await get(HISTORY_KEY)) as Array<Record<string, unknown>>) ?? [];
  history.unshift({
    sourceText,
    translatedText,
    sourceLang,
    targetLang,
    timestamp: Date.now(),
  });
  await set(HISTORY_KEY, history.slice(0, 200));
}

export async function getOfflineHistory(): Promise<Array<Record<string, unknown>>> {
  return ((await get(HISTORY_KEY)) as Array<Record<string, unknown>>) ?? [];
}

export async function isOfflineModeEnabled(): Promise<boolean> {
  return Boolean(await get('auratranslator-offline-enabled'));
}
