/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * Barrel exports — the single entry-point for all HAL modules.
 */

// Core types & errors
export * from './types';
export * from './errors';

// Registry (singleton)
export { hardwareRegistry, HardwareRegistry } from './registry';

// Health monitoring
export { HealthMonitor } from './health-monitor';
export type { HealthCheckable } from './health-monitor';

// Webhook routing
export { processWebhook } from './webhook-router';
export type { WebhookProcessingResult } from './webhook-router';

// Audit logging
export { logHardwareOperation } from './audit-logger';
export type { LogOperationParams } from './audit-logger';

// Lock adapters (expanded by lock agent)
export * from './locks';

// Terminal adapters (expanded by terminal agent)
export * from './terminals';
