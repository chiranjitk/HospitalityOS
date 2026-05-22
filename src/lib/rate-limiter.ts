/**
 * Centralized Database-Persisted Rate Limiter
 *
 * Uses Prisma to track rate limit counters in the RateLimitEntry table.
 * Supports both per-user and per-tenant rate limiting with configurable
 * windows and max attempts. Periodically cleans up expired entries.
 */

import { db } from '@/lib/db';

interface RateLimitResult {
  allowed: boolean;
  retryAfter: number | null; // seconds until next attempt is allowed
}

// Track last cleanup time to avoid excessive cleanup queries
let lastCleanup = 0;
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Check and increment rate limit for a given key.
 *
 * @param key - Unique identifier (e.g., "login:user@example.com", "api:tenantId:endpoint")
 * @param maxAttempts - Maximum number of attempts allowed within the window
 * @param windowMs - Time window in milliseconds
 * @returns { allowed: boolean, retryAfter: number | null }
 */
export async function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  try {
    // Periodic cleanup of expired entries (best-effort, non-blocking)
    if (now.getTime() - lastCleanup > CLEANUP_INTERVAL) {
      lastCleanup = now.getTime();
      cleanupExpiredEntries().catch(() => {
        // Non-blocking — never fail rate limit check due to cleanup error
      });
    }

    // Atomic upsert using raw SQL (INSERT ... ON CONFLICT DO UPDATE)
    // This is truly atomic at the database level, unlike Prisma's upsert
    // which can race between read and write operations.
    const { randomUUID } = await import('crypto');
    const [entry] = await db.$queryRaw<Array<{ id: string; key: string; count: number; resetAt: Date }>>`
      INSERT INTO "RateLimitEntry" ("id", "key", "count", "resetAt", "createdAt")
      VALUES (${randomUUID()}, ${key}, 1, ${resetAt}, NOW())
      ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimitEntry"."count" + 1
      RETURNING "id", "key", "count", "resetAt", "createdAt"
    `;

    if (entry.count > maxAttempts) {
      // Calculate retry after in seconds
      const retryAfterMs = entry.resetAt.getTime() - now.getTime();
      const retryAfter = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return { allowed: false, retryAfter };
    }

    return { allowed: true, retryAfter: null };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // In development, fail-open to avoid blocking legitimate logins
    if (process.env.NODE_ENV !== 'production') {
      return { allowed: true, retryAfter: null };
    }
    // In production, deny the request (fail-closed) to prevent abuse
    return { allowed: false, retryAfter: 60 };
  }
}

/**
 * Reset rate limit for a specific key (e.g., after successful login).
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await db.rateLimitEntry.deleteMany({ where: { key } });
  } catch {
    // Non-blocking
  }
}

/**
 * Get current rate limit status for a key without incrementing.
 */
export async function getRateLimitStatus(
  key: string,
  maxAttempts: number
): Promise<{ remaining: number; resetAt: Date | null }> {
  try {
    const entry = await db.rateLimitEntry.findUnique({
      where: { key },
      select: { count: true, resetAt: true },
    });

    if (!entry || entry.resetAt < new Date()) {
      return { remaining: maxAttempts, resetAt: null };
    }

    return {
      remaining: Math.max(0, maxAttempts - entry.count),
      resetAt: entry.resetAt,
    };
  } catch {
    return { remaining: maxAttempts, resetAt: null };
  }
}

/**
 * Clean up expired rate limit entries.
 * Runs periodically to prevent table bloat.
 */
async function cleanupExpiredEntries(): Promise<void> {
  try {
    const result = await db.rateLimitEntry.deleteMany({
      where: {
        resetAt: { lt: new Date() },
      },
    });
    if (result.count > 0) {
      console.log(`[RateLimiter] Cleaned up ${result.count} expired entries`);
    }
  } catch {
    // Non-blocking
  }
}

const rateLimiter = { rateLimit, resetRateLimit, getRateLimitStatus };
export default rateLimiter;
