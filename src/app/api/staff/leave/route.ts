import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { differenceInCalendarDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { getLeaveBalanceConfig, getUserLeaveBalance, DEFAULT_LEAVE_BALANCES, LEAVE_TYPES } from '@/lib/staff/leave-config';

// Valid leave durations (M-71: includes half_day)
const VALID_DURATIONS = ['full_day', 'half_day', 'half_day_am', 'half_day_pm'] as const;
type LeaveDuration = (typeof VALID_DURATIONS)[number];

// GET /api/staff/leave - List leave requests
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'staff.view') && !hasPermission(user, 'leaves.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const leaveType = searchParams.get('leaveType');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (status) where.status = status;
    if (department) where.user = { ...((where.user as Record<string, unknown>) || {}), department };
    if (userId) where.userId = userId;
    if (leaveType) where.leaveType = leaveType;

    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) (where.startDate as Record<string, unknown>).gte = startOfDay(parseISO(startDate));
      if (endDate) (where.startDate as Record<string, unknown>).lte = endOfDay(parseISO(endDate));
    }

    const [leaves, total] = await Promise.all([
      db.staffLeave.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              jobTitle: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.staffLeave.count({ where }),
    ]);

    // Fetch approver names for leaves that have been approved/rejected
    const approverIds = leaves
      .map(l => l.approvedBy)
      .filter((id): id is string => !!id);
    let approvers: Record<string, { id: string; firstName: string; lastName: string } | null> = {};
    if (approverIds.length > 0) {
      const approverUsers = await db.user.findMany({
        where: { id: { in: approverIds } },
        select: { id: true, firstName: true, lastName: true },
      });
      approvers = Object.fromEntries(approverUsers.map(u => [u.id, u]));
    }

    // Calculate leave balances from DB config (M-70: configurable limits, M-71: carry-forward)
    const isManager = hasPermission(user, 'staff.manage') || hasPermission(user, 'leaves.approve');
    const balanceTargetUserId = isManager && !userId ? null : (userId || user.id);

    let leaveBalances: Record<string, Record<string, { total: number; used: number; remaining: number; carried: number }>> = {};

    if (balanceTargetUserId) {
      const now = new Date();
      const year = now.getFullYear();
      const balances = await getUserLeaveBalance(user.tenantId, balanceTargetUserId, year);

      leaveBalances[balanceTargetUserId] = {};
      for (const [type, bal] of Object.entries(balances)) {
        leaveBalances[balanceTargetUserId][type] = {
          total: bal.total,
          used: bal.used,
          carried: bal.carried,
          remaining: bal.remaining,
        };
      }
    }

    // Stats
    const stats = await db.staffLeave.groupBy({
      by: ['status'],
      where: { tenantId: user.tenantId },
      _count: true,
    });

    const statusCounts = stats.reduce((acc, s) => {
      acc[s.status] = s._count;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      leaves: leaves.map(l => ({
        id: l.id,
        userId: l.userId,
        leaveType: l.leaveType,
        startDate: l.startDate.toISOString(),
        endDate: l.endDate.toISOString(),
        totalDays: l.totalDays,
        duration: (l as Record<string, unknown>).duration || 'full_day',
        reason: l.reason,
        status: l.status,
        rejectionReason: l.rejectionReason,
        notes: l.notes,
        approvedBy: l.approvedBy,
        approvedAt: l.approvedAt?.toISOString(),
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
        staff: l.user ? {
          id: l.user.id,
          name: `${l.user.firstName} ${l.user.lastName}`,
          email: l.user.email,
          department: l.user.department,
          jobTitle: l.user.jobTitle,
          avatar: l.user.avatar,
        } : null,
        approver: l.approvedBy ? (approvers[l.approvedBy] ? {
          id: approvers[l.approvedBy].id,
          name: `${approvers[l.approvedBy].firstName} ${approvers[l.approvedBy].lastName}`,
        } : null) : null,
      })),
      balances: leaveBalances,
      stats: statusCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch leave requests' } },
      { status: 500 }
    );
  }
}

