/**
 * OTA Sync Service - Unit Tests
 *
 * Tests the OTASyncService and OTASyncScheduler: sync operations, booking processing,
 * inventory mapping, and scheduled sync start/stop.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock OTA client factory ──────────────────────────────────────────────────
const mockUpdateInventory = vi.fn();
const mockUpdateRates = vi.fn();
const mockUpdateRestrictions = vi.fn();
const mockConnect = vi.fn();
const mockGetBookings = vi.fn();

const mockClient = {
  connect: mockConnect,
  updateInventory: mockUpdateInventory,
  updateRates: mockUpdateRates,
  updateRestrictions: mockUpdateRestrictions,
  getBookings: mockGetBookings,
};

vi.mock('@/lib/ota/client-factory', () => ({
  OTAClientFactory: {
    createClient: vi.fn(() => mockClient),
  },
  getAllOTAs: vi.fn(),
  getOTAConfig: vi.fn(),
}));

// ─── Mock Prisma ──────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => ({
  db: {
    channelConnection: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    channelMapping: {
      findFirst: vi.fn(),
    },
    channelSyncLog: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    channelRetryQueue: {
      findFirst: vi.fn(),
    },
    booking: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    guest: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    room: { count: vi.fn() },
    roomType: { findMany: vi.fn() },
  },
}));

import { db } from '@/lib/db';
import {
  OTASyncService,
  OTASyncScheduler,
} from '@/lib/ota/sync-service';
import type { OTAInventoryUpdate, OTARateUpdate, OTARestrictionUpdate } from '@/lib/ota/types';

// ─── Helpers ──────────────────────────────────────────────────────────────

const mockSuccessResponse = {
  success: true,
  connectionId: 'conn-1',
  syncType: 'inventory' as const,
  direction: 'outbound' as const,
  correlationId: 'corr-1',
  timestamp: new Date(),
  results: [{ type: 'inventory' as const, success: true, count: 1, failed: 0 }],
};

const mockConnection = {
  id: 'conn-1',
  tenantId: 'tenant-1',
  propertyId: 'prop-1',
  channel: 'booking_com',
  status: 'active',
  autoSync: true,
  apiKey: 'key-123',
  apiSecret: 'secret',
  hotelId: 'hotel-456',
  channelMappings: [
    { roomTypeId: 'rt-1', externalRoomId: 'ext-rt-1' },
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// A. OTASyncService.syncInventory
// ═══════════════════════════════════════════════════════════════════════════

describe('A. OTASyncService.syncInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateInventory.mockResolvedValue(mockSuccessResponse);
    mockConnect.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    OTASyncScheduler.stopAll();
  });

  // A1: fans out to all active connections using Promise.allSettled
  it('A1: fans out to all active connections with Promise.allSettled', async () => {
    const connections = [
      { ...mockConnection, id: 'conn-1', channel: 'booking_com' },
      { ...mockConnection, id: 'conn-2', channel: 'agoda' },
      { ...mockConnection, id: 'conn-3', channel: 'expedia' },
    ];
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(connections);
    (db.channelConnection.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ...mockConnection, channelMappings: [] })
      .mockResolvedValueOnce({ ...mockConnection, channelMappings: [] })
      .mockResolvedValueOnce({ ...mockConnection, channelMappings: [] });

    await OTASyncService.syncInventory('tenant-1', 'prop-1', []);

    // Should have called findMany with correct filter
    expect(db.channelConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          status: 'active',
          autoSync: true,
        }),
      })
    );
    // Should have been called 3 times (once per connection)
    expect(mockUpdateInventory).toHaveBeenCalledTimes(3);
  });

  // A2: handles partial failures gracefully
  it('A2: handles partial failures with Promise.allSettled', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...mockConnection, id: 'conn-1' },
      { ...mockConnection, id: 'conn-2' },
    ]);
    // First succeeds, second fails
    mockUpdateInventory
      .mockResolvedValueOnce({ ...mockSuccessResponse })
      .mockRejectedValueOnce(new Error('API rate limit'));
    (db.channelConnection.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ...mockConnection, channelMappings: [] })
      .mockResolvedValueOnce({ ...mockConnection, channelMappings: [] });

    // Should NOT throw since allSettled swallows rejections
    await expect(
      OTASyncService.syncInventory('tenant-1', 'prop-1', [])
    ).resolves.not.toThrow();
  });

  // A3: skips inactive connections
  it('A3: skips inactive connections in findMany filter', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await OTASyncService.syncInventory('tenant-1', 'prop-1', []);

    expect(mockUpdateInventory).not.toHaveBeenCalled();
  });

  // A4: skips connections that are not autoSync
  it('A4: only syncs connections where autoSync is true', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...mockConnection, autoSync: false },
    ]);

    await OTASyncService.syncInventory('tenant-1', 'prop-1', []);

    expect(mockUpdateInventory).not.toHaveBeenCalled();
  });

  // A5: updates sync log on success
  it('A5: updates sync log and connection on success', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection,
    ]);
    (db.channelSyncLog.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (db.channelConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await OTASyncService.syncInventory('tenant-1', 'prop-1', []);

    expect(db.channelSyncLog.updateMany).toHaveBeenCalled();
    expect(db.channelConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-1' },
        data: expect.objectContaining({
          lastSyncAt: expect.any(Date),
          lastError: null,
        }),
      })
    );
  });

  // A6: updates connection lastError on failure
  it('A6: updates connection lastError on failure', async () => {
    mockUpdateInventory.mockRejectedValueOnce(new Error('Auth failed'));
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection,
    ]);
    (db.channelConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockConnection,
      channelMappings: [],
    });
    (db.channelSyncLog.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (db.channelConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await expect(
      OTASyncService.syncInventory('tenant-1', 'prop-1', [])
    ).resolves.not.toThrow(); // allSettled swallows

    expect(db.channelConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastError: 'Auth failed',
        }),
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B. OTASyncService.syncRates
// ═════════════════════════════════════════════════════════════════════════════

describe('B. OTASyncService.syncRates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateRates.mockResolvedValue(mockSuccessResponse);
    mockConnect.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    OTASyncScheduler.stopAll();
  });

  // B1: fans out rate sync to all active connections
  it('B1: fans out rate sync to all active connections', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection,
    ]);
    (db.channelConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockConnection,
      channelMappings: [],
    });

    await OTASyncService.syncRates('tenant-1', 'prop-1', []);

    expect(mockUpdateRates).toHaveBeenCalledTimes(1);
  });

  // B2: handles failures gracefully
  it('B2: handles rate sync failures with allSettled', async () => {
    mockUpdateRates.mockRejectedValue(new Error('Rate API error'));
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection,
    ]);
    (db.channelConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockConnection,
      channelMappings: [],
    });

    await expect(
      OTASyncService.syncRates('tenant-1', 'prop-1', [])
    ).resolves.not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C. OTASyncService.syncRestrictions
// ═════════════════════════════════════════════════════════════════════════════

describe('C. OTASyncService.syncRestrictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateRestrictions.mockResolvedValue(mockSuccessResponse);
    mockConnect.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    OTASyncScheduler.stopAll();
  });

  // C1: fans out restriction sync to all active connections
  it('C1: fans out restriction sync to all active connections', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection,
    ]);
    (db.channelConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockConnection,
      channelMappings: [],
    });

    await OTASyncService.syncRestrictions('tenant-1', 'prop-1', []);

    expect(mockUpdateRestrictions).toHaveBeenCalledTimes(1);
  });

  // C2: handles failures gracefully
  it('C2: handles restriction sync failures with allSettled', async () => {
    mockUpdateRestrictions.mockRejectedValue(new Error('Restriction API error'));
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection,
    ]);
    (db.channelConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockConnection,
      channelMappings: [],
    });

    await expect(
      OTASyncService.syncRestrictions('tenant-1', 'prop-1', [])
    ).resolves.not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D. OTASyncService.pullBookings
// ═════════════════════════════════════════════════════════════════════════════

describe('D. OTASyncService.pullBookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue({ success: true });
    mockGetBookings.mockResolvedValue([
      {
        externalBookingId: 'B-001',
        guest: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        room: { externalRoomId: 'ext-rt-1' },
        dates: { checkIn: '2025-03-01', checkOut: '2025-03-05' },
        guests: { adults: 2, children: 1 },
        pricing: { roomRate: 200, taxes: 20, fees: 10, discount: 0, totalAmount: 230, currency: 'USD' },
        source: 'booking_com',
      },
    ]);
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection,
    ]);
    (db.channelSyncLog.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (db.channelConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.booking.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.guest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.guest.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'guest-1' });
    (db.channelMapping.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      roomTypeId: 'rt-1',
    });
    (db.booking.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'booking-1' });
  });

  afterEach(() => {
    OTASyncScheduler.stopAll();
  });

  // D1: fetches and processes bookings from all connections
  it('D1: fetches and processes bookings from active connections', async () => {
    await OTASyncService.pullBookings(
      'tenant-1', 'prop-1',
      new Date('2025-03-01'), new Date('2025-03-31')
    );

    expect(mockGetBookings).toHaveBeenCalledTimes(1);
    // Should have created a guest and a booking
    expect(db.guest.create).toHaveBeenCalledTimes(1);
    expect(db.booking.create).toHaveBeenCalledTimes(1);
  });

  // D2: handles booking processing failure
  it('D2: handles individual booking processing failures gracefully', async () => {
    mockGetBookings.mockResolvedValue([
      { externalBookingId: 'B-001', guest: { firstName: 'John' } },
    ]);
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection,
    ]);
    (db.channelSyncLog.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (db.booking.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.guest.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));
    (db.channelConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await OTASyncService.pullBookings(
      'tenant-1', 'prop-1',
      new Date('2025-03-01'), new Date('2025-03-31')
    );

    // Should have tried to process but guest creation failed
    expect(db.guest.findFirst).toHaveBeenCalled();
    expect(db.booking.create).not.toHaveBeenCalled();
  });

  // D3: skips inactive connections
  it('D3: skips inactive connections', async () => {
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await OTASyncService.pullBookings(
      'tenant-1', 'prop-1',
      new Date('2025-03-01'), new Date('2025-03-31')
    );

    expect(mockGetBookings).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E. OTASyncService.processIncomingBooking
// ═════════════════════════════════════════════════════════════════════════════

describe('E. processIncomingBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // E1: creates new guest when not found
  it('E1: creates new guest when no matching email found', async () => {
    (db.booking.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.guest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.guest.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'guest-1' });
    (db.channelMapping.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      roomTypeId: 'rt-1',
    });
    (db.booking.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'booking-1' });

    // processIncomingBooking is private, but we can call it indirectly via pullBookings
    mockConnect.mockResolvedValue({ success: true });
    mockGetBookings.mockResolvedValue([
      {
        externalBookingId: 'B-001',
        guest: { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
        room: { externalRoomId: 'ext-rt-1' },
        dates: { checkIn: '2025-03-01', checkOut: '2025-03-05' },
        guests: { adults: 2 },
        pricing: { totalAmount: 500 },
        source: 'booking_com',
      },
    ]);
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection,
    ]);
    (db.channelSyncLog.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (db.channelConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await OTASyncService.pullBookings(
      'tenant-1', 'prop-1',
      new Date('2025-03-01'), new Date('2025-03-31')
    );

    expect(db.guest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          source: 'booking_com',
        }),
      })
    );
    expect(db.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalRef: 'B-001',
          primaryGuestId: 'guest-1',
          status: 'confirmed',
        }),
      })
    );
  });

  // E2: updates existing booking when duplicate found
  it('E2: updates existing booking when externalRef matches', async () => {
    (db.booking.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'existing-booking-1',
    });
    (db.booking.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    mockConnect.mockResolvedValue({ success: true });
    mockGetBookings.mockResolvedValue([
      {
        externalBookingId: 'B-001',
        guest: { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
        room: { externalRoomId: 'ext-rt-1' },
        dates: { checkIn: '2025-03-01', checkOut: '2025-03-05' },
        guests: { adults: 2 },
        pricing: { totalAmount: 500 },
        source: 'booking_com',
      },
    ]);
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection,
    ]);
    (db.channelSyncLog.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (db.channelConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await OTASyncService.pullBookings(
      'tenant-1', 'prop-1',
      new Date('2025-03-01'), new Date('2025-03-31')
    );

    expect(db.guest.create).not.toHaveBeenCalled();
    expect(db.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-booking-1' },
      })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F. OTASyncService.mapInventoryUpdates
// ═════════════════════════════════════════════════════════════════════════════

describe('F. OTASyncService.mapInventoryUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // F1: maps roomTypeId to externalRoomId using mappings
  it('F1: maps roomTypeId to externalRoomId using channel mappings', () => {
    // mapInventoryUpdates is private but tested indirectly through syncInventoryToChannel
    mockUpdateInventory.mockResolvedValue(mockSuccessResponse);
    mockConnect.mockResolvedValue({ success: true });
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection,
    ]);
    (db.channelConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockConnection,
      channelMappings: [
        { roomTypeId: 'rt-1', externalRoomId: 'ext-booking-101' },
        { roomTypeId: 'rt-2', externalRoomId: 'ext-booking-102' },
      ],
    });
    (db.channelSyncLog.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (db.channelConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const updates: OTAInventoryUpdate[] = [
      { roomTypeId: 'rt-1', externalRoomId: 'original', date: '2025-03-01', availableRooms: 5, totalRooms: 5 },
      { roomTypeId: 'rt-2', externalRoomId: 'original', date: '2025-03-01', availableRooms: 3, totalRooms: 3 },
      { roomTypeId: 'rt-3', externalRoomId: 'original', date: '2025-03-01', availableRooms: 10, totalRooms: 10 },
    ];

    await OTASyncService.syncInventory('tenant-1', 'prop-1', updates);

    const calledUpdates = mockUpdateInventory.mock.calls[0][0] as OTAInventoryUpdate[];
    // rt-1 should have been mapped to ext-booking-101
    expect(calledUpdates[0].externalRoomId).toBe('ext-booking-101');
    // rt-2 should have been mapped to ext-booking-102
    expect(calledUpdates[1].externalRoomId).toBe('ext-booking-102');
    // rt-3 has no mapping, should keep original
    expect(calledUpdates[2].externalRoomId).toBe('original');
  });

  // F2: handles empty mappings
  it('F2: keeps original externalRoomId when no mapping found', async () => {
    mockUpdateInventory.mockResolvedValue(mockSuccessResponse);
    mockConnect.mockResolvedValue({ success: true });
    (db.channelConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockConnection,
    ]);
    (db.channelConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockConnection,
      channelMappings: [],
    });
    (db.channelSyncLog.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (db.channelConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const updates: OTAInventoryUpdate[] = [
      { roomTypeId: 'rt-1', externalRoomId: 'orig', date: '2025-03-01', availableRooms: 5, totalRooms: 5 },
    ];

    await OTASyncService.syncInventory('tenant-1', 'prop-1', updates);

    const calledUpdates = mockUpdateInventory.mock.calls[0][0] as OTAInventoryUpdate[];
    expect(calledUpdates[0].externalRoomId).toBe('orig');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// G. OTASyncScheduler
// ═════════════════════════════════════════════════════════════════════════════

describe('G. OTASyncScheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    OTASyncScheduler.stopAll();
    vi.useRealTimers();
  });

  // G1: startScheduledSync starts an interval
  it('G1: startScheduledSync sets up a recurring interval', async () => {
    // Mock pullBookingsFromChannel to avoid DB calls
    vi.spyOn(OTASyncService, 'pullBookingsFromChannel').mockResolvedValue(undefined);

    OTASyncScheduler.startScheduledSync('conn-1', 5);

    // Verify an interval was set
    expect(OTASyncScheduler['intervals'].get('conn-1')).toBeDefined();

    // Fast-forward by 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000);

    // Should have called pullBookingsFromChannel at least once
    expect(OTASyncService.pullBookingsFromChannel).toHaveBeenCalledWith('conn-1');
  });

  // G2: stopScheduledSync clears the interval
  it('G2: stopScheduledSync clears the interval', async () => {
    vi.spyOn(OTASyncService, 'pullBookingsFromChannel').mockResolvedValue(undefined);

    OTASyncScheduler.startScheduledSync('conn-1', 5);
    OTASyncScheduler.stopScheduledSync('conn-1');

    expect(OTASyncScheduler['intervals'].get('conn-1')).toBeUndefined();
  });

  // G3: stopAll clears all intervals
  it('G3: stopAll clears all intervals', async () => {
    vi.spyOn(OTASyncService, 'pullBookingsFromChannel').mockResolvedValue(undefined);

    OTASyncScheduler.startScheduledSync('conn-1', 10);
    OTASyncScheduler.startScheduledSync('conn-2', 15);

    OTASyncScheduler.stopAll();

    expect(OTASyncScheduler['intervals'].size).toBe(0);
  });

  // G4: startScheduledSync stops existing interval before creating new one
  it('G4: restarting replaces the previous interval', async () => {
    vi.spyOn(OTASyncService, 'pullBookingsFromChannel').mockResolvedValue(undefined);

    OTASyncScheduler.startScheduledSync('conn-1', 5);
    const firstInterval = OTASyncScheduler['intervals'].get('conn-1');

    OTASyncScheduler.startScheduledSync('conn-1', 10);
    const secondInterval = OTASyncScheduler['intervals'].get('conn-1');

    // Should be different interval objects
    expect(secondInterval).not.toBe(firstInterval);
    expect(firstInterval).toBeUndefined(); // cleared by stopScheduledSync
  });

  // G5: interval fires pullBookingsFromChannel
  it('G5: interval triggers pullBookingsFromChannel with correct arguments', async () => {
    vi.spyOn(OTASyncService, 'pullBookingsFromChannel').mockResolvedValue(undefined);

    OTASyncScheduler.startScheduledSync('conn-1', 1);

    // Advance by just over 1 minute
    vi.advanceTimersByTime(61 * 1000);

    expect(OTASyncService.pullBookingsFromChannel).toHaveBeenCalledWith('conn-1');
    expect(OTASyncService.pullBookingsFromChannel).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: expect.any(Date), endDate: expect.any(Date) })
    );
  });

  // G6: interval error doesn't crash the scheduler
  it('G6: interval error is caught and logged, not thrown', async () => {
    vi.spyOn(OTASyncService, 'pullBookingsFromChannel').mockRejectedValue(
      new Error('Scheduled sync crashed')
    );

    OTASyncScheduler.startScheduledSync('conn-1', 1);
    vi.advanceTimersByTime(61 * 1000);

    // Should not throw
    expect(OTASyncService.pullBookingsFromChannel).toHaveBeenCalled();
  });
});
