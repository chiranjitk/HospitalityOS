/**
 * Unified Rate Fetcher Service
 *
 * Fetches competitor rates from real sources with a layered strategy:
 * 1. OTA Client — uses existing OTA client infrastructure for connected channels
 * 2. Third-Party API — OTA Insight / STR / RateGain subscription integrations
 * 3. Synthetic fallback — ONLY when COMPETITOR_PRICING_ALLOW_DEMO=true
 *
 * Every result is tagged with a `source` field: 'real' | 'synthetic' | 'imported'
 * so the UI can transparently display data provenance.
 */

import { db } from '@/lib/db';
import { OTAClientFactory } from '@/lib/ota/client-factory';
import { OTACredentials } from '@/lib/ota/types';

// ============================================
// TYPES
// ============================================

export type FetchStrategy = 'ota_client' | 'third_party' | 'synthetic' | 'manual';
export type RateSource = 'real' | 'synthetic' | 'imported';

export interface FetchedRate {
  competitorId: string;
  competitorName: string;
  channel: string;
  checkIn: Date;
  checkOut: Date;
  roomTypeId?: string;
  roomTypeName?: string;
  rate: number;
  currency: string;
  source: RateSource;
  isDemo: boolean;
  fetchStrategy: FetchStrategy;
  available: boolean;
  fetchedAt: Date;
  restrictions?: {
    minStay?: number;
    maxStay?: number;
    closedToArrival?: boolean;
    closedToDeparture?: boolean;
  };
}

export interface FetchResultSummary {
  total: number;
  real: number;
  synthetic: number;
  imported: number;
  failed: number;
  strategies: Record<FetchStrategy, number>;
  competitors: string[];
  fetchedAt: Date;
}

interface ChannelConnectionRow {
  id: string;
  channel: string;
  displayName: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  username: string | null;
  password: string | null;
  clientId: string | null;
  clientSecret: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  hotelId: string | null;
  propertyId: string | null;
  credentials: string | null;
  status: string;
}

interface CompetitorRow {
  id: string;
  tenantId: string;
  name: string;
  channel: string;
  propertyId: string | null;
  url: string | null;
  isActive: boolean;
}

// ============================================
// CONFIGURATION
// ============================================

/** Whether synthetic demo data is allowed as a last resort */
const ALLOW_DEMO_DATA = process.env.COMPETITOR_PRICING_ALLOW_DEMO === 'true';

/** Third-party API credentials */
const OTA_INSIGHT_API_KEY = process.env.OTA_INSIGHT_API_KEY;
const OTA_INSIGHT_ENDPOINT = process.env.OTA_INSIGHT_ENDPOINT || 'https://api.otainsight.com/v2';
const STR_API_KEY = process.env.STR_API_KEY;
const STR_ENDPOINT = process.env.STR_ENDPOINT || 'https://api.str.com/v1';
const RATEGAIN_API_KEY = process.env.RATEGAIN_API_KEY;
const RATEGAIN_ENDPOINT = process.env.RATEGAIN_ENDPOINT || 'https://api.rategain.com/v2';

/**
 * OTA-specific markup factors for synthetic fallback.
 * These can be overridden via COMPETITOR_MARKUP_* env vars (e.g. COMPETITOR_MARKUP_BOOKING_COM=1.15)
 * or via a JSON string COMPETITOR_MARKUP_MAP='{"booking_com":1.15,"expedia":1.10}'
 */
