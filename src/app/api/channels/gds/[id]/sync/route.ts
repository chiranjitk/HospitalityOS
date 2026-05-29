/**
 * POST /api/channels/gds/[id]/sync
 *
 * Performs real sync operations against a GDS provider.
 *
 * Supported actions:
 *  - inventory_push: Push ARI (Availability, Rates, Inventory) to GDS
 *  - rate_update:    Update rate codes on the GDS
 *  - booking_pull:    Pull new/modified bookings from GDS
 *  - full_sync:       Full bidirectional sync (inventory push + booking pull)
 *
 * Uses the real GDS protocol adapters to make SOAP/XML calls.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { createGDSClient, validateGDSConfig, getGDSConfig } from '@/lib/gds/client-factory';
import type { GDSSyncAction, ARIUpdate, RateUpdate } from '@/lib/gds/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasAnyPermission(user, ['channels.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { action, options } = body as { action: GDSSyncAction; options?: Record<string, unknown> };

    // Validate sync action
    const validActions: GDSSyncAction[] = ['inventory_push', 'rate_update', 'booking_pull', 'full_sync'];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ACTION', message: `Action must be one of: ${validActions.join(', ')}` } },
        { status: 400 },
      );
    }

    // Fetch connection
    const connection = await db.gdsConnection.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!connection) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'GDS connection not found' } },
        { status: 404 },
      );
    }

    // Validate config
    const config = getGDSConfig(connection);
    const configErrors = validateGDSConfig(config);
    if (configErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFIG_INCOMPLETE', message: configErrors.join(', ') } },
        { status: 400 },
      );
    }

    // Set status to syncing
    await db.gdsConnection.update({
      where: { id },
      data: { status: 'syncing' },
    });

    // Create client and perform sync
    const client = createGDSClient(connection);
    const results: Record<string, unknown> = {};
    let allErrors: string[] = [];
    let totalProcessed = 0;

    try {
      // --- INVENTORY PUSH ---
      if (action === 'inventory_push' || action === 'full_sync') {
        const updates = (options?.updates as ARIUpdate[]) || await buildARIUpdates(connection);
        const syncResult = await client.pushARI(updates);
        results.inventoryPush = syncResult;
        totalProcessed += syncResult.recordsProcessed;
        allErrors = allErrors.concat(syncResult.errors);
      }

      // --- RATE UPDATE ---
      if (action === 'rate_update' || action === 'full_sync') {
        const rateUpdates = (options?.rateUpdates as RateUpdate[]) || await buildRateUpdates(connection);
        const syncResult = await client.updateRates(rateUpdates);
        results.rateUpdate = syncResult;
        totalProcessed += syncResult.recordsProcessed;
        allErrors = allErrors.concat(syncResult.errors);
      }

      // --- BOOKING PULL ---
      if (action === 'booking_pull' || action === 'full_sync') {
        const since = options?.since ? new Date(options.since as string) : getLastSyncDate(connection);
        const bookings = await client.pullBookings(since);
        results.bookingPull = { bookingsFetched: bookings.length };

        // Store new bookings in database
        let newBookingsStored = 0;
        for (const booking of bookings) {
          try {
            // Check if this PNR already exists for this connection
            const existing = await db.gdsBooking.findFirst({
              where: { connectionId: id, pnr: booking.pnr, tenantId: user.tenantId },
            });

            if (!existing) {
              await db.gdsBooking.create({
                data: {
                  tenantId: user.tenantId,
                  connectionId: id,
                  gdsRef: `${booking.gdsSource.toUpperCase()}:${booking.pnr}`,
                  pnr: booking.pnr,
                  guestName: `${booking.firstName} ${booking.lastName}`.trim(),
                  checkIn: booking.checkIn,
                  checkOut: booking.checkOut,
                  roomType: booking.roomType || null,
                  rateCode: booking.rateCode || null,
                  adults: booking.guestCount || 1,
                  status: mapGDSStatus(booking.status),
                  syncStatus: 'synced',
                },
              });
              newBookingsStored++;
            }
          } catch (dbError) {
            allErrors.push(`Failed to store booking ${booking.pnr}: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
          }
        }

        results.bookingPull.stored = newBookingsStored;
        totalProcessed += bookings.length;
      }

      // Update connection status after sync
      await db.gdsConnection.update({
        where: { id },
        data: {
          status: allErrors.length > 0 ? 'active' : 'active', // still active even with partial errors
          lastSyncAt: new Date(),
          lastError: allErrors.length > 0 ? allErrors[0] : null,
        },
      });

      return NextResponse.json({
        success: allErrors.length === 0,
        data: {
          connectionId: id,
          action,
          provider: connection.provider,
          totalRecordsProcessed: totalProcessed,
          results,
          errors: allErrors.length > 0 ? allErrors : undefined,
          syncCompletedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      // Update connection status to error
      await db.gdsConnection.update({
        where: { id },
        data: {
          status: 'error',
          lastError: error instanceof Error ? error.message : String(error),
        },
      });

      return NextResponse.json({
        success: false,
        error: {
          code: 'SYNC_FAILED',
          message: `GDS sync failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[GDS Sync Error]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process sync request' } },
      { status: 500 },
    );
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/** Build default ARI updates from the connection's rate codes */
async function buildARIUpdates(connection: { id: string; propertyId: string; tenantId: string }): Promise<ARIUpdate[]> {
  const rateCodes = await db.gdsRateCode.findMany({
    where: { connectionId: connection.id, isActive: true },
  });

  if (rateCodes.length === 0) return [];

  // Generate updates for the next 30 days
  const today = new Date();
  const updates: ARIUpdate[] = [];
  for (const rc of rateCodes) {
    for (let d = 0; d < 30; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      updates.push({
        roomTypeId: rc.roomTypeId || 'DEFAULT',
        rateCodeId: rc.code,
        date: date.toISOString().split('T')[0],
        availableRooms: 10, // Default availability
        rateAmount: rc.baseRate || 0,
        currency: rc.currency,
        restrictions: {
          minStay: rc.minStay || undefined,
          maxStay: rc.maxStay || undefined,
        },
      });
    }
  }

  return updates;
}

