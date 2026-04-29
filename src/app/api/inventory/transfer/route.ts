import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// POST /api/inventory/transfer - Create inter-property transfer request
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'inventory.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { fromPropertyId, toPropertyId, items, reason, notes } = body;

    if (!fromPropertyId || !toPropertyId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: fromPropertyId, toPropertyId, items' },
        { status: 400 }
      );
    }

    if (fromPropertyId === toPropertyId) {
      return NextResponse.json(
        { error: 'From and to properties must be different' },
        { status: 400 }
      );
    }

    const transfer = await db.inventoryTransfer.create({
      data: {
        tenantId: user.tenantId,
        fromPropertyId,
        toPropertyId,
        requestedBy: user.userId,
        reason,
        notes,
        status: 'requested',
        items: {
          create: items.map((item: { stockItemId: string; stockItemName: string; quantity: number; unit: string; unitCost: number }) => ({
            stockItemId: item.stockItemId,
            stockItemName: item.stockItemName,
            quantity: item.quantity,
            unit: item.unit,
            unitCost: item.unitCost,
          })),
        },
      },
      include: {
        fromProperty: { select: { id: true, name: true } },
        toProperty: { select: { id: true, name: true } },
        items: true,
      },
    });

    return NextResponse.json({ success: true, data: transfer });
  } catch (error) {
    console.error('Error creating transfer:', error);
    return NextResponse.json({ error: 'Failed to create transfer' }, { status: 500 });
  }
}

// GET /api/inventory/transfer - List transfers with status filter
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'inventory.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const propertyId = searchParams.get('propertyId');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (propertyId) {
      where.OR = [
        { fromPropertyId: propertyId },
        { toPropertyId: propertyId },
      ];
    }

    const transfers = await db.inventoryTransfer.findMany({
      where,
      include: {
        fromProperty: { select: { id: true, name: true } },
        toProperty: { select: { id: true, name: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      requested: transfers.filter(t => t.status === 'requested').length,
      approved: transfers.filter(t => t.status === 'approved').length,
      in_transit: transfers.filter(t => t.status === 'in_transit').length,
      completed: transfers.filter(t => t.status === 'completed').length,
      rejected: transfers.filter(t => t.status === 'rejected').length,
    };

    return NextResponse.json({ success: true, data: transfers, stats });
  } catch (error) {
    console.error('Error fetching transfers:', error);
    return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 });
  }
}

// PUT /api/inventory/transfer - Approve/complete transfer
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'inventory.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { id, status, rejectionReason } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing required fields: id, status' }, { status: 400 });
    }

    const validStatuses = ['approved', 'in_transit', 'completed', 'rejected'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const existing = await db.inventoryTransfer.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      status,
    };

    if (status === 'approved') {
      updateData.approvedBy = user.userId;
      updateData.approvedAt = new Date();
    } else if (status === 'completed') {
      updateData.completedBy = user.userId;
      updateData.completedAt = new Date();

      // Update stock quantities on completion
      const transferItems = await db.inventoryTransferItem.findMany({
        where: { transferId: id },
      });

      for (const item of transferItems) {
        // Decrease quantity at source property
        await db.stockItem.updateMany({
          where: { id: item.stockItemId, propertyId: existing.fromPropertyId },
          data: { quantity: { decrement: item.quantity } },
        });

        // Increase quantity at destination property
        const destItem = await db.stockItem.findFirst({
          where: { name: item.stockItemName, propertyId: existing.toPropertyId, deletedAt: null },
        });

        if (destItem) {
          await db.stockItem.update({
            where: { id: destItem.id },
            data: { quantity: { increment: item.quantity } },
          });
        } else {
          await db.stockItem.create({
            data: {
              tenantId: user.tenantId,
              propertyId: existing.toPropertyId,
              name: item.stockItemName,
              unit: item.unit,
              unitCost: item.unitCost,
              quantity: item.quantity,
              minQuantity: 0,
              status: 'active',
            },
          });
        }
      }
    } else if (status === 'rejected') {
      updateData.rejectedAt = new Date();
      updateData.rejectionReason = rejectionReason || null;
    }

    const transfer = await db.inventoryTransfer.update({
      where: { id },
      data: updateData,
      include: {
        fromProperty: { select: { id: true, name: true } },
        toProperty: { select: { id: true, name: true } },
        items: true,
      },
    });

    return NextResponse.json({ success: true, data: transfer });
  } catch (error) {
    console.error('Error updating transfer:', error);
    return NextResponse.json({ error: 'Failed to update transfer' }, { status: 500 });
  }
}
