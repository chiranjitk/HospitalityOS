import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['rooms.update', 'rooms.manage', 'rooms.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { action } = body; // 'approve' | 'reject'

    const change = await db.roomTypeChange.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!change) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    if (!['requested', 'pending_approval'].includes(change.status))
      return NextResponse.json({ success: false, error: `Cannot ${action} change in status: ${change.status}` }, { status: 400 });

    const updated = await db.roomTypeChange.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        approvedBy: user.id,
        approvedAt: new Date(),
        ...(action === 'approve' ? { chargeApplied: true } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to process change' }, { status: 500 });
  }
}
