import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// H-29: Helper to calculate real age distribution from guest dateOfBirth data
async function getRealAgeDistribution(tenantId: string): Promise<Array<{ range: string; count: number; estimated?: boolean }>> {
  const now = new Date();
  const guestsWithDob = await db.guest.findMany({
    where: {
      tenantId,
      deletedAt: null,
      dateOfBirth: { not: null },
    },
    select: { dateOfBirth: true },
  });

  const ranges = [
    { range: '18-25', min: 18, max: 25 },
    { range: '26-35', min: 26, max: 35 },
    { range: '36-45', min: 36, max: 45 },
    { range: '46-55', min: 46, max: 55 },
    { range: '56+', min: 56, max: 150 },
  ];

  const distribution = ranges.map(r => ({
    range: r.range,
    count: 0,
  }));

  for (const guest of guestsWithDob) {
    if (!guest.dateOfBirth) continue;
    const age = Math.floor((now.getTime() - new Date(guest.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    for (const r of ranges) {
      if (age >= r.min && age <= r.max) {
        distribution.find(d => d.range === r.range)!.count++;
        break;
      }
    }
  }

  return distribution;
}

// GET /api/guests/analytics - Get guest analytics
export async function GET(request: NextRequest) {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // H-28: Add RBAC permission check (consistent with other analytics/reports routes)
    if (!hasPermission(user, 'guests.view') && !hasPermission(user, 'reports.view') && !hasPermission(user, 'admin.*')) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const tenantId = user.tenantId;


  try {
    const searchParams = request.nextUrl.searchParams;
    const dateRange = Math.min(Math.max(parseInt(searchParams.get('dateRange') || '30', 10), 1), 365);

    // Calculate date threshold
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);

    // Get total guests
    const totalGuests = await db.guest.count({
      where: { tenantId, deletedAt: null },
    });

    // Get new guests in period
    const newGuests = await db.guest.count({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: { gte: startDate },
      },
    });

    // Get returning guests (guests with more than 1 booking)
    const guestsWithBookings = await db.guest.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        _count: {
          select: { bookings: true },
        },
      },
    });

    const returningGuests = guestsWithBookings.filter(g => g._count.bookings > 1).length;
    const vipGuests = await db.guest.count({
      where: { tenantId, deletedAt: null, isVip: true },
    });

    // Loyalty distribution
    const loyaltyDistribution = await db.guest.groupBy({
      by: ['loyaltyTier'],
      where: { tenantId, deletedAt: null },
      _count: { id: true },
    });

    // Source distribution
    const sourceDistribution = await db.guest.groupBy({
      by: ['source'],
      where: { tenantId, deletedAt: null },
      _count: { id: true },
    });

    // Top nationalities
    const nationalityDistribution = await db.guest.groupBy({
      by: ['nationality'],
      where: { tenantId, deletedAt: null, nationality: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    // Calculate average stay length
    const bookings = await db.booking.findMany({
      where: {
        tenantId,
        checkIn: { gte: startDate },
        status: { notIn: ['cancelled', 'no_show'] },
      },
      select: {
        checkIn: true,
        checkOut: true,
      },
    });

    const totalNights = bookings.reduce((sum, b) => {
      const nights = Math.ceil((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / (1000 * 60 * 60 * 24));
      return sum + nights;
    }, 0);
    const avgStayLength = bookings.length > 0 ? totalNights / bookings.length : 0;

    // Get top guests by total spend
    const topGuests = await db.guest.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        bookings: {
          where: { status: { notIn: ['cancelled', 'no_show'] } },
          select: { totalAmount: true },
        },
        _count: {
          select: { bookings: true },
        },
      },
      take: 5,
    });

    const guestsWithSpend = topGuests.map(g => ({
      id: g.id,
      name: `${g.firstName} ${g.lastName}`,
      email: g.email,
      loyaltyTier: g.loyaltyTier,
      totalStays: g._count.bookings,
      totalSpent: g.bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0),
    })).sort((a, b) => b.totalSpent - a.totalSpent);

    return NextResponse.json({
      success: true,
      data: {
        totalGuests,
        newGuests,
        returningGuests,
        vipGuests,
        avgStayLength: Math.round(avgStayLength * 10) / 10,
        loyaltyDistribution: loyaltyDistribution.map(l => ({
          tier: l.loyaltyTier,
          count: l._count.id,
        })),
        sourceDistribution: sourceDistribution.map(s => ({
          source: s.source || 'unknown',
          count: s._count.id,
        })),
        topNationalities: nationalityDistribution.map(n => ({
          country: n.nationality || 'Unknown',
          count: n._count.id,
        })),
        // H-29: Real age distribution based on guest dateOfBirth data from the database.
        // Count guests by age group. Guests without a dateOfBirth are excluded from counts.
        ageDistribution: await getRealAgeDistribution(tenantId),
        recentGuests: guestsWithSpend,
      },
    });
  } catch (error) {
    console.error('Error fetching guest analytics:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch guest analytics' } },
      { status: 500 }
    );
  }
}
