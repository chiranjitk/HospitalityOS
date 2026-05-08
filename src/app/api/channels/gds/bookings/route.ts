import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/channels/gds/bookings — list GDS bookings
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['channels.view', 'channels.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const status = searchParams.get('status');
    const pnr = searchParams.get('pnr');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (connectionId) where.connectionId = connectionId;
    if (status) where.status = status;
    if (pnr) where.pnr = pnr;

    const bookings = await db.gdsBooking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ success: true, data: bookings });
  } catch (error) {
    console.error('Error listing GDS bookings:', error);
    return NextResponse.json({ success: false, error: 'Failed to list GDS bookings' }, { status: 500 });
  }
}

// POST /api/channels/gds/bookings — create a GDS booking
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['channels.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { connectionId, gdsRef, pnr, guestName, guestEmail, guestPhone, checkIn, checkOut, roomType, rateCode, adults, children } = body;

    if (!connectionId || !guestName || !checkIn || !checkOut) {
      return NextResponse.json({ success: false, error: 'connectionId, guestName, checkIn, and checkOut are required' }, { status: 400 });
    }

    const booking = await db.gdsBooking.create({
      data: {
        tenantId: user.tenantId,
        connectionId,
        gdsRef: gdsRef ?? null,
        pnr: pnr ?? null,
        guestName,
        guestEmail: guestEmail ?? null,
        guestPhone: guestPhone ?? null,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        roomType: roomType ?? null,
        rateCode: rateCode ?? null,
        adults: adults ?? 1,
        children: children ?? 0,
        status: 'new',
        syncStatus: 'pending',
      },
    });

    return NextResponse.json({ success: true, data: booking }, { status: 201 });
  } catch (error) {
    console.error('Error creating GDS booking:', error);
    return NextResponse.json({ success: false, error: 'Failed to create GDS booking' }, { status: 500 });
  }
}
