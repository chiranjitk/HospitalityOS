import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';
import { z } from 'zod';

// GET /api/group-bookings/[id]/folio — Get or auto-create group folio
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

    // Verify group booking exists and belongs to tenant
    const groupBooking = await db.groupBooking.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!groupBooking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group booking not found' } },
        { status: 404 }
      );
    }

    // Look for existing folio
    let folio = await db.groupFolio.findFirst({
      where: { groupBookingId: id },
      include: {
        folioItems: {
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Auto-create if not found
    if (!folio) {
      folio = await db.groupFolio.create({
        data: {
          tenantId: user.tenantId,
          propertyId: groupBooking.propertyId,
          groupBookingId: id,
          organizerGuestId: null,
          currency: 'USD',
        },
        include: {
          folioItems: {
            orderBy: { createdAt: 'desc' },
          },
          payments: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }

    return NextResponse.json({ success: true, data: folio });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch group folio' } },
      { status: 500 }
    );
  }
}

// POST /api/group-bookings/[id]/folio — Add a line item to the group folio
const addItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  category: z.string().optional().default('miscellaneous'),
  quantity: z.number().int().min(1).optional().default(1),
  unitPrice: z.number().min(0).optional().default(0),
  taxRate: z.number().min(0).optional().default(0),
  serviceDate: z.string().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
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

    // Validate input
    const parsed = addItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Get or create folio
    let folio = await db.groupFolio.findFirst({
      where: { groupBookingId: id, tenantId: user.tenantId },
    });

    if (!folio) {
      const groupBooking = await db.groupBooking.findFirst({
        where: { id, tenantId: user.tenantId },
      });
      if (!groupBooking) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Group booking not found' } },
          { status: 404 }
        );
      }
      folio = await db.groupFolio.create({
        data: {
          tenantId: user.tenantId,
          propertyId: groupBooking.propertyId,
          groupBookingId: id,
          currency: 'USD',
        },
      });
    }

    if (folio.status === 'closed') {
      return NextResponse.json(
        { success: false, error: { code: 'FOLIO_CLOSED', message: 'Cannot add items to a closed folio' } },
        { status: 400 }
      );
    }

    // Calculate amounts
    const quantity = input.quantity;
    const unitPrice = input.unitPrice;
    const totalAmount = Math.round(quantity * unitPrice * 100) / 100;
    const taxAmount = Math.round(totalAmount * (input.taxRate / 100) * 100) / 100;

    // Create item and recalculate totals in a transaction
    const [folioItem, updatedFolio] = await db.$transaction(async (tx) => {
      const item = await tx.groupFolioItem.create({
        data: {
          groupFolioId: folio!.id,
          description: input.description,
          category: input.category,
          quantity,
          unitPrice,
          totalAmount,
          taxRate: input.taxRate,
          taxAmount,
          serviceDate: input.serviceDate ? new Date(input.serviceDate) : new Date(),
          referenceType: input.referenceType || null,
          referenceId: input.referenceId || null,
          postedBy: user.id,
        },
      });

      // Recalculate folio totals
      const updated = await recalculateFolioTotalsTx(tx, folio!.id, id);

      return [item, updated];
    });

    // Audit log
    try {
      await auditLogService.logWithContext(
        {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'create',
          entityType: 'group_folio_item',
          entityId: folioItem.id,
          newValue: {
            description: folioItem.description,
            category: folioItem.category,
            quantity: folioItem.quantity,
            unitPrice: folioItem.unitPrice,
            totalAmount: folioItem.totalAmount,
          },
          description: `Added line item "${folioItem.description}" to group folio`,
        },
        request
      );
    } catch (_e) {
      /* non-fatal */
    }

    return NextResponse.json({ success: true, data: { item: folioItem, folio: updatedFolio } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add line item' } },
      { status: 500 }
    );
  }
}

// PUT /api/group-bookings/[id]/folio — Update folio metadata (status close, etc.)
const updateFolioSchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
});

