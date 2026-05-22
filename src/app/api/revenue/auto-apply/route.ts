import { NextRequest, NextResponse } from 'next/server';
import { runScheduledPricingUpdate } from '@/lib/revenue/pricing-scheduler';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Get recent scheduler runs
    const runs = await db.pricingSchedulerLog.findMany({
      where: {
        tenantId,
        ...(propertyId ? { propertyId } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    // Get last run status
    const lastRun = runs[0] || null;

    // Calculate next scheduled run (simulated: every 6 hours from last run)
    let nextScheduledRun: string | null = null;
    if (lastRun && lastRun.startedAt) {
      const next = new Date(lastRun.startedAt.getTime() + 6 * 60 * 60 * 1000);
      nextScheduledRun = next.toISOString();
    }

    return NextResponse.json({
      success: true,
      data: { runs, lastRun, nextScheduledRun },
    });
  } catch (error) {
    console.error('Error fetching auto-apply status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'revenue.manage');
    if (ctx instanceof NextResponse) return ctx;

    const tenantId = ctx.tenantId;

    const body = await request.json();
    const propertyId = body.propertyId;

    // Run the scheduler
    const result = await runScheduledPricingUpdate(tenantId);

    return NextResponse.json({
      success: result.status === 'completed',
      data: result,
    });
  } catch (error) {
    console.error('Error running auto-apply:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run auto-apply' },
      { status: 500 }
    );
  }
}
