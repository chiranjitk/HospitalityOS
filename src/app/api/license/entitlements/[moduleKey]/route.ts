import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

// GET - Get single entitlement details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleKey: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { moduleKey } = await params;
    const tenantId = user.tenantId;

    const entitlement = await db.licenseModuleEntitlement.findUnique({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
      include: {
        usageLogs: {
          orderBy: { sampledAt: 'desc' },
          take: 30,
        },
      },
    });

    if (!entitlement) {
      return NextResponse.json(
        { success: false, error: `Entitlement not found for module: ${moduleKey}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { entitlement },
    });
  } catch (error) {
    console.error('Error fetching entitlement:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch entitlement' },
      { status: 500 }
    );
  }
}

// PUT - Update entitlement limits
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ moduleKey: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Platform admin only
    if (!user.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Platform admin access required' } },
        { status: 403 }
      );
    }

    const { moduleKey } = await params;
    const body = await request.json();
    const tenantId = (user.isPlatformAdmin && body.tenantId) ? body.tenantId : user.tenantId;

    const existing = await db.licenseModuleEntitlement.findUnique({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Entitlement not found for module: ${moduleKey}` },
        { status: 404 }
      );
    }

    const oldValue = JSON.stringify({
      limitValue: existing.limitValue,
      warningThreshold: existing.warningThreshold,
      hardLimit: existing.hardLimit,
      isValid: existing.isValid,
    });

    // Validate warningThreshold is 0-1
    if (body.warningThreshold !== undefined) {
      const wt = Number(body.warningThreshold);
      if (isNaN(wt) || wt < 0 || wt > 1) {
        return NextResponse.json(
          { success: false, error: 'warningThreshold must be between 0 and 1' },
          { status: 400 }
        );
      }
    }

    // Validate limitValue is non-negative
    if (body.limitValue !== undefined && Number(body.limitValue) < 0) {
      return NextResponse.json(
        { success: false, error: 'limitValue must be non-negative' },
        { status: 400 }
      );
    }

    // Validate limitType whitelist
    if (body.limitType) {
      const VALID_LIMIT_TYPES = ['concurrent_users', 'users', 'properties', 'devices', 'bookings', 'staff'];
      if (!VALID_LIMIT_TYPES.includes(body.limitType)) {
        return NextResponse.json(
          { success: false, error: `Invalid limitType. Must be one of: ${VALID_LIMIT_TYPES.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate effectiveFrom/effectiveTo date range
    if (body.effectiveFrom && body.effectiveTo) {
      const from = new Date(body.effectiveFrom);
      const to = new Date(body.effectiveTo);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid date format' },
          { status: 400 }
        );
      }
      if (from >= to) {
        return NextResponse.json(
          { success: false, error: 'effectiveFrom must be before effectiveTo' },
          { status: 400 }
        );
      }
    }

    const updated = await db.licenseModuleEntitlement.update({
      where: { id: existing.id },
      data: {
        ...(body.limitValue !== undefined && { limitValue: Number(body.limitValue) }),
        ...(body.warningThreshold !== undefined && { warningThreshold: Number(body.warningThreshold) }),
        ...(body.hardLimit !== undefined && { hardLimit: Boolean(body.hardLimit) }),
        ...(body.isValid !== undefined && { isValid: Boolean(body.isValid) }),
        ...(body.moduleName && { moduleName: body.moduleName }),
        ...(body.limitType && { limitType: body.limitType }),
        ...(body.billingDimension !== undefined && { billingDimension: body.billingDimension || null }),
        ...(body.pricePerUnit !== undefined && { pricePerUnit: body.pricePerUnit ? Number(body.pricePerUnit) : null }),
        ...(body.effectiveFrom !== undefined && { effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined }),
        ...(body.effectiveTo !== undefined && { effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null }),
      },
    });

    // Invalidate cache so next check picks up new values
    const { invalidateCache } = await import('@/lib/license-enforcement');
    invalidateCache(tenantId, moduleKey);

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          module: 'license',
          action: 'update_entitlement',
          entityType: 'LicenseModuleEntitlement',
          entityId: updated.id,
          userId: user.id,
          tenantId,
          oldValue,
          newValue: JSON.stringify({
            limitValue: updated.limitValue,
            warningThreshold: updated.warningThreshold,
            hardLimit: updated.hardLimit,
            isValid: updated.isValid,
          }),
          ipAddress: request.headers.get('x-forwarded-for') || '',
          userAgent: request.headers.get('user-agent') || '',
        },
      });
    } catch (auditErr) {
      console.error('[License] Audit log failed:', auditErr);
    }

    return NextResponse.json({
      success: true,
      data: { entitlement: updated },
      message: 'Entitlement updated successfully',
    });
  } catch (error) {
    console.error('Error updating entitlement:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update entitlement' },
      { status: 500 }
    );
  }
}

// DELETE - Remove entitlement
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ moduleKey: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!user.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Platform admin access required' } },
        { status: 403 }
      );
    }

    const { moduleKey } = await params;
    const body = await request.json();
    const tenantId = (user.isPlatformAdmin && body.tenantId) ? body.tenantId : user.tenantId;

    const existing = await db.licenseModuleEntitlement.findUnique({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Entitlement not found for module: ${moduleKey}` },
        { status: 404 }
      );
    }

    // Clean up orphaned usage logs before deleting entitlement
    await db.licenseUsageLog.deleteMany({ where: { entitlementId: existing.id } });
    await db.licenseModuleEntitlement.delete({
      where: { id: existing.id },
    });

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          module: 'license',
          action: 'delete_entitlement',
          entityType: 'LicenseModuleEntitlement',
          entityId: existing.id,
          userId: user.id,
          tenantId,
          oldValue: JSON.stringify({ moduleKey, limitValue: existing.limitValue }),
          ipAddress: request.headers.get('x-forwarded-for') || '',
          userAgent: request.headers.get('user-agent') || '',
        },
      });
    } catch (auditErr) {
      console.error('[License] Audit log failed:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Entitlement for ${moduleKey} deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting entitlement:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete entitlement' },
      { status: 500 }
    );
  }
}
