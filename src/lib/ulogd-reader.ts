/**
 * ulogd2 File Reader — StaySuite HospitalityOS
 *
 * Reads ulogd2 NDJSON output files from /var/log/ulogd2/ and provides
 * structured data for the Web Surfing and NAT Logs GUI tabs.
 *
 * Architecture:
 *   nftables NFLOG → ulogd2 → /var/log/ulogd2/sni.json (TLS SNI captures)
 *   conntrack NFCT → ulogd2 → /var/log/ulogd2/flow.json (connection tracking)
 *
 * This module joins both data sources by (src_ip, dst_ip) to produce
 * unified records with domain names + byte/packet counters.
 */

import { promises as fs } from 'fs';
import path from 'path';

// ─── Configuration ───────────────────────────────────────────────

const ULOGD_DIR = process.env.ULOGD_DIR || '/var/log/ulogd2';
const SNI_FILE = path.join(ULOGD_DIR, 'sni.json');
const FLOW_FILE = path.join(ULOGD_DIR, 'flow.json');

/** Max lines to read from each file (tail). 5000 ≈ last few hours of traffic. */
const MAX_LINES = 5000;

// ─── Types ───────────────────────────────────────────────────────

export interface SniRecord {
  timestamp: string;
  src_ip: string;
  dest_ip: string;
  dest_port: number;
  sni_hostname: string;
  sni_tls_version: string;
  packet_bytes: number;
}

export interface FlowRecord {
  timestamp: string;
  src_ip: string;
  dest_ip: string;
  proto: string;
  src_port: number;
  dst_port: number;
  bytes_orig: number;
  bytes_reply: number;
  packets_orig: number;
  packets_reply: number;
  ct_event: string;
  duration: number;
  print: string;
  nat_src_ip: string;
  nat_src_port: number;
}

export interface NatLogEntry {
  id: string;
  timestamp: string;
  source_ip: string;
  src_port: number;
  dest_ip: string;
  dst_port: number;
  proto: string;
  event_type: string;
  bytes: number;
  bytes_orig: number;
  bytes_reply: number;
  packets: number;
  duration: number;
  status: string;
  nat_src_ip: string;     // NAT translated source IP (server WAN IP, e.g. 10.121.18.163)
  nat_src_port: number;   // NAT translated source port
  domain: string;
  guestName: string;
  action: string;
}

export interface SurfingEntry {
  id: string;
  timestamp: string;
  domain: string;
  sourceIp: string;
  source_ip: string;
  srcPort: number;
  destIp: string;
  destPort: number;
  inIface: string;
  category: string;
  totalBytes: number;
  connections: number;
  lastAccess: string;
  last_access: string;
  guestName: string;
}

// ─── File Reading ────────────────────────────────────────────────

/**
 * Read the last N lines from a file efficiently.
 * Reads entire file into memory (acceptable for files < 100MB).
 */
async function readLastLines(filePath: string, maxLines: number): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim().length > 0);
    // Return the most recent lines
    return lines.length > maxLines ? lines.slice(-maxLines) : lines;
  } catch {
    return [];
  }
}

// ─── Parsing ─────────────────────────────────────────────────────

/**
 * Parse an SNI record from ulogd2 PRINTSNI JSON output.
 * Unlike parseSniRecord above, this version ALSO handles non-SNI data packets
 * by enriching them with a dst_ip → domain cache (populated from ClientHello entries).
 */
