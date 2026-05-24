/**
 * Report Cache API — CRUD for ReportCache
 *
 * GET:    List report cache entries (paginated, filterable)
 * POST:   Create a new report cache entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user, 'reports.view')) {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('reportType');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (reportType) where.reportType = reportType;

    const [data, total] = await Promise.all([
      db.reportCache.findMany({
        where,
        orderBy: { generatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.reportCache.count({ where }),
    ]);

    return NextResponse.json({ success: true, data, pagination: { total, limit, offset } });
  } catch (error) {
    logger.error('Failed to list report cache entries', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user, 'reports.manage') && !hasPermission(user, 'reports.*')) {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { reportType, periodStart, periodEnd, data, expiresAt } = body;

    if (!reportType || !periodStart || !periodEnd || !data) {
      return NextResponse.json({ error: 'reportType, periodStart, periodEnd, and data are required' }, { status: 400 });
    }

    const cache = await db.reportCache.create({
      data: {
        tenantId: user.tenantId,
        reportType,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        data: typeof data === 'string' ? data : JSON.stringify(data),
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({ success: true, data: cache }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Failed to create report cache entry', error instanceof Error ? error : new Error(String(error)));
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Report cache entry already exists for this report type and period' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
