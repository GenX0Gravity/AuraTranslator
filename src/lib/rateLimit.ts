/**
 * In-memory rate limiter using token bucket algorithm.
 * Suitable for single-instance Cloud Run deployments.
 * For multi-instance, upgrade to Redis (Upstash / Cloud Memorystore).
 */

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

const buckets = new Map<string, TokenBucket>();

// Cleanup old entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (now - bucket.lastRefill > 60000) {
        buckets.delete(key);
      }
    }
  }, 300000);
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let bucket = buckets.get(identifier);

  if (!bucket) {
    bucket = { tokens: config.maxRequests, lastRefill: now };
    buckets.set(identifier, bucket);
  }

  // Refill tokens based on time elapsed
  const elapsed = now - bucket.lastRefill;
  const refillAmount = (elapsed / config.windowMs) * config.maxRequests;
  bucket.tokens = Math.min(config.maxRequests, bucket.tokens + refillAmount);
  bucket.lastRefill = now;

  const resetAt = now + config.windowMs;

  if (bucket.tokens < 1) {
    return { allowed: false, remaining: 0, resetAt };
  }

  bucket.tokens -= 1;
  return { allowed: true, remaining: Math.floor(bucket.tokens), resetAt };
}

/** Pre-configured rate limit configs for different endpoints */
export const RATE_LIMITS = {
  translate: { maxRequests: 60, windowMs: 60_000 },    // 60/min
  score: { maxRequests: 10, windowMs: 60_000 },          // 10/min
  extract: { maxRequests: 20, windowMs: 60_000 },        // 20/min
  history: { maxRequests: 120, windowMs: 60_000 },       // 120/min
  auth: { maxRequests: 10, windowMs: 900_000 },          // 10 per 15 min (brute force protect)
  default: { maxRequests: 100, windowMs: 60_000 },       // 100/min
} as const;

/** Gets a client IP from the request headers */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') ?? '127.0.0.1';
}
