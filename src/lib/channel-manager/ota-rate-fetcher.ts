/**
 * Real OTA Rate Fetcher
 *
 * Fetches live rates from connected OTA channels using the OTAClientFactory.
 * Caches results for 15 minutes to reduce API calls and improve performance.
 * Falls back to PMS base rate with configured variance if client call fails.
 */

import { db } from '@/lib/db';
import { OTAClientFactory } from '@/lib/ota/client-factory';
import { OTACredentials } from '@/lib/ota/types';

// ============================================
// TYPES
// ============================================

/** A single rate entry returned from an OTA channel */
export interface OTARateEntry {
  connectionId: string;
  channelCode: string;
  channelName: string;
  externalRoomId: string;
  externalRatePlanId: string;
  date: string;
  baseRate: number;
  currency: string;
  available: boolean;
  source: 'live' | 'fallback';
  fetchedAt: string;
}

/** Cache entry for rate data */
interface RateCacheEntry {
  key: string;
  rates: OTARateEntry[];
  expiresAt: number;
}

// ============================================
// IN-MEMORY CACHE (15-minute TTL)
// ============================================

const rateCache = new Map<string, RateCacheEntry>();
setInterval(() => { const now = Date.now(); for (const [key, val] of rateCache.entries()) { if (val.expiresAt < now) rateCache.delete(key); } }, 15 * 60_000).unref();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// M-31 FIX: Separate last-known-good cache with longer TTL (2 hours)
// When live API calls fail, we return stale-but-real data instead of fake variance values.
const lastKnownGoodCache = new Map<string, RateCacheEntry>();
const LAST_KNOWN_GOOD_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
setInterval(() => { const now = Date.now(); for (const [key, val] of lastKnownGoodCache.entries()) { if (val.expiresAt < now) lastKnownGoodCache.delete(key); } }, LAST_KNOWN_GOOD_TTL_MS).unref();

/** Default channel variance factors used as fallback when live rates are unavailable */
const DEFAULT_VARIANCE_FACTORS: Record<string, number> = {
  booking_com: 0.98,
  expedia: 0.97,
  airbnb: 1.02,
  hotels_com: 0.99,
  agoda: 0.96,
  tripadvisor: 1.00,
  makemytrip: 0.95,
  google_hotels: 1.01,
  goibibo: 0.94,
  booking: 0.98,
};

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Fetch live rates from a specific channel connection for a given room type
 * and date range.
 *
 * Uses the OTAClientFactory to get an authenticated client, calls getRates()
 * for real data, and caches results for 15 minutes.
 *
 * Falls back to PMS base rate with configured variance if the client call fails.
 *
 * @param connectionId - The channel connection ID in the database
 * @param roomTypeId - The PMS room type ID to fetch rates for
 * @param dates - Start and end date for the rate query
 * @returns Array of rate entries from the OTA channel
 */
