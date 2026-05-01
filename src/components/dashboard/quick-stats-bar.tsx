'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  DollarSign,
  Bed,
  Wifi,
  LogIn,
  LogOut,
  ClipboardList,
  LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTranslations } from 'next-intl';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DashboardStats {
  todaysRevenue: number;
  occupancyPct: number;
  activeWifi: number;
  arrivals: number;
  departures: number;
  openTasks: number;
}

interface StatDef {
  key: string;
  icon: LucideIcon;
  labelKey: string;
  getValue: (stats: DashboardStats, fmt: (n: number) => string) => string;
  accentColor: string;
  iconColor: string;
}

/* ------------------------------------------------------------------ */
/*  Stat definitions                                                   */
/* ------------------------------------------------------------------ */

const STAT_DEFS: StatDef[] = [
  {
    key: 'revenue',
    icon: DollarSign,
    labelKey: 'todaysRevenue',
    getValue: (s, fmt) => fmt(s.todaysRevenue),
    accentColor: 'from-emerald-500/10 to-emerald-500/5',
    iconColor: 'text-emerald-500',
  },
  {
    key: 'occupancy',
    icon: Bed,
    labelKey: 'occupancyRate',
    getValue: (s) => `${s.occupancyPct}%`,
    accentColor: 'from-teal-500/10 to-teal-500/5',
    iconColor: 'text-teal-500',
  },
  {
    key: 'wifi',
    icon: Wifi,
    labelKey: 'wifiSessions',
    getValue: (s) => String(s.activeWifi),
    accentColor: 'from-violet-500/10 to-violet-500/5',
    iconColor: 'text-violet-500',
  },
  {
    key: 'arrivals',
    icon: LogIn,
    labelKey: 'arrivals',
    getValue: (s) => String(s.arrivals),
    accentColor: 'from-amber-500/10 to-amber-500/5',
    iconColor: 'text-amber-500',
  },
  {
    key: 'departures',
    icon: LogOut,
    labelKey: 'departures',
    getValue: (s) => String(s.departures),
    accentColor: 'from-rose-500/10 to-rose-500/5',
    iconColor: 'text-rose-500',
  },
  {
    key: 'tasks',
    icon: ClipboardList,
    labelKey: 'pendingTasksLabel',
    getValue: (s) => String(s.openTasks),
    accentColor: 'from-cyan-500/10 to-cyan-500/5',
    iconColor: 'text-cyan-500',
  },
];

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const pillVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' },
  }),
};

/* ------------------------------------------------------------------ */
/*  Skeleton pill                                                      */
/* ------------------------------------------------------------------ */

function SkeletonPill() {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2',
        'bg-muted/40 rounded-xl px-3.5 py-2',
        'min-w-[130px] animate-pulse'
      )}
    >
      <div className="h-4 w-4 rounded-md bg-muted-foreground/20" />
      <div className="flex flex-col gap-1">
        <div className="h-2.5 w-12 rounded bg-muted-foreground/20" />
        <div className="h-3.5 w-16 rounded bg-muted-foreground/15" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  QuickStatsBar                                                      */
/* ------------------------------------------------------------------ */

export function QuickStatsBar() {
  const t = useTranslations('dashboard');
  const { formatCurrency } = useCurrency();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState(false);

  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const load = async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        // Accept both { data: ... } and direct payload
        const payload = json.data ?? json;
        if (!cancelledRef.current) {
          setStats({
            todaysRevenue: payload.todaysRevenue ?? 0,
            occupancyPct: payload.occupancyPct ?? 0,
            activeWifi: payload.activeWifi ?? 0,
            arrivals: payload.arrivals ?? 0,
            departures: payload.departures ?? 0,
            openTasks: payload.openTasks ?? 0,
          });
          setError(false);
        }
      } catch {
        if (!cancelledRef.current) setError(true);
      }
    };

    const interval = setInterval(() => {
      void load();
    }, 60_000);

    void load();

    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
  }, []);

  /* Silent hide on error */
  if (error) return null;

  const isLoading = stats === null;

  return (
    <div className="relative w-full">
      {/* Glassmorphism background */}
      <div className="absolute inset-0 glass rounded-b-lg" />
      {/* Gradient bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 via-30% oklch(0.7 0.15 160 / 0.15) via-70% oklch(0.75 0.15 75 / 0.1) to-transparent" />

      <div className="relative flex items-center gap-2.5 overflow-x-auto px-4 py-2.5 scrollbar-none">
        {/* Live indicator */}
        <span className="relative flex items-center gap-1.5 shrink-0 select-none">
          <span
            className={cn(
              'relative flex h-2 w-2',
              '[&>span]:absolute [&>span]:inset-0 [&>span]:rounded-full [&>span]:bg-emerald-500',
              '[&>span]:live-pulse-dot'
            )}
            aria-hidden
          >
            <span />
          </span>
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('live')}
          </span>
        </span>

        {/* Divider */}
        <span className="h-5 w-px bg-border/30 shrink-0" aria-hidden />

        {/* Pills */}
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <SkeletonPill key={`skel-${i}`} />
          ))
        ) : (
          STAT_DEFS.map((def, i) => {
            const Icon = def.icon;
            return (
              <motion.div
                key={def.key}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={pillVariants}
                className={cn(
                  'stat-pill inline-flex items-center gap-2',
                  'glass rounded-xl px-3.5 py-2',
                  'border border-border/30',
                  'cursor-default select-none shrink-0',
                  'hover:border-border/50'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center h-7 w-7 rounded-lg',
                  'bg-gradient-to-br',
                  def.accentColor,
                  'transition-transform duration-200'
                )}>
                  <Icon className={cn('h-3.5 w-3.5', def.iconColor)} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground leading-none">
                    {t(def.labelKey)}
                  </span>
                  <span className="text-[13px] font-bold text-foreground leading-none tabular-nums">
                    {def.getValue(stats, formatCurrency)}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
