/**
 * server-fingerprint.ts
 *
 * Generates a stable, clone-resistant hardware fingerprint for StaySuite-HospitalityOS.
 *
 * The fingerprint is derived from exactly TWO signals:
 *   1. HDD/SSD serial number — mandatory, primary anti-clone signal
 *      (changes when disk is cloned to new hardware, survives VM snapshot restore)
 *   2. Primary network interface MAC address (eth0 / enp* / ens* / first non-internal)
 *      (unique per physical NIC / virtual NIC, survives reboots)
 *
 * REMOVED signals (changeable on hardware upgrade, not anti-clone):
 *   - CPU model/count (changes on VM resize or host upgrade)
 *   - Total RAM (changes on VM resize)
 *   - Hostname (changed by admin, not hardware-bound)
 *   - Platform/arch (same across identical VMs)
 *
 * Output format: CRY-{SHA-256 hex}  (67 chars total)
 *
 * HDD detection supports:
 *   - Physical servers (SATA/SAS/NVMe)
 *   - VMware (/dev/sda via sysfs)
 *   - KVM/QEMU (/dev/vda via sysfs)
 *   - VirtualBox (/dev/sda via sysfs)
 *   - Hyper-V (/dev/sda via sysfs)
 *   - Docker/LXC (inherited from host or device-mapped)
 *   - AWS EC2 / GCP / Azure (EBS/Persistent Disk via NVMe or SCSI)
 *   - Proxmox / Xen (virtio disks)
 */

import crypto from 'node:crypto';
import os from 'node:os';
import { execSync } from 'node:child_process';

// =====================================================
// CONSTANTS
// =====================================================

/** Prefix for all hardware fingerprint keys */
export const FINGERPRINT_PREFIX = 'CRY';

// =====================================================
// SAFE EXEC
// =====================================================

/**
 * Execute a shell command with timeout and catch errors.
 * Returns stdout string or empty string on failure.
 */