const ENV_MARKUP_MAP = process.env.COMPETITOR_MARKUP_MAP;
let OTA_MARKUP: Record<string, number> = {};
if (ENV_MARKUP_MAP) {
  try {
    OTA_MARKUP = JSON.parse(ENV_MARKUP_MAP);
    console.log('[rate-fetcher] Loaded OTA markup overrides from COMPETITOR_MARKUP_MAP env var');
  } catch {
    console.error('[rate-fetcher] Failed to parse COMPETITOR_MARKUP_MAP, using defaults');
  }
}
if (Object.keys(OTA_MARKUP).length === 0) {
  OTA_MARKUP = {
    booking_com: parseFloat(process.env.COMPETITOR_MARKUP_BOOKING_COM || '1.15'),
    booking: parseFloat(process.env.COMPETITOR_MARKUP_BOOKING || '1.15'),
    expedia: parseFloat(process.env.COMPETITOR_MARKUP_EXPEDIA || '1.10'),
    agoda: parseFloat(process.env.COMPETITOR_MARKUP_AGODA || '1.08'),
    hotels_com: parseFloat(process.env.COMPETITOR_MARKUP_HOTELS_COM || '1.12'),
    hotels: parseFloat(process.env.COMPETITOR_MARKUP_HOTELS || '1.12'),
    airbnb: parseFloat(process.env.COMPETITOR_MARKUP_AIRBNB || '1.05'),
    tripadvisor: parseFloat(process.env.COMPETITOR_MARKUP_TRIPADVISOR || '1.07'),
    direct: parseFloat(process.env.COMPETITOR_MARKUP_DIRECT || '0.95'),
    corporate: parseFloat(process.env.COMPETITOR_MARKUP_CORPORATE || '0.90'),
    walk_in: parseFloat(process.env.COMPETITOR_MARKUP_WALK_IN || '1.00'),
  };
}
const DEFAULT_OTA_MARKUP = parseFloat(process.env.COMPETITOR_MARKUP_DEFAULT || '1.12');

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Fetch competitor rates for a set of competitors, determining the best fetch
 * strategy for each and returning results ready for storage in RateShoppingResult.
 *
 * @param tenantId  - The tenant (hotel) requesting the data
 * @param propertyId - The property to compare against
 * @param competitors - Array of competitor records from RateShoppingCompetitor or CompSetMember
 * @param dateRange - { checkIn, checkOut }
 * @param roomTypeIds - Optional: specific room types to query
 */
export async function fetchCompetitorRates(
  tenantId: string,
  propertyId: string,
  competitors: CompetitorRow[],
  dateRange: { checkIn: Date; checkOut: Date },
  roomTypeIds?: string[],
): Promise<FetchedRate[]> {
  // Get all active channel connections for this tenant (to check OTA client availability)
  const connections = await db.channelConnection.findMany({
    where: { tenantId, status: 'active' },
    select: {
      id: true, channel: true, displayName: true,
      apiKey: true, apiSecret: true, username: true, password: true,
      clientId: true, clientSecret: true, accessToken: true, refreshToken: true,
      hotelId: true, propertyId: true, credentials: true, status: true,
    },
  }) as ChannelConnectionRow[];

  // Get our property's own rates for parity calculation
  const ourRatePlans = await db.ratePlan.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, basePrice: true, roomTypeId: true, roomType: { select: { name: true } } },
  });
  const ourAvgRate = ourRatePlans.length > 0
    ? ourRatePlans.reduce((sum, rp) => sum + rp.basePrice, 0) / ourRatePlans.length
    : 150;

  const allRates: FetchedRate[] = [];
  const activeCompetitors = competitors.filter(c => c.isActive !== false);

  for (const competitor of activeCompetitors) {
    try {
      const strategy = getFetchStrategy(competitor, connections);
      let rates: FetchedRate[] = [];

      switch (strategy) {
        case 'ota_client':
          rates = await fetchViaOTAClient(competitor, connections, dateRange, ourAvgRate);
          break;
        case 'third_party':
          rates = await fetchViaThirdPartyAPI(tenantId, competitor, dateRange, ourAvgRate);
          break;
        case 'synthetic':
          rates = await generateSyntheticRates(competitor, ourAvgRate, dateRange);
          break;
        case 'manual':
          // Manual competitors don't have auto-fetch; skip
          console.log(`[rate-fetcher] Skipping manual competitor: ${competitor.name}`);
          continue;
      }

      allRates.push(...rates);
    } catch (error) {
      console.error(`[rate-fetcher] Error fetching rates for competitor ${competitor.name}:`, error);
    }
  }

  return allRates;
}

