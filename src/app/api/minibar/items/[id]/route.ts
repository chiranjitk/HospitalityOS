import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { transformRecord, statusToIsActive } from '@/lib/api-transform';

// GET /api/minibar/items/[id] - Get a single minibar item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'housekeeping.view') && !hasPermission(user, 'tasks.view') && !hasPermission(user, 'housekeeping.*') && !hasPermission(user, 'tasks.*')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;

    const item = await db.minibarItem.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!item) {
      return NextResponse.json({ success: false, error: 'Minibar item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: transformRecord(item as unknown as Record<string, unknown>) });
  } catch (error) {
    console.error('[GET /api/minibar/items/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/minibar/items/[id] - Update a minibar item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'housekeeping.manage') && !hasPermission(user, 'tasks.update') && !hasPermission(user, 'housekeeping.*') && !hasPermission(user, 'tasks.*')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.minibarItem.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Minibar item not found' }, { status: 404 });
    }

    const { name, category, sku, costPrice, sellPrice, currency, imageUrl, isActive, status, sortOrder } = body;
    const isActiveValue = isActive !== undefined ? isActive : (status !== undefined ? statusToIsActive(status) : undefined);

    const item = await db.minibarItem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(sku !== undefined && { sku }),
        ...(costPrice !== undefined && { costPrice }),
        ...(sellPrice !== undefined && { sellPrice }),
        ...(currency !== undefined && { currency }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(isActiveValue !== undefined && { isActive: isActiveValue }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    return NextResponse.json({ success: true, data: transformRecord(item as unknown as Record<string, unknown>) });
  } catch (error) {
    console.error('[PUT /api/minibar/items/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/minibar/items/[id] - Delete a minibar item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'housekeeping.manage') && !hasPermission(user, 'tasks.delete') && !hasPermission(user, 'housekeeping.*') && !hasPermission(user, 'tasks.*')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.minibarItem.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Minibar item not found' }, { status: 404 });
    }

    await db.minibarItem.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[DELETE /api/minibar/items/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