function parseSniRecordWithCache(
  raw: Record<string, unknown>,
  dstDomainCache: Map<string, string>,
): { src_ip: string; src_port: number; dest_ip: string; dest_port: number; in_iface: string; sni_hostname: string; sni_tls_version: string; timestamp: string; packet_bytes: number } | null {
  const srcIp = String(raw.src_ip ?? raw['ip.saddr.str'] ?? '').trim();
  const destIp = String(raw.dest_ip ?? raw['ip.daddr.str'] ?? '').trim();
  if (!srcIp || !destIp) return null;

  const srcPort = Number(raw.src_port ?? raw['tcp.sport'] ?? 0) || 0;
  const destPort = Number(raw.dest_port ?? raw['tcp.dport'] ?? 443);
  const inIface = String(raw['oob.in'] ?? '').trim();
  const tlsVersion = String(raw['sni.tls.version'] ?? '');
  const packetBytes = Number(raw['raw.pktlen'] ?? raw['ip.totlen'] ?? 0) || 0;

  // Timestamp: ulogd2 outputs ISO-like string or epoch seconds
  let timestamp: string;
  const tsRaw = String(raw.timestamp ?? '');
  if (tsRaw && !isNaN(Date.parse(tsRaw))) {
    timestamp = tsRaw;
  } else {
    const timeSec = Number(raw.timestamp ?? raw['oob.time.sec'] ?? 0);
    timestamp = timeSec ? new Date(timeSec * 1000).toISOString() : new Date().toISOString();
  }

  // Check for direct SNI hostname from ClientHello
  let hostname = String(raw['sni.hostname'] ?? '').trim();

  if (hostname) {
    // ClientHello with SNI — cache the dst_ip → domain mapping
    dstDomainCache.set(destIp, hostname);
  } else {
    // Data packet (no SNI) — look up domain from cache
    hostname = dstDomainCache.get(destIp) ?? '';
  }

  // Only return entries with a resolved domain
  if (!hostname) return null;

  return {
    src_ip: srcIp,
    src_port: srcPort,
    dest_ip: destIp,
    dest_port: destPort,
    in_iface: inIface,
    sni_hostname: hostname,
    sni_tls_version: tlsVersion,
    timestamp,
    packet_bytes: packetBytes,
  };
}

function parseFlowRecord(raw: Record<string, unknown>): FlowRecord {
  const proto = Number(raw['orig.ip.protocol'] ?? 0);
  const ctEvent = Number(raw['ct.event'] ?? 0);

  // Protocol number to string
  let protoStr = 'unknown';
  if (proto === 6) protoStr = 'tcp';
  else if (proto === 17) protoStr = 'udp';
  else if (proto === 1) protoStr = 'icmp';

  // ct.event: 1=NEW, 2=UPDATE, 3=DESTROY, 4=DESTROY (confirmed)
  let eventType = 'DESTROY';
  if (ctEvent === 1) eventType = 'NEW';
  else if (ctEvent === 2 || ctEvent === 3) eventType = 'UPDATE';

  // Calculate duration from flow timestamps
  const flowStartSec = Number(raw['flow.start.sec'] ?? 0);
  const flowEndSec = Number(raw['flow.end.sec'] ?? 0);
  const duration = flowStartSec && flowEndSec ? flowEndSec - flowStartSec : 0;

  return {
    timestamp: String(raw.timestamp ?? ''),
    src_ip: String(raw.src_ip ?? ''),
    dest_ip: String(raw.dest_ip ?? ''),
    proto: protoStr,
    src_port: Number(raw['orig.l4.sport'] ?? 0),
    dst_port: Number(raw['orig.l4.dport'] ?? 0),
    bytes_orig: Number(raw['orig.raw.pktlen'] ?? 0),
    bytes_reply: Number(raw['reply.raw.pktlen'] ?? 0),
    packets_orig: Number(raw['orig.raw.pktcount'] ?? 0),
    packets_reply: Number(raw['reply.raw.pktcount'] ?? 0),
    ct_event: eventType,
    duration: Math.round(duration * 10) / 10,
    print: String(raw.print ?? ''),
    // NAT fields from conntrack reply tuple
    // In conntrack: orig = pre-NAT (client view), reply = post-NAT (server view)
    // reply.dst_ip = the NATed source IP (e.g. server WAN IP)
    // reply.dst_port = the NATed source port
    nat_src_ip: String(raw['reply.ip.daddr.str'] ?? raw['reply.dst_ip'] ?? ''),
    nat_src_port: Number(raw['reply.l4.dport'] ?? raw['reply.dst_port'] ?? 0),
  };
}

