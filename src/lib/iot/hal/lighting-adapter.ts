/**
 * L-27: IoT HAL — Lighting Adapter
 *
 * Concrete lighting adapter class extending BaseIoTAdapter.
 * Provides lighting control: turnOn, turnOff, setBrightness, setColor, setScene.
 * Simulates preconfigured scenes: welcome, goodnight, reading, movie, cleaning.
 */

import {
  BaseIoTAdapter,
  type IoTAdapterInfo,
  type IoTCommandResult,
  type IoTHealthCheck,
  type IoTDeviceState,
} from './index';

// Lighting-specific state constants
export const LightColorMode = {
  HS: 'hs',       // Hue + Saturation
  RGB: 'rgb',     // Red + Green + Blue
  CT: 'ct',       // Color Temperature (white spectrum)
  XY: 'xy',       // CIE xy color space (Philips Hue native)
} as const;

export type LightColorModeValue = (typeof LightColorMode)[keyof typeof LightColorMode];

// ---------------------------------------------------------------------------
// Scene definitions
// ---------------------------------------------------------------------------

interface ScenePreset {
  name: string;
  brightness: number;   // 0–100
  colorTempK?: number;    // Color temperature in Kelvin
  r?: number;             // RGB red (0–255)
  g?: number;             // RGB green (0–255)
  b?: number;             // RGB blue (0–255)
  colorMode: LightColorModeValue;
}

const SCENE_PRESETS: Record<string, ScenePreset> = {
  welcome: {
    name: 'Welcome',
    brightness: 80,
    colorTempK: 4000,
    colorMode: LightColorMode.CT,
  },
  goodnight: {
    name: 'Goodnight',
    brightness: 10,
    colorTempK: 2700,
    colorMode: LightColorMode.CT,
  },
  reading: {
    name: 'Reading',
    brightness: 90,
    colorTempK: 5000,
    colorMode: LightColorMode.CT,
  },
  movie: {
    name: 'Movie',
    brightness: 15,
    r: 30,
    g: 20,
    b: 50,
    colorMode: LightColorMode.RGB,
  },
  cleaning: {
    name: 'Cleaning',
    brightness: 100,
    colorTempK: 6500,
    colorMode: LightColorMode.CT,
  },
};

// ---------------------------------------------------------------------------
// Internal device representation
// ---------------------------------------------------------------------------

