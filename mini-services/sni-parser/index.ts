/**
 * sni-parser — TLS SNI log parser for StaySuite IPDR pipeline
 *
 * Tails a JSON-lines log file of TLS ClientHello SNI events,
 * parses and aggregates them, and batches them into ClickHouse ipdr.sni_log.
 *
 * Port: 3022 (env PORT)
 * Log file: env SNI_LOG_FILE (default /var/log/ulogd2/sni.json)
 * ClickHouse: env CLICKHOUSE_URL (default http://127.0.0.1:8123)
 */

// ─── Configuration ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3022", 10);
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || "http://127.0.0.1:8123";
// Log file path — supports ulogd2 PRINTSNI output, simple JSON, and raw NFLOG JSON
const SNI_LOG_FILE = process.env.SNI_LOG_FILE || "/var/log/ulogd2/sni.json";
// Log format: "simple" = pre-parsed {sni_domain,...}, "ulogd2" = raw NFLOG JSON with raw.pkt hex
// Auto-detected if not set: if file has "sni.hostname" → printsni, if has "raw.pkt" → ulogd2, else simple
const SNI_LOG_FORMAT = process.env.SNI_LOG_FORMAT || "auto";
const RING_BUFFER_SIZE = 5000;
const BATCH_INTERVAL_MS = 2000;
const BATCH_MAX_SIZE = 500;
const FILE_POLL_INTERVAL_MS = 500;
const SERVICE_NAME = "sni-parser";

// Maximum file size to process from the beginning (100 MB).
// If the log file is larger than this on startup, we skip to the end
// to avoid re-processing a huge backlog (which caused the 1.6GB hang).
const MAX_STARTUP_READ_BYTES = 100 * 1024 * 1024;

// Runtime warning threshold (500 MB) — logged once when exceeded during polling.
const RUNTIME_SIZE_WARN_BYTES = 500 * 1024 * 1024;
let runtimeSizeWarned = false;

// ─── TLS version map ────────────────────────────────────────────────────────
const TLS_VERSION_MAP: Record<number, string> = {
  0x0300: "SSLv3",
  0x0301: "TLSv1.0",
  0x0302: "TLSv1.1",
  0x0303: "TLSv1.2",
  0x0304: "TLSv1.3",
};

function normalizeTlsVersion(v: number): string {
  return TLS_VERSION_MAP[v] || `0x${v.toString(16).padStart(4, "0")}`;
}

// ─── TLS ClientHello SNI parser (for future PCAP mode) ─────────────────────
function extractTlsVersion(buf: Uint8Array): string {
  if (buf.length < 44) return "unknown";

  // Skip: ETH(14) + IP(20) + TCP(20) = 54 bytes to reach TLS record
  // But some packets may not have ETH header, try both offsets
  const offsets = [42, 54]; // with/without ETH header

  for (const offset of offsets) {
    if (offset + 3 > buf.length) continue;

    // TLS Content Type
    if (buf[offset] !== 0x16) continue;

    // TLS Version in record header
    const version = (buf[offset + 1] << 8) | buf[offset + 2];
    return normalizeTlsVersion(version);
  }

  return "unknown";
}

