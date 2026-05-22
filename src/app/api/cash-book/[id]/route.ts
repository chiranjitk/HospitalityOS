/**
 * Cash Book Entry Detail API
 *
 * GET:    Get a single cash book entry by ID
 * PUT:    Update a cash book entry
 * DELETE: Delete a cash book entry (only if status is open)
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

    const entry = await db.cashBookEntry.findUnique({
      where: { id },
      include: {
        transactions: { orderBy: { time: 'asc' } },
      },
    });

    if (!entry || entry.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Cash book entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    logger.error('Failed to fetch cash book entry', error instanceof Error ? error : new Error(String(error)));
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

    const existing = await db.cashBookEntry.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Cash book entry not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.openingBalance !== undefined) updateData.openingBalance = body.openingBalance;
    if (body.closingBalance !== undefined) updateData.closingBalance = body.closingBalance;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.approvedBy !== undefined) updateData.approvedBy = body.approvedBy;
    if (body.status === 'closed' || body.status === 'adjusted') {
      updateData.approvedBy = user.id;
      updateData.approvedAt = new Date();
    }

    const updated = await db.cashBookEntry.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Failed to update cash book entry', error instanceof Error ? error : new Error(String(error)));
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

    const existing = await db.cashBookEntry.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Cash book entry not found' }, { status: 404 });
    }

    if (existing.status !== 'open') {
      return NextResponse.json({ error: 'Only open cash book entries can be deleted' }, { status: 400 });
    }

    await db.cashBookEntry.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete cash book entry', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
