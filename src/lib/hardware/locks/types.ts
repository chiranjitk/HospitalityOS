/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * Lock-specific domain types used across all lock adapters.
 */

// ---------------------------------------------------------------------------
// ID aliases
// ---------------------------------------------------------------------------

export type LockId = string;
export type VendorLockId = string;

// ---------------------------------------------------------------------------
// LockStatus
// ---------------------------------------------------------------------------

export enum LockStatus {
  Locked = 'locked',
  Unlocked = 'unlocked',
  Transitioning = 'transitioning',
  Jammed = 'jammed',
  LowBattery = 'low_battery',
  Offline = 'offline',
  Updating = 'updating',
  Unknown = 'unknown',
}

// ---------------------------------------------------------------------------
// LockMetadata
// ---------------------------------------------------------------------------

export interface LockMetadata {
  lockId: LockId;
  vendorLockId: VendorLockId;
  name: string;
  location?: string;
  propertyId: string;
  batteryLevel: number | null; // 0-100 or null if unknown
  status: LockStatus;
  isConnected: boolean;
  lastSeenAt: string | null; // ISO-8601
  vendorMetadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// CredentialType
// ---------------------------------------------------------------------------

export enum CredentialType {
  RfidCard = 'rfid_card',
  RfidFob = 'rfid_fob',
  MobileKey = 'mobile_key',
  PinCode = 'pin_code',
  MechanicalKey = 'mechanical_key',
  Biometric = 'biometric',
  Remote = 'remote',
  DigitalKey = 'digital_key',
}

// ---------------------------------------------------------------------------
// LockCredential
// ---------------------------------------------------------------------------

export interface LockCredential {
  id?: string;
  vendorCredentialId?: string;
  lockIds: LockId[];
  type: CredentialType;
  label?: string;
  validFrom: string; // ISO-8601
  validUntil: string | null; // ISO-8601
  maxUses: number | null;
  pinCode?: string;
  rfidUid?: string;
  guestId?: string;
  bookingId?: string;
  vendorMetadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// AccessDirection
// ---------------------------------------------------------------------------

export enum AccessDirection {
  Entry = 'entry',
  Exit = 'exit',
  Unknown = 'unknown',
}

// ---------------------------------------------------------------------------
// AccessResult
// ---------------------------------------------------------------------------

export enum AccessResult {
  Granted = 'granted',
  Denied = 'denied',
  RemoteUnlock = 'remote_unlock',
  AutoLock = 'auto_lock',
}

// ---------------------------------------------------------------------------
// AccessEvent
// ---------------------------------------------------------------------------

export interface AccessEvent {
  vendorEventId: string;
  lockId: LockId;
  vendorLockId: VendorLockId;
  timestamp: string; // ISO-8601
  direction: AccessDirection;
  result: AccessResult;
  credential?: LockCredential;
  guestId?: string;
  denialReason?: string;
  vendorMetadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// LockCommand
// ---------------------------------------------------------------------------

export enum LockCommand {
  Lock = 'lock',
  Unlock = 'unlock',
  TimedUnlock = 'timed_unlock',
  UpdateSchedule = 'update_schedule',
  PrivacyMode = 'privacy_mode',
  EmergencyUnlock = 'emergency_unlock',
}

// ---------------------------------------------------------------------------
// LockCommandRequest — lock-domain command request
// ---------------------------------------------------------------------------

export interface LockDomainCommandRequest {
  lockId: LockId;
  command: LockCommand;
  durationSeconds?: number;
  schedule?: Record<string, unknown>;
  reason?: string;
  initiatedBy: string;
}

// ---------------------------------------------------------------------------
// LockCommandResponse — lock-domain command response
// ---------------------------------------------------------------------------

export interface LockDomainCommandResponse {
  lockId: LockId;
  vendorLockId: VendorLockId;
  command: LockCommand;
  accepted: boolean;
  newStatus?: LockStatus;
  vendorMetadata?: Record<string, unknown>;
  processedAt: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// LockDiscoveryResult
// ---------------------------------------------------------------------------

export interface LockDiscoveryResult {
  locks: LockMetadata[];
  removedVendorLockIds: VendorLockId[];
}

// ---------------------------------------------------------------------------
// LockSyncOptions
// ---------------------------------------------------------------------------

export interface LockSyncOptions {
  fullSync?: boolean;
  autoCreate?: boolean;
  autoDeactivate?: boolean;
}
