/**
 * server-fingerprint.ts
 *
 * Generates a stable hardware fingerprint for the current server.
 *
 * The fingerprint is derived from:
 *   - CPU model / CPU count
 *   - Total system memory
 *   - Hostname
 *   - Primary network interface MAC address
 *   - Disk serial (first mounted volume)
 *
 * The fingerprint is intentionally NOT cryptographically secure on its own —
 * it is used as an advisory identifier combined with Ed25519-signed license
 * payloads. The real security guarantee comes from the signature, not the
 * fingerprint.
 *
 * In containerised / cloud deployments, the fingerprint may change across
 * rebuilds. The hosting-config module controls whether mismatches are enforced.
 */

import crypto from 'node:crypto';
import os from 'node:os';
import { Buffer } from 'node:buffer';

// =====================================================
// FINGERPRINT GENERATION
// =====================================================

/**
 * Collect hardware identifiers from the current machine.
 * Each identifier is a string; missing values use '(unknown)'.
 */
function collectIdentifiers(): string[] {
  const ids: string[] = [];

  // CPU
  try {
    const cpus = os.cpus();
    ids.push(cpus.length > 0 ? cpus[0].model.trim() : '(unknown-cpu)');
    ids.push(String(cpus.length));
  } catch {
    ids.push('(unknown-cpu)', '(unknown-count)');
  }

  // Memory
  try {
    ids.push(String(os.totalmem()));
  } catch {
    ids.push('(unknown-mem)');
  }

  // Hostname
  try {
    ids.push(os.hostname());
  } catch {
    ids.push('(unknown-host)');
  }

  // Network MAC addresses (sorted for stability)
  try {
    const interfaces = os.networkInterfaces();
    const macs: string[] = [];
    for (const name of Object.keys(interfaces).sort()) {
      const nets = interfaces[name] || [];
      for (const net of nets) {
        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
          macs.push(net.mac);
        }
      }
    }
    // Sort MACs so order doesn't matter
    ids.push(macs.sort().join(','));
  } catch {
    ids.push('(unknown-net)');
  }

  // Platform + architecture
  try {
    ids.push(`${os.platform()}-${os.arch()}`);
  } catch {
    ids.push('(unknown-os)');
  }

  return ids;
}

// =====================================================
// CACHE
// =====================================================

let cachedFingerprint: string | null = null;

/**
 * Generate (or return cached) hardware fingerprint for this server.
 *
 * The fingerprint is a SHA-256 hash of the collected identifiers,
 * encoded as a lowercase hex string.
 *
 * Results are cached in-memory for the process lifetime since hardware
 * doesn't change at runtime.
 */
export function getServerFingerprint(): string {
  if (cachedFingerprint) return cachedFingerprint;

  const ids = collectIdentifiers();
  const raw = ids.join('|');

  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  cachedFingerprint = hash;

  return hash;
}

/**
 * Reset the cached fingerprint. Useful for testing.
 */
export function resetFingerprintCache(): void {
  cachedFingerprint = null;
}

/**
 * Return the raw identifiers used for fingerprinting (for debugging).
 * Does NOT include the hash — just the individual signals.
 */
export function getFingerprintDebugInfo(): {
  hostname: string;
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCount: number;
  totalMemoryBytes: number;
  macAddresses: string[];
} {
  const cpus = os.cpus();
  const macs: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces).sort()) {
    const nets = interfaces[name] || [];
    for (const net of nets) {
      if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
        macs.push(net.mac);
      }
    }
  }

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpuModel: cpus.length > 0 ? cpus[0].model.trim() : '(unknown)',
    cpuCount: cpus.length,
    totalMemoryBytes: os.totalmem(),
    macAddresses: macs.sort(),
  };
}
