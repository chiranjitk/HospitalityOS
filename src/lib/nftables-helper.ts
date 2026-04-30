/**
 * nftables Service Integration Helper
 *
 * Provides a typed client for the nftables mini-service (port 3013)
 * which manages guest firewall rules, port forwards, rate limits,
 * quick blocks, schedules, and presets.
 *
 * Key principle: nftables application is non-blocking and non-fatal.
 * The DB write must succeed regardless of whether nftables is available.
 * Errors are logged but never propagated to the API consumer.
 *
 * @module nftables-helper
 * @see mini-services/nftables-service/index.ts — the service implementation
 */

// ─── Service URL ─────────────────────────────────────────────────────────────

const NFTABLES_SERVICE_URL =
  process.env.NFTABLES_SERVICE_URL || 'http://127.0.0.1:3013';

// ─── GUI Chain Constants ─────────────────────────────────────────────────────

/**
 * The 6 GUI-controlled nftables chains used by the production firewall.
 *
 * These are organised into two nftables tables:
 * - **inet mangle** — packet marking / filtering (uplink & downlink)
 * - **inet nat** — DNAT prerouting & SNAT postrouting
 */
export const GUI_CHAINS = {
  MANGLE: {
    /** Uplink filter — filter outbound guest traffic */
    FIREWALL_CHAINS: 'firewallchains',
    /** Downlink filter — filter inbound guest traffic */
    FIREWALL_CHAINS_DN: 'firewallchainsdn',
    /** Connection marking for logged-in users (uplink) */
    FIREWALL_CHAINS_CONN: 'firewallchains_conn',
    /** Connection marking for logged-in users (downlink) */
    FIREWALL_CHAINS_DN_CONN: 'firewallchainsdn_conn',
  },
  NAT: {
    /** NAT prerouting — DNAT / Port Forward rules */
    FRCHAINS_PRE: 'frchainspre',
    /** NAT postrouting — SNAT / Masquerade rules */
    FRCHAINS_POST: 'frchainspost',
  },
} as const;

/** Flat list of all 6 GUI chain names. */
export const ALL_GUI_CHAINS = [
  'firewallchains',
  'firewallchainsdn',
  'firewallchains_conn',
  'firewallchainsdn_conn',
  'frchainspre',
  'frchainspost',
] as const;

/** Type representing any of the 6 GUI chain names. */
export type GuiChain = (typeof ALL_GUI_CHAINS)[number];

// ─── Chain Metadata ──────────────────────────────────────────────────────────

/**
 * Metadata for each GUI chain: which nftables table it belongs to,
 * which netfilter hook it is attached to, and a human-readable label.
 */
export const CHAIN_META: Record<
  GuiChain,
  {
    table: 'inet mangle' | 'inet nat';
    hook: 'prerouting' | 'postrouting';
    description: string;
    label: string;
  }
> = {
  firewallchains: {
    table: 'inet mangle',
    hook: 'prerouting',
    description: 'Uplink filter - filter outbound guest traffic',
    label: 'Uplink Filter',
  },
  firewallchainsdn: {
    table: 'inet mangle',
    hook: 'postrouting',
    description: 'Downlink filter - filter inbound guest traffic',
    label: 'Downlink Filter',
  },
  firewallchains_conn: {
    table: 'inet mangle',
    hook: 'prerouting',
    description: 'Connection-level marking for logged-in users',
    label: 'Connection Mark (Up)',
  },
  firewallchainsdn_conn: {
    table: 'inet mangle',
    hook: 'postrouting',
    description: 'Connection-level marking for logged-in users',
    label: 'Connection Mark (Dn)',
  },
  frchainspre: {
    table: 'inet nat',
    hook: 'prerouting',
    description: 'NAT prerouting - DNAT / Port Forward rules',
    label: 'NAT Prerouting',
  },
  frchainspost: {
    table: 'inet nat',
    hook: 'postrouting',
    description: 'NAT postrouting - SNAT / Masquerade rules',
    label: 'NAT Postrouting',
  },
};

// ─── Security Hooks ──────────────────────────────────────────────────────────

/**
 * Security hooks inserted into the `inet security` table.
 * These run at very low priorities (negative numbers) so they evaluate
 * before any GUI-controlled chains.
 */
export const SECURITY_HOOKS = [
  { chain: 'syn_flood', table: 'inet security', priority: -300, description: 'SYN flood protection' },
  { chain: 'invalid_packets', table: 'inet security', priority: -299, description: 'Drop invalid packets (log-only)' },
  { chain: 'port_scan', table: 'inet security', priority: -160, description: 'Port scan detection' },
  { chain: 'ssh_protection', table: 'inet security', priority: -155, description: 'SSH brute-force protection' },
  { chain: 'dns_protection', table: 'inet security', priority: -150, description: 'DNS amplification protection' },
  { chain: 'icmp_limit', table: 'inet security', priority: -140, description: 'ICMP rate limiting' },
] as const;

// ─── nftables Named Sets ─────────────────────────────────────────────────────

/**
 * Named sets maintained by the service (or the RADIUS session manager).
 * These are referenced by rules using `@setname` syntax.
 */
