/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * HardwareRegistry — THE central entry point for all hardware adapter
 * management.  It handles registration, lifecycle, caching, health
 * monitoring and webhook dispatch.
 */

import { db } from '@/lib/db';
import type {
  AdapterHealth,
  AdapterHealthStatus,
  IHardwareAdapter,
  HardwareAdapterConfig,
  HardwareAdapterCredentials,
  HardwareResult,
  LockCommandRequest,
  LockCommandResponse,
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  HardwareAdapterFactory,
} from './types';
import { AdapterConnectionState } from './types';
import { HealthMonitor } from './health-monitor';
import { processWebhook } from './webhook-router';
import { logHardwareOperation } from './audit-logger';
import type { ILockProvider, LockAdapterFactory } from './locks/lock-provider';
import type { ITerminalProvider, TerminalAdapterFactory } from './terminals/terminal-provider';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface CachedAdapter<T extends IHardwareAdapter> {
  instance: T;
  propertyId: string;
  providerId: string;
  adapterDbId: string;
  tenantId: string;
  config: HardwareAdapterConfig;
}

type AdapterCacheKey = `${string}:${string}`; // `${propertyId}:${providerId}`

// ---------------------------------------------------------------------------
// HardwareRegistry
// ---------------------------------------------------------------------------

export class HardwareRegistry {
  // -----------------------------------------------------------------------
  // Adapter caches
  // -----------------------------------------------------------------------

  private lockAdapters: Map<AdapterCacheKey, CachedAdapter<ILockProvider>> = new Map();
  private terminalAdapters: Map<AdapterCacheKey, CachedAdapter<ITerminalProvider>> = new Map();

  // -----------------------------------------------------------------------
  // Factories
  // -----------------------------------------------------------------------

  private lockFactories: Map<string, LockAdapterFactory> = new Map();
  private terminalFactories: Map<string, TerminalAdapterFactory> = new Map();

  // -----------------------------------------------------------------------
  // Health
  // -----------------------------------------------------------------------

  private healthMonitor = new HealthMonitor();

  // =========================================================================

  // -----------------------------------------------------------------------
  // Factory registration
  // -----------------------------------------------------------------------

  /**
   * Register a factory that can create lock adapter instances for the given
   * `providerId`.
   */
  registerLockAdapter(providerId: string, factory: LockAdapterFactory): void {
    this.lockFactories.set(providerId, factory);
    console.log(`[HAL:Registry] Registered lock factory for "${providerId}"`);
  }

  /**
   * Register a factory that can create terminal adapter instances for the
   * given `providerId`.
   */
  registerTerminalAdapter(providerId: string, factory: TerminalAdapterFactory): void {
    this.terminalFactories.set(providerId, factory);
    console.log(`[HAL:Registry] Registered terminal factory for "${providerId}"`);
  }

  // -----------------------------------------------------------------------
  // Adapter access
  // -----------------------------------------------------------------------

  /**
   * Get (or create) a lock adapter for the given property + provider.
   * The adapter is cached for the lifetime of the process.
   */
  async getLockAdapter(
    propertyId: string,
    providerId: string,
  ): Promise<ILockProvider> {
    const key = `${propertyId}:${providerId}` as AdapterCacheKey;

    // Return cached if available and connected
    const cached = this.lockAdapters.get(key);
    if (cached) return cached.instance;

    return this.createLockAdapter(propertyId, providerId);
  }

  /**
   * Get (or create) a terminal adapter for the given property + provider.
   */
  async getTerminalAdapter(
    propertyId: string,
    providerId: string,
  ): Promise<ITerminalProvider> {
    const key = `${propertyId}:${providerId}` as AdapterCacheKey;

    const cached = this.terminalAdapters.get(key);
    if (cached) return cached.instance;

    return this.createTerminalAdapter(propertyId, providerId);
  }

  /**
   * Synchronous accessor for adapters that are already cached.
   * Used by the webhook router when it needs an adapter without async setup.
   * Returns `undefined` when the adapter is not yet instantiated.
   */
  getAdapterSync(
    propertyId: string,
    providerId: string,
  ): IHardwareAdapter | undefined {
    const key = `${propertyId}:${providerId}` as AdapterCacheKey;
    return (
      this.lockAdapters.get(key)?.instance ??
      this.terminalAdapters.get(key)?.instance
    );
  }

