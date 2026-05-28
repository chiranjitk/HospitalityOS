import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';
import { nullifyEmptyStrings } from '@/lib/nullify-empty-strings';
import { auditLogService } from '@/lib/services/audit-service';

// Helper function to generate order number
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 3);
  return `ORD-${timestamp}-${random}`;
}

// GET /api/orders - List all orders with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'restaurant.read') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const tableId = searchParams.get('tableId');
    const status = searchParams.get('status');
    const kitchenStatus = searchParams.get('kitchenStatus');
    const orderType = searchParams.get('orderType');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const offset = searchParams.get('offset');
    const stats = searchParams.get('stats');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    // Property scoping
    if (propertyId) {
      // Verify property belongs to user's tenant
      const property = await db.property.findFirst({
        where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!property) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
          { status: 400 }
        );
      }
      where.propertyId = propertyId;
    }

    if (tableId) {
      where.tableId = tableId;
    }

    if (status) {
      const statuses = status.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else if (statuses.length > 1) {
        where.status = { in: statuses };
      }
    }

    if (kitchenStatus) {
      const kitchenStatuses = kitchenStatus.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (kitchenStatuses.length === 1) {
        where.kitchenStatus = kitchenStatuses[0];
      } else if (kitchenStatuses.length > 1) {
        where.kitchenStatus = { in: kitchenStatuses };
      }
    }

    if (orderType) {
      where.orderType = orderType;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { guestName: { contains: search } },
      ];
    }

    // If stats flag is set, return summary statistics
    if (stats === 'true') {
      const statusCounts = await db.order.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      });

      const kitchenStatusCounts = await db.order.groupBy({
        by: ['kitchenStatus'],
        where,
        _count: { id: true },
      });

      const totalRevenue = await db.order.aggregate({
        where: { ...where, status: { notIn: ['cancelled'] } },
        _sum: { totalAmount: true },
      });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayOrders = await db.order.count({
        where: {
          ...where,
          createdAt: { gte: todayStart },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          statusCounts: statusCounts.reduce((acc, item) => {
            acc[item.status] = item._count.id;
            return acc;
          }, {} as Record<string, number>),
          kitchenStatusCounts: kitchenStatusCounts.reduce((acc, item) => {
            acc[item.kitchenStatus] = item._count.id;
            return acc;
          }, {} as Record<string, number>),
          totalRevenue: totalRevenue._sum.totalAmount || 0,
          todayOrders,
        },
      });
    }

    const orders = await db.order.findMany({
      where,
      include: {
        table: {
          select: {
            id: true,
            number: true,
            name: true,
            area: true,
          },
        },
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
                preparationTime: true,
                kitchenStation: true,
              },
            },
          },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.order.count({ where });

    return NextResponse.json({
      success: true,
      data: orders,
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch orders' } },
      { status: 500 }
    );
  }
}

