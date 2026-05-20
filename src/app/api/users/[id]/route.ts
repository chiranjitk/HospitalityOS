import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { logUser } from '@/lib/audit';

// Common include for user property assignments
const userPropertyAssignmentsInclude = {
  userPropertyAssignments: {
    include: {
      property: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { assignedAt: 'desc' } as const,
  },
};

// GET /api/users/[id] - Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;

    if (!hasAnyPermission(currentUser, ['users.manage', 'admin.users', 'admin.*'])) {
      // Allow users to view their own profile
      if (currentUser.id !== id) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
    }

    const user = await db.user.findUnique({
      where: { id },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            displayName: true,
            permissions: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        ...userPropertyAssignmentsInclude,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Permission check - non-platform-admins can only view users in same tenant
    if (!currentUser.isPlatformAdmin && user.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Non-admins can only view their own profile
    if (
      !currentUser.isPlatformAdmin &&
      currentUser.roleName !== 'admin' &&
      !currentUser.permissions.includes('*') &&
      currentUser.id !== id
    ) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!hasAnyPermission(currentUser, ['users.manage', 'admin.users', 'admin.*'])) {
      // Allow users to update their own profile
      const { id: targetId } = await params;
      if (currentUser.id !== targetId) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
    }

    const { id } = await params;
    const body = await request.json();

    // Non-platform-admins cannot assign admin or platform_admin roles
    if (!currentUser.isPlatformAdmin && body.roleId) {
      const targetRole = await db.role.findUnique({
        where: { id: body.roleId },
        select: { name: true },
      });
      if (targetRole && (targetRole.name === 'admin' || targetRole.name === 'platform_admin')) {
        return NextResponse.json(
          { error: 'Permission denied. Cannot assign admin-level roles.' },
          { status: 403 }
        );
      }
    }

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Permission check - non-platform-admins can only update users in same tenant
    if (!currentUser.isPlatformAdmin && existingUser.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Non-admins can only update their own profile (with limited fields)
    const isAdmin =
      currentUser.isPlatformAdmin ||
      currentUser.roleName === 'admin' ||
      currentUser.permissions.includes('*');
    if (!isAdmin && currentUser.id !== id) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // If email is being changed, check for duplicates
    if (body.email && body.email !== existingUser.email) {
      const duplicateEmail = await db.user.findFirst({
        where: { email: body.email.toLowerCase() },
      });
      if (duplicateEmail) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        );
      }
    }

    // Build update data - non-admins can only update certain fields
    const updateData: Record<string, unknown> = {};

    if (body.email && isAdmin) updateData.email = body.email.toLowerCase();
    if (body.firstName) updateData.firstName = body.firstName;
    if (body.lastName) updateData.lastName = body.lastName;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.avatar !== undefined) updateData.avatar = body.avatar || null;

    // Admin-only fields
    if (isAdmin) {
      if (body.jobTitle !== undefined) updateData.jobTitle = body.jobTitle || null;
      if (body.department !== undefined) updateData.department = body.department || null;
      if (body.roleId !== undefined) updateData.roleId = body.roleId || null;
      if (body.status) updateData.status = body.status;
    }

    // SECURITY: isPlatformAdmin can ONLY be set by platform admins
    if (currentUser.isPlatformAdmin && body.isPlatformAdmin !== undefined) {
      updateData.isPlatformAdmin = Boolean(body.isPlatformAdmin);
    }
    // Tenant admins attempting to set isPlatformAdmin: silently ignored (no error,
    // but the field is never included in updateData for non-platform-admins)

    // Validate property assignments if provided
    const { propertyAssignments } = body;
    if (Array.isArray(propertyAssignments)) {
      // Verify all propertyIds belong to the same tenant
      const propertyIds = propertyAssignments.map((a: { propertyId: string }) => a.propertyId);
      const properties = await db.property.findMany({
        where: {
          id: { in: propertyIds },
          tenantId: existingUser.tenantId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (properties.length !== propertyIds.length) {
        const foundIds = new Set(properties.map((p) => p.id));
        const missingIds = propertyIds.filter((pid: string) => !foundIds.has(pid));
        return NextResponse.json(
          { error: `One or more properties not found or do not belong to this tenant: ${missingIds.join(', ')}` },
          { status: 400 }
        );
      }

      // Validate that at most one assignment has isDefault = true
      const defaultAssignments = propertyAssignments.filter(
        (a: { isDefault?: boolean }) => a.isDefault === true
      );
      if (defaultAssignments.length > 1) {
        return NextResponse.json(
          { error: 'Only one property assignment can be marked as default' },
          { status: 400 }
        );
      }
    }

    // Update user and sync property assignments in a transaction
    const user = await db.$transaction(async (tx) => {
      // Update user basic fields
      await tx.user.update({
        where: { id },
        data: updateData,
      });

      // Sync property assignments if provided in the body
      if (Array.isArray(propertyAssignments)) {
        // Delete all existing assignments for this user
        await tx.userProperty.deleteMany({
          where: { userId: id },
        });

        // Create new assignments
        for (const assignment of propertyAssignments) {
          await tx.userProperty.create({
            data: {
              tenantId: existingUser.tenantId,
              userId: id,
              propertyId: assignment.propertyId,
              role: assignment.role || 'staff',
              isDefault: assignment.isDefault || false,
            },
          });
        }
      }

      // Re-fetch with all includes
      return tx.user.findUnique({
        where: { id },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
          ...userPropertyAssignmentsInclude,
        },
      });
    });

    // Create audit log
    try {
      await logUser(request, 'update', user!.id, {
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        status: existingUser.status,
        roleId: existingUser.roleId,
        isPlatformAdmin: existingUser.isPlatformAdmin,
      }, {
        email: user!.email,
        firstName: user!.firstName,
        lastName: user!.lastName,
        status: user!.status,
        roleId: user!.roleId,
        isPlatformAdmin: user!.isPlatformAdmin,
        propertyAssignmentCount: Array.isArray(propertyAssignments) ? propertyAssignments.length : undefined,
      }, { tenantId: user!.tenantId, userId: currentUser.id });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Soft delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!hasAnyPermission(currentUser, ['users.manage', 'admin.users', 'admin.*'])) {
      return NextResponse.json({ error: 'Permission denied. Admin access required.' }, { status: 403 });
    }

    // Permission check - only admins can delete users
    if (
      !currentUser.isPlatformAdmin &&
      currentUser.roleName !== 'admin' &&
      !currentUser.permissions.includes('*')
    ) {
      return NextResponse.json({ error: 'Permission denied. Admin access required.' }, { status: 403 });
    }

    const { id } = await params;

    // Prevent self-deletion
    if (currentUser.id === id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Permission check - non-platform-admins can only delete users in same tenant
    if (!currentUser.isPlatformAdmin && existingUser.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Soft delete user and explicitly delete property assignments
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'inactive',
        },
      });

      // Delete all property assignments for this user
      // (cascade should handle this, but be explicit for clarity)
      await tx.userProperty.deleteMany({
        where: { userId: id },
      });
    });

    // Delete all sessions for this user
    await db.session.deleteMany({
      where: { userId: id },
    });

    // Create audit log
    try {
      await logUser(request, 'delete', id, {
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
      }, undefined, { tenantId: existingUser.tenantId, userId: currentUser.id });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
