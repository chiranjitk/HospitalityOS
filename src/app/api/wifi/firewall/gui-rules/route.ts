import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';

// GET /api/wifi/firewall/gui-rules — List all FirewallRules for the property
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

    const rules = await db.firewallRule.findMany({
      where: { tenantId: user.tenantId, propertyId },
      include: {
        firewallZone: { select: { id: true, name: true } },
        firewallSchedule: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    console.error('[gui-rules] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch GUI rules' },
      { status: 500 },
    );
  }
}

// POST /api/wifi/firewall/gui-rules — Create a new FirewallRule
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId: explicitPropertyId,
      zoneId,
      chain = 'prerouting',
      protocol,
      sourceIp,
      sourcePort,
      destIp,
      destPort,
      action = 'accept',
      jumpTarget,
      logPrefix,
      enabled = true,
      comment,
      priority = 0,
      scheduleId,
    } = body;

    const propertyId = await resolvePropertyId(user, explicitPropertyId);
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'No property found for this tenant' },
        { status: 400 },
      );
    }

    if (!zoneId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: zoneId' },
        { status: 400 },
      );
    }

    // Validate zone belongs to tenant
    const zone = await db.firewallZone.findFirst({
      where: { id: zoneId, tenantId: user.tenantId, propertyId },
    });
    if (!zone) {
      return NextResponse.json(
        { success: false, error: 'Firewall zone not found' },
        { status: 404 },
      );
    }

    // Validate schedule if provided
    if (scheduleId) {
      const schedule = await db.firewallSchedule.findFirst({
        where: { id: scheduleId, tenantId: user.tenantId, propertyId },
      });
      if (!schedule) {
        return NextResponse.json(
          { success: false, error: 'Firewall schedule not found' },
          { status: 404 },
        );
      }
    }

    const rule = await db.firewallRule.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        zoneId,
        chain,
        protocol: protocol || null,
        sourceIp: sourceIp || null,
        sourcePort: sourcePort !== undefined ? parseInt(sourcePort, 10) : null,
        destIp: destIp || null,
        destPort: destPort !== undefined ? parseInt(destPort, 10) : null,
        action,
        jumpTarget: jumpTarget || null,
        logPrefix: logPrefix || null,
        enabled,
        comment: comment || null,
        priority: parseInt(priority, 10) || 0,
        scheduleId: scheduleId || null,
      },
      include: {
        firewallZone: { select: { id: true, name: true } },
        firewallSchedule: { select: { id: true, name: true } },
      },
    });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    console.error('[gui-rules] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create GUI rule' },
      { status: 500 },
    );
  }
}
