'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  TrendingUp,
  TrendingDown,
  CalendarDays,
  RefreshCw,
  Camera,
  Settings,
  BarChart3,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Globe,
  DollarSign,
  Activity,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Zap,
  Percent,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface PaceRow {
  daysBeforeBucket: number;
  currentBookings: number;
  currentRooms: number;
  currentRevenue: number;
  currentCancellations: number;
  comparisonBookings: number;
  comparisonRooms: number;
  comparisonRevenue: number;
  comparisonCancellations: number;
}

interface ChannelBreakdownRow {
  channel: string;
  currentBookings: number;
  currentRevenue: number;
  comparisonBookings: number;
  comparisonRevenue: number;
  variancePct: number;
}

interface PaceResponse {
  success: boolean;
  data: {
    paceData: PaceRow[];
    channelBreakdown: ChannelBreakdownRow[];
    channelNames: Record<string, string>;
    period: {
      arrivalFrom: string;
      arrivalTo: string;
      comparisonFrom: string;
      comparisonTo: string;
      comparisonPeriod: string;
      daySpan: number;
    };
    snapshotDate: string;
  };
}

interface SummaryResponse {
  success: boolean;
  data: {
    totalPace: number;
    totalPaceRevenue: number;
    paceVsLastYearPct: number;
    revenueVsLastYearPct: number;
    lastYearTotal: number;
    lastYearRevenue: number;
    topChannel: string;
    topChannelRevenue: number;
    topChannelDisplayName: string;
    onTrack: 'on_track' | 'ahead' | 'behind';
    paceADR: number;
    lastYearADR: number;
    cancelRate: number;
    snapshotCount: number;
    channelCount: number;
    periodLabel: string;
  };
}

interface ForecastResponse {
  success: boolean;
  data: {
    weekly: Array<{
      week: string;
      weekNumber: number;
      startDate: string;
      actualBookings: number;
      actualRevenue: number;
      forecastBookings: number;
      forecastRevenue: number;
      variance: number;
    }>;
    totalActual: number;
    totalRevenue: number;
    totalForecast: number;
    totalForecastRevenue: number;
    pacingPercent: number;
  };
}

interface PaceConfig {
  tenantId: string;
  comparisonPeriod: string;
  lookbackDays: number;
  paceIntervalDays: number;
  isActive: boolean;
  customPeriodFrom?: string | null;
  customPeriodTo?: string | null;
}

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
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const getVarianceColor = (value: number): string => {
  if (value > 10) return 'text-emerald-600 dark:text-emerald-400';
  if (value < -10) return 'text-red-600 dark:text-red-400';
  return 'text-amber-600 dark:text-amber-400';
};

const getVarianceBg = (value: number): string => {
  if (value > 10) return 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800';
  if (value < -10) return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800';
  return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800';
};

const getVarianceIcon = (value: number) => {
  if (value > 10) return <ArrowUpRight className="h-3.5 w-3.5" />;
  if (value < -10) return <ArrowDownRight className="h-3.5 w-3.5" />;
  return <Minus className="h-3.5 w-3.5" />;
};

const getOnTrackBadge = (status: string) => {
  switch (status) {
    case 'ahead':
      return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 gap-1"><ArrowUpRight className="h-3 w-3" /> Ahead of Pace</Badge>;
    case 'behind':
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-0 gap-1"><ArrowDownRight className="h-3 w-3" /> Behind Pace</Badge>;
    default:
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-0 gap-1"><Target className="h-3 w-3" /> On Track</Badge>;
  }
};

// ============================================
// MAIN COMPONENT
// ============================================

