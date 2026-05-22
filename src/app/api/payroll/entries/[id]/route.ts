/**
 * Payroll Entry Detail API
 *
 * GET:    Get a single payroll entry by ID
 * PUT:    Update a payroll entry
 * DELETE: Delete a payroll entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const entry = await db.payrollEntry.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, jobTitle: true, department: true } },
        payrollPeriod: { select: { id: true, name: true, startDate: true, endDate: true, status: true } },
      },
    });

    if (!entry || entry.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Payroll entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    logger.error('Failed to fetch payroll entry', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.payrollEntry.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Payroll entry not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.basicSalary !== undefined) updateData.basicSalary = body.basicSalary;
    if (body.overtimeAmount !== undefined) updateData.overtimeAmount = body.overtimeAmount;
    if (body.bonus !== undefined) updateData.bonus = body.bonus;
    if (body.allowances !== undefined) updateData.allowances = body.allowances;
    if (body.taxDeduction !== undefined) updateData.taxDeduction = body.taxDeduction;
    if (body.pfDeduction !== undefined) updateData.pfDeduction = body.pfDeduction;
    if (body.esiDeduction !== undefined) updateData.esiDeduction = body.esiDeduction;
    if (body.otherDeductions !== undefined) updateData.otherDeductions = body.otherDeductions;

    // Recalculate totals
    const b = { ...existing, ...updateData };
    updateData.totalGross = (b.basicSalary ?? 0) + (b.overtimeAmount ?? 0) + (b.bonus ?? 0) + (b.allowances ?? 0);
    updateData.totalDeductions = (b.taxDeduction ?? 0) + (b.pfDeduction ?? 0) + (b.esiDeduction ?? 0) + (b.otherDeductions ?? 0);
    updateData.totalNet = (updateData.totalGross as number) - (updateData.totalDeductions as number);

    const updated = await db.payrollEntry.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Failed to update payroll entry', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.payrollEntry.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Payroll entry not found' }, { status: 404 });
    }

    await db.payrollEntry.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete payroll entry', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
