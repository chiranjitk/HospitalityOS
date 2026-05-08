/**
 * nftables Firewall Management Service for StaySuite HospitalityOS
 *
 * Complete rewrite matching production architecture with 6 GUI-controlled chains:
 *
 * inet mangle table:
 *   - firewallchains       — mangle prerouting → filter outbound guest traffic
 *   - firewallchainsdn     — mangle postrouting → filter inbound guest traffic
 *   - firewallchains_conn  — mangle prerouting → connection-level marking
 *   - firewallchainsdn_conn — mangle postrouting → connection-level marking
 *
 * inet nat table:
 *   - frchainspre  — nat prerouting → DNAT / Port Forward rules
 *   - frchainspost — nat postrouting → SNAT / Masquerade rules
 *
 * Port: 3013
 * Mode: Simulation/Demo (persists rules in PostgreSQL, generates nftables config)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { execSync, execFileSync } from 'child_process';
import { createLogger } from '../shared/logger';
import pg from 'pg';

// ============================================================================
// Constants & Setup
// ============================================================================

const app = new Hono();
const PORT = parseInt(process.env.PORT || '3013', 10);
const SERVICE_VERSION = '2.2.0';
const log = createLogger('nftables-service');
const startTime = Date.now();

// Database — use NFTABLES_DB_URL > DATABASE_URL > fallback PostgreSQL URL.
// In production, DATABASE_URL is injected by PM2 ecosystem.config.js.
const DB_URL = process.env.NFTABLES_DB_URL || process.env.DATABASE_URL || 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite';
const pool = new pg.Pool({
  connectionString: DB_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Reconnect on pool-level errors (e.g. PostgreSQL restart)
pool.on('error', (err: Error) => {
  log.warn('PostgreSQL pool error (auto-recovering)', { error: err.message });
});

// Nettype constants
const NETTYPE = {
  LAN: 0, WAN: 1, VLAN: 2, BRIDGE: 3, BOND: 4,
  MANAGEMENT: 5, GUEST: 6, IOT: 7, UNUSED: 8, DMZ: 9, WIFI: 10,
} as const;

// GUI chain names
const GUI_CHAINS = [
  'firewallchains',
  'firewallchainsdn',
  'firewallchains_conn',
  'firewallchainsdn_conn',
  'frchainspre',
  'frchainspost',
] as const;

type GuiChainName = (typeof GUI_CHAINS)[number];

const GUI_CHAIN_DESCRIPTIONS: Record<GuiChainName, { table: string; hook: string; description: string }> = {
  firewallchains: { table: 'inet mangle', hook: 'prerouting', description: 'GUI uplink filter (mangle prerouting)' },
  firewallchainsdn: { table: 'inet mangle', hook: 'postrouting', description: 'GUI downlink filter (mangle postrouting)' },
  firewallchains_conn: { table: 'inet mangle', hook: 'prerouting', description: 'GUI connection marking prerouting' },
  firewallchainsdn_conn: { table: 'inet mangle', hook: 'postrouting', description: 'GUI connection marking postrouting' },
  frchainspre: { table: 'inet nat', hook: 'prerouting', description: 'GUI NAT prerouting (DNAT)' },
  frchainspost: { table: 'inet nat', hook: 'postrouting', description: 'GUI NAT postrouting (SNAT/MASQ)' },
};

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface GuiRule {
  id: string;
  name: string;
  chain: GuiChainName;
  protocol: string;
  sourceIp?: string;
  destIp?: string;
  destPort?: string;
  sourcePort?: string;
  action: 'accept' | 'drop' | 'reject' | 'log' | 'mark' | 'proxy' | 'dnat' | 'snat' | 'masquerade';
  markValue?: number;
  dnatTo?: string;
  snatTo?: string;
  enabled: boolean;
  comment?: string;
  priority: number;
  handle?: number;
  createdAt: string;
  updatedAt: string;
}

interface PortForward {
  id: string;
  name: string;
  protocol: 'tcp' | 'udp' | 'both';
  externalPort: number;
  internalIp: string;
  internalPort: number;
  sourceIp?: string;
  enabled: boolean;
  comment?: string;
  handle?: number;
  createdAt: string;
}

interface RateLimit {
  id: string;
  name: string;
  targetIp?: string;
  targetSet?: string;
  downloadRate: string;
  uploadRate: string;
  protocol?: string;
  enabled: boolean;
  comment?: string;
  downloadHandle?: number;
  uploadHandle?: number;
  createdAt: string;
}

interface QuickBlock {
  id: string;
  type: 'ip' | 'subnet' | 'mac';
  value: string;
  reason: string;
  handle?: number;
  blockedAt: string;
}

interface Schedule {
  id: string;
  name: string;
  days: string;
  startTime: string;
  endTime: string;
  timezone: string;
  linkedRuleIds: string[];
  enabled: boolean;
  createdAt: string;
}

interface Preset {
  id: string;
  name: string;
  description: string;
  category: string;
  rules: Omit<GuiRule, 'id' | 'createdAt' | 'updatedAt' | 'handle'>[];
}

// ============================================================================
// Database Helpers
// ============================================================================

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

async function readGuiRules(): Promise<GuiRule[]> {
  const res = await pool.query(
    `SELECT id, name, "chain", protocol, "sourceIp", "sourceMac", "destIp", "destPort", "sourcePort",
            "sourcePortType", "destPortType",
            action, enabled, comment, priority,
            "proxyTo", "jumpTarget", "logPrefix",
            "createdAt"::text, "updatedAt"::text,
            "destIpResolved", "sourceIpResolved", "destIpType", "sourceIpType"
     FROM "FirewallRule" WHERE enabled = true ORDER BY priority ASC`
  );
  return res.rows.map(rowToGuiRule);
}

function rowToGuiRule(row: Record<string, unknown>): GuiRule & { _resolvedDestIps?: string[]; _resolvedSourceIps?: string[] } {
  // For domain-type destIp, use resolved IPs for nftables rules
  // nftables cannot handle domain names — only raw IPs
  let destIp = row.destIp as string | undefined;
  let sourceIp = row.sourceIp as string | undefined;
  const destIpType = row.destIpType as string | undefined;
  const sourceIpType = row.sourceIpType as string | undefined;
  const destIpResolved = row.destIpResolved as string | undefined;
  const sourceIpResolved = row.sourceIpResolved as string | undefined;

  // If dest is a domain, store resolved IPs for rule generation
  // (The buildNftRuleLine function will expand these)
  let _resolvedDestIps: string[] | undefined;
  let _resolvedSourceIps: string[] | undefined;

  if (destIpType === 'domain' && destIpResolved) {
    try {
      const ips = JSON.parse(destIpResolved);
      if (Array.isArray(ips) && ips.length > 0) {
        _resolvedDestIps = ips;
      }
    } catch {}
  }
  if (sourceIpType === 'domain' && sourceIpResolved) {
    try {
      const ips = JSON.parse(sourceIpResolved);
      if (Array.isArray(ips) && ips.length > 0) {
        _resolvedSourceIps = ips;
      }
    } catch {}
  }

  return {
    id: row.id as string,
    name: row.name as string,
    chain: (row.chain as string || 'firewallchains') as GuiChainName,
    protocol: (row.protocol as string || 'all'),
    sourceIp: sourceIp || undefined,
    destIp: destIp || undefined,
    destPort: row.destPort as string | undefined,
    sourcePort: row.sourcePort as string | undefined,
    action: (row.action as string || 'accept') as GuiRule['action'],
    markValue: undefined,
    dnatTo: (row.proxyTo as string) || undefined,
    snatTo: undefined,
    enabled: row.enabled as boolean,
    comment: row.comment as string | undefined,
    priority: row.priority as number,
    handle: row.handle as number | undefined,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    _resolvedDestIps,
    _resolvedSourceIps,
    destIpType: destIpType || undefined,
    sourceIpType: sourceIpType || undefined,
  };
}

async function readPortForwards(): Promise<PortForward[]> {
  const res = await pool.query(
    `SELECT id, name, protocol, "externalPort", "internalIp", "internalPort",
            "sourceIp", enabled, description as comment, "createdAt"::text
     FROM "PortForwardRule" WHERE enabled = true ORDER BY "externalPort" ASC`
  );
  return res.rows.map(row => ({
    id: row.id,
    name: row.name,
    protocol: row.protocol === 'both' ? 'both' : row.protocol,
    externalPort: row.externalPort,
    internalIp: row.internalIp,
    internalPort: row.internalPort,
    sourceIp: row.sourceIp,
    enabled: row.enabled,
    comment: row.comment,
    handle: row.handle,
    createdAt: row.createdAt,
  }));
}

async function readRateLimits(): Promise<RateLimit[]> {
  const res = await pool.query(
    `SELECT id, name, "targetIp", "targetSet", "downloadRate", "uploadRate",
            protocol, enabled, comment, "createdAt"::text
     FROM "RateLimitRule" WHERE enabled = true ORDER BY name ASC`
  );
  return res.rows.map(row => ({
    id: row.id,
    name: row.name,
    targetIp: row.targetIp,
    targetSet: row.targetSet,
    downloadRate: row.downloadRate,
    uploadRate: row.uploadRate,
    protocol: row.protocol,
    enabled: row.enabled,
    comment: row.comment,
    downloadHandle: undefined,
    uploadHandle: undefined,
    createdAt: row.createdAt,
  }));
}

async function readQuickBlocks(): Promise<QuickBlock[]> {
  const res = await pool.query(
    `SELECT id, type, value, reason, "createdAt"::text as "blockedAt"
     FROM "QuickBlock" WHERE enabled = true ORDER BY "createdAt" DESC`
  );
  return res.rows.map(row => ({
    id: row.id,
    type: row.type,
    value: row.value,
    reason: row.reason,
    handle: row.handle,
    blockedAt: row.blockedAt,
  }));
}

async function readSchedules(): Promise<Schedule[]> {
  const res = await pool.query(
    `SELECT id, name, "daysOfWeek" as days, "startTime", "endTime", timezone, enabled, "createdAt"::text
     FROM "FirewallSchedule" WHERE enabled = true ORDER BY name ASC`
  );
  return res.rows.map(row => ({
    id: row.id,
    name: row.name,
    days: row.days || '1,2,3,4,5,6,7',
    startTime: row.startTime || '00:00',
    endTime: row.endTime || '23:59',
    timezone: row.timezone || 'UTC',
    linkedRuleIds: [],
    enabled: row.enabled,
    createdAt: row.createdAt,
  }));
}

// ============================================================================
// nftables System Helpers (simulation mode)
// ============================================================================

function isNftablesInstalled(): boolean {
  try {
    execSync('which nft 2>/dev/null', { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}

function getNftablesVersion(): string {
  try {
    const output = execSync('nft -v 2>&1', { encoding: 'utf-8', timeout: 5000 });
    const match = output.match(/nftables\s+v([\d.]+)/i);
    return match ? match[1] : output.split('\n')[0];
  } catch {
    return 'Not installed (simulation mode)';
  }
}

function listTables(): string[] {
  try {
    const output = execSync('nft list tables 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
    return output.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  } catch {
    return [];
  }
}

// ============================================================================
// Built-in Presets
// ============================================================================

const BUILTIN_PRESETS: Preset[] = [
  {
    id: 'block-social-media',
    name: 'Block Social Media',
    description: 'Drop TCP 443 traffic to common social media platform IP ranges',
    category: 'content-filter',
    rules: [
      { name: 'Block Facebook', chain: 'firewallchains', protocol: 'tcp', destPort: '443', destIp: '31.13.24.0/21', action: 'drop', enabled: true, comment: 'Facebook main range', priority: 100 },
      { name: 'Block Instagram', chain: 'firewallchains', protocol: 'tcp', destPort: '443', destIp: '31.13.24.0/21', action: 'drop', enabled: true, comment: 'Instagram shares Facebook infra', priority: 101 },
      { name: 'Block Twitter/X', chain: 'firewallchains', protocol: 'tcp', destPort: '443', destIp: '104.244.42.0/21', action: 'drop', enabled: true, comment: 'Twitter/X range', priority: 102 },
      { name: 'Block TikTok', chain: 'firewallchains', protocol: 'tcp', destPort: '443', destIp: '162.125.80.0/20', action: 'drop', enabled: true, comment: 'TikTok CDN range', priority: 103 },
      { name: 'Block TikTok 2', chain: 'firewallchains', protocol: 'tcp', destPort: '443', destIp: '23.236.48.0/20', action: 'drop', enabled: true, comment: 'TikTok secondary range', priority: 104 },
    ],
  },
  {
    id: 'allow-hotel-management',
    name: 'Allow Hotel Management',
    description: 'Allow TCP to PMS (5432), RADIUS (1812-1813), DNS (53), NTP (123)',
    category: 'hotel-ops',
    rules: [
      { name: 'Allow PMS Access', chain: 'firewallchains', protocol: 'tcp', destPort: '5432', action: 'accept', enabled: true, comment: 'Property Management System', priority: 10 },
      { name: 'Allow RADIUS Auth', chain: 'firewallchains', protocol: 'udp', destPort: '1812', action: 'accept', enabled: true, comment: 'RADIUS authentication', priority: 11 },
      { name: 'Allow RADIUS Acct', chain: 'firewallchains', protocol: 'udp', destPort: '1813', action: 'accept', enabled: true, comment: 'RADIUS accounting', priority: 12 },
      { name: 'Allow DNS', chain: 'firewallchains', protocol: 'udp', destPort: '53', action: 'accept', enabled: true, comment: 'DNS resolution', priority: 13 },
      { name: 'Allow DNS TCP', chain: 'firewallchains', protocol: 'tcp', destPort: '53', action: 'accept', enabled: true, comment: 'DNS resolution (TCP fallback)', priority: 14 },
      { name: 'Allow NTP', chain: 'firewallchains', protocol: 'udp', destPort: '123', action: 'accept', enabled: true, comment: 'Network Time Protocol', priority: 15 },
    ],
  },
  {
    id: 'guest-isolation',
    name: 'Guest Isolation',
    description: 'Drop forwarding between guests, allow only to gateway',
    category: 'security',
    rules: [
      { name: 'Isolate Guest Subnet', chain: 'firewallchains', protocol: 'all', action: 'drop', enabled: true, comment: 'Block guest-to-guest communication', priority: 200 },
      { name: 'Allow Gateway Access', chain: 'firewallchains', protocol: 'all', destIp: '10.0.0.1', action: 'accept', enabled: true, comment: 'Allow access to gateway', priority: 199 },
      { name: 'Allow DHCP', chain: 'firewallchains', protocol: 'udp', destPort: '67', action: 'accept', enabled: true, comment: 'DHCP client requests', priority: 198 },
    ],
  },
  {
    id: 'iot-lockdown',
    name: 'IoT Lockdown',
    description: 'Allow IoT devices only to their management server, block internet',
    category: 'security',
    rules: [
      { name: 'IoT Allow Management', chain: 'firewallchains', protocol: 'tcp', destIp: '10.0.1.100', destPort: '443', action: 'accept', enabled: true, comment: 'IoT management server', priority: 10 },
      { name: 'IoT Allow MQTT', chain: 'firewallchains', protocol: 'tcp', destIp: '10.0.1.100', destPort: '1883', action: 'accept', enabled: true, comment: 'MQTT broker for IoT', priority: 11 },
      { name: 'IoT Allow DNS', chain: 'firewallchains', protocol: 'udp', destPort: '53', action: 'accept', enabled: true, comment: 'IoT DNS resolution', priority: 12 },
      { name: 'IoT Block Internet', chain: 'firewallchains', protocol: 'all', action: 'drop', enabled: true, comment: 'Block all other IoT traffic', priority: 200 },
    ],
  },
  {
    id: 'remote-access',
    name: 'Remote Access',
    description: 'DNAT port 3389 (RDP), 22 (SSH), 443 (HTTPS) to internal management IP',
    category: 'networking',
    rules: [
      { name: 'RDP Forward', chain: 'frchainspre', protocol: 'tcp', destPort: '3389', action: 'dnat', dnatTo: '10.0.1.100:3389', enabled: true, comment: 'Remote Desktop Protocol', priority: 10 },
      { name: 'SSH Forward', chain: 'frchainspre', protocol: 'tcp', destPort: '22', action: 'dnat', dnatTo: '10.0.1.100:22', enabled: true, comment: 'Secure Shell', priority: 11 },
      { name: 'HTTPS Forward', chain: 'frchainspre', protocol: 'tcp', destPort: '443', action: 'dnat', dnatTo: '10.0.1.100:443', enabled: true, comment: 'HTTPS management', priority: 12 },
    ],
  },
  {
    id: 'content-filter-adult',
    name: 'Content Filter - Adult',
    description: 'Block known adult content ranges by sinking to 0.0.0.0',
    category: 'content-filter',
    rules: [
      { name: 'Block Adult Content Range 1', chain: 'firewallchains', protocol: 'tcp', destIp: '146.112.61.0/24', action: 'drop', enabled: true, comment: 'Adult content sinkhole', priority: 150 },
      { name: 'Block Adult Content Range 2', chain: 'firewallchains', protocol: 'tcp', destIp: '195.78.54.0/24', action: 'drop', enabled: true, comment: 'Adult content sinkhole', priority: 151 },
      { name: 'Block Adult Content Range 3', chain: 'firewallchains', protocol: 'tcp', destIp: '64.233.160.0/19', action: 'drop', enabled: true, comment: 'Known adult content CDN', priority: 152 },
    ],
  },
  {
    id: 'voip-priority',
    name: 'VoIP Priority',
    description: 'Mark SIP/RTP traffic with high priority marks for QoS',
    category: 'qos',
    rules: [
      { name: 'SIP Mark', chain: 'firewallchains', protocol: 'udp', destPort: '5060', action: 'mark', markValue: 100, enabled: true, comment: 'SIP signaling - high priority', priority: 10 },
      { name: 'SIP TCP Mark', chain: 'firewallchains', protocol: 'tcp', destPort: '5060', action: 'mark', markValue: 100, enabled: true, comment: 'SIP signaling over TCP', priority: 11 },
      { name: 'RTP Mark', chain: 'firewallchains', protocol: 'udp', destPort: '10000-20000', action: 'mark', markValue: 100, enabled: true, comment: 'RTP media stream range', priority: 12 },
      { name: 'SIP Downlink Mark', chain: 'firewallchainsdn', protocol: 'udp', sourcePort: '5060', action: 'mark', markValue: 100, enabled: true, comment: 'SIP signaling downlink', priority: 10 },
      { name: 'RTP Downlink Mark', chain: 'firewallchainsdn', protocol: 'udp', sourcePort: '10000-20000', action: 'mark', markValue: 100, enabled: true, comment: 'RTP media downlink', priority: 11 },
    ],
  },
];

// ============================================================================
// Config Preview Generation
// ============================================================================

async function generateConfigPreview(): Promise<string> {
  const guiRules = await readGuiRules();
  const portForwards = await readPortForwards();
  const quickBlocks = await readQuickBlocks();

  const pfRules: GuiRule[] = portForwards.map(pf => ({
    id: pf.id,
    name: pf.name,
    chain: 'frchainspre' as const,
    protocol: pf.protocol === 'both' ? 'all' : pf.protocol,
    destPort: String(pf.externalPort),
    sourceIp: pf.sourceIp,
    action: 'dnat' as const,
    dnatTo: `${pf.internalIp}:${pf.internalPort}`,
    enabled: pf.enabled,
    comment: pf.comment,
    priority: 500,
    handle: pf.handle,
    createdAt: pf.createdAt,
    updatedAt: pf.createdAt,
  }));

  const allRules = [...guiRules, ...pfRules];
  const sortedRules = allRules.filter(r => r.enabled).sort((a, b) => a.priority - b.priority);

  const blockedIps = quickBlocks.filter(b => b.type === 'ip').map(b => b.value);
  const blockedSubnets = quickBlocks.filter(b => b.type === 'subnet').map(b => b.value);
  const blockedMacs = quickBlocks.filter(b => b.type === 'mac').map(b => b.value);

  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push('# ══════════════════════════════════════════════════════════════');
  lines.push('# StaySuite HospitalityOS — Generated nftables Configuration');
  lines.push(`# Generated: ${now}`);
  lines.push('# Architecture: Multi-chain expansion (matches 24Online behavior)');
  lines.push('# Each GUI rule auto-expands to all applicable chains:');
  lines.push('#   Accept/Drop/Reject/Log → uplink (firewallchains) + downlink (firewallchainsdn)');
  lines.push('#   Proxy → uplink + downlink + NAT post (masquerade)');
  lines.push('#   DNAT → NAT prerouting (frchainspre)');
  lines.push('#   SNAT/Masquerade → NAT postrouting (frchainspost)');
  lines.push('# ══════════════════════════════════════════════════════════════');
  lines.push('');

  // Helper: render rules for a specific chain
  const renderChainRules = (chainName: GuiChainName, headerComment: string): void => {
    lines.push(`  chain ${chainName} {`);
    lines.push(`    # ${headerComment}`);
    lines.push('');

    // Quick blocks for uplink
    if (chainName === 'firewallchains' && (blockedIps.length > 0 || blockedSubnets.length > 0)) {
      if (blockedIps.length > 0) {
        lines.push('    # ── Quick Blocks: Blocked IPs (uplink) ──');
        for (const ip of blockedIps) {
          lines.push(`    ip daddr ${ip} counter drop comment "quick-block:ip"`);
        }
        lines.push('');
      }
      if (blockedSubnets.length > 0) {
        lines.push('    # ── Quick Blocks: Blocked Subnets (uplink) ──');
        for (const subnet of blockedSubnets) {
          lines.push(`    ip daddr ${subnet} counter drop comment "quick-block:subnet"`);
        }
        lines.push('');
      }
    }

    // Quick blocks for downlink
    if (chainName === 'firewallchainsdn' && (blockedIps.length > 0 || blockedSubnets.length > 0)) {
      if (blockedIps.length > 0) {
        lines.push('    # ── Quick Blocks: Blocked IPs (downlink) ──');
        for (const ip of blockedIps) {
          lines.push(`    ip saddr ${ip} counter drop comment "quick-block:ip"`);
        }
        lines.push('');
      }
      if (blockedSubnets.length > 0) {
        lines.push('    # ── Quick Blocks: Blocked Subnets (downlink) ──');
        for (const subnet of blockedSubnets) {
          lines.push(`    ip saddr ${subnet} counter drop comment "quick-block:subnet"`);
        }
        lines.push('');
      }
    }

    // GUI rules expanded to this chain
    let ruleIndex = 0;
    for (const rule of sortedRules) {
      const targetChains = getTargetChainsForAction(rule.action);
      if (!targetChains.includes(chainName)) continue;

      ruleIndex++;
      const resolved = (rule as Record<string, unknown>)._resolvedDestIps
        ? { resolvedDestIps: (rule as Record<string, unknown>)._resolvedDestIps as string[] }
        : undefined;
      const ruleLines = buildNftRuleLinesForChain(rule, chainName, resolved);

      lines.push(`    # ── [${ruleIndex}] ${rule.name} ──`);
      lines.push(`    # GUI Action: ${rule.action} | Auto-expanded to: ${targetChains.join(', ')}`);
      lines.push(`    # Source: ${rule.sourceIp || '(any)'} → Dest: ${rule.destIp || '(any)'} | Proto: ${rule.protocol}`);
      ruleLines.forEach(l => lines.push(`    ${l}`));
      lines.push('');
    }

    if (ruleIndex === 0 && !(chainName === 'firewallchains' || chainName === 'firewallchainsdn')) {
      lines.push('    # (no rules)');
    }
    lines.push('  }');
    lines.push('');
  };

  // --- inet mangle table ---
  lines.push('table inet mangle {');
  lines.push('');
  renderChainRules('firewallchains', 'Uplink Filter — mangle prerouting (guest → internet)');
  renderChainRules('firewallchainsdn', 'Downlink Filter — mangle postrouting (internet → guest)');
  renderChainRules('firewallchains_conn', 'Connection-Level Marking — mangle prerouting');
  renderChainRules('firewallchainsdn_conn', 'Connection-Level Marking — mangle postrouting');
  lines.push('}');

  // --- inet nat table ---
  lines.push('');
  lines.push('table inet nat {');
  lines.push('');
  renderChainRules('frchainspre', 'NAT Prerouting - DNAT / Port Forward');
  renderChainRules('frchainspost', 'NAT Postrouting - SNAT / Masquerade / Proxy NAT');
  lines.push('}');

  // --- Collect domain sets for preview ---
  const domainSets: { setName: string; domain: string; ips: string[] }[] = [];
  for (const rule of sortedRules) {
    const ruleData = rule as Record<string, unknown>;
    const destIpType = ruleData.destIpType as string | undefined;
    const sourceIpType = ruleData.sourceIpType as string | undefined;
    const destIps = ruleData._resolvedDestIps as string[] | undefined;
    const sourceIps = ruleData._resolvedSourceIps as string[] | undefined;

    if (destIpType === 'domain' && destIps && destIps.length > 0 && rule.destIp) {
      domainSets.push({ setName: domainSetName(rule.id, rule.destIp), domain: rule.destIp, ips: destIps });
    }
    if (sourceIpType === 'domain' && sourceIps && sourceIps.length > 0 && rule.sourceIp) {
      domainSets.push({ setName: domainSetName(rule.id, rule.sourceIp), domain: rule.sourceIp, ips: sourceIps });
    }
  }

  // --- inet filter table (sets) ---
  if (blockedIps.length > 0 || blockedSubnets.length > 0 || blockedMacs.length > 0 || domainSets.length > 0) {
    lines.push('');
    lines.push('table inet filter {');
    lines.push('');

    // Domain sets (24Online-style ipset via nftables named sets)
    if (domainSets.length > 0) {
      lines.push('  # ── Domain Sets (24Online-style ipset) ──');
      lines.push('  # O(1) hash lookup instead of per-IP rule expansion.');
      lines.push('  # DNS updates: add/remove set elements without chain flush.');
      lines.push('');
      for (const ds of domainSets) {
        lines.push(`  set ${ds.setName} {`);
        lines.push('    type ipv4_addr');
        lines.push(`    # Domain: ${ds.domain} (${ds.ips.length} resolved IPs)`);
        lines.push(`    elements = { ${ds.ips.join(', ')} }`);
        lines.push('  }');
        lines.push('');
      }
    }

    if (blockedIps.length > 0) {
      lines.push('  # ── Quick Block Sets ──');
      lines.push('  set blocked_ips {');
      lines.push('    type ipv4_addr');
      lines.push(`    elements = { ${blockedIps.join(', ')} }`);
      lines.push('  }');
      lines.push('');
    }

    if (blockedSubnets.length > 0) {
      lines.push('  set blocked_networks {');
      lines.push('    type ipv4_addr');
      lines.push('    flags interval');
      lines.push(`    elements = { ${blockedSubnets.join(', ')} }`);
      lines.push('  }');
      lines.push('');
    }

    if (blockedMacs.length > 0) {
      lines.push('  set blocked_mac {');
      lines.push('    type ether_addr');
      lines.push(`    elements = { ${blockedMacs.join(', ')} }`);
      lines.push('  }');
      lines.push('');
    }

    lines.push('}');
  }

  return lines.join('\n');
}

/**
 * Multi-chain expansion: which chains each action type should be placed in.
 * Matches 24Online behavior where a single GUI rule generates rules
 * across multiple iptables/nftables chains.
 *
 * Chain directions:
 *   - Uplink (prerouting): traffic FROM guest → internet → match on saddr (source)
 *   - Downlink (postrouting): traffic FROM internet → guest → match on daddr (dest)
 *   - NAT Pre: DNAT rules
 *   - NAT Post: SNAT/Masquerade rules
 */
