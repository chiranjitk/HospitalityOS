'use client';

import React, { useState, useMemo } from 'react';
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

// ─── Mock Data ─────────────────────────────────────────────────────────
const monthlyTrendData: MonthlyTrend[] = [
  { month: 'Jan', revenue: 18500000, expenses: 12200000, noi: 6300000 },
  { month: 'Feb', revenue: 17200000, expenses: 11800000, noi: 5400000 },
  { month: 'Mar', revenue: 21300000, expenses: 13400000, noi: 7900000 },
  { month: 'Apr', revenue: 22800000, expenses: 13900000, noi: 8900000 },
  { month: 'May', revenue: 24100000, expenses: 14500000, noi: 9600000 },
  { month: 'Jun', revenue: 25600000, expenses: 15200000, noi: 10400000 },
  { month: 'Jul', revenue: 26800000, expenses: 15800000, noi: 11000000 },
  { month: 'Aug', revenue: 25200000, expenses: 14900000, noi: 10300000 },
  { month: 'Sep', revenue: 23400000, expenses: 14100000, noi: 9300000 },
  { month: 'Oct', revenue: 21900000, expenses: 13700000, noi: 8200000 },
  { month: 'Nov', revenue: 20700000, expenses: 13000000, noi: 7700000 },
  { month: 'Dec', revenue: 27400000, expenses: 16100000, noi: 11300000 },
];

const pnlRevenueData: PnLLineItem[] = [
  { name: 'REVENUE', currentPeriod: 0, previousPeriod: 0, isSection: true, isBold: true },
  { name: 'Room Revenue', currentPeriod: 124800000, previousPeriod: 112500000, indent: 1 },
  { name: 'Food & Beverage', currentPeriod: 38720000, previousPeriod: 35100000, indent: 1 },
  { name: 'Spa & Wellness', currentPeriod: 12400000, previousPeriod: 10800000, indent: 1 },
  { name: 'Event & Banquet', currentPeriod: 18600000, previousPeriod: 17200000, indent: 1 },
  { name: 'Other Revenue', currentPeriod: 8680000, previousPeriod: 7940000, indent: 1 },
  { name: 'Total Revenue', currentPeriod: 202900000, previousPeriod: 183540000, isBold: true },
];

const pnlExpenseData: PnLLineItem[] = [
  { name: 'EXPENSES', currentPeriod: 0, previousPeriod: 0, isSection: true, isBold: true },
  { name: 'Payroll & Benefits', currentPeriod: 58400000, previousPeriod: 54200000, indent: 1 },
  { name: 'Supplies & Consumables', currentPeriod: 18400000, previousPeriod: 17100000, indent: 1 },
  { name: 'Utilities & Energy', currentPeriod: 12800000, previousPeriod: 11500000, indent: 1 },
  { name: 'Maintenance & Repairs', currentPeriod: 8600000, previousPeriod: 9200000, indent: 1 },
  { name: 'Marketing & Sales', currentPeriod: 10200000, previousPeriod: 9800000, indent: 1 },
  { name: 'Administrative & General', currentPeriod: 14600000, previousPeriod: 13800000, indent: 1 },
  { name: 'Technology & Systems', currentPeriod: 4200000, previousPeriod: 3600000, indent: 1 },
  { name: 'Insurance & Legal', currentPeriod: 3800000, previousPeriod: 3500000, indent: 1 },
  { name: 'Total Expenses', currentPeriod: 131000000, previousPeriod: 122700000, isBold: true },
];

const pnlSummaryData: PnLLineItem[] = [
  { name: 'Net Operating Income', currentPeriod: 71900000, previousPeriod: 60840000, isBold: true },
  { name: 'EBITDA', currentPeriod: 82400000, previousPeriod: 70100000, isBold: true },
  { name: 'EBITDA Margin', currentPeriod: 40.6, previousPeriod: 38.2, isBold: true },
];

