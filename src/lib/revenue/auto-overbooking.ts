/**
 * Auto-Overbooking Engine
 *
 * Automatically overbooks lower category rooms to maximize occupancy.
 * Uses cancellation predictor data to determine safe overbooking levels.
 * When a higher category room sells out, lower-category guests are auto-upgraded
 * based on configured upgrade paths.
 */

import { db } from '@/lib/db';

// ─── Types ───────────────────────────────────────────────────────────────

export interface AutoOverbookingConfig {
  enabled: boolean;
  maxOverbookPercent: number; // e.g. 5 = allow 5% overbooking
  minCancellationRisk: number; // only overbook if predicted cancellation rate supports it
  allowedRoomTypes: string[]; // room type IDs that can be overbooked
  upgradePaths: Array<{ fromRoomTypeId: string; toRoomTypeId: string }>;
  blacklistDates: string[]; // dates when overbooking is disabled (holidays, events)
  bufferDays: number; // days before check-in to stop overbooking
}

export interface OverbookingResult {
  success: boolean;
  propertyId: string;
  date: string;
  slots: Array<{
    roomTypeId: string;
    roomTypeName: string;
    maxExtraRooms: number;
    confidence: number;
    expectedCancellations: number;
    totalRooms: number;
  }>;
  totalSlotsCreated: number;
  totalSlotsUpdated: number;
  errors: string[];
}

export interface OverbookingAllowance {
  allowed: boolean;
  maxExtra: number;
  confidence: number;
  expectedCancellations: number;
  reason?: string;
}

export interface OverbookingStatus {
  date: string;
  roomTypeId: string;
  roomTypeName: string;
  totalRooms: number;
  confirmedBookings: number;
  activeSlots: number;
  usedSlots: number;
  availableExtra: number;
  confidence: number;
  status: string;
}

// ─── Configuration Management ────────────────────────────────────────────

/**
 * Get overbooking config for a property. Creates default if none exists.
 */
export async function getOverbookingConfig(
  tenantId: string,
  propertyId: string
): Promise<AutoOverbookingConfig & { id: string }> {
  const config = await db.overbookingConfig.findUnique({
    where: { propertyId },
  });

  if (config) {
    return {
      id: config.id,
      enabled: config.enabled,
      maxOverbookPercent: config.maxOverbookPercent,
      minCancellationRisk: config.minCancellationRisk,
      allowedRoomTypes: JSON.parse(config.allowedRoomTypes),
      upgradePaths: JSON.parse(config.upgradePaths),
      blacklistDates: JSON.parse(config.blacklistDates),
      bufferDays: config.bufferDays,
    };
  }

  // Return default configuration
  return {
    id: 'default',
    enabled: false,
    maxOverbookPercent: 5,
    minCancellationRisk: 0.15,
    allowedRoomTypes: [],
    upgradePaths: [],
    blacklistDates: [],
    bufferDays: 1,
  };
}

/**
 * Update overbooking configuration.
 */
