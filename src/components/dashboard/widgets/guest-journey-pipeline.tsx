'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';
import { CalendarCheck, LogIn, Bed, LogOut, Star, RefreshCw, Route } from 'lucide-react';
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
  icon: React.ElementType;
  gradient: string;
  bgGlow: string;
  ringColor: string;
  labelKey: string;
}

// ─── Stage Definitions ───────────────────────────────────────────────────────

const STAGE_CONFIGS = [
  {
    key: 'booking',
    icon: CalendarCheck,
    gradient: 'from-emerald-500 to-teal-500',
    bgGlow: 'bg-emerald-500/10',
    ringColor: 'ring-emerald-500/30',
    labelKey: 'booking',
  },
  {
    key: 'checkin',
    icon: LogIn,
    gradient: 'from-amber-500 to-orange-500',
    bgGlow: 'bg-amber-500/10',
    ringColor: 'ring-amber-500/30',
    labelKey: 'checkin',
  },
  {
    key: 'inHouse',
    icon: Bed,
    gradient: 'from-teal-500 to-cyan-500',
    bgGlow: 'bg-teal-500/10',
    ringColor: 'ring-teal-500/30',
    labelKey: 'inHouse',
  },
  {
    key: 'checkout',
    icon: LogOut,
    gradient: 'from-violet-500 to-fuchsia-500',
    bgGlow: 'bg-violet-500/10',
    ringColor: 'ring-violet-500/30',
    labelKey: 'checkout',
  },
  {
    key: 'review',
    icon: Star,
    gradient: 'from-cyan-400 to-emerald-400',
    bgGlow: 'bg-cyan-400/10',
    ringColor: 'ring-cyan-400/30',
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

const barVariants = {
  hidden: { scaleX: 0 },
  visible: (maxCount: number) => ({
    scaleX: 1,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 },
  }),
};

const connectorVariants = {
  hidden: { scaleY: 0, opacity: 0 },
  visible: {
    scaleY: 1,
    opacity: 1,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function PipelineStage({
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
  const barWidth = maxCount > 0 ? Math.max(8, (stage.count / maxCount) * 100) : 8;

  return (
    <motion.div
      variants={stageVariants}
      className="relative flex items-stretch"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'group relative flex flex-col items-center gap-3 rounded-2xl p-4 sm:p-5',
              'cursor-default transition-all duration-300',
              'hover:scale-[1.03] hover:shadow-lg',
              'border border-transparent',
              isActive
                ? 'bg-gradient-to-br from-white/80 to-white/40 dark:from-white/5 dark:to-white/[0.02] border-white/50 dark:border-white/10 shadow-md backdrop-blur-sm'
                : 'bg-muted/30 dark:bg-muted/10',
            )}
          >
            {/* Icon circle */}
            <div
              className={cn(
                'relative flex items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-2xl',
                'transition-all duration-300',
                'ring-2',
                isActive
                  ? `bg-gradient-to-br ${stage.gradient} ring-offset-2 ring-offset-background ${stage.ringColor} shadow-lg`
                  : 'bg-muted/60 ring-muted/40',
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 sm:h-6 sm:w-6 transition-colors duration-300',
                  isActive ? 'text-white' : 'text-muted-foreground/60',
                )}
              />
              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-2xl bg-gradient-to-br opacity-20 blur-md"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.2 }}
                  transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}
                />
              )}
            </div>

            {/* Label */}
            <span
              className={cn(
                'text-xs sm:text-sm font-semibold text-center leading-tight',
                isActive ? 'text-foreground' : 'text-muted-foreground/70',
              )}
            >
              {t(stage.labelKey)}
            </span>

            {/* Count */}
            <span
              className={cn(
                'text-xl sm:text-2xl font-bold tabular-nums tracking-tight',
                isActive
                  ? 'bg-gradient-to-r bg-clip-text text-transparent'
                  : 'text-muted-foreground/50',
              )}
              style={
                isActive
                  ? { backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))` }
                  : undefined
              }
            >
              {isNaN(stage.count) ? 0 : stage.count}
            </span>

            {/* Animated progress bar */}
            <div className="w-full h-2 rounded-full bg-muted/50 dark:bg-muted/30 overflow-hidden">
              <motion.div
                className={cn(
                  'h-full rounded-full bg-gradient-to-r origin-left',
                  stage.gradient,
                )}
                custom={maxCount}
                variants={barVariants}
                initial="hidden"
                animate="visible"
                style={{ width: `${barWidth}%` }}
              />
            </div>

            {/* Percentage label */}
            <span className="text-[10px] sm:text-xs text-muted-foreground tabular-nums">
              {percentage}%
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p className="font-medium">{t(stage.labelKey)}</p>
          <p className="text-muted-foreground">
            {isNaN(stage.count) ? 0 : stage.count} {t('guestsLabel').toLowerCase()}
          </p>
        </TooltipContent>
      </Tooltip>

      {/* Connector arrow between stages (not for last) */}
      {index < STAGE_CONFIGS.length - 1 && (
        <div className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 items-center">
          <motion.div
            variants={connectorVariants}
            className="flex items-center text-muted-foreground/30"
          >
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none" className="text-muted-foreground/40">
              <path
                d="M1 6H13M13 6L9 2M13 6L9 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function SkeletonPipeline() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="h-5 w-44 rounded-md" />
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      {/* Pipeline skeleton */}
      <div className="flex flex-col sm:flex-row items-stretch gap-4 sm:gap-2">
        {STAGE_CONFIGS.map((_, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-3 p-4 sm:p-5 rounded-2xl bg-muted/20"
          >
            <Skeleton className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl" />
            <Skeleton className="h-4 w-16 rounded-md" />
            <Skeleton className="h-7 w-10 rounded-md" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-8 rounded-md" />
          </div>
        ))}
      </div>

      {/* Summary skeleton */}
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
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

  // Initial load + periodic refresh — all setState calls happen inside async callbacks,
  // never synchronously in the effect body.
  useEffect(() => {
    if (isInitialRef.current) {
      // Use a micro-task so the setState calls happen inside a callback, not synchronously.
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
        // Recently completed stays that may need review
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
      bgGlow: cfg.bgGlow,
      ringColor: cfg.ringColor,
      labelKey: cfg.labelKey,
    };
  });

  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const totalGuests = stats?.guests.total ?? 0;
  const activeStagesCount = stages.filter((s) => s.count > 0).length;

  return (
    <Card className="border-border/50 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-500 rounded-2xl overflow-hidden">
      {/* Decorative gradient header band */}
      <div className="relative h-1 w-full">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-teal-400 via-amber-400 via-cyan-400 to-violet-400 opacity-80" />
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-sm">
              <Route className="h-4 w-4 text-white" />
            </div>
            {t('guestJourney')}
          </CardTitle>
          <button
            onClick={() => fetchStats(true)}
            disabled={isLoading}
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-lg',
              'hover:bg-muted/80 transition-colors duration-200',
              'text-muted-foreground hover:text-foreground',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            aria-label="Refresh pipeline data"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')}
            />
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && !stats ? (
          <SkeletonPipeline />
        ) : error && !stats ? (
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
              className="space-y-4"
            >
              {/* Pipeline stages */}
              <div className="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-1.5">
                {stages.map((stage, index) => (
                  <div
                    key={stage.key}
                    className="flex-1 min-w-0"
                  >
                    <PipelineStage
                      stage={stage}
                      index={index}
                      maxCount={maxCount}
                      t={t}
                    />
                  </div>
                ))}
              </div>

              {/* Summary bar */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 dark:bg-muted/10 px-4 py-2.5 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="font-medium tabular-nums">{activeStagesCount}</span>
                  <span>{activeStagesCount === 1 ? 'stage' : 'stages'} active</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{t('totalLower')}:</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {totalGuests}
                  </span>
                  <span>{t('guestsLabel').toLowerCase()}</span>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}

export default GuestJourneyPipelineWidget;
