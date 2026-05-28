import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// ─── GET /api/wifi/alerts/config ──────────────────────────────────────────────
// Get alert config for the tenant (global) and all per-property overrides
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'wifi.manage');
    if (auth instanceof NextResponse) return auth;

    const [globalConfig, propertyConfigs, properties] = await Promise.all([
      db.wiFiAlertConfig.findUnique({
        where: { tenantId_propertyId: { tenantId: auth.tenantId, propertyId: null } },
      }),
      db.wiFiAlertConfig.findMany({
        where: { tenantId: auth.tenantId, propertyId: { not: null } },
        include: { property: { select: { id: true, name: true, city: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      db.property.findMany({
        where: { tenantId: auth.tenantId, deletedAt: null, status: 'active' },
        select: { id: true, name: true, city: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        global: globalConfig || {
          latencyWarningMs: 200,
          latencyCriticalMs: 500,
          enabled: true,
        },
        propertyConfigs,
        properties,
      },
    });
  } catch (error: any) {
    console.error('[WiFi Alert Config] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch alert config' } },
      { status: 500 }
    );
  }
}

// ─── PUT /api/wifi/alerts/config ──────────────────────────────────────────────
// Upsert alert config (global or per-property)
export async function PUT(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'wifi.manage');
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const {
      propertyId,
      latencyWarningMs,
      latencyCriticalMs,
      enabled,
    } = body as {
      propertyId?: string | null;
      latencyWarningMs?: number;
      latencyCriticalMs?: number;
      enabled?: boolean;
    };

    // Validate thresholds
    const warningMs = typeof latencyWarningMs === 'number'
      ? Math.max(10, Math.min(10000, Math.round(latencyWarningMs)))
      : 200;
    const criticalMs = typeof latencyCriticalMs === 'number'
      ? Math.max(10, Math.min(10000, Math.round(latencyCriticalMs)))
      : 500;

    if (criticalMs <= warningMs) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Critical threshold must be higher than warning threshold' } },
        { status: 400 }
      );
    }

    const config = await db.wiFiAlertConfig.upsert({
      where: {
        tenantId_propertyId: {
          tenantId: auth.tenantId,
          propertyId: propertyId || null,
        },
      },
      create: {
        tenantId: auth.tenantId,
        propertyId: propertyId || null,
        latencyWarningMs: warningMs,
        latencyCriticalMs: criticalMs,
        enabled: enabled !== false,
      },
      update: {
        latencyWarningMs: warningMs,
        latencyCriticalMs: criticalMs,
        enabled: enabled !== false,
      },
    });

    return NextResponse.json({
      success: true,
      data: config,
      message: propertyId ? 'Property alert config updated' : 'Global alert config updated',
    });
  } catch (error: any) {
    console.error('[WiFi Alert Config] PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update alert config' } },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/wifi/alerts/config ───────────────────────────────────────────
// Delete a per-property config (falls back to global)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'wifi.manage');
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { propertyId } = body as { propertyId?: string };

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required to delete a property config' } },
        { status: 400 }
      );
    }

    const config = await db.wiFiAlertConfig.findUnique({
      where: {
        tenantId_propertyId: {
          tenantId: auth.tenantId,
          propertyId,
        },
      },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Config not found for this property' } },
        { status: 404 }
      );
    }

    await db.wiFiAlertConfig.delete({ where: { id: config.id } });

    return NextResponse.json({
      success: true,
      message: 'Property alert config deleted — will use global defaults',
    });
  } catch (error: any) {
    console.error('[WiFi Alert Config] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete alert config' } },
      { status: 500 }
    );
  }
}
