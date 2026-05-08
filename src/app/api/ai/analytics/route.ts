import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

/**
 * GET /api/ai/analytics - Retrieve analytics query history
 * Query params: page, limit, category
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
    const category = searchParams.get('category');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (category && category !== 'all') {
      where.intent = category;
    }

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
        queryType: q.queryType,
        intent: q.intent,
        parameters: JSON.parse(q.parameters || '{}'),
        resultData: JSON.parse(q.resultData || '{}'),
        resultType: q.resultType,
        processingMs: q.processingMs,
        createdAt: q.createdAt.toISOString(),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching analytics queries:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch analytics queries' }, { status: 500 });
  }
}

/**
 * POST /api/ai/analytics - Save a new analytics query result
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['ai.view', 'ai.*', 'analytics.view', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { query, intent, parameters, resultData, resultType, processingMs } = body;

    if (!query) {
      return NextResponse.json({ success: false, error: 'Query is required' }, { status: 400 });
    }

    const saved = await db.analyticsQuery.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        query,
        queryType: body.queryType || 'natural_language',
        intent: intent || null,
        parameters: JSON.stringify(parameters || {}),
        resultData: JSON.stringify(resultData || {}),
        resultType: resultType || 'table',
        processingMs: processingMs || 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: saved.id,
        query: saved.query,
        queryType: saved.queryType,
        intent: saved.intent,
        parameters: JSON.parse(saved.parameters || '{}'),
        resultData: JSON.parse(saved.resultData || '{}'),
        resultType: saved.resultType,
        processingMs: saved.processingMs,
        createdAt: saved.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error saving analytics query:', error);
    return NextResponse.json({ success: false, error: 'Failed to save analytics query' }, { status: 500 });
  }
}
