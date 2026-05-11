'use client';

import React, { lazy, useState, useEffect, useCallback, Suspense } from 'react';
import { Wifi, Users, UserPlus, Ticket, BarChart3, Gauge, RefreshCw, QrCode, Server, ShieldCheck, ShieldAlert, Fingerprint, Activity, History, TrendingUp, Network, Layers, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { usePropertyId } from '@/hooks/use-property';
// ─── Lazy imports for tab content ─────────────────────────────────────────
// Keep 10 essential tabs — removed: Bandwidth Scheduler, Content Filter, Smart Bandwidth,
// NAS Health, Provisioning Logs, CoA Audit (duplicates or low-usage)

// v2: Force recompile of live-sessions (dedup fix + uniqueSessions useMemo)
const LiveSessions = lazy(() => import('@/components/wifi/live-sessions'));
const AuthLogsTab = lazy(() => import('@/components/wifi/auth-logs'));
const RadiusUsersTab = lazy(() => import('@/components/wifi/radius-users-tab'));
const SessionHistory = lazy(() => import('@/components/wifi/session-history'));
const UserUsageDashboard = lazy(() => import('@/components/wifi/user-usage-dashboard'));
const WifiPlans = lazy(() => import('@/components/wifi/plans'));
const WifiVouchers = lazy(() => import('@/components/wifi/vouchers'));
const MacAuthTab = lazy(() => import('@/components/wifi/mac-auth'));
const WifiFupPolicy = lazy(() => import('@/components/wifi/fup-policy'));
const EventWifiTab = lazy(() => import('@/components/wifi/event-wifi'));
const IpPoolManagement = lazy(() => import('@/components/wifi/ip-pool-management'));
const BandwidthPoolManagement = lazy(() => import('@/components/wifi/bandwidth-pool-management'));

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-muted/50 rounded-xl border border-border/50" />
        ))}
      </div>
      <div className="h-64 bg-muted/50 rounded-xl border border-border/50" />
    </div>
  );
}

// ─── RADIUS Server Status Card ──────────────────────────────────────────────

