'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Download,
  Wallet,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Droplets,
  Zap,
  ShieldCheck,
  Calendar,
  FileSpreadsheet,
  Printer,
  CircleDot,
  Sun,
  Snowflake,
  TreePine,
  Waves,
  RefreshCw,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Currency formatter ────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatLakhs(amount: number): string {
  return `₹${(amount / 100000).toFixed(0)}L`;
}

function formatCrores(amount: number): string {
  return `₹${(amount / 10000000).toFixed(1)}Cr`;
}

// ─── Interfaces ────────────────────────────────────────────────────────
interface MonthlyForecast {
  month: string;
  monthShort: string;
  openingBalance: number;
  inflows: number;
  outflows: number;
  netChange: number;
  closingBalance: number;
  roomRevenue: number;
  fbRevenue: number;
  eventRevenue: number;
  otherInflow: number;
  payroll: number;
  vendorPayments: number;
  utilities: number;
  capEx: number;
  season: 'peak' | 'shoulder' | 'low';
}

interface LowCashAlert {
  month: string;
  closingBalance: number;
  shortfall: number;
  severity: 'critical' | 'warning' | 'info';
  recommendation: string;
}

interface SeasonalInsight {
  season: string;
  months: string;
  avgInflow: number;
  avgOutflow: number;
  netAvg: number;
  trend: string;
  icon: React.ReactNode;
}

// ─── API response types ────────────────────────────────────────────────
interface CashFlowForecastRecord {
  id: string;
  period: string;
  openingBalance: number;
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  closingBalance: number;
  roomRevenue: number;
  fbRevenue: number;
  otherRevenue: number;
  payrollExpense: number;
  opexExpense: number;
  capexExpense: number;
  forecastType: string;
  notes?: string;
}

interface RevenueRecord {
  date: string;
  revenue: number;
  bookings: number;
  taxes: number;
  payments: number;
}

