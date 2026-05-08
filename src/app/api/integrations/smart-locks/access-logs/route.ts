import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/integrations/smart-locks/access-logs — list smart lock access logs
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['integrations.view', 'integrations.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const lockId = searchParams.get('lockId');
    const guestId = searchParams.get('guestId');
    const accessMethod = searchParams.get('accessMethod');
    const success = searchParams.get('success');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (lockId) where.lockId = lockId;
    if (guestId) where.guestId = guestId;
    if (accessMethod) where.accessMethod = accessMethod;
    if (success !== null && success !== undefined) where.success = success === 'true';

    const logs = await db.smartLockAccessLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error listing smart lock access logs:', error);
    return NextResponse.json({ success: false, error: 'Failed to list access logs' }, { status: 500 });
  }
}
