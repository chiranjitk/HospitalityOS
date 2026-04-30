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
 * System chains (NOT managed by GUI): prerouting, postrouting, open,
 *   accounting, accountingup, accountingdn, syn_flood, invalid_packets,
 *   port_scan, ssh_protection, dns_protection, icmp_limit, input, forward, drop_log
 *
 * Port: 3013
 * Mode: Simulation/Demo (persists rules in JSON files, generates nftables config)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../shared/logger';

// ============================================================================
// Constants & Setup
// ============================================================================

const app = new Hono();
const PORT = 3013;
const SERVICE_VERSION = '2.0.0';
const log = createLogger('nftables-service');
const startTime = Date.now();

const SERVICE_ROOT = __dirname;
const DATA_DIR = path.join(SERVICE_ROOT, 'data');
const APPLIED_CONFIG_PATH = path.join(DATA_DIR, 'applied.conf');

// Nettype constants
const NETTYPE = {
  LAN: 0,
  WAN: 1,
  VLAN: 2,
  BRIDGE: 3,
  BOND: 4,
  MANAGEMENT: 5,
  GUEST: 6,
  IOT: 7,
  UNUSED: 8,
  DMZ: 9,
  WIFI: 10,
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
// Data Storage Helpers
// ============================================================================

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonData<T>(filename: string): T[] {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as T[];
  } catch {
    return [];
  }
}

function writeJsonData<T>(filename: string, data: T[]): void {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function readGuiRules(): GuiRule[] {
  return readJsonData<GuiRule>('gui-rules.json');
}

function writeGuiRules(rules: GuiRule[]): void {
  writeJsonData('gui-rules.json', rules);
}

function readPortForwards(): PortForward[] {
  return readJsonData<PortForward>('port-forwards.json');
}

function writePortForwards(pfs: PortForward[]): void {
  writeJsonData('port-forwards.json', pfs);
}

function readRateLimits(): RateLimit[] {
  return readJsonData<RateLimit>('rate-limits.json');
}

function writeRateLimits(rls: RateLimit[]): void {
  writeJsonData('rate-limits.json', rls);
}

function readQuickBlocks(): QuickBlock[] {
  return readJsonData<QuickBlock>('quick-blocks.json');
}

function writeQuickBlocks(qbs: QuickBlock[]): void {
  writeJsonData('quick-blocks.json', qbs);
}

function readSchedules(): Schedule[] {
  return readJsonData<Schedule>('schedules.json');
}

function writeSchedules(scheds: Schedule[]): void {
  writeJsonData('schedules.json', scheds);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
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

function generateConfigPreview(): string {
  const guiRules = readGuiRules();
  const portForwards = readPortForwards();
  const quickBlocks = readQuickBlocks();

  // Convert port forwards to gui rules for rendering in frchainspre
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

  // Build sets from quick blocks
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

  // Add quick block drop rules at the top
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

  // Determine protocol handling — for tcp/udp with ports, protocol is part of port expression
  // For other protocols (icmp, all) or when no ports are specified, add protocol as keyword
  const isTcpUdp = rule.protocol === 'tcp' || rule.protocol === 'udp';
  const hasPorts = (rule.sourcePort || rule.destPort) && isTcpUdp;

  // Add protocol keyword only when it won't be duplicated by port expressions
  if (rule.protocol && rule.protocol !== 'all' && !hasPorts) {
    parts.push(rule.protocol);
  }

  // Source IP
  if (rule.sourceIp) {
    parts.push(`ip saddr ${rule.sourceIp}`);
  }

  // Dest IP (skip for DNAT/SNAT as they handle it differently)
  if (rule.destIp && rule.action !== 'dnat' && rule.action !== 'snat' && rule.action !== 'masquerade') {
    parts.push(`ip daddr ${rule.destIp}`);
  }

  // Source Port (includes protocol prefix for tcp/udp)
  if (rule.sourcePort && isTcpUdp) {
    parts.push(`${rule.protocol} sport ${rule.sourcePort}`);
  }

  // Dest Port (includes protocol prefix for tcp/udp)
  if (rule.destPort && isTcpUdp) {
    parts.push(`${rule.protocol} dport ${rule.destPort}`);
  }

  // Action
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
        // destPort already added above if applicable
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
        // masquerade uses source IP (the subnet to masquerade for)
        parts.push(`ip saddr ${rule.destIp}`);
      }
      parts.push('masquerade');
      break;
  }

  // Comment
  const comment = rule.comment ? ` comment "gui:${rule.id} ${rule.comment.replace(/"/g, '')}"` : ` comment "gui:${rule.id}"`;
  parts.push(comment);

  return parts.join(' ');
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

// Auth middleware - check Bearer token, skip for /health endpoint
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
    memoryUsage: process.memoryUsage(),
  });
});

