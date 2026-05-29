/**
 * Competitor Pricing Service
 * Fetches and analyzes competitor rates from various sources
 */

import { db } from '@/lib/db';

// Type definitions
export interface CompetitorRate {
  competitorId: string;
  competitorName: string;
  propertyId?: string;
  roomType?: string;
  date: Date;
  rate: number;
  currency: string;
  source: 'direct' | 'ota' | 'scraper' | 'api';
  collectedAt: Date;
  available: boolean;
  isDemoData?: boolean;
  restrictions?: {
    minStay?: number;
    maxStay?: number;
    closedToArrival?: boolean;
    closedToDeparture?: boolean;
  };
}

export interface CompetitorConfig {
  id: string;
  tenantId: string;
  name: string;
  type: 'hotel' | 'ota_listing';
  externalId?: string;
  sourceUrl?: string;
  propertyMapping?: Record<string, string>;
  enabled: boolean;
  lastCollected?: Date;
}

export interface MarketPosition {
  date: Date;
  yourRate: number;
  marketMin: number;
  marketMax: number;
  marketAvg: number;
  position: 'lowest' | 'below_avg' | 'average' | 'above_avg' | 'highest';
  rank: number;
  totalCompetitors: number;
}

// OTA endpoints for rate fetching
const OTA_ENDPOINTS: Record<string, string> = {
  booking: 'https://distribution-xml.booking.com/2.0/json/hotelRates',
  expedia: 'https://api.expediapartnersolutions.com/rates/v1/properties',
  agoda: 'https://api.agoda.com/v1/hotels/rates',
  hotels: 'https://api.hotels.com/rates',
};

/**
 * Fetch rates from Booking.com
 */
export async function fetchBookingRates(
  hotelId: string,
  checkIn: Date,
  checkOut: Date,
  credentials: { apiKey: string; apiSecret: string }
): Promise<CompetitorRate[]> {
  try {
    const response = await fetch(
      `${OTA_ENDPOINTS.booking}?hotel_ids=${hotelId}&checkin=${checkIn.toISOString().split('T')[0]}&checkout=${checkOut.toISOString().split('T')[0]}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Booking.com API returned ${response.status}: no rates available`);
      return [];
    }

    const data = await response.json();
    
    return (data.result || []).map((rate: Record<string, unknown>) => ({
      competitorId: hotelId,
      competitorName: rate.hotel_name as string || 'Unknown',
      date: new Date(rate.date as string),
      rate: (rate.price as number) || 0,
      currency: (rate.currency as string) || 'USD',
      source: 'ota',
      collectedAt: new Date(),
      available: (rate.available as boolean) !== false,
    }));
  } catch (error) {
    console.error('Error fetching Booking.com rates:', error);
    return [];
  }
}

/**
 * Fetch rates from Expedia
 */
