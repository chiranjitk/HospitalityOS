import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
      select: { settings: true },
    });

    const settings = tenant?.settings as Record<string, unknown> | null;
    const data = settings?.receipt_template || null;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching receipt template:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*') && !hasPermission(user, 'settings.write')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();

    const tenant = await db.tenant.findUnique({ where: { id: user.tenantId }, select: { settings: true } });
    const currentSettings = (tenant?.settings as Record<string, unknown>) || {};

    await db.tenant.update({
      where: { id: user.tenantId },
      data: { settings: { ...currentSettings, receipt_template: body } },
    });

    return NextResponse.json({ success: true, data: body });
  } catch (error) {
    console.error('Error saving receipt template:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*') && !hasPermission(user, 'settings.write')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();

    const tenant = await db.tenant.findUnique({ where: { id: user.tenantId }, select: { settings: true } });
    const currentSettings = (tenant?.settings as Record<string, unknown>) || {};

    await db.tenant.update({
      where: { id: user.tenantId },
      data: { settings: { ...currentSettings, receipt_template: body } },
    });

    return NextResponse.json({ success: true, data: body });
  } catch (error) {
    console.error('Error saving receipt template:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
