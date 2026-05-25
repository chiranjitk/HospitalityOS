/**
 * Background Scheduler — Lazy-loaded version
 *
 * Uses dynamic imports for all service modules to reduce initial memory footprint.
 * This prevents the Edge Runtime from trying to bundle Node.js-only modules
 * (crypto, fs, child_process) during compilation analysis.
 *
 * Each cron job callback dynamically imports its service only when it runs,
 * keeping the initial module graph small and reducing memory pressure.
 */
import cron, { type ScheduledTask } from 'node-cron';

// Track active cron jobs
const activeJobs = new Map<string, ScheduledTask>();

// ---------------------------------------------------------------------------
// Provider → Vendor mapping (same as API route)
// ---------------------------------------------------------------------------
const PROVIDER_TO_VENDOR: Record<string, GatewayVendor> = {
  cisco: 'cisco',
  ubiquiti: 'unifi',
  aruba: 'aruba',
  ruckus: 'ruckus',
  mikrotik: 'mikrotik',
  tplink: 'tplink',
  fortinet: 'fortinet',
  juniper: 'juniper',
  huawei: 'huawei',
  netgear: 'netgear',
  dlink: 'dlink',
  ruijie: 'ruijie',
  cambium: 'cambium',
  grandstream: 'grandstream',
  other: 'generic',
};

// Lazy type import — avoid importing the full adapter module at top level
type GatewayVendor = 'cisco' | 'unifi' | 'aruba' | 'ruckus' | 'mikrotik' | 'tplink' | 'fortinet' | 'juniper' | 'huawei' | 'netgear' | 'dlink' | 'ruijie' | 'cambium' | 'grandstream' | 'generic';

interface GatewayConfig {
  id: string;
  vendor: GatewayVendor;
  ipAddress: string;
  radiusSecret: string;
  radiusAuthPort: number;
  radiusAcctPort: number;
  coaEnabled: boolean;
  coaPort: number;
  coaSecret?: string;
  apiUsername?: string;
  apiPassword?: string;
  apiPort: number;
  managementUrl: string;
}

function integrationToGatewayConfig(integration: {
  id: string;
  provider: string;
  config: string;
}): GatewayConfig {
  const config = JSON.parse(integration.config || '{}');
  const vendor: GatewayVendor =
    (PROVIDER_TO_VENDOR[integration.provider] as GatewayVendor) || 'generic';

  // Default ports per vendor
  const DEFAULT_PORTS: Record<string, { radiusAuth: number; radiusAcct: number; coa: number; api: number }> = {
    cisco: { radiusAuth: 1812, radiusAcct: 1813, coa: 3799, api: 443 },
    unifi: { radiusAuth: 1812, radiusAcct: 1813, coa: 3799, api: 8443 },
    aruba: { radiusAuth: 1812, radiusAcct: 1813, coa: 3799, api: 4343 },
    ruckus: { radiusAuth: 1812, radiusAcct: 1813, coa: 3799, api: 8443 },
    mikrotik: { radiusAuth: 1812, radiusAcct: 1813, coa: 3799, api: 8728 },
    tplink: { radiusAuth: 1812, radiusAcct: 1813, coa: 3799, api: 443 },
    fortinet: { radiusAuth: 1812, radiusAcct: 1813, coa: 3799, api: 443 },
    juniper: { radiusAuth: 1812, radiusAcct: 1813, coa: 3799, api: 443 },
    huawei: { radiusAuth: 1812, radiusAcct: 1813, coa: 3799, api: 443 },
    netgear: { radiusAuth: 1812, radiusAcct: 1813, coa: 3799, api: 443 },
    dlink: { radiusAuth: 1812, radiusAcct: 1813, coa: 3799, api: 443 },
    ruijie: { radiusAuth: 1812, radiusAcct: 1813, coa: 3799, api: 443 },
    cambium: { radiusAuth: 1812, radiusAcct: 1813, coa: 3799, api: 443 },
    grandstream: { radiusAuth: 1812, radiusAcct: 1813, coa: 3799, api: 443 },
    generic: { radiusAuth: 1812, radiusAcct: 1813, coa: 3799, api: 443 },
  };

  const defaults = DEFAULT_PORTS[vendor] || DEFAULT_PORTS.generic;

  let decryptedPassword: string | undefined;
  if (config.apiKey) {
    try {
      const { decrypt } = require('@/lib/encryption');
      const plain = decrypt(config.apiKey);
      if (plain) decryptedPassword = plain;
    } catch { /* decryption not available yet */ }
  }

  let decryptedRadiusSecret: string | undefined;
  if (config.radiusSecret) {
    try {
      const { decrypt } = require('@/lib/encryption');
      const plain = decrypt(config.radiusSecret);
      if (plain) decryptedRadiusSecret = plain;
    } catch { /* decryption not available yet */ }
  }

  let decryptedCoaSecret: string | undefined;
  if (config.coaSecret) {
    try {
      const { decrypt } = require('@/lib/encryption');
      const plain = decrypt(config.coaSecret);
      if (plain) decryptedCoaSecret = plain;
    } catch { /* decryption not available yet */ }
  }

  return {
    id: integration.id,
    vendor,
    ipAddress: config.ipAddress || '',
    radiusSecret: decryptedRadiusSecret || config.radiusSecret || 'staysecret',
    radiusAuthPort: config.radiusAuthPort || defaults.radiusAuth,
    radiusAcctPort: config.radiusAcctPort || defaults.radiusAcct,
    coaEnabled: config.coaEnabled ?? true,
    coaPort: config.coaPort || defaults.coa,
    coaSecret: decryptedCoaSecret || config.coaSecret,
    apiUsername: config.username,
    apiPassword: decryptedPassword,
    apiPort: config.port || defaults.api,
    managementUrl: config.managementUrl || `https://${config.ipAddress}:${config.port || defaults.api}`,
  };
}

