import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { query, isAvailable } from '@/lib/clickhouse';
import { getNatLogsFromUlogd, resolveGuestNames } from '@/lib/ulogd-reader';
import { correlateIpsToGuests } from '@/lib/ip-user-correlator';

// ─── Static data for demo fallback ──────────────────────────────

const SOURCE_IPS = [
  '10.0.1.101', '10.0.1.102', '10.0.1.103', '10.0.2.104', '10.0.2.105',
  '10.0.3.201', '10.0.3.202', '10.0.4.301', '10.0.4.110', '10.0.2.108',
];

const DEST_IP_MAP: Record<string, string> = {
  '142.250.80.14': 'google.com',
  '157.240.1.35': 'facebook.com',
  '31.13.71.36': 'facebook.com',
  '140.82.121.4': 'github.com',
  '151.101.1.140': 'reddit.com',
  '104.244.42.65': 'twitter.com',
  '23.185.0.2': 'stackoverflow.com',
  '172.217.14.206': 'youtube.com',
  '52.94.236.248': 'amazon.com',
  '13.107.42.14': 'linkedin.com',
  '23.36.2.18': 'netflix.com',
  '35.186.224.45': 'spotify.com',
  '104.16.85.20': 'whatsapp.com',
  '185.60.216.35': 'instagram.com',
  '103.235.46.39': 'flipkart.com',
  '13.234.52.22': 'amazon.in',
  '223.165.85.24': 'hotstar.com',
  '1.1.1.1': 'cloudflare-dns',
  '8.8.8.8': 'google-dns',
  '9.9.9.9': 'quad9-dns',
};

const DEST_IPS = Object.keys(DEST_IP_MAP);

const GUEST_NAME_MAP: Record<string, string> = {
  '10.0.1.101': 'Rahul Sharma',
  '10.0.1.102': 'Priya Patel',
  '10.0.2.104': 'Amit Kumar',
  '10.0.3.201': 'Sneha Reddy',
  '10.0.4.301': 'Vikram Singh',
};

const PROTOCOLS = ['tcp', 'tcp', 'tcp', 'tcp', 'tcp', 'tcp', 'tcp', 'udp', 'udp', 'udp', 'udp', 'udp', 'icmp']; // 70% tcp, 25% udp, 5% icmp

// ─── Helpers ────────────────────────────────────────────────────

function generateDemoData(count: number) {
  const logs = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const protocol = PROTOCOLS[i % PROTOCOLS.length];

    // Event type: NEW 40%, UPDATE 40%, DESTROY 20%
    const eventTypeMod = i % 5;
    let eventType: string;
    if (eventTypeMod < 2) eventType = 'NEW';
    else if (eventTypeMod < 4) eventType = 'UPDATE';
    else eventType = 'DESTROY';

    // Source IP
    const sourceIp = SOURCE_IPS[i % SOURCE_IPS.length];
    const srcPort = 1024 + (i * 317) % 64000;

    // Dest IP
    const destIp = DEST_IPS[i % DEST_IPS.length];

    // Dest port
    const dstPort = protocol === 'icmp' ? 0 : [80, 443, 53, 8080, 8443, 993, 25, 587][i % 8];

    // Bytes: 0 to 5000000 based on i
    const totalBytes = (i * 50000) % 5000001;

    // Split bytes for tcp/udp
    const bytesOrig = protocol === 'icmp' ? 0 : Math.floor(totalBytes * 0.6);
    const bytesReply = protocol === 'icmp' ? 0 : totalBytes - bytesOrig;

    // Packets
    const packets = protocol === 'icmp' ? 1 + (i % 20) : 10 + (i * 47) % 5000;

    // Duration: 0 for NEW, calculated for others
    const duration = eventType === 'NEW' ? 0 : Math.round((1 + (i * 7) % 3000) * 10) / 10;

    // Status
    const status = eventType === 'NEW' ? 'NEW' : eventType === 'DESTROY' ? 'ASSURED' : (i % 3 === 0 ? 'SEEN_REPLY' : 'ASSURED');

    // Timestamp: spread over 7 days, newer entries first
    const timestamp = new Date(now - i * 3600000 * 1.68); // ~100 entries over 7 days

    // Domain from map (simulates SNI enrichment)
    const domain = DEST_IP_MAP[destIp] ?? '';

    // Guest name
    const guestName = GUEST_NAME_MAP[sourceIp] ?? '';

    // Action: all allow for demo
    const action = 'allow';

    logs.push({
      id: `nl-${i + 1}`,
      timestamp: timestamp.toISOString(),
      source_ip: sourceIp,
      src_port: srcPort,
      dest_ip: destIp,
      dst_port: dstPort,
      proto: protocol,
      event_type: eventType,
      bytes: totalBytes,
      bytes_orig: bytesOrig,
      bytes_reply: bytesReply,
      packets,
      duration,
      status,
      domain,
      guestName,
      action,
    });
  }

  return logs;
}

