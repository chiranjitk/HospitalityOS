'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Crown,
  Award,
} from 'lucide-react';
import { motion, useInView } from 'framer-motion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MetricKey = 'revenue' | 'occupancy' | 'adr' | 'revpar';
type TimePeriod = '7d' | '30d' | '90d';

interface PropertyData {
  id: string;
  name: string;
  revenue: number;
  occupancy: number;
  adr: number;
  revpar: number;
  revenueTrend: number;
  occupancyTrend: number;
  adrTrend: number;
  revparTrend: number;
  sparkline: number[];
}

// ---------------------------------------------------------------------------
// Color palette for each property
// ---------------------------------------------------------------------------

const PROPERTY_COLORS = [
  { from: '#14b8a6', to: '#0d9488', gradient: 'from-teal-500 to-teal-600', light: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-700 dark:text-teal-400', border: 'border-teal-300/50 dark:border-teal-700/40', bar: 'from-teal-400 to-teal-600' },
  { from: '#10b981', to: '#059669', gradient: 'from-emerald-500 to-emerald-600', light: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-300/50 dark:border-emerald-700/40', bar: 'from-emerald-400 to-emerald-600' },
  { from: '#f59e0b', to: '#d97706', gradient: 'from-amber-500 to-amber-600', light: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-300/50 dark:border-amber-700/40', bar: 'from-amber-400 to-amber-600' },
  { from: '#8b5cf6', to: '#7c3aed', gradient: 'from-violet-500 to-violet-600', light: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-300/50 dark:border-violet-700/40', bar: 'from-violet-400 to-violet-600' },
  { from: '#06b6d4', to: '#0891b2', gradient: 'from-cyan-500 to-cyan-600', light: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-300/50 dark:border-cyan-700/40', bar: 'from-cyan-400 to-cyan-600' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMetricValue(metric: MetricKey, value: number): string {
  switch (metric) {
    case 'revenue':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case 'occupancy':
      return `${value.toFixed(1)}%`;
    case 'adr':
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    case 'revpar':
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    default:
      return value.toString();
  }
}

function getMetricLabel(metric: MetricKey): string {
  switch (metric) {
    case 'revenue': return 'Revenue';
    case 'occupancy': return 'Occupancy';
    case 'adr': return 'ADR';
    case 'revpar': return 'RevPAR';
  }
}

function getMetricUnit(metric: MetricKey): string {
  switch (metric) {
    case 'revenue': return 'USD';
    case 'occupancy': return '%';
    case 'adr': return 'USD';
    case 'revpar': return 'USD';
  }
}

function getTargetValue(metric: MetricKey, period: TimePeriod): number {
  const targets: Record<MetricKey, Record<TimePeriod, number>> = {
    revenue: { '7d': 85000, '30d': 320000, '90d': 950000 },
    occupancy: { '7d': 82, '30d': 80, '90d': 78 },
    adr: { '7d': 210, '30d': 195, '90d': 190 },
    revpar: { '7d': 172, '30d': 156, '90d': 148 },
  };
  return targets[metric][period];
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <Card className="border border-border/60 rounded-xl shadow-md overflow-hidden">
      <div className="h-0.5 w-full bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />
      <CardHeader className="pb-3 px-4 sm:px-5 pt-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-48" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <Card className="border border-border/60 rounded-xl shadow-md overflow-hidden">
      <div className="h-0.5 w-full bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />
      <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
        <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No property performance data available.</p>
        <p className="text-xs text-muted-foreground/60">Add properties and bookings to see performance metrics.</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Mini Sparkline SVG
// ---------------------------------------------------------------------------

function MiniSparkline({
  data,
  color,
  width = 56,
  height = 20,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const points = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pts: string[] = [];
    const stepX = width / (data.length - 1);
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const y = height - ((data[i] - min) / range) * (height - 4) - 2;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  }, [data, width, height]);

  const areaPath = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);
    let path = `M 0 ${height}`;
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const y = height - ((data[i] - min) / range) * (height - 4) - 2;
      path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    path += ` L ${width} ${height} Z`;
    return path;
  }, [data, width, height]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0">
      <defs>
        <linearGradient id={`spark-fill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-fill-${color.replace('#', '')})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Comparison Bar
// ---------------------------------------------------------------------------

function ComparisonBar({
  property,
  metric,
  maxValue,
  targetPercent,
  colorIndex,
  delay,
  isVisible,
}: {
  property: PropertyData;
  metric: MetricKey;
  maxValue: number;
  targetPercent: number;
  colorIndex: number;
  delay: number;
  isVisible: boolean;
}) {
  const value = property[metric];
  const trend = property[`${metric}Trend` as keyof PropertyData] as number;
  const colors = PROPERTY_COLORS[colorIndex % PROPERTY_COLORS.length];
  const barPercent = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  const isPositive = trend >= 0;

  return (
    <motion.div
      className="group"
      initial={{ opacity: 0, x: -12 }}
      animate={isVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
    >
      <div className="flex items-center gap-3 py-2">
        {/* Property name + sparkline */}
        <div className="flex items-center gap-2 w-[140px] sm:w-[180px] flex-shrink-0">
          <div
            className={cn(
              'h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 bg-gradient-to-br shadow-sm',
              colors.gradient
            )}
          >
            <Building2 className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-foreground truncate leading-tight">
              {property.name}
            </p>
            <div className="mt-0.5">
              <MiniSparkline
                data={property.sparkline}
                color={colors.from}
                width={48}
                height={14}
              />
            </div>
          </div>
        </div>

        {/* Bar area */}
        <div className="flex-1 relative h-7">
          {/* Background track */}
          <div className="absolute inset-0 rounded-full bg-muted/60 dark:bg-muted/40" />

          {/* Animated fill bar */}
          <motion.div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full bg-gradient-to-r shadow-sm',
              colors.bar
            )}
            initial={{ width: 0 }}
            animate={isVisible ? { width: `${barPercent}%` } : { width: 0 }}
            transition={{ delay: delay + 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 animate-[shimmer_2s_ease-in-out_infinite]" />
            </div>
          </motion.div>

          {/* Target line */}
          {targetPercent > 0 && targetPercent <= 100 && (
            <motion.div
              className="absolute top-0 bottom-0 w-0.5 z-10"
              style={{ left: `${targetPercent}%` }}
              initial={{ opacity: 0 }}
              animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
              transition={{ delay: delay + 0.5, duration: 0.3 }}
            >
              <div className="h-full w-0.5 bg-foreground/40 dark:bg-foreground/30" style={{ borderLeft: '2px dashed currentColor' }} />
              <Target className="absolute -top-1 -translate-x-1/2 h-2.5 w-2.5 text-foreground/50 dark:text-foreground/40" />
            </motion.div>
          )}
        </div>

        {/* Value + trend */}
        <div className="flex items-center gap-1.5 w-[100px] sm:w-[130px] flex-shrink-0 justify-end">
          <span className="text-xs sm:text-sm font-bold tabular-nums text-foreground">
            {formatMetricValue(metric, value)}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold tabular-nums',
              isPositive
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-500 dark:text-red-400'
            )}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(trend).toFixed(1)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Summary row item
// ---------------------------------------------------------------------------

function SummaryItem({
  icon: Icon,
  label,
  value,
  name,
  delay,
  isVisible,
  accentColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  name: string;
  delay: number;
  isVisible: boolean;
  accentColor: string;
}) {
  return (
    <motion.div
      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/30"
      initial={{ opacity: 0, y: 8 }}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
    >
      <div className={cn('h-6 w-6 rounded-md flex items-center justify-center bg-gradient-to-br shadow-sm', accentColor)}>
        <Icon className="h-3 w-3 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight">{label}</p>
        <p className="text-xs sm:text-sm font-bold tabular-nums text-foreground truncate">
          {name}
        </p>
      </div>
      <span className="text-xs sm:text-sm font-extrabold tabular-nums text-foreground flex-shrink-0">
        {value}
      </span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Widget
// ---------------------------------------------------------------------------

export function PropertyPerformanceWidget() {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('revenue');
  const [activePeriod, setActivePeriod] = useState<TimePeriod>('30d');
  const [properties, setProperties] = useState<PropertyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-60px' });

  // Fetch real data from API
  useEffect(() => {
    let cancelled = false;
    async function fetchProperties() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/dashboard/property-comparison');
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
        const data = await res.json();
        if (cancelled) return;

        // Normalize API response to PropertyData[]
        const mapped: PropertyData[] = (Array.isArray(data) ? data : data.properties || []).map((p: Record<string, unknown>) => ({
          id: p.id || String(p.propertyId || Math.random()),
          name: p.name || p.propertyName || 'Unknown Property',
          revenue: Number(p.revenue || p.totalRevenue || 0),
          occupancy: Number(p.occupancy || p.occupancyRate || 0),
          adr: Number(p.adr || p.averageDailyRate || 0),
          revpar: Number(p.revpar || p.revenuePerAvailableRoom || 0),
          revenueTrend: Number(p.revenueTrend || p.revenueGrowth || 0),
          occupancyTrend: Number(p.occupancyTrend || p.occupancyGrowth || 0),
          adrTrend: Number(p.adrTrend || p.adrGrowth || 0),
          revparTrend: Number(p.revparTrend || p.revparGrowth || 0),
          sparkline: Array.isArray(p.sparkline) ? p.sparkline : [p.occupancy || 50, (p.occupancy || 50) - 2, (p.occupancy || 50) + 1, (p.occupancy || 50) + 3, (p.occupancy || 50) + 2, (p.occupancy || 50) + 4, (p.occupancy || 50) + 5],
        }));
        setProperties(mapped);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load property data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchProperties();
    return () => { cancelled = true; };
  }, [activePeriod]);

  // Sorted by current metric
  const sortedProperties = useMemo(() => {
    return [...properties].sort((a, b) => b[activeMetric] - a[activeMetric]);
  }, [properties, activeMetric]);

  // Derived calculations
  const maxValue = useMemo(() => {
    return Math.max(...sortedProperties.map(p => p[activeMetric]));
  }, [sortedProperties, activeMetric]);

  const targetValue = useMemo(() => getTargetValue(activeMetric, activePeriod), [activeMetric, activePeriod]);
  const targetPercent = maxValue > 0 ? (targetValue / maxValue) * 100 : 0;

  const bestPerformer = sortedProperties[0];
  const worstPerformer = sortedProperties[sortedProperties.length - 1];

  const average = useMemo(() => {
    const total = sortedProperties.reduce((sum, p) => sum + p[activeMetric], 0);
    return total / sortedProperties.length;
  }, [sortedProperties, activeMetric]);

  const totalPortfolio = useMemo(() => {
    return sortedProperties.reduce((sum, p) => sum + p[activeMetric], 0);
  }, [sortedProperties, activeMetric]);

  // Metric tabs config
  const metrics: { key: MetricKey; label: string; desc: string }[] = [
    { key: 'revenue', label: 'Revenue', desc: 'Total revenue' },
    { key: 'occupancy', label: 'Occupancy', desc: 'Avg. occupancy rate' },
    { key: 'adr', label: 'ADR', desc: 'Average daily rate' },
    { key: 'revpar', label: 'RevPAR', desc: 'Revenue per available room' },
  ];

  const periods: { key: TimePeriod; label: string }[] = [
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
  ];

  if (loading) return <LoadingSkeleton />;
  if (error) {
    return (
      <Card className="border border-border/60 rounded-xl shadow-md overflow-hidden">
        <div className="h-0.5 w-full bg-gradient-to-r from-red-400 to-red-500" />
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <AlertTriangle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-muted-foreground">Failed to load property performance data.</p>
          <p className="text-xs text-muted-foreground/60">{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }
  if (properties.length === 0) return <EmptyState />;

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <Card className="border border-border/60 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
        {/* Top accent gradient bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />

        <CardHeader className="pb-3 px-4 sm:px-5 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-sm">
                <BarChart3 className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-base font-semibold leading-tight">
                  Property Performance
                </CardTitle>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight mt-0.5">
                  Compare key metrics across properties
                </p>
              </div>
            </div>

            {/* Time period selector */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
              {periods.map((p) => (
                <Button
                  key={p.key}
                  variant={activePeriod === p.key ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'h-6 px-2.5 text-[11px] font-semibold rounded-md transition-all',
                    activePeriod === p.key
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-sm hover:from-teal-600 hover:to-emerald-600'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setActivePeriod(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-4">
          {/* Metric tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent">
            {metrics.map((m) => (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                  activeMetric === m.key
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {m.label}
                {activeMetric === m.key && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[9px] border-background/30 text-background font-semibold"
                  >
                    {getMetricUnit(m.key)}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Target indicator */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Target className="h-3 w-3" />
            <span>
              Target: <span className="font-semibold text-foreground">{formatMetricValue(activeMetric, targetValue)}</span>
            </span>
            <span className="text-muted-foreground/50">|</span>
            <span>Period: <span className="font-semibold text-foreground">{activePeriod === '7d' ? 'Last 7 days' : activePeriod === '30d' ? 'Last 30 days' : 'Last 90 days'}</span></span>
          </div>

          {/* Comparison bars */}
          <div className="space-y-1">
            {sortedProperties.map((property, index) => (
              <ComparisonBar
                key={property.id}
                property={property}
                metric={activeMetric}
                maxValue={maxValue}
                targetPercent={targetPercent}
                colorIndex={index}
                delay={index * 0.08}
                isVisible={isInView}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-3 flex-wrap">
              {sortedProperties.map((property, index) => {
                const colors = PROPERTY_COLORS[index % PROPERTY_COLORS.length];
                return (
                  <div key={property.id} className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full bg-gradient-to-br', colors.gradient)} />
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate max-w-[80px] sm:max-w-[120px]">
                      {property.name}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-3 border-t-2 border-dashed border-foreground/30" />
              <span className="text-[10px] sm:text-[11px] text-muted-foreground">Target</span>
            </div>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-3 border-t border-border/40">
            <SummaryItem
              icon={Crown}
              label="Best Performer"
              name={bestPerformer.name}
              value={formatMetricValue(activeMetric, bestPerformer[activeMetric])}
              delay={0.2}
              isVisible={isInView}
              accentColor="from-amber-400 to-amber-500"
            />
            <SummaryItem
              icon={TrendingDown}
              label="Needs Attention"
              name={worstPerformer.name}
              value={formatMetricValue(activeMetric, worstPerformer[activeMetric])}
              delay={0.28}
              isVisible={isInView}
              accentColor="from-rose-400 to-rose-500"
            />
            <SummaryItem
              icon={Award}
              label="Portfolio Average"
              name={`${sortedProperties.length} properties`}
              value={formatMetricValue(activeMetric, Math.round(average))}
              delay={0.36}
              isVisible={isInView}
              accentColor="from-teal-500 to-emerald-500"
            />
            <SummaryItem
              icon={BarChart3}
              label="Portfolio Total"
              name={`All ${sortedProperties.length} properties`}
              value={formatMetricValue(activeMetric, totalPortfolio)}
              delay={0.44}
              isVisible={isInView}
              accentColor="from-violet-500 to-purple-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </motion.div>
  );
}

export default PropertyPerformanceWidget;
