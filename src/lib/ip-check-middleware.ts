/**
 * IP Check Middleware Helper
 *
 * General-purpose IP access control middleware that wraps the existing
 * `withIpWhitelist` from `@/lib/ip-whitelist/middleware`.
 *
 * Can be used in any API route to enforce tenant-level IP restrictions.
 */

import { NextRequest } from 'next/server';
import { withIpWhitelist } from '@/lib/ip-whitelist/middleware';

interface IpAccessCheckResult {
  allowed: boolean;
  reason: string;
}

/**
 * Require IP access for a given request and tenant context.
 *
 * Returns:
 * - `null` if IP check is not applicable (no rules configured or platform admin)
 * - `{ allowed: false, reason }` if the request should be blocked
 * - `{ allowed: true, reason: '' }` if the request is allowed
 *
 * @example
 * ```ts
 * const ipCheck = await requireIpAccess(request, user.tenantId, user.isPlatformAdmin);
 * if (ipCheck && !ipCheck.allowed) {
 *   return NextResponse.json({ error: ipCheck.reason }, { status: 403 });
 * }
 * ```
 */
export async function requireIpAccess(
  request: NextRequest,
  tenantId: string,
  isPlatformAdmin: boolean
): Promise<IpAccessCheckResult | null> {
  return withIpWhitelist(request, { tenantId, isPlatformAdmin });
}

const ipCheckMiddleware = { requireIpAccess };
export default ipCheckMiddleware;
