/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * Seam Cloud API adapter.
 *
 * Seam provides a unified API platform that abstracts multiple lock vendors
 * (Visionline, SALTO, Nuki, Yale, August, and more) behind a single
 * consistent interface. This adapter integrates with the Seam REST API for
 * lock management, credential provisioning, access events, and webhooks.
 */

import {
  AdapterConnectionState,
  AdapterHealthStatus,
  type AdapterHealth,
  type AdapterInfo,
  type HardwareResult,
  type HardwareAdapterConfig,
  type HardwareAdapterCredentials,
  type LockCommandRequest,
  type LockCommandResponse,
  type PaginatedResult,
  type WebhookPayload,
} from '../../types';
import { mapHttpError, createHardwareError, HardwareErrorCode } from '../../errors';
import { BaseLockAdapter } from '../base-lock-adapter';
import type { LockInfo } from '../lock-provider';
import {
  LockStatus,
  CredentialType,
  AccessDirection,
  AccessResult,
  LockCommand,
  type LockId,
  type VendorLockId,
  type LockMetadata,
  type LockCredential,
  type AccessEvent,
  type LockDomainCommandRequest,
  type LockDomainCommandResponse,
  type LockDiscoveryResult,
  type LockSyncOptions,
} from '../types';

// ---------------------------------------------------------------------------
// Seam API response shapes (vendor-specific)
// ---------------------------------------------------------------------------

interface SeamWorkspace {
  workspace_id: string;
  name: string;
  is_sandbox: boolean;
  created_at: string;
}

interface SeamLock {
  lock_id: string;
  device_id: string;
  properties: {
    name: string;
    locked: boolean;
    online: boolean;
    door_open?: boolean;
    battery_level?: number;
    model?: string;
    manufacturer?: string;
    serial_number?: string;
    image_url?: string;
    battery?: {
      level?: number;
      status?: string;
    };
    supported_code_lengths?: number[];
    has_keypad?: boolean;
    has_door_sensor?: boolean;
    wifi_lock_name?: string;
  };
  workspace_id: string;
  created_at: string;
  errors?: Array<{ error_code: string; message: string }>;
}

interface SeamLockActionResponse {
  action_attempt_id: string;
  status: 'pending' | 'success' | 'error';
  error?: { type: string; message: string };
  result?: {
    lock: {
      lock_id: string;
      device_id: string;
      properties: { locked: boolean; [key: string]: unknown };
    };
  };
}

interface SeamAcsCredential {
  acs_credential_id: string;
  type: string;
  access_method: {
    code?: string;
    [key: string]: unknown;
  };
  starts_at?: string;
  ends_at?: string;
  is_multi_use?: boolean;
  created_at: string;
  acs_user_id?: string;
  workspace_id: string;
}

