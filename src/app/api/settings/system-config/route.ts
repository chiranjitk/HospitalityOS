import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

const CONFIG_KEY = 'calendar_deviation_settings';

const DEFAULT_SETTINGS = {
  discountAlert: 20,     // <- this % triggers "deep discount" (emerald-500)
  discountWarning: 10,   // <- this % triggers "good discount" (emerald-400)
  markupWarning: 10,     // > this % triggers "high markup" (orange-400)
  markupAlert: 20,       // > this % triggers "premium markup" (red-500)
};

// GET /api/settings/system-config?key=calendar_deviation_settings
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'settings.read');
  if (user instanceof NextResponse) return user;
  if (!user) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
  }

  try {
    const key = request.nextUrl.searchParams.get('key') || CONFIG_KEY;
    const config = await db.systemConfig.findUnique({
      where: { tenantId_key: { tenantId: user.tenantId, key } },
    });

    return NextResponse.json({
      success: true,
      data: {
        key,
        value: config ? (config.value as Record<string, unknown>) : DEFAULT_SETTINGS,
        isDefault: !config,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching system config:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch settings' } }, { status: 500 });
  }
}

// PUT /api/settings/system-config — upsert
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'settings.update');
  if (user instanceof NextResponse) return user;
  if (!user) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
  }

  try {
    const body = await request.json();
    const key = body.key || CONFIG_KEY;
    const value = body.value;

    if (!value || typeof value !== 'object') {
      return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'value must be an object' } }, { status: 400 });
    }

    // Validate numeric fields
    const { discountAlert, discountWarning, markupWarning, markupAlert } = value as Record<string, unknown>;
    const fields = { discountAlert, discountWarning, markupWarning, markupAlert };
    for (const [name, val] of Object.entries(fields)) {
      if (val !== undefined && (typeof val !== 'number' || val < 0 || val > 100)) {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: `${name} must be a number between 0 and 100` } },
          { status: 400 },
        );
      }
    }

    const config = await db.systemConfig.upsert({
      where: { tenantId_key: { tenantId: user.tenantId, key } },
      create: { tenantId: user.tenantId, key, value: value as object },
      update: { value: value as object },
    });

    return NextResponse.json({
      success: true,
      data: { key, value: config.value },
    });
  } catch (error: unknown) {
    console.error('Error saving system config:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save settings' } }, { status: 500 });
  }
}
