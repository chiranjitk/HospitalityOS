import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const VALID_INVOICE_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'];

const patchInvoiceSchema = z.object({
  status: z.enum(['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled']).optional(),
  notes: z.string().optional(),
});

const putInvoiceSchema = z.object({
  status: z.enum(['sent', 'partial', 'paid', 'overdue', 'cancelled']).optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1, 'Item description is required'),
    amount: z.number().nonnegative('Amount must be non-negative'),
    quantity: z.number().int().min(1).optional().default(1),
    folioId: z.string().uuid().optional(),
  })).optional(),
});

const recordPaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be positive'),
  paymentMethod: z.string().optional(),
  reference: z.string().optional(),
  paidAt: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

// ──────────────────────────────────────────────
// GET /api/city-ledger/[id] — Get single invoice
// ──────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.view', 'billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const invoice = await db.cityLedgerInvoice.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        items: true,
        payments: { orderBy: { paidAt: 'desc' }},
        travelAgent: { select: { id: true, agencyName: true, code: true, email: true, phone: true } },
        property: { select: { id: true, name: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    console.error('[GET /api/city-ledger/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// PUT /api/city-ledger/[id] — Full update invoice
//   - Change status to sent/partial/paid/overdue/cancelled
//   - Add line items (recalculates subtotal, tax, total)
//   - When status → 'paid', auto-set paidAmount = total
//   - Update notes
//   - Full audit trail with oldValue/newValue
// ──────────────────────────────────────────────

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    // Fetch existing invoice with items
    const existing = await db.cityLedgerInvoice.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { items: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    // Don't allow updates on cancelled invoices
    if (existing.status === 'cancelled') {
      return NextResponse.json({ success: false, error: 'Cannot update a cancelled invoice' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = putInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const data = parsed.data;

    // Build the audit oldValue snapshot
    const oldValueSnapshot: Record<string, unknown> = {
      status: existing.status,
      paidAmount: existing.paidAmount,
      subtotal: existing.subtotal,
      tax: existing.tax,
      total: existing.total,
      itemCount: existing.items.length,
    };

    // Compute update payload
    const updateData: Record<string, unknown> = {};

    // --- Status transition ---
    if (data.status !== undefined) {
      updateData.status = data.status;
      // When marking as 'paid', auto-set paidAmount = total
      if (data.status === 'paid') {
        updateData.paidAmount = existing.total;
      }
    }

    // --- Notes ---
    if (data.notes !== undefined) {
      updateData.notes = data.notes || null;
    }

    // --- Add new items and recalculate totals ---
    let newSubtotal = existing.subtotal;
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        newSubtotal += item.amount * item.quantity;
      }

      // Re-calculate tax from property tax rate
      let taxRate = 0;
      try {
        const propForTax = await db.property.findUnique({
          where: { id: existing.propertyId },
          select: { defaultTaxRate: true, taxComponents: true },
        });
        if (propForTax) {
          if (propForTax.taxComponents) {
            const tc = JSON.parse(propForTax.taxComponents);
            if (Array.isArray(tc) && tc.length > 0) {
              taxRate = tc.reduce((s: number, c: { rate: number }) => s + (c.rate || 0), 0) / 100;
            } else {
              taxRate = (propForTax.defaultTaxRate || 0) / 100;
            }
          } else {
            taxRate = (propForTax.defaultTaxRate || 0) / 100;
          }
        }
      } catch { /* use default 0 */ }

      const newTax = Math.round(newSubtotal * taxRate * 100) / 100;
      const newTotal = Math.round((newSubtotal + newTax) * 100) / 100;
      updateData.subtotal = newSubtotal;
      updateData.tax = newTax;
      updateData.total = newTotal;
      oldValueSnapshot.newSubtotal = newSubtotal;
      oldValueSnapshot.newTax = newTax;
      oldValueSnapshot.newTotal = newTotal;
    }

    // Perform update inside a transaction (items + invoice)
    const updatedInvoice = await db.$transaction(async (tx) => {
      // Create new items if provided
      if (data.items && data.items.length > 0) {
        await tx.cityLedgerItem.createMany({
          data: data.items.map(item => ({
            invoiceId: id,
            description: item.description,
            amount: item.amount,
            quantity: item.quantity,
            folioId: item.folioId || null,
          })),
        });
      }

      // Update the invoice
      return tx.cityLedgerInvoice.update({
        where: { id },
        data: updateData,
        include: {
          items: true,
          payments: { orderBy: { paidAt: 'desc' } },
          travelAgent: { select: { id: true, agencyName: true, code: true } },
        },
      });
    });

    // Build audit newValue snapshot
    const newValueSnapshot: Record<string, unknown> = {
      status: updatedInvoice.status,
      paidAmount: updatedInvoice.paidAmount,
      subtotal: updatedInvoice.subtotal,
      tax: updatedInvoice.tax,
      total: updatedInvoice.total,
      itemCount: updatedInvoice.items.length,
    };
    if (data.notes !== undefined) newValueSnapshot.notes = data.notes;
    if (data.items && data.items.length > 0) {
      newValueSnapshot.addedItems = data.items.map(i => ({ description: i.description, amount: i.amount, quantity: i.quantity }));
    }

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'update',
          entityType: 'city_ledger_invoice',
          entityId: id,
          oldValue: JSON.stringify(oldValueSnapshot),
          newValue: JSON.stringify(newValueSnapshot),
        },
      });
    } catch (auditError) {
      console.error('[CityLedger PUT] Audit log failed:', auditError);
    }

    return NextResponse.json({ success: true, data: updatedInvoice });
  } catch (error) {
    console.error('[PUT /api/city-ledger/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to update invoice' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// PATCH /api/city-ledger/[id] — Update invoice status (lightweight)
// ──────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.cityLedgerInvoice.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = patchInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const data = parsed.data;

    const invoice = await db.cityLedgerInvoice.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
      },
      include: { items: true, travelAgent: { select: { id: true, agencyName: true, code: true } } },
    });

    // Audit log for city-ledger invoice status update
    try {
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'update',
          entityType: 'city_ledger_invoice',
          entityId: id,
          oldValue: JSON.stringify({ status: existing.status }),
          newValue: JSON.stringify({
            status: invoice.status,
            ...(data.notes !== undefined && { notes: data.notes }),
          }),
        },
      });
    } catch (auditError) {
      console.error('[CityLedger PATCH] Audit log failed:', auditError);
    }

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    console.error('[PATCH /api/city-ledger/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to update invoice' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// DELETE /api/city-ledger/[id] — Soft-cancel invoice
//   - Sets status → 'cancelled'
//   - Full audit trail
// ──────────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    // Fetch existing invoice for audit
    const existing = await db.cityLedgerInvoice.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    if (existing.status === 'cancelled') {
      return NextResponse.json({ success: false, error: 'Invoice is already cancelled' }, { status: 400 });
    }

    // Soft-cancel: set status to 'cancelled'
    const cancelledInvoice = await db.cityLedgerInvoice.update({
      where: { id },
      data: { status: 'cancelled' },
      include: {
        items: true,
        payments: { orderBy: { paidAt: 'desc' } },
        travelAgent: { select: { id: true, agencyName: true, code: true } },
      },
    });

    // Audit log — record full oldValue and newValue
    try {
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'update',
          entityType: 'city_ledger_invoice',
          entityId: id,
          oldValue: JSON.stringify({
            status: existing.status,
            paidAmount: existing.paidAmount,
            total: existing.total,
            invoiceNumber: existing.invoiceNumber,
            accountName: existing.accountName,
          }),
          newValue: JSON.stringify({
            status: 'cancelled',
            previousStatus: existing.status,
            invoiceNumber: existing.invoiceNumber,
          }),
        },
      });
    } catch (auditError) {
      console.error('[CityLedger DELETE] Audit log failed:', auditError);
    }

    return NextResponse.json({ success: true, data: cancelledInvoice });
  } catch (error) {
    console.error('[DELETE /api/city-ledger/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to cancel invoice' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// POST /api/city-ledger/[id] — Record payment
// ──────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const invoice = await db.cityLedgerInvoice.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'cancelled') {
      return NextResponse.json({ success: false, error: 'Cannot record payment against a cancelled invoice' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = recordPaymentSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const data = parsed.data;

    const newPaidAmount = invoice.paidAmount + data.amount;

    if (newPaidAmount > invoice.total + 0.01) {
      return NextResponse.json(
        { success: false, error: `Payment amount exceeds outstanding balance of ${(invoice.total - invoice.paidAmount).toFixed(2)}` },
        { status: 400 },
      );
    }

    // Determine new status
    let newStatus = invoice.status;
    if (Math.abs(newPaidAmount - invoice.total) < 0.01) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0 && newPaidAmount < invoice.total) {
      newStatus = 'partial';
    }

    // Create payment and update invoice in a transaction
    const [payment, updatedInvoice] = await db.$transaction([
      db.cityLedgerPayment.create({
        data: {
          tenantId: user.tenantId,
          propertyId: invoice.propertyId,
          invoiceId: id,
          amount: data.amount,
          paymentMethod: data.paymentMethod || null,
          reference: data.reference || null,
          paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
          notes: null,
        },
      }),
      db.cityLedgerInvoice.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
        include: { items: true, payments: true },
      }),
    ]);

    // Update travel agent current balance if linked
    if (invoice.travelAgentId) {
      const outstanding = await db.cityLedgerInvoice.aggregate({
        where: { travelAgentId: invoice.travelAgentId, status: { in: ['draft', 'sent', 'partial', 'overdue'] } },
        _sum: { total: true, paidAmount: true },
      });
      await db.travelAgent.update({
        where: { id: invoice.travelAgentId },
        data: { currentBalance: (outstanding._sum.total || 0) - (outstanding._sum.paidAmount || 0) },
      });
    }

    // Audit log for city-ledger payment recording
    try {
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'payment',
          entityType: 'city_ledger_invoice',
          entityId: id,
          newValue: JSON.stringify({
            paymentAmount: data.amount,
            paymentMethod: data.paymentMethod || null,
            reference: data.reference || null,
            newPaidAmount,
            newStatus,
          }),
        },
      });
    } catch (auditError) {
      console.error('[CityLedger POST payment] Audit log failed:', auditError);
    }

    return NextResponse.json({ success: true, data: { payment, invoice: updatedInvoice } });
  } catch (error) {
    console.error('[POST /api/city-ledger/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to record payment' }, { status: 500 });
  }
}
