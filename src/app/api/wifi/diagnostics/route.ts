import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import dns from 'dns';
import fs from 'fs';
import net from 'net';
import { requirePermission } from '@/lib/auth/tenant-context';

// ═══════════════════════════════════════════════════════════════════
// Input Validation — strict regex allowlists, no shell injection
// ═══════════════════════════════════════════════════════════════════

const IP_V4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HOSTNAME_REGEX =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const SUBNET_REGEX = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
const IFACE_REGEX = /^[a-zA-Z0-9._-]{1,15}$/;
const BPF_FILTER_REGEX = /^[a-zA-Z0-9\s.:\-/()<>!=&|*_+,;\[\]]+$/;
const VALID_DNS_TYPES = new Set([
  'A',
  'AAAA',
  'CNAME',
  'MX',
  'NS',
  'TXT',
  'SOA',
]);

function isValidIp(ip: string): boolean {
  const m = IP_V4_REGEX.exec(ip);
  if (!m) return false;
  return [m[1], m[2], m[3], m[4]].every((o) => {
    const n = parseInt(o, 10);
    return n >= 0 && n <= 255;
  });
}

function isValidHost(host: string): boolean {
  if (isValidIp(host)) return true;
  if (host.length > 253 || host.length === 0) return false;
  return HOSTNAME_REGEX.test(host);
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function isValidSubnet(subnet: string): boolean {
  if (!SUBNET_REGEX.test(subnet)) return false;
  const [ipPart, cidr] = subnet.split('/');
  if (!isValidIp(ipPart)) return false;
  const cidrNum = parseInt(cidr, 10);
  return cidrNum >= 8 && cidrNum <= 32;
}

function clampInt(val: string | null, min: number, max: number, fallback: number): number {
  const n = parseInt(val || String(fallback), 10);
  if (isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

// ═══════════════════════════════════════════════════════════════════
// Rate Limiter — in-memory, per user, 30 req/min
// ═══════════════════════════════════════════════════════════════════

const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Cleanup stale entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimiter) {
      if (now > entry.resetAt) rateLimiter.delete(key);
    }
  },
  300_000,
).unref();

// ═══════════════════════════════════════════════════════════════════
// Helper: execFile wrapped in a Promise (no shell, safe from injection)
// ═══════════════════════════════════════════════════════════════════

function execSafe(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { timeout: timeoutMs, encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({ stdout: stdout || '', stderr: stderr || '', code: error?.code ?? null });
      },
    );
  });
}

// ═══════════════════════════════════════════════════════════════════
// Tool: PING
// ═══════════════════════════════════════════════════════════════════

