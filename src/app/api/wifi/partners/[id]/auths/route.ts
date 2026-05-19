/**
 * WiFi Partner Auth Sessions API
 *
 * GET — List auth sessions for a specific partner (paginated, filterable by date range)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/wifi/partners/[id]/auths — List auth sessions for a partner
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  try {
    const { id: partnerId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Verify partner belongs to tenant
    const partner = await db.wiFiPartner.findFirst({
      where: { id: partnerId, tenantId },
      select: { id: true, name: true },
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 },
      );
    }

    const where: Record<string, unknown> = {
      tenantId,
      partnerId,
    };

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.createdAt = dateFilter;
    }

    const [auths, total] = await Promise.all([
      db.wiFiPartnerAuth.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          partner: {
            select: { id: true, name: true },
          },
        },
      }),
      db.wiFiPartnerAuth.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: auths,
      partner: partner,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching partner auth sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch auth sessions' },
      { status: 500 },
    );
  }
}
