import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const updateDepositSchema = z.object({
  name: z.string().min(1).optional(),
  milestoneType: z.enum(['at_booking', 'pre_arrival', 'at_checkin', 'custom']).optional(),
  milestoneDays: z.number().int().nullable().optional(),
  milestoneDate: z.string().nullable().optional(),
  percentOfTotal: z.number().min(0).max(100).optional(),
  fixedAmount: z.number().min(0).nullable().optional(),
  dueAmount: z.number().min(0).optional(),
  status: z.enum(['pending', 'partially_paid', 'paid', 'waived', 'overdue']).optional(),
  paymentMethod: z.string().nullable().optional(),
  paidAmount: z.number().min(0).optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ──────────────────────────────────────────────
// GET /api/billing/deposits/[id]
// ──────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const deposit = await db.depositSchedule.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        booking: {
          select: {
            id: true, confirmationCode: true, totalAmount: true, checkInDate: true, checkOutDate: true,
            primaryGuest: { select: { id: true, firstName: true, lastName: true } },
            room: { select: { id: true, number: true, roomType: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    if (!deposit) {
      return NextResponse.json({ success: false, error: 'Deposit schedule not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: deposit });
  } catch (error) {
    console.error('[GET /api/billing/deposits/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch deposit schedule' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// PUT /api/billing/deposits/[id]
// ──────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateDepositSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const existing = await db.depositSchedule.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Deposit schedule not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.milestoneType !== undefined) updateData.milestoneType = parsed.data.milestoneType;
    if (parsed.data.milestoneDays !== undefined) updateData.milestoneDays = parsed.data.milestoneDays;
    if (parsed.data.milestoneDate !== undefined) updateData.milestoneDate = parsed.data.milestoneDate ? new Date(parsed.data.milestoneDate) : null;
    if (parsed.data.percentOfTotal !== undefined) updateData.percentOfTotal = parsed.data.percentOfTotal;
    if (parsed.data.fixedAmount !== undefined) updateData.fixedAmount = parsed.data.fixedAmount;
    if (parsed.data.dueAmount !== undefined) updateData.dueAmount = parsed.data.dueAmount;
    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
      if (parsed.data.status === 'paid') updateData.paidAt = new Date();
    }
    if (parsed.data.paymentMethod !== undefined) updateData.paymentMethod = parsed.data.paymentMethod;
    if (parsed.data.paidAmount !== undefined) updateData.paidAmount = parsed.data.paidAmount;
    if (parsed.data.reference !== undefined) updateData.reference = parsed.data.reference;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

    const deposit = await db.depositSchedule.update({
      where: { id },
      data: updateData,
      include: {
        booking: {
          select: {
            id: true, confirmationCode: true, totalAmount: true,
            primaryGuest: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: deposit });
  } catch (error) {
    console.error('[PUT /api/billing/deposits/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to update deposit schedule' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// DELETE /api/billing/deposits/[id]
// ──────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.depositSchedule.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Deposit schedule not found' }, { status: 404 });
    }

    if (existing.status === 'paid') {
      return NextResponse.json({ success: false, error: 'Cannot delete a paid deposit' }, { status: 400 });
    }

    await db.depositSchedule.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Deposit schedule deleted' });
  } catch (error) {
    console.error('[DELETE /api/billing/deposits/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to delete deposit schedule' }, { status: 500 });
  }
}
