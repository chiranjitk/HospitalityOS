import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { query, isAvailable } from '@/lib/clickhouse';
import { getWebSurfingFromUlogd, resolveGuestNames } from '@/lib/ulogd-reader';
import { correlateIpsToGuests } from '@/lib/ip-user-correlator';

// ─── Constants ──────────────────────────────────────────────────

const ALL_CATEGORIES = [
  'social_media',
  'video',
  'streaming',
  'shopping',
  'tech',
  'communication',
  'news',
  'food',
  'entertainment',
  'education',
  'travel',
  'gaming',
  'other',
] as const;

type Category = (typeof ALL_CATEGORIES)[number];

/** Maps 60+ domains to one of 13 categories. */
const DOMAIN_CATEGORIES: Record<string, Category> = {
  // social_media
  'facebook.com': 'social_media',
  'instagram.com': 'social_media',
  'twitter.com': 'social_media',
  'linkedin.com': 'social_media',
  'whatsapp.com': 'social_media',
  'snapchat.com': 'social_media',
  'threads.net': 'social_media',
  'tiktok.com': 'social_media',
  // video
  'youtube.com': 'video',
  'vimeo.com': 'video',
  'dailymotion.com': 'video',
  // streaming
  'netflix.com': 'streaming',
  'hotstar.com': 'streaming',
  'primevideo.com': 'streaming',
  'spotify.com': 'streaming',
  'jiosaavn.com': 'streaming',
  // shopping
  'amazon.com': 'shopping',
  'amazon.in': 'shopping',
  'flipkart.com': 'shopping',
  'myntra.com': 'shopping',
  'snapdeal.com': 'shopping',
  'ajio.com': 'shopping',
  // tech
  'google.com': 'tech',
  'microsoft.com': 'tech',
  'apple.com': 'tech',
  'github.com': 'tech',
  'stackoverflow.com': 'tech',
  'vercel.com': 'tech',
  // communication
  'gmail.com': 'communication',
  'outlook.com': 'communication',
  'telegram.org': 'communication',
  'skype.com': 'communication',
  'zoom.us': 'communication',
  // news
  'bbc.com': 'news',
  'cnn.com': 'news',
  'ndtv.com': 'news',
  'timesofindia.indiatimes.com': 'news',
  'hindustantimes.com': 'news',
  'thehindu.com': 'news',
  'reuters.com': 'news',
  // food
  'swiggy.com': 'food',
  'zomato.com': 'food',
  'ubereats.com': 'food',
  // entertainment
  'imdb.com': 'entertainment',
  'bookmyshow.com': 'entertainment',
  'wikipedia.org': 'entertainment',
  // education
  'coursera.org': 'education',
  'udemy.com': 'education',
  'khanacademy.org': 'education',
  // travel
  'makemytrip.com': 'travel',
  'booking.com': 'travel',
  'airbnb.com': 'travel',
  'goibibo.com': 'travel',
  // gaming
  'steampowered.com': 'gaming',
  'epicgames.com': 'gaming',
  'twitch.tv': 'gaming',
  'pubg.com': 'gaming',
};

function classifyDomain(domain: string): Category {
  // Strip leading wildcard (e.g., *.google.com → google.com)
  const clean = domain.replace(/^\*\./, '');
  // Check exact match first, then parent domain
  if (DOMAIN_CATEGORIES[clean]) return DOMAIN_CATEGORIES[clean];
  const parts = clean.split('.');
  if (parts.length >= 2) {
    const parent = parts.slice(-2).join('.');
    if (DOMAIN_CATEGORIES[parent]) return DOMAIN_CATEGORIES[parent];
  }
  return 'other';
}

// ─── Deterministic demo data ────────────────────────────────────

const DEMO_DOMAINS = [
  'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com', 'whatsapp.com',
  'snapchat.com', 'youtube.com', 'vimeo.com', 'dailymotion.com', 'netflix.com',
  'hotstar.com', 'primevideo.com', 'spotify.com', 'jiosaavn.com', 'amazon.in',
  'flipkart.com', 'myntra.com', 'snapdeal.com', 'google.com', 'microsoft.com',
  'apple.com', 'github.com', 'stackoverflow.com', 'gmail.com', 'outlook.com',
  'telegram.org', 'skype.com', 'zoom.us', 'bbc.com', 'cnn.com',
  'ndtv.com', 'timesofindia.indiatimes.com', 'hindustantimes.com', 'swiggy.com',
  'zomato.com', 'ubereats.com', 'imdb.com', 'bookmyshow.com', 'wikipedia.org',
  'coursera.org', 'udemy.com', 'khanacademy.org', 'makemytrip.com', 'booking.com',
  'airbnb.com', 'goibibo.com', 'steampowered.com', 'epicgames.com', 'twitch.tv',
  'pubg.com', 'reddit.com', 'quora.com', 'pinterest.com', 'medium.com',
];

