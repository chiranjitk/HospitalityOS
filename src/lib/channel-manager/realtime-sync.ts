/**
 * Real-time Channel Sync Service
 * Provides WebSocket-based real-time inventory synchronization with OTAs
 */

import { db } from '@/lib/db';
import { OTAClientFactory } from '@/lib/ota/client-factory';
import { OTACredentials } from '@/lib/ota/types';

// ============================================
// SYNC TYPE MAPPING
// ============================================

function syncMessageToSyncType(type: SyncMessage['type']): string {
  const map: Record<string, string> = {
    inventory_update: 'inventory',
    rate_update: 'rates',
    restriction_update: 'restrictions',
    booking_update: 'bookings',
  };
  return map[type] || type;
}

// Type definitions
export interface SyncMessage {
  type: 'inventory_update' | 'rate_update' | 'booking_update' | 'restriction_update';
  propertyId: string;
  roomTypeId?: string;
  tenantId: string;
  data: Record<string, unknown>;
  timestamp: Date;
  priority: 'high' | 'medium' | 'low';
}

export interface SyncSubscription {
  id: string;
  propertyId: string;
  channelCode: string;
  connectionId: string;
  lastSync: Date;
  status: 'active' | 'paused' | 'error';
}

export interface SyncResult {
  channelCode: string;
  success: boolean;
  message?: string;
  syncId?: string;
  error?: string;
}

// Channel priority mapping for sync order
const CHANNEL_PRIORITY: Record<string, number> = {
  booking_com: 1,
  expedia: 2,
  airbnb: 3,
  hotels_com: 4,
  agoda: 5,
  tripadvisor: 6,
  makemytrip: 7,
  google_hotels: 8,
  goibibo: 9,
  booking: 1,        // alias
  airbnb: 3,         // alias
  expedia: 2,        // alias
};

/**
 * Queue a sync message for processing
 */
export async function queueSyncMessage(message: SyncMessage): Promise<string> {
  if (!message.tenantId) {
    throw new Error('tenantId is required for sync messages');
  }

  try {
    // Get active channel connections for this property
    const connections = await db.channelConnection.findMany({
      where: {
        propertyId: message.propertyId,
        status: 'active',
      },
    });

    if (connections.length === 0) {
      // Create a placeholder log using the first connection or return a generated ID
      return `no-connection-${Date.now()}`;
    }

    // Use the first active connection for the sync log
    const primaryConnection = connections[0];

    // Create sync log entry (using actual schema fields)
    const syncLog = await db.channelSyncLog.create({
      data: {
        connectionId: primaryConnection.id,
        syncType: syncMessageToSyncType(message.type),
        direction: 'outbound',
        requestPayload: JSON.stringify(message.data),
        status: 'pending',
        correlationId: `${message.type}-${Date.now()}`,
      },
    });

    // If high priority, process immediately
    if (message.priority === 'high') {
      await processSyncMessage(syncLog.id, message);
    }

    return syncLog.id;
  } catch (error) {
    console.error('Error queuing sync message:', error);
    throw error;
  }
}

/**
 * Process a single sync message
 */
