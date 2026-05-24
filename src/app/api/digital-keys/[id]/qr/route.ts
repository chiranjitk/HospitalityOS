import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/digital-keys/[id]/qr - Get key data for QR generation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experience.keys') && !hasPermission(user, 'digital_keys.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    // The 'id' here refers to the booking/room key identifier
    // We fetch the booking and room information
    const booking = await db.booking.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        status: { in: ['confirmed', 'checked_in'] },
      },
      include: {
        primaryGuest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        room: {
          select: {
            id: true,
            number: true,
            floor: true,
          },
        },
        roomType: {
          select: {
            name: true,
          },
        },
        property: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking or key not found' } },
        { status: 404 }
      );
    }

    // Generate a key secret if not stored (use crypto.randomBytes for security)
    const { randomBytes } = await import('crypto');
    const keySecret = booking.confirmationCode + '-' + randomBytes(4).toString('hex').toUpperCase();
    const maskedSecret = keySecret.substring(0, 4) + '****' + keySecret.substring(keySecret.length - 4);

    return NextResponse.json({
      success: true,
      data: {
        keyId: booking.id,
        keySecret,
        maskedSecret,
        guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
        roomNumber: booking.room?.number || 'N/A',
        roomType: booking.roomType?.name || '',
        floor: booking.room?.floor || 0,
        hotelName: booking.property?.name || '',
        confirmationCode: booking.confirmationCode,
        validFrom: booking.checkIn.toISOString(),
        validTo: booking.checkOut.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching QR key data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch key data' } },
      { status: 500 }
    );
  }
}
