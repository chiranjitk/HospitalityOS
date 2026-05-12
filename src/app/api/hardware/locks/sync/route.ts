import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { hardwareRegistry } from '@/lib/hardware';
import type { HardwareProviderId, HardwareCategory } from '@/lib/hardware/types';
import type { LockMetadata, LockStatus } from '@/lib/hardware/locks/types';

// ---------------------------------------------------------------------------
// POST — Sync locks from vendor
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    if (
      !hasAnyPermission(user, ['integrations.manage', 'hardware.locks.sync', 'smart_locks.manage'])
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { propertyId, providerId: bodyProviderId } = body as {
      propertyId?: string;
      providerId?: string;
    };

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'propertyId is required' },
        { status: 400 },
      );
    }

    // --- Resolve the lock adapter config ---
    const whereClause: Record<string, unknown> = {
      propertyId,
      category: 'lock' as HardwareCategory,
      enabled: true,
    };
    if (bodyProviderId) whereClause.providerId = bodyProviderId;

    const adapterConfig = await db.hardwareAdapter.findFirst({ where: whereClause });

    if (!adapterConfig) {
      return NextResponse.json(
        { success: false, error: 'No active lock adapter configured for this property' },
        { status: 404 },
      );
    }

    // --- Get lock adapter from registry and call discoverLocks ---
    const lockAdapter = await hardwareRegistry.getLockAdapter(
      propertyId,
      adapterConfig.providerId,
    );

    const discoverResult = await lockAdapter.discoverLocks({ fullSync: true });

    if (!discoverResult.success || !discoverResult.data) {
      return NextResponse.json(
        {
          success: false,
          error: discoverResult.error ?? 'Lock discovery failed',
        },
        { status: 500 },
      );
    }

    const { locks: discoveredLocks, removedVendorLockIds } = discoverResult.data;
    let created = 0;
    let updated = 0;
    let removed = 0;

    // --- Upsert discovered locks into SmartLock table ---
    for (const lock of discoveredLocks) {
      const existingLock = await db.smartLock.findFirst({
        where: {
          propertyId,
          lockId: lock.vendorLockId,
          tenantId: user.tenantId,
        },
      });

      const lockData = {
        name: lock.name,
        lockId: lock.vendorLockId,
        provider: adapterConfig.providerId,
        batteryLevel: lock.batteryLevel ?? 100,
        lockStatus: mapLockStatus(lock.status),
        doorStatus: lock.status === LockStatus.Locked ? 'locked' : 'unlocked',
        lastActivity: lock.lastSeenAt ? new Date(lock.lastSeenAt) : new Date(),
        isActive: lock.isConnected,
      };

      if (existingLock) {
        await db.smartLock.update({
          where: { id: existingLock.id },
          data: lockData,
        });
        updated++;
      } else {
        await db.smartLock.create({
          data: {
            tenantId: user.tenantId,
            propertyId,
            ...lockData,
          },
        });
        created++;
      }
    }

    // --- Deactivate locks that were removed on the vendor side ---
    for (const removedId of removedVendorLockIds) {
      const staleLock = await db.smartLock.findFirst({
        where: {
          propertyId,
          lockId: removedId,
          tenantId: user.tenantId,
          isActive: true,
        },
      });

      if (staleLock) {
        await db.smartLock.update({
          where: { id: staleLock.id },
          data: { isActive: false },
        });
        removed++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        discovered: discoveredLocks.length,
        created,
        updated,
        removed,
      },
    });
  } catch (error) {
    console.error('[HAL:API] Error syncing locks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync locks from vendor' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapLockStatus(status: LockStatus): string {
  switch (status) {
    case 'locked':
      return 'locked';
    case 'unlocked':
      return 'unlocked';
    case 'jammed':
      return 'jammed';
    case 'low_battery':
      return 'locked'; // Keep accessible but flag separately
    case 'offline':
      return 'unlocked';
    default:
      return 'locked';
  }
}
