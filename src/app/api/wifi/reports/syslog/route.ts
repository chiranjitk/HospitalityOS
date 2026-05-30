import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// Notify conntrack-bridge of config changes (fire-and-forget)
async function notifyConntrackBridge(tenantId: string): Promise<void> {
  try {
    const servers = await db.syslogServer.findMany({
      where: { enabled: true, tenantId },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        protocol: true,
        format: true,
        facility: true,
        severity: true,
        enabled: true,
      },
    });
    const res = await fetch(`${process.env.CONNTRACK_BRIDGE_URL || 'http://127.0.0.1:3020'}/api/syslog-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ servers }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.warn(`[syslog] Failed to notify conntrack-bridge: ${res.status}`);
    }
  } catch (err: unknown) {
    // Non-blocking — conntrack-bridge may not be running
    console.warn(`[syslog] conntrack-bridge notification failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// GET /api/wifi/reports/syslog - List syslog server configurations
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    // Try to get from database
    const dbServers = await db.syslogServer.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    // Format DB data for the frontend
    const servers = dbServers.map((s) => {
      let categories: string[] = [];
      try {
        categories = JSON.parse(s.categories || '[]');
      } catch { /* ignore */ }

      return {
        id: s.id,
        name: s.name,
        host: s.host,
        port: s.port,
        protocol: s.protocol,
        format: s.format === 'ietf' ? 'RFC5424' : s.format === 'bsd' ? 'RFC3164' : s.format.toUpperCase(),
        formatRaw: s.format,
        facility: s.facility,
        severity: s.severity,
        categories,
        status: s.enabled ? 'connected' : 'disconnected',
        enabled: s.enabled,
        tlsVerify: s.tlsVerify,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });

    // Generate sample syslog entries for active servers
    const entries = generateSyslogEntries(servers.filter((s) => s.status === 'connected'));

    return NextResponse.json({
      success: true,
      data: { servers, entries },
    });
  } catch (error) {
    console.error('Error fetching syslog servers:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch syslog servers' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/reports/syslog - Create syslog server configuration
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      name,
      protocol = 'udp',
      host,
      port = 514,
      format = 'ietf',
      facility = 'local1',
      severity = 'info',
      categories = ['nat'],
      enabled = true,
      tlsCertPath,
      tlsVerify = true,
    } = body;

    if (!name || !host) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: name, host' } },
        { status: 400 }
      );
    }

    // Find first property for this tenant if not specified
    let propId = propertyId;
    if (!propId) {
      const firstProperty = await db.property.findFirst({
        where: { tenantId },
      });
      propId = firstProperty?.id;
    }

    if (!propId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No property found for this tenant' } },
        { status: 404 }
      );
    }

    const server = await db.syslogServer.create({
      data: {
        tenantId,
        propertyId: propId,
        name,
        protocol,
        host,
        port: parseInt(String(port), 10) || 514,
        format,
        facility,
        severity,
        categories: typeof categories === 'string' ? categories : JSON.stringify(categories),
        enabled,
        tlsCertPath,
        tlsVerify,
      },
    });

    // Notify conntrack-bridge of config change
    notifyConntrackBridge(tenantId);

    return NextResponse.json({ success: true, data: server }, { status: 201 });
  } catch (error) {
    console.error('Error creating syslog server:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create syslog server' } },
      { status: 500 }
    );
  }
}

// Helper: Generate sample syslog entries (NAT logs from conntrack-bridge)
function generateSyslogEntries(_activeServers: { name: string; host: string; port: number; format: string; facility: string; severity: string }[]): string[] {
  const now = new Date();
  const entries: string[] = [];

  // Realistic NAT log samples from conntrack-bridge
  const samples = [
    { src_ip: '10.0.1.101', src_port: 52341, dst_ip: '142.250.80.46', dst_port: 443, proto: 'tcp', bytes: 45231, packets: 312, event: 'DESTROY' },
    { src_ip: '10.0.1.55', src_port: 49182, dst_ip: '52.216.100.205', dst_port: 443, proto: 'tcp', bytes: 8912, packets: 67, event: 'UPDATE' },
    { src_ip: '10.0.2.33', src_port: 54321, dst_ip: '8.8.8.8', dst_port: 53, proto: 'udp', bytes: 285, packets: 3, event: 'DESTROY' },
    { src_ip: '10.0.1.88', src_port: 51234, dst_ip: '151.101.1.140', dst_port: 443, proto: 'tcp', bytes: 128450, packets: 891, event: 'DESTROY' },
    { src_ip: '10.0.3.12', src_port: 48921, dst_ip: '157.240.1.35', dst_port: 443, proto: 'tcp', bytes: 245678, packets: 1523, event: 'DESTROY' },
  ];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const ts = new Date(now.getTime() - i * 60000);
    const timestamp = ts.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
    const pri = 136 + 6; // local0 + info = 134

    entries.push(
      `<${pri}>1 ${timestamp} staysuite-gw-01 conntrack-bridge - - NAT ${s.proto} ${s.src_ip}:${s.src_port} -> ${s.dst_ip}:${s.dst_port} bytes=${s.bytes} pkts=${s.packets} event=${s.event}`
    );
  }

  return entries;
}
