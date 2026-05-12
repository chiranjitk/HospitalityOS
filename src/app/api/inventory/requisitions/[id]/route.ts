import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['inventory.manage', 'inventory.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const req = await db.purchaseRequisition.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { items: true },
    });
    if (!req) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: req });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch requisition' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['inventory.manage', 'inventory.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const existing = await db.purchaseRequisition.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const validStatuses = ['draft', 'pending_approval', 'approved', 'rejected', 'ordered', 'partial', 'received', 'cancelled'];
    const { status, notes, priority, vendorId, requiredBy, items } = body;
    if (status && !validStatuses.includes(status))
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;
    if (priority) updateData.priority = priority;
    if (vendorId) updateData.vendorId = vendorId;
    if (requiredBy) updateData.requiredBy = new Date(requiredBy);

    let req;
    if (items && Array.isArray(items)) {
      req = await db.$transaction(async (tx) => {
        await tx.purchaseRequisitionItem.deleteMany({ where: { requisitionId: id } });
        const totalAmount = items.reduce((s: number, i: { unitPrice: number; quantity: number }) => s + (i.unitPrice || 0) * (i.quantity || 0), 0);
        return tx.purchaseRequisition.update({
          where: { id }, data: { ...updateData, ...(status ? { status } : {}), totalAmount },
          include: { items: true },
        });
      });
      // Re-create items
      await db.purchaseRequisitionItem.createMany({
        data: items.map((i: { stockItemId?: string; itemName: string; description?: string; quantity: number; unit: string; unitPrice: number; notes?: string }) => ({
          requisitionId: id, stockItemId: i.stockItemId || null,
          itemName: i.itemName, description: i.description,
          quantity: i.quantity, unit: i.unit || 'pcs',
          unitPrice: i.unitPrice || 0,
          totalPrice: (i.unitPrice || 0) * (i.quantity || 0),
          notes: i.notes,
        })),
      });
    } else {
      if (status) updateData.status = status;
      req = await db.purchaseRequisition.update({
        where: { id }, data: updateData,
        include: { items: true },
      });
    }

    return NextResponse.json({ success: true, data: req });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update requisition' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['inventory.manage', 'inventory.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const existing = await db.purchaseRequisition.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    if (!['draft', 'pending_approval'].includes(existing.status))
      return NextResponse.json({ success: false, error: 'Cannot delete in current status' }, { status: 400 });

    await db.purchaseRequisition.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Requisition deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete requisition' }, { status: 500 });
  }
}
