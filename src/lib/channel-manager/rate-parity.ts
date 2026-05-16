/**
 * Channel Manager Rate Parity Engine
 * 
 * Compares PMS base rates with all connected channel rates,
 * detects rate disparities, and recommends corrective actions.
 * Supports configurable thresholds and pricing strategies.
 * 
 * Enhanced to use real OTA rate fetching when available,
 * falling back to variance-based estimation.
 */

import { db } from '@/lib/db';
import { fetchLiveRatesFromChannel, getChannelVarianceFactor } from './ota-rate-fetcher';

// ============================================
// TYPES
// ============================================

export type ParityStatus = 'matched' | 'undercut' | 'overpriced';
export type PricingStrategy = 'match_lowest' | 'price_floor' | 'match_pms';

export interface ChannelRateEntry {
  channelId: string;
  channelName: string;
  connectionId: string;
  rate: number;
  currency: string;
  externalRateId?: string;
  source: 'channel' | 'pms';
}

export interface ChannelParityCheck {
  channelName: string;
  channelId: string;
  connectionId: string;
  pmsRate: number;
  channelRate: number;
  deviationPercent: number;
  deviationAmount: number;
  parityStatus: ParityStatus;
  recommendedRate: number;
  strategyApplied: string;
}

export interface ParityReport {
  propertyId: string;
  roomTypeId: string;
  roomTypeName: string;
  date: string;
  pmsBaseRate: number;
  pmsCurrency: string;
  threshold: number;
  strategy: PricingStrategy;
  channels: ChannelParityCheck[];
  overallStatus: ParityStatus;
  lowestRate: number;
  highestRate: number;
  averageRate: number;
  recommendedRate: number;
  priceFloor?: number;
  checkedAt: string;
}

export interface RateParityOptions {
  propertyId: string;
  roomTypeId: string;
  date: string;
  threshold?: number;       // Default 5%
  strategy?: PricingStrategy; // Default 'match_lowest'
  priceFloor?: number;     // Optional minimum rate
}

