'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  DollarSign,
  CalendarDays,
  Users,
  Download,
  RefreshCw,
  Loader2,
  Star,
  XCircle,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface RevenueSummary {
  totalRevenue: number;
  totalBookings: number;
  avgBookingValue: number;
  cancellationRate: number;
}

interface RevenueByExperience {
  experienceId: string;
  experienceName: string;
  category: string | null;
  revenue: number;
  bookings: number;
  avgBookingValue: number;
}

interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

interface TrendData {
  period: string;
  revenue: number;
  bookings: number;
}

interface RevenueData {
  summary: RevenueSummary;
  revenueByExperience: RevenueByExperience[];
  statusDistribution: StatusDistribution[];
  trendData: TrendData[];
  topExperiences: RevenueByExperience[];
  dateRange: { start: string; end: string };
}

const statusColors: Record<string, string> = {
  confirmed: 'bg-emerald-500',
  completed: 'bg-emerald-600',
  pending: 'bg-amber-500',
  cancelled: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  confirmed: 'Confirmed',
  completed: 'Completed',
  pending: 'Pending',
  cancelled: 'Cancelled',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
}

function DateRangePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-44">
        <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
        <SelectValue placeholder="Date Range" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="today">Today</SelectItem>
        <SelectItem value="week">This Week</SelectItem>
        <SelectItem value="month">This Month</SelectItem>
        <SelectItem value="quarter">This Quarter</SelectItem>
        <SelectItem value="year">This Year</SelectItem>
      </SelectContent>
    </Select>
  );
}

function getDateRange(preset: string) {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'week':
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      start.setMonth(q * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(q * 3 + 3, 0, 23, 59, 59, 999);
      break;
    }
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export default function ExperienceRevenue() {
  const { toast } = useToast();
  const [data, setData] = useState<RevenueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [datePreset, setDatePreset] = useState('month');
  const [groupPeriod, setGroupPeriod] = useState<'week' | 'month'>('week');

  const fetchRevenue = useCallback(async () => {
    setIsLoading(true);
    try {
      const range = getDateRange(datePreset);
      const params = new URLSearchParams({
        startDate: range.startDate,
        endDate: range.endDate,
        groupBy: groupPeriod,
      });

      const response = await fetch(`/api/experience-revenue?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching revenue data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch revenue data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [datePreset, groupPeriod, toast]);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ['Experience', 'Category', 'Revenue', 'Bookings', 'Avg Value'],
      ...data.revenueByExperience.map(r => [
        r.experienceName,
        r.category || '',
        r.revenue.toFixed(2),
        r.bookings.toString(),
        r.avgBookingValue.toFixed(2),
      ]),
    ];
    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `experience-revenue-${datePreset}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Success', description: 'Revenue data exported as CSV' });
  };

  const maxRevenue = data
    ? Math.max(...data.revenueByExperience.map(r => r.revenue), 1)
    : 1;

  const maxTrendRevenue = data
    ? Math.max(...data.trendData.map(t => t.revenue), 1)
    : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Experience Revenue Analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Track revenue, bookings, and performance across all experiences
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <DateRangePicker value={datePreset} onChange={setDatePreset} />
          <Button variant="outline" size="sm" onClick={fetchRevenue}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.revenueByExperience.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">No revenue data found</p>
            <p className="text-sm mt-1">Experience bookings will appear here once guests start booking</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{formatCurrency(data.summary.totalRevenue)}</div>
                  <div className="text-xs text-muted-foreground">Total Revenue</div>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <CalendarDays className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{data.summary.totalBookings}</div>
                  <div className="text-xs text-muted-foreground">Total Bookings</div>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Users className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{formatCurrency(data.summary.avgBookingValue)}</div>
                  <div className="text-xs text-muted-foreground">Avg Booking Value</div>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{data.summary.cancellationRate}%</div>
                  <div className="text-xs text-muted-foreground">Cancellation Rate</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Charts */}
          <Tabs defaultValue="bar" className="space-y-4">
            <TabsList>
              <TabsTrigger value="bar">Revenue by Experience</TabsTrigger>
              <TabsTrigger value="trend">Revenue Trend</TabsTrigger>
              <TabsTrigger value="status">Booking Status</TabsTrigger>
            </TabsList>

            {/* Bar Chart */}
            <TabsContent value="bar">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Revenue by Experience</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {data.revenueByExperience.map((item, idx) => (
                      <div key={item.experienceId} className="space-y-1">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-medium truncate mr-4">{item.experienceName}</span>
                          <span className="text-muted-foreground whitespace-nowrap">{formatCurrency(item.revenue)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-3">
                          <div
                            className="h-3 rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
                            style={{ width: `${(item.revenue / maxRevenue) * 100}%` }}
                          />
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>{item.bookings} bookings</span>
                          <span>Avg: {formatCurrency(item.avgBookingValue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Trend Line */}
            <TabsContent value="trend">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">Revenue Trend</CardTitle>
                    <Select value={groupPeriod} onValueChange={(v) => setGroupPeriod(v as 'week' | 'month')}>
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">Weekly</SelectItem>
                        <SelectItem value="month">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {data.trendData.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground">
                      No trend data available
                    </div>
                  ) : (
                    <div className="flex items-end gap-2 h-48">
                      {data.trendData.map((item, idx) => {
                        const height = (item.revenue / maxTrendRevenue) * 100;
                        const prevRevenue = idx > 0 ? data.trendData[idx - 1].revenue : item.revenue;
                        const isUp = item.revenue >= prevRevenue;
                        return (
                          <div key={item.period} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {formatCurrency(item.revenue)}
                            </span>
                            <div className="w-full flex justify-center">
                              {isUp ? (
                                <ArrowUpRight className="h-3 w-3 text-primary" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3 text-red-500" />
                              )}
                            </div>
                            <div
                              className={cn(
                                'w-full rounded-t transition-all duration-500 max-w-12',
                                isUp ? 'bg-primary' : 'bg-red-400'
                              )}
                              style={{ height: `${Math.max(height, 4)}px` }}
                              title={`${item.period}: ${formatCurrency(item.revenue)} (${item.bookings} bookings)`}
                            />
                            <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                              {groupPeriod === 'week'
                                ? new Date(item.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                : new Date(item.period + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Status Distribution */}
            <TabsContent value="status">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Booking Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-6 justify-center py-4">
                    {data.statusDistribution.map((item) => (
                      <div key={item.status} className="text-center space-y-2">
                        <div
                          className="w-20 h-20 rounded-full flex items-center justify-center border-4"
                          style={{
                            borderColor: statusColors[item.status] || 'bg-gray-500',
                            background: `${statusColors[item.status]}20`,
                          }}
                        >
                          <span className="text-lg font-bold">{Math.round(item.percentage)}%</span>
                        </div>
                        <div className="text-sm font-medium">
                          {statusLabels[item.status] || item.status}
                        </div>
                        <div className="text-xs text-muted-foreground">{item.count} bookings</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Top Experiences Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4" />
                Top Experiences by Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Experience</TableHead>
                    <TableHead className="hidden sm:table-cell">Category</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Bookings</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Avg Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topExperiences.map((item, idx) => (
                    <TableRow key={item.experienceId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-muted-foreground w-5">#{idx + 1}</span>
                          <span className="font-medium">{item.experienceName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {item.category ? (
                          <Badge variant="secondary">{item.category}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(item.revenue)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        {item.bookings}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {formatCurrency(item.avgBookingValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