function getTargetChainsForAction(action: GuiRule['action']): GuiChainName[] {
  switch (action) {
    case 'accept':
    case 'drop':
    case 'reject':
    case 'log':
      // Filter rules go to BOTH uplink + downlink (bidirectional)
      return ['firewallchains', 'firewallchainsdn'];
    case 'proxy':
      // Proxy = captive portal bypass mark in uplink + masquerade in NAT post
      return ['firewallchains', 'firewallchainsdn', 'frchainspost'];
    case 'mark':
      // Mark rules go to uplink + downlink for QoS
      return ['firewallchains', 'firewallchainsdn'];
    case 'dnat':
      // DNAT only in NAT prerouting
      return ['frchainspre'];
    case 'snat':
    case 'masquerade':
      // SNAT/Masquerade only in NAT postrouting
      return ['frchainspost'];
    default:
      return ['firewallchains'];
  }
}

/**
 * Check if a chain is a downlink (postrouting) chain.
 * In downlink chains, source/dest direction is FLIPPED:
 *   - Uplink: guest src → internet dst  (ip saddr GUEST_IP ... ip daddr DEST_IP)
 *   - Downlink: internet src → guest dst (ip daddr GUEST_IP ... ip saddr DEST_IP)
 */
function isDownlinkChain(chain: GuiChainName): boolean {
  return chain === 'firewallchainsdn' || chain === 'firewallchainsdn_conn';
}

