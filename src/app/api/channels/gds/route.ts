import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/channels/gds - GDS Connectivity
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'channels.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view GDS data' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Mock GDS connections
    const connections = [
      {
        id: 'gds-amadeus-001',
        provider: 'Amadeus',
        code: '1A',
        status: 'active',
        enabled: true,
        pcc: 'AMA7492',
        hotelCode: 'DELRS',
        chainCode: 'RY',
        endpoint: 'https://webservices.amadeus.com/v1',
        lastSync: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        lastError: null,
        autoSync: true,
        syncInterval: 15,
        features: {
          inventory: true,
          rates: true,
          bookings: true,
          guestProfiles: true,
          preferences: false,
        },
        config: {
          roomTypeMapping: 'STANDARD=1K,DELUXE=1Q,SUITE=SU1',
          rateCodePrefix: 'RY',
          currencyOverride: false,
          legacyMode: false,
        },
        stats: {
          bookingsThisMonth: 87,
          revenueThisMonth: 1245000,
          avgLeadTimeDays: 14,
          cancellationRate: 8.2,
        },
      },
      {
        id: 'gds-sabre-001',
        provider: 'Sabre',
        code: '1S',
        status: 'active',
        enabled: true,
        pcc: 'SBR3847',
        hotelCode: 'DELRSRST',
        chainCode: 'RY',
        endpoint: 'https://api.sabre.com/v2',
        lastSync: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
        lastError: null,
        autoSync: true,
        syncInterval: 15,
        features: {
          inventory: true,
          rates: true,
          bookings: true,
          guestProfiles: true,
          preferences: true,
        },
        config: {
          roomTypeMapping: 'STANDARD=A1K,DELUXE=A1Q,SUITE=AS1',
          rateCodePrefix: 'RY',
          currencyOverride: false,
          legacyMode: false,
        },
        stats: {
          bookingsThisMonth: 62,
          revenueThisMonth: 890000,
          avgLeadTimeDays: 11,
          cancellationRate: 7.5,
        },
      },
      {
        id: 'gds-travelport-001',
        provider: 'Travelport',
        code: '1P',
        status: 'inactive',
        enabled: false,
        pcc: 'TVL9021',
        hotelCode: 'TP20250',
        chainCode: 'RY',
        endpoint: 'https://api.travelport.com/v6',
        lastSync: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
        lastError: 'Connection timeout - credentials may have expired',
        autoSync: false,
        syncInterval: 30,
        features: {
          inventory: true,
          rates: true,
          bookings: true,
          guestProfiles: false,
          preferences: false,
        },
        config: {
          roomTypeMapping: 'STANDARD=T1K,DELUXE=T1Q,SUITE=TS1',
          rateCodePrefix: 'RY',
          currencyOverride: false,
          legacyMode: true,
        },
        stats: {
          bookingsThisMonth: 0,
          revenueThisMonth: 0,
          avgLeadTimeDays: 0,
          cancellationRate: 0,
        },
      },
      {
        id: 'gds-worldspan-001',
        provider: 'Worldspan (Travelport)',
        code: '1W',
        status: 'active',
        enabled: true,
        pcc: 'WSP5563',
        hotelCode: 'WS10198',
        chainCode: 'RY',
        endpoint: 'https://api.travelport.com/v6/worldspan',
        lastSync: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        lastError: null,
        autoSync: true,
        syncInterval: 20,
        features: {
          inventory: true,
          rates: true,
          bookings: true,
          guestProfiles: false,
          preferences: false,
        },
        config: {
          roomTypeMapping: 'STANDARD=W1K,DELUXE=W1Q,SUITE=WS1',
          rateCodePrefix: 'RY',
          currencyOverride: false,
          legacyMode: true,
        },
        stats: {
          bookingsThisMonth: 34,
          revenueThisMonth: 510000,
          avgLeadTimeDays: 18,
          cancellationRate: 10.1,
        },
      },
      {
        id: 'gds-galileo-001',
        provider: 'Galileo (Travelport)',
        code: '1G',
        status: 'warning',
        enabled: true,
        pcc: 'GAL7782',
        hotelCode: 'GL30542',
        chainCode: 'RY',
        endpoint: 'https://api.travelport.com/v6/galileo',
        lastSync: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        lastError: 'Rate parity mismatch on 3 room types',
        autoSync: true,
        syncInterval: 20,
        features: {
          inventory: true,
          rates: true,
          bookings: true,
          guestProfiles: false,
          preferences: false,
        },
        config: {
          roomTypeMapping: 'STANDARD=G1K,DELUXE=G1Q,SUITE=GS1',
          rateCodePrefix: 'RY',
          currencyOverride: false,
          legacyMode: false,
        },
        stats: {
          bookingsThisMonth: 28,
          revenueThisMonth: 420000,
          avgLeadTimeDays: 16,
          cancellationRate: 9.3,
        },
      },
    ];

    const filteredConnections = status
      ? connections.filter(c => c.status === status)
      : connections;

    // Mock rate distributions
    const rateDistributions = [
      { id: 'rd-001', name: 'BAR - Best Available Rate', code: 'RYBAR', gdsProviders: ['Amadeus', 'Sabre', 'Worldspan'], roomsDistributed: 45, lastDistributed: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), status: 'active' },
      { id: 'rd-002', name: 'Corporate Negotiated', code: 'RYCORP', gdsProviders: ['Amadeus', 'Sabre'], roomsDistributed: 30, lastDistributed: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), status: 'active' },
      { id: 'rd-003', name: 'AAA/CAA Discount', code: 'RYAAA', gdsProviders: ['Amadeus', 'Sabre', 'Galileo'], roomsDistributed: 20, lastDistributed: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(), status: 'active' },
      { id: 'rd-004', name: 'Senior Discount', code: 'RYSEN', gdsProviders: ['Amadeus', 'Sabre'], roomsDistributed: 15, lastDistributed: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), status: 'active' },
      { id: 'rd-005', name: 'Govt/Military Rate', code: 'RYGOV', gdsProviders: ['Amadeus', 'Sabre', 'Worldspan', 'Galileo'], roomsDistributed: 10, lastDistributed: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), status: 'active' },
      { id: 'rd-006', name: 'Weekend Special', code: 'RYWKE', gdsProviders: ['Amadeus', 'Sabre'], roomsDistributed: 25, lastDistributed: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), status: 'paused' },
      { id: 'rd-007', name: 'Early Bird Promo', code: 'RYEBD', gdsProviders: ['Amadeus'], roomsDistributed: 0, lastDistributed: null, status: 'draft' },
    ];

    // Mock booking retrieval data
    const recentBookings = [
      { id: 'gds-bk-001', gdsProvider: 'Amadeus', pnr: 'XKLM72', guestName: 'James Richardson', roomType: 'Deluxe King', checkIn: '2026-06-15', checkOut: '2026-06-18', nights: 3, rateCode: 'RYBAR', totalAmount: 45000, currency: 'INR', status: 'confirmed', bookedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
      { id: 'gds-bk-002', gdsProvider: 'Sabre', pnr: 'PRQR34', guestName: 'Sarah Chen', roomType: 'Standard Room', checkIn: '2026-06-12', checkOut: '2026-06-14', nights: 2, rateCode: 'RYCORP', totalAmount: 22000, currency: 'INR', status: 'confirmed', bookedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString() },
      { id: 'gds-bk-003', gdsProvider: 'Amadeus', pnr: 'TWYZ18', guestName: 'Michael O\'Brien', roomType: 'Executive Suite', checkIn: '2026-06-20', checkOut: '2026-06-25', nights: 5, rateCode: 'RYBAR', totalAmount: 125000, currency: 'INR', status: 'confirmed', bookedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
      { id: 'gds-bk-004', gdsProvider: 'Worldspan', pnr: 'BNKL56', guestName: 'Yuki Tanaka', roomType: 'Deluxe Twin', checkIn: '2026-06-10', checkOut: '2026-06-13', nights: 3, rateCode: 'RYAAA', totalAmount: 33000, currency: 'INR', status: 'checked-in', bookedAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString() },
      { id: 'gds-bk-005', gdsProvider: 'Galileo', pnr: 'HKJM90', guestName: 'Priya Sharma', roomType: 'Standard Room', checkIn: '2026-06-08', checkOut: '2026-06-09', nights: 1, rateCode: 'RYGOV', totalAmount: 8500, currency: 'INR', status: 'checked-out', bookedAt: new Date(Date.now() - 1000 * 60 * 60 * 168).toISOString() },
      { id: 'gds-bk-006', gdsProvider: 'Sabre', pnr: 'WQXT43', guestName: 'David Kim', roomType: 'Deluxe King', checkIn: '2026-06-22', checkOut: '2026-06-24', nights: 2, rateCode: 'RYBAR', totalAmount: 30000, currency: 'INR', status: 'confirmed', bookedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
      { id: 'gds-bk-007', gdsProvider: 'Amadeus', pnr: 'FGHJ11', guestName: 'Elena Popova', roomType: 'Presidential Suite', checkIn: '2026-07-01', checkOut: '2026-07-05', nights: 4, rateCode: 'RYBAR', totalAmount: 200000, currency: 'INR', status: 'confirmed', bookedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
    ];

    // Mock rate codes
    const rateCodes = [
      { id: 'rc-001', code: 'RYBAR', name: 'Best Available Rate', description: 'Standard publicly available rate', minStay: 1, maxStay: 30, commission: 10, status: 'active', restrictions: { blackoutDates: [], advancePurchase: 0, cancellationPolicy: '24h' } },
      { id: 'rc-002', code: 'RYCORP', name: 'Corporate Rate', description: 'Negotiated corporate rate for B2B clients', minStay: 1, maxStay: 14, commission: 0, status: 'active', restrictions: { blackoutDates: ['2026-12-20', '2026-12-31'], advancePurchase: 0, cancellationPolicy: '48h' } },
      { id: 'rc-003', code: 'RYAAA', name: 'AAA/CAA Rate', description: 'Discounted rate for AAA/CAA members', minStay: 1, maxStay: 14, commission: 10, status: 'active', restrictions: { blackoutDates: [], advancePurchase: 3, cancellationPolicy: '24h' } },
      { id: 'rc-004', code: 'RYSEN', name: 'Senior Rate', description: '10% off BAR for guests 62+', minStay: 1, maxStay: 14, commission: 10, status: 'active', restrictions: { blackoutDates: [], advancePurchase: 7, cancellationPolicy: '48h' } },
      { id: 'rc-005', code: 'RYGOV', name: 'Government Rate', description: 'Per diem compliant government rate', minStay: 1, maxStay: 30, commission: 0, status: 'active', restrictions: { blackoutDates: [], advancePurchase: 0, cancellationPolicy: '24h' } },
      { id: 'rc-006', code: 'RYWKE', name: 'Weekend Special', description: '20% off Friday-Saturday stays', minStay: 2, maxStay: 2, commission: 10, status: 'paused', restrictions: { blackoutDates: ['2026-12-20', '2026-12-21'], advancePurchase: 14, cancellationPolicy: '72h' } },
      { id: 'rc-007', code: 'RYEBD', name: 'Early Bird Promo', description: '15% off for bookings 30+ days in advance', minStay: 2, maxStay: 14, commission: 10, status: 'draft', restrictions: { blackoutDates: [], advancePurchase: 30, cancellationPolicy: 'Non-refundable' } },
      { id: 'rc-008', code: 'RYGRP', name: 'Group Rate', description: 'Special rate for group bookings (10+ rooms)', minStay: 1, maxStay: 7, commission: 8, status: 'active', restrictions: { blackoutDates: [], advancePurchase: 60, cancellationPolicy: '30 days' } },
    ];

    const stats = {
      totalConnections: connections.length,
      activeConnections: connections.filter(c => c.status === 'active').length,
      totalBookingsThisMonth: connections.reduce((sum, c) => sum + c.stats.bookingsThisMonth, 0),
      totalRevenueThisMonth: connections.reduce((sum, c) => sum + c.stats.revenueThisMonth, 0),
      avgCancellationRate: parseFloat((connections.filter(c => c.status === 'active').reduce((sum, c) => sum + c.stats.cancellationRate, 0) / connections.filter(c => c.status === 'active').length).toFixed(1)),
      rateCodesActive: rateCodes.filter(r => r.status === 'active').length,
      pendingErrors: connections.filter(c => c.lastError).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        connections: filteredConnections,
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

// PUT /api/channels/gds - Update GDS settings
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'channels.update')) {
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

    // Handle test connection action
    if (action === 'test') {
      const testResults: Record<string, { success: boolean; latency: number; message: string }> = {
        'gds-amadeus-001': { success: true, latency: 234, message: 'Amadeus PCC AMA7492 connection verified successfully' },
        'gds-sabre-001': { success: true, latency: 189, message: 'Sabre PCC SBR3847 connection verified successfully' },
        'gds-travelport-001': { success: false, latency: 5000, message: 'Travelport PCC TVL9021 connection timed out - check credentials' },
        'gds-worldspan-001': { success: true, latency: 312, message: 'Worldspan PCC WSP5563 connection verified successfully' },
        'gds-galileo-001': { success: true, latency: 278, message: 'Galileo PCC GAL7782 connection verified with warnings' },
      };

      const result = testResults[id] || { success: false, latency: 0, message: 'Unknown GDS connection' };

      return NextResponse.json({
        success: true,
        message: result.message,
        data: {
          id,
          ...result,
          testedAt: new Date().toISOString(),
        },
      });
    }

    // Handle sync now action
    if (action === 'sync') {
      return NextResponse.json({
        success: true,
        message: 'GDS sync initiated successfully',
        data: {
          id,
          status: 'syncing',
          syncStartedAt: new Date().toISOString(),
          estimatedCompletion: new Date(Date.now() + 1000 * 60 * 3).toISOString(),
        },
      });
    }

    // Handle toggle connection
    if (enabled !== undefined) {
      return NextResponse.json({
        success: true,
        message: enabled ? 'GDS connection enabled' : 'GDS connection disabled',
        data: {
          id,
          enabled,
          status: enabled ? 'active' : 'inactive',
          updatedAt: new Date().toISOString(),
        },
      });
    }

    // Handle config update
    if (config || autoSync !== undefined || syncInterval !== undefined) {
      return NextResponse.json({
        success: true,
        message: 'GDS configuration updated successfully',
        data: {
          id,
          autoSync: autoSync ?? true,
          syncInterval: syncInterval ?? 15,
          config: config ?? {},
          updatedAt: new Date().toISOString(),
        },
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