export async function updateOverbookingConfig(
  tenantId: string,
  propertyId: string,
  config: Partial<AutoOverbookingConfig>
): Promise<AutoOverbookingConfig & { id: string }> {
  const existing = await db.overbookingConfig.findUnique({
    where: { propertyId },
  });

  if (existing) {
    const updated = await db.overbookingConfig.update({
      where: { propertyId },
      data: {
        ...(config.enabled !== undefined && { enabled: config.enabled }),
        ...(config.maxOverbookPercent !== undefined && { maxOverbookPercent: config.maxOverbookPercent }),
        ...(config.minCancellationRisk !== undefined && { minCancellationRisk: config.minCancellationRisk }),
        ...(config.allowedRoomTypes !== undefined && { allowedRoomTypes: JSON.stringify(config.allowedRoomTypes) }),
        ...(config.upgradePaths !== undefined && { upgradePaths: JSON.stringify(config.upgradePaths) }),
        ...(config.blacklistDates !== undefined && { blacklistDates: JSON.stringify(config.blacklistDates) }),
        ...(config.bufferDays !== undefined && { bufferDays: config.bufferDays }),
      },
    });

    return {
      id: updated.id,
      enabled: updated.enabled,
      maxOverbookPercent: updated.maxOverbookPercent,
      minCancellationRisk: updated.minCancellationRisk,
      allowedRoomTypes: JSON.parse(updated.allowedRoomTypes),
      upgradePaths: JSON.parse(updated.upgradePaths),
      blacklistDates: JSON.parse(updated.blacklistDates),
      bufferDays: updated.bufferDays,
    };
  }

  const created = await db.overbookingConfig.create({
    data: {
      tenantId,
      propertyId,
      enabled: config.enabled ?? false,
      maxOverbookPercent: config.maxOverbookPercent ?? 5,
      minCancellationRisk: config.minCancellationRisk ?? 0.15,
      allowedRoomTypes: JSON.stringify(config.allowedRoomTypes ?? []),
      upgradePaths: JSON.stringify(config.upgradePaths ?? []),
      blacklistDates: JSON.stringify(config.blacklistDates ?? []),
      bufferDays: config.bufferDays ?? 1,
    },
  });

  return {
    id: created.id,
    enabled: created.enabled,
    maxOverbookPercent: created.maxOverbookPercent,
    minCancellationRisk: created.minCancellationRisk,
    allowedRoomTypes: JSON.parse(created.allowedRoomTypes),
    upgradePaths: JSON.parse(created.upgradePaths),
    blacklistDates: JSON.parse(created.blacklistDates),
    bufferDays: created.bufferDays,
  };
}

// ─── Core Overbooking Calculation ────────────────────────────────────────

/**
 * Calculate overbooking allowance for a specific room type on a specific date.
 * Uses cancellation prediction data to determine safe overbooking levels.
 */
