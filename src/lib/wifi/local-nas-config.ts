/**
 * Local NAS Identity Configuration
 *
 * Provides the Called-Station-Id and NAS IP address for the local
 * StaySuite captive portal NAS. These values are used in RADIUS
 * accounting (radacct) and post-auth (radpostauth) records to
 * identify which NAS handled the authentication.
 *
 * The values come from the RadiusNAS table where ipAddress = '127.0.0.1'
 * (the local system NAS created during deployment). The admin can
 * configure the Called-Station-Id (e.g. a MAC address) and
 * NAS-Identifier via the WiFi → AAA Configuration page.
 *
 * @module local-nas-config
 */

import { db } from '@/lib/db';

export interface LocalNasConfig {
  /** Called-Station-Id — NAS MAC or identifier (e.g. "00:1A:2B:3C:4D:5E") */
  calledStationId: string;
  /** NAS IP Address — always 127.0.0.1 for the local captive portal NAS */
  nasIpAddress: string;
  /** NAS-Identifier — human-readable NAS name (e.g. "StaySuite-Gateway") */
  nasIdentifier?: string | null;
}

/**
 * Get local NAS configuration for a property.
 *
 * Looks up the RadiusNAS entry with ipAddress='127.0.0.1' for the
 * given property. If not found or if calledStationId is not set,
 * returns sensible defaults.
 *
 * @param propertyId - The property UUID to look up NAS config for
 * @returns LocalNasConfig with calledStationId and nasIpAddress
 */
export async function getLocalNasConfig(propertyId: string): Promise<LocalNasConfig> {
  try {
    // Try property-specific NAS first (most precise match)
    const localNas = await db.radiusNAS.findFirst({
      where: {
        propertyId,
        ipAddress: '127.0.0.1',
        status: 'active',
      },
      select: {
        calledStationId: true,
        nasIdentifier: true,
        ipAddress: true,
      },
    });

    if (localNas) {
      return {
        calledStationId: localNas.calledStationId || '00:00:00:00:00:01',
        nasIpAddress: localNas.ipAddress || '127.0.0.1',
        nasIdentifier: localNas.nasIdentifier,
      };
    }

    // Fallback: look up ANY active system NAS on 127.0.0.1
    // The Cryptsk Gateway is a shared system NAS — it may not be linked
    // to the requesting property (e.g. voucher login resolves a different
    // property than the one the NAS was created under).
    const anyLocalNas = await db.radiusNAS.findFirst({
      where: {
        ipAddress: '127.0.0.1',
        status: 'active',
      },
      select: {
        calledStationId: true,
        nasIdentifier: true,
        ipAddress: true,
      },
    });

    if (anyLocalNas) {
      return {
        calledStationId: anyLocalNas.calledStationId || '00:00:00:00:00:01',
        nasIpAddress: anyLocalNas.ipAddress || '127.0.0.1',
        nasIdentifier: anyLocalNas.nasIdentifier,
      };
    }
  } catch (err) {
    console.warn('[LocalNAS] Failed to look up local NAS config:', err instanceof Error ? err.message : err);
  }

  // Fallback defaults
  return {
    calledStationId: '00:00:00:00:00:01',
    nasIpAddress: '127.0.0.1',
    nasIdentifier: 'cryptsk-gateway',
  };
}
