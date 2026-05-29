/**
 * Competitor Pricing Service
 * Fetches and analyzes competitor rates using the unified rate-fetcher service.
 *
 * This module wraps the rate-fetcher for backward compatibility with existing
 * consumers (fetchAllCompetitorRates, calculateMarketPosition, etc.) and
 * exposes market analysis functions.
 */

import { db } from '@/lib/db';
import {
  fetchCompetitorRates,
  storeFetchedRates,
  getActiveCompetitors,
  type FetchedRate,
  type FetchStrategy,
} from '@/lib/revenue/rate-fetcher';

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
  fetchStrategy?: FetchStrategy;
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
  position: 'lowest' | 'below_avg' | 'average' | 'above_avg' | 'highest' | 'no_data';
  rank: number;
  totalCompetitors: number;
}

/**
 * Fetch all competitor rates for a property using the unified rate-fetcher.
 * Stores results in both RateShoppingResult and CompetitorPrice.
 */
export async function fetchAllCompetitorRates(
  tenantId: string,
  propertyId: string,
  startDate: Date,
  endDate: Date,
): Promise<CompetitorRate[]> {
  // Get active competitors from the new RateShoppingCompetitor table
  const competitors = await getActiveCompetitors(tenantId, propertyId);

  if (competitors.length === 0) {
    // Fall back to legacy CompetitorPrice distinct names
    return fetchLegacyCompetitorRates(tenantId, propertyId, startDate, endDate);
  }

  const dateRange = { checkIn: startDate, checkOut: endDate };

  // Fetch rates using the unified service
  const fetchedRates = await fetchCompetitorRates(tenantId, propertyId, competitors, dateRange);

  // Store in both tables
  await storeFetchedRates(tenantId, propertyId, fetchedRates);

  // Map to legacy CompetitorRate format for backward compatibility
  return fetchedRates.map((r) => ({
    competitorId: r.competitorId,
    competitorName: r.competitorName,
    propertyId,
    roomType: r.roomTypeName || undefined,
    date: r.checkIn,
    rate: r.rate,
    currency: r.currency,
    source: 'api' as const,
    collectedAt: r.fetchedAt,
    available: r.available,
    isDemoData: r.isDemo,
    fetchStrategy: r.fetchStrategy,
  }));
}

/**
 * Legacy path: fetch competitor rates for properties that only use the old
 * CompetitorPrice table (no RateShoppingCompetitor entries).
 */
async function fetchLegacyCompetitorRates(
  tenantId: string,
  propertyId: string,
  startDate: Date,
  endDate: Date,
): Promise<CompetitorRate[]> {
  const competitors = await db.competitorPrice.findMany({
    where: {
      tenantId,
      propertyId,
      date: { gte: startDate },
    },
    distinct: ['competitorName'],
  });

  if (competitors.length === 0) return [];

  // Build mock competitor objects for the rate fetcher
  const mockCompetitors = competitors.map((c) => ({
    id: c.id,
    tenantId,
    name: c.competitorName,
    channel: c.competitorType || c.source || 'direct',
    propertyId: null as string | null,
    url: c.competitorUrl || null,
    isActive: true,
  }));

  const dateRange = { checkIn: startDate, checkOut: endDate };
  const fetchedRates = await fetchCompetitorRates(tenantId, propertyId, mockCompetitors, dateRange);

  // Store in both tables
  await storeFetchedRates(tenantId, propertyId, fetchedRates);

  return fetchedRates.map((r) => ({
    competitorId: r.competitorId,
    competitorName: r.competitorName,
    propertyId,
    roomType: undefined,
    date: r.checkIn,
    rate: r.rate,
    currency: r.currency,
    source: 'api' as const,
    collectedAt: r.fetchedAt,
    available: r.available,
    isDemoData: r.isDemo,
    fetchStrategy: r.fetchStrategy,
  }));
}

/**
 * Calculate market position
 * Returns 'no_data' when no own rate exists instead of using market average
 */
export async function calculateMarketPosition(
  tenantId: string,
  propertyId: string,
  startDate: Date,
  endDate: Date,
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

  // Also try getting rates from rate plans directly if no overrides
  let baseRatePlans = await db.ratePlan.findMany({
    where: {
      roomType: { propertyId },
      deletedAt: null,
    },
    select: { basePrice: true },
  });
  const defaultRate = baseRatePlans.length > 0
    ? baseRatePlans.reduce((sum, rp) => sum + rp.basePrice, 0) / baseRatePlans.length
    : 0;

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
      r.date.toISOString().split('T')[0] === dateStr,
    );

    const dayCompetitorRates = competitorRates.filter((r) =>
      r.date.toISOString().split('T')[0] === dateStr,
    );

    if (dayCompetitorRates.length === 0) {
      // No competitor data for this date — only emit if we have own rate
      if (yourRate) {
        positions.push({
          date: new Date(d),
          yourRate: yourRate.price,
          marketMin: 0,
          marketMax: 0,
          marketAvg: 0,
          position: 'no_data',
          rank: 0,
          totalCompetitors: 0,
        });
      }
      continue;
    }

    const competitorRateValues = dayCompetitorRates.map((r) => r.price);
    const marketMin = Math.min(...competitorRateValues);
    const marketMax = Math.max(...competitorRateValues);
    const marketAvg = competitorRateValues.reduce((a, b) => a + b, 0) / competitorRateValues.length;

    // FIX: Return 'no_data' instead of using market average when no own rate exists
    if (!yourRate && defaultRate === 0) {
      positions.push({
        date: new Date(d),
        yourRate: 0,
        marketMin,
        marketMax,
        marketAvg,
        position: 'no_data',
        rank: 0,
        totalCompetitors: dayCompetitorRates.length,
      });
      continue;
    }

    const yourRateValue = yourRate?.price || defaultRate;

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
  daysAhead: number = 30,
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

    // Skip 'no_data' positions — no basis for recommendation
    if (pos.position === 'no_data') {
      return {
        date: pos.date,
        currentRate: pos.yourRate,
        recommendedRate: pos.yourRate,
        change: 0,
        reason: 'No competitor data available for this date',
        confidence: 0,
      };
    }

    switch (pos.position) {
      case 'highest':
        recommendedRate = pos.marketAvg * 1.02;
        reason = 'Rate is highest in market. Consider reducing to improve occupancy.';
        confidence = 0.85;
        break;
      case 'above_avg':
        recommendedRate = pos.marketAvg * 1.0;
        reason = 'Rate is above market average. Consider matching market rate.';
        confidence = 0.7;
        break;
      case 'lowest':
        recommendedRate = pos.marketAvg * 0.95;
        reason = 'Rate is lowest in market. Opportunity to increase slightly.';
        confidence = 0.75;
        break;
      case 'below_avg':
        recommendedRate = pos.marketAvg * 0.98;
        reason = 'Competitive rate. Consider slight increase to test demand.';
        confidence = 0.65;
        break;
      case 'average':
      default:
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
