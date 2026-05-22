/**
 * Rate Shopping Automation Cron Job
 *
 * GET /api/cron/rate-shopping-automation?cron=true
 *
 * Queries properties that have competitor pricing configuration
 * and logs a check. Real competitor API integration would require
 * external credentials (OTA APIs, Google Hotel Search, etc.).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const CRON_SECRET = process.env.CRON_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-cron-secret' : '');

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cronMode = searchParams.get('cron') === 'true';

  if (!cronMode) {
    return NextResponse.json({
      success: false,
      error: 'This endpoint is for cron automation only. Use ?cron=true with proper auth.',
    }, { status: 400 });
  }

  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const providedSecret = authHeader?.replace('Bearer ', '');

  if (providedSecret !== CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find properties that have competitor price entries (indicating competitor config exists)
    const propertiesWithCompetitors = await db.competitorPrice.findMany({
      distinct: ['propertyId'],
      where: {
        property: { status: 'active', deletedAt: null },
      },
      select: { propertyId: true },
    });

    const propertyIds = propertiesWithCompetitors.map((p) => p.propertyId);
    let checked = propertyIds.length;

    if (checked === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        message: 'No properties with competitor configuration found.',
      });
    }

    // Log the check in AuditLog for each property's tenant
    for (const propertyId of propertyIds) {
      try {
        const property = await db.property.findUnique({
          where: { id: propertyId },
          select: { tenantId: true, name: true },
        });

        if (property) {
          await db.auditLog.create({
            data: {
              tenantId: property.tenantId,
              module: 'rate_shopping',
              action: 'create',
              entityType: 'CronJob',
              newValue: JSON.stringify({
                job: 'rate-shopping-automation',
                propertyId,
                propertyName: property.name,
                message: 'Rate shopping check completed. External competitor API integration requires credentials configuration.',
              }),
            },
          });
        }
      } catch {
        // Skip logging for individual property failures
      }
    }

    return NextResponse.json({
      success: true,
      checked,
      message: `Checked ${checked} propert${checked === 1 ? 'y' : 'ies'} with competitor configuration.`,
      note: 'Real competitor rate fetching requires external API credentials (OTA, Google, etc.).',
    });
  } catch (error) {
    console.error('[Cron] Rate shopping automation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
