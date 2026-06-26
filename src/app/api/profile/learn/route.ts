import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { autoLearnUserProfile } from '@/lib/translation/profile';
import { logger } from '@/lib/logger';

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`profile-learn:${ip}`, RATE_LIMITS.translate);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? (session.user as { id?: string }).id : undefined;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const learned = await autoLearnUserProfile(userId, apiKey);
    if (!learned) {
      return NextResponse.json({ 
        success: false, 
        error: 'Could not calibrate profile. Make sure you have translated some texts or made corrections first.' 
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      message: 'AI profile calibration complete!',
      profile: learned
    });
  } catch (error) {
    logger.error('Error in profile learning endpoint', { error: String(error) });
    return NextResponse.json({ error: 'Failed to run AI profile learning.' }, { status: 500 });
  }
}
