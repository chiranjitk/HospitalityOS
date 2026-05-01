'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  Target,
  Users,
  DollarSign,
  Clock,
  Star,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardApiResponse {
  success: boolean;
  data: {
    stats: {
      occupancy: {
        today: number;
        thisWeek: number;
        thisMonth: number;
        change: number;
      };
      revenue: {
        today: number;
        thisWeek: number;
        thisMonth: number;
        change: number;
      };
      guests: {
        checkedIn: number;
        arriving: number;
        departing: number;
        total: number;
      };
      pendingServiceRequests?: number;
    };
  };
}

interface MetricBreakdown {
  key: string;
  label: string;
  score: number;
  weight: number;
  icon: React.ElementType;
  colorClass: string;
  gradientFrom: string;
  gradientTo: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

interface PerformanceData {
  overallScore: number;
  metrics: MetricBreakdown[];
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map overall score to a colour tier. */
function getScoreTier(score: number): 'good' | 'medium' | 'poor' {
  if (score >= 70) return 'good';
  if (score >= 40) return 'medium';
  return 'poor';
}

/** Derive a human-readable tier label from score. */
function getScoreLabel(t: ReturnType<typeof useTranslations>, score: number): string {
  if (score >= 90) return t('gradeExceptional');
  if (score >= 70) return t('gradeExcellent');
  if (score >= 40) return t('gradeGood');
  return t('gradeBelowAverage');
}

/** Compute per-metric scores from raw API data. */
function computeMetrics(
  t: ReturnType<typeof useTranslations>,
  stats: DashboardApiResponse['data']['stats'],
): MetricBreakdown[] {
  const totalRooms = 12; // assumed total rooms for occupancy %
  const occupancyRate = Math.min(100, Math.round((stats.occupancy.today / totalRooms) * 100));
  const revenueTarget = Math.min(
    100,
    Math.round(
      stats.revenue.today > 120000
        ? 95
        : stats.revenue.today > 80000
          ? 82
          : stats.revenue.today > 40000
            ? 65
            : stats.revenue.today > 15000
              ? 45
              : 25,
    ),
  );
  const guestSatisfaction = 86; // derived from recent reviews (simulated)
  const pendingRequests = stats.pendingServiceRequests ?? 2;
  const serviceResponse =
    pendingRequests <= 1
      ? 95
      : pendingRequests <= 3
        ? 78
        : pendingRequests <= 6
          ? 55
          : 30;

  return [
    {
      key: 'occupancy',
      label: t('occupancy'),
      score: occupancyRate,
      weight: 40,
      icon: Users,
      colorClass: 'text-teal-600 dark:text-teal-400',
      gradientFrom: 'from-teal-500',
      gradientTo: 'to-emerald-400',
      trend: occupancyRate >= 70 ? 'up' : occupancyRate >= 40 ? 'stable' : 'down',
      trendValue: stats.occupancy.change,
    },
    {
      key: 'satisfaction',
      label: t('guestSatisfaction'),
      score: guestSatisfaction,
      weight: 30,
      icon: Star,
      colorClass: 'text-amber-500 dark:text-amber-400',
      gradientFrom: 'from-amber-400',
      gradientTo: 'to-yellow-300',
      trend: guestSatisfaction >= 80 ? 'up' : guestSatisfaction >= 50 ? 'stable' : 'down',
      trendValue: 3,
    },
    {
      key: 'revenue',
      label: t('revenue'),
      score: revenueTarget,
      weight: 20,
      icon: DollarSign,
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      gradientFrom: 'from-emerald-500',
      gradientTo: 'to-teal-400',
      trend: stats.revenue.change >= 0 ? 'up' : 'down',
      trendValue: Math.abs(stats.revenue.change),
    },
    {
      key: 'response',
      label: t('serviceResponse'),
      score: serviceResponse,
      weight: 10,
      icon: Clock,
      colorClass: 'text-rose-500 dark:text-rose-400',
      gradientFrom: 'from-rose-500',
      gradientTo: 'to-orange-400',
      trend: serviceResponse >= 70 ? 'up' : serviceResponse >= 40 ? 'stable' : 'down',
      trendValue: 0,
    },
  ];
}

// ---------------------------------------------------------------------------
// Animated Circular Gauge (SVG)
// ---------------------------------------------------------------------------

const GAUGE_SIZE = 200;
const GAUGE_STROKE = 14;
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

function CircularGauge({ score, label }: { score: number; label: string }) {
  const tier = getScoreTier(score);
  const offset = GAUGE_CIRCUMFERENCE - (score / 100) * GAUGE_CIRCUMFERENCE;

  const tierConfig = {
    good: {
      stroke: 'stroke-emerald-500',
      glow: 'drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]',
      text: 'text-emerald-600 dark:text-emerald-400',
      gradientId: 'gaugeGradGood',
      gradient: (
        <>
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#14b8a6" />
        </>
      ),
    },
    medium: {
      stroke: 'stroke-amber-500',
      glow: 'drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]',
      text: 'text-amber-600 dark:text-amber-400',
      gradientId: 'gaugeGradMedium',
      gradient: (
        <>
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#f97316" />
        </>
      ),
    },
    poor: {
      stroke: 'stroke-red-500',
      glow: 'drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]',
      text: 'text-red-600 dark:text-red-400',
      gradientId: 'gaugeGradPoor',
      gradient: (
        <>
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#f97316" />
        </>
      ),
    },
  }[tier];

  // Track decoration colours
  const trackGradientId = 'gaugeTrack';

  return (
    <div className="relative flex items-center justify-center group">
      {/* Glow backdrop */}
      <div
        className={cn(
          'absolute rounded-full blur-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-700',
          tier === 'good' && 'bg-emerald-500',
          tier === 'medium' && 'bg-amber-500',
          tier === 'poor' && 'bg-red-500',
        )}
        style={{ width: GAUGE_SIZE * 0.7, height: GAUGE_SIZE * 0.7 }}
      />

      <svg
        width={GAUGE_SIZE}
        height={GAUGE_SIZE}
        className="transform -rotate-90 drop-shadow-sm"
        aria-label={`${label}: ${score}`}
      >
        <defs>
          {/* Track gradient (subtle) */}
          <linearGradient id={trackGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity={0.15} />
          </linearGradient>
          {/* Active arc gradient */}
          <linearGradient
            id={tierConfig.gradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            {tierConfig.gradient}
          </linearGradient>
        </defs>

        {/* Background track */}
        <circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={GAUGE_RADIUS}
          fill="none"
          stroke={`url(#${trackGradientId})`}
          strokeWidth={GAUGE_STROKE}
          strokeLinecap="round"
        />

        {/* Animated progress arc */}
        <motion.circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={GAUGE_RADIUS}
          fill="none"
          stroke={`url(#${tierConfig.gradientId})`}
          strokeWidth={GAUGE_STROKE}
          strokeLinecap="round"
          strokeDasharray={GAUGE_CIRCUMFERENCE}
          initial={{ strokeDashoffset: GAUGE_CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          className={tierConfig.glow}
        />

        {/* Thin inner decorative ring */}
        <circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={GAUGE_RADIUS - GAUGE_STROKE - 6}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.5}
          className="text-muted-foreground/10"
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={cn(
            'text-5xl font-black tabular-nums tracking-tight',
            tierConfig.text,
          )}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.0, type: 'spring', stiffness: 200 }}
        >
          {score}
        </motion.span>
        <motion.span
          className={cn(
            'text-[10px] font-semibold uppercase tracking-widest mt-0.5',
            tierConfig.text,
            'opacity-70',
          )}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 0.7, y: 0 }}
          transition={{ duration: 0.5, delay: 1.3 }}
        >
          {label}
        </motion.span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini breakdown bar
// ---------------------------------------------------------------------------

function MetricBar({
  metric,
  index,
}: {
  metric: MetricBreakdown;
  index: number;
}) {
  const Icon = metric.icon;
  const tier = getScoreTier(metric.score);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.12 + 0.7, duration: 0.45, ease: 'easeOut' }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Icon className={cn('h-3.5 w-3.5 shrink-0', metric.colorClass)} />
          <span className="font-medium text-muted-foreground">{metric.label}</span>
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
            ({metric.weight}%)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-bold tabular-nums text-foreground">{metric.score}</span>
          {metric.trend === 'up' && metric.trendValue > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
              <TrendingUp className="h-3 w-3" />
              {metric.trendValue}%
            </span>
          )}
          {metric.trend === 'down' && metric.trendValue > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-500 dark:text-red-400 font-medium tabular-nums">
              <TrendingDown className="h-3 w-3" />
              {metric.trendValue}%
            </span>
          )}
        </div>
      </div>
      {/* Bar track */}
      <div className="relative h-2 rounded-full overflow-hidden bg-muted/50">
        <motion.div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            tier === 'good' && 'bg-gradient-to-r from-teal-500 to-emerald-400',
            tier === 'medium' && 'bg-gradient-to-r from-amber-500 to-yellow-400',
            tier === 'poor' && 'bg-gradient-to-r from-red-500 to-orange-400',
          )}
          initial={{ width: 0 }}
          animate={{ width: `${metric.score}%` }}
          transition={{
            duration: 1,
            delay: index * 0.12 + 0.8,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function PerformanceScoreSkeleton() {
  return (
    <Card className="border border-border/40 rounded-2xl overflow-hidden">
      <div className="h-[3px] w-full bg-gradient-to-r from-muted/60 via-muted/30 to-muted/60" />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-44 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 pb-6">
        <Skeleton className="h-[200px] w-[200px] rounded-full" />
        <div className="w-full space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-28 rounded" />
                <Skeleton className="h-3.5 w-12 rounded" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-3 w-36 rounded mx-auto" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Widget
// ---------------------------------------------------------------------------

export function DailyPerformanceScoreWidget() {
  const t = useTranslations('dashboard');
  const [data, setData] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(false);
      const response = await fetch('/api/dashboard');
      if (!response.ok) throw new Error('Network error');
      const result: DashboardApiResponse = await response.json();
      if (!result.success || !result.data?.stats) throw new Error('Invalid data');

      const stats = result.data.stats;
      const metrics = computeMetrics(t, stats);
      const overallScore = Math.round(
        metrics.reduce((sum, m) => sum + m.score * (m.weight / 100), 0),
      );

      setData({
        overallScore,
        metrics,
        lastUpdated: new Date().toLocaleTimeString(),
      });
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Polling interval – the initial fetch is triggered via the button's
  // manual interaction or on mount via the refresh counter below.
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetchData();
    };
    load();
    const interval = setInterval(() => {
      if (active) load();
    }, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshCount]);

  // ---- Loading / Error states ----
  if (isLoading) return <PerformanceScoreSkeleton />;
  if (error || !data) {
    return (
      <Card className="border border-border/40 rounded-2xl overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            {t('dailyScore')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-muted-foreground">{t('unableToLoad')}</p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ---- Derive tier ----
  const tier = getScoreTier(data.overallScore);

  // Top accent bar gradient
  const accentGradientClass = {
    good: 'bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500',
    medium: 'bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-400',
    poor: 'bg-gradient-to-r from-red-500 via-rose-400 to-orange-500',
  }[tier];

  // Score label colour for badge
  const badgeColorClass = {
    good: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    medium: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
    poor: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20',
  }[tier];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <Card className="border border-border/40 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
        {/* Top accent gradient line */}
        <div className={cn('h-[3px] w-full', accentGradientClass)} />

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              {t('dailyScore')}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn('text-[10px] px-2.5 py-0 h-5 font-semibold', badgeColorClass)}
              >
                {getScoreLabel(t, data.overallScore)}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={fetchData}
                aria-label={t('refresh')}
              >
                <RefreshCw className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-5 pb-6">
          {/* Main gauge */}
          <CircularGauge
            score={data.overallScore}
            label={t('overallScore')}
          />

          {/* Metric breakdown bars */}
          <div className="w-full space-y-3.5">
            <AnimatePresence>
              {data.metrics.map((metric, i) => (
                <MetricBar key={metric.key} metric={metric} index={i} />
              ))}
            </AnimatePresence>
          </div>

          {/* Footer timestamp */}
          <p className="text-[10px] text-muted-foreground/50 text-center pt-2 border-t border-border/40 w-full">
            {t('updated')} {data.lastUpdated}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
