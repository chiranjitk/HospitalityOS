/**
 * M-62: Housekeeping API Rate Limiting Helper
 *
 * Provides user-based rate limiting for housekeeping endpoints.
 * Uses the existing DB-persisted rateLimiter from @/lib/rate-limiter.
 *
 * Usage:
 *   import { applyHousekeepingRateLimit } from '@/app/api/housekeeping/rate-limit';
 *   const result = await applyHousekeepingRateLimit(request, 'dashboard');
 *   if (!result.allowed) return NextResponse.json({ error: ... }, { status: 429 });
 */

import { rateLimit } from '@/lib/rate-limiter';
import { NextRequest, NextResponse } from 'next/server';

interface RateLimitResult {
  allowed: boolean;
  retryAfter: number | null;
}

// Rate limit configuration per endpoint type
const HK_RATE_LIMITS: Record<string, { maxAttempts: number; windowMs: number; keyPrefix: string }> = {
  // Read endpoints — higher limits
  dashboard:    { maxAttempts: 120, windowMs: 60 * 1000, keyPrefix: 'hk:dashboard' },
  workload_get: { maxAttempts: 120, windowMs: 60 * 1000, keyPrefix: 'hk:workload' },
  optimization_get: { maxAttempts: 60, windowMs: 60 * 1000, keyPrefix: 'hk:optim' },
  routes_get:   { maxAttempts: 120, windowMs: 60 * 1000, keyPrefix: 'hk:routes' },
  // Write endpoints — lower limits (heavy computation)
  optimization_post: { maxAttempts: 20, windowMs: 60 * 1000, keyPrefix: 'hk:optim' },
  optimization_put:  { maxAttempts: 20, windowMs: 60 * 1000, keyPrefix: 'hk:optim' },
  workload_post: { maxAttempts: 20, windowMs: 60 * 1000, keyPrefix: 'hk:workload' },
  workload_put:  { maxAttempts: 20, windowMs: 60 * 1000, keyPrefix: 'hk:workload' },
  routes_post:   { maxAttempts: 20, windowMs: 60 * 1000, keyPrefix: 'hk:routes' },
  // Inspections
  inspection_get:  { maxAttempts: 120, windowMs: 60 * 1000, keyPrefix: 'hk:inspect' },
  inspection_post: { maxAttempts: 30, windowMs: 60 * 1000, keyPrefix: 'hk:inspect' },
};

const DEFAULT_LIMIT = { maxAttempts: 60, windowMs: 60 * 1000, keyPrefix: 'hk:default' };

/**
 * Apply rate limiting for a housekeeping endpoint.
 *
 * @param request - The incoming NextRequest (used to extract user ID from session)
 * @param action - The endpoint action type
 * @returns { allowed: boolean, retryAfter: number | null }
 */
export async function applyHousekeepingRateLimit(
  request: NextRequest,
  action: string,
): Promise<RateLimitResult> {
  const config = HK_RATE_LIMITS[action] || DEFAULT_LIMIT;

  // Build a unique key combining the action with the full forwarded-for IP
  // This provides IP-based isolation even when tenants share a server
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const rateLimitKey = `${config.keyPrefix}:${clientIp}`;

  const result = await rateLimit(rateLimitKey, config.maxAttempts, config.windowMs);

  if (!result.allowed) {
    return { allowed: false, retryAfter: result.retryAfter };
  }

  return { allowed: true, retryAfter: null };
}

/**
 * Helper to return a standard 429 response.
 */
export function rateLimitResponse(retryAfter: number | null): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please slow down.',
      },
    },
    {
      status: 429,
      headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined,
    },
  );
}
