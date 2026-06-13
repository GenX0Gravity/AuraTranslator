import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';

const favWriteSchema = z.object({
  word: z.string().min(1).max(200),
  translation: z.string().min(1).max(1000),
  language: z.string().min(2).max(10),
  timestamp: z.number().optional(),
});

function getUserId(session: any): string | null {
  return (session?.user as { id?: string })?.id ?? null;
}

export async function GET(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`favorites:${ip}`, RATE_LIMITS.default);
  if (!rateCheck.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const session = await getServerSession(authOptions);
    const userId = getUserId(session);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getAdminDb();
    const snapshot = await db
      .collection('favorites')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .get();

    const favorites = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toMillis?.() ?? Date.now(),
    }));

    return NextResponse.json(favorites);
  } catch (error: unknown) {
    logger.error('Error fetching favorites', { error: String(error) });
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(`favorites:${ip}`, RATE_LIMITS.default);
  if (!rateCheck.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const session = await getServerSession(authOptions);
    const userId = getUserId(session);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const parsed = favWriteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { word, translation, language, timestamp } = parsed.data;
    const normalizedWord = word.toLowerCase().trim();

    const db = getAdminDb();
    const existing = await db
      .collection('favorites')
      .where('userId', '==', userId)
      .where('word', '==', normalizedWord)
      .where('language', '==', language)
      .limit(1)
      .get();

    if (!existing.empty) {
      const doc = existing.docs[0];
      return NextResponse.json({ message: 'Already in favorites', item: { id: doc.id, ...doc.data() } });
    }

    const newFav = await db.collection('favorites').add({
      userId,
      word: normalizedWord,
      translation,
      language,
      timestamp: timestamp ? Timestamp.fromMillis(timestamp) : Timestamp.now(),
    });

    const snap = await newFav.get();
    return NextResponse.json({ message: 'Favorite added', item: { id: newFav.id, ...snap.data() } }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Error adding favorite', { error: String(error) });
    return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 });
  }
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(`favorites:${ip}`, RATE_LIMITS.default);
  if (!rateCheck.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const session = await getServerSession(authOptions);
    const userId = getUserId(session);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const word = searchParams.get('word');
    const language = searchParams.get('language');

    if (!word || !language) {
      return NextResponse.json({ error: 'Missing word or language parameter' }, { status: 400 });
    }

    const db = getAdminDb();
    const snapshot = await db
      .collection('favorites')
      .where('userId', '==', userId)
      .where('word', '==', word.toLowerCase())
      .where('language', '==', language)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.delete();
    }

    return NextResponse.json({ message: 'Favorite removed' });
  } catch (error: unknown) {
    logger.error('Error removing favorite', { error: String(error) });
    return NextResponse.json({ error: 'Failed to remove favorite' }, { status: 500 });
  }
}
