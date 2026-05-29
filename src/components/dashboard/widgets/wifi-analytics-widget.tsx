'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Wifi,
  Activity,
  TrendingUp,
  TrendingDown,
  Shield,
  Clock,
  ArrowUp,
  ArrowDown,
  Users,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Data Types ──────────────────────────────────────────────────────

interface KPIMetric {
  label: string;
  value: string;
  sublabel: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  lightBg: string;
  textColor: string;
}

interface TrendDataPoint {
  hour: string;
  sessions: number;
}

interface PlanDistribution {
  name: string;
  users: number;
  percentage: number;
  color: string;
  gradient: string;
}

interface AuthEvent {
  id: string;
  type: 'accept' | 'reject';
  username: string;
  time: string;
  device: string;
}

// ─── Animation Variants ───────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

// ─── SVG Line Chart Component ─────────────────────────────────────────

function SessionTrendChart({ data }: { data: TrendDataPoint[] }) {
  const chartWidth = 480;
  const chartHeight = 140;
  const paddingX = 32;
  const paddingY = 24;
  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingY * 2;

  const maxSessions = useMemo(() => Math.max(...data.map(d => d.sessions), 1), [data]);

  const points = useMemo(() => {
    return data.map((d, i) => ({
      x: paddingX + (i / (data.length - 1)) * innerWidth,
      y: paddingY + innerHeight - (d.sessions / maxSessions) * innerHeight,
    }));
  }, [data, maxSessions, innerWidth, innerHeight, paddingX, paddingY]);

  const linePath = useMemo(() => {
    return points
      .map((p, i) => {
        if (i === 0) return `M ${p.x} ${p.y}`;
        const prev = points[i - 1];
        const cpx1 = prev.x + (p.x - prev.x) * 0.4;
        const cpx2 = prev.x + (p.x - prev.x) * 0.6;
        return `C ${cpx1} ${prev.y}, ${cpx2} ${p.y}, ${p.x} ${p.y}`;
      })
      .join(' ');
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    return `${linePath} L ${lastPoint.x} ${paddingY + innerHeight} L ${firstPoint.x} ${paddingY + innerHeight} Z`;
  }, [linePath, points, paddingX, paddingY, innerHeight]);

  // Y-axis labels
  const yLabels = useMemo(() => {
    const labels = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const value = Math.round((maxSessions / steps) * i);
      const y = paddingY + innerHeight - (i / steps) * innerHeight;
      labels.push({ value, y });
    }
    return labels;
  }, [maxSessions, innerHeight, paddingY]);

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Gradient fill under the line */}
          <linearGradient id="wifiAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.3} />
            <stop offset="50%" stopColor="#10b981" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
          </linearGradient>
          {/* Line gradient */}
          <linearGradient id="wifiLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="50%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
          {/* Glow filter */}
          <filter id="wifiGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {yLabels.map((label, i) => (
          <g key={i}>
            <line
              x1={paddingX}
              y1={label.y}
              x2={chartWidth - paddingX}
              y2={label.y}
              stroke="currentColor"
              strokeOpacity={0.06}
              strokeWidth={1}
              className="text-foreground"
            />
            <text
              x={paddingX - 6}
              y={label.y + 3}
              textAnchor="end"
              className="fill-muted-foreground/40"
              fontSize="9"
              fontFamily="monospace"
            >
              {label.value}
            </text>
          </g>
        ))}

        {/* Area fill with animation */}
        <motion.path
          d={areaPath}
          fill="url(#wifiAreaGradient)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.5 }}
        />

        {/* Line with draw-in animation */}
        <motion.path
          d={linePath}
          fill="none"
          stroke="url(#wifiLineGradient)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#wifiGlow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: 'easeInOut', delay: 0.3 }}
        />

        {/* Data points */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="#10b981"
            stroke="white"
            strokeWidth={1.5}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 + i * 0.08 }}
            className="group-hover:r-4 transition-all"
          />
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          const x = paddingX + (i / (data.length - 1)) * innerWidth;
          return (
            <text
              key={i}
              x={x}
              y={chartHeight - 4}
              textAnchor="middle"
              className="fill-muted-foreground/40"
              fontSize="8"
              fontFamily="monospace"
            >
              {d.hour}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── KPI Mini Card ────────────────────────────────────────────────────

function KPIMiniCard({ metric, index }: { metric: KPIMetric; index: number }) {
  const Icon = metric.icon;
  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
      whileHover={{ scale: 1.03, y: -2 }}
      className={cn(
        "relative p-3 rounded-xl cursor-default transition-all duration-300",
        "bg-card border border-border/40 overflow-hidden group",
        "hover:shadow-md hover:border-border/60"
      )}
    >
      {/* Subtle hover bg */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
          metric.lightBg
        )}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1.5">
          <div
            className={cn(
              "h-7 w-7 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-sm",
              metric.iconBg
            )}
          >
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
          {TrendIcon && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
                metric.trend === 'up' &&
                  "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50",
                metric.trend === 'down' &&
                  "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/50"
              )}
            >
              <TrendIcon className="h-2.5 w-2.5" />
              {metric.trendValue}
            </span>
          )}
        </div>
        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{metric.label}</p>
        <p className={cn("text-lg font-extrabold tabular-nums", metric.textColor)}>
          {metric.value}
        </p>
        <p className="text-[9px] text-muted-foreground/60 mt-0.5">{metric.sublabel}</p>
      </div>
    </motion.div>
  );
}

