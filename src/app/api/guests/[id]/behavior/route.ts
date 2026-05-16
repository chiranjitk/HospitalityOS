import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// ─── Helpers ────────────────────────────────────────────────────────────

function formatCurrencyValue(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// GET /api/guests/[id]/behavior - Get guest behavior analytics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // Get guest with behavior data — scoped to current tenant
    const guest = await db.guest.findFirst({
      where: { id, tenantId: auth.tenantId, deletedAt: null },
      include: {
        behavior: true,
        bookings: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            totalAmount: true,
            source: true,
            checkIn: true,
            checkOut: true,
            roomType: {
              select: { name: true },
            },
          },
        },
        stays: {
          select: {
            totalAmount: true,
            roomNights: true,
          },
        },
      },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }

    // If behavior record doesn't exist, calculate and create it
    let behavior = guest.behavior;

    if (!behavior) {
      // Calculate behavior from existing data
      const bookings = guest.bookings;
      const stays = guest.stays;

      const totalBookings = bookings.length;
      const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
      const noShowCount = bookings.filter(b => b.status === 'no_show').length;
      const totalSpent = stays.reduce((sum, s) => sum + s.totalAmount, 0);
      const avgBookingValue = totalBookings > 0 ? totalSpent / totalBookings : 0;
      const totalNights = stays.reduce((sum, s) => sum + s.roomNights, 0);
      const avgStayLength = stays.length > 0 ? totalNights / stays.length : 0;

      // Calculate booking sources
      const bookingSources: Record<string, number> = {};
      bookings.forEach(b => {
        bookingSources[b.source] = (bookingSources[b.source] || 0) + 1;
      });

      // Calculate preferred room types
      const roomTypeCounts: Record<string, number> = {};
      bookings.forEach(b => {
        if (b.roomType) {
          roomTypeCounts[b.roomType.name] = (roomTypeCounts[b.roomType.name] || 0) + 1;
        }
      });

      // Calculate VIP score (composite score)
      const spendScore = Math.min(totalSpent / 10000 * 30, 30); // Max 30 points
      const frequencyScore = Math.min(totalBookings * 5, 25); // Max 25 points
      const loyaltyScore = guest.loyaltyTier === 'platinum' ? 25 : guest.loyaltyTier === 'gold' ? 20 : guest.loyaltyTier === 'silver' ? 15 : 10;
      const vipScore = spendScore + frequencyScore + loyaltyScore;

      // Calculate engagement score
      const engagementScore = Math.min(
        (guest.emailOptIn ? 20 : 0) + 
        (guest.smsOptIn ? 15 : 0) + 
        Math.min(totalBookings * 10, 40) +
        (guest.isVip ? 25 : 0),
        100
      );

      // Create behavior record
      behavior = await db.guestBehavior.create({
        data: {
          tenantId: guest.tenantId,
          guestId: id,
          visitCount: 1,
          firstVisitAt: guest.createdAt,
          lastVisitAt: new Date(),
          totalBookings,
          cancelledBookings,
          noShowCount,
          totalSpent,
          avgBookingValue,
          lifetimeValue: totalSpent * 1.5, // Simple LTV calculation
          totalNights,
          avgStayLength,
          preferredRoomTypes: JSON.stringify(Object.keys(roomTypeCounts)),
          bookingSources: JSON.stringify(bookingSources),
          engagementScore,
          vipScore,
          isRepeatGuest: totalBookings > 1,
          repeatGuestSince: totalBookings > 1 ? guest.createdAt : null,
        },
      });
    }

    // Calculate additional analytics
    const bookingStats = {
      total: behavior.totalBookings,
      cancelled: behavior.cancelledBookings,
      noShow: behavior.noShowCount,
      conversionRate: behavior.totalBookings > 0 
        ? ((behavior.totalBookings - behavior.cancelledBookings - behavior.noShowCount) / behavior.totalBookings * 100).toFixed(1)
        : 0,
    };

    const spendingStats = {
      total: behavior.totalSpent,
      avgBooking: behavior.avgBookingValue,
      lifetimeValue: behavior.lifetimeValue,
    };

    const stayStats = {
      totalNights: behavior.totalNights,
      avgLength: behavior.avgStayLength,
      preferredRoomTypes: JSON.parse(behavior.preferredRoomTypes || '[]'),
    };

    const channelStats = JSON.parse(behavior.bookingSources || '{}');

    const engagementStats = {
      score: behavior.engagementScore,
      emailOpens: behavior.emailOpens,
      emailClicks: behavior.emailClicks,
      smsResponses: behavior.smsResponses,
    };

    const vipStats = {
      score: behavior.vipScore,
      isVip: behavior.vipScore >= 50,
      isRepeatGuest: behavior.isRepeatGuest,
      loyaltyTier: guest.loyaltyTier,
    };

    // Determine loyalty tier recommendation based on LoyaltyTier rules
    let loyaltyRecommendation: { currentTier: string; recommendedTier: string; reason: string } | null = null;

    // Query loyalty tier rules from the database
    const loyaltyTiers = await db.loyaltyTier.findMany({
      where: {
        tenantId: auth.tenantId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (loyaltyTiers.length > 0 && behavior.vipScore > 0) {
      // Find the guest's current tier
      const currentTier = loyaltyTiers.find(t =>
        guest.loyaltyTier === t.name
      );
      const currentTierIndex = currentTier ? loyaltyTiers.indexOf(currentTier) : -1;

      // Find the next tier the guest qualifies for based on VIP score thresholds
      // Tier thresholds are derived from minPoints: VIP score 30+ → tier[0], 50+ → tier[1], 70+ → tier[2], etc.
      const nextTierIndex = Math.min(
        Math.floor(behavior.vipScore / 20) - 1,
        loyaltyTiers.length - 1
      );

      if (nextTierIndex > currentTierIndex && nextTierIndex < loyaltyTiers.length) {
        const nextTier = loyaltyTiers[nextTierIndex];
        const nextTierBenefits = JSON.parse(nextTier.benefits || '[]');

        // Build dynamic reason from guest's actual data
        const reasonParts: string[] = [];
        if (behavior.totalSpent > 0) {
          reasonParts.push(`Total spend of ${formatCurrencyValue(behavior.totalSpent)}`);
        }
        if (behavior.totalNights > 0) {
          reasonParts.push(`${behavior.totalNights} nights stayed`);
        }
        if (behavior.totalBookings > 0) {
          reasonParts.push(`${behavior.totalBookings} bookings`);
        }
        if (nextTierBenefits.length > 0) {
          reasonParts.push(`qualifies for benefits: ${nextTierBenefits.slice(0, 3).join(', ')}`);
        }

        loyaltyRecommendation = {
          currentTier: guest.loyaltyTier || 'bronze',
          recommendedTier: nextTier.name,
          reason: reasonParts.length > 0
            ? `${reasonParts.join(', ')} qualifies for ${nextTier.displayName}`
            : `VIP score of ${behavior.vipScore.toFixed(1)} qualifies for ${nextTier.displayName}`,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        guest: {
          id: guest.id,
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email,
          loyaltyTier: guest.loyaltyTier,
          isVip: guest.isVip,
        },
        behavior,
        analytics: {
          booking: bookingStats,
          spending: spendingStats,
          stay: stayStats,
          channels: channelStats,
          engagement: engagementStats,
          vip: vipStats,
        },
        loyaltyRecommendation,
      },
    });
  } catch (error) {
    console.error('Error fetching guest behavior:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch guest behavior' } },
      { status: 500 }
    );
  }
}
