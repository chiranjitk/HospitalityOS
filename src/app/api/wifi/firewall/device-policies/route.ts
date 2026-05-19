import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/firewall/device-policies - List device policies
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const trustLevel = searchParams.get('trustLevel');
    const isActive = searchParams.get('isActive');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (trustLevel) where.trustLevel = trustLevel;
    if (isActive !== null) where.isActive = isActive === 'true';

    const policies = await db.devicePolicy.findMany({
      where,
      include: {
        _count: {
          select: { assignments: true },
        },
      },
      orderBy: { priority: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.devicePolicy.count({ where });

    return NextResponse.json({
      success: true,
      data: policies,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching device policies:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch device policies' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/firewall/device-policies - Create a new device policy
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId,
      name,
      description,
      trustLevel = 'standard',
      bandwidthDownKbps = 10240,
      bandwidthUpKbps = 5120,
      allowedZones = '[]',
      deniedZones = '[]',
      contentFilterLevel = 'none',
      sessionTimeoutMins = 1440,
      maxDevices = 3,
      autoApplyOnAuth = true,
      priority = 0,
      scheduleId,
    } = body;

    if (!propertyId || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name' } },
        { status: 400 },
      );
    }

    const validTrustLevels = ['trusted', 'standard', 'restricted', 'quarantine'];
    if (!validTrustLevels.includes(trustLevel)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid trustLevel. Must be one of: ${validTrustLevels.join(', ')}` } },
        { status: 400 },
      );
    }

    const validFilterLevels = ['none', 'basic', 'strict', 'custom'];
    if (!validFilterLevels.includes(contentFilterLevel)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid contentFilterLevel. Must be one of: ${validFilterLevels.join(', ')}` } },
        { status: 400 },
      );
    }

    // Check for duplicate name within property
    const existing = await db.devicePolicy.findFirst({
      where: { tenantId: user.tenantId, propertyId, name },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NAME', message: 'A device policy with this name already exists for this property' } },
        { status: 400 },
      );
    }

    const policy = await db.devicePolicy.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        description,
        trustLevel,
        bandwidthDownKbps,
        bandwidthUpKbps,
        allowedZones: typeof allowedZones === 'string' ? allowedZones : JSON.stringify(allowedZones),
        deniedZones: typeof deniedZones === 'string' ? deniedZones : JSON.stringify(deniedZones),
        contentFilterLevel,
        sessionTimeoutMins,
        maxDevices,
        autoApplyOnAuth,
        priority,
        scheduleId: scheduleId || undefined,
      },
    });

    // Audit log
    await db.ztnaAuditLog.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        action: 'policy_created',
        entityType: 'device_policy',
        entityId: policy.id,
        details: JSON.stringify({ name, trustLevel, bandwidthDownKbps, bandwidthUpKbps }),
        performedBy: user.userId,
      },
    });

    return NextResponse.json({ success: true, data: policy }, { status: 201 });
  } catch (error) {
    console.error('Error creating device policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create device policy' } },
      { status: 500 },
    );
  }
}