// ─── Plan Distribution Bar ────────────────────────────────────────────

function PlanBar({ plan, index }: { plan: PlanDistribution; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 + 0.5, ease: 'easeOut' }}
      className="space-y-1"
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <div className={cn("h-2 w-2 rounded-full", plan.color)} />
          <span className="font-medium text-foreground/80">{plan.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground/60 text-[10px] tabular-nums">
            <Users className="h-2.5 w-2.5 inline mr-0.5" />
            {plan.users}
          </span>
          <span className="text-[10px] font-bold tabular-nums text-muted-foreground/50">
            {plan.percentage}%
          </span>
        </div>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden bg-muted/40">
        <motion.div
          className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", plan.gradient)}
          initial={{ width: 0 }}
          animate={{ width: `${plan.percentage}%` }}
          transition={{
            duration: 0.8,
            delay: index * 0.1 + 0.7,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      </div>
    </motion.div>
  );
}

// ─── Auth Event Row ───────────────────────────────────────────────────

function AuthEventRow({ event, index }: { event: AuthEvent; index: number }) {
  const isAccept = event.type === 'accept';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 + 0.6 }}
      className={cn(
        "flex items-center gap-2.5 py-2 px-2.5 rounded-lg transition-all duration-200",
        "hover:bg-muted/30 cursor-default group"
      )}
    >
      {/* Status dot */}
      <div className="relative flex-shrink-0">
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            isAccept ? "bg-emerald-500" : "bg-red-500"
          )}
        />
        {isAccept && (
          <div className="absolute inset-0 h-2 w-2 rounded-full bg-emerald-500 animate-ping opacity-30" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground truncate">
            {event.username}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-[8px] h-4 px-1 font-bold",
              isAccept
                ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50"
                : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/50"
            )}
          >
            {isAccept ? 'ACCEPT' : 'REJECT'}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground/50 flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {event.time}
          </span>
          <span className="text-[10px] text-muted-foreground/40 truncate">
            {event.device}
          </span>
        </div>
      </div>

      {/* Shield icon */}
      <Shield
        className={cn(
          "h-3.5 w-3.5 flex-shrink-0 opacity-40 group-hover:opacity-70 transition-opacity",
          isAccept ? "text-emerald-500" : "text-red-500"
        )}
      />
    </motion.div>
  );
}

// ─── Format helpers ──────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(1)} ${sizes[i]}`;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// ─── Main WiFi Analytics Widget ───────────────────────────────────────

