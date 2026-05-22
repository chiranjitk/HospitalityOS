/**
 * SLA ↔ Alert Bridge (F22)
 *
 * Bridges SLA breach data from WiFiSLAMetric into the F20 WiFiAlert system.
 * This service is designed to be called after the SLA metric collector cron
 * finishes measuring metrics.
 *
 * Key behaviours:
 * - Only processes configs where alertOnBreach = true
 * - Creates per-breach-type alerts (sla_uptime_breach, sla_speed_down_breach,
 *   sla_speed_up_breach, sla_latency_breach) instead of a generic sla_breach
 * - Avoids duplicate alerts — updates metadata on existing active/acknowledged
 *   alerts instead of creating new ones
 * - Resolves active alerts when the metric recovers
 * - Non-blocking: all errors are caught and logged, never thrown to the caller
 */

import { db } from '@/lib/db';
import { dispatchAlertNotifications } from '@/lib/wifi/services/wifi-alert-notifier';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

type BreachType = 'uptime' | 'speed_down' | 'speed_up' | 'latency';

const ALERT_TYPE_MAP: Record<BreachType, string> = {
  uptime: 'sla_uptime_breach',
  speed_down: 'sla_speed_down_breach',
  speed_up: 'sla_speed_up_breach',
  latency: 'sla_latency_breach',
};

