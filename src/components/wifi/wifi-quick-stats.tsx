'use client';

/**
 * WiFi Dashboard Quick Stats Widget
 *
 * Shows at the top of the WiFi Access page with:
 * - Live connection count with animation
 * - Bandwidth utilization gauge
 * - Top 5 users by data usage (mini bar chart)
 * - Alert summary
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Wifi,
  WifiOff,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  AlertTriangle,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  Radio,
  ShieldAlert,
  Gauge,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface QuickStatsData {
  totalActive: number;
  peakToday: number;
  totalDownload: number;
  totalUpload: number;
  alerts: Array<{ id: string; type: string; message: string; severity: 'critical' | 'warning' | 'info' }>;
  topUsers: Array<{ username: string; dataUsed: number; sessionTime: number }>;
  bandwidthUtilization: number; // 0-100 percentage
  avgResponseTime: number; // ms
}

const DEFAULT_STATS: QuickStatsData = {
  totalActive: 0,
  peakToday: 0,
  totalDownload: 0,
  totalUpload: 0,
  alerts: [],
  topUsers: [],
  bandwidthUtilization: 0,
  avgResponseTime: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = display;
    const diff = value - start;
    if (diff === 0) return;
    const steps = 30;
    const stepTime = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (step >= steps) clearInterval(timer);
    }, stepTime);
    return () => clearInterval(timer);
  }, [value, duration, display]);

  return <span className="tabular-nums">{display}</span>;
}

function BandwidthGauge({ value }: { value: number }) {
  const getColor = (v: number) => {
    if (v < 50) return 'bg-emerald-500';
    if (v < 75) return 'bg-amber-500';
    return 'bg-red-500';
  };
  const getGlowColor = (v: number) => {
    if (v < 50) return 'shadow-emerald-500/30';
    if (v < 75) return 'shadow-amber-500/30';
    return 'shadow-red-500/30';
  };

  return (
    <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-1000 ease-out shadow-sm',
          getColor(value),
          getGlowColor(value)
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
      {value >= 75 && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
      )}
    </div>
  );
}

function getSeverityStyle(severity: string) {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400';
    case 'warning':
      return 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400';
    default:
      return 'bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-400';
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WifiQuickStats() {
  const [stats, setStats] = useState<QuickStatsData>(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [pulseKey, setPulseKey] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/wifi/radius?action=live-sessions-stats');
      const data = await res.json();
      if (data.success && data.data) {
        const d = data.data;
        setStats(prev => ({
          ...prev,
          totalActive: d.totalActive ?? prev.totalActive,
          peakToday: d.peakToday ?? prev.peakToday,
          totalDownload: d.totalDownload ?? prev.totalDownload,
          totalUpload: d.totalUpload ?? prev.totalUpload,
          alerts: d.alerts ?? prev.alerts,
          topUsers: d.topUsers ?? prev.topUsers,
          bandwidthUtilization: d.bandwidthUtilization ?? prev.bandwidthUtilization,
          avgResponseTime: d.avgResponseTime ?? prev.avgResponseTime,
        }));
        setPulseKey(k => k + 1);
      }
    } catch {
      // non-critical — keep previous state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const maxTopUserBytes = useMemo(() => {
    if (stats.topUsers.length === 0) return 1;
    return Math.max(...stats.topUsers.map(u => u.dataUsed), 1);
  }, [stats.topUsers]);

  const totalData = stats.totalDownload + stats.totalUpload;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Live Connections */}
      <Card className="relative overflow-hidden group hover:shadow-md transition-shadow duration-300">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3 pointer-events-none" />
        <CardContent className="p-4 relative">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="p-2.5 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <Wifi className="h-5 w-5 text-primary" />
                </div>
                {/* Animated pulse ring */}
                <span key={pulseKey} className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-40" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active Users</p>
                <p className="text-2xl font-bold text-primary">
                  <AnimatedCounter value={stats.totalActive} />
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                peak: {stats.peakToday}
              </Badge>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                Live
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Bandwidth Utilization */}
      <Card className="relative overflow-hidden group hover:shadow-md transition-shadow duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-amber-500/3 pointer-events-none" />
        <CardContent className="p-4 relative space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/15 transition-colors">
                <Gauge className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Bandwidth Util.</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {stats.bandwidthUtilization > 0 ? `${Math.round(stats.bandwidthUtilization)}%` : '—'}
                </p>
              </div>
            </div>
          </div>
          <BandwidthGauge value={stats.bandwidthUtilization} />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <ArrowDownToLine className="h-2.5 w-2.5" />
              {formatBytes(stats.totalDownload)}
            </div>
            <div className="flex items-center gap-1">
              <ArrowUpFromLine className="h-2.5 w-2.5" />
              {formatBytes(stats.totalUpload)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Top 5 Users */}
      <Card className="relative overflow-hidden group hover:shadow-md transition-shadow duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-cyan-500/3 pointer-events-none" />
        <CardContent className="p-4 relative space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/15 transition-colors">
              <Activity className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Top Users by Usage</p>
              <p className="text-sm font-semibold text-foreground">{formatBytes(totalData)} total</p>
            </div>
          </div>
          {stats.topUsers.length > 0 ? (
            <div className="space-y-1.5">
              {stats.topUsers.slice(0, 5).map((user, idx) => (
                <div key={`${user.username}_${idx}`} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground w-3">{idx + 1}</span>
                  <span className="text-xs font-medium truncate flex-1">{user.username}</span>
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-700"
                      style={{ width: `${Math.min(100, (user.dataUsed / maxTopUserBytes) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground w-12 text-right">
                    {formatBytes(user.dataUsed)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-2">No data yet</div>
          )}
        </CardContent>
      </Card>

      {/* 4. Alerts Summary */}
      <Card className="relative overflow-hidden group hover:shadow-md transition-shadow duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/3 pointer-events-none" />
        <CardContent className="p-4 relative space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 group-hover:bg-rose-500/15 transition-colors">
              {stats.alerts.length > 0 ? (
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Alerts</p>
              <p className={cn(
                'text-2xl font-bold',
                stats.alerts.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              )}>
                {stats.alerts.length}
              </p>
            </div>
          </div>
          {stats.alerts.length > 0 ? (
            <div className="space-y-1.5 max-h-20 overflow-y-auto">
              {stats.alerts.slice(0, 3).map((alert, idx) => (
                <div
                  key={`${alert.id}_${idx}`}
                  className={cn(
                    'flex items-start gap-2 p-1.5 rounded-md border text-[10px]',
                    getSeverityStyle(alert.severity)
                  )}
                >
                  <Radio className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                  <span className="truncate">{alert.message}</span>
                </div>
              ))}
              {stats.alerts.length > 3 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  +{stats.alerts.length - 3} more
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 rounded-md p-2 border border-emerald-500/10">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>All systems normal</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default WifiQuickStats;
