import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/staff/performance — fetch dashboard metrics, reviews, goals
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'staff.view') && !hasPermission(user, 'performance.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view staff performance' } },
        { status: 403 }
      );
    }

    const sp = request.nextUrl.searchParams;
    const days = parseInt(sp.get('days') || '30', 10);
    const department = sp.get('department');
    const staffId = sp.get('staffId');
    const action = sp.get('action'); // 'reviews' | 'goals' | 'dashboard'
    const reviewYear = sp.get('reviewYear');

    const tenantId = user.tenantId;

    // ---- Action: Fetch performance reviews ----
    if (action === 'reviews') {
      const where: Record<string, unknown> = { tenantId };
      if (staffId) where.userId = staffId;
      if (reviewYear) where.reviewYear = parseInt(reviewYear, 10);

      const reviews = await db.staffPerformance.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, department: true, jobTitle: true },
          },
        },
        orderBy: [{ reviewYear: 'desc' }, { reviewDate: 'desc' }],
      });

      return NextResponse.json({
        success: true,
        data: reviews,
      });
    }

    // ---- Action: Fetch goals (stored as Tasks with type=goal) ----
    if (action === 'goals') {
      const where: Record<string, unknown> = { tenantId, type: 'goal' };
      if (staffId) where.assignedTo = staffId;
      if (department && department !== 'all') {
        // Find users in that department
        const deptUsers = await db.user.findMany({
          where: { tenantId, department, deletedAt: null },
          select: { id: true },
        });
        where.assignedTo = { in: deptUsers.map((u) => u.id) };
      }

      const goals = await db.task.findMany({
        where,
        include: {
          assignee: {
            select: { id: true, firstName: true, lastName: true, department: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      });

      return NextResponse.json({
        success: true,
        data: goals,
      });
    }

    // ---- Default: Dashboard metrics ----
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Math.min(days, 365));
    startDate.setHours(0, 0, 0, 0);

    // User filter
    const userWhere: Record<string, unknown> = { tenantId, deletedAt: null };
    if (department && department !== 'all') userWhere.department = department;
    if (staffId) userWhere.id = staffId;

    const users = await db.user.findMany({
      where: userWhere,
      include: { role: { select: { name: true } } },
    });
    const totalStaff = await db.user.count({ where: userWhere });

    // Tasks
    const tasks = await db.task.findMany({
      where: { tenantId, createdAt: { gte: startDate } },
    });

    // Attendance
    const attendanceRecords = await db.staffAttendance.findMany({
      where: { tenantId, date: { gte: startDate } },
    });

    // Performance reviews
    const reviews = await db.staffPerformance.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, firstName: true, lastName: true, department: true } } },
    });

    // Active today
    const activeToday = users.filter(
      (u) => u.lastLoginAt && new Date(u.lastLoginAt).toDateString() === new Date().toDateString()
    ).length;

    const tasksCompleted = tasks.filter((t) => t.status === 'completed').length;

    // Avg completion time
    const completedTasks = tasks.filter((t) => t.status === 'completed' && t.completedAt);
    let avgResponseTime = 0;
    if (completedTasks.length > 0) {
      const totalTime = completedTasks.reduce((sum, t) => {
        return sum + (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime());
      }, 0);
      avgResponseTime = Math.round(totalTime / completedTasks.length / (1000 * 60));
    }

    // Attendance rate
    let attendanceRate = 100;
    if (attendanceRecords.length > 0) {
      const present = attendanceRecords.filter(
        (a) => a.status === 'present' || a.status === 'late'
      ).length;
      attendanceRate = Math.round((present / attendanceRecords.length) * 100);
    }

    // On-time rate
    let onTimeRate = 100;
    const lateRecords = attendanceRecords.filter((a) => a.lateMinutes > 0);
    if (attendanceRecords.length > 0) {
      onTimeRate = Math.round(((attendanceRecords.length - lateRecords.length) / attendanceRecords.length) * 100);
    }

    // Avg rating from reviews
    const ratedReviews = reviews.filter((r) => r.overallRating != null);
    const avgRating =
      ratedReviews.length > 0
        ? Math.round((ratedReviews.reduce((s, r) => s + r.overallRating!, 0) / ratedReviews.length) * 10) / 10
        : 0;

    // Staff list with metrics
    const staffList = users.map((userItem) => {
      const userTasks = tasks.filter((t) => t.assignedTo === userItem.id);
      const completed = userTasks.filter((t) => t.status === 'completed').length;
      const inProgress = userTasks.filter((t) => t.status === 'in_progress').length;

      const userCompletedTasks = userTasks.filter((t) => t.status === 'completed' && t.completedAt);
      let avgCompletionTime = 0;
      if (userCompletedTasks.length > 0) {
        const totalTime = userCompletedTasks.reduce((sum, t) => {
          return sum + (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime());
        }, 0);
        avgCompletionTime = Math.round(totalTime / userCompletedTasks.length / (1000 * 60));
      }

      const userAttendance = attendanceRecords.filter((a) => a.userId === userItem.id);
      const totalDays = userAttendance.length;
      const presentDays = userAttendance.filter(
        (a) => a.status === 'present' || a.status === 'late'
      ).length;
      const attendance = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

      const taskScore = completed * 10;
      const timeScore = avgCompletionTime > 0 ? Math.max(0, 100 - avgCompletionTime) : 50;
      const performance = Math.min(100, Math.round((taskScore + timeScore + attendance) / 3));
      const rating = 3.0 + (performance / 100) * 2.0;

      const userReviews = reviews.filter((r) => r.userId === userItem.id);
      const latestReview = userReviews[0];

      return {
        id: userItem.id,
        name: `${userItem.firstName} ${userItem.lastName}`,
        role: userItem.role?.name || 'Staff',
        department: userItem.department || 'General',
        rating: Math.round(rating * 10) / 10,
        reviewRating: latestReview?.overallRating ?? null,
        tasksCompleted: completed,
        tasksInProgress: inProgress,
        avgCompletionTime,
        attendance,
        performance,
        reviewStatus: latestReview?.status ?? null,
        latestReviewId: latestReview?.id ?? null,
      };
    });

    // Department stats
    const departmentRows = await db.user.findMany({
      where: { tenantId, deletedAt: null, department: { not: null } },
      select: { department: true },
      distinct: ['department'],
    });
    const departments = departmentRows.map((r) => r.department).filter((d): d is string => Boolean(d));

    const departmentStats = departments.map((dept) => {
      const deptStaff = staffList.filter((s) => s.department === dept);
      const deptTasks = tasks.filter((t) =>
        staffList.find((s) => s.id === t.assignedTo)?.department === dept
      );

      return {
        department: dept,
        staff: deptStaff.length,
        tasksCompleted: deptTasks.filter((t) => t.status === 'completed').length,
        avgRating:
          deptStaff.length > 0
            ? Math.round((deptStaff.reduce((sum, s) => sum + s.rating, 0) / deptStaff.length) * 10) / 10
            : 0,
        efficiency:
          deptStaff.length > 0
            ? Math.round(deptStaff.reduce((sum, s) => sum + s.performance, 0) / deptStaff.length)
            : 0,
      };
    });

    // Weekly trend
    const weeklyTrend: Array<{ day: string; completed: number; pending: number; inProgress: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

      const dayTasks = tasks.filter(
        (t) => new Date(t.createdAt) >= dayStart && new Date(t.createdAt) <= dayEnd
      );

      weeklyTrend.push({
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
        completed: dayTasks.filter((t) => t.status === 'completed').length,
        pending: dayTasks.filter((t) => t.status === 'pending').length,
        inProgress: dayTasks.filter((t) => t.status === 'in_progress').length,
      });
    }

    // Goals summary (count of goal-type tasks)
    const goalsSummary = {
      total: tasks.filter((t) => t.type === 'goal').length,
      completed: tasks.filter((t) => t.type === 'goal' && t.status === 'completed').length,
      inProgress: tasks.filter((t) => t.type === 'goal' && t.status === 'in_progress').length,
      atRisk: tasks.filter((t) => t.type === 'goal' && t.status === 'at_risk').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        totalStaff,
        activeToday,
        avgRating,
        tasksCompleted,
        avgResponseTime,
        attendanceRate,
        onTimeRate,
        goalsSummary,
        staffList: staffList.sort((a, b) => b.performance - a.performance),
        departmentStats: departmentStats.filter((d) => d.staff > 0),
        weeklyTrend,
        departments,
      },
    });
  } catch (error) {
    console.error('Error fetching staff performance:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch staff performance' } },
      { status: 500 }
    );
  }
}