export async function fetchExpediaRates(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  credentials: { apiKey: string }
): Promise<CompetitorRate[]> {
  try {
    const response = await fetch(
      `${OTA_ENDPOINTS.expedia}/${propertyId}/rates?checkIn=${checkIn.toISOString().split('T')[0]}&checkOut=${checkOut.toISOString().split('T')[0]}`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Expedia API returned ${response.status}: no rates available`);
      return [];
    }

    const data = await response.json();
    
    return (data.rates || []).map((rate: Record<string, unknown>) => ({
      competitorId: propertyId,
      competitorName: rate.propertyName as string || 'Unknown',
      date: new Date(rate.date as string),
      rate: (rate.nightlyRate as number) || 0,
      currency: (rate.currency as string) || 'USD',
      source: 'ota',
      collectedAt: new Date(),
      available: (rate.available as boolean) !== false,
    }));
  } catch (error) {
    console.error('Error fetching Expedia rates:', error);
    return [];
  }
}

// TODO: Integrate real competitor data sources. Replace the synthetic data generation
// below with actual scraping/parsing of competitor websites or third-party rate
// shopping APIs (e.g., STR, OTA Insight, RateGain). The current implementation
// derives fake prices from the property's own rate plans and OTA markup factors.
// To plug in a real data source, implement a new fetcher that calls the vendor API
// and return CompetitorRate[] with isDemoData set to false.

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

/** OTA-specific markup factors keyed by URL pattern */
const OTA_MARKUP: Record<string, number> = {
  booking_com: 1.15,
  booking:     1.15,
  expedia:     1.10,
  agoda:       1.08,
  hotels:      1.12,
  airbnb:      1.05,
  tripadvisor: 1.07,
};

const DEFAULT_OTA_MARKUP = 1.12;

/**
 * Whether to allow returning synthetic demo data when real competitor sources are unavailable.
 * Set the environment variable COMPETITOR_PRICING_ALLOW_DEMO=true to enable (default: false).
 * When disabled, the scraper returns an empty array instead of fabricated data.
 */
const ALLOW_DEMO_DATA = process.env.COMPETITOR_PRICING_ALLOW_DEMO === 'true';

/**
 * Fetch rates using web scraping (for competitors without API access).
 *
 * **DEMO DATA WARNING**: In the absence of a real headless browser / scraping service,
 * this function generates deterministic competitor rates derived from the property's
 * own rate plans combined with OTA-specific markup factors. Every returned rate is
 * flagged with `isDemoData: true` so consumers can display a watermark.
 *
 * When COMPETITOR_PRICING_ALLOW_DEMO is not set to "true", this function returns
 * an empty array — preventing fabricated data from influencing decisions.
 */
export async function scrapeCompetitorRates(
  url: string,
  checkIn: Date,
  checkOut: Date
): Promise<CompetitorRate[]> {
  if (!ALLOW_DEMO_DATA) {
    console.warn(
      '[competitor-pricing] Demo data generation is disabled (COMPETITOR_PRICING_ALLOW_DEMO != true). ' +
      'Returning empty results. Enable the env var or integrate a real competitor data source.'
    );
    return [];
  }

  console.warn(
    '[competitor-pricing] DEMO DATA: Generating synthetic competitor rates for %s — ' +
    'this data is NOT from a real competitor source and should not be used for pricing decisions.',
    url
  );

  try {
    // Derive markup from the URL pattern
    const urlLower = url.toLowerCase();
    let markupFactor = DEFAULT_OTA_MARKUP;
    for (const [pattern, factor] of Object.entries(OTA_MARKUP)) {
      if (urlLower.includes(pattern)) {
        markupFactor = factor;
        break;
      }
    }

    // Use the property's own rate plans as the base
    const ratePlans = await db.ratePlan.findMany({
      where: { deletedAt: null },
      select: { basePrice: true, roomType: { select: { name: true } } },
    });

    if (ratePlans.length === 0) {
      return [];
    }

    const avgBasePrice = ratePlans.reduce((sum, rp) => sum + rp.basePrice, 0) / ratePlans.length;

    // Generate a rate for each night in the date range
    const rates: CompetitorRate[] = [];
    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    for (let n = 0; n < nights; n++) {
      const nightDate = new Date(checkIn);
      nightDate.setDate(nightDate.getDate() + n);
      const dateStr = nightDate.toISOString().split('T')[0];

      const variation = dailyVariation(`${url}:${dateStr}`);
      const rate = parseFloat((avgBasePrice * markupFactor * (1 + variation)).toFixed(2));

      rates.push({
        competitorId: url,
        competitorName: new URL(url).hostname || url,
        date: nightDate,
        rate,
        currency: 'USD',
        source: 'scraper',
        collectedAt: new Date(),
        available: true,
        isDemoData: true,
      });
    }

    return rates;
  } catch (error) {
    console.error('Error scraping rates:', error);
    return [];
  }
}

/**
 * Fetch all competitor rates for a property
 */
export async function fetchAllCompetitorRates(
  tenantId: string,
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<CompetitorRate[]> {
  // Get competitor configurations
  const competitors = await db.competitorPrice.findMany({
    where: {
      tenantId,
      propertyId,
      date: { gte: startDate },
    },
    distinct: ['competitorName'],
  });

  const allRates: CompetitorRate[] = [];

  for (const competitor of competitors) {
    try {
      let rates: CompetitorRate[] = [];
      
      const bookingApiKey = process.env.BOOKING_API_KEY;
      const bookingApiSecret = process.env.BOOKING_API_SECRET;
      const expediaApiKey = process.env.EXPEDIA_API_KEY;

      if ((competitor.competitorUrl || '').includes('booking.com') && bookingApiKey && bookingApiSecret) {
        rates = await fetchBookingRates(
          competitor.id,
          startDate,
          endDate,
          { apiKey: bookingApiKey, apiSecret: bookingApiSecret }
        );
      } else if ((competitor.competitorUrl || '').includes('expedia') && expediaApiKey) {
        rates = await fetchExpediaRates(
          competitor.id,
          startDate,
          endDate,
          { apiKey: expediaApiKey }
        );
      } else if (competitor.competitorUrl) {
        rates = await scrapeCompetitorRates(competitor.competitorUrl, startDate, endDate);
      } else {
        console.warn(`No URL or credentials configured for competitor ${competitor.id} — skipping`);
      }

      allRates.push(...rates.map((r) => ({
        ...r,
        competitorId: competitor.id,
        competitorName: competitor.competitorName,
        isDemoData: r.isDemoData,
      })));

      if (rates.length > 0 && rates.some((r) => r.isDemoData)) {
        console.warn(
          '[competitor-pricing] DEMO DATA: %d rate(s) for competitor "%s" are synthetic.',
          rates.length,
          competitor.competitorName
        );
      }

      // No need to update lastCollected on CompetitorPrice — that's managed at write time
    } catch (error) {
      console.error(`Error fetching rates for competitor ${competitor.id}:`, error);
    }
  }

  // Save rates to database
  if (allRates.length > 0) {
    // Use individual creates since createMany may have constraints
    for (const r of allRates) {
      try {
        const dateKey = r.date instanceof Date ? r.date : new Date(r.date);
        await db.competitorPrice.upsert({
          where: {
            propertyId_competitorName_date: {
              propertyId,
              competitorName: r.competitorName,
              date: dateKey,
            },
          },
          update: {
            price: r.rate,
            currency: r.currency,
            source: r.source,
          },
          create: {
            tenantId,
            competitorName: r.competitorName,
            propertyId,
            date: dateKey,
            price: r.rate,
            currency: r.currency,
            source: r.source,
          },
        });
      } catch (error) {
        console.error(`Error upserting competitor rate for ${r.competitorName} on ${r.date}:`, error);
      }
    }
  }

  return allRates;
}

/**
 * Calculate market position
 */
export async function calculateMarketPosition(
  tenantId: string,
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<MarketPosition[]> {
  // Get your property's rates
  const yourRates = await db.priceOverride.findMany({
    where: {
      ratePlan: {
        roomType: { propertyId },
      },
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const competitorRates = await db.competitorPrice.findMany({
    where: {
      tenantId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Group by date
  const positions: MarketPosition[] = [];
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    
    const yourRate = yourRates.find((r) => 
      r.date.toISOString().split('T')[0] === dateStr
    );
    
    const dayCompetitorRates = competitorRates.filter((r) =>
      r.date.toISOString().split('T')[0] === dateStr
    );

    if (dayCompetitorRates.length === 0) continue;

    const competitorRateValues = dayCompetitorRates.map((r) => r.price);
    const marketMin = Math.min(...competitorRateValues);
    const marketMax = Math.max(...competitorRateValues);
    const marketAvg = competitorRateValues.reduce((a, b) => a + b, 0) / competitorRateValues.length;

    const yourRateValue = yourRate?.price || marketAvg;
    
    // Calculate position
    let position: MarketPosition['position'];
    if (yourRateValue <= marketMin) {
      position = 'lowest';
    } else if (yourRateValue >= marketMax) {
      position = 'highest';
    } else if (yourRateValue < marketAvg * 0.95) {
      position = 'below_avg';
    } else if (yourRateValue > marketAvg * 1.05) {
      position = 'above_avg';
    } else {
      position = 'average';
    }

    // Calculate rank
    const allRates = [...competitorRateValues, yourRateValue].sort((a, b) => a - b);
    const rank = allRates.indexOf(yourRateValue) + 1;

    positions.push({
      date: new Date(d),
      yourRate: yourRateValue,
      marketMin,
      marketMax,
      marketAvg,
      position,
      rank,
      totalCompetitors: dayCompetitorRates.length,
    });
  }

  return positions;
}

/**
 * Get pricing recommendations based on market position
 */
export async function getPricingRecommendations(
  tenantId: string,
  propertyId: string,
  daysAhead: number = 30
): Promise<Array<{
  date: Date;
  currentRate: number;
  recommendedRate: number;
  change: number;
  reason: string;
  confidence: number;
}>> {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysAhead);

  const positions = await calculateMarketPosition(tenantId, propertyId, startDate, endDate);
  
  return positions.map((pos) => {
    let recommendedRate = pos.yourRate;
    let reason = 'Current rate is optimal';
    let confidence = 0.8;

    switch (pos.position) {
      case 'highest':
        // Suggest lowering rate
        recommendedRate = pos.marketAvg * 1.02;
        reason = 'Rate is highest in market. Consider reducing to improve occupancy.';
        confidence = 0.85;
        break;
      case 'above_avg':
        // Slight adjustment
        recommendedRate = pos.marketAvg * 1.0;
        reason = 'Rate is above market average. Consider matching market rate.';
        confidence = 0.7;
        break;
      case 'lowest':
        // Opportunity to increase
        recommendedRate = pos.marketAvg * 0.95;
        reason = 'Rate is lowest in market. Opportunity to increase slightly.';
        confidence = 0.75;
        break;
      case 'below_avg':
        // Good position, minor adjustment
        recommendedRate = pos.marketAvg * 0.98;
        reason = 'Competitive rate. Consider slight increase to test demand.';
        confidence = 0.65;
        break;
      case 'average':
      default:
        // Maintain or optimize
        reason = 'Rate is at market average. Monitor competitor movements.';
        confidence = 0.6;
        break;
    }

    return {
      date: pos.date,
      currentRate: pos.yourRate,
      recommendedRate: Math.round(recommendedRate),
      change: Math.round(recommendedRate - pos.yourRate),
      reason,
      confidence,
    };
  });
}