function extractSni(buf: Uint8Array): string {
  if (buf.length < 60) return "";

  // Skip: ETH(14) + IP(20) + TCP(20) = 54 bytes to reach TLS record
  // Also try offset 42 for packets without ETH header
  const offsets = [42, 54];

  for (const baseOffset of offsets) {
    if (baseOffset + 5 > buf.length) continue;

    // Check TLS Content-Type = 0x16 (Handshake)
    if (buf[baseOffset] !== 0x16) continue;

    // Skip TLS Record header: type(1) + version(2) + length(2) = 5 bytes
    const hsOffset = baseOffset + 5;
    if (hsOffset + 1 > buf.length) continue;

    // Check Handshake Type = 0x01 (ClientHello)
    if (buf[hsOffset] !== 0x01) continue;

    // Skip handshake header: type(1) + length(3) = 4 bytes
    let pos = hsOffset + 4;

    // Check we have enough room for version(2) + random(32)
    if (pos + 34 > buf.length) continue;

    // Skip client version (2) and random (32)
    pos += 34;

    // Session ID length
    if (pos >= buf.length) continue;
    const sessionIdLen = buf[pos];
    pos += 1 + sessionIdLen;

    // Cipher suites length (2 bytes)
    if (pos + 2 > buf.length) continue;
    const cipherSuitesLen = (buf[pos] << 8) | buf[pos + 1];
    pos += 2 + cipherSuitesLen;

    // Compression methods length
    if (pos + 1 > buf.length) continue;
    const compMethodsLen = buf[pos];
    pos += 1 + compMethodsLen;

    // Extensions length (2 bytes)
    if (pos + 2 > buf.length) continue;
    const extensionsLen = (buf[pos] << 8) | buf[pos + 1];
    pos += 2;

    const extensionsEnd = pos + extensionsLen;

    // Walk through extensions looking for SNI (type 0x0000)
    while (pos + 4 <= extensionsEnd && pos + 4 <= buf.length) {
      const extType = (buf[pos] << 8) | buf[pos + 1];
      const extLen = (buf[pos + 2] << 8) | buf[pos + 3];
      pos += 4;

      if (extType === 0x0000 && pos + 5 <= buf.length) {
        // SNI extension found
        // Server Name List Length (2 bytes)
        // Server Name Type (1 byte) — 0 = hostname
        // Server Name Length (2 bytes)
        // Server Name (variable)

        const sniListLen = (buf[pos] << 8) | buf[pos + 1];
        if (sniListLen < 5) continue;

        const nameType = buf[pos + 2];
        if (nameType !== 0x00) continue; // only hostname

        const nameLen = (buf[pos + 3] << 8) | buf[pos + 4];
        const nameStart = pos + 5;

        if (nameStart + nameLen > buf.length) continue;

        return new TextDecoder().decode(buf.slice(nameStart, nameStart + nameLen));
      }

      pos += extLen;
    }
  }

  return "";
}

// ─── Ring Buffer ────────────────────────────────────────────────────────────
class RingBuffer<T> {
  private buffer: T[] = [];
  private size: number;

  constructor(size: number) {
    this.size = size;
  }

  push(item: T): void {
    if (this.buffer.length >= this.size) {
      this.buffer.shift();
    }
    this.buffer.push(item);
  }

  getLast(n: number): T[] {
    if (n >= this.buffer.length) return [...this.buffer];
    return this.buffer.slice(-n);
  }

  get length(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
  }
}

// ─── State ──────────────────────────────────────────────────────────────────
const ringBuffer = new RingBuffer<any>(RING_BUFFER_SIZE);
let batch: any[] = [];
let batchTimer: ReturnType<typeof setInterval> | null = null;
let fileWatcher: ReturnType<typeof setInterval> | null = null;
let currentFilePos = 0;
let currentInode = "";
let totalEvents = 0;
let totalBatches = 0;
let totalClickHouseErrors = 0;
let totalParseErrors = 0;

// Aggregates
const topDomains = new Map<string, number>();
const topDestinations = new Map<string, number>();
const topSources = new Map<string, number>();
const topPorts = new Map<number, number>();

// ─── dst_ip → SNI domain cache ───────────────────────────────────────────────
// When a ClientHello carries SNI (e.g. dst_ip=142.250.80.14 → www.google.com),
// we cache that mapping. Subsequent data packets to the same dst_ip (which have
// empty sni.hostname) are then enriched with the cached domain. This turns the
// ~97% of non-SNI packets into useful bandwidth-per-domain data.
// TTL: 4 hours — stale mappings expire to handle CDN IP reuse.
const DST_DOMAIN_CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const dstDomainCache = new Map<string, { domain: string; ts: number }>();
let cacheHits = 0;
let cacheMisses = 0;

function cacheDstDomain(dstIp: string, domain: string): void {
  dstDomainCache.set(dstIp, { domain, ts: Date.now() });
}

function lookupCachedDomain(dstIp: string): string | null {
  const entry = dstDomainCache.get(dstIp);
  if (!entry) return null;
  if (Date.now() - entry.ts > DST_DOMAIN_CACHE_TTL_MS) {
    dstDomainCache.delete(dstIp);
    return null;
  }
  return entry.domain;
}

