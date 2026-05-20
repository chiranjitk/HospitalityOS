'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Router,
  Plus,
  Loader2,
  Settings,
  RefreshCw,
  Wifi,
  WifiOff,
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Zap,
  Shield,
  Clock,
  TestTube,
  Trash2,
  Eye,
  EyeOff,
  Gauge,
  Repeat,
  Upload,
  ExternalLink,
  X,
  Copy,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

interface WiFiGateway {
  id: string;
  name: string;
  type:
    | 'cryptsk'
    | 'mikrotik'
    | 'cisco'
    | 'ubiquiti'
    | 'aruba'
    | 'ruckus'
    | 'fortinet'
    | 'juniper'
    | 'huawei'
    | 'netgear'
    | 'dlink'
    | 'ruijie'
    | 'tplink'
    | 'cambium'
    | 'grandstream'
    | 'other';
  ipAddress: string;
  port: number;
  status: 'connected' | 'disconnected' | 'error';
  apiEndpoint?: string;
  apiKey?: string;
  username?: string;
  lastSync?: string;
  lastSyncLatency?: number;
  firmwareVersion?: string;
  totalAPs: number;
  activeSessions: number;
  bandwidth: {
    upload: number;
    download: number;
  };
  location?: string;
  autoSync: boolean;
  syncInterval: number;
  radiusSecret?: string;
  coaEnabled?: boolean;
  coaPort?: number;
  coaSecret?: string;
  config?: {
    ssid: string;
    vlanId?: number;
    captivePortal: boolean;
    splashPage?: string;
    sessionTimeout: number;
    idleTimeout: number;
    externalPortalMode?: boolean;
    portalCallbackUrl?: string;
    staySuiteServerIp?: string;
    subnet?: string;
  };
}

interface GatewayStats {
  total: number;
  connected: number;
  totalAPs: number;
  activeSessions: number;
  totalBandwidth: number;
}

interface SyncResultData {
  totalAPs?: number;
  activeSessions?: number;
  bandwidthMbps?: number;
  latency?: number;
}

const gatewayTypes = [
  { value: 'cryptsk', label: 'Cryptsk (Native Gateway)' },
  { value: 'mikrotik', label: 'MikroTik RouterOS' },
  { value: 'cisco', label: 'Cisco Meraki' },
  { value: 'ubiquiti', label: 'Ubiquiti UniFi' },
  { value: 'aruba', label: 'Aruba Networks (HPE)' },
  { value: 'ruckus', label: 'Ruckus Networks' },
  { value: 'fortinet', label: 'Fortinet FortiGate' },
  { value: 'juniper', label: 'Juniper Mist AI' },
  { value: 'huawei', label: 'Huawei AirEngine' },
  { value: 'netgear', label: 'Netgear Insight' },
  { value: 'dlink', label: 'D-Link Nuclias' },
  { value: 'ruijie', label: 'Ruijie Networks' },
  { value: 'tplink', label: 'TP-Link Omada' },
  { value: 'cambium', label: 'Cambium Networks' },
  { value: 'grandstream', label: 'Grandstream GWN' },
  { value: 'other', label: 'Other (Generic RADIUS)' },
];

const statusConfig = {
  connected: { color: 'text-emerald-500 dark:text-emerald-400', bgColor: 'bg-emerald-100', icon: CheckCircle, label: 'Connected' },
  disconnected: { color: 'text-amber-500 dark:text-amber-400', bgColor: 'bg-amber-100', icon: AlertTriangle, label: 'Disconnected' },
  error: { color: 'text-red-500 dark:text-red-400', bgColor: 'bg-red-100', icon: XCircle, label: 'Error' },
};

