export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { syncRestrictedNetwork } from '@/lib/restricted-network';

// ─── IP Overlap Helpers ─────────────────────────────────────────────────────

interface RangeInput {
  startIp?: string;
  endIp?: string;
  comment?: string;
}

/** Validate IPv4 format */
function isValidIp(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => {
    const n = parseInt(p, 10);
    return !isNaN(n) && n >= 0 && n <= 255 && p === String(n);
  });
}

/** Convert IPv4 string to 32-bit unsigned integer */
function ipToNum(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/** Validate a single range object: format + start <= end */
function validateRange(r: RangeInput, idx: number): string | null {
  if (!r.startIp || !r.endIp) return null; // skip incomplete
  const s = r.startIp.replace(/\/\d+$/, '');
  const e = r.endIp.replace(/\/\d+$/, '');
  if (!isValidIp(s)) return `Range ${idx + 1}: Invalid start IP "${s}"`;
  if (!isValidIp(e)) return `Range ${idx + 1}: Invalid end IP "${e}"`;
  if (ipToNum(s) > ipToNum(e)) return `Range ${idx + 1}: Start IP (${s}) must be less than or equal to End IP (${e})`;
  return null;
}

/** Check overlap between two ranges [s1,e1] and [s2,e2] */
function rangesOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 <= e2 && s2 <= e1;
}

/** Check self-overlap (ranges within the same payload) */
function findSelfOverlaps(ranges: RangeInput[]): string[] {
  const errors: string[] = [];
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const si = ranges[i].startIp?.replace(/\/\d+$/, '');
      const ei = ranges[i].endIp?.replace(/\/\d+$/, '');
      const sj = ranges[j].startIp?.replace(/\/\d+$/, '');
      const ej = ranges[j].endIp?.replace(/\/\d+$/, '');
      if (!si || !ei || !sj || !ej) continue;
      if (rangesOverlap(ipToNum(si), ipToNum(ei), ipToNum(sj), ipToNum(ej))) {
        errors.push(`Range ${i + 1} (${si}–${ei}) overlaps with Range ${j + 1} (${sj}–${ej})`);
      }
    }
  }
  return errors;
}

/** Check cross-pool overlap using PostgreSQL inet comparison */
async function findCrossPoolOverlaps(ranges: RangeInput[], excludePoolId?: string, tenantId?: string): Promise<string[]> {
  if (ranges.length === 0) return [];
  const errors: string[] = [];
  for (const range of ranges) {
    const s = range.startIp?.replace(/\/\d+$/, '');
    const e = range.endIp?.replace(/\/\d+$/, '');
    if (!s || !e) continue;

    const overlapping = await db.$queryRawUnsafe(`
      SELECT ip.name as pool_name, r."startIp"::text as "startIp", r."endIp"::text as "endIp"
      FROM "IpPoolRange" r
      JOIN "IpPool" ip ON ip.id = r."poolId"
      WHERE ($1::inet <= r."endIp" AND r."startIp" <= $2::inet)
      ${excludePoolId ? 'AND r."poolId" != $3::uuid' : ''}
      ${tenantId ? 'AND ip."tenantId" = $4::uuid' : ''}
      LIMIT 3
    `, s, e, ...(excludePoolId ? [excludePoolId] : []), ...(tenantId ? [tenantId] : [])) as any[];

    for (const hit of overlapping) {
      const hitStart = hit.startIp.replace(/\/\d+$/, '');
      const hitEnd = hit.endIp.replace(/\/\d+$/, '');
      errors.push(`${s}–${e} overlaps with pool "${hit.pool_name}" (${hitStart}–${hitEnd})`);
    }
  }
  return errors;
}

/** Full validation pass — returns combined error messages */
async function validateRanges(ranges: RangeInput[], excludePoolId?: string, tenantId?: string): Promise<string[]> {
  const errors: string[] = [];

  // 1. Per-range format validation
  for (let i = 0; i < ranges.length; i++) {
    const err = validateRange(ranges[i], i);
    if (err) errors.push(err);
  }
  if (errors.length) return errors;

  // 2. Self-overlap check
  const selfErrors = findSelfOverlaps(ranges);
  errors.push(...selfErrors);
  if (selfErrors.length) return errors;

  // 3. Cross-pool overlap check
  const crossErrors = await findCrossPoolOverlaps(ranges, excludePoolId, tenantId);
  errors.push(...crossErrors);

  return errors;
}

