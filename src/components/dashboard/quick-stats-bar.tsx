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
  },
  {
    key: 'occupancy',
    icon: Bed,
    labelKey: 'occupancyRate',
    getValue: (s) => `${s.occupancyPct}%`,
  },
  {
    key: 'wifi',
    icon: Wifi,
    labelKey: 'wifiSessions',
    getValue: (s) => String(s.activeWifi),
  },
  {
    key: 'arrivals',
    icon: LogIn,
    labelKey: 'arrivals',
    getValue: (s) => String(s.arrivals),
  },
  {
    key: 'departures',
    icon: LogOut,
    labelKey: 'departures',
    getValue: (s) => String(s.departures),
  },
  {
    key: 'tasks',
    icon: ClipboardList,
    labelKey: 'pendingTasksLabel',
    getValue: (s) => String(s.openTasks),
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
        'bg-muted/40 rounded-lg px-3 py-1.5',
        'min-w-[120px] animate-pulse'
      )}
    >
      <div className="h-3.5 w-3.5 rounded bg-muted-foreground/20" />
      <div className="flex flex-col gap-1">
        <div className="h-2.5 w-12 rounded bg-muted-foreground/20" />
        <div className="h-3 w-16 rounded bg-muted-foreground/15" />
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
    <div className="border-t border-border/30 w-full">
      <div className="flex items-center gap-3 overflow-x-auto px-4 py-2 scrollbar-none">
        {/* Live indicator */}
        <span className="relative flex items-center gap-1.5 shrink-0 select-none">
          <span
            className={cn(
              'relative flex h-2 w-2',
              '[&>span]:absolute [&>span]:inset-0 [&>span]:rounded-full [&>span]:bg-emerald-500',
              '[&>span]:animate-ping'
            )}
            aria-hidden
          >
            <span />
          </span>
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t('live')}
          </span>
        </span>

        {/* Divider */}
        <span className="h-4 w-px bg-border/40 shrink-0" aria-hidden />

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
                  'inline-flex items-center gap-2',
                  'bg-muted/40 rounded-lg px-3 py-1.5',
                  'hover:bg-muted/70 transition-colors duration-150',
                  'cursor-default select-none shrink-0'
                )}
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[10px] text-muted-foreground leading-none">
                  {t(def.labelKey)}
                </span>
                <span className="text-[13px] font-semibold text-foreground leading-none tabular-nums">
                  {def.getValue(stats, formatCurrency)}
                </span>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
