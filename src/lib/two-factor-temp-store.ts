/**
 * Temporary in-memory store for 2FA setup secrets.
 * Secrets are stored here until the user verifies a TOTP code,
 * at which point they are persisted to the database.
 *
 * Entries auto-expire after 10 minutes to prevent memory leaks.
 */

interface TempTwoFASecret {
  secret: string;
  hashedBackupCodes: string;
  createdAt: number;
}

const TEMP_SECRET_TTL_MS = 10 * 60 * 1000; // 10 minutes

const tempSecretMap = new Map<string, TempTwoFASecret>();

// Periodic cleanup every 5 minutes to avoid unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of tempSecretMap) {
    if (now - entry.createdAt > TEMP_SECRET_TTL_MS) {
      tempSecretMap.delete(userId);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Store a temporary 2FA secret for a user (before TOTP verification).
 * Overwrites any previous temp secret for the same user.
 */
export function setTempSecret(userId: string, secret: string, hashedBackupCodes: string): void {
  tempSecretMap.set(userId, {
    secret,
    hashedBackupCodes,
    createdAt: Date.now(),
  });
}

/**
 * Retrieve and consume the temporary 2FA secret for a user.
 * Returns null if not found or expired.
 */
export function consumeTempSecret(userId: string): { secret: string; hashedBackupCodes: string } | null {
  const entry = tempSecretMap.get(userId);
  if (!entry) return null;

  // Check expiration
  if (Date.now() - entry.createdAt > TEMP_SECRET_TTL_MS) {
    tempSecretMap.delete(userId);
    return null;
  }

  // Remove after consuming (one-time use)
  tempSecretMap.delete(userId);
  return { secret: entry.secret, hashedBackupCodes: entry.hashedBackupCodes };
}
