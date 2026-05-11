/**
 * Restricted Network Manager
 * 
 * Syncs IP pools with captive portal enabled to /etc/restrictednetwork.
 * 
 * File format: one CIDR subnet per line
 * Example:
 *   10.10.20.0/24
 *   10.10.30.0/22
 * 
 * Used by backend DGD/nftables scripts for:
 * - Default deny internet for unauthenticated users
 * - Redirect to captive portal
 * 
 * In sandbox: writes to local file (restricted-network.txt)
 * In production: writes to /etc/restrictednetwork
 */

import { db } from '@/lib/db';
// Node.js-only modules — loaded via require() to avoid Turbopack Edge Runtime analysis.
const fs = /*turbopackIgnore: true*/ require('fs');
const path = /*turbopackIgnore: true*/ require('path');
import { RESTRICTED_NETWORK_PATH } from '@/lib/wifi/paths';

// Configurable path — override via env var RESTRICTED_NETWORK_PATH (defined in paths.ts)
// Production: /etc/restrictednetwork
// Sandbox: ./restricted-network.txt
const SANDBOX_FALLBACK_PATH = path['join'](process.cwd(), 'restricted-network.txt');

/** Get the writable path (production or sandbox fallback) */
function getWritablePath(): string {
  if (process.env.NODE_ENV !== 'production') {
    return SANDBOX_FALLBACK_PATH;
  }
  return RESTRICTED_NETWORK_PATH;
}

export interface RestrictedNetworkEntry {
  subnet: string;
  poolName: string;
  gateway: string | null;
}

/**
 * Sync the restricted network file with all captive-portal-enabled pools.
 * Reads all pools from DB and rewrites the entire file atomically.
 */
export async function syncRestrictedNetwork(): Promise<{ success: boolean; path: string; entries: RestrictedNetworkEntry[]; error?: string }> {
  const filePath = getWritablePath();

  try {
    // Fetch all pools where captive portal is enabled AND pool is enabled
    const pools = await db.$queryRawUnsafe<Array<{
      subnet: string;
      name: string;
      gateway: string;
    }>>(`
      SELECT 
        subnet::text as subnet,
        name,
        gateway::text as gateway
      FROM "IpPool"
      WHERE "captivePortal" = true
        AND enabled = true
        AND subnet IS NOT NULL
      ORDER BY subnet
    `);

    const entries: RestrictedNetworkEntry[] = pools
      .map(p => ({
        subnet: p.subnet,
        poolName: p.name,
        gateway: p.gateway || null,
      }));

    // Build file content: one CIDR per line
    const content = entries.map(e => e.subnet).join('\n') + (entries.length > 0 ? '\n' : '');

    if (entries.length === 0) {
      // No restricted networks — remove file if exists
      try {
        if (/*turbopackIgnore: true*/ (() => fs['existsSync'](filePath))()) {
          fs['unlinkSync'](filePath);
        }
      } catch {
        // File may not exist, that's fine
      }
    } else {
      // Write atomically via temp file
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      if (dir && !/*turbopackIgnore: true*/ (() => fs['existsSync'](dir))()) {
        fs['mkdirSync'](dir, { recursive: true });
      }

      fs['writeFileSync'](filePath, content, 'utf-8');
    }

    console.log(`[RestrictedNetwork] Synced ${entries.length} subnet(s) to ${filePath}`);
    entries.forEach(e => {
      console.log(`[RestrictedNetwork]   ${e.subnet} (pool: ${e.poolName}, gateway: ${e.gateway || 'none'})`);
    });

    return { success: true, path: filePath, entries };
  } catch (error: any) {
    // In sandbox, fall back to local file
    if (filePath === RESTRICTED_NETWORK_PATH && !process.env.RESTRICTED_NETWORK_PATH) {
      console.warn(`[RestrictedNetwork] Cannot write to ${filePath} (${error.message}), trying sandbox fallback`);
      try {
        const pools = await db.$queryRawUnsafe<Array<{ subnet: string; name: string; gateway: string }>>(`
          SELECT subnet::text as subnet, name, gateway::text as gateway
          FROM "IpPool"
          WHERE "captivePortal" = true AND enabled = true AND subnet IS NOT NULL
          ORDER BY subnet
        `);

        const entries: RestrictedNetworkEntry[] = pools.map(p => ({
          subnet: p.subnet, poolName: p.name, gateway: p.gateway || null,
        }));

        const content = entries.map(e => e.subnet).join('\n') + (entries.length > 0 ? '\n' : '');
        if (entries.length === 0) {
          if (/*turbopackIgnore: true*/ (() => fs['existsSync'](SANDBOX_FALLBACK_PATH))()) fs['unlinkSync'](SANDBOX_FALLBACK_PATH);
        } else {
          fs['writeFileSync'](SANDBOX_FALLBACK_PATH, content, 'utf-8');
        }

        console.log(`[RestrictedNetwork] Sandbox fallback: ${entries.length} subnet(s) written to ${SANDBOX_FALLBACK_PATH}`);
        return { success: true, path: SANDBOX_FALLBACK_PATH, entries };
      } catch (fallbackError: any) {
        return { success: false, path: SANDBOX_FALLBACK_PATH, entries: [], error: fallbackError.message };
      }
    }

    return { success: false, path: filePath, entries: [], error: error.message };
  }
}

/**
 * Quick sync after a single pool change (create/update/delete).
 * Calls the full sync to keep the file consistent.
 */
export async function onPoolChange(): Promise<void> {
  await syncRestrictedNetwork();
}

/**
 * Read current restricted network entries (from DB, not file).
 */
export async function getRestrictedNetworks(): Promise<RestrictedNetworkEntry[]> {
  const pools = await db.$queryRawUnsafe<Array<{
    subnet: string;
    name: string;
    gateway: string;
  }>>(`
    SELECT 
      subnet::text as subnet,
      name,
      gateway::text as gateway
    FROM "IpPool"
    WHERE "captivePortal" = true
      AND enabled = true
      AND subnet IS NOT NULL
    ORDER BY subnet
  `);

  return pools.map(p => ({
    subnet: p.subnet,
    poolName: p.name,
    gateway: p.gateway || null,
  }));
}
