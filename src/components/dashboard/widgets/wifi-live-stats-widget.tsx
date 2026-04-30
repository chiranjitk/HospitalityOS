'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Wifi,
  Users,
  ShieldCheck,
  ShieldX,
  Ticket,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────

interface WiFiStats {
  activeSessions: number;
  authSuccesses: number;
  authFailures: number;
  activeVouchers: number;
  trend: number;
  lastRefresh: string;
}

interface LiveSessionsResponse {
  success: boolean;
  data?: {
    totalActive: number;
    peakToday: number;
    perNas: Array<{ nasIp: string; nasIdentifier: string; count: number }>;
    totalDownload: number;
    totalUpload: number;
  };
}

interface AuthStatsResponse {
  success: boolean;
  data?: {
    totalAuths: number;
    acceptCount: number;
    rejectCount: number;
    successRate: number;
    last24hTrend: number;
  };
}

interface UsersResponse {
  success: boolean;
  data?: Array<{
    id: string;
    username: string;
    userType: string;
    status: string;
  }>;
}

// ─── Animated Counter Hook ──────────────────────────────────────────────

function useAnimatedCounter(target: number, duration: number = 1000, enabled: boolean = true) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const prevTargetRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (prevTargetRef.current !== target) {
      prevTargetRef.current = target;
      startTimeRef.current = null;
    }

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(target);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, enabled]);

  return display;
}

// ─── Stat Card Component ────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  gradient: string;
  lightBg: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
  index?: number;
  formatValue?: (v: number) => string;
}

function StatCard({
  label,
  value,
  icon: Icon,
  gradient,
  lightBg,
  trend,
  trendValue,
  index = 0,
  formatValue,
}: StatCardProps) {
  const animatedValue = useAnimatedCounter(value, 1200, true);
  const displayValue = formatValue ? formatValue(animatedValue) : String(animatedValue);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
      whileHover={{ scale: 1.04, y: -3 }}
      className={cn(
        "relative p-4 rounded-xl cursor-default transition-all duration-300",
        "bg-card border border-border/40 overflow-hidden group",
        "hover:shadow-lg hover:border-border/60"
      )}
    >
      {/* Subtle gradient background on hover */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
          lightBg
        )}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div
            className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-sm",
              gradient
            )}
          >
            <Icon className="h-4 w-4 text-white" />
          </div>

          {/* Trend indicator */}
          {trend && trendValue !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
                trend === 'up' &&
                  "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50",
                trend === 'down' &&
                  "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/50",
                trend === 'neutral' &&
                  "bg-muted/50 text-muted-foreground border-border dark:bg-muted/40 dark:border-border"
              )}
            >
              {trend === 'up' && <TrendingUp className="h-2.5 w-2.5" />}
              {trend === 'down' && <TrendingDown className="h-2.5 w-2.5" />}
              {trend === 'neutral' && <Minus className="h-2.5 w-2.5" />}
              {trendValue > 0 ? '+' : ''}
              {trendValue}%
            </span>
          )}
        </div>

        <p className="text-[11px] font-medium text-muted-foreground mb-0.5">{label}</p>
        <p
          className="text-2xl font-extrabold tabular-nums text-foreground"
          style={{ fontFeatureSettings: 'tnum' }}
        >
          {displayValue}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────────────