// POST /api/orders - Create a new order
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = nullifyEmptyStrings(body);

    const {
      propertyId,
      tableId,
      guestId,
      bookingId,
      guestName,
      orderType = 'dine_in',
      notes,
      specialInstructions,
      items,
    } = data;

    // Validate required fields
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Order must have at least one item' } },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true, defaultTaxRate: true, taxComponents: true, serviceChargePercent: true },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
        { status: 400 }
      );
    }

    // If table is specified, verify it belongs to the property
    if (tableId) {
      const table = await db.restaurantTable.findFirst({
        where: { id: tableId, propertyId },
      });

      if (!table) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_TABLE', message: 'Table not found' } },
          { status: 400 }
        );
      }
    }

    // Get menu items to calculate totals (filter out undefined IDs)
    const menuItemIds = items.map((item: { menuItemId?: string }) => item.menuItemId).filter(Boolean);
    const menuItems = menuItemIds.length > 0
      ? await db.menuItem.findMany({
          where: { id: { in: menuItemIds }, propertyId, deletedAt: null },
        })
      : [];

    // CRITICAL-14: Pre-fetch all modifier options for this property to apply pricing
    const allModifierOptions = await db.menuModifierOption.findMany({
      where: { propertyId, isAvailable: true },
      select: { id: true, priceAdjustment: true },
    });
    const modifierOptionsMap = new Map(allModifierOptions.map(o => [o.id, o]));

    // Validate menu items that have a menuItemId (skip custom items without one)
    for (const item of items) {
      if (!item.menuItemId) continue; // Custom item — no menu validation needed
      const menuItem = menuItems.find(m => m.id === item.menuItemId);
      if (!menuItem) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_MENU_ITEM', message: `Menu item not found: ${item.menuItemId}` } },
          { status: 400 }
        );
      }
      if (!menuItem.isAvailable) {
        return NextResponse.json(
          { success: false, error: { code: 'ITEM_UNAVAILABLE', message: `Menu item is not available: ${menuItem.name}` } },
          { status: 400 }
        );
      }
    }

    // Calculate subtotal and build order items data
    let subtotal = 0;
    const orderItemsData = items.map((item: { menuItemId?: string; quantity?: number; unitPrice?: number; price?: number; name?: string; notes?: string; options?: string; modifiers?: unknown[] }) => {
      const menuItem = item.menuItemId ? menuItems.find(m => m.id === item.menuItemId) : null;
      const quantity = item.quantity || 1;

      // Validate quantity bounds
      if (quantity < 1 || quantity > 100) {
        throw new Error(`Invalid quantity ${quantity}. Quantity must be between 1 and 100.`);
      }

      // Use menuItem price if available, otherwise fall back to item's price/unitPrice
      // M-53: IMPORTANT — unitPrice is snapshot at order time from the current menuItem.price.
      // This ensures historical orders are not affected by future menu price changes.
      // If menuItem is null (manual order), the client-supplied unitPrice is used.
      let unitPrice = menuItem?.price || item.unitPrice || item.price || 0;

      // CRITICAL-14 FIX: Apply modifier pricing adjustments
      // Parse options/modifiers and add priceAdjustment from MenuModifierOption
      let modifierPriceAdjustment = 0;
      const rawOptions = item.options || item.modifiers;
      const modifierIds: string[] = [];
      if (rawOptions) {
        try {
          const parsed = typeof rawOptions === 'string' ? JSON.parse(rawOptions) : rawOptions;
          if (Array.isArray(parsed)) {
            for (const opt of parsed) {
              if (opt?.optionId || opt?.id) modifierIds.push(opt.optionId || opt.id);
            }
          }
        } catch { /* options not parseable, skip modifier pricing */ }
      }
      // Batch-lookup modifier option prices
      if (modifierIds.length > 0) {
        for (const optId of modifierIds) {
          const modOption = modifierOptionsMap.get(optId);
          if (modOption) modifierPriceAdjustment += modOption.priceAdjustment || 0;
        }
      }
      unitPrice = Math.round((unitPrice + modifierPriceAdjustment) * 100) / 100;

      const totalAmount = Math.round(unitPrice * quantity * 100) / 100;
      subtotal += totalAmount;

      return {
        menuItemId: item.menuItemId || null,
        itemName: menuItem?.name || item.name || null,
        quantity,
        unitPrice,
        totalAmount: Math.round(totalAmount * 100) / 100,
        notes: item.notes,
        options: item.options,
        status: 'pending',
      };
    });

    // Round subtotal to 2 decimal places
    subtotal = Math.round(subtotal * 100) / 100;

    // Calculate taxes from property settings
    let taxes = 0;
    
    // Check if property has tax components (multiple taxes)
    if (property.taxComponents) {
      try {
        const taxComponents = JSON.parse(property.taxComponents);
        for (const component of taxComponents) {
          taxes += Math.round(subtotal * (component.rate / 100) * 100) / 100;
        }
      } catch {
        // Fallback to default tax rate
        const taxRate = property.defaultTaxRate || 0;
        taxes = Math.round(subtotal * (taxRate / 100) * 100) / 100;
      }
    } else {
      // Use default tax rate
      const taxRate = property.defaultTaxRate || 0;
      taxes = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    }

    // Round taxes to 2 decimal places
    taxes = Math.round(taxes * 100) / 100;

    // Add service charge if configured (on subtotal, pre-tax)
    let serviceCharge = 0;
    if (property.serviceChargePercent) {
      serviceCharge = Math.round(subtotal * (property.serviceChargePercent / 100) * 100) / 100;
    }

    const totalAmount = Math.round((subtotal + taxes + serviceCharge) * 100) / 100;

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Create order with items in a transaction
    const order = await db.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tenantId: user.tenantId,
          propertyId,
          tableId,
          guestId: guestId || null,
          bookingId: bookingId || null,
          guestName,
          orderType,
          orderNumber,
          subtotal,
          taxes,
          serviceCharge,
          totalAmount,
          notes,
          specialInstructions,
          status: 'pending',
          kitchenStatus: 'pending',
        },
      });

      // Create order items
      await tx.orderItem.createMany({
        data: orderItemsData.map(item => ({
          ...item,
          orderId: newOrder.id,
        })),
      });

      // Update table status if it's a dine-in order
      if (tableId && orderType === 'dine_in') {
        await tx.restaurantTable.update({
          where: { id: tableId },
          data: { status: 'occupied' },
        });
      }

      return newOrder;
    });

    // Fetch the complete order with items
    const completeOrder = await db.order.findUnique({
      where: { id: order.id },
      include: {
        table: true,
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!completeOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Notify realtime service via WebSocket
    fetch(`/?XTransformPort=3003`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'kitchen:order',
        data: {
          orderId: completeOrder.id,
          propertyId,
          orderNumber,
          kitchenStatus: 'pending',
          status: 'pending',
          items: completeOrder.items?.map((item: { id: string; menuItemId: string; quantity: number; menuItem?: { name: string } }) => ({
            id: item.id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            name: item.menuItem?.name,
          })),
        },
      }),
    }).catch(() => {});

    // Audit log
    try {
      await auditLogService.logWithContext(
        {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'create',
          entityType: 'order',
          entityId: completeOrder.id,
          newValue: {
            orderNumber: completeOrder.orderNumber,
            propertyId,
            tableId,
            guestId,
            bookingId,
            guestName,
            orderType,
            subtotal,
            taxes,
            totalAmount,
            itemCount: items.length,
          },
          description: `Created order ${completeOrder.orderNumber} (${orderType}, ${items.length} items, total: ${totalAmount})`,
        },
        request
      );
    } catch (auditError) {
      console.error('[Orders POST] Audit log failed:', auditError);
    }

    return NextResponse.json({ success: true, data: completeOrder }, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create order' } },
      { status: 500 }
    );
  }
}