/**
 * Build nftables rule lines for a single GUI rule targeting a specific chain.
 * For domain-type rules, uses a SET REFERENCE (e.g., @fwdomain_google_com_abc123)
 * instead of expanding to per-IP rules. This is 24Online-style ipset behavior.
 * For simple IP/CIDR rules, returns a single rule line.
 */
function buildNftRuleLinesForChain(
  rule: GuiRule,
  targetChain: GuiChainName,
  resolvedData?: { resolvedDestIps?: string[]; resolvedSourceIps?: string[] }
): string[] {
  const destIps = resolvedData?.resolvedDestIps;
  const sourceIps = resolvedData?.resolvedSourceIps;
  const hasDomainDest = destIps && destIps.length > 0;
  const hasDomainSource = sourceIps && sourceIps.length > 0;

  // Domain-type dest: use set reference instead of per-IP expansion
  if (hasDomainDest && rule.destIp) {
    const setName = domainSetName(rule.id, rule.destIp);
    return [buildSetBasedRuleLine(rule, targetChain, setName, 'dest')];
  }

  // Domain-type source: use set reference
  if (hasDomainSource && rule.sourceIp) {
    const setName = domainSetName(rule.id, rule.sourceIp);
    return [buildSetBasedRuleLine(rule, targetChain, setName, 'source')];
  }

  return [buildSingleNftRuleLineForChain(rule, targetChain)];
}

/**
 * Build a set-based rule line for domain rules.
 * Uses @setname syntax for O(1) hash lookup instead of per-IP expansion.
 * Example: tcp ip saddr 10.10.30.10 ip daddr @fwdomain_www_google_com_92144dd8 accept
 */
function buildSetBasedRuleLine(
  rule: GuiRule,
  targetChain: GuiChainName,
  setName: string,
  setDirection: 'source' | 'dest'
): string {
  const parts: string[] = [];
  const downlink = isDownlinkChain(targetChain);
  const isTcpUdp = rule.protocol === 'tcp' || rule.protocol === 'udp';
  const hasPorts = (rule.sourcePort || rule.destPort) && isTcpUdp;

  // Protocol
  if (rule.protocol && rule.protocol !== 'all' && !hasPorts) {
    parts.push(rule.protocol);
  }

  const srcIp = rule.sourceIp;
  const dstIp = rule.destIp;

  if (setDirection === 'dest') {
    // Domain is the destination
    if (srcIp) {
      parts.push(downlink ? `ip daddr ${srcIp}` : `ip saddr ${srcIp}`);
    }
    // Use set reference for dest
    parts.push(downlink ? `ip saddr @${setName}` : `ip daddr @${setName}`);
  } else {
    // Domain is the source
    if (dstIp) {
      parts.push(downlink ? `ip saddr ${dstIp}` : `ip daddr ${dstIp}`);
    }
    // Use set reference for source
    parts.push(downlink ? `ip daddr @${setName}` : `ip saddr @${setName}`);
  }

  if (rule.sourcePort && isTcpUdp) {
    parts.push(`${rule.protocol} sport ${rule.sourcePort}`);
  }
  if (rule.destPort && isTcpUdp) {
    parts.push(`${rule.protocol} dport ${rule.destPort}`);
  }

  // Insert counter before terminal action for per-rule hit statistics
  parts.push('counter');

  switch (rule.action) {
    case 'accept':
    case 'drop':
    case 'reject':
    case 'log':
      parts.push(rule.action);
      break;
    case 'proxy':
      parts.push('meta mark set 1');
      break;
    case 'mark':
      parts.push(`meta mark set ${rule.markValue || 0}`);
      break;
  }

  const comment = rule.comment
    ? ` comment "gui:${rule.id} ${rule.comment.replace(/"/g, '')}"`
    : ` comment "gui:${rule.id}"`;
  parts.push(comment);

  return parts.join(' ');
}

/**
 * Build a single nftables rule line for a GUI rule in a specific target chain.
 * This is the core function that maps GUI rule → nftables rule.
 *
 * Direction logic:
 *   - In uplink chains (prerouting): sourceIp → saddr, destIp → daddr (natural direction)
 *   - In downlink chains (postrouting): sourceIp → daddr, destIp → saddr (flipped)
 *   - In NAT chains: depends on action type (DNAT uses dport/dnat-to, MASQ uses saddr)
 */
function buildSingleNftRuleLineForChain(
  rule: GuiRule,
  targetChain: GuiChainName,
  overrideDestIp?: string,
  overrideSourceIp?: string
): string {
  const parts: string[] = [];
  const downlink = isDownlinkChain(targetChain);

  const isTcpUdp = rule.protocol === 'tcp' || rule.protocol === 'udp';
  const hasPorts = (rule.sourcePort || rule.destPort) && isTcpUdp;

  // Protocol
  if (rule.protocol && rule.protocol !== 'all' && !hasPorts) {
    parts.push(rule.protocol);
  }

  const srcIp = overrideSourceIp || rule.sourceIp;
  const dstIp = overrideDestIp || rule.destIp;

  // For NAT DNAT rules: just use destPort + dnat-to (source matching handled in mangle)
  if (rule.action === 'dnat' && targetChain === 'frchainspre') {
    if (srcIp) {
      parts.push(`ip saddr ${srcIp}`);
    }
    if (rule.destPort && isTcpUdp) {
      parts.push(`${rule.protocol} dport ${rule.destPort}`);
    }
    // Counter before terminal action
    parts.push('counter');
    if (rule.dnatTo) {
      parts.push(`dnat to ${rule.dnatTo}`);
    }
  }
  // For NAT MASQUERADE/SNAT rules: use sourceIp as saddr (who gets NAT'd)
  else if ((rule.action === 'masquerade' || rule.action === 'snat') && targetChain === 'frchainspost') {
    if (srcIp) {
      parts.push(`ip saddr ${srcIp}`);
    }
    if (rule.destPort && isTcpUdp) {
      parts.push(`${rule.protocol} dport ${rule.destPort}`);
    }
    // Counter before terminal action
    parts.push('counter');
    if (rule.action === 'masquerade') {
      parts.push('masquerade');
    } else if (rule.snatTo) {
      parts.push(`snat to ${rule.snatTo}`);
    }
  }
  // For Proxy in NAT post (masquerade the proxy traffic)
  else if (rule.action === 'proxy' && targetChain === 'frchainspost') {
    if (srcIp) {
      parts.push(`ip saddr ${srcIp}`);
    }
    // Counter before terminal action
    parts.push('counter');
    parts.push('masquerade');
  }
  // For mangle filter rules (accept/drop/reject/log/proxy/mark)
  else {
    // Direction: uplink = natural, downlink = flipped
    if (srcIp) {
      // Uplink: srcIp is source -> saddr. Downlink: srcIp is the guest -> daddr
      parts.push(downlink ? `ip daddr ${srcIp}` : `ip saddr ${srcIp}`);
    }
    if (dstIp) {
      // Uplink: dstIp is destination -> daddr. Downlink: dstIp -> saddr
      parts.push(downlink ? `ip saddr ${dstIp}` : `ip daddr ${dstIp}`);
    }

    if (rule.sourcePort && isTcpUdp) {
      parts.push(`${rule.protocol} sport ${rule.sourcePort}`);
    }
    if (rule.destPort && isTcpUdp) {
      parts.push(`${rule.protocol} dport ${rule.destPort}`);
    }

    // Counter before terminal action
    parts.push('counter');

    switch (rule.action) {
      case 'accept':
      case 'drop':
      case 'reject':
      case 'log':
        parts.push(rule.action);
        break;
      case 'proxy':
        parts.push(`meta mark set 1`);
        break;
      case 'mark':
        parts.push(`meta mark set ${rule.markValue || 0}`);
        break;
    }
  }

  const comment = rule.comment
    ? ` comment "gui:${rule.id} ${rule.comment.replace(/"/g, '')}"`
    : ` comment "gui:${rule.id}"`;
  parts.push(comment);

  return parts.join(' ');
}

// Backward-compat wrappers
function buildNftRuleLines(rule: GuiRule, resolvedData?: { resolvedDestIps?: string[]; resolvedSourceIps?: string[] }): string[] {
  return buildNftRuleLinesForChain(rule, rule.chain, resolvedData);
}

function buildNftRuleLine(rule: GuiRule): string {
  return buildNftRuleLinesForChain(rule, rule.chain)[0];
}

