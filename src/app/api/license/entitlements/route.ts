import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { seedEntitlements } from '@/lib/license-enforcement';
import { FEATURES } from '@/lib/feature-flags';

// GET - List all entitlements for tenant
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;

    const entitlements = await db.licenseModuleEntitlement.findMany({
      where: { tenantId },
      orderBy: { moduleKey: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: { entitlements, tenantId },
    });
  } catch (error) {
    console.error('Error fetching entitlements:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch entitlements' },
      { status: 500 }
    );
  }
}

// POST - Create or update entitlement (admin only)
export async function POST(request: NextRequest) {
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
        { success: false, error: 'Only administrators can manage license entitlements' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const {
      moduleKey,
      moduleName,
      limitType,
      limitValue,
      warningThreshold,
      hardLimit,
      billingDimension,
      pricePerUnit,
      isValid,
      effectiveFrom,
      effectiveTo,
    } = body;

    if (!moduleKey || !moduleName || !limitType) {
      return NextResponse.json(
        { success: false, error: 'moduleKey, moduleName, and limitType are required' },
        { status: 400 }
      );
    }

    // Upsert entitlement
    const entitlement = await db.licenseModuleEntitlement.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
      update: {
        moduleName: moduleName ?? undefined,
        limitType: limitType ?? undefined,
        limitValue: limitValue !== undefined ? Number(limitValue) : undefined,
        warningThreshold: warningThreshold !== undefined ? Number(warningThreshold) : undefined,
        hardLimit: hardLimit !== undefined ? Boolean(hardLimit) : undefined,
        billingDimension: billingDimension ?? undefined,
        pricePerUnit: pricePerUnit !== undefined ? Number(pricePerUnit) : undefined,
        isValid: isValid !== undefined ? Boolean(isValid) : undefined,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : undefined,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
      },
      create: {
        tenantId,
        moduleKey,
        moduleName,
        limitType,
        limitValue: Number(limitValue) || 0,
        warningThreshold: Number(warningThreshold) || 0.8,
        hardLimit: hardLimit !== undefined ? Boolean(hardLimit) : true,
        billingDimension: billingDimension || null,
        pricePerUnit: pricePerUnit ? Number(pricePerUnit) : null,
        isValid: isValid !== undefined ? Boolean(isValid) : true,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      },
    });

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          module: 'license',
          action: 'update_entitlement',
          entityType: 'LicenseModuleEntitlement',
          entityId: entitlement.id,
          userId: user.id,
          tenantId,
          newValue: JSON.stringify({
            moduleKey,
            limitValue: entitlement.limitValue,
            hardLimit: entitlement.hardLimit,
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
      data: { entitlement },
      message: 'Entitlement saved successfully',
    });
  } catch (error) {
    console.error('Error creating/updating entitlement:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save entitlement' },
      { status: 500 }
    );
  }
}
