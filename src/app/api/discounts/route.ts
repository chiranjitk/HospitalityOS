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

    const data = await db.discount.findMany({
      where: { tenantId: user.tenantId, deletedAt: null },
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