const cashFlowOperating: CashFlowItem[] = [
  { category: 'OPERATING ACTIVITIES', description: '', currentPeriod: 0, previousPeriod: 0 },
  { category: 'Inflows', description: 'Room Revenue Collected', currentPeriod: 121800000, previousPeriod: 110500000 },
  { category: 'Inflows', description: 'F&B Revenue Collected', currentPeriod: 37400000, previousPeriod: 33800000 },
  { category: 'Inflows', description: 'Other Revenue Collected', currentPeriod: 36800000, previousPeriod: 33200000 },
  { category: 'Outflows', description: 'Payroll Disbursed', currentPeriod: -56200000, previousPeriod: -52400000 },
  { category: 'Outflows', description: 'Vendor Payments', currentPeriod: -41800000, previousPeriod: -38500000 },
  { category: 'Outflows', description: 'Utility Payments', currentPeriod: -12200000, previousPeriod: -10900000 },
  { category: 'Outflows', description: 'Marketing Spend', currentPeriod: -9800000, previousPeriod: -9100000 },
  { category: 'Net', description: 'Net Cash from Operations', currentPeriod: 76800000, previousPeriod: 67200000 },
];

const cashFlowInvesting: CashFlowItem[] = [
  { category: 'INVESTING ACTIVITIES', description: '', currentPeriod: 0, previousPeriod: 0 },
  { category: 'Outflows', description: 'Property Renovations', currentPeriod: -8400000, previousPeriod: -6200000 },
  { category: 'Outflows', description: 'New Equipment', currentPeriod: -3200000, previousPeriod: -4800000 },
  { category: 'Outflows', description: 'IT Infrastructure', currentPeriod: -2100000, previousPeriod: -1500000 },
  { category: 'Inflows', description: 'Asset Disposals', currentPeriod: 600000, previousPeriod: 400000 },
  { category: 'Net', description: 'Net Cash from Investing', currentPeriod: -13100000, previousPeriod: -12100000 },
];

const cashFlowFinancing: CashFlowItem[] = [
  { category: 'FINANCING ACTIVITIES', description: '', currentPeriod: 0, previousPeriod: 0 },
  { category: 'Inflows', description: 'Loan Proceeds', currentPeriod: 0, previousPeriod: 5000000 },
  { category: 'Outflows', description: 'Loan Repayments', currentPeriod: -12000000, previousPeriod: -12000000 },
  { category: 'Outflows', description: 'Dividends Paid', currentPeriod: -15000000, previousPeriod: -12000000 },
  { category: 'Net', description: 'Net Cash from Financing', currentPeriod: -27000000, previousPeriod: -19000000 },
];

const cashFlowMonthlyData: CashFlowSummary[] = [
  { month: 'Jan', opening: 14200000, inflows: 16800000, outflows: 14200000, closing: 16800000 },
  { month: 'Feb', opening: 16800000, inflows: 15400000, outflows: 13900000, closing: 18300000 },
  { month: 'Mar', opening: 18300000, inflows: 19600000, outflows: 15800000, closing: 22100000 },
  { month: 'Apr', opening: 22100000, inflows: 21400000, outflows: 17200000, closing: 26300000 },
  { month: 'May', opening: 26300000, inflows: 22800000, outflows: 18400000, closing: 30700000 },
  { month: 'Jun', opening: 30700000, inflows: 24200000, outflows: 19600000, closing: 35300000 },
  { month: 'Jul', opening: 35300000, inflows: 25600000, outflows: 20800000, closing: 40100000 },
  { month: 'Aug', opening: 40100000, inflows: 23800000, outflows: 19900000, closing: 44000000 },
  { month: 'Sep', opening: 44000000, inflows: 22200000, outflows: 18600000, closing: 47600000 },
  { month: 'Oct', opening: 47600000, inflows: 20800000, outflows: 17900000, closing: 50500000 },
  { month: 'Nov', opening: 50500000, inflows: 19400000, outflows: 17200000, closing: 52700000 },
  { month: 'Dec', opening: 52700000, inflows: 26200000, outflows: 21400000, closing: 57500000 },
];