// ─── SNI record parser ─────────────────────────────────────────────────────

/**
 * Parse an ulogd2 JSONLOG line (raw NFLOG fields with raw.pkt hex payload).
 * Extracts SNI from the TLS ClientHello in the raw packet data.
 *
 * ulogd2 JSON format example:
 * { "oob.time.sec":1234567890, "raw.pkt":"4500...", "ip.saddr":"10.0.1.101",
 *   "ip.daddr":"142.250.80.14", "tcp.sport":52341, "tcp.dport":443 }
 */
function parseUlogd2Record(obj: Record<string, unknown>): any | null {
  // Extract raw packet hex string
  const rawPktHex = String(obj["raw.pkt"] || "");
  if (!rawPktHex || rawPktHex.length < 100) return null;

  // Convert hex to Uint8Array
  const pktLen = rawPktHex.length / 2;
  const buf = new Uint8Array(pktLen);
  for (let i = 0; i < pktLen; i++) {
    buf[i] = parseInt(rawPktHex.substring(i * 2, i * 2 + 2), 16);
  }

  // Extract SNI and TLS version from raw packet
  const sniDomain = extractSni(buf);
  if (!sniDomain) return null; // Skip non-TLS or packets without SNI

  const tlsVersion = extractTlsVersion(buf);

  // Extract IP addresses from ulogd2 fields (dot-notation keys)
  const srcIp = String(obj["ip.saddr"] || obj["oob.in"] || "");
  const dstIp = String(obj["ip.daddr"] || "");
  const dstPort = parseInt(String(obj["tcp.dport"] || obj["udp.dport"] || "443"), 10);

  // Timestamp: ulogd2 gives unix epoch seconds, optionally with microseconds
  const timeSec = Number(obj["oob.time.sec"] || 0);
  const timeUsec = Number(obj["oob.time.usec"] || 0);
  const timestamp = timeSec
    ? new Date(timeSec * 1000 + Math.floor(timeUsec / 1000)).toISOString()
    : new Date().toISOString();

  return {
    timestamp,
    src_ip: srcIp,
    src_port: 0,
    dst_ip: dstIp,
    dst_port: dstPort || 443,
    in_iface: "",
    sni_domain: sniDomain,
    tls_version: tlsVersion,
    ja3_hash: "",
  };
}

/**
 * Parse a simple JSON record (pre-parsed SNI, no raw packet).
 * Format: { "timestamp": "...", "src_ip": "...", "sni_domain": "...", ... }
 */
function parseSimpleRecord(obj: Record<string, unknown>): any | null {
  return {
    timestamp: String(obj.timestamp || new Date().toISOString()),
    src_ip: String(obj.src_ip || ""),
    src_port: parseInt(String(obj.src_port), 10) || 0,
    dst_ip: String(obj.dst_ip || ""),
    dst_port: parseInt(String(obj.dst_port), 10) || 443,
    in_iface: String(obj.in_iface || ""),
    sni_domain: String(obj.sni_domain || ""),
    tls_version: String(obj.tls_version || "unknown"),
    ja3_hash: String(obj.ja3_hash || ""),
  };
}

/**
 * Parse ulogd2 PRINTSNI output (the format our ulogd2 stack produces).
 * Fields: sni.hostname, sni.tls.version, src_ip, dest_ip, timestamp, raw.pktlen, oob.in
 * This is the standard StaySuite ulogd2 stack: NFLOG → inp:ip → PRINTSNI → JSON
 *
 * KEY: ulogd2 captures ALL port-443 packets, but only ClientHello has SNI.
 * The ~97% of data packets with empty sni.hostname are enriched via the
 * dst_ip → domain cache (populated from earlier ClientHello entries).
 */
