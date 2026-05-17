/**
 * Payment Fraud Detection Engine
 *
 * Provides comprehensive fraud detection for payment transactions.
 * Evaluates velocity, amount anomaly, rapid repeat, and pattern detection rules.
 * Supports custom tenant-specific rules via FraudDetectionRule model.
 */

import { db } from '@/lib/db';

export interface FraudCheckResult {
  allowed: boolean;
  riskScore: number; // 0-100
  alerts: Array<{
    type: string;
    severity: string;
    message: string;
  }>;
  action: 'allow' | 'flag' | 'block' | 'mfa_required';
}

interface FraudCheckParams {
  tenantId: string;
  amount: number;
  currency: string;
  userId?: string;
  ip?: string;
  deviceFingerprint?: string;
  paymentMethod: string;
  paymentId?: string;
}

interface VelocityResult {
  exceeded: boolean;
  count: number;
  limit: number;
  window: string;
}

// ── Velocity Check ──────────────────────────────────────────────────────

/**
 * Check payment velocity: how many payments have been made in a time window.
 * Limits: 10 per hour per user, 30 per hour per IP, 50 per day per user.
 */
async function checkVelocity(
  params: FraudCheckParams
): Promise<{ alerts: FraudCheckResult['alerts']; riskAdd: number }> {
  const alerts: FraudCheckResult['alerts'] = [];
  let riskAdd = 0;
  const now = new Date();

  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Per-user velocity checks
  if (params.userId) {
    const userPaymentsHour = await db.payment.count({
      where: {
        tenantId: params.tenantId,
        guestId: params.userId,
        status: { not: 'failed' },
        createdAt: { gte: oneHourAgo },
      },
    });

    if (userPaymentsHour >= 10) {
      alerts.push({
        type: 'velocity_exceeded',
        severity: 'high',
        message: `User has made ${userPaymentsHour} payments in the last hour (limit: 10)`,
      });
      riskAdd += 40;
    } else if (userPaymentsHour >= 5) {
      alerts.push({
        type: 'velocity_warning',
        severity: 'medium',
        message: `User has made ${userPaymentsHour} payments in the last hour (threshold: 5)`,
      });
      riskAdd += 15;
    }

    const userPaymentsDay = await db.payment.count({
      where: {
        tenantId: params.tenantId,
        guestId: params.userId,
        status: { not: 'failed' },
        createdAt: { gte: oneDayAgo },
      },
    });

    if (userPaymentsDay >= 30) {
      alerts.push({
        type: 'daily_velocity_exceeded',
        severity: 'high',
        message: `User has made ${userPaymentsDay} payments in the last 24 hours (limit: 30)`,
      });
      riskAdd += 35;
    }
  }

  // Per-IP velocity checks
  if (params.ip) {
    // We use the gateway reference or similar to track by IP
    // Since we don't store IP on payments directly, we look at recent fraud alerts
    // for this IP to track velocity
    const ipAlertsHour = await db.fraudAlert.count({
      where: {
        tenantId: params.tenantId,
        details: { contains: params.ip },
        createdAt: { gte: oneHourAgo },
      },
    });

    if (ipAlertsHour >= 15) {
      alerts.push({
        type: 'ip_velocity_exceeded',
        severity: 'critical',
        message: `IP ${params.ip} associated with ${ipAlertsHour} transactions in the last hour`,
      });
      riskAdd += 50;
    }
  }

  return { alerts, riskAdd };
}

// ── Amount Anomaly ──────────────────────────────────────────────────────

/**
 * Flag if amount is significantly above average for this tenant.
 * Threshold: amount > 3x average payment amount.
 */
async function checkAmountAnomaly(
  params: FraudCheckParams
): Promise<{ alerts: FraudCheckResult['alerts']; riskAdd: number }> {
  const alerts: FraudCheckResult['alerts'] = [];
  let riskAdd = 0;

  // Get average payment amount for this tenant
  const avgResult = await db.payment.aggregate({
    where: {
      tenantId: params.tenantId,
      status: 'completed',
      amount: { gt: 0 },
    },
    _avg: { amount: true },
    _count: { id: true },
  });

  const avgAmount = avgResult._avg.amount || 0;
  const totalCount = avgResult._count.id;

  // Need at least 5 payments to establish a baseline
  if (totalCount >= 5 && avgAmount > 0) {
    const ratio = params.amount / avgAmount;

    if (ratio >= 5) {
      alerts.push({
        type: 'amount_anomaly_extreme',
        severity: 'critical',
        message: `Amount $${params.amount.toFixed(2)} is ${(ratio).toFixed(1)}x the average $${avgAmount.toFixed(2)}`,
      });
      riskAdd += 50;
    } else if (ratio >= 3) {
      alerts.push({
        type: 'amount_anomaly',
        severity: 'high',
        message: `Amount $${params.amount.toFixed(2)} is ${ratio.toFixed(1)}x the average $${avgAmount.toFixed(2)}`,
      });
      riskAdd += 30;
    }
  }

  return { alerts, riskAdd };
}

// ── Rapid Repeat ────────────────────────────────────────────────────────

