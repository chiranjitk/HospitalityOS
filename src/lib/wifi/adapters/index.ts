/**
 * Gateway Adapter Factory — Lazy-loaded version
 *
 * IMPORTANT: All vendor adapter imports are now LAZY (dynamic import()).
 * This prevents Turbopack from compiling 7,737 lines of adapter code
 * at module evaluation time, significantly reducing dev server memory.
 *
 * The `createGatewayAdapter` function is now ASYNC.
 * Callers must use: `const adapter = await createGatewayAdapter(config)`
 */

import type {
  GatewayAdapter,
  GatewayConfig,
  GatewayVendor,
  CoARequest,
  CoAResponse,
  SessionInfo,
  GatewayStatus,
  BandwidthPolicy,
} from './gateway-adapter';

// Re-export types (zero-cost, no code generated)
export type { GatewayConfig, GatewayVendor, CoARequest, CoAResponse, SessionInfo, GatewayStatus, BandwidthPolicy };
export { GatewayAdapter } from './gateway-adapter';

// Vendor-specific config types — re-exported as types only (no runtime cost)
export type CryptskConfig = import('./cryptsk-adapter').CryptskConfig;
export type MikrotikConfig = import('./mikrotik-adapter').MikrotikConfig;
export type TPLinkConfig = import('./tplink-adapter').TPLinkConfig;
export type UniFiConfig = import('./unifi-adapter').UniFiConfig;
export type CambiumConfig = import('./cambium-adapter').CambiumConfig;
export type ArubaConfig = import('./aruba-adapter').ArubaConfig;
export type CiscoConfig = import('./cisco-adapter').CiscoConfig;
export type HuaweiConfig = import('./huawei-adapter').HuaweiConfig;
export type NetgearConfig = import('./netgear-adapter').NetgearConfig;
export type DLinkConfig = import('./dlink-adapter').DLinkConfig;
export type JuniperConfig = import('./juniper-adapter').JuniperConfig;
export type RuijieConfig = import('./ruijie-adapter').RuijieConfig;
export type FortinetConfig = import('./fortinet-adapter').FortinetConfig;
export type RuckusConfig = import('./ruckus-adapter').RuckusConfig;
export type GrandstreamConfig = import('./grandstream-adapter').GrandstreamConfig;

export type VendorConfig = GatewayConfig;

