import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';

// Valid config types that can be stored
const VALID_CONFIG_TYPES = ['streaming', 'recording', 'alerts', 'display'];

// GET /api/security/surveillance-config - Fetch all configs for current tenant/property
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'security.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const explicitPropertyId = searchParams.get('propertyId');
    const configType = searchParams.get('configType');

    const propertyId = await resolvePropertyId(user, explicitPropertyId);
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_PROPERTY', message: 'No property found for this tenant' } },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      propertyId,
    };

    if (configType && VALID_CONFIG_TYPES.includes(configType)) {
      where.configType = configType;
    }

    const configs = await db.surveillanceConfig.findMany({
      where,
      orderBy: { configType: 'asc' },
    });

    // Parse JSON settings for each config
    const parsed = configs.map((config) => ({
      ...config,
      settings: JSON.parse(config.settings),
    }));

    return NextResponse.json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    console.error('Error fetching surveillance configs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch surveillance configs' } },
      { status: 500 }
    );
  }
}

// PUT /api/security/surveillance-config - Upsert a config entry
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'security.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { propertyId: explicitPropertyId, configType, settings } = body;

    if (!configType || !VALID_CONFIG_TYPES.includes(configType)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CONFIG_TYPE', message: `configType must be one of: ${VALID_CONFIG_TYPES.join(', ')}` } },
        { status: 400 }
      );
    }

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_SETTINGS', message: 'settings must be a valid JSON object' } },
        { status: 400 }
      );
    }

    const propertyId = await resolvePropertyId(user, explicitPropertyId);
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_PROPERTY', message: 'No property found for this tenant' } },
        { status: 400 }
      );
    }

    const settingsJson = JSON.stringify(settings);

    // Upsert using the unique constraint [tenantId, propertyId, configType]
    const config = await db.surveillanceConfig.upsert({
      where: {
        tenantId_propertyId_configType: {
          tenantId: user.tenantId,
          propertyId,
          configType,
        },
      },
      create: {
        tenantId: user.tenantId,
        propertyId,
        configType,
        settings: settingsJson,
      },
      update: {
        settings: settingsJson,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        settings: JSON.parse(config.settings),
      },
    });
  } catch (error) {
    console.error('Error upserting surveillance config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save surveillance config' } },
      { status: 500 }
    );
  }
}

// DELETE /api/security/surveillance-config - Remove a config entry
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'security.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const configType = searchParams.get('configType');
    const explicitPropertyId = searchParams.get('propertyId');

    if (!configType || !VALID_CONFIG_TYPES.includes(configType)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CONFIG_TYPE', message: `configType must be one of: ${VALID_CONFIG_TYPES.join(', ')}` } },
        { status: 400 }
      );
    }

    const propertyId = await resolvePropertyId(user, explicitPropertyId);
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_PROPERTY', message: 'No property found for this tenant' } },
        { status: 400 }
      );
    }

    await db.surveillanceConfig.delete({
      where: {
        tenantId_propertyId_configType: {
          tenantId: user.tenantId,
          propertyId,
          configType,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Surveillance config '${configType}' deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting surveillance config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete surveillance config' } },
      { status: 500 }
    );
  }
}
