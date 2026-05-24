/**
 * license-manager.ts
 *
 * Core license verification, activation, and self-service reactivation logic
 * for StaySuite-HospitalityOS.
 *
 * Key design decisions:
 *   - In SaaS mode, hardware fingerprint mismatch is advisory-only.
 *     The system logs a warning and auto-updates the stored fingerprint,
 *     but does NOT block operations or suspend tenants.
 *   - In on-premise mode, full fingerprint enforcement is active with
 *     a configurable grace period and tenant suspension on expiry.
 */

import { db } from '@/lib/db';
import { getServerFingerprint } from './server-fingerprint';
import { getFingerprintPolicy, isSaasMode } from './hosting-config';
import { signLicense, verifyLicense, type LicensePayload, type SignedLicense } from './license-crypto';

// =====================================================
// CONSTANTS
// =====================================================

/** Number of days a tenant can operate after a fingerprint mismatch (on-premise only) */
export const GRACE_PERIOD_DAYS = 7;

/** Max times a tenant can self-service reactivate after fingerprint mismatch */
export const MAX_SELF_SERVICE_REACTIVATIONS = 3;

/**
 * Threshold in ms for clock tamper detection.
 * If the system clock appears to have moved backward by more than this
 * amount since the last check, the license is flagged as tampered.
 */
export const CLOCK_TAMPER_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

// =====================================================
// TYPES
// =====================================================

export type LicenseStatus =
  | 'valid'
  | 'no_license'
  | 'expired'
  | 'revoked'
  | 'grace_period'
  | 'hardware_mismatch'
  | 'tampered'
  | 'clock_tampered';

export interface LicenseResult {
  status: LicenseStatus;
  message: string;
  payload?: LicensePayload;
  gracePeriodEndsAt?: Date;
  daysRemaining?: number;
}

export interface LicenseStatusResponse {
  valid: boolean;
  status: LicenseStatus;
  message: string;
  plan?: string;
  expiresAt?: string | null;
  gracePeriodEndsAt?: string | null;
  daysRemaining?: number;
  hostingMode: string;
}

export interface ActivationResult {
  success: boolean;
  error?: string;
  signedLicense?: SignedLicense;
  tenantId?: string;
}

export interface ReactivationResult {
  success: boolean;
  error?: string;
  message?: string;
  remainingReactivations?: number;
}

// =====================================================
// HELPERS
// =====================================================

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// =====================================================
// VERIFY SERVER LICENSE
// =====================================================

/**
 * Verify the license for a specific tenant.
 *
 * Behavior depends on hosting mode (see hosting-config.ts):
 *   - SaaS: fingerprint mismatch is advisory — log + auto-update, return 'valid'.
 *   - On-premise: full enforcement with grace period + suspension.
 */
