import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

// GET /api/channels/gds/connections — list GDS connections
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['channels.view', 'channels.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const provider = searchParams.get('provider');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) where.status = status;
    if (provider) where.provider = provider;

    const connections = await db.gdsConnection.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: connections });
  } catch (error) {
    console.error('Error listing GDS connections:', error);
    return NextResponse.json({ success: false, error: 'Failed to list GDS connections' }, { status: 500 });
  }
}

// POST /api/channels/gds/connections — create a GDS connection
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['channels.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { propertyId, provider, hotelCode, chainCode, pcc, endpointUrl, apiKey, apiSecret, username, password, autoSync, syncInterval } = body;

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    // Validate provider
    const validProviders = ['amadeus', 'sabre', 'travelport'];
    if (provider && !validProviders.includes(provider)) {
      return NextResponse.json({ success: false, error: `Provider must be one of: ${validProviders.join(', ')}` }, { status: 400 });
    }

    // Encrypt sensitive credentials before storing
    const connection = await db.gdsConnection.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        provider: provider ?? 'amadeus',
        pcc: pcc ?? null,
        hotelCode: hotelCode ?? null,
        chainCode: chainCode ?? null,
        endpointUrl: endpointUrl ?? null,
        apiKey: apiKey ? encrypt(apiKey) : null,
        apiSecret: apiSecret ? encrypt(apiSecret) : null,
        username: username ?? null,
        password: password ? encrypt(password) : null,
        autoSync: autoSync ?? true,
        syncInterval: syncInterval ?? 300,
        status: 'pending',
      },
    });

    return NextResponse.json({ success: true, data: connection }, { status: 201 });
  } catch (error) {
    console.error('Error creating GDS connection:', error);
    return NextResponse.json({ success: false, error: 'Failed to create GDS connection' }, { status: 500 });
  }
}
