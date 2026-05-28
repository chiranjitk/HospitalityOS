import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { Prisma } from '@prisma/client';

// POST /api/guests/merge - Merge duplicate guest profiles
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'guests.update') && !hasPermission(user, 'guests.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { primaryGuestId, duplicateGuestIds } = body;

    if (!primaryGuestId || !Array.isArray(duplicateGuestIds) || duplicateGuestIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'primaryGuestId and duplicateGuestIds are required' } },
        { status: 400 }
      );
    }

    // Validate: primary cannot be in duplicates
    if (duplicateGuestIds.includes(primaryGuestId)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Primary guest cannot be in duplicate list' } },
        { status: 400 }
      );
    }

    // Fetch primary guest
    const primaryGuest = await db.guest.findUnique({
      where: { id: primaryGuestId },
      include: {
        behavior: { select: { id: true } },
      },
    });

    if (!primaryGuest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Primary guest not found' } },
        { status: 404 }
      );
    }

    if (primaryGuest.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Primary guest does not belong to your tenant' } },
        { status: 403 }
      );
    }

    if (primaryGuest.status === 'merged') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_GUEST', message: 'Primary guest is already merged into another profile' } },
        { status: 400 }
      );
    }

    // Fetch all duplicate guests
    const duplicateGuests = await db.guest.findMany({
      where: {
        id: { in: duplicateGuestIds },
        tenantId: user.tenantId,
      },
    });

    if (duplicateGuests.length !== duplicateGuestIds.length) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'One or more duplicate guests not found' } },
        { status: 404 }
      );
    }

    // Validate all duplicates belong to same tenant
    for (const dup of duplicateGuests) {
      if (dup.tenantId !== user.tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: `Guest ${dup.id} does not belong to your tenant` } },
          { status: 403 }
        );
      }
      if (dup.status === 'merged') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_GUEST', message: `Guest ${dup.id} is already merged` } },
          { status: 400 }
        );
      }
    }

    // Perform merge in a transaction
    const result = await db.$transaction(async (tx) => {
      const mergeSummary = {
        bookingsMoved: 0,
        foliosUpdated: 0,
        paymentsMoved: 0,
        documentsMoved: 0,
        reviewsMoved: 0,
        feedbackMoved: 0,
        loyaltyPointsCombined: 0,
        guestStaysMoved: 0,
        loyaltyRedemptionsMoved: 0,
        loyaltyTransactionsMoved: 0,
        vehiclesMoved: 0,
      };

      for (const dup of duplicateGuests) {
        // 1. Move bookings from duplicate to primary
        const bookingsResult = await tx.booking.updateMany({
          where: { primaryGuestId: dup.id },
          data: { primaryGuestId: primaryGuestId },
        });
        mergeSummary.bookingsMoved += bookingsResult.count;

        // 2. Move folios
        const foliosResult = await tx.folio.updateMany({
          where: { guestId: dup.id },
          data: { guestId: primaryGuestId },
        });
        mergeSummary.foliosUpdated += foliosResult.count;

        // 3. Move payments (guestId reference)
        const paymentsResult = await tx.payment.updateMany({
          where: { guestId: dup.id },
          data: { guestId: primaryGuestId },
        });
        mergeSummary.paymentsMoved += paymentsResult.count;

        // 4. Move documents
        const docsResult = await tx.guestDocument.updateMany({
          where: { guestId: dup.id },
          data: { guestId: primaryGuestId },
        });
        mergeSummary.documentsMoved += docsResult.count;

        // 5. Move reviews
        const reviewsResult = await tx.guestReview.updateMany({
          where: { guestId: dup.id },
          data: { guestId: primaryGuestId },
        });
        mergeSummary.reviewsMoved += reviewsResult.count;

        // 6. Move feedback
        const feedbackResult = await tx.guestFeedback.updateMany({
          where: { guestId: dup.id },
          data: { guestId: primaryGuestId },
        });
        mergeSummary.feedbackMoved += feedbackResult.count;

        // 7. Move guest stays
        const staysResult = await tx.guestStay.updateMany({
          where: { guestId: dup.id },
          data: { guestId: primaryGuestId },
        });
        mergeSummary.guestStaysMoved += staysResult.count;

        // 8. Move journey events
        await tx.guestJourney.updateMany({
          where: { guestId: dup.id },
          data: { guestId: primaryGuestId },
        });

        // 9. Move recommendations
        await tx.guestRecommendation.updateMany({
          where: { guestId: dup.id },
          data: { guestId: primaryGuestId },
        });

        // 10. Move loyalty redemptions
        const loyaltyRedResult = await tx.loyaltyRedemption.updateMany({
          where: { guestId: dup.id },
          data: { guestId: primaryGuestId },
        });
        mergeSummary.loyaltyRedemptionsMoved += loyaltyRedResult.count;

        // 11. Move loyalty point transactions
        const loyaltyTxResult = await tx.loyaltyPointTransaction.updateMany({
          where: { guestId: dup.id },
          data: { guestId: primaryGuestId },
        });
        mergeSummary.loyaltyTransactionsMoved += loyaltyTxResult.count;

        // 12. Move vehicles
        const vehiclesResult = await tx.vehicle.updateMany({
          where: { guestId: dup.id },
          data: { guestId: primaryGuestId },
        });
        mergeSummary.vehiclesMoved += vehiclesResult.count;

        // 13. Move segment memberships
        await tx.segmentMembership.updateMany({
          where: { guestId: dup.id },
          data: { guestId: primaryGuestId },
        });

        // 14. Combine loyalty points
        if (dup.loyaltyPoints > 0) {
          await tx.guest.update({
            where: { id: primaryGuestId },
            data: {
              loyaltyPoints: { increment: dup.loyaltyPoints },
            },
          });
          mergeSummary.loyaltyPointsCombined += dup.loyaltyPoints;
        }

        // 15. Combine total stays and spent
        await tx.guest.update({
          where: { id: primaryGuestId },
          data: {
            totalStays: { increment: dup.totalStays },
            totalSpent: { increment: dup.totalSpent },
          },
        });

        // 16. Update chat conversation references
        await tx.chatConversation.updateMany({
          where: { guestId: dup.id },
          data: { guestId: primaryGuestId },
        });

        // TODO: Transfer NPS responses (NpsResponse) from duplicate to primary guest.
        // Missing: tx.npsResponse.updateMany({ where: { guestId: dup.id }, data: { guestId: primaryGuestId } })
        // TODO: Transfer referral records from duplicate to primary guest.
        // Missing: any referral/viral entity that tracks guestId.

        // H-32: Transfer NPS responses and referral tracking from duplicate to primary guest.
        try {
          // Transfer NPS responses (NpsResponse) if the table exists
          await tx.npsResponse.updateMany({
            where: { guestId: dup.id },
            data: { guestId: primaryGuestId },
          });
        } catch (npsErr) {
          // NpsResponse table may not exist — log and continue
          console.warn(`[GuestMerge] Could not transfer NPS responses for guest ${dup.id}:`, npsErr);
        }
        try {
          // Transfer referral tracking records if the table exists
          await tx.referralTracking.updateMany({
            where: { referrerGuestId: dup.id },
            data: { referrerGuestId: primaryGuestId },
          });
          await tx.referralTracking.updateMany({
            where: { referredGuestId: dup.id },
            data: { referredGuestId: primaryGuestId },
          });
        } catch (refErr) {
          // ReferralTracking table may not exist — log and continue
          console.warn(`[GuestMerge] Could not transfer referral records for guest ${dup.id}:`, refErr);
        }
        mergeSummary.feedbackMoved += 0; // Placeholder for tracking

        // 17. Mark duplicate as merged
        await tx.guest.update({
          where: { id: dup.id },
          data: {
            status: 'merged',
            preferences: JSON.stringify({
              ...(typeof dup.preferences === 'string' ? JSON.parse(dup.preferences) : dup.preferences || {}),
              mergedInto: primaryGuestId,
              mergedAt: new Date().toISOString(),
            }),
          },
        });

        // 18. Delete duplicate guest behavior if exists
        if (dup.id) {
          await tx.guestBehavior.deleteMany({
            where: { guestId: dup.id },
          });
        }
      }

      // Update primary guest: mark as having absorbed duplicates
      await tx.guest.update({
        where: { id: primaryGuestId },
        data: {
          totalStays: { increment: 0 }, // Already incremented above
        },
      });

      // Fetch the merged primary guest profile
      const mergedGuest = await tx.guest.findUnique({
        where: { id: primaryGuestId },
        include: {
          behavior: true,
          documents: {
            select: { id: true, type: true, name: true, status: true },
          },
        },
      });

      return { mergedGuest, mergeSummary };
    });

    return NextResponse.json({
      success: true,
      data: {
        primaryGuest: result.mergedGuest,
        mergeSummary: result.mergeSummary,
        mergedDuplicateIds: duplicateGuestIds,
      },
    });
  } catch (error) {
    console.error('Error merging guests:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: 'Database constraint violation during merge' } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to merge guest profiles' } },
      { status: 500 }
    );
  }
}
