/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * Health Monitor — periodically checks all registered adapters and persists
 * the resulting health statuses to the database.
 */

import { AdapterHealth, AdapterHealthStatus, IHardwareAdapter } from './types';
import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Anything that exposes `checkAllHealth()` so the monitor doesn't need a
 * hard dependency on the concrete `HardwareRegistry` class.
 */
export interface HealthCheckable {
  checkAllHealth(): Promise<Map<string, AdapterHealth>>;
}

// ---------------------------------------------------------------------------
// HealthMonitor
// ---------------------------------------------------------------------------

export class HealthMonitor {
  private registry: HealthCheckable | null = null;
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private intervalMs: number;
  private running = false;

  constructor(intervalMs = 60_000) {
    this.intervalMs = intervalMs;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Start periodic health checks.
   *
   * If a previous run is active it is stopped first so the monitor is always
   * in a well-defined state.
   */
  start(registry: HealthCheckable, intervalMs?: number): void {
    this.stop(); // ensure clean slate
    this.registry = registry;

    if (intervalMs !== undefined) {
      this.intervalMs = intervalMs;
    }

    this.running = true;

    // Perform an immediate check, then schedule the periodic one.
    this.runCheck().catch((err) => {
      console.error('[HAL:HealthMonitor] Initial health check failed', err);
    });

    this.timerHandle = setInterval(() => {
      this.runCheck().catch((err) => {
        console.error('[HAL:HealthMonitor] Periodic health check failed', err);
      });
    }, this.intervalMs);

    console.log(
      `[HAL:HealthMonitor] Started with ${this.intervalMs}ms interval`,
    );
  }

  /**
   * Stop periodic health checks.
   */
  stop(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
    this.running = false;
    this.registry = null;
    console.log('[HAL:HealthMonitor] Stopped');
  }

  /** Whether the monitor is actively running. */
  isActive(): boolean {
    return this.running;
  }

  // -----------------------------------------------------------------------
  // Introspection
  // -----------------------------------------------------------------------

  /**
   * Return the latest cached health status snapshot for every adapter.
   *
   * When the monitor is not active this returns an empty map.
   */
  getStatus(): Map<string, AdapterHealth> {
    return this.lastHealthSnapshot;
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private lastHealthSnapshot: Map<string, AdapterHealth> = new Map();

  private async runCheck(): Promise<void> {
    if (!this.registry) return;

    const healthMap = await this.registry.checkAllHealth();
    this.lastHealthSnapshot = healthMap;

    // Persist each adapter's health status to the DB.
    const persistOps = Array.from(healthMap.entries()).map(
      async ([key, health]) => {
        try {
          await db.hardwareAdapter.updateMany({
            where: {
              propertyId: health.propertyId,
              providerId: health.providerId,
            },
            data: {
              healthStatus: health.status as string,
              lastCheckedAt: new Date(),
              ...(health.status === AdapterHealthStatus.Healthy
                ? { lastHealthyAt: new Date() }
                : {}),
            },
          });

          // Log degraded / unhealthy states for visibility
          if (
            health.status === AdapterHealthStatus.Unhealthy ||
            health.status === AdapterHealthStatus.Degraded
          ) {
            console.warn(
              `[HAL:HealthMonitor] Adapter ${key} reported "${health.status}": ${health.message ?? 'no details'}`,
            );
          }
        } catch (err) {
          console.error(
            `[HAL:HealthMonitor] Failed to persist health for ${key}`,
            err,
          );
        }
      },
    );

    await Promise.allSettled(persistOps);
  }
}
