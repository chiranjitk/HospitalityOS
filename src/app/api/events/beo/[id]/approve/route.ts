import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const beo = await db.banquetEventOrder.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!beo) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    if (!['draft', 'confirmed'].includes(beo.status))
      return NextResponse.json({ success: false, error: 'Cannot approve BEO in current status' }, { status: 400 });

    const updated = await db.banquetEventOrder.update({
      where: { id },
      data: { status: 'confirmed', approvedBy: user.id, approvedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error('Failed to approve BEO:', error);
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ success: false, error: 'BEO is already approved' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Failed to approve BEO' }, { status: 500 });
  }
}
