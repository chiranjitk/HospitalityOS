/**
 * Cancellation Prediction Engine
 * ML-like heuristic model that predicts booking cancellation risk
 * using multiple booking features and historical patterns.
 */

import { db } from '@/lib/db';

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
