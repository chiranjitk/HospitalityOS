import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// Signal quality classification
function classifySignal(rssi: number) {
  if (rssi > -50) return 'excellent';
  if (rssi >= -65) return 'good';
  if (rssi >= -75) return 'fair';
  return 'weak';
}

// Approximate coverage radius as percentage of floor plan based on signal strength
function coverageRadius(rssi: number) {
  // Stronger signal = larger coverage circle (as % of plan width)
  if (rssi > -50) return 18;
  if (rssi >= -65) return 14;
  if (rssi >= -75) return 10;
  return 7;
}

// GET - Get coverage data for a property
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { tenantId } = auth;

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId') || '';

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId is required' },
        { status: 400 }
      );
    }

    // Get floor plans for the property
    const floorPlans = await db.wiFiFloorPlan.findMany({
      where: { propertyId, tenantId, isActive: true },
      orderBy: { floorNumber: 'asc' },
    });

    // Get latest readings per AP (grouped by apName, taking most recent)
    const allReadings = await db.wiFiHeatmapReading.findMany({
      where: { propertyId, tenantId },
      orderBy: { recordedAt: 'desc' },
      take: 500,
    });

    // Deduplicate: keep only the latest reading per AP name
    const latestByAp = new Map<string, typeof allReadings[0]>();
    for (const reading of allReadings) {
      if (!latestByAp.has(reading.apName)) {
        latestByAp.set(reading.apName, reading);
      }
    }

    // Build coverage zones
    const aps = Array.from(latestByAp.values()).map(r => ({
      id: r.id,
      apName: r.apName,
      apMac: r.apMac,
      apX: r.apX,
      apY: r.apY,
      signalStrength: r.signalStrength,
      clientCount: r.clientCount,
      band: r.band,
      channel: r.channel,
      frequency: r.frequency,
      noiseFloor: r.noiseFloor,
      snr: r.snr,
      quality: classifySignal(r.signalStrength),
      coverageRadius: coverageRadius(r.signalStrength),
      recordedAt: r.recordedAt,
      floorPlanId: r.floorPlanId,
    }));

    // Calculate coverage stats
    const excellent = aps.filter(a => a.quality === 'excellent').length;
    const good = aps.filter(a => a.quality === 'good').length;
    const fair = aps.filter(a => a.quality === 'fair').length;
    const weak = aps.filter(a => a.quality === 'weak').length;
    const total = aps.length;

    const avgSignal = total > 0
      ? Math.round(aps.reduce((sum, a) => sum + a.signalStrength, 0) / total)
      : 0;

    const totalClients = aps.reduce((sum, a) => sum + a.clientCount, 0);

    // Coverage percentage (estimated: APs with fair or better coverage)
    const coveredAps = excellent + good + fair;
    const coveragePercent = total > 0 ? Math.round((coveredAps / total) * 100) : 0;

    return NextResponse.json({
      data: {
        propertyId,
        floorPlans: floorPlans.map(fp => ({
          id: fp.id,
          floorName: fp.floorName,
          floorNumber: fp.floorNumber,
          width: fp.width,
          height: fp.height,
          svgData: fp.svgData,
          aps: aps.filter(a => a.floorPlanId === fp.id),
        })),
        aps,
        stats: {
          totalAps: total,
          excellent,
          good,
          fair,
          weak,
          avgSignal,
          totalClients,
          coveragePercent,
        },
      },
    });
  } catch (error) {
    console.error('[heatmap/coverage] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch coverage data' }, { status: 500 });
  }
}
