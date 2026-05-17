import { NextRequest, NextResponse } from 'next/server';
import { predictAndLogCancellationRisk, runBatchPredictions } from '@/lib/revenue/cancellation-predictor';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const riskLevel = searchParams.get('riskLevel');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const propertyId = searchParams.get('propertyId');
    const autoRun = searchParams.get('auto-run');

    // Auto-run mode: predict for all upcoming bookings
    if (autoRun === 'true') {
      const batchResult = await runBatchPredictions(tenantId, propertyId || undefined);

      // Summarize by risk level
      const riskSummary = {
        total: batchResult.results.length,
        low: batchResult.results.filter(r => r.riskLevel === 'low').length,
        medium: batchResult.results.filter(r => r.riskLevel === 'medium').length,
        high: batchResult.results.filter(r => r.riskLevel === 'high').length,
        critical: batchResult.results.filter(r => r.riskLevel === 'critical').length,
        avgRiskScore: batchResult.results.length > 0
          ? batchResult.results.reduce((s, r) => s + r.riskScore, 0) / batchResult.results.length
          : 0,
      };

      return NextResponse.json({
        success: true,
        data: {
          processed: batchResult.processed,
          riskSummary,
        },
      });
    }

    // List predictions with filters
    const where: Record<string, unknown> = { tenantId };

    if (riskLevel) where.riskLevel = riskLevel;
    if (propertyId) where.propertyId = propertyId;
    if (startDate || endDate) {
      where.predictedAt = {};
      if (startDate) (where.predictedAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.predictedAt as Record<string, unknown>).lte = new Date(endDate);
    }

    const { db } = await import('@/lib/db');
    const predictions = await db.cancellationPredictionLog.findMany({
      where,
      orderBy: { predictedAt: 'desc' },
      take: 100,
    });

    // Summary stats
    const allPredictions = await db.cancellationPredictionLog.findMany({
      where: { tenantId, ...(propertyId ? { propertyId } : {}) },
      select: { riskLevel: true, riskScore: true },
    });

    const summary = {
      total: allPredictions.length,
      low: allPredictions.filter(p => p.riskLevel === 'low').length,
      medium: allPredictions.filter(p => p.riskLevel === 'medium').length,
      high: allPredictions.filter(p => p.riskLevel === 'high').length,
      critical: allPredictions.filter(p => p.riskLevel === 'critical').length,
      avgRiskScore: allPredictions.length > 0
        ? allPredictions.reduce((s, p) => s + p.riskScore, 0) / allPredictions.length
        : 0,
    };

    return NextResponse.json({
      success: true,
      data: predictions,
      summary,
    });
  } catch (error) {
    console.error('Error in cancellation predictions GET:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { bookingId, bookingIds } = body;

    // Single booking prediction
    if (bookingId) {
      const result = await predictAndLogCancellationRisk(bookingId, tenantId);
      if (!result) {
        return NextResponse.json(
          { success: false, error: 'Booking not found or unauthorized' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: result });
    }

    // Batch prediction
    if (Array.isArray(bookingIds) && bookingIds.length > 0) {
      const results = [];
      for (const id of bookingIds) {
        const result = await predictAndLogCancellationRisk(id, tenantId);
        if (result) results.push({ bookingId: id, ...result });
      }
      return NextResponse.json({ success: true, data: results, count: results.length });
    }

    return NextResponse.json(
      { success: false, error: 'Provide bookingId or bookingIds' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in cancellation predictions POST:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run prediction' },
      { status: 500 }
    );
  }
}
