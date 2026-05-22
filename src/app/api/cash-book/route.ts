/**
 * Cash Book API — CRUD for CashBookEntry
 *
 * GET:    List cash book entries (paginated, filterable by propertyId, date, status)
 * POST:   Create a new cash book entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;
    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.date = dateFilter;
    }

    const [data, total] = await Promise.all([
      db.cashBookEntry.findMany({
        where,
        include: {
          transactions: true,
        },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.cashBookEntry.count({ where }),
    ]);

    return NextResponse.json({ success: true, data, pagination: { total, limit, offset } });
  } catch (error) {
    logger.error('Failed to list cash book entries', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { propertyId, date, openingBalance, closingBalance } = body;

    if (!propertyId || !date) {
      return NextResponse.json({ error: 'propertyId and date are required' }, { status: 400 });
    }

    const entry = await db.cashBookEntry.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        date: new Date(date),
        openingBalance: openingBalance ?? 0,
        closingBalance: closingBalance ?? 0,
        preparedBy: user.id,
      },
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create cash book entry', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
