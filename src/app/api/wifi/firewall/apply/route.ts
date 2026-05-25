import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';
import { applyToNftablesWithResult } from '@/lib/nftables-helper';
import { logWifi } from '@/lib/audit';

// POST /api/wifi/firewall/apply — Explicit "Apply Rules" button handler
// Triggers fullApplyToNftables and returns the result
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const result = await applyToNftablesWithResult('/api/apply', 'POST');

    if (result.success) {
      // Audit log
      try {
        await logWifi(request, 'apply', 'firewall_rule', undefined, { message: 'Firewall rules applied' }, { tenantId: user.tenantId, userId: user.userId });
      } catch (auditErr) {
        console.error('Audit log failed for firewall apply:', auditErr);
      }

      return NextResponse.json({
        success: true,
        data: { applied: true, message: 'Rules applied successfully' },
      });
    }

    return NextResponse.json({
      success: false,
      error: result.error || 'Failed to apply rules',
    });
  } catch (error) {
    console.error('[firewall/apply] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to apply rules' },
      { status: 500 },
    );
  }
}
