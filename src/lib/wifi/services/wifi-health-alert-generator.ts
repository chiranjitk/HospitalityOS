/**
 * StaySuite WiFi Health Alert Generator
 *
 * Bridges NAS health check results to WiFiAlert records.
 * Runs after each NAS health check cycle via cron scheduler.
 *
 * Responsibilities:
 *   1. Read last NAS health check result from memory cache
 *   2. Query NasHealthLog for recent offline transitions (last 2 minutes)
 *   3. Create WiFiAlert records for offline / high-latency NAS devices
 *   4. Dedup: skip if an active alert already exists for the same NAS IP + type
 *   5. Auto-resolve: if a previously-offline NAS is back online, resolve its alert
 *
 * Alert rules (configurable per-property via WiFiAlertConfig):
 *   - NAS went offline        → type: nas_offline, severity: critical
 *   - NAS latency > warning  → type: latency,     severity: warning
 *   - NAS latency > critical → type: latency,     severity: critical
 *   - NAS came back online   → auto-resolve active nas_offline alert
 *
 * Thresholds are read from WiFiAlertConfig table (global or per-property override).
 * Falls back to defaults: warning=200ms, critical=500ms.
 */

import { db } from '@/lib/db';
import { getLastNasHealthCheck } from './nas-health-check';
import type { NasHealthCheckResult, ProbeResult } from './nas-health-check';
import * as SELog from './session-engine-logger';
import { dispatchAlertNotifications } from './wifi-alert-notifier';

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

/** How far back to look for NasHealthLog offline entries (seconds) */
const OFFLINE_TRANSITION_WINDOW_SEC = 120;

/** Default latency thresholds (used when no DB config exists) */
const DEFAULT_LATENCY_WARNING_MS = 200;
const DEFAULT_LATENCY_CRITICAL_MS = 500;

// ─── Config cache (in-memory, refreshed each cycle) ──────────────────────────
interface AlertThresholds {
  latencyWarningMs: number;
  latencyCriticalMs: number;
  enabled: boolean;
}

let configCache: Map<string, AlertThresholds> | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Load alert configs from DB, grouped by (tenantId, propertyId).
 * Returns a Map where key = propertyId or '__global__' for tenant-level defaults.
 */
async function loadConfigs(): Promise<Map<string, AlertThresholds>> {
  const now = Date.now();
  if (configCache && (now - configCacheTime) < CONFIG_CACHE_TTL_MS) {
    return configCache;
  }

  const configs = await db.wiFiAlertConfig.findMany({
    where: { enabled: true },
  });

  const map = new Map<string, AlertThresholds>();
  for (const c of configs) {
    const key = c.propertyId || `__global_${c.tenantId}`;
    map.set(key, {
      latencyWarningMs: c.latencyWarningMs,
      latencyCriticalMs: c.latencyCriticalMs,
      enabled: c.enabled,
    });
  }

  configCache = map;
  configCacheTime = now;
  return map;
}

/**
 * Get thresholds for a specific tenant + property.
 * Falls back to global config, then to defaults.
 */
async function getThresholds(
  tenantId: string,
  propertyId: string | null,
): Promise<AlertThresholds> {
  const configs = await loadConfigs();

  // Try property-specific first
  if (propertyId) {
    const propConfig = configs.get(propertyId);
    if (propConfig) return propConfig;
  }

  // Fall back to tenant global
  const globalConfig = configs.get(`__global_${tenantId}`);
  if (globalConfig) return globalConfig;

  // Hardcoded defaults
  return {
    latencyWarningMs: DEFAULT_LATENCY_WARNING_MS,
    latencyCriticalMs: DEFAULT_LATENCY_CRITICAL_MS,
    enabled: true,
  };
}

// ────────────────────────────────────────────────────────────
// Main Function
// ────────────────────────────────────────────────────────────