export function BookingPaceAnalysis() {
  const [summary, setSummary] = useState<SummaryResponse['data'] | null>(null);
  const [paceData, setPaceData] = useState<PaceResponse['data'] | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse['data'] | null>(null);
  const [config, setConfig] = useState<PaceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Filters
  const [arrivalFrom, setArrivalFrom] = useState('');
  const [arrivalTo, setArrivalTo] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [comparisonPeriod, setComparisonPeriod] = useState('same_period_last_year');

  // Config dialog
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/channels/booking-pace?action=summary');
      const data: SummaryResponse = await res.json();
      if (data.success) setSummary(data.data);
    } catch {
      // Silent fail for summary
    }
  }, []);

  // Fetch pace data
  const fetchPaceData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('action', 'pace');
      if (arrivalFrom) params.set('arrivalFrom', arrivalFrom);
      if (arrivalTo) params.set('arrivalTo', arrivalTo);
      if (channelFilter !== 'all') params.set('channelCode', channelFilter);
      if (comparisonPeriod !== 'same_period_last_year') params.set('comparisonPeriod', comparisonPeriod);

      const res = await fetch(`/api/channels/booking-pace?${params.toString()}`);
      const data: PaceResponse = await res.json();
      if (data.success) {
        setPaceData(data.data);
      } else {
        toast.error('Failed to load pace data');
      }
    } catch {
      toast.error('Network error loading pace data');
    } finally {
      setLoading(false);
    }
  }, [arrivalFrom, arrivalTo, channelFilter, comparisonPeriod]);

  // Fetch forecast
  const fetchForecast = useCallback(async () => {
    try {
      const res = await fetch('/api/channels/booking-pace?action=forecast');
      const data: ForecastResponse = await res.json();
      if (data.success) setForecast(data.data);
    } catch {
      // Silent fail for forecast
    }
  }, []);

  // Fetch config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/channels/booking-pace?action=config');
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
        setComparisonPeriod(data.data.comparisonPeriod || 'same_period_last_year');
      }
    } catch {
      // Silent fail
    }
  }, []);

  // Take snapshot
  const takeSnapshot = async () => {
    setSnapshotting(true);
    try {
      const res = await fetch('/api/channels/booking-pace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot', lookbackDays: config?.lookbackDays || 90 }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Snapshot created: ${data.data.snapshotsCreated} records captured`);
        fetchSummary();
      } else {
        toast.error('Failed to create snapshot');
      }
    } catch {
      toast.error('Network error creating snapshot');
    } finally {
      setSnapshotting(false);
    }
  };

  // Save config
  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/channels/booking-pace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-config',
          comparisonPeriod,
          lookbackDays: config?.lookbackDays || 90,
          paceIntervalDays: config?.paceIntervalDays || 1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Configuration updated');
        setConfig(data.data);
        setConfigDialogOpen(false);
        fetchPaceData();
        fetchSummary();
      } else {
        toast.error('Failed to update configuration');
      }
    } catch {
      toast.error('Network error updating configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  // Initial load
  useEffect(() => {
    (async () => {
      await Promise.all([fetchSummary(), fetchPaceData(), fetchForecast(), fetchConfig()]);
    })();
  }, []);

  // Refetch pace when filters change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchPaceData();
    })();
    return () => { cancelled = true; };
  }, [fetchPaceData]);

  // ---- LOADING STATE ----
  if (loading && !paceData) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Booking Pace Analysis</h2>
            <p className="text-muted-foreground">Loading pace data...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
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

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Booking Pace / Pick-up Analysis
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Track booking velocity vs historical periods — see if you&apos;re on track
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={takeSnapshot} disabled={snapshotting}>
            {snapshotting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
            Take Snapshot
          </Button>
          <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pace Analysis Settings</DialogTitle>
                <DialogDescription>Configure the comparison period and other analysis parameters.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Comparison Period</Label>
                  <Select value={comparisonPeriod} onValueChange={setComparisonPeriod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="same_period_last_year">Same Period Last Year</SelectItem>
                      <SelectItem value="same_period_last_month">Same Period Last Month</SelectItem>
                      <SelectItem value="rolling_30_days">Rolling 30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Lookback Days</Label>
                  <Input
                    type="number"
                    value={config?.lookbackDays || 90}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, lookbackDays: parseInt(e.target.value) || 90 } : null)}
                    min={7}
                    max={365}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pace Interval (Days)</Label>
                  <Select
                    value={String(config?.paceIntervalDays || 1)}
                    onValueChange={(v) => setConfig(prev => prev ? { ...prev, paceIntervalDays: parseInt(v) } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Daily (1 day)</SelectItem>
                      <SelectItem value="3">Every 3 days</SelectItem>
                      <SelectItem value="7">Weekly (7 days)</SelectItem>
                      <SelectItem value="14">Bi-weekly (14 days)</SelectItem>
                      <SelectItem value="30">Monthly (30 days)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>Cancel</Button>
                <Button onClick={saveConfig} disabled={savingConfig}>
                  {savingConfig ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save Settings
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="icon" onClick={() => { fetchSummary(); fetchPaceData(); fetchForecast(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <BarChart3 className="h-4 w-4 text-teal-500" />
                Current Pace ({summary.periodLabel})
              </div>
              <div className="text-2xl font-bold">{formatNumber(summary.totalPace)}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={cn('text-xs font-medium', getVarianceColor(summary.paceVsLastYearPct))}>
                  {formatPercent(summary.paceVsLastYearPct)} vs last year
                </span>
                {getVarianceIcon(summary.paceVsLastYearPct)}
              </div>
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-teal-50 to-transparent dark:from-teal-950/20" />
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Pace Revenue
              </div>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalPaceRevenue)}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={cn('text-xs font-medium', getVarianceColor(summary.revenueVsLastYearPct))}>
                  {formatPercent(summary.revenueVsLastYearPct)} revenue
                </span>
                {getVarianceIcon(summary.revenueVsLastYearPct)}
              </div>
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-emerald-50 to-transparent dark:from-emerald-950/20" />
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Target className="h-4 w-4 text-violet-500" />
                Pace Status
              </div>
              <div className="mt-1">
                {getOnTrackBadge(summary.onTrack)}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                ADR: {formatCurrencyFull(summary.paceADR)} ({summary.lastYearADR > 0 ? formatPercent(((summary.paceADR - summary.lastYearADR) / summary.lastYearADR) * 100) : 'N/A'})
              </div>
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-violet-50 to-transparent dark:from-violet-950/20" />
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Globe className="h-4 w-4 text-amber-500" />
                Top Channel
              </div>
              <div className="text-lg font-bold truncate">{summary.topChannelDisplayName}</div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(summary.topChannelRevenue)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {summary.channelCount} channels active
              </div>
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-50 to-transparent dark:from-amber-950/20" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 flex-1 w-full">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Arrival From</Label>
                <Input
                  type="date"
                  value={arrivalFrom}
                  onChange={(e) => setArrivalFrom(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Arrival To</Label>
                <Input
                  type="date"
                  value={arrivalTo}
                  onChange={(e) => setArrivalTo(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Channel</Label>
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Channels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    {paceData?.channelBreakdown.map(ch => (
                      <SelectItem key={ch.channel} value={ch.channel}>
                        {paceData.channelNames[ch.channel] || ch.channel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Compare To</Label>
                <Select value={comparisonPeriod} onValueChange={setComparisonPeriod}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="same_period_last_year">Same Period Last Year</SelectItem>
                    <SelectItem value="same_period_last_month">Same Period Last Month</SelectItem>
                    <SelectItem value="rolling_30_days">Rolling 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button variant="outline" size="sm" className="shrink-0" onClick={fetchPaceData}>
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Pace Chart
          </TabsTrigger>
          <TabsTrigger value="comparison" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Comparison Table
          </TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Channel Breakdown
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Forecast
          </TabsTrigger>
        </TabsList>

        {/* ====== PACE CHART TAB ====== */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {paceData && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Pick-up Curve
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Current period vs {paceData.period.comparisonPeriod.replace(/_/g, ' ')} ({paceData.period.daySpan} days)
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-teal-500" />
                        <span className="text-muted-foreground">Current</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-slate-400 dark:bg-slate-500" />
                        <span className="text-muted-foreground">Comparison</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <PaceBarChart paceData={paceData.paceData} channelNames={paceData.channelNames} />
                </CardContent>
              </Card>

              {/* Period info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm font-medium mb-2">Current Period</div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>From</span>
                        <span className="font-mono">{new Date(paceData.period.arrivalFrom).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>To</span>
                        <span className="font-mono">{new Date(paceData.period.arrivalTo).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total bookings</span>
                        <span className="font-mono font-medium text-foreground">
                          {paceData.paceData.reduce((s, r) => s + r.currentBookings, 0)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm font-medium mb-2">Comparison Period</div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>From</span>
                        <span className="font-mono">{new Date(paceData.period.comparisonFrom).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>To</span>
                        <span className="font-mono">{new Date(paceData.period.comparisonTo).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total bookings</span>
                        <span className="font-mono font-medium text-foreground">
                          {paceData.paceData.reduce((s, r) => s + r.comparisonBookings, 0)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ====== COMPARISON TABLE TAB ====== */}
        <TabsContent value="comparison" className="space-y-6 mt-4">
          {paceData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Days Before Arrival — Pace Comparison
                </CardTitle>
                <CardDescription>Shows cumulative bookings per days-before-arrival bucket for current vs comparison period</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky top-0 bg-background z-10">Days Before</TableHead>
                        <TableHead className="text-right sticky top-0 bg-background z-10">Current Bookings</TableHead>
                        <TableHead className="text-right sticky top-0 bg-background z-10">Current Revenue</TableHead>
                        <TableHead className="text-right sticky top-0 bg-background z-10">Comp. Bookings</TableHead>
                        <TableHead className="text-right sticky top-0 bg-background z-10">Comp. Revenue</TableHead>
                        <TableHead className="text-right sticky top-0 bg-background z-10">Variance</TableHead>
                        <TableHead className="text-right sticky top-0 bg-background z-10">Variance %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paceData.paceData.map((row) => {
                        const variance = row.currentBookings - row.comparisonBookings;
                        const variancePct = row.comparisonBookings > 0
                          ? ((row.currentBookings - row.comparisonBookings) / row.comparisonBookings) * 100
                          : row.currentBookings > 0 ? 100 : 0;

                        return (
                          <TableRow key={row.daysBeforeBucket}>
                            <TableCell className="font-mono text-sm">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  'w-2 h-6 rounded-full flex-shrink-0',
                                  variancePct > 10 ? 'bg-emerald-400' : variancePct < -10 ? 'bg-red-400' : 'bg-amber-400'
                                )} />
                                {row.daysBeforeBucket === 0 ? '0 (Today)' : `${row.daysBeforeBucket}`}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-medium">
                              {row.currentBookings}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(row.currentRevenue)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {row.comparisonBookings}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(row.comparisonRevenue)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs font-mono',
                                  getVarianceBg(variancePct),
                                  getVarianceColor(variancePct),
                                )}
                              >
                                {variance >= 0 ? '+' : ''}{variance}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className={cn('text-xs font-medium', getVarianceColor(variancePct))}>
                                  {formatPercent(variancePct)}
                                </span>
                                {getVarianceIcon(variancePct)}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ====== CHANNEL BREAKDOWN TAB ====== */}
        <TabsContent value="channels" className="space-y-6 mt-4">
          {paceData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Per-Channel Pace Comparison
                </CardTitle>
                <CardDescription>How each channel&apos;s current pace compares to the same period historically</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Channel</TableHead>
                        <TableHead className="text-right">Current Bookings</TableHead>
                        <TableHead className="text-right">Current Revenue</TableHead>
                        <TableHead className="text-right">Comp. Bookings</TableHead>
                        <TableHead className="text-right">Comp. Revenue</TableHead>
                        <TableHead className="text-right">Variance %</TableHead>
                        <TableHead className="text-right min-w-[120px]">Pace</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paceData.channelBreakdown.map((ch) => (
                        <TableRow key={ch.channel}>
                          <TableCell>
                            <span className="font-medium text-sm">
                              {paceData.channelNames[ch.channel] || ch.channel}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {ch.currentBookings}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(ch.currentRevenue)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            {ch.comparisonBookings}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            {formatCurrency(ch.comparisonRevenue)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className={cn('text-xs font-medium', getVarianceColor(ch.variancePct))}>
                                {formatPercent(ch.variancePct)}
                              </span>
                              {getVarianceIcon(ch.variancePct)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-end gap-2">
                                    <Progress
                                      value={Math.min(100, Math.max(0, ch.variancePct > 0 ? 100 : (100 + ch.variancePct)))}
                                      className={cn(
                                        'h-2 w-20',
                                        ch.variancePct > 10 ? '[&>div]:bg-emerald-500' :
                                        ch.variancePct < -10 ? '[&>div]:bg-red-500' :
                                        '[&>div]:bg-amber-500'
                                      )}
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{formatPercent(ch.variancePct)} vs comparison</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      ))}
                      {paceData.channelBreakdown.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                            No channel data available for the selected period.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ====== FORECAST TAB ====== */}
        <TabsContent value="forecast" className="space-y-6 mt-4">
          {forecast && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Total Actual Bookings</div>
                    <div className="text-2xl font-bold">{formatNumber(forecast.totalActual)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Revenue: {formatCurrency(forecast.totalRevenue)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Total Forecast</div>
                    <div className="text-2xl font-bold">{formatNumber(forecast.totalForecast)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Revenue: {formatCurrency(forecast.totalForecastRevenue)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Pacing</div>
                    <div className={cn(
                      'text-2xl font-bold',
                      getVarianceColor(forecast.pacingPercent - 100)
                    )}>
                      {forecast.pacingPercent.toFixed(1)}%
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={cn('text-xs font-medium', getVarianceColor(forecast.pacingPercent - 100))}>
                        {formatPercent(forecast.pacingPercent - 100)} of forecast
                      </span>
                      {getVarianceIcon(forecast.pacingPercent - 100)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Weekly Forecast vs Actual
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Week</TableHead>
                          <TableHead className="text-right">Starts</TableHead>
                          <TableHead className="text-right">Actual</TableHead>
                          <TableHead className="text-right">Forecast</TableHead>
                          <TableHead className="text-right">Variance</TableHead>
                          <TableHead className="text-right min-w-[100px]">Pacing</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {forecast.weekly.map((w) => {
                          const pacing = w.forecastBookings > 0
                            ? (w.actualBookings / w.forecastBookings) * 100
                            : w.actualBookings > 0 ? 150 : 0;
                          return (
                            <TableRow key={w.week}>
                              <TableCell className="font-medium text-sm">Week {w.weekNumber}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground font-mono">
                                {new Date(w.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">{w.actualBookings}</TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">{w.forecastBookings}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <span className={cn('text-xs font-medium', getVarianceColor(w.variance))}>
                                    {w.variance >= 0 ? '+' : ''}{w.variance}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Progress
                                  value={Math.min(100, pacing)}
                                  className={cn(
                                    'h-2 w-20',
                                    pacing > 110 ? '[&>div]:bg-emerald-500' :
                                    pacing < 90 ? '[&>div]:bg-red-500' :
                                    '[&>div]:bg-amber-500'
                                  )}
                                />
                                <span className={cn('text-xs ml-2', getVarianceColor(pacing - 100))}>
                                  {pacing.toFixed(0)}%
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Info Banner */}
      <Card className="bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-slate-500 mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong className="text-foreground">Booking Pace</strong> tracks how quickly bookings are being made compared to historical periods.
                The &quot;pick-up curve&quot; shows bookings made X days before arrival.
              </p>
              <p>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Green</span> = ahead of pace,
                <span className="inline-flex items-center gap-1 ml-2"><span className="w-2 h-2 rounded-full bg-amber-500" /> Yellow</span> = on track (±10%),
                <span className="inline-flex items-center gap-1 ml-2"><span className="w-2 h-2 rounded-full bg-red-500" /> Red</span> = behind pace.
                Use &quot;Take Snapshot&quot; to capture today&apos;s booking state for future comparison.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// PACE BAR CHART COMPONENT (CSS-based)
// ============================================

function PaceBarChart({ paceData }: { paceData: PaceRow[] }) {
  if (paceData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No pace data available for the selected period
      </div>
    );
  }

  const maxBookings = Math.max(1, ...paceData.map(r => Math.max(r.currentBookings, r.comparisonBookings)));
  const barWidth = Math.max(12, Math.min(32, 700 / paceData.length));

  return (
    <ScrollArea className="w-full" style={{ maxHeight: 320 }}>
      <div className="flex items-end gap-1" style={{ height: 260, minWidth: Math.max(400, paceData.length * (barWidth + 3)) }}>
        <TooltipProvider>
          {paceData.map((row) => {
            const currentHeight = (row.currentBookings / maxBookings) * 230;
            const compHeight = (row.comparisonBookings / maxBookings) * 230;
            const variancePct = row.comparisonBookings > 0
              ? ((row.currentBookings - row.comparisonBookings) / row.comparisonBookings) * 100
              : row.currentBookings > 0 ? 100 : 0;

            const barColor = variancePct > 10 ? 'bg-teal-500' : variancePct < -10 ? 'bg-red-400' : 'bg-amber-400';

            return (
              <Tooltip key={row.daysBeforeBucket}>
                <TooltipTrigger asChild>
                  <div
                    className="relative flex-shrink-0 cursor-pointer group"
                    style={{ width: barWidth, height: '100%' }}
                  >
                    {/* Comparison bar (background, lighter) */}
                    {row.comparisonBookings > 0 && (
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t-sm bg-slate-200 dark:bg-slate-700 transition-all duration-200 group-hover:opacity-70"
                        style={{ height: compHeight }}
                      />
                    )}
                    {/* Current bar */}
                    {row.currentBookings > 0 && (
                      <div
                        className={cn(
                          'absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-200 group-hover:opacity-80',
                          barColor
                        )}
                        style={{ height: currentHeight }}
                      />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs space-y-1">
                    <div className="font-semibold">
                      {row.daysBeforeBucket === 0 ? 'Today' : `${row.daysBeforeBucket} days before`}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-sm bg-teal-500" />
                      Current: {row.currentBookings} bookings
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-sm bg-slate-400" />
                      Comparison: {row.comparisonBookings} bookings
                    </div>
                    <div className={cn('font-medium', getVarianceColor(variancePct))}>
                      {formatPercent(variancePct)}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    </ScrollArea>
  );
}
