/**
 * OTA Client Factory
 * Factory for creating OTA API clients
 *
 * REFACTORED: This file was 10,471 lines (460KB) with 44 client classes inlined.
 * Now the classes live in individual files under ./clients/ and are imported here.
 * The 28 Tier-3 "copy-paste clone" classes have been replaced by a single
 * ConfigurableRestClient driven by per-OTA config from rest-configs.ts.
 *
 * Memory impact: Each client is a separate module, so bundlers can tree-shake
 * and code-split. The 28 identical ~120-line classes are now one class + config.
 */

import { OTAConfig, OTACredentials, OTAAPIClient } from './types';
import { ALL_OTAS, getOTAById } from './config';
import { BaseOTAClient } from './base-client';

// Tier-1 & Tier-2: dedicated clients with unique API logic
import { BookingComClient } from './clients/booking-com';
import { ExpediaClient } from './clients/expedia';
import { AirbnbClient } from './clients/airbnb';
import { VrboClient } from './clients/vrbo';
import { GoogleHotelsClient } from './clients/google-hotels';
import { AgodaClient } from './clients/agoda';
import { MakeMyTripClient } from './clients/makemytrip';
import { OYOClient } from './clients/oyo';
import { TravelokaClient } from './clients/traveloka';
import { TripComClient } from './clients/trip-com';
import { HotelsComClient } from './clients/hotels-com';
import { TripAdvisorClient } from './clients/tripadvisor';

// Tier-3: single ConfigurableRestClient replaces 28+ identical clone classes
import { ConfigurableRestClient } from './clients/configurable-rest-client';
import { REST_CLIENT_CONFIGS, GENERIC_REST_CONFIG } from './clients/rest-configs';

// ============================================
// OTA CLIENT FACTORY
// ============================================

// M-30 FIX: Cache entry that includes credentials hash and TTL for invalidation
interface ClientCacheEntry {
  client: OTAAPIClient;
  credentialsHash: string;
  createdAt: number;
}

/** TTL for cached authenticated clients (5 minutes) */
const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Simple string hash for credentials comparison */
function hashCredentials(credentials: OTACredentials): string {
  const parts = [
    credentials.apiKey || '',
    credentials.apiSecret || '',
    credentials.accessToken || '',
    credentials.refreshToken || '',
    credentials.username || '',
    credentials.password || '',
    credentials.hotelId || '',
    credentials.propertyId || '',
    credentials.certificate || '',
    credentials.signature || '',
  ];
  let hash = 0;
  const str = parts.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
}

export class OTAClientFactory {
  /** M-30 FIX: Cache now stores credentials hash + creation time for invalidation */
  private static clients: Map<string, ClientCacheEntry> = new Map();

