'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import { useTranslations } from 'next-intl';
import { Globe, ArrowRight, MapPin, Users, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────

interface NationalityData {
  country: string;
  name: string;
  count: number;
  percentage: number;
}

interface DemographicsData {
  nationalities: NationalityData[];
  uniqueCountries: number;
  topNationality: string;
}

// ─── Color palette for nationality bars ─────────────────────────────────
// Warm/cool varied colors — NO blue/indigo

const BAR_COLORS = [
  { gradient: 'from-emerald-500 to-teal-400', bg: 'bg-emerald-500', ring: 'ring-emerald-500/30' },
  { gradient: 'from-amber-500 to-orange-400', bg: 'bg-amber-500', ring: 'ring-amber-500/30' },
  { gradient: 'from-rose-500 to-pink-400', bg: 'bg-rose-500', ring: 'ring-rose-500/30' },
  { gradient: 'from-cyan-500 to-teal-400', bg: 'bg-cyan-500', ring: 'ring-cyan-500/30' },
  { gradient: 'from-violet-500 to-purple-400', bg: 'bg-violet-500', ring: 'ring-violet-500/30' },
  { gradient: 'from-orange-500 to-amber-400', bg: 'bg-orange-500', ring: 'ring-orange-500/30' },
  { gradient: 'from-teal-500 to-emerald-400', bg: 'bg-teal-500', ring: 'ring-teal-500/30' },
  { gradient: 'from-slate-500 to-zinc-400', bg: 'bg-slate-500', ring: 'ring-slate-500/30' },
];


// ─── Skeleton ───────────────────────────────────────────────────────────

function DemographicsSkeleton() {
  return (
    <Card className="border border-border/60 shadow-md rounded-xl">
      <div className="h-0.5 bg-gradient-to-r from-amber-400 to-orange-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-36" />
          </div>
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
        {/* Bars skeleton */}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
          ))}
        </div>
        {/* View all skeleton */}
        <Skeleton className="h-8 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

// ─── Nationality Row ────────────────────────────────────────────────────

function NationalityRow({
  nationality,
  color,
  index,
  maxPercentage,
}: {
  nationality: NationalityData;
  color: typeof BAR_COLORS[number];
  index: number;
  maxPercentage: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        delay: index * 0.07 + 0.3,
        duration: 0.4,
        ease: 'easeOut',
      }}
      whileHover={{ scale: 1.015 }}
      className="group"
    >
      <div className="flex items-center gap-3">
        {/* Flag + Name */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-lg flex-shrink-0 leading-none">{nationality.country}</span>
          <span className="text-xs font-medium text-foreground truncate">
            {nationality.name}
          </span>
        </div>

        {/* Count */}
        <span className="text-xs font-semibold tabular-nums text-muted-foreground flex-shrink-0">
          {nationality.count}
        </span>

        {/* Percentage */}
        <span className="text-[11px] font-bold tabular-nums w-9 text-right flex-shrink-0">
          {nationality.percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-1.5 ml-[28px] relative h-2 bg-muted/40 rounded-full overflow-hidden">
        <motion.div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full bg-gradient-to-r',
            color.gradient
          )}
          initial={{ width: 0 }}
          animate={{ width: `${(nationality.percentage / maxPercentage) * 100}%` }}
          transition={{
            duration: 0.8,
            delay: index * 0.07 + 0.5,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        />
      </div>
    </motion.div>
  );
}

// ─── Main Widget ────────────────────────────────────────────────────────

export function GuestDemographicsWidget() {
  const t = useTranslations('dashboard');
  const { setActiveSection } = useUIStore();
  const [data, setData] = useState<DemographicsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      const response = await fetch('/api/dashboard');
      const result = await response.json();

      if (result.success && result.data?.demographics) {
        setData(result.data.demographics);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => fetchData(), 0);
  }, [fetchData]);

  // Auto-refresh every 120 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchData(), 120000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (isLoading) return <DemographicsSkeleton />;

  if (error || !data) {
    return (
      <Card className="border border-border/60 shadow-md rounded-xl">
        <div className="h-0.5 bg-gradient-to-r from-amber-400 to-orange-500" />
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-muted-foreground">Unable to load data.</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setError(false); fetchData(true); }}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const nationalities = data.nationalities.slice(0, 8);
  const maxPercentage = Math.max(...nationalities.map((n) => n.percentage), 1);

  return (
    <Card className="border border-border/60 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-xl overflow-hidden">
      {/* Top accent bar */}
      <div className="h-0.5 bg-gradient-to-r from-amber-400 to-orange-500" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
              <Globe className="h-3.5 w-3.5 text-white" />
            </div>
            {t('guestDemographics')}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0 h-5 border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400"
            >
              {t('topNationalities')}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn(
                  'h-3 w-3 text-muted-foreground',
                  isRefreshing && 'animate-spin'
                )}
              />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 border border-emerald-100/50 dark:border-emerald-800/50">
            <div className="flex items-center gap-1 mb-1">
              <MapPin className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[10px] text-muted-foreground font-medium">
                {t('uniqueCountries')}
              </span>
            </div>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {data.uniqueCountries}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 border border-amber-100/50 dark:border-amber-800/50">
            <div className="flex items-center gap-1 mb-1">
              <Users className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              <span className="text-[10px] text-muted-foreground font-medium">
                {t('topNationality')}
              </span>
            </div>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400 truncate">
              {data.topNationality}
            </p>
          </div>
        </div>

        {/* Nationality bars */}
        <div className="space-y-3">
          {nationalities.map((nationality, i) => (
            <NationalityRow
              key={nationality.name}
              nationality={nationality}
              color={BAR_COLORS[i % BAR_COLORS.length]}
              index={i}
              maxPercentage={maxPercentage}
            />
          ))}
        </div>

        {/* View All link */}
        <Button
          variant="ghost"
          className="w-full mt-2 hover:bg-muted/60 transition-colors text-xs font-medium h-8"
          onClick={() => setActiveSection('guests-list')}
        >
          {t('viewAllGuests')}
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