export async function verifyServerLicense(tenantId: string): Promise<LicenseResult> {
  const policy = getFingerprintPolicy();

  // 1. Fetch the license key record for this tenant
  const licenseKey = await db.licenseKey.findFirst({
    where: {
      tenantId,
      status: { in: ['active', 'activated'] },
    },
    include: {
      plan: true,
    },
  });

  if (!licenseKey) {
    return { status: 'no_license', message: 'No active license found for this tenant.' };
  }

  // 2. Check if explicitly revoked
  if (licenseKey.status === 'revoked') {
    return { status: 'revoked', message: 'License has been revoked.' };
  }

  // 3. Check expiration
  if (licenseKey.expiresAt && new Date() > licenseKey.expiresAt) {
    return {
      status: 'expired',
      message: 'License has expired.',
      daysRemaining: 0,
    };
  }

  // 4. Verify cryptographic signature if one is stored
  let payload: LicensePayload | null = null;

  // We store the signed payload in the licenseSignature field if available
  const signatureData = (licenseKey as Record<string, unknown>).licenseSignature as string | undefined;
  const payloadData = (licenseKey as Record<string, unknown>).licensePayload as string | undefined;

  if (signatureData && payloadData) {
    const verified = verifyLicense({ payload: payloadData, signature: signatureData });
    if (verified) {
      payload = verified;
    } else if (!isSaasMode()) {
      // On-premise: signature failure is critical
      return { status: 'tampered', message: 'License signature verification failed.' };
    } else {
      // SaaS mode: signature may be from old key pair format — log warning, use DB data
      console.warn(`[License] SaaS advisory: signature verification failed for tenant ${tenantId} (possibly old key pair format). Using DB record.`);
      payload = {
        key: licenseKey.key,
        tenantId: licenseKey.tenantId || tenantId,
        tenantName: '',
        plan: licenseKey.plan.name,
        maxProperties: licenseKey.plan.maxProperties,
        maxRooms: licenseKey.plan.maxRoomsPerProperty,
        maxUsers: licenseKey.plan.maxUsers,
        features: (() => { try { return JSON.parse(licenseKey.plan.features); } catch { return []; } })(),
        serverFingerprint: (licenseKey as Record<string, unknown>).serverFingerprint as string || '',
        issuedAt: licenseKey.activatedAt?.toISOString() || licenseKey.createdAt.toISOString(),
        expiresAt: licenseKey.expiresAt?.toISOString() || null,
      };
    }
  } else {
    // Construct a pseudo-payload from the DB record
    payload = {
      key: licenseKey.key,
      tenantId: licenseKey.tenantId || tenantId,
      tenantName: '',
      plan: licenseKey.plan.name,
      maxProperties: licenseKey.plan.maxProperties,
      maxRooms: licenseKey.plan.maxRoomsPerProperty,
      maxUsers: licenseKey.plan.maxUsers,
      features: (() => {
        try { return JSON.parse(licenseKey.plan.features); } catch { return []; }
      })(),
      serverFingerprint: (licenseKey as Record<string, unknown>).serverFingerprint as string || '',
      issuedAt: licenseKey.activatedAt?.toISOString() || licenseKey.createdAt.toISOString(),
      expiresAt: licenseKey.expiresAt?.toISOString() || null,
    };
  }

  // 5. Clock tamper detection (using tenant's lastKnownTimestamp)
  try {
    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { lastKnownTimestamp: true } });
    if (tenant?.lastKnownTimestamp) {
      const lastCheck = tenant.lastKnownTimestamp.getTime();
      const now = Date.now();
      if (lastCheck > now && (lastCheck - now) > CLOCK_TAMPER_THRESHOLD_MS) {
        return {
          status: 'clock_tampered',
          message: 'System clock appears to have been set backward. Possible tampering detected.',
        };
      }
    }
  } catch { /* skip */ }

  // 6. Hardware fingerprint check
  const currentFingerprint = getServerFingerprint();
  const storedFingerprint = payload.serverFingerprint || (licenseKey as Record<string, unknown>).serverFingerprint as string || '';

  if (storedFingerprint && currentFingerprint !== storedFingerprint) {
    // --- Fingerprint mismatch detected ---

    if (!policy.enforceMismatch) {
      // SaaS mode: advisory only — log warning, auto-update fingerprint, return valid
      console.warn(
        `[License] SaaS advisory: fingerprint mismatch for tenant ${tenantId}. ` +
        `Old: ${storedFingerprint.slice(0, 12)}... New: ${currentFingerprint.slice(0, 12)}... ` +
        `Auto-updating fingerprint (advisory-only mode).`
      );

      // Auto-update stored fingerprint
      try {
        await db.licenseKey.update({
          where: { id: licenseKey.id },
          data: {
            serverFingerprint: currentFingerprint,
          } as Record<string, unknown>,
        });
      } catch (err) {
        console.warn(`[License] Failed to auto-update fingerprint for tenant ${tenantId}:`, err);
      }

      return { status: 'valid', message: 'License valid (fingerprint mismatch advisory — auto-updated).', payload };
    }

    // On-premise mode: full enforcement
    const reactivationCount = (licenseKey as Record<string, unknown>).reactivationCount as number || 0;

    // Check if already in grace period
    const graceStart = (licenseKey as Record<string, unknown>).gracePeriodStartedAt as string | undefined;
    let gracePeriodEndsAt: Date | undefined;

    if (graceStart && policy.enableGracePeriod) {
      gracePeriodEndsAt = new Date(new Date(graceStart).getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      const now = new Date();

      if (now < gracePeriodEndsAt) {
        const daysLeft = Math.ceil((gracePeriodEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        return {
          status: 'grace_period',
          message: `Hardware fingerprint mismatch. Grace period ends ${gracePeriodEndsAt.toISOString()}.`,
          payload,
          gracePeriodEndsAt,
          daysRemaining: daysLeft,
        };
      }

      // Grace period expired
      if (policy.suspendOnExpiry) {
        return {
          status: 'hardware_mismatch',
          message: 'Hardware fingerprint mismatch. Grace period has expired. Tenant suspended.',
          payload,
          gracePeriodEndsAt,
          daysRemaining: 0,
        };
      }
    }

    // Start grace period
    if (policy.enableGracePeriod && !graceStart) {
      gracePeriodEndsAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

      try {
        await db.licenseKey.update({
          where: { id: licenseKey.id },
          data: {
            gracePeriodStartedAt: new Date().toISOString(),
          } as Record<string, unknown>,
        });
      } catch (err) {
        console.warn(`[License] Failed to start grace period for tenant ${tenantId}:`, err);
      }

      return {
        status: 'grace_period',
        message: `Hardware fingerprint mismatch detected. ${GRACE_PERIOD_DAYS}-day grace period started.`,
        payload,
        gracePeriodEndsAt,
        daysRemaining: GRACE_PERIOD_DAYS,
      };
    }

    // No grace period configured — immediate enforcement
    return {
      status: 'hardware_mismatch',
      message: 'Hardware fingerprint mismatch. No grace period configured. Tenant suspended.',
      payload,
    };
  }

  // 7. Update lastKnownTimestamp on tenant (non-critical)
  try {
    await db.tenant.update({
      where: { id: tenantId },
      data: { lastKnownTimestamp: new Date() },
    });
  } catch {
    // Non-critical: don't fail the check
  }

  // 8. Calculate days remaining
  let daysRemaining: number | undefined;
  if (payload.expiresAt) {
    const expiry = new Date(payload.expiresAt).getTime();
    const now = Date.now();
    daysRemaining = Math.max(0, Math.ceil((expiry - now) / (24 * 60 * 60 * 1000)));
  }

  return {
    status: 'valid',
    message: 'License is valid.',
    payload,
    daysRemaining,
  };
}

// =====================================================
// ACTIVATE LICENSE
// =====================================================

/**
 * Activate a license key for a tenant.
 * Signs a license payload with the server's private key and stores the result.
 */
export async function activateLicense(params: {
  licenseKey: string;
  tenantId: string;
  tenantName: string;
  userId: string;
}): Promise<ActivationResult> {
  try {
    const { licenseKey: keyStr, tenantId, tenantName, userId } = params;

    // Find the license key record
    const keyRecord = await db.licenseKey.findUnique({
      where: { key: keyStr },
      include: { plan: true },
    });

    if (!keyRecord) {
      return { success: false, error: 'License key not found.' };
    }

    if (keyRecord.status !== 'active') {
      return { success: false, error: 'License key is not available for activation.' };
    }

    if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
      return { success: false, error: 'License key has expired.' };
    }

    // Get current server fingerprint
    const fingerprint = getServerFingerprint();

    // Build and sign the license payload
    const features: string[] = (() => {
      try { return JSON.parse(keyRecord.plan.features); } catch { return []; }
    })();

    const payload: LicensePayload = {
      key: keyStr,
      tenantId,
      tenantName,
      plan: keyRecord.plan.name,
      maxProperties: keyRecord.plan.maxProperties,
      maxRooms: keyRecord.plan.maxRoomsPerProperty,
      maxUsers: keyRecord.plan.maxUsers,
      features,
      serverFingerprint: fingerprint,
      issuedAt: new Date().toISOString(),
      expiresAt: keyRecord.expiresAt?.toISOString() || null,
    };

    const signed = signLicense(payload);

    // Update the license key record
    await db.licenseKey.update({
      where: { id: keyRecord.id },
      data: {
        status: 'activated',
        activatedBy: userId,
        activatedAt: new Date(),
        tenantId,
        serverFingerprint: fingerprint,
        licenseSignature: signed.signature,
        licensePayload: signed.payload,
        reactivationCount: 0,
        gracePeriodStartedAt: null,
      } as Record<string, unknown>,
    });

    // Update tenant fingerprint
    try {
      await db.tenant.update({
        where: { id: tenantId },
        data: { lastKnownTimestamp: new Date() },
      });
    } catch { /* skip */ }

    return {
      success: true,
      signedLicense: signed,
      tenantId,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[License] Activation failed:', msg);
    return { success: false, error: msg };
  }
}

// =====================================================
// SELF-SERVICE REACTIVATION
// =====================================================

/**
 * Allow a tenant to self-service reactivate after a fingerprint mismatch.
 * Only available in on-premise mode.
 */
export async function selfServiceReactivate(tenantId: string): Promise<ReactivationResult> {
  const policy = getFingerprintPolicy();

  if (!policy.allowSelfServiceReactivation) {
    return {
      success: false,
      error: 'Self-service reactivation is not available in SaaS mode. Contact support.',
    };
  }

  try {
    // Find the tenant's license key
    const licenseKey = await db.licenseKey.findFirst({
      where: { tenantId, status: 'activated' },
    });

    if (!licenseKey) {
      return { success: false, error: 'No activated license found for this tenant.' };
    }

    const reactivationCount = (licenseKey as Record<string, unknown>).reactivationCount as number || 0;

    if (reactivationCount >= MAX_SELF_SERVICE_REACTIVATIONS) {
      return {
        success: false,
        error: `Maximum self-service reactivations (${MAX_SELF_SERVICE_REACTIVATIONS}) exceeded. Contact support.`,
      };
    }

    // Get new fingerprint
    const newFingerprint = getServerFingerprint();

    // Re-sign with new fingerprint
    const plan = await db.registrationPlan.findUnique({
      where: { id: licenseKey.planId },
    });

    if (!plan) {
      return { success: false, error: 'Associated plan not found.' };
    }

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const features: string[] = (() => {
      try { return JSON.parse(plan.features); } catch { return []; }
    })();

    const payload: LicensePayload = {
      key: licenseKey.key,
      tenantId,
      tenantName: tenant?.name || '',
      plan: plan.name,
      maxProperties: plan.maxProperties,
      maxRooms: plan.maxRoomsPerProperty,
      maxUsers: plan.maxUsers,
      features,
      serverFingerprint: newFingerprint,
      issuedAt: licenseKey.activatedAt?.toISOString() || new Date().toISOString(),
      expiresAt: licenseKey.expiresAt?.toISOString() || null,
    };

    const signed = signLicense(payload);

    // Update record
    await db.licenseKey.update({
      where: { id: licenseKey.id },
      data: {
        serverFingerprint: newFingerprint,
        licenseSignature: signed.signature,
        licensePayload: signed.payload,
        reactivationCount: reactivationCount + 1,
        gracePeriodStartedAt: null,
      } as Record<string, unknown>,
    });

    return {
      success: true,
      message: 'License reactivated successfully with new hardware fingerprint.',
      remainingReactivations: MAX_SELF_SERVICE_REACTIVATIONS - reactivationCount - 1,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[License] Self-service reactivation failed:', msg);
    return { success: false, error: msg };
  }
}

// =====================================================
// GET LICENSE STATUS (API-friendly)
// =====================================================

/**
 * Get a human-readable license status for the given tenant.
 * Used by the /api/license/status endpoint.
 */
export async function getLicenseStatus(tenantId: string): Promise<LicenseStatusResponse> {
  const result = await verifyServerLicense(tenantId);

  const hostingMode = isSaasMode() ? 'saas' : 'on_premise';

  return {
    valid: result.status === 'valid' || result.status === 'grace_period',
    status: result.status,
    message: result.message,
    plan: result.payload?.plan,
    expiresAt: result.payload?.expiresAt || null,
    gracePeriodEndsAt: result.gracePeriodEndsAt?.toISOString() || null,
    daysRemaining: result.daysRemaining,
    hostingMode,
  };
}
