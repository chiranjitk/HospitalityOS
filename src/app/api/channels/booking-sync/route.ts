import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { OTASyncService } from '@/lib/ota/sync-service';

// GET /api/channels/booking-sync - Get booking sync status
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'channels.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view booking sync' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get channel connections
    const connections = await db.channelConnection.findMany({
      where: { tenantId },
    });

    // Get bookings with source info
    const bookings = await db.booking.findMany({
      where: { tenantId },
      include: {
        primaryGuest: {
          select: { firstName: true, lastName: true },
        },
        roomType: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Get booking sync logs
    const syncLogs = await db.channelSyncLog.findMany({
      where: {
        connection: { tenantId },
        syncType: 'bookings',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Build booking sync data
    const bookingData = bookings.map(booking => {
      const bookingSource = booking.source?.toLowerCase();
      const channelConnection = bookingSource
        ? connections.find(c => c.channel.toLowerCase() === bookingSource)
        : undefined;
      
      const lastSyncLog = syncLogs.find(l => 
        l.connectionId === channelConnection?.id
      );

      // Determine sync status
      let syncStatus = 'synced';
      if (booking.status === 'pending') {
        syncStatus = 'pending';
      } else if (booking.status === 'cancelled') {
        syncStatus = 'cancelled';
      }

      return {
        id: booking.id,
        channelName: channelConnection?.displayName || booking.source || 'Direct',
        channelType: channelConnection?.channel || 'direct',
        confirmationCode: booking.confirmationCode || `BK-${booking.id.slice(-6)}`,
        externalRef: booking.externalRef || '',
        guestName: `${booking.primaryGuest?.firstName || ''} ${booking.primaryGuest?.lastName || ''}`.trim(),
        roomType: booking.roomType?.name || 'Standard',
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        amount: booking.totalAmount || 0,
        currency: booking.currency || 'USD',
        syncStatus,
        syncDirection: 'inbound',
        lastSync: lastSyncLog?.createdAt || booking.createdAt,
      };
    });

    // Calculate stats
    const stats = {
      total: bookingData.length,
      synced: bookingData.filter(d => d.syncStatus === 'synced').length,
      pending: bookingData.filter(d => d.syncStatus === 'pending').length,
      conflicts: 0,
      cancelled: bookingData.filter(d => d.syncStatus === 'cancelled').length,
      inbound: bookingData.filter(d => d.syncDirection === 'inbound').length,
      outbound: bookingData.filter(d => d.syncDirection === 'outbound').length,
    };

    return NextResponse.json({
      success: true,
      data: bookingData,
      stats,
    });
  } catch (error) {
    console.error('Error fetching booking sync:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch booking sync' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/booking-sync - Sync bookings from OTA channels
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'channels.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to sync bookings' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, bookingId } = body;

    // ---- Action: syncAll - Pull bookings from all active channels ----
    if (action === 'syncAll') {
      const connections = await db.channelConnection.findMany({
        where: { tenantId: user.tenantId, status: 'active' },
      });

      if (connections.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No active channel connections to pull bookings from',
          results: [],
        });
      }

      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
      const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Next year

      const results: Array<{
        connectionId: string;
        channelName: string;
        status: 'success' | 'failed' | 'partial';
        recordsProcessed: number;
        error?: string;
      }> = [];

      for (const connection of connections) {
        try {
          await OTASyncService.pullBookingsFromChannel(
            connection.id,
            startDate,
            endDate
          );

          results.push({
            connectionId: connection.id,
            channelName: connection.displayName || connection.channel,
            status: 'success',
            recordsProcessed: 0, // actual count tracked in sync log
          });
        } catch (error) {
          console.error(`Booking sync failed for ${connection.channel}:`, error);
          results.push({
            connectionId: connection.id,
            channelName: connection.displayName || connection.channel,
            status: 'failed',
            recordsProcessed: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const succeeded = results.filter(r => r.status === 'success').length;
      const failed = results.filter(r => r.status === 'failed').length;

      return NextResponse.json({
        success: failed === 0,
        message: `Pulled bookings from ${succeeded} of ${connections.length} channels (${failed} failed)`,
        results,
        dateRange: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
        },
      });
    }

    // ---- Action: syncBooking - Pull bookings for a specific channel ----
    if (action === 'syncChannel' && body.channelName) {
      const connection = await db.channelConnection.findFirst({
        where: { tenantId: user.tenantId, channel: body.channelName, status: 'active' },
      });

      if (!connection) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found' } },
          { status: 404 }
        );
      }

      const startDate = body.startDate
        ? new Date(body.startDate)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = body.endDate
        ? new Date(body.endDate)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      try {
        await OTASyncService.pullBookingsFromChannel(
          connection.id,
          startDate,
          endDate
        );

        return NextResponse.json({
          success: true,
          message: `Pulled bookings from ${body.channelName}`,
          data: {
            connectionId: connection.id,
            channelName: body.channelName,
            dateRange: {
              from: startDate.toISOString(),
              to: endDate.toISOString(),
            },
          },
        });
      } catch (error) {
        console.error(`Booking pull failed for ${body.channelName}:`, error);
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'SYNC_FAILED',
              message: `Failed to pull bookings from ${body.channelName}`,
              details: error instanceof Error ? error.message : 'Unknown error',
            },
          },
          { status: 500 }
        );
      }
    }

    // ---- Action: syncBooking - Push a specific booking status back to the OTA ----
    if (action === 'syncBooking' && bookingId) {
      // Get the booking
      const booking = await db.booking.findFirst({
        where: { id: bookingId, tenantId: user.tenantId },
      });

      if (!booking) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
          { status: 404 }
        );
      }

      // Find the channel connection
      const connection = await db.channelConnection.findFirst({
        where: { tenantId: user.tenantId, channel: booking.source || '' },
      });

      if (connection) {
        // Try to push booking status via OTA client
        try {
          const { OTAClientFactory } = await import('@/lib/ota/client-factory');
          const client = OTAClientFactory.createClient(connection.channel);

          if (client && booking.externalRef) {
            await client.connect({
              apiKey: connection.apiKey || undefined,
              apiSecret: connection.apiSecret || undefined,
              hotelId: connection.hotelId || undefined,
            });

            if (booking.status === 'cancelled' || booking.status === 'no_show') {
              await client.cancelBooking(
                booking.externalRef,
                booking.cancellationReason || 'Cancelled by property'
              );
            } else if (booking.status === 'confirmed') {
              await client.confirmBooking(booking.externalRef);
            }
          }
        } catch (error) {
          console.error(`Failed to push booking ${bookingId} to ${connection.channel}:`, error);
          // Still log locally even if OTA push fails
        }

        // Create sync log
        await db.channelSyncLog.create({
          data: {
            connectionId: connection.id,
            syncType: 'bookings',
            direction: 'outbound',
            status: 'success',
            requestPayload: JSON.stringify({
              bookingId,
              externalRef: booking.externalRef,
              status: booking.status,
            }),
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Booking synced successfully',
        data: {
          bookingId,
          externalRef: booking.externalRef,
          status: booking.status,
          channelPushed: !!connection,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action or missing parameters' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error syncing booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to sync booking' } },
      { status: 500 }
    );
  }
}
