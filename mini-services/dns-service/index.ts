/**
 * DNS (dnsmasq) Management Service for StaySuite HospitalityOS
 *
 * Manages dnsmasq DNS server on Debian 13:
 * - DNS zones & records (A, AAAA, CNAME, MX, TXT, SRV, PTR)
 * - DNS redirects for captive portal
 * - Upstream forwarders
 * - Cache management
 * - Auto-sync DB -> dnsmasq config -> reload
 *
 * Uses PostgreSQL (shared with main StaySuite app via Prisma-managed tables).
 * DnsZone, DnsRecord, DnsRedirectRule are Prisma-managed.
 * DnsForwarder, DnsActivityLog are service-managed.
 *
 * Port: 3012
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import pg from 'pg';
import { createLogger } from '../shared/logger';

const { Pool } = pg;

const app = new Hono();
const PORT = 3012;
const SERVICE_VERSION = '2.0.0';
const log = createLogger('dns-service');
const startTime = Date.now();

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '..', '..');
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite';

// Detect system dnsmasq
const SYSTEM_DNSMASQ = (() => {
  try { execSync('which dnsmasq 2>/dev/null', { encoding: 'utf-8' }); return true; } catch { return false; }
})();

const DNSMASQ_BIN = SYSTEM_DNSMASQ ? '/usr/sbin/dnsmasq' : (process.env.DNSMASQ_BIN || '/usr/sbin/dnsmasq');
const DNSMASQ_CONFIG_DIR = SYSTEM_DNSMASQ ? '/etc/dnsmasq.d' : path.join(PROJECT_ROOT, 'dns-local');
const DNSMASQ_CONFIG = path.join(DNSMASQ_CONFIG_DIR, 'staysuite.conf');
const DNSMASQ_PID_FILE = SYSTEM_DNSMASQ ? '/run/dnsmasq.pid' : '/tmp/dnsmasq.pid';
const DNSMASQ_RESOLV = SYSTEM_DNSMASQ ? '/etc/resolv.conf' : path.join(PROJECT_ROOT, 'dns-local', 'resolv.conf');

// Ensure config directory exists
try { fs.mkdirSync(DNSMASQ_CONFIG_DIR, { recursive: true }); } catch {}

// ============================================================================
// Database Connection (PostgreSQL)
// ============================================================================

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 60000,
  application_name: 'dns-service',
});

pool.on('error', (err: Error) => {
  log.error('Unexpected database pool error', { error: err.message });
});

// Test connection with retry (PG may not be ready immediately after boot)
(async () => {
  const maxRetries = 10;
  const delayMs = 3000;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      log.info('Connected to PostgreSQL', { database: DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') });
      break;
    } catch (error) {
      const isLast = attempt === maxRetries;
      log[isLast ? 'error' : 'warn'](
        isLast
          ? 'Failed to connect to PostgreSQL after all retries — exiting'
          : `PostgreSQL connection attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs / 1000}s...`,
        { database: DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), error: String(error) }
      );
      if (isLast) process.exit(1);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
})();

// Create service-managed tables (not in Prisma schema)
async function ensureServiceTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DnsForwarder" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL DEFAULT 'default',
        "propertyId" TEXT NOT NULL DEFAULT 'default',
        "address" TEXT NOT NULL,
        "port" INTEGER NOT NULL DEFAULT 53,
        "description" TEXT,
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE("address", "port", "propertyId")
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DnsActivityLog" (
        "id" TEXT PRIMARY KEY,
        "action" TEXT NOT NULL,
        "details" TEXT,
        "severity" TEXT NOT NULL DEFAULT 'info',
        "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    log.info('Service-managed tables verified/created');
  } catch (error) {
    log.error('Failed to create service tables', { error: String(error) });
  }
}

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return crypto.randomUUID();
}

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch { return ''; }
}

/**
 * Map DnsRedirectRule row to DnsRedirect API format.
 * matchPattern -> domain + wildcard
 */
