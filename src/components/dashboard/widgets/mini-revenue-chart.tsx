'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ── Types ──────────────────────────────────────────────────────────────────

interface RevenueDataPoint {
  date: string;
  amount: number;
}

interface MiniRevenueData {
  dataPoints: RevenueDataPoint[];
  currentMonthTotal: number;
  lastMonthTotal: number;
  percentChange: number;
  dailyMin: number;
  dailyMax: number;
  dailyAvg: number;
}

// ── SVG Path Helpers ──────────────────────────────────────────────────────

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return path;
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function MiniRevenueSkeleton() {
  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-primary via-emerald-400 to-teal-400" />
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-[120px] w-full rounded-xl" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Sparkline Chart ────────────────────────────────────────────────────────

function SparklineChart({
  data,
  onHover,
  activeIndex,
}: {
  data: RevenueDataPoint[];
  onHover: (index: number | null, rect: DOMRect | null) => void;
  activeIndex: number | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [pathLength, setPathLength] = useState(0);
  const [isAnimated, setIsAnimated] = useState(false);

  const padding = { top: 8, right: 8, bottom: 8, left: 8 };

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const chartWidth = dimensions.width - padding.left - padding.right;
  const chartHeight = dimensions.height - padding.top - padding.bottom;

  const amounts = data.map(d => d.amount);
  const minVal = Math.min(...amounts) * 0.95;
  const maxVal = Math.max(...amounts) * 1.05;
  const range = maxVal - minVal || 1;

  const points = useMemo(() => {
    if (chartWidth <= 0 || chartHeight <= 0) return [];
    return data.map((d, i) => ({
      x: padding.left + (i / (data.length - 1)) * chartWidth,
      y: padding.top + (1 - (d.amount - minVal) / range) * chartHeight,
    }));
  }, [data, chartWidth, chartHeight, minVal, range, padding]);

  const linePath = useMemo(() => buildSmoothPath(points), [points]);
  const areaPath = useMemo(() => {
    if (!linePath || points.length === 0) return '';
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    return `${linePath} L ${lastPoint.x} ${dimensions.height} L ${firstPoint.x} ${dimensions.height} Z`;
  }, [linePath, points, dimensions.height]);

  // Find min/max point indices
  const minIndex = amounts.indexOf(Math.min(...amounts));
  const maxIndex = amounts.indexOf(Math.max(...amounts));

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const relativeX = x - padding.left;
    if (relativeX < 0 || relativeX > chartWidth) {
      onHover(null, null);
      return;
    }
    const index = Math.round((relativeX / chartWidth) * (data.length - 1));
    onHover(Math.min(Math.max(index, 0), data.length - 1), rect);
  }, [chartWidth, data.length, padding.left, onHover]);

  const handleMouseLeave = useCallback(() => {
    onHover(null, null);
  }, [onHover]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[130px] sm:h-[140px] cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        ref={svgRef}
        className="w-full h-full"
        viewBox={`0 0 ${dimensions.width || 300} ${dimensions.height || 140}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        {areaPath && (
          <motion.path
            d={areaPath}
            fill="url(#areaGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: isAnimated ? 1 : 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          />
        )}

        {/* Line */}
        {linePath && (
          <motion.path
            ref={(ref) => {
              if (ref) {
                setPathLength(ref.getTotalLength());
              }
            }}
            d={linePath}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ strokeDashoffset: pathLength || 1000, strokeDasharray: pathLength || 1000 }}
            animate={
              isAnimated
                ? { strokeDashoffset: 0, strokeDasharray: pathLength || 1000 }
                : { strokeDashoffset: pathLength || 1000, strokeDasharray: pathLength || 1000 }
            }
            transition={{ duration: 1.5, ease: 'easeInOut' }}
            onAnimationComplete={() => setIsAnimated(true)}
          />
        )}

        {/* Hover line */}
        {activeIndex !== null && points[activeIndex] && (
          <motion.line
            x1={points[activeIndex].x}
            y1={padding.top}
            x2={points[activeIndex].x}
            y2={dimensions.height - padding.bottom}
            stroke="hsl(var(--primary))"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.5}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
          />
        )}

        {/* Hover dot */}
        {activeIndex !== null && points[activeIndex] && (
          <motion.circle
            cx={points[activeIndex].x}
            cy={points[activeIndex].y}
            r={4}
            fill="hsl(var(--primary))"
            stroke="white"
            strokeWidth={2}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          />
        )}

        {/* Min annotation */}
        {isAnimated && points[minIndex] && (
          <g>
            <circle cx={points[minIndex].x} cy={points[minIndex].y} r={3} fill="#f43f5e" opacity={0.8} />
            <text
              x={points[minIndex].x}
              y={points[minIndex].y - 10}
              textAnchor="middle"
              className="fill-rose-500 text-[9px] font-semibold"
            >
              ↓ ${(data[minIndex].amount / 1000).toFixed(0)}K
            </text>
          </g>
        )}

        {/* Max annotation */}
        {isAnimated && points[maxIndex] && (
          <g>
            <circle cx={points[maxIndex].x} cy={points[maxIndex].y} r={3} fill="#10b981" opacity={0.8} />
            <text
              x={points[maxIndex].x}
              y={points[maxIndex].y - 10}
              textAnchor="middle"
              className="fill-emerald-500 text-[9px] font-semibold"
            >
              ↑ ${(data[maxIndex].amount / 1000).toFixed(0)}K
            </text>
          </g>
        )}
      </svg>

      {/* Hover tooltip */}
      {activeIndex !== null && (
        <div className="absolute top-0 left-0 right-0 pointer-events-none flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/60 shadow-lg rounded-lg px-2.5 py-1.5 text-center z-10"
          >
            <p className="text-[10px] text-muted-foreground font-medium">{data[activeIndex].date}</p>
            <p className="text-xs font-bold tabular-nums text-foreground">
              ${data[activeIndex].amount.toLocaleString()}
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function MiniRevenueChart() {
  const t = useTranslations('dashboard');
  const [data, setData] = useState<MiniRevenueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/reports/revenue?granularity=daily');
        const result = await response.json();

        if (result.success && result.data) {
          const revenueData = result.data.revenueData || [];
          const summary = result.data.summary || {};

          if (revenueData.length === 0) {
            setError('No revenue data available');
            setIsLoading(false);
            return;
          }

          const dataPoints: RevenueDataPoint[] = revenueData.map((d: { date: string; revenue: number }) => ({
            date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            amount: d.revenue,
          }));

          const currentMonthTotal = summary.totalRevenue || dataPoints.reduce((s: number, d: RevenueDataPoint) => s + d.amount, 0);
          const lastMonthTotal = summary.revenueChange !== undefined
            ? Math.round(currentMonthTotal / (1 + (summary.revenueChange / 100)))
            : Math.round(currentMonthTotal / 1.1);

          const amounts = dataPoints.map(d => d.amount);

          setData({
            dataPoints,
            currentMonthTotal,
            lastMonthTotal,
            percentChange: summary.revenueChange !== undefined
              ? Math.round(Math.abs(summary.revenueChange) * 10) / 10
              : 0,
            dailyMin: Math.min(...amounts),
            dailyMax: Math.max(...amounts),
            dailyAvg: Math.round((summary.avgDailyRevenue || currentMonthTotal / dataPoints.length)),
          });
        } else {
          setError('Failed to load revenue data');
        }
      } catch {
        setError('Failed to fetch revenue data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleHover = useCallback((index: number | null) => {
    setActiveIndex(index);
  }, []);

  if (isLoading) {
    return <MiniRevenueSkeleton />;
  }

  if (error || !data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
          <div className="h-[2px] bg-gradient-to-r from-primary via-emerald-400 to-teal-400" />
          <CardContent className="p-4 flex items-center justify-center min-h-[280px]">
            <div className="text-center">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{error || 'No data'}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden hover-lift transition-all duration-300">
        {/* Gradient accent line */}
        <div className="h-[2px] bg-gradient-to-r from-primary via-emerald-400 to-teal-400" />

        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center">
                <DollarSign className="h-3.5 w-3.5 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{t('miniRevenueChart')}</h3>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-2 py-0 h-5 font-semibold border gap-0.5',
                'border-emerald-200 dark:border-emerald-800',
                'text-emerald-700 dark:text-emerald-400',
                'bg-emerald-50 dark:bg-emerald-950/40'
              )}
            >
              <TrendingUp className="h-2.5 w-2.5" />
              +{data.percentChange}%
            </Badge>
          </div>

          {/* Revenue Total */}
          <div className="flex items-baseline gap-2">
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-2xl font-bold text-foreground tabular-nums"
            >
              ${(data.currentMonthTotal / 1000000).toFixed(2)}M
            </motion.span>
            <span className="text-xs text-muted-foreground">
              {t('miniRevenueVsLast')}
            </span>
          </div>

          {/* Chart */}
          <SparklineChart
            data={data.dataPoints}
            onHover={handleHover}
            activeIndex={activeIndex}
          />

          {/* Stats row */}
          <div className="flex items-center justify-between pt-1">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground/60 font-medium">{t('miniRevenueDailyAvg')}</p>
                    <p className="text-xs font-bold tabular-nums text-foreground">${(data.dailyAvg / 1000).toFixed(0)}K</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">{t('miniRevenueDailyAvgTip')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="h-6 w-px bg-border/40" />

            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center">
                    <p className="text-[10px] text-rose-500/80 font-medium flex items-center gap-0.5 justify-center">
                      <ArrowUpRight className="h-2.5 w-2.5 rotate-180" />
                      {t('miniRevenueMin')}
                    </p>
                    <p className="text-xs font-bold tabular-nums text-foreground">${(data.dailyMin / 1000).toFixed(0)}K</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">{t('miniRevenueMinTip')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="h-6 w-px bg-border/40" />

            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center">
                    <p className="text-[10px] text-emerald-500/80 font-medium flex items-center gap-0.5 justify-center">
                      <ArrowUpRight className="h-2.5 w-2.5" />
                      {t('miniRevenueMax')}
                    </p>
                    <p className="text-xs font-bold tabular-nums text-foreground">${(data.dailyMax / 1000).toFixed(0)}K</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">{t('miniRevenueMaxTip')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
