/**
 * RADIUS Server Configuration API Route
 * 
 * Manages FreeRADIUS server configuration per property.
 * After saving to DB, applies changes to actual FreeRADIUS config files
 * via the freeradius-service mini-service on port 3010.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, tenantWhere, resolvePropertyId } from '@/lib/auth/tenant-context';

// FreeRADIUS service port (mini-service on 3010)
const FREERADIUS_SERVICE_PORT = 3010;

interface FreeRADIUSConfig {
  authPort: number;
  acctPort: number;
  coaPort: number;
  bindAddress: string;
  logDestination: string;
  logAuth: boolean;
  logAuthBadpass: boolean;
  logAuthGoodpass: boolean;
}

/**
 * Apply server configuration to actual FreeRADIUS config files
 * by calling the freeradius-service's apply-server-config endpoint.
 * This modifies sites-available/default and radiusd.conf, then reloads FreeRADIUS.
 */
async function applyServerConfigToFreeRADIUS(config: FreeRADIUSConfig): Promise<{ success: boolean; results?: string[]; error?: string }> {
  try {
    const url = `/api/service/apply-server-config?XTransformPort=${FREERADIUS_SERVICE_PORT}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const result = await response.json();
    if (result.success) {
      console.log('[radius-server] FreeRADIUS config applied:', result.results);
    } else {
      console.error('[radius-server] FreeRADIUS config apply failed:', result.error);
    }
    return result;
  } catch (err) {
    console.error('[radius-server] FreeRADIUS service unreachable:', err);
    return { success: false, error: 'FreeRADIUS service unreachable — config saved to DB only' };
  }
}

// GET /api/wifi/radius-server - Get RADIUS server config for property
export async function GET(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = await resolvePropertyId(context, searchParams.get('propertyId'));
    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'No property found. Please create a property first.' }, { status: 400 });
    }

    const config = await db.radiusServerConfig.findUnique({
      where: { propertyId },
    });

    if (!config) {
      // Return default config
      return NextResponse.json({
        success: true,
        data: {
          propertyId,
          serverIp: '127.0.0.1',
          authPort: 1812,
          acctPort: 1813,
          coaPort: 3799,
          listenAllInterfaces: true,
          bindAddress: '0.0.0.0',
          maxAuthWait: 30,
          maxAcctWait: 30,
          cleanupSessions: true,
          sessionCleanupInterval: 3600,
          logAuth: true,
          logAuthBadpass: false,
          logAuthGoodpass: false,
          logDestination: 'files',
          logLevel: 'info',
          status: 'active',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error fetching RADIUS server config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch RADIUS server config' },
      { status: 500 }
    );
  }
}

// POST /api/wifi/radius-server - Create or update RADIUS server config
export async function POST(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const body = await request.json();
    const {
      serverIp,
      serverHostname,
      authPort,
      acctPort,
      coaPort,
      listenAllInterfaces,
      bindAddress,
      maxAuthWait,
      maxAcctWait,
      cleanupSessions,
      sessionCleanupInterval,
      interimUpdateInterval,
      logAuth,
      logAuthBadpass,
      logAuthGoodpass,
      logDestination,
      logLevel,
    } = body;

    const propertyId = await resolvePropertyId(context, body.propertyId);
    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'No property found. Please create a property first.' }, { status: 400 });
    }

    const config = await db.radiusServerConfig.upsert({
      where: { propertyId },
      update: {
        serverIp,
        serverHostname,
        authPort,
        acctPort,
        coaPort,
        listenAllInterfaces,
        bindAddress,
        maxAuthWait,
        maxAcctWait,
        cleanupSessions,
        sessionCleanupInterval,
        interimUpdateInterval,
        logAuth,
        logAuthBadpass,
        logAuthGoodpass,
        logDestination,
        logLevel,
      },
      create: {
        tenantId: context.tenantId,
        propertyId,
        serverIp: serverIp || '127.0.0.1',
        serverHostname,
        authPort: authPort || 1812,
        acctPort: acctPort || 1813,
        coaPort: coaPort || 3799,
        listenAllInterfaces: listenAllInterfaces ?? true,
        bindAddress: bindAddress || '0.0.0.0',
        maxAuthWait: maxAuthWait || 30,
        maxAcctWait: maxAcctWait || 30,
        cleanupSessions: cleanupSessions ?? true,
        sessionCleanupInterval: sessionCleanupInterval || 3600,
        interimUpdateInterval: interimUpdateInterval || 60,
        logAuth: logAuth ?? true,
        logAuthBadpass: logAuthBadpass ?? false,
        logAuthGoodpass: logAuthGoodpass ?? false,
        logDestination: logDestination || 'files',
        logLevel: logLevel || 'info',
      },
    });

    // Apply to FreeRADIUS config files via freeradius-service
    let applyResult: { success: boolean; results?: string[]; error?: string } | null = null;
    try {
      applyResult = await applyServerConfigToFreeRADIUS({
        authPort: config.authPort,
        acctPort: config.acctPort,
        coaPort: config.coaPort,
        bindAddress: config.listenAllInterfaces ? '*' : (config.bindAddress || '*'),
        logDestination: config.logDestination,
        logAuth: config.logAuth,
        logAuthBadpass: config.logAuthBadpass,
        logAuthGoodpass: config.logAuthGoodpass,
      });
    } catch (err) {
      console.error('[radius-server] Failed to apply config to FreeRADIUS:', err);
    }

    return NextResponse.json({
      success: true,
      data: config,
      message: applyResult?.success
        ? 'RADIUS server configuration saved and applied to FreeRADIUS'
        : 'Configuration saved to DB but failed to apply to FreeRADIUS. Restart may be needed.',
      applied: applyResult?.success ?? false,
      applyResults: applyResult?.results,
    });
  } catch (error) {
    console.error('Error saving RADIUS server config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save RADIUS server config' },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/radius-server - Reset to defaults
export async function DELETE(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = await resolvePropertyId(context, searchParams.get('propertyId'));
    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'No property found. Please create a property first.' }, { status: 400 });
    }

    await db.radiusServerConfig.delete({
      where: { propertyId },
    });

    return NextResponse.json({
      success: true,
      message: 'RADIUS server configuration reset to defaults',
    });
  } catch (error) {
    console.error('Error resetting RADIUS server config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset RADIUS server config' },
      { status: 500 }
    );
  }
}
