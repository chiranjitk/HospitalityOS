import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/guests/vip — List VIP guests with tier filter, search, and stats
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['guests.view', 'guests.manage', 'guests.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const tier = sp.get('tier');
    const search = sp.get('search');
    const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 100);
    const offset = parseInt(sp.get('offset') || '0', 10);

    // Build where clause for VIP guests
    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      isVip: true,
      status: 'active',
      deletedAt: null,
    };

    if (tier && tier !== 'all') {
      where.loyaltyTier = tier;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch VIP guests with behavior data and active bookings
    const guests = await db.guest.findMany({
      where,
      include: {
        behavior: { select: { visitCount: true, totalNights: true, totalSpent: true, lifetimeValue: true, isRepeatGuest: true } },
        bookings: {
          where: {
            status: { in: ['confirmed', 'checked_in'] },
            checkIn: { lte: new Date() },
            checkOut: { gte: new Date() },
          },
          select: {
            id: true,
            checkIn: true,
            checkOut: true,
            room: { select: { number: true, roomType: { select: { name: true } } } },
          },
          take: 1,
        },
      },
      orderBy: [{ loyaltyTier: 'asc' }, { totalSpent: 'desc' }],
      take: limit,
      skip: offset,
    });

    const total = await db.guest.count({ where });

    // Compute tier counts
    const tierCountsRaw = await db.guest.groupBy({
      by: ['loyaltyTier'],
      where: { tenantId: user.tenantId, isVip: true, status: 'active', deletedAt: null },
      _count: { loyaltyTier: true },
    });
    const tierCounts: Record<string, number> = {};
    for (const tc of tierCountsRaw) {
      tierCounts[tc.loyaltyTier] = tc._count.loyaltyTier;
    }

    // Today's arrivals — guests with booking checking in today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todaysArrivals = await db.guest.findMany({
      where: {
        tenantId: user.tenantId,
        isVip: true,
        status: 'active',
        deletedAt: null,
        bookings: {
          some: {
            status: { in: ['confirmed', 'checked_in'] },
            checkIn: { gte: todayStart, lte: todayEnd },
          },
        },
      },
      include: {
        behavior: { select: { visitCount: true, totalNights: true } },
        bookings: {
          where: {
            checkIn: { gte: todayStart, lte: todayEnd },
          },
          select: {
            checkIn: true,
            checkOut: true,
            room: { select: { number: true, roomType: { select: { name: true } } } },
          },
          take: 1,
        },
      },
    });

    // Transform guest data for frontend compatibility
    const transformedGuests = guests.map((g) => {
      const prefs = (() => {
        try { return typeof g.preferences === 'string' ? JSON.parse(g.preferences) : g.preferences; } catch { return {}; }
      })();
      const tags = (() => {
        try { return typeof g.tags === 'string' ? JSON.parse(g.tags) : g.tags; } catch { return []; }
      })();
      const activeBooking = g.bookings[0];

      return {
        id: g.id,
        firstName: g.firstName,
        lastName: g.lastName,
        email: g.email || '',
        phone: g.phone || '',
        tier: g.loyaltyTier || 'bronze',
        totalSpent: g.behavior?.totalSpent || g.totalSpent || 0,
        totalNights: g.behavior?.totalNights || 0,
        totalVisits: g.behavior?.visitCount || g.totalStays || 0,
        loyaltyPoints: g.loyaltyPoints || 0,
        checkInDate: activeBooking?.checkIn?.toISOString().split('T')[0],
        checkOutDate: activeBooking?.checkOut?.toISOString().split('T')[0],
        roomNumber: activeBooking?.room?.number,
        roomType: activeBooking?.room?.roomType?.name,
        company: prefs.company || null,
        dateOfBirth: g.dateOfBirth?.toISOString().split('T')[0],
        dietaryPreference: g.dietaryRequirements || prefs.dietaryPreference || null,
        pillowPreference: prefs.pillowPreference || null,
        roomPreference: prefs.roomPreference || null,
        allergies: prefs.allergies || null,
        specialRequests: g.specialRequests || null,
        tags,
      };
    });

    const transformedArrivals = todaysArrivals.map((g) => {
      const prefs = (() => {
        try { return typeof g.preferences === 'string' ? JSON.parse(g.preferences) : g.preferences; } catch { return {}; }
      })();
      const tags = (() => {
        try { return typeof g.tags === 'string' ? JSON.parse(g.tags) : g.tags; } catch { return []; }
      })();
      const activeBooking = g.bookings[0];

      return {
        id: g.id,
        firstName: g.firstName,
        lastName: g.lastName,
        email: g.email || '',
        phone: g.phone || '',
        tier: g.loyaltyTier || 'bronze',
        totalSpent: g.behavior?.totalSpent || g.totalSpent || 0,
        totalNights: g.behavior?.totalNights || 0,
        totalVisits: g.behavior?.visitCount || g.totalStays || 0,
        loyaltyPoints: g.loyaltyPoints || 0,
        checkInDate: activeBooking?.checkIn?.toISOString().split('T')[0],
        checkOutDate: activeBooking?.checkOut?.toISOString().split('T')[0],
        roomNumber: activeBooking?.room?.number,
        roomType: activeBooking?.room?.roomType?.name,
        company: prefs.company || null,
        dateOfBirth: g.dateOfBirth?.toISOString().split('T')[0],
        dietaryPreference: g.dietaryRequirements || prefs.dietaryPreference || null,
        pillowPreference: prefs.pillowPreference || null,
        roomPreference: prefs.roomPreference || null,
        allergies: prefs.allergies || null,
        specialRequests: g.specialRequests || null,
        tags,
      };
    });

    return NextResponse.json({
      success: true,
      data: transformedGuests,
      pagination: { total, limit, offset },
      stats: {
        tierCounts,
        totalVip: total,
        todaysArrivals: transformedArrivals,
      },
    });
  } catch (error) {
    console.error('GET /api/guests/vip:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch VIP guests' }, { status: 500 });
  }
}

