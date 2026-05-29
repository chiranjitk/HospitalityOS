'use client';

/**
 * WiFi Revenue Analytics Dashboard — F6
 *
 * Comprehensive revenue analytics with KPIs, source breakdown, daily trends,
 * top plans, peak hours, and revenue forecasting.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  ArrowUpRight,
  RefreshCw,
  Loader2,
  BarChart3,
  Zap,
  Gift,
  Handshake,
  Megaphone,
  Target,
  Clock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface KPIs {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  arpu: number;
  conversionRate: number;
  activePaidSubscriptions: number;
}

interface RevenueSource {
  source: string;
  revenue: number;
  percentage: number;
}

interface DailyRevenuePoint {
  date: string;
  revenue: number;
  previousDay: number;
}

interface TopPlan {
  planId: string;
  planName: string;
  subscriptions: number;
  revenue: number;
  avgPerUser: number;
}

interface PeakHour {
  hour: number;
  hourLabel: string;
  revenue: number;
}

interface RevenueForecast {
  projectedMonthlyRevenue: number;
  avgDailyRevenue: number;
  growthRate: number;
}

interface DashboardData {
  kpis: KPIs;
  revenueBySource: RevenueSource[];
  dailyRevenue: DailyRevenuePoint[];
  topPlans: TopPlan[];
  peakRevenueHours: PeakHour[];
  revenueForecast: RevenueForecast;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

function getSourceIcon(source: string) {
  switch (source) {
    case 'Bandwidth Upsells': return <Zap className="h-3.5 w-3.5" />;
    case 'Voucher Sales': return <Gift className="h-3.5 w-3.5" />;
    case 'Partner Commissions': return <Handshake className="h-3.5 w-3.5" />;
    case 'Ad Revenue': return <Megaphone className="h-3.5 w-3.5" />;
    default: return <DollarSign className="h-3.5 w-3.5" />;
  }
}

function getSourceColor(source: string) {
  switch (source) {
    case 'Bandwidth Upsells': return { bg: 'bg-primary', light: 'bg-primary/10 dark:bg-primary/10', text: 'text-primary' };
    case 'Voucher Sales': return { bg: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400' };
    case 'Partner Commissions': return { bg: 'bg-amber-500', light: 'bg-amber-100 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400' };
    case 'Ad Revenue': return { bg: 'bg-purple-500', light: 'bg-purple-100 dark:bg-purple-950/30', text: 'text-purple-600 dark:text-purple-400' };
    default: return { bg: 'bg-gray-500', light: 'bg-gray-100 dark:bg-gray-950/30', text: 'text-gray-600' };
  }
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function WiFiRevenueDashboard() {
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/wifi/revenue-dashboard', { signal: controller.signal });
        const json = await res.json();
        if (cancelled) return;
        if (json.success) setData(json.data);
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Failed to fetch revenue dashboard:', error);
        toast({ title: 'Error', description: 'Failed to load revenue data', variant: 'destructive' });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; if (!controller.signal.aborted) controller.abort('Component cleanup'); };
  }, [fetchKey, toast]);

  const refresh = () => setFetchKey(k => k + 1);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No revenue data available</p>
      </div>
    );
  }

  const maxDailyRevenue = Math.max(...data.dailyRevenue.map(d => d.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            WiFi Revenue Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive revenue metrics and financial insights
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="border-0 shadow-sm bg-primary/5 dark:bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Total Revenue (30d)</span>
              <div className="rounded-md bg-primary/10 dark:bg-primary/10 p-1.5">
                <DollarSign className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums">{formatCompact(data.kpis.totalRevenue)}</p>
            <div className="flex items-center gap-1 mt-1">
              {data.revenueForecast.growthRate >= 0 ? (
                <TrendingUp className="h-3 w-3 text-primary" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={`text-xs font-medium ${data.revenueForecast.growthRate >= 0 ? 'text-primary' : 'text-red-600'}`}>
                {data.revenueForecast.growthRate >= 0 ? '+' : ''}{data.revenueForecast.growthRate}%
              </span>
              <span className="text-xs text-muted-foreground">vs prev period</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Monthly Recurring</span>
              <div className="rounded-md bg-blue-100 dark:bg-blue-900/40 p-1.5">
                <CreditCard className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums">{formatCompact(data.kpis.monthlyRecurringRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">From active bandwidth upsells</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">ARPU</span>
              <div className="rounded-md bg-purple-100 dark:bg-purple-900/40 p-1.5">
                <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(data.kpis.arpu)}</p>
            <p className="text-xs text-muted-foreground mt-1">Avg revenue per user</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Upsell Conversion</span>
              <div className="rounded-md bg-amber-100 dark:bg-amber-900/40 p-1.5">
                <Target className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums">{data.kpis.conversionRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">Completed / total upgrades</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Active Subscriptions</span>
              <div className="rounded-md bg-rose-100 dark:bg-rose-900/40 p-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums">{data.kpis.activePaidSubscriptions}</p>
            <p className="text-xs text-muted-foreground mt-1">Currently active paid plans</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Revenue by Source + Daily Trend ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue by Source — Colored Bars */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Revenue by Source</CardTitle>
            <CardDescription className="text-xs">Distribution of WiFi revenue streams</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.revenueBySource.map((source) => {
              const colors = getSourceColor(source.source);
              return (
                <div key={source.source} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-md p-1 ${colors.light}`}>
                        <span className={colors.text}>{getSourceIcon(source.source)}</span>
                      </div>
                      <span className="text-xs font-medium">{source.source}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold tabular-nums">{formatCompact(source.revenue)}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">{source.percentage}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${colors.bg}`}
                      style={{ width: `${Math.max(source.percentage, 0.5)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Total</span>
              <span className="text-sm font-bold tabular-nums">{formatCurrency(data.kpis.totalRevenue)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Daily Revenue Trend */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Daily Revenue Trend</CardTitle>
            <CardDescription className="text-xs">Last 30 days — green up, red down vs previous day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-[3px] h-[200px]">
              {data.dailyRevenue.map((day, i) => {
                const height = maxDailyRevenue > 0 ? (day.revenue / maxDailyRevenue) * 100 : 0;
                const isUp = day.previousDay > 0 ? day.revenue >= day.previousDay : true;
                const barColor = day.revenue === 0
                  ? 'bg-muted/30'
                  : isUp
                    ? 'bg-primary'
                    : 'bg-red-400 dark:bg-red-500';
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center justify-end group relative"
                    title={`${day.date}: ${formatCurrency(day.revenue)}`}
                  >
                    <div
                      className={`w-full rounded-t-sm min-h-[2px] transition-all duration-300 ${barColor} group-hover:opacity-80`}
                      style={{ height: `${Math.max(height, 1)}%` }}
                    />
                    {i % 5 === 0 && (
                      <span className="text-[8px] text-muted-foreground mt-1 whitespace-nowrap">
                        {format(new Date(day.date), 'MMM d')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-[10px] text-muted-foreground">Up vs prev</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-400" />
                <span className="text-[10px] text-muted-foreground">Down vs prev</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Top Plans + Peak Hours + Forecast ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Plans by Revenue */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Top Plans by Revenue</CardTitle>
            <CardDescription className="text-xs">Highest-generating WiFi plans in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.topPlans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No plan data available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Plan Name</TableHead>
                    <TableHead className="text-xs text-right">Subscriptions</TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                    <TableHead className="text-xs text-right">Avg/User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topPlans.map((plan, idx) => (
                    <TableRow key={plan.planId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}</span>
                          <span className="text-sm font-medium">{plan.planName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-xs">{plan.subscriptions}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">
                        {formatCurrency(plan.revenue)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {formatCurrency(plan.avgPerUser)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Peak Hours + Forecast */}
        <div className="space-y-4">
          {/* Peak Revenue Hours */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                Peak Revenue Hours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.peakRevenueHours.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No data</p>
              ) : (
                data.peakRevenueHours.map((ph, idx) => (
                  <div key={ph.hour} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={idx === 0 ? 'default' : 'outline'}
                        className={idx === 0 ? 'bg-amber-500 hover:bg-amber-600 text-white border-0 text-[10px]' : 'text-[10px]'}
                      >
                        #{idx + 1}
                      </Badge>
                      <span className="text-xs font-medium">{ph.hourLabel}</span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums">{formatCurrency(ph.revenue)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Revenue Forecast */}
          <Card className="border-0 shadow-sm bg-primary/5 dark:bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                Revenue Forecast
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Projected Monthly Revenue</p>
                <p className="text-xl font-bold tabular-nums">{formatCurrency(data.revenueForecast.projectedMonthlyRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Daily Revenue</p>
                <p className="text-lg font-semibold tabular-nums">{formatCurrency(data.revenueForecast.avgDailyRevenue)}</p>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                {data.revenueForecast.growthRate >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-primary" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-sm font-semibold ${data.revenueForecast.growthRate >= 0 ? 'text-primary' : 'text-red-600'}`}>
                  {data.revenueForecast.growthRate >= 0 ? '+' : ''}{data.revenueForecast.growthRate}%
                </span>
                <span className="text-xs text-muted-foreground">growth rate</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
