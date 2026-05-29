/**
 * GDS Client Factory
 *
 * Creates provider-specific GDS clients from a stored GdsConnection record.
 * Reads credentials and configuration from the database and constructs
 * the appropriate client (Amadeus, Sabre, or Travelport).
 *
 * Provider-specific endpoint defaults can be overridden via:
 *   - AMADEUS_API_ENDPOINT  env var
 *   - SABRE_API_ENDPOINT    env var
 *   - TRAVELPORT_API_ENDPOINT env var
 */

import type { GdsConnection } from '@prisma/client';
import type { GDSProvider, GDSConfig } from './types';
import { BaseGDSClient } from './base-client';
import { AmadeusClient } from './amadeus-client';
import { SabreClient } from './sabre-client';
import { TravelportClient } from './travelport-client';
import { decrypt, isEncrypted } from '@/lib/encryption';

// ============================================================
// PROVIDER ENDPOINT DEFAULTS
// ============================================================

const PROVIDER_DEFAULTS: Record<GDSProvider, { endpoint: string; pccEnvVar: string; endpointEnvVar: string }> = {
  amadeus: {
    endpoint: process.env.AMADEUS_API_ENDPOINT || 'https://ws.amadeus.com',
    pccEnvVar: 'AMADEUS_DEFAULT_PCC',
    endpointEnvVar: 'AMADEUS_API_ENDPOINT',
  },
  sabre: {
    endpoint: process.env.SABRE_API_ENDPOINT || 'https://webservices.sabre.com',
    pccEnvVar: 'SABRE_DEFAULT_PCC',
    endpointEnvVar: 'SABRE_API_ENDPOINT',
  },
  travelport: {
    endpoint: process.env.TRAVELPORT_API_ENDPOINT || 'https://api.travelport.com',
    pccEnvVar: 'TRAVELPORT_DEFAULT_BRANCH',
    endpointEnvVar: 'TRAVELPORT_API_ENDPOINT',
  },
};

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Create a GDS client from a stored GdsConnection database record.
 *
 * @param connection - The GdsConnection row from Prisma
 * @returns An instantiated BaseGDSClient for the appropriate provider
 * @throws Error if the provider is unsupported or credentials are missing
 */
export function createGDSClient(connection: GdsConnection): BaseGDSClient {
  const config = getGDSConfig(connection);

  switch (config.provider) {
    case 'amadeus':
      return new AmadeusClient(config);
    case 'sabre':
      return new SabreClient(config);
    case 'travelport':
      return new TravelportClient(config);
    default:
      throw new Error(`Unsupported GDS provider: ${config.provider}`);
  }
}

/**
 * Convert a GdsConnection database record into a GDSConfig suitable
 * for passing to a client constructor.
 *
 * Handles:
 *  - Provider string → typed enum
 *  - Endpoint resolution (explicit override → env var → default)
 *  - PCC extraction from JSON string
 *  - Credential mapping
 */
export function getGDSConfig(connection: GdsConnection): GDSConfig {
  const provider = connection.provider as GDSProvider;
  const defaults = PROVIDER_DEFAULTS[provider];

  if (!defaults) {
    throw new Error(`Unknown GDS provider: ${connection.provider}`);
  }

  // Endpoint: explicit connection endpoint → env var → default
  const endpoint = connection.endpointUrl || defaults.endpoint;

  // PCC: parse from JSON string if it was stored as JSON, else use raw value
  let pcc = connection.pcc || '';
  try {
    // The schema stores pcc as a string; it might be JSON-encoded or plain
    const parsed = JSON.parse(pcc);
    if (typeof parsed === 'string') pcc = parsed;
    else if (Array.isArray(parsed) && parsed.length > 0) pcc = parsed[0];
    else if (typeof parsed === 'object' && parsed.code) pcc = parsed.code;
  } catch {
    // pcc is already a plain string — that's fine
  }

  /**
   * Helper to decrypt a stored credential if it's encrypted.
   * Returns the plaintext value, or the original string if not encrypted.
   */
  function decryptCredential(value: string | null | undefined): string {
    if (!value) return '';
    if (isEncrypted(value)) {
      const decrypted = decrypt(value);
      return decrypted || '';
    }
    return value;
  }

  return {
    provider,
    endpoint,
    pcc,
    username: connection.username || '',
    password: decryptCredential(connection.password),
    officeId: pcc, // Travelport uses PCC as TargetBranch/officeId
    chainCode: connection.chainCode || undefined,
    propertyCode: connection.hotelCode || '',
  };
}

/**
 * Get the supported GDS providers with their display metadata.
 */
export function getSupportedProviders(): { provider: GDSProvider; displayName: string; code: string }[] {
  return [
    { provider: 'amadeus', displayName: 'Amadeus', code: '1A' },
    { provider: 'sabre', displayName: 'Sabre', code: '1S' },
    { provider: 'travelport', displayName: 'Travelport (Galileo/Worldspan)', code: '1P' },
  ];
}

/**
 * Check if GDS sync is enabled via environment variable.
 */
export function isGDSSyncEnabled(): boolean {
  return process.env.GDS_SYNC_ENABLED === 'true';
}

/**
 * Get the configured booking pull interval in minutes.
 */
export function getBookingPullIntervalMinutes(): number {
  const val = parseInt(process.env.GDS_BOOKING_PULL_INTERVAL_MINUTES || '15', 10);
  return Math.max(1, val);
}
