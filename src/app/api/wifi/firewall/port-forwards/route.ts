import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';
import { isValidIp } from '@/lib/ip-whitelist/utils';

// GET /api/wifi/firewall/port-forwards — List PortForwardRule for property
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const explicitPropertyId = searchParams.get('propertyId');
    const propertyId = await resolvePropertyId(user, explicitPropertyId);

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'No property found for this tenant' },
        { status: 400 },
      );
    }

    const rules = await db.portForwardRule.findMany({
      where: { tenantId: user.tenantId, propertyId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    console.error('[port-forwards] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch port forward rules' },
      { status: 500 },
    );
  }
}

// POST /api/wifi/firewall/port-forwards — Create PortForwardRule
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId: explicitPropertyId,
      name,
      protocol = 'tcp',
      sourceIp,
      externalPort,
      internalIp,
      internalPort,
      interfaceId,
      enabled = true,
      description,
    } = body;

    const propertyId = await resolvePropertyId(user, explicitPropertyId);
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'No property found for this tenant' },
        { status: 400 },
      );
    }

    if (!name || externalPort == null || !internalIp || internalPort == null) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, externalPort, internalIp, internalPort' },
        { status: 400 },
      );
    }

    // Validate ports
    const extPort = parseInt(externalPort, 10);
    const intPort = parseInt(internalPort, 10);
    if (isNaN(extPort) || extPort < 1 || extPort > 65535) {
      return NextResponse.json(
        { success: false, error: 'externalPort must be between 1 and 65535' },
        { status: 400 },
      );
    }
    if (isNaN(intPort) || intPort < 1 || intPort > 65535) {
      return NextResponse.json(
        { success: false, error: 'internalPort must be between 1 and 65535' },
        { status: 400 },
      );
    }

    // Validate internalIp
    if (!isValidIp(internalIp)) {
      return NextResponse.json(
        { success: false, error: 'internalIp must be a valid IPv4 address' },
        { status: 400 },
      );
    }

    // Validate sourceIp if provided
    if (sourceIp && !isValidIp(sourceIp) && !isValidIp(sourceIp + '/32')) {
      return NextResponse.json(
        { success: false, error: 'sourceIp must be a valid IPv4 address' },
        { status: 400 },
      );
    }

    // Check for duplicate externalPort+protocol per property
    const dupPortForward = await db.portForwardRule.findFirst({
      where: { tenantId: user.tenantId, propertyId, externalPort: extPort, protocol },
    });
    if (dupPortForward) {
      return NextResponse.json(
        { success: false, error: `A port forward rule for external port ${extPort}/${protocol} already exists on this property` },
        { status: 409 },
      );
    }

    const rule = await db.portForwardRule.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        protocol,
        sourceIp: sourceIp || null,
        externalPort: extPort,
        internalIp,
        internalPort: intPort,
        interfaceId: interfaceId || null,
        enabled,
        description: description || null,
      },
    });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    console.error('[port-forwards] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create port forward rule' },
      { status: 500 },
    );
  }
}