// ─── GET: List all IP pools with ranges ─────────────────────────────────────
export async function GET(request: NextRequest) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const propertyId = searchParams.get('propertyId') || '';

    const pools = await db.$queryRawUnsafe(`
      SELECT
        ip.id, ip."tenantId", ip."propertyId", ip.name, ip.description,
        ip.gateway::text as gateway,
        ip.subnet::text as subnet,
        ip."isDefault", ip."captivePortal", ip.enabled,
        ip."createdAt", ip."updatedAt",
        COALESCE(pc.cnt, 0)::int as _planCount,
        COALESCE(uc.cnt, 0)::int as _userCount,
        COALESCE(rc.cnt, 0)::int as _rangeCount
      FROM "IpPool" ip
      -- Plans: count via WiFiPlanIPPool junction table (the primary plan↔pool link)
      LEFT JOIN (SELECT pp."poolId", COUNT(*)::int as cnt FROM "WiFiPlanIPPool" pp GROUP BY pp."poolId") pc ON pc."poolId" = ip.id
      -- Users: count WiFiUsers whose plan is linked to this pool via WiFiPlanIPPool
      LEFT JOIN (
        SELECT pp."poolId", COUNT(*)::int as cnt
        FROM "WiFiPlanIPPool" pp
        JOIN "WiFiUser" wu ON wu."planId" = pp."planId" AND wu.status = 'active'
        GROUP BY pp."poolId"
      ) uc ON uc."poolId" = ip.id
      LEFT JOIN (SELECT "poolId", COUNT(*)::int as cnt FROM "IpPoolRange" GROUP BY "poolId") rc ON rc."poolId" = ip.id
      WHERE ip."tenantId" = $3::uuid
      AND ($1::text = '' OR ip.name ILIKE '%' || $1 || '%' OR ip.description ILIKE '%' || $1 || '%')
      AND ($2::text = '' OR ip."propertyId"::text = $2)
      ORDER BY ip."isDefault" DESC, ip.enabled DESC, ip.name ASC
    `, search, propertyId, ctx.tenantId);

    // Fetch ranges for each pool
    const poolIds = (pools as any[]).map((p: any) => p.id);
    let ranges: any[] = [];
    if (poolIds.length > 0) {
      const placeholders = poolIds.map((_, i) => `\$${i + 1}::uuid`).join(',');
      ranges = await db.$queryRawUnsafe(`
        SELECT r.id, r."poolId", r."startIp"::text as "startIp", r."endIp"::text as "endIp", r.comment, r."createdAt",
               (r."endIp" - r."startIp" + 1)::numeric as total_ips
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
        plans: p._planCount || p._plancount || 0,
        users: p._userCount || p._usercount || 0,
        ranges: p._rangeCount || p._rangecount || 0,
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
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await request.json();
    const { name, description, gateway, subnet, isDefault, captivePortal, propertyId, enabled, ranges } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: 'Pool name is required' } },
        { status: 400 }
      );
    }

    // Validate ranges
    const validRanges = (ranges || []).filter((r: RangeInput) => r.startIp && r.endIp);
    if (validRanges.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'At least one valid IP range is required' } },
        { status: 400 }
      );
    }
    const validationErrors = await validateRanges(validRanges, undefined, ctx.tenantId);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: { message: 'IP range validation failed', details: validationErrors } },
        { status: 409 }
      );
    }

    // If setting as default, clear existing default
    if (isDefault) {
      await db.$executeRawUnsafe(`UPDATE "IpPool" SET "isDefault" = false WHERE "tenantId" = $1::uuid`, ctx.tenantId);
    }

    // Sanitize inet fields: only pass valid IP/CIDR, otherwise null
    const safeGateway = (gateway && gateway.trim() && isValidIp(gateway.trim())) ? gateway.trim() : null;
    const safeSubnet = (subnet && subnet.trim() && subnet.trim().includes('/') && isValidIp(subnet.trim().split('/')[0])) ? subnet.trim() : null;

    // Create pool
    const result = await db.$queryRawUnsafe(`
      INSERT INTO "IpPool" (id, "tenantId", "propertyId", name, description, gateway, subnet, "isDefault", "captivePortal", enabled, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5::inet, $6::inet, $7, $8, $9, NOW(), NOW())
      RETURNING id, "tenantId", "propertyId", name, description,
                gateway::text as gateway, subnet::text as subnet,
                "isDefault", "captivePortal", enabled, "createdAt", "updatedAt"
    `, 
      ctx.tenantId,
      propertyId || null,
      name.trim(),
      description || null,
      safeGateway,
      safeSubnet,
      isDefault ? true : false,
      captivePortal ? true : false,
      enabled !== false
    ) as any[];

    const pool = result[0];

    // Sync /etc/restrictednetwork
    await syncRestrictedNetwork();

    // Create ranges
    for (const range of validRanges) {
      await db.$queryRawUnsafe(`
        INSERT INTO "IpPoolRange" (id, "poolId", "startIp", "endIp", comment, "createdAt")
        VALUES (gen_random_uuid(), $1::uuid, $2::inet, $3::inet, $4, NOW())
      `, pool.id, range.startIp, range.endIp, range.comment || null);
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
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await request.json();
    const { id, name, description, gateway, subnet, isDefault, captivePortal, enabled, ranges } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'Pool ID is required' } },
        { status: 400 }
      );
    }

    // Validate ranges if provided
    if (ranges !== undefined && ranges.length > 0) {
      const validRanges = ranges.filter((r: RangeInput) => r.startIp && r.endIp);
      if (validRanges.length === 0) {
        return NextResponse.json(
          { success: false, error: { message: 'At least one valid IP range is required' } },
          { status: 400 }
        );
      }
      const validationErrors = await validateRanges(validRanges, id, ctx.tenantId);
      if (validationErrors.length > 0) {
        return NextResponse.json(
          { success: false, error: { message: 'IP range validation failed', details: validationErrors } },
          { status: 409 }
        );
      }
    }

    // If setting as default, clear existing default for this tenant
    if (isDefault) {
      await db.$executeRawUnsafe(`UPDATE "IpPool" SET "isDefault" = false WHERE "tenantId" = $1::uuid AND id != $2::uuid`, ctx.tenantId, id);
    }

    // Sanitize inet fields: only pass valid IP/CIDR, otherwise null
    const safeGateway = (gateway && gateway.trim() && isValidIp(gateway.trim())) ? gateway.trim() : null;
    const safeSubnet = (subnet && subnet.trim() && subnet.trim().includes('/') && isValidIp(subnet.trim().split('/')[0])) ? subnet.trim() : null;

    // Update pool with tenant isolation
    const result = await db.$queryRawUnsafe(`
      UPDATE "IpPool" SET
        name = $2,
        description = $3,
        gateway = $4::inet,
        subnet = $5::inet,
        "isDefault" = $6,
        "captivePortal" = $7,
        enabled = $8,
        "updatedAt" = now()
      WHERE id = $1::uuid AND "tenantId" = $9::uuid
      RETURNING id, "tenantId", "propertyId", name, description,
                gateway::text as gateway, subnet::text as subnet,
                "isDefault", "captivePortal", enabled, "createdAt", "updatedAt"
    `, id, name, description || null, safeGateway, safeSubnet, isDefault ? true : false, captivePortal ? true : false, enabled !== false, ctx.tenantId) as any[];

    if (!result.length) {
      return NextResponse.json(
        { success: false, error: { message: 'IP pool not found' } },
        { status: 404 }
      );
    }

    // Update ranges: delete existing and re-insert
    if (ranges !== undefined) {
      const validRanges = ranges.filter((r: RangeInput) => r.startIp && r.endIp);
      await db.$executeRawUnsafe(`DELETE FROM "IpPoolRange" WHERE "poolId" = $1::uuid`, id);
      for (const range of validRanges) {
        await db.$queryRawUnsafe(`
          INSERT INTO "IpPoolRange" (id, "poolId", "startIp", "endIp", comment, "createdAt")
          VALUES (gen_random_uuid(), $1::uuid, $2::inet, $3::inet, $4, NOW())
        `, id, range.startIp, range.endIp, range.comment || null);
      }
    }

    // Sync /etc/restrictednetwork
    await syncRestrictedNetwork();

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
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'Pool ID is required' } },
        { status: 400 }
      );
    }

    // Check if pool exists and belongs to this tenant
    const poolCheck = await db.$queryRawUnsafe(`SELECT id, name, "isDefault" FROM "IpPool" WHERE id = $1::uuid AND "tenantId" = $2::uuid`, id, ctx.tenantId) as any[];

    if (!poolCheck.length) {
      return NextResponse.json(
        { success: false, error: { message: 'IP pool not found' } },
        { status: 404 }
      );
    }

    // Check if pool is assigned to any plans or users
    const assignments = await db.$queryRawUnsafe(`
      SELECT 
        (SELECT COUNT(*)::int FROM "WiFiPlanIPPool" WHERE "poolId" = $1::uuid) as plan_count,
        (SELECT COUNT(*)::int FROM "WiFiUser" wu
         JOIN "WiFiPlanIPPool" pp ON pp."planId" = wu."planId" AND pp."poolId" = $1::uuid
         WHERE wu.status = 'active') as user_count
    `, id) as any[];

    if (assignments[0].plan_count > 0 || assignments[0].user_count > 0) {
      // Return 409 Conflict — pool is in use, don't silently clear assignments
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'POOL_IN_USE',
            message: `Cannot delete: pool is assigned to ${assignments[0].plan_count} plan(s) and ${assignments[0].user_count} user(s). Remove assignments first.`,
          },
        },
        { status: 409 },
      );
    }

    // Delete pool (ranges cascade)
    await db.$executeRawUnsafe(`DELETE FROM "IpPool" WHERE id = $1::uuid AND "tenantId" = $2::uuid`, id, ctx.tenantId);

    // Sync /etc/restrictednetwork
    await syncRestrictedNetwork();

    return NextResponse.json({ 
      success: true, 
      message: `IP pool "${poolCheck[0]?.name}" deleted successfully`,
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
