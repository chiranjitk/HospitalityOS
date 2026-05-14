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

    if (user.roleName !== 'admin' && !user.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only administrators can update entitlements' },
        { status: 403 }
      );
    }

    const { moduleKey } = await params;
    const tenantId = user.tenantId;
    const body = await request.json();

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

    if (user.roleName !== 'admin' && !user.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only administrators can delete entitlements' },
        { status: 403 }
      );
    }

    const { moduleKey } = await params;
    const tenantId = user.tenantId;

    const existing = await db.licenseModuleEntitlement.findUnique({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Entitlement not found for module: ${moduleKey}` },
        { status: 404 }
      );
    }

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