function RADIUSStatusCard() {
  const [radiusStatus, setRadiusStatus] = useState<{
    connected: boolean;
    usersSynced: number;
    lastSync: string | null;
    authPort: number;
  }>({ connected: false, usersSynced: 0, lastSync: null, authPort: 1812 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/wifi/radius?action=status');
        const data = await res.json();
        if (data.success && data.data) {
          setRadiusStatus({
            connected: data.data.installed && data.data.running,
            usersSynced: data.data.userCount || 0,
            lastSync: new Date().toISOString(),
            authPort: 1812,
          });
        } else {
          setRadiusStatus(prev => ({ ...prev, connected: false }));
        }
      } catch {
        setRadiusStatus(prev => ({ ...prev, connected: false }));
      } finally {
        setIsLoading(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const isOnline = radiusStatus.connected && !isLoading;

  return (
    <div className={cn('relative rounded-xl', isOnline && 'wifi-mesh-bg')}>
      {/* Animated gradient border — pulses when online */}
      {isOnline && <div className="wifi-pulse-border rounded-xl" />}
      {/* Top gradient status bar — flows when online */}
      {isOnline && <div className="wifi-status-bar rounded-t-xl" />}
      <Card className={cn(
        'border-0 rounded-xl transition-all duration-300',
        isOnline
          ? 'shadow-md hover:shadow-lg bg-emerald-50/30 dark:bg-emerald-950/10'
          : 'shadow-sm hover:shadow-md'
      )}>
        <CardContent className="p-4 relative z-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg transition-colors',
                isOnline
                  ? 'bg-emerald-100 dark:bg-emerald-900/30'
                  : 'bg-muted'
              )}>
                <Server className={cn(
                  'h-4.5 w-4.5',
                  isOnline
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground'
                )} />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">RADIUS Server</span>
                  {isOnline && (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 wifi-live-dot" />
                      LIVE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono tabular-nums">
                  <span>{radiusStatus.usersSynced} users</span>
                  <span className="text-border/60">·</span>
                  <span>Port {radiusStatus.authPort}</span>
                  {radiusStatus.lastSync && (
                    <>
                      <span className="text-border/60">·</span>
                      <span>Last sync {new Date(radiusStatus.lastSync).toLocaleTimeString()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 transition-all duration-300',
                isLoading
                  ? 'border-muted-foreground/30 text-muted-foreground'
                  : radiusStatus.connected
                    ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/30 badge-glow-success'
                    : 'border-red-300 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-400 dark:bg-red-950/30'
              )}
            >
              {isLoading ? (
                <span className="flex items-center gap-1">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  Checking
                </span>
              ) : radiusStatus.connected ? (
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <ShieldAlert className="h-2.5 w-2.5" />
                  Offline
                </span>
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── WiFi Quick Actions ──────────────────────────────────────────────────────

function WiFiQuickActions({ onRefresh, onSwitchToVouchers }: { onRefresh: () => void; onSwitchToVouchers: () => void }) {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncUsers = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-users' }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Sync Complete', description: data.message || 'WiFi users synced successfully' });
      } else {
        toast({ title: 'Sync Failed', description: data.error || 'Failed to sync users', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Sync Failed', description: 'Could not connect to sync service', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Button
        size="sm"
        className="wifi-btn-sync rounded-lg text-xs font-semibold"
        onClick={handleSyncUsers}
        disabled={isSyncing}
      >
        {isSyncing ? (
          <span className="wifi-btn-spinner mr-1.5"><Wifi className="h-3.5 w-3.5" /></span>
        ) : (
          <Wifi className="h-3.5 w-3.5 mr-1.5" />
        )}
        {isSyncing ? 'Syncing...' : 'Sync Users'}
      </Button>
      <Button
        size="sm"
        className="wifi-btn-refresh rounded-lg text-xs font-semibold"
        onClick={onRefresh}
      >
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Refresh Status
      </Button>
      <Button
        size="sm"
        className="wifi-btn-voucher rounded-lg text-xs font-semibold"
        onClick={onSwitchToVouchers}
      >
        <QrCode className="h-3.5 w-3.5 mr-1.5" />
        Generate Voucher
      </Button>
    </div>
  );
}

// ─── Tab Config ──────────────────────────────────────────────────────────────
// 16 tabs → 10 tabs (37% reduction)
// Removed duplicates: Bandwidth Scheduler (Firewall), Content Filter (Network),
//   NAS Health (Gateway/RADIUS), Provisioning Logs (Gateway/RADIUS), CoA Audit (Reports)
// Removed low-usage: Smart Bandwidth (feature-incomplete)
// Ordered by frequency: Live → Access → History → Policy

type TabId = 'live-sessions' | 'users' | 'auth-logs' | 'session-history' | 'user-usage' | 'plans' | 'vouchers' | 'mac-auth' | 'fup-policy' | 'event-wifi' | 'ip-pools' | 'bw-pools';

type TabItem = {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  group: string;
};

type GroupHeader = {
  type: 'header';
  label: string;
  indicatorColor?: string;
};

type TabEntry = TabItem | GroupHeader;

const tabs: TabEntry[] = [
  // ── Live ──
  { type: 'header', label: 'Live', indicatorColor: 'bg-emerald-500' },
  { type: 'tab', id: 'live-sessions', label: 'Active Users', icon: <Activity className="h-4 w-4" />, group: 'live' },
  { type: 'tab', id: 'users', label: 'Users', icon: <UserPlus className="h-4 w-4" />, group: 'live' },
  { type: 'tab', id: 'auth-logs', label: 'Auth Logs', icon: <ShieldCheck className="h-4 w-4" />, group: 'live' },

  // ── History ──
  { type: 'header', label: 'History', indicatorColor: 'bg-teal-500' },
  { type: 'tab', id: 'session-history', label: 'Session History', icon: <History className="h-4 w-4" />, group: 'history' },
  { type: 'tab', id: 'user-usage', label: 'User Usage', icon: <TrendingUp className="h-4 w-4" />, group: 'history' },

  // ── Policy ──
  { type: 'header', label: 'Policy', indicatorColor: 'bg-amber-500' },
  { type: 'tab', id: 'plans', label: 'Plans', icon: <BarChart3 className="h-4 w-4" />, group: 'policy' },
  { type: 'tab', id: 'fup-policy', label: 'FUP Policy', icon: <Gauge className="h-4 w-4" />, group: 'policy' },
  { type: 'tab', id: 'ip-pools', label: 'IP Pools', icon: <Network className="h-4 w-4" />, group: 'policy' },
  { type: 'tab', id: 'bw-pools', label: 'BW Pools', icon: <Layers className="h-4 w-4" />, group: 'policy' },

  // ── Access ──
  { type: 'header', label: 'Access', indicatorColor: 'bg-amber-500' },
  { type: 'tab', id: 'vouchers', label: 'Vouchers', icon: <Ticket className="h-4 w-4" />, group: 'access' },
  { type: 'tab', id: 'mac-auth', label: 'MAC Auth', icon: <Fingerprint className="h-4 w-4" />, group: 'access' },
  { type: 'tab', id: 'event-wifi', label: 'Event WiFi', icon: <Users className="h-4 w-4" />, group: 'access' },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export function WifiAccessPage() {
  const [activeTab, setActiveTab] = useState<TabId>('live-sessions');
  const [refreshKey, setRefreshKey] = useState(0);
  const { propertyId, properties, setCurrentProperty } = usePropertyId();

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const handleSwitchToVouchers = useCallback(() => {
    setActiveTab('vouchers');
  }, []);

  const handlePropertyChange = useCallback((newPropertyId: string) => {
    const prop = properties.find(p => p.id === newPropertyId);
    if (prop) setCurrentProperty(prop);
  }, [properties, setCurrentProperty]);

  // Key changes when propertyId changes → forces all tabs to re-mount and re-fetch
  const propertyKey = propertyId || 'none';

  return (
    <div className="space-y-6 wifi-page-mesh">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 relative z-10">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wifi className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <span className="gradient-text">WiFi Access</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage active sessions, vouchers, bandwidth plans, and usage logs
          </p>
        </div>
        {/* Property Switcher */}
        {properties.length > 1 && (
          <div className="wifi-property-container">
            <div className="wifi-property-icon">
              <Building2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            </div>
            <span className="wifi-property-dot" />
            <Select value={propertyId} onValueChange={handlePropertyChange}>
              <SelectTrigger className="w-44 border-0 bg-transparent shadow-none focus:ring-0 p-0 h-auto text-sm">
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* RADIUS Server Status */}
      <div className="animate-fade-in-up relative z-10">
        <RADIUSStatusCard />
      </div>

      {/* Quick Actions */}
      <div className="relative z-10">
        <WiFiQuickActions onRefresh={handleRefresh} onSwitchToVouchers={handleSwitchToVouchers} />
      </div>

      {/* Tab Switcher */}
      <div className="relative z-10">
        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin items-center">
          {tabs.map((entry, index) => {
            if (entry.type === 'header') {
              return (
                <React.Fragment key={`header-${index}`}>
                  {index > 0 && (
                    <div className="w-px h-5 bg-border/60 mx-1.5 shrink-0" />
                  )}
                  <div className="flex items-center gap-1.5 px-2 py-1 shrink-0 select-none">
                    {entry.indicatorColor && (
                      <span className={cn('w-1.5 h-1.5 rounded-full', entry.indicatorColor)} />
                    )}
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {entry.label}
                    </span>
                  </div>
                  {index < tabs.length - 1 && (
                    <div className="w-px h-5 bg-border/60 mx-1.5 shrink-0" />
                  )}
                </React.Fragment>
              );
            }

            const tab = entry;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-300',
                  isActive
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-600/20 dark:shadow-teal-500/15'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <span className={cn('transition-transform duration-200', isActive && 'scale-110')}>
                  {tab.icon}
                </span>
                {tab.label}
                {isActive && <span className="wifi-tab-active-line" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-2 wifi-tab-content-enter relative z-10" key={`${activeTab}-${refreshKey}-${propertyKey}`}>
        <Suspense fallback={<TabSkeleton />}>
          <ErrorBoundary section="Active Users">
            {/* Live */}
            {activeTab === 'live-sessions' && <LiveSessions />}
          </ErrorBoundary>
          <ErrorBoundary section="RADIUS Users">
            {activeTab === 'users' && <RadiusUsersTab />}
          </ErrorBoundary>
          <ErrorBoundary section="Auth Logs">
            {activeTab === 'auth-logs' && <AuthLogsTab />}
          </ErrorBoundary>
          <ErrorBoundary section="Session History">
            {/* History */}
            {activeTab === 'session-history' && <SessionHistory />}
          </ErrorBoundary>
          <ErrorBoundary section="User Usage">
            {activeTab === 'user-usage' && <UserUsageDashboard />}
          </ErrorBoundary>
          <ErrorBoundary section="WiFi Plans">
            {/* Policy */}
            {activeTab === 'plans' && <WifiPlans />}
          </ErrorBoundary>
          <ErrorBoundary section="FUP Policy">
            {activeTab === 'fup-policy' && <WifiFupPolicy />}
          </ErrorBoundary>
          <ErrorBoundary section="IP Pools">
            {activeTab === 'ip-pools' && <IpPoolManagement />}
          </ErrorBoundary>
          <ErrorBoundary section="BW Pools">
            {activeTab === 'bw-pools' && <BandwidthPoolManagement />}
          </ErrorBoundary>
          <ErrorBoundary section="Vouchers">
            {/* Access */}
            {activeTab === 'vouchers' && <WifiVouchers />}
          </ErrorBoundary>
          <ErrorBoundary section="MAC Auth">
            {activeTab === 'mac-auth' && <MacAuthTab propertyId={propertyId} />}
          </ErrorBoundary>
          <ErrorBoundary section="Event WiFi">
            {activeTab === 'event-wifi' && <EventWifiTab />}
          </ErrorBoundary>
        </Suspense>
      </div>


    </div>
  );
}

export default WifiAccessPage;