// ─── Season helpers ────────────────────────────────────────────────────
function getSeason(monthIndex: number): 'peak' | 'shoulder' | 'low' {
  // Indian hotel seasonality: peak = Jun-Aug, Dec; shoulder = Mar-May, Sep-Oct; low = Jan-Feb, Nov
  if ([5, 6, 7, 11].includes(monthIndex)) return 'peak';
  if ([2, 3, 4, 8, 9].includes(monthIndex)) return 'shoulder';
  return 'low';
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Chart configs ────────────────────────────────────────────────────
const balanceChartConfig = {
  closingBalance: { label: 'Closing Balance', color: '#10b981' },
  openingBalance: { label: 'Opening Balance', color: '#06b6d4' },
} satisfies ChartConfig;

const inflowChartConfig = {
  roomRevenue: { label: 'Room Revenue', color: '#10b981' },
  fbRevenue: { label: 'F&B Revenue', color: '#f59e0b' },
  eventRevenue: { label: 'Events', color: '#8b5cf6' },
  otherInflow: { label: 'Other', color: '#06b6d4' },
} satisfies ChartConfig;

const outflowChartConfig = {
  payroll: { label: 'Payroll', color: '#f43f5e' },
  vendorPayments: { label: 'Vendors', color: '#f97316' },
  utilities: { label: 'Utilities', color: '#eab308' },
  capEx: { label: 'CapEx', color: '#8b5cf6' },
} satisfies ChartConfig;

const netFlowChartConfig = {
  inflows: { label: 'Inflows', color: '#10b981' },
  outflows: { label: 'Outflows', color: '#f43f5e' },
  netChange: { label: 'Net Change', color: '#f59e0b' },
} satisfies ChartConfig;

// ─── Helper ────────────────────────────────────────────────────────────
function getSeasonBadge(season: 'peak' | 'shoulder' | 'low') {
  switch (season) {
    case 'peak':
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs">Peak</Badge>;
    case 'shoulder':
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs">Shoulder</Badge>;
    case 'low':
      return <Badge className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300 text-xs">Low</Badge>;
  }
}

function getNetColor(net: number): string {
  return net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
}

// ─── Derive forecast from revenue data ────────────────────────────────
function deriveForecastFromRevenue(revenueData: RevenueRecord[]): MonthlyForecast[] {
  const monthlyRevenue: Record<string, number> = {};
  revenueData.forEach(r => {
    const monthKey = r.date.substring(0, 7);
    monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + r.revenue;
  });

  if (Object.keys(monthlyRevenue).length === 0) return [];

  const months = Object.keys(monthlyRevenue).sort();
  const forecast: MonthlyForecast[] = [];
  let runningBalance = 0;

  months.forEach((monthKey) => {
    const monthIndex = parseInt(monthKey.split('-')[1]) - 1;
    const year = parseInt(monthKey.split('-')[0]);
    const revenue = monthlyRevenue[monthKey];
    const inflows = revenue;
    const outflows = revenue * 0.6;
    const netChange = inflows - outflows;
    const openingBalance = runningBalance;
    runningBalance += netChange;
    const closingBalance = runningBalance;

    const roomRevenue = inflows * 0.58;
    const fbRevenue = inflows * 0.19;
    const eventRevenue = inflows * 0.12;
    const otherInflow = inflows * 0.11;

    const payroll = outflows * 0.42;
    const vendorPayments = outflows * 0.25;
    const utilities = outflows * 0.21;
    const capEx = outflows * 0.12;

    forecast.push({
      month: `${MONTH_NAMES[monthIndex]} ${year}`,
      monthShort: MONTH_SHORT[monthIndex],
      openingBalance,
      inflows,
      outflows,
      netChange,
      closingBalance,
      roomRevenue,
      fbRevenue,
      eventRevenue,
      otherInflow,
      payroll,
      vendorPayments,
      utilities,
      capEx,
      season: getSeason(monthIndex),
    });
  });

  return forecast;
}

// ─── Map DB records to MonthlyForecast ───────────────────────────────
function mapDbToForecast(records: CashFlowForecastRecord[]): MonthlyForecast[] {
  if (!records || records.length === 0) return [];

  return records.map(r => {
    const d = new Date(r.period);
    const monthIndex = d.getMonth();
    const year = d.getFullYear();

    const eventRevenue = (r.otherRevenue || 0) * 0.5;
    const otherInflow = (r.otherRevenue || 0) * 0.5;
    const vendorPayments = (r.opexExpense || 0) * 0.55;
    const utilities = (r.opexExpense || 0) * 0.45;

    return {
      month: `${MONTH_NAMES[monthIndex]} ${year}`,
      monthShort: MONTH_SHORT[monthIndex],
      openingBalance: r.openingBalance || 0,
      inflows: r.totalInflow || 0,
      outflows: r.totalOutflow || 0,
      netChange: r.netCashFlow || 0,
      closingBalance: r.closingBalance || 0,
      roomRevenue: r.roomRevenue || 0,
      fbRevenue: r.fbRevenue || 0,
      eventRevenue,
      otherInflow,
      payroll: r.payrollExpense || 0,
      vendorPayments,
      utilities,
      capEx: r.capexExpense || 0,
      season: getSeason(monthIndex),
    };
  });
}

// ─── Compute derived data from forecast ───────────────────────────────
function computeAlerts(forecastData: MonthlyForecast[]): LowCashAlert[] {
  if (forecastData.length === 0) return [];
  const avgClosing = forecastData.reduce((s, m) => s + m.closingBalance, 0) / forecastData.length;
  const minReserveThreshold = avgClosing * 0.5;
  const alerts: LowCashAlert[] = [];

  forecastData.forEach(m => {
    if (m.closingBalance < minReserveThreshold) {
      const shortfall = minReserveThreshold - m.closingBalance;
      const severity: LowCashAlert['severity'] = shortfall > avgClosing * 0.3 ? 'critical' : shortfall > avgClosing * 0.1 ? 'warning' : 'info';
      alerts.push({
        month: m.month,
        closingBalance: m.closingBalance,
        shortfall,
        severity,
        recommendation: severity === 'critical'
          ? 'Immediate action required. Consider emergency credit line or deferred vendor payments.'
          : severity === 'warning'
          ? 'Consider deferring non-essential CapEx. Negotiate extended payment terms with key vendors.'
          : 'Cash position below comfort zone. Monitor F&B purchasing costs closely.',
      });
    }
  });

  return alerts.slice(0, 3);
}

function computeSeasonalInsights(forecastData: MonthlyForecast[]): SeasonalInsight[] {
  if (forecastData.length === 0) return [];

  const bySeason: Record<string, MonthlyForecast[]> = { peak: [], shoulder: [], low: [] };
  forecastData.forEach(m => bySeason[m.season].push(m));

  return [
    {
      season: 'Peak Season',
      months: 'Jun – Aug, Dec',
      avgInflow: bySeason.peak.length > 0 ? bySeason.peak.reduce((s, m) => s + m.inflows, 0) / bySeason.peak.length : 0,
      avgOutflow: bySeason.peak.length > 0 ? bySeason.peak.reduce((s, m) => s + m.outflows, 0) / bySeason.peak.length : 0,
      netAvg: bySeason.peak.length > 0 ? bySeason.peak.reduce((s, m) => s + m.netChange, 0) / bySeason.peak.length : 0,
      trend: 'Strong surplus months with high occupancy driving revenue. Build cash reserves.',
      icon: <Sun className="h-5 w-5 text-amber-500" />,
    },
    {
      season: 'Shoulder Season',
      months: 'Mar – May, Sep – Oct',
      avgInflow: bySeason.shoulder.length > 0 ? bySeason.shoulder.reduce((s, m) => s + m.inflows, 0) / bySeason.shoulder.length : 0,
      avgOutflow: bySeason.shoulder.length > 0 ? bySeason.shoulder.reduce((s, m) => s + m.outflows, 0) / bySeason.shoulder.length : 0,
      netAvg: bySeason.shoulder.length > 0 ? bySeason.shoulder.reduce((s, m) => s + m.netChange, 0) / bySeason.shoulder.length : 0,
      trend: 'Moderate cash generation. Good window for planned maintenance and CapEx.',
      icon: <TreePine className="h-5 w-5 text-emerald-500" />,
    },
    {
      season: 'Low Season',
      months: 'Jan – Feb, Nov',
      avgInflow: bySeason.low.length > 0 ? bySeason.low.reduce((s, m) => s + m.inflows, 0) / bySeason.low.length : 0,
      avgOutflow: bySeason.low.length > 0 ? bySeason.low.reduce((s, m) => s + m.outflows, 0) / bySeason.low.length : 0,
      netAvg: bySeason.low.length > 0 ? bySeason.low.reduce((s, m) => s + m.netChange, 0) / bySeason.low.length : 0,
      trend: 'Reduced inflows. Minimize discretionary spending and preserve liquidity.',
      icon: <Snowflake className="h-5 w-5 text-cyan-500" />,
    },
  ];
}

// ─── Loading skeleton ─────────────────────────────────────────────────
function ForecastSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-0 shadow-sm rounded-xl">
            <CardContent className="pt-6">
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-6 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-0 shadow-sm rounded-xl">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[340px] w-full" />
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm rounded-xl">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────
export default function CashFlowForecast() {
  const [forecastData, setForecastData] = useState<MonthlyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [focusedCategory, setFocusedCategory] = useState<'all' | 'inflows' | 'outflows'>('all');

  // ─── Fetch data ───────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try cash flow API first
      const cashFlowRes = await fetch('/api/financials/cash-flow?year=2026');
      const cashFlowJson = await cashFlowRes.json();

      if (cashFlowJson.success && Array.isArray(cashFlowJson.data) && cashFlowJson.data.length > 0) {
        const mapped = mapDbToForecast(cashFlowJson.data);
        if (mapped.length > 0) {
          setForecastData(mapped);
          setLoading(false);
          return;
        }
      }

      // Fallback: derive from revenue API
      const revenueRes = await fetch('/api/reports/revenue?granularity=monthly&startDate=2025-01-01&endDate=2026-12-31');
      const revenueJson = await revenueRes.json();

      if (revenueJson.success && revenueJson.data?.revenueData?.length > 0) {
        const derived = deriveForecastFromRevenue(revenueJson.data.revenueData);
        if (derived.length > 0) {
          setForecastData(derived);
          setLoading(false);
          return;
        }
      }

      // No data available from either API
      setForecastData([]);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cash flow forecast');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ─── Computed values ─────────────────────────────────────────────
  const lowCashAlerts = useMemo(() => computeAlerts(forecastData), [forecastData]);
  const seasonalInsights = useMemo(() => computeSeasonalInsights(forecastData), [forecastData]);

  const totalInflows = forecastData.reduce((s, m) => s + m.inflows, 0);
  const totalOutflows = forecastData.reduce((s, m) => s + m.outflows, 0);
  const totalNetChange = forecastData.reduce((s, m) => s + m.netChange, 0);
  const endingBalance = forecastData.length > 0 ? forecastData[forecastData.length - 1].closingBalance : 0;
  const avgMonthlyClosing = forecastData.length > 0 ? forecastData.reduce((s, m) => s + m.closingBalance, 0) / forecastData.length : 0;
  const minBalanceMonth = forecastData.length > 0 ? forecastData.reduce((min, m) => (m.closingBalance < min.closingBalance ? m : min)) : null;
  const maxBalanceMonth = forecastData.length > 0 ? forecastData.reduce((max, m) => (m.closingBalance > max.closingBalance ? m : max)) : null;
  const surplusMonths = forecastData.filter((m) => m.netChange >= 0).length;
  const forecastYear = forecastData.length > 0 ? forecastData[0].month.split(' ')[1] : new Date().getFullYear();

  // ─── CSV Export ──────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (forecastData.length === 0) return;
    const headers = ['Month', 'Season', 'Opening Balance', 'Inflows', 'Outflows', 'Net Change', 'Closing Balance', 'Room Revenue', 'F&B Revenue', 'Payroll', 'CapEx'];
    const rows = forecastData.map(m => [m.month, m.season, m.openingBalance, m.inflows, m.outflows, m.netChange, m.closingBalance, m.roomRevenue, m.fbRevenue, m.payroll, m.capEx]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cash-flow-forecast.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Error state ─────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Cash Flow Forecast</h2>
            <p className="text-muted-foreground">12-month rolling cash flow projection and analysis</p>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription className="mt-2">
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // ─── Loading state ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Cash Flow Forecast</h2>
            <p className="text-muted-foreground">12-month rolling cash flow projection and analysis</p>
          </div>
        </div>
        <ForecastSkeleton />
      </div>
    );
  }

  // ─── Empty state ─────────────────────────────────────────────────
  if (forecastData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Cash Flow Forecast</h2>
            <p className="text-muted-foreground">12-month rolling cash flow projection and analysis</p>
          </div>
        </div>
        <Card className="border-0 shadow-sm rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Waves className="h-16 w-16 mb-4 opacity-30" />
            <h3 className="text-lg font-medium">No Cash Flow Data Available</h3>
            <p className="text-sm mt-1 max-w-md text-center">
              No cash flow forecast data has been recorded yet. Add forecast entries through the Financials module or create them via the cash flow API.
            </p>
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Cash Flow Forecast</h2>
          <p className="text-muted-foreground">12-month rolling cash flow projection and analysis</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={focusedCategory} onValueChange={(v) => setFocusedCategory(v as typeof focusedCategory)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Flows</SelectItem>
              <SelectItem value="inflows">Inflows Only</SelectItem>
              <SelectItem value="outflows">Outflows Only</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setViewMode(viewMode === 'chart' ? 'table' : 'chart')}
          >
            {viewMode === 'chart' ? <Table className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            {viewMode === 'chart' ? 'Table' : 'Chart'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleExportCSV}
          >
            <FileSpreadsheet className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Total Inflows</p>
                <p className="text-lg font-bold bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent dark:from-emerald-200 dark:to-emerald-400">
                  {formatCrores(totalInflows)}
                </p>
              </div>
              <div className="p-2.5 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <ArrowUpRight className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-rose-700 dark:text-rose-400">Total Outflows</p>
                <p className="text-lg font-bold text-rose-900 dark:text-rose-100">
                  {formatCrores(totalOutflows)}
                </p>
              </div>
              <div className="p-2.5 rounded-full bg-rose-200 dark:bg-rose-800">
                <ArrowDownRight className="h-5 w-5 text-rose-700 dark:text-rose-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Net Cash Position</p>
                <p className="text-lg font-bold text-amber-900 dark:text-amber-100">
                  {formatCrores(endingBalance)}
                </p>
              </div>
              <div className="p-2.5 rounded-full bg-amber-200 dark:bg-amber-800">
                <Wallet className="h-5 w-5 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-cyan-700 dark:text-cyan-400">Surplus Months</p>
                <p className="text-lg font-bold text-cyan-900 dark:text-cyan-100">
                  {surplusMonths} / {forecastData.length}
                </p>
              </div>
              <div className="p-2.5 rounded-full bg-cyan-200 dark:bg-cyan-800">
                <ShieldCheck className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-violet-700 dark:text-violet-400">Avg Cash Reserve</p>
                <p className="text-lg font-bold text-violet-900 dark:text-violet-100">
                  {formatCrores(avgMonthlyClosing)}
                </p>
              </div>
              <div className="p-2.5 rounded-full bg-violet-200 dark:bg-violet-800">
                <Calendar className="h-5 w-5 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Cash Alerts */}
      {lowCashAlerts.length > 0 && (
        <div className="space-y-3">
          {lowCashAlerts.map((alert, idx) => (
            <Alert
              key={idx}
              variant={alert.severity === 'critical' ? 'destructive' : 'default'}
              className={`${
                alert.severity === 'warning'
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950'
                  : alert.severity === 'info'
                  ? 'border-cyan-300 bg-cyan-50 dark:border-cyan-700 dark:bg-cyan-950'
                  : ''
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2">
                {alert.severity === 'critical' && 'Critical: '}
                {alert.severity === 'warning' && 'Warning: '}
                Low Cash Position in {alert.month}
              </AlertTitle>
              <AlertDescription className="mt-1">
                <p>
                  Projected closing balance: <span className="font-semibold">{formatCurrency(alert.closingBalance)}</span>.
                  Shortfall from comfort threshold: <span className="font-semibold text-red-600">{formatCurrency(alert.shortfall)}</span>.
                </p>
                <p className="mt-1 text-sm">{alert.recommendation}</p>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Main Chart or Table */}
      {viewMode === 'chart' ? (
        <>
          {/* Cash Balance Forecast */}
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Waves className="h-4 w-4 text-cyan-500" />
                Cash Balance Forecast
              </CardTitle>
              <CardDescription>Opening and closing balances with net change trajectory</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={balanceChartConfig} className="h-[160px] sm:h-[280px] lg:h-[340px] w-full">
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="cfClosingBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="cfOpeningBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis dataKey="monthShort" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatLakhs(v)}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <ReferenceLine
                    y={avgMonthlyClosing * 0.5}
                    stroke="#f59e0b"
                    strokeDasharray="5 5"
                    label={{ value: 'Min. Reserve', position: 'insideTopRight', className: 'text-xs fill-amber-500', fontSize: 10 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="openingBalance"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#cfOpeningBalance)"
                    strokeDasharray="4 2"
                  />
                  <Area
                    type="monotone"
                    dataKey="closingBalance"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#cfClosingBalance)"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Inflows / Outflows Breakdown */}
          {(focusedCategory === 'all' || focusedCategory === 'inflows') && (
            <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  Cash Inflow Breakdown
                </CardTitle>
                <CardDescription>Revenue sources contributing to cash inflows</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={inflowChartConfig} className="h-[160px] sm:h-[250px] lg:h-[300px] w-full">
                  <BarChart data={forecastData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="monthShort" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis
                      className="text-xs"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatLakhs(v)}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="roomRevenue" stackId="inflows" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="fbRevenue" stackId="inflows" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="eventRevenue" stackId="inflows" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="otherInflow" stackId="inflows" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {(focusedCategory === 'all' || focusedCategory === 'outflows') && (
            <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-rose-500" />
                  Cash Outflow Breakdown
                </CardTitle>
                <CardDescription>Major expense categories driving cash outflows</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={outflowChartConfig} className="h-[160px] sm:h-[250px] lg:h-[300px] w-full">
                  <BarChart data={forecastData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="monthShort" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis
                      className="text-xs"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatLakhs(v)}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="payroll" stackId="outflows" fill="#f43f5e" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="vendorPayments" stackId="outflows" fill="#f97316" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="utilities" stackId="outflows" fill="#eab308" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="capEx" stackId="outflows" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Net Flow Trend */}
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-amber-500" />
                Net Cash Flow Trend
              </CardTitle>
              <CardDescription>Monthly net change with inflow/outflow comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={netFlowChartConfig} className="h-[160px] sm:h-[250px] lg:h-[300px] w-full">
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="cfInflows" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cfOutflows" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis dataKey="monthShort" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatLakhs(v)}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Area type="monotone" dataKey="inflows" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#cfInflows)" />
                  <Area type="monotone" dataKey="outflows" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#cfOutflows)" />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </>
      ) : (
        /* Table View */
        <Card className="border-0 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Monthly Cash Flow Detail</CardTitle>
            <CardDescription>Complete 12-month cash flow forecast with breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sticky left-0 bg-background z-10">Month</TableHead>
                    <TableHead className="text-xs sticky left-[120px] bg-background z-10">Season</TableHead>
                    <TableHead className="text-xs text-right">Opening</TableHead>
                    <TableHead className="text-xs text-right">Inflows</TableHead>
                    <TableHead className="text-xs text-right">Outflows</TableHead>
                    <TableHead className="text-xs text-right">Net Change</TableHead>
                    <TableHead className="text-xs text-right">Closing</TableHead>
                    <TableHead className="text-xs text-right">Room Rev</TableHead>
                    <TableHead className="text-xs text-right">F&B Rev</TableHead>
                    <TableHead className="text-xs text-right">Payroll</TableHead>
                    <TableHead className="text-xs text-right">CapEx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forecastData.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell className="text-sm font-medium sticky left-0 bg-background z-10">{row.monthShort}</TableCell>
                      <TableCell className="sticky left-[120px] bg-background z-10">{getSeasonBadge(row.season)}</TableCell>
                      <TableCell className="text-sm text-right font-mono text-muted-foreground">{formatCurrency(row.openingBalance)}</TableCell>
                      <TableCell className="text-sm text-right font-mono text-emerald-600">{formatCurrency(row.inflows)}</TableCell>
                      <TableCell className="text-sm text-right font-mono text-red-500">{formatCurrency(row.outflows)}</TableCell>
                      <TableCell className={`text-sm text-right font-mono font-semibold ${getNetColor(row.netChange)}`}>
                        {row.netChange >= 0 ? '+' : ''}{formatCurrency(row.netChange)}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono font-bold">{formatCurrency(row.closingBalance)}</TableCell>
                      <TableCell className="text-sm text-right font-mono text-muted-foreground">{formatCurrency(row.roomRevenue)}</TableCell>
                      <TableCell className="text-sm text-right font-mono text-muted-foreground">{formatCurrency(row.fbRevenue)}</TableCell>
                      <TableCell className="text-sm text-right font-mono text-muted-foreground">{formatCurrency(row.payroll)}</TableCell>
                      <TableCell className="text-sm text-right font-mono text-muted-foreground">{formatCurrency(row.capEx)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seasonal Insights */}
      <Card className="border-0 shadow-sm rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4 text-violet-500" />
            Seasonal Trend Analysis
          </CardTitle>
          <CardDescription>Cash flow patterns by season with actionable insights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            {seasonalInsights.map((insight) => (
              <div
                key={insight.season}
                className="p-4 rounded-lg border border-border/50 space-y-3"
              >
                <div className="flex items-center gap-2">
                  {insight.icon}
                  <h4 className="font-semibold text-sm">{insight.season}</h4>
                  <Badge variant="outline" className="text-xs ml-auto">{insight.months}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Inflow</p>
                    <p className="text-sm font-semibold text-emerald-600">{formatLakhs(insight.avgInflow)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Outflow</p>
                    <p className="text-sm font-semibold text-red-500">{formatLakhs(insight.avgOutflow)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net Avg</p>
                    <p className={`text-sm font-semibold ${getNetColor(insight.netAvg)}`}>{formatLakhs(insight.netAvg)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{insight.trend}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {minBalanceMonth && maxBalanceMonth && (
          <>
            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="pt-6">
                <p className="text-xs font-medium text-muted-foreground">Lowest Cash Month</p>
                <p className="text-lg font-bold mt-1">{minBalanceMonth.monthShort} {forecastYear}</p>
                <p className="text-sm text-amber-600">{formatCurrency(minBalanceMonth.closingBalance)}</p>
                <Progress value={(minBalanceMonth.closingBalance / maxBalanceMonth.closingBalance) * 100} className="h-2 mt-2" />
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="pt-6">
                <p className="text-xs font-medium text-muted-foreground">Highest Cash Month</p>
                <p className="text-lg font-bold mt-1">{maxBalanceMonth.monthShort} {forecastYear}</p>
                <p className="text-sm text-emerald-600">{formatCurrency(maxBalanceMonth.closingBalance)}</p>
                <Progress value={100} className="h-2 mt-2" />
              </CardContent>
            </Card>
          </>
        )}

        <Card className="border-0 shadow-sm rounded-xl">
          <CardContent className="pt-6">
            <p className="text-xs font-medium text-muted-foreground">Cash Coverage Ratio</p>
            <p className="text-lg font-bold mt-1">{totalOutflows > 0 ? (avgMonthlyClosing / (totalOutflows / forecastData.length)).toFixed(1) : '0.0'}x</p>
            <p className="text-sm text-muted-foreground">Avg balance / Monthly outflows</p>
            <Progress value={totalOutflows > 0 ? Math.min((avgMonthlyClosing / (totalOutflows / forecastData.length)) * 20, 100) : 0} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-xl">
          <CardContent className="pt-6">
            <p className="text-xs font-medium text-muted-foreground">CapEx as % of Outflows</p>
            <p className="text-lg font-bold mt-1">
              {totalOutflows > 0 ? ((forecastData.reduce((s, m) => s + m.capEx, 0) / totalOutflows) * 100).toFixed(1) : '0.0'}%
            </p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(forecastData.reduce((s, m) => s + m.capEx, 0))} total CapEx
            </p>
            <Progress
              value={totalOutflows > 0 ? (forecastData.reduce((s, m) => s + m.capEx, 0) / totalOutflows) * 100 : 0}
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
