import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const createCommissionRecordSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  ruleId: z.string().uuid('Invalid rule ID'),
  bookingId: z.string().uuid('Invalid booking ID'),
  sourceType: z.enum(['ota', 'travel_agent', 'referral', 'corporate', 'direct']),
  sourceName: z.string().optional(),
  bookingAmount: z.number().min(0).optional().default(0),
  commissionAmount: z.number().min(0, 'Commission amount is required'),
  notes: z.string().optional(),
});

// ──────────────────────────────────────────────
// GET /api/commissions/records — List commission records
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const status = sp.get('status');
    const bookingId = sp.get('bookingId');
    const sourceType = sp.get('sourceType');
    const ruleId = sp.get('ruleId');
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '25', 10), 1), 100);
    const offset = Math.max(parseInt(sp.get('offset') || '0', 10), 0);

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (status) where.status = status;
    if (bookingId) where.bookingId = bookingId;
    if (sourceType) where.sourceType = sourceType;
    if (ruleId) where.ruleId = ruleId;

    const [records, total] = await Promise.all([
      db.commissionRecord.findMany({
        where,
        include: {
          rule: { select: { id: true, name: true, sourceType: true, commissionType: true, rate: true } },
          booking: { select: { id: true, confirmationCode: true, totalAmount: true, status: true } },
          property: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.commissionRecord.count({ where }),
    ]);

    // Aggregate stats for outstanding commissions
    const aggs = await db.commissionRecord.aggregate({
      where: { tenantId: user.tenantId, status: { in: ['accrued', 'invoiced'] } },
      _sum: { commissionAmount: true },
    });

    return NextResponse.json({
      success: true,
      data: records,
      pagination: { total, limit, offset },
      aggregates: { outstandingCommissions: aggs._sum.commissionAmount || 0 },
    });
  } catch (error) {
    console.error('[GET /api/commissions/records]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch commission records' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// POST /api/commissions/records — Create commission record
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user, 'commissions.write') && !hasPermission(user, 'commissions.*') && !hasPermission(user, '*')) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createCommissionRecordSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join(', ');
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const data = parsed.data;

    // Verify rule exists and belongs to tenant
    const rule = await db.commissionRule.findFirst({ where: { id: data.ruleId, tenantId: user.tenantId } });
    if (!rule) {
      return NextResponse.json({ success: false, error: 'Commission rule not found' }, { status: 404 });
    }

    // Verify booking exists and belongs to tenant
    const booking = await db.booking.findFirst({ where: { id: data.bookingId, tenantId: user.tenantId } });
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    // Check for duplicate (same rule + booking)
    const dup = await db.commissionRecord.findFirst({
      where: { ruleId: data.ruleId, bookingId: data.bookingId, tenantId: user.tenantId },
    });
    if (dup) {
      return NextResponse.json(
        { success: false, error: 'Commission record already exists for this booking and rule' },
        { status: 409 },
      );
    }

    const record = await db.commissionRecord.create({
      data: {
        tenantId: user.tenantId,
        propertyId: data.propertyId,
        ruleId: data.ruleId,
        bookingId: data.bookingId,
        sourceType: data.sourceType,
        sourceName: data.sourceName || null,
        bookingAmount: data.bookingAmount,
        commissionAmount: data.commissionAmount,
        status: 'accrued',
        notes: data.notes || null,
      },
      include: {
        rule: { select: { id: true, name: true } },
        booking: { select: { id: true, confirmationCode: true } },
      },
    });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/commissions/records]', error);
    return NextResponse.json({ success: false, error: 'Failed to create commission record' }, { status: 500 });
  }
}
