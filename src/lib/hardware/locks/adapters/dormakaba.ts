/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * Dormakaba SAFLOK stub adapter (structure only).
 *
 * Dormakaba SAFLOK uses SOAP-based on-premise middleware. This adapter
 * provides the full interface structure but returns NOT_SUPPORTED for all
 * operations. A production implementation requires on-premise middleware
 * installation and SOAP integration.
 */

import {
  AdapterConnectionState,
  AdapterHealthStatus,
  type AdapterHealth,
  type AdapterInfo,
  type HardwareResult,
  type HardwareAdapterConfig,
  type HardwareAdapterCredentials,
} from '../../types';
import { createHardwareError, HardwareErrorCode } from '../../errors';
import { BaseLockAdapter } from '../base-lock-adapter';
import {
  type LockId,
  type LockMetadata,
  type LockCredential,
  type AccessEvent,
  type LockDomainCommandRequest,
  type LockDomainCommandResponse,
  type LockDiscoveryResult,
  type LockSyncOptions,
} from '../types';

// ---------------------------------------------------------------------------
// Not-supported message
// ---------------------------------------------------------------------------

const DORMAKABA_NOT_SUPPORTED_MESSAGE =
  'Dormakaba SAFLOK SOAP integration requires on-premise middleware. Contact StaySuite support.';

function notSupportedResult<T>(method: string): HardwareResult<T> {
  return {
    success: false,
    error: `${method}: ${DORMAKABA_NOT_SUPPORTED_MESSAGE}`,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class DormakabaAdapter extends BaseLockAdapter {
  private serviceUrl = '';
  private hotelCode = '';

  // -----------------------------------------------------------------------
  // Metadata
  // -----------------------------------------------------------------------

  getInfo(): AdapterInfo {
    return {
      providerId: 'dormakaba-saflok',
      category: 'lock',
      displayName: 'Dormakaba SAFLOK',
      version: '1.0.0',
      hasSimulation: false,
      supportsWebhooks: false,
      supportsPolling: true,
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  override async initialize(
    config: HardwareAdapterConfig,
    credentials: HardwareAdapterCredentials,
  ): Promise<void> {
    await super.initialize(config, credentials);

    this.serviceUrl = String(config.serviceUrl ?? '');
    this.hotelCode = String(config.hotelCode ?? '');

    if (!this.serviceUrl) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CONFIG,
        'Dormakaba SAFLOK adapter requires "serviceUrl" in config.',
        'dormakaba-saflok',
      );
    }

    if (!this.hotelCode) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CONFIG,
        'Dormakaba SAFLOK adapter requires "hotelCode" in config.',
        'dormakaba-saflok',
      );
    }

    if (!credentials.username || !credentials.password) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CREDENTIALS,
        'Dormakaba SAFLOK adapter requires "username" and "password" credentials.',
        'dormakaba-saflok',
      );
    }
  }

  async connect(): Promise<void> {
    if (this.connectionState === AdapterConnectionState.Connected) return;
    this.connectionState = AdapterConnectionState.Connecting;

    // Stub: set to connected for registry compatibility
    this.connectionState = AdapterConnectionState.Connected;
  }

  async disconnect(): Promise<void> {
    this.connectionState = AdapterConnectionState.Disconnecting;
    this.connectionState = AdapterConnectionState.Disconnected;
  }

  async healthCheck(): Promise<AdapterHealth> {
    return {
      providerId: 'dormakaba-saflok',
      propertyId: this.propertyId,
      status: AdapterHealthStatus.Unknown,
      lastHealthyAt: null,
      lastCheckedAt: new Date().toISOString(),
      message: DORMAKABA_NOT_SUPPORTED_MESSAGE,
      consecutiveFailures: 0,
      latencyMs: null,
    };
  }

  // -----------------------------------------------------------------------
  // Webhooks — not supported
  // -----------------------------------------------------------------------

  override async verifyWebhookSignature(): Promise<boolean> {
    return false;
  }

  override async processWebhook(): Promise<HardwareResult<Record<string, unknown>[]>> {
    return notSupportedResult('processWebhook');
  }

  // -----------------------------------------------------------------------
  // ILockProvider — Commands — NOT_SUPPORTED
  // -----------------------------------------------------------------------

  override async executeCommand(): Promise<HardwareResult<never>> {
    return notSupportedResult('executeCommand');
  }

  // -----------------------------------------------------------------------
  // ILockProvider — Queries — NOT_SUPPORTED
  // -----------------------------------------------------------------------

  override async getLock(): Promise<HardwareResult<never>> {
    return notSupportedResult('getLock');
  }

  override async listLocks() {
    return { items: [], nextCursor: null, hasMore: false };
  }

  override async getAdapterHealth() {
    return {
      status: AdapterHealthStatus.Unknown,
      message: DORMAKABA_NOT_SUPPORTED_MESSAGE,
      locks: [],
    };
  }

  // -----------------------------------------------------------------------
  // Extended lock-domain methods — NOT_SUPPORTED
  // -----------------------------------------------------------------------

  override async getLockStatus(_lockId: LockId): Promise<HardwareResult<LockMetadata>> {
    return notSupportedResult('getLockStatus');
  }

  override async executeLockCommand(
    _request: LockDomainCommandRequest,
  ): Promise<HardwareResult<LockDomainCommandResponse>> {
    return notSupportedResult('executeLockCommand');
  }

  override async createCredential(
    _credential: Omit<LockCredential, 'id' | 'vendorCredentialId'>,
  ): Promise<HardwareResult<LockCredential>> {
    return notSupportedResult('createCredential');
  }

  override async deleteCredential(_credentialId: string): Promise<HardwareResult<void>> {
    return notSupportedResult('deleteCredential');
  }

  override async grantAccess(): Promise<HardwareResult<LockCredential>> {
    return notSupportedResult('grantAccess');
  }

  override async revokeAccess(): Promise<HardwareResult<void>> {
    return notSupportedResult('revokeAccess');
  }

  override async getAccessEvents(): Promise<HardwareResult<never>> {
    return notSupportedResult('getAccessEvents');
  }

  override async discoverLocks(
    _options?: LockSyncOptions,
  ): Promise<HardwareResult<LockDiscoveryResult>> {
    return notSupportedResult('discoverLocks');
  }
}
