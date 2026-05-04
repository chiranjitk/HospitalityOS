import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/firewall/bandwidth-pools - List bandwidth pools with usage stats
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const enabled = searchParams.get('enabled');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (enabled !== null && enabled !== undefined) where.enabled = enabled === 'true';

    const pools = await db.bandwidthPool.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.bandwidthPool.count({ where });

    // Calculate aggregate usage stats for each pool's property
    const usageStats = await db.bandwidthUsageDaily.findMany({
      where: {
        tenantId: user.tenantId,
        ...(propertyId && { propertyId }),
        date: {
          gte: new Date(new Date().setDate(new Date().getDate() - 30)),
        },
      },
      select: {
        propertyId: true,
        totalDownloadMb: true,
        totalUploadMb: true,
        uniqueUsers: true,
        peakUsers: true,
      },
      orderBy: { date: 'desc' },
    });

    // Group usage by property
    const propertyUsage: Record<string, { totalDownloadMb: number; totalUploadMb: number; uniqueUsers: number; peakUsers: number }> = {};
    for (const stat of usageStats) {
      if (!propertyUsage[stat.propertyId]) {
        propertyUsage[stat.propertyId] = { totalDownloadMb: 0, totalUploadMb: 0, uniqueUsers: 0, peakUsers: 0 };
      }
      propertyUsage[stat.propertyId].totalDownloadMb += stat.totalDownloadMb;
      propertyUsage[stat.propertyId].totalUploadMb += stat.totalUploadMb;
      propertyUsage[stat.propertyId].uniqueUsers = Math.max(propertyUsage[stat.propertyId].uniqueUsers, stat.uniqueUsers);
      propertyUsage[stat.propertyId].peakUsers = Math.max(propertyUsage[stat.propertyId].peakUsers, stat.peakUsers);
    }

    return NextResponse.json({
      success: true,
      data: pools,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      usageStats: propertyUsage,
    });
  } catch (error) {
    console.error('Error fetching bandwidth pools:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bandwidth pools' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/firewall/bandwidth-pools - Create a new bandwidth pool
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId,
      name,
      subnet,
      vlanId,
      totalDownloadKbps = 2000000,
      totalUploadKbps = 2000000,
      perUserDownloadKbps,
      perUserUploadKbps,
      enabled = true,
    } = body;

    if (!propertyId || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name' } },
        { status: 400 }
      );
    }

    // Pool bandwidth validation: min 100 Mbps (100000 kbps), max 10 Gbit (10000000 kbps)
    const POOL_BW_MIN = 100000;   // 100 Mbps
    const POOL_BW_MAX = 10000000; // 10 Gbit (same as root class)

    if (totalDownloadKbps < POOL_BW_MIN || totalDownloadKbps > POOL_BW_MAX) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `totalDownloadKbps must be between 100 Mbps (100000) and 10 Gbit (10000000)` } },
        { status: 400 }
      );
    }
    if (totalUploadKbps < POOL_BW_MIN || totalUploadKbps > POOL_BW_MAX) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `totalUploadKbps must be between 100 Mbps (100000) and 10 Gbit (10000000)` } },
        { status: 400 }
      );
    }
    if (perUserDownloadKbps !== undefined && perUserDownloadKbps !== null && (perUserDownloadKbps < 0 || perUserDownloadKbps > POOL_BW_MAX)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'perUserDownloadKbps must be between 0 and 10 Gbit (10000000)' } },
        { status: 400 }
      );
    }
    if (perUserUploadKbps !== undefined && perUserUploadKbps !== null && (perUserUploadKbps < 0 || perUserUploadKbps > POOL_BW_MAX)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'perUserUploadKbps must be between 0 and 10 Gbit (10000000)' } },
        { status: 400 }
      );
    }

    const pool = await db.bandwidthPool.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        subnet,
        vlanId: vlanId !== undefined ? parseInt(vlanId, 10) : null,
        totalDownloadKbps: parseInt(totalDownloadKbps, 10),
        totalUploadKbps: parseInt(totalUploadKbps, 10),
        perUserDownloadKbps: perUserDownloadKbps ? parseInt(perUserDownloadKbps, 10) : null,
        perUserUploadKbps: perUserUploadKbps ? parseInt(perUserUploadKbps, 10) : null,
        enabled,
      },
    });

    // Invalidate pool classid cache — new pool changes the sequential mapping
    try {
      const { invalidatePoolCache } = await import('@/lib/network/script-runner');
      invalidatePoolCache();
    } catch { /* non-fatal */ }

    return NextResponse.json({ success: true, data: pool }, { status: 201 });
  } catch (error) {
    console.error('Error creating bandwidth pool:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create bandwidth pool' } },
      { status: 500 }
    );
  }
}
