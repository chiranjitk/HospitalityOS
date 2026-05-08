import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['billing.manage', 'inventory.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const sp = request.nextUrl.searchParams;
    const matchStatus = sp.get('matchStatus');
    const search = sp.get('search');
    const limit = Math.min(parseInt(sp.get('limit') || '100', 10), 100);
    const offset = parseInt(sp.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (matchStatus) where.matchStatus = matchStatus;
    if (search) where.OR = [
      { poNumber: { contains: search } },
      { invoiceNumber: { contains: search } },
      { vendorName: { contains: search } },
    ];

    const data = await db.invoiceMatch.findMany({
      where,
      include: { lines: true },
      orderBy: [{ invoiceDate: 'desc' }],
      take: limit, skip: offset,
    });

    const total = await db.invoiceMatch.count({ where });
    const statusCounts = await db.invoiceMatch.groupBy({
      by: ['matchStatus'], where: { tenantId: user.tenantId },
      _count: true, _sum: { invoiceAmount: true, varianceAmount: true },
    });

    return NextResponse.json({
      success: true, data, pagination: { total, limit, offset },
      stats: { statusDistribution: statusCounts },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch matches' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['billing.manage', 'inventory.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { poNumber, invoiceNumber, vendorId, vendorName, invoiceDate, invoiceAmount, poAmount, receivedAmount, tolerancePercent, lines = [] } = body;
    if (!poNumber || !invoiceNumber || !invoiceDate)
      return NextResponse.json({ success: false, error: 'PO#, invoice#, and date are required' }, { status: 400 });

    const varianceAmount = Math.abs(invoiceAmount - poAmount);
    const variancePercent = poAmount > 0 ? (varianceAmount / poAmount) * 100 : 0;
    const tolerance = tolerancePercent || 5;
    const matchStatus = variancePercent <= tolerance ? 'matched' : 'variance';

    const match = await db.invoiceMatch.create({
      data: {
        tenantId: user.tenantId, propertyId: null,
        poNumber, invoiceNumber, vendorId: vendorId || null, vendorName: vendorName || '',
        invoiceDate: new Date(invoiceDate),
        invoiceAmount, poAmount, receivedAmount,
        matchStatus: 'pending', varianceAmount, variancePercent,
        tolerancePercent: tolerance,
        notes: body.notes,
      },
      include: { lines: true },
    });

    if (lines.length > 0) {
      await db.invoiceMatchLine.createMany({
        data: lines.map((l: { itemDescription: string; poQty: number; invoiceQty: number; receivedQty: number; poUnitPrice: number; invoiceUnitPrice: number; lineStatus?: string }) => ({
          matchId: match.id,
          itemDescription: l.itemDescription,
          poQty: l.poQty, invoiceQty: l.invoiceQty, receivedQty: l.receivedQty,
          poUnitPrice: l.poUnitPrice, invoiceUnitPrice: l.invoiceUnitPrice,
          lineStatus: l.lineStatus || 'pending',
          varianceAmount: Math.abs(l.invoiceQty * l.invoiceUnitPrice - l.poQty * l.poUnitPrice),
        })),
      });
    }

    // Auto-match if within tolerance
    if (matchStatus === 'matched') {
      await db.invoiceMatch.update({ where: { id: match.id }, data: { matchStatus: 'matched', matchedBy: user.id, matchedAt: new Date() } });
    }

    return NextResponse.json({ success: true, data: match }, { status: 201 });
  } catch (error) {
    console.error('POST /api/invoice-matching:', error);
    return NextResponse.json({ success: false, error: 'Failed to create match' }, { status: 500 });
  }
}
