import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['inventory.manage', 'inventory.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { action } = body; // 'approve' | 'reject'
    const existing = await db.purchaseRequisition.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    if (existing.status !== 'pending_approval')
      return NextResponse.json({ success: false, error: `Cannot ${action} requisition in status: ${existing.status}` }, { status: 400 });

    if (action === 'reject') {
      const updated = await db.purchaseRequisition.update({
        where: { id },
        data: {
          status: 'rejected', rejectedBy: user.id, rejectedAt: new Date(),
          rejectReason: body.reason || 'Rejected by manager',
        },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    const updated = await db.purchaseRequisition.update({
      where: { id },
      data: { status: 'approved', approvedBy: user.id, approvedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to process requisition' }, { status: 500 });
  }
}
