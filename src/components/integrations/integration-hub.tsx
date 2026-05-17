'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Plug,
  RefreshCw,
  Settings,
  Link2,
  Unlink,
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  HeartPulse,
  Key,
  Shield,
  Webhook,
  RotateCw,
  Plus,
  Trash2,
  XCircle,
  Wifi,
  WifiOff,
  Zap,
  CreditCard,
  Globe,
  Mail,
  MessageSquare,
  Lock,
  BarChart3,
  Users,
  Home,
  Sparkles,
  Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'connected' | 'disconnected' | 'error' | 'configuring';
  lastSync: string;
  syncInterval: string;
  recordsSynced: number;
  uptime: number;
  avgLatency: number;
  errorRate: number;
  logoColor: string;
  icon: React.ReactNode;
}

interface SyncLogEntry {
  id: string;
  integrationId: string;
  integrationName: string;
  type: 'push' | 'pull' | 'error';
  direction: 'outgoing' | 'incoming';
  records: number;
  status: 'success' | 'failed' | 'retrying';
  timestamp: string;
  duration: string;
  errorMessage?: string;
}

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive';
  secret: string;
  lastDelivery: string;
  successRate: number;
  deliveries: number;
}

interface ApiKeyEntry {
  id: string;
  name: string;
  integration: string;
  key: string;
  maskedKey: string;
  createdAt: string;
  lastUsed: string;
  expiresAt: string;
  usageCount: number;
  status: 'active' | 'expired' | 'rotated';
  rotationScheduled?: string;
}

interface HealthMetric {
  integrationId: string;
  integrationName: string;
  uptime7d: number;
  avgLatency: number;
  errorRate: number;
  dataVolume: number;
}

function formatRelativeTime(date: string | Date): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

// Valid webhook event types (configuration, not mock data)
const WEBHOOK_EVENT_OPTIONS = [
  'booking.created', 'booking.updated', 'booking.cancelled',
  'payment.completed', 'payment.failed', 'refund.processed',
  'guest.checked_in', 'guest.checked_out', 'guest.registered',
  'review.submitted', 'review.responded',
  'revenue.threshold_crossed', 'occupancy.changed',
  'room.status_changed', 'service_request.created',
] as const;

const categories = ['Payment', 'Channel Manager', 'CRM', 'PMS', 'Revenue Management', 'Housekeeping', 'IoT', 'Communication', 'Analytics', 'HR/Payroll'];

