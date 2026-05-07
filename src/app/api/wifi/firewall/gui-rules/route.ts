import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';
import { resolveRuleAddresses } from '@/lib/dns-resolver';

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
      sourceMac,
      sourcePort,
      sourcePortType,
      destIp,
      destPort,
      destPortType,
      action = 'accept',
      jumpTarget,
      logPrefix,
      enabled = true,
      comment,
      priority = 0,
      scheduleId,
      proxyTo,
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

    // Validate port types: only 'include' or 'exclude' accepted
    if (sourcePortType && sourcePortType !== 'include' && sourcePortType !== 'exclude') {
      return NextResponse.json(
        { success: false, error: 'Invalid sourcePortType: must be "include" or "exclude"' },
        { status: 400 },
      );
    }
    if (destPortType && destPortType !== 'include' && destPortType !== 'exclude') {
      return NextResponse.json(
        { success: false, error: 'Invalid destPortType: must be "include" or "exclude"' },
        { status: 400 },
      );
    }

    // Validate proxy action: if action === 'proxy', proxyTo must be provided
    if (action === 'proxy' && !proxyTo) {
      return NextResponse.json(
        { success: false, error: 'proxyTo is required when action is "proxy"' },
        { status: 400 },
      );
    }

    // Resolve DNS for sourceIp and destIp
    const resolved = await resolveRuleAddresses({ sourceIp, destIp });

    const rule = await db.firewallRule.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        zoneId,
        chain: chain || null,
        protocol: protocol || null,
        sourceIp: sourceIp || null,
        sourceMac: sourceMac || null,
        sourcePort: sourcePort || null,
        sourcePortType: (sourcePortType === 'include' || sourcePortType === 'exclude') ? sourcePortType : null,
        destIp: destIp || null,
        destPort: destPort || null,
        destPortType: (destPortType === 'include' || destPortType === 'exclude') ? destPortType : null,
        action,
        jumpTarget: jumpTarget || null,
        logPrefix: logPrefix || null,
        proxyTo: proxyTo || null,
        enabled,
        comment: comment || null,
        priority: parseInt(priority, 10) || 0,
        scheduleId: scheduleId || null,
        name: body.name || 'Unnamed Rule',
        sourceIpType: resolved.sourceIpType,
        destIpType: resolved.destIpType,
        sourceIpResolved: resolved.sourceIpResolved.length > 0 ? JSON.stringify(resolved.sourceIpResolved) : null,
        destIpResolved: resolved.destIpResolved.length > 0 ? JSON.stringify(resolved.destIpResolved) : null,
      },
      include: {
        firewallZone: { select: { id: true, name: true } },
        firewallSchedule: { select: { id: true, name: true } },
      },
    });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    return NextResponse.json({ success: true, data: rule, dnsWarnings: resolved.dnsWarnings }, { status: 201 });
  } catch (error) {
    console.error('[gui-rules] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create GUI rule' },
      { status: 500 },
    );
  }
}
