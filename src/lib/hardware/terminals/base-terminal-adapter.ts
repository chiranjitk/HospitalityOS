/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * BaseTerminalAdapter — abstract base class implementing ITerminalProvider with
 * sensible defaults, auto-reconnect logic, and shared utilities.
 *
 * Every concrete terminal adapter should extend this class and override the
 * abstract methods plus any domain-specific methods it supports.
 */

import {
  AdapterHealthStatus,
  AdapterConnectionState,
} from '../types';
import type {
  IHardwareAdapter,
  HardwareAdapterConfig,
  HardwareAdapterCredentials,
  HardwareResult,
  AdapterHealth,
  WebhookPayload,
  PaginatedResult,
  CreateCheckoutRequest,
  CreateCheckoutResponse,
} from '../types';
const ConnectionState = AdapterConnectionState;

import type { ITerminalProvider, TerminalInfo, TransactionInfo } from './terminal-provider';
import { HardwareErrorCode, createHardwareError } from '../errors';
import {
  type TerminalId,
  type VendorTerminalId,
  type TerminalMetadata,
  type TerminalTransaction,
  type RefundRequest,
  type VoidRequest,
  type CaptureRequest,
  type DisplayMessageRequest,
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
// BaseTerminalAdapter
// ---------------------------------------------------------------------------

export abstract class BaseTerminalAdapter implements ITerminalProvider {
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
  // Lifecycle — ITerminalProvider
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
  // Operations — ITerminalProvider
  // -----------------------------------------------------------------------

  async createCheckout(
    _request: CreateCheckoutRequest,
  ): Promise<HardwareResult<CreateCheckoutResponse>> {
    return notSupported('createCheckout');
  }

  // -----------------------------------------------------------------------
  // Queries — ITerminalProvider
  // -----------------------------------------------------------------------

  async listTerminals(
    _cursor?: string,
    _limit?: number,
  ): Promise<PaginatedResult<TerminalInfo>> {
    return { items: [], nextCursor: null, hasMore: false };
  }

  async getTerminal(_terminalId: string): Promise<HardwareResult<TerminalInfo>> {
    return notSupported('getTerminal');
  }

  async listTransactions(
    _terminalId: string,
    _cursor?: string,
    _limit?: number,
  ): Promise<PaginatedResult<TransactionInfo>> {
    return { items: [], nextCursor: null, hasMore: false };
  }

  async getAdapterHealth(): Promise<{
    status: AdapterHealthStatus;
    message?: string;
    terminals: { terminalId: string; status: AdapterHealthStatus }[];
  }> {
    try {
      const health = await this.healthCheck();
      return {
        status: health.status,
        message: health.message ?? undefined,
        terminals: [],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        status: AdapterHealthStatus.Unhealthy,
        message: msg,
        terminals: [],
      };
    }
  }

  // -----------------------------------------------------------------------
  // Extended terminal-domain methods (default: NOT_SUPPORTED)
  // -----------------------------------------------------------------------

  async getTerminalStatus(_terminalId: TerminalId): Promise<HardwareResult<TerminalMetadata>> {
    return notSupported('getTerminalStatus');
  }

  async cancelCheckout(
    _transactionId: string,
    _vendorTransactionId: string,
  ): Promise<HardwareResult<TerminalTransaction>> {
    return notSupported('cancelCheckout');
  }

  async captureTransaction(
    _request: CaptureRequest,
  ): Promise<HardwareResult<TerminalTransaction>> {
    return notSupported('captureTransaction');
  }

  async refundTransaction(
    _request: RefundRequest,
  ): Promise<HardwareResult<TerminalTransaction>> {
    return notSupported('refundTransaction');
  }

  async voidTransaction(
    _request: VoidRequest,
  ): Promise<HardwareResult<TerminalTransaction>> {
    return notSupported('voidTransaction');
  }

  async getTransaction(
    _transactionId: string,
    _vendorTransactionId: string,
  ): Promise<HardwareResult<TerminalTransaction>> {
    return notSupported('getTransaction');
  }

  async listTerminalTransactions(
    _terminalId: TerminalId,
    _cursor?: string,
    _limit?: number,
  ): Promise<HardwareResult<PaginatedResult<TerminalTransaction>>> {
    return notSupported('listTerminalTransactions');
  }

  async displayMessage(
    _request: DisplayMessageRequest,
  ): Promise<HardwareResult<void>> {
    return notSupported('displayMessage');
  }

  async storePaymentMethod(
    _terminalId: TerminalId,
    _vendorTerminalId: VendorTerminalId,
  ): Promise<HardwareResult<{ paymentToken: string }>> {
    return notSupported('storePaymentMethod');
  }

  async discoverTerminals(): Promise<HardwareResult<TerminalMetadata[]>> {
    return notSupported('discoverTerminals');
  }

  async registerTerminal(
    _registrationCode: string,
  ): Promise<HardwareResult<TerminalMetadata>> {
    return notSupported('registerTerminal');
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
