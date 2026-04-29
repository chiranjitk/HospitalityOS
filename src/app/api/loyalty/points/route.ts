import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getUserFromRequest } from '@/lib/auth-helpers';

const MAX_LIMIT = 100;

// GET /api/loyalty/points - Points ledger for a guest
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get('guestId');
    const type = searchParams.get('type'); // earn, redeem, etc.
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), MAX_LIMIT);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { tenantId };
    if (guestId) {
      where.guestId = guestId;
    }
    if (type) {
      where.type = type;
    }

    // Fetch transactions with pagination
    const [transactions, total] = await Promise.all([
      db.loyaltyPointTransaction.findMany({
        where,
        include: {
          guest: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              loyaltyTier: true,
              loyaltyPoints: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.loyaltyPointTransaction.count({ where }),
    ]);

    // Monthly aggregates for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthlyWhere: Record<string, unknown> = {
      tenantId,
      createdAt: { gte: startOfMonth, lte: endOfMonth },
      ...(guestId && { guestId }),
    };

    const [earnedThisMonth, redeemedThisMonth] = await Promise.all([
      db.loyaltyPointTransaction.aggregate({
        where: { ...monthlyWhere, type: 'earn' },
        _sum: { points: true },
        _count: { id: true },
      }),
      db.loyaltyPointTransaction.aggregate({
        where: { ...monthlyWhere, type: 'redeem' },
        _sum: { points: true },
        _count: { id: true },
      }),
    ]);

    // Global summary if no guest filter
    let globalSummary = null;
    if (!guestId) {
      const [totalEarned, totalRedeemed, totalBalance] = await Promise.all([
        db.loyaltyPointTransaction.aggregate({
          where: { tenantId, points: { gt: 0 } },
          _sum: { points: true },
        }),
        db.loyaltyPointTransaction.aggregate({
          where: { tenantId, points: { lt: 0 } },
          _sum: { points: true },
        }),
        db.guest.aggregate({
          where: { tenantId, deletedAt: null },
          _sum: { loyaltyPoints: true },
        }),
      ]);

      globalSummary = {
        totalEarned: totalEarned._sum.points || 0,
        totalRedeemed: Math.abs(totalRedeemed._sum.points || 0),
        currentBalance: totalBalance._sum.loyaltyPoints || 0,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        monthly: {
          earned: earnedThisMonth._sum.points || 0,
          earnedCount: earnedThisMonth._count.id,
          redeemed: Math.abs(redeemedThisMonth._sum.points || 0),
          redeemedCount: redeemedThisMonth._count.id,
        },
        summary: globalSummary,
      },
    });
  } catch (error) {
    console.error('Error fetching points ledger:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch points ledger' } },
      { status: 500 }
    );
  }
}

// POST /api/loyalty/points/redeem - Redeem points for a reward
const REWARD_OPTIONS: Record<string, { name: string; points: number; description: string }> = {
  free_night: { name: 'Free Night', points: 10000, description: 'One free night stay' },
  room_upgrade: { name: 'Room Upgrade', points: 5000, description: 'Upgrade to next room category' },
  late_checkout: { name: 'Late Checkout', points: 2000, description: 'Guaranteed 2pm checkout' },
  spa_credit: { name: 'Spa Credit', points: 3000, description: 'Spa credit voucher' },
};

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { action, guestId, rewardId, points, description, source } = body;

    // Handle earn action
    if (action === 'earn') {
      return handleEarnPoints(tenantId, guestId, points, description, source);
    }

    // Handle redeem action
    if (action === 'redeem') {
      return handleRedeemPoints(tenantId, guestId, rewardId, points, description);
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Action is required: earn or redeem' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing points transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorMap: Record<string, { code: string; message: string; status: number }> = {
      'GUEST_NOT_FOUND': { code: 'NOT_FOUND', message: 'Guest not found', status: 404 },
      'INSUFFICIENT_POINTS': { code: 'VALIDATION_ERROR', message: 'Insufficient points balance', status: 400 },
      'INVALID_REWARD': { code: 'VALIDATION_ERROR', message: 'Invalid reward selected', status: 400 },
    };
    const mappedError = errorMap[errorMessage] || { code: 'INTERNAL_ERROR', message: 'Failed to process transaction', status: 500 };

    return NextResponse.json(
      { success: false, error: { code: mappedError.code, message: mappedError.message } },
      { status: mappedError.status }
    );
  }
}

