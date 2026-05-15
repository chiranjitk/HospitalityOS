import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOTAById, OTAClientFactory } from '@/lib/ota';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/channels/stop-sell?propertyId=X
// Returns active stop-sells, channels, room types, and summary
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'channels.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    // 1. Get all active channel connections for this tenant
    const connectionWhere: Record<string, unknown> = { tenantId };
    if (propertyId) connectionWhere.propertyId = propertyId;

    const connections = await db.channelConnection.findMany({
      where: connectionWhere,
      select: { id: true, channel: true, displayName: true, status: true, propertyId: true },
      orderBy: { channel: 'asc' },
    });

    const connectionIds = connections.map((c) => c.id);

    // Enrich with OTA metadata
    const enrichedConnections = connections.map((conn) => {
      const ota = getOTAById(conn.channel);
      return {
        id: conn.id,
        channel: conn.channel,
        displayName: conn.displayName || ota?.displayName || conn.channel,
        status: conn.status,
        propertyId: conn.propertyId,
        logo: ota?.logo || conn.channel.charAt(0).toUpperCase(),
        color: ota?.color || '#6B7280',
      };
    });

    // 2. Get room types
    const propertyFilter: Record<string, unknown> = { tenantId, deletedAt: null };
    if (propertyId) propertyFilter.id = propertyId;

    const properties = await db.property.findMany({
      where: propertyFilter,
      include: {
        roomTypes: { where: { deletedAt: null }, orderBy: { name: 'asc' } },
      },
    });

    const roomTypes = properties.flatMap((p) =>
      p.roomTypes.map((rt) => ({
        id: rt.id,
        name: rt.name,
        code: rt.code,
        propertyId: p.id,
        propertyName: p.name,
      }))
    );

    const roomTypeIds = roomTypes.map((rt) => rt.id);

    // 3. Get active stop-sells (closed = true) with date overlap (endDate >= today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeStopSells = await db.channelRestriction.findMany({
      where: {
        connectionId: { in: connectionIds },
        roomTypeId: { in: roomTypeIds },
        closed: true,
        endDate: { gte: today },
      },
      include: {
        connection: {
          select: { id: true, channel: true, displayName: true, tenantId: true },
        },
        roomType: {
          select: { id: true, name: true, property: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ startDate: 'asc' }, { connectionId: 'asc' }],
    });

    // Format stop-sell data
    const formattedStopSells = activeStopSells.map((ss) => {
      const conn = ss.connection;
      const ota = getOTAById(conn.channel);
      return {
        id: ss.id,
        channelId: conn.id,
        channelName: conn.displayName || ota?.displayName || conn.channel,
        channelCode: conn.channel,
        channelLogo: ota?.logo || conn.channel.charAt(0).toUpperCase(),
        channelColor: ota?.color || '#6B7280',
        roomTypeId: ss.roomTypeId,
        roomTypeName: ss.roomType?.name || 'Unknown',
        propertyName: ss.roomType?.property?.name || '',
        startDate: ss.startDate.toISOString().split('T')[0],
        endDate: ss.endDate.toISOString().split('T')[0],
        closedToArrival: ss.closedToArrival,
        closedToDeparture: ss.closedToDeparture,
        syncStatus: ss.syncStatus,
        createdAt: ss.createdAt.toISOString(),
      };
    });

    // 4. Compute summary
    const uniqueChannelIds = new Set(formattedStopSells.map((s) => s.channelId));
    const uniqueRoomTypeIds = new Set(formattedStopSells.map((s) => s.roomTypeId));

    let datesCovered = 'No active stop-sells';
    if (formattedStopSells.length > 0) {
      const allStarts = formattedStopSells.map((s) => new Date(s.startDate).getTime());
      const allEnds = formattedStopSells.map((s) => new Date(s.endDate).getTime());
      const earliest = new Date(Math.min(...allStarts));
      const latest = new Date(Math.max(...allEnds));
      const fmt = (d: Date) =>
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      datesCovered = `${fmt(earliest)} - ${fmt(latest)}`;
    }

    return NextResponse.json({
      success: true,
      data: {
        activeStopSells: formattedStopSells,
        channels: enrichedConnections,
        roomTypes,
        summary: {
          totalActive: formattedStopSells.length,
          channelsAffected: uniqueChannelIds.size,
          roomTypesAffected: uniqueRoomTypeIds.size,
          datesCovered,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching stop-sell data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stop-sell data' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/stop-sell — Bulk apply stop-sell
// Body: { action: "apply", channelIds?, roomTypeIds?, startDate, endDate, closedToArrival?, closedToDeparture?, reason? }
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'channels.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      action,
      channelIds,
      roomTypeIds,
      startDate,
      endDate,
      closedToArrival = false,
      closedToDeparture = false,
      reason,
    } = body;

    if (action !== 'apply') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Action must be "apply"' } },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'startDate and endDate are required' } },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'endDate must be >= startDate' } },
        { status: 400 }
      );
    }

    // Get connections — if channelIds empty, use all active connections
    let targetConnectionIds = channelIds || [];
    if (targetConnectionIds.length === 0) {
      const allConns = await db.channelConnection.findMany({
        where: { tenantId: user.tenantId, status: 'active' },
        select: { id: true },
      });
      targetConnectionIds = allConns.map((c) => c.id);
    }

    // Verify connections belong to tenant
    const validConns = await db.channelConnection.findMany({
      where: { id: { in: targetConnectionIds }, tenantId: user.tenantId },
      select: { id: true },
    });
    const validConnIds = validConns.map((c) => c.id);

    if (validConnIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid channel connections found' } },
        { status: 400 }
      );
    }

    // Get room types — if roomTypeIds empty, use all property room types
    let targetRoomTypeIds = roomTypeIds || [];
    if (targetRoomTypeIds.length === 0) {
      const properties = await db.property.findMany({
        where: { tenantId: user.tenantId, deletedAt: null },
        include: { roomTypes: { where: { deletedAt: null }, select: { id: true } } },
      });
      targetRoomTypeIds = properties.flatMap((p) => p.roomTypes.map((rt) => rt.id));
    }

    // Verify room types belong to tenant
    const validRoomTypes = await db.roomType.findMany({
      where: { id: { in: targetRoomTypeIds }, property: { tenantId: user.tenantId, deletedAt: null } },
      select: { id: true },
    });
    const validRTIds = validRoomTypes.map((rt) => rt.id);

    if (validRTIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid room types found' } },
        { status: 400 }
      );
    }

    // Generate a date range array
    const dateRange: Date[] = [];
    const current = new Date(start);
    while (current <= end) {
      dateRange.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // For each connection x roomType x date, upsert a ChannelRestriction with closed: true
    // We use a transaction for safety
    let createdCount = 0;
    let updatedCount = 0;

    await db.$transaction(async (tx) => {
      for (const connId of validConnIds) {
        for (const rtId of validRTIds) {
          for (const date of dateRange) {
            // ChannelRestriction has @@unique([connectionId, roomTypeId, startDate])
            const existing = await tx.channelRestriction.findUnique({
              where: {
                connectionId_roomTypeId_startDate: {
                  connectionId: connId,
                  roomTypeId: rtId,
                  startDate: date,
                },
              },
            });

            if (existing) {
              // Update existing record
              await tx.channelRestriction.update({
                where: { id: existing.id },
                data: {
                  endDate: end,
                  closed: true,
                  closedToArrival: closedToArrival || existing.closedToArrival,
                  closedToDeparture: closedToDeparture || existing.closedToDeparture,
                  source: reason ? `manual: ${reason}` : 'manual',
                  syncStatus: 'pending',
                },
              });
              updatedCount++;
            } else {
              // Create new record
              await tx.channelRestriction.create({
                data: {
                  connectionId: connId,
                  roomTypeId: rtId,
                  startDate: date,
                  endDate: end,
                  closed: true,
                  closedToArrival,
                  closedToDeparture,
                  source: reason ? `manual: ${reason}` : 'manual',
                  syncStatus: 'pending',
                },
              });
              createdCount++;
            }
          }
        }
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'channels',
          action: 'bulk_stop_sell_apply',
          entityType: 'channel_restriction',
          newValue: JSON.stringify({
            channelIds: validConnIds,
            roomTypeIds: validRTIds,
            startDate,
            endDate,
            closedToArrival,
            closedToDeparture,
            reason,
            createdCount,
            updatedCount,
          }),
        },
      });
    });

    // Propagate stop-sell to all active OTA connections
    const otaResults: Array<{ channelId: string; channel: string; success: boolean; message?: string }> = [];
    try {
      const activeConnections = await db.channelConnection.findMany({
        where: { id: { in: validConnIds }, status: 'active' },
        select: {
          id: true,
          channel: true,
          displayName: true,
          apiKey: true,
          apiSecret: true,
          hotelId: true,
        },
      });

      // Get channel mappings for the affected room types
      const channelMappings = await db.channelMapping.findMany({
        where: {
          connectionId: { in: activeConnections.map(c => c.id) },
          roomTypeId: { in: validRTIds },
        },
        select: {
          connectionId: true,
          externalRoomId: true,
          roomTypeId: true,
        },
      });

      for (const connection of activeConnections) {
        try {
          const client = OTAClientFactory.createClient(connection.channel);
          if (!client) {
            otaResults.push({ channelId: connection.id, channel: connection.channel, success: false, message: 'No OTA client available for channel' });
            await db.channelSyncLog.create({
              data: {
                connectionId: connection.id,
                syncType: 'rate',
                direction: 'outbound',
                status: 'failed',
                errorMessage: 'No OTA client available for channel',
              },
            });
            continue;
          }

          // Build restriction updates from channel mappings
          const connMappings = channelMappings.filter(m => m.connectionId === connection.id);
          if (connMappings.length === 0) {
            otaResults.push({ channelId: connection.id, channel: connection.channel, success: false, message: 'No room mappings configured' });
            await db.channelSyncLog.create({
              data: {
                connectionId: connection.id,
                syncType: 'rate',
                direction: 'outbound',
                status: 'failed',
                errorMessage: 'No room mappings configured for stop-sell propagation',
              },
            });
            continue;
          }

          const restrictionUpdates = [];
          for (const mapping of connMappings) {
            for (const date of dateRange) {
              restrictionUpdates.push({
                roomTypeId: mapping.roomTypeId,
                externalRoomId: mapping.externalRoomId,
                date: date.toISOString().split('T')[0],
                closedToArrival,
                closedToDeparture,
                closed: true,
                minStayThrough: 1,
              });
            }
          }

          const syncResult = await client.updateRestrictions(restrictionUpdates);

          if (syncResult.success) {
            otaResults.push({ channelId: connection.id, channel: connection.channel, success: true });
            await db.channelSyncLog.create({
              data: {
                connectionId: connection.id,
                syncType: 'rate',
                direction: 'outbound',
                status: 'success',
                requestPayload: JSON.stringify(restrictionUpdates.length),
                responsePayload: JSON.stringify(syncResult),
              },
            });
            // Update last sync time
            await db.channelConnection.update({
              where: { id: connection.id },
              data: { lastSyncAt: new Date() },
            });
          } else {
            const errorMsg = syncResult.errors?.map(e => e.message).join('; ') || 'Unknown error';
            otaResults.push({ channelId: connection.id, channel: connection.channel, success: false, message: errorMsg });
            await db.channelSyncLog.create({
              data: {
                connectionId: connection.id,
                syncType: 'rate',
                direction: 'outbound',
                status: 'failed',
                errorMessage: errorMsg,
                requestPayload: JSON.stringify(restrictionUpdates.length),
                responsePayload: JSON.stringify(syncResult),
              },
            });
          }
        } catch (otaError) {
          const errMsg = otaError instanceof Error ? otaError.message : 'Unknown OTA push error';
          otaResults.push({ channelId: connection.id, channel: connection.channel, success: false, message: errMsg });
          await db.channelSyncLog.create({
            data: {
              connectionId: connection.id,
              syncType: 'rate',
              direction: 'outbound',
              status: 'failed',
              errorMessage: errMsg,
            },
          });
        }
      }
    } catch (otaPropError) {
      console.error('Error propagating stop-sell to OTAs:', otaPropError);
    }

    const otaSuccessCount = otaResults.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      data: {
        created: createdCount,
        updated: updatedCount,
        channelsAffected: validConnIds.length,
        roomTypesAffected: validRTIds.length,
        daysAffected: dateRange.length,
        otaPropagation: {
          total: otaResults.length,
          successful: otaSuccessCount,
          failed: otaResults.length - otaSuccessCount,
          details: otaResults,
        },
        message: `Stop-sell applied: ${createdCount} new + ${updatedCount} updated restrictions. OTA propagation: ${otaSuccessCount}/${otaResults.length} channels updated.`,
      },
    });
  } catch (error) {
    console.error('Error applying stop-sell:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to apply stop-sell' } },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/stop-sell — Bulk remove stop-sell
