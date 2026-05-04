import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import { invalidatePoolCache, initializeAllPoolClasses } from '@/lib/network/script-runner';

// POST /api/wifi/firewall/bandwidth-pools/init - Reinitialize all pool TC classes
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    invalidatePoolCache();
    const result = await initializeAllPoolClasses();

    return NextResponse.json({
      success: true,
      data: {
        created: result.created,
        failed: result.failed,
        details: result.details,
      },
    });
  } catch (error) {
    console.error('Error reinitializing bandwidth pool TC classes:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reinitialize bandwidth pool TC classes' } },
      { status: 500 }
    );
  }
}
