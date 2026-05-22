/**
 * Journal Entry Detail API
 *
 * GET:    Get a single journal entry by ID
 * PUT:    Update a journal entry
 * DELETE: Delete a journal entry (only if status is draft)
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

    const entry = await db.journalEntry.findUnique({
      where: { id },
      include: { lines: { include: { financialAccount: true } } },
    });

    if (!entry || entry.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    logger.error('Failed to fetch journal entry', error instanceof Error ? error : new Error(String(error)));
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

    const existing = await db.journalEntry.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    if (existing.status === 'posted') {
      return NextResponse.json({ error: 'Cannot update a posted journal entry' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.description !== undefined) updateData.description = body.description;
    if (body.reference !== undefined) updateData.reference = body.reference;
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'posted') {
        updateData.postedBy = user.id;
        updateData.postedAt = new Date();
      }
    }

    const updated = await db.journalEntry.update({
      where: { id },
      data: updateData,
      include: { lines: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Failed to update journal entry', error instanceof Error ? error : new Error(String(error)));
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

    const existing = await db.journalEntry.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    if (existing.status === 'posted') {
      return NextResponse.json({ error: 'Cannot delete a posted journal entry' }, { status: 400 });
    }

    await db.journalEntry.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete journal entry', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
