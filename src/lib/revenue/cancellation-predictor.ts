/**
 * Cancellation Prediction Engine
 * ML-like heuristic model that predicts booking cancellation risk
 * using multiple booking features and historical patterns.
 *
 * Enhanced with time-series forecasting (Holt-Winters) for
 * temporal cancellation probability modeling.
 */

import { db } from '@/lib/db';
import { holtWintersOptimized, mean } from '@/lib/revenue/time-series-forecast';
import { addDays, format, subDays } from 'date-fns';

export interface CancellationPredictionInput {
  bookingId?: string;
  leadTimeDays: number;
  source: string;
  guaranteeType: string;
  depositRequired: boolean;
  depositPaid: boolean;
  isFirstTimeGuest: boolean;
  ratePlanType?: string;
  checkInMonth: number;
  isGroupBooking: boolean;
}

export interface CancellationPredictionResult {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
}

// OTA source identifiers that typically cancel more
const OTA_SOURCES = ['booking_com', 'expedia', 'agoda', 'airbnb', 'hotels_com', 'ota_other', 'google_hotels', 'tripadvisor'];

// Months with historically higher cancellation rates (based on industry data)
const HIGH_CANCEL_MONTHS = [1, 4, 5, 9, 10, 12]; // Jan, Apr, May, Sep, Oct, Dec

/**
 * Compute a risk contribution (0-1) for a single feature.
 * Each feature returns a value between 0 and maxWeight.
 */
function computeFeatureScores(input: CancellationPredictionInput): Array<{ factor: string; weight: number }> {
  const scores: Array<{ factor: string; weight: number }> = [];

  // 1. Lead time (shorter = higher risk) - max 0.20
  if (input.leadTimeDays <= 3) {
    scores.push({ factor: 'Very short lead time (≤3 days)', weight: 0.20 });
  } else if (input.leadTimeDays <= 7) {
    scores.push({ factor: 'Short lead time (≤7 days)', weight: 0.15 });
  } else if (input.leadTimeDays <= 14) {
    scores.push({ factor: 'Moderate lead time (≤14 days)', weight: 0.08 });
  } else if (input.leadTimeDays <= 30) {
    scores.push({ factor: 'Normal lead time (≤30 days)', weight: 0.04 });
  }

  // 2. OTA channel (OTA bookings cancel 2x more) - max 0.18
  const normalizedSource = input.source.toLowerCase().replace(/\./g, '_');
  if (OTA_SOURCES.includes(normalizedSource)) {
    scores.push({ factor: 'OTA channel booking (2x cancellation rate)', weight: 0.18 });
  } else if (['walk_in', 'phone', 'email'].includes(normalizedSource)) {
    scores.push({ factor: 'Direct non-web booking', weight: 0.03 });
  }

  // 3. No deposit (no deposit = higher risk) - max 0.15
  if (!input.depositRequired) {
    scores.push({ factor: 'No deposit required', weight: 0.15 });
  } else if (input.depositRequired && !input.depositPaid) {
    scores.push({ factor: 'Deposit required but not paid', weight: 0.12 });
  }

  // 4. No guarantee type (higher risk) - max 0.12
  if (input.guaranteeType === 'none') {
    scores.push({ factor: 'No guarantee type', weight: 0.12 });
  } else if (input.guaranteeType === 'corporate') {
    scores.push({ factor: 'Corporate guarantee (lower risk)', weight: -0.05 });
  }

  // 5. First-time guest (higher risk) - max 0.10
  if (input.isFirstTimeGuest) {
    scores.push({ factor: 'First-time guest', weight: 0.10 });
  }

  // 6. Rate plan type (promo rates cancel more) - max 0.08
  if (input.ratePlanType) {
    const planType = input.ratePlanType.toLowerCase();
    if (planType.includes('promo') || planType.includes('flash') || planType.includes('last_minute')) {
      scores.push({ factor: 'Promotional/flash rate plan', weight: 0.08 });
    } else if (planType.includes('corporate') || planType.includes('negotiated')) {
      scores.push({ factor: 'Corporate/negotiated rate (lower risk)', weight: -0.04 });
    }
  }

  // 7. Seasonal patterns - max 0.07
  if (HIGH_CANCEL_MONTHS.includes(input.checkInMonth)) {
    scores.push({ factor: 'High-cancellation season', weight: 0.07 });
  }

  // 8. Group booking (groups cancel less but later) - max -0.06
  if (input.isGroupBooking) {
    scores.push({ factor: 'Group booking (lower cancellation risk)', weight: -0.06 });
  }

  return scores;
}

function classifyRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score < 0.25) return 'low';
  if (score < 0.50) return 'medium';
  if (score < 0.75) return 'high';
  return 'critical';
}

// ─── Time-Series Enhanced Cancellation Prediction ─────────────────────────────

