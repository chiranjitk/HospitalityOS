import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/license-keys (AUTH REQUIRED)
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const session = await db.session.findFirst({
      where: { token: sessionToken, expiresAt: { gt: new Date() } },
      include: { user: { include: { tenant: true } } },
    });
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Platform admin only
    if (!session.user.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Platform admin access required' } },
        { status: 403 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const planId = searchParams.get('planId') || undefined;
    const search = searchParams.get('search') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }
    if (planId) {
      where.planId = planId;
    }
    if (search) {
      where.OR = [
        { key: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
        { generatedFor: { contains: search, mode: 'insensitive' } },
        { batchId: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch total count (may be filtered)
    const total = await db.licenseKey.count({ where });
    const totalPages = Math.ceil(total / limit);

    // Stats: count by status across ALL keys (not filtered by current status filter)
    const baseWhere: Record<string, unknown> = {};
    if (planId) baseWhere.planId = planId;
    if (search) {
      baseWhere.OR = where.OR;
    }
    const [statsActive, statsActivated, statsExpired, statsRevoked] = await Promise.all([
      db.licenseKey.count({ where: { ...baseWhere, status: 'active' } }),
      db.licenseKey.count({ where: { ...baseWhere, status: 'activated' } }),
      db.licenseKey.count({ where: { ...baseWhere, status: 'expired' } }),
      db.licenseKey.count({ where: { ...baseWhere, status: 'revoked' } }),
    ]);

    // Fetch paginated keys with plan
    const keys = await db.licenseKey.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    // Batch-fetch activatedBy users and tenants
    const activatedByIds = [...new Set(keys.filter((k) => k.activatedBy).map((k) => k.activatedBy!))];
    const tenantIds = [...new Set(keys.filter((k) => k.tenantId).map((k) => k.tenantId!))];

    const [users, tenants] = await Promise.all([
      activatedByIds.length > 0
        ? db.user.findMany({
            where: { id: { in: activatedByIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [],
      tenantIds.length > 0
        ? db.tenant.findMany({
            where: { id: { in: tenantIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));

    const formattedKeys = keys.map((k) => {
      const activatedUser = k.activatedBy ? userMap.get(k.activatedBy) : null;
      const tenant = k.tenantId ? tenantMap.get(k.tenantId) : null;

      return {
        id: k.id,
        key: k.key,
        planId: k.planId,
        plan: k.plan,
        status: k.status,
        generatedBy: k.generatedBy,
        generatedFor: k.generatedFor,
        activatedBy: k.activatedBy,
        activatedByName: activatedUser ? `${activatedUser.firstName} ${activatedUser.lastName}` : null,
        activatedByEmail: activatedUser?.email || null,
        activatedAt: k.activatedAt,
        tenantId: k.tenantId,
        tenantName: tenant?.name || null,
        expiresAt: k.expiresAt,
        note: k.note,
        batchId: k.batchId,
        createdAt: k.createdAt,
        updatedAt: k.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      keys: formattedKeys,
      stats: {
        total: statsActive + statsActivated + statsExpired + statsRevoked,
        active: statsActive,
        activated: statsActivated,
        expired: statsExpired,
        revoked: statsRevoked,
      },
      totalPages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Failed to fetch license keys:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch license keys' },
      { status: 500 }
    );
  }
}
