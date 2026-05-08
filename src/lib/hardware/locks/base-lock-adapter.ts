/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * BaseLockAdapter — abstract base class implementing ILockProvider with
 * sensible defaults, auto-reconnect logic, and shared utilities.
 *
 * Every concrete lock adapter should extend this class and override the
 * abstract methods plus any domain-specific methods it supports.
 */

import type {
  IHardwareAdapter,
  HardwareAdapterConfig,
  HardwareAdapterCredentials,
  HardwareResult,
  AdapterHealthStatus,
  AdapterHealth,
  AdapterConnectionState,
  WebhookPayload,
  LockCommandRequest,
  LockCommandResponse,
  PaginatedResult,
} from '../types';
import { AdapterConnectionState as ConnectionState } from '../types';
import type { ILockProvider, LockInfo } from './lock-provider';
import { HardwareErrorCode, createHardwareError } from '../errors';
import type {
  LockId,
  LockMetadata,
  LockCredential,
  AccessEvent,
  LockDomainCommandRequest,
  LockDomainCommandResponse,
  LockDiscoveryResult,
  LockSyncOptions,
  LockStatus,
} from './types';

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

function notSupported<T>(method: string): HardwareResult<T> {
  return {
    success: false,
    error: `Method "${method}" is not supported by this adapter.`,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// BaseLockAdapter
// ---------------------------------------------------------------------------

export abstract class BaseLockAdapter implements ILockProvider {
  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  protected connectionState: AdapterConnectionState =
    ConnectionState.Uninitialized;
  protected config: HardwareAdapterConfig = {};
  protected credentials: HardwareAdapterCredentials = {};
  protected propertyId = '';
  protected initialized = false;

  // -----------------------------------------------------------------------
  // Abstract methods — every adapter MUST implement these
  // -----------------------------------------------------------------------

  /** Return static metadata about this adapter. */
  abstract getInfo(): ReturnType<IHardwareAdapter['getInfo']>;

  /** Connect / authenticate with the vendor API. */
  abstract connect(): Promise<void>;

  /** Gracefully disconnect from the vendor API. */
  abstract disconnect(): Promise<void>;

  /** Perform a vendor health-check. */
  abstract healthCheck(): Promise<AdapterHealth>;

  // -----------------------------------------------------------------------
  // Lifecycle — ILockProvider
  // -----------------------------------------------------------------------

  async initialize(
    config: HardwareAdapterConfig,
    credentials: HardwareAdapterCredentials,
  ): Promise<void> {
    this.config = config ?? {};
    this.credentials = credentials ?? {};
    this.propertyId = String(this.config.propertyId ?? '');
    this.initialized = true;
    this.connectionState = ConnectionState.Ready;
  }

  async destroy(): Promise<void> {
    await this.disconnect();
    this.config = {};
    this.credentials = {};
    this.initialized = false;
    this.connectionState = ConnectionState.Uninitialized;
  }

  // -----------------------------------------------------------------------
  // Connection state — IHardwareAdapter
  // -----------------------------------------------------------------------

  isConnected(): boolean {
    return this.connectionState === ConnectionState.Connected;
  }

  getConnectionState(): AdapterConnectionState {
    return this.connectionState;
  }

  // -----------------------------------------------------------------------
  // Health — IHardwareAdapter
  // -----------------------------------------------------------------------

  async checkHealth(): Promise<{ healthy: boolean; latencyMs: number; message?: string }> {
    try {
      const health = await this.healthCheck();
      const healthy = health.status !== AdapterHealthStatus.Unhealthy
        && health.status !== AdapterHealthStatus.Disconnected
        && health.status !== AdapterHealthStatus.Unknown;
      return {
        healthy,
        latencyMs: health.latencyMs ?? 0,
        message: health.message ?? undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { healthy: false, latencyMs: 0, message: msg };
    }
  }

  // -----------------------------------------------------------------------
  // Webhook — IHardwareAdapter (default: not supported)
  // -----------------------------------------------------------------------

  async verifyWebhookSignature(
    _rawBody: string,
    _headers: Record<string, string>,
  ): Promise<boolean> {
    return false;
  }

  async processWebhook(
    _payload: WebhookPayload,
  ): Promise<HardwareResult<Record<string, unknown>[]>> {
    return notSupported('processWebhook');
  }

  // -----------------------------------------------------------------------
  // Commands — ILockProvider
  // -----------------------------------------------------------------------

  async executeCommand(
    request: LockCommandRequest,
  ): Promise<HardwareResult<LockCommandResponse>> {
    return notSupported('executeCommand');
  }

  // -----------------------------------------------------------------------
  // Queries — ILockProvider
  // -----------------------------------------------------------------------

  async listLocks(
    _cursor?: string,
    _limit?: number,
  ): Promise<PaginatedResult<LockInfo>> {
    return { items: [], nextCursor: null, hasMore: false };
  }

  async getLock(_lockId: string): Promise<HardwareResult<LockInfo>> {
    return notSupported('getLock');
  }

  async getAdapterHealth(): Promise<{
    status: AdapterHealthStatus;
    message?: string;
    locks: { lockId: string; status: AdapterHealthStatus }[];
  }> {
    try {
      const health = await this.healthCheck();
      return {
        status: health.status,
        message: health.message ?? undefined,
        locks: [],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        status: AdapterHealthStatus.Unhealthy,
        message: msg,
        locks: [],
      };
    }
  }

  // -----------------------------------------------------------------------
  // Extended lock-domain methods (default: NOT_SUPPORTED)
  // -----------------------------------------------------------------------

  async getLockStatus(_lockId: LockId): Promise<HardwareResult<LockMetadata>> {
    return notSupported('getLockStatus');
  }

  async executeLockCommand(
    _request: LockDomainCommandRequest,
  ): Promise<HardwareResult<LockDomainCommandResponse>> {
    return notSupported('executeLockCommand');
  }

  async createCredential(
    _credential: Omit<LockCredential, 'id' | 'vendorCredentialId'>,
  ): Promise<HardwareResult<LockCredential>> {
    return notSupported('createCredential');
  }

  async deleteCredential(_credentialId: string): Promise<HardwareResult<void>> {
    return notSupported('deleteCredential');
  }

  async grantAccess(_params: {
    lockIds: LockId[];
    guestId: string;
    bookingId?: string;
    validFrom?: string;
    validUntil?: string;
    credentialType?: string;
  }): Promise<HardwareResult<LockCredential>> {
    return notSupported('grantAccess');
  }

  async revokeAccess(_params: {
    guestId: string;
    lockIds?: LockId[];
    bookingId?: string;
  }): Promise<HardwareResult<void>> {
    return notSupported('revokeAccess');
  }

  async getAccessEvents(_params?: {
    lockId?: LockId;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  }): Promise<HardwareResult<PaginatedResult<AccessEvent>>> {
    return notSupported('getAccessEvents');
  }

  async discoverLocks(
    _options?: LockSyncOptions,
  ): Promise<HardwareResult<LockDiscoveryResult>> {
    return notSupported('discoverLocks');
  }

  // -----------------------------------------------------------------------
  // Auto-reconnect wrapper
  // -----------------------------------------------------------------------

  /**
   * Execute an async operation with automatic reconnect on first failure.
   * If the adapter is currently disconnected, it will attempt `connect()`
   * before retrying the operation.
   */
  protected async executeWithReconnect<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!this.isConnected()) {
      try {
        await this.connect();
      } catch {
        // Connection attempt failed — try the operation anyway in case
        // the adapter has a session-level reconnection mechanism.
      }
    }
    return operation();
  }

  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------

  /**
   * Simulate network latency by waiting a random duration between
   * `minMs` and `maxMs` (defaults to 100–300 ms).
   */
  protected simulateDelay(minMs = 100, maxMs = 300): Promise<void> {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Create a standard HardwareResult wrapping an unexpected error. */
  protected wrapError<T>(err: unknown, context?: string): HardwareResult<T> {
    const message =
      err instanceof Error
        ? err.message
        : `Unexpected error${context ? ` in ${context}` : ''}`;
    return {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    };
  }

  /** Short-hand for creating a NOT_SUPPORTED error detail. */
  protected static notSupportedError(method: string, providerId?: string) {
    return createHardwareError(HardwareErrorCode.NOT_SUPPORTED, method, providerId);
  }
}