// ============================================
// STRATEGY RESOLVER
// ============================================

/**
 * Determine the best fetch strategy for a competitor.
 * Priority: OTA client > third-party API > synthetic fallback > manual (no auto-fetch)
 */
export function getFetchStrategy(
  competitor: { channel: string; url?: string | null; propertyId?: string | null },
  connections: ChannelConnectionRow[],
): FetchStrategy {
  // Check if we have an active OTA connection for this channel
  const channelLower = competitor.channel.toLowerCase();
  const matchingConnection = connections.find((conn) => {
    const connLower = conn.channel.toLowerCase();
    return channelLower === connLower ||
      channelLower.includes(connLower) ||
      connLower.includes(channelLower);
  });

  if (matchingConnection) {
    return 'ota_client';
  }

  // Check if we have third-party API credentials configured
  if (hasThirdPartyCredentials()) {
    return 'third_party';
  }

  // Check if synthetic data is allowed
  if (ALLOW_DEMO_DATA) {
    return 'synthetic';
  }

  // No real source available, synthetic disabled — manual only
  return 'manual';
}

function hasThirdPartyCredentials(): boolean {
  return !!(OTA_INSIGHT_API_KEY || STR_API_KEY || RATEGAIN_API_KEY);
}

// ============================================
// OTA CLIENT FETCHING
// ============================================

/**
 * Fetch rates using the existing OTA client infrastructure.
 * Uses OTAClientFactory to create authenticated clients for connected channels.
 */
async function fetchViaOTAClient(
  competitor: CompetitorRow,
  connections: ChannelConnectionRow[],
  dateRange: { checkIn: Date; checkOut: Date },
  ourAvgRate: number,
): Promise<FetchedRate[]> {
  const channelLower = competitor.channel.toLowerCase();
  const connection = connections.find((conn) => {
    const connLower = conn.channel.toLowerCase();
    return channelLower === connLower ||
      channelLower.includes(connLower) ||
      connLower.includes(channelLower);
  });

  if (!connection) {
    // Shouldn't happen if strategy resolution worked, but fallback gracefully
    return generateSyntheticRates(competitor, ourAvgRate, dateRange);
  }

  // Build credentials from the connection record
  let credentials: Record<string, unknown> = {};
  if (connection.credentials) {
    try {
      credentials = JSON.parse(connection.credentials);
    } catch {
      credentials = {};
    }
  }

  // Merge direct credential fields
  const otaCredentials: OTACredentials = {
    apiKey: (credentials.apiKey as string) || connection.apiKey || undefined,
    apiSecret: (credentials.apiSecret as string) || connection.apiSecret || undefined,
    username: (credentials.username as string) || connection.username || undefined,
    password: (credentials.password as string) || connection.password || undefined,
    clientId: (credentials.clientId as string) || connection.clientId || undefined,
    clientSecret: (credentials.clientSecret as string) || connection.clientSecret || undefined,
    accessToken: (credentials.accessToken as string) || connection.accessToken || undefined,
    refreshToken: (credentials.refreshToken as string) || connection.refreshToken || undefined,
    hotelId: (credentials.hotelId as string) || connection.hotelId || undefined,
    propertyId: (credentials.propertyId as string) || connection.propertyId || undefined,
  };

  try {
    const client = await OTAClientFactory.getAuthenticatedClient(connection.channel, otaCredentials);

    if (!client) {
      console.warn(`[rate-fetcher] Failed to create OTA client for ${connection.channel}, falling back to synthetic`);
      return generateSyntheticRates(competitor, ourAvgRate, dateRange);
    }

    // Fetch live rates from the OTA
    const liveRates = await client.getRates(dateRange.checkIn, dateRange.checkOut);

    if (!liveRates || liveRates.length === 0) {
      console.warn(`[rate-fetcher] No rates returned from ${connection.channel} for ${competitor.name}`);
      return generateSyntheticRates(competitor, ourAvgRate, dateRange);
    }

    // Map OTA response to our standard format
    return liveRates.map((r) => {
      const rate = parseFloat(String(r.baseRate)) || 0;
      const checkIn = r.date ? parseFlexDate(r.date) : dateRange.checkIn;
      // Default to next day for checkOut if we only have a single date
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 1);

      return {
        competitorId: competitor.id,
        competitorName: competitor.name,
        channel: competitor.channel,
        checkIn,
        checkOut,
        rate,
        currency: r.currency || 'USD',
        source: 'real' as RateSource,
        isDemo: false,
        fetchStrategy: 'ota_client' as FetchStrategy,
        available: r.available !== false,
        fetchedAt: new Date(),
        restrictions: undefined, // OTA restrictions would need additional API calls
      };
    });
  } catch (error) {
    console.error(`[rate-fetcher] OTA client error for ${connection.channel}:`, error);
    // Fallback to synthetic if allowed
    return generateSyntheticRates(competitor, ourAvgRate, dateRange);
  }
}

