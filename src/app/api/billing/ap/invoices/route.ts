import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/billing/ap/invoices — list AP invoices
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.view', 'billing.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const propertyId = searchParams.get('propertyId');
    const vendorId = searchParams.get('vendorId');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) where.status = status;
    if (propertyId) where.propertyId = propertyId;
    if (vendorId) where.vendorId = vendorId;

    const invoices = await db.apInvoice.findMany({
      where,
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { invoiceDate: 'desc' },
      take: 200,
    });

    return NextResponse.json({ success: true, data: invoices });
  } catch (error) {
    console.error('Error listing AP invoices:', error);
    return NextResponse.json({ success: false, error: 'Failed to list invoices' }, { status: 500 });
  }
}

// POST /api/billing/ap/invoices — create an AP invoice with lines
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { vendorId, vendorName, invoiceNumber, invoiceDate, dueDate, subtotal, taxAmount, totalAmount, currency, department, glAccount, paymentTerms, notes, propertyId, lines } = body;

    if (!vendorName || !invoiceNumber || !invoiceDate || !dueDate) {
      return NextResponse.json({ success: false, error: 'vendorName, invoiceNumber, invoiceDate, and dueDate are required' }, { status: 400 });
    }

    // Validate subtotal + taxAmount ≈ totalAmount
    const resolvedSubtotal = subtotal ?? 0;
    const resolvedTaxAmount = taxAmount ?? 0;
    const calculatedTotal = Math.round(resolvedSubtotal * 100 + resolvedTaxAmount * 100) / 100;
    if (totalAmount !== undefined && Math.abs(totalAmount - calculatedTotal) > 0.02) {
      return NextResponse.json({ success: false, error: `totalAmount (${totalAmount}) does not match subtotal + taxAmount (${calculatedTotal})` }, { status: 400 });
    }
    const resolvedTotalAmount = totalAmount !== undefined ? totalAmount : calculatedTotal;

    const invoice = await db.apInvoice.create({
      data: {
        tenantId: user.tenantId,
        vendorId: vendorId ?? null,
        vendorName,
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
        dueDate: new Date(dueDate),
        subtotal: resolvedSubtotal,
        taxAmount: resolvedTaxAmount,
        totalAmount: resolvedTotalAmount,
        currency: currency ?? 'USD',
        department: department ?? null,
        glAccount: glAccount ?? null,
        paymentTerms: paymentTerms ?? 'net_30',
        notes: notes ?? null,
        propertyId: propertyId ?? null,
        status: 'pending',
        lines: {
          create: (lines ?? []).map((line: Record<string, unknown>) => ({
            description: line.description,
            quantity: line.quantity ?? 1,
            unitPrice: line.unitPrice ?? 0,
            taxRate: line.taxRate ?? 0,
            totalAmount: line.totalAmount ?? Math.round((line.quantity * line.unitPrice) * 100) / 100,
            glAccount: line.glAccount ?? null,
            sortOrder: line.sortOrder ?? 0,
          })),
        },
      },
      include: { lines: true },
    });

    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (error) {
    console.error('Error creating AP invoice:', error);
    return NextResponse.json({ success: false, error: 'Failed to create invoice' }, { status: 500 });
  }
}