export async function generateHealthAlerts(): Promise<{
  created: number;
  resolved: number;
  skipped: number;
}> {
  const result = { created: 0, resolved: 0, skipped: 0 };

  try {
    // ── Step 1: Read last health check result from memory ──
    const healthCheck = getLastNasHealthCheck();

    if (!healthCheck) {
      SELog.info('[WiFiAlert] No health check result available — skipping alert generation');
      return result;
    }

    if (healthCheck.results.length === 0) {
      SELog.info('[WiFiAlert] Health check ran but no NAS results — skipping');
      return result;
    }

    SELog.info(
      `[WiFiAlert] Processing ${healthCheck.results.length} NAS results ` +
      `(${healthCheck.online} online, ${healthCheck.offline} offline, ${healthCheck.degraded} degraded)`
    );

    // ── Step 2: Query recent offline transitions from NasHealthLog ──
    // Look for entries in the last 2 minutes where isOnline = false.
    // These represent NAS devices that went offline recently.
    const recentOfflineLogs = await db.$queryRawUnsafe<
      Array<{
        nasIpAddress: string;
        nasName: string;
        tenantId: string;
        propertyId: string;
        createdAt: Date;
        avgLatencyMs: number | null;
      }>
    >(
      `SELECT DISTINCT ON ("nasIpAddress")
              "nasIpAddress", "nasName", "tenantId", "propertyId",
              "createdAt", "avgLatencyMs"
       FROM "NasHealthLog"
       WHERE "isOnline" = false
         AND "createdAt" > NOW() - INTERVAL '${OFFLINE_TRANSITION_WINDOW_SEC} seconds'
       ORDER BY "nasIpAddress", "createdAt" DESC`,
    );

    // Build a set of recently-offline NAS IPs for quick lookup
    const recentlyOfflineIps = new Set(recentOfflineLogs.map((l) => l.nasIpAddress));
    // Map NAS IP → log entry for tenantId/propertyId
    const offlineLogMap = new Map(
      recentOfflineLogs.map((l) => [l.nasIpAddress, l]),
    );

    // ── Step 3: Process each probe result ──
    for (const probe of healthCheck.results) {
      // ── 3a. NAS is OFFLINE → create nas_offline alert ──
      if (!probe.isOnline) {
        // Check if we already have an active nas_offline alert for this NAS IP
        const existingAlert = await findActiveAlert(probe.nasIp, 'nas_offline');

        if (existingAlert) {
          result.skipped++;
          SELog.info(
            `[WiFiAlert] Skipping duplicate nas_offline alert for ${probe.nasName} (${probe.nasIp})`
          );
        } else {
          // Use the NasHealthLog entry for tenantId/propertyId, fall back to probe data
          const logEntry = offlineLogMap.get(probe.nasIp);
          const tenantId = logEntry?.tenantId ?? probe.tenantId;
          const propertyId = logEntry?.propertyId ?? probe.propertyId;

          await createAlert({
            tenantId,
            propertyId: propertyId || null,
            type: 'nas_offline',
            severity: 'critical',
            title: `NAS Offline: ${probe.nasName} (${probe.nasIp})`,
            message: `NAS device "${probe.nasName}" (${probe.nasIp}) is not responding to health probes. ` +
              (probe.error ? `Error: ${probe.error}` : 'All probes failed (ICMP + UDP ports).'),
            source: probe.nasIp,
            metadata: JSON.stringify({
              nasName: probe.nasName,
              nasIp: probe.nasIp,
              nasId: probe.nasId,
              probesUsed: probe.probesUsed,
              error: probe.error ?? null,
              probedAt: probe.probedAt.toISOString(),
            }),
          });

          result.created++;
          SELog.warn(
            `[WiFiAlert] Created nas_offline (critical) alert for ${probe.nasName} (${probe.nasIp})`
          );
        }
      } else {
        // ── 3b. NAS is ONLINE → auto-resolve any active nas_offline alert ──
        const activeOfflineAlert = await findActiveAlert(probe.nasIp, 'nas_offline');
        if (activeOfflineAlert) {
          await resolveAlert(
            activeOfflineAlert.id,
            'system',
            `NAS "${probe.nasName}" (${probe.nasIp}) is back online (latency: ${probe.avgLatencyMs ?? 0}ms)`,
          );
          result.resolved++;
          SELog.info(
            `[WiFiAlert] Auto-resolved nas_offline alert for ${probe.nasName} (${probe.nasIp})`
          );
        }
      }

      // ── 3c. High latency check (only for online NAS) ──
      if (probe.isOnline && probe.avgLatencyMs !== null) {
        let severity: 'warning' | 'critical' | null = null;

        if (probe.avgLatencyMs > LATENCY_CRITICAL_MS) {
          severity = 'critical';
        } else if (probe.avgLatencyMs > LATENCY_WARNING_MS) {
          severity = 'warning';
        }

        if (severity) {
          // Check for existing active latency alert for this NAS IP
          const existingLatencyAlert = await findActiveAlert(probe.nasIp, 'latency');

          if (existingLatencyAlert) {
            // If severity escalated (warning → critical), update the existing alert
            if (severity === 'critical' && existingLatencyAlert.severity === 'warning') {
              await db.wiFiAlert.update({
                where: { id: existingLatencyAlert.id },
                data: {
                  severity: 'critical',
                  title: `Critical Latency: ${probe.nasName} (${probe.nasIp}) — ${Math.round(probe.avgLatencyMs)}ms`,
                  message: `NAS "${probe.nasName}" (${probe.nasIp}) has critically high latency of ${Math.round(probe.avgLatencyMs)}ms (threshold: ${LATENCY_CRITICAL_MS}ms). ` +
                    `Users may experience severe connectivity issues.`,
                },
              });
              SELog.warn(
                `[WiFiAlert] Escalated latency alert to critical for ${probe.nasName} (${probe.nasIp}) — ${Math.round(probe.avgLatencyMs)}ms`
              );
            } else {
              result.skipped++;
            }
          } else {
            await createAlert({
              tenantId: probe.tenantId,
              propertyId: probe.propertyId || null,
              type: 'latency',
              severity,
              title: `${severity === 'critical' ? 'Critical' : 'High'} Latency: ${probe.nasName} (${probe.nasIp}) — ${Math.round(probe.avgLatencyMs)}ms`,
              message: `NAS "${probe.nasName}" (${probe.nasIp}) has ${severity === 'critical' ? 'critically ' : ''}high latency of ${Math.round(probe.avgLatencyMs)}ms ` +
                `(threshold: ${severity === 'critical' ? LATENCY_CRITICAL_MS : LATENCY_WARNING_MS}ms). ` +
                (severity === 'critical'
                  ? 'Users may experience severe connectivity issues.'
                  : 'Users may notice degraded WiFi performance.'),
              source: probe.nasIp,
              metadata: JSON.stringify({
                nasName: probe.nasName,
                nasIp: probe.nasIp,
                nasId: probe.nasId,
                avgLatencyMs: probe.avgLatencyMs,
                icmpLatencyMs: probe.icmpLatencyMs,
                authPortLatencyMs: probe.authPortLatencyMs,
                acctPortLatencyMs: probe.acctPortLatencyMs,
                probesUsed: probe.probesUsed,
                probedAt: probe.probedAt.toISOString(),
              }),
            });

            result.created++;
            SELog.warn(
              `[WiFiAlert] Created latency (${severity}) alert for ${probe.nasName} (${probe.nasIp}) — ${Math.round(probe.avgLatencyMs)}ms`
            );
          }
        } else {
          // Latency is within acceptable range — auto-resolve any active latency alert
          const activeLatencyAlert = await findActiveAlert(probe.nasIp, 'latency');
          if (activeLatencyAlert) {
            await resolveAlert(
              activeLatencyAlert.id,
              'system',
              `NAS "${probe.nasName}" (${probe.nasIp}) latency returned to normal (${Math.round(probe.avgLatencyMs)}ms)`,
            );
            result.resolved++;
            SELog.info(
              `[WiFiAlert] Auto-resolved latency alert for ${probe.nasName} (${probe.nasIp}) — ${Math.round(probe.avgLatencyMs)}ms`
            );
          }
        }
      }
    }

    SELog.info(
      `[WiFiAlert] Generation complete: ${result.created} created, ${result.resolved} resolved, ${result.skipped} skipped`
    );

    return result;
  } catch (err) {
    SELog.error(
      `[WiFiAlert] Fatal error during alert generation: ${err instanceof Error ? err.message : String(err)}`
    );
    return result;
  }
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

interface AlertInput {
  tenantId: string;
  propertyId: string | null;
  type: string;
  severity: string;
  title: string;
  message: string;
  source: string | null;
  metadata: string;
}

/**
 * Find an active (non-resolved, non-acknowledged) alert for a given source + type.
 */
async function findActiveAlert(
  source: string,
  type: string,
): Promise<{ id: string; severity: string } | null> {
  const rows = await db.$queryRawUnsafe<Array<{ id: string; severity: string }>>(
    `SELECT id, severity
     FROM "WiFiAlert"
     WHERE source = $1
       AND type = $2
       AND status = 'active'
     ORDER BY "createdAt" DESC
     LIMIT 1`,
    source,
    type,
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Create a new WiFiAlert record.
 */
async function createAlert(input: AlertInput): Promise<void> {
  const createdAlert = await db.wiFiAlert.create({
    data: {
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      type: input.type,
      severity: input.severity,
      title: input.title,
      message: input.message,
      source: input.source,
      metadata: input.metadata,
    },
  });

  // Fire-and-forget: dispatch notifications to staff without blocking alert creation
  dispatchAlertNotifications({
    id: createdAlert.id,
    tenantId: createdAlert.tenantId,
    propertyId: createdAlert.propertyId,
    type: createdAlert.type,
    severity: createdAlert.severity,
    source: createdAlert.source,
    message: createdAlert.message,
    title: createdAlert.title,
  }).catch(() => {});
}

/**
 * Resolve an existing alert by marking it as resolved.
 */
async function resolveAlert(
  alertId: string,
  resolvedBy: string,
  resolveNote: string,
): Promise<void> {
  await db.wiFiAlert.update({
    where: { id: alertId },
    data: {
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedBy,
      resolveNote,
    },
  });
}
