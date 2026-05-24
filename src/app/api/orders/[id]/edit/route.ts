import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

// PUT /api/orders/[id]/edit - Edit an order (add/remove items, update quantities, update notes)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const {
      addItem,
      removeItem,
      updateQuantity,
      updateNotes,
      notes,
    } = body;

    // Fetch the order with items
    const existingOrder = await db.order.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        items: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true, isAvailable: true },
            },
          },
        },
        property: {
          select: { id: true, defaultTaxRate: true, taxComponents: true, serviceChargePercent: true },
        },
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
        { status: 404 }
      );
    }

    // Validate: can only edit orders with status 'pending' or 'confirmed'
    if (!['pending', 'confirmed'].includes(existingOrder.status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Cannot edit order with status '${existingOrder.status}'. Only pending or confirmed orders can be edited.`,
          },
        },
        { status: 400 }
      );
    }

    // Store old values for audit log
    const oldItemsSnapshot = existingOrder.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalAmount: item.totalAmount,
      notes: item.notes,
    }));

    // Track changes for audit
    const changes: string[] = [];

    // Process modifications in a transaction
    const updatedOrder = await db.$transaction(async (tx) => {
      // 1. Add new item
      if (addItem) {
        const { menuItemId, quantity, notes: itemNotes } = addItem;

        // Validate menu item exists and is available
        const menuItem = await tx.menuItem.findFirst({
          where: { id: menuItemId, propertyId: existingOrder.propertyId, deletedAt: null },
        });

        if (!menuItem) {
          throw new Error(`Menu item not found: ${menuItemId}`);
        }

        if (!menuItem.isAvailable) {
          throw new Error(`Menu item is not available: ${menuItem.name}`);
        }

        await tx.orderItem.create({
          data: {
            orderId: id,
            menuItemId,
            quantity: quantity || 1,
            unitPrice: menuItem.price,
            totalAmount: menuItem.price * (quantity || 1),
            notes: itemNotes,
            status: 'pending',
          },
        });

        changes.push(`Added ${menuItem.name} x${quantity || 1}`);
      }

      // 2. Remove item
      if (removeItem) {
        const itemToRemove = await tx.orderItem.findFirst({
          where: { id: removeItem, orderId: id },
          include: { menuItem: { select: { name: true } } },
        });

        if (!itemToRemove) {
          throw new Error(`Order item not found: ${removeItem}`);
        }

        await tx.orderItem.delete({
          where: { id: removeItem },
        });

        changes.push(`Removed ${itemToRemove.menuItem.name} x${itemToRemove.quantity}`);
      }

      // 3. Update quantity
      if (updateQuantity) {
        const { itemId, quantity: newQuantity } = updateQuantity;

        if (newQuantity < 1) {
          throw new Error('Quantity must be at least 1');
        }

        const itemToUpdate = await tx.orderItem.findFirst({
          where: { id: itemId, orderId: id },
          include: { menuItem: { select: { name: true } } },
        });

        if (!itemToUpdate) {
          throw new Error(`Order item not found: ${itemId}`);
        }

        const newTotalAmount = itemToUpdate.unitPrice * newQuantity;

        await tx.orderItem.update({
          where: { id: itemId },
          data: {
            quantity: newQuantity,
            totalAmount: newTotalAmount,
          },
        });

        changes.push(`Updated ${itemToUpdate.menuItem.name} quantity: ${itemToUpdate.quantity} -> ${newQuantity}`);
      }

      // 4. Update item notes
      if (updateNotes) {
        const { itemId, notes: itemNotes } = updateNotes;

        const itemToUpdate = await tx.orderItem.findFirst({
          where: { id: itemId, orderId: id },
          include: { menuItem: { select: { name: true } } },
        });

        if (!itemToUpdate) {
          throw new Error(`Order item not found: ${itemId}`);
        }

        await tx.orderItem.update({
          where: { id: itemId },
          data: { notes: itemNotes },
        });

        changes.push(`Updated notes for ${itemToUpdate.menuItem.name}`);
      }

      // 5. Update order notes
      const notesUpdateData: Record<string, unknown> = {};
      if (notes !== undefined) {
        notesUpdateData.notes = notes;
        changes.push(`Updated order notes`);
      }

      // Recalculate order totals
      const currentItems = await tx.orderItem.findMany({
        where: { orderId: id },
        include: { menuItem: { select: { price: true, name: true } } },
      });

      if (currentItems.length === 0) {
        throw new Error('Order must have at least one item');
      }

      let newSubtotal = 0;
      for (const item of currentItems) {
        newSubtotal += item.totalAmount;
      }

      // Round subtotal
      newSubtotal = Math.round(newSubtotal * 100) / 100;

      // Calculate taxes
      let newTaxes = 0;
      const property = existingOrder.property;
      if (property.taxComponents) {
        try {
          const taxComponents = JSON.parse(property.taxComponents);
          for (const component of taxComponents) {
            newTaxes += newSubtotal * (component.rate / 100);
          }
        } catch {
          const taxRate = property.defaultTaxRate || 0;
          newTaxes = newSubtotal * (taxRate / 100);
        }
      } else {
        const taxRate = property.defaultTaxRate || 0;
        newTaxes = newSubtotal * (taxRate / 100);
      }

      // Round taxes
      newTaxes = Math.round(newTaxes * 100) / 100;

      // Service charge (on subtotal, pre-tax)
      let serviceCharge = 0;
      if (property.serviceChargePercent) {
        serviceCharge = Math.round(newSubtotal * (property.serviceChargePercent / 100) * 100) / 100;
      }

      const newTotalAmount = Math.round((newSubtotal + newTaxes + serviceCharge) * 100) / 100;

      // Update the order
      const order = await tx.order.update({
        where: { id },
        data: {
          subtotal: newSubtotal,
          taxes: newTaxes,
          totalAmount: newTotalAmount,
          ...notesUpdateData,
        },
        include: {
          table: {
            select: { id: true, number: true, name: true, area: true },
          },
          items: {
            include: {
              menuItem: {
                select: { id: true, name: true, price: true, imageUrl: true },
              },
            },
          },
        },
      });

      // Sync updated charges to folio if this order has already been posted
      if (existingOrder.folioId) {
        const targetFolioId = existingOrder.folioId;

        // Delete old folio line items for this order
        await tx.folioLineItem.deleteMany({
          where: {
            folioId: targetFolioId,
            OR: [
              {
                referenceType: 'order_item',
                referenceId: { in: oldItemsSnapshot.map((i) => i.id) },
              },
              {
                referenceType: 'order',
                referenceId: existingOrder.id,
                category: 'service',
              },
            ],
          },
        });

        // Calculate proportional tax rate from the updated order
        const taxRate = newSubtotal > 0 ? newTaxes / newSubtotal : 0;
        const serviceChargeRate = newSubtotal > 0
          ? (newTotalAmount - newSubtotal - newTaxes) / newSubtotal
          : 0;

        // Create new folio line items for each current order item
        const newLineItemsData = currentItems.map((item) => ({
          folioId: targetFolioId,
          description: `${item.menuItem?.name || 'Item'}${item.notes ? ` (${item.notes})` : ''}`,
          category: 'restaurant' as const,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalAmount: item.totalAmount,
          taxAmount: Math.round(item.totalAmount * taxRate * 100) / 100,
          serviceDate: existingOrder.createdAt,
          referenceType: 'order_item',
          referenceId: item.id,
          postedBy: 'system',
        }));

        await tx.folioLineItem.createMany({ data: newLineItemsData });

        // Create service charge line item if applicable
        if (serviceChargeRate > 0) {
          const scAmount = Math.round(newSubtotal * serviceChargeRate * 100) / 100;
          if (scAmount > 0) {
            await tx.folioLineItem.create({
              data: {
                folioId: targetFolioId,
                description: `Service Charge on Order ${existingOrder.orderNumber}`,
                category: 'service' as const,
                quantity: 1,
                unitPrice: scAmount,
                totalAmount: scAmount,
                taxAmount: 0,
                serviceDate: existingOrder.createdAt,
                referenceType: 'order',
                referenceId: existingOrder.id,
                postedBy: 'system',
              },
            });
          }
        }

        // Recalculate folio totals from all line items
        const allFolioLineItems = await tx.folioLineItem.findMany({
          where: { folioId: targetFolioId },
        });

        const folioSubtotal = allFolioLineItems.reduce((sum, li) => sum + li.totalAmount, 0);
        const folioTaxes = allFolioLineItems.reduce((sum, li) => sum + li.taxAmount, 0);
        const folioRecord = await tx.folio.findUnique({ where: { id: targetFolioId } });

        if (folioRecord) {
          const folioTotal = folioSubtotal + folioTaxes - (folioRecord.discount || 0);
          await tx.folio.update({
            where: { id: targetFolioId },
            data: {
              subtotal: Math.round(folioSubtotal * 100) / 100,
              taxes: Math.round(folioTaxes * 100) / 100,
              totalAmount: Math.round(folioTotal * 100) / 100,
              balance: Math.round((folioTotal - folioRecord.paidAmount) * 100) / 100,
            },
          });
        }
      }

      return order;
    });

    // Create audit log entry
    try {
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'restaurant',
          action: 'order_edited',
          entityType: 'Order',
          entityId: existingOrder.id,
          oldValue: JSON.stringify(oldItemsSnapshot),
          newValue: JSON.stringify({
            changes,
            previousTotal: existingOrder.totalAmount,
            newTotal: updatedOrder.totalAmount,
          }),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    // Notify realtime service via WebSocket
    fetch(`/?XTransformPort=3003`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'kitchen:order',
        data: {
          orderId: updatedOrder.id,
          propertyId: updatedOrder.propertyId,
          orderNumber: updatedOrder.orderNumber,
          kitchenStatus: updatedOrder.kitchenStatus,
          status: updatedOrder.status,
          items: updatedOrder.items?.map((item) => ({
            id: item.id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            name: item.menuItem?.name,
          })),
        },
      }),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      changes,
    });
  } catch (error) {
    console.error('Error editing order:', error);
    const message = error instanceof Error ? error.message : 'Failed to edit order';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: error instanceof Error && message.includes('not found') ? 400 : 500 }
    );
  }
}
