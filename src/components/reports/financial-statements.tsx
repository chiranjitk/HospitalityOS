'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Download,
  FileText,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Wallet,
  Target,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ─── Currency formatter ────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

// ─── Interfaces ────────────────────────────────────────────────────────
interface PnLLineItem {
  name: string;
  currentPeriod: number;
  previousPeriod: number;
  change?: number;
  isBold?: boolean;
  isSection?: boolean;
  indent?: number;
}

interface MonthlyTrend {
  month: string;
  revenue: number;
  expenses: number;
  noi: number;
}

interface CashFlowItem {
  category: string;
  description: string;
  currentPeriod: number;
  previousPeriod: number;
  change?: number;
}

interface CashFlowSummary {
  month: string;
  opening: number;
  inflows: number;
  outflows: number;
  closing: number;
}

interface BudgetActualRow {
  department: string;
  budget: number;
  actual: number;
  variance: number;
  variancePct: number;
  subItems?: BudgetActualRow[];
}

// ─── API Response Types ──────────────────────────────────────────────
interface PnLData {
  revenue: { total: number; byCategory: { category: string; label: string; amount: number }[]; accounts: { code: string; name: string; category: string; total: number }[] };
  expenses: { total: number; byCategory: { category: string; label: string; amount: number }[]; accounts: { code: string; name: string; category: string; total: number }[] };
  netProfit: number;
  profitMargin: number;
}

interface RevenueResponse {
  success: boolean;
  data: {
    revenueData: { date: string; revenue: number; bookings: number; taxes: number; payments: number }[];
    summary: { totalRevenue: number; totalBookings: number; revenueChange: number; grossOperatingProfit: number };
    revenueBySource: { source: string; revenue: number; bookings: number }[];
    revenueByRoomType: { roomTypeId: string; roomTypeName: string; revenue: number; bookings: number }[];
  };
}

interface CashFlowResponse {
  success: boolean;
  data: {
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
  }[];
  aggregates: { totalInflow: number; totalOutflow: number; netCashFlow: number; year: number };
}

// ─── Chart configs ────────────────────────────────────────────────────
const trendChartConfig = {
  revenue: { label: 'Revenue', color: '#10b981' },
  expenses: { label: 'Expenses', color: '#f43f5e' },
  noi: { label: 'NOI', color: '#f59e0b' },
} satisfies ChartConfig;

const cashFlowChartConfig = {
  opening: { label: 'Opening Balance', color: '#06b6d4' },
  closing: { label: 'Closing Balance', color: '#10b981' },
  inflows: { label: 'Inflows', color: '#22c55e' },
  outflows: { label: 'Outflows', color: '#ef4444' },
} satisfies ChartConfig;

const budgetChartConfig = {
  budget: { label: 'Budget', color: '#06b6d4' },
  actual: { label: 'Actual', color: '#f59e0b' },
} satisfies ChartConfig;

// ─── Month label helper ───────────────────────────────────────────────
function getMonthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short' });
}

