import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/channels/promo-codes?connectionId=X&channelCode=Y&isActive=true&isValid=true&action=usage-report
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'channels.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = user.tenantId;
    const connectionId = searchParams.get('connectionId');
    const channelCode = searchParams.get('channelCode');
    const isActiveParam = searchParams.get('isActive');
    const isValidParam = searchParams.get('isValid');
    const action = searchParams.get('action');

    const where: Record<string, unknown> = { tenantId };
    if (connectionId) where.connectionId = connectionId;
    if (channelCode) where.channelCode = channelCode;
    if (isActiveParam !== null && isActiveParam !== undefined && isActiveParam !== '') {
      where.isActive = isActiveParam === 'true';
    }

    // isValid: check if current date is within validFrom/validTo
    if (isValidParam === 'true') {
      const now = new Date();
      where.validFrom = { lte: now };
      where.validTo = { gte: now };
    } else if (isValidParam === 'false') {
      const now = new Date();
      where.OR = [
        { validFrom: { gt: now } },
        { validTo: { lt: now } },
      ];
    }

    // Usage report action
    if (action === 'usage-report') {
      const promos = await db.channelPromoCode.findMany({
        where: { tenantId },
        select: {
          id: true,
          promoCode: true,
          promoName: true,
          channelCode: true,
          usageLimit: true,
          usageCount: true,
          isActive: true,
          validFrom: true,
          validTo: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const report = promos.map((p) => ({
        ...p,
        remaining: p.usageLimit ? Math.max(0, p.usageLimit - p.usageCount) : null,
        usagePercent: p.usageLimit ? Math.round((p.usageCount / p.usageLimit) * 100) : null,
        isExpired: p.validTo < new Date(),
        isUpcoming: p.validFrom > new Date(),
        status: p.validTo < new Date() ? 'expired' : p.validFrom > new Date() ? 'upcoming' : 'active',
      }));

      const summary = {
        total: report.length,
        active: report.filter((r) => r.status === 'active').length,
        expired: report.filter((r) => r.status === 'expired').length,
        upcoming: report.filter((r) => r.status === 'upcoming').length,
        totalUsage: promos.reduce((acc, p) => acc + p.usageCount, 0),
        avgUsagePercent: report.filter((r) => r.usagePercent !== null).length > 0
          ? Math.round(report.filter((r) => r.usagePercent !== null).reduce((acc, r) => acc + (r.usagePercent || 0), 0) / report.filter((r) => r.usagePercent !== null).length)
          : 0,
      };

      return NextResponse.json({ success: true, data: { report, summary } });
    }

    const promos = await db.channelPromoCode.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });

    // Fetch channel connections for enriched display
    const connections = await db.channelConnection.findMany({
      where: { tenantId },
      select: { id: true, channel: true, displayName: true, status: true },
    });
    const connectionMap = new Map(connections.map((c) => [c.id, c]));

    const now = new Date();
    const enriched = promos.map((p) => {
      const isValid = now >= p.validFrom && now <= p.validTo;
      const isUpcoming = now < p.validFrom;
      const isExpired = now > p.validTo;
      return {
        ...p,
        connection: p.connectionId ? connectionMap.get(p.connectionId) || null : null,
        status: isExpired ? 'expired' : isUpcoming ? 'upcoming' : 'active',
        isValid,
        remaining: p.usageLimit ? Math.max(0, p.usageLimit - p.usageCount) : null,
      };
    });

    // Compute summary stats
    const total = enriched.length;
    const active = enriched.filter((p) => p.isActive && p.status === 'active').length;
    const expired = enriched.filter((p) => p.status === 'expired').length;
    const upcoming = enriched.filter((p) => p.status === 'upcoming').length;
    const totalUsage = enriched.reduce((acc, p) => acc + p.usageCount, 0);
    const synced = enriched.filter((p) => p.syncStatus === 'synced').length;

    return NextResponse.json({
      success: true,
      data: {
        promos: enriched,
        summary: { total, active, expired, upcoming, totalUsage, synced },
      },
    });
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch promo codes' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/promo-codes — Create, sync, or validate
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();

    // Handle action-based POST requests
    if (body.action === 'sync') {
      return handleSync(user, body);
    }
    if (body.action === 'validate') {
      return handleValidate(user, body);
    }

    // Standard create
    const {
      connectionId,
      channelCode,
      promoCode,
      promoName,
      description,
      discountType,
      discountValue,
      currency,
      freeNights,
      minStay,
      maxStay,
      applicableRoomTypes,
      applicableRatePlans,
      validFrom,
      validTo,
      bookingWindowFrom,
      bookingWindowTo,
      stayDateFrom,
      stayDateTo,
      blackoutDates,
      usageLimit,
      channelPromoId,
      channelPromoCode,
      isActive,
      propertyId,
    } = body;

    if (!channelCode || !promoCode || !promoName || !validFrom || !validTo) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'channelCode, promoCode, promoName, validFrom, and validTo are required' } },
        { status: 400 }
      );
    }

    // Verify connection belongs to tenant if provided
    if (connectionId) {
      const connection = await db.channelConnection.findFirst({
        where: { id: connectionId, tenantId: user.tenantId },
      });
      if (!connection) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found' } },
          { status: 404 }
        );
      }
    }

    const created = await db.channelPromoCode.create({
      data: {
        tenantId: user.tenantId,
        propertyId: propertyId || null,
        connectionId: connectionId || null,
        channelCode,
        promoCode: promoCode.toUpperCase(),
        promoName,
        description: description || null,
        discountType: discountType || 'percentage',
        discountValue: discountValue ?? 0,
        currency: currency || 'USD',
        freeNights: freeNights ?? null,
        minStay: minStay ?? null,
        maxStay: maxStay ?? null,
        applicableRoomTypes: applicableRoomTypes ? JSON.stringify(applicableRoomTypes) : null,
        applicableRatePlans: applicableRatePlans ? JSON.stringify(applicableRatePlans) : null,
        validFrom: new Date(validFrom),
        validTo: new Date(validTo),
        bookingWindowFrom: bookingWindowFrom ? new Date(bookingWindowFrom) : null,
        bookingWindowTo: bookingWindowTo ? new Date(bookingWindowTo) : null,
        stayDateFrom: stayDateFrom ? new Date(stayDateFrom) : null,
        stayDateTo: stayDateTo ? new Date(stayDateTo) : null,
        blackoutDates: blackoutDates ? JSON.stringify(blackoutDates) : null,
        usageLimit: usageLimit ?? null,
        channelPromoId: channelPromoId || null,
        channelPromoCode: channelPromoCode || null,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error('Error creating promo code:', error);
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'UNIQUE_VIOLATION', message: 'A promo code with this code already exists for this channel connection' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create promo code' } },
      { status: 500 }
    );
  }
}

