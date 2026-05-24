import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

function generateReferralCode(): string {
  const bytes = crypto.randomBytes(4);
  const hex = bytes.toString('hex').toUpperCase().slice(0, 6);
  return `REF-${hex}`;
}

// GET /api/guests/referrals - List referrals with stats
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const referrerId = searchParams.get('referrerId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (referrerId) where.referrerId = referrerId;
    if (status) where.status = status;

    const [referrals, total] = await Promise.all([
      db.referralTracking.findMany({
        where,
        include: {
          referrer: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
      }),
      db.referralTracking.count({ where }),
    ]);

    // Aggregate stats
    const allReferrals = await db.referralTracking.findMany({
      where: { tenantId: user.tenantId },
    });

    const totalReferrals = allReferrals.length;
    const converted = allReferrals.filter(r => r.status === 'converted' || r.status === 'rewarded').length;
    const rewarded = allReferrals.filter(r => r.status === 'rewarded').length;
    const pending = allReferrals.filter(r => r.status === 'pending').length;
    const expired = allReferrals.filter(r => r.status === 'expired').length;
    const conversionRate = totalReferrals > 0 ? Math.round((converted / totalReferrals) * 100) : 0;
    const rewardRate = totalReferrals > 0 ? Math.round((rewarded / totalReferrals) * 100) : 0;

    // Total reward value
    const totalRewardValue = allReferrals
      .filter(r => r.status === 'rewarded')
      .reduce((sum, r) => sum + r.rewardAmount, 0);

    // Rewards by type
    const rewardsByType: Record<string, { count: number; total: number }> = {};
    for (const r of allReferrals.filter(ref => ref.status === 'rewarded')) {
      if (!rewardsByType[r.rewardType]) rewardsByType[r.rewardType] = { count: 0, total: 0 };
      rewardsByType[r.rewardType].count++;
      rewardsByType[r.rewardType].total += r.rewardAmount;
    }

    return NextResponse.json({
      success: true,
      data: referrals,
      pagination: { total, limit, offset },
      stats: {
        total: totalReferrals,
        converted,
        rewarded,
        pending,
        expired,
        conversionRate,
        rewardRate,
        totalRewardValue,
        rewardsByType,
      },
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch referrals' } }, { status: 500 });
  }
}

// POST /api/guests/referrals - Create referral code for a guest
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const { referrerId, referralSource, rewardType, rewardAmount, expiresInDays } = body;

    if (!referrerId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'referrerId is required' } },
        { status: 400 }
      );
    }

    // Verify referrer belongs to tenant
    const guest = await db.guest.findFirst({
      where: { id: referrerId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!guest) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } }, { status: 404 });
    }

    // Generate unique code
    let referralCode = generateReferralCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const existing = await db.referralTracking.findFirst({
        where: { tenantId: user.tenantId, referralCode },
      });
      if (!existing) {
        isUnique = true;
      } else {
        referralCode = generateReferralCode();
        attempts++;
      }
    }

    if (!isUnique) {
      return NextResponse.json({ success: false, error: { code: 'CONFLICT', message: 'Could not generate unique referral code' } }, { status: 409 });
    }

    const referral = await db.referralTracking.create({
      data: {
        tenantId: user.tenantId,
        referrerId,
        referralCode,
        referralSource: referralSource || 'link',
        rewardType: rewardType || 'points',
        rewardAmount: rewardAmount || 0,
        expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null,
      },
    });

    return NextResponse.json({ success: true, data: referral }, { status: 201 });
  } catch (error) {
    console.error('Error creating referral:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create referral' } }, { status: 500 });
  }
}

// PUT /api/guests/referrals - Update referral status
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, refereeId, convertedAt, rewardedAt, rewardAmount } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id and status are required' } },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'converted', 'rewarded', 'expired'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` } },
        { status: 400 }
      );
    }

    const referral = await db.referralTracking.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!referral) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Referral not found' } }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { status };
    if (status === 'converted') {
      updateData.convertedAt = convertedAt ? new Date(convertedAt) : new Date();
      if (refereeId) updateData.refereeId = refereeId;
    }
    if (status === 'rewarded') {
      updateData.rewardedAt = rewardedAt ? new Date(rewardedAt) : new Date();
      if (rewardAmount !== undefined) updateData.rewardAmount = rewardAmount;
      if (!updateData.convertedAt) updateData.convertedAt = referral.convertedAt || new Date();
    }
    if (status === 'expired') {
      updateData.expiresAt = new Date();
    }

    const updated = await db.referralTracking.update({
      where: { id },
      data: updateData,
    });

    // If rewarded, add loyalty points to referrer
    if (status === 'rewarded' && referral.rewardType === 'points') {
      try {
        await db.guest.update({
          where: { id: referral.referrerId },
          data: {
            loyaltyPoints: { increment: Math.round(referral.rewardAmount) },
          },
        });

        await db.loyaltyPointTransaction.create({
          data: {
            tenantId: user.tenantId,
            guestId: referral.referrerId,
            points: Math.round(referral.rewardAmount),
            balance: 0, // Will be recalculated
            type: 'referral',
            source: 'referral',
            referenceId: referral.id,
            referenceType: 'referral',
            description: `Referral reward: ${referral.referralCode}`,
          },
        });
      } catch (loyaltyError) {
        console.error('Failed to add loyalty points for referral reward:', loyaltyError);
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating referral:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update referral' } }, { status: 500 });
  }
}
