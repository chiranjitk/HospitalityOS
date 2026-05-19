/**
 * Cron: Consent Auto-Delete (GDPR Article 17)
 *
 * POST /api/cron/consent-auto-delete
 *   Purges all expired WiFiConsentLog records.
 *
 * GET /api/cron/consent-auto-delete
 *   Returns count of records approaching expiry (next 7 days) and
 *   total expired-but-not-yet-deleted count (dry-run preview).
 *
 * Recommended schedule: Daily (e.g., 0 3 * * *)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const CRON_SECRET =
  process.env.CRON_SECRET ||
  (process.env.NODE_ENV !== 'production' ? 'dev-only-cron-secret' : '');

/** Verify the x-cron-secret header */
function verifySecret(request: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const secret = request.headers.get('x-cron-secret');
  return secret === CRON_SECRET;
}

// ---------------------------------------------------------------------------
// POST — Execute the purge
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    if (!verifySecret(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Dynamic import to avoid bundling the heavy service on every request
    const { purgeExpiredConsents } = await import(
      '@/lib/wifi/services/consent-auto-delete'
    );

    const result = await purgeExpiredConsents();

    return NextResponse.json({
      success: true,
      message: `Purged ${result.deleted} expired consent records`,
      data: result,
    });
  } catch (error) {
    console.error('[Cron:consent-auto-delete] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to purge expired consents',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — Dry-run preview
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    if (!verifySecret(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    const sevenDaysFromNow = new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    // Expired but not yet deleted (expiresAt < NOW)
    const expiredCount = await db.wiFiConsentLog.count({
      where: { expiresAt: { lt: now } },
    });

    // Also count records past their retention period (edge case)
    const maxRetentionAgo = new Date(
      now.getTime() - 365 * 24 * 60 * 60 * 1000
    );
    const pastRetentionRecords = await db.wiFiConsentLog.findMany({
      where: {
        createdAt: { lt: maxRetentionAgo },
        expiresAt: { gte: now }, // not yet expired by expiresAt
      },
      select: { id: true, tenantId: true, dataRetentionDays: true, createdAt: true },
    });

    // Precisely count the edge-case ones
    let edgeCaseCount = 0;
    for (const r of pastRetentionRecords) {
      const retentionDeadline = new Date(
        r.createdAt.getTime() + r.dataRetentionDays * 24 * 60 * 60 * 1000
      );
      if (retentionDeadline < now) {
        edgeCaseCount++;
      }
    }

    // Approaching expiry (next 7 days)
    const approachingExpiryCount = await db.wiFiConsentLog.count({
      where: {
        expiresAt: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        expiredNotDeleted: expiredCount + edgeCaseCount,
        expiredByExpiresAt: expiredCount,
        expiredByRetention: edgeCaseCount,
        approachingExpiryNext7Days: approachingExpiryCount,
      },
    });
  } catch (error) {
    console.error('[Cron:consent-auto-delete] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch consent expiry stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
