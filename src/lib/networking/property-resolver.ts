import { db } from '@/lib/db';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve propertyId for networking API routes.
 * If propertyId is provided and looks like a UUID, use it.
 * Otherwise, look up the user's first property from the database.
 * Returns null if no property can be found (caller should return 400).
 */
export async function resolvePropertyId(tenantId: string, propertyId?: string | null): Promise<string | null> {
  if (propertyId && UUID_REGEX.test(propertyId)) {
    return propertyId;
  }
  // Look up user's first property
  const property = await db.property.findFirst({
    where: { tenantId },
    select: { id: true },
  });
  return property?.id || null;
}

/**
 * Check if a string is a valid UUID format.
 */
export function isValidUUID(value?: string | null): boolean {
  if (!value) return false;
  return UUID_REGEX.test(value);
}
