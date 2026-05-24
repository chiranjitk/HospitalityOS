import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, validatePasswordStrength } from '@/lib/auth';
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

// GET /api/users - List all users (tenant-scoped or platform-wide)
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(currentUser, ['users.view', 'admin.users', 'admin.*'])) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Permission check - admins, or users with tasks/housekeeping permissions can list users
    const canListUsers =
      currentUser.isPlatformAdmin ||
      currentUser.roleName === 'admin' ||
      currentUser.permissions.includes('*') ||
      currentUser.permissions.includes('tasks.*') ||
      currentUser.permissions.includes('tasks.view') ||
      currentUser.permissions.includes('housekeeping.*') ||
      currentUser.permissions.includes('housekeeping.view');

    if (!canListUsers) {
      return NextResponse.json(
        { error: 'Permission denied.' },
        { status: 403 }
      );
    }

    // Parse query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const filterRole = searchParams.get('role');
    const filterDepartment = searchParams.get('department');
    const filterPermission = searchParams.get('permission');
    const filterStatus = searchParams.get('status');
    const filterTenantId = searchParams.get('tenantId');

    // Build where clause with filters
    // Platform admins can optionally filter by tenantId, otherwise see all tenants
    // Tenant admins ONLY see their own tenant
    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (currentUser.isPlatformAdmin) {
      // Platform admin: optionally filter by tenant, or show all
      if (filterTenantId) {
        where.tenantId = filterTenantId;
      }
      // If no tenantId filter, show all tenants (no tenantId constraint)
    } else {
      // Non-platform-admin: ALWAYS scope to own tenant (security critical)
      where.tenantId = currentUser.tenantId;
      // SECURITY: Never expose platform admin users to tenant admins
      where.isPlatformAdmin = false;
    }

    if (filterRole) {
      where.role = {
        name: filterRole,
      };
    }

    // Department filter: PostgreSQL supports mode:'insensitive', but we
    // apply post-filter for consistency with other filtering logic.
    // (filterDepartment is handled via post-filter below)

    if (filterStatus) {
      where.status = filterStatus;
    }

    // Permission-based filtering: fetch users whose role has the specified permission
    let users;
    if (filterPermission) {
      const allUsers = await db.user.findMany({
        where,
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
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Filter users whose role has the required permission or wildcard
      users = allUsers.filter((u) => {
        if (!u.role?.permissions) return false;
        try {
          const perms: string[] = JSON.parse(u.role.permissions);
          return (
            perms.includes('*') ||
            perms.includes(filterPermission) ||
            perms.some((p) => filterPermission.startsWith(p.replace('.*', '')) && p.endsWith('.*'))
          );
        } catch {
          return false;
        }
      });
    } else {
      users = await db.user.findMany({
        where,
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
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    // Post-filter: case-insensitive department match
    if (filterDepartment) {
      const deptLower = filterDepartment.toLowerCase();
      users = users.filter((u) =>
        u.department?.toLowerCase().includes(deptLower)
      );
    }

    return NextResponse.json({ success: true, users, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/users - Create new user
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(currentUser, ['users.create', 'users.manage', 'admin.users', 'admin.*'])) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Permission check - only admins can create users
    if (
      !currentUser.isPlatformAdmin &&
      currentUser.roleName !== 'admin' &&
      !currentUser.permissions.includes('*')
    ) {
      return NextResponse.json(
        { error: 'Permission denied. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      email,
      firstName,
      lastName,
      phone,
      jobTitle,
      department,
      roleId,
      status,
      password,
      tenantId: requestedTenantId,
      isPlatformAdmin: requestedIsPlatformAdmin,
      propertyAssignments,
    } = body;

    // Non-platform-admins cannot assign admin or platform_admin roles
    // Also verify the role belongs to the same tenant (prevent cross-tenant role assignment)
    if (roleId) {
      const targetRole = await db.role.findUnique({
        where: { id: roleId },
        select: { name: true, tenantId: true },
      });
      if (!targetRole) {
        return NextResponse.json(
          { error: 'Role not found' },
          { status: 400 }
        );
      }
      // Verify role belongs to the same tenant (security critical)
      if (!currentUser.isPlatformAdmin && targetRole.tenantId !== currentUser.tenantId) {
        return NextResponse.json(
          { error: 'Permission denied. Cannot assign a role from another tenant.' },
          { status: 403 }
        );
      }
      if (!currentUser.isPlatformAdmin && (targetRole.name === 'admin' || targetRole.name === 'platform_admin')) {
        return NextResponse.json(
          { error: 'Permission denied. Cannot assign admin-level roles.' },
          { status: 403 }
        );
      }
    }

    // Determine the target tenant
    // Platform admin can specify tenantId; tenant admin always uses their own
    let tenantId: string;
    if (currentUser.isPlatformAdmin && requestedTenantId) {
      // Platform admin: validate the requested tenant exists
      const targetTenant = await db.tenant.findUnique({
        where: { id: requestedTenantId },
      });
      if (!targetTenant) {
        return NextResponse.json(
          { error: 'Specified tenant not found' },
          { status: 400 }
        );
      }
      tenantId = requestedTenantId;
    } else if (currentUser.isPlatformAdmin) {
      // Platform admin without explicit tenantId: use their own tenant
      tenantId = currentUser.tenantId;
    } else {
      // Non-platform-admin: ALWAYS use their own tenant (security critical)
      tenantId = currentUser.tenantId;
    }

    // Determine isPlatformAdmin
    // Only platform admins can set isPlatformAdmin on new users
    let newIsPlatformAdmin = false;
    if (currentUser.isPlatformAdmin && requestedIsPlatformAdmin === true) {
      newIsPlatformAdmin = true;
    }
    // Tenant admin: isPlatformAdmin is ALWAYS false (not even read from request)

    // Validate required fields
    if (!email || !firstName || !lastName || !password) {
      return NextResponse.json(
        { error: 'Email, first name, last name, and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db.user.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: { message: passwordValidation.errors.join(', ') } },
        { status: 400 }
      );
    }

    // Hash password securely with bcrypt
    const passwordHash = await hashPassword(password);

    // Validate property assignments if provided
    if (Array.isArray(propertyAssignments) && propertyAssignments.length > 0) {
      // Verify all propertyIds belong to the same tenant
      const propertyIds = propertyAssignments.map((a: { propertyId: string }) => a.propertyId);
      const properties = await db.property.findMany({
        where: {
          id: { in: propertyIds },
          tenantId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (properties.length !== propertyIds.length) {
        const foundIds = new Set(properties.map((p) => p.id));
        const missingIds = propertyIds.filter((id: string) => !foundIds.has(id));
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

    // Create user with property assignments in a transaction
    const user = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          tenantId,
          email: email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
          phone: phone || null,
          jobTitle: jobTitle || null,
          department: department || null,
          roleId: roleId || null,
          status: status || 'active',
          isVerified: false,
          isPlatformAdmin: newIsPlatformAdmin,
        },
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

      // Create property assignments
      if (Array.isArray(propertyAssignments) && propertyAssignments.length > 0) {
        for (const assignment of propertyAssignments) {
          await tx.userProperty.create({
            data: {
              tenantId,
              userId: newUser.id,
              propertyId: assignment.propertyId,
              role: assignment.role || 'staff',
              isDefault: assignment.isDefault || false,
            },
          });
        }
      }

      // Re-fetch with assignments
      return tx.user.findUnique({
        where: { id: newUser.id },
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
      await logUser(request, 'create', user!.id, undefined, {
        email: user!.email,
        firstName: user!.firstName,
        lastName: user!.lastName,
        roleId: user!.roleId,
        isPlatformAdmin: user!.isPlatformAdmin,
        propertyAssignmentCount: Array.isArray(propertyAssignments) ? propertyAssignments.length : 0,
      }, { tenantId, userId: currentUser.id });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
