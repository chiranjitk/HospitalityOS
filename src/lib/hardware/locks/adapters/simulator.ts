/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * SimulatedLockProvider — fully functional in-memory lock simulator.
 *
 * This is NOT a mock — it provides realistic behaviour including random
 * battery drain, jam rates, configurable latency, and failure injection.
 * Ideal for development, testing, and demos.
 */

import {
  AdapterConnectionState,
  AdapterHealthStatus,
  type AdapterHealth,
  type AdapterInfo,
  type HardwareResult,
  type HardwareAdapterConfig,
  type HardwareAdapterCredentials,
  type HardwareAdapterFactory,
  type LockCommandRequest,
  type LockCommandResponse,
  type PaginatedResult,
  type LockCommandType,
} from '../../types';
import { HardwareErrorCode, createHardwareError } from '../../errors';
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
// SimulatedLock
// ---------------------------------------------------------------------------

interface SimulatedLock {
  vendorLockId: string;
  name: string;
  status: LockStatus;
  batteryLevel: number;
  isConnected: boolean;
  lastSeenAt: string;
  propertyId: string;
  location?: string;
}

// ---------------------------------------------------------------------------
// Simulator config
// ---------------------------------------------------------------------------

interface SimulatorConfig {
  latencyMs?: number;
  failureRate?: number; // 0-1
  jamRate?: number; // 0-1
  lowBatteryRate?: number; // 0-1
  seedLockCount?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `sim-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shouldTrigger(rate: number): boolean {
  return Math.random() < rate;
}

// ---------------------------------------------------------------------------
// SimulatedLockProvider
// ---------------------------------------------------------------------------

export class SimulatedLockProvider extends BaseLockAdapter {
  private simConfig: Required<SimulatorConfig> = {
    latencyMs: 200,
    failureRate: 0,
    jamRate: 0.05,
    lowBatteryRate: 0.02,
    seedLockCount: 10,
  };

  private locks = new Map<string, SimulatedLock>();
  private credentials = new Map<string, LockCredential>();
  private events: AccessEvent[] = [];
  private eventIdCounter = 0;

  // -----------------------------------------------------------------------
  // Adapter metadata
  // -----------------------------------------------------------------------

  getInfo(): AdapterInfo {
    return {
      providerId: 'simulator',
      category: 'lock',
      displayName: 'StaySuite Lock Simulator',
      version: '1.0.0',
      hasSimulation: true,
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

    if (config.configJson && typeof config.configJson === 'string') {
      try {
        const parsed = JSON.parse(config.configJson) as SimulatorConfig;
        if (parsed.latencyMs != null) this.simConfig.latencyMs = parsed.latencyMs;
        if (parsed.failureRate != null) this.simConfig.failureRate = parsed.failureRate;
        if (parsed.jamRate != null) this.simConfig.jamRate = parsed.jamRate;
        if (parsed.lowBatteryRate != null) this.simConfig.lowBatteryRate = parsed.lowBatteryRate;
        if (parsed.seedLockCount != null) this.simConfig.seedLockCount = parsed.seedLockCount;
      } catch {
        // Invalid JSON — use defaults
      }
    } else if (config.configJson && typeof config.configJson === 'object') {
      const parsed = config.configJson as unknown as SimulatorConfig;
      if (parsed.latencyMs != null) this.simConfig.latencyMs = parsed.latencyMs;
      if (parsed.failureRate != null) this.simConfig.failureRate = parsed.failureRate;
      if (parsed.jamRate != null) this.simConfig.jamRate = parsed.jamRate;
      if (parsed.lowBatteryRate != null) this.simConfig.lowBatteryRate = parsed.lowBatteryRate;
      if (parsed.seedLockCount != null) this.simConfig.seedLockCount = parsed.seedLockCount;
    }
  }

  async connect(): Promise<void> {
    if (this.connectionState === AdapterConnectionState.Connected) return;

    this.connectionState = AdapterConnectionState.Connecting;

    await this.simulateDelay();

    this.seedLocks();

    this.connectionState = AdapterConnectionState.Connected;
  }

  async disconnect(): Promise<void> {
    this.connectionState = AdapterConnectionState.Disconnecting;
    await this.simulateDelay();
    this.connectionState = AdapterConnectionState.Disconnected;
  }

  async healthCheck(): Promise<AdapterHealth> {
    const start = Date.now();
    await this.simulateDelay(10, 50);
    const latencyMs = Date.now() - start;

    return {
      providerId: 'simulator',
      propertyId: this.propertyId,
      status: this.isConnected()
        ? AdapterHealthStatus.Healthy
        : AdapterHealthStatus.Disconnected,
      lastHealthyAt: this.isConnected() ? new Date().toISOString() : null,
      lastCheckedAt: new Date().toISOString(),
      message: null,
      consecutiveFailures: 0,
      latencyMs,
    };
  }

  // -----------------------------------------------------------------------
  // Seed
  // -----------------------------------------------------------------------

  private seedLocks(): void {
    this.locks.clear();
    this.events.clear();
    this.credentials.clear();
    this.eventIdCounter = 0;

    const count = this.simConfig.seedLockCount;

    for (let i = 1; i <= count; i++) {
      const roomNumber = 100 + i;
      const vendorLockId = `SIM-LOCK-${String(roomNumber).padStart(4, '0')}`;
      const isLowBattery = shouldTrigger(this.simConfig.lowBatteryRate);
      const batteryLevel = isLowBattery
        ? randomBetween(3, 15)
        : randomBetween(55, 100);

      this.locks.set(vendorLockId, {
        vendorLockId,
        name: `Room ${roomNumber}`,
        status: LockStatus.Locked,
        batteryLevel,
        isConnected: true,
        lastSeenAt: new Date().toISOString(),
        propertyId: this.propertyId || 'prop-sim-1',
        location: `Floor ${Math.ceil(i / 5)}`,
      });
    }
  }

  // -----------------------------------------------------------------------
  // ILockProvider — Commands
  // -----------------------------------------------------------------------

  async executeCommand(
    request: LockCommandRequest,
  ): Promise<HardwareResult<LockCommandResponse>> {
    try {
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      if (shouldTrigger(this.simConfig.failureRate)) {
        return {
          success: false,
          error: 'Simulated vendor failure.',
          timestamp: new Date().toISOString(),
        };
      }

      const lockId = request.lockId;
      const simLock = this.findLockById(lockId);

      if (!simLock) {
        return {
          success: false,
          error: `Lock "${lockId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }

