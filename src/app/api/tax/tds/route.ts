import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { z } from 'zod';

const createTdsSchema = z.object({
  propertyId: z.string().optional(),
  vendorId: z.string().optional(),
  vendorName: z.string().optional(),
  panNumber: z.string().max(10).optional(),
  section: z.enum(['194C', '194H', '194J', '194I', '194A', '194B', '194D', '194G', 'other']),
  paymentDate: z.string().datetime(),
  paymentAmount: z.number().default(0),
  tdsRate: z.number().min(0).max(1).default(0),
  tdsAmount: z.number().default(0),
  period: z.string().min(6).max(6),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const section = searchParams.get('section');
    const period = searchParams.get('period');
    const propertyId = searchParams.get('propertyId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status && status !== 'all') where.status = status;
    if (section) where.section = section;
    if (period) where.period = period;
    if (propertyId) where.propertyId = propertyId;

    const [records, total] = await Promise.all([
      db.tdsRecord.findMany({
        where,
        include: { property: { select: { id: true, name: true } } },
        orderBy: { paymentDate: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      db.tdsRecord.count({ where }),
    ]);

    const stats = await db.tdsRecord.aggregate({
      where: { tenantId: user.tenantId },
      _sum: { tdsAmount: true, depositedAmount: true, paymentAmount: true },
    });

    return NextResponse.json({
      success: true,
      data: records,
      pagination: { total, limit, offset },
      stats,
    });
  } catch (error) {
    console.error('[TDS GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch TDS records' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createTdsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const data = parsed.data;

    const record = await db.tdsRecord.create({
      data: {
        tenantId: user.tenantId,
        propertyId: data.propertyId || null,
        vendorId: data.vendorId || null,
        vendorName: data.vendorName,
        panNumber: data.panNumber,
        section: data.section,
        paymentDate: new Date(data.paymentDate),
        paymentAmount: data.paymentAmount,
        tdsRate: data.tdsRate,
        tdsAmount: data.tdsAmount,
        period: data.period,
        notes: data.notes,
      },
    });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    console.error('[TDS POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create TDS record' } }, { status: 500 });
  }
}