export const NFTABLES_SETS = [
  { name: 'loggedinusers', type: 'ipv4_addr', description: 'Currently logged-in user IPs' },
  { name: 'usersset', type: 'ipv4_addr', description: 'Per-user destination IP set' },
  { name: 'usersdstset', type: 'ipv4_addr . ipv4_addr', description: 'User destination mapping' },
  { name: 'llusersset', type: 'ipv4_addr', description: 'Low-latency users' },
  { name: 'blocked_ips', type: 'ipv4_addr', description: 'Blocked IP addresses' },
  { name: 'blocked_networks', type: 'ipv4_addr', flags: 'interval', description: 'Blocked network ranges' },
  { name: 'blocked_mac', type: 'ether_addr', description: 'Blocked MAC addresses' },
] as const;

// ─── Fire-and-Forget Helper ──────────────────────────────────────────────────

/**
 * Send a request to the nftables service and discard the response.
 *
 * This is the "best-effort" primitive — ideal for trigger-style calls
 * (e.g. apply, flush) where the caller does not need to inspect the result.
 * Errors are logged to console but never thrown.
 *
 * @param path  - API path, e.g. `/api/apply`
 * @param method - HTTP method (GET, POST, PUT, DELETE, PATCH)
 * @param body  - Optional JSON body
 */
export async function applyToNftables(
  path: string,
  method: string,
  body?: Record<string, unknown>
): Promise<void> {
  try {
    const response = await fetch(`${NFTABLES_SERVICE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(
        `[nftables] apply failed: ${response.status} ${response.statusText}`,
        text
      );
    }
  } catch (error) {
    console.error('[nftables] service unreachable:', error);
    // Non-fatal: DB writes succeed even if nftables is down
  }
}

/**
 * Send a request to the nftables service and return the parsed result.
 *
 * Use this when the caller needs to inspect the response payload
 * (e.g. list queries, config preview, status checks).
 *
 * @param path   - API path, e.g. `/api/gui-rules`
 * @param method - HTTP method (defaults to POST)
 * @param body   - Optional JSON body
 * @returns Object with `success`, optional `data`, and optional `error`
 */
export async function applyToNftablesWithResult(
  path: string,
  method: string = 'POST',
  body?: unknown
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    const response = await fetch(`${NFTABLES_SERVICE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const errorMsg =
        typeof json === 'object' && json !== null && 'error' in json
          ? String((json as Record<string, unknown>).error)
          : await response.text().catch(() => `HTTP ${response.status}`);
      console.error(`[nftables] apply failed: ${response.status}`, errorMsg);
      return { success: false, error: errorMsg };
    }
    return { success: true, data: json };
  } catch (error) {
    console.error('[nftables] service unreachable:', error);
    return { success: false, error: String(error) };
  }
}

// ─── Legacy Utility ──────────────────────────────────────────────────────────

/**
 * Map a DB MAC-filter listType to the corresponding nftables set name.
 *
 * @param listType - `"whitelist"` or `"blacklist"`
 * @returns The nftables named set for the MAC list
 *
 * @deprecated The new service uses `blocked_mac` / quick-blocks instead
 *             of separate whitelist/blacklist sets. Kept for backward compat.
 */
export function macListTypeToSet(
  listType: string
): 'mac_whitelist' | 'mac_blacklist' {
  return listType === 'whitelist' ? 'mac_whitelist' : 'mac_blacklist';
}

// ─── Full Apply ──────────────────────────────────────────────────────────────

/**
 * Trigger a full config regeneration and apply on the nftables service.
 *
 * The v2 service stores its own rule data in JSON files. This function
 * simply calls `POST /api/apply` which tells the service to re-read its
 * stored rules and regenerate + apply the complete nftables config.
 *
 * **Non-fatal** — errors are logged but never thrown, so callers can
 * safely invoke this after any rule change without try/catch.
 *
 * @param _tenantId - Optional tenant identifier (unused, kept for backward compat)
 *
 * @example
 * ```ts
 * // After creating/updating/deleting a GUI rule:
 * await fullApplyToNftables();
 * // Legacy call site (still works, arg is ignored):
 * await fullApplyToNftables(user.tenantId);
 * ```
 */
export async function fullApplyToNftables(_tenantId?: string): Promise<void> {
  try {
    await applyToNftables('/api/apply', 'POST');
  } catch (error) {
    console.error('[nftables] full apply failed:', error);
    // Non-fatal
  }
}

/**
 * Build the firewall config from the database and trigger a full apply.
 *
 * In the v2 service architecture the service manages its own JSON-based
 * data store. This function is a **compatibility shim** — it no longer
 * queries the Prisma DB for zone/rules/bandwidth data. Instead it
 * delegates entirely to the service's `/api/apply` endpoint which
 * regenerates the nftables config from the service's own stored rules.
 *
 * The `tenantId` parameter is accepted for API backward compatibility
 * but is not used by the v2 service (which is single-tenant in this
 * deployment).
 *
 * @param _tenantId - Tenant identifier (unused, kept for backward compat)
 *
 * @deprecated Use `fullApplyToNftables()` instead — the v2 service
 *             manages its own data and does not need a DB-built config.
 */
export async function buildFirewallConfigFromDb(
  _tenantId: string
): Promise<void> {
  // v2 service stores its own rules in JSON files.
  // Simply trigger a full apply so the service regenerates config
  // from its own data store.
  await fullApplyToNftables();
}
