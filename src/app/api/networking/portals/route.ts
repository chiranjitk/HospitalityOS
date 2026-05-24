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

    const items = await db.captivePortal.findMany({
      where,
      include: {
        portalMappings: { orderBy: { priority: 'asc' } },
        authMethods: { orderBy: { priority: 'asc' } },
        portalPages: { orderBy: { language: 'asc' } },
        vlanConfigs: { select: { id: true, vlanId: true, subInterface: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch captive portals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(user, 'networking.manage') && !hasPermission(user, 'networking.*')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const resolvedPropertyId = await resolvePropertyId(user.tenantId, body.propertyId);
    if (!resolvedPropertyId) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'No property found. Please create a property first.' } }, { status: 400 });
    }
    const item = await db.captivePortal.create({
      data: {
        name: body.name,
        description: body.description,
        listenIp: body.listenIp || '0.0.0.0',
        listenPort: body.listenPort || 80,
        useSsl: body.useSsl || false,
        sslCertPath: body.sslCertPath,
        sslKeyPath: body.sslKeyPath,
        enabled: body.enabled ?? true,
        maxConcurrent: body.maxConcurrent || 1000,
        sessionTimeout: body.sessionTimeout || 86400,
        idleTimeout: body.idleTimeout || 3600,
        redirectUrl: body.redirectUrl,
        successMessage: body.successMessage,
        failMessage: body.failMessage,
        tenantId: user.tenantId,
        propertyId: resolvedPropertyId,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create captive portal' }, { status: 500 });
  }
}
