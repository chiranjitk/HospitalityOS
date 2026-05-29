/**
 * Simple in-memory rate limiter for API routes.
 * Tracks request timestamps per IP within a sliding window.
 */

const rateLimiter = new Map<string, number[]>();

export function checkRateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const window = (rateLimiter.get(ip) || []).filter(t => now - t < windowMs);
  if (window.length >= maxRequests) return false;
  window.push(now);
  rateLimiter.set(ip, window);
  return true;
}