// PUT /api/channels/promo-codes — Update a promo code
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    // Verify record belongs to tenant
    const existing = await db.channelPromoCode.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Promo code not found' } },
        { status: 404 }
      );
    }

    // Build update payload
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'connectionId', 'channelCode', 'promoCode', 'promoName', 'description',
      'discountType', 'discountValue', 'currency', 'freeNights',
      'minStay', 'maxStay', 'applicableRoomTypes', 'applicableRatePlans',
      'validFrom', 'validTo', 'bookingWindowFrom', 'bookingWindowTo',
      'stayDateFrom', 'stayDateTo', 'blackoutDates',
      'usageLimit', 'usageCount',
      'channelPromoId', 'channelPromoCode',
      'syncStatus', 'lastSyncedAt', 'lastError', 'isActive', 'propertyId',
    ];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (['applicableRoomTypes', 'applicableRatePlans', 'blackoutDates'].includes(field) && typeof data[field] !== 'string') {
          updateData[field] = JSON.stringify(data[field]);
        } else if (['validFrom', 'validTo', 'bookingWindowFrom', 'bookingWindowTo', 'stayDateFrom', 'stayDateTo'].includes(field) && data[field]) {
          updateData[field] = new Date(data[field]);
        } else if (field === 'promoCode') {
          updateData[field] = String(data[field]).toUpperCase();
        } else {
          updateData[field] = data[field];
        }
      }
    }

    const updated = await db.channelPromoCode.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating promo code:', error);
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'UNIQUE_VIOLATION', message: 'A promo code with this code already exists for this channel connection' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update promo code' } },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/promo-codes?id=X
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'channels.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    // Verify record belongs to tenant
    const existing = await db.channelPromoCode.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Promo code not found' } },
        { status: 404 }
      );
    }

    await db.channelPromoCode.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, data: { id, deleted: true } });
  } catch (error) {
    console.error('Error deleting promo code:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete promo code' } },
      { status: 500 }
    );
  }
}

