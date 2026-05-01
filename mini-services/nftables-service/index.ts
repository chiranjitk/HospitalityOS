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
  action: 'accept' | 'drop' | 'reject' | 'log' | 'mark' | 'dnat' | 'snat' | 'masquerade';
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
    `SELECT id, name, "chain", protocol, "sourceIp", "destIp", "destPort", "sourcePort",
            action, "markValue", "dnatTo", "snatTo", enabled, comment, priority, handle,
            "createdAt"::text, "updatedAt"::text
     FROM "NftGuiRule" ORDER BY priority ASC`
  );
  return res.rows.map(rowToGuiRule);
}

function rowToGuiRule(row: Record<string, unknown>): GuiRule {
  return {
    id: row.id as string,
    name: row.name as string,
    chain: row.chain as GuiChainName,
    protocol: row.protocol as string,
    sourceIp: row.sourceIp as string | undefined,
    destIp: row.destIp as string | undefined,
    destPort: row.destPort as string | undefined,
    sourcePort: row.sourcePort as string | undefined,
    action: row.action as GuiRule['action'],
    markValue: row.markValue as number | undefined,
    dnatTo: row.dnatTo as string | undefined,
    snatTo: row.snatTo as string | undefined,
    enabled: row.enabled as boolean,
    comment: row.comment as string | undefined,
    priority: row.priority as number,
    handle: row.handle as number | undefined,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

async function readPortForwards(): Promise<PortForward[]> {
  const res = await pool.query(
    `SELECT id, name, protocol, "externalPort", "internalIp", "internalPort",
            "sourceIp", enabled, comment, handle, "createdAt"::text
     FROM "NftPortForward" ORDER BY "externalPort" ASC`
  );
  return res.rows.map(row => ({
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
  }));
}

async function readRateLimits(): Promise<RateLimit[]> {
  const res = await pool.query(
    `SELECT id, name, "targetIp", "targetSet", "downloadRate", "uploadRate",
            protocol, enabled, comment, "downloadHandle", "uploadHandle", "createdAt"::text
     FROM "NftRateLimit" ORDER BY name ASC`
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
    downloadHandle: row.downloadHandle,
    uploadHandle: row.uploadHandle,
    createdAt: row.createdAt,
  }));
}

