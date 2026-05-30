'use client';

/**
 * WiFi QoS (Quality of Service) Monitor
 *
 * Shows real-time QoS metrics for each connected user with:
 * - Per-user quality score gauge (semicircle SVG)
 * - User list sorted by quality score (worst first)
 * - Color-coded rows: green (>80), amber (60-80), red (<60)
 * - Drill-down dialog showing detailed metrics
 * - QoS Alerts section for users below threshold
 * - Auto-refresh every 10 seconds
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Gauge,
  AlertTriangle,
  RefreshCw,
  Wifi,
  Clock,
  Activity,
  Download,
  Upload,
  TrendingDown,
  Signal,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePropertyId } from '@/hooks/use-property';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface QoSUser {
  username: string;
  framedIpAddress: string | null;
  callingStationId: string | null;
  nasIpAddress: string | null;
  sessionStart: string | null;
  sessionTime: number;
  latency: number;
  jitter: number;
  packetLoss: number;
  bandwidthDown: number;
  bandwidthUp: number;
  qosScore: number;
  quality: 'excellent' | 'good' | 'poor';
}

interface QoSSummary {
  totalUsers: number;
  avgScore: number;
  excellentCount: number;
  goodCount: number;
  poorCount: number;
  alertUsers: number;
  alerts: Array<{
    username: string;
    score: number;
    quality: string;
    latency: number;
    jitter: number;
    packetLoss: number;
  }>;
}

interface QoSData {
  users: QoSUser[];
  summary: QoSSummary;
  timestamp: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatBps(bps: number): string {
  if (bps >= 1000000) return `${(bps / 1000000).toFixed(1)} MB/s`;
  if (bps >= 1000) return `${(bps / 1000).toFixed(1)} KB/s`;
  return `${bps} B/s`;
}

function qualityColor(quality: 'excellent' | 'good' | 'poor'): string {
  switch (quality) {
    case 'excellent': return 'text-emerald-600 dark:text-emerald-400';
    case 'good': return 'text-amber-600 dark:text-amber-400';
    case 'poor': return 'text-red-600 dark:text-red-400';
  }
}

function qualityBg(quality: 'excellent' | 'good' | 'poor'): string {
  switch (quality) {
    case 'excellent': return 'bg-emerald-500/10 border-emerald-200 dark:border-emerald-800';
    case 'good': return 'bg-amber-500/10 border-amber-200 dark:border-amber-800';
    case 'poor': return 'bg-red-500/10 border-red-200 dark:border-red-800';
  }
}

function scoreColor(score: number): string {
  if (score > 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

// ─── Semicircle Gauge SVG ───────────────────────────────────────────────────────

function SemicircleGauge({ score, size = 80 }: { score: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const centerX = size / 2;
  const centerY = size / 2 + radius / 2;
  const arcLength = Math.PI * radius;

  // Clamp score
  const clampedScore = Math.max(0, Math.min(100, score));

  // Arc sweep (0 = left, π = right for semicircle)
  const angle = Math.PI * (1 - clampedScore / 100);

  // Calculate arc endpoint
  const startX = centerX - radius;
  const startY = centerY;
  const endX = centerX - radius * Math.cos(angle);
  const endY = centerY - radius * Math.sin(angle);

  const color = clampedScore > 80 ? '#10b981' : clampedScore >= 60 ? '#f59e0b' : '#ef4444';

  const largeArc = clampedScore > 50 ? 1 : 0;

  // Background semicircle path
  const bgPath = `M ${startX} ${startY} A ${radius} ${radius} 0 1 1 ${centerX + radius} ${startY}`;

  // Value arc path
  const valuePath = clampedScore > 0
    ? `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`
    : '';

  return (
    <div className="relative" style={{ width: size, height: size / 2 + 10 }}>
      <svg
        width={size}
        height={size / 2 + 10}
        viewBox={`0 0 ${size} ${size / 2 + 10}`}
      >
        {/* Background semicircle */}
        <path
          d={bgPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-muted/30"
        />
        {/* Value arc */}
        {valuePath && (
          <path
            d={valuePath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ transition: 'all 1s ease-in-out' }}
          />
        )}
        {/* Score text */}
        <text
          x={centerX}
          y={centerY - 4}
          textAnchor="middle"
          className={cn('text-sm font-bold', scoreColor(score))}
          style={{ fontSize: size * 0.16 }}
        >
          {score}
        </text>
      </svg>
    </div>
  );
}

// ─── Large Gauge for Summary ──────────────────────────────────────────────────