const DEMO_GUEST_MAP = new Map<string, string>([
  ['10.0.1.101', 'Rahul Sharma'],
  ['10.0.1.102', 'Priya Patel'],
  ['10.0.1.103', 'Amit Verma'],
  ['10.0.2.101', 'Sneha Reddy'],
  ['10.0.3.101', 'Vikram Singh'],
]);

function generateDemoData() {
  const entries: Array<{
    id: string;
    domain: string;
    sourceIp: string;
    source_ip: string;
    category: Category;
    totalBytes: number;
    connections: number;
    lastAccess: string;
    last_access: string;
    guestName: string;
  }> = [];

  for (let i = 0; i < 50; i++) {
    const domain = DEMO_DOMAINS[i % DEMO_DOMAINS.length];
    // Deterministic IP spread across 10.0.1–10.0.4
    const subnet = 1 + (i % 4);
    const host = 101 + ((i * 7 + 3) % 10);
    const ip = `10.0.${subnet}.${host}`;

    // Deterministic bytes: base increases with index
    const totalBytes = (i + 1) * 1048576 + (i % 5) * 524288; // 1–50 MB range
    const connections = 1 + (i % 47); // 1–47
    const category = classifyDomain(domain);

    // Deterministic last-access timestamp within the past 30 days
    const daysAgo = i % 30;
    const hoursOffset = (i * 3) % 24;
    const minutesOffset = (i * 7) % 60;
    const lastAccess = new Date();
    lastAccess.setDate(lastAccess.getDate() - daysAgo);
    lastAccess.setHours(hoursOffset, minutesOffset, 0, 0);

    const lastAccessStr = lastAccess.toISOString();
    const guestName = DEMO_GUEST_MAP.get(ip) ?? '';

    entries.push({
      id: `ws-${i + 1}`,
      timestamp: lastAccessStr,
      domain,
      sourceIp: ip,
      source_ip: ip,
      srcPort: 0,
      destIp: '',
      destPort: 443,
      inIface: '',
      category,
      totalBytes,
      connections,
      lastAccess: lastAccessStr,
      last_access: lastAccessStr,
      guestName,
    });
  }

  // Sort by totalBytes descending
  entries.sort((a, b) => b.totalBytes - a.totalBytes);

  return entries;
}

// ─── Helpers ────────────────────────────────────────────────────

interface SurfingEntry {
  id: string;
  timestamp: string;
  domain: string;
  sourceIp: string;
  source_ip: string;
  srcPort: number;
  destIp: string;
  destPort: number;
  inIface: string;
  category: Category;
  totalBytes: number;
  connections: number;
  lastAccess: string;
  last_access: string;
  guestName: string;
}

function computeSummary(data: SurfingEntry[]) {
  const uniqueDomains = new Set(data.map((d) => d.domain));
  const uniqueIps = new Set(data.map((d) => d.sourceIp));
  const totalBytes = data.reduce((sum, d) => sum + d.totalBytes, 0);

  // Find top category by total bytes
  const categoryBytes = new Map<string, number>();
  for (const d of data) {
    categoryBytes.set(d.category, (categoryBytes.get(d.category) ?? 0) + d.totalBytes);
  }
  let topCategory = 'other';
  let topBytes = 0;
  for (const [cat, bytes] of categoryBytes) {
    if (bytes > topBytes) {
      topBytes = bytes;
      topCategory = cat;
    }
  }

  return {
    totalDomains: uniqueDomains.size,
    totalBytes,
    uniqueUsers: uniqueIps.size,
    topCategory,
  };
}

function applyFilters(
  data: SurfingEntry[],
  search?: string | null,
  category?: string | null,
): SurfingEntry[] {
  let filtered = data;

  if (search) {
    const term = search.toLowerCase();
    filtered = filtered.filter(
      (d) =>
        d.domain.toLowerCase().includes(term) ||
        d.guestName.toLowerCase().includes(term),
    );
  }

  if (category && category !== 'all') {
    filtered = filtered.filter((d) => d.category === category);
  }

  return filtered;
}