function redirectRuleToApi(rule: any): any {
  let domain = rule.matchPattern || '';
  let wildcard = false;
  if (domain.startsWith('*.')) {
    domain = domain.slice(2);
    wildcard = true;
  } else if (domain === '*') {
    wildcard = true;
  }
  return {
    id: rule.id,
    tenantId: rule.tenantId,
    propertyId: rule.propertyId,
    name: rule.name,
    domain,
    wildcard,
    targetIp: rule.targetIp,
    applyTo: rule.applyTo,
    priority: rule.priority,
    description: rule.description,
    enabled: rule.enabled,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

/**
 * Convert DnsRedirect API fields to DnsRedirectRule DB fields.
 */
function apiToRedirectRule(body: any): { matchPattern: string; name: string; applyTo: string } {
  let matchPattern = body.domain || '';
  if (body.wildcard && matchPattern !== '*') {
    matchPattern = `*.${matchPattern}`;
  }
  return {
    matchPattern,
    name: body.name || body.domain || 'Redirect',
    applyTo: body.applyTo || 'unauthenticated',
  };
}

/**
 * Convert DnsRedirectRule matchPattern to dnsmasq address= format.
 *
 * dnsmasq address= syntax: address=/<domain>/<ip>
 * - Specific domain:  address=/example.com/1.2.3.4
 * - Wildcard subdomain: address=/.example.com/1.2.3.4  (matches *.example.com)
 * - Catch-all (all non-local): address=/#/1.2.3.4
 *
 * IMPORTANT: dnsmasq does NOT support * as a wildcard in address=.
 * Only # is a special catch-all that matches any domain NOT defined locally.
 */
function matchPatternToDnsmasq(matchPattern: string): string {
  if (matchPattern === '*') {
    // Catch-all: redirect ALL non-local domains to captive portal
    // # is dnsmasq's built-in wildcard for "any domain not defined locally"
    return '/#';
  } else if (matchPattern.startsWith('*.')) {
    // Wildcard subdomain: *.example.com → .example.com (leading dot = subdomain match)
    return `/${matchPattern.slice(1)}`;
  } else {
    return `/${matchPattern}`;
  }
}

function getDnsmasqPid(): string {
  try {
    const result = safeExec('pgrep -x dnsmasq');
    return result.trim().split('\n')[0] || '';
  } catch { return ''; }
}

function isDnsmasqRunning(): boolean {
  try {
    const pid = getDnsmasqPid();
    if (!pid) return false;
    const ssResult = execSync('ss -ulnp | grep -F ":53"', { encoding: 'utf-8' });
    return ssResult.trim().length > 0;
  } catch { return false; }
}

function getDnsmasqStats(): {
  upstreamQueries: number; upstreamRetried: number; upstreamFailed: number;
  nxdomainReplies: number; avgLatencyMs: number; forwarders: { address: string; port: number; queries: number; retried: number; failed: number; nxdomain: number; latency: number }[];
  dnssecCryptoHwm: number; dnssecSigFails: number;
  poolMemoryUsed: number; poolMemoryMax: number; poolMemoryAllocated: number;
  tcpInUse: number; tcpMaxAllowed: number;
  cacheEntriesAvailable: boolean;
} {
  const defaultResult = {
    upstreamQueries: 0, upstreamRetried: 0, upstreamFailed: 0,
    nxdomainReplies: 0, avgLatencyMs: 0, forwarders: [] as { address: string; port: number; queries: number; retried: number; failed: number; nxdomain: number; latency: number }[],
    dnssecCryptoHwm: 0, dnssecSigFails: 0,
    poolMemoryUsed: 0, poolMemoryMax: 0, poolMemoryAllocated: 0,
    tcpInUse: 0, tcpMaxAllowed: 0,
    cacheEntriesAvailable: false,
  };
  try {
    const pid = getDnsmasqPid();
    if (!pid) return defaultResult;

    safeExec(`kill -USR1 ${pid} 2>/dev/null`);
    safeExec('sleep 0.3');

    const logOutput = safeExec(
      'journalctl -t dnsmasq --no-pager -n 20 2>/dev/null || ' +
      'journalctl --no-pager -n 20 --grep=dnsmasq 2>/dev/null || ' +
      'tail -20 /var/log/messages 2>/dev/null || ' +
      'tail -20 /var/log/syslog 2>/dev/null'
    );

    if (!logOutput) return defaultResult;

    const result = { ...defaultResult, forwardersMap: new Map<string, typeof defaultResult.forwarders[0]>() };

    for (const line of logOutput.split('\n')) {
      const dnssecCrypto = line.match(/DNSSEC per-query crypto work HWM\s+(\d+)/);
      if (dnssecCrypto) { result.dnssecCryptoHwm = parseInt(dnssecCrypto[1]); continue; }

      const dnssecSig = line.match(/DNSSEC per-RRSet signature fails HWM\s+(\d+)/);
      if (dnssecSig) { result.dnssecSigFails = parseInt(dnssecSig[1]); continue; }

      const poolMem = line.match(/pool memory in use\s+(\d+),\s*max\s+(\d+),\s*allocated\s+(\d+)/);
      if (poolMem) {
        result.poolMemoryUsed = parseInt(poolMem[1]);
        result.poolMemoryMax = parseInt(poolMem[2]);
        result.poolMemoryAllocated = parseInt(poolMem[3]);
        continue;
      }

      const tcpInfo = line.match(/child processes for TCP requests.*in use\s+(\d+).*max allowed\s+(\d+)/);
      if (tcpInfo) {
        result.tcpInUse = parseInt(tcpInfo[1]);
        result.tcpMaxAllowed = parseInt(tcpInfo[2]);
        continue;
      }

      const serverMatch = line.match(/server\s+([^#]+)#(\d+):\s*queries sent\s+(\d+),\s*retried\s+(\d+),\s*failed\s+(\d+),\s*nxdomain replies?\s+(\d+),\s*avg\.\s*latency\s+(\d+)ms/);
      if (serverMatch) {
        const fwKey = `${serverMatch[1]}:${serverMatch[2]}`;
        result.forwardersMap.set(fwKey, {
          address: serverMatch[1],
          port: parseInt(serverMatch[2]),
          queries: parseInt(serverMatch[3]),
          retried: parseInt(serverMatch[4]),
          failed: parseInt(serverMatch[5]),
          nxdomain: parseInt(serverMatch[6]),
          latency: parseInt(serverMatch[7]),
        });
        continue;
      }

      const cacheMatch = line.match(/cache size\s+(\d+),\s*(\d+)\/(\d+)\s*cache entries/);
      if (cacheMatch) {
        result.cacheEntriesAvailable = true;
        continue;
      }
    }

    const forwarders = Array.from(result.forwardersMap.values());
    return {
      upstreamQueries: forwarders.reduce((s, f) => s + f.queries, 0),
      upstreamRetried: forwarders.reduce((s, f) => s + f.retried, 0),
      upstreamFailed: forwarders.reduce((s, f) => s + f.failed, 0),
      nxdomainReplies: forwarders.reduce((s, f) => s + f.nxdomain, 0),
      avgLatencyMs: forwarders.length > 0 ? Math.round(forwarders.reduce((s, f) => s + f.latency, 0) / forwarders.length) : 0,
      forwarders,
      dnssecCryptoHwm: result.dnssecCryptoHwm,
      dnssecSigFails: result.dnssecSigFails,
      poolMemoryUsed: result.poolMemoryUsed,
      poolMemoryMax: result.poolMemoryMax,
      poolMemoryAllocated: result.poolMemoryAllocated,
      tcpInUse: result.tcpInUse,
      tcpMaxAllowed: result.tcpMaxAllowed,
      cacheEntriesAvailable: result.cacheEntriesAvailable,
    };
  } catch {}
  return defaultResult;
}

function getDnsmasqVersion(): string {
  try {
    const result = execSync(`${DNSMASQ_BIN} -v 2>&1 | head -1`, { encoding: 'utf-8' });
    return result.trim();
  } catch { return 'Unknown'; }
}

function startDnsmasq(): { success: boolean; message: string } {
  if (isDnsmasqRunning()) return { success: true, message: 'dnsmasq is already running' };
  try {
    if (SYSTEM_DNSMASQ) {
      // Production: use systemctl (Rocky Linux / systemd)
      const result = safeExec('systemctl start dnsmasq 2>&1');
      if (result.includes('not found') || result.includes('not loaded')) {
        // Fall back to direct start with our config directory
        execSync(`${DNSMASQ_BIN} -C ${path.dirname(DNSMASQ_CONFIG)} --keep-in-foreground=false 2>&1`, { encoding: 'utf-8' });
      }
    } else {
      // Sandbox/dev: start directly
      execSync(`${DNSMASQ_BIN} -C ${path.dirname(DNSMASQ_CONFIG)} --keep-in-foreground=false 2>&1`, { encoding: 'utf-8' });
    }
    const start = Date.now();
    while (Date.now() - start < 5000) {
      if (isDnsmasqRunning()) return { success: true, message: 'dnsmasq started successfully' };
      execSync('sleep 0.5');
    }
    return { success: false, message: 'dnsmasq failed to start within timeout' };
  } catch (error) {
    return { success: false, message: `Failed to start dnsmasq: ${error}` };
  }
}

function stopDnsmasq(): { success: boolean; message: string } {
  if (!isDnsmasqRunning()) return { success: true, message: 'dnsmasq is not running' };
  try {
    if (SYSTEM_DNSMASQ) {
      safeExec('systemctl stop dnsmasq 2>/dev/null || true');
    } else {
      execSync('pkill dnsmasq 2>/dev/null || true');
    }
    const start = Date.now();
    while (Date.now() - start < 3000) {
      if (!isDnsmasqRunning()) return { success: true, message: 'dnsmasq stopped successfully' };
      execSync('sleep 0.5');
    }
    if (SYSTEM_DNSMASQ) {
      safeExec('systemctl kill -s SIGKILL dnsmasq 2>/dev/null || true');
    } else {
      try { execSync('pkill -9 dnsmasq 2>/dev/null'); } catch {}
    }
    return { success: true, message: 'dnsmasq force-stopped' };
  } catch (error) {
    return { success: false, message: `Failed to stop dnsmasq: ${error}` };
  }
}

function reloadDnsmasq(): { success: boolean; message: string } {
  if (!isDnsmasqRunning()) {
    // Not running — start it
    return startDnsmasq();
  }
  try {
    if (SYSTEM_DNSMASQ) {
      safeExec('systemctl reload dnsmasq 2>/dev/null || true');
    }
    // Always also send SIGHUP for direct process control
    execSync('pkill -HUP dnsmasq 2>/dev/null || true');
    return { success: true, message: 'dnsmasq reloaded (config re-read)' };
  } catch (error) {
    return { success: false, message: `Failed to reload dnsmasq: ${error}` };
  }
}

/**
 * Default upstream DNS forwarders — used when DnsForwarder table is empty
 * or has no enabled entries. These ensure external resolution always works.
 */
const DEFAULT_UPSTREAM_DNS = [
  '8.8.8.8',        // Google DNS Primary
  '8.8.4.4',        // Google DNS Secondary
  '1.1.1.1',        // Cloudflare DNS Primary
  '1.0.0.1',        // Cloudflare DNS Secondary
];

async function syncConfigToDisk(): Promise<{ success: boolean; lines: number }> {
  let config = `# StaySuite DNS Configuration - Auto-generated
# Last updated: ${new Date().toISOString()}
# DO NOT EDIT MANUALLY - Changes will be overwritten
#
# Architecture:
#   1. Listen on ALL interfaces (gateway + DNS for LAN clients)
#   2. Authoritative for local zones (staysuite.local, *.staysuite.local)
#   3. Forward external queries to upstream DNS (Google/Cloudflare)
#   4. Local domains resolve WITHOUT internet — always authoritative first
#

# ═══════════════════════════════════════════════════════════════════════
# 1. GENERAL SETTINGS (must be first)
# ═══════════════════════════════════════════════════════════════════════
`;

  // bind-dynamic alone listens on ALL available interfaces (no listen-address needed)
  config += `# Listen on all interfaces automatically
bind-dynamic

# DNS behavior
domain-needed          # Don't forward bare hostnames (no dots) to upstream
bogus-priv             # Never forward private IP ranges to upstream
no-resolv              # Don't read /etc/resolv.conf — we control upstream servers
expand-hosts           # Expand simple hostnames from /etc/hosts
stop-dns-rebind        # Protect against DNS rebinding attacks
local-ttl=300          # TTL for local/authoritative responses (5 min)

# Cache & performance
cache-size=10000
dns-forward-max=1000
min-port=1024          # Use high ports for upstream queries (firewall friendly)
edns-packet-max=4096   # Support large DNS responses (DNSSEC, large TXT)

`;

  // ═══════════════════════════════════════════════════════════════════════
  // 2. UPSTREAM FORWARDERS — external domain resolution
  // ═══════════════════════════════════════════════════════════════════════
  let hasForwarders = false;
  try {
    await pool.query('SELECT 1 FROM "DnsForwarder" LIMIT 1');
    const fwResult = await pool.query('SELECT * FROM "DnsForwarder" WHERE enabled = true');
    if (fwResult.rows.length > 0) {
      config += '# Upstream DNS forwarders (from database)\n';
      for (const f of fwResult.rows) {
        config += `server=${f.port !== 53 ? `${f.address}#${f.port}` : f.address}\n`;
      }
      hasForwarders = true;
    }
  } catch (error) {
    log.warn('DnsForwarder table not available, using defaults', { error: String(error) });
  }

  // Always have at least default upstream servers — dnsmasq REFUSES queries without any
  if (!hasForwarders) {
    config += `# Upstream DNS forwarders (defaults — Google + Cloudflare)\n`;
    for (const dns of DEFAULT_UPSTREAM_DNS) {
      config += `server=${dns}\n`;
    }
  }

  // Strict order: try servers in the order listed
  config += `strict-order\n\n`;

  // ═══════════════════════════════════════════════════════════════════════
  // 3. LOCAL ZONES — authoritative resolution WITHOUT internet
  // ═══════════════════════════════════════════════════════════════════════
  try {
    const zoneResult = await pool.query('SELECT * FROM "DnsZone" WHERE enabled = true');
    for (const zone of zoneResult.rows) {
      const domain = zone.domain;
      config += `# ── Zone: ${domain} (authoritative) ──\n`;

      // Mark this zone as local — dnsmasq will answer from its own records
      // and NOT forward queries for this domain to upstream
      config += `local=/${domain}/\n`;
      // NOTE: Do NOT emit 'domain=' here — dnsmasq only allows ONE 'domain' directive
      // across ALL config files. Emitting it per-zone causes 'illegal repeated keyword'.

      // Read records for this zone
      let hasApexARecord = false;
      let firstARecordIp = '';
      try {
        const recResult = await pool.query('SELECT * FROM "DnsRecord" WHERE "zoneId" = $1 AND enabled = true', [zone.id]);
        for (const r of recResult.rows) {
          // Handle apex record: name='@' means the bare domain itself
          const name = r.name === '@' ? domain : r.name;
          const fqdn = `${name}.${domain}`;

          if (r.type === 'A') {
            if (!firstARecordIp) firstARecordIp = r.value;
            // Check if this is an apex A record (name is @ or equals the domain)
            if (r.name === '@' || r.name === domain) {
              hasApexARecord = true;
            }
            config += `host-record=${fqdn},${r.value}\n`;
          } else if (r.type === 'AAAA') {
            config += `host-record=${fqdn},${r.value}\n`;
          } else if (r.type === 'CNAME') {
            config += `cname=${fqdn},${r.value}\n`;
          } else if (r.type === 'MX') {
            config += `mx-host=${domain},${r.value},${r.priority || 10}\n`;
          } else if (r.type === 'TXT') {
            config += `txt-record=${fqdn},${r.value}\n`;
          } else if (r.type === 'SRV') {
            config += `srv-host=${fqdn},${r.value},${r.priority || 10}\n`;
          } else if (r.type === 'PTR') {
            config += `ptr-record=${fqdn},${r.value}\n`;
          }
        }
      } catch (error) {
        log.warn(`Failed to read records for zone ${zone.id}`, { error: String(error) });
      }

      // Auto-add apex A record if zone has no @ record but has A records
      // This ensures the bare domain (e.g. staysuite.local) resolves
      if (!hasApexARecord && firstARecordIp) {
        config += `host-record=${domain},${firstARecordIp}\n`;
        log.info(`Auto-added apex record: ${domain} → ${firstARecordIp} (no explicit @ record in zone)`);
      }

      config += '\n';
    }
  } catch (error) {
    log.warn('Failed to read zones for config', { error: String(error) });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. DNS REDIRECTS — captive portal (address=/domain/target)
  // ═══════════════════════════════════════════════════════════════════════
  try {
    const redirResult = await pool.query('SELECT * FROM "DnsRedirectRule" WHERE enabled = true ORDER BY priority ASC');
    if (redirResult.rows.length > 0) {
      config += '# DNS Redirects (Captive Portal)\n';
      for (const r of redirResult.rows) {
        const dnsmasqDomain = matchPatternToDnsmasq(r.matchPattern);
        // dnsmasqDomain already starts with '/' (e.g. '/#', '/.example.com', '/example.com')
      // so we must NOT add an extra '/' — address=<domain>/<ip>, domain already has leading /
      config += `address=${dnsmasqDomain}/${r.targetIp}\n`;
      }
      config += '\n';
    }
  } catch (error) {
    log.warn('Failed to read redirects for config', { error: String(error) });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. PTR (REVERSE DNS) for local subnets — rDNS for LAN clients
  // ═══════════════════════════════════════════════════════════════════════
  try {
    const subnetResult = await pool.query('SELECT "subnet" FROM "DhcpSubnet" WHERE "enabled" = true');
    if (subnetResult.rows.length > 0) {
      config += '# Reverse DNS — resolve local IPs from DHCP subnets\n';
      // dnsmasq requires auth-server when auth-zone is defined
      config += 'auth-server=0.0.0.0\n';
      for (const sub of subnetResult.rows) {
        const cidr = sub.subnet;
        if (cidr && cidr.includes('/')) {
          const network = cidr.split('/')[0];
          // rev-zone: 192.168.1.0/24 → 1.168.192.in-addr.arpa
          const octets = network.split('.').reverse().join('.');
          config += `auth-zone=${octets}.in-addr.arpa\n`;
        }
      }
      config += '\n';
    }
  } catch (error) {
    log.warn('Failed to read DHCP subnets for reverse DNS', { error: String(error) });
  }

  try {
    fs.writeFileSync(DNSMASQ_CONFIG, config, 'utf-8');
    const lineCount = config.split('\n').filter(l => l.trim() && !l.startsWith('#')).length;
    log.info(`DNS config generated: ${DNSMASQ_CONFIG} (${lineCount} directives)`);
    return { success: true, lines: lineCount };
  } catch (error) {
    log.error('Failed to write dnsmasq config', { error: String(error) });
    return { success: false, lines: 0 };
  }
}

async function fullSync(): Promise<{ config: any; reload: any }> {
  const config = await syncConfigToDisk();
  let reload: any = { success: false, message: 'dnsmasq not running' };
  if (isDnsmasqRunning()) {
    reload = reloadDnsmasq();
  }
  return { config, reload };
}

// ============================================================================
// Startup Initialization
// ============================================================================

(async () => {
  // Create service-managed tables
  await ensureServiceTables();

  // Seed activity log if empty
  try {
    const countResult = await pool.query('SELECT COUNT(*) as c FROM "DnsActivityLog"');
    if (parseInt(countResult.rows[0]?.c) === 0) {
      const seedLogs = [
        { action: 'service_start', details: 'DNS service initialized (PostgreSQL)', severity: 'info' },
        { action: 'config_sync', details: 'Initial config sync completed', severity: 'info' },
      ];
      for (const entry of seedLogs) {
        await pool.query(
          'INSERT INTO "DnsActivityLog" (id, action, details, severity) VALUES ($1, $2, $3, $4)',
          [generateId(), entry.action, entry.details, entry.severity]
        );
      }
    }
  } catch {}

  // Seed default forwarders if DnsForwarder table is empty
  // This ensures the GUI shows the same servers that are in the config file
  try {
    const fwCountResult = await pool.query('SELECT COUNT(*) as c FROM "DnsForwarder"');
    if (parseInt(fwCountResult.rows[0]?.c) === 0) {
      log.info('DnsForwarder table is empty, seeding default upstream DNS servers');
      for (const addr of DEFAULT_UPSTREAM_DNS) {
        await pool.query(
          'INSERT INTO "DnsForwarder" (id, "tenantId", "propertyId", address, port, description, enabled) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING',
          [generateId(), 'default', 'default', addr, 53,
            addr === '8.8.8.8' ? 'Google DNS Primary' :
            addr === '8.8.4.4' ? 'Google DNS Secondary' :
            addr === '1.1.1.1' ? 'Cloudflare DNS Primary' :
            'Cloudflare DNS Secondary',
            true]
        );
      }
      log.info(`Seeded ${DEFAULT_UPSTREAM_DNS.length} default forwarders`);
    }
  } catch {}

  // Generate dnsmasq config
  await syncConfigToDisk();

  if (SYSTEM_DNSMASQ && !isDnsmasqRunning()) {
    log.info('dnsmasq detected but not running, auto-starting');
    const result = startDnsmasq();
    log.info(result.success ? 'dnsmasq started' : 'dnsmasq start failed', { message: result.message });
  } else if (!SYSTEM_DNSMASQ) {
    log.warn('dnsmasq not found on system');
  } else {
    log.info('dnsmasq is running');
  }
})();

// ============================================================================
// Middleware
// ============================================================================

(globalThis as Record<string, unknown>).__authWarningLogged = false;

// Auth middleware - check Bearer token, skip for /health endpoint
app.use('*', async (c, next) => {
  if (c.req.path === '/health') {
    return next();
  }

  const authSecret = process.env.SERVICE_AUTH_SECRET;

  if (!authSecret) {
    if (!(globalThis as Record<string, unknown>).__authWarningLogged) {
      log.warn('SERVICE_AUTH_SECRET not configured. All requests will be allowed. Set SERVICE_AUTH_SECRET env var for production.');
      (globalThis as Record<string, unknown>).__authWarningLogged = true;
    }
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.substring(7);
  if (token !== authSecret) {
    return c.json({ success: false, error: 'Invalid token' }, 403);
  }

  return next();
});

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', async (c) => {
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch {}

  return c.json({
    status: dbOk ? 'healthy' : 'degraded',
    service: 'dns-service',
    version: SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    port: PORT,
    memoryUsage: process.memoryUsage(),
    dnsmasq: { installed: SYSTEM_DNSMASQ, running: isDnsmasqRunning(), configPath: DNSMASQ_CONFIG },
    database: {
      url: DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
      connected: dbOk,
    },
  });
});

// ============================================================================
// Service Status & Control
// ============================================================================

app.get('/api/status', async (c) => {
  const running = isDnsmasqRunning();
  const version = running ? getDnsmasqVersion() : 'Not running';

  let zoneCount = 0, recordCount = 0, redirectCount = 0, forwarderCount = 0;
  try { zoneCount = parseInt((await pool.query('SELECT COUNT(*) as c FROM "DnsZone" WHERE enabled = true')).rows[0]?.c) || 0; } catch {}
  try { recordCount = parseInt((await pool.query('SELECT COUNT(*) as c FROM "DnsRecord" WHERE enabled = true')).rows[0]?.c) || 0; } catch {}
  try { redirectCount = parseInt((await pool.query('SELECT COUNT(*) as c FROM "DnsRedirectRule" WHERE enabled = true')).rows[0]?.c) || 0; } catch {}
  try { forwarderCount = parseInt((await pool.query('SELECT COUNT(*) as c FROM "DnsForwarder" WHERE enabled = true')).rows[0]?.c) || 0; } catch {}

  // Cache stats
  let cacheStats = { size: 0, inserts: 0, evictions: 0 };
  try {
    const configContent = fs.readFileSync(DNSMASQ_CONFIG, 'utf-8');
    const match = configContent.match(/cache-size=(\d+)/);
    cacheStats.size = match ? parseInt(match[1]) : 0;
  } catch {}

  return c.json({
    success: true,
    data: {
      installed: SYSTEM_DNSMASQ,
      running,
      version: version || 'dnsmasq (StaySuite)',
      mode: running ? 'production' : 'stopped',
      configPath: DNSMASQ_CONFIG,
      pidFile: DNSMASQ_PID_FILE,
      zoneCount,
      recordCount,
      redirectCount,
      forwarderCount,
      cacheStats,
      database: {
        url: DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
        connected: true,
      },
    }
  });
});

app.post('/api/service/start', async (c) => {
  await syncConfigToDisk();
  const result = startDnsmasq();
  return c.json({ success: result.success, message: result.message, running: isDnsmasqRunning() });
});

app.post('/api/service/stop', (c) => {
  const result = stopDnsmasq();
  return c.json({ success: result.success, message: result.message, running: isDnsmasqRunning() });
});

app.post('/api/service/restart', async (c) => {
  await syncConfigToDisk();
  stopDnsmasq();
  const result = startDnsmasq();
  return c.json({ success: result.success, message: result.message, running: isDnsmasqRunning() });
});

app.post('/api/service/reload', async (c) => {
  await syncConfigToDisk();
  const result = reloadDnsmasq();
  return c.json({ success: result.success, message: result.message });
});

// ============================================================================
// DNS Zones (Prisma-managed: "DnsZone")
// ============================================================================

app.get('/api/zones', async (c) => {
  try {
    const result = await pool.query('SELECT *, \'forward\' as type FROM "DnsZone" ORDER BY domain ASC');
    const zones = result.rows;
    // Add record counts
    for (const zone of zones) {
      try {
        const countResult = await pool.query('SELECT COUNT(*) as c FROM "DnsRecord" WHERE "zoneId" = $1', [zone.id]);
        zone.recordCount = parseInt(countResult.rows[0]?.c) || 0;
      } catch { zone.recordCount = 0; }
    }
    return c.json({ success: true, data: zones });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/zones', async (c) => {
  try {
    const body = await c.req.json();
    const id = generateId();
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO "DnsZone" (id, "tenantId", "propertyId", domain, description, "vlanId", enabled, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         "tenantId" = EXCLUDED."tenantId",
         "propertyId" = EXCLUDED."propertyId",
         domain = EXCLUDED.domain,
         description = EXCLUDED.description,
         "vlanId" = EXCLUDED."vlanId",
         enabled = EXCLUDED.enabled,
         "updatedAt" = EXCLUDED."updatedAt"`,
      [
        id, body.tenantId || 'default', body.propertyId || 'default',
        body.domain, body.description || null,
        body.vlanId || null, body.enabled !== false,
        now, now
      ]
    );

    await fullSync();
    const zoneResult = await pool.query('SELECT *, \'forward\' as type FROM "DnsZone" WHERE id = $1', [id]);
    return c.json({ success: true, data: zoneResult.rows[0], message: 'DNS zone created' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.put('/api/zones/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;
    if (body.domain !== undefined) { fields.push(`domain = $${paramIdx++}`); values.push(body.domain); }
    if (body.description !== undefined) { fields.push(`description = $${paramIdx++}`); values.push(body.description); }
    if (body.vlanId !== undefined) { fields.push(`"vlanId" = $${paramIdx++}`); values.push(body.vlanId); }
    if (body.enabled !== undefined) { fields.push(`enabled = $${paramIdx++}`); values.push(body.enabled); }
    // Note: 'type' field from old API is not stored in Prisma DnsZone (always 'forward')
    fields.push(`"updatedAt" = $${paramIdx++}`); values.push(now);
    values.push(id);
    await pool.query(`UPDATE "DnsZone" SET ${fields.join(', ')} WHERE id = $${paramIdx}`, values);

    await fullSync();
    const zoneResult = await pool.query('SELECT *, \'forward\' as type FROM "DnsZone" WHERE id = $1', [id]);
    return c.json({ success: true, data: zoneResult.rows[0], message: 'DNS zone updated' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.delete('/api/zones/:id', async (c) => {
  try {
    const { id } = c.req.param();
    // Records are cascade-deleted via FK, but explicit delete for safety
    try { await pool.query('DELETE FROM "DnsRecord" WHERE "zoneId" = $1', [id]); } catch {}
    await pool.query('DELETE FROM "DnsZone" WHERE id = $1', [id]);
    await fullSync();
    return c.json({ success: true, message: 'DNS zone deleted' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// DNS Records (Prisma-managed: "DnsRecord")
// ============================================================================

app.get('/api/records', async (c) => {
  try {
    const zoneId = c.req.query('zoneId');
    const type = c.req.query('type');

    let query = 'SELECT r.*, z.domain as "zoneDomain" FROM "DnsRecord" r LEFT JOIN "DnsZone" z ON r."zoneId" = z.id WHERE 1=1';
    const values: any[] = [];
    let paramIdx = 1;
    if (zoneId) { query += ` AND r."zoneId" = $${paramIdx++}`; values.push(zoneId); }
    if (type) { query += ` AND r.type = $${paramIdx++}`; values.push(type); }
    query += ' ORDER BY r.type ASC, r.name ASC';

    const result = await pool.query(query, values);
    return c.json({ success: true, data: result.rows });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/records', async (c) => {
  try {
    const body = await c.req.json();
    const id = generateId();
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO "DnsRecord" (id, "tenantId", "zoneId", name, type, value, ttl, priority, enabled, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         "tenantId" = EXCLUDED."tenantId",
         "zoneId" = EXCLUDED."zoneId",
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         value = EXCLUDED.value,
         ttl = EXCLUDED.ttl,
         priority = EXCLUDED.priority,
         enabled = EXCLUDED.enabled,
         "updatedAt" = EXCLUDED."updatedAt"`,
      [
        id, body.tenantId || 'default', body.zoneId,
        body.name, body.type || 'A', body.value,
        body.ttl || 300, body.priority || null,
        body.enabled !== false, now, now
      ]
    );

    await fullSync();
    const recResult = await pool.query(
      'SELECT r.*, z.domain as "zoneDomain" FROM "DnsRecord" r LEFT JOIN "DnsZone" z ON r."zoneId" = z.id WHERE r.id = $1',
      [id]
    );
    return c.json({ success: true, data: recResult.rows[0], message: 'DNS record created' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.put('/api/records/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;
    if (body.name !== undefined) { fields.push(`name = $${paramIdx++}`); values.push(body.name); }
    if (body.type !== undefined) { fields.push(`type = $${paramIdx++}`); values.push(body.type); }
    if (body.value !== undefined) { fields.push(`value = $${paramIdx++}`); values.push(body.value); }
    if (body.ttl !== undefined) { fields.push(`ttl = $${paramIdx++}`); values.push(body.ttl); }
    if (body.priority !== undefined) { fields.push(`priority = $${paramIdx++}`); values.push(body.priority); }
    if (body.enabled !== undefined) { fields.push(`enabled = $${paramIdx++}`); values.push(body.enabled); }
    if (body.zoneId !== undefined) { fields.push(`"zoneId" = $${paramIdx++}`); values.push(body.zoneId); }
    fields.push(`"updatedAt" = $${paramIdx++}`); values.push(now);
    values.push(id);
    await pool.query(`UPDATE "DnsRecord" SET ${fields.join(', ')} WHERE id = $${paramIdx}`, values);

    await fullSync();
    const recResult = await pool.query(
      'SELECT r.*, z.domain as "zoneDomain" FROM "DnsRecord" r LEFT JOIN "DnsZone" z ON r."zoneId" = z.id WHERE r.id = $1',
      [id]
    );
    return c.json({ success: true, data: recResult.rows[0], message: 'DNS record updated' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.delete('/api/records/:id', async (c) => {
  try {
    const { id } = c.req.param();
    await pool.query('DELETE FROM "DnsRecord" WHERE id = $1', [id]);
    await fullSync();
    return c.json({ success: true, message: 'DNS record deleted' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// DNS Redirects (Prisma-managed: "DnsRedirectRule")
// API uses DnsRedirect format (domain, wildcard) -> maps to DnsRedirectRule (matchPattern, name, applyTo)
// ============================================================================

app.get('/api/redirects', async (c) => {
  try {
    const result = await pool.query('SELECT * FROM "DnsRedirectRule" ORDER BY priority ASC, "matchPattern" ASC');
    const redirects = result.rows.map(redirectRuleToApi);
    return c.json({ success: true, data: redirects });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/redirects', async (c) => {
  try {
    const body = await c.req.json();
    const id = generateId();
    const now = new Date().toISOString();
    const { matchPattern, name, applyTo } = apiToRedirectRule(body);

    await pool.query(
      `INSERT INTO "DnsRedirectRule" (id, "tenantId", "propertyId", name, "matchPattern", "targetIp", "applyTo", priority, enabled, description, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         "tenantId" = EXCLUDED."tenantId",
         "propertyId" = EXCLUDED."propertyId",
         name = EXCLUDED.name,
         "matchPattern" = EXCLUDED."matchPattern",
         "targetIp" = EXCLUDED."targetIp",
         "applyTo" = EXCLUDED."applyTo",
         priority = EXCLUDED.priority,
         enabled = EXCLUDED.enabled,
         description = EXCLUDED.description,
         "updatedAt" = EXCLUDED."updatedAt"`,
      [
        id, body.tenantId || 'default', body.propertyId || 'default',
        name, matchPattern, body.targetIp, applyTo,
        body.priority || 0, body.enabled !== false,
        body.description || null, now, now
      ]
    );

    await fullSync();
    const redirResult = await pool.query('SELECT * FROM "DnsRedirectRule" WHERE id = $1', [id]);
    return c.json({ success: true, data: redirectRuleToApi(redirResult.rows[0]), message: 'DNS redirect created' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.put('/api/redirects/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;
    if (body.domain !== undefined || body.wildcard !== undefined) {
      // Need to reconstruct matchPattern from domain + wildcard
      const currentResult = await pool.query('SELECT "matchPattern" FROM "DnsRedirectRule" WHERE id = $1', [id]);
      const currentMatchPattern = currentResult.rows[0]?.matchPattern || '';
      let currentDomain = currentMatchPattern;
      let currentWildcard = false;
      if (currentDomain.startsWith('*.')) { currentDomain = currentDomain.slice(2); currentWildcard = true; }
      else if (currentDomain === '*') { currentWildcard = true; }

      const newDomain = body.domain !== undefined ? body.domain : currentDomain;
      const newWildcard = body.wildcard !== undefined ? body.wildcard : currentWildcard;
      let newMatchPattern = newDomain;
      if (newWildcard && newMatchPattern !== '*') newMatchPattern = `*.${newMatchPattern}`;

      fields.push(`"matchPattern" = $${paramIdx++}`); values.push(newMatchPattern);
    }
    if (body.targetIp !== undefined) { fields.push(`"targetIp" = $${paramIdx++}`); values.push(body.targetIp); }
    if (body.priority !== undefined) { fields.push(`priority = $${paramIdx++}`); values.push(body.priority); }
    if (body.description !== undefined) { fields.push(`description = $${paramIdx++}`); values.push(body.description); }
    if (body.enabled !== undefined) { fields.push(`enabled = $${paramIdx++}`); values.push(body.enabled); }
    if (body.applyTo !== undefined) { fields.push(`"applyTo" = $${paramIdx++}`); values.push(body.applyTo); }
    if (body.name !== undefined) { fields.push(`name = $${paramIdx++}`); values.push(body.name); }
    fields.push(`"updatedAt" = $${paramIdx++}`); values.push(now);
    values.push(id);
    await pool.query(`UPDATE "DnsRedirectRule" SET ${fields.join(', ')} WHERE id = $${paramIdx}`, values);

    await fullSync();
    const redirResult = await pool.query('SELECT * FROM "DnsRedirectRule" WHERE id = $1', [id]);
    return c.json({ success: true, data: redirectRuleToApi(redirResult.rows[0]), message: 'DNS redirect updated' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.delete('/api/redirects/:id', async (c) => {
  try {
    const { id } = c.req.param();
    await pool.query('DELETE FROM "DnsRedirectRule" WHERE id = $1', [id]);
    await fullSync();
    return c.json({ success: true, message: 'DNS redirect deleted' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// DNS Cache
// ============================================================================

app.get('/api/cache', (c) => {
  try {
    const running = isDnsmasqRunning();
    let cacheSize = 0;
    let hitRate = 'Unknown';
    let coldMs = 0;
    let hotMs = 0;

    let upstreamQueries = 0;
    let upstreamRetried = 0;
    let upstreamFailed = 0;
    let nxdomainReplies = 0;
    let avgLatencyMs = 0;
    let forwarders: { address: string; port: number; queries: number; retried: number; failed: number; nxdomain: number; latency: number }[] = [];
    let poolMemoryUsed = 0;
    let poolMemoryMax = 0;
    let cacheEntriesAvailable = false;

    if (running) {
      const stats = getDnsmasqStats();
      upstreamQueries = stats.upstreamQueries;
      upstreamRetried = stats.upstreamRetried;
      upstreamFailed = stats.upstreamFailed;
      nxdomainReplies = stats.nxdomainReplies;
      avgLatencyMs = stats.avgLatencyMs;
      forwarders = stats.forwarders;
      poolMemoryUsed = stats.poolMemoryUsed;
      poolMemoryMax = stats.poolMemoryMax;
      cacheEntriesAvailable = stats.cacheEntriesAvailable;

      const testDomain = 'cache-test.staysuite.internal';
      try {
        const coldStart = Date.now();
        safeExec(`dig @127.0.0.1 ${testDomain} +short +tries=1 +time=2 2>/dev/null`, 5000);
        coldMs = Date.now() - coldStart;

        const hotStart = Date.now();
        safeExec(`dig @127.0.0.1 ${testDomain} +short +tries=1 +time=2 2>/dev/null`, 5000);
        hotMs = Date.now() - hotStart;

        if (hotMs < coldMs && coldMs > 0) {
          hitRate = 'Active';
        } else if (coldMs > 0) {
          hitRate = 'Active';
        } else {
          hitRate = 'No data';
        }
      } catch {
        hitRate = 'Test failed';
      }

      try {
        const configContent = fs.readFileSync(DNSMASQ_CONFIG, 'utf-8');
        const match = configContent.match(/cache-size=(\d+)/);
        cacheSize = match ? parseInt(match[1]) : 150;
      } catch { cacheSize = 150; }
    }

    return c.json({
      success: true,
      data: {
        capacity: cacheSize,
        status: running ? hitRate : 'dnsmasq not running',
        serviceRunning: running,
        coldQueryMs: coldMs,
        hotQueryMs: hotMs,
        upstreamQueries,
        upstreamRetried,
        upstreamFailed,
        nxdomainReplies,
        avgLatencyMs,
        forwarders,
        poolMemoryUsed,
        poolMemoryMax,
        cacheEntriesAvailable,
      }
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/cache/flush', async (c) => {
  try {
    if (!isDnsmasqRunning()) {
      return c.json({ success: false, message: 'dnsmasq is not running' });
    }
    await syncConfigToDisk();
    const stopResult = stopDnsmasq();
    if (!stopResult.success) {
      return c.json({ success: false, message: `Failed to stop dnsmasq: ${stopResult.message}` });
    }
    const startResult = startDnsmasq();
    if (!startResult.success) {
      return c.json({ success: false, message: `Failed to restart dnsmasq: ${startResult.message}` });
    }
    return c.json({ success: true, message: 'DNS cache flushed (dnsmasq restarted)', running: true });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// DNS Forwarders (Service-managed: "DnsForwarder")
// ============================================================================

app.get('/api/forwarders', async (c) => {
  try {
    const result = await pool.query('SELECT * FROM "DnsForwarder" ORDER BY address ASC');
    return c.json({ success: true, data: result.rows });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/forwarders', async (c) => {
  try {
    const body = await c.req.json();
    const id = generateId();
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO "DnsForwarder" (id, "tenantId", "propertyId", address, port, description, enabled, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         "tenantId" = EXCLUDED."tenantId",
         "propertyId" = EXCLUDED."propertyId",
         address = EXCLUDED.address,
         port = EXCLUDED.port,
         description = EXCLUDED.description,
         enabled = EXCLUDED.enabled,
         "updatedAt" = EXCLUDED."updatedAt"`,
      [
        id, body.tenantId || 'default', body.propertyId || 'default',
        body.address, body.port || 53, body.description || null,
        body.enabled !== false, now, now
      ]
    );

    await fullSync();
    const fwResult = await pool.query('SELECT * FROM "DnsForwarder" WHERE id = $1', [id]);
    return c.json({ success: true, data: fwResult.rows[0], message: 'DNS forwarder added' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.delete('/api/forwarders/:id', async (c) => {
  try {
    const { id } = c.req.param();
    await pool.query('DELETE FROM "DnsForwarder" WHERE id = $1', [id]);
    await fullSync();
    return c.json({ success: true, message: 'DNS forwarder removed' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// DHCP-DNS Integration
// ============================================================================

app.get('/api/dhcp-dns', (c) => {
  try {
    const leaseFile = SYSTEM_DNSMASQ ? '/var/lib/dnsmasq/dnsmasq.leases' : '/tmp/dnsmasq-dhcp.leases';
    const entries: any[] = [];
    try {
      const content = fs.readFileSync(leaseFile, 'utf-8');
      for (const line of content.trim().split('\n').filter(Boolean)) {
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          entries.push({
            timestamp: parts[0],
            macAddress: parts[1],
            ipAddress: parts[2],
            hostname: parts[3] || '',
            clientId: parts[4] || '',
          });
        }
      }
    } catch {}
    return c.json({ success: true, data: entries });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Sync Endpoint (simplified - no dual-DB sync needed)
// ============================================================================

/**
 * POST /api/sync - Regenerate config from DB and reload dnsmasq.
 * No Prisma sync needed since we're using the same database.
 */
app.post('/api/sync', async (c) => {
  const result = await fullSync();
  return c.json({
    success: result.config.success && (result.reload.success || !isDnsmasqRunning()),
    message: `Config synced (${result.config.lines} lines), ${result.reload.message}`,
    config: result.config,
    reload: result.reload,
  });
});

// ============================================================================
// Config Preview & Edit (with injection protection)
// ============================================================================

app.get('/api/config', (c) => {
  try {
    const content = fs.readFileSync(DNSMASQ_CONFIG, 'utf-8');
    return c.json({ success: true, data: { path: DNSMASQ_CONFIG, content } });
  } catch (error) {
    return c.json({ success: false, error: 'Config file not found' });
  }
});

function validateDnsmasqConfig(content: string): { valid: boolean; reason?: string } {
  if (!content || typeof content !== 'string') {
    return { valid: false, reason: 'No content provided' };
  }

  const lines = content.split('\n');
  const validDirectives = [
    'server=', 'address=', 'cname=', 'mx-host=', 'txt-record=',
    'srv-host=', 'ptr-record=', 'domain-needed', 'bogus-priv',
    'no-resolv', 'expand-hosts', 'local-ttl=', 'cache-size=',
    'dns-forward-max=', 'min-port=', 'listen-address=', 'port=',
    'bind-interfaces', 'no-hosts', 'addn-hosts=', 'resolv-file=',
    'strict-order', 'all-servers', 'no-negcache', 'neg-ttl=',
    'conf-dir=', 'user=', 'group=', 'pid-file=', 'log-queries',
    'log-facility=', 'no-daemon', 'keep-in-foreground',
    'dhcp-range=', 'dhcp-host=', 'dhcp-option=', 'dhcp-leasefile=',
    'dhcp-authoritative', 'dhcp-script=', 'read-ethers',
  ];

  const injectionPatterns = [
    /[;|&`$]/,
    /\$\(/,
    /\$\{/,
    /\b(rm|chmod|chown|mv|cp|cat|sh|bash|curl|wget|nc|ncat|python|perl|ruby|node|exec|eval|system|spawn)\b/i,
    /\b(sudo|su|passwd|shadow|crontab|iptables|nft|systemctl)\b/i,
    /\/\.\.\//,
    /\b(import|require)\b/,
    /`/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    for (const pattern of injectionPatterns) {
      if (pattern.test(line)) {
        return { valid: false, reason: `Line ${i + 1}: Content contains disallowed pattern (${pattern.source}).` };
      }
    }

    const startsWithValidDirective = validDirectives.some(d => line.startsWith(d));
    if (!startsWithValidDirective) {
      return { valid: false, reason: `Line ${i + 1}: "${line.substring(0, 40)}${line.length > 40 ? '...' : ''}" does not start with a recognized dnsmasq directive` };
    }
  }

  return { valid: true };
}

app.post('/api/config', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.content) {
      return c.json({ success: false, error: 'No content provided' });
    }

    const validation = validateDnsmasqConfig(body.content);
    if (!validation.valid) {
      return c.json({
        success: false,
        error: `Config validation failed: ${validation.reason}`,
        warning: 'Direct config editing is intended for experienced administrators only. Use the zones/records/redirects/forwarders APIs for safe configuration.',
      });
    }

    fs.writeFileSync(DNSMASQ_CONFIG, body.content, 'utf-8');
    if (isDnsmasqRunning()) reloadDnsmasq();
    await logActivity('config_manual_edit', 'dnsmasq config manually edited via API', 'warning');
    return c.json({
      success: true,
      message: 'Config saved and dnsmasq reloaded',
      warning: 'Direct config edits will be overwritten by auto-generated config on next sync operation.',
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Activity Log (Service-managed: "DnsActivityLog")
// ============================================================================

app.get('/api/activity', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const result = await pool.query('SELECT * FROM "DnsActivityLog" ORDER BY timestamp DESC LIMIT $1', [limit]);
    const logs = result.rows;

    const running = isDnsmasqRunning();
    const dynamicEntries = [
      {
        id: 'dynamic-status',
        action: 'status_check',
        details: `dnsmasq is currently ${running ? 'running' : 'stopped'}`,
        severity: running ? 'info' : 'error',
        timestamp: new Date().toISOString(),
      },
    ];

    return c.json({ success: true, data: [...dynamicEntries, ...logs] });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

async function logActivity(action: string, details: string, severity = 'info') {
  try {
    await pool.query(
      'INSERT INTO "DnsActivityLog" (id, action, details, severity) VALUES ($1, $2, $3, $4)',
      [generateId(), action, details, severity]
    );
  } catch {}
}

// ============================================================================
// Detailed Stats
// ============================================================================

app.get('/api/stats', async (c) => {
  try {
    const running = isDnsmasqRunning();

    let zoneCount = 0, recordCount = 0, redirectCount = 0, forwarderCount = 0;
    let totalZones = 0, totalRecords = 0, totalRedirects = 0;
    try { zoneCount = parseInt((await pool.query('SELECT COUNT(*) as c FROM "DnsZone" WHERE enabled = true')).rows[0]?.c) || 0; } catch {}
    try { recordCount = parseInt((await pool.query('SELECT COUNT(*) as c FROM "DnsRecord" WHERE enabled = true')).rows[0]?.c) || 0; } catch {}
    try { redirectCount = parseInt((await pool.query('SELECT COUNT(*) as c FROM "DnsRedirectRule" WHERE enabled = true')).rows[0]?.c) || 0; } catch {}
    try { forwarderCount = parseInt((await pool.query('SELECT COUNT(*) as c FROM "DnsForwarder" WHERE enabled = true')).rows[0]?.c) || 0; } catch {}
    try { totalZones = parseInt((await pool.query('SELECT COUNT(*) as c FROM "DnsZone"')).rows[0]?.c) || 0; } catch {}
    try { totalRecords = parseInt((await pool.query('SELECT COUNT(*) as c FROM "DnsRecord"')).rows[0]?.c) || 0; } catch {}
    try { totalRedirects = parseInt((await pool.query('SELECT COUNT(*) as c FROM "DnsRedirectRule"')).rows[0]?.c) || 0; } catch {}

    const recordTypes: Record<string, number> = {};
    try {
      const typeCounts = (await pool.query('SELECT type, COUNT(*) as c FROM "DnsRecord" GROUP BY type')).rows;
      for (const tc of typeCounts) {
        recordTypes[tc.type] = parseInt(tc.c);
      }
    } catch {}

    const topDomains: { domain: string; hits: number }[] = [];
    try {
      const domains = (await pool.query('SELECT "matchPattern", priority FROM "DnsRedirectRule" WHERE enabled = true ORDER BY priority ASC LIMIT 10')).rows;
      for (const d of domains) {
        const { domain } = redirectRuleToApi(d);
        topDomains.push({ domain, hits: 0 });
      }
    } catch {}

    let cacheSize = 0;
    try {
      const configContent = fs.readFileSync(DNSMASQ_CONFIG, 'utf-8');
      const match = configContent.match(/cache-size=(\d+)/);
      cacheSize = match ? parseInt(match[1]) : 150;
    } catch {}

    return c.json({
      success: true,
      data: {
        running,
        zones: { active: zoneCount, total: totalZones },
        records: { active: recordCount, total: totalRecords },
        redirects: { active: redirectCount, total: totalRedirects },
        forwarders: { active: forwarderCount },
        recordTypes,
        topDomains,
        cache: { size: cacheSize, maxSize: 10000, utilization: Math.round((cacheSize / 10000) * 100) },
        lastUpdated: new Date().toISOString(),
      }
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Bulk Delete - Zones
// ============================================================================

app.post('/api/zones/bulk-delete', async (c) => {
  try {
    const body = await c.req.json();
    const ids: string[] = body.ids || [];
    if (ids.length === 0) {
      return c.json({ success: false, error: 'No zone IDs provided' });
    }

    let deleted = 0;
    for (const id of ids) {
      try {
        await pool.query('DELETE FROM "DnsRecord" WHERE "zoneId" = $1', [id]);
        await pool.query('DELETE FROM "DnsZone" WHERE id = $1', [id]);
        deleted++;
      } catch {}
    }

    await fullSync();
    await logActivity('zones_bulk_delete', `Deleted ${deleted} zones`, 'warning');
    return c.json({ success: true, message: `Deleted ${deleted} zones`, deleted });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Bulk Delete - Records
// ============================================================================

app.post('/api/records/bulk-delete', async (c) => {
  try {
    const body = await c.req.json();
    const ids: string[] = body.ids || [];
    if (ids.length === 0) {
      return c.json({ success: false, error: 'No record IDs provided' });
    }

    let deleted = 0;
    for (const id of ids) {
      try {
        await pool.query('DELETE FROM "DnsRecord" WHERE id = $1', [id]);
        deleted++;
      } catch {}
    }

    await fullSync();
    await logActivity('records_bulk_delete', `Deleted ${deleted} records`, 'warning');
    return c.json({ success: true, message: `Deleted ${deleted} records`, deleted });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Start Server
// ============================================================================

log.info('DNS Service starting', {
  port: PORT,
  version: SERVICE_VERSION,
  dnsmasq: SYSTEM_DNSMASQ ? 'system-installed' : 'not-found',
  configPath: DNSMASQ_CONFIG,
  database: DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
});

Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  fetch: app.fetch,
});

log.info('DNS Service HTTP server listening', { port: PORT, hostname: '0.0.0.0' });

// Graceful shutdown
process.on('SIGTERM', async () => {
  log.info('SIGTERM received, shutting down');
  try { await pool.end(); } catch {}
  process.exit(0);
});

process.on('SIGINT', async () => {
  log.info('SIGINT received, shutting down');
  try { await pool.end(); } catch {}
  process.exit(0);
});
