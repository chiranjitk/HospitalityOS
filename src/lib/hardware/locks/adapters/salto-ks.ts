/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * SALTO KS Cloud REST adapter.
 *
 * Integrates with the SALTO KS cloud API for lock management, key
 * provisioning, and audit-event retrieval using OAuth2 authentication.
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
// SALTO KS API response shapes (vendor-specific)
// ---------------------------------------------------------------------------

interface SaltoOAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface SaltoSiteResponse {
  site_id: string;
  name: string;
  customer_id: string;
  created_at: string;
}

interface SaltoLockResponse {
  lock_id: string;
  name: string;
  model: string;
  serial_number: string;
  state: 'locked' | 'unlocked' | 'online' | 'offline' | 'unknown';
  battery_percentage: number | null;
  last_activity: string | null;
  floor?: number;
  zone?: string;
}

interface SaltoLockActionResponse {
  lock_id: string;
  action_id: string;
  state: string;
  status: 'accepted' | 'pending' | 'rejected';
  message?: string;
}

interface SaltoKeyResponse {
  key_id: string;
  site_id: string;
  type: string;
  label?: string;
  valid_from: string;
  valid_until?: string;
  lock_ids: string[];
  status: 'active' | 'inactive' | 'revoked';
}

interface SaltoAccessGrantResponse {
  grant_id: string;
  key_id: string;
  lock_ids: string[];
  status: 'granted' | 'revoked';
}

