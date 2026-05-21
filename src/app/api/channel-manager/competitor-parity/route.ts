/**
 * Competitor Rate → Parity Bridge API
 *
 * GET /api/channel-manager/competitor-parity
 *
 * Merges channel rate parity data with competitor pricing data to provide
 * a comprehensive rate comparison view. Highlights parity violations
 * (PMS rate < competitor rate by > threshold) and suggests rate adjustments
 * to maintain competitive positioning.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';

// ============================================
// TYPES
// ============================================

/** Merged parity entry showing PMS, channel, and competitor rates side by side */
interface CompetitorParityEntry {
  date: string;
  roomTypeId: string;
  roomTypeName: string;
  channelName: string;
  channelId: string;
  pmsRate: number;
  channelRate: number;
  competitorAvgRate: number;
  competitorMinRate: number;
  competitorMaxRate: number;
  deviationFromPms: number;
  deviationFromCompetitorAvg: number;
  parityStatus: 'matched' | 'undercut' | 'overpriced';
  isParityViolation: boolean;
  suggestedRate: number;
  suggestionReason: string;
}

/** Overall summary of parity + competitor analysis */
interface ParityBridgeSummary {
  totalEntries: number;
  parityViolations: number;
  undercutCount: number;
  overpricedCount: number;
  avgPmsRate: number;
  avgChannelRate: number;
  avgCompetitorRate: number;
  competitorsAnalyzed: number;
}

// ============================================
// GET HANDLER
// ============================================

export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'channels.manage');
    if (ctx instanceof NextResponse) return ctx;

    const tenantId = ctx.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || getDefaultEndDate();
    const threshold = searchParams.get('threshold') ? parseFloat(searchParams.get('threshold')!) : 5;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } },
        { status: 400 },
      );
    }

    // ---- Step 1: Fetch channel rates from internal parity API ----
    const parityUrl = new URL('/api/channel-manager/parity', request.url);
    parityUrl.searchParams.set('propertyId', propertyId);
    parityUrl.searchParams.set('startDate', startDate);
    parityUrl.searchParams.set('endDate', endDate);
    parityUrl.searchParams.set('threshold', String(threshold));

    let parityData: any = { success: false, data: { reports: [] } };
    try {
      const parityRes = await fetch(parityUrl.toString(), {
        headers: {
          'x-tenant-id': tenantId,
          // Forward cookies for auth
          cookie: request.headers.get('cookie') || '',
        },
      });
      parityData = await parityRes.json();
    } catch (err) {
      console.error('[CompetitorParity] Failed to fetch channel parity data:', err);
    }

    // ---- Step 2: Fetch competitor rates from competitor-pricing API ----
    const competitorUrl = new URL('/api/revenue/competitor-pricing', request.url);
    competitorUrl.searchParams.set('date', startDate);

    let competitorData: any = { success: false, data: { competitors: [], priceHistory: [], ourPrice: 0 } };
    try {
      const competitorRes = await fetch(competitorUrl.toString(), {
        headers: {
          'x-tenant-id': tenantId,
          cookie: request.headers.get('cookie') || '',
        },
      });
      competitorData = await competitorRes.json();
    } catch (err) {
      console.error('[CompetitorParity] Failed to fetch competitor pricing data:', err);
    }

    // ---- Step 3: Merge data ----
    const reports: any[] = parityData?.data?.reports || [];
    const competitors: any[] = competitorData?.data?.competitors || [];
    const priceHistory: any[] = competitorData?.data?.priceHistory || [];

    // Build a date-indexed map of competitor averages for quick lookup
    const competitorByDate = new Map<string, { avg: number; min: number; max: number }>();
    for (const entry of priceHistory) {
      competitorByDate.set(entry.date, {
        avg: entry.marketAverage || 0,
        min: entry.minPrice || 0,
        max: entry.maxPrice || 0,
      });
    }

    // Calculate overall competitor average across all dates
    const allCompetitorAvgs = priceHistory.map(e => e.marketAverage).filter(r => r > 0);
    const overallCompetitorAvg = allCompetitorAvgs.length > 0
      ? Math.round(allCompetitorAvgs.reduce((a, b) => a + b, 0) / allCompetitorAvgs.length * 100) / 100
      : 0;

    // ---- Step 4: Build merged parity entries ----
    const mergedEntries: CompetitorParityEntry[] = [];

    for (const report of reports) {
      const dateCompetitor = competitorByDate.get(report.date) || { avg: overallCompetitorAvg, min: 0, max: 0 };

      for (const channel of report.channels) {
        const deviationFromCompetitorAvg = dateCompetitor.avg > 0
          ? Math.round(((channel.channelRate - dateCompetitor.avg) / dateCompetitor.avg) * 10000) / 100
          : 0;

        // Detect parity violation: PMS rate < competitor average by more than threshold
        const isParityViolation = dateCompetitor.avg > 0
          && ((dateCompetitor.avg - report.pmsBaseRate) / dateCompetitor.avg) * 100 > threshold;

        // Suggest rate adjustments
        const { suggestedRate, suggestionReason } = computeSuggestedRate(
          report.pmsBaseRate,
          channel.channelRate,
          dateCompetitor.avg,
          channel.parityStatus,
          isParityViolation,
          threshold,
        );

        mergedEntries.push({
          date: report.date,
          roomTypeId: report.roomTypeId,
          roomTypeName: report.roomTypeName,
          channelName: channel.channelName,
          channelId: channel.channelId,
          pmsRate: report.pmsBaseRate,
          channelRate: channel.channelRate,
          competitorAvgRate: dateCompetitor.avg,
          competitorMinRate: dateCompetitor.min,
          competitorMaxRate: dateCompetitor.max,
          deviationFromPms: channel.deviationPercent,
          deviationFromCompetitorAvg,
          parityStatus: channel.parityStatus,
          isParityViolation,
          suggestedRate,
          suggestionReason,
        });
      }
    }

    // ---- Step 5: Build summary ----
    const pmsRates = mergedEntries.map(e => e.pmsRate).filter(r => r > 0);
    const channelRates = mergedEntries.map(e => e.channelRate).filter(r => r > 0);
    const competitorRates = mergedEntries.map(e => e.competitorAvgRate).filter(r => r > 0);

    const summary: ParityBridgeSummary = {
      totalEntries: mergedEntries.length,
      parityViolations: mergedEntries.filter(e => e.isParityViolation).length,
      undercutCount: mergedEntries.filter(e => e.parityStatus === 'undercut').length,
      overpricedCount: mergedEntries.filter(e => e.parityStatus === 'overpriced').length,
      avgPmsRate: pmsRates.length > 0 ? Math.round(pmsRates.reduce((a, b) => a + b, 0) / pmsRates.length * 100) / 100 : 0,
      avgChannelRate: channelRates.length > 0 ? Math.round(channelRates.reduce((a, b) => a + b, 0) / channelRates.length * 100) / 100 : 0,
      avgCompetitorRate: competitorRates.length > 0 ? Math.round(competitorRates.reduce((a, b) => a + b, 0) / competitorRates.length * 100) / 100 : 0,
      competitorsAnalyzed: competitors.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        entries: mergedEntries,
        summary,
        competitors,
        parameters: {
          propertyId,
          startDate,
          endDate,
          threshold,
        },
      },
    });
  } catch (error) {
    console.error('[CompetitorParity] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate competitor parity report' } },
      { status: 500 },
    );
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Compute a suggested rate and the reasoning behind it.
 * Considers PMS rate, channel rate, competitor average, and parity status.
 */