// POST /api/guests/vip — Create VIP guest or add VIP designation to existing guest
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['guests.manage', 'guests.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      guestId,
      firstName,
      lastName,
      email,
      phone,
      tier,
      loyaltyPoints,
      preferences,
      dietaryRequirements,
      specialRequests,
      tags,
    } = body;

    // If guestId is provided, update existing guest to VIP
    if (guestId) {
      const existing = await db.guest.findFirst({
        where: { id: guestId, tenantId: user.tenantId },
      });

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 });
      }

      const updateData: Record<string, unknown> = {
        isVip: true,
      };
      if (tier) updateData.loyaltyTier = tier;
      if (loyaltyPoints !== undefined) {
        // SECURITY FIX: Prevent negative loyalty points
        if (typeof loyaltyPoints !== 'number' || loyaltyPoints < 0) {
          return NextResponse.json(
            { success: false, error: 'loyaltyPoints must be >= 0' },
            { status: 400 }
          );
        }
        updateData.loyaltyPoints = loyaltyPoints;
      }
      if (dietaryRequirements) updateData.dietaryRequirements = dietaryRequirements;
      if (specialRequests) updateData.specialRequests = specialRequests;
      if (preferences) updateData.preferences = JSON.stringify(preferences);
      if (tags) updateData.tags = JSON.stringify(tags);

      const updated = await db.guest.update({
        where: { id: guestId },
        data: updateData,
      });

      return NextResponse.json({ success: true, data: updated, message: 'Guest upgraded to VIP' });
    }

    // Otherwise create a new guest as VIP
    if (!firstName || !lastName) {
      return NextResponse.json({ success: false, error: 'firstName and lastName are required' }, { status: 400 });
    }

    // H-30: Check email uniqueness before creating a new VIP guest.
    // If email is provided and already exists, reject to prevent duplicate profiles.
    if (email) {
      const emailExists = await db.guest.findFirst({
        where: {
          tenantId: user.tenantId,
          email,
          deletedAt: null,
          status: { not: 'merged' },
        },
      });
      if (emailExists) {
        return NextResponse.json(
          { success: false, error: 'A guest with this email already exists. Use guestId to update the existing profile.' },
          { status: 409 }
        );
      }
    }

    const newGuest = await db.guest.create({
      data: {
        tenantId: user.tenantId,
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        isVip: true,
        loyaltyTier: tier || 'bronze',
        loyaltyPoints: (typeof loyaltyPoints === 'number' && loyaltyPoints >= 0) ? loyaltyPoints : 0,
        dietaryRequirements: dietaryRequirements || null,
        specialRequests: specialRequests || null,
        preferences: preferences ? JSON.stringify(preferences) : '{}',
        tags: tags ? JSON.stringify(tags) : '[]',
      },
    });

    return NextResponse.json({ success: true, data: newGuest }, { status: 201 });
  } catch (error) {
    console.error('POST /api/guests/vip:', error);
    return NextResponse.json({ success: false, error: 'Failed to create/update VIP guest' }, { status: 500 });
  }
}
