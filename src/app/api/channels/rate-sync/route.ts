import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { OTASyncService } from '@/lib/ota/sync-service';
import { OTARateUpdate } from '@/lib/ota/types';

// Helper: build rate update payloads for a given property and its rate plans
async function buildRateUpdates(
  tenantId: string,
  propertyId: string
): Promise<OTARateUpdate[]> {
  // Get rate plans with their room types for this property
  const ratePlans = await db.ratePlan.findMany({
    where: {
      roomType: { propertyId, deletedAt: null },
      deletedAt: null,
    },
    include: {
      roomType: {
        select: { id: true, name: true },
      },
    },
  });

  // Build rates for the next 30 days
  const today = new Date();
  const updates: OTARateUpdate[] = [];

  for (const ratePlan of ratePlans) {
    for (let d = 0; d < 30; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];

      // Check for price override
      const priceOverride = await db.priceOverride.findFirst({
        where: {
          ratePlanId: ratePlan.id,
          date: new Date(dateStr + 'T00:00:00.000Z'),
        },
      });

      const basePrice = priceOverride?.price ?? ratePlan.basePrice;

      updates.push({
        roomTypeId: ratePlan.roomTypeId,
        ratePlanId: ratePlan.id,
        externalRoomId: '', // will be mapped by the sync service using channel mappings
        externalRatePlanId: '', // will be mapped by the sync service using channel mappings
        date: dateStr,
        baseRate: basePrice,
        currency: ratePlan.currency || 'USD',
      });
    }
  }

  return updates;
}

