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

    // Check for duplicate response
    const existing = await db.npsResponse.findFirst({
      where: { surveyId, guestId },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'Guest has already responded to this survey' } },
        { status: 400 }
      );
    }

    // Create response
    const response = await db.npsResponse.create({
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

    // Recalculate survey avgScore and update responseCount
    const allResponses = await db.npsResponse.findMany({
      where: { surveyId },
      select: { score: true },
    });

    const totalResponses = allResponses.length;
    const avgScore = totalResponses > 0
      ? allResponses.reduce((sum, r) => sum + r.score, 0) / totalResponses
      : 0;

    await db.npsSurvey.update({
      where: { id: surveyId },
      data: {
        responseCount: totalResponses,
        avgScore,
      },
    });

    return NextResponse.json({ success: true, data: response }, { status: 201 });
  } catch (error) {
    console.error('Error submitting NPS response:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to submit NPS response' } }, { status: 500 });
  }
}
