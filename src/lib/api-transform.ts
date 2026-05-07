/**
 * API Response Transformation Utilities
 *
 * Standardizes the mapping between database field names and API/frontend field names.
 * All API routes should use these transforms for consistency.
 *
 * Convention:
 * - DB uses `isActive: boolean` → API returns `status: 'active' | 'inactive'`
 * - API accepts `status: 'active' | 'inactive'` → DB stores `isActive: boolean`
 */

/**
 * Transform `isActive` boolean to `status` string
 */
export function isActiveToStatus(isActive: boolean | null | undefined): string {
  return isActive ? 'active' : 'inactive';
}

/**
 * Transform `status` string to `isActive` boolean
 */
export function statusToIsActive(status: string | null | undefined): boolean {
  return status === 'active';
}

/**
 * Apply isActive → status transform to a single record
 */
export function transformRecord<T extends Record<string, unknown>>(
  record: T,
  options?: {
    /** Use a different false value instead of 'inactive' */
    falseStatus?: string;
    /** Additional field renames: { dbField: apiField } */
    fieldMap?: Record<string, string>;
  }
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    const mappedKey = options?.fieldMap?.[key] || key;

    if (key === 'isActive') {
      result.status = options?.falseStatus
        ? value ? 'active' : options.falseStatus
        : isActiveToStatus(value as boolean);
      continue;
    }

    result[mappedKey] = value;
  }

  return result;
}

/**
 * Apply isActive → status transform to an array of records
 */
export function transformRecords<T extends Record<string, unknown>>(
  records: T[],
  options?: Parameters<typeof transformRecord<T>>[1]
): Record<string, unknown>[] {
  return records.map(record => transformRecord(record, options));
}

/**
 * Reverse transform: convert API `status` field back to DB `isActive` boolean
 * Use this in POST/PUT handlers to convert frontend data to DB format
 */
export function reverseTransformStatus(
  data: Record<string, unknown>,
  options?: {
    /** Additional field renames for reverse: { apiField: dbField } */
    fieldMap?: Record<string, string>;
  }
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const mappedKey = options?.fieldMap?.[key] || key;

    if (key === 'status') {
      result.isActive = statusToIsActive(value as string);
      continue;
    }

    // Don't pass through isActive from frontend — only status
    if (key === 'isActive') continue;

    result[mappedKey] = value;
  }

  return result;
}
