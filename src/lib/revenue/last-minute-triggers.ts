/**
 * Last-Minute Time Triggers Engine
 *
 * Pricing automation for the last 24-48 hours before check-in.
 * Evaluates trigger windows (48hr, 24hr, 12hr, 6hr, 3hr) and takes
 * automated actions based on occupancy conditions.
 *
 * Actions: increase_rate, decrease_rate, send_offer, release_inventory
 */

import { db } from '@/lib/db';

// ─── Types ───────────────────────────────────────────────────────────────

export interface LastMinuteTrigger {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  enabled: boolean;
  triggerHoursBeforeCheckin: number; // e.g. 48, 24, 12, 6, 3
  action: 'increase_rate' | 'decrease_rate' | 'send_offer' | 'release_inventory';
  value: number; // percentage for rate changes
  minOccupancy: number; // only trigger if occupancy is below this
  maxOccupancy: number; // only trigger if occupancy is above this
  channelScope: 'all' | 'direct_only' | 'ota_only';
  roomTypeIds: string[];
  repeatOnDays: number[]; // 0-6
  createdAt: Date;
  updatedAt: Date;
}

export interface LastMinuteTriggerResult {
  triggerId: string;
  triggerName: string;
  roomTypeId: string;
  roomTypeName: string;
  action: string;
  value: number;
  currentOccupancy: number;
  currentRate: number;
  newRate: number;
  channelScope: string;
  fired: boolean;
  reason: string;
}

export interface TriggerAction {
  triggerId: string;
  triggerName: string;
  roomTypeId: string;
  roomTypeName: string;
  action: string;
  value: number;
  oldRate: number;
  newRate: number;
  channelScope: string;
  result: string;
}

export interface LastMinuteAutomationResult {
  processed: number;
  actions: TriggerAction[];
  errors: string[];
}

export interface TriggerExecutionLog {
  id: string;
  triggerId: string;
  triggerName: string;
  propertyId: string;
  roomTypeId: string;
  roomTypeName: string;
  date: string;
  action: string;
  value: number;
  result: Record<string, unknown>;
  createdAt: string;
}

// ─── Core Trigger Logic ──────────────────────────────────────────────────

/**
 * Calculate occupancy for a room type on a specific date.
 */
async function getOccupancyForRoomType(
  tenantId: string,
  propertyId: string,
  roomTypeId: string,
  date: Date
): Promise<{ occupancy: number; totalRooms: number; occupied: number; rate: number }> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const roomType = await db.roomType.findFirst({
    where: { id: roomTypeId, propertyId, deletedAt: null },
    select: { totalRooms: true, basePrice: true },
  });

  if (!roomType) {
    return { occupancy: 0, totalRooms: 0, occupied: 0, rate: 0 };
  }

  const occupied = await db.booking.count({
    where: {
      tenantId,
      propertyId,
      roomTypeId,
      status: { in: ['confirmed', 'reserved', 'checked_in'] },
      checkIn: { lte: dayEnd },
      checkOut: { gt: dayStart },
      deletedAt: null,
    },
  });

  const totalRooms = roomType.totalRooms || 1;
  const occupancy = Math.min(100, Math.round((occupied / totalRooms) * 100));

  // Get effective rate from rate plans or base price
  const ratePlan = await db.ratePlan.findFirst({
    where: {
      roomTypeId,
      isActive: true,
      property: { id: propertyId },
    },
    select: { price: true },
    orderBy: { price: 'asc' },
  });

  const rate = ratePlan?.price || roomType.basePrice || 0;

  return { occupancy, totalRooms, occupied, rate };
}

/**
 * Check if a trigger has already fired today for a specific room type.
 */
async function hasTriggerFired(
  triggerId: string,
  roomTypeId: string,
  date: Date
): Promise<boolean> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const existing = await db.lastMinuteTriggerLog.findUnique({
    where: {
      triggerId_roomTypeId_date: {
        triggerId,
        roomTypeId,
        date: dayStart,
      },
    },
  });

  return !!existing;
}

