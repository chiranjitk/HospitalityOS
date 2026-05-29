/**
 * Competitive Set (CompSet) Metrics Service
 *
 * Key benchmarking formulas:
 * ADR Index = (Our ADR / CompSet Avg ADR) × 100
 * MPI (Market Penetration Index) = (Our Occupancy / CompSet Avg Occupancy) × 100
 * RGI (Revenue Generation Index) = ADR Index × MPI / 100
 * RevPAR Index = (Our RevPAR / CompSet Avg RevPAR) × 100
 */

import { db } from '@/lib/db';

// --- Type Definitions ---

export interface PropertyPerformance {
  adr: number;
  occupancy: number;
  revpar: number;
  totalRevenue: number;
  occupiedRooms: number;
  totalRooms: number;
}

export interface CompSetCalculatedMetrics {
  date: Date;
  period: string;
  ourAdr: number;
  ourOccupancy: number;
  ourRevpar: number;
  compsetAdr: number;
  compsetOccupancy: number;
  compsetRevpar: number;
  adrIndex: number;
  mpi: number;
  rgi: number;
  revparIndex: number;
  compsetSize: number;
  dataCompleteness: number;
}

export interface RankingEntry {
  name: string;
  adr: number;
  occupancy: number;
  revpar: number;
  isOurProperty: boolean;
}

export interface CompSetSummary {
  competitiveSetId: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  period: string;
  metrics: CompSetCalculatedMetrics[];
  currentPeriod: CompSetCalculatedMetrics | null;
  previousPeriod: CompSetCalculatedMetrics | null;
  trend: {
    adrIndex: number; // positive = improving
    mpi: number;
    rgi: number;
    revparIndex: number;
  };
}

// --- Helper Functions ---