interface LightingDevice {
  deviceId: string;
  name: string;
  location: string;
  zone: string;
  online: boolean;
  lastSeen: Date;
  isOn: boolean;
  brightness: number;       // 0–100
  colorMode: LightColorModeValue;
  r: number;                // 0–255
  g: number;                // 0–255
  b: number;                // 0–255
  colorTempK: number;        // Kelvin (2000–6500)
  activeScene: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateDeviceId(): string {
  return `light-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampBrightness(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampRGB(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampColorTempK(value: number): number {
  return Math.max(2000, Math.min(6500, Math.round(value)));
}

// ---------------------------------------------------------------------------
// LightingAdapter
// ---------------------------------------------------------------------------

export class LightingAdapter extends BaseIoTAdapter {
  private devices = new Map<string, LightingDevice>();
  private seedCount = 6;

  // -----------------------------------------------------------------------
  // Adapter metadata
  // -----------------------------------------------------------------------

  getInfo(): IoTAdapterInfo {
    return {
      providerId: 'iot_simulator',
      category: 'lighting',
      displayName: 'IoT Lighting Simulator',
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
      message: this._connected ? 'Lighting systems operational' : 'Adapter not connected',
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
      case 'set_state':
        return (params?.on as boolean) ? this.turnOn(deviceId) : this.turnOff(deviceId);
      case 'set_brightness':
        return this.setBrightness(deviceId, (params?.brightness as number) ?? 100);
      case 'set_color':
        return this.setColor(deviceId, params as { r?: number; g?: number; b?: number; hue?: number; saturation?: number });
      case 'set_scene':
        return this.setScene(deviceId, (params?.sceneId as string) ?? 'welcome');
      case 'set_warmth':
        return this.setColorTemp(deviceId, (params?.colorTempK as number) ?? 4000);
      default:
        return {
          success: false,
          error: `Unknown lighting command: "${command}"`,
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
        name: device.name,
        location: device.location,
        zone: device.zone,
        isOn: device.isOn,
        brightness: device.brightness,
        colorMode: device.colorMode,
        r: device.r,
        g: device.g,
        b: device.b,
        colorTempK: device.colorTempK,
        activeScene: device.activeScene,
      },
    };
    return state as unknown as Record<string, unknown>;
  }

  async discoverDevices(): Promise<Record<string, unknown>[]> {
    return Array.from(this.devices.values()).map((d) => ({
      deviceId: d.deviceId,
      name: d.name,
      location: d.location,
      zone: d.zone,
      online: d.online,
      isOn: d.isOn,
      brightness: d.brightness,
      colorMode: d.colorMode,
      activeScene: d.activeScene,
      lastSeen: d.lastSeen.toISOString(),
    }));
  }

  // -----------------------------------------------------------------------
  // Lighting-specific methods
  // -----------------------------------------------------------------------

  async turnOn(deviceId: string): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Light "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    device.isOn = true;
    if (device.brightness === 0) {
      device.brightness = 80;
    }
    device.lastSeen = new Date();

    return {
      success: true,
      commandId: generateDeviceId(),
      data: {
        deviceId: device.deviceId,
        isOn: device.isOn,
        brightness: device.brightness,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async turnOff(deviceId: string): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Light "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    device.isOn = false;
    device.brightness = 0;
    device.activeScene = null;
    device.lastSeen = new Date();

    return {
      success: true,
      commandId: generateDeviceId(),
      data: {
        deviceId: device.deviceId,
        isOn: device.isOn,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async setBrightness(
    deviceId: string,
    brightness: number,
  ): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Light "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    const clamped = clampBrightness(brightness);
    device.brightness = clamped;
    device.isOn = clamped > 0;
    device.lastSeen = new Date();

    return {
      success: true,
      commandId: generateDeviceId(),
      data: {
        deviceId: device.deviceId,
        isOn: device.isOn,
        brightness: device.brightness,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async setColor(
    deviceId: string,
    params: { r?: number; g?: number; b?: number; hue?: number; saturation?: number },
  ): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Light "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    if (params.r != null && params.g != null && params.b != null) {
      device.r = clampRGB(params.r);
      device.g = clampRGB(params.g);
      device.b = clampRGB(params.b);
      device.colorMode = LightColorMode.RGB;
    } else if (params.hue != null && params.saturation != null) {
      // Convert HS to RGB (simplified HSL conversion)
      const h = params.hue;
      const s = params.saturation / 100;
      const l = 0.5;
      const a = s * Math.min(l, 1 - l);
      const f = (n: number): number => {
        const k = (n + h / 30) % 12;
        return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      };
      device.r = clampRGB(f(0) * 255);
      device.g = clampRGB(f(8) * 255);
      device.b = clampRGB(f(4) * 255);
      device.colorMode = LightColorMode.HS;
    } else {
      return {
        success: false,
        error: 'Must provide either { r, g, b } or { hue, saturation }',
        timestamp: new Date().toISOString(),
      };
    }

    device.isOn = true;
    if (device.brightness === 0) device.brightness = 80;
    device.activeScene = null;
    device.lastSeen = new Date();

    return {
      success: true,
      commandId: generateDeviceId(),
      data: {
        deviceId: device.deviceId,
        isOn: device.isOn,
        brightness: device.brightness,
        colorMode: device.colorMode,
        r: device.r,
        g: device.g,
        b: device.b,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async setScene(deviceId: string, sceneId: string): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Light "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    const preset = SCENE_PRESETS[sceneId];
    if (!preset) {
      return {
        success: false,
        error: `Unknown scene: "${sceneId}". Available scenes: ${Object.keys(SCENE_PRESETS).join(', ')}`,
        timestamp: new Date().toISOString(),
      };
    }

    device.brightness = preset.brightness;
    device.colorMode = preset.colorMode;
    device.activeScene = sceneId;

    if (preset.colorTempK) {
      device.colorTempK = preset.colorTempK;
    }
    if (preset.r != null) {
      device.r = preset.r;
      device.g = preset.g ?? 0;
      device.b = preset.b ?? 0;
    }

    device.isOn = device.brightness > 0;
    device.lastSeen = new Date();

    return {
      success: true,
      commandId: generateDeviceId(),
      data: {
        deviceId: device.deviceId,
        scene: sceneId,
        sceneName: preset.name,
        brightness: device.brightness,
        colorMode: device.colorMode,
        colorTempK: device.colorTempK,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async setColorTemp(
    deviceId: string,
    colorTempK: number,
  ): Promise<IoTCommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return {
        success: false,
        error: `Light "${deviceId}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    device.colorTempK = clampColorTempK(colorTempK);
    device.colorMode = LightColorMode.CT;
    device.isOn = true;
    if (device.brightness === 0) device.brightness = 80;
    device.activeScene = null;
    device.lastSeen = new Date();

    return {
      success: true,
      commandId: generateDeviceId(),
      data: {
        deviceId: device.deviceId,
        colorTempK: device.colorTempK,
        colorMode: device.colorMode,
        brightness: device.brightness,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // Public helpers
  // -----------------------------------------------------------------------

  /** List all available scene presets */
  getAvailableScenes(): Array<{ id: string; name: string; brightness: number }> {
    return Object.entries(SCENE_PRESETS).map(([id, preset]) => ({
      id,
      name: preset.name,
      brightness: preset.brightness,
    }));
  }

  // -----------------------------------------------------------------------
  // Seed helper
  // -----------------------------------------------------------------------

  private seedDevices(): void {
    this.devices.clear();

    const lightConfigs = [
      { name: 'Ceiling Light', location: 'Room 101', zone: 'bedroom' },
      { name: 'Bathroom Light', location: 'Room 101', zone: 'bathroom' },
      { name: 'Reading Lamp', location: 'Room 101', zone: 'desk' },
      { name: 'Lobby Chandelier', location: 'Main Lobby', zone: 'lobby' },
      { name: 'Hallway Light', location: 'Corridor 1F', zone: 'corridor' },
      { name: 'Bathroom Vanity', location: 'Room 102', zone: 'bathroom' },
    ];

    for (let i = 0; i < Math.min(this.seedCount, lightConfigs.length); i++) {
      const cfg = lightConfigs[i];
      const deviceId = generateDeviceId();
      this.devices.set(deviceId, {
        deviceId,
        name: cfg.name,
        location: cfg.location,
        zone: cfg.zone,
        online: true,
        lastSeen: new Date(),
        isOn: true,
        brightness: 70 + Math.floor(Math.random() * 30),
        colorMode: LightColorMode.CT,
        r: 255,
        g: 244,
        b: 229,
        colorTempK: 4000,
        activeScene: null,
      });
    }
  }
}
