/**
 * dns-parser — DNS query log parser for StaySuite IPDR pipeline
 *
 * Tails a JSON-lines log file of DNS queries, parses and aggregates them,
 * and batches them into ClickHouse ipdr.dns_cache.
 *
 * Port: 3021 (env PORT)
 * Log file: env DNS_LOG_FILE (default /var/log/dns-queries.log)
 * ClickHouse: env CLICKHOUSE_URL (default http://127.0.0.1:8123)
 */

// ─── Configuration ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3021", 10);
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || "http://127.0.0.1:8123";
const DNS_LOG_FILE = process.env.DNS_LOG_FILE || "/var/log/dns-queries.log";
const RING_BUFFER_SIZE = 5000;
const BATCH_INTERVAL_MS = 2000;
const BATCH_MAX_SIZE = 500;
const FILE_POLL_INTERVAL_MS = 500;
const SERVICE_NAME = "dns-parser";

// ─── DNS query type mapping (~46 types) ─────────────────────────────────────
const DNS_QUERY_TYPES: Record<string, number> = {
  A: 1,
  NS: 2,
  MD: 3,
  MF: 4,
  CNAME: 5,
  SOA: 6,
  MB: 7,
  MG: 8,
  MR: 9,
  NULL: 10,
  WKS: 11,
  PTR: 12,
  HINFO: 13,
  MINFO: 14,
  MX: 15,
  TXT: 16,
  RP: 17,
  AFSDB: 18,
  X25: 19,
  ISDN: 20,
  RT: 21,
  NSAP: 22,
  NSAP_PTR: 23,
  SIG: 24,
  KEY: 25,
  PX: 26,
  GPOS: 27,
  AAAA: 28,
  LOC: 29,
  NXT: 30,
  EID: 31,
  NIMLOC: 32,
  SRV: 33,
  ATMA: 34,
  NAPTR: 35,
  KX: 36,
  CERT: 37,
  A6: 38,
  DNAME: 39,
  SINK: 40,
  OPT: 41,
  APL: 42,
  DS: 43,
  SSHFP: 44,
  IPSECKEY: 45,
  RRSIG: 46,
  NSEC: 47,
  DNSKEY: 48,
  DHCID: 49,
  NSEC3: 50,
  NSEC3PARAM: 51,
  TLSA: 52,
  HIP: 55,
  CDS: 59,
  CDNSKEY: 60,
  OPENPGPKEY: 61,
  CSYNC: 62,
  SPF: 99,
  UNSPEC: 103,
  TKEY: 249,
  TSIG: 250,
  IXFR: 251,
  AXFR: 252,
  MAILB: 253,
  MAILA: 254,
  ANY: 255,
};

function getQueryTypeNum(type: string): number {
  return DNS_QUERY_TYPES[type.toUpperCase()] || 0;
}

// ─── DNS wire format QNAME parser (for future PCAP mode) ────────────────────
function parseDnsQname(buf: Uint8Array, offset: number): string {
  const labels: string[] = [];
  let pos = offset;
  const maxPos = buf.length;

  while (pos < maxPos) {
    const len = buf[pos];
    if (len === 0) break;

    // Check for pointer (compression) — top 2 bits set
    if ((len & 0xc0) === 0xc0) {
      if (pos + 1 >= maxPos) break;
      const ptrOffset = ((len & 0x3f) << 8) | buf[pos + 1];
      // Follow pointer recursively
      const remainder = parseDnsQname(buf, ptrOffset);
      if (remainder) labels.push(remainder);
      break;
    }

    pos++;
    if (pos + len > maxPos) break;
    labels.push(new TextDecoder().decode(buf.slice(pos, pos + len)));
    pos += len;
  }

  return labels.join(".");
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
const topTypes = new Map<string, number>();
const topSources = new Map<string, number>();

// ─── DNS record parser ──────────────────────────────────────────────────────
function parseDnsRecord(line: string): any | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  try {
    const obj = JSON.parse(trimmed);

    const domain = obj.domain || "";
    const queryType = obj.type || "A";
    const responseIps = Array.isArray(obj.response_ips)
      ? obj.response_ips.join(",")
      : obj.response_ips || "";
    const ttl = obj.ttl || 0;

    const record = {
      timestamp: obj.timestamp || new Date().toISOString(),
      src_ip: obj.src_ip || "",
      domain,
      query_type: queryType.toUpperCase(),
      query_type_num: getQueryTypeNum(queryType),
      dns_server: obj.dns_server || "",
      response_ips: responseIps,
      ttl: typeof ttl === "number" ? ttl : parseInt(String(ttl), 10) || 0,
    };

    // Update aggregates
    topDomains.set(domain, (topDomains.get(domain) || 0) + 1);
    topTypes.set(record.query_type, (topTypes.get(record.query_type) || 0) + 1);
    topSources.set(record.src_ip, (topSources.get(record.src_ip) || 0) + 1);

    return record;
  } catch {
    totalParseErrors++;
    return null;
  }
}

