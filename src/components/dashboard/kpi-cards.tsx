'use client';

import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useI18n } from '@/contexts/I18nContext';
import { useUIStyleStore } from '@/lib/themes/store';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtime, DashboardUpdateEvent } from '@/hooks/use-realtime';
import {
  DollarSign,
  Bed,
  Wifi,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Eye,
  LucideIcon,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Animated Counter Hook ──────────────────────────────────────────────────
function useAnimatedCounter(target: number, duration: number = 1200, enabled: boolean = true) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const prevTargetRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // When target changes, reset animation start time (display naturally goes from 0 via eased * target)
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

      // ease-out cubic for a satisfying deceleration
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
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration, enabled]);

  return display;
}

// ─── Sparkline data per variant (7 dots for compact display) ──────────────
const sparklineDots: Record<string, number[]> = {
  emerald: [30, 55, 35, 65, 50, 75, 60],
  violet:  [25, 50, 55, 45, 65, 60, 80],
  cyan:    [60, 45, 70, 50, 40, 65, 55],
  amber:   [35, 50, 40, 60, 55, 75, 65],
};

// ─── Variant Config ─────────────────────────────────────────────────────────
type CardVariant = 'emerald' | 'violet' | 'cyan' | 'amber';

const variantConfig: Record<CardVariant, {
  iconGradient: string;
  topBarGradient: string;
  barColor: string;
  barHoverColor: string;
  glowColor: string;
  iconBg: string;
  leftBorderStart: string;
  leftBorderEnd: string;
  cardBg: string;
  hoverGlowShadow: string;
  borderHoverColor: string;
  trendUpBg: string;
  trendUpText: string;
  trendUpBorder: string;
  trendDownBg: string;
  trendDownText: string;
  trendDownBorder: string;
}> = {
  emerald: {
    iconGradient: 'bg-gradient-to-br from-emerald-400 to-teal-600',
    topBarGradient: 'bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500',
    barColor: 'bg-emerald-500 dark:bg-emerald-500',
    barHoverColor: 'bg-emerald-600 dark:bg-emerald-400',
    glowColor: 'group-hover:shadow-emerald-500/30',
    iconBg: 'from-emerald-500 to-teal-600',
    leftBorderStart: 'oklch(0.65 0.18 160)',
    leftBorderEnd: 'oklch(0.60 0.14 170)',
    cardBg: 'bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/40 dark:from-emerald-950/25 dark:via-card/90 dark:to-teal-950/20',
    hoverGlowShadow: 'group-hover:shadow-[0_0_30px_-5px_oklch(0.65_0.18_160/0.3),0_8px_25px_-8px_oklch(0.65_0.18_160/0.15)] dark:group-hover:shadow-[0_0_40px_-5px_oklch(0.65_0.18_160/0.25),0_8px_25px_-8px_oklch(0_0_0/0.3)]',
    borderHoverColor: 'group-hover:border-emerald-300/60 dark:group-hover:border-emerald-700/50',
    trendUpBg: 'bg-emerald-100/80 text-emerald-700 border-emerald-300/50 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40',
    trendUpText: 'text-emerald-600 dark:text-emerald-400',
    trendUpBorder: 'border-emerald-200/60 dark:border-emerald-800/40',
    trendDownBg: 'bg-red-100/80 text-red-700 border-red-300/50 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/40',
    trendDownText: 'text-red-500 dark:text-red-400',
    trendDownBorder: 'border-red-200/60 dark:border-red-800/40',
  },
  violet: {
    iconGradient: 'bg-gradient-to-br from-violet-400 to-purple-600',
    topBarGradient: 'bg-gradient-to-r from-violet-400 via-purple-400 to-violet-500',
    barColor: 'bg-violet-500 dark:bg-violet-500',
    barHoverColor: 'bg-violet-600 dark:bg-violet-400',
    glowColor: 'group-hover:shadow-violet-500/30',
    iconBg: 'from-violet-500 to-purple-600',
    leftBorderStart: 'oklch(0.65 0.20 295)',
    leftBorderEnd: 'oklch(0.55 0.18 310)',
    cardBg: 'bg-gradient-to-br from-violet-50/60 via-white to-purple-50/40 dark:from-violet-950/25 dark:via-card/90 dark:to-purple-950/20',
    hoverGlowShadow: 'group-hover:shadow-[0_0_30px_-5px_oklch(0.55_0.20_295/0.3),0_8px_25px_-8px_oklch(0.55_0.20_295/0.15)] dark:group-hover:shadow-[0_0_40px_-5px_oklch(0.55_0.20_295/0.25),0_8px_25px_-8px_oklch(0_0_0/0.3)]',
    borderHoverColor: 'group-hover:border-violet-300/60 dark:group-hover:border-violet-700/50',
    trendUpBg: 'bg-violet-100/80 text-violet-700 border-violet-300/50 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800/40',
    trendUpText: 'text-violet-600 dark:text-violet-400',
    trendUpBorder: 'border-violet-200/60 dark:border-violet-800/40',
    trendDownBg: 'bg-red-100/80 text-red-700 border-red-300/50 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/40',
    trendDownText: 'text-red-500 dark:text-red-400',
    trendDownBorder: 'border-red-200/60 dark:border-red-800/40',
  },
  cyan: {
    iconGradient: 'bg-gradient-to-br from-teal-400 to-cyan-500',
    topBarGradient: 'bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-500',
    barColor: 'bg-teal-500 dark:bg-teal-500',
    barHoverColor: 'bg-teal-600 dark:bg-teal-400',
    glowColor: 'group-hover:shadow-teal-500/30',
    iconBg: 'from-teal-500 to-cyan-600',
    leftBorderStart: 'oklch(0.65 0.14 175)',
    leftBorderEnd: 'oklch(0.60 0.16 190)',
    cardBg: 'bg-gradient-to-br from-teal-50/60 via-white to-cyan-50/40 dark:from-teal-950/25 dark:via-card/90 dark:to-cyan-950/20',
    hoverGlowShadow: 'group-hover:shadow-[0_0_30px_-5px_oklch(0.65_0.14_175/0.3),0_8px_25px_-8px_oklch(0.65_0.14_175/0.15)] dark:group-hover:shadow-[0_0_40px_-5px_oklch(0.65_0.14_175/0.25),0_8px_25px_-8px_oklch(0_0_0/0.3)]',
    borderHoverColor: 'group-hover:border-teal-300/60 dark:group-hover:border-teal-700/50',
    trendUpBg: 'bg-teal-100/80 text-teal-700 border-teal-300/50 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/40',
    trendUpText: 'text-teal-600 dark:text-teal-400',
    trendUpBorder: 'border-teal-200/60 dark:border-teal-800/40',
    trendDownBg: 'bg-red-100/80 text-red-700 border-red-300/50 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/40',
    trendDownText: 'text-red-500 dark:text-red-400',
    trendDownBorder: 'border-red-200/60 dark:border-red-800/40',
  },
  amber: {
    iconGradient: 'bg-gradient-to-br from-amber-400 to-orange-500',
    topBarGradient: 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500',
    barColor: 'bg-amber-500 dark:bg-amber-500',
    barHoverColor: 'bg-amber-600 dark:bg-amber-400',
    glowColor: 'group-hover:shadow-amber-500/30',
    iconBg: 'from-amber-500 to-orange-600',
    leftBorderStart: 'oklch(0.75 0.15 75)',
    leftBorderEnd: 'oklch(0.70 0.14 55)',
    cardBg: 'bg-gradient-to-br from-amber-50/60 via-white to-orange-50/40 dark:from-amber-950/25 dark:via-card/90 dark:to-orange-950/20',
    hoverGlowShadow: 'group-hover:shadow-[0_0_30px_-5px_oklch(0.75_0.15_75/0.3),0_8px_25px_-8px_oklch(0.75_0.15_75/0.15)] dark:group-hover:shadow-[0_0_40px_-5px_oklch(0.75_0.15_75/0.25),0_8px_25px_-8px_oklch(0_0_0/0.3)]',
    borderHoverColor: 'group-hover:border-amber-300/60 dark:group-hover:border-amber-700/50',
    trendUpBg: 'bg-amber-100/80 text-amber-700 border-amber-300/50 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/40',
    trendUpText: 'text-amber-600 dark:text-amber-400',
    trendUpBorder: 'border-amber-200/60 dark:border-amber-800/40',
    trendDownBg: 'bg-red-100/80 text-red-700 border-red-300/50 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/40',
    trendDownText: 'text-red-500 dark:text-red-400',
    trendDownBorder: 'border-red-200/60 dark:border-red-800/40',
  },
};

