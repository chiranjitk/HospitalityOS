import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';

// ────────────────────────────────────────────────────────────────
// GET /api/v1/wifi/session-engine/status
//
// Returns session engine diagnostics: last run, run count, errors,
// recent log entries, log file size, active sessions, counter IPs.
//
// Requires wifi.manage permission.
// ────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'wifi.manage');
  if (auth instanceof NextResponse) return auth;

  try {
    const { getSessionEngineDiagnostics } = await import('@/lib/wifi/services/session-engine');
    const diagnostics = await getSessionEngineDiagnostics();

    return NextResponse.json({
      success: true,
      data: diagnostics,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get session engine diagnostics' },
      { status: 500 }
    );
  }
}
