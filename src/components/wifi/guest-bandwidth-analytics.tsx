'use client';

/**
 * Guest Bandwidth Analytics Dashboard
 *
 * Shows bandwidth usage patterns across all guests:
 * - Top 10 bandwidth consumers (horizontal bar chart)
 * - Bandwidth distribution pie chart (categories)
 * - Average usage per session card
 * - Peak usage hour heatmap (24-hour bar chart)
 * - Usage trend line (last 7 days)
 * - Heavy Users alert
 * - Export CSV button
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  BarChart3,
  TrendingUp,
  Users,
  Download,
  Upload,
  AlertTriangle,
  RefreshCw,
  FileDown,
  Clock,
  PieChart as PieChartIcon,
  Activity,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePropertyId } from '@/hooks/use-property';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface TopConsumer {
  username: string;
  downloadMB: number;
  uploadMB: number;
  totalMB: number;
  totalGB: number;
}

interface DistributionBucket {
  label: string;
  count: number;
  totalMB: number;
}

interface PeakHour {
  hour: number;
  label: string;
  totalMB: number;
}

interface TrendDay {
  date: string;
  label: string;
  totalMB: number;
  users: number;
}

interface AnalyticsData {
  topConsumers: TopConsumer[];
  distribution: DistributionBucket[];
  summary: {
    totalUsers: number;
    totalUsageMB: number;
    avgUsagePerSessionMB: number;
    totalSessions: number;
    heavyUserCount: number;
  };
  peakHours: PeakHour[];
  trend: TrendDay[];
  heavyUsers: string[];
  csvData: {
    headers: string[];
    rows: (string | number)[][];
  };
  dateRange: {
    start: string;
    end: string;
  };
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#10b981', '#f59e0b', '#6366f1', '#ef4444'];

const CHART_COLORS = {
  download: '#10b981',
  upload: '#f59e0b',
  trend: '#10b981',
  peak: '#f59e0b',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMB(mb: number): string {
  if (mb >= 1048576) return `${(mb / 1048576).toFixed(1)} TB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toLocaleString()} MB`;
}

// ─── Custom Chart Tooltips ──────────────────────────────────────────────────────

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-lg text-xs">
      <p className="font-medium mb-1 truncate max-w-48">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium">{formatMB(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-lg text-xs">
      <p className="font-medium">{d.name}</p>
      <p className="text-muted-foreground">
        Users: <span className="font-mono font-medium">{d.payload.count}</span>
      </p>
      <p className="text-muted-foreground">
        Total: <span className="font-mono font-medium">{formatMB(d.payload.totalMB)}</span>
      </p>
    </div>
  );
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-lg text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium">{formatMB(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

function PeakTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-lg text-xs">
      <p className="font-medium mb-1">{label}</p>
      <p className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS.peak }} />
        <span className="text-muted-foreground">Usage:</span>
        <span className="font-mono font-medium">{formatMB(payload[0].value)}</span>
      </p>
    </div>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function GuestBandwidthAnalytics() {
  const { propertyId } = usePropertyId();
  const { toast } = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (propertyId) params.set('propertyId', propertyId);
      const res = await fetch(`/api/wifi/guest-analytics?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error?.message || 'Failed to fetch analytics');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExportCSV = useCallback(() => {
    if (!data) return;
    const csvRows = [data.csvData.headers.join(','), ...data.csvData.rows.map(r => r.join(','))];
    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guest-bandwidth-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'CSV file downloaded successfully' });
  }, [data, toast]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="font-medium">Failed to load analytics</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={fetchAnalytics}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // Prepare chart data
  const topConsumersChart = [...data.topConsumers].reverse().map(u => ({
    name: u.username.split('.').slice(-2).join('.'),
    fullName: u.username,
    download: u.downloadMB,
    upload: u.uploadMB,
  }));

  const distributionChart = data.distribution.map((d, i) => ({
    name: d.label,
    count: d.count,
    totalMB: d.totalMB,
    color: PIE_COLORS[i],
  }));

  const trendChart = data.trend.map(t => ({
    ...t,
    totalGB: Math.round((t.totalMB / 1024) * 100) / 100,
  }));

  const peakMax = Math.max(...data.peakHours.map(h => h.totalMB), 1);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Guest Bandwidth Analytics</span>
          <Badge variant="outline" className="text-xs">{data.summary.totalUsers} users</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <FileDown className="h-3.5 w-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Heavy Users Alert */}
      {data.summary.heavyUserCount > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Heavy Users Alert
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {data.heavyUsers.join(', ')} — exceeded 5GB/day
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {data.summary.heavyUserCount} user{data.summary.heavyUserCount > 1 ? 's' : ''}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Total Users</p>
              <p className="text-lg font-bold">{data.summary.totalUsers}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Download className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Total Usage</p>
              <p className="text-lg font-bold">{formatMB(data.summary.totalUsageMB)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Avg / Session</p>
              <p className="text-lg font-bold">{formatMB(data.summary.avgUsagePerSessionMB)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Clock className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Total Sessions</p>
              <p className="text-lg font-bold">{data.summary.totalSessions.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Heavy Users</p>
              <p className="text-lg font-bold">{data.summary.heavyUserCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Top 10 Consumers + Distribution */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Top 10 Consumers */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              Top 10 Bandwidth Consumers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topConsumersChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topConsumersChart} layout="vertical" margin={{ top: 0, right: 20, left: 90, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatMB(v)} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={85} />
                  <RechartsTooltip content={<BarTooltip />} />
                  <Bar dataKey="download" name="Download" fill={CHART_COLORS.download} radius={[0, 4, 4, 0]} barSize={12} stackId="a" />
                  <Bar dataKey="upload" name="Upload" fill={CHART_COLORS.upload} radius={[0, 4, 4, 0]} barSize={12} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bandwidth Distribution Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-muted-foreground" />
              Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {distributionChart.some(d => d.count > 0) ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={distributionChart}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="count"
                      nameKey="name"
                      strokeWidth={2}
                    >
                      {distributionChart.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 w-full">
                  {distributionChart.map((d, i) => (
                    <div key={d.label} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i] }} />
                      <span className="text-muted-foreground truncate">{d.label}</span>
                      <span className="font-mono font-medium ml-auto">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Peak Usage Hours + 7-Day Trend */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Peak Usage Hour Heatmap */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-500" />
              Peak Usage Hours (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-0.5 h-40">
              {data.peakHours.map((h) => {
                const intensity = peakMax > 0 ? h.totalMB / peakMax : 0;
                const isNow = new Date().getHours() === h.hour;
                return (
                  <div
                    key={h.hour}
                    className="flex-1 flex flex-col items-center gap-1 group relative"
                  >
                    <div
                      className={cn(
                        'w-full rounded-t transition-all',
                        isNow
                          ? 'bg-primary shadow-sm shadow-primary/30'
                          : intensity > 0.7
                            ? 'bg-amber-400 dark:bg-amber-500'
                            : intensity > 0.4
                              ? 'bg-amber-300 dark:bg-amber-600'
                              : 'bg-amber-200 dark:bg-amber-700/50'
                      )}
                      style={{ height: `${Math.max(4, intensity * 120)}px` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                      <div className="bg-background border rounded p-1.5 text-[10px] shadow-lg whitespace-nowrap">
                        <p className="font-medium">{h.label}</p>
                        <p className="text-muted-foreground">{formatMB(h.totalMB)}</p>
                      </div>
                    </div>
                    <span className="text-[8px] text-muted-foreground leading-none">
                      {h.hour % 3 === 0 ? h.hour.toString().padStart(2, '0') : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 7-Day Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              7-Day Usage Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={trendChart} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v} GB`} tickLine={false} axisLine={false} width={40} />
                  <RechartsTooltip content={<TrendTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="totalGB"
                    name="Usage"
                    stroke={CHART_COLORS.trend}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CHART_COLORS.trend }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[160px] text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Consumer Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
          <div className="max-h-64 overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-max">
              <thead>
                <tr className="bg-muted/50 text-xs">
                  <th className="text-left p-3 font-medium">#</th>
                  <th className="text-left p-3 font-medium">Username</th>
                  <th className="text-right p-3 font-medium">Download</th>
                  <th className="text-right p-3 font-medium">Upload</th>
                  <th className="text-right p-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.topConsumers.map((u, i) => (
                  <tr key={u.username} className="hover:bg-muted/30 text-sm">
                    <td className="p-3 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="p-3 font-medium font-mono text-xs">{u.username}</td>
                    <td className="p-3 text-right font-mono text-xs text-primary">{formatMB(u.downloadMB)}</td>
                    <td className="p-3 text-right font-mono text-xs text-amber-600 dark:text-amber-400">{formatMB(u.uploadMB)}</td>
                    <td className="p-3 text-right font-mono text-xs font-medium">{u.totalGB} GB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
