import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['guests.manage', 'guests.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const sp = request.nextUrl.searchParams;
    const isActive = sp.get('isActive');
    const ruleType = sp.get('ruleType');
    const alertLevel = sp.get('alertLevel');
    const limit = Math.min(parseInt(sp.get('limit') || '100', 10), 100);
    const offset = parseInt(sp.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (isActive !== null) where.isActive = isActive === 'true';
    if (ruleType) where.ruleType = ruleType;
    if (alertLevel) where.alertLevel = alertLevel;

    const data = await db.vipRule.findMany({
      where,
      include: { _count: { select: { alerts: true } } },
      orderBy: [{ createdAt: 'desc' }],
      take: limit, skip: offset,
    });

    const total = await db.vipRule.count({ where });
    return NextResponse.json({ success: true, data, pagination: { total, limit, offset } });
  } catch (error) {
    console.error('GET /api/guests/vip-rules:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch VIP rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['guests.manage', 'guests.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { name, ruleType, conditions, alertLevel, alertMessage, autoUpgrade, isActive, propertyId } = body;
    if (!name) return NextResponse.json({ success: false, error: 'Name required' }, { status: 400 });

    const rule = await db.vipRule.create({
      data: {
        tenantId: user.tenantId, propertyId: propertyId || null,
        name, ruleType: ruleType || 'stays',
        conditions: conditions ? JSON.stringify(conditions) : '{}',
        alertLevel: alertLevel || 'vip',
        alertMessage, autoUpgrade: autoUpgrade || false,
        isActive: isActive !== false,
      },
    });

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    console.error('POST /api/guests/vip-rules:', error);
    return NextResponse.json({ success: false, error: 'Failed to create VIP rule' }, { status: 500 });
  }
}
