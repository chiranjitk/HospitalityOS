'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { PieChart } from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────

interface RevenueSegment {
  category: string;
  amount: number;
  color: string;
  colorDark: string;
  key: string;
}

interface RevenueDonutData {
  totalRevenue: number;
  segments: RevenueSegment[];
  currency: string;
  period: string;
}

// ─── Constants ──────────────────────────────────────────────────────────

const COLORS = {
  emerald: { fill: '#10b981', dark: '#34d399' },
  amber: { fill: '#f59e0b', dark: '#fbbf24' },
  teal: { fill: '#14b8a6', dark: '#2dd4bf' },
  violet: { fill: '#8b5cf6', dark: '#a78bfa' },
  slate: { fill: '#64748b', dark: '#94a3b8' },
};

const MOCK_DATA: RevenueDonutData = {
  totalRevenue: 187450,
  currency: '$',
  period: 'This Month',
  segments: [
    { category: 'Room Revenue', amount: 98520, color: COLORS.emerald.fill, colorDark: COLORS.emerald.dark, key: 'roomRevenue' },
    { category: 'Food & Beverage', amount: 38900, color: COLORS.amber.fill, colorDark: COLORS.amber.dark, key: 'foodAndBeverage' },
    { category: 'Spa & Wellness', amount: 22300, color: COLORS.teal.fill, colorDark: COLORS.teal.dark, key: 'spaWellness' },
    { category: 'Events & MICE', amount: 18280, color: COLORS.violet.fill, colorDark: COLORS.violet.dark, key: 'eventsMice' },
    { category: 'Other', amount: 9450, color: COLORS.slate.fill, colorDark: COLORS.slate.dark, key: 'otherRevenue' },
  ],
};

const SIZE = 180;
const CENTER = SIZE / 2;
const RADIUS = 70;
const STROKE_WIDTH = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ─── Skeleton Loader ────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-[3px] bg-gradient-to-r from-emerald-400 via-amber-400 to-violet-400" />
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-44 rounded" />
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        <Skeleton className="h-[180px] w-[180px] rounded-full" />
        <div className="w-full space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-sm" />
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 w-16 rounded ml-auto" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Donut Segment ──────────────────────────────────────────────────────

