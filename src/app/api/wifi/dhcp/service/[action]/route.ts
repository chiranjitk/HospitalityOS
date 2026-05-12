/**
 * DHCP Service Control API Route
 *
 * POST service control (start/stop/restart/reload) - stub implementation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

interface ServiceParams {
  params: Promise<{ action: string }>;
}

const VALID_ACTIONS = ['start', 'stop', 'restart', 'reload'] as const;

// POST /api/wifi/dhcp/service/[action] - Control DHCP service
export async function POST(request: NextRequest, { params }: ServiceParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { action } = await params;

    if (!VALID_ACTIONS.includes(action as typeof VALID_ACTIONS[number])) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid action: ${action}. Must be one of: start, stop, restart, reload` } },
        { status: 400 },
      );
    }

    // Stub: always succeed
    return NextResponse.json({
      success: true,
      message: `Service ${action} triggered via dnsmasq`,
      running: true,
    });
  } catch (error) {
    console.error('Error controlling DHCP service:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to control DHCP service' } },
      { status: 500 },
    );
  }
}
