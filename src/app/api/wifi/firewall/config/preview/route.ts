import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// ─── Types ───────────────────────────────────────────────────────────

interface DbRule {
  id: string;
  name: string;
  chain: string | null;
  protocol: string | null;
  sourceIp: string | null;
  sourceMac: string | null;
  sourcePort: string | null;
  sourcePortType: string | null;
  destIp: string | null;
  destPort: string | null;
  destPortType: string | null;
  action: string;
  proxyTo: string | null;
  sourceIpType: string | null;
  destIpType: string | null;
  sourceIpResolved: string | null;
  destIpResolved: string | null;
  enabled: boolean;
  comment: string | null;
  priority: number;
}

// ─── Chain Constants ─────────────────────────────────────────────────

type GuiChain = 'firewallchains' | 'firewallchainsdn' | 'firewallchains_conn' | 'firewallchainsdn_conn' | 'frchainspre' | 'frchainspost';

const GUI_CHAINS: GuiChain[] = [
  'firewallchains', 'firewallchainsdn',
  'firewallchains_conn', 'firewallchainsdn_conn',
  'frchainspre', 'frchainspost',
];

const CHAIN_META: Record<GuiChain, { table: string; hook: string; description: string }> = {
  firewallchains: { table: 'inet mangle', hook: 'prerouting', description: 'Uplink Filter — mangle prerouting (guest → internet)' },
  firewallchainsdn: { table: 'inet mangle', hook: 'postrouting', description: 'Downlink Filter — mangle postrouting (internet → guest)' },
  firewallchains_conn: { table: 'inet mangle', hook: 'prerouting', description: 'Connection-Level Marking — mangle prerouting' },
  firewallchainsdn_conn: { table: 'inet mangle', hook: 'postrouting', description: 'Connection-Level Marking — mangle postrouting' },
  frchainspre: { table: 'inet nat', hook: 'prerouting', description: 'NAT Prerouting — DNAT / Port Forward' },
  frchainspost: { table: 'inet nat', hook: 'postrouting', description: 'NAT Postrouting — SNAT / Masquerade / Proxy NAT' },
};

// ─── Multi-Chain Expansion ──────────────────────────────────────────

function getTargetChainsForAction(action: string): GuiChain[] {
  switch (action) {
    case 'accept':
    case 'drop':
    case 'reject':
    case 'log':
      return ['firewallchains', 'firewallchainsdn'];
    case 'proxy':
      return ['firewallchains', 'firewallchainsdn', 'frchainspost'];
    case 'mark':
      return ['firewallchains', 'firewallchainsdn'];
    case 'dnat':
      return ['frchainspre'];
    case 'snat':
    case 'masquerade':
      return ['frchainspost'];
    default:
      return ['firewallchains'];
  }
}

function isDownlinkChain(chain: GuiChain): boolean {
  return chain === 'firewallchainsdn' || chain === 'firewallchainsdn_conn';
}

// ─── Domain Set Name Generation ──────────────────────────────────────

function sanitizeDomainForSet(domain: string): string {
  return domain.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').toLowerCase();
}

function domainSetName(ruleId: string, domain: string): string {
  const sanitized = sanitizeDomainForSet(domain);
  const shortId = ruleId.replace(/-/g, '').substring(0, 8);
  const base = `fwdomain_${sanitized}_${shortId}`;
  return base.length > 31 ? base.substring(0, 31) : base;
}

// ─── Rule Line Builders ──────────────────────────────────────────────