  /** Cleanup expired cache entries every 5 minutes */
  private static cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of OTAClientFactory.clients.entries()) {
      if (now - entry.createdAt > CLIENT_CACHE_TTL_MS) {
        OTAClientFactory.clients.delete(key);
      }
    }
  }, CLIENT_CACHE_TTL_MS).unref();

  /**
   * Create or get an OTA client instance.
   * Uses a cache key of just channelId (no credentials) for unauthenticated clients.
   */
  static createClient(channelId: string): OTAAPIClient | null {
    // Check if we already have a cached client
    const cached = this.clients.get(channelId);
    if (cached) {
      return cached.client;
    }

    const config = getOTAById(channelId);
    if (!config) {
      console.error(`Unknown OTA channel: ${channelId}`);
      return null;
    }

    let client: OTAAPIClient;

    // Select the appropriate client based on channel
    switch (channelId) {
      // ── Tier-1: Complex API clients (XML, OAuth2, custom endpoints) ──
      case 'booking_com':
        client = new BookingComClient(config);
        break;

      case 'expedia':
        client = new ExpediaClient(config);
        break;

      case 'airbnb':
        client = new AirbnbClient(config);
        break;

      case 'vrbo':
      case 'homeaway':
        client = new VrboClient(config);
        break;

      case 'google_hotels':
        client = new GoogleHotelsClient(config);
        break;

      case 'agoda':
        client = new AgodaClient(config);
        break;

      case 'makemytrip':
      case 'goibibo':
        client = new MakeMyTripClient(config);
        break;

      // ── Tier-2: Medium-complexity clients ──
      case 'oyo':
        client = new OYOClient(config);
        break;

      case 'traveloka':
        client = new TravelokaClient(config);
        break;

      case 'trip_com':
        client = new TripComClient(config);
        break;

      case 'hotels_com':
        client = new HotelsComClient(config);
        break;

      case 'tripadvisor':
        client = new TripAdvisorClient(config);
        break;

      // ── Tier-3: ConfigurableRestClient (replaces 28+ identical clone classes) ──
      case 'edreams':
      case 'opodo':
      case 'hostelworld':
      case 'zenhotels':
      case 'rakuten_travel':
      case 'jalan':
      case 'ostrovok':
      case 'hrs':
      case 'lastminute':
      case 'jumia_travel':
      case 'trivago':
      case 'skyscanner':
      case 'priceline':
      case 'hotwire':
      case 'wego':
      case 'flipkey':
      case 'yatra':
      case 'cleartrip':
      case 'easemytrip':
      case 'fabhotels':
      case 'treebo':
      case 'stayz':
      case '9flats':
      case 'bookabach':
      case 'hotelplan':
      case 'housetrip':
      case 'ixigo':
      case 'kayak':
      case 'musafir':
      case 'plum_guide':
      case 'travelguru':
      case 'tui': {
        const restConfig = REST_CLIENT_CONFIGS.get(channelId);
        if (restConfig) {
          client = new ConfigurableRestClient(config, restConfig);
        } else {
          console.warn(`No REST config for Tier-3 OTA: ${channelId}, using generic fallback`);
          client = new ConfigurableRestClient(config, { ...GENERIC_REST_CONFIG, otaId: channelId, otaName: channelId });
        }
        break;
      }

      default:
        console.warn(`No specific client for channel: ${channelId}, using ConfigurableRestClient as fallback.`);
        client = new ConfigurableRestClient(config, { ...GENERIC_REST_CONFIG, otaId: channelId, otaName: channelId });
    }

    this.clients.set(channelId, {
      client,
      credentialsHash: '',
      createdAt: Date.now(),
    });
    return client;
  }

  /**
   * M-30 FIX: Get a client with credentials set.
   * Uses credentials hash as cache key so different tenants/connections
   * get separate cached instances. Invalidates when credentials change
   * or TTL expires (5 minutes).
   */
  static async getAuthenticatedClient(
    channelId: string,
    credentials: OTACredentials
  ): Promise<OTAAPIClient | null> {
    const credHash = hashCredentials(credentials);
    const cacheKey = `auth:${channelId}:${credHash}`;

    // Check if we have a valid cached authenticated client for these exact credentials
    const cached = this.clients.get(cacheKey);
    if (cached && (Date.now() - cached.createdAt) < CLIENT_CACHE_TTL_MS) {
      return cached.client;
    }

    // Expire any old cache entry for these credentials
    this.clients.delete(cacheKey);

    // Also expire the bare channelId cache since credentials changed
    this.clients.delete(channelId);

    const client = this.createClient(channelId);
    if (!client) return null;

    const result = await client.connect(credentials);
    if (!result.success) {
      console.error(`Failed to authenticate ${channelId}:`, result.message);
      return null;
    }

    // Cache with credentials-aware key
    this.clients.set(cacheKey, {
      client,
      credentialsHash: credHash,
      createdAt: Date.now(),
    });

    return client;
  }

  /**
   * M-30 FIX: Invalidate cached client for a specific connection.
   * Call this when credentials are updated via the API.
   * Clears both bare channelId cache and any auth-prefixed entries.
   */
  static invalidateClient(channelId: string): void {
    this.clients.delete(channelId);
    // Also remove any authenticated cache entries for this channel
    for (const key of this.clients.keys()) {
      if (key === channelId || key.startsWith(`auth:${channelId}:`)) {
        this.clients.delete(key);
      }
    }
  }

  /**
   * Clear cached client
   */
  static clearClient(channelId: string): void {
    this.invalidateClient(channelId);
  }

  /**
   * Clear all cached clients
   */
  static clearAll(): void {
    this.clients.clear();
  }
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

export function getAllOTAs(): OTAConfig[] {
  return ALL_OTAS;
}

export function getOTAConfig(channelId: string): OTAConfig | undefined {
  return getOTAById(channelId);
}
