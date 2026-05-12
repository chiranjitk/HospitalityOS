import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import { applyToNftables } from '@/lib/nftables-helper';

// POST /api/wifi/firewall/flush — Flush all GUI chains via nftables-service
// Fire-and-forget call to nftables-service flush endpoint
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    // Fire-and-forget flush call
    applyToNftables('/api/flush', 'POST');

    return NextResponse.json({
      success: true,
      data: { flushed: true, message: 'Flush command sent to nftables service' },
    });
  } catch (error) {
    console.error('[firewall/flush] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to flush firewall rules' },
      { status: 500 },
    );
  }
}
