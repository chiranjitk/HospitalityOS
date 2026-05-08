'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Mock Data Types ──────────────────────────────────────────────────

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

// ─── Main WiFi Analytics Widget ───────────────────────────────────────

export function WiFiAnalyticsWidget() {
  // Generate mock data with useMemo
  const kpiMetrics = useMemo<KPIMetric[]>(() => [
    {
      label: 'Active Sessions',
      value: '247',
      sublabel: '↑ 12 from last hour',
      trend: 'up',
      trendValue: '+8%',
      icon: Wifi,
      gradient: 'from-teal-400 to-emerald-500',
      iconBg: 'from-teal-400 to-emerald-500',
      lightBg: 'bg-teal-50/80 dark:bg-teal-950/30',
      textColor: 'text-teal-700 dark:text-teal-400',
    },
    {
      label: 'Total Data Usage',
      value: '18.4 GB',
      sublabel: '↓ 2.1 DL / ↑ 1.8 UL GB',
      trend: 'up',
      trendValue: '+15%',
      icon: Activity,
      gradient: 'from-emerald-400 to-teal-500',
      iconBg: 'from-emerald-400 to-teal-500',
      lightBg: 'bg-emerald-50/80 dark:bg-emerald-950/30',
      textColor: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: 'Avg Session Duration',
      value: '1h 34m',
      sublabel: 'Peak: 4h 12m',
      trend: 'up',
      trendValue: '+5%',
      icon: Clock,
      gradient: 'from-amber-400 to-orange-500',
      iconBg: 'from-amber-400 to-orange-500',
      lightBg: 'bg-amber-50/80 dark:bg-amber-950/30',
      textColor: 'text-amber-700 dark:text-amber-400',
    },
    {
      label: 'Auth Success Rate',
      value: '96.8%',
      sublabel: '8 rejects out of 249',
      trend: 'up',
      trendValue: '+2.1%',
      icon: Shield,
      gradient: 'from-teal-500 to-cyan-500',
      iconBg: 'from-teal-500 to-cyan-500',
      lightBg: 'bg-teal-50/80 dark:bg-teal-950/30',
      textColor: 'text-teal-700 dark:text-teal-400',
    },
  ], []);

  const trendData = useMemo<TrendDataPoint[]>(() => [
    { hour: '00:00', sessions: 82 },
    { hour: '02:00', sessions: 45 },
    { hour: '04:00', sessions: 28 },
    { hour: '06:00', sessions: 56 },
    { hour: '08:00', sessions: 134 },
    { hour: '10:00', sessions: 198 },
    { hour: '12:00', sessions: 221 },
    { hour: '14:00', sessions: 247 },
    { hour: '16:00', sessions: 235 },
    { hour: '18:00', sessions: 210 },
    { hour: '20:00', sessions: 178 },
    { hour: '22:00', sessions: 142 },
  ], []);

  const planDistribution = useMemo<PlanDistribution[]>(() => [
    { name: 'Premium Unlimited', users: 87, percentage: 35, color: 'bg-teal-500', gradient: 'from-teal-500 to-emerald-400' },
    { name: 'Standard 24h', users: 62, percentage: 25, color: 'bg-emerald-500', gradient: 'from-emerald-500 to-teal-400' },
    { name: 'Basic 4h', users: 48, percentage: 19, color: 'bg-amber-500', gradient: 'from-amber-500 to-yellow-400' },
    { name: 'Enterprise', users: 32, percentage: 13, color: 'bg-cyan-500', gradient: 'from-cyan-500 to-teal-400' },
    { name: 'Guest Free', users: 18, percentage: 8, color: 'bg-orange-400', gradient: 'from-orange-400 to-amber-300' },
  ], []);

  const authEvents = useMemo<AuthEvent[]>(() => [
    { id: '1', type: 'accept', username: 'guest_3021', time: '2m ago', device: 'iPhone 15 Pro' },
    { id: '2', type: 'accept', username: 'voucher_A7F2', time: '4m ago', device: 'Samsung Galaxy S24' },
    { id: '3', type: 'reject', username: 'unknown_8842', time: '7m ago', device: 'Unknown Device' },
    { id: '4', type: 'accept', username: 'guest_1847', time: '9m ago', device: 'MacBook Air M3' },
    { id: '5', type: 'accept', username: 'enterprise_cfo', time: '12m ago', device: 'iPad Pro 12"' },
  ], []);

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
              <div className="space-y-2.5">
                {planDistribution.map((plan, i) => (
                  <PlanBar key={plan.name} plan={plan} index={i} />
                ))}
              </div>
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
              <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent pr-1 space-y-0.5 rounded-lg border border-border/20 bg-muted/5">
                {authEvents.map((event, i) => (
                  <AuthEventRow key={event.id} event={event} index={i} />
                ))}
              </div>
            </div>
          </div>

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
