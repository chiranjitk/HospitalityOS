/**
 * Cron: Device Cleanup
 *
 * POST /api/cron/device-cleanup
 *   Deletes stale WiFiDevice records (devices not seen within the configured
 *   cleanup threshold, where the guest has checked out).
 *
 * GET /api/cron/device-cleanup
 *   Returns dry-run count of devices that would be cleaned up.
 *
 * Recommended schedule: Daily (e.g., 0 4 * * *)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const CRON_SECRET = process.env.CRON_SECRET;

/** Verify the x-cron-secret header */
function verifySecret(request: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const secret = request.headers.get('x-cron-secret');
  return secret === CRON_SECRET;
}

const DEFAULT_CLEANUP_DAYS = 30;

/** Get autoCleanupDays from settings or fall back to default */
async function getCleanupDays(): Promise<number> {
  try {
    const settings = await (db as any).wiFiDeviceSettings?.findFirst?.({
      where: { autoCleanupDays: { gt: 0 } },
      select: { autoCleanupDays: true },
      orderBy: { createdAt: 'desc' },
    });
    if (settings?.autoCleanupDays) return settings.autoCleanupDays;
  } catch {
    // Table doesn't exist — use default
  }
  return DEFAULT_CLEANUP_DAYS;
}

// ---------------------------------------------------------------------------
// POST — Execute the cleanup
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    if (!verifySecret(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Dynamic import
    const { cleanupStaleDevices } = await import(
      '@/lib/wifi/services/device-cleanup'
    );

    const result = await cleanupStaleDevices();

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.deleted} stale devices`,
      data: result,
    });
  } catch (error) {
    console.error('[Cron:device-cleanup] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clean up stale devices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — Dry-run count
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    if (!verifySecret(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    const autoCleanupDays = await getCleanupDays();
    const cutoffDate = new Date(
      now.getTime() - autoCleanupDays * 24 * 60 * 60 * 1000
    );
    const veryStaleCutoff = new Date(
      now.getTime() - autoCleanupDays * 2 * 24 * 60 * 60 * 1000
    );

    // Count all stale devices
    const totalStale = await db.wiFiDevice.count({
      where: { lastSeen: { lt: cutoffDate } },
    });

    // Fetch to check active stays
    const staleDevices = await db.wiFiDevice.findMany({
      where: { lastSeen: { lt: cutoffDate } },
      select: {
        id: true,
        tenantId: true,
        lastSeen: true,
        guest: {
          select: {
            stays: {
              where: {
                status: { in: ['confirmed', 'in_house'] },
                checkOut: { gte: now },
              },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    let wouldDelete = 0;
    const byTenant: Record<string, number> = {};

    for (const device of staleDevices) {
      const hasActiveStay =
        device.guest?.stays && device.guest.stays.length > 0;
      const isVeryStale = device.lastSeen < veryStaleCutoff;

      if (!hasActiveStay || isVeryStale) {
        wouldDelete++;
        byTenant[device.tenantId] = (byTenant[device.tenantId] || 0) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalStale,
        wouldDelete,
        skippedDueToActiveStay: totalStale - wouldDelete,
        cleanupThresholdDays: autoCleanupDays,
        byTenant,
      },
    });
  } catch (error) {
    console.error('[Cron:device-cleanup] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch device cleanup stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
