import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { query, isAvailable } from '@/lib/clickhouse';

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
  return DOMAIN_CATEGORIES[domain] ?? 'other';
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

interface WebSurfingRow {
  date: string;
  domain: string;
  category: string;
  src_ip: string;
  visit_count: number;
  total_bytes: number;
  unique_hours: number;
  first_seen: string;
  last_seen: string;
}

interface SurfingEntry {
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
    const clickhouseReady = await isAvailable();

    if (clickhouseReady) {
      const rows = await query<WebSurfingRow>(`
        SELECT
          date,
          domain,
          category,
          src_ip,
          visit_count,
          total_bytes,
          unique_hours,
          first_seen,
          last_seen
        FROM ipdr.web_surfing_report
        WHERE date >= today() - 30
        ORDER BY total_bytes DESC
        LIMIT 500
      `);

      if (rows.length > 0) {
        // Guest name resolution via WiFiSession
        const uniqueIps = [...new Set(rows.map((r) => r.src_ip))];
        const ipToGuest = new Map<string, string>();

        if (uniqueIps.length > 0) {
          try {
            const sessions = await db.wiFiSession.findMany({
              where: { assignedIp: { in: uniqueIps } },
              select: {
                sessionId: true,
                guestId: true,
                assignedIp: true,
                guest: { select: { firstName: true, lastName: true } },
              },
            });
            for (const s of sessions) {
              if (s.guest && s.assignedIp) {
                const name = `${s.guest.firstName ?? ''} ${s.guest.lastName ?? ''}`.trim();
                if (name) {
                  ipToGuest.set(s.assignedIp, name);
                }
              }
            }
          } catch {
            // Guest resolution is best-effort; continue without names
          }
        }

        const data: SurfingEntry[] = rows.map((r, idx) => {
          const lastAccess = r.last_seen ?? r.date;
          return {
            id: `ws-${idx + 1}`,
            domain: r.domain,
            sourceIp: r.src_ip,
            source_ip: r.src_ip,
            category: (r.category as Category) || classifyDomain(r.domain),
            totalBytes: Number(r.total_bytes) || 0,
            connections: Number(r.visit_count) || 0,
            lastAccess,
            last_access: lastAccess,
            guestName: ipToGuest.get(r.src_ip) ?? '',
          };
        });

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

    // ── Fallback: deterministic demo data ───────────────────────
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