// ============================================
// ACTION HANDLERS
// ============================================

async function handleSync(
  user: { tenantId: string },
  body: {
    connectionId: string;
    channelCode?: string;
    promoId?: string;
  }
) {
  const { connectionId, channelCode, promoId } = body;

  if (!connectionId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'connectionId is required for sync' } },
      { status: 400 }
    );
  }

  // Verify connection belongs to tenant
  const connection = await db.channelConnection.findFirst({
    where: { id: connectionId, tenantId: user.tenantId },
  });

  if (!connection) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found' } },
      { status: 404 }
    );
  }

  const effectiveChannelCode = channelCode || connection.channel;

  // Build where clause: sync specific promo or all active promos
  const where: Record<string, unknown> = {
    tenantId: user.tenantId,
    connectionId,
    channelCode: effectiveChannelCode,
    isActive: true,
  };
  if (promoId) {
    where.id = promoId;
  }

  const promos = await db.channelPromoCode.findMany({
    where,
  });

  if (promos.length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'No active promo codes found to sync' } },
      { status: 404 }
    );
  }

  const now = new Date();
  const syncedIds: string[] = [];

  // Update each promo's sync status
  for (const promo of promos) {
    await db.channelPromoCode.update({
      where: { id: promo.id },
      data: {
        syncStatus: 'synced',
        lastSyncedAt: now,
        lastError: null,
      },
    });
    syncedIds.push(promo.id);
  }

  // Build the promo payload to send to the channel
  const promoPayload = promos.map((p) => ({
    promoCode: p.promoCode,
    promoName: p.promoName,
    description: p.description,
    discountType: p.discountType,
    discountValue: p.discountValue,
    currency: p.currency,
    freeNights: p.freeNights,
    minStay: p.minStay,
    maxStay: p.maxStay,
    validFrom: p.validFrom,
    validTo: p.validTo,
    stayDateFrom: p.stayDateFrom,
    stayDateTo: p.stayDateTo,
    channelPromoId: p.channelPromoId,
    channelPromoCode: p.channelPromoCode,
  }));

  const syncResult = {
    connectionId,
    channelCode: effectiveChannelCode,
    channelName: connection.displayName || connection.channel,
    totalPromos: promos.length,
    syncedCount: syncedIds.length,
    syncedIds,
    syncedAt: now.toISOString(),
    status: 'success' as const,
    promoPayload,
    message: `Successfully synced ${syncedIds.length} promo code(s) to ${connection.displayName || connection.channel}`,
  };

  // Create a sync log entry
  try {
    await db.channelSyncLog.create({
      data: {
        connectionId,
        syncType: 'promo_code',
        direction: 'outbound',
        requestPayload: JSON.stringify(promoPayload),
        responsePayload: JSON.stringify(syncResult),
        status: 'success',
        statusCode: 200,
      },
    });
  } catch (logErr) {
    console.error('Error creating sync log:', logErr);
  }

  return NextResponse.json({ success: true, data: syncResult });
}