export async function PUT(
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

    const parsed = updateFolioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } },
        { status: 400 }
      );
    }

    const folio = await db.groupFolio.findFirst({
      where: { groupBookingId: id, tenantId: user.tenantId },
    });

    if (!folio) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group folio not found' } },
        { status: 404 }
      );
    }

    if (parsed.data.status === 'closed') {
      if (folio.status === 'closed') {
        return NextResponse.json(
          { success: false, error: { code: 'FOLIO_ALREADY_CLOSED', message: 'Folio is already closed' } },
          { status: 400 }
        );
      }

      // Recalculate then close
      const recalculated = await recalculateFolioTotalsTx(
        db,
        folio.id,
        id
      );

      const finalStatus =
        recalculated.balance > 0.01 ? 'partially_paid' : 'closed';
      const updated = await db.groupFolio.update({
        where: { id: folio.id },
        data: {
          status: finalStatus,
          closedAt: finalStatus === 'closed' ? new Date() : null,
        },
      });

      // Audit log
      try {
        await auditLogService.logWithContext(
          {
            tenantId: user.tenantId,
            userId: user.id,
            module: 'billing',
            action: 'update',
            entityType: 'group_folio',
            entityId: folio.id,
            oldValue: { status: folio.status },
            newValue: { status: updated.status },
            description: `Closed group folio (final balance: ${recalculated.balance})`,
          },
          request
        );
      } catch (_e) {
        /* non-fatal */
      }

      return NextResponse.json({ success: true, data: updated });
    }

    // Generic update for other fields (future extensibility)
    return NextResponse.json({ success: true, data: folio });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update group folio' } },
      { status: 500 }
    );
  }
}

// DELETE /api/group-bookings/[id]/folio — Close the group folio
export async function DELETE(
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

    const folio = await db.groupFolio.findFirst({
      where: { groupBookingId: id, tenantId: user.tenantId },
    });

    if (!folio) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group folio not found' } },
        { status: 404 }
      );
    }

    if (folio.status === 'closed') {
      return NextResponse.json(
        { success: false, error: { code: 'FOLIO_ALREADY_CLOSED', message: 'Folio is already closed' } },
        { status: 400 }
      );
    }

    // Recalculate then close
    const recalculated = await recalculateFolioTotalsTx(db, folio.id, id);

    const finalStatus =
      recalculated.balance > 0.01 ? 'partially_paid' : 'closed';
    const closed = await db.groupFolio.update({
      where: { id: folio.id },
      data: {
        status: finalStatus,
        closedAt: finalStatus === 'closed' ? new Date() : null,
      },
    });

    // Audit log
    try {
      await auditLogService.logWithContext(
        {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'update',
          entityType: 'group_folio',
          entityId: folio.id,
          oldValue: { status: folio.status },
          newValue: { status: closed.status },
          description: `Closed group folio via DELETE (final balance: ${recalculated.balance})`,
        },
        request
      );
    } catch (_e) {
      /* non-fatal */
    }

    return NextResponse.json({ success: true, data: closed });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to close group folio' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helper: recalculate folio totals (works within transaction or standalone)
// ---------------------------------------------------------------------------
async function recalculateFolioTotalsTx(
  tx: typeof db,
  groupFolioId: string,
  groupBookingId: string
) {
  const folio = await tx.groupFolio.findUnique({
    where: { id: groupFolioId },
    select: { id: true, groupBookingId: true },
  });

  if (!folio) throw new Error('GROUP_FOLIO_NOT_FOUND');

  // Fetch all child bookings for this group
  const childBookings = await tx.booking.findMany({
    where: {
      groupId: groupBookingId,
      status: { not: 'cancelled' },
      deletedAt: null,
    },
    select: { id: true },
  });

  const bookingIds = childBookings.map((b) => b.id);

  // Sum up folio totals across all child bookings
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

  // Sum group folio line items (supplementary charges)
  const itemsAgg = await tx.groupFolioItem.aggregate({
    where: { groupFolioId },
    _sum: { totalAmount: true, taxAmount: true },
  });
  const itemSubtotal = itemsAgg._sum.totalAmount ?? 0;
  const itemTax = itemsAgg._sum.taxAmount ?? 0;

  // Sum group folio payments
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
  const paidAmount = Math.round((aggregatedPaid + totalPayments) * 100) / 100;
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

  // Persist updated totals
  const updated = await tx.groupFolio.update({
    where: { id: groupFolioId },
    data: { subtotal, taxes, totalAmount, paidAmount, balance, status },
  });

  return updated;
}