export default function GatewayIntegration() {
  const { toast } = useToast();
  const [gateways, setGateways] = useState<WiFiGateway[]>([]);
  const [stats, setStats] = useState<GatewayStats>({
    total: 0,
    connected: 0,
    totalAPs: 0,
    activeSessions: 0,
    totalBandwidth: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGateway, setSelectedGateway] = useState<WiFiGateway | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [deleteGatewayId, setDeleteGatewayId] = useState<string | null>(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'connected' | 'disconnected' | 'error'>('all');
  const autoSyncTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [walledGardenIps, setWalledGardenIps] = useState<string[]>([]);
  const [newWalledIp, setNewWalledIp] = useState('');
  const [showMikrotikScript, setShowMikrotikScript] = useState(false);
  const [mikrotikScript, setMikrotikScript] = useState('');
  const [externalPortalMode, setExternalPortalMode] = useState(false);

  // Form state for new/edit gateway
  const [formData, setFormData] = useState<Partial<WiFiGateway>>({
    name: '',
    type: 'other',
    ipAddress: '',
    port: 443,
    username: '',
    apiKey: '',
    location: '',
    autoSync: true,
    syncInterval: 5,
    radiusSecret: '',
    coaEnabled: true,
    coaPort: 3799,
    coaSecret: '',
    config: {
      ssid: '',
      captivePortal: false,
      sessionTimeout: 3600,
      idleTimeout: 300,
    },
  });

  // ── Callbacks ──────────────────────────────────────────────
  // Declared BEFORE useEffect to satisfy react-hooks/exhaustive-deps
  // and react-hooks/immutability rules (variable must exist before use).

  const fetchGateways = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/integrations/wifi-gateways');
      const result = await response.json();

      if (result.success) {
        setGateways(result.data.gateways || []);
        setStats(result.data.stats || {
          total: 0,
          connected: 0,
          totalAPs: 0,
          activeSessions: 0,
          totalBandwidth: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching gateways:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch WiFi gateways',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleSync = async (gateway: WiFiGateway) => {
    // Mark this gateway as syncing
    setSyncingIds((prev) => new Set(prev).add(gateway.id));

    toast({
      title: 'Sync Started',
      description: `Syncing ${gateway.name}...`,
    });

    try {
      const response = await fetch(`/api/integrations/wifi-gateways?action=sync&id=${gateway.id}`);
      const result = await response.json();

      if (result.success) {
        const syncData: SyncResultData = result.data || {};
        const bw = syncData.bandwidthMbps ?? 0;
        const latency = syncData.latency;
        const aps = syncData.totalAPs ?? gateway.totalAPs;
        const sessions = syncData.activeSessions ?? gateway.activeSessions;

        toast({
          title: 'Sync Complete',
          description: `Synced: ${aps} APs, ${sessions} sessions, ${bw} Mbps${latency != null ? ` (${latency}ms latency)` : ''}`,
        });

        // Update gateway with proper values
        setGateways((prev) =>
          prev.map((g) =>
            g.id === gateway.id
              ? {
                  ...g,
                  lastSync: new Date().toISOString(),
                  totalAPs: aps,
                  activeSessions: sessions,
                  bandwidth: {
                    download: Math.round(bw * 0.65),
                    upload: Math.round(bw * 0.35),
                  },
                  ...(latency != null ? { lastSyncLatency: latency } : {}),
                }
              : g
          )
        );

        fetchGateways();
      } else {
        toast({
          title: 'Sync Failed',
          description: result.error?.message || 'Failed to sync gateway',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync gateway',
        variant: 'destructive',
      });
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(gateway.id);
        return next;
      });
    }
  };

  // ── Effects ────────────────────────────────────────────────

  // Initial data fetch on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/integrations/wifi-gateways');
        const result = await response.json();
        if (cancelled) return;
        if (result.success) {
          setGateways(result.data.gateways || []);
          setStats(result.data.stats || {
            total: 0,
            connected: 0,
            totalAPs: 0,
            activeSessions: 0,
            totalBandwidth: 0,
          });
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching gateways:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();

    return () => {
      cancelled = true;
      // Clean up auto-sync timers on unmount
      autoSyncTimerRef.current.forEach((timer) => clearTimeout(timer));
      autoSyncTimerRef.current.clear();
    };
  }, []);

  // Manage auto-sync timers
  useEffect(() => {
    // Clear existing timers
    autoSyncTimerRef.current.forEach((timer) => clearTimeout(timer));
    autoSyncTimerRef.current.clear();

    // Set up new timers for gateways with auto-sync enabled
    gateways.forEach((gateway) => {
      if (gateway.autoSync && gateway.status === 'connected') {
        const intervalMs = (gateway.syncInterval || 5) * 60 * 1000;
        const timer = setTimeout(() => {
          handleSync(gateway);
        }, intervalMs);
        autoSyncTimerRef.current.set(gateway.id, timer);
      }
    });

    return () => {
      // Cleanup handled in main unmount above
    };
  }, [gateways, handleSync]);

  const handleSaveGateway = async () => {
    if (!formData.name || !formData.ipAddress) {
      toast({
        title: 'Validation Error',
        description: 'Name and IP Address are required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const isEdit = formData.id && formData.id !== '';
      // Merge walledGardenIps into config_wifi for save
      const savePayload = {
        ...formData,
        config: {
          ...(formData.config || {}),
          ...(externalPortalMode ? {
            externalPortalMode: true,
            walledGardenIps,
          } : { externalPortalMode: false }),
        },
      };
      const response = await fetch('/api/integrations/wifi-gateways', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: isEdit ? 'Gateway updated successfully' : 'Gateway added successfully',
        });
        setIsConfigOpen(false);
        resetForm();
        fetchGateways();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to save gateway',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving gateway:', error);
      toast({
        title: 'Error',
        description: 'Failed to save gateway',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedGateway) return;

    setTestResult(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/integrations/wifi-gateways?action=test-connection&id=${selectedGateway.id}`);
      const result = await response.json();

      if (result.success && result.data?.connected) {
        setTestResult('success');
        toast({
          title: 'Connection Test Passed',
          description: result.data.message || `Successfully connected to ${selectedGateway.name}`,
        });
        // Refresh gateway list to reflect updated status
        fetchGateways();
      } else {
        setTestResult('failed');
        toast({
          title: 'Connection Test Failed',
          description: result.data?.message || 'Could not establish connection to the gateway',
          variant: 'destructive',
        });
        fetchGateways();
      }
    } catch (error) {
      setTestResult('failed');
      toast({
        title: 'Connection Test Failed',
        description: 'An error occurred during the test',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAutoSync = async (gateway: WiFiGateway) => {
    try {
      const response = await fetch('/api/integrations/wifi-gateways', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: gateway.id,
          autoSync: !gateway.autoSync,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setGateways(gateways.map(g =>
          g.id === gateway.id ? { ...g, autoSync: !g.autoSync } : g
        ));
        toast({
          title: 'Success',
          description: 'Auto-sync setting updated',
        });
      }
    } catch (error) {
      console.error('Error updating auto-sync:', error);
      toast({
        title: 'Error',
        description: 'Failed to update auto-sync setting',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (gateway: WiFiGateway) => {
    setDeleteGatewayId(gateway.id);
  };

  const confirmDelete = async () => {
    if (!deleteGatewayId) return;

    try {
      const response = await fetch(`/api/integrations/wifi-gateways?id=${deleteGatewayId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Gateway deleted successfully',
        });
        fetchGateways();
      }
    } catch (error) {
      console.error('Error deleting gateway:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete gateway',
        variant: 'destructive',
      });
    } finally {
      setDeleteGatewayId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'other',
      ipAddress: '',
      port: 443,
      username: '',
      apiKey: '',
      location: '',
      autoSync: true,
      syncInterval: 5,
      radiusSecret: '',
      coaEnabled: true,
      coaPort: 3799,
      coaSecret: '',
      config: {
        ssid: '',
        captivePortal: false,
        sessionTimeout: 3600,
        idleTimeout: 300,
      },
    });
    setSelectedGateway(null);
    setWalledGardenIps([]);
    setNewWalledIp('');
    setExternalPortalMode(false);
    setShowMikrotikScript(false);
    setMikrotikScript('');
  };

  const openEditDialog = (gateway: WiFiGateway) => {
    setSelectedGateway(gateway);
    const wifiConfig = (gateway.config || {}) as Record<string, unknown>;
    setFormData({
      ...gateway,
      config: wifiConfig.ssid ? wifiConfig as WiFiGateway['config'] : {
        ssid: '',
        captivePortal: false,
        sessionTimeout: 3600,
        idleTimeout: 300,
      },
      radiusSecret: (gateway as any).radiusSecret || '',
      coaEnabled: (gateway as any).coaEnabled ?? true,
      coaPort: (gateway as any).coaPort || 3799,
      coaSecret: (gateway as any).coaSecret || '',
    });
    // Load MikroTik external portal state
    setExternalPortalMode(wifiConfig.externalPortalMode === true);
    setWalledGardenIps(
      Array.isArray(wifiConfig.walledGardenIps)
        ? (wifiConfig.walledGardenIps as string[])
        : []
    );
    setShowMikrotikScript(false);
    setMikrotikScript('');
    setIsConfigOpen(true);
  };

  const handlePushConfig = async (gateway: WiFiGateway) => {
    try {
      const response = await fetch(`/api/integrations/wifi-gateways?action=push-config&id=${gateway.id}`, {
        method: 'POST',
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Config Pushed', description: result.message || 'Configuration pushed to gateway successfully' });
      } else {
        toast({ title: 'Push Failed', description: result.error?.message || 'Failed to push configuration', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Push Failed', description: 'Failed to push configuration', variant: 'destructive' });
    }
  };

  // ── MikroTik External Portal: Generate RouterOS setup script ──
  const handleGenerateMikrotikScript = async () => {
    if (!formData.id) return;
    try {
      const res = await fetch(`/api/integrations/wifi-gateways?action=generate-mikrotik-script&id=${formData.id}`);
      const result = await res.json();
      if (result.success && result.data?.script) {
        setMikrotikScript(result.data.script);
        setShowMikrotikScript(true);
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to generate script', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to generate MikroTik script', variant: 'destructive' });
    }
  };

  const handleAddWalledIp = () => {
    const ip = newWalledIp.trim();
    if (ip && !walledGardenIps.includes(ip)) {
      setWalledGardenIps([...walledGardenIps, ip]);
      setNewWalledIp('');
    }
  };

  const handleRemoveWalledIp = (ip: string) => {
    setWalledGardenIps(walledGardenIps.filter(i => i !== ip));
  };

  const filteredGateways = gateways.filter((gw) => {
    if (filterStatus === 'all') return true;
    return gw.status === filterStatus;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Router className="h-5 w-5" />
            WiFi Controller
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage wireless controller connections and push configuration
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchGateways}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setIsConfigOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Gateway
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.connected}</div>
              <div className="text-xs text-muted-foreground">Connected</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Wifi className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalAPs}</div>
              <div className="text-xs text-muted-foreground">Access Points</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Activity className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.activeSessions}</div>
              <div className="text-xs text-muted-foreground">Active Sessions</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalBandwidth}</div>
              <div className="text-xs text-muted-foreground">Mbps Total</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-rose-500/10">
              <Server className="h-4 w-4 text-rose-500 dark:text-rose-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Gateways</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Gateway List */}
      {gateways.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <Router className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No WiFi gateways configured</p>
          <Button onClick={() => { resetForm(); setIsConfigOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Gateway
          </Button>
        </Card>
      ) : (
        <>
          {/* Filter bar */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter:</span>
            {(['all', 'connected', 'disconnected', 'error'] as const).map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus(status)}
                className="capitalize text-xs"
              >
                {status === 'all' ? 'All' : status}
                {status !== 'all' && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                    {gateways.filter((g) => g.status === status).length}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {filteredGateways.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-12">
                  <WifiOff className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No gateways match the selected filter</p>
                </Card>
              ) : (
                filteredGateways.map((gateway) => {
                  const statusInfo = statusConfig[gateway.status] || statusConfig.disconnected;
                  const StatusIcon = statusInfo.icon;
                  const isSyncing = syncingIds.has(gateway.id);

                  return (
                    <Card key={gateway.id} className="overflow-hidden">
                      <div className="flex flex-col lg:flex-row">
                        {/* Status Indicator */}
                        <div className={cn(
                          'w-full lg:w-2 p-4 flex items-center justify-center gap-2',
                          statusInfo.bgColor
                        )}>
                          <div className="relative">
                            <StatusIcon className={cn('h-5 w-5', statusInfo.color)} />
                            {/* Green pulse for connected status */}
                            {gateway.status === 'connected' && (
                              <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-emerald-500" />
                            )}
                          </div>
                          <span className={cn('font-medium', statusInfo.color)}>
                            {statusInfo.label}
                          </span>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 p-4">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="h-12 w-12 rounded-lg bg-primary/5 flex items-center justify-center">
                                <Router className="h-6 w-6 text-cyan-500 dark:text-cyan-400" />
                              </div>
                              <div>
                                <h3 className="font-semibold flex items-center gap-2">
                                  {gateway.name}
                                  {/* Green pulse dot for connected */}
                                  {gateway.status === 'connected' && (
                                    <span className="relative flex h-2.5 w-2.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                                    </span>
                                  )}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {gateway.ipAddress}:{gateway.port}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  <Badge variant="outline" className="capitalize text-xs">
                                    {gatewayTypes.find(t => t.value === gateway.type)?.label}
                                  </Badge>
                                  {gateway.config?.externalPortalMode && (
                                    <Badge variant="default" className="bg-orange-500/10 text-orange-600 border-orange-200">
                                      <ExternalLink className="w-3 h-3 mr-1" />
                                      External Portal
                                    </Badge>
                                  )}
                                  {gateway.location && (
                                    <Badge variant="secondary" className="text-xs">
                                      {gateway.location}
                                    </Badge>
                                  )}
                                  {gateway.firmwareVersion && (
                                    <Badge variant="secondary" className="text-xs gap-1">
                                      <Shield className="h-3 w-3" />
                                      v{gateway.firmwareVersion}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Metrics */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">APs</p>
                                <p className="font-semibold">{gateway.totalAPs}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Sessions</p>
                                <p className="font-semibold">{gateway.activeSessions}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Download</p>
                                <p className="font-semibold">{gateway.bandwidth.download} Mbps</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Upload</p>
                                <p className="font-semibold">{gateway.bandwidth.upload} Mbps</p>
                              </div>
                            </div>
                          </div>

                          {/* Last Sync, Latency & Auto Sync */}
                          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={gateway.autoSync}
                                onCheckedChange={() => handleToggleAutoSync(gateway)}
                              />
                              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                                <Repeat className="h-3 w-3" />
                                Auto-sync every {gateway.syncInterval} min
                              </span>
                              {/* Auto-sync spinning indicator */}
                              {gateway.autoSync && gateway.status === 'connected' && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  {isSyncing ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin text-cyan-500" />
                                      <span className="text-cyan-600 dark:text-cyan-400">Syncing...</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                                      </span>
                                      <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                            {gateway.lastSync && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                Last sync: {formatDistanceToNow(new Date(gateway.lastSync))} ago
                                {/* Show latency from last sync */}
                                {gateway.lastSyncLatency != null && (
                                  <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0 gap-0.5 font-normal">
                                    <Gauge className="h-2.5 w-2.5" />
                                    {gateway.lastSyncLatency}ms
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2 mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSync(gateway)}
                              disabled={gateway.status !== 'connected' || isSyncing}
                            >
                              {isSyncing ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3 mr-1" />
                              )}
                              {isSyncing ? 'Syncing...' : 'Sync'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setSelectedGateway(gateway); setIsTestOpen(true); }}
                            >
                              <TestTube className="h-3 w-3 mr-1" />
                              Test Connection
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePushConfig(gateway)}
                              disabled={gateway.status !== 'connected'}
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              Push Config
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(gateway)}
                            >
                              <Settings className="h-3 w-3 mr-1" />
                              Configure
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 dark:text-red-400 hover:text-red-700"
                              onClick={() => handleDelete(gateway)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </>
      )}

      {/* Add/Edit Gateway Dialog */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formData.id ? 'Edit Gateway' : 'Add WiFi Gateway'}</DialogTitle>
            <DialogDescription>
              Configure your WiFi controller connection settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Settings */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Basic Settings</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Gateway Name *</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Main Controller"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Controller Type</Label>
                  <Select
                    value={formData.type || 'other'}
                    onValueChange={(value) => setFormData({ ...formData, type: value as WiFiGateway['type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {gatewayTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ipAddress">IP Address *</Label>
                  <Input
                    id="ipAddress"
                    value={formData.ipAddress || ''}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    placeholder="192.168.1.100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port || 443}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 443 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Server Room, Building A"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="syncInterval">Sync Interval (min)</Label>
                  <Input
                    id="syncInterval"
                    type="number"
                    value={formData.syncInterval || 5}
                    onChange={(e) => setFormData({ ...formData, syncInterval: parseInt(e.target.value) || 5 })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="autoSync"
                  checked={formData.autoSync ?? true}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoSync: checked })}
                />
                <Label htmlFor="autoSync">Enable auto-sync</Label>
              </div>
            </div>

            <Separator />

            {/* Authentication */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Authentication</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username || ''}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="admin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      value={formData.apiKey || ''}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      placeholder="Enter API key"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* RADIUS & CoA Settings */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">RADIUS & CoA Settings</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="radiusSecret">RADIUS Secret</Label>
                  <div className="relative">
                    <Input
                      id="radiusSecret"
                      type={showApiKey ? 'text' : 'password'}
                      value={formData.radiusSecret || ''}
                      onChange={(e) => setFormData({ ...formData, radiusSecret: e.target.value })}
                      placeholder="Enter RADIUS shared secret"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coaPort">CoA Port</Label>
                  <Input
                    id="coaPort"
                    type="number"
                    value={formData.coaPort || 3799}
                    onChange={(e) => setFormData({ ...formData, coaPort: parseInt(e.target.value) || 3799 })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="coaEnabled"
                    checked={formData.coaEnabled ?? true}
                    onCheckedChange={(checked) => setFormData({ ...formData, coaEnabled: checked })}
                  />
                  <Label htmlFor="coaEnabled">Enable CoA (Change of Authorization)</Label>
                </div>
              </div>
              {formData.coaEnabled !== false && (
                <div className="space-y-2">
                  <Label htmlFor="coaSecret">CoA Secret (optional)</Label>
                  <div className="relative">
                    <Input
                      id="coaSecret"
                      type={showApiKey ? 'text' : 'password'}
                      value={formData.coaSecret || ''}
                      onChange={(e) => setFormData({ ...formData, coaSecret: e.target.value })}
                      placeholder="Enter CoA shared secret"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* WiFi Configuration */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">WiFi Configuration</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ssid">SSID</Label>
                  <Input
                    id="ssid"
                    value={formData.config?.ssid || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config!, ssid: e.target.value }
                    })}
                    placeholder="Hotel-Guest"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vlanId">VLAN ID</Label>
                  <Input
                    id="vlanId"
                    type="number"
                    value={formData.config?.vlanId || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config!, vlanId: parseInt(e.target.value) || undefined }
                    })}
                    placeholder="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Session Timeout (sec)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    value={formData.config?.sessionTimeout || 3600}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config!, sessionTimeout: parseInt(e.target.value) || 3600 }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idleTimeout">Idle Timeout (sec)</Label>
                  <Input
                    id="idleTimeout"
                    type="number"
                    value={formData.config?.idleTimeout || 300}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config!, idleTimeout: parseInt(e.target.value) || 300 }
                    })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="splashPage">Splash Page URL</Label>
                  <Input
                    id="splashPage"
                    value={formData.config?.splashPage || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config!, splashPage: e.target.value }
                    })}
                    placeholder="https://portal.hotel.com/welcome"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="captivePortal"
                  checked={formData.config?.captivePortal ?? false}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    config: { ...formData.config!, captivePortal: checked }
                  })}
                />
                <Label htmlFor="captivePortal">Enable Captive Portal</Label>
              </div>

              {/* MikroTik External Portal — only shown when MikroTik + Captive Portal enabled */}
              {formData.type === 'mikrotik' && formData.config?.captivePortal && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-orange-500" />
                      <h4 className="font-medium text-sm">MikroTik External Portal</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use StaySuite as the captive portal instead of MikroTik&apos;s built-in portal.
                      Guests will see the StaySuite login page, then get redirected to MikroTik for authentication.
                    </p>

                    {/* Portal Mode Selection */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Portal Mode</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="portalMode"
                            checked={externalPortalMode}
                            onChange={() => setExternalPortalMode(true)}
                            className="accent-primary"
                          />
                          <span className="text-sm">StaySuite Captive Portal</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="portalMode"
                            checked={!externalPortalMode}
                            onChange={() => setExternalPortalMode(false)}
                            className="accent-primary"
                          />
                          <span className="text-sm">MikroTik Built-in Portal</span>
                        </label>
                      </div>
                    </div>

                    {/* External Portal Fields */}
                    {externalPortalMode && (
                      <>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="portalCallbackUrl" className="text-xs">MikroTik Hotspot Login URL *</Label>
                            <Input
                              id="portalCallbackUrl"
                              type="text"
                              value={(formData.config?.portalCallbackUrl as string) || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                config: { ...formData.config!, portalCallbackUrl: e.target.value, externalPortalMode: true }
                              })}
                              placeholder="http://192.168.1.1/login"
                            />
                            <p className="text-xs text-muted-foreground">
                              The MikroTik hotspot login endpoint. After StaySuite auth, guests redirect here with RADIUS credentials.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="staySuiteServerIp" className="text-xs">StaySuite Server IP</Label>
                            <Input
                              id="staySuiteServerIp"
                              type="text"
                              value={(formData.config?.staySuiteServerIp as string) || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                config: { ...formData.config!, staySuiteServerIp: e.target.value }
                              })}
                              placeholder="192.168.1.100"
                            />
                            <p className="text-xs text-muted-foreground">
                              Auto-added to MikroTik walled garden so guests can reach the StaySuite portal.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="managedSubnet" className="text-xs">
                              Managed Subnet (CIDR)
                              <span className="text-muted-foreground ml-1 font-normal">— for multi-gateway routing</span>
                            </Label>
                            <Input
                              id="managedSubnet"
                              type="text"
                              value={(formData.config?.subnet as string) || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                config: { ...formData.config!, subnet: e.target.value }
                              })}
                              placeholder="10.10.10.0/24"
                            />
                            <p className="text-xs text-muted-foreground">
                              The subnet this MikroTik manages. Guest IPs in this range will be routed to this gateway for external captive portal auth. Leave empty for single-gateway deployments.
                            </p>
                          </div>
                        </div>

                        {/* Walled Garden IPs */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Additional Walled Garden IPs</Label>
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              value={newWalledIp}
                              onChange={(e) => setNewWalledIp(e.target.value)}
                              placeholder="8.8.8.8"
                              className="flex-1"
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddWalledIp())}
                            />
                            <Button type="button" variant="outline" size="sm" onClick={handleAddWalledIp}>
                              <Plus className="w-3 h-3 mr-1" /> Add
                            </Button>
                          </div>
                          {walledGardenIps.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {walledGardenIps.map((ip) => (
                                <Badge key={ip} variant="secondary" className="gap-1">
                                  {ip}
                                  <X
                                    className="w-3 h-3 cursor-pointer hover:text-destructive"
                                    onClick={() => handleRemoveWalledIp(ip)}
                                  />
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Generate Script Button */}
                        {formData.id && (
                          <div className="space-y-3 pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleGenerateMikrotikScript}
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Generate MikroTik Setup Script
                            </Button>

                            {/* Script Preview */}
                            {showMikrotikScript && mikrotikScript && (
                              <div className="space-y-2">
                                <div className="relative">
                                  <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto max-h-64 overflow-y-auto font-mono">
                                    {mikrotikScript}
                                  </pre>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute top-2 right-2"
                                    onClick={() => {
                                      navigator.clipboard.writeText(mikrotikScript);
                                      toast({ title: 'Copied', description: 'Script copied to clipboard' });
                                    }}
                                  >
                                    <Copy className="w-3 h-3 mr-1" /> Copy
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Paste this script into MikroTik Terminal (SSH or WinBox). This configures hotspot, walled garden, and RADIUS client settings.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGateway} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Gateway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Connection Dialog */}
      <Dialog open={isTestOpen} onOpenChange={setIsTestOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Test Connection</DialogTitle>
            <DialogDescription>
              Verify connection to {selectedGateway?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            {testResult === null ? (
              <div className="text-center text-muted-foreground">
                <TestTube className="h-12 w-12 mx-auto mb-4" />
                <p>Click the button below to test the connection</p>
              </div>
            ) : (
              <div className={cn(
                'text-center p-6 rounded-lg',
                testResult === 'success' ? 'bg-primary/5 dark:bg-primary/10' : 'bg-red-50 dark:bg-red-950/30'
              )}>
                {testResult === 'success' ? (
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
                ) : (
                  <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500 dark:text-red-400" />
                )}
                <p className={cn(
                  'font-medium',
                  testResult === 'success' ? 'text-primary' : 'text-red-700 dark:text-red-300'
                )}>
                  {testResult === 'success' ? 'Connection Successful' : 'Connection Failed'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {testResult === 'success'
                    ? 'The gateway is responding correctly'
                    : 'Could not establish connection to the gateway'
                  }
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsTestOpen(false); setTestResult(null); }}>
              Close
            </Button>
            <Button onClick={handleTestConnection} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteGatewayId} onOpenChange={(open) => !open && setDeleteGatewayId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this gateway? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