// ============================================================================
// Atomic nftables Apply — Only touches GUI chains, never system chains
// ============================================================================

interface NftResult {
  success: boolean;
  command: string;
  error?: string;
}

/**
 * Split a command string into arguments, respecting double-quoted segments.
 * e.g. `comment "gui:abc Remote Access"` → ['comment', '"gui:abc Remote Access"']
 * The quotes are preserved so nft can parse them in its own syntax.
 */
function splitNftArgs(cmd: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (ch === '"' && !inQuote) {
      inQuote = true;
      current += ch;
    } else if (ch === '"' && inQuote) {
      inQuote = false;
      current += ch;
    } else if (/\s/.test(ch) && !inQuote) {
      if (current) { args.push(current); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

function nftExec(command: string, timeout = 10000): NftResult {
  try {
    // Use execFileSync to bypass shell interpretation.
    // execSync would strip double-quotes around comments (e.g. comment "text")
    // causing nft syntax errors when comments contain colons or spaces.
    const args = splitNftArgs(command);
    execFileSync('nft', args, { encoding: 'utf-8', timeout });
    return { success: true, command };
  } catch (err: unknown) {
    const stderr = (err as Record<string, unknown>)?.stderr;
    const error = typeof stderr === 'string' && stderr ? stderr : (err instanceof Error ? err.message : String(err));
    log.error('nft command failed', { command, error });
    return { success: false, command, error };
  }
}

function chainExists(table: string, chain: string): boolean {
  const result = nftExec(`list chain ${table} ${chain}`);
  return result.success;
}

function ensureGuiChainsExist(): { created: string[]; existing: string[]; errors: NftResult[] } {
  const created: string[] = [];
  const existing: string[] = [];
  const errors: NftResult[] = [];

  // Collect unique tables that our chains belong to
  const tablesNeeded = new Set(GUI_CHAINS.map(c => GUI_CHAIN_DESCRIPTIONS[c].table));
  for (const table of tablesNeeded) {
    const tableResult = nftExec(`list table ${table}`);
    if (!tableResult.success) {
      // Table doesn't exist — create it first
      const addTableResult = nftExec(`add table ${table}`);
      if (!addTableResult.success) {
        log.warn(`Failed to create table ${table}`, { error: addTableResult.error });
      } else {
        log.info(`Created nftables table: ${table}`);
      }
    }
  }

  for (const chain of GUI_CHAINS) {
    const meta = GUI_CHAIN_DESCRIPTIONS[chain];
    if (chainExists(meta.table, chain)) {
      existing.push(chain);
      log.debug(`Chain exists: ${meta.table} ${chain}`);
    } else {
      // Use plain `add chain` — the { comment "..." } inline syntax
      // requires nftables >= 1.0.2 and fails on older versions.
      const addResult = nftExec(`add chain ${meta.table} ${chain}`);
      if (addResult.success) {
        // Add a no-op meta rule as the comment (compatible with all versions)
        nftExec(`add rule ${meta.table} ${chain} meta mark set 0x00000000 comment "StaySuite GUI Chain: ${meta.description}"`);
        created.push(chain);
        log.info(`Created GUI chain: ${meta.table} ${chain}`);
      } else {
        errors.push(addResult);
      }
    }
  }

  return { created, existing, errors };
}

function flushGuiChain(table: string, chain: string): NftResult {
  return nftExec(`flush chain ${table} ${chain}`);
}

function addRuleToChain(table: string, chain: string, ruleLine: string): NftResult {
  return nftExec(`add rule ${table} ${chain} ${ruleLine}`);
}

// ============================================================================
// Domain Set Management (24Online-style ipset via nftables named sets)
// ============================================================================
//
// Instead of expanding each domain's resolved IPs into separate rules,
// we create a single nftables named set per domain and reference it in rules.
// This gives us O(1) hash lookup instead of O(n) linear rule scanning,
// and allows non-destructive DNS updates (add/remove set elements without
// flushing the entire chain).
//
// Set naming: fwdomain_{rule_id} (shortened to 31 chars max for nftables compat)
// Table: inet filter (separate from mangle/nat to keep concerns clean)

const DOMAIN_SET_TABLE = 'inet filter';
const DOMAIN_SET_PREFIX = 'fwdomain_';

/** Sanitize a domain name for use in a set name. */
function sanitizeDomainForSet(domain: string): string {
  return domain.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').toLowerCase();
}

/** Generate a unique set name for a domain rule. Max 31 chars for nftables compat. */
function domainSetName(ruleId: string, domain: string): string {
  const shortId = ruleId.replace(/-/g, '').substring(0, 8);
  const safeDomain = sanitizeDomainForSet(domain);
  const name = `${DOMAIN_SET_PREFIX}${safeDomain}_${shortId}`;
  // nftables set name max = 31 chars
  return name.length > 31 ? name.substring(0, 31) : name;
}

/** Create a named set in the filter table. */
function createDomainSet(setName: string, elements: string[]): NftResult[] {
  const results: NftResult[] = [];

  // Ensure the filter table exists
  const tableResult = nftExec(`list table ${DOMAIN_SET_TABLE}`);
  if (!tableResult.success) {
    const addTable = nftExec(`add table ${DOMAIN_SET_TABLE}`);
    results.push(addTable);
    if (addTable.success) {
      log.info(`Created nftables table: ${DOMAIN_SET_TABLE}`);
    }
  }

  // Flush the set first (in case it exists with stale elements)
  const flushResult = nftExec(`flush set ${DOMAIN_SET_TABLE} ${setName}`);
  if (!flushResult.success) {
    // Set doesn't exist yet — create it
    const createResult = nftExec(`add set ${DOMAIN_SET_TABLE} ${setName} { type ipv4_addr \\; }`);
    results.push(createResult);
    if (!createResult.success) {
      log.error(`Failed to create domain set ${setName}`, { error: createResult.error });
      return results;
    }
    log.info(`Created domain set: ${DOMAIN_SET_TABLE} ${setName}`);
  } else {
    results.push(flushResult);
  }

  // Add all IP elements
  if (elements.length > 0) {
    const elems = elements.join(', ');
    const addResult = nftExec(`add element ${DOMAIN_SET_TABLE} ${setName} { ${elems} }`);
    results.push(addResult);
    if (addResult.success) {
      log.info(`Populated domain set ${setName} with ${elements.length} IPs`);
    } else {
      log.error(`Failed to populate domain set ${setName}`, { error: addResult.error });
    }
  }

  return results;
}

/** List all existing domain sets (prefixed with fwdomain_). */
function listDomainSets(): string[] {
  try {
    const output = execSync(`nft list sets 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 });
    return output.split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith(DOMAIN_SET_PREFIX));
  } catch {
    return [];
  }
}

/** Destroy a named set. */
function destroyDomainSet(setName: string): NftResult {
  const result = nftExec(`delete set ${DOMAIN_SET_TABLE} ${setName}`);
  if (result.success) {
    log.info(`Destroyed domain set: ${setName}`);
  }
  return result;
}

/** Get current elements in a set. */
function getSetElements(setName: string): string[] {
  try {
    const output = execSync(`nft list set ${DOMAIN_SET_TABLE} ${setName} 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 });
    // Parse: elements = { 1.2.3.4, 5.6.7.8 }
    const match = output.match(/elements\s*=\s*\{([^}]+)\}/);
    if (match) {
      return match[1].split(',').map(s => s.trim()).filter(Boolean);
    }
  } catch {}
  return [];
}

/**
 * Update a domain set's elements without flushing.
 * Compares current vs desired elements and does incremental add/remove.
 */
function updateDomainSetElements(setName: string, desiredIps: string[]): NftResult[] {
  const results: NftResult[] = [];
  const currentIps = new Set(getSetElements(setName));
  const desiredSet = new Set(desiredIps);

  // Remove IPs no longer needed
  for (const ip of currentIps) {
    if (!desiredSet.has(ip)) {
      const del = nftExec(`delete element ${DOMAIN_SET_TABLE} ${setName} { ${ip} }`);
      results.push(del);
      if (del.success) log.info(`Removed stale IP ${ip} from set ${setName}`);
    }
  }

  // Add new IPs
  for (const ip of desiredSet) {
    if (!currentIps.has(ip)) {
      const add = nftExec(`add element ${DOMAIN_SET_TABLE} ${setName} { ${ip} }`);
      results.push(add);
      if (add.success) log.info(`Added new IP ${ip} to set ${setName}`);
    }
  }

  return results;
}

async function applyGuiRulesToNftables(): Promise<{
  success: boolean;
  chainsCreated: string[];
  chainsExisting: string[];
  rulesApplied: Record<string, number>;
  rateLimitsApplied: number;
  commands: string[];
  errors: string[];
}> {
  const commands: string[] = [];
  const errors: string[] = [];
  const rulesApplied: Record<string, number> = {};

  const chainCheck = ensureGuiChainsExist();
  commands.push(...chainCheck.created.map(c => `nft add chain ${GUI_CHAIN_DESCRIPTIONS[c].table} ${c}`));
  errors.push(...chainCheck.errors.map(e => e.error || 'Unknown chain creation error'));

  const guiRules = await readGuiRules();
  const portForwards = await readPortForwards();
  const quickBlocks = await readQuickBlocks();

  const pfRules: GuiRule[] = portForwards.map(pf => ({
    id: pf.id,
    name: pf.name,
    chain: 'frchainspre' as const,
    protocol: pf.protocol === 'both' ? 'all' : pf.protocol,
    destPort: String(pf.externalPort),
    sourceIp: pf.sourceIp,
    action: 'dnat' as const,
    dnatTo: `${pf.internalIp}:${pf.internalPort}`,
    enabled: pf.enabled,
    comment: pf.comment,
    priority: 500,
    handle: pf.handle,
    createdAt: pf.createdAt,
    updatedAt: pf.createdAt,
  }));

  const allRules = [...guiRules, ...pfRules];
  const sortedRules = allRules.filter(r => r.enabled).sort((a, b) => a.priority - b.priority);

  const blockedIps = quickBlocks.filter(b => b.type === 'ip').map(b => b.value);
  const blockedSubnets = quickBlocks.filter(b => b.type === 'subnet').map(b => b.value);

  // ── Domain Set Management ──
  // 24Online-style: create/update nftables named sets for each domain rule.
  // Sets are populated with resolved IPs, and rules reference @setname for O(1) lookup.
  const activeSetNames = new Set<string>();

  for (const rule of sortedRules) {
    const ruleData = rule as Record<string, unknown>;
    const destIpType = ruleData.destIpType as string | undefined;
    const sourceIpType = ruleData.sourceIpType as string | undefined;
    const destIps = ruleData._resolvedDestIps as string[] | undefined;
    const sourceIps = ruleData._resolvedSourceIps as string[] | undefined;

    // Domain dest → create set
    if (destIpType === 'domain' && destIps && destIps.length > 0 && rule.destIp) {
      const setName = domainSetName(rule.id, rule.destIp);
      activeSetNames.add(setName);
      const setResults = createDomainSet(setName, destIps);
      for (const sr of setResults) {
        commands.push(sr.command);
        if (!sr.success) errors.push(sr.error || `set:${setName}`);
      }
    }

    // Domain source → create set
    if (sourceIpType === 'domain' && sourceIps && sourceIps.length > 0 && rule.sourceIp) {
      const setName = domainSetName(rule.id, rule.sourceIp);
      activeSetNames.add(setName);
      const setResults = createDomainSet(setName, sourceIps);
      for (const sr of setResults) {
        commands.push(sr.command);
        if (!sr.success) errors.push(sr.error || `set:${setName}`);
      }
    }
  }

  // Cleanup orphaned sets (sets that exist but no rule references them)
  const existingSets = listDomainSets();
  for (const setName of existingSets) {
    if (!activeSetNames.has(setName)) {
      const delResult = destroyDomainSet(setName);
      commands.push(delResult.command);
      if (!delResult.success) errors.push(delResult.error || `delete-set:${setName}`);
    }
  }

  // ── Multi-chain expansion ──
  // Instead of grouping rules by their DB chain field, we now auto-expand
  // each rule to ALL chains it belongs in, based on its action type.
  // This matches 24Online behavior: one GUI rule → multiple nftables chains.

  // ── Phase 1: Rate limit TC enforcement ──
  // Must be applied BEFORE GUI rules because:
  //   1. Rate limit mark rules are non-terminal (meta mark set + continue)
  //   2. They must be at the TOP of firewallchains/firewallchainsdn so
  //      the mark is set before any terminal action (drop/accept) fires
  //   3. For dropped packets: TC never sees them (correct behavior)
  //   4. For accepted packets: mark is already set → TC enforces the cap
  const rateLimitResult = await applyRateLimitTc(commands, errors);
  const activeRateLimits = rateLimitResult.rateLimits;

  // ── Phase 2: GUI rules + quick blocks (per chain) ──
  for (const chain of GUI_CHAINS) {
    const meta = GUI_CHAIN_DESCRIPTIONS[chain];
    const table = meta.table;
    let chainRuleCount = 0;

    const flushResult = flushGuiChain(table, chain);
    commands.push(`nft flush chain ${table} ${chain}`);
    if (!flushResult.success) {
      errors.push(`Failed to flush ${chain}: ${flushResult.error}`);
      continue;
    }

    // Add rate limit mark rules FIRST (before quick blocks and GUI rules)
    // meta mark set is non-terminal: packet continues to next rule
    // This ensures the TC fw filter can match the mark even if a later
    // accept/drop rule fires.
    if (chain === 'firewallchains' || chain === 'firewallchainsdn') {
      for (let ri = 0; ri < activeRateLimits.length; ri++) {
        const rl = activeRateLimits[ri];
        const rlMark = FW_RATELIMIT_MARK_BASE + (ri + 1);
        if (chain === 'firewallchains') {
          const ruleLine = `ip saddr ${rl.targetIp} meta mark set ${rlMark} comment "rate-limit:${rl.id} ${rl.name || rl.targetIp}"`;
          const result = addRuleToChain(table, chain, ruleLine);
          commands.push(`nft add rule ${table} ${chain} ${ruleLine}`);
          if (result.success) chainRuleCount++;
          else errors.push(`rate-limit-mark(up):${rl.targetIp}`);
        }
        if (chain === 'firewallchainsdn') {
          const ruleLine = `ip daddr ${rl.targetIp} meta mark set ${rlMark} comment "rate-limit:${rl.id} ${rl.name || rl.targetIp}"`;
          const result = addRuleToChain(table, chain, ruleLine);
          commands.push(`nft add rule ${table} ${chain} ${ruleLine}`);
          if (result.success) chainRuleCount++;
          else errors.push(`rate-limit-mark(dn):${rl.targetIp}`);
        }
      }
    }

    // Quick blocks in uplink: match destination IPs (traffic going TO blocked IPs)
    if (chain === 'firewallchains') {
      for (const ip of blockedIps) {
        const rl = `ip daddr ${ip} counter drop comment "quick-block:ip"`;
        const result = addRuleToChain(table, chain, rl);
        commands.push(`nft add rule ${table} ${chain} ${rl}`);
        if (result.success) chainRuleCount++;
        else errors.push(result.error || rl);
      }
      for (const subnet of blockedSubnets) {
        const rl = `ip daddr ${subnet} counter drop comment "quick-block:subnet"`;
        const result = addRuleToChain(table, chain, rl);
        commands.push(`nft add rule ${table} ${chain} ${rl}`);
        if (result.success) chainRuleCount++;
        else errors.push(result.error || rl);
      }
    }

    // Quick blocks in downlink: match source IPs (traffic FROM blocked IPs)
    if (chain === 'firewallchainsdn') {
      for (const ip of blockedIps) {
        const rl = `ip saddr ${ip} counter drop comment "quick-block:ip"`;
        const result = addRuleToChain(table, chain, rl);
        commands.push(`nft add rule ${table} ${chain} ${rl}`);
        if (result.success) chainRuleCount++;
        else errors.push(result.error || rl);
      }
      for (const subnet of blockedSubnets) {
        const rl = `ip saddr ${subnet} counter drop comment "quick-block:subnet"`;
        const result = addRuleToChain(table, chain, rl);
        commands.push(`nft add rule ${table} ${chain} ${rl}`);
        if (result.success) chainRuleCount++;
        else errors.push(result.error || rl);
      }
    }

    // Expand each GUI rule to this chain if it belongs here
    for (const rule of sortedRules) {
      const targetChains = getTargetChainsForAction(rule.action);
      if (!targetChains.includes(chain as GuiChainName)) continue;

      const resolved = (rule as Record<string, unknown>)._resolvedDestIps
        ? { resolvedDestIps: (rule as Record<string, unknown>)._resolvedDestIps as string[] }
        : undefined;
      const ruleLines = buildNftRuleLinesForChain(rule, chain as GuiChainName, resolved);
      for (const ruleLine of ruleLines) {
        const result = addRuleToChain(table, chain, ruleLine);
        commands.push(`nft add rule ${table} ${chain} ${ruleLine}`);
        if (result.success) {
          chainRuleCount++;
        } else {
          errors.push(`${rule.name}: ${result.error}`);
        }
      }
    }

    rulesApplied[chain] = chainRuleCount;
  }

  return {
    success: errors.length === 0,
    chainsCreated: chainCheck.created,
    chainsExisting: chainCheck.existing,
    rulesApplied,
    rateLimitsApplied: rateLimitResult.applied,
    commands,
    errors,
  };
}

// ============================================================================
// Rate Limit TC Enforcement — Bandwidth shaping for non-RADIUS users
// ============================================================================
//
// Architecture:
//   Non-RADIUS users' traffic reaches firewallchains (prerouting) and
//   firewallchainsdn (postrouting) because they are NOT in @usersset
//   and therefore don't get the CONNMARK early-accept fast-track.
//
//   For each enabled rate limit:
//     1. nft mark rule: set fw mark 0x2000000X in firewallchains/dn
//     2. TC HTB class on ifb0 (download) and ifb1 (upload)
//     3. TC fw filter: mark → class routing
//     4. SFQ leaf qdisc for per-flow fairness
//
//   Mark range:    0x20000001 – 0x20000064 (100 slots)
//   Class ID range: 1:25102 – 1:26001 (900 slots)
//
//   No CONNMARK needed — marks are set directly in both directions.
//   No conflict with RADIUS marks (0x1xxxxxxx) or system marks (10000, 20000).
// ============================================================================

const FW_RATELIMIT_MARK_BASE = 0x20000000; // Base mark for firewall rate limits
const FW_RATELIMIT_CLASS_BASE = 25102;    // First class ID (RADIUS ends at 25101)
const FW_RATELIMIT_MAX = 100;              // Max concurrent rate limits
const FW_RATELIMIT_TC_PREF = 25102;        // TC filter preference (lower = higher prio)

/**
 * Parse a rate string like "10mbit", "512kbit", "5mbit" into kbps.
 * Supports: kbit, mbit, gbit, kbps, mbps, gbps
 */
function parseRateToKbps(rateStr: string): number {
  const s = rateStr.toLowerCase().trim();
  let value: number;
  let multiplier: number;

  if (s.endsWith('gbps') || s.endsWith('gbit')) {
    value = parseFloat(s);
    multiplier = 1000000; // Gbps → kbps
  } else if (s.endsWith('mbps') || s.endsWith('mbit')) {
    value = parseFloat(s);
    multiplier = 1000; // Mbps → kbps
  } else if (s.endsWith('kbps') || s.endsWith('kbit')) {
    value = parseFloat(s);
    multiplier = 1; // kbps → kbps
  } else {
    // Fallback: assume mbps if unitless
    value = parseFloat(s) || 0;
    multiplier = 1000;
  }

  return Math.round(value * multiplier);
}

/**
 * Execute a `tc` command and return success/failure.
 * Non-fatal: logs errors but never throws.
 */
function tcExec(command: string, timeout = 5000): NftResult {
  try {
    execFileSync('tc', command.split(/\s+/), { encoding: 'utf-8', timeout });
    return { success: true, command };
  } catch (err: unknown) {
    const stderr = (err as Record<string, unknown>)?.stderr;
    const error = typeof stderr === 'string' && stderr ? stderr : (err instanceof Error ? err.message : String(err));
    log.error('tc command failed', { command, error });
    return { success: false, command, error };
  }
}

/**
 * Check if IFB device has the root HTB qdisc.
 */
function tcInfraExists(device: string): boolean {
  try {
    const output = execFileSync('tc', ['qdisc', 'show', 'dev', device], { encoding: 'utf-8', timeout: 3000 });
    return output.includes('htb') && output.includes('root');
  } catch {
    return false;
  }
}

/**
 * Remove ALL firewall rate limit TC state (classes, filters, qdiscs).
 * Called at the start of every apply to ensure clean state.
 */
function cleanupRateLimitTc(): { cleaned: string[]; errors: string[] } {
  const cleaned: string[] = [];
  const errors: string[] = [];

  for (const device of ['ifb0', 'ifb1']) {
    if (!tcInfraExists(device)) {
      log.warn(`TC rate limit cleanup skipped: ${device} has no HTB root qdisc`);
      continue;
    }

    // Remove filters in our preference range (25102-26001)
    try {
      const output = execFileSync('tc', ['filter', 'show', 'dev', device, 'parent', '1:'], { encoding: 'utf-8', timeout: 5000 });
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('fw') && line.includes('handle 0x20')) {
          const prefMatch = line.match(/pref (\d+)/);
          if (prefMatch) {
            const pref = parseInt(prefMatch[1]);
            if (pref >= FW_RATELIMIT_TC_PREF && pref < FW_RATELIMIT_TC_PREF + FW_RATELIMIT_MAX) {
              const delResult = tcExec(`filter del dev ${device} parent 1: pref ${pref} protocol ip`);
              if (delResult.success) cleaned.push(`filter:${device}:pref${pref}`);
              else errors.push(`filter-del:${device}:pref${pref}`);
            }
          }
        }
      }
    } catch {
      // No filters or tc error — skip
    }

    // Remove classes in our range (25102-26001)
    for (let classId = FW_RATELIMIT_CLASS_BASE; classId < FW_RATELIMIT_CLASS_BASE + FW_RATELIMIT_MAX; classId++) {
      const hexId = classId.toString(16);
      const delResult = tcExec(`class del dev ${device} parent 1:1 classid 1:${hexId} 2>/dev/null`);
      if (delResult.success) {
        cleaned.push(`class:${device}:1:${hexId}`);
      }
    }
  }

  if (cleaned.length > 0) {
    log.info(`Cleaned up rate limit TC state`, { cleaned, errorCount: errors.length });
  }

  return { cleaned, errors };
}

