/**
 * DHCP Blacklist API Route
 *
 * GET list and POST create for DHCP blacklist entries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/dhcp/blacklist - List all blacklist entries
export async function GET(request: NextRequest) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const blacklists = await db.dhcpBlacklist.findMany({
      where: { tenantId: ctx.tenantId },
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
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await request.json();
    const { propertyId, macAddress, reason, subnetId, enabled } = body;

    if (!propertyId || !macAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, macAddress' } },
        { status: 400 },
      );
    }

    // Validate MAC address format
    const macRegex = /^([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})$/;
    if (!macRegex.test(macAddress)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid MAC address format. Use XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX' } },
        { status: 400 },
      );
    }

    const normalizedMac = macAddress.trim().toLowerCase();

    // Check for duplicate MAC in the same property
    const existingMac = await db.dhcpBlacklist.findFirst({
      where: { tenantId: ctx.tenantId, propertyId, macAddress: normalizedMac },
    });

    if (existingMac) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_MAC', message: 'This MAC address is already blacklisted for this property' } },
        { status: 400 },
      );
    }

    const created = await db.dhcpBlacklist.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId,
        macAddress: normalizedMac,
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
