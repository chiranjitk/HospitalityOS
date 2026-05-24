/**
 * license-crypto.ts
 *
 * Ed25519 license signing and verification for StaySuite-HospitalityOS.
 *
 * Key pair management:
 *   - Private key: used only by the license issuer (admin CLI / generate route).
 *   - Public key:  embedded in the application for runtime verification.
 *
 * In production, the private key lives on the signing machine only.
 * The public key is compiled into the binary or loaded from an env var.
 */

import crypto from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// =====================================================
// TYPES
// =====================================================

export interface LicensePayload {
  /** License key string (e.g. STS-PROF-2025-XXXX-XXXX) */
  key: string;
  /** Tenant that owns this license */
  tenantId: string;
  /** Tenant display name at activation time */
  tenantName: string;
  /** Plan name (trial, starter, professional, enterprise) */
  plan: string;
  /** Max properties allowed */
  maxProperties: number;
  /** Max rooms across all properties */
  maxRooms: number;
  /** Max user accounts */
  maxUsers: number;
  /** Feature flag IDs enabled by this license */
  features: string[];
  /** Server hardware fingerprint at activation time */
  serverFingerprint: string;
  /** ISO-8601 timestamp when license was issued */
  issuedAt: string;
  /** ISO-8601 timestamp when license expires (null = never) */
  expiresAt: string | null;
}

export interface SignedLicense {
  /** Base64-encoded Ed25519 signature of the payload */
  signature: string;
  /** JSON string of the LicensePayload */
  payload: string;
}

// =====================================================
// KEY PATHS
// =====================================================

/**
 * Default directory for license key pair storage.
 * Override with LICENSE_KEY_DIR env var.
 */
function getKeyDir(): string {
  return process.env.LICENSE_KEY_DIR || join(process.cwd(), '.license-keys');
}

export function getPrivateKeyPath(): string {
  return join(getKeyDir(), 'private.pem');
}

export function getPublicKeyPath(): string {
  return join(getKeyDir(), 'public.pem');
}

// =====================================================
// KEY PAIR MANAGEMENT
// =====================================================

/**
 * Ensure an Ed25519 key pair exists. Generates one if missing.
 * Returns the public key in PEM format.
 */
export function ensureKeyPair(): string {
  const dir = getKeyDir();

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const privateKeyPath = getPrivateKeyPath();
  const publicKeyPath = getPublicKeyPath();

  if (existsSync(publicKeyPath) && existsSync(privateKeyPath)) {
    return readFileSync(publicKeyPath, 'utf-8');
  }

  // Generate new Ed25519 key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
  });

  writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
  writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });

  return publicKey;
}

/**
 * Get the public key for license verification.
 *
 * Priority:
 *  1. PUBLIC_KEY_EMBEDDED constant (hardcoded at build time for distribution)
 *  2. LICENSE_PUBLIC_KEY env var
 *  3. File at getPublicKeyPath()
 *  4. Generate a new key pair (dev mode only)
 */
export function getPublicKey(): string {
  // 1. Embedded public key (set at build for distribution builds)
  if (PUBLIC_KEY_EMBEDDED) {
    return PUBLIC_KEY_EMBEDDED;
  }

  // 2. Environment variable override
  const envKey = process.env.LICENSE_PUBLIC_KEY;
  if (envKey) {
    return envKey;
  }

  // 3. File on disk
  const pubPath = getPublicKeyPath();
  if (existsSync(pubPath)) {
    return readFileSync(pubPath, 'utf-8');
  }

  // 4. Generate (dev mode)
  return ensureKeyPair();
}

/**
 * Get the private key for license signing.
 * Only available on the signing machine.
 */
export function getPrivateKey(): string {
  const privPath = getPrivateKeyPath();
  if (existsSync(privPath)) {
    return readFileSync(privPath, 'utf-8');
  }

  // Dev mode: generate
  ensureKeyPair();
  return readFileSync(getPrivateKeyPath(), 'utf-8');
}

// =====================================================
// SIGNING
// =====================================================

/**
 * Sign a license payload object and return a SignedLicense.
 */
export function signLicense(payload: LicensePayload): SignedLicense {
  const payloadStr = JSON.stringify(payload);
  const privateKey = getPrivateKey();

  const signature = crypto.sign('sha512', Buffer.from(payloadStr), {
    key: privateKey,
    type: 'pkcs8',
    format: 'pem',
  });

  return {
    signature: signature.toString('base64'),
    payload: payloadStr,
  };
}

/**
 * Sign a license payload — convenience overload that accepts a pre-serialized payload string.
 */
export function signLicensePayload(payload: LicensePayload): SignedLicense {
  return signLicense(payload);
}

// =====================================================
// VERIFICATION
// =====================================================

/**
 * Verify a signed license. Returns the parsed payload if valid, null if invalid.
 */
export function verifyLicense(signed: SignedLicense): LicensePayload | null {
  try {
    const publicKey = getPublicKey();
    const payloadBuf = Buffer.from(signed.payload, 'utf-8');
    const sigBuf = Buffer.from(signed.signature, 'base64');

    const isValid = crypto.verify('sha512', payloadBuf, {
      key: publicKey,
      type: 'spki',
      format: 'pem',
    }, sigBuf);

    if (!isValid) {
      return null;
    }

    const payload: LicensePayload = JSON.parse(signed.payload);

    // Basic structure validation
    if (!payload.key || !payload.tenantId || !payload.plan || !payload.issuedAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify a license from separate payload + signature strings.
 */
export function verifyLicensePayload(payloadStr: string, signatureBase64: string): LicensePayload | null {
  return verifyLicense({
    payload: payloadStr,
    signature: signatureBase64,
  });
}

// =====================================================
// EMBEDDED PUBLIC KEY
// =====================================================

/**
 * Placeholder for the embedded public key.
 * In production builds, this is replaced with the actual public key
 * during the build process (e.g. via a script that injects the key).
 */
const PUBLIC_KEY_EMBEDDED: string | null = null;
