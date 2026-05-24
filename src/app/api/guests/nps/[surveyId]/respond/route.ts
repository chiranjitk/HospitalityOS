import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

// POST /api/guests/nps/[surveyId]/respond - Submit NPS response
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
    const { guestId, bookingId, score, comment } = body;

    // Validate inputs
    if (!guestId || score === undefined || score < 0 || score > 10) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid guestId and score (0-10) are required' } },
        { status: 400 }
      );
    }

    // Verify survey exists and is active
    const survey = await db.npsSurvey.findFirst({
      where: { id: surveyId, tenantId: user.tenantId, isActive: true },
    });

    if (!survey) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Survey not found or inactive' } }, { status: 404 });
    }

    // Verify guest belongs to tenant
    const guest = await db.guest.findFirst({
      where: { id: guestId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!guest) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } }, { status: 404 });
    }

    // Determine category
    let category: string;
    if (score >= 9) category = 'promoter';
    else if (score >= 7) category = 'passive';
    else category = 'detractor';

    // Use transaction to atomically check for duplicate + create response + update aggregate
    // (prevents race condition and keeps aggregate consistent with response creation)
    const response = await db.$transaction(async (tx) => {
      // Check for duplicate response inside transaction
      const existing = await tx.npsResponse.findFirst({
        where: { surveyId, guestId },
      });

      if (existing) {
        throw new Error('DUPLICATE_RESPONSE');
      }

      // Create response
      const created = await tx.npsResponse.create({
        data: {
          surveyId,
          tenantId: user.tenantId,
          guestId,
          bookingId: bookingId || undefined,
          score,
          category,
          comment: comment || undefined,
        },
      });

      // Recalculate survey avgScore and update responseCount inside same transaction
      const allResponses = await tx.npsResponse.findMany({
        where: { surveyId },
        select: { score: true },
      });

      const totalResponses = allResponses.length;
      const avgScore = totalResponses > 0
        ? allResponses.reduce((sum, r) => sum + r.score, 0) / totalResponses
        : 0;

      await tx.npsSurvey.update({
        where: { id: surveyId },
        data: {
          responseCount: totalResponses,
          avgScore,
        },
      });

      return created;
    });

    return NextResponse.json({ success: true, data: response }, { status: 201 });
  } catch (error) {
    console.error('Error submitting NPS response:', error);
    if (error instanceof Error && error.message === 'DUPLICATE_RESPONSE') {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'Guest has already responded to this survey' } },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to submit NPS response' } }, { status: 500 });
  }
}
