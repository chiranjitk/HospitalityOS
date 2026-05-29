import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';
import { z } from 'zod';

// GET /api/group-bookings/[id]/folio/payments — List all payments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }
  if (
    !hasAnyPermission(user, [
      'bookings.manage',
      'billing.manage',
      'admin.bookings',
      'admin.billing',
      'admin.*',
    ])
  ) {
    return NextResponse.json(
      { success: false, error: 'Permission denied' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    // Verify group booking and folio exist
    const folio = await db.groupFolio.findFirst({
      where: { groupBookingId: id, tenantId: user.tenantId },
    });

    if (!folio) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Group folio not found' },
        },
        { status: 404 }
      );
    }

    const payments = await db.groupFolioPayment.findMany({
      where: { groupFolioId: folio.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: payments });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch folio payments',
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/group-bookings/[id]/folio/payments — Record a payment
const paymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  method: z.enum([
    'cash',
    'credit_card',
    'debit_card',
    'bank_transfer',
    'upi',
    'wallet',
    'cheque',
    'complementary',
    'room_charge',
  ]),
  reference: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }
  if (
    !hasAnyPermission(user, [
      'bookings.manage',
      'billing.manage',
      'admin.bookings',
      'admin.billing',
      'admin.*',
    ])
  ) {
    return NextResponse.json(
      { success: false, error: 'Permission denied' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues.map((i) => i.message).join(', '),
          },
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Verify group booking and folio exist
    const folio = await db.groupFolio.findFirst({
      where: { groupBookingId: id, tenantId: user.tenantId },
      include: {
        groupBooking: {
          select: { id: true, propertyId: true },
        },
      },
    });

    if (!folio) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Group folio not found' },
        },
        { status: 404 }
      );
    }

    if (folio.status === 'closed') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FOLIO_CLOSED',
            message: 'Cannot record payments on a closed folio',
          },
        },
        { status: 400 }
      );
    }

    const safeAmount = Math.round(input.amount * 100) / 100;

    // Record payment and recalculate totals in a transaction
    const [paymentRecord, updatedFolio] = await db.$transaction(
      async (tx) => {
        // Create payment record
        const payment = await tx.groupFolioPayment.create({
          data: {
            tenantId: user.tenantId,
            propertyId: folio.groupBooking.propertyId,
            groupFolioId: folio.id,
            amount: safeAmount,
            method: input.method,
            status: 'completed',
            reference: input.reference || null,
            description: input.description || null,
            processedBy: user.id,
          },
        });

        // Recalculate folio totals
        const updated = await recalculateTotalsInTx(tx, folio.id, id);

        return [payment, updated];
      }
    );

    // Distribute payment to child booking folios proportionally
    try {
      const childBookings = await db.booking.findMany({
        where: {
          groupId: id,
          status: { not: 'cancelled' },
          deletedAt: null,
        },
        select: { id: true },
      });

      const bookingIds = childBookings.map((b) => b.id);

      const childFolios = await db.folio.findMany({
        where: {
          bookingId: { in: bookingIds },
          status: { in: ['open', 'partially_paid'] },
        },
        select: { id: true, balance: true },
        orderBy: { balance: 'desc' },
      });

      const totalChildBalance = childFolios.reduce(
        (sum, f) => sum + Math.max(0, f.balance),
        0
      );

      if (totalChildBalance > 0 && childFolios.length > 0) {
        let remaining = safeAmount;
        for (const childFolio of childFolios) {
          if (remaining <= 0.005) break;
          const folioBalance = Math.max(0, childFolio.balance);
          if (folioBalance <= 0) continue;

          const proportionalShare =
            Math.round(
              (safeAmount * folioBalance) / totalChildBalance * 100
            ) / 100;
          const allocation = Math.min(
            proportionalShare,
            remaining,
            folioBalance
          );

          if (allocation > 0) {
            await db.folio.update({
              where: { id: childFolio.id },
              data: {
                paidAmount: { increment: allocation },
                balance: { decrement: allocation },
                status:
                  childFolio.balance - allocation <= 0
                    ? 'paid'
                    : 'partially_paid',
              },
            });
            remaining -= allocation;
          }
        }
      }
    } catch (_e) {
      /* Distribution failure is non-fatal */
    }

    // Audit log
    try {
      await auditLogService.logWithContext(
        {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'payment',
          entityType: 'group_folio_payment',
          entityId: paymentRecord.id,
          newValue: {
            amount: paymentRecord.amount,
            method: paymentRecord.method,
            reference: paymentRecord.reference,
          },
          description: `Recorded payment of ${safeAmount} via ${input.method} on group folio`,
        },
        request
      );
    } catch (_e) {
      /* non-fatal */
    }

    return NextResponse.json({
      success: true,
      data: { payment: paymentRecord, folio: updatedFolio },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to record payment',
        },
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helper: recalculate folio totals within a transaction
// ---------------------------------------------------------------------------
async function recalculateTotalsInTx(
  tx: typeof db,
  groupFolioId: string,
  groupBookingId: string
) {
  const folio = await tx.groupFolio.findUnique({
    where: { id: groupFolioId },
    select: { id: true, groupBookingId: true },
  });

  if (!folio) throw new Error('GROUP_FOLIO_NOT_FOUND');

  // Fetch child bookings
  const childBookings = await tx.booking.findMany({
    where: {
      groupId: groupBookingId,
      status: { not: 'cancelled' },
      deletedAt: null,
    },
    select: { id: true },
  });

  const bookingIds = childBookings.map((b) => b.id);

  // Sum child folios
  const folioAgg = await tx.folio.groupBy({
    by: ['bookingId'],
    where: { bookingId: { in: bookingIds } },
    _sum: { subtotal: true, taxes: true, totalAmount: true, paidAmount: true },
  });

  let aggregatedSubtotal = 0;
  let aggregatedTaxes = 0;
  let aggregatedTotal = 0;
  let aggregatedPaid = 0;

  for (const row of folioAgg) {
    aggregatedSubtotal += row._sum.subtotal ?? 0;
    aggregatedTaxes += row._sum.taxes ?? 0;
    aggregatedTotal += row._sum.totalAmount ?? 0;
    aggregatedPaid += row._sum.paidAmount ?? 0;
  }

  // Sum group folio line items
  const itemsAgg = await tx.groupFolioItem.aggregate({
    where: { groupFolioId },
    _sum: { totalAmount: true, taxAmount: true },
  });
  const itemSubtotal = itemsAgg._sum.totalAmount ?? 0;
  const itemTax = itemsAgg._sum.taxAmount ?? 0;

  // Sum payments
  const paymentsAgg = await tx.groupFolioPayment.aggregate({
    where: { groupFolioId, status: 'completed' },
    _sum: { amount: true },
  });
  const totalPayments = paymentsAgg._sum.amount ?? 0;

  // Combined totals
  const subtotal =
    Math.round((aggregatedSubtotal + itemSubtotal) * 100) / 100;
  const taxes = Math.round((aggregatedTaxes + itemTax) * 100) / 100;
  const totalAmount =
    Math.round((aggregatedTotal + itemSubtotal + itemTax) * 100) / 100;
  const paidAmount =
    Math.round((aggregatedPaid + totalPayments) * 100) / 100;
  const balance = Math.round(Math.max(0, totalAmount - paidAmount) * 100) / 100;

  // Derive status
  let status: string;
  if (balance <= 0 && totalAmount > 0) {
    status = 'paid';
  } else if (paidAmount > 0) {
    status = 'partially_paid';
  } else {
    status = 'open';
  }

  return tx.groupFolio.update({
    where: { id: groupFolioId },
    data: { subtotal, taxes, totalAmount, paidAmount, balance, status },
  });
}