  // -----------------------------------------------------------------------
  // Adapter removal
  // -----------------------------------------------------------------------

  /**
   * Disconnect and destroy a lock adapter, removing it from the cache.
   */
  async removeLockAdapter(
    propertyId: string,
    providerId: string,
  ): Promise<void> {
    const key = `${propertyId}:${providerId}` as AdapterCacheKey;
    const cached = this.lockAdapters.get(key);

    if (cached) {
      try {
        await cached.instance.disconnect();
        await cached.instance.destroy();
      } catch (err) {
        console.warn(
          `[HAL:Registry] Error during lock adapter teardown for ${key}`,
          err,
        );
      }
      this.lockAdapters.delete(key);
    }
  }

  /**
   * Disconnect and destroy a terminal adapter, removing it from the cache.
   */
  async removeTerminalAdapter(
    propertyId: string,
    providerId: string,
  ): Promise<void> {
    const key = `${propertyId}:${providerId}` as AdapterCacheKey;
    const cached = this.terminalAdapters.get(key);

    if (cached) {
      try {
        await cached.instance.disconnect();
        await cached.instance.destroy();
      } catch (err) {
        console.warn(
          `[HAL:Registry] Error during terminal adapter teardown for ${key}`,
          err,
        );
      }
      this.terminalAdapters.delete(key);
    }
  }

  // -----------------------------------------------------------------------
  // Adapter reload
  // -----------------------------------------------------------------------

  /**
   * Tear down and re-create a lock adapter (e.g. after config change).
   */
  async reloadLockAdapter(
    propertyId: string,
    providerId: string,
  ): Promise<ILockProvider> {
    await this.removeLockAdapter(propertyId, providerId);
    return this.createLockAdapter(propertyId, providerId);
  }

  // -----------------------------------------------------------------------
  // Convenience methods (high-level operations)
  // -----------------------------------------------------------------------

