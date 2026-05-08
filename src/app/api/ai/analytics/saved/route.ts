import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

/**
 * GET /api/ai/analytics/saved - Get saved/pinned analytics queries
 * Query params: page, limit
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['ai.view', 'ai.*', 'analytics.view', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where = {
      tenantId: user.tenantId,
      userId: user.id,
      queryType: 'saved',
    };

    const [queries, total] = await Promise.all([
      db.analyticsQuery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.analyticsQuery.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: queries.map(q => ({
        id: q.id,
        query: q.query,
        intent: q.intent,
        parameters: JSON.parse(q.parameters || '{}'),
        resultData: JSON.parse(q.resultData || '{}'),
        resultType: q.resultType,
        createdAt: q.createdAt.toISOString(),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching saved queries:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch saved queries' }, { status: 500 });
  }
}