      let newStatus: string | undefined;

      switch (request.commandType) {
        case 'unlock':
          if (shouldTrigger(this.simConfig.jamRate)) {
            simLock.status = LockStatus.Jammed;
            newStatus = LockStatus.Jammed;
            this.recordAccessEvent(simLock, AccessResult.Denied, 'Lock jammed');
            return {
              success: false,
              error: 'Lock jammed — unable to unlock.',
              timestamp: new Date().toISOString(),
              data: {
                commandId: generateId(),
                lockId,
                vendorLockId: simLock.vendorLockId,
                success: false,
                statusCode: 'JAMMED',
                message: 'Lock jammed',
                timestamp: new Date().toISOString(),
              },
            };
          }
          simLock.status = LockStatus.Unlocked;
          newStatus = LockStatus.Unlocked;
          this.recordAccessEvent(simLock, AccessResult.RemoteUnlock, request.correlationId);
          break;

        case 'lock':
          simLock.status = LockStatus.Locked;
          newStatus = LockStatus.Locked;
          this.recordAccessEvent(simLock, AccessResult.AutoLock, request.correlationId);
          break;

        case 'issue_key':
          // Handled by createCredential; still return success
          break;

        case 'revoke_key':
          break;

        case 'get_status':
          newStatus = simLock.status;
          break;

        case 'get_battery':
          break;

        default:
          break;
      }

      simLock.lastSeenAt = new Date().toISOString();

      const response: LockCommandResponse = {
        commandId: generateId(),
        lockId,
        vendorLockId: simLock.vendorLockId,
        success: true,
        statusCode: newStatus?.toUpperCase(),
        message: `Command "${request.commandType}" executed successfully.`,
        timestamp: new Date().toISOString(),
      };