// ─── Animated Trend Arrow Component ──────────────────────────────────────────
function AnimatedTrendArrow({ trend, variant }: { trend: 'up' | 'down' | 'neutral'; variant?: CardVariant }) {
  const iconClass = "h-3 w-3";
  const config = variant ? variantConfig[variant] : null;

  if (trend === 'up') {
    return (
      <motion.span
        className={cn('inline-flex', config?.trendUpText || 'text-emerald-600 dark:text-emerald-400')}
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ArrowUpRight className={iconClass} />
      </motion.span>
    );
  }

  if (trend === 'down') {
    return (
      <motion.span
        className={cn('inline-flex', config?.trendDownText || 'text-red-500 dark:text-red-400')}
        animate={{ y: [0, 2, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ArrowDownRight className={iconClass} />
      </motion.span>
    );
  }

  return <Minus className={cn(iconClass, 'text-muted-foreground/50')} />;
}

// ─── Sparkline Dots Component (7 dots) ───────────────────────────────────────
function SparklineDots({ variant, delay = 0 }: { variant: CardVariant; delay?: number }) {
  const [mounted, setMounted] = useState(false);
  const config = variantConfig[variant];
  const dots = sparklineDots[variant] || sparklineDots.emerald;

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div className="flex items-center gap-[5px] mt-3 w-full px-0.5">
      {dots.map((size, i) => {
        const dotSize = 3 + (size / 100) * 4;
        return (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={mounted ? { scale: 1, opacity: 0.7 } : { scale: 0, opacity: 0 }}
            transition={{
              duration: 0.3,
              delay: delay / 1000 + i * 0.06,
              ease: 'easeOut',
            }}
            className={cn(
              'rounded-full transition-all duration-300 group-hover:opacity-100',
              config.barColor,
              'group-hover:' + config.barHoverColor
            )}
            style={{ width: dotSize, height: dotSize }}
          />
        );
      })}
    </div>
  );
}

// ─── KPI Card Component ─────────────────────────────────────────────────────
function KPICard({
  title,
  numericValue,
  formattedValue,
  subtitle,
  change,
  changeLabel,
  icon: Icon,
  trend,
  variant = 'emerald',
  index = 0,
  animateIn = true,
}: {
  title: string;
  numericValue: number;
  formattedValue: string;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  variant?: CardVariant;
  index?: number;
  animateIn?: boolean;
}) {
  const { themeId } = useUIStyleStore();
  const isNeumorphism = themeId === 'neumorphism';
  const isGlassmorphism = themeId === 'frosted-glass';
  const config = variantConfig[variant];

  const animatedValue = useAnimatedCounter(numericValue, 1400, animateIn);

  // Determine display value: use animated counter for numeric, preserve formatting for currency
  const displayValue = typeof numericValue === 'number' && numericValue >= 0
    ? formattedValue.replace(String(numericValue), String(animatedValue))
    : formattedValue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: 'easeOut' }}
      whileHover={{ scale: 1.03, y: -5 }}
      whileTap={{ scale: 0.98 }}
      className="h-full cursor-pointer"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={cn(
              'group relative overflow-hidden transition-all duration-300 h-full rounded-2xl card-shine cursor-pointer',
              'hover:-translate-y-1',
              config.hoverGlowShadow,
              config.borderHoverColor,
              isNeumorphism
                ? 'border border-border/50 shadow-[6px_6px_12px_var(--neu-shadow-dark),-6px_-6px_12px_var(--neu-shadow-light)]'
                : isGlassmorphism
                  ? 'border border-white/40 backdrop-blur-xl shadow-lg'
                  : cn('border border-border/50 backdrop-blur-sm shadow-md', config.cardBg)
            )}
            style={
              { '--kpi-accent-start': config.leftBorderStart, '--kpi-accent-end': config.leftBorderEnd } as React.CSSProperties
            }
          >
            {/* Gradient left border (3px) with enhanced glow */}
            <div
              className={cn(
                'absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full z-10',
                'bg-gradient-to-b transition-all duration-300',
                variant === 'emerald' && 'from-emerald-400 to-teal-500',
                variant === 'violet' && 'from-violet-400 to-purple-600',
                variant === 'cyan' && 'from-teal-400 to-cyan-500',
                variant === 'amber' && 'from-amber-400 to-orange-500',
                'group-hover:w-[4px] group-hover:top-2 group-hover:bottom-2'
              )}
            />

            {/* Gradient top accent bar — 2px with variant colors */}
            <div
              className={cn(
                'absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl z-20',
                config.topBarGradient
              )}
            />

            {/* Decorative background blur orb — top-right */}
            <div
              className={cn(
                'absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-[0.08] blur-2xl transition-all duration-700',
                'group-hover:opacity-[0.18] group-hover:scale-150',
                config.iconGradient
              )}
            />

            {/* Decorative blur orb — bottom-left */}
            <div
              className={cn(
                'absolute -bottom-8 -left-8 w-28 h-28 rounded-full opacity-0 blur-2xl transition-all duration-700',
                'group-hover:opacity-[0.12] group-hover:scale-110',
                config.iconGradient
              )}
            />

            {/* Bottom gradient overlay for depth */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/[0.02] to-transparent dark:from-black/[0.06] dark:to-transparent pointer-events-none z-0" />

            <CardContent className="p-5 pt-6 relative z-10">
              <div className="flex items-start justify-between gap-4">
                {/* Left: text content */}
                <div className="space-y-2 flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                    {title}
                  </p>

                  <div className="flex items-baseline gap-2 flex-wrap">
                    <motion.span
                      className={cn(
                        "text-[28px] font-extrabold tracking-tight tabular-nums leading-none",
                        "bg-gradient-to-br bg-clip-text text-transparent",
                        variant === 'emerald' && 'from-emerald-700 via-emerald-600 to-teal-600 dark:from-emerald-300 dark:via-emerald-200 dark:to-teal-300',
                        variant === 'violet' && 'from-violet-700 via-violet-600 to-purple-600 dark:from-violet-300 dark:via-violet-200 dark:to-purple-300',
                        variant === 'cyan' && 'from-teal-700 via-teal-600 to-cyan-600 dark:from-teal-300 dark:via-teal-200 dark:to-cyan-300',
                        variant === 'amber' && 'from-amber-700 via-amber-600 to-orange-600 dark:from-amber-300 dark:via-amber-200 dark:to-orange-300'
                      )}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.08 + 0.15 }}
                    >
                      {displayValue}
                    </motion.span>
                    {subtitle && (
                      <span className="text-xs text-muted-foreground/80 truncate font-medium">
                        {subtitle}
                      </span>
                    )}
                  </div>

                  {/* Trend badge with animated arrow — variant-colored */}
                  {change !== undefined && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-[3px] rounded-full border transition-all duration-300',
                          'group-hover:shadow-sm',
                          trend === 'up' && config.trendUpBg,
                          trend === 'down' && config.trendDownBg,
                          trend === 'neutral' &&
                            'bg-muted/50 text-muted-foreground border-border dark:bg-muted/40 dark:border-border'
                        )}
                      >
                        <AnimatedTrendArrow trend={trend || 'neutral'} variant={variant} />
                        {change > 0 ? '+' : ''}
                        {change}%
                      </span>
                      {changeLabel && (
                        <span className="text-[11px] text-muted-foreground/70 truncate font-medium">
                          {changeLabel}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: circular icon with premium ring effect */}
                <div className="relative flex-shrink-0">
                  {/* Outer ring — subtle border glow */}
                  <div
                    className={cn(
                      'absolute -inset-[3px] rounded-full opacity-0 transition-all duration-500',
                      'group-hover:opacity-100 group-hover:scale-105',
                      'bg-gradient-to-br',
                      variant === 'emerald' && 'from-emerald-200/40 to-teal-200/40 dark:from-emerald-500/20 dark:to-teal-500/20',
                      variant === 'violet' && 'from-violet-200/40 to-purple-200/40 dark:from-violet-500/20 dark:to-purple-500/20',
                      variant === 'cyan' && 'from-teal-200/40 to-cyan-200/40 dark:from-teal-500/20 dark:to-cyan-500/20',
                      variant === 'amber' && 'from-amber-200/40 to-orange-200/40 dark:from-amber-500/20 dark:to-orange-500/20'
                    )}
                  />
                  {/* Pulse ring on hover */}
                  <div
                    className={cn(
                      'absolute inset-0 rounded-full opacity-0 scale-100 transition-all duration-500',
                      'group-hover:opacity-25 group-hover:scale-125 group-hover:animate-[iconPulse_1.5s_ease-out]',
                      config.iconGradient
                    )}
                  />
                  <div
                    className={cn(
                      'relative w-12 h-12 rounded-full flex items-center justify-center',
                      'shadow-lg transition-all duration-300',
                      'group-hover:scale-110 group-hover:shadow-xl',
                      'ring-2 ring-white/50 dark:ring-white/20',
                      config.iconGradient
                    )}
                  >
                    <Icon className="h-5 w-5 text-white drop-shadow-sm" />
                  </div>
                </div>
              </div>

              {/* Sparkline dots */}
              <SparklineDots variant={variant} delay={index * 80 + 200} />
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex items-center gap-1.5">
          <Eye className="h-3 w-3" />
          View Details
        </TooltipContent>
      </Tooltip>
    </motion.div>
  );
}