export async function fetchLiveRatesFromChannel(
  connectionId: string,
  roomTypeId: string,
  dates: { start: Date; end: Date },
): Promise<OTARateEntry[]> {
  // Build a cache key from the connection, room type, and dates
  const cacheKey = buildCacheKey(connectionId, roomTypeId, dates);

  // Check cache first
  const cached = rateCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rates;
  }

  try {
    // Fetch the connection with credentials from the database
    const connection = await db.channelConnection.findFirst({
      where: { id: connectionId, status: 'active' },
    });

    if (!connection) {
      console.warn(`[OTA Rate Fetcher] Connection not found or inactive: ${connectionId}`);
      return [];
    }

    // Parse credentials from the stored JSON
    let credentials: Record<string, unknown> = {};
    if (connection.credentials) {
      try {
        credentials = JSON.parse(connection.credentials);
      } catch {
        credentials = {};
      }
    }

    // Get the channel mapping to find the external room ID
    const mapping = await db.channelMapping.findFirst({
      where: {
        connectionId,
        roomTypeId,
        status: 'active',
        syncRates: true,
      },
    });

    if (!mapping) {
      console.warn(`[OTA Rate Fetcher] No rate mapping found for connection ${connectionId}, room ${roomTypeId}`);
      return [];
    }

    // Get authenticated OTA client
    const client = await OTAClientFactory.getAuthenticatedClient(
      connection.channel,
      credentials as OTACredentials,
    );

    if (!client) {
      console.warn(`[OTA Rate Fetcher] Failed to authenticate client for ${connection.channel}`);
      return await getFallbackRates(connection, mapping, roomTypeId, dates);
    }

    // Fetch live rates from the OTA
    const liveRates = await client.getRates(dates.start, dates.end, [mapping.externalRoomId]);

    // Map OTA response to our standard format
    const entries: OTARateEntry[] = (liveRates || []).map((r: any) => ({
      connectionId,
      channelCode: connection.channel,
      channelName: connection.displayName || connection.channel,
      externalRoomId: r.externalRoomId || mapping.externalRoomId,
      externalRatePlanId: r.externalRatePlanId || '',
      date: r.date || '',
      baseRate: parseFloat(r.baseRate) || 0,
      currency: r.currency || 'USD',
      available: r.available !== false,
      source: 'live' as const,
      fetchedAt: new Date().toISOString(),
    }));

    // Cache the results
    rateCache.set(cacheKey, {
      key: cacheKey,
      rates: entries,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    // M-31 FIX: Also store as last-known-good data for fallback when future API calls fail
    if (entries.length > 0 && entries.some(e => e.baseRate > 0)) {
      lastKnownGoodCache.set(cacheKey, {
        key: cacheKey,
        rates: entries,
        expiresAt: Date.now() + LAST_KNOWN_GOOD_TTL_MS,
      });
    }

    return entries;
  } catch (error) {
    console.error(`[OTA Rate Fetcher] Error fetching rates for connection ${connectionId}:`, error);
    // M-31 FIX: Try last-known-good data before returning empty
    const lkg = lastKnownGoodCache.get(cacheKey);
    if (lkg && lkg.expiresAt > Date.now()) {
      // Mark entries as stale so callers know the data is not fresh
      const staleEntries = lkg.rates.map(e => ({ ...e, source: 'fallback' as const }));
      console.warn(`[OTA Rate Fetcher] Using stale last-known-good data for ${connectionId} (${cacheKey})`);
      return staleEntries;
    }
    return [];
  }
}

/**
 * Fetch live rates from ALL active channel connections for a property and room type.
 * Useful for parity checks that need rates from every connected channel.
 *
 * @param propertyId - The property ID
 * @param roomTypeId - The room type ID
 * @param dates - Start and end dates
 * @returns Array of rate entries from all channels
 */
export async function fetchLiveRatesFromAllChannels(
  propertyId: string,
  roomTypeId: string,
  dates: { start: Date; end: Date },
): Promise<OTARateEntry[]> {
  const connections = await db.channelConnection.findMany({
    where: { propertyId, status: 'active' },
  });

  const allRates: OTARateEntry[] = [];

  for (const connection of connections) {
    try {
      const rates = await fetchLiveRatesFromChannel(connection.id, roomTypeId, dates);
      allRates.push(...rates);
    } catch (error) {
      console.error(`[OTA Rate Fetcher] Failed to fetch from ${connection.channel}:`, error);
    }
  }

  return allRates;
}

/**
 * Get the best available rate (lowest live rate) across all channels for a
 * specific room type and date.
 *
 * @param propertyId - The property ID
 * @param roomTypeId - The room type ID
 * @param date - The specific date to check
 * @returns The lowest rate found, or null if no data available
 */
export async function getBestAvailableRate(
  propertyId: string,
  roomTypeId: string,
  date: Date,
): Promise<number | null> {
  const rates = await fetchLiveRatesFromAllChannels(propertyId, roomTypeId, {
    start: date,
    end: date,
  });

  const availableRates = rates.filter(r => r.available && r.baseRate > 0);
  if (availableRates.length === 0) return null;

  return Math.min(...availableRates.map(r => r.baseRate));
}

/**
 * Clear the rate cache (useful after rate updates are pushed).
 */
export function clearRateCache(connectionId?: string): void {
  if (connectionId) {
    // Clear all cache entries for this connection
    for (const [key, entry] of rateCache.entries()) {
      if (key.startsWith(connectionId)) {
        rateCache.delete(key);
      }
    }
    // M-31 FIX: Also clear last-known-good cache
    for (const [key, entry] of lastKnownGoodCache.entries()) {
      if (key.startsWith(connectionId)) {
        lastKnownGoodCache.delete(key);
      }
    }
  } else {
    // Clear all caches
    rateCache.clear();
    lastKnownGoodCache.clear();
  }
}

/**
 * Get the channel variance factor for fallback rate calculation.
 */
export function getChannelVarianceFactor(channelCode: string): number {
  return DEFAULT_VARIANCE_FACTORS[channelCode] ?? 1.0;
}

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Build a deterministic cache key from connection, room type, and dates.
 */
function buildCacheKey(
  connectionId: string,
  roomTypeId: string,
  dates: { start: Date; end: Date },
): string {
  const startStr = dates.start.toISOString().split('T')[0];
  const endStr = dates.end.toISOString().split('T')[0];
  return `${connectionId}:${roomTypeId}:${startStr}:${endStr}`;
}

/**
 * Generate fallback rates using PMS base rate with channel variance factor.
 * Used when live OTA rates cannot be fetched.
 */
async function getFallbackRates(
  connection: any,
  mapping: any,
  roomTypeId: string,
  dates: { start: Date; end: Date },
): Promise<OTARateEntry[]> {
  // Get the PMS base rate from the room type
  const roomType = await db.roomType.findFirst({
    where: { id: roomTypeId },
    select: { basePrice: true, currency: true },
  });

  const pmsBaseRate = roomType?.basePrice || 0;
  const currency = roomType?.currency || 'USD';
  const variance = DEFAULT_VARIANCE_FACTORS[connection.channel] ?? 1.0;

  const entries: OTARateEntry[] = [];
  const start = new Date(dates.start);
  const end = new Date(dates.end);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    entries.push({
      connectionId: connection.id,
      channelCode: connection.channel,
      channelName: connection.displayName || connection.channel,
      externalRoomId: mapping.externalRoomId,
      externalRatePlanId: mapping.externalRateId || '',
      date: d.toISOString().split('T')[0],
      baseRate: Math.round(pmsBaseRate * variance * 100) / 100,
      currency,
      available: true,
      source: 'fallback',
      fetchedAt: new Date().toISOString(),
    });
  }

  return entries;
}