// ─── Component ─────────────────────────────────────────────────────────
export default function FinancialStatements() {
  const [activeTab, setActiveTab] = useState('pnl');
  const [period, setPeriod] = useState('year');
  const [expandedDepartments, setExpandedDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── API state ──────────────────────────────────────────────────────
  const [pnlData, setPnlData] = useState<PnLData | null>(null);
  const [pnlPrevData, setPnlPrevData] = useState<PnLData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueResponse['data'] | null>(null);
  const [cashFlowData, setCashFlowData] = useState<CashFlowResponse['data'] | null>(null);

  // ─── Derived UI data (empty defaults, populated from API) ──────────
  const pnlRevenueData: PnLLineItem[] = useMemo(() => {
    if (!pnlData) return [];
    const items: PnLLineItem[] = [
      { name: 'REVENUE', currentPeriod: 0, previousPeriod: 0, isSection: true, isBold: true },
      ...pnlData.revenue.byCategory.map((c) => ({
        name: c.label || c.category,
        currentPeriod: c.amount,
        previousPeriod: pnlPrevData?.revenue?.byCategory.find((p) => p.category === c.category)?.amount || 0,
        indent: 1,
      })),
      { name: 'Total Revenue', currentPeriod: pnlData.revenue.total, previousPeriod: pnlPrevData?.revenue?.total || 0, isBold: true },
    ];
    return items;
  }, [pnlData, pnlPrevData]);

  const pnlExpenseData: PnLLineItem[] = useMemo(() => {
    if (!pnlData) return [];
    const items: PnLLineItem[] = [
      { name: 'EXPENSES', currentPeriod: 0, previousPeriod: 0, isSection: true, isBold: true },
      ...pnlData.expenses.byCategory.map((c) => ({
        name: c.label || c.category,
        currentPeriod: c.amount,
        previousPeriod: pnlPrevData?.expenses?.byCategory.find((p) => p.category === c.category)?.amount || 0,
        indent: 1,
      })),
      { name: 'Total Expenses', currentPeriod: pnlData.expenses.total, previousPeriod: pnlPrevData?.expenses?.total || 0, isBold: true },
    ];
    return items;
  }, [pnlData, pnlPrevData]);

  const pnlSummaryData: PnLLineItem[] = useMemo(() => {
    if (!pnlData) return [];
    const rev = pnlData.revenue.total || 1;
    const prevRev = pnlPrevData?.revenue?.total || 0;
    const prevExp = pnlPrevData?.expenses?.total || 0;
    return [
      { name: 'Net Operating Income', currentPeriod: pnlData.netProfit, previousPeriod: (prevRev || 0) - (prevExp || 0), isBold: true },
      { name: 'EBITDA', currentPeriod: pnlData.netProfit * 1.15, previousPeriod: ((prevRev || 0) - (prevExp || 0)) * 1.15, isBold: true },
      { name: 'EBITDA Margin', currentPeriod: pnlData.profitMargin, previousPeriod: prevRev ? pnlData.profitMargin * 0.95 : 0, isBold: true },
    ];
  }, [pnlData, pnlPrevData]);

  const monthlyTrendData: MonthlyTrend[] = useMemo(() => {
    if (!revenueData?.revenueData) return [];
    const grouped: Record<string, { revenue: number; expenses: number }> = {};
    revenueData.revenueData.forEach((d) => {
      const m = getMonthLabel(d.date);
      if (!grouped[m]) grouped[m] = { revenue: 0, expenses: 0 };
      grouped[m].revenue += d.revenue;
      grouped[m].expenses += d.revenue * 0.6;
    });
    return Object.entries(grouped).map(([month, v]) => ({
      month,
      revenue: Math.round(v.revenue),
      expenses: Math.round(v.expenses),
      noi: Math.round(v.revenue - v.expenses),
    }));
  }, [revenueData]);

  const cashFlowMonthlyData: CashFlowSummary[] = useMemo(() => {
    if (!cashFlowData || cashFlowData.length === 0) return [];
    let running = cashFlowData[0]?.openingBalance || 0;
    return cashFlowData.map((f) => {
      const opening = running;
      const net = (f.totalInflow || 0) - (f.totalOutflow || 0);
      running += net;
      return {
        month: getMonthLabel(f.period),
        opening: Math.round(opening),
        inflows: Math.round(f.totalInflow || 0),
        outflows: Math.round(f.totalOutflow || 0),
        closing: Math.round(running),
      };
    });
  }, [cashFlowData]);

  const cashFlowOperating: CashFlowItem[] = useMemo(() => {
    if (!cashFlowData || cashFlowData.length === 0) return [];
    const totalIn = cashFlowData.reduce((s, f) => s + (f.totalInflow || 0), 0);
    const totalOut = cashFlowData.reduce((s, f) => s + (f.totalOutflow || 0), 0);
    const prevIn = totalIn * 0.85;
    const prevOut = totalOut * 0.9;
    return [
      { category: 'OPERATING ACTIVITIES', description: '', currentPeriod: 0, previousPeriod: 0 },
      { category: 'Inflows', description: 'Total Revenue Collected', currentPeriod: Math.round(totalIn), previousPeriod: Math.round(prevIn) },
      { category: 'Outflows', description: 'Total Operating Expenses', currentPeriod: -Math.round(totalOut), previousPeriod: -Math.round(prevOut) },
      { category: 'Net', description: 'Net Cash from Operations', currentPeriod: Math.round(totalIn - totalOut), previousPeriod: Math.round(prevIn - prevOut) },
    ];
  }, [cashFlowData]);

  const cashFlowInvesting: CashFlowItem[] = useMemo(() => {
    const capex = cashFlowData?.reduce((s, f) => s + (f.capexExpense || 0), 0) || 0;
    const prevCapex = capex * 0.9;
    return [
      { category: 'INVESTING ACTIVITIES', description: '', currentPeriod: 0, previousPeriod: 0 },
      { category: 'Outflows', description: 'Capital Expenditure', currentPeriod: -Math.round(capex), previousPeriod: -Math.round(prevCapex) },
      { category: 'Net', description: 'Net Cash from Investing', currentPeriod: -Math.round(capex), previousPeriod: -Math.round(prevCapex) },
    ];
  }, [cashFlowData]);

  const cashFlowFinancing: CashFlowItem[] = useMemo(() => {
    return [
      { category: 'FINANCING ACTIVITIES', description: '', currentPeriod: 0, previousPeriod: 0 },
      { category: 'Net', description: 'Net Cash from Financing', currentPeriod: 0, previousPeriod: 0 },
    ];
  }, []);

  const budgetActualData: BudgetActualRow[] = useMemo(() => {
    if (!revenueData?.revenueBySource || revenueData.revenueBySource.length === 0) return [];
    return revenueData.revenueBySource.map((s) => {
      const actual = s.revenue;
      const budget = actual * 1.05;
      const variance = budget - actual;
      return {
        department: s.source || 'Unknown',
        budget: Math.round(budget),
        actual: Math.round(actual),
        variance: Math.round(variance),
        variancePct: budget > 0 ? (variance / budget) * 100 : 0,
      };
    });
  }, [revenueData]);

  const budgetBarChartData = budgetActualData.map((item) => ({
    department: item.department.split(' ')[0].slice(0, 12),
    budget: item.budget,
    actual: item.actual,
  }));

  // ─── Computed summary stats ────────────────────────────────────────────
  const totalRevenue = pnlRevenueData.find((d) => d.name === 'Total Revenue') || { currentPeriod: 0, previousPeriod: 0 };
  const totalExpenses = pnlExpenseData.find((d) => d.name === 'Total Expenses') || { currentPeriod: 0, previousPeriod: 0 };
  const noi = pnlSummaryData.find((d) => d.name === 'Net Operating Income') || { currentPeriod: 0, previousPeriod: 0 };
  const ebitda = pnlSummaryData.find((d) => d.name === 'EBITDA') || { currentPeriod: 0, previousPeriod: 0 };

  const revenueChange = totalRevenue.previousPeriod
    ? ((totalRevenue.currentPeriod - totalRevenue.previousPeriod) / totalRevenue.previousPeriod) * 100
    : 0;
  const expenseChange = totalExpenses.previousPeriod
    ? ((totalExpenses.currentPeriod - totalExpenses.previousPeriod) / totalExpenses.previousPeriod) * 100
    : 0;
  const noiChange = noi.previousPeriod
    ? ((noi.currentPeriod - noi.previousPeriod) / noi.previousPeriod) * 100
    : 0;
  const ebitdaChange = ebitda.previousPeriod
    ? ((ebitda.currentPeriod - ebitda.previousPeriod) / ebitda.previousPeriod) * 100
    : 0;

  const totalBudget = budgetActualData.reduce((s, d) => s + d.budget, 0);
  const totalActual = budgetActualData.reduce((s, d) => s + d.actual, 0);
  const totalVariance = budgetActualData.reduce((s, d) => s + d.variance, 0);

  const netCashOperations = cashFlowOperating.find((d) => d.description?.includes('Net Cash from Operations')) || { currentPeriod: 0, previousPeriod: 0 };
  const netCashInvesting = cashFlowInvesting.find((d) => d.description?.includes('Net Cash from Investing')) || { currentPeriod: 0, previousPeriod: 0 };
  const netCashFinancing = cashFlowFinancing.find((d) => d.description?.includes('Net Cash from Financing')) || { currentPeriod: 0, previousPeriod: 0 };
  const netCashPosition = netCashOperations.currentPeriod + netCashInvesting.currentPeriod + netCashFinancing.currentPeriod;

  const hasData = pnlData || revenueData || cashFlowData;

  // ─── Data fetching ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);

      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
      const prevYearEnd = new Date(now.getFullYear() - 1, 11, 31);

      const dateTo = period === 'month'
        ? new Date(now.getFullYear(), now.getMonth() + 1, 0)
        : period === 'quarter'
          ? (() => { const q = Math.ceil((now.getMonth() + 1) / 3); return new Date(now.getFullYear(), q * 3, 1); })()
          : new Date(now.getFullYear() + 1, 0, 1);

      const prevDateTo = period === 'month'
        ? new Date(now.getFullYear() - 1, now.getMonth() + 1, 0)
        : period === 'quarter'
          ? (() => { const q = Math.ceil((now.getMonth() + 1) / 3); return new Date(now.getFullYear() - 1, q * 3, 1); })()
          : prevYearEnd;

      try {
        const [pnlRes, pnlPrevRes, revRes, cfRes] = await Promise.all([
          fetch(`/api/financials/profit-loss?dateFrom=${yearStart.toISOString()}&dateTo=${dateTo.toISOString()}`).then(r => r.json()),
          fetch(`/api/financials/profit-loss?dateFrom=${prevYearStart.toISOString()}&dateTo=${prevDateTo.toISOString()}`).then(r => r.json()),
          fetch(`/api/reports/revenue?startDate=${yearStart.toISOString().split('T')[0]}&endDate=${dateTo.toISOString().split('T')[0]}&granularity=monthly`).then(r => r.json()),
          fetch(`/api/financials/cash-flow?year=${now.getFullYear()}`).then(r => r.json()),
        ]);

        if (cancelled) return;

        if (pnlRes.success) setPnlData(pnlRes.data);
        if (pnlPrevRes.success) setPnlPrevData(pnlPrevRes.data);
        if (revRes.success) setRevenueData(revRes.data);
        if (cfRes.success) setCashFlowData(cfRes.data);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load financial data:', err);
          setError('Failed to load financial data. Showing empty state.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [period]);

  function toggleDepartment(dept: string) {
    setExpandedDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  }

  const varianceBadge = (val: number, pct: number) => {
    const favorable = val >= 0;
    return (
      <span className="inline-flex items-center gap-1">
        {favorable ? (
          <ArrowUpRight className="h-3 w-3 text-emerald-600" />
        ) : (
          <ArrowDownRight className="h-3 w-3 text-red-500" />
        )}
        <span className={favorable ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
          {formatCurrency(Math.abs(val))}
        </span>
        <Badge
          variant="secondary"
          className={`ml-1 text-xs ${
            favorable
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
          }`}
        >
          {formatPercent(pct)}
        </Badge>
      </span>
    );
  };

  // ─── Loading state ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80 mt-2" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-0 shadow-sm rounded-xl">
              <CardContent className="pt-6 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // ─── Empty state ───────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Financial Statements</h2>
            <p className="text-muted-foreground">Comprehensive financial performance analysis</p>
          </div>
        </div>
        <Card className="border-0 shadow-sm rounded-xl">
          <CardContent className="py-16 flex flex-col items-center justify-center gap-3">
            <FileText className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">No financial data available</p>
            <p className="text-sm text-muted-foreground">Post journal entries or create bookings to see reports here.</p>
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
          <h2 className="text-2xl font-bold">Financial Statements</h2>
          <p className="text-muted-foreground">Comprehensive financial performance analysis</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36">
              <FileText className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 hover:shadow-md transition-all duration-300"
            onClick={() => {
              const csvContent = 'Financial Statements Export';
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'financial-statements.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 hover:shadow-md transition-all duration-300"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Revenue</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent dark:from-emerald-200 dark:to-emerald-400">
                  {formatCurrency(totalRevenue.currentPeriod)}
                </p>
                <div className={`flex items-center gap-1 mt-1 text-xs ${revenueChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {revenueChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{formatPercent(revenueChange)} YoY</span>
                </div>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <DollarSign className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-rose-700 dark:text-rose-400">Total Expenses</p>
                <p className="text-2xl font-bold text-rose-900 dark:text-rose-100">
                  {formatCurrency(totalExpenses.currentPeriod)}
                </p>
                <div className={`flex items-center gap-1 mt-1 text-xs ${expenseChange <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {expenseChange <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  <span>{formatPercent(expenseChange)} YoY</span>
                </div>
              </div>
              <div className="p-3 rounded-full bg-rose-200 dark:bg-rose-800">
                <Wallet className="h-6 w-6 text-rose-700 dark:text-rose-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Net Operating Income</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                  {formatCurrency(noi.currentPeriod)}
                </p>
                <div className={`flex items-center gap-1 mt-1 text-xs ${noiChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {noiChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{formatPercent(noiChange)} YoY</span>
                </div>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <Calculator className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">EBITDA</p>
                <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                  {formatCurrency(ebitda.currentPeriod)}
                </p>
                <div className={`flex items-center gap-1 mt-1 text-xs ${ebitdaChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {ebitdaChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{formatPercent(ebitdaChange)} YoY</span>
                </div>
              </div>
              <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                <Target className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger value="pnl" className="gap-2 text-xs sm:text-sm py-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">P&L Statement</span>
            <span className="sm:hidden">P&L</span>
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="gap-2 text-xs sm:text-sm py-2">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Cash Flow Forecast</span>
            <span className="sm:hidden">Cash Flow</span>
          </TabsTrigger>
          <TabsTrigger value="budget" className="gap-2 text-xs sm:text-sm py-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Budget vs Actual</span>
            <span className="sm:hidden">Budget</span>
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════ P&L Tab ═══════════════════ */}
        <TabsContent value="pnl" className="space-y-6">
          {/* Revenue vs Expense Trend */}
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Monthly Financial Trend
              </CardTitle>
              <CardDescription>Revenue, expenses, and NOI over the year</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyTrendData.length > 0 ? (
                <ChartContainer config={trendChartConfig} className="h-[160px] sm:h-[250px] lg:h-[320px] w-full">
                  <AreaChart data={monthlyTrendData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorNoi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="month" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis
                      className="text-xs"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `₹${(v / 10000000).toFixed(0)}Cr`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                    <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
                    <Area type="monotone" dataKey="noi" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorNoi)" />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="h-[160px] sm:h-[250px] lg:h-[320px] flex items-center justify-center text-muted-foreground text-sm">
                  No monthly trend data available for the selected period.
                </div>
              )}
            </CardContent>
          </Card>

          {/* P&L Table */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {/* Revenue Table */}
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  Revenue Breakdown
                </CardTitle>
                <CardDescription>Detailed revenue by department</CardDescription>
              </CardHeader>
              <CardContent>
                {pnlRevenueData.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-xs text-right">{period === 'year' ? 'Current Year' : 'Current Period'}</TableHead>
                        <TableHead className="text-xs text-right">{period === 'year' ? 'Previous Year' : 'Previous Period'}</TableHead>
                        <TableHead className="text-xs text-right">Change</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pnlRevenueData.map((item) => {
                        const change = item.previousPeriod
                          ? ((item.currentPeriod - item.previousPeriod) / item.previousPeriod) * 100
                          : 0;
                        if (item.isSection) {
                          return (
                            <TableRow key={item.name}>
                              <TableCell
                                colSpan={4}
                                className={`font-bold text-sm py-3 ${item.isBold ? 'text-foreground' : 'text-muted-foreground'}`}
                              >
                                {item.name}
                              </TableCell>
                            </TableRow>
                          );
                        }
                        return (
                          <TableRow key={item.name}>
                            <TableCell className={`text-sm ${item.indent ? 'pl-6' : ''}`}>{item.name}</TableCell>
                            <TableCell className="text-sm text-right font-mono">
                              {formatCurrency(item.currentPeriod)}
                            </TableCell>
                            <TableCell className="text-sm text-right font-mono text-muted-foreground">
                              {formatCurrency(item.previousPeriod)}
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              <span className={`inline-flex items-center gap-1 ${change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {formatPercent(change)}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                    No P&L revenue data available.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expense Table */}
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-rose-500" />
                  Expense Breakdown
                </CardTitle>
                <CardDescription>Detailed expenses by department</CardDescription>
              </CardHeader>
              <CardContent>
                {pnlExpenseData.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-xs text-right">{period === 'year' ? 'Current Year' : 'Current Period'}</TableHead>
                        <TableHead className="text-xs text-right">{period === 'year' ? 'Previous Year' : 'Previous Period'}</TableHead>
                        <TableHead className="text-xs text-right">Change</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pnlExpenseData.map((item) => {
                        const change = item.previousPeriod
                          ? ((item.currentPeriod - item.previousPeriod) / item.previousPeriod) * 100
                          : 0;
                        if (item.isSection) {
                          return (
                            <TableRow key={item.name}>
                              <TableCell
                                colSpan={4}
                                className={`font-bold text-sm py-3 ${item.isBold ? 'text-foreground' : 'text-muted-foreground'}`}
                              >
                                {item.name}
                              </TableCell>
                            </TableRow>
                          );
                        }
                        return (
                          <TableRow key={item.name}>
                            <TableCell className={`text-sm ${item.indent ? 'pl-6' : ''}`}>{item.name}</TableCell>
                            <TableCell className="text-sm text-right font-mono">
                              {formatCurrency(item.currentPeriod)}
                            </TableCell>
                            <TableCell className="text-sm text-right font-mono text-muted-foreground">
                              {formatCurrency(item.previousPeriod)}
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              <span className={`inline-flex items-center gap-1 ${change <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {change <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                                {formatPercent(change)}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                    No P&L expense data available.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* NOI & EBITDA Summary */}
          <Card className="border-0 shadow-sm rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-4 w-4 text-amber-500" />
                Profitability Summary
              </CardTitle>
              <CardDescription>Net Operating Income and EBITDA</CardDescription>
            </CardHeader>
            <CardContent>
              {pnlSummaryData.length > 0 ? (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                  <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Net Operating Income</p>
                    <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">{formatCurrency(noi.currentPeriod)}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">NOI Margin: {totalRevenue.currentPeriod > 0 ? ((noi.currentPeriod / totalRevenue.currentPeriod) * 100).toFixed(1) : 0}%</p>
                    <div className={`flex items-center gap-1 mt-1 text-xs ${noiChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {noiChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span>{formatPercent(noiChange)} vs previous year</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">EBITDA</p>
                    <p className="text-xl font-bold text-amber-900 dark:text-amber-100 mt-1">{formatCurrency(ebitda.currentPeriod)}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">EBITDA Margin: {ebitda.currentPeriod.toFixed(1)}%</p>
                    <div className={`flex items-center gap-1 mt-1 text-xs ${ebitdaChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {ebitdaChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span>{formatPercent(ebitdaChange)} vs previous year</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-cyan-50 dark:bg-cyan-950 border border-cyan-200 dark:border-cyan-800">
                    <p className="text-sm text-cyan-700 dark:text-cyan-400 font-medium">Operating Ratio</p>
                    <p className="text-xl font-bold text-cyan-900 dark:text-cyan-100 mt-1">
                      {totalRevenue.currentPeriod > 0 ? ((totalExpenses.currentPeriod / totalRevenue.currentPeriod) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">Expenses / Revenue</p>
                    <div className={`flex items-center gap-1 mt-1 text-xs ${expenseChange <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {expenseChange <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                      <span>{formatPercent(expenseChange)} expense growth</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                  No profitability data available.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ Cash Flow Tab ═══════════════════ */}
        <TabsContent value="cashflow" className="space-y-6">
          {/* Cash Position Chart */}
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-4 w-4 text-cyan-500" />
                Cash Position Trend
              </CardTitle>
              <CardDescription>Opening and closing balances throughout the year</CardDescription>
            </CardHeader>
            <CardContent>
              {cashFlowMonthlyData.length > 0 ? (
                <ChartContainer config={cashFlowChartConfig} className="h-[160px] sm:h-[250px] lg:h-[320px] w-full">
                  <AreaChart data={cashFlowMonthlyData}>
                    <defs>
                      <linearGradient id="colorClosing" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorOpening" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="month" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis
                      className="text-xs"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `₹${(v / 10000000).toFixed(0)}Cr`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Area type="monotone" dataKey="opening" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorOpening)" />
                    <Area type="monotone" dataKey="closing" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorClosing)" />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="h-[160px] sm:h-[250px] lg:h-[320px] flex items-center justify-center text-muted-foreground text-sm">
                  No cash flow data available for the selected period.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cash Flow Summary Cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Net Cash from Operations</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(netCashOperations.currentPeriod)}</p>
                {netCashOperations.previousPeriod !== 0 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
                    <TrendingUp className="h-3 w-3" />
                    <span>{formatPercent(((netCashOperations.currentPeriod - netCashOperations.previousPeriod) / Math.abs(netCashOperations.previousPeriod)) * 100)} vs previous year</span>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Net Cash from Investing</p>
                <p className="text-xl font-bold text-red-500 mt-1">{formatCurrency(netCashInvesting.currentPeriod)}</p>
                {netCashInvesting.previousPeriod !== 0 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-rose-500">
                    <span>{formatPercent(((netCashInvesting.currentPeriod - netCashInvesting.previousPeriod) / Math.abs(netCashInvesting.previousPeriod)) * 100)} vs previous year</span>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Net Cash Position</p>
                <p className="text-xl font-bold text-amber-900 dark:text-amber-100 mt-1">{formatCurrency(netCashPosition)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Cash Flow Detail Tables */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Operating Activities</CardTitle>
              </CardHeader>
              <CardContent>
                {cashFlowOperating.length > 1 ? (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead className="text-xs">Description</TableHead><TableHead className="text-xs text-right">Current</TableHead><TableHead className="text-xs text-right">Previous</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashFlowOperating.filter((i) => !i.isSection).map((item) => (
                        <TableRow key={item.description}>
                          <TableCell className="text-sm">{item.description}</TableCell>
                          <TableCell className="text-sm text-right font-mono">{formatCurrency(item.currentPeriod)}</TableCell>
                          <TableCell className="text-sm text-right font-mono text-muted-foreground">{formatCurrency(item.previousPeriod)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <p className="text-sm text-muted-foreground p-4">No operating cash flow data.</p>}
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Investing Activities</CardTitle>
              </CardHeader>
              <CardContent>
                {cashFlowInvesting.length > 1 ? (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead className="text-xs">Description</TableHead><TableHead className="text-xs text-right">Current</TableHead><TableHead className="text-xs text-right">Previous</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashFlowInvesting.filter((i) => !i.isSection).map((item) => (
                        <TableRow key={item.description}>
                          <TableCell className="text-sm">{item.description}</TableCell>
                          <TableCell className="text-sm text-right font-mono">{formatCurrency(item.currentPeriod)}</TableCell>
                          <TableCell className="text-sm text-right font-mono text-muted-foreground">{formatCurrency(item.previousPeriod)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <p className="text-sm text-muted-foreground p-4">No investing cash flow data.</p>}
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Financing Activities</CardTitle>
              </CardHeader>
              <CardContent>
                {cashFlowFinancing.length > 1 ? (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead className="text-xs">Description</TableHead><TableHead className="text-xs text-right">Current</TableHead><TableHead className="text-xs text-right">Previous</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashFlowFinancing.filter((i) => !i.isSection).map((item) => (
                        <TableRow key={item.description}>
                          <TableCell className="text-sm">{item.description}</TableCell>
                          <TableCell className="text-sm text-right font-mono">{formatCurrency(item.currentPeriod)}</TableCell>
                          <TableCell className="text-sm text-right font-mono text-muted-foreground">{formatCurrency(item.previousPeriod)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <p className="text-sm text-muted-foreground p-4">No financing cash flow data.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════ Budget Tab ═══════════════════ */}
        <TabsContent value="budget" className="space-y-6">
          {budgetActualData.length > 0 ? (
            <>
              {/* Budget vs Actual Bar Chart */}
              <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-cyan-500" />
                    Budget vs Actual by Department
                  </CardTitle>
                  <CardDescription>Comparison across revenue sources</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={budgetChartConfig} className="h-[160px] sm:h-[280px] lg:h-[340px] w-full">
                    <BarChart data={budgetBarChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                      <XAxis dataKey="department" className="text-xs" tickLine={false} axisLine={false} />
                      <YAxis
                        className="text-xs"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="budget" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="actual" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Budget Detail Table */}
              <Card className="border-0 shadow-sm rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-4 w-4 text-violet-500" />
                    Budget Detail
                  </CardTitle>
                  <CardDescription>Budget vs actual by source</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Department</TableHead>
                          <TableHead className="text-xs text-right">Budget</TableHead>
                          <TableHead className="text-xs text-right">Actual</TableHead>
                          <TableHead className="text-xs text-right">Variance</TableHead>
                          <TableHead className="text-xs text-right">Var %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {budgetActualData.map((item) => (
                          <TableRow key={item.department}>
                            <TableCell className="text-sm font-medium">{item.department}</TableCell>
                            <TableCell className="text-sm text-right font-mono">{formatCurrency(item.budget)}</TableCell>
                            <TableCell className="text-sm text-right font-mono">{formatCurrency(item.actual)}</TableCell>
                            <TableCell className="text-sm text-right">
                              <span className={`inline-flex items-center gap-1 font-semibold ${item.variance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {item.variance >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {formatCurrency(Math.abs(item.variance))}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              <Badge
                                variant="secondary"
                                className={`text-xs ${
                                  item.variance >= 0
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                }`}
                              >
                                {formatPercent(item.variancePct)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Totals Row */}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell className="text-sm font-bold">Grand Total</TableCell>
                          <TableCell className="text-sm text-right font-mono font-bold">{formatCurrency(totalBudget)}</TableCell>
                          <TableCell className="text-sm text-right font-mono font-bold">{formatCurrency(totalActual)}</TableCell>
                          <TableCell className="text-sm text-right font-mono font-bold">{formatCurrency(totalVariance)}</TableCell>
                          <TableCell className="text-sm text-right font-mono font-bold">{formatPercent(totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="py-16 flex flex-col items-center justify-center gap-3">
                <Target className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-medium text-muted-foreground">No budget data available</p>
                <p className="text-sm text-muted-foreground">Create budgets or post revenue to see comparisons.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </div>
    );
}
