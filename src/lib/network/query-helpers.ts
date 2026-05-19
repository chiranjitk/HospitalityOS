/**
 * Network Query Helpers
 *
 * Guards against Prisma P2023 "Inconsistent column data" errors when
 * non-UUID strings are passed to @db.Uuid columns.
 *
 * On some deployments the session tenantId or record IDs may contain
 * non-UUID values (e.g. from migration artifacts or OS scan data).
 * Prisma validates UUIDs client-side before sending to PostgreSQL,
 * so we must validate before passing to Prisma where-clauses.
 */

// Standard UUID v4 validation regex
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns true if the string is a valid UUID */
export function isUUID(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Build a tenant-scoped where clause.
 * If tenantId is not a valid UUID, skip it entirely (platform admin fallback).
 * This prevents P2023 when a corrupt session has a non-UUID tenantId.
 */
export function tenantWhere(
  tenantId: string,
  additionalWhere: Record<string, unknown> = {},
): Record<string, unknown> {
  const where: Record<string, unknown> = { ...additionalWhere };
  if (isUUID(tenantId)) {
    where.tenantId = tenantId;
  }
  return where;
}

/**
 * Resolve a record by ID — if id is a valid UUID, query by id column;
 * otherwise fall back to the fallback key (e.g. subInterface, name).
 *
 * @param model    Prisma model delegate (e.g. db.vlanConfig)
 * @param id       The incoming ID (could be UUID or interface name)
 * @param fallback Where clause to use if id is not a UUID (e.g. { subInterface: id })
 * @param include  Optional Prisma include
 */
export async function resolveByIdOrFallback<T>(
  model: {
    findFirst: (args: {
      where: Record<string, unknown>;
      include?: Record<string, unknown>;
    }) => Promise<T | null>;
  },
  id: string,
  fallback: Record<string, unknown>,
  include?: Record<string, unknown>,
): Promise<T | null> {
  // Try by UUID id column first (only if id looks like a UUID)
  if (isUUID(id)) {
    const byId = await model.findFirst({
      where: { id, ...fallback },
      include,
    });
    if (byId) return byId;
  }
  // Fall back to the non-UUID column lookup
  return model.findFirst({
    where: fallback,
    include,
  });
}
