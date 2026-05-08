import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const createInstallmentSchema = z.object({
  financingPlanId: z.string().uuid(),
  folioId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  guestId: z.string().uuid().optional(),
  totalAmount: z.number().min(0.01),
  installmentAmount: z.number().min(0.01),
  installmentNumber: z.number().int().min(1),
  dueDate: z.string().min(1, 'Due date is required'),
  paidAmount: z.number().min(0).default(0),
  status: z.enum(['pending', 'paid', 'overdue', 'default']).default('pending'),
  paymentRef: z.string().optional(),
});

// ──────────────────────────────────────────────
// GET /api/billing/financing/installments — List installments
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const financingPlanId = sp.get('financingPlanId') || undefined;
    const bookingId = sp.get('bookingId') || undefined;
    const guestId = sp.get('guestId') || undefined;
    const status = sp.get('status') || undefined;
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '50', 10), 1), 200);
    const offset = Math.max(parseInt(sp.get('offset') || '0', 10), 0);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (financingPlanId) where.financingPlanId = financingPlanId;
    if (bookingId) where.bookingId = bookingId;
    if (guestId) where.guestId = guestId;
    if (status) where.status = status;

    const [installments, total] = await Promise.all([
      db.financingInstallment.findMany({
        where,
        include: {
          financingPlan: { select: { id: true, name: true, provider: true, interestRate: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: limit,
        skip: offset,
      }),
      db.financingInstallment.count({ where }),
    ]);

    // Aggregates
    const aggs = await db.financingInstallment.aggregate({
      where: { tenantId: user.tenantId, ...Object.fromEntries(Object.entries(where).filter(([k]) => k !== 'tenantId')) },
      _sum: { totalAmount: true, paidAmount: true },
    });

    return NextResponse.json({
      success: true,
      data: installments,
      pagination: { total, limit, offset },
      aggregates: {
        totalAmount: aggs._sum.totalAmount || 0,
        totalPaid: aggs._sum.paidAmount || 0,
        outstanding: (aggs._sum.totalAmount || 0) - (aggs._sum.paidAmount || 0),
      },
    });
  } catch (error) {
    console.error('[GET /api/billing/financing/installments]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch installments' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// POST /api/billing/financing/installments — Create installment
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createInstallmentSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const data = parsed.data;

    // Verify plan exists
    const plan = await db.financingPlan.findFirst({
      where: { id: data.financingPlanId, tenantId: user.tenantId },
    });
    if (!plan) {
      return NextResponse.json({ success: false, error: 'Financing plan not found' }, { status: 404 });
    }

    const installment = await db.financingInstallment.create({
      data: {
        tenantId: user.tenantId,
        financingPlanId: data.financingPlanId,
        folioId: data.folioId || null,
        bookingId: data.bookingId || null,
        guestId: data.guestId || null,
        totalAmount: data.totalAmount,
        installmentAmount: data.installmentAmount,
        installmentNumber: data.installmentNumber,
        dueDate: new Date(data.dueDate),
        paidAmount: data.paidAmount,
        status: data.status,
        paymentRef: data.paymentRef || null,
      },
      include: {
        financingPlan: { select: { id: true, name: true, provider: true } },
      },
    });

    return NextResponse.json({ success: true, data: installment }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/billing/financing/installments]', error);
    return NextResponse.json({ success: false, error: 'Failed to create installment' }, { status: 500 });
  }
}