function LargeGauge({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <SemicircleGauge score={score} size={100} />
      <span className={cn('text-lg font-bold', scoreColor(score))}>{score}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function WifiQosMonitor() {
  const { propertyId } = usePropertyId();
  const [data, setData] = useState<QoSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<QoSUser | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchQoS = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (propertyId) params.set('propertyId', propertyId);
      const res = await fetch(`/api/wifi/qos?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        setError(null);
        setLastRefresh(new Date());
      } else {
        setError(result.error?.message || 'Failed to fetch QoS data');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchQoS();
    const interval = setInterval(fetchQoS, 10_000);
    return () => clearInterval(interval);
  }, [fetchQoS]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="font-medium">Failed to load QoS data</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={fetchQoS}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.users.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
            <Gauge className="h-10 w-10 opacity-30" />
            <p className="text-sm">No active sessions to monitor</p>
            <p className="text-xs">QoS metrics will appear when users connect to the WiFi network</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { users, summary, timestamp } = data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">QoS Monitor</span>
          <Badge variant="outline" className="text-xs">{users.length} users</Badge>
          {lastRefresh && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchQoS}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Gauge className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Avg Score</p>
              <p className={cn('text-lg font-bold', scoreColor(summary.avgScore))}>
                {summary.avgScore}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wifi className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Excellent</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {summary.excellentCount}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Signal className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Good</p>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {summary.goodCount}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Poor</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">
                {summary.poorCount}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* QoS Alerts */}
      {summary.alertUsers > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              QoS Alerts
              <Badge variant="destructive" className="text-xs">{summary.alertUsers}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {summary.alerts.map((alert) => (
                <div
                  key={alert.username}
                  className="flex items-center gap-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-3 py-2"
                >
                  <span className="text-xs font-bold text-red-600 dark:text-red-400 w-8">
                    {alert.score}
                  </span>
                  <span className="text-sm font-medium flex-1 min-w-0 truncate">
                    {alert.username}
                  </span>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>L:{alert.latency}ms</span>
                    <span>J:{alert.jitter}ms</span>
                    <span>PL:{alert.packetLoss}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User QoS Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">User Quality Scores</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
          <div className="max-h-96 overflow-x-auto overflow-y-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Quality</TableHead>
                  <TableHead className="text-xs">Username</TableHead>
                  <TableHead className="text-xs text-right">Score</TableHead>
                  <TableHead className="text-xs text-right hidden md:table-cell">Latency</TableHead>
                  <TableHead className="text-xs text-right hidden md:table-cell">Jitter</TableHead>
                  <TableHead className="text-xs text-right hidden lg:table-cell">Packet Loss</TableHead>
                  <TableHead className="text-xs text-right hidden lg:table-cell">Down</TableHead>
                  <TableHead className="text-xs text-right hidden lg:table-cell">Up</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.username}
                    className={cn(
                      'cursor-pointer transition-colors',
                      user.quality === 'excellent' && 'hover:bg-emerald-50 dark:hover:bg-emerald-950/10',
                      user.quality === 'good' && 'hover:bg-amber-50 dark:hover:bg-amber-950/10',
                      user.quality === 'poor' && 'hover:bg-red-50 dark:hover:bg-red-950/10',
                    )}
                    onClick={() => setSelectedUser(user)}
                  >
                    <TableCell>
                      <SemicircleGauge score={user.qosScore} size={40} />
                    </TableCell>
                    <TableCell className="text-sm font-medium">{user.username}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs font-mono',
                          qualityColor(user.quality),
                          user.quality === 'poor' && 'border-red-300 dark:border-red-700',
                          user.quality === 'good' && 'border-amber-300 dark:border-amber-700',
                          user.quality === 'excellent' && 'border-emerald-300 dark:border-emerald-700',
                        )}
                      >
                        {user.qosScore}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono hidden md:table-cell">
                      {user.latency}ms
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono hidden md:table-cell">
                      {user.jitter}ms
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono hidden lg:table-cell">
                      {user.packetLoss}%
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono hidden lg:table-cell">
                      {formatBps(user.bandwidthDown)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono hidden lg:table-cell">
                      {formatBps(user.bandwidthUp)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                      {formatDuration(user.sessionTime)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              QoS Details — {selectedUser?.username}
            </DialogTitle>
            <DialogDescription>
              Detailed quality metrics for this user&apos;s session
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              {/* Large Gauge */}
              <div className="flex justify-center py-2">
                <LargeGauge
                  score={selectedUser.qosScore}
                  label={selectedUser.quality.charAt(0).toUpperCase() + selectedUser.quality.slice(1)}
                />
              </div>

              <Separator />

              {/* Metric Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="p-1.5 rounded bg-amber-500/10">
                    <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Latency</p>
                    <p className="text-sm font-bold font-mono">{selectedUser.latency}ms</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="p-1.5 rounded bg-amber-500/10">
                    <Activity className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Jitter</p>
                    <p className="text-sm font-bold font-mono">{selectedUser.jitter}ms</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="p-1.5 rounded bg-red-500/10">
                    <Signal className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Packet Loss</p>
                    <p className="text-sm font-bold font-mono">{selectedUser.packetLoss}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="p-1.5 rounded bg-primary/10">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Session Time</p>
                    <p className="text-sm font-bold">{formatDuration(selectedUser.sessionTime)}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Bandwidth Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="p-1.5 rounded bg-primary/10">
                    <Download className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Download</p>
                    <p className="text-sm font-bold font-mono">{formatBps(selectedUser.bandwidthDown)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="p-1.5 rounded bg-amber-500/10">
                    <Upload className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Upload</p>
                    <p className="text-sm font-bold font-mono">{formatBps(selectedUser.bandwidthUp)}</p>
                  </div>
                </div>
              </div>

              {/* Session Info */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">IP:</span> {selectedUser.framedIpAddress || '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">MAC:</span> {selectedUser.callingStationId || '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">NAS:</span> {selectedUser.nasIpAddress || '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Started:</span>{' '}
                  {selectedUser.sessionStart
                    ? new Date(selectedUser.sessionStart).toLocaleString()
                    : '—'}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