// POST /api/staff/leave - Create a leave request (supports half-day and carry-forward)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { leaveType, startDate, endDate, reason, notes, duration } = body;

    if (!leaveType || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Leave type, start date, and end date are required' } },
        { status: 400 }
      );
    }

    const validTypes = ['sick', 'vacation', 'personal', 'maternity', 'other'];
    if (!validTypes.includes(leaveType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid leave type. Must be one of: ${validTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate duration (M-71: half-day support)
    const leaveDuration: LeaveDuration = duration && VALID_DURATIONS.includes(duration)
      ? (duration as LeaveDuration)
      : 'full_day';

    const start = parseISO(startDate);
    const end = parseISO(endDate);

    if (start > end) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Start date must be before end date' } },
        { status: 400 }
      );
    }

    // Prevent past-date leave creation (start date must be today or later)
    const todayStart = startOfDay(new Date());
    if (startOfDay(start) < todayStart) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Cannot create leave requests for past dates' } },
        { status: 400 }
      );
    }

    // Calculate total days — half-day leaves deduct 0.5
    let totalDays: number;
    if (leaveDuration !== 'full_day') {
      // Half-day leave: must be a single day, deducts 0.5
      totalDays = 0.5;
    } else {
      totalDays = differenceInCalendarDays(end, start) + 1;
    }

    // Check for overlapping leave
    const overlapping = await db.staffLeave.findFirst({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
        status: { in: ['pending', 'approved'] },
        startDate: { lte: endOfDay(end) },
        endDate: { gte: startOfDay(start) },
      },
    });

    if (overlapping) {
      return NextResponse.json(
        { success: false, error: { code: 'OVERLAP', message: 'You already have a pending or approved leave request for this period' } },
        { status: 400 }
      );
    }

    // Check leave balance using DB config (M-70: configurable limits)
    const now = new Date();
    const year = now.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    const existingLeaves = await db.staffLeave.findMany({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
        leaveType,
        status: { in: ['approved', 'pending'] },
        startDate: { gte: yearStart, lte: yearEnd },
      },
    });

    const usedDays = existingLeaves.reduce((sum, l) => sum + l.totalDays, 0);

    // Load balance from DB config with carry-forward (M-70, M-71)
    const balanceConfig = await getLeaveBalanceConfig(user.tenantId);
    const balanceLimit = balanceConfig.balances[leaveType] || DEFAULT_LEAVE_BALANCES[leaveType] || 0;

    // Account for carry-forward (M-71)
    let carryForwardAvailable = 0;
    if (balanceConfig.carryForwardEnabled) {
      const carryForwards = await db.leaveCarryForward.findMany({
        where: {
          tenantId: user.tenantId,
          userId: user.id,
          leaveType,
          toYear: year,
        },
      });
      for (const cf of carryForwards) {
        const available = cf.carriedDays - cf.usedDays;
        if (available > 0) carryForwardAvailable += available;
      }
    }

    const effectiveLimit = balanceLimit + carryForwardAvailable;

    if (usedDays + totalDays > effectiveLimit) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_BALANCE', message: `Insufficient leave balance. You have ${Math.max(0, effectiveLimit - usedDays).toFixed(1)} days remaining for ${leaveType} leave (includes ${(carryForwardAvailable).toFixed(1)} carried forward)` } },
        { status: 400 }
      );
    }

    const leave = await db.staffLeave.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        leaveType,
        startDate: startOfDay(start),
        endDate: endOfDay(end),
        totalDays,
        duration: leaveDuration,
        reason: reason || null,
        notes: notes || null,
        status: 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            jobTitle: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      leave: {
        id: leave.id,
        userId: leave.userId,
        leaveType: leave.leaveType,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        totalDays: leave.totalDays,
        duration: (leave as Record<string, unknown>).duration || 'full_day',
        reason: leave.reason,
        status: leave.status,
        createdAt: leave.createdAt.toISOString(),
        staff: {
          id: leave.user.id,
          name: `${leave.user.firstName} ${leave.user.lastName}`,
          email: leave.user.email,
          department: leave.user.department,
          jobTitle: leave.user.jobTitle,
          avatar: leave.user.avatar,
        },
        balanceDeduction: totalDays,
        remainingBalance: Math.max(0, effectiveLimit - usedDays - totalDays),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating leave request:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create leave request' } },
      { status: 500 }
    );
  }
}

