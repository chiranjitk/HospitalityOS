import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/guests/nps - List NPS surveys with aggregate stats
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (isActive !== null) where.isActive = isActive === 'true';

    const surveys = await db.npsSurvey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate stats across all surveys
    const allResponses = await db.npsResponse.findMany({
      where: { tenantId: user.tenantId },
    });

    const totalResponses = allResponses.length;
    const promoters = allResponses.filter(r => r.category === 'promoter').length;
    const passives = allResponses.filter(r => r.category === 'passive').length;
    const detractors = allResponses.filter(r => r.category === 'detractor').length;
    const avgScore = totalResponses > 0
      ? allResponses.reduce((sum, r) => sum + r.score, 0) / totalResponses
      : 0;
    const npsScore = totalResponses > 0
      ? Math.round(((promoters - detractors) / totalResponses) * 100)
      : 0;

    // Per-survey stats
    const surveysWithStats = await Promise.all(surveys.map(async (survey) => {
      const responses = await db.npsResponse.findMany({
        where: { surveyId: survey.id },
        orderBy: { createdAt: 'desc' },
      });

      const surveyPromoters = responses.filter(r => r.category === 'promoter').length;
      const surveyPassives = responses.filter(r => r.category === 'passive').length;
      const surveyDetractors = responses.filter(r => r.category === 'detractor').length;
      const surveyTotal = responses.length;
      const surveyAvg = surveyTotal > 0
        ? responses.reduce((sum, r) => sum + r.score, 0) / surveyTotal
        : 0;
      const surveyNps = surveyTotal > 0
        ? Math.round(((surveyPromoters - surveyDetractors) / surveyTotal) * 100)
        : 0;

      return {
        ...survey,
        responseRate: survey.sentCount > 0 ? Math.round((survey.responseCount / survey.sentCount) * 100) : 0,
        stats: {
          total: surveyTotal,
          avgScore: Math.round(surveyAvg * 10) / 10,
          npsScore: surveyNps,
          promoters: surveyPromoters,
          passives: surveyPassives,
          detractors: surveyDetractors,
        },
      };
    }));

    return NextResponse.json({
      success: true,
      data: surveysWithStats,
      aggregate: {
        totalSurveys: surveys.length,
        totalResponses,
        avgScore: Math.round(avgScore * 10) / 10,
        npsScore,
        promoters,
        passives,
        detractors,
        responseDistribution: totalResponses > 0
          ? {
              promoters: Math.round((promoters / totalResponses) * 100),
              passives: Math.round((passives / totalResponses) * 100),
              detractors: Math.round((detractors / totalResponses) * 100),
            }
          : { promoters: 0, passives: 0, detractors: 0 },
      },
    });
  } catch (error) {
    console.error('Error fetching NPS surveys:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch NPS surveys' } }, { status: 500 });
  }
}

// POST /api/guests/nps - Create NPS survey configuration
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check for creating surveys
    if (!hasAnyPermission(user, ['crm.manage', 'guests.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { propertyId, name, triggerEvent, subject, message, customQuestion, minScore, maxScore } = body;

    if (!propertyId || !name) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId and name are required' } }, { status: 400 });
    }

    const survey = await db.npsSurvey.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        triggerEvent: triggerEvent || 'post_checkout',
        subject: subject || undefined,
        message: message || undefined,
        customQuestion: customQuestion || undefined,
        minScore: minScore ?? 0,
        maxScore: maxScore ?? 10,
      },
    });

    return NextResponse.json({ success: true, data: survey }, { status: 201 });
  } catch (error) {
    console.error('Error creating NPS survey:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create NPS survey' } }, { status: 500 });
  }
}
