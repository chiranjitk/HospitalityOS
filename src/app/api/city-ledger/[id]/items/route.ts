import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

type Params = { params: Promise<{ id: string }> };

// GET /api/city-ledger/[id]/items — List invoice items
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

    const { id } = await params;
    const invoice = await db.cityLedgerInvoice.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, { status: 404 });
    }

    const items = await db.cityLedgerItem.findMany({
      where: { invoiceId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error('[GET /api/city-ledger/[id]/items]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch invoice items' } }, { status: 500 });
  }
}

// POST /api/city-ledger/[id]/items — Add item to invoice
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

    if (!hasPermission(user, 'city_ledger.update') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const invoice = await db.cityLedgerInvoice.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, { status: 404 });
    }

    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return NextResponse.json({ success: false, error: { code: 'INVALID_STATE', message: 'Cannot add items to a paid or cancelled invoice' } }, { status: 400 });
    }

    const body = await request.json();
    const { description, amount, quantity = 1, folioId } = body;

    if (!description || !amount || amount < 0) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'description and a non-negative amount are required' } }, { status: 400 });
    }

    // Recalculate invoice totals
    const currentItems = await db.cityLedgerItem.findMany({ where: { invoiceId: id } });
    const existingSubtotal = currentItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
    const newSubtotal = existingSubtotal + amount * quantity;
    const tax = newSubtotal * 0; // Default 0%
    const total = newSubtotal + tax;

    const [item, updatedInvoice] = await db.$transaction([
      db.cityLedgerItem.create({
        data: {
          invoiceId: id,
          description,
          amount,
          quantity,
          folioId: folioId || null,
        },
      }),
      db.cityLedgerInvoice.update({
        where: { id },
        data: { subtotal: newSubtotal, tax, total },
      }),
    ]);

    return NextResponse.json({ success: true, data: { item, invoice: updatedInvoice } }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/city-ledger/[id]/items]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add invoice item' } }, { status: 500 });
  }
}

// DELETE /api/city-ledger/[id]/items — Remove item from invoice
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

    if (!hasPermission(user, 'city_ledger.update') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const invoice = await db.cityLedgerInvoice.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, { status: 404 });
    }

    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return NextResponse.json({ success: false, error: { code: 'INVALID_STATE', message: 'Cannot remove items from a paid or cancelled invoice' } }, { status: 400 });
    }

    // The item ID comes from the query param "itemId"
    const itemId = request.nextUrl.searchParams.get('itemId');
    if (!itemId) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'itemId query parameter is required' } }, { status: 400 });
    }

    const item = await db.cityLedgerItem.findFirst({ where: { id: itemId, invoiceId: id } });
    if (!item) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Item not found on this invoice' } }, { status: 404 });
    }

    // Recalculate totals
    const remainingItems = await db.cityLedgerItem.findMany({ where: { invoiceId: id, id: { not: itemId } } });
    const newSubtotal = remainingItems.reduce((sum, i) => sum + i.amount * i.quantity, 0);
    const tax = newSubtotal * 0;
    const total = newSubtotal + tax;

    await db.$transaction([
      db.cityLedgerItem.delete({ where: { id: itemId } }),
      db.cityLedgerInvoice.update({
        where: { id },
        data: { subtotal: newSubtotal, tax, total },
      }),
    ]);

    return NextResponse.json({ success: true, data: { id: itemId } });
  } catch (error) {
    console.error('[DELETE /api/city-ledger/[id]/items]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove invoice item' } }, { status: 500 });
  }
}
