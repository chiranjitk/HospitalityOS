/**
 * Auto-Apply Dynamic Pricing Scheduler
 * Evaluates active pricing rules and auto-applies rate changes
 * when conditions match. Designed to be called by cron or manual trigger.
 */

import { db } from '@/lib/db';

export interface SchedulerRunResult {
  id: string;
  status: 'completed' | 'failed';
  propertyId: string;
  rulesEvaluated: number;
  rulesApplied: number;
  rulesSkipped: number;
  totalRevenueImpact: number;
  startedAt: Date;
  completedAt: Date;
  errorDetails?: string;
  snapshotId?: string;
  details: Array<{
    ruleId: string;
    ruleName: string;
    action: 'applied' | 'skipped';
    reason: string;
    rateChange?: { roomTypeId: string; oldRate: number; newRate: number };
  }>;
}

/** Snapshot of room type and rate plan prices before a scheduled run */
export interface PricingSnapshot {
  id: string;
  tenantId: string;
  createdAt: Date;
  schedulerRunId: string;
  roomTypes: Array<{ id: string; name: string; basePrice: number }>;
  ratePlans: Array<{ id: string; name: string; basePrice: number; roomTypeId: string }>;
}

/**
 * Run scheduled pricing updates for all active pricing rules
 * with autoApply enabled.
 */
