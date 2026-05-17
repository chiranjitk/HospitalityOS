'use client';

/**
 * WiFi Health Alerts Component (F21)
 *
 * Comprehensive alert management dashboard for WiFi health monitoring.
 * Features: stats cards, filter bar, alert table with expandable details,
 * acknowledge/resolve/delete actions, and responsive design.
 *
 * Data source: /api/wifi/alerts, /api/wifi/alerts/stats
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Bell,
  Shield,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface WiFiAlert {
  id: string;
  tenantId: string;
  propertyId: string | null;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  source: string | null;
  metadata: string;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolveNote: string | null;
  createdAt: string;
  updatedAt: string;
  property?: { id: string; name: string } | null;
}

interface AlertStats {
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  trend: {
    thisWeek: number;
    lastWeek: number;
    change: number;
  };
  activeCount: number;
  avgResolutionMinutes: number | null;
}

interface AlertCounts {
  active: number;
  acknowledged: number;
  resolved: number;
  critical: number;
  warning: number;
  info: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const ALERT_TYPES: Record<string, { label: string; color: string }> = {
  ap_down: { label: 'AP Down', color: 'text-red-500' },
  latency: { label: 'High Latency', color: 'text-amber-500' },
  capacity: { label: 'Capacity', color: 'text-orange-500' },
  auth_failure: { label: 'Auth Failure', color: 'text-rose-500' },
  radius_error: { label: 'RADIUS Error', color: 'text-red-600' },
  bandwidth_exhaustion: { label: 'BW Exhaustion', color: 'text-purple-500' },
  nas_offline: { label: 'NAS Offline', color: 'text-red-700' },
};

// ─── Component ──────────────────────────────────────────────────────────────────

export default function WiFiHealthAlerts() {
  const { toast } = useToast();

  // ─── State ────────────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState<WiFiAlert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [counts, setCounts] = useState<AlertCounts>({
    active: 0, acknowledged: 0, resolved: 0, critical: 0, warning: 0, info: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterProperty, setFilterProperty] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Resolve dialog
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<WiFiAlert | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WiFiAlert | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Properties list
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);

  // ─── Fetch alerts ─────────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterSeverity !== 'all') params.set('severity', filterSeverity);
      if (filterType !== 'all') params.set('type', filterType);
      if (filterProperty !== 'all') params.set('propertyId', filterProperty);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/wifi/alerts?${params.toString()}`);
      const result = await res.json();

      if (result.success) {
        setAlerts(Array.isArray(result.data) ? result.data : []);
        setTotal(result.pagination?.total || 0);
        setTotalPages(result.pagination?.totalPages || 1);
        if (result.counts) {
          setCounts(result.counts);
        }
        // Extract unique properties from alerts
        const props = new Map<string, string>();
        for (const alert of result.data || []) {
          if (alert.property?.id && alert.property?.name) {
            props.set(alert.property.id, alert.property.name);
          }
        }
        if (props.size > 0) {
          setProperties(prev => {
            const merged = new Map(prev.map(p => [p.id, p.name]));
            props.forEach((name, id) => merged.set(id, name));
            return Array.from(merged.entries()).map(([id, name]) => ({ id, name }));
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      toast({ title: 'Error', description: 'Failed to fetch alerts', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [page, filterStatus, filterSeverity, filterType, filterProperty, startDate, endDate, toast]);

  // ─── Fetch stats ──────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const res = await fetch('/api/wifi/alerts/stats');
      const result = await res.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch alert stats:', error);
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    fetchStats();
  }, [fetchAlerts, fetchStats]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterSeverity, filterType, filterProperty, startDate, endDate]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleAcknowledge = async (alert: WiFiAlert) => {
    try {
      const res = await fetch(`/api/wifi/alerts/${alert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'acknowledged' }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Acknowledged', description: `"${alert.title}" has been acknowledged` });
        fetchAlerts();
        fetchStats();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to acknowledge', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
  };

  const handleOpenResolve = (alert: WiFiAlert) => {
    setResolveTarget(alert);
    setResolveNote('');
    setResolveDialogOpen(true);
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setIsResolving(true);
    try {
      const res = await fetch(`/api/wifi/alerts/${resolveTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', resolveNote: resolveNote || undefined }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Resolved', description: `"${resolveTarget.title}" has been resolved` });
        setResolveDialogOpen(false);
        setResolveTarget(null);
        fetchAlerts();
        fetchStats();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to resolve', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setIsResolving(false);
    }
  };

  const handleOpenDelete = (alert: WiFiAlert) => {
    setDeleteTarget(alert);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/wifi/alerts/${deleteTarget.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Deleted', description: 'Alert has been deleted' });
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
        if (expandedId === deleteTarget.id) setExpandedId(null);
        fetchAlerts();
        fetchStats();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterSeverity('all');
    setFilterType('all');
    setFilterProperty('all');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = filterStatus !== 'all' || filterSeverity !== 'all' ||
    filterType !== 'all' || filterProperty !== 'all' || startDate || endDate;

  // ─── Render helpers ───────────────────────────────────────────────────────

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Critical
          </Badge>
        );
      case 'warning':
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Warning
          </Badge>
        );
      case 'info':
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-0 gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Info
          </Badge>
        );
      default:
        return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-0 gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
            </span>
            Active
          </Badge>
        );
      case 'acknowledged':
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-0 gap-1">
            <Eye className="h-3 w-3" />
            Acknowledged
          </Badge>
        );
      case 'resolved':
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1">
            <CheckCircle className="h-3 w-3" />
            Resolved
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10';
      case 'warning': return 'bg-amber-500/10';
      case 'info': return 'bg-blue-500/10';
      default: return 'bg-muted';
    }
  };

  const getRowBg = (alert: WiFiAlert) => {
    if (expandedId === alert.id) return '';
    if (alert.status === 'resolved') return 'bg-muted/30';
    if (alert.severity === 'critical') return 'bg-red-50/40 dark:bg-red-950/10';
    if (alert.severity === 'warning') return 'bg-amber-50/30 dark:bg-amber-950/5';
    return '';
  };

  const formatResolutionTime = (minutes: number | null) => {
    if (minutes == null) return '—';
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
    return `${Math.floor(minutes / 1440)}d ${Math.round((minutes % 1440) / 60)}h`;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-5 w-5" />
            WiFi Health Alerts
          </h2>
          <p className="text-sm text-muted-foreground">
            Monitor and manage WiFi infrastructure alerts across all properties.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchAlerts(); fetchStats(); }} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Activity className="h-4 w-4 text-orange-500 dark:text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{counts.active + counts.acknowledged}</div>
              <div className="text-xs text-muted-foreground">Active Alerts</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{counts.critical}</div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{counts.warning}</div>
              <div className="text-xs text-muted-foreground">Warning</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Info className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">{counts.info}</div>
              <div className="text-xs text-muted-foreground">Info</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{counts.resolved}</div>
              <div className="text-xs text-muted-foreground">Resolved</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Clock className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-lg font-bold tabular-nums">
                {isStatsLoading ? '—' : formatResolutionTime(stats?.avgResolutionMinutes ?? null)}
              </div>
              <div className="text-xs text-muted-foreground">Avg Resolution</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Trend indicator */}
      {stats && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Weekly trend:</span>
          <span className="font-medium">{stats.trend.thisWeek} new this week</span>
          <span className="text-muted-foreground">vs</span>
          <span className="font-medium">{stats.trend.lastWeek} last week</span>
          {stats.trend.change !== 0 && (
            <Badge
              variant="secondary"
              className={cn(
                'gap-1 border-0',
                stats.trend.change > 0
                  ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                  : 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary',
              )}
            >
              {stats.trend.change > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(stats.trend.change)}%
            </Badge>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Severity</label>
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Type</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(ALERT_TYPES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Property</label>
              <Select value={filterProperty} onValueChange={setFilterProperty}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Table */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted/50 p-4 mb-3">
              <Shield className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">
              {hasActiveFilters ? 'No alerts match your filters' : 'No alerts found'}
            </h3>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {hasActiveFilters
                ? 'Try adjusting the filters to see more alerts'
                : 'WiFi health alerts will appear here when issues are detected'}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[50px]" />
                    <TableHead className="w-[90px]">Severity</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[120px] hidden md:table-cell">Source</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[130px] hidden sm:table-cell">Created</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => {
                    const isExpanded = expandedId === alert.id;
                    const isResolved = alert.status === 'resolved';
                    let parsedMetadata: Record<string, unknown> = {};
                    try {
                      parsedMetadata = alert.metadata ? JSON.parse(alert.metadata) : {};
                    } catch { /* keep empty */ }

                    return (
                      <React.Fragment key={alert.id}>
                        <TableRow
                          className={cn('cursor-pointer transition-colors', getRowBg(alert))}
                          onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                        >
                          {/* Expand */}
                          <TableCell className="p-2">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>

                          {/* Severity */}
                          <TableCell>
                            {getSeverityBadge(alert.severity)}
                          </TableCell>

                          {/* Type */}
                          <TableCell>
                            <span className={cn('text-xs font-medium', ALERT_TYPES[alert.type]?.color || 'text-muted-foreground')}>
                              {ALERT_TYPES[alert.type]?.label || alert.type}
                            </span>
                          </TableCell>

                          {/* Title */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={cn('p-1 rounded-md shrink-0', getSeverityBg(alert.severity))}>
                                {getSeverityIcon(alert.severity)}
                              </div>
                              <div className="min-w-0">
                                <p className={cn(
                                  'text-sm font-medium truncate',
                                  isResolved && 'text-muted-foreground line-through',
                                )}>
                                  {alert.title}
                                </p>
                                {alert.property?.name && (
                                  <p className="text-xs text-muted-foreground truncate">{alert.property.name}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Source */}
                          <TableCell className="hidden md:table-cell">
                            <span className="text-xs text-muted-foreground font-mono truncate block max-w-[110px]">
                              {alert.source || '—'}
                            </span>
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            {getStatusBadge(alert.status)}
                          </TableCell>

                          {/* Created */}
                          <TableCell className="hidden sm:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                            </span>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {alert.status === 'active' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                  title="Acknowledge"
                                  onClick={() => handleAcknowledge(alert)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {!isResolved && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-primary hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/10"
                                  title="Resolve"
                                  onClick={() => handleOpenResolve(alert)}
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                title="Delete"
                                onClick={() => handleOpenDelete(alert)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <TableRow className={cn('bg-muted/20', alert.severity === 'critical' && 'bg-red-50/20 dark:bg-red-950/5')}>
                            <TableCell colSpan={8} className="p-4">
                              <div className="space-y-3">
                                {/* Message */}
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Message</p>
                                  <p className="text-sm leading-relaxed">{alert.message}</p>
                                </div>

                                {/* Metadata */}
                                {Object.keys(parsedMetadata).length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Metadata</p>
                                    <div className="bg-background rounded-lg p-3 border">
                                      <pre className="text-xs font-mono overflow-x-auto max-w-full whitespace-pre-wrap break-all">
                                        {JSON.stringify(parsedMetadata, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}

                                {/* Timeline */}
                                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="h-3 w-3" />
                                    <span>Created: {format(new Date(alert.createdAt), 'MMM d, yyyy HH:mm:ss')}</span>
                                  </div>
                                  {alert.acknowledgedAt && (
                                    <div className="flex items-center gap-1.5">
                                      <EyeOff className="h-3 w-3" />
                                      <span>Acknowledged: {format(new Date(alert.acknowledgedAt), 'MMM d, yyyy HH:mm:ss')}</span>
                                    </div>
                                  )}
                                  {alert.resolvedAt && (
                                    <div className="flex items-center gap-1.5">
                                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                                      <span>Resolved: {format(new Date(alert.resolvedAt), 'MMM d, yyyy HH:mm:ss')}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Resolve note */}
                                {alert.resolveNote && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Resolution Note</p>
                                    <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-3 border border-primary/20 dark:border-primary/20">
                                      <p className="text-sm">{alert.resolveNote}</p>
                                    </div>
                                  </div>
                                )}

                                {/* Action buttons in expanded view */}
                                <div className="flex items-center gap-2 pt-2">
                                  {alert.status === 'active' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1.5"
                                      onClick={() => handleAcknowledge(alert)}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Acknowledge
                                    </Button>
                                  )}
                                  {!isResolved && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1.5 text-primary border-primary/20 hover:bg-primary/10 dark:border-primary/20 dark:hover:bg-primary/10"
                                      onClick={() => handleOpenResolve(alert)}
                                    >
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      Resolve
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
                                    onClick={() => handleOpenDelete(alert)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pageNum = page <= 3 ? i + 1 : page + i - 2;
                    if (pageNum < 1 || pageNum > totalPages) return null;
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === page ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  {totalPages > 5 && page < totalPages - 2 && (
                    <span className="text-xs text-muted-foreground px-1">...</span>
                  )}
                  {totalPages > 5 && page < totalPages - 2 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 text-xs"
                      onClick={() => setPage(totalPages)}
                    >
                      {totalPages}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Resolve Dialog ─── */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Resolve Alert
            </DialogTitle>
            <DialogDescription>
              Resolve &ldquo;{resolveTarget?.title}&rdquo; and optionally add a note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Resolution Note (optional)</label>
              <Textarea
                placeholder="Describe what was done to resolve this alert..."
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={isResolving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isResolving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Resolve Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Dialog ─── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Alert
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
