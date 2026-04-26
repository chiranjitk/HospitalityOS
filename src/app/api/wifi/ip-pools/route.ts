import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── GET: List all IP pools with ranges ─────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const propertyId = searchParams.get('propertyId') || '';

    const pools = await db.$queryRawUnsafe(`
      SELECT 
        ip.*,
        COALESCE(pc.cnt, 0)::int as _planCount,
        COALESCE(uc.cnt, 0)::int as _userCount,
        COALESCE(rc.cnt, 0)::int as _rangeCount
      FROM "IpPool" ip
      LEFT JOIN (SELECT "ipPoolId", COUNT(*)::int as cnt FROM "WiFiPlan" WHERE "ipPoolId" IS NOT NULL GROUP BY "ipPoolId") pc ON pc."ipPoolId" = ip.id
      LEFT JOIN (SELECT "ipPoolId", COUNT(*)::int as cnt FROM "WiFiUser" WHERE "ipPoolId" IS NOT NULL GROUP BY "ipPoolId") uc ON uc."ipPoolId" = ip.id
      LEFT JOIN (SELECT "poolId", COUNT(*)::int as cnt FROM "IpPoolRange" GROUP BY "poolId") rc ON rc."poolId" = ip.id
      WHERE ($1::text = '' OR ip.name ILIKE '%' || $1 || '%' OR ip.description ILIKE '%' || $1 || '%')
      AND ($2::text = '' OR ip."propertyId" = $2::uuid)
      ORDER BY ip."isDefault" DESC, ip.enabled DESC, ip.name ASC
    `, search, propertyId);

    // Fetch ranges for each pool
    const poolIds = (pools as any[]).map((p: any) => p.id);
    let ranges: any[] = [];
    if (poolIds.length > 0) {
      const placeholders = poolIds.map((_, i) => `\$${i + 1}`).join(',');
      ranges = await db.$queryRawUnsafe(`
        SELECT r.*, (r."endIp" - r."startIp" + 1) as total_ips
        FROM "IpPoolRange" r
        WHERE r."poolId" IN (${placeholders})
        ORDER BY r."startIp"
      `, ...poolIds) as any[];
    }

    // Group ranges by pool
    const rangeMap: Record<string, any[]> = {};
    for (const r of ranges) {
      if (!rangeMap[(r as any).poolId]) rangeMap[(r as any).poolId] = [];
      rangeMap[(r as any).poolId].push(r);
    }

    const enriched = (pools as any[]).map((p: any) => ({
      ...p,
      ranges: rangeMap[p.id] || [],
      _count: {
        plans: p._planCount || 0,
        users: p._userCount || 0,
        ranges: p._rangeCount || 0,
      }
    }));

    // Summary
    const summary = {
      totalPools: enriched.length,
      activePools: enriched.filter((p: any) => p.enabled).length,
      defaultPool: enriched.find((p: any) => p.isDefault)?.name || 'None',
      totalRanges: enriched.reduce((acc: number, p: any) => acc + p._count.ranges, 0),
    };

    return NextResponse.json({ success: true, data: enriched, summary });
  } catch (error: any) {
    console.error('Error fetching IP pools:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch IP pools', details: error.message } },
      { status: 500 }
    );
  }
}

// ─── POST: Create IP pool ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, gateway, dnsServers, subnet, isDefault, propertyId, enabled, ranges } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: 'Pool name is required' } },
        { status: 400 }
      );
    }

    // Get tenant ID
    const tenants = await db.$queryRawUnsafe(`SELECT id FROM "Tenant" LIMIT 1`) as any[];
    if (!tenants.length) {
      return NextResponse.json(
        { success: false, error: { message: 'No tenant found' } },
        { status: 400 }
      );
    }
    const tenantId = tenants[0].id;

    // If setting as default, clear existing default
    if (isDefault) {
      await db.$executeRawUnsafe(`UPDATE "IpPool" SET "isDefault" = false WHERE "tenantId" = $1::uuid`, tenantId);
    }

    // Create pool
    const result = await db.$queryRawUnsafe(`
      INSERT INTO "IpPool" ("tenantId", "propertyId", name, description, gateway, "dnsServers", subnet, "isDefault", enabled)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5::inet, $6, $7::inet, $8, $9)
      RETURNING *
    `, 
      tenantId,
      propertyId || null,
      name.trim(),
      description || null,
      gateway || null,
      dnsServers || '8.8.8.8,8.8.4.4',
      subnet || null,
      isDefault ? true : false,
      enabled !== false
    ) as any[];

    const pool = result[0];

    // Create ranges if provided
    if (ranges?.length > 0) {
      for (const range of ranges) {
        if (!range.startIp || !range.endIp) continue;
        await db.$queryRawUnsafe(`
          INSERT INTO "IpPoolRange" ("poolId", "startIp", "endIp", comment)
          VALUES ($1::uuid, $2::inet, $3::inet, $4)
        `, pool.id, range.startIp, range.endIp, range.comment || null);
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: pool,
      message: `IP pool "${name}" created successfully`
    });
  } catch (error: any) {
    if (error?.message?.includes('IpPool_tenantId_name_key')) {
      return NextResponse.json(
        { success: false, error: { message: 'An IP pool with this name already exists' } },
        { status: 409 }
      );
    }
    console.error('Error creating IP pool:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to create IP pool', details: error.message } },
      { status: 500 }
    );
  }
}

