import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['billing.manage', 'inventory.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { matchStatus, notes } = body;

    if (!matchStatus || !['matched', 'pending', 'variance', 'disputed'].includes(matchStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid match status' }, { status: 400 });
    }

    const existing = await db.invoiceMatch.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Invoice match not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      matchStatus,
      updatedAt: new Date(),
    };

    if (notes !== undefined) updateData.notes = notes;

    if (matchStatus === 'matched') {
      updateData.matchedBy = user.id;
      updateData.matchedAt = new Date();
    }

    const updated = await db.invoiceMatch.update({
      where: { id },
      data: updateData,
      include: { lines: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('PUT /api/invoice-matching/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to update match' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['billing.manage', 'inventory.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    const existing = await db.invoiceMatch.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Invoice match not found' }, { status: 404 });
    }

    await db.invoiceMatchLine.deleteMany({ where: { matchId: id } });
    await db.invoiceMatch.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Invoice match deleted' });
  } catch (error) {
    console.error('DELETE /api/invoice-matching/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete match' }, { status: 500 });
  }
}
