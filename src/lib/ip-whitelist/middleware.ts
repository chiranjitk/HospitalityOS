/**
 * IP Whitelist Middleware
 *
 * Provides IP access control functions that check a client IP against
 * the tenant's whitelist/blacklist rules stored in IpWhitelistRule.
 */

import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { getClientIp, isIpMatch } from './utils';

/**
 * Check whether IP whitelist enforcement is enabled for a tenant.
 * Reads the ipWhitelistEnabled flag from the tenant's JSON settings blob.
 * When disabled (the default), all IP checks are skipped.
 */
async function isIpEnforcementEnabled(tenantId: string): Promise<boolean> {
  try {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!tenant?.settings) return false;
    const parsed = JSON.parse(tenant.settings);
    // Default to false (disabled) — enforcement must be explicitly enabled
    return parsed.ipWhitelistEnabled === true ||
           parsed.accessControl?.ipWhitelistEnabled === true;
  } catch {
    return false; // fail-open: if settings can't be read, don't enforce
  }
}

export interface IpCheckResult {
  allowed: boolean;
  reason: string;
  matchedRule?: string;
}

/**
 * Check if a client IP is allowed access based on the tenant's IP whitelist/blacklist rules.
 *
 * Logic:
 * 1. If client IP matches ANY enabled blacklist rule → BLOCK
 * 2. If there are enabled whitelist rules AND client IP doesn't match ANY → BLOCK
 * 3. If no whitelist rules exist → ALLOW (whitelist is optional/permissive)
 * 4. Platform admin users always bypass (handled at caller level)
 */
export async function checkIpAccess(
  tenantId: string,
  clientIp: string
): Promise<IpCheckResult> {
  // Fetch all enabled rules for this tenant
  const rules = await db.ipWhitelistRule.findMany({
    where: {
      tenantId,
      isEnabled: true,
    },
    select: {
      id: true,
      type: true,
      ipAddress: true,
      description: true,
    },
  });

  // Step 1: Check blacklist — if IP matches any blacklist rule, block immediately
  const blacklistRules = rules.filter(r => r.type === 'blacklist');
  for (const rule of blacklistRules) {
    if (isIpMatch(clientIp, rule.ipAddress)) {
      return {
        allowed: false,
        reason: `IP address ${clientIp} is blacklisted${rule.description ? `: ${rule.description}` : ''}`,
        matchedRule: rule.id,
      };
    }
  }

  // Step 2: Check whitelist — only enforce if there are whitelist rules
  const whitelistRules = rules.filter(r => r.type === 'whitelist');

  if (whitelistRules.length > 0) {
    for (const rule of whitelistRules) {
      if (isIpMatch(clientIp, rule.ipAddress)) {
        return {
          allowed: true,
          reason: '',
        };
      }
    }

    // Whitelist exists but no rule matched — deny
    return {
      allowed: false,
      reason: `IP address ${clientIp} is not in the allowed whitelist`,
    };
  }

  // Step 3: No whitelist rules — allow (permissive default)
  return {
    allowed: true,
    reason: '',
  };
}

/**
 * Higher-level wrapper that integrates with request context.
 *
 * Returns:
 * - null if IP check is not configured (no rules) or user is platform admin
 * - { allowed: false, reason } if blocked
 * - { allowed: true, reason: '' } if allowed
 */
export async function withIpWhitelist(
  request: NextRequest,
  context: { tenantId: string; isPlatformAdmin: boolean }
): Promise<{ allowed: boolean; reason: string } | null> {
  // Platform admins always bypass IP checks
  if (context.isPlatformAdmin) {
    return null;
  }

  // Respect the ipWhitelistEnabled tenant setting (default: disabled)
  const enforcementEnabled = await isIpEnforcementEnabled(context.tenantId);
  if (!enforcementEnabled) {
    return null;
  }

  // Quick check: are there any enabled rules at all?
  const ruleCount = await db.ipWhitelistRule.count({
    where: {
      tenantId: context.tenantId,
      isEnabled: true,
    },
  });

  // No rules configured — skip IP check entirely
  if (ruleCount === 0) {
    return null;
  }

  const clientIp = getClientIp(request);
  const result = await checkIpAccess(context.tenantId, clientIp);

  return {
    allowed: result.allowed,
    reason: result.reason,
  };
}
