/**
 * WiFi Billing Run
 *
 * POST /api/wifi/billing/run — Trigger manual billing run
 *   Body: { tenantId?: string } — optionally specify a different tenant (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/tenant-context';
import { runDailyWiFiBilling } from '@/lib/wifi/services/wifi-billing-engine';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const targetTenantId = body.tenantId as string | undefined;

    // Only allow target tenant override for platform admins
    const effectiveTenantId = targetTenantId && auth.isPlatformAdmin
      ? targetTenantId
      : auth.tenantId;

    console.log(`[WiFiBilling] Manual billing run triggered for tenant ${effectiveTenantId} by user ${auth.userId}`);

    const result = await runDailyWiFiBilling(effectiveTenantId);

    return NextResponse.json({
      success: true,
      data: result,
      message: `Billing run completed: ${result.processed} processed, ${result.postedToFolio} posted, $${result.totalCharged.toFixed(2)} charged`,
    });
  } catch (error) {
    console.error('[WiFiBilling] Run error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run billing' },
      { status: 500 },
    );
  }
}
