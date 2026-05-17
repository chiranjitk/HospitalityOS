import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { OTAClientFactory } from '@/lib/ota';
import { eachDayOfInterval } from 'date-fns';

interface OTAPushRequest {
  type: 'inventory' | 'rates' | 'restrictions';
  roomTypeId: string;
  startDate: string;
  endDate: string;
  data: {
    available?: number;
    rate?: number;
    minStay?: number;
    maxStay?: number;
    closedToArrival?: boolean;
    closedToDeparture?: boolean;
  };
}

interface OTAResponse {
  channel: string;
  success: boolean;
  message?: string;
  referenceId?: string;
  timestamp: string;
}

// Push to OTA using the OTA client factory with real API calls
async function pushToOTA(
  channel: string,
  connection: { id: string; apiKey: string | null; apiSecret: string | null; hotelId: string | null },
  request: OTAPushRequest
): Promise<OTAResponse> {
  const correlationId = `${channel.toUpperCase()}-${Date.now()}`;

  // Create the OTA client for this channel
  const client = OTAClientFactory.createClient(channel);
  if (!client) {
    await db.channelSyncLog.create({
      data: {
        connectionId: connection.id,
        syncType: request.type === 'inventory' ? 'inventory' : 'rate',
        direction: 'outbound',
        status: 'failed',
        errorMessage: `No OTA client available for channel: ${channel}`,
        requestPayload: JSON.stringify(request),
      },
    });
    return {
      channel,
      success: false,
      message: `No OTA client available for channel: ${channel}`,
      timestamp: new Date().toISOString(),
    };
  }

  // Check for minimum credentials
  if (!connection.apiKey && !connection.hotelId) {
    await db.channelSyncLog.create({
      data: {
        connectionId: connection.id,
        syncType: request.type === 'inventory' ? 'inventory' : 'rate',
        direction: 'outbound',
        status: 'failed',
        errorMessage: 'Missing API credentials',
        requestPayload: JSON.stringify(request),
      },
    });
    return {
      channel,
      success: false,
      message: 'Missing API credentials',
      timestamp: new Date().toISOString(),
    };
  }

  try {
    // Get channel mappings for the room type (skip for __all__ bulk syncs)
    let externalRoomId = connection.hotelId || '';
    if (request.roomTypeId !== '__all__') {
      const mapping = await db.channelMapping.findFirst({
        where: {
          connectionId: connection.id,
          roomTypeId: request.roomTypeId,
        },
        select: { externalRoomId: true },
      });
      if (mapping) {
        externalRoomId = mapping.externalRoomId;
      }
    }

    let syncResult: any;

    switch (request.type) {
      case 'inventory': {
        const inventoryUpdates = request.roomTypeId === '__all__'
          ? [{ externalRoomId, date: request.startDate, availableRooms: request.data.available ?? 0, totalRooms: request.data.available ?? 0 }]
          : eachDayOfInterval({ start: new Date(request.startDate), end: new Date(request.endDate) }).map(day => ({
              roomTypeId: request.roomTypeId,
              externalRoomId,
              date: day.toISOString().split('T')[0],
              availableRooms: request.data.available ?? 0,
              totalRooms: request.data.available ?? 0,
            }));
        syncResult = await client.updateInventory(inventoryUpdates);
        break;
      }
      case 'rates': {
        const rateUpdates = eachDayOfInterval({ start: new Date(request.startDate), end: new Date(request.endDate) }).map(day => ({
            roomTypeId: request.roomTypeId,
            externalRoomId,
            externalRatePlanId: 'default',
            date: day.toISOString().split('T')[0],
            baseRate: request.data.rate ?? 0,
            currency: 'USD',
          }));
        syncResult = await client.updateRates(rateUpdates);
        break;
      }
      case 'restrictions': {
        const restrictionUpdates = eachDayOfInterval({ start: new Date(request.startDate), end: new Date(request.endDate) }).map(day => ({
            roomTypeId: request.roomTypeId,
            externalRoomId,
            date: day.toISOString().split('T')[0],
            closedToArrival: request.data.closedToArrival ?? false,
            closedToDeparture: request.data.closedToDeparture ?? false,
            closed: request.data.available === 0,
            minStayThrough: request.data.minStay ?? 1,
          }));
        syncResult = await client.updateRestrictions(restrictionUpdates);
        break;
      }
    }

    const isSuccess = syncResult?.success ?? false;
    const errorMsg = syncResult?.errors?.map((e: any) => e.message).join('; ');

    // Log the push result
    await db.channelSyncLog.create({
      data: {
        connectionId: connection.id,
        syncType: request.type === 'inventory' ? 'inventory' : request.type === 'rates' ? 'rate' : 'rate',
        direction: 'outbound',
        status: isSuccess ? 'success' : 'failed',
        requestPayload: JSON.stringify(request),
        responsePayload: JSON.stringify(syncResult),
        errorMessage: errorMsg || undefined,
      },
    });

    return {
      channel,
      success: isSuccess,
      message: isSuccess
        ? `Successfully pushed ${request.type} to ${channel}`
        : `Failed to push ${request.type} to ${channel}: ${errorMsg}`,
      referenceId: correlationId,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';

    await db.channelSyncLog.create({
      data: {
        connectionId: connection.id,
        syncType: request.type === 'inventory' ? 'inventory' : 'rate',
        direction: 'outbound',
        status: 'failed',
        errorMessage: errMsg,
        requestPayload: JSON.stringify(request),
      },
    });

    return {
      channel,
      success: false,
      message: `Error pushing to ${channel}: ${errMsg}`,
      timestamp: new Date().toISOString(),
    };
  }
}

// GET /api/channel-manager/push - Get push status/history
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view push status' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get channel connections
    const connections = await db.channelConnection.findMany({
      where: { tenantId, status: 'active' },
    });

    // Get channel mappings for this tenant
    const mappings = await db.channelMapping.findMany({
      where: {
        connection: { tenantId },
      },
      include: {
        connection: { select: { channel: true, displayName: true } },
        roomType: { select: { name: true, code: true } },
      },
    });

    // Get recent push logs
    const recentPushes = await db.channelSyncLog.findMany({
      where: {
        connection: { tenantId },
        direction: 'outbound',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Build channel status
    const channels = connections.map(conn => ({
      id: conn.channel,
      name: conn.displayName || conn.channel,
      status: conn.status,
      lastSync: conn.lastSyncAt?.toISOString() || null,
      autoSync: conn.autoSync,
      syncInterval: conn.syncInterval,
    }));

    return NextResponse.json({
      success: true,
      data: {
        channels,
        mappings: mappings.map(m => ({
          id: m.id,
          channel: m.connection?.channel,
          channelName: m.connection?.displayName,
          roomType: m.roomType?.name,
          externalId: m.externalRoomId,
          syncRates: m.syncRates,
          syncInventory: m.syncInventory,
        })),
        recentPushes: recentPushes.map(p => ({
          id: p.id,
          type: p.syncType,
          status: p.status,
          createdAt: p.createdAt,
          errorMessage: p.errorMessage,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching channel push status:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch push status' } },
      { status: 500 }
    );
  }
}

// POST /api/channel-manager/push - Push rates/inventory to OTAs
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to push to channels' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();

    // Handle bulk sync actions from the inventory sync page
    if (body.action === 'sync-all') {
      const connections = await db.channelConnection.findMany({
        where: { tenantId, status: 'active' },
      });

      if (connections.length === 0) {
        return NextResponse.json({
          success: false,
          error: { code: 'NO_CHANNELS', message: 'No active channel connections found' },
        });
      }

      const results: OTAResponse[] = [];
      for (const connection of connections) {
        try {
          const result = await pushToOTA(connection.channel, {
            id: connection.id,
            apiKey: connection.apiKey,
            apiSecret: connection.apiSecret,
            hotelId: connection.hotelId,
          }, {
            type: 'inventory',
            roomTypeId: '__all__',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            data: { available: -1 },
          });
          results.push(result);
          if (result.success) {
            await db.channelConnection.update({
              where: { id: connection.id },
              data: { lastSyncAt: new Date() },
            });
          }
        } catch (error) {
          results.push({
            channel: connection.channel,
            success: false,
            message: error instanceof Error ? error.message : 'Push failed',
            timestamp: new Date().toISOString(),
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      return NextResponse.json({
        success: successCount > 0,
        data: { results, summary: { total: results.length, successful: successCount, failed: results.length - successCount } },
        message: `Synced ${successCount}/${results.length} channels`,
      });
    }

    if (body.action === 'sync-channel') {
      const { channelName } = body;
      const connection = await db.channelConnection.findFirst({
        where: { tenantId, status: 'active', channel: channelName },
      });

      if (!connection) {
        return NextResponse.json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Channel "${channelName}" not found or inactive` },
        });
      }

      const result = await pushToOTA(connection.channel, {
        id: connection.id,
        apiKey: connection.apiKey,
        apiSecret: connection.apiSecret,
        hotelId: connection.hotelId,
      }, {
        type: 'inventory',
        roomTypeId: '__all__',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        data: { available: -1 },
      });

      if (result.success) {
        await db.channelConnection.update({
          where: { id: connection.id },
          data: { lastSyncAt: new Date() },
        });
      }

      return NextResponse.json({ success: result.success, data: result });
    }

    const {
      type = 'rates',
      roomTypeId,
      channelIds,
      startDate,
      endDate,
      data,
    } = body;

    if (!roomTypeId || !startDate || !endDate || !data) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // Verify room type belongs to user's tenant through property
    const roomType = await db.roomType.findFirst({
      where: { 
        id: roomTypeId,
        property: { tenantId }
      },
    });

    if (!roomType) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room type not found' } },
        { status: 404 }
      );
    }

    // Get active connections for specified channels (or all if not specified)
    const connections = await db.channelConnection.findMany({
      where: { 
        tenantId, 
        status: 'active',
        ...(channelIds && channelIds.length > 0 ? { channel: { in: channelIds } } : {}),
      },
    });

    if (connections.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_CHANNELS', message: 'No active channel connections found' } },
        { status: 400 }
      );
    }

    // Prepare push request
    const pushRequest: OTAPushRequest = {
      type,
      roomTypeId,
      startDate,
      endDate,
      data,
    };

    // Push to each channel
    const results: OTAResponse[] = [];
    
    for (const connection of connections) {
      try {
        const result = await pushToOTA(connection.channel, {
          id: connection.id,
          apiKey: connection.apiKey,
          apiSecret: connection.apiSecret,
          hotelId: connection.hotelId,
        }, pushRequest);
        
        results.push(result);

        // Update connection last sync time if success
        if (result.success) {
          await db.channelConnection.update({
            where: { id: connection.id },
            data: { lastSyncAt: new Date() },
          });
        }
      } catch (error) {
        results.push({
          channel: connection.channel,
          success: false,
          message: error instanceof Error ? error.message : 'Push failed',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update price overrides if rates were pushed
    if (type === 'rates' && data.rate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = eachDayOfInterval({ start, end });
      
      // Find rate plans for this room type
      const ratePlans = await db.ratePlan.findMany({
        where: { 
          roomTypeId, 
          roomType: { property: { tenantId } },
          deletedAt: null 
        },
      });

      for (const ratePlan of ratePlans) {
        for (const day of days) {
          await db.priceOverride.upsert({
            where: {
              ratePlanId_date: {
                ratePlanId: ratePlan.id,
                date: day,
              },
            },
            create: {
              ratePlanId: ratePlan.id,
              date: day,
              price: data.rate,
              reason: 'Channel manager push',
            },
            update: {
              price: data.rate,
            },
          });
        }
      }
    }

    // Update inventory if inventory was pushed
    if (type === 'inventory' && data.available !== undefined) {
      // Log inventory update
      await db.channelMapping.updateMany({
        where: {
          roomTypeId,
          connection: { tenantId },
        },
        data: {
          updatedAt: new Date(),
        },
      });
    }

    const successCount = results.filter(r => r.success).length;
    
    return NextResponse.json({
      success: successCount > 0,
      data: {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: results.length - successCount,
        },
        roomType: roomType.name,
        pushedAt: new Date().toISOString(),
      },
      message: successCount === results.length
        ? `Successfully pushed to all ${results.length} channels`
        : `Pushed to ${successCount}/${results.length} channels`,
    });
  } catch (error) {
    console.error('Error pushing to channels:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to push to channels' } },
      { status: 500 }
    );
  }
}
