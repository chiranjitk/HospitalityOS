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

    // Atomic upsert: increment count or create new entry
    const entry = await db.rateLimitEntry.upsert({
      where: { key },
      update: {
        count: { increment: 1 },
        resetAt,
      },
      create: {
        key,
        count: 1,
        resetAt,
      },
    });

    if (entry.count > maxAttempts) {
      // Calculate retry after in seconds
      const retryAfterMs = entry.resetAt.getTime() - now.getTime();
      const retryAfter = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return { allowed: false, retryAfter };
    }

    return { allowed: true, retryAfter: null };
  } catch (error) {
    console.error('Rate limit check failed (allowing request as fallback):', error);
    // On DB error, allow the request (fail-open) to avoid blocking legitimate users
    // due to database issues
    return { allowed: true, retryAfter: null };
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