// POST /api/staff/performance — create review or goal
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'staff.manage') && !hasPermission(user, 'performance.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'review') {
      const {
        userId,
        reviewPeriod,
        reviewYear,
        overallRating,
        punctualityRating,
        qualityRating,
        teamworkRating,
        communicationRating,
        initiativeRating,
        tasksCompleted,
        avgResponseTime,
        attendanceRate,
        customerRating,
        goalsSet,
        goalsAchieved,
        goalsComments,
        strengths,
        areasOfImprovement,
        achievements,
        employeeComments,
        nextReviewDate,
        status,
      } = body;

      if (!userId || !reviewPeriod || !reviewYear) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'userId, reviewPeriod, and reviewYear are required' } },
          { status: 400 }
        );
      }

      // Check for existing review (unique constraint)
      const existing = await db.staffPerformance.findUnique({
        where: {
          userId_reviewPeriod_reviewYear: {
            userId,
            reviewPeriod,
            reviewYear: parseInt(reviewYear, 10),
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: { code: 'CONFLICT', message: 'A review for this staff member and period already exists' } },
          { status: 409 }
        );
      }

      const review = await db.staffPerformance.create({
        data: {
          tenantId: user.tenantId,
          userId,
          reviewPeriod,
          reviewYear: parseInt(reviewYear, 10),
          reviewDate: new Date(),
          overallRating: overallRating ?? null,
          punctualityRating: punctualityRating ?? null,
          qualityRating: qualityRating ?? null,
          teamworkRating: teamworkRating ?? null,
          communicationRating: communicationRating ?? null,
          initiativeRating: initiativeRating ?? null,
          tasksCompleted: tasksCompleted ?? 0,
          avgResponseTime: avgResponseTime ?? null,
          attendanceRate: attendanceRate ?? null,
          customerRating: customerRating ?? null,
          goalsSet: goalsSet ?? 0,
          goalsAchieved: goalsAchieved ?? 0,
          goalsComments: goalsComments ?? null,
          strengths: strengths ?? null,
          areasOfImprovement: areasOfImprovement ?? null,
          achievements: achievements ?? null,
          reviewedBy: user.id,
          employeeComments: employeeComments ?? null,
          nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : null,
          status: status || 'draft',
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, department: true, jobTitle: true },
          },
        },
      });

      return NextResponse.json({ success: true, data: review }, { status: 201 });
    }

    if (action === 'goal') {
      const {
        assignedTo,
        propertyId,
        title,
        description,
        priority,
        status,
        deadline,
        category,
        estimatedDuration,
      } = body;

      if (!assignedTo || !title) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'assignedTo and title are required' } },
          { status: 400 }
        );
      }

      // Get a propertyId if not provided
      let goalPropertyId = propertyId;
      if (!goalPropertyId) {
        const firstProperty = await db.property.findFirst({
          where: { tenantId: user.tenantId },
          select: { id: true },
        });
        goalPropertyId = firstProperty?.id;
      }

      if (!goalPropertyId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'No property found for this tenant' } },
          { status: 400 }
        );
      }

      const goal = await db.task.create({
        data: {
          tenantId: user.tenantId,
          propertyId: goalPropertyId,
          assignedTo,
          type: 'goal',
          category: category || 'operational',
          title,
          description: description || null,
          priority: priority || 'medium',
          status: status || 'not_started',
          deadline: deadline ? new Date(deadline) : null,
          estimatedDuration: estimatedDuration ?? null,
          createdBy: user.id,
        },
        include: {
          assignee: {
            select: { id: true, firstName: true, lastName: true, department: true },
          },
        },
      });

      return NextResponse.json({ success: true, data: goal }, { status: 201 });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Action must be "review" or "goal"' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error creating performance record:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create performance record' } },
      { status: 500 }
    );
  }
}

