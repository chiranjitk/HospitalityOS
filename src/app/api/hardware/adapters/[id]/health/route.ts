/**
 * Hardware Adapter Health Check API
 * 
 * GET /api/hardware/adapters/[id]/health - Return health status for a specific hardware adapter
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    // Fetch the adapter
    const adapter = await db.hardwareAdapter.findUnique({
      where: { id },
    });

    if (!adapter || adapter.tenantId !== auth.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Adapter not found' },
        { status: 404 }
      );
    }

    // Determine health status based on adapter's lastCheckedAt and lastHealthyAt
    const now = new Date();
    const lastChecked = adapter.lastCheckedAt;
    const lastHealthy = adapter.lastHealthyAt;

    // If never checked, assume offline
    if (!lastChecked) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'offline',
          lastPing: null,
          responseTime: null,
          adapterId: adapter.id,
          displayName: adapter.displayName,
          healthStatus: adapter.healthStatus,
          enabled: adapter.enabled,
        },
      });
    }

    // Calculate time since last check
    const minutesSinceCheck = (now.getTime() - lastChecked.getTime()) / 60000;
    const minutesSinceHealthy = lastHealthy
      ? (now.getTime() - lastHealthy.getTime()) / 60000
      : Infinity;

    // Determine status
    let status: 'healthy' | 'degraded' | 'offline';
    if (minutesSinceCheck > 30) {
      status = 'offline';
    } else if (minutesSinceHealthy > 10) {
      status = 'degraded';
    } else {
      status = adapter.healthStatus === 'healthy' ? 'healthy' : 'degraded';
    }

    // Estimate response time from adapter health data (placeholder logic)
    const responseTime = adapter.config
      ? (() => {
          try {
            const config = JSON.parse(adapter.config);
            return config.responseTimeMs || null;
          } catch {
            return null;
          }
        })()
      : null;

    return NextResponse.json({
      success: true,
      data: {
        status,
        lastPing: lastChecked.toISOString(),
        responseTime,
        adapterId: adapter.id,
        displayName: adapter.displayName,
        providerId: adapter.providerId,
        category: adapter.category,
        healthStatus: adapter.healthStatus,
        enabled: adapter.enabled,
      },
    });
  } catch (error) {
    console.error('[ADAPTER_HEALTH] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check adapter health' },
      { status: 500 }
    );
  }
}
