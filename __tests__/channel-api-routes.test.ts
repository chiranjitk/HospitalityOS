/**
 * Channel API Routes - Unit Tests
 *
 * Tests the core logic of channel API routes by importing the handler functions
 * directly. All external dependencies (Prisma, auth, NextResponse) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock Next.js modules ──────────────────────────────────────────────────
const mockJson = vi.fn();
vi.mock('next/server', () => ({
  NextResponse: {
    json: (...args: unknown[]) => {
      const fn = mockJson(...args);
      fn.status = vi.fn().mockReturnThis();
      return fn;
    },
  },
}));

// ─── Mock auth modules ─────────────────────────────────────────────────────
vi.mock('@/lib/auth/tenant-context', () => ({
  requirePermission: vi.fn(),
}));

vi.mock('@/lib/auth-helpers', () => ({
  getUserFromRequest: vi.fn(),
  hasPermission: vi.fn().mockReturnValue(true),
}));

// ─── Mock OTA module ──────────────────────────────────────────────────────
vi.mock('@/lib/ota', () => ({
  ALL_OTAS: [
    { id: 'booking_com', name: 'Booking.com', region: 'global', type: 'ota', priority: 'critical', features: ['inventory', 'rates'] },
    { id: 'expedia', name: 'Expedia', region: 'global', type: 'ota', priority: 'critical', features: ['inventory', 'rates'] },
    { id: 'agoda', name: 'Agoda', region: 'asia_pacific', type: 'ota', priority: 'critical', features: ['inventory'] },
  ],
  getOTAById: vi.fn((id: string) => {
    const all = [
      { id: 'booking_com', name: 'Booking.com', displayName: 'Booking.com', region: 'global', type: 'ota', priority: 'critical', features: ['inventory', 'rates'] },
      { id: 'expedia', name: 'Expedia', displayName: 'Expedia', region: 'global', type: 'ota', priority: 'critical', features: ['inventory', 'rates'] },
    ];
    return all.find((o) => o.id === id);
  }),
  OTAClientFactory: { createClient: vi.fn() },
}));

// ─── Mock Prisma ──────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => ({
  db: {
    channelConnection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    channelMapping: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    channelSyncLog: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    channelRestriction: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    property: { findMany: vi.fn() },
    roomType: { findFirst: vi.fn() },
    ratePlan: { findMany: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
  },
}));

import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { GET as getConnections, POST as createConnection } from '@/app/api/channels/connections/route';
import { GET as getMappings, POST as createMapping } from '@/app/api/channels/mapping/route';
import { GET as getSyncLogs, POST as createSyncLog } from '@/app/api/channels/sync-logs/route';
import { GET as getRestrictions, POST as createRestriction } from '@/app/api/channels/restrictions/route';

// ─── Helpers ──────────────────────────────────────────────────────────────

const mockUser = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  isPlatformAdmin: false,
  role: 'admin',
  permissions: ['channels.*'],
};

function makeRequest(url: string, options: { method?: string; body?: Record<string, unknown> } = {}) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// A. GET /api/channels/connections
// ═════════════════════════════════════════════════════════════════════════════

describe('A. GET /api/channels/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requirePermission as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  });

  // A1: returns connections with stats
  it('A1: returns enriched connections with stats and pagination', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', channel: 'booking_com', createdAt: new Date(), _count: { channelMappings: 2, syncLogs: 10 } },
    ]);
    (db.channelSyncLog.groupBy as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ connectionId: 'c1', status: 'success', _count: 8 }])
      .mockResolvedValueOnce([{ connectionId: 'c1', _max: { createdAt: new Date('2025-01-15') } }]);
    (db.channelConnection.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (db.channelConnection.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    const res = await getConnections(makeRequest('/api/channels/connections'));
    const body = mockJson.mock.calls[mockJson.mock.calls.length - 1][0];

    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toBeDefined();
    expect(body.stats).toBeDefined();
  });

  // A2: filters by status
  it('A2: filters connections by status query param', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.channelConnection.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.channelSyncLog.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await getConnections(makeRequest('/api/channels/connections?status=active'));

    expect(db.channelConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'active', tenantId: 'tenant-1' }),
      })
    );
  });

  // A3: filters by channel
  it('A3: filters connections by channel query param', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.channelConnection.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.channelSyncLog.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await getConnections(makeRequest('/api/channels/connections?channel=booking_com'));

    expect(db.channelConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ channel: 'booking_com' }),
      })
    );
  });

  // A4: handles auth failure
  it('A4: returns 403 when permission denied', async () => {
    (requirePermission as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('Forbidden', { status: 403 })
    );

    const res = await getConnections(makeRequest('/api/channels/connections'));

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403 }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B. POST /api/channels/connections
// ═════════════════════════════════════════════════════════════════════════════

describe('B. POST /api/channels/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requirePermission as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  });

  // B1: validates channel is required
  it('B1: returns 400 when channel is missing', async () => {
    const req = makeRequest('/api/channels/connections', {
      method: 'POST',
      body: { displayName: 'Test' },
    });
    // Mock json() on the request
    req.json = vi.fn().mockResolvedValue({ displayName: 'Test' });

    await createConnection(req);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      }),
      expect.anything(), // status
    );
  });

  // B2: validates channel type
  it('B2: returns 400 for invalid channel type', async () => {
    const req = makeRequest('/api/channels/connections', {
      method: 'POST',
      body: { channel: 'nonexistent_channel' },
    });
    req.json = vi.fn().mockResolvedValue({ channel: 'nonexistent_channel' });

    await createConnection(req);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_CHANNEL' }),
      }),
      expect.anything(),
    );
  });

  // B3: rejects duplicate connections
  it('B3: returns 400 for duplicate channel connection', async () => {
    const req = makeRequest('/api/channels/connections', {
      method: 'POST',
      body: { channel: 'booking_com' },
    });
    req.json = vi.fn().mockResolvedValue({ channel: 'booking_com' });
    (db.channelConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'existing',
    });

    await createConnection(req);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'DUPLICATE_CONNECTION' }),
      }),
      expect.anything(),
    );
  });

  // B4: creates connection with correct data
  it('B4: creates connection with default values applied', async () => {
    const req = makeRequest('/api/channels/connections', {
      method: 'POST',
      body: { channel: 'booking_com', apiKey: 'key-123' },
    });
    req.json = vi.fn().mockResolvedValue({ channel: 'booking_com', apiKey: 'key-123' });
    (db.channelConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.channelConnection.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'new-conn',
      channel: 'booking_com',
    });

    await createConnection(req);

    expect(db.channelConnection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          channel: 'booking_com',
          status: 'pending',
          apiKey: 'key-123',
          autoSync: true,
          syncInterval: 60,
        }),
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C. GET /api/channels/mapping
// ═════════════════════════════════════════════════════════════════════════════

describe('C. GET /api/channels/mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getUserFromRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  });

  // C1: returns mappings with room types
  it('C1: returns mapping data with room types and rate plans', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', displayName: 'Booking.com', channel: 'booking_com' },
    ]);
    (db.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { roomTypes: [{ id: 'rt-1', name: 'Standard', code: 'STD' }] },
    ]);
    (db.ratePlan.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'rp-1', name: 'BAR', code: 'BAR', roomTypeId: 'rt-1' },
    ]);
    (db.channelMapping.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'm1', connectionId: 'c1', roomTypeId: 'rt-1', ratePlanId: 'rp-1', externalRoomId: 'ext-1', syncInventory: true, syncRates: true, status: 'active' },
    ]);

    const res = await getMappings(makeRequest('/api/channels/mapping'));
    const body = mockJson.mock.calls[mockJson.mock.calls.length - 1][0];

    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.roomTypes).toBeDefined();
    expect(body.stats).toBeDefined();
  });

  // C2: returns 401 when not authenticated
  it('C2: returns 401 when user is not authenticated', async () => {
    (getUserFromRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await getMappings(makeRequest('/api/channels/mapping'));

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }),
      expect.anything(),
    );
  });

  // C3: generates suggestions when no mappings exist
  it('C3: generates mapping suggestions when none exist', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', displayName: 'Booking.com', channel: 'booking_com' },
    ]);
    (db.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { roomTypes: [{ id: 'rt-1', name: 'Standard', code: 'STD' }] },
    ]);
    (db.ratePlan.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'rp-1', name: 'BAR', code: 'BAR', roomTypeId: 'rt-1' },
    ]);
    (db.channelMapping.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await getMappings(makeRequest('/api/channels/mapping'));
    const body = mockJson.mock.calls[mockJson.mock.calls.length - 1][0];

    // Should have suggestion entries
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].status).toBe('pending');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D. POST /api/channels/mapping
// ═════════════════════════════════════════════════════════════════════════════

describe('D. POST /api/channels/mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getUserFromRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  });

  // D1: validates required fields
  it('D1: returns 400 when connectionId, roomTypeId, or externalRoomId missing', async () => {
    const req = makeRequest('/api/channels/mapping', {
      method: 'POST',
      body: {},
    });
    req.json = vi.fn().mockResolvedValue({});

    await createMapping(req);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      }),
      expect.anything(),
    );
  });

  // D2: verifies connection ownership
  it('D2: returns 404 when connection not found for tenant', async () => {
    const req = makeRequest('/api/channels/mapping', {
      method: 'POST',
      body: { connectionId: 'c1', roomTypeId: 'rt-1', externalRoomId: 'ext-1' },
    });
    req.json = vi.fn().mockResolvedValue({ connectionId: 'c1', roomTypeId: 'rt-1', externalRoomId: 'ext-1' });
    (db.channelConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await createMapping(req);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'NOT_FOUND' }),
      }),
      expect.anything(),
    );
  });

  // D3: creates mapping successfully
  it('D3: creates mapping with correct data', async () => {
    const req = makeRequest('/api/channels/mapping', {
      method: 'POST',
      body: { connectionId: 'c1', roomTypeId: 'rt-1', externalRoomId: 'ext-1' },
    });
    req.json = vi.fn().mockResolvedValue({
      connectionId: 'c1', roomTypeId: 'rt-1', externalRoomId: 'ext-1',
    });
    (db.channelConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'c1' });
    (db.roomType.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'rt-1' });
    (db.channelMapping.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'm1' });

    await createMapping(req);

    expect(db.channelMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          connectionId: 'c1',
          roomTypeId: 'rt-1',
          externalRoomId: 'ext-1',
          status: 'active',
        }),
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E. GET /api/channels/sync-logs
// ═════════════════════════════════════════════════════════════════════════════

describe('E. GET /api/channels/sync-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getUserFromRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  });

  // E1: returns empty when no connections exist
  it('E1: returns empty data when tenant has no connections', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await getSyncLogs(makeRequest('/api/channels/sync-logs'));
    const body = mockJson.mock.calls[mockJson.mock.calls.length - 1][0];

    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  // E2: returns logs with stats
  it('E2: returns sync logs with success rate stats', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', channel: 'booking_com', displayName: 'Booking.com' },
    ]);
    (db.channelSyncLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'sl1', connectionId: 'c1', connection: { channel: 'booking_com', displayName: 'Booking.com' } },
    ]);
    (db.channelSyncLog.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(10)   // total
      .mockResolvedValueOnce(8)    // success
      .mockResolvedValueOnce(2)    // failed
      .mockResolvedValueOnce(3)    // last24hTotal
      .mockResolvedValueOnce(2)    // last24hSuccess
      .mockResolvedValueOnce(1);   // last24hFailed
    (db.channelSyncLog.groupBy as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ syncType: 'inventory', _count: 5 }])
      .mockResolvedValueOnce([{ connectionId: 'c1', _count: 10 }]);

    const res = await getSyncLogs(makeRequest('/api/channels/sync-logs'));
    const body = mockJson.mock.calls[mockJson.mock.calls.length - 1][0];

    expect(body.success).toBe(true);
    expect(body.stats.success).toBe(8);
    expect(body.stats.failed).toBe(2);
    expect(body.stats.successRate).toBe(80);
    expect(body.stats.last24h).toBeDefined();
  });

  // E3: supports pagination via limit and offset
  it('E3: passes limit and offset to findMany', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', channel: 'booking_com', displayName: 'Booking.com' },
    ]);
    (db.channelSyncLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.channelSyncLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.channelSyncLog.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await getSyncLogs(makeRequest('/api/channels/sync-logs?limit=5&offset=10'));

    expect(db.channelSyncLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, skip: 10 })
    );
  });

  // E4: filters by connectionId
  it('E4: filters logs by connectionId', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', channel: 'booking_com', displayName: 'Booking.com' },
    ]);
    (db.channelSyncLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.channelSyncLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.channelSyncLog.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await getSyncLogs(makeRequest('/api/channels/sync-logs?connectionId=c1'));

    expect(db.channelConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'c1' }),
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F. POST /api/channels/sync-logs
// ═════════════════════════════════════════════════════════════════════════════

describe('F. POST /api/channels/sync-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getUserFromRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  });

  // F1: validates required fields
  it('F1: returns 400 when required fields are missing', async () => {
    const req = makeRequest('/api/channels/sync-logs', {
      method: 'POST',
      body: { connectionId: 'c1' },
    });
    req.json = vi.fn().mockResolvedValue({ connectionId: 'c1' });

    await createSyncLog(req);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      }),
      expect.anything(),
    );
  });

  // F2: creates sync log and updates connection on success
  it('F2: creates sync log and updates connection lastSyncAt on success', async () => {
    const req = makeRequest('/api/channels/sync-logs', {
      method: 'POST',
      body: { connectionId: 'c1', syncType: 'inventory', direction: 'outbound', status: 'success' },
    });
    req.json = vi.fn().mockResolvedValue({
      connectionId: 'c1', syncType: 'inventory', direction: 'outbound', status: 'success',
    });
    (db.channelConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'c1' });
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'sl-1' });
    (db.channelConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await createSyncLog(req);

    expect(db.channelSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ syncType: 'inventory', status: 'success' }),
      })
    );
    expect(db.channelConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: expect.objectContaining({ lastSyncAt: expect.any(Date), lastError: null }),
      })
    );
  });

  // F3: updates connection lastError on failure
  it('F3: updates connection lastError on failed sync log', async () => {
    const req = makeRequest('/api/channels/sync-logs', {
      method: 'POST',
      body: {
        connectionId: 'c1', syncType: 'inventory', direction: 'outbound',
        status: 'failed', errorMessage: 'Connection timeout',
      },
    });
    req.json = vi.fn().mockResolvedValue({
      connectionId: 'c1', syncType: 'inventory', direction: 'outbound',
      status: 'failed', errorMessage: 'Connection timeout',
    });
    (db.channelConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'c1' });
    (db.channelSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'sl-1' });
    (db.channelConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await createSyncLog(req);

    expect(db.channelConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastError: 'Connection timeout' }),
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// G. GET /api/channels/restrictions
// ═════════════════════════════════════════════════════════════════════════════

describe('G. GET /api/channels/restrictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getUserFromRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  });

  // G1: returns restrictions with room types
  it('G1: returns restrictions with room type and channel info', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', displayName: 'Booking.com', channel: 'booking_com', status: 'active' },
    ]);
    (db.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { roomTypes: [{ id: 'rt-1', name: 'Standard', code: 'STD' }] },
    ]);
    (db.channelRestriction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'r1', connectionId: 'c1', roomTypeId: 'rt-1',
        connection: { displayName: 'Booking.com', channel: 'booking_com' },
        roomType: { name: 'Standard' },
        startDate: new Date('2025-01-01'), endDate: new Date('2025-01-05'),
        minStay: 2, maxStay: 7, closedToArrival: false, closedToDeparture: false,
        closed: false, syncStatus: 'synced',
      },
    ]);

    const res = await getRestrictions(makeRequest('/api/channels/restrictions'));
    const body = mockJson.mock.calls[mockJson.mock.calls.length - 1][0];

    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].channelName).toBe('Booking.com');
    expect(body.data[0].roomTypeName).toBe('Standard');
    expect(body.stats).toBeDefined();
  });

  // G2: returns 401 when not authenticated
  it('G2: returns 401 when not authenticated', async () => {
    (getUserFromRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await getRestrictions(makeRequest('/api/channels/restrictions'));

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }),
      expect.anything(),
    );
  });

  // G3: calculates stats correctly
  it('G3: calculates restriction stats (active, closed, cta, ctd)', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.channelRestriction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'r1', connectionId: 'c1', roomTypeId: 'rt-1', connection: {}, roomType: {}, closed: false, closedToArrival: true, closedToDeparture: false, syncStatus: 'synced' },
      { id: 'r2', connectionId: 'c1', roomTypeId: 'rt-1', connection: {}, roomType: {}, closed: true, closedToArrival: false, closedToDeparture: true, syncStatus: 'pending' },
      { id: 'r3', connectionId: 'c1', roomTypeId: 'rt-1', connection: {}, roomType: {}, closed: true, closedToArrival: true, closedToDeparture: true, syncStatus: 'synced' },
    ]);

    const res = await getRestrictions(makeRequest('/api/channels/restrictions'));
    const body = mockJson.mock.calls[mockJson.mock.calls.length - 1][0];

    expect(body.stats.active).toBe(1);
    expect(body.stats.closed).toBe(2);
    expect(body.stats.cta).toBe(2);
    expect(body.stats.ctd).toBe(2);
    expect(body.stats.synced).toBe(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H. POST /api/channels/restrictions
// ═════════════════════════════════════════════════════════════════════════════

describe('H. POST /api/channels/restrictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getUserFromRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  });

  // H1: validates required fields
  it('H1: returns 400 when required fields are missing', async () => {
    const req = makeRequest('/api/channels/restrictions', {
      method: 'POST',
      body: { connectionId: 'c1' },
    });
    req.json = vi.fn().mockResolvedValue({ connectionId: 'c1' });

    await createRestriction(req);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      }),
      expect.anything(),
    );
  });

  // H2: verifies connection and room type ownership
  it('H2: returns 404 when connection not found', async () => {
    const req = makeRequest('/api/channels/restrictions', {
      method: 'POST',
      body: {
        connectionId: 'c1', roomTypeId: 'rt-1',
        startDate: '2025-01-01', endDate: '2025-01-05',
      },
    });
    req.json = vi.fn().mockResolvedValue({
      connectionId: 'c1', roomTypeId: 'rt-1',
      startDate: '2025-01-01', endDate: '2025-01-05',
    });
    (db.channelConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await createRestriction(req);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'NOT_FOUND' }),
      }),
      expect.anything(),
    );
  });

  // H3: creates new restriction when none exists
  it('H3: creates new restriction', async () => {
    const req = makeRequest('/api/channels/restrictions', {
      method: 'POST',
      body: {
        connectionId: 'c1', roomTypeId: 'rt-1',
        startDate: '2025-01-01', endDate: '2025-01-05',
        minStay: 3, closed: true,
      },
    });
    req.json = vi.fn().mockResolvedValue({
      connectionId: 'c1', roomTypeId: 'rt-1',
      startDate: '2025-01-01', endDate: '2025-01-05',
      minStay: 3, closed: true,
    });
    (db.channelConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'c1' });
    (db.roomType.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'rt-1' });
    (db.channelRestriction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.channelRestriction.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'r1' });

    await createRestriction(req);

    expect(db.channelRestriction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          connectionId: 'c1',
          roomTypeId: 'rt-1',
          minStay: 3,
          closed: true,
          syncStatus: 'pending',
        }),
      })
    );
  });

  // H4: updates existing restriction
  it('H4: updates existing restriction when duplicate found', async () => {
    const req = makeRequest('/api/channels/restrictions', {
      method: 'POST',
      body: {
        connectionId: 'c1', roomTypeId: 'rt-1',
        startDate: '2025-01-01', endDate: '2025-01-10',
        closedToArrival: true,
      },
    });
    req.json = vi.fn().mockResolvedValue({
      connectionId: 'c1', roomTypeId: 'rt-1',
      startDate: '2025-01-01', endDate: '2025-01-10',
      closedToArrival: true,
    });
    (db.channelConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'c1' });
    (db.roomType.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'rt-1' });
    (db.channelRestriction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'r1' });
    (db.channelRestriction.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'r1' });

    await createRestriction(req);

    expect(db.channelRestriction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({
          endDate: new Date('2025-01-10'),
          closedToArrival: true,
          syncStatus: 'pending',
        }),
      })
    );
  });
});
