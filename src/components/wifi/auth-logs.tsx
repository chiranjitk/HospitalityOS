'use client';

/**
 * Auth Logs Component
 *
 * Real RADIUS authentication log viewer.
 * Queries v_auth_logs view (built on radpostauth).
 * Shows: timestamp, result, username, request-from (NAS IP), plan/group,
 *        reply message (includes client IP), MAC, property, room.
 * Auto-refreshes every 30s. Fetches from /api/wifi/radius?action=auth-logs
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield,
  Search,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  TrendingUp,
  Activity,
  Clock,
  Eye,
  Building2,
  Wifi,
  Monitor,
  Globe,
  Zap,
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
  Users,
  MapPin,
  Server,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AuthLogEntry {
  id?: string;
  timestamp: string;
  username: string;
  authResult: string;
  authType: string;
  nasIpAddress?: string;
  clientIpAddress?: string;
  sourceIpAddress?: string;
  callingStationId?: string;
  calledStationId?: string;
  replyMessage?: string;
  propertyName?: string;
  guestName?: string;
  roomNumber?: string;
  propertyId?: string;
  radiusGroup?: string;
  planName?: string;
  planDownloadSpeed?: number | null;
  planUploadSpeed?: number | null;
  planDataLimit?: number | null;
}

interface AuthLogStats {
  totalAuths: number;
  acceptCount: number;
  rejectCount: number;
  successRate: number;
  last24hTrend: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const formatSpeed = (mbps: number | null | undefined): string => {
  if (!mbps) return '—';
  return `${mbps} Mbps`;
};

const formatDataSize = (mb: number | null | undefined): string => {
  if (!mb) return 'Unlimited';
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${mb} MB`;
};

/** Full timestamp with date + time + seconds */
const formatFullTimestamp = (ts: string): string => {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return format(d, 'dd MMM yyyy, HH:mm:ss');
  } catch {
    return ts;
  }
};

/** Short timestamp for table — date + time */
const formatShortTimestamp = (ts: string): string => {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return format(d, 'dd MMM, HH:mm:ss');
  } catch {
    return ts;
  }
};

/** Relative time */
const formatRelativeTime = (ts: string): string => {
  if (!ts) return '—';
  try {
    return formatDistanceToNow(new Date(ts)) + ' ago';
  } catch {
    return '—';
  }
};

// ─── Component ──────────────────────────────────────────────────────────────────

