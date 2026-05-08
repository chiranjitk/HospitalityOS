import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const beo = await db.banquetEventOrder.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!beo) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: beo });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch BEO' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const existing = await db.banquetEventOrder.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const { clientName, eventType, setupStyle, expectedPax, functionDate, startTime, endTime,
      menuNotes, beverageNotes, avRequirements, specialInstructions, status, cancelReason, items } = body;

    const validStatuses = ['draft', 'confirmed', 'in_progress', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status))
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (clientName !== undefined) updateData.clientName = clientName;
    if (eventType !== undefined) updateData.eventType = eventType;
    if (setupStyle !== undefined) updateData.setupStyle = setupStyle;
    if (expectedPax !== undefined) updateData.expectedPax = expectedPax;
    if (functionDate) updateData.functionDate = new Date(functionDate);
    if (startTime) updateData.startTime = new Date(startTime);
    if (endTime) updateData.endTime = new Date(endTime) : updateData.endTime = null;
    if (menuNotes !== undefined) updateData.menuNotes = menuNotes;
    if (beverageNotes !== undefined) updateData.beverageNotes = beverageNotes;
    if (avRequirements) updateData.avRequirements = JSON.stringify(avRequirements);
    if (specialInstructions !== undefined) updateData.specialInstructions = specialInstructions;
    if (status) updateData.status = status;
    if (status === 'cancelled') { updateData.cancelledAt = new Date(); updateData.cancelReason = cancelReason; }

    let beo;
    if (items && Array.isArray(items)) {
      beo = await db.$transaction(async (tx) => {
        await tx.bEOItem.deleteMany({ where: { orderId: id } });
        const totalAmount = items.reduce((s: number, i: { unitPrice: number; quantity: number }) => s + (i.unitPrice || 0) * (i.quantity || 1), 0);
        return tx.banquetEventOrder.update({
          where: { id }, data: { ...updateData, totalAmount },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        });
      });
    } else {
      beo = await db.banquetEventOrder.update({
        where: { id }, data: updateData,
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    }

    return NextResponse.json({ success: true, data: beo });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update BEO' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const existing = await db.banquetEventOrder.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    await db.banquetEventOrder.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'BEO deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete BEO' }, { status: 500 });
  }
}
