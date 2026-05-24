import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/experience/spa - Spa & Wellness
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'experiences.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view spa data' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const dayStart = new Date(date + 'T00:00:00');
    const dayEnd = new Date(date + 'T23:59:59');
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // --- Real DB queries in parallel ---
    const [
      spaAppointments,
      spaTreatments,
      spaTherapists,
      todayStats,
      weekStats,
      monthStats,
      monthByCategory,
      revenueTrend,
    ] = await Promise.all([
      // All appointments with treatment, therapist, guest relations
      db.spaAppointment.findMany({
        where: { tenantId: user.tenantId },
        include: {
          treatment: { select: { id: true, name: true, category: true, durationMinutes: true } },
          therapist: { select: { id: true, name: true } },
          guest: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { startTime: 'asc' },
        take: 100,
      }),

      // Active treatments catalog
      db.spaTreatment.findMany({
        where: { tenantId: user.tenantId, isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),

      // All therapists
      db.spaTherapist.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { name: 'asc' },
      }),

      // Today stats
      db.spaAppointment.aggregate({
        where: {
          tenantId: user.tenantId,
          startTime: { gte: dayStart, lte: dayEnd },
        },
        _count: true,
        _sum: { price: true },
      }),

      // Week stats
      db.spaAppointment.aggregate({
        where: {
          tenantId: user.tenantId,
          startTime: { gte: weekStart },
        },
        _count: true,
        _sum: { price: true },
      }),

      // Month stats
      db.spaAppointment.aggregate({
        where: {
          tenantId: user.tenantId,
          startTime: { gte: monthStart },
        },
        _count: true,
        _sum: { price: true },
      }),

      // Month by category
      db.$queryRaw<Array<{ category: string; bookings: bigint; revenue: bigint }>>`
        SELECT t."category", COUNT(a.id)::bigint as bookings, COALESCE(SUM(a."price"), 0)::bigint as revenue
        FROM "SpaAppointment" a
        JOIN "SpaTreatment" t ON a."treatmentId" = t.id
        WHERE a."tenantId" = ${user.tenantId}::uuid
          AND a."startTime" >= ${monthStart}
        GROUP BY t."category"
        ORDER BY revenue DESC
      `,

      // Revenue trend last 14 days
      db.$queryRaw<Array<{ date: string; revenue: bigint; bookings: bigint }>>`
        SELECT DATE(a."startTime") as date, COALESCE(SUM(a."price"), 0)::bigint as revenue, COUNT(a.id)::bigint as bookings
        FROM "SpaAppointment" a
        WHERE a."tenantId" = ${user.tenantId}::uuid
          AND a."startTime" >= ${new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)}
        GROUP BY DATE(a."startTime")
        ORDER BY date ASC
      `,
    ]);

    // No-shows and cancellations this month
    const [monthNoShows, monthCancellations] = await Promise.all([
      db.spaAppointment.count({
        where: { tenantId: user.tenantId, status: 'no_show', startTime: { gte: monthStart } },
      }),
      db.spaAppointment.count({
        where: { tenantId: user.tenantId, status: 'cancelled', startTime: { gte: monthStart } },
      }),
    ]);

    // Top treatment this month
    const topTreatmentRow = await db.$queryRaw<Array<{ name: string }>>`
      SELECT t."name"
      FROM "SpaAppointment" a
      JOIN "SpaTreatment" t ON a."treatmentId" = t.id
      WHERE a."tenantId" = ${user.tenantId}::uuid
        AND a."startTime" >= ${monthStart}
      GROUP BY t."name"
      ORDER BY COUNT(a.id) DESC
      LIMIT 1
    `;

    // --- Map appointments to expected shape ---
    const appointments = spaAppointments.map(apt => ({
      id: apt.id,
      treatmentId: apt.treatmentId,
      treatmentName: (apt as Record<string, unknown>).treatment
        ? ((apt as Record<string, unknown>).treatment as Record<string, unknown>).name || ''
        : '',
      therapistId: apt.therapistId,
      therapistName: (apt as Record<string, unknown>).therapist
        ? ((apt as Record<string, unknown>).therapist as Record<string, unknown>).name || ''
        : null,
      secondTherapistId: null,
      secondTherapistName: null,
      guestId: apt.guestId,
      guestName: apt.guestId && (apt as Record<string, unknown>).guest
        ? `${((apt as Record<string, unknown>).guest as Record<string, unknown>).firstName || ''} ${((apt as Record<string, unknown>).guest as Record<string, unknown>).lastName || ''}`.trim()
        : 'External Guest',
      roomNumber: null,
      date: apt.startTime.toISOString().split('T')[0],
      startTime: apt.startTime.toTimeString().substring(0, 5),
      endTime: apt.endTime.toTimeString().substring(0, 5),
      duration: Math.round((apt.endTime.getTime() - apt.startTime.getTime()) / 60000),
      status: apt.status,
      price: apt.price,
      currency: apt.currency,
      notes: apt.specialRequests || apt.notes || '',
      location: null,
      addons: [],
    }));

    const filteredAppointments = status
      ? appointments.filter(a => a.status === status)
      : appointments.filter(a => a.date === date);

    // Calculate treatment popularity from actual completed appointments this month
    const treatmentPopularityByTreatmentId = await db.spaAppointment.groupBy({
      by: ['treatmentId'],
      where: {
        tenantId: user.tenantId,
        status: 'completed',
        startTime: { gte: monthStart },
      },
      _count: { id: true },
    });
    const maxPopularityCount = Math.max(
      1,
      ...treatmentPopularityByTreatmentId.map(tp => tp._count.id)
    );
    const popularityMap = new Map(
      treatmentPopularityByTreatmentId.map(tp => [
        tp.treatmentId,
        Math.round((tp._count.id / maxPopularityCount) * 100),
      ])
    );

    // Calculate therapist session counts from actual completed appointments this month
    const therapistSessionCounts = await db.spaAppointment.groupBy({
      by: ['therapistId'],
      where: {
        tenantId: user.tenantId,
        therapistId: { not: null },
        status: 'completed',
        startTime: { gte: monthStart },
      },
      _count: { id: true },
    });
    const sessionCountMap = new Map(
      therapistSessionCounts.map(sc => [sc.therapistId!, sc._count.id])
    );

    // --- Revenue stats (monthRevenue needed early for revenue-vs-last-month calc) ---
    const monthRevenue = Number(monthStats._sum.price || 0);

    // Calculate revenue vs last month for thisMonth.revenueVsLastMonth
    const lastMonthStart = new Date(monthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const lastMonthEnd = new Date(monthStart); // first moment of this month
    const lastMonthStats = await db.spaAppointment.aggregate({
      where: {
        tenantId: user.tenantId,
        startTime: { gte: lastMonthStart, lt: lastMonthEnd },
      },
      _sum: { price: true },
    });
    const lastMonthRevenue = Number(lastMonthStats._sum.price || 0);
    let revenueVsLastMonth: number | null = null;
    if (lastMonthRevenue > 0 && monthRevenue > 0) {
      revenueVsLastMonth = parseFloat(
        (((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
      );
    } else if (lastMonthRevenue === 0 && monthRevenue > 0) {
      revenueVsLastMonth = 100; // 100% growth from zero
    }

    // --- Map treatments ---
    const treatments = spaTreatments.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category.charAt(0).toUpperCase() + t.category.slice(1),
      duration: t.durationMinutes,
      price: t.price,
      currency: t.currency,
      description: t.description || '',
      popularity: popularityMap.get(t.id) ?? 0,
      availability: 'high',
      imageUrl: null,
      status: t.isActive ? 'active' : 'inactive',
    }));

    // --- Map therapists ---
    const therapists = spaTherapists.map(t => {
      let specs: string[] = [];
      let certs: string[] = [];
      try { specs = JSON.parse(t.specializations); } catch { /* use defaults */ }
      try { certs = JSON.parse(t.certifications); } catch { /* use defaults */ }

      return {
        id: t.id,
        name: t.name,
        specialization: Array.isArray(specs) ? specs : [t.specializations],
        certifications: Array.isArray(certs) ? certs : [t.certifications],
        experience: null, // No experience field in SpaTherapist schema
        rating: t.rating || 0,
        totalSessions: sessionCountMap.get(t.id) || 0,
        status: t.status,
        shiftStart: null, // No shift fields in SpaTherapist schema
        shiftEnd: null,
        avatar: null,
        languages: ['English'],
      };
    });

    // --- Revenue stats ---
    const todayBookings = Number(todayStats._count);
    const todayRevenue = Number(todayStats._sum.price || 0);
    const weekBookings = Number(weekStats._count);
    const weekRevenue = Number(weekStats._sum.price || 0);
    const monthBookings = Number(monthStats._count);

    const totalCategoryRevenue = monthByCategory.reduce((sum, c) => sum + Number(c.revenue), 0) || 1;

    // Today and weekly no-shows/cancellations
    const [todayNoShows, todayCancellations, weekNoShows, weekCancellations] = await Promise.all([
      db.spaAppointment.count({
        where: { tenantId: user.tenantId, status: 'no_show', startTime: { gte: dayStart, lte: dayEnd } },
      }),
      db.spaAppointment.count({
        where: { tenantId: user.tenantId, status: 'cancelled', startTime: { gte: dayStart, lte: dayEnd } },
      }),
      db.spaAppointment.count({
        where: { tenantId: user.tenantId, status: 'no_show', startTime: { gte: weekStart } },
      }),
      db.spaAppointment.count({
        where: { tenantId: user.tenantId, status: 'cancelled', startTime: { gte: weekStart } },
      }),
    ]);

    const revenueStats = {
      today: {
        bookings: todayBookings,
        revenue: todayRevenue,
        avgSpendPerGuest: todayBookings > 0 ? Math.round(todayRevenue / todayBookings) : 0,
        occupancy: Math.min(100, Math.round((todayBookings / Math.max(1, therapists.length)) * 100)),
        topTreatment: topTreatmentRow[0]?.name || 'N/A',
        noShows: todayNoShows,
        cancellations: todayCancellations,
      },
      thisWeek: {
        bookings: weekBookings,
        revenue: weekRevenue,
        avgSpendPerGuest: weekBookings > 0 ? Math.round(weekRevenue / weekBookings) : 0,
        occupancy: Math.min(100, Math.round((weekBookings / Math.max(1, therapists.length * 7)) * 100)),
        topTreatment: topTreatmentRow[0]?.name || 'N/A',
        noShows: weekNoShows,
        cancellations: weekCancellations,
      },
      thisMonth: {
        bookings: monthBookings,
        revenue: monthRevenue,
        avgSpendPerGuest: monthBookings > 0 ? Math.round(monthRevenue / monthBookings) : 0,
        occupancy: Math.min(100, Math.round((monthBookings / Math.max(1, therapists.length * 30)) * 100)),
        topTreatment: topTreatmentRow[0]?.name || 'N/A',
        noShows: monthNoShows,
        cancellations: monthCancellations,
        revenueVsLastMonth,
      },
      byCategory: monthByCategory.map(c => ({
        category: c.category.charAt(0).toUpperCase() + c.category.slice(1),
        bookings: Number(c.bookings),
        revenue: Number(c.revenue),
        percentage: parseFloat(((Number(c.revenue) / totalCategoryRevenue) * 100).toFixed(1)),
      })),
      revenueTrend: revenueTrend.map(t => ({
        date: t.date,
        revenue: Number(t.revenue),
        bookings: Number(t.bookings),
        // Ratings not yet implemented — no guest-facing rating table exists
        avgRating: null,
      })),
    };

    const stats = {
      todayBookings: revenueStats.today.bookings,
      todayRevenue: revenueStats.today.revenue,
      monthBookings: revenueStats.thisMonth.bookings,
      monthRevenue: revenueStats.thisMonth.revenue,
      totalTreatments: treatments.length,
      totalTherapists: therapists.length,
      onDutyTherapists: therapists.filter(t => t.status === 'available' || t.status === 'busy').length,
      monthGrowth: revenueStats.thisMonth.revenueVsLastMonth,
    };

    return NextResponse.json({
      success: true,
      data: {
        appointments: filteredAppointments,
        treatments,
        therapists,
        revenueStats,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching spa data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch spa & wellness data' } },
      { status: 500 }
    );
  }
}
