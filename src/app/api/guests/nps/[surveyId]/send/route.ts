import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

// POST /api/guests/nps/[surveyId]/send - Send NPS survey to guests
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { surveyId } = await params;
    const body = await request.json();
    const { daysSinceCheckout = 7, guestIds } = body;

    const survey = await db.npsSurvey.findFirst({
      where: { id: surveyId, tenantId: user.tenantId, isActive: true },
    });

    if (!survey) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Survey not found or inactive' } }, { status: 404 });
    }

    // Find guests who checked out in the last N days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceCheckout);

    const whereClause: Record<string, unknown> = {
      booking: {
        tenantId: user.tenantId,
        propertyId: survey.propertyId,
        status: 'checked_out',
        actualCheckOut: { gte: cutoffDate },
      },
      guest: { deletedAt: null },
    };

    // Exclude guests who already responded to this survey
    const existingRespondents = await db.npsResponse.findMany({
      where: { surveyId, tenantId: user.tenantId },
      select: { guestId: true },
    });
    const respondedGuestIds = new Set(existingRespondents.map(r => r.guestId));

    let targetGuestStays = await db.guestStay.findMany({
      where: whereClause,
      select: {
        guestId: true,
        bookingId: true,
        guest: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
      },
      distinct: ['guestId'],
    });

    // Filter out already-responded guests
    targetGuestStays = targetGuestStays.filter(gs => !respondedGuestIds.has(gs.guestId));

    // Filter by specific guest IDs if provided
    if (guestIds && Array.isArray(guestIds) && guestIds.length > 0) {
      targetGuestStays = targetGuestStays.filter(gs => guestIds.includes(gs.guestId));
    }

    // Create notifications for each guest
    let sentCount = 0;
    const sentErrors: string[] = [];

    for (const guestStay of targetGuestStays) {
      try {
        await db.notification.create({
          data: {
            tenantId: user.tenantId,
            userId: guestStay.guest.id,
            type: 'survey',
            category: 'info',
            title: survey.subject || 'We value your feedback',
            message: survey.message || `Please take a moment to rate your stay with us (0-10).`,
            data: JSON.stringify({ surveyId, bookingId: guestStay.bookingId }),
            link: `/survey/nps/${surveyId}`,
            priority: 'normal',
          },
        });
        sentCount++;
      } catch (err) {
        sentErrors.push(`Failed for guest ${guestStay.guestId}`);
      }
    }

    // Update survey sent count
    await db.npsSurvey.update({
      where: { id: surveyId },
      data: { sentCount: { increment: sentCount } },
    });

    return NextResponse.json({
      success: true,
      data: {
        sentCount,
        totalEligible: targetGuestStays.length,
        errors: sentErrors,
      },
    });
  } catch (error) {
    console.error('Error sending NPS survey:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send NPS survey' } }, { status: 500 });
  }
}
