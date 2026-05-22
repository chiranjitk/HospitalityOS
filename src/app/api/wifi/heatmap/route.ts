import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requirePermission } from '@/lib/auth/tenant-context';

const MAX_LIMIT = 200;

// Demo data returned when no real readings exist
function getDemoReadings(propertyId: string, tenantId: string) {
  return [
    { id: 'demo-1', tenantId, propertyId, floorPlanId: null, apName: 'AP-Lobby-01', apMac: '00:1A:2B:3C:4D:01', apX: 25, apY: 50, signalStrength: -42, clientCount: 23, band: '5', channel: 36, frequency: 5180, noiseFloor: -92, snr: 50, recordedAt: new Date().toISOString() },
    { id: 'demo-2', tenantId, propertyId, floorPlanId: null, apName: 'AP-Lobby-02', apMac: '00:1A:2B:3C:4D:02', apX: 75, apY: 50, signalStrength: -38, clientCount: 18, band: '5', channel: 40, frequency: 5200, noiseFloor: -90, snr: 52, recordedAt: new Date().toISOString() },
    { id: 'demo-3', tenantId, propertyId, floorPlanId: null, apName: 'AP-Corridor-F1', apMac: '00:1A:2B:3C:4D:03', apX: 15, apY: 30, signalStrength: -55, clientCount: 8, band: '2.4', channel: 6, frequency: 2437, noiseFloor: -88, snr: 33, recordedAt: new Date().toISOString() },
    { id: 'demo-4', tenantId, propertyId, floorPlanId: null, apName: 'AP-Corridor-F2', apMac: '00:1A:2B:3C:4D:04', apX: 85, apY: 30, signalStrength: -58, clientCount: 5, band: '2.4', channel: 1, frequency: 2412, noiseFloor: -89, snr: 31, recordedAt: new Date().toISOString() },
    { id: 'demo-5', tenantId, propertyId, floorPlanId: null, apName: 'AP-Pool-Area', apMac: '00:1A:2B:3C:4D:05', apX: 50, apY: 85, signalStrength: -62, clientCount: 12, band: '5', channel: 149, frequency: 5745, noiseFloor: -91, snr: 29, recordedAt: new Date().toISOString() },
    { id: 'demo-6', tenantId, propertyId, floorPlanId: null, apName: 'AP-Restaurant', apMac: '00:1A:2B:3C:4D:06', apX: 50, apY: 15, signalStrength: -70, clientCount: 3, band: '2.4', channel: 11, frequency: 2462, noiseFloor: -85, snr: 15, recordedAt: new Date().toISOString() },
    { id: 'demo-7', tenantId, propertyId, floorPlanId: null, apName: 'AP-Conference-A', apMac: '00:1A:2B:3C:4D:07', apX: 35, apY: 70, signalStrength: -48, clientCount: 15, band: '5', channel: 44, frequency: 5220, noiseFloor: -91, snr: 43, recordedAt: new Date().toISOString() },
    { id: 'demo-8', tenantId, propertyId, floorPlanId: null, apName: 'AP-Gym', apMac: '00:1A:2B:3C:4D:08', apX: 70, apY: 20, signalStrength: -78, clientCount: 1, band: '2.4', channel: 3, frequency: 2422, noiseFloor: -82, snr: 4, recordedAt: new Date().toISOString() },
  ];
}

// GET - List heatmap readings with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId') || '';
    const apName = searchParams.get('apName') || '';
    const band = searchParams.get('band') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const floorPlanId = searchParams.get('floorPlanId') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), MAX_LIMIT);
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (apName) where.apName = { contains: apName, mode: 'insensitive' };
    if (band) where.band = band;
    if (floorPlanId) where.floorPlanId = floorPlanId;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.recordedAt = dateFilter;
    }

    const [readings, total] = await Promise.all([
      db.wiFiHeatmapReading.findMany({
        where,
        orderBy: { recordedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      db.wiFiHeatmapReading.count({ where }),
    ]);

    // If no readings found, return demo data for the property
    if (readings.length === 0 && propertyId) {
      const demoData = getDemoReadings(propertyId, tenantId);
      let filtered = demoData;
      if (band) filtered = filtered.filter(r => r.band === band);
      return NextResponse.json({
        data: filtered,
        total: filtered.length,
        page: 1,
        limit: 50,
        isDemo: true,
      });
    }

    return NextResponse.json({
      data: readings,
      total,
      page,
      limit,
      isDemo: false,
    });
  } catch (error) {
    console.error('[heatmap] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch heatmap readings' }, { status: 500 });
  }
}

// POST - Add a new reading
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'wifi.manage');
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;

    const body = await request.json();
    const {
      propertyId,
      floorPlanId,
      apName,
      apMac,
      apX,
      apY,
      signalStrength,
      clientCount = 0,
      band = '2.4',
      channel,
      frequency,
      noiseFloor,
      snr,
    } = body;

    if (!propertyId || !apName || apX === undefined || apY === undefined || signalStrength === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: propertyId, apName, apX, apY, signalStrength' },
        { status: 400 }
      );
    }

    if (signalStrength > -20 || signalStrength < -100) {
      return NextResponse.json(
        { error: 'Invalid signalStrength: must be between -100 and -20 dBm' },
        { status: 400 }
      );
    }

    if (apX < 0 || apX > 100 || apY < 0 || apY > 100) {
      return NextResponse.json(
        { error: 'Invalid apX/apY: must be between 0 and 100' },
        { status: 400 }
      );
    }

    const reading = await db.wiFiHeatmapReading.create({
      data: {
        tenantId,
        propertyId,
        floorPlanId: floorPlanId || null,
        apName,
        apMac: apMac || null,
        apX,
        apY,
        signalStrength,
        clientCount,
        band,
        channel: channel || null,
        frequency: frequency || null,
        noiseFloor: noiseFloor || null,
        snr: snr || null,
      },
    });

    return NextResponse.json({ data: reading }, { status: 201 });
  } catch (error) {
    console.error('[heatmap] POST error:', error);
    return NextResponse.json({ error: 'Failed to create heatmap reading' }, { status: 500 });
  }
}
