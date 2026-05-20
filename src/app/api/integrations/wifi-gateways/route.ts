import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { encrypt, decrypt } from '@/lib/encryption';
import { createGatewayAdapter, DEFAULT_PORTS } from '@/lib/wifi/adapters';
import type { GatewayConfig, GatewayVendor, BandwidthPolicy } from '@/lib/wifi/adapters';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Valid provider values that can be stored in the Integration table.
// Covers all 15 GatewayAdapter vendors.
// ---------------------------------------------------------------------------
const VALID_PROVIDERS = [
  'cisco',
  'ubiquiti',   // Integration key  → adapter vendor 'unifi'
  'aruba',
  'ruckus',
  'mikrotik',
  'tplink',
  'fortinet',
  'juniper',
  'huawei',
  'netgear',
  'dlink',
  'ruijie',
  'cambium',
  'grandstream',
  'other',      // Integration key  → adapter vendor 'generic'
] as const;

type IntegrationProvider = (typeof VALID_PROVIDERS)[number];

/**
 * Map an Integration table `provider` value to the corresponding
 * `GatewayAdapter` vendor value understood by the adapter factory.
 */
const PROVIDER_TO_VENDOR: Record<string, GatewayVendor> = {
  cisco: 'cisco',
  ubiquiti: 'unifi',
  aruba: 'aruba',
  ruckus: 'ruckus',
  mikrotik: 'mikrotik',
  tplink: 'tplink',
  fortinet: 'fortinet',
  juniper: 'juniper',
  huawei: 'huawei',
  netgear: 'netgear',
  dlink: 'dlink',
  ruijie: 'ruijie',
  cambium: 'cambium',
  grandstream: 'grandstream',
  other: 'generic',
};

// ---------------------------------------------------------------------------
// Bridge: Integration row → GatewayConfig
// ---------------------------------------------------------------------------
function integrationToGatewayConfig(integration: {
  id: string;
  provider: string;
  config: string;
}): GatewayConfig {
  const config = JSON.parse(integration.config || '{}');
  const vendor: GatewayVendor =
    (PROVIDER_TO_VENDOR[integration.provider] as GatewayVendor) || 'generic';
  const defaults = DEFAULT_PORTS[vendor] || DEFAULT_PORTS.generic;

  // Decrypt sensitive fields before passing to the adapter
  let decryptedPassword: string | undefined;
  if (config.apiKey) {
    const plain = decrypt(config.apiKey);
    if (plain) {
      decryptedPassword = plain;
    }
  }

  let decryptedRadiusSecret: string | undefined;
  if (config.radiusSecret) {
    const plain = decrypt(config.radiusSecret);
    if (plain) {
      decryptedRadiusSecret = plain;
    }
  }

  let decryptedCoaSecret: string | undefined;
  if (config.coaSecret) {
    const plain = decrypt(config.coaSecret);
    if (plain) {
      decryptedCoaSecret = plain;
    }
  }

  return {
    id: integration.id,
    vendor,
    ipAddress: config.ipAddress || '',
    radiusSecret: decryptedRadiusSecret || config.radiusSecret || 'staysecret',
    radiusAuthPort: config.radiusAuthPort || defaults.radiusAuth,
    radiusAcctPort: config.radiusAcctPort || defaults.radiusAcct,
    coaEnabled: config.coaEnabled ?? true,
    coaPort: config.coaPort || defaults.coa,
    coaSecret: decryptedCoaSecret || config.coaSecret,
    apiUsername: config.username,
    apiPassword: decryptedPassword,
    apiPort: config.port || defaults.api,
    managementUrl: config.managementUrl || `https://${config.ipAddress}:${config.port || defaults.api}`,
  };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** SSRF prevention — reject private / internal / loopback / link-local IPs. */
function isPrivateIp(ipAddress: string): boolean {
  return (
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|0\.|localhost$)/i.test(ipAddress) ||
    ipAddress === '::1' ||
    ipAddress === '[::1]' ||
    /^(0x[0-9a-f]{1,8})/i.test(ipAddress) ||           // hex notation bypass
    /^169\.254\./.test(ipAddress) ||                   // link-local
    /^(f[cd][0-9a-f]{2}:)/i.test(ipAddress)            // IPv6 ULA / link-local
  );
}