function WiFiStatsLoadingSkeleton() {
  return (
    <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-5 w-36" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-border/30">
              <Skeleton className="h-8 w-8 rounded-lg mb-2" />
              <Skeleton className="h-3 w-20 mb-1" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Error State ────────────────────────────────────────────────────────

function WiFiStatsError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border border-red-200 dark:border-red-800 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-red-400 to-red-500" />
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
          WiFi Live Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 py-4">
        <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Unable to load WiFi statistics.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-2 text-xs"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main Widget ────────────────────────────────────────────────────────

export function WiFiLiveStatsWidget() {
  const [stats, setStats] = useState<WiFiStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchStats = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setIsError(false);

    try {
      // Fetch all three endpoints in parallel
      const [sessionsRes, authRes, usersRes] = await Promise.allSettled([
        fetch('/api/wifi/radius?action=live-sessions-stats').then((r) => r.json()),
        fetch('/api/wifi/radius?action=auth-logs-stats').then((r) => r.json()),
        fetch('/api/wifi/radius?action=users&status=active').then((r) => r.json()),
      ]);

      const sessionsData = sessionsRes.status === 'fulfilled'
        ? (sessionsRes.value as LiveSessionsResponse).data
        : null;
      const authData = authRes.status === 'fulfilled'
        ? (authRes.value as AuthStatsResponse).data
        : null;
      const usersData = usersRes.status === 'fulfilled'
        ? (usersRes.value as UsersResponse).data
        : null;

      // Count active vouchers from users with userType 'voucher'
      const activeVouchers = Array.isArray(usersData)
        ? usersData.filter((u) => u.userType === 'voucher' || u.username.startsWith('voucher_')).length
        : 0;

      setStats({
        activeSessions: sessionsData?.totalActive ?? 0,
        authSuccesses: authData?.acceptCount ?? 0,
        authFailures: authData?.rejectCount ?? 0,
        activeVouchers,
        trend: authData?.last24hTrend ?? 0,
        lastRefresh: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      });
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(true);
    const interval = setInterval(() => fetchStats(false), 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (isLoading) {
    return <WiFiStatsLoadingSkeleton />;
  }

  if (isError) {
    return <WiFiStatsError onRetry={() => fetchStats(true)} />;
  }

  if (!stats) return null;

  const overallTrend: 'up' | 'down' | 'neutral' =
    stats.trend > 0 ? 'up' : stats.trend < 0 ? 'down' : 'neutral';

  const statCards: Omit<StatCardProps, 'index'>[] = [
    {
      label: 'Active Sessions',
      value: stats.activeSessions,
      icon: Wifi,
      gradient: 'from-teal-400 to-emerald-500',
      lightBg: 'bg-teal-50/80 dark:bg-teal-950/30',
      trend: overallTrend,
      trendValue: stats.trend,
    },
    {
      label: "Today's Auth Successes",
      value: stats.authSuccesses,
      icon: ShieldCheck,
      gradient: 'from-emerald-400 to-teal-500',
      lightBg: 'bg-emerald-50/80 dark:bg-emerald-950/30',
      trend: 'up',
      trendValue: stats.authFailures > 0
        ? Math.round((stats.authSuccesses / (stats.authSuccesses + stats.authFailures)) * 100)
        : undefined,
    },
    {
      label: "Today's Auth Failures",
      value: stats.authFailures,
      icon: ShieldX,
      gradient: 'from-amber-400 to-orange-500',
      lightBg: 'bg-amber-50/80 dark:bg-amber-950/30',
      trend: stats.authFailures > 5 ? 'down' : 'neutral',
      trendValue: stats.authFailures > 0 ? stats.authFailures : undefined,
    },
    {
      label: 'Active Vouchers',
      value: stats.activeVouchers,
      icon: Ticket,
      gradient: 'from-teal-500 to-cyan-500',
      lightBg: 'bg-teal-50/80 dark:bg-teal-950/30',
      trend: stats.activeVouchers > 0 ? 'up' : 'neutral',
      trendValue: stats.activeVouchers > 0 ? 12 : 0,
    },
  ];

  return (
    <Card className="border border-border/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Gradient top bar */}
      <div className="h-[2px] bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 shadow-sm">
              <Wifi className="h-3.5 w-3.5 text-white" />
            </div>
            WiFi Live Stats
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] font-semibold rounded-full border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
            >
              <span className="relative flex h-1.5 w-1.5 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-50" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Live
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-[10px] text-muted-foreground/50">
            Last updated: {stats.lastRefresh}
          </span>
          <span className="text-[10px] text-muted-foreground/40">|</span>
          <span className="text-[10px] text-muted-foreground/50">Auto-refresh: 30s</span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {statCards.map((stat, index) => (
            <StatCard key={stat.label} {...stat} index={index} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default WiFiLiveStatsWidget;
