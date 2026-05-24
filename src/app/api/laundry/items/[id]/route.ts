import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { transformRecord, statusToIsActive } from '@/lib/api-transform';

// GET /api/laundry/items/[id] - Get a single laundry item
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

    const item = await db.laundryItem.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!item) {
      return NextResponse.json({ success: false, error: 'Laundry item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: transformRecord(item as unknown as Record<string, unknown>) });
  } catch (error) {
    console.error('[GET /api/laundry/items/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/laundry/items/[id] - Update a laundry item
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

    const existing = await db.laundryItem.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Laundry item not found' }, { status: 404 });
    }

    const { name, category, serviceType, unitPrice, currency, turnaroundHours, isActive, status, sortOrder } = body;
    const isActiveValue = isActive !== undefined ? isActive : (status !== undefined ? statusToIsActive(status) : undefined);

    const item = await db.laundryItem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(serviceType !== undefined && { serviceType }),
        ...(unitPrice !== undefined && { unitPrice }),
        ...(currency !== undefined && { currency }),
        ...(turnaroundHours !== undefined && { turnaroundHours }),
        ...(isActiveValue !== undefined && { isActive: isActiveValue }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    return NextResponse.json({ success: true, data: transformRecord(item as unknown as Record<string, unknown>) });
  } catch (error) {
    console.error('[PUT /api/laundry/items/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/laundry/items/[id] - Delete a laundry item
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

    const existing = await db.laundryItem.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Laundry item not found' }, { status: 404 });
    }

    await db.laundryItem.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[DELETE /api/laundry/items/[id]]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
