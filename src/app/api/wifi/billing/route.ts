/**
 * WiFi Billing API — Main List & Filtering
 *
 * GET /api/wifi/billing — List WiFiInvoiceLines with filters & pagination
 *   Query params: status, guestId, bookingId, chargeType, propertyId, startDate, endDate, page, limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/tenant-context';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const sp = request.nextUrl.searchParams;

    const status = sp.get('status');
    const guestId = sp.get('guestId');
    const bookingId = sp.get('bookingId');
    const chargeType = sp.get('chargeType');
    const propertyId = sp.get('propertyId');
    const startDate = sp.get('startDate');
    const endDate = sp.get('endDate');
    const page = parseInt(sp.get('page') || '1');
    const limit = Math.min(parseInt(sp.get('limit') || '50'), 200);

    const where: Record<string, unknown> = { tenantId: auth.tenantId };

    if (status) where.status = status;
    if (guestId) where.guestId = guestId;
    if (bookingId) where.bookingId = bookingId;
    if (chargeType) where.chargeType = chargeType;
    if (propertyId) where.propertyId = propertyId;

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.periodStart = dateFilter;
    }

    const [lines, total] = await Promise.all([
      db.wiFiInvoiceLine.findMany({
        where,
        include: {
          guest: { select: { id: true, firstName: true, lastName: true, email: true } },
          plan: { select: { id: true, name: true } },
          property: { select: { id: true, name: true } },
          booking: { select: { id: true, confirmationCode: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.wiFiInvoiceLine.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: lines,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[WiFiBilling] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch billing data' },
      { status: 500 },
    );
  }
}
