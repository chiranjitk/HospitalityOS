/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * Shared types used across the entire HAL system.
 */

// ---------------------------------------------------------------------------
// Provider IDs
// ---------------------------------------------------------------------------

export type HardwareProviderId =
  | 'simulator'
  | 'assa-abloy-visionline'
  | 'salto-ks'
  | 'dormakaba-saflok'
  | 'nuki'
  | 'seam'
  | 'stripe-terminal'
  | 'square-terminal'
  | 'adyen-terminal'
  | 'verifone-engage'
  | 'ingenico';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type HardwareCategory = 'lock' | 'terminal';

// ---------------------------------------------------------------------------
// Adapter Health
// ---------------------------------------------------------------------------

export enum AdapterHealthStatus {
  Unknown = 'unknown',
  Healthy = 'healthy',
  Degraded = 'degraded',
  Unhealthy = 'unhealthy',
  Disconnected = 'disconnected',
}

export interface AdapterHealth {
  providerId: string;
  propertyId: string;
  status: AdapterHealthStatus;
  lastHealthyAt: string | null; // ISO-8601
  lastCheckedAt: string | null; // ISO-8601
  message: string | null;
  consecutiveFailures: number;
  latencyMs: number | null;
}

// ---------------------------------------------------------------------------
// Adapter Configuration
// ---------------------------------------------------------------------------

export type HardwareAdapterConfig = Record<string, unknown>;

export type HardwareAdapterCredentials = Record<string, string | number>;

// ---------------------------------------------------------------------------
// Adapter Connection State
// ---------------------------------------------------------------------------

export enum AdapterConnectionState {
  Uninitialized = 'uninitialized',
  Ready = 'ready',
  Connecting = 'connecting',
  Connected = 'connected',
  Disconnecting = 'disconnecting',
  Disconnected = 'disconnected',
  Error = 'error',
}

// ---------------------------------------------------------------------------
// Adapter Metadata
// ---------------------------------------------------------------------------

export interface AdapterInfo {
  providerId: HardwareProviderId;
  category: HardwareCategory;
  displayName: string;
  version: string;
  hasSimulation: boolean;
  supportsWebhooks: boolean;
  supportsPolling: boolean;
}

// ---------------------------------------------------------------------------
// Result Wrappers
// ---------------------------------------------------------------------------

export interface HardwareResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string; // ISO-8601
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

// ---------------------------------------------------------------------------
// Webhook Payload
// ---------------------------------------------------------------------------

export interface WebhookPayload {
  providerId: string;
  vendorEventId: string;
  eventType: string;
  receivedAt: string; // ISO-8601
  rawBody: string;
  signature?: string;
}

// ---------------------------------------------------------------------------
// Lock-specific types (shared across lock adapters)
// ---------------------------------------------------------------------------

export type LockCommandType =
  | 'unlock'
  | 'lock'
  | 'issue_key'
  | 'revoke_key'
  | 'update_key'
  | 'get_status'
  | 'get_battery'
  | 'remote_lockout'
  | 'remote_unlock';

export interface LockCommandRequest {
  commandType: LockCommandType;
  lockId: string;
  vendorLockId?: string;
  payload?: Record<string, unknown>;
  correlationId?: string;
}

export interface LockCommandResponse {
  commandId: string;
  lockId: string;
  vendorLockId?: string;
  success: boolean;
  statusCode?: string;
  message?: string;
  vendorResponse?: Record<string, unknown>;
  timestamp: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// Terminal-specific types (shared across terminal adapters)
// ---------------------------------------------------------------------------

export type TerminalOperationType =
  | 'create_checkout'
  | 'cancel_checkout'
  | 'get_checkout_status'
  | 'create_payment'
  | 'create_refund'
  | 'get_terminal_status'
  | 'get_transaction';

export interface CreateCheckoutRequest {
  terminalId: string;
  amount: number;
  currency: string;
  bookingId?: string;
  folioId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

export interface CreateCheckoutResponse {
  checkoutId: string;
  terminalId: string;
  amount: number;
  currency: string;
  status: string;
  vendorCheckoutId?: string;
  redirectUrl?: string;
  expiresAt?: string; // ISO-8601
  vendorResponse?: Record<string, unknown>;
  timestamp: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// Adapter Factory type
// ---------------------------------------------------------------------------

/**
 * A factory function that creates an adapter instance given its config and
 * credentials. Every registered provider must supply a factory with this
 * signature.
 */
export type HardwareAdapterFactory<T> = (
  config: HardwareAdapterConfig,
  credentials: HardwareAdapterCredentials,
) => T;

// ---------------------------------------------------------------------------
// Base adapter interface (common to both lock and terminal adapters)
// ---------------------------------------------------------------------------

export interface IHardwareAdapter {
  /** Connect / authenticate with the vendor API. */
  connect(): Promise<void>;

  /** Gracefully disconnect from the vendor API. */
  disconnect(): Promise<void>;

  /** Check whether the adapter is currently connected. */
  isConnected(): boolean;

  /** Current connection state. */
  getConnectionState(): AdapterConnectionState;

  /** Static metadata about this adapter. */
  getInfo(): AdapterInfo;

  /** Perform a vendor health-check and return latency in ms. */
  checkHealth(): Promise<{ healthy: boolean; latencyMs: number; message?: string }>;

  /**
   * Verify that an incoming webhook signature is authentic.
   * Returns `true` when valid.
   */
  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): Promise<boolean>;

  /**
   * Process an inbound webhook payload and return structured events.
   * Implementations must not throw — return `{ success: false, error }` instead.
   */
  processWebhook(payload: WebhookPayload): Promise<HardwareResult<Record<string, unknown>[]>>;
}
