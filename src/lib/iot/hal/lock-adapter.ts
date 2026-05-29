/**
 * L-27: IoT HAL — Lock Adapter Interface
 *
 * TODO(L-27): Implement concrete lock adapter classes.
 *
 * This module defines the contract for smart lock IoT adapters.
 * Existing lock implementations live in src/lib/hardware/locks/adapters/
 * (Nuki, Assa Abloy VisionLine, Salto KS, Seam, Dormakaba, Simulator).
 *
 * To integrate a new lock vendor:
 *
 * 1. Create a class extending BaseIoTAdapter (from ./index.ts)
 * 2. Implement getInfo() returning { category: 'lock', providerId: '<vendor>' }
 * 3. Implement connect() with vendor-specific authentication
 * 4. Implement executeCommand() mapping lock/unlock/status to vendor API calls
 * 5. Implement getDeviceState() to query current lock state (locked/unlocked/jammed)
 * 6. Implement discoverDevices() to enumerate locks from vendor API
 * 7. Handle credential provisioning if supported (mobile keys, PIN codes, RFID)
 * 8. Implement webhook signature verification for real-time status updates
 *
 * Reference implementation: src/lib/hardware/locks/adapters/nuki.ts (Nuki API)
 *
 * Commands to support:
 *   - lock:       Lock the door
 *   - unlock:     Unlock the door
 *   - status:     Query current lock state
 *   - timed_unlock: Unlock for a specific duration then re-lock
 *   - emergency_unlock: Immediate unlock for emergency access
 */

// Lock-specific state constants
export const LockState = {
  LOCKED: 'locked',
  UNLOCKED: 'unlocked',
  JAMMED: 'jammed',
  UNKNOWN: 'unknown',
  LOW_BATTERY: 'low_battery',
} as const;

// TODO(L-27): Add LockAdapter class extending BaseIoTAdapter with lock-specific methods
// TODO(L-27): Add createLockAdapter factory function for adapter registry
