'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Award,
  Globe,
  Hotel,
  Building,
  Home,
  Compass,
  Star,
  RefreshCw,
  AlertCircle,
  Inbox,
  Phone,
  Mail,
  Users,
  Megaphone,
  Link,
  MonitorSmartphone,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────

interface ChannelData {
  name: string;
  icon: React.ElementType;
  bookings: number;
  revenue: number;
  share: number;
  color: string;
  bg: string;
  barBg: string;
  trend: 'up' | 'down';
  trendValue: number;
}

interface ChannelPerformanceData {
  channels: ChannelData[];
  totalBookings: number;
  totalRevenue: number;
  topChannel: string;
  monthlyGrowth: number;
}

interface AnalyticsChannel {
  channel: string;
  displayName: string;
  bookings: number;
  revenue: number;
  netRevenue: number;
  cancellationRate: number;
  syncSuccessRate: number;
}

interface AnalyticsResponse {
  success: boolean;
  data?: {
    summary: {
      totalRevenue: number;
      totalBookings: number;
      totalNetRevenue: number;
      bestChannel: { name: string; revenue: number } | null;
      dateRange: { startDate: string; endDate: string };
    };
    channels: AnalyticsChannel[];
    dailyTrend: Array<{ date: string; channel: string; bookings: number; revenue: number }>;
  };
  error?: { code: string; message: string };
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Map channel source keys to lucide icons */
function getChannelIcon(channelKey: string): React.ElementType {
  const iconMap: Record<string, React.ElementType> = {
    direct: Globe,
    walk_in: Globe,
    phone: Phone,
    email: Mail,
    website: MonitorSmartphone,
    agent: Users,
    corporate: Building,
    group: Users,
    whatsapp: Phone,
    facebook: Megaphone,
    instagram: Megaphone,
    booking_com: Hotel,
    expedia: Building,
    airbnb: Home,
    hotels_com: Hotel,
    agoda: Compass,
    vrbo: Home,
    tripadvisor: Star,
    makemytrip: Compass,
    goibibo: Compass,
    oyo: Building,
    google_hotels: Building,
    trivago: Compass,
    priceline: Compass,
  };

  return iconMap[channelKey] || Link;
}

/** Deterministic color palette for channels (index-based) */
const COLOR_PALETTE = [
  { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50', barBg: 'bg-gradient-to-r from-emerald-400 to-emerald-500' },
  { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50', barBg: 'bg-gradient-to-r from-amber-400 to-amber-500' },
  { color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/50', barBg: 'bg-gradient-to-r from-teal-400 to-teal-500' },
  { color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/50', barBg: 'bg-gradient-to-r from-violet-400 to-violet-500' },
  { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50', barBg: 'bg-gradient-to-r from-rose-400 to-rose-500' },
  { color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/50', barBg: 'bg-gradient-to-r from-cyan-400 to-cyan-500' },
  { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/50', barBg: 'bg-gradient-to-r from-orange-400 to-orange-500' },
  { color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-950/50', barBg: 'bg-gradient-to-r from-pink-400 to-pink-500' },
  { color: 'text-lime-600 dark:text-lime-400', bg: 'bg-lime-50 dark:bg-lime-950/50', barBg: 'bg-gradient-to-r from-lime-400 to-lime-500' },
  { color: 'text-fuchsia-600 dark:text-fuchsia-400', bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/50', barBg: 'bg-gradient-to-r from-fuchsia-400 to-fuchsia-500' },
];

/** Derive a simple growth % by comparing second half of period bookings to first half */
function deriveGrowth(dailyTrend: AnalyticsResponse['data']['dailyTrend']): number {
  if (!dailyTrend || dailyTrend.length === 0) return 0;

  // Get unique sorted dates
  const dates = [...new Set(dailyTrend.map(d => d.date))].sort();
  if (dates.length < 2) return 0;

  const mid = Math.floor(dates.length / 2);
  const firstHalfDates = new Set(dates.slice(0, mid));
  const secondHalfDates = new Set(dates.slice(mid));

  let firstHalfBookings = 0;
  let secondHalfBookings = 0;

  dailyTrend.forEach(entry => {
    if (firstHalfDates.has(entry.date)) {
      firstHalfBookings += entry.bookings;
    } else if (secondHalfDates.has(entry.date)) {
      secondHalfBookings += entry.bookings;
    }
  });

  if (firstHalfBookings === 0) return secondHalfBookings > 0 ? 100 : 0;
  return Math.round(((secondHalfBookings - firstHalfBookings) / firstHalfBookings) * 100);
}

/** Transform API analytics data into widget-compatible ChannelPerformanceData */
function transformAnalytics(api: NonNullable<AnalyticsResponse['data']>): ChannelPerformanceData | null {
  const { summary, channels, dailyTrend } = api;

  if (!channels || channels.length === 0) return null;

  const totalRevenue = summary.totalRevenue || 0;
  const totalBookings = summary.totalBookings || 0;
  const topChannel = summary.bestChannel?.name || (channels.length > 0 ? channels[0].displayName : '');
  const monthlyGrowth = deriveGrowth(dailyTrend);

  const widgetChannels: ChannelData[] = channels.map((ch, index) => {
    const palette = COLOR_PALETTE[index % COLOR_PALETTE.length];
    const share = totalRevenue > 0 ? Math.round((ch.revenue / totalRevenue) * 100) : 0;

    // Use cancellation rate inversely as a proxy for trend:
    // lower cancellation = positive trend, higher = negative
    const trend: 'up' | 'down' = ch.cancellationRate <= 15 ? 'up' : 'down';
    const trendValue = trend === 'up'
      ? Math.round(100 - ch.cancellationRate)
      : Math.round(ch.cancellationRate);

    return {
      name: ch.displayName,
      icon: getChannelIcon(ch.channel),
      bookings: ch.bookings,
      revenue: ch.revenue,
      share,
      color: palette.color,
      bg: palette.bg,
      barBg: palette.barBg,
      trend,
      trendValue,
    };
  });

  return {
    channels: widgetChannels,
    totalBookings,
    totalRevenue,
    topChannel,
    monthlyGrowth,
  };
}

// ─── Skeleton ───────────────────────────────────────────────────────────

function ChannelPerformanceSkeleton() {
  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-emerald-400 via-amber-400 to-violet-400" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-md" />
                <Skeleton className="h-3.5 w-24 flex-1" />
                <Skeleton className="h-3.5 w-10" />
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────

function EmptyState() {
  const t = useTranslations('dashboard');
  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-emerald-400 via-amber-400 to-violet-400" />
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          {t('channelPerfTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No channel data yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Connect booking channels to see performance analytics
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Error State ────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTranslations('dashboard');
  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-rose-400 via-rose-400 to-rose-400" />
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          {t('channelPerfTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="h-12 w-12 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center mb-3">
            <AlertCircle className="h-6 w-6 text-rose-500" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Unable to load channel data</p>
          <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px]">{message}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={onRetry}
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tooltip ────────────────────────────────────────────────────────────

function ChannelTooltip({ channel, visible }: { channel: ChannelData; visible: boolean }) {
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 rounded-lg bg-popover border border-border shadow-lg text-popover-foreground pointer-events-none whitespace-nowrap"
    >
      <p className="text-xs font-semibold">{channel.name}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">
        {channel.bookings} bookings &middot; {channel.revenue.toLocaleString()} revenue
      </p>
      <p className="text-[10px] mt-0.5">
        <span className="text-muted-foreground">Contribution:</span>{' '}
        <span className={cn('font-semibold', channel.color)}>{channel.share}%</span>
      </p>
    </motion.div>
  );
}

// ─── Channel Performance Widget ────────────────────────────────────────

export function ChannelPerformanceWidget() {
  const t = useTranslations('dashboard');
  const [data, setData] = useState<ChannelPerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/channels/analytics');
        const json: AnalyticsResponse = await response.json();

        if (cancelled) return;

        if (!response.ok || !json.success) {
          setError(json.error?.message || `Request failed (${response.status})`);
          return;
        }

        if (!json.data) {
          setError('No data received from server');
          return;
        }

        const transformed = transformAnalytics(json.data);

        if (!transformed) {
          setData(null);
          return;
        }

        setData(transformed);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Network error');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [retryCount]);

  const handleRetry = useCallback(() => {
    setRetryCount(c => c + 1);
  }, []);

  const maxShare = useMemo(() => {
    if (!data) return 100;
    return Math.max(...data.channels.map((c) => c.share));
  }, [data]);

  // ── States ──

  if (isLoading) return <ChannelPerformanceSkeleton />;

  if (error) return <ErrorState message={error} onRetry={handleRetry} />;

  if (!data || data.channels.length === 0) return <EmptyState />;

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Gradient accent bar */}
      <div className="h-0.5 bg-gradient-to-r from-emerald-400 via-amber-400 to-violet-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            {t('channelPerfTitle')}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {data.monthlyGrowth > 0 ? (
              <Badge className="text-[10px] px-2 py-0 h-5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 font-medium">
                <TrendingUp className="h-3 w-3 mr-0.5" />
                +{data.monthlyGrowth}%
              </Badge>
            ) : data.monthlyGrowth < 0 ? (
              <Badge className="text-[10px] px-2 py-0 h-5 bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 font-medium">
                <TrendingDown className="h-3 w-3 mr-0.5" />
                {data.monthlyGrowth}%
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/50 dark:border-emerald-800/50">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[10px] text-muted-foreground font-medium">{t('channelPerfBookings')}</span>
            </div>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{data.totalBookings}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100/50 dark:border-amber-800/50">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[10px] text-muted-foreground font-medium">{t('channelPerfRevenue')}</span>
            </div>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400 tabular-nums">{data.totalRevenue.toLocaleString()}</p>
          </div>
        </div>

        {/* ── Bar Chart ── */}
        <div className="space-y-3">
          {data.channels.map((channel, i) => {
            const Icon = channel.icon;
            const isTop = channel.name === data.topChannel;
            const barWidth = Math.max((channel.share / maxShare) * 100, 8);
            const isHovered = hoveredChannel === channel.name;

            return (
              <motion.div
                key={channel.name}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 + 0.2, duration: 0.4, ease: 'easeOut' }}
                className="space-y-1.5 relative"
                onMouseEnter={() => setHoveredChannel(channel.name)}
                onMouseLeave={() => setHoveredChannel(null)}
              >
                {/* Row header */}
                <div className="flex items-center gap-2">
                  <div className={cn('h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0', channel.bg)}>
                    <Icon className={cn('h-3 w-3', channel.color)} />
                  </div>
                  <span className="text-xs font-medium flex-1 truncate">{channel.name}</span>
                  {isTop && (
                    <Badge className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 border-amber-200/50 dark:border-amber-700/50 font-semibold gap-0.5">
                      <Award className="h-2.5 w-2.5" />
                      {t('channelPerfTop')}
                    </Badge>
                  )}
                  <span className={cn(
                    'inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums',
                    channel.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                  )}>
                    {channel.trend === 'up' ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                    {channel.trend === 'up' ? '+' : ''}{channel.trendValue}%
                  </span>
                </div>

                {/* Bar */}
                <div className="relative group">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-7 bg-muted/30 rounded-lg overflow-hidden relative">
                      <motion.div
                        className={cn('absolute inset-y-0 left-0 rounded-lg flex items-center px-2', channel.barBg)}
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 0.9, delay: i * 0.12 + 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                      >
                        {barWidth > 20 && (
                          <span className="text-[10px] font-bold text-white tabular-nums drop-shadow-sm whitespace-nowrap">
                            {channel.share}%
                          </span>
                        )}
                      </motion.div>
                      {barWidth <= 20 && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.12 + 1.2 }}
                          className={cn('absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold tabular-nums', channel.color)}
                        >
                          {channel.share}%
                        </motion.span>
                      )}
                    </div>
                  </div>

                  {/* Tooltip */}
                  <ChannelTooltip channel={channel} visible={isHovered} />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Legend ── */}
        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-border/40">
          {data.channels.map((channel) => (
            <div key={channel.name} className="flex items-center gap-1.5">
              <div className={cn('h-2.5 w-2.5 rounded-sm', channel.barBg.split(' ').length > 1 ? channel.barBg : `bg-current ${channel.color}`)} />
              <span className="text-[10px] text-muted-foreground">{channel.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default ChannelPerformanceWidget;
