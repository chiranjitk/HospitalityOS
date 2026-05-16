import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import {
  getOverbookingConfig,
  updateOverbookingConfig,
  applyAutoOverbooking,
  getOverbookingStatus,
  getOverbookingLogs,
} from '@/lib/revenue/auto-overbooking';

/**
 * GET /api/revenue/overbooking
 * - Get overbooking config + current overbooking status
 * - Query params: propertyId, date (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const dateStr = searchParams.get('date');
    const includeLogs = searchParams.get('logs') === 'true';

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    // Get configuration
    const config = await getOverbookingConfig(user.tenantId, propertyId);

    // Get current overbooking status
    const targetDate = dateStr ? new Date(dateStr) : undefined;
    const status = await getOverbookingStatus(user.tenantId, propertyId, targetDate);

    // Get logs if requested
    const logs = includeLogs ? await getOverbookingLogs(user.tenantId, propertyId) : [];

    // Calculate summary stats
    const totalActiveSlots = status.reduce((sum, s) => sum + s.activeSlots, 0);
    const totalUsedSlots = status.reduce((sum, s) => sum + s.usedSlots, 0);
    const totalAvailable = status.reduce((sum, s) => sum + s.availableExtra, 0);
    const avgConfidence = status.length > 0
      ? status.reduce((sum, s) => sum + s.confidence, 0) / status.length
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        config,
        status,
        summary: {
          roomTypesWithSlots: status.length,
          totalActiveSlots,
          totalUsedSlots,
          totalAvailable,
          avgConfidence: Math.round(avgConfidence * 1000) / 1000,
          overbookingEnabled: config.enabled,
        },
        logs,
      },
    });
  } catch (error) {
    console.error('Error in overbooking GET:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch overbooking data' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/revenue/overbooking
 * - Update overbooking configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { propertyId, ...configUpdate } = body;

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    const config = await updateOverbookingConfig(user.tenantId, propertyId, configUpdate);

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error in overbooking PUT:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update overbooking configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/revenue/overbooking
 * - Manually trigger auto-overbooking calculation
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { propertyId, date: dateStr } = body;

    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId is required' }, { status: 400 });
    }

    const targetDate = dateStr ? new Date(dateStr) : undefined;

    const result = await applyAutoOverbooking(
      user.tenantId,
      propertyId,
      targetDate,
      user.id
    );

    return NextResponse.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error('Error in overbooking POST:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run overbooking calculation' },
      { status: 500 }
    );
  }
}
