import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';

const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().min(1, 'Name is required').max(100).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(`auth:${ip}`, RATE_LIMITS.auth);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { email, password, name } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const db = getAdminDb();
    const existing = await db
      .collection('users')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await db.collection('users').add({
      email: normalizedEmail,
      password: hashedPassword,
      name: name ?? '',
      authProvider: 'credentials',
      createdAt: Timestamp.now(),
    });

    logger.info('New user registered', { userId: newUser.id });

    return NextResponse.json(
      { message: 'Account created successfully', userId: newUser.id },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error('Registration error', { error: String(error) });
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}
