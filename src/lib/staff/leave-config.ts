import { db } from '@/lib/db';

// M-71 FIX: Half-day leave support
export const LEAVE_TYPES = {
  FULL_DAY: 'full_day',
  HALF_DAY: 'half_day',
  HALF_DAY_AM: 'half_day_am',
  HALF_DAY_PM: 'half_day_pm',
  VACATION: 'vacation',
  SICK: 'sick',
  PERSONAL: 'personal',
  MATERNITY: 'maternity',
  OTHER: 'other',
} as const;

/** Default leave balance limits per leave type */
export const DEFAULT_LEAVE_BALANCES: Record<string, number> = {
  vacation: 20,
  sick: 12,
  personal: 5,
  maternity: 180,
  other: 3,
};

/** Default carry-forward caps per leave type (0 = no carry-forward) */
export const DEFAULT_CARRY_FORWARD_CAPS: Record<string, number> = {
  vacation: 5,
  sick: 0,
  personal: 0,
  maternity: 0,
  other: 0,
};

export interface LeaveBalanceConfig {
  balances: Record<string, number>;
  carryForwardCaps: Record<string, number>;
  carryForwardEnabled: boolean;
}

/**
 * Load leave balance configuration from SystemConfig.
 * Falls back to defaults if no config exists for the tenant.
 */
export async function getLeaveBalanceConfig(tenantId: string): Promise<LeaveBalanceConfig> {
  try {
    const config = await db.systemConfig.findUnique({
      where: { tenantId_key: { tenantId, key: 'hr_leave_balance_config' } },
    });

    if (config) {
      const val = config.value as {
        balances?: Record<string, number>;
        carryForwardCaps?: Record<string, number>;
        carryForwardEnabled?: boolean;
      };

      return {
        balances: { ...DEFAULT_LEAVE_BALANCES, ...val.balances },
        carryForwardCaps: { ...DEFAULT_CARRY_FORWARD_CAPS, ...val.carryForwardCaps },
        carryForwardEnabled: val.carryForwardEnabled ?? false,
      };
    }
  } catch (error) {
    console.error('Error loading leave balance config:', error);
  }

  return {
    balances: { ...DEFAULT_LEAVE_BALANCES },
    carryForwardCaps: { ...DEFAULT_CARRY_FORWARD_CAPS },
    carryForwardEnabled: false,
  };
}

/**
 * Get leave balance for a specific user, accounting for carry-forward.
 */
export async function getUserLeaveBalance(
  tenantId: string,
  userId: string,
  year: number
): Promise<Record<string, { total: number; used: number; carried: number; remaining: number }>> {
  const config = await getLeaveBalanceConfig(tenantId);

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const [approvedLeaves, carryForwards] = await Promise.all([
    db.staffLeave.findMany({
      where: {
        tenantId,
        userId,
        status: 'approved',
        startDate: { gte: yearStart, lte: yearEnd },
      },
    }),
    config.carryForwardEnabled
      ? db.leaveCarryForward.findMany({
          where: {
            tenantId,
            userId,
            toYear: year,
          },
        })
      : [],
  ]);

  // Build carry-forward map
  const carryMap: Record<string, number> = {};
  for (const cf of carryForwards) {
    const available = cf.carriedDays - cf.usedDays;
    if (available > 0) {
      carryMap[cf.leaveType] = (carryMap[cf.leaveType] || 0) + available;
    }
  }

  const balances: Record<string, { total: number; used: number; carried: number; remaining: number }> = {};

  // Initialize all known leave types
  const allTypes = new Set([...Object.keys(config.balances), ...Object.keys(carryMap)]);
  for (const type of allTypes) {
    const total = config.balances[type] || 0;
    const carried = carryMap[type] || 0;
    balances[type] = { total, used: 0, carried, remaining: total + carried };
  }

  // Calculate used days from approved leaves
  for (const leave of approvedLeaves) {
    if (balances[leave.leaveType]) {
      balances[leave.leaveType].used += leave.totalDays;
    } else {
      balances[leave.leaveType] = { total: 0, used: leave.totalDays, carried: 0, remaining: 0 };
    }
  }

  // Calculate remaining
  for (const [, balance] of Object.entries(balances)) {
    balance.remaining = Math.max(0, balance.total + balance.carried - balance.used);
  }

  return balances;
}

/**
 * Process leave carry-forward at year boundary.
 * Call this at the start of a new year to roll over unused leave.
 */
export async function processLeaveCarryForward(
  tenantId: string,
  fromYear: number
): Promise<{ processed: number }> {
  const config = await getLeaveBalanceConfig(tenantId);

  if (!config.carryForwardEnabled) {
    return { processed: 0 };
  }

  const toYear = fromYear + 1;
  const fromYearStart = new Date(fromYear, 0, 1);
  const fromYearEnd = new Date(fromYear, 11, 31);

  // Get all users in the tenant
  const users = await db.user.findMany({
    where: { tenantId, deletedAt: null, status: 'active' },
    select: { id: true },
  });

  let processed = 0;

  for (const user of users) {
    // Get approved leaves in the fromYear
    const leaves = await db.staffLeave.findMany({
      where: {
        tenantId,
        userId: user.id,
        status: 'approved',
        startDate: { gte: fromYearStart, lte: fromYearEnd },
      },
    });

    // Calculate used days per leave type
    const usedByType: Record<string, number> = {};
    for (const leave of leaves) {
      usedByType[leave.leaveType] = (usedByType[leave.leaveType] || 0) + leave.totalDays;
    }

    // Get existing carry-forward that was already applied this year
    const existingCarried = await db.leaveCarryForward.findMany({
      where: { tenantId, userId: user.id, toYear: fromYear },
    });
    const carriedByType: Record<string, number> = {};
    for (const cf of existingCarried) {
      const available = cf.carriedDays - cf.usedDays;
      if (available > 0) {
        carriedByType[cf.leaveType] = (carriedByType[cf.leaveType] || 0) + available;
      }
    }

    // Calculate unused per type and apply carry-forward caps
    for (const [leaveType, totalAllowed] of Object.entries(config.balances)) {
      const cap = config.carryForwardCaps[leaveType] || 0;
      if (cap <= 0) continue; // No carry-forward for this type

      const totalAvailable = totalAllowed + (carriedByType[leaveType] || 0);
      const used = usedByType[leaveType] || 0;
      const unused = Math.max(0, totalAvailable - used);
      const cappedUnused = Math.min(unused, cap);

      if (cappedUnused > 0) {
        await db.leaveCarryForward.upsert({
          where: {
            tenantId_userId_leaveType_fromYear: {
              tenantId,
              userId: user.id,
              leaveType,
              fromYear,
            },
          },
          create: {
            tenantId,
            userId: user.id,
            leaveType,
            fromYear,
            toYear,
            carriedDays: cappedUnused,
            maxCap: cap,
            usedDays: 0,
          },
          update: {
            carriedDays: cappedUnused,
            maxCap: cap,
          },
        });
        processed++;
      }
    }
  }

  return { processed };
}
