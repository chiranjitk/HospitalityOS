/**
 * Tenant Resolution from Subdomain (Feature #16)
 *
 * Resolves tenant from request hostname using the Tenant.slug field.
 * Includes in-memory caching with 5-minute TTL.
 */

import { NextRequest } from 'next/server';
import { db } from './db';
import { logger } from './logger';

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
}

// In-memory cache
const cache = new Map<string, { data: TenantInfo; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Hostnames to skip (no tenant resolution)
const SKIP_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'admin', 'staging', 'dev', 'test', 'localhost',
  'preview', 'demo', 'docs', 'status', 'mail', 'cdn', 'static', 'assets',
]);

function cleanCache() {
  const now = Date.now();
  for (const [key, val] of cache.entries()) {
    if (val.expiresAt < now) cache.delete(key);
  }
}

/**
 * Resolve tenant from a hostname string (usable outside of request context).
 *
 * @param hostname - The hostname to extract subdomain from (e.g., "myhotel.staysuite.com")
 * @returns Tenant info or null if not found
 */
export async function resolveTenantFromHostname(hostname: string): Promise<{
  tenantId: string;
  slug: string;
  name: string;
} | null> {
  const subdomain = extractSubdomain(hostname);
  if (!subdomain) return null;

  // Check cache
  cleanCache();
  const cached = cache.get(subdomain);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      tenantId: cached.data.id,
      slug: cached.data.slug,
      name: cached.data.name,
    };
  }

  // Look up tenant by slug
  try {
    const tenant = await db.tenant.findFirst({
      where: {
        slug: subdomain,
        status: { not: 'suspended' },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!tenant) return null;

    const info: TenantInfo = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: 'active',
      plan: '',
    };

    // Cache result
    cache.set(subdomain, { data: info, expiresAt: Date.now() + CACHE_TTL_MS });

    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
    };
  } catch (error) {
    logger.error('Failed to resolve tenant from hostname', error instanceof Error ? error : new Error(String(error)), { hostname });
    return null;
  }
}

export function extractSubdomain(hostname: string): string | null {
  if (!hostname) return null;

  // Skip IP addresses
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return null;
  if (hostname === 'localhost' || hostname === '[::1]') return null;

  const parts = hostname.split('.');
  if (parts.length < 2) return null;

  // For staysuite.com, subdomain is the first part
  // For custom domains, the entire hostname might be a tenant slug
  const subdomain = parts[0].toLowerCase();
  if (SKIP_SUBDOMAINS.has(subdomain)) return null;

  return subdomain;
}

export async function resolveTenantFromRequest(request: NextRequest): Promise<TenantInfo | null> {
  const hostname = request.headers.get('host') || request.nextUrl.hostname;
  const subdomain = extractSubdomain(hostname);
  if (!subdomain) return null;

  // Check cache
  cleanCache();
  const cached = cache.get(subdomain);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Look up tenant by slug
  try {
    const tenant = await db.tenant.findFirst({
      where: {
        slug: subdomain,
        status: { not: 'suspended' },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        plan: true,
      },
    });

    if (!tenant) return null;

    const info: TenantInfo = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      plan: tenant.plan,
    };

    // Cache result
    cache.set(subdomain, { data: info, expiresAt: Date.now() + CACHE_TTL_MS });

    logger.debug('Tenant resolved from subdomain', { subdomain, tenantId: info.id });
    return info;
  } catch (error) {
    logger.error('Failed to resolve tenant from subdomain', error instanceof Error ? error : new Error(String(error)), { subdomain });
    return null;
  }
}
