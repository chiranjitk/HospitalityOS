'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  RefreshCw,
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRightLeft,
  Database,
  Settings,
  History,
  Trash2,
  Eye,
  Merge,
  Server,
  HardDrive,
  Activity,
  Zap,
  Shield,
  BarChart3,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────

interface SyncQueueItem {
  id: string;
  orderId: string;
  time: string;
  items: number;
  amount: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  retryCount: number;
  maxRetries: number;
  dataSize: string;
  errorMessage?: string;
}

interface SyncConflict {
  id: string;
  orderId: string;
  field: string;
  localValue: string;
  serverValue: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  resolution?: 'keep_local' | 'keep_server' | 'merged';
}

interface SyncDashboardData {
  syncStatus: 'online' | 'offline' | 'syncing' | 'error';
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'none';
  dataCompleteness: number;
  lastSuccessfulSync: string;
  pendingUpload: number;
  pendingDownload: number;
  totalQueued: number;
  syncProgress: number;
  avgSyncTime: string;
  failedToday: number;
  syncedToday: number;
  dbSize: string;
  serverVersion: string;
  localVersion: string;
}

interface OfflineSettings {
  autoSyncInterval: number;
  offlineModeThreshold: number;
  maxQueueSize: number;
  dataRetentionDays: number;
  autoRetryEnabled: boolean;
  maxRetryAttempts: number;
  retryBackoffMultiplier: number;
  compressOfflineData: boolean;
  prefetchInventory: boolean;
  clearQueueOnSuccess: boolean;
}

// ── Mock Data ──────────────────────────────────────────────────────────

const MOCK_DASHBOARD: SyncDashboardData = {
  syncStatus: 'online',
  connectionQuality: 'good',
  dataCompleteness: 98.5,
  lastSuccessfulSync: new Date(Date.now() - 45000).toISOString(),
  pendingUpload: 3,
  pendingDownload: 0,
  totalQueued: 5,
  syncProgress: 100,
  avgSyncTime: '1.2s',
  failedToday: 2,
  syncedToday: 47,
  dbSize: '24.3 MB',
  serverVersion: '3.8.2',
  localVersion: '3.8.2',
};

const MOCK_QUEUE: SyncQueueItem[] = [
  { id: 'sq-001', orderId: 'ORD-20241', time: '09:32 AM', items: 3, amount: 2450, status: 'pending', retryCount: 0, maxRetries: 5, dataSize: '2.1 KB' },
  { id: 'sq-002', orderId: 'ORD-20240', time: '09:28 AM', items: 5, amount: 3890, status: 'pending', retryCount: 0, maxRetries: 5, dataSize: '3.4 KB' },
  { id: 'sq-003', orderId: 'ORD-20239', time: '09:15 AM', items: 2, amount: 1200, status: 'syncing', retryCount: 1, maxRetries: 5, dataSize: '1.8 KB' },
  { id: 'sq-004', orderId: 'ORD-20235', time: '08:47 AM', items: 4, amount: 3100, status: 'failed', retryCount: 3, maxRetries: 5, dataSize: '2.7 KB', errorMessage: 'Server timeout: order modified on server after local edit' },
  { id: 'sq-005', orderId: 'ORD-20230', time: '08:12 AM', items: 1, amount: 680, status: 'failed', retryCount: 5, maxRetries: 5, dataSize: '1.2 KB', errorMessage: 'Server returned 409 Conflict: payment already processed' },
  { id: 'sq-006', orderId: 'ORD-20228', time: '07:55 AM', items: 6, amount: 5200, status: 'synced', retryCount: 0, maxRetries: 5, dataSize: '4.1 KB' },
  { id: 'sq-007', orderId: 'ORD-20225', time: '07:30 AM', items: 2, amount: 1850, status: 'synced', retryCount: 1, maxRetries: 5, dataSize: '1.9 KB' },
  { id: 'sq-008', orderId: 'ORD-20222', time: '07:10 AM', items: 3, amount: 2990, status: 'synced', retryCount: 0, maxRetries: 5, dataSize: '2.5 KB' },
];

