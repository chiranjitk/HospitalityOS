import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const createPlanSchema = z.object({
  propertyId: z.string().uuid().optional(),
  name: z.string().min(1, 'Plan name is required'),
  provider: z.enum(['internal', 'klarna', 'affirm', 'afterpay']).default('internal'),
  minAmount: z.number().min(0).default(0),
  maxAmount: z.number().min(0),
  interestRate: z.number().min(0).max(100).default(0),
  durationMonths: z.number().int().min(1).max(60),
  minInstallment: z.number().min(0).optional(),
  maxInstallments: z.number().int().min(1).default(12),
  isActive: z.boolean().default(true),
  terms: z.string().optional(),
});

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
// GET /api/billing/financing — List financing plans
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const isActive = sp.get('isActive');
    const provider = sp.get('provider') || undefined;

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (provider) where.provider = provider;

    const plans = await db.financingPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Count active installments per plan
    const planIds = plans.map(p => p.id);
    const installmentCounts = await db.financingInstallment.groupBy({
      by: ['financingPlanId'],
      where: { financingPlanId: { in: planIds }, tenantId: user.tenantId },
      _count: true,
      _sum: { totalAmount: true, paidAmount: true },
    });

    const countsMap: Record<string, { count: number; totalAmount: number; paidAmount: number }> = {};
    for (const ic of installmentCounts) {
      countsMap[ic.financingPlanId] = {
        count: ic._count,
        totalAmount: ic._sum.totalAmount || 0,
        paidAmount: ic._sum.paidAmount || 0,
      };
    }

    const data = plans.map(p => ({
      ...p,
      _installments: countsMap[p.id] || { count: 0, totalAmount: 0, paidAmount: 0 },
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[GET /api/billing/financing]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch financing plans' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// POST /api/billing/financing — Create financing plan
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createPlanSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const data = parsed.data;

    const plan = await db.financingPlan.create({
      data: {
        tenantId: user.tenantId,
        propertyId: data.propertyId || null,
        name: data.name,
        provider: data.provider,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount,
        interestRate: data.interestRate,
        durationMonths: data.durationMonths,
        minInstallment: data.minInstallment || null,
        maxInstallments: data.maxInstallments,
        isActive: data.isActive,
        terms: data.terms,
      },
    });

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/billing/financing]', error);
    return NextResponse.json({ success: false, error: 'Failed to create financing plan' }, { status: 500 });
  }
}
