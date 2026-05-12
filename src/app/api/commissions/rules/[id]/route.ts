import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';
import { transformRecord, statusToIsActive } from '@/lib/api-transform';

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const updateCommissionRuleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sourceType: z.enum(['ota', 'travel_agent', 'referral', 'corporate', 'direct']).optional(),
  sourceId: z.string().uuid().optional().nullable(),
  commissionType: z.enum(['percentage', 'flat', 'tiered']).optional(),
  rate: z.number().min(0).optional(),
  fixedAmount: z.number().min(0).optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  status: z.string().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

// ──────────────────────────────────────────────
// GET /api/commissions/rules/[id]
// ──────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const rule = await db.commissionRule.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        property: { select: { id: true, name: true } },
        _count: { select: { records: true } },
      },
    });

    if (!rule) {
      return NextResponse.json({ success: false, error: 'Commission rule not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: transformRecord(rule as unknown as Record<string, unknown>) });
  } catch (error) {
    console.error('[GET /api/commissions/rules/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch commission rule' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// PUT /api/commissions/rules/[id]
// ──────────────────────────────────────────────

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.commissionRule.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Commission rule not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateCommissionRuleSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const data = parsed.data;

    // Validate date consistency
    const newValidFrom = data.validFrom ? new Date(data.validFrom) : existing.validFrom;
    const newValidUntil = data.validUntil !== undefined
      ? (data.validUntil ? new Date(data.validUntil) : null)
      : existing.validUntil;
    if (newValidUntil && newValidFrom && newValidUntil <= newValidFrom) {
      return NextResponse.json({ success: false, error: 'validUntil must be after validFrom' }, { status: 400 });
    }

    // Handle status → isActive conversion
    const isActiveValue = data.isActive !== undefined ? data.isActive : (data.status !== undefined ? statusToIsActive(data.status) : undefined);

    const rule = await db.commissionRule.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.sourceType !== undefined && { sourceType: data.sourceType }),
        ...(data.sourceId !== undefined && { sourceId: data.sourceId }),
        ...(data.commissionType !== undefined && { commissionType: data.commissionType }),
        ...(data.rate !== undefined && { rate: data.rate }),
        ...(data.fixedAmount !== undefined && { fixedAmount: data.fixedAmount }),
        ...(data.minAmount !== undefined && { minAmount: data.minAmount }),
        ...(data.maxAmount !== undefined && { maxAmount: data.maxAmount }),
        ...(isActiveValue !== undefined && { isActive: isActiveValue }),
        ...(data.validFrom !== undefined && { validFrom: new Date(data.validFrom) }),
        ...(data.validUntil !== undefined && { validUntil: data.validUntil ? new Date(data.validUntil) : null }),
      },
    });

    return NextResponse.json({ success: true, data: transformRecord(rule as unknown as Record<string, unknown>) });
  } catch (error) {
    console.error('[PUT /api/commissions/rules/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to update commission rule' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// DELETE /api/commissions/rules/[id]
// ──────────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.commissionRule.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { _count: { select: { records: true } } },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Commission rule not found' }, { status: 404 });
    }

    if (existing._count.records > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete rule with existing commission records. Deactivate it instead.' },
        { status: 400 },
      );
    }

    await db.commissionRule.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[DELETE /api/commissions/rules/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to delete commission rule' }, { status: 500 });
  }
}