function parseLine(line: string): Record<string, unknown> | null {
  try {
    return JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─── Availability Check ─────────────────────────────────────────

async function isUlogdAvailable(): Promise<boolean> {
  try {
    await fs.access(SNI_FILE, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

// ─── Data Builders ──────────────────────────────────────────────

/**
 * Build NAT log entries from flow.json, enriched with SNI domains from sni.json.
 * This feeds the NAT Logs tab.
 */
export async function getNatLogsFromUlogd(
  options?: { sourceIp?: string; protocol?: string; maxRecords?: number },
): Promise<NatLogEntry[]> {
  const available = await isUlogdAvailable();
  if (!available) return [];

  // Read and parse both files in parallel
  const [sniLines, flowLines] = await Promise.all([
    readLastLines(SNI_FILE, MAX_LINES),
    readLastLines(FLOW_FILE, MAX_LINES),
  ]);

  // Build SNI domain map: dst_ip → sni_hostname (latest wins)
  // Also enrich non-SNI data packets via dst_ip cache
  const dstDomainCache = new Map<string, string>();
  const domainMap = new Map<string, string>();
  for (const line of sniLines) {
    const raw = parseLine(line);
    if (!raw) continue;
    const sni = parseSniRecordWithCache(raw, dstDomainCache);
    if (!sni || !sni.dest_ip || !sni.sni_hostname) continue;
    domainMap.set(sni.dest_ip, sni.sni_hostname);
  }

  // Parse flow records, apply filters
  const flows: FlowRecord[] = [];
  for (const line of flowLines) {
    const raw = parseLine(line);
    if (!raw) continue;
    const flow = parseFlowRecord(raw);
    if (!flow.src_ip) continue; // Skip malformed records

    // Skip localhost traffic
    if (flow.src_ip === '127.0.0.1' || flow.dest_ip === '127.0.0.1') continue;

    // Apply source IP filter
    if (options?.sourceIp && !flow.src_ip.includes(options.sourceIp)) continue;

    // Apply protocol filter
    if (options?.protocol && flow.proto !== options.protocol) continue;

    flows.push(flow);
  }

  // Sort by timestamp descending
  flows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Limit records
  const maxRecords = options?.maxRecords ?? 500;
  const limited = flows.slice(0, maxRecords);

  return limited.map((flow, idx) => {
    const rawTs = flow.timestamp;
    const ts = rawTs.includes('T') ? rawTs : rawTs.replace(' ', 'T');
    return {
    id: `ulogd-${idx + 1}`,
    timestamp: ts,
    source_ip: flow.src_ip,
    src_port: flow.src_port,
    dest_ip: flow.dest_ip,
    dst_port: flow.dst_port,
    proto: flow.proto,
    event_type: flow.ct_event,
    bytes: flow.bytes_orig + flow.bytes_reply,
    bytes_orig: flow.bytes_orig,
    bytes_reply: flow.bytes_reply,
    packets: flow.packets_orig + flow.packets_reply,
    duration: flow.duration,
    status: flow.ct_event === 'NEW' ? 'NEW' : 'ASSURED',
    // NAT translated source (server WAN IP from conntrack reply tuple)
    nat_src_ip: flow.nat_src_ip,
    nat_src_port: flow.nat_src_port,
    // Enrich with SNI domain name (trusted source from TLS handshake)
    domain: domainMap.get(flow.dest_ip) ?? '',
    guestName: '', // Will be filled by API route from WiFiSession
    action: 'allow',
    };
  });
}

/**
 * Build web surfing entries from sni.json using dst_ip → domain cache enrichment.
 *
 * Key insight: ulogd2 captures ALL port-443 packets, but only ~2.5% are ClientHello
 * (with SNI hostname). The remaining ~97.5% are data packets carrying actual bandwidth.
 * We enrich those data packets using a dst_ip → domain cache built from ClientHello
 * entries, and use raw.pktlen as per-domain byte totals.
 *
 * This feeds the Web Surfing tab (ulogd2 fallback path when ClickHouse is unavailable).
 */
export async function getWebSurfingFromUlogd(
  options?: { search?: string; category?: string; maxRecords?: number },
): Promise<SurfingEntry[]> {
  const available = await isUlogdAvailable();
  if (!available) return [];

  const sniLines = await readLastLines(SNI_FILE, MAX_LINES);

  // ── Pass 1: Parse ALL sni.json entries with dst_ip → domain cache ──
  const dstDomainCache = new Map<string, string>(); // dst_ip → sni_hostname

  // Aggregate by (src_ip, domain) with packet_bytes sum
  const domainAgg = new Map<string, {
    src_ip: string;
    src_port: number;
    dest_ip: string;
    dest_port: number;
    in_iface: string;
    domain: string;
    count: number;
    lastSeen: string;
    totalBytes: number;
  }>();

  for (const line of sniLines) {
    const raw = parseLine(line);
    if (!raw) continue;

    const record = parseSniRecordWithCache(raw, dstDomainCache);
    if (!record || !record.sni_hostname || !record.src_ip) continue;

    const aggKey = `${record.src_ip}:${record.sni_hostname}`;
    const existing = domainAgg.get(aggKey);
    if (existing) {
      existing.count++;
      existing.totalBytes += record.packet_bytes;
      if (record.timestamp > existing.lastSeen) existing.lastSeen = record.timestamp;
      // Take latest src_port, dest_ip, dest_port, in_iface
      if (record.src_port) existing.src_port = record.src_port;
      if (record.dest_ip) existing.dest_ip = record.dest_ip;
      if (record.dest_port) existing.dest_port = record.dest_port;
      if (record.in_iface) existing.in_iface = record.in_iface;
    } else {
      domainAgg.set(aggKey, {
        src_ip: record.src_ip,
        src_port: record.src_port,
        dest_ip: record.dest_ip,
        dest_port: record.dest_port,
        in_iface: record.in_iface,
        domain: record.sni_hostname,
        count: 1,
        lastSeen: record.timestamp,
        totalBytes: record.packet_bytes,
      });
    }
  }

  // ── Build entries ──
  const entries: SurfingEntry[] = [];
  for (const [_, data] of domainAgg) {
    // Normalize timestamp for JavaScript Date compatibility
    const tsRaw = data.lastSeen;
    const tsNorm = tsRaw.includes('T') ? tsRaw : tsRaw.replace(' ', 'T');

    entries.push({
      id: `ulogd-${entries.length + 1}`,
      timestamp: tsNorm,
      domain: data.domain,
      sourceIp: data.src_ip,
      source_ip: data.src_ip,
      srcPort: data.src_port,
      destIp: data.dest_ip,
      destPort: data.dest_port,
      inIface: data.in_iface,
      category: classifyDomain(data.domain),
      totalBytes: data.totalBytes,
      connections: data.count,
      lastAccess: tsNorm,
      last_access: tsNorm,
      guestName: '', // Will be filled by API route
    });
  }

  // Sort by totalBytes descending
  entries.sort((a, b) => b.totalBytes - a.totalBytes);

  // Apply search filter
  let filtered = entries;
  if (options?.search) {
    const term = options.search.toLowerCase();
    filtered = filtered.filter(
      (e) => e.domain.toLowerCase().includes(term) || e.guestName.toLowerCase().includes(term),
    );
  }

  // Apply category filter
  if (options?.category && options.category !== 'all') {
    filtered = filtered.filter((e) => e.category === options.category);
  }

  // Limit
  return filtered.slice(0, options?.maxRecords ?? 200);
}

// ─── Domain Classifier ───────────────────────────────────────────

const DOMAIN_CATEGORIES: Record<string, string> = {
  'facebook.com': 'social_media', 'instagram.com': 'social_media',
  'twitter.com': 'social_media', 'linkedin.com': 'social_media',
  'whatsapp.com': 'social_media', 'snapchat.com': 'social_media',
  'threads.net': 'social_media', 'tiktok.com': 'social_media',
  'x.com': 'social_media',
  'youtube.com': 'video', 'vimeo.com': 'video', 'dailymotion.com': 'video',
  'netflix.com': 'streaming', 'hotstar.com': 'streaming',
  'primevideo.com': 'streaming', 'spotify.com': 'streaming',
  'jiosaavn.com': 'streaming',
  'amazon.com': 'shopping', 'amazon.in': 'shopping',
  'flipkart.com': 'shopping', 'myntra.com': 'shopping',
  'snapdeal.com': 'shopping', 'ajio.com': 'shopping',
  'google.com': 'tech', 'microsoft.com': 'tech', 'apple.com': 'tech',
  'github.com': 'tech', 'stackoverflow.com': 'tech', 'vercel.com': 'tech',
  'gmail.com': 'communication', 'outlook.com': 'communication',
  'telegram.org': 'communication', 'skype.com': 'communication', 'zoom.us': 'communication',
  'bbc.com': 'news', 'cnn.com': 'news', 'ndtv.com': 'news',
  'timesofindia.indiatimes.com': 'news', 'hindustantimes.com': 'news',
  'thehindu.com': 'news', 'reuters.com': 'news',
  'swiggy.com': 'food', 'zomato.com': 'food', 'ubereats.com': 'food',
  'imdb.com': 'entertainment', 'bookmyshow.com': 'entertainment',
  'wikipedia.org': 'entertainment',
  'coursera.org': 'education', 'udemy.com': 'education', 'khanacademy.org': 'education',
  'makemytrip.com': 'travel', 'booking.com': 'travel',
  'airbnb.com': 'travel', 'goibibo.com': 'travel',
  'steampowered.com': 'gaming', 'epicgames.com': 'gaming',
  'twitch.tv': 'gaming', 'pubg.com': 'gaming',
  'reddit.com': 'social_media', 'quora.com': 'social_media',
  'pinterest.com': 'social_media', 'medium.com': 'tech',
  'cisco.com': 'tech', 'mozilla.net': 'tech',
};

function classifyDomain(domain: string): string {
  const clean = domain.replace(/^\*\./, '').toLowerCase();
  if (DOMAIN_CATEGORIES[clean]) return DOMAIN_CATEGORIES[clean];
  const parts = clean.split('.');
  if (parts.length >= 2) {
    const parent = parts.slice(-2).join('.');
    if (DOMAIN_CATEGORIES[parent]) return DOMAIN_CATEGORIES[parent];
  }
  return 'other';
}

// ─── Guest Name Resolver (shared helper for API routes) ──────────

/** A single IP+timestamp pair from ClickHouse/ulogd2 */
export interface IpTimestamp {
  ip: string;
  timestamp: Date;
}

/**
 * Resolve guest names for IP+timestamp pairs using RadAcct + WiFiSession + Guest tables.
 * Called by API routes after getting ulogd data.
 *
 * Uses TIME-WINDOW matching to handle DHCP IP reuse:
 *   - IP 10.0.1.101 on Jan 3 → Guest A (session Jan 1-5)
 *   - IP 10.0.1.101 on Jan 10 → Guest B (session Jan 10-12)
 *
 * Four-tier lookup (most reliable first):
 *   0. RadAcct.framedipaddress + time window → WiFiUser.guestId → Guest
 *      Also: RadAcct.callingstationid → RadiusMacAuth.guestName (MAC auto-auth)
 *   1. WiFiSession.ipAddress + time window → Guest (name)
 *   2. DhcpLease → DeviceProfile → WiFiUser → Guest (MAC-based bridge)
 *
 * @param ipTimestamps - Array of {ip, timestamp} pairs (or plain string[] for backward compat)
 * @param tenantId - Optional tenant scope
 */
export async function resolveGuestNames(
  ipTimestamps: IpTimestamp[] | string[],
  tenantId?: string,
): Promise<Map<string, string>> {
  // Dynamic import to avoid Prisma dependency at module level
  const { db } = await import('@/lib/db');
  const guestMap = new Map<string, string>();

  // Backward-compatible: accept plain string[] (treat as now)
  const pairs: IpTimestamp[] = typeof ipTimestamps[0] === 'string'
    ? (ipTimestamps as string[]).map((ip) => ({ ip, timestamp: new Date() }))
    : ipTimestamps as IpTimestamp[];

  if (pairs.length === 0) return guestMap;

  try {
    const uniqueIps = Array.from(new Set(pairs.map((p) => p.ip)));
    const resolvedIps = new Set<string>();

    // ── Step 0: RadAcct lookup with time-window matching ──────────
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const radAcctRecords = await db.radAcct.findMany({
      where: {
        framedipaddress: { in: uniqueIps },
        acctstarttime: { gte: ninetyDaysAgo },
      },
      select: {
        framedipaddress: true,
        username: true,
        callingstationid: true,
        acctstarttime: true,
        acctstoptime: true,
      },
      orderBy: { acctstarttime: 'desc' },
    });

    if (radAcctRecords.length > 0) {
      // Group by IP
      const radAcctByIp = new Map<string, typeof radAcctRecords>();
      for (const r of radAcctRecords) {
        if (!r.framedipaddress) continue;
        const list = radAcctByIp.get(r.framedipaddress) || [];
        list.push(r);
        radAcctByIp.set(r.framedipaddress, list);
      }

      // Collect all unique usernames + MACs for batch lookup
      const allRadUsernames = new Set<string>();
      const allRadMacs = new Set<string>();
      for (const r of radAcctRecords) {
        if (r.username) allRadUsernames.add(r.username);
        if (r.callingstationid) allRadMacs.add(r.callingstationid);
      }

      // Batch: WiFiUser by username → guestId
      const wifiUserGuestMap = new Map<string, string>();
      if (allRadUsernames.size > 0) {
        const wifiUsers = await db.wiFiUser.findMany({
          where: { username: { in: [...allRadUsernames] } },
          select: { username: true, guestId: true },
        });
        for (const wu of wifiUsers) {
          if (wu.guestId) wifiUserGuestMap.set(wu.username, wu.guestId);
        }
      }

      // Batch: RadiusMacAuth by MAC → guestName / guestId
      const macAuthNameMap = new Map<string, string>();
      const macAuthGuestIdMap = new Map<string, string>();
      if (allRadMacs.size > 0) {
        const macAuths = await db.radiusMacAuth.findMany({
          where: { macAddress: { in: [...allRadMacs] } },
          select: { macAddress: true, guestName: true, guestId: true },
        });
        for (const ma of macAuths) {
          if (ma.guestName && !macAuthNameMap.has(ma.macAddress)) {
            macAuthNameMap.set(ma.macAddress, ma.guestName);
          }
          if (ma.guestId && !macAuthGuestIdMap.has(ma.macAddress)) {
            macAuthGuestIdMap.set(ma.macAddress, ma.guestId);
          }
        }
      }

      // Batch fetch guest names for all RadAcct chain IDs
      const allRadGuestIds = [...new Set([
        ...wifiUserGuestMap.values(),
        ...macAuthGuestIdMap.values(),
      ])];
      const radGuestNameMap = new Map<string, string>();
      if (allRadGuestIds.length > 0) {
        const radGuests = await db.guest.findMany({
          where: { id: { in: allRadGuestIds } },
          select: { id: true, firstName: true, lastName: true },
        });
        for (const g of radGuests) {
          const name = [g.firstName, g.lastName].filter(Boolean).join(' ');
          if (name) radGuestNameMap.set(g.id, name);
        }
      }

      // Resolve each (IP, timestamp) pair with time-window matching
      for (const pair of pairs) {
        if (resolvedIps.has(pair.ip)) continue;

        const sessions = radAcctByIp.get(pair.ip);
        if (!sessions) continue;

        // Find RadAcct session active at this timestamp
        const matched = sessions.find((s) => {
          if (!s.acctstarttime) return false;
          if (pair.timestamp < new Date(s.acctstarttime)) return false;
          if (s.acctstoptime && pair.timestamp > new Date(s.acctstoptime)) return false;
          return true;
        });

        if (!matched) continue;

        // Path A: RadAcct.username → WiFiUser → Guest
        if (matched.username) {
          const guestId = wifiUserGuestMap.get(matched.username);
          if (guestId) {
            const name = radGuestNameMap.get(guestId);
            if (name) { guestMap.set(pair.ip, name); resolvedIps.add(pair.ip); continue; }
          }
        }

        // Path B: RadAcct.callingstationid (MAC) → RadiusMacAuth
        if (matched.callingstationid) {
          const mac = matched.callingstationid;
          const macName = macAuthNameMap.get(mac);
          if (macName) { guestMap.set(pair.ip, macName); resolvedIps.add(pair.ip); continue; }

          const macGuestId = macAuthGuestIdMap.get(mac);
          if (macGuestId) {
            const name = radGuestNameMap.get(macGuestId);
            if (name) { guestMap.set(pair.ip, name); resolvedIps.add(pair.ip); continue; }
          }
        }

        // Path C: Use RadAcct.username as display name
        if (matched.username && !guestMap.has(pair.ip)) {
          guestMap.set(pair.ip, matched.username);
          resolvedIps.add(pair.ip);
        }
      }
    }

    // ── Step 1: WiFiSession lookup with time-window matching ───────
    const step1Pairs = pairs.filter((p) => !resolvedIps.has(p.ip));
    const step1Ips = [...new Set(step1Pairs.map((p) => p.ip))];

    if (step1Ips.length > 0) {
      const sessions = await db.wiFiSession.findMany({
        where: {
          ...(tenantId ? { tenantId } : {}),
          ipAddress: { in: step1Ips },
        },
        select: {
          ipAddress: true,
          guestId: true,
          startTime: true,
          endTime: true,
        },
      });

      if (sessions.length > 0) {
        // Group by IP
        const sessionsByIp = new Map<string, typeof sessions>();
        for (const s of sessions) {
          const list = sessionsByIp.get(s.ipAddress) || [];
          list.push(s);
          sessionsByIp.set(s.ipAddress, list);
        }

        // Collect guest IDs
        const guestIds = [...new Set(
          sessions.map((s) => s.guestId).filter((g): g is string => !!g),
        )];

        if (guestIds.length > 0) {
          const guests = await db.guest.findMany({
            where: { id: { in: [...new Set(guestIds)] } },
            select: { id: true, firstName: true, lastName: true },
          });
          const guestNameMap = new Map<string, string>();
          for (const g of guests) {
            const name = [g.firstName, g.lastName].filter(Boolean).join(' ');
            if (name) guestNameMap.set(g.id, name);
          }

          // Resolve with time-window matching
          for (const pair of step1Pairs) {
            if (resolvedIps.has(pair.ip)) continue;
            const ipSessions = sessionsByIp.get(pair.ip);
            if (!ipSessions) continue;

            const matched = ipSessions.find((s) => {
              if (!s.startTime) return false;
              if (pair.timestamp < new Date(s.startTime)) return false;
              if (s.endTime && pair.timestamp > new Date(s.endTime)) return false;
              return true;
            });

            if (matched && matched.guestId) {
              const name = guestNameMap.get(matched.guestId);
              if (name) { guestMap.set(pair.ip, name); resolvedIps.add(pair.ip); }
            }
          }
        }
      }
    }

    // ── Step 2: DHCP lease bridge for unresolved IPs ───────────────
    const step2Ips = [...new Set(pairs.filter((p) => !resolvedIps.has(p.ip)).map((p) => p.ip))];
    if (step2Ips.length > 0) {
      const dhcpLeases = await db.dhcpLease.findMany({
        where: { ipAddress: { in: step2Ips } },
        select: {
          ipAddress: true,
          macAddress: true,
        },
      });

      for (const lease of dhcpLeases) {
        if (guestMap.has(lease.ipAddress)) continue;
        if (lease.macAddress && !guestMap.has(lease.ipAddress)) {
          try {
            const device = await db.deviceProfile.findFirst({
              where: {
                macAddress: lease.macAddress,
                isActive: true,
              },
              select: { guestId: true, wifiUserId: true },
            });
            let targetGuestId = device?.guestId;
            if (!targetGuestId && device?.wifiUserId) {
              const wu = await db.wiFiUser.findUnique({
                where: { id: device.wifiUserId },
                select: { guestId: true },
              });
              targetGuestId = wu?.guestId;
            }
            if (targetGuestId) {
              const guest = await db.guest.findUnique({
                where: { id: targetGuestId },
                select: { id: true, firstName: true, lastName: true },
              });
              if (guest) {
                const name = [guest.firstName, guest.lastName].filter(Boolean).join(' ');
                if (name) guestMap.set(lease.ipAddress, name);
              }
            }
          } catch { /* skip */ }
        }
      }
    }
  } catch {
    // Guest resolution is best-effort
  }

  return guestMap;
}