function applyFilters(
  data: Record<string, unknown>[],
  sourceIp: string | null,
  protocol: string | null,
  startDate: string | null,
  action: string | null,
): Record<string, unknown>[] {
  let filtered = data;

  if (sourceIp) {
    filtered = filtered.filter((row) => {
      const sip = String(row.source_ip ?? row.sourceIp ?? '');
      return sip.includes(sourceIp);
    });
  }

  if (protocol) {
    filtered = filtered.filter((row) => {
      const p = String(row.proto ?? row.protocol ?? '');
      return p === protocol || (protocol === 'icmp' && p === 'icmp');
    });
  }

  if (startDate) {
    const start = new Date(startDate).getTime();
    filtered = filtered.filter((row) => {
      const ts = String(row.timestamp ?? '');
      return new Date(ts).getTime() >= start;
    });
  }

  if (action) {
    filtered = filtered.filter((row) => {
      const a = String(row.action ?? '');
      return a === action;
    });
  }

  return filtered;
}

function computeSummary(data: Record<string, unknown>[]) {
  let totalBytes = 0;
  const sourceSet = new Set<string>();
  const protoCount: Record<string, number> = {};

  for (const row of data) {
    totalBytes += Number(row.bytes ?? 0);
    const sip = String(row.source_ip ?? row.sourceIp ?? '');
    if (sip) sourceSet.add(sip);
    const p = String(row.proto ?? row.protocol ?? '');
    if (p) protoCount[p] = (protoCount[p] ?? 0) + 1;
  }

  let topProtocol = 'tcp';
  let topCount = 0;
  for (const [proto, count] of Object.entries(protoCount)) {
    if (count > topCount) {
      topCount = count;
      topProtocol = proto;
    }
  }

  return {
    totalConnections: data.length,
    totalBytes,
    uniqueSources: sourceSet.size,
    topProtocol,
  };
}

