/**
 * @module dns-resolver
 *
 * DNS Resolution Utility for Firewall Rule Processing
 *
 * nftables supports only raw IPs/CIDRs — not domain names. This library
 * resolves domains to IPs at save-time so firewall rules can reference
 * domains in the GUI but generate valid nftables rules with resolved IPs.
 *
 * Key principles:
 * - Never throws — all DNS failures are caught and return empty arrays
 * - 5-second timeout per domain resolution
 * - Max 8 IPs returned per domain
 * - All functions are async-safe and suitable for API route usage
 */

import dns from 'node:dns';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of IPv4 addresses returned per domain resolution */
const MAX_IPS_PER_DOMAIN = 8;

/** DNS resolution timeout in milliseconds */
const DNS_TIMEOUT_MS = 5_000;

// ─── Type Detection ───────────────────────────────────────────────────────────

/**
 * IPv4 address regex pattern.
 * Matches formats like 192.168.1.1, 10.0.0.1, etc.
 * Does NOT validate octet ranges (0-255) — that is handled by dns.resolve4
 * if needed, but for nftables purposes the regex match is sufficient.
 */
const IPV4_REGEX = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * CIDR notation regex pattern.
 * Matches formats like 192.168.1.0/24, 10.0.0.0/8, etc.
 */
const CIDR_REGEX = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/;

/**
 * Check if a string is a valid IPv4 address.
 *
 * Uses a simple regex pattern to match the dotted-quad format.
 * Note: This does not validate that each octet is 0-255, as nftables
 * itself will reject invalid addresses during rule insertion.
 *
 * @param val - The string to test
 * @returns `true` if the string matches IPv4 format
 *
 * @example
 * ```ts
 * isIpAddress('192.168.1.1');     // true
 * isIpAddress('10.0.0.1');         // true
 * isIpAddress('example.com');      // false
 * isIpAddress('192.168.1.0/24');   // false
 * ```
 */
export function isIpAddress(val: string): boolean {
  return IPV4_REGEX.test(val);
}

/**
 * Check if a string is CIDR notation.
 *
 * Matches the standard IPv4/CIDR format: four octets followed by
 * a slash and a prefix length (e.g., 192.168.1.0/24).
 *
 * @param val - The string to test
 * @returns `true` if the string matches CIDR notation format
 *
 * @example
 * ```ts
 * isCidr('192.168.1.0/24');   // true
 * isCidr('10.0.0.0/8');       // true
 * isCidr('192.168.1.1');      // false
 * isCidr('example.com');      // false
 * ```
 */
export function isCidr(val: string): boolean {
  return CIDR_REGEX.test(val);
}

/**
 * Check if a string looks like a domain name.
 *
 * A domain is identified by:
 * - Containing at least one lowercase letter
 * - Containing at least one dot
 *
 * This is a heuristic check, not a strict RFC-compliant domain validation.
 * It is designed to distinguish domain names from IP addresses and CIDRs
 * in the context of firewall rule source/destination fields.
 *
 * @param val - The string to test
 * @returns `true` if the string appears to be a domain name
 *
 * @example
 * ```ts
 * isDomain('example.com');        // true
 * isDomain('sub.domain.org');     // true
 * isDomain('192.168.1.1');        // false (no lowercase alpha chars beyond dots)
 * isDomain('*');                  // false
 * ```
 */
export function isDomain(val: string): boolean {
  return /[a-z]/.test(val) && val.includes('.');
}

/**
 * Auto-detect the type of an IP address / domain / CIDR string.
 *
 * Detection priority:
 * 1. `null` / `undefined` / empty / `*` / `any` → returns `null` (wildcard)
 * 2. CIDR notation (contains `/`) → returns `'cidr'`
 * 3. Pure IPv4 address (dotted quad) → returns `'ip'`
 * 4. Domain name (contains letters and dots) → returns `'domain'`
 * 5. Unrecognized format → returns `null`
 *
 * @param val - The value to classify
 * @returns The detected type, or `null` for wildcards / unrecognized values
 *
 * @example
 * ```ts
 * detectIpType('192.168.1.1');      // 'ip'
 * detectIpType('192.168.1.0/24');   // 'cidr'
 * detectIpType('example.com');      // 'domain'
 * detectIpType('*');                // null
 * detectIpType(null);               // null
 * detectIpType('');                 // null
 * detectIpType('any');              // null
 * ```
 */
export function detectIpType(val: string | null): 'ip' | 'cidr' | 'domain' | null {
  if (!val || val === '*' || val === 'any') {
    return null;
  }

  if (val.includes('/')) {
    return isCidr(val) ? 'cidr' : null;
  }

  if (isIpAddress(val)) {
    return 'ip';
  }

  if (isDomain(val)) {
    return 'domain';
  }

  return null;
}

// ─── DNS Resolution ───────────────────────────────────────────────────────────

/**
 * Resolve a domain name to its IPv4 addresses using Node.js `dns.resolve4()`.
 *
 * Features:
 * - 5-second timeout per resolution attempt
 * - Returns up to 8 IPv4 addresses
 * - Never throws — catches all DNS errors and returns an empty array
 *
 * @param domain - The domain name to resolve (e.g., `"example.com"`)
 * @returns Array of IPv4 address strings. Empty on failure or timeout.
 *
 * @example
 * ```ts
 * const ips = await resolveDomain('google.com');
 * // ['142.250.80.46', '2607:f8b0:4004:800::200e' filtered out → only IPv4]
 * // Actually: ['142.250.80.46', '142.250.80.78', ...]  (up to 8 IPv4)
 *
 * const failed = await resolveDomain('nonexistent.invalid');
 * // [] (DNS failure → empty array, no error thrown)
 * ```
 */
