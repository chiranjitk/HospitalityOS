/**
 * WiFi SLA Configuration API
 *
 * GET  — List SLA configs with related metrics
 * POST — Create/update SLA config for a property
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nullifyEmptyStrings } from '@/lib/nullify-empty-strings';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/wifi/sla — List SLA configs
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    const where: Record<string, unknown> = { tenantId: auth.tenantId };
    if (propertyId) where.propertyId = propertyId;

    const configs = await db.wiFiSLAConfig.findMany({
      where,
      include: {
        property: { select: { id: true, name: true } },
        metrics: {
          orderBy: { periodStart: 'desc' },
          take: 1,
        },
        _count: { select: { metrics: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: configs,
    });
  } catch (error) {
    console.error('Error fetching SLA configs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SLA configs' },
      { status: 500 }
    );
  }
}

// POST /api/wifi/sla — Create or update SLA config
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const data = nullifyEmptyStrings(body);

    const {
      propertyId,
      uptimeTarget,
      speedTargetDown,
      speedTargetUp,
      latencyTarget,
      measurementInterval,
      alertOnBreach,
      breachDuration,
    } = data;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'propertyId is required' },
        { status: 400 }
      );
    }

    // Check for existing config for this property
    const existing = await db.wiFiSLAConfig.findUnique({
      where: {
        tenantId_propertyId: {
          tenantId: auth.tenantId,
          propertyId: propertyId as string,
        },
      },
    });

    let config;
    if (existing) {
      // Update existing
      config = await db.wiFiSLAConfig.update({
        where: { id: existing.id },
        data: {
          uptimeTarget: uptimeTarget !== undefined ? parseFloat(String(uptimeTarget)) : undefined,
          speedTargetDown: speedTargetDown !== undefined ? parseFloat(String(speedTargetDown)) : undefined,
          speedTargetUp: speedTargetUp !== undefined ? parseFloat(String(speedTargetUp)) : undefined,
          latencyTarget: latencyTarget !== undefined ? parseInt(String(latencyTarget)) : undefined,
          measurementInterval: measurementInterval !== undefined ? parseInt(String(measurementInterval)) : undefined,
          alertOnBreach: alertOnBreach !== undefined ? Boolean(alertOnBreach) : undefined,
          breachDuration: breachDuration !== undefined ? parseInt(String(breachDuration)) : undefined,
        },
        include: { property: { select: { id: true, name: true } } },
      });
    } else {
      // Create new
      config = await db.wiFiSLAConfig.create({
        data: {
          tenantId: auth.tenantId,
          propertyId: propertyId as string,
          uptimeTarget: uptimeTarget ? parseFloat(String(uptimeTarget)) : 99.9,
          speedTargetDown: speedTargetDown ? parseFloat(String(speedTargetDown)) : 50,
          speedTargetUp: speedTargetUp ? parseFloat(String(speedTargetUp)) : 10,
          latencyTarget: latencyTarget ? parseInt(String(latencyTarget)) : 20,
          measurementInterval: measurementInterval ? parseInt(String(measurementInterval)) : 5,
          alertOnBreach: alertOnBreach !== undefined ? Boolean(alertOnBreach) : true,
          breachDuration: breachDuration ? parseInt(String(breachDuration)) : 15,
        },
        include: { property: { select: { id: true, name: true } } },
      });
    }

    return NextResponse.json(
      { success: true, data: config, message: existing ? 'SLA config updated' : 'SLA config created' },
      { status: existing ? 200 : 201 }
    );
  } catch (error) {
    console.error('Error saving SLA config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save SLA config' },
      { status: 500 }
    );
  }
}
