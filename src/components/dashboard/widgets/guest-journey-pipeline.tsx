'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';
import {
  CalendarCheck,
  LogIn,
  Bed,
  LogOut,
  Star,
  RefreshCw,
  Route,
  Users,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  guests: {
    checkedIn: number;
    arriving: number;
    departing: number;
    total?: number;
    totalGuests?: number;
  };
  bookings: {
    today: number;
    thisWeek: number;
    pending: number;
  };
}

interface DashboardResponse {
  success: boolean;
  data?: {
    stats: DashboardStats;
  };
}

interface JourneyStage {
  key: string;
  count: number;
  icon: LucideIcon;
  gradient: string;
  bgClass: string;
  borderClass: string;
  textColor: string;
  dotColor: string;
  barColor: string;
  labelKey: string;
}

// ─── Stage Definitions ───────────────────────────────────────────────────────

const STAGE_CONFIGS = [
  {
    key: 'booking',
    icon: CalendarCheck,
    gradient: 'from-emerald-500 to-teal-500',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderClass: 'border-emerald-200/60 dark:border-emerald-800/40',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    barColor: 'bg-emerald-400',
    labelKey: 'booking',
  },
  {
    key: 'checkin',
    icon: LogIn,
    gradient: 'from-amber-500 to-orange-500',
    bgClass: 'bg-amber-50 dark:bg-amber-950/40',
    borderClass: 'border-amber-200/60 dark:border-amber-800/40',
    textColor: 'text-amber-700 dark:text-amber-400',
    dotColor: 'bg-amber-500',
    barColor: 'bg-amber-400',
    labelKey: 'checkin',
  },
  {
    key: 'inHouse',
    icon: Bed,
    gradient: 'from-teal-500 to-cyan-500',
    bgClass: 'bg-teal-50 dark:bg-teal-950/40',
    borderClass: 'border-teal-200/60 dark:border-teal-800/40',
    textColor: 'text-teal-700 dark:text-teal-400',
    dotColor: 'bg-teal-500',
    barColor: 'bg-teal-400',
    labelKey: 'inHouse',
  },
  {
    key: 'checkout',
    icon: LogOut,
    gradient: 'from-violet-500 to-purple-500',
    bgClass: 'bg-violet-50 dark:bg-violet-950/40',
    borderClass: 'border-violet-200/60 dark:border-violet-800/40',
    textColor: 'text-violet-700 dark:text-violet-400',
    dotColor: 'bg-violet-500',
    barColor: 'bg-violet-400',
    labelKey: 'checkout',
  },
  {
    key: 'review',
    icon: Star,
    gradient: 'from-cyan-500 to-emerald-500',
    bgClass: 'bg-cyan-50 dark:bg-cyan-950/40',
    borderClass: 'border-cyan-200/60 dark:border-cyan-800/40',
    textColor: 'text-cyan-700 dark:text-cyan-400',
    dotColor: 'bg-cyan-500',
    barColor: 'bg-cyan-400',
    labelKey: 'review',
  },
] as const;

// ─── Animation Variants ──────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const stageVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 22 },
  },
};

// ─── Stage Card ──────────────────────────────────────────────────────────────

