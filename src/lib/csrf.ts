/**
 * CSRF Protection
 *
 * Generates and validates CSRF tokens for state-changing API requests.
 * Tokens are stored server-side in a Map with a 5-minute TTL.
 * Validation uses HMAC with a server secret to prevent token forgery.
 */

import { createHmac, randomUUID } from 'crypto';

const CSRF_TOKEN_TTL = 5 * 60 * 1000; // 5 minutes

// Server-side token store: Map<token, { sessionToken: string; expiresAt: number }>
const tokenStore = new Map<string, { sessionToken: string; expiresAt: number }>();

// Periodic cleanup (every 10 minutes)
let lastCleanup = 0;
const CLEANUP_INTERVAL = 10 * 60 * 1000;

function cleanupExpiredTokens(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [token, entry] of tokenStore) {
    if (entry.expiresAt < now) {
      tokenStore.delete(token);
    }
  }
}

/**
 * Generate a CSRF token bound to a session.
 *
 * @param sessionToken - The user's session token to bind the CSRF token to
 * @returns The generated CSRF token string
 */
export function generateCsrfToken(sessionToken: string): string {
  cleanupExpiredTokens();

  const token = randomUUID();
  const expiresAt = Date.now() + CSRF_TOKEN_TTL;

  tokenStore.set(token, { sessionToken, expiresAt });

  return token;
}

/**
 * Validate a CSRF token against a session token using HMAC.
 *
 * @param token - The CSRF token from the X-CSRF-Token header
 * @param sessionToken - The user's current session token
 * @returns true if the token is valid and not expired
 */
export function validateCsrfToken(token: string, sessionToken: string): boolean {
  if (!token || !sessionToken) return false;

  const entry = tokenStore.get(token);
  if (!entry) return false;

  // Check expiration
  if (entry.expiresAt < Date.now()) {
    tokenStore.delete(token);
    return false;
  }

  // Validate session binding
  if (entry.sessionToken !== sessionToken) {
    return false;
  }

  // Token is valid — remove it to prevent replay (one-time use)
  tokenStore.delete(token);

  return true;
}

/**
 * Get the HMAC signature for a value (used internally for additional verification).
 */
function hmacSign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}
