import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
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
        totalValue: true,
        totalCgst: true,
        totalSgst: true,
        totalIgst: true,
        totalCess: true,
        totalTax: true,
        totalAmount: true,
      },
    });

    const totalOutwardSupply = eInvoices.reduce((sum, e) => sum + e.totalAmount, 0);
    const totalTaxableValue = eInvoices.reduce((sum, e) => sum + e.totalValue, 0);
    const totalCgst = eInvoices.reduce((sum, e) => sum + e.totalCgst, 0);
    const totalSgst = eInvoices.reduce((sum, e) => sum + e.totalSgst, 0);
    const totalIgst = eInvoices.reduce((sum, e) => sum + e.totalIgst, 0);
    const totalCess = eInvoices.reduce((sum, e) => sum + e.totalCess, 0);
    const totalTaxLiability = totalCgst + totalSgst + totalIgst + totalCess;
    const totalItcClaimed = 0; // Would be calculated from purchase invoices
    const netTaxPayable = Math.max(0, totalTaxLiability - totalItcClaimed);

    const gstr3bData = {
      period,
      fromMonth: month,
      fromYear: year,
      // Table 3.1 - Outward supplies
      outwardSupplies: {
        totalTaxableValue,
        totalCgst,
        totalSgst,
        totalIgst,
        totalCess,
        totalTax: totalTaxLiability,
      },
      // Table 4 - Input Tax Credit
      itc: {
        totalItcClaimed,
        itcBreakdown: {
          cgst: 0,
          sgst: 0,
          igst: 0,
          cess: 0,
        },
      },
      // Summary
      summary: {
        totalOutwardSupply,
        totalTaxLiability,
        totalItcClaimed,
        netTaxPayable,
        interest: 0,
        lateFee: 0,
        totalPayable: netTaxPayable,
      },
    };

    return NextResponse.json({ success: true, data: gstr3bData });
  } catch (error) {
    console.error('[GSTR3B GET] Error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to prepare GSTR-3B' } }, { status: 500 });
  }
}
