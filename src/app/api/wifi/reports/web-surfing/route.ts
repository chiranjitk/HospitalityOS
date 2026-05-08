import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { query, isAvailable } from '@/lib/clickhouse';
import { getWebSurfingFromUlogd, resolveGuestNames } from '@/lib/ulogd-reader';

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
    const clickhouseReady = await isAvailable();

    if (clickhouseReady) {
      // Query SNI log aggregated by domain + source IP, joined with nat_log for bytes
      const sniRows = await query<Record<string, unknown>>(`
        SELECT
          s.sni_domain as domain,
          s.src_ip,
          count() as connections,
          max(s.timestamp) as last_seen,
          groupArray(DISTINCT s.tls_version)[1] as tls_version
        FROM ipdr.sni_log s
        WHERE s.timestamp >= now() - INTERVAL 30 DAY
          AND s.sni_domain != ''
        GROUP BY s.sni_domain, s.src_ip
        ORDER BY connections DESC
        LIMIT 500
      `);

      if (sniRows.length > 0) {
        // ── Get bytes from nat_log for each (src_ip, dst_ip) pair ──
        // Build a map of (src_ip, sni_domain) → dst_ip from sni_log
        // Then query nat_log for bytes matching those dst_ips
        const domainDstMap = new Map<string, Set<string>>(); // "src_ip:domain" → Set<dst_ip>

        const sniDetailRows = await query<Record<string, unknown>>(`
          SELECT src_ip, dst_ip, sni_domain
          FROM ipdr.sni_log
          WHERE timestamp >= now() - INTERVAL 30 DAY
            AND sni_domain != ''
          GROUP BY src_ip, dst_ip, sni_domain
          LIMIT 10000
        `);

        for (const row of sniDetailRows) {
          const srcIp = String(row.src_ip ?? '');
          const dstIp = String(row.dst_ip ?? '');
          const domain = String(row.sni_domain ?? '');
          if (srcIp && dstIp && domain) {
            const key = `${srcIp}:${domain}`;
            if (!domainDstMap.has(key)) domainDstMap.set(key, new Set());
            domainDstMap.get(key)!.add(dstIp);
          }
        }

        // Query nat_log for bytes matching these dst_ips
        const allDstIps = new Set<string>();
        for (const dstSet of domainDstMap.values()) {
          for (const ip of dstSet) allDstIps.add(ip);
        }

        const bytesMap = new Map<string, number>(); // "src_ip:dst_ip" → total_bytes
        if (allDstIps.size > 0) {
          const ipChunks: string[][] = [];
          const ipArr = [...allDstIps];
          // ClickHouse IN clause limit: chunk into groups of 500
          for (let i = 0; i < ipArr.length; i += 500) {
            ipChunks.push(ipArr.slice(i, i + 500));
          }

          for (const chunk of ipChunks) {
            const ipList = chunk.map((ip) => `'${ip.replace(/'/g, "\\'")}'`).join(',');
            const bytesRows = await query<Record<string, unknown>>(`
              SELECT src_ip, dst_ip, sum(bytes) as total_bytes
              FROM ipdr.nat_log
              WHERE timestamp >= now() - INTERVAL 30 DAY
                AND dst_ip IN (${ipList})
                AND bytes > 0
              GROUP BY src_ip, dst_ip
              LIMIT 10000
            `);

            for (const row of bytesRows) {
              const key = `${String(row.src_ip)}:${String(row.dst_ip)}`;
              bytesMap.set(key, Number(row.total_bytes) || 0);
            }
          }
        }

        // ── Guest name resolution via WiFiSession + DHCP lease + DeviceProfile ──
        const uniqueIps = [...new Set(sniRows.map((r) => String(r.src_ip ?? '')))];
        const ipToGuest = new Map<string, string>();
        const resolvedIps = new Set<string>();

        if (uniqueIps.length > 0) {
          try {
            // Step 1: Match by WiFiSession.ipAddress (primary lookup)
            const sessions = await db.wiFiSession.findMany({
              where: { ipAddress: { in: uniqueIps } },
              select: { id: true, guestId: true, ipAddress: true },
            });

            // Collect valid guest IDs
            const guestIds = sessions
              .map((s) => s.guestId)
              .filter((g): g is string => !!g);
            const uniqueGuestIds = [...new Set(guestIds)];

            // Build IP → guestId map
            const ipToGuestId = new Map<string, string>();
            for (const s of sessions) {
              if (s.ipAddress && s.guestId) {
                ipToGuestId.set(s.ipAddress, s.guestId);
                resolvedIps.add(s.ipAddress);
              }
            }

            // Batch-fetch guest names
            if (uniqueGuestIds.length > 0) {
              const guests = await db.guest.findMany({
                where: { id: { in: uniqueGuestIds } },
                select: { id: true, firstName: true, lastName: true },
              });
              const guestNameMap = new Map<string, string>();
              for (const g of guests) {
                const name = `${g.firstName ?? ''} ${g.lastName ?? ''}`.trim();
                if (name) guestNameMap.set(g.id, name);
              }
              // Map IP → guest name
              ipToGuestId.forEach((guestId, ip) => {
                const name = guestNameMap.get(guestId);
                if (name) ipToGuest.set(ip, name);
              });
            }

            // Step 2: For unresolved IPs, try DHCP lease table (MAC→IP→guest mapping)
            const unresolvedIps = uniqueIps.filter((ip) => !resolvedIps.has(ip));
            if (unresolvedIps.length > 0) {
              const dhcpLeases = await db.dhcpLease.findMany({
                where: { ipAddress: { in: unresolvedIps } },
                select: {
                  ipAddress: true,
                  macAddress: true,
                },
              });

              for (const lease of dhcpLeases) {
                if (ipToGuest.has(lease.ipAddress)) continue;
                // Try matching MAC via DeviceProfile → WiFiUser → Guest
                if (lease.macAddress && !ipToGuest.has(lease.ipAddress)) {
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
                        const name = `${guest.firstName ?? ''} ${guest.lastName ?? ''}`.trim();
                        if (name) ipToGuest.set(lease.ipAddress, name);
                      }
                    }
                  } catch { /* skip */ }
                }
              }
            }
          } catch {
            // Guest resolution is best-effort; continue without names
          }
        }

        // ── Build response ──────────────────────────────────────
        const data: SurfingEntry[] = sniRows.map((r, idx) => {
          const srcIp = String(r.src_ip ?? '');
          const domain = String(r.domain ?? '');
          const key = `${srcIp}:${domain}`;

          // Sum bytes across all dst_ips that resolved to this domain for this src_ip
          let totalBytes = 0;
          const dstIps = domainDstMap.get(key);
          if (dstIps) {
            for (const dip of dstIps) {
              const bKey = `${srcIp}:${dip}`;
              totalBytes += bytesMap.get(bKey) || 0;
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
      const ulogdData = await getWebSurfingFromUlogd({ search, category });

      if (ulogdData.length > 0) {
        // Resolve guest names from WiFi sessions
        const uniqueIps = [...new Set(ulogdData.map((d) => d.sourceIp))];
        const guestMap = await resolveGuestNames(uniqueIps, user.tenantId);

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