export async function runScheduledPricingUpdate(
  tenantId: string
): Promise<SchedulerRunResult> {
  const runId = crypto.randomUUID();
  const startedAt = new Date();

  // Create the run log
  const logEntry = await db.pricingSchedulerLog.create({
    data: {
      id: runId,
      tenantId,
      propertyId: 'all',
      status: 'running',
      startedAt,
    },
  });

  const details: SchedulerRunResult['details'] = [];
  let rulesEvaluated = 0;
  let rulesApplied = 0;
  let rulesSkipped = 0;
  let totalRevenueImpact = 0;

  // M-68: Snapshot current prices before applying any changes
  const snapshotId = await createPricingSnapshot(tenantId, runId);

  try {
    // Get all active pricing rules with autoApply condition
    const rules = await db.pricingRule.findMany({
      where: {
        tenantId,
        isActive: true,
        effectiveFrom: { lte: new Date() },
        effectiveTo: null,
      },
      include: {
        property: {
          select: { id: true, name: true, totalRooms: true },
        },
      },
      orderBy: { priority: 'desc' },
    });

    for (const rule of rules) {
      rulesEvaluated++;

      try {
        // Check if this rule has autoApply in conditions
        let conditions: Record<string, unknown> = {};
        if (rule.conditions) {
          try {
            conditions = JSON.parse(rule.conditions);
          } catch {
            // Skip unparseable
          }
        }

        const isAutoApply = conditions.autoApply === true;
        if (!isAutoApply) {
          rulesSkipped++;
          details.push({
            ruleId: rule.id,
            ruleName: rule.name,
            action: 'skipped',
            reason: 'Auto-apply not enabled',
          });
          continue;
        }

        // Get property ID
        const propertyId = rule.propertyId;
        if (!propertyId) {
          rulesSkipped++;
          details.push({
            ruleId: rule.id,
            ruleName: rule.name,
            action: 'skipped',
            reason: 'No property assigned',
          });
          continue;
        }

        // Get applicable room types
        let roomTypeIds: string[] = [];
        if (rule.roomTypes) {
          try {
            roomTypeIds = JSON.parse(rule.roomTypes);
          } catch {
            // If empty or invalid, apply to all room types
          }
        }

        if (roomTypeIds.length === 0) {
          const roomTypes = await db.roomType.findMany({
            where: { propertyId, status: 'active', deletedAt: null },
            select: { id: true },
          });
          roomTypeIds = roomTypes.map(rt => rt.id);
        }

        // Evaluate conditions against current state
        const shouldApply = await evaluateRuleConditions(
          rule,
          propertyId,
          tenantId,
          conditions
        );

        if (!shouldApply) {
          rulesSkipped++;
          details.push({
            ruleId: rule.id,
            ruleName: rule.name,
            action: 'skipped',
            reason: 'Conditions not met',
          });
          continue;
        }

        // Apply the rate change
        for (const roomTypeId of roomTypeIds) {
          const roomType = await db.roomType.findUnique({
            where: { id: roomTypeId },
            select: { basePrice: true, name: true },
          });

          if (!roomType) continue;

          const oldRate = roomType.basePrice;
          let newRate = oldRate;

          // Apply rule value
          switch (rule.type) {
            case 'markup':
            case 'surcharge_percentage':
              newRate = oldRate * (1 + rule.value / 100);
              break;
            case 'markdown':
            case 'discount_percentage':
              newRate = Math.max(0, oldRate * (1 - rule.value / 100));
              break;
            case 'surcharge_fixed':
              newRate = oldRate + rule.value;
              break;
            case 'discount_fixed':
              newRate = Math.max(0, oldRate - rule.value);
              break;
            case 'occupancy':
              // Applied during booking calculation, not room type base price
              rulesSkipped++;
              continue;
            case 'promo_code':
              // Applied during booking calculation
              rulesSkipped++;
              continue;
            default:
              // For seasonal, weekend, etc., adjust base price
              if (rule.valueType === 'percentage') {
                newRate = rule.value > 0
                  ? oldRate * (1 + rule.value / 100)
                  : Math.max(0, oldRate * (1 + rule.value / 100));
              } else {
                newRate = Math.max(0, rule.value);
              }
              break;
          }

          newRate = Math.round(newRate * 100) / 100;

          if (Math.abs(newRate - oldRate) < 0.01) {
            details.push({
              ruleId: rule.id,
              ruleName: rule.name,
              action: 'skipped',
              reason: 'Rate change too small',
            });
            continue;
          }

          // Update room type base price
          await db.roomType.update({
            where: { id: roomTypeId },
            data: { basePrice: newRate },
          });

          // Update rate plans referencing this room type
          const ratePlans = await db.ratePlan.findMany({
            where: { roomTypeId, status: 'active' },
            select: { id: true, basePrice: true },
          });

          for (const rp of ratePlans) {
            const oldRpRate = rp.basePrice;
            let newRpRate = oldRpRate;

            if (rule.valueType === 'percentage') {
              newRpRate = rule.value > 0
                ? oldRpRate * (1 + rule.value / 100)
                : Math.max(0, oldRpRate * (1 + rule.value / 100));
            } else {
              newRpRate = rule.value > 0 ? oldRpRate + rule.value : Math.max(0, oldRpRate - rule.value);
            }

            newRpRate = Math.round(newRpRate * 100) / 100;

            if (Math.abs(newRpRate - oldRpRate) > 0.01) {
              await db.ratePlan.update({
                where: { id: rp.id },
                data: { basePrice: newRpRate },
              });
            }
          }

          totalRevenueImpact += (newRate - oldRate) * (rule.property?.totalRooms || 100);

          details.push({
            ruleId: rule.id,
            ruleName: rule.name,
            action: 'applied',
            reason: `Applied ${rule.value}${rule.valueType === 'percentage' ? '%' : ' fixed'} ${rule.type}`,
            rateChange: {
              roomTypeId,
              oldRate,
              newRate,
            },
          });
        }

        rulesApplied++;
      } catch (ruleError) {
        rulesSkipped++;
        details.push({
          ruleId: rule.id,
          ruleName: rule.name,
          action: 'skipped',
          reason: `Error: ${ruleError instanceof Error ? ruleError.message : 'Unknown'}`,
        });
      }
    }

    // Update log as completed
    await db.pricingSchedulerLog.update({
      where: { id: runId },
      data: {
        status: 'completed',
        rulesEvaluated,
        rulesApplied,
        rulesSkipped,
        totalRevenueImpact: Math.round(totalRevenueImpact * 100) / 100,
        completedAt: new Date(),
      },
    });

    return {
      id: runId,
      status: 'completed',
      propertyId: 'all',
      rulesEvaluated,
      rulesApplied,
      rulesSkipped,
      totalRevenueImpact: Math.round(totalRevenueImpact * 100) / 100,
      startedAt,
      completedAt: new Date(),
      snapshotId,
      details,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    await db.pricingSchedulerLog.update({
      where: { id: runId },
      data: {
        status: 'failed',
        rulesEvaluated,
        rulesApplied,
        rulesSkipped,
        totalRevenueImpact: Math.round(totalRevenueImpact * 100) / 100,
        completedAt: new Date(),
        errorDetails: errorMsg,
      },
    });

    return {
      id: runId,
      status: 'failed',
      propertyId: 'all',
      rulesEvaluated,
      rulesApplied,
      rulesSkipped,
      totalRevenueImpact: Math.round(totalRevenueImpact * 100) / 100,
      startedAt,
      completedAt: new Date(),
      errorDetails: errorMsg,
      details,
    };
  }
}

async function evaluateRuleConditions(
  rule: { type: string; conditions: string },
  propertyId: string,
  tenantId: string,
  conditions: Record<string, unknown>
): Promise<boolean> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { totalRooms: true },
  });

  const totalRooms = property?.totalRooms || 100;

  // Check occupancy-based conditions
  if (conditions.minOccupancy !== undefined || conditions.maxOccupancy !== undefined) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const occupiedRooms = await db.booking.count({
      where: {
        tenantId,
        propertyId,
        checkIn: { lte: now },
        checkOut: { gt: today },
        status: { in: ['checked_in', 'confirmed', 'reserved'] },
        deletedAt: null,
      },
    });

    const currentOccupancy = (occupiedRooms / totalRooms) * 100;

    if (conditions.minOccupancy !== undefined && currentOccupancy < Number(conditions.minOccupancy)) {
      return false;
    }
    if (conditions.maxOccupancy !== undefined && currentOccupancy > Number(conditions.maxOccupancy)) {
      return false;
    }
  }

  // Check days of week
  if (conditions.daysOfWeek && Array.isArray(conditions.daysOfWeek)) {
    const todayDay = new Date().getDay();
    if (!(conditions.daysOfWeek as number[]).includes(todayDay)) {
      return false;
    }
  }

  // Check months
  if (conditions.months && Array.isArray(conditions.months)) {
    const currentMonth = new Date().getMonth() + 1;
    if (!(conditions.months as number[]).includes(currentMonth)) {
      return false;
    }
  }

  // Check advance booking days
  if (conditions.advanceBookingDaysMin !== undefined || conditions.advanceBookingDaysMax !== undefined) {
    // For auto-apply rules, advance booking applies to upcoming check-ins
    const now = new Date();
    const upcomingBookings = await db.booking.count({
      where: {
        tenantId,
        propertyId,
        checkIn: { gte: now },
        status: { in: ['confirmed', 'reserved'] },
        deletedAt: null,
      },
    });

    if (upcomingBookings === 0 && conditions.minOccupancy !== undefined) {
      return false;
    }
  }

  return true;
}

