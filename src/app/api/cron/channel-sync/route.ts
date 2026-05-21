/**
 * Channel Sync Cron Endpoint
 *
 * POST /api/cron/channel-sync
 * Triggers sync of all active channel connections.
 * Designed to be called by an external cron scheduler (e.g., cron-job.org, Vercel Cron).
 *
 * This replaces the in-memory OTASyncScheduler (setInterval) with a persistent,
 * serverless-friendly approach that survives restarts and scales to zero.
 *
 * Recommended schedule: Every 15 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { OTASyncService } from '@/lib/ota/sync-service';
import { OTAInventoryUpdate, OTARateUpdate } from '@/lib/ota/types';

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error('[CRON:channel-sync] CRON_SECRET environment variable is required');
}
const CRON_SECRET_VALUE = CRON_SECRET;

// ============================================
// HELPER: Build inventory updates for a property
// ============================================

async function buildPropertyInventoryUpdates(
  tenantId: string,
  propertyId: string
): Promise<OTAInventoryUpdate[]> {
  const roomTypes = await db.roomType.findMany({
    where: { propertyId, deletedAt: null },
    include: { rooms: { select: { id: true, status: true } } },
  });

  const today = new Date();
  const updates: OTAInventoryUpdate[] = [];

  for (const roomType of roomTypes) {
    const totalRooms = roomType.rooms.length;
    const availableRooms = roomType.rooms.filter(r => r.status === 'available').length;

    for (let d = 0; d < 30; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      updates.push({
        roomTypeId: roomType.id,
        externalRoomId: '',
        date: date.toISOString().split('T')[0],
        availableRooms,
        totalRooms,
      });
    }
  }

  return updates;
}

// ============================================
// HELPER: Build rate updates for a property
// ============================================

async function buildPropertyRateUpdates(
  tenantId: string,
  propertyId: string
): Promise<OTARateUpdate[]> {
  const ratePlans = await db.ratePlan.findMany({
    where: {
      roomType: { propertyId, deletedAt: null },
      deletedAt: null,
    },
    include: { roomType: { select: { id: true } } },
  });

  const today = new Date();
  const updates: OTARateUpdate[] = [];

  for (const ratePlan of ratePlans) {
    for (let d = 0; d < 30; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];

      const priceOverride = await db.priceOverride.findFirst({
        where: {
          ratePlanId: ratePlan.id,
          date: new Date(dateStr + 'T00:00:00.000Z'),
        },
      });

      updates.push({
        roomTypeId: ratePlan.roomTypeId,
        ratePlanId: ratePlan.id,
        externalRoomId: '',
        externalRatePlanId: '',
        date: dateStr,
        baseRate: priceOverride?.price ?? ratePlan.basePrice,
        currency: ratePlan.currency || 'USD',
      });
    }
  }

  return updates;
}

// ============================================
// POST /api/cron/channel-sync
// ============================================

export async function POST(request: NextRequest) {
  try {
    if (!CRON_SECRET_VALUE) {
      return NextResponse.json({ error: 'Server configuration error: CRON_SECRET not set' }, { status: 500 });
    }

    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');

    if (providedSecret !== CRON_SECRET_VALUE) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { dryRun = false, syncType = 'all' } = body as {
      dryRun?: boolean;
      syncType?: 'all' | 'inventory' | 'rates' | 'bookings';
    };

    // Get all active channel connections across all tenants
    const connections = await db.channelConnection.findMany({
      where: { status: 'active', autoSync: true },
      include: {
        _count: { select: { channelMappings: true } },
      },
    });

    if (connections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active channel connections with auto-sync enabled',
        data: { scanned: 0, synced: 0, failed: 0, dryRun },
      });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: 'Dry run - no syncs were performed',
        data: {
          dryRun,
          connections: connections.length,
          channels: [...new Set(connections.map(c => c.channel))],
        },
      });
    }

    // Get unique tenant+property combos that have active connections
    const processedKeys = new Set<string>();
    const results: Array<{
      connectionId: string;
      channel: string;
      tenantId: string;
      propertyId: string;
      inventoryStatus: 'synced' | 'failed' | 'skipped';
      ratesStatus: 'synced' | 'failed' | 'skipped';
      bookingsStatus: 'synced' | 'failed' | 'skipped';
      error?: string;
    }> = [];

    for (const connection of connections) {
      const key = `${connection.tenantId}:${connection.propertyId}:${connection.id}`;
      if (processedKeys.has(key)) continue;
      processedKeys.add(key);

      if (!connection.propertyId) continue;

      const result = {
        connectionId: connection.id,
        channel: connection.channel,
        tenantId: connection.tenantId,
        propertyId: connection.propertyId!,
        inventoryStatus: 'skipped' as const,
        ratesStatus: 'skipped' as const,
        bookingsStatus: 'skipped' as const,
      };

      // --- Sync Inventory ---
      if (syncType === 'all' || syncType === 'inventory') {
        try {
          const inventoryUpdates = await buildPropertyInventoryUpdates(
            connection.tenantId,
            connection.propertyId
          );
          if (inventoryUpdates.length > 0) {
            await OTASyncService.syncInventoryToChannel(connection.id, inventoryUpdates);
            result.inventoryStatus = 'synced';
          }
        } catch (error) {
          result.inventoryStatus = 'failed';
          result.error = error instanceof Error ? error.message : 'Inventory sync failed';
          console.error(`[CRON:channel-sync] Inventory sync failed for ${connection.channel} (${connection.id}):`, error);
        }
      }

      // --- Sync Rates ---
      if (syncType === 'all' || syncType === 'rates') {
        try {
          const rateUpdates = await buildPropertyRateUpdates(
            connection.tenantId,
            connection.propertyId
          );
          if (rateUpdates.length > 0) {
            await OTASyncService.syncRatesToChannel(connection.id, rateUpdates);
            result.ratesStatus = 'synced';
          }
        } catch (error) {
          result.ratesStatus = 'failed';
          if (!result.error) result.error = error instanceof Error ? error.message : 'Rate sync failed';
          console.error(`[CRON:channel-sync] Rate sync failed for ${connection.channel} (${connection.id}):`, error);
        }
      }

      // --- Pull Bookings ---
      if (syncType === 'all' || syncType === 'bookings') {
        try {
          const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const endDate = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000); // Next 2 years (AioSell forward booking window)
          await OTASyncService.pullBookingsFromChannel(connection.id, startDate, endDate);
          result.bookingsStatus = 'synced';
        } catch (error) {
          result.bookingsStatus = 'failed';
          if (!result.error) result.error = error instanceof Error ? error.message : 'Booking sync failed';
          console.error(`[CRON:channel-sync] Booking pull failed for ${connection.channel} (${connection.id}):`, error);
        }
      }

      results.push(result);
    }

    // Summary stats
    const inventorySynced = results.filter(r => r.inventoryStatus === 'synced').length;
    const ratesSynced = results.filter(r => r.ratesStatus === 'synced').length;
    const bookingsSynced = results.filter(r => r.bookingsStatus === 'synced').length;
    const totalFailed = results.filter(r =>
      r.inventoryStatus === 'failed' || r.ratesStatus === 'failed' || r.bookingsStatus === 'failed'
    ).length;

    return NextResponse.json({
      success: totalFailed === 0,
      message: `Channel sync complete: ${inventorySynced} inventory, ${ratesSynced} rates, ${bookingsSynced} bookings synced. ${totalFailed} failures.`,
      data: {
        connectionsScanned: connections.length,
        connectionsSynced: results.length,
        inventorySynced,
        ratesSynced,
        bookingsSynced,
        failed: totalFailed,
        syncType,
        timestamp: new Date().toISOString(),
      },
      results,
    });
  } catch (error) {
    console.error('[CRON:channel-sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/cron/channel-sync - Endpoint info
// ============================================

export async function GET() {
  if (!CRON_SECRET_VALUE) {
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 403 });
  }
  return NextResponse.json({
    success: true,
    message: 'Channel sync cron endpoint. Use POST to trigger.',
    data: {
      endpoint: '/api/cron/channel-sync',
      method: 'POST',
      headers: { Authorization: 'Bearer <CRON_SECRET>' },
      body: {
        syncType: 'all | inventory | rates | bookings (default: all)',
        dryRun: 'boolean (optional) - preview without syncing',
      },
      recommendedSchedule: '*/15 * * * * (every 15 minutes)',
    },
  });
}
