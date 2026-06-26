import { NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { benchmarkModels, listAvailableModels } from '@/lib/translation';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const benchmarkSchema = z.object({
  sourceLang: z.string().min(2).max(10),
  targetLang: z.string().min(2).max(10),
  samples: z.array(z.string().min(1).max(500)).min(1).max(20),
  reference: z.array(z.string()).optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const models = await listAvailableModels();
    return NextResponse.json(models);
  } catch (error) {
    logger.error('Models list error', { error: String(error) });
    return NextResponse.json({ error: 'Failed to list models' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`benchmark:${ip}`, RATE_LIMITS.score);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = benchmarkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { sourceLang, targetLang, samples } = parsed.data;
    const results = await benchmarkModels(sourceLang, targetLang, samples);
    return NextResponse.json(results);
  } catch (error) {
    logger.error('Benchmark error', { error: String(error) });
    return NextResponse.json({ error: 'Benchmark failed' }, { status: 500 });
  }
}
