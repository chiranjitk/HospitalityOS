import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  resetMultiWan,
  applyDgdConfig,
  generateDgdConf,
  MultiWanConfig,
  GatewayDef,
} from '@/lib/network/multiwan';

/**
 * POST   /api/network/os/multiwan — Apply multi-WAN / DGD configuration to OS
 * GET    /api/network/os/multiwan — Get current multi-WAN status from DB
 * DELETE /api/network/os/multiwan — Reset all multi-WAN config
 *
 * Uses shell script wrappers from @/lib/network/multiwan for all OS-level
 * operations (routing tables, ip rules, nftables, ECMP, DGD service).
 *
 * Persists to MultiWanConfig + Gateway + GatewayHealthRule + GatewayExplicitRoute + GatewayFwmark.
 *
 * NOTE: The actual DGD daemon (dgd binary) and health check scripts are
 * managed externally by the user. This endpoint generates configuration
 * files and triggers the service.
 */

const VALID_MODES = ['weighted', 'failover', 'round-robin', 'ECMP'];

function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => { const n = parseInt(p, 10); return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p; });
}

// ──────────────────────────────────────────────────────────
// GET /api/network/os/multiwan — Get current multi-WAN status
// ──────────────────────────────────────────────────────────
export async function GET() {
  try {
    const results: Record<string, any> = {};

    // OS-level state (shell scripts handle actual routing state)
    results.customRoutingTables = [];
    results.customRules = [];
    results.nftablesChain = { exists: false, chain: 'staysuite_multiwan' };
    results.ecmpDefaultRoute = null;

    // Get first available MultiWanConfig from DB
    try {
      const config = await db.multiWanConfig.findFirst({
        where: { enabled: true },
        include: {
          gateways: {
            where: { enabled: true },
            include: {
              healthRules: { orderBy: { sortOrder: 'asc' } },
              explicitRoutes: true,
              fwmarks: true,
            },
            orderBy: [{ isBackup: 'asc' }, { weight: 'desc' }],
          },
        },
      });
      results.dbConfig = config;
    } catch (dbErr: any) {
      console.warn('[Network OS API] DB fetch failed for multi-WAN config:', dbErr);
      results.dbConfig = null;
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('[Network OS API] Multi-WAN status error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to get multi-WAN status' } },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────────────────
// POST /api/network/os/multiwan — Apply multi-WAN / DGD config
// ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      enabled,
      mode,
      gateways = [],
      checkInterval,
      pingCount,
      pingTimeout,
      tcpTimeout,
    } = body;

    // ── If explicitly disabling, reset everything ──
    if (enabled === false) {
      return handleReset();
    }

    const wanMode = mode || 'weighted';
    if (!VALID_MODES.includes(wanMode)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_MODE', message: `Mode must be one of: ${VALID_MODES.join(', ')}` } },
        { status: 400 }
      );
    }

    if (!Array.isArray(gateways) || gateways.length < 1) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'At least 1 gateway is required' } },
        { status: 400 }
      );
    }

    // ── Validate gateways ──
    const validGateways: GatewayDef[] = [];

    for (const gw of gateways) {
      if (!gw.interfaceName) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_INTERFACE', message: 'Gateway missing interfaceName' } },
          { status: 400 }
        );
      }
      if (!gw.ipAddress || !isValidIPv4(gw.ipAddress)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_GATEWAY', message: `Invalid gateway IP for ${gw.interfaceName}` } },
          { status: 400 }
        );
      }

      validGateways.push({
        name: gw.name || gw.interfaceName,
        ipAddress: gw.ipAddress,
        interfaceName: gw.interfaceName,
        interfaceId: gw.interfaceId || undefined,
        weight: gw.weight ? parseInt(String(gw.weight), 10) : 1,
        isBackup: !!gw.isBackup,
        backupGatewayId: gw.backupGatewayId || undefined,
        routingTableId: gw.routingTableId ? parseInt(String(gw.routingTableId), 10) : 0,
        enabled: gw.enabled !== false,
        healthRules: (gw.healthRules || []).map((r: any, i: number) => ({
          protocol: r.protocol || 'PING',
          host: r.host || '',
          port: r.port || 0,
          operator: r.operator || '&',
          sortOrder: r.sortOrder ?? i,
        })),
        explicitRoutes: (gw.explicitRoutes || []).map((r: any) => ({
          network: r.network || '',
          description: r.description || '',
        })),
        fwmarks: (gw.fwmarks || []).map((f: any) => ({
          fwmarkValue: f.fwmarkValue || '0x1',
          description: f.description || '',
        })),
      });
    }

    const results: { step: string; success: boolean; message: string }[] = [];

    // ── Step 1: Generate DGD configuration files ──
    const mwConfig: MultiWanConfig = {
      daemon: {
        mode: wanMode as MultiWanConfig['daemon']['mode'],
        checkInterval: checkInterval ? parseInt(String(checkInterval), 10) : 20,
        pingCount: pingCount ? parseInt(String(pingCount), 10) : 3,
        pingTimeout: pingTimeout ? parseInt(String(pingTimeout), 10) : 2,
        tcpTimeout: tcpTimeout ? parseInt(String(tcpTimeout), 10) : 5,
        autoSwitchback: body.autoSwitchback ?? true,
        switchbackDelay: body.switchbackDelay ? parseInt(String(body.switchbackDelay), 10) : 300,
        flushConntrackOnFailover: body.flushConntrackOnFailover ?? true,
      },
      gateways: validGateways,
    };

    // Generate per-gateway dgd.conf files
    try {
      const confResult = generateDgdConf(mwConfig);
      results.push({
        step: 'generate-conf',
        success: confResult.success,
        message: confResult.success
          ? `DGD config files generated for ${validGateways.length} gateway(s)`
          : confResult.error || 'Failed to generate DGD config files',
      });
    } catch (e: any) {
      results.push({ step: 'generate-conf', success: false, message: String(e) });
    }

    // ── Step 2: Apply DGD configuration to OS ──
    try {
      const applyResult = applyDgdConfig(mwConfig);
      results.push({
        step: 'apply-dgd',
        success: applyResult.success,
        message: applyResult.success
          ? `DGD ${wanMode} configuration applied: ${applyResult.data?.gatewaysConfigured?.length || 0} gateway(s), table 221 ${applyResult.data?.table221Updated ? 'updated' : 'unchanged'}`
          : applyResult.error || `Failed to apply DGD configuration`,
      });
    } catch (e: any) {
      results.push({ step: 'apply-dgd', success: false, message: String(e) });
    }

    return NextResponse.json({
      success: true,
      message: `Multi-WAN / DGD configuration applied (mode: ${wanMode})`,
      results,
      data: {
        enabled: true,
        mode: wanMode,
        gateways: validGateways.map(g => ({
          name: g.name,
          interfaceName: g.interfaceName,
          ipAddress: g.ipAddress,
          weight: g.weight,
          isBackup: g.isBackup,
          routingTableId: g.routingTableId,
          enabled: g.enabled,
          healthRules: g.healthRules.length,
          explicitRoutes: g.explicitRoutes.length,
          fwmarks: g.fwmarks.length,
        })),
      },
    });
  } catch (error) {
    console.error('[Network OS API] Multi-WAN apply error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to apply multi-WAN configuration' } },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────────────────
// DELETE /api/network/os/multiwan — Reset multi-WAN config
// ──────────────────────────────────────────────────────────
export async function DELETE() {
  return handleReset();
}

/**
 * Internal: Reset all multi-WAN state (OS via shell script).
 * DB state is managed by the /api/wifi/network/multiwan endpoint.
 */
async function handleReset(): Promise<NextResponse> {
  const results: { step: string; success: boolean; message: string }[] = [];

  // Reset OS-level multi-WAN via shell script wrapper
  try {
    const resetResult = resetMultiWan();
    results.push({
      step: 'os-reset',
      success: resetResult.success,
      message: resetResult.success
        ? `Multi-WAN reset: ${resetResult.data?.rulesRemoved || 0} rules removed, ${resetResult.data?.tablesFlushed || 0} tables flushed`
        : resetResult.error || 'Failed to reset multi-WAN',
    });
  } catch (e: any) {
    results.push({ step: 'os-reset', success: false, message: String(e) });
  }

  return NextResponse.json({
    success: true,
    message: 'Multi-WAN / DGD configuration reset',
    results,
  });
}
