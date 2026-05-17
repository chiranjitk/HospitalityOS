/**
 * Price Elasticity Analysis
 * Analyzes historical booking data to determine price sensitivity
 * for different room types and computes optimal pricing.
 */

import { db } from '@/lib/db';

export interface ElasticityResult {
  roomTypeId: string;
  roomTypeName: string;
  period: string;
  elasticityCoefficient: number;
  optimalPrice: number;
  priceFloor: number;
  priceCeiling: number;
  currentAvgRate: number;
  currentOccupancy: number;
  demandSensitivity: 'elastic' | 'normal' | 'inelastic';
  historicalDataPoints: number;
  confidenceScore: number;
  recommendations: string[];
}

interface RateOccupancyBucket {
  rateRange: string;
  avgRate: number;
  totalBookings: number;
  occupancyRate: number;
  revenuePerAvailableRoom: number;
}

/**
 * Analyze price elasticity for a room type.
 */
export async function analyzePriceElasticity(
  tenantId: string,
  propertyId: string,
  roomTypeId: string,
  period: string = 'last_30_days'
): Promise<ElasticityResult> {
  // Determine date range from period
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case 'last_7_days':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case 'last_90_days':
      startDate.setDate(endDate.getDate() - 90);
      break;
    case 'last_year':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    case 'last_30_days':
    default:
      startDate.setDate(endDate.getDate() - 30);
      break;
  }

  // Fetch room type info
  const roomType = await db.roomType.findUnique({
    where: { id: roomTypeId },
    select: { name: true, basePrice: true, totalRooms: true, propertyId: true },
  });

  const roomTypeName = roomType?.name || 'Unknown';
  const totalRooms = roomType?.totalRooms || 100;

  // Fetch historical bookings for this room type
  const bookings = await db.booking.findMany({
    where: {
      tenantId,
      propertyId,
      roomTypeId,
      checkIn: { gte: startDate, lte: endDate },
      status: { in: ['confirmed', 'checked_in', 'checked_out'] },
      deletedAt: null,
    },
    select: {
      roomRate: true,
      totalAmount: true,
      checkIn: true,
      checkOut: true,
    },
  });

  // Fetch total available room-nights for occupancy calculation
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalAvailableNights = totalRooms * totalDays;

  // Calculate nights booked
  let totalNightsBooked = 0;
  let totalRevenue = 0;
  const rateData: number[] = [];

  for (const b of bookings) {
    const nights = Math.max(1, Math.ceil(
      (b.checkOut.getTime() - b.checkIn.getTime()) / (1000 * 60 * 60 * 24)
    ));
    totalNightsBooked += nights;
    totalRevenue += b.totalAmount;
    rateData.push(b.roomRate);
  }

  const currentOccupancy = totalAvailableNights > 0
    ? (totalNightsBooked / totalAvailableNights) * 100
    : 0;

  const currentAvgRate = rateData.length > 0
    ? rateData.reduce((a, b) => a + b, 0) / rateData.length
    : roomType?.basePrice || 0;

  // Group rates into buckets for elasticity calculation
  const rateBuckets = buildRateBuckets(rateData, totalNightsBooked, totalAvailableNights);

  // Calculate elasticity coefficient
  const elasticity = calculateElasticity(rateBuckets);

  // Determine price bounds
  const rateMin = rateData.length > 0 ? Math.min(...rateData) : currentAvgRate * 0.6;
  const rateMax = rateData.length > 0 ? Math.max(...rateData) : currentAvgRate * 1.5;
  const rateStdDev = calculateStdDev(rateData);
  const rateMedian = calculateMedian(rateData);

  const priceFloor = Math.max(rateMin * 0.8, rateMedian - 2 * rateStdDev);
  const priceCeiling = rateMax * 1.2;

  // Calculate optimal price based on elasticity
  const optimalPrice = calculateOptimalPrice(
    elasticity,
    currentAvgRate,
    currentOccupancy,
    priceFloor,
    priceCeiling
  );

  // Classify demand sensitivity
  const demandSensitivity = classifyElasticity(elasticity);

  // Generate recommendations
  const recommendations = generateRecommendations(
    elasticity,
    demandSensitivity,
    currentAvgRate,
    optimalPrice,
    currentOccupancy,
    priceFloor,
    priceCeiling
  );

  // Confidence based on data volume
  const confidenceScore = Math.min(0.95, 0.3 + (rateData.length / 200) * 0.65);

  const result: ElasticityResult = {
    roomTypeId,
    roomTypeName,
    period,
    elasticityCoefficient: Math.round(elasticity * 1000) / 1000,
    optimalPrice: Math.round(optimalPrice * 100) / 100,
    priceFloor: Math.round(priceFloor * 100) / 100,
    priceCeiling: Math.round(priceCeiling * 100) / 100,
    currentAvgRate: Math.round(currentAvgRate * 100) / 100,
    currentOccupancy: Math.round(currentOccupancy * 10) / 10,
    demandSensitivity,
    historicalDataPoints: bookings.length,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    recommendations,
  };

  // Save to database
  await db.priceElasticityData.upsert({
    where: {
      id: `${roomTypeId}-${period}`,
    },
    create: {
      id: `${roomTypeId}-${period}`,
      tenantId,
      propertyId,
      roomTypeId,
      period,
      dateRange: JSON.stringify({ start: startDate.toISOString(), end: endDate.toISOString() }),
      elasticity: result.elasticityCoefficient,
      optimalPrice: result.optimalPrice,
      priceFloor: result.priceFloor,
      priceCeiling: result.priceCeiling,
      demandAtCurrent: currentOccupancy,
      confidence: result.confidenceScore,
    },
    update: {
      period,
      dateRange: JSON.stringify({ start: startDate.toISOString(), end: endDate.toISOString() }),
      elasticity: result.elasticityCoefficient,
      optimalPrice: result.optimalPrice,
      priceFloor: result.priceFloor,
      priceCeiling: result.priceCeiling,
      demandAtCurrent: currentOccupancy,
      confidence: result.confidenceScore,
    },
  });

  return result;
}

