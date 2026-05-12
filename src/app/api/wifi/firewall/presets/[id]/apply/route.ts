import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';
import { FIREWALL_PRESETS } from '@/lib/wifi/firewall-presets';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/wifi/firewall/presets/[id]/apply — Apply a preset template
// Creates FirewallRule records from the preset template for the property
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id: presetId } = await params;
    const body = await request.json();
    const explicitPropertyId = body.propertyId;
    const zoneId = body.zoneId;

    const propertyId = await resolvePropertyId(user, explicitPropertyId);
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'No property found for this tenant' },
        { status: 400 },
      );
    }

    // Find the preset
    const preset = FIREWALL_PRESETS.find((p) => p.id === presetId);
    if (!preset) {
      return NextResponse.json(
        { success: false, error: `Preset not found: ${presetId}` },
        { status: 404 },
      );
    }

    // Resolve zone — use provided zoneId or find a default zone for the property
    let resolvedZoneId = zoneId;
    if (!resolvedZoneId) {
      const defaultZone = await db.firewallZone.findFirst({
        where: { tenantId: user.tenantId, propertyId },
      });
      resolvedZoneId = defaultZone?.id || null;
    }

    if (!resolvedZoneId) {
      return NextResponse.json(
        { success: false, error: 'No firewall zone found. Please create a zone first or provide zoneId.' },
        { status: 400 },
      );
    }

    // Create rules from preset
    const createdRules = await db.firewallRule.createMany({
      data: preset.rules.map((rule, index) => ({
        tenantId: user.tenantId,
        propertyId,
        zoneId: resolvedZoneId!,
        chain: rule.chain,
        protocol: rule.protocol || null,
        destIp: rule.destIp || null,
        destPort: rule.destPort || null,
        sourceIp: rule.sourceIp || null,
        action: rule.action,
        comment: `${preset.name}: ${rule.comment}`,
        priority: index,
        enabled: true,
      })),
    });

    // Fire-and-forget apply
    try { fullApplyToNftables(user.tenantId); } catch {}

    return NextResponse.json({
      success: true,
      data: {
        presetId: preset.id,
        presetName: preset.name,
        rulesCreated: createdRules.count,
      },
    });
  } catch (error) {
    console.error('[presets/:id/apply] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to apply preset' },
      { status: 500 },
    );
  }
}
