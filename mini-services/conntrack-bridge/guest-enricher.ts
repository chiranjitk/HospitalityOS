/**
 * Guest Enricher for conntrack-bridge syslog forwarding
 *
 * Resolves guest IP addresses to human-readable guest information
 * (name, room number, username, MAC address) using PostgreSQL queries.
 *
 * Three-tier lookup (most reliable first):
 *   0. RadAcct (RADIUS accounting) → WiFiUser → Guest → Room
 *   1. WiFiSession (captive portal) → Guest → Room
 *   2. DhcpLease → DeviceProfile → WiFiUser → Guest → Room
 *
 * Uses a TTL cache (default 60s) to avoid hammering the database on every batch flush.
 */

import { Pool, type PoolConfig, type PoolClient } from "pg";

// ─── Configuration ──────────────────────────────────────────────────────────
const CACHE_TTL_MS = parseInt(process.env.GUEST_CACHE_TTL || "60000", 10);
const MAX_CACHE_SIZE = parseInt(process.env.GUEST_CACHE_MAX || "5000", 10);
const SERVICE_TAG = "[guest-enricher]";

// ─── Types ──────────────────────────────────────────────────────────────────
export interface GuestInfo {
  guest_name: string;   // e.g. "John Smith"
  room_number: string;  // e.g. "301"
  username: string;     // e.g. "301john" (RADIUS username)
  mac_address: string;  // e.g. "AA:BB:CC:DD:EE:FF"
}

/** Cache entry with expiry timestamp */
interface CacheEntry {
  info: GuestInfo;
  expiresAt: number; // Unix ms
}

// ─── Cache ──────────────────────────────────────────────────────────────────
const cache = new Map<string, CacheEntry>();
let lastCacheClean = 0;

function cleanCache(): void {
  const now = Date.now();
  // Only clean every 30s to avoid thrashing
  if (now - lastCacheClean < 30000) return;
  lastCacheClean = now;

  for (const [key, entry] of cache) {
    if (entry.expiresAt < now) {
      cache.delete(key);
    }
  }
  // If cache is oversized, evict oldest entries
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toRemove = entries.length - MAX_CACHE_SIZE;
    for (let i = 0; i < toRemove; i++) {
      cache.delete(entries[i][0]);
    }
  }
}

function getCached(ip: string): GuestInfo | null {
  cleanCache();
  const entry = cache.get(ip);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(ip);
    return null;
  }
  return entry.info;
}