async function handleEarnPoints(
  tenantId: string,
  guestId: string,
  points: number,
  description?: string,
  source?: string
) {
  if (!guestId || !points || points <= 0) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'guestId and positive points are required' } },
      { status: 400 }
    );
  }

  // Get guest and validate
  const guest = await db.guest.findUnique({
    where: { id: guestId, deletedAt: null },
    select: { id: true, loyaltyPoints: true, loyaltyTier: true, tenantId: true },
  });

  if (!guest) throw new Error('GUEST_NOT_FOUND');
  if (guest.tenantId !== tenantId) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Guest does not belong to this tenant' } },
      { status: 403 }
    );
  }

  // Tier multipliers: Bronze 1x, Silver 1.5x, Gold 2x, Platinum 3x
  const tierMultipliers: Record<string, number> = {
    bronze: 1,
    silver: 1.5,
    gold: 2,
    platinum: 3,
  };
  const multiplier = tierMultipliers[guest.loyaltyTier.toLowerCase()] || 1;
  const finalPoints = Math.round(points * multiplier);

  const previousBalance = guest.loyaltyPoints;
  const result = await db.$transaction(async (tx) => {
    const updatedGuest = await tx.guest.update({
      where: { id: guestId },
      data: { loyaltyPoints: { increment: finalPoints } },
    });

    const transaction = await tx.loyaltyPointTransaction.create({
      data: {
        tenantId,
        guestId,
        points: finalPoints,
        balance: updatedGuest.loyaltyPoints,
        type: 'earn',
        source: source || 'manual',
        description: description || `Earned ${finalPoints} points (${guest.loyaltyTier} tier: ${multiplier}x multiplier)`,
      },
    });

    return { transaction, newBalance: updatedGuest.loyaltyPoints };
  });

  return NextResponse.json({
    success: true,
    data: {
      transaction: result.transaction,
      guestId,
      previousBalance,
      newBalance: result.newBalance,
      pointsEarned: finalPoints,
      tierMultiplier: multiplier,
    },
    message: `${finalPoints} points earned (includes ${multiplier}x tier bonus)`,
  }, { status: 201 });
}

async function handleRedeemPoints(
  tenantId: string,
  guestId: string,
  rewardId: string,
  customPoints?: number,
  description?: string
) {
  if (!guestId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Guest ID is required' } },
      { status: 400 }
    );
  }

  // Validate reward
  const reward = REWARD_OPTIONS[rewardId];
  if (!reward) throw new Error('INVALID_REWARD');
  const pointsToRedeem = customPoints || reward.points;

  // Get guest
  const guest = await db.guest.findUnique({
    where: { id: guestId, deletedAt: null },
    select: { id: true, loyaltyPoints: true, tenantId: true },
  });

  if (!guest) throw new Error('GUEST_NOT_FOUND');
  if (guest.tenantId !== tenantId) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Guest does not belong to this tenant' } },
      { status: 403 }
    );
  }

  if (guest.loyaltyPoints < pointsToRedeem) throw new Error('INSUFFICIENT_POINTS');

  const previousBalance = guest.loyaltyPoints;
  const result = await db.$transaction(async (tx) => {
    const updatedGuest = await tx.guest.update({
      where: { id: guestId },
      data: { loyaltyPoints: { decrement: pointsToRedeem } },
    });

    const transaction = await tx.loyaltyPointTransaction.create({
      data: {
        tenantId,
        guestId,
        points: -pointsToRedeem,
        balance: updatedGuest.loyaltyPoints,
        type: 'redeem',
        source: 'redemption',
        description: description || `Redeemed: ${reward.name} (${pointsToRedeem.toLocaleString()} pts)`,
      },
    });

    return { transaction, newBalance: updatedGuest.loyaltyPoints };
  });

  return NextResponse.json({
    success: true,
    data: {
      transaction: result.transaction,
      guestId,
      previousBalance,
      newBalance: result.newBalance,
      pointsRedeemed: pointsToRedeem,
      reward: reward.name,
    },
    message: `${reward.name} redeemed for ${pointsToRedeem.toLocaleString()} points`,
  }, { status: 201 });
}
