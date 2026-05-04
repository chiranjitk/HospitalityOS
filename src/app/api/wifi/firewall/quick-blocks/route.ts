import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';

// GET /api/wifi/firewall/quick-blocks — List QuickBlocks for property
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

    const blocks = await db.quickBlock.findMany({
      where: { tenantId: user.tenantId, propertyId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: blocks });
  } catch (error) {
    console.error('[quick-blocks] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch quick blocks' },
      { status: 500 },
    );
  }
}

// POST /api/wifi/firewall/quick-blocks — Create QuickBlock
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId: explicitPropertyId,
      type,      // ip, subnet, mac
      value,     // The IP/subnet/MAC value
      reason,
      enabled = true,
      expiresAt,
    } = body;

    const propertyId = await resolvePropertyId(user, explicitPropertyId);
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'No property found for this tenant' },
        { status: 400 },
      );
    }

    if (!type || !value) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, value' },
        { status: 400 },
      );
    }

    const validTypes = ['ip', 'subnet', 'mac'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    // Check for duplicate
    const existing = await db.quickBlock.findFirst({
      where: { tenantId: user.tenantId, propertyId, type, value },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A quick block with this type and value already exists' },
        { status: 409 },
      );
    }

    const block = await db.quickBlock.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        type,
        value,
        reason: reason || null,
        enabled,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    return NextResponse.json({ success: true, data: block }, { status: 201 });
  } catch (error) {
    console.error('[quick-blocks] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create quick block' },
      { status: 500 },
    );
  }
}