function setCached(ip: string, info: GuestInfo): void {
  cache.set(ip, { info, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Database Pool ──────────────────────────────────────────────────────────
let pool: Pool | null = null;
let dbAvailable = false;

function getPool(): Pool | null {
  if (pool) return dbAvailable ? pool : null;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    if (!process.env.GUEST_ENRICHER_SILENT) {
      console.warn(
        `${SERVICE_TAG} DATABASE_URL not set — guest enrichment disabled. ` +
        `Set DATABASE_URL env var to enable.`
      );
    }
    return null;
  }

  try {
    const config: PoolConfig = {
      connectionString: dbUrl,
      max: 3, // Small pool — this is a background enrichment task
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    pool = new Pool(config);
    pool.on("error", (err) => {
      console.error(`${SERVICE_TAG} Pool error: ${err.message}`);
      dbAvailable = false;
    });

    dbAvailable = true;
    console.log(`${SERVICE_TAG} PostgreSQL pool initialized (cache TTL: ${CACHE_TTL_MS}ms)`);
    return pool;
  } catch (err: any) {
    console.error(`${SERVICE_TAG} Failed to create pool: ${err.message}`);
    return null;
  }
}

// ─── Tier 0: RadAcct (RADIUS accounting) ───────────────────────────────────
async function resolveViaRadAcct(
  client: PoolClient,
  ips: string[],
): Promise<Map<string, GuestInfo>> {
  const result = new Map<string, GuestInfo>();

  if (ips.length === 0) return result;

  // Single query: RadAcct → WiFiUser → Guest, RadAcct.MAC → RadiusMacAuth → Guest,
  // Guest → GuestStay → Booking → Room
  const { rows } = await client.query(
    `
    SELECT DISTINCT ON (ra."framedipaddress")
      ra."framedipaddress" AS ip,
      ra.username,
      ra."callingstationid" AS mac,
      COALESCE(
        g_wu."firstName" || ' ' || g_wu."lastName",
        ma."guestName",
        g_ma."firstName" || ' ' || g_ma."lastName",
        ra.username
      ) AS guest_name,
      rm."number" AS room_number
    FROM "RadAcct" ra
    LEFT JOIN "WiFiUser" wu ON wu.username = ra.username
    LEFT JOIN "Guest" g_wu ON g_wu.id = wu."guestId"
    LEFT JOIN "RadiusMacAuth" ma ON ma."macAddress" = ra."callingstationid" AND ma."guestName" IS NOT NULL
    LEFT JOIN "Guest" g_ma ON g_ma.id = ma."guestId"
    LEFT JOIN LATERAL (
      SELECT gs_sub."bookingId"
      FROM "GuestStay" gs_sub
      WHERE gs_sub."guestId" = COALESCE(g_wu.id, g_ma.id)
      LIMIT 1
    ) gs ON true
    LEFT JOIN "Booking" b ON b.id = gs."bookingId" AND b."roomId" IS NOT NULL
    LEFT JOIN "Room" rm ON rm.id = b."roomId"
    WHERE ra."framedipaddress" = ANY($1)
      AND ra."acctstarttime" >= NOW() - INTERVAL '90 days'
      AND ra."acctstarttime" <= NOW()
    ORDER BY ra."framedipaddress", ra."acctstarttime" DESC
    `,
    [ips],
  );

  for (const row of rows) {
    if (row.guest_name && row.guest_name.trim()) {
      result.set(row.ip, {
        guest_name: row.guest_name.trim(),
        room_number: row.room_number || "",
        username: row.username || "",
        mac_address: row.mac || "",
      });
    }
  }

  return result;
}

// ─── Tier 1: WiFiSession (captive portal) ──────────────────────────────────
async function resolveViaWiFiSession(
  client: PoolClient,
  ips: string[],
): Promise<Map<string, GuestInfo>> {
  const result = new Map<string, GuestInfo>();

  if (ips.length === 0) return result;

  const { rows } = await client.query(
    `
    SELECT DISTINCT ON (ws."ipAddress")
      ws."ipAddress" AS ip,
      ws.username,
      ws."macAddress" AS mac,
      COALESCE(
        g."firstName" || ' ' || g."lastName",
        ws.username
      ) AS guest_name,
      rm."number" AS room_number
    FROM "WiFiSession" ws
    LEFT JOIN "Guest" g ON g.id = ws."guestId"
    LEFT JOIN LATERAL (
      SELECT gs_sub."bookingId"
      FROM "GuestStay" gs_sub
      WHERE gs_sub."guestId" = ws."guestId"
      LIMIT 1
    ) gs ON true
    LEFT JOIN "Booking" b ON b.id = gs."bookingId" AND b."roomId" IS NOT NULL
    LEFT JOIN "Room" rm ON rm.id = b."roomId"
    WHERE ws."ipAddress" = ANY($1)
      AND ws."startTime" <= NOW()
      AND (ws."endTime" IS NULL OR ws."endTime" >= NOW())
    ORDER BY ws."ipAddress", ws."startTime" DESC
    `,
    [ips],
  );

  for (const row of rows) {
    if (row.guest_name && row.guest_name.trim()) {
      result.set(row.ip, {
        guest_name: row.guest_name.trim(),
        room_number: row.room_number || "",
        username: row.username || "",
        mac_address: row.mac || "",
      });
    }
  }

  return result;
}

// ─── Tier 2: DhcpLease → DeviceProfile ─────────────────────────────────────
async function resolveViaDhcp(
  client: PoolClient,
  ips: string[],
): Promise<Map<string, GuestInfo>> {
  const result = new Map<string, GuestInfo>();

  if (ips.length === 0) return result;

  const { rows } = await client.query(
    `
    SELECT DISTINCT ON (dl."ipAddress")
      dl."ipAddress" AS ip,
      dl."macAddress" AS mac,
      COALESCE(
        g_dp."firstName" || ' ' || g_dp."lastName",
        g_wu."firstName" || ' ' || g_wu."lastName",
        wu.username
      ) AS guest_name,
      rm."number" AS room_number
    FROM "DhcpLease" dl
    LEFT JOIN "DeviceProfile" dp ON dp."macAddress" = dl."macAddress" AND dp."isActive" = true
    LEFT JOIN "WiFiUser" wu ON wu.id = dp."wifiUserId"
    LEFT JOIN "Guest" g_wu ON g_wu.id = wu."guestId"
    LEFT JOIN "Guest" g_dp ON g_dp.id = dp."guestId"
    LEFT JOIN LATERAL (
      SELECT gs_sub."bookingId"
      FROM "GuestStay" gs_sub
      WHERE gs_sub."guestId" = COALESCE(g_dp.id, g_wu.id)
      LIMIT 1
    ) gs ON true
    LEFT JOIN "Booking" b ON b.id = gs."bookingId" AND b."roomId" IS NOT NULL
    LEFT JOIN "Room" rm ON rm.id = b."roomId"
    WHERE dl."ipAddress" = ANY($1)
      AND dl.state = 'active'
    ORDER BY dl."ipAddress", dl."lastSeenAt" DESC
    `,
    [ips],
  );

  for (const row of rows) {
    if (row.guest_name && row.guest_name.trim()) {
      result.set(row.ip, {
        guest_name: row.guest_name.trim(),
        room_number: row.room_number || "",
        username: row.username || "",
        mac_address: row.mac || "",
      });
    }
  }

  return result;
}

// ─── Public API ─────────────────────────────────────────────────────────────

const EMPTY_GUEST: GuestInfo = {
  guest_name: "",
  room_number: "",
  username: "",
  mac_address: "",
};

/**
 * Batch-resolve IP addresses to guest information.
 * Uses cache (TTL-based) and falls back through 3 lookup tiers.
 *
 * @param events - Array of conntrack events with src_ip field
 * @returns Map<src_ip, GuestInfo> (empty GuestInfo for unresolved IPs)
 */
export async function enrichEventsWithGuestInfo(
  events: Array<{ src_ip: string }>,
): Promise<Map<string, GuestInfo>> {
  const result = new Map<string, GuestInfo>();

  if (!events || events.length === 0) return result;

  const poolClient = getPool();
  if (!poolClient) {
    // Database not available — return empty guest info for all
    for (const e of events) {
      result.set(e.src_ip, EMPTY_GUEST);
    }
    return result;
  }

  // Collect unique IPs that need resolution
  const unresolvedIps: string[] = [];
  for (const e of events) {
    const ip = e.src_ip;
    if (!ip) continue;

    // Check cache first
    const cached = getCached(ip);
    if (cached) {
      result.set(ip, cached);
    } else {
      unresolvedIps.push(ip);
    }
  }

  if (unresolvedIps.length === 0) return result;

  // Deduplicate
  const uniqueIps = [...new Set(unresolvedIps)];

  try {
    const client = await poolClient.connect();
    try {
      let resolved = 0;

      // Tier 0: RadAcct
      const radResults = await resolveViaRadAcct(client, uniqueIps);
      const tier1Ips = uniqueIps.filter((ip) => !radResults.has(ip));
      for (const [ip, info] of radResults) {
        result.set(ip, info);
        setCached(ip, info);
        resolved++;
      }

      // Tier 1: WiFiSession (only unresolved IPs)
      if (tier1Ips.length > 0) {
        const sessionResults = await resolveViaWiFiSession(client, tier1Ips);
        const tier2Ips = tier1Ips.filter((ip) => !sessionResults.has(ip));
        for (const [ip, info] of sessionResults) {
          result.set(ip, info);
          setCached(ip, info);
          resolved++;
        }

        // Tier 2: DhcpLease (only unresolved IPs)
        if (tier2Ips.length > 0) {
          const dhcpResults = await resolveViaDhcp(client, tier2Ips);
          for (const [ip, info] of dhcpResults) {
            result.set(ip, info);
            setCached(ip, info);
            resolved++;
          }
        }
      }

      // For still-unresolved IPs, cache empty result for 30s (shorter TTL to retry sooner)
      for (const ip of uniqueIps) {
        if (!result.has(ip)) {
          result.set(ip, EMPTY_GUEST);
          cache.set(ip, { info: EMPTY_GUEST, expiresAt: Date.now() + 30000 });
        }
      }

      console.log(
        `${SERVICE_TAG} Resolved ${resolved}/${uniqueIps.length} IPs ` +
        `(cache=${cache.size}, pool active)`,
      );
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(`${SERVICE_TAG} Database query error: ${err.message}`);
    // Return empty guest info for all on error
    for (const ip of uniqueIps) {
      if (!result.has(ip)) {
        result.set(ip, EMPTY_GUEST);
      }
    }
  }

  return result;
}

/**
 * Get current cache statistics for health/metrics endpoints.
 */
export function getCacheStats(): { size: number; maxSize: number; ttlMs: number } {
  cleanCache();
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    ttlMs: CACHE_TTL_MS,
  };
}

/**
 * Clear the entire guest enrichment cache (useful for testing).
 */
export function clearGuestCache(): void {
  cache.clear();
  console.log(`${SERVICE_TAG} Cache cleared`);
}
