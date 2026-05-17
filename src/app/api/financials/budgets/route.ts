import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const createBudgetSchema = z.object({
  propertyId: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  fiscalYear: z.number().int().min(2000).max(2100),
  periodType: z.enum(['monthly', 'quarterly', 'annual']).default('monthly'),
  status: z.enum(['draft', 'approved', 'active', 'closed']).default('draft'),
  notes: z.string().optional(),
  lines: z.array(z.object({
    accountId: z.string().uuid(),
    period: z.number().int().min(1).max(12),
    budgetedAmt: z.number().min(0).default(0),
  })).optional(),
});

// ──────────────────────────────────────────────
// GET /api/financials/budgets — List budgets
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user, 'financials:read') && !hasPermission(user, 'financials.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const propertyId = sp.get('propertyId') || undefined;
    const fiscalYear = sp.get('fiscalYear') ? parseInt(sp.get('fiscalYear')!) : new Date().getFullYear();
    const status = sp.get('status') || undefined;

    const where: Record<string, unknown> = { tenantId: user.tenantId, fiscalYear };
    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;

    const budgets = await db.budget.findMany({
      where,
      include: {
        lines: {
          include: {
            financialAccount: { select: { id: true, code: true, name: true, accountType: true, category: true } },
          },
          orderBy: [{ financialAccount: { code: 'asc' } }, { period: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate stats
    const totalBudget = budgets.reduce((s, b) => s + (b.totalBudget || 0), 0);
    const totalActual = budgets.reduce((s, b) => s + (b.totalActual || 0), 0);
    const totalVariance = totalBudget - totalActual;

    return NextResponse.json({
      success: true,
      data: budgets,
      aggregates: { totalBudget, totalActual, totalVariance },
    });
  } catch (error) {
    console.error('[GET /api/financials/budgets]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// POST /api/financials/budgets — Create budget
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user, 'financials:write') && !hasPermission(user, 'financials.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createBudgetSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const data = parsed.data;
    const totalBudget = data.lines?.reduce((s, l) => s + l.budgetedAmt, 0) || 0;

    // Verify accounts belong to tenant
    if (data.lines && data.lines.length > 0) {
      const accountIds = [...new Set(data.lines.map(l => l.accountId))];
      const accounts = await db.financialAccount.findMany({
        where: { id: { in: accountIds }, tenantId: user.tenantId },
        select: { id: true },
      });
      const foundIds = new Set(accounts.map(a => a.id));
      for (const aid of accountIds) {
        if (!foundIds.has(aid)) {
          return NextResponse.json({ success: false, error: `Financial account ${aid} not found` }, { status: 404 });
        }
      }
    }

    const budget = await db.budget.create({
      data: {
        tenantId: user.tenantId,
        propertyId: data.propertyId || null,
        name: data.name,
        fiscalYear: data.fiscalYear,
        periodType: data.periodType,
        status: data.status,
        totalBudget,
        totalActual: 0,
        variance: totalBudget,
        notes: data.notes,
        lines: data.lines ? {
          create: data.lines.map(l => ({
            accountId: l.accountId,
            period: l.period,
            budgetedAmt: l.budgetedAmt,
            actualAmt: 0,
            variance: l.budgetedAmt,
            pctUsed: 0,
          })),
        } : undefined,
      },
      include: {
        lines: {
          include: { financialAccount: { select: { id: true, code: true, name: true, accountType: true, category: true } } },
        },
      },
    });

    return NextResponse.json({ success: true, data: budget }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/financials/budgets]', error);
    return NextResponse.json({ success: false, error: 'Failed to create budget' }, { status: 500 });
  }
}
