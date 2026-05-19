'use client';

import dynamic from 'next/dynamic';
import type React from 'react';

// ─── Shared loading placeholder for heavy WiFi components ────────────────────
const wifiLoadingPlaceholder = () => (
  <div className="p-6 animate-pulse">
    <div className="h-8 bg-muted rounded w-48 mb-4" />
    <div className="h-64 bg-muted rounded" />
  </div>
);

// ─── Lazy-loaded heavy WiFi components (2K-4K lines each) ──────────────────
// Phase 3.1 RAM optimization: converted from bare import() to next/dynamic
// with ssr: false and loading placeholders to reduce initial bundle size

const FirewallPage = dynamic(
  () => import('@/components/wifi/firewall-page').then(m => ({ default: m.FirewallPage ?? m.default })),
  { ssr: false, loading: wifiLoadingPlaceholder }
);

const PortalPage = dynamic(
  () => import('@/components/wifi/portal-page').then(m => ({ default: m.PortalPage ?? m.default })),
  { ssr: false, loading: wifiLoadingPlaceholder }
);

const ReportsPage = dynamic(
  () => import('@/components/wifi/reports-page').then(m => ({ default: m.ReportsPage ?? m.default })),
  { ssr: false, loading: wifiLoadingPlaceholder }
);

const NetworkPage = dynamic(
  () => import('@/components/wifi/network-page').then(m => ({ default: m.NetworkPage ?? m.default })),
  { ssr: false, loading: wifiLoadingPlaceholder }
);

const GatewayDiagnostics = dynamic(
  () => import('@/components/wifi/gateway-diagnostics').then(m => ({ default: m.GatewayDiagnostics ?? m.default })),
  { ssr: false, loading: wifiLoadingPlaceholder }
);

const DhcpPage = dynamic(
  () => import('@/components/wifi/dhcp-page').then(m => ({ default: m.DhcpPage ?? m.default })),
  { ssr: false, loading: wifiLoadingPlaceholder }
);

const ZtnaDevicePolicies = dynamic(
  () => import('@/components/wifi/ztna-device-policies').then(m => ({ default: m.ZtnaDevicePolicies ?? m.default })),
  { ssr: false, loading: wifiLoadingPlaceholder }
);

const AAAConfig = dynamic(
  () => import('@/components/wifi/aaa-config').then(m => ({ default: m.AAAConfig ?? m.default })),
  { ssr: false, loading: wifiLoadingPlaceholder }
);

const DnsPage = dynamic(
  () => import('@/components/wifi/dns-page').then(m => ({ default: m.DnsPage ?? m.default })),
  { ssr: false, loading: wifiLoadingPlaceholder }
);

// Category loader: WiFi
export default async function loadSection(section: string): Promise<{ default: React.ComponentType<any> }> {
  switch (section) {
    case 'wifi':
      // Bare 'wifi' → redirect to first child section (WiFi Access)
      return import('@/components/wifi/wifi-access-page');
    case 'wifi-sessions':
      return import('@/components/wifi/sessions');
    case 'wifi-vouchers':
      return import('@/components/wifi/vouchers');
    case 'wifi-plans':
      return import('@/components/wifi/plans');
    case 'wifi-logs':
      return import('@/components/wifi/usage-logs');
    case 'wifi-gateway':
      return import('@/components/wifi/gateway-integration');
    case 'wifi-aaa':
      return { default: AAAConfig };
    case 'wifi-network':
      return { default: NetworkPage };
    case 'wifi-dhcp':
      return { default: DhcpPage };
    case 'wifi-portal':
      return { default: PortalPage };
    case 'wifi-firewall':
      return { default: FirewallPage };
    case 'wifi-reports':
      return { default: ReportsPage };
    case 'wifi-access':
      return import('@/components/wifi/wifi-access-page');
    case 'wifi-gateway-radius':
      return import('@/components/wifi/gateway-radius-page');
    case 'wifi-dns':
      return { default: DnsPage };
    case 'wifi-concurrent-sessions':
      return import('@/components/wifi/concurrent-sessions');
    case 'wifi-provisioning-logs':
      return import('@/components/wifi/provisioning-logs');
    case 'wifi-bandwidth-scheduler':
      return import('@/components/wifi/bandwidth-scheduler');
    case 'wifi-content-filter':
      return import('@/components/wifi/content-filter');
    case 'wifi-mac-auth':
      return import('@/components/wifi/mac-auth');
    case 'wifi-portal-whitelist':
      return import('@/components/wifi/portal-whitelist');
    case 'wifi-auth-logs':
      return import('@/components/wifi/auth-logs');
    case 'wifi-print-card':
      return import('@/components/wifi/print-card');
    case 'wifi-event-wifi':
      return import('@/components/wifi/event-wifi');
    case 'wifi-live-sessions':
      return import('@/components/wifi/live-sessions');
    case 'wifi-coa-audit':
      return import('@/components/wifi/coa-audit');
    case 'wifi-fap-policies':
      return import('@/components/wifi/fap-policies');
    case 'wifi-web-categories':
      return import('@/components/wifi/web-categories');
    case 'wifi-user-status-history':
      return import('@/components/wifi/user-status-history');
    case 'wifi-nas-health':
      return import('@/components/wifi/nas-health');
    case 'wifi-bw-policy-details':
      return import('@/components/wifi/bw-policy-details');
    case 'wifi-diagnostics':
      return { default: GatewayDiagnostics };
    case 'wifi-health-alerts':
      return import('@/components/wifi/wifi-health-alerts');
    case 'wifi-pre-arrival':
      return import('@/components/wifi/wifi-pre-arrival');
    case 'wifi-device-management':
      return import('@/components/wifi/wifi-device-management');
    case 'wifi-identity-verification':
      return import('@/components/wifi/wifi-identity-verification');
    case 'wifi-consent-management':
      return import('@/components/wifi/wifi-consent-management');
    case 'wifi-bandwidth-upsell':
      return import('@/components/wifi/wifi-bandwidth-upsell');
    case 'wifi-revenue-dashboard':
      return import('@/components/wifi/wifi-revenue-dashboard');
    case 'wifi-satisfaction-surveys':
      return import('@/components/wifi/wifi-satisfaction-surveys');
    case 'wifi-sla-monitoring':
      return import('@/components/wifi/wifi-sla-monitoring');
    default:
      throw new Error(`Unknown wifi section: ${section}`);
  }
}
