import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/channels/allocations?propertyId=X&startDate=Y&endDate=Z
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'channels.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = user.tenantId;
    const propertyIdParam = searchParams.get('propertyId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Default to today + 6 days (7 day window)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = startDateStr ? new Date(startDateStr) : today;
    const endDate = endDateStr
      ? new Date(endDateStr)
      : new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
    endDate.setHours(23, 59, 59, 999);

    // Resolve property IDs: use provided propertyId or fall back to all tenant properties
    let propertyIds: string[];
    try {
      if (propertyIdParam) {
        propertyIds = [propertyIdParam];
      } else {
        const properties = await db.property.findMany({
          where: { tenantId },
          select: { id: true },
        });
        propertyIds = properties.map((p) => p.id);
      }
    } catch (err) {
      console.error('Error resolving properties:', err);
      propertyIds = [];
    }

    if (propertyIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          allocations: [],
          channels: [],
          summary: {
            totalRoomTypes: 0,
            totalRooms: 0,
            totalAllocated: 0,
            totalFreeSale: 0,
            utilizationRate: 0,
            dateRange: { startDate, endDate },
          },
        },
      });
    }

    // 1. Fetch room types for these properties (RoomType does NOT have tenantId)
    let roomTypes: Array<{ id: string; name: string; code: string; propertyId: string; sortOrder: number }>;
    try {
      roomTypes = await db.roomType.findMany({
        where: {
          propertyId: { in: propertyIds },
          deletedAt: null,
        },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          code: true,
          propertyId: true,
          sortOrder: true,
        },
      });
    } catch (err) {
      console.error('Error fetching room types:', err);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch room types' } },
        { status: 500 }
      );
    }

    if (roomTypes.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          allocations: [],
          channels: [],
          summary: {
            totalRoomTypes: 0,
            totalRooms: 0,
            totalAllocated: 0,
            totalFreeSale: 0,
            utilizationRate: 0,
            dateRange: { startDate, endDate },
          },
        },
      });
    }

    const roomTypeIds = roomTypes.map((rt) => rt.id);

    // 2. Count total rooms per room type (exclude deleted and out-of-order)
    let roomCounts: Array<{ roomTypeId: string; _count: { id: number } }>;
    try {
      roomCounts = await db.room.groupBy({
        by: ['roomTypeId'],
        where: {
          roomTypeId: { in: roomTypeIds },
          status: { not: 'out_of_order' },
          deletedAt: null,
        },
        _count: { id: true },
      });
    } catch (err) {
      console.error('Error fetching room counts:', err);
      roomCounts = [];
    }

    const roomCountMap = new Map(roomCounts.map((r) => [r.roomTypeId, r._count.id]));

    // 3. Fetch active channel connections
    let connections: Array<{
      id: string;
      tenantId: string;
      channel: string;
      displayName: string | null;
      propertyId: string | null;
      status: string;
    }>;
    try {
      connections = await db.channelConnection.findMany({
        where: {
          tenantId,
          // ChannelConnection.propertyId is optional; filter only if specific propertyId requested
          ...(propertyIdParam ? { propertyId: propertyIdParam } : {}),
          status: 'active',
        },
        orderBy: { channel: 'asc' },
      });
    } catch (err) {
      console.error('Error fetching channel connections:', err);
      connections = [];
    }

    const connectionIds = connections.map((c) => c.id);
    const connectionMap = new Map(connections.map((c) => [c.id, c]));

    // 4. Fetch existing allocation records (ChannelRestriction with source='allocation')
    let allocationRecords: Array<{
      id: string;
      connectionId: string;
      roomTypeId: string;
      startDate: Date;
      endDate: Date;
      closed: boolean;
      rateMin: number | null;
    }>;
    try {
      if (connectionIds.length > 0) {
        allocationRecords = await db.channelRestriction.findMany({
          where: {
            connectionId: { in: connectionIds },
            roomTypeId: { in: roomTypeIds },
            source: 'allocation',
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        });
      } else {
        allocationRecords = [];
      }
    } catch (err) {
      console.error('Error fetching allocation records:', err);
      allocationRecords = [];
    }

    // 5. Fetch bookings that overlap with the date range for booked counts
    let activeBookings: Array<{
      id: string;
      roomTypeId: string;
      channelId: string | null;
      checkIn: Date;
      checkOut: Date;
    }>;
    try {
      activeBookings = await db.booking.findMany({
        where: {
          tenantId,
          propertyId: { in: propertyIds },
          roomTypeId: { in: roomTypeIds },
          status: { in: ['confirmed', 'checked_in'] },
          checkIn: { lte: endDate },
          checkOut: { gt: startDate },
          deletedAt: null,
        },
        select: {
          id: true,
          roomTypeId: true,
          channelId: true,
          checkIn: true,
          checkOut: true,
        },
      });
    } catch (err) {
      console.error('Error fetching active bookings:', err);
      activeBookings = [];
    }

    // 6. Build date array
    const dates: string[] = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      dates.push(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() + 1);
    }

    // 7. Build allocation map: key = `${connectionId}-${roomTypeId}-${date}`
    const allocationMap = new Map<string, { allocated: number; closed: boolean; id: string }>();
    for (const rec of allocationRecords) {
      const recStart = new Date(rec.startDate);
      const recEnd = new Date(rec.endDate);
      const dCursor = new Date(recStart);
      while (dCursor <= recEnd) {
        if (dCursor >= startDate && dCursor <= endDate) {
          const key = `${rec.connectionId}-${rec.roomTypeId}-${dCursor.toISOString().split('T')[0]}`;
          allocationMap.set(key, {
            allocated: Math.round(rec.rateMin || 0),
            closed: rec.closed,
            id: rec.id,
          });
        }
        dCursor.setDate(dCursor.getDate() + 1);
      }
    }

    // 8. Build booked map per roomTypeId per date, and per channel
    const bookedPerDatePerType = new Map<string, number>();
    const bookedPerDatePerTypePerChannel = new Map<string, number>();
    for (const booking of activeBookings) {
      const bStart = new Date(booking.checkIn);
      const bEnd = new Date(booking.checkOut);
      const dCursor = new Date(bStart);
      while (dCursor < bEnd) {
        if (dCursor >= startDate && dCursor <= endDate) {
          const dateStr = dCursor.toISOString().split('T')[0];
          const typeKey = `${booking.roomTypeId}-${dateStr}`;
          bookedPerDatePerType.set(typeKey, (bookedPerDatePerType.get(typeKey) || 0) + 1);
          if (booking.channelId) {
            const channelKey = `${booking.channelId}-${booking.roomTypeId}-${dateStr}`;
            bookedPerDatePerTypePerChannel.set(channelKey, (bookedPerDatePerTypePerChannel.get(channelKey) || 0) + 1);
          }
        }
        dCursor.setDate(dCursor.getDate() + 1);
      }
    }

    // 9. Build allocation response per date per room type
    const allocations: Array<{
      roomTypeId: string;
      roomTypeName: string;
      roomTypeCode: string;
      date: string;
      totalRooms: number;
      booked: number;
      available: number;
      channels: Record<string, { allocated: number; used: number; connectionId: string }>;
      freeSale: number;
      overbooked: boolean;
    }> = [];

    let totalAllocated = 0;
    let totalFreeSale = 0;
    let totalAvailable = 0;

    for (const dateStr of dates) {
      for (const rt of roomTypes) {
        const totalRooms = roomCountMap.get(rt.id) || 0;
        const booked = bookedPerDatePerType.get(`${rt.id}-${dateStr}`) || 0;
        const available = totalRooms - booked;

        const channels: Record<string, { allocated: number; used: number; connectionId: string }> = {};
        let allocatedSum = 0;

        for (const conn of connections) {
          const key = `${conn.id}-${rt.id}-${dateStr}`;
          const allocation = allocationMap.get(key);
          const allocated = allocation && !allocation.closed ? allocation.allocated : 0;
          const used = bookedPerDatePerTypePerChannel.get(`${conn.id}-${rt.id}-${dateStr}`) || 0;

          channels[conn.channel] = {
            allocated,
            used,
            connectionId: conn.id,
          };
          allocatedSum += allocated;
        }

        const freeSale = Math.max(0, available - allocatedSum);
        const overbooked = allocatedSum > available;

        allocations.push({
          roomTypeId: rt.id,
          roomTypeName: rt.name,
          roomTypeCode: rt.code,
          date: dateStr,
          totalRooms,
          booked,
          available,
          channels,
          freeSale,
          overbooked,
        });

        totalAllocated += allocatedSum;
        totalFreeSale += freeSale;
        totalAvailable += available;
      }
    }

    // 10. Build per-channel summary
    const channelSummary = connections.map((conn) => {
      let channelAllocated = 0;
      let channelUsed = 0;
      let channelFreeSale = 0;
      for (const alloc of allocations) {
        const ch = alloc.channels[conn.channel];
        if (ch) {
          channelAllocated += ch.allocated;
          channelUsed += ch.used;
        }
      }
      channelFreeSale = Math.max(0, channelAllocated - channelUsed);
      const utilizationRate = channelAllocated > 0 ? channelUsed / channelAllocated : 0;

      return {
        channelId: conn.id,
        channel: conn.channel,
        displayName: conn.displayName || conn.channel,
        status: conn.status,
        totalAllocated: channelAllocated,
        totalUsed: channelUsed,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
        freeSale: channelFreeSale,
      };
    });

    // 11. Calculate summary
    const totalRoomsAcrossDates = dates.reduce(
      (sum, _d) => sum + roomTypes.reduce((s, rt) => s + (roomCountMap.get(rt.id) || 0), 0),
      0
    );
    const utilizationRate = totalAvailable > 0 ? totalAllocated / totalAvailable : 0;

    return NextResponse.json({
      success: true,
      data: {
        allocations,
        channels: connections.map((c) => ({
          id: c.id,
          channel: c.channel,
          displayName: c.displayName || c.channel,
          status: c.status,
        })),
        channelSummary,
        summary: {
          totalRoomTypes: roomTypes.length,
          totalRooms: roomTypes.reduce((s, rt) => s + (roomCountMap.get(rt.id) || 0), 0),
          totalAllocated,
          totalFreeSale,
          utilizationRate: Math.round(utilizationRate * 100) / 100,
          dateRange: { startDate, endDate, days: dates.length },
          totalBooked: activeBookings.length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching channel allocations:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch allocation data' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/allocations — Create allocation
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { connectionId, roomTypeId, startDate, endDate, allocationCount, closed } = body;

    if (!connectionId || !roomTypeId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'connectionId, roomTypeId, startDate, and endDate are required' } },
        { status: 400 }
      );
    }

    // Verify the connection belongs to tenant
    let connection;
    try {
      connection = await db.channelConnection.findFirst({
        where: { id: connectionId, tenantId: user.tenantId },
      });
    } catch (err) {
      console.error('Error verifying channel connection:', err);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to verify channel connection' } },
        { status: 500 }
      );
    }

    if (!connection) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found' } },
        { status: 404 }
      );
    }

    // Verify the room type exists
    let roomType;
    try {
      roomType = await db.roomType.findFirst({
        where: { id: roomTypeId, deletedAt: null },
      });
    } catch (err) {
      console.error('Error verifying room type:', err);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to verify room type' } },
        { status: 500 }
      );
    }

    if (!roomType) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room type not found' } },
        { status: 404 }
      );
    }

    // Check if allocation already exists (unique constraint: connectionId + roomTypeId + startDate)
    let existing;
    try {
      existing = await db.channelRestriction.findUnique({
        where: {
          connectionId_roomTypeId_startDate: {
            connectionId,
            roomTypeId,
            startDate: new Date(startDate),
          },
        },
      });
    } catch (err) {
      console.error('Error checking existing allocation:', err);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to check existing allocation' } },
        { status: 500 }
      );
    }

    if (existing) {
      // Update existing
      let updated;
      try {
        updated = await db.channelRestriction.update({
          where: { id: existing.id },
          data: {
            endDate: new Date(endDate),
            rateMin: allocationCount ?? 0,
            closed: closed ?? false,
            source: 'allocation',
            syncStatus: 'pending',
            lastSyncedAt: null,
          },
        });
      } catch (err) {
        console.error('Error updating allocation:', err);
        return NextResponse.json(
          { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update allocation' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          id: updated.id,
          connectionId,
          roomTypeId,
          startDate: updated.startDate,
          endDate: updated.endDate,
          allocationCount: updated.rateMin,
          closed: updated.closed,
        },
      });
    }

    // Create new allocation
    let created;
    try {
      created = await db.channelRestriction.create({
        data: {
          connectionId,
          roomTypeId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          rateMin: allocationCount ?? 0,
          closed: closed ?? false,
          source: 'allocation',
          syncStatus: 'pending',
        },
      });
    } catch (err) {
      console.error('Error creating allocation:', err);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create allocation' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: created.id,
        connectionId,
        roomTypeId,
        startDate: created.startDate,
        endDate: created.endDate,
        allocationCount: created.rateMin,
        closed: created.closed,
      },
    });
  } catch (error) {
    console.error('Error creating allocation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create allocation' } },
      { status: 500 }
    );
  }
}

