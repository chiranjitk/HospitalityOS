import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// =====================================================
// GET /api/channels/booking-limits
// Query params: connectionId, channelCode, roomTypeId, isActive, action=check, date
// =====================================================
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'channels.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = user.tenantId;
    const action = searchParams.get('action');

    // --- Check action: given a connectionId + roomTypeId + date, check if limit exceeded ---
    if (action === 'check') {
      const connectionId = searchParams.get('connectionId');
      const roomTypeId = searchParams.get('roomTypeId');
      const dateStr = searchParams.get('date');

      if (!connectionId || !dateStr) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'connectionId and date are required for check action' } },
          { status: 400 }
        );
      }

      const checkDate = new Date(dateStr);
      checkDate.setHours(0, 0, 0, 0);

      // Find applicable limit
      const limits = await db.channelBookingLimit.findMany({
        where: {
          tenantId,
          connectionId,
          ...(roomTypeId ? { roomTypeId } : { appliesTo: 'all_room_types' }),
          startDate: { lte: checkDate },
          endDate: { gte: checkDate },
          isActive: true,
        },
        orderBy: { priority: 'desc' },
        take: 1,
      });

      if (limits.length === 0) {
        return NextResponse.json({
          success: true,
          data: { limit: 0, used: 0, remaining: Infinity, exceeded: false },
        });
      }

      const limit = limits[0];
      const remaining = Math.max(0, limit.maxBookings - limit.usedBookings);

      return NextResponse.json({
        success: true,
        data: {
          id: limit.id,
          limit: limit.maxBookings,
          used: limit.usedBookings,
          remaining,
          exceeded: limit.usedBookings >= limit.maxBookings,
          appliesTo: limit.appliesTo,
        },
      });
    }

    // --- List action ---
    const connectionId = searchParams.get('connectionId');
    const channelCode = searchParams.get('channelCode');
    const roomTypeId = searchParams.get('roomTypeId');
    const isActiveParam = searchParams.get('isActive');

    const where: Record<string, unknown> = { tenantId };
    if (connectionId) where.connectionId = connectionId;
    if (channelCode) where.channelCode = channelCode;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (isActiveParam !== null && isActiveParam !== '') {
      where.isActive = isActiveParam === 'true';
    }

    const limits = await db.channelBookingLimit.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { startDate: 'asc' }],
    });

    // Compute stats
    const totalLimits = limits.length;
    const activeLimits = limits.filter((l) => l.isActive).length;
    const nearCapacity = limits.filter(
      (l) => l.isActive && l.maxBookings > 0 && (l.usedBookings / l.maxBookings) >= 0.7 && (l.usedBookings / l.maxBookings) < 1
    ).length;
    const exceeded = limits.filter(
      (l) => l.isActive && l.maxBookings > 0 && l.usedBookings >= l.maxBookings
    ).length;

    // Fetch connection display names
    const connectionIds = [...new Set(limits.filter((l) => l.connectionId).map((l) => l.connectionId!))];
    const connections = connectionIds.length > 0
      ? await db.channelConnection.findMany({
          where: { id: { in: connectionIds } },
          select: { id: true, channel: true, displayName: true },
        })
      : [];
    const connMap = new Map(connections.map((c) => [c.id, c]));

    // Fetch room type names
    const roomTypeIds = [...new Set(limits.filter((l) => l.roomTypeId).map((l) => l.roomTypeId!))];
    const roomTypes = roomTypeIds.length > 0
      ? await db.roomType.findMany({
          where: { id: { in: roomTypeIds } },
          select: { id: true, name: true },
        })
      : [];
    const rtMap = new Map(roomTypes.map((r) => [r.id, r]));

    const enriched = limits.map((l) => {
      const conn = l.connectionId ? connMap.get(l.connectionId) : null;
      const rt = l.roomTypeId ? rtMap.get(l.roomTypeId) : null;
      const utilization = l.maxBookings > 0 ? l.usedBookings / l.maxBookings : 0;
      return {
        ...l,
        connectionDisplayName: conn?.displayName || conn?.channel || l.channelCode,
        roomTypeName: rt?.name || null,
        utilization: Math.round(utilization * 100) / 100,
        remaining: Math.max(0, l.maxBookings - l.usedBookings),
        isExceeded: l.maxBookings > 0 && l.usedBookings >= l.maxBookings,
        isNearCapacity: l.maxBookings > 0 && utilization >= 0.7 && utilization < 1,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        limits: enriched,
        stats: { totalLimits, activeLimits, nearCapacity, exceeded },
      },
    });
  } catch (error) {
    console.error('Error fetching booking limits:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch booking limits' } },
      { status: 500 }
    );
  }
}

