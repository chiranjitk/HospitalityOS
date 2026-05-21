/**
 * Payroll Entries API — CRUD for PayrollEntry
 *
 * GET:    List payroll entries for a period (paginated)
 * POST:   Create a new payroll entry
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
    const payrollPeriodId = searchParams.get('payrollPeriodId');
    const userId = searchParams.get('userId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (payrollPeriodId) where.payrollPeriodId = payrollPeriodId;
    if (userId) where.userId = userId;

    const [data, total] = await Promise.all([
      db.payrollEntry.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, jobTitle: true, department: true } },
          payrollPeriod: { select: { id: true, name: true, startDate: true, endDate: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.payrollEntry.count({ where }),
    ]);

    return NextResponse.json({ success: true, data, pagination: { total, limit, offset } });
  } catch (error) {
    logger.error('Failed to list payroll entries', error instanceof Error ? error : new Error(String(error)));
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
    const { payrollPeriodId, userId, basicSalary, overtimeAmount, bonus, allowances,
      taxDeduction, pfDeduction, esiDeduction, otherDeductions } = body;

    if (!payrollPeriodId || !userId) {
      return NextResponse.json({ error: 'payrollPeriodId and userId are required' }, { status: 400 });
    }

    const totalGross = (basicSalary ?? 0) + (overtimeAmount ?? 0) + (bonus ?? 0) + (allowances ?? 0);
    const totalDeductions = (taxDeduction ?? 0) + (pfDeduction ?? 0) + (esiDeduction ?? 0) + (otherDeductions ?? 0);
    const totalNet = totalGross - totalDeductions;

    const entry = await db.payrollEntry.create({
      data: {
        tenantId: user.tenantId,
        payrollPeriodId,
        userId,
        basicSalary: basicSalary ?? 0,
        overtimeAmount: overtimeAmount ?? 0,
        bonus: bonus ?? 0,
        allowances: allowances ?? 0,
        totalGross,
        taxDeduction: taxDeduction ?? 0,
        pfDeduction: pfDeduction ?? 0,
        esiDeduction: esiDeduction ?? 0,
        otherDeductions: otherDeductions ?? 0,
        totalDeductions,
        totalNet,
      },
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create payroll entry', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