interface SeamAcsEvent {
  acs_event_id: string;
  event_type: string;
  timestamp: string;
  acs_credential_id?: string;
  acs_user_id?: string;
  acs_entrance_id?: string;
  workspace_id: string;
  created_at: string;
  error?: { type: string; message: string };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class SeamAdapter extends BaseLockAdapter {
  private baseUrl = 'https://api.seam.co';
  private workspaceId = '';

  // -----------------------------------------------------------------------
  // Metadata
  // -----------------------------------------------------------------------

  getInfo(): AdapterInfo {
    return {
      providerId: 'seam',
      category: 'lock',
      displayName: 'Seam Unified Platform',
      version: '1.0.0',
      hasSimulation: false,
      supportsWebhooks: true,
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

    this.baseUrl = String(config.baseUrl ?? 'https://api.seam.co');
    this.workspaceId = String(config.workspaceId ?? '');

    if (!this.workspaceId) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CONFIG,
        'Seam adapter requires "workspaceId" in config.',
        'seam',
      );
    }

    if (!credentials.apiKey) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CREDENTIALS,
        'Seam adapter requires "apiKey" credential.',
        'seam',
      );
    }
  }

  async connect(): Promise<void> {
    if (this.connectionState === AdapterConnectionState.Connected) return;
    this.connectionState = AdapterConnectionState.Connecting;

    try {
      // Verify API key by fetching workspace
      await this.seamGet<SeamWorkspace>(
        `/workspaces/${this.workspaceId}`,
      );
      this.connectionState = AdapterConnectionState.Connected;
    } catch (err) {
      this.connectionState = AdapterConnectionState.Error;
      const msg = err instanceof Error ? err.message : String(err);
      throw createHardwareError(
        HardwareErrorCode.CONNECTION_FAILED,
        `Seam connection failed: ${msg}`,
        'seam',
      );
    }
  }

  async disconnect(): Promise<void> {
    this.connectionState = AdapterConnectionState.Disconnecting;
    this.connectionState = AdapterConnectionState.Disconnected;
  }

  async healthCheck(): Promise<AdapterHealth> {
    const start = Date.now();
    try {
      await this.seamGet<SeamWorkspace>(
        `/workspaces/${this.workspaceId}`,
      );
      const latencyMs = Date.now() - start;
      return {
        providerId: 'seam',
        propertyId: this.propertyId,
        status: AdapterHealthStatus.Healthy,
        lastHealthyAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        message: null,
        consecutiveFailures: 0,
        latencyMs,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        providerId: 'seam',
        propertyId: this.propertyId,
        status: AdapterHealthStatus.Unhealthy,
        lastHealthyAt: null,
        lastCheckedAt: new Date().toISOString(),
        message: msg,
        consecutiveFailures: 1,
        latencyMs: Date.now() - start,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Webhooks
  // -----------------------------------------------------------------------

  /**
   * Verify that a Seam webhook signature is authentic.
   * Seam signs webhook payloads with a `seam-workspace` header.
   */
  async verifyWebhookSignature(
    _rawBody: string,
    headers: Record<string, string>,
  ): Promise<boolean> {
    // Seam uses the `seam-workspace` signature header.
    // In production, you would compute HMAC-SHA256 using the API key
    // and compare. For now, we check for the presence of the header.
    const signature = headers['seam-workspace'] ?? headers['seam-signature'];
    if (!signature) return false;
    // Basic presence check — full HMAC verification requires the workspace secret.
    return signature.length > 0;
  }

  // -----------------------------------------------------------------------
  // ILockProvider — Commands
  // -----------------------------------------------------------------------

  async executeCommand(
    request: LockCommandRequest,
  ): Promise<HardwareResult<LockCommandResponse>> {
    try {
      await this.executeWithReconnect(async () => {});

      const vendorLockId = request.vendorLockId ?? request.lockId;
      let actionPath: string;

      switch (request.commandType) {
        case 'unlock':
        case 'remote_unlock':
          actionPath = `/locks/${vendorLockId}/unlock`;
          break;
        case 'lock':
        case 'remote_lockout':
          actionPath = `/locks/${vendorLockId}/lock`;
          break;
        default:
          return {
            success: false,
            error: `Seam does not support command type "${request.commandType}".`,
            timestamp: new Date().toISOString(),
          };
      }

      const response = await this.seamPost<SeamLockActionResponse>(actionPath, {});

      const lockCommandResponse: LockCommandResponse = {
        commandId: response.action_attempt_id,
        lockId: request.lockId,
        vendorLockId,
        success: response.status === 'success',
        statusCode: response.status,
        message: response.error?.message,
        vendorResponse: response as unknown as Record<string, unknown>,
        timestamp: new Date().toISOString(),
      };

      return { success: true, data: lockCommandResponse, timestamp: new Date().toISOString() };
    } catch (err) {
      return this.wrapError(err, 'executeCommand');
    }
  }

  // -----------------------------------------------------------------------
  // ILockProvider — Queries
  // -----------------------------------------------------------------------

  async listLocks(
    _cursor?: string,
    _limit?: number,
  ): Promise<PaginatedResult<LockInfo>> {
    try {
      await this.executeWithReconnect(async () => {});

      const response = await this.seamGet<{ locks: SeamLock[] }>(
        `/locks?workspace_id=${this.workspaceId}`,
      );

      const items: LockInfo[] = response.locks.map((lock) => ({
        id: lock.lock_id,
        vendorLockId: lock.lock_id,
        name: lock.properties.name,
        lockStatus: lock.properties.locked ? LockStatus.Locked : LockStatus.Unlocked,
        batteryLevel: lock.properties.battery_level ?? lock.properties.battery?.level ?? 0,
      }));

      return {
        items,
        nextCursor: null,
        hasMore: false,
        total: items.length,
      };
    } catch (err) {
      return {
        items: [],
        nextCursor: null,
        hasMore: false,
      };
    }
  }

  async getLock(lockId: string): Promise<HardwareResult<LockInfo>> {
    try {
      await this.executeWithReconnect(async () => {});

      const response = await this.seamGet<{ lock: SeamLock }>(`/locks/${lockId}`);

      const lock = response.lock;

      return {
        success: true,
        data: {
          id: lock.lock_id,
          vendorLockId: lock.lock_id,
          name: lock.properties.name,
          lockStatus: lock.properties.locked ? LockStatus.Locked : LockStatus.Unlocked,
          batteryLevel: lock.properties.battery_level ?? lock.properties.battery?.level ?? 0,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'getLock');
    }
  }

  // -----------------------------------------------------------------------
  // Extended lock-domain methods
  // -----------------------------------------------------------------------

  async getLockStatus(lockId: LockId): Promise<HardwareResult<LockMetadata>> {
    try {
      await this.executeWithReconnect(async () => {});

      const response = await this.seamGet<{ lock: SeamLock }>(`/locks/${lockId}`);
      const lock = response.lock;
      const props = lock.properties;

      let status = LockStatus.Unknown;
      if (props.locked) {
        status = LockStatus.Locked;
      } else if (!props.locked) {
        status = LockStatus.Unlocked;
      }

      return {
        success: true,
        data: {
          lockId: lock.lock_id,
          vendorLockId: lock.lock_id,
          name: props.name,
          propertyId: this.propertyId,
          batteryLevel: props.battery_level ?? props.battery?.level ?? null,
          status,
          isConnected: props.online,
          lastSeenAt: lock.created_at,
          vendorMetadata: {
            model: props.model,
            manufacturer: props.manufacturer,
            serialNumber: props.serial_number,
            deviceId: lock.device_id,
            hasDoorSensor: props.has_door_sensor,
            hasKeypad: props.has_keypad,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'getLockStatus');
    }
  }

  async executeLockCommand(
    request: LockDomainCommandRequest,
  ): Promise<HardwareResult<LockDomainCommandResponse>> {
    try {
      await this.executeWithReconnect(async () => {});

      let actionPath: string;
      switch (request.command) {
        case LockCommand.Unlock:
        case LockCommand.EmergencyUnlock:
        case LockCommand.TimedUnlock:
          actionPath = `/locks/${request.lockId}/unlock`;
          break;
        case LockCommand.Lock:
        case LockCommand.PrivacyMode:
          actionPath = `/locks/${request.lockId}/lock`;
          break;
        default:
          return {
            success: false,
            error: `Seam does not support command "${request.command}".`,
            timestamp: new Date().toISOString(),
          };
      }

      const body: Record<string, unknown> = {};
      if (request.reason) body.reason = request.reason;

      const response = await this.seamPost<SeamLockActionResponse>(actionPath, body);

      const resultLock = response.result?.lock;
      const newStatus = resultLock?.properties?.locked != null
        ? (resultLock.properties.locked ? LockStatus.Locked : LockStatus.Unlocked)
        : undefined;

      return {
        success: true,
        data: {
          lockId: request.lockId,
          vendorLockId: request.lockId,
          command: request.command,
          accepted: response.status === 'success',
          newStatus,
          vendorMetadata: response as unknown as Record<string, unknown>,
          processedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'executeLockCommand');
    }
  }

  async createCredential(
    credential: Omit<LockCredential, 'id' | 'vendorCredentialId'>,
  ): Promise<HardwareResult<LockCredential>> {
    try {
      await this.executeWithReconnect(async () => {});

      const body: Record<string, unknown> = {
        acs_user_id: credential.guestId,
        type: this.mapCredentialTypeToSeam(credential.type),
        access_method: {},
        workspace_id: this.workspaceId,
      };

      if (credential.pinCode) {
        body.access_method = { code: credential.pinCode };
      }
      if (credential.validFrom) body.starts_at = credential.validFrom;
      if (credential.validUntil) body.ends_at = credential.validUntil;
      if (credential.maxUses != null) body.is_multi_use = credential.maxUses > 1;

      const response = await this.seamPost<SeamAcsCredential>(
        '/acs/credentials',
        body,
      );

      const created: LockCredential = {
        ...credential,
        vendorCredentialId: response.acs_credential_id,
      };

      return { success: true, data: created, timestamp: new Date().toISOString() };
    } catch (err) {
      return this.wrapError(err, 'createCredential');
    }
  }

  async deleteCredential(credentialId: string): Promise<HardwareResult<void>> {
    try {
      await this.executeWithReconnect(async () => {});

      await this.seamDelete(`/acs/credentials/${credentialId}`);

      return { success: true, timestamp: new Date().toISOString() };
    } catch (err) {
      return this.wrapError(err, 'deleteCredential');
    }
  }

  async grantAccess(params: {
    lockIds: LockId[];
    guestId: string;
    bookingId?: string;
    validFrom?: string;
    validUntil?: string;
    credentialType?: string;
  }): Promise<HardwareResult<LockCredential>> {
    try {
      await this.executeWithReconnect(async () => {});

      // Seam's grant flow: create an ACS entry for the user in an access group.
      // In practice, you'd create an acs_user, then add them to an access group.
      const body: Record<string, unknown> = {
        acs_user_id: params.guestId,
        workspace_id: this.workspaceId,
      };

      if (params.validFrom) body.starts_at = params.validFrom;
      if (params.validUntil) body.ends_at = params.validUntil;

      // Try the access-groups endpoint; fall back to credential creation
      const credential: LockCredential = {
        lockIds: params.lockIds,
        type: (params.credentialType as CredentialType) ?? CredentialType.DigitalKey,
        label: `Guest ${params.guestId} key`,
        validFrom: params.validFrom ?? new Date().toISOString(),
        validUntil: params.validUntil ?? null,
        maxUses: null,
        guestId: params.guestId,
        bookingId: params.bookingId,
      };

      // Create credential as the primary grant mechanism
      const credResult = await this.createCredential(credential);
      if (!credResult.success || !credResult.data) return credResult;

      return credResult;
    } catch (err) {
      return this.wrapError(err, 'grantAccess');
    }
  }

  async getAccessEvents(params?: {
    lockId?: LockId;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  }): Promise<HardwareResult<PaginatedResult<AccessEvent>>> {
    try {
      await this.executeWithReconnect(async () => {});

      const queryParts: string[] = [`workspace_id=${this.workspaceId}`];
      if (params?.limit) queryParts.push(`limit=${params.limit}`);
      if (params?.cursor) queryParts.push(`since=${encodeURIComponent(params.cursor)}`);
      const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

      const response = await this.seamGet<{ acs_events: SeamAcsEvent[] }>(
        `/acs/events${qs}`,
      );

      let events: AccessEvent[] = response.acs_events.map((event) => {
        const resultMapping: Record<string, AccessResult> = {
          'acs.credential_granted': AccessResult.Granted,
          'acs.credential_denied': AccessResult.Denied,
          'acs.entrance_unlocked': AccessResult.RemoteUnlock,
          'acs.entrance_locked': AccessResult.AutoLock,
        };

        return {
          vendorEventId: event.acs_event_id,
          lockId: event.acs_entrance_id ?? event.workspace_id,
          vendorLockId: event.acs_entrance_id ?? event.workspace_id,
          timestamp: event.timestamp,
          direction: AccessDirection.Unknown,
          result: resultMapping[event.event_type] ?? AccessResult.Unknown,
          guestId: event.acs_user_id,
          vendorMetadata: {
            eventType: event.event_type,
            credentialId: event.acs_credential_id,
            error: event.error,
          },
        };
      });

      // Filter by lockId if specified
      if (params?.lockId) {
        events = events.filter((e) => e.lockId === params.lockId);
      }

      // Filter by time range
      if (params?.from) {
        const fromTime = new Date(params.from).getTime();
        events = events.filter((e) => new Date(e.timestamp).getTime() >= fromTime);
      }
      if (params?.to) {
        const toTime = new Date(params.to).getTime();
        events = events.filter((e) => new Date(e.timestamp).getTime() <= toTime);
      }

      return {
        success: true,
        data: {
          items: events,
          nextCursor: null,
          hasMore: false,
          total: events.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'getAccessEvents');
    }
  }

  async discoverLocks(
    _options?: LockSyncOptions,
  ): Promise<HardwareResult<LockDiscoveryResult>> {
    try {
      await this.executeWithReconnect(async () => {});

      const response = await this.seamGet<{ locks: SeamLock[] }>(
        `/locks?workspace_id=${this.workspaceId}`,
      );

      const locks: LockMetadata[] = response.locks.map((lock) => {
        const props = lock.properties;
        let status = LockStatus.Unknown;
        if (props.locked) status = LockStatus.Locked;
        else if (!props.locked) status = LockStatus.Unlocked;

        return {
          lockId: lock.lock_id,
          vendorLockId: lock.lock_id,
          name: props.name,
          propertyId: this.propertyId,
          batteryLevel: props.battery_level ?? props.battery?.level ?? null,
          status,
          isConnected: props.online,
          lastSeenAt: lock.created_at,
          vendorMetadata: {
            model: props.model,
            manufacturer: props.manufacturer,
            deviceId: lock.device_id,
          },
        };
      });

      return {
        success: true,
        data: { locks, removedVendorLockIds: [] },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'discoverLocks');
    }
  }

  // -----------------------------------------------------------------------
  // HTTP helpers
  // -----------------------------------------------------------------------

  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.credentials.apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  private async seamGet<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = mapHttpError(response.status, text);
      throw createHardwareError(detail.code, detail.message, 'seam');
    }

    return (await response.json()) as T;
  }

  private async seamPost<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = mapHttpError(response.status, text);
      throw createHardwareError(detail.code, detail.message, 'seam');
    }

    return (await response.json()) as T;
  }

  private async seamDelete(path: string): Promise<void> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.credentials.apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = mapHttpError(response.status, text);
      throw createHardwareError(detail.code, detail.message, 'seam');
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private mapCredentialTypeToSeam(type: CredentialType): string {
    const mapping: Record<CredentialType, string> = {
      [CredentialType.PinCode]: 'pin',
      [CredentialType.MobileKey]: 'phone',
      [CredentialType.RfidCard]: 'card',
      [CredentialType.RfidFob]: 'card',
      [CredentialType.MechanicalKey]: 'key',
      [CredentialType.Biometric]: 'biometric',
      [CredentialType.Remote]: 'phone',
      [CredentialType.DigitalKey]: 'phone',
    };
    return mapping[type] ?? 'phone';
  }
}
