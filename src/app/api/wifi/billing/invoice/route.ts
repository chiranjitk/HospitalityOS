/**
 * WiFi Invoice Generation
 *
 * POST /api/wifi/billing/invoice — Generate WiFi invoice for a booking
 *   Body: { bookingId: string } — required
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/tenant-context';
import { generateWiFiInvoice } from '@/lib/wifi/services/wifi-billing-engine';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId || typeof bookingId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'bookingId is required' },
        { status: 400 },
      );
    }

    const invoice = await generateWiFiInvoice(bookingId, auth.tenantId);

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'No WiFi charges found for this booking, or booking/folio not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: invoice,
      message: `WiFi invoice ${invoice.invoiceNumber} generated`,
    });
  } catch (error) {
    console.error('[WiFiBilling] Invoice error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate invoice' },
      { status: 500 },
    );
  }
}
