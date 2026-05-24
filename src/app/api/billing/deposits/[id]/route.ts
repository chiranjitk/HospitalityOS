import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { auditLogService } from '@/lib/services/audit-service';
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
    if (!hasAnyPermission(user, ['billing.view', 'billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
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
    if (!hasAnyPermission(user, ['billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
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
    if (parsed.data.paidAmount !== undefined) {
      // SECURITY: paidAmount cannot exceed dueAmount
      const effectiveDueAmount = parsed.data.dueAmount ?? existing.dueAmount;
      if (effectiveDueAmount > 0 && parsed.data.paidAmount > effectiveDueAmount) {
        return NextResponse.json(
          { success: false, error: `paidAmount (${parsed.data.paidAmount}) cannot exceed dueAmount (${effectiveDueAmount})` },
          { status: 400 }
        );
      }
      updateData.paidAmount = parsed.data.paidAmount;
    }
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

    // If paidAmount decreased (e.g., refund), update folio paidAmount and recalculate balance
    const oldPaidAmount = existing.paidAmount || 0;
    const paidAmountDecrease = oldPaidAmount - (parsed.data.paidAmount !== undefined ? parsed.data.paidAmount : oldPaidAmount);
    if (paidAmountDecrease > 0 && existing.bookingId) {
      try {
        const folios = await db.folio.findMany({
          where: { bookingId: existing.bookingId, status: { in: ['open', 'partially_paid'] } },
        });
        for (const folio of folios) {
          const updatedFolioPaidAmount = Math.max(0, (folio.paidAmount || 0) - paidAmountDecrease);
          const newBalance = Math.max(0, (folio.totalAmount || 0) - updatedFolioPaidAmount);
          const folioStatus = newBalance <= 0 ? 'paid' : (updatedFolioPaidAmount > 0 ? 'partially_paid' : 'open');
          await db.folio.update({
            where: { id: folio.id },
            data: {
              paidAmount: updatedFolioPaidAmount,
              balance: newBalance,
              status: folioStatus,
            },
          });
        }
      } catch (folioError) {
        console.error('[PUT /api/billing/deposits/[id]] Folio sync failed:', folioError);
      }
    }

    // Audit log (non-blocking)
    try {
      await auditLogService.logWithContext(
        {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'update',
          entityType: 'deposit',
          entityId: id,
          oldValue: {
            name: existing.name,
            milestoneType: existing.milestoneType,
            dueAmount: existing.dueAmount,
            status: existing.status,
            paidAmount: existing.paidAmount,
          },
          newValue: {
            name: deposit.name,
            milestoneType: deposit.milestoneType,
            dueAmount: deposit.dueAmount,
            status: deposit.status,
            paidAmount: deposit.paidAmount,
          },
          description: `Updated deposit schedule: ${deposit.name}`,
        },
        request,
      );
    } catch (auditErr) {
      console.error('[PUT /api/billing/deposits/[id]] audit log failed:', auditErr);
    }

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
    if (!hasAnyPermission(user, ['billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.depositSchedule.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Deposit schedule not found' }, { status: 404 });
    }

    if (existing.status === 'paid') {
      return NextResponse.json({ success: false, error: 'Cannot delete a paid deposit' }, { status: 400 });
    }

    // Capture old values for audit before delete
    const oldValue = {
      name: existing.name,
      milestoneType: existing.milestoneType,
      dueAmount: existing.dueAmount,
      paidAmount: existing.paidAmount,
      status: existing.status,
      bookingId: existing.bookingId,
    };

    await db.depositSchedule.delete({ where: { id } });

    // Audit log (non-blocking)
    try {
      await auditLogService.logWithContext(
        {
          tenantId: user.tenantId,
          userId: user.id,
          module: 'billing',
          action: 'delete',
          entityType: 'deposit',
          entityId: id,
          oldValue,
          description: `Deleted deposit schedule: ${existing.name}`,
        },
        request,
      );
    } catch (auditErr) {
      console.error('[DELETE /api/billing/deposits/[id]] audit log failed:', auditErr);
    }

    return NextResponse.json({ success: true, message: 'Deposit schedule deleted' });
  } catch (error) {
    console.error('[DELETE /api/billing/deposits/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to delete deposit schedule' }, { status: 500 });
  }
}