// ─── Skeleton Card ──────────────────────────────────────────────────────────
function KPICardSkeleton({ index = 0 }: { index?: number }) {
  const { themeId } = useUIStyleStore();
  const isNeumorphism = themeId === 'neumorphism';
  const isGlassmorphism = themeId === 'frosted-glass';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="h-full"
    >
      <Card
        className={cn(
          'h-full rounded-2xl overflow-hidden',
          isNeumorphism
            ? 'border border-border/50 shadow-[6px_6px_12px_var(--neu-shadow-dark),-6px_-6px_12px_var(--neu-shadow-light)]'
            : isGlassmorphism
              ? 'border border-white/40 bg-card/60 backdrop-blur-xl shadow-lg'
              : 'border border-border/50 bg-white/80 dark:bg-card/80 backdrop-blur-sm shadow-md'
        )}
      >
        {/* Accent bar skeleton — emerald to teal */}
        <Skeleton
          className={cn(
            'h-[2px] w-full rounded-none',
            'bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500'
          )}
        />

        <CardContent className="p-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              {/* Title */}
              <Skeleton className="h-3 w-28 rounded-full" />
              {/* Value */}
              <Skeleton className="h-8 w-32 rounded-lg" />
              {/* Trend badge */}
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            {/* Icon skeleton — circular */}
            <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          </div>
          {/* Sparkline dots skeleton */}
          <div className="flex items-center gap-[5px] mt-4 w-full px-0.5">
            {[3, 5, 3.5, 5.5, 4, 5.8, 4.5].map((s, i) => (
              <Skeleton
                key={i}
                className="rounded-full"
                style={{ width: s, height: s }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Error Card ─────────────────────────────────────────────────────────────
function KPICardError() {
  const { themeId } = useUIStyleStore();
  const isNeumorphism = themeId === 'neumorphism';
  const { tDashboard } = useI18n();

  return (
    <Card
      className={cn(
        'h-full rounded-2xl',
        isNeumorphism
          ? 'border border-border/50 shadow-[6px_6px_12px_var(--neu-shadow-dark),-6px_-6px_12px_var(--neu-shadow-light)]'
          : 'border border-destructive/50 shadow-md bg-card'
      )}
    >
      <CardContent className="p-5 flex flex-col items-center justify-center h-[160px] gap-2">
        <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-4.5 w-4.5 text-destructive/70" />
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {tDashboard('failedToLoad')}
        </span>
      </CardContent>
    </Card>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface DashboardStats {
  revenue: { today: number; thisWeek: number; thisMonth: number; change: number };
  occupancy: { today: number; thisWeek: number; thisMonth: number; change: number };
  bookings: { today: number; thisWeek: number; thisMonth: number; pending: number };
  guests: { checkedIn: number; arriving: number; departing: number; total: number };
  adr: number;
  revpar: number;
  activeWifiSessions: number;
  pendingServiceRequests: number;
}

// ─── Main Export ────────────────────────────────────────────────────────────
export function KPICards() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { formatCurrency } = useCurrency();
  const { tDashboard, tCommon } = useI18n();
  useAuth();

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard');
      const result = await response.json();
      if (result.success) {
        setStats(result.data.stats);
      } else {
        setError(result.error?.message || 'Failed to load stats');
      }
    } catch {
      setError('Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle real-time dashboard updates
  const handleDashboardUpdate = useCallback((event: DashboardUpdateEvent) => {
    if (process.env.NODE_ENV !== 'production') {
    }
    if (event.type === 'stats') {
      fetchStats();
    }
  }, [fetchStats]);

  const { connectionStatus } = useRealtime({
    showToasts: false,
    onDashboardUpdate: handleDashboardUpdate,
  });

  useEffect(() => {
    const id = setTimeout(() => { fetchStats(); }, 0);
    return () => clearTimeout(id);
  }, [fetchStats]);

  // Auto-refresh every 30 seconds if not connected via WebSocket
  useEffect(() => {
    if (connectionStatus.connected) return;
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [connectionStatus.connected, fetchStats]);

  // ─── Build KPI data (4 cards) — must be before early returns (hooks rule) ──
  const kpiCards = useMemo(() => {
    if (!stats) return [];
    const cards: Array<{
      title: string;
      numericValue: number;
      formattedValue: string;
      subtitle?: string;
      change?: number;
      changeLabel?: string;
      icon: LucideIcon;
      trend: 'up' | 'down' | 'neutral';
      variant: CardVariant;
    }> = [
      {
        title: tDashboard('totalRevenue'),
        numericValue: stats.revenue.today,
        formattedValue: formatCurrency(stats.revenue.today),
        change: stats.revenue.change,
        changeLabel: tDashboard('vsYesterday'),
        icon: DollarSign,
        trend: stats.revenue.change >= 0 ? 'up' : 'down',
        variant: 'emerald',
      },
      {
        title: tDashboard('occupancyRate'),
        numericValue: stats.occupancy.today,
        formattedValue: `${stats.occupancy.today}%`,
        change: stats.occupancy.change,
        changeLabel: tDashboard('vsLastWeek'),
        icon: Bed,
        trend: stats.occupancy.change >= 0 ? 'up' : 'down',
        variant: 'violet',
      },
      {
        title: tDashboard('wifiSessions'),
        numericValue: stats.activeWifiSessions,
        formattedValue: String(stats.activeWifiSessions),
        subtitle: tDashboard('activeNow'),
        icon: Wifi,
        trend: 'up',
        variant: 'cyan',
      },
      {
        title: tDashboard('serviceRequests'),
        numericValue: stats.pendingServiceRequests,
        formattedValue: String(stats.pendingServiceRequests),
        subtitle: tCommon('pending'),
        icon: Sparkles,
        trend: 'neutral',
        variant: 'amber',
      },
    ];
    return cards;
  }, [stats, formatCurrency, tDashboard, tCommon]);

  // ─── Loading State ────────────────────────────────────────────────────
  if (isLoading || kpiCards.length === 0) {
    return (
      <>
        <style>{iconPulseKeyframes}</style>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <KPICardSkeleton key={i} index={i} />
          ))}
        </div>
      </>
    );
  }

  // ─── Error State ──────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <KPICardError key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      <style>{iconPulseKeyframes}</style>
      {/* Live indicator header */}
      <div className="flex items-center justify-end mb-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Live
        </span>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, index) => (
          <KPICard key={index} {...kpi} index={index} animateIn />
        ))}
      </div>
    </>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// ─── Keyframes (injected via <style> to avoid Tailwind JIT issues) ─────────
const iconPulseKeyframes = `
  @keyframes iconPulse {
    0% {
      transform: scale(1);
      opacity: 0.3;
    }
    50% {
      transform: scale(1.4);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 0;
    }
  }
`;
