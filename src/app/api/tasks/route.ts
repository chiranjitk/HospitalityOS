import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { notifyTaskAssigned } from '@/lib/notify';
import { nullifyEmptyStrings } from '@/lib/nullify-empty-strings';
import { auditLogService } from '@/lib/services/audit-service';

// GET /api/tasks - List all tasks with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // RBAC check
    if (!hasPermission(currentUser, 'tasks.view') && !hasPermission(currentUser, 'tasks.*') && !hasPermission(currentUser, 'housekeeping.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const roomId = searchParams.get('roomId');
    const assignedTo = searchParams.get('assignedTo');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const scheduledFrom = searchParams.get('scheduledFrom');
    const scheduledTo = searchParams.get('scheduledTo');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = {
      tenantId: currentUser.tenantId,
      deletedAt: null,
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (roomId) {
      where.roomId = roomId;
    }

    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (category) {
      where.category = category;
    }

    if (priority) {
      where.priority = priority;
    }

    if (scheduledFrom || scheduledTo) {
      where.scheduledAt = {};
      if (scheduledFrom) {
        (where.scheduledAt as Record<string, unknown>).gte = new Date(scheduledFrom);
      }
      if (scheduledTo) {
        (where.scheduledAt as Record<string, unknown>).lte = new Date(scheduledTo);
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search,  } },
        { description: { contains: search,  } },
      ];
    }

    const tasks = await db.task.findMany({
      where,
      include: {
        room: {
          select: {
            id: true,
            number: true,
            floor: true,
            status: true,
            roomType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            jobTitle: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { scheduledAt: 'asc' },
        { createdAt: 'desc' },
      ],
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.task.count({ where });

    // Calculate summary statistics
    const statusCounts = await db.task.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    const priorityCounts = await db.task.groupBy({
      by: ['priority'],
      where,
      _count: {
        id: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: tasks,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        byStatus: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        byPriority: priorityCounts.reduce((acc, item) => {
          acc[item.priority] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tasks' } },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // RBAC check
    if (!hasPermission(currentUser, 'tasks.create') && !hasPermission(currentUser, 'tasks.*') && !hasPermission(currentUser, 'housekeeping.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = nullifyEmptyStrings(body);

    const {
      propertyId,
      roomId,
      assignedTo,
      type,
      category,
      title,
      description,
      priority = 'medium',
      status = 'pending',
      scheduledAt,
      estimatedDuration,
      notes,
      attachments,
      isRecurring = false,
      recurrenceRule,
      roomStatusBefore,
    } = data;

    // Validate required fields
    if (!propertyId || !type || !category || !title) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, type, category, title' } },
        { status: 400 }
      );
    }

    // GAP-FIX(17b): Validate title is not empty/whitespace-only
    if (!title.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'title must not be empty' } },
        { status: 400 }
      );
    }

    // GAP-FIX(17b): Validate title length
    if (title.length > 500) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'title must not exceed 500 characters' } },
        { status: 400 }
      );
    }

    // GAP-FIX(17b): Validate priority against valid values
    const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` } },
        { status: 400 }
      );
    }

    // GAP-FIX(17b): Validate status against valid values
    const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `status must be one of: ${VALID_STATUSES.join(', ')}` } },
        { status: 400 }
      );
    }

    // Verify property exists and belongs to user's tenant
    // GAP-FIX(17b): Added tenant ownership check on property
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: currentUser.tenantId, deletedAt: null },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
        { status: 400 }
      );
    }

    // If room is specified, verify it exists and belongs to the property/tenant
    // GAP-FIX(17b): Added propertyId check to prevent cross-tenant room assignment
    if (roomId) {
      const room = await db.room.findFirst({
        where: { id: roomId, propertyId, deletedAt: null },
      });

      if (!room) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ROOM', message: 'Room not found for this property' } },
          { status: 400 }
        );
      }
    }

    // If assigned to a user, verify they exist, belong to the same tenant, and have housekeeping role
    // GAP-FIX(17b): Added tenantId check to prevent cross-tenant task assignment
    if (assignedTo) {
      const user = await db.user.findFirst({
        where: { id: assignedTo, tenantId: currentUser.tenantId, deletedAt: null },
        include: {
          role: {
            select: { name: true, permissions: true },
          },
        },
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_USER', message: 'Assigned user not found' } },
          { status: 400 }
        );
      }

      // Verify the user has housekeeping-related role or permissions
      let isHousekeepingStaff = user.role?.name === 'housekeeping';
      if (!isHousekeepingStaff && user.role?.permissions) {
        try {
          const perms: string[] = JSON.parse(user.role.permissions);
          isHousekeepingStaff =
            perms.includes('*') ||
            perms.includes('tasks.*') ||
            perms.includes('housekeeping.*') ||
            perms.some((p) => p.startsWith('tasks.') || p.startsWith('housekeeping.'));
        } catch {
          // ignore parse errors
        }
      }

      if (!isHousekeepingStaff) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ASSIGNEE', message: 'Task can only be assigned to housekeeping staff' } },
          { status: 400 }
        );
      }
    }

    const task = await db.task.create({
      data: {
        tenantId: currentUser.tenantId,
        createdBy: currentUser.id,
        propertyId,
        roomId,
        assignedTo: assignedTo || null,
        type,
        category,
        title,
        description,
        priority,
        status,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        estimatedDuration,
        notes,
        attachments: attachments || '[]',
        isRecurring,
        recurrenceRule,
        roomStatusBefore,
      },
      include: {
        room: {
          select: {
            id: true,
            number: true,
            floor: true,
            status: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            jobTitle: true,
          },
        },
      },
    });

    if (task.assignedTo) {
      notifyTaskAssigned({
        tenantId: task.tenantId,
        assigneeUserId: task.assignedTo,
        taskTitle: task.title,
        taskPriority: task.priority || 'medium',
        roomNumber: task.room?.number,
      });
    }

    // Audit log
    try {
      await auditLogService.logWithContext(
        {
          tenantId: currentUser.tenantId,
          userId: currentUser.id,
          module: 'admin',
          action: 'create',
          entityType: 'task',
          entityId: task.id,
          newValue: {
            title: task.title,
            type: task.type,
            category: task.category,
            priority: task.priority,
            status: task.status,
            propertyId: task.propertyId,
            roomId: task.roomId,
            assignedTo: task.assignedTo,
            scheduledAt: task.scheduledAt,
            isRecurring: task.isRecurring,
          },
          description: `Created task "${task.title}" (${task.type}/${task.category})`,
        },
        request
      );
    } catch (auditError) {
      console.error('Audit log failed for task create:', auditError);
    }

    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create task' } },
      { status: 500 }
    );
  }
}
