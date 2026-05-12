'use client';

import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

// ─── Mock Data: 12-month rolling forecast ──────────────────────────────
const forecastData: MonthlyForecast[] = [
  {
    month: 'January 2025',
    monthShort: 'Jan',
    openingBalance: 14200000,
    inflows: 16800000,
    outflows: 14200000,
    netChange: 2600000,
    closingBalance: 16800000,
    roomRevenue: 9800000,
    fbRevenue: 3200000,
    eventRevenue: 2100000,
    otherInflow: 1700000,
    payroll: 6200000,
    vendorPayments: 3800000,
    utilities: 1800000,
    capEx: 600000,
    season: 'low',
  },
  {
    month: 'February 2025',
    monthShort: 'Feb',
    openingBalance: 16800000,
    inflows: 15400000,
    outflows: 13900000,
    netChange: 1500000,
    closingBalance: 18300000,
    roomRevenue: 8800000,
    fbRevenue: 3100000,
    eventRevenue: 1800000,
    otherInflow: 1700000,
    payroll: 6000000,
    vendorPayments: 3700000,
    utilities: 1700000,
    capEx: 800000,
    season: 'low',
  },
  {
    month: 'March 2025',
    monthShort: 'Mar',
    openingBalance: 18300000,
    inflows: 19600000,
    outflows: 15800000,
    netChange: 3800000,
    closingBalance: 22100000,
    roomRevenue: 11200000,
    fbRevenue: 3600000,
    eventRevenue: 2800000,
    otherInflow: 2000000,
    payroll: 6400000,
    vendorPayments: 4000000,
    utilities: 1700000,
    capEx: 1200000,
    season: 'shoulder',
  },
  {
    month: 'April 2025',
    monthShort: 'Apr',
    openingBalance: 22100000,
    inflows: 21400000,
    outflows: 17200000,
    netChange: 4200000,
    closingBalance: 26300000,
    roomRevenue: 12400000,
    fbRevenue: 3900000,
    eventRevenue: 2600000,
    otherInflow: 2500000,
    payroll: 6500000,
    vendorPayments: 4200000,
    utilities: 1600000,
    capEx: 1400000,
    season: 'shoulder',
  },
  {
    month: 'May 2025',
    monthShort: 'May',
    openingBalance: 26300000,
    inflows: 22800000,
    outflows: 18400000,
    netChange: 4400000,
    closingBalance: 30700000,
    roomRevenue: 13400000,
    fbRevenue: 4100000,
    eventRevenue: 2600000,
    otherInflow: 2700000,
    payroll: 6800000,
    vendorPayments: 4400000,
    utilities: 1400000,
    capEx: 1800000,
    season: 'shoulder',
  },
  {
    month: 'June 2025',
    monthShort: 'Jun',
    openingBalance: 30700000,
    inflows: 24200000,
    outflows: 19600000,
    netChange: 4600000,
    closingBalance: 35300000,
    roomRevenue: 14200000,
    fbRevenue: 4400000,
    eventRevenue: 2600000,
    otherInflow: 3000000,
    payroll: 7000000,
    vendorPayments: 4600000,
    utilities: 1200000,
    capEx: 2200000,
    season: 'peak',
  },
  {
    month: 'July 2025',
    monthShort: 'Jul',
    openingBalance: 35300000,
    inflows: 25600000,
    outflows: 20800000,
    netChange: 4800000,
    closingBalance: 40100000,
    roomRevenue: 15200000,
    fbRevenue: 4600000,
    eventRevenue: 2400000,
    otherInflow: 3400000,
    payroll: 7200000,
    vendorPayments: 4800000,
    utilities: 1200000,
    capEx: 2600000,
    season: 'peak',
  },
  {
    month: 'August 2025',
    monthShort: 'Aug',
    openingBalance: 40100000,
    inflows: 23800000,
    outflows: 19900000,
    netChange: 3900000,
    closingBalance: 44000000,
    roomRevenue: 14000000,
    fbRevenue: 4300000,
    eventRevenue: 2200000,
    otherInflow: 3300000,
    payroll: 7100000,
    vendorPayments: 4600000,
    utilities: 1100000,
    capEx: 2200000,
    season: 'peak',
  },
  {
    month: 'September 2025',
    monthShort: 'Sep',
    openingBalance: 44000000,
    inflows: 22200000,
    outflows: 18600000,
    netChange: 3600000,
    closingBalance: 47600000,
    roomRevenue: 13000000,
    fbRevenue: 4000000,
    eventRevenue: 2000000,
    otherInflow: 3200000,
    payroll: 6900000,
    vendorPayments: 4400000,
    utilities: 1200000,
    capEx: 1800000,
    season: 'shoulder',
  },
  {
    month: 'October 2025',
    monthShort: 'Oct',
    openingBalance: 47600000,
    inflows: 20800000,
    outflows: 17900000,
    netChange: 2900000,
    closingBalance: 50500000,
    roomRevenue: 12000000,
    fbRevenue: 3800000,
    eventRevenue: 1900000,
    otherInflow: 3100000,
    payroll: 6700000,
    vendorPayments: 4200000,
    utilities: 1400000,
    capEx: 1200000,
    season: 'shoulder',
  },
  {
    month: 'November 2025',
    monthShort: 'Nov',
    openingBalance: 50500000,
    inflows: 19400000,
    outflows: 17200000,
    netChange: 2200000,
    closingBalance: 52700000,
    roomRevenue: 11000000,
    fbRevenue: 3500000,
    eventRevenue: 2000000,
    otherInflow: 2900000,
    payroll: 6400000,
    vendorPayments: 4000000,
    utilities: 1600000,
    capEx: 800000,
    season: 'low',
  },
  {
    month: 'December 2025',
    monthShort: 'Dec',
    openingBalance: 52700000,
    inflows: 26200000,
    outflows: 21400000,
    netChange: 4800000,
    closingBalance: 57500000,
    roomRevenue: 15400000,
    fbRevenue: 4800000,
    eventRevenue: 3200000,
    otherInflow: 2800000,
    payroll: 6800000,
    vendorPayments: 4600000,
    utilities: 1800000,
    capEx: 600000,
    season: 'peak',
  },
];

