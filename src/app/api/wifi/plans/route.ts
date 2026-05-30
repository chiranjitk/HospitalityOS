export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { syncRadiusGroup, deleteRadiusGroup, planNameToGroupName } from '@/lib/wifi/services/wifi-user-service';
import { updatePlanBandwidthForActiveSessions } from '@/lib/network/tc-bw-update';
import { RADCLIENT_BIN } from '@/lib/wifi/paths';
import { z } from 'zod';

// ──────────────────────────────────────────────
// Proactive migration: fix legacy suffixed group names in radusergroup
// e.g. "business_class_c7c7c7aa" → "business_class"
// Runs once per process, then skips. This ensures users get correct group
// attributes (bandwidth, Simultaneous-Use) from radgroupcheck/radgroupreply.
// ──────────────────────────────────────────────
let groupMigrationRan = false;

async function migrateStaleGroupNames() {
  if (groupMigrationRan) return;
  groupMigrationRan = true;
  try {
    // Get all plan names and their correct group names
    const plans = await db.wiFiPlan.findMany({ select: { name: true } });
    for (const plan of plans) {
      const correctName = planNameToGroupName(plan.name);
      // Find radusergroup entries with stale suffixed group names
      // e.g. "business_class_c7c7c7aa" should be "business_class"
      // Use PostgreSQL regex (~) to avoid SQL LIKE underscore wildcard issues
      const staleRows = await db.$queryRawUnsafe<{ groupname: string }[]>(
        `SELECT DISTINCT groupname FROM radusergroup WHERE groupname ~ ($1 || '_') AND groupname != $2`,
        correctName,
        correctName
      );
      for (const stale of staleRows) {
        const result = await db.radUserGroup.updateMany({
          where: { groupname: stale.groupname },
          data: { groupname: correctName },
        });
        if (result.count > 0) {
          console.log(`[plans:migrate] Fixed ${result.count} users: "${stale.groupname}" → "${correctName}"`);
        }
      }
    }
  } catch (err) {
    console.error('[plans:migrate] Failed to migrate stale group names:', err);
    // Reset flag so it retries on next request
    groupMigrationRan = false;
  }
}

// ──────────────────────────────────────────────
// M-48: Zod validation schemas
// ──────────────────────────────────────────────

const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(100),
  description: z.string().max(500).nullable().optional(),
  downloadSpeed: z.number().positive('Download speed must be positive'),
  uploadSpeed: z.number().positive('Upload speed must be positive'),
  burstDownloadSpeed: z.number().positive().optional(),
  burstUploadSpeed: z.number().positive().optional(),
  dataLimit: z.number().int().min(0).nullable().optional(),
  sessionLimit: z.number().int().min(0).nullable().optional(),
  maxDevices: z.number().int().min(1).max(100).optional().default(1),
  fupPolicyId: z.string().optional(),
  ipPoolId: z.string().optional(),
  ipPoolIds: z.array(z.object({
    poolId: z.string(),
    priority: z.number().optional(),
  })).optional(),
  price: z.number().min(0, 'Price must be non-negative').optional().default(0),
  currency: z.string().min(3).max(3).optional().default('USD'),
  priority: z.number().int().optional().default(0),
  validityDays: z.number().int().min(1).optional().default(1),
  validityMinutes: z.number().int().min(1).optional().default(1440),
  sessionTimeoutSec: z.number().int().min(0).optional(),
  idleTimeoutSec: z.number().int().min(0).optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

