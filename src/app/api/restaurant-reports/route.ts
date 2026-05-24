import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'restaurant.read') && !hasPermission(user, 'restaurant.*') && !hasPermission(user, 'reports.view')) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    if (!hasPermission(user, 'reports.view') && !hasPermission(user, 'reports.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type') || 'overview';
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Record<string, unknown> = { tenantId: user.tenantId, status: { notIn: ['cancelled', 'refunded'] } };

    if (propertyId) {
      const prop = await db.property.findFirst({ where: { id: propertyId, tenantId: user.tenantId, deletedAt: null }, select: { id: true } });
      if (!prop) return NextResponse.json({ success: false, error: { code: 'INVALID_PROPERTY' } }, { status: 400 });
      where.propertyId = propertyId;
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate + 'T23:59:59');
      where.createdAt = dateFilter;
    }

    if (type === 'overview') {
      const totalRevenue = await db.order.aggregate({ where, _sum: { totalAmount: true } });
      const totalOrders = await db.order.count({ where });
      const uniqueTables = await db.order.groupBy({ where, by: ['tableId'], _count: true });
      const totalTables = await db.restaurantTable.count({ where: { propertyId: propertyId || undefined } });

      const dailyRevenue = await db.order.groupBy({
        by: ['createdAt'],
        where,
        _sum: { totalAmount: true },
        _count: true,
        orderBy: { createdAt: 'asc' },
      });

      const topItems = await db.orderItem.groupBy({
        by: ['menuItemId'],
        where: { order: where },
        _sum: { quantity: true, totalAmount: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 10,
      });

      const topItemsWithNames = await Promise.all(topItems.map(async (item) => {
        const mi = await db.menuItem.findFirst({ where: { id: item.menuItemId }, select: { name: true } });
        return { name: mi?.name || 'Unknown', quantity: item._sum.quantity || 0, revenue: item._sum.totalAmount || 0 };
      }));

      return NextResponse.json({ success: true, data: {
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        totalOrders,
        avgOrderValue: totalOrders > 0 ? Math.round((totalRevenue._sum.totalAmount || 0) / totalOrders * 100) / 100 : 0,
        tableOccupancyRate: totalTables > 0 ? Math.round((uniqueTables.length / totalTables) * 100) : 0,
        dailyRevenue,
        topItems: topItemsWithNames,
      }});
    }

    if (type === 'sales') {
      const byPaymentMethod = await db.order.groupBy({ by: ['notes'], where, _sum: { totalAmount: true }, _count: true });
      const byOrderType = await db.order.groupBy({ by: ['orderType'], where, _sum: { totalAmount: true }, _count: true });

      return NextResponse.json({ success: true, data: {
        byPaymentMethod: byPaymentMethod.map(p => ({ method: p.notes || 'Unknown', total: p._sum.totalAmount || 0, count: p._count })),
        byOrderType: byOrderType.map(t => ({ type: t.orderType, total: t._sum.totalAmount || 0, count: t._count })),
        taxSummary: { totalTax: 0 },
      }});
    }

    if (type === 'menu') {
      const topItems = await db.orderItem.groupBy({
        by: ['menuItemId'], where: { order: where },
        _sum: { quantity: true, totalAmount: true },
        orderBy: { _sum: { quantity: 'desc' } }, take: 20,
      });

      const allMenuItems = await db.menuItem.findMany({ where: { propertyId: propertyId || undefined, deletedAt: null }, select: { id: true, name: true, price: true, categoryId: true } });
      const orderedIds = new Set(topItems.map(i => i.menuItemId));
      const ghostItems = allMenuItems.filter(mi => !orderedIds.has(mi.id));

      const topWithNames = await Promise.all(topItems.map(async (item) => {
        const mi = await db.menuItem.findFirst({ where: { id: item.menuItemId }, select: { name: true, category: { select: { name: true } } } });
        return { name: mi?.name || 'Unknown', category: mi?.category?.name || 'Other', unitsSold: item._sum.quantity || 0, revenue: item._sum.totalAmount || 0 };
      }));

      const byCategory = await db.orderItem.groupBy({
        by: ['menuItemId'], where: { order: where },
        _sum: { totalAmount: true },
      });

      const categories: Record<string, number> = {};
      for (const item of byCategory) {
        const mi = await db.menuItem.findFirst({ where: { id: item.menuItemId }, select: { category: { select: { name: true } } } });
        const cat = mi?.category?.name || 'Other';
        categories[cat] = (categories[cat] || 0) + (item._sum.totalAmount || 0);
      }

      return NextResponse.json({ success: true, data: {
        itemPopularity: topWithNames,
        categoryPerformance: Object.entries(categories).map(([name, revenue]) => ({ name, revenue })),
        ghostItems: ghostItems.map(i => ({ id: i.id, name: i.name, price: i.price })),
      }});
    }

    if (type === 'tables') {
      const tableOrders = await db.order.findMany({
        where: { ...where, tableId: { not: null } },
        select: { tableId: true, createdAt: true, completedAt: true, totalAmount: true },
      });

      const allTables = await db.restaurantTable.findMany({ where: { propertyId: propertyId || undefined }, select: { id: true, number: true, capacity: true } });

      const tableStats: Record<string, { orderCount: number; totalRevenue: number; durations: number[] }> = {};
      for (const o of tableOrders) {
        if (!o.tableId) continue;
        if (!tableStats[o.tableId]) tableStats[o.tableId] = { orderCount: 0, totalRevenue: 0, durations: [] };
        tableStats[o.tableId].orderCount++;
        tableStats[o.tableId].totalRevenue += o.totalAmount;
        if (o.completedAt) {
          const dur = (new Date(o.completedAt).getTime() - new Date(o.createdAt).getTime()) / 60000;
          tableStats[o.tableId].durations.push(dur);
        }
      }

      const tableAnalysis = allTables.map(t => {
        const stats = tableStats[t.id];
        const avgDuration = stats && stats.durations.length > 0 ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length) : 0;
        return { tableId: t.id, number: t.number, capacity: t.capacity, orderCount: stats?.orderCount || 0, totalRevenue: stats?.totalRevenue || 0, avgDuration };
      }).sort((a, b) => b.orderCount - a.orderCount);

      return NextResponse.json({ success: true, data: {
        tableTurnover: tableAnalysis,
        mostUsed: tableAnalysis.slice(0, 5),
        leastUsed: tableAnalysis.slice(-5).reverse(),
        avgDiningDuration: tableAnalysis.filter(t => t.avgDuration > 0).reduce((s, t) => s + t.avgDuration, 0) / Math.max(tableAnalysis.filter(t => t.avgDuration > 0).length, 1),
      }});
    }

    if (type === 'staff') {
      // Calculate average order completion time (kitchen turnaround)
      const completedOrders = await db.order.findMany({
        where: { ...where, completedAt: { not: null }, createdAt: { not: null } },
        select: { createdAt: true, completedAt: true },
      });
      const durations: number[] = completedOrders.map(o => {
        return (new Date(o.completedAt!).getTime() - new Date(o.createdAt).getTime()) / 60000;
      });
      const avgCompletionTime = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

      // Get restaurant staff from StaffShift in the date range
      const shiftWhere: Record<string, unknown> = { tenantId: user.tenantId, status: { in: ['scheduled', 'on_duty', 'completed'] } };
      if (startDate) {
        shiftWhere.date = { ...((shiftWhere.date as Record<string, unknown>) || {}), gte: new Date(startDate) };
      }
      if (endDate) {
        shiftWhere.date = { ...((shiftWhere.date as Record<string, unknown>) || {}), lte: new Date(endDate + 'T23:59:59') };
      }

      const staffShifts = await db.staffShift.findMany({
        where: shiftWhere,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, department: true } },
        },
        orderBy: { date: 'desc' },
      });

      // Collect unique staff members and their shift dates/properties
      const staffMap = new Map<string, { name: string; department: string; shiftDates: string[] }>();
      for (const shift of staffShifts) {
        const uid = shift.userId;
        if (!staffMap.has(uid)) {
          staffMap.set(uid, {
            name: `${shift.user.firstName} ${shift.user.lastName}`.trim(),
            department: shift.user.department || 'General',
            shiftDates: [],
          });
        }
        staffMap.get(uid)!.shiftDates.push(shift.date.toISOString().split('T')[0]);
      }

      // Get orders with property info for cross-referencing
      const ordersInRange = await db.order.findMany({
        where: { ...where },
        select: { id: true, propertyId: true, createdAt: true, completedAt: true, totalAmount: true, orderType: true },
      });

      // Count orders per staff by matching shift dates with order dates
      const ordersPerStaff: Array<{ staffName: string; department: string; orderCount: number; shiftDays: number }> = [];
      const revenuePerStaff: Array<{ staffName: string; department: string; revenue: number; shiftDays: number }> = [];

      staffMap.forEach((staffInfo, uid) => {
        const shiftDateSet = new Set(staffInfo.shiftDates);
        const staffOrders = ordersInRange.filter(o =>
          shiftDateSet.has(o.createdAt.toISOString().split('T')[0])
        );
        const orderCount = staffOrders.length;
        const revenue = staffOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        ordersPerStaff.push({
          staffName: staffInfo.name,
          department: staffInfo.department,
          orderCount,
          shiftDays: shiftDateSet.size,
        });
        revenuePerStaff.push({
          staffName: staffInfo.name,
          department: staffInfo.department,
          revenue: Math.round(revenue * 100) / 100,
          shiftDays: shiftDateSet.size,
        });
      });

      // Sort by descending
      ordersPerStaff.sort((a, b) => b.orderCount - a.orderCount);
      revenuePerStaff.sort((a, b) => b.revenue - a.revenue);

      return NextResponse.json({ success: true, data: { ordersPerStaff, revenuePerStaff, avgCompletionTime } });
    }

    return NextResponse.json({ success: false, error: { code: 'INVALID_TYPE', message: 'Invalid report type' } }, { status: 400 });
  } catch (error) {
    console.error('Error fetching restaurant reports:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate report' } }, { status: 500 });
  }
}
