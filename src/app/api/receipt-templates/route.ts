import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    const settings = await db.tenantSettings.findFirst({ where: { tenantId: user.tenantId, key: 'receipt_template' } });
    const data = settings ? JSON.parse(settings.value) : null;

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

    const body = await request.json();
    await db.tenantSettings.upsert({
      where: { tenantId_key: { tenantId: user.tenantId, key: 'receipt_template' } },
      update: { value: JSON.stringify(body) },
      create: { tenantId: user.tenantId, key: 'receipt_template', value: JSON.stringify(body) },
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

    const body = await request.json();
    await db.tenantSettings.upsert({
      where: { tenantId_key: { tenantId: user.tenantId, key: 'receipt_template' } },
      update: { value: JSON.stringify(body) },
      create: { tenantId: user.tenantId, key: 'receipt_template', value: JSON.stringify(body) },
    });

    return NextResponse.json({ success: true, data: body });
  } catch (error) {
    console.error('Error saving receipt template:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
