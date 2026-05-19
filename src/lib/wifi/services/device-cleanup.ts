/**
 * Device Cleanup Service
 *
 * Deletes stale WiFiDevice records based on cleanup settings. A device is
 * considered stale when its `lastSeen` timestamp is older than the configured
 * `autoCleanupDays` threshold (default 30 days).
 *
 * Only devices whose associated guest has checked out (no active booking) or
 * where the device has not been seen for a very long time are cleaned up,
 * protecting devices belonging to in-house guests.
 */

import { db } from '@/lib/db';

export interface DeviceCleanupResult {
  deleted: number;
  byTenant: Record<string, number>;
}

const DEFAULT_CLEANUP_DAYS = 30;
const BATCH_SIZE = 100;

/**
 * Clean up stale WiFiDevice records.
 *
 * Strategy:
 * 1. Determine `autoCleanupDays` — queries WiFiDeviceSettings if available,
 *    otherwise falls back to the default (30 days).
 * 2. Find devices whose `lastSeen` is older than the threshold.
 * 3. Among those, only delete devices where the associated guest has no
 *    active (confirmed / in-house) booking, OR the device hasn't been seen
 *    in more than 2x the cleanup threshold (very stale).
 * 4. Delete in batches of 100 to keep transactions manageable.
 */
export async function cleanupStaleDevices(): Promise<DeviceCleanupResult> {
  const now = new Date();

  // -------------------------------------------------------------------------
  // 1. Try to read autoCleanupDays from settings (table may not exist)
  // -------------------------------------------------------------------------
  let autoCleanupDays = DEFAULT_CLEANUP_DAYS;

  try {
    // Attempt to query settings — gracefully degrade if model/table absent
    const settings = await (db as any).wiFiDeviceSettings?.findFirst?.({
      where: { autoCleanupDays: { gt: 0 } },
      select: { autoCleanupDays: true },
      orderBy: { createdAt: 'desc' },
    });

    if (settings?.autoCleanupDays) {
      autoCleanupDays = settings.autoCleanupDays;
    }
  } catch {
    // WiFiDeviceSettings table doesn't exist — use default
  }

  const cutoffDate = new Date(
    now.getTime() - autoCleanupDays * 24 * 60 * 60 * 1000
  );

  // "Very stale" threshold — 2x the cleanup days, for force-cleanup
  const veryStaleCutoff = new Date(
    now.getTime() - autoCleanupDays * 2 * 24 * 60 * 60 * 1000
  );

  // -------------------------------------------------------------------------
  // 2. Find stale device IDs grouped by tenant
  // -------------------------------------------------------------------------
  const staleDevices = await db.wiFiDevice.findMany({
    where: {
      lastSeen: { lt: cutoffDate },
    },
    select: {
      id: true,
      tenantId: true,
      guestId: true,
      lastSeen: true,
      guest: {
        select: {
          stays: {
            select: {
              booking: {
                select: {
                  status: true,
                  checkOut: true,
                },
              },
            },
            take: 5,
          },
        },
      },
    },
  });

  const idsToDelete: string[] = [];
  const byTenant: Record<string, number> = {};

  for (const device of staleDevices) {
    // Guest has active booking if any linked stay has a booking with
    // confirmed/checked_in status AND checkOut in the future
    const hasActiveStay =
      device.guest?.stays?.some(
        (stay: any) =>
          stay.booking &&
          ['confirmed', 'checked_in'].includes(stay.booking.status) &&
          new Date(stay.booking.checkOut) >= now
      );
    const isVeryStale = device.lastSeen < veryStaleCutoff;

    // Only delete if guest has checked out OR device is very stale
    if (!hasActiveStay || isVeryStale) {
      idsToDelete.push(device.id);
      byTenant[device.tenantId] = (byTenant[device.tenantId] || 0) + 1;
    }
  }

  // -------------------------------------------------------------------------
  // 3. Delete in batches
  // -------------------------------------------------------------------------
  let deleted = 0;

  for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
    const batch = idsToDelete.slice(i, i + BATCH_SIZE);
    const result = await db.wiFiDevice.deleteMany({
      where: { id: { in: batch } },
    });
    deleted += result.count;
  }

  console.log(
    `[DeviceCleanup] Deleted ${deleted} stale devices (threshold: ${autoCleanupDays}d) across ${Object.keys(byTenant).length} tenant(s)`
  );

  return { deleted, byTenant };
}