export async function calculateOverbookingAllowance(
  tenantId: string,
  propertyId: string,
  roomTypeId: string,
  date: Date
): Promise<OverbookingAllowance> {
  const config = await getOverbookingConfig(tenantId, propertyId);

  // Check if overbooking is enabled
  if (!config.enabled) {
    return { allowed: false, maxExtra: 0, confidence: 0, expectedCancellations: 0, reason: 'Overbooking is disabled' };
  }

  // Check if room type is in the allowed list (empty = all allowed)
  if (config.allowedRoomTypes.length > 0 && !config.allowedRoomTypes.includes(roomTypeId)) {
    return { allowed: false, maxExtra: 0, confidence: 0, expectedCancellations: 0, reason: 'Room type not in allowed list' };
  }

  // Check blacklist dates
  const dateStr = date.toISOString().split('T')[0];
  if (config.blacklistDates.includes(dateStr)) {
    return { allowed: false, maxExtra: 0, confidence: 0, expectedCancellations: 0, reason: 'Date is in blacklist' };
  }

  // Check buffer days
  const now = new Date();
  const daysUntilCheckin = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilCheckin < config.bufferDays) {
    return { allowed: false, maxExtra: 0, confidence: 0, expectedCancellations: 0, reason: `Within ${config.bufferDays}-day buffer period` };
  }

  // Get room type info
  const roomType = await db.roomType.findFirst({
    where: { id: roomTypeId, propertyId, deletedAt: null },
  });

  if (!roomType) {
    return { allowed: false, maxExtra: 0, confidence: 0, expectedCancellations: 0, reason: 'Room type not found' };
  }

  const totalRooms = roomType.totalRooms || 0;
  if (totalRooms === 0) {
    return { allowed: false, maxExtra: 0, confidence: 0, expectedCancellations: 0, reason: 'No rooms configured' };
  }

  // Count confirmed bookings for this room type and date
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const confirmedBookings = await db.booking.count({
    where: {
      tenantId,
      propertyId,
      roomTypeId,
      status: { in: ['confirmed', 'reserved'] },
      checkIn: { lte: dayEnd },
      checkOut: { gt: dayStart },
      deletedAt: null,
    },
  });

  // Fetch cancellation predictions for these bookings
  const bookings = await db.booking.findMany({
    where: {
      tenantId,
      propertyId,
      roomTypeId,
      status: { in: ['confirmed', 'reserved'] },
      checkIn: { lte: dayEnd },
      checkOut: { gt: dayStart },
      deletedAt: null,
    },
    select: { id: true },
  });

  const bookingIds = bookings.map(b => b.id);

  let expectedCancellations = 0;
  let confidence = 0;

  if (bookingIds.length > 0) {
    // Get the latest prediction per booking
    const predictions = await db.cancellationPredictionLog.findMany({
      where: {
        bookingId: { in: bookingIds },
      },
      orderBy: { predictedAt: 'desc' },
      distinct: ['bookingId'],
      select: { riskScore: true, riskLevel: true },
    });

    if (predictions.length > 0) {
      // Sum risk scores to get expected cancellations
      const totalRisk = predictions.reduce((sum, p) => sum + p.riskScore, 0);
      expectedCancellations = Math.round(totalRisk);

      // Confidence is based on the number of predictions vs bookings
      confidence = predictions.length / bookingIds.length;

      // Only proceed if expected cancellations meet minimum threshold
      const avgRisk = totalRisk / predictions.length;
      if (avgRisk < config.minCancellationRisk) {
        return {
          allowed: false,
          maxExtra: 0,
          confidence: Math.round(confidence * 1000) / 1000,
          expectedCancellations,
          reason: `Average cancellation risk (${(avgRisk * 100).toFixed(1)}%) below minimum (${(config.minCancellationRisk * 100).toFixed(1)}%)`,
        };
      }
    }
  }

  // Calculate max extra rooms: min of expected cancellations and percentage cap
  const percentCap = Math.ceil(totalRooms * (config.maxOverbookPercent / 100));
  const maxExtra = Math.min(expectedCancellations, percentCap);

  if (maxExtra <= 0) {
    return {
      allowed: false,
      maxExtra: 0,
      confidence: Math.round(confidence * 1000) / 1000,
      expectedCancellations,
      reason: 'No safe overbooking margin available',
    };
  }

  return {
    allowed: true,
    maxExtra,
    confidence: Math.round(confidence * 1000) / 1000,
    expectedCancellations,
    reason: `${expectedCancellations} expected cancellations support ${maxExtra} extra bookings`,
  };
}

/**
 * Apply auto-overbooking for a property on a given date.
 * Creates or updates overbooking slots based on cancellation predictions.
 */
