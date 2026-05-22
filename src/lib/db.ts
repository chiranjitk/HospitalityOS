import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs';
import { join } from 'path';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Resolve the DATABASE_URL directly from the .env file to avoid
 * sandbox/system-level environment variable overrides (e.g. SQLite URLs
 * set by the sandbox environment).
 *
 * In production, we trust process.env. In development, we read .env
 * explicitly and force the PostgreSQL URL.
 */
function resolveDatabaseUrl(): string {
  if (isProduction && process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Try to read from .env file directly
  try {
    const envPath = join(process.cwd(), '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    const match = envContent.match(/^DATABASE_URL=(.+)$/m);
    if (match?.[1]) {
      const url = match[1].trim();
      // Only use if it's a PostgreSQL URL (not SQLite)
      if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
        return url;
      }
    }
  } catch {
    // .env file not readable, fall through
  }

  // Fallback to process.env
  return process.env.DATABASE_URL || '';
}

const databaseUrl = resolveDatabaseUrl();

const createPrismaClient = () => {
  return new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: { url: databaseUrl || process.env.DATABASE_URL },
    },
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
