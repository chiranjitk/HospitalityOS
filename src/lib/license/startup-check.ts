/**
 * startup-check.ts
 *
 * Periodic license verification that runs on server startup and every 5 minutes.
 *
 * For each tenant with an activated license:
 *   - valid         → ensure tenant is active (no-op if already active)
 *   - grace_period  → log warning (don't suspend yet)
 *   - no_license    → skip (tenant may be in trial or not yet activated)
 *   - hardware_mismatch → suspend tenant (only fires in on-premise mode)
 *   - expired / revoked / tampered / clock_tampered → suspend tenant
 *
 * In SaaS mode, the fingerprint check is advisory-only, so hardware_mismatch
 * will never be returned by verifyServerLicense. Grace period and suspension
 * logic only applies in on-premise mode.
 */

import { db } from '@/lib/db';
import { verifyServerLicense } from './license-manager';
import { getHostingMode, getHostingModeDescription } from './hosting-config';
import type { LicenseStatus } from './license-manager';

// =====================================================
// CONSTANTS
// =====================================================

/** How often to run the periodic license check (5 minutes) */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** Singleton timer reference so we can stop it */
let periodicTimer: ReturnType<typeof setInterval> | null = null;

// =====================================================
// CORE CHECK
// =====================================================

/**
 * Perform a single license check across all tenants with activated licenses.
 * Called once on startup and then periodically.
 */
export async function performLicenseCheck(): Promise<void> {
  const mode = getHostingMode();
  console.log(`[License-Check] Running license check — hosting mode: ${mode} (${getHostingModeDescription().slice(0, 80)}...)`);

  try {
    // Fetch all tenants that have an activated license key
    const licensedTenants = await db.licenseKey.findMany({
      where: {
        status: 'activated',
        tenantId: { not: null },
      },
      select: {
        tenantId: true,
        key: true,
      },
      distinct: ['tenantId'],
    });

    if (licensedTenants.length === 0) {
      console.log('[License-Check] No activated licenses found. Nothing to check.');
      return;
    }

    console.log(`[License-Check] Checking ${licensedTenants.length} licensed tenant(s)...`);

    let validCount = 0;
    let graceCount = 0;
    let mismatchCount = 0;
    let suspendedCount = 0;
    let errorCount = 0;

    for (const record of licensedTenants) {
      const tenantId = record.tenantId;
      if (!tenantId) continue;

      try {
        const result = await verifyServerLicense(tenantId);

        switch (result.status) {
          case 'valid': {
            validCount++;
            // Ensure tenant is active
            await db.tenant.updateMany({
              where: {
                id: tenantId,
                deletedAt: null,
                status: 'suspended_license',
              },
              data: {
                status: 'active',
              },
            });
            break;
          }

          case 'grace_period': {
            graceCount++;
            console.warn(
              `[License-Check] Tenant ${tenantId.slice(0, 8)}: ${result.message}`
            );
            break;
          }

          case 'no_license': {
            // Skip — tenant may be in trial or not activated yet
            break;
          }

          case 'hardware_mismatch': {
            mismatchCount++;
            console.error(
              `[License-Check] Tenant ${tenantId.slice(0, 8)}: SUSPENDING — ${result.message}`
            );
            // Suspend tenant
            await suspendTenant(tenantId, 'hardware_mismatch', result.message);
            suspendedCount++;
            break;
          }

          case 'expired': {
            console.warn(
              `[License-Check] Tenant ${tenantId.slice(0, 8)}: SUSPENDING — license expired.`
            );
            await suspendTenant(tenantId, 'expired', 'License has expired.');
            suspendedCount++;
            break;
          }

          case 'revoked': {
            console.warn(
              `[License-Check] Tenant ${tenantId.slice(0, 8)}: SUSPENDING — license revoked.`
            );
            await suspendTenant(tenantId, 'revoked', 'License has been revoked.');
            suspendedCount++;
            break;
          }

          case 'tampered': {
            console.error(
              `[License-Check] Tenant ${tenantId.slice(0, 8)}: SUSPENDING — signature tampering detected.`
            );
            await suspendTenant(tenantId, 'tampered', 'License signature verification failed.');
            suspendedCount++;
            break;
          }

          case 'clock_tampered': {
            console.error(
              `[License-Check] Tenant ${tenantId.slice(0, 8)}: SUSPENDING — clock tampering detected.`
            );
            await suspendTenant(tenantId, 'clock_tampered', 'System clock tampering detected.');
            suspendedCount++;
            break;
          }

          default: {
            console.warn(
              `[License-Check] Tenant ${tenantId.slice(0, 8)}: Unknown status '${result.status}'`
            );
            break;
          }
        }
      } catch (err) {
        errorCount++;
        console.error(`[License-Check] Error checking tenant ${tenantId.slice(0, 8)}:`, err);
      }
    }

    const summary = `Completed: ${validCount} valid, ${graceCount} grace, ${suspendedCount} suspended, ${errorCount} errors.`;
    console.log(`[License-Check] ${summary}`);
  } catch (err) {
    console.error('[License-Check] Fatal error during license check:', err);
  }
}

/**
 * Suspend a tenant by setting their status to 'suspended_license'.
 */
async function suspendTenant(
  tenantId: string,
  reason: string,
  message: string,
): Promise<void> {
  try {
    await db.tenant.updateMany({
      where: {
        id: tenantId,
        deletedAt: null,
      },
      data: {
        status: 'suspended_license',
      },
    });
    console.warn(`[License-Check] Tenant ${tenantId.slice(0, 8)} suspended: reason=${reason}, ${message}`);
  } catch (err) {
    console.error(`[License-Check] Failed to suspend tenant ${tenantId.slice(0, 8)}:`, err);
  }
}

// =====================================================
// PERIODIC TIMER
// =====================================================

/**
 * Start the periodic license check that runs every CHECK_INTERVAL_MS.
 * Safe to call multiple times — will not create duplicate timers.
 */
export function startPeriodicLicenseCheck(): void {
  if (periodicTimer) {
    console.log('[License-Check] Periodic check already running. Ignoring duplicate start.');
    return;
  }

  console.log(`[License-Check] Starting periodic license check (every ${CHECK_INTERVAL_MS / 1000}s)...`);

  // Run immediately on start
  performLicenseCheck().catch((err) => {
    console.error('[License-Check] Startup check failed:', err);
  });

  // Then periodically
  periodicTimer = setInterval(() => {
    performLicenseCheck().catch((err) => {
      console.error('[License-Check] Periodic check failed:', err);
    });
  }, CHECK_INTERVAL_MS);

  // Don't prevent Node.js from exiting
  if (periodicTimer && typeof periodicTimer === 'object' && 'unref' in periodicTimer) {
    periodicTimer.unref();
  }
}

/**
 * Stop the periodic license check timer.
 * Useful for graceful shutdown or testing.
 */
export function stopPeriodicLicenseCheck(): void {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
    console.log('[License-Check] Periodic license check stopped.');
  }
}
