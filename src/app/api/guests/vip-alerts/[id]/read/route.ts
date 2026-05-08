import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['guests.manage', 'guests.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const alert = await db.vipAlert.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!alert) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const updated = await db.vipAlert.update({
      where: { id },
      data: { isRead: true, readBy: user.id, readAt: new Date() },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to mark alert as read' }, { status: 500 });
  }
}
