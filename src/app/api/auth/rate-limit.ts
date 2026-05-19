/**
 * SEC-001: Centralized Auth Rate Limiting Helper
 *
 * Provides IP-based rate limiting for all auth-sensitive endpoints.
 * Uses the existing DB-persisted rateLimiter from @/lib/rate-limiter
 * with appropriate limits per action type.
 *
 * Usage:
 *   import { applyAuthRateLimit } from '@/app/api/auth/rate-limit';
 *   const result = await applyAuthRateLimit(request, 'password_reset');
 *   if (!result.allowed) return NextResponse.json({ error: ... }, { status: 429 });
 */

import { rateLimit } from '@/lib/rate-limiter';
import { NextRequest } from 'next/server';

interface AuthRateLimitResult {
  allowed: boolean;
  retryAfter: number | null; // seconds
}

// Rate limit configuration per action type
const AUTH_RATE_LIMITS: Record<string, { maxAttempts: number; windowMs: number; keyPrefix: string }> = {
  login:             { maxAttempts: 10, windowMs: 15 * 60 * 1000, keyPrefix: 'auth:login' },
  password_reset:    { maxAttempts: 5,  windowMs: 15 * 60 * 1000, keyPrefix: 'auth:pwreset' },
  forgot_password:   { maxAttempts: 5,  windowMs: 15 * 60 * 1000, keyPrefix: 'auth:forgotpw' },
  two_factor:        { maxAttempts: 10, windowMs: 15 * 60 * 1000, keyPrefix: 'auth:2fa' },
  signup:            { maxAttempts: 5,  windowMs: 60 * 60 * 1000, keyPrefix: 'auth:signup' },
  email_verification:{ maxAttempts: 5,  windowMs: 60 * 60 * 1000, keyPrefix: 'auth:emailverify' },
  sso:               { maxAttempts: 10, windowMs: 15 * 60 * 1000, keyPrefix: 'auth:sso' },
};

const DEFAULT_LIMIT = { maxAttempts: 10, windowMs: 15 * 60 * 1000, keyPrefix: 'auth:default' };

/**
 * Extract client IP from request headers.
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Apply IP-based rate limiting for auth-sensitive endpoints.
 *
 * @param request - The incoming NextRequest (used to extract client IP)
 * @param action - The auth action type (e.g., 'password_reset', 'forgot_password', 'two_factor', 'signup')
 * @returns { allowed: boolean, retryAfter: number | null }
 */
export async function applyAuthRateLimit(
  request: NextRequest,
  action: string,
): Promise<AuthRateLimitResult> {
  const clientIp = getClientIp(request);
  const config = AUTH_RATE_LIMITS[action] || DEFAULT_LIMIT;
  const rateLimitKey = `${config.keyPrefix}:${clientIp}`;

  const result = await rateLimit(rateLimitKey, config.maxAttempts, config.windowMs);

  return {
    allowed: result.allowed,
    retryAfter: result.retryAfter,
  };
}
