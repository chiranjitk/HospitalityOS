import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import { applyToNftablesWithResult } from '@/lib/nftables-helper';

// GET /api/wifi/firewall/apply-status — Check nftables-service health
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const result = await applyToNftablesWithResult('/api/status', 'GET');

    if (result.success && result.data) {
      const data = result.data as Record<string, unknown>;
      return NextResponse.json({
        success: true,
        data: {
          serviceAvailable: true,
          mode: (data.mode as string) || 'production',
          appliedAt: (data.appliedAt as string) || null,
          pendingChanges: (data.pendingChanges as number) || 0,
        },
      });
    }

    // Service unreachable
    return NextResponse.json({
      success: true,
      data: {
        serviceAvailable: false,
        mode: 'offline' as const,
        appliedAt: null,
        pendingChanges: 0,
      },
    });
  } catch (error) {
    console.error('[firewall/apply-status] GET error:', error);
    return NextResponse.json({
      success: true,
      data: {
        serviceAvailable: false,
        mode: 'offline' as const,
        appliedAt: null,
        pendingChanges: 0,
      },
    });
  }
}