export interface TimeSeriesCancellationResult extends CancellationPredictionResult {
  heuristicScore: number;
  timeSeriesScore: number;
  timeSeriesTrend: 'increasing' | 'stable' | 'decreasing';
  historicalAvgRate: number;
  predictedRate: number;
  confidence: number;
  modelAttribution: {
    heuristic: number;   // 0-1 weight
    timeSeries: number;  // 0-1 weight
  };
}

/**
 * Build historical daily cancellation rate time series.
 * Returns array of cancellation rates (0-1) per day.
 */
async function buildCancellationTimeSeries(
  tenantId: string,
  propertyId: string,
  lookbackDays: number = 90
): Promise<{ dates: string[]; rates: number[] }> {
  const startDate = subDays(new Date(), lookbackDays);

  // Get daily booking counts and cancellation counts
  const allBookings = await db.booking.findMany({
    where: {
      tenantId,
 propertyId,
      createdAt: { gte: startDate },
    },
    select: { createdAt: true, status: true, cancelledAt: true },
  });

  // Bucket by day
  const dayStats = new Map<string, { total: number; cancelled: number }>();
  for (const b of allBookings) {
    const dayStr = format(new Date(b.createdAt), 'yyyy-MM-dd');
    const stats = dayStats.get(dayStr) || { total: 0, cancelled: 0 };
    stats.total++;
    if (b.status === 'cancelled' || b.cancelledAt) {
      stats.cancelled++;
    }
    dayStats.set(dayStr, stats);
  }

  // Build continuous time series (fill gaps with overall average)
  const dates: string[] = [];
  const rates: number[] = [];
  let overallRate = 0.12; // Industry default ~12%
  const allRates: number[] = [];
  for (const [, stats] of dayStats) {
    if (stats.total > 0) allRates.push(stats.cancelled / stats.total);
  }
  if (allRates.length > 0) overallRate = allRates.reduce((s, r) => s + r, 0) / allRates.length;

  for (let d = new Date(startDate); d <= new Date(); d = addDays(d, 1)) {
    const dayStr = format(d, 'yyyy-MM-dd');
    dates.push(dayStr);
    const stats = dayStats.get(dayStr);
    rates.push(stats && stats.total > 3 ? stats.cancelled / stats.total : overallRate);
  }

  return { dates, rates };
}

/**
 * Predict cancellation risk with time-series enhancement.
 * Combines the 8-factor heuristic with Holt-Winters forecasting
 * of historical cancellation rates.
 */
