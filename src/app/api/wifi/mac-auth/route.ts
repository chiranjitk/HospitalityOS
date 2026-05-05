import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize MAC address to consistent format: AA:BB:CC:DD:EE:FF */
function normalizeMac(mac: string): string {
  return mac
    .replace(/[^0-9a-fA-F]/g, '')
    .toUpperCase()
    .replace(/(.{2})(?=.)/g, '$1:');
}

/** Validate MAC address format (6 hex pairs, separators optional) */
function isValidMac(mac: string): boolean {
  const cleaned = mac.replace(/[^0-9a-fA-F]/g, '');
  return cleaned.length === 12;
}

/** PRISMA_UNIQUE_VIOLATION */
const P2002 = 'P2002';

// ─── GET /api/wifi/mac-auth ─────────────────────────────────────────────────
// List all MAC auth entries, or check a single MAC via ?check=AA:BB:CC:DD:EE:FF

export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  const searchParams = request.nextUrl.searchParams;

  // ── Check single MAC endpoint: ?check=AA:BB:CC:DD:EE:FF ──
  const checkMac = searchParams.get('check');
  if (checkMac) {
    try {
      const normalizedMac = normalizeMac(checkMac);
      if (!isValidMac(checkMac)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid MAC address format' } },
          { status: 400 }
        );
      }

      const propertyId = await resolvePropertyId(user, searchParams.get('propertyId'));
      if (!propertyId) {
        return NextResponse.json(
          { success: false, error: { code: 'NO_PROPERTY', message: 'No property found for this tenant' } },
          { status: 400 }
        );
      }

      const entry = await db.radiusMacAuth.findUnique({
        where: { propertyId_macAddress: { propertyId, macAddress: normalizedMac } },
      });

      // Check if entry has expired
      let status = entry?.status || 'active';
      if (entry?.validUntil && entry.validUntil < new Date()) {
        status = 'expired';
        // Auto-update expired status
        await db.radiusMacAuth.update({
          where: { id: entry.id },
          data: { status: 'expired' },
        }).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        data: entry ? { ...entry, status } : null,
        found: !!entry,
      });
    } catch (error) {
      console.error('[MAC Auth] Check MAC error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to check MAC address' } },
        { status: 500 }
      );
    }
  }

  // ── List all MAC auth entries ──
  try {
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const propertyId = await resolvePropertyId(user, searchParams.get('propertyId'));
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_PROPERTY', message: 'No property found for this tenant' } },
        { status: 400 }
      );
    }

    // Build where clause
    const where: Record<string, unknown> = { propertyId };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      const q = search.toUpperCase();
      where.OR = [
        { macAddress: { contains: q } },
        { username: { contains: search, mode: 'insensitive' } },
        { guestName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Auto-expire entries whose validUntil has passed
    await db.radiusMacAuth.updateMany({
      where: {
        propertyId,
        status: 'active',
        validUntil: { lt: new Date() },
      },
      data: { status: 'expired' },
    }).catch(() => {});

    // Allowed sort fields
    const allowedSortFields = ['createdAt', 'updatedAt', 'macAddress', 'guestName', 'lastSeenAt', 'status', 'validUntil'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const entries = await db.radiusMacAuth.findMany({
      where,
      orderBy: { [safeSortBy]: sortOrder },
      ...(limit ? { take: parseInt(limit, 10) } : {}),
      ...(offset ? { skip: parseInt(offset, 10) } : {}),
    });

    const total = await db.radiusMacAuth.count({ where });

    // Summary stats
    const summary = await db.radiusMacAuth.aggregate({
      where: { propertyId },
      _count: true,
    });

    const activeCount = await db.radiusMacAuth.count({
      where: { propertyId, status: 'active' },
    });

    return NextResponse.json({
      success: true,
      data: entries,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        total: summary._count,
        active: activeCount,
        expired: total - activeCount,
      },
    });
  } catch (error) {
    console.error('[MAC Auth] List error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch MAC auth entries' } },
      { status: 500 }
    );
  }
}