const budgetActualData: BudgetActualRow[] = [
  {
    department: 'Rooms Division',
    budget: 98000000,
    actual: 94500000,
    variance: 3500000,
    variancePct: 3.6,
    subItems: [
      { department: 'Front Office', budget: 18200000, actual: 17600000, variance: 600000, variancePct: 3.3 },
      { department: 'Housekeeping', budget: 28400000, actual: 27800000, variance: 600000, variancePct: 2.1 },
      { department: 'Reservations', budget: 12400000, actual: 11800000, variance: 600000, variancePct: 4.8 },
      { department: 'Laundry & Linen', budget: 8600000, actual: 8400000, variance: 200000, variancePct: 2.3 },
      { department: 'Concierge', budget: 4200000, actual: 4100000, variance: 100000, variancePct: 2.4 },
    ],
  },
  {
    department: 'Food & Beverage',
    budget: 52000000,
    actual: 54800000,
    variance: -2800000,
    variancePct: -5.4,
    subItems: [
      { department: 'Kitchen Operations', budget: 22400000, actual: 24100000, variance: -1700000, variancePct: -7.6 },
      { department: 'Restaurant Service', budget: 14600000, actual: 15200000, variance: -600000, variancePct: -4.1 },
      { department: 'Banquet & Events', budget: 11200000, actual: 11800000, variance: -600000, variancePct: -5.4 },
      { department: 'Bar & Lounge', budget: 3800000, actual: 3700000, variance: 100000, variancePct: 2.6 },
    ],
  },
  {
    department: 'Spa & Wellness',
    budget: 15200000,
    actual: 14100000,
    variance: 1100000,
    variancePct: 7.2,
    subItems: [
      { department: 'Treatment Rooms', budget: 8600000, actual: 7900000, variance: 700000, variancePct: 8.1 },
      { department: 'Fitness Center', budget: 3400000, actual: 3200000, variance: 200000, variancePct: 5.9 },
      { department: 'Retail Products', budget: 2200000, actual: 2100000, variance: 100000, variancePct: 4.5 },
      { department: 'Pool & Recreation', budget: 1000000, actual: 900000, variance: 100000, variancePct: 10.0 },
    ],
  },
  {
    department: 'Marketing & Sales',
    budget: 14200000,
    actual: 14900000,
    variance: -700000,
    variancePct: -4.9,
    subItems: [
      { department: 'Digital Marketing', budget: 6200000, actual: 6800000, variance: -600000, variancePct: -9.7 },
      { department: 'Sales Team', budget: 4800000, actual: 4700000, variance: 100000, variancePct: 2.1 },
      { department: 'PR & Communications', budget: 2200000, actual: 2400000, variance: -200000, variancePct: -9.1 },
      { department: 'Loyalty Programs', budget: 1000000, actual: 1000000, variance: 0, variancePct: 0 },
    ],
  },
  {
    department: 'Engineering & Maintenance',
    budget: 16800000,
    actual: 15700000,
    variance: 1100000,
    variancePct: 6.5,
    subItems: [
      { department: 'Preventive Maintenance', budget: 6400000, actual: 5900000, variance: 500000, variancePct: 7.8 },
      { department: 'Repairs & Fixes', budget: 5200000, actual: 4900000, variance: 300000, variancePct: 5.8 },
      { department: 'Capital Projects', budget: 3600000, actual: 3500000, variance: 100000, variancePct: 2.8 },
      { department: 'Grounds & Landscaping', budget: 1600000, actual: 1400000, variance: 200000, variancePct: 12.5 },
    ],
  },
  {
    department: 'Administration',
    budget: 18400000,
    actual: 19200000,
    variance: -800000,
    variancePct: -4.3,
    subItems: [
      { department: 'Executive Office', budget: 4800000, actual: 5100000, variance: -300000, variancePct: -6.3 },
      { department: 'Human Resources', budget: 5600000, actual: 5800000, variance: -200000, variancePct: -3.6 },
      { department: 'Finance & Accounting', budget: 4200000, actual: 4400000, variance: -200000, variancePct: -4.8 },
      { department: 'Legal & Compliance', budget: 1800000, actual: 1900000, variance: -100000, variancePct: -5.6 },
      { department: 'Technology', budget: 2000000, actual: 2000000, variance: 0, variancePct: 0 },
    ],
  },
];

const budgetBarChartData = budgetActualData.map((item) => ({
  department: item.department.split(' ')[0],
  budget: item.budget,
  actual: item.actual,
}));

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