function parseResolvedIps(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildSingleNftRuleLineForChain(
  rule: DbRule,
  targetChain: GuiChain,
): string {
  const parts: string[] = [];
  const downlink = isDownlinkChain(targetChain);
  const isTcpUdp = rule.protocol === 'tcp' || rule.protocol === 'udp';
  const hasPorts = (rule.sourcePort || rule.destPort) && isTcpUdp;

  // Protocol (only when not followed by port match — nftables requires this)
  if (rule.protocol && rule.protocol !== 'all' && !hasPorts) {
    parts.push(rule.protocol);
  }

  const srcIp = rule.sourceIp;
  const dstIp = rule.destIp;

  if (rule.action === 'dnat' && targetChain === 'frchainspre') {
    if (srcIp) parts.push(`ip saddr ${srcIp}`);
    if (rule.destPort && isTcpUdp) parts.push(`${rule.protocol} dport ${rule.destPort}`);
    parts.push('counter');
    if (rule.proxyTo) parts.push(`dnat to ${rule.proxyTo}`);
  } else if ((rule.action === 'masquerade' || rule.action === 'snat') && targetChain === 'frchainspost') {
    if (srcIp) parts.push(`ip saddr ${srcIp}`);
    if (rule.destPort && isTcpUdp) parts.push(`${rule.protocol} dport ${rule.destPort}`);
    parts.push('counter');
    if (rule.action === 'masquerade') parts.push('masquerade');
  } else if (rule.action === 'proxy' && targetChain === 'frchainspost') {
    if (srcIp) parts.push(`ip saddr ${srcIp}`);
    parts.push('counter');
    parts.push('masquerade');
  } else {
    // Mangle filter rules — direction flipping for downlink
    if (srcIp) parts.push(downlink ? `ip daddr ${srcIp}` : `ip saddr ${srcIp}`);
    if (dstIp) parts.push(downlink ? `ip saddr ${dstIp}` : `ip daddr ${dstIp}`);

    if (rule.sourcePort && isTcpUdp) parts.push(`${rule.protocol} sport ${rule.sourcePort}`);
    if (rule.destPort && isTcpUdp) parts.push(`${rule.protocol} dport ${rule.destPort}`);

    parts.push('counter');

    switch (rule.action) {
      case 'accept': case 'drop': case 'reject': case 'log':
        parts.push(rule.action);
        break;
      case 'proxy':
        parts.push('meta mark set 1');
        break;
      case 'mark':
        parts.push('meta mark set 0');
        break;
    }
  }

  const comment = rule.comment
    ? ` comment "gui:${rule.id} ${rule.comment.replace(/"/g, '')}"`
    : ` comment "gui:${rule.id}"`;
  parts.push(comment);

  return parts.join(' ');
}

function buildSetBasedRuleLine(
  rule: DbRule,
  targetChain: GuiChain,
  setName: string,
  setDirection: 'source' | 'dest',
): string {
  const parts: string[] = [];
  const downlink = isDownlinkChain(targetChain);
  const isTcpUdp = rule.protocol === 'tcp' || rule.protocol === 'udp';
  const hasPorts = (rule.sourcePort || rule.destPort) && isTcpUdp;

  if (rule.protocol && rule.protocol !== 'all' && !hasPorts) {
    parts.push(rule.protocol);
  }

  const srcIp = rule.sourceIp;
  const dstIp = rule.destIp;

  if (setDirection === 'dest') {
    if (srcIp) parts.push(downlink ? `ip daddr ${srcIp}` : `ip saddr ${srcIp}`);
    parts.push(downlink ? `ip saddr @${setName}` : `ip daddr @${setName}`);
  } else {
    if (dstIp) parts.push(downlink ? `ip saddr ${dstIp}` : `ip daddr ${dstIp}`);
    parts.push(downlink ? `ip daddr @${setName}` : `ip saddr @${setName}`);
  }

  if (rule.sourcePort && isTcpUdp) parts.push(`${rule.protocol} sport ${rule.sourcePort}`);
  if (rule.destPort && isTcpUdp) parts.push(`${rule.protocol} dport ${rule.destPort}`);

  parts.push('counter');
  switch (rule.action) {
    case 'accept': case 'drop': case 'reject': case 'log':
      parts.push(rule.action);
      break;
    case 'proxy':
      parts.push('meta mark set 1');
      break;
    case 'mark':
      parts.push('meta mark set 0');
      break;
  }

  const comment = rule.comment
    ? ` comment "gui:${rule.id} ${rule.comment.replace(/"/g, '')}"`
    : ` comment "gui:${rule.id}"`;
  parts.push(comment);

  return parts.join(' ');
}

function buildNftRuleLinesForChain(rule: DbRule, targetChain: GuiChain): string[] {
  const destIps = parseResolvedIps(rule.destIpResolved);
  const sourceIps = parseResolvedIps(rule.sourceIpResolved);

  // Domain dest: use set reference
  if (rule.destIpType === 'domain' && destIps.length > 0 && rule.destIp) {
    return [buildSetBasedRuleLine(rule, targetChain, domainSetName(rule.id, rule.destIp), 'dest')];
  }

  // Domain source: use set reference
  if (rule.sourceIpType === 'domain' && sourceIps.length > 0 && rule.sourceIp) {
    return [buildSetBasedRuleLine(rule, targetChain, domainSetName(rule.id, rule.sourceIp), 'source')];
  }

  return [buildSingleNftRuleLineForChain(rule, targetChain)];
}

// ─── GET Handler ─────────────────────────────────────────────────────

// GET /api/wifi/firewall/config/preview — Generate full nftables config preview
export async function GET(request: NextRequest) {
  try {
    // ── Auth ──
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Fetch all enabled rules scoped to tenant
    const rules = await db.firewallRule.findMany({
      where: { enabled: true, tenantId: auth.tenantId },
      orderBy: { priority: 'asc' },
    });

    const portForwards = await db.portForwardRule.findMany({
      where: { enabled: true, tenantId: auth.tenantId },
      orderBy: { externalPort: 'asc' },
    });

    const quickBlocks = await db.quickBlock.findMany({
      where: { enabled: true, tenantId: auth.tenantId },
    });

    // Merge port forwards as DNAT rules
    const allRules: DbRule[] = [
      ...rules.map(r => ({
        id: r.id,
        name: r.name || 'Unnamed',
        chain: r.chain || 'firewallchains',
        protocol: r.protocol || 'all',
        sourceIp: r.sourceIp,
        sourceMac: r.sourceMac,
        sourcePort: r.sourcePort,
        sourcePortType: r.sourcePortType,
        destIp: r.destIp,
        destPort: r.destPort,
        destPortType: r.destPortType,
        action: r.action,
        proxyTo: r.proxyTo,
        sourceIpType: r.sourceIpType,
        destIpType: r.destIpType,
        sourceIpResolved: r.sourceIpResolved,
        destIpResolved: r.destIpResolved,
        enabled: r.enabled,
        comment: r.comment,
        priority: r.priority,
      })),
      ...portForwards.map(pf => ({
        id: pf.id,
        name: pf.name || 'Port Forward',
        chain: 'frchainspre' as const,
        protocol: pf.protocol === 'both' ? 'all' : pf.protocol,
        sourceIp: pf.sourceIp,
        sourceMac: null,
        sourcePort: null,
        sourcePortType: null,
        destIp: null,
        destPort: String(pf.externalPort),
        destPortType: null,
        action: 'dnat' as const,
        proxyTo: `${pf.internalIp}:${pf.internalPort}`,
        sourceIpType: null,
        destIpType: null,
        sourceIpResolved: null,
        destIpResolved: null,
        enabled: pf.enabled,
        comment: pf.description,
        priority: 500,
      })),
    ];

    const sortedRules = allRules.filter(r => r.enabled).sort((a, b) => a.priority - b.priority);

    // Quick block sets
    const blockedIps = quickBlocks.filter(b => b.type === 'ip').map(b => b.value);
    const blockedSubnets = quickBlocks.filter(b => b.type === 'subnet').map(b => b.value);
    const blockedMacs = quickBlocks.filter(b => b.type === 'mac').map(b => b.value);

    // ─── Build config output ─────────────────────────────────────────
    const lines: string[] = [];
    const now = new Date().toISOString();

    lines.push('# ══════════════════════════════════════════════════════════════');
    lines.push('# StaySuite HospitalityOS — Generated nftables Configuration');
    lines.push(`# Generated: ${now}`);
    lines.push(`# Total GUI Rules: ${rules.length} | Port Forwards: ${portForwards.length} | Quick Blocks: ${quickBlocks.length}`);
    lines.push('# Architecture: Multi-chain expansion (matches 24Online behavior)');
    lines.push('# Each GUI rule auto-expands to all applicable chains:');
    lines.push('#   Accept/Drop/Reject/Log/Mark → uplink (firewallchains) + downlink (firewallchainsdn)');
    lines.push('#   Proxy → uplink + downlink + NAT post (masquerade)');
    lines.push('#   DNAT → NAT prerouting (frchainspre)');
    lines.push('#   SNAT/Masquerade → NAT postrouting (frchainspost)');
    lines.push('# ══════════════════════════════════════════════════════════════');
    lines.push('');

    // Helper: render rules for a specific chain
    const renderChainRules = (chainName: GuiChain, headerComment: string): void => {
      const meta = CHAIN_META[chainName];
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
        const ruleLines = buildNftRuleLinesForChain(rule, chainName);

        lines.push(`    # ── [${ruleIndex}] ${rule.name} ──`);
        lines.push(`    # GUI Action: ${rule.action} | Auto-expanded to: ${targetChains.join(', ')}`);
        lines.push(`    # Source: ${rule.sourceIp || '(any)'} → Dest: ${rule.destIp || '(any)'} | Proto: ${rule.protocol}`);
        ruleLines.forEach(l => lines.push(`    ${l}`));
        lines.push('');
      }

      if (ruleIndex === 0) {
        lines.push('    # (no rules for this chain)');
      }
      lines.push('  }');
      lines.push('');
    };

    // ── inet mangle table ──
    lines.push('table inet mangle {');
    lines.push('');
    renderChainRules('firewallchains', 'Uplink Filter — mangle prerouting (guest → internet)');
    renderChainRules('firewallchainsdn', 'Downlink Filter — mangle postrouting (internet → guest)');
    renderChainRules('firewallchains_conn', 'Connection-Level Marking — mangle prerouting');
    renderChainRules('firewallchainsdn_conn', 'Connection-Level Marking — mangle postrouting');
    lines.push('}');

    // ── inet nat table ──
    lines.push('');
    lines.push('table inet nat {');
    lines.push('');
    renderChainRules('frchainspre', 'NAT Prerouting — DNAT / Port Forward');
    renderChainRules('frchainspost', 'NAT Postrouting — SNAT / Masquerade / Proxy NAT');
    lines.push('}');

    // ── Domain sets (24Online-style ipset via nftables named sets) ──
    const domainSets: { setName: string; domain: string; ips: string[]; ruleName: string }[] = [];
    for (const rule of sortedRules) {
      if (rule.destIpType === 'domain' && rule.destIp) {
        const ips = parseResolvedIps(rule.destIpResolved);
        if (ips.length > 0) {
          domainSets.push({ setName: domainSetName(rule.id, rule.destIp), domain: rule.destIp, ips, ruleName: rule.name });
        }
      }
      if (rule.sourceIpType === 'domain' && rule.sourceIp) {
        const ips = parseResolvedIps(rule.sourceIpResolved);
        if (ips.length > 0) {
          domainSets.push({ setName: domainSetName(rule.id, rule.sourceIp), domain: rule.sourceIp, ips, ruleName: rule.name });
        }
      }
    }

    if (domainSets.length > 0 || blockedIps.length > 0 || blockedSubnets.length > 0 || blockedMacs.length > 0) {
      lines.push('');
      lines.push('table inet filter {');
      lines.push('');

      if (domainSets.length > 0) {
        lines.push('  # ── Domain Sets (24Online-style ipset) ──');
        lines.push('  # O(1) hash lookup instead of per-IP rule expansion.');
        lines.push('');
        for (const ds of domainSets) {
          lines.push(`  set ${ds.setName} {`);
          lines.push('    type ipv4_addr');
          lines.push(`    # Domain: ${ds.domain} (rule: ${ds.ruleName}) — ${ds.ips.length} resolved IPs`);
          lines.push(`    elements = { ${ds.ips.join(', ')} }`);
          lines.push('  }');
          lines.push('');
        }
      }

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

    // ── Summary Statistics ──
    const chainCounts: Record<string, number> = {};
    for (const rule of sortedRules) {
      const chains = getTargetChainsForAction(rule.action);
      for (const c of chains) {
        chainCounts[c] = (chainCounts[c] || 0) + 1;
      }
    }

    lines.push('');
    lines.push('# ══════════════════════════════════════════════════════════════');
    lines.push('# RULE EXPANSION SUMMARY');
    lines.push('# ══════════════════════════════════════════════════════════════');
    lines.push(`# GUI Rules (DB): ${rules.length}`);
    lines.push(`# Port Forwards:  ${portForwards.length}`);
    lines.push(`# Quick Blocks:   ${quickBlocks.length}`);
    lines.push(`# Domain Sets:    ${domainSets.length}`);
    lines.push('#');
    lines.push('# Expanded nftables rules per chain:');
    let totalExpanded = 0;
    for (const [chain, count] of Object.entries(chainCounts)) {
      lines.push(`#   ${chain.padEnd(28)} ${count} rules`);
      totalExpanded += count;
    }
    lines.push(`#   ${'TOTAL'.padEnd(28)} ${totalExpanded} expanded rules`);
    lines.push('# ══════════════════════════════════════════════════════════════');

    const config = lines.join('\n');

    return NextResponse.json({
      success: true,
      data: {
        config,
        stats: {
          guiRules: rules.length,
          portForwards: portForwards.length,
          quickBlocks: quickBlocks.length,
          domainSets: domainSets.length,
          expandedRules: totalExpanded,
          chainCounts,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate config preview';
    console.error('[config/preview] Error:', error);
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
