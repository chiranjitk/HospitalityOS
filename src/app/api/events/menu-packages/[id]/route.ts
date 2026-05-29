import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/events/menu-packages/[id] — Get single menu package
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.view', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const pkg = await db.menuPackage.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!pkg) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const itemsTotal = pkg.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const serviceCharge = Math.round(itemsTotal * pkg.serviceChargeRate * 100) / 100;
    const taxableSubtotal = itemsTotal + serviceCharge;
    const tax = Math.round(taxableSubtotal * pkg.taxRate * 100) / 100;

    return NextResponse.json({
      success: true,
      data: {
        ...pkg,
        itemsTotal,
        serviceCharge,
        tax,
        grandTotal: Math.round((itemsTotal + serviceCharge + tax) * 100) / 100,
      },
    });
  } catch (error) {
    console.error('GET /api/events/menu-packages/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch menu package' }, { status: 500 });
  }
}

// PUT /api/events/menu-packages/[id] — Update menu package
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const existing = await db.menuPackage.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const { name, category, description, serviceChargeRate, taxRate, isActive, items } = body;

    const validCategories = ['corporate', 'wedding', 'birthday', 'conference', 'social', 'custom'];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json({ success: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` }, { status: 400 });
    }

    let pkg;
    if (items && Array.isArray(items)) {
      // Full item replacement in a transaction
      pkg = await db.$transaction(async (tx) => {
        await tx.menuPackageItem.deleteMany({ where: { menuPackageId: id } });

        if (items.length > 0) {
          await tx.menuPackageItem.createMany({
            data: items.map((i: { name: string; itemCategory?: string; unitPrice?: number; quantity?: number; notes?: string; sortOrder?: number }, idx: number) => ({
              tenantId: user.tenantId,
              menuPackageId: id,
              name: i.name,
              itemCategory: i.itemCategory || 'food',
              unitPrice: i.unitPrice || 0,
              quantity: i.quantity || 1,
              notes: i.notes || null,
              sortOrder: i.sortOrder ?? idx,
            })),
          });
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name.trim();
        if (category !== undefined) updateData.category = category;
        if (description !== undefined) updateData.description = description;
        if (serviceChargeRate !== undefined) updateData.serviceChargeRate = serviceChargeRate;
        if (taxRate !== undefined) updateData.taxRate = taxRate;
        if (isActive !== undefined) updateData.isActive = isActive;

        return tx.menuPackage.update({
          where: { id },
          data: updateData,
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        });
      });
    } else {
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name.trim();
      if (category !== undefined) updateData.category = category;
      if (description !== undefined) updateData.description = description;
      if (serviceChargeRate !== undefined) updateData.serviceChargeRate = serviceChargeRate;
      if (taxRate !== undefined) updateData.taxRate = taxRate;
      if (isActive !== undefined) updateData.isActive = isActive;

      pkg = await db.menuPackage.update({
        where: { id },
        data: updateData,
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    }

    return NextResponse.json({ success: true, data: pkg });
  } catch (error) {
    console.error('PUT /api/events/menu-packages/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to update menu package' }, { status: 500 });
  }
}

// DELETE /api/events/menu-packages/[id] — Delete menu package
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const existing = await db.menuPackage.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    await db.menuPackage.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Menu package deleted' });
  } catch (error) {
    console.error('DELETE /api/events/menu-packages/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete menu package' }, { status: 500 });
  }
}