// ============================================
// THIRD-PARTY API FETCHING
// ============================================

/**
 * Fetch rates from third-party rate shopping APIs.
 * Currently supports: OTA Insight, STR (Smith Travel Research), RateGain.
 * These are industry-standard rate shopping services that require subscriptions.
 */
async function fetchViaThirdPartyAPI(
  tenantId: string,
  competitor: CompetitorRow,
  dateRange: { checkIn: Date; checkOut: Date },
  ourAvgRate: number,
): Promise<FetchedRate[]> {
  // Try each provider that has credentials configured
  if (OTA_INSIGHT_API_KEY) {
    const rates = await fetchViaOTAInsight(competitor, dateRange);
    if (rates.length > 0) return rates;
  }

  if (STR_API_KEY) {
    const rates = await fetchViaSTR(competitor, dateRange);
    if (rates.length > 0) return rates;
  }

  if (RATEGAIN_API_KEY) {
    const rates = await fetchViaRateGain(competitor, dateRange);
    if (rates.length > 0) return rates;
  }

  // All third-party APIs failed or not configured — fall back to synthetic if allowed
  console.warn(
    `[rate-fetcher] No third-party API returned data for ${competitor.name}, ` +
    `falling back to synthetic (ALLOW_DEMO_DATA=${ALLOW_DEMO_DATA})`
  );
  return generateSyntheticRates(competitor, ourAvgRate, dateRange);
}

/**
 * OTA Insight integration.
 * OTA Insight is a leading rate shopping platform with broad hotel coverage.
 */
async function fetchViaOTAInsight(
  competitor: CompetitorRow,
  dateRange: { checkIn: Date; checkOut: Date },
): Promise<FetchedRate[]> {
  try {
    const checkInStr = dateRange.checkIn.toISOString().split('T')[0];
    const checkOutStr = dateRange.checkOut.toISOString().split('T')[0];

    const response = await fetch(
      `${OTA_INSIGHT_ENDPOINT}/rate-shopping/competitor-rates`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OTA_INSIGHT_API_KEY}`,
          'User-Agent': 'StaySuite-RateFetcher/1.0',
        },
        body: JSON.stringify({
          competitorId: competitor.id,
          competitorName: competitor.name,
          channel: competitor.channel,
          checkIn: checkInStr,
          checkOut: checkOutStr,
        }),
        signal: AbortSignal.timeout(30000),
      },
    );

    if (!response.ok) {
      console.warn(`[rate-fetcher] OTA Insight API returned ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.rates || []).map((r: Record<string, unknown>) => ({
      competitorId: competitor.id,
      competitorName: competitor.name,
      channel: competitor.channel,
      checkIn: new Date(r.checkIn as string),
      checkOut: new Date(r.checkOut as string),
      rate: parseFloat(String(r.rate)) || 0,
      currency: (r.currency as string) || 'USD',
      source: 'real' as RateSource,
      isDemo: false,
      fetchStrategy: 'third_party' as FetchStrategy,
      available: (r.available as boolean) !== false,
      fetchedAt: new Date(),
    }));
  } catch (error) {
    console.error('[rate-fetcher] OTA Insight API error:', error);
    return [];
  }
}