export interface ParityCorrectionOptions {
  propertyId: string;
  strategy: PricingStrategy;
  threshold?: number;
  priceFloor?: number;
  roomTypeIds?: string[];
  dateRange?: { start: string; end: string };
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Check rate parity for a specific room type on a specific date.
 * Compares PMS base rate with all connected channel rates.
 */
export async function checkRateParity(
  propertyId: string,
  roomTypeId: string,
  date: string,
  threshold: number = 5,
  strategy: PricingStrategy = 'match_lowest',
  priceFloor?: number,
): Promise<ParityReport> {
  // Fetch the room type with its base price
  const roomType = await db.roomType.findFirst({
    where: { id: roomTypeId, propertyId },
    select: { id: true, name: true, basePrice: true, currency: true },
  });

  if (!roomType) {
    throw new Error(`Room type not found: ${roomTypeId}`);
  }

  // Fetch rate plans for this room type
  const ratePlans = await db.ratePlan.findMany({
    where: { roomTypeId, status: 'active' },
    select: { id: true, name: true, basePrice: true, currency: true },
  });

  // Use the lowest active rate plan price, or room type base price
  const activeRatePlanPrices = ratePlans.map(rp => rp.basePrice).filter(p => p > 0);
  const pmsBaseRate = activeRatePlanPrices.length > 0
    ? Math.min(...activeRatePlanPrices)
    : roomType.basePrice;

  // Fetch all active channel connections for this property
  const connections = await db.channelConnection.findMany({
    where: { propertyId, status: 'active' },
    select: { id: true, channel: true, displayName: true, propertyId: true },
  });

  // Fetch channel mappings for this room type
  const mappings = await db.channelMapping.findMany({
    where: {
      roomTypeId,
      connectionId: { in: connections.map(c => c.id) },
      syncRates: true,
      status: 'active',
    },
    include: {
      connection: {
        select: { id: true, channel: true, displayName: true },
      },
    },
  });

  // Build channel rate entries
  // PMS entry
  const allEntries: ChannelRateEntry[] = [
    {
      channelId: 'pms',
      channelName: 'PMS (StaySuite)',
      connectionId: 'pms',
      rate: pmsBaseRate,
      currency: roomType.currency,
      source: 'pms',
    },
  ];

  // Channel entries (using mapping data and simulated rates from restrictions)
  for (const mapping of mappings) {
    // Check if there's a channel restriction with rate info for this date
    const restriction = await db.channelRestriction.findFirst({
      where: {
        connectionId: mapping.connectionId,
        roomTypeId,
        startDate: { lte: new Date(date) },
        endDate: { gte: new Date(date) },
      },
    });

    // Use rate min/max from restriction if available, otherwise try live OTA fetch, then variance fallback
    let channelRate = pmsBaseRate;

    if (restriction?.rateMin && restriction.rateMin > 0) {
      channelRate = restriction.rateMin;
    } else if (restriction?.rateMax && restriction.rateMax > 0) {
      channelRate = restriction.rateMax;
    } else {
      // Try fetching live rates from the OTA channel
      try {
        const liveRates = await fetchLiveRatesFromChannel(
          mapping.connectionId,
          roomTypeId,
          { start: new Date(date), end: new Date(date) },
        );

        // Use the first available rate for this date, or fall back to variance
        if (liveRates.length > 0 && liveRates[0].baseRate > 0) {
          channelRate = liveRates[0].baseRate;
        } else {
          // Fallback: use variance-based estimation
          const varianceFactor = getChannelVarianceFactor(mapping.connection.channel);
          channelRate = Math.round(pmsBaseRate * varianceFactor * 100) / 100;
        }
      } catch (error) {
        // Fallback: use variance-based estimation if live fetch fails
        console.warn(`[RateParity] Live rate fetch failed for ${mapping.connection.channel}, using variance fallback:`, error);
        const varianceFactor = getChannelVarianceFactor(mapping.connection.channel);
        channelRate = Math.round(pmsBaseRate * varianceFactor * 100) / 100;
      }
    }

    allEntries.push({
      channelId: mapping.connection.channel,
      channelName: mapping.connection.displayName || mapping.connection.channel,
      connectionId: mapping.connectionId,
      rate: channelRate,
      currency: roomType.currency,
      source: 'channel',
      externalRateId: mapping.externalRateId || undefined,
    });
  }

  // Calculate parity for each channel
  const channels: ChannelParityCheck[] = allEntries
    .filter(e => e.source === 'channel')
    .map(entry => {
      const deviationPercent = pmsBaseRate > 0
        ? ((entry.rate - pmsBaseRate) / pmsBaseRate) * 100
        : 0;
      const deviationAmount = entry.rate - pmsBaseRate;
      const absDeviation = Math.abs(deviationPercent);

      let parityStatus: ParityStatus;
      if (absDeviation <= threshold) {
        parityStatus = 'matched';
      } else if (deviationPercent < 0) {
        parityStatus = 'undercut';
      } else {
        parityStatus = 'overpriced';
      }

      const recommendedRate = calculateRecommendedRate(
        pmsBaseRate,
        entry.rate,
        strategy,
        threshold,
        priceFloor,
        allEntries,
      );

      return {
        channelName: entry.channelName,
        channelId: entry.channelId,
        connectionId: entry.connectionId,
        pmsRate: pmsBaseRate,
        channelRate: entry.rate,
        deviationPercent: Math.round(deviationPercent * 100) / 100,
        deviationAmount: Math.round(deviationAmount * 100) / 100,
        parityStatus,
        recommendedRate: Math.round(recommendedRate * 100) / 100,
        strategyApplied: strategy,
      };
    });

  // Determine overall status
  const hasUndercut = channels.some(c => c.parityStatus === 'undercut');
  const hasOverpriced = channels.some(c => c.parityStatus === 'overpriced');
  const allMatched = channels.every(c => c.parityStatus === 'matched');

  let overallStatus: ParityStatus;
  if (allMatched || channels.length === 0) {
    overallStatus = 'matched';
  } else if (hasUndercut) {
    overallStatus = 'undercut';
  } else {
    overallStatus = 'overpriced';
  }

  const rates = channels.map(c => c.channelRate).concat(pmsBaseRate);
  const lowestRate = rates.length > 0 ? Math.min(...rates) : pmsBaseRate;
  const highestRate = rates.length > 0 ? Math.max(...rates) : pmsBaseRate;
  const averageRate = rates.length > 0 ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100 : pmsBaseRate;

  const recommendedRate = calculateRecommendedRate(
    pmsBaseRate,
    lowestRate,
    strategy,
    threshold,
    priceFloor,
    allEntries,
  );

  return {
    propertyId,
    roomTypeId,
    roomTypeName: roomType.name,
    date,
    pmsBaseRate,
    pmsCurrency: roomType.currency,
    threshold,
    strategy,
    channels,
    overallStatus,
    lowestRate: Math.round(lowestRate * 100) / 100,
    highestRate: Math.round(highestRate * 100) / 100,
    averageRate,
    recommendedRate: Math.round(recommendedRate * 100) / 100,
    priceFloor: priceFloor ? Math.round(priceFloor * 100) / 100 : undefined,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Check rate parity across all room types and dates for a property.
 */
export async function checkPropertyRateParity(
  propertyId: string,
  options?: {
    dateRange?: { start: string; end: string };
    threshold?: number;
    strategy?: PricingStrategy;
    priceFloor?: number;
  }
): Promise<ParityReport[]> {
  const roomTypes = await db.roomType.findMany({
    where: { propertyId, status: 'active', deletedAt: null },
    select: { id: true },
  });

  if (roomTypes.length === 0) return [];

  const threshold = options?.threshold ?? 5;
  const strategy = options?.strategy ?? 'match_lowest';
  const priceFloor = options?.priceFloor;

  const dates: string[] = [];
  if (options?.dateRange) {
    const start = new Date(options.dateRange.start);
    const end = new Date(options.dateRange.end);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
  } else {
    // Default: check today and next 6 days
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
  }

  const reports: ParityReport[] = [];

  for (const roomType of roomTypes) {
    for (const date of dates) {
      try {
        const report = await checkRateParity(
          propertyId,
          roomType.id,
          date,
          threshold,
          strategy,
          priceFloor,
        );
        reports.push(report);
      } catch (error) {
        console.error(`Failed to check parity for room type ${roomType.id} on ${date}:`, error);
      }
    }
  }

  return reports;
}

/**
 * Apply parity corrections across channels.
 * Returns a summary of changes made.
 */
export async function applyParityCorrections(
  options: ParityCorrectionOptions
): Promise<{
  corrected: number;
  skipped: number;
  errors: number;
  details: { channelId: string; channelName: string; roomTypeId: string; date: string; oldRate: number; newRate: number }[];
}> {
  const threshold = options.threshold ?? 5;
  const strategy = options.strategy;
  const priceFloor = options.priceFloor;

  // Determine date range
  const dates: string[] = [];
  if (options.dateRange) {
    const start = new Date(options.dateRange.start);
    const end = new Date(options.dateRange.end);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
  } else {
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
  }

  // Determine room types
  let roomTypeIds: string[] = [];
  if (options.roomTypeIds && options.roomTypeIds.length > 0) {
    roomTypeIds = options.roomTypeIds;
  } else {
    const roomTypes = await db.roomType.findMany({
      where: { propertyId: options.propertyId, status: 'active', deletedAt: null },
      select: { id: true },
    });
    roomTypeIds = roomTypes.map(rt => rt.id);
  }

  const details: { channelId: string; channelName: string; roomTypeId: string; date: string; oldRate: number; newRate: number }[] = [];
  let corrected = 0;
  let skipped = 0;
  let errors = 0;

  for (const roomTypeId of roomTypeIds) {
    for (const date of dates) {
      try {
        const report = await checkRateParity(
          options.propertyId,
          roomTypeId,
          date,
          threshold,
          strategy,
          priceFloor,
        );

        // Apply corrections for channels that are out of parity
        for (const channel of report.channels) {
          if (channel.parityStatus === 'matched') {
            skipped++;
            continue;
          }

          // Apply the recommended rate
          if (channel.recommendedRate !== channel.channelRate) {
            // Update channel restriction with new rate
            try {
              const existingRestriction = await db.channelRestriction.findFirst({
                where: {
                  connectionId: channel.connectionId,
                  roomTypeId,
                  startDate: { lte: new Date(date) },
                  endDate: { gte: new Date(date) },
                },
              });

              if (existingRestriction) {
                await db.channelRestriction.update({
                  where: { id: existingRestriction.id },
                  data: {
                    rateMin: channel.recommendedRate,
                    rateMax: channel.recommendedRate,
                    source: 'parity_correction',
                    syncStatus: 'pending',
                  },
                });
              } else {
                await db.channelRestriction.create({
                  data: {
                    connectionId: channel.connectionId,
                    roomTypeId,
                    startDate: new Date(date),
                    endDate: new Date(date),
                    rateMin: channel.recommendedRate,
                    rateMax: channel.recommendedRate,
                    source: 'parity_correction',
                    syncStatus: 'pending',
                  },
                });
              }

              details.push({
                channelId: channel.channelId,
                channelName: channel.channelName,
                roomTypeId,
                date,
                oldRate: channel.channelRate,
                newRate: channel.recommendedRate,
              });
              corrected++;
            } catch (err) {
              errors++;
            }
          } else {
            skipped++;
          }
        }
      } catch (error) {
        errors++;
      }
    }
  }

  return { corrected, skipped, errors, details };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate the recommended rate based on the chosen strategy.
 */
function calculateRecommendedRate(
  pmsRate: number,
  channelRate: number,
  strategy: PricingStrategy,
  threshold: number,
  priceFloor?: number,
  allEntries?: ChannelRateEntry[],
): number {
  const effectiveFloor = priceFloor ?? pmsRate * 0.7; // Default floor: 70% of PMS rate

  switch (strategy) {
    case 'match_lowest': {
      // Match the lowest rate across all channels
      if (allEntries && allEntries.length > 0) {
        const lowest = Math.min(...allEntries.map(e => e.rate));
        return Math.max(lowest, effectiveFloor);
      }
      return Math.max(Math.min(pmsRate, channelRate), effectiveFloor);
    }

    case 'price_floor': {
      // Ensure no channel goes below the price floor
      return Math.max(channelRate, effectiveFloor);
    }

    case 'match_pms': {
      // All channels should match the PMS base rate
      return Math.max(pmsRate, effectiveFloor);
    }

    default:
      return channelRate;
  }
}