/**
 * Initialize the scheduler - start cron jobs using lazy imports
 * to reduce initial memory footprint and avoid Edge Runtime issues.
 */
export function initializeScheduler(): void {
  // ─── Job 1: Scheduled Reports (every minute) ──────────────────────
  const mainJob = cron.schedule('* * * * *', async () => {
    try {
      await processScheduledReports();
    } catch (err) {
      console.error('[Scheduler] Report check error:', err);
    }
  });
  activeJobs.set('main', mainJob);
  console.log('[Scheduler] Initialized - checking for scheduled reports every minute');

  // ─── Job 2: Gateway Auto-Sync (every minute) ──────────────────────
  const gatewaySyncJob = cron.schedule('* * * * *', async () => {
    try {
      await processGatewayAutoSync();
    } catch (err) {
      console.error('[Scheduler] Gateway auto-sync error:', err);
    }
  });
  activeJobs.set('gateway-sync', gatewaySyncJob);
  console.log('[Scheduler] Gateway auto-sync job started - runs every minute');

  // ─── Job 3: Session Engine (every minute) ─────────────────────────
  const sessionEngineJob = cron.schedule('* * * * *', async () => {
    try {
      const { runSessionEngine } = await import('@/lib/wifi/services/session-engine');
      await runSessionEngine();
    } catch (err) {
      console.error('[Scheduler] Session engine error:', err);
    }
  });
  activeJobs.set('session-engine', sessionEngineJob);
  console.log('[Scheduler] Session engine job started - runs every minute');

  // ─── Job 4: NAS Health Check (every minute) ──────────────────────
  const nasHealthJob = cron.schedule('* * * * *', async () => {
    try {
      const { runNasHealthCheck } = await import('@/lib/wifi/services/nas-health-check');
      await runNasHealthCheck();
    } catch (err) {
      console.error('[Scheduler] NAS health check error:', err);
    }
  });
  activeJobs.set('nas-health-check', nasHealthJob);
  console.log('[Scheduler] NAS health check job started - runs every minute');

  // ─── Job 5: WiFi Health Alerts (every 2 minutes) ─────────────────
  const healthAlertJob = cron.schedule('*/2 * * * *', async () => {
    try {
      const { generateHealthAlerts } = await import('@/lib/wifi/services/wifi-health-alert-generator');
      await generateHealthAlerts();
    } catch (err) {
      console.error('[Scheduler] WiFi health alert generator error:', err);
    }
  });
  activeJobs.set('wifi-health-alerts', healthAlertJob);
  console.log('[Scheduler] WiFi health alert generator started - runs every 2 minutes');

  // ─── Job 6: SLA Metrics (every 5 minutes) ────────────────────────
  const slaMetricJob = cron.schedule('*/5 * * * *', async () => {
    try {
      const { collectSlaMetrics } = await import('@/lib/wifi/services/sla-metric-collector');
      await collectSlaMetrics();
    } catch (err) {
      console.error('[Scheduler] SLA metric collector error:', err);
    }
  });
  activeJobs.set('sla-metrics', slaMetricJob);
  console.log('[Scheduler] SLA metric collector started - runs every 5 minutes');

  // ─── Job 7: Consent Auto-Delete (hourly) ─────────────────────────
  const consentCleanupJob = cron.schedule('0 * * * *', async () => {
    try {
      const { purgeExpiredConsents } = await import('@/lib/wifi/services/consent-auto-delete');
      await purgeExpiredConsents();
    } catch (err) {
      console.error('[Scheduler] Consent auto-delete error:', err);
    }
  });
  activeJobs.set('consent-auto-delete', consentCleanupJob);
  console.log('[Scheduler] Consent auto-delete started - runs every hour');

  // ─── Job 8: Device Cleanup (every 6 hours) ───────────────────────
  const deviceCleanupJob = cron.schedule('0 */6 * * *', async () => {
    try {
      const { cleanupStaleDevices } = await import('@/lib/wifi/services/device-cleanup');
      await cleanupStaleDevices();
    } catch (err) {
      console.error('[Scheduler] Device cleanup error:', err);
    }
  });
  activeJobs.set('device-cleanup', deviceCleanupJob);
  console.log('[Scheduler] Device cleanup started - runs every 6 hours');

  // ─── Job 9: Pre-Arrival Delivery (every 15 minutes) ──────────────
  const preArrivalJob = cron.schedule('*/15 * * * *', async () => {
    try {
      const { processPreArrivalDelivery } = await import('@/lib/wifi/services/pre-arrival-scheduler');
      await processPreArrivalDelivery();
    } catch (err) {
      console.error('[Scheduler] Pre-arrival scheduler error:', err);
    }
  });
  activeJobs.set('pre-arrival-delivery', preArrivalJob);
  console.log('[Scheduler] Pre-arrival delivery started - runs every 15 minutes');
}