// PUT /api/staff/performance — update review or goal
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'staff.manage') && !hasPermission(user, 'performance.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Record id is required' } },
        { status: 400 }
      );
    }

    if (action === 'review') {
      const {
        overallRating,
        punctualityRating,
        qualityRating,
        teamworkRating,
        communicationRating,
        initiativeRating,
        tasksCompleted,
        avgResponseTime,
        attendanceRate,
        customerRating,
        goalsSet,
        goalsAchieved,
        goalsComments,
        strengths,
        areasOfImprovement,
        achievements,
        employeeComments,
        nextReviewDate,
        status,
      } = body;

      // Calculate overall if not provided
      let calculatedOverall = overallRating;
      if (!calculatedOverall) {
        const ratings = [punctualityRating, qualityRating, teamworkRating, communicationRating, initiativeRating].filter(
          (r): r is number => r != null
        );
        if (ratings.length > 0) {
          calculatedOverall = Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10;
        }
      }

      const review = await db.staffPerformance.update({
        where: { id },
        data: {
          ...(overallRating != null && { overallRating }),
          ...(punctualityRating != null && { punctualityRating }),
          ...(qualityRating != null && { qualityRating }),
          ...(teamworkRating != null && { teamworkRating }),
          ...(communicationRating != null && { communicationRating }),
          ...(initiativeRating != null && { initiativeRating }),
          ...(tasksCompleted != null && { tasksCompleted }),
          ...(avgResponseTime != null && { avgResponseTime }),
          ...(attendanceRate != null && { attendanceRate }),
          ...(customerRating != null && { customerRating }),
          ...(goalsSet != null && { goalsSet }),
          ...(goalsAchieved != null && { goalsAchieved }),
          ...(goalsComments != null && { goalsComments }),
          ...(strengths != null && { strengths }),
          ...(areasOfImprovement != null && { areasOfImprovement }),
          ...(achievements != null && { achievements }),
          ...(employeeComments != null && { employeeComments }),
          ...(nextReviewDate != null && { nextReviewDate: new Date(nextReviewDate) }),
          ...(status && { status }),
          ...(calculatedOverall && !overallRating && { overallRating: calculatedOverall }),
          ...(status === 'submitted' && { reviewedBy: user.id }),
          ...(status === 'acknowledged' && { acknowledgedAt: new Date() }),
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, department: true, jobTitle: true },
          },
        },
      });

      return NextResponse.json({ success: true, data: review });
    }

    if (action === 'goal') {
      const { title, description, priority, status: goalStatus, deadline, category, estimatedDuration, notes, completionNotes } = body;

      const updateData: Record<string, unknown> = {};
      if (title != null) updateData.title = title;
      if (description != null) updateData.description = description;
      if (priority != null) updateData.priority = priority;
      if (goalStatus != null) {
        updateData.status = goalStatus;
        if (goalStatus === 'in_progress') updateData.startedAt = new Date();
        if (goalStatus === 'completed') updateData.completedAt = new Date();
      }
      if (deadline != null) updateData.deadline = new Date(deadline);
      if (category != null) updateData.category = category;
      if (estimatedDuration != null) updateData.estimatedDuration = estimatedDuration;
      if (notes != null) updateData.notes = notes;
      if (completionNotes != null) updateData.completionNotes = completionNotes;

      const goal = await db.task.update({
        where: { id },
        data: updateData,
        include: {
          assignee: {
            select: { id: true, firstName: true, lastName: true, department: true },
          },
        },
      });

      return NextResponse.json({ success: true, data: goal });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Action must be "review" or "goal"' } },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('Error updating performance record:', error);
    const msg = error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025'
      ? 'Record not found'
      : 'Failed to update performance record';
    const status = error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025' ? 404 : 500;
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: msg } },
      { status }
    );
  }
}
