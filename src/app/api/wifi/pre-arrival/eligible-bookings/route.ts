import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/wifi/pre-arrival/eligible-bookings?propertyId=xxx
// Returns confirmed bookings within the delivery window that haven't been sent yet
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: propertyId' } },
        { status: 400 },
      );
    }

    // Get the pre-arrival config to know the delivery window
    const config = await db.wiFiPreArrivalConfig.findUnique({
      where: {
        tenantId_propertyId: {
          tenantId: auth.tenantId,
          propertyId,
        },
      },
    });

    const hoursBefore = config?.hoursBeforeArrival ?? 48;

    // Find eligible bookings:
    // - confirmed status
    // - checkIn is within the delivery window (now .. now + hoursBefore)
    // - preArrivalSent = false
    // - not cancelled
    const now = new Date();
    const windowEnd = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);

    const bookings = await db.booking.findMany({
      where: {
        tenantId: auth.tenantId,
        propertyId,
        status: 'confirmed',
        preArrivalSent: false,
        checkIn: {
          gte: now,
          lte: windowEnd,
        },
      },
      include: {
        primaryGuest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        property: {
          select: { id: true, name: true },
        },
      },
      orderBy: { checkIn: 'asc' },
      take: 50,
    });

    // Also fetch already-sent bookings for this property (last 10)
    const sentBookings = await db.booking.findMany({
      where: {
        tenantId: auth.tenantId,
        propertyId,
        preArrivalSent: true,
      },
      include: {
        primaryGuest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    // Check for existing WiFi users per booking
    const bookingIds = [...bookings.map(b => b.id), ...sentBookings.map(b => b.id)];
    const wifiUsers = bookingIds.length > 0
      ? await db.wiFiUser.findMany({
          where: { bookingId: { in: bookingIds } },
          select: { bookingId: true, username: true, status: true },
        })
      : [];

    const wifiUserMap = Object.fromEntries(wifiUsers.map(u => [u.bookingId, u]));

    return NextResponse.json({
      success: true,
      data: {
        eligible: bookings.map(b => ({
          id: b.id,
          confirmationCode: b.confirmationCode,
          checkIn: b.checkIn,
          checkOut: b.checkOut,
          guestName: `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}`,
          guestEmail: b.primaryGuest.email,
          guestPhone: b.primaryGuest.phone,
          hasEmail: !!b.primaryGuest.email,
          hasPhone: !!b.primaryGuest.phone,
          propertyName: b.property.name,
          wifiUser: wifiUserMap[b.id] ? {
            username: wifiUserMap[b.id].username,
            status: wifiUserMap[b.id].status,
          } : null,
        })),
        alreadySent: sentBookings.map(b => ({
          id: b.id,
          confirmationCode: b.confirmationCode,
          guestName: `${b.primaryGuest.firstName} ${b.primaryGuest.lastName}`,
          wifiUser: wifiUserMap[b.id] ? {
            username: wifiUserMap[b.id].username,
          } : null,
        })),
        deliveryWindow: {
          hoursBefore,
          from: now.toISOString(),
          to: windowEnd.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('[pre-arrival/eligible-bookings] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch eligible bookings' } },
      { status: 500 },
    );
  }
}
