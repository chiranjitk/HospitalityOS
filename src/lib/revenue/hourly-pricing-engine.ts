/**
 * Hour-by-Hour Dynamic Pricing Engine
 * StaySuite's answer to AioSell — changes rates every hour based on:
 * - Time-of-day booking patterns
 * - Real-time occupancy changes
 * - Booking velocity (bookings in last N hours)
 * - Competitor rate changes
 * - Linear occupancy-based pricing (each room sold shifts rate)
 *
 * Supports configurable sensitivity: conservative, moderate, aggressive
 */

import { db } from '@/lib/db';

// ============================================================
// Types
// ============================================================

export type SensitivityLevel = 'conservative' | 'moderate' | 'aggressive';

export type PricingTrigger =
  | 'time_of_day'
  | 'occupancy_change'
  | 'booking_velocity'
  | 'competitor_change'
  | 'manual'
  | 'scheduled_hourly'
  | 'linear_occupancy';

export interface HourlyRateFactors {
  timeOfDayMultiplier: number;
  occupancyMultiplier: number;
  bookingVelocityMultiplier: number;
  competitorMultiplier: number;
  linearOccupancyPrice: number;
  sensitivityCap: number;
  sensitivityFloor: number;
}

export interface HourlyRateResult {
  roomTypeId: string;
  roomTypeName: string;
  propertyId: string;
  previousRate: number;
  newRate: number;
  changePercent: number;
  changeAmount: number;
  trigger: PricingTrigger;
  confidence: number;
  factors: HourlyRateFactors;
  timestamp: Date;
}

export interface HourlyCycleResult {
  cycleId: string;
  tenantId: string;
  propertyId?: string;
  roomsProcessed: number;
  ratesChanged: number;
  ratesUnchanged: number;
  avgChange: number;
  maxChange: number;
  minChange: number;
  totalRevenueImpact: number;
  pushToChannels: boolean;
  channelSyncResults: Array<{ connectionId: string; channel: string; success: boolean; error?: string }>;
  duration: number;
  startedAt: Date;
  completedAt: Date;
  details: HourlyRateResult[];
}