const MOCK_CONFLICTS: SyncConflict[] = [
  { id: 'cf-001', orderId: 'ORD-20235', field: 'order_total', localValue: '₹3,100.00', serverValue: '₹3,250.00', timestamp: new Date(Date.now() - 2700000).toISOString(), severity: 'high' },
  { id: 'cf-002', orderId: 'ORD-20235', field: 'payment_status', localValue: 'pending', serverValue: 'completed', timestamp: new Date(Date.now() - 2700000).toISOString(), severity: 'high' },
  { id: 'cf-003', orderId: 'ORD-20230', field: 'item_quantity (Coffee x2)', localValue: '2', serverValue: '3', timestamp: new Date(Date.now() - 5400000).toISOString(), severity: 'medium' },
  { id: 'cf-004', orderId: 'ORD-20218', field: 'discount_applied', localValue: '10%', serverValue: '15%', timestamp: new Date(Date.now() - 7200000).toISOString(), severity: 'low' },
  { id: 'cf-005', orderId: 'ORD-20210', field: 'order_notes', localValue: 'No sugar', serverValue: 'Less sugar', timestamp: new Date(Date.now() - 9000000).toISOString(), severity: 'low' },
  { id: 'cf-006', orderId: 'ORD-20205', field: 'table_number', localValue: 'T-12', serverValue: 'T-14', timestamp: new Date(Date.now() - 10800000).toISOString(), severity: 'medium' },
];

const DEFAULT_SETTINGS: OfflineSettings = {
  autoSyncInterval: 30,
  offlineModeThreshold: 5,
  maxQueueSize: 500,
  dataRetentionDays: 7,
  autoRetryEnabled: true,
  maxRetryAttempts: 5,
  retryBackoffMultiplier: 2,
  compressOfflineData: true,
  prefetchInventory: true,
  clearQueueOnSuccess: true,
};

// ── Constants ──────────────────────────────────────────────────────────

const SYNC_STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgClass: string }> = {
  online: {
    label: 'Online',
    icon: <Wifi className="h-5 w-5" />,
    color: 'text-emerald-500',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',
  },
  offline: {
    label: 'Offline',
    icon: <WifiOff className="h-5 w-5" />,
    color: 'text-red-500',
    bgClass: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
  },
  syncing: {
    label: 'Syncing...',
    icon: <RefreshCw className="h-5 w-5 animate-spin" />,
    color: 'text-amber-500',
    bgClass: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
  },
  error: {
    label: 'Sync Error',
    icon: <AlertTriangle className="h-5 w-5" />,
    color: 'text-red-500',
    bgClass: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
  },
};

const CONNECTION_QUALITY: Record<string, { label: string; bars: number; color: string; dotClass: string }> = {
  excellent: { label: 'Excellent', bars: 4, color: 'bg-emerald-500', dotClass: 'bg-emerald-500' },
  good: { label: 'Good', bars: 3, color: 'bg-emerald-500', dotClass: 'bg-emerald-500' },
  fair: { label: 'Fair', bars: 2, color: 'bg-amber-500', dotClass: 'bg-amber-500' },
  poor: { label: 'Poor', bars: 1, color: 'bg-orange-500', dotClass: 'bg-orange-500' },
  none: { label: 'No Connection', bars: 0, color: 'bg-red-500', dotClass: 'bg-red-500' },
};

