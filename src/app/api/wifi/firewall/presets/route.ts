import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import { FIREWALL_PRESETS } from '@/lib/wifi/firewall-presets';

// GET /api/wifi/firewall/presets — Return hardcoded preset rule templates
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

    return NextResponse.json({ success: true, data: FIREWALL_PRESETS });
  } catch (error) {
    console.error('[Firewall Presets] GET error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
