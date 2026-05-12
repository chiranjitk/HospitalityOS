import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['rooms.update', 'rooms.manage', 'rooms.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const sp = request.nextUrl.searchParams;
    const status = sp.get('status');
    const bookingId = sp.get('bookingId');
    const limit = Math.min(parseInt(sp.get('limit') || '100', 10), 100);
    const offset = parseInt(sp.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) where.status = status;
    if (bookingId) where.bookingId = bookingId;

    const data = await db.roomTypeChange.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit, skip: offset,
    });

    const total = await db.roomTypeChange.count({ where });
    return NextResponse.json({ success: true, data, pagination: { total, limit, offset } });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch changes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['rooms.update', 'rooms.manage', 'rooms.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { bookingId, roomId, oldRoomTypeId, newRoomTypeId, reason, rateDifference } = body;
    if (!bookingId || !roomId || !oldRoomTypeId || !newRoomTypeId)
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

    // Verify booking belongs to tenant
    const booking = await db.booking.findFirst({ where: { id: bookingId, tenantId: user.tenantId } });
    if (!booking) return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });

    const change = await db.roomTypeChange.create({
      data: {
        tenantId: user.tenantId,
        propertyId: booking.propertyId,
        bookingId, roomId, oldRoomTypeId, newRoomTypeId,
        reason: reason || '', rateDifference: rateDifference || 0,
        status: 'requested', requestedBy: user.id,
      },
    });

    return NextResponse.json({ success: true, data: change }, { status: 201 });
  } catch (error) {
    console.error('POST /api/rooms/type-changes:', error);
    return NextResponse.json({ success: false, error: 'Failed to create change request' }, { status: 500 });
  }
}
