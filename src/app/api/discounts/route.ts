import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    const settings = await db.tenantSettings.findMany({ where: { tenantId: user.tenantId, key: { startsWith: 'discount_rule_' } } });
    const data = settings.map(s => JSON.parse(s.value));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    const body = await request.json();
    const { name, type, value, startTime, endTime, days } = body;

    const discount = await db.tenantSettings.create({
      data: { tenantId: user.tenantId, key: `discount_rule_${Date.now()}`, value: JSON.stringify({ name, type, value, startTime, endTime, days }) },
    });

    // Audit log
    try {
      await auditLogService.logWithContext({
        tenantId: user.tenantId,
        userId: user.id,
        module: 'settings',
        action: 'create',
        entityType: 'discount',
        entityId: discount.id,
        newValue: { name, type, value, startTime, endTime, days },
        description: `Created discount: ${name}`,
      }, request);
    } catch (auditError) {
      console.error('Audit log failed for discount create:', auditError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
