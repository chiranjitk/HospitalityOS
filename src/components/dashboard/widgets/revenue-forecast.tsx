'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  TrendingUp,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  BarChart3,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ForecastDay {
  date: string;
  actual: number | null;
  projected: number;
}

interface ForecastData {
  days: ForecastDay[];
  totalProjected: number;
  totalActual: number;
  avgDaily: number;
  trendPercent: number;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  day: ForecastDay | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatShortCurrency(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount}`;
}


function getDayLabel(dateStr: string, index: number, todayIndex: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  if (index === todayIndex) return 'Today';
  return DAY_NAMES[d.getDay()];
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function ForecastSkeleton() {
  return (
    <Card className="border border-border/60 rounded-xl shadow-md overflow-hidden">
      <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 to-teal-500 shimmer" />
      <CardHeader className="pb-3 px-5 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-md" />
            <Skeleton className="h-5 w-36 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-5">
        {/* Chart area skeleton */}
        <div className="flex items-end gap-2 sm:gap-3 h-[180px]">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <Skeleton className="h-3 w-12 rounded" />
              <Skeleton className="flex-1 w-full rounded-t-lg shimmer" />
              <Skeleton className="h-3 w-8 rounded" />
            </div>
          ))}
        </div>
        {/* Legend skeleton */}
        <div className="flex items-center justify-center gap-6 pt-2">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-2.5 w-4 rounded" />
            <Skeleton className="h-3 w-14 rounded" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-2.5 w-4 rounded" />
            <Skeleton className="h-3 w-14 rounded" />
          </div>
        </div>
        {/* Summary cards skeleton */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/40">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tooltip overlay (positioned absolutely)
// ---------------------------------------------------------------------------

function ChartTooltip({
  state,
  isToday,
}: {
  state: TooltipState;
  isToday: boolean;
}) {
  if (!state.visible || !state.day) return null;

  const day = state.day;
  const d = new Date(day.date + 'T12:00:00');
  const dayLabel = DAY_NAMES[d.getDay()];
  const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <AnimatePresence>
      {state.visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 4 }}
          transition={{ duration: 0.15 }}
          className="absolute z-50 pointer-events-none bg-popover border border-border/80 rounded-xl shadow-xl px-3.5 py-2.5 min-w-[160px]"
          style={{
            left: Math.min(state.x, 200),
            top: state.y - 100,
          }}
        >
          <p className="text-xs font-semibold text-foreground mb-1.5">
            {isToday ? 'Today' : dayLabel}, {dateLabel}
          </p>
          <div className="space-y-1">
            {day.actual !== null && (
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-sm bg-gradient-to-br from-emerald-400 to-teal-500" />
                  Actual
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(day.actual)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className={cn(
                  "h-2 w-2 rounded-sm",
                  day.actual !== null
                    ? "bg-gradient-to-br from-amber-300 to-orange-400 opacity-40"
                    : "bg-gradient-to-br from-amber-400 to-orange-400"
                )} />
                Projected
              </span>
              <span className={cn(
                "font-bold tabular-nums",
                day.actual === null
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              )}>
                {formatCurrency(day.projected)}
              </span>
            </div>
            {day.actual !== null && (
              <div className="pt-1 border-t border-border/60 mt-1">
                <span className={cn(
                  "text-[11px] font-semibold tabular-nums",
                  day.actual >= day.projected
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500 dark:text-red-400"
                )}>
                  {day.actual >= day.projected ? '+' : ''}
                  {Math.round(((day.actual - day.projected) / day.projected) * 100)}%
                  {' vs projection'}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Single bar group (projected + actual stacked)
// ---------------------------------------------------------------------------

const CHART_HEIGHT = 180;

function BarGroup({
  day,
  index,
  todayIndex,
  maxVal,
  isToday,
  isVisible,
  onHover,
  onLeave,
}: {
  day: ForecastDay;
  index: number;
  todayIndex: number;
  maxVal: number;
  isToday: boolean;
  isVisible: boolean;
  onHover: (e: React.MouseEvent, day: ForecastDay) => void;
  onLeave: () => void;
}) {
  const hasActual = day.actual !== null;
  const displayValue = hasActual ? day.actual! : day.projected;
  const projectedHeight = maxVal > 0 ? (day.projected / maxVal) * 100 : 0;
  const actualHeight = hasActual && maxVal > 0 ? (day.actual! / maxVal) * 100 : 0;

  const isPast = hasActual;
  const isFuture = !hasActual && index > todayIndex;

  return (
    <div
      className="flex-1 flex flex-col items-center gap-1 min-w-0 relative"
      onMouseEnter={(e) => onHover(e, day)}
      onMouseLeave={onLeave}
    >
      {/* Amount label on top */}
      <motion.span
        className="text-[10px] sm:text-xs font-bold tabular-nums text-muted-foreground whitespace-nowrap"
        initial={{ opacity: 0 }}
        animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: index * 0.06 + 0.3, duration: 0.3 }}
      >
        {formatShortCurrency(displayValue)}
      </motion.span>

      {/* Bar container */}
      <div className="w-full flex justify-center" style={{ height: CHART_HEIGHT }}>
        <div className="relative w-full max-w-[40px] sm:max-w-[48px] h-full">
          {/* Projected bar (background, always visible) */}
          <motion.div
            className={cn(
              "absolute bottom-0 left-0 right-0 rounded-t-lg transition-transform duration-200",
              "hover:scale-[1.04] origin-bottom cursor-pointer",
              isFuture
                ? "bg-gradient-to-t from-amber-500/80 to-orange-400/70"
                : "bg-muted/40 dark:bg-muted/30"
            )}
            initial={{ height: 0 }}
            animate={isVisible ? { height: `${projectedHeight}%` } : { height: 0 }}
            transition={{
              delay: index * 0.06 + 0.1,
              duration: 0.7,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {/* Striped pattern for future projected bars */}
            {isFuture && (
              <div
                className="absolute inset-0 rounded-t-lg opacity-20"
                style={{
                  backgroundImage: `repeating-linear-gradient(
                    135deg,
                    transparent,
                    transparent 3px,
                    rgba(255,255,255,0.3) 3px,
                    rgba(255,255,255,0.3) 6px
                  )`,
                }}
              />
            )}
          </motion.div>

          {/* Actual bar (overlaid on projected for past days) */}
          {hasActual && (
            <motion.div
              className="absolute bottom-0 left-0 right-0 rounded-t-lg bg-gradient-to-t from-emerald-500 to-teal-400 shadow-sm hover:scale-[1.04] origin-bottom cursor-pointer transition-transform duration-200"
              initial={{ height: 0 }}
              animate={isVisible ? { height: `${actualHeight}%` } : { height: 0 }}
              transition={{
                delay: index * 0.06 + 0.2,
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          )}
        </div>
      </div>

      {/* Day label */}
      <motion.span
        className={cn(
          "text-[10px] sm:text-xs font-medium tabular-nums whitespace-nowrap",
          isToday
            ? "text-emerald-600 dark:text-emerald-400 font-bold"
            : "text-muted-foreground"
        )}
        initial={{ opacity: 0 }}
        animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: index * 0.06 + 0.5, duration: 0.3 }}
      >
        {getDayLabel(day.date, index, todayIndex)}
      </motion.span>

      {/* Today indicator dot */}
      {isToday && (
        <motion.div
          className="h-1 w-1 rounded-full bg-emerald-500"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.06 + 0.6, type: 'spring', stiffness: 300 }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary metric card
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  icon: Icon,
  gradientFrom,
  gradientTo,
  trendValue,
  delay,
  isVisible,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  gradientFrom: string;
  gradientTo: string;
  trendValue: number | null;
  delay: number;
  isVisible: boolean;
}) {
  return (
    <motion.div
      className="relative p-3 sm:p-4 rounded-xl bg-card border border-border/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
      initial={{ opacity: 0, y: 12 }}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
    >
      {/* Subtle gradient bg on hover */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        `${gradientFrom}/5`
      )} />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <div className={cn("h-6 w-6 rounded-md flex items-center justify-center bg-gradient-to-br shadow-sm", gradientFrom, gradientTo)}>
            <Icon className="h-3 w-3 text-white" />
          </div>
        </div>
        <div className="flex items-end gap-1.5">
          <p className="text-lg sm:text-xl font-extrabold tabular-nums text-foreground leading-none">
            {value}
          </p>
          {trendValue !== null && (
            <span className={cn(
              "flex items-center gap-0.5 text-[11px] font-semibold tabular-nums mb-0.5",
              trendValue >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500 dark:text-red-400"
            )}>
              {trendValue >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(trendValue)}%
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Widget
// ---------------------------------------------------------------------------

export function RevenueForecastWidget() {
  const t = useTranslations('dashboard');
  const [data, setData] = useState<ForecastData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, day: null,
  });

  // IntersectionObserver — only animate when visible
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fetchData = useCallback(async (showRefreshLoader = false) => {
    try {
      setError(false);
      const response = await fetch('/api/dashboard');
      if (!response.ok) throw new Error('Network error');
      const result = await response.json();

      if (result.success && result.data?.revenueForecast?.length > 0) {
        const apiDays: ForecastDay[] = result.data.revenueForecast.map(
          (d: { date: string; actual?: number; projected: number }) => ({
            date: d.date,
            actual: d.actual ?? null,
            projected: d.projected,
          })
        );

        // Take only 7 days
        const days = apiDays.slice(0, 7);
        const totalProjected = days.reduce((s: number, d: ForecastDay) => s + d.projected, 0);
        const actualDays = days.filter((d: ForecastDay) => d.actual !== null);
        const totalActual = actualDays.reduce((s: number, d: ForecastDay) => s + (d.actual ?? 0), 0);
        const avgDaily = Math.round(totalProjected / days.length);

        const projectedForActualDays = actualDays.reduce((s: number, d: ForecastDay) => s + d.projected, 0);
        const trendPercent = projectedForActualDays > 0
          ? Math.round(((totalActual - projectedForActualDays) / projectedForActualDays) * 100)
          : 0;

        setData({ days, totalProjected, totalActual, avgDaily, trendPercent });
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => fetchData(), 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Derived values
  const todayIndex = useMemo(() => {
    if (!data) return 3;
    const todayStr = new Date().toISOString().split('T')[0];
    const idx = data.days.findIndex(d => d.date === todayStr);
    return idx >= 0 ? idx : 3;
  }, [data]);

  const maxVal = useMemo(() => {
    if (!data) return 16000;
    return Math.max(...data.days.map(d => Math.max(d.actual ?? 0, d.projected)));
  }, [data]);

  const handleBarHover = useCallback((e: React.MouseEvent, day: ForecastDay) => {
    const rect = e.currentTarget.closest('.chart-area')?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        visible: true,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        day,
      });
    }
  }, []);

  const handleBarLeave = useCallback(() => {
    setTooltip(prev => ({ ...prev, visible: false }));
  }, []);

  // ---- Loading state ----
  if (isLoading) return <ForecastSkeleton />;

  // ---- Error state ----
  if (error || !data) {
    return (
      <Card className="border border-border/60 rounded-xl shadow-md overflow-hidden">
        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 to-teal-500" />
        <CardContent className="p-8 flex flex-col items-center justify-center gap-3 text-center">
          <Info className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('unableToLoad')}</p>
          <Button variant="outline" size="sm" onClick={() => fetchData(true)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const trendPositive = data.trendPercent >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      ref={containerRef}
    >
      <Card className="border border-border/60 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
        {/* Top accent gradient bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 to-teal-500" />

        <CardHeader className="pb-3 px-5 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
                <TrendingUp className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-base font-semibold leading-tight">
                  {t('revenueForecast')}
                </CardTitle>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {t('revenueForecastDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0 h-5 rounded-full font-medium border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
              >
                {t('weekForecast')}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => fetchData(true)}
                aria-label={t('refresh')}
              >
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5 space-y-4">
          {/* Bar chart area */}
          <div className="relative chart-area">
            {/* Tooltip */}
            <ChartTooltip
              state={{
                ...tooltip,
                day: tooltip.day && tooltip.day.date === data.days[todayIndex]?.date
                  ? tooltip.day
                  : tooltip.day,
              }}
              isToday={tooltip.day?.date === data.days[todayIndex]?.date}
            />

            <div className="flex items-end gap-1.5 sm:gap-3 px-1">
              {data.days.map((day, i) => (
                <BarGroup
                  key={day.date}
                  day={day}
                  index={i}
                  todayIndex={todayIndex}
                  maxVal={maxVal}
                  isToday={i === todayIndex}
                  isVisible={isVisible}
                  onHover={handleBarHover}
                  onLeave={handleBarLeave}
                />
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm bg-gradient-to-br from-emerald-400 to-teal-500" />
              <span className="text-[11px] text-muted-foreground">{t('actual')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm bg-gradient-to-br from-amber-400 to-orange-400" />
              <span className="text-[11px] text-muted-foreground">{t('projected')}</span>
            </div>
          </div>

          {/* Summary metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 pt-3 border-t border-border/40">
            <SummaryCard
              label={t('totalProjected')}
              value={formatCurrency(data.totalProjected)}
              icon={DollarSign}
              gradientFrom="from-emerald-500"
              gradientTo="to-teal-500"
              trendValue={null}
              delay={0.1}
              isVisible={isVisible}
            />
            <SummaryCard
              label={t('avgDaily')}
              value={formatCurrency(data.avgDaily)}
              icon={BarChart3}
              gradientFrom="from-amber-500"
              gradientTo="to-orange-400"
              trendValue={null}
              delay={0.2}
              isVisible={isVisible}
            />
            <SummaryCard
              label={t('trend')}
              value={`${trendPositive ? '+' : ''}${data.trendPercent}%`}
              icon={trendPositive ? ArrowUpRight : ArrowDownRight}
              gradientFrom={trendPositive ? "from-emerald-500" : "from-red-500"}
              gradientTo={trendPositive ? "to-teal-400" : "to-rose-400"}
              trendValue={data.trendPercent}
              delay={0.3}
              isVisible={isVisible}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