// Body: { action: "remove", channelIds?, roomTypeIds?, startDate, endDate }
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'channels.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, channelIds, roomTypeIds, startDate, endDate } = body;

    if (action !== 'remove') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Action must be "remove"' } },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'startDate and endDate are required' } },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Build the where clause for finding restrictions to remove
    const where: Record<string, unknown> = {
      connection: { tenantId: user.tenantId },
      closed: true,
      startDate: { lte: end },
      endDate: { gte: start },
    };

    // If specific channel IDs provided, filter
    if (channelIds && channelIds.length > 0) {
      where.connectionId = { in: channelIds };
    }

    // If specific room type IDs provided, filter
    if (roomTypeIds && roomTypeIds.length > 0) {
      where.roomTypeId = { in: roomTypeIds };
    }

    // Find matching restrictions
    const matchingRestrictions = await db.channelRestriction.findMany({
      where,
      select: { id: true, connectionId: true, roomTypeId: true, startDate: true },
    });

    if (matchingRestrictions.length === 0) {
      return NextResponse.json({
        success: true,
        data: { removed: 0, message: 'No matching stop-sell restrictions found' },
      });
    }

    const idsToRemove = matchingRestrictions.map((r) => r.id);

    // Delete in transaction
    await db.$transaction(async (tx) => {
      await tx.channelRestriction.deleteMany({
        where: { id: { in: idsToRemove } },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'channels',
          action: 'bulk_stop_sell_remove',
          entityType: 'channel_restriction',
          oldValue: JSON.stringify({
            removedCount: idsToRemove.length,
            channelIds: channelIds || 'all',
            roomTypeIds: roomTypeIds || 'all',
            startDate,
            endDate,
          }),
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        removed: idsToRemove.length,
        message: `${idsToRemove.length} stop-sell restrictions removed`,
      },
    });
  } catch (error) {
    console.error('Error removing stop-sell:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove stop-sell' } },
      { status: 500 }
    );
  }
}
