/**
 * Smart Room Assignment Engine for StaySuite HospitalityOS
 * AI-powered room suggestion system that considers multiple factors
 */

import { db } from '@/lib/db';

interface RoomSuggestion {
  roomId: string;
  roomNumber: string;
  floor: number;
  roomTypeName: string;
  confidence: number; // 0-1
  reasons: string[];
  features: {
    isAccessible: boolean;
    hasBalcony: boolean;
    hasSeaView: boolean;
    hasMountainView: boolean;
    isSmoking: boolean;
    housekeepingStatus: string;
  };
}

interface GuestPreferences {
  roomType?: string;
  floor?: number;
  view?: string;
  bedType?: string;
  smoking?: string;
  accessibility?: string;
}

/**
 * Suggest the best room for a booking
 * Returns top 3 room suggestions with confidence scores and matching reasons
 */
export async function suggestRoomAssignment(bookingId: string): Promise<{
  suggestions: RoomSuggestion[];
  bookingId: string;
}> {
  // Fetch booking with guest and room type details
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      primaryGuest: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          isVip: true,
          vipLevel: true,
          loyaltyTier: true,
          preferences: true,
          specialRequests: true,
        },
      },
      roomType: {
        select: { id: true, name: true, code: true },
      },
    },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  if (!booking.propertyId) {
    throw new Error('Booking has no property assigned');
  }

  // Parse guest preferences
  let guestPreferences: GuestPreferences = {};
  try {
    const prefs = typeof booking.primaryGuest.preferences === 'string'
      ? JSON.parse(booking.primaryGuest.preferences)
      : booking.primaryGuest.preferences || {};
    guestPreferences = prefs as GuestPreferences;
  } catch { /* ignore */ }

  // Get available rooms of the matching room type
  const availableRooms = await db.room.findMany({
    where: {
      propertyId: booking.propertyId,
      roomTypeId: booking.roomTypeId,
      status: { in: ['available', 'clean'], notIn: ['out_of_order', 'outOfOrder'] },
      housekeepingStatus: { in: ['clean', 'inspected'] },
      deletedAt: null,
    },
    include: {
      roomType: {
        select: { id: true, name: true, code: true },
      },
    },
    orderBy: [{ floor: 'asc' }, { number: 'asc' }],
  });

  if (availableRooms.length === 0) {
    return { suggestions: [], bookingId };
  }

  // Get guest behavior for repeat guest analysis
  let guestBehavior: {
    preferredRoomTypes: string | null;
    isRepeatGuest: boolean;
    learnedPreferences: string | null;
  } | null = null;
  try {
    guestBehavior = await db.guestBehavior.findUnique({
      where: { guestId: booking.primaryGuest.id },
      select: {
        preferredRoomTypes: true,
        isRepeatGuest: true,
        learnedPreferences: true,
      },
    });
  } catch { /* no behavior record */ }

  // Get previous room assignments for repeat guests
  let previousRooms: Array<{
    roomId: string;
    roomNumber: string;
    floor: number;
    hasSeaView: boolean;
    hasMountainView: boolean;
    hasBalcony: boolean;
    isAccessible: boolean;
    roomTypeId: string;
  }> = [];

  if (guestBehavior?.isRepeatGuest) {
    const previousBookings = await db.booking.findMany({
      where: {
        primaryGuestId: booking.primaryGuest.id,
        status: { in: ['checked_in', 'checked_out', 'completed'] },
        roomId: { not: null },
        id: { not: bookingId },
      },
      include: {
        room: {
          select: {
            id: true,
            number: true,
            floor: true,
            hasSeaView: true,
            hasMountainView: true,
            hasBalcony: true,
            isAccessible: true,
            roomTypeId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    previousRooms = previousBookings
      .filter(b => b.room)
      .map(b => b.room!);
  }

  // Check for accessibility needs
  const hasAccessibilityNeed =
    booking.specialRequests?.toLowerCase().includes('accessib') ||
    booking.specialRequests?.toLowerCase().includes('wheelchair') ||
    booking.specialRequests?.toLowerCase().includes('mobility') ||
    booking.specialRequests?.toLowerCase().includes('disability') ||
    guestPreferences.accessibility === 'required';

  // Score each room
  const now = new Date();
  const scoredRooms: Array<{
    room: typeof availableRooms[0];
    score: number;
    reasons: string[];
  }> = availableRooms.map(room => {
    let score = 0;
    const reasons: string[] = [];
    const maxPossibleScore = 100;

    // === 1. Room type match (base requirement) ===
    score += 25;
    reasons.push('Room type matches booking');

    // === 2. Accessibility needs ===
    if (hasAccessibilityNeed) {
      if (room.isAccessible) {
        score += 20;
        reasons.push('Accessible room (mobility needs detected)');
        if (room.floor === 1) {
          score += 8;
          reasons.push('Ground floor (accessibility preferred)');
        }
      } else {
        score -= 30;
        reasons.push('Not accessible (accessibility required)');
      }
    }

    // === 3. Housekeeping status ===
    if (room.housekeepingStatus === 'inspected') {
      score += 10;
      reasons.push('Room inspected and verified');
    } else if (room.housekeepingStatus === 'clean') {
      score += 6;
      reasons.push('Room cleaned and ready');
    }

    // === 4. Recency of cleaning ===
    if (room.lastCleanedAt) {
      const hoursSince = (now.getTime() - new Date(room.lastCleanedAt).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 4) {
        score += 6;
        reasons.push('Recently cleaned (< 4h ago)');
      } else if (hoursSince < 12) {
        score += 4;
        reasons.push('Cleaned within 12 hours');
      }
    }

    // === 5. View preferences ===
    if (guestPreferences.view === 'sea' && room.hasSeaView) {
      score += 10;
      reasons.push('Sea view (guest preference)');
    } else if (guestPreferences.view === 'mountain' && room.hasMountainView) {
      score += 10;
      reasons.push('Mountain view (guest preference)');
    }

    // === 6. Smoking preference ===
    if (guestPreferences.smoking === 'yes' && room.isSmoking) {
      score += 8;
      reasons.push('Smoking room (guest preference)');
    } else if (guestPreferences.smoking === 'no' && !room.isSmoking) {
      score += 4;
      reasons.push('Non-smoking room (guest preference)');
    }

    // === 7. Floor preference ===
    if (guestPreferences.floor && room.floor === guestPreferences.floor) {
      score += 8;
      reasons.push(`Floor ${room.floor} (guest preference)`);
    }

    // === 8. VIP status ===
    if (booking.primaryGuest.isVip) {
      if (room.hasSeaView) { score += 5; if (!reasons.includes('Sea view (guest preference)')) reasons.push('Sea view (VIP upgrade)'); }
      if (room.hasMountainView) { score += 4; }
      if (room.hasBalcony) { score += 4; }
      if (room.floor >= 3) { score += 3; if (!reasons.includes(`Floor ${room.floor} (guest preference)`)) reasons.push('Premium floor (VIP)'); }
      if (booking.primaryGuest.vipLevel === 'platinum' || booking.primaryGuest.vipLevel === 'diamond') {
        score += 3;
        if (!reasons.includes('Room inspected and verified') && room.housekeepingStatus === 'inspected') {
          reasons.push('Inspected room guaranteed for VIP');
        }
      }
    }

    // === 9. Loyalty tier ===
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    const tierIndex = tierOrder.indexOf(booking.primaryGuest.loyaltyTier);
    if (tierIndex >= 2) { // gold+
      if (room.hasSeaView) score += 3;
      if (room.hasBalcony) score += 2;
      if (room.floor >= 2) score += 2;
    }

    // === 10. Repeat guest: same floor/type ===
    if (previousRooms.length > 0) {
      const sameFloorRooms = previousRooms.filter(r => r.floor === room.floor);
      const sameTypeRooms = previousRooms.filter(r => r.roomTypeId === room.roomTypeId);

      if (sameFloorRooms.length > 0) {
        score += 6;
        reasons.push(`Floor ${room.floor} (same as previous stays)`);
      }
      if (sameTypeRooms.length > 0) {
        score += 3;
        reasons.push('Same room type as previous stays');
      }

      // Check same room number
      const sameRoom = previousRooms.find(r => r.roomId === room.id);
      if (sameRoom) {
        score += 8;
        reasons.push(`Room ${room.number} (same as last stay)`);
      }
    }

    // === 11. Family considerations ===
    if (booking.adults + booking.children > 2 || booking.children > 0) {
      if (room.floor <= 2) {
        score += 3;
        reasons.push('Lower floor (family-friendly)');
      }
    }

    // === 12. Balcony preference ===
    if (guestPreferences.balcony === 'yes' && room.hasBalcony) {
      score += 5;
      reasons.push('Balcony (guest preference)');
    }

    return { room, score, reasons };
  });

  // Sort by score descending and calculate confidence
  scoredRooms.sort((a, b) => b.score - a.score);

  const maxScore = scoredRooms.length > 0 ? scoredRooms[0].score : 1;

  const suggestions: RoomSuggestion[] = scoredRooms.slice(0, 3).map(sr => ({
    roomId: sr.room.id,
    roomNumber: sr.room.number,
    floor: sr.room.floor,
    roomTypeName: sr.room.roomType.name,
    confidence: maxScore > 0 ? Math.round((sr.score / 100) * 100) / 100 : 0,
    reasons: sr.reasons,
    features: {
      isAccessible: sr.room.isAccessible,
      hasBalcony: sr.room.hasBalcony,
      hasSeaView: sr.room.hasSeaView,
      hasMountainView: sr.room.hasMountainView,
      isSmoking: sr.room.isSmoking,
      housekeepingStatus: sr.room.housekeepingStatus,
    },
  }));

  return { suggestions, bookingId };
}
