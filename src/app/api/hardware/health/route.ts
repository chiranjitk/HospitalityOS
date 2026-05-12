import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { hardwareRegistry } from '@/lib/hardware';
import type { AdapterHealth } from '@/lib/hardware/types';

// ---------------------------------------------------------------------------
// GET — Health status of all hardware adapters
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    if (
      !hasAnyPermission(user, ['integrations.view', 'hardware.view', 'settings.view'])
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Check health of every cached adapter
    const healthMap = await hardwareRegistry.checkAllHealth();

    // Convert Map to array for JSON serialisation
    const adapters: AdapterHealth[] = Array.from(healthMap.values());

    return NextResponse.json({
      success: true,
      data: {
        adapters,
        total: adapters.length,
        healthy: adapters.filter((a) => a.status === 'healthy').length,
        unhealthy: adapters.filter((a) => a.status === 'unhealthy').length,
      },
    });
  } catch (error) {
    console.error('[HAL:API] Error checking hardware health:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check hardware health' },
      { status: 500 },
    );
  }
}