export default function AuthLogs() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuthLogEntry[]>([]);
  const [stats, setStats] = useState<AuthLogStats>({
    totalAuths: 0,
    acceptCount: 0,
    rejectCount: 0,
    successRate: 0,
    last24hTrend: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuthLogEntry | null>(null);
  const [timeFormat, setTimeFormat] = useState<'full' | 'relative'>('full');

  // ─── Fetch Logs ────────────────────────────────────────────────────────────

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '100');
      if (resultFilter !== 'all') params.append('result', resultFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (debouncedSearchQuery) {
        params.append('username', debouncedSearchQuery);
      }

      const statsParams = new URLSearchParams();
      if (debouncedSearchQuery) statsParams.append('username', debouncedSearchQuery);
      if (resultFilter !== 'all') statsParams.append('result', resultFilter);
      if (startDate) statsParams.append('startDate', startDate);
      if (endDate) statsParams.append('endDate', endDate);

      const [logsRes, statsRes] = await Promise.all([
        fetch(`/api/wifi/radius?action=auth-logs&${params.toString()}`),
        fetch(`/api/wifi/radius?action=auth-logs-stats&${statsParams.toString()}`),
      ]);
      const logsData = await logsRes.json();
      const statsData = await statsRes.json();

      if (logsRes.ok && logsData.success && logsData.data) {
        setLogs(Array.isArray(logsData.data) ? logsData.data : []);
      } else {
        setLogs([]);
        const msg = logsData.error || `HTTP ${logsRes.status}`;
        console.error('[auth-logs] API error:', msg);
        if (logsRes.status === 401) {
          toast({ title: 'Authentication required', description: 'Please log in again', variant: 'destructive' });
        } else if (logsRes.status === 403) {
          toast({ title: 'Permission denied', description: 'Requires wifi.manage or reports.view permission', variant: 'destructive' });
        }
      }

      if (statsData.success && statsData.data) {
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Failed to fetch auth logs:', error);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [resultFilter, startDate, endDate, debouncedSearchQuery]);

  // ─── Debounced search ──────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  // ─── Auto-refresh every 30s ───────────────────────────────────────────────

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // ─── Filtering (client-side for MAC search) ────────────────────────────────

  const filteredLogs = logs.filter(log => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesUsername = log.username.toLowerCase().includes(q);
      const matchesClientIp = (log.clientIpAddress || '').toLowerCase().includes(q);
      const matchesSourceIp = (log.sourceIpAddress || '').toLowerCase().includes(q);
      const matchesNasIp = (log.nasIpAddress || '').toLowerCase().includes(q);
      const matchesMac = (log.callingStationId || '').toLowerCase().includes(q);
      const matchesPlan = (log.planName || '').toLowerCase().includes(q);
      const matchesProperty = (log.propertyName || '').toLowerCase().includes(q);
      const matchesGuest = (log.guestName || '').toLowerCase().includes(q);
      const matchesGroup = (log.radiusGroup || '').toLowerCase().includes(q);
      if (!matchesUsername && !matchesClientIp && !matchesSourceIp && !matchesNasIp && !matchesMac && !matchesPlan && !matchesProperty && !matchesGuest && !matchesGroup) return false;
    }
    return true;
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getResultBadge = (authResult: string) => {
    const r = (authResult || '').toLowerCase();
    if (r === 'access-accept' || r === 'accept') {
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px]">
          <CheckCircle className="h-3 w-3 mr-1" />
          Accept
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-[10px]">
        <XCircle className="h-3 w-3 mr-1" />
        Reject
      </Badge>
    );
  };

  /** Get the request source IP — where the RADIUS auth request came from (NAS) */
  const getRequestFromIp = (log: AuthLogEntry) => {
    return log.nasIpAddress || '';
  };

  /** Get an enhanced reply message with context */
  const getEnhancedReplyMessage = (log: AuthLogEntry) => {
    if (log.replyMessage && log.replyMessage !== '—') return log.replyMessage;
    const isReject = log.authResult?.toLowerCase().includes('reject');
    const parts: string[] = [];
    if (isReject) parts.push('Authentication rejected');
    else parts.push('Authenticated');
    if (log.username) parts.push(`user: ${log.username}`);
    const clientIp = log.clientIpAddress || '';
    if (clientIp) parts.push(`IP: ${clientIp}`);
    const nasIp = log.nasIpAddress || '';
    if (nasIp) parts.push(`from: ${nasIp}`);
    return parts.join(' — ');
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Auth Logs
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            RADIUS authentication log · Source: radpostauth
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Activity className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{stats.totalAuths}</div>
              <div className="text-xs text-muted-foreground">Total Auths</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-primary">{stats.acceptCount}</div>
              <div className="text-xs text-muted-foreground">Accepted</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{stats.rejectCount}</div>
              <div className="text-xs text-muted-foreground">Rejected</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-primary">{stats.successRate}%</div>
              <div className="text-xs text-muted-foreground">Success Rate</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {stats.last24hTrend > 0 ? '+' : ''}{stats.last24hTrend}
              </div>
              <div className="text-xs text-muted-foreground">Last 24h</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username, IP, MAC, plan, property..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="Access-Accept">Accept</SelectItem>
                <SelectItem value="Access-Reject">Reject</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-auto"
                placeholder="From"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-auto"
                placeholder="To"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Shield className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">No auth logs found</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {searchQuery || resultFilter !== 'all' || startDate || endDate
                  ? 'Try clearing filters or search terms'
                  : 'Auth logs will appear when users authenticate via RADIUS'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: Card Layout */}
              <div className="sm:hidden divide-y">
                {filteredLogs.map((log, index) => (
                  <div
                    key={`${index}-${log.id || ''}`}
                    className="p-4 space-y-2 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-mono tabular-nums">
                          {formatShortTimestamp(log.timestamp)}
                        </span>
                      </div>
                      {getResultBadge(log.authResult)}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Wifi className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium text-sm">{log.username}</p>
                      </div>
                      {(() => {
                        const reqIp = getRequestFromIp(log);
                        return reqIp ? (
                          <div className="flex items-center gap-1.5">
                            <Server className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-mono">{reqIp}</span>
                          </div>
                        ) : <span />;
                      })()}
                    </div>
                    {(() => {
                      const msg = getEnhancedReplyMessage(log);
                      const isReject = log.authResult?.toLowerCase().includes('reject');
                      return msg ? (
                        <div className={cn(
                          'text-xs leading-tight',
                          isReject ? 'text-red-600 dark:text-red-400' : 'text-primary'
                        )}>{msg}</div>
                      ) : null;
                    })()}
                    <div className="flex items-center gap-2 flex-wrap">
                      {log.propertyName && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{log.propertyName}</span>
                        </div>
                      )}
                      {log.planName && (
                        <Badge variant="secondary" className="text-[10px] gap-0.5">
                          <Zap className="h-2.5 w-2.5" />
                          {log.planName}
                        </Badge>
                      )}
                      {log.radiusGroup && (
                        <Badge variant="outline" className="text-[10px]">
                          {log.radiusGroup}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden sm:block max-h-[500px] overflow-auto">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[170px]">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Timestamp
                          <button
                            type="button"
                            className="ml-1 p-0.5 rounded hover:bg-muted transition-colors"
                            onClick={() => setTimeFormat(prev => prev === 'full' ? 'relative' : 'full')}
                            title={timeFormat === 'full' ? 'Switch to relative time' : 'Switch to full timestamp'}
                          >
                            <Clock className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      </TableHead>
                      <TableHead className="w-[70px]">Result</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Request From</TableHead>
                      <TableHead>Reply</TableHead>
                      <TableHead>MAC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log, index) => {
                      const isReject = log.authResult?.toLowerCase().includes('reject');
                      const requestFromIp = getRequestFromIp(log);
                      return (
                        <TableRow
                          key={`${index}-${log.id || ''}`}
                          className={cn(
                            'cursor-pointer hover:bg-muted/50 transition-colors',
                            isReject && 'bg-red-50/30 dark:bg-red-950/10'
                          )}
                          onClick={() => setSelectedLog(log)}
                        >
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-mono tabular-nums">
                                {timeFormat === 'full' ? formatShortTimestamp(log.timestamp) : formatRelativeTime(log.timestamp)}
                              </span>
                              {timeFormat === 'full' && log.timestamp && (
                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                  {formatRelativeTime(log.timestamp)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getResultBadge(log.authResult)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Wifi className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div>
                                <p className="font-medium text-sm">{log.username}</p>
                                {log.guestName && (
                                  <p className="text-[10px] text-muted-foreground">{log.guestName}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {requestFromIp ? (
                              <Badge variant="outline" className="font-mono text-[11px] bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 whitespace-nowrap">
                                <Server className="h-2.5 w-2.5 mr-1" />
                                {requestFromIp}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={cn(
                              'text-xs leading-tight block max-w-[200px] truncate',
                              isReject ? 'text-red-600 dark:text-red-400' : 'text-primary'
                            )}>
                              {getEnhancedReplyMessage(log)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <p className="text-xs font-mono text-muted-foreground">{log.callingStationId || '—'}</p>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Auth Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Auth Log Details
            </DialogTitle>
            <DialogDescription>RADIUS authentication event</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="grid gap-4 py-4">
              <div className="flex items-center justify-between">{getResultBadge(selectedLog.authResult)}</div>

              {/* Timestamp — Full */}
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Timestamp</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold tabular-nums">{formatFullTimestamp(selectedLog.timestamp)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{formatRelativeTime(selectedLog.timestamp)}</p>
                  </div>
                </div>
              </div>

              {/* User Information */}
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">User Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Username</p>
                    <p className="text-sm font-medium font-mono">{selectedLog.username || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Guest Name</p>
                    <p className="text-sm">{selectedLog.guestName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">RADIUS Group</p>
                    {selectedLog.radiusGroup ? (
                      <Badge variant="outline" className="mt-0.5 text-xs">{selectedLog.radiusGroup}</Badge>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Auth Type</p>
                    <Badge variant="outline" className="mt-0.5 text-xs">{selectedLog.authType || 'RADIUS'}</Badge>
                  </div>
                </div>
              </div>

              {/* Network */}
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Network Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Request From (NAS)</p>
                    {selectedLog.nasIpAddress ? (
                      <Badge variant="outline" className="mt-1 font-mono text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                        <Server className="h-3 w-3 mr-1" />
                        {selectedLog.nasIpAddress}
                      </Badge>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">—</p>
                    )}
                  </div>
                  {selectedLog.clientIpAddress && (
                    <div>
                      <p className="text-xs text-muted-foreground">Client IP (Assigned from Pool)</p>
                      <Badge variant="outline" className="mt-1 font-mono text-xs bg-primary/5 dark:bg-primary/5 text-primary border-primary/20 dark:border-primary/30">
                        <Monitor className="h-3 w-3 mr-1" />
                        {selectedLog.clientIpAddress}
                      </Badge>
                    </div>
                  )}
                  {selectedLog.sourceIpAddress && (
                    <div>
                      <p className="text-xs text-muted-foreground">RADIUS Client Source IP</p>
                      <Badge variant="outline" className="mt-1 font-mono text-xs bg-primary/5 dark:bg-primary/5 text-primary border-primary/20 dark:border-primary/30">
                        <Globe className="h-3 w-3 mr-1" />
                        {selectedLog.sourceIpAddress}
                      </Badge>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Client MAC (Device)</p>
                    <p className="text-sm font-mono mt-1">{selectedLog.callingStationId || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">AP MAC (Called Station)</p>
                    <p className="text-sm font-mono mt-1">{selectedLog.calledStationId || '—'}</p>
                  </div>
                </div>
              </div>

              {/* WiFi Plan */}
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">WiFi Plan</p>
                {selectedLog.planName ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Plan Name</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        <p className="text-sm font-medium">{selectedLog.planName}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Download</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <ArrowDownToLine className="h-3.5 w-3.5 text-primary" />
                        <p className="text-sm">{formatSpeed(selectedLog.planDownloadSpeed)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Upload</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <ArrowUpFromLine className="h-3.5 w-3.5 text-amber-500" />
                        <p className="text-sm">{formatSpeed(selectedLog.planUploadSpeed)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Data Limit</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Database className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-sm">{formatDataSize(selectedLog.planDataLimit)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No plan associated</p>
                )}
              </div>

              {/* Reply */}
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Reply Message</p>
                <div className={cn(
                  'text-sm px-3 py-2 rounded-lg',
                  (selectedLog.authResult || '').toLowerCase().includes('reject')
                    ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                    : 'bg-primary/5 dark:bg-primary/5 text-primary'
                )}>
                  {getEnhancedReplyMessage(selectedLog)}
                </div>
              </div>

              {/* Location */}
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Location</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Property</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-sm">{selectedLog.propertyName || '—'}</p>
                    </div>
                  </div>
                  {selectedLog.roomNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">Room</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-sm">{selectedLog.roomNumber}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
