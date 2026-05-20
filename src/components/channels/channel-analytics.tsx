'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Globe,
  CalendarDays,
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  PieChart,
  Clock,
  Award,
  AlertTriangle,
  Target,
  Zap,
  Loader2,
  XCircle,
  CheckCircle2,
  Activity,
  Timer,
  Percent,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface ChannelData {
  channel: string;
  displayName: string;
  bookings: number;
  revenue: number;
  cancelledBookings: number;
  totalBookings: number;
  cancellationRate: number;
  commissionTotal: number;
  netRevenue: number;
  commissionRate: number;
  avgLeadTimeDays: number;
  adr: number;
  totalNights: number;
  syncSuccessRate: number;
  syncTotal: number;
  syncErrors: number;
  lastSyncAt: string | null;
}

interface DailyTrend {
  date: string;
  channel: string;
  bookings: number;
  revenue: number;
}

interface AnalyticsSummary {
  totalRevenue: number;
  totalBookings: number;
  totalCommissions: number;
  avgCommissionRate: number;
  overallCancellationRate: number;
  bestChannel: { name: string; revenue: number } | null;
  channelCount: number;
  totalNetRevenue: number;
  dateRange: { startDate: string; endDate: string };
}

interface AnalyticsResponse {
  success: boolean;
  data: {
    summary: AnalyticsSummary;
    channels: ChannelData[];
    dailyTrend: DailyTrend[];
    topPerformers: ChannelData[];
    bottomPerformers: ChannelData[];
  };
}

type SortField = 'displayName' | 'bookings' | 'revenue' | 'cancellationRate' | 'commissionTotal' | 'netRevenue' | 'syncSuccessRate';
type SortDir = 'asc' | 'desc';

// ============================================
// HELPERS
// ============================================

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
};

const formatCurrencyFull = (value: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
};

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

const formatDays = (value: number): string => {
  if (value < 1) return '<1d';
  return `${Math.round(value)}d`;
};

const CHART_COLORS = [
  '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  '#6366f1', '#e11d48', '#0891b2', '#65a30d', '#d946ef',
  '#0ea5e9',
];

const getChannelColor = (index: number): string => {
  return CHART_COLORS[index % CHART_COLORS.length];
};

const getSyncStatusIcon = (rate: number) => {
  if (rate >= 95) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (rate >= 80) return <Activity className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
};

// ============================================
// DONUT CHART (Pure SVG)
// ============================================