export function WiFiAnalyticsWidget() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API data state
  const [activeSessionsCount, setActiveSessionsCount] = useState(0);
  const [totalDataUsed, setTotalDataUsed] = useState(0);
  const [avgDuration, setAvgDuration] = useState(0);
  const [authSuccessRate, setAuthSuccessRate] = useState(0);
  const [authTotal, setAuthTotal] = useState(0);
  const [authRejects, setAuthRejects] = useState(0);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [planDistribution, setPlanDistribution] = useState<PlanDistribution[]>([]);
  const [authEvents, setAuthEvents] = useState<AuthEvent[]>([]);

  const fetchWiFiData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionsRes, identityRes] = await Promise.allSettled([
        fetch('/api/wifi/sessions?status=active&limit=500'),
        fetch('/api/wifi/identity-logs?limit=5'),
      ]);

      // Parse sessions data
      if (sessionsRes.status === 'fulfilled' && sessionsRes.value.ok) {
        const sessionsJson = await sessionsRes.value.json();
        if (sessionsJson.success) {
          const summary = sessionsJson.summary;
          setActiveSessionsCount(summary?.count || 0);

          const dataBytes = Number(summary?.totalDataUsed || 0);
          setTotalDataUsed(dataBytes);

          const totalDur = Number(summary?.totalDuration || 0);
          const count = summary?.count || 1;
          setAvgDuration(Math.round(totalDur / count));

          // Build hourly trend from session data
          const sessions = sessionsJson.data || [];
          const hourlyBuckets = new Map<string, number>();
          for (const s of sessions) {
            if (s.startTime) {
              const start = new Date(s.startTime);
              const hourKey = `${String(start.getHours()).padStart(2, '0')}:00`;
              hourlyBuckets.set(hourKey, (hourlyBuckets.get(hourKey) || 0) + 1);
            }
          }

          const trendPoints: TrendDataPoint[] = [];
          const now = new Date();
          for (let h = 0; h < 24; h += 2) {
            const key = `${String(h).padStart(2, '0')}:00`;
            trendPoints.push({
              hour: key,
              sessions: hourlyBuckets.get(key) || 0,
            });
          }
          setTrendData(trendPoints);
        }
      }

      // Parse identity logs (auth events)
      if (identityRes.status === 'fulfilled' && identityRes.value.ok) {
        const identityJson = await identityRes.value.json();
        if (identityJson.success) {
          const logs = identityJson.data || [];
          const events: AuthEvent[] = logs.slice(0, 5).map((log: Record<string, unknown>, idx: number) => ({
            id: `auth-${idx}`,
            type: (log.verificationStatus === 'verified' ? 'accept' : 'reject') as 'accept' | 'reject',
            username: (log.username as string) || 'unknown',
            time: timeAgo(log.createdAt as string),
            device: (log.deviceType as string) || (log.macAddress as string) || 'Unknown',
          }));
          setAuthEvents(events);
        }
      }

      // Fetch plans for distribution
      try {
        const plansRes = await fetch('/api/wifi/plans?limit=100');
        if (plansRes.ok) {
          const plansJson = await plansRes.json();
          if (plansJson.success) {
            const plans = plansJson.data || [];
            const totalUsers = plans.reduce((sum: number, p: Record<string, unknown>) => {
              return sum + ((p as Record<string, unknown>)._count?.sessions || 0);
            }, 0);

            if (totalUsers > 0) {
              const gradients = [
                'from-teal-500 to-emerald-400',
                'from-emerald-500 to-teal-400',
                'from-amber-500 to-yellow-400',
                'from-cyan-500 to-teal-400',
                'from-orange-400 to-amber-300',
                'from-rose-500 to-pink-400',
              ];
              const colors = [
                'bg-teal-500',
                'bg-emerald-500',
                'bg-amber-500',
                'bg-cyan-500',
                'bg-orange-400',
                'bg-rose-500',
              ];

              const dist: PlanDistribution[] = plans.slice(0, 6).map((p: Record<string, unknown>, idx: number) => {
                const count = (p as Record<string, unknown>)._count?.sessions || 0;
                const pct = Math.round((count / totalUsers) * 100);
                return {
                  name: (p.name as string) || `Plan ${idx + 1}`,
                  users: count,
                  percentage: pct,
                  color: colors[idx % colors.length],
                  gradient: gradients[idx % gradients.length],
                };
              });
              setPlanDistribution(dist);
            }
          }
        }
      } catch {
        // Plans data is supplementary, ignore failures
      }

      // Derive auth stats from data
      const totalAuths = authEvents.length || 1;
      const accepts = authEvents.filter(e => e.type === 'accept').length;
      setAuthTotal(totalAuths);
      setAuthRejects(totalAuths - accepts);
      setAuthSuccessRate(totalAuths > 0 ? Math.round((accepts / totalAuths) * 1000) / 10 : 0);

    } catch (err) {
      setError('Failed to load WiFi analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchWiFiData, 30000);
    return () => clearInterval(interval);
  }, [fetchWiFiData]);

  // ─── Build KPI metrics from API data ──────────────────────────────
  const kpiMetrics = useMemo<KPIMetric[]>(() => [
    {
      label: 'Active Sessions',
      value: String(activeSessionsCount),
      sublabel: 'Connected now',
      trend: 'up',
      trendValue: 'Live',
      icon: Wifi,
      gradient: 'from-teal-400 to-emerald-500',
      iconBg: 'from-teal-400 to-emerald-500',
      lightBg: 'bg-teal-50/80 dark:bg-teal-950/30',
      textColor: 'text-teal-700 dark:text-teal-400',
    },
    {
      label: 'Total Data Usage',
      value: formatBytes(totalDataUsed),
      sublabel: 'Across all sessions',
      trend: 'neutral',
      trendValue: '',
      icon: Activity,
      gradient: 'from-emerald-400 to-teal-500',
      iconBg: 'from-emerald-400 to-teal-500',
      lightBg: 'bg-emerald-50/80 dark:bg-emerald-950/30',
      textColor: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: 'Avg Session Duration',
      value: formatDuration(avgDuration),
      sublabel: 'Per active session',
      trend: 'neutral',
      trendValue: '',
      icon: Clock,
      gradient: 'from-amber-400 to-orange-500',
      iconBg: 'from-amber-400 to-orange-500',
      lightBg: 'bg-amber-50/80 dark:bg-amber-950/30',
      textColor: 'text-amber-700 dark:text-amber-400',
    },
    {
      label: 'Auth Success Rate',
      value: `${authSuccessRate}%`,
      sublabel: `${authRejects} rejects out of ${authTotal}`,
      trend: authSuccessRate >= 90 ? 'up' : 'down',
      trendValue: `${authSuccessRate >= 90 ? '+' : ''}${authSuccessRate - 90 >= 0 ? '' : ''}${Math.abs(authSuccessRate - 90).toFixed(1)}%`,
      icon: Shield,
      gradient: 'from-teal-500 to-cyan-500',
      iconBg: 'from-teal-500 to-cyan-500',
      lightBg: 'bg-teal-50/80 dark:bg-teal-950/30',
      textColor: 'text-teal-700 dark:text-teal-400',
    },
  ], [activeSessionsCount, totalDataUsed, avgDuration, authSuccessRate, authRejects, authTotal]);

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Card className="border border-red-200 dark:border-red-900/50 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-red-400 to-orange-400 shadow-sm">
                  <Wifi className="h-3.5 w-3.5 text-white" />
                </div>
                WiFi Analytics
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-8 gap-3 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchWiFiData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <Card className="border border-border/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
        {/* Gradient top bar */}
        <div className="h-[2px] bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500" />

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 shadow-sm">
                <Wifi className="h-3.5 w-3.5 text-white" />
              </div>
              WiFi Analytics
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[10px] font-semibold rounded-full border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400"
              >
                <span className="relative flex h-1.5 w-1.5 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-500 opacity-50" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-500" />
                </span>
                Live
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pb-5">
          {/* Loading skeleton */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* ── Key Metrics Row ── */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 lg:grid-cols-4 gap-2.5"
              >
                {kpiMetrics.map((metric, i) => (
                  <motion.div key={metric.label} variants={itemVariants}>
                    <KPIMiniCard metric={metric} index={i} />
                  </motion.div>
                ))}
              </motion.div>

              {/* ── Session Trend Chart ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    <span className="text-xs font-semibold text-foreground">Session Trend</span>
                    <span className="text-[10px] text-muted-foreground/50">Last 24h</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
                    <span className="flex items-center gap-1">
                      <ArrowDown className="h-2.5 w-2.5 text-teal-500" />
                      Download
                    </span>
                    <span className="flex items-center gap-1">
                      <ArrowUp className="h-2.5 w-2.5 text-emerald-500" />
                      Upload
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-border/30 bg-muted/10 p-2.5 overflow-hidden">
                  <SessionTrendChart data={trendData} />
                </div>
              </div>

              {/* ── Bottom Row: Plans + Auth ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Plans Distribution */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-semibold text-foreground">Plan Distribution</span>
                  </div>
                  {planDistribution.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      No plan data available
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {planDistribution.map((plan, i) => (
                        <PlanBar key={plan.name} plan={plan} index={i} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Auth Activity */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                      <span className="text-xs font-semibold text-foreground">Auth Activity</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                      {authEvents.filter(e => e.type === 'accept').length}/{authEvents.length} accepted
                    </span>
                  </div>
                  {authEvents.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      No auth events yet
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent pr-1 space-y-0.5 rounded-lg border border-border/20 bg-muted/5">
                      {authEvents.map((event, i) => (
                        <AuthEventRow key={event.id} event={event} index={i} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Footer ── */}
          <div className="flex items-center justify-between pt-2 border-t border-border/20">
            <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums">
              Updated {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-500 opacity-40" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-500" />
              </span>
              Auto-refresh: 30s
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default WiFiAnalyticsWidget;