function parsePrintsniRecord(obj: Record<string, unknown>): any | null {
  const srcIp = String(obj.src_ip || obj["ip.saddr"] || "");
  const dstIp = String(obj.dest_ip || obj.dst_ip || obj["ip.daddr"] || "");

  // Skip entries without src/dst IP
  if (!srcIp || !dstIp) return null;

  const srcPort = parseInt(String(obj.src_port || obj["tcp.sport"] || "0"), 10) || 0;
  const dstPort = parseInt(String(obj.dest_port || obj["tcp.dport"] || "443"), 10);
  const inIface = String(obj["oob.in"] || "");
  const tlsVersion = String(obj["sni.tls.version"] || obj.tls_version || "unknown");

  // Packet bytes from raw.pktlen or ip.totlen
  const packetBytes = parseInt(String(obj["raw.pktlen"] || obj["ip.totlen"] || "0"), 10) || 0;

  // Timestamp: ulogd2 outputs ISO-like string or epoch seconds
  let timestamp: string;
  const tsRaw = String(obj.timestamp || "");
  if (tsRaw && !isNaN(Date.parse(tsRaw))) {
    timestamp = new Date(tsRaw).toISOString();
  } else {
    const timeSec = Number(obj.timestamp || obj["oob.time.sec"] || 0);
    timestamp = timeSec ? new Date(timeSec * 1000).toISOString() : new Date().toISOString();
  }

  // Check for direct SNI hostname from ClientHello
  let sniDomain = String(obj["sni.hostname"] || obj["sni_domain"] || "").trim();

  if (sniDomain) {
    // ClientHello with SNI — cache the dst_ip → domain mapping
    cacheDstDomain(dstIp, sniDomain);
  } else {
    // Data packet (no SNI) — look up domain from cache
    sniDomain = lookupCachedDomain(dstIp) || "";
    if (sniDomain) {
      cacheHits++;
    } else {
      cacheMisses++;
    }
  }

  // Only return entries with a resolved domain
  if (!sniDomain) return null;

  return {
    timestamp,
    src_ip: srcIp,
    src_port: srcPort,
    dst_ip: dstIp,
    dst_port: dstPort || 443,
    in_iface: inIface,
    sni_domain: sniDomain,
    tls_version: tlsVersion,
    packet_bytes: packetBytes,
    ja3_hash: "",
  };
}

// Track detected format for auto-detection
let detectedFormat: string | null = null;

function parseSniRecord(line: string): any | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  try {
    const obj = JSON.parse(trimmed);

    // Auto-detect format on first non-empty record
    if (!detectedFormat) {
      if (SNI_LOG_FORMAT !== "auto") {
        detectedFormat = SNI_LOG_FORMAT;
      } else if (obj["sni.hostname"]) {
        detectedFormat = "printsni";
        console.log(`[${SERVICE_NAME}] Auto-detected log format: printsni (ulogd2 PRINTSNI output)`);
      } else if (obj["raw.pkt"]) {
        detectedFormat = "ulogd2";
        console.log(`[${SERVICE_NAME}] Auto-detected log format: ulogd2 (raw NFLOG packet hex)`);
      } else {
        detectedFormat = "simple";
        console.log(`[${SERVICE_NAME}] Auto-detected log format: simple (pre-parsed JSON)`);
      }
    }

    let record: any;
    if (detectedFormat === "printsni" || obj["sni.hostname"]) {
      record = parsePrintsniRecord(obj);
    } else if (detectedFormat === "ulogd2" || obj["raw.pkt"] || obj["oob.time.sec"]) {
      record = parseUlogd2Record(obj);
    } else {
      record = parseSimpleRecord(obj);
    }

    if (!record) return null;

    // Skip records without SNI domain (already handled in parsePrintsniRecord,
    // but other parsers may return records without domain)
    if (!record.sni_domain) return null;

    // Update aggregates
    if (record.sni_domain) {
      topDomains.set(
        record.sni_domain,
        (topDomains.get(record.sni_domain) || 0) + 1
      );
    }
    if (record.dst_ip) {
      topDestinations.set(
        record.dst_ip,
        (topDestinations.get(record.dst_ip) || 0) + 1
      );
    }
    if (record.src_ip) {
      topSources.set(
        record.src_ip,
        (topSources.get(record.src_ip) || 0) + 1
      );
    }
    topPorts.set(record.dst_port, (topPorts.get(record.dst_port) || 0) + 1);

    return record;
  } catch {
    totalParseErrors++;
    return null;
  }
}

