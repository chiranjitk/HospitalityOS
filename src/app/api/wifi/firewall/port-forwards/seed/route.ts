import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';

// ─── 50 diverse Port Forward rule templates ──────────────────────────

interface SeedTemplate {
  name: string;
  protocol: string;
  externalPort: number;
  internalIp: string;
  internalPort: number;
  sourceIp: string | null;
  enabled: boolean;
  description: string;
}

function generate50SeedRules(): SeedTemplate[] {
  return [
    // ── TCP Web Services (1-8) ──
    { name: 'HTTP Web Server', protocol: 'tcp', externalPort: 80, internalIp: '10.0.1.10', internalPort: 80, sourceIp: null, enabled: true, description: 'Front desk web portal' },
    { name: 'HTTPS Secure Web', protocol: 'tcp', externalPort: 443, internalIp: '10.0.1.10', internalPort: 443, sourceIp: null, enabled: true, description: 'SSL web portal' },
    { name: 'PMS Opera Web', protocol: 'tcp', externalPort: 8080, internalIp: '10.0.1.20', internalPort: 80, sourceIp: '203.0.113.0/24', enabled: true, description: 'Opera PMS web interface' },
    { name: 'PMS API Gateway', protocol: 'tcp', externalPort: 8443, internalIp: '10.0.1.20', internalPort: 443, sourceIp: '203.0.113.0/24', enabled: true, description: 'PMS API HTTPS endpoint' },
    { name: 'Guest Portal HTTP', protocol: 'tcp', externalPort: 8090, internalIp: '10.0.1.30', internalPort: 80, sourceIp: null, enabled: true, description: 'Captive portal web UI' },
    { name: 'Booking Engine', protocol: 'tcp', externalPort: 9090, internalIp: '10.0.1.40', internalPort: 3000, sourceIp: null, enabled: true, description: 'Online booking engine' },
    { name: 'Admin Panel', protocol: 'tcp', externalPort: 9443, internalIp: '10.0.1.10', internalPort: 8080, sourceIp: '10.0.0.0/8', enabled: true, description: 'Staff admin dashboard' },
    { name: 'Rate Shopping API', protocol: 'tcp', externalPort: 7070, internalIp: '10.0.1.45', internalPort: 5000, sourceIp: '198.51.100.50/32', enabled: true, description: 'Competitor rate API' },

    // ── TCP Remote Access (9-16) ──
    { name: 'RDP Front Desk', protocol: 'tcp', externalPort: 3389, internalIp: '10.0.2.10', internalPort: 3389, sourceIp: '203.0.113.100/32', enabled: true, description: 'Windows RDP for front desk' },
    { name: 'RDP Back Office', protocol: 'tcp', externalPort: 3390, internalIp: '10.0.2.11', internalPort: 3389, sourceIp: '203.0.113.101/32', enabled: true, description: 'Windows RDP accounts team' },
    { name: 'SSH Gateway', protocol: 'tcp', externalPort: 22, internalIp: '10.0.2.20', internalPort: 22, sourceIp: '203.0.113.0/24', enabled: true, description: 'Linux SSH bastion host' },
    { name: 'SSH Network Equip', protocol: 'tcp', externalPort: 2222, internalIp: '10.0.2.21', internalPort: 22, sourceIp: '10.0.0.0/8', enabled: true, description: 'Network switch management' },
    { name: 'VNC Server Room', protocol: 'tcp', externalPort: 5900, internalIp: '10.0.2.30', internalPort: 5900, sourceIp: '10.0.0.0/8', enabled: true, description: 'VNC access to server' },
    { name: 'TeamViewer Alt', protocol: 'tcp', externalPort: 5938, internalIp: '10.0.2.31', internalPort: 5938, sourceIp: null, enabled: false, description: 'TeamViewer relay port' },
    { name: 'AnyDesk Remote', protocol: 'tcp', externalPort: 7071, internalIp: '10.0.2.32', internalPort: 7070, sourceIp: null, enabled: false, description: 'AnyDesk remote access' },
    { name: 'Telnet Legacy', protocol: 'tcp', externalPort: 2323, internalIp: '10.0.2.40', internalPort: 23, sourceIp: '10.0.0.0/8', enabled: false, description: 'Legacy telnet HVAC system' },

    // ── TCP Database (17-22) ──
    { name: 'MySQL PMS DB', protocol: 'tcp', externalPort: 3306, internalIp: '10.0.3.10', internalPort: 3306, sourceIp: '10.0.0.0/8', enabled: true, description: 'MySQL for PMS integration' },
    { name: 'PostgreSQL BI', protocol: 'tcp', externalPort: 5432, internalIp: '10.0.3.11', internalPort: 5432, sourceIp: '10.0.0.0/8', enabled: true, description: 'PostgreSQL for analytics' },
    { name: 'MSSQL CRM', protocol: 'tcp', externalPort: 1433, internalIp: '10.0.3.12', internalPort: 1433, sourceIp: '203.0.113.200/32', enabled: true, description: 'MSSQL CRM database' },
    { name: 'MongoDB Logs', protocol: 'tcp', externalPort: 27017, internalIp: '10.0.3.13', internalPort: 27017, sourceIp: '10.0.0.0/8', enabled: false, description: 'MongoDB log aggregation' },
    { name: 'Redis Cache', protocol: 'tcp', externalPort: 6379, internalIp: '10.0.3.14', internalPort: 6379, sourceIp: '10.0.0.0/8', enabled: false, description: 'Redis session cache' },
    { name: 'Elasticsearch', protocol: 'tcp', externalPort: 9200, internalIp: '10.0.3.15', internalPort: 9200, sourceIp: '10.0.0.0/8', enabled: false, description: 'ES search cluster' },

    // ── TCP Email / Comms (23-28) ──
    { name: 'SMTP Mail Relay', protocol: 'tcp', externalPort: 25, internalIp: '10.0.4.10', internalPort: 25, sourceIp: null, enabled: true, description: 'Outbound email relay' },
    { name: 'SMTP Submission', protocol: 'tcp', externalPort: 587, internalIp: '10.0.4.10', internalPort: 587, sourceIp: null, enabled: true, description: 'Email submission port' },
    { name: 'IMAP Email', protocol: 'tcp', externalPort: 993, internalIp: '10.0.4.11', internalPort: 993, sourceIp: null, enabled: true, description: 'IMAPS email access' },
    { name: 'POP3 Legacy', protocol: 'tcp', externalPort: 995, internalIp: '10.0.4.11', internalPort: 995, sourceIp: null, enabled: false, description: 'Legacy POP3S email' },
    { name: 'SIP VoIP PBX', protocol: 'tcp', externalPort: 5060, internalIp: '10.0.4.20', internalPort: 5060, sourceIp: null, enabled: true, description: 'PBX SIP signaling' },
    { name: 'SIP TLS Secure', protocol: 'tcp', externalPort: 5061, internalIp: '10.0.4.20', internalPort: 5061, sourceIp: null, enabled: true, description: 'PBX SIP over TLS' },

    // ── TCP File / Print (29-33) ──
    { name: 'FTP File Server', protocol: 'tcp', externalPort: 21, internalIp: '10.0.5.10', internalPort: 21, sourceIp: '203.0.113.0/24', enabled: true, description: 'FTP for OTA channel mgr' },
    { name: 'SFTP Secure Files', protocol: 'tcp', externalPort: 2223, internalIp: '10.0.5.11', internalPort: 22, sourceIp: '198.51.100.0/24', enabled: true, description: 'SFTP for partner files' },
    { name: 'CUPS Print Server', protocol: 'tcp', externalPort: 631, internalIp: '10.0.5.20', internalPort: 631, sourceIp: '10.0.0.0/8', enabled: false, description: 'Network print service' },
    { name: 'SMB File Share', protocol: 'tcp', externalPort: 445, internalIp: '10.0.5.21', internalPort: 445, sourceIp: '10.0.0.0/8', enabled: false, description: 'SMB file sharing' },
    { name: 'NFS Storage', protocol: 'tcp', externalPort: 2049, internalIp: '10.0.5.22', internalPort: 2049, sourceIp: '10.0.0.0/8', enabled: false, description: 'NFS shared storage' },

    // ── TCP Monitoring / IoT (34-38) ──
    { name: 'Zabbix Monitor', protocol: 'tcp', externalPort: 10050, internalIp: '10.0.6.10', internalPort: 10050, sourceIp: '10.0.0.0/8', enabled: true, description: 'Zabbix agent monitoring' },
    { name: 'Prometheus Metrics', protocol: 'tcp', externalPort: 9091, internalIp: '10.0.6.11', internalPort: 9090, sourceIp: '10.0.0.0/8', enabled: true, description: 'Prometheus scraping' },
    { name: 'Grafana Dashboards', protocol: 'tcp', externalPort: 3000, internalIp: '10.0.6.12', internalPort: 3000, sourceIp: '10.0.0.0/8', enabled: true, description: 'Grafana dashboard UI' },
    { name: 'BMS Building Mgmt', protocol: 'tcp', externalPort: 502, internalIp: '10.0.6.20', internalPort: 502, sourceIp: '10.0.0.0/8', enabled: true, description: 'Modbus building management' },
    { name: 'KNX IoT Gateway', protocol: 'tcp', externalPort: 3671, internalIp: '10.0.6.21', internalPort: 3671, sourceIp: '10.0.0.0/8', enabled: false, description: 'KNX smart room gateway' },

    // ── UDP DNS / VPN (39-43) ──
    { name: 'DNS Resolver', protocol: 'udp', externalPort: 53, internalIp: '10.0.7.10', internalPort: 53, sourceIp: null, enabled: true, description: 'Local DNS resolver' },
    { name: 'DNS over TLS', protocol: 'udp', externalPort: 853, internalIp: '10.0.7.10', internalPort: 853, sourceIp: null, enabled: false, description: 'DoT encrypted DNS' },
    { name: 'WireGuard VPN', protocol: 'udp', externalPort: 51820, internalIp: '10.0.7.20', internalPort: 51820, sourceIp: null, enabled: true, description: 'WireGuard VPN tunnel' },
    { name: 'IPSec VPN', protocol: 'udp', externalPort: 500, internalIp: '10.0.7.21', internalPort: 500, sourceIp: '203.0.113.0/24', enabled: true, description: 'IPSec IKE key exchange' },
    { name: 'IPSec NAT-T', protocol: 'udp', externalPort: 4500, internalIp: '10.0.7.21', internalPort: 4500, sourceIp: '203.0.113.0/24', enabled: true, description: 'IPSec NAT traversal' },

    // ── UDP Media / Streaming (44-46) ──
    { name: 'NTP Time Server', protocol: 'udp', externalPort: 123, internalIp: '10.0.8.10', internalPort: 123, sourceIp: null, enabled: true, description: 'Network time sync' },
    { name: 'SNMP Network Mgmt', protocol: 'udp', externalPort: 161, internalIp: '10.0.8.11', internalPort: 161, sourceIp: '10.0.0.0/8', enabled: true, description: 'SNMP v3 monitoring' },
    { name: 'SNMP Trap Receiver', protocol: 'udp', externalPort: 162, internalIp: '10.0.8.12', internalPort: 162, sourceIp: '10.0.0.0/8', enabled: false, description: 'SNMP trap alerts' },

    // ── Both Protocol (47-50) ──
    { name: 'CCTV Camera Hub', protocol: 'both', externalPort: 554, internalIp: '10.0.9.10', internalPort: 554, sourceIp: '203.0.113.0/24', enabled: true, description: 'RTSP CCTV stream' },
    { name: 'PMS Channel Mgr', protocol: 'both', externalPort: 8190, internalIp: '10.0.1.25', internalPort: 8190, sourceIp: '198.51.100.0/24', enabled: true, description: 'Channel manager sync' },
    { name: 'Door Lock System', protocol: 'both', externalPort: 4010, internalIp: '10.0.9.20', internalPort: 4010, sourceIp: '10.0.0.0/8', enabled: true, description: 'ASSA ABLOY door locks' },
    { name: 'RADIUS Auth', protocol: 'both', externalPort: 1812, internalIp: '10.0.7.30', internalPort: 1812, sourceIp: '10.0.0.0/8', enabled: true, description: 'RADIUS authentication' },
  ];
}

