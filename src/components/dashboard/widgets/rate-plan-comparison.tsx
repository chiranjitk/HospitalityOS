'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTranslations } from 'next-intl';
import {
  DollarSign, RefreshCw, AlertCircle, ArrowRight, TrendingUp, TrendingDown, Star,
  PackageOpen,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface RatePlan {
  id: string;
  name: string;
  baseRate: number;
  avgRate: number;
  occupancy: number;
  revenue: number;
  roomsBooked: number;
  totalRooms: number;
  trend: number;
}

interface RatePlanData {
  lastUpdated: string;
  plans: RatePlan[];
  bestPerformer: string | null;
  hasData?: boolean;
}

function PlanCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-border/50 bg-card/50 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-12" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Skeleton className="h-2 w-14 mb-1" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div>
          <Skeleton className="h-2 w-16 mb-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Skeleton className="h-2 w-14" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Skeleton className="h-2 w-14" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

function MiniBar({ value, maxValue, color, delay }: { value: number; maxValue: number; color: string; delay: number }) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
      <motion.div
        className={cn('h-full rounded-full', color)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ delay, duration: 0.7, ease: 'easeOut' }}
      />
    </div>
  );
}

function PlanCard({ plan, isBest, maxRev, index, t }: { plan: RatePlan; isBest: boolean; maxRev: number; index: number; t: (key: string) => string }) {
  const { formatCurrency } = useCurrency();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.35 }}
      className={cn(
        'p-4 rounded-xl border transition-all duration-300',
        'hover:shadow-md hover:-translate-y-0.5',
        isBest
          ? 'border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-400/50 dark:ring-emerald-600/50 bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-950/50'
          : 'border-border/50 bg-card/50',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{plan.name}</span>
          {isBest && (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[10px] px-1.5 py-0 h-5 border-0 gap-0.5">
              <Star className="h-2.5 w-2.5" />{t('best')}
            </Badge>
          )}
        </div>
        <div className={cn(
          'flex items-center gap-0.5 text-xs font-medium',
          plan.trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400',
        )}>
          {plan.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(plan.trend)}%
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('baseRate')}</p>
          <p className="text-sm font-bold tabular-nums">{formatCurrency(plan.baseRate)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('avgRate')}</p>
          <p className="text-sm font-bold tabular-nums">{formatCurrency(plan.avgRate)}</p>
        </div>
      </div>
      <div className="mb-2.5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('occupancy')}</p>
          <p className="text-xs font-semibold tabular-nums">{plan.occupancy}%</p>
        </div>
        <MiniBar value={plan.occupancy} maxValue={100} color="bg-blue-500" delay={0.2 + index * 0.1} />
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('revenue')}</p>
          <p className="text-xs font-semibold tabular-nums">{formatCurrency(plan.revenue)}</p>
        </div>
        <MiniBar value={plan.revenue} maxValue={maxRev} color="bg-violet-500" delay={0.3 + index * 0.1} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
        <span>{plan.roomsBooked} / {plan.totalRooms} {t('roomsLower')}</span>
        <span className="font-medium tabular-nums">
          {plan.roomsBooked > 0
            ? formatCurrency(Math.round(plan.revenue / plan.roomsBooked))
            : formatCurrency(0)}{' '}
          / {t('room')}
        </span>
      </div>
    </motion.div>
  );
}

export function RatePlanComparisonWidget() {
  const t = useTranslations('dashboard');
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<RatePlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    if (!isInitial) setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dashboard/rate-plans');
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setLastRefresh(new Date());
      } else {
        throw new Error(result.error?.message || t('failedToLoad'));
      }
    } catch (err) {
      console.error('Rate plan fetch failed:', err);
      setError(err instanceof Error ? err.message : t('unknownError'));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch, isLoading already true
    void fetchData(true);
    const interval = setInterval(() => fetchData(false), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const maxRev = data?.plans?.length
    ? Math.max(...data.plans.map(p => p.revenue))
    : 1;

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            {t('ratePlanComparison')}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {lastRefresh && !isLoading && (
              <span className="text-[10px] text-muted-foreground">
                {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => fetchData(false)}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Loading state */}
        {isLoading && !data && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <PlanCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error state (no data available) */}
        {!isLoading && error && !data && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 dark:text-red-300 mb-2" />
            <p className="text-sm text-muted-foreground mb-1">{t('failedToLoadRatePlans')}</p>
            {error && (
              <p className="text-xs text-muted-foreground/70 mb-2 max-w-[200px]">{error}</p>
            )}
            <Button variant="outline" size="sm" className="mt-1" onClick={() => fetchData(true)}>
              {t('retry')}
            </Button>
          </div>
        )}

        {/* Empty state (data loaded, but no rate plans) */}
        {!isLoading && !error && data && data.plans.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <PackageOpen className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">{t('noRatePlans') || 'No rate plans found'}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t('createRatePlanToCompare') || 'Create rate plans to see comparisons here.'}
            </p>
          </div>
        )}

        {/* Data loaded with plans */}
        {!isLoading && !error && data && data.plans.length > 0 && (
          <div className="space-y-3">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              {data.plans.map((plan, index) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isBest={plan.id === data.bestPerformer}
                  maxRev={maxRev}
                  index={index}
                  t={t}
                />
              ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full hover:bg-muted/60 transition-colors text-xs">
              {t('viewAllPlans')}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Refresh error toast (data was available, refresh failed) */}
        {!isLoading && error && data && data.plans.length > 0 && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{t('refreshFailed') || 'Failed to refresh. Showing last fetched data.'}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