// ─── Component ─────────────────────────────────────────────────────────
export default function FinancialStatements() {
  const [activeTab, setActiveTab] = useState('pnl');
  const [period, setPeriod] = useState('year');
  const [expandedDepartments, setExpandedDepartments] = useState<string[]>([]);

  // Compute summary stats
  const totalRevenue = pnlRevenueData.find((d) => d.name === 'Total Revenue')!;
  const totalExpenses = pnlExpenseData.find((d) => d.name === 'Total Expenses')!;
  const noi = pnlSummaryData.find((d) => d.name === 'Net Operating Income')!;
  const ebitda = pnlSummaryData.find((d) => d.name === 'EBITDA')!;

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

  const netCashOperations = cashFlowOperating.find((d) => d.description.includes('Net Cash from Operations'))!;
  const netCashInvesting = cashFlowInvesting.find((d) => d.description.includes('Net Cash from Investing'))!;
  const netCashFinancing = cashFlowFinancing.find((d) => d.description.includes('Net Cash from Financing'))!;
  const netCashPosition = netCashOperations.currentPeriod + netCashInvesting.currentPeriod + netCashFinancing.currentPeriod;

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
                            {item.name === 'Total Revenue' ? formatCurrency(item.currentPeriod) : formatCurrency(item.currentPeriod)}
                          </TableCell>
                          <TableCell className="text-sm text-right font-mono text-muted-foreground">
                            {item.name === 'Total Revenue' ? formatCurrency(item.previousPeriod) : formatCurrency(item.previousPeriod)}
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
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Net Operating Income</p>
                  <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">{formatCurrency(noi.currentPeriod)}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">NOI Margin: {((noi.currentPeriod / totalRevenue.currentPeriod) * 100).toFixed(1)}%</p>
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
                    {((totalExpenses.currentPeriod / totalRevenue.currentPeriod) * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">Expenses / Revenue</p>
                  <div className={`flex items-center gap-1 mt-1 text-xs ${expenseChange <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {expenseChange <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                    <span>{formatPercent(expenseChange)} expense growth</span>
                  </div>
                </div>
              </div>
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
            </CardContent>
          </Card>

          {/* Cash Flow Summary Cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Net Cash from Operations</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(netCashOperations.currentPeriod)}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
                  <TrendingUp className="h-3 w-3" />
                  <span>+14.3% vs previous year</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Net Cash from Investing</p>
                <p className="text-xl font-bold text-red-500 mt-1">{formatCurrency(netCashInvesting.currentPeriod)}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                  <TrendingDown className="h-3 w-3" />
                  <span>Capital expenditure period</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Net Cash Position</p>
                <p className={`text-xl font-bold mt-1 ${netCashPosition >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatCurrency(netCashPosition)}
                </p>
                <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
                  <DollarSign className="h-3 w-3" />
                  <span>Ending cash: {formatCurrency(57500000)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cash Flow Statements */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Operating Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cashFlowOperating.map((item, idx) => {
                    if (item.description === '') {
                      return (
                        <p key={idx} className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          {item.category}
                        </p>
                      );
                    }
                    const isTotal = item.description.includes('Net Cash');
                    return (
                      <div key={idx} className={`flex items-center justify-between ${isTotal ? 'pt-2 border-t mt-2' : ''}`}>
                        <span className={`text-sm ${isTotal ? 'font-bold' : 'text-muted-foreground'}`}>
                          {item.description}
                        </span>
                        <span className={`text-sm font-mono ${item.currentPeriod >= 0 ? 'text-emerald-600' : 'text-red-500'} ${isTotal ? 'font-bold' : ''}`}>
                          {formatCurrency(item.currentPeriod)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Investing Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cashFlowInvesting.map((item, idx) => {
                    if (item.description === '') {
                      return (
                        <p key={idx} className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          {item.category}
                        </p>
                      );
                    }
                    const isTotal = item.description.includes('Net Cash');
                    return (
                      <div key={idx} className={`flex items-center justify-between ${isTotal ? 'pt-2 border-t mt-2' : ''}`}>
                        <span className={`text-sm ${isTotal ? 'font-bold' : 'text-muted-foreground'}`}>
                          {item.description}
                        </span>
                        <span className={`text-sm font-mono ${item.currentPeriod >= 0 ? 'text-emerald-600' : 'text-red-500'} ${isTotal ? 'font-bold' : ''}`}>
                          {formatCurrency(item.currentPeriod)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Financing Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cashFlowFinancing.map((item, idx) => {
                    if (item.description === '') {
                      return (
                        <p key={idx} className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          {item.category}
                        </p>
                      );
                    }
                    const isTotal = item.description.includes('Net Cash');
                    return (
                      <div key={idx} className={`flex items-center justify-between ${isTotal ? 'pt-2 border-t mt-2' : ''}`}>
                        <span className={`text-sm ${isTotal ? 'font-bold' : 'text-muted-foreground'}`}>
                          {item.description}
                        </span>
                        <span className={`text-sm font-mono ${item.currentPeriod >= 0 ? 'text-emerald-600' : 'text-red-500'} ${isTotal ? 'font-bold' : ''}`}>
                          {formatCurrency(item.currentPeriod)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════ Budget vs Actual Tab ═══════════════════ */}
        <TabsContent value="budget" className="space-y-6">
          {/* Budget Chart */}
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-4 w-4 text-cyan-500" />
                Budget vs Actual by Department
              </CardTitle>
              <CardDescription>Comparative analysis of planned versus actual spending</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={budgetChartConfig} className="h-[160px] sm:h-[250px] lg:h-[320px] w-full">
                <BarChart data={budgetBarChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis dataKey="department" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₹${(v / 10000000).toFixed(0)}Cr`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="budget" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="actual" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Budget Summary Cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Total Budget Allocation</p>
                <p className="text-xl font-bold text-cyan-600 dark:text-cyan-400 mt-1">{formatCurrency(totalBudget)}</p>
                <p className="text-xs text-muted-foreground mt-1">Across all departments</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Total Actual Spending</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{formatCurrency(totalActual)}</p>
                <p className="text-xs text-muted-foreground mt-1">{((totalActual / totalBudget) * 100).toFixed(1)}% of budget</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Net Variance</p>
                <p className={`text-xl font-bold mt-1 ${totalVariance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatCurrency(totalVariance)}
                </p>
                <Badge
                  variant="secondary"
                  className={`mt-1 text-xs ${
                    totalVariance >= 0
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                  }`}
                >
                  {totalVariance >= 0 ? 'Favorable' : 'Unfavorable'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Budget Table */}
          <Card className="border-0 shadow-sm rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Department Budget Detail</CardTitle>
              <CardDescription>Expand rows to see cost center breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-8"></TableHead>
                      <TableHead className="text-xs">Department / Cost Center</TableHead>
                      <TableHead className="text-xs text-right">Budget</TableHead>
                      <TableHead className="text-xs text-right">Actual</TableHead>
                      <TableHead className="text-xs text-right">Variance</TableHead>
                      <TableHead className="text-xs text-right">Var %</TableHead>
                      <TableHead className="text-xs text-right">Utilization</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgetActualData.map((dept) => {
                      const isExpanded = expandedDepartments.includes(dept.department);
                      const utilization = (dept.actual / dept.budget) * 100;
                      return (
                        <React.Fragment key={dept.department}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => toggleDepartment(dept.department)}
                          >
                            <TableCell className="text-xs text-muted-foreground">
                              <span className={`inline-block transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                ▶
                              </span>
                            </TableCell>
                            <TableCell className="text-sm font-semibold">{dept.department}</TableCell>
                            <TableCell className="text-sm text-right font-mono">{formatCurrency(dept.budget)}</TableCell>
                            <TableCell className="text-sm text-right font-mono">{formatCurrency(dept.actual)}</TableCell>
                            <TableCell className="text-sm text-right">
                              {varianceBadge(dept.variance, dept.variancePct)}
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              <Badge
                                variant="secondary"
                                className={`text-xs ${
                                  dept.variance >= 0
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                }`}
                              >
                                {formatPercent(dept.variancePct)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      utilization > 100
                                        ? 'bg-red-500'
                                        : utilization > 90
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${Math.min(utilization, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono w-12 text-right">{utilization.toFixed(0)}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded &&
                            dept.subItems?.map((sub) => {
                              const subUtil = (sub.actual / sub.budget) * 100;
                              return (
                                <TableRow key={sub.department} className="bg-muted/30">
                                  <TableCell />
                                  <TableCell className="text-sm pl-8 text-muted-foreground">{sub.department}</TableCell>
                                  <TableCell className="text-sm text-right font-mono text-muted-foreground">
                                    {formatCurrency(sub.budget)}
                                  </TableCell>
                                  <TableCell className="text-sm text-right font-mono text-muted-foreground">
                                    {formatCurrency(sub.actual)}
                                  </TableCell>
                                  <TableCell className="text-sm text-right">
                                    {varianceBadge(sub.variance, sub.variancePct)}
                                  </TableCell>
                                  <TableCell className="text-sm text-right">
                                    <Badge
                                      variant="secondary"
                                      className={`text-xs ${
                                        sub.variance >= 0
                                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                      }`}
                                    >
                                      {formatPercent(sub.variancePct)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm text-right">
                                    <div className="flex items-center gap-2 justify-end">
                                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            subUtil > 100
                                              ? 'bg-red-500'
                                              : subUtil > 90
                                              ? 'bg-amber-500'
                                              : 'bg-emerald-500'
                                          }`}
                                          style={{ width: `${Math.min(subUtil, 100)}%` }}
                                        />
                                      </div>
                                      <span className="text-xs font-mono w-12 text-right">{subUtil.toFixed(0)}%</span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