/**
 * STR (Smith Travel Research) integration.
 * STR provides competitive benchmarking data for the hospitality industry.
 */
async function fetchViaSTR(
  competitor: CompetitorRow,
  dateRange: { checkIn: Date; checkOut: Date },
): Promise<FetchedRate[]> {
  try {
    const checkInStr = dateRange.checkIn.toISOString().split('T')[0];
    const checkOutStr = dateRange.checkOut.toISOString().split('T')[0];

    const response = await fetch(
      `${STR_ENDPOINT}/competitive-data`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': STR_API_KEY!,
          'User-Agent': 'StaySuite-RateFetcher/1.0',
        },
        body: JSON.stringify({
          competitorName: competitor.name,
          channel: competitor.channel,
          checkIn: checkInStr,
          checkOut: checkOutStr,
        }),
        signal: AbortSignal.timeout(30000),
      },
    );

    if (!response.ok) {
      console.warn(`[rate-fetcher] STR API returned ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.competitiveRates || []).map((r: Record<string, unknown>) => ({
      competitorId: competitor.id,
      competitorName: competitor.name,
      channel: competitor.channel,
      checkIn: new Date(r.date as string),
      checkOut: new Date(r.date as string),
      rate: parseFloat(String(r.adr)) || 0,
      currency: (r.currency as string) || 'USD',
      source: 'real' as RateSource,
      isDemo: false,
      fetchStrategy: 'third_party' as FetchStrategy,
      available: true,
      fetchedAt: new Date(),
    }));
  } catch (error) {
    console.error('[rate-fetcher] STR API error:', error);
    return [];
  }
}

/**
 * RateGain integration.
 * RateGain is a rate shopping and distribution intelligence platform.
 */
async function fetchViaRateGain(
  competitor: CompetitorRow,
  dateRange: { checkIn: Date; checkOut: Date },
): Promise<FetchedRate[]> {
  try {
    const checkInStr = dateRange.checkIn.toISOString().split('T')[0];
    const checkOutStr = dateRange.checkOut.toISOString().split('T')[0];

    const response = await fetch(
      `${RATEGAIN_ENDPOINT}/rate-shopping`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': RATEGAIN_API_KEY!,
          'User-Agent': 'StaySuite-RateFetcher/1.0',
        },
        body: JSON.stringify({
          competitorId: competitor.id,
          channel: competitor.channel,
          checkIn: checkInStr,
          checkOut: checkOutStr,
        }),
        signal: AbortSignal.timeout(30000),
      },
    );

    if (!response.ok) {
      console.warn(`[rate-fetcher] RateGain API returned ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.rates || []).map((r: Record<string, unknown>) => ({
      competitorId: competitor.id,
      competitorName: competitor.name,
      channel: competitor.channel,
      checkIn: new Date(r.checkIn as string),
      checkOut: new Date(r.checkOut as string),
      rate: parseFloat(String(r.rate)) || 0,
      currency: (r.currency as string) || 'USD',
      source: 'real' as RateSource,
      isDemo: false,
      fetchStrategy: 'third_party' as FetchStrategy,
      available: (r.available as boolean) !== false,
      fetchedAt: new Date(),
    }));
  } catch (error) {
    console.error('[rate-fetcher] RateGain API error:', error);
    return [];
  }
}

// ============================================
// SYNTHETIC FALLBACK
// ============================================

/**
 * Generate deterministic synthetic rates as a LAST RESORT.
 * Only called when no real data source is available AND COMPETITOR_PRICING_ALLOW_DEMO=true.
 * All results are marked with source: 'synthetic' and isDemo: true.
 */
