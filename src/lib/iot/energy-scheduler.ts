/**
 * L-29: Energy Optimization Scheduling Engine
 *
 * Manages time-based energy schedules for thermostats, lighting, HVAC
 * optimization, and peak shaving. Evaluates schedules against current
 * time/day and optional occupancy status to determine optimal device settings.
 *
 * Schedules are stored in the SystemConfig table with category 'energy_schedule'.
 */

import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScheduleType =
  | 'thermostat_schedule'
  | 'lighting_schedule'
  | 'hvac_optimization'
  | 'peak_shaving';

export type ScheduleMode = 'eco' | 'comfort' | 'off';

export type OccupancyStatus = 'occupied' | 'vacant' | 'unknown';

export interface ScheduleEntry {
  dayOfWeek: number;     // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startHour: number;     // 0–23
  endHour: number;       // 0–23
  mode: ScheduleMode;
  targetTemp?: number;
  lightingLevel?: number; // 0–100
}

export interface EnergySchedule {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  type: ScheduleType;
  scheduleEntries: ScheduleEntry[];
  roomTypeId?: string;
  occupancyOverride: boolean;
  isActive: boolean;
  estimatedSavingsPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveScheduleResult {
  scheduleId: string;
  scheduleName: string;
  scheduleType: ScheduleType;
  entry: ScheduleEntry;
  effectiveMode: ScheduleMode;
  effectiveTemp?: number;
  effectiveLighting?: number;
  occupancyOverrideActive: boolean;
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFIG_CATEGORY = 'energy_schedule';

function scheduleConfigKey(id: string): string {
  return `${CONFIG_CATEGORY}:${id}`;
}

function generateScheduleId(): string {
  return `ens_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Core: Evaluate Energy Schedule
// ---------------------------------------------------------------------------

/**
 * Evaluate all active schedules for a property and return the current
 * optimal settings based on time of day and occupancy status.
 */
export async function evaluateEnergySchedule(
  propertyId: string,
  tenantId: string,
  roomTypeId?: string,
  occupancyStatus?: OccupancyStatus,
): Promise<ActiveScheduleResult[]> {
  const results: ActiveScheduleResult[] = [];
  const now = new Date();

  try {
    // Get all active schedules for this property
    const schedules = await listSchedulesForProperty(tenantId, propertyId);

    for (const schedule of schedules) {
      if (!schedule.isActive) continue;

      // Filter by room type if specified
      if (roomTypeId && schedule.roomTypeId && schedule.roomTypeId !== roomTypeId) {
        continue;
      }

      // Get the active entry for the current time
      const entry = getActiveScheduleEntry(schedule, now);

      if (!entry) continue;

      // Determine effective mode (considering occupancy override)
      let effectiveMode = entry.mode;
      let occupancyOverrideActive = false;

      if (schedule.occupancyOverride && occupancyStatus) {
        if (occupancyStatus === 'occupied') {
          // Occupancy sensor overrides: switch to comfort if in eco/off
          if (effectiveMode === 'eco' || effectiveMode === 'off') {
            effectiveMode = 'comfort';
            occupancyOverrideActive = true;
          }
        } else if (occupancyStatus === 'vacant') {
          // Room vacant: switch to eco if in comfort
          if (effectiveMode === 'comfort') {
            effectiveMode = 'eco';
            occupancyOverrideActive = true;
          }
        }
      }

      results.push({
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        scheduleType: schedule.type,
        entry,
        effectiveMode,
        effectiveTemp: entry.targetTemp,
        effectiveLighting: entry.lightingLevel,
        occupancyOverrideActive,
        evaluatedAt: now.toISOString(),
      });
    }
  } catch (error) {
    console.error('[EnergyScheduler] evaluateEnergySchedule error:', error);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Get active schedule entry for a given time
// ---------------------------------------------------------------------------

/**
 * Find the schedule entry that matches the current time/day.
 * Returns null if no entry matches.
 */
export function getActiveScheduleEntry(
  schedule: EnergySchedule,
  now?: Date,
): ScheduleEntry | null {
  const date = now || new Date();
  const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
  const currentHour = date.getHours();
  const currentMinute = date.getMinutes();
  const currentTime = currentHour + currentMinute / 60;

  if (!schedule.scheduleEntries || schedule.scheduleEntries.length === 0) {
    return null;
  }

  // Find entries matching the current day of week
  const dayEntries = schedule.scheduleEntries.filter(
    (entry) => entry.dayOfWeek === dayOfWeek,
  );

  if (dayEntries.length === 0) {
    return null;
  }

  // Sort by start hour to process in order
  const sorted = [...dayEntries].sort((a, b) => a.startHour - b.startHour);

  // Find the entry where current time falls within [startHour, endHour)
  for (const entry of sorted) {
    const startTime = entry.startHour;
    let endTime = entry.endHour;

    // Handle overnight schedules (e.g., 22:00 to 06:00)
    if (endTime <= startTime) {
      // Overnight: active if currentTime >= startTime OR currentTime < endTime
      if (currentTime >= startTime || currentTime < endTime) {
        return entry;
      }
    } else {
      // Same day: active if currentTime >= startTime AND currentTime < endTime
      if (currentTime >= startTime && currentTime < endTime) {
        return entry;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Calculate estimated savings
// ---------------------------------------------------------------------------

/**
 * Calculate estimated energy savings percentage for a schedule.
 * Based on the ratio of eco/off hours vs comfort hours across the week.
 */
export function calculateEstimatedSavings(schedule: EnergySchedule): number {
  if (!schedule.scheduleEntries || schedule.scheduleEntries.length === 0) {
    return 0;
  }

  let totalHours = 0;
  let ecoHours = 0;

  for (const entry of schedule.scheduleEntries) {
    let duration = entry.endHour - entry.startHour;
    if (duration <= 0) {
      // Overnight schedule
      duration += 24;
    }

    totalHours += duration;

    if (entry.mode === 'eco') {
      ecoHours += duration * 0.25; // Eco mode saves ~25%
    } else if (entry.mode === 'off') {
      ecoHours += duration * 0.90; // Off saves ~90%
    }
  }

  if (totalHours === 0) return 0;

  return Math.round((ecoHours / totalHours) * 100 * 10) / 10;
}

// ---------------------------------------------------------------------------
// Generate optimal schedule suggestion
// ---------------------------------------------------------------------------

/**
 * Generate an optimal energy schedule based on property type and historical usage.
 * Returns suggested schedule entries for a full week.
 */
export function generateOptimalSchedule(
  propertyId: string,
  historicalUsage?: {
    avgOccupancyByHour?: number[]; // 24 values, 0.0–1.0
    peakHours?: number[];
    shoulderHours?: number[];
    offPeakHours?: number[];
  },
): EnergySchedule {
  const entries: ScheduleEntry[] = [];

  // Default usage patterns for a hotel
  const defaultOccupancyByHour: number[] = [
    0.1, 0.05, 0.05, 0.05, 0.05, 0.1,  // 00:00–05:00 (late night / early morning)
    0.3, 0.6, 0.8, 0.85, 0.9, 0.85,    // 06:00–11:00 (morning)
    0.7, 0.6, 0.5, 0.55, 0.6, 0.65,    // 12:00–17:00 (afternoon)
    0.8, 0.9, 0.95, 0.85, 0.5, 0.2,    // 18:00–23:00 (evening)
  ];

  const occupancy = historicalUsage?.avgOccupancyByHour || defaultOccupancyByHour;

  // Generate entries for each day of the week
  for (let day = 0; day < 7; day++) {
    // Weekend adjustments (Sat=5, Sun=6) — slightly more comfort during day
    const isWeekend = day === 0 || day === 5 || day === 6;

    let currentStart: number | null = null;
    let currentMode: ScheduleMode | null = null;
    let currentTargetTemp: number | undefined;

    for (let hour = 0; hour < 24; hour++) {
      const occ = occupancy[hour] || 0;

      let mode: ScheduleMode;
      let targetTemp: number | undefined;

      if (occ >= 0.7) {
        // High occupancy → comfort
        mode = 'comfort';
        targetTemp = 22;
      } else if (occ >= 0.3) {
        // Medium occupancy
        mode = isWeekend ? 'comfort' : 'eco';
        targetTemp = isWeekend ? 22 : 20;
      } else if (occ >= 0.1) {
        // Low occupancy → eco
        mode = 'eco';
        targetTemp = 18;
      } else {
        // Very low/no occupancy → off
        mode = 'off';
        targetTemp = undefined;
      }

      if (mode !== currentMode) {
        // Commit the previous entry
        if (currentStart !== null && currentMode !== null) {
          entries.push({
            dayOfWeek: day,
            startHour: currentStart,
            endHour: hour,
            mode: currentMode,
            targetTemp: currentTargetTemp,
            lightingLevel: currentMode === 'comfort' ? 80 : currentMode === 'eco' ? 40 : 0,
          });
        }

        currentStart = hour;
        currentMode = mode;
        currentTargetTemp = targetTemp;
      }
    }

    // Commit the last entry of the day
    if (currentStart !== null && currentMode !== null) {
      entries.push({
        dayOfWeek: day,
        startHour: currentStart,
        endHour: 0, // Wraps to midnight
        mode: currentMode,
        targetTemp: currentTargetTemp,
        lightingLevel: currentMode === 'comfort' ? 80 : currentMode === 'eco' ? 40 : 0,
      });
    }
  }

  const savingsPercent = Math.round(
    entries.reduce((acc, entry) => {
      let duration = entry.endHour - entry.startHour;
      if (duration <= 0) duration += 24;

      if (entry.mode === 'eco') return acc + duration * 0.25;
      if (entry.mode === 'off') return acc + duration * 0.9;
      return acc;
    }, 0) / (entries.length * 12) * 100 * 10) / 10;

  return {
    id: generateScheduleId(),
    tenantId: '',
    propertyId,
    name: 'AI-Optimized Energy Schedule',
    type: 'thermostat_schedule',
    scheduleEntries: entries,
    occupancyOverride: true,
    isActive: false,
    estimatedSavingsPercent: Math.min(savingsPercent, 45),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Schedule management helpers (used by the CRUD API route)
// ---------------------------------------------------------------------------

/**
 * List all schedules for a given property.
 */
export async function listSchedulesForProperty(
  tenantId: string,
  propertyId: string,
): Promise<EnergySchedule[]> {
  const configs = await db.systemConfig.findMany({
    where: {
      tenantId,
      key: { startsWith: `${CONFIG_CATEGORY}:schedule:` },
    },
    orderBy: { createdAt: 'desc' },
  });

  return configs
    .map((c) => {
      const schedule = c.value as unknown as EnergySchedule;
      if (schedule.propertyId !== propertyId) return null;
      return schedule;
    })
    .filter(Boolean) as EnergySchedule[];
}

/**
 * Get a single schedule by ID.
 */
export async function getScheduleById(
  tenantId: string,
  scheduleId: string,
): Promise<EnergySchedule | null> {
  const config = await db.systemConfig.findUnique({
    where: {
      tenantId_key: {
        tenantId,
        key: scheduleConfigKey(scheduleId),
      },
    },
  });

  if (!config) return null;
  return config.value as unknown as EnergySchedule;
}

/**
 * Create a new energy schedule.
 */
export async function createSchedule(
  tenantId: string,
  data: {
    propertyId: string;
    name: string;
    type: ScheduleType;
    scheduleEntries: ScheduleEntry[];
    roomTypeId?: string;
    occupancyOverride?: boolean;
    isActive?: boolean;
    estimatedSavingsPercent?: number;
  },
): Promise<EnergySchedule> {
  const id = generateScheduleId();
  const now = new Date().toISOString();

  // Recalculate estimated savings if not provided
  const rawSchedule: EnergySchedule = {
    id,
    tenantId,
    propertyId: data.propertyId,
    name: data.name,
    type: data.type,
    scheduleEntries: data.scheduleEntries,
    roomTypeId: data.roomTypeId,
    occupancyOverride: data.occupancyOverride ?? true,
    isActive: data.isActive ?? true,
    estimatedSavingsPercent: data.estimatedSavingsPercent ?? 0,
    createdAt: now,
    updatedAt: now,
  };

  // Calculate savings
  rawSchedule.estimatedSavingsPercent = data.estimatedSavingsPercent ?? calculateEstimatedSavings(rawSchedule);

  await db.systemConfig.create({
    data: {
      tenantId,
      key: scheduleConfigKey(id),
      value: rawSchedule as any,
    },
  });

  return rawSchedule;
}

/**
 * Update an existing schedule.
 */
export async function updateSchedule(
  tenantId: string,
  scheduleId: string,
  updates: Partial<EnergySchedule>,
): Promise<EnergySchedule | null> {
  const existing = await getScheduleById(tenantId, scheduleId);
  if (!existing) return null;

  const updated: EnergySchedule = {
    ...existing,
    ...updates,
    id: existing.id,
    tenantId: existing.tenantId,
    updatedAt: new Date().toISOString(),
  };

  // Recalculate savings if schedule entries changed
  if (updates.scheduleEntries) {
    updated.estimatedSavingsPercent = calculateEstimatedSavings(updated);
  }

  await db.systemConfig.upsert({
    where: {
      tenantId_key: {
        tenantId,
        key: scheduleConfigKey(scheduleId),
      },
    },
    update: {
      value: updated as any,
    },
    create: {
      tenantId,
      key: scheduleConfigKey(scheduleId),
      value: updated as any,
    },
  });

  return updated;
}

/**
 * Delete a schedule.
 */
export async function deleteSchedule(
  tenantId: string,
  scheduleId: string,
): Promise<boolean> {
  try {
    await db.systemConfig.delete({
      where: {
        tenantId_key: {
          tenantId,
          key: scheduleConfigKey(scheduleId),
        },
      },
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

export const VALID_SCHEDULE_TYPES: ScheduleType[] = [
  'thermostat_schedule',
  'lighting_schedule',
  'hvac_optimization',
  'peak_shaving',
];

export const VALID_SCHEDULE_MODES: ScheduleMode[] = ['eco', 'comfort', 'off'];
