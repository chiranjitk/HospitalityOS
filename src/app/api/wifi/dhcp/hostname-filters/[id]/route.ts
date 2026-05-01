/**
 * DHCP Hostname Filters by ID API Route
 *
 * GET, PUT, DELETE for individual DHCP hostname filters.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/dhcp/hostname-filters/[id] - Get single hostname filter
export async function GET(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const filter = await db.dhcpHostnameFilter.findFirst({
      where: { id, tenantId },
      include: {
        dhcpSubnet: {
          select: { id: true, name: true },
        },
      },
    });

    if (!filter) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP hostname filter not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { ...filter, subnetName: filter.dhcpSubnet?.name ?? null },
    });
  } catch (error) {
    console.error('Error fetching DHCP hostname filter:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP hostname filter' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/dhcp/hostname-filters/[id] - Update hostname filter
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.dhcpHostnameFilter.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP hostname filter not found' } },
        { status: 404 },
      );
    }

    const { pattern, action, subnetId, enabled, description } = body;

    const updated = await db.dhcpHostnameFilter.update({
      where: { id },
      data: {
        ...(pattern !== undefined && { pattern }),
        ...(action !== undefined && { action }),
        ...(subnetId !== undefined && { subnetId: subnetId === '__all__' || subnetId === null ? null : subnetId }),
        ...(enabled !== undefined && { enabled }),
        ...(description !== undefined && { description }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'DHCP hostname filter updated successfully',
    });
  } catch (error) {
    console.error('Error updating DHCP hostname filter:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update DHCP hostname filter' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/dhcp/hostname-filters/[id] - Delete hostname filter
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await db.dhcpHostnameFilter.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP hostname filter not found' } },
        { status: 404 },
      );
    }

    await db.dhcpHostnameFilter.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'DHCP hostname filter deleted successfully' });
  } catch (error) {
    console.error('Error deleting DHCP hostname filter:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete DHCP hostname filter' } },
      { status: 500 },
    );
  }
}
