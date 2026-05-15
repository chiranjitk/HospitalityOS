import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/payments/fraud/stats - Return fraud statistics
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['admin.*', 'billing.manage', 'payments.view'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const days = parseInt(searchParams.get('days') || '30', 10);

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalAlerts,
      openAlerts,
      confirmedFraud,
      dismissedAlerts,
      alertsBySeverity,
      alertsByType,
      recentAlertsTrend,
      rulesCount,
      activeRulesCount,
      highRiskPayments,
      totalBlockedAmount,
      avgRiskScoreResult,
    ] = await Promise.all([
      // Total alerts in period
      db.fraudAlert.count({
        where: {
          tenantId: user.tenantId,
          createdAt: { gte: since },
        },
      }),

      // Open alerts
      db.fraudAlert.count({
        where: {
          tenantId: user.tenantId,
          status: 'open',
        },
      }),

      // Confirmed fraud
      db.fraudAlert.count({
        where: {
          tenantId: user.tenantId,
          status: 'confirmed_fraud',
          createdAt: { gte: since },
        },
      }),

      // Dismissed alerts
      db.fraudAlert.count({
        where: {
          tenantId: user.tenantId,
          status: 'dismissed',
          createdAt: { gte: since },
        },
      }),

      // Alerts by severity
      db.fraudAlert.groupBy({
        by: ['severity'],
        where: {
          tenantId: user.tenantId,
          createdAt: { gte: since },
        },
        _count: { id: true },
        _avg: { riskScore: true },
      }),

      // Alerts by type
      db.fraudAlert.groupBy({
        by: ['alertType'],
        where: {
          tenantId: user.tenantId,
          createdAt: { gte: since },
        },
        _count: { id: true },
        _avg: { riskScore: true },
      }),

      // Recent trend: alerts per day (last 7 days)
      db.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT DATE("createdAt") as date, COUNT(*)::bigint as count
        FROM "FraudAlert"
        WHERE "tenantId" = ${user.tenantId}
          AND "createdAt" >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,

      // Total rules
      db.fraudDetectionRule.count({
        where: { tenantId: user.tenantId },
      }),

      // Active rules
      db.fraudDetectionRule.count({
        where: { tenantId: user.tenantId, isEnabled: true },
      }),

      // High risk payments (risk score >= 50)
      db.fraudAlert.findMany({
        where: {
          tenantId: user.tenantId,
          riskScore: { gte: 50 },
          paymentId: { not: null },
          createdAt: { gte: since },
        },
        select: {
          id: true,
          paymentId: true,
          riskScore: true,
          alertType: true,
          createdAt: true,
          payment: {
            select: {
              id: true,
              amount: true,
              currency: true,
            },
          },
        },
        orderBy: { riskScore: 'desc' },
        take: 10,
      }),

      // Total blocked amount (from confirmed fraud alerts with payments)
      db.fraudAlert.aggregate({
        where: {
          tenantId: user.tenantId,
          status: 'confirmed_fraud',
          paymentId: { not: null },
          createdAt: { gte: since },
        },
        _count: { id: true },
      }),

      // Average risk score across all alerts in the period
      db.fraudAlert.aggregate({
        where: {
          tenantId: user.tenantId,
          createdAt: { gte: since },
        },
        _avg: { riskScore: true },
        _count: { id: true },
      }),
    ]);

    // Get total blocked amount from payments linked to confirmed fraud alerts
    const confirmedFraudPaymentIds = await db.fraudAlert.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'confirmed_fraud',
        paymentId: { not: null },
      },
      select: { paymentId: true },
      distinct: ['paymentId'],
    });

    let blockedAmount = 0;
    if (confirmedFraudPaymentIds.length > 0) {
      const blockedPayments = await db.payment.aggregate({
        where: {
          id: { in: confirmedFraudPaymentIds.map(a => a.paymentId!).filter(Boolean) },
        },
        _sum: { amount: true },
      });
      blockedAmount = blockedPayments._sum.amount || 0;
    }

    // Calculate fraud rate
    const totalPaymentsInPeriod = await db.payment.count({
      where: {
        tenantId: user.tenantId,
        status: 'completed',
        createdAt: { gte: since },
      },
    });

    const fraudRate = totalPaymentsInPeriod > 0
      ? ((confirmedFraud / totalPaymentsInPeriod) * 100).toFixed(2)
      : '0.00';

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalAlerts,
          openAlerts,
          confirmedFraud,
          dismissedAlerts,
          fraudRate: parseFloat(fraudRate),
          totalPaymentsInPeriod,
          blockedAmount,
          averageRiskScore: avgRiskScoreResult._count.id > 0
            ? Math.round(avgRiskScoreResult._avg.riskScore || 0)
            : 0,
        },
        alertsBySeverity: alertsBySeverity.map(s => ({
          severity: s.severity,
          count: s._count.id,
        })),
        alertsByType: alertsByType.map(t => ({
          type: t.alertType,
          count: t._count.id,
          avgRiskScore: t._avg.riskScore ? Math.round(t._avg.riskScore) : 0,
        })),
        recentTrend: recentAlertsTrend.map(t => ({
          date: t.date,
          count: Number(t.count),
        })),
        rules: {
          total: rulesCount,
          active: activeRulesCount,
        },
        highRiskPayments,
      },
    });
  } catch (error) {
    console.error('Error fetching fraud stats:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch fraud statistics' } },
      { status: 500 }
    );
  }
}