export async function predictCancellationRiskWithTimeSeries(
  booking: CancellationPredictionInput,
  tenantId?: string,
  propertyId?: string
): Promise<TimeSeriesCancellationResult> {
  // Run the existing 8-factor heuristic
  const heuristicResult = await predictCancellationRisk(booking);

  // Default time-series values when no DB context
  const tsDefaults = {
    heuristicScore: heuristicResult.riskScore,
    timeSeriesScore: heuristicResult.riskScore * 0.8,
    timeSeriesTrend: 'stable' as const,
    historicalAvgRate: 0.12,
    predictedRate: heuristicResult.riskScore * 0.8,
    confidence: 0.3,
    modelAttribution: { heuristic: 1.0, timeSeries: 0.0 },
  };

  if (!tenantId || !propertyId) {
    return {
      ...heuristicResult,
      ...tsDefaults,
    };
  }

  try {
    // Build cancellation rate time series
    const { rates } = await buildCancellationTimeSeries(tenantId, propertyId);

    if (rates.length < 14) {
      return {
        ...heuristicResult,
        ...tsDefaults,
        timeSeriesScore: heuristicResult.riskScore * 0.9,
        predictedRate: heuristicResult.riskScore * 0.9,
        confidence: 0.2,
      };
    }

    // Run Holt-Winters on cancellation rates
    const hw = holtWintersOptimized(rates, 14);

    // Predicted cancellation rate for the booking's check-in period
    // Use the forecast for the booking's lead-time bucket
    const leadTimeIdx = Math.min(
      hw.predictions.length - 1,
      Math.max(0, Math.floor(booking.leadTimeDays / 7))
    );
    const predictedRate = Math.max(0, Math.min(1, hw.predictions[leadTimeIdx] || mean(rates)));

    // Determine trend from Holt-Winters trend component
    const trendComponent = hw.trend.filter(t => isFinite(t));
    const recentTrend = trendComponent.length > 5
      ? trendComponent.slice(-5).reduce((s, t) => s + t, 0) / 5
      : 0;
    const timeSeriesTrend: 'increasing' | 'stable' | 'decreasing' =
      recentTrend > 0.005 ? 'increasing' : recentTrend < -0.005 ? 'decreasing' : 'stable';

    // Combine heuristic and time-series scores
    // Weight time-series more when we have more data
    const dataWeight = Math.min(0.5, rates.length / 180);
    const heuristicWeight = 1 - dataWeight;

    // Time-series component: adjust base rate by predicted rate trend
    const baseRate = mean(rates);
    const tsScore = Math.max(0, Math.min(1,
      baseRate + (predictedRate - baseRate) * 2
    ));

    // Trend adjustment
    let trendAdjustment = 0;
    if (timeSeriesTrend === 'increasing') trendAdjustment = 0.05;
    else if (timeSeriesTrend === 'decreasing') trendAdjustment = -0.05;

    // Final combined score
    const timeSeriesScore = Math.max(0, Math.min(1, tsScore + trendAdjustment));
    const combinedScore = Math.max(0, Math.min(1,
      heuristicResult.riskScore * heuristicWeight + timeSeriesScore * dataWeight
    ));

    // Merge factors
    const tsFactors: string[] = [];
    tsFactors.push(`Time-series predicted rate: ${(predictedRate * 100).toFixed(1)}%`);
    if (timeSeriesTrend === 'increasing') tsFactors.push('Rising cancellation trend detected');
    else if (timeSeriesTrend === 'decreasing') tsFactors.push('Declining cancellation trend (risk reducer)');
    tsFactors.push(`Historical avg cancellation: ${(baseRate * 100).toFixed(1)}%`);
    tsFactors.push(`TS data points: ${rates.length} days`);

    const allFactors = [
      ...heuristicResult.factors.map(f => `[H] ${f}`),
      ...tsFactors.map(f => `[TS] ${f}`),
    ];

    // Confidence based on data volume and model agreement
    const modelAgreement = 1 - Math.abs(heuristicResult.riskScore - timeSeriesScore);
    const confidence = Math.min(0.95, 0.3 + (rates.length / 180) * 0.5 + modelAgreement * 0.15);

    return {
      riskScore: Math.round(combinedScore * 1000) / 1000,
      riskLevel: classifyRiskLevel(combinedScore),
      factors: allFactors,
      heuristicScore: Math.round(heuristicResult.riskScore * 1000) / 1000,
      timeSeriesScore: Math.round(timeSeriesScore * 1000) / 1000,
      timeSeriesTrend,
      historicalAvgRate: Math.round(baseRate * 1000) / 1000,
      predictedRate: Math.round(predictedRate * 1000) / 1000,
      confidence: Math.round(confidence * 100) / 100,
      modelAttribution: {
        heuristic: Math.round(heuristicWeight * 100) / 100,
        timeSeries: Math.round(dataWeight * 100) / 100,
      },
    };
  } catch (error) {
    console.error('Time-series cancellation prediction failed, using heuristic only:', error);
    return {
      ...heuristicResult,
      ...tsDefaults,
    };
  }
}

/**
 * Run time-series enhanced prediction for a specific booking and save result.
 */
