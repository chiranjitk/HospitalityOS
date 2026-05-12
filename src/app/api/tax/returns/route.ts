import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { z } from 'zod';

const createReturnSchema = z.object({
  propertyId: z.string().optional(),
  returnType: z.enum(['gstr1', 'gstr3b']),
  period: z.string().min(6).max(6),
  fromMonth: z.number().min(1).max(12),
  fromYear: z.number().min(2020).max(2030),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const returnType = searchParams.get('returnType');
    const status = searchParams.get('status');
    const propertyId = searchParams.get('propertyId');
    const period = searchParams.get('period');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (returnType) where.returnType = returnType;
    if (status && status !== 'all') where.status = status;
    if (propertyId) where.propertyId = propertyId;
    if (period) where.period = period;

    const returns = await db.gstReturn.findMany({
      where,
      include: { property: { select: { id: true, name: true } } },
      orderBy: [{ fromYear: 'desc' }, { fromMonth: 'desc' }],
    });

    return NextResponse.json({ success: true, data: returns });
  } catch (error) {
    console.error('[GstReturns GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch GST returns' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createReturnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten().fieldErrors } }, { status: 400 });
    }

    const data = parsed.data;

    const existing = await db.gstReturn.findFirst({
      where: { tenantId: user.tenantId, returnType: data.returnType, period: data.period },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: { code: 'CONFLICT', message: `${data.returnType.toUpperCase()} return for ${data.period} already exists` } }, { status: 409 });
    }

    const gstReturn = await db.gstReturn.create({
      data: {
        tenantId: user.tenantId,
        propertyId: data.propertyId || null,
        returnType: data.returnType,
        period: data.period,
        fromMonth: data.fromMonth,
        fromYear: data.fromYear,
        status: 'draft',
        notes: data.notes,
      },
      include: { property: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: gstReturn }, { status: 201 });
  } catch (error) {
    console.error('[GstReturns POST] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create GST return' } }, { status: 500 });
  }
}
