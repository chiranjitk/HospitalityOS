import { NextRequest, NextResponse } from 'next/server';
import {
  checkRoamingPermission,
  calculateRoamingBandwidth,
  logRoamingEvent,
  type RoamingCheckResult,
} from '@/lib/wifi/utils/roaming';
import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// POST /api/v1/wifi/roaming-check  (public endpoint — no auth)
//
// Body:
//   tenantId        (required) string
//   originZoneSlug  (required) string  — zone the device originally authenticated in
//   targetZoneSlug  (required) string  — zone the device is now trying to access
//   propertyId?     string
//   sessionId?      string
//   username?       string
//   macAddress?     string
//   ipAddress?      string
//
// Responses:
//   200 — { allowed: true,  mode, bandwidthPolicy, bandwidth, reauthRequired?: true }
//   200 — { allowed: false, mode, reason }
//   403 — (same as allowed:false but with 403 status for RADIUS/NAS consumption)
//   400 — validation error
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { tenantId, originZoneSlug, targetZoneSlug, propertyId, sessionId, username, macAddress, ipAddress } =
      body as {
        tenantId?: string;
        originZoneSlug?: string;
        targetZoneSlug?: string;
        propertyId?: string;
        sessionId?: string;
        username?: string;
        macAddress?: string;
        ipAddress?: string;
      };

    // --- Validation ---
    if (!tenantId || typeof tenantId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'tenantId is required' } },
        { status: 400 },
      );
    }

    if (!originZoneSlug || typeof originZoneSlug !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'originZoneSlug is required' } },
        { status: 400 },
      );
    }

    if (!targetZoneSlug || typeof targetZoneSlug !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'targetZoneSlug is required' } },
        { status: 400 },
      );
    }

    // --- Perform roaming check ---
    const result: RoamingCheckResult = await checkRoamingPermission({
      tenantId,
      originZoneSlug,
      targetZoneSlug,
    });

    // --- Calculate effective bandwidth when roaming is allowed ---
    let bandwidth: { downloadBps: number; uploadBps: number } | undefined;
    if (result.allowed) {
      // Fetch origin portal for bandwidth calculation
      const originPortal = await db.captivePortal.findFirst({
        where: { tenantId, slug: originZoneSlug },
        select: { maxBandwidthDown: true, maxBandwidthUp: true },
      });
      bandwidth = calculateRoamingBandwidth(result, originPortal ?? undefined);
    }

    // --- Log the event for audit trail ---
    await logRoamingEvent({
      tenantId,
      sessionId,
      username,
      macAddress,
      originZone: originZoneSlug,
      targetZone: targetZoneSlug,
      mode: result.mode,
      allowed: result.allowed,
      ipAddress,
    }).catch((logErr) => {
      // Audit logging should never break the roaming check
      console.error('[Roaming Check] Failed to log audit event:', logErr);
    });

    // --- Build response ---
    const responsePayload: Record<string, unknown> = {
      success: true,
      allowed: result.allowed,
      mode: result.mode,
      originZone: result.originZone ?? null,
      targetZone: result.targetZone,
      bandwidthPolicy: result.bandwidthPolicy,
    };

    if (bandwidth) {
      responsePayload.bandwidth = {
        downloadBps: bandwidth.downloadBps,
        uploadBps: bandwidth.uploadBps,
        downloadMbps: +(bandwidth.downloadBps / 1_000_000).toFixed(2),
        uploadMbps: +(bandwidth.uploadBps / 1_000_000).toFixed(2),
      };
    }

    if (result.reason) {
      responsePayload.reason = result.reason;
    }

    if (result.allowed && result.mode === 'reauth') {
      responsePayload.reauthRequired = true;
      return NextResponse.json(responsePayload, { status: 200 });
    }

    if (result.allowed) {
      return NextResponse.json(responsePayload, { status: 200 });
    }

    // Not allowed — return 403 so NAS/RADIUS can enforce immediately
    return NextResponse.json(responsePayload, { status: 403 });
  } catch (error) {
    console.error('[Roaming Check API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Roaming check failed. Please try again or contact support.',
        },
      },
      { status: 500 },
    );
  }
}
