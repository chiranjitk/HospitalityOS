import { PrismaClient } from '@prisma/client'

const isProduction = process.env.NODE_ENV === 'production';

const createPrismaClient = () => {
  return new PrismaClient({
    log: ['error', 'warn'],
    ...(isProduction ? {
      datasources: process.env.DATABASE_URL_UNPOOLED ? {
        db: { url: process.env.DATABASE_URL_UNPOOLED }
      } : undefined,
    } : {}),
  })
}

/**
 * Use globalThis to persist PrismaClient across HMR reloads in development.
 * Without this, every file save creates a new PrismaClient + connection pool,
 * leaking 50MB+ per reload. This is the officially recommended pattern:
 * https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export type { PrismaClient as PrismaClientType } from '@prisma/client'

// Re-export tenant isolation utilities for convenient access alongside db
export { withTenantScope, tenantScopedWhere } from '@/lib/db-tenant-middleware'
export type { TenantScopeOptions } from '@/lib/db-tenant-middleware'