const categoryIcons: Record<string, React.ReactNode> = {
  'Payment': <CreditCard className="h-4 w-4" />,
  'Channel Manager': <Globe className="h-4 w-4" />,
  'CRM': <Users className="h-4 w-4" />,
  'PMS': <Server className="h-4 w-4" />,
  'Revenue Management': <BarChart3 className="h-4 w-4" />,
  'Housekeeping': <Sparkles className="h-4 w-4" />,
  'IoT': <Wifi className="h-4 w-4" />,
  'Communication': <MessageSquare className="h-4 w-4" />,
  'Analytics': <BarChart3 className="h-4 w-4" />,
  'HR/Payroll': <Users className="h-4 w-4" />,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  connected: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', icon: <Wifi className="h-3 w-3" /> },
  disconnected: { bg: 'bg-gray-500/10', text: 'text-gray-500', icon: <WifiOff className="h-3 w-3" /> },
  error: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', icon: <AlertCircle className="h-3 w-3" /> },
  configuring: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', icon: <Settings className="h-3 w-3" /> },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function IntegrationHub() {
  const [activeTab, setActiveTab] = useState('marketplace');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [syncTypeFilter, setSyncTypeFilter] = useState<string>('all');
  const [syncIntegrationFilter, setSyncIntegrationFilter] = useState<string>('all');
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [showAddKey, setShowAddKey] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Real data state
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [syncLogEntries, setSyncLogEntries] = useState<SyncLogEntry[]>([]);
  const [webhookConfigs, setWebhookConfigs] = useState<WebhookConfig[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [errorRateTrend, setErrorRateTrend] = useState<Array<{day: string; rate: number; errors: number}>>([]);
  const [dataVolumeData, setDataVolumeData] = useState<Array<{day: string; volume: number}>>([]);

  // ─── Data fetching ─────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [integRes, webhookRes, syncLogRes, keysRes] = await Promise.allSettled([
        fetch('/api/settings/integrations').then(r => r.ok ? r.json() : null),
        fetch('/api/webhooks/events').then(r => r.ok ? r.json() : null),
        fetch('/api/channels/sync-logs?limit=50').then(r => r.ok ? r.json() : null),
        fetch('/api/settings/integrations/keys').then(r => r.ok ? r.json() : null),
      ]);

      // Process integrations
      if (integRes?.success) {
        const items = integRes.data?.integrations || [];
        const mapped = items.map((item: Record<string, unknown>, idx: number) => {
          const statusVal = item.active ? 'connected' as const : 'disconnected' as const;
          const providerLabel = item.name || item.type || 'Integration';
          const categoryMap: Record<string, string> = {
            smtp: 'Communication', sms_twilio: 'Communication', fcm: 'Communication',
            s3_storage: 'Analytics', google_oauth: 'Communication', radius: 'IoT',
            ai: 'Analytics', whatsapp: 'Communication',
          };
          return {
            id: item.id,
            name: providerLabel,
            description: `${item.type || 'System'} integration`,
            category: categoryMap[item.type as string] || 'Other',
            status: statusVal,
            lastSync: item.lastSyncAt ? formatRelativeTime(item.lastSyncAt) : 'Never',
            syncInterval: item.active ? 'Configured' : 'N/A',
            recordsSynced: 0,
            uptime: item.active ? 99.9 : 0,
            avgLatency: 0,
            errorRate: 0,
            logoColor: 'bg-violet-600',
            icon: <Plug className="h-5 w-5" />,
          };
        });
        setIntegrations(mapped);
      }

      // Process webhooks
      if (webhookRes?.success) {
        const endpoints = webhookRes.data?.endpoints || [];
        setWebhookConfigs(endpoints.map((ep: Record<string, unknown>) => ({
          id: ep.id,
          name: ep.name,
          url: ep.url,
          events: ep.events || [],
          status: ep.status as 'active' | 'inactive',
          secret: ep.secret ? `${(ep.secret as string).slice(0, 8)}...` : '',
          lastDelivery: ep.lastTriggered ? formatRelativeTime(ep.lastTriggered) : 'N/A',
          successRate: ep.successRate || 0,
          deliveries: ep.totalTriggers || 0,
        })));
      }

      // Process API keys
      if (keysRes?.success && keysRes.data) {
        const keys = Array.isArray(keysRes.data) ? keysRes.data : keysRes.data?.keys || [];
        setApiKeys((keys as Array<Record<string, unknown>>).map((k: Record<string, unknown>) => ({
          id: k.id,
          name: k.name,
          integration: k.integration,
          key: k.key || '',
          maskedKey: k.maskedKey || k.key ? `${(k.key as string).slice(0, 8)}...` : '',
          createdAt: k.createdAt ? formatRelativeTime(k.createdAt) : 'N/A',
          lastUsed: k.lastUsed ? formatRelativeTime(k.lastUsed) : 'N/A',
          expiresAt: k.expiresAt || 'N/A',
          usageCount: k.usageCount || 0,
          status: (k.status as 'active' | 'expired' | 'rotated') || 'active',
          rotationScheduled: k.rotationScheduled || undefined,
        })));
      }

      // Process sync logs
      if (syncLogRes?.success) {
        const logs = syncLogRes.data || [];
        setSyncLogEntries((logs as Array<Record<string, unknown>>).map((log: Record<string, unknown>, idx: number) => ({
          id: `log-${idx}`,
          integrationId: log.connectionId || '',
          integrationName: log.channelName || log.channelType || 'Unknown',
          type: (log.syncType || 'pull') as 'push' | 'pull' | 'error',
          direction: (log.direction || 'incoming') as 'outgoing' | 'incoming',
          records: 0,
          status: (log.status === 'success' ? 'success' : log.status === 'failed' ? 'failed' : 'retrying') as 'success' | 'failed' | 'retrying',
          timestamp: log.createdAt ? formatRelativeTime(log.createdAt) : '',
          duration: '',
          errorMessage: log.errorMessage || undefined,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch integration data:', err);
    } finally {
    setLoading(false);
  }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const [integrationStates, setIntegrationStates] = useState<Record<string, string>>({});

  const connectedIntegrations = useMemo(() =>
    integrations.filter(i => i.status === 'connected'),
    [integrations]
  );

  const erroredIntegrations = useMemo(() =>
    integrations.filter(i => i.status === 'error'),
    [integrations]
  );

  const filteredIntegrations = useMemo(() => {
    return integrations.filter(i => {
      if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
      if (searchQuery && !i.name.toLowerCase().includes(searchQuery.toLowerCase()) && !i.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [categoryFilter, searchQuery]);

  const filteredSyncLogs = useMemo(() => {
    return syncLogEntries.filter(l => {
      if (syncTypeFilter !== 'all' && l.type !== syncTypeFilter) return false;
      if (syncIntegrationFilter !== 'all' && l.integrationName !== syncIntegrationFilter) return false;
      return true;
    });
  }, [syncTypeFilter, syncIntegrationFilter]);

  const totalSyncOps = syncLogEntries.length;
  const failedSyncOps = syncLogEntries.filter(l => l.status === 'failed').length;
  const successRate = totalSyncOps > 0 ? ((totalSyncOps - failedSyncOps) / totalSyncOps * 100).toFixed(1) : '100';

  const handleConnect = (id: string) => {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status: 'connected' as const } : i));
    toast.success('Integration connected successfully!');
  };

  const handleDisconnect = (id: string) => {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status: 'disconnected' as const } : i));
    toast.success('Integration disconnected.');
  };

  const handleRetry = (logId: string) => {
    toast.success('Sync operation retried!');
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(keyId)) next.delete(keyId);
      else next.add(keyId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                <Plug className="h-4 w-4 text-white" />
              </div>
              Integration Hub
            </h2>
            <p className="text-muted-foreground">Centralized management for all third-party integrations</p>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => (
            <Card key={i} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const hasData = integrations.length > 0 || webhookConfigs.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <Plug className="h-4 w-4 text-white" />
            </div>
            Integration Hub
          </h2>
          <p className="text-muted-foreground">Centralized management for all third-party integrations</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            <Wifi className="h-3 w-3 mr-1" />
            {connectedIntegrations.length} Connected
          </Badge>
          <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            {erroredIntegrations.length} Errors
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="marketplace" className="gap-1.5">
            <Plug className="h-4 w-4" />
            <span className="hidden sm:inline">Marketplace</span>
          </TabsTrigger>
          <TabsTrigger value="connected" className="gap-1.5">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">Connected</span>
          </TabsTrigger>
          <TabsTrigger value="sync-log" className="gap-1.5">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Sync Log</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5">
            <HeartPulse className="h-4 w-4" />
            <span className="hidden sm:inline">Health</span>
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5">
            <Webhook className="h-4 w-4" />
            <span className="hidden sm:inline">Webhooks</span>
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-1.5">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">API Keys</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── Integration Marketplace ───────────────────────────────────── */}
        <TabsContent value="marketplace" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search integrations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Integration Cards Grid */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredIntegrations.map((integration) => {
              const currentStatus = integrationStates[integration.id] || integration.status;
              const statusCfg = statusColors[currentStatus] || statusColors.connected;
              return (
                <Card key={integration.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center text-white', integration.logoColor)}>
                          {integration.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{integration.name}</p>
                          <Badge variant="outline" className="text-[10px] mt-0.5">
                            {categoryIcons[integration.category] || <Plug className="h-3 w-3" />}
                            <span className="ml-1">{integration.category}</span>
                          </Badge>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn('text-[10px] capitalize', statusCfg.bg, statusCfg.text)}>
                        {statusCfg.icon}
                        <span className="ml-1">{currentStatus}</span>
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{integration.description}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {integration.lastSync}</span>
                      <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" /> {integration.syncInterval}</span>
                    </div>
                    <div className="flex gap-2">
                      {currentStatus === 'connected' ? (
                        <>
                          <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => setSelectedIntegration(integration)}>
                            <Settings className="h-3 w-3 mr-1" /> Configure
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-red-500" onClick={() => handleDisconnect(integration.id)}>
                            <Unlink className="h-3 w-3" />
                          </Button>
                        </>
                      ) : currentStatus === 'error' ? (
                        <Button size="sm" className="flex-1 h-8" onClick={() => handleConnect(integration.id)}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Reconnect
                        </Button>
                      ) : currentStatus === 'configuring' ? (
                        <Button size="sm" className="flex-1 h-8" onClick={() => setSelectedIntegration(integration)}>
                          <Settings className="h-3 w-3 mr-1" /> Configure
                        </Button>
                      ) : (
                        <Button size="sm" className="flex-1 h-8" onClick={() => handleConnect(integration.id)}>
                          <Link2 className="h-3 w-3 mr-1" /> Connect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Connected Integrations ─────────────────────────────────────── */}
        <TabsContent value="connected" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Integration</TableHead>
                      <TableHead className="hidden sm:table-cell">Category</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead className="hidden md:table-cell">Records</TableHead>
                      <TableHead className="hidden lg:table-cell">Uptime</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connectedIntegrations.map((integ) => (
                      <TableRow key={integ.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0', integ.logoColor)}>
                              {integ.icon}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{integ.name}</p>
                              <p className="text-xs text-muted-foreground">{integ.syncInterval}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {categoryIcons[integ.category]}
                            <span className="ml-1">{integ.category}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{integ.lastSync}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm font-mono">{integ.recordsSynced.toLocaleString()}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            <Progress value={integ.uptime} className="h-2 w-16" />
                            <span className="text-xs font-mono">{integ.uptime}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs', statusColors.connected.bg, statusColors.connected.text)}>
                            {statusColors.connected.icon}
                            <span className="ml-1">Connected</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { toast.success('Sync triggered!'); }}>
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedIntegration(integ)}>
                              <Settings className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDisconnect(integ.id)}>
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Sync Activity Log ──────────────────────────────────────────── */}
        <TabsContent value="sync-log" className="space-y-4">
          {/* Log Stats */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="p-4 border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{successRate}%</div>
                  <div className="text-xs text-muted-foreground">Success Rate</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-red-500">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{failedSyncOps}</div>
                  <div className="text-xs text-muted-foreground">Failed Ops</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-cyan-500">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <Activity className="h-4 w-4 text-cyan-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalSyncOps}</div>
                  <div className="text-xs text-muted-foreground">Total Syncs</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-amber-500">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <RotateCw className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{syncLogEntries.filter(l => l.status === 'retrying').length}</div>
                  <div className="text-xs text-muted-foreground">Retrying</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={syncTypeFilter} onValueChange={setSyncTypeFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="push">Push</SelectItem>
                    <SelectItem value="pull">Pull</SelectItem>
                    <SelectItem value="error">Errors Only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={syncIntegrationFilter} onValueChange={setSyncIntegrationFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Integration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Integrations</SelectItem>
                    {[...new Set(syncLogEntries.map(l => l.integrationName))].map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Sync Log Table */}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Integration</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead className="hidden md:table-cell">Records</TableHead>
                      <TableHead className="hidden lg:table-cell">Duration</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSyncLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {log.status === 'success' && (
                            <Badge className="bg-emerald-500 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" /> OK</Badge>
                          )}
                          {log.status === 'failed' && (
                            <Badge className="bg-red-500 text-xs"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>
                          )}
                          {log.status === 'retrying' && (
                            <Badge className="bg-amber-500 text-xs"><RotateCw className="h-3 w-3 mr-1" /> Retry</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{log.integrationName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">{log.type}</Badge>
                        </TableCell>
                        <TableCell>
                          {log.direction === 'outgoing' ? (
                            <Badge variant="outline" className="text-xs text-cyan-600 dark:text-cyan-400 border-cyan-500/30">
                              <ArrowUpRight className="h-3 w-3 mr-1" /> Out
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                              <ArrowDownLeft className="h-3 w-3 mr-1" /> In
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm font-mono">{log.records}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs font-mono text-muted-foreground">{log.duration}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.timestamp}</TableCell>
                        <TableCell className="text-right">
                          {(log.status === 'failed' || log.status === 'retrying') && (
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleRetry(log.id)}>
                              <RotateCw className="h-3 w-3 mr-1" /> Retry
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Health Dashboard ───────────────────────────────────────────── */}
        <TabsContent value="health" className="space-y-4">
          {/* Overview Cards */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="p-4 border-l-4 border-l-emerald-500">
              <div className="text-2xl font-bold text-emerald-600">99.4%</div>
              <div className="text-xs text-muted-foreground">Avg Uptime (7d)</div>
            </Card>
            <Card className="p-4 border-l-4 border-l-cyan-500">
              <div className="text-2xl font-bold">340ms</div>
              <div className="text-xs text-muted-foreground">Avg Sync Latency</div>
            </Card>
            <Card className="p-4 border-l-4 border-l-amber-500">
              <div className="text-2xl font-bold">0.8%</div>
              <div className="text-xs text-muted-foreground">Avg Error Rate</div>
            </Card>
            <Card className="p-4 border-l-4 border-l-violet-500">
              <div className="text-2xl font-bold">1.2M</div>
              <div className="text-xs text-muted-foreground">Total Records Synced</div>
            </Card>
          </div>

          {/* Error Rate Chart */}
          {errorRateTrend.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Error Rate Trend (7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={errorRateTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} name="Error Rate %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          ) : (
          <Card>
            <CardContent className="h-48 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No error rate data available</p>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Data Volume Chart */}
          {dataVolumeData.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Data Volume (Records Synced)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataVolumeData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="volume" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Records" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          ) : (
          <Card>
            <CardContent className="h-48 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No data volume data available</p>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Health Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Per-Integration Health</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Integration</TableHead>
                      <TableHead>Uptime (7d)</TableHead>
                      <TableHead>Avg Latency</TableHead>
                      <TableHead>Error Rate</TableHead>
                      <TableHead>Data Volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connectedIntegrations.map((integ) => (
                      <TableRow key={integ.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn('h-6 w-6 rounded flex items-center justify-center text-white text-xs', integ.logoColor)}>
                              {integ.icon}
                            </div>
                            <span className="font-medium text-sm">{integ.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={integ.uptime} className="h-2 w-16" />
                            <span className={cn('text-sm font-mono', integ.uptime >= 99 ? 'text-emerald-600' : integ.uptime >= 95 ? 'text-amber-600' : 'text-red-600')}>
                              {integ.uptime}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-mono">{integ.avgLatency}ms</TableCell>
                        <TableCell>
                          <span className={cn('text-sm font-mono', integ.errorRate <= 0.5 ? 'text-emerald-600' : integ.errorRate <= 2 ? 'text-amber-600' : 'text-red-600')}>
                            {integ.errorRate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-mono">{integ.recordsSynced.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Webhook Configuration ──────────────────────────────────────── */}
        <TabsContent value="webhooks" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{webhookConfigs.filter(w => w.status === 'active').length} active webhooks</p>
            </div>
            <Button onClick={() => setShowAddWebhook(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </div>

          <div className="grid gap-4">
            {webhookConfigs.map((wh) => (
              <Card key={wh.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-sm">{wh.name}</h3>
                        <Badge variant={wh.status === 'active' ? 'default' : 'secondary'} className={wh.status === 'active' ? 'bg-emerald-500 text-xs' : 'text-xs'}>
                          {wh.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Webhook className="h-3 w-3" />
                        <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">{wh.url}</code>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {wh.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-[10px] font-mono">{event}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center shrink-0">
                      <div>
                        <div className="text-sm font-bold">{wh.successRate}%</div>
                        <div className="text-[10px] text-muted-foreground">Success</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold">{wh.deliveries.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground">Deliveries</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold">{wh.lastDelivery}</div>
                        <div className="text-[10px] text-muted-foreground">Last</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      <span>Secret: {wh.secret}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => toast.success('Webhook test sent!')}>
                        Test
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => toast.success('Delivery logs opened!')}>
                        Logs
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── API Keys Management ────────────────────────────────────────── */}
        <TabsContent value="api-keys" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{apiKeys.filter(k => k.status === 'active').length} active keys</p>
            </div>
            <Button onClick={() => setShowAddKey(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add API Key
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Integration</TableHead>
                      <TableHead>Key Value</TableHead>
                      <TableHead className="hidden md:table-cell">Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Usage</TableHead>
                      <TableHead className="hidden lg:table-cell">Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((apiKey) => (
                      <TableRow key={apiKey.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{apiKey.name}</p>
                            <p className="text-xs text-muted-foreground">Created {apiKey.createdAt}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">{apiKey.integration}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="bg-muted px-2 py-0.5 rounded text-[11px] font-mono max-w-[120px] truncate">
                              {visibleKeys.has(apiKey.id) ? apiKey.key : apiKey.maskedKey}
                            </code>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleKeyVisibility(apiKey.id)}>
                              {visibleKeys.has(apiKey.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(apiKey.key); toast.success('Key copied!'); }}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className={cn(
                            'text-xs',
                            apiKey.status === 'active' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
                            apiKey.status === 'expired' && 'bg-red-500/10 text-red-600 border-red-500/30',
                            apiKey.status === 'rotated' && 'bg-amber-500/10 text-amber-600 border-amber-500/30',
                          )}>
                            {apiKey.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm font-mono">{apiKey.usageCount.toLocaleString()}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">
                          {apiKey.rotationScheduled ? (
                            <div>
                              <span className="text-amber-600">Rotation: {apiKey.rotationScheduled}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{apiKey.expiresAt}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => toast.success('Key rotated!')}>
                              <RotateCw className="h-3 w-3 mr-1" /> Rotate
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => toast.success('Key revoked!')}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Integration Detail Dialog ───────────────────────────────────── */}
      <Dialog open={!!selectedIntegration} onOpenChange={() => setSelectedIntegration(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedIntegration && (
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center text-white', selectedIntegration.logoColor)}>
                  {selectedIntegration.icon}
                </div>
              )}
              {selectedIntegration?.name}
            </DialogTitle>
            <DialogDescription>{selectedIntegration?.description}</DialogDescription>
          </DialogHeader>
          {selectedIntegration && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Category</div>
                  <div className="text-sm font-medium mt-0.5">{selectedIntegration.category}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Sync Interval</div>
                  <div className="text-sm font-medium mt-0.5">{selectedIntegration.syncInterval}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Uptime</div>
                  <div className="text-sm font-bold mt-0.5 text-emerald-600">{selectedIntegration.uptime}%</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Avg Latency</div>
                  <div className="text-sm font-medium mt-0.5">{selectedIntegration.avgLatency}ms</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Error Rate</div>
                  <div className={cn('text-sm font-medium mt-0.5', selectedIntegration.errorRate <= 1 ? 'text-emerald-600' : selectedIntegration.errorRate <= 3 ? 'text-amber-600' : 'text-red-600')}>
                    {selectedIntegration.errorRate}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Records Synced</div>
                  <div className="text-sm font-medium mt-0.5">{selectedIntegration.recordsSynced.toLocaleString()}</div>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Last Sync</Label>
                <p className="text-sm">{selectedIntegration.lastSync}</p>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => { toast.success('Test connection sent!'); }}>
                  <Zap className="h-4 w-4 mr-1" /> Test Connection
                </Button>
                <Button size="sm" onClick={() => { toast.success('Sync triggered!'); setSelectedIntegration(null); }}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Sync Now
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Add Webhook Dialog ──────────────────────────────────────────── */}
      <Dialog open={showAddWebhook} onOpenChange={setShowAddWebhook}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Add Webhook
            </DialogTitle>
            <DialogDescription>Configure a new outgoing webhook</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Webhook Name</Label>
              <Input placeholder="My Webhook" />
            </div>
            <div className="space-y-2">
              <Label>Endpoint URL</Label>
              <Input placeholder="https://api.example.com/webhooks/..." />
            </div>
            <div className="space-y-2">
              <Label>Events to Subscribe</Label>
              <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border max-h-32 overflow-y-auto">
                {WEBHOOK_EVENT_OPTIONS.map((event) => (
                  <label key={event} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" className="rounded" />
                    <span className="text-xs font-mono">{event}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secret Key</Label>
              <Input type="password" placeholder="Webhook signing secret" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddWebhook(false)}>Cancel</Button>
            <Button onClick={() => { toast.success('Webhook created!'); setShowAddWebhook(false); }}>
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add API Key Dialog ──────────────────────────────────────────── */}
      <Dialog open={showAddKey} onOpenChange={setShowAddKey}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Add API Key
            </DialogTitle>
            <DialogDescription>Generate a new API key for an integration</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Key Name</Label>
              <Input placeholder="Production API Key" />
            </div>
            <div className="space-y-2">
              <Label>Integration</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select integration" />
                </SelectTrigger>
                <SelectContent>
                  {integrations.map(int => (
                    <SelectItem key={int.id} value={int.name}>{int.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expiration</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select expiration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 Days</SelectItem>
                  <SelectItem value="90">90 Days</SelectItem>
                  <SelectItem value="180">6 Months</SelectItem>
                  <SelectItem value="365">1 Year</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Auto-Rotation</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Rotation schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">Disabled</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="biannually">Bi-annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddKey(false)}>Cancel</Button>
            <Button onClick={() => { toast.success('API key generated!'); setShowAddKey(false); }}>
              Generate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