/**
 * Apply rate limit TC enforcement for non-RADIUS users.
 *
 * Creates HTB classes and fw filters on ifb0/ifb1.
 * Does NOT add nftables mark rules — those are added in the per-chain
 * apply loop (after flush) to ensure correct ordering.
 *
 * @returns Object with applied count, commands, and errors
 */
async function applyRateLimitTc(
  existingCommands: string[],
  existingErrors: string[]
): Promise<{ applied: number; rateLimits: RateLimit[]; commands: string[]; errors: string[] }> {
  const commands: string[] = [];
  const errors: string[] = [];
  let applied = 0;

  if (!isNftablesInstalled()) {
    log.info('Rate limit TC enforcement skipped: nftables not installed (simulation mode)');
    return { applied: 0, rateLimits: [], commands, errors };
  }

  // Read enabled rate limits from DB
  const rateLimits = await readRateLimits();
  const validLimits = rateLimits.filter(rl => rl.targetIp && rl.enabled);

  if (validLimits.length === 0) {
    log.debug('No enabled rate limits with targetIp found — skipping TC enforcement');
    // Still cleanup any leftover TC state
    const cleanup = cleanupRateLimitTc();
    existingCommands.push(...cleanup.cleaned.map(c => `tc cleanup: ${c}`));
    existingErrors.push(...cleanup.errors);
    return { applied: 0, rateLimits: [], commands, errors };
  }

  if (validLimits.length > FW_RATELIMIT_MAX) {
    log.warn(`Rate limit count (${validLimits.length}) exceeds max (${FW_RATELIMIT_MAX}) — applying first ${FW_RATELIMIT_MAX}`);
    validLimits.length = FW_RATELIMIT_MAX;
  }

  // Check TC infrastructure
  const ifb0Ok = tcInfraExists('ifb0');
  const ifb1Ok = tcInfraExists('ifb1');
  if (!ifb0Ok || !ifb1Ok) {
    const missing = [];
    if (!ifb0Ok) missing.push('ifb0');
    if (!ifb1Ok) missing.push('ifb1');
    const warn = `TC infrastructure missing on ${missing.join(', ')} — nftables marks will be set but bandwidth shaping will not work until initialization.sh runs`;
    log.warn(warn);
    errors.push(warn);
    return { applied: validLimits.length, rateLimits: validLimits, commands, errors };
  }

  // Cleanup old TC state before creating new
  const cleanup = cleanupRateLimitTc();
  existingCommands.push(...cleanup.cleaned.map(c => `tc cleanup: ${c}`));
  existingErrors.push(...cleanup.errors);

  for (let i = 0; i < validLimits.length; i++) {
    const rl = validLimits[i];
    const classId = FW_RATELIMIT_CLASS_BASE + i;          // 25102, 25103, ...
    const classIdHex = classId.toString(16);               // hex string for tc
    const tcPref = FW_RATELIMIT_TC_PREF + i;               // unique preference per filter

    // Parse rates
    const dnKbps = parseRateToKbps(rl.downloadRate || '5mbit');
    const upKbps = parseRateToKbps(rl.uploadRate || '2mbit');

    if (dnKbps <= 0 && upKbps <= 0) {
      errors.push(`${rl.name || rl.id}: invalid rates (dl=${rl.downloadRate}, ul=${rl.uploadRate})`);
      continue;
    }

    // Download class on ifb0
    if (dnKbps > 0) {
      const dlClass = tcExec(`class add dev ifb0 parent 1:1 classid 1:${classIdHex} htb rate ${dnKbps}kbit ceil ${dnKbps}kbit quantum 1500`);
      commands.push(`tc class add dev ifb0 1:${classIdHex} rate=${dnKbps}kbit`);
      if (!dlClass.success) errors.push(`tc-class(dl):1:${classIdHex} ${dlClass.error || ''}`);

      // fw filter: mark → class on ifb0
      const dlFilter = tcExec(`filter add dev ifb0 parent 1: protocol ip pref ${tcPref} handle ${FW_RATELIMIT_MARK_BASE + (i + 1)} fw classid 1:${classIdHex}`);
      commands.push(`tc filter add dev ifb0 handle ${FW_RATELIMIT_MARK_BASE + (i + 1)} fw → 1:${classIdHex}`);
      if (!dlFilter.success) errors.push(`tc-filter(dl):mark=${FW_RATELIMIT_MARK_BASE + (i + 1)} ${dlFilter.error || ''}`);

      // SFQ leaf qdisc
      tcExec(`qdisc add dev ifb0 parent 1:${classIdHex} handle ${classIdHex}: sfq perturb 10 2>/dev/null`);
    }

    // Upload class on ifb1
    if (upKbps > 0) {
      const ulClass = tcExec(`class add dev ifb1 parent 1:1 classid 1:${classIdHex} htb rate ${upKbps}kbit ceil ${upKbps}kbit quantum 1500`);
      commands.push(`tc class add dev ifb1 1:${classIdHex} rate=${upKbps}kbit`);
      if (!ulClass.success) errors.push(`tc-class(ul):1:${classIdHex} ${ulClass.error || ''}`);

      // fw filter: mark → class on ifb1
      const ulFilter = tcExec(`filter add dev ifb1 parent 1: protocol ip pref ${tcPref} handle ${FW_RATELIMIT_MARK_BASE + (i + 1)} fw classid 1:${classIdHex}`);
      commands.push(`tc filter add dev ifb1 handle ${FW_RATELIMIT_MARK_BASE + (i + 1)} fw → 1:${classIdHex}`);
      if (!ulFilter.success) errors.push(`tc-filter(ul):mark=${FW_RATELIMIT_MARK_BASE + (i + 1)} ${ulFilter.error || ''}`);

      // SFQ leaf qdisc
      tcExec(`qdisc add dev ifb1 parent 1:${classIdHex} handle ${classIdHex}: sfq perturb 10 2>/dev/null`);
    }

    applied++;
  }

  log.info(`Rate limit TC enforcement applied`, {
    total: validLimits.length,
    applied,
    errors: errors.length,
  });

  return { applied, rateLimits: validLimits, commands, errors };
}

