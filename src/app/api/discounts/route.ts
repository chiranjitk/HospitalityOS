import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    if (!hasPermission(user, 'discounts.view') && !hasPermission(user, 'settings.view')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    const where: Record<string, unknown> = { tenantId: user.tenantId, deletedAt: null };

    // M-24: Filter by propertyId to ensure users only see discounts for their property
    if (propertyId) {
      where.propertyId = propertyId;
    }

    const data = await db.discount.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Discounts GET]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    if (!hasPermission(user, 'discounts.create') && !hasPermission(user, 'settings.manage')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { name, type, value, code, minAmount, maxDiscount, applicableTo, validFrom, validUntil, maxUses } = body;

    if (!name || !type || value === undefined) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name, type, and value are required' } }, { status: 400 });
    }

    const discountCode = code || `DISC-${Date.now()}`;

    const discount = await db.discount.create({
      data: {
        tenantId: user.tenantId,
        name,
        code: discountCode,
        type,
        value: Math.round(parseFloat(String(value)) * 100) / 100,
        minAmount: minAmount ? Math.round(parseFloat(String(minAmount)) * 100) / 100 : 0,
        maxDiscount: maxDiscount ? Math.round(parseFloat(String(maxDiscount)) * 100) / 100 : null,
        applicableTo: applicableTo || 'room',
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        maxUses: maxUses ? parseInt(String(maxUses), 10) : null,
      },
    });

    // Audit log
    try {
      await auditLogService.logWithContext({
        tenantId: user.tenantId,
        userId: user.id,
        module: 'settings',
        action: 'create',
        entityType: 'discount',
        entityId: discount.id,
        newValue: { name, type, value, code: discountCode },
        description: `Created discount: ${name}`,
      }, request);
    } catch (auditError) {
      console.error('Audit log failed for discount create:', auditError);
    }

    return NextResponse.json({ success: true, data: discount });
  } catch (error) {
    console.error('[Discounts POST]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// PUT /api/discounts — Update an existing discount
// ──────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    if (!hasPermission(user, 'discounts.update') && !hasPermission(user, 'settings.manage')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      name,
      type,
      value,
      code,
      minAmount,
      maxDiscount,
      applicableTo,
      validFrom,
      validUntil,
      maxUses,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } }, { status: 400 });
    }

    // Validate ownership (tenantId)
    const existing = await db.discount.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Discount not found' } }, { status: 404 });
    }

    // Build update payload — only include provided fields
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (type !== undefined) {
      if (!['percentage', 'fixed_amount', 'complimentary'].includes(type)) {
        return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'type must be percentage, fixed_amount, or complimentary' } }, { status: 400 });
      }
      updateData.type = type;
    }
    if (value !== undefined) updateData.value = Math.round(parseFloat(String(value)) * 100) / 100;
    if (code !== undefined) updateData.code = code;
    if (minAmount !== undefined) updateData.minAmount = Math.round(parseFloat(String(minAmount)) * 100) / 100;
    if (maxDiscount !== undefined) updateData.maxDiscount = Math.round(parseFloat(String(maxDiscount)) * 100) / 100;
    if (applicableTo !== undefined) updateData.applicableTo = applicableTo;
    if (validFrom !== undefined) updateData.validFrom = new Date(validFrom);
    if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null;
    if (maxUses !== undefined) updateData.maxUses = maxUses ? parseInt(String(maxUses), 10) : null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await db.discount.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    try {
      await auditLogService.logWithContext({
        tenantId: user.tenantId,
        userId: user.id,
        module: 'settings',
        action: 'update',
        entityType: 'discount',
        entityId: id,
        oldValue: { name: existing.name, type: existing.type, value: existing.value, isActive: existing.isActive },
        newValue: updateData,
        description: `Updated discount: ${existing.name}`,
      }, request);
    } catch (auditError) {
      console.error('Audit log failed for discount update:', auditError);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Discounts PUT]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// DELETE /api/discounts — Soft-delete a discount
//   Sets deletedAt and isActive = false
// ──────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    if (!hasPermission(user, 'discounts.delete') && !hasPermission(user, 'settings.manage')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } }, { status: 400 });
    }

    // Validate ownership (tenantId)
    const existing = await db.discount.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Discount not found' } }, { status: 404 });
    }

    if (existing.deletedAt) {
      return NextResponse.json({ success: false, error: { code: 'ALREADY_DELETED', message: 'Discount is already deleted' } }, { status: 400 });
    }

    // Soft delete: set deletedAt and isActive = false
    const deleted = await db.discount.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    // Audit log
    try {
      await auditLogService.logWithContext({
        tenantId: user.tenantId,
        userId: user.id,
        module: 'settings',
        action: 'delete',
        entityType: 'discount',
        entityId: id,
        oldValue: { name: existing.name, type: existing.type, value: existing.value, isActive: existing.isActive },
        newValue: { deletedAt: new Date().toISOString(), isActive: false },
        description: `Soft-deleted discount: ${existing.name}`,
      }, request);
    } catch (auditError) {
      console.error('Audit log failed for discount delete:', auditError);
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    console.error('[Discounts DELETE]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
