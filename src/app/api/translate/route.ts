import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { hybridTranslate } from '@/lib/translation/router';
import { translateWithGeminiSemantic } from '@/lib/translation/providers/gemini';
import type { TranslationDomain, TranslationTone } from '@/lib/translation/types';
import { z } from 'zod';

const translateSchema = z.object({
  text: z.string().min(1).max(5000),
  sourceLang: z.string().min(2).max(10),
  targetLang: z.string().min(2).max(10),
  workspaceId: z.string().optional(),
  domain: z
    .enum([
      'general',
      'medical',
      'legal',
      'education',
      'finance',
      'technology',
      'engineering',
      'software_development',
      'government',
      'academic_research',
      'auto',
    ])
    .optional(),
  tone: z.enum(['formal', 'casual', 'neutral']).optional(),
  lightweight: z.boolean().optional(),
  contextHistory: z.array(z.string()).optional(),
  documentContext: z.string().optional(),
  semantic: z.boolean().optional(),
  profile: z.object({
    style: z.enum(['neutral', 'formal', 'informal', 'business', 'academic', 'technical']).optional(),
    tone: z.enum(['neutral', 'formal', 'casual']).optional(),
    vocabulary: z.record(z.string(), z.string()).optional(),
  }).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`translate:${ip}`, RATE_LIMITS.translate);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  try {
    const body = await request.json();
    const parsed = translateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request: ' + parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const {
      text,
      sourceLang,
      targetLang,
      workspaceId,
      domain,
      tone,
      lightweight,
      contextHistory,
      documentContext,
      semantic,
      profile,
    } = parsed.data;

    const session = await getServerSession(authOptions);
    const userId = session?.user ? (session.user as { id?: string }).id : undefined;

    if (semantic) {
      const semResult = await translateWithGeminiSemantic({
        text,
        sourceLang,
        targetLang,
        workspaceId,
        domain: (domain ?? 'general') as TranslationDomain | 'auto',
        tone: (tone ?? 'neutral') as TranslationTone,
        lightweight,
        userId,
        contextHistory,
        documentContext,
        profile
      });

      if (semResult) {
        return NextResponse.json({
          translatedText: semResult.translatedText,
          detectedSourceLanguage: semResult.detectedSourceLanguage,
          isCached: false,
          isMock: false,
          source: semResult.source,
          model: semResult.model,
          confidence: semResult.confidence,
          latencyMs: semResult.latencyMs,
          entities: semResult.entities,
          relationships: semResult.relationships
        });
      } else {
        const mockEntities = [
          {
            id: 'e1',
            name: text.split(' ')[0] || 'Entity',
            translatedName: text.split(' ')[0] || 'Entidad',
            category: 'Person',
            description: 'Recognized named proper noun from the source text.',
            preservationReason: 'Preserved literally as a proper noun to prevent translation errors.'
          }
        ];
        return NextResponse.json({
          translatedText: `[Mock Semantic Translation] ${text} → ${targetLang}`,
          detectedSourceLanguage: sourceLang !== 'auto' ? sourceLang : 'en',
          isCached: false,
          isMock: true,
          source: 'mock-semantic',
          model: 'mock',
          confidence: 0.5,
          latencyMs: 50,
          entities: mockEntities,
          relationships: []
        });
      }
    }

    const result = await hybridTranslate(
      {
        text,
        sourceLang,
        targetLang,
        workspaceId,
        domain: (domain ?? 'general') as TranslationDomain | 'auto',
        tone: (tone ?? 'neutral') as TranslationTone,
        lightweight,
        userId,
        contextHistory,
        documentContext,
        profile,
      },
      { userId }
    );

    return NextResponse.json({
      translatedText: result.translatedText,
      detectedSourceLanguage: result.detectedSourceLanguage,
      isCached: result.isCached ?? false,
      isMock: result.isMock ?? false,
      source: result.source,
      model: result.model,
      confidence: result.confidence,
      latencyMs: result.latencyMs,
      routingReason: result.metadata?.routingReason,
      detectedDomain: result.metadata?.detectedDomain,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Translation failed';
    logger.error('Translation backend error', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
