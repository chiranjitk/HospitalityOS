import { db } from '@/lib/db';

/**
 * External gateway configuration returned when a property has
 * a MikroTik WiFi Controller with external portal mode enabled.
 */
export interface ExternalGatewayConfig {
  /** The MikroTik hotspot login URL, e.g. "http://192.168.1.1/login" */
  portalCallbackUrl: string;
  /** The MikroTik RouterOS IP address */
  mikrotikIp: string;
}

/**
 * Look up whether the given property has an external MikroTik gateway
 * configured with StaySuite portal mode enabled.
 *
 * Checks the Integration table for:
 *   - type = 'wifi_gateway'
 *   - provider = 'mikrotik'
 *   - config_wifi.externalPortalMode = true
 *   - status = 'active'
 *   - property match via config propertyId or tenantId
 *
 * Returns the gateway config if found, null if not (internal NAS mode).
 *
 * @param propertyId - The property UUID to check
 * @param tenantId - The tenant UUID (fallback if propertyId doesn't match)
 */
export async function getExternalGatewayConfig(
  propertyId: string,
  tenantId?: string | null
): Promise<ExternalGatewayConfig | null> {
  try {
    // Query all active MikroTik wifi_gateway integrations
    const integrations = await db.integration.findMany({
      where: {
        type: 'wifi_gateway',
        provider: 'mikrotik',
        status: 'active',
      },
      select: {
        tenantId: true,
        config: true,
      },
    });

    for (const integration of integrations) {
      // Skip if tenant doesn't match
      if (tenantId && integration.tenantId !== tenantId) continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = typeof integration.config === 'string'
          ? JSON.parse(integration.config)
          : integration.config as Record<string, unknown>;
      } catch {
        continue;
      }

      const wifiConfig = parsed.config_wifi as Record<string, unknown> | undefined;
      if (!wifiConfig?.externalPortalMode) continue;

      const portalCallbackUrl = wifiConfig.portalCallbackUrl as string;
      const mikrotikIp = parsed.ipAddress as string;

      if (!portalCallbackUrl || !mikrotikIp) continue;

      return { portalCallbackUrl, mikrotikIp };
    }
  } catch (err) {
    console.error('[ExternalGateway] Failed to lookup gateway config:', err);
  }

  return null;
}

/**
 * Build the external gateway response fields that get appended to
 * successResponse data in both auth and auto-auth routes.
 *
 * When gateway is null (internal NAS), returns an empty object —
 * the portal will not redirect and nftables activation proceeds normally.
 */
export function buildGatewayAuthResponse(
  gateway: ExternalGatewayConfig | null,
  radiusUsername: string,
  radiusPassword: string
): Record<string, unknown> {
  if (!gateway) return {};

  return {
    needGatewayLogin: true,
    gatewayCallbackUrl: gateway.portalCallbackUrl,
    gatewayType: 'mikrotik',
    radiusUsername,
    radiusPassword,
  };
}