// ─── GET handler ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'reports.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const category = searchParams.get('category');

    // ── Attempt ClickHouse query ────────────────────────────────
    // Data source: ipdr.sni_log (NFLOG TLS SNI captures)
    // SNI is the TRUSTED source for domain identification because:
    // - Every HTTPS connection sends SNI in plaintext during TLS handshake
    // - Users cannot bypass it even with custom DNS (8.8.8.8, 1.1.1.1, etc.)
    // - Unlike dnsmasq DNS logs, SNI is captured at the network level via NFLOG
    //
    // Bandwidth data: sni_log.packet_bytes — sum of captured packet sizes per domain.
    // The sni-parser enriches non-SNI data packets using a dst_ip→domain cache,
    // so packet_bytes includes both ClientHello and subsequent data transfer packets.
    const clickhouseReady = await isAvailable();

    if (clickhouseReady) {
      console.log('[web-surfing] ClickHouse is available, querying ipdr.sni_log...');

      // Single query: domain + src_ip with packet_bytes aggregation.
      // No nat_log join needed — packet_bytes comes directly from packet captures.
      // Use ifNull to handle cases where packet_bytes column doesn't exist yet.
      const sniRows = await query<Record<string, unknown>>(`
        SELECT
          sni_domain as domain,
          src_ip,
          max(ifNull(src_port, 0)) as src_port,
          max(dst_ip) as dst_ip,
          max(ifNull(dst_port, 443)) as dst_port,
          max(ifNull(in_iface, '')) as in_iface,
          count() as connections,
          max(timestamp) as last_seen,
          ifNull(toUInt64(sum(packet_bytes)), 0) as total_bytes,
          groupArray(DISTINCT tls_version)[1] as tls_version
        FROM ipdr.sni_log
        WHERE timestamp >= now() - INTERVAL 30 DAY
          AND sni_domain != ''
        GROUP BY sni_domain, src_ip
        ORDER BY total_bytes DESC
        LIMIT 500
      `);

      console.log(`[web-surfing] sni_log query returned ${sniRows.length} rows`);

      if (sniRows.length > 0) {
        // ── Optionally enrich with nat_log bytes (if available) ──
        // nat_log provides cumulative connection bytes from conntrack,
        // which is more accurate than packet_bytes for total bandwidth.
        // We ADD nat_log bytes to packet_bytes (not replace).
        let natBytesMap: Map<string, number> | null = null;

        try {
          // Collect unique dst_ips from sni_log for nat_log lookup
          const dstIpRows = await query<Record<string, unknown>>(`
            SELECT src_ip, dst_ip, sni_domain
            FROM ipdr.sni_log
            WHERE timestamp >= now() - INTERVAL 30 DAY
              AND sni_domain != ''
            GROUP BY src_ip, dst_ip, sni_domain
            LIMIT 10000
          `);

          if (dstIpRows.length > 0) {
            const allDstIps = new Set<string>();
            for (const row of dstIpRows) {
              const dip = String(row.dst_ip ?? '');
              if (dip) allDstIps.add(dip);
            }

            if (allDstIps.size > 0) {
              const ipArr = [...allDstIps];
              const ipList = ipArr.slice(0, 500).map((ip) => `'${ip.replace(/'/g, "\\'")}'`).join(',');
              const bytesRows = await query<Record<string, unknown>>(`
                SELECT src_ip, dst_ip, sum(bytes) as total_bytes
                FROM ipdr.nat_log
                WHERE timestamp >= now() - INTERVAL 30 DAY
                  AND dst_ip IN (${ipList})
                  AND bytes > 0
                GROUP BY src_ip, dst_ip
                LIMIT 10000
              `);

              if (bytesRows.length > 0) {
                natBytesMap = new Map<string, number>();
                // Build (src_ip, dst_ip) → bytes map
                const rawMap = new Map<string, number>();
                for (const row of bytesRows) {
                  const key = `${String(row.src_ip)}:${String(row.dst_ip)}`;
                  rawMap.set(key, Number(row.total_bytes) || 0);
                }
                // Aggregate nat_log bytes per (src_ip, domain)
                for (const row of dstIpRows) {
                  const srcIp = String(row.src_ip ?? '');
                  const dstIp = String(row.dst_ip ?? '');
                  const domain = String(row.sni_domain ?? '');
                  if (!srcIp || !domain) continue;
                  const bKey = `${srcIp}:${dstIp}`;
                  const bytes = rawMap.get(bKey) || 0;
                  if (bytes > 0) {
                    const dKey = `${srcIp}:${domain}`;
                    natBytesMap.set(dKey, (natBytesMap.get(dKey) || 0) + bytes);
                  }
                }
                console.log(`[web-surfing] nat_log enrichment: ${natBytesMap.size} domains with conntrack bytes`);
              }
            }
          }
        } catch (err) {
          // nat_log enrichment is optional — don't fail if unavailable
          console.warn(`[web-surfing] nat_log enrichment skipped:`, err);
        }

        // ── Guest name resolution via shared correlator (time-window aware) ──
        // Pass IP+timestamp pairs so the correlator finds the RIGHT guest
        // for the RIGHT time window (handles DHCP IP reuse correctly)
        const ipTimestampPairs = sniRows.map((r) => {
          const rawTs = String(r.last_seen ?? '');
          const ts = rawTs.includes('T') ? rawTs : rawTs.replace(' ', 'T');
          return {
            ip: String(r.src_ip ?? ''),
            timestamp: new Date(ts),
          };
        });
        const correlation = await correlateIpsToGuests(ipTimestampPairs, user.tenantId);
        const ipToGuest = correlation.ipToGuest;

        // ── Build response ──────────────────────────────────────
        const data: SurfingEntry[] = sniRows.map((r, idx) => {
          const srcIp = String(r.src_ip ?? '');
          const domain = String(r.domain ?? '');

          // packet_bytes from sni_log (sum of captured packet sizes)
          let totalBytes = Number(r.total_bytes) || 0;

          // Add nat_log conntrack bytes if available (more accurate total)
          if (natBytesMap) {
            const natBytes = natBytesMap.get(`${srcIp}:${domain}`) || 0;
            if (natBytes > 0) {
              // Use the larger of the two as the definitive byte count
              totalBytes = Math.max(totalBytes, natBytes);
            }
          }

          const rawTs = String(r.last_seen ?? '');
          // ClickHouse DateTime: 'YYYY-MM-DD HH:MM:SS' → ISO 8601 for JavaScript Date
          const lastAccess = rawTs.includes('T') ? rawTs : rawTs.replace(' ', 'T');
          return {
            id: `ws-${idx + 1}`,
            timestamp: lastAccess,
            domain,
            sourceIp: srcIp,
            source_ip: srcIp,
            srcPort: Number(r.src_port) || 0,
            destIp: String(r.dst_ip ?? ''),
            destPort: Number(r.dst_port) || 443,
            inIface: String(r.in_iface ?? ''),
            category: classifyDomain(domain),
            totalBytes,
            connections: Number(r.connections) || 0,
            lastAccess,
            last_access: lastAccess,
            guestName: ipToGuest.get(srcIp) ?? '',
          };
        });

        // Sort by totalBytes descending
        data.sort((a, b) => b.totalBytes - a.totalBytes);

        const filtered = applyFilters(data, search, category);
        const summary = computeSummary(filtered);

        return NextResponse.json({
          success: true,
          data: filtered,
          summary,
          categories: [...ALL_CATEGORIES],
          dataSource: 'clickhouse',
        });
      }
    }

    // ── Fallback 2: ulogd2 JSON files (NFLOG SNI + NFCT flow) ──
    // Data source: /var/log/ulogd2/sni.json + /var/log/ulogd2/flow.json
    // This is the live data path when ClickHouse is not set up.
    // ulogd2 captures TLS SNI via NFLOG and connection tracking via NFCT.
    {
      console.log(`[web-surfing] ClickHouse ${clickhouseReady ? 'available but sni_log empty' : 'unavailable'}, trying ulogd2 fallback...`);
      const ulogdData = await getWebSurfingFromUlogd({ search, category });

      if (ulogdData.length > 0) {
        console.log(`[web-surfing] ulogd2 returned ${ulogdData.length} rows`);
        // Resolve guest names with time-window matching
        const ipTimestampPairs = ulogdData.map((d) => ({
          ip: d.sourceIp,
          timestamp: new Date(d.lastAccess || d.timestamp || Date.now()),
        }));
        const guestMap = await resolveGuestNames(ipTimestampPairs, user.tenantId);

        // Attach guest names
        for (const entry of ulogdData) {
          entry.guestName = guestMap.get(entry.sourceIp) ?? '';
        }

        const summary = computeSummary(ulogdData);

        return NextResponse.json({
          success: true,
          data: ulogdData,
          summary,
          categories: [...ALL_CATEGORIES],
          dataSource: 'ulogd2',
        });
      }
    }

    // ── Fallback 3: deterministic demo data ──────────────────────
    console.log('[web-surfing] No live data from ClickHouse or ulogd2 — serving demo data');
    const demoData = generateDemoData();
    const filtered = applyFilters(demoData, search, category);
    const summary = computeSummary(filtered);

    return NextResponse.json({
      success: true,
      data: filtered,
      summary,
      categories: [...ALL_CATEGORIES],
      dataSource: 'demo',
    });
  } catch (error) {
    console.error('[web-surfing] Error fetching web surfing data:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch web surfing data' },
      },
      { status: 500 },
    );
  }
}
