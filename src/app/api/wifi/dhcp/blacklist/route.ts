/**
 * DHCP Blacklist API Route
 *
 * GET list and POST create for DHCP blacklist entries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

// GET /api/wifi/dhcp/blacklist - List all blacklist entries
export async function GET(request: NextRequest) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const blacklists = await db.dhcpBlacklist.findMany({
      where: { tenantId },
      include: {
        dhcpSubnet: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = blacklists.map((entry) => ({
      ...entry,
      subnetName: entry.dhcpSubnet?.name ?? null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching DHCP blacklist:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP blacklist' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/dhcp/blacklist - Create blacklist entry
export async function POST(request: NextRequest) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { propertyId, macAddress, reason, subnetId, enabled } = body;

    if (!propertyId || !macAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, macAddress' } },
        { status: 400 },
      );
    }

    const created = await db.dhcpBlacklist.create({
      data: {
        tenantId,
        propertyId,
        macAddress,
        reason: reason ?? null,
        subnetId: subnetId === '__all__' || subnetId === null ? null : subnetId,
        enabled: enabled !== undefined ? enabled : true,
      },
    });

    return NextResponse.json(
      { success: true, data: created, message: 'DHCP blacklist entry created successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating DHCP blacklist entry:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create DHCP blacklist entry' } },
      { status: 500 },
    );
  }
}