// ─── ClickHouse helpers ─────────────────────────────────────────────────────
async function ensureClickHouseTable(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS ipdr.sni_log (
      timestamp DateTime,
      src_ip String,
      src_port UInt16 DEFAULT 0,
      dst_ip String,
      dst_port UInt16,
      in_iface String DEFAULT '',
      sni_domain String,
      tls_version String,
      ja3_hash String DEFAULT '',
      packet_bytes UInt32 DEFAULT 0
    )
    ENGINE = MergeTree()
    PARTITION BY toYYYYMMDD(timestamp)
    ORDER BY (timestamp, src_ip, sni_domain)
    TTL timestamp + INTERVAL 13 MONTH
  `;

  try {
    const res = await fetch(CLICKHOUSE_URL, {
      method: "POST",
      body: sql,
    });
    if (res.ok) {
      console.log(`[${SERVICE_NAME}] ClickHouse table ipdr.sni_log ensured`);
    } else {
      console.error(
        `[${SERVICE_NAME}] ClickHouse table creation error: ${await res.text()}`
      );
    }

    // Migration: add new columns if they don't exist (for existing installs)
    const migrations = [
      "ALTER TABLE ipdr.sni_log ADD COLUMN IF NOT EXISTS packet_bytes UInt32 DEFAULT 0",
      "ALTER TABLE ipdr.sni_log ADD COLUMN IF NOT EXISTS src_port UInt16 DEFAULT 0",
      "ALTER TABLE ipdr.sni_log ADD COLUMN IF NOT EXISTS in_iface String DEFAULT ''",
    ];
    for (const sql of migrations) {
      try {
        const alterRes = await fetch(CLICKHOUSE_URL, { method: "POST", body: sql });
        if (alterRes.ok) {
          const colName = sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1] || '?';
          console.log(`[${SERVICE_NAME}] ClickHouse migration: ${colName} column ensured`);
        }
      } catch {
        // Non-critical migration
      }
    }
  } catch (err: any) {
    console.error(
      `[${SERVICE_NAME}] ClickHouse connection error (table creation): ${err.message}`
    );
  }
}

async function flushBatch(): Promise<void> {
  if (batch.length === 0) return;

  const items = [...batch];
  batch = [];
  totalBatches++;

  /** Convert ISO 8601 to ClickHouse DateTime format (YYYY-MM-DD HH:MM:SS) */
  function fmtTs(iso: string): string {
    return iso.replace('T', ' ').replace('Z', '').replace(/\.\d{3}$/, '').slice(0, 19);
  }

  const values = items
    .map(
      (e) =>
        `('${fmtTs(e.timestamp)}', '${e.src_ip}', ${e.src_port || 0}, '${e.dst_ip}', ${e.dst_port}, ` +
        `'${escapeSql(e.in_iface || "")}', '${escapeSql(e.sni_domain)}', '${escapeSql(e.tls_version)}', '${escapeSql(e.ja3_hash)}', ${e.packet_bytes || 0})`
    )
    .join(",");

  const sql = `INSERT INTO ipdr.sni_log (timestamp, src_ip, src_port, dst_ip, dst_port, in_iface, sni_domain, tls_version, ja3_hash, packet_bytes) VALUES ${values}`;

  try {
    const res = await fetch(CLICKHOUSE_URL, {
      method: "POST",
      body: sql,
    });
    if (!res.ok) {
      totalClickHouseErrors++;
      console.error(
        `[${SERVICE_NAME}] ClickHouse INSERT error: ${await res.text()}`
      );
    } else {
      console.log(
        `[${SERVICE_NAME}] Flushed ${items.length} events to ClickHouse`
      );
    }
  } catch (err: any) {
    totalClickHouseErrors++;
    console.error(
      `[${SERVICE_NAME}] ClickHouse flush error: ${err.message}`
    );
  }
}

function escapeSql(str: string): string {
  return str.replace(/'/g, "\\'");
}

// ─── File watcher ───────────────────────────────────────────────────────────
async function checkLogFile(): Promise<void> {
  try {
    const stat = await Bun.file(SNI_LOG_FILE).stat();
    const inode = `${stat.dev}:${stat.ino}`;

    // Detect log rotation
    if (currentInode && currentInode !== inode) {
      console.log(`[${SERVICE_NAME}] Log rotation detected, resetting file position`);
      currentFilePos = 0;
    }
    currentInode = inode;

    // Runtime size warning (log once)
    if (!runtimeSizeWarned && stat.size > RUNTIME_SIZE_WARN_BYTES) {
      const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
      console.warn(
        `[${SERVICE_NAME}] ⚠️  Log file grown to ${sizeMB}MB — add logrotate for ${SNI_LOG_FILE}. ` +
        `Run: echo '/var/log/ulogd2/*.json { daily rotate 7 compress copytruncate maxsize 200M missingok }' > /etc/logrotate.d/staysuite-ulogd2`
      );
      runtimeSizeWarned = true;
    }

    if (stat.size <= currentFilePos) return;

    const file = Bun.file(SNI_LOG_FILE);
    const slice = (file as any).slice(currentFilePos, stat.size) as BunFile;
    const text = await slice.text();

    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const record = parseSniRecord(trimmed);
      if (record) {
        ringBuffer.push(record);
        batch.push(record);
        totalEvents++;
        if (batch.length >= BATCH_MAX_SIZE) {
          flushBatch();
        }
      }
    }

    currentFilePos = stat.size;
  } catch {
    // File may not exist yet, silently ignore
  }
}

// ─── CORS helper ────────────────────────────────────────────────────────────
function corsHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(),
  });
}

// ─── HTTP Server ────────────────────────────────────────────────────────────
function startServer(): void {
  const server = Bun.serve({
    port: PORT,
    fetch(req: Request): Response {
      const url = new URL(req.url);

      // CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      // Health check
      if (url.pathname === "/api/health") {
        return json({
          service: SERVICE_NAME,
          status: "running",
          port: PORT,
          logFile: SNI_LOG_FILE,
          logFormat: SNI_LOG_FORMAT,
          uptime: process.uptime(),
          eventsProcessed: totalEvents,
          ringBufferSize: ringBuffer.length,
          pendingBatch: batch.length,
          batchesFlushed: totalBatches,
          clickHouseErrors: totalClickHouseErrors,
          parseErrors: totalParseErrors,
          filePosition: currentFilePos,
          domainCacheSize: dstDomainCache.size,
          domainCacheHits: cacheHits,
          domainCacheMisses: cacheMisses,
        });
      }

      // Ingest endpoint
      if (url.pathname === "/api/ingest" && req.method === "POST") {
        return handleIngest(req);
      }

      // Live events
      if (url.pathname === "/api/live") {
        const limit = Math.min(
          parseInt(url.searchParams.get("limit") || "50", 10),
          RING_BUFFER_SIZE
        );
        let events = ringBuffer.getLast(limit);

        // Apply filters
        const filterDomain = url.searchParams.get("domain");
        const filterSrcIp = url.searchParams.get("src_ip");
        const filterTlsVersion = url.searchParams.get("tls_version");

        if (filterDomain) {
          events = events.filter((e: any) =>
            e.sni_domain.toLowerCase().includes(filterDomain.toLowerCase())
          );
        }
        if (filterSrcIp) {
          events = events.filter((e: any) => e.src_ip === filterSrcIp);
        }
        if (filterTlsVersion) {
          events = events.filter((e: any) =>
            e.tls_version.toLowerCase().includes(filterTlsVersion.toLowerCase())
          );
        }

        return json({
          count: events.length,
          events,
        });
      }

      // Stats
      if (url.pathname === "/api/stats") {
        return json({
          totalEvents,
          uniqueDomains: topDomains.size,
          uniqueDestinations: topDestinations.size,
          domainCacheSize: dstDomainCache.size,
          domainCacheHits: cacheHits,
          domainCacheMisses: cacheMisses,
          uniqueSources: topSources.size,
          batchesFlushed: totalBatches,
          clickHouseErrors: totalClickHouseErrors,
          parseErrors: totalParseErrors,
          topDomains: [...topDomains.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([domain, count]) => ({ domain, count })),
          topDestinations: [...topDestinations.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([ip, count]) => ({ ip, count })),
          topSources: [...topSources.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([ip, count]) => ({ ip, count })),
          topPorts: [...topPorts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([port, count]) => ({ port, count })),
        });
      }

      return json({ error: "Not Found" }, 404);
    },
  });

  console.log(`[${SERVICE_NAME}] HTTP server listening on port ${PORT}`);
}

// ─── Ingest handler ─────────────────────────────────────────────────────────
async function handleIngest(req: Request): Promise<Response> {
  try {
    const contentType = req.headers.get("content-type") || "";
    const body = await req.text();
    let records: any[] = [];

    if (contentType.includes("application/json")) {
      const parsed = JSON.parse(body);
      if (Array.isArray(parsed)) {
        records = parsed;
      } else {
        records = [parsed];
      }
    } else {
      // NDJSON
      const lines = body.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          records.push(JSON.parse(trimmed));
        } catch {
          totalParseErrors++;
        }
      }
    }

    if (records.length === 0) {
      return json({ error: "No records provided" }, 400);
    }

    let ingested = 0;
    for (const rawRecord of records) {
      const line = JSON.stringify(rawRecord);
      const record = parseSniRecord(line);
      if (record) {
        ringBuffer.push(record);
        batch.push(record);
        totalEvents++;
        ingested++;
        if (batch.length >= BATCH_MAX_SIZE) {
          flushBatch();
        }
      }
    }

    return json({
      ingested,
      total: records.length,
      errors: records.length - ingested,
    });
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
}

// ─── Graceful shutdown ──────────────────────────────────────────────────────
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[${SERVICE_NAME}] Received ${signal}, shutting down gracefully...`);

  if (batchTimer) clearInterval(batchTimer);
  if (fileWatcher) clearInterval(fileWatcher);

  // Flush remaining batch
  if (batch.length > 0) {
    console.log(`[${SERVICE_NAME}] Flushing ${batch.length} pending events...`);
    await flushBatch();
  }

  console.log(`[${SERVICE_NAME}] Shutdown complete. Total events: ${totalEvents}`);
  process.exit(0);
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`[${SERVICE_NAME}] Starting sni-parser service...`);
  console.log(`[${SERVICE_NAME}] Port: ${PORT}, Log: ${SNI_LOG_FILE}, Format: ${SNI_LOG_FORMAT}, ClickHouse: ${CLICKHOUSE_URL}`);

  // Ensure ClickHouse table
  await ensureClickHouseTable();

  // Start batch flush timer
  batchTimer = setInterval(() => {
    flushBatch();
  }, BATCH_INTERVAL_MS);

  // Start file watcher
  console.log(`[${SERVICE_NAME}] Watching log file: ${SNI_LOG_FILE}`);
  fileWatcher = setInterval(checkLogFile, FILE_POLL_INTERVAL_MS);

  // Initial file position — with large-file safeguard
  try {
    const stat = await Bun.file(SNI_LOG_FILE).stat();
    currentInode = `${stat.dev}:${stat.ino}`;

    if (stat.size > MAX_STARTUP_READ_BYTES) {
      // File is too large to reprocess. Skip to the end to avoid hanging.
      // Only recent events matter for the Web Surfing report (30-day window).
      const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
      console.warn(
        `[${SERVICE_NAME}] ⚠️  Log file is ${sizeMB}MB — exceeds ${MAX_STARTUP_READ_BYTES / (1024 * 1024)}MB startup limit. ` +
        `Skipping to end. Consider adding logrotate for ${SNI_LOG_FILE}. ` +
        `Run: truncate -s 0 ${SNI_LOG_FILE}  if stale data is not needed.`
      );
      currentFilePos = stat.size;
    } else {
      // Small enough to read from beginning on startup
      currentFilePos = 0;
      console.log(`[${SERVICE_NAME}] Starting from file position: ${currentFilePos} (file ${stat.size} bytes)`);
    }
  } catch {
    console.log(
      `[${SERVICE_NAME}] Log file not found yet, will start watching when it appears`
    );
  }

  // Start HTTP server
  startServer();

  // Register shutdown handlers
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(`[${SERVICE_NAME}] Fatal error: ${err.message}`);
  process.exit(1);
});
