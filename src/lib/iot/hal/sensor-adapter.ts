/**
 * L-27: IoT HAL — Sensor Adapter
 *
 * Concrete sensor adapter class extending BaseIoTAdapter.
 * Provides sensor control: poll, calibrate, setInterval, arm, disarm.
 * Simulates readings for occupancy, motion, temperature, humidity, and other sensor types.
 */

import {
  BaseIoTAdapter,
  type IoTAdapterInfo,
  type IoTCommandResult,
  type IoTHealthCheck,
  type IoTDeviceState,
} from './index';

// Sensor type constants
export const SensorType = {
  OCCUPANCY: 'occupancy',
  MOTION: 'motion',
  DOOR_WINDOW: 'door_window',
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
  ENERGY: 'energy',
  WATER_LEAK: 'water_leak',
  SMOKE: 'smoke',
  CO: 'co',
  LIGHT_LEVEL: 'light_level',
} as const;

export type SensorTypeValue = (typeof SensorType)[keyof typeof SensorType];

// ---------------------------------------------------------------------------
// Internal device representation
// ---------------------------------------------------------------------------

interface SensorReading {
  value: number;
  unit: string;
  timestamp: Date;
}

interface SensorDevice {
  deviceId: string;
  name: string;
  type: SensorTypeValue;
  location: string;
  online: boolean;
  lastSeen: Date;
  lastReading: SensorReading | null;
  batteryLevel: number;
  reportIntervalSeconds: number;
  isArmed: boolean;
  thresholds: {
    min?: number;
    max?: number;
  };
  calibrationOffset: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateDeviceId(): string {
  return `sensor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function simulateReading(type: SensorTypeValue): { value: number; unit: string } {
  switch (type) {
    case SensorType.OCCUPANCY:
      return { value: Math.random() > 0.4 ? 1 : 0, unit: 'boolean' };
    case SensorType.MOTION:
      return { value: Math.random() > 0.6 ? 1 : 0, unit: 'boolean' };
    case SensorType.DOOR_WINDOW:
      return { value: Math.random() > 0.7 ? 0 : 1, unit: 'boolean' }; // 0=open, 1=closed
    case SensorType.TEMPERATURE:
      return { value: 18 + Math.random() * 10, unit: 'celsius' }; // 18–28°C
    case SensorType.HUMIDITY:
      return { value: 30 + Math.random() * 40, unit: 'percent' }; // 30–70%
    case SensorType.ENERGY:
      return { value: Math.random() * 500, unit: 'watts' };
    case SensorType.WATER_LEAK:
      return { value: Math.random() > 0.95 ? 1 : 0, unit: 'boolean' };
    case SensorType.SMOKE:
      return { value: Math.random() > 0.98 ? 1 : 0, unit: 'boolean' };
    case SensorType.CO:
      return { value: Math.random() * 10, unit: 'ppm' };
    case SensorType.LIGHT_LEVEL:
      return { value: Math.floor(Math.random() * 1000), unit: 'lux' };
    default:
      return { value: 0, unit: 'unknown' };
  }
}

// ---------------------------------------------------------------------------
// SensorAdapter
// ---------------------------------------------------------------------------

export class SensorAdapter extends BaseIoTAdapter {
  private devices = new Map<string, SensorDevice>();
  private seedCount = 8;

  // -----------------------------------------------------------------------
  // Adapter metadata
  // -----------------------------------------------------------------------

  getInfo(): IoTAdapterInfo {
    return {
      providerId: 'iot_simulator',
      category: 'sensor',
      displayName: 'IoT Sensor Simulator',
      version: '1.0.0',
      supportsWebhooks: false,
      supportsPolling: true,
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async connect(): Promise<void> {
    if (this._connected) return;
    this.seedDevices();
    this._connected = true;
  }

  async disconnect(): Promise<void> {
    this.devices.clear();
    this._connected = false;
  }

  async healthCheck(): Promise<IoTHealthCheck> {
    const start = Date.now();
    await new Promise((r) => setTimeout(r, Math.random() * 20));
    const latencyMs = Date.now() - start;

    return {
      healthy: this._connected,
      latencyMs,
      message: this._connected ? 'All sensors reporting' : 'Adapter not connected',
      lastCheckedAt: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // BaseIoTAdapter interface
  // -----------------------------------------------------------------------

  async executeCommand(
    deviceId: string,
    command: string,
    params?: Record<string, unknown>,
  ): Promise<IoTCommandResult> {
    switch (command) {
      case 'poll':
        return this.poll(deviceId, params?.sensorIds as string[] | undefined);
      case 'calibrate':
        return this.calibrate(deviceId, (params?.offset as number) ?? 0);
      case 'set_interval':
        return this.setInterval(
          deviceId,
          (params?.intervalSeconds as number) ?? 60,
        );
      case 'arm':
        return this.arm(deviceId, params?.thresholds as { min?: number; max?: number } | undefined);
      case 'disarm':
        return this.disarm(deviceId);
      default:
        return {
          success: false,
          error: `Unknown sensor command: "${command}"`,
          timestamp: new Date().toISOString(),
        };
    }
  }

  async getDeviceState(deviceId: string): Promise<Record<string, unknown>> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return { online: false, lastSeen: null, properties: {} };
    }

    const state: IoTDeviceState = {
      online: device.online,
      lastSeen: device.lastSeen,
      properties: {
        type: device.type,
        location: device.location,
        batteryLevel: device.batteryLevel,
        isArmed: device.isArmed,
        reportIntervalSeconds: device.reportIntervalSeconds,
        calibrationOffset: device.calibrationOffset,
        thresholds: device.thresholds,
        lastReading: device.lastReading
          ? {
              value: device.lastReading.value,
              unit: device.lastReading.unit,
              timestamp: device.lastReading.timestamp.toISOString(),
            }
          : null,
      },
    };
    return state as unknown as Record<string, unknown>;
  }

  async discoverDevices(): Promise<Record<string, unknown>[]> {
    return Array.from(this.devices.values()).map((d) => ({
      deviceId: d.deviceId,
      name: d.name,
      type: d.type,
      location: d.location,
      online: d.online,
      batteryLevel: d.batteryLevel,
      lastSeen: d.lastSeen.toISOString(),
    }));
  }

  // -----------------------------------------------------------------------
  // Sensor-specific methods
  // -----------------------------------------------------------------------

  async poll(
    deviceId?: string,
    sensorIds?: string[],
  ): Promise<IoTCommandResult> {
    const targets: SensorDevice[] = [];

    if (sensorIds && sensorIds.length > 0) {
      for (const id of sensorIds) {
        const device = this.devices.get(id);
        if (device) targets.push(device);
      }
    } else if (deviceId) {
      const device = this.devices.get(deviceId);
      if (device) targets.push(device);
      else {
        return {
          success: false,
          error: `Sensor "${deviceId}" not found`,
          timestamp: new Date().toISOString(),
        };
      }
    } else {
      // Poll all devices
      targets.push(...this.devices.values());
    }

    const readings: Record<string, { value: number; unit: string; timestamp: string }> = {};

    for (const device of targets) {
      const raw = simulateReading(device.type);
      const value = raw.value + device.calibrationOffset;

      device.lastReading = {
        value,
        unit: raw.unit,
        timestamp: new Date(),
      };
      device.lastSeen = new Date();

      readings[device.deviceId] = {
        value,
        unit: raw.unit,
        timestamp: device.lastReading.timestamp.toISOString(),
      };

      // Check thresholds if armed
      if (device.isArmed && (device.thresholds.min != null || device.thresholds.max != null)) {
        const breached =
          (device.thresholds.min != null && value < device.thresholds.min) ||
          (device.thresholds.max != null && value > device.thresholds.max);

        if (breached) {
          return {
            success: true,
            commandId: generateDeviceId(),
            data: {
              readings,
              alert: {
                deviceId: device.deviceId,
                type: 'threshold_breach',
                value,
                thresholds: device.thresholds,
              },
            },
            timestamp: new Date().toISOString(),
          };
        }
      }
    }

    return {
      success: true,
      commandId: generateDeviceId(),
      data: { readings, count: targets.length },
      timestamp: new Date().toISOString(),
    };
  }

  async calibrate(
    deviceId: string,
    offset: number = 0,
  ): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Sensor "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    device.calibrationOffset = offset;
    device.lastSeen = new Date();

    return {
      success: true,
      data: {
        deviceId: device.deviceId,
        calibrationOffset: device.calibrationOffset,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async setInterval(
    deviceId: string,
    intervalSeconds: number,
  ): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Sensor "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    if (intervalSeconds < 1) {
      return {
        success: false,
        error: 'Interval must be at least 1 second',
        timestamp: new Date().toISOString(),
      };
    }

    device.reportIntervalSeconds = intervalSeconds;
    device.lastSeen = new Date();

    return {
      success: true,
      data: {
        deviceId: device.deviceId,
        reportIntervalSeconds: device.reportIntervalSeconds,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async arm(
    deviceId: string,
    thresholds?: { min?: number; max?: number },
  ): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Sensor "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    device.isArmed = true;
    if (thresholds) {
      device.thresholds = thresholds;
    }
    device.lastSeen = new Date();

    return {
      success: true,
      data: {
        deviceId: device.deviceId,
        isArmed: device.isArmed,
        thresholds: device.thresholds,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async disarm(deviceId: string): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Sensor "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    device.isArmed = false;
    device.thresholds = {};
    device.lastSeen = new Date();

    return {
      success: true,
      data: {
        deviceId: device.deviceId,
        isArmed: device.isArmed,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // Seed helper
  // -----------------------------------------------------------------------

  private seedDevices(): void {
    this.devices.clear();

    const sensorConfigs: Array<{ type: SensorTypeValue; name: string; location: string }> = [
      { type: SensorType.OCCUPANCY, name: 'Room Occupancy Sensor', location: 'Room 101' },
      { type: SensorType.MOTION, name: 'Hallway Motion Sensor', location: 'Corridor 1F' },
      { type: SensorType.DOOR_WINDOW, name: 'Main Door Contact', location: 'Entrance' },
      { type: SensorType.TEMPERATURE, name: 'Room Temp Sensor', location: 'Room 101' },
      { type: SensorType.HUMIDITY, name: 'Bathroom Humidity Sensor', location: 'Room 101 Bathroom' },
      { type: SensorType.ENERGY, name: 'Smart Energy Meter', location: 'Electrical Panel' },
      { type: SensorType.WATER_LEAK, name: 'Water Leak Detector', location: 'Room 101 Utility' },
      { type: SensorType.LIGHT_LEVEL, name: 'Ambient Light Sensor', location: 'Lobby' },
    ];

    for (let i = 0; i < Math.min(this.seedCount, sensorConfigs.length); i++) {
      const cfg = sensorConfigs[i];
      const deviceId = generateDeviceId();
      this.devices.set(deviceId, {
        deviceId,
        name: cfg.name,
        type: cfg.type,
        location: cfg.location,
        online: true,
        lastSeen: new Date(),
        lastReading: null,
        batteryLevel: 50 + Math.floor(Math.random() * 50),
        reportIntervalSeconds: 60,
        isArmed: false,
        thresholds: {},
        calibrationOffset: 0,
      });
    }
  }
}
