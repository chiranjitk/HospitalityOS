import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth';
import { z } from 'zod';

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const updateBudgetSchema = z.object({
  name: z.string().min(1).optional(),
  periodType: z.enum(['monthly', 'quarterly', 'annual']).optional(),
  status: z.enum(['draft', 'approved', 'active', 'closed']).optional(),
  notes: z.string().optional(),
  approvedBy: z.string().optional(),
});

// ──────────────────────────────────────────────
// GET /api/financials/budgets/[id]
// ──────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasAnyPermission(user, ['financials:read', 'financials.*']) && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const budget = await db.budget.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        lines: {
          include: {
            financialAccount: { select: { id: true, code: true, name: true, accountType: true, category: true } },
          },
          orderBy: [{ financialAccount: { code: 'asc' } }, { period: 'asc' }],
        },
      },
    });

    if (!budget) {
      return NextResponse.json({ success: false, error: 'Budget not found' }, { status: 404 });
    }

    // Compute line-level variance
    const processedLines = budget.lines.map(line => {
      const actualAmt = line.actualAmt || 0;
      const budgetedAmt = line.budgetedAmt || 0;
      const variance = budgetedAmt - actualAmt;
      const pctUsed = budgetedAmt > 0 ? (actualAmt / budgetedAmt) * 100 : 0;
      return { ...line, variance, pctUsed };
    });

    return NextResponse.json({
      success: true,
      data: { ...budget, lines: processedLines },
    });
  } catch (error) {
    console.error('[GET /api/financials/budgets/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch budget' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// PUT /api/financials/budgets/[id]
// ──────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasAnyPermission(user, ['financials:write', 'financials.*']) && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateBudgetSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const existing = await db.budget.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Budget not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.periodType !== undefined) updateData.periodType = parsed.data.periodType;
    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
      if (parsed.data.status === 'approved') {
        updateData.approvedBy = user.id;
        updateData.approvedAt = new Date();
      }
    }
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

    const budget = await db.budget.update({
      where: { id },
      data: updateData,
      include: {
        lines: {
          include: { financialAccount: { select: { id: true, code: true, name: true, accountType: true, category: true } } },
        },
      },
    });

    return NextResponse.json({ success: true, data: budget });
  } catch (error) {
    console.error('[PUT /api/financials/budgets/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to update budget' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// DELETE /api/financials/budgets/[id]
// ──────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasAnyPermission(user, ['financials:write', 'financials.*']) && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.budget.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Budget not found' }, { status: 404 });
    }

    if (existing.status === 'approved' || existing.status === 'active') {
      return NextResponse.json({ success: false, error: 'Cannot delete an approved or active budget' }, { status: 400 });
    }

    // Delete budget lines and budget atomically
    await db.$transaction(async (tx) => {
      await tx.budgetLine.deleteMany({ where: { budgetId: id } });
      await tx.budget.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, message: 'Budget deleted' });
  } catch (error) {
    console.error('[DELETE /api/financials/budgets/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to delete budget' }, { status: 500 });
  }
}