// GET /api/channels/rate-sync - Get rate sync status
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view rate sync' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get active channel connections
    const connections = await db.channelConnection.findMany({
      where: { tenantId },
    });

    // Get rate plans through property relationship
    const ratePlans = await db.ratePlan.findMany({
      where: { 
        roomType: { property: { tenantId } },
        deletedAt: null 
      },
      include: {
        roomType: {
          select: { name: true },
        },
      },
    });

    // Get channel mappings for rate info
    const mappings = await db.channelMapping.findMany({
      where: {
        connection: { tenantId },
        syncRates: true,
      },
    });

    // Get recent rate sync logs
    const syncLogs = await db.channelSyncLog.findMany({
      where: {
        connection: { tenantId },
        syncType: 'rates',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Get price overrides for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const priceOverrides = await db.priceOverride.findMany({
      where: {
        ratePlan: { roomType: { property: { tenantId } } },
        date: today,
      },
    });

    // Build rate sync data
    const rateData: Array<{
      id: string;
      connectionId: string;
      channelName: string;
      channelType: string;
      roomType: string;
      ratePlan: string;
      basePrice: number;
      channelPrice: number;
      priceDiff: number;
      currency: string;
      lastSync: Date | null;
      status: string;
      autoAdjust: boolean;
    }> = [];

    for (const connection of connections) {
      for (const ratePlan of ratePlans) {
        const lastSyncLog = syncLogs.find(l => l.connectionId === connection.id);
        const mapping = mappings.find(m => m.connectionId === connection.id && m.roomTypeId === ratePlan.roomTypeId);

        const priceOverride = priceOverrides.find(po => po.ratePlanId === ratePlan.id);
        const basePrice = priceOverride?.price ?? ratePlan.basePrice;

        // Channel price comes from the mapping or sync log data
        let channelPrice = basePrice;
        let priceDiff = 0;

        if (lastSyncLog?.responsePayload) {
          try {
            const responseData = JSON.parse(lastSyncLog.responsePayload as string);
            if (responseData.channelPrice !== undefined) {
              channelPrice = responseData.channelPrice;
              priceDiff = Math.round((channelPrice - basePrice) * 100) / 100;
            }
          } catch {
            // Invalid JSON, use default
          }
        }

        // Determine status
        let status = 'synced';
        if (!mapping) {
          status = 'not_mapped';
        } else if (!lastSyncLog) {
          status = 'pending';
        } else if (lastSyncLog.status === 'failed') {
          status = 'error';
        } else if (Math.abs(priceDiff) > 1) {
          status = priceDiff > 0 ? 'higher' : 'lower';
        }

        rateData.push({
          id: `${connection.id}::${ratePlan.id}`,
          connectionId: connection.id,
          channelName: connection.displayName || connection.channel,
          channelType: connection.channel,
          roomType: ratePlan.roomType?.name || 'Unknown',
          ratePlan: ratePlan.name,
          basePrice,
          channelPrice,
          priceDiff,
          currency: ratePlan.currency || 'USD',
          lastSync: lastSyncLog?.createdAt || null,
          status,
          autoAdjust: connection.autoSync,
        });
      }
    }

    // Calculate stats
    const stats = {
      total: rateData.length,
      synced: rateData.filter(d => d.status === 'synced').length,
      outOfSync: rateData.filter(d => ['higher', 'lower'].includes(d.status)).length,
      errors: rateData.filter(d => d.status === 'error').length,
      pending: rateData.filter(d => d.status === 'pending').length,
      notMapped: rateData.filter(d => d.status === 'not_mapped').length,
      avgBasePrice: rateData.length > 0
        ? Math.round(rateData.reduce((sum, d) => sum + d.basePrice, 0) / rateData.length)
        : 0,
    };

    return NextResponse.json({
      success: true,
      data: rateData,
      stats,
    });
  } catch (error) {
    console.error('Error fetching rate sync:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rate sync' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/rate-sync - Update rate sync settings or trigger sync
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to update rates' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, id, channelPrice, propertyId, channelName } = body;

    // ---- Action: syncAll ----
    if (action === 'syncAll') {
      const connections = await db.channelConnection.findMany({
        where: { tenantId: user.tenantId, status: 'active' },
      });

      if (connections.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No active channel connections to sync rates',
          results: [],
        });
      }

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

      const results: Array<{
        connectionId: string;
        channelName: string;
        status: 'success' | 'failed' | 'partial';
        recordsProcessed: number;
        error?: string;
      }> = [];

      for (const connection of connections) {
        const targetPropertyId = connection.propertyId || properties[0]?.id;
        if (!targetPropertyId) continue;

        try {
          const updates = await buildRateUpdates(user.tenantId, targetPropertyId);
          await OTASyncService.syncRatesToChannel(connection.id, updates);

          results.push({
            connectionId: connection.id,
            channelName: connection.displayName || connection.channel,
            status: 'success',
            recordsProcessed: updates.length,
          });
        } catch (error) {
          console.error(`Rate sync failed for ${connection.channel}:`, error);
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
        message: `Synced rates to ${succeeded} of ${connections.length} channels (${failed} failed)`,
        results,
      });
    }

    // ---- Action: syncChannel ----
    if (action === 'syncChannel' && channelName) {
      const connection = await db.channelConnection.findFirst({
        where: { tenantId: user.tenantId, channel: channelName, status: 'active' },
      });

      if (!connection) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found' } },
          { status: 404 }
        );
      }

      const targetPropertyId = propertyId || connection.propertyId;
      if (!targetPropertyId) {
        return NextResponse.json(
          { success: false, error: { code: 'MISSING_PROPERTY', message: 'No property associated with this channel connection' } },
          { status: 400 }
        );
      }

      try {
        const updates = await buildRateUpdates(user.tenantId, targetPropertyId);
        await OTASyncService.syncRatesToChannel(connection.id, updates);

        return NextResponse.json({
          success: true,
          message: `Synced rates to ${channelName} (${updates.length} records)`,
          data: {
            connectionId: connection.id,
            channelName,
            propertyId: targetPropertyId,
            recordsProcessed: updates.length,
          },
        });
      } catch (error) {
        console.error(`Rate sync failed for ${channelName}:`, error);
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'SYNC_FAILED',
              message: `Failed to sync rates to ${channelName}`,
              details: error instanceof Error ? error.message : 'Unknown error',
            },
          },
          { status: 500 }
        );
      }
    }

    // ---- Action: updatePrice (single rate override) ----
    if (action === 'updatePrice' && id && channelPrice !== undefined) {
      // Parse connectionId and ratePlanId from composite id
      let connectionId: string | undefined;
      let ratePlanId: string | undefined;

      if (id.includes('::')) {
        const parts = id.split('::');
        connectionId = parts[0];
        ratePlanId = parts.slice(1).join('::');
      } else {
        const parts = id.split('-');
        if (parts.length >= 2) {
          connectionId = parts[0];
          ratePlanId = parts.slice(1).join('-');
        }
      }

      if (!connectionId || !ratePlanId) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ID', message: 'Invalid composite ID format' } },
          { status: 400 }
        );
      }

      // Verify connection belongs to user's tenant
      const connection = await db.channelConnection.findFirst({
        where: { id: connectionId, tenantId: user.tenantId },
      });

      if (!connection) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Connection not found' } },
          { status: 404 }
        );
      }

      // SECURITY FIX (H-2): Track OTA push outcome and log truthfully.
      // Previously this always logged 'success' even when OTA push failed.
      let otaPushSuccess = false;
      let otaPushError: string | null = null;

      // Attempt to sync the single price update via OTA client
      try {
        const ratePlan = await db.ratePlan.findFirst({
          where: { id: ratePlanId, roomType: { property: { tenantId: user.tenantId } } },
        });

        if (ratePlan) {
          const today = new Date().toISOString().split('T')[0];
          const update: OTARateUpdate = {
            roomTypeId: ratePlan.roomTypeId,
            ratePlanId: ratePlan.id,
            externalRoomId: '',
            externalRatePlanId: '',
            date: today,
            baseRate: channelPrice,
            currency: ratePlan.currency || 'USD',
          };

          await OTASyncService.syncRatesToChannel(connection.id, [update]);
          otaPushSuccess = true;
        } else {
          otaPushSuccess = false;
          otaPushError = 'Rate plan not found';
        }
      } catch (error) {
        console.error(`Rate push failed for connection ${connectionId}:`, error);
        otaPushSuccess = false;
        otaPushError = error instanceof Error ? error.message : 'Unknown OTA push error';
      }

      // Create a sync log entry for the rate update — accurately reflects OTA push result
      await db.channelSyncLog.create({
        data: {
          connectionId,
          syncType: 'rates',
          direction: 'outbound',
          status: otaPushSuccess ? 'success' : 'failed',
          requestPayload: JSON.stringify({ ratePlanId, channelPrice }),
          responsePayload: JSON.stringify({
            channelPrice,
            syncedAt: new Date().toISOString(),
            otaPushSuccess,
            ...(otaPushError ? { error: otaPushError } : {}),
          }),
          ...(otaPushError ? { errorMessage: otaPushError } : {}),
        },
      });

      // Update connection last sync time
      await db.channelConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: 'Rate updated successfully',
        data: { id, channelPrice },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action or missing parameters' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating rate sync:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update rate sync' } },
      { status: 500 }
    );
  }
}