function formatNumber(value: number, decimals: number = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function calculateIndices(
  ourAdr: number,
  ourOccupancy: number,
  ourRevpar: number,
  compsetAdr: number,
  compsetOccupancy: number,
  compsetRevpar: number
): { adrIndex: number; mpi: number; rgi: number; revparIndex: number } {
  const adrIndex = compsetAdr > 0 ? formatNumber((ourAdr / compsetAdr) * 100) : 100;
  const mpi = compsetOccupancy > 0 ? formatNumber((ourOccupancy / compsetOccupancy) * 100) : 100;
  const revparIndex = compsetRevpar > 0 ? formatNumber((ourRevpar / compsetRevpar) * 100) : 100;
  const rgi = formatNumber((adrIndex * mpi) / 100);

  return { adrIndex, mpi, rgi, revparIndex };
}

// --- Core Functions ---

/**
 * Calculate property performance metrics from real booking data.
 *
 * ADR = sum(totalAmount) / count(bookings) for occupied rooms on the date
 * Occupancy = count(occupied rooms on date) / total rooms × 100
 * RevPAR = ADR × Occupancy / 100
 */
export async function calculatePropertyPerformance(
  propertyId: string,
  date: Date,
  tenantId: string
): Promise<PropertyPerformance> {
  // Get the property's total room count
  const property = await db.property.findFirst({
    where: { id: propertyId, tenantId },
    select: { totalRooms: true },
  });

  const totalRooms = property?.totalRooms || 1;

  // Build date range for the target date (midnight to midnight)
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  // Find bookings that are "in house" on this date:
  // checked_in status with checkIn <= date AND (checkOut > date OR checkOut is null)
  // OR checked_out status with checkOut on this date
  const bookingsInHouse = await db.booking.findMany({
    where: {
      propertyId,
      tenantId,
      status: { in: ['checked_in', 'checked_out'] },
      AND: [
        { checkIn: { lte: dayEnd } },
        {
          OR: [
            { checkOut: { gt: dayStart } },
            { checkOut: { equals: null as unknown as Date } },
          ],
        },
      ],
    },
    select: {
      id: true,
      totalAmount: true,
      checkIn: true,
      checkOut: true,
      roomId: true,
      status: true,
    },
  });

  // Count unique occupied rooms
  const occupiedRoomIds = new Set(
    bookingsInHouse
      .filter((b) => b.roomId)
      .map((b) => b.roomId!)
  );
  const occupiedRooms = occupiedRoomIds.size;

  // Calculate ADR: total revenue from these bookings / number of occupied rooms
  const totalRevenue = bookingsInHouse.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  const adr = occupiedRooms > 0 ? formatNumber(totalRevenue / occupiedRooms) : 0;

  // Occupancy percentage
  const occupancy = formatNumber((occupiedRooms / totalRooms) * 100);

  // RevPAR = ADR × Occupancy / 100
  const revpar = formatNumber((adr * occupancy) / 100);

  return {
    adr,
    occupancy,
    revpar,
    totalRevenue,
    occupiedRooms,
    totalRooms,
  };
}

/**
 * Calculate compset average metrics from CompetitorPrice data
 * for compset members on a given date.
 */
export async function calculateCompSetAverages(
  tenantId: string,
  propertyId: string,
  competitiveSetId: string,
  date: Date
): Promise<{
  avgAdr: number;
  avgOccupancy: number;
  avgRevpar: number;
  compsetSize: number;
  dataCompleteness: number;
}> {
  // Get all active members in the compset
  const members = await db.compSetMember.findMany({
    where: {
      competitiveSetId,
      tenantId,
      isActive: true,
    },
    select: {
      id: true,
      hotelName: true,
      totalRooms: true,
    },
    orderBy: { sortOrder: 'asc' },
  });

  if (members.length === 0) {
    return { avgAdr: 0, avgOccupancy: 0, avgRevpar: 0, compsetSize: 0, dataCompleteness: 0 };
  }

  // Build date range for the target date
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  // Get competitor prices for members on this date
  const memberNames = members.map((m) => m.hotelName);
  const competitorPrices = await db.competitorPrice.findMany({
    where: {
      tenantId,
      propertyId,
      date: { gte: dayStart, lte: dayEnd },
      competitorName: { in: memberNames },
    },
    select: {
      competitorName: true,
      price: true,
    },
  });

  // Calculate averages from price data
  // Note: CompetitorPrice only stores price (ADR-like), not occupancy
  // We estimate occupancy from price relative to market positioning
  let totalAdr = 0;
  let dataCount = 0;
  const priceMap = new Map<string, number[]>();

  for (const cp of competitorPrices) {
    const existing = priceMap.get(cp.competitorName) || [];
    existing.push(cp.price);
    priceMap.set(cp.competitorName, existing);
  }

  // Calculate weighted ADR average across members
  let weightedAdrSum = 0;
  let weightSum = 0;

  for (const member of members) {
    const prices = priceMap.get(member.hotelName);
    if (prices && prices.length > 0) {
      const avgPrice = prices.reduce((s, v) => s + v, 0) / prices.length;
      const weight = member.totalRooms || 1;
      weightedAdrSum += avgPrice * weight;
      weightSum += weight;
      totalAdr += avgPrice;
      dataCount++;
    }
  }

  const avgAdr = dataCount > 0 ? formatNumber(weightedAdrSum / weightSum) : 0;
  const dataCompleteness = members.length > 0 ? dataCount / members.length : 0;

  // Estimate occupancy: use a baseline occupancy derived from our property's occupancy
  // When we don't have competitor occupancy data, we use their price positioning
  // to estimate (lower price = likely higher occupancy in competitive markets)
  // Default to a neutral estimate
  const avgOccupancy = 0; // We don't have competitor occupancy data in CompetitorPrice
  // RevPAR can't be calculated without occupancy
  const avgRevpar = 0;

  return {
    avgAdr,
    avgOccupancy,
    avgRevpar,
    compsetSize: members.length,
    dataCompleteness,
  };
}

/**
 * Calculate all compset metrics for a specific date and period.
 * Combines our property performance + compset averages to compute indices.
 */
export async function calculateCompSetMetrics(
  propertyId: string,
  competitiveSetId: string,
  date: Date,
  period: string = 'daily',
  tenantId?: string
): Promise<CompSetCalculatedMetrics | null> {
  // Get the compset to find tenantId
  const compSet = await db.competitiveSet.findFirst({
    where: { id: competitiveSetId },
    select: { tenantId: true, propertyId: true, isActive: true },
  });

  if (!compSet || !compSet.isActive) return null;

  const effectiveTenantId = tenantId || compSet.tenantId;

  // Calculate our property performance
  const ourPerformance = await calculatePropertyPerformance(
    compSet.propertyId,
    date,
    effectiveTenantId
  );

  // Calculate compset averages
  const compsetAvg = await calculateCompSetAverages(
    effectiveTenantId,
    compSet.propertyId,
    competitiveSetId,
    date
  );

  // When we don't have competitor occupancy data, use our occupancy as a proxy
  // for the compset average (assuming market-average positioning)
  const effectiveCompsetOccupancy = compsetAvg.avgOccupancy > 0
    ? compsetAvg.avgOccupancy
    : ourPerformance.occupancy;
  const effectiveCompsetRevpar = compsetAvg.avgRevpar > 0
    ? compsetAvg.avgRevpar
    : (compsetAvg.avgAdr * effectiveCompsetOccupancy) / 100;

  // Calculate indices
  const { adrIndex, mpi, rgi, revparIndex } = calculateIndices(
    ourPerformance.adr,
    ourPerformance.occupancy,
    ourPerformance.revpar,
    compsetAvg.avgAdr,
    effectiveCompsetOccupancy,
    effectiveCompsetRevpar
  );

  return {
    date,
    period,
    ourAdr: ourPerformance.adr,
    ourOccupancy: ourPerformance.occupancy,
    ourRevpar: ourPerformance.revpar,
    compsetAdr: compsetAvg.avgAdr,
    compsetOccupancy: effectiveCompsetOccupancy,
    compsetRevpar: effectiveCompsetRevpar,
    adrIndex,
    mpi,
    rgi,
    revparIndex,
    compsetSize: compsetAvg.compsetSize,
    dataCompleteness: compsetAvg.dataCompleteness,
  };
}

/**
 * Calculate property performance over a date range.
 * Returns aggregated metrics (total ADR, average occupancy, average RevPAR).
 */
export async function calculatePropertyPerformanceRange(
  propertyId: string,
  startDate: Date,
  endDate: Date,
  tenantId: string
): Promise<PropertyPerformance> {
  // Get total rooms
  const property = await db.property.findFirst({
    where: { id: propertyId, tenantId },
    select: { totalRooms: true },
  });
  const totalRooms = property?.totalRooms || 1;

  const dayStart = new Date(startDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(endDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Find bookings that overlap with any date in the range
  const bookings = await db.booking.findMany({
    where: {
      propertyId,
      tenantId,
      status: { in: ['checked_in', 'checked_out'] },
      AND: [
        { checkIn: { lte: dayEnd } },
        {
          OR: [
            { checkOut: { gt: dayStart } },
          ],
        },
      ],
    },
    select: {
      id: true,
      totalAmount: true,
      checkIn: true,
      checkOut: true,
      roomId: true,
      status: true,
    },
  });

  // Calculate total occupied room nights
  let totalOccupiedRoomNights = 0;
  let totalRevenue = 0;
  const daysInRange = Math.max(
    1,
    Math.ceil((dayEnd.getTime() - dayStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  for (const booking of bookings) {
    const bCheckIn = new Date(booking.checkIn);
    const bCheckOut = new Date(booking.checkOut);
    const effectiveStart = bCheckIn > dayStart ? bCheckIn : dayStart;
    const effectiveEnd = bCheckOut < dayEnd ? bCheckOut : dayEnd;
    const nights = Math.max(
      0,
      Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24))
    );

    if (nights > 0) {
      totalOccupiedRoomNights += nights;
      totalRevenue += booking.totalAmount || 0;
    }
  }

  // ADR = total revenue / total room nights
  const adr = totalOccupiedRoomNights > 0 ? formatNumber(totalRevenue / totalOccupiedRoomNights) : 0;

  // Average daily occupancy
  const avgOccupiedRooms = totalOccupiedRoomNights / daysInRange;
  const occupancy = formatNumber((avgOccupiedRooms / totalRooms) * 100);

  // RevPAR = ADR × Occupancy / 100
  const revpar = formatNumber((adr * occupancy) / 100);

  return {
    adr,
    occupancy,
    revpar,
    totalRevenue,
    occupiedRooms: Math.round(avgOccupiedRooms),
    totalRooms,
  };
}

/**
 * Generate a ranking of our property vs compset members by RevPAR.
 */
export async function generateRanking(
  competitiveSetId: string,
  date: Date,
  tenantId: string
): Promise<{ rankings: RankingEntry[]; ourRank: number | null }> {
  // Get compset info
  const compSet = await db.competitiveSet.findFirst({
    where: { id: competitiveSetId, tenantId },
    select: { propertyId: true, isActive: true },
  });

  if (!compSet || !compSet.isActive) {
    return { rankings: [], ourRank: null };
  }

  // Calculate our property performance
  const ourPerf = await calculatePropertyPerformance(
    compSet.propertyId,
    date,
    tenantId
  );

  // Get property name
  const property = await db.property.findFirst({
    where: { id: compSet.propertyId },
    select: { name: true },
  });

  // Get compset members
  const members = await db.compSetMember.findMany({
    where: {
      competitiveSetId,
      tenantId,
      isActive: true,
    },
    select: {
      hotelName: true,
      totalRooms: true,
    },
    orderBy: { sortOrder: 'asc' },
  });

  // Build date range
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  // Get competitor prices for members
  const memberNames = members.map((m) => m.hotelName);
  const competitorPrices = await db.competitorPrice.findMany({
    where: {
      tenantId,
      propertyId: compSet.propertyId,
      date: { gte: dayStart, lte: dayEnd },
      competitorName: { in: memberNames },
    },
    select: {
      competitorName: true,
      price: true,
    },
  });

  // Build rankings
  const rankings: RankingEntry[] = [];

  // Add our property
  rankings.push({
    name: property?.name || 'Our Property',
    adr: ourPerf.adr,
    occupancy: ourPerf.occupancy,
    revpar: ourPerf.revpar,
    isOurProperty: true,
  });

  // Add competitors with their price as ADR proxy
  const priceMap = new Map<string, number>();
  for (const cp of competitorPrices) {
    const existing = priceMap.get(cp.competitorName) || 0;
    // Keep the latest/highest price as a simple approach
    priceMap.set(cp.competitorName, cp.price);
  }

  for (const member of members) {
    const price = priceMap.get(member.hotelName);
    // Since we don't have competitor occupancy data, we estimate
    // Use our occupancy as a base with price-adjusted variance
    const estimatedOccupancy = price
      ? formatNumber(ourPerf.occupancy * (ourPerf.adr / Math.max(price, 1)) * 0.8 + ourPerf.occupancy * 0.2)
      : 0;
    const estimatedRevpar = price ? formatNumber((price * estimatedOccupancy) / 100) : 0;

    rankings.push({
      name: member.hotelName,
      adr: price || 0,
      occupancy: estimatedOccupancy,
      revpar: estimatedRevpar,
      isOurProperty: false,
    });
  }

  // Sort by RevPAR descending (1 = best)
  rankings.sort((a, b) => b.revpar - a.revpar);

  // Find our rank
  let ourRank: number | null = null;
  const ourIdx = rankings.findIndex((r) => r.isOurProperty);
  if (ourIdx >= 0) {
    ourRank = ourIdx + 1;
  }

  return { rankings, ourRank };
}

/**
 * Get a summary of compset metrics across a date range with trend indicators.
 */
export async function getCompSetSummary(
  competitiveSetId: string,
  startDate: Date,
  endDate: Date,
  period: string = 'daily',
  tenantId?: string
): Promise<CompSetSummary | null> {
  const compSet = await db.competitiveSet.findFirst({
    where: { id: competitiveSetId },
    select: { tenantId: true, propertyId: true, isActive: true },
  });

  if (!compSet || !compSet.isActive) return null;

  const effectiveTenantId = tenantId || compSet.tenantId;

  // Fetch existing stored metrics
  const storedMetrics = await db.compSetMetric.findMany({
    where: {
      competitiveSetId,
      tenantId: effectiveTenantId,
      date: { gte: startDate, lte: endDate },
      period,
    },
    orderBy: { date: 'asc' },
  });

  // If we have stored metrics, use them; otherwise calculate fresh
  let metrics: CompSetCalculatedMetrics[];

  if (storedMetrics.length > 0) {
    metrics = storedMetrics.map((m) => ({
      date: m.date,
      period: m.period,
      ourAdr: m.ourAdr,
      ourOccupancy: m.ourOccupancy,
      ourRevpar: m.ourRevpar,
      compsetAdr: m.compsetAdr,
      compsetOccupancy: m.compsetOccupancy,
      compsetRevpar: m.compsetRevpar,
      adrIndex: m.adrIndex,
      mpi: m.mpi,
      rgi: m.rgi,
      revparIndex: m.revparIndex,
      compsetSize: m.compsetSize,
      dataCompleteness: m.dataCompleteness,
    }));
  } else {
    // Calculate fresh for each day in range
    metrics = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const calculated = await calculateCompSetMetrics(
        compSet.propertyId,
        competitiveSetId,
        current,
        period,
        effectiveTenantId
      );
      if (calculated) metrics.push(calculated);
      current.setDate(current.getDate() + 1);
    }
  }

  if (metrics.length === 0) {
    return {
      competitiveSetId,
      propertyId: compSet.propertyId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      period,
      metrics: [],
      currentPeriod: null,
      previousPeriod: null,
      trend: { adrIndex: 0, mpi: 0, rgi: 0, revparIndex: 0 },
    };
  }

  // Current period = most recent metric
  const currentPeriod = metrics[metrics.length - 1];

  // Previous period = metric from halfway through (or one period back)
  const previousPeriod = metrics.length > 1 ? metrics[Math.max(0, metrics.length - 2)] : null;

  // Calculate trend (change from previous to current)
  const trend = previousPeriod
    ? {
        adrIndex: formatNumber(currentPeriod.adrIndex - previousPeriod.adrIndex),
        mpi: formatNumber(currentPeriod.mpi - previousPeriod.mpi),
        rgi: formatNumber(currentPeriod.rgi - previousPeriod.rgi),
        revparIndex: formatNumber(currentPeriod.revparIndex - previousPeriod.revparIndex),
      }
    : { adrIndex: 0, mpi: 0, rgi: 0, revparIndex: 0 };

  return {
    competitiveSetId,
    propertyId: compSet.propertyId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    period,
    metrics,
    currentPeriod,
    previousPeriod,
    trend,
  };
}

/**
 * Store calculated metrics in the database.
 * Upserts based on competitiveSetId + date + period unique constraint.
 */
export async function storeCompSetMetrics(
  competitiveSetId: string,
  tenantId: string,
  propertyId: string,
  metrics: CompSetCalculatedMetrics,
  source: string = 'auto'
): Promise<void> {
  // Calculate ranking
  const { ourRank } = await generateRanking(competitiveSetId, metrics.date, tenantId);

  await db.compSetMetric.upsert({
    where: {
      competitiveSetId_date_period: {
        competitiveSetId,
        date: metrics.date,
        period: metrics.period,
      },
    },
    update: {
      ourAdr: metrics.ourAdr,
      ourOccupancy: metrics.ourOccupancy,
      ourRevpar: metrics.ourRevpar,
      compsetAdr: metrics.compsetAdr,
      compsetOccupancy: metrics.compsetOccupancy,
      compsetRevpar: metrics.compsetRevpar,
      adrIndex: metrics.adrIndex,
      mpi: metrics.mpi,
      rgi: metrics.rgi,
      revparIndex: metrics.revparIndex,
      compsetSize: metrics.compsetSize,
      ourRank,
      dataCompleteness: metrics.dataCompleteness,
      source,
    },
    create: {
      tenantId,
      competitiveSetId,
      propertyId,
      date: metrics.date,
      period: metrics.period,
      ourAdr: metrics.ourAdr,
      ourOccupancy: metrics.ourOccupancy,
      ourRevpar: metrics.ourRevpar,
      compsetAdr: metrics.compsetAdr,
      compsetOccupancy: metrics.compsetOccupancy,
      compsetRevpar: metrics.compsetRevpar,
      adrIndex: metrics.adrIndex,
      mpi: metrics.mpi,
      rgi: metrics.rgi,
      revparIndex: metrics.revparIndex,
      compsetSize: metrics.compsetSize,
      ourRank,
      dataCompleteness: metrics.dataCompleteness,
      source,
    },
  });
}
