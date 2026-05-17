import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/bookings/early-checkin - List early check-in requests for a property with stats
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const bookingId = searchParams.get('bookingId');

    const where: Record<string, unknown> = { tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (bookingId) where.bookingId = bookingId;
    if (status) where.status = status;

    const entries = await db.earlyCheckinRequest.findMany({
      where,
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            status: true,
            roomRate: true,
            currency: true,
            checkIn: true,
            roomType: { select: { id: true, name: true, basePrice: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with guest info
    const guestIds = [...new Set(entries.map((e) => e.guestId))];
    const guests = await db.guest.findMany({
      where: { id: { in: guestIds } },
      select: { id: true, firstName: true, lastName: true, loyaltyTier: true, isVip: true },
    });
    const guestMap = new Map(guests.map((g) => [g.id, g]));

    const enriched = entries.map((entry) => ({
      ...entry,
      guest: guestMap.get(entry.guestId) || null,
    }));

    // Stats
    const baseWhere: Record<string, unknown> = { tenantId };
    if (propertyId) baseWhere.propertyId = propertyId;

    const stats = {
      total: await db.earlyCheckinRequest.count({ where: baseWhere }),
      pending: await db.earlyCheckinRequest.count({ where: { ...baseWhere, status: 'pending' } }),
      approved: await db.earlyCheckinRequest.count({ where: { ...baseWhere, status: 'approved' } }),
      rejected: await db.earlyCheckinRequest.count({ where: { ...baseWhere, status: 'rejected' } }),
      completed: await db.earlyCheckinRequest.count({ where: { ...baseWhere, status: 'completed' } }),
      totalFeesCollected: (
        await db.earlyCheckinRequest.aggregate({
          where: { ...baseWhere, feeStatus: 'paid' },
          _sum: { feeAmount: true },
        })
      )._sum.feeAmount || 0,
      totalFeesWaived: (
        await db.earlyCheckinRequest.aggregate({
          where: { ...baseWhere, feeStatus: 'waived' },
          _sum: { feeAmount: true },
        })
      )._sum.feeAmount || 0,
    };

    return NextResponse.json({ success: true, data: enriched, stats });
  } catch (error) {
    console.error('[EarlyCheckin] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch early check-in requests' } },
      { status: 500 }
    );
  }
}

// POST /api/bookings/early-checkin - Create early check-in request with auto-fee calculation
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const body = await request.json();
    const { bookingId, requestedTime, reason } = body;

    if (!bookingId || !requestedTime) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId and requestedTime are required' } },
        { status: 400 }
      );
    }

    // Fetch booking with room type and guest loyalty info
    const booking = await db.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        roomType: { select: { basePrice: true } },
        primaryGuest: { select: { id: true, loyaltyTier: true, isVip: true } },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    if (!['confirmed', 'checked_in'].includes(booking.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Booking must be confirmed or checked in' } },
        { status: 400 }
      );
    }

    const requestedTimeDate = new Date(requestedTime);
    const standardCheckIn = new Date(booking.checkIn);
    standardCheckIn.setHours(15, 0, 0, 0); // Standard 3 PM check-in

    // Ensure requested time is before standard check-in
    if (requestedTimeDate >= standardCheckIn) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Requested time must be before standard check-in (3 PM)' } },
        { status: 400 }
      );
    }

    // Calculate hours early
    const hoursEarly = Math.max(0, (standardCheckIn.getTime() - requestedTimeDate.getTime()) / (1000 * 60 * 60));

    // Fee calculation: (hours_early / 24) * nightly_rate * fee_percentage
    // Default fee percentage is 30%
    const feePercentage = 0.3;
    const nightlyRate = booking.roomRate || booking.roomType.basePrice;
    const feeAmount = parseFloat(((hoursEarly / 24) * nightlyRate * feePercentage).toFixed(2));

    // Auto-waive fee for Gold+ loyalty tier
    const loyaltyTier = booking.primaryGuest.loyaltyTier || 'bronze';
    const loyaltyWaived = ['gold', 'platinum', 'diamond'].includes(loyaltyTier.toLowerCase());

    // Auto-approve if within hotel policy window (e.g., within 2 hours of check-in)
    const isAutoApproved = hoursEarly <= 2;

    const entry = await db.earlyCheckinRequest.create({
      data: {
        bookingId,
        tenantId,
        propertyId: booking.propertyId,
        guestId: booking.primaryGuestId,
        requestedTime: requestedTimeDate,
        feeAmount: loyaltyWaived ? 0 : feeAmount,
        feeStatus: loyaltyWaived ? 'waived' : 'pending',
        reason,
        status: isAutoApproved ? 'approved' : 'pending',
        approvedAt: isAutoApproved ? new Date() : null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...entry,
          guest: booking.primaryGuest,
          loyaltyTier,
          loyaltyWaived,
          autoApproved: isAutoApproved,
          hoursEarly: parseFloat(hoursEarly.toFixed(1)),
          nightlyRate,
          feePercentage,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[EarlyCheckin] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create early check-in request' } },
      { status: 500 }
    );
  }
}