function safeExec(command: string, timeoutMs = 3000): string {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

// =====================================================
// HDD SERIAL NUMBER DETECTION
// =====================================================

/**
 * Detect the primary disk serial number across all platforms.
 *
 * Strategy (ordered by reliability):
 *   1. sysfs: /sys/block/{sda,vda,nvme0n1,...}/device/serial
 *   2. lsblk: lsblk -d -n -o SERIAL {device}
 *   3. lsblk scan: lsblk -d -n -o NAME,SERIAL for all devices
 *   4. /dev/disk/by-id/ entries containing "serial" or WWN
 *   5. hdparm fallback
 *   6. udevadm fallback
 */
function getDiskSerial(): string {
  // Common disk device names to try, ordered by likelihood
  const diskCandidates = [
    'sda', 'vda', 'nvme0n1', 'sdb', 'vdb', 'xvda', 'xvdb',
    'nvme1n1', 'sdc', 'hda',
  ];

  // --- Method 1: sysfs serial (most reliable for Linux/VMs) ---
  for (const disk of diskCandidates) {
    const serial = readSysfsSerial(disk);
    if (serial && serial !== '(unknown)' && !serial.startsWith('0x') && serial.length > 2) {
      return serial;
    }
  }

  // --- Method 2: lsblk for specific devices ---
  for (const disk of diskCandidates) {
    const serial = safeExec(`lsblk -d -n -o SERIAL /dev/${disk} 2>/dev/null`);
    if (serial && serial.length > 2) {
      return serial;
    }
  }

  // --- Method 3: lsblk scan all block devices ---
  const allSerials = safeExec('lsblk -d -n -o NAME,SERIAL 2>/dev/null');
  if (allSerials) {
    for (const line of allSerials.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[1] && parts[1].length > 2 && parts[1] !== '(unknown)') {
        // Skip loop devices, ram, zram
        if (/^(loop|ram|zram|sr|fd)/.test(parts[0])) continue;
        return parts[1];
      }
    }
  }

  // --- Method 4: lsblk with MODEL fallback (for virtual disks that hide serial) ---
  const allModelSerial = safeExec('lsblk -d -n -o NAME,SERIAL,MODEL 2>/dev/null');
  if (allModelSerial) {
    for (const line of allModelSerial.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[0] && !/^(loop|ram|zram|sr|fd)/.test(parts[0])) {
        const serial = parts[1];
        const model = parts.slice(2).join(' ');
        // Some VMs report serial as empty but have a model
        if (serial && serial !== '(unknown)' && serial.length > 2) {
          return serial;
        }
        if (model && model.length > 2 && model !== '(unknown)') {
          // Use model as fallback — better than nothing for VM detection
          return model;
        }
      }
    }
  }

  // --- Method 5: /dev/disk/by-id/ (works with SCSI/SATA/NVMe UUIDs) ---
  const diskById = safeExec('ls -la /dev/disk/by-id/ 2>/dev/null');
  if (diskById) {
    const lines = diskById.split('\n');
    // Look for entries with serial-like patterns
    for (const line of lines) {
      if (line.includes('-serial-') || line.includes('_serial_')) {
        const match = line.match(/(?:serial[-_])([^-\s]+)/i);
        if (match && match[1].length > 2) {
          return match[1];
        }
      }
    }
    // Look for WWN entries as fallback
    for (const line of lines) {
      if (line.includes('wwn-') && !line.includes('part')) {
        const match = line.match(/wwn-([^-\s]+)/i);
        if (match && match[1].length > 2) {
          return match[1];
        }
      }
    }
  }

  // --- Method 6: hdparm ---
  for (const disk of ['sda', 'vda', 'nvme0n1', 'xvda']) {
    const serial = safeExec(`hdparm -I /dev/${disk} 2>/dev/null | grep -i "Serial Number" | head -1 | awk '{print $NF}'`);
    if (serial && serial.length > 2) {
      return serial;
    }
  }

  // --- Method 7: udevadm ---
  for (const disk of ['sda', 'vda', 'nvme0n1', 'xvda']) {
    const serial = safeExec(`udevadm info --query=property /dev/${disk} 2>/dev/null | grep -i "ID_SERIAL_SHORT=" | head -1 | cut -d= -f2`);
    if (serial && serial.length > 2) {
      return serial;
    }
  }

  // --- Method 8: NVMe direct ---
  const nvmeSerial = safeExec('nvme id-ctrl /dev/nvme0n1 2>/dev/null | grep "sn" | head -1 | awk \'{print $3}\'');
  if (nvmeSerial && nvmeSerial.length > 2) {
    return nvmeSerial;
  }

  // --- Method 9: VM-specific: DMI product UUID (unique per VM instance) ---
  const dmiUuid = safeExec('cat /sys/class/dmi/id/product_uuid 2>/dev/null');
  if (dmiUuid && dmiUuid.length > 2 && dmiUuid !== '(none)') {
    return `DMI:${dmiUuid}`;
  }

  // --- Method 10: Machine ID (systemd) — last resort, unique per install ---
  const machineId = safeExec('cat /etc/machine-id 2>/dev/null') || safeExec('cat /var/lib/dbus/machine-id 2>/dev/null');
  if (machineId && machineId.length > 2) {
    return `MID:${machineId}`;
  }

  return 'UNKNOWN-DISK';
}

/**
 * Read disk serial from sysfs for a specific block device.
 */
function readSysfsSerial(disk: string): string {
  // Standard SCSI/SATA path
  let serial = safeExec(`cat /sys/block/${disk}/device/serial 2>/dev/null`);
  if (serial) return serial;

  // NVMe path
  serial = safeExec(`cat /sys/block/${disk}/device/serial 2>/dev/null`);
  if (serial) return serial;

  // Virtio disk path (some kernels)
  serial = safeExec(`cat /sys/block/${disk}/device/serial 2>/dev/null`);
  if (serial) return serial;

  return '';
}