function computeSuggestedRate(
  pmsRate: number,
  channelRate: number,
  competitorAvg: number,
  parityStatus: string,
  isParityViolation: boolean,
  threshold: number,
): { suggestedRate: number; suggestionReason: string } {
  // If no competitor data, fall back to PMS rate
  if (competitorAvg <= 0) {
    return {
      suggestedRate: Math.round(pmsRate * 100) / 100,
      suggestionReason: 'No competitor data available. Maintain current PMS rate.',
    };
  }

  // Parity violation: PMS rate is significantly below competitor average
  if (isParityViolation) {
    // Suggest raising PMS rate toward competitor average, capped at competitor avg
    const suggested = Math.round(competitorAvg * 100) / 100;
    const gap = Math.round((competitorAvg - pmsRate) * 100) / 100;
    return {
      suggestedRate: suggested,
      suggestionReason: `Parity violation detected. PMS rate is $${gap} below competitor average ($${competitorAvg}). Consider raising to $${suggested} to stay competitive.`,
    };
  }

  // Channel is undercutting PMS
  if (parityStatus === 'undercut') {
    const suggested = Math.round(Math.min(pmsRate, competitorAvg) * 100) / 100;
    return {
      suggestedRate: suggested,
      suggestionReason: `Channel rate ($${channelRate}) undercuts PMS rate ($${pmsRate}). Align channel rate to $${suggested}.`,
    };
  }

  // Channel is overpriced relative to PMS
  if (parityStatus === 'overpriced') {
    const suggested = Math.round(pmsRate * 100) / 100;
    return {
      suggestedRate: suggested,
      suggestionReason: `Channel rate ($${channelRate}) exceeds PMS rate ($${pmsRate}) by >${threshold}%. Reduce channel rate to $${suggested}.`,
    };
  }

  // Rates are matched — suggest maintaining current position
  const suggested = Math.round(pmsRate * 100) / 100;
  const competitorDiff = Math.round(((pmsRate - competitorAvg) / competitorAvg) * 10000) / 100;
  return {
    suggestedRate: suggested,
    suggestionReason: `Rates are within ${threshold}% threshold. Current position is ${competitorDiff}% vs competitor average. No action needed.`,
  };
}

/** Get a default end date (7 days from start) */
function getDefaultEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}
