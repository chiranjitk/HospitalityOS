import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// Valid item-level statuses
const VALID_ITEM_STATUSES = ['pending', 'preparing', 'ready', 'served', 'cancelled'];

// PUT /api/orders/[id]/item-status - Update individual OrderItem status
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

    const { id: orderId } = await params;
    const body = await request.json();
    const { itemId, newStatus } = body;

    if (!itemId || !newStatus) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'itemId and newStatus are required' } },
        { status: 400 }
      );
    }

    if (!VALID_ITEM_STATUSES.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid status: ${newStatus}. Must be one of: ${VALID_ITEM_STATUSES.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // Verify order exists and belongs to user's tenant
    const existingOrder = await db.order.findFirst({
      where: { id: orderId, tenantId: user.tenantId },
      include: {
        items: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true, preparationTime: true, kitchenStation: true },
            },
          },
        },
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
        { status: 404 }
      );
    }

    // Verify the item belongs to this order
    const targetItem = existingOrder.items.find((item) => item.id === itemId);
    if (!targetItem) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Order item not found in this order' } },
        { status: 404 }
      );
    }

    const previousStatus = targetItem.status;

    // Prevent status transition to cancelled for served items
    if (previousStatus === 'served' && newStatus !== 'served') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Cannot change status of a served item' } },
        { status: 400 }
      );
    }

    // Update the item status
    const updatedItem = await db.orderItem.update({
      where: { id: itemId },
      data: {
        status: newStatus,
      },
      include: {
        menuItem: {
          select: { id: true, name: true, price: true, preparationTime: true, kitchenStation: true },
        },
        order: {
          select: { id: true, propertyId: true, orderNumber: true, status: true, kitchenStatus: true },
        },
      },
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'restaurant',
          action: 'item_status_changed',
          entityType: 'OrderItem',
          entityId: itemId,
          oldValue: JSON.stringify({ orderId, previousStatus }),
          newValue: JSON.stringify({ orderId, newStatus, itemName: targetItem.menuItem.name }),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    // Emit WebSocket event for real-time KDS update
    const eventData = {
      orderId: updatedItem.order.id,
      orderNumber: updatedItem.order.orderNumber,
      propertyId: updatedItem.order.propertyId,
      item: {
        id: updatedItem.id,
        menuItemId: updatedItem.menuItemId,
        name: updatedItem.menuItem.name,
        quantity: updatedItem.quantity,
        previousStatus,
        newStatus,
        preparationTime: updatedItem.menuItem.preparationTime,
        kitchenStation: updatedItem.menuItem.kitchenStation,
      },
      timestamp: new Date().toISOString(),
    };

    // Fire and forget WebSocket notification
    fetch(`/?XTransformPort=3003`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'kitchen:item-status',
        data: eventData,
      }),
    }).catch(() => {});

    // Also emit generic kitchen:order for broader compatibility
    fetch(`/?XTransformPort=3003`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'kitchen:order',
        data: {
          orderId: updatedItem.order.id,
          propertyId: updatedItem.order.propertyId,
          orderNumber: updatedItem.order.orderNumber,
          kitchenStatus: updatedItem.order.kitchenStatus,
          status: updatedItem.order.status,
        },
      }),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        item: updatedItem,
        previousStatus,
        newStatus,
      },
    });
  } catch (error) {
    console.error('Error updating item status:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update item status' } },
      { status: 500 }
    );
  }
}
