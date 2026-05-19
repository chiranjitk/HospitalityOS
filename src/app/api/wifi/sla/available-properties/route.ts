/**
 * WiFi SLA Available Properties API
 *
 * GET — Returns properties that don't have an SLA config yet
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

// GET /api/wifi/sla/available-properties
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    // Get all property IDs that already have an SLA config
    const existingConfigs = await db.wiFiSLAConfig.findMany({
      where: { tenantId: auth.tenantId },
      select: { propertyId: true },
    });

    const configuredPropertyIds = new Set(existingConfigs.map((c) => c.propertyId));

    // Get all active properties for the tenant that don't have a config
    const properties = await db.property.findMany({
      where: {
        tenantId: auth.tenantId,
        deletedAt: null,
        ...(configuredPropertyIds.size > 0 ? { id: { notIn: Array.from(configuredPropertyIds) } } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 50,
    });

    return NextResponse.json({ success: true, data: properties });
  } catch (error) {
    console.error('Error fetching available properties:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch available properties' },
      { status: 500 },
    );
  }
}
