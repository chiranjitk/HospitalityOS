import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/users/[id]/property-assignments - Get all property assignments for a user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;

    // Permission check: user can view own assignments, or admin can view any
    if (
      currentUser.id !== id &&
      !hasAnyPermission(currentUser, ['users.manage', 'admin.users', 'admin.*'])
    ) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Check that target user exists
    const targetUser = await db.user.findUnique({
      where: { id },
      select: { id: true, tenantId: true, deletedAt: true },
    });

    if (!targetUser || targetUser.deletedAt) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Non-platform-admins can only view assignments for users in the same tenant
    if (!currentUser.isPlatformAdmin && targetUser.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const assignments = await db.userProperty.findMany({
      where: {
        userId: id,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            city: true,
            country: true,
          },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { assignedAt: 'desc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: assignments,
      defaultPropertyId: assignments.find((a) => a.isDefault)?.propertyId || null,
    });
  } catch (error) {
    console.error('Error fetching property assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch property assignments' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id]/property-assignments - Sync all property assignments for a user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;

    // Permission check: only admins can manage assignments for other users
    if (!hasAnyPermission(currentUser, ['users.manage', 'admin.users', 'admin.*'])) {
      return NextResponse.json(
        { error: 'Permission denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Check that target user exists
    const targetUser = await db.user.findUnique({
      where: { id },
      select: { id: true, tenantId: true, email: true, firstName: true, lastName: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Non-platform-admins can only manage assignments for users in the same tenant
    if (!currentUser.isPlatformAdmin && targetUser.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { assignments } = body as {
      assignments: Array<{
        propertyId: string;
        role?: string;
        isDefault?: boolean;
      }>;
    };

    if (!Array.isArray(assignments)) {
      return NextResponse.json(
        { error: 'assignments must be an array' },
        { status: 400 }
      );
    }

    // Validate that at most one assignment has isDefault = true
    const defaultAssignments = assignments.filter((a) => a.isDefault === true);
    if (defaultAssignments.length > 1) {
      return NextResponse.json(
        { error: 'Only one property assignment can be marked as default' },
        { status: 400 }
      );
    }

    // Verify all propertyIds belong to the same tenant and exist
    const propertyIds = assignments.map((a) => a.propertyId);
    const properties = await db.property.findMany({
      where: {
        id: { in: propertyIds },
        tenantId: targetUser.tenantId,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    if (properties.length !== propertyIds.length) {
      const foundIds = new Set(properties.map((p) => p.id));
      const missingIds = propertyIds.filter((pid) => !foundIds.has(pid));
      return NextResponse.json(
        { error: `One or more properties not found or do not belong to this tenant: ${missingIds.join(', ')}` },
        { status: 400 }
      );
    }

    // Sync assignments in a transaction
    const syncedAssignments = await db.$transaction(async (tx) => {
      // Delete all existing assignments for this user
      await tx.userProperty.deleteMany({
        where: { userId: id },
      });

      // Create new assignments
      if (assignments.length > 0) {
        for (const assignment of assignments) {
          await tx.userProperty.create({
            data: {
              tenantId: targetUser.tenantId,
              userId: id,
              propertyId: assignment.propertyId,
              role: assignment.role || 'staff',
              isDefault: assignment.isDefault || false,
            },
          });
        }
      }

      // Return all newly created assignments
      return tx.userProperty.findMany({
        where: { userId: id },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
            },
          },
        },
        orderBy: [
          { isDefault: 'desc' },
          { assignedAt: 'desc' },
        ],
      });
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId: targetUser.tenantId,
          module: 'admin',
          action: 'update',
          entityType: 'user_property_assignments',
          entityId: id,
          newValue: JSON.stringify({
            targetUser: `${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})`,
            assignmentCount: assignments.length,
            propertyIds,
          }),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({
      success: true,
      data: syncedAssignments,
      defaultPropertyId: syncedAssignments.find((a) => a.isDefault)?.propertyId || null,
    });
  } catch (error) {
    console.error('Error syncing property assignments:', error);
    return NextResponse.json(
      { error: 'Failed to sync property assignments' },
      { status: 500 }
    );
  }
}