export async function predictAndLogCancellationRiskWithTimeSeries(
  bookingId: string,
  tenantId: string
): Promise<TimeSeriesCancellationResult | null> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true, tenantId: true, propertyId: true,
      confirmationCode: true, primaryGuestId: true,
      checkIn: true, source: true, guaranteeType: true,
      depositRequired: true, depositPaid: true, groupId: true,
      ratePlan: { select: { name: true, code: true } },
      primaryGuest: { select: { totalStays: true } },
    },
  });

  if (!booking || booking.tenantId !== tenantId) return null;

  const now = new Date();
  const leadTimeDays = Math.max(0, Math.ceil((booking.checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const input: CancellationPredictionInput = {
    bookingId: booking.id,
    leadTimeDays,
    source: booking.source,
    guaranteeType: booking.guaranteeType,
    depositRequired: booking.depositRequired,
    depositPaid: booking.depositPaid,
    isFirstTimeGuest: (booking.primaryGuest?.totalStays ?? 0) === 0,
    ratePlanType: booking.ratePlan?.name,
    checkInMonth: booking.checkIn.getMonth() + 1,
    isGroupBooking: !!booking.groupId,
  };

  const result = await predictCancellationRiskWithTimeSeries(input, tenantId, booking.propertyId);

  // Save prediction to log with enhanced factors
  await db.cancellationPredictionLog.create({
    data: {
      tenantId,
      propertyId: booking.propertyId,
      bookingId: booking.id,
      confirmationCode: booking.confirmationCode,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      factors: JSON.stringify(result.factors),
      guestId: booking.primaryGuestId,
      source: booking.source,
      guaranteeType: booking.guaranteeType,
      depositPaid: booking.depositPaid,
      leadTimeDays,
    },
  });

  return result;
}

/**
 * Predict cancellation risk for a given booking.
 * Returns riskScore (0-1), riskLevel, and contributing factors.
 */
export async function predictCancellationRisk(
  booking: CancellationPredictionInput
): Promise<CancellationPredictionResult> {
  const featureScores = computeFeatureScores(booking);

  // Calculate weighted risk score
  // Base risk starts at 0.10 (baseline cancellation probability)
  let riskScore = 0.10;
  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];

  for (const score of featureScores) {
    riskScore += score.weight;
    if (score.weight > 0) {
      positiveFactors.push(score.factor);
    } else {
      negativeFactors.push(score.factor);
    }
  }

  // Clamp between 0 and 1
  riskScore = Math.max(0, Math.min(1, riskScore));

  // Combine all factors (positive = risk increasing, negative = risk decreasing)
  const allFactors = [...positiveFactors, ...negativeFactors.map(f => f + ' (risk reducer)')];

  return {
    riskScore: Math.round(riskScore * 1000) / 1000,
    riskLevel: classifyRiskLevel(riskScore),
    factors: allFactors,
  };
}

/**
 * Run prediction for a specific booking from the database and save the result.
 */
export async function predictAndLogCancellationRisk(
  bookingId: string,
  tenantId: string
): Promise<CancellationPredictionResult | null> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      tenantId: true,
      propertyId: true,
      confirmationCode: true,
      primaryGuestId: true,
      checkIn: true,
      source: true,
      guaranteeType: true,
      depositRequired: true,
      depositPaid: true,
      groupId: true,
      ratePlan: {
        select: { name: true, code: true },
      },
      primaryGuest: {
        select: { totalStays: true },
      },
    },
  });

  if (!booking || booking.tenantId !== tenantId) return null;

  const now = new Date();
  const leadTimeDays = Math.max(
    0,
    Math.ceil((booking.checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  const input: CancellationPredictionInput = {
    bookingId: booking.id,
    leadTimeDays,
    source: booking.source,
    guaranteeType: booking.guaranteeType,
    depositRequired: booking.depositRequired,
    depositPaid: booking.depositPaid,
    isFirstTimeGuest: (booking.primaryGuest?.totalStays ?? 0) === 0,
    ratePlanType: booking.ratePlan?.name,
    checkInMonth: booking.checkIn.getMonth() + 1,
    isGroupBooking: !!booking.groupId,
  };

  const result = await predictCancellationRisk(input);

  // Save prediction to log
  await db.cancellationPredictionLog.create({
    data: {
      tenantId,
      propertyId: booking.propertyId,
      bookingId: booking.id,
      confirmationCode: booking.confirmationCode,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      factors: JSON.stringify(result.factors),
      guestId: booking.primaryGuestId,
      source: booking.source,
      guaranteeType: booking.guaranteeType,
      depositPaid: booking.depositPaid,
      leadTimeDays,
    },
  });

  return result;
}

/**
 * Run batch predictions for all upcoming confirmed/reserved bookings.
 */
export async function runBatchPredictions(
  tenantId: string,
  propertyId?: string
): Promise<{ processed: number; results: CancellationPredictionResult[] }> {
  const now = new Date();

  const bookings = await db.booking.findMany({
    where: {
      tenantId,
      status: { in: ['confirmed', 'reserved'] },
      checkIn: { gte: now },
      ...(propertyId ? { propertyId } : {}),
    },
    select: {
      id: true,
      tenantId: true,
      propertyId: true,
      confirmationCode: true,
      primaryGuestId: true,
      checkIn: true,
      source: true,
      guaranteeType: true,
      depositRequired: true,
      depositPaid: true,
      groupId: true,
      ratePlan: { select: { name: true } },
      primaryGuest: { select: { totalStays: true } },
    },
    take: 500,
  });

  const results: CancellationPredictionResult[] = [];

  for (const booking of bookings) {
    const leadTimeDays = Math.max(
      0,
      Math.ceil((booking.checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    const input: CancellationPredictionInput = {
      bookingId: booking.id,
      leadTimeDays,
      source: booking.source,
      guaranteeType: booking.guaranteeType,
      depositRequired: booking.depositRequired,
      depositPaid: booking.depositPaid,
      isFirstTimeGuest: (booking.primaryGuest?.totalStays ?? 0) === 0,
      ratePlanType: booking.ratePlan?.name,
      checkInMonth: booking.checkIn.getMonth() + 1,
      isGroupBooking: !!booking.groupId,
    };

    const result = await predictCancellationRisk(input);
    results.push(result);

    // Save to log
    await db.cancellationPredictionLog.create({
      data: {
        tenantId,
        propertyId: booking.propertyId,
        bookingId: booking.id,
        confirmationCode: booking.confirmationCode,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        factors: JSON.stringify(result.factors),
        guestId: booking.primaryGuestId,
        source: booking.source,
        guaranteeType: booking.guaranteeType,
        depositPaid: booking.depositPaid,
        leadTimeDays,
      },
    });
  }

  return { processed: bookings.length, results };
}
