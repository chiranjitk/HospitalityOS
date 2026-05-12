/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * ASSA ABLOY Visionline REST adapter.
 *
 * Communicates with the Visionline REST API for lock management, credential
 * provisioning, and access-event retrieval across ASSA ABLOY hotel locks.
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
// Visionline API response shapes (vendor-specific)
// ---------------------------------------------------------------------------

interface VisionlineVersionResponse {
  api_version: string;
  encoder_version?: string;
}

interface VisionlineLockStatusResponse {
  lock_id: string;
  state: 'locked' | 'unlocked' | 'jammed' | 'open' | 'unknown';
  battery_level: number | null;
  online: boolean;
  last_seen: string | null;
  door_state?: 'open' | 'closed';
  model?: string;
  firmware_version?: string;
}

interface VisionlineLockItem {
  lock_id: string;
  name: string;
  location?: string;
  floor?: string;
  room_number?: string;
  model?: string;
}

interface VisionlineCommandResponse {
  command_id: string;
  lock_id: string;
  status: 'accepted' | 'rejected' | 'pending' | 'failed';
  new_state?: string;
  message?: string;
}

interface VisionlineCredentialResponse {
  credential_id: string;
  type: string;
  lock_ids: string[];
  valid_from: string;
  valid_until?: string;
  status: 'active' | 'inactive' | 'expired';
}

interface VisionlineAccessEvent {
  event_id: string;
  lock_id: string;
  timestamp: string;
  event_type: 'access_granted' | 'access_denied' | 'remote_unlock' | 'auto_lock' | 'door_opened' | 'door_closed' | 'battery_low';
  credential_id?: string;
  guest_id?: string;
  denial_reason?: string;
  direction?: 'entry' | 'exit';
}

