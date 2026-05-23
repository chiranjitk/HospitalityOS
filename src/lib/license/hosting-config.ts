/**
 * hosting-config.ts
 *
 * Determines the hosting mode for StaySuite-HospitalityOS.
 *
 * Two modes:
 *   - `saas`       (default): One cloud instance serves multiple tenants.
 *                  Hardware fingerprint is captured for anti-piracy but is
 *                  advisory-only — it does NOT suspend tenants on mismatch.
 *                  Per-tenant plan limits are the real enforcement mechanism.
 *
 *   - `on_premise`  : One physical/virtual server per customer.
 *                  Full hardware fingerprint enforcement with grace period
 *                  and tenant suspension on mismatch.
 *
 * Environment: HOSTING_MODE=saas|on_premise (default: saas)
 */

export type HostingMode = 'saas' | 'on_premise';

/**
 * Get the current hosting mode from environment variable.
 * Defaults to 'saas' if not set (multi-tenant cloud is the most common deployment).
 */
export function getHostingMode(): HostingMode {
  const mode = process.env.HOSTING_MODE?.toLowerCase().trim();
  if (mode === 'on_premise' || mode === 'on-premise') return 'on_premise';
  return 'saas';
}

/**
 * Check if we're running in SaaS (multi-tenant) mode.
 */
export function isSaasMode(): boolean {
  return getHostingMode() === 'saas';
}

/**
 * Check if we're running in on-premise (single-tenant) mode.
 */
export function isOnPremiseMode(): boolean {
  return getHostingMode() === 'on_premise';
}

/**
 * Returns a human-readable description of the hosting mode for UI display.
 */
export function getHostingModeDescription(): string {
  const mode = getHostingMode();
  if (mode === 'saas') {
    return 'SaaS Multi-Tenant — one instance serves multiple customers. Hardware fingerprint is advisory-only. Per-tenant plan limits enforce actual usage.';
  }
  return 'On-Premise — single server per customer. Full hardware fingerprint enforcement with grace period.';
}

/**
 * Get the fingerprint enforcement policy based on hosting mode.
 */
export function getFingerprintPolicy(): {
  /** Whether to block operations on fingerprint mismatch */
  enforceMismatch: boolean;
  /** Whether to start a grace period on mismatch */
  enableGracePeriod: boolean;
  /** Whether to suspend tenant on grace expiry */
  suspendOnExpiry: boolean;
  /** Whether self-service reactivation is available */
  allowSelfServiceReactivation: boolean;
  /** Description for admin UI */
  description: string;
} {
  if (isSaasMode()) {
    return {
      enforceMismatch: false,
      enableGracePeriod: false,
      suspendOnExpiry: false,
      allowSelfServiceReactivation: false,
      description: 'Fingerprint is monitored for anti-piracy but does not block operations. All tenants share the same cloud instance fingerprint.',
    };
  }

  return {
    enforceMismatch: true,
    enableGracePeriod: true,
    suspendOnExpiry: true,
    allowSelfServiceReactivation: true,
    description: 'Full hardware binding. Mismatch triggers 7-day grace period, then tenant is suspended.',
  };
}
