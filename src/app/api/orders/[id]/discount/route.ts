import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*'))
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { type, value, reason, couponCode, authorizedBy } = body;

    if (!type || !value || value <= 0 || !reason) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Type, value, and reason are required' } }, { status: 400 });
    }

    const order = await db.order.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!order) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });

    const discountAmount = type === 'percentage' ? (order.subtotal * value) / 100 : value;

    await db.$transaction(async (tx) => {
      await tx.orderDiscount.create({
        data: { tenantId: user.tenantId, orderId: id, type, value, reason, couponCode, authorizedBy },
      });

      const existingDiscounts = await tx.orderDiscount.findMany({ where: { orderId: id } });
      const totalDiscount = existingDiscounts.reduce((sum: number, d: { value: number; type: string }) => {
        return sum + (d.type === 'percentage' ? (order.subtotal * d.value) / 100 : d.value);
      }, 0);

      const newTotal = Math.max(order.subtotal + order.taxes - totalDiscount, 0);
      await tx.order.update({
        where: { id },
        data: { discount: totalDiscount, totalAmount: newTotal },
      });
    });

    const updated = await db.order.findUnique({ where: { id }, include: { orderDiscounts: true } });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error applying discount:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