// POST /api/wifi/firewall/port-forwards/seed — Bulk create 50 port forward rules
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { clearExisting = false } = body as { clearExisting?: boolean };

    const explicitPropertyId = (body as any).propertyId;
    const propertyId = await resolvePropertyId(user, explicitPropertyId);
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'No property found for this tenant' },
        { status: 400 },
      );
    }

    // Optionally clear existing rules
    if (clearExisting) {
      await db.portForwardRule.deleteMany({
        where: { tenantId: user.tenantId, propertyId },
      });
    }

    // Generate 50 rules
    const templates = generate50SeedRules();

    const created = await db.portForwardRule.createMany({
      data: templates.map((t) => ({
        tenantId: user.tenantId,
        propertyId,
        name: t.name,
        protocol: t.protocol,
        externalPort: t.externalPort,
        internalIp: t.internalIp,
        internalPort: t.internalPort,
        sourceIp: t.sourceIp,
        enabled: t.enabled,
        description: t.description,
      })),
      skipDuplicates: true,
    });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    const allRules = await db.portForwardRule.findMany({
      where: { tenantId: user.tenantId, propertyId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        created: created.count,
        total: allRules.length,
        rules: allRules,
      },
    });
  } catch (error) {
    console.error('[port-forwards/seed] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to seed port forward rules' },
      { status: 500 },
    );
  }
}

// GET /api/wifi/firewall/port-forwards/seed — Preview what would be seeded (dry-run)
export async function GET() {
  const templates = generate50SeedRules();
  return NextResponse.json({
    success: true,
    data: {
      count: templates.length,
      categories: {
        tcp: templates.filter(t => t.protocol === 'tcp').length,
        udp: templates.filter(t => t.protocol === 'udp').length,
        both: templates.filter(t => t.protocol === 'both').length,
        enabled: templates.filter(t => t.enabled).length,
        disabled: templates.filter(t => !t.enabled).length,
        withSourceRestriction: templates.filter(t => t.sourceIp).length,
      },
      templates,
    },
  });
}