/**
 * Stop all active cron jobs
 */
export function stopScheduler(): void {
  for (const [name, job] of activeJobs) {
    job.stop();
    console.log(`[Scheduler] Stopped job: ${name}`);
  }
  activeJobs.clear();
}

// ---------------------------------------------------------------------------
// Gateway Auto-Sync (inline — avoids pulling in heavy adapters at module load)
// ---------------------------------------------------------------------------

export async function processGatewayAutoSync(): Promise<{
  synced: number;
  succeeded: number;
  failed: number;
  skipped: number;
}> {
  const now = new Date();
  const results = { synced: 0, succeeded: 0, failed: 0, skipped: 0 };

  try {
    const { db } = await import('@/lib/db');
    const gateways = await db.integration.findMany({
      where: { type: 'wifi_gateway', status: 'active' },
    });

    for (const gw of gateways) {
      const config = JSON.parse(gw.config || '{}');
      const autoSync = config.autoSync ?? true;
      const intervalMin = config.syncInterval || 5;

      if (!autoSync) {
        results.skipped++;
        continue;
      }

      if (gw.lastSyncAt) {
        const elapsed = now.getTime() - gw.lastSyncAt.getTime();
        const intervalMs = intervalMin * 60 * 1000;
        if (elapsed < intervalMs) {
          results.skipped++;
          continue;
        }
      }

      results.synced++;

      try {
        const gwConfig = integrationToGatewayConfig(gw);
        const { createGatewayAdapter } = await import('@/lib/wifi/adapters');
        const adapter = await createGatewayAdapter(gwConfig);

        const syncStart = Date.now();
        const [statusResult, sessionsResult] = await Promise.allSettled([
          adapter.getStatus(),
          adapter.getActiveSessions(),
        ]);

        const status = statusResult.status === 'fulfilled' ? statusResult.value : null;
        const sessions = sessionsResult.status === 'fulfilled' ? sessionsResult.value : [];
        const latency = Date.now() - syncStart;

        const totalAPs = status?.totalClients ?? 0;
        const activeSessions = sessions.length;
        const bandwidth = {
          upload: sessions.reduce((sum: number, s: any) => sum + (s.bytesIn || 0), 0),
          download: sessions.reduce((sum: number, s: any) => sum + (s.bytesOut || 0), 0),
        };
        const bandwidthMbps = Math.round((bandwidth.upload + bandwidth.download) / 125000);

        const existingConfig = JSON.parse(gw.config || '{}');
        const syncedConfig = {
          ...existingConfig,
          totalAPs: totalAPs || existingConfig.totalAPs || 0,
          activeSessions: activeSessions || existingConfig.activeSessions || 0,
          bandwidth,
          bandwidthMbps,
          firmwareVersion: status?.firmwareVersion || existingConfig.firmwareVersion,
          lastSyncLatency: latency,
        };

        await db.integration.update({
          where: { id: gw.id },
          data: {
            lastSyncAt: now,
            status: status?.online ? 'active' : 'error',
            lastError: status?.online ? null : 'Gateway appears offline (auto-sync)',
            config: JSON.stringify(syncedConfig),
          },
        });

        results.succeeded++;
        console.log(
          `[Scheduler] Gateway sync OK: ${gw.name || gw.id} — ${totalAPs} APs, ${activeSessions} sessions, ${bandwidthMbps} Mbps, ${latency}ms`,
        );
      } catch (err: any) {
        results.failed++;
        const msg = err?.message || 'Unknown sync error';
        console.error(`[Scheduler] Gateway sync FAIL: ${gw.name || gw.id}: ${msg}`);

        try {
          const { db } = await import('@/lib/db');
          await db.integration.update({
            where: { id: gw.id },
            data: { lastError: `Auto-sync failed: ${msg}` },
          });
        } catch (schedulerError) {
          console.error('Scheduler error: failed to update gateway lastError:', schedulerError);
        }
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error in processGatewayAutoSync:', error);
  }

  return results;
}

// Export for use in API routes
export { activeJobs };

// Re-export lazy report functions for API route compatibility
export async function processScheduledReports() {
  const { db } = await import('@/lib/db');
  const { executeReport, sendReportEmail } = await import('./report-executor');
  const now = new Date();

  const dueReports = await db.scheduledReport.findMany({
    where: { isActive: true, nextRunAt: { lte: now } },
  });

  console.log(`[Scheduler] Found ${dueReports.length} reports due for execution`);

  const results = { processed: 0, succeeded: 0, failed: 0, errors: [] as Array<{ reportId: string; error: string }> };

  for (const report of dueReports) {
    results.processed++;
    try {
      const executionResult = await executeReport(report);

      await db.reportHistory.create({
        data: {
          tenantId: report.tenantId,
          scheduledReportId: report.id,
          name: report.name,
          type: report.reportType,
          format: report.format,
          generatedAt: new Date(),
          periodStart: executionResult.periodStart,
          periodEnd: executionResult.periodEnd,
          fileUrl: executionResult.fileUrl,
          fileSize: executionResult.fileSize,
          status: 'completed',
          recipientCount: JSON.parse(report.recipients || '[]').length,
          sentAt: executionResult.sentAt,
        },
      });

      if (report.deliveryMethod === 'email') {
        const recipients = JSON.parse(report.recipients || '[]');
        if (recipients.length > 0) {
          await sendReportEmail({
            to: recipients,
            reportName: report.name,
            reportType: report.reportType,
            fileUrl: executionResult.fileUrl,
            fileContent: executionResult.fileContent,
            format: report.format,
          });
        }
      }

      const nextRunAt = calculateNextRun(report);
      await db.scheduledReport.update({
        where: { id: report.id },
        data: { lastRunAt: now, lastRunStatus: 'success', lastError: null, nextRunAt },
      });

      results.succeeded++;
    } catch (error) {
      results.failed++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push({ reportId: report.id, error: errorMessage });

      try {
        await db.reportHistory.create({
          data: {
            tenantId: report.tenantId,
            scheduledReportId: report.id,
            name: report.name,
            type: report.reportType,
            format: report.format,
            generatedAt: new Date(),
            status: 'failed',
            errorMessage,
            recipientCount: 0,
          },
        });

        await db.scheduledReport.update({
          where: { id: report.id },
          data: { lastRunAt: now, lastRunStatus: 'error', lastError: errorMessage },
        });
      } catch (schedulerError) {
        console.error('Scheduler error: failed to update scheduled report status:', schedulerError);
      }
    }
  }

  return results;
}

export function calculateNextRun(report: {
  frequency: string;
  time: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
}): Date {
  const now = new Date();
  const [hours, minutes] = report.time.split(':').map(Number);
  let nextRun = new Date();
  nextRun.setHours(hours, minutes, 0, 0);

  switch (report.frequency) {
    case 'daily':
      if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
      break;
    case 'weekly': {
      const targetDay = report.dayOfWeek ?? 1;
      const currentDay = now.getDay();
      let daysUntilNext = targetDay - currentDay;
      if (daysUntilNext <= 0 || (daysUntilNext === 0 && nextRun <= now)) daysUntilNext += 7;
      nextRun.setDate(nextRun.getDate() + daysUntilNext);
      break;
    }
    case 'monthly': {
      const targetDate = report.dayOfMonth ?? 1;
      nextRun.setDate(targetDate);
      if (nextRun <= now) nextRun.setMonth(nextRun.getMonth() + 1);
      break;
    }
    case 'quarterly': {
      const currentMonth = now.getMonth();
      const nextQuarterMonth = Math.floor(currentMonth / 3) * 3 + 3;
      nextRun.setMonth(nextQuarterMonth, 1);
      if (nextRun <= now) nextRun.setMonth(nextRun.getMonth() + 3);
      break;
    }
    case 'yearly':
      nextRun.setFullYear(now.getFullYear() + 1, 0, 1);
      break;
    default:
      if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
  }

  return nextRun;
}

export async function triggerReport(reportId: string): Promise<{
  success: boolean;
  historyId?: string;
  error?: string;
}> {
  try {
    const { db } = await import('@/lib/db');
    const { executeReport, sendReportEmail } = await import('./report-executor');

    const report = await db.scheduledReport.findUnique({ where: { id: reportId } });
    if (!report) return { success: false, error: 'Report not found' };

    const executionResult = await executeReport(report);

    const historyRecord = await db.reportHistory.create({
      data: {
        tenantId: report.tenantId,
        scheduledReportId: report.id,
        name: report.name,
        type: report.reportType,
        format: report.format,
        generatedAt: new Date(),
        periodStart: executionResult.periodStart,
        periodEnd: executionResult.periodEnd,
        fileUrl: executionResult.fileUrl,
        fileSize: executionResult.fileSize,
        status: 'completed',
        recipientCount: JSON.parse(report.recipients || '[]').length,
        sentAt: executionResult.sentAt,
      },
    });

    if (report.deliveryMethod === 'email') {
      const recipients = JSON.parse(report.recipients || '[]');
      if (recipients.length > 0) {
        await sendReportEmail({
          to: recipients,
          reportName: report.name,
          reportType: report.reportType,
          fileUrl: executionResult.fileUrl,
          fileContent: executionResult.fileContent,
          format: report.format,
        });
      }
    }

    await db.scheduledReport.update({
      where: { id: reportId },
      data: { lastRunAt: new Date(), lastRunStatus: 'success', lastError: null },
    });

    return { success: true, historyId: historyRecord.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    try {
      const { db } = await import('@/lib/db');
      await db.scheduledReport.update({
        where: { id: reportId },
        data: { lastRunAt: new Date(), lastRunStatus: 'error', lastError: errorMessage },
      });
    } catch (schedulerError) {
      console.error('Scheduler error: failed to update report error status:', schedulerError);
    }
    return { success: false, error: errorMessage };
  }
}
