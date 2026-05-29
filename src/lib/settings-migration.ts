/**
 * Settings Schema Migration Helper (L-32)
 *
 * SystemConfig entries store arbitrary JSON blobs keyed by (tenantId, key).
 * When the expected shape of a setting changes, bump its `version` and register
 * a migration function here.  `migrateSettings()` is idempotent and safe to
 * call on every app boot.
 *
 * Usage:
 *   import { migrateSettings } from '@/lib/settings-migration';
 *   await migrateSettings(db, tenantId); // migrates all keys for a tenant
 *
 * Or migrate a single key:
 *   const result = await migrateSetting(db, tenantId, 'linear_pricing_config');
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type MigrationFn = (oldValue: unknown) => unknown;

interface MigrationEntry {
  /** Target version (the version AFTER this migration runs) */
  version: number;
  /** Human-readable description */
  description: string;
  /** Pure function: receives the old JSON value, returns the new one */
  migrate: MigrationFn;
}

/* ------------------------------------------------------------------ */
/*  Migration Registry                                                 */
/* ------------------------------------------------------------------ */

/**
 * Registry of known settings migrations, keyed by config key.
 *
 * To add a new migration:
 *   1. Choose the next integer version for the target config key.
 *   2. Add an entry to the corresponding array below.
 *   3. The migrations array MUST be sorted by version ascending.
 */
const MIGRATION_REGISTRY: Record<string, MigrationEntry[]> = {
  // ── linear_pricing_config ──────────────────────────────────────────
  // Added fields: `effectiveDate`, `propertyTypeId` (v2)
  'linear_pricing_config': [
    {
      version: 2,
      description: 'Add effectiveDate and propertyTypeId fields',
      migrate: (old: unknown) => {
        const obj = (typeof old === 'object' && old !== null ? old : {}) as Record<string, unknown>;
        return {
          ...obj,
          effectiveDate: obj.effectiveDate ?? new Date().toISOString().split('T')[0],
          propertyTypeId: obj.propertyTypeId ?? null,
        };
      },
    },
  ],

  // ── hr_leave_balance_config ────────────────────────────────────────
  // No breaking changes yet; placeholder for future migrations.
  'hr_leave_balance_config': [],

  // ── hr_holiday_calendar ────────────────────────────────────────────
  // No breaking changes yet.
  'hr_holiday_calendar': [],

  // ── calendar_deviation_settings ────────────────────────────────────
  // No breaking changes yet.
  'calendar_deviation_settings': [],
};

/* ------------------------------------------------------------------ */
/*  Core Functions                                                     */
/* ------------------------------------------------------------------ */

/**
 * Migrate a single SystemConfig entry to the latest version.
 *
 * Returns `{ migrated: boolean, fromVersion: number, toVersion: number }`.
 */
export async function migrateSetting(
  db: { systemConfig: { findUnique: (args: Record<string, unknown>) => Promise<{ value: unknown; version: number } | null>; update: (args: Record<string, unknown>) => Promise<{ version: number; value: unknown }> } },
  tenantId: string,
  key: string,
): Promise<{ migrated: boolean; fromVersion: number; toVersion: number }> {
  const entry = await db.systemConfig.findUnique({
    where: { tenantId_key: { tenantId, key } },
  });

  // No config entry — nothing to migrate
  if (!entry) {
    return { migrated: false, fromVersion: 0, toVersion: 0 };
  }

  const migrations = MIGRATION_REGISTRY[key];
  if (!migrations || migrations.length === 0) {
    return { migrated: false, fromVersion: entry.version, toVersion: entry.version };
  }

  // Filter migrations that haven't been applied yet
  const pending = migrations.filter((m) => m.version > entry.version);
  if (pending.length === 0) {
    return { migrated: false, fromVersion: entry.version, toVersion: entry.version };
  }

  // Apply migrations sequentially (each transforms the previous output)
  let currentValue = entry.value;
  let currentVersion = entry.version;

  for (const m of pending) {
    try {
      currentValue = m.migrate(currentValue);
      currentVersion = m.version;
    } catch (error) {
      console.error(
        `[settings-migration] Failed to migrate ${key} from v${currentVersion} to v${m.version}:`,
        error,
      );
      // Stop migrating — don't corrupt the value
      break;
    }
  }

  // Persist the migrated value and version
  await db.systemConfig.update({
    where: { tenantId_key: { tenantId, key } },
    data: { value: currentValue as object, version: currentVersion },
  });

  console.log(
    `[settings-migration] Migrated ${key} from v${entry.version} to v${currentVersion} (tenant ${tenantId})`,
  );

  return { migrated: true, fromVersion: entry.version, toVersion: currentVersion };
}

/**
 * Migrate ALL known settings keys for a tenant.
 * Safe to call on every app boot (idempotent, no-op if already up-to-date).
 */
export async function migrateAllSettings(
  db: { systemConfig: { findMany: (args: Record<string, unknown>) => Promise<Array<{ key: string }>> } } & Parameters<typeof migrateSetting>[0],
  tenantId: string,
): Promise<void> {
  const keys = Object.keys(MIGRATION_REGISTRY);

  const existingConfigs = await db.systemConfig.findMany({
    where: { tenantId, key: { in: keys } },
    select: { key: true },
  });

  const existingKeys = new Set(existingConfigs.map((c) => c.key));

  for (const key of keys) {
    if (existingKeys.has(key)) {
      await migrateSetting(db, tenantId, key);
    }
  }
}

/**
 * Get the list of registered config keys and their latest migration versions.
 * Useful for admin dashboards / debugging.
 */
export function getRegisteredMigrations(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, migrations] of Object.entries(MIGRATION_REGISTRY)) {
    result[key] = migrations.length > 0 ? migrations[migrations.length - 1].version : 1;
  }
  return result;
}