      return { success: true, data: response, timestamp: new Date().toISOString() };
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
    const allLocks = Array.from(this.locks.values());
    const items: LockInfo[] = allLocks.map((sl) => this.toLockInfo(sl));
    const sliced = items.slice(0, limit);
    return {
      items: sliced,
      nextCursor: items.length > limit ? String(limit) : null,
      hasMore: items.length > limit,
      total: allLocks.length,
    };
  }

  async getLock(lockId: string): Promise<HardwareResult<LockInfo>> {
    try {
      const simLock = this.findLockById(lockId);
      if (!simLock) {
        return {
          success: false,
          error: `Lock "${lockId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }
      return {
        success: true,
        data: this.toLockInfo(simLock),
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
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      const simLock = this.findLockById(lockId);
      if (!simLock) {
        return {
          success: false,
          error: `Lock "${lockId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }

      // 2% chance of low battery event
      if (shouldTrigger(this.simConfig.lowBatteryRate)) {
        simLock.batteryLevel = randomBetween(3, 12);
        simLock.status = LockStatus.LowBattery;
      }

      return {
        success: true,
        data: this.toLockMetadata(simLock),
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
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      if (shouldTrigger(this.simConfig.failureRate)) {
        return {
          success: false,
          error: 'Simulated vendor failure.',
          timestamp: new Date().toISOString(),
        };
      }

      const simLock = this.findLockById(request.lockId);
      if (!simLock) {
        return {
          success: false,
          error: `Lock "${request.lockId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }

      const handleJam = (): HardwareResult<LockDomainCommandResponse> => {
        simLock.status = LockStatus.Jammed;
        simLock.lastSeenAt = new Date().toISOString();
        this.recordAccessEvent(simLock, AccessResult.Denied, 'Lock jammed');
        return {
          success: false,
          error: 'Lock jammed — unable to execute command.',
          timestamp: new Date().toISOString(),
          data: {
            lockId: request.lockId,
            vendorLockId: simLock.vendorLockId,
            command: request.command,
            accepted: false,
            newStatus: LockStatus.Jammed,
            processedAt: new Date().toISOString(),
          },
        };
      };

      switch (request.command) {
        case LockCommand.Unlock:
          if (shouldTrigger(this.simConfig.jamRate)) return handleJam();
          simLock.status = LockStatus.Unlocked;
          this.recordAccessEvent(simLock, AccessResult.RemoteUnlock, `initiated by ${request.initiatedBy}`);
          break;

        case LockCommand.Lock:
          simLock.status = LockStatus.Locked;
          this.recordAccessEvent(simLock, AccessResult.AutoLock, `initiated by ${request.initiatedBy}`);
          break;

        case LockCommand.TimedUnlock: {
          if (shouldTrigger(this.simConfig.jamRate)) return handleJam();
          simLock.status = LockStatus.Unlocked;
          this.recordAccessEvent(simLock, AccessResult.RemoteUnlock, `Timed unlock by ${request.initiatedBy}`);
          // Auto re-lock after duration
          const duration = request.durationSeconds ?? 30;
          setTimeout(() => {
            if (simLock.status === LockStatus.Unlocked) {
              simLock.status = LockStatus.Locked;
              simLock.lastSeenAt = new Date().toISOString();
              this.recordAccessEvent(simLock, AccessResult.AutoLock, 'Auto re-lock after timed unlock');
            }
          }, Math.min(duration * 100, 5000)); // Cap at 5s for simulation
          break;
        }

        case LockCommand.EmergencyUnlock:
          simLock.status = LockStatus.Unlocked;
          this.recordAccessEvent(simLock, AccessResult.RemoteUnlock, `EMERGENCY unlock by ${request.initiatedBy}`);
          break;

        case LockCommand.PrivacyMode:
          simLock.status = LockStatus.Locked;
          this.recordAccessEvent(simLock, AccessResult.Denied, `Privacy mode enabled by ${request.initiatedBy}`);
          break;

        case LockCommand.UpdateSchedule:
          break;
      }

      simLock.lastSeenAt = new Date().toISOString();

      const response: LockDomainCommandResponse = {
        lockId: request.lockId,
        vendorLockId: simLock.vendorLockId,
        command: request.command,
        accepted: true,
        newStatus: simLock.status,
        processedAt: new Date().toISOString(),
      };

      return { success: true, data: response, timestamp: new Date().toISOString() };
    } catch (err) {
      return this.wrapError(err, 'executeLockCommand');
    }
  }

  async createCredential(
    credential: Omit<LockCredential, 'id' | 'vendorCredentialId'>,
  ): Promise<HardwareResult<LockCredential>> {
    try {
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      const id = generateId();
      const vendorCredentialId = `SIM-CRED-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const created: LockCredential = {
        ...credential,
        id,
        vendorCredentialId,
      };

      this.credentials.set(id, created);

      return { success: true, data: created, timestamp: new Date().toISOString() };
    } catch (err) {
      return this.wrapError(err, 'createCredential');
    }
  }

  async deleteCredential(credentialId: string): Promise<HardwareResult<void>> {
    try {
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      // Find by internal id or vendor credential id
      let found = false;
      for (const [key, cred] of this.credentials) {
        if (key === credentialId || cred.vendorCredentialId === credentialId) {
          this.credentials.delete(key);
          found = true;
          break;
        }
      }

      if (!found) {
        return {
          success: false,
          error: `Credential "${credentialId}" not found.`,
          timestamp: new Date().toISOString(),
        };
      }

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
      const credResult = await this.createCredential({
        lockIds: params.lockIds,
        type: (params.credentialType as CredentialType) ?? CredentialType.MobileKey,
        label: `Guest ${params.guestId} key`,
        validFrom: params.validFrom ?? new Date().toISOString(),
        validUntil: params.validUntil ?? null,
        maxUses: null,
        guestId: params.guestId,
        bookingId: params.bookingId,
      });

      if (!credResult.success || !credResult.data) return credResult;

      // Optionally auto-unlock all target locks
      for (const lockId of params.lockIds) {
        const simLock = this.findLockById(lockId);
        if (simLock && simLock.status === LockStatus.Locked) {
          if (!shouldTrigger(this.simConfig.jamRate)) {
            simLock.status = LockStatus.Unlocked;
            simLock.lastSeenAt = new Date().toISOString();
            this.recordAccessEvent(simLock, AccessResult.Granted, `Access granted to guest ${params.guestId}`);
          }
        }
      }

      return credResult;
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
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      let removed = 0;

      for (const [key, cred] of this.credentials) {
        if (cred.guestId === params.guestId) {
          if (params.lockIds && params.lockIds.length > 0) {
            // Only revoke for specified locks
            cred.lockIds = cred.lockIds.filter((id) => !params.lockIds!.includes(id));
            if (cred.lockIds.length === 0) {
              this.credentials.delete(key);
            }
          } else {
            this.credentials.delete(key);
          }
          removed++;
        }
      }

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
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
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      let filtered = [...this.events];

      if (params?.lockId) {
        filtered = filtered.filter((e) => e.lockId === params.lockId);
      }

      if (params?.from) {
        const fromTime = new Date(params.from).getTime();
        filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= fromTime);
      }

      if (params?.to) {
        const toTime = new Date(params.to).getTime();
        filtered = filtered.filter((e) => new Date(e.timestamp).getTime() <= toTime);
      }

      // Sort newest first
      filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const limit = params?.limit ?? 50;
      const offset = params?.cursor ? parseInt(params.cursor, 10) || 0 : 0;
      const sliced = filtered.slice(offset, offset + limit);

      return {
        success: true,
        data: {
          items: sliced,
          nextCursor: offset + limit < filtered.length ? String(offset + limit) : null,
          hasMore: offset + limit < filtered.length,
          total: filtered.length,
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
      await this.executeWithReconnect(async () => {
        await this.simulateDelay();
      });

      const locks: LockMetadata[] = Array.from(this.locks.values()).map((sl) =>
        this.toLockMetadata(sl),
      );

      return {
        success: true,
        data: {
          locks,
          removedVendorLockIds: [],
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return this.wrapError(err, 'discoverLocks');
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private findLockById(lockId: string): SimulatedLock | null {
    // Try vendor lock id first
    const byVendor = this.locks.get(lockId);
    if (byVendor) return byVendor;

    // Try by name matching or internal id
    for (const lock of this.locks.values()) {
      if (lock.name === lockId || lock.vendorLockId === lockId) {
        return lock;
      }
    }
    return null;
  }

  private recordAccessEvent(
    simLock: SimulatedLock,
    result: AccessResult,
    reason?: string,
  ): void {
    this.eventIdCounter++;
    const event: AccessEvent = {
      vendorEventId: `SIM-EVT-${this.eventIdCounter}`,
      lockId: simLock.vendorLockId,
      vendorLockId: simLock.vendorLockId,
      timestamp: new Date().toISOString(),
      direction: result === AccessResult.AutoLock ? AccessDirection.Exit : AccessDirection.Entry,
      result,
      denialReason: result === AccessResult.Denied ? reason : undefined,
    };
    this.events.push(event);
  }

  private toLockInfo(simLock: SimulatedLock): LockInfo {
    return {
      id: simLock.vendorLockId,
      vendorLockId: simLock.vendorLockId,
      name: simLock.name,
      roomId: simLock.location,
      doorStatus: simLock.status === LockStatus.Locked ? 'closed' : 'open',
      lockStatus: simLock.status,
      batteryLevel: simLock.batteryLevel,
      lastActivity: simLock.lastSeenAt,
    };
  }

  private toLockMetadata(simLock: SimulatedLock): LockMetadata {
    return {
      lockId: simLock.vendorLockId,
      vendorLockId: simLock.vendorLockId,
      name: simLock.name,
      location: simLock.location,
      propertyId: simLock.propertyId,
      batteryLevel: simLock.batteryLevel,
      status: simLock.status,
      isConnected: simLock.isConnected,
      lastSeenAt: simLock.lastSeenAt,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const createSimulatedLockProvider: HardwareAdapterFactory<SimulatedLockProvider> = (
  config,
  credentials,
) => {
  const provider = new SimulatedLockProvider();
  void provider.initialize(config, credentials);
  return provider;
};