/**
 * Log a trigger execution.
 */
async function logTriggerExecution(
  tenantId: string,
  propertyId: string,
  triggerId: string,
  roomTypeId: string,
  date: Date,
  action: string,
  value: number,
  result: Record<string, unknown>
): Promise<void> {
  await db.lastMinuteTriggerLog.create({
    data: {
      tenantId,
      propertyId,
      triggerId,
      roomTypeId,
      date,
      action,
      value,
      result: JSON.stringify(result),
    },
  });
}

/**
 * Apply a rate change action.
 * Updates the base price of a room type.
 */
async function applyRateChange(
  roomTypeId: string,
  currentRate: number,
  action: 'increase_rate' | 'decrease_rate',
  percentage: number
): Promise<number> {
  let newRate: number;

  if (action === 'increase_rate') {
    newRate = currentRate * (1 + percentage / 100);
  } else {
    newRate = currentRate * (1 - percentage / 100);
  }

  // Ensure rate doesn't go below $10
  newRate = Math.max(10, Math.round(newRate * 100) / 100);

  // Update room type base price
  await db.roomType.update({
    where: { id: roomTypeId },
    data: { basePrice: newRate },
  });

  return newRate;
}

/**
 * Create an upsell/cross-sell offer notification for in-house guests.
 */
async function createOfferNotification(
  tenantId: string,
  propertyId: string,
  roomTypeId: string,
  action: string,
  value: number
): Promise<string> {
  const message = action === 'send_offer'
    ? `Special last-minute offer available: ${value}% off upgrades and add-ons!`
    : `Additional inventory released to OTAs at competitive rates.`;

  const notification = await db.notification.create({
    data: {
      tenantId,
      userId: '', // system notification
      type: 'system',
      title: 'Last-Minute Offer',
      message,
      data: JSON.stringify({
        roomTypeId,
        action,
        value,
        source: 'last_minute_trigger',
      }),
      isRead: false,
    },
  });

  return notification.id;
}

/**
 * Evaluate all last-minute triggers for a property.
 * Returns which triggers would fire (dry run).
 */
