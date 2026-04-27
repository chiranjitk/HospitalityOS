/**
 * Channel Manager Retry Queue - Unit Tests
 *
 * Tests the retry queue module: adding to queue, processing retries,
 * dead letter queue management, and cleanup.
 *
 * All Prisma calls are mocked since we can't connect to a real DB in unit tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Prisma ──────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => ({
  db: {
    channelRetryQueue: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    channelDeadLetterQueue: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    channelConnection: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    channelSyncLog: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { db } from '@/lib/db';
import {
  addToRetryQueue,
  processRetryQueue,
  getRetryQueueStats,
  getDeadLetterQueue,
  reprocessDeadLetterItem,
  clearCompletedRetries,
} from '@/lib/channel-manager/retry-queue';

// ─── Helpers ──────────────────────────────────────────────────────────────

const mockTransaction = db.$transaction as unknown as ReturnType<typeof vi.fn>;

function mockSyncLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sync-log-1',
    connectionId: 'conn-1',
    syncType: 'inventory',
    requestPayload: JSON.stringify({ roomTypeId: 'rt-1' }),
    status: 'failed',
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}

function mockConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-1',
    tenantId: 'tenant-1',
    propertyId: 'prop-1',
    channel: 'booking_com',
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// A. addToRetryQueue
// ═════════════════════════════════════════════════════════════════════════════

describe('A. addToRetryQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A1: throws when sync log not found
  it('A1: throws error when sync log does not exist', async () => {
    (db.channelSyncLog.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(addToRetryQueue('nonexistent-id', 'Network error')).rejects.toThrow(
      'Sync log not found'
    );
  });

  // A2: creates new retry entry when none exists
  it('A2: creates a new retry entry on first failure', async () => {
    (db.channelSyncLog.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSyncLog()
    );
    (db.channelRetryQueue.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.channelConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockConnection()
    );
    (db.channelRetryQueue.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'retry-1',
    });

    const result = await addToRetryQueue('sync-log-1', 'Connection refused');

    expect(result).toBe('retry-1');
    expect(db.channelRetryQueue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          syncLogId: 'sync-log-1',
          tenantId: 'tenant-1',
          channelCode: 'booking_com',
          operation: 'inventory',
          attemptCount: 1,
          status: 'pending',
          lastError: 'Connection refused',
        }),
      })
    );
  });

  // A3: increments attempt count on duplicate
  it('A3: increments attempt count when retry already exists', async () => {
    (db.channelSyncLog.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSyncLog()
    );
    (db.channelRetryQueue.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'retry-1',
      attemptCount: 2,
      tenantId: 'tenant-1',
      channelCode: 'booking_com',
      operation: 'inventory',
      payload: {},
    });
    (db.channelRetryQueue.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await addToRetryQueue('sync-log-1', 'Timeout');

    expect(result).toBe('retry-1');
    expect(db.channelRetryQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'retry-1' },
        data: expect.objectContaining({
          status: 'retrying',
          attemptCount: 3,
          lastError: 'Timeout',
        }),
      })
    );
  });

  // A4: moves to dead letter when max attempts reached (default 5)
  it('A4: moves to dead letter queue when max attempts (5) reached', async () => {
    (db.channelSyncLog.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSyncLog()
    );
    (db.channelRetryQueue.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'retry-1',
      attemptCount: 4,
      tenantId: 'tenant-1',
      channelCode: 'booking_com',
      operation: 'inventory',
      payload: {},
    });
    mockTransaction.mockResolvedValue([{}, {}, {}]);

    const result = await addToRetryQueue('sync-log-1', 'Permanent failure');

    // Should return 'dead_letter' sentinel
    expect(result).toBe('dead_letter');
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    // The transaction should update retry status, sync log, and create dead letter
    const txCalls = mockTransaction.mock.calls[0][0];
    expect(txCalls).toHaveLength(3);
  });

  // A5: respects custom maxAttempts config
  it('A5: respects custom maxAttempts config', async () => {
    (db.channelSyncLog.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSyncLog()
    );
    (db.channelRetryQueue.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'retry-1',
      attemptCount: 1,
      tenantId: 'tenant-1',
      channelCode: 'booking_com',
      operation: 'inventory',
      payload: {},
    });
    mockTransaction.mockResolvedValue([{}, {}, {}]);

    const result = await addToRetryQueue('sync-log-1', 'Fail', { maxAttempts: 2 });

    // attemptCount will be 2 (= 1 + 1), and maxAttempts is 2, so it goes to dead letter
    expect(result).toBe('dead_letter');
  });

  // A6: exponential backoff delay calculation
  it('A6: calculates exponential backoff delay correctly', async () => {
    (db.channelSyncLog.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSyncLog()
    );
    (db.channelRetryQueue.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'retry-1',
      attemptCount: 1, // will become 2
      tenantId: 'tenant-1',
      channelCode: 'booking_com',
      operation: 'inventory',
      payload: {},
    });
    (db.channelRetryQueue.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await addToRetryQueue('sync-log-1', 'Error', {
      baseDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 60000,
    });

    const updateCall = (db.channelRetryQueue.update as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const nextRetryAt = updateCall.data.nextRetryAt;
    // attemptCount=2, delay = 1000 * 2^2 = 4000ms
    const expectedTime = Date.now() + 4000;
    expect(Math.abs(nextRetryAt.getTime() - expectedTime)).toBeLessThan(100);
  });

  // A7: delay is capped at maxDelayMs
  it('A7: caps delay at maxDelayMs', async () => {
    (db.channelSyncLog.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSyncLog()
    );
    (db.channelRetryQueue.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'retry-1',
      attemptCount: 10, // very high, would cause huge delay
      tenantId: 'tenant-1',
      channelCode: 'booking_com',
      operation: 'inventory',
      payload: {},
    });
    (db.channelRetryQueue.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await addToRetryQueue('sync-log-1', 'Error', {
      baseDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 5000,
    });

    const updateCall = (db.channelRetryQueue.update as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const delay = updateCall.data.nextRetryAt.getTime() - Date.now();
    // delay should be capped at 5000ms
    expect(delay).toBeLessThanOrEqual(5100); // small tolerance for test execution
  });

  // A8: uses connection fallback when connection is null
  it('A8: handles null connection gracefully with fallback values', async () => {
    (db.channelSyncLog.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSyncLog()
    );
    (db.channelRetryQueue.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.channelConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.channelRetryQueue.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'retry-fallback',
    });

    const result = await addToRetryQueue('sync-log-1', 'Error');

    expect(result).toBe('retry-fallback');
    expect(db.channelRetryQueue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: '',
          channelCode: 'unknown',
          propertyId: '',
        }),
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B. processRetryQueue
// ═════════════════════════════════════════════════════════════════════════════

describe('B. processRetryQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // B1: returns zeros when no pending retries
  it('B1: returns all zeros when queue is empty', async () => {
    (db.channelRetryQueue.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await processRetryQueue();

    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0, deadLettered: 0 });
  });

  // B2: processes pending retries in batch
  it('B2: processes all pending retries up to batch size', async () => {
    const pendingRetries = [
      { id: 'r1', syncLogId: 'sl1', propertyId: 'p1', channelCode: 'booking_com', payload: {} },
      { id: 'r2', syncLogId: 'sl2', propertyId: 'p1', channelCode: 'agoda', payload: {} },
    ];
    (db.channelRetryQueue.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(pendingRetries);
    (db.channelRetryQueue.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    mockTransaction.mockResolvedValue([{}, {}]);
    // Simulate addToRetryQueue returning retry IDs
    vi.spyOn(Date, 'now').mockReturnValue(Date.now());
    // Make the retrySyncOperation succeed (it always returns success by default)
    // We mock addToRetryQueue to return retry ID for failed cases
    // Since retrySyncOperation succeeds, addToRetryQueue is NOT called for success

    const result = await processRetryQueue(10);

    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
  });

  // B3: handles failures during processing
  it('B3: increments failed count when processing throws', async () => {
    const pendingRetries = [
      { id: 'r1', syncLogId: 'sl1', propertyId: 'p1', channelCode: 'unknown_channel', payload: {} },
    ];
    (db.channelRetryQueue.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(pendingRetries);
    // First update: mark as processing
    (db.channelRetryQueue.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    // addToRetryQueue will be called for the failure
    vi.mocked(addToRetryQueue).mockResolvedValueOnce('r1');
    // The retrySyncOperation fails because channel not found
    (db.channelConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await processRetryQueue(10);

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
  });

  // B4: respects batch size limit
  it('B4: respects the batch size parameter', async () => {
    (db.channelRetryQueue.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'r1', syncLogId: 'sl1', propertyId: 'p1', channelCode: 'booking_com', payload: {} },
    ]);
    (db.channelRetryQueue.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    mockTransaction.mockResolvedValue([{}, {}]);

    await processRetryQueue(5);

    expect(db.channelRetryQueue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });

  // B5: orders by priority desc then nextRetryAt asc
  it('B5: orders pending retries by priority desc then nextRetryAt asc', async () => {
    (db.channelRetryQueue.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await processRetryQueue();

    expect(db.channelRetryQueue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ priority: 'desc' }, { nextRetryAt: 'asc' }],
      })
    );
  });

  // B6: filters for pending and retrying status
  it('B6: only fetches pending and retrying statuses', async () => {
    (db.channelRetryQueue.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await processRetryQueue();

    expect(db.channelRetryQueue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['pending', 'retrying'] },
        }),
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C. getRetryQueueStats
// ═════════════════════════════════════════════════════════════════════════════

describe('C. getRetryQueueStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // C1: returns zeros when no stats
  it('C1: returns all zeros when no stats exist', async () => {
    (db.channelRetryQueue.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const stats = await getRetryQueueStats('tenant-1');

    expect(stats).toEqual({
      pending: 0,
      processing: 0,
      retrying: 0,
      completed: 0,
      failed: 0,
      deadLetter: 0,
      averageAttempts: 0,
      oldestPending: undefined,
    });
  });

  // C2: aggregates stats by status correctly
  it('C2: aggregates counts by status correctly', async () => {
    (db.channelRetryQueue.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { status: 'pending', _count: { id: 5 }, _avg: { attemptCount: 2.5 }, _min: { createdAt: new Date('2025-01-01') } },
      { status: 'failed', _count: { id: 3 }, _avg: { attemptCount: 4 }, _min: { createdAt: null } },
      { status: 'processing', _count: { id: 1 }, _avg: { attemptCount: 1 }, _min: { createdAt: null } },
      { status: 'dead_letter', _count: { id: 2 }, _avg: { attemptCount: 5 }, _min: { createdAt: null } },
    ]);

    const stats = await getRetryQueueStats('tenant-1');

    expect(stats.pending).toBe(5);
    expect(stats.failed).toBe(3);
    expect(stats.processing).toBe(1);
    expect(stats.deadLetter).toBe(2);
    // averageAttempts takes the last non-null _avg value
    expect(stats.averageAttempts).toBe(5);
    expect(stats.oldestPending).toEqual(new Date('2025-01-01'));
  });

  // C3: passes tenantId filter
  it('C3: passes tenantId in groupBy where clause', async () => {
    (db.channelRetryQueue.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await getRetryQueueStats('tenant-xyz');

    expect(db.channelRetryQueue.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-xyz' },
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D. getDeadLetterQueue
// ═════════════════════════════════════════════════════════════════════════════

describe('D. getDeadLetterQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // D1: returns items with total count
  it('D1: returns items and total count', async () => {
    const items = [
      {
        id: 'dl-1',
        channelCode: 'booking_com',
        operation: 'inventory',
        error: 'Max retries',
        attemptCount: 5,
        createdAt: new Date(),
        originalCreatedAt: new Date('2025-01-01'),
      },
      {
        id: 'dl-2',
        channelCode: 'agoda',
        operation: 'rates',
        error: 'Auth failed',
        attemptCount: 5,
        createdAt: new Date(),
        originalCreatedAt: new Date('2025-01-02'),
      },
    ];
    (db.channelDeadLetterQueue.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(items);
    (db.channelDeadLetterQueue.count as ReturnType<typeof vi.fn>).mockResolvedValue(42);

    const result = await getDeadLetterQueue('tenant-1');

    expect(result.items).toHaveLength(2);
    expect(result.items[0].channelCode).toBe('booking_com');
    expect(result.total).toBe(42);
  });

  // D2: supports pagination with limit and offset
  it('D2: passes limit and offset to findMany', async () => {
    (db.channelDeadLetterQueue.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.channelDeadLetterQueue.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    await getDeadLetterQueue('tenant-1', { limit: 10, offset: 20 });

    expect(db.channelDeadLetterQueue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 20,
      })
    );
  });

  // D3: uses default limit of 50
  it('D3: uses default limit of 50 when not specified', async () => {
    (db.channelDeadLetterQueue.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.channelDeadLetterQueue.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    await getDeadLetterQueue('tenant-1');

    expect(db.channelDeadLetterQueue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        skip: 0,
      })
    );
  });

  // D4: returns empty items for no dead letters
  it('D4: returns empty array when no dead letters exist', async () => {
    (db.channelDeadLetterQueue.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.channelDeadLetterQueue.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const result = await getDeadLetterQueue('tenant-1');

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  // D5: orders by createdAt desc
  it('D5: orders results by createdAt descending', async () => {
    (db.channelDeadLetterQueue.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.channelDeadLetterQueue.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    await getDeadLetterQueue('tenant-1');

    expect(db.channelDeadLetterQueue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E. reprocessDeadLetterItem
// ═════════════════════════════════════════════════════════════════════════════

describe('E. reprocessDeadLetterItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // E1: returns error when dead letter item not found
  it('E1: returns failure when item not found', async () => {
    (db.channelDeadLetterQueue.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await reprocessDeadLetterItem('nonexistent');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Dead letter item not found');
  });

  // E2: creates fresh sync log and retry entry
  it('E2: creates fresh sync log and retry entry, deletes dead letter', async () => {
    const deadLetterItem = {
      id: 'dl-1',
      tenantId: 'tenant-1',
      syncLogId: 'original-sync-log',
      channelCode: 'booking_com',
      operation: 'inventory',
      payload: JSON.stringify({ dates: ['2025-01-01'] }),
      propertyId: 'prop-1',
      error: 'Max retries',
    };
    (db.channelDeadLetterQueue.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      deadLetterItem
    );
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-sl-1' });
    (db.channelRetryQueue.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-retry-1' });
    (db.channelDeadLetterQueue.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await reprocessDeadLetterItem('dl-1');

    expect(result.success).toBe(true);
    expect(result.retryId).toBe('new-retry-1');
    // Verify new sync log created with correct data
    expect(db.channelSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          syncType: 'inventory',
          direction: 'outbound',
          status: 'pending',
        }),
      })
    );
    // Verify new retry entry created with attemptCount 0
    expect(db.channelRetryQueue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attemptCount: 0,
          status: 'pending',
        }),
      })
    );
    // Verify dead letter item deleted
    expect(db.channelDeadLetterQueue.delete).toHaveBeenCalledWith({
      where: { id: 'dl-1' },
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F. clearCompletedRetries
// ═════════════════════════════════════════════════════════════════════════════

describe('F. clearCompletedRetries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // F1: deletes completed retries older than cutoff
  it('F1: deletes completed retries older than specified days', async () => {
    (db.channelRetryQueue.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 15 });

    const deleted = await clearCompletedRetries('tenant-1', 7);

    expect(deleted).toBe(15);
    expect(db.channelRetryQueue.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          status: 'completed',
          updatedAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      })
    );
  });

  // F2: uses default 7 days when not specified
  it('F2: uses default 7-day cutoff', async () => {
    (db.channelRetryQueue.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

    await clearCompletedRetries('tenant-1');

    // Calculate expected cutoff: now - 7 days
    const expectedCutoff = new Date();
    expectedCutoff.setDate(expectedCutoff.getDate() - 7);

    const call = (db.channelRetryQueue.deleteMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const actualCutoff = call.where.updatedAt.lt;
    // Should be approximately 7 days ago (within 1 minute tolerance)
    expect(Math.abs(actualCutoff.getTime() - expectedCutoff.getTime())).toBeLessThan(60000);
  });

  // F3: returns zero when nothing to delete
  it('F3: returns 0 when no matching entries', async () => {
    (db.channelRetryQueue.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

    const deleted = await clearCompletedRetries('tenant-1', 30);

    expect(deleted).toBe(0);
  });
});
