/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * ILockProvider — contract that every lock adapter must satisfy.
 *
 * This module will be expanded by the lock adapter implementation agent.
 */

import type {
  IHardwareAdapter,
  HardwareAdapterConfig,
  HardwareAdapterCredentials,
  HardwareResult,
  AdapterHealthStatus,
  LockCommandRequest,
  LockCommandResponse,
  PaginatedResult,
} from '../types';

export interface LockInfo {
  id: string;
  vendorLockId?: string;
  name: string;
  roomId?: string;
  doorStatus: string;
  lockStatus: string;
  batteryLevel: number;
  firmwareVersion?: string;
  lastActivity?: string;
}

export interface ILockProvider extends IHardwareAdapter {
  // -------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------

  /** Initialise with the given configuration (called once after creation). */
  initialize(config: HardwareAdapterConfig, credentials: HardwareAdapterCredentials): Promise<void>;

  /** Teardown and release resources. */
  destroy(): Promise<void>;

  // -------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------

  /** Execute a lock command (unlock, lock, issue_key, …). */
  executeCommand(request: LockCommandRequest): Promise<HardwareResult<LockCommandResponse>>;

  // -------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------

  /** List all locks known to this provider for the property. */
  listLocks(cursor?: string, limit?: number): Promise<PaginatedResult<LockInfo>>;

  /** Get details for a single lock. */
  getLock(lockId: string): Promise<HardwareResult<LockInfo>>;

  /** Return an adapter-level health summary including per-lock status. */
  getAdapterHealth(): Promise<{
    status: AdapterHealthStatus;
    message?: string;
    locks: { lockId: string; status: AdapterHealthStatus }[];
  }>;
}

/**
 * Factory type used by the registry to instantiate lock adapters.
 */
export type LockAdapterFactory = (
  config: HardwareAdapterConfig,
  credentials: HardwareAdapterCredentials,
) => ILockProvider;
