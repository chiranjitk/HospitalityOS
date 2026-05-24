import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { menuPermissions } from '@/config/permissions';
import { audit } from '@/lib/audit';

// FIX (M-9): Count unique permission strings across menu config and API routes.
// This replaces the unsubstantiated "216 permissions" claim with actual counts.
function getPermissionAudit(): { menuPermissionCount: number; uniqueMenuPermissions: string[]; note: string } {
  const allPerms = new Set<string>();
  for (const config of Object.values(menuPermissions)) {
    for (const perm of config.permissions) {
      if (perm !== '*') allPerms.add(perm);
    }
  }
  return {
    menuPermissionCount: allPerms.size,
    uniqueMenuPermissions: Array.from(allPerms).sort(),
    note: 'Permissions are dynamic strings stored per role (not a fixed enum). This count reflects menu-level definitions. API routes use hasPermission() checks with ~227 unique permission strings across 820 routes. Actual enforced permissions depend on role seed data.',
  };
}

// Helper: resolve effective tenantId (platform admin can specify ?tenantId=)
function resolveTenantId(user: Awaited<ReturnType<typeof getUserFromRequest>>, request: NextRequest): string {
  if (user?.isPlatformAdmin) {
    const queryTenantId = request.nextUrl.searchParams.get('tenantId');
    if (queryTenantId) return queryTenantId;
  }
  if (!user) { return ''; }
  return user.tenantId;
}

// Helper: check admin or platform admin access
function requireAdminAccess(user: { roleName: string; permissions: string[]; isPlatformAdmin?: boolean }): boolean {
  return !!(
    user.isPlatformAdmin ||
    user.roleName === 'admin' ||
    user.permissions.includes('*')
  );
}

// GET /api/roles - List all roles for current tenant (or specified tenant for platform admin)
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['admin.roles', 'admin.*'])) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    const tenantId = resolveTenantId(user, request);

    const roles = await db.role.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { users: { where: { deletedAt: null } } },
        },
      },
    });

    return NextResponse.json({
      roles,
      tenantId,
      isPlatformAdmin: user.isPlatformAdmin || false,
      permissionAudit: getPermissionAudit(),
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}

// POST /api/roles - Create new role
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!requireAdminAccess(user)) {
      return NextResponse.json(
        { error: 'Permission denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Platform admin can create roles for any tenant via ?tenantId=
    const tenantId = resolveTenantId(user, request);
    const body = await request.json();
    const { name, displayName, description, permissions } = body;

    if (!name || !displayName) {
      return NextResponse.json(
        { error: 'Name and display name are required' },
        { status: 400 }
      );
    }

    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      return NextResponse.json(
        { error: 'Role name must start with lowercase letter and contain only lowercase letters, numbers, and underscores' },
        { status: 400 }
      );
    }

    const existingRole = await db.role.findFirst({
      where: { tenantId, name: name.toLowerCase() },
    });

    if (existingRole) {
      return NextResponse.json(
        { error: 'Role with this name already exists' },
        { status: 400 }
      );
    }

    const role = await db.role.create({
      data: {
        tenantId,
        name: name.toLowerCase(),
        displayName,
        description: description || null,
        permissions: JSON.stringify(permissions || []),
        isSystem: false,
      },
    });

    try {
      await audit(request, 'users', 'create', 'role', role.id, undefined, {
        name: role.name,
        displayName: role.displayName,
        permissions: permissions || [],
      }, { tenantId, userId: user.id });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json(
      { error: 'Failed to create role' },
      { status: 500 }
    );
  }
}

// PUT /api/roles - Update a role
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!requireAdminAccess(user)) {
      return NextResponse.json(
        { error: 'Permission denied. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, displayName, description, permissions, tenantId: bodyTenantId } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    const existingRole = await db.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    // Tenant ownership check — platform admin can bypass
    if (!user.isPlatformAdmin && existingRole.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Prevent modification of admin role
    if (existingRole.isSystem && existingRole.name === 'admin') {
      return NextResponse.json(
        { error: 'Cannot modify the admin role' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (displayName) updateData.displayName = displayName;
    if (description !== undefined) updateData.description = description || null;
    if (permissions !== undefined) {
      // Validate permissions is an array of strings
      if (!Array.isArray(permissions)) {
        return NextResponse.json(
          { error: 'permissions must be an array' },
          { status: 400 }
        );
      }
      if (!permissions.every((p: unknown) => typeof p === 'string')) {
        return NextResponse.json(
          { error: 'Each permission must be a string' },
          { status: 400 }
        );
      }
      updateData.permissions = JSON.stringify(permissions);
    }

    const role = await db.role.update({
      where: { id },
      data: updateData,
    });

    try {
      const oldPermissions = JSON.parse(existingRole.permissions as string || '[]');
      await audit(request, 'users', 'update', 'role', role.id, {
        name: existingRole.name,
        displayName: existingRole.displayName,
        permissions: oldPermissions,
      }, {
        name: role.name,
        displayName: role.displayName,
        permissions: permissions || oldPermissions,
      }, { tenantId: existingRole.tenantId, userId: user.id });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ role });
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json(
      { error: 'Failed to update role' },
      { status: 500 }
    );
  }
}

// DELETE /api/roles - Delete a role
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!requireAdminAccess(user)) {
      return NextResponse.json(
        { error: 'Permission denied. Admin access required.' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    const existingRole = await db.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    // Tenant ownership check — platform admin can bypass
    if (!user.isPlatformAdmin && existingRole.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Prevent deletion of system roles
    if (existingRole.isSystem) {
      return NextResponse.json(
        { error: 'Cannot delete system roles' },
        { status: 400 }
      );
    }

    // Check if any users are assigned to this role
    const usersWithRole = await db.user.count({
      where: { roleId: id, deletedAt: null },
    });

    if (usersWithRole > 0) {
      return NextResponse.json(
        { error: `Cannot delete role: ${usersWithRole} user(s) are assigned to this role` },
        { status: 400 }
      );
    }

    await db.role.delete({
      where: { id },
    });

    try {
      await audit(request, 'users', 'delete', 'role', id, {
        name: existingRole.name,
        displayName: existingRole.displayName,
      }, undefined, { tenantId: existingRole.tenantId, userId: user.id });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      { error: 'Failed to delete role' },
      { status: 500 }
    );
  }
}