// =====================================================
// POST /api/channels/booking-limits
// Body: { action: "recalculate" } or booking limit fields
// =====================================================
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();

    // --- Recalculate action ---
    if (body.action === 'recalculate') {
      const limits = await db.channelBookingLimit.findMany({
        where: { tenantId: user.tenantId, isActive: true },
      });

      let updatedCount = 0;
      for (const limit of limits) {
        // Count actual bookings from Booking table that fall within the limit's date range
        // and match the channel connection
        const bookingCount = await db.booking.count({
          where: {
            tenantId: user.tenantId,
            channelId: limit.connectionId || undefined,
            status: { in: ['confirmed', 'checked_in'] },
            checkIn: { lte: limit.endDate },
            checkOut: { gt: limit.startDate },
            deletedAt: null,
            ...(limit.roomTypeId ? { roomTypeId: limit.roomTypeId } : {}),
          },
        });

        if (bookingCount !== limit.usedBookings) {
          await db.channelBookingLimit.update({
            where: { id: limit.id },
            data: { usedBookings: bookingCount },
          });
          updatedCount++;
        }
      }

      return NextResponse.json({
        success: true,
        data: { message: `Recalculated ${limits.length} limits, ${updatedCount} updated` },
      });
    }

    // --- Create booking limit ---
    const {
      connectionId,
      channelCode,
      roomTypeId,
      startDate,
      endDate,
      maxBookings,
      appliesTo,
      priority,
      isActive,
    } = body;

    if (!channelCode || !startDate || !endDate || maxBookings === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'channelCode, startDate, endDate, and maxBookings are required' } },
        { status: 400 }
      );
    }

    // Verify connection belongs to tenant if provided
    if (connectionId) {
      const conn = await db.channelConnection.findFirst({
        where: { id: connectionId, tenantId: user.tenantId },
      });
      if (!conn) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found' } },
          { status: 404 }
        );
      }
    }

    const created = await db.channelBookingLimit.create({
      data: {
        tenantId: user.tenantId,
        connectionId,
        channelCode,
        roomTypeId: roomTypeId || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        maxBookings: maxBookings || 0,
        appliesTo: appliesTo || 'all_room_types',
        priority: priority || 0,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: unknown) {
    console.error('Error creating booking limit:', error);
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'A booking limit with the same combination already exists for this date' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create booking limit' } },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT /api/channels/booking-limits
// Body: { id, ...fields }
// =====================================================
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { id, maxBookings, isActive, endDate, priority, appliesTo } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    const existing = await db.channelBookingLimit.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking limit not found' } },
        { status: 404 }
      );
    }

    const updated = await db.channelBookingLimit.update({
      where: { id },
      data: {
        ...(maxBookings !== undefined ? { maxBookings } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(appliesTo !== undefined ? { appliesTo } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating booking limit:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update booking limit' } },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE /api/channels/booking-limits?id=X
// =====================================================
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

    const existing = await db.channelBookingLimit.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking limit not found' } },
        { status: 404 }
      );
    }

    await db.channelBookingLimit.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id, deleted: true } });
  } catch (error) {
    console.error('Error deleting booking limit:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete booking limit' } },
      { status: 500 }
    );
  }
}
