import { NextResponse } from 'next/server';

// Health check endpoint for Cloud Run and Docker HEALTHCHECK
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'AuraTranslator',
      version: process.env.npm_package_version ?? '1.0.0',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
