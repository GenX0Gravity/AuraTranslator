import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Add request ID for distributed tracing
  const requestId = crypto.randomUUID();
  response.headers.set('x-request-id', requestId);

  // Structured logging for all API requests (Cloud Logging compatible)
  if (pathname.startsWith('/api/')) {
    const method = request.method;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    console.log(
      JSON.stringify({
        severity: 'INFO',
        message: `API Request: ${method} ${pathname}`,
        requestId,
        ip,
        userAgent: request.headers.get('user-agent')?.substring(0, 100),
        timestamp: new Date().toISOString(),
      })
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
