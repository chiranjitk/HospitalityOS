/**
 * WiFi SLA Compliance Report API
 *
 * GET — Overall SLA compliance report with uptime, speed, latency compliance and breach tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const TENANT_ID = 'tenant_01';

export async function GET(request: NextRequest) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all SLA configs and their latest metrics
    const configs = await db.wiFiSLAConfig.findMany({
      where: { tenantId: TENANT_ID },
      include: {
        property: { select: { id: true, name: true } },
        metrics: {
          where: { periodStart: { gte: thirtyDaysAgo } },
          orderBy: { periodStart: 'desc' },
        },
      },
    });

    if (configs.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          overallCompliance: {
            uptimeCompliance: null,
            speedDownCompliance: null,
            speedUpCompliance: null,
            latencyCompliance: null,
            overallScore: null,
          },
          breachSummary: { totalBreaches: 0, byType: {}, trend: [] },
          propertyCompliance: [],
        },
      });
    }

    // Calculate compliance per config
    let totalUptimeCompliant = 0;
    let totalSpeedDownCompliant = 0;
    let totalSpeedUpCompliant = 0;
    let totalLatencyCompliant = 0;
    let totalMetrics = 0;
    let totalBreaches = 0;
    const breachByType: Record<string, number> = {};
    const breachTrend: { date: string; count: number }[] = [];

    const propertyCompliance = configs.map(config => {
      const metrics = config.metrics;
      const latestMetric = metrics[0];

      if (!latestMetric) {
        return {
          propertyId: config.propertyId,
          propertyName: config.property.name,
          uptimeTarget: config.uptimeTarget,
          speedTargetDown: config.speedTargetDown,
          speedTargetUp: config.speedTargetUp,
          latencyTarget: config.latencyTarget,
          actualUptime: null,
          actualSpeedDown: null,
          actualSpeedUp: null,
          actualLatency: null,
          uptimeCompliant: null,
          speedDownCompliant: null,
          speedUpCompliant: null,
          latencyCompliant: null,
          breachCount: 0,
        };
      }

      // Compliance checks
      const uptimeOk = latestMetric.actualUptime !== null
        ? latestMetric.actualUptime >= config.uptimeTarget
        : null;
      const speedDownOk = latestMetric.avgSpeedDown !== null
        ? latestMetric.avgSpeedDown >= config.speedTargetDown
        : null;
      const speedUpOk = latestMetric.avgSpeedUp !== null
        ? latestMetric.avgSpeedUp >= config.speedTargetUp
        : null;
      const latencyOk = latestMetric.avgLatency !== null
        ? latestMetric.avgLatency <= config.latencyTarget
        : null;

      if (uptimeOk !== null) { totalMetrics++; if (uptimeOk) totalUptimeCompliant++; }
      if (speedDownOk !== null) { totalMetrics++; if (speedDownOk) totalSpeedDownCompliant++; }
      if (speedUpOk !== null) { totalMetrics++; if (speedUpOk) totalSpeedUpCompliant++; }
      if (latencyOk !== null) { totalMetrics++; if (latencyOk) totalLatencyCompliant++; }

      // Count breaches for this config
      const configBreaches = metrics.filter(m => m.breached).length;
      totalBreaches += configBreaches;

      // Parse breach types
      metrics.forEach(m => {
        if (m.breached && m.breachTypes) {
          try {
            const types = typeof m.breachTypes === 'string' ? JSON.parse(m.breachTypes) : m.breachTypes;
            (Array.isArray(types) ? types : []).forEach((type: string) => {
              breachByType[type] = (breachByType[type] || 0) + 1;
            });
          } catch {
            // Skip malformed
          }
        }
      });

      return {
        propertyId: config.propertyId,
        propertyName: config.property.name,
        configId: config.id,
        uptimeTarget: config.uptimeTarget,
        speedTargetDown: config.speedTargetDown,
        speedTargetUp: config.speedTargetUp,
        latencyTarget: config.latencyTarget,
        actualUptime: latestMetric.actualUptime,
        actualSpeedDown: latestMetric.avgSpeedDown,
        actualSpeedUp: latestMetric.avgSpeedUp,
        actualLatency: latestMetric.avgLatency,
        uptimeCompliant: uptimeOk,
        speedDownCompliant: speedDownOk,
        speedUpCompliant: speedUpOk,
        latencyCompliant: latencyOk,
        breachCount: configBreaches,
        totalPeriods: metrics.length,
      };
    });

    // Build breach trend (daily for last 30 days)
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      let dayBreachCount = 0;
      configs.forEach(config => {
        dayBreachCount += config.metrics.filter(m => {
          const d = new Date(m.periodStart);
          return d >= dayStart && d <= dayEnd && m.breached;
        }).length;
      });

      breachTrend.push({
        date: dayStart.toISOString().split('T')[0],
        count: dayBreachCount,
      });
    }

    // Calculate overall compliance percentages
    const uptimeCompliancePct = metricsCount(totalUptimeCompliant, configs.length);
    const speedDownCompliancePct = metricsCount(totalSpeedDownCompliant, configs.length);
    const speedUpCompliancePct = metricsCount(totalSpeedUpCompliant, configs.length);
    const latencyCompliancePct = metricsCount(totalLatencyCompliant, configs.length);

    const overallScore = [uptimeCompliancePct, speedDownCompliancePct, speedUpCompliancePct, latencyCompliancePct]
      .filter(v => v !== null) as number[];
    const avgOverall = overallScore.length > 0
      ? Math.round(overallScore.reduce((s, v) => s + v, 0) / overallScore.length * 10) / 10
      : null;

    return NextResponse.json({
      success: true,
      data: {
        overallCompliance: {
          uptimeCompliance: uptimeCompliancePct,
          speedDownCompliance: speedDownCompliancePct,
          speedUpCompliance: speedUpCompliancePct,
          latencyCompliance: latencyCompliancePct,
          overallScore: avgOverall,
        },
        breachSummary: {
          totalBreaches,
          byType: breachByType,
          trend: breachTrend,
        },
        propertyCompliance,
      },
    });
  } catch (error) {
    console.error('Error fetching SLA compliance report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SLA compliance report' },
      { status: 500 }
    );
  }
}

function metricsCount(compliant: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((compliant / total) * 1000) / 10;
}