// Vendor metadata (static data — no adapter imports needed)
export const VENDOR_METADATA: Record<GatewayVendor, {
  name: string;
  description: string;
  logo?: string;
  popularIn: string[];
  features: string[];
  apiPort: number;
  coaPort: number;
  radiusPort: number;
}> = {
  cryptsk: {
    name: 'Cryptsk (Native)',
    description: 'Cryptsk Private Limited — Multimode Gateway + RADIUS (Vendor ID 64179)',
    popularIn: ['India', 'Global'],
    features: [
      'Native Multimode (Gateway + RADIUS)',
      'Cryptsk VSA (Vendor ID 64179)',
      'Built-in Captive Portal',
      'Built-in DHCP + NAT',
      'RADIUS CoA (Internal)',
      'Bandwidth Shaping',
      'Data Limit Enforcement',
      'FUP (Fair Usage Policy)',
      'IP Pool Management',
      'VLAN Assignment',
      'Content Filtering',
      'QoS Priority',
    ],
    apiPort: 3000,
    coaPort: 3799,
    radiusPort: 1812,
  },
  mikrotik: {
    name: 'MikroTik',
    description: 'RouterOS - Popular in hospitality and ISP deployments',
    popularIn: ['India', 'Eastern Europe', 'Southeast Asia'],
    features: ['RouterOS API', 'Hotspot Portal', 'CAPsMAN', 'RADIUS CoA', 'Rate Limiting', 'VLAN Assignment'],
    apiPort: 8728,
    coaPort: 3799,
    radiusPort: 1812,
  },
  tplink: {
    name: 'TP-Link Omada',
    description: 'Omada SDN - Cost-effective enterprise WiFi',
    popularIn: ['India', 'China', 'Southeast Asia'],
    features: ['Omada Controller', 'EAP Management', 'Captive Portal', 'Bandwidth Control', 'Multi-site Management', 'Cloud Access'],
    apiPort: 8043,
    coaPort: 3799,
    radiusPort: 1812,
  },
  unifi: {
    name: 'Ubiquiti UniFi',
    description: 'UniFi Network Application - Enterprise grade',
    popularIn: ['USA', 'Europe', 'Middle East'],
    features: ['UniFi Controller', 'Guest Portal', 'VLAN Networks', 'Bandwidth Profiles', 'Deep Packet Inspection', 'Multi-site'],
    apiPort: 8443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  cambium: {
    name: 'Cambium Networks',
    description: 'cnPilot & ePMP - ISP and hospitality focus',
    popularIn: ['India', 'Latin America', 'Africa'],
    features: ['cnMaestro Cloud', 'cnPilot APs', 'ePMP Backhaul', 'RADIUS Integration', 'Bandwidth Management', 'Multi-tenant'],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  aruba: {
    name: 'Aruba Networks (HPE)',
    description: 'ArubaOS & Central - Enterprise hospitality',
    popularIn: ['USA', 'Europe', 'Middle East', 'Asia Pacific'],
    features: ['Aruba Central Cloud', 'Mobility Controller', 'ClearPass Integration', 'Role-based Access', 'AI Insights', 'Location Services'],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  netgear: {
    name: 'Netgear Insight',
    description: 'Insight Instant Mesh & WAC - SMB hospitality (Popular in India)',
    popularIn: ['India', 'USA', 'Europe', 'Middle East'],
    features: ['Insight Cloud Management', 'Instant Mesh', 'Orbi Pro', 'WAC Access Points', 'RADIUS CoA', 'Captive Portal', 'Multi-SSID Support', 'Bandwidth Control', 'VLAN Assignment'],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  dlink: {
    name: 'D-Link Nuclias',
    description: 'Nuclias Connect & Cloud - Popular in India/Asia SMB hospitality',
    popularIn: ['India', 'Southeast Asia', 'Middle East', 'Taiwan'],
    features: ['Nuclias Connect Controller', 'Nuclias Cloud Management', 'DAP Access Points', 'RADIUS Authentication', 'CoA Support', 'Captive Portal', 'Bandwidth Control', 'VLAN Assignment', 'Multi-site Management'],
    apiPort: 8443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  cisco: {
    name: 'Cisco Meraki',
    description: 'Meraki Cloud - Enterprise managed WiFi for hospitality',
    popularIn: ['USA', 'Europe', 'Japan', 'Middle East'],
    features: ['Meraki Dashboard REST API v1', 'MR Access Points', 'MX Security Appliances', 'MS Switches', 'RADIUS Authentication', 'CoA Support', 'Group Policies', 'Splash Page/Captive Portal', 'VLAN Assignment', 'Bandwidth Control', 'Location Analytics'],
    apiPort: 443,
    coaPort: 1700,
    radiusPort: 1812,
  },
  ruckus: {
    name: 'Ruckus Networks',
    description: 'Smart WiFi - High density environments',
    popularIn: ['USA', 'Europe', 'Asia Pacific'],
    features: ['SmartZone Controller', 'ZoneDirector', 'Cloudpath Enrollment', 'SPoT Location', 'Unleashed', 'BeamFlex'],
    apiPort: 8443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  ruijie: {
    name: 'Ruijie Networks',
    description: 'Enterprise WiFi - VERY popular in India & China hospitality',
    popularIn: ['India', 'China', 'Southeast Asia', 'Middle East'],
    features: ['RG-BC Controller', 'RG-AP Access Points', 'RG-S Switches', 'Portal Authentication', 'Ruijie Cloud', 'Smart Roaming', 'Bandwidth Control', 'RADIUS CoA'],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  grandstream: {
    name: 'Grandstream',
    description: 'GWN Series - SMB WiFi solutions',
    popularIn: ['USA', 'Europe', 'Asia'],
    features: ['GWN Manager', 'GWN APs', 'CAP Portal', 'Bandwidth Limits', 'VPN Support', 'Multi-site'],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  juniper: {
    name: 'Juniper Mist',
    description: 'Mist AI - AI-driven WiFi for modern hospitality',
    popularIn: ['USA', 'Europe', 'Japan', 'Middle East'],
    features: ['Mist Cloud API', 'Marvis AI Assistant', 'AI-driven Insights', 'Location Services', 'RADIUS Integration', 'Dynamic Packet Capture', 'Service Level Expectations', 'Virtual Network Assistant'],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  fortinet: {
    name: 'Fortinet',
    description: 'FortiWiFi - Security-first WiFi for enterprise hospitality',
    popularIn: ['USA', 'Europe', 'Asia', 'Middle East'],
    features: ['FortiGate REST API', 'FortiWiFi', 'FortiAP', 'FortiPresence Analytics', 'Zero Trust Network Access', 'Application Control', 'Security Profiles', 'RADIUS CoA', 'Traffic Shaping', 'VLAN Assignment', 'Per-user Bandwidth Control'],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  huawei: {
    name: 'Huawei',
    description: 'AirEngine & CloudEngine - VERY popular in India & Asian hospitality',
    popularIn: ['India', 'China', 'Southeast Asia', 'Middle East', 'Africa'],
    features: ['AirEngine APs', 'CloudEngine Switches', 'Access Controllers', 'eSight Management', 'Huawei Cloud API', 'AI Optimization', '5G/WiFi Convergence', 'RADIUS CoA', 'VLAN Assignment', 'Per-user Bandwidth Control'],
    apiPort: 443,
    coaPort: 3799,
    radiusPort: 1812,
  },
  generic: {
    name: 'Generic RADIUS',
    description: 'Any RADIUS-compatible gateway',
    popularIn: ['Global'],
    features: ['RADIUS Auth', 'RADIUS CoA', 'WISPr Attributes', 'Session Management'],
    apiPort: 1812,
    coaPort: 3799,
    radiusPort: 1812,
  },
};

// Default ports for each vendor
export const DEFAULT_PORTS: Record<GatewayVendor, {
  api: number;
  coa: number;
  radiusAuth: number;
  radiusAcct: number;
}> = {
  cryptsk: { api: 3000, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  mikrotik: { api: 8728, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  tplink: { api: 8043, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  unifi: { api: 8443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  cambium: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  aruba: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  netgear: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  dlink: { api: 8443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  cisco: { api: 443, coa: 1700, radiusAuth: 1812, radiusAcct: 1813 },
  ruijie: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  grandstream: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  ruckus: { api: 8443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  juniper: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  fortinet: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  huawei: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
  generic: { api: 443, coa: 3799, radiusAuth: 1812, radiusAcct: 1813 },
};

// Cache for loaded adapter modules (avoids re-importing on every call)
const adapterCache = new Map<string, any>();

/**
 * Create a gateway adapter for the specified vendor — LAZY LOADED
 *
 * IMPORTANT: This function is now ASYNC because adapters are loaded on demand.
 * Usage: `const adapter = await createGatewayAdapter(config)`
 */
export async function createGatewayAdapter(config: GatewayConfig): Promise<GatewayAdapter> {
  const vendor = config.vendor;
  const defaults = DEFAULT_PORTS[vendor] || DEFAULT_PORTS.generic;

  // Apply defaults
  const fullConfig = {
    ...config,
    radiusAuthPort: config.radiusAuthPort ?? defaults.radiusAuth,
    radiusAcctPort: config.radiusAcctPort ?? defaults.radiusAcct,
    coaPort: config.coaPort ?? defaults.coa,
    coaEnabled: config.coaEnabled ?? true,
  };

  switch (vendor) {
    case 'cryptsk': {
      const mod = adapterCache.get('cryptsk') ?? await import('./cryptsk-adapter');
      adapterCache.set('cryptsk', mod);
      return new mod.CryptskAdapter(fullConfig);
    }
    case 'mikrotik': {
      const mod = adapterCache.get('mikrotik') ?? await import('./mikrotik-adapter');
      adapterCache.set('mikrotik', mod);
      return new mod.MikrotikAdapter(fullConfig);
    }
    case 'tplink': {
      const mod = adapterCache.get('tplink') ?? await import('./tplink-adapter');
      adapterCache.set('tplink', mod);
      return new mod.TPLinkAdapter(fullConfig);
    }
    case 'unifi': {
      const mod = adapterCache.get('unifi') ?? await import('./unifi-adapter');
      adapterCache.set('unifi', mod);
      return new mod.UniFiAdapter(fullConfig);
    }
    case 'cambium': {
      const mod = adapterCache.get('cambium') ?? await import('./cambium-adapter');
      adapterCache.set('cambium', mod);
      return new mod.CambiumAdapter(fullConfig);
    }
    case 'aruba': {
      const mod = adapterCache.get('aruba') ?? await import('./aruba-adapter');
      adapterCache.set('aruba', mod);
      return new mod.ArubaAdapter(fullConfig);
    }
    case 'netgear': {
      const mod = adapterCache.get('netgear') ?? await import('./netgear-adapter');
      adapterCache.set('netgear', mod);
      return new mod.NetgearAdapter(fullConfig);
    }
    case 'dlink': {
      const mod = adapterCache.get('dlink') ?? await import('./dlink-adapter');
      adapterCache.set('dlink', mod);
      return new mod.DLinkAdapter(fullConfig);
    }
    case 'ruijie': {
      const mod = adapterCache.get('ruijie') ?? await import('./ruijie-adapter');
      adapterCache.set('ruijie', mod);
      return new mod.RuijieAdapter(fullConfig);
    }
    case 'fortinet': {
      const mod = adapterCache.get('fortinet') ?? await import('./fortinet-adapter');
      adapterCache.set('fortinet', mod);
      return new mod.FortinetAdapter(fullConfig);
    }
    case 'ruckus': {
      const mod = adapterCache.get('ruckus') ?? await import('./ruckus-adapter');
      adapterCache.set('ruckus', mod);
      return new mod.RuckusAdapter(fullConfig);
    }
    case 'juniper': {
      const mod = adapterCache.get('juniper') ?? await import('./juniper-adapter');
      adapterCache.set('juniper', mod);
      return new mod.JuniperAdapter(fullConfig);
    }
    case 'cisco': {
      const mod = adapterCache.get('cisco') ?? await import('./cisco-adapter');
      adapterCache.set('cisco', mod);
      return new mod.CiscoAdapter(fullConfig);
    }
    case 'huawei': {
      const mod = adapterCache.get('huawei') ?? await import('./huawei-adapter');
      adapterCache.set('huawei', mod);
      return new mod.HuaweiAdapter(fullConfig);
    }
    case 'grandstream': {
      const mod = adapterCache.get('grandstream') ?? await import('./grandstream-adapter');
      adapterCache.set('grandstream', mod);
      return new mod.GrandstreamAdapter(fullConfig);
    }
    case 'generic':
    default: {
      const GenericAdapter = await getGenericAdapter();
      return new GenericAdapter(fullConfig);
    }
  }
}

// Lazy-load the GenericAdapter (uses Node.js `net` module)
let _GenericAdapterClass: typeof import('./gateway-adapter').GatewayAdapter | null = null;

async function getGenericAdapter() {
  if (_GenericAdapterClass) return _GenericAdapterClass;

  // Load net module lazily
  const net = await import('net');

  // Define GenericAdapter at runtime (not at module evaluation time)
  const { GatewayAdapter } = await import('./gateway-adapter');

  class GenericAdapter extends GatewayAdapter {
    getVendor() { return 'generic' as const; }

    async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
      return new Promise((resolve) => {
        const startTime = Date.now();
        const socket = new net.Socket();
        socket.setTimeout(5000);
        const port = this.config.coaPort || 3799;

        socket.connect(port, this.config.ipAddress, () => {
          const latency = Date.now() - startTime;
          socket.destroy();
          resolve({ success: true, latency });
        });

        socket.on('error', (err) => {
          resolve({ success: false, error: err.message });
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve({ success: false, error: 'Timeout' });
        });
      });
    }

    async sendCoA(request: CoARequest): Promise<CoAResponse> {
      try {
        const radiusServiceUrl = process.env.RADIUS_SERVICE_URL || 'http://127.0.0.1:3010';
        const url = `${radiusServiceUrl}/api/coa/disconnect`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: request.username,
            sessionId: request.sessionId,
            nasIp: this.config.ipAddress,
            nasSecret: this.config.secret,
            coaPort: this.config.coaPort || 3799,
          }),
        });

        if (!response.ok) {
          return { success: false, message: `CoA failed: ${response.status}` };
        }

        const result = await response.json();
        return {
          success: result.success ?? true,
          message: `Generic CoA ${request.action} for ${request.username} via ${this.config.ipAddress}`,
        };
      } catch (err) {
        return {
          success: false,
          message: `Generic CoA ${request.action} error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    async getStatus(): Promise<GatewayStatus> {
      return { online: true, lastSeen: new Date() };
    }

    async getActiveSessions(): Promise<SessionInfo[]> {
      return [];
    }

    async disconnectSession(sessionId: string, username: string): Promise<CoAResponse> {
      return this.sendCoA({ username, sessionId, action: 'disconnect' });
    }

    async updateBandwidth(sessionId: string, username: string, policy: BandwidthPolicy): Promise<CoAResponse> {
      const attrs = this.getRadiusAttributes(policy);
      return this.sendCoA({ username, sessionId, action: 'update', attributes: attrs });
    }

    getHealthCheckEndpoints(): string[] { return []; }
  }

  _GenericAdapterClass = GenericAdapter as any;
  return GenericAdapter;
}