// ─── POST /api/wifi/mac-auth ────────────────────────────────────────────────
// Create single MAC entry, or bulk import via { action: 'import', macs: [...] }

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const propertyId = await resolvePropertyId(user, searchParams.get('propertyId') || body.propertyId);
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_PROPERTY', message: 'No property found for this tenant' } },
        { status: 400 }
      );
    }

    // ── Bulk Import: { action: 'import', macs: string[] } ──
    if (body.action === 'import') {
      const macs: string[] = body.macs || [];
      if (!Array.isArray(macs) || macs.length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'No MAC addresses provided for import' } },
          { status: 400 }
        );
      }

      if (macs.length > 500) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Maximum 500 MAC addresses per import' } },
          { status: 400 }
        );
      }

      let created = 0;
      let skipped = 0;
      const errors: Array<{ mac: string; reason: string }> = [];

      for (const rawMac of macs) {
        const trimmed = rawMac.trim();
        if (!trimmed) continue;

        if (!isValidMac(trimmed)) {
          errors.push({ mac: trimmed, reason: 'Invalid MAC format' });
          skipped++;
          continue;
        }

        const normalized = normalizeMac(trimmed);

        try {
          await db.radiusMacAuth.create({
            data: {
              propertyId,
              macAddress: normalized,
              autoLogin: true,
              status: 'active',
              validFrom: new Date(),
            },
          });
          created++;
        } catch (err: unknown) {
          if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === P2002) {
            skipped++;
            errors.push({ mac: normalized, reason: 'Already exists' });
          } else {
            errors.push({ mac: normalized, reason: 'Database error' });
            skipped++;
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: { created, skipped, errors },
        message: `Imported ${created} MAC addresses (${skipped} skipped)`,
      });
    }

    // ── Single Create ──
    const {
      macAddress,
      username,
      guestName,
      description,
      autoLogin = true,
      validFrom,
      validUntil,
      bandwidthDown,
      bandwidthUp,
      sessionTimeout,
      dataLimitMB,
      groupName,
      planId,
    } = body;

    if (!macAddress || !macAddress.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'MAC address is required' } },
        { status: 400 }
      );
    }

    if (!isValidMac(macAddress)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid MAC address format. Expected: AA:BB:CC:DD:EE:FF' } },
        { status: 400 }
      );
    }

    const normalized = normalizeMac(macAddress);

    // Resolve plan name for groupName if planId provided but no groupName
    let resolvedGroupName = groupName;
    if (planId && !resolvedGroupName) {
      const plan = await db.wiFiPlan.findUnique({
        where: { id: planId },
        select: { name: true },
      });
      if (plan) {
        resolvedGroupName = plan.name;
      }
    }

    // Determine initial status
    let initialStatus = 'active';
    if (validUntil) {
      const validUntilDate = new Date(validUntil);
      if (validUntilDate < new Date()) {
        initialStatus = 'expired';
      }
    }

    const entry = await db.radiusMacAuth.create({
      data: {
        propertyId,
        macAddress: normalized,
        username: username || null,
        guestName: guestName || null,
        description: description || null,
        autoLogin: typeof autoLogin === 'boolean' ? autoLogin : true,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        bandwidthDown: bandwidthDown ? parseInt(bandwidthDown, 10) : null,
        bandwidthUp: bandwidthUp ? parseInt(bandwidthUp, 10) : null,
        sessionTimeout: sessionTimeout ? parseInt(sessionTimeout, 10) : null,
        dataLimitMB: dataLimitMB ? parseInt(dataLimitMB, 10) : null,
        groupName: resolvedGroupName || null,
        planId: planId || null,
        status: initialStatus,
      },
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === P2002) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'This MAC address already exists for this property' } },
        { status: 409 }
      );
    }
    console.error('[MAC Auth] Create error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create MAC auth entry' } },
      { status: 500 }
    );
  }
}

