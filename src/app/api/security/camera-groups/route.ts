import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/security/camera-groups - List all camera groups
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'security.view') && !hasPermission(user, 'security.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    const propertyWhere: Record<string, unknown> = {
      tenantId: user.tenantId,
      status: 'active',
    };

    const properties = await db.property.findMany({
      where: propertyWhere,
      select: { id: true, name: true },
    });

    const propertyIds = propertyId ? [propertyId] : properties.map(p => p.id);

    const groups = await db.cameraGroup.findMany({
      where: { propertyId: { in: propertyIds } },
      include: {
        property: { select: { id: true, name: true } },
        _count: { select: { cameras: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        groups: groups.map(g => ({
          id: g.id,
          name: g.name,
          description: g.description || null,
          propertyId: g.propertyId,
          propertyName: g.property?.name,
          cameraCount: g._count.cameras,
        })),
        properties,
      },
    });
  } catch (error) {
    console.error('Error fetching camera groups:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch camera groups' } },
      { status: 500 }
    );
  }
}

// POST /api/security/camera-groups - Create a new group
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'security.create') && !hasPermission(user, 'security.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { propertyId, name, description } = body;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Group name is required' } },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, status: 'active' },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found or access denied' } },
        { status: 400 }
      );
    }

    const group = await db.cameraGroup.create({
      data: {
        propertyId,
        name: name.trim(),
        description: description?.trim() || null,
      },
      include: {
        property: { select: { id: true, name: true } },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'security.camera_group.created',
        entityType: 'CameraGroup',
        entityId: group.id,
        newValue: JSON.stringify({ name: group.name, propertyId }),
      },
    });

    return NextResponse.json({ success: true, data: group });
  } catch (error) {
    console.error('Error creating camera group:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create camera group' } },
      { status: 500 }
    );
  }
}

// PUT /api/security/camera-groups - Update a group
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'security.update') && !hasPermission(user, 'security.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, description } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Group ID is required' } },
        { status: 400 }
      );
    }

    // Verify ownership through property
    const existing = await db.cameraGroup.findFirst({
      where: { id },
      include: { property: { select: { tenantId: true } } },
    });

    if (!existing || existing.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group not found or access denied' } },
        { status: 404 }
      );
    }

    const group = await db.cameraGroup.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'security.camera_group.updated',
        entityType: 'CameraGroup',
        entityId: group.id,
        newValue: JSON.stringify({ updates: { name, description } }),
      },
    });

    return NextResponse.json({ success: true, data: group });
  } catch (error) {
    console.error('Error updating camera group:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update camera group' } },
      { status: 500 }
    );
  }
}

// DELETE /api/security/camera-groups - Delete a group
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'security.delete') && !hasPermission(user, 'security.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Group ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.cameraGroup.findFirst({
      where: { id },
      include: {
        property: { select: { tenantId: true } },
        _count: { select: { cameras: true } },
      },
    });

    if (!existing || existing.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group not found or access denied' } },
        { status: 404 }
      );
    }

    if (existing._count.cameras > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'HAS_CAMERAS', message: `Cannot delete group "${existing.name}" — it still has ${existing._count.cameras} camera(s). Remove or reassign them first.` } },
        { status: 400 }
      );
    }

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'security.camera_group.deleted',
        entityType: 'CameraGroup',
        entityId: id,
        newValue: JSON.stringify({ deletedGroup: { name: existing.name } }),
      },
    });

    await db.cameraGroup.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { message: 'Group deleted successfully' } });
  } catch (error) {
    console.error('Error deleting camera group:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete camera group' } },
      { status: 500 }
    );
  }
}
