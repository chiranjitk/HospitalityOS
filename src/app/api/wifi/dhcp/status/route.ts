/**
 * DHCP Status API Route
 *
 * GET status endpoint returning DHCP service overview computed from DB.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

// GET /api/wifi/dhcp/status - Get DHCP service status
export async function GET(request: NextRequest) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const [subnetCount, leaseCount, activeLeases, reservationCount] = await Promise.all([
      db.dhcpSubnet.count({ where: { tenantId } }),
      db.dhcpLease.count({ where: { tenantId } }),
      db.dhcpLease.count({ where: { tenantId, state: 'active' } }),
      db.dhcpReservation.count({ where: { tenantId } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        installed: true,
        running: false,
        processRunning: false,
        version: 'dnsmasq',
        mode: 'standalone',
        backend: 'dnsmasq',
        subnetCount,
        leaseCount,
        activeLeases,
        reservationCount,
        currentInterfaces: [],
        systemInterfaces: [],
        configFile: '/etc/dnsmasq.conf',
        leasesFile: '/var/lib/misc/dnsmasq.leases',
      },
    });
  } catch (error) {
    console.error('Error fetching DHCP status:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP status' } },
      { status: 500 },
    );
  }
}
