/**
 * DHCP Subnets API Route
 *
 * List and create DHCP subnets with active lease counts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { isValidCidr, parseIpToInt, isValidIp } from '@/lib/ip-whitelist/utils';

// GET /api/wifi/dhcp/subnets - List all DHCP subnets
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const vlanId = searchParams.get('vlanId');
    const enabled = searchParams.get('enabled');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (vlanId) where.vlanConfigId = vlanId;
    if (enabled !== null) where.enabled = enabled === 'true';

    const [subnets, total] = await Promise.all([
      db.dhcpSubnet.findMany({
        where,
        include: {
          vlanConfig: {
            select: { id: true, vlanId: true, subInterface: true },
          },
          _count: {
            select: {
              reservations: true,
              leases: {
                where: { state: 'active' },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        ...(limit && { take: parseInt(limit, 10) }),
        ...(offset && { skip: parseInt(offset, 10) }),
      }),
      db.dhcpSubnet.count({ where }),
    ]);

    // Summary: total active leases across all subnets for this tenant
    const activeLeaseCount = await db.dhcpLease.count({
      where: {
        tenantId: user.tenantId,
        state: 'active',
        ...(propertyId && { propertyId }),
      },
    });

    const enabledSubnets = await db.dhcpSubnet.count({
      where: {
        tenantId: user.tenantId,
        enabled: true,
        ...(propertyId && { propertyId }),
      },
    });

    return NextResponse.json({
      success: true,
      data: subnets,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        totalSubnets: total,
        enabledSubnets,
        totalActiveLeases: activeLeaseCount,
      },
    });
  } catch (error) {
    console.error('Error fetching DHCP subnets:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP subnets' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/dhcp/subnets - Create DHCP subnet
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      name,
      subnet,
      gateway,
      poolStart,
      poolEnd,
      leaseTime = 3600,
      vlanId,
      vlanConfigId,
      domainName,
      dnsServers = '[]',
      ntpServers = '[]',
      bootFileName,
      nextServer,
      enabled = true,
      description,
    } = body;

    if (!propertyId || !name || !subnet || !poolStart || !poolEnd) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: propertyId, name, subnet, poolStart, poolEnd',
          },
        },
        { status: 400 },
      );
    }

    // Validate subnet is valid CIDR
    if (!isValidCidr(subnet)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid subnet CIDR format' } },
        { status: 400 },
      );
    }

    // Validate pool IPs
    if (!isValidIp(poolStart) || !isValidIp(poolEnd)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'poolStart and poolEnd must be valid IPv4 addresses' } },
        { status: 400 },
      );
    }

    if (parseIpToInt(poolStart) > parseIpToInt(poolEnd)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'poolStart must not exceed poolEnd' } },
        { status: 400 },
      );
    }

    // Check for overlapping subnets within the same tenant+property
    const existingSubnets = await db.dhcpSubnet.findMany({
      where: { tenantId, propertyId },
      select: { id: true, subnet: true },
    });
    const newSlashIdx = subnet.indexOf('/');
    const newNetIp = subnet.substring(0, newSlashIdx);
    const newPrefix = parseInt(subnet.substring(newSlashIdx + 1), 10);
    const newNetInt = parseIpToInt(newNetIp);
    const newMask = newPrefix === 0 ? 0 : (~0 << (32 - newPrefix)) >>> 0;

    for (const existing of existingSubnets) {
      const eSlashIdx = existing.subnet.indexOf('/');
      const eNetIp = existing.subnet.substring(0, eSlashIdx);
      const ePrefix = parseInt(existing.subnet.substring(eSlashIdx + 1), 10);
      const eNetInt = parseIpToInt(eNetIp);
      const eMask = ePrefix === 0 ? 0 : (~0 << (32 - ePrefix)) >>> 0;

      // Overlap exists if either network address falls within the other's range
      if ((newNetInt & eMask) === (eNetInt & eMask) || (eNetInt & newMask) === (newNetInt & newMask)) {
        return NextResponse.json(
          { success: false, error: { code: 'OVERLAP_ERROR', message: `Subnet overlaps with existing subnet "${existing.subnet}"` } },
          { status: 409 },
        );
      }
    }

    const newSubnet = await db.dhcpSubnet.create({
      data: {
        tenantId,
        propertyId,
        name,
        subnet,
        gateway,
        poolStart,
        poolEnd,
        leaseTime: parseInt(leaseTime, 10),
        vlanId: vlanId ? parseInt(vlanId, 10) : null,
        vlanConfigId,
        domainName,
        dnsServers: typeof dnsServers === 'string' ? dnsServers : JSON.stringify(dnsServers),
        ntpServers: typeof ntpServers === 'string' ? ntpServers : JSON.stringify(ntpServers),
        bootFileName,
        nextServer,
        enabled,
        description,
      },
    });

    return NextResponse.json({ success: true, data: newSubnet }, { status: 201 });
  } catch (error) {
    console.error('Error creating DHCP subnet:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create DHCP subnet' } },
      { status: 500 },
    );
  }
}
