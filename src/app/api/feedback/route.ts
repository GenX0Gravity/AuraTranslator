import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { storeCorrection, storeTranslationMemory } from '@/lib/translation/providers/translation-memory';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const feedbackSchema = z.object({
  sourceText: z.string().min(1).max(5000),
  predictedTranslation: z.string().min(1).max(10000),
  correctedTranslation: z.string().max(10000).optional(),
  rating: z.number().min(1).max(5).optional(),
  sourceLang: z.string().min(2).max(10),
  targetLang: z.string().min(2).max(10),
  model: z.string().optional(),
  domain: z.string().optional(),
  workspaceId: z.string().optional(),
  saveToMemory: z.boolean().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`feedback:${ip}`, RATE_LIMITS.score);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user ? (session.user as { id?: string }).id : undefined;
    const data = parsed.data;

    const correctionId = await storeCorrection(userId, {
      sourceText: data.sourceText,
      predictedTranslation: data.predictedTranslation,
      correctedTranslation: data.correctedTranslation ?? data.predictedTranslation,
      sourceLang: data.sourceLang,
      targetLang: data.targetLang,
      model: data.model ?? 'unknown',
      domain: data.domain,
      rating: data.rating,
      workspaceId: data.workspaceId,
    });

    if (data.saveToMemory && userId && data.correctedTranslation) {
      await storeTranslationMemory(userId, {
        sourceText: data.sourceText,
        translatedText: data.correctedTranslation,
        sourceLang: data.sourceLang,
        targetLang: data.targetLang,
        workspaceId: data.workspaceId,
        model: data.model,
      });
    }

    return NextResponse.json({
      success: true,
      correctionId,
      message: 'Feedback recorded for continuous learning',
    });
  } catch (error: unknown) {
    logger.error('Feedback error', { error: String(error) });
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }
}