async function readQuickBlocks(): Promise<QuickBlock[]> {
  const res = await pool.query(
    `SELECT id, type, value, reason, handle, "blockedAt"::text
     FROM "NftQuickBlock" ORDER BY "blockedAt" DESC`
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
    `SELECT id, name, days, "startTime", "endTime", timezone, "linkedRuleIds", enabled, "createdAt"::text
     FROM "NftSchedule" ORDER BY name ASC`
  );
  return res.rows.map(row => ({
    id: row.id,
    name: row.name,
    days: row.days,
    startTime: row.startTime,
    endTime: row.endTime,
    timezone: row.timezone,
    linkedRuleIds: row.linkedRuleIds || [],
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

  const enabledByChain: Record<string, GuiRule[]> = {};
  for (const chain of GUI_CHAINS) {
    enabledByChain[chain] = allRules
      .filter(r => r.chain === chain && r.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  const blockedIps = quickBlocks.filter(b => b.type === 'ip').map(b => b.value);
  const blockedSubnets = quickBlocks.filter(b => b.type === 'subnet').map(b => b.value);
  const blockedMacs = quickBlocks.filter(b => b.type === 'mac').map(b => b.value);

  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push('# StaySuite GUI Firewall Configuration Preview');
  lines.push(`# Generated: ${now}`);
  lines.push('# Only GUI-controlled chains are shown. System chains are managed separately.');
  lines.push('# ============================================================');
  lines.push('');

  // --- inet mangle table ---
  lines.push('table inet mangle {');
  lines.push('');

  // firewallchains
  lines.push('  chain firewallchains {');
  lines.push('    # GUI Chain: Uplink Filter (mangle prerouting)');
  lines.push('    # Jumped to from prerouting hook after set-based jumps');
  lines.push('');

  if (blockedIps.length > 0) {
    lines.push('    # Quick Blocks - Blocked IPs');
    for (const ip of blockedIps) {
      lines.push(`    ip daddr ${ip} drop comment "quick-block:ip"`);
    }
    lines.push('');
  }
  if (blockedSubnets.length > 0) {
    lines.push('    # Quick Blocks - Blocked Subnets');
    for (const subnet of blockedSubnets) {
      lines.push(`    ip daddr ${subnet} drop comment "quick-block:subnet"`);
    }
    lines.push('');
  }

  const fcRules = enabledByChain['firewallchains'];
  if (fcRules.length > 0) {
    fcRules.forEach((rule, i) => {
      lines.push(`    # [${i + 1}] ${rule.name} (gui-rule:${rule.id})`);
      lines.push(`    ${buildNftRuleLine(rule)}`);
    });
  } else {
    lines.push('    # (no GUI rules configured)');
  }
  lines.push('  }');
  lines.push('');

  // firewallchainsdn
  lines.push('  chain firewallchainsdn {');
  lines.push('    # GUI Chain: Downlink Filter (mangle postrouting)');
  lines.push('    # Jumped to from postrouting hook after set-based jumps');
  lines.push('');

  if (blockedIps.length > 0) {
    lines.push('    # Quick Blocks - Blocked IPs (downlink)');
    for (const ip of blockedIps) {
      lines.push(`    ip saddr ${ip} drop comment "quick-block:ip"`);
    }
    lines.push('');
  }

  const fcdnRules = enabledByChain['firewallchainsdn'];
  if (fcdnRules.length > 0) {
    fcdnRules.forEach((rule, i) => {
      lines.push(`    # [${i + 1}] ${rule.name} (gui-rule:${rule.id})`);
      lines.push(`    ${buildNftRuleLine(rule)}`);
    });
  } else {
    lines.push('    # (no GUI rules configured)');
  }
  lines.push('  }');
  lines.push('');

  // firewallchains_conn
  lines.push('  chain firewallchains_conn {');
  lines.push('    # GUI Chain: Connection-Level Marking (mangle prerouting)');
  lines.push('    # Applied to logged-in user connections');
  lines.push('');

  const fccRules = enabledByChain['firewallchains_conn'];
  if (fccRules.length > 0) {
    fccRules.forEach((rule, i) => {
      lines.push(`    # [${i + 1}] ${rule.name} (gui-rule:${rule.id})`);
      lines.push(`    ${buildNftRuleLine(rule)}`);
    });
  } else {
    lines.push('    # (no GUI rules configured)');
  }
  lines.push('  }');
  lines.push('');

  // firewallchainsdn_conn
  lines.push('  chain firewallchainsdn_conn {');
  lines.push('    # GUI Chain: Connection-Level Marking (mangle postrouting)');
  lines.push('    # Applied to logged-in user connections');
  lines.push('');

  const fcdcRules = enabledByChain['firewallchainsdn_conn'];
  if (fcdcRules.length > 0) {
    fcdcRules.forEach((rule, i) => {
      lines.push(`    # [${i + 1}] ${rule.name} (gui-rule:${rule.id})`);
      lines.push(`    ${buildNftRuleLine(rule)}`);
    });
  } else {
    lines.push('    # (no GUI rules configured)');
  }
  lines.push('  }');
  lines.push('}');

  // --- inet nat table ---
  lines.push('');
  lines.push('table inet nat {');
  lines.push('');

  // frchainspre
  lines.push('  chain frchainspre {');
  lines.push('    # GUI Chain: NAT Prerouting (DNAT / Port Forward)');
  lines.push('    # Jumped to from inet nat prerouting hook');
  lines.push('');

  const fcpRules = enabledByChain['frchainspre'];
  if (fcpRules.length > 0) {
    fcpRules.forEach((rule, i) => {
      lines.push(`    # [${i + 1}] ${rule.name} (gui-rule:${rule.id})`);
      lines.push(`    ${buildNftRuleLine(rule)}`);
    });
  } else {
    lines.push('    # (no GUI rules configured)');
  }
  lines.push('  }');
  lines.push('');

  // frchainspost
  lines.push('  chain frchainspost {');
  lines.push('    # GUI Chain: NAT Postrouting (SNAT / Masquerade)');
  lines.push('    # Jumped to from inet nat postrouting hook');
  lines.push('');

  const fcpostRules = enabledByChain['frchainspost'];
  if (fcpostRules.length > 0) {
    fcpostRules.forEach((rule, i) => {
      lines.push(`    # [${i + 1}] ${rule.name} (gui-rule:${rule.id})`);
      lines.push(`    ${buildNftRuleLine(rule)}`);
    });
  } else {
    lines.push('    # (no GUI rules configured)');
  }
  lines.push('  }');
  lines.push('}');

  // --- Sets ---
  if (blockedIps.length > 0 || blockedSubnets.length > 0 || blockedMacs.length > 0) {
    lines.push('');
    lines.push('table inet filter {');
    lines.push('');

    if (blockedIps.length > 0) {
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

function buildNftRuleLine(rule: GuiRule): string {
  const parts: string[] = [];

  const isTcpUdp = rule.protocol === 'tcp' || rule.protocol === 'udp';
  const hasPorts = (rule.sourcePort || rule.destPort) && isTcpUdp;

  if (rule.protocol && rule.protocol !== 'all' && !hasPorts) {
    parts.push(rule.protocol);
  }

  if (rule.sourceIp) {
    parts.push(`ip saddr ${rule.sourceIp}`);
  }

  if (rule.destIp && rule.action !== 'dnat' && rule.action !== 'snat' && rule.action !== 'masquerade') {
    parts.push(`ip daddr ${rule.destIp}`);
  }

  if (rule.sourcePort && isTcpUdp) {
    parts.push(`${rule.protocol} sport ${rule.sourcePort}`);
  }

  if (rule.destPort && isTcpUdp) {
    parts.push(`${rule.protocol} dport ${rule.destPort}`);
  }

  switch (rule.action) {
    case 'accept':
    case 'drop':
    case 'reject':
    case 'log':
      parts.push(rule.action);
      break;
    case 'mark':
      parts.push(`meta mark set ${rule.markValue || 0}`);
      break;
    case 'dnat':
      if (rule.dnatTo) {
        parts.push(`dnat to ${rule.dnatTo}`);
      }
      break;
    case 'snat':
      if (rule.snatTo) {
        parts.push(`snat to ${rule.snatTo}`);
      }
      break;
    case 'masquerade':
      if (rule.destIp) {
        parts.push(`ip saddr ${rule.destIp}`);
      }
      parts.push('masquerade');
      break;
  }

  const comment = rule.comment ? ` comment "gui:${rule.id} ${rule.comment.replace(/"/g, '')}"` : ` comment "gui:${rule.id}"`;
  parts.push(comment);

  return parts.join(' ');
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

async function applyGuiRulesToNftables(): Promise<{
  success: boolean;
  chainsCreated: string[];
  chainsExisting: string[];
  rulesApplied: Record<string, number>;
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

  const enabledByChain: Record<string, GuiRule[]> = {};
  for (const chain of GUI_CHAINS) {
    enabledByChain[chain] = allRules
      .filter(r => r.chain === chain && r.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  const blockedIps = quickBlocks.filter(b => b.type === 'ip').map(b => b.value);
  const blockedSubnets = quickBlocks.filter(b => b.type === 'subnet').map(b => b.value);

  for (const chain of GUI_CHAINS) {
    const meta = GUI_CHAIN_DESCRIPTIONS[chain];
    const table = meta.table;
    const rules = enabledByChain[chain];
    let chainRuleCount = 0;

    const flushResult = flushGuiChain(table, chain);
    commands.push(`nft flush chain ${table} ${chain}`);
    if (!flushResult.success) {
      errors.push(`Failed to flush ${chain}: ${flushResult.error}`);
      continue;
    }

    if (chain === 'firewallchains') {
      for (const ip of blockedIps) {
        const result = addRuleToChain(table, chain, `ip daddr ${ip} drop comment "quick-block:ip"`);
        commands.push(`nft add rule ${table} ${chain} ip daddr ${ip} drop comment "quick-block:ip"`);
        if (result.success) chainRuleCount++;
        else errors.push(result.error || `Failed: add rule ${table} ${chain} ip daddr ${ip} drop`);
      }
      for (const subnet of blockedSubnets) {
        const result = addRuleToChain(table, chain, `ip daddr ${subnet} drop comment "quick-block:subnet"`);
        commands.push(`nft add rule ${table} ${chain} ip daddr ${subnet} drop comment "quick-block:subnet"`);
        if (result.success) chainRuleCount++;
        else errors.push(result.error || `Failed: add rule ${table} ${chain} ip daddr ${subnet} drop`);
      }
    }

    if (chain === 'firewallchainsdn') {
      for (const ip of blockedIps) {
        const result = addRuleToChain(table, chain, `ip saddr ${ip} drop comment "quick-block:ip"`);
        commands.push(`nft add rule ${table} ${chain} ip saddr ${ip} drop comment "quick-block:ip"`);
        if (result.success) chainRuleCount++;
        else errors.push(result.error || `Failed: add rule ${table} ${chain} ip saddr ${ip} drop`);
      }
    }

    for (const rule of rules) {
      const ruleLine = buildNftRuleLine(rule);
      const result = addRuleToChain(table, chain, ruleLine);
      commands.push(`nft add rule ${table} ${chain} ${ruleLine}`);
      if (result.success) {
        chainRuleCount++;
      } else {
        errors.push(`${rule.name}: ${result.error}`);
      }
    }

    rulesApplied[chain] = chainRuleCount;
  }

  return {
    success: errors.length === 0,
    chainsCreated: chainCheck.created,
    chainsExisting: chainCheck.existing,
    rulesApplied,
    commands,
    errors,
  };
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
      `INSERT INTO "NftGuiRule" (id, name, "chain", protocol, "sourceIp", "destIp", "destPort", "sourcePort",
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
      `UPDATE "NftGuiRule"
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
    const result = await pool.query(`DELETE FROM "NftGuiRule" WHERE id = $1 RETURNING id`, [id]);

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
        `INSERT INTO "NftGuiRule" (id, name, "chain", protocol, "sourceIp", "destIp", "destPort", "sourcePort",
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
         AND tablename IN ('NftGuiRule', 'NftPortForward', 'NftRateLimit', 'NftQuickBlock', 'NftSchedule')`
      );
      const found = tables.rows.map(r => r.tablename);
      const expected = ['NftGuiRule', 'NftPortForward', 'NftRateLimit', 'NftQuickBlock', 'NftSchedule'];
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
