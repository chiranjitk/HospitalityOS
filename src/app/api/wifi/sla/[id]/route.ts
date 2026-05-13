/**
 * WiFi SLA Config Detail API
 *
 * GET    — Get SLA config with latest metrics
 * PATCH  — Update SLA targets
 * DELETE — Delete SLA config
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const TENANT_ID = '444017d5-e022-4c5f-ac07-ea0d51f4609b';

// GET /api/wifi/sla/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const config = await db.wiFiSLAConfig.findFirst({
      where: { id, tenantId: TENANT_ID },
      include: {
        property: { select: { id: true, name: true } },
        metrics: {
          orderBy: { periodStart: 'desc' },
          take: 5,
        },
      },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'SLA config not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Error fetching SLA config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SLA config' },
      { status: 500 }
    );
  }
}

// PATCH /api/wifi/sla/[id] — Update SLA targets
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await db.wiFiSLAConfig.findFirst({
      where: { id, tenantId: TENANT_ID },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'SLA config not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.uptimeTarget !== undefined) updateData.uptimeTarget = parseFloat(String(body.uptimeTarget));
    if (body.speedTargetDown !== undefined) updateData.speedTargetDown = parseFloat(String(body.speedTargetDown));
    if (body.speedTargetUp !== undefined) updateData.speedTargetUp = parseFloat(String(body.speedTargetUp));
    if (body.latencyTarget !== undefined) updateData.latencyTarget = parseInt(String(body.latencyTarget));
    if (body.measurementInterval !== undefined) updateData.measurementInterval = parseInt(String(body.measurementInterval));
    if (body.alertOnBreach !== undefined) updateData.alertOnBreach = Boolean(body.alertOnBreach);
    if (body.breachDuration !== undefined) updateData.breachDuration = parseInt(String(body.breachDuration));

    const config = await db.wiFiSLAConfig.update({
      where: { id },
      data: updateData,
      include: { property: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      success: true,
      data: config,
      message: 'SLA config updated successfully',
    });
  } catch (error) {
    console.error('Error updating SLA config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update SLA config' },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/sla/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify ownership
    const existing = await db.wiFiSLAConfig.findFirst({
      where: { id, tenantId: TENANT_ID },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'SLA config not found' },
        { status: 404 }
      );
    }

    await db.wiFiSLAConfig.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'SLA config deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting SLA config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete SLA config' },
      { status: 500 }
    );
  }
}
