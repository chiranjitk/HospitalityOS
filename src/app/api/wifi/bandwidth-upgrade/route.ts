/**
 * WiFi Bandwidth Upgrade API
 *
 * GET  — List bandwidth upgrade purchases with filters and pagination
 * POST — Create a bandwidth upgrade purchase
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nullifyEmptyStrings } from '@/lib/nullify-empty-strings';

const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';

// GET /api/wifi/bandwidth-upgrade — List upgrades
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const guestId = searchParams.get('guestId');
    const paymentStatus = searchParams.get('paymentStatus');
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = { tenantId: TENANT_ID };

    if (guestId) where.guestId = guestId;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (propertyId) where.propertyId = propertyId;

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.createdAt = dateFilter;
    }

    const [upgrades, total] = await Promise.all([
      db.wiFiBandwidthUpgrade.findMany({
        where,
        include: {
          property: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.wiFiBandwidthUpgrade.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: upgrades,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching bandwidth upgrades:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch bandwidth upgrades' }, { status: 500 });
  }
}

// POST /api/wifi/bandwidth-upgrade — Create an upgrade purchase
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = nullifyEmptyStrings(body);

    const {
      guestId, bookingId, sessionId, username,
      fromPlanId, toPlanId, amount, currency, folioId,
    } = data;

    if (!sessionId && !username) {
      return NextResponse.json(
        { success: false, error: 'sessionId or username is required' },
        { status: 400 },
      );
    }
    if (!fromPlanId || !toPlanId) {
      return NextResponse.json(
        { success: false, error: 'fromPlanId and toPlanId are required' },
        { status: 400 },
      );
    }

    // Create the upgrade record and simulate CoA status
    const upgrade = await db.wiFiBandwidthUpgrade.create({
      data: {
        tenantId: TENANT_ID,
        guestId: (guestId as string) || null,
        propertyId: (data.propertyId as string) || null,
        bookingId: (bookingId as string) || null,
        sessionId: (sessionId as string) || null,
        username: (username as string) || null,
        fromPlanId: fromPlanId as string,
        toPlanId: toPlanId as string,
        amount: (amount as number) || 0,
        currency: (currency as string) || 'INR',
        folioId: (folioId as string) || null,
        paymentStatus: 'completed',
        coaStatus: 'applied',
        activatedAt: new Date(),
      },
      include: {
        property: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: upgrade, message: 'Bandwidth upgrade completed' }, { status: 201 });
  } catch (error) {
    console.error('Error creating bandwidth upgrade:', error);
    return NextResponse.json({ success: false, error: 'Failed to create bandwidth upgrade' }, { status: 500 });
  }
}
