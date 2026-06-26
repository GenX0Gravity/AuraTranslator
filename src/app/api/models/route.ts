import { NextResponse } from 'next/server';
import { listAvailableModels, isMlServiceAvailable } from '@/lib/translation';
import { selectModelForPair } from '@/lib/translation/domains';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const sourceLang = searchParams.get('source') ?? 'en';
  const targetLang = searchParams.get('target') ?? 'hi';
  const domain = searchParams.get('domain') ?? 'general';

  const routing = selectModelForPair(sourceLang, targetLang, {
    domain: domain as 'general',
  });

  const models = await listAvailableModels();
  const modelData = typeof models === 'object' && models !== null ? models : {};

  return NextResponse.json({
    mlServiceAvailable: isMlServiceAvailable(),
    routing,
    ...modelData,
  });
}
