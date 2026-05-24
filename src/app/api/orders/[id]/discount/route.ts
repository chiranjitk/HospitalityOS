import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';

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

    // H-5: Track updated total for audit log
    let finalTotalAmount: number;

    await db.$transaction(async (tx) => {
      await tx.orderDiscount.create({
        data: { tenantId: user.tenantId, orderId: id, type, value, reason, couponCode, authorizedBy },
      });

      const existingDiscounts = await tx.orderDiscount.findMany({ where: { orderId: id } });
      const totalDiscount = existingDiscounts.reduce((sum: number, d: { value: number; type: string }) => {
        return sum + (d.type === 'percentage' ? (order.subtotal * d.value) / 100 : d.value);
      }, 0);

      finalTotalAmount = Math.max(order.subtotal + order.taxes - totalDiscount, 0);
      await tx.order.update({
        where: { id },
        data: { discount: totalDiscount, totalAmount: finalTotalAmount },
      });

      // H-5 FIX: Instead of overwriting the entire folio discount,
      // create a separate discount line item scoped to this order's folio items only.
      // This prevents the discount from affecting non-restaurant charges (room, minibar, etc.)
      if (order.folioId) {
        const folioRecord = await tx.folio.findUnique({ where: { id: order.folioId } });
        if (folioRecord && folioRecord.status !== 'closed') {
          // Create a negative line item for the discount
          await tx.folioLineItem.create({
            data: {
              folioId: order.folioId,
              description: `Discount on Order ${order.orderNumber}: ${type} ${value}${reason ? ` (${reason})` : ''}`,
              category: 'discount',
              quantity: 1,
              unitPrice: -discountAmount,
              totalAmount: -discountAmount,
              taxAmount: 0,
              serviceDate: new Date(),
              referenceType: 'order',
              referenceId: id,
              postedBy: `user:${user.id}`,
            },
          });

          // Recalculate folio totals from all line items (standard pattern)
          const allLineItems = await tx.folioLineItem.findMany({ where: { folioId: order.folioId } });
          const newSubtotal = allLineItems.reduce((sum: number, li: { totalAmount: number }) => sum + li.totalAmount, 0);
          const newTaxes = allLineItems.reduce((sum: number, li: { taxAmount: number }) => sum + (li.taxAmount || 0), 0);
          const newTotal = newSubtotal + newTaxes - (folioRecord.discount || 0);

          await tx.folio.update({
            where: { id: order.folioId },
            data: {
              subtotal: newSubtotal,
              taxes: newTaxes,
              totalAmount: newTotal,
              balance: newTotal - (folioRecord.paidAmount || 0),
            },
          });
        }
      }
    });

    // H-4: Audit log for discount application
    try {
      await auditLogService.logWithContext({
        tenantId: user.tenantId, userId: user.id, module: 'billing', action: 'update',
        entityType: 'order', entityId: id,
        newValue: { type, value, discountAmount, reason, couponCode, authorizedBy, newTotalAmount: finalTotalAmount },
        description: `Discount applied to order: ${type} ${value} (${discountAmount}) - ${reason}`,
      }, request);
    } catch (auditError) {
      console.error('[Orders Discount] Audit log failed:', auditError);
    }

    const updated = await db.order.findUnique({ where: { id }, include: { orderDiscounts: true } });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error applying discount:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
