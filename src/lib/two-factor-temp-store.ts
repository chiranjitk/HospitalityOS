/**
 * Temporary store for 2FA setup secrets.
 * Uses BOTH in-memory (fast) + filesystem (cross-worker safe).
 *
 * Secrets are stored here until the user verifies a TOTP code,
 * at which point they are persisted to the database.
 *
 * Entries auto-expire after 10 minutes to prevent memory leaks.
 * File-based storage ensures secrets survive across PM2 worker restarts
 * and are available to all workers (unlike pure in-memory Map).
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';

interface TempTwoFASecret {
  secret: string;
  hashedBackupCodes: string;
  createdAt: number;
}

const TEMP_SECRET_TTL_MS = 10 * 60 * 1000; // 10 minutes
const TEMP_DIR = '/tmp/staysuite-2fa-temp';

// ── In-memory cache (fast path, avoids disk reads on every request) ──
const tempSecretMap = new Map<string, TempTwoFASecret>();

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of tempSecretMap) {
    if (now - entry.createdAt > TEMP_SECRET_TTL_MS) {
      tempSecretMap.delete(userId);
    }
  }
  // Also clean up expired files
  try {
    if (existsSync(TEMP_DIR)) {
      for (const file of readdirSync(TEMP_DIR)) {
        if (!file.endsWith('.json')) continue;
        try {
          const data = JSON.parse(readFileSync(join(TEMP_DIR, file), 'utf-8'));
          if (now - data.createdAt > TEMP_SECRET_TTL_MS) {
            unlinkSync(join(TEMP_DIR, file));
          }
        } catch {
          // ignore corrupt files
        }
      }
    }
  } catch {
    // ignore FS errors
  }
}, 5 * 60 * 1000).unref();

function getFilePath(userId: string): string {
  // Use a safe filename from the userId (replace special chars)
  const safeName = userId.replace(/[^a-zA-Z0-9]/g, '_');
  return join(TEMP_DIR, `${safeName}.json`);
}

/**
 * Store a temporary 2FA secret for a user (before TOTP verification).
 * Writes to both memory (fast) and filesystem (cross-worker safe).
 * Overwrites any previous temp secret for the same user.
 */
export function setTempSecret(userId: string, secret: string, hashedBackupCodes: string): void {
  const entry: TempTwoFASecret = { secret, hashedBackupCodes, createdAt: Date.now() };

  // In-memory cache
  tempSecretMap.set(userId, entry);

  // File-based persistence (shared across workers)
  try {
    const { mkdirSync } = require('fs');
    mkdirSync(TEMP_DIR, { recursive: true });
    writeFileSync(getFilePath(userId), JSON.stringify(entry), 'utf-8');
  } catch {
    // File write failed — memory-only mode (still works for single worker)
  }
}

function readFromFile(userId: string): TempTwoFASecret | null {
  try {
    const filePath = getFilePath(userId);
    if (!existsSync(filePath)) return null;
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (Date.now() - data.createdAt > TEMP_SECRET_TTL_MS) {
      unlinkSync(filePath);
      return null;
    }
    return data as TempTwoFASecret;
  } catch {
    return null;
  }
}

function deleteFile(userId: string): void {
  try {
    const filePath = getFilePath(userId);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    // ignore
  }
}

/**
 * Retrieve the temporary 2FA secret for a user without consuming it.
 * Checks memory first, then filesystem.
 * Returns null if not found or expired.
 */
export function getTempSecret(userId: string): { secret: string; hashedBackupCodes: string } | null {
  // Fast path: in-memory cache
  let entry = tempSecretMap.get(userId);
  if (entry && Date.now() - entry.createdAt <= TEMP_SECRET_TTL_MS) {
    return { secret: entry.secret, hashedBackupCodes: entry.hashedBackupCodes };
  }

  // Slow path: filesystem (handles cross-worker case)
  entry = readFromFile(userId);
  if (entry) {
    // Promote to memory cache for future fast access
    tempSecretMap.set(userId, entry);
    return { secret: entry.secret, hashedBackupCodes: entry.hashedBackupCodes };
  }

  return null;
}

/**
 * Retrieve and consume the temporary 2FA secret for a user.
 * Removes from both memory and filesystem (one-time use).
 * Returns null if not found or expired.
 */
export function consumeTempSecret(userId: string): { secret: string; hashedBackupCodes: string } | null {
  // Check memory first
  let entry = tempSecretMap.get(userId);
  if (entry && Date.now() - entry.createdAt > TEMP_SECRET_TTL_MS) {
    tempSecretMap.delete(userId);
    entry = null;
  }

  if (!entry) {
    // Check filesystem
    entry = readFromFile(userId);
  }

  if (!entry) return null;

  // Remove from both stores (one-time use)
  tempSecretMap.delete(userId);
  deleteFile(userId);

  return { secret: entry.secret, hashedBackupCodes: entry.hashedBackupCodes };
}
