/**
 * Tenant-Scoped Database Client (Feature #18)
 *
 * Returns a Prisma client with tenant isolation extension applied.
 */

import { PrismaClient } from '@prisma/client';
import { createTenantPrismaExtension } from './tenant-isolation';

const clientCache = new Map<string, PrismaClient>();

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
