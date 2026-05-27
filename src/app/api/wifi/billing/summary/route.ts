/**
 * WiFi Billing Summary
 *
 * GET /api/wifi/billing/summary — Billing summary (totals, charge types, monthly comparison)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/tenant-context';
import { getBillingSummary } from '@/lib/wifi/services/wifi-billing-engine';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const summary = await getBillingSummary(auth.tenantId);
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('[WiFiBilling] Summary error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch billing summary' },
      { status: 500 },
    );
  }
}