async function handleValidate(
  user: { tenantId: string },
  body: {
    promoCode: string;
    checkIn: string;
    checkOut: string;
    roomTypeId?: string;
    connectionId?: string;
    baseRate?: number;
  }
) {
  const { promoCode, checkIn, checkOut, roomTypeId, connectionId, baseRate } = body;

  if (!promoCode) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'promoCode is required' } },
      { status: 400 }
    );
  }
  if (!checkIn || !checkOut) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'checkIn and checkOut dates are required' } },
      { status: 400 }
    );
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (checkInDate >= checkOutDate) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'checkIn must be before checkOut' } },
      { status: 400 }
    );
  }

  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

  // Find matching promo code
  const where: Record<string, unknown> = {
    tenantId: user.tenantId,
    promoCode: promoCode.toUpperCase(),
    isActive: true,
    validFrom: { lte: new Date() },
    validTo: { gte: new Date() },
  };
  if (connectionId) where.connectionId = connectionId;

  const promo = await db.channelPromoCode.findFirst({ where });

  if (!promo) {
    return NextResponse.json({
      success: true,
      data: {
        isValid: false,
        reason: 'Promo code not found, inactive, or expired',
        promoCode: promoCode.toUpperCase(),
      },
    });
  }

  // Validation checks
  const errors: string[] = [];

  // Check booking window
  if (promo.bookingWindowFrom && new Date() < promo.bookingWindowFrom) {
    errors.push('Booking window has not opened yet');
  }
  if (promo.bookingWindowTo && new Date() > promo.bookingWindowTo) {
    errors.push('Booking window has closed');
  }

  // Check stay date range
  if (promo.stayDateFrom && checkInDate < promo.stayDateFrom) {
    errors.push(`Check-in must be on or after ${promo.stayDateFrom.toLocaleDateString()}`);
  }
  if (promo.stayDateTo && checkOutDate > promo.stayDateTo) {
    errors.push(`Check-out must be on or before ${promo.stayDateTo.toLocaleDateString()}`);
  }

  // Check min/max stay
  if (promo.minStay && nights < promo.minStay) {
    errors.push(`Minimum stay is ${promo.minStay} night(s), you selected ${nights}`);
  }
  if (promo.maxStay && nights > promo.maxStay) {
    errors.push(`Maximum stay is ${promo.maxStay} night(s), you selected ${nights}`);
  }

  // Check usage limit
  if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
    errors.push(`Usage limit reached (${promo.usageCount}/${promo.usageLimit})`);
  }

  // Check room type applicability
  if (roomTypeId && promo.applicableRoomTypes) {
    try {
      const roomTypes: string[] = JSON.parse(promo.applicableRoomTypes);
      if (roomTypes.length > 0 && !roomTypes.includes(roomTypeId)) {
        errors.push('Promo code is not applicable to this room type');
      }
    } catch { /* ignore parse errors */ }
  }

  // Check blackout dates
  if (promo.blackoutDates) {
    try {
      const blackoutRanges: Array<{ from: string; to: string }> = JSON.parse(promo.blackoutDates);
      for (const range of blackoutRanges) {
        const rangeFrom = new Date(range.from);
        const rangeTo = new Date(range.to);
        if (checkInDate < rangeTo && checkOutDate > rangeFrom) {
          errors.push(`Stay dates overlap with blackout period: ${range.from} — ${range.to}`);
          break;
        }
      }
    } catch { /* ignore parse errors */ }
  }

  if (errors.length > 0) {
    return NextResponse.json({
      success: true,
      data: {
        isValid: false,
        reason: errors.join('. '),
        promoCode: promo.promoCode,
        promoName: promo.promoName,
        errors,
      },
    });
  }

  // Calculate discount
  const effectiveRate = baseRate || 0;
  let discountAmount = 0;
  let discountedRate = effectiveRate;

  if (effectiveRate > 0) {
    switch (promo.discountType) {
      case 'percentage':
        discountAmount = effectiveRate * (promo.discountValue / 100);
        discountedRate = effectiveRate - discountAmount;
        break;
      case 'fixed_amount':
        discountAmount = Math.min(promo.discountValue, effectiveRate);
        discountedRate = effectiveRate - discountAmount;
        break;
      case 'free_nights':
        if (promo.freeNights && promo.freeNights > 0) {
          const nightlyRate = effectiveRate / nights;
          discountAmount = nightlyRate * Math.min(promo.freeNights, nights);
          discountedRate = effectiveRate - discountAmount;
        }
        break;
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      isValid: true,
      promoCode: promo.promoCode,
      promoName: promo.promoName,
      description: promo.description,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      currency: promo.currency,
      freeNights: promo.freeNights,
      nights,
      baseRate: effectiveRate,
      discountAmount: Math.round(discountAmount * 100) / 100,
      discountedRate: Math.round(discountedRate * 100) / 100,
      channelCode: promo.channelCode,
      remaining: promo.usageLimit ? Math.max(0, promo.usageLimit - promo.usageCount) : null,
    },
  });
}