async function handlePing(
  host: string,
  count: number,
  timeoutSec: number,
) {
  const maxMs = (count * timeoutSec + 10) * 1000;
  const { stdout, stderr, code } = await execSafe(
    'ping',
    ['-c', String(count), '-W', String(timeoutSec), '-i', '0.5', host],
    maxMs,
  );

  // Parse per-packet lines: "64 bytes from 8.8.8.8: icmp_seq=1 ttl=117 time=1.234 ms"
  const packets: Array<{
    seq: number;
    rtt: number;
    ttl?: number;
    bytes?: number;
    from?: string;
  }> = [];
  const lines = stdout.split('\n');
  for (const line of lines) {
    const m = line.match(
      /(\d+)\s+bytes\s+from\s+([^\s:]+).*icmp_seq=(\d+).*ttl=(\d+).*time=([\d.]+)\s*ms/,
    );
    if (m) {
      packets.push({
        bytes: parseInt(m[1]),
        from: m[2],
        seq: parseInt(m[3]),
        ttl: parseInt(m[4]),
        rtt: parseFloat(m[5]),
      });
      continue;
    }
    // Fallback: "time=..." without ttl
    const m2 = line.match(
      /icmp_seq=(\d+).*time=([\d.]+)\s*ms/,
    );
    if (m2) {
      packets.push({ seq: parseInt(m2[1]), rtt: parseFloat(m2[2]) });
    }
  }

  // Parse summary: "4 packets transmitted, 4 received, 0% packet loss"
  const summaryMatch = stdout.match(
    /(\d+)\s+packets transmitted,\s+(\d+)\s+received,\s+([\d.]+)%\s+packet loss/,
  );
  // Parse rtt stats: "rtt min/avg/max/mdev = 1.1/1.2/1.3/0.1 ms"
  const rttMatch = stdout.match(
    /rtt\s+min\/avg\/max\/mdev\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/,
  );

  const failed = code !== null && code !== 0;

  return {
    host,
    packets,
    summary: {
      transmitted: summaryMatch ? parseInt(summaryMatch[1]) : count,
      received: summaryMatch ? parseInt(summaryMatch[2]) : 0,
      lossPercent: summaryMatch ? parseFloat(summaryMatch[3]) : 100,
    },
    rtt: rttMatch
      ? {
          min: parseFloat(rttMatch[1]),
          avg: parseFloat(rttMatch[2]),
          max: parseFloat(rttMatch[3]),
          mdev: parseFloat(rttMatch[4]),
        }
      : null,
    rawOutput: stdout || stderr,
    error: failed ? (stderr || `ping exited with code ${code}`) : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Tool: TRACEROUTE
// ═══════════════════════════════════════════════════════════════════

async function handleTraceroute(
  host: string,
  maxHops: number,
  timeoutSec: number,
) {
  const maxMs = (maxHops * timeoutSec + 15) * 1000;
  const { stdout, stderr, code } = await execSafe(
    'traceroute',
    ['-m', String(maxHops), '-w', String(timeoutSec), '-n', host],
    maxMs,
  );

  // Parse hop lines: " 1  192.168.1.1  0.543 ms  0.623 ms  0.489 ms"
  const hops: Array<{
    hop: number;
    probes: Array<{ ip: string; rtt: string }>;
  }> = [];
  const lines = stdout.split('\n');

  for (const line of lines) {
    const hopMatch = line.match(/^\s*(\d+)\s+(.+)/);
    if (!hopMatch) continue;
    const hopNum = parseInt(hopMatch[1]);
    const rest = hopMatch[2];
    const probes: Array<{ ip: string; rtt: string }> = [];

    // Match probes: "192.168.1.1  0.543 ms" or "* * *"
    const probeRegex = /([\d.]+)\s+([\d.]+)\s*ms/g;
    let m: RegExpExecArray | null;
    let found = false;
    while ((m = probeRegex.exec(rest)) !== null) {
      probes.push({ ip: m[1], rtt: m[2] });
      found = true;
    }
    if (!found && /\*/.test(rest)) {
      probes.push({ ip: '*', rtt: '*' });
    }

    hops.push({ hop: hopNum, probes });
  }

  const failed = code !== null && code !== 0 && hops.length === 0;

  return {
    host,
    maxHops,
    hops,
    hopCount: hops.length,
    rawOutput: stdout || stderr,
    error: failed ? (stderr || `traceroute exited with code ${code}`) : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Tool: DNS LOOKUP
// ═══════════════════════════════════════════════════════════════════

async function handleDnsLookup(
  hostname: string,
  type: string,
  server?: string,
) {
  const recordType = type.toUpperCase();
  if (!VALID_DNS_TYPES.has(recordType)) {
    return {
      hostname,
      type: recordType,
      records: [],
      error: `Invalid DNS record type. Valid: ${Array.from(VALID_DNS_TYPES).join(', ')}`,
    };
  }

  const resolver = server ? new dns.Resolver() : dns.promises;
  if (server) {
    try {
      resolver.setServers([server]);
    } catch {
      return { hostname, type: recordType, records: [], error: `Invalid DNS server: ${server}` };
    }
  }

  try {
    let records: unknown;
    switch (recordType) {
      case 'A':
        records = await (resolver as dns.Resolver).resolve4(hostname);
        break;
      case 'AAAA':
        records = await (resolver as dns.Resolver).resolve6(hostname);
        break;
      case 'CNAME':
        records = await (resolver as dns.Resolver).resolveCname(hostname);
        break;
      case 'MX':
        records = await (resolver as dns.Resolver).resolveMx(hostname);
        break;
      case 'NS':
        records = await (resolver as dns.Resolver).resolveNs(hostname);
        break;
      case 'TXT':
        records = await (resolver as dns.Resolver).resolveTxt(hostname);
        break;
      case 'SOA':
        records = await (resolver as dns.Resolver).resolveSoa(hostname);
        break;
    }

    return {
      hostname,
      type: recordType,
      records,
      server: server || 'system default',
      count: Array.isArray(records) ? records.length : 1,
    };
  } catch (err: unknown) {
    return {
      hostname,
      type: recordType,
      records: [],
      error: err instanceof Error ? err.message : 'DNS lookup failed',
      server: server || 'system default',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Tool: ARP TABLE — reads /proc/net/arp directly (no shell)
// ═══════════════════════════════════════════════════════════════════

async function handleArpTable(search?: string) {
  try {
    const content = await fs.promises.readFile('/proc/net/arp', 'utf-8');
    const lines = content.trim().split('\n');
    const entries: Array<{
      ip: string;
      hwType: string;
      flags: string;
      mac: string;
      mask: string;
      device: string;
    }> = [];

    // Skip header line (line 0)
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length >= 6) {
        const entry = {
          ip: parts[0],
          hwType: parts[1],
          flags: parts[2],
          mac: parts[3],
          mask: parts[4],
          device: parts[5],
        };
        if (
          !search ||
          entry.ip.includes(search) ||
          entry.mac.toLowerCase().includes(search.toLowerCase()) ||
          entry.device.toLowerCase().includes(search.toLowerCase())
        ) {
          entries.push(entry);
        }
      }
    }

    return { entries, total: entries.length };
  } catch (err: unknown) {
    return {
      entries: [],
      total: 0,
      error: err instanceof Error ? err.message : 'Failed to read ARP table',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Tool: NETWORK SCAN — uses fping (fast) with fallback
// ═══════════════════════════════════════════════════════════════════

async function handleNetworkScan(subnet: string, timeoutSec: number) {
  const { stdout, code } = await execSafe(
    'fping',
    ['-a', '-g', subnet, '-t', String(timeoutSec * 1000)],
    120_000,
  );

  if (code !== null && code !== 0) {
    return {
      subnet,
      aliveHosts: [],
      totalFound: 0,
      method: 'none',
      error:
        'fping not available or scan failed. Install fping for network scanning: apt install fping',
    };
  }

  const hosts = stdout.trim().split('\n').filter(Boolean).map((h) => h.trim());
  return { subnet, aliveHosts: hosts, totalFound: hosts.length, method: 'fping' };
}

// ═══════════════════════════════════════════════════════════════════
// Tool: PACKET CAPTURE — uses tcpdump (execFile, no shell)
// ═══════════════════════════════════════════════════════════════════

async function handlePacketCapture(
  iface: string,
  filter: string,
  durationSec: number,
  count: number,
) {
  if (!IFACE_REGEX.test(iface)) {
    return { interface: iface, packets: [], totalCaptured: 0, error: 'Invalid interface name' };
  }
  if (filter && !BPF_FILTER_REGEX.test(filter)) {
    return { interface: iface, packets: [], totalCaptured: 0, error: 'Invalid capture filter' };
  }

  const args = ['-i', iface, '-c', String(count), '-nn', '-tt'];
  if (filter) args.push(filter);

  const { stdout, stderr, code } = await execSafe('tcpdump', args, (durationSec + 5) * 1000);

  const packets = stdout.trim().split('\n').filter(Boolean);
  const failed = code !== null && code !== 0 && packets.length === 0;

  return {
    interface: iface,
    filter: filter || 'none',
    packets,
    totalCaptured: packets.length,
    rawOutput: stdout,
    error: failed ? (stderr || 'tcpdump failed to capture packets') : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Tool: SPEED TEST — real Ookla speedtest with live progress streaming
// Uses speedtest-net progress callback for real-time gauge updates
// ═══════════════════════════════════════════════════════════════════

interface SpeedTestSession {
  id: string;
  phase: 'starting' | 'ping' | 'download' | 'upload' | 'complete' | 'error';
  progress: number;
  ping: { latency: number; jitter: number } | null;
  download: { currentSpeed: number; maxSpeed: number; bytes: number } | null;
  upload: { currentSpeed: number; maxSpeed: number; bytes: number } | null;
  result: Record<string, unknown> | null;
  error: string | null;
  startedAt: number;
}

const speedTestSessions = new Map<string, SpeedTestSession>();

// Cleanup old sessions every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [id, session] of speedTestSessions) {
      if (now - session.startedAt > 300_000) speedTestSessions.delete(id);
    }
  },
  300_000,
).unref();

/** Start a background speed test, return testId immediately for polling */
function handleSpeedTest() {
  const testId = Math.random().toString(36).slice(2, 10);
  const session: SpeedTestSession = {
    id: testId, phase: 'starting', progress: 0,
    ping: null, download: null, upload: null,
    result: null, error: null, startedAt: Date.now(),
  };
  speedTestSessions.set(testId, session);

  // Fire-and-forget — progress callback updates session in real-time
  runSpeedTest(testId, session).catch(() => {});

  return { testId, phase: 'starting' as const };
}

/** Background worker: runs Ookla speedtest with progress streaming */
async function runSpeedTest(testId: string, session: SpeedTestSession) {
  try {
    const speedTestMod = await import('speedtest-net');
    const speedTest = speedTestMod.default as (
      opts?: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;

    // speedtest-net never emits 'result' progress event type.
    // The actual final result is the resolved promise — capture it directly.
    const finalResult = await speedTest({
      acceptLicense: true,
      acceptGdpr: true,
      progress: (event: Record<string, unknown>) => {
        const type = event.type as string;
        session.progress = Number(event.progress ?? 0);

        if (type === 'testStart' || type === 'ping') {
          session.phase = 'ping';
          const pg = event.ping as { latency: number; jitter: number } | undefined;
          if (pg) session.ping = { latency: pg.latency, jitter: pg.jitter };
        } else if (type === 'download') {
          session.phase = 'download';
          const dl = event.download as { bandwidth: number; bytes: number } | undefined;
          if (dl) {
            const speed = (dl.bandwidth * 8) / 1_000_000;
            const prev = session.download;
            session.download = {
              currentSpeed: parseFloat(speed.toFixed(2)),
              maxSpeed: parseFloat(Math.max(prev?.maxSpeed || 0, speed).toFixed(2)),
              bytes: dl.bytes,
            };
          }
        } else if (type === 'upload') {
          session.phase = 'upload';
          const ul = event.upload as { bandwidth: number; bytes: number } | undefined;
          if (ul) {
            const speed = (ul.bandwidth * 8) / 1_000_000;
            const prev = session.upload;
            session.upload = {
              currentSpeed: parseFloat(speed.toFixed(2)),
              maxSpeed: parseFloat(Math.max(prev?.maxSpeed || 0, speed).toFixed(2)),
              bytes: ul.bytes,
            };
          }
        }
      },
    });

    // Build final result from the resolved promise (not progress events)
    const r = finalResult || {};
    const dl = r.download as { bandwidth: number; bytes: number; elapsed: number } | undefined;
    const ul = r.upload as { bandwidth: number; bytes: number; elapsed: number } | undefined;
    const pg = r.ping as { latency: number; jitter: number } | undefined;
    const srv = r.server as { host: string; name: string; location: string; country: string } | undefined;
    const iface = r.interface as { externalIp: string; internalIp: string; name: string } | undefined;

    // Log final result for debugging
    console.log('[speedtest] Final result:', JSON.stringify({
      dlBandwidth: dl?.bandwidth,
      ulBandwidth: ul?.bandwidth,
      dlMbps: dl ? ((dl.bandwidth * 8) / 1_000_000).toFixed(2) : 'N/A',
      ulMbps: ul ? ((ul.bandwidth * 8) / 1_000_000).toFixed(2) : 'N/A',
      pingLatency: pg?.latency,
      progressDlCurrent: session.download?.currentSpeed,
      progressUlCurrent: session.upload?.currentSpeed,
    }));

    session.phase = 'complete';
    session.result = {
      download: {
        megabitsPerSecond: dl ? parseFloat(((dl.bandwidth * 8) / 1_000_000).toFixed(2)) : session.download?.currentSpeed || 0,
        bytes: dl?.bytes ?? session.download?.bytes ?? 0,
        totalMB: dl ? parseFloat((dl.bytes / 1_048_576).toFixed(2)) : session.download ? parseFloat((session.download.bytes / 1_048_576).toFixed(2)) : 0,
        elapsed: dl ? parseFloat((dl.elapsed / 1000).toFixed(1)) : 0,
      },
      upload: {
        megabitsPerSecond: ul ? parseFloat(((ul.bandwidth * 8) / 1_000_000).toFixed(2)) : session.upload?.currentSpeed || 0,
        bytes: ul?.bytes ?? session.upload?.bytes ?? 0,
        totalMB: ul ? parseFloat((ul.bytes / 1_048_576).toFixed(2)) : session.upload ? parseFloat((session.upload.bytes / 1_048_576).toFixed(2)) : 0,
        elapsed: ul ? parseFloat((ul.elapsed / 1000).toFixed(1)) : 0,
      },
      ping: {
        latency: pg?.latency ?? session.ping?.latency ?? 0,
        jitter: pg?.jitter ?? session.ping?.jitter ?? 0,
      },
      server: srv ? { host: srv.host, name: srv.name, location: srv.location, country: srv.country } : null,
      isp: String(r.isp ?? ''),
      packetLoss: Number(r.packetLoss ?? 0),
      interface: iface ? { externalIp: iface.externalIp, internalIp: iface.internalIp, name: iface.name } : null,
    };

    // Auto-cleanup completed session after 2 minutes
    setTimeout(() => speedTestSessions.delete(testId), 120_000).unref();
  } catch (err: unknown) {
    session.phase = 'error';
    session.error = err instanceof Error ? err.message : 'Speed test failed';
  }
}

/** Poll live speed test progress by testId */
function handleSpeedTestStatus(testId: string) {
  const session = speedTestSessions.get(testId);
  if (!session) return { error: 'Test session not found or expired. Start a new test.' };

  const response: Record<string, unknown> = {
    testId: session.id,
    phase: session.phase,
    progress: session.progress,
  };
  if (session.ping) response.ping = session.ping;
  if (session.download) response.download = session.download;
  if (session.upload) response.upload = session.upload;
  if (session.error) response.error = session.error;
  if (session.result) response.result = session.result;
  return response;
}

// ═══════════════════════════════════════════════════════════════════
// Tool: PORT CHECK — TCP connect via Node.js net module (no shell)
// ═══════════════════════════════════════════════════════════════════

async function handlePortCheck(host: string, port: number, timeoutSec: number) {
  return new Promise<{
    host: string;
    port: number;
    status: 'open' | 'closed' | 'timeout';
    latency_ms: number;
  }>((resolve) => {
    const start = process.hrtime.bigint();
    const timer = setTimeout(() => {
      socket.destroy();
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      resolve({ host, port, status: 'timeout', latency_ms: Math.round(ms) });
    }, timeoutSec * 1000);

    const socket = net.createConnection({ host, port }, () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      clearTimeout(timer);
      socket.destroy();
      resolve({ host, port, status: 'open', latency_ms: Math.round(ms) });
    });

    socket.on('error', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      clearTimeout(timer);
      socket.destroy();
      resolve({ host, port, status: 'closed', latency_ms: Math.round(ms) });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// Tool: CONNECTION TABLE — reads /proc/net/tcp + /proc/net/tcp6
// (no root required, always available on Linux)
// ═══════════════════════════════════════════════════════════════════

const TCP_STATES: Record<string, string> = {
  '01': 'ESTABLISHED',
  '02': 'SYN_SENT',
  '03': 'SYN_RECV',
  '04': 'FIN_WAIT1',
  '05': 'FIN_WAIT2',
  '06': 'TIME_WAIT',
  '07': 'CLOSE',
  '08': 'CLOSE_WAIT',
  '09': 'LAST_ACK',
  '0A': 'LISTEN',
  '0B': 'CLOSING',
};

function parseHexIp(hex: string, isV6: boolean): string {
  if (isV6) {
    // IPv6: 32 hex chars, reversed byte pairs
    const padded = hex.padStart(32, '0');
    const groups: string[] = [];
    for (let i = 0; i < 32; i += 8) {
      const chunk = padded.slice(i, i + 8);
      // Reverse 4 byte-pairs
      const p = [chunk.slice(6, 8), chunk.slice(4, 6), chunk.slice(2, 4), chunk.slice(0, 2)];
      groups.push(p.join(''));
    }
    return groups.join(':').replace(/(^|:)0+(?=:|$)/g, '$1').replace(/::+/g, '::') || '::';
  }
  // IPv4: 8 hex chars, reversed byte pairs
  const padded = hex.padStart(8, '0');
  const p1 = parseInt(padded.slice(6, 8), 16);
  const p2 = parseInt(padded.slice(4, 6), 16);
  const p3 = parseInt(padded.slice(2, 4), 16);
  const p4 = parseInt(padded.slice(0, 2), 16);
  return `${p4}.${p3}.${p2}.${p1}`;
}

function parseHexPort(hex: string): number {
  return parseInt(hex, 16);
}

function parseTcpProcFile(content: string, isV6: boolean, search?: string) {
  const lines = content.trim().split('\n');
  const entries: Array<{
    protocol: string;
    localAddress: string;
    localPort: number;
    remoteAddress: string;
    remotePort: number;
    state: string;
    stateCode: string;
    uid: number;
    inode: number;
  }> = [];

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length < 10) continue;

    const localAddr = parts[1];
    const remoteAddr = parts[2];
    const stateCode = parts[3].toUpperCase();
    const uid = parseInt(parts[7], 10);
    const inode = parseInt(parts[9], 10);

    const [localHex, localPortHex] = localAddr.split(':');
    const [remoteHex, remotePortHex] = remoteAddr.split(':');

    const localAddress = parseHexIp(localHex || '0', isV6);
    const localPort = parseHexPort(localPortHex || '0');
    const remoteAddress = parseHexIp(remoteHex || '0', isV6);
    const remotePort = parseHexPort(remotePortHex || '0');
    const state = TCP_STATES[stateCode] || stateCode;

    const entry = {
      protocol: isV6 ? 'TCP6' : 'TCP4',
      localAddress,
      localPort,
      remoteAddress,
      remotePort,
      state,
      stateCode,
      uid,
      inode,
    };

    if (!search) {
      entries.push(entry);
    } else {
      const s = search.toLowerCase();
      if (
        entry.localAddress.includes(s) ||
        entry.remoteAddress.includes(s) ||
        String(entry.localPort).includes(s) ||
        String(entry.remotePort).includes(s) ||
        entry.state.toLowerCase().includes(s)
      ) {
        entries.push(entry);
      }
    }
  }

  return entries;
}

async function handleConntrack(search?: string) {
  const results: Array<ReturnType<typeof parseTcpProcFile>[number]> = [];
  let source = 'proc';

  // Read /proc/net/tcp (IPv4)
  try {
    const content = await fs.promises.readFile('/proc/net/tcp', 'utf-8');
    results.push(...parseTcpProcFile(content, false, search));
  } catch {
    // Not available
  }

  // Read /proc/net/tcp6 (IPv6)
  try {
    const content = await fs.promises.readFile('/proc/net/tcp6', 'utf-8');
    results.push(...parseTcpProcFile(content, true, search));
  } catch {
    // Not available
  }

  // Also read UDP
  const udpResults: Array<{
    protocol: string;
    localAddress: string;
    localPort: number;
    remoteAddress: string;
    remotePort: number;
    state: string;
    stateCode: string;
  }> = [];

  try {
    const content = await fs.promises.readFile('/proc/net/udp', 'utf-8');
    const lines = content.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length < 4) continue;
      const [localHex, localPortHex] = (parts[1] || '').split(':');
      const [remoteHex, remotePortHex] = (parts[2] || '').split(':');
      const entry = {
        protocol: 'UDP4',
        localAddress: parseHexIp(localHex || '0', false),
        localPort: parseHexPort(localPortHex || '0'),
        remoteAddress: parseHexIp(remoteHex || '0', false),
        remotePort: parseHexPort(remotePortHex || '0'),
        state: parts[3] === '07' ? 'CLOSE' : 'ACTIVE',
        stateCode: parts[3],
      };
      if (!search || JSON.stringify(entry).toLowerCase().includes(search.toLowerCase())) {
        udpResults.push(entry);
      }
    }
  } catch {
    // Not available
  }

  try {
    const content = await fs.promises.readFile('/proc/net/udp6', 'utf-8');
    const lines = content.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length < 4) continue;
      const [localHex, localPortHex] = (parts[1] || '').split(':');
      const [remoteHex, remotePortHex] = (parts[2] || '').split(':');
      const entry = {
        protocol: 'UDP6',
        localAddress: parseHexIp(localHex || '0', true),
        localPort: parseHexPort(localPortHex || '0'),
        remoteAddress: parseHexIp(remoteHex || '0', true),
        remotePort: parseHexPort(remotePortHex || '0'),
        state: parts[3] === '07' ? 'CLOSE' : 'ACTIVE',
        stateCode: parts[3],
      };
      if (!search || JSON.stringify(entry).toLowerCase().includes(search.toLowerCase())) {
        udpResults.push(entry);
      }
    }
  } catch {
    // Not available
  }

  // Summary stats
  const stateCounts: Record<string, number> = {};
  for (const e of results) {
    stateCounts[e.state] = (stateCounts[e.state] || 0) + 1;
  }
  for (const e of udpResults) {
    stateCounts[e.state] = (stateCounts[e.state] || 0) + 1;
  }

  return {
    connections: results,
    udpConnections: udpResults,
    totalTcp: results.length,
    totalUdp: udpResults.length,
    total: results.length + udpResults.length,
    stateCounts,
    source,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Main GET Handler
// ═══════════════════════════════════════════════════════════════════

const VALID_ACTIONS = new Set([
  'ping',
  'traceroute',
  'dns-lookup',
  'arp-table',
  'network-scan',
  'packet-capture',
  'speed-test',
  'speed-test-status',
  'port-check',
  'conntrack',
]);

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  // ── Parse action (before rate limit so we can exempt polling) ──────
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (!action || !VALID_ACTIONS.has(action)) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid action. Valid: ${Array.from(VALID_ACTIONS).join(', ')}`,
      },
      { status: 400 },
    );
  }

  // ── Rate limit ──────────────────────────────────────────────────────
  // speed-test-status is exempt: polling at 300ms for ~25s needs ~83 reqs,
  // well over the 30/min limit. It's safe to exempt because testId is
  // validated (8-char alphanumeric) and sessions auto-expire in 5 minutes.
  if (action !== 'speed-test-status' && !checkRateLimit(user.id)) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Max 30 requests per minute.' },
      { status: 429 },
    );
  }

  // ── Dispatch ────────────────────────────────────────────────────────
  try {
    const startTime = Date.now();
    let data: unknown;

    switch (action) {
      // ── PING ────────────────────────────────────────────────────
      case 'ping': {
        const host = searchParams.get('host');
        if (!host || !isValidHost(host)) {
          return NextResponse.json(
            { success: false, error: 'Invalid or missing host (IP or hostname)' },
            { status: 400 },
          );
        }
        const count = clampInt(searchParams.get('count'), 1, 50, 4);
        const timeout = clampInt(searchParams.get('timeout'), 1, 30, 5);
        data = await handlePing(host, count, timeout);
        break;
      }

      // ── TRACEROUTE ──────────────────────────────────────────────
      case 'traceroute': {
        const host = searchParams.get('host');
        if (!host || !isValidHost(host)) {
          return NextResponse.json(
            { success: false, error: 'Invalid or missing host (IP or hostname)' },
            { status: 400 },
          );
        }
        const maxHops = clampInt(searchParams.get('maxHops'), 1, 64, 30);
        const timeout = clampInt(searchParams.get('timeout'), 1, 30, 5);
        data = await handleTraceroute(host, maxHops, timeout);
        break;
      }

      // ── DNS LOOKUP ──────────────────────────────────────────────
      case 'dns-lookup': {
        const hostname = searchParams.get('hostname');
        if (!hostname || !isValidHost(hostname)) {
          return NextResponse.json(
            { success: false, error: 'Invalid or missing hostname' },
            { status: 400 },
          );
        }
        const type = searchParams.get('type') || 'A';
        const server = searchParams.get('server') || undefined;
        if (server && !isValidIp(server)) {
          return NextResponse.json(
            { success: false, error: 'Invalid DNS server (must be an IPv4 address)' },
            { status: 400 },
          );
        }
        data = await handleDnsLookup(hostname, type, server);
        break;
      }

      // ── ARP TABLE ───────────────────────────────────────────────
      case 'arp-table': {
        const search = searchParams.get('search') || undefined;
        data = await handleArpTable(search);
        break;
      }

      // ── NETWORK SCAN ────────────────────────────────────────────
      case 'network-scan': {
        const subnet = searchParams.get('subnet');
        if (!subnet || !isValidSubnet(subnet)) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid or missing subnet (use CIDR, e.g. 192.168.1.0/24)',
            },
            { status: 400 },
          );
        }
        const timeout = clampInt(searchParams.get('timeout'), 1, 10, 2);
        data = await handleNetworkScan(subnet, timeout);
        break;
      }

      // ── PACKET CAPTURE ──────────────────────────────────────────
      case 'packet-capture': {
        const iface = searchParams.get('interface') || 'any';
        const filter = searchParams.get('filter') || '';
        const duration = clampInt(searchParams.get('duration'), 1, 60, 10);
        const pktCount = clampInt(searchParams.get('count'), 1, 1000, 100);
        if (!IFACE_REGEX.test(iface)) {
          return NextResponse.json(
            { success: false, error: 'Invalid interface name' },
            { status: 400 },
          );
        }
        if (filter && !BPF_FILTER_REGEX.test(filter)) {
          return NextResponse.json(
            { success: false, error: 'Invalid capture filter expression' },
            { status: 400 },
          );
        }
        data = await handlePacketCapture(iface, filter, duration, pktCount);
        break;
      }

      // ── SPEED TEST (start) ──────────────────────────────────
      case 'speed-test': {
        data = handleSpeedTest();
        break;
      }

      // ── SPEED TEST STATUS (poll) ─────────────────────────────────
      case 'speed-test-status': {
        const tid = searchParams.get('testId');
        if (!tid || !/^[a-z0-9]{8}$/.test(tid)) {
          return NextResponse.json(
            { success: false, error: 'Invalid test ID' },
            { status: 400 },
          );
        }
        data = handleSpeedTestStatus(tid);
        break;
      }

      // ── PORT CHECK ──────────────────────────────────────────────
      case 'port-check': {
        const host = searchParams.get('host');
        const port = parseInt(searchParams.get('port') || '0', 10);
        if (!host || !isValidHost(host)) {
          return NextResponse.json(
            { success: false, error: 'Invalid or missing host (IP or hostname)' },
            { status: 400 },
          );
        }
        if (!isValidPort(port)) {
          return NextResponse.json(
            { success: false, error: 'Invalid or missing port (1-65535)' },
            { status: 400 },
          );
        }
        const timeout = clampInt(searchParams.get('timeout'), 1, 10, 3);
        data = await handlePortCheck(host, port, timeout);
        break;
      }

      // ── CONNTRACK ───────────────────────────────────────────────
      case 'conntrack': {
        const search = searchParams.get('search') || undefined;
        data = await handleConntrack(search);
        break;
      }
    }

    return NextResponse.json({
      success: true,
      action,
      duration_ms: Date.now() - startTime,
      data,
    });
  } catch (err: unknown) {
    console.error(`[diagnostics] Error on action=${action}:`, err);
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: message, action }, { status: 500 });
  }
}