/**
 * Flag if the same user/IP has made multiple payments in a very short time
 * (within 5 minutes), suggesting automated or fraudulent behavior.
 */
async function checkRapidRepeat(
  params: FraudCheckParams
): Promise<{ alerts: FraudCheckResult['alerts']; riskAdd: number }> {
  const alerts: FraudCheckResult['alerts'] = [];
  let riskAdd = 0;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  if (params.userId) {
    const recentPayments = await db.payment.count({
      where: {
        tenantId: params.tenantId,
        guestId: params.userId,
        status: { not: 'failed' },
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (recentPayments >= 3) {
      alerts.push({
        type: 'rapid_repeat_critical',
        severity: 'critical',
        message: `${recentPayments} payments from this user in the last 5 minutes`,
      });
      riskAdd += 45;
    } else if (recentPayments >= 2) {
      alerts.push({
        type: 'rapid_repeat',
        severity: 'medium',
        message: `${recentPayments} payments from this user in the last 5 minutes`,
      });
      riskAdd += 20;
    }

    // Check for sequential/round amounts in 15 min window
    const recentPaymentsList = await db.payment.findMany({
      where: {
        tenantId: params.tenantId,
        guestId: params.userId,
        status: { not: 'failed' },
        createdAt: { gte: fifteenMinutesAgo },
      },
      select: { amount: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (recentPaymentsList.length >= 2) {
      const amounts = recentPaymentsList.map(p => p.amount);

      // Check for all round amounts (e.g., 100, 200, 500)
      const allRound = amounts.every(a => a % 100 === 0);
      if (allRound && amounts.length >= 3) {
        alerts.push({
          type: 'round_amount_pattern',
          severity: 'medium',
          message: `Multiple round-amount payments detected: $${amounts.join(', $')}`,
        });
        riskAdd += 15;
      }

      // Check for sequential amounts (e.g., 100, 200, 300)
      if (amounts.length >= 3) {
        const diffs = amounts.slice(1).map((a, i) => a - amounts[i]);
        const allSameDiff = diffs.every(d => d === diffs[0]) && diffs[0] > 0;
        if (allSameDiff) {
          alerts.push({
            type: 'sequential_amount_pattern',
            severity: 'high',
            message: `Sequential payment amounts detected: $${amounts.join(', $')}`,
          });
          riskAdd += 25;
        }
      }
    }
  }

  return { alerts, riskAdd };
}

// ── Pattern Detection ───────────────────────────────────────────────────

/**
 * Detect known fraud patterns:
 * - Round amounts (multiples of 100)
 * - Multiple payments from new device fingerprint
 */
async function checkPatterns(
  params: FraudCheckParams
): Promise<{ alerts: FraudCheckResult['alerts']; riskAdd: number }> {
  const alerts: FraudCheckResult['alerts'] = [];
  let riskAdd = 0;

  // Round amount check for large payments
  if (params.amount > 500 && params.amount % 100 === 0) {
    alerts.push({
      type: 'round_amount_large',
      severity: 'low',
      message: `Large round-amount payment: $${params.amount.toFixed(2)}`,
    });
    riskAdd += 10;
  }

  // Very small amount probe (card testing)
  if (params.amount < 1.5 && params.paymentMethod === 'card') {
    const recentSmallPayments = await db.payment.count({
      where: {
        tenantId: params.tenantId,
        guestId: params.userId,
        status: { not: 'failed' },
        amount: { lt: 2 },
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (recentSmallPayments >= 3) {
      alerts.push({
        type: 'card_testing suspected',
        severity: 'high',
        message: `${recentSmallPayments} small payments in the last hour - possible card testing`,
      });
      riskAdd += 45;
    }
  }

  // Device fingerprint check
  if (params.deviceFingerprint) {
    const recentDevicePayments = await db.payment.count({
      where: {
        tenantId: params.tenantId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    // We don't store device fingerprint on payments directly,
    // but we can check fraud alerts for the same device
    const deviceAlerts = await db.fraudAlert.count({
      where: {
        tenantId: params.tenantId,
        details: { contains: params.deviceFingerprint },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (deviceAlerts >= 3) {
      alerts.push({
        type: 'device_fingerprint_linked_fraud',
        severity: 'high',
        message: `Device fingerprint linked to ${deviceAlerts} previous fraud alerts`,
      });
      riskAdd += 35;
    }
  }

  return { alerts, riskAdd };
}

// ── Custom Tenant Rules ─────────────────────────────────────────────────

interface CustomRuleCheckResult {
  alerts: FraudCheckResult['alerts'];
  riskAdd: number;
  shouldBlock: boolean;
  requiresMfa: boolean;
}

/**
 * Evaluate custom tenant-specific fraud detection rules.
 */
async function checkCustomRules(
  params: FraudCheckParams
): Promise<CustomRuleCheckResult> {
  const alerts: FraudCheckResult['alerts'] = [];
  let riskAdd = 0;
  let shouldBlock = false;
  let requiresMfa = false;

  const rules = await db.fraudDetectionRule.findMany({
    where: {
      tenantId: params.tenantId,
      isEnabled: true,
    },
  });

  for (const rule of rules) {
    let conditions: Record<string, unknown>;
    try {
      conditions = JSON.parse(rule.conditions);
    } catch {
      continue;
    }

    let triggered = false;

    switch (rule.ruleType) {
      case 'velocity': {
        const { maxPayments, windowMinutes } = conditions as { maxPayments?: number; windowMinutes?: number };
        if (maxPayments && windowMinutes && params.userId) {
          const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
          const count = await db.payment.count({
            where: {
              tenantId: params.tenantId,
              guestId: params.userId,
              status: { not: 'failed' },
              createdAt: { gte: windowStart },
            },
          });
          if (count >= maxPayments) {
            triggered = true;
          }
        }
        break;
      }

      case 'amount': {
        const { maxAmount, minAmount } = conditions as { maxAmount?: number; minAmount?: number };
        if (maxAmount && params.amount > maxAmount) {
          triggered = true;
        }
        if (minAmount && params.amount < minAmount) {
          triggered = true;
        }
        break;
      }

      case 'geolocation': {
        const { blockedCountries, blockedIps } = conditions as { blockedCountries?: string[]; blockedIps?: string[] };
        if (blockedIps?.length && params.ip && blockedIps.includes(params.ip)) {
          triggered = true;
        }
        break;
      }

      case 'pattern': {
        const { blockRoundAmounts, maxRoundAmount } = conditions as { blockRoundAmounts?: boolean; maxRoundAmount?: number };
        if (blockRoundAmounts && maxRoundAmount && params.amount <= maxRoundAmount && params.amount % 100 === 0) {
          triggered = true;
        }
        break;
      }

      case 'device_fingerprint': {
        const { blockNewDevices, blockedFingerprints } = conditions as { blockNewDevices?: boolean; blockedFingerprints?: string[] };
        if (blockedFingerprints?.length && params.deviceFingerprint && blockedFingerprints.includes(params.deviceFingerprint)) {
          triggered = true;
        }
        break;
      }
    }

    if (triggered) {
      const severityMap: Record<string, number> = {
        low: 5,
        medium: 15,
        high: 30,
        critical: 50,
      };
      riskAdd += severityMap[rule.severity] || 15;

      alerts.push({
        type: `custom_rule:${rule.ruleType}`,
        severity: rule.severity,
        message: `Custom rule "${rule.name}" triggered`,
      });

      if (rule.action === 'block') {
        shouldBlock = true;
      } else if (rule.action === 'mfa_required') {
        requiresMfa = true;
      }
    }
  }

  return { alerts, riskAdd, shouldBlock, requiresMfa };
}

// ── Main Evaluation Function ────────────────────────────────────────────

/**
 * Evaluate a transaction for fraud risk.
 * Runs all built-in checks and custom tenant rules.
 */
export async function evaluateTransaction(
  params: FraudCheckParams
): Promise<FraudCheckResult> {
  const allAlerts: FraudCheckResult['alerts'] = [];
  let totalRiskScore = 0;
  let shouldBlock = false;
  let requiresMfa = false;

  // Run all checks in parallel
  const [velocityResult, amountResult, rapidResult, patternResult, customResult] =
    await Promise.all([
      checkVelocity(params),
      checkAmountAnomaly(params),
      checkRapidRepeat(params),
      checkPatterns(params),
      checkCustomRules(params),
    ]);

  // Aggregate results
  allAlerts.push(
    ...velocityResult.alerts,
    ...amountResult.alerts,
    ...rapidResult.alerts,
    ...patternResult.alerts,
    ...customResult.alerts
  );

  totalRiskScore = Math.min(
    100,
    velocityResult.riskAdd +
    amountResult.riskAdd +
    rapidResult.riskAdd +
    patternResult.riskAdd +
    customResult.riskAdd
  );

  if (customResult.shouldBlock) {
    shouldBlock = true;
  }
  if (customResult.requiresMfa) {
    requiresMfa = true;
  }

  // Determine action based on risk score
  let action: FraudCheckResult['action'] = 'allow';

  if (shouldBlock || totalRiskScore >= 70) {
    action = 'block';
  } else if (requiresMfa || totalRiskScore >= 50) {
    action = 'mfa_required';
  } else if (totalRiskScore >= 25) {
    action = 'flag';
  }

  // Create fraud alerts in the database for any detected issues
  if (allAlerts.length > 0) {
    try {
      await db.fraudAlert.createMany({
        data: allAlerts.map(alert => ({
          tenantId: params.tenantId,
          userId: params.userId,
          paymentId: params.paymentId,
          alertType: alert.type,
          severity: alert.severity,
          riskScore: totalRiskScore,
          status: action === 'block' ? 'open' : 'open',
          details: JSON.stringify({
            message: alert.message,
            amount: params.amount,
            currency: params.currency,
            paymentMethod: params.paymentMethod,
            ip: params.ip,
            deviceFingerprint: params.deviceFingerprint,
          }),
        })),
      });
    } catch (error) {
      console.error('Failed to create fraud alerts:', error);
    }
  }

  return {
    allowed: action === 'allow',
    riskScore: totalRiskScore,
    alerts: allAlerts,
    action,
  };
}
