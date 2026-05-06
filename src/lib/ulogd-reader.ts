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
  oob_in: string;
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
  domain: string;
  guestName: string;
  action: string;
}

export interface SurfingEntry {
  id: string;
  domain: string;
  sourceIp: string;
  source_ip: string;
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

function parseSniRecord(raw: Record<string, unknown>): SniRecord | null {
  const hostname = String(raw['sni.hostname'] ?? '').trim();
  // Skip empty SNI records (ACK-only packets with no TLS payload)
  if (!hostname) return null;

  return {
    timestamp: String(raw.timestamp ?? ''),
    src_ip: String(raw.src_ip ?? raw['ip.saddr.str'] ?? ''),
    dest_ip: String(raw.dest_ip ?? raw['ip.daddr.str'] ?? ''),
    dest_port: Number(raw.dest_port ?? 0),
    sni_hostname: hostname,
    sni_tls_version: String(raw['sni.tls.version'] ?? ''),
    oob_in: String(raw['oob.in'] ?? ''),
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
  const domainMap = new Map<string, string>();
  for (const line of sniLines) {
    const raw = parseLine(line);
    if (!raw) continue;
    const sni = parseSniRecord(raw);
    if (!sni || !sni.dest_ip) continue;
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

  return limited.map((flow, idx) => ({
    id: `ulogd-${idx + 1}`,
    timestamp: flow.timestamp,
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
    // Enrich with SNI domain name (trusted source from TLS handshake)
    domain: domainMap.get(flow.dest_ip) ?? '',
    guestName: '', // Will be filled by API route from WiFiSession
    action: 'allow',
  }));
}

/**
 * Build web surfing entries from sni.json + flow.json.
 * Joins SNI domain names with flow byte counters by (src_ip, dst_ip).
 * This feeds the Web Surfing tab.
 */
export async function getWebSurfingFromUlogd(
  options?: { search?: string; category?: string; maxRecords?: number },
): Promise<SurfingEntry[]> {
  const available = await isUlogdAvailable();
  if (!available) return [];

  const [sniLines, flowLines] = await Promise.all([
    readLastLines(SNI_FILE, MAX_LINES),
    readLastLines(FLOW_FILE, MAX_LINES),
  ]);

  // ── Aggregate SNI records by (src_ip, dest_ip, sni_hostname) ──
  const sniKey = (src: string, dst: string, domain: string) => `${src}:${dst}:${domain}`;
  const sniAgg = new Map<string, { src_ip: string; dest_ip: string; domain: string; count: number; lastSeen: string }>();

  for (const line of sniLines) {
    const raw = parseLine(line);
    if (!raw) continue;
    const sni = parseSniRecord(raw);
    if (!sni || !sni.sni_hostname) continue;
    if (!sni.src_ip) continue;

    const key = sniKey(sni.src_ip, sni.dest_ip, sni.sni_hostname);
    const existing = sniAgg.get(key);
    if (existing) {
      existing.count++;
      if (sni.timestamp > existing.lastSeen) existing.lastSeen = sni.timestamp;
    } else {
      sniAgg.set(key, {
        src_ip: sni.src_ip,
        dest_ip: sni.dest_ip,
        domain: sni.sni_hostname,
        count: 1,
        lastSeen: sni.timestamp,
      });
    }
  }

  // ── Aggregate flow bytes by (src_ip, dest_ip) ──
  const flowKey = (src: string, dst: string) => `${src}:${dst}`;
  const flowAgg = new Map<string, { bytes_orig: number; bytes_reply: number; packets_orig: number; packets_reply: number }>();

  for (const line of flowLines) {
    const raw = parseLine(line);
    if (!raw) continue;
    const flow = parseFlowRecord(raw);
    if (!flow.src_ip || flow.src_ip === '127.0.0.1') continue;

    const key = flowKey(flow.src_ip, flow.dest_ip);
    const existing = flowAgg.get(key);
    if (existing) {
      existing.bytes_orig += flow.bytes_orig;
      existing.bytes_reply += flow.bytes_reply;
      existing.packets_orig += flow.packets_orig;
      existing.packets_reply += flow.packets_reply;
    } else {
      flowAgg.set(key, {
        bytes_orig: flow.bytes_orig,
        bytes_reply: flow.bytes_reply,
        packets_orig: flow.packets_orig,
        packets_reply: flow.packets_reply,
      });
    }
  }

  // ── Join SNI + flow data ──
  const entries: SurfingEntry[] = [];
  const seen = new Set<string>(); // Deduplicate by (src_ip, domain)

  for (const [_, sniData] of sniAgg) {
    const userKey = `${sniData.src_ip}:${sniData.domain}`;
    if (seen.has(userKey)) continue;
    seen.add(userKey);

    // Sum bytes across all dst_ips for this (src_ip, domain) pair
    let totalBytes = 0;
    let totalConnections = 0;

    for (const [_, flowData] of flowAgg) {
      const fKey = flowKey(sniData.src_ip, sniData.dest_ip);
      if (fKey === flowKey(sniData.src_ip, sniData.dest_ip)) {
        totalBytes += flowData.bytes_orig + flowData.bytes_reply;
        totalConnections += flowData.packets_orig + flowData.packets_reply;
      }
    }

    entries.push({
      id: `ulogd-${entries.length + 1}`,
      domain: sniData.domain,
      sourceIp: sniData.src_ip,
      source_ip: sniData.src_ip,
      category: classifyDomain(sniData.domain),
      totalBytes,
      connections: sniData.count,
      lastAccess: sniData.lastSeen,
      last_access: sniData.lastSeen,
      guestName: '', // Will be filled by API route from WiFiSession
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

/**
 * Resolve guest names for a set of IPs using WiFiSession + Guest tables.
 * Called by API routes after getting ulogd data.
 */
export async function resolveGuestNames(
  ips: string[],
  tenantId?: string,
): Promise<Map<string, string>> {
  // Dynamic import to avoid Prisma dependency at module level
  const { db } = await import('@/lib/db');
  const guestMap = new Map<string, string>();

  if (ips.length === 0) return guestMap;

  try {
    const uniqueIps = Array.from(new Set(ips));

    const sessions = await db.wiFiSession.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ipAddress: { in: uniqueIps },
      },
      select: {
        ipAddress: true,
        guestId: true,
        guest: { select: { firstName: true, lastName: true } },
      },
    });

    const guestIds: string[] = [];
    const ipToGuestId = new Map<string, string>();

    for (const s of sessions) {
      const ip = s.ipAddress;
      if (ip && s.guestId) {
        ipToGuestId.set(ip, s.guestId);
        guestIds.push(s.guestId);
        // Also set name directly if guest is populated
        if (s.guest) {
          const name = [s.guest.firstName, s.guest.lastName].filter(Boolean).join(' ');
          if (name) guestMap.set(ip, name);
        }
      }
    }

    // Batch-resolve any missing guest names
    if (guestIds.length > 0) {
      const uniqueGuestIds = Array.from(new Set(guestIds));
      const guests = await db.guest.findMany({
        where: { id: { in: uniqueGuestIds } },
        select: { id: true, firstName: true, lastName: true },
      });

      for (const g of guests) {
        const name = [g.firstName, g.lastName].filter(Boolean).join(' ');
        if (name) {
          // Find all IPs mapped to this guest
          ipToGuestId.forEach((gId, ip) => {
            if (gId === g.id) guestMap.set(ip, name);
          });
        }
      }
    }
  } catch {
    // Guest resolution is best-effort
  }

  return guestMap;
}
