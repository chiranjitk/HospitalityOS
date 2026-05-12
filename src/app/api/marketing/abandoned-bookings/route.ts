import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/marketing/abandoned-bookings — List abandoned bookings
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['marketing.view', 'marketing.manage', 'marketing.*', '*'])) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const recoveryStatus = searchParams.get('recoveryStatus');
    const stepAbandoned = searchParams.get('stepAbandoned');
    const propertyId = searchParams.get('propertyId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (recoveryStatus) where.recoveryStatus = recoveryStatus;
    if (stepAbandoned) where.stepAbandoned = stepAbandoned;
    if (propertyId) where.propertyId = propertyId;
    if (dateFrom || dateTo) {
      where.createdAt = {} as Record<string, unknown>;
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
    }

    const bookings = await db.abandonedBooking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Funnel stats
    const total = bookings.length;
    const funnel = {
      search: bookings.filter((b) => b.stepAbandoned === 'search').length,
      room_select: bookings.filter((b) => b.stepAbandoned === 'room_select').length,
      guest_info: bookings.filter((b) => b.stepAbandoned === 'guest_info').length,
      payment: bookings.filter((b) => b.stepAbandoned === 'payment').length,
    };
    const recovery = {
      pending: bookings.filter((b) => b.recoveryStatus === 'pending').length,
      emailed: bookings.filter((b) => b.recoveryStatus === 'emailed').length,
      smsSent: bookings.filter((b) => b.recoveryStatus === 'sms_sent').length,
      recovered: bookings.filter((b) => b.recoveryStatus === 'recovered').length,
      expired: bookings.filter((b) => b.recoveryStatus === 'expired').length,
    };
    const totalRevenueRecovered = bookings
      .filter((b) => b.recoveryStatus === 'recovered' && b.selectedRate)
      .reduce((s, b) => s + b.selectedRate!, 0);
    const recoveryRate = total > 0 ? Math.round((recovery.recovered / total) * 10000) / 100 : 0;

    const stats = { total, funnel, recovery, totalRevenueRecovered, recoveryRate };

    return NextResponse.json({ success: true, data: { bookings, stats } });
  } catch (error) {
    console.error('Error fetching abandoned bookings:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch abandoned bookings' }, { status: 500 });
  }
}

// POST /api/marketing/abandoned-bookings — Create abandoned booking record
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['marketing.manage', 'marketing.*', '*'])) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      sessionId, guestEmail, guestPhone, roomTypeId,
      checkIn, checkOut, adults, children, selectedRate,
      currency, stepAbandoned, propertyId,
    } = body;

    if (!stepAbandoned) {
      return NextResponse.json({ success: false, error: 'stepAbandoned is required' }, { status: 400 });
    }

    const booking = await db.abandonedBooking.create({
      data: {
        tenantId: user.tenantId,
        sessionId: sessionId || null,
        guestEmail: guestEmail || null,
        guestPhone: guestPhone || null,
        roomTypeId: roomTypeId || null,
        propertyId: propertyId || null,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        adults: adults || 1,
        children: children || 0,
        selectedRate: selectedRate || null,
        currency: currency || 'USD',
        stepAbandoned,
        recoveryStatus: 'pending',
      },
    });

    return NextResponse.json({ success: true, data: booking }, { status: 201 });
  } catch (error) {
    console.error('Error creating abandoned booking:', error);
    return NextResponse.json({ success: false, error: 'Failed to create abandoned booking' }, { status: 500 });
  }
}
