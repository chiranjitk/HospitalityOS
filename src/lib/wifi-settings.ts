import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * WiFi Feature Settings — backed by the WiFiSettings table (raw SQL since
 * the table is managed outside of Prisma migrations to avoid db:push).
 *
 * Each feature stores its settings as a JSON string under a unique key:
 *   - device_management
 *   - identity_verification
 *   - consent_management
 *   - bandwidth_upsell
 *   - satisfaction_survey
 */

export type WifiSettingsKey =
  | 'device_management'
  | 'identity_verification'
  | 'consent_management'
  | 'bandwidth_upsell'
  | 'satisfaction_survey';

// ---- default values per key ----

const DEFAULTS: Record<WifiSettingsKey, Record<string, unknown>> = {
  device_management: {
    maxDevicesPerGuest: 5,
    defaultAutoAuth: true,
    autoCleanupDays: 30,
  },
  identity_verification: {
    requiredMethods: ['room_number'],
    autoVerifyRoomNumber: true,
    enableSmsOtp: false,
    enableEmailOtp: false,
    otpExpirySeconds: 300,
    otpMaxRetries: 3,
  },
  consent_management: {
    consentText:
      'By connecting to this WiFi network, you agree to our terms of service and data processing policy. Your connection data (IP address, MAC address, timestamps) will be collected and stored in accordance with applicable privacy laws.',
    requiredTypes: ['wifi_access'],
    retentionDays: 90,
    showMarketingOptIn: false,
    cookiePolicyUrl: '',
  },
  bandwidth_upsell: {
    upsellEnabled: true,
    chargeToRoom: true,
    defaultCurrency: 'INR',
    tiers: [],
  },
  satisfaction_survey: {
    enabled: true,
    title: 'How was your WiFi experience?',
    description: 'Help us improve by rating your connection',
    categories: ['speed', 'coverage', 'easeOfConnect'],
    showCommentBox: true,
  },
};

// ---- typed partials ----

export interface DeviceManagementSettings {
  maxDevicesPerGuest: number;
  defaultAutoAuth: boolean;
  autoCleanupDays: number;
}

export interface IdentityVerificationSettings {
  requiredMethods: string[];
  autoVerifyRoomNumber: boolean;
  enableSmsOtp: boolean;
  enableEmailOtp: boolean;
  otpExpirySeconds: number;
  otpMaxRetries: number;
}

export interface ConsentManagementSettings {
  consentText: string;
  requiredTypes: string[];
  retentionDays: number;
  showMarketingOptIn: boolean;
  cookiePolicyUrl: string;
}

export interface BandwidthUpsellSettings {
  upsellEnabled: boolean;
  chargeToRoom: boolean;
  defaultCurrency: string;
  tiers: BandwidthTier[];
}

export interface BandwidthTier {
  fromPlan: string;
  toPlan: string;
  price: number;
  enabled: boolean;
}

export interface SatisfactionSurveySettings {
  enabled: boolean;
  title: string;
  description: string;
  categories: string[];
  showCommentBox: boolean;
}

export type WifiSettingsMap = {
  device_management: DeviceManagementSettings;
  identity_verification: IdentityVerificationSettings;
  consent_management: ConsentManagementSettings;
  bandwidth_upsell: BandwidthUpsellSettings;
  satisfaction_survey: SatisfactionSurveySettings;
};

// ---- CRUD helpers ----

/**
 * Get settings for a feature, falling back to defaults.
 */
export async function getWifiSettings<K extends WifiSettingsKey>(
  tenantId: string,
  key: K,
  propertyId?: string
): Promise<WifiSettingsMap[K]> {
  const nullProp = propertyId ?? '00000000-0000-0000-0000-000000000000';

  const rows = await db.$queryRawUnsafe<
    { value: string }[]
  >(
    `SELECT "value" FROM "WiFiSettings" WHERE "tenantId" = $1::uuid AND COALESCE("propertyId", '00000000-0000-0000-0000-000000000000'::uuid) = $2::uuid AND "key" = $3 LIMIT 1`,
    tenantId,
    nullProp,
    key
  );

  if (rows.length === 0) {
    return structuredClone(DEFAULTS[key]) as WifiSettingsMap[K];
  }

  try {
    const parsed = JSON.parse(rows[0].value);
    // merge with defaults so new fields always have a value
    return { ...structuredClone(DEFAULTS[key]), ...parsed } as WifiSettingsMap[K];
  } catch {
    return structuredClone(DEFAULTS[key]) as WifiSettingsMap[K];
  }
}

/**
 * Upsert settings for a feature.
 */
export async function setWifiSettings<K extends WifiSettingsKey>(
  tenantId: string,
  key: K,
  value: WifiSettingsMap[K],
  propertyId?: string
): Promise<void> {
  const nullProp = propertyId ?? '00000000-0000-0000-0000-000000000000';
  const json = JSON.stringify(value);

  const resolvedPropertyId = nullProp !== '00000000-0000-0000-0000-000000000000'
    ? nullProp
    : null;

  // PostgreSQL unique indexes treat NULLs as distinct, so a simple ON CONFLICT
  // cannot match rows when propertyId IS NULL. Work around this with an
  // advisory lock + upsert pattern for the NULL-propertyId case.
  if (resolvedPropertyId === null) {
    // NULL propertyId: lock by tenantId+key, then insert-or-update
    await db.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(
         ('x' || substr(md5($1::text), 1, 8))::bit(32)::int,
         ('x' || substr(md5($2::text), 1, 8))::bit(32)::int
       )`,
      tenantId, key
    );

    const existing = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "WiFiSettings"
       WHERE "tenantId" = $1::uuid AND "propertyId" IS NULL AND "key" = $2
       LIMIT 1`,
      tenantId, key
    );

    if (existing.length > 0) {
      await db.$executeRawUnsafe(
        `UPDATE "WiFiSettings" SET "value" = $1, "updatedAt" = now()
         WHERE id = $2::uuid`,
        json, existing[0].id
      );
    } else {
      await db.$executeRawUnsafe(
        `INSERT INTO "WiFiSettings" (id, "tenantId", "propertyId", "key", "value", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1::uuid, NULL, $2, $3, now(), now())`,
        tenantId, key, json
      );
    }
  } else {
    // Non-NULL propertyId: standard ON CONFLICT works
    await db.$executeRawUnsafe(
      `INSERT INTO "WiFiSettings" ("tenantId", "propertyId", "key", "value")
       VALUES ($1::uuid, $2::uuid, $3, $4)
       ON CONFLICT ("tenantId", "propertyId", "key")
       DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()`,
      tenantId, resolvedPropertyId, key, json
    );
  }
}
