import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/guests/nps/[surveyId] - Get survey details with response breakdown
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { surveyId } = await params;

    const survey = await db.npsSurvey.findFirst({
      where: { id: surveyId, tenantId: user.tenantId },
    });

    if (!survey) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Survey not found' } }, { status: 404 });
    }

    const responses = await db.npsResponse.findMany({
      where: { surveyId },
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        booking: {
          select: { id: true, confirmationCode: true, checkIn: true, checkOut: true },
        },
      },
      orderBy: { respondedAt: 'desc' },
    });

    const total = responses.length;
    const promoters = responses.filter(r => r.category === 'promoter').length;
    const passives = responses.filter(r => r.category === 'passive').length;
    const detractors = responses.filter(r => r.category === 'detractor').length;
    const avgScore = total > 0 ? responses.reduce((sum, r) => sum + r.score, 0) / total : 0;

    // Score distribution
    const scoreDistribution: Record<number, number> = {};
    for (let i = survey.minScore; i <= survey.maxScore; i++) {
      scoreDistribution[i] = responses.filter(r => r.score === i).length;
    }

    // Trend: responses per day over last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentResponses = responses.filter(r => new Date(r.respondedAt) >= thirtyDaysAgo);
    const trendByDay: Record<string, { count: number; avg: number }> = {};
    for (const r of recentResponses) {
      const day = r.respondedAt.toISOString().split('T')[0];
      if (!trendByDay[day]) trendByDay[day] = { count: 0, avg: 0 };
      trendByDay[day].count += 1;
      trendByDay[day].avg += r.score;
    }
    for (const day of Object.keys(trendByDay)) {
      trendByDay[day].avg = Math.round((trendByDay[day].avg / trendByDay[day].count) * 10) / 10;
    }

    return NextResponse.json({
      success: true,
      data: {
        ...survey,
        stats: {
          total,
          avgScore: Math.round(avgScore * 10) / 10,
          npsScore: total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0,
          promoters,
          passives,
          detractors,
          distribution: {
            promoters: total > 0 ? Math.round((promoters / total) * 100) : 0,
            passives: total > 0 ? Math.round((passives / total) * 100) : 0,
            detractors: total > 0 ? Math.round((detractors / total) * 100) : 0,
          },
          scoreDistribution,
        },
        responseRate: survey.sentCount > 0 ? Math.round((survey.responseCount / survey.sentCount) * 100) : 0,
        responses,
        trendByDay,
      },
    });
  } catch (error) {
    console.error('Error fetching survey details:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch survey details' } }, { status: 500 });
  }
}

// PUT /api/guests/nps/[surveyId] - Update survey settings
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check
    if (!hasAnyPermission(user, ['crm.manage', 'guests.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { surveyId } = await params;
    const body = await request.json();

    const survey = await db.npsSurvey.findFirst({
      where: { id: surveyId, tenantId: user.tenantId },
    });

    if (!survey) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Survey not found' } }, { status: 404 });
    }

    const { name, triggerEvent, subject, message, customQuestion, minScore, maxScore, isActive } = body;

    const updated = await db.npsSurvey.update({
      where: { id: surveyId },
      data: {
        ...(name !== undefined && { name }),
        ...(triggerEvent !== undefined && { triggerEvent }),
        ...(subject !== undefined && { subject }),
        ...(message !== undefined && { message }),
        ...(customQuestion !== undefined && { customQuestion }),
        ...(minScore !== undefined && { minScore }),
        ...(maxScore !== undefined && { maxScore }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating NPS survey:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update NPS survey' } }, { status: 500 });
  }
}

// DELETE /api/guests/nps/[surveyId] - Deactivate survey
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check
    if (!hasAnyPermission(user, ['crm.manage', 'guests.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { surveyId } = await params;

    const survey = await db.npsSurvey.findFirst({
      where: { id: surveyId, tenantId: user.tenantId },
    });

    if (!survey) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Survey not found' } }, { status: 404 });
    }

    const updated = await db.npsSurvey.update({
      where: { id: surveyId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error deactivating NPS survey:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to deactivate NPS survey' } }, { status: 500 });
  }
}
