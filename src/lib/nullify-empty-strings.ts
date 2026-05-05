/**
 * Sanitize request body by converting empty strings to null.
 *
 * PostgreSQL `@db.Uuid` columns reject empty strings ("") with:
 *   "Error creating UUID, invalid length: expected length 32 for simple format, found 0"
 *
 * Frontend forms commonly send `""` for optional fields when the user
 * leaves them blank. This utility ensures all empty-string values become
 * `null` before they reach Prisma / PostgreSQL.
 *
 * Usage:
 *   const body = await request.json();
 *   const data = nullifyEmptyStrings(body);
 *   const { planId, roomId, ...rest } = data;
 */
export function nullifyEmptyStrings<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return obj as Record<string, unknown>;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Convert empty strings to null; leave everything else untouched
    result[key] = value === '' ? null : value;
  }
  return result;
}
