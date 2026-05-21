/**
 * Report Cache Detail API
 *
 * GET:    Get a single report cache entry by ID
 * PUT:    Update a report cache entry
 * DELETE: Delete a report cache entry
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

    const cache = await db.reportCache.findUnique({ where: { id } });

    if (!cache || cache.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Report cache entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: cache });
  } catch (error) {
    logger.error('Failed to fetch report cache entry', error instanceof Error ? error : new Error(String(error)));
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

    const existing = await db.reportCache.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Report cache entry not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { generatedAt: new Date() };
    if (body.data !== undefined) {
      updateData.data = typeof body.data === 'string' ? body.data : JSON.stringify(body.data);
    }
    if (body.expiresAt !== undefined) {
      updateData.expiresAt = new Date(body.expiresAt);
    }

    const updated = await db.reportCache.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Failed to update report cache entry', error instanceof Error ? error : new Error(String(error)));
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

    const existing = await db.reportCache.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Report cache entry not found' }, { status: 404 });
    }

    await db.reportCache.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete report cache entry', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
