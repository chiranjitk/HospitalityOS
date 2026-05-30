/**
 * FreeRADIUS NAS Table & clients.conf Sync Utility
 *
 * Shared between:
 *   - src/app/api/wifi/nas/route.ts        (NAS Clients CRUD)
 *   - src/app/api/integrations/wifi-gateways/route.ts  (WiFi Controller auto-create)
 *
 * Performs:
 *   1. INSERT/UPDATE/DELETE on the FreeRADIUS native `nas` table
 *   2. Rebuild the StaySuite managed section in /etc/raddb/clients.conf
 *   3. Reload FreeRADIUS (systemctl restart or SIGHUP)
 */

import { db } from '@/lib/db';
import { CLIENTS_CONF } from '@/lib/wifi/paths';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

// Section markers for StaySuite managed block in clients.conf
const STAYSUITE_CLIENT_BEGIN = '# >>> StaySuite Managed NAS Clients BEGIN <<<';
const STAYSUITE_CLIENT_END = '# >>> StaySuite Managed NAS Clients END <<<';

/**
 * Insert a NAS client into the FreeRADIUS native `nas` table.
 * Returns true on success, false on failure (never throws).
 */
export async function insertFreeRadiusNas(opts: {
  ipAddress: string;
  shortname?: string;
  type?: string;
  secret: string;
  coaPort?: number;
  description?: string;
}): Promise<boolean> {
  try {
    await db.$executeRawUnsafe(`
      INSERT INTO nas (nasname, shortname, type, ports, secret, server, community, description)
      VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6)
    `, opts.ipAddress, opts.shortname || opts.ipAddress, opts.type || 'other', opts.coaPort || 3799, opts.secret, opts.description || opts.ipAddress);
    return true;
  } catch (err) {
    console.warn('[NAS-Sync] Failed to insert into FreeRADIUS nas table:', err);
    return false;
  }
}

/**
 * Delete a NAS client from the FreeRADIUS native `nas` table by IP.
 * Returns true on success, false on failure (never throws).
 */
export async function deleteFreeRadiusNas(ipAddress: string): Promise<boolean> {
  try {
    await db.$executeRawUnsafe(`DELETE FROM nas WHERE nasname = $1`, ipAddress);
    return true;
  } catch (err) {
    console.warn('[NAS-Sync] Failed to delete from FreeRADIUS nas table:', err);
    return false;
  }
}

/**
 * Update a NAS client in the FreeRADIUS native `nas` table.
 * Returns true on success, false on failure (never throws).
 */
export async function updateFreeRadiusNas(
  oldIpAddress: string,
  opts: {
    ipAddress?: string;
    shortname?: string;
    type?: string;
    secret?: string;
    coaPort?: number;
    description?: string;
  }
): Promise<boolean> {
  try {
    await db.$executeRawUnsafe(`
      UPDATE nas SET nasname = $1, shortname = $2, type = $3, ports = $4, secret = $5, description = $6
      WHERE nasname = $7
    `,
      opts.ipAddress || oldIpAddress,
      opts.shortname || opts.ipAddress || oldIpAddress,
      opts.type || 'other',
      opts.coaPort || 3799,
      opts.secret || 'changeme',
      opts.description || opts.ipAddress || oldIpAddress,
      oldIpAddress,
    );
    return true;
  } catch (err) {
    console.warn('[NAS-Sync] Failed to update FreeRADIUS nas table:', err);
    return false;
  }
}

/**
 * Rebuild the StaySuite managed section in /etc/raddb/clients.conf from PostgreSQL nas table.
 * Called after every NAS create/update/delete to keep FreeRADIUS client whitelist in sync.
 */
export async function syncClientsConf(): Promise<boolean> {
  try {
    // Read all NAS clients from PostgreSQL nas table
    const rows = await db.$queryRawUnsafe<Array<{
      nasname: string; shortname: string; type: string; ports: number; secret: string; description: string;
    }>>('SELECT nasname, shortname, type, ports, secret, description FROM nas ORDER BY id');

    // Build managed section
    const lines: string[] = [STAYSUITE_CLIENT_BEGIN];
    for (const row of rows) {
      // Skip 127.0.0.1 — already covered by default 'client localhost' in clients.conf.
      // Adding it again causes "Failed to add duplicate client" error.
      if (row.nasname === '127.0.0.1' || row.nasname === '::1') continue;

      const shortname = row.shortname || row.nasname.replace(/\s+/g, '_');
      const coaPort = row.ports || 3799;
      lines.push('');
      lines.push(`# NAS Client: ${row.nasname}${row.description ? ' — ' + row.description : ''}`);
      lines.push(`client ${shortname} {`);
      lines.push(`    ipaddr = ${row.nasname}`);
      lines.push(`    secret = "${row.secret}"`);
      lines.push(`    shortname = ${shortname}`);
      if (coaPort !== 3799) {
        lines.push(`    coa_port = ${coaPort}`);
      }
      lines.push(`    nas_type = ${row.type || 'other'}`);
      lines.push(`    require_message_authenticator = yes`);
      lines.push(`    limit_proxy_state = yes`);
      lines.push(`    response_window = 6`);
      lines.push(`}`);
    }
    lines.push('');
    lines.push(STAYSUITE_CLIENT_END);
    const managedSection = lines.join('\n');

    // Read existing clients.conf or start empty
    let existingContent = '';
    try {
      existingContent = readFileSync(CLIENTS_CONF, 'utf-8');
    } catch {
      // File doesn't exist yet
    }

    // Replace or append our managed section
    let newContent: string;
    const beginIdx = existingContent.indexOf(STAYSUITE_CLIENT_BEGIN);
    const endIdx = existingContent.indexOf(STAYSUITE_CLIENT_END);

    if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
      newContent = existingContent.slice(0, beginIdx) + managedSection + existingContent.slice(endIdx + STAYSUITE_CLIENT_END.length);
    } else {
      newContent = existingContent + (existingContent.length > 0 ? '\n' : '') + managedSection + '\n';
    }

    // FIX: Ensure parent directory exists before writing (sandbox safety)
    const clientsDir = path.dirname(CLIENTS_CONF);
    if (!existsSync(clientsDir)) {
      mkdirSync(clientsDir, { recursive: true });
    }
    writeFileSync(CLIENTS_CONF, newContent, 'utf-8');

    // Set ownership for production
    try {
      execSync(`chown radiusd:radiusd "${CLIENTS_CONF}" && chmod 640 "${CLIENTS_CONF}"`, { timeout: 3000 });
    } catch {
      // Sandbox or non-root — ignore
    }

    // Reload FreeRADIUS to pick up changes
    try {
      execSync('systemctl restart radiusd', { timeout: 10000 });
    } catch {
      // Sandbox — try SIGHUP
      try {
        const pid = execSync("pgrep -x radiusd | head -1", { encoding: 'utf-8', timeout: 3000 }).trim();
        if (pid) process.kill(Number(pid), 'SIGHUP');
      } catch { /* ignore */ }
    }

    console.log(`[NAS-Sync] Synced ${rows.length} clients to ${CLIENTS_CONF}`);
    return true;
  } catch (error) {
    console.error('[NAS-Sync] Failed to sync clients.conf:', error);
    return false;
  }
}
