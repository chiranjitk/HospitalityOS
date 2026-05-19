import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/firewall/device-groups - List device groups
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const matchType = searchParams.get('matchType');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (matchType) where.matchType = matchType;

    const groups = await db.deviceGroup.findMany({
      where,
      include: {
        defaultPolicy: {
          select: { id: true, name: true, trustLevel: true, isActive: true },
        },
        _count: {
          select: { deviceGroupsAsDefault: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.deviceGroup.count({ where });

    return NextResponse.json({
      success: true,
      data: groups,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching device groups:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch device groups' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/firewall/device-groups - Create a device group
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId,
      name,
      description,
      matchType = 'manual',
      matchCriteria = '{}',
      defaultPolicyId,
      enabled = true,
    } = body;

    if (!propertyId || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name' } },
        { status: 400 },
      );
    }

    const validMatchTypes = ['manual', 'mac_oui', 'vlan', 'ssid', 'device_type'];
    if (!validMatchTypes.includes(matchType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid matchType. Must be one of: ${validMatchTypes.join(', ')}` } },
        { status: 400 },
      );
    }

    // Validate matchCriteria is valid JSON
    try {
      JSON.parse(typeof matchCriteria === 'string' ? matchCriteria : JSON.stringify(matchCriteria));
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'matchCriteria must be valid JSON' } },
        { status: 400 },
      );
    }

    // Check for duplicate name within property
    const existing = await db.deviceGroup.findFirst({
      where: { tenantId: user.tenantId, propertyId, name },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NAME', message: 'A device group with this name already exists for this property' } },
        { status: 400 },
      );
    }

    // Validate defaultPolicyId if provided
    if (defaultPolicyId) {
      const policyExists = await db.devicePolicy.findFirst({
        where: { id: defaultPolicyId, tenantId: user.tenantId, propertyId },
      });
      if (!policyExists) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Referenced default policy not found' } },
          { status: 400 },
        );
      }
    }

    const group = await db.deviceGroup.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        description,
        matchType,
        matchCriteria: typeof matchCriteria === 'string' ? matchCriteria : JSON.stringify(matchCriteria),
        defaultPolicyId: defaultPolicyId || undefined,
        enabled,
      },
    });

    // Audit log
    await db.ztnaAuditLog.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        action: 'policy_created',
        entityType: 'device_group',
        entityId: group.id,
        details: JSON.stringify({ name, matchType, matchCriteria, defaultPolicyId }),
        performedBy: user.userId,
      },
    });

    return NextResponse.json({ success: true, data: group }, { status: 201 });
  } catch (error) {
    console.error('Error creating device group:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create device group' } },
      { status: 500 },
    );
  }
}
