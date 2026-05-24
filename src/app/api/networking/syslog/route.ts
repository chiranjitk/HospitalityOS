import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { resolvePropertyId } from '@/lib/networking/property-resolver';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // GAP-FIX(17b): Added missing permission check
    if (!hasPermission(user, 'networking.view') && !hasPermission(user, 'networking.*')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;

    const servers = await db.syslogServer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(servers);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch syslog servers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(user, 'networking.manage') && !hasPermission(user, 'networking.*')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    // GAP-FIX(17b): Added missing permission check
    if (!hasPermission(user, 'networking.view') && !hasPermission(user, 'networking.*')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const resolvedPropertyId = await resolvePropertyId(user.tenantId, body.propertyId);
    if (!resolvedPropertyId) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'No property found. Please create a property first.' } }, { status: 400 });
    }
    const item = await db.syslogServer.create({
      data: {
        name: body.name,
        protocol: body.protocol || 'udp',
        host: body.host,
        port: body.port || 514,
        format: body.format || 'ietf',
        facility: body.facility || 'local1',
        severity: body.severity || 'info',
        categories: body.categories || '[]',
        enabled: body.enabled ?? false,
        tlsCertPath: body.tlsCertPath,
        tlsVerify: body.tlsVerify ?? true,
        tenantId: user.tenantId,
        propertyId: resolvedPropertyId,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create syslog server' }, { status: 500 });
  }
}
