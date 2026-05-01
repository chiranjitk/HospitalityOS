import { PrismaClient } from '@prisma/client'

const isProduction = process.env.NODE_ENV === 'production';

const createPrismaClient = () => {
  const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!databaseUrl) {
    console.error('[DB] FATAL: DATABASE_URL environment variable is not set');
  }
  return new PrismaClient({
    log: ['error', 'warn'],
    ...(databaseUrl ? {
      datasources: {
        db: { url: databaseUrl }
      }
    } : {}),
  })
}

let prismaClient: PrismaClient | undefined = undefined
let prismaInitialized = false

export const db = (() => {
  if (!prismaClient) {
    prismaClient = createPrismaClient()
    if (!isProduction) {
      console.log('[DB] PrismaClient initialized (development mode with query logging)')
    } else {
      console.log('[DB] PrismaClient initialized (production mode)')
    }

    if (!prismaInitialized) {
      prismaInitialized = true
    }
  }
  return prismaClient
})()

export type { PrismaClient as PrismaClientType } from '@prisma/client'

// Re-export tenant isolation utilities for convenient access alongside db
export { withTenantScope, tenantScopedWhere } from '@/lib/db-tenant-middleware'
export type { TenantScopeOptions } from '@/lib/db-tenant-middleware'
