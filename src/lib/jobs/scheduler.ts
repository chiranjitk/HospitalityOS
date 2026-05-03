import cron, { type ScheduledTask } from 'node-cron';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { executeReport, sendReportEmail } from './report-executor';
import { createGatewayAdapter, DEFAULT_PORTS } from '@/lib/wifi/adapters';
import type { GatewayConfig, GatewayVendor } from '@/lib/wifi/adapters';
import { runSessionEngine } from '@/lib/wifi/services/session-engine';

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

function integrationToGatewayConfig(integration: {
  id: string;
  provider: string;
  config: string;
}): GatewayConfig {
  const config = JSON.parse(integration.config || '{}');
  const vendor: GatewayVendor =
    (PROVIDER_TO_VENDOR[integration.provider] as GatewayVendor) || 'generic';
  const defaults = DEFAULT_PORTS[vendor] || DEFAULT_PORTS.generic;

  let decryptedPassword: string | undefined;
  if (config.apiKey) {
    const plain = decrypt(config.apiKey);
    if (plain) decryptedPassword = plain;
  }

  let decryptedRadiusSecret: string | undefined;
  if (config.radiusSecret) {
    const plain = decrypt(config.radiusSecret);
    if (plain) decryptedRadiusSecret = plain;
  }

  let decryptedCoaSecret: string | undefined;
  if (config.coaSecret) {
    const plain = decrypt(config.coaSecret);
    if (plain) decryptedCoaSecret = plain;
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

// Track active cron jobs
const activeJobs = new Map<string, ScheduledTask>();

/**
 * Initialize the scheduler - start cron jobs for scheduled reports
 */
export function initializeScheduler(): void {
  // Run every minute to check for pending reports
  const mainJob = cron.schedule('* * * * *', async () => {
    await processScheduledReports();
  });

  activeJobs.set('main', mainJob);
  console.log('[Scheduler] Initialized - checking for scheduled reports every minute');

  // Run every minute to sync gateways with auto-sync enabled
  const gatewaySyncJob = cron.schedule('* * * * *', async () => {
    await processGatewayAutoSync();
  });

  activeJobs.set('gateway-sync', gatewaySyncJob);
  console.log('[Scheduler] Gateway auto-sync job started - runs every minute');

  // Run every minute to process session engine (nftables counters → accounting)
  const sessionEngineJob = cron.schedule('* * * * *', async () => {
    try {
      await runSessionEngine();
    } catch (err) {
      console.error('[Scheduler] Session engine error:', err);
    }
  });

  activeJobs.set('session-engine', sessionEngineJob);
  console.log('[Scheduler] Session engine job started - runs every minute');
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

/**
 * Process all scheduled reports that are due
 */
export async function processScheduledReports(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ reportId: string; error: string }>;
}> {
  const now = new Date();
  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as Array<{ reportId: string; error: string }>,
  };

  try {
    // Find all active scheduled reports that are due
    const dueReports = await db.scheduledReport.findMany({
      where: {
        isActive: true,
        nextRunAt: {
          lte: now,
        },
      },
    });

    console.log(`[Scheduler] Found ${dueReports.length} reports due for execution`);

    for (const report of dueReports) {
      results.processed++;

      try {
        // Execute the report
        const executionResult = await executeReport(report);

        // Create history record
        const historyRecord = await db.reportHistory.create({
          data: {
            tenantId: report.tenantId,
            scheduledReportId: report.id,
            name: report.name,
            type: report.type,
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

        // Send email if delivery method is email
        if (report.deliveryMethod === 'email') {
          const recipients = JSON.parse(report.recipients || '[]');
          if (recipients.length > 0) {
            await sendReportEmail({
              to: recipients,
              reportName: report.name,
              reportType: report.type,
              fileUrl: executionResult.fileUrl,
              fileContent: executionResult.fileContent,
              format: report.format,
            });
          }
        }

        // Calculate next run time
        const nextRunAt = calculateNextRun(report);

        // Update the scheduled report
        await db.scheduledReport.update({
          where: { id: report.id },
          data: {
            lastRunAt: now,
            nextRunAt,
          },
        });

        results.succeeded++;
        console.log(`[Scheduler] Successfully executed report: ${report.name} (${report.id})`);
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push({ reportId: report.id, error: errorMessage });

        // Create failed history record
        await db.reportHistory.create({
          data: {
            tenantId: report.tenantId,
            scheduledReportId: report.id,
            name: report.name,
            type: report.type,
            format: report.format,
            generatedAt: new Date(),
            status: 'failed',
            errorMessage,
            recipientCount: 0,
          },
        });

        console.error(`[Scheduler] Failed to execute report ${report.name}:`, errorMessage);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error processing scheduled reports:', error);
  }

  return results;
}

/**
 * Calculate the next run time based on frequency
 */
function calculateNextRun(report: {
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
      // If the time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case 'weekly':
      // Schedule for the next occurrence of the specified day
      const targetDay = report.dayOfWeek ?? 1; // Default to Monday
      const currentDay = now.getDay();
      let daysUntilNext = targetDay - currentDay;
      if (daysUntilNext <= 0 || (daysUntilNext === 0 && nextRun <= now)) {
        daysUntilNext += 7;
      }
      nextRun.setDate(nextRun.getDate() + daysUntilNext);
      break;

    case 'monthly':
      // Schedule for the specified day of next month
      const targetDate = report.dayOfMonth ?? 1;
      nextRun.setDate(targetDate);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;

    case 'quarterly':
      // Schedule for the first day of the next quarter
      const currentMonth = now.getMonth();
      const nextQuarterMonth = Math.floor(currentMonth / 3) * 3 + 3;
      nextRun.setMonth(nextQuarterMonth, 1);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 3);
      }
      break;

    case 'yearly':
      // Schedule for January 1st of next year
      nextRun.setFullYear(now.getFullYear() + 1, 0, 1);
      break;

    default:
      // Default to daily
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
  }

  return nextRun;
}

/**
 * Manually trigger a specific scheduled report
 */
export async function triggerReport(reportId: string): Promise<{
  success: boolean;
  historyId?: string;
  error?: string;
}> {
  try {
    const report = await db.scheduledReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return { success: false, error: 'Report not found' };
    }

    // Execute the report
    const executionResult = await executeReport(report);

    // Create history record
    const historyRecord = await db.reportHistory.create({
      data: {
        tenantId: report.tenantId,
        scheduledReportId: report.id,
        name: report.name,
        type: report.type,
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

    // Send email if delivery method is email
    if (report.deliveryMethod === 'email') {
      const recipients = JSON.parse(report.recipients || '[]');
      if (recipients.length > 0) {
        await sendReportEmail({
          to: recipients,
          reportName: report.name,
          reportType: report.type,
          fileUrl: executionResult.fileUrl,
          fileContent: executionResult.fileContent,
          format: report.format,
        });
      }
    }

    // Update last run time
    await db.scheduledReport.update({
      where: { id: reportId },
      data: { lastRunAt: new Date() },
    });

    return { success: true, historyId: historyRecord.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// Gateway Auto-Sync
// ---------------------------------------------------------------------------

/**
 * Find all gateways with auto-sync enabled whose sync interval has elapsed,
 * then call getStatus() + getActiveSessions() via the adapter framework.
 *
 * This runs every minute. Each gateway has its own `syncInterval` (default 5 min).
 * A gateway is only synced when `now - lastSyncAt >= syncInterval * 60_000`.
 */
export async function processGatewayAutoSync(): Promise<{
  synced: number;
  succeeded: number;
  failed: number;
  skipped: number;
}> {
  const now = new Date();
  const results = { synced: 0, succeeded: 0, failed: 0, skipped: 0 };

  try {
    const gateways = await db.integration.findMany({
      where: { type: 'wifi_gateway', status: 'active' },
    });

    for (const gw of gateways) {
      const config = JSON.parse(gw.config || '{}');
      const autoSync = config.autoSync ?? true;
      const intervalMin = config.syncInterval || 5;

      // Skip if auto-sync is disabled
      if (!autoSync) {
        results.skipped++;
        continue;
      }

      // Check if enough time has elapsed since last sync
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
        const adapter = createGatewayAdapter(gwConfig);

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

        // Mark as error so the UI shows it
        await db.integration.update({
          where: { id: gw.id },
          data: {
            lastError: `Auto-sync failed: ${msg}`,
          },
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error in processGatewayAutoSync:', error);
  }

  return results;
}

// Export for use in API routes
export { activeJobs };
