import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

const createTcsSchema = z.object({
  propertyId: z.string().optional(),
  bookingId: z.string().optional(),
  guestId: z.string().optional(),
  folioId: z.string().optional(),
  collectionDate: z.string().datetime(),
  panNumber: z.string().max(10).optional(),
  guestName: z.string().optional(),
  guestAddress: z.string().optional(),
  bookingAmount: z.number().default(0),
  tcsRate: z.number().min(0).max(1).default(0.01),
  tcsAmount: z.number().default(0),
  thresholdExceeded: z.boolean().default(false),
  period: z.string().min(6).max(6),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'tax:read') && !hasPermission(user, 'tax.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const period = searchParams.get('period');
    const propertyId = searchParams.get('propertyId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status && status !== 'all') where.status = status;
    if (period) where.period = period;
    if (propertyId) where.propertyId = propertyId;

    const [records, total] = await Promise.all([
      db.tcsRecord.findMany({
        where,
        include: { property: { select: { id: true, name: true } } },
        orderBy: { collectionDate: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      db.tcsRecord.count({ where }),
    ]);

    const stats = await db.tcsRecord.aggregate({
      where: { tenantId: user.tenantId },
      _sum: { tcsAmount: true, depositedAmount: true, bookingAmount: true },
    });

    return NextResponse.json({
      success: true,
      data: records,
      pagination: { total, limit, offset },
      stats,
    });
  } catch (error) {
    console.error('[TCS GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch TCS records' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasPermission(user, 'tax:write') && !hasPermission(user, 'tax:admin') && !hasPermission(user, 'tax.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createTcsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const data = parsed.data;

    // SECURITY FIX (H-6): Cross-validate TCS amount ≈ bookingAmount × tcsRate.
    // Prevents data integrity issues where amount and rate don't match,
    // which could indicate manual errors or tampering.
    if (data.bookingAmount > 0 && data.tcsRate > 0) {
      const expectedAmount = Math.round(data.bookingAmount * data.tcsRate * 100) / 100;
      const tolerance = 1.00; // ₹1 tolerance for rounding differences
      if (data.tcsAmount > 0 && Math.abs(data.tcsAmount - expectedAmount) > tolerance) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `TCS amount (${data.tcsAmount}) does not match expected amount (${expectedAmount}) based on booking amount (${data.bookingAmount}) × TCS rate (${data.tcsRate}). Difference: ${Math.abs(data.tcsAmount - expectedAmount).toFixed(2)} exceeds tolerance of ₹${tolerance.toFixed(2)}.`,
            },
          },
          { status: 400 }
        );
      }
    }

    const record = await db.tcsRecord.create({
      data: {
        tenantId: user.tenantId,
        propertyId: data.propertyId || null,
        bookingId: data.bookingId || null,
        guestId: data.guestId || null,
        folioId: data.folioId || null,
        collectionDate: new Date(data.collectionDate),
        panNumber: data.panNumber,
        guestName: data.guestName,
        guestAddress: data.guestAddress,
        bookingAmount: data.bookingAmount,
        tcsRate: data.tcsRate,
        tcsAmount: data.tcsAmount,
        thresholdExceeded: data.thresholdExceeded,
        period: data.period,
        notes: data.notes,
      },
    });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    console.error('[TCS POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create TCS record' } }, { status: 500 });
  }
}
