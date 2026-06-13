import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';

const historyWriteSchema = z.object({
  sourceText: z.string().min(1).max(5000),
  translatedText: z.string().min(1).max(10000),
  sourceLang: z.string().min(2).max(10),
  targetLang: z.string().min(2).max(10),
  detectedLang: z.string().min(2).max(10).optional(),
  timestamp: z.number().optional(),
});

function getUserId(session: any): string | null {
  return (session?.user as { id?: string })?.id ?? null;
}

// GET — fetch user's translation history
export async function GET(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`history:${ip}`, RATE_LIMITS.history);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const session = await getServerSession(authOptions);
    const userId = getUserId(session);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getAdminDb();
    const snapshot = await db
      .collection('history')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const history = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toMillis?.() ?? Date.now(),
    }));

    return NextResponse.json(history);
  } catch (error: unknown) {
    logger.error('Error fetching history', { error: String(error) });
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

// POST — save a new history item
export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`history:${ip}`, RATE_LIMITS.history);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const session = await getServerSession(authOptions);
    const userId = getUserId(session);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = historyWriteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request: ' + parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { sourceText, translatedText, sourceLang, targetLang, detectedLang, timestamp } =
      parsed.data;

    const db = getAdminDb();
    const historyRef = db.collection('history');

    // Dedup: check if last item is identical
    const lastSnapshot = await historyRef
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    if (!lastSnapshot.empty) {
      const last = lastSnapshot.docs[0].data();
      if (
        last.sourceText === sourceText &&
        last.translatedText === translatedText &&
        last.sourceLang === sourceLang &&
        last.targetLang === targetLang
      ) {
        return NextResponse.json({
          message: 'Duplicate skipped',
          item: { id: lastSnapshot.docs[0].id, ...last, timestamp: last.timestamp?.toMillis?.() },
        });
      }
    }

    // Enforce cap: delete oldest if > 50
    const countSnapshot = await historyRef.where('userId', '==', userId).count().get();
    const count = countSnapshot.data().count;
    if (count >= 50) {
      const oldestSnapshot = await historyRef
        .where('userId', '==', userId)
        .orderBy('timestamp', 'asc')
        .limit(count - 49)
        .get();
      const batch = db.batch();
      oldestSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    // Write new item
    const newDoc = await historyRef.add({
      userId,
      sourceText,
      translatedText,
      sourceLang,
      targetLang,
      detectedLang: detectedLang ?? null,
      timestamp: timestamp ? Timestamp.fromMillis(timestamp) : Timestamp.now(),
    });

    const newSnap = await newDoc.get();
    const newData = newSnap.data()!;

    return NextResponse.json(
      {
        message: 'History added',
        item: {
          id: newDoc.id,
          ...newData,
          timestamp: newData.timestamp?.toMillis?.() ?? Date.now(),
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error('Error adding history', { error: String(error) });
    return NextResponse.json({ error: 'Failed to save history' }, { status: 500 });
  }
}

// DELETE — clear all user history
export async function DELETE(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`history:${ip}`, RATE_LIMITS.history);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const session = await getServerSession(authOptions);
    const userId = getUserId(session);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getAdminDb();
    const snapshot = await db.collection('history').where('userId', '==', userId).get();
    const batchOps = db.batch();
    snapshot.docs.forEach((doc) => batchOps.delete(doc.ref));
    await batchOps.commit();

    return NextResponse.json({ message: 'History cleared' });
  } catch (error: unknown) {
    logger.error('Error clearing history', { error: String(error) });
    return NextResponse.json({ error: 'Failed to clear history' }, { status: 500 });
  }
}
