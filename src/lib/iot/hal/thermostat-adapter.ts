/**
 * L-27: IoT HAL — Thermostat Adapter
 *
 * Concrete thermostat adapter class extending BaseIoTAdapter.
 * Provides HVAC control: setTemperature, setMode, getTemperature, setSchedule.
 * Simulates heating, cooling, auto, and off modes with realistic temperature drift.
 */

import {
  BaseIoTAdapter,
  type IoTAdapterInfo,
  type IoTCommandResult,
  type IoTHealthCheck,
  type IoTDeviceState,
} from './index';

// Thermostat-specific state constants
export const ThermostatMode = {
  HEAT: 'heat',
  COOL: 'cool',
  AUTO: 'auto',
  OFF: 'off',
  ECO: 'eco',
} as const;

export type ThermostatModeValue = (typeof ThermostatMode)[keyof typeof ThermostatMode];

export const FanSpeed = {
  AUTO: 'auto',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type FanSpeedValue = (typeof FanSpeed)[keyof typeof FanSpeed];

// ---------------------------------------------------------------------------
// Internal device representation
// ---------------------------------------------------------------------------

interface ScheduleEntry {
  day: string;       // 'mon', 'tue', etc.
  startTime: string; // 'HH:MM'
  temperature: number;
  mode: ThermostatModeValue;
}

interface ThermostatDevice {
  deviceId: string;
  name: string;
  location: string;
  online: boolean;
  lastSeen: Date;
  currentTemperature: number;
  targetTemperature: number;
  mode: ThermostatModeValue;
  fanSpeed: FanSpeedValue;
  humidity: number;
  schedule: ScheduleEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateDeviceId(): string {
  return `thermo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Simulate temperature drift toward target based on HVAC mode */
function simulateTemperatureDrift(device: ThermostatDevice): number {
  const current = device.currentTemperature;
  const target = device.targetTemperature;
  const drift = (Math.random() - 0.5) * 0.4; // natural drift

  let adjusted = current + drift;

  switch (device.mode) {
    case ThermostatMode.HEAT:
      if (adjusted < target) adjusted += 0.2;
      break;
    case ThermostatMode.COOL:
      if (adjusted > target) adjusted -= 0.2;
      break;
    case ThermostatMode.AUTO:
      if (adjusted < target) adjusted += 0.15;
      else if (adjusted > target) adjusted -= 0.15;
      break;
    case ThermostatMode.ECO:
      // Eco mode has a wider deadband (±2°C)
      if (adjusted < target - 2) adjusted += 0.1;
      else if (adjusted > target + 2) adjusted -= 0.1;
      break;
    case ThermostatMode.OFF:
      // Slowly drift toward ambient (22°C)
      adjusted += (22 - adjusted) * 0.05;
      break;
  }

  return Math.round(adjusted * 10) / 10;
}

// ---------------------------------------------------------------------------
// ThermostatAdapter
// ---------------------------------------------------------------------------

export class ThermostatAdapter extends BaseIoTAdapter {
  private devices = new Map<string, ThermostatDevice>();
  private seedCount = 4;

  // -----------------------------------------------------------------------
  // Adapter metadata
  // -----------------------------------------------------------------------

  getInfo(): IoTAdapterInfo {
    return {
      providerId: 'iot_simulator',
      category: 'thermostat',
      displayName: 'IoT Thermostat Simulator',
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
    await new Promise((r) => setTimeout(r, Math.random() * 25));
    const latencyMs = Date.now() - start;

    return {
      healthy: this._connected,
      latencyMs,
      message: this._connected ? 'HVAC systems operational' : 'Adapter not connected',
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
      case 'set_temperature':
        return this.setTemperature(deviceId, (params?.temperatureC as number) ?? 22);
      case 'set_mode':
        return this.setMode(deviceId, (params?.mode as ThermostatModeValue) ?? ThermostatMode.OFF);
      case 'get_temperature':
        return this.getTemperature(deviceId);
      case 'set_fan':
        return this.setFanSpeed(deviceId, (params?.fan as FanSpeedValue) ?? FanSpeed.AUTO);
      case 'set_schedule':
        return this.setSchedule(deviceId, params?.schedule as ScheduleEntry[]);
      case 'eco_mode':
        return this.setMode(deviceId, ThermostatMode.ECO);
      default:
        return {
          success: false,
          error: `Unknown thermostat command: "${command}"`,
          timestamp: new Date().toISOString(),
        };
    }
  }

  async getDeviceState(deviceId: string): Promise<Record<string, unknown>> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return { online: false, lastSeen: null, properties: {} };
    }

    // Simulate natural temperature drift
    device.currentTemperature = simulateTemperatureDrift(device);
    device.humidity = Math.round((30 + Math.random() * 30) * 10) / 10;

    const state: IoTDeviceState = {
      online: device.online,
      lastSeen: device.lastSeen,
      properties: {
        currentTemperature: device.currentTemperature,
        targetTemperature: device.targetTemperature,
        mode: device.mode,
        fanSpeed: device.fanSpeed,
        humidity: device.humidity,
        location: device.location,
        name: device.name,
      },
    };
    return state as unknown as Record<string, unknown>;
  }

  async discoverDevices(): Promise<Record<string, unknown>[]> {
    return Array.from(this.devices.values()).map((d) => ({
      deviceId: d.deviceId,
      name: d.name,
      location: d.location,
      online: d.online,
      currentTemperature: d.currentTemperature,
      targetTemperature: d.targetTemperature,
      mode: d.mode,
      fanSpeed: d.fanSpeed,
      lastSeen: d.lastSeen.toISOString(),
    }));
  }

  // -----------------------------------------------------------------------
  // Thermostat-specific methods
  // -----------------------------------------------------------------------

  async setTemperature(
    deviceId: string,
    temperature: number,
  ): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Thermostat "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    if (temperature < 10 || temperature > 35) {
      return {
        success: false,
        error: 'Temperature must be between 10°C and 35°C',
        timestamp: new Date().toISOString(),
      };
    }

    device.targetTemperature = temperature;
    device.lastSeen = new Date();

    return {
      success: true,
      commandId: generateDeviceId(),
      data: {
        deviceId: device.deviceId,
        targetTemperature: device.targetTemperature,
        previousTemperature: device.currentTemperature,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async setMode(
    deviceId: string,
    mode: ThermostatModeValue,
  ): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Thermostat "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    const validModes: ThermostatModeValue[] = [
      ThermostatMode.HEAT,
      ThermostatMode.COOL,
      ThermostatMode.AUTO,
      ThermostatMode.OFF,
      ThermostatMode.ECO,
    ];

    if (!validModes.includes(mode)) {
      return {
        success: false,
        error: `Invalid mode: "${mode}". Must be one of: ${validModes.join(', ')}`,
        timestamp: new Date().toISOString(),
      };
    }

    device.mode = mode;
    device.lastSeen = new Date();

    return {
      success: true,
      commandId: generateDeviceId(),
      data: {
        deviceId: device.deviceId,
        mode: device.mode,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getTemperature(deviceId: string): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Thermostat "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    // Simulate drift on read
    device.currentTemperature = simulateTemperatureDrift(device);
    device.humidity = Math.round((30 + Math.random() * 30) * 10) / 10;
    device.lastSeen = new Date();

    return {
      success: true,
      data: {
        deviceId: device.deviceId,
        currentTemperature: device.currentTemperature,
        targetTemperature: device.targetTemperature,
        mode: device.mode,
        humidity: device.humidity,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async setSchedule(
    deviceId: string,
    schedule: ScheduleEntry[],
  ): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Thermostat "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    if (!Array.isArray(schedule) || schedule.length === 0) {
      return {
        success: false,
        error: 'Schedule must be a non-empty array of entries',
        timestamp: new Date().toISOString(),
      };
    }

    device.schedule = schedule;
    device.lastSeen = new Date();

    return {
      success: true,
      commandId: generateDeviceId(),
      data: {
        deviceId: device.deviceId,
        scheduleEntries: device.schedule.length,
        schedule: device.schedule,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async setFanSpeed(
    deviceId: string,
    fan: FanSpeedValue,
  ): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Thermostat "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    const validFans: FanSpeedValue[] = [
      FanSpeed.AUTO,
      FanSpeed.LOW,
      FanSpeed.MEDIUM,
      FanSpeed.HIGH,
    ];

    if (!validFans.includes(fan)) {
      return {
        success: false,
        error: `Invalid fan speed: "${fan}". Must be one of: ${validFans.join(', ')}`,
        timestamp: new Date().toISOString(),
      };
    }

    device.fanSpeed = fan;
    device.lastSeen = new Date();

    return {
      success: true,
      data: {
        deviceId: device.deviceId,
        fanSpeed: device.fanSpeed,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // Seed helper
  // -----------------------------------------------------------------------

  private seedDevices(): void {
    this.devices.clear();

    const locations = [
      { name: 'Room 101 Thermostat', location: 'Room 101' },
      { name: 'Room 102 Thermostat', location: 'Room 102' },
      { name: 'Lobby Thermostat', location: 'Main Lobby' },
      { name: 'Conference Room Thermostat', location: 'Conference A' },
    ];

    for (let i = 0; i < Math.min(this.seedCount, locations.length); i++) {
      const cfg = locations[i];
      const deviceId = generateDeviceId();
      const currentTemp = 20 + Math.random() * 4;
      this.devices.set(deviceId, {
        deviceId,
        name: cfg.name,
        location: cfg.location,
        online: true,
        lastSeen: new Date(),
        currentTemperature: Math.round(currentTemp * 10) / 10,
        targetTemperature: 22,
        mode: ThermostatMode.AUTO,
        fanSpeed: FanSpeed.AUTO,
        humidity: Math.round((40 + Math.random() * 20) * 10) / 10,
        schedule: [],
      });
    }
  }
}
