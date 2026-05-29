/**
 * L-27: StaySuite-HospitalityOS — IoT HAL (Hardware Abstraction Layer)
 *
 * This module provides a unified abstraction over IoT device types
 * (locks, thermostats, lighting, sensors) so the rest of the application
 * can issue commands without knowing vendor-specific APIs.
 *
 * ARCHITECTURE OVERVIEW
 * ─────────────────────
 * 1. Each device category has a base adapter class (e.g., BaseIoTAdapter<T>).
 * 2. Concrete vendor adapters extend the base and implement the abstract methods.
 * 3. The registry maps (tenantId, propertyId, category) → adapter instance.
 * 4. Routes call the registry, which dispatches to the correct adapter.
 *
 * IMPLEMENTATION GUIDE
 * ─────────────────────
 * To add a new vendor adapter (e.g., "ecobee" for thermostats):
 *
 * Step 1: Create `src/lib/iot/hal/adapters/ecobee-thermostat.ts`
 *   - Import BaseThermostatAdapter from this file
 *   - Extend the class and implement all abstract methods
 *   - Implement vendor-specific HTTP/WebSocket communication
 *   - Map vendor states → StaySuite canonical states
 *   - Handle rate limiting, retries, and error translation
 *
 * Step 2: Register the adapter in the factory
 *   - Add a factory function: `createEcobeeAdapter(config, creds) => new EcobeeAdapter()`
 *   - Register it in `src/lib/iot/hal/registry.ts` under category 'thermostat'
 *
 * Step 3: Configure in the database
 *   - Insert a HardwareAdapter record with providerId='ecobee', category='thermostat'
 *   - Store vendor credentials in HardwareAdapterCredential (encrypted)
 *
 * Step 4: Test with the simulator
 *   - Use providerId='iot_simulator' for development without real hardware
 *   - The simulator mirrors the src/lib/hardware/locks/adapters/simulator.ts pattern
 *
 * PROTOCOL INTEGRATION
 * ─────────────────────
 * Adapters may communicate via:
 *   - REST/GraphQL APIs (most common: Nuki, Seam, Assa Abloy, Ecobee)
 *   - MQTT (see src/lib/iot/protocols/mqtt.ts for broker setup)
 *   - Zigbee (see src/lib/iot/protocols/zigbee.ts for coordinator setup)
 *   - Z-Wave (see src/lib/iot/protocols/zwave.ts for controller setup)
 *
 * @see src/lib/iot/protocols/mqtt.ts    — MQTT broker integration
 * @see src/lib/iot/protocols/zigbee.ts   — Zigbee mesh network
 * @see src/lib/iot/protocols/zwave.ts    — Z-Wave mesh network
 * @see src/lib/hardware/locks/           — Existing lock adapter implementations
 */

// ---------------------------------------------------------------------------
// Common types
// ---------------------------------------------------------------------------

export interface IoTAdapterInfo {
  providerId: string;
  category: IoTDeviceCategory;
  displayName: string;
  version: string;
  supportsWebhooks: boolean;
  supportsPolling: boolean;
}

export type IoTDeviceCategory = 'lock' | 'thermostat' | 'lighting' | 'sensor' | 'curtain' | 'dnd' | 'mur';

export interface IoTCredential {
  key: string;
  value: string;
  encrypted?: boolean;
}

export interface IoTAdapterConfig {
  propertyId: string;
  tenantId: string;
  providerId: string;
  category: IoTDeviceCategory;
  credentials: Record<string, string>;
  settings?: Record<string, unknown>;
}

export interface IoTCommandResult {
  success: boolean;
  commandId?: string;
  data?: Record<string, unknown>;
  error?: string;
  timestamp: string;
}

export interface IoTHealthCheck {
  healthy: boolean;
  latencyMs: number;
  message?: string;
  lastCheckedAt: string;
}

// ---------------------------------------------------------------------------
// Base IoT Adapter (abstract)
// ---------------------------------------------------------------------------

export abstract class BaseIoTAdapter {
  protected config: IoTAdapterConfig | null = null;
  protected _connected = false;

  /** Return static metadata about this adapter. */
  abstract getInfo(): IoTAdapterInfo;

  /** Initialize adapter with configuration and credentials. */
  async initialize(config: IoTAdapterConfig): Promise<void> {
    this.config = config;
  }

  /** Connect to the vendor service / hardware bridge. */
  abstract connect(): Promise<void>;

  /** Disconnect gracefully. */
  abstract disconnect(): Promise<void>;

  /** Check adapter health (latency, connectivity). */
  abstract healthCheck(): Promise<IoTHealthCheck>;

  /** Execute a command on a device. */
  abstract executeCommand(deviceId: string, command: string, params?: Record<string, unknown>): Promise<IoTCommandResult>;

  /** Query current state of a device. */
  abstract getDeviceState(deviceId: string): Promise<Record<string, unknown>>;

  /** Discover devices available through this adapter. */
  abstract discoverDevices(): Promise<Record<string, unknown>[]>;

  isConnected(): boolean {
    return this._connected;
  }
}

// TODO(L-27): Implement concrete adapters for each IoT device category
// TODO(L-27): Add an IoTAdapterRegistry that maps (tenantId, propertyId, category) → adapter
// TODO(L-27): Add automatic health monitoring with configurable polling intervals
// TODO(L-27): Add command queueing for devices that are offline (with TTL and expiry)
// TODO(L-27): Add event bus for real-time device state change notifications
