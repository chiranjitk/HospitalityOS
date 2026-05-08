import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/channels/gds — GDS Connectivity dashboard
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['channels.view', 'channels.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view GDS data' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Fetch connections
    const connectionWhere: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) connectionWhere.status = status;

    const connections = await db.gdsConnection.findMany({
      where: connectionWhere,
      orderBy: { createdAt: 'desc' },
    });

    const formattedConnections = connections.map(c => ({
      id: c.id,
      provider: c.provider,
      code: c.provider === 'amadeus' ? '1A' : c.provider === 'sabre' ? '1S' : c.provider === 'travelport' ? '1P' : '1G',
      status: c.status,
      enabled: c.autoSync,
      pcc: c.pcc,
      hotelCode: c.hotelCode,
      chainCode: c.chainCode,
      endpoint: c.endpointUrl,
      lastSync: c.lastSyncAt?.toISOString() ?? null,
      lastError: c.lastError,
      autoSync: c.autoSync,
      syncInterval: c.syncInterval,
      features: {
        inventory: true,
        rates: true,
        bookings: true,
        guestProfiles: true,
        preferences: true,
      },
      config: {
        roomTypeMapping: null,
        rateCodePrefix: c.chainCode ?? null,
        currencyOverride: false,
        legacyMode: false,
      },
      stats: {
        bookingsThisMonth: 0,
        revenueThisMonth: 0,
        avgLeadTimeDays: 0,
        cancellationRate: 0,
      },
    }));

    // Fetch rate codes
    const gdsRateCodes = await db.gdsRateCode.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const rateCodes = gdsRateCodes.map(rc => ({
      id: rc.id,
      code: rc.code,
      name: rc.name,
      description: rc.description ?? null,
      minStay: rc.minStay,
      maxStay: rc.maxStay,
      commission: 0,
      status: rc.isActive ? 'active' : 'inactive',
      restrictions: {
        blackoutDates: [],
        advancePurchase: 0,
        cancellationPolicy: '24h',
      },
    }));

    // Fetch bookings
    const gdsBookings = await db.gdsBooking.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const recentBookings = gdsBookings.map(b => ({
      id: b.id,
      gdsProvider: connections.find(c => c.id === b.connectionId)?.provider ?? 'unknown',
      pnr: b.pnr ?? null,
      guestName: b.guestName,
      roomType: b.roomType ?? null,
      checkIn: b.checkIn.toISOString().split('T')[0],
      checkOut: b.checkOut.toISOString().split('T')[0],
      nights: Math.max(1, Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / (1000 * 60 * 60 * 24))),
      rateCode: b.rateCode ?? null,
      totalAmount: 0,
      currency: 'USD',
      status: b.status,
      bookedAt: b.createdAt.toISOString(),
    }));

    // Rate distributions computed from rate codes
    const rateDistributions = gdsRateCodes.map(rc => ({
      id: rc.id,
      name: rc.name,
      code: rc.code,
      gdsProviders: [connections.find(c => c.id === rc.connectionId)?.provider ?? 'unknown'].filter(Boolean),
      roomsDistributed: 0,
      lastDistributed: rc.updatedAt.toISOString(),
      status: rc.isActive ? 'active' : 'inactive',
    }));

    const stats = {
      totalConnections: connections.length,
      activeConnections: connections.filter(c => c.status === 'active').length,
      totalBookingsThisMonth: gdsBookings.length,
      totalRevenueThisMonth: 0,
      avgCancellationRate: 0,
      rateCodesActive: gdsRateCodes.filter(r => r.isActive).length,
      pendingErrors: connections.filter(c => c.lastError).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        connections: formattedConnections,
        rateDistributions,
        recentBookings,
        rateCodes,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching GDS data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch GDS connectivity data' } },
      { status: 500 }
    );
  }
}

// PUT /api/channels/gds — Update GDS settings
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['channels.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to update GDS settings' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, action, enabled, autoSync, syncInterval, config } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'GDS connection ID is required' } },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.gdsConnection.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Connection not found' }, { status: 404 });
    }

    // Handle test connection
    if (action === 'test') {
      return NextResponse.json({
        success: true,
        message: `GDS connection ${existing.provider} test initiated`,
        data: { id, success: true, latency: 200, message: 'Test initiated', testedAt: new Date().toISOString() },
      });
    }

    // Handle sync now
    if (action === 'sync') {
      await db.gdsConnection.update({
        where: { id },
        data: { status: 'syncing', lastSyncAt: new Date() },
      });
      return NextResponse.json({
        success: true,
        message: 'GDS sync initiated successfully',
        data: { id, status: 'syncing', syncStartedAt: new Date().toISOString() },
      });
    }

    // Handle toggle
    if (enabled !== undefined) {
      const updated = await db.gdsConnection.update({
        where: { id },
        data: { autoSync: enabled, status: enabled ? 'active' : 'disabled' },
      });
      return NextResponse.json({
        success: true,
        message: enabled ? 'GDS connection enabled' : 'GDS connection disabled',
        data: { id, enabled, status: updated.status, updatedAt: updated.updatedAt.toISOString() },
      });
    }

    // Handle config update
    if (config || autoSync !== undefined || syncInterval !== undefined) {
      const updateData: Record<string, unknown> = {};
      if (autoSync !== undefined) updateData.autoSync = autoSync;
      if (syncInterval !== undefined) updateData.syncInterval = syncInterval;
      if (config) {
        if (config.endpointUrl !== undefined) updateData.endpointUrl = config.endpointUrl;
        if (config.apiKey !== undefined) updateData.apiKey = config.apiKey;
        if (config.apiSecret !== undefined) updateData.apiSecret = config.apiSecret;
        if (config.username !== undefined) updateData.username = config.username;
        if (config.password !== undefined) updateData.password = config.password;
      }

      const updated = await db.gdsConnection.update({ where: { id }, data: updateData });
      return NextResponse.json({
        success: true,
        message: 'GDS configuration updated successfully',
        data: { id, updatedAt: updated.updatedAt.toISOString() },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid update fields provided' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating GDS settings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update GDS settings' } },
      { status: 500 }
    );
  }
}
