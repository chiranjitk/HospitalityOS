/**
 * Multi-WAN / DGD Shell Script Wrapper
 *
 * Provides typed functions for multi-WAN configuration via scripts/network/multiwan.sh
 * Matches the new schema: Gateway, GatewayHealthRule, GatewayExplicitRoute, GatewayFwmark
 */

import {
  executeScript,
  validateMultiWanMode,
  sanitizeInterfaceName,
  validateIPv4,
  ScriptResult,
} from './executor';

// ─── Types matching 24online DGD architecture ────────────────────────────────

export interface HealthRuleDef {
  protocol: 'PING' | 'TCP' | 'UDP';
  host: string;
  port: number;
  operator: '&' | '|';
  sortOrder: number;
}

export interface ExplicitRouteDef {
  network: string;      // CIDR: 192.168.1.0/24
  description?: string;
}

export interface FwmarkDef {
  fwmarkValue: string;  // hex: 0x1, 0x2
  description?: string;
}

export interface GatewayDef {
  name: string;
  ipAddress: string;
  interfaceName: string;
  interfaceId?: string;
  weight: number;           // ECMP weight (0 = disabled)
  isBackup: boolean;
  backupGatewayId?: string;
  routingTableId: number;   // gw<n>nof table number (101-250), 0 = auto
  enabled: boolean;
  healthRules: HealthRuleDef[];
  explicitRoutes: ExplicitRouteDef[];
  fwmarks: FwmarkDef[];
}

export interface MultiWanDaemonConfig {
  mode: 'weighted' | 'failover' | 'round-robin' | 'ECMP';
  checkInterval: number;     // DGD loop interval (seconds)
  pingCount: number;         // pings per health check
  pingTimeout: number;       // seconds per ping
  tcpTimeout: number;        // seconds for TCP/UDP check
  autoSwitchback: boolean;
  switchbackDelay: number;   // seconds before switching back
  flushConntrackOnFailover: boolean;
}

export interface MultiWanConfig {
  daemon: MultiWanDaemonConfig;
  gateways: GatewayDef[];
}

export interface MultiWanApplyResult {
  mode: string;
  tablesFlushed: number;
  rulesApplied: number;
  gatewaysConfigured: string[];
  table221Updated: boolean;
}

export interface MultiWanResetResult {
  tablesFlushed: number;
  rulesRemoved: number;
  nftablesChainsRemoved: number;
}

// ─── Functions ───────────────────────────────────────────────────────────────

/**
 * Apply multi-WAN / DGD configuration.
 * This generates the dgd.conf files and triggers the DGD service.
 */
export function applyDgdConfig(config: MultiWanConfig): ScriptResult<MultiWanApplyResult> {
  validateConfig(config);
  return executeScript<MultiWanApplyResult>('multiwan.sh', ['apply-dgd', JSON.stringify(config)]);
}

/**
 * Start the DGD daemon service.
 */
export function startDgd(): ScriptResult<{ started: boolean; pid?: number }> {
  return executeScript<{ started: boolean; pid?: number }>('multiwan.sh', ['dgd-start']);
}

/**
 * Stop the DGD daemon service.
 */
export function stopDgd(): ScriptResult<{ stopped: boolean }> {
  return executeScript<{ stopped: boolean }>('multiwan.sh', ['dgd-stop']);
}

/**
 * Get DGD daemon status (running, gateway states).
 */
export function getDgdStatus(): ScriptResult<{
  running: boolean;
  pid?: number;
  uptime?: string;
  gatewayStates: Array<{ interface: string; status: string; lastCheck: string }>;
}> {
  return executeScript('multiwan.sh', ['dgd-status']);
}

/**
 * Reset all multi-WAN configuration.
 * Removes custom routes, rules, nftables chains, and stops DGD.
 */
export function resetMultiWan(): ScriptResult<MultiWanResetResult> {
  return executeScript<MultiWanResetResult>('multiwan.sh', ['reset']);
}

/**
 * Generate dgd.conf configuration files for all gateways.
 * This is what the backend script uses to produce per-gateway .conf files.
 */
export function generateDgdConf(config: MultiWanConfig): ScriptResult<{ configsGenerated: string[] }> {
  validateConfig(config);
  return executeScript<{ configsGenerated: string[] }>('multiwan.sh', ['generate-conf', JSON.stringify(config)]);
}

/**
 * Run a one-time health check against a specific gateway.
 */
export function checkGateway(gateway: GatewayDef): ScriptResult<{
  interface: string;
  reachable: boolean;
  ruleResults: Array<{ protocol: string; host: string; port: number; success: boolean; latency?: number }>;
}> {
  sanitizeInterfaceName(gateway.interfaceName);
  if (gateway.ipAddress) validateIPv4(gateway.ipAddress);
  return executeScript('multiwan.sh', ['check-gateway', JSON.stringify(gateway)]);
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateConfig(config: MultiWanConfig): void {
  if (!config.gateways || config.gateways.length === 0) {
    throw new Error('Multi-WAN config must have at least one gateway.');
  }

  // At least 1 non-backup gateway required
  const activeGws = config.gateways.filter(g => g.enabled && !g.isBackup);
  if (activeGws.length === 0) {
    throw new Error('Multi-WAN config must have at least one active non-backup gateway.');
  }

  for (const gw of config.gateways) {
    if (!gw.enabled) continue;
    sanitizeInterfaceName(gw.interfaceName);
    if (gw.ipAddress) validateIPv4(gw.ipAddress);

    // Validate health rules
    for (const rule of gw.healthRules) {
      if (!rule.host) {
        throw new Error(`Gateway ${gw.interfaceName}: health rule missing host.`);
      }
      if ((rule.protocol === 'TCP' || rule.protocol === 'UDP') && (!rule.port || rule.port < 1)) {
        throw new Error(`Gateway ${gw.interfaceName}: ${rule.protocol} rule missing valid port.`);
      }
    }

    // Validate explicit routes
    for (const route of gw.explicitRoutes) {
      if (!route.network || !route.network.includes('/')) {
        throw new Error(`Gateway ${gw.interfaceName}: explicit route "${route.network}" must be in CIDR format (e.g. 192.168.1.0/24).`);
      }
    }

    // Validate fwmarks
    for (const fw of gw.fwmarks) {
      if (!fw.fwmarkValue.match(/^0x[0-9a-fA-F]+$/)) {
        throw new Error(`Gateway ${gw.interfaceName}: fwmark "${fw.fwmarkValue}" must be hex format (e.g. 0x1).`);
      }
    }
  }
}