// PUT /api/orders - Update order status
export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, status, kitchenStatus, notes } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Order ID is required' } },
        { status: 400 }
      );
    }

    // Verify order exists and belongs to user's tenant
    const existingOrder = await db.order.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
        { status: 404 }
      );
    }

    // Validate status transitions
    const validStatusTransitions: Record<string, string[]> = {
      pending: ['confirmed', 'preparing', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['served', 'cancelled'],
      served: ['paid', 'completed', 'cancelled'],
      completed: ['paid', 'cancelled'],
      cancelled: [],
      paid: [],
    };

    if (status && !validStatusTransitions[existingOrder.status]?.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot transition from ${existingOrder.status} to ${status}` } },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;

      // Set timestamps based on status
      if (status === 'confirmed') {
        updateData.confirmedAt = new Date();
      } else if (status === 'served') {
        updateData.completedAt = new Date();
      } else if (status === 'cancelled') {
        updateData.cancelledAt = new Date();
      }
    }

    if (kitchenStatus) {
      updateData.kitchenStatus = kitchenStatus;

      if (kitchenStatus === 'cooking') {
        updateData.kitchenStartedAt = new Date();
      } else if (kitchenStatus === 'ready') {
        updateData.kitchenCompletedAt = new Date();
      } else if (kitchenStatus === 'completed') {
        updateData.kitchenCompletedAt = updateData.kitchenCompletedAt || new Date();
        updateData.status = 'served';
        updateData.completedAt = new Date();
      }
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const order = await db.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: updateData,
        include: {
          table: true,
          items: {
            include: {
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                },
              },
            },
          },
        },
      });

      // M-52: Auto-advance parent order status to 'completed' when all child items
      // are in a terminal state (served or completed). This ensures the order
      // lifecycle accurately reflects that all work is done.
      if (updated.items && updated.items.length > 0) {
        const allItemsTerminal = updated.items.every(
          (item: { status: string }) => item.status === 'served' || item.status === 'completed'
        );
        if (allItemsTerminal && updated.status !== 'completed' && updated.status !== 'cancelled' && updated.status !== 'paid') {
          const autoAdvanced = await tx.order.update({
            where: { id },
            data: {
              status: 'completed',
              completedAt: updated.completedAt || new Date(),
            },
            include: updated.items ? {
              table: true,
              items: {
                include: {
                  menuItem: {
                    select: { id: true, name: true, price: true },
                  },
                },
              },
            } : undefined,
          });
          // If order is completed, update table status
          if (autoAdvanced.tableId) {
            await tx.restaurantTable.update({
              where: { id: autoAdvanced.tableId },
              data: { status: 'cleaning' },
            });
          }
          return autoAdvanced;
        }
      }

      // If order is served or cancelled, update table status within same transaction
      if ((status === 'served' || status === 'cancelled') && updated.tableId) {
        await tx.restaurantTable.update({
          where: { id: updated.tableId },
          data: { status: status === 'served' ? 'cleaning' : 'available' },
        });
      }

      return updated;
    });

    // Notify realtime service via WebSocket
    fetch(`/?XTransformPort=3003`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'kitchen:order',
        data: {
          orderId: order.id,
          propertyId: order.propertyId,
          orderNumber: order.orderNumber,
          kitchenStatus: order.kitchenStatus,
          status: order.status,
          items: order.items?.map((item: { id: string; menuItemId: string; quantity: number; menuItem?: { name: string } }) => ({
            id: item.id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            name: item.menuItem?.name,
          })),
        },
      }),
    }).catch(() => {});

    // Audit log
    try {
      await auditLogService.logWithContext(
        {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'update',
          entityType: 'order',
          entityId: order.id,
          oldValue: {
            status: existingOrder.status,
            kitchenStatus: existingOrder.kitchenStatus,
            notes: existingOrder.notes,
          },
          newValue: {
            status: order.status,
            kitchenStatus: order.kitchenStatus,
            notes: order.notes,
          },
          description: `Updated order ${order.orderNumber}: status ${existingOrder.status} → ${order.status}, kitchen ${existingOrder.kitchenStatus} → ${order.kitchenStatus}`,
        },
        request
      );
    } catch (auditError) {
      console.error('[Orders PUT] Audit log failed:', auditError);
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update order' } },
      { status: 500 }
    );
  }
}

// DELETE /api/orders - Cancel an order
export async function DELETE(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Order ID is required' } },
        { status: 400 }
      );
    }

    // Verify order exists and belongs to user's tenant
    const existingOrder = await db.order.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
        { status: 404 }
      );
    }

    // Can only cancel orders that are not already served, cancelled, paid, or refunded
    if (['served', 'cancelled', 'paid', 'refunded'].includes(existingOrder.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'CANNOT_CANCEL', message: `Cannot cancel an order with status: ${existingOrder.status}. Use the refund endpoint for paid orders.` } },
        { status: 400 }
      );
    }

    const order = await db.order.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    });

    // C-2: If the order was posted to a folio, reverse the charges
    if (existingOrder.folioId) {
      try {
        // Remove folio line items for this order
        const deletedItems = await db.folioLineItem.deleteMany({
          where: {
            OR: [
              { reference: `order-${id}` },
              { referenceType: 'order', referenceId: id },
              { referenceType: 'order_item', referenceId: { in: (await db.orderItem.findMany({ where: { orderId: id }, select: { id: true } })).map(i => i.id) } },
            ],
            folioId: existingOrder.folioId,
          },
        });

        // Recalculate folio totals
        const remainingItems = await db.folioLineItem.findMany({ where: { folioId: existingOrder.folioId } });
        const newSubtotal = remainingItems.reduce((sum, li) => sum + li.totalAmount, 0);
        const newTaxes = remainingItems.reduce((sum, li) => sum + li.taxAmount, 0);
        const folioRecord = await db.folio.findUnique({ where: { id: existingOrder.folioId } });
        if (folioRecord) {
          const newTotal = newSubtotal + newTaxes - (folioRecord.discount || 0);
          await db.folio.update({
            where: { id: existingOrder.folioId },
            data: {
              subtotal: newSubtotal,
              taxes: newTaxes,
              totalAmount: newTotal,
              balance: newTotal - (folioRecord.paidAmount || 0),
            },
          });
        }

        // Unlink order from folio
        await db.order.update({
          where: { id },
          data: { folioId: null },
        });

        if (deletedItems.count > 0) {
          console.log(`[Orders DELETE] Reversed ${deletedItems.count} folio line items for cancelled order ${existingOrder.orderNumber}`);
        }
      } catch (folioError) {
        console.error('[Orders DELETE] Error reversing folio charges:', folioError);
        // Don't fail the cancellation — log the error
      }
    }

    // Update table status if applicable
    if (order.tableId) {
      await db.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: 'available' },
      });
    }

    // Audit log
    try {
      await auditLogService.logWithContext(
        {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'delete',
          entityType: 'order',
          entityId: order.id,
          oldValue: {
            orderNumber: order.orderNumber,
            status: existingOrder.status,
            kitchenStatus: existingOrder.kitchenStatus,
            totalAmount: order.totalAmount,
            orderType: order.orderType,
          },
          description: `Cancelled order ${order.orderNumber} (was ${existingOrder.status}, total: ${order.totalAmount})`,
        },
        request
      );
    } catch (auditError) {
      console.error('[Orders DELETE] Audit log failed:', auditError);
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel order' } },
      { status: 500 }
    );
  }
}
