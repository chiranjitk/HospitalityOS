import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { syncRadiusGroup, deleteRadiusGroup } from '@/lib/wifi/services/wifi-user-service';
import { updatePlanBandwidthForActiveSessions } from '@/lib/network/tc-bw-update';
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

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
          },
        },
        fupPolicy: {
          select: { id: true, name: true },
        },
        ipPool: {
          select: { id: true, name: true },
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

    // Count total users assigned to plans
    const totalUsersResult = await db.wiFiUser.groupBy({
      by: ['planId'],
      where: { planId: { not: null } },
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
export async function POST(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const tenantId = user.tenantId;

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
      price = 0,
      currency = 'USD',
      priority = 0,
      validityDays = 1,
      validityMinutes = 1440,
      sessionTimeoutSec,
      idleTimeoutSec,
      status = 'active',
    } = body;

    // Validate required fields
    if (!name || downloadSpeed === undefined || uploadSpeed === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: name, downloadSpeed, uploadSpeed' } },
        { status: 400 }
      );
    }

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
        sessionLimit: sessionLimit ? parseInt(sessionLimit, 10) : null,
        maxDevices: parseInt(maxDevices, 10),
        ...(fupPolicyId && { fupPolicyId }),
        ...(ipPoolId && { ipPoolId }),
        price: parseFloat(price),
        currency,
        priority: parseInt(priority, 10),
        validityDays: sanitizedValidityDays,
        validityMinutes: sanitizedValidityMinutes,
        ...(sessionTimeoutSec !== undefined && { sessionTimeoutSec: parseInt(sessionTimeoutSec, 10) || null }),
        ...(idleTimeoutSec !== undefined && { idleTimeoutSec: parseInt(idleTimeoutSec, 10) || null }),
        status,
      },
    });

    // Sync RADIUS group attributes (radgroupcheck/radgroupreply) for this plan
    await syncRadiusGroup(plan).catch(err => {
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
export async function PUT(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const tenantId = user.tenantId;
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: id' } },
        { status: 400 }
      );
    }

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

    // Sync RADIUS group attributes if plan settings changed
    const bandwidthChanged = updateData.downloadSpeed !== undefined || updateData.uploadSpeed !== undefined
      || updateData.burstDownloadSpeed !== undefined || updateData.burstUploadSpeed !== undefined;
    if (updateData.name || bandwidthChanged ||
        updateData.dataLimit !== undefined || updateData.sessionLimit !== undefined ||
        updateData.sessionTimeoutSec !== undefined || updateData.idleTimeoutSec !== undefined) {
      await syncRadiusGroup(plan).catch(err => {
        console.error('[plans] Failed to sync RADIUS group on update:', err);
      });
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
              const cmd = `/usr/bin/radclient -t 3 -r 1 ${nasIp}:${nasInfo.coaPort} coa ${nasInfo.secret} < ${tmpFile} 2>&1`;
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

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error('Error updating WiFi plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update WiFi plan' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/plans - Delete a WiFi plan
export async function DELETE(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
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

    // Check if plan has active vouchers or sessions
    if (existingPlan._count.vouchers > 0 || existingPlan._count.sessions > 0) {
      // Soft delete by setting status to inactive
      const plan = await db.wiFiPlan.update({
        where: { id },
        data: { status: 'inactive' },
      });

      return NextResponse.json({
        success: true,
        data: plan,
        message: 'WiFi plan deactivated (has associated vouchers/sessions)',
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
