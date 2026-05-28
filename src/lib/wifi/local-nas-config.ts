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

// ─── TTL Cache ─────────────────────────────────────────────────────────────
// NAS config rarely changes. Cache for 60 seconds to avoid per-session DB lookups.
const NAS_CONFIG_CACHE_TTL = 60_000;
const nasConfigCache = new Map<string, { config: LocalNasConfig; fetchedAt: number }>();

function cacheNasConfig(propertyId: string, config: LocalNasConfig) {
  nasConfigCache.set(propertyId, { config, fetchedAt: Date.now() });
  // Evict stale entries if cache grows too large
  if (nasConfigCache.size > 100) {
    const now = Date.now();
    for (const [key, val] of nasConfigCache.entries()) {
      if (now - val.fetchedAt > NAS_CONFIG_CACHE_TTL) nasConfigCache.delete(key);
    }
  }
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
  // TTL cache to avoid DB lookup on every session creation (LOW-02)
  const cached = nasConfigCache.get(propertyId);
  if (cached && Date.now() - cached.fetchedAt < NAS_CONFIG_CACHE_TTL) {
    return cached.config;
  }

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
      const config = {
        calledStationId: localNas.calledStationId || '00:00:00:00:00:01',
        nasIpAddress: localNas.ipAddress || '127.0.0.1',
        nasIdentifier: localNas.nasIdentifier,
      };
      cacheNasConfig(propertyId, config);
      return config;
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
      const config = {
        calledStationId: anyLocalNas.calledStationId || '00:00:00:00:00:01',
        nasIpAddress: anyLocalNas.ipAddress || '127.0.0.1',
        nasIdentifier: anyLocalNas.nasIdentifier,
      };
      cacheNasConfig(propertyId, config);
      return config;
    }
  } catch (err) {
    console.warn('[LocalNAS] Failed to look up local NAS config:', err instanceof Error ? err.message : err);
  }

  // Fallback defaults
  const defaultConfig: LocalNasConfig = {
    calledStationId: '00:00:00:00:00:01',
    nasIpAddress: '127.0.0.1',
    nasIdentifier: 'cryptsk-gateway',
  };
  cacheNasConfig(propertyId, defaultConfig);
  return defaultConfig;
}
