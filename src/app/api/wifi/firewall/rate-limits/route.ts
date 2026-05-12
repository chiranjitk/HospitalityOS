import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';

// GET /api/wifi/firewall/rate-limits — List RateLimitRule for property
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

    const rules = await db.rateLimitRule.findMany({
      where: { tenantId: user.tenantId, propertyId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    console.error('[rate-limits] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rate limit rules' },
      { status: 500 },
    );
  }
}

// POST /api/wifi/firewall/rate-limits — Create RateLimitRule
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId: explicitPropertyId,
      name,
      targetIp,
      targetSet,
      downloadRate = '10mbit',
      uploadRate = '5mbit',
      protocol = 'all',
      enabled = true,
      comment,
    } = body;

    const propertyId = await resolvePropertyId(user, explicitPropertyId);
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'No property found for this tenant' },
        { status: 400 },
      );
    }

    const rule = await db.rateLimitRule.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name: name || null,
        targetIp: targetIp || null,
        targetSet: targetSet || null,
        downloadRate,
        uploadRate,
        protocol,
        enabled,
        comment: comment || null,
      },
    });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    console.error('[rate-limits] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create rate limit rule' },
      { status: 500 },
    );
  }
}
