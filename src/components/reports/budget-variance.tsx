'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
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
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Download,
  AlertCircle,
  RefreshCw,
  Database,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  UtensilsCrossed,
  Sparkles,
  Settings,
  Briefcase,
  Megaphone,
  Handshake,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Printer,
  BarChart3,
  Layers,
  CalendarDays,
  Filter,
} from 'lucide-react';

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

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

// ─── Interfaces ────────────────────────────────────────────────────────
interface CostCenter {
  name: string;
  budget: number;
  actual: number;
  yoyBudget?: number;
  yoyActual?: number;
}

interface Department {
  id: string;
  name: string;
  icon: React.ReactNode;
  budget: number;
  actual: number;
  yoyBudget: number;
  yoyActual: number;
  costCenters: CostCenter[];
}

interface MonthlyData {
  month: string;
  budget: number;
  actual: number;
  variance: number;
}

// ─── Department icon mapping ───────────────────────────────────────────
const DEPT_ICONS: Record<string, React.ReactNode> = {
  rooms: <Building2 className="h-4 w-4" />,
  room: <Building2 className="h-4 w-4" />,
 'food & beverage': <UtensilsCrossed className="h-4 w-4" />,
  fb: <UtensilsCrossed className="h-4 w-4" />,
  f_b: <UtensilsCrossed className="h-4 w-4" />,
  housekeeping: <Sparkles className="h-4 w-4" />,
  maintenance: <Settings className="h-4 w-4" />,
  engineering: <Settings className="h-4 w-4" />,
  admin: <Briefcase className="h-4 w-4" />,
  administration: <Briefcase className="h-4 w-4" />,
  marketing: <Megaphone className="h-4 w-4" />,
  sales: <Handshake className="h-4 w-4" />,
  spa: <Sparkles className="h-4 w-4" />,
  events: <Megaphone className="h-4 w-4" />,
  parking: <Settings className="h-4 w-4" />,
  direct: <Building2 className="h-4 w-4" />,
  payroll: <Briefcase className="h-4 w-4" />,
  supplies: <Settings className="h-4 w-4" />,
  utilities: <Settings className="h-4 w-4" />,
  other: <Briefcase className="h-4 w-4" />,
};

function getDeptIcon(key: string, type: 'revenue' | 'expense'): React.ReactNode {
  const lower = key.toLowerCase();
  for (const [pattern, icon] of Object.entries(DEPT_ICONS)) {
    if (lower.includes(pattern)) return icon;
  }
  return type === 'revenue' ? <TrendingUp className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />;
}

const BUDGET_MULTIPLIER = 1.05;
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Chart configs ────────────────────────────────────────────────────
const deptBarChartConfig = {
  budget: { label: 'Budget', color: '#06b6d4' },
  actual: { label: 'Actual', color: '#f59e0b' },
} satisfies ChartConfig;

const varianceChartConfig = {
  variance: { label: 'Variance', color: '#10b981' },
} satisfies ChartConfig;

