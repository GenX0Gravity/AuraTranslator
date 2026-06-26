import { createHash } from 'crypto';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import type { TranslationRequest, TranslationResult } from '../types';
import { ML_SERVICE_URL } from './ml-service';

function computeEntryId(sourceLang: string, targetLang: string, text: string): string {
  const key = `${sourceLang}:${targetLang}:${text.trim().toLowerCase()}`;
  return createHash('sha256').update(key).digest('hex');
}

async function lookupFirestoreTranslationMemory(
  request: TranslationRequest,
  userId?: string
): Promise<TranslationResult | null> {
  if (!userId) return null;

  const trimmed = request.text.trim();

  try {
    const db = getAdminDb();
    const tmRef = db.collection('translation_memory');
    const tmQuery = request.workspaceId
      ? tmRef
          .where('workspaceId', '==', request.workspaceId)
          .where('sourceLang', '==', request.sourceLang)
          .where('targetLang', '==', request.targetLang)
          .where('sourceText', '==', trimmed)
          .limit(1)
      : tmRef
          .where('userId', '==', userId)
          .where('sourceLang', '==', request.sourceLang)
          .where('targetLang', '==', request.targetLang)
          .where('sourceText', '==', trimmed)
          .limit(1);

    const snapshot = await tmQuery.get();
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0].data();
    return {
      translatedText: doc.translatedText,
      detectedSourceLanguage: request.sourceLang !== 'auto' ? request.sourceLang : undefined,
      model: 'translation-memory',
      confidence: 0.98,
      latencyMs: 5,
      isCached: true,
      source: 'translation_memory',
    };
  } catch (err) {
    logger.warn('Firestore translation memory lookup failed', { error: String(err) });
    return null;
  }
}

export async function lookupTranslationMemory(
  request: TranslationRequest,
  userId?: string
): Promise<TranslationResult | null> {
  if (!ML_SERVICE_URL) {
    return lookupFirestoreTranslationMemory(request, userId);
  }

  const trimmed = request.text.trim();

  try {
    const res = await fetch(`${ML_SERVICE_URL.replace(/\/$/, '')}/tm/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: trimmed,
        source_lang: request.sourceLang,
        target_lang: request.targetLang,
        domain: request.domain || 'general',
        threshold: 0.85,
        limit: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Semantic search returned status ${res.status}`);
    }

    const data = await res.json();
    const matches = data.matches || [];
    if (matches.length === 0) {
      // Fallback to Firestore exact matching
      return lookupFirestoreTranslationMemory(request, userId);
    }

    const bestMatch = matches[0];
    return {
      translatedText: bestMatch.target_translation,
      detectedSourceLanguage: request.sourceLang !== 'auto' ? request.sourceLang : undefined,
      model: 'translation-memory',
      confidence: bestMatch.similarity,
      latencyMs: 5,
      isCached: true,
      source: 'translation_memory',
    };
  } catch (err) {
    logger.warn('Semantic translation memory lookup failed, falling back to Firestore', { error: String(err) });
    return lookupFirestoreTranslationMemory(request, userId);
  }
}

export async function storeTranslationMemory(
  userId: string,
  data: {
    sourceText: string;
    translatedText: string;
    sourceLang: string;
    targetLang: string;
    workspaceId?: string;
    model?: string;
    domain?: string;
  }
): Promise<void> {
  // 1. Save to Firestore
  try {
    const db = getAdminDb();
    await db.collection('translation_memory').add({
      userId,
      ...data,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('Failed to store translation memory in Firestore', { error: String(err) });
  }

  // 2. Save to Semantic TM
  if (ML_SERVICE_URL) {
    try {
      await fetch(`${ML_SERVICE_URL.replace(/\/$/, '')}/tm/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_text: data.sourceText,
          target_translation: data.translatedText,
          source_lang: data.sourceLang,
          target_lang: data.targetLang,
          domain: data.domain || 'general',
          rating: 5.0,
          corrections: [],
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      logger.warn('Failed to store semantic translation memory', { error: String(err) });
    }
  }
}

export async function storeCorrection(
  userId: string | undefined,
  data: {
    sourceText: string;
    predictedTranslation: string;
    correctedTranslation: string;
    sourceLang: string;
    targetLang: string;
    model: string;
    domain?: string;
    rating?: number;
    workspaceId?: string;
  }
): Promise<string | null> {
  // 1. Save to Firestore
  let docId: string | null = null;
  try {
    const db = getAdminDb();
    const docRef = await db.collection('translation_corrections').add({
      userId: userId ?? 'anonymous',
      ...data,
      createdAt: new Date().toISOString(),
      usedForTraining: false,
    });
    docId = docRef.id;
  } catch (err) {
    logger.warn('Failed to store correction in Firestore', { error: String(err) });
  }

  // 2. Update Semantic TM
  if (ML_SERVICE_URL) {
    try {
      const entryId = computeEntryId(data.sourceLang, data.targetLang, data.sourceText);
      const updateBody: any = { entry_id: entryId };
      if (data.rating !== undefined) {
        updateBody.rating = data.rating;
      }
      if (data.correctedTranslation !== undefined && data.correctedTranslation.trim()) {
        updateBody.correction = data.correctedTranslation;
      }

      const res = await fetch(`${ML_SERVICE_URL.replace(/\/$/, '')}/tm/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
        signal: AbortSignal.timeout(5000),
      });

      // If entry does not exist, add it as a new entry
      if (res.status === 404) {
        await fetch(`${ML_SERVICE_URL.replace(/\/$/, '')}/tm/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_text: data.sourceText,
            target_translation: data.correctedTranslation || data.predictedTranslation,
            source_lang: data.sourceLang,
            target_lang: data.targetLang,
            domain: data.domain || 'general',
            rating: data.rating !== undefined ? data.rating : 5.0,
            corrections: data.correctedTranslation ? [data.correctedTranslation] : [],
          }),
          signal: AbortSignal.timeout(5000),
        });
      }
    } catch (err) {
      logger.warn('Failed to update semantic translation memory', { error: String(err) });
    }
  }

  return docId;
}
