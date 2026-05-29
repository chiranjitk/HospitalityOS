/**
 * L-27: IoT HAL — Adapter Registry
 *
 * TODO(L-27): Implement the IoT adapter registry.
 *
 * The registry manages adapter instances per (tenantId, propertyId, category)
 * and dispatches commands to the correct adapter.
 *
 * Implementation guide:
 *
 * 1. On server startup, load all HardwareAdapter records grouped by category.
 * 2. For each adapter config, instantiate the matching adapter class:
 *    - 'lock' → use src/lib/hardware/locks/adapters/ (existing)
 *    - 'thermostat' → use ./thermostat-adapter.ts (TODO)
 *    - 'lighting' → use ./lighting-adapter.ts (TODO)
 *    - 'sensor' → use ./sensor-adapter.ts (TODO)
 * 3. Call adapter.initialize(config) with credentials from HardwareAdapterCredential.
 * 4. Call adapter.connect() to establish vendor connections.
 * 5. Store the adapter instance in a Map<string, BaseIoTAdapter> keyed by `${propertyId}:${category}`.
 * 6. Expose getAdapter(propertyId, category) and dispatch(deviceId, command, params).
 *
 * Health monitoring:
 *   - Run adapter.healthCheck() every 60 seconds per adapter
 *   - If unhealthy for 3 consecutive checks, mark adapter as degraded
 *   - Auto-reconnect on next command attempt
 *   - Log health transitions to AuditLog for visibility
 *
 * Reference: src/lib/hardware/registry.ts (existing hardware adapter registry)
 */

// TODO(L-27): Implement IoTAdapterRegistry class
// TODO(L-27): Add automatic health monitoring with configurable intervals
// TODO(L-27): Add adapter warm-up on server startup
// TODO(L-27): Add graceful shutdown (disconnect all adapters)

export {};