async function generateSyntheticRates(
  competitor: CompetitorRow,
  baseRate: number,
  dateRange: { checkIn: Date; checkOut: Date },
): Promise<FetchedRate[]> {
  if (!ALLOW_DEMO_DATA) {
    console.warn(
      `[rate-fetcher] No real data source for competitor "${competitor.name}". ` +
      `Configure OTA Insight/STR/RateGain API credentials or set COMPETITOR_PRICING_ALLOW_DEMO=true ` +
      `for synthetic fallback (NOT recommended for production).`
    );
    // Return empty — never silently produce fake data in production
    return [];
  }

  console.warn(
    `[rate-fetcher] ⚠️  SYNTHETIC DATA for "${competitor.name}" — this is NOT real competitor data. ` +
    `Set COMPETITOR_PRICING_ALLOW_DEMO=false to disable.`
  );

  // Determine markup factor based on channel
  const channelLower = competitor.channel.toLowerCase();
  let markupFactor = DEFAULT_OTA_MARKUP;
  for (const [pattern, factor] of Object.entries(OTA_MARKUP)) {
    if (channelLower.includes(pattern)) {
      markupFactor = factor;
      break;
    }
  }
  // Also check URL
  if (competitor.url) {
    const urlLower = competitor.url.toLowerCase();
    for (const [pattern, factor] of Object.entries(OTA_MARKUP)) {
      if (urlLower.includes(pattern)) {
        markupFactor = factor;
        break;
      }
    }
  }

  const nights = Math.max(1, Math.ceil(
    (dateRange.checkOut.getTime() - dateRange.checkIn.getTime()) / (1000 * 60 * 60 * 24)
  ));

  const rates: FetchedRate[] = [];

  for (let n = 0; n < nights; n++) {
    const nightDate = new Date(dateRange.checkIn);
    nightDate.setDate(nightDate.getDate() + n);

    const nextDay = new Date(nightDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const variation = dailyVariation(`${competitor.id}:${nightDate.toISOString().split('T')[0]}`);
    const rate = parseFloat((baseRate * markupFactor * (1 + variation)).toFixed(2));

    rates.push({
      competitorId: competitor.id,
      competitorName: competitor.name,
      channel: competitor.channel,
      checkIn: nightDate,
      checkOut: nextDay,
      rate,
      currency: 'USD',
      source: 'synthetic',
      isDemo: true,
      fetchStrategy: 'synthetic',
      available: true,
      fetchedAt: new Date(),
    });
  }

  return rates;
}

// ============================================
// DUAL STORAGE
// ============================================

/**
 * Store fetched rates in BOTH:
 * - RateShoppingResult (new system) — with parity calculation
 * - CompetitorPrice (legacy compatibility) — for existing consumers
 *
 * Returns a summary of what was stored.
 */
export async function storeFetchedRates(
  tenantId: string,
  propertyId: string,
  rates: FetchedRate[],
): Promise<FetchResultSummary> {
  const summary: FetchResultSummary = {
    total: 0,
    real: 0,
    synthetic: 0,
    imported: 0,
    failed: 0,
    strategies: { ota_client: 0, third_party: 0, synthetic: 0, manual: 0 },
    competitors: [],
    fetchedAt: new Date(),
  };

  if (rates.length === 0) return summary;

  // Calculate our property's average rate for parity
  const ourRatePlans = await db.ratePlan.findMany({
    where: { tenantId, deletedAt: null },
    select: { basePrice: true },
  });
  const ourAvgRate = ourRatePlans.length > 0
    ? ourRatePlans.reduce((sum, rp) => sum + rp.basePrice, 0) / ourRatePlans.length
    : 0;

  for (const rate of rates) {
    try {
      // Calculate parity status
      let parityStatus = 'unknown';
      let rateDifference = 0;
      if (ourAvgRate > 0) {
        rateDifference = rate.rate - ourAvgRate;
        const pctDiff = rateDifference / ourAvgRate;
        if (Math.abs(pctDiff) <= 0.03) {
          parityStatus = 'parity';
        } else if (pctDiff < 0) {
          parityStatus = 'below';
        } else {
          parityStatus = 'above';
        }
      }

      // Store in RateShoppingResult (new system)
      await db.rateShoppingResult.create({
        data: {
          tenantId,
          competitorId: rate.competitorId,
          roomTypeId: rate.roomTypeId || null,
          checkIn: rate.checkIn,
          checkOut: rate.checkOut,
          competitorRate: rate.rate,
          ourRate: ourAvgRate,
          parityStatus,
          rateDifference,
          currency: rate.currency,
          fetchedAt: rate.fetchedAt,
        },
      });

      // Store in CompetitorPrice (legacy compatibility)
      // Use the checkIn date as the legacy "date" field
      await db.competitorPrice.upsert({
        where: {
          propertyId_competitorName_date: {
            propertyId,
            competitorName: rate.competitorName,
            date: rate.checkIn,
          },
        },
        create: {
          tenantId,
          propertyId,
          competitorName: rate.competitorName,
          competitorType: rate.channel,
          date: rate.checkIn,
          price: rate.rate,
          currency: rate.currency,
          roomTypeId: rate.roomTypeId || null,
          roomTypeName: rate.roomTypeName || null,
          source: `${rate.fetchStrategy}:${rate.source}`,
        },
        update: {
          price: rate.rate,
          currency: rate.currency,
          source: `${rate.fetchStrategy}:${rate.source}`,
        },
      });

      // Update summary
      summary.total++;
      summary.strategies[rate.fetchStrategy]++;
      if (rate.source === 'real') summary.real++;
      else if (rate.source === 'synthetic') summary.synthetic++;
      else if (rate.source === 'imported') summary.imported++;

      if (!summary.competitors.includes(rate.competitorName)) {
        summary.competitors.push(rate.competitorName);
      }
    } catch (error) {
      console.error(
        `[rate-fetcher] Error storing rate for ${rate.competitorName} on ${rate.checkIn}:`,
        error,
      );
      summary.failed++;
    }
  }

  return summary;
}

// ============================================
// HELPERS
// ============================================

/**
 * Deterministic daily variation from a seed string.
 * Maps to [-0.05, +0.05] so the same competitor+date always yields the same tweak.
 */
function dailyVariation(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return ((hash % 1000) / 1000) * 0.10 - 0.05;
}

/**
 * Parse a date that might be a Date, string (YYYY-MM-DD), or ISO string.
 */
function parseFlexDate(d: string | Date): Date {
  if (d instanceof Date) return d;
  const str = String(d);
  // Handle YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(`${str}T00:00:00.000Z`);
  }
  return new Date(str);
}

/**
 * Fetch all active RateShoppingCompetitors for a tenant, optionally filtered by property.
 */
export async function getActiveCompetitors(tenantId: string, propertyId?: string): Promise<CompetitorRow[]> {
  return db.rateShoppingCompetitor.findMany({
    where: {
      tenantId,
      ...(propertyId ? { propertyId } : {}),
      isActive: true,
    },
  }) as Promise<CompetitorRow[]>;
}

/**
 * Fetch all active CompetitiveSet members across a tenant's active sets.
 */
export async function getCompSetMembers(tenantId: string, propertyId?: string): Promise<CompetitorRow[]> {
  const sets = await db.competitiveSet.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(propertyId ? { propertyId } : {}),
    },
    include: {
      members: {
        where: { isActive: true },
      },
    },
  });

  return sets.flatMap((set) =>
    set.members.map((member) => ({
      id: member.id,
      tenantId: member.tenantId,
      name: member.hotelName,
      channel: member.channel,
      propertyId: null,
      url: member.url,
      isActive: member.isActive,
    })),
  );
}