function DonutChart({ data, totalRevenue }: { data: { name: string; value: number; color: string }[]; totalRevenue: number }) {
  if (data.length === 0 || totalRevenue === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No revenue data available
      </div>
    );
  }

  const size = 220;
  const strokeWidth = 45;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Precompute offsets to avoid mutation during render
  const segments = data.map((item) => {
    const percentage = item.value / totalRevenue;
    const dashLength = percentage * circumference;
    return { item, dashLength };
  });

  // Compute cumulative offsets
  const offsetMap = new Map<string, number>();
  let cumulativeOffset = 0;
  for (const seg of segments) {
    offsetMap.set(seg.item.name, cumulativeOffset);
    cumulativeOffset += seg.dashLength;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        {segments.map(({ item, dashLength, percentage }) => {
          const dashOffset = -(offsetMap.get(item.name) || 0);

          return (
            <TooltipProvider key={item.name}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                    strokeDashoffset={dashOffset}
                    className="cursor-pointer transition-all duration-300 hover:stroke-width-[50]"
                    style={{ strokeLinecap: 'butt' }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-sm">{formatCurrencyFull(item.value)} ({formatPercent(percentage * 100)})</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-2xl font-bold">{formatCurrency(totalRevenue)}</span>
        <span className="text-xs text-muted-foreground">Total Revenue</span>
      </div>
    </div>
  );
}

// ============================================
// TREND BAR CHART (Pure CSS/SVG)
// ============================================

function TrendBarChart({ trend, channels }: { trend: DailyTrend[]; channels: ChannelData[] }) {
  const channelNames = channels.slice(0, 6).map(c => c.channel);
  const colors = channelNames.map((_, i) => getChannelColor(i));

  // Build date -> channel -> bookings map
  const dateMap = new Map<string, Map<string, number>>();
  trend.forEach(t => {
    if (!dateMap.has(t.date)) dateMap.set(t.date, new Map());
    dateMap.get(t.date)!.set(t.channel, (dateMap.get(t.date)!.get(t.channel) || 0) + t.bookings);
  });

  const dates = Array.from(dateMap.keys()).sort();
  if (dates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No booking trend data available
      </div>
    );
  }

  // Get max bookings for scaling
  let maxBookings = 1;
  dates.forEach(date => {
    const dayMap = dateMap.get(date)!;
    let dayTotal = 0;
    dayMap.forEach(count => { dayTotal += count; });
    if (dayTotal > maxBookings) maxBookings = dayTotal;
  });

  const last30Dates = dates.slice(-30);
  const barWidth = Math.max(8, Math.min(28, 700 / last30Dates.length));

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {channelNames.map((name, i) => (
          <div key={name} className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors[i] }} />
            <span className="text-muted-foreground capitalize">
              {name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>
        ))}
      </div>

      {/* Bars */}
      <ScrollArea className="w-full" style={{ maxHeight: 280 }}>
        <div className="flex items-end gap-0.5" style={{ height: 220, minWidth: Math.max(500, last30Dates.length * (barWidth + 2)) }}>
          {last30Dates.map((date, di) => {
            const dayMap = dateMap.get(date)!;
            let yOffset = 0;

            return (
              <TooltipProvider key={date}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative flex-shrink-0" style={{ width: barWidth, height: '100%' }}>
                      {channelNames.map((ch, ci) => {
                        const count = dayMap.get(ch) || 0;
                        if (count === 0) return null;
                        const barHeight = (count / maxBookings) * 200;
                        const el = (
                          <div
                            key={ch}
                            className="absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-200 hover:opacity-80"
                            style={{
                              height: barHeight,
                              bottom: yOffset,
                              backgroundColor: colors[ci],
                            }}
                          />
                        );
                        yOffset += barHeight;
                        return el;
                      })}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <div className="font-semibold">{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      {channelNames.map((ch, ci) => {
                        const count = dayMap.get(ch) || 0;
                        if (count === 0) return null;
                        return (
                          <div key={ch} className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: colors[ci] }} />
                            <span>{ch.replace(/_/g, ' ')}: {count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ChannelAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [dateRange, setDateRange] = useState('30');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange !== 'all') {
        const days = parseInt(dateRange);
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
        params.set('startDate', startDate.toISOString());
        params.set('endDate', endDate.toISOString());
      }

      const response = await fetch(`/api/channels/analytics?${params.toString()}`);
      const data: AnalyticsResponse = await response.json();
      if (data.success) {
        setAnalytics(data);
      } else {
        toast.error('Failed to load channel analytics');
      }
    } catch {
      toast.error('Network error while loading analytics');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    (async () => {
      await fetchAnalytics();
    })();
  }, [dateRange]);

  // Sort channels
  const sortedChannels = useMemo(() => {
    if (!analytics) return [];
    const sorted = [...analytics.data.channels];
    sorted.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [analytics, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Revenue distribution data
  const revenueDistribution = useMemo(() => {
    if (!analytics) return [];
    return analytics.data.channels
      .filter(c => c.revenue > 0)
      .map((c, i) => ({
        name: c.displayName,
        value: c.revenue,
        color: getChannelColor(i),
      }));
  }, [analytics]);

  // Summary data
  const summary = analytics?.data.summary;

  // ---- LOADING STATE ----
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Channel Analytics</h2>
            <p className="text-muted-foreground">Loading performance data...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-24 mb-3" />
                <div className="h-8 bg-muted rounded w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardContent className="p-4">
            <div className="h-64 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics || !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <BarChart3 className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Unable to load analytics data</p>
        <Button variant="outline" onClick={fetchAnalytics}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const hasData = analytics.data.channels.length > 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Channel Analytics
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Per-channel performance, revenue, and commission analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <CalendarDays className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchAnalytics}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Stats Overview Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Total Channel Revenue
            </div>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Net: {formatCurrency(summary.totalNetRevenue)}
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-emerald-50 to-transparent dark:from-emerald-950/20" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Globe className="h-4 w-4 text-blue-500" />
              Total Channel Bookings
            </div>
            <div className="text-2xl font-bold">{formatNumber(summary.totalBookings)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Across {summary.channelCount} channels
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-50 to-transparent dark:from-blue-950/20" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Percent className="h-4 w-4 text-amber-500" />
              Avg Commission Rate
            </div>
            <div className="text-2xl font-bold">{formatPercent(summary.avgCommissionRate)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Total: {formatCurrency(summary.totalCommissions)}
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-50 to-transparent dark:from-amber-950/20" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Award className="h-4 w-4 text-violet-500" />
              Best Channel
            </div>
            <div className="text-lg font-bold truncate">
              {summary.bestChannel?.name || 'N/A'}
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              {summary.bestChannel ? formatCurrency(summary.bestChannel.revenue) : 'No data'}
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-violet-50 to-transparent dark:from-violet-950/20" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Cancellation Rate
            </div>
            <div className={cn(
              'text-2xl font-bold',
              summary.overallCancellationRate > 20 ? 'text-red-600 dark:text-red-400' :
              summary.overallCancellationRate > 10 ? 'text-amber-600 dark:text-amber-400' :
              'text-emerald-600 dark:text-emerald-400'
            )}>
              {formatPercent(summary.overallCancellationRate)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary.totalBookings > 0 ? 'Of all bookings' : 'No bookings'}
            </div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-red-50 to-transparent dark:from-red-950/20" />
          </CardContent>
        </Card>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Globe className="h-16 w-16 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-muted-foreground">No Channel Data</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              No bookings from external channels found in the selected period. Connect OTA channels to see analytics.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="trends" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="commission" className="gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Commission
            </TabsTrigger>
            <TabsTrigger value="performers" className="gap-1.5">
              <Award className="h-3.5 w-3.5" />
              Performers
            </TabsTrigger>
            <TabsTrigger value="leadtime" className="gap-1.5">
              <Timer className="h-3.5 w-3.5" />
              Lead Time
            </TabsTrigger>
          </TabsList>

          {/* ====== OVERVIEW TAB ====== */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Revenue Distribution + Table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Revenue Distribution Donut */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <PieChart className="h-4 w-4" />
                    Revenue Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative flex flex-col items-center py-4">
                  <DonutChart data={revenueDistribution} totalRevenue={summary.totalRevenue} />
                  {/* Legend */}
                  <div className="w-full mt-4 space-y-2 max-h-48 overflow-y-auto px-2">
                    {revenueDistribution.map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="truncate max-w-[120px]">{item.name}</span>
                        </div>
                        <span className="font-medium text-muted-foreground">
                          {formatPercent((item.value / summary.totalRevenue) * 100)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Channel Performance Table */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Table className="h-4 w-4" />
                    Channel Performance
                  </CardTitle>
                  <CardDescription>Click column headers to sort</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[420px]">
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('displayName')}>
                            <div className="flex items-center gap-1">
                              Channel <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 text-right" onClick={() => handleSort('bookings')}>
                            <div className="flex items-center justify-end gap-1">
                              Bookings <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 text-right" onClick={() => handleSort('revenue')}>
                            <div className="flex items-center justify-end gap-1">
                              Revenue <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead className="text-right">ADR</TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 text-right" onClick={() => handleSort('cancellationRate')}>
                            <div className="flex items-center justify-end gap-1">
                              Cancel % <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 text-right" onClick={() => handleSort('commissionTotal')}>
                            <div className="flex items-center justify-end gap-1">
                              Commission <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 text-right" onClick={() => handleSort('netRevenue')}>
                            <div className="flex items-center justify-end gap-1">
                              Net Revenue <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead className="text-right">Sync</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedChannels.map((ch, i) => (
                          <TableRow key={ch.channel} className="group">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-8 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: getChannelColor(i) }}
                                />
                                <span className="font-medium text-sm truncate max-w-[130px]">{ch.displayName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {ch.bookings}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(ch.revenue)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-muted-foreground">
                              {formatCurrency(ch.adr)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs',
                                  ch.cancellationRate > 20
                                    ? 'border-red-200 text-red-700 dark:text-red-400'
                                    : ch.cancellationRate > 10
                                      ? 'border-amber-200 text-amber-700 dark:text-amber-400'
                                      : 'border-emerald-200 text-emerald-700 dark:text-emerald-400'
                                )}
                              >
                                {formatPercent(ch.cancellationRate)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-red-600 dark:text-red-400">
                              {formatCurrency(ch.commissionTotal)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold">
                              {formatCurrency(ch.netRevenue)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {getSyncStatusIcon(ch.syncSuccessRate)}
                                {ch.syncTotal > 0 ? (
                                  <span className="text-xs text-muted-foreground">{formatPercent(ch.syncSuccessRate)}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ====== TRENDS TAB ====== */}
          <TabsContent value="trends" className="space-y-6 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Booking Trend (Last 30 Days)
                </CardTitle>
                <CardDescription>Daily bookings stacked by channel</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendBarChart trend={analytics.data.dailyTrend} channels={analytics.data.channels} />
              </CardContent>
            </Card>

            {/* Revenue trend by channel as mini cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {analytics.data.channels.slice(0, 6).map((ch, i) => {
                const channelTrend = analytics.data.dailyTrend
                  .filter(t => t.channel === ch.channel)
                  .sort((a, b) => a.date.localeCompare(b.date));

                const firstHalfRevenue = channelTrend
                  .slice(0, Math.floor(channelTrend.length / 2))
                  .reduce((s, t) => s + t.revenue, 0);
                const secondHalfRevenue = channelTrend
                  .slice(Math.floor(channelTrend.length / 2))
                  .reduce((s, t) => s + t.revenue, 0);

                const trendPct = firstHalfRevenue > 0
                  ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100
                  : 0;
                const isUp = trendPct >= 0;

                return (
                  <Card key={ch.channel}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: getChannelColor(i) }} />
                          <span className="font-medium text-sm truncate max-w-[140px]">{ch.displayName}</span>
                        </div>
                        {isUp ? (
                          <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="text-xl font-bold">{formatCurrency(ch.revenue)}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className={cn('text-xs font-medium', isUp ? 'text-emerald-600' : 'text-red-600')}>
                          {isUp ? '+' : ''}{formatPercent(trendPct)}
                        </span>
                        <span className="text-xs text-muted-foreground">trend</span>
                      </div>
                      <div className="mt-2">
                        <Progress value={summary.totalRevenue > 0 ? (ch.revenue / summary.totalRevenue) * 100 : 0} className="h-1.5" />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatPercent(summary.totalRevenue > 0 ? (ch.revenue / summary.totalRevenue) * 100 : 0)} of total
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ====== COMMISSION TAB ====== */}
          <TabsContent value="commission" className="space-y-6 mt-4">
            {/* Commission Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Total Commission Cost</div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {formatCurrencyFull(summary.totalCommissions)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatPercent((summary.totalCommissions / (summary.totalRevenue || 1)) * 100)} of revenue
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Net Revenue After Commission</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrencyFull(summary.totalNetRevenue)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(summary.totalRevenue)} - {formatCurrency(summary.totalCommissions)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Effective Commission Rate</div>
                  <div className="text-2xl font-bold">{formatPercent(summary.avgCommissionRate)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Average across all channels
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Commission Breakdown Table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Per-Channel Commission Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[400px]">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Channel</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Net Revenue</TableHead>
                        <TableHead className="text-right min-w-[160px]">Commission Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.data.channels
                        .filter(c => c.revenue > 0)
                        .sort((a, b) => b.commissionTotal - a.commissionTotal)
                        .map((ch, i) => (
                          <TableRow key={ch.channel}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: getChannelColor(i) }} />
                                <span className="font-medium text-sm">{ch.displayName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrencyFull(ch.revenue)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-red-600 dark:text-red-400">
                              {formatCurrencyFull(ch.commissionTotal)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="text-xs">
                                {formatPercent(ch.commissionRate)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatCurrencyFull(ch.netRevenue)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Progress
                                  value={summary.totalCommissions > 0 ? (ch.commissionTotal / summary.totalCommissions) * 100 : 0}
                                  className="h-2 w-24"
                                />
                                <span className="text-xs text-muted-foreground w-12 text-right">
                                  {summary.totalCommissions > 0 ? formatPercent((ch.commissionTotal / summary.totalCommissions) * 100) : '0%'}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== PERFORMERS TAB ====== */}
          <TabsContent value="performers" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Performers */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                    Top Performers (by Net Revenue)
                  </CardTitle>
                  <CardDescription>Highest-performing channels</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analytics.data.topPerformers.length > 0 ? (
                    analytics.data.topPerformers.map((ch, i) => (
                      <div key={ch.channel} className="flex items-center gap-3 p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/50">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold text-sm flex-shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{ch.displayName}</div>
                          <div className="text-xs text-muted-foreground">
                            {ch.bookings} bookings &middot; {formatCurrency(ch.adr)} ADR
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(ch.netRevenue)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatPercent(ch.commissionRate)} comm.
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      No performance data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bottom Performers */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
                    <TrendingDown className="h-4 w-4" />
                    Needs Attention (Lowest Net Revenue)
                  </CardTitle>
                  <CardDescription>Channels that may need optimization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analytics.data.bottomPerformers.length > 0 ? (
                    analytics.data.bottomPerformers.map((ch, i) => (
                      <div key={ch.channel} className="flex items-center gap-3 p-3 rounded-lg border bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900/50">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-bold text-sm flex-shrink-0">
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{ch.displayName}</div>
                          <div className="text-xs text-muted-foreground">
                            {ch.bookings} bookings &middot; {formatPercent(ch.cancellationRate)} cancel
                            {ch.commissionRate > summary.avgCommissionRate && (
                              <span className="text-red-500 ml-1">&middot; High commission</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-sm text-red-600 dark:text-red-400">
                            {formatCurrency(ch.netRevenue)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(ch.revenue)} gross
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      All channels performing well
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sync Health Overview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Channel Sync Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analytics.data.channels.map((ch, i) => (
                    <div key={ch.channel} className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="w-3 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: getChannelColor(i) }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{ch.displayName}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {getSyncStatusIcon(ch.syncSuccessRate)}
                          {ch.syncTotal > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {formatPercent(ch.syncSuccessRate)} success ({ch.syncErrors} errors)
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No sync data</span>
                          )}
                        </div>
                      </div>
                      {ch.lastSyncAt && (
                        <div className="text-xs text-muted-foreground flex-shrink-0">
                          <Clock className="h-3 w-3 inline mr-0.5" />
                          {new Date(ch.lastSyncAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== LEAD TIME TAB ====== */}
          <TabsContent value="leadtime" className="space-y-6 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  Average Booking Lead Time by Channel
                </CardTitle>
                <CardDescription>
                  Days between booking creation and check-in date
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analytics.data.channels.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {analytics.data.channels
                        .sort((a, b) => b.avgLeadTimeDays - a.avgLeadTimeDays)
                        .map((ch, i) => {
                          const maxLead = Math.max(
                            ...analytics.data.channels.map(c => c.avgLeadTimeDays),
                            1
                          );
                          const leadPct = (ch.avgLeadTimeDays / maxLead) * 100;

                          return (
                            <div key={ch.channel} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: getChannelColor(i) }} />
                                  <span className="text-sm font-medium">{ch.displayName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold">{formatDays(ch.avgLeadTimeDays)}</span>
                                  <span className="text-xs text-muted-foreground">({ch.bookings} bookings)</span>
                                </div>
                              </div>
                              <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                  className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${leadPct}%`,
                                    backgroundColor: getChannelColor(i),
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    <Separator />

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <Target className="h-4 w-4 flex-shrink-0" />
                      <span>
                        Channels with longer lead times allow better revenue management and upsell opportunities.
                        Short lead times may indicate last-minute bookings (walk-in or OTA same-day).
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No lead time data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default ChannelAnalytics;