/** Build default rate updates from the connection's rate codes */
async function buildRateUpdates(connection: { id: string }): Promise<RateUpdate[]> {
  const rateCodes = await db.gdsRateCode.findMany({
    where: { connectionId: connection.id, isActive: true },
  });

  const today = new Date();
  const thirtyDaysLater = new Date(today);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  return rateCodes.map(rc => ({
    rateCodeId: rc.id,
    rateCode: rc.code,
    roomTypeId: rc.roomTypeId || 'DEFAULT',
    roomTypeCode: rc.roomTypeId || 'DEFAULT',
    dates: {
      from: today.toISOString().split('T')[0],
      to: thirtyDaysLater.toISOString().split('T')[0],
    },
    amount: rc.baseRate || 0,
    currency: rc.currency,
    restrictions: {
      minStay: rc.minStay || undefined,
      maxStay: rc.maxStay || undefined,
    },
  }));
}

/** Get the last sync date, defaulting to 30 days ago */
function getLastSyncDate(connection: { lastSyncAt?: Date | null }): Date {
  if (connection.lastSyncAt) {
    return connection.lastSyncAt;
  }
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return thirtyDaysAgo;
}

/** Map GDS booking status to StaySuite internal status */
function mapGDSStatus(gdsStatus: string): string {
  const map: Record<string, string> = {
    'confirmed': 'confirmed',
    'cancelled': 'cancelled',
    'modified': 'confirmed',
    'checked_in': 'checked_in',
    'checked_out': 'checked_out',
    'no_show': 'no_show',
    'new': 'new',
  };
  return map[gdsStatus.toLowerCase()] || 'new';
}