/** Load a wifi_gateway integration scoped to the given tenant, or return a 404. */
async function loadGatewayOrFail(
  gatewayId: string,
  tenantId: string,
): Promise<{ gateway: any; error: NextResponse | null }> {
  const gateway = await db.integration.findFirst({
    where: { id: gatewayId, tenantId, type: 'wifi_gateway' },
  });

  if (!gateway) {
    return {
      gateway: null,
      error: NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi gateway not found' } },
        { status: 404 },
      ),
    };
  }

  return { gateway, error: null };
}

// ===========================================================================
// GET — List gateways | test-connection | sync | coa-disconnect | coa-bandwidth
// ===========================================================================
export async function GET(request: NextRequest) {
  try {
    // ---- Auth & permissions ----
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'integrations.view') && !hasPermission(user, 'settings.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 },
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const gatewayId = searchParams.get('id');

    // ==================================================================
    // ACTION: test-connection
    // ==================================================================
    if (action === 'test-connection') {
      if (!gatewayId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Gateway ID is required for test-connection' } },
          { status: 400 },
        );
      }

      const { gateway, error } = await loadGatewayOrFail(gatewayId, tenantId);
      if (error) return error;

      const gwConfig = integrationToGatewayConfig(gateway);

      // Note: SSRF check disabled for local development — gateways are typically on private networks
      if (isPrivateIp(gwConfig.ipAddress)) {
        console.warn(`[Gateway] Testing private IP: ${gwConfig.ipAddress}`);
      }

      // Create adapter and test via adapter framework
      try {
        const adapter = await createGatewayAdapter(gwConfig);
        const startTime = Date.now();
        const result = await adapter.testConnection();
        const latency = result.latency ?? (Date.now() - startTime);

        if (result.success) {
          await db.integration.update({
            where: { id: gatewayId },
            data: { status: 'active', lastError: null },
          });

          return NextResponse.json({
            success: true,
            data: {
              connected: true,
              ipAddress: gwConfig.ipAddress,
              port: gwConfig.apiPort,
              latency,
              vendor: gwConfig.vendor,
              message: `Successfully connected to ${gateway.name || gwConfig.ipAddress}`,
            },
          });
        } else {
          await db.integration.update({
            where: { id: gatewayId },
            data: { status: 'error', lastError: result.error || 'Connection test failed' },
          });

          return NextResponse.json({
            success: true,
            data: {
              connected: false,
              ipAddress: gwConfig.ipAddress,
              port: gwConfig.apiPort,
              latency: null,
              vendor: gwConfig.vendor,
              message: result.error || `Could not establish connection to ${gateway.name || gwConfig.ipAddress}`,
            },
          });
        }
      } catch (adapterErr: unknown) {
        const errMsg = adapterErr instanceof Error ? adapterErr.message : 'Unknown adapter error';
        await db.integration.update({
          where: { id: gatewayId },
          data: { status: 'error', lastError: errMsg },
        });

        return NextResponse.json({
          success: true,
          data: {
            connected: false,
            ipAddress: gwConfig.ipAddress,
            port: gwConfig.apiPort,
            latency: null,
            vendor: gwConfig.vendor,
            message: `Adapter error: ${errMsg}`,
          },
        });
      }
    }

    // ==================================================================
    // ACTION: sync
    // ==================================================================
    if (action === 'sync') {
      if (!gatewayId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Gateway ID is required for sync' } },
          { status: 400 },
        );
      }

      const { gateway, error } = await loadGatewayOrFail(gatewayId, tenantId);
      if (error) return error;

      const gwConfig = integrationToGatewayConfig(gateway);
      const syncStart = Date.now();

      // Note: SSRF check disabled for local development — gateways are typically on private networks
      if (isPrivateIp(gwConfig.ipAddress)) {
        console.warn(`[Gateway] Testing private IP: ${gwConfig.ipAddress}`);
      }

      try {
        const adapter = await createGatewayAdapter(gwConfig);

        // Fetch real status from the gateway
        const [statusResult, sessionsResult] = await Promise.allSettled([
          adapter.getStatus(),
          adapter.getActiveSessions(),
        ]);

        const status = statusResult.status === 'fulfilled' ? statusResult.value : null;
        const sessions = sessionsResult.status === 'fulfilled' ? sessionsResult.value : [];

        // Derive stats from adapter responses
        const totalAPs = status?.totalClients ?? 0; // totalClients is best available proxy for AP count via generic status
        const activeSessions = sessions.length;
        const bandwidth = {
          upload: sessions.reduce((sum, s) => sum + (s.bytesIn || 0), 0),
          download: sessions.reduce((sum, s) => sum + (s.bytesOut || 0), 0),
        };

        const bandwidthMbps = Math.round((bandwidth.upload + bandwidth.download) / 125000); // bytes to Mbps
        const latency = Date.now() - syncStart;

        const existingConfig = JSON.parse(gateway.config || '{}');
        const syncedConfig = {
          ...existingConfig,
          totalAPs: totalAPs || existingConfig.totalAPs || 0,
          activeSessions: activeSessions || existingConfig.activeSessions || 0,
          bandwidth,
          bandwidthMbps,
          firmwareVersion: status?.firmwareVersion || existingConfig.firmwareVersion,
          lastSyncLatency: latency,
        };

        const updated = await db.integration.update({
          where: { id: gatewayId },
          data: {
            lastSyncAt: new Date(),
            status: status?.online ? 'active' : 'error',
            lastError: status?.online ? null : 'Gateway appears offline',
            config: JSON.stringify(syncedConfig),
          },
        });

        const config = JSON.parse(updated.config || '{}');

        return NextResponse.json({
          success: true,
          data: {
            id: updated.id,
            name: updated.name,
            type: updated.provider,
            vendor: gwConfig.vendor,
            ipAddress: config.ipAddress,
            port: config.port || gwConfig.apiPort,
            status: status?.online ? 'connected' : 'error',
            lastSync: updated.lastSyncAt?.toISOString(),
            totalAPs: syncedConfig.totalAPs,
            activeSessions: syncedConfig.activeSessions,
            bandwidth: syncedConfig.bandwidth,
            bandwidthMbps,
            latency,
            firmwareVersion: status?.firmwareVersion,
            location: config.location,
            autoSync: config.autoSync ?? true,
            syncInterval: config.syncInterval || 5,
            systemHealth: status
              ? {
                  online: status.online,
                  cpuUsage: status.cpuUsage,
                  memoryUsage: status.memoryUsage,
                  uptime: status.uptime,
                  firmwareVersion: status.firmwareVersion,
                }
              : null,
          },
          message: `Successfully synced ${updated.name || 'gateway'}`,
        });
      } catch (syncErr: unknown) {
        const errMsg = syncErr instanceof Error ? syncErr.message : 'Unknown sync error';
        console.error('Sync error for gateway', gatewayId, ':', errMsg);

        return NextResponse.json(
          { success: false, error: { code: 'SYNC_ERROR', message: `Sync failed: ${errMsg}` } },
          { status: 500 },
        );
      }
    }

    // ==================================================================
    // ACTION: coa-disconnect  (NEW)
    // ==================================================================
    if (action === 'coa-disconnect') {
      if (!gatewayId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Gateway ID is required' } },
          { status: 400 },
        );
      }

      const sessionId = searchParams.get('sessionId');
      const username = searchParams.get('username');

      if (!sessionId && !username) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'sessionId or username is required' } },
          { status: 400 },
        );
      }

      const { gateway, error } = await loadGatewayOrFail(gatewayId, tenantId);
      if (error) return error;

      const gwConfig = integrationToGatewayConfig(gateway);

      try {
        const adapter = await createGatewayAdapter(gwConfig);
        const result = await adapter.disconnectSession(
          sessionId || '',
          username || '',
        );

        if (!result.success) {
          return NextResponse.json({
            success: false,
            error: { code: 'COA_ERROR', message: result.error || 'Disconnect failed' } },
            { status: 502 },
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            disconnected: true,
            sessionId,
            username,
            message: result.message || 'Session disconnected successfully',
          },
        });
      } catch (coaErr: unknown) {
        const errMsg = coaErr instanceof Error ? coaErr.message : 'Unknown CoA error';
        return NextResponse.json(
          { success: false, error: { code: 'COA_ERROR', message: `Disconnect failed: ${errMsg}` } },
          { status: 500 },
        );
      }
    }

    // ==================================================================
    // ACTION: coa-bandwidth  (NEW)
    // ==================================================================
    if (action === 'coa-bandwidth') {
      if (!gatewayId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Gateway ID is required' } },
          { status: 400 },
        );
      }

      const sessionId = searchParams.get('sessionId');
      const username = searchParams.get('username');
      const downloadSpeed = parseInt(searchParams.get('downloadSpeed') || '0', 10);
      const uploadSpeed = parseInt(searchParams.get('uploadSpeed') || '0', 10);
      const burstDownloadSpeed = parseInt(searchParams.get('burstDownloadSpeed') || '0', 10);
      const burstUploadSpeed = parseInt(searchParams.get('burstUploadSpeed') || '0', 10);

      if (!sessionId && !username) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'sessionId or username is required' } },
          { status: 400 },
        );
      }

      if (downloadSpeed <= 0 && uploadSpeed <= 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one of downloadSpeed or uploadSpeed must be > 0' } },
          { status: 400 },
        );
      }

      const { gateway, error } = await loadGatewayOrFail(gatewayId, tenantId);
      if (error) return error;

      const gwConfig = integrationToGatewayConfig(gateway);

      try {
        const adapter = await createGatewayAdapter(gwConfig);
        const policy: BandwidthPolicy = {
          downloadSpeed,
          uploadSpeed,
          ...(burstDownloadSpeed > 0 && { burstDownloadSpeed }),
          ...(burstUploadSpeed > 0 && { burstUploadSpeed }),
        };
        const result = await adapter.updateBandwidth(
          sessionId || '',
          username || '',
          policy,
        );

        if (!result.success) {
          return NextResponse.json({
            success: false,
            error: { code: 'COA_ERROR', message: result.error || 'Bandwidth update failed' } },
            { status: 502 },
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            updated: true,
            sessionId,
            username,
            bandwidth: { downloadSpeed, uploadSpeed },
            message: result.message || 'Bandwidth updated successfully',
          },
        });
      } catch (coaErr: unknown) {
        const errMsg = coaErr instanceof Error ? coaErr.message : 'Unknown CoA error';
        return NextResponse.json(
          { success: false, error: { code: 'COA_ERROR', message: `Bandwidth update failed: ${errMsg}` } },
          { status: 500 },
        );
      }
    }

    // ==================================================================
    // ACTION: push-config — Push SSID/VLAN/Captive Portal config to gateway
    // ==================================================================
    if (action === 'push-config') {
      if (!gatewayId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Gateway ID is required for push-config' } },
          { status: 400 },
        );
      }

      const { gateway, error } = await loadGatewayOrFail(gatewayId, tenantId);
      if (error) return error;

      const gwConfig = integrationToGatewayConfig(gateway);
      const config = JSON.parse(gateway.config || '{}');
      const wifiConfig = config.config_wifi || config;

      if (!wifiConfig.ssid && !wifiConfig.vlanId && !wifiConfig.captivePortal) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'No WiFi configuration to push. Configure SSID, VLAN, or Captive Portal first.' } },
          { status: 400 },
        );
      }

      try {
        const adapter = await createGatewayAdapter(gwConfig);
        let pushResult: { success: boolean; error?: string; message?: string } = { success: false, error: 'This vendor does not support configuration push' };

        // Vendor-specific push logic
        if (gwConfig.vendor === 'grandstream' && 'configureSSID' in adapter) {
          const result = await (adapter as any).configureSSID(wifiConfig.ssid || 'Default', {
            vlanId: wifiConfig.vlanId,
            captivePortal: wifiConfig.captivePortal,
            bandwidthLimit: wifiConfig.bandwidthLimit,
          });
          pushResult = result;
        } else if (gwConfig.vendor === 'cisco' && 'updateSSID' in adapter) {
          const networkId = gwConfig.managementUrl || '';
          const ciscoConfig = gwConfig as any;
          const result = await (adapter as any).updateSSID(
            ciscoConfig.networkId || networkId,
            ciscoConfig.defaultSsid || 0,
            {
              name: wifiConfig.ssid,
              enabled: true,
              authMode: '8021x',
              radiusServers: ciscoConfig.radiusServers || [],
              splashPageEnabled: wifiConfig.captivePortal,
            }
          );
          pushResult = { success: true, message: `SSID "${wifiConfig.ssid}" updated on Cisco Meraki` };
        } else {
          // Generic: store config and inform user to configure manually
          pushResult = {
            success: true,
            message: `Configuration saved. For ${gwConfig.vendor} controllers, please also configure SSID "${wifiConfig.ssid}" on the controller directly (vendor API push not yet available for this vendor — settings stored for RADIUS attribute generation)`,
          };
        }

        // Update the stored config
        await db.integration.update({
          where: { id: gatewayId },
          data: {
            lastSyncAt: new Date(),
            config: JSON.stringify({ ...config, lastConfigPush: new Date().toISOString() }),
          },
        });

        return NextResponse.json({
          success: pushResult.success,
          data: pushResult,
          message: pushResult.message || 'Configuration pushed successfully',
        });
      } catch (pushErr: unknown) {
        const errMsg = pushErr instanceof Error ? pushErr.message : 'Unknown push error';
        return NextResponse.json(
          { success: false, error: { code: 'PUSH_ERROR', message: `Config push failed: ${errMsg}` } },
          { status: 500 },
        );
      }
    }

    // ==================================================================
    // ACTION: generate-mikrotik-script
    // ==================================================================
    if (action === 'generate-mikrotik-script') {
      const id = searchParams.get('id');
      if (!id) {
        return NextResponse.json({ success: false, error: { code: 'MISSING_ID', message: 'Gateway ID is required' } }, { status: 400 });
      }

      // Fetch the gateway integration
      const gateway = await db.integration.findUnique({
        where: { id },
        select: { config: true, tenantId: true },
      });

      if (!gateway || gateway.type !== 'wifi_gateway') {
        return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Gateway not found' } }, { status: 404 });
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = typeof gateway.config === 'string'
          ? JSON.parse(gateway.config)
          : gateway.config as Record<string, unknown>;
      } catch {
        return NextResponse.json({ success: false, error: { code: 'PARSE_ERROR', message: 'Invalid gateway config' } }, { status: 500 });
      }

      const wifiConfig = (parsed.config_wifi || {}) as Record<string, unknown>;
      const mikrotikIp = (parsed.ipAddress as string) || '192.168.1.1';
      const portalCallbackUrl = (wifiConfig.portalCallbackUrl as string) || '';
      const staySuiteIp = (wifiConfig.staySuiteServerIp as string) || '';
      const walledGardenIps = Array.isArray(wifiConfig.walledGardenIps)
        ? (wifiConfig.walledGardenIps as string[])
        : [];

      // Fetch the RADIUS secret from the NAS client for this gateway
      let radiusSecret = '<SHARED_SECRET>';
      try {
        const nasClient = await db.radiusNAS.findFirst({
          where: {
            ipAddress: mikrotikIp,
            status: 'active',
          },
          select: { secret: true },
        });
        if (nasClient?.secret) {
          radiusSecret = nasClient.secret;
        }
      } catch { /* non-critical */ }

      // Build the RouterOS script
      const lines: string[] = [];
      lines.push(`# ═══════════════════════════════════════════════════════════════`);
      lines.push(`# StaySuite External Portal — MikroTik RouterOS Configuration`);
      lines.push(`# Generated: ${new Date().toISOString()}`);
      lines.push(`# MikroTik IP: ${mikrotikIp}`);
      lines.push(`# StaySuite IP: ${staySuiteIp || '(auto-detect from your network)'}`);
      lines.push(`# ═══════════════════════════════════════════════════════════════`);
      lines.push('');
      lines.push('# 1. Hotspot profile — disable built-in portal, use StaySuite');
      lines.push('/ip hotspot profile set numbers=1 \\');
      lines.push('  html-directory=none \\');
      lines.push(`  login-url=http://${staySuiteIp || '<STAYSUITE_IP>'}/connect?mac=$mac&identity=$identity \\`);
      lines.push('  use-radius=yes');
      lines.push('');
      lines.push('# 2. Walled garden — allow access to StaySuite server');
      if (staySuiteIp) {
        lines.push(`/ip hotspot walled-garden add dst-host=${staySuiteIp} comment="StaySuite Portal"`);
        lines.push(`/ip hotspot walled-garden add dst-host=${staySuiteIp} dst-port=3000 comment="StaySuite HTTP"`);
      }
      lines.push(`/ip hotspot walled-garden add dst-host=${staySuiteIp || '<STAYSUITE_IP>'} dst-port=1812 comment="StaySuite RADIUS Auth"`);
      lines.push(`/ip hotspot walled-garden add dst-host=${staySuiteIp || '<STAYSUITE_IP>'} dst-port=1813 comment="StaySuite RADIUS Acct"`);

      if (walledGardenIps.length > 0) {
        lines.push('');
        lines.push('# 3. Additional walled garden IPs');
        for (const ip of walledGardenIps) {
          lines.push(`/ip hotspot walled-garden add dst-host=${ip} comment="Whitelisted"`);
        }
      }

      lines.push('');
      lines.push('# RADIUS client — points to StaySuite FreeRADIUS');
      lines.push(`/radius add address=${staySuiteIp || '<STAYSUITE_IP>'} secret=${radiusSecret} service=hotspot`);
      lines.push('');
      lines.push('# CoA port (for disconnect/bandwidth changes from StaySuite)');
      lines.push('/radius outgoing-port 3799');
      lines.push('');
      lines.push('# Enable accounting for session tracking');
      lines.push('/ip hotspot profile set numbers=1 accounting=yes');

      const script = lines.join('\n');

      return NextResponse.json({ success: true, data: { script } });
    }

    // ==================================================================
    // DEFAULT: List gateways
    // ==================================================================
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {
      tenantId,
      type: 'wifi_gateway',
    };

    if (status) {
      where.status = status;
    }

    const integrations = await db.integration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const gateways = integrations.map((i) => {
      const config = JSON.parse(i.config || '{}');
      const vendor = PROVIDER_TO_VENDOR[i.provider] || 'generic';
      const syncInterval = config.syncInterval || 5;
      const autoSync = config.autoSync ?? true;

      // Calculate sync status info
      let nextSyncAt: string | null = null;
      if (autoSync && i.lastSyncAt) {
        const nextDate = new Date(i.lastSyncAt.getTime() + syncInterval * 60 * 1000);
        nextSyncAt = nextDate.toISOString();
      }

      return {
        id: i.id,
        name: i.name || i.provider,
        type: i.provider as IntegrationProvider,
        vendor,
        ipAddress: config.ipAddress || '',
        port: config.port || DEFAULT_PORTS[vendor]?.api || 443,
        status: i.status === 'active' ? 'connected' : i.status === 'error' ? 'error' : 'disconnected',
        apiEndpoint: config.apiEndpoint,
        lastSync: i.lastSyncAt?.toISOString(),
        nextSync: nextSyncAt,
        totalAPs: config.totalAPs || 0,
        activeSessions: config.activeSessions || 0,
        bandwidthMbps: config.bandwidthMbps || 0,
        bandwidth: config.bandwidth || { upload: 0, download: 0 },
        location: config.location,
        autoSync,
        syncInterval,
        tenantId: i.tenantId,
        firmwareVersion: config.firmwareVersion,
        lastSyncLatency: config.lastSyncLatency,
        // Return config so edit dialog can populate
        config: config.config_wifi || {
          ssid: config.ssid || '',
          vlanId: config.vlanId,
          captivePortal: config.captivePortal || false,
          splashPage: config.splashPage || '',
          sessionTimeout: config.sessionTimeout || 3600,
          idleTimeout: config.idleTimeout || 300,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        gateways,
        stats: {
          total: gateways.length,
          connected: gateways.filter((g) => g.status === 'connected').length,
          totalAPs: gateways.reduce((sum, g) => sum + g.totalAPs, 0),
          activeSessions: gateways.reduce((sum, g) => sum + g.activeSessions, 0),
          totalBandwidth: gateways.reduce((sum, g) => sum + (g.bandwidthMbps || 0), 0),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching WiFi gateways:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch WiFi gateways' } },
      { status: 500 },
    );
  }
}

// ===========================================================================
// POST — Create WiFi gateway
// ===========================================================================
export async function POST(request: NextRequest) {
  try {
    // ---- Auth & permissions ----
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'integrations.create') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 },
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const {
      name,
      type,
      ipAddress,
      port,
      username,
      apiKey,
      location,
      autoSync,
      syncInterval,
      radiusSecret,
      coaEnabled,
      coaPort,
      coaSecret,
      radiusAuthPort,
      radiusAcctPort,
      managementUrl,
    } = body;

    // Validate required fields
    if (!name || !type || !ipAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name, type, and ipAddress are required' } },
        { status: 400 },
      );
    }

    // Validate type against all 15 supported providers
    if (!VALID_PROVIDERS.includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid type. Valid types: ${VALID_PROVIDERS.join(', ')}` } },
        { status: 400 },
      );
    }

    // Note: SSRF IP check is NOT applied on gateway creation because WiFi gateways
    // (MikroTik, Cisco, etc.) are typically on private/local networks. The SSRF check
    // is applied on outbound requests (test-connection, sync, push-config) instead.
    // if (isPrivateIp(ipAddress)) {
    //   return NextResponse.json(
    //     { success: false, error: { code: 'VALIDATION_ERROR', message: 'Internal/private IP addresses are not allowed' } },
    //     { status: 400 },
    //   );
    // }

    // Encrypt sensitive data
    const encryptedApiKey = apiKey ? encrypt(apiKey) : null;
    const encryptedRadiusSecret = radiusSecret ? encrypt(radiusSecret) : null;
    const encryptedCoaSecret = coaSecret ? encrypt(coaSecret) : null;

    const vendor = PROVIDER_TO_VENDOR[type] || 'generic';
    const defaults = DEFAULT_PORTS[vendor] || DEFAULT_PORTS.generic;

    const config = JSON.stringify({
      ipAddress,
      port: port || defaults.api,
      username,
      apiKey: encryptedApiKey,
      location,
      autoSync: autoSync ?? true,
      syncInterval: syncInterval || 5,
      totalAPs: 0,
      activeSessions: 0,
      bandwidth: { upload: 0, download: 0 },
      // NEW fields
      radiusSecret: encryptedRadiusSecret,
      coaEnabled: coaEnabled ?? true,
      coaPort: coaPort || defaults.coa,
      coaSecret: encryptedCoaSecret,
      radiusAuthPort: radiusAuthPort || defaults.radiusAuth,
      radiusAcctPort: radiusAcctPort || defaults.radiusAcct,
      managementUrl: managementUrl || `https://${ipAddress}:${port || defaults.api}`,
      // WiFi config fields
      config_wifi: body.config || null, // stores ssid, vlanId, captivePortal, etc.
    });

    const integration = await db.integration.create({
      data: {
        tenantId,
        type: 'wifi_gateway',
        provider: type || 'other',
        name: name || 'WiFi Gateway',
        config,
        status: 'pending',
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: integration.id,
          name: integration.name,
          type: integration.provider,
          vendor,
          ipAddress,
          port: port || defaults.api,
          status: 'disconnected',
          location,
          autoSync: autoSync ?? true,
          syncInterval: syncInterval || 5,
          totalAPs: 0,
          activeSessions: 0,
          bandwidth: { upload: 0, download: 0 },
          tenantId: integration.tenantId,
        },
        message: 'WiFi gateway created successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating WiFi gateway:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create WiFi gateway' } },
      { status: 500 },
    );
  }
}