const lowCashAlerts: LowCashAlert[] = [
  {
    month: 'January 2025',
    closingBalance: 16800000,
    shortfall: 3200000,
    severity: 'warning',
    recommendation: 'Consider deferring non-essential CapEx to February. Negotiate extended payment terms with key vendors.',
  },
  {
    month: 'February 2025',
    closingBalance: 18300000,
    shortfall: 1700000,
    severity: 'info',
    recommendation: 'Cash position recovering but below comfort zone. Monitor F&B purchasing costs closely.',
  },
];

const seasonalInsights: SeasonalInsight[] = [
  {
    season: 'Peak Season',
    months: 'Jun – Aug, Dec',
    avgInflow: 24533333,
    avgOutflow: 20066667,
    netAvg: 4466666,
    trend: 'Strong surplus months with high occupancy driving revenue. Build cash reserves.',
    icon: <Sun className="h-5 w-5 text-amber-500" />,
  },
  {
    season: 'Shoulder Season',
    months: 'Mar – May, Sep – Oct',
    avgInflow: 21500000,
    avgOutflow: 17980000,
    netAvg: 3520000,
    trend: 'Moderate cash generation. Good window for planned maintenance and CapEx.',
    icon: <TreePine className="h-5 w-5 text-emerald-500" />,
  },
  {
    season: 'Low Season',
    months: 'Jan – Feb, Nov',
    avgInflow: 17200000,
    avgOutflow: 15100000,
    netAvg: 2100000,
    trend: 'Reduced inflows. Minimize discretionary spending and preserve liquidity.',
    icon: <Snowflake className="h-5 w-5 text-cyan-500" />,
  },
];

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

// ─── Component ─────────────────────────────────────────────────────────
export default function CashFlowForecast() {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [focusedCategory, setFocusedCategory] = useState<'all' | 'inflows' | 'outflows'>('all');

  // Computed values
  const totalInflows = forecastData.reduce((s, m) => s + m.inflows, 0);
  const totalOutflows = forecastData.reduce((s, m) => s + m.outflows, 0);
  const totalNetChange = forecastData.reduce((s, m) => s + m.netChange, 0);
  const endingBalance = forecastData[forecastData.length - 1].closingBalance;
  const avgMonthlyClosing = forecastData.reduce((s, m) => s + m.closingBalance, 0) / forecastData.length;
  const minBalanceMonth = forecastData.reduce((min, m) => (m.closingBalance < min.closingBalance ? m : min));
  const maxBalanceMonth = forecastData.reduce((max, m) => (m.closingBalance > max.closingBalance ? m : max));
  const surplusMonths = forecastData.filter((m) => m.netChange >= 0).length;

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
            onClick={() => {
              const csvContent = 'Cash Flow Forecast';
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'cash-flow-forecast.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
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
                  {surplusMonths} / 12
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
                    y={20000000}
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
                <div className="grid grid-cols-3 gap-2 text-center">
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
        <Card className="border-0 shadow-sm rounded-xl">
          <CardContent className="pt-6">
            <p className="text-xs font-medium text-muted-foreground">Lowest Cash Month</p>
            <p className="text-lg font-bold mt-1">{minBalanceMonth.monthShort} 2025</p>
            <p className="text-sm text-amber-600">{formatCurrency(minBalanceMonth.closingBalance)}</p>
            <Progress value={(minBalanceMonth.closingBalance / maxBalanceMonth.closingBalance) * 100} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-xl">
          <CardContent className="pt-6">
            <p className="text-xs font-medium text-muted-foreground">Highest Cash Month</p>
            <p className="text-lg font-bold mt-1">{maxBalanceMonth.monthShort} 2025</p>
            <p className="text-sm text-emerald-600">{formatCurrency(maxBalanceMonth.closingBalance)}</p>
            <Progress value={100} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-xl">
          <CardContent className="pt-6">
            <p className="text-xs font-medium text-muted-foreground">Cash Coverage Ratio</p>
            <p className="text-lg font-bold mt-1">{(avgMonthlyClosing / (totalOutflows / 12)).toFixed(1)}x</p>
            <p className="text-sm text-muted-foreground">Avg balance / Monthly outflows</p>
            <Progress value={Math.min((avgMonthlyClosing / (totalOutflows / 12)) * 20, 100)} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-xl">
          <CardContent className="pt-6">
            <p className="text-xs font-medium text-muted-foreground">CapEx as % of Outflows</p>
            <p className="text-lg font-bold mt-1">
              {((forecastData.reduce((s, m) => s + m.capEx, 0) / totalOutflows) * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(forecastData.reduce((s, m) => s + m.capEx, 0))} total CapEx
            </p>
            <Progress
              value={(forecastData.reduce((s, m) => s + m.capEx, 0) / totalOutflows) * 100}
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
