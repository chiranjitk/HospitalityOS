/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * Nuki Cloud / Bridge REST adapter.
 *
 * Integrates with the Nuki Web API for smart lock management and access-log
 * retrieval. Credential provisioning uses app-based provisioning and is
 * therefore NOT_SUPPORTED through the API.
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
// Nuki API response shapes (vendor-specific)
// ---------------------------------------------------------------------------

interface NukiAccountResponse {
  id: number;
  name: string;
  email: string;
}

interface NukiSmartlock {
  smartlockId: number;
  type: number;
  name: string;
  firmwareVersion: number;
  lastKnownState: NukiLockState;
}

interface NukiLockState {
  state: number; // 1=locked, 2=unlocking, 3=unlocked, 4=locking, 5=uncalibrated
  stateName: string;
  batteryCritical: boolean;
  batteryCharging: boolean;
  batteryLevel: number;
  doorsensorState?: string;
  doorsensorStateName?: string;
  timestamp: number; // unix epoch ms
}

interface NukiActionResponse {
  batteryCritical: boolean;
  batteryLevel: number;
  lastKnownState: NukiLockState;
}

interface NukiLogEntry {
  id: number;
  lockId: number;
  type: number; // 1=lock, 2=unlock, 3=unlatch, 4=lockNgo, 5=doorOpened, 6=doorClosed, ...
  name: string;
  date: string; // ISO-8601
  state: number;
  trigger: number;
}

// ---------------------------------------------------------------------------
// Nuki state mapping
// ---------------------------------------------------------------------------

const NUKI_STATE_MAP: Record<number, LockStatus> = {
  1: LockStatus.Locked,
  2: LockStatus.Transitioning,
  3: LockStatus.Unlocked,
  4: LockStatus.Transitioning,
  5: LockStatus.Unknown,
};