interface VisionlineGrantResponse {
  grant_id: string;
  credential_id: string;
  lock_ids: string[];
  status: 'granted' | 'pending';
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class AssaAbloyVisionlineAdapter extends BaseLockAdapter {
  private serviceUrl = '';
  private encoderUrl?: string;
  private siteCode?: string;
  private timeoutMs = 10_000;

  // -----------------------------------------------------------------------
  // Metadata
  // -----------------------------------------------------------------------

  getInfo(): AdapterInfo {
    return {
      providerId: 'assa-abloy-visionline',
      category: 'lock',
      displayName: 'ASSA ABLOY Visionline',
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

    this.serviceUrl = String(config.serviceUrl ?? '');
    this.encoderUrl = config.encoderUrl ? String(config.encoderUrl) : undefined;
    this.siteCode = config.siteCode ? String(config.siteCode) : undefined;
    this.timeoutMs = Number(config.timeoutMs ?? 10_000) || 10_000;

    if (!this.serviceUrl) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CONFIG,
        'ASSA ABLOY Visionline adapter requires "serviceUrl" in config.',
        'assa-abloy-visionline',
      );
    }

    if (!credentials.username || !credentials.password) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CREDENTIALS,
        'ASSA ABLOY Visionline adapter requires "username" and "password" credentials.',
        'assa-abloy-visionline',
      );
    }
  }

  async connect(): Promise<void> {
    if (this.connectionState === AdapterConnectionState.Connected) return;
    this.connectionState = AdapterConnectionState.Connecting;

    try {
      // Validate connection by hitting version endpoint
      const response = await this.httpGet<VisionlineVersionResponse>(
        `${this.serviceUrl}/api/version`,
      );
      this.connectionState = AdapterConnectionState.Connected;
    } catch (err) {
      this.connectionState = AdapterConnectionState.Error;
      const msg = err instanceof Error ? err.message : String(err);
      throw createHardwareError(
        HardwareErrorCode.CONNECTION_FAILED,
        `Visionline connection failed: ${msg}`,
        'assa-abloy-visionline',
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
      await this.httpGet<VisionlineVersionResponse>(
        `${this.serviceUrl}/api/version`,
      );
      const latencyMs = Date.now() - start;
      return {
        providerId: 'assa-abloy-visionline',
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
        providerId: 'assa-abloy-visionline',
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

  async verifyWebhookSignature(
    _rawBody: string,
    _headers: Record<string, string>,
  ): Promise<boolean> {
    // Visionline webhooks use HMAC-SHA256 signatures.
    // Full implementation requires the shared secret configured in Visionline.
    return false;
  }

  // -----------------------------------------------------------------------
  // ILockProvider — Commands
  // -----------------------------------------------------------------------

  async executeCommand(
    request: LockCommandRequest,
  ): Promise<HardwareResult<LockCommandResponse>> {
    try {
      await this.executeWithReconnect(async () => {
        // no-op guard
      });

      const vendorLockId = request.vendorLockId ?? request.lockId;
      const commandMap: Record<string, string> = {
        unlock: 'unlock',
        lock: 'lock',
        remote_lockout: 'lockout',
        remote_unlock: 'remote_unlock',
      };

      const vlCommand = commandMap[request.commandType];
      if (!vlCommand) {
        return {
          success: false,
          error: `Visionline does not support command type "${request.commandType}".`,
          timestamp: new Date().toISOString(),
        };
      }

      const response = await this.httpPost<VisionlineCommandResponse>(
        `${this.serviceUrl}/api/locks/${vendorLockId}/command`,
        { command: vlCommand, site_code: this.siteCode },
      );

      const lockCommandResponse: LockCommandResponse = {
        commandId: response.command_id,
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

      const response = await this.httpGet<VisionlineLockItem[]>(
        `${this.serviceUrl}/api/locks?limit=${limit}`,
      );

      const items: LockInfo[] = response.map((item) => ({
        id: item.lock_id,
        vendorLockId: item.lock_id,
        name: item.name,
        roomId: item.room_number ?? item.floor,
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

      const vendorLockId = lockId;
      const statusResponse = await this.httpGet<VisionlineLockStatusResponse>(
        `${this.serviceUrl}/api/locks/${vendorLockId}/status`,
      );

      return {
        success: true,
        data: {
          id: vendorLockId,
          vendorLockId: statusResponse.lock_id,
          name: vendorLockId,
          doorStatus: statusResponse.door_state ?? 'unknown',
          lockStatus: statusResponse.state,
          batteryLevel: statusResponse.battery_level ?? 0,
          firmwareVersion: statusResponse.firmware_version,
          lastActivity: statusResponse.last_seen ?? undefined,
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

      const response = await this.httpGet<VisionlineLockStatusResponse>(
        `${this.serviceUrl}/api/locks/${lockId}/status`,
      );

      return {
        success: true,
        data: this.mapLockStatus(response),
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
        [LockCommand.EmergencyUnlock]: 'emergency_unlock',
        [LockCommand.PrivacyMode]: 'privacy_mode',
        [LockCommand.UpdateSchedule]: 'update_schedule',
      };

      const vlCommand = commandMap[request.command];
      if (!vlCommand) {
        return {
          success: false,
          error: `Visionline does not support command "${request.command}".`,
          timestamp: new Date().toISOString(),
        };
      }

      const body: Record<string, unknown> = {
        command: vlCommand,
        site_code: this.siteCode,
        reason: request.reason,
        initiated_by: request.initiatedBy,
      };

      if (request.durationSeconds != null) {
        body.duration_seconds = request.durationSeconds;
      }

      if (request.schedule) {
        body.schedule = request.schedule;
      }

      const response = await this.httpPost<VisionlineCommandResponse>(
        `${this.serviceUrl}/api/locks/${request.lockId}/command`,
        body,
      );

      const mappedStatus = this.mapVisionlineState(response.new_state);

      return {
        success: true,
        data: {
          lockId: request.lockId,
          vendorLockId: response.lock_id,
          command: request.command,
          accepted: response.status === 'accepted',
          newStatus: mappedStatus,
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
        valid_from: credential.validFrom,
        valid_until: credential.validUntil,
        max_uses: credential.maxUses,
        pin_code: credential.pinCode,
        rfid_uid: credential.rfidUid,
        guest_id: credential.guestId,
        booking_id: credential.bookingId,
      };

      const response = await this.httpPost<VisionlineCredentialResponse>(
        `${this.serviceUrl}/api/credentials`,
        body,
      );

      const created: LockCredential = {
        ...credential,
        vendorCredentialId: response.credential_id,
      };

      return { success: true, data: created, timestamp: new Date().toISOString() };
    } catch (err) {
      return this.wrapError(err, 'createCredential');
    }
  }

  async deleteCredential(credentialId: string): Promise<HardwareResult<void>> {
    try {
      await this.executeWithReconnect(async () => {});

      await this.httpDelete(
        `${this.serviceUrl}/api/credentials/${credentialId}`,
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

      const response = await this.httpPost<VisionlineGrantResponse>(
        `${this.serviceUrl}/api/access/grant`,
        body,
      );

      const credential: LockCredential = {
        vendorCredentialId: response.credential_id,
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

      const body: Record<string, unknown> = {
        guest_id: params.guestId,
      };
      if (params.lockIds) body.lock_ids = params.lockIds;
      if (params.bookingId) body.booking_id = params.bookingId;

      await this.httpPost(
        `${this.serviceUrl}/api/access/revoke`,
        body,
      );

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

      if (!params?.lockId) {
        return {
          success: false,
          error: 'Visionline access events require a lockId parameter.',
          timestamp: new Date().toISOString(),
        };
      }

      const queryParts: string[] = [];
      if (params.from) queryParts.push(`from=${encodeURIComponent(params.from)}`);
      if (params.to) queryParts.push(`to=${encodeURIComponent(params.to)}`);
      if (params.limit) queryParts.push(`limit=${params.limit}`);
      if (params.cursor) queryParts.push(`cursor=${encodeURIComponent(params.cursor)}`);
      const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

      const response = await this.httpGet<VisionlineAccessEvent[]>(
        `${this.serviceUrl}/api/locks/${params.lockId}/events${qs}`,
      );

      const events: AccessEvent[] = response.map(this.mapAccessEvent);

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

      const response = await this.httpGet<VisionlineLockItem[]>(
        `${this.serviceUrl}/api/locks`,
      );

      const locks: LockMetadata[] = response.map((item) => ({
        lockId: item.lock_id,
        vendorLockId: item.lock_id,
        name: item.name,
        location: item.location ?? item.floor,
        propertyId: this.propertyId,
        batteryLevel: null,
        status: LockStatus.Unknown,
        isConnected: false,
        lastSeenAt: null,
        vendorMetadata: { model: item.model, floor: item.floor, room_number: item.room_number },
      }));

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

  private get authHeader(): string {
    const username = String(this.credentials.username ?? '');
    const password = String(this.credentials.password ?? '');
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  private async httpGet<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const detail = mapHttpError(response.status, text);
        throw createHardwareError(detail.code, detail.message, 'assa-abloy-visionline');
      }

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        throw createHardwareError(
          HardwareErrorCode.CONNECTION_TIMEOUT,
          `Request to ${url} timed out after ${this.timeoutMs}ms.`,
          'assa-abloy-visionline',
        );
      }
      throw err;
    }
  }

  private async httpPost<T>(url: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const detail = mapHttpError(response.status, text);
        throw createHardwareError(detail.code, detail.message, 'assa-abloy-visionline');
      }

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        throw createHardwareError(
          HardwareErrorCode.CONNECTION_TIMEOUT,
          `POST to ${url} timed out.`,
          'assa-abloy-visionline',
        );
      }
      throw err;
    }
  }

  private async httpDelete(url: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: this.authHeader,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const detail = mapHttpError(response.status, text);
        throw createHardwareError(detail.code, detail.message, 'assa-abloy-visionline');
      }
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        throw createHardwareError(
          HardwareErrorCode.CONNECTION_TIMEOUT,
          `DELETE to ${url} timed out.`,
          'assa-abloy-visionline',
        );
      }
      throw err;
    }
  }

  // -----------------------------------------------------------------------
  // Mappers
  // -----------------------------------------------------------------------

  private mapLockStatus(response: VisionlineLockStatusResponse): LockMetadata {
    return {
      lockId: response.lock_id,
      vendorLockId: response.lock_id,
      name: response.lock_id,
      propertyId: this.propertyId,
      batteryLevel: response.battery_level,
      status: this.mapVisionlineState(response.state),
      isConnected: response.online,
      lastSeenAt: response.last_seen,
      vendorMetadata: {
        doorState: response.door_state,
        model: response.model,
        firmwareVersion: response.firmware_version,
      },
    };
  }

  private mapVisionlineState(state?: string): LockStatus {
    if (!state) return LockStatus.Unknown;
    const mapping: Record<string, LockStatus> = {
      locked: LockStatus.Locked,
      unlocked: LockStatus.Unlocked,
      jammed: LockStatus.Jammed,
      open: LockStatus.Unlocked,
    };
    return mapping[state] ?? LockStatus.Unknown;
  }

  private mapAccessEvent(event: VisionlineAccessEvent): AccessEvent {
    const resultMapping: Record<string, AccessResult> = {
      access_granted: AccessResult.Granted,
      access_denied: AccessResult.Denied,
      remote_unlock: AccessResult.RemoteUnlock,
      auto_lock: AccessResult.AutoLock,
      door_opened: AccessResult.Granted,
      door_closed: AccessResult.AutoLock,
      battery_low: AccessResult.Denied,
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
      guestId: event.guest_id,
      denialReason: event.denial_reason,
      vendorMetadata: { eventType: event.event_type, credentialId: event.credential_id },
    };
  }
}