// ─── PUT: Update IP pool ────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, gateway, dnsServers, subnet, isDefault, enabled, ranges } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'Pool ID is required' } },
        { status: 400 }
      );
    }

    // If setting as default, clear existing default
    if (isDefault) {
      const tenants = await db.$queryRawUnsafe(`SELECT "tenantId" FROM "IpPool" WHERE id = $1::uuid`, id) as any[];
      if (tenants.length) {
        await db.$executeRawUnsafe(`UPDATE "IpPool" SET "isDefault" = false WHERE "tenantId" = $1::uuid AND id != $2::uuid`, tenants[0].tenantId, id);
      }
    }

    // Update pool
    const result = await db.$queryRawUnsafe(`
      UPDATE "IpPool" SET
        name = $2,
        description = $3,
        gateway = $4::inet,
        "dnsServers" = $5,
        subnet = $6::inet,
        "isDefault" = $7,
        enabled = $8,
        "updatedAt" = now()
      WHERE id = $1::uuid
      RETURNING *
    `, id, name, description || null, gateway || null, dnsServers || '8.8.8.8,8.8.4.4', subnet || null, isDefault ? true : false, enabled !== false) as any[];

    if (!result.length) {
      return NextResponse.json(
        { success: false, error: { message: 'IP pool not found' } },
        { status: 404 }
      );
    }

    // Update ranges: delete existing and re-insert
    if (ranges !== undefined) {
      await db.$executeRawUnsafe(`DELETE FROM "IpPoolRange" WHERE "poolId" = $1::uuid`, id);
      for (const range of ranges) {
        if (!range.startIp || !range.endIp) continue;
        await db.$queryRawUnsafe(`
          INSERT INTO "IpPoolRange" ("poolId", "startIp", "endIp", comment)
          VALUES ($1::uuid, $2::inet, $3::inet, $4)
        `, id, range.startIp, range.endIp, range.comment || null);
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: result[0],
      message: `IP pool "${name}" updated successfully`
    });
  } catch (error: any) {
    console.error('Error updating IP pool:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update IP pool', details: error.message } },
      { status: 500 }
    );
  }
}

// ─── DELETE: Delete IP pool ─────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'Pool ID is required' } },
        { status: 400 }
      );
    }

    // Check if pool is assigned to any plans or users
    const assignments = await db.$queryRawUnsafe(`
      SELECT 
        (SELECT COUNT(*)::int FROM "WiFiPlan" WHERE "ipPoolId" = $1::uuid) as plan_count,
        (SELECT COUNT(*)::int FROM "WiFiUser" WHERE "ipPoolId" = $1::uuid) as user_count
    `, id) as any[];

    const poolInfo = await db.$queryRawUnsafe(`SELECT name, "isDefault" FROM "IpPool" WHERE id = $1::uuid`, id) as any[];

    if (assignments[0].plan_count > 0 || assignments[0].user_count > 0) {
      // Clear assignments instead of deleting
      await db.$executeRawUnsafe(`UPDATE "WiFiPlan" SET "ipPoolId" = NULL WHERE "ipPoolId" = $1::uuid`, id);
      await db.$executeRawUnsafe(`UPDATE "WiFiUser" SET "ipPoolId" = NULL WHERE "ipPoolId" = $1::uuid`, id);
    }

    // Delete pool (ranges cascade)
    await db.$executeRawUnsafe(`DELETE FROM "IpPool" WHERE id = $1::uuid`, id);

    return NextResponse.json({ 
      success: true, 
      message: `IP pool "${poolInfo[0]?.name}" deleted successfully`,
      unassigned: {
        plans: assignments[0].plan_count,
        users: assignments[0].user_count,
      }
    });
  } catch (error: any) {
    console.error('Error deleting IP pool:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to delete IP pool', details: error.message } },
      { status: 500 }
    );
  }
}
