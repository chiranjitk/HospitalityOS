import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const createDepositSchema = z.object({
  bookingId: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  milestoneType: z.enum(['at_booking', 'pre_arrival', 'at_checkin', 'custom']).default('at_booking'),
  milestoneDays: z.number().int().optional(),
  milestoneDate: z.string().optional(),
  percentOfTotal: z.number().min(0).max(100).default(100),
  fixedAmount: z.number().min(0).optional(),
  dueAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
});

// ──────────────────────────────────────────────
// GET /api/billing/deposits — List deposit schedules
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const bookingId = sp.get('bookingId') || undefined;
    const status = sp.get('status') || undefined;
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '50', 10), 1), 200);
    const offset = Math.max(parseInt(sp.get('offset') || '0', 10), 0);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (bookingId) where.bookingId = bookingId;
    if (status) where.status = status;

    const [deposits, total] = await Promise.all([
      db.depositSchedule.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true, confirmationCode: true, totalAmount: true,
              primaryGuest: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { milestoneDate: 'asc' },
        take: limit,
        skip: offset,
      }),
      db.depositSchedule.count({ where }),
    ]);

    // Aggregate stats
    const aggs = await db.depositSchedule.aggregate({
      where: { tenantId: user.tenantId },
      _sum: { dueAmount: true, paidAmount: true },
    });

    const totalDue = aggs._sum.dueAmount || 0;
    const totalPaid = aggs._sum.paidAmount || 0;
    const overdueCount = await db.depositSchedule.count({
      where: { tenantId: user.tenantId, status: 'overdue' },
    });

    return NextResponse.json({
      success: true,
      data: deposits,
      pagination: { total, limit, offset },
      aggregates: { totalDue, totalPaid, outstanding: totalDue - totalPaid, overdueCount },
    });
  } catch (error) {
    console.error('[GET /api/billing/deposits]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch deposit schedules' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// POST /api/billing/deposits — Create deposit schedule
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createDepositSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const data = parsed.data;

    // If bookingId, verify it belongs to tenant and compute percent-based amount
    let dueAmount = data.dueAmount;
    if (data.bookingId) {
      const booking = await db.booking.findFirst({
        where: { id: data.bookingId, tenantId: user.tenantId },
        select: { totalAmount: true },
      });
      if (!booking) {
        return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
      }
      if (data.fixedAmount && data.fixedAmount > 0) {
        dueAmount = data.fixedAmount;
      } else if (data.percentOfTotal > 0) {
        dueAmount = (booking.totalAmount || 0) * (data.percentOfTotal / 100);
      }
    }

    const deposit = await db.depositSchedule.create({
      data: {
        tenantId: user.tenantId,
        bookingId: data.bookingId || null,
        name: data.name,
        milestoneType: data.milestoneType,
        milestoneDays: data.milestoneDays || null,
        milestoneDate: data.milestoneDate ? new Date(data.milestoneDate) : null,
        percentOfTotal: data.percentOfTotal,
        fixedAmount: data.fixedAmount || null,
        dueAmount,
        paidAmount: 0,
        status: 'pending',
        notes: data.notes,
      },
      include: {
        booking: {
          select: {
            id: true, confirmationCode: true, totalAmount: true,
            primaryGuest: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: deposit }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/billing/deposits]', error);
    return NextResponse.json({ success: false, error: 'Failed to create deposit schedule' }, { status: 500 });
  }
}
