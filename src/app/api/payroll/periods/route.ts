/**
 * Payroll API — CRUD for PayrollPeriod and PayrollEntry
 *
 * GET:    List payroll periods (paginated, filterable)
 * POST:   Create a new payroll period
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
    const status = searchParams.get('status');
    const propertyId = searchParams.get('propertyId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) where.status = status;
    if (propertyId) where.propertyId = propertyId;

    const [data, total] = await Promise.all([
      db.payrollPeriod.findMany({
        where,
        include: {
          entries: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, jobTitle: true, department: true } },
            },
          },
        },
        orderBy: { startDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.payrollPeriod.count({ where }),
    ]);

    return NextResponse.json({ success: true, data, pagination: { total, limit, offset } });
  } catch (error) {
    logger.error('Failed to list payroll periods', error instanceof Error ? error : new Error(String(error)));
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
    const { name, startDate, endDate, payDate, propertyId } = body;

    if (!name || !startDate || !endDate || !payDate) {
      return NextResponse.json({ error: 'name, startDate, endDate, and payDate are required' }, { status: 400 });
    }

    const period = await db.payrollPeriod.create({
      data: {
        tenantId: user.tenantId,
        propertyId: propertyId || null,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        payDate: new Date(payDate),
        status: 'draft',
      },
    });

    return NextResponse.json({ success: true, data: period }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create payroll period', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