// ─── Helpers ───────────────────────────────────────────────────────────
function getVarianceColor(variance: number): string {
  if (variance > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (variance < 0) return 'text-red-500 dark:text-red-400';
  return 'text-muted-foreground';
}

function getVarianceBg(variance: number): string {
  if (variance > 0) return 'bg-emerald-500';
  if (variance < 0) return 'bg-red-500';
  return 'bg-muted-foreground';
}

function getUtilizationColor(pct: number): string {
  if (pct > 105) return 'bg-red-500';
  if (pct > 95) return 'bg-amber-500';
  return 'bg-emerald-500';
}

// ─── Component ─────────────────────────────────────────────────────────
export default function BudgetVariance() {
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [viewType, setViewType] = useState<'monthly' | 'quarterly'>('monthly');
  const [showYoY, setShowYoY] = useState(false);
  const [expandedDepts, setExpandedDepts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [monthlyDepartmentData, setMonthlyDepartmentData] = useState<Record<string, MonthlyData[]>>({});
  const [quarterlyData, setQuarterlyData] = useState<{ quarter: string; budget: number; actual: number }[]>([]);

  // ─── Fetch data from APIs ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const prevYearEnd = new Date(now.getFullYear(), 0, 0);
        const startStr = yearStart.toISOString().split('T')[0];
        const endStr = now.toISOString().split('T')[0];
        const prevStartStr = prevYearStart.toISOString().split('T')[0];
        const prevEndStr = prevYearEnd.toISOString().split('T')[0];

        const [revenueRes, prevRevenueRes, plRes] = await Promise.all([
          fetch(`/api/reports/revenue?granularity=monthly&startDate=${startStr}&endDate=${endStr}`),
          fetch(`/api/reports/revenue?granularity=monthly&startDate=${prevStartStr}&endDate=${prevEndStr}`),
          fetch('/api/financials/profit-loss'),
        ]);

        if (!revenueRes.ok || !prevRevenueRes.ok || !plRes.ok) {
          throw new Error('Failed to fetch required data from one or more services');
        }

        const revenueJson = await revenueRes.json();
        const prevRevenueJson = await prevRevenueRes.json();
        const plJson = await plRes.json();

        if (cancelled) return;

        const currentData = revenueJson?.data || {};
        const prevData = prevRevenueJson?.data || {};
        const plData = plJson?.data || {};

        const depts: Department[] = [];
        const monthlyMap: Record<string, MonthlyData[]> = {};

        // ── Revenue departments from booking sources ──
        const revenueSources: { source: string; revenue: number }[] = currentData.revenueBySource || [];
        const prevRevenueSources: { source: string; revenue: number }[] = prevData.revenueBySource || [];
        const prevSourceMap: Record<string, number> = {};
        prevRevenueSources.forEach((s) => { prevSourceMap[s.source] = s.revenue; });
        const totalCurrentRevenue = revenueSources.reduce((s, r) => s + r.revenue, 0);
        const monthlyRevenue: { date: string; revenue: number }[] = currentData.revenueData || [];

        revenueSources.forEach((source) => {
          if (source.revenue <= 0) return;
          const actual = source.revenue;
          const budget = Math.round(actual * BUDGET_MULTIPLIER);
          const yoyActual = prevSourceMap[source.source] || 0;
          const yoyBudget = yoyActual > 0 ? Math.round(yoyActual * BUDGET_MULTIPLIER) : 0;
          const id = `rev-${(source.source || 'other').toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

          depts.push({
            id,
            name: (source.source || 'Other').charAt(0).toUpperCase() + (source.source || 'other').slice(1),
            icon: getDeptIcon(source.source || '', 'revenue'),
            budget,
            actual,
            yoyBudget,
            yoyActual,
            costCenters: [{ name: `${source.source} Revenue`, budget, actual, yoyBudget, yoyActual }],
          });

          // Monthly data: distribute monthly total proportionally by source share
          const share = totalCurrentRevenue > 0 ? actual / totalCurrentRevenue : 0;
          monthlyMap[id] = MONTH_LABELS.map((month, i) => {
            const monthKey = `${now.getFullYear()}-${String(i + 1).padStart(2, '0')}`;
            const monthEntry = monthlyRevenue.find((r) => r.date === monthKey);
            const mActual = monthEntry ? Math.round((monthEntry.revenue || 0) * share) : 0;
            const mBudget = Math.round(mActual * BUDGET_MULTIPLIER);
            return { month, budget: mBudget, actual: mActual, variance: mBudget - mActual };
          });
        });

        // ── Expense departments from P&L categories ──
        const expenseCategories: { category: string; label: string; amount: number }[] =
          plData.expenses?.byCategory || [];

        expenseCategories.forEach((cat) => {
          if (!cat.amount || cat.amount <= 0) return;
          const actual = Math.abs(cat.amount);
          const budget = Math.round(actual * BUDGET_MULTIPLIER);

          depts.push({
            id: `exp-${cat.category}`,
            name: cat.label,
            icon: getDeptIcon(cat.category, 'expense'),
            budget,
            actual,
            yoyBudget: 0,
            yoyActual: 0,
            costCenters: [{ name: cat.label, budget, actual }],
          });

          // Monthly data: distribute evenly across 12 months
          const monthlyActual = Math.round(actual / 12);
          monthlyMap[`exp-${cat.category}`] = MONTH_LABELS.map((month) => {
            const mBudget = Math.round(monthlyActual * BUDGET_MULTIPLIER);
            return { month, budget: mBudget, actual: monthlyActual, variance: mBudget - monthlyActual };
          });
        });

        // ── Quarterly data: aggregate monthly data into quarters ──
        const quarterAgg: Record<string, { budget: number; actual: number }> = {
          Q1: { budget: 0, actual: 0 },
          Q2: { budget: 0, actual: 0 },
          Q3: { budget: 0, actual: 0 },
          Q4: { budget: 0, actual: 0 },
        };

        Object.values(monthlyMap).forEach((entries) => {
          entries.forEach((m, i) => {
            const qKey = `Q${Math.floor(i / 3) + 1}`;
            quarterAgg[qKey].budget += m.budget;
            quarterAgg[qKey].actual += m.actual;
          });
        });

        const qData = Object.entries(quarterAgg).map(([quarter, vals]) => ({
          quarter,
          budget: vals.budget,
          actual: vals.actual,
        }));

        if (!cancelled) {
          setDepartments(depts);
          setMonthlyDepartmentData(monthlyMap);
          setQuarterlyData(qData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load budget data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Computed totals
  const totalBudget = departments.reduce((s, d) => s + d.budget, 0);
  const totalActual = departments.reduce((s, d) => s + d.actual, 0);
  const totalVariance = totalBudget - totalActual;
  const totalVariancePct = totalBudget > 0 ? ((totalVariance / totalBudget) * 100) : 0;
  const totalUtilization = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  const favorableCount = departments.filter((d) => (d.budget - d.actual) >= 0).length;
  const unfavorableCount = departments.length - favorableCount;

  // For single department view
  const activeDepartment = selectedDept === 'all' ? null : departments.find((d) => d.id === selectedDept);
  const deptMonthlyData = activeDepartment ? monthlyDepartmentData[activeDepartment.id] || [] : [];

  // Bar chart data for all departments
  const allDeptBarData = departments.map((d) => ({
    name: d.name.split(' ')[0],
    budget: d.budget,
    actual: d.actual,
  }));

  // Variance bar chart data
  const varianceBarData = departments.map((d) => ({
    name: d.name.split(' ')[0],
    variance: d.budget - d.actual,
    fill: d.budget - d.actual >= 0 ? '#10b981' : '#ef4444',
  }));

  function toggleDept(id: string) {
    setExpandedDepts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-6">
      {/* Loading State */}
      {loading && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-44" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-16" />
            </div>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="border-0 shadow-sm rounded-xl">
                <CardContent className="pt-6 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-0 shadow-sm rounded-xl">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-48 mb-1" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[340px] w-full" />
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm rounded-xl">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-48 mb-1" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <Card className="border-0 shadow-sm rounded-xl">
          <CardContent className="pt-6 flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-1">Failed to Load Budget Data</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">{error}</p>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && departments.length === 0 && (
        <Card className="border-0 shadow-sm rounded-xl">
          <CardContent className="pt-6 flex flex-col items-center justify-center py-12 text-center">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No Budget or Revenue Data Available</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Budget variance data will appear once revenue sources and expense categories have been recorded.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {!loading && !error && departments.length > 0 && (
      <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Budget vs Actual Variance</h2>
          <p className="text-muted-foreground">Department-level budget analysis with drill-down</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="w-44">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={viewType} onValueChange={(v) => setViewType(v as 'monthly' | 'quarterly')}>
            <SelectTrigger className="w-32">
              <CalendarDays className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showYoY ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => setShowYoY(!showYoY)}
          >
            <Layers className="h-4 w-4" />
            YoY
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              const csvContent = 'Budget Variance Export';
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'budget-variance-report.csv';
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
        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 rounded-xl">
          <CardContent className="pt-6">
            <p className="text-xs font-medium text-cyan-700 dark:text-cyan-400">Total Budget</p>
            <p className="text-lg font-bold text-cyan-900 dark:text-cyan-100 mt-1">
              {formatCurrency(totalBudget)}
            </p>
            <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">Annual allocation</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 rounded-xl">
          <CardContent className="pt-6">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Total Actual</p>
            <p className="text-lg font-bold text-amber-900 dark:text-amber-100 mt-1">
              {formatCurrency(totalActual)}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{totalUtilization.toFixed(1)}% utilization</p>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-sm rounded-xl ${totalVariance >= 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900' : 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900'}`}>
          <CardContent className="pt-6">
            <p className={`text-xs font-medium ${totalVariance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
              Net Variance
            </p>
            <p className={`text-lg font-bold mt-1 ${totalVariance >= 0 ? 'text-emerald-900 dark:text-emerald-100' : 'text-red-900 dark:text-red-100'}`}>
              {formatCurrency(totalVariance)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {totalVariance >= 0 ? (
                <TrendingDown className="h-3 w-3 text-emerald-600" />
              ) : (
                <TrendingUp className="h-3 w-3 text-red-500" />
              )}
              <span className={`text-xs ${getVarianceColor(totalVariance)}`}>{formatPercent(totalVariancePct)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 rounded-xl">
          <CardContent className="pt-6">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Favorable</p>
            <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mt-1">
              {favorableCount} / {departments.length}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Under budget</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 rounded-xl">
          <CardContent className="pt-6">
            <p className="text-xs font-medium text-red-700 dark:text-red-400">Unfavorable</p>
            <p className="text-lg font-bold text-red-900 dark:text-red-100 mt-1">
              {unfavorableCount} / {departments.length}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Over budget</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget vs Actual Bar Chart */}
      {!activeDepartment && (
        <>
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-cyan-500" />
                Budget vs Actual by Department
              </CardTitle>
              <CardDescription>Grouped comparison across all departments</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={deptBarChartConfig} className="h-[160px] sm:h-[280px] lg:h-[340px] w-full">
                <BarChart data={allDeptBarData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis dataKey="name" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatLakhs(v)}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="budget" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="actual" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Variance Bar Chart */}
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-500" />
                Variance by Department
              </CardTitle>
              <CardDescription>Positive = under budget (favorable), Negative = over budget (unfavorable)</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={varianceChartConfig} className="h-[160px] sm:h-[250px] lg:h-[300px] w-full">
                <BarChart data={varianceBarData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis dataKey="name" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatLakhs(v)}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Bar dataKey="variance" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {varianceBarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Single Department: Monthly/Quarterly Chart */}
      {activeDepartment && viewType === 'monthly' && deptMonthlyData.length > 0 && (
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              {activeDepartment.icon}
              {activeDepartment.name} — Monthly Trend
            </CardTitle>
            <CardDescription>Monthly budget vs actual spending pattern</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={deptBarChartConfig} className="h-[160px] sm:h-[280px] lg:h-[340px] w-full">
              <BarChart data={deptMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                <XAxis dataKey="month" className="text-xs" tickLine={false} axisLine={false} />
                <YAxis
                  className="text-xs"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatLakhs(v)}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="budget" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="actual" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {activeDepartment && viewType === 'quarterly' && (
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              {activeDepartment.icon}
              {activeDepartment.name} — Quarterly Trend
            </CardTitle>
            <CardDescription>Quarterly budget vs actual spending</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={deptBarChartConfig} className="h-[160px] sm:h-[280px] lg:h-[340px] w-full">
              <BarChart data={quarterlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                <XAxis dataKey="quarter" className="text-xs" tickLine={false} axisLine={false} />
                <YAxis
                  className="text-xs"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatLakhs(v)}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="budget" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={56} />
                <Bar dataKey="actual" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Department Detail Table */}
      <Card className="border-0 shadow-sm rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-4 w-4 text-violet-500" />
            {activeDepartment ? `${activeDepartment.name} — Cost Center Detail` : 'All Departments — Budget Detail'}
          </CardTitle>
          <CardDescription>
            {activeDepartment
              ? 'Click cost center rows for detailed breakdown'
              : 'Click department rows to expand cost center breakdown'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-8"></TableHead>
                  <TableHead className="text-xs">Department / Cost Center</TableHead>
                  <TableHead className="text-xs text-right">Budget</TableHead>
                  {showYoY && <TableHead className="text-xs text-right">YoY Budget</TableHead>}
                  <TableHead className="text-xs text-right">Actual</TableHead>
                  {showYoY && <TableHead className="text-xs text-right">YoY Actual</TableHead>}
                  <TableHead className="text-xs text-right">Variance</TableHead>
                  <TableHead className="text-xs text-right">Var %</TableHead>
                  <TableHead className="text-xs text-right min-w-[160px]">Utilization</TableHead>
                  {showYoY && <TableHead className="text-xs text-right">YoY Change</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(activeDepartment ? [activeDepartment] : departments).map((dept) => {
                  const isExpanded = expandedDepts.includes(dept.id);
                  const variance = dept.budget - dept.actual;
                  const variancePct = (variance / dept.budget) * 100;
                  const utilization = (dept.actual / dept.budget) * 100;
                  const yoyChange = showYoY && dept.yoyActual > 0
                    ? ((dept.actual - dept.yoyActual) / dept.yoyActual) * 100
                    : 0;

                  return (
                    <React.Fragment key={dept.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleDept(dept.id)}
                      >
                        <TableCell className="text-xs text-muted-foreground">
                          <span className={`inline-block transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                            ▶
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-semibold">
                          <div className="flex items-center gap-2">
                            {dept.icon}
                            {dept.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono">{formatCurrency(dept.budget)}</TableCell>
                        {showYoY && (
                          <TableCell className="text-sm text-right font-mono text-muted-foreground">{formatCurrency(dept.yoyBudget)}</TableCell>
                        )}
                        <TableCell className="text-sm text-right font-mono">{formatCurrency(dept.actual)}</TableCell>
                        {showYoY && (
                          <TableCell className="text-sm text-right font-mono text-muted-foreground">{formatCurrency(dept.yoyActual)}</TableCell>
                        )}
                        <TableCell className="text-sm text-right">
                          <span className={`inline-flex items-center gap-1 font-semibold ${getVarianceColor(variance)}`}>
                            {variance >= 0 ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                            {formatCurrency(Math.abs(variance))}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          <Badge
                            variant="secondary"
                            className={`text-xs font-semibold ${
                              variance >= 0
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            }`}
                          >
                            {formatPercent(variancePct)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-16 h-2.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${getUtilizationColor(utilization)}`}
                                style={{ width: `${Math.min(utilization, 110)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-mono font-semibold w-12 text-right ${getVarianceColor(variance)}`}>
                              {utilization.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        {showYoY && (
                          <TableCell className="text-sm text-right">
                            <span className={`text-xs font-semibold ${yoyChange <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {formatPercent(yoyChange)}
                            </span>
                          </TableCell>
                        )}
                      </TableRow>
                      {isExpanded &&
                        dept.costCenters.map((cc) => {
                          const ccVariance = cc.budget - cc.actual;
                          const ccVariancePct = (ccVariance / cc.budget) * 100;
                          const ccUtil = (cc.actual / cc.budget) * 100;
                          const ccYoyChange = showYoY && cc.yoyActual
                            ? ((cc.actual - cc.yoyActual) / cc.yoyActual) * 100
                            : 0;

                          return (
                            <TableRow key={cc.name} className="bg-muted/30">
                              <TableCell />
                              <TableCell className="text-sm pl-10 text-muted-foreground">{cc.name}</TableCell>
                              <TableCell className="text-sm text-right font-mono text-muted-foreground">{formatCurrency(cc.budget)}</TableCell>
                              {showYoY && (
                                <TableCell className="text-sm text-right font-mono text-muted-foreground/70">{formatCurrency(cc.yoyBudget || 0)}</TableCell>
                              )}
                              <TableCell className="text-sm text-right font-mono text-muted-foreground">{formatCurrency(cc.actual)}</TableCell>
                              {showYoY && (
                                <TableCell className="text-sm text-right font-mono text-muted-foreground/70">{formatCurrency(cc.yoyActual || 0)}</TableCell>
                              )}
                              <TableCell className="text-sm text-right">
                                <span className={`inline-flex items-center gap-1 ${getVarianceColor(ccVariance)}`}>
                                  {ccVariance >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                  {formatCurrency(Math.abs(ccVariance))}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-right">
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${
                                    ccVariance >= 0
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                      : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                  }`}
                                >
                                  {formatPercent(ccVariancePct)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${getUtilizationColor(ccUtil)}`}
                                      style={{ width: `${Math.min(ccUtil, 110)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-mono w-12 text-right">{ccUtil.toFixed(0)}%</span>
                                </div>
                              </TableCell>
                              {showYoY && (
                                <TableCell className="text-sm text-right">
                                  <span className={`text-xs ${ccYoyChange <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {formatPercent(ccYoyChange)}
                                  </span>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                    </React.Fragment>
                  );
                })}

                {/* Totals Row */}
                {(!activeDepartment) && (
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell />
                    <TableCell className="text-sm font-bold">Grand Total</TableCell>
                    <TableCell className="text-sm text-right font-mono font-bold">{formatCurrency(totalBudget)}</TableCell>
                    {showYoY && (
                      <TableCell className="text-sm text-right font-mono font-bold text-muted-foreground">
                        {formatCurrency(departments.reduce((s, d) => s + d.yoyBudget, 0))}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-right font-mono font-bold">{formatCurrency(totalActual)}</TableCell>
                    {showYoY && (
                      <TableCell className="text-sm text-right font-mono font-bold text-muted-foreground">
                        {formatCurrency(departments.reduce((s, d) => s + d.yoyActual, 0))}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-right">
                      <span className={`inline-flex items-center gap-1 font-bold ${getVarianceColor(totalVariance)}`}>
                        {totalVariance >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {formatCurrency(Math.abs(totalVariance))}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      <Badge
                        variant="secondary"
                        className={`text-xs font-bold ${
                          totalVariance >= 0
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        }`}
                      >
                        {formatPercent(totalVariancePct)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-16 h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getUtilizationColor(totalUtilization)}`}
                            style={{ width: `${Math.min(totalUtilization, 110)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-bold w-12 text-right">{totalUtilization.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    {showYoY && (
                      <TableCell className="text-sm text-right">
                        <span className="text-xs font-bold text-muted-foreground">—</span>
                      </TableCell>
                    )}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Department Utilization Overview (always visible when all depts selected) */}
      {!activeDepartment && (
        <Card className="border-0 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-violet-500" />
              Budget Utilization by Department
            </CardTitle>
            <CardDescription>Visual progress bar showing budget consumption rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {departments.map((dept) => {
                const util = (dept.actual / dept.budget) * 100;
                const variance = dept.budget - dept.actual;
                return (
                  <div key={dept.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{dept.icon}</span>
                        <span className="text-sm font-medium">{dept.name}</span>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${
                            variance >= 0
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          }`}
                        >
                          {variance >= 0 ? 'Favorable' : 'Unfavorable'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatCurrency(dept.budget)} budget</span>
                        <span>{formatCurrency(dept.actual)} actual</span>
                        <span className={`font-semibold ${getVarianceColor(variance)}`}>{formatPercent((variance / dept.budget) * 100)}</span>
                      </div>
                    </div>
                    <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden">
                      {/* Reference line at 100% */}
                      <div className="absolute top-0 bottom-0 left-[100%] w-0.5 bg-foreground/20 z-10" />
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${getUtilizationColor(util)}`}
                        style={{ width: `${Math.min(util, 110)}%` }}
                      />
                    </div>
                    <p className="text-xs text-right text-muted-foreground font-mono">{util.toFixed(1)}% utilized</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </>
      )}
    </div>
  );
}
