/**
 * Tenant-Scoped Database Client (Feature #18)
 *
 * Returns a Prisma client with tenant isolation extension applied.
 * Uses globalThis to persist the cache across HMR reloads in development.
 */

import { PrismaClient } from '@prisma/client';
import { createTenantPrismaExtension } from './tenant-isolation';

/**
 * Persist clientCache across HMR reloads.
 * Without this, every file save creates new PrismaClient instances per tenant,
 * each opening its own connection pool that never gets closed.
 */
const globalForTenantCache = globalThis as unknown as {
  tenantClientCache: Map<string, PrismaClient>
}

if (!globalForTenantCache.tenantClientCache) {
  globalForTenantCache.tenantClientCache = new Map<string, PrismaClient>()
}

const clientCache = globalForTenantCache.tenantClientCache

export function getTenantDb(tenantId: string): PrismaClient {
  const cached = clientCache.get(tenantId);
  if (cached) return cached;

  const client = new PrismaClient().$extends(createTenantPrismaExtension(tenantId));
  clientCache.set(tenantId, client);
  return client;
}

/**
 * Clear cached tenant DB client (useful after tenant config changes)
 */
export function clearTenantDbCache(tenantId?: string): void {
  if (tenantId) {
    const client = clientCache.get(tenantId);
    if (client) client.$disconnect();
    clientCache.delete(tenantId);
  } else {
    for (const [key, client] of clientCache.entries()) {
      client.$disconnect();
      clientCache.delete(key);
    }
  }
}
