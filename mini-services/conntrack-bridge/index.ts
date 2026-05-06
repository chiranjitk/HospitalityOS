/**
 * conntrack-bridge — Network connection tracking bridge for StaySuite IPDR pipeline
 *
 * Listens to conntrack events (NEW/UPDATE/DESTROY) via `conntrack -E`,
 * parses NAT connection records, and batches them into ClickHouse ipdr.nat_log.
 *
 * Port: 3020 (env PORT)
 * ClickHouse: env CLICKHOUSE_URL (default http://127.0.0.1:8123)
 *
 * Graceful degradation: runs in simulation mode if conntrack binary unavailable.
 */

// ─── Configuration ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3020", 10);
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || "http://127.0.0.1:8123";
const RING_BUFFER_SIZE = 5000;
const BATCH_INTERVAL_MS = 2000;
const BATCH_MAX_SIZE = 500;
const SERVICE_NAME = "conntrack-bridge";

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
let simulationMode = false;
let simTimer: ReturnType<typeof setInterval> | null = null;
let childProcess: any = null;
let totalEvents = 0;
let totalBatches = 0;
let totalClickHouseErrors = 0;
const activeConnections = new Map<
  string,
  { startTime: number; bytes: number; packets: number }
>();

// ─── Conntrack line parser ──────────────────────────────────────────────────
function parseConntrackLine(line: string): any | null {
  // Example: [NEW] tcp 6 120 src=10.0.1.101 dst=142.250.80.14 sport=52341 dport=443 src=172.217.5.14 dst=10.0.1.101 sport=443 dport=52341 [UNREPLIED] mark=0 use=1
  // Also: [UPDATE] udp 6 30 [ASSURED] src=10.0.1.55 dst=8.8.8.8 sport=45231 dport=53 src=8.8.8.8 dst=192.168.1.1 sport=53 dport=45231 packets=3 bytes=285
  // Also: [DESTROY] tcp 6 src=10.0.1.101 dst=142.250.80.14 sport=52341 dport=443 src=172.217.5.14 dst=10.0.1.101 sport=443 dport=52341

  const eventMatch = line.match(/^\s*\[([A-Z]+)\]\s+(.+)/);
  if (!eventMatch) return null;

  const eventType = eventMatch[1];
  const rest = eventMatch[2].trim();

  // Extract protocol
  const protoMatch = rest.match(/^(\w+)\s+(\d+)/);
  if (!protoMatch) return null;
  const proto = protoMatch[1].toLowerCase();

  // Extract all key=value pairs
  const kvPattern = /(\w+)=([^\s\[\]]+)/g;
  const kvPairs: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = kvPattern.exec(rest)) !== null) {
    kvPairs[match[1]] = match[2];
  }

  // Extract status from brackets
  let status = "OK";
  const statusMatch = rest.match(/\[(UNREPLIED|ASSURED)\]/);
  if (statusMatch) {
    status = statusMatch[1];
  }

  // Extract bytes and packets (may appear in UPDATE events)
  const bytes = parseInt(kvPairs["bytes"] || "0", 10);
  const packets = parseInt(kvPairs["packets"] || "0", 10);

  // Original and NAT tuples
  const srcIp = kvPairs["src"] || "";
  const srcPort = parseInt(kvPairs["sport"] || "0", 10);
  const dstIp = kvPairs["dst"] || "";
  const dstPort = parseInt(kvPairs["dport"] || "0", 10);

  // NAT reversed tuple (second set of src/dst)
  // For NAT'd connections, there's a second src/dst pair
  // We detect by finding all occurrences - the second pair is NAT
  const allSrcs = [...rest.matchAll(/src=([^\s\[\]]+)/g)];
  const allDst = [...rest.matchAll(/dst=([^\s\[\]]+)/g)];
  const allSports = [...rest.matchAll(/sport=([^\s\[\]]+)/g)];
  const allDports = [...rest.matchAll(/dport=([^\s\[\]]+)/g)];

  let natSrcIp = "";
  let natSrcPort = 0;
  let natDstIp = "";
  let natDstPort = 0;

  if (allSrcs.length >= 2) {
    natSrcIp = allSrcs[1][1];
    natDstIp = allDst.length >= 2 ? allDst[1][1] : "";
    natSrcPort = allSports.length >= 2 ? parseInt(allSports[1][1], 10) : 0;
    natDstPort = allDports.length >= 2 ? parseInt(allDports[1][1], 10) : 0;
  }

  // Build a connection key for tracking duration
  const connKey = `${proto}:${srcIp}:${srcPort}:${dstIp}:${dstPort}`;
  const now = Date.now();
  let duration = 0;

  if (eventType === "NEW") {
    activeConnections.set(connKey, {
      startTime: now,
      bytes: 0,
      packets: 0,
    });
  } else if (eventType === "UPDATE") {
    const existing = activeConnections.get(connKey);
    if (existing) {
      existing.bytes = bytes;
      existing.packets = packets;
    }
  } else if (eventType === "DESTROY") {
    const existing = activeConnections.get(connKey);
    if (existing) {
      duration = (now - existing.startTime) / 1000; // seconds
      activeConnections.delete(connKey);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    proto,
    eventType,
    conntrack_id: hashConnKey(connKey),
    src_ip: srcIp,
    src_port: srcPort,
    dst_ip: dstIp,
    dst_port: dstPort,
    nat_src_ip: natSrcIp,
    nat_src_port: natSrcPort,
    nat_dst_ip: natDstIp,
    nat_dst_port: natDstPort,
    bytes,
    packets,
    duration: Math.round(duration * 1000) / 1000,
    status,
  };
}

function hashConnKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const chr = key.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

// ─── ClickHouse helpers ─────────────────────────────────────────────────────
async function ensureClickHouseTable(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS ipdr.nat_log (
      timestamp DateTime,
      proto String,
      event_type String,
      conntrack_id UInt64,
      src_ip String,
      src_port UInt16,
      dst_ip String,
      dst_port UInt16,
      nat_src_ip String,
      nat_src_port UInt16,
      nat_dst_ip String,
      nat_dst_port UInt16,
      bytes UInt64,
      packets UInt64,
      duration Float64,
      status String
    )
    ENGINE = MergeTree()
    PARTITION BY toYYYYMMDD(timestamp)
    ORDER BY (timestamp, proto, src_ip, dst_ip)
    TTL timestamp + INTERVAL 13 MONTH
  `;

  try {
    const res = await fetch(CLICKHOUSE_URL, {
      method: "POST",
      body: sql,
    });
    if (res.ok) {
      console.log(`[${SERVICE_NAME}] ClickHouse table ipdr.nat_log ensured`);
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

/** Convert ISO 8601 timestamp to ClickHouse DateTime format (YYYY-MM-DD HH:MM:SS) */
function toClickHouseDateTime(iso: string): string {
  // ClickHouse DateTime expects 'YYYY-MM-DD HH:MM:SS' (no T, no Z, no ms)
  const d = new Date(iso);
  if (isNaN(d.getTime())) return new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
  return d.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
}

async function flushBatch(): Promise<void> {
  if (batch.length === 0) return;

  const items = [...batch];
  batch = [];
  totalBatches++;

  const values = items
    .map(
      (e) =>
        `('${toClickHouseDateTime(e.timestamp)}', '${e.proto}', '${e.eventType}', ${e.conntrack_id}, ` +
        `'${e.src_ip}', ${e.src_port}, '${e.dst_ip}', ${e.dst_port}, ` +
        `'${e.nat_src_ip}', ${e.nat_src_port}, '${e.nat_dst_ip}', ${e.nat_dst_port}, ` +
        `${e.bytes}, ${e.packets}, ${e.duration}, '${e.status}')`
    )
    .join(",");

  const sql = `INSERT INTO ipdr.nat_log (timestamp, proto, event_type, conntrack_id, src_ip, src_port, dst_ip, dst_port, nat_src_ip, nat_src_port, nat_dst_ip, nat_dst_port, bytes, packets, duration, status) VALUES ${values}`;

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

// ─── Conntrack spawner ──────────────────────────────────────────────────────
function startConntrack(): boolean {
  try {
    const { spawn } = require("child_process") as typeof import("child_process");
    childProcess = spawn("conntrack", ["-E", "-e", "NEW,UPDATE,DESTROY"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    childProcess.stdout.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parsed = parseConntrackLine(trimmed);
        if (parsed) {
          // Only flush events that carry byte data or are DESTROY (final accounting).
          // NEW events always have bytes=0 — including them dilutes SUM(bytes) queries
          // and wastes ClickHouse storage with zero-byte noise records.
          if (parsed.bytes > 0 || parsed.eventType === 'DESTROY') {
            ringBuffer.push(parsed);
            batch.push(parsed);
            totalEvents++;
            if (batch.length >= BATCH_MAX_SIZE) {
              flushBatch();
            }
          }
        }
      }
    });

    childProcess.stderr.on("data", (data: Buffer) => {
      console.error(`[${SERVICE_NAME}] conntrack stderr: ${data.toString().trim()}`);
    });

    childProcess.on("exit", (code: number) => {
      console.log(`[${SERVICE_NAME}] conntrack process exited with code ${code}`);
      if (!simulationMode) {
        console.log(
          `[${SERVICE_NAME}] Attempting to restart conntrack in 5s...`
        );
        setTimeout(() => {
          if (!simulationMode) startConntrack();
        }, 5000);
      }
    });

    childProcess.on("error", (err: Error) => {
      console.error(`[${SERVICE_NAME}] conntrack spawn error: ${err.message}`);
    });

    console.log(`[${SERVICE_NAME}] conntrack event listener started`);
    return true;
  } catch (err: any) {
    return false;
  }
}

// ─── Simulation mode ────────────────────────────────────────────────────────
function startSimulation(): void {
  simulationMode = true;
  console.log(
    `[${SERVICE_NAME}] ⚠  SIMULATION MODE — conntrack binary not available or permission denied`
  );

  const protocols = ["tcp", "udp", "icmp"];
  const eventTypes = ["NEW", "UPDATE", "DESTROY"];
  const sampleIps = [
    "10.0.1.101",
    "10.0.1.55",
    "10.0.2.33",
    "10.0.3.12",
    "10.0.1.88",
  ];
  const sampleDsts = [
    "142.250.80.14",
    "8.8.8.8",
    "1.1.1.1",
    "52.216.100.205",
    "151.101.1.140",
  ];

  simTimer = setInterval(() => {
    const proto = protocols[Math.floor(Math.random() * protocols.length)];
    const eventType =
      eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const srcIp = sampleIps[Math.floor(Math.random() * sampleIps.length)];
    const dstIp = sampleDsts[Math.floor(Math.random() * sampleDsts.length)];
    const srcPort = 10000 + Math.floor(Math.random() * 55000);
    const dstPort = proto === "tcp" ? [80, 443, 8080, 22][Math.floor(Math.random() * 4)] : 53;
    const natSrcIp = dstIp === "142.250.80.14" ? "172.217.5.14" : dstIp;
    const bytes = Math.floor(Math.random() * 1000000);
    const packets = Math.floor(Math.random() * 5000);
    const status = Math.random() > 0.3 ? "ASSURED" : "UNREPLIED";

    const event = {
      timestamp: new Date().toISOString(),
      proto,
      eventType,
      conntrack_id: hashConnKey(`${proto}:${srcIp}:${srcPort}:${dstIp}:${dstPort}`),
      src_ip: srcIp,
      src_port: srcPort,
      dst_ip: dstIp,
      dst_port: dstPort,
      nat_src_ip: natSrcIp,
      nat_src_port: dstPort,
      nat_dst_ip: srcIp,
      nat_dst_port: srcPort,
      bytes,
      packets,
      duration: eventType === "DESTROY" ? Math.round(Math.random() * 3600 * 100) / 100 : 0,
      status,
    };

    ringBuffer.push(event);
    batch.push(event);
    totalEvents++;

    if (batch.length >= BATCH_MAX_SIZE) {
      flushBatch();
    }
  }, 800);
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
          mode: simulationMode ? "simulation" : "live",
          port: PORT,
          uptime: process.uptime(),
          eventsProcessed: totalEvents,
          ringBufferSize: ringBuffer.length,
          activeConnections: activeConnections.size,
          pendingBatch: batch.length,
          batchesFlushed: totalBatches,
          clickHouseErrors: totalClickHouseErrors,
        });
      }

      // Live events
      if (url.pathname === "/api/live") {
        const limit = Math.min(
          parseInt(url.searchParams.get("limit") || "50", 10),
          RING_BUFFER_SIZE
        );
        return json({
          count: ringBuffer.getLast(limit).length,
          events: ringBuffer.getLast(limit),
        });
      }

      // Stats
      if (url.pathname === "/api/stats") {
        const allEvents = ringBuffer.getLast(RING_BUFFER_SIZE);
        const protoCount: Record<string, number> = {};
        const eventCount: Record<string, number> = {};
        const topSrc: Record<string, number> = {};
        const topDst: Record<string, number> = {};

        for (const e of allEvents) {
          protoCount[e.proto] = (protoCount[e.proto] || 0) + 1;
          eventCount[e.eventType] = (eventCount[e.eventType] || 0) + 1;
          topSrc[e.src_ip] = (topSrc[e.src_ip] || 0) + 1;
          topDst[e.dst_ip] = (topDst[e.dst_ip] || 0) + 1;
        }

        return json({
          totalEvents,
          activeConnections: activeConnections.size,
          batchesFlushed: totalBatches,
          clickHouseErrors: totalClickHouseErrors,
          byProtocol: protoCount,
          byEventType: eventCount,
          topSources: Object.entries(topSrc)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([k, v]) => ({ ip: k, count: v })),
          topDestinations: Object.entries(topDst)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([k, v]) => ({ ip: k, count: v })),
        });
      }

      return json({ error: "Not Found" }, 404);
    },
  });

  console.log(`[${SERVICE_NAME}] HTTP server listening on port ${PORT}`);
}

// ─── Graceful shutdown ──────────────────────────────────────────────────────
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[${SERVICE_NAME}] Received ${signal}, shutting down gracefully...`);

  if (batchTimer) clearInterval(batchTimer);
  if (simTimer) clearInterval(simTimer);
  if (childProcess) {
    childProcess.kill("SIGTERM");
  }

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
  console.log(`[${SERVICE_NAME}] Starting conntrack-bridge service...`);
  console.log(`[${SERVICE_NAME}] Port: ${PORT}, ClickHouse: ${CLICKHOUSE_URL}`);

  // Ensure ClickHouse table
  await ensureClickHouseTable();

  // Start batch flush timer
  batchTimer = setInterval(() => {
    flushBatch();
  }, BATCH_INTERVAL_MS);

  // Try to start conntrack, fall back to simulation
  const started = startConntrack();
  if (!started) {
    startSimulation();
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