function buildRateBuckets(
  rates: number[],
  totalNightsBooked: number,
  totalAvailableNights: number
): RateOccupancyBucket[] {
  if (rates.length === 0) return [];

  const sorted = [...rates].sort((a, b) => a - b);
  const bucketCount = Math.min(5, Math.max(3, Math.ceil(rates.length / 10)));
  const bucketSize = Math.ceil(sorted.length / bucketCount);

  const buckets: RateOccupancyBucket[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const start = i * bucketSize;
    const end = Math.min((i + 1) * bucketSize, sorted.length);
    const bucketRates = sorted.slice(start, end);

    if (bucketRates.length === 0) continue;

    const avgRate = bucketRates.reduce((a, b) => a + b, 0) / bucketRates.length;
    const bucketBookings = bucketRates.length;
    const occupancyShare = totalAvailableNights > 0
      ? (bucketBookings / totalAvailableNights) * 100
      : 0;

    buckets.push({
      rateRange: `$${Math.round(avgRate)}`,
      avgRate,
      totalBookings: bucketBookings,
      occupancyRate: occupancyShare,
      revenuePerAvailableRoom: avgRate * occupancyShare / 100,
    });
  }

  return buckets;
}

function calculateElasticity(buckets: RateOccupancyBucket[]): number {
  if (buckets.length < 2) return -1.0; // Default to unitary elasticity

  // Simple point elasticity calculation using first and last buckets
  const lowest = buckets[0];
  const highest = buckets[buckets.length - 1];

  if (lowest.avgRate === 0 || lowest.totalBookings === 0) return -1.0;

  // % change in quantity demanded / % change in price
  const priceChange = (highest.avgRate - lowest.avgRate) / lowest.avgRate;
  const quantityChange = (highest.totalBookings - lowest.totalBookings) / lowest.totalBookings;

  if (priceChange === 0) return -1.0;

  const elasticity = quantityChange / priceChange;

  // Elasticity should be negative (law of demand)
  return Math.max(-5, Math.min(0, elasticity));
}

