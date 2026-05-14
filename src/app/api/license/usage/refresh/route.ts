import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { refreshUsage } from '@/lib/license-enforcement';
import { db } from '@/lib/db';

// POST - Force refresh usage counters for all modules
export async function POST(request: NextRequest) {
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

    const tenantId = user.tenantId;
    const body = await request.json();
    const { moduleKeys } = body; // Optional: specific modules to refresh

    // Get entitlements to refresh
    let entitlements;
    if (moduleKeys && Array.isArray(moduleKeys)) {
      entitlements = await db.licenseModuleEntitlement.findMany({
        where: {
          tenantId,
          moduleKey: { in: moduleKeys },
          isValid: true,
        },
      });
    } else {
      entitlements = await db.licenseModuleEntitlement.findMany({
        where: { tenantId, isValid: true },
      });
    }

    const refreshed: string[] = [];
    const errors: string[] = [];

    for (const ent of entitlements) {
      try {
        await refreshUsage(tenantId, ent.moduleKey);
        refreshed.push(ent.moduleKey);
      } catch (err) {
        console.error(`[License] Failed to refresh ${ent.moduleKey}:`, err);
        errors.push(ent.moduleKey);
      }
    }

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          module: 'license',
          action: 'refresh_usage',
          entityType: 'LicenseModuleEntitlement',
          userId: user.id,
          tenantId,
          newValue: JSON.stringify({ refreshed, errors }),
          ipAddress: request.headers.get('x-forwarded-for') || '',
          userAgent: request.headers.get('user-agent') || '',
        },
      });
    } catch (auditErr) {
      console.error('[License] Audit log failed:', auditErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        refreshed,
        errors: errors.length > 0 ? errors : undefined,
        count: refreshed.length,
      },
      message: `Refreshed usage for ${refreshed.length} modules`,
    });
  } catch (error) {
    console.error('Error refreshing usage:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh usage counters' },
      { status: 500 }
    );
  }
}
