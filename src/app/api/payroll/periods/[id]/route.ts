/**
 * Payroll Period Detail API
 *
 * GET:    Get a single payroll period by ID
 * PUT:    Update a payroll period
 * DELETE: Delete a payroll period (only if status is draft)
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

    const period = await db.payrollPeriod.findUnique({
      where: { id },
      include: {
        entries: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, jobTitle: true, department: true } },
          },
        },
      },
    });

    if (!period || period.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: period });
  } catch (error) {
    logger.error('Failed to fetch payroll period', error instanceof Error ? error : new Error(String(error)));
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

    const existing = await db.payrollPeriod.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) updateData.endDate = new Date(body.endDate);
    if (body.payDate !== undefined) updateData.payDate = new Date(body.payDate);
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'approved') {
        updateData.approvedBy = user.id;
        updateData.approvedAt = new Date();
      }
    }

    const updated = await db.payrollPeriod.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Failed to update payroll period', error instanceof Error ? error : new Error(String(error)));
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

    const existing = await db.payrollPeriod.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft payroll periods can be deleted' }, { status: 400 });
    }

    await db.payrollPeriod.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete payroll period', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