// PUT /api/channels/allocations — Update allocation
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { id, connectionId, roomTypeId, startDate, endDate, allocationCount, closed } = body;

    if (!id && !connectionId && !roomTypeId && !startDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Provide id or (connectionId + roomTypeId + startDate) to update' } },
        { status: 400 }
      );
    }

    let record;
    try {
      if (id) {
        record = await db.channelRestriction.findFirst({
          where: { id, source: 'allocation', connection: { tenantId: user.tenantId } },
        });
      } else {
        record = await db.channelRestriction.findUnique({
          where: {
            connectionId_roomTypeId_startDate: {
              connectionId,
              roomTypeId,
              startDate: new Date(startDate),
            },
          },
        });
      }
    } catch (err) {
      console.error('Error finding allocation record:', err);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to find allocation record' } },
        { status: 500 }
      );
    }

    if (!record) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Allocation record not found' } },
        { status: 404 }
      );
    }

    let updated;
    try {
      updated = await db.channelRestriction.update({
        where: { id: record.id },
        data: {
          ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}),
          ...(allocationCount !== undefined ? { rateMin: allocationCount } : {}),
          ...(closed !== undefined ? { closed } : {}),
          syncStatus: 'pending',
        },
      });
    } catch (err) {
      console.error('Error updating allocation:', err);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update allocation' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        connectionId: updated.connectionId,
        roomTypeId: updated.roomTypeId,
        startDate: updated.startDate,
        endDate: updated.endDate,
        allocationCount: updated.rateMin,
        closed: updated.closed,
      },
    });
  } catch (error) {
    console.error('Error updating allocation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update allocation' } },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/allocations?id=X
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    // Verify record belongs to tenant
    let record;
    try {
      record = await db.channelRestriction.findFirst({
        where: { id, source: 'allocation', connection: { tenantId: user.tenantId } },
      });
    } catch (err) {
      console.error('Error finding allocation record for delete:', err);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to find allocation record' } },
        { status: 500 }
      );
    }

    if (!record) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Allocation record not found' } },
        { status: 404 }
      );
    }

    try {
      await db.channelRestriction.delete({
        where: { id },
      });
    } catch (err) {
      console.error('Error deleting allocation:', err);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete allocation' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { id: record.id, deleted: true },
    });
  } catch (error) {
    console.error('Error deleting allocation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete allocation' } },
      { status: 500 }
    );
  }
}
