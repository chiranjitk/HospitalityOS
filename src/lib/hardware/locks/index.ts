/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * Lock adapters barrel export.
 */

// Lock-specific domain types
export {
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
} from './types';

// ILockProvider interface
export { type ILockProvider, type LockInfo, type LockAdapterFactory } from './lock-provider';

// Base adapter class
export { BaseLockAdapter } from './base-lock-adapter';

// Adapter factory
export { createLockAdapter, lockAdapterFactoryMap } from './adapters/index';

// Individual adapters (available for direct import when needed)
export { SimulatedLockProvider, createSimulatedLockProvider } from './adapters/simulator';
export { AssaAbloyVisionlineAdapter } from './adapters/assa-abloy-visionline';
export { SaltoKSAdapter } from './adapters/salto-ks';
export { NukiAdapter } from './adapters/nuki';
export { SeamAdapter } from './adapters/seam';
export { DormakabaAdapter } from './adapters/dormakaba';
