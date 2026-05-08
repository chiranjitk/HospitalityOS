import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import { applyToNftablesWithResult } from '@/lib/nftables-helper';

// GET /api/wifi/firewall/rule-counters
// Returns per-rule packet/byte hit counters from all 6 GUI chains.
// Counters are only available when nftables is installed (production mode).
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const result = await applyToNftablesWithResult('/api/rule-counters', 'GET');

    if (result.success && result.data) {
      return NextResponse.json(result.data);
    }

    return NextResponse.json(
      { success: false, error: result.error || 'Failed to read rule counters' },
      { status: 500 },
    );
  } catch (error) {
    console.error('[rule-counters] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read rule counters' },
      { status: 500 },
    );
  }
}
