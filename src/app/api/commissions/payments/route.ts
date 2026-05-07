import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/commissions/payments — List commission payments
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

    if (!hasPermission(user, 'commissions.view') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const payeeType = sp.get('payeeType');
    const dateFrom = sp.get('dateFrom');
    const dateTo = sp.get('dateTo');
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '25', 10), 1), 100);
    const offset = Math.max(parseInt(sp.get('offset') || '0', 10), 0);

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (payeeType) where.payeeType = payeeType;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.paidAt = dateFilter;
    }

    const [payments, total] = await Promise.all([
      db.commissionPayment.findMany({
        where,
        include: { property: { select: { id: true, name: true } } },
        orderBy: { paidAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.commissionPayment.count({ where }),
    ]);

    // Aggregate totals
    const aggs = await db.commissionPayment.aggregate({
      where: { tenantId: user.tenantId },
      _sum: { totalAmount: true },
    });

    return NextResponse.json({
      success: true,
      data: payments.map((p) => ({
        ...p,
        commissionRecordIds: JSON.parse(p.commissionRecordIds),
      })),
      pagination: { total, limit, offset },
      aggregates: { totalPaid: aggs._sum.totalAmount || 0 },
    });
  } catch (error) {
    console.error('[GET /api/commissions/payments]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch commission payments' } }, { status: 500 });
  }
}

// POST /api/commissions/payments — Create batch commission payment (mark records as paid)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

    if (!hasPermission(user, 'commissions.payments') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { propertyId, commissionRecordIds = [], payeeName, payeeType, paymentMethod, reference, paidAt, notes } = body;

    if (!propertyId || !payeeName || !payeeType || !Array.isArray(commissionRecordIds) || commissionRecordIds.length === 0) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId, payeeName, payeeType, and commissionRecordIds are required' } }, { status: 400 });
    }

    const validPayeeTypes = ['ota', 'travel_agent', 'referral', 'corporate'];
    if (!validPayeeTypes.includes(payeeType)) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: `payeeType must be one of: ${validPayeeTypes.join(', ')}` } }, { status: 400 });
    }

    // Verify property
    const prop = await db.property.findFirst({ where: { id: propertyId, tenantId: user.tenantId } });
    if (!prop) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } }, { status: 404 });
    }

    // Validate and fetch records — only invoiced records can be paid
    const records = await db.commissionRecord.findMany({
      where: { id: { in: commissionRecordIds }, tenantId: user.tenantId, status: 'invoiced' },
    });

    if (records.length === 0) {
      return NextResponse.json({ success: false, error: { code: 'NO_ELIGIBLE_RECORDS', message: 'No invoiced commission records found with the provided IDs' } }, { status: 400 });
    }

    if (records.length !== commissionRecordIds.length) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_RECORDS', message: `${commissionRecordIds.length - records.length} records are not in "invoiced" status and cannot be paid` } }, { status: 400 });
    }

    const totalAmount = records.reduce((sum, r) => sum + r.commissionAmount, 0);
    const recordIds = records.map((r) => r.id);
    const paymentDate = paidAt ? new Date(paidAt) : new Date();

    // Create payment and mark records as paid in a transaction
    const [payment] = await db.$transaction([
      db.commissionPayment.create({
        data: {
          tenantId: user.tenantId,
          propertyId,
          commissionRecordIds: JSON.stringify(recordIds),
          payeeName,
          payeeType,
          totalAmount,
          paymentMethod: paymentMethod || null,
          reference: reference || null,
          paidAt: paymentDate,
          notes: notes || null,
        },
      }),
      db.commissionRecord.updateMany({
        where: { id: { in: recordIds } },
        data: { status: 'paid', paidAt: paymentDate },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...payment,
        commissionRecordIds: recordIds,
        recordsUpdated: recordIds.length,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/commissions/payments]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create commission payment' } }, { status: 500 });
  }
}
