import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// Notify conntrack-bridge of config changes (fire-and-forget)
async function notifyConntrackBridge(): Promise<void> {
  try {
    const servers = await db.syslogServer.findMany({
      where: { enabled: true },
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
    const res = await fetch('http://127.0.0.1:3020/api/syslog-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ servers }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.warn(`[syslog] Failed to notify conntrack-bridge: ${res.status}`);
    }
  } catch (err: any) {
    // Non-blocking — conntrack-bridge may not be running
    console.warn(`[syslog] conntrack-bridge notification failed: ${err.message}`);
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

    if (dbServers.length > 0) {
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

      // Generate sample syslog entries
      const entries = generateSyslogEntries(servers.filter((s) => s.status === 'connected'));

      return NextResponse.json({
        success: true,
        data: { servers, entries },
      });
    }

    // Fallback: Return mock syslog servers
    const mockServers: {
      id: string;
      name: string;
      host: string;
      port: number;
      protocol: string;
      format: string;
      formatRaw: string;
      facility: string;
      severity: string;
      categories: string[];
      status: string;
      enabled: boolean;
      tlsVerify: boolean;
      createdAt: string;
      updatedAt: string;
    }[] = [
      {
        id: 'syslog-1',
        name: 'SIEM Collector',
        host: '10.10.1.50',
        port: 514,
        protocol: 'udp',
        format: 'RFC5424',
        formatRaw: 'ietf',
        facility: 'local1',
        severity: 'info',
        categories: ['auth', 'firewall', 'radius'],
        status: 'connected',
        enabled: true,
        tlsVerify: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'syslog-2',
        name: 'Log Aggregator',
        host: '10.10.1.51',
        port: 6514,
        protocol: 'tls',
        format: 'RFC5424',
        formatRaw: 'ietf',
        facility: 'local0',
        severity: 'warning',
        categories: ['dhcp', 'dns', 'system'],
        status: 'connected',
        enabled: true,
        tlsVerify: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'syslog-3',
        name: 'Compliance Archive',
        host: '10.10.2.100',
        port: 514,
        protocol: 'tcp',
        format: 'RFC3164',
        formatRaw: 'bsd',
        facility: 'auth',
        severity: 'notice',
        categories: ['auth', 'portal'],
        status: 'disconnected',
        enabled: false,
        tlsVerify: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const entries = generateSyslogEntries(mockServers.filter((s) => s.status === 'connected'));

    return NextResponse.json({
      success: true,
      data: { servers: mockServers, entries },
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
      categories = [],
      enabled = false,
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
    notifyConntrackBridge();

    return NextResponse.json({ success: true, data: server }, { status: 201 });
  } catch (error) {
    console.error('Error creating syslog server:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create syslog server' } },
      { status: 500 }
    );
  }
}

// Helper: Generate sample syslog entries
function generateSyslogEntries(activeServers: { name: string; host: string; port: number; format: string; facility: string; severity: string }[]): string[] {
  const now = new Date();
  const entries: string[] = [];

  const logTemplates = [
    '<{pri}>1 {timestamp} {hostname} conntrack-bridge - - NAT tcp 10.0.1.101:52341 -> 142.250.80.46:443 bytes=45231 pkts=312 event=DESTROY',
    '<{pri}>1 {timestamp} {hostname} conntrack-bridge - - NAT tcp 10.0.1.55:49182 -> 52.216.100.205:443 bytes=8912 pkts=67 event=UPDATE',
    '<{pri}>1 {timestamp} {hostname} conntrack-bridge - - NAT udp 10.0.2.33:54321 -> 8.8.8.8:53 bytes=285 pkts=3 event=DESTROY',
    '<{pri}>1 {timestamp} {hostname} conntrack-bridge - - NAT tcp 10.0.1.88:51234 -> 151.101.1.140:443 bytes=128450 pkts=891 event=DESTROY',
    '<{pri}>1 {timestamp} {hostname} conntrack-bridge - - NAT tcp 10.0.3.12:48921 -> 157.240.1.35:443 bytes=245678 pkts=1523 event=DESTROY',
  ];

  const severityMap: Record<string, number> = {
    emerg: 0, alert: 1, crit: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7,
  };
  const facilityMap: Record<string, number> = {
    local0: 128, local1: 136, auth: 16, daemon: 24, syslog: 40, kern: 0, user: 8,
  };

  for (let i = 0; i < 5; i++) {
    const template = logTemplates[i % logTemplates.length];
    const server = activeServers[i % activeServers.length] || { facility: 'local1', severity: 'info' };
    const facility = facilityMap[server.facility] ?? 136;
    const severity = severityMap[server.severity] ?? 6;
    const pri = facility + severity;
    const ts = new Date(now.getTime() - i * 60000);
    const timestamp = ts.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

    entries.push(
      template
        .replace('{pri}', String(pri))
        .replace('{timestamp}', timestamp)
        .replace('{hostname}', 'staysuite-gw-01')
    );
  }

  return entries;
}
