import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateCompSetMetrics, storeCompSetMetrics } from '@/lib/revenue/compset-metrics';
import { subDays } from 'date-fns';

// POST /api/cron/compset-metrics-sync - Auto-calculate metrics for all active compsets for yesterday
export async function POST(request: NextRequest) {
  try {
    // Simple API key check for cron endpoint
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'staysuite-cron-secret'}`) {
      // Also allow tenant-authenticated requests
      const { requirePermission } = await import('@/lib/auth/tenant-context');
      const ctx = await requirePermission(request, 'revenue.manage');
      if (ctx instanceof NextResponse) return ctx;
    }

    const { searchParams } = request.nextUrl;
    const dateStr = searchParams.get('date');

    // Target date: yesterday by default
    const targetDate = dateStr ? new Date(dateStr) : subDays(new Date(), 1);
    targetDate.setHours(0, 0, 0, 0);

    // Find all active compsets
    const compSets = await db.competitiveSet.findMany({
      where: { isActive: true },
      select: { id: true, tenantId: true, propertyId: true, name: true },
    });

    if (compSets.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'No active competitive sets found',
          processedCount: 0,
          date: targetDate.toISOString(),
        },
      });
    }

    let processedCount = 0;
    let errorCount = 0;
    const results: { competitiveSetId: string; name: string; status: string; error?: string }[] = [];

    for (const compSet of compSets) {
      try {
        const calculated = await calculateCompSetMetrics(
          compSet.propertyId,
          compSet.id,
          targetDate,
          'daily',
          compSet.tenantId
        );

        if (calculated) {
          await storeCompSetMetrics(
            compSet.id,
            compSet.tenantId,
            compSet.propertyId,
            calculated,
            'auto'
          );
          processedCount++;
          results.push({
            competitiveSetId: compSet.id,
            name: compSet.name,
            status: 'success',
          });
        } else {
          errorCount++;
          results.push({
            competitiveSetId: compSet.id,
            name: compSet.name,
            status: 'skipped',
            error: 'No metrics calculated',
          });
        }
      } catch (err) {
        errorCount++;
        results.push({
          competitiveSetId: compSet.id,
          name: compSet.name,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        console.error(`Error processing compset ${compSet.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Metrics sync completed: ${processedCount} processed, ${errorCount} errors`,
        date: targetDate.toISOString(),
        totalCompSets: compSets.length,
        processedCount,
        errorCount,
        results,
      },
    });
  } catch (error) {
    console.error('Error in compset metrics sync:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Compset metrics sync failed' } },
      { status: 500 }
    );
  }
}