// ─── PUT /api/wifi/mac-auth ─────────────────────────────────────────────────
// Update a MAC auth entry: { id, ...fields }

export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const propertyId = await resolvePropertyId(user, searchParams.get('propertyId'));
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_PROPERTY', message: 'No property found for this tenant' } },
        { status: 400 }
      );
    }

    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Entry ID is required' } },
        { status: 400 }
      );
    }

    // Verify entry exists and belongs to this property
    const existing = await db.radiusMacAuth.findUnique({
      where: { id },
    });

    if (!existing || existing.propertyId !== propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'MAC auth entry not found' } },
        { status: 404 }
      );
    }

    // Resolve plan name for groupName if planId is being updated
    let resolvedGroupName = updateData.groupName;
    if (updateData.planId && !resolvedGroupName) {
      const plan = await db.wiFiPlan.findUnique({
        where: { id: updateData.planId },
        select: { name: true },
      });
      if (plan) {
        resolvedGroupName = plan.name;
      }
    }

    // Determine status from validUntil
    let newStatus = updateData.status;
    if (!newStatus && updateData.validUntil) {
      newStatus = new Date(updateData.validUntil) < new Date() ? 'expired' : 'active';
    }

    const entry = await db.radiusMacAuth.update({
      where: { id },
      data: {
        ...(updateData.username !== undefined && { username: updateData.username || null }),
        ...(updateData.guestName !== undefined && { guestName: updateData.guestName || null }),
        ...(updateData.description !== undefined && { description: updateData.description || null }),
        ...(updateData.autoLogin !== undefined && { autoLogin: Boolean(updateData.autoLogin) }),
        ...(updateData.validFrom !== undefined && { validFrom: updateData.validFrom ? new Date(updateData.validFrom) : new Date() }),
        ...(updateData.validUntil !== undefined && { validUntil: updateData.validUntil ? new Date(updateData.validUntil) : null }),
        ...(updateData.bandwidthDown !== undefined && { bandwidthDown: updateData.bandwidthDown ? parseInt(updateData.bandwidthDown, 10) : null }),
        ...(updateData.bandwidthUp !== undefined && { bandwidthUp: updateData.bandwidthUp ? parseInt(updateData.bandwidthUp, 10) : null }),
        ...(updateData.sessionTimeout !== undefined && { sessionTimeout: updateData.sessionTimeout ? parseInt(updateData.sessionTimeout, 10) : null }),
        ...(updateData.dataLimitMB !== undefined && { dataLimitMB: updateData.dataLimitMB ? parseInt(updateData.dataLimitMB, 10) : null }),
        ...(resolvedGroupName !== undefined && { groupName: resolvedGroupName || null }),
        ...(updateData.planId !== undefined && { planId: updateData.planId || null }),
        ...(newStatus && { status: newStatus }),
      },
    });

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error('[MAC Auth] Update error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update MAC auth entry' } },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/wifi/mac-auth?id=xxx ───────────────────────────────────────
// Delete a MAC auth entry

export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = await resolvePropertyId(user, searchParams.get('propertyId'));
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_PROPERTY', message: 'No property found for this tenant' } },
        { status: 400 }
      );
    }

    const id = searchParams.get('id') || await request.json().then((b: any) => b?.id).catch(() => null);

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Entry ID is required' } },
        { status: 400 }
      );
    }

    // Verify entry exists and belongs to this property
    const existing = await db.radiusMacAuth.findUnique({
      where: { id },
    });

    if (!existing || existing.propertyId !== propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'MAC auth entry not found' } },
        { status: 404 }
      );
    }

    await db.radiusMacAuth.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'MAC auth entry deleted',
      data: { id, macAddress: existing.macAddress },
    });
  } catch (error) {
    console.error('[MAC Auth] Delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete MAC auth entry' } },
      { status: 500 }
    );
  }
}
