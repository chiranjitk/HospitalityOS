/**
 * L-27: IoT HAL — Adapter Registry
 *
 * The registry manages adapter instances per (category, providerId)
 * and dispatches commands to the correct adapter.
 *
 * Usage:
 *   const registry = IoTAdapterRegistry.getInstance();
 *   registry.register(new LockAdapter());
 *   const lock = registry.get('lock', 'iot_simulator');
 *   await lock?.connect();
 *   await lock?.executeCommand('lock-123', 'lock');
 */

import { BaseIoTAdapter, type IoTDeviceCategory } from './index';
import { LockAdapter } from './lock-adapter';
import { SensorAdapter } from './sensor-adapter';
import { ThermostatAdapter } from './thermostat-adapter';
import { LightingAdapter } from './lighting-adapter';

// ---------------------------------------------------------------------------
// Registry key helper
// ---------------------------------------------------------------------------

function registryKey(category: string, providerId: string): string {
  return `${category}:${providerId}`;
}

// ---------------------------------------------------------------------------
// IoTAdapterRegistry
// ---------------------------------------------------------------------------

export class IoTAdapterRegistry {
  private static instance: IoTAdapterRegistry | null = null;
  private adapters = new Map<string, BaseIoTAdapter>();

  private constructor() {
    this.registerDefaults();
  }

  /** Get the singleton registry instance */
  static getInstance(): IoTAdapterRegistry {
    if (!IoTAdapterRegistry.instance) {
      IoTAdapterRegistry.instance = new IoTAdapterRegistry();
    }
    return IoTAdapterRegistry.instance;
  }

  /** Reset the singleton (useful for testing) */
  static resetInstance(): void {
    IoTAdapterRegistry.instance = null;
  }

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  /** Register an adapter instance for its category and providerId */
  register(adapter: BaseIoTAdapter): void {
    const info = adapter.getInfo();
    const key = registryKey(info.category, info.providerId);
    this.adapters.set(key, adapter);
  }

  /** Register an adapter with explicit category and providerId */
  registerAdapter(
    category: IoTDeviceCategory,
    providerId: string,
    adapter: BaseIoTAdapter,
  ): void {
    const key = registryKey(category, providerId);
    this.adapters.set(key, adapter);
  }

  // -----------------------------------------------------------------------
  // Retrieval
  // -----------------------------------------------------------------------

  /** Get an adapter by category and providerId */
  get(category: string, providerId: string): BaseIoTAdapter | undefined {
    const key = registryKey(category, providerId);
    return this.adapters.get(key);
  }

  /** Get all registered adapters */
  getAll(): Map<string, BaseIoTAdapter> {
    return new Map(this.adapters);
  }

  /** Get all adapters for a given category */
  getByCategory(category: string): BaseIoTAdapter[] {
    const result: BaseIoTAdapter[] = [];
    for (const [key, adapter] of this.adapters) {
      if (key.startsWith(`${category}:`)) {
        result.push(adapter);
      }
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Convenience factory methods
  // -----------------------------------------------------------------------

  /** Create and register a new LockAdapter */
  createLockAdapter(providerId: string = 'iot_simulator'): LockAdapter {
    const adapter = new LockAdapter();
    this.registerAdapter('lock', providerId, adapter);
    return adapter;
  }

  /** Create and register a new SensorAdapter */
  createSensorAdapter(providerId: string = 'iot_simulator'): SensorAdapter {
    const adapter = new SensorAdapter();
    this.registerAdapter('sensor', providerId, adapter);
    return adapter;
  }

  /** Create and register a new ThermostatAdapter */
  createThermostatAdapter(providerId: string = 'iot_simulator'): ThermostatAdapter {
    const adapter = new ThermostatAdapter();
    this.registerAdapter('thermostat', providerId, adapter);
    return adapter;
  }

  /** Create and register a new LightingAdapter */
  createLightingAdapter(providerId: string = 'iot_simulator'): LightingAdapter {
    const adapter = new LightingAdapter();
    this.registerAdapter('lighting', providerId, adapter);
    return adapter;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Connect all registered adapters */
  async connectAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const adapter of this.adapters.values()) {
      if (!adapter.isConnected()) {
        promises.push(adapter.connect());
      }
    }
    await Promise.all(promises);
  }

  /** Disconnect all registered adapters gracefully */
  async disconnectAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const adapter of this.adapters.values()) {
      if (adapter.isConnected()) {
        promises.push(adapter.disconnect());
      }
    }
    await Promise.all(promises);
  }

  /** Run health checks on all adapters */
  async healthCheckAll(): Promise<
    Array<{
      category: string;
      providerId: string;
      healthy: boolean;
      latencyMs: number;
    }>
  > {
    const results: Array<{
      category: string;
      providerId: string;
      healthy: boolean;
      latencyMs: number;
    }> = [];

    for (const [key, adapter] of this.adapters) {
      try {
        const health = await adapter.healthCheck();
        const [category, providerId] = key.split(':');
        results.push({
          category,
          providerId,
          healthy: health.healthy,
          latencyMs: health.latencyMs,
        });
      } catch {
        const [category, providerId] = key.split(':');
        results.push({
          category,
          providerId,
          healthy: false,
          latencyMs: -1,
        });
      }
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  /** Pre-register default simulator adapters */
  private registerDefaults(): void {
    this.register(new LockAdapter());
    this.register(new SensorAdapter());
    this.register(new ThermostatAdapter());
    this.register(new LightingAdapter());
  }
}

/** Convenience: get the default registry instance */
export function getIoTRegistry(): IoTAdapterRegistry {
  return IoTAdapterRegistry.getInstance();
}
