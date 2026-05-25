/**
 * DHCP Subnet by ID API Route
 *
 * GET, PUT, DELETE for individual DHCP subnets.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { isValidCidr, parseIpToInt, isValidIp } from '@/lib/ip-whitelist/utils';
import { logWifi } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/dhcp/subnets/[id] - Get single subnet
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await params;

    const subnet = await db.dhcpSubnet.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        vlanConfig: true,
        reservations: {
          where: { enabled: true },
          orderBy: { ipAddress: 'asc' },
        },
        leases: {
          where: { state: 'active' },
          orderBy: { leaseEnd: 'asc' },
        },
        _count: {
          select: {
            reservations: true,
            leases: true,
          },
        },
      },
    });

    if (!subnet) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP subnet not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: subnet });
  } catch (error) {
    console.error('Error fetching DHCP subnet:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP subnet' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/dhcp/subnets/[id] - Update subnet
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.dhcpSubnet.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP subnet not found' } },
        { status: 404 },
      );
    }

    const {
      name, subnet, gateway, poolStart, poolEnd, leaseTime,
      vlanId, vlanConfigId, domainName, dnsServers, ntpServers,
      bootFileName, nextServer, enabled, description,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (name) updateData.name = name;
    if (subnet) {
      if (!isValidCidr(subnet)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid subnet CIDR format' } },
          { status: 400 },
        );
      }
      updateData.subnet = subnet;

      // Check for overlapping subnets within the same tenant+property
      const existingSubnets = await db.dhcpSubnet.findMany({
        where: { tenantId: ctx.tenantId, propertyId: existing.propertyId, id: { not: id } },
        select: { id: true, subnet: true },
      });
      const newSlashIdx = subnet.indexOf('/');
      const newNetIp = subnet.substring(0, newSlashIdx);
      const newPrefix = parseInt(subnet.substring(newSlashIdx + 1), 10);
      const newNetInt = parseIpToInt(newNetIp);
      const newMask = newPrefix === 0 ? 0 : (~0 << (32 - newPrefix)) >>> 0;

      for (const es of existingSubnets) {
        const eSlashIdx = es.subnet.indexOf('/');
        const eNetIp = es.subnet.substring(0, eSlashIdx);
        const ePrefix = parseInt(es.subnet.substring(eSlashIdx + 1), 10);
        const eNetInt = parseIpToInt(eNetIp);
        const eMask = ePrefix === 0 ? 0 : (~0 << (32 - ePrefix)) >>> 0;
        if ((newNetInt & eMask) === (eNetInt & eMask) || (eNetInt & newMask) === (newNetInt & newMask)) {
          return NextResponse.json(
            { success: false, error: { code: 'OVERLAP_ERROR', message: `Subnet overlaps with existing subnet "${es.subnet}"` } },
            { status: 409 },
          );
        }
      }
    }
    if (gateway !== undefined) updateData.gateway = gateway;
    if (poolStart) {
      if (!isValidIp(poolStart)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'poolStart must be a valid IPv4 address' } },
          { status: 400 },
        );
      }
      updateData.poolStart = poolStart;
    }
    if (poolEnd) {
      if (!isValidIp(poolEnd)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'poolEnd must be a valid IPv4 address' } },
          { status: 400 },
        );
      }
      updateData.poolEnd = poolEnd;
    }
    if (leaseTime !== undefined) updateData.leaseTime = parseInt(leaseTime, 10);
    if (vlanId !== undefined) updateData.vlanId = vlanId ? parseInt(vlanId, 10) : null;
    if (vlanConfigId !== undefined) updateData.vlanConfigId = vlanConfigId;
    if (domainName !== undefined) updateData.domainName = domainName;
    if (dnsServers !== undefined) updateData.dnsServers = typeof dnsServers === 'string' ? dnsServers : JSON.stringify(dnsServers);
    if (ntpServers !== undefined) updateData.ntpServers = typeof ntpServers === 'string' ? ntpServers : JSON.stringify(ntpServers);
    if (bootFileName !== undefined) updateData.bootFileName = bootFileName;
    if (nextServer !== undefined) updateData.nextServer = nextServer;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (description !== undefined) updateData.description = description;

    const updatedSubnet = await db.dhcpSubnet.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    try {
      await logWifi(request, 'update', 'dhcp_subnet', id, { name: updatedSubnet.name, subnet: updatedSubnet.subnet, gateway: updatedSubnet.gateway, enabled: updatedSubnet.enabled }, { tenantId: ctx.tenantId, userId: ctx.userId, oldValue: existing as unknown as Record<string, unknown> });
    } catch (auditErr) {
      console.error('Audit log failed for DHCP subnet update:', auditErr);
    }

    return NextResponse.json({ success: true, data: updatedSubnet });
  } catch (error) {
    console.error('Error updating DHCP subnet:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update DHCP subnet' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/dhcp/subnets/[id] - Delete subnet
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await params;

    const existing = await db.dhcpSubnet.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        _count: {
          select: {
            reservations: true,
            leases: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP subnet not found' } },
        { status: 404 },
      );
    }

    if (existing._count.reservations > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEPENDENCY_ERROR',
            message: 'Cannot delete subnet with existing reservations. Remove reservations first.',
          },
        },
        { status: 400 },
      );
    }

    // Delete associated leases and subnet atomically to prevent inconsistent state
    await db.$transaction([
      db.dhcpLease.deleteMany({ where: { subnetId: id } }),
      db.dhcpSubnet.delete({ where: { id } }),
    ]);

    // Audit log
    try {
      await logWifi(request, 'delete', 'dhcp_subnet', id, { name: existing.name, subnet: existing.subnet, gateway: existing.gateway }, { tenantId: ctx.tenantId, userId: ctx.userId, oldValue: existing as unknown as Record<string, unknown> });
    } catch (auditErr) {
      console.error('Audit log failed for DHCP subnet delete:', auditErr);
    }

    return NextResponse.json({ success: true, message: 'DHCP subnet deleted successfully' });
  } catch (error) {
    console.error('Error deleting DHCP subnet:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete DHCP subnet' } },
      { status: 500 },
    );
  }
}