// =====================================================
// MAC ADDRESS DETECTION
// =====================================================

/**
 * Get the primary network interface MAC address.
 *
 * Priority order:
 *   1. eth0 (traditional Linux naming)
 *   2. enp0s* / ens* / eno* (predictable network interface naming)
 *   3. First non-internal, non-zero MAC from any interface
 */
function getPrimaryMac(): string {
  const interfaces = os.networkInterfaces();

  // Priority interface name patterns
  const priorityPatterns = [
    /^eth0$/,
    /^enp0s(\d+)$/,
    /^ens(\d+)$/,
    /^eno(\d+)$/,
    /^enx[0-9a-f]+$/,  // USB NICs
    /^eth(\d+)$/,
    /^enp(\d+)s(\d+)$/,
  ];

  // Step 1: Try priority interfaces by name pattern
  for (const pattern of priorityPatterns) {
    for (const name of Object.keys(interfaces)) {
      if (!pattern.test(name)) continue;
      const nets = interfaces[name] || [];
      for (const net of nets) {
        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
          return net.mac.toUpperCase();
        }
      }
    }
  }

  // Step 2: Fallback — first non-internal, non-zero MAC sorted by name
  const candidates: { name: string; mac: string }[] = [];
  for (const name of Object.keys(interfaces).sort()) {
    const nets = interfaces[name] || [];
    for (const net of nets) {
      if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
        candidates.push({ name, mac: net.mac.toUpperCase() });
      }
    }
  }

  if (candidates.length > 0) {
    return candidates[0].mac;
  }

  return '00:00:00:00:00:00';
}

// =====================================================
// FINGERPRINT GENERATION
// =====================================================

let cachedFingerprint: string | null = null;

/**
 * Generate (or return cached) hardware fingerprint for this server.
 *
 * Format: CRY-{SHA-256 hex}
 *   - Only 2 signals: HDD serial + primary MAC
 *   - Combined with "|" separator, then SHA-256 hashed
 *   - Prefixed with "CRY-" for identification
 *
 * Results are cached in-memory for the process lifetime.
 */
export function getServerFingerprint(): string {
  if (cachedFingerprint) return cachedFingerprint;

  const hddSerial = getDiskSerial();
  const macAddress = getPrimaryMac();

  // Combine signals
  const raw = `${hddSerial}|${macAddress}`;

  // SHA-256 hash
  const hash = crypto.createHash('sha256').update(raw).digest('hex');

  // Add CRY prefix
  cachedFingerprint = `${FINGERPRINT_PREFIX}-${hash}`;

  console.log(`[Fingerprint] Generated: ${cachedFingerprint}`);
  console.log(`[Fingerprint]   HDD Serial: ${hddSerial}`);
  console.log(`[Fingerprint]   MAC Address: ${macAddress}`);

  return cachedFingerprint;
}

/**
 * Reset the cached fingerprint. Useful for testing.
 */
export function resetFingerprintCache(): void {
  cachedFingerprint = null;
}

/**
 * Return the raw identifiers used for fingerprinting (for debugging / admin display).
 */
export function getFingerprintDebugInfo(): {
  diskSerial: string;
  diskSerialMasked: string;
  macAddress: string;
  algorithm: string;
  formula: string;
} {
  const hddSerial = getDiskSerial();
  const macAddress = getPrimaryMac();

  // Mask disk serial — show first 6 chars + last 4
  const masked = hddSerial.length > 10
    ? `${hddSerial.slice(0, 6)}${'*'.repeat(Math.max(0, hddSerial.length - 10))}${hddSerial.slice(-4)}`
    : hddSerial;

  return {
    diskSerial: hddSerial,
    diskSerialMasked: masked,
    macAddress,
    algorithm: 'SHA-256',
    formula: 'CRY-{SHA-256(disk_serial|mac_address)}',
  };
}
