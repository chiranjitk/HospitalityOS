/**
 * Dead Letter Queue Admin API (Feature #43)
 *
 * GET: List DLQ entries with filters
 * POST: Retry entry
 * PUT: Resolve entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { retryFromDLQ, resolveDLQ, getDLQStats } from '@/lib/dlq';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const includeStats = searchParams.get('stats') === 'true';

    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    if (source) where.source = source;

    const [entries, total] = await Promise.all([
      db.deadLetterQueue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.deadLetterQueue.count({ where }),
    ]);

    const response: Record<string, unknown> = {
      entries,
      total,
      limit,
      offset,
    };

    if (includeStats) {
      response.stats = await getDLQStats(tenantId);
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('DLQ list failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'DLQ entry ID required' }, { status: 400 });
    }

    // Verify the entry belongs to this tenant
    const entry = await db.deadLetterQueue.findFirst({ where: { id, tenantId } });
    if (!entry) {
      return NextResponse.json({ error: 'DLQ entry not found' }, { status: 404 });
    }

    const success = await retryFromDLQ(id);

    return NextResponse.json({ success, retryCount: entry.retryCount + 1 });
  } catch (error) {
    logger.error('DLQ retry failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const body = await request.json();
    const { id, resolution } = body;

    if (!id || !resolution) {
      return NextResponse.json({ error: 'ID and resolution required' }, { status: 400 });
    }

    // Verify the entry belongs to this tenant
    const entry = await db.deadLetterQueue.findFirst({ where: { id, tenantId } });
    if (!entry) {
      return NextResponse.json({ error: 'DLQ entry not found' }, { status: 404 });
    }

    await resolveDLQ(id, resolution, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('DLQ resolve failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
