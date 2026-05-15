import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check: read access required for GSTR-1 report
    if (!hasPermission(user, 'tax:read') && !hasPermission(user, 'tax.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const period = searchParams.get('period');
    const propertyId = searchParams.get('propertyId');

    if (!period) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Period (MMYYYY) is required' } }, { status: 400 });
    }

    const month = parseInt(period.slice(0, 2));
    const year = parseInt(period.slice(2));
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      status: 'generated',
      invoiceDate: { gte: startDate, lte: endDate },
    };
    if (propertyId) where.propertyId = propertyId;

    const eInvoices = await db.gstEInvoice.findMany({
      where,
      select: {
        invoiceNumber: true,
        supplyType: true,
        placeOfSupply: true,
        invoiceDate: true,
        totalValue: true,
        totalCgst: true,
        totalSgst: true,
        totalIgst: true,
        totalCess: true,
        totalTax: true,
        totalAmount: true,
        reverseCharge: true,
      },
      orderBy: { invoiceDate: 'asc' },
    });

    // Group by supply type for GSTR-1
    const b2bInvoices = eInvoices.filter(e => e.supplyType === 'b2b');
    const b2cInvoices = eInvoices.filter(e => e.supplyType === 'b2c' || e.supplyType === 'b2cl');

    const totalTaxableValue = eInvoices.reduce((sum, e) => sum + e.totalValue, 0);
    const totalCgst = eInvoices.reduce((sum, e) => sum + e.totalCgst, 0);
    const totalSgst = eInvoices.reduce((sum, e) => sum + e.totalSgst, 0);
    const totalIgst = eInvoices.reduce((sum, e) => sum + e.totalIgst, 0);
    const totalCess = eInvoices.reduce((sum, e) => sum + e.totalCess, 0);

    const gstr1Data = {
      period,
      fromMonth: month,
      fromYear: year,
      b2b: b2bInvoices,
      b2c: b2cInvoices,
      totalInvoices: eInvoices.length,
      totalOutwardSupply: eInvoices.reduce((sum, e) => sum + e.totalAmount, 0),
      totalTaxableValue,
      totalCgst,
      totalSgst,
      totalIgst,
      totalCess,
      totalTax: totalCgst + totalSgst + totalIgst + totalCess,
    };

    return NextResponse.json({ success: true, data: gstr1Data });
  } catch (error) {
    console.error('[GSTR1 GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to prepare GSTR-1' } }, { status: 500 });
  }
}