interface SaltoAuditEvent {
  event_id: string;
  lock_id: string;
  timestamp: string;
  event_type: 'key_used' | 'key_denied' | 'remote_unlock' | 'auto_lock' | 'door_opened' | 'door_closed' | 'battery_warning' | 'lock_updated';
  key_id?: string;
  user_id?: string;
  denial_reason?: string;
  direction?: 'entry' | 'exit';
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class SaltoKSAdapter extends BaseLockAdapter {
  private baseUrl = 'https://customers.saltosystems.com';
  private customerId = '';
  private siteId = '';
  private pollingIntervalSeconds = 30;

  // OAuth token management
  private accessToken = '';
  private tokenExpiresAt = 0; // epoch ms

  // -----------------------------------------------------------------------
  // Metadata
  // -----------------------------------------------------------------------

  getInfo(): AdapterInfo {
    return {
      providerId: 'salto-ks',
      category: 'lock',
      displayName: 'SALTO KS Cloud',
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

    this.customerId = String(config.customerId ?? '');
    this.siteId = String(config.siteId ?? '');
    this.baseUrl = String(config.baseUrl ?? 'https://customers.saltosystems.com');
    this.pollingIntervalSeconds = Number(config.pollingIntervalSeconds ?? 30) || 30;

    if (!this.customerId) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CONFIG,
        'SALTO KS adapter requires "customerId" in config.',
        'salto-ks',
      );
    }

    if (!this.siteId) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CONFIG,
        'SALTO KS adapter requires "siteId" in config.',
        'salto-ks',
      );
    }

    if (!credentials.clientId || !credentials.clientSecret) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CREDENTIALS,
        'SALTO KS adapter requires "clientId" and "clientSecret" credentials.',
        'salto-ks',
      );
    }
  }

  async connect(): Promise<void> {
    if (this.connectionState === AdapterConnectionState.Connected) return;
    this.connectionState = AdapterConnectionState.Connecting;

    try {
      // Obtain OAuth token
      await this.refreshToken();

      // Verify site access
      await this.authenticatedGet<SaltoSiteResponse>(
        `/api/v1/sites/${this.siteId}`,
      );

      this.connectionState = AdapterConnectionState.Connected;
    } catch (err) {
      this.connectionState = AdapterConnectionState.Error;
      const msg = err instanceof Error ? err.message : String(err);
      throw createHardwareError(
        HardwareErrorCode.CONNECTION_FAILED,
        `SALTO KS connection failed: ${msg}`,
        'salto-ks',
      );
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = '';
    this.tokenExpiresAt = 0;
    this.connectionState = AdapterConnectionState.Disconnecting;
    this.connectionState = AdapterConnectionState.Disconnected;
  }

  async healthCheck(): Promise<AdapterHealth> {
    const start = Date.now();
    try {
      await this.authenticatedGet<SaltoSiteResponse>(
        `/api/v1/sites/${this.siteId}`,
      );
      const latencyMs = Date.now() - start;
      return {
        providerId: 'salto-ks',
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
        providerId: 'salto-ks',
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
  // OAuth token management
  // -----------------------------------------------------------------------

  private async refreshToken(): Promise<void> {
    const clientId = String(this.credentials.clientId ?? '');
    const clientSecret = String(this.credentials.clientSecret ?? '');
    const tokenUrl = `${this.baseUrl}/oauth/token`;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = mapHttpError(response.status, text);
      throw createHardwareError(detail.code, detail.message, 'salto-ks');
    }

    const token = (await response.json()) as SaltoOAuthResponse;

    this.accessToken = token.access_token;
    // Subtract 5-minute buffer for safety
    this.tokenExpiresAt = Date.now() + (token.expires_in * 1000) - 300_000;
  }

  private async ensureToken(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
      await this.refreshToken();
    }
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
      const actionMap: Record<string, string> = {
        unlock: 'unlock',
        lock: 'lock',
        remote_unlock: 'unlock',
        remote_lockout: 'lock',
      };

      const action = actionMap[request.commandType];
      if (!action) {
        return {
          success: false,
          error: `SALTO KS does not support command type "${request.commandType}".`,
          timestamp: new Date().toISOString(),
        };
      }

      const response = await this.authenticatedPut<SaltoLockActionResponse>(
        `/api/v1/sites/${this.siteId}/locks/${vendorLockId}/state`,
        { action },
      );

      const lockCommandResponse: LockCommandResponse = {
        commandId: response.action_id,
        lockId: request.lockId,
        vendorLockId: response.lock_id,
        success: response.status === 'accepted',
        statusCode: response.status,
        message: response.message,
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
    limit: number = 50,
  ): Promise<PaginatedResult<LockInfo>> {
    try {
      await this.executeWithReconnect(async () => {});

      const response = await this.authenticatedGet<SaltoLockResponse[]>(
        `/api/v1/sites/${this.siteId}/locks?limit=${limit}`,
      );

      const items: LockInfo[] = response.map((item) => ({
        id: item.lock_id,
        vendorLockId: item.lock_id,
        name: item.name,
        lockStatus: item.state,
        batteryLevel: item.battery_percentage ?? 0,
        lastActivity: item.last_activity ?? undefined,
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

      const response = await this.authenticatedGet<SaltoLockResponse>(
        `/api/v1/sites/${this.siteId}/locks/${lockId}`,
      );

      return {
        success: true,
        data: {
          id: response.lock_id,
          vendorLockId: response.lock_id,
          name: response.name,
          lockStatus: response.state,
          batteryLevel: response.battery_percentage ?? 0,
          lastActivity: response.last_activity ?? undefined,
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

      const response = await this.authenticatedGet<SaltoLockResponse>(
        `/api/v1/sites/${this.siteId}/locks/${lockId}`,
      );

      return {
        success: true,
        data: this.mapLockToMetadata(response),
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

      const commandMap: Record<LockCommand, string> = {
        [LockCommand.Lock]: 'lock',
        [LockCommand.Unlock]: 'unlock',
        [LockCommand.TimedUnlock]: 'unlock',
        [LockCommand.EmergencyUnlock]: 'unlock',
        [LockCommand.PrivacyMode]: 'lock',
        [LockCommand.UpdateSchedule]: 'update_schedule',
      };

      const action = commandMap[request.command];
      if (!action) {
        return {
          success: false,
          error: `SALTO KS does not support command "${request.command}".`,
          timestamp: new Date().toISOString(),
        };
      }

      const body: Record<string, unknown> = {
        action,
        reason: request.reason,
        initiated_by: request.initiatedBy,
      };

      if (request.durationSeconds != null) {
        body.duration_seconds = request.durationSeconds;
      }

      const response = await this.authenticatedPut<SaltoLockActionResponse>(
        `/api/v1/sites/${this.siteId}/locks/${request.lockId}/state`,
        body,
      );

      return {
        success: true,
        data: {
          lockId: request.lockId,
          vendorLockId: response.lock_id,
          command: request.command,
          accepted: response.status === 'accepted',
          newStatus: this.mapSaltoState(response.state),
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

      const body = {
        lock_ids: credential.lockIds,
        type: credential.type,
        label: credential.label,
        valid_from: credential.validFrom,
        valid_until: credential.validUntil,
        max_uses: credential.maxUses,
        guest_id: credential.guestId,
        booking_id: credential.bookingId,
      };

      const response = await this.authenticatedPost<SaltoKeyResponse>(
        `/api/v1/sites/${this.siteId}/keys`,
        body,
      );

      const created: LockCredential = {
        ...credential,
        vendorCredentialId: response.key_id,
      };

      return { success: true, data: created, timestamp: new Date().toISOString() };
    } catch (err) {
      return this.wrapError(err, 'createCredential');
    }
  }

  async deleteCredential(credentialId: string): Promise<HardwareResult<void>> {
    try {
      await this.executeWithReconnect(async () => {});

      await this.authenticatedDelete(
        `/api/v1/sites/${this.siteId}/keys/${credentialId}`,
      );

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

      const body = {
        lock_ids: params.lockIds,
        guest_id: params.guestId,
        booking_id: params.bookingId,
        credential_type: params.credentialType ?? 'mobile_key',
        valid_from: params.validFrom ?? new Date().toISOString(),
        valid_until: params.validUntil ?? null,
      };

      const response = await this.authenticatedPost<SaltoAccessGrantResponse>(
        `/api/v1/sites/${this.siteId}/access-grants`,
        body,
      );

      const credential: LockCredential = {
        vendorCredentialId: response.key_id,
        lockIds: response.lock_ids,
        type: (params.credentialType as CredentialType) ?? CredentialType.MobileKey,
        validFrom: params.validFrom ?? new Date().toISOString(),
        validUntil: params.validUntil ?? null,
        maxUses: null,
        guestId: params.guestId,
        bookingId: params.bookingId,
      };

      return { success: true, data: credential, timestamp: new Date().toISOString() };
    } catch (err) {
      return this.wrapError(err, 'grantAccess');
    }
  }

  async revokeAccess(params: {
    guestId: string;
    lockIds?: LockId[];
    bookingId?: string;
  }): Promise<HardwareResult<void>> {
    try {
      await this.executeWithReconnect(async () => {});

      // SALTO KS requires a specific grant ID for revocation.
      // When only guestId/bookingId is provided, we revoke all matching grants.
      // In production, you would first query for the grant ID.
      const grantsUrl = `/api/v1/sites/${this.siteId}/access-grants?guest_id=${encodeURIComponent(params.guestId)}`;
      const grants = await this.authenticatedGet<SaltoAccessGrantResponse[]>(grantsUrl);

      for (const grant of grants) {
        try {
          await this.authenticatedDelete(
            `/api/v1/sites/${this.siteId}/access-grants/${grant.grant_id}`,
          );
        } catch {
          // Continue revoking remaining grants even if one fails
        }
      }

      return { success: true, timestamp: new Date().toISOString() };
    } catch (err) {
      return this.wrapError(err, 'revokeAccess');
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

      const queryParts: string[] = [];
      if (params?.lockId) queryParts.push(`lock_id=${encodeURIComponent(params.lockId)}`);
      if (params?.from) queryParts.push(`from=${encodeURIComponent(params.from)}`);
      if (params?.to) queryParts.push(`to=${encodeURIComponent(params.to)}`);
      if (params?.limit) queryParts.push(`limit=${params.limit}`);
      if (params?.cursor) queryParts.push(`cursor=${encodeURIComponent(params.cursor)}`);
      const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

      const response = await this.authenticatedGet<SaltoAuditEvent[]>(
        `/api/v1/sites/${this.siteId}/audit${qs}`,
      );

      const events: AccessEvent[] = response.map(this.mapAuditEvent);

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

      const response = await this.authenticatedGet<SaltoLockResponse[]>(
        `/api/v1/sites/${this.siteId}/locks`,
      );

      const locks: LockMetadata[] = response.map((item) => this.mapLockToMetadata(item));

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
  // HTTP helpers with auth & token refresh
  // -----------------------------------------------------------------------

  private async authenticatedGet<T>(path: string): Promise<T> {
    return this.authenticatedRequest<T>('GET', path);
  }

  private async authenticatedPost<T>(path: string, body: unknown): Promise<T> {
    return this.authenticatedRequest<T>('POST', path, body);
  }

  private async authenticatedPut<T>(path: string, body: unknown): Promise<T> {
    return this.authenticatedRequest<T>('PUT', path, body);
  }

  private async authenticatedDelete(path: string): Promise<void> {
    await this.authenticatedRequest<void>('DELETE', path);
  }

  private async authenticatedRequest<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    await this.ensureToken();

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/json',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const fetchOpts: RequestInit = { method, headers };
    if (body) {
      fetchOpts.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOpts);

    // Token expired — refresh and retry once
    if (response.status === 401) {
      this.accessToken = '';
      await this.refreshToken();
      headers['Authorization'] = `Bearer ${this.accessToken}`;
      const retryResponse = await fetch(url, fetchOpts);

      if (!retryResponse.ok) {
        const text = await retryResponse.text().catch(() => '');
        const detail = mapHttpError(retryResponse.status, text);
        throw createHardwareError(detail.code, detail.message, 'salto-ks');
      }

      if (method === 'DELETE') return undefined as T;
      return (await retryResponse.json()) as T;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = mapHttpError(response.status, text);
      throw createHardwareError(detail.code, detail.message, 'salto-ks');
    }

    if (method === 'DELETE') return undefined as T;
    return (await response.json()) as T;
  }

  // -----------------------------------------------------------------------
  // Mappers
  // -----------------------------------------------------------------------

  private mapLockToMetadata(lock: SaltoLockResponse): LockMetadata {
    return {
      lockId: lock.lock_id,
      vendorLockId: lock.lock_id,
      name: lock.name,
      location: lock.zone,
      propertyId: this.propertyId,
      batteryLevel: lock.battery_percentage,
      status: this.mapSaltoState(lock.state),
      isConnected: lock.state !== 'offline',
      lastSeenAt: lock.last_activity,
      vendorMetadata: {
        model: lock.model,
        serialNumber: lock.serial_number,
        floor: lock.floor,
      },
    };
  }

  private mapSaltoState(state: string): LockStatus {
    const mapping: Record<string, LockStatus> = {
      locked: LockStatus.Locked,
      unlocked: LockStatus.Unlocked,
      online: LockStatus.Locked,
      offline: LockStatus.Offline,
      unknown: LockStatus.Unknown,
    };
    return mapping[state] ?? LockStatus.Unknown;
  }

  private mapAuditEvent(event: SaltoAuditEvent): AccessEvent {
    const resultMapping: Record<string, AccessResult> = {
      key_used: AccessResult.Granted,
      key_denied: AccessResult.Denied,
      remote_unlock: AccessResult.RemoteUnlock,
      auto_lock: AccessResult.AutoLock,
      door_opened: AccessResult.Granted,
      door_closed: AccessResult.AutoLock,
      battery_warning: AccessResult.Denied,
      lock_updated: AccessResult.Granted,
    };

    const directionMapping: Record<string, AccessDirection> = {
      entry: AccessDirection.Entry,
      exit: AccessDirection.Exit,
    };

    return {
      vendorEventId: event.event_id,
      lockId: event.lock_id,
      vendorLockId: event.lock_id,
      timestamp: event.timestamp,
      direction: event.direction ? (directionMapping[event.direction] ?? AccessDirection.Unknown) : AccessDirection.Unknown,
      result: resultMapping[event.event_type] ?? AccessResult.Unknown,
      guestId: event.user_id,
      denialReason: event.denial_reason,
      vendorMetadata: { eventType: event.event_type, keyId: event.key_id },
    };
  }
}
