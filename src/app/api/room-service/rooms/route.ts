import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });

    const propertyId = request.nextUrl.searchParams.get('propertyId');
    if (!propertyId) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID required' } }, { status: 400 });

    const prop = await db.property.findFirst({ where: { id: propertyId, tenantId: user.tenantId, deletedAt: null }, select: { id: true } });
    if (!prop) return NextResponse.json({ success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } }, { status: 400 });

    const activeBookings = await db.booking.findMany({
      where: { tenantId: user.tenantId, propertyId, status: 'checked_in' },
      select: {
        id: true, primaryGuestId: true, roomId: true,
        primaryGuest: { select: { firstName: true, lastName: true } },
        room: { select: { number: true, floor: true } },
      },
    });

    const rooms = await Promise.all(activeBookings.map(async (b) => {
      const activeOrders = await db.order.count({
        where: { bookingId: b.id, tenantId: user.tenantId, orderType: 'room_service', status: { in: ['pending', 'confirmed', 'preparing', 'in_transit'] } },
      });
      return {
        id: b.roomId || b.id,
        number: b.room?.number || 'N/A',
        floor: b.room?.floor,
        guestName: `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}`,
        bookingId: b.id,
        bookingStatus: 'checked_in',
        activeOrders,
      };
    }));

    return NextResponse.json({ success: true, data: rooms });
  } catch (error) {
    console.error('Error fetching room service rooms:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rooms' } }, { status: 500 });
  }
}
