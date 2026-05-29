import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';

const availableDrivers: Record<string, { name: string; role: string }> = {
  '1': { name: 'Raj K.', role: 'Driver' },
  '2': { name: 'Priya S.', role: 'Driver' },
  '3': { name: 'Amit M.', role: 'Bellboy' },
  '4': { name: 'Sunita R.', role: 'Driver' },
};

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { orderId, driverId, estimatedMinutes } = body;

    if (!orderId || !driverId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Order ID and Driver ID are required' } },
        { status: 400 },
      );
    }

    const driver = availableDrivers[driverId];
    if (!driver) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid driver ID' } },
        { status: 400 },
      );
    }

    // Fetch and validate the order
    const existing = await db.order.findFirst({
      where: { id: orderId, tenantId: user.tenantId, orderType: 'room_service' },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
        { status: 404 },
      );
    }

    if (existing.status !== 'preparing') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Order must be in "preparing" status to dispatch' } },
        { status: 400 },
      );
    }

    const eta = typeof estimatedMinutes === 'number' ? estimatedMinutes : 25;

    // Update order status to in_transit and store driver assignment info in notes/meta
    const order = await db.order.update({
      where: { id: orderId },
      data: {
        status: 'in_transit',
        estimatedDelivery: eta,
        specialInstructions: existing.specialInstructions
          ? `${existing.specialInstructions}\n[Driver: ${driver.name} (${driver.role}), ETA: ${eta}min, Assigned: ${new Date().toISOString()}]`
          : `[Driver: ${driver.name} (${driver.role}), ETA: ${eta}min, Assigned: ${new Date().toISOString()}]`,
      },
    });

    // Audit log
    try {
      await auditLogService.logWithContext(
        {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'restaurant',
          action: 'update',
          entityType: 'order',
          entityId: order.id,
          newValue: {
            status: 'in_transit',
            driverId,
            driverName: driver.name,
            driverRole: driver.role,
            estimatedMinutes: eta,
          },
          description: `Dispatched order ${order.orderNumber} to ${driver.name} (${driver.role}), ETA ${eta} min`,
        },
        request,
      );
    } catch (auditError) {
      console.error('[DriverAssign] Audit log failed:', auditError);
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        driver: {
          id: driverId,
          name: driver.name,
          role: driver.role,
        },
        estimatedMinutes: eta,
        assignedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error assigning driver:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to assign driver' } },
      { status: 500 },
    );
  }
}
