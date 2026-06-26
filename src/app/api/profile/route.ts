import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { getUserProfile, saveUserProfile } from '@/lib/translation/profile';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const profileUpdateSchema = z.object({
  style: z.enum(['neutral', 'formal', 'informal', 'business', 'academic', 'technical']).optional(),
  tone: z.enum(['neutral', 'formal', 'casual']).optional(),
  vocabulary: z.record(z.string(), z.string()).optional(),
  autoLearnEnabled: z.boolean().optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`profile-get:${ip}`, RATE_LIMITS.translate);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? (session.user as { id?: string }).id : undefined;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    let profile = await getUserProfile(userId);
    if (!profile) {
      // Create and save a default profile
      const defaultProfile = {
        userId,
        style: 'neutral' as const,
        tone: 'neutral' as const,
        vocabulary: {},
        frequentWords: [],
        autoLearnEnabled: true,
      };
      await saveUserProfile(userId, defaultProfile);
      profile = defaultProfile;
    }

    return NextResponse.json(profile);
  } catch (error) {
    logger.error('Error fetching user profile', { error: String(error) });
    return NextResponse.json({ error: 'Failed to retrieve profile settings.' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`profile-post:${ip}`, RATE_LIMITS.translate);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? (session.user as { id?: string }).id : undefined;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = profileUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid profile data: ' + parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    await saveUserProfile(userId, parsed.data);
    return NextResponse.json({ success: true, message: 'Translation profile updated successfully.' });
  } catch (error) {
    logger.error('Error updating user profile', { error: String(error) });
    return NextResponse.json({ error: 'Failed to save profile settings.' }, { status: 500 });
  }
}