const QUEUE_STATUS: Record<string, { label: string; color: string; badgeClass: string }> = {
  pending: { label: 'Pending', color: 'bg-amber-500', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  syncing: { label: 'Syncing', color: 'bg-sky-500', badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  synced: { label: 'Synced', color: 'bg-emerald-500', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  failed: { label: 'Failed', color: 'bg-red-500', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; badgeClass: string }> = {
  low: { label: 'Low', color: 'bg-sky-500', badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  medium: { label: 'Medium', color: 'bg-amber-500', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  high: { label: 'High', color: 'bg-red-500', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const CONFLICT_STATUS_COLORS: Record<string, string> = {
  keep_local: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  keep_server: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  merged: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

// ── Component ──────────────────────────────────────────────────────────

export default function OfflinePOSMode() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueFilter, setQueueFilter] = useState('all');
  const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [settings, setSettings] = useState<OfflineSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const dashboard = MOCK_DASHBOARD;
  const syncConfig = SYNC_STATUS_CONFIG[dashboard.syncStatus];
  const connQuality = CONNECTION_QUALITY[dashboard.connectionQuality];

  // ── Computed ─────────────────────────────────────────────────────

  const filteredQueue = useMemo(() => {
    return MOCK_QUEUE.filter(item => {
      if (queueFilter !== 'all' && item.status !== queueFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return item.orderId.toLowerCase().includes(q);
      }
      return true;
    });
  }, [searchQuery, queueFilter]);

  const unresolvedConflicts = useMemo(() => MOCK_CONFLICTS.filter(c => !c.resolution), []);
  const resolvedConflicts = useMemo(() => MOCK_CONFLICTS.filter(c => c.resolution), []);

  // ── Handlers ─────────────────────────────────────────────────────

  const handleForceSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      toast({ title: 'Sync Complete', description: 'All pending orders synced successfully' });
    }, 2000);
  };

  const handleResolveConflict = (conflictId: string, resolution: 'keep_local' | 'keep_server' | 'merged') => {
    toast({
      title: 'Conflict Resolved',
      description: `Resolution applied: ${resolution.replace('_', ' ')} for ${selectedConflict?.orderId}`,
    });
    setIsResolveOpen(false);
    setSelectedConflict(null);
  };

  const handleClearQueue = () => {
    toast({ title: 'Queue Cleared', description: 'Synced and failed items removed from queue' });
  };

  const handleRetryFailed = () => {
    toast({ title: 'Retrying Failed', description: 'Re-queuing all failed orders for sync' });
  };

  const handleSaveSettings = () => {
    setIsSettingsOpen(false);
    toast({ title: 'Settings Saved', description: 'Offline mode settings updated successfully' });
  };

  // ── Helper: format currency without useCurrency (POS specific) ───

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);
  };

  // ── Render: Stat cards ───────────────────────────────────────────

  const renderStatCards = () => (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2.5 rounded-lg shadow-lg',
            dashboard.syncStatus === 'online'
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20'
              : 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20',
          )}>
            {syncConfig?.icon}
          </div>
          <div>
            <div className={cn('text-lg font-bold', syncConfig?.color)}>
              {syncConfig?.label}
            </div>
            <div className="text-xs text-muted-foreground">Sync Status</div>
          </div>
        </div>
      </Card>
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-400 bg-clip-text text-transparent">
              {dashboard.totalQueued}
            </div>
            <div className="text-xs text-muted-foreground">Pending Orders</div>
          </div>
        </div>
      </Card>
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20">
            <Database className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-blue-400 bg-clip-text text-transparent">
              {dashboard.dbSize}
            </div>
            <div className="text-xs text-muted-foreground">Queue Size</div>
          </div>
        </div>
      </Card>
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold bg-gradient-to-r from-violet-600 to-purple-400 bg-clip-text text-transparent">
              {formatDistanceToNow(new Date(dashboard.lastSuccessfulSync), { addSuffix: false })}
            </div>
            <div className="text-xs text-muted-foreground">Last Sync</div>
          </div>
        </div>
      </Card>
    </div>
  );

  // ── Render: Sync Dashboard tab ──────────────────────────────────

  const renderSyncDashboard = () => (
    <div className="space-y-6">
      {/* Status indicator */}
      <Card className={cn('border-2', syncConfig?.bgClass)}>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={cn('p-4 rounded-full', dashboard.syncStatus === 'online' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30')}>
                {syncConfig?.icon}
              </div>
              <div>
                <h3 className={cn('text-xl font-bold', syncConfig?.color)}>{syncConfig?.label}</h3>
                <p className="text-sm text-muted-foreground">
                  {dashboard.syncStatus === 'online' ? 'All systems operational' : 'Operating in offline mode'}
                </p>
              </div>
            </div>
            <Button
              onClick={handleForceSync}
              disabled={isSyncing}
              className={cn(
                'min-w-[140px]',
                isSyncing && 'animate-pulse',
              )}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isSyncing ? 'Syncing...' : 'Force Sync'}
            </Button>
          </div>

          {dashboard.syncStatus === 'online' && (
            <Progress value={dashboard.syncProgress} className="mt-4 h-2" />
          )}
        </CardContent>
      </Card>

      {/* Metrics grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        {/* Connection Quality */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Connection Quality</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Signal bars */}
            <div className="flex items-end gap-0.5 h-6">
              {[1, 2, 3, 4].map(bar => (
                <div
                  key={bar}
                  className={cn(
                    'w-1.5 rounded-t transition-colors',
                    bar <= (connQuality?.bars || 0)
                      ? connQuality?.color
                      : 'bg-gray-200 dark:bg-gray-700',
                  )}
                  style={{ height: `${bar * 25}%` }}
                />
              ))}
            </div>
            <div>
              <p className="font-bold text-sm">{connQuality?.label}</p>
              <p className="text-[10px] text-muted-foreground">Latency: ~45ms</p>
            </div>
          </div>
        </Card>

        {/* Data Completeness */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Data Completeness</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{dashboard.dataCompleteness}%</p>
              <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {dashboard.pendingUpload} pending
              </Badge>
            </div>
            <Progress value={dashboard.dataCompleteness} className="h-1.5" />
          </div>
        </Card>

        {/* Today's Stats */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Today&apos;s Activity</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Synced</span>
              <span className="font-semibold text-sm text-emerald-600">{dashboard.syncedToday}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Failed</span>
              <span className="font-semibold text-sm text-red-600">{dashboard.failedToday}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Avg Sync Time</span>
              <span className="font-semibold text-sm">{dashboard.avgSyncTime}</span>
            </div>
          </div>
        </Card>

        {/* Version info */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Version Info</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Server</span>
              <span className="font-mono text-xs">{dashboard.serverVersion}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Local</span>
              <span className="font-mono text-xs">{dashboard.localVersion}</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] text-emerald-600">Versions match</span>
            </div>
          </div>
        </Card>

        {/* Upload/Download */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cloud className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Transfer Queue</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowRightLeft className="h-3 w-3 rotate-90" />
                Upload
              </span>
              <span className="font-semibold text-sm">{dashboard.pendingUpload} orders</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowRightLeft className="h-3 w-3 -rotate-90" />
                Download
              </span>
              <span className="font-semibold text-sm">{dashboard.pendingDownload} orders</span>
            </div>
          </div>
        </Card>

        {/* Uptime */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Reliability</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Uptime (24h)</span>
              <span className="font-semibold text-sm text-emerald-600">99.4%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Offline Events</span>
              <span className="font-semibold text-sm">2</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Avg Recovery</span>
              <span className="font-semibold text-sm">12s</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  // ── Render: Offline Queue tab ────────────────────────────────────

  const renderOfflineQueue = () => (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={queueFilter} onValueChange={setQueueFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="syncing">Syncing</SelectItem>
              <SelectItem value="synced">Synced</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRetryFailed}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry Failed
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearQueue} className="text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Clear Queue
          </Button>
        </div>
      </div>

      {/* Queue table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[480px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="hidden sm:table-cell">Items</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden md:table-cell">Size</TableHead>
                  <TableHead className="hidden md:table-cell">Retries</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQueue.map(item => {
                  const statusCfg = QUEUE_STATUS[item.status];
                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        'transition-colors',
                        item.status === 'failed' && 'bg-red-50/30 dark:bg-red-950/10',
                        item.status === 'syncing' && 'bg-sky-50/30 dark:bg-sky-950/10',
                      )}
                    >
                      <TableCell>
                        <span className="font-mono text-sm font-medium">{item.orderId}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {item.time}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm">{item.items} items</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-sm">{formatAmount(item.amount)}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">{item.dataSize}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            'text-xs font-medium',
                            item.retryCount >= item.maxRetries ? 'text-red-500' : item.retryCount > 0 ? 'text-amber-500' : 'text-muted-foreground',
                          )}>
                            {item.retryCount}/{item.maxRetries}
                          </span>
                          <Progress
                            value={(item.retryCount / item.maxRetries) * 100}
                            className={cn(
                              'w-12 h-1',
                              item.retryCount >= item.maxRetries && '[&>div]:bg-red-500',
                            )}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn('text-xs gap-1', statusCfg?.badgeClass)}>
                          {item.status === 'syncing' && <RefreshCw className="h-2.5 w-2.5 animate-spin" />}
                          {item.status === 'synced' && <CheckCircle2 className="h-2.5 w-2.5" />}
                          {item.status === 'failed' && <XCircle className="h-2.5 w-2.5" />}
                          {item.status === 'pending' && <Clock className="h-2.5 w-2.5" />}
                          {statusCfg?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {(item.status === 'pending' || item.status === 'failed') && item.retryCount < item.maxRetries && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Error details for failed items */}
      {MOCK_QUEUE.filter(i => i.status === 'failed').length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              Failed Item Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_QUEUE.filter(i => i.status === 'failed').map(item => (
              <div key={item.id} className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm font-medium">{item.orderId}</span>
                  <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    {item.retryCount}/{item.maxRetries} retries
                  </Badge>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400">{item.errorMessage}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ── Render: Conflict Resolution tab ──────────────────────────────

  const renderConflictResolution = () => (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <div className="text-xl font-bold text-red-600">{unresolvedConflicts.length}</div>
              <div className="text-[10px] text-muted-foreground">Unresolved</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-600">{resolvedConflicts.length}</div>
              <div className="text-[10px] text-muted-foreground">Resolved Today</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-xl font-bold">{MOCK_CONFLICTS.filter(c => c.severity === 'high').length}</div>
              <div className="text-[10px] text-muted-foreground">High Priority</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Conflicts table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[460px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead className="hidden sm:table-cell">Local Value</TableHead>
                  <TableHead className="hidden sm:table-cell">Server Value</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_CONFLICTS.map(conflict => {
                  const sevCfg = SEVERITY_CONFIG[conflict.severity];
                  return (
                    <TableRow
                      key={conflict.id}
                      className={cn(
                        !conflict.resolution && conflict.severity === 'high' && 'bg-red-50/30 dark:bg-red-950/10',
                        conflict.resolution && 'opacity-60',
                      )}
                    >
                      <TableCell>
                        <span className="font-mono text-sm font-medium">{conflict.orderId}</span>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(conflict.timestamp), { addSuffix: true })}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">{conflict.field}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <HardDrive className="h-3 w-3 text-violet-500" />
                          <span className="text-sm font-medium">{conflict.localValue}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Server className="h-3 w-3 text-sky-500" />
                          <span className="text-sm font-medium">{conflict.serverValue}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn('text-xs gap-1', sevCfg?.badgeClass)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', sevCfg?.color)} />
                          {sevCfg?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {conflict.resolution ? (
                          <Badge variant="secondary" className={cn('text-xs', CONFLICT_STATUS_COLORS[conflict.resolution])}>
                            {conflict.resolution.replace('_', ' ')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                            Unresolved
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!conflict.resolution ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => { setSelectedConflict(conflict); setIsResolveOpen(true); }}
                          >
                            <ArrowRightLeft className="h-3 w-3 mr-1" />
                            Resolve
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Resolve dialog */}
      <Dialog open={isResolveOpen} onOpenChange={setIsResolveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-amber-500" />
              Resolve Conflict
            </DialogTitle>
            <DialogDescription>
              {selectedConflict?.orderId} — {selectedConflict?.field}
            </DialogDescription>
          </DialogHeader>
          {selectedConflict && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border-2 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-violet-600">
                    <HardDrive className="h-3 w-3" />
                    Local
                  </div>
                  <p className="font-bold text-lg">{selectedConflict.localValue}</p>
                </div>
                <div className="p-3 rounded-lg border-2 border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/10 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-sky-600">
                    <Server className="h-3 w-3" />
                    Server
                  </div>
                  <p className="font-bold text-lg">{selectedConflict.serverValue}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Conflict severity</p>
                <Badge variant="secondary" className={cn('text-xs gap-1', SEVERITY_CONFIG[selectedConflict.severity]?.badgeClass)}>
                  {SEVERITY_CONFIG[selectedConflict.severity]?.label}
                </Badge>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1 border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300" onClick={() => handleResolveConflict(selectedConflict?.id || '', 'keep_local')}>
              <HardDrive className="h-3.5 w-3.5 mr-1.5" />
              Keep Local
            </Button>
            <Button variant="outline" className="flex-1 border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300" onClick={() => handleResolveConflict(selectedConflict?.id || '', 'keep_server')}>
              <Server className="h-3.5 w-3.5 mr-1.5" />
              Keep Server
            </Button>
            <Button className="flex-1" onClick={() => handleResolveConflict(selectedConflict?.id || '', 'merged')}>
              <Merge className="h-3.5 w-3.5 mr-1.5" />
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // ── Render: Settings tab ─────────────────────────────────────────

  const renderSettings = () => (
    <div className="space-y-6 max-w-2xl">
      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Sync Configuration
          </CardTitle>
          <CardDescription>Configure how data is synchronized between local and server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Auto-Sync Interval</Label>
              <span className="text-sm font-medium">{settings.autoSyncInterval}s</span>
            </div>
            <Slider
              value={[settings.autoSyncInterval]}
              onValueChange={([v]) => setSettings(s => ({ ...s, autoSyncInterval: v }))}
              min={5}
              max={120}
              step={5}
            />
            <p className="text-[10px] text-muted-foreground">How often to check for pending syncs (5-120 seconds)</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Offline Mode Threshold</Label>
              <span className="text-sm font-medium">{settings.offlineModeThreshold}s</span>
            </div>
            <Slider
              value={[settings.offlineModeThreshold]}
              onValueChange={([v]) => setSettings(s => ({ ...s, offlineModeThreshold: v }))}
              min={1}
              max={30}
              step={1}
            />
            <p className="text-[10px] text-muted-foreground">Switch to offline mode after N seconds of failed connectivity</p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Retry Failed Syncs</Label>
              <p className="text-[10px] text-muted-foreground">Automatically retry failed sync attempts</p>
            </div>
            <Switch
              checked={settings.autoRetryEnabled}
              onCheckedChange={(v) => setSettings(s => ({ ...s, autoRetryEnabled: v }))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Max Retry Attempts</Label>
              <span className="text-sm font-medium">{settings.maxRetryAttempts}</span>
            </div>
            <Slider
              value={[settings.maxRetryAttempts]}
              onValueChange={([v]) => setSettings(s => ({ ...s, maxRetryAttempts: v }))}
              min={1}
              max={10}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Retry Backoff Multiplier</Label>
              <span className="text-sm font-medium">{settings.retryBackoffMultiplier}x</span>
            </div>
            <Slider
              value={[settings.retryBackoffMultiplier]}
              onValueChange={([v]) => setSettings(s => ({ ...s, retryBackoffMultiplier: v }))}
              min={1}
              max={5}
              step={0.5}
            />
            <p className="text-[10px] text-muted-foreground">Exponential backoff: delay = base * multiplier^(retry)</p>
          </div>
        </CardContent>
      </Card>

      {/* Data Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Management
          </CardTitle>
          <CardDescription>Manage offline data storage and retention</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Max Queue Size</Label>
              <span className="text-sm font-medium">{settings.maxQueueSize} orders</span>
            </div>
            <Slider
              value={[settings.maxQueueSize]}
              onValueChange={([v]) => setSettings(s => ({ ...s, maxQueueSize: v }))}
              min={50}
              max={2000}
              step={50}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Data Retention</Label>
              <span className="text-sm font-medium">{settings.dataRetentionDays} days</span>
            </div>
            <Slider
              value={[settings.dataRetentionDays]}
              onValueChange={([v]) => setSettings(s => ({ ...s, dataRetentionDays: v }))}
              min={1}
              max={30}
              step={1}
            />
            <p className="text-[10px] text-muted-foreground">Auto-delete synced items after N days</p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Compress Offline Data</Label>
              <p className="text-[10px] text-muted-foreground">Reduce storage size by compressing queued data</p>
            </div>
            <Switch
              checked={settings.compressOfflineData}
              onCheckedChange={(v) => setSettings(s => ({ ...s, compressOfflineData: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Prefetch Inventory</Label>
              <p className="text-[10px] text-muted-foreground">Cache menu items and inventory for offline use</p>
            </div>
            <Switch
              checked={settings.prefetchInventory}
              onCheckedChange={(v) => setSettings(s => ({ ...s, prefetchInventory: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Clear on Success</Label>
              <p className="text-[10px] text-muted-foreground">Remove items from queue immediately after successful sync</p>
            </div>
            <Switch
              checked={settings.clearQueueOnSuccess}
              onCheckedChange={(v) => setSettings(s => ({ ...s, clearQueueOnSuccess: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSaveSettings}>
          <Settings className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
        <Button variant="outline" onClick={() => setSettings(DEFAULT_SETTINGS)}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );

  // ── Main render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CloudOff className="h-5 w-5 text-amber-500" />
            Offline POS Mode
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage offline operations, sync queue, and conflict resolution
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleForceSync} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync Now
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsSettingsOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Stats */}
      {renderStatCards()}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearchQuery(''); setQueueFilter('all'); }}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="text-xs sm:text-sm">
            <Activity className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="queue" className="text-xs sm:text-sm">
            <History className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Queue
          </TabsTrigger>
          <TabsTrigger value="conflicts" className="text-xs sm:text-sm relative">
            <AlertTriangle className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Conflicts
            {unresolvedConflicts.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                {unresolvedConflicts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-sm">
            <Settings className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Settings
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="dashboard">
            {renderSyncDashboard()}
          </TabsContent>
          <TabsContent value="queue">
            {renderOfflineQueue()}
          </TabsContent>
          <TabsContent value="conflicts">
            {renderConflictResolution()}
          </TabsContent>
          <TabsContent value="settings">
            {renderSettings()}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
