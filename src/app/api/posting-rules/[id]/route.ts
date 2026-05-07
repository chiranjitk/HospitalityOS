import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ─── Zod Schemas ───
const updateRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  chargeCategory: z.string().optional(),
  chargeType: z.string().optional(),
  revenueAccountId: z.string().uuid().optional(),
  taxTreatment: z.enum(['taxable', 'exempt', 'zero_rated']).optional(),
  autoPost: z.boolean().optional(),
  isActive: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  priority: z.number().int().min(0).optional(),
  conditions: z.record(z.unknown()).optional(),
});

// ─── GET: Get single posting rule ───
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'posting-rules.view') && !hasPermission(user, 'posting-rules.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;

    const rule = await db.postingRule.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        revenueAccount: true,
        property: { select: { id: true, name: true } },
        logs: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });

    if (!rule) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Posting rule not found' } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('[PostingRules GET/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch posting rule' } }, { status: 500 });
  }
}

// ─── PUT: Update posting rule ───
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'posting-rules.edit') && !hasPermission(user, 'posting-rules.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const existing = await db.postingRule.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Posting rule not found' } }, { status: 404 });
    }

    const data = parsed.data;

    // Verify revenue account if being changed
    if (data.revenueAccountId) {
      const account = await db.revenueAccount.findFirst({
        where: { id: data.revenueAccountId, tenantId: user.tenantId },
      });
      if (!account) {
        return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Revenue account not found' } }, { status: 404 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.chargeCategory !== undefined) updateData.chargeCategory = data.chargeCategory;
    if (data.chargeType !== undefined) updateData.chargeType = data.chargeType;
    if (data.revenueAccountId !== undefined) updateData.revenueAccountId = data.revenueAccountId;
    if (data.taxTreatment !== undefined) updateData.taxTreatment = data.taxTreatment;
    if (data.autoPost !== undefined) updateData.autoPost = data.autoPost;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.status !== undefined) updateData.isActive = data.status === 'active';
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.conditions !== undefined) updateData.conditions = JSON.stringify(data.conditions);

    const rule = await db.postingRule.update({
      where: { id },
      data: updateData,
      include: {
        revenueAccount: { select: { id: true, code: true, name: true, accountType: true } },
        property: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'posting-rules',
        action: 'update',
        entityType: 'PostingRule',
        entityId: id,
        oldValue: existing.name,
        newValue: `Updated posting rule: ${rule.name}`,
      },
    });

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('[PostingRules PUT/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update posting rule' } }, { status: 500 });
  }
}

// ─── DELETE: Delete posting rule ───
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'posting-rules.delete') && !hasPermission(user, 'posting-rules.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.postingRule.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Posting rule not found' } }, { status: 404 });
    }

    await db.postingRule.delete({ where: { id } });

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'posting-rules',
        action: 'delete',
        entityType: 'PostingRule',
        entityId: id,
        oldValue: `Deleted posting rule: ${existing.name}`,
      },
    });

    return NextResponse.json({ success: true, data: { id, deleted: true } });
  } catch (error) {
    console.error('[PostingRules DELETE/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete posting rule' } }, { status: 500 });
  }
}