export async function evaluateLastMinuteTriggers(
  tenantId: string,
  propertyId: string
): Promise<LastMinuteTriggerResult[]> {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Get all enabled triggers for this property
  const triggers = await db.lastMinuteTrigger.findMany({
    where: {
      propertyId,
      enabled: true,
    },
  });

  if (triggers.length === 0) {
    return [];
  }

  const results: LastMinuteTriggerResult[] = [];

  // Get all room types for the property
  const roomTypes = await db.roomType.findMany({
    where: { propertyId, status: 'active', deletedAt: null },
    select: { id: true, name: true },
  });

  for (const trigger of triggers) {
    const triggerData: Omit<LastMinuteTrigger, 'createdAt' | 'updatedAt'> = {
      id: trigger.id,
      tenantId: trigger.tenantId,
      propertyId: trigger.propertyId,
      name: trigger.name,
      enabled: trigger.enabled,
      triggerHoursBeforeCheckin: trigger.triggerHoursBeforeCheckin,
      action: trigger.action as LastMinuteTrigger['action'],
      value: trigger.value,
      minOccupancy: trigger.minOccupancy,
      maxOccupancy: trigger.maxOccupancy,
      channelScope: trigger.channelScope as LastMinuteTrigger['channelScope'],
      roomTypeIds: JSON.parse(trigger.roomTypeIds),
      repeatOnDays: trigger.repeatOnDays.split(',').map(Number),
    };

    // Check if today is a valid day for this trigger
    if (!triggerData.repeatOnDays.includes(dayOfWeek)) {
      continue;
    }

    // Determine the check-in window this trigger targets
    const windowStart = new Date(now);
    windowStart.setHours(windowStart.getHours() + triggerData.triggerHoursBeforeCheckin - 3);
    const windowEnd = new Date(now);
    windowEnd.setHours(windowEnd.getHours() + triggerData.triggerHoursBeforeCheckin + 3);

    // Get room types to process (filter by trigger's room type list if specified)
    const targetRoomTypes = triggerData.roomTypeIds.length > 0
      ? roomTypes.filter(rt => triggerData.roomTypeIds.includes(rt.id))
      : roomTypes;

    for (const roomType of targetRoomTypes) {
      // Get occupancy for today
      const { occupancy, rate } = await getOccupancyForRoomType(
        tenantId,
        propertyId,
        roomType.id,
        now
      );

      // Check occupancy conditions
      const inRange = occupancy >= triggerData.minOccupancy && occupancy <= triggerData.maxOccupancy;

      if (!inRange) {
        results.push({
          triggerId: trigger.id,
          triggerName: triggerData.name,
          roomTypeId: roomType.id,
          roomTypeName: roomType.name,
          action: triggerData.action,
          value: triggerData.value,
          currentOccupancy: occupancy,
          currentRate: rate,
          newRate: rate,
          channelScope: triggerData.channelScope,
          fired: false,
          reason: `Occupancy ${occupancy}% outside range [${triggerData.minOccupancy}%, ${triggerData.maxOccupancy}%]`,
        });
        continue;
      }

      // Calculate new rate if applicable
      let newRate = rate;
      if (triggerData.action === 'increase_rate') {
        newRate = rate * (1 + triggerData.value / 100);
      } else if (triggerData.action === 'decrease_rate') {
        newRate = Math.max(10, rate * (1 - triggerData.value / 100));
      }

      results.push({
        triggerId: trigger.id,
        triggerName: triggerData.name,
        roomTypeId: roomType.id,
        roomTypeName: roomType.name,
        action: triggerData.action,
        value: triggerData.value,
        currentOccupancy: occupancy,
        currentRate: rate,
        newRate: Math.round(newRate * 100) / 100,
        channelScope: triggerData.channelScope,
        fired: true,
        reason: `Conditions met: ${occupancy}% occupancy, ${triggerData.action} by ${triggerData.value}%`,
      });
    }
  }

  return results;
}

/**
 * Run last-minute automation for all properties of a tenant.
 * Executes trigger actions (not dry run).
 */