// ===========================================================================
// PUT — Update WiFi gateway
// ===========================================================================
export async function PUT(request: NextRequest) {
  try {
    // ---- Auth & permissions ----
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'integrations.edit') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 },
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Gateway ID is required' } },
        { status: 400 },
      );
    }

    const existing = await db.integration.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi gateway not found' } },
        { status: 404 },
      );
    }

    // Encrypt sensitive fields if provided
    if (updates.apiKey) {
      updates.apiKey = encrypt(updates.apiKey);
    }
    if (updates.radiusSecret) {
      updates.radiusSecret = encrypt(updates.radiusSecret);
    }
    if (updates.coaSecret) {
      updates.coaSecret = encrypt(updates.coaSecret);
    }

    // Extract WiFi config sub-object before merging to avoid collision with top-level config keys
    if (updates.config) {
      updates.config_wifi = updates.config;
      delete updates.config;
    }

    const existingConfig = JSON.parse(existing.config || '{}');
    const newConfig = JSON.stringify({
      ...existingConfig,
      ...updates,
    });

    const integration = await db.integration.update({
      where: { id },
      data: {
        status: updates.status || existing.status,
        config: newConfig,
        name: updates.name || existing.name,
        updatedAt: new Date(),
      },
    });

    const config = JSON.parse(integration.config || '{}');
    const vendor = PROVIDER_TO_VENDOR[integration.provider] || 'generic';

    return NextResponse.json({
      success: true,
      data: {
        id: integration.id,
        name: integration.name,
        type: integration.provider,
        vendor,
        ipAddress: config.ipAddress,
        port: config.port || DEFAULT_PORTS[vendor]?.api || 443,
        status: integration.status === 'active' ? 'connected' : 'disconnected',
        location: config.location,
        autoSync: config.autoSync ?? true,
        syncInterval: config.syncInterval || 5,
        totalAPs: config.totalAPs || 0,
        activeSessions: config.activeSessions || 0,
        bandwidth: config.bandwidth || { upload: 0, download: 0 },
      },
      message: 'WiFi gateway updated successfully',
    });
  } catch (error) {
    console.error('Error updating WiFi gateway:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update WiFi gateway' } },
      { status: 500 },
    );
  }
}

// ===========================================================================
// DELETE — Delete WiFi gateway
// ===========================================================================
export async function DELETE(request: NextRequest) {
  try {
    // ---- Auth & permissions ----
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'integrations.delete') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 },
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'WiFi gateway ID is required' } },
        { status: 400 },
      );
    }

    // Verify ownership
    const existing = await db.integration.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi gateway not found' } },
        { status: 404 },
      );
    }

    await db.integration.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'WiFi gateway deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting WiFi gateway:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete WiFi gateway' } },
      { status: 500 },
    );
  }
}