// ─── GET handler ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'reports.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const sourceIp = searchParams.get('sourceIp');
    const protocol = searchParams.get('protocol');
    const startDate = searchParams.get('startDate');
    const action = searchParams.get('action');

    // ── Try ClickHouse ──────────────────────────────────────────
    const chReady = await isAvailable();
    let enriched: Record<string, unknown>[] | null = null;

    if (chReady) {
      // Build WHERE clauses
      const wheres: string[] = ['timestamp >= now() - INTERVAL 7 DAY'];
      if (sourceIp) wheres.push(`src_ip LIKE '%${sourceIp.replace(/'/g, "\\'")}%'`);
      if (protocol) wheres.push(`proto = '${protocol}'`);
      if (startDate) wheres.push(`timestamp >= parseDateTimeBestEffort('${startDate.replace(/'/g, "\\'")}')`);

      const whereClause = wheres.join(' AND ');

      const natRows = await query<Record<string, unknown>>(
        `SELECT timestamp, proto, event_type, src_ip, src_port, dst_ip, dst_port, bytes, packets, duration, status ` +
        `FROM ipdr.nat_log ` +
        `WHERE ${whereClause} AND bytes > 0 ` +
        `ORDER BY timestamp DESC LIMIT 1000`,
      );

      if (natRows.length > 0) {
        // ── SNI log enrichment (TRUSTED source) ────────────────
        // NFLOG captures TLS SNI from port 443 SYN packets.
        // Unlike DNS logs, SNI is reliable — users cannot bypass it
        // because every HTTPS connection sends SNI in plaintext.
        const domainMap = new Map<string, string>();

        // Collect unique dst_ips for SNI lookup
        const uniqueDstIps = [...new Set(natRows.map((r) => String(r.dst_ip ?? '')).filter(Boolean))];

        if (uniqueDstIps.length > 0) {
          // Build IN clause for batch query — one query instead of N+1
          const ipList = uniqueDstIps.map((ip) => `'${ip.replace(/'/g, "\\'")}'`).join(',');

          const sniRows = await query<Record<string, unknown>>(
            `SELECT dst_ip, sni_domain, max(timestamp) as last_seen ` +
            `FROM ipdr.sni_log ` +
            `WHERE dst_ip IN (${ipList}) ` +
            `  AND timestamp >= now() - INTERVAL 7 DAY ` +
            `GROUP BY dst_ip, sni_domain ` +
            `ORDER BY last_seen DESC ` +
            `LIMIT 5000`,
          );

          // Map each dst_ip to its most recently seen SNI domain
          const bestDomain = new Map<string, string>();
          for (const row of sniRows) {
            const dip = String(row.dst_ip ?? '');
            const domain = String(row.sni_domain ?? '');
            if (dip && domain && !bestDomain.has(dip)) {
              bestDomain.set(dip, domain);
            }
          }
          // Transfer to domainMap
          for (const [ip, domain] of bestDomain) {
            domainMap.set(ip, domain);
          }
        }

        // ── Guest name resolution via shared correlator (time-window aware) ──
        // Pass IP+timestamp pairs so the correlator finds the RIGHT guest
        // for the RIGHT time window (handles DHCP IP reuse correctly)
        const ipTimestampPairs = natRows.map((r) => {
          const rawTs = String(r.timestamp ?? '');
          const ts = rawTs.includes('T') ? rawTs : rawTs.replace(' ', 'T');
          return {
            ip: String(r.src_ip ?? ''),
            timestamp: new Date(ts),
          };
        });
        const correlation = await correlateIpsToGuests(ipTimestampPairs, user.tenantId);
        const guestMap = correlation.ipToGuest;

        // ── Build enriched response ───────────────────────────
        enriched = natRows.map((row, idx) => {
          const rawTs = String(row.timestamp ?? '');
          // ClickHouse DateTime: 'YYYY-MM-DD HH:MM:SS' → ISO 8601 for JavaScript Date
          const ts = rawTs.includes('T') ? rawTs : rawTs.replace(' ', 'T');
          return {
          id: `nl-${idx + 1}`,
          timestamp: ts,
          source_ip: String(row.src_ip ?? ''),
          src_port: Number(row.src_port ?? 0),
          dest_ip: String(row.dst_ip ?? ''),
          dst_port: Number(row.dst_port ?? 0),
          proto: String(row.proto ?? ''),
          event_type: String(row.event_type ?? ''),
          bytes: Number(row.bytes ?? 0),
          bytes_orig: Math.floor(Number(row.bytes ?? 0) * 0.6),
          bytes_reply: Math.floor(Number(row.bytes ?? 0) * 0.4),
          packets: Number(row.packets ?? 0),
          duration: Number(row.duration ?? 0),
          status: String(row.status ?? ''),
          // Domain from SNI log (trusted source — captured from TLS handshake)
          domain: domainMap.get(String(row.dst_ip ?? '')) ?? '',
          guestName: guestMap.get(String(row.src_ip ?? '')) ?? '',
          action: 'allow',
        };
        });

        // Apply action filter if needed
        if (action) {
          enriched = enriched.filter((row) => String(row.action) === action);
        }
      }
    }

    // ── Fallback 2: ulogd2 JSON files (NFLOG SNI + NFCT flow) ──
    // Data source: /var/log/ulogd2/sni.json + /var/log/ulogd2/flow.json
    // This is the live data path when ClickHouse is not set up.
    {
      const ulogdData = await getNatLogsFromUlogd({
        sourceIp: sourceIp ?? undefined,
        protocol: protocol ?? undefined,
        maxRecords: 500,
      });

      if (ulogdData.length > 0) {
        // Resolve guest names with time-window matching
        const ipTimestampPairs = ulogdData.map((d) => ({
          ip: d.source_ip,
          timestamp: new Date(d.timestamp || Date.now()),
        }));
        const guestMap = await resolveGuestNames(ipTimestampPairs, user.tenantId);

        // Attach guest names
        for (const entry of ulogdData) {
          entry.guestName = guestMap.get(entry.source_ip) ?? '';
        }

        // Apply action filter if needed
        const filtered = action
          ? ulogdData.filter((row) => row.action === action)
          : ulogdData;

        const summary = computeSummary(filtered);

        return NextResponse.json({
          success: true,
          data: filtered,
          summary,
          dataSource: 'ulogd2',
        });
      }
    }

    // ── Fallback 3: deterministic demo data ──────────────────────
    if (!enriched || enriched.length === 0) {
      const demoData = generateDemoData(100);

      // Apply all filters to demo data
      const filtered = applyFilters(demoData, sourceIp, protocol, startDate, action);
      const summary = computeSummary(filtered);

      return NextResponse.json({
        success: true,
        data: filtered,
        summary,
        dataSource: 'demo',
      });
    }

    // ── ClickHouse success response ─────────────────────────────
    const summary = computeSummary(enriched);

    return NextResponse.json({
      success: true,
      data: enriched,
      summary,
      dataSource: 'clickhouse',
    });
  } catch (error) {
    console.error('[nat-logs] Error fetching NAT logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch NAT logs',
        },
      },
      { status: 500 },
    );
  }
}
