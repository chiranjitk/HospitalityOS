import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ─── Zod Schemas ───
const updateAccountSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(255).optional(),
  accountType: z.enum(['revenue', 'liability', 'asset', 'expense', 'equity']).optional(),
  category: z.enum(['room', 'food_beverage', 'minibar', 'laundry', 'spa', 'parking', 'other', 'miscellaneous', 'telecom', 'event', 'rental', 'service_charge', 'tax']).optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ─── GET: Get single revenue account ───
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'revenue-accounts.view') && !hasPermission(user, 'posting-rules.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;

    const account = await db.revenueAccount.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        property: { select: { id: true, name: true } },
        postingRules: {
          where: { isActive: true },
          select: { id: true, name: true, chargeCategory: true, chargeType: true, autoPost: true, priority: true },
          orderBy: { priority: 'asc' },
        },
        _count: { select: { postingRules: true } },
      },
    });

    if (!account) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Revenue account not found' } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    console.error('[RevenueAccounts GET/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch revenue account' } }, { status: 500 });
  }
}

// ─── PUT: Update revenue account ───
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'revenue-accounts.edit') && !hasPermission(user, 'posting-rules.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const existing = await db.revenueAccount.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Revenue account not found' } }, { status: 404 });
    }

    const data = parsed.data;

    // Check for duplicate code if changing
    if (data.code && data.code !== existing.code) {
      const duplicate = await db.revenueAccount.findFirst({
        where: { tenantId: user.tenantId, code: data.code },
      });
      if (duplicate) {
        return NextResponse.json({ success: false, error: { code: 'DUPLICATE', message: `Revenue account with code "${data.code}" already exists` } }, { status: 409 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.code !== undefined) updateData.code = data.code;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.accountType !== undefined) updateData.accountType = data.accountType;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const account = await db.revenueAccount.update({
      where: { id },
      data: updateData,
      include: {
        property: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'revenue-accounts',
        action: 'update',
        entityType: 'RevenueAccount',
        entityId: id,
        oldValue: `${existing.code} - ${existing.name}`,
        newValue: `${account.code} - ${account.name}`,
      },
    });

    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    console.error('[RevenueAccounts PUT/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update revenue account' } }, { status: 500 });
  }
}

// ─── DELETE: Delete revenue account ───
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'revenue-accounts.delete') && !hasPermission(user, 'posting-rules.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.revenueAccount.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { _count: { select: { postingRules: true } } },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Revenue account not found' } }, { status: 404 });
    }

    // Check for dependent posting rules
    if (existing._count.postingRules > 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'HAS_DEPENDENCIES',
          message: `Cannot delete: ${existing._count.postingRules} posting rule(s) reference this account. Remove or reassign them first.`,
        },
      }, { status: 409 });
    }

    await db.revenueAccount.delete({ where: { id } });

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'revenue-accounts',
        action: 'delete',
        entityType: 'RevenueAccount',
        entityId: id,
        oldValue: `Deleted revenue account: ${existing.code} - ${existing.name}`,
      },
    });

    return NextResponse.json({ success: true, data: { id, deleted: true } });
  } catch (error) {
    console.error('[RevenueAccounts DELETE/:id] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete revenue account' } }, { status: 500 });
  }
}
