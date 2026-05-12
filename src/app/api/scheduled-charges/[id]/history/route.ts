import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// ─── GET: Execution history for a scheduled charge ───
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'scheduled-charges.view') && !hasPermission(user, 'scheduled-charges.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Verify charge belongs to tenant
    const charge = await db.scheduledCharge.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true },
    });

    if (!charge) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Scheduled charge not found' } }, { status: 404 });
    }

    const [history, total] = await Promise.all([
      db.scheduledChargeExecution.findMany({
        where: { scheduledChargeId: id, tenantId: user.tenantId },
        orderBy: { executedAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      db.scheduledChargeExecution.count({
        where: { scheduledChargeId: id, tenantId: user.tenantId },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: history,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('[ScheduledCharges History GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch execution history' } }, { status: 500 });
  }
}