  /**
   * Execute a lock command — resolves the adapter and delegates.
   */
  async executeLockCommand(
    propertyId: string,
    request: LockCommandRequest,
  ): Promise<HardwareResult<LockCommandResponse>> {
    const adapter = await this.getLockAdapter(propertyId, request.payload?.providerId as string);
    const startMs = Date.now();

    try {
      const result = await adapter.executeCommand(request);
      await logHardwareOperation({
        propertyId,
        tenantId: '', // filled by callers that know tenant context
        providerId: request.payload?.providerId as string,
        category: 'lock',
        operation: request.commandType,
        targetId: request.lockId,
        vendorTargetId: request.vendorLockId,
        success: result.success,
        errorCode: result.error,
        durationMs: Date.now() - startMs,
        correlationId: request.correlationId,
        responseJson: result.data ? JSON.stringify(result.data) : undefined,
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await logHardwareOperation({
        propertyId,
        tenantId: '',
        providerId: request.payload?.providerId as string,
        category: 'lock',
        operation: request.commandType,
        targetId: request.lockId,
        vendorTargetId: request.vendorLockId,
        success: false,
        errorMessage: msg,
        durationMs: Date.now() - startMs,
        correlationId: request.correlationId,
      });
      return { success: false, error: msg, timestamp: new Date().toISOString() };
    }
  }

  /**
   * Create a terminal checkout — resolves the adapter and delegates.
   */
  async createTerminalCheckout(
    propertyId: string,
    request: CreateCheckoutRequest,
  ): Promise<HardwareResult<CreateCheckoutResponse>> {
    // Look up the provider from the terminal's adapter config
    const adapterConfig = await db.hardwareAdapter.findFirst({
      where: { propertyId, category: 'terminal', enabled: true },
    });

    if (!adapterConfig) {
      return {
        success: false,
        error: 'No active terminal adapter configured for this property.',
        timestamp: new Date().toISOString(),
      };
    }

    const adapter = await this.getTerminalAdapter(propertyId, adapterConfig.providerId);
    const startMs = Date.now();

    try {
      const result = await adapter.createCheckout(request);
      await logHardwareOperation({
        propertyId,
        tenantId: adapterConfig.tenantId,
        adapterId: adapterConfig.id,
        providerId: adapterConfig.providerId,
        category: 'terminal',
        operation: 'create_checkout',
        targetId: request.terminalId,
        success: result.success,
        errorCode: result.error,
        durationMs: Date.now() - startMs,
        correlationId: request.correlationId,
        responseJson: result.data ? JSON.stringify(result.data) : undefined,
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await logHardwareOperation({
        propertyId,
        tenantId: adapterConfig.tenantId,
        adapterId: adapterConfig.id,
        providerId: adapterConfig.providerId,
        category: 'terminal',
        operation: 'create_checkout',
        targetId: request.terminalId,
        success: false,
        errorMessage: msg,
        durationMs: Date.now() - startMs,
        correlationId: request.correlationId,
      });
      return { success: false, error: msg, timestamp: new Date().toISOString() };
    }
  }

  // -----------------------------------------------------------------------
  // Health
  // -----------------------------------------------------------------------

  /**
   * Check the health of every cached adapter and return a map keyed by
   * `${propertyId}:${providerId}`.
   */
  async checkAllHealth(): Promise<Map<string, AdapterHealth>> {
    const result = new Map<string, AdapterHealth>();

    const checkAdapter = async (
      key: AdapterCacheKey,
      adapter: IHardwareAdapter,
      propertyId: string,
      providerId: string,
    ) => {
      try {
        const { healthy, latencyMs, message } = await adapter.checkHealth();

        const status: AdapterHealthStatus = healthy
          ? AdapterHealthStatus.Healthy
          : AdapterHealthStatus.Unhealthy;

        result.set(key, {
          providerId,
          propertyId,
          status,
          lastHealthyAt: healthy ? new Date().toISOString() : null,
          lastCheckedAt: new Date().toISOString(),
          message: message ?? null,
          consecutiveFailures: healthy ? 0 : 1,
          latencyMs,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.set(key, {
          providerId,
          propertyId,
          status: AdapterHealthStatus.Unhealthy,
          lastHealthyAt: null,
          lastCheckedAt: new Date().toISOString(),
          message: msg,
          consecutiveFailures: 1,
          latencyMs: null,
        });
      }
    };

    const checks: Promise<void>[] = [];

    for (const [key, cached] of this.lockAdapters) {
      checks.push(
        checkAdapter(key, cached.instance, cached.propertyId, cached.providerId),
      );
    }

    for (const [key, cached] of this.terminalAdapters) {
      checks.push(
        checkAdapter(key, cached.instance, cached.propertyId, cached.providerId),
      );
    }

    await Promise.all(checks);
    return result;
  }

  // -----------------------------------------------------------------------
  // Health monitoring lifecycle
  // -----------------------------------------------------------------------

  startHealthMonitoring(intervalMs?: number): void {
    this.healthMonitor.start(this, intervalMs);
  }

  stopHealthMonitoring(): void {
    this.healthMonitor.stop();
  }

  // -----------------------------------------------------------------------
  // Webhook dispatch
  // -----------------------------------------------------------------------

  async dispatchWebhook(
    providerId: string,
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<{ acknowledged: boolean; processedEvents: number; error?: string }> {
    return processWebhook(providerId, rawBody, headers);
  }

  // -----------------------------------------------------------------------
  // Initialise from DB config
  // -----------------------------------------------------------------------

  /**
   * Load all active `HardwareAdapter` rows from the database and pre-warm
   * the adapter caches.  Call this once at application startup.
   */
  async initializeFromConfig(): Promise<void> {
    const adapters = await db.hardwareAdapter.findMany({
      where: { enabled: true },
    });

    console.log(
      `[HAL:Registry] Initializing from DB — ${adapters.length} active adapter(s) found`,
    );

    const initOps = adapters.map(async (adapterRow) => {
      try {
        const config: HardwareAdapterConfig = JSON.parse(adapterRow.config || '{}');
        const credentials: HardwareAdapterCredentials = JSON.parse(
          adapterRow.credentials || '{}',
        );

        if (adapterRow.category === 'lock') {
          await this.createLockAdapterFromRow(
            adapterRow.id,
            adapterRow.propertyId,
            adapterRow.tenantId,
            adapterRow.providerId,
            config,
            credentials,
          );
        } else if (adapterRow.category === 'terminal') {
          await this.createTerminalAdapterFromRow(
            adapterRow.id,
            adapterRow.propertyId,
            adapterRow.tenantId,
            adapterRow.providerId,
            config,
            credentials,
          );
        }
      } catch (err) {
        console.error(
          `[HAL:Registry] Failed to initialise adapter ${adapterRow.id} (${adapterRow.providerId})`,
          err,
        );
      }
    });

    await Promise.allSettled(initOps);
  }

  // -----------------------------------------------------------------------
  // Shutdown
  // -----------------------------------------------------------------------

  /**
   * Disconnect all adapters and stop health monitoring.
   * Call this on graceful shutdown.
   */
  async shutdown(): Promise<void> {
    console.log('[HAL:Registry] Shutting down…');

    this.stopHealthMonitoring();

    const disconnectOps: Promise<void>[] = [];

    for (const [, cached] of this.lockAdapters) {
      disconnectOps.push(
        cached.instance.disconnect().catch(() => {}),
      );
    }

    for (const [, cached] of this.terminalAdapters) {
      disconnectOps.push(
        cached.instance.disconnect().catch(() => {}),
      );
    }

    await Promise.allSettled(disconnectOps);

    this.lockAdapters.clear();
    this.terminalAdapters.clear();

    console.log('[HAL:Registry] Shutdown complete');
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private async createLockAdapter(
    propertyId: string,
    providerId: string,
  ): Promise<ILockProvider> {
    const adapterRow = await db.hardwareAdapter.findUnique({
      where: { propertyId_providerId: { propertyId, providerId } },
    });

    if (!adapterRow) {
      throw new Error(
        `No HardwareAdapter found for property=${propertyId}, provider=${providerId}`,
      );
    }

    const config: HardwareAdapterConfig = JSON.parse(adapterRow.config || '{}');
    const credentials: HardwareAdapterCredentials = JSON.parse(
      adapterRow.credentials || '{}',
    );

    return this.createLockAdapterFromRow(
      adapterRow.id,
      adapterRow.propertyId,
      adapterRow.tenantId,
      adapterRow.providerId,
      config,
      credentials,
    );
  }

  private async createLockAdapterFromRow(
    adapterDbId: string,
    propertyId: string,
    tenantId: string,
    providerId: string,
    config: HardwareAdapterConfig,
    credentials: HardwareAdapterCredentials,
  ): Promise<ILockProvider> {
    const factory = this.lockFactories.get(providerId);
    if (!factory) {
      throw new Error(
        `No lock factory registered for provider "${providerId}". ` +
          `Did you call registerLockAdapter("${providerId}", factory)?`,
      );
    }

    const instance = factory(config, credentials);
    await instance.initialize(config, credentials);

    const key = `${propertyId}:${providerId}` as AdapterCacheKey;
    this.lockAdapters.set(key, {
      instance,
      propertyId,
      providerId,
      adapterDbId,
      tenantId,
      config,
    });

    return instance;
  }

  private async createTerminalAdapter(
    propertyId: string,
    providerId: string,
  ): Promise<ITerminalProvider> {
    const adapterRow = await db.hardwareAdapter.findUnique({
      where: { propertyId_providerId: { propertyId, providerId } },
    });

    if (!adapterRow) {
      throw new Error(
        `No HardwareAdapter found for property=${propertyId}, provider=${providerId}`,
      );
    }

    const config: HardwareAdapterConfig = JSON.parse(adapterRow.config || '{}');
    const credentials: HardwareAdapterCredentials = JSON.parse(
      adapterRow.credentials || '{}',
    );

    return this.createTerminalAdapterFromRow(
      adapterRow.id,
      adapterRow.propertyId,
      adapterRow.tenantId,
      adapterRow.providerId,
      config,
      credentials,
    );
  }

  private async createTerminalAdapterFromRow(
    adapterDbId: string,
    propertyId: string,
    tenantId: string,
    providerId: string,
    config: HardwareAdapterConfig,
    credentials: HardwareAdapterCredentials,
  ): Promise<ITerminalProvider> {
    const factory = this.terminalFactories.get(providerId);
    if (!factory) {
      throw new Error(
        `No terminal factory registered for provider "${providerId}". ` +
          `Did you call registerTerminalAdapter("${providerId}", factory)?`,
      );
    }

    const instance = factory(config, credentials);
    await instance.initialize(config, credentials);

    const key = `${propertyId}:${providerId}` as AdapterCacheKey;
    this.terminalAdapters.set(key, {
      instance,
      propertyId,
      providerId,
      adapterDbId,
      tenantId,
      config,
    });

    return instance;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const hardwareRegistry = new HardwareRegistry();
