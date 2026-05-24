import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ──────────────────────────────────────────────
// Zod schemas & state machine
// ──────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  accrued: ['invoiced', 'waived'],
  invoiced: ['paid', 'waived'],
  paid: [],
  waived: [],
};

const patchCommissionRecordSchema = z.object({
  status: z.enum(['accrued', 'invoiced', 'paid', 'waived']).optional(),
  notes: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

// ──────────────────────────────────────────────
// GET /api/commissions/records/[id]
// ──────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const record = await db.commissionRecord.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        rule: { select: { id: true, name: true, sourceType: true, commissionType: true, rate: true } },
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            totalAmount: true,
            status: true,
            primaryGuest: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        property: { select: { id: true, name: true } },
      },
    });

    if (!record) {
      return NextResponse.json({ success: false, error: 'Commission record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error('[GET /api/commissions/records/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch commission record' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// PATCH /api/commissions/records/[id] — Update status
// ──────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user, 'commissions.write') && !hasPermission(user, 'commissions.*') && !hasPermission(user, '*')) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.commissionRecord.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Commission record not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = patchCommissionRecordSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const data = parsed.data;

    // Validate status transition
    if (data.status) {
      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(data.status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot transition from '${existing.status}' to '${data.status}'. Allowed: ${allowed.join(', ') || 'none'}`,
          },
          { status: 400 },
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.status === 'invoiced') updateData.invoicedAt = new Date();
    if (data.status === 'paid') updateData.paidAt = new Date();
    if (data.notes !== undefined) updateData.notes = data.notes;

    const record = await db.commissionRecord.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...updateData,
      },
      include: {
        rule: { select: { id: true, name: true } },
        booking: { select: { id: true, confirmationCode: true } },
      },
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error('[PATCH /api/commissions/records/[id]]', error);
    return NextResponse.json({ success: false, error: 'Failed to update commission record' }, { status: 500 });
  }
}
