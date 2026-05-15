/**
 * API Rate Limit Middleware Helper
 *
 * Reusable rate limiting wrapper for API routes.
 * Supports per-user, per-tenant, and per-endpoint rate limiting.
 */

import { NextRequest } from 'next/server';
import { rateLimit, RateLimitResult } from '@/lib/rate-limiter';

interface ApiRateLimitConfig {
  /** Max requests allowed within the window */
  max: number;
  /** Time window in milliseconds (default: 60_000 = 1 minute) */
  windowMs?: number;
}

/**
 * Apply rate limiting to an API request.
 *
 * Key format:
 * - Per-user: "api:{endpoint}:{userId}" (if userId provided)
 * - Per-tenant: "api:{endpoint}:tenant:{tenantId}" (if tenantId provided, no userId)
 * - Per-IP: "api:{endpoint}:ip:{clientIp}" (fallback)
 *
 * @example
 * ```ts
 * const { allowed, retryAfter } = await apiRateLimit(request, tenantId, '/api/bookings', { max: 100, windowMs: 60000 });
 * if (!allowed) {
 *   return NextResponse.json({ error: 'Rate limited' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
 * }
 * ```
 */
export async function apiRateLimit(
  request: NextRequest,
  tenantId: string,
  endpoint: string,
  config: ApiRateLimitConfig
): Promise<RateLimitResult> {
  const { max, windowMs = 60_000 } = config;
  const clientIp = getClientIp(request);

  // Build a rate limit key
  // Priority: tenant + IP for API routes (prevents abuse per tenant)
  const key = `api:${endpoint}:tenant:${tenantId}:ip:${clientIp}`;

  return rateLimit(key, max, windowMs);
}

/**
 * Apply per-user rate limiting to an API request.
 *
 * @example
 * ```ts
 * const { allowed, retryAfter } = await apiUserRateLimit(request, tenantId, userId, '/api/data/export', { max: 5, windowMs: 300_000 });
 * ```
 */
export async function apiUserRateLimit(
  request: NextRequest,
  tenantId: string,
  userId: string,
  endpoint: string,
  config: ApiRateLimitConfig
): Promise<RateLimitResult> {
  const { max, windowMs = 60_000 } = config;
  const key = `api:${endpoint}:tenant:${tenantId}:user:${userId}`;
  return rateLimit(key, max, windowMs);
}

/**
 * Extract client IP from request headers.
 */
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

const apiRateLimiter = { apiRateLimit, apiUserRateLimit };
export default apiRateLimiter;
