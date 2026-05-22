/**
 * DHCP Hostname Filters API Route
 *
 * GET list and POST create for DHCP hostname filters.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/dhcp/hostname-filters - List all hostname filters
export async function GET(request: NextRequest) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const filters = await db.dhcpHostnameFilter.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        dhcpSubnet: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = filters.map((filter) => ({
      ...filter,
      subnetName: filter.dhcpSubnet?.name ?? null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching DHCP hostname filters:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP hostname filters' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/dhcp/hostname-filters - Create hostname filter
export async function POST(request: NextRequest) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await request.json();
    const { propertyId, pattern, action, subnetId, enabled, description } = body;

    if (!propertyId || !pattern) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, pattern' } },
        { status: 400 },
      );
    }

    const created = await db.dhcpHostnameFilter.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId,
        pattern,
        action: action ?? 'ignore',
        subnetId: subnetId === '__all__' || subnetId === null ? null : subnetId,
        enabled: enabled !== undefined ? enabled : true,
        description: description ?? null,
      },
    });

    return NextResponse.json(
      { success: true, data: created, message: 'DHCP hostname filter created successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating DHCP hostname filter:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create DHCP hostname filter' } },
      { status: 500 },
    );
  }
}
