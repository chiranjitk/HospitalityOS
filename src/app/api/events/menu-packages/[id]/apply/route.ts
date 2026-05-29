import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// POST /api/events/menu-packages/[id]/apply — Apply a menu package to a BEO
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params; // menuPackageId
    const body = await request.json();
    const { beoId, overwrite } = body;

    if (!beoId || typeof beoId !== 'string') {
      return NextResponse.json({ success: false, error: 'beoId is required' }, { status: 400 });
    }

    // Fetch the menu package
    const menuPackage = await db.menuPackage.findFirst({
      where: { id, tenantId: user.tenantId, isActive: true },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!menuPackage) {
      return NextResponse.json({ success: false, error: 'Menu package not found or inactive' }, { status: 404 });
    }

    // Fetch and validate the BEO
    const beo = await db.banquetEventOrder.findFirst({
      where: { id: beoId, tenantId: user.tenantId },
    });

    if (!beo) {
      return NextResponse.json({ success: false, error: 'BEO not found' }, { status: 404 });
    }

    if (!['draft', 'confirmed'].includes(beo.status)) {
      return NextResponse.json({ success: false, error: 'Cannot apply menu package to BEO in current status. Only draft or confirmed BEOs can be modified.' }, { status: 400 });
    }

    if (menuPackage.items.length === 0) {
      return NextResponse.json({ success: false, error: 'Menu package has no items to apply' }, { status: 400 });
    }

    // Apply the package items to the BEO in a transaction
    const result = await db.$transaction(async (tx) => {
      // Optionally clear existing items first
      if (overwrite) {
        await tx.bEOItem.deleteMany({ where: { orderId: beoId } });
      }

      // Create BEO items from menu package items
      const createdItems = await tx.bEOItem.createMany({
        data: menuPackage.items.map(item => ({
          orderId: beoId,
          category: item.itemCategory || 'food',
          description: item.name,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          totalPrice: (item.unitPrice || 0) * (item.quantity || 1),
          notes: item.notes || null,
          sortOrder: item.sortOrder || 0,
        })),
      });

      // Recalculate total amount for the BEO
      const allItems = await tx.bEOItem.findMany({
        where: { orderId: beoId },
      });

      const newTotal = allItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

      await tx.banquetEventOrder.update({
        where: { id: beoId },
        data: { totalAmount: Math.round(newTotal * 100) / 100 },
      });

      return {
        itemsAdded: createdItems.count,
        totalItems: allItems.length,
        newTotalAmount: Math.round(newTotal * 100) / 100,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        menuPackageId: menuPackage.id,
        menuPackageName: menuPackage.name,
        beoId,
        overwrite: !!overwrite,
        ...result,
      },
    });
  } catch (error) {
    console.error('POST /api/events/menu-packages/[id]/apply:', error);
    return NextResponse.json({ success: false, error: 'Failed to apply menu package' }, { status: 500 });
  }
}
