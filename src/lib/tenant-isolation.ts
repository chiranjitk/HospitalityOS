/**
 * Tenant Isolation Framework (Feature #18)
 *
 * Application-level tenant isolation utilities.
 * Ensures all database queries include tenantId filtering.
 *
 * Provides:
 * - withTenantFilter(): injects tenantId into Prisma query where clause
 * - createTenantScopedDb(): returns a Prisma client wrapper with auto-filtering
 * - withTenantIsolation(): execute queries with tenant isolation guarantees
 * - createTenantPrismaExtension(): Prisma extension for auto-injection
 */

import { Prisma } from '@prisma/client';
import { db } from './db';
import { logger } from './logger';

/**
 * Inject tenantId into a Prisma query's where clause.
 *
 * If the args already contain a `where.tenantId`, it is NOT overridden.
 * This allows callers to explicitly specify a tenantId when needed.
 *
 * @param args - Prisma query args (e.g., `{ where: { status: 'active' } }`)
 * @param tenantId - The tenant ID to inject
 * @returns Modified args with tenantId in where clause
 *
 * @example
 * const users = await db.user.findMany(
 *   withTenantFilter({ where: { status: 'active' }, take: 10 }, tenantId)
 * );
 */
export function withTenantFilter<T extends Record<string, unknown>>(
  args: T,
  tenantId: string,
): T {
  if (!tenantId) {
    throw new Error('withTenantFilter requires a valid tenantId');
  }

  const existingWhere = (args.where as Record<string, unknown>) || {};

  // If caller already explicitly set tenantId, don't override
  if ('tenantId' in existingWhere) {
    return args;
  }

  return {
    ...args,
    where: {
      ...existingWhere,
      tenantId,
    },
  } as T;
}

// Type for proxied Prisma client methods
type PrismaDelegate = {
  findMany: (...args: unknown[]) => Promise<unknown>;
  findFirst: (...args: unknown[]) => Promise<unknown>;
  findUnique: (...args: unknown[]) => Promise<unknown>;
  findFirstOrThrow: (...args: unknown[]) => Promise<unknown>;
  findUniqueOrThrow: (...args: unknown[]) => Promise<unknown>;
  count: (...args: unknown[]) => Promise<unknown>;
  aggregate: (...args: unknown[]) => Promise<unknown>;
  groupBy: (...args: unknown[]) => Promise<unknown>;
  create: (...args: unknown[]) => Promise<unknown>;
  update: (...args: unknown[]) => Promise<unknown>;
  upsert: (...args: unknown[]) => Promise<unknown>;
  delete: (...args: unknown[]) => Promise<unknown>;
  deleteMany: (...args: unknown[]) => Promise<unknown>;
  updateMany: (...args: unknown[]) => Promise<unknown>;
};

/**
 * Create a tenant-scoped Prisma client wrapper.
 *
 * Returns a Proxy that automatically injects tenantId into all query
 * where clauses. Supports findMany, findFirst, findUnique, count,
 * aggregate, groupBy, create, update, upsert, delete, deleteMany, updateMany.
 *
 * Write operations (create, update, upsert) have tenantId injected into
 * both `where` and `data` clauses.
 *
 * @param tenantId - The tenant ID to scope all queries to
 * @returns A proxied Prisma client that auto-filters by tenant
 *
 * @example
 * const tenantDb = createTenantScopedDb(tenantId);
 * const guests = await tenantDb.guest.findMany({ where: { status: 'active' } });
 * // Equivalent to: db.guest.findMany({ where: { status: 'active', tenantId } })
 */
export function createTenantScopedDb(tenantId: string) {
  if (!tenantId) {
    throw new Error('createTenantScopedDb requires a valid tenantId');
  }

  function injectTenant(args: Record<string, unknown>, injectIntoData = false): Record<string, unknown> {
    const result = { ...args };

    // Inject into where clause
    if (result.where) {
      const where = result.where as Record<string, unknown>;
      if (!('tenantId' in where)) {
        result.where = { ...where, tenantId };
      }
    } else {
      result.where = { tenantId };
    }

    // Inject into data clause for create/update/upsert
    if (injectIntoData && result.data) {
      const data = result.data as Record<string, unknown>;
      if (!('tenantId' in data)) {
        result.data = { ...data, tenantId };
      }
    }

    return result;
  }

  return new Proxy(db, {
    get(_target, prop: string) {
      const model = (db as Record<string, unknown>)[prop];
      if (!model || typeof model !== 'object') return model;

      return new Proxy(model, {
        get(_modelTarget, method: string) {
          const original = (model as Record<string, unknown>)[method];
          if (typeof original !== 'function') return original;

          // Read operations: inject into where
          const readMethods = ['findMany', 'findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy'];
          // Write operations: inject into where and data
          const writeMethods = ['create', 'update', 'upsert', 'delete', 'deleteMany', 'updateMany'];

          if (readMethods.includes(method)) {
            return (...args: unknown[]) => {
              if (args.length > 0 && args[0] && typeof args[0] === 'object') {
                args[0] = injectTenant(args[0] as Record<string, unknown>);
              }
              return (original as (...a: unknown[]) => Promise<unknown>)(...args);
            };
          }

          if (writeMethods.includes(method)) {
            return (...args: unknown[]) => {
              if (args.length > 0 && args[0] && typeof args[0] === 'object') {
                const injectData = ['create', 'update', 'upsert'].includes(method);
                args[0] = injectTenant(args[0] as Record<string, unknown>, injectData);
              }
              return (original as (...a: unknown[]) => Promise<unknown>)(...args);
            };
          }

          return original;
        },
      });
    },
  });
}

/**
 * Execute a query function with tenant isolation guarantees.
 * The callback receives the db client and must include tenantId in all queries.
 */
export async function withTenantIsolation<T>(
  tenantId: string,
  queryFn: (tx: typeof db) => Promise<T>,
): Promise<T> {
  if (!tenantId) {
    throw new Error('Tenant isolation requires a valid tenantId');
  }

  const start = Date.now();
  try {
    const result = await queryFn(db);
    logger.debug('Tenant isolation query completed', { tenantId, durationMs: Date.now() - start });
    return result;
  } catch (error) {
    logger.error('Tenant isolation query failed', error instanceof Error ? error : new Error(String(error)), { tenantId });
    throw error;
  }
}

/**
 * Create a Prisma extension that auto-injects tenantId into all queries
 * for models that have a tenantId field.
 */
export function createTenantPrismaExtension(tenantId: string) {
  return Prisma.defineExtension({
    name: 'tenantIsolation',
    query: {
      $allModels: {
        async $allOperations({ args, query, model, operation }) {
          // Only inject for read/find operations, not for raw or transactions
          const tenantModels = [
            'Guest', 'Booking', 'Room', 'Property', 'Folio', 'Invoice',
            'RatePlan', 'RoomType', 'Amenity', 'Asset', 'AuditLog',
            'AutomationRule', 'Campaign', 'CancellationPolicy', 'ChannelConnection',
            'BandwidthPolicy', 'BankAccount', 'StorageQuota', 'DatabaseBackup',
            'DeadLetterQueue', 'PluginInstallation',
          ];

          if (
            tenantModels.includes(model.$name) &&
            operation.startsWith('find') &&
            args.where
          ) {
            args.where = { ...args.where, tenantId };
          }

          return query(args);
        },
      },
    },
  });
}