function calculateOptimalPrice(
  elasticity: number,
  currentRate: number,
  currentOccupancy: number,
  priceFloor: number,
  priceCeiling: number
): number {
  // If demand is elastic (|e| > 1), lowering price increases total revenue
  // If demand is inelastic (|e| < 1), raising price increases total revenue
  // Optimal price where marginal revenue = marginal cost

  const absElasticity = Math.abs(elasticity);

  if (absElasticity > 1.5) {
    // Very elastic - demand drops sharply with price increases
    // Lower price to drive volume
    const optimalPrice = currentRate * (1 - (absElasticity - 1) * 0.05);
    return Math.max(priceFloor, Math.min(priceCeiling, optimalPrice));
  } else if (absElasticity > 1.0) {
    // Elastic - moderate price sensitivity
    const optimalPrice = currentRate * 0.97;
    return Math.max(priceFloor, Math.min(priceCeiling, optimalPrice));
  } else if (absElasticity > 0.5) {
    // Inelastic - can raise price somewhat
    if (currentOccupancy > 80) {
      const optimalPrice = currentRate * 1.10;
      return Math.max(priceFloor, Math.min(priceCeiling, optimalPrice));
    }
    return currentRate;
  } else {
    // Very inelastic - guests are not price sensitive
    if (currentOccupancy > 75) {
      const optimalPrice = currentRate * 1.15;
      return Math.max(priceFloor, Math.min(priceCeiling, optimalPrice));
    }
    return currentRate * 1.05;
  }
}

function classifyElasticity(elasticity: number): 'elastic' | 'normal' | 'inelastic' {
  const absE = Math.abs(elasticity);
  if (absE > 1.2) return 'elastic';
  if (absE < 0.8) return 'inelastic';
  return 'normal';
}

function generateRecommendations(
  elasticity: number,
  sensitivity: string,
  currentRate: number,
  optimalPrice: number,
  occupancy: number,
  priceFloor: number,
  priceCeiling: number
): string[] {
  const recs: string[] = [];
  const absE = Math.abs(elasticity);

  if (sensitivity === 'elastic') {
    recs.push('Demand is highly sensitive to price changes. Consider competitive pricing.');
    if (optimalPrice < currentRate) {
      recs.push(`Lowering rates by ${Math.round((1 - optimalPrice / currentRate) * 100)}% could increase revenue.`);
    }
    recs.push('Focus on value-add packages rather than price cuts to maintain perceived value.');
  } else if (sensitivity === 'inelastic') {
    recs.push('Demand is not sensitive to price changes. Opportunity to increase rates.');
    if (occupancy > 75) {
      recs.push(`Consider raising rates up to ${Math.round(optimalPrice)} to maximize revenue.`);
    }
    recs.push('Guests prioritize your property over price — premium positioning recommended.');
  } else {
    recs.push('Demand has moderate price sensitivity. Monitor competitor pricing closely.');
    if (occupancy < 60) {
      recs.push('With low occupancy and moderate sensitivity, small rate adjustments can drive demand.');
    }
  }

  if (occupancy > 90) {
    recs.push('Near-full occupancy detected. Consider implementing rate increases for remaining inventory.');
  } else if (occupancy < 50) {
    recs.push('Low occupancy detected. Consider promotional rates to stimulate demand.');
  }

  recs.push(`Rate floor: $${Math.round(priceFloor)} | Rate ceiling: $${Math.round(priceCeiling)}`);
  recs.push(`Current elasticity coefficient: ${absE.toFixed(2)} (industry avg: 1.2)`);

  return recs;
}

function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1));
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
