'use client';

/**
 * NAS Health Component
 *
 * NAS health monitoring dashboard with online/offline status, live user count,
 * last seen, latency, health log history, and "Check Now" button.
 * Switchable grid (card) / list (table) view.
 *
 * Data source: /api/wifi/nas-health (direct DB query from RadiusNAS + LiveSession + RadiusAuthLog)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Router,
  Loader2,
  RefreshCw,
  Users,
  Wifi,
  WifiOff,
  Signal,
  Server,
  LayoutGrid,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface NasHealthEntry {
  id: string;
  nasIp: string;
  nasIdentifier?: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  liveUserCount: number;
  lastSeenAt: string;
  latency?: number;
  totalSessions: number;
  failedAuths: number;
  uptime?: number | null;
  lastWentOfflineAt?: string | null;
  softwareVersion?: string;
}

interface NasHealthStats {
  totalNas: number;
  onlineCount: number;
  offlineCount: number;
  unknownCount: number;
  totalLiveUsers: number;
  avgLatency: number;
}

type ViewMode = 'grid' | 'list';

// ─── Component ──────────────────────────────────────────────────────────────────

export default function NasHealth() {
  const { toast } = useToast();
  const [nasEntries, setNasEntries] = useState<NasHealthEntry[]>([]);
  const [stats, setStats] = useState<NasHealthStats>({
    totalNas: 0,
    onlineCount: 0,
    offlineCount: 0,
    unknownCount: 0,
    totalLiveUsers: 0,
    avgLatency: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/wifi/nas-health');
      const result = await res.json();

      if (result.success) {
        setNasEntries(Array.isArray(result.data) ? result.data : []);
        if (result.stats) {
          setStats(result.stats);
        }
      } else {
        setNasEntries([]);
      }
    } catch (error) {
      console.error('Failed to fetch NAS health:', error);
      setNasEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const [isProbing, setIsProbing] = useState(false);

  const handleCheckNow = async (nas: NasHealthEntry) => {
    toast({ title: 'Probing...', description: `Running health check for ${nas.nasIdentifier || nas.nasIp}` });
    setIsProbing(true);
    try {
      const res = await fetch('/api/wifi/nas-health', { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Health Check Complete', description: result.message });
      } else {
        toast({ title: 'Check Failed', description: result.error?.message || 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Check Failed', description: 'Network error', variant: 'destructive' });
    } finally {
      setIsProbing(false);
      await fetchHealth();
    }
  };

  const handleRefreshAll = async () => {
    setIsProbing(true);
    toast({ title: 'Probing all NAS...', description: 'Running ICMP + TCP health checks on all devices' });
    try {
      const res = await fetch('/api/wifi/nas-health', { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'All NAS Checked', description: result.message });
      } else {
        toast({ title: 'Check Failed', description: result.error?.message || 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Check Failed', description: 'Network error', variant: 'destructive' });
    } finally {
      setIsProbing(false);
      await fetchHealth();
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getStatusIndicator = (status: string) => {
    if (status === 'online') {
      return (
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">
            <Wifi className="h-3 w-3 mr-1" />
            Online
          </Badge>
        </div>
      );
    }
    if (status === 'degraded') {
      return (
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs">
            Degraded
          </Badge>
        </div>
      );
    }
    if (status === 'unknown') {
      return (
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-400" />
          </span>
          <Badge className="bg-gray-500 hover:bg-gray-600 text-white border-0 text-xs">
            <Wifi className="h-3 w-3 mr-1" />
            Unknown
          </Badge>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
        <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs">
          <WifiOff className="h-3 w-3 mr-1" />
          Offline
        </Badge>
      </div>
    );
  };

  const getStatusDot = (status: string) => {
    const colors: Record<string, string> = {
      online: 'bg-emerald-500',
      degraded: 'bg-amber-500',
      offline: 'bg-red-500',
      unknown: 'bg-gray-400',
    };
    return (
      <span className="relative flex h-2.5 w-2.5">
        {status === 'online' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        {status === 'degraded' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        )}
        <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', colors[status] || colors.offline)} />
      </span>
    );
  };

  const getLatencyBadge = (latency?: number) => {
    if (latency == null) return <span className="text-sm text-muted-foreground">—</span>;
    if (latency < 50) {
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">{latency}ms</Badge>;
    }
    if (latency < 200) {
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs">{latency}ms</Badge>;
    }
    return <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs">{latency}ms</Badge>;
  };

  const formatUptime = (seconds?: number | null, status?: string, lastWentOfflineAt?: string | null) => {
    if (!seconds || seconds <= 0) {
      // If offline, show when it went down
      if (status === 'offline' && lastWentOfflineAt) {
        return `Down ${formatDistanceToNow(new Date(lastWentOfflineAt))} ago`;
      }
      return '—';
    }
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusIconColor = (status: string) => {
    if (status === 'online') return 'text-emerald-500 dark:text-emerald-400';
    if (status === 'degraded') return 'text-amber-500 dark:text-amber-400';
    if (status === 'unknown') return 'text-gray-400 dark:text-gray-500';
    return 'text-red-500 dark:text-red-400';
  };

  const getStatusBgColor = (status: string) => {
    if (status === 'online') return 'bg-emerald-500/10';
    if (status === 'degraded') return 'bg-amber-500/10';
    if (status === 'unknown') return 'bg-gray-500/10';
    return 'bg-red-500/10';
  };

  const getStatusBorderColor = (status: string) => {
    if (status === 'online') return 'border-emerald-200 dark:border-emerald-800';
    if (status === 'degraded') return 'border-amber-200 dark:border-amber-800';
    if (status === 'unknown') return 'border-gray-200 dark:border-gray-700';
    return 'border-red-200 dark:border-red-800';
  };

  const getRowBgColor = (status: string) => {
    if (status === 'online') return 'bg-emerald-50/30 dark:bg-emerald-950/10';
    if (status === 'offline') return 'bg-red-50/30 dark:bg-red-950/10';
    if (status === 'unknown') return 'bg-gray-50/30 dark:bg-gray-950/10';
    return '';
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Server className="h-5 w-5" />
            NAS Health Monitor
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time health monitoring for all NAS devices. Auto-refreshes every 30s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center rounded-lg border bg-muted/50 p-0.5">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 w-7 p-0 rounded-md',
                viewMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 w-7 p-0 rounded-md',
                viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={isProbing}>
            <RefreshCw className={cn('h-4 w-4 mr-2', (isLoading || isProbing) && 'animate-spin')} />
            {isProbing ? 'Probing...' : 'Probe All'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Server className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{stats.totalNas}</div>
              <div className="text-xs text-muted-foreground">Total NAS</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Wifi className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{stats.onlineCount}</div>
              <div className="text-xs text-muted-foreground">Online</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <WifiOff className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{stats.offlineCount}</div>
              <div className="text-xs text-muted-foreground">Offline</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Users className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{stats.totalLiveUsers}</div>
              <div className="text-xs text-muted-foreground">Live Users</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Signal className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{stats.avgLatency}ms</div>
              <div className="text-xs text-muted-foreground">Avg Latency</div>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Loading State ─── */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : nasEntries.length === 0 ? (
        /* ─── Empty State ─── */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted/50 p-4 mb-3">
              <Server className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">No NAS devices found</h3>
            <p className="text-xs text-muted-foreground/60 mt-1">
              NAS health entries will appear when NAS clients are configured
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        /* ─── Grid View (Cards) ─── */
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {nasEntries.map((nas) => (
            <Card key={nas.id} className={cn('transition-shadow hover:shadow-md', getStatusBorderColor(nas.status))}>
              <CardContent className="p-4">
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('p-2 rounded-lg', getStatusBgColor(nas.status))}>
                      <Router className={cn('h-5 w-5', getStatusIconColor(nas.status))} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{nas.nasIdentifier || 'NAS'}</p>
                      <p className="text-xs font-mono text-muted-foreground">{nas.nasIp}</p>
                    </div>
                  </div>
                  {getStatusIndicator(nas.status)}
                </div>

                {/* Card Metrics */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Live Users</p>
                    <p className="font-medium text-sm tabular-nums">{nas.liveUserCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Latency</p>
                    <div className="mt-0.5">{getLatencyBadge(nas.latency)}</div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Seen</p>
                    <p className="font-medium text-sm">
                      {nas.lastSeenAt ? formatDistanceToNow(new Date(nas.lastSeenAt)) + ' ago' : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Uptime</p>
                    <p className={cn('font-medium text-sm', nas.status === 'offline' && 'text-red-600 dark:text-red-400')}>
                      {formatUptime(nas.uptime, nas.status, nas.lastWentOfflineAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Sessions</p>
                    <p className="font-medium text-sm tabular-nums">{nas.totalSessions}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Failed Auths</p>
                    <p className={cn(
                      'font-medium text-sm tabular-nums',
                      nas.failedAuths > 10 && 'text-red-600 dark:text-red-400',
                    )}>
                      {nas.failedAuths}
                    </p>
                  </div>
                </div>

                {/* Card Action */}
                <div className="mt-3 pt-3 border-t flex justify-end">
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => handleCheckNow(nas)} disabled={isProbing}>
                    <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isProbing && 'animate-spin')} />
                    Probe
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* ─── List View (Table) ─── */
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[200px]">NAS</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[100px]">Live Users</TableHead>
                    <TableHead className="w-[100px]">Latency</TableHead>
                    <TableHead className="w-[120px]">Last Seen</TableHead>
                    <TableHead className="w-[100px]">Uptime</TableHead>
                    <TableHead className="w-[100px]">Sessions</TableHead>
                    <TableHead className="w-[110px]">Failed Auths</TableHead>
                    <TableHead className="text-right w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nasEntries.map((nas) => (
                    <TableRow key={nas.id} className={cn('transition-colors', getRowBgColor(nas.status))}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className={cn('p-1.5 rounded-md', getStatusBgColor(nas.status))}>
                            <Router className={cn('h-3.5 w-3.5', getStatusIconColor(nas.status))} />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{nas.nasIdentifier || 'NAS'}</p>
                            <p className="text-xs font-mono text-muted-foreground">{nas.nasIp}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusIndicator(nas.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium tabular-nums">{nas.liveUserCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getLatencyBadge(nas.latency)}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {nas.lastSeenAt ? formatDistanceToNow(new Date(nas.lastSeenAt)) + ' ago' : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={cn('text-sm', nas.status === 'offline' && 'text-red-600 dark:text-red-400')}>
                          {formatUptime(nas.uptime, nas.status, nas.lastWentOfflineAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm tabular-nums">{nas.totalSessions}</span>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          'text-sm tabular-nums',
                          nas.failedAuths > 10 && 'text-red-600 dark:text-red-400 font-medium',
                        )}>
                          {nas.failedAuths}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => handleCheckNow(nas)} disabled={isProbing}>
                          <RefreshCw className={cn('h-4 w-4', isProbing && 'animate-spin')} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