function flushGuiChainsInNftables(): { flushed: string[]; errors: string[] } {
  const flushed: string[] = [];
  const errors: string[] = [];

  for (const chain of GUI_CHAINS) {
    const meta = GUI_CHAIN_DESCRIPTIONS[chain];
    const result = flushGuiChain(meta.table, chain);
    if (result.success) {
      flushed.push(chain);
      log.info(`Flushed GUI chain: ${meta.table} ${chain}`);
    } else {
      errors.push(`${chain}: ${result.error}`);
      log.warn(`Failed to flush ${chain}`, { error: result.error });
    }
  }

  return { flushed, errors };
}

interface AutoApplyResult {
  applied: boolean;
  mode: 'production' | 'simulation';
  rulesApplied?: Record<string, number>;
  liveRuleCounts?: Record<string, number>;
  errors?: string[];
}

async function autoApplyRules(): Promise<AutoApplyResult> {
  if (!isNftablesInstalled()) {
    return { applied: false, mode: 'simulation' };
  }

  const result = await applyGuiRulesToNftables();
  const liveCounts = getLiveChainRuleCounts();

  if (result.errors.length > 0) {
    log.warn('Auto-apply completed with errors', { errors: result.errors });
  } else {
    log.info('Auto-apply completed', { rulesApplied: result.rulesApplied });
  }

  return {
    applied: true,
    mode: 'production',
    rulesApplied: result.rulesApplied,
    liveRuleCounts: liveCounts,
    errors: result.errors.length > 0 ? result.errors : undefined,
  };
}

function getLiveChainRuleCounts(): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const chain of GUI_CHAINS) {
    const meta = GUI_CHAIN_DESCRIPTIONS[chain];
    try {
      const output = execSync(`nft list chain ${meta.table} ${chain} 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 });
      const ruleLines = output.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0
          && !trimmed.startsWith('table')
          && !trimmed.startsWith('chain')
          && !trimmed.startsWith('#')
          && !trimmed.startsWith('}')
          && !trimmed.includes('comment "StaySuite GUI Chain');
      });
      counts[chain] = ruleLines.length;
    } catch {
      counts[chain] = 0;
    }
  }

  return counts;
}

// ============================================================================
// Chain Architecture Data
// ============================================================================

function getChainArchitecture() {
  return {
    tables: {
      'inet mangle': {
        hooks: {
          prerouting: {
            priority: 'mangle',
            flow: [
              { type: 'set_jump', set: 'loggedinusers', description: 'Logged-in users mark' },
              { type: 'set_jump', set: 'llusersset', description: 'Low-latency users mark' },
              { type: 'gui_chain', chain: 'firewallchains', description: 'GUI uplink filter', managed: true },
              { type: 'system_chain', chain: 'accountingup', description: 'Upload accounting', managed: false },
            ],
          },
          postrouting: {
            priority: 'mangle',
            flow: [
              { type: 'set_jump', set: 'usersset', description: 'Per-user rules' },
              { type: 'gui_chain', chain: 'firewallchainsdn', description: 'GUI downlink filter', managed: true },
              { type: 'system_chain', chain: 'accountingdn', description: 'Download accounting', managed: false },
            ],
          },
        },
        guiChains: ['firewallchains', 'firewallchainsdn', 'firewallchains_conn', 'firewallchainsdn_conn'],
      },
      'inet nat': {
        hooks: {
          prerouting: {
            priority: 'dstnat',
            flow: [
              { type: 'gui_chain', chain: 'frchainspre', description: 'GUI NAT prerouting (DNAT)', managed: true },
            ],
          },
          postrouting: {
            priority: 'srcnat',
            flow: [
              { type: 'gui_chain', chain: 'frchainspost', description: 'GUI NAT postrouting (SNAT/MASQ)', managed: true },
            ],
          },
        },
        guiChains: ['frchainspre', 'frchainspost'],
      },
    },
    securityHooks: [
      { chain: 'syn_flood', table: 'inet security', priority: -300, description: 'SYN flood protection' },
      { chain: 'invalid_packets', table: 'inet security', priority: -299, description: 'Drop invalid packets (log-only)' },
      { chain: 'port_scan', table: 'inet security', priority: -160, description: 'Port scan detection' },
      { chain: 'ssh_protection', table: 'inet security', priority: -155, description: 'SSH brute-force protection' },
      { chain: 'dns_protection', table: 'inet security', priority: -150, description: 'DNS amplification protection' },
      { chain: 'icmp_limit', table: 'inet security', priority: -140, description: 'ICMP rate limiting' },
    ],
    sets: [
      { name: 'loggedinusers', type: 'ipv4_addr', description: 'Currently logged-in user IPs' },
      { name: 'usersset', type: 'ipv4_addr', description: 'Per-user destination IP set' },
      { name: 'usersdstset', type: 'ipv4_addr . ipv4_addr', description: 'User destination mapping' },
      { name: 'llusersset', type: 'ipv4_addr', description: 'Low-latency users' },
      { name: 'blocked_ips', type: 'ipv4_addr', description: 'Blocked IP addresses' },
      { name: 'blocked_networks', type: 'ipv4_addr', flags: 'interval', description: 'Blocked network ranges' },
      { name: 'blocked_mac', type: 'ether_addr', description: 'Blocked MAC addresses' },
    ],
    systemChains: {
      mangle: ['prerouting', 'postrouting', 'open', 'accounting', 'accountingup', 'accountingdn'],
      security: ['syn_flood', 'invalid_packets', 'port_scan', 'ssh_protection', 'dns_protection', 'icmp_limit'],
      filter: ['input', 'forward', 'drop_log'],
    },
  };
}

// ============================================================================
// Middleware
// ============================================================================

app.use('*', async (c, next) => {
  if (c.req.path === '/health') {
    return next();
  }

  const authSecret = process.env.SERVICE_AUTH_SECRET;

  if (!authSecret) {
    if (!globalThis.__nftAuthWarningLogged) {
      log.warn('SERVICE_AUTH_SECRET not configured. All requests will be allowed. Set SERVICE_AUTH_SECRET env var for production.');
      (globalThis as Record<string, unknown>).__nftAuthWarningLogged = true;
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

(globalThis as Record<string, unknown>).__nftAuthWarningLogged = false;

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================================================
// 1. Health & Status
// ============================================================================

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'nftables-service',
    version: SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    port: PORT,
    mode: isNftablesInstalled() ? 'production' : 'simulation',
    storage: 'postgresql',
    memoryUsage: process.memoryUsage(),
  });
});

app.get('/api/status', async (c) => {
  try {
    const installed = isNftablesInstalled();
    const version = installed ? getNftablesVersion() : 'Not installed (simulation mode)';
    const tables = listTables();

    const guiRules = await readGuiRules();
    const portForwards = await readPortForwards();
    const rateLimits = await readRateLimits();
    const quickBlocks = await readQuickBlocks();
    const schedules = await readSchedules();

    const liveCounts = installed ? getLiveChainRuleCounts() : null;

    const guiChainsInfo: Record<string, { exists: boolean; table: string; ruleCount: number; liveRuleCount?: number }> = {};
    for (const chain of GUI_CHAINS) {
      const rulesInChain = guiRules.filter(r => r.chain === chain && r.enabled).length;
      const chainInfo: { exists: boolean; table: string; ruleCount: number; liveRuleCount?: number } = {
        exists: true,
        table: GUI_CHAIN_DESCRIPTIONS[chain].table,
        ruleCount: chain === 'frchainspre'
          ? rulesInChain + portForwards.filter(p => p.enabled).length
          : rulesInChain,
        liveRuleCount: liveCounts ? (liveCounts[chain] || 0) : undefined,
      };
      guiChainsInfo[chain] = chainInfo;
    }

    return c.json({
      success: true,
      data: {
        version: SERVICE_VERSION,
        storage: 'postgresql',
        mode: installed ? 'production' : 'simulation',
        nftablesInstalled: installed,
        nftablesVersion: version,
        tables,
        guiChains: guiChainsInfo,
        counts: {
          guiRules: guiRules.length,
          enabledGuiRules: guiRules.filter(r => r.enabled).length,
          portForwards: portForwards.length,
          enabledPortForwards: portForwards.filter(p => p.enabled).length,
          rateLimits: rateLimits.length,
          enabledRateLimits: rateLimits.filter(r => r.enabled).length,
          quickBlocks: quickBlocks.length,
          schedules: schedules.length,
          enabledSchedules: schedules.filter(s => s.enabled).length,
        },
        presetsAvailable: BUILTIN_PRESETS.length,
        chainDescriptions: GUI_CHAIN_DESCRIPTIONS,
      },
    });
  } catch (error) {
    log.error('Failed to get status', { error: String(error) });
    return c.json({ success: false, error: 'Failed to retrieve status' }, 500);
  }
});

// ============================================================================
// 2. Chain Architecture
// ============================================================================

app.get('/api/chains', (c) => {
  return c.json({
    success: true,
    data: getChainArchitecture(),
  });
});

// ============================================================================
// 3. GUI Rules CRUD
// ============================================================================

app.get('/api/rules', async (c) => {
  try {
    const rules = await readGuiRules();
    return c.json({ success: true, data: rules, total: rules.length });
  } catch (error) {
    log.error('Failed to read GUI rules', { error: String(error) });
    return c.json({ success: false, error: 'Failed to read rules' }, 500);
  }
});

app.post('/api/rules', async (c) => {
  try {
    const body = await c.req.json();
    const rule: GuiRule = {
      id: generateId(),
      name: body.name,
      chain: body.chain,
      protocol: body.protocol || 'tcp',
      sourceIp: body.sourceIp,
      destIp: body.destIp,
      destPort: body.destPort,
      sourcePort: body.sourcePort,
      action: body.action,
      markValue: body.markValue,
      dnatTo: body.dnatTo,
      snatTo: body.snatTo,
      enabled: body.enabled !== undefined ? body.enabled : true,
      comment: body.comment,
      priority: body.priority || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await pool.query(
      `INSERT INTO "FirewallRule" (id, name, "chain", protocol, "sourceIp", "destIp", "destPort", "sourcePort",
        action, "markValue", "dnatTo", "snatTo", enabled, comment, priority, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [rule.id, rule.name, rule.chain, rule.protocol, rule.sourceIp, rule.destIp, rule.destPort, rule.sourcePort,
       rule.action, rule.markValue, rule.dnatTo, rule.snatTo, rule.enabled, rule.comment, rule.priority,
       rule.createdAt, rule.updatedAt]
    );

    const applyResult = await autoApplyRules();

    return c.json({
      success: true,
      data: rule,
      autoApply: applyResult,
    });
  } catch (error) {
    log.error('Failed to create GUI rule', { error: String(error) });
    return c.json({ success: false, error: 'Failed to create rule' }, 500);
  }
});