function StageCard({
  stage,
  index,
  maxCount,
  t,
}: {
  stage: JourneyStage;
  index: number;
  maxCount: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const Icon = stage.icon;
  const percentage = maxCount > 0 ? Math.round((stage.count / maxCount) * 100) : 0;
  const isActive = stage.count > 0;
  const isLast = index === STAGE_CONFIGS.length - 1;

  return (
    <motion.div variants={stageVariants} className="flex items-center gap-0 flex-1 min-w-0">
      {/* Stage Node */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              whileHover={{ scale: 1.05, y: -3 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className={cn(
                'relative flex flex-col items-center gap-2.5 p-4 sm:p-5 rounded-2xl w-full',
                'border cursor-default transition-all duration-300',
                isActive
                  ? cn(stage.bgClass, stage.borderClass, 'shadow-sm hover:shadow-md')
                  : 'bg-muted/15 dark:bg-muted/5 border-border/20 hover:border-border/40 hover:bg-muted/25',
              )}
            >
              {/* Icon with gradient background */}
              <div
                className={cn(
                  'relative flex items-center justify-center h-11 w-11 sm:h-12 sm:w-12 rounded-xl',
                  'transition-all duration-300',
                  isActive
                    ? cn('bg-gradient-to-br shadow-lg', stage.gradient, 'ring-2 ring-offset-2 ring-offset-background ring-current/20')
                    : 'bg-muted/40 ring-1 ring-border/30',
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 sm:h-5.5 sm:w-5.5 transition-colors duration-300',
                    isActive ? 'text-white drop-shadow-sm' : 'text-muted-foreground/40',
                  )}
                />
                {/* Animated glow pulse for active stages */}
                {isActive && (
                  <motion.div
                    className={cn(
                      'absolute inset-0 rounded-xl bg-gradient-to-br blur-lg -z-10',
                      stage.gradient,
                    )}
                    animate={{ opacity: [0, 0.35, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'text-[11px] sm:text-xs font-semibold text-center leading-tight',
                  isActive ? 'text-foreground' : 'text-muted-foreground/50',
                )}
              >
                {t(stage.labelKey)}
              </span>

              {/* Count */}
              <span
                className={cn(
                  'text-2xl sm:text-[28px] font-extrabold tabular-nums tracking-tight leading-none',
                  isActive ? stage.textColor : 'text-muted-foreground/30',
                )}
              >
                {isNaN(stage.count) ? 0 : stage.count}
              </span>

              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-muted/30 dark:bg-muted/15 overflow-hidden">
                <motion.div
                  className={cn(
                    'h-full rounded-full bg-gradient-to-r origin-left',
                    stage.gradient,
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${isActive ? Math.max(percentage, 6) : 0}%` }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 + index * 0.1 }}
                />
              </div>

              {/* Percentage */}
              <span className="text-[10px] text-muted-foreground/50 tabular-nums font-medium">
                {percentage}%
              </span>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p className="font-semibold">{t(stage.labelKey)}</p>
            <p className="text-muted-foreground">
              {isNaN(stage.count) ? 0 : stage.count} {t('guestsLabel').toLowerCase()} · {percentage}%
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Connector line between stages */}
      {!isLast && (
        <div className="hidden sm:flex items-center justify-center w-6 shrink-0 -mx-1 relative z-10">
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: 0.4 + index * 0.1, duration: 0.4, ease: 'easeOut' }}
            className="flex items-center"
          >
            {/* Connecting line with gradient */}
            <div className="flex items-center">
              <div className="w-2.5 h-[2px] bg-muted-foreground/15 rounded-full" />
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/25 shrink-0" />
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonPipeline() {
  return (
    <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-emerald-400 via-amber-400 via-teal-400 via-violet-400 to-cyan-400" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-6 w-6 rounded-md" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          {STAGE_CONFIGS.map((_, i) => (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-2.5 p-4 sm:p-5 rounded-2xl bg-muted/15 border border-border/15"
            >
              <Skeleton className="h-12 w-12 rounded-xl" />
              <Skeleton className="h-3 w-14 rounded-md" />
              <Skeleton className="h-7 w-8 rounded-md" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-4">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Widget ─────────────────────────────────────────────────────────────

export function GuestJourneyPipelineWidget() {
  const t = useTranslations('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const isInitialRef = useRef(true);

  const fetchStats = useCallback(async (loading = false) => {
    if (loading) setIsLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/dashboard');
      const json: DashboardResponse = await res.json();
      if (json.success && json.data?.stats) {
        setStats(json.data.stats);
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
    if (isInitialRef.current) {
      void fetchStats(true);
      isInitialRef.current = false;
    }
    const interval = setInterval(() => void fetchStats(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Build stages from API data
  const stages: JourneyStage[] = STAGE_CONFIGS.map((cfg) => {
    let count = 0;

    switch (cfg.key) {
      case 'booking':
        count = stats?.bookings.pending ?? 0;
        break;
      case 'checkin':
        count = stats?.guests.arriving ?? 0;
        break;
      case 'inHouse':
        count = stats?.guests.checkedIn ?? 0;
        break;
      case 'checkout':
        count = stats?.guests.departing ?? 0;
        break;
      case 'review':
        count = stats
          ? Math.max(0, (stats.guests.total ?? stats.guests.totalGuests ?? 0) - stats.guests.checkedIn - stats.guests.arriving)
          : 0;
        break;
    }

    return {
      key: cfg.key,
      count,
      icon: cfg.icon,
      gradient: cfg.gradient,
      bgClass: cfg.bgClass,
      borderClass: cfg.borderClass,
      textColor: cfg.textColor,
      dotColor: cfg.dotColor,
      barColor: cfg.barColor,
      labelKey: cfg.labelKey,
    };
  });

  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const totalGuests = stats?.guests.total ?? 0;
  const activeStagesCount = stages.filter((s) => s.count > 0).length;
  const totalInPipeline = stages.reduce((sum, s) => sum + (isNaN(s.count) ? 0 : s.count), 0);

  if (isLoading && !stats) {
    return <SkeletonPipeline />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="border border-border/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
        {/* Gradient accent bar */}
        <div className="h-[2px] bg-gradient-to-r from-emerald-400 via-amber-400 via-teal-400 via-violet-400 to-cyan-400" />

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 shadow-sm">
                <Route className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">
                  {t('guestJourney')}
                </CardTitle>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {activeStagesCount} of {stages.length} stages active
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[10px] font-semibold rounded-full border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2.5"
              >
                <Users className="h-2.5 w-2.5 mr-1" />
                {totalInPipeline} in pipeline
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => fetchStats(true)}
                disabled={isLoading}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {error && !stats ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-red-500/10">
                <Route className="h-5 w-5 text-red-400" />
              </div>
              <p className="text-sm text-muted-foreground">{t('failedToLoad')}</p>
              <button
                onClick={() => fetchStats(true)}
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {t('retry')}
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key="pipeline"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="space-y-5"
              >
                {/* Pipeline stages row */}
                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                  {stages.map((stage, index) => (
                    <StageCard
                      key={stage.key}
                      stage={stage}
                      index={index}
                      maxCount={maxCount}
                      t={t}
                    />
                  ))}
                </div>

                {/* Summary footer */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.3 }}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl bg-muted/25 dark:bg-muted/10 px-4 py-3 border border-border/15"
                >
                  {/* Stages distribution bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-2 w-32 rounded-full overflow-hidden gap-[2px]">
                      {stages.map((stage) => {
                        const width = maxCount > 0 ? Math.max(5, (stage.count / maxCount) * 100) : 5;
                        return (
                          <TooltipProvider key={stage.key} delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${width}%` }}
                                  transition={{ delay: 0.7, duration: 0.6, ease: 'easeOut' }}
                                  className={cn(
                                    'h-full rounded-full cursor-pointer transition-opacity hover:opacity-80',
                                    stage.barColor,
                                  )}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-[10px]">
                                <p className="font-semibold">{t(stage.labelKey)}: {stage.count}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div className="flex items-center gap-2">
                      {stages.map((stage) => (
                        <div key={stage.key} className="flex items-center gap-1">
                          <span className={cn('w-1.5 h-1.5 rounded-full', stage.dotColor)} />
                          <span className="text-[9px] text-muted-foreground/50 hidden lg:inline">{t(stage.labelKey)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary stats */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="font-medium tabular-nums">{activeStagesCount}</span>
                      <span>active</span>
                    </div>
                    <span className="text-border/50">|</span>
                    <div className="flex items-center gap-1.5">
                      <span>{t('totalLower')}:</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {totalGuests}
                      </span>
                      <span>{t('guestsLabel').toLowerCase()}</span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default GuestJourneyPipelineWidget;
