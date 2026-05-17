/**
 * Event-Driven ARI (Availability, Rates, Inventory) Trigger Service
 *
 * Listens for domain events (booking changes, rate changes, restriction changes)
 * and automatically queues the appropriate sync messages to all active channel
 * connections. Uses the existing queueSyncMessage from realtime-sync.ts.
 */

import { db } from '@/lib/db';
import { queueSyncMessage, SyncMessage } from './realtime-sync';

// ============================================
// TYPES
// ============================================

/** Supported event types that trigger ARI syncs */
export type ARIEventType =
  | 'booking_created'
  | 'booking_cancelled'
  | 'booking_modified'
  | 'rate_changed'
  | 'restriction_changed';

/** Input data for triggering an ARI update */
export interface ARIEventData {
  propertyId: string;
  roomTypeId: string;
  /** Optional date range for the affected dates (e.g. booking check-in/check-out) */
  dateRange?: { start: string; end: string };
  tenantId: string;
  /** Room rate (used for rate change events) */
  rate?: number;
  /** Currency for the rate */
  currency?: string;
  /** Rate plan ID */
  ratePlanId?: string;
  /** Restriction details (used for restriction change events) */
  restrictions?: {
    closedToArrival?: boolean;
    closedToDeparture?: boolean;
    closed?: boolean;
    minStay?: number;
    maxStay?: number;
  };
}

/** Result of an ARI trigger */
export interface ARITriggerResult {
  success: boolean;
  syncId: string;
  messageType: string;
  channelCount: number;
  error?: string;
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Trigger an ARI (Availability, Rates, Inventory) update across all active
 * channel connections for a property.
 *
 * - On booking events (created/cancelled/modified): queue availability sync
 *   for affected room types and dates.
 * - On rate changes: queue rate sync to all active connections.
 * - On restriction changes: queue restriction sync.
 *
 * All syncs use the existing queueSyncMessage infrastructure.
 */
export async function triggerARIUpdate(
  eventType: ARIEventType,
  data: ARIEventData,
): Promise<ARITriggerResult[]> {
  const results: ARITriggerResult[] = [];

  try {
    switch (eventType) {
      case 'booking_created':
      case 'booking_cancelled':
      case 'booking_modified': {
        // Booking events affect availability — sync inventory for the affected dates
        const availabilityResult = await queueAvailabilitySync(data);
        results.push(availabilityResult);
        break;
      }

      case 'rate_changed': {
        // Rate changes must be pushed to all channels that have rate sync enabled
        const rateResult = await queueRateSync(data);
        results.push(rateResult);
        break;
      }

      case 'restriction_changed': {
        // Restriction changes (min stay, closed, etc.) must be synced
        const restrictionResult = await queueRestrictionSync(data);
        results.push(restrictionResult);
        break;
      }

      default: {
        results.push({
          success: false,
          syncId: `unknown-${Date.now()}`,
          messageType: 'unknown',
          channelCount: 0,
          error: `Unsupported event type: ${eventType}`,
        });
      }
    }
  } catch (error) {
    console.error(`[ARI Trigger] Error processing ${eventType}:`, error);
    results.push({
      success: false,
      syncId: `error-${Date.now()}`,
      messageType: eventType,
      channelCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return results;
}

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Queue an inventory (availability) sync for booking events.
 * Determines affected dates from the booking's date range.
 */
async function queueAvailabilitySync(data: ARIEventData): Promise<ARITriggerResult> {
  // Build the date list from the date range, or default to today + 1 day
  const dates = buildDateList(data.dateRange);

  // Determine the priority: booking events are high priority
  const priority: SyncMessage['priority'] = 'high';

  const message: SyncMessage = {
    type: 'inventory_update',
    tenantId: data.tenantId,
    propertyId: data.propertyId,
    roomTypeId: data.roomTypeId,
    data: {
      dates,
      // Availability will be recalculated by the sync processor
      availability: 0,
    },
    timestamp: new Date(),
    priority,
  };

  try {
    const syncId = await queueSyncMessage(message);

    // Count active connections for this property
    const connectionCount = await db.channelConnection.count({
      where: { propertyId: data.propertyId, status: 'active' },
    });

    return {
      success: true,
      syncId,
      messageType: 'inventory_update',
      channelCount: connectionCount,
    };
  } catch (error) {
    return {
      success: false,
      syncId: `inventory-error-${Date.now()}`,
      messageType: 'inventory_update',
      channelCount: 0,
      error: error instanceof Error ? error.message : 'Failed to queue inventory sync',
    };
  }
}

/**
 * Queue a rate sync to all active channel connections.
 * Uses the provided rate and currency from the event data.
 */
async function queueRateSync(data: ARIEventData): Promise<ARITriggerResult> {
  const dates = buildDateList(data.dateRange);

  const priority: SyncMessage['priority'] = 'high';

  const message: SyncMessage = {
    type: 'rate_update',
    tenantId: data.tenantId,
    propertyId: data.propertyId,
    roomTypeId: data.roomTypeId,
    data: {
      dates,
      rate: data.rate || 0,
      currency: data.currency || 'USD',
      ratePlanId: data.ratePlanId || '',
    },
    timestamp: new Date(),
    priority,
  };

  try {
    const syncId = await queueSyncMessage(message);

    const connectionCount = await db.channelConnection.count({
      where: { propertyId: data.propertyId, status: 'active' },
    });

    return {
      success: true,
      syncId,
      messageType: 'rate_update',
      channelCount: connectionCount,
    };
  } catch (error) {
    return {
      success: false,
      syncId: `rate-error-${Date.now()}`,
      messageType: 'rate_update',
      channelCount: 0,
      error: error instanceof Error ? error.message : 'Failed to queue rate sync',
    };
  }
}

/**
 * Queue a restriction sync to all active channel connections.
 * Syncs min/max stay, closed status, and arrival/departure restrictions.
 */
async function queueRestrictionSync(data: ARIEventData): Promise<ARITriggerResult> {
  const dates = buildDateList(data.dateRange);

  const priority: SyncMessage['priority'] = 'medium';

  const message: SyncMessage = {
    type: 'restriction_update',
    tenantId: data.tenantId,
    propertyId: data.propertyId,
    roomTypeId: data.roomTypeId,
    data: {
      dates,
      restrictions: data.restrictions || {},
    },
    timestamp: new Date(),
    priority,
  };

  try {
    const syncId = await queueSyncMessage(message);

    const connectionCount = await db.channelConnection.count({
      where: { propertyId: data.propertyId, status: 'active' },
    });

    return {
      success: true,
      syncId,
      messageType: 'restriction_update',
      channelCount: connectionCount,
    };
  } catch (error) {
    return {
      success: false,
      syncId: `restriction-error-${Date.now()}`,
      messageType: 'restriction_update',
      channelCount: 0,
      error: error instanceof Error ? error.message : 'Failed to queue restriction sync',
    };
  }
}

/**
 * Build a list of date strings from a date range.
 * If no date range is provided, defaults to today only.
 */
function buildDateList(dateRange?: { start: string; end: string }): string[] {
  if (!dateRange?.start || !dateRange?.end) {
    // Default to today
    return [new Date().toISOString().split('T')[0]];
  }

  const dates: string[] = [];
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  return dates;
}