export async function applyAutoOverbooking(
  tenantId: string,
  propertyId: string,
  date?: Date,
  userId?: string
): Promise<OverbookingResult> {
  const targetDate = date || new Date();
  const config = await getOverbookingConfig(tenantId, propertyId);

  const result: OverbookingResult = {
    success: true,
    propertyId,
    date: targetDate.toISOString().split('T')[0],
    slots: [],
    totalSlotsCreated: 0,
    totalSlotsUpdated: 0,
    errors: [],
  };

  if (!config.enabled) {
    result.errors.push('Overbooking is disabled for this property');
    return result;
  }

  // Get all room types for the property
  const roomTypes = await db.roomType.findMany({
    where: {
      propertyId,
      status: 'active',
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      totalRooms: true,
    },
  });

  // Prepare date range (target date +/- 7 days for ahead-of-time planning)
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - 0);
  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + 14);

  for (const roomType of roomTypes) {
    try {
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const allowance = await calculateOverbookingAllowance(
          tenantId,
          propertyId,
          roomType.id,
          new Date(d)
        );

        if (!allowance.allowed) continue;

        // Upsert the overbooking slot
        const dayStr = d.toISOString().split('T')[0];
        const existingSlot = await db.overbookingSlot.findUnique({
          where: {
            propertyId_roomTypeId_date: {
              propertyId,
              roomTypeId: roomType.id,
              date: new Date(d),
            },
          },
        });

        if (existingSlot) {
          await db.overbookingSlot.update({
            where: { id: existingSlot.id },
            data: {
              maxExtraRooms: allowance.maxExtra,
              confidence: allowance.confidence,
              status: 'active',
            },
          });

          result.totalSlotsUpdated++;

          // Log the update
          await db.overbookingLog.create({
            data: {
              tenantId,
              propertyId,
              date: new Date(d),
              roomTypeId: roomType.id,
              action: 'updated',
              details: JSON.stringify({
                maxExtra: allowance.maxExtra,
                confidence: allowance.confidence,
                expectedCancellations: allowance.expectedCancellations,
                bookingsAnalyzed: 'auto',
              }),
              performedBy: userId,
            },
          });
        } else {
          await db.overbookingSlot.create({
            data: {
              tenantId,
              propertyId,
              roomTypeId: roomType.id,
              date: new Date(d),
              maxExtraRooms: allowance.maxExtra,
              confidence: allowance.confidence,
              status: 'active',
            },
          });

          result.totalSlotsCreated++;

          // Log the creation
          await db.overbookingLog.create({
            data: {
              tenantId,
              propertyId,
              date: new Date(d),
              roomTypeId: roomType.id,
              action: 'created',
              details: JSON.stringify({
                maxExtra: allowance.maxExtra,
                confidence: allowance.confidence,
                expectedCancellations: allowance.expectedCancellations,
                bookingsAnalyzed: 'auto',
              }),
              performedBy: userId,
            },
          });
        }

        // Only add to result for the target date
        if (dayStr === result.date) {
          result.slots.push({
            roomTypeId: roomType.id,
            roomTypeName: roomType.name,
            maxExtraRooms: allowance.maxExtra,
            confidence: allowance.confidence,
            expectedCancellations: allowance.expectedCancellations,
            totalRooms: roomType.totalRooms || 0,
          });
        }
      }
    } catch (error) {
      result.errors.push(`Error processing room type ${roomType.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return result;
}

/**
 * Get current overbooking status for a property.
 * Returns active slots with usage information.
 */
export async function getOverbookingStatus(
  tenantId: string,
  propertyId: string,
  date?: Date
): Promise<OverbookingStatus[]> {
  const targetDate = date || new Date();
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  const slots = await db.overbookingSlot.findMany({
    where: {
      propertyId,
      status: 'active',
      date: { gte: dayStart, lte: dayEnd },
    },
    select: {
      roomTypeId: true,
      maxExtraRooms: true,
      usedSlots: true,
      confidence: true,
      status: true,
    },
  });

  const statuses: OverbookingStatus[] = [];

  for (const slot of slots) {
    const roomType = await db.roomType.findFirst({
      where: { id: slot.roomTypeId, propertyId, deletedAt: null },
      select: { name: true, totalRooms: true },
    });

    if (!roomType) continue;

    const confirmedBookings = await db.booking.count({
      where: {
        tenantId,
        propertyId,
        roomTypeId: slot.roomTypeId,
        status: { in: ['confirmed', 'reserved'] },
        checkIn: { lte: dayEnd },
        checkOut: { gt: dayStart },
        deletedAt: null,
      },
    });

    statuses.push({
      date: dayStart.toISOString().split('T')[0],
      roomTypeId: slot.roomTypeId,
      roomTypeName: roomType.name,
      totalRooms: roomType.totalRooms || 0,
      confirmedBookings,
      activeSlots: slot.maxExtraRooms,
      usedSlots: slot.usedSlots,
      availableExtra: slot.maxExtraRooms - slot.usedSlots,
      confidence: slot.confidence,
      status: slot.status,
    });
  }

  return statuses;
}

/**
 * Get overbooking execution logs.
 */
export async function getOverbookingLogs(
  tenantId: string,
  propertyId: string,
  limit: number = 50
): Promise<Array<Record<string, unknown>>> {
  const logs = await db.overbookingLog.findMany({
    where: { tenantId, propertyId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return logs.map(log => ({
    id: log.id,
    date: log.date,
    roomTypeId: log.roomTypeId,
    action: log.action,
    details: JSON.parse(log.details),
    performedBy: log.performedBy,
    createdAt: log.createdAt,
  }));
}