app.put('/api/rules/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const result = await pool.query(
      `UPDATE "FirewallRule"
       SET name = COALESCE($1, name), "chain" = COALESCE($2, "chain"), protocol = COALESCE($3, protocol),
           "sourceIp" = $4, "destIp" = $5, "destPort" = $6, "sourcePort" = $7,
           action = COALESCE($8, action), "markValue" = $9, "dnatTo" = $10, "snatTo" = $11,
           enabled = COALESCE($12, enabled), comment = $13, priority = COALESCE($14, priority),
           "updatedAt" = $15
       WHERE id = $16 RETURNING *`,
      [body.name, body.chain, body.protocol, body.sourceIp ?? null, body.destIp ?? null,
       body.destPort ?? null, body.sourcePort ?? null, body.action, body.markValue ?? null,
       body.dnatTo ?? null, body.snatTo ?? null, body.enabled, body.comment ?? null,
       body.priority, new Date().toISOString(), id]
    );

    if (result.rowCount === 0) {
      return c.json({ success: false, error: 'Rule not found' }, 404);
    }

    const applyResult = await autoApplyRules();

    return c.json({
      success: true,
      data: rowToGuiRule(result.rows[0]),
      autoApply: applyResult,
    });
  } catch (error) {
    log.error('Failed to update GUI rule', { error: String(error) });
    return c.json({ success: false, error: 'Failed to update rule' }, 500);
  }
});

app.delete('/api/rules/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await pool.query(`DELETE FROM "FirewallRule" WHERE id = $1 RETURNING id`, [id]);

    if (result.rowCount === 0) {
      return c.json({ success: false, error: 'Rule not found' }, 404);
    }

    const applyResult = await autoApplyRules();

    return c.json({
      success: true,
      deleted: id,
      autoApply: applyResult,
    });
  } catch (error) {
    log.error('Failed to delete GUI rule', { error: String(error) });
    return c.json({ success: false, error: 'Failed to delete rule' }, 500);
  }
});

// ============================================================================
// 4. Port Forwarding CRUD
// ============================================================================

app.get('/api/port-forwards', async (c) => {
  try {
    const forwards = await readPortForwards();
    return c.json({ success: true, data: forwards, total: forwards.length });
  } catch (error) {
    log.error('Failed to read port forwards', { error: String(error) });
    return c.json({ success: false, error: 'Failed to read port forwards' }, 500);
  }
});

app.post('/api/port-forwards', async (c) => {
  try {
    const body = await c.req.json();
    const pf: PortForward = {
      id: generateId(),
      name: body.name,
      protocol: body.protocol || 'tcp',
      externalPort: body.externalPort,
      internalIp: body.internalIp,
      internalPort: body.internalPort,
      sourceIp: body.sourceIp,
      enabled: body.enabled !== undefined ? body.enabled : true,
      comment: body.comment,
      createdAt: new Date().toISOString(),
    };

    await pool.query(
      `INSERT INTO "NftPortForward" (id, name, protocol, "externalPort", "internalIp", "internalPort", "sourceIp", enabled, comment, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [pf.id, pf.name, pf.protocol, pf.externalPort, pf.internalIp, pf.internalPort, pf.sourceIp, pf.enabled, pf.comment, pf.createdAt]
    );

    const applyResult = await autoApplyRules();

    return c.json({
      success: true,
      data: pf,
      autoApply: applyResult,
    });
  } catch (error) {
    log.error('Failed to create port forward', { error: String(error) });
    return c.json({ success: false, error: 'Failed to create port forward' }, 500);
  }
});

app.put('/api/port-forwards/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const result = await pool.query(
      `UPDATE "NftPortForward"
       SET name = COALESCE($1, name), protocol = COALESCE($2, protocol),
           "externalPort" = COALESCE($3, "externalPort"), "internalIp" = COALESCE($4, "internalIp"),
           "internalPort" = COALESCE($5, "internalPort"), "sourceIp" = $6,
           enabled = COALESCE($7, enabled), comment = $8
       WHERE id = $9 RETURNING *`,
      [body.name, body.protocol, body.externalPort, body.internalIp, body.internalPort,
       body.sourceIp ?? null, body.enabled, body.comment ?? null, id]
    );

    if (result.rowCount === 0) {
      return c.json({ success: false, error: 'Port forward not found' }, 404);
    }

    const applyResult = await autoApplyRules();
    const row = result.rows[0];

    return c.json({
      success: true,
      data: {
        id: row.id,
        name: row.name,
        protocol: row.protocol,
        externalPort: row.externalPort,
        internalIp: row.internalIp,
        internalPort: row.internalPort,
        sourceIp: row.sourceIp,
        enabled: row.enabled,
        comment: row.comment,
        handle: row.handle,
        createdAt: row.createdAt,
      },
      autoApply: applyResult,
    });
  } catch (error) {
    log.error('Failed to update port forward', { error: String(error) });
    return c.json({ success: false, error: 'Failed to update port forward' }, 500);
  }
});

app.delete('/api/port-forwards/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await pool.query(`DELETE FROM "NftPortForward" WHERE id = $1 RETURNING id`, [id]);

    if (result.rowCount === 0) {
      return c.json({ success: false, error: 'Port forward not found' }, 404);
    }

    const applyResult = await autoApplyRules();

    return c.json({
      success: true,
      deleted: id,
      autoApply: applyResult,
    });
  } catch (error) {
    log.error('Failed to delete port forward', { error: String(error) });
    return c.json({ success: false, error: 'Failed to delete port forward' }, 500);
  }
});

// ============================================================================
// 5. Rate Limiting CRUD
// ============================================================================

app.get('/api/rate-limits', async (c) => {
  try {
    const limits = await readRateLimits();
    return c.json({ success: true, data: limits, total: limits.length });
  } catch (error) {
    log.error('Failed to read rate limits', { error: String(error) });
    return c.json({ success: false, error: 'Failed to read rate limits' }, 500);
  }
});

app.post('/api/rate-limits', async (c) => {
  try {
    const body = await c.req.json();
    const rl: RateLimit = {
      id: generateId(),
      name: body.name,
      targetIp: body.targetIp,
      targetSet: body.targetSet,
      downloadRate: body.downloadRate,
      uploadRate: body.uploadRate,
      protocol: body.protocol,
      enabled: body.enabled !== undefined ? body.enabled : true,
      comment: body.comment,
      createdAt: new Date().toISOString(),
    };

    await pool.query(
      `INSERT INTO "NftRateLimit" (id, name, "targetIp", "targetSet", "downloadRate", "uploadRate", protocol, enabled, comment, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [rl.id, rl.name, rl.targetIp, rl.targetSet, rl.downloadRate, rl.uploadRate, rl.protocol, rl.enabled, rl.comment, rl.createdAt]
    );

    return c.json({
      success: true,
      data: rl,
    });
  } catch (error) {
    log.error('Failed to create rate limit', { error: String(error) });
    return c.json({ success: false, error: 'Failed to create rate limit' }, 500);
  }
});

app.put('/api/rate-limits/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const result = await pool.query(
      `UPDATE "NftRateLimit"
       SET name = COALESCE($1, name), "targetIp" = $2, "targetSet" = $3,
           "downloadRate" = COALESCE($4, "downloadRate"), "uploadRate" = COALESCE($5, "uploadRate"),
           protocol = $6, enabled = COALESCE($7, enabled), comment = $8
       WHERE id = $9 RETURNING *`,
      [body.name, body.targetIp ?? null, body.targetSet ?? null, body.downloadRate, body.uploadRate,
       body.protocol, body.enabled, body.comment ?? null, id]
    );

    if (result.rowCount === 0) {
      return c.json({ success: false, error: 'Rate limit not found' }, 404);
    }

    const row = result.rows[0];
    return c.json({
      success: true,
      data: {
        id: row.id, name: row.name, targetIp: row.targetIp, targetSet: row.targetSet,
        downloadRate: row.downloadRate, uploadRate: row.uploadRate, protocol: row.protocol,
        enabled: row.enabled, comment: row.comment, downloadHandle: row.downloadHandle,
        uploadHandle: row.uploadHandle, createdAt: row.createdAt,
      },
    });
  } catch (error) {
    log.error('Failed to update rate limit', { error: String(error) });
    return c.json({ success: false, error: 'Failed to update rate limit' }, 500);
  }
});

app.delete('/api/rate-limits/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await pool.query(`DELETE FROM "NftRateLimit" WHERE id = $1 RETURNING id`, [id]);

    if (result.rowCount === 0) {
      return c.json({ success: false, error: 'Rate limit not found' }, 404);
    }

    return c.json({ success: true, deleted: id });
  } catch (error) {
    log.error('Failed to delete rate limit', { error: String(error) });
    return c.json({ success: false, error: 'Failed to delete rate limit' }, 500);
  }
});

// ============================================================================
// 6. Quick Block CRUD
// ============================================================================

app.get('/api/quick-blocks', async (c) => {
  try {
    const blocks = await readQuickBlocks();
    return c.json({ success: true, data: blocks, total: blocks.length });
  } catch (error) {
    log.error('Failed to read quick blocks', { error: String(error) });
    return c.json({ success: false, error: 'Failed to read quick blocks' }, 500);
  }
});

app.post('/api/quick-blocks', async (c) => {
  try {
    const body = await c.req.json();
    const qb: QuickBlock = {
      id: generateId(),
      type: body.type || 'ip',
      value: body.value,
      reason: body.reason || '',
      blockedAt: new Date().toISOString(),
    };

    await pool.query(
      `INSERT INTO "NftQuickBlock" (id, type, value, reason, "blockedAt")
       VALUES ($1, $2, $3, $4, $5)`,
      [qb.id, qb.type, qb.value, qb.reason, qb.blockedAt]
    );

    const applyResult = await autoApplyRules();

    return c.json({
      success: true,
      data: qb,
      autoApply: applyResult,
    });
  } catch (error) {
    log.error('Failed to create quick block', { error: String(error) });
    return c.json({ success: false, error: 'Failed to create quick block' }, 500);
  }
});

app.delete('/api/quick-blocks/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await pool.query(`DELETE FROM "NftQuickBlock" WHERE id = $1 RETURNING id`, [id]);

    if (result.rowCount === 0) {
      return c.json({ success: false, error: 'Quick block not found' }, 404);
    }

    const applyResult = await autoApplyRules();

    return c.json({
      success: true,
      deleted: id,
      autoApply: applyResult,
    });
  } catch (error) {
    log.error('Failed to delete quick block', { error: String(error) });
    return c.json({ success: false, error: 'Failed to delete quick block' }, 500);
  }
});

// ============================================================================
// 7. Schedules CRUD
// ============================================================================

