/**
 * JWKS (JSON Web Key Set) Discovery and Caching
 *
 * Handles fetching, caching, and using JWKS keys for JWT signature verification.
 * Keys are cached with a configurable TTL (default: 1 hour) to avoid repeated fetches.
 */

import crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JWK {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  x5c?: string[];
  [key: string]: unknown;
}

interface JWKSet {
  keys: JWK[];
}

interface JWKSWithExpiry {
  jwks: JWKSet;
  fetchedAt: number;
  expiresAt: number;
}

interface JwtHeader {
  alg: string;
  kid?: string;
  typ?: string;
  [key: string]: unknown;
}

interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nbf?: number;
  jti?: string;
  [key: string]: unknown;
}

interface VerificationResult {
  valid: boolean;
  payload?: JwtPayload;
  error?: string;
}

// ─── JWKS Cache ───────────────────────────────────────────────────────────────

// In-memory cache for JWKS, keyed by issuer URL
const jwksCache = new Map<string, JWKSWithExpiry>();

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetch and cache JWKS from the given URI.
 * Returns cached keys if still within TTL.
 */
export async function fetchJWKS(jwksUri: string, ttlMs: number = DEFAULT_TTL_MS): Promise<JWKSet> {
  const now = Date.now();

  // Check cache first
  const cached = jwksCache.get(jwksUri);
  if (cached && cached.expiresAt > now) {
    return cached.jwks;
  }

  // Fetch fresh JWKS
  const response = await fetch(jwksUri, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000), // 10s fetch timeout
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: HTTP ${response.status} ${response.statusText}`);
  }

  const jwks: JWKSet = await response.json();

  if (!jwks.keys || !Array.isArray(jwks.keys)) {
    throw new Error('Invalid JWKS response: missing keys array');
  }

  // Store in cache
  jwksCache.set(jwksUri, {
    jwks,
    fetchedAt: now,
    expiresAt: now + ttlMs,
  });

  // Periodically clean up expired cache entries
  if (jwksCache.size > 50) {
    cleanupJWKSCache();
  }

  return jwks;
}

/**
 * Discover JWKS URI from OIDC well-known configuration.
 * Fetches /.well-known/openid-configuration and returns the jwks_uri.
 */
export async function discoverJWKS(
  issuer: string
): Promise<{ jwksUri: string; issuer: string }> {
  // Normalize issuer URL
  const normalizedIssuer = issuer.endsWith('/')
    ? issuer.slice(0, -1)
    : issuer;

  const discoveryUrl = `${normalizedIssuer}/.well-known/openid-configuration`;

  const response = await fetch(discoveryUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OIDC discovery document: HTTP ${response.status}`);
  }

  const config = await response.json();

  if (!config.jwks_uri) {
    throw new Error('OIDC discovery document does not contain jwks_uri');
  }

  return {
    jwksUri: config.jwks_uri as string,
    issuer: config.issuer || normalizedIssuer,
  };
}

/**
 * Verify a JWT (id_token or access_token) using JWKS.
 *
 * @param jwt - The JWT string (three dot-separated parts)
 * @param jwksUri - URI to fetch JWKS from
 * @param expectedIssuer - Expected issuer claim value
 * @param expectedAudience - Expected audience claim value (client ID)
 * @param clockToleranceSeconds - Allowed clock skew in seconds (default: 60)
 */
export async function verifyJwtWithJWKS(
  jwt: string,
  jwksUri: string,
  expectedIssuer: string,
  expectedAudience: string,
  clockToleranceSeconds: number = 60
): Promise<VerificationResult> {
  try {
    // 1. Split and decode JWT
    const parts = jwt.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid JWT format: expected 3 parts' };
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // 2. Decode header
    let header: JwtHeader;
    try {
      const headerBuf = Buffer.from(headerB64, 'base64url');
      header = JSON.parse(headerBuf.toString('utf8')) as JwtHeader;
    } catch {
      return { valid: false, error: 'Failed to decode JWT header' };
    }

    // 3. Decode payload
    let payload: JwtPayload;
    try {
      const payloadBuf = Buffer.from(payloadB64, 'base64url');
      payload = JSON.parse(payloadBuf.toString('utf8')) as JwtPayload;
    } catch {
      return { valid: false, error: 'Failed to decode JWT payload' };
    }

    // 4. Validate claims BEFORE verifying signature (fail fast on expired tokens)
    const claimsError = validateClaims(payload, expectedIssuer, expectedAudience, clockToleranceSeconds);
    if (claimsError) {
      return { valid: false, error: claimsError };
    }

    // 5. Fetch JWKS
    const jwks = await fetchJWKS(jwksUri);

    // 6. Find matching key
    const key = findMatchingKey(jwks.keys, header);
    if (!key) {
      return {
        valid: false,
        error: `No matching key found in JWKS (kid: ${header.kid || 'none'}, alg: ${header.alg || 'none'})`,
      };
    }

    // 7. Verify signature
    const signatureValid = verifySignature(headerB64, payloadB64, signatureB64, key, header.alg);
    if (!signatureValid) {
      return { valid: false, error: 'JWT signature verification failed' };
    }

    return { valid: true, payload };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'JWT verification failed',
    };
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Validate JWT claims (iss, aud, exp, iat).
 */
function validateClaims(
  payload: JwtPayload,
  expectedIssuer: string,
  expectedAudience: string,
  clockTolerance: number
): string | null {
  const now = Math.floor(Date.now() / 1000);

  // Check expiration
  if (payload.exp !== undefined && payload.exp < now - clockTolerance) {
    return `Token expired at ${new Date(payload.exp * 1000).toISOString()}`;
  }

  // Check issuer
  if (payload.iss !== expectedIssuer) {
    // Some providers return issuer with/without trailing slash — be lenient
    const normalize = (s: string) => s.replace(/\/+$/, '');
    if (normalize(payload.iss || '') !== normalize(expectedIssuer)) {
      return `Invalid issuer: expected "${expectedIssuer}", got "${payload.iss}"`;
    }
  }

  // Check audience
  if (payload.aud !== undefined) {
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(expectedAudience)) {
      return `Invalid audience: expected "${expectedAudience}", got "${payload.aud}"`;
    }
  }

  // Check issued-at (warn if token was issued too far in the future)
  if (payload.iat !== undefined && payload.iat > now + clockTolerance) {
    return `Token issued in the future (iat: ${payload.iat}, now: ${now})`;
  }

  return null;
}