interface BridgeResult {
  alertsCreated: number;
  alertsResolved: number;
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Check for SLA breaches and create/resolve WiFiAlert records.
 *
 * @param tenantId  - Scope to a single tenant (required when called from API)
 * @param propertyId - Optional; if provided, only processes this property
 * @returns Summary of alerts created and resolved
 */
export async function bridgeSLABreachesToAlerts(
  tenantId: string,
  propertyId?: string
): Promise<BridgeResult> {
  let alertsCreated = 0;
  let alertsResolved = 0;

  try {
    // 1. Find all SLA configs with alertOnBreach enabled
    const configs = await db.wiFiSLAConfig.findMany({
      where: {
        tenantId,
        alertOnBreach: true,
        ...(propertyId ? { propertyId } : {}),
      },
      include: {
        property: { select: { id: true, name: true } },
      },
    });

    if (configs.length === 0) {
      return { alertsCreated: 0, alertsResolved: 0 };
    }

    for (const config of configs) {
      try {
        const result = await processConfig(config);
        alertsCreated += result.created;
        alertsResolved += result.resolved;
      } catch (err) {
        console.error(
          `[SLABridge] Error processing config ${config.id} (property ${config.propertyId}):`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  } catch (err) {
    console.error(
      '[SLABridge] Fatal error:',
      err instanceof Error ? err.message : String(err)
    );
  }

  return { alertsCreated, alertsResolved };
}

// ────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────

async function processConfig(config: {
  id: string;
  tenantId: string;
  propertyId: string;
  uptimeTarget: number;
  speedTargetDown: number;
  speedTargetUp: number;
  latencyTarget: number;
  property: { id: string; name: string } | null;
}): Promise<{ created: number; resolved: number }> {
  let created = 0;
  let resolved = 0;

  const propertyName = config.property?.name || config.propertyId;

  // 2. Fetch the most recent metric for this config
  const recentMetric = await db.wiFiSLAMetric.findFirst({
    where: { slaConfigId: config.id },
    orderBy: { periodStart: 'desc' },
  });

  if (!recentMetric) {
    return { created: 0, resolved: 0 };
  }

  // 3. Determine which breach types are currently active
  const activeBreaches: BreachType[] = [];
  if (recentMetric.actualUptime !== null && recentMetric.actualUptime < config.uptimeTarget) {
    activeBreaches.push('uptime');
  }
  if (recentMetric.avgSpeedDown !== null && recentMetric.avgSpeedDown < config.speedTargetDown) {
    activeBreaches.push('speed_down');
  }
  if (recentMetric.avgSpeedUp !== null && recentMetric.avgSpeedUp < config.speedTargetUp) {
    activeBreaches.push('speed_up');
  }
  if (recentMetric.avgLatency !== null && recentMetric.avgLatency > config.latencyTarget) {
    activeBreaches.push('latency');
  }

  // 4. Process each possible breach type
  const allTypes: BreachType[] = ['uptime', 'speed_down', 'speed_up', 'latency'];

  for (const breachType of allTypes) {
    const alertType = ALERT_TYPE_MAP[breachType];
    const isBreached = activeBreaches.includes(breachType);

    if (isBreached) {
      // ── Breach active ──
      const result = await handleActiveBreach({
        tenantId: config.tenantId,
        propertyId: config.propertyId,
        alertType,
        breachType,
        metric: recentMetric,
        config,
        propertyName,
      });
      if (result === 'created') created++;
    } else {
      // ── Breach resolved ──
      const didResolve = await handleResolvedBreach({
        tenantId: config.tenantId,
        propertyId: config.propertyId,
        alertType,
        breachType,
        metric: recentMetric,
        propertyName,
      });
      if (didResolve) resolved++;
    }
  }

  return { created, resolved };
}

async function handleActiveBreach(params: {
  tenantId: string;
  propertyId: string;
  alertType: string;
  breachType: BreachType;
  metric: {
    actualUptime: number | null;
    avgSpeedDown: number | null;
    avgSpeedUp: number | null;
    avgLatency: number | null;
    periodStart: Date;
    slaConfigId: string;
  };
  config: { id: string; uptimeTarget: number; speedTargetDown: number; speedTargetUp: number; latencyTarget: number };
  propertyName: string;
}): Promise<'created' | 'updated' | 'skipped'> {
  const { tenantId, propertyId, alertType, breachType, metric, config, propertyName } = params;

  // Check if an active/acknowledged alert already exists for this type
  const existingAlert = await db.wiFiAlert.findFirst({
    where: {
      tenantId,
      propertyId,
      type: alertType,
      status: { in: ['active', 'acknowledged'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  const metadata = buildMetadata({
    slaConfigId: config.id,
    breachType,
    metric,
    config,
    propertyName,
  });

  if (existingAlert) {
    // Update metadata with latest values (avoid duplicate alerts)
    await db.wiFiAlert.update({
      where: { id: existingAlert.id },
      data: { metadata: JSON.stringify(metadata) },
    });
    return 'updated';
  }

  // Create new alert
  const severity = breachType === 'uptime' ? 'critical' : 'warning';
  const title = formatAlertTitle(breachType);
  const message = formatAlertMessage(breachType, propertyName, metric, config);

  const createdAlert = await db.wiFiAlert.create({
    data: {
      tenantId,
      propertyId,
      type: alertType,
      severity,
      title,
      message,
      source: propertyName,
      metadata: JSON.stringify(metadata),
      status: 'active',
    },
  });

  // Fire-and-forget: notify staff without blocking breach processing
  dispatchAlertNotifications(createdAlert).catch(() => {});

  console.info(
    `[SLABridge] Created ${alertType} alert for property ${propertyId}`
  );

  return 'created';
}

async function handleResolvedBreach(params: {
  tenantId: string;
  propertyId: string;
  alertType: string;
  breachType: BreachType;
  metric: {
    actualUptime: number | null;
    avgSpeedDown: number | null;
    avgSpeedUp: number | null;
    avgLatency: number | null;
  };
  propertyName: string;
}): Promise<boolean> {
  const { tenantId, propertyId, alertType, breachType, metric, propertyName } = params;

  // Find an active/acknowledged alert for this breach type
  const activeAlert = await db.wiFiAlert.findFirst({
    where: {
      tenantId,
      propertyId,
      type: alertType,
      status: { in: ['active', 'acknowledged'] },
    },
  });

  if (!activeAlert) return false;

  const currentValue = getBreachValue(breachType, metric);
  const unit = getBreachUnit(breachType);

  await db.wiFiAlert.update({
    where: { id: activeAlert.id },
    data: {
      status: 'resolved',
      resolvedAt: new Date(),
      resolveNote: `SLA ${breachType} restored at ${propertyName}: ${currentValue}${unit}`,
    },
  });

  console.info(
    `[SLABridge] Resolved ${alertType} alert for property ${propertyId}`
  );

  return true;
}

// ────────────────────────────────────────────────────────────
// Formatting helpers
// ────────────────────────────────────────────────────────────

function buildMetadata(params: {
  slaConfigId: string;
  breachType: BreachType;
  metric: {
    actualUptime: number | null;
    avgSpeedDown: number | null;
    avgSpeedUp: number | null;
    avgLatency: number | null;
    periodStart: Date;
  };
  config: { uptimeTarget: number; speedTargetDown: number; speedTargetUp: number; latencyTarget: number };
  propertyName: string;
}): Record<string, unknown> {
  const { slaConfigId, breachType, metric, config, propertyName } = params;
  return {
    slaConfigId,
    breachType,
    value: getBreachValue(breachType, metric),
    threshold: getBreachThreshold(breachType, config),
    unit: getBreachUnit(breachType),
    propertyName,
    measuredAt: metric.periodStart.toISOString(),
    allMetrics: {
      actualUptime: metric.actualUptime,
      avgSpeedDown: metric.avgSpeedDown,
      avgSpeedUp: metric.avgSpeedUp,
      avgLatency: metric.avgLatency,
    },
  };
}

function getBreachValue(type: BreachType, metric: {
  actualUptime: number | null;
  avgSpeedDown: number | null;
  avgSpeedUp: number | null;
  avgLatency: number | null;
}): number | null {
  switch (type) {
    case 'uptime': return metric.actualUptime;
    case 'speed_down': return metric.avgSpeedDown;
    case 'speed_up': return metric.avgSpeedUp;
    case 'latency': return metric.avgLatency;
  }
}

function getBreachThreshold(type: BreachType, config: {
  uptimeTarget: number;
  speedTargetDown: number;
  speedTargetUp: number;
  latencyTarget: number;
}): number {
  switch (type) {
    case 'uptime': return config.uptimeTarget;
    case 'speed_down': return config.speedTargetDown;
    case 'speed_up': return config.speedTargetUp;
    case 'latency': return config.latencyTarget;
  }
}

function getBreachUnit(type: BreachType): string {
  switch (type) {
    case 'uptime': return '%';
    case 'speed_down':
    case 'speed_up':
      return ' Mbps';
    case 'latency': return ' ms';
  }
}

function formatAlertTitle(type: BreachType): string {
  switch (type) {
    case 'uptime': return 'SLA Breach: WiFi Uptime';
    case 'speed_down': return 'SLA Breach: Download Speed';
    case 'speed_up': return 'SLA Breach: Upload Speed';
    case 'latency': return 'SLA Breach: Latency';
  }
}

function formatAlertMessage(
  type: BreachType,
  propertyName: string,
  metric: {
    actualUptime: number | null;
    avgSpeedDown: number | null;
    avgSpeedUp: number | null;
    avgLatency: number | null;
  },
  config: { uptimeTarget: number; speedTargetDown: number; speedTargetUp: number; latencyTarget: number }
): string {
  const value = getBreachValue(type, metric);
  const threshold = getBreachThreshold(type, config);
  const unit = getBreachUnit(type);

  switch (type) {
    case 'uptime':
      return `WiFi uptime at ${propertyName} dropped to ${value}% (target: ${threshold}%)`;
    case 'speed_down':
      return `Download speed at ${propertyName} is ${value} Mbps (target: ${threshold} Mbps)`;
    case 'speed_up':
      return `Upload speed at ${propertyName} is ${value} Mbps (target: ${threshold} Mbps)`;
    case 'latency':
      return `WiFi latency at ${propertyName} is ${value} ms (target: ${threshold} ms)`;
  }
}
