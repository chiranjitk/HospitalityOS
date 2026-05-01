/**
 * DHCP Tag Rules API Route
 *
 * GET list and POST create for DHCP tag rules.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

// GET /api/wifi/dhcp/tag-rules - List all tag rules
export async function GET(request: NextRequest) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const rules = await db.dhcpTagRule.findMany({
      where: { tenantId },
      include: {
        dhcpSubnet: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = rules.map((rule) => ({
      ...rule,
      subnetName: rule.dhcpSubnet?.name ?? null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching DHCP tag rules:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP tag rules' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/dhcp/tag-rules - Create tag rule
export async function POST(request: NextRequest) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { propertyId, name, matchType, matchPattern, setTag, subnetId, enabled, description } = body;

    if (!propertyId || !name || !matchType || !matchPattern || !setTag) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name, matchType, matchPattern, setTag' } },
        { status: 400 },
      );
    }

    const created = await db.dhcpTagRule.create({
      data: {
        tenantId,
        propertyId,
        name,
        matchType,
        matchPattern,
        setTag,
        subnetId: subnetId === '__all__' || subnetId === null ? null : subnetId,
        enabled: enabled !== undefined ? enabled : true,
        description: description ?? null,
      },
    });

    return NextResponse.json(
      { success: true, data: created, message: 'DHCP tag rule created successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating DHCP tag rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create DHCP tag rule' } },
      { status: 500 },
    );
  }
}