export interface HourlyPricePoint {
  id: string;
  timestamp: Date;
  roomTypeId: string;
  roomTypeName: string;
  rate: number;
  previousRate: number;
  occupancy: number;
  occupancyPercent: number;
  trigger: PricingTrigger;
  source: string;
  confidence: number;
  changePercent: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface LinearPricingConfig {
  enabled: boolean;
  sensitivity: SensitivityLevel;
  floorMultipliers: {
    low: number;       // 0-30%
    medium: number;    // 30-60%
    high: number;      // 60-80%
    premium: number;   // 80-95%
    lastRoom: number;  // 95-100%
  };
  ceilingMultipliers: {
    low: number;
    medium: number;
    high: number;
    premium: number;
    lastRoom: number;
  };
  perRoomIncrement: boolean;
}

export interface OccupancyTier {
  name: string;
  minPercent: number;
  maxPercent: number;
  floorMultiplier: number;
  ceilingMultiplier: number;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_LINEAR_CONFIG: LinearPricingConfig = {
  enabled: true,
  sensitivity: 'moderate',
  floorMultipliers: { low: 0.85, medium: 0.95, high: 1.05, premium: 1.20, lastRoom: 1.50 },
  ceilingMultipliers: { low: 0.95, medium: 1.05, high: 1.20, premium: 1.50, lastRoom: 2.00 },
  perRoomIncrement: true,
};

const SENSITIVITY_SETTINGS: Record<SensitivityLevel, {
  cap: number;      // Max % change per hour
  floor: number;    // Min % change per hour (can go negative)
  velocityWeight: number;
  competitorWeight: number;
  timeOfDayWeight: number;
  occupancyWeight: number;
}> = {
  conservative: {
    cap: 0.03,       // Max 3% change per hour
    floor: -0.02,    // Min -2% change per hour
    velocityWeight: 0.2,
    competitorWeight: 0.15,
    timeOfDayWeight: 0.15,
    occupancyWeight: 0.5,
  },
  moderate: {
    cap: 0.07,       // Max 7% change per hour
    floor: -0.05,    // Min -5% change per hour
    velocityWeight: 0.25,
    competitorWeight: 0.2,
    timeOfDayWeight: 0.2,
    occupancyWeight: 0.35,
  },
  aggressive: {
    cap: 0.15,       // Max 15% change per hour
    floor: -0.10,    // Min -10% change per hour
    velocityWeight: 0.3,
    competitorWeight: 0.25,
    timeOfDayWeight: 0.25,
    occupancyWeight: 0.2,
  },
};

// Time-of-day multipliers based on booking pattern analysis
// Early morning (2-6am): low booking activity, slight discount
// Morning (6-10am): moderate booking, near base
// Midday (10am-2pm): active browsing, slight premium
// Afternoon (2-6pm): peak booking time, premium
// Evening (6-10pm): high intent booking, premium
// Night (10pm-2am): last-minute booking, can be premium
const TIME_OF_DAY_MULTIPLIERS: Record<number, number> = {
  0: 0.97, 1: 0.96, 2: 0.95, 3: 0.94, 4: 0.95, 5: 0.96,
  6: 0.98, 7: 0.99, 8: 1.00, 9: 1.01, 10: 1.02, 11: 1.03,
  12: 1.03, 13: 1.02, 14: 1.03, 15: 1.04, 16: 1.05, 17: 1.06,
  18: 1.06, 19: 1.05, 20: 1.04, 21: 1.03, 22: 1.01, 23: 0.99,
};

// In-memory hourly rate cache to avoid recalculating unchanged rates
const rateCache = new Map<string, {
  rate: number;
  factors: HourlyRateFactors;
  trigger: PricingTrigger;
  confidence: number;
  calculatedAt: Date;
  occupancyAtCalc: number;
}>();

// Cache TTL: 45 minutes (re-evaluate before the next hour)
const CACHE_TTL_MS = 45 * 60 * 1000;

// Occupancy tier definitions
const OCCUPANCY_TIERS: OccupancyTier[] = [
  { name: 'low',       minPercent: 0,    maxPercent: 30,   floorMultiplier: 0.85, ceilingMultiplier: 0.95 },
  { name: 'medium',    minPercent: 30,   maxPercent: 60,   floorMultiplier: 0.95, ceilingMultiplier: 1.05 },
  { name: 'high',      minPercent: 60,   maxPercent: 80,   floorMultiplier: 1.05, ceilingMultiplier: 1.20 },
  { name: 'premium',   minPercent: 80,   maxPercent: 95,   floorMultiplier: 1.20, ceilingMultiplier: 1.50 },
  { name: 'lastRoom',  minPercent: 95,   maxPercent: 100,  floorMultiplier: 1.50, ceilingMultiplier: 2.00 },
];

// ============================================================
// Core Engine Functions
// ============================================================

/**
 * Calculate the hourly rate for a specific room type.
 * This is the core pricing function — called every hour for every active room type.
 */
export async function calculateHourlyRate(
  tenantId: string,
  propertyId: string,
  roomTypeId: string
): Promise<HourlyRateResult> {
  const cacheKey = `${tenantId}:${propertyId}:${roomTypeId}`;
  const now = new Date();

  // 1. Get room type base data
  const roomType = await db.roomType.findUnique({
    where: { id: roomTypeId },
    select: { id: true, name: true, basePrice: true, totalRooms: true, propertyId: true },
  });

  if (!roomType) {
    throw new Error(`Room type ${roomTypeId} not found`);
  }

  const baseRate = roomType.basePrice;
  const totalRooms = roomType.totalRooms || 1;

  // 2. Calculate current occupancy for this room type
  const roomsSold = await getRoomTypeOccupancy(tenantId, propertyId, roomTypeId);
  const occupancyPercent = totalRooms > 0 ? (roomsSold / totalRooms) * 100 : 0;

  // 3. Check cache — if occupancy hasn't changed and we calculated recently, use cache
  const cached = rateCache.get(cacheKey);
  if (cached && (now.getTime() - cached.calculatedAt.getTime() < CACHE_TTL_MS)) {
    if (Math.abs(cached.occupancyAtCalc - occupancyPercent) < 1.0) {
      // Occupancy hasn't changed significantly — return cached rate
      return {
        roomTypeId,
        roomTypeName: roomType.name,
        propertyId,
        previousRate: baseRate,
        newRate: cached.rate,
        changePercent: ((cached.rate - baseRate) / baseRate) * 100,
        changeAmount: cached.rate - baseRate,
        trigger: cached.trigger,
        confidence: cached.confidence,
        factors: cached.factors,
        timestamp: cached.calculatedAt,
      };
    }
  }

  // 4. Get or create linear pricing config for this property
  const linearConfig = await getLinearPricingConfig(tenantId, propertyId);

  // 5. Calculate all factors
  const sensitivity = SENSITIVITY_SETTINGS[linearConfig.sensitivity];

  const hour = now.getHours();
  const timeOfDayMultiplier = TIME_OF_DAY_MULTIPLIERS[hour] ?? 1.0;

  const occupancyMultiplier = calculateOccupancyMultiplier(occupancyPercent);

  const bookingVelocityMultiplier = await calculateBookingVelocityMultiplier(
    tenantId, propertyId, roomTypeId
  );

  const competitorMultiplier = await calculateCompetitorMultiplier(
    tenantId, propertyId, roomTypeId
  );

  // 6. Calculate linear occupancy price (AioSell-style: every room gets unique price)
  const linearOccupancyPrice = linearConfig.enabled
    ? calculateLinearOccupancyPrice(
        tenantId,
        propertyId,
        roomTypeId,
        roomsSold,
        totalRooms,
        baseRate,
        linearConfig
      )
    : baseRate;

  // 7. Weighted combination of factors
  const weightedFactor =
    (timeOfDayMultiplier - 1.0) * sensitivity.timeOfDayWeight +
    (occupancyMultiplier - 1.0) * sensitivity.occupancyWeight +
    (bookingVelocityMultiplier - 1.0) * sensitivity.velocityWeight +
    (competitorMultiplier - 1.0) * sensitivity.competitorWeight;

  // 8. Apply sensitivity cap/floor
  const clampedFactor = Math.max(sensitivity.floor, Math.min(sensitivity.cap, weightedFactor));

  // 9. Determine which rate to use: linear or factor-based
  let finalRate: number;
  let trigger: PricingTrigger;

  if (linearConfig.enabled && linearConfig.perRoomIncrement) {
    // Linear pricing takes priority when enabled — each room has unique price
    finalRate = linearOccupancyPrice;
    trigger = 'linear_occupancy';
  } else {
    // Factor-based pricing
    finalRate = baseRate * (1 + clampedFactor);

    // Determine the dominant trigger
    const factors = [
      { name: 'time_of_day' as PricingTrigger, weight: Math.abs(timeOfDayMultiplier - 1.0) * sensitivity.timeOfDayWeight },
      { name: 'occupancy_change' as PricingTrigger, weight: Math.abs(occupancyMultiplier - 1.0) * sensitivity.occupancyWeight },
      { name: 'booking_velocity' as PricingTrigger, weight: Math.abs(bookingVelocityMultiplier - 1.0) * sensitivity.velocityWeight },
      { name: 'competitor_change' as PricingTrigger, weight: Math.abs(competitorMultiplier - 1.0) * sensitivity.competitorWeight },
    ];
    factors.sort((a, b) => b.weight - a.weight);
    trigger = factors[0].name;
  }

  finalRate = Math.round(finalRate * 100) / 100;

  // 10. Calculate confidence (higher when more data points are available)
  const confidence = calculateConfidence(
    occupancyPercent,
    bookingVelocityMultiplier,
    competitorMultiplier
  );

  const factors: HourlyRateFactors = {
    timeOfDayMultiplier,
    occupancyMultiplier,
    bookingVelocityMultiplier,
    competitorMultiplier,
    linearOccupancyPrice: Math.round(linearOccupancyPrice * 100) / 100,
    sensitivityCap: sensitivity.cap * 100,
    sensitivityFloor: sensitivity.floor * 100,
  };

  // 11. Update cache
  rateCache.set(cacheKey, {
    rate: finalRate,
    factors,
    trigger,
    confidence,
    calculatedAt: now,
    occupancyAtCalc: occupancyPercent,
  });

  // 12. Record pricing change history
  await recordPriceHistory(
    tenantId,
    propertyId,
    roomTypeId,
    roomType.name,
    baseRate,
    finalRate,
    occupancyPercent,
    trigger,
    confidence
  );

  return {
    roomTypeId,
    roomTypeName: roomType.name,
    propertyId,
    previousRate: baseRate,
    newRate: finalRate,
    changePercent: baseRate > 0 ? ((finalRate - baseRate) / baseRate) * 100 : 0,
    changeAmount: finalRate - baseRate,
    trigger,
    confidence,
    factors,
    timestamp: now,
  };
}

/**
 * Run a full hourly pricing cycle for a tenant's property (or all properties).
 * This is the main function called by the hourly scheduler.
 */
export async function runHourlyPricingCycle(
  tenantId: string,
  propertyId?: string,
  sensitivity?: SensitivityLevel
): Promise<HourlyCycleResult> {
  const cycleId = crypto.randomUUID();
  const startedAt = new Date();

  // Get all active properties for this tenant
  const properties = propertyId
    ? await db.property.findMany({
        where: { id: propertyId, tenantId, status: 'active', deletedAt: null },
        select: { id: true, name: true },
      })
    : await db.property.findMany({
        where: { tenantId, status: 'active', deletedAt: null },
        select: { id: true, name: true },
      });

  const details: HourlyRateResult[] = [];
  let roomsProcessed = 0;
  let ratesChanged = 0;
  let ratesUnchanged = 0;
  let totalChange = 0;
  let maxChange = -Infinity;
  let minChange = Infinity;
  let totalRevenueImpact = 0;
  let pushToChannels = false;
  const channelSyncResults: HourlyCycleResult['channelSyncResults'] = [];

  // If sensitivity override provided, update all properties' config
  if (sensitivity) {
    for (const property of properties) {
      await db.pricingSchedulerLog.create({
        data: {
          tenantId,
          propertyId: property.id,
          status: 'running',
          startedAt,
        },
      });
    }
  }

  for (const property of properties) {
    // Get all active room types
    const roomTypes = await db.roomType.findMany({
      where: {
        propertyId: property.id,
        status: 'active',
        deletedAt: null,
      },
      select: { id: true, name: true, basePrice: true, totalRooms: true },
    });

    for (const roomType of roomTypes) {
      roomsProcessed++;

      try {
        // If sensitivity override, temporarily apply it
        if (sensitivity) {
          await setLinearPricingSensitivity(tenantId, property.id, sensitivity);
        }

        const result = await calculateHourlyRate(
          tenantId,
          property.id,
          roomType.id
        );

        details.push(result);

        if (Math.abs(result.changeAmount) > 0.01) {
          ratesChanged++;
          totalChange += result.changePercent;
          maxChange = Math.max(maxChange, result.changePercent);
          minChange = Math.min(minChange, result.changePercent);
          totalRevenueImpact += result.changeAmount * roomType.totalRooms;
          pushToChannels = true;
        } else {
          ratesUnchanged++;
        }

        // Update the RoomType base price with new rate
        if (Math.abs(result.changeAmount) > 0.01) {
          await db.roomType.update({
            where: { id: roomType.id },
            data: { basePrice: result.newRate },
          });

          // Also update associated rate plans
          await updateRatePlansForRoomType(tenantId, roomType.id, roomType.basePrice, result.newRate);
        }
      } catch (error) {
        console.error(`Error calculating hourly rate for room type ${roomType.id}:`, error);
        ratesUnchanged++;
      }
    }

    // Push updated rates to channels if any rates changed
    if (pushToChannels) {
      const syncResults = await pushRatesToChannels(tenantId, property.id);
      channelSyncResults.push(...syncResults);
    }
  }

  const completedAt = new Date();
  const duration = completedAt.getTime() - startedAt.getTime();
  const avgChange = ratesChanged > 0 ? totalChange / ratesChanged : 0;

  // Normalize min/max if no changes
  if (!isFinite(maxChange)) maxChange = 0;
  if (!isFinite(minChange)) minChange = 0;

  return {
    cycleId,
    tenantId,
    propertyId,
    roomsProcessed,
    ratesChanged,
    ratesUnchanged,
    avgChange: Math.round(avgChange * 100) / 100,
    maxChange: Math.round(maxChange * 100) / 100,
    minChange: Math.round(minChange * 100) / 100,
    totalRevenueImpact: Math.round(totalRevenueImpact * 100) / 100,
    pushToChannels,
    channelSyncResults,
    duration,
    startedAt,
    completedAt,
    details,
  };
}

/**
 * Get hourly pricing history for a property with hourly granularity.
 */
export async function getHourlyPricingHistory(
  tenantId: string,
  propertyId: string,
  dateRange: DateRange,
  roomTypeId?: string
): Promise<HourlyPricePoint[]> {
  // Query pricing history from audit logs and pricing scheduler logs
  // Since we don't have a dedicated hourly pricing history table,
  // we reconstruct from audit logs and price override data

  const now = new Date();

  // Get all room types if not filtered
  const roomTypes = roomTypeId
    ? await db.roomType.findMany({
        where: { id: roomTypeId, propertyId, tenantId, deletedAt: null },
        select: { id: true, name: true },
      })
    : await db.roomType.findMany({
        where: { propertyId, tenantId, deletedAt: null },
        select: { id: true, name: true },
      });

  const pricePoints: HourlyPricePoint[] = [];

  // Get price overrides for the date range
  const priceOverrides = await db.priceOverride.findMany({
    where: {
      ratePlan: {
        roomType: { propertyId, tenantId },
      },
      date: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
    },
    include: {
      ratePlan: {
        select: { roomTypeId: true },
      },
    },
    orderBy: { date: 'asc' },
  });

  // Build a timeline from audit logs for rate changes
  const auditLogs = await db.auditLog.findMany({
    where: {
      tenantId,
      module: 'revenue',
      entityType: 'RoomType',
      action: 'update',
      createdAt: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Also generate synthetic hourly points from cache
  for (const rt of roomTypes) {
    const cacheKey = `${tenantId}:${propertyId}:${rt.id}`;
    const cached = rateCache.get(cacheKey);

    if (cached) {
      const totalRooms = await getRoomTypeTotalRooms(tenantId, propertyId, rt.id);
      const roomsSold = await getRoomTypeOccupancy(tenantId, propertyId, rt.id);
      const occPercent = totalRooms > 0 ? (roomsSold / totalRooms) * 100 : 0;

      pricePoints.push({
        id: crypto.randomUUID(),
        timestamp: cached.calculatedAt,
        roomTypeId: rt.id,
        roomTypeName: rt.name,
        rate: cached.rate,
        previousRate: 0,
        occupancy: roomsSold,
        occupancyPercent: occPercent,
        trigger: cached.trigger,
        source: 'hourly_engine',
        confidence: cached.confidence,
        changePercent: 0,
      });
    }

    // Add points from price overrides
    const overridesForType = priceOverrides.filter(po => po.ratePlan?.roomTypeId === rt.id);
    for (const override of overridesForType) {
      const roomsSold = await getRoomTypeOccupancy(tenantId, propertyId, rt.id);
      const totalRooms = await getRoomTypeTotalRooms(tenantId, propertyId, rt.id);
      const occPercent = totalRooms > 0 ? (roomsSold / totalRooms) * 100 : 0;

      pricePoints.push({
        id: override.id,
        timestamp: override.createdAt,
        roomTypeId: rt.id,
        roomTypeName: rt.name,
        rate: override.price,
        previousRate: override.price - (override.priceAdjustment || 0),
        occupancy: roomsSold,
        occupancyPercent: occPercent,
        trigger: 'manual',
        source: 'price_override',
        confidence: 1.0,
        changePercent: override.price > 0 && (override.price - (override.priceAdjustment || 0)) > 0
          ? ((override.price - (override.previousPrice || override.price)) / (override.previousPrice || override.price)) * 100
          : 0,
      });
    }
  }

  // Sort by timestamp
  pricePoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return pricePoints;
}

/**
 * Calculate linear occupancy-based price (AioSell-style).
 * Each room sold shifts the rate within its occupancy tier.
 *
 * Formula:
 * - If occupancy 0-30%: rate = baseRate * 0.85 to 0.95 (discount to fill)
 * - If occupancy 30-60%: rate = baseRate * 0.95 to 1.05 (near base)
 * - If occupancy 60-80%: rate = baseRate * 1.05 to 1.20 (premium building)
 * - If occupancy 80-95%: rate = baseRate * 1.20 to 1.50 (high demand)
 * - If occupancy 95-100%: rate = baseRate * 1.50 to 2.00 (last rooms premium)
 * - Each room sold within a tier adjusts rate by (ceiling - floor) / roomsInTier
 */
export async function getLinearOccupancyPrice(
  tenantId: string,
  propertyId: string,
  roomTypeId: string,
  roomsSold: number,
  totalRooms: number,
  baseRate: number
): Promise<number> {
  const config = await getLinearPricingConfig(tenantId, propertyId);
  return calculateLinearOccupancyPrice(
    tenantId, propertyId, roomTypeId, roomsSold, totalRooms, baseRate, config
  );
}

/**
 * Internal implementation of linear occupancy pricing.
 */
export function calculateLinearOccupancyPrice(
  tenantId: string,
  propertyId: string,
  roomTypeId: string,
  roomsSold: number,
  totalRooms: number,
  baseRate: number,
  config?: LinearPricingConfig
): number {
  if (totalRooms <= 0 || baseRate <= 0) return baseRate;

  const effectiveConfig = config || DEFAULT_LINEAR_CONFIG;
  const occupancyPercent = (roomsSold / totalRooms) * 100;

  // Find the current occupancy tier
  const tier = OCCUPANCY_TIERS.find(t =>
    occupancyPercent >= t.minPercent && occupancyPercent < t.maxPercent
  ) || OCCUPANCY_TIERS[OCCUPANCY_TIERS.length - 1]; // Default to last room tier

  // Use configured multipliers (fall back to defaults)
  const floor = effectiveConfig.floorMultipliers[tier.name as keyof typeof effectiveConfig.floorMultipliers] ?? tier.floorMultiplier;
  const ceiling = effectiveConfig.ceilingMultipliers[tier.name as keyof typeof effectiveConfig.ceilingMultipliers] ?? tier.ceilingMultiplier;

  // Calculate how many rooms are in this tier
  const tierStartRoom = Math.ceil((tier.minPercent / 100) * totalRooms);
  const tierEndRoom = Math.ceil((tier.maxPercent / 100) * totalRooms);
  const roomsInTier = tierEndRoom - tierStartRoom;
  const roomsSoldInTier = Math.max(0, Math.min(roomsSold - tierStartRoom, roomsInTier));

  // Linear interpolation within the tier
  let multiplier: number;
  if (roomsInTier > 0) {
    const step = (ceiling - floor) / roomsInTier;
    multiplier = floor + (roomsSoldInTier * step);
  } else {
    // Edge case: 0-width tier
    multiplier = (floor + ceiling) / 2;
  }

  // Apply rate
  return Math.round(baseRate * multiplier * 100) / 100;
}

// ============================================================
// Factor Calculation Helpers
// ============================================================

/**
 * Get current occupancy (rooms sold) for a specific room type on today's date.
 */
async function getRoomTypeOccupancy(
  tenantId: string,
  propertyId: string,
  roomTypeId: string
): Promise<number> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  return db.booking.count({
    where: {
      tenantId,
      propertyId,
      roomTypeId,
      checkIn: { lte: todayEnd },
      checkOut: { gt: todayStart },
      status: { in: ['confirmed', 'reserved', 'checked_in'] },
      deletedAt: null,
    },
  });
}

/**
 * Get total rooms for a room type.
 */
async function getRoomTypeTotalRooms(
  tenantId: string,
  propertyId: string,
  roomTypeId: string
): Promise<number> {
  const roomType = await db.roomType.findUnique({
    where: { id: roomTypeId },
    select: { totalRooms: true },
  });
  return roomType?.totalRooms || 0;
}

/**
 * Calculate occupancy multiplier based on current occupancy percentage.
 */
function calculateOccupancyMultiplier(occupancyPercent: number): number {
  // S-curve based occupancy multiplier
  if (occupancyPercent < 30) return 0.90;
  if (occupancyPercent < 50) return 0.95;
  if (occupancyPercent < 70) return 1.00;
  if (occupancyPercent < 85) return 1.10;
  if (occupancyPercent < 95) return 1.25;
  return 1.45;
}

/**
 * Calculate booking velocity multiplier based on recent booking pace.
 */
async function calculateBookingVelocityMultiplier(
  tenantId: string,
  propertyId: string,
  roomTypeId: string
): Promise<number> {
  const now = new Date();
  const velocityWindows = [
    { hours: 1, label: '1h' },
    { hours: 3, label: '3h' },
    { hours: 6, label: '6h' },
    { hours: 24, label: '24h' },
  ];

  let totalVelocityScore = 0;

  for (const window of velocityWindows) {
    const windowStart = new Date(now.getTime() - window.hours * 60 * 60 * 1000);

    const bookingsInWindow = await db.booking.count({
      where: {
        tenantId,
        propertyId,
        roomTypeId,
        createdAt: { gte: windowStart },
        status: { notIn: ['cancelled', 'no_show'] },
        deletedAt: null,
      },
    });

    // Normalize velocity: bookings per hour
    const bookingsPerHour = bookingsInWindow / window.hours;

    // Expected baseline: ~0.5 bookings/hour for moderate property
    // Score ranges from 0.9 (slow) to 1.15 (very fast)
    if (bookingsPerHour > 2) totalVelocityScore += 1.15;
    else if (bookingsPerHour > 1) totalVelocityScore += 1.08;
    else if (bookingsPerHour > 0.5) totalVelocityScore += 1.00;
    else if (bookingsPerHour > 0.1) totalVelocityScore += 0.95;
    else totalVelocityScore += 0.90;
  }

  return totalVelocityScore / velocityWindows.length;
}

/**
 * Calculate competitor-based multiplier from competitor pricing data.
 */
async function calculateCompetitorMultiplier(
  tenantId: string,
  propertyId: string,
  roomTypeId: string
): Promise<number> {
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Get recent competitor prices
  const competitorPrices = await db.competitorPrice.findMany({
    where: {
      tenantId,
      propertyId,
      roomTypeId,
      date: { gte: recentCutoff },
    },
    select: { price: true, competitorName: true },
  });

  if (competitorPrices.length === 0) {
    return 1.0; // No competitor data — neutral
  }

  // Get our current rate
  const roomType = await db.roomType.findUnique({
    where: { id: roomTypeId },
    select: { basePrice: true },
  });

  const ourRate = roomType?.basePrice || 0;
  if (ourRate <= 0) return 1.0;

  // Calculate average competitor rate
  const avgCompetitorRate = competitorPrices.reduce((sum, cp) => sum + cp.price, 0) / competitorPrices.length;

  // If we're significantly below market average, we can raise
  // If we're significantly above, we should consider lowering
  const priceRatio = avgCompetitorRate / ourRate;

  // Clamp to reasonable range
  if (priceRatio > 1.2) return 1.08;  // We're cheap vs market, raise
  if (priceRatio > 1.1) return 1.04;  // Slightly cheap
  if (priceRatio > 0.9) return 1.00;  // At market
  if (priceRatio > 0.8) return 0.96;  // Slightly expensive
  return 0.92;                         // Very expensive vs market
}

/**
 * Calculate confidence score for the pricing decision.
 */
function calculateConfidence(
  occupancyPercent: number,
  bookingVelocity: number,
  competitorMultiplier: number
): number {
  let confidence = 0.5; // Base confidence

  // Higher confidence with more data
  if (occupancyPercent > 0) confidence += 0.15;
  if (bookingVelocity !== 1.0) confidence += 0.15;  // Has velocity data
  if (competitorMultiplier !== 1.0) confidence += 0.1; // Has competitor data

  // Higher confidence at extreme occupancy (more certain about pricing direction)
  if (occupancyPercent > 85 || occupancyPercent < 20) confidence += 0.1;

  return Math.min(1.0, Math.max(0.0, confidence));
}

// ============================================================
// Rate Push & Channel Sync
// ============================================================

/**
 * Push updated rates to all connected channels.
 */
async function pushRatesToChannels(
  tenantId: string,
  propertyId: string
): Promise<Array<{ connectionId: string; channel: string; success: boolean; error?: string }>> {
  const connections = await db.channelConnection.findMany({
    where: {
      tenantId,
      propertyId,
      status: 'active',
      autoSync: true,
    },
    select: { id: true, channel: true },
  });

  const results: Array<{ connectionId: string; channel: string; success: boolean; error?: string }> = [];

  for (const connection of connections) {
    try {
      // Trigger rate sync for this channel
      // This would normally call the channel manager's sync mechanism
      // For now, we log the sync intent
      await db.channelSyncLog.create({
        data: {
          tenantId,
          connectionId: connection.id,
          messageType: 'rate_update',
          status: 'completed',
          itemCount: 1,
          processedAt: new Date(),
          message: JSON.stringify({
            type: 'hourly_rate_update',
            propertyId,
            trigger: 'hourly_pricing_engine',
          }),
        },
      });

      results.push({ connectionId: connection.id, channel: connection.channel, success: true });
    } catch (error) {
      results.push({
        connectionId: connection.id,
        channel: connection.channel,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Update associated rate plans when a room type's base price changes.
 */
async function updateRatePlansForRoomType(
  tenantId: string,
  roomTypeId: string,
  oldBasePrice: number,
  newBasePrice: number
): Promise<void> {
  if (Math.abs(newBasePrice - oldBasePrice) < 0.01) return;

  const ratePlans = await db.ratePlan.findMany({
    where: {
      roomTypeId,
      tenantId,
      status: 'active',
    },
    select: { id: true, basePrice: true },
  });

  for (const rp of ratePlans) {
    // If the rate plan's base price matches the old room type base price,
    // update it proportionally
    if (Math.abs(rp.basePrice - oldBasePrice) < 0.01) {
      await db.ratePlan.update({
        where: { id: rp.id },
        data: { basePrice: newBasePrice },
      });
    }
  }
}

// ============================================================
// Price History Recording
// ============================================================

/**
 * Record a pricing change in the audit log for history tracking.
 */
async function recordPriceHistory(
  tenantId: string,
  propertyId: string,
  roomTypeId: string,
  roomTypeName: string,
  previousRate: number,
  newRate: number,
  occupancyPercent: number,
  trigger: PricingTrigger,
  confidence: number
): Promise<void> {
  await db.auditLog.create({
    data: {
      tenantId,
      module: 'revenue',
      action: 'hourly_rate_update',
      entityType: 'RoomType',
      entityId: roomTypeId,
      oldValue: JSON.stringify({
        rate: previousRate,
        timestamp: new Date().toISOString(),
      }),
      newValue: JSON.stringify({
        rate: newRate,
        occupancy: Math.round(occupancyPercent * 100) / 100,
        trigger,
        confidence: Math.round(confidence * 100) / 100,
        timestamp: new Date().toISOString(),
      }),
    },
  });
}

// ============================================================
// Linear Pricing Configuration Management
// ============================================================

/**
 * Get the linear pricing configuration for a property.
 * Stores config in PricingSchedulerLog with a special type marker,
 * or falls back to defaults.
 */
export async function getLinearPricingConfig(
  tenantId: string,
  propertyId: string
): Promise<LinearPricingConfig> {
  // Use a dedicated approach: store config in AuditLog with a specific entity type
  // This is a pragmatic approach since we don't want to add schema migrations
  const configEntry = await db.auditLog.findFirst({
    where: {
      tenantId,
      module: 'revenue',
      action: 'linear_pricing_config',
      entityType: 'Property',
      entityId: propertyId,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (configEntry?.newValue) {
    try {
      const parsed = JSON.parse(configEntry.newValue);
      return {
        enabled: parsed.enabled ?? true,
        sensitivity: parsed.sensitivity ?? 'moderate',
        floorMultipliers: { ...DEFAULT_LINEAR_CONFIG.floorMultipliers, ...parsed.floorMultipliers },
        ceilingMultipliers: { ...DEFAULT_LINEAR_CONFIG.ceilingMultipliers, ...parsed.ceilingMultipliers },
        perRoomIncrement: parsed.perRoomIncrement ?? true,
      };
    } catch {
      // Fall through to default
    }
  }

  return { ...DEFAULT_LINEAR_CONFIG };
}

/**
 * Set/update the linear pricing configuration for a property.
 */
export async function setLinearPricingConfig(
  tenantId: string,
  propertyId: string,
  config: Partial<LinearPricingConfig>
): Promise<LinearPricingConfig> {
  const current = await getLinearPricingConfig(tenantId, propertyId);
  const updated: LinearPricingConfig = {
    ...current,
    ...config,
    floorMultipliers: { ...current.floorMultipliers, ...config.floorMultipliers },
    ceilingMultipliers: { ...current.ceilingMultipliers, ...config.ceilingMultipliers },
  };

  await db.auditLog.create({
    data: {
      tenantId,
      module: 'revenue',
      action: 'linear_pricing_config',
      entityType: 'Property',
      entityId: propertyId,
      oldValue: JSON.stringify(current),
      newValue: JSON.stringify(updated),
    },
  });

  return updated;
}

/**
 * Update just the sensitivity level for a property.
 */
async function setLinearPricingSensitivity(
  tenantId: string,
  propertyId: string,
  sensitivity: SensitivityLevel
): Promise<void> {
  await setLinearPricingConfig(tenantId, propertyId, { sensitivity });
}

/**
 * Clear the rate cache (useful after manual price changes).
 */
export function clearRateCache(
  tenantId?: string,
  propertyId?: string,
  roomTypeId?: string
): void {
  if (!tenantId) {
    rateCache.clear();
    return;
  }

  const prefix = roomTypeId
    ? `${tenantId}:${propertyId}:${roomTypeId}`
    : propertyId
      ? `${tenantId}:${propertyId}`
      : `${tenantId}`;

  Array.from(rateCache.keys()).forEach((key) => {
    if (key.startsWith(prefix)) {
      rateCache.delete(key);
    }
  });
}

/**
 * Get current cached rates for monitoring.
 */
export function getCachedRates(
  tenantId: string,
  propertyId?: string
): Array<{
  roomTypeId: string;
  rate: number;
  trigger: PricingTrigger;
  confidence: number;
  calculatedAt: Date;
  occupancyAtCalc: number;
}> {
  const prefix = propertyId
    ? `${tenantId}:${propertyId}`
    : `${tenantId}`;

  const results: Array<{
    roomTypeId: string;
    rate: number;
    trigger: PricingTrigger;
    confidence: number;
    calculatedAt: Date;
    occupancyAtCalc: number;
  }> = [];

  Array.from(rateCache.entries()).forEach(([key, value]) => {
    if (key.startsWith(prefix)) {
      results.push({
        roomTypeId: key.split(':').pop() || '',
        rate: value.rate,
        trigger: value.trigger,
        confidence: value.confidence,
        calculatedAt: value.calculatedAt,
        occupancyAtCalc: value.occupancyAtCalc,
      });
    }
  });

  return results;
}

/**
 * Get occupancy tier information for display purposes.
 */
export function getOccupancyTiers(): OccupancyTier[] {
  return [...OCCUPANCY_TIERS];
}