/**
 * Find a matching key in the JWKS key set.
 */
function findMatchingKey(keys: JWK[], header: JwtHeader): JWK | null {
  if (keys.length === 0) return null;

  // Try to match by kid first
  if (header.kid) {
    const match = keys.find(k => k.kid === header.kid && k.kty === (header.alg === 'RS256' ? 'RSA' : k.kty));
    if (match) return match;
  }

  // Fall back to any RSA key (most OIDC providers use RS256)
  if (header.alg?.startsWith('RS')) {
    const rsaKey = keys.find(k => k.kty === 'RSA');
    if (rsaKey) return rsaKey;
  }

  // Fall back to first key
  return keys[0] || null;
}

/**
 * Verify JWT signature using Node.js crypto.
 * Supports RSA-based algorithms (RS256, RS384, RS512) and EC-based (ES256, ES384, ES512).
 */
function verifySignature(
  headerB64: string,
  payloadB64: string,
  signatureB64: string,
  key: JWK,
  alg?: string
): boolean {
  try {
    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64, 'base64url');

    // Determine algorithm
    const algorithm = alg || key.alg || 'RS256';

    if (algorithm.startsWith('RS')) {
      return verifyRSA(signingInput, signature, key, algorithm);
    }

    if (algorithm.startsWith('ES')) {
      return verifyECDSA(signingInput, signature, key, algorithm);
    }

    // Unsupported algorithm
    console.warn(`[JWKS] Unsupported JWT algorithm: ${algorithm}`);
    return false;
  } catch (error) {
    console.error('[JWKS] Signature verification error:', error);
    return false;
  }
}

/**
 * Verify RSA signature (RS256, RS384, RS512).
 */
function verifyRSA(signingInput: string, signature: Buffer, key: JWK, alg: string): boolean {
  // Prefer x5c certificate if available
  if (key.x5c && key.x5c.length > 0) {
    try {
      const cert = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
      const publicKey = crypto.createPublicKey({ key: cert, format: 'pem' });
      return crypto.verify(algToHash(alg), Buffer.from(signingInput), publicKey, signature);
    } catch {
      // Fall through to RSA parameters
    }
  }

  // Use RSA parameters (n, e)
  if (!key.n || !key.e) {
    console.error('[JWKS] RSA key missing n or e parameters');
    return false;
  }

  try {
    const publicKey = crypto.createPublicKey({
      key: {
        kty: 'RSA',
        n: key.n,
        e: key.e,
      },
      format: 'jwk',
    });

    return crypto.verify(algToHash(alg), Buffer.from(signingInput), publicKey, signature);
  } catch (error) {
    console.error('[JWKS] RSA verification error:', error);
    return false;
  }
}

/**
 * Verify ECDSA signature (ES256, ES384, ES512).
 */
function verifyECDSA(signingInput: string, signature: Buffer, key: JWK, alg: string): boolean {
  if (!key.x || !key.crv) {
    console.error('[JWKS] EC key missing x or crv parameters');
    return false;
  }

  try {
    const publicKey = crypto.createPublicKey({
      key: {
        kty: 'EC',
        crv: key.crv,
        x: key.x,
        y: key.y,
      } as Parameters<typeof crypto.createPublicKey>[0]['key'],
      format: 'jwk',
    });

    return crypto.verify(algToHash(alg), Buffer.from(signingInput), publicKey, signature);
  } catch (error) {
    console.error('[JWKS] ECDSA verification error:', error);
    return false;
  }
}

/**
 * Map JOSE algorithm name to Node.js crypto hash name.
 */
function algToHash(alg: string): string {
  const mapping: Record<string, string> = {
    RS256: 'sha256',
    RS384: 'sha384',
    RS512: 'sha512',
    ES256: 'sha256',
    ES384: 'sha384',
    ES512: 'sha512',
    PS256: 'sha256',
    PS384: 'sha384',
    PS512: 'sha512',
  };
  return mapping[alg] || 'sha256';
}

/**
 * Clean up expired JWKS cache entries.
 */
function cleanupJWKSCache(): void {
  const now = Date.now();
  for (const [uri, entry] of jwksCache.entries()) {
    if (entry.expiresAt <= now) {
      jwksCache.delete(uri);
    }
  }
}

/**
 * Clear the JWKS cache (useful for testing or forced refresh).
 */
export function clearJWKSCache(): void {
  jwksCache.clear();
}

/**
 * Get cached JWKS info (for debugging).
 */
export function getJWKSCacheInfo(): { size: number; entries: Array<{ uri: string; expiresAt: number }> } {
  return {
    size: jwksCache.size,
    entries: Array.from(jwksCache.entries()).map(([uri, entry]) => ({
      uri,
      expiresAt: entry.expiresAt,
    })),
  };
}

const jwksService = {
  fetchJWKS,
  discoverJWKS,
  verifyJwtWithJWKS,
  clearJWKSCache,
  getJWKSCacheInfo,
};
export default jwksService;
