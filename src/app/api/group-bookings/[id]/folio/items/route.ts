import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';
import { z } from 'zod';

// GET /api/group-bookings/[id]/folio/items — List all line items
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
        { success: false, error: { code: 'NOT_FOUND', message: 'Group folio not found' } },
        { status: 404 }
      );
    }

    const items = await db.groupFolioItem.findMany({
      where: { groupFolioId: folio.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch folio items' } },
      { status: 500 }
    );
  }
}

// POST /api/group-bookings/[id]/folio/items — Create a line item
const createItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  category: z
    .string()
    .optional()
    .default('miscellaneous'),
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

    const parsed = createItemSchema.safeParse(body);
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

    // Get or auto-create folio
    let folio = await db.groupFolio.findFirst({
      where: { groupBookingId: id, tenantId: user.tenantId },
    });

    if (!folio) {
      const groupBooking = await db.groupBooking.findFirst({
        where: { id, tenantId: user.tenantId },
      });
      if (!groupBooking) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: 'Group booking not found' },
          },
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
        {
          success: false,
          error: {
            code: 'FOLIO_CLOSED',
            message: 'Cannot add items to a closed folio',
          },
        },
        { status: 400 }
      );
    }

    // Calculate amounts
    const quantity = input.quantity;
    const unitPrice = input.unitPrice;
    const totalAmount = Math.round(quantity * unitPrice * 100) / 100;
    const taxAmount =
      Math.round(totalAmount * (input.taxRate / 100) * 100) / 100;

    // Create item and recalculate totals atomically
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
          serviceDate: input.serviceDate
            ? new Date(input.serviceDate)
            : new Date(),
          referenceType: input.referenceType || null,
          referenceId: input.referenceId || null,
          postedBy: user.id,
        },
      });

      // Recalculate folio totals
      const updated = await recalculateTotalsInTx(tx, folio!.id, id);

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

    return NextResponse.json({
      success: true,
      data: { item: folioItem, folio: updatedFolio },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create folio item' },
      },
      { status: 500 }
    );
  }
}

// PUT /api/group-bookings/[id]/folio/items — Update a line item
const updateItemSchema = z.object({
  itemId: z.string().uuid(),
  description: z.string().min(1).optional(),
  category: z.string().optional(),
  quantity: z.number().int().min(1).optional(),
  unitPrice: z.number().min(0).optional(),
  taxRate: z.number().min(0).optional(),
  serviceDate: z.string().optional(),
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

    const parsed = updateItemSchema.safeParse(body);
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

    const { itemId, ...updateData } = parsed.data;

    // Verify folio
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

    if (folio.status === 'closed') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FOLIO_CLOSED',
            message: 'Cannot update items on a closed folio',
          },
        },
        { status: 400 }
      );
    }

    // Verify item belongs to this folio
    const existingItem = await db.groupFolioItem.findFirst({
      where: { id: itemId, groupFolioId: folio.id },
    });

    if (!existingItem) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Folio item not found' },
        },
        { status: 404 }
      );
    }

    // Build update data
    const data: Record<string, unknown> = {};
    if (updateData.description !== undefined) data.description = updateData.description;
    if (updateData.category !== undefined) data.category = updateData.category;
    if (updateData.quantity !== undefined) data.quantity = updateData.quantity;
    if (updateData.unitPrice !== undefined) data.unitPrice = updateData.unitPrice;
    if (updateData.taxRate !== undefined) data.taxRate = updateData.taxRate;
    if (updateData.serviceDate !== undefined)
      data.serviceDate = new Date(updateData.serviceDate);

    // Recalculate derived fields if quantity/price/tax changed
    const newQuantity =
      updateData.quantity !== undefined ? updateData.quantity : existingItem.quantity;
    const newUnitPrice =
      updateData.unitPrice !== undefined
        ? updateData.unitPrice
        : existingItem.unitPrice;
    const newTaxRate =
      updateData.taxRate !== undefined
        ? updateData.taxRate
        : existingItem.taxRate;

    data.totalAmount = Math.round(newQuantity * newUnitPrice * 100) / 100;
    data.taxAmount =
      Math.round(
        (data.totalAmount as number) * (newTaxRate / 100) * 100
      ) / 100;

    // Update item and recalculate folio totals atomically
    const [updatedItem, updatedFolio] = await db.$transaction(async (tx) => {
      const item = await tx.groupFolioItem.update({
        where: { id: itemId },
        data,
      });

      const updated = await recalculateTotalsInTx(tx, folio!.id, id);

      return [item, updated];
    });

    // Audit log
    try {
      await auditLogService.logWithContext(
        {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'update',
          entityType: 'group_folio_item',
          entityId: updatedItem.id,
          oldValue: {
            description: existingItem.description,
            quantity: existingItem.quantity,
            unitPrice: existingItem.unitPrice,
            totalAmount: existingItem.totalAmount,
          },
          newValue: {
            description: updatedItem.description,
            quantity: updatedItem.quantity,
            unitPrice: updatedItem.unitPrice,
            totalAmount: updatedItem.totalAmount,
          },
          description: `Updated line item "${updatedItem.description}" in group folio`,
        },
        request
      );
    } catch (_e) {
      /* non-fatal */
    }

    return NextResponse.json({
      success: true,
      data: { item: updatedItem, folio: updatedFolio },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update folio item' },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/group-bookings/[id]/folio/items — Remove a line item
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
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'itemId query parameter is required' },
        },
        { status: 400 }
      );
    }

    // Verify folio
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

    if (folio.status === 'closed') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FOLIO_CLOSED',
            message: 'Cannot remove items from a closed folio',
          },
        },
        { status: 400 }
      );
    }

    // Verify item belongs to this folio
    const existingItem = await db.groupFolioItem.findFirst({
      where: { id: itemId, groupFolioId: folio.id },
    });

    if (!existingItem) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Folio item not found' },
        },
        { status: 404 }
      );
    }

    // Delete item and recalculate totals atomically
    const updatedFolio = await db.$transaction(async (tx) => {
      await tx.groupFolioItem.delete({
        where: { id: itemId },
      });

      const updated = await recalculateTotalsInTx(tx, folio!.id, id);
      return updated;
    });

    // Audit log
    try {
      await auditLogService.logWithContext(
        {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'delete',
          entityType: 'group_folio_item',
          entityId: itemId,
          oldValue: {
            description: existingItem.description,
            category: existingItem.category,
            quantity: existingItem.quantity,
            unitPrice: existingItem.unitPrice,
            totalAmount: existingItem.totalAmount,
          },
          description: `Removed line item "${existingItem.description}" from group folio`,
        },
        request
      );
    } catch (_e) {
      /* non-fatal */
    }

    return NextResponse.json({
      success: true,
      data: {
        deletedItemId: itemId,
        folio: updatedFolio,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to remove folio item' },
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
