import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { Prisma } from '@prisma/client';

const VALID_TYPES = ['fire', 'medical', 'security', 'natural_disaster', 'utility_failure', 'bomb_threat', 'evacuation', 'other'];
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'];
const VALID_STATUSES = ['active', 'acknowledged', 'escalated', 'resolved', 'false_alarm'];

// GET /api/security/emergency-alerts
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['security.view', 'security.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    const where: Prisma.EmergencyAlertWhereInput = {
      tenantId: user.tenantId,
      propertyId,
      deletedAt: null,
    };
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (status) where.status = status;

    const [alerts, total] = await Promise.all([
      db.emergencyAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.emergencyAlert.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('[GET /api/security/emergency-alerts]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/security/emergency-alerts
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['security.create', 'security.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { propertyId, title, description, type = 'other', severity = 'medium', location, affectedRooms, assignedTo } = body;

    if (!propertyId || !title) {
      return NextResponse.json({ success: false, error: 'propertyId and title are required' }, { status: 400 });
    }
    if (type && !VALID_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }
    if (!VALID_SEVERITIES.includes(severity)) {
      return NextResponse.json({ success: false, error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` }, { status: 400 });
    }

    const alert = await db.emergencyAlert.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        title,
        description: description || null,
        type,
        severity,
        status: 'active',
        location: location || null,
        affectedRooms: affectedRooms ? JSON.stringify(affectedRooms) : '[]',
        reportedBy: user.name || user.email,
        assignedTo: assignedTo || null,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'create',
        entityType: 'EmergencyAlert',
        entityId: alert.id,
        newValue: JSON.stringify({ title, type, severity }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
      },
    });

    return NextResponse.json({ success: true, data: alert }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/security/emergency-alerts]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/security/emergency-alerts
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['security.update', 'security.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, severity, assignedTo, responseActions, resolvedAt, resolution } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Alert ID is required' }, { status: 400 });
    }

    const existing = await db.emergencyAlert.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
    }

    const updateData: Prisma.EmergencyAlertUpdateInput = {};
    if (status && VALID_STATUSES.includes(status)) {
      updateData.status = status;
      if (status === 'resolved' || status === 'false_alarm') {
        updateData.resolvedAt = new Date();
      }
    }
    if (severity && VALID_SEVERITIES.includes(severity)) {
      updateData.severity = severity;
    }
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (responseActions) updateData.responseActions = JSON.stringify(responseActions);
    if (resolvedAt) updateData.resolvedAt = new Date(resolvedAt);
    if (resolution !== undefined) updateData.resolution = resolution;

    const alert = await db.emergencyAlert.update({
      where: { id },
      data: updateData,
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'update',
        entityType: 'EmergencyAlert',
        entityId: id,
        oldValue: JSON.stringify({ previousStatus: existing.status }),
        newValue: JSON.stringify(updateData),
      },
    });

    return NextResponse.json({ success: true, data: alert });
  } catch (error) {
    console.error('[PUT /api/security/emergency-alerts]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/security/emergency-alerts
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['security.delete', 'security.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Alert ID is required' }, { status: 400 });
    }

    const existing = await db.emergencyAlert.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
    }

    // Soft-delete
    await db.emergencyAlert.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'delete',
        entityType: 'EmergencyAlert',
        entityId: id,
        newValue: JSON.stringify({ deletedAlert: existing.title }),
      },
    });

    return NextResponse.json({ success: true, data: { message: 'Alert archived' } });
  } catch (error) {
    console.error('[DELETE /api/security/emergency-alerts]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