// PUT /api/staff/leave - Approve/reject leave requests
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'staff.manage') && !hasPermission(user, 'leaves.approve')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to approve/reject leave requests' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { leaveId, action, rejectionReason } = body;

    if (!leaveId || !action) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Leave ID and action are required' } },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Action must be approve or reject' } },
        { status: 400 }
      );
    }

    const leave = await db.staffLeave.findUnique({
      where: { id: leaveId, tenantId: user.tenantId },
    });

    if (!leave) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Leave request not found' } },
        { status: 404 }
      );
    }

    if (leave.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: `Cannot ${action} a leave request that is ${leave.status}` } },
        { status: 400 }
      );
    }

    // Departmental authority check: approver must manage the same department as the requester
    const leaveUser = await db.user.findUnique({
      where: { id: leave.userId },
      select: { department: true },
    });
    if (leaveUser && leaveUser.department && user.department && leaveUser.department !== user.department) {
      const isGlobalApprover = hasPermission(user, 'staff.manage');
      if (!isGlobalApprover) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'You can only approve leave requests for staff in your department' } },
          { status: 403 }
        );
      }
    }

    // Use transaction to re-check balance before approval (M-70: DB-configurable limits)
    const updated = await db.$transaction(async (tx) => {
      const now = new Date();
      const year = now.getFullYear();
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      const usedDays = await tx.staffLeave.aggregate({
        where: {
          tenantId: user.tenantId,
          userId: leave.userId,
          leaveType: leave.leaveType,
          status: { in: ['approved'] },
          startDate: { gte: yearStart, lte: yearEnd },
          id: { not: leave.id },
        },
        _sum: { totalDays: true },
      });

      // Load from DB config (M-70)
      const config = await getLeaveBalanceConfig(user.tenantId);
      const balanceLimit = config.balances[leave.leaveType] || 0;
      const currentUsed = usedDays._sum.totalDays || 0;

      // Account for carry-forward (M-71)
      let carryForwardAvailable = 0;
      if (config.carryForwardEnabled) {
        const carryForwards = await tx.leaveCarryForward.findMany({
          where: {
            tenantId: user.tenantId,
            userId: leave.userId,
            leaveType: leave.leaveType,
            toYear: year,
          },
        });
        for (const cf of carryForwards) {
          const available = cf.carriedDays - cf.usedDays;
          if (available > 0) carryForwardAvailable += available;
        }
      }

      const effectiveLimit = balanceLimit + carryForwardAvailable;

      if (action === 'approve' && currentUsed + leave.totalDays > effectiveLimit) {
        throw new Error(`Insufficient leave balance. Only ${Math.max(0, effectiveLimit - currentUsed).toFixed(1)} days remaining.`);
      }

      return tx.staffLeave.update({
        where: { id: leaveId },
        data: {
          status: action === 'approve' ? 'approved' : 'rejected',
          approvedBy: user.id,
          approvedAt: new Date(),
          rejectionReason: action === 'reject' ? (rejectionReason || null) : null,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              jobTitle: true,
              avatar: true,
            },
          },
        },
      });
    });

    // Fetch approver user details
    let approverInfo: { id: string; name: string } | null = null;
    if (updated.approvedBy) {
      const approverUser = await db.user.findUnique({
        where: { id: updated.approvedBy },
        select: { id: true, firstName: true, lastName: true },
      });
      if (approverUser) {
        approverInfo = { id: approverUser.id, name: `${approverUser.firstName} ${approverUser.lastName}` };
      }
    }

    return NextResponse.json({
      success: true,
      leave: {
        id: updated.id,
        leaveType: updated.leaveType,
        startDate: updated.startDate.toISOString(),
        endDate: updated.endDate.toISOString(),
        totalDays: updated.totalDays,
        duration: (updated as Record<string, unknown>).duration || 'full_day',
        status: updated.status,
        rejectionReason: updated.rejectionReason,
        approvedAt: updated.approvedAt?.toISOString(),
        staff: {
          id: updated.user.id,
          name: `${updated.user.firstName} ${updated.user.lastName}`,
          email: updated.user.email,
          department: updated.user.department,
          jobTitle: updated.user.jobTitle,
          avatar: updated.user.avatar,
        },
        approver: approverInfo,
      },
    });
  } catch (error) {
    console.error('Error updating leave request:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update leave request' } },
      { status: 500 }
    );
  }
}

// DELETE /api/staff/leave - Cancel own leave request (if pending)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const leaveId = searchParams.get('id');

    if (!leaveId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Leave ID is required' } },
        { status: 400 }
      );
    }

    const leave = await db.staffLeave.findUnique({
      where: { id: leaveId, tenantId: user.tenantId },
    });

    if (!leave) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Leave request not found' } },
        { status: 404 }
      );
    }

    // Only allow cancellation of own pending requests (or admin can cancel any)
    const canCancelAny = hasPermission(user, 'staff.manage') || hasPermission(user, 'leaves.manage');
    if (leave.userId !== user.id && !canCancelAny) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You can only cancel your own leave requests' } },
        { status: 403 }
      );
    }

    if (leave.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Only pending leave requests can be cancelled' } },
        { status: 400 }
      );
    }

    await db.staffLeave.update({
      where: { id: leaveId },
      data: { status: 'cancelled' },
    });

    return NextResponse.json({
      success: true,
      message: 'Leave request cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling leave request:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel leave request' } },
      { status: 500 }
    );
  }
}
