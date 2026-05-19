/**
 * POST /api/wifi/sla/alert-bridge
 *
 * Manual trigger for the SLA ↔ Alert bridge.
 * Scans recent SLA metrics, creates per-breach-type WiFiAlert records,
 * and resolves alerts for metrics that have recovered.
 *
 * Requires authentication (requireAuth).
 *
 * Body (optional):
 *   propertyId  —  If provided, only processes this property's SLA configs
 *
 * Response:
 *   { success: true, data: { alertsCreated, alertsResolved } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/tenant-context';
import { bridgeSLABreachesToAlerts } from '@/lib/services/sla-alert-bridge';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    let propertyId: string | undefined;

    try {
      const body = await request.json();
      propertyId = body.propertyId;
    } catch {
      // Body is optional — empty body is fine
    }

    const result = await bridgeSLABreachesToAlerts(auth.tenantId, propertyId);

    return NextResponse.json({
      success: true,
      data: result,
      message: `SLA alert bridge completed: ${result.alertsCreated} created, ${result.alertsResolved} resolved`,
    });
  } catch (error) {
    console.error('[API:sla/alert-bridge] Error:', error);
    return NextResponse.json(
      { success: false, error: 'SLA alert bridge failed' },
      { status: 500 }
    );
  }
}