// ============================================================
// M-68: Pricing Snapshot & Rollback
// ============================================================

/**
 * Create a snapshot of all room type and rate plan prices for the tenant.
 * Stored as an AuditLog entry so it can be used for rollback.
 * Returns the audit log entry ID.
 */
async function createPricingSnapshot(
  tenantId: string,
  schedulerRunId: string
): Promise<string> {
  // Collect current room type prices
  const roomTypes = await db.roomType.findMany({
    where: { property: { tenantId }, deletedAt: null },
    select: { id: true, name: true, basePrice: true },
  });

  // Collect current rate plan prices
  const ratePlans = await db.ratePlan.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, name: true, basePrice: true, roomTypeId: true },
  });

  const snapshot: Omit<PricingSnapshot, 'id'> = {
    tenantId,
    createdAt: new Date(),
    schedulerRunId,
    roomTypes: roomTypes.map(rt => ({ id: rt.id, name: rt.name, basePrice: rt.basePrice })),
    ratePlans: ratePlans.map(rp => ({ id: rp.id, name: rp.name, basePrice: rp.basePrice, roomTypeId: rp.roomTypeId })),
  };

  const auditEntry = await db.auditLog.create({
    data: {
      tenantId,
      module: 'revenue',
      action: 'pricing_snapshot',
      entityType: 'SchedulerRun',
      entityId: schedulerRunId,
      newValue: JSON.stringify(snapshot),
    },
  });

  return auditEntry.id;
}

/**
 * Find the latest pricing snapshot for a tenant.
 */
async function getLatestSnapshot(
  tenantId: string
): Promise<{ snapshot: PricingSnapshot; auditId: string } | null> {
  const auditEntry = await db.auditLog.findFirst({
    where: {
      tenantId,
      module: 'revenue',
      action: 'pricing_snapshot',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!auditEntry || !auditEntry.newValue) return null;

  try {
    const snapshot = JSON.parse(auditEntry.newValue) as PricingSnapshot;
    return { snapshot, auditId: auditEntry.id };
  } catch {
    return null;
  }
}

/**
 * Rollback prices to the latest snapshot for a tenant.
 * Restores room type base prices and rate plan base prices.
 */
export async function rollbackToLastSnapshot(
  tenantId: string
): Promise<{
  success: boolean;
  snapshotId: string;
  roomTypesRestored: number;
  ratePlansRestored: number;
  error?: string;
}> {
  const result = await getLatestSnapshot(tenantId);

  if (!result) {
    return {
      success: false,
      snapshotId: '',
      roomTypesRestored: 0,
      ratePlansRestored: 0,
      error: 'No pricing snapshot found for rollback',
    };
  }

  const { snapshot, auditId } = result;
  let roomTypesRestored = 0;
  let ratePlansRestored = 0;

  // Restore room type prices
  for (const rt of snapshot.roomTypes) {
    try {
      await db.roomType.update({
        where: { id: rt.id },
        data: { basePrice: rt.basePrice },
      });
      roomTypesRestored++;
    } catch (err) {
      console.warn(`[Rollback] Failed to restore room type ${rt.id}:`, err);
    }
  }

  // Restore rate plan prices
  for (const rp of snapshot.ratePlans) {
    try {
      await db.ratePlan.update({
        where: { id: rp.id },
        data: { basePrice: rp.basePrice },
      });
      ratePlansRestored++;
    } catch (err) {
      console.warn(`[Rollback] Failed to restore rate plan ${rp.id}:`, err);
    }
  }

  // Log the rollback action
  await db.auditLog.create({
    data: {
      tenantId,
      module: 'revenue',
      action: 'pricing_rollback',
      entityType: 'AuditLog',
      entityId: auditId,
      newValue: JSON.stringify({
        snapshotId: auditId,
        roomTypesRestored,
        ratePlansRestored,
        timestamp: new Date().toISOString(),
      }),
    },
  });

  return {
    success: true,
    snapshotId: auditId,
    roomTypesRestored,
    ratePlansRestored,
  };
}