export function resolveDomain(domain: string): Promise<string[]> {
  return new Promise<string[]>((resolve) => {
    // Safety: ensure we only attempt DNS on things that look like domains
    if (!domain || !isDomain(domain)) {
      resolve([]);
      return;
    }

    // Set up timeout
    const timer = setTimeout(() => {
      resolve([]);
    }, DNS_TIMEOUT_MS);

    dns.resolve4(domain, (err, addresses) => {
      clearTimeout(timer);

      if (err) {
        // Log the failure for debugging but don't propagate the error
        console.warn(`[dns-resolver] Failed to resolve "${domain}":`, err.message);
        resolve([]);
        return;
      }

      if (!addresses || addresses.length === 0) {
        resolve([]);
        return;
      }

      // Return up to MAX_IPS_PER_DOMAIN addresses
      resolve(addresses.slice(0, MAX_IPS_PER_DOMAIN));
    });
  });
}

/**
 * Resolve a value if it is a domain name; otherwise return its detected type.
 *
 * This is a convenience function for API routes that need to handle
 * a single source or destination IP field. It resolves the domain
 * only when the value is detected as a domain type.
 *
 * @param val - The IP, CIDR, or domain string (may be `null`)
 * @returns An object with:
 *   - `type` — The detected type string (`'ip'`, `'cidr'`, `'domain'`, or `'wildcard'`)
 *   - `resolved` — Array of resolved IPv4 addresses (non-empty only for domains)
 *
 * @example
 * ```ts
 * // IP address — no resolution needed
 * await resolveIfDomain('192.168.1.1');
 * // { type: 'ip', resolved: [] }
 *
 * // Domain — resolves to IPs
 * await resolveIfDomain('example.com');
 * // { type: 'domain', resolved: ['93.184.216.34'] }
 *
 * // Wildcard — no resolution
 * await resolveIfDomain('*');
 * // { type: 'wildcard', resolved: [] }
 * ```
 */
export async function resolveIfDomain(
  val: string | null
): Promise<{ type: string; resolved: string[] }> {
  const detectedType = detectIpType(val);

  if (detectedType === 'domain' && val) {
    const resolved = await resolveDomain(val);
    return { type: 'domain', resolved };
  }

  if (detectedType === null) {
    return { type: 'wildcard', resolved: [] };
  }

  return { type: detectedType, resolved: [] };
}

// ─── Rule-Level Resolution ────────────────────────────────────────────────────

/**
 * Resolve both source and destination IPs in a firewall rule if they are domains.
 *
 * This is the main function called by API routes when saving or applying
 * firewall rules. It handles the complete resolution pipeline:
 *
 * 1. Detects the type of each address field (sourceIp, destIp)
 * 2. Resolves any domains to IPv4 addresses
 * 3. Collects DNS warnings for any failed resolutions
 *
 * The returned data allows the caller to:
 * - Store the original domain string in the database for the GUI
 * - Generate nftables rules using the resolved IP addresses
 * - Display warnings to the user if DNS resolution failed
 *
 * @param rule - An object with optional `sourceIp` and `destIp` fields
 * @returns An object with:
 *   - `sourceIpType` — Detected type of sourceIp
 *   - `destIpType` — Detected type of destIp
 *   - `sourceIpResolved` — Resolved IPv4 addresses for sourceIp (empty if not a domain)
 *   - `destIpResolved` — Resolved IPv4 addresses for destIp (empty if not a domain)
 *   - `dnsWarnings` — Array of warning messages for failed DNS resolutions
 *
 * @example
 * ```ts
 * const result = await resolveRuleAddresses({
 *   sourceIp: '192.168.1.0/24',
 *   destIp: 'api.example.com',
 * });
 * // {
 * //   sourceIpType: 'cidr',
 * //   destIpType: 'domain',
 * //   sourceIpResolved: [],
 * //   destIpResolved: ['93.184.216.34'],
 * //   dnsWarnings: [],
 * // }
 *
 * // With a failed resolution:
 * const result2 = await resolveRuleAddresses({
 *   sourceIp: '*',
 *   destIp: 'nonexistent.invalid',
 * });
 * // {
 * //   sourceIpType: 'wildcard',
 * //   destIpType: 'domain',
 * //   sourceIpResolved: [],
 * //   destIpResolved: [],
 * //   dnsWarnings: ['DNS resolution failed for "nonexistent.invalid": no results'],
 * // }
 * ```
 */
export async function resolveRuleAddresses(rule: {
  sourceIp?: string;
  destIp?: string;
}): Promise<{
  sourceIpType: string;
  destIpType: string;
  sourceIpResolved: string[];
  destIpResolved: string[];
  dnsWarnings: string[];
}> {
  const dnsWarnings: string[] = [];

  // Resolve source IP if it's a domain
  const sourceResult = await resolveIfDomain(rule.sourceIp ?? null);
  if (sourceResult.type === 'domain' && sourceResult.resolved.length === 0 && rule.sourceIp) {
    dnsWarnings.push(
      `DNS resolution failed for "${rule.sourceIp}": no results`
    );
  }

  // Resolve destination IP if it's a domain
  const destResult = await resolveIfDomain(rule.destIp ?? null);
  if (destResult.type === 'domain' && destResult.resolved.length === 0 && rule.destIp) {
    dnsWarnings.push(
      `DNS resolution failed for "${rule.destIp}": no results`
    );
  }

  return {
    sourceIpType: sourceResult.type,
    destIpType: destResult.type,
    sourceIpResolved: sourceResult.resolved,
    destIpResolved: destResult.resolved,
    dnsWarnings,
  };
}