const NUKI_ACTION_MAP: Record<string, number> = {
  [LockCommand.Unlock]: 1,  // unlock
  [LockCommand.Lock]: 2,    // lock
  [LockCommand.EmergencyUnlock]: 3, // unlatch
  [LockCommand.TimedUnlock]: 1,     // unlock
};

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class NukiAdapter extends BaseLockAdapter {
  private cloudApiUrl = 'https://api.nuki.io';
  private bridgeIp?: string;
  private bridgePort = 8080;
  private useCloudApi = true;

  // -----------------------------------------------------------------------
  // Metadata
  // -----------------------------------------------------------------------

  getInfo(): AdapterInfo {
    return {
      providerId: 'nuki',
      category: 'lock',
      displayName: 'Nuki Smart Lock',
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

    this.cloudApiUrl = String(config.cloudApiUrl ?? 'https://api.nuki.io');
    this.bridgeIp = config.bridgeIp ? String(config.bridgeIp) : undefined;
    this.bridgePort = Number(config.bridgePort ?? 8080) || 8080;
    this.useCloudApi = config.useCloudApi !== false;

    if (!credentials.apiToken) {
      throw createHardwareError(
        HardwareErrorCode.INVALID_CREDENTIALS,
        'Nuki adapter requires "apiToken" credential.',
        'nuki',
      );
    }
  }

  async connect(): Promise<void> {
    if (this.connectionState === AdapterConnectionState.Connected) return;
    this.connectionState = AdapterConnectionState.Connecting;

    try {
      // Verify API token by fetching account info
      await this.nukiGet<NukiAccountResponse>('/api/account');
      this.connectionState = AdapterConnectionState.Connected;
    } catch (err) {
      this.connectionState = AdapterConnectionState.Error;
      const msg = err instanceof Error ? err.message : String(err);
      throw createHardwareError(
        HardwareErrorCode.CONNECTION_FAILED,
        `Nuki connection failed: ${msg}`,
        'nuki',
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
      await this.nukiGet<NukiAccountResponse>('/api/account');
      const latencyMs = Date.now() - start;
      return {
        providerId: 'nuki',
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
        providerId: 'nuki',
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
  // ILockProvider — Commands
  // -----------------------------------------------------------------------

  async executeCommand(
    request: LockCommandRequest,
  ): Promise<HardwareResult<LockCommandResponse>> {
    try {
      await this.executeWithReconnect(async () => {});

      const vendorLockId = request.vendorLockId ?? request.lockId;
      const actionNumberMap: Record<string, number> = {
        unlock: 1,
        lock: 2,
        remote_unlock: 1,
        remote_lockout: 2,
      };

      const action = actionNumberMap[request.commandType];
      if (action == null) {
        return {
          success: false,
          error: `Nuki does not support command type "${request.commandType}".`,
          timestamp: new Date().toISOString(),
        };
      }

      const response = await this.nukiPost<NukiActionResponse>(
        `/smartlock/${vendorLockId}/action`,
        { action, type: 0 }, // type 0 = smartlock
      );

      const nukiStatus = response.lastKnownState?.state;
      const mappedStatus = nukiStatus != null ? NUKI_STATE_MAP[nukiStatus] : undefined;

      const lockCommandResponse: LockCommandResponse = {
        commandId: `nuki-${Date.now()}`,
        lockId: request.lockId,
        vendorLockId,
        success: true,
        statusCode: mappedStatus?.toUpperCase(),
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

      const response = await this.nukiGet<NukiSmartlock[]>('/smartlock');

      const items: LockInfo[] = response.map((sl) => ({
        id: String(sl.smartlockId),
        vendorLockId: String(sl.smartlockId),
        name: sl.name,
        lockStatus: NUKI_STATE_MAP[sl.lastKnownState.state] ?? LockStatus.Unknown,
        batteryLevel: sl.lastKnownState.batteryLevel,
        lastActivity: sl.lastKnownState.timestamp
          ? new Date(sl.lastKnownState.timestamp).toISOString()
          : undefined,
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

      const response = await this.nukiGet<NukiSmartlock>(`/smartlock/${lockId}`);
      const state = response.lastKnownState;

      return {
        success: true,
        data: {
          id: String(response.smartlockId),
          vendorLockId: String(response.smartlockId),
          name: response.name,
          lockStatus: NUKI_STATE_MAP[state.state] ?? LockStatus.Unknown,
          batteryLevel: state.batteryLevel,
          lastActivity: state.timestamp
            ? new Date(state.timestamp).toISOString()
            : undefined,
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

      const response = await this.nukiGet<NukiSmartlock>(`/smartlock/${lockId}`);
      const state = response.lastKnownState;

      return {
        success: true,
        data: {
          lockId: String(response.smartlockId),
          vendorLockId: String(response.smartlockId),
          name: response.name,
          propertyId: this.propertyId,
          batteryLevel: state.batteryLevel,
          status: NUKI_STATE_MAP[state.state] ?? LockStatus.Unknown,
          isConnected: true,
          lastSeenAt: state.timestamp
            ? new Date(state.timestamp).toISOString()
            : null,
          vendorMetadata: {
            firmwareVersion: response.firmwareVersion,
            batteryCritical: state.batteryCritical,
            batteryCharging: state.batteryCharging,
            doorsensorState: state.doorsensorState,
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

      const action = NUKI_ACTION_MAP[request.command];
      if (action == null) {
        return {
          success: false,
          error: `Nuki does not support command "${request.command}".`,
          timestamp: new Date().toISOString(),
        };
      }

      const response = await this.nukiPost<NukiActionResponse>(
        `/smartlock/${request.lockId}/action`,
        { action, type: 0 },
      );

      const nukiStatus = response.lastKnownState?.state;
      const newStatus = nukiStatus != null ? NUKI_STATE_MAP[nukiStatus] : undefined;

      return {
        success: true,
        data: {
          lockId: request.lockId,
          vendorLockId: request.lockId,
          command: request.command,
          accepted: true,
          newStatus,
          processedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'executeLockCommand');
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
          error: 'Nuki access events require a lockId parameter.',
          timestamp: new Date().toISOString(),
        };
      }

      const queryParts: string[] = [];
      if (params.limit) queryParts.push(`limit=${params.limit}`);
      if (params.cursor) queryParts.push(`offset=${params.cursor}`);
      const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

      const response = await this.nukiGet<NukiLogEntry[]>(
        `/smartlock/${params.lockId}/log${qs}`,
      );

      const events: AccessEvent[] = response.map((entry) => {
        // Nuki log type mapping:
        // 1=lock, 2=unlock, 3=unlatch, 4=lockNgo, 5=doorOpened, 6=doorClosed
        const typeToResult: Record<number, AccessResult> = {
          1: AccessResult.AutoLock,
          2: AccessResult.Granted,
          3: AccessResult.Granted,
          4: AccessResult.AutoLock,
          5: AccessResult.Granted,
          6: AccessResult.AutoLock,
        };

        const typeToDirection: Record<number, AccessDirection> = {
          5: AccessDirection.Entry,
          6: AccessDirection.Exit,
        };

        return {
          vendorEventId: String(entry.id),
          lockId: String(entry.lockId),
          vendorLockId: String(entry.lockId),
          timestamp: entry.date,
          direction: typeToDirection[entry.type] ?? AccessDirection.Unknown,
          result: typeToResult[entry.type] ?? AccessResult.Unknown,
          vendorMetadata: { type: entry.type, name: entry.name, trigger: entry.trigger },
        };
      });

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

      const response = await this.nukiGet<NukiSmartlock[]>('/smartlock');

      const locks: LockMetadata[] = response.map((sl) => {
        const state = sl.lastKnownState;
        return {
          lockId: String(sl.smartlockId),
          vendorLockId: String(sl.smartlockId),
          name: sl.name,
          propertyId: this.propertyId,
          batteryLevel: state.batteryLevel,
          status: NUKI_STATE_MAP[state.state] ?? LockStatus.Unknown,
          isConnected: true,
          lastSeenAt: state.timestamp
            ? new Date(state.timestamp).toISOString()
            : null,
          vendorMetadata: {
            firmwareVersion: sl.firmwareVersion,
            type: sl.type,
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

  // Credential methods are NOT_SUPPORTED (Nuki uses app-based provisioning)

  // -----------------------------------------------------------------------
  // HTTP helpers
  // -----------------------------------------------------------------------

  private get baseUrl(): string {
    if (this.useCloudApi) return this.cloudApiUrl;
    if (this.bridgeIp) return `http://${this.bridgeIp}:${this.bridgePort}`;
    return this.cloudApiUrl;
  }

  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.credentials.apiToken}`,
      Accept: 'application/json',
    };
  }

  private async nukiGet<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = mapHttpError(response.status, text);
      throw createHardwareError(detail.code, detail.message, 'nuki');
    }

    return (await response.json()) as T;
  }

  private async nukiPost<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const detail = mapHttpError(response.status, text);
      throw createHardwareError(detail.code, detail.message, 'nuki');
    }

    return (await response.json()) as T;
  }
}