app.get('/api/status', (c) => {
  const installed = isNftablesInstalled();
  const version = installed ? getNftablesVersion() : 'Not installed (simulation mode)';
  const tables = listTables();

  const guiRules = readGuiRules();
  const portForwards = readPortForwards();
  const rateLimits = readRateLimits();
  const quickBlocks = readQuickBlocks();
  const schedules = readSchedules();

  const guiChainsInfo: Record<string, { exists: boolean; table: string; ruleCount: number }> = {};
  for (const chain of GUI_CHAINS) {
    const rulesInChain = guiRules.filter(r => r.chain === chain && r.enabled).length;
    if (chain === 'frchainspre') {
      guiChainsInfo[chain] = { exists: true, table: 'inet nat', ruleCount: rulesInChain + portForwards.filter(p => p.enabled).length };
    } else {
      guiChainsInfo[chain] = { exists: true, table: GUI_CHAIN_DESCRIPTIONS[chain].table, ruleCount: rulesInChain };
    }
  }

  return c.json({
    mode: installed ? 'production' : 'simulation',
    nftables: {
      installed,
      version,
      tables,
    },
    ruleCounts: {
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
    guiChains: guiChainsInfo,
    appliedConfig: fs.existsSync(APPLIED_CONFIG_PATH),
    appliedAt: fs.existsSync(APPLIED_CONFIG_PATH)
      ? fs.statSync(APPLIED_CONFIG_PATH).mtime.toISOString()
      : null,
  });
});

// ============================================================================
// 2. GUI Rules CRUD
// ============================================================================

app.get('/api/gui-rules', (c) => {
  const rules = readGuiRules().sort((a, b) => a.priority - b.priority);
  return c.json({ success: true, data: rules, total: rules.length });
});

app.post('/api/gui-rules', async (c) => {
  try {
    const body = await c.req.json();
    const {
      name,
      chain,
      protocol = 'all',
      sourceIp,
      destIp,
      destPort,
      sourcePort,
      action = 'accept',
      markValue,
      dnatTo,
      snatTo,
      enabled = true,
      comment,
      priority = 100,
    } = body;

    if (!name || !chain || !action) {
      return c.json({ success: false, error: 'Missing required fields: name, chain, action' }, 400);
    }

    if (!GUI_CHAINS.includes(chain)) {
      return c.json({ success: false, error: `Invalid chain: ${chain}. Must be one of: ${GUI_CHAINS.join(', ')}` }, 400);
    }

    const validActions = ['accept', 'drop', 'reject', 'log', 'mark', 'dnat', 'snat', 'masquerade'];
    if (!validActions.includes(action)) {
      return c.json({ success: false, error: `Invalid action: ${action}. Must be one of: ${validActions.join(', ')}` }, 400);
    }

    if (action === 'dnat' && !dnatTo) {
      return c.json({ success: false, error: 'dnatTo is required when action is dnat' }, 400);
    }

    if (action === 'snat' && !snatTo) {
      return c.json({ success: false, error: 'snatTo is required when action is snat' }, 400);
    }

    if (action === 'mark' && markValue === undefined) {
      return c.json({ success: false, error: 'markValue is required when action is mark' }, 400);
    }

    const rules = readGuiRules();
    const newRule: GuiRule = {
      id: generateId(),
      name,
      chain: chain as GuiChainName,
      protocol,
      sourceIp,
      destIp,
      destPort: destPort ? String(destPort) : undefined,
      sourcePort: sourcePort ? String(sourcePort) : undefined,
      action: action as GuiRule['action'],
      markValue,
      dnatTo,
      snatTo,
      enabled,
      comment,
      priority: Number(priority),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    rules.push(newRule);
    writeGuiRules(rules);

    log.info('Created GUI rule', { id: newRule.id, name, chain, action });

    return c.json({ success: true, data: newRule });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

app.put('/api/gui-rules/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const rules = readGuiRules();
    const index = rules.findIndex(r => r.id === id);

    if (index === -1) {
      return c.json({ success: false, error: 'Rule not found' }, 404);
    }

    const existing = rules[index];

    // Validate chain if changed
    if (body.chain && !GUI_CHAINS.includes(body.chain)) {
      return c.json({ success: false, error: `Invalid chain: ${body.chain}` }, 400);
    }

    // Validate action if changed
    if (body.action) {
      const validActions = ['accept', 'drop', 'reject', 'log', 'mark', 'dnat', 'snat', 'masquerade'];
      if (!validActions.includes(body.action)) {
        return c.json({ success: false, error: `Invalid action: ${body.action}` }, 400);
      }
    }

    const updated: GuiRule = {
      ...existing,
      name: body.name !== undefined ? body.name : existing.name,
      chain: body.chain !== undefined ? body.chain as GuiChainName : existing.chain,
      protocol: body.protocol !== undefined ? body.protocol : existing.protocol,
      sourceIp: body.sourceIp !== undefined ? body.sourceIp : existing.sourceIp,
      destIp: body.destIp !== undefined ? body.destIp : existing.destIp,
      destPort: body.destPort !== undefined ? (body.destPort ? String(body.destPort) : undefined) : existing.destPort,
      sourcePort: body.sourcePort !== undefined ? (body.sourcePort ? String(body.sourcePort) : undefined) : existing.sourcePort,
      action: body.action !== undefined ? body.action as GuiRule['action'] : existing.action,
      markValue: body.markValue !== undefined ? body.markValue : existing.markValue,
      dnatTo: body.dnatTo !== undefined ? body.dnatTo : existing.dnatTo,
      snatTo: body.snatTo !== undefined ? body.snatTo : existing.snatTo,
      enabled: body.enabled !== undefined ? body.enabled : existing.enabled,
      comment: body.comment !== undefined ? body.comment : existing.comment,
      priority: body.priority !== undefined ? Number(body.priority) : existing.priority,
      updatedAt: new Date().toISOString(),
    };

    rules[index] = updated;
    writeGuiRules(rules);

    log.info('Updated GUI rule', { id, name: updated.name });

    return c.json({ success: true, data: updated });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

app.delete('/api/gui-rules/:id', (c) => {
  const { id } = c.req.param();
  const rules = readGuiRules();
  const index = rules.findIndex(r => r.id === id);

  if (index === -1) {
    return c.json({ success: false, error: 'Rule not found' }, 404);
  }

  const deleted = rules.splice(index, 1)[0];
  writeGuiRules(rules);

  log.info('Deleted GUI rule', { id, name: deleted.name });

  return c.json({ success: true, message: 'Rule deleted', data: deleted });
});

app.patch('/api/gui-rules/:id/toggle', (c) => {
  const { id } = c.req.param();
  const rules = readGuiRules();
  const index = rules.findIndex(r => r.id === id);

  if (index === -1) {
    return c.json({ success: false, error: 'Rule not found' }, 404);
  }

  rules[index].enabled = !rules[index].enabled;
  rules[index].updatedAt = new Date().toISOString();
  writeGuiRules(rules);

  log.info('Toggled GUI rule', { id, enabled: rules[index].enabled });

  return c.json({ success: true, data: rules[index] });
});

// ============================================================================
// 3. Port Forwards CRUD
// ============================================================================

app.get('/api/port-forwards', (c) => {
  const pfs = readPortForwards().sort((a, b) => a.externalPort - b.externalPort);
  return c.json({ success: true, data: pfs, total: pfs.length });
});

app.post('/api/port-forwards', async (c) => {
  try {
    const body = await c.req.json();
    const {
      name,
      protocol = 'tcp',
      externalPort,
      internalIp,
      internalPort,
      sourceIp,
      enabled = true,
      comment,
    } = body;

    if (!name || !externalPort || !internalIp || !internalPort) {
      return c.json({ success: false, error: 'Missing required fields: name, externalPort, internalIp, internalPort' }, 400);
    }

    if (!['tcp', 'udp', 'both'].includes(protocol)) {
      return c.json({ success: false, error: 'Protocol must be tcp, udp, or both' }, 400);
    }

    // Validate IP format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(internalIp)) {
      return c.json({ success: false, error: 'Invalid internalIp format' }, 400);
    }

    if (externalPort < 1 || externalPort > 65535) {
      return c.json({ success: false, error: 'externalPort must be between 1 and 65535' }, 400);
    }

    if (internalPort < 1 || internalPort > 65535) {
      return c.json({ success: false, error: 'internalPort must be between 1 and 65535' }, 400);
    }

    const pfs = readPortForwards();
    const newPf: PortForward = {
      id: generateId(),
      name,
      protocol: protocol as PortForward['protocol'],
      externalPort: Number(externalPort),
      internalIp,
      internalPort: Number(internalPort),
      sourceIp,
      enabled,
      comment,
      createdAt: new Date().toISOString(),
    };

    pfs.push(newPf);
    writePortForwards(pfs);

    log.info('Created port forward', { id: newPf.id, name, externalPort, internalIp, internalPort });

    return c.json({ success: true, data: newPf });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

app.put('/api/port-forwards/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const pfs = readPortForwards();
    const index = pfs.findIndex(p => p.id === id);

    if (index === -1) {
      return c.json({ success: false, error: 'Port forward not found' }, 404);
    }

    const existing = pfs[index];

    if (body.protocol && !['tcp', 'udp', 'both'].includes(body.protocol)) {
      return c.json({ success: false, error: 'Protocol must be tcp, udp, or both' }, 400);
    }

    const updated: PortForward = {
      ...existing,
      name: body.name !== undefined ? body.name : existing.name,
      protocol: body.protocol !== undefined ? body.protocol as PortForward['protocol'] : existing.protocol,
      externalPort: body.externalPort !== undefined ? Number(body.externalPort) : existing.externalPort,
      internalIp: body.internalIp !== undefined ? body.internalIp : existing.internalIp,
      internalPort: body.internalPort !== undefined ? Number(body.internalPort) : existing.internalPort,
      sourceIp: body.sourceIp !== undefined ? body.sourceIp : existing.sourceIp,
      enabled: body.enabled !== undefined ? body.enabled : existing.enabled,
      comment: body.comment !== undefined ? body.comment : existing.comment,
    };

    pfs[index] = updated;
    writePortForwards(pfs);

    log.info('Updated port forward', { id, name: updated.name });

    return c.json({ success: true, data: updated });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

app.delete('/api/port-forwards/:id', (c) => {
  const { id } = c.req.param();
  const pfs = readPortForwards();
  const index = pfs.findIndex(p => p.id === id);

  if (index === -1) {
    return c.json({ success: false, error: 'Port forward not found' }, 404);
  }

  const deleted = pfs.splice(index, 1)[0];
  writePortForwards(pfs);

  log.info('Deleted port forward', { id, name: deleted.name });

  return c.json({ success: true, message: 'Port forward deleted', data: deleted });
});

app.patch('/api/port-forwards/:id/toggle', (c) => {
  const { id } = c.req.param();
  const pfs = readPortForwards();
  const index = pfs.findIndex(p => p.id === id);

  if (index === -1) {
    return c.json({ success: false, error: 'Port forward not found' }, 404);
  }

  pfs[index].enabled = !pfs[index].enabled;
  writePortForwards(pfs);

  log.info('Toggled port forward', { id, enabled: pfs[index].enabled });

  return c.json({ success: true, data: pfs[index] });
});

// ============================================================================
// 4. Rate Limits CRUD
// ============================================================================

app.get('/api/rate-limits', (c) => {
  const rls = readRateLimits();
  return c.json({ success: true, data: rls, total: rls.length });
});

app.post('/api/rate-limits', async (c) => {
  try {
    const body = await c.req.json();
    const {
      name,
      targetIp,
      targetSet,
      downloadRate,
      uploadRate,
      protocol,
      enabled = true,
      comment,
    } = body;

    if (!name || !downloadRate || !uploadRate) {
      return c.json({ success: false, error: 'Missing required fields: name, downloadRate, uploadRate' }, 400);
    }

    if (!targetIp && !targetSet) {
      return c.json({ success: false, error: 'Either targetIp or targetSet is required' }, 400);
    }

    // Validate rate format (e.g. "10mbit", "512kbit")
    const rateRegex = /^\d+(mbit|kbit|kbytes|mbytes|bytes|gbit|gbytes)$/i;
    if (!rateRegex.test(downloadRate)) {
      return c.json({ success: false, error: `Invalid downloadRate format: ${downloadRate}. Expected format: e.g. "10mbit", "512kbit"` }, 400);
    }
    if (!rateRegex.test(uploadRate)) {
      return c.json({ success: false, error: `Invalid uploadRate format: ${uploadRate}. Expected format: e.g. "10mbit", "512kbit"` }, 400);
    }

    const rls = readRateLimits();
    const newRl: RateLimit = {
      id: generateId(),
      name,
      targetIp,
      targetSet,
      downloadRate,
      uploadRate,
      protocol,
      enabled,
      comment,
      createdAt: new Date().toISOString(),
    };

    rls.push(newRl);
    writeRateLimits(rls);

    log.info('Created rate limit', { id: newRl.id, name, downloadRate, uploadRate });

    return c.json({ success: true, data: newRl });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

app.put('/api/rate-limits/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const rls = readRateLimits();
    const index = rls.findIndex(r => r.id === id);

    if (index === -1) {
      return c.json({ success: false, error: 'Rate limit not found' }, 404);
    }

    const existing = rls[index];

    // Validate rate format if changed
    if (body.downloadRate) {
      const rateRegex = /^\d+(mbit|kbit|kbytes|mbytes|bytes|gbit|gbytes)$/i;
      if (!rateRegex.test(body.downloadRate)) {
        return c.json({ success: false, error: `Invalid downloadRate format: ${body.downloadRate}` }, 400);
      }
    }
    if (body.uploadRate) {
      const rateRegex = /^\d+(mbit|kbit|kbytes|mbytes|bytes|gbit|gbytes)$/i;
      if (!rateRegex.test(body.uploadRate)) {
        return c.json({ success: false, error: `Invalid uploadRate format: ${body.uploadRate}` }, 400);
      }
    }

    const updated: RateLimit = {
      ...existing,
      name: body.name !== undefined ? body.name : existing.name,
      targetIp: body.targetIp !== undefined ? body.targetIp : existing.targetIp,
      targetSet: body.targetSet !== undefined ? body.targetSet : existing.targetSet,
      downloadRate: body.downloadRate !== undefined ? body.downloadRate : existing.downloadRate,
      uploadRate: body.uploadRate !== undefined ? body.uploadRate : existing.uploadRate,
      protocol: body.protocol !== undefined ? body.protocol : existing.protocol,
      enabled: body.enabled !== undefined ? body.enabled : existing.enabled,
      comment: body.comment !== undefined ? body.comment : existing.comment,
    };

    rls[index] = updated;
    writeRateLimits(rls);

    log.info('Updated rate limit', { id, name: updated.name });

    return c.json({ success: true, data: updated });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

app.delete('/api/rate-limits/:id', (c) => {
  const { id } = c.req.param();
  const rls = readRateLimits();
  const index = rls.findIndex(r => r.id === id);

  if (index === -1) {
    return c.json({ success: false, error: 'Rate limit not found' }, 404);
  }

  const deleted = rls.splice(index, 1)[0];
  writeRateLimits(rls);

  log.info('Deleted rate limit', { id, name: deleted.name });

  return c.json({ success: true, message: 'Rate limit deleted', data: deleted });
});

app.patch('/api/rate-limits/:id/toggle', (c) => {
  const { id } = c.req.param();
  const rls = readRateLimits();
  const index = rls.findIndex(r => r.id === id);

  if (index === -1) {
    return c.json({ success: false, error: 'Rate limit not found' }, 404);
  }

  rls[index].enabled = !rls[index].enabled;
  writeRateLimits(rls);

  log.info('Toggled rate limit', { id, enabled: rls[index].enabled });

  return c.json({ success: true, data: rls[index] });
});

// ============================================================================
// 5. Quick Blocks CRUD
// ============================================================================

app.get('/api/quick-blocks', (c) => {
  const qbs = readQuickBlocks().sort((a, b) => new Date(b.blockedAt).getTime() - new Date(a.blockedAt).getTime());
  return c.json({ success: true, data: qbs, total: qbs.length });
});

app.post('/api/quick-blocks', async (c) => {
  try {
    const body = await c.req.json();
    const { type, value, reason = '' } = body;

    if (!type || !value) {
      return c.json({ success: false, error: 'Missing required fields: type, value' }, 400);
    }

    if (!['ip', 'subnet', 'mac'].includes(type)) {
      return c.json({ success: false, error: 'Type must be ip, subnet, or mac' }, 400);
    }

    // Validate format based on type
    if (type === 'ip') {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(value)) {
        return c.json({ success: false, error: 'Invalid IP address format' }, 400);
      }
    } else if (type === 'subnet') {
      const subnetRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
      if (!subnetRegex.test(value)) {
        return c.json({ success: false, error: 'Invalid subnet format (expected x.x.x.x/y)' }, 400);
      }
    } else if (type === 'mac') {
      const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
      if (!macRegex.test(value)) {
        return c.json({ success: false, error: 'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)' }, 400);
      }
    }

    // Check for duplicates
    const qbs = readQuickBlocks();
    if (qbs.some(b => b.type === type && b.value.toLowerCase() === value.toLowerCase())) {
      return c.json({ success: false, error: `${type} ${value} is already blocked` }, 409);
    }

    const newBlock: QuickBlock = {
      id: generateId(),
      type: type as QuickBlock['type'],
      value,
      reason,
      blockedAt: new Date().toISOString(),
    };

    qbs.push(newBlock);
    writeQuickBlocks(qbs);

    log.info('Created quick block', { id: newBlock.id, type, value, reason });

    return c.json({ success: true, data: newBlock });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

app.delete('/api/quick-blocks/:id', (c) => {
  const { id } = c.req.param();
  const qbs = readQuickBlocks();
  const index = qbs.findIndex(b => b.id === id);

  if (index === -1) {
    return c.json({ success: false, error: 'Quick block not found' }, 404);
  }

  const deleted = qbs.splice(index, 1)[0];
  writeQuickBlocks(qbs);

  log.info('Deleted quick block', { id, type: deleted.type, value: deleted.value });

  return c.json({ success: true, message: 'Quick block removed', data: deleted });
});

// ============================================================================
// 6. Schedules CRUD
// ============================================================================

app.get('/api/schedules', (c) => {
  const scheds = readSchedules();
  return c.json({ success: true, data: scheds, total: scheds.length });
});

app.post('/api/schedules', async (c) => {
  try {
    const body = await c.req.json();
    const {
      name,
      days,
      startTime,
      endTime,
      timezone = 'UTC',
      linkedRuleIds = [],
      enabled = true,
    } = body;

    if (!name || !days || !startTime || !endTime) {
      return c.json({ success: false, error: 'Missing required fields: name, days, startTime, endTime' }, 400);
    }

    // Validate days format (comma-separated numbers 1-7)
    const dayNumbers = days.split(',').map((d: string) => parseInt(d.trim()));
    if (dayNumbers.some(d => isNaN(d) || d < 1 || d > 7)) {
      return c.json({ success: false, error: 'Days must be comma-separated numbers 1-7 (1=Mon, 7=Sun)' }, 400);
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime)) {
      return c.json({ success: false, error: 'Invalid startTime format (expected HH:MM)' }, 400);
    }
    if (!timeRegex.test(endTime)) {
      return c.json({ success: false, error: 'Invalid endTime format (expected HH:MM)' }, 400);
    }

    const scheds = readSchedules();
    const newSched: Schedule = {
      id: generateId(),
      name,
      days,
      startTime,
      endTime,
      timezone,
      linkedRuleIds,
      enabled,
      createdAt: new Date().toISOString(),
    };

    scheds.push(newSched);
    writeSchedules(scheds);

    log.info('Created schedule', { id: newSched.id, name, days, startTime, endTime });

    return c.json({ success: true, data: newSched });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

app.put('/api/schedules/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const scheds = readSchedules();
    const index = scheds.findIndex(s => s.id === id);

    if (index === -1) {
      return c.json({ success: false, error: 'Schedule not found' }, 404);
    }

    const existing = scheds[index];

    const updated: Schedule = {
      ...existing,
      name: body.name !== undefined ? body.name : existing.name,
      days: body.days !== undefined ? body.days : existing.days,
      startTime: body.startTime !== undefined ? body.startTime : existing.startTime,
      endTime: body.endTime !== undefined ? body.endTime : existing.endTime,
      timezone: body.timezone !== undefined ? body.timezone : existing.timezone,
      linkedRuleIds: body.linkedRuleIds !== undefined ? body.linkedRuleIds : existing.linkedRuleIds,
      enabled: body.enabled !== undefined ? body.enabled : existing.enabled,
    };

    scheds[index] = updated;
    writeSchedules(scheds);

    log.info('Updated schedule', { id, name: updated.name });

    return c.json({ success: true, data: updated });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

app.delete('/api/schedules/:id', (c) => {
  const { id } = c.req.param();
  const scheds = readSchedules();
  const index = scheds.findIndex(s => s.id === id);

  if (index === -1) {
    return c.json({ success: false, error: 'Schedule not found' }, 404);
  }

  const deleted = scheds.splice(index, 1)[0];
  writeSchedules(scheds);

  log.info('Deleted schedule', { id, name: deleted.name });

  return c.json({ success: true, message: 'Schedule deleted', data: deleted });
});

// ============================================================================
// 7. Presets
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
    const { id } = c.req.param();
    const preset = BUILTIN_PRESETS.find(p => p.id === id);

    if (!preset) {
      return c.json({ success: false, error: `Preset not found: ${id}` }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const overrideEnabled = body.enabled !== undefined ? body.enabled : true;

    const rules = readGuiRules();
    const createdRules: GuiRule[] = [];
    const now = new Date().toISOString();

    for (const template of preset.rules) {
      const newRule: GuiRule = {
        id: generateId(),
        name: `[${preset.name}] ${template.name}`,
        chain: template.chain,
        protocol: template.protocol,
        sourceIp: template.sourceIp,
        destIp: template.destIp,
        destPort: template.destPort,
        sourcePort: template.sourcePort,
        action: template.action,
        markValue: template.markValue,
        dnatTo: template.dnatTo,
        snatTo: template.snatTo,
        enabled: overrideEnabled,
        comment: template.comment ? `Preset: ${preset.name} - ${template.comment}` : `Applied from preset: ${preset.name}`,
        priority: template.priority,
        createdAt: now,
        updatedAt: now,
      };
      rules.push(newRule);
      createdRules.push(newRule);
    }

    writeGuiRules(rules);

    log.info('Applied preset', { presetId: id, presetName: preset.name, rulesCreated: createdRules.length });

    return c.json({
      success: true,
      message: `Preset "${preset.name}" applied with ${createdRules.length} rules`,
      data: {
        preset: preset.name,
        presetId: preset.id,
        rulesCreated: createdRules.length,
        rules: createdRules,
      },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// 8. Config Generation & Apply
// ============================================================================

app.get('/api/config/preview', (c) => {
  const config = generateConfigPreview();
  return c.json({
    success: true,
    config,
    generatedAt: new Date().toISOString(),
    mode: isNftablesInstalled() ? 'production' : 'simulation',
  });
});

app.post('/api/apply', (c) => {
  try {
    const config = generateConfigPreview();
    ensureDataDir();

    // Save the applied config
    fs.writeFileSync(APPLIED_CONFIG_PATH, config, 'utf-8');

    // In simulation mode, we just save and return success
    if (!isNftablesInstalled()) {
      log.info('Applied config (simulation mode)', {
        configLines: config.split('\n').length,
        savedTo: APPLIED_CONFIG_PATH,
      });

      return c.json({
        success: true,
        mode: 'simulation',
        message: 'Config applied (simulation mode). Saved to file.',
        configPath: APPLIED_CONFIG_PATH,
        configLines: config.split('\n').length,
      });
    }

    // In production, apply with nft
    const { execSync } = require('child_process');

    // Validate first
    try {
      execSync(`nft -c -f ${APPLIED_CONFIG_PATH}`, { encoding: 'utf-8', timeout: 15000 });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return c.json({
        success: false,
        mode: 'production',
        error: 'Config validation failed',
        validationError: error,
      }, 400);
    }

    // Apply
    try {
      execSync(`nft -f ${APPLIED_CONFIG_PATH}`, { encoding: 'utf-8', timeout: 15000 });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return c.json({
        success: false,
        mode: 'production',
        error: 'Failed to apply config',
        applyError: error,
      }, 500);
    }

    log.info('Applied config (production mode)', { configPath: APPLIED_CONFIG_PATH });

    return c.json({
      success: true,
      mode: 'production',
      message: 'Config applied successfully',
      configPath: APPLIED_CONFIG_PATH,
      configLines: config.split('\n').length,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

app.post('/api/flush-gui', (c) => {
  try {
    // Clear all GUI rules from JSON storage
    writeGuiRules([]);
    writePortForwards([]);
    writeQuickBlocks([]);
    writeRateLimits([]);
    writeSchedules([]);

    // Remove applied config
    if (fs.existsSync(APPLIED_CONFIG_PATH)) {
      fs.unlinkSync(APPLIED_CONFIG_PATH);
    }

    log.info('Flushed all GUI chain data');

    return c.json({
      success: true,
      message: 'All GUI chain rules flushed. System chains untouched.',
      mode: isNftablesInstalled() ? 'production' : 'simulation',
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error }, 500);
  }
});

// ============================================================================
// 9. Chain Architecture
// ============================================================================

app.get('/api/chain-architecture', (c) => {
  return c.json({
    success: true,
    data: getChainArchitecture(),
  });
});

// ============================================================================
// Start Server
// ============================================================================

ensureDataDir();

log.info('Starting nftables-service', {
  version: SERVICE_VERSION,
  port: PORT,
  mode: isNftablesInstalled() ? 'production' : 'simulation',
  dataDir: DATA_DIR,
});

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

log.info('nftables-service is running', { port: PORT });
