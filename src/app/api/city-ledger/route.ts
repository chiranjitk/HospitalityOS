import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const cityLedgerItemSchema = z.object({
  description: z.string().min(1, 'Item description is required'),
  amount: z.number().nonnegative('Amount must be non-negative'),
  quantity: z.number().int().min(1).optional().default(1),
  folioId: z.string().uuid().optional(),
});

const createCityLedgerInvoiceSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  travelAgentId: z.string().uuid().optional().or(z.literal('')),
  accountName: z.string().min(1, 'Account name is required'),
  accountType: z.enum(['travel_agent', 'corporate', 'direct_bill']),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  items: z.array(cityLedgerItemSchema).optional().default([]),
  currency: z.string().min(1).max(10).optional().default('USD'),
  notes: z.string().optional(),
});

// ──────────────────────────────────────────────
// GET /api/city-ledger — List city ledger invoices
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.view', 'billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const status = sp.get('status');
    const accountType = sp.get('accountType');
    const travelAgentId = sp.get('travelAgentId');
    const dateFrom = sp.get('dateFrom');
    const dateTo = sp.get('dateTo');
    const search = sp.get('search');
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '25', 10), 1), 100);
    const offset = Math.max(parseInt(sp.get('offset') || '0', 10), 0);

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (status) where.status = status;
    if (accountType) where.accountType = accountType;
    if (travelAgentId) where.travelAgentId = travelAgentId;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.invoiceDate = dateFilter;
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { accountName: { contains: search } },
      ];
    }

    const [invoices, total] = await Promise.all([
      db.cityLedgerInvoice.findMany({
        where,
        include: {
          travelAgent: { select: { id: true, agencyName: true, code: true } },
          property: { select: { id: true, name: true } },
          _count: { select: { items: true, payments: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.cityLedgerInvoice.count({ where }),
    ]);

    // Calculate aggregate totals
    const aggs = await db.cityLedgerInvoice.aggregate({
      where: { tenantId: user.tenantId },
      _sum: { total: true, paidAmount: true },
    });

    return NextResponse.json({
      success: true,
      data: invoices,
      pagination: { total, limit, offset },
      aggregates: {
        totalOutstanding: (aggs._sum.total || 0) - (aggs._sum.paidAmount || 0),
        totalInvoiced: aggs._sum.total || 0,
        totalPaid: aggs._sum.paidAmount || 0,
      },
    });
  } catch (error) {
    console.error('[GET /api/city-ledger]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch city ledger invoices' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// POST /api/city-ledger — Create invoice with line items
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createCityLedgerInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const data = parsed.data;

    // Verify unique invoice number per tenant
    const dupInvoice = await db.cityLedgerInvoice.findUnique({
      where: { tenantId_invoiceNumber: { tenantId: user.tenantId, invoiceNumber: data.invoiceNumber } },
    });
    if (dupInvoice) {
      return NextResponse.json({ success: false, error: 'Invoice number already exists within this tenant' }, { status: 409 });
    }

    // Verify property belongs to tenant
    const prop = await db.property.findFirst({ where: { id: data.propertyId, tenantId: user.tenantId } });
    if (!prop) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 });
    }

    // Validate travel agent if provided
    if (data.travelAgentId) {
      const agent = await db.travelAgent.findFirst({ where: { id: data.travelAgentId, tenantId: user.tenantId } });
      if (!agent) {
        return NextResponse.json({ success: false, error: 'Travel agent not found' }, { status: 404 });
      }
    }

    // Calculate totals from items
    const items = data.items;
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.amount * item.quantity;
    }

    const tax = 0; // Default 0% tax — could be configurable per property
    const total = subtotal + tax;

    const invoice = await db.cityLedgerInvoice.create({
      data: {
        tenantId: user.tenantId,
        propertyId: data.propertyId,
        travelAgentId: data.travelAgentId || null,
        accountName: data.accountName,
        accountType: data.accountType,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: new Date(data.invoiceDate),
        dueDate: new Date(data.dueDate),
        subtotal,
        tax,
        total,
        currency: data.currency,
        paidAmount: 0,
        status: 'draft',
        notes: data.notes || null,
        items: {
          create: items.map(item => ({
            description: item.description,
            amount: item.amount,
            quantity: item.quantity,
            folioId: item.folioId || null,
          })),
        },
      },
      include: {
        items: true,
        travelAgent: { select: { id: true, agencyName: true, code: true } },
      },
    });

    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/city-ledger]', error);
    return NextResponse.json({ success: false, error: 'Failed to create city ledger invoice' }, { status: 500 });
  }
}