app.get('/api/schedules', async (c) => {
  try {
    const schedules = await readSchedules();
    return c.json({ success: true, data: schedules, total: schedules.length });
  } catch (error) {
    log.error('Failed to read schedules', { error: String(error) });
    return c.json({ success: false, error: 'Failed to read schedules' }, 500);
  }
});

app.post('/api/schedules', async (c) => {
  try {
    const body = await c.req.json();
    const sched: Schedule = {
      id: generateId(),
      name: body.name,
      days: body.days || '1,2,3,4,5,6,7',
      startTime: body.startTime || '00:00',
      endTime: body.endTime || '23:59',
      timezone: body.timezone || 'UTC',
      linkedRuleIds: body.linkedRuleIds || [],
      enabled: body.enabled !== undefined ? body.enabled : true,
      createdAt: new Date().toISOString(),
    };

    await pool.query(
      `INSERT INTO "NftSchedule" (id, name, days, "startTime", "endTime", timezone, "linkedRuleIds", enabled, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [sched.id, sched.name, sched.days, sched.startTime, sched.endTime, sched.timezone,
       JSON.stringify(sched.linkedRuleIds), sched.enabled, sched.createdAt]
    );

    return c.json({
      success: true,
      data: sched,
    });
  } catch (error) {
    log.error('Failed to create schedule', { error: String(error) });
    return c.json({ success: false, error: 'Failed to create schedule' }, 500);
  }
});

app.put('/api/schedules/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const linkedRuleIds = body.linkedRuleIds !== undefined ? JSON.stringify(body.linkedRuleIds) : undefined;

    const result = await pool.query(
      `UPDATE "NftSchedule"
       SET name = COALESCE($1, name), days = COALESCE($2, days),
           "startTime" = COALESCE($3, "startTime"), "endTime" = COALESCE($4, "endTime"),
           timezone = COALESCE($5, timezone), "linkedRuleIds" = COALESCE($6, "linkedRuleIds"),
           enabled = COALESCE($7, enabled)
       WHERE id = $8 RETURNING *`,
      [body.name, body.days, body.startTime, body.endTime, body.timezone, linkedRuleIds, body.enabled, id]
    );

    if (result.rowCount === 0) {
      return c.json({ success: false, error: 'Schedule not found' }, 404);
    }

    const row = result.rows[0];
    return c.json({
      success: true,
      data: {
        id: row.id, name: row.name, days: row.days, startTime: row.startTime, endTime: row.endTime,
        timezone: row.timezone, linkedRuleIds: row.linkedRuleIds || [], enabled: row.enabled, createdAt: row.createdAt,
      },
    });
  } catch (error) {
    log.error('Failed to update schedule', { error: String(error) });
    return c.json({ success: false, error: 'Failed to update schedule' }, 500);
  }
});

app.delete('/api/schedules/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await pool.query(`DELETE FROM "NftSchedule" WHERE id = $1 RETURNING id`, [id]);

    if (result.rowCount === 0) {
      return c.json({ success: false, error: 'Schedule not found' }, 404);
    }

    return c.json({ success: true, deleted: id });
  } catch (error) {
    log.error('Failed to delete schedule', { error: String(error) });
    return c.json({ success: false, error: 'Failed to delete schedule' }, 500);
  }
});

// ============================================================================
// 8. Presets (read-only, built-in)
// ============================================================================

app.get('/api/presets', (c) => {
  return c.json({
    success: true,
    data: BUILTIN_PRESETS,
    total: BUILTIN_PRESETS.length,
  });
});

app.post('/api/presets/:id/apply', async (c) => {
  try {
    const presetId = c.req.param('id');
    const preset = BUILTIN_PRESETS.find(p => p.id === presetId);

    if (!preset) {
      return c.json({ success: false, error: 'Preset not found' }, 404);
    }

    let createdCount = 0;
    for (const ruleTemplate of preset.rules) {
      const rule: GuiRule = {
        id: generateId(),
        name: ruleTemplate.name,
        chain: ruleTemplate.chain,
        protocol: ruleTemplate.protocol,
        sourceIp: ruleTemplate.sourceIp,
        destIp: ruleTemplate.destIp,
        destPort: ruleTemplate.destPort,
        sourcePort: ruleTemplate.sourcePort,
        action: ruleTemplate.action,
        markValue: ruleTemplate.markValue,
        dnatTo: ruleTemplate.dnatTo,
        snatTo: ruleTemplate.snatTo,
        enabled: ruleTemplate.enabled,
        comment: ruleTemplate.comment,
        priority: ruleTemplate.priority,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await pool.query(
        `INSERT INTO "FirewallRule" (id, name, "chain", protocol, "sourceIp", "destIp", "destPort", "sourcePort",
          action, "markValue", "dnatTo", "snatTo", enabled, comment, priority, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [rule.id, rule.name, rule.chain, rule.protocol, rule.sourceIp, rule.destIp, rule.destPort, rule.sourcePort,
         rule.action, rule.markValue, rule.dnatTo, rule.snatTo, rule.enabled, rule.comment, rule.priority,
         rule.createdAt, rule.updatedAt]
      );
      createdCount++;
    }

    const applyResult = await autoApplyRules();

    return c.json({
      success: true,
      data: {
        preset: preset.name,
        rulesCreated: createdCount,
        autoApply: applyResult,
      },
    });
  } catch (error) {
    log.error('Failed to apply preset', { error: String(error) });
    return c.json({ success: false, error: 'Failed to apply preset' }, 500);
  }
});

// ============================================================================
// 9. Apply & Flush
// ============================================================================

app.post('/api/apply', async (c) => {
  try {
    const result = await applyGuiRulesToNftables();
    return c.json({ success: result.success, data: result });
  } catch (error) {
    log.error('Failed to apply rules', { error: String(error) });
    return c.json({ success: false, error: 'Failed to apply rules' }, 500);
  }
});

app.post('/api/flush', (c) => {
  const result = flushGuiChainsInNftables();
  return c.json({ success: result.errors.length === 0, data: result });
});

// ============================================================================
// 10. Config Preview
// ============================================================================

app.get('/api/config/preview', async (c) => {
  try {
    const config = await generateConfigPreview();
    return c.json({ success: true, data: { config } });
  } catch (error) {
    log.error('Failed to generate config preview', { error: String(error) });
    return c.json({ success: false, error: 'Failed to generate config preview' }, 500);
  }
});

// ============================================================================
// Rule Counter Stats — read per-rule packet/byte counters from nftables
// ============================================================================

interface RuleCounter {
  ruleId: string;
  chain: string;
  table: string;
  handle: number;
  packets: number;
  bytes: number;
  action: string;
  comment: string;
}

/**
 * Parse nftables `-a` output and extract counter stats for GUI rules.
 *
 * Input format (one line per rule):
 *   [ 12345 packets, 987654 bytes ]  ip saddr 10.10.30.10 counter accept comment "gui:abc123 Allow PMS"
 *   handle 42
 *
 * We extract: handle, packets, bytes, gui:ruleId from comment.
 */
function parseChainCounters(table: string, chain: string): RuleCounter[] {
  try {
    const output = execSync(`nft -a list chain ${table} ${chain} 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 5000,
    });

    const results: RuleCounter[] = [];
    const lines = output.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match counter line: [ N packets, N bytes ]
      const counterMatch = line.match(/\[\s*(\d+)\s+packets?,\s*(\d+)\s+bytes?\s*\]/);
      if (!counterMatch) continue;

      const packets = parseInt(counterMatch[1], 10);
      const bytes = parseInt(counterMatch[2], 10);

      // Extract handle from next line or same line
      const handleLine = lines[i + 1] || '';
      const handleMatch = handleLine.match(/handle\s+(\d+)/) || line.match(/handle\s+(\d+)/);
      const handle = handleMatch ? parseInt(handleMatch[1], 10) : 0;

      // Extract gui:ruleId from comment
      const commentMatch = line.match(/comment\s+"gui:(\S+)(?:\s+(.+?))?"\s*$/);
      const ruleId = commentMatch ? commentMatch[1] : '';
      const commentText = commentMatch ? (commentMatch[2] || '') : '';

      // Extract action keyword
      const actionMatch = line.match(/\b(accept|drop|reject|log|masquerade|dnat|snat|meta mark set \d+)\b/);
      const action = actionMatch ? actionMatch[1] : 'unknown';

      // Skip the no-op meta mark 0x00000000 comment rule
      if (line.includes('StaySuite GUI Chain')) continue;
      // Skip quick-block rules (no gui: prefix)
      if (!ruleId && !line.includes('quick-block')) continue;

      results.push({
        ruleId,
        chain,
        table,
        handle,
        packets,
        bytes,
        action,
        comment: commentText,
      });
    }

    return results;
  } catch {
    return [];
  }
}

app.get('/api/rule-counters', async (c) => {
  try {
    if (!isNftablesInstalled()) {
      return c.json({
        success: true,
        data: {
          mode: 'simulation',
          counters: [],
          chainRuleCounts: {},
          message: 'nftables not installed — counters available in production mode only',
        },
      });
    }

    const allCounters: RuleCounter[] = [];
    const chainRuleCounts: Record<string, number> = {};

    for (const chain of GUI_CHAINS) {
      const meta = GUI_CHAIN_DESCRIPTIONS[chain];
      const counters = parseChainCounters(meta.table, chain);
      allCounters.push(...counters);
      chainRuleCounts[chain] = counters.length;
    }

    // Also count quick-block rules
    for (const chain of ['firewallchains', 'firewallchainsdn'] as const) {
      const counters = parseChainCounters('inet mangle', chain);
      const quickBlockCount = counters.filter(c => c.ruleId === '' && c.comment.includes('quick-block')).length;
      chainRuleCounts[`${chain}_quickblocks`] = quickBlockCount;
    }

    // Aggregate per ruleId (one GUI rule expands to multiple chains)
    const perRule: Record<string, { totalPackets: number; totalBytes: number; chains: string[] }> = {};
    for (const c of allCounters) {
      if (!c.ruleId) continue;
      if (!perRule[c.ruleId]) {
        perRule[c.ruleId] = { totalPackets: 0, totalBytes: 0, chains: [] };
      }
      perRule[c.ruleId].totalPackets += c.packets;
      perRule[c.ruleId].totalBytes += c.bytes;
      if (!perRule[c.ruleId].chains.includes(c.chain)) {
        perRule[c.ruleId].chains.push(c.chain);
      }
    }

    return c.json({
      success: true,
      data: {
        mode: 'production',
        counters: allCounters,
        perRule,
        chainRuleCounts,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error('Failed to read rule counters', { error: String(error) });
    return c.json({ success: false, error: 'Failed to read rule counters' }, 500);
  }
});

// ============================================================================
// Database connection verification on startup
// ============================================================================

async function verifyDatabase(maxRetries = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await pool.query('SELECT NOW() as now, current_database() as db');
      log.info('Database connected', {
        db: res.rows[0].db,
        time: res.rows[0].now,
        url: DB_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
      });

      // Verify tables exist
      const tables = await pool.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'
         AND tablename IN ('FirewallRule', 'PortForwardRule', 'RateLimitRule', 'QuickBlock', 'FirewallSchedule')`
      );
      const found = tables.rows.map(r => r.tablename);
      const expected = ['FirewallRule', 'PortForwardRule', 'RateLimitRule', 'QuickBlock', 'FirewallSchedule'];
      const missing = expected.filter(t => !found.includes(t));
      if (missing.length > 0) {
        log.error('Missing database tables', { missing });
      } else {
        log.info('All nftables-service tables verified', { tables: found });
      }
      return; // Success — exit retry loop
    } catch (error) {
      const isLast = attempt === maxRetries;
      log[isLast ? 'error' : 'warn'](
        isLast
          ? 'Database connection failed after all retries — service will start but operations will fail'
          : `Database connection attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs / 1000}s...`,
        {
          error: String(error),
          url: DB_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
          attempt,
        }
      );
      if (isLast) break;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

// ============================================================================
// Start Server
// ============================================================================

verifyDatabase().then(() => {
  log.info('Starting nftables-service', {
    version: SERVICE_VERSION,
    port: PORT,
    mode: isNftablesInstalled() ? 'production' : 'simulation',
    storage: 'postgresql',
    dataDir: DB_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
  });
});

// Explicit Bun.serve() instead of export default for better error reporting
try {
  const server = Bun.serve({
    port: PORT,
    hostname: '0.0.0.0',
    fetch: app.fetch,
  });
  log.info('nftables-service is listening', {
    port: server.port,
    hostname: server.hostname,
  });
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  log.error('FATAL: Failed to start nftables-service HTTP server', { port: PORT, error: message });
  process.exit(1);
}
