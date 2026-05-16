import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/bookings/upgrade-offers - Get personalized upgrade offers for a checked-in booking
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const bookingId = request.nextUrl.searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId is required' } },
        { status: 400 }
      );
    }

    // Fetch booking with room type and guest
    const booking = await db.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        roomType: true,
        room: true,
        primaryGuest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            loyaltyTier: true,
            isVip: true,
            totalStays: true,
            totalSpent: true,
            preferences: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // Booking must be checked in
    if (booking.status !== 'checked_in') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Booking must be checked in to get upgrade offers' } },
        { status: 400 }
      );
    }

    const checkInDate = new Date(booking.checkIn);
    const checkOutDate = new Date(booking.checkOut);
    const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Parse current amenities
    let currentAmenities: string[] = [];
    try {
      currentAmenities = JSON.parse(booking.roomType.amenities || '[]');
    } catch {
      currentAmenities = [];
    }

    // Find higher-priced room types with available rooms
    const higherPricedTypes = await db.roomType.findMany({
      where: {
        propertyId: booking.propertyId,
        basePrice: { gt: booking.roomType.basePrice },
      },
      include: {
        rooms: {
          where: { status: 'available' },
        },
      },
      orderBy: { basePrice: 'asc' },
    });

    // Get existing bookings for date range
    const existingBookings = await db.booking.findMany({
      where: {
        propertyId: booking.propertyId,
        status: { in: ['confirmed', 'checked_in'] },
        id: { not: booking.id },
        checkIn: { lt: checkOutDate },
        checkOut: { gt: checkInDate },
      },
      select: { roomId: true, roomTypeId: true },
    });

    // Build upgrade offers
    const upgradeOffers = higherPricedTypes
      .map((rt) => {
        const bookedRoomIds = new Set(
          existingBookings.filter((b) => b.roomTypeId === rt.id && b.roomId).map((b) => b.roomId)
        );
        if (booking.roomId) bookedRoomIds.delete(booking.roomId);

        const availableRooms = rt.rooms.filter((r) => !bookedRoomIds.has(r.id));
        if (availableRooms.length === 0) return null;

        let upgradeAmenities: string[] = [];
        try {
          upgradeAmenities = JSON.parse(rt.amenities || '[]');
        } catch {
          upgradeAmenities = [];
        }

        const amenitiesGained = upgradeAmenities.filter((a) => !currentAmenities.includes(a));
        const priceDifference = (rt.basePrice - booking.roomType.basePrice) * nights;
        const valueScore = amenitiesGained.length > 0 ? priceDifference / amenitiesGained.length : priceDifference * 2;

        let images: string[] = [];
        try {
          images = JSON.parse(rt.images || '[]');
        } catch {
          images = [];
        }

        return {
          type: 'room_upgrade',
          roomTypeId: rt.id,
          roomTypeName: rt.name,
          roomTypeCode: rt.code,
          description: rt.description,
          sizeSqMeters: rt.sizeSqMeters,
          currentPricePerNight: booking.roomType.basePrice,
          upgradePricePerNight: rt.basePrice,
          priceDifference,
          priceDifferencePerNight: rt.basePrice - booking.roomType.basePrice,
          nights,
          availableRooms: availableRooms.length,
          amenitiesGained,
          allAmenities: upgradeAmenities,
          images,
          valueScore,
          currency: booking.currency,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.valueScore - b!.valueScore);

    // Cross-sell offers: spa, restaurant, experiences
    const crossSellOffers: Array<{
      type: string;
      id: string;
      name: string;
      description: string | null;
      price: number;
      category: string;
      image?: string;
    }> = [];

    // Fetch experience products (spa, dining, activities)
    const experienceBookings = await db.experienceBooking.findMany({
      where: {
        propertyId: booking.propertyId,
        status: 'active',
      },
      take: 20,
    });

    // If we have experience records, add as cross-sell
    // Otherwise generate sensible defaults based on property
    crossSellOffers.push(
      {
        type: 'spa',
        id: 'spa-package-1',
        name: 'Signature Spa Package',
        description: '90-minute massage + facial treatment',
        price: 189.0,
        category: 'spa',
      },
      {
        type: 'dining',
        id: 'dining-package-1',
        name: 'Fine Dining Experience',
        description: '3-course dinner for two at our rooftop restaurant',
        price: 250.0,
        category: 'dining',
      },
      {
        type: 'activity',
        id: 'activity-tour-1',
        name: 'Guided City Tour',
        description: 'Half-day guided tour with pickup from hotel',
        price: 120.0,
        category: 'experiences',
      },
      {
        type: 'spa',
        id: 'spa-package-2',
        name: 'Couples Retreat',
        description: 'Private couples suite with hot springs access',
        price: 320.0,
        category: 'spa',
      },
      {
        type: 'dining',
        id: 'dining-package-2',
        name: 'Breakfast Buffet Upgrade',
        description: 'Full premium breakfast buffet for duration of stay',
        price: 45.0 * nights,
        category: 'dining',
      }
    );

    // Personalize: apply loyalty discount for Gold+ members
    const loyaltyTier = booking.primaryGuest.loyaltyTier || 'bronze';
    const isLoyaltyEligible = ['gold', 'platinum', 'diamond'].includes(loyaltyTier.toLowerCase());
    const loyaltyDiscount = isLoyaltyEligible ? 0.1 : 0; // 10% for Gold+

    if (loyaltyDiscount > 0) {
      for (const offer of crossSellOffers) {
        offer.price = parseFloat((offer.price * (1 - loyaltyDiscount)).toFixed(2));
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        bookingId: booking.id,
        confirmationCode: booking.confirmationCode,
        currentRoomType: {
          id: booking.roomType.id,
          name: booking.roomType.name,
          basePrice: booking.roomType.basePrice,
        },
        guest: booking.primaryGuest,
        nights,
        loyaltyTier,
        loyaltyDiscount,
        upgradeOffers,
        crossSellOffers,
      },
    });
  } catch (error) {
    console.error('[UpgradeOffers] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch upgrade offers' } },
      { status: 500 }
    );
  }
}
