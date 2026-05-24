import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/integrations/terminals/terminals — list payment terminals
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['integrations.view', 'integrations.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const provider = searchParams.get('provider');

    const where: Record<string, unknown> = { tenantId: user.tenantId, isActive: true };
    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;
    if (provider) where.provider = provider;

    const terminals = await db.paymentTerminal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: terminals });
  } catch (error) {
    console.error('Error listing payment terminals:', error);
    return NextResponse.json({ success: false, error: 'Failed to list terminals' }, { status: 500 });
  }
}

// POST /api/integrations/terminals/terminals — create a payment terminal
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['integrations.manage'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { propertyId, name, provider, model, serialNumber, location, ipAddress, status, p2peEnabled } = body;

    if (!propertyId || !name) {
      return NextResponse.json({ success: false, error: 'propertyId and name are required' }, { status: 400 });
    }

    // Validate status if provided
    const validStatuses = ['online', 'offline', 'maintenance', 'disconnected'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    // Validate provider if provided
    const validProviders = ['verifone', 'ingenico', 'pax', 'stripe', 'square', 'custom'];
    if (provider && !validProviders.includes(provider)) {
      return NextResponse.json({ success: false, error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` }, { status: 400 });
    }

    // Verify property belongs to tenant
    const property = await db.property.findFirst({ where: { id: propertyId, tenantId: user.tenantId } });
    if (!property) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 });
    }

    const terminal = await db.paymentTerminal.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        provider: provider ?? 'verifone',
        model: model ?? null,
        serialNumber: serialNumber ?? null,
        location: location ?? null,
        ipAddress: ipAddress ?? null,
        status: status ?? 'online',
        p2peEnabled: p2peEnabled ?? true,
      },
    });

    return NextResponse.json({ success: true, data: terminal }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment terminal:', error);
    return NextResponse.json({ success: false, error: 'Failed to create terminal' }, { status: 500 });
  }
}
