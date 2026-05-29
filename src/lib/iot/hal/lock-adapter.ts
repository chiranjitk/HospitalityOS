/**
 * L-27: IoT HAL — Lock Adapter
 *
 * Concrete lock adapter class extending BaseIoTAdapter.
 * Provides smart lock control: lock, unlock, status, timed unlock, emergency unlock.
 * Uses in-memory device state tracking for simulation.
 */

import {
  BaseIoTAdapter,
  type IoTAdapterInfo,
  type IoTCommandResult,
  type IoTHealthCheck,
  type IoTDeviceState,
} from './index';

// Lock-specific state constants
export const LockState = {
  LOCKED: 'locked',
  UNLOCKED: 'unlocked',
  JAMMED: 'jammed',
  UNKNOWN: 'unknown',
  LOW_BATTERY: 'low_battery',
} as const;

export type LockStateValue = (typeof LockState)[keyof typeof LockState];

// ---------------------------------------------------------------------------
// Internal device representation
// ---------------------------------------------------------------------------

interface LockDevice {
  deviceId: string;
  name: string;
  state: LockStateValue;
  batteryLevel: number;
  lastSeen: Date;
  timedUnlockTimer?: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateDeviceId(): string {
  return `lock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// LockAdapter
// ---------------------------------------------------------------------------

export class LockAdapter extends BaseIoTAdapter {
  private devices = new Map<string, LockDevice>();
  private seedCount = 5;

  // -----------------------------------------------------------------------
  // Adapter metadata
  // -----------------------------------------------------------------------

  getInfo(): IoTAdapterInfo {
    return {
      providerId: 'iot_simulator',
      category: 'lock',
      displayName: 'IoT Lock Simulator',
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
    // Clear all pending timed-unlock timers
    for (const device of this.devices.values()) {
      if (device.timedUnlockTimer) {
        clearTimeout(device.timedUnlockTimer);
        device.timedUnlockTimer = undefined;
      }
    }
    this.devices.clear();
    this._connected = false;
  }

  async healthCheck(): Promise<IoTHealthCheck> {
    const start = Date.now();
    // Simulate latency
    await new Promise((r) => setTimeout(r, Math.random() * 30));
    const latencyMs = Date.now() - start;

    return {
      healthy: this._connected,
      latencyMs,
      message: this._connected ? 'All systems operational' : 'Adapter not connected',
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
      case 'lock':
        return this.lock(deviceId);
      case 'unlock':
        return this.unlock(deviceId);
      case 'status':
        return this.getStatus(deviceId);
      case 'timed_unlock':
        return this.timedUnlock(deviceId, (params?.duration as number) ?? 30);
      case 'emergency_unlock':
        return this.emergencyUnlock(deviceId);
      default:
        return {
          success: false,
          error: `Unknown lock command: "${command}"`,
          timestamp: new Date().toISOString(),
        };
    }
  }

  async getDeviceState(deviceId: string): Promise<Record<string, unknown>> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return { online: false, lastSeen: null, properties: { state: LockState.UNKNOWN } };
    }

    const state: IoTDeviceState = {
      online: true,
      lastSeen: device.lastSeen,
      properties: {
        state: device.state,
        batteryLevel: device.batteryLevel,
        name: device.name,
      },
    };
    return state as unknown as Record<string, unknown>;
  }

  async discoverDevices(): Promise<Record<string, unknown>[]> {
    return Array.from(this.devices.values()).map((d) => ({
      deviceId: d.deviceId,
      name: d.name,
      state: d.state,
      batteryLevel: d.batteryLevel,
      online: true,
      lastSeen: d.lastSeen.toISOString(),
    }));
  }

  // -----------------------------------------------------------------------
  // Lock-specific methods
  // -----------------------------------------------------------------------

  async lock(deviceId: string): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Device "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    // Small chance of jam
    if (Math.random() < 0.03) {
      device.state = LockState.JAMMED;
      device.lastSeen = new Date();
      return {
        success: false,
        error: 'Lock jammed',
        data: { state: LockState.JAMMED },
        timestamp: new Date().toISOString(),
      };
    }

    device.state = LockState.LOCKED;
    device.lastSeen = new Date();

    return {
      success: true,
      commandId: generateDeviceId(),
      data: { state: device.state },
      timestamp: new Date().toISOString(),
    };
  }

  async unlock(deviceId: string): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Device "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    if (device.state === LockState.JAMMED) {
      return {
        success: false,
        error: 'Cannot unlock — lock is jammed',
        timestamp: new Date().toISOString(),
      };
    }

    device.state = LockState.UNLOCKED;
    device.lastSeen = new Date();

    return {
      success: true,
      commandId: generateDeviceId(),
      data: { state: device.state },
      timestamp: new Date().toISOString(),
    };
  }

  async getStatus(deviceId: string): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Device "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      data: {
        state: device.state,
        batteryLevel: device.batteryLevel,
        lastSeen: device.lastSeen.toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  async timedUnlock(
    deviceId: string,
    duration: number = 30,
  ): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Device "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    if (device.state === LockState.JAMMED) {
      return {
        success: false,
        error: 'Cannot unlock — lock is jammed',
        timestamp: new Date().toISOString(),
      };
    }

    // Clear any existing timer
    if (device.timedUnlockTimer) {
      clearTimeout(device.timedUnlockTimer);
    }

    device.state = LockState.UNLOCKED;
    device.lastSeen = new Date();

    // Auto re-lock after duration (capped at 10s for simulation)
    const simDuration = Math.min(duration, 10) * 1000;
    device.timedUnlockTimer = setTimeout(() => {
      if (device.state === LockState.UNLOCKED) {
        device.state = LockState.LOCKED;
        device.lastSeen = new Date();
      }
      device.timedUnlockTimer = undefined;
    }, simDuration);

    return {
      success: true,
      commandId: generateDeviceId(),
      data: {
        state: device.state,
        duration,
        willAutoLock: true,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async emergencyUnlock(deviceId: string): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Device "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    // Emergency unlock bypasses jam state
    if (device.timedUnlockTimer) {
      clearTimeout(device.timedUnlockTimer);
      device.timedUnlockTimer = undefined;
    }

    device.state = LockState.UNLOCKED;
    device.lastSeen = new Date();

    return {
      success: true,
      commandId: generateDeviceId(),
      data: { state: device.state, emergency: true },
      timestamp: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // Seed helper
  // -----------------------------------------------------------------------

  private seedDevices(): void {
    this.devices.clear();
    for (let i = 1; i <= this.seedCount; i++) {
      const deviceId = generateDeviceId();
      this.devices.set(deviceId, {
        deviceId,
        name: `Room ${100 + i} Door Lock`,
        state: LockState.LOCKED,
        batteryLevel: 60 + Math.floor(Math.random() * 40),
        lastSeen: new Date(),
      });
    }
  }
}
