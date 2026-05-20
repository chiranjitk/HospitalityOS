import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { logBillingEvent } from '@/lib/services/audit-service';

// GET /api/folios/[id] - Get a single folio
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'folios.view') && !hasPermission(user, 'folios.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const { id } = await params;

    const folio = await db.folio.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            checkIn: true,
            checkOut: true,
            status: true,
            primaryGuest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            room: {
              select: {
                id: true,
                number: true,
                floor: true,
              },
            },
            roomType: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        lineItems: {
          orderBy: { serviceDate: 'desc' },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!folio) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } },
        { status: 404 }
      );
    }

    if (folio.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: folio,
    });
  } catch (error) {
    console.error('Error fetching folio:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch folio' } },
      { status: 500 }
    );
  }
}

// PUT /api/folios/[id] - Update a folio
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'folios.update') && !hasPermission(user, 'folios.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const { id } = await params;
    const body = await request.json();

    const existingFolio = await db.folio.findUnique({
      where: { id },
    });

    if (!existingFolio) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } },
        { status: 404 }
      );
    }

    if (existingFolio.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }

    const {
      // SECURITY: subtotal, taxes, totalAmount, paidAmount, balance are NOT destructured
      // from client body. These are computed server-side from line items and payments
      // to prevent clients from manipulating financial totals.
      discount,
      status,
      invoiceNumber,
      invoiceUrl,
      invoiceIssuedAt,
      closedAt,
    } = body;

    // Validate status transitions
    if (status && status !== existingFolio.status) {
      const validTransitions: Record<string, string[]> = {
        open: ['closed', 'partially_paid', 'paid'],
        partially_paid: ['paid', 'closed'],
        paid: ['closed'],
        closed: [],
      };

      if (!validTransitions[existingFolio.status]?.includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot transition from ${existingFolio.status} to ${status}` } },
          { status: 400 }
        );
      }
    }

    // SECURITY FIX (F-01): Recalculate all financial totals server-side from
    // authoritative line items and payments. Never trust client-sent values
    // for subtotal, totalAmount, or balance to prevent balance manipulation.
    const lineItems = await db.folioLineItem.findMany({
      where: { folioId: id },
    });

    const payments = await db.payment.findMany({
      where: { folioId: id, status: 'completed' },
      select: { amount: true },
    });

    const recalcSubtotal = lineItems.reduce((sum, item) => sum + item.totalAmount, 0);
    const recalcTaxes = lineItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const recalcDiscount = (discount !== undefined) ? discount : existingFolio.discount;
    const recalcTotalAmount = recalcSubtotal + recalcTaxes - recalcDiscount;
    const recalcPaidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const recalcBalance = recalcTotalAmount - recalcPaidAmount;

    const folio = await db.folio.update({
      where: { id },
      data: {
        subtotal: recalcSubtotal,
        taxes: recalcTaxes,
        discount: recalcDiscount,
        totalAmount: recalcTotalAmount,
        paidAmount: recalcPaidAmount,
        balance: recalcBalance,
        ...(status && { status }),
        ...(invoiceNumber !== undefined && { invoiceNumber }),
        ...(invoiceUrl !== undefined && { invoiceUrl }),
        ...(invoiceIssuedAt !== undefined && { invoiceIssuedAt: invoiceIssuedAt ? new Date(invoiceIssuedAt) : null }),
        ...(closedAt !== undefined && { closedAt: closedAt ? new Date(closedAt) : null }),
      },
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            primaryGuest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        lineItems: {
          orderBy: { serviceDate: 'desc' },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Audit log (non-blocking)
    try {
      await logBillingEvent(user.tenantId, user.id, 'update', 'folio', id, {
        status: existingFolio.status,
        discount: existingFolio.discount,
        invoiceNumber: existingFolio.invoiceNumber,
        totalAmount: existingFolio.totalAmount,
        balance: existingFolio.balance,
      } as Record<string, unknown>, {
        status: folio.status,
        discount: folio.discount,
        invoiceNumber: folio.invoiceNumber,
        totalAmount: folio.totalAmount,
        balance: folio.balance,
      } as Record<string, unknown>, request);
    } catch (auditErr) {
      console.error('[AUDIT] Failed to log folio update:', auditErr);
    }

    return NextResponse.json({ success: true, data: folio });
  } catch (error) {
    console.error('Error updating folio:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update folio' } },
      { status: 500 }
    );
  }
}

// DELETE /api/folios/[id] - Soft delete a folio
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // RBAC check
    if (!hasPermission(user, 'folios.delete') && !hasPermission(user, 'folios.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const { id } = await params;

    const existingFolio = await db.folio.findUnique({
      where: { id },
    });

    if (!existingFolio) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } },
        { status: 404 }
      );
    }

    if (existingFolio.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }

    // Check if folio has payments
    const paymentCount = await db.payment.count({
      where: { folioId: id },
    });

    if (paymentCount > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'HAS_PAYMENTS', message: 'Cannot delete folio with existing payments' } },
        { status: 400 }
      );
    }

    // Soft delete by updating status to closed (folios should be archived, not deleted)
    const folio = await db.folio.update({
      where: { id },
      data: {
        status: 'closed',
        closedAt: new Date(),
      },
    });

    // Audit log (non-blocking)
    try {
      await logBillingEvent(user.tenantId, user.id, 'delete', 'folio', id, {
        folioNumber: existingFolio.folioNumber,
        status: existingFolio.status,
        totalAmount: existingFolio.totalAmount,
        balance: existingFolio.balance,
      } as Record<string, unknown>, undefined, request);
    } catch (auditErr) {
      console.error('[AUDIT] Failed to log folio delete:', auditErr);
    }

    return NextResponse.json({
      success: true,
      data: folio,
      message: 'Folio closed successfully',
    });
  } catch (error) {
    console.error('Error deleting folio:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete folio' } },
      { status: 500 }
    );
  }
}