export async function processSyncMessage(syncLogId: string, message: SyncMessage): Promise<SyncResult[]> {
  try {
    // Get active channel connections for this property
    const connections = await db.channelConnection.findMany({
      where: {
        propertyId: message.propertyId,
        status: 'active',
      },
    });

    if (connections.length === 0) {
      // Update sync log
      await db.channelSyncLog.update({
        where: { id: syncLogId },
        data: {
          status: 'skipped',
          errorMessage: 'No active channel connections',
        },
      });
      return [];
    }

    // Sort by priority
    const sortedConnections = connections.sort((a, b) => {
      const priorityA = CHANNEL_PRIORITY[a.channel] || 99;
      const priorityB = CHANNEL_PRIORITY[b.channel] || 99;
      return priorityA - priorityB;
    });

    const results: SyncResult[] = [];

    // Process each channel
    for (const connection of sortedConnections) {
      try {
        // Parse credentials from JSON string
        let credentials: Record<string, unknown> = {};
        if (connection.credentials) {
          try {
            credentials = JSON.parse(connection.credentials);
          } catch {
            credentials = {};
          }
        }

        const result = await syncToChannel(
          { id: connection.id, channelCode: connection.channel, credentials },
          message
        );
        results.push(result);

        // Create individual sync log
        await db.channelSyncLog.create({
          data: {
            connectionId: connection.id,
            syncType: syncMessageToSyncType(message.type),
            direction: 'outbound',
            requestPayload: JSON.stringify(message.data),
            responsePayload: JSON.stringify(result),
            status: result.success ? 'success' : 'failed',
            errorMessage: result.error,
            correlationId: `${connection.channel}-${Date.now()}`,
          },
        });

        // Update last sync time (field is lastSyncAt, not lastSync)
        await db.channelConnection.update({
          where: { id: connection.id },
          data: { lastSyncAt: new Date() },
        });
      } catch (error) {
        console.error(`Error syncing to ${connection.channel}:`, error);
        results.push({
          channelCode: connection.channel,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update main sync log
    const allSuccess = results.every((r) => r.success);
    await db.channelSyncLog.update({
      where: { id: syncLogId },
      data: {
        status: allSuccess ? 'success' : 'partial',
        responsePayload: JSON.stringify({
          synced: results.filter((r) => r.success).length,
          total: results.length,
        }),
      },
    });

    return results;
  } catch (error) {
    console.error('Error processing sync message:', error);
    await db.channelSyncLog.update({
      where: { id: syncLogId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    throw error;
  }
}

/**
 * Sync to a specific channel
 */
async function syncToChannel(
  connection: { id: string; channelCode: string; credentials: unknown },
  message: SyncMessage
): Promise<SyncResult> {
  const channelCode = connection.channelCode;
  const credentials = connection.credentials as Record<string, unknown>;

  try {
    switch (message.type) {
      case 'inventory_update':
        return await syncInventory(connection.id, channelCode, credentials, message);
      case 'rate_update':
        return await syncRates(connection.id, channelCode, credentials, message);
      case 'restriction_update':
        return await syncRestrictions(connection.id, channelCode, credentials, message);
      default:
        return { channelCode, success: false, error: 'Unknown message type' };
    }
  } catch (error) {
    return {
      channelCode,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync inventory to channel
 */
async function syncInventory(
  connectionId: string,
  channelCode: string,
  credentials: Record<string, unknown>,
  message: SyncMessage
): Promise<SyncResult> {
  const data = message.data;
  const dates = (data.dates as string[]) || [];
  const availability = data.availability as number;

  console.log(`Syncing inventory to ${channelCode}:`, {
    propertyId: message.propertyId,
    roomTypeId: message.roomTypeId,
    dates,
    availability,
  });

  try {
    const client = await OTAClientFactory.getAuthenticatedClient(
      channelCode,
      credentials as OTACredentials
    );
    if (!client) {
      return {
        channelCode,
        success: false,
        error: `Failed to create or authenticate OTA client for ${channelCode}`,
      };
    }

    // Look up the actual external room ID from channel mapping
    const mapping = await db.channelMapping.findFirst({
      where: {
        connectionId,
        roomTypeId: message.roomTypeId || '',
        status: 'active',
      },
    });
    const externalRoomId = mapping?.externalRoomId || message.roomTypeId || '';

    const updates = dates.map((date) => ({
      roomTypeId: message.roomTypeId || '',
      externalRoomId,
      date,
      availableRooms: availability,
      totalRooms: availability,
    }));

    const response = await client.updateInventory(updates);

    if (response.success) {
      return {
        channelCode,
        success: true,
        message: `Inventory updated for ${dates.length} dates`,
        syncId: response.correlationId,
      };
    }

    return {
      channelCode,
      success: false,
      error: response.errors?.map((e) => e.message).join(', ') || 'Inventory sync failed',
      syncId: response.correlationId,
    };
  } catch (error) {
    return {
      channelCode,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during inventory sync',
    };
  }
}

/**
 * Sync rates to channel
 */
async function syncRates(
  connectionId: string,
  channelCode: string,
  credentials: Record<string, unknown>,
  message: SyncMessage
): Promise<SyncResult> {
  const data = message.data;
  const dates = (data.dates as string[]) || [];
  const rate = data.rate as number;
  const currency = (data.currency as string) || 'USD';

  console.log(`Syncing rates to ${channelCode}:`, {
    propertyId: message.propertyId,
    roomTypeId: message.roomTypeId,
    rate,
    dates,
  });

  try {
    const client = await OTAClientFactory.getAuthenticatedClient(
      channelCode,
      credentials as OTACredentials
    );
    if (!client) {
      return {
        channelCode,
        success: false,
        error: `Failed to create or authenticate OTA client for ${channelCode}`,
      };
    }

    // Look up the actual external room ID from channel mapping
    const mapping = await db.channelMapping.findFirst({
      where: {
        connectionId,
        roomTypeId: message.roomTypeId || '',
        status: 'active',
      },
    });
    const externalRoomId = mapping?.externalRoomId || message.roomTypeId || '';

    const updates = dates.map((date) => ({
      roomTypeId: message.roomTypeId || '',
      ratePlanId: (data.ratePlanId as string) || '',
      externalRoomId,
      externalRatePlanId: mapping?.externalRateId || (data.externalRatePlanId as string) || '',
      date,
      baseRate: rate,
      currency,
    }));

    const response = await client.updateRates(updates);

    if (response.success) {
      return {
        channelCode,
        success: true,
        message: `Rate updated to ${rate} for ${dates.length} dates`,
        syncId: response.correlationId,
      };
    }

    return {
      channelCode,
      success: false,
      error: response.errors?.map((e) => e.message).join(', ') || 'Rate sync failed',
      syncId: response.correlationId,
    };
  } catch (error) {
    return {
      channelCode,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during rate sync',
    };
  }
}

/**
 * Sync restrictions to channel
 */
async function syncRestrictions(
  connectionId: string,
  channelCode: string,
  credentials: Record<string, unknown>,
  message: SyncMessage
): Promise<SyncResult> {
  const data = message.data;
  const dates = (data.dates as string[]) || [];
  const restrictions = data.restrictions as Record<string, unknown> | undefined;

  console.log(`Syncing restrictions to ${channelCode}:`, {
    propertyId: message.propertyId,
    restrictions,
  });

  try {
    const client = await OTAClientFactory.getAuthenticatedClient(
      channelCode,
      credentials as OTACredentials
    );
    if (!client) {
      return {
        channelCode,
        success: false,
        error: `Failed to create or authenticate OTA client for ${channelCode}`,
      };
    }

    // Look up the actual external room ID from channel mapping
    const mapping = await db.channelMapping.findFirst({
      where: {
        connectionId,
        roomTypeId: message.roomTypeId || '',
        status: 'active',
      },
    });
    const externalRoomId = mapping?.externalRoomId || message.roomTypeId || '';

    const updates = dates.map((date) => ({
      roomTypeId: message.roomTypeId || '',
      externalRoomId,
      date,
      closedToArrival: (restrictions?.closedToArrival as boolean) || false,
      closedToDeparture: (restrictions?.closedToDeparture as boolean) || false,
      closed: (restrictions?.closed as boolean) || false,
      minStayThrough: (restrictions?.minStay as number) || 1,
      maxStayThrough: (restrictions?.maxStay as number) || 99,
    }));

    const response = await client.updateRestrictions(updates);

    if (response.success) {
      return {
        channelCode,
        success: true,
        message: `Restrictions updated for ${dates.length} dates`,
        syncId: response.correlationId,
      };
    }

    return {
      channelCode,
      success: false,
      error: response.errors?.map((e) => e.message).join(', ') || 'Restrictions sync failed',
      syncId: response.correlationId,
    };
  } catch (error) {
    return {
      channelCode,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during restrictions sync',
    };
  }
}

/**
 * Trigger inventory sync after booking change
 */
export async function triggerInventorySync(
  tenantId: string,
  propertyId: string,
  roomTypeId: string,
  dates: Date[],
  priority: 'high' | 'medium' | 'low' = 'medium'
): Promise<string> {
  // Get current availability
  const availability = await calculateAvailability(propertyId, roomTypeId, dates);

  const message: SyncMessage = {
    type: 'inventory_update',
    tenantId,
    propertyId,
    roomTypeId,
    data: {
      dates: dates.map((d) => d.toISOString().split('T')[0]),
      availability,
    },
    timestamp: new Date(),
    priority,
  };

  return queueSyncMessage(message);
}

/**
 * Calculate availability for dates
 */
async function calculateAvailability(
  propertyId: string,
  roomTypeId: string,
  dates: Date[]
): Promise<number> {
  const rooms = await db.room.count({
    where: { propertyId, roomTypeId },
  });

  if (rooms === 0) return 0;
  return rooms;
}

/**
 * Batch sync for scheduled updates
 */
export async function batchSyncInventory(
  tenantId: string,
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<SyncResult[]> {
  const roomTypes = await db.roomType.findMany({
    where: { propertyId },
    select: { id: true },
  });

  const results: SyncResult[] = [];

  const dates: Date[] = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d));
  }

  for (const roomType of roomTypes) {
    const syncId = await triggerInventorySync(tenantId, propertyId, roomType.id, dates, 'low');
    results.push({
      channelCode: 'batch',
      success: true,
      syncId,
      message: `Queued sync for room type ${roomType.id}`,
    });
  }

  return results;
}
