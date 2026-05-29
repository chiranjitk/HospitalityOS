/**
 * POST /api/cron/gds-sync
 *
 * Automated GDS sync cron endpoint.
 * Iterates all active GDS connections and:
 *  1. Pulls new bookings from each GDS provider
 *  2. Stores new bookings in GdsBooking table
 *  3. Updates connection sync status
 *
 * Designed to be called by a cron scheduler (e.g. every 15 minutes).
 * Guarded by GDS_SYNC_ENABLED env var — returns 200 with "disabled" if not enabled.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createGDSClient, isGDSSyncEnabled, getBookingPullIntervalMinutes, getGDSConfig, validateGDSConfig } from '@/lib/gds/client-factory';

// Simple cron secret check — optional but recommended for cron endpoints
const CRON_SECRET = process.env.CRON_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    // Check if GDS sync is enabled
    if (!isGDSSyncEnabled()) {
      return NextResponse.json({
        success: true,
        message: 'GDS sync is disabled. Set GDS_SYNC_ENABLED=true to enable.',
        data: { enabled: false },
      });
    }

    // Optional cron secret validation
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      const providedSecret = authHeader?.replace('Bearer ', '');
      if (providedSecret !== CRON_SECRET) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized cron request' },
          { status: 401 },
        );
      }
    }

    const pullIntervalMinutes = getBookingPullIntervalMinutes();

    // Find all active GDS connections
    const connections = await db.gdsConnection.findMany({
      where: {
        status: 'active',
        autoSync: true,
      },
    });

    if (connections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active GDS connections found for sync',
        data: {
          connectionsProcessed: 0,
          totalBookingsPulled: 0,
          totalBookingsStored: 0,
          errors: [],
        },
      });
    }

    let totalBookingsPulled = 0;
    let totalBookingsStored = 0;
    const syncErrors: string[] = [];

    for (const connection of connections) {
      try {
        const config = getGDSConfig(connection);
        const configErrors = validateGDSConfig(config);

        if (configErrors.length > 0) {
          syncErrors.push(`Connection ${connection.id} (${connection.provider}): config incomplete — ${configErrors.join(', ')}`);
          continue;
        }

        const client = createGDSClient(connection);

        // Determine "since" date: last sync or the pull interval ago
        const since = connection.lastSyncAt
          ? new Date(Math.max(connection.lastSyncAt.getTime(), Date.now() - pullIntervalMinutes * 60 * 1000))
          : new Date(Date.now() - pullIntervalMinutes * 60 * 1000);

        // Pull bookings
        const bookings = await client.pullBookings(since);
        totalBookingsPulled += bookings.length;

        // Store new bookings
        for (const booking of bookings) {
          try {
            const existing = await db.gdsBooking.findFirst({
              where: {
                connectionId: connection.id,
                pnr: booking.pnr,
                tenantId: connection.tenantId,
              },
            });

            if (!existing) {
              await db.gdsBooking.create({
                data: {
                  tenantId: connection.tenantId,
                  connectionId: connection.id,
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
              totalBookingsStored++;
            }
          } catch (dbError) {
            syncErrors.push(`Store booking ${booking.pnr}: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
          }
        }

        // Update connection sync status
        await db.gdsConnection.update({
          where: { id: connection.id },
          data: { lastSyncAt: new Date() },
        });

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        syncErrors.push(`Connection ${connection.id} (${connection.provider}): ${message}`);

        // Update connection error status
        await db.gdsConnection.update({
          where: { id: connection.id },
          data: { lastError: message },
        });
      }
    }

    return NextResponse.json({
      success: syncErrors.length === 0,
      message: syncErrors.length === 0
        ? `GDS sync completed successfully`
        : `GDS sync completed with ${syncErrors.length} error(s)`,
      data: {
        connectionsProcessed: connections.length,
        totalBookingsPulled,
        totalBookingsStored,
        pullIntervalMinutes,
        errors: syncErrors.length > 0 ? syncErrors : undefined,
        syncCompletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[GDS Cron Sync Error]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'GDS cron sync failed' } },
      { status: 500 },
    );
  }
}

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
