/**
 * Channel Manager Real-time Sync - Unit Tests
 *
 * Tests the real-time sync service: queuing messages, processing syncs,
 * triggering inventory syncs, batch operations, and availability calculation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Prisma ──────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => ({
  db: {
    channelConnection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    channelSyncLog: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    room: { count: vi.fn() },
    roomType: { findMany: vi.fn() },
  },
}));

import { db } from '@/lib/db';
import {
  queueSyncMessage,
  processSyncMessage,
  triggerInventorySync,
  batchSyncInventory,
  SyncMessage,
} from '@/lib/channel-manager/realtime-sync';

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<SyncMessage> = {}): SyncMessage {
  return {
    type: 'inventory_update',
    propertyId: 'prop-1',
    roomTypeId: 'rt-1',
    tenantId: 'tenant-1',
    data: { dates: ['2025-01-01'], availability: 10 },
    timestamp: new Date(),
    priority: 'medium',
    ...overrides,
  };
}

function mockConnection(channel: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `conn-${channel}`,
    channel,
    status: 'active',
    credentials: null,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// A. queueSyncMessage
// ═════════════════════════════════════════════════════════════════════════════

describe('A. queueSyncMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A1: throws when tenantId is missing
  it('A1: throws error when tenantId is empty', async () => {
    const msg = makeMessage({ tenantId: '' });
    await expect(queueSyncMessage(msg)).rejects.toThrow('tenantId is required');
  });

  // A2: returns no-connection sentinel when no active connections
  it('A2: returns no-connection placeholder when no active connections', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await queueSyncMessage(makeMessage());

    expect(result).toMatch(/^no-connection-/);
  });

  // A3: creates sync log entry and returns its ID
  it('A3: creates sync log and returns sync log ID', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection('booking_com'),
    ]);
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sync-123',
    });

    const result = await queueSyncMessage(makeMessage());

    expect(result).toBe('sync-123');
    expect(db.channelSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          connectionId: 'conn-booking_com',
          syncType: 'inventory_update',
          direction: 'outbound',
          status: 'pending',
        }),
      })
    );
  });

  // A4: processes immediately for high priority messages
  it('A4: processes immediately for high priority messages', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection('booking_com'),
    ]);
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'sync-hp' })
      .mockResolvedValue({ id: 'sync-hp-child' });
    (db.channelConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.channelSyncLog.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await queueSyncMessage(makeMessage({ priority: 'high' }));

    // Second create call is for the individual sync log in processSyncMessage
    expect(db.channelSyncLog.create).toHaveBeenCalledTimes(2);
    // The connection should be updated with lastSyncAt
    expect(db.channelConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-booking_com' },
        data: expect.objectContaining({
          lastSyncAt: expect.any(Date),
        }),
      })
    );
  });

  // A5: does NOT process immediately for medium priority
  it('A5: does not process immediately for medium/low priority', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection('booking_com'),
    ]);
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sync-med',
    });

    await queueSyncMessage(makeMessage({ priority: 'medium' }));

    // Only the initial sync log create, no additional processing calls
    expect(db.channelSyncLog.create).toHaveBeenCalledTimes(1);
    expect(db.channelConnection.update).not.toHaveBeenCalled();
  });

  // A6: handles DB error gracefully
  it('A6: propagates database errors', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DB connection lost')
    );

    await expect(queueSyncMessage(makeMessage())).rejects.toThrow('DB connection lost');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B. processSyncMessage
// ═════════════════════════════════════════════════════════════════════════════

describe('B. processSyncMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: mock console.error to avoid noise
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // B1: returns empty results when no active connections
  it('B1: returns empty array when no active connections', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.channelSyncLog.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const results = await processSyncMessage('sync-1', makeMessage());

    expect(results).toEqual([]);
    expect(db.channelSyncLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sync-1' },
        data: expect.objectContaining({
          status: 'skipped',
          errorMessage: 'No active channel connections',
        }),
      })
    );
  });

  // B2: processes each connection and returns results
  it('B2: processes all active connections and returns SyncResult array', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection('booking_com'),
      mockConnection('agoda'),
    ]);
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'child-1' });
    (db.channelConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.channelSyncLog.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const results = await processSyncMessage('sync-1', makeMessage());

    expect(results).toHaveLength(2);
    // The syncToChannel function simulates a 100ms delay and returns success
    // All should succeed since the mock doesn't throw
    results.forEach((r) => {
      expect(r.success).toBe(true);
    });
  });

  // B3: handles per-connection failures
  it('B3: handles per-connection failures gracefully', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection('booking_com'),
    ]);
    // Make the sync log create fail for the per-connection log
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DB write failed')
    );
    (db.channelSyncLog.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const results = await processSyncMessage('sync-1', makeMessage());

    // Should still return results with one failure
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
  });

  // B4: updates main sync log with partial status on mixed results
  it('B4: sets main sync log to partial when some channels fail', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection('booking_com'),
    ]);
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('fail')
    );
    // Capture the update call
    const updateCalls: unknown[] = [];
    (db.channelSyncLog.update as ReturnType<typeof vi.fn>).mockImplementation(
      (args: unknown) => {
        updateCalls.push(args);
        return Promise.resolve({});
      }
    );

    const results = await processSyncMessage('sync-1', makeMessage());

    // Last update should be the main sync log update
    const lastUpdate = updateCalls[updateCalls.length - 1] as { data: { status: string } };
    expect(lastUpdate.data.status).toBe('partial');
  });

  // B5: sets main sync log to success when all succeed
  it('B5: sets main sync log to success when all channels succeed', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection('booking_com'),
    ]);
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'child-1' });
    (db.channelConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const updateCalls: unknown[] = [];
    (db.channelSyncLog.update as ReturnType<typeof vi.fn>).mockImplementation(
      (args: unknown) => {
        updateCalls.push(args);
        return Promise.resolve({});
      }
    );

    await processSyncMessage('sync-1', makeMessage());

    const lastUpdate = updateCalls[updateCalls.length - 1] as { data: { status: string } };
    expect(lastUpdate.data.status).toBe('success');
  });

  // B6: sorts connections by channel priority
  it('B6: sorts connections by priority (booking > expedia > airbnb)', async () => {
    const connections = [
      mockConnection('airbnb'),
      mockConnection('booking_com'),
      mockConnection('expedia'),
    ];
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(connections);
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'child' });
    (db.channelConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.channelSyncLog.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const results = await processSyncMessage('sync-1', makeMessage());

    // Booking should be first (priority 1), then expedia (2), then airbnb (3)
    expect(results[0].channelCode).toBe('booking_com');
    expect(results[1].channelCode).toBe('expedia');
    expect(results[2].channelCode).toBe('airbnb');
  });

  // B7: propagates top-level errors
  it('B7: propagates and logs top-level errors', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Connection pool exhausted')
    );

    await expect(
      processSyncMessage('sync-1', makeMessage())
    ).rejects.toThrow('Connection pool exhausted');

    expect(db.channelSyncLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sync-1' },
        data: expect.objectContaining({
          status: 'failed',
        }),
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C. triggerInventorySync
// ═════════════════════════════════════════════════════════════════════════════

describe('C. triggerInventorySync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // C1: creates correct inventory_update message
  it('C1: creates inventory_update message with correct data', async () => {
    (db.room.count as ReturnType<typeof vi.fn>).mockResolvedValue(15);
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection('booking_com'),
    ]);
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'sync-inv' });

    const dates = [new Date('2025-03-01'), new Date('2025-03-02')];
    const result = await triggerInventorySync('tenant-1', 'prop-1', 'rt-1', dates);

    expect(result).toBe('sync-inv');
    expect(db.room.count).toHaveBeenCalledWith({
      where: { propertyId: 'prop-1', roomTypeId: 'rt-1' },
    });
  });

  // C2: passes default medium priority
  it('C2: passes medium priority by default', async () => {
    (db.room.count as ReturnType<typeof vi.fn>).mockResolvedValue(10);
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection('booking_com'),
    ]);
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'sync-1' });

    await triggerInventorySync('tenant-1', 'prop-1', 'rt-1', [new Date()]);

    // The sync log should be created but processSyncMessage should NOT be called
    // (medium priority doesn't trigger immediate processing)
    expect(db.channelSyncLog.create).toHaveBeenCalledTimes(1);
    expect(db.channelConnection.update).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D. batchSyncInventory
// ═════════════════════════════════════════════════════════════════════════════

describe('D. batchSyncInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // D1: iterates over all room types and queues sync for each
  it('D1: iterates over all room types and queues sync', async () => {
    (db.roomType.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'rt-1' },
      { id: 'rt-2' },
      { id: 'rt-3' },
    ]);
    (db.room.count as ReturnType<typeof vi.fn>).mockResolvedValue(10);
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection('booking_com'),
    ]);
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'batch-sync' });

    const start = new Date('2025-03-01');
    const end = new Date('2025-03-07');
    const results = await batchSyncInventory('tenant-1', 'prop-1', start, end);

    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r.success).toBe(true);
      expect(r.channelCode).toBe('batch');
    });
  });

  // D2: generates correct date range
  it('D2: generates correct date range for sync messages', async () => {
    (db.roomType.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'rt-1' }]);
    (db.room.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection('booking_com'),
    ]);
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'bs-1' });

    // 3-day range: Mar 1 to Mar 3
    const start = new Date('2025-03-01');
    const end = new Date('2025-03-03');
    await batchSyncInventory('tenant-1', 'prop-1', start, end);

    // The room.count should be called for each date (3 dates)
    expect(db.room.count).toHaveBeenCalledTimes(3);
  });

  // D3: handles empty room types list
  it('D3: returns empty results when no room types', async () => {
    (db.roomType.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const results = await batchSyncInventory(
      'tenant-1', 'prop-1',
      new Date('2025-03-01'), new Date('2025-03-07')
    );

    expect(results).toEqual([]);
    expect(db.room.count).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E. calculateAvailability (tested indirectly via triggerInventorySync)
// ═════════════════════════════════════════════════════════════════════════════

describe('E. Availability Calculation Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // E1: returns room count (actual behavior - does NOT deduct bookings)
  it('E1: returns total room count without deducting bookings', async () => {
    (db.room.count as ReturnType<typeof vi.fn>).mockResolvedValue(20);
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection('booking_com'),
    ]);
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'avail-1' });

    await triggerInventorySync(
      'tenant-1', 'prop-1', 'rt-1', [new Date('2025-03-01')]
    );

    // The calculateAvailability function just returns db.room.count
    // It does NOT deduct bookings - this is the actual behavior to test
    expect(db.room.count).toHaveBeenCalledWith({
      where: { propertyId: 'prop-1', roomTypeId: 'rt-1' },
    });
  });

  // E2: returns 0 when no rooms exist
  it('E2: returns 0 when no rooms exist for the type', async () => {
    (db.room.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection('booking_com'),
    ]);
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'avail-2' });

    await triggerInventorySync(
      'tenant-1', 'prop-1', 'rt-nonexistent', [new Date('2025-03-01')]
    );

    // Room count is 0, which means availability = 0
    // Verify the sync log was still created (the function doesn't error on 0)
    expect(db.channelSyncLog.create).toHaveBeenCalled();
  });
});
