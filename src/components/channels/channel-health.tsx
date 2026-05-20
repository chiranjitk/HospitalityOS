'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Ghost,
  HeartPulse,
  History,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  WifiOff,
  Zap,
} from 'lucide-react';

// ============================
// Types
// ============================

interface ChannelMeta {
  id: string;
  name: string;
  displayName: string;
  logo: string;
  color: string;
  region: string;
  type: string;
  priority: string;
}

interface ChannelHealthEntry {
  connectionId: string;
  channel: string;
  displayName: string;
  status: string;
  autoSync: boolean;
  syncInterval: number;
  lastSyncAt: string | null;
  channelMeta: ChannelMeta | null;
  health: {
    score: number;
    status: 'healthy' | 'warning' | 'critical' | 'offline';
    uptime7d: number;
    successRate24h: number | null;
    successRate7d: number | null;
    avgSyncTimeMs: number | null;
    lastSuccessAt: string | null;
    lastError: { message: string; time: string } | null;
    retryCount: number;
    deadLetterCount: number;
    syncs24h: { success: number; failed: number };
    syncs7d: { success: number; failed: number };
  };
}

interface Alert {
  severity: 'critical' | 'warning';
  channel: string;
  channelId: string;
  connectionId: string;
  issue: string;
  time: string | null;
  suggestedAction: string;
}

interface SyncTimelineEntry {
  id: string;
  channel: string;
  channelDisplayName: string;
  connectionId: string;
  syncType: string;
  direction: string;
  status: string;
  errorMessage: string | null;
  attemptCount: number;
  createdAt: string;
}

interface HealthHistoryEntry {
  connectionId: string;
  channel: string;
  displayName: string;
  successRate7d: number | null;
  totalSyncs7d: number;
  dailyAvg: number;
}

interface ChannelHealthData {
  channels: ChannelHealthEntry[];
  overall: {
    totalChannels: number;
    healthy: number;
    warning: number;
    critical: number;
    offline: number;
    averageUptime: number;
    totalErrors24h: number;
    allSystemsHealthy: boolean;
  };
  alerts: Alert[];
  syncTimeline: SyncTimelineEntry[];
  healthHistory: HealthHistoryEntry[];
}

// ============================
// Helpers
// ============================

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  if (diff < 0) return 'Just now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'warning':
      return 'text-amber-600 dark:text-amber-400';
    case 'critical':
      return 'text-red-600 dark:text-red-400';
    case 'offline':
      return 'text-gray-500 dark:text-gray-400';
    default:
      return 'text-gray-500';
  }
}

function statusBg(status: string): string {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800';
    case 'warning':
      return 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800';
    case 'critical':
      return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800';
    case 'offline':
      return 'bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700';
    default:
      return 'bg-gray-50 border-gray-200';
  }
}

function statusBadgeVariant(status: string): 'default' | 'destructive' | 'secondary' | 'outline' {
  switch (status) {
    case 'healthy': return 'default';
    case 'warning': return 'secondary';
    case 'critical': return 'destructive';
    case 'offline': return 'outline';
    default: return 'outline';
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreStroke(score: number): string {
  if (score >= 80) return 'stroke-emerald-500';
  if (score >= 50) return 'stroke-amber-500';
  return 'stroke-red-500';
}

function scoreTrackColor(score: number): string {
  if (score >= 80) return 'bg-emerald-100 dark:bg-emerald-900/40';
  if (score >= 50) return 'bg-amber-100 dark:bg-amber-900/40';
  return 'bg-red-100 dark:bg-red-900/40';
}

// ============================
// Sub-Components
// ============================

function HealthScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={scoreTrackColor(score)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={scoreStroke(score)}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className={`absolute text-sm font-bold ${scoreColor(score)}`}>{score}</span>
    </div>
  );
}

function UptimeRing({ percent }: { percent: number }) {
  const size = 80;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const color = percent >= 95 ? 'stroke-emerald-500' : percent >= 80 ? 'stroke-amber-500' : 'stroke-red-500';
  const textColor = percent >= 95 ? 'text-emerald-600 dark:text-emerald-400' : percent >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="bg-muted"
            style={{ stroke: 'currentColor', opacity: 0.15 }}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className={color}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <span className={`absolute text-lg font-bold ${textColor}`}>{percent}%</span>
      </div>
      <span className="text-xs text-muted-foreground">Avg Uptime</span>
    </div>
  );
}