export async function runLastMinuteAutomation(
  tenantId: string,
  propertyId?: string
): Promise<{ processed: number; actions: TriggerAction[] }> {
  const now = new Date();
  const dayOfWeek = now.getDay();

  const result: LastMinuteAutomationResult = {
    processed: 0,
    actions: [],
    errors: [],
  };

  // Get properties to process
  const where: Record<string, unknown> = { tenantId, status: 'active' };
  if (propertyId) where.id = propertyId;

  const properties = await db.property.findMany({
    where,
    select: { id: true },
  });

  for (const property of properties) {
    const triggers = await db.lastMinuteTrigger.findMany({
      where: { propertyId: property.id, enabled: true },
    });

    const roomTypes = await db.roomType.findMany({
      where: { propertyId: property.id, status: 'active', deletedAt: null },
      select: { id: true, name: true },
    });

    for (const trigger of triggers) {
      const repeatOnDays = trigger.repeatOnDays.split(',').map(Number);

      // Check day of week
      if (!repeatOnDays.includes(dayOfWeek)) continue;

      const parsedRoomTypeIds = JSON.parse(trigger.roomTypeIds);
      const targetRoomTypes = parsedRoomTypeIds.length > 0
        ? roomTypes.filter(rt => parsedRoomTypeIds.includes(rt.id))
        : roomTypes;

      for (const roomType of targetRoomTypes) {
        try {
          // Check if already fired today
          const alreadyFired = await hasTriggerFired(trigger.id, roomType.id, now);
          if (alreadyFired) continue;

          // Get occupancy
          const { occupancy, rate } = await getOccupancyForRoomType(
            tenantId,
            property.id,
            roomType.id,
            now
          );

          // Check occupancy conditions
          if (occupancy < trigger.minOccupancy || occupancy > trigger.maxOccupancy) continue;

          let newRate = rate;
          let actionResult: Record<string, unknown> = {};

          switch (trigger.action) {
            case 'increase_rate':
            case 'decrease_rate': {
              newRate = await applyRateChange(roomType.id, rate, trigger.action, trigger.value);
              actionResult = {
                oldRate: rate,
                newRate,
                changePercent: trigger.value,
                direction: trigger.action === 'increase_rate' ? 'up' : 'down',
              };
              break;
            }
            case 'send_offer': {
              await createOfferNotification(tenantId, property.id, roomType.id, trigger.action, trigger.value);
              actionResult = {
                offerType: 'upsell',
                discount: trigger.value,
                occupancy,
              };
              break;
            }
            case 'release_inventory': {
              actionResult = {
                releasedTo: trigger.channelScope,
                occupancy,
                rate,
              };
              break;
            }
          }

          // Log the execution
          await logTriggerExecution(
            tenantId,
            property.id,
            trigger.id,
            roomType.id,
            now,
            trigger.action,
            trigger.value,
            actionResult
          );

          result.actions.push({
            triggerId: trigger.id,
            triggerName: trigger.name,
            roomTypeId: roomType.id,
            roomTypeName: roomType.name,
            action: trigger.action,
            value: trigger.value,
            oldRate: rate,
            newRate,
            channelScope: trigger.channelScope,
            result: JSON.stringify(actionResult),
          });

          result.processed++;
        } catch (error) {
          result.errors.push(
            `Trigger ${trigger.name} / ${roomType.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    }
  }

  return { processed: result.processed, actions: result.actions };
}

/**
 * Get all triggers for a property.
 */
export async function getTriggers(
  tenantId: string,
  propertyId: string
): Promise<LastMinuteTrigger[]> {
  const triggers = await db.lastMinuteTrigger.findMany({
    where: { tenantId, propertyId },
    orderBy: { triggerHoursBeforeCheckin: 'desc' },
  });

  return triggers.map(t => ({
    id: t.id,
    tenantId: t.tenantId,
    propertyId: t.propertyId,
    name: t.name,
    enabled: t.enabled,
    triggerHoursBeforeCheckin: t.triggerHoursBeforeCheckin,
    action: t.action as LastMinuteTrigger['action'],
    value: t.value,
    minOccupancy: t.minOccupancy,
    maxOccupancy: t.maxOccupancy,
    channelScope: t.channelScope as LastMinuteTrigger['channelScope'],
    roomTypeIds: JSON.parse(t.roomTypeIds),
    repeatOnDays: t.repeatOnDays.split(',').map(Number),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
}

/**
 * Create a new trigger.
 */
export async function createTrigger(
  tenantId: string,
  propertyId: string,
  data: Omit<LastMinuteTrigger, 'id' | 'tenantId' | 'propertyId' | 'createdAt' | 'updatedAt'>
): Promise<LastMinuteTrigger> {
  const trigger = await db.lastMinuteTrigger.create({
    data: {
      tenantId,
      propertyId,
      name: data.name,
      enabled: data.enabled,
      triggerHoursBeforeCheckin: data.triggerHoursBeforeCheckin,
      action: data.action,
      value: data.value,
      minOccupancy: data.minOccupancy,
      maxOccupancy: data.maxOccupancy,
      channelScope: data.channelScope,
      roomTypeIds: JSON.stringify(data.roomTypeIds),
      repeatOnDays: data.repeatOnDays.join(','),
    },
  });

  return {
    id: trigger.id,
    tenantId: trigger.tenantId,
    propertyId: trigger.propertyId,
    name: trigger.name,
    enabled: trigger.enabled,
    triggerHoursBeforeCheckin: trigger.triggerHoursBeforeCheckin,
    action: trigger.action as LastMinuteTrigger['action'],
    value: trigger.value,
    minOccupancy: trigger.minOccupancy,
    maxOccupancy: trigger.maxOccupancy,
    channelScope: trigger.channelScope as LastMinuteTrigger['channelScope'],
    roomTypeIds: JSON.parse(trigger.roomTypeIds),
    repeatOnDays: trigger.repeatOnDays.split(',').map(Number),
    createdAt: trigger.createdAt,
    updatedAt: trigger.updatedAt,
  };
}

/**
 * Update an existing trigger.
 */
export async function updateTrigger(
  tenantId: string,
  triggerId: string,
  data: Partial<Omit<LastMinuteTrigger, 'id' | 'tenantId' | 'propertyId' | 'createdAt' | 'updatedAt'>>
): Promise<LastMinuteTrigger | null> {
  const existing = await db.lastMinuteTrigger.findFirst({
    where: { id: triggerId, tenantId },
  });

  if (!existing) return null;

  const updated = await db.lastMinuteTrigger.update({
    where: { id: triggerId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.triggerHoursBeforeCheckin !== undefined && { triggerHoursBeforeCheckin: data.triggerHoursBeforeCheckin }),
      ...(data.action !== undefined && { action: data.action }),
      ...(data.value !== undefined && { value: data.value }),
      ...(data.minOccupancy !== undefined && { minOccupancy: data.minOccupancy }),
      ...(data.maxOccupancy !== undefined && { maxOccupancy: data.maxOccupancy }),
      ...(data.channelScope !== undefined && { channelScope: data.channelScope }),
      ...(data.roomTypeIds !== undefined && { roomTypeIds: JSON.stringify(data.roomTypeIds) }),
      ...(data.repeatOnDays !== undefined && { repeatOnDays: data.repeatOnDays.join(',') }),
    },
  });

  return {
    id: updated.id,
    tenantId: updated.tenantId,
    propertyId: updated.propertyId,
    name: updated.name,
    enabled: updated.enabled,
    triggerHoursBeforeCheckin: updated.triggerHoursBeforeCheckin,
    action: updated.action as LastMinuteTrigger['action'],
    value: updated.value,
    minOccupancy: updated.minOccupancy,
    maxOccupancy: updated.maxOccupancy,
    channelScope: updated.channelScope as LastMinuteTrigger['channelScope'],
    roomTypeIds: JSON.parse(updated.roomTypeIds),
    repeatOnDays: updated.repeatOnDays.split(',').map(Number),
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

/**
 * Delete a trigger.
 */
export async function deleteTrigger(
  tenantId: string,
  triggerId: string
): Promise<boolean> {
  const existing = await db.lastMinuteTrigger.findFirst({
    where: { id: triggerId, tenantId },
  });

  if (!existing) return false;

  await db.lastMinuteTrigger.delete({ where: { id: triggerId } });
  await db.lastMinuteTriggerLog.deleteMany({ where: { triggerId } });

  return true;
}

/**
 * Get trigger execution logs.
 */
export async function getTriggerLogs(
  tenantId: string,
  propertyId: string,
  limit: number = 100
): Promise<TriggerExecutionLog[]> {
  const logs = await db.lastMinuteTriggerLog.findMany({
    where: { tenantId, propertyId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      trigger: { select: { name: true } },
    },
  });

  // Get room type names
  const roomTypeIds = Array.from(new Set(logs.map(l => l.roomTypeId)));
  const roomTypes = await db.roomType.findMany({
    where: { id: { in: roomTypeIds } },
    select: { id: true, name: true },
  });
  const rtMap = new Map(roomTypes.map(rt => [rt.id, rt.name]));

  return logs.map(log => ({
    id: log.id,
    triggerId: log.triggerId,
    triggerName: (log.trigger as unknown as { name: string })?.name || 'Unknown',
    propertyId: log.propertyId,
    roomTypeId: log.roomTypeId,
    roomTypeName: rtMap.get(log.roomTypeId) || 'Unknown',
    date: log.date.toISOString().split('T')[0],
    action: log.action,
    value: log.value,
    result: JSON.parse(log.result),
    createdAt: log.createdAt.toISOString(),
  }));
}