function DonutSegment({
  segment,
  index,
  total,
  circumference,
  radius,
  strokeWidth,
  center,
  isHovered,
  onHover,
  onLeave,
}: {
  segment: RevenueSegment;
  index: number;
  total: number;
  circumference: number;
  radius: number;
  strokeWidth: number;
  center: number;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const percentage = segment.amount / total;
  const dashOffset = circumference * (1 - percentage);
  const rotation = -90 + (circumference - dashOffset) / 2 + circumference * (1 - sumUpTo(index, total, circumference));

  return (
    <motion.circle
      cx={center}
      cy={center}
      r={radius}
      fill="none"
      stroke={segment.color}
      strokeWidth={strokeWidth}
      strokeDasharray={`${circumference * percentage} ${circumference}`}
      strokeLinecap="butt"
      initial={{ opacity: 0 }}
      animate={{
        opacity: isHovered ? 1 : 0.85,
        strokeWidth: isHovered ? strokeWidth + 4 : strokeWidth,
        transform: `rotate(${rotation} ${center} ${center})`,
      }}
      transition={{
        opacity: { duration: 0.2 },
        strokeWidth: { duration: 0.2 },
        transform: { delay: index * 0.15, duration: 0.6, ease: 'easeOut' },
      }}
      style={{
        transformOrigin: `${center}px ${center}px`,
        filter: isHovered ? 'drop-shadow(0 0 6px rgba(0,0,0,0.15))' : 'none',
      }}
      className="cursor-pointer transition-all duration-200"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    />
  );
}

function sumUpTo(index: number, total: number, circumference: number): number {
  // This is a helper - we don't need it actually, rotation calc is simpler
  return 0;
}

// ─── Tooltip ────────────────────────────────────────────────────────────

function Tooltip({
  segment,
  total,
  currency,
}: {
  segment: RevenueSegment | null;
  total: number;
  currency: string;
}) {
  if (!segment) return null;

  const percentage = ((segment.amount / total) * 100).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute z-50 px-3 py-2 rounded-lg bg-popover border border-border shadow-lg pointer-events-none"
      style={{ top: '50%', left: '50%', transform: 'translate(-50%, -120%)' }}
    >
      <p className="text-xs font-semibold text-foreground">{segment.category}</p>
      <p className="text-[11px] text-muted-foreground">
        {currency}{segment.amount.toLocaleString()} · {percentage}%
      </p>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function RevenueBreakdownDonutWidget() {
  const t = useTranslations('dashboard');
  const [data, setData] = useState<RevenueDonutData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    try {
      const response = await fetch('/api/dashboard');
      const result = await response.json();
      if (result.success && result.data?.revenueBreakdownDonut) {
        setData(result.data.revenueBreakdownDonut as RevenueDonutData);
      } else {
        setData(MOCK_DATA);
      }
    } catch {
      setData(MOCK_DATA);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => { fetchData(true); }, 0);
  }, [fetchData]);

  if (isLoading) return <SkeletonLoader />;
  if (!data) return null;

  const total = data.segments.reduce((sum, s) => sum + s.amount, 0);

  // Calculate each segment's rotation
  const segmentAngles = data.segments.map((segment, idx) => {
    const percentage = segment.amount / total;
    const previousSegmentsTotal = data.segments.slice(0, idx).reduce((s, seg) => s + seg.amount / total, 0);
    return { startAngle: previousSegmentsTotal, percentage };
  });

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Top gradient accent */}
      <div className="h-[3px] bg-gradient-to-r from-emerald-400 via-amber-400 to-violet-400" />

      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center shadow-sm">
              <PieChart className="h-3.5 w-3.5 text-white" />
            </div>
            {t('revenueBreakdownDonut')}
          </CardTitle>
          <span className="text-[10px] text-muted-foreground">{data.period}</span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col items-center space-y-4">
        {/* SVG Donut Chart */}
        <div className="relative">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {/* Background ring */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE_WIDTH}
              className="text-muted/30"
            />

            {/* Segments */}
            {data.segments.map((segment, index) => {
              const { startAngle, percentage } = segmentAngles[index];
              const segmentLength = CIRCUMFERENCE * percentage;
              const gapAngle = 0.015; // Small gap between segments
              const adjustedLength = segmentLength - CIRCUMFERENCE * gapAngle;
              const rotationDeg = startAngle * 360 - 90;

              return (
                <motion.circle
                  key={segment.key}
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={hoveredIndex === index ? STROKE_WIDTH + 5 : STROKE_WIDTH}
                  strokeDasharray={`${Math.max(0, adjustedLength)} ${CIRCUMFERENCE}`}
                  strokeLinecap="round"
                  className="cursor-pointer transition-all duration-200"
                  style={{
                    transformOrigin: `${CENTER}px ${CENTER}px`,
                    filter: hoveredIndex === index ? 'drop-shadow(0 0 8px rgba(0,0,0,0.2))' : 'none',
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: hoveredIndex !== null ? (hoveredIndex === index ? 1 : 0.5) : 0.85,
                    transform: `rotate(${rotationDeg} ${CENTER} ${CENTER})`,
                  }}
                  transition={{
                    opacity: { duration: 0.2 },
                    strokeWidth: { duration: 0.15 },
                    transform: { delay: index * 0.2, duration: 0.7, ease: 'easeOut' },
                  }}
                />
              );
            })}
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.p
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="text-xs text-muted-foreground font-medium"
            >
              {hoveredIndex !== null ? data.segments[hoveredIndex].category : t('revenueDonutTotal')}
            </motion.p>
            <motion.p
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="text-xl font-extrabold tabular-nums text-foreground"
            >
              {hoveredIndex !== null
                ? `${data.currency}${data.segments[hoveredIndex].amount.toLocaleString()}`
                : `${data.currency}${total.toLocaleString()}`
              }
            </motion.p>
            {hoveredIndex !== null && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[10px] text-muted-foreground tabular-nums"
              >
                {((data.segments[hoveredIndex].amount / total) * 100).toFixed(1)}%
              </motion.p>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="w-full space-y-1.5">
          {data.segments.map((segment, index) => {
            const percentage = ((segment.amount / total) * 100).toFixed(1);
            return (
              <motion.div
                key={segment.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.08, duration: 0.3 }}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all duration-200',
                  hoveredIndex === index ? 'bg-muted/60' : 'hover:bg-muted/30'
                )}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div
                  className="h-3 w-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-xs text-foreground flex-1 truncate">{segment.category}</span>
                <span className="text-[11px] font-semibold tabular-nums text-foreground">
                  {data.currency}{segment.amount.toLocaleString()}
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground w-10 text-right">
                  {percentage}%
                </span>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
