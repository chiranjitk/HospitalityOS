import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

interface ScoredRoom {
  id: string;
  number: string;
  floor: number;
  status: string;
  housekeepingStatus: string;
  lastCleanedAt: string | null;
  isAccessible: boolean;
  isSmoking: boolean;
  hasBalcony: boolean;
  hasSeaView: boolean;
  hasMountainView: boolean;
  roomType: { id: string; name: string; code: string };
  score: number;
  reasons: string[];
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'bookings.update') && !hasPermission(user, 'bookings.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { bookingId, propertyId, auto } = body;

    if (!bookingId || !propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId and propertyId are required' } },
        { status: 400 }
      );
    }

    // 1. Fetch the booking with guest and room type
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        primaryGuest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isVip: true,
            loyaltyTier: true,
            preferences: true,
            specialRequests: true,
          },
        },
        roomType: {
          select: { id: true, name: true, code: true },
        },
        room: {
          select: { id: true, number: true },
        },
        property: {
          select: { id: true, name: true, tenantId: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    if (booking.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Booking does not belong to your tenant' } },
        { status: 403 }
      );
    }

    if (booking.room) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_ASSIGNED', message: 'Booking already has a room assigned', data: { room: booking.room } } },
        { status: 400 }
      );
    }

    // 2. Get all available rooms of the matching room type
    const now = new Date();
    const availableRooms = await db.room.findMany({
      where: {
        propertyId,
        roomTypeId: booking.roomTypeId,
        status: { in: ['available', 'clean'] },
        housekeepingStatus: { in: ['clean', 'inspected'] },
        deletedAt: null,
        // Exclude rooms with active maintenance blocks
        maintenanceBlocks: {
          none: {
            status: { in: ['scheduled', 'active'] },
            startDate: { lte: booking.checkOut },
            endDate: { gte: booking.checkIn },
          },
        },
      },
      include: {
        roomType: {
          select: { id: true, name: true, code: true },
        },
        keyCards: {
          select: { id: true, status: true },
          where: { status: { in: ['issued', 'active'] } },
        },
      },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });

    if (availableRooms.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_ROOMS_AVAILABLE', message: 'No available rooms found for this room type' } },
        { status: 404 }
      );
    }

    // 3. Fetch guest preferences and behavior
    let guestPreferences: Record<string, unknown> = {};
    let guestBehavior: { preferredRoomTypes: string; isRepeatGuest: boolean; learnedPreferences: string } | null = null;
    let previousRoomFeatures: string[] = [];

    try {
      guestPreferences = typeof booking.primaryGuest.preferences === 'string'
        ? JSON.parse(booking.primaryGuest.preferences)
        : booking.primaryGuest.preferences || {};
    } catch { /* ignore parse errors */ }

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

    // Check previous stays for room features preference
    if (guestBehavior?.isRepeatGuest) {
      const previousStays = await db.booking.findMany({
        where: {
          primaryGuestId: booking.primaryGuest.id,
          status: { in: ['checked_in', 'checked_out', 'completed'] },
          roomId: { not: null },
          id: { not: booking.id },
        },
        include: {
          room: {
            select: {
              hasSeaView: true,
              hasMountainView: true,
              hasBalcony: true,
              isAccessible: true,
              isSmoking: true,
              floor: true,
              number: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      // Extract preferred features from past rooms
      for (const stay of previousStays) {
        if (stay.room) {
          if (stay.room.hasSeaView) previousRoomFeatures.push('seaView');
          if (stay.room.hasMountainView) previousRoomFeatures.push('mountainView');
          if (stay.room.hasBalcony) previousRoomFeatures.push('balcony');
          if (stay.room.isAccessible) previousRoomFeatures.push('accessible');
        }
      }
    }

    // Check for special requests related to accessibility
    const hasAccessibilityNeed =
      booking.specialRequests?.toLowerCase().includes('accessib') ||
      booking.specialRequests?.toLowerCase().includes('wheelchair') ||
      booking.specialRequests?.toLowerCase().includes('mobility') ||
      booking.specialRequests?.toLowerCase().includes('disability') ||
      (guestPreferences as Record<string, string>)?.accessibility === 'required';

    // Parse learned preferences if available
    let learnedPrefs: Record<string, unknown> = {};
    if (guestBehavior?.learnedPreferences) {
      try {
        learnedPrefs = typeof guestBehavior.learnedPreferences === 'string'
          ? JSON.parse(guestBehavior.learnedPreferences)
          : guestBehavior.learnedPreferences || {};
      } catch { /* ignore */ }
    }

    // 4. Fetch maintenance warnings for rooms
    const roomsWithMaintenanceWarnings = new Set<string>();
    const activeMaintenance = await db.maintenanceBlock.findMany({
      where: {
        roomId: { in: availableRooms.map(r => r.id) },
        status: { in: ['scheduled', 'active'] },
        propertyId,
      },
      select: { roomId: true, reason: true, priority: true },
    });

    const maintenanceMap = new Map(activeMaintenance.map(m => [m.roomId, m]));
    for (const m of activeMaintenance) {
      roomsWithMaintenanceWarnings.add(m.roomId);
    }

    // 5. Score each room
    const scoredRooms: ScoredRoom[] = availableRooms.map(room => {
      let score = 0;
      const reasons: string[] = [];

      // Base score: room type match
      score += 30;
      reasons.push('Room type match');

      // --- Floor proximity to elevator/stairs (lower floors for accessibility) ---
      if (hasAccessibilityNeed && room.isAccessible) {
        score += 35;
        reasons.push('Accessible room (mobility needs)');
        // Prefer ground/lower floors for accessibility
        if (room.floor === 1) {
          score += 15;
          reasons.push('Ground floor (accessibility)');
        } else if (room.floor <= 2) {
          score += 10;
          reasons.push('Lower floor (accessibility)');
        }
      } else if (!hasAccessibilityNeed) {
        // For non-accessibility guests, slight preference for middle floors
        if (room.floor >= 2 && room.floor <= 4) {
          score += 5;
          reasons.push('Mid-floor location');
        }
      }

      // --- Room features matching guest preferences ---
      const roomAmenities = {
        seaView: room.hasSeaView,
        mountainView: room.hasMountainView,
        balcony: room.hasBalcony,
        accessible: room.isAccessible,
        smoking: room.isSmoking,
      };

      // Check explicit preferences
      const prefs = guestPreferences as Record<string, string>;
      if (prefs?.view === 'sea' && room.hasSeaView) {
        score += 20;
        reasons.push('Sea view preference match');
      }
      if (prefs?.view === 'mountain' && room.hasMountainView) {
        score += 20;
        reasons.push('Mountain view preference match');
      }
      if (prefs?.balcony === 'yes' && room.hasBalcony) {
        score += 12;
        reasons.push('Balcony preference match');
      }
      if (prefs?.smoking === 'yes' && room.isSmoking) {
        score += 10;
        reasons.push('Smoking room preference match');
      }
      if (prefs?.smoking === 'no' && !room.isSmoking) {
        score += 5;
        reasons.push('Non-smoking preference match');
      }

      // --- Recently cleaned (most recent housekeeping completion) ---
      if (room.lastCleanedAt) {
        const hoursSinceCleaned = (now.getTime() - new Date(room.lastCleanedAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceCleaned < 4) {
          score += 15;
          reasons.push('Recently cleaned (< 4h)');
        } else if (hoursSinceCleaned < 12) {
          score += 10;
          reasons.push('Recently cleaned (< 12h)');
        } else if (hoursSinceCleaned < 24) {
          score += 5;
          reasons.push('Cleaned within 24h');
        }
      }

      // Inspected rooms get a bonus
      if (room.housekeepingStatus === 'inspected') {
        score += 8;
        reasons.push('Room inspected');
      }

      // --- Repeat guest: same features as previous stay ---
      if (previousRoomFeatures.length > 0) {
        const featureMap: Record<string, boolean> = {
          seaView: room.hasSeaView,
          mountainView: room.hasMountainView,
          balcony: room.hasBalcony,
          accessible: room.isAccessible,
        };

        for (const feature of previousRoomFeatures) {
          if (featureMap[feature]) {
            score += 12;
            reasons.push(`Same ${feature} as previous stay`);
            break; // Only count once
          }
        }

        // Check if same room number was used before (previousStays already fetched above)
      }

      // --- Avoid rooms with maintenance warnings ---
      if (roomsWithMaintenanceWarnings.has(room.id)) {
        score -= 30;
        const maint = maintenanceMap.get(room.id);
        reasons.push(`Maintenance warning: ${maint?.reason || 'scheduled maintenance'}`);
      }

      // --- VIP guest bonuses ---
      if (booking.primaryGuest.isVip) {
        if (room.hasSeaView) { score += 10; if (!reasons.includes('Sea view preference match')) reasons.push('Sea view (VIP)'); }
        if (room.hasMountainView) { score += 8; if (!reasons.includes('Mountain view preference match')) reasons.push('Mountain view (VIP)'); }
        if (room.hasBalcony) { score += 8; if (!reasons.includes('Balcony preference match')) reasons.push('Balcony (VIP)'); }
        if (room.floor >= 3) { score += 5; if (!reasons.includes('Mid-floor location')) reasons.push('Premium floor (VIP)'); }
      }

      // --- Loyalty tier bonuses ---
      if (booking.primaryGuest.loyaltyTier === 'platinum') {
        if (room.hasSeaView) score += 6;
        if (room.floor >= 2) score += 4;
      } else if (booking.primaryGuest.loyaltyTier === 'gold') {
        if (room.hasSeaView) score += 4;
      }

      // --- Children: prefer lower floors ---
      if (booking.adults + booking.children > 2 || booking.children > 0) {
        if (room.floor <= 2) {
          score += 5;
          reasons.push('Lower floor (family-friendly)');
        }
      }

      // --- Learned preferences from behavior tracking ---
      if (learnedPrefs?.preferredFloor && room.floor === Number(learnedPrefs.preferredFloor)) {
        score += 8;
        reasons.push('Preferred floor from history');
      }

      // Non-smoking default bonus
      if (!room.isSmoking && prefs?.smoking !== 'yes') {
        score += 3;
        if (!reasons.includes('Non-smoking preference match')) {
          reasons.push('Non-smoking');
        }
      }

      return {
        id: room.id,
        number: room.number,
        floor: room.floor,
        status: room.status,
        housekeepingStatus: room.housekeepingStatus,
        lastCleanedAt: room.lastCleanedAt?.toISOString() || null,
        isAccessible: room.isAccessible,
        isSmoking: room.isSmoking,
        hasBalcony: room.hasBalcony,
        hasSeaView: room.hasSeaView,
        hasMountainView: room.hasMountainView,
        roomType: room.roomType,
        score,
        reasons,
      };
    });

    // Sort by score descending
    scoredRooms.sort((a, b) => b.score - a.score);

    // Return top 3
    const topRooms = scoredRooms.slice(0, 3);

    // 5. Auto-assign if requested (within a serializable transaction to prevent double-booking)
    let assignedRoom = null;
    if (auto === true && topRooms.length > 0) {
      // Try each suggested room in score order until one is successfully assigned
      for (const candidateRoom of topRooms) {
        try {
          assignedRoom = await db.$transaction(async (tx) => {
            // Lock the room row for update (prevents concurrent assignments to the same room)
            const lockedRoom = await tx.room.findFirst({
              where: { id: candidateRoom.id },
            });

            if (!lockedRoom) {
              throw new Error('ROOM_NOT_FOUND');
            }

            // Re-check room status within the transaction (may have changed since initial query)
            if (lockedRoom.status !== 'available' && lockedRoom.status !== 'clean') {
              throw new Error('ROOM_NO_LONGER_AVAILABLE');
            }

            // Check for overlapping bookings on this room for the requested date range
            const overlappingBooking = await tx.booking.findFirst({
              where: {
                roomId: candidateRoom.id,
                id: { not: bookingId },
                status: { notIn: ['cancelled', 'no_show', 'declined'] },
                // Overlap: existing booking starts before our checkout AND ends after our checkin
                checkIn: { lt: booking.checkOut },
                checkOut: { gt: booking.checkIn },
              },
            });

            if (overlappingBooking) {
              throw new Error('ROOM_DATE_CONFLICT');
            }

            // Re-check the booking hasn't been assigned by another request
            const freshBooking = await tx.booking.findUnique({
              where: { id: bookingId },
              select: { roomId: true },
            });

            if (!freshBooking) {
              throw new Error('BOOKING_NOT_FOUND');
            }

            if (freshBooking.roomId) {
              throw new Error('ALREADY_ASSIGNED');
            }

            // Assign room to booking
            const updatedBooking = await tx.booking.update({
              where: { id: bookingId },
              data: { roomId: candidateRoom.id },
              select: { id: true, roomId: true, room: { select: { id: true, number: true, floor: true } } },
            });

            // Update room status
            await tx.room.update({
              where: { id: candidateRoom.id },
              data: { status: 'occupied' },
            });

            return updatedBooking;
          }, {
            isolationLevel: 'Serializable',
            timeout: 10000,
          });

          // Successfully assigned — stop trying other rooms
          break;
        } catch (txError) {
          const errMsg = txError instanceof Error ? txError.message : '';

          // If the room is no longer available or has a date conflict, try the next candidate
          if (
            errMsg === 'ROOM_NO_LONGER_AVAILABLE' ||
            errMsg === 'ROOM_DATE_CONFLICT' ||
            errMsg === 'ALREADY_ASSIGNED'
          ) {
            continue;
          }

          // If booking disappeared, abort
          if (errMsg === 'BOOKING_NOT_FOUND' || errMsg === 'ROOM_NOT_FOUND') {
            break;
          }

          // For serialization failures (Prisma P2034) or other transaction errors, abort
          console.error('Auto-assign transaction error:', txError);
          break;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        bookingId,
        suggestions: topRooms.map(r => ({
          id: r.id,
          number: r.number,
          floor: r.floor,
          score: r.score,
          reasons: r.reasons,
          roomType: r.roomType,
          features: {
            isAccessible: r.isAccessible,
            hasBalcony: r.hasBalcony,
            hasSeaView: r.hasSeaView,
            hasMountainView: r.hasMountainView,
            isSmoking: r.isSmoking,
          },
          housekeepingStatus: r.housekeepingStatus,
          lastCleanedAt: r.lastCleanedAt,
        })),
        autoAssigned: assignedRoom ? {
          roomId: assignedRoom.roomId,
          roomNumber: assignedRoom.room?.number,
          roomFloor: assignedRoom.room?.floor,
        } : null,
      },
    });
  } catch (error) {
    console.error('Error in auto-assign:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to compute room assignments' } },
      { status: 500 }
    );
  }
}

// Helper: get previous room numbers for a guest
async function getPreviousRoomNumbers(guestId: string, currentBookingId: string): Promise<string[]> {
  const previousBookings = await db.booking.findMany({
    where: {
      primaryGuestId: guestId,
      status: { in: ['checked_in', 'checked_out', 'completed'] },
      roomId: { not: null },
      id: { not: currentBookingId },
    },
    include: {
      room: { select: { number: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return previousBookings
    .map(b => b.room?.number)
    .filter((n): n is string => !!n);
}
