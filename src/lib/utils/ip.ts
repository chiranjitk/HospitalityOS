/**
 * Shared IP address utility functions.
 *
 * On dual-stack Linux (Rocky, RHEL, CentOS), Node.js and the kernel represent
 * ALL IPv4 addresses using IPv6-mapped format: "::ffff:10.10.10.198".
 * This is NOT the end user's actual IP format — it's a presentation-layer
 * artifact from the OS network stack.
 *
 * Use normalizeIPv4() everywhere an IP is read from HTTP headers
 * (X-Forwarded-For, X-Real-IP) or from socket.remoteAddress, before
 * storing it in the database or passing it to nft/tc commands.
 */

/**
 * Normalize an IP address to plain IPv4.
 *
 * Strips:
 *   ::ffff:10.10.10.198  →  10.10.10.198
 *   [::ffff:10.10.10.198] →  10.10.10.198
 *
 * Returns the original string if it's already plain IPv4, or empty string
 * if input is falsy.
 */
export function normalizeIPv4(ip: string | null | undefined): string {
  if (!ip) return '';
  let clean = ip.trim();
  // Strip surrounding brackets (e.g. [::ffff:10.0.0.1] from headers)
  if (clean.startsWith('[') && clean.includes(']')) {
    clean = clean.slice(1, clean.indexOf(']'));
  }
  // Strip IPv6-mapped IPv4 prefix
  const v4Match = clean.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4Match) return v4Match[1];
  return clean;
}

/**
 * Extract client IP from Next.js request headers.
 *
 * Priority:
 *   1. X-Forwarded-For (first IP in chain)
 *   2. X-Real-IP
 *   3. empty string
 *
 * The result is NOT normalized — call normalizeIPv4() on the result.
 */
export function extractClientIp(request: { headers: { get(name: string): string | null } }): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const firstIp = xff.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();
  return '';
}

/**
 * Extract and normalize the client IP from request headers.
 * Returns plain IPv4 (e.g. "10.10.10.198") or empty string.
 */
export function getClientIp(request: { headers: { get(name: string): string | null } }): string {
  return normalizeIPv4(extractClientIp(request));
}
