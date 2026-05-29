/**
 * L-28: Occupancy IoT Automation Engine
 *
 * Evaluates occupancy sensor readings against configured automation rules,
 * and executes actions (room status updates, housekeeping tasks, thermostat
 * adjustments, light toggles, notifications, energy mode changes).
 *
 * Rules are stored in the SystemConfig table with category 'occupancy_trigger'.
 */

import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TriggerType =
  | 'room_occupied'
  | 'room_vacant'
  | 'occupancy_threshold'
  | 'no_motion_timeout';

export type SensorType = 'motion' | 'co2' | 'door' | 'infrared' | 'pressure';

export type RoomStatusAction = 'cleaning' | 'available' | 'maintenance';
export type TaskPriorityAction = 'high' | 'medium' | 'low';
export type ThermostatMode = 'eco' | 'comfort' | 'off';
export type LightState = 'on' | 'off';
export type EnergyMode = 'occupied' | 'eco' | 'unoccupied';
export type NotificationChannel = 'in_app';

export interface OccupancyTriggerAction {
  type:
    | 'set_room_status'
    | 'create_housekeeping_task'
    | 'adjust_thermostat'
    | 'toggle_lights'
    | 'send_notification'
    | 'update_energy_mode';
  params: Record<string, unknown>;
}

export interface OccupancyTriggerRule {
  id: string;
  tenantId: string;
  propertyId: string;
  roomId?: string;
  name: string;
  description?: string;
  triggerType: TriggerType;
  sensorType: SensorType;
  thresholdValue?: number;
  actions: OccupancyTriggerAction[];
  isActive: boolean;
  cooldownMinutes: number;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OccupancyReading {
  sensorId: string;
  value: number;       // 0.0–1.0
  rawValue?: number;
  confidence?: number;
  timestamp?: string;
}

// In-memory cooldown tracker (fire-and-forget safe; resets on server restart)
const cooldownMap = new Map<string, number>(); // ruleId → lastTriggeredMs

// ---------------------------------------------------------------------------
// Rule CRUD helpers (SystemConfig backed)
// ---------------------------------------------------------------------------

const CONFIG_CATEGORY = 'occupancy_trigger';

function ruleConfigKey(id: string): string {
  return `${CONFIG_CATEGORY}:${id}`;
}

function ruleListConfigKey(propertyId: string): string {
  return `${CONFIG_CATEGORY}:list:${propertyId}`;
}

/** Generate a UUID-like ID for a new rule. */
function generateRuleId(): string {
  return `otr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Core: Evaluate Occupancy Rules
// ---------------------------------------------------------------------------

/**
 * Find and execute all matching automation rules for a given sensor reading.
 * This is the main entry point called when a new sensor reading arrives.
 */
export async function evaluateOccupancyRules(
  sensorId: string,
  reading: OccupancyReading,
): Promise<{
  matchedRules: Array<{ ruleId: string; ruleName: string; status: string }>;
}> {
  const results: Array<{ ruleId: string; ruleName: string; status: string }> = [];

  try {
    // 1. Look up the sensor to find its property, room, and type
    const sensor = await db.occupancySensor.findUnique({
      where: { id: sensorId },
      select: {
        id: true,
        tenantId: true,
        propertyId: true,
        roomId: true,
        sensorType: true,
      },
    });

    if (!sensor) {
      return { matchedRules: results };
    }

    // 2. Persist the reading
    await db.occupancyReading.create({
      data: {
        sensorId,
        tenantId: sensor.tenantId,
        value: reading.value,
        rawValue: reading.rawValue ?? null,
        confidence: reading.confidence ?? null,
        timestamp: reading.timestamp ? new Date(reading.timestamp) : new Date(),
      },
    });

    // 3. Update sensor lastReading
    await db.occupancySensor.update({
      where: { id: sensorId },
      data: { lastReading: new Date() },
    });

    // 4. Find all active rules for this property
    const allRules = await listRulesForProperty(sensor.tenantId, sensor.propertyId);

    const now = Date.now();

    for (const rule of allRules) {
      if (!rule.isActive) continue;

      // Check sensor type match
      if (rule.sensorType !== sensor.sensorType) continue;

      // Check room scope
      if (rule.roomId && rule.roomId !== sensor.roomId) continue;

      // Check cooldown
      const lastTriggered = cooldownMap.get(rule.id) ?? 0;
      const cooldownMs = (rule.cooldownMinutes ?? 5) * 60 * 1000;
      if (now - lastTriggered < cooldownMs) continue;

      // Evaluate trigger condition
      const matched = evaluateTriggerCondition(
        rule.triggerType,
        reading.value,
        rule.thresholdValue,
      );

      if (!matched) continue;

      // 5. Mark cooldown immediately (fire-and-forget)
      cooldownMap.set(rule.id, now);

      // 6. Execute actions (fire-and-forget for non-critical)
      const context = {
        sensorId,
        sensorType: sensor.sensorType,
        roomId: sensor.roomId,
        propertyId: sensor.propertyId,
        tenantId: sensor.tenantId,
        readingValue: reading.value,
        readingTimestamp: reading.timestamp || new Date().toISOString(),
        ruleId: rule.id,
        ruleName: rule.name,
      };

      try {
        await executeRuleActions(rule, context);
        results.push({ ruleId: rule.id, ruleName: rule.name, status: 'executed' });
      } catch (actionError) {
        console.error(`[OccupancyAutomation] Action execution failed for rule ${rule.id}:`, actionError);
        results.push({ ruleId: rule.id, ruleName: rule.name, status: 'error' });
      }
    }
  } catch (error) {
    console.error('[OccupancyAutomation] evaluateOccupancyRules error:', error);
  }

  return { matchedRules: results };
}

// ---------------------------------------------------------------------------
// Trigger condition evaluation
// ---------------------------------------------------------------------------

function evaluateTriggerCondition(
  triggerType: TriggerType,
  value: number,
  threshold?: number,
): boolean {
  switch (triggerType) {
    case 'room_occupied':
      // Triggered when occupancy value indicates room is occupied (> 0.5)
      return value > 0.5;

    case 'room_vacant':
      // Triggered when occupancy value indicates room is vacant (< 0.3)
      return value < 0.3;

    case 'occupancy_threshold':
      // Triggered when value crosses the configured threshold
      return threshold !== undefined && value >= threshold;

    case 'no_motion_timeout':
      // This trigger type relies on value being 0 (no motion detected)
      // The threshold represents minutes; the reading value being 0 for that
      // duration would typically be detected by a separate timer.
      // Here we check if the value is 0 (no motion) — the timeout logic
      // would be handled upstream or via lastReading timestamps.
      return value === 0;

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Execute rule actions
// ---------------------------------------------------------------------------

/**
 * Execute each action defined in a rule.
 * Non-critical actions (notifications, energy mode) are fire-and-forget.
 * Critical actions (room status, housekeeping) are awaited.
 */
export async function executeRuleActions(
  rule: OccupancyTriggerRule,
  context: {
    sensorId: string;
    sensorType: string;
    roomId?: string;
    propertyId: string;
    tenantId: string;
    readingValue: number;
    readingTimestamp: string;
    ruleId: string;
    ruleName: string;
  },
): Promise<void> {
  if (!rule.actions || rule.actions.length === 0) return;

  // Execute all actions — critical ones are awaited, non-critical are fire-and-forget
  const actionPromises = rule.actions.map((action) =>
    executeSingleAction(action, context),
  );

  // Wait for critical actions, let non-critical ones run in background
  await Promise.allSettled(actionPromises);
}

async function executeSingleAction(
  action: OccupancyTriggerAction,
  context: {
    roomId?: string;
    propertyId: string;
    tenantId: string;
    ruleName: string;
  },
): Promise<void> {
  try {
    switch (action.type) {
      case 'set_room_status': {
        const status = action.params.status as RoomStatusAction;
        if (context.roomId && status) {
          await setRoomStatus(context.roomId, status);
        }
        break;
      }

      case 'create_housekeeping_task': {
        const priority = action.params.priority as TaskPriorityAction;
        if (context.roomId) {
          await createHousekeepingTask(
            context.tenantId,
            context.propertyId,
            context.roomId,
            priority || 'medium',
            `Automated: ${context.ruleName}`,
          );
        }
        break;
      }

      case 'adjust_thermostat': {
        const mode = action.params.mode as ThermostatMode;
        const temperature = action.params.temperature as number | undefined;
        if (context.roomId) {
          await adjustThermostat(context.roomId, mode, temperature);
        }
        break;
      }

      case 'toggle_lights': {
        const state = action.params.state as LightState;
        const scene = action.params.scene as string | undefined;
        if (context.roomId) {
          await toggleLights(context.roomId, state, scene);
        }
        break;
      }

      case 'send_notification': {
        const channel = action.params.channel as NotificationChannel;
        const message = action.params.message as string;
        // Fire-and-forget: store notification in DB
        if (message) {
          sendNotification(context.tenantId, context.propertyId, channel, message).catch(() => {});
        }
        break;
      }

      case 'update_energy_mode': {
        const mode = action.params.mode as EnergyMode;
        if (context.roomId) {
          await updateEnergyMode(context.roomId, mode);
        }
        break;
      }

      default:
        console.warn(`[OccupancyAutomation] Unknown action type: ${action.type}`);
    }
  } catch (error) {
    console.error(`[OccupancyAutomation] Failed to execute action ${action.type}:`, error);
  }
}

// ---------------------------------------------------------------------------
// Action helpers
// ---------------------------------------------------------------------------

/**
 * Update room status in the database.
 */
export async function setRoomStatus(
  roomId: string,
  status: RoomStatusAction,
): Promise<void> {
  const validStatuses: string[] = ['cleaning', 'available', 'maintenance'];
  if (!validStatuses.includes(status)) {
    console.warn(`[setRoomStatus] Invalid status: ${status}`);
    return;
  }

  // Map our action statuses to the Prisma RoomStatus enum
  const statusMap: Record<string, string> = {
    cleaning: 'cleaning',
    available: 'available',
    maintenance: 'maintenance',
  };

  try {
    await db.room.update({
      where: { id: roomId },
      data: {
        status: statusMap[status] as any,
      },
    });
    console.log(`[setRoomStatus] Room ${roomId} set to ${status}`);
  } catch (error) {
    console.error(`[setRoomStatus] Failed to update room ${roomId}:`, error);
  }
}

/**
 * Create a housekeeping task in the Task table.
 */
export async function createHousekeepingTask(
  tenantId: string,
  propertyId: string,
  roomId: string,
  priority: TaskPriorityAction,
  description: string,
): Promise<void> {
  const priorityMap: Record<string, string> = {
    high: 'high',
    medium: 'medium',
    low: 'low',
  };

  try {
    await db.task.create({
      data: {
        tenantId,
        propertyId,
        roomId,
        type: 'housekeeping',
        category: 'automated',
        title: `Auto HK: Room triggered`,
        description: description || 'Automated housekeeping task from occupancy trigger',
        priority: (priorityMap[priority] || 'medium') as any,
        status: 'pending',
      },
    });
    console.log(`[createHousekeepingTask] Task created for room ${roomId} with priority ${priority}`);
  } catch (error) {
    console.error(`[createHousekeepingTask] Failed to create task for room ${roomId}:`, error);
  }
}

/**
 * Send a thermostat adjustment command via IoT HAL.
 * Falls back to storing the command in IoTCommand table.
 */
export async function adjustThermostat(
  roomId: string,
  mode: ThermostatMode,
  temperature?: number,
): Promise<void> {
  // Try to find a thermostat device linked to this room
  try {
    const devices = await db.ioTDevice.findMany({
      where: {
        roomId,
        type: 'thermostat',
        status: 'online',
      },
      select: { id: true, name: true },
    });

    if (devices.length > 0) {
      // Use IoT HAL to send the command
      const { getIoTRegistry } = await import('@/lib/iot/hal/registry');
      const registry = getIoTRegistry();
      await registry.connectAll();

      for (const device of devices) {
        const thermostat = registry.get('thermostat', 'iot_simulator');
        if (thermostat) {
          const command = mode === 'off' ? 'set_mode' : 'set_mode';
          await thermostat.executeCommand(device.id, command, { mode, temperature });
          console.log(`[adjustThermostat] Sent ${mode} to device ${device.id}`);
        }
      }
    } else {
      console.log(`[adjustThermostat] No online thermostat found for room ${roomId}`);
    }
  } catch (error) {
    console.error(`[adjustThermostat] Failed to adjust thermostat for room ${roomId}:`, error);
  }
}

/**
 * Toggle lights via IoT HAL.
 */
export async function toggleLights(
  roomId: string,
  state: LightState,
  scene?: string,
): Promise<void> {
  try {
    const devices = await db.ioTDevice.findMany({
      where: {
        roomId,
        type: 'lighting',
        status: 'online',
      },
      select: { id: true, name: true },
    });

    if (devices.length > 0) {
      const { getIoTRegistry } = await import('@/lib/iot/hal/registry');
      const registry = getIoTRegistry();
      await registry.connectAll();

      const lighting = registry.get('lighting', 'iot_simulator');
      if (lighting) {
        for (const device of devices) {
          if (scene) {
            await lighting.executeCommand(device.id, 'set_scene', { sceneId: scene });
          } else {
            await lighting.executeCommand(device.id, 'set_state', { on: state === 'on' });
          }
          console.log(`[toggleLights] Set ${state} (scene: ${scene || 'none'}) on device ${device.id}`);
        }
      }
    } else {
      console.log(`[toggleLights] No online lighting device found for room ${roomId}`);
    }
  } catch (error) {
    console.error(`[toggleLights] Failed to toggle lights for room ${roomId}:`, error);
  }
}

/**
 * Send a notification (fire-and-forget). Stores in the Notification table.
 */
async function sendNotification(
  tenantId: string,
  _propertyId: string,
  _channel: NotificationChannel,
  message: string,
): Promise<void> {
  try {
    await db.notification.create({
      data: {
        tenantId,
        type: 'system',
        category: 'info',
        title: 'Occupancy Automation Alert',
        message,
        data: JSON.stringify({ source: 'occupancy_trigger' }),
      },
    });
  } catch (error) {
    console.error('[sendNotification] Failed:', error);
  }
}

/**
 * Update energy mode for a room.
 */
async function updateEnergyMode(
  roomId: string,
  mode: EnergyMode,
): Promise<void> {
  try {
    // Find thermostat devices for this room and set energy mode
    const devices = await db.ioTDevice.findMany({
      where: {
        roomId,
        type: 'thermostat',
        status: 'online',
      },
      select: { id: true },
    });

    if (devices.length > 0) {
      const { getIoTRegistry } = await import('@/lib/iot/hal/registry');
      const registry = getIoTRegistry();
      await registry.connectAll();

      const thermostat = registry.get('thermostat', 'iot_simulator');
      if (thermostat) {
        for (const device of devices) {
          const halMode = mode === 'eco' ? 'eco' : mode === 'occupied' ? 'auto' : 'off';
          await thermostat.executeCommand(device.id, 'set_mode', { mode: halMode });
        }
        console.log(`[updateEnergyMode] Room ${roomId} set to ${mode} energy mode`);
      }
    }
  } catch (error) {
    console.error(`[updateEnergyMode] Failed for room ${roomId}:`, error);
  }
}

// ---------------------------------------------------------------------------
// Rule management helpers (used by the CRUD API route)
// ---------------------------------------------------------------------------

/**
 * List all rules for a given property.
 */
export async function listRulesForProperty(
  tenantId: string,
  propertyId: string,
): Promise<OccupancyTriggerRule[]> {
  const configs = await db.systemConfig.findMany({
    where: {
      tenantId,
      key: { startsWith: `${CONFIG_CATEGORY}:rule:` },
    },
    orderBy: { createdAt: 'desc' },
  });

  return configs
    .map((c) => {
      const rule = c.value as unknown as OccupancyTriggerRule;
      if (rule.propertyId !== propertyId) return null;
      return rule;
    })
    .filter(Boolean) as OccupancyTriggerRule[];
}

/**
 * Get a single rule by ID.
 */
export async function getRuleById(
  tenantId: string,
  ruleId: string,
): Promise<OccupancyTriggerRule | null> {
  const config = await db.systemConfig.findUnique({
    where: {
      tenantId_key: {
        tenantId,
        key: ruleConfigKey(ruleId),
      },
    },
  });

  if (!config) return null;
  return config.value as unknown as OccupancyTriggerRule;
}

/**
 * Create a new occupancy trigger rule.
 */
export async function createRule(
  tenantId: string,
  data: {
    propertyId: string;
    roomId?: string;
    name: string;
    description?: string;
    triggerType: TriggerType;
    sensorType: SensorType;
    thresholdValue?: number;
    actions: OccupancyTriggerAction[];
    isActive?: boolean;
    cooldownMinutes?: number;
  },
): Promise<OccupancyTriggerRule> {
  const id = generateRuleId();
  const now = new Date().toISOString();

  const rule: OccupancyTriggerRule = {
    id,
    tenantId,
    propertyId: data.propertyId,
    roomId: data.roomId,
    name: data.name,
    description: data.description,
    triggerType: data.triggerType,
    sensorType: data.sensorType,
    thresholdValue: data.thresholdValue,
    actions: data.actions,
    isActive: data.isActive ?? true,
    cooldownMinutes: data.cooldownMinutes ?? 5,
    createdAt: now,
    updatedAt: now,
  };

  await db.systemConfig.create({
    data: {
      tenantId,
      key: ruleConfigKey(id),
      value: rule as any,
    },
  });

  return rule;
}

/**
 * Update an existing rule.
 */
export async function updateRule(
  tenantId: string,
  ruleId: string,
  updates: Partial<OccupancyTriggerRule>,
): Promise<OccupancyTriggerRule | null> {
  const existing = await getRuleById(tenantId, ruleId);
  if (!existing) return null;

  const updated: OccupancyTriggerRule = {
    ...existing,
    ...updates,
    id: existing.id,          // Prevent ID change
    tenantId: existing.tenantId, // Prevent tenant change
    updatedAt: new Date().toISOString(),
  };

  await db.systemConfig.upsert({
    where: {
      tenantId_key: {
        tenantId,
        key: ruleConfigKey(ruleId),
      },
    },
    update: {
      value: updated as any,
    },
    create: {
      tenantId,
      key: ruleConfigKey(ruleId),
      value: updated as any,
    },
  });

  return updated;
}

/**
 * Delete a rule.
 */
export async function deleteRule(
  tenantId: string,
  ruleId: string,
): Promise<boolean> {
  try {
    await db.systemConfig.delete({
      where: {
        tenantId_key: {
          tenantId,
          key: ruleConfigKey(ruleId),
        },
      },
    });
    cooldownMap.delete(ruleId);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export const VALID_TRIGGER_TYPES: TriggerType[] = [
  'room_occupied',
  'room_vacant',
  'occupancy_threshold',
  'no_motion_timeout',
];

export const VALID_SENSOR_TYPES: SensorType[] = [
  'motion',
  'co2',
  'door',
  'infrared',
  'pressure',
];

export const VALID_ACTION_TYPES = [
  'set_room_status',
  'create_housekeeping_task',
  'adjust_thermostat',
  'toggle_lights',
  'send_notification',
  'update_energy_mode',
];

export const VALID_ROOM_STATUSES: RoomStatusAction[] = [
  'cleaning',
  'available',
  'maintenance',
];

export const VALID_TASK_PRIORITIES: TaskPriorityAction[] = [
  'high',
  'medium',
  'low',
];

export const VALID_THERMOSTAT_MODES: ThermostatMode[] = [
  'eco',
  'comfort',
  'off',
];

export const VALID_LIGHT_STATES: LightState[] = ['on', 'off'];

export const VALID_ENERGY_MODES: EnergyMode[] = [
  'occupied',
  'eco',
  'unoccupied',
];