function OverallBanner({ overall }: { overall: ChannelHealthData['overall'] }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <HeartPulse className="h-5 w-5" />
            Channel Health Overview
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {overall.allSystemsHealthy
              ? 'All systems are operating normally'
              : `${overall.critical + overall.warning} issue${overall.critical + overall.warning !== 1 ? 's' : ''} detected requiring attention`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overall.allSystemsHealthy ? (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 py-1">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              All Systems Healthy
            </Badge>
          ) : (
            <Badge variant="destructive" className="py-1">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              {overall.critical + overall.warning} Issues Detected
            </Badge>
          )}
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{overall.healthy}</p>
              <p className="text-xs text-muted-foreground">Healthy</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{overall.warning}</p>
              <p className="text-xs text-muted-foreground">Warning</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{overall.critical}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <WifiOff className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{overall.offline}</p>
              <p className="text-xs text-muted-foreground">Offline</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Uptime & error summary */}
      <div className="flex flex-wrap gap-4 items-center text-sm">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Total Channels:</span>
          <span className="font-medium">{overall.totalChannels}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Errors (24h):</span>
          <span className={`font-medium ${overall.totalErrors24h > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {overall.totalErrors24h}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <UptimeRing percent={overall.averageUptime} />
      </div>
    </div>
  );
}

function ChannelHealthCard({ channel }: { channel: ChannelHealthEntry }) {
  const { health, channelMeta, displayName, status } = channel;
  const bgColor = channelMeta?.color || '#6B7280';
  const logoLetter = channelMeta?.logo || displayName.charAt(0).toUpperCase();

  return (
    <Card className={`border ${statusBg(health.status)} transition-all hover:shadow-md`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Channel logo & name */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ backgroundColor: bgColor }}
            >
              {logoLetter}
            </div>
            <div className="min-w-0">
              <h4 className="font-medium text-sm truncate">{displayName}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={statusBadgeVariant(health.status)} className="text-[10px] px-1.5 py-0 h-4">
                  {health.status}
                </Badge>
                {status === 'active' && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Zap className="h-2.5 w-2.5" />
                    {channel.autoSync ? `Auto (${channel.syncInterval}m)` : 'Manual'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Health score */}
          <HealthScoreRing score={health.score} size={52} />
        </div>

        <Separator className="my-3" />

        {/* Metrics grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Uptime (7d)</span>
            <span className={`font-medium ${statusColor(health.status)}`}>{health.uptime7d}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Success (24h)</span>
            <span className="font-medium">
              {health.successRate24h !== null ? (
                <span className={health.successRate24h >= 95 ? 'text-emerald-600 dark:text-emerald-400' : health.successRate24h >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                  {health.successRate24h}%
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Success (7d)</span>
            <span className="font-medium">
              {health.successRate7d !== null ? (
                <span className={health.successRate7d >= 95 ? 'text-emerald-600 dark:text-emerald-400' : health.successRate7d >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                  {health.successRate7d}%
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg Sync Time</span>
            <span className="font-medium">
              {health.avgSyncTimeMs ? formatDuration(health.avgSyncTimeMs) : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Sync</span>
            <span className="font-medium">{relativeTime(channel.lastSyncAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Syncs (24h)</span>
            <span className="font-medium">
              <span className="text-emerald-600 dark:text-emerald-400">{health.syncs24h.success}</span>
              <span className="text-muted-foreground mx-0.5">/</span>
              <span className="text-red-600 dark:text-red-400">{health.syncs24h.failed}</span>
            </span>
          </div>
        </div>

        {/* Warnings */}
        {(health.lastError || health.retryCount > 0 || health.deadLetterCount > 0) && (
          <>
            <Separator className="my-3" />
            <div className="space-y-1.5 text-xs">
              {health.lastError && (
                <div className="flex items-start gap-1.5 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="truncate">{health.lastError.message}</span>
                  <span className="text-muted-foreground shrink-0 ml-auto">{relativeTime(health.lastError.time)}</span>
                </div>
              )}
              {health.retryCount > 0 && (
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <RefreshCw className="h-3 w-3" />
                  <span>{health.retryCount} pending retr{health.retryCount !== 1 ? 'ies' : 'y'}</span>
                </div>
              )}
              {health.deadLetterCount > 0 && (
                <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                  <Ghost className="h-3 w-3" />
                  <span>{health.deadLetterCount} dead letter item{health.deadLetterCount !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Quick actions */}
        <Separator className="my-3" />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs flex-1 gap-1">
            <Play className="h-3 w-3" /> Sync Now
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs flex-1 gap-1">
            <Search className="h-3 w-3" /> Test
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
            <History className="h-3 w-3" /> Logs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mb-2 text-emerald-500" />
            <p className="text-sm">No active alerts</p>
            <p className="text-xs">All channels are operating normally</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alerts
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
              {alerts.length}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-80">
          <div className="px-4 pb-4 space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={`${alert.connectionId}-${alert.issue}-${i}`}
                className={`p-3 rounded-lg border text-xs ${
                  alert.severity === 'critical'
                    ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
                    : 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {alert.severity === 'critical' ? (
                        <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className="font-medium truncate">{alert.channel}</span>
                      <Badge
                        variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
                        className="text-[9px] px-1 py-0 h-3.5"
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground truncate">{alert.issue}</p>
                    <p className="mt-1 text-blue-600 dark:text-blue-400 italic">
                      <span className="font-medium">Action:</span> {alert.suggestedAction}
                    </p>
                  </div>
                  {alert.time && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {relativeTime(alert.time)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function SyncTimeline({ timeline }: { timeline: SyncTimelineEntry[] }) {
  if (timeline.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent Sync Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mb-2" />
            <p className="text-sm">No sync activity recorded</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Recent Sync Activity
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            Last {timeline.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-96">
          <div className="px-4 pb-4">
            {timeline.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 py-2.5 border-b last:border-0 border-border/50">
                <div className="mt-0.5">
                  {entry.status === 'success' ? (
                    <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                      <XIcon className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">{entry.channelDisplayName}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 capitalize">
                      {entry.syncType}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                      {entry.direction === 'outbound' ? '↑ Out' : '↓ In'}
                    </Badge>
                  </div>
                  {entry.errorMessage && (
                    <p className="text-[11px] text-red-500 dark:text-red-400 truncate mt-0.5">
                      {entry.errorMessage}
                    </p>
                  )}
                  {entry.attemptCount > 1 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Attempt {entry.attemptCount}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{relativeTime(entry.createdAt)}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function HealthHistoryPanel({ history }: { history: HealthHistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            7-Day Health History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <History className="h-8 w-8 mb-2" />
            <p className="text-sm">No history data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          7-Day Health History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-64">
          <div className="space-y-3">
            {history.map((entry) => (
              <div key={entry.connectionId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate">{entry.displayName}</span>
                    <span className={`text-xs font-bold ${entry.successRate7d && entry.successRate7d >= 95 ? 'text-emerald-600 dark:text-emerald-400' : entry.successRate7d && entry.successRate7d >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                      {entry.successRate7d !== null ? `${entry.successRate7d}%` : '—'}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        entry.successRate7d && entry.successRate7d >= 95
                          ? 'bg-emerald-500'
                          : entry.successRate7d && entry.successRate7d >= 80
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${entry.successRate7d || 0}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {entry.dailyAvg} syncs/day avg
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {entry.totalSyncs7d} total (7d)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ============================
// Main Component
// ============================

export function ChannelHealth() {
  const [data, setData] = useState<ChannelHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'healthy' | 'warning' | 'critical' | 'offline'>('all');

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/channels/health');
      if (!res.ok) throw new Error('Failed to fetch health data');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        throw new Error(json.error?.message || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channel health data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await fetchHealth();
    })();
    const interval = setInterval(async () => {
      if (!cancelled) await fetchHealth();
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchHealth]);

  const filteredChannels = data
    ? filter === 'all'
      ? data.channels
      : data.channels.filter((c) => c.health.status === filter)
    : [];

  if (loading && !data) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-64 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-56 bg-muted rounded-lg" />
              ))}
            </div>
            <div className="space-y-4">
              <div className="h-64 bg-muted rounded-lg" />
              <div className="h-64 bg-muted rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <ShieldAlert className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium mb-1">Failed to Load Health Data</h3>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={fetchHealth} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Overall Health Banner */}
      <OverallBanner overall={data.overall} />

      <Separator />

      {/* Channel Health Cards */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Channel Status
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {filteredChannels.length} of {data.channels.length}
            </Badge>
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', 'healthy', 'warning', 'critical', 'offline'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs capitalize"
                onClick={() => setFilter(f)}
              >
                {f}
                {f !== 'all' && (
                  <span className="ml-1 text-[10px] opacity-70">
                    ({data.channels.filter((c) => c.health.status === f).length})
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>

        {filteredChannels.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
              <Ghost className="h-10 w-10 mb-3" />
              <p className="text-sm font-medium">No channels matching filter</p>
              <p className="text-xs mt-1">
                {filter === 'all' ? 'No channel connections configured yet' : `No ${filter} channels found`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredChannels.map((channel) => (
              <ChannelHealthCard key={channel.connectionId} channel={channel} />
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Bottom Panels: Alerts, Timeline, History */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <AlertsPanel alerts={data.alerts} />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <SyncTimeline timeline={data.syncTimeline} />
          <HealthHistoryPanel history={data.healthHistory} />
        </div>
      </div>

      {/* Last updated */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
        <Clock className="h-3 w-3" />
        <span>Auto-refreshing every 30 seconds</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1"
          onClick={fetchHealth}
          disabled={loading}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