// ─── ClickHouse helpers ─────────────────────────────────────────────────────
async function ensureClickHouseTable(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS ipdr.dns_cache (
      timestamp DateTime,
      src_ip String,
      domain String,
      query_type String,
      query_type_num UInt16,
      dns_server String,
      response_ips String,
      ttl UInt32 DEFAULT 0
    )
    ENGINE = MergeTree()
    PARTITION BY toYYYYMMDD(timestamp)
    ORDER BY (timestamp, src_ip, domain)
    TTL timestamp + INTERVAL 7 DAY
  `;

  try {
    const res = await fetch(CLICKHOUSE_URL, {
      method: "POST",
      body: sql,
    });
    if (res.ok) {
      console.log(`[${SERVICE_NAME}] ClickHouse table ipdr.dns_cache ensured`);
    } else {
      console.error(
        `[${SERVICE_NAME}] ClickHouse table creation error: ${await res.text()}`
      );
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

  const values = items
    .map(
      (e) =>
        `('${e.timestamp}', '${e.src_ip}', '${escapeSql(e.domain)}', '${e.query_type}', ${e.query_type_num}, ` +
        `'${e.dns_server}', '${escapeSql(e.response_ips)}', ${e.ttl})`
    )
    .join(",");

  const sql = `INSERT INTO ipdr.dns_cache (timestamp, src_ip, domain, query_type, query_type_num, dns_server, response_ips, ttl) VALUES ${values}`;

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
    const stat = await Bun.file(DNS_LOG_FILE).stat();
    const inode = `${stat.dev}:${stat.ino}`;

    // Detect log rotation
    if (currentInode && currentInode !== inode) {
      console.log(`[${SERVICE_NAME}] Log rotation detected, resetting file position`);
      currentFilePos = 0;
    }
    currentInode = inode;

    if (stat.size <= currentFilePos) return;

    const file = Bun.file(DNS_LOG_FILE);
    const slice = (file as any).slice(currentFilePos, stat.size) as BunFile;
    const text = await slice.text();

    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const record = parseDnsRecord(trimmed);
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
  } catch (err: any) {
    // File may not exist yet, silently ignore
    if (err.code !== "ENOENT" && !err.message.includes("No such file")) {
      // Only log once per startup
    }
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
          logFile: DNS_LOG_FILE,
          uptime: process.uptime(),
          eventsProcessed: totalEvents,
          ringBufferSize: ringBuffer.length,
          pendingBatch: batch.length,
          batchesFlushed: totalBatches,
          clickHouseErrors: totalClickHouseErrors,
          parseErrors: totalParseErrors,
          filePosition: currentFilePos,
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
        if (filterDomain) {
          events = events.filter((e: any) =>
            e.domain.toLowerCase().includes(filterDomain.toLowerCase())
          );
        }
        if (filterSrcIp) {
          events = events.filter((e: any) => e.src_ip === filterSrcIp);
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
          uniqueSources: topSources.size,
          batchesFlushed: totalBatches,
          clickHouseErrors: totalClickHouseErrors,
          parseErrors: totalParseErrors,
          topDomains: [...topDomains.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([domain, count]) => ({ domain, count })),
          topTypes: [...topTypes.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([type, count]) => ({ type, count })),
          topSources: [...topSources.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([ip, count]) => ({ ip, count })),
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
      // Could be JSON array or single object
      const parsed = JSON.parse(body);
      if (Array.isArray(parsed)) {
        records = parsed;
      } else {
        records = [parsed];
      }
    } else {
      // NDJSON (newline-delimited JSON)
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
      // Normalize to our expected format and parse
      const line = JSON.stringify(rawRecord);
      const record = parseDnsRecord(line);
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
  console.log(`[${SERVICE_NAME}] Starting dns-parser service...`);
  console.log(`[${SERVICE_NAME}] Port: ${PORT}, Log: ${DNS_LOG_FILE}, ClickHouse: ${CLICKHOUSE_URL}`);

  // Ensure ClickHouse table
  await ensureClickHouseTable();

  // Start batch flush timer
  batchTimer = setInterval(() => {
    flushBatch();
  }, BATCH_INTERVAL_MS);

  // Start file watcher
  console.log(`[${SERVICE_NAME}] Watching log file: ${DNS_LOG_FILE}`);
  fileWatcher = setInterval(checkLogFile, FILE_POLL_INTERVAL_MS);

  // Initial file position (start from end for existing logs, or beginning for new)
  try {
    const stat = await Bun.file(DNS_LOG_FILE).stat();
    currentFilePos = stat.size;
    currentInode = `${stat.dev}:${stat.ino}`;
    console.log(`[${SERVICE_NAME}] Starting from file position: ${currentFilePos}`);
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
