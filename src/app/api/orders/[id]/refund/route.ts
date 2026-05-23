import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';

// POST /api/orders/[id]/refund - Refund a paid order
export async function POST(
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

    // Require restaurant.write OR billing.write permission
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'billing.write')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id: orderId } = await params;
    const body = await request.json();
    const { refundAmount, reason } = body;

    // Fetch order
    const order = await db.order.findFirst({
      where: { id: orderId, tenantId: user.tenantId },
      include: {
        property: {
          select: { id: true, currency: true },
        },
        payments: {
          where: { status: 'completed' },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
        { status: 404 }
      );
    }

    // Validate order status is 'paid'
    if (order.status !== 'paid') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Only paid orders can be refunded' } },
        { status: 400 }
      );
    }

    const effectiveRefundAmount = refundAmount ?? order.totalAmount;

    // Validate refund amount
    if (effectiveRefundAmount > order.totalAmount) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Refund amount ${effectiveRefundAmount} exceeds order total ${order.totalAmount}` } },
        { status: 400 }
      );
    }

    const currency = order.property?.currency || 'USD';
    const refundId = `refund-${orderId}-${Date.now()}`;

    // Process refund within transaction
    await db.$transaction(async (tx) => {
      // If order has a folio, create negative line item and adjust folio
      if (order.folioId) {
        const refundLineItem = await tx.folioLineItem.create({
          data: {
            folioId: order.folioId,
            description: reason ? `Refund for Order ${order.orderNumber}: ${reason}` : `Refund for Order ${order.orderNumber}`,
            category: 'refund',
            quantity: 1,
            unitPrice: -effectiveRefundAmount,
            totalAmount: -effectiveRefundAmount,
            taxAmount: 0,
            referenceType: 'order',
            referenceId: orderId,
            serviceDate: new Date(),
          },
        });

        // Recalculate folio totals
        const allLineItems = await tx.folioLineItem.findMany({ where: { folioId: order.folioId } });
        const newSubtotal = allLineItems.reduce((sum, li) => sum + li.totalAmount, 0);
        const newTaxes = allLineItems.reduce((sum, li) => sum + li.taxAmount, 0);
        const folioRecord = await tx.folio.findUnique({ where: { id: order.folioId } });
        const discount = folioRecord?.discount || 0;
        const newTotal = newSubtotal + newTaxes - discount;
        const paidAmount = folioRecord?.paidAmount || 0;

        // Reopen folio if it was closed
        await tx.folio.update({
          where: { id: order.folioId },
          data: {
            subtotal: newSubtotal,
            taxes: newTaxes,
            totalAmount: newTotal,
            balance: newTotal - paidAmount,
            ...(folioRecord?.status === 'closed' ? { status: 'open', closedAt: null } : {}),
          },
        });

        // Update refund line item audit
        await tx.folioLineItem.update({
          where: { id: refundLineItem.id },
          data: {
            description: refundLineItem.description,
          },
        });
      }

      // Mark payments as refunded
      if (order.payments.length > 0) {
        await tx.payment.updateMany({
          where: {
            id: { in: order.payments.map((p: { id: string }) => p.id) },
            status: 'completed',
          },
          data: {
            status: 'refunded',
            refundedAt: new Date(),
            refundAmount: effectiveRefundAmount / order.payments.length,
            refundReason: reason || 'Order refund',
          },
        });
      }

      // Update order status to refunded
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'refunded',
        },
      });
    });

    // Audit log
    try {
      await auditLogService.logWithContext({
        tenantId: user.tenantId,
        userId: user.id,
        module: 'billing',
        action: 'refund',
        entityType: 'order',
        entityId: orderId,
        newValue: {
          orderNumber: order.orderNumber,
          refundAmount: effectiveRefundAmount,
          currency,
          reason: reason || null,
          refundId,
        },
        description: `Refunded order ${order.orderNumber}: ${effectiveRefundAmount} ${currency}${reason ? ` (reason: ${reason})` : ''}`,
      }, request);
    } catch (auditError) {
      console.error('[Orders Refund] Audit log failed:', auditError);
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        orderNumber: order.orderNumber,
        refundAmount: effectiveRefundAmount,
        currency,
        refundId,
        refundedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error processing order refund:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process refund' } },
      { status: 500 }
    );
  }
}
