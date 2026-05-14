import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/bookings/upgrade-suggestions - Get room upgrade options for a booking
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.view', 'reservations.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const bookingId = request.nextUrl.searchParams.get('bookingId');
    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId is required' } },
        { status: 400 }
      );
    }

    // Fetch booking with current room type
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        roomType: true,
        room: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // Booking must be confirmed or checked_in
    if (!['confirmed', 'checked_in'].includes(booking.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Booking must be confirmed or checked in to request upgrades' } },
        { status: 400 }
      );
    }

    // Find all room types with higher base price at the same property
    const higherPricedRoomTypes = await db.roomType.findMany({
      where: {
        propertyId: booking.propertyId,
        basePrice: { gt: booking.roomType.basePrice },
        status: 'active',
        deletedAt: null,
      },
      include: {
        rooms: {
          where: { status: 'available' },
        },
      },
      orderBy: { basePrice: 'asc' },
    });

    if (higherPricedRoomTypes.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Get existing bookings for the date range (for availability calculation)
    const checkInDate = new Date(booking.checkIn);
    const checkOutDate = new Date(booking.checkOut);

    const existingBookings = await db.booking.findMany({
      where: {
        propertyId: booking.propertyId,
        status: { in: ['confirmed', 'checked_in'] },
        id: { not: booking.id }, // Exclude current booking
        OR: [
          {
            AND: [
              { checkIn: { lt: checkOutDate } },
              { checkOut: { gt: checkInDate } },
            ],
          },
        ],
      },
      select: {
        roomId: true,
        roomTypeId: true,
      },
    });

    // Get inventory locks
    const inventoryLocks = await db.inventoryLock.findMany({
      where: {
        propertyId: booking.propertyId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
        AND: [
          { startDate: { lt: checkOutDate } },
          { endDate: { gt: checkInDate } },
        ],
      },
      select: {
        roomId: true,
        roomTypeId: true,
      },
    });

    // Parse current room type amenities for comparison
    let currentAmenities: string[] = [];
    try {
      currentAmenities = JSON.parse(booking.roomType.amenities || '[]');
    } catch {
      currentAmenities = [];
    }

    // Calculate availability and upgrade details for each room type
    const nights = Math.max(
      1,
      Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    const suggestions = higherPricedRoomTypes
      .map((roomType) => {
        // Calculate available rooms
        const bookedRoomIds = new Set(
          existingBookings
            .filter((b) => b.roomTypeId === roomType.id && b.roomId)
            .map((b) => b.roomId)
        );

        // If the current booking has a room in this room type, it's not available
        if (booking.roomId) {
          // Exclude current room from booked if it's already assigned
          bookedRoomIds.delete(booking.roomId);
        }

        const lockedRoomIds = new Set(
          inventoryLocks
            .filter((l) => l.roomTypeId === roomType.id && l.roomId)
            .map((l) => l.roomId)
        );

        const availableRooms = roomType.rooms.filter(
          (room) => !bookedRoomIds.has(room.id) && !lockedRoomIds.has(room.id)
        );

        if (availableRooms.length === 0) {
          return null;
        }

        // Parse upgrade room type amenities
        let upgradeAmenities: string[] = [];
        try {
          upgradeAmenities = JSON.parse(roomType.amenities || '[]');
        } catch {
          upgradeAmenities = [];
        }

        // Calculate amenities gained
        const amenitiesGained = upgradeAmenities.filter(
          (a) => !currentAmenities.includes(a)
        );

        const currentTotalPrice = booking.roomType.basePrice * nights;
        const upgradeTotalPrice = roomType.basePrice * nights;
        const priceDifference = upgradeTotalPrice - currentTotalPrice;
        const upgradePercentage = ((priceDifference / currentTotalPrice) * 100);

        // Value score: lower price increase per amenity gained = better value
        // If no new amenities, use a high value score (less value)
        const valueScore = amenitiesGained.length > 0
          ? priceDifference / amenitiesGained.length
          : priceDifference * 2;

        // Parse images
        let images: string[] = [];
        try {
          images = JSON.parse(roomType.images || '[]');
        } catch {
          images = [];
        }

        return {
          roomTypeId: roomType.id,
          roomTypeName: roomType.name,
          roomTypeCode: roomType.code,
          roomTypeDescription: roomType.description,
          sizeSqMeters: roomType.sizeSqMeters,
          currentPricePerNight: booking.roomType.basePrice,
          upgradePricePerNight: roomType.basePrice,
          currentTotalPrice,
          upgradeTotalPrice,
          priceDifference,
          upgradePercentage: Math.round(upgradePercentage * 100) / 100,
          nights,
          availableRooms: availableRooms.length,
          totalRooms: roomType.rooms.length,
          amenitiesGained,
          allAmenities: upgradeAmenities,
          images,
          valueScore,
          currency: booking.currency,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a!.valueScore - b!.valueScore)); // Best value first

    return NextResponse.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Error fetching upgrade suggestions:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch upgrade suggestions' } },
      { status: 500 }
    );
  }
}
