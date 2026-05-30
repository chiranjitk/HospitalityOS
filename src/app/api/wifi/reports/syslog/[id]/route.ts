import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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
    console.warn(`[syslog] conntrack-bridge notification failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// GET /api/wifi/reports/syslog/[id] - Get single syslog server configuration
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const server = await db.syslogServer.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!server) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Syslog server not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: server });
  } catch (error) {
    console.error('Error fetching syslog server:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch syslog server' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/reports/syslog/[id] - Update syslog server configuration
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.syslogServer.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Syslog server not found' } },
        { status: 404 }
      );
    }

    const {
      name, protocol, host, port, format, facility, severity,
      categories, enabled, tlsCertPath, tlsVerify,
    } = body;

    const server = await db.syslogServer.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(protocol !== undefined && { protocol }),
        ...(host !== undefined && { host }),
        ...(port !== undefined && { port: parseInt(String(port), 10) }),
        ...(format !== undefined && { format }),
        ...(facility !== undefined && { facility }),
        ...(severity !== undefined && { severity }),
        ...(categories !== undefined && { categories: typeof categories === 'string' ? categories : JSON.stringify(categories) }),
        ...(enabled !== undefined && { enabled }),
        ...(tlsCertPath !== undefined && { tlsCertPath }),
        ...(tlsVerify !== undefined && { tlsVerify }),
      },
    });

    // Notify conntrack-bridge of config change
    notifyConntrackBridge(user.tenantId);

    // Format the response for the frontend
    let parsedCategories: string[] = [];
    try {
      parsedCategories = JSON.parse(server.categories || '[]');
    } catch { /* ignore */ }

    const formatted = {
      id: server.id,
      name: server.name,
      host: server.host,
      port: server.port,
      protocol: server.protocol,
      format: server.format === 'ietf' ? 'RFC5424' : server.format === 'bsd' ? 'RFC3164' : server.format.toUpperCase(),
      formatRaw: server.format,
      facility: server.facility,
      severity: server.severity,
      categories: parsedCategories,
      status: server.enabled ? 'connected' : 'disconnected',
      enabled: server.enabled,
      tlsVerify: server.tlsVerify,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
    };

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error updating syslog server:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update syslog server' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/reports/syslog/[id] - Delete syslog server configuration
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existing = await db.syslogServer.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Syslog server not found' } },
        { status: 404 }
      );
    }

    await db.syslogServer.delete({ where: { id } });

    // Notify conntrack-bridge of config change
    notifyConntrackBridge(user.tenantId);

    return NextResponse.json({
      success: true,
      message: 'Syslog server configuration deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting syslog server:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete syslog server' } },
      { status: 500 }
    );
  }
}
