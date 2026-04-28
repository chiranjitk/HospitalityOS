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
// Tool: SPEED TEST — downloads a known-size file, measures throughput
// ═══════════════════════════════════════════════════════════════════

async function handleSpeedTest() {
  const testUrls = [
    'http://speedtest.tele2.net/1MB.zip',
    'https://proof.ovh.net/files/1Mb.dat',
  ];

  for (const url of testUrls) {
    try {
      const start = Date.now();
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) continue;

      const reader = response.body?.getReader();
      if (!reader) continue;

      let totalBytes = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.length;
      }

      const durationSec = (Date.now() - start) / 1000;
      const bps = (totalBytes * 8) / durationSec;

      return {
        download: {
          bitsPerSecond: Math.round(bps),
          megabitsPerSecond: parseFloat((bps / 1_000_000).toFixed(2)),
          totalBytes,
          totalMB: parseFloat((totalBytes / 1_048_576).toFixed(2)),
          durationSeconds: parseFloat(durationSec.toFixed(2)),
        },
        server: url,
      };
    } catch {
      continue;
    }
  }

  return { download: null, error: 'All speed test servers are currently unavailable' };
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
// Tool: CONNECTION TABLE — reads /proc/net/nf_conntrack (no shell)
// ═══════════════════════════════════════════════════════════════════

async function handleConntrack(search?: string) {
  // Try /proc/net/nf_conntrack first
  try {
    const content = await fs.promises.readFile('/proc/net/nf_conntrack', 'utf-8');
    const lines = content.trim().split('\n');
    const entries = search
      ? lines.filter((l) => l.toLowerCase().includes(search.toLowerCase()))
      : lines;
    return { entries, total: entries.length, source: 'nf_conntrack' };
  } catch {
    // Fall back to conntrack CLI
    const { stdout, code } = await execSafe('conntrack', ['-L'], 10_000);
    if (code !== null && code !== 0) {
      return {
        entries: [],
        total: 0,
        error: 'Connection tracking table not available. nf_conntrack module may not be loaded.',
      };
    }
    const lines = stdout.trim().split('\n');
    const entries = search
      ? lines.filter((l) => l.toLowerCase().includes(search.toLowerCase()))
      : lines;
    return { entries, total: entries.length, source: 'conntrack' };
  }
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
  'port-check',
  'conntrack',
]);

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  // ── Rate limit ──────────────────────────────────────────────────────
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Max 30 requests per minute.' },
      { status: 429 },
    );
  }

  // ── Parse action ────────────────────────────────────────────────────
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

      // ── SPEED TEST ──────────────────────────────────────────────
      case 'speed-test': {
        data = await handleSpeedTest();
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
