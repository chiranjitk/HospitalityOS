import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// GET /api/experience/spa/revenue
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['experience.view', 'experience.spa', 'experience_revenue.view', 'experience.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'weekly';
    const propertyId = searchParams.get('propertyId');

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default: // weekly
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - startDate.getDay() + 1); // Monday
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    const where: any = {
      tenantId: user.tenantId,
      startTime: { gte: startDate, lte: now },
      status: 'completed',
    };
    if (propertyId) where.propertyId = propertyId;

    // Aggregate revenue by treatment category
    const revenueByCategory = await db.spaAppointment.groupBy({
      by: ['treatmentId'],
      where,
      _sum: { price: true },
      _count: { id: true },
      orderBy: { _sum: { price: 'desc' } },
    });

    // Get treatment details for categories
    const treatmentIds = revenueByCategory.map(r => r.treatmentId);
    const treatments = await db.spaTreatment.findMany({
      where: { id: { in: treatmentIds }, tenantId: user.tenantId },
      select: { id: true, name: true, category: true },
    });

    const treatmentMap = new Map(treatments.map(t => [t.id, t]));

    // Group by category
    const categoryRevenue: Record<string, { category: string; revenue: number; sessions: number }> = {};
    let totalRevenue = 0;
    let totalSessions = 0;

    for (const item of revenueByCategory) {
      const treatment = treatmentMap.get(item.treatmentId);
      const category = treatment?.category || 'Other';
      const revenue = item._sum.price || 0;
      const sessions = item._count.id;

      if (!categoryRevenue[category]) {
        categoryRevenue[category] = { category, revenue: 0, sessions: 0 };
      }
      categoryRevenue[category].revenue += revenue;
      categoryRevenue[category].sessions += sessions;
      totalRevenue += revenue;
      totalSessions += sessions;
    }

    // Today stats
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayAppointments = await db.spaAppointment.count({
      where: {
        tenantId: user.tenantId,
        startTime: { gte: todayStart, lte: now },
      },
    });

    const todayCompleted = await db.spaAppointment.findMany({
      where: {
        tenantId: user.tenantId,
        startTime: { gte: todayStart, lte: now },
        status: 'completed',
      },
      select: { price: true },
    });
    const todayRevenue = todayCompleted.reduce((s, a) => s + a.price, 0);

    // Month stats
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthAppointments = await db.spaAppointment.count({
      where: {
        tenantId: user.tenantId,
        startTime: { gte: monthStart, lte: now },
        status: 'completed',
      },
    });

    const monthRevenueResult = await db.spaAppointment.aggregate({
      _sum: { price: true },
      where: {
        tenantId: user.tenantId,
        startTime: { gte: monthStart, lte: now },
        status: 'completed',
      },
    });
    const monthRevenue = monthRevenueResult._sum.price || 0;

    // Therapist stats
    const activeTherapists = await db.spaTherapist.count({
      where: {
        tenantId: user.tenantId,
        status: { in: ['available', 'busy'] },
      },
    });

    const topTreatments = revenueByCategory.slice(0, 5).map(item => {
      const treatment = treatmentMap.get(item.treatmentId);
      return {
        name: treatment?.name || 'Unknown',
        category: treatment?.category || 'Other',
        revenue: item._sum.price || 0,
        sessions: item._count.id,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        period,
        totalRevenue,
        totalSessions,
        categoryBreakdown: Object.values(categoryRevenue).map(c => ({
          ...c,
          percentage: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 100) : 0,
        })),
        today: {
          bookings: todayAppointments,
          revenue: todayRevenue,
        },
        thisMonth: {
          bookings: monthAppointments,
          revenue: monthRevenue,
        },
        activeTherapists,
        topTreatments,
      },
    });
  } catch (error) {
    console.error('Error fetching spa revenue:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch spa revenue' }, { status: 500 });
  }
}
