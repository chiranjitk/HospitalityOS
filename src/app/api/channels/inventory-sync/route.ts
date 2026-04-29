import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { OTASyncService } from '@/lib/ota/sync-service';
import { OTAClientFactory } from '@/lib/ota/client-factory';
import { OTAInventoryUpdate } from '@/lib/ota/types';

// Helper: build inventory update payloads for a given property and its room types
async function buildInventoryUpdates(
  tenantId: string,
  propertyId: string
): Promise<OTAInventoryUpdate[]> {
  // Get room types with their rooms for this property
  const roomTypes = await db.roomType.findMany({
    where: { propertyId, deletedAt: null },
    include: {
      rooms: {
        select: { id: true, status: true },
      },
    },
  });

  // Build availability for the next 30 days
  const today = new Date();
  const updates: OTAInventoryUpdate[] = [];

  for (const roomType of roomTypes) {
    const totalRooms = roomType.rooms.length;
    const availableRooms = roomType.rooms.filter(r => r.status === 'available').length;

    for (let d = 0; d < 30; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];

      updates.push({
        roomTypeId: roomType.id,
        externalRoomId: '', // will be mapped by the sync service using channel mappings
        date: dateStr,
        availableRooms,
        totalRooms,
      });
    }
  }

  return updates;
}

// GET /api/channels/inventory-sync - Get inventory sync status
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view inventory sync' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get active channel connections
    const connections = await db.channelConnection.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { channelMappings: true },
        },
      },
    });

    // Get properties with room types and rooms for this tenant
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        roomTypes: {
          where: { deletedAt: null },
          include: {
            rooms: {
              select: { id: true, status: true },
            },
          },
        },
      },
    });

    const roomTypes = properties.flatMap(p => p.roomTypes);

    // Get recent sync logs
    const syncLogs = await db.channelSyncLog.findMany({
      where: {
        connection: { tenantId },
        syncType: 'inventory',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Build sync status data
    const syncData: Array<{
      connectionId: string;
      channelName: string;
      channelType: string;
      roomType: string;
      available: number;
      total: number;
      lastSync: Date | null;
      status: string;
      syncDirection: string;
    }> = [];

    for (const connection of connections) {
      for (const roomType of roomTypes) {
        const total = roomType.rooms?.length || 0;
        const available = roomType.rooms?.filter(r => r.status === 'available').length || 0;
        
        // Find last sync for this connection
        const lastSyncLog = syncLogs.find(l => l.connectionId === connection.id);
        
        // Determine status based on last sync
        let status = 'synced';
        if (!lastSyncLog) {
          status = 'pending';
        } else if (lastSyncLog.status === 'failed') {
          status = 'error';
        } else {
          const syncAge = Date.now() - new Date(lastSyncLog.createdAt).getTime();
          if (syncAge > 30 * 60 * 1000) { // 30 minutes
            status = 'out_of_sync';
          }
        }

        syncData.push({
          connectionId: connection.id,
          channelName: connection.displayName || connection.channel,
          channelType: connection.channel,
          roomType: roomType.name,
          available,
          total,
          lastSync: lastSyncLog?.createdAt || null,
          status,
          syncDirection: 'bidirectional',
        });
      }
    }

    // Calculate stats
    const stats = {
      totalRoomTypes: syncData.length,
      syncedCount: syncData.filter(d => d.status === 'synced').length,
      pendingCount: syncData.filter(d => d.status === 'pending').length,
      errorCount: syncData.filter(d => d.status === 'error').length,
      outOfSyncCount: syncData.filter(d => d.status === 'out_of_sync').length,
      lastGlobalSync: syncLogs[0]?.createdAt || null,
    };

    return NextResponse.json({
      success: true,
      data: syncData,
      stats,
    });
  } catch (error) {
    console.error('Error fetching inventory sync:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch inventory sync' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/inventory-sync - Trigger inventory sync
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to sync inventory' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, channelName, propertyId } = body;

    if (action === 'syncAll') {
      // Get all active connections for the tenant
      const connections = await db.channelConnection.findMany({
        where: { tenantId: user.tenantId, status: 'active' },
      });

      if (connections.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No active channel connections to sync',
          results: [],
        });
      }

      // Get all properties for this tenant
      const properties = await db.property.findMany({
        where: { tenantId: user.tenantId, deletedAt: null },
        select: { id: true },
      });

      if (properties.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No properties found',
          results: [],
        });
      }

      // Build inventory updates per property and sync to each channel
      const results: Array<{
        connectionId: string;
        channelName: string;
        status: 'success' | 'failed' | 'partial';
        recordsProcessed: number;
        error?: string;
      }> = [];

      for (const connection of connections) {
        if (!connection.propertyId) {
          // Find a property for this connection if not explicitly set
          const prop = properties[0];
          if (!prop) continue;
          connection.propertyId = prop.id;
        }

        try {
          const updates = await buildInventoryUpdates(user.tenantId, connection.propertyId);
          await OTASyncService.syncInventoryToChannel(connection.id, updates);

          results.push({
            connectionId: connection.id,
            channelName: connection.displayName || connection.channel,
            status: 'success',
            recordsProcessed: updates.length,
          });
        } catch (error) {
          console.error(`Inventory sync failed for ${connection.channel}:`, error);
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
        message: `Synced inventory to ${succeeded} of ${connections.length} channels (${failed} failed)`,
        results,
      });
    }

    if (action === 'syncChannel' && channelName) {
      // Find the connection
      const connection = await db.channelConnection.findFirst({
        where: { tenantId: user.tenantId, channel: channelName, status: 'active' },
      });

      if (!connection) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found' } },
          { status: 404 }
        );
      }

      // Use provided propertyId or fall back to connection.propertyId
      const targetPropertyId = propertyId || connection.propertyId;
      if (!targetPropertyId) {
        return NextResponse.json(
          { success: false, error: { code: 'MISSING_PROPERTY', message: 'No property associated with this channel connection' } },
          { status: 400 }
        );
      }

      try {
        const updates = await buildInventoryUpdates(user.tenantId, targetPropertyId);
        await OTASyncService.syncInventoryToChannel(connection.id, updates);

        return NextResponse.json({
          success: true,
          message: `Synced inventory to ${channelName} (${updates.length} records)`,
          data: {
            connectionId: connection.id,
            channelName,
            propertyId: targetPropertyId,
            recordsProcessed: updates.length,
          },
        });
      } catch (error) {
        console.error(`Inventory sync failed for ${channelName}:`, error);
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'SYNC_FAILED',
              message: `Failed to sync inventory to ${channelName}`,
              details: error instanceof Error ? error.message : 'Unknown error',
            },
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error syncing inventory:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to sync inventory' } },
      { status: 500 }
    );
  }
}
