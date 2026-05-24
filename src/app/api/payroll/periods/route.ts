/**
 * Payroll API — CRUD for PayrollPeriod and PayrollEntry
 *
 * GET:    List payroll periods (paginated, filterable)
 * POST:   Create a new payroll period
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasAnyPermission(user, ['payroll.view', 'payroll.manage', 'payroll.*', '*'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    if (!hasAnyPermission(user, ['payroll.manage', 'payroll.*', '*'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, startDate, endDate, payDate, propertyId } = body;

    if (!name || !startDate || !endDate || !payDate) {
      return NextResponse.json({ error: 'name, startDate, endDate, and payDate are required' }, { status: 400 });
    }

    // Validate date ordering
    const start = new Date(startDate);
    const end = new Date(endDate);
    const pay = new Date(payDate);

    if (start >= end) {
      return NextResponse.json({ error: 'startDate must be before endDate' }, { status: 400 });
    }

    if (pay < end) {
      return NextResponse.json({ error: 'payDate must be on or after endDate' }, { status: 400 });
    }

    // Check for overlap with existing periods
    const overlappingPeriod = await db.payrollPeriod.findFirst({
      where: {
        tenantId: user.tenantId,
        status: { not: 'archived' },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
    });

    if (overlappingPeriod) {
      return NextResponse.json(
        { error: `Payroll period overlaps with existing period "${overlappingPeriod.name}" (${overlappingPeriod.startDate} to ${overlappingPeriod.endDate})` },
        { status: 409 }
      );
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