const updatePlanSchema = z.object({
  id: z.string().min(1, 'Plan id is required'),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  downloadSpeed: z.number().positive().optional(),
  uploadSpeed: z.number().positive().optional(),
  burstDownloadSpeed: z.number().positive().nullable().optional(),
  burstUploadSpeed: z.number().positive().nullable().optional(),
  dataLimit: z.number().int().min(0).nullable().optional(),
  sessionLimit: z.number().int().min(0).nullable().optional(),
  maxDevices: z.number().int().min(1).max(100).optional(),
  fupPolicyId: z.string().nullable().optional(),
  ipPoolId: z.string().nullable().optional(),
  ipPoolIds: z.array(z.object({
    poolId: z.string(),
    priority: z.number().optional(),
  })).optional(),
  price: z.number().min(0).optional(),
  currency: z.string().min(3).max(3).optional(),
  priority: z.number().int().optional(),
  validityDays: z.number().int().min(1).optional(),
  validityMinutes: z.number().int().min(1).optional(),
  sessionTimeoutSec: z.number().int().min(0).nullable().optional(),
  idleTimeoutSec: z.number().int().min(0).nullable().optional(),
  status: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  // Run proactive migration in background (fire-and-forget)
  migrateStaleGroupNames().catch(() => {});

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search,  } },
        { description: { contains: search,  } },
      ];
    }

    const plans = await db.wiFiPlan.findMany({
      where,
      include: {
        _count: {
          select: {
            vouchers: true,
            sessions: true,
            wifiUsers: { where: { status: 'active' } },
          },
        },
        fupPolicy: {
          select: { id: true, name: true },
        },
        ipPool: {
          select: { id: true, name: true },
        },
        planPools: {
          include: {
            pool: {
              select: { id: true, name: true },
            },
          },
          orderBy: { priority: 'asc' },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.wiFiPlan.count({ where });

    // Calculate summary statistics
    const activePlans = await db.wiFiPlan.count({
      where: { ...where, status: 'active' },
    });

    const avgPrice = await db.wiFiPlan.aggregate({
      where,
      _avg: {
        price: true,
      },
    });

    // Count total users assigned to plans with tenantId filter
    const totalUsersResult = await db.wiFiUser.groupBy({
      by: ['planId'],
      where: { planId: { not: null }, tenantId: user.tenantId },
      _count: true,
    });
    const totalUsers = totalUsersResult.reduce((sum: number, g: any) => sum + g._count, 0);

    return NextResponse.json({
      success: true,
      data: plans,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        totalPlans: total,
        activePlans,
        avgPrice: avgPrice._avg.price || 0,
        totalUsers,
      },
    });
  } catch (error) {
    console.error('Error fetching WiFi plans:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch WiFi plans' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/plans - Create a new WiFi plan
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    // M-48: Zod validation
    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') } },
        { status: 400 }
      );
    }

    const {
      name,
      description,
      downloadSpeed,
      uploadSpeed,
      burstDownloadSpeed,
      burstUploadSpeed,
      dataLimit,
      sessionLimit,
      maxDevices = 1,
      fupPolicyId,
      ipPoolId,
      ipPoolIds,
      price = 0,
      currency = 'USD',
      priority = 0,
      validityDays = 1,
      validityMinutes = 1440,
      sessionTimeoutSec,
      idleTimeoutSec,
      status = 'active',
    } = parsed.data;

    // Sanitize validity values
    const sanitizedValidityDays = Math.max(1, parseInt(validityDays, 10) || 1);
    const sanitizedValidityMinutes = Math.max(1, parseInt(String(validityMinutes), 10) || 1440);

    // Check for duplicate name
    const existingPlan = await db.wiFiPlan.findFirst({
      where: {
        tenantId,
        name: { equals: name,  },
      },
    });

    if (existingPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NAME', message: 'A WiFi plan with this name already exists' } },
        { status: 400 }
      );
    }

    // Unify maxDevices and sessionLimit: if sessionLimit not explicitly provided,
    // use maxDevices as the RADIUS Simultaneous-Use value.
    const effectiveSessionLimit = sessionLimit
      ? parseInt(sessionLimit, 10)
      : parseInt(maxDevices, 10);

    const plan = await db.wiFiPlan.create({
      data: {
        tenantId,
        name,
        description,
        downloadSpeed: parseInt(downloadSpeed, 10),
        uploadSpeed: parseInt(uploadSpeed, 10),
        burstDownloadSpeed: burstDownloadSpeed ? parseInt(burstDownloadSpeed, 10) : null,
        burstUploadSpeed: burstUploadSpeed ? parseInt(burstUploadSpeed, 10) : null,
        dataLimit: dataLimit ? parseInt(dataLimit, 10) : null,
        sessionLimit: effectiveSessionLimit,
        maxDevices: parseInt(maxDevices, 10),
        ...(fupPolicyId && { fupPolicyId }),
        ...(ipPoolId && { ipPoolId }),
        ...(ipPoolIds?.length && {
          planPools: {
            create: ipPoolIds.map((p: { poolId: string; priority?: number }, i: number) => ({
              poolId: p.poolId,
              priority: p.priority ?? i,
            })),
          },
        }),
        price: parseFloat(price),
        currency,
        priority: parseInt(priority, 10),
        validityDays: sanitizedValidityDays,
        validityMinutes: sanitizedValidityMinutes,
        ...(sessionTimeoutSec !== undefined && { sessionTimeoutSec: parseInt(sessionTimeoutSec, 10) || null }),
        ...(idleTimeoutSec !== undefined && { idleTimeoutSec: parseInt(idleTimeoutSec, 10) || null }),
        status,
      },
      include: {
        planPools: {
          include: {
            pool: {
              select: { id: true, name: true },
            },
          },
          orderBy: { priority: 'asc' },
        },
      },
    });

    // Sync RADIUS group attributes (radgroupcheck/radgroupreply) for this plan
    // sessionLimit (mapped from maxDevices) controls Simultaneous-Use in FreeRADIUS
    await syncRadiusGroup({ ...plan, sessionLimit: effectiveSessionLimit }).catch(err => {
      console.error('[plans] Failed to sync RADIUS group:', err);
    });

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error) {
    console.error('Error creating WiFi plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create WiFi plan' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/plans - Update a WiFi plan
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    // M-48: Zod validation
    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) {
      console.error('[plans] PUT validation error:', JSON.stringify(parsed.error.issues));
      console.error('[plans] PUT body was:', JSON.stringify(body).substring(0, 500));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') } },
        { status: 400 }
      );
    }

    const { id, ...updateData } = parsed.data;

    const existingPlan = await db.wiFiPlan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi plan not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation: verify plan belongs to user's tenant
    if (existingPlan.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi plan not found' } },
        { status: 404 }
      );
    }

    // Check for duplicate name if name is being updated
    if (updateData.name && updateData.name !== existingPlan.name) {
      const duplicateName = await db.wiFiPlan.findFirst({
        where: {
          tenantId: existingPlan.tenantId,
          name: { equals: updateData.name,  },
          id: { not: id },
        },
      });

      if (duplicateName) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_NAME', message: 'A WiFi plan with this name already exists' } },
          { status: 400 }
        );
      }
    }

    const plan = await db.wiFiPlan.update({
      where: { id },
      data: {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        ...(updateData.downloadSpeed !== undefined && { downloadSpeed: parseInt(updateData.downloadSpeed, 10) }),
        ...(updateData.uploadSpeed !== undefined && { uploadSpeed: parseInt(updateData.uploadSpeed, 10) }),
        ...(updateData.burstDownloadSpeed !== undefined && { burstDownloadSpeed: updateData.burstDownloadSpeed ? parseInt(updateData.burstDownloadSpeed, 10) : null }),
        ...(updateData.burstUploadSpeed !== undefined && { burstUploadSpeed: updateData.burstUploadSpeed ? parseInt(updateData.burstUploadSpeed, 10) : null }),
        ...(updateData.dataLimit !== undefined && { dataLimit: updateData.dataLimit ? parseInt(updateData.dataLimit, 10) : null }),
        ...(updateData.sessionLimit !== undefined && { sessionLimit: updateData.sessionLimit ? parseInt(updateData.sessionLimit, 10) : null }),
        ...(updateData.maxDevices !== undefined && { maxDevices: parseInt(updateData.maxDevices, 10) }),
        // Auto-sync: if maxDevices changed but sessionLimit wasn't explicitly provided,
        // update sessionLimit to match maxDevices (keeps app-level and RADIUS in sync)
        ...(updateData.maxDevices !== undefined && updateData.sessionLimit === undefined && { sessionLimit: parseInt(updateData.maxDevices, 10) }),
        ...(updateData.fupPolicyId !== undefined && { fupPolicyId: updateData.fupPolicyId || null }),
        ...(updateData.ipPoolId !== undefined && { ipPoolId: updateData.ipPoolId || null }),
        ...(updateData.price !== undefined && { price: parseFloat(updateData.price) }),
        ...(updateData.currency && { currency: updateData.currency }),
        ...(updateData.priority !== undefined && { priority: parseInt(updateData.priority, 10) }),
        ...(updateData.validityDays !== undefined && { validityDays: Math.max(1, parseInt(updateData.validityDays, 10) || 1) }),
        ...(updateData.validityMinutes !== undefined && { validityMinutes: Math.max(1, parseInt(updateData.validityMinutes, 10) || 1440) }),
        ...(updateData.sessionTimeoutSec !== undefined && { sessionTimeoutSec: updateData.sessionTimeoutSec ? parseInt(updateData.sessionTimeoutSec, 10) : null }),
        ...(updateData.idleTimeoutSec !== undefined && { idleTimeoutSec: updateData.idleTimeoutSec ? parseInt(updateData.idleTimeoutSec, 10) : null }),
        ...(updateData.status && { status: updateData.status }),
      },
    });

    // Update multi-pool mappings: delete all existing and recreate if provided
    if (updateData.ipPoolIds !== undefined) {
      await db.wiFiPlanIPPool.deleteMany({ where: { planId: id } });
      if (updateData.ipPoolIds.length > 0) {
        await db.wiFiPlanIPPool.createMany({
          data: updateData.ipPoolIds.map((p: { poolId: string; priority?: number }, i: number) => ({
            planId: id,
            poolId: p.poolId,
            priority: p.priority ?? i,
          })),
        });
      }
    }

    // Reload plan with planPools included for response
    const planWithPools = await db.wiFiPlan.findUnique({
      where: { id },
      include: {
        planPools: {
          include: {
            pool: {
              select: { id: true, name: true },
            },
          },
          orderBy: { priority: 'asc' },
        },
      },
    });

    // Sync RADIUS group attributes if plan settings changed
    // maxDevices change also triggers sync since it maps to Simultaneous-Use
    const bandwidthChanged = updateData.downloadSpeed !== undefined || updateData.uploadSpeed !== undefined
      || updateData.burstDownloadSpeed !== undefined || updateData.burstUploadSpeed !== undefined;
    if (updateData.name || bandwidthChanged ||
        updateData.dataLimit !== undefined || updateData.sessionLimit !== undefined ||
        updateData.maxDevices !== undefined ||
        updateData.sessionTimeoutSec !== undefined || updateData.idleTimeoutSec !== undefined) {
      await syncRadiusGroup(plan).catch(err => {
        console.error('[plans] Failed to sync RADIUS group on update:', err);
      });

      // Migrate any radusergroup entries that use old suffixed group names (e.g. "business_class_c7c7c7aa")
      // to the correct clean group name (e.g. "business_class"). This handles legacy data
      // from before the planId suffix was removed from planNameToGroupName().
      const correctGroupName = planNameToGroupName(plan.name);
      try {
        // Find all group names that start with the correct base but have extra suffixes
        const staleGroups = await db.$queryRawUnsafe<{ groupname: string }[]>(
          `SELECT DISTINCT groupname FROM radusergroup WHERE groupname LIKE $1 AND groupname != $2`,
          `${correctGroupName}%`,
          correctGroupName
        );
        for (const stale of staleGroups) {
          const migrateResult = await db.radUserGroup.updateMany({
            where: { groupname: stale.groupname },
            data: { groupname: correctGroupName },
          });
          if (migrateResult.count > 0) {
            console.log(`[plans] Migrated ${migrateResult.count} users from stale group "${stale.groupname}" to "${correctGroupName}"`);
          }
        }
      } catch (migrateErr) {
        console.error('[plans] Failed to migrate stale group names:', migrateErr);
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // Propagate maxDevices change to all existing users on this plan
    // When a plan's maxDevices is updated, existing users must get their
    // maxSessions (app-level) and radcheck Simultaneous-Use (RADIUS-level)
    // updated too — otherwise the old per-user values override the group.
    // ──────────────────────────────────────────────────────────────────
    if (updateData.maxDevices !== undefined) {
      const newMaxDevices = plan.maxDevices;
      try {
        // 1. Update WiFiUser.maxSessions for all active users on this plan
        const userUpdateResult = await db.wiFiUser.updateMany({
          where: {
            planId: id,
            status: 'active',
            maxSessions: { not: newMaxDevices }, // only update if different
          },
          data: { maxSessions: newMaxDevices },
        });

        // 2. Update per-user Simultaneous-Use in radcheck for all users on this plan
        //    This is critical because user-level radcheck takes precedence over
        //    group-level radgroupcheck in FreeRADIUS. Without this, users keep
        //    their old (smaller) limit even after the plan is updated.
        const radcheckResult = await db.$executeRawUnsafe(`
          UPDATE radcheck
          SET value = $1::text
          WHERE attribute = 'Simultaneous-Use'
            AND username IN (
              SELECT username FROM "WiFiUser" WHERE "planId" = $2::uuid AND status = 'active'
            )
            AND value != $1::text
        `, String(newMaxDevices), id);

        if (userUpdateResult.count > 0 || Number(radcheckResult) > 0) {
          console.log(`[plans:maxDevices] Plan "${plan.name}" maxDevices updated to ${newMaxDevices}: ` +
            `updated ${userUpdateResult.count} users' maxSessions, ${radcheckResult} radcheck entries`);
        }
      } catch (propagateErr) {
        console.error('[plans:maxDevices] Failed to propagate maxDevices to existing users:', propagateErr);
      }
    }

    // Push new bandwidth to active sessions on StaySuite NAS (127.0.0.1)
    // Uses tc class change — non-disruptive, no reconnect needed
    if (bandwidthChanged) {
      const dlMbps = plan.downloadSpeed || 10;
      const ulMbps = plan.uploadSpeed || 5;
      const dlCeilMbps = plan.burstDownloadSpeed || dlMbps;
      const ulCeilMbps = plan.burstUploadSpeed || ulMbps;
      try {
        const bwResult = await updatePlanBandwidthForActiveSessions(String(id), dlMbps, ulMbps, db, dlCeilMbps, ulCeilMbps);
        if (bwResult.updated > 0) {
          console.log(`[plans] Pushed ${dlMbps}/${ulMbps} Mbps to ${bwResult.updated} active sessions on plan ${plan.name} (local NAS)`);
        }
      } catch (bwErr) {
        console.error('[plans] Failed to push bandwidth to active sessions:', bwErr);
      }

      // Push bandwidth via CoA to external NAS (MikroTik, Cisco, etc.)
      // Local NAS uses TC — external NAS needs RADIUS CoA with vendor-specific attributes
      try {
        const externalSessions = await db.$queryRawUnsafe<Array<{
          username: string;
          framedipaddress: string;
          callingstationid: string;
          nasipaddress: string;
          acctsessionid: string;
        }>>(`
          SELECT DISTINCT ON (r.username)
            r.username, r.framedipaddress, r.callingstationid, r.nasipaddress, r.acctsessionid
          FROM radacct r
          JOIN "WiFiUser" u ON u.username = r.username
          WHERE r.acctstoptime IS NULL
            AND u."planId" = $1::uuid
            AND r.nasipaddress != '127.0.0.1'
            AND r.nasipaddress IS NOT NULL
            AND r.nasipaddress != ''
          ORDER BY r.username, r.acctstarttime DESC
        `, id);

        if (externalSessions.length > 0) {
          // Look up NAS type for vendor-specific CoA attributes
          const nasIps = [...new Set(externalSessions.map(s => s.nasipaddress?.replace(/\/\d+$/, '')))];
          const nasMap = new Map<string, { secret: string; coaPort: number; type: string }>();
          for (const nasIp of nasIps) {
            try {
              const nasRows = await db.$queryRawUnsafe<Array<{ secret: string; ports: number; type: string }>>(
                `SELECT secret, ports, type FROM nas WHERE nasname = $1 LIMIT 1`, nasIp
              );
              if (nasRows.length > 0) {
                nasMap.set(nasIp, { secret: nasRows[0].secret, coaPort: nasRows[0].ports || 3799, type: nasRows[0].type || 'other' });
              }
            } catch { /* skip */ }
          }

          const { execSync } = await import('child_process');
          const fs = await import('fs');
          let coaOk = 0;
          let coaFail = 0;

          for (const session of externalSessions) {
            const nasIp = session.nasipaddress?.replace(/\/\d+$/, '');
            const nasInfo = nasMap.get(nasIp);
            if (!nasInfo) { coaFail++; continue; }

            // Build vendor-specific CoA attributes
            let coaAttrs = `User-Name="${session.username}"`;
            const mac = (session.callingstationid || '').replace(/\/\d+$/, '');
            if (mac) coaAttrs += `\nCalling-Station-Id="${mac}"`;
            if (session.framedipaddress) coaAttrs += `\nFramed-IP-Address=${session.framedipaddress.replace(/\/\d+$/, '')}`;

            const vendor = (nasInfo.type || 'other').toLowerCase();
            // rx=upload, tx=download from NAS perspective
            const rateLimit = `${ulMbps}M/${dlMbps}M`;
            const dlBps = dlMbps * 1000000;
            const ulBps = ulMbps * 1000000;

            if (vendor === 'mikrotik') {
              coaAttrs += `\nMikrotik-Rate-Limit="${rateLimit}"`;
            } else if (vendor === 'cisco') {
              coaAttrs += `\nCisco-AVPair="sub:Ingress-Committed-Data-Rate=${ulBps}"\nCisco-AVPair="sub:Egress-Committed-Data-Rate=${dlBps}"`;
            } else {
              coaAttrs += `\nWISPr-Bandwidth-Max-Down=${dlBps}\nWISPr-Bandwidth-Max-Up=${ulBps}`;
            }

            const tmpFile = `/tmp/radclient-coa-${Date.now()}-${Math.random().toString(36).slice(2,6)}.txt`;
            try {
              fs.writeFileSync(tmpFile, coaAttrs + '\n');
              const cmd = `${RADCLIENT_BIN} -t 3 -r 1 ${nasIp}:${nasInfo.coaPort} coa ${nasInfo.secret} < ${tmpFile} 2>&1`;
              const output = execSync(cmd, { timeout: 5000 }).toString();
              if (output.includes('CoA-ACK')) {
                coaOk++;
                console.log(`[plans] CoA OK: ${session.username}@${nasIp} → ${rateLimit}`);
              } else {
                coaFail++;
                console.warn(`[plans] CoA FAIL: ${session.username}@${nasIp}: ${output.trim()}`);
              }
            } catch (execErr: unknown) {
              coaFail++;
              const errObj = execErr as Error & { stdout?: string; stderr?: string };
              const realOut = [errObj.stdout || '', errObj.stderr || ''].filter(Boolean).join('\n');
              console.warn(`[plans] CoA ERROR: ${session.username}@${nasIp}: ${realOut.trim()}`);
            } finally {
              try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
            }
          }
          console.log(`[plans] CoA bandwidth for plan ${plan.name}: ${coaOk} OK, ${coaFail} failed, ${externalSessions.length} total external sessions`);
        }
      } catch (coaErr) {
        console.error('[plans] External NAS CoA error:', coaErr);
      }
    }

    // Sync idle timeout to existing users on this plan if it changed
    if (updateData.idleTimeoutSec !== undefined) {
      try {
        const newIdleTimeout = updateData.idleTimeoutSec ? parseInt(updateData.idleTimeoutSec, 10) : 0;
        // Find all active WiFiUsers on this plan
        const usersOnPlan = await db.wiFiUser.findMany({
          where: { planId: id, status: 'active' },
          select: { id: true, username: true },
        });
        for (const u of usersOnPlan) {
          const existing = await db.radReply.findFirst({
            where: { username: u.username, attribute: 'Cryptsk-Idle-Timeout' },
          });
          if (newIdleTimeout > 0) {
            if (existing) {
              await db.radReply.update({ where: { id: existing.id }, data: { value: String(newIdleTimeout) } });
            } else {
              await db.radReply.create({
                data: { wifiUserId: u.id, username: u.username, attribute: 'Cryptsk-Idle-Timeout', op: ':=', value: String(newIdleTimeout), isActive: true },
              });
            }
          } else if (existing) {
            await db.radReply.delete({ where: { id: existing.id } });
          }
        }
      } catch (syncErr) {
        console.error('[plans] Failed to sync idle timeout to users:', syncErr);
      }
    }

    return NextResponse.json({ success: true, data: planWithPools || plan });
  } catch (error) {
    console.error('Error updating WiFi plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update WiFi plan' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/plans - Delete a WiFi plan
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: id' } },
        { status: 400 }
      );
    }

    const existingPlan = await db.wiFiPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            vouchers: true,
            sessions: true,
            wifiUsers: { where: { status: 'active' } },
          },
        },
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi plan not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation: verify plan belongs to user's tenant
    if (existingPlan.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi plan not found' } },
        { status: 404 }
      );
    }

    // Check if plan has active vouchers, sessions, or users
    if (existingPlan._count.vouchers > 0 || existingPlan._count.sessions > 0 || existingPlan._count.wifiUsers > 0) {
      // Soft delete by setting status to inactive
      const plan = await db.wiFiPlan.update({
        where: { id },
        data: { status: 'inactive' },
      });

      return NextResponse.json({
        success: true,
        data: plan,
        message: 'WiFi plan deactivated (has associated vouchers/sessions/users)',
      });
    }

    // Hard delete if no associations
    const planName = existingPlan.name;
    await db.wiFiPlan.delete({
      where: { id },
    });

    // Delete RADIUS group entries (radgroupcheck/radgroupreply/radusergroup)
    await deleteRadiusGroup(planName).catch(err => {
      console.error('[plans] Failed to delete RADIUS group:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'WiFi plan deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting WiFi plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete WiFi plan' } },
      { status: 500 }
    );
  }
}
