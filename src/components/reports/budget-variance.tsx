'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
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

// ─── Mock Data ─────────────────────────────────────────────────────────
const departments: Department[] = [
  {
    id: 'rooms',
    name: 'Rooms Division',
    icon: <Building2 className="h-4 w-4" />,
    budget: 98000000,
    actual: 94500000,
    yoyBudget: 92000000,
    yoyActual: 89500000,
    costCenters: [
      { name: 'Front Office Operations', budget: 18200000, actual: 17600000, yoyBudget: 17100000, yoyActual: 16600000 },
      { name: 'Housekeeping', budget: 28400000, actual: 27800000, yoyBudget: 26500000, yoyActual: 26100000 },
      { name: 'Reservations & Guest Services', budget: 12400000, actual: 11800000, yoyBudget: 11800000, yoyActual: 11400000 },
      { name: 'Laundry & Linen Services', budget: 8600000, actual: 8400000, yoyBudget: 8100000, yoyActual: 7900000 },
      { name: 'Concierge & Bell Desk', budget: 4200000, actual: 4100000, yoyBudget: 3900000, yoyActual: 3800000 },
      { name: 'Room Amenities & Supplies', budget: 6200000, actual: 5800000, yoyBudget: 5600000, yoyActual: 5300000 },
    ],
  },
  {
    id: 'fb',
    name: 'Food & Beverage',
    icon: <UtensilsCrossed className="h-4 w-4" />,
    budget: 52000000,
    actual: 54800000,
    yoyBudget: 48500000,
    yoyActual: 50200000,
    costCenters: [
      { name: 'Kitchen Operations', budget: 22400000, actual: 24100000, yoyBudget: 20800000, yoyActual: 21900000 },
      { name: 'Restaurant & Room Service', budget: 14600000, actual: 15200000, yoyBudget: 13600000, yoyActual: 14200000 },
      { name: 'Banquet & Event Catering', budget: 11200000, actual: 11800000, yoyBudget: 10500000, yoyActual: 11000000 },
      { name: 'Bar & Lounge', budget: 3800000, actual: 3700000, yoyBudget: 3600000, yoyActual: 3100000 },
    ],
  },
  {
    id: 'housekeeping',
    name: 'Housekeeping',
    icon: <Sparkles className="h-4 w-4" />,
    budget: 32400000,
    actual: 31600000,
    yoyBudget: 30200000,
    yoyActual: 29800000,
    costCenters: [
      { name: 'Room Cleaning', budget: 16400000, actual: 15800000, yoyBudget: 15200000, yoyActual: 14900000 },
      { name: 'Public Area Maintenance', budget: 8200000, actual: 8100000, yoyBudget: 7800000, yoyActual: 7600000 },
      { name: 'Chemical Supplies', budget: 4800000, actual: 4600000, yoyBudget: 4500000, yoyActual: 4300000 },
      { name: 'Specialty Cleaning', budget: 3000000, actual: 3100000, yoyBudget: 2700000, yoyActual: 3000000 },
    ],
  },
  {
    id: 'maintenance',
    name: 'Engineering & Maintenance',
    icon: <Settings className="h-4 w-4" />,
    budget: 16800000,
    actual: 15700000,
    yoyBudget: 15800000,
    yoyActual: 16200000,
    costCenters: [
      { name: 'Preventive Maintenance', budget: 6400000, actual: 5900000, yoyBudget: 6000000, yoyActual: 5800000 },
      { name: 'Corrective Repairs', budget: 5200000, actual: 4900000, yoyBudget: 4900000, yoyActual: 5400000 },
      { name: 'Capital Projects', budget: 3600000, actual: 3500000, yoyBudget: 3400000, yoyActual: 3600000 },
      { name: 'Grounds & Landscaping', budget: 1600000, actual: 1400000, yoyBudget: 1500000, yoyActual: 1400000 },
    ],
  },
  {
    id: 'admin',
    name: 'Administration',
    icon: <Briefcase className="h-4 w-4" />,
    budget: 18400000,
    actual: 19200000,
    yoyBudget: 17200000,
    yoyActual: 17900000,
    costCenters: [
      { name: 'Executive Office', budget: 4800000, actual: 5100000, yoyBudget: 4500000, yoyActual: 4700000 },
      { name: 'Human Resources', budget: 5600000, actual: 5800000, yoyBudget: 5200000, yoyActual: 5400000 },
      { name: 'Finance & Accounting', budget: 4200000, actual: 4400000, yoyBudget: 3900000, yoyActual: 4100000 },
      { name: 'Legal & Compliance', budget: 1800000, actual: 1900000, yoyBudget: 1700000, yoyActual: 1800000 },
      { name: 'IT & Technology', budget: 2000000, actual: 2000000, yoyBudget: 1900000, yoyActual: 1900000 },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    icon: <Megaphone className="h-4 w-4" />,
    budget: 14200000,
    actual: 14900000,
    yoyBudget: 13200000,
    yoyActual: 13800000,
    costCenters: [
      { name: 'Digital Marketing', budget: 6200000, actual: 6800000, yoyBudget: 5600000, yoyActual: 6000000 },
      { name: 'Sales Team Expenses', budget: 4800000, actual: 4700000, yoyBudget: 4500000, yoyActual: 4400000 },
      { name: 'PR & Communications', budget: 2200000, actual: 2400000, yoyBudget: 2100000, yoyActual: 2200000 },
      { name: 'Loyalty & Partnerships', budget: 1000000, actual: 1000000, yoyBudget: 1000000, yoyActual: 1200000 },
    ],
  },
  {
    id: 'sales',
    name: 'Sales & Distribution',
    icon: <Handshake className="h-4 w-4" />,
    budget: 9600000,
    actual: 9200000,
    yoyBudget: 9000000,
    yoyActual: 9400000,
    costCenters: [
      { name: 'OTA Commissions', budget: 4200000, actual: 4000000, yoyBudget: 3900000, yoyActual: 4100000 },
      { name: 'Travel Agent Commissions', budget: 2600000, actual: 2500000, yoyBudget: 2400000, yoyActual: 2500000 },
      { name: 'Corporate Sales Team', budget: 1800000, actual: 1700000, yoyBudget: 1700000, yoyActual: 1800000 },
      { name: 'GDS & Distribution Costs', budget: 1000000, actual: 1000000, yoyBudget: 1000000, yoyActual: 1000000 },
    ],
  },
];

const monthlyDepartmentData: Record<string, MonthlyData[]> = {
  rooms: [
    { month: 'Jan', budget: 8166667, actual: 7900000, variance: 266667 },
    { month: 'Feb', budget: 8166667, actual: 7850000, variance: 316667 },
    { month: 'Mar', budget: 8166667, actual: 8000000, variance: 166667 },
    { month: 'Apr', budget: 8166667, actual: 8100000, variance: 66667 },
    { month: 'May', budget: 8166667, actual: 8050000, variance: 116667 },
    { month: 'Jun', budget: 8166667, actual: 8200000, variance: -33333 },
    { month: 'Jul', budget: 8166667, actual: 8300000, variance: -133333 },
    { month: 'Aug', budget: 8166667, actual: 8150000, variance: 16667 },
    { month: 'Sep', budget: 8166667, actual: 7900000, variance: 266667 },
    { month: 'Oct', budget: 8166667, actual: 7850000, variance: 316667 },
    { month: 'Nov', budget: 8166667, actual: 7700000, variance: 466667 },
    { month: 'Dec', budget: 8166667, actual: 8100000, variance: 66667 },
  ],
  fb: [
    { month: 'Jan', budget: 4333333, actual: 4200000, variance: 133333 },
    { month: 'Feb', budget: 4333333, actual: 4500000, variance: -166667 },
    { month: 'Mar', budget: 4333333, actual: 4400000, variance: -66667 },
    { month: 'Apr', budget: 4333333, actual: 4700000, variance: -366667 },
    { month: 'May', budget: 4333333, actual: 4600000, variance: -266667 },
    { month: 'Jun', budget: 4333333, actual: 4800000, variance: -466667 },
    { month: 'Jul', budget: 4333333, actual: 5100000, variance: -766667 },
    { month: 'Aug', budget: 4333333, actual: 4700000, variance: -366667 },
    { month: 'Sep', budget: 4333333, actual: 4500000, variance: -166667 },
    { month: 'Oct', budget: 4333333, actual: 4300000, variance: 33333 },
    { month: 'Nov', budget: 4333333, actual: 4400000, variance: -66667 },
    { month: 'Dec', budget: 4333333, actual: 4700000, variance: -366667 },
  ],
  housekeeping: [
    { month: 'Jan', budget: 2700000, actual: 2650000, variance: 50000 },
    { month: 'Feb', budget: 2700000, actual: 2600000, variance: 100000 },
    { month: 'Mar', budget: 2700000, actual: 2700000, variance: 0 },
    { month: 'Apr', budget: 2700000, actual: 2750000, variance: -50000 },
    { month: 'May', budget: 2700000, actual: 2780000, variance: -80000 },
    { month: 'Jun', budget: 2700000, actual: 2800000, variance: -100000 },
    { month: 'Jul', budget: 2700000, actual: 2850000, variance: -150000 },
    { month: 'Aug', budget: 2700000, actual: 2750000, variance: -50000 },
    { month: 'Sep', budget: 2700000, actual: 2650000, variance: 50000 },
    { month: 'Oct', budget: 2700000, actual: 2600000, variance: 100000 },
    { month: 'Nov', budget: 2700000, actual: 2580000, variance: 120000 },
    { month: 'Dec', budget: 2700000, actual: 2640000, variance: 60000 },
  ],
  maintenance: [
    { month: 'Jan', budget: 1400000, actual: 1350000, variance: 50000 },
    { month: 'Feb', budget: 1400000, actual: 1280000, variance: 120000 },
    { month: 'Mar', budget: 1400000, actual: 1380000, variance: 20000 },
    { month: 'Apr', budget: 1400000, actual: 1420000, variance: -20000 },
    { month: 'May', budget: 1400000, actual: 1450000, variance: -50000 },
    { month: 'Jun', budget: 1400000, actual: 1480000, variance: -80000 },
    { month: 'Jul', budget: 1400000, actual: 1400000, variance: 0 },
    { month: 'Aug', budget: 1400000, actual: 1300000, variance: 100000 },
    { month: 'Sep', budget: 1400000, actual: 1250000, variance: 150000 },
    { month: 'Oct', budget: 1400000, actual: 1280000, variance: 120000 },
    { month: 'Nov', budget: 1400000, actual: 1220000, variance: 180000 },
    { month: 'Dec', budget: 1400000, actual: 1290000, variance: 110000 },
  ],
  admin: [
    { month: 'Jan', budget: 1533333, actual: 1600000, variance: -66667 },
    { month: 'Feb', budget: 1533333, actual: 1580000, variance: -46667 },
    { month: 'Mar', budget: 1533333, actual: 1620000, variance: -86667 },
    { month: 'Apr', budget: 1533333, actual: 1650000, variance: -116667 },
    { month: 'May', budget: 1533333, actual: 1680000, variance: -146667 },
    { month: 'Jun', budget: 1533333, actual: 1640000, variance: -106667 },
    { month: 'Jul', budget: 1533333, actual: 1600000, variance: -66667 },
    { month: 'Aug', budget: 1533333, actual: 1620000, variance: -86667 },
    { month: 'Sep', budget: 1533333, actual: 1580000, variance: -46667 },
    { month: 'Oct', budget: 1533333, actual: 1600000, variance: -66667 },
    { month: 'Nov', budget: 1533333, actual: 1560000, variance: -26667 },
    { month: 'Dec', budget: 1533333, actual: 1570000, variance: -36667 },
  ],
  marketing: [
    { month: 'Jan', budget: 1183333, actual: 1200000, variance: -16667 },
    { month: 'Feb', budget: 1183333, actual: 1150000, variance: 33333 },
    { month: 'Mar', budget: 1183333, actual: 1280000, variance: -96667 },
    { month: 'Apr', budget: 1183333, actual: 1350000, variance: -166667 },
    { month: 'May', budget: 1183333, actual: 1300000, variance: -116667 },
    { month: 'Jun', budget: 1183333, actual: 1250000, variance: -66667 },
    { month: 'Jul', budget: 1183333, actual: 1400000, variance: -216667 },
    { month: 'Aug', budget: 1183333, actual: 1280000, variance: -96667 },
    { month: 'Sep', budget: 1183333, actual: 1200000, variance: -16667 },
    { month: 'Oct', budget: 1183333, actual: 1220000, variance: -36667 },
    { month: 'Nov', budget: 1183333, actual: 1240000, variance: -56667 },
    { month: 'Dec', budget: 1183333, actual: 1330000, variance: -146667 },
  ],
  sales: [
    { month: 'Jan', budget: 800000, actual: 780000, variance: 20000 },
    { month: 'Feb', budget: 800000, actual: 760000, variance: 40000 },
    { month: 'Mar', budget: 800000, actual: 820000, variance: -20000 },
    { month: 'Apr', budget: 800000, actual: 850000, variance: -50000 },
    { month: 'May', budget: 800000, actual: 830000, variance: -30000 },
    { month: 'Jun', budget: 800000, actual: 860000, variance: -60000 },
    { month: 'Jul', budget: 800000, actual: 880000, variance: -80000 },
    { month: 'Aug', budget: 800000, actual: 820000, variance: -20000 },
    { month: 'Sep', budget: 800000, actual: 780000, variance: 20000 },
    { month: 'Oct', budget: 800000, actual: 760000, variance: 40000 },
    { month: 'Nov', budget: 800000, actual: 740000, variance: 60000 },
    { month: 'Dec', budget: 800000, actual: 820000, variance: -20000 },
  ],
};

const quarterlyData = [
  { quarter: 'Q1', budget: 61500000, actual: 59200000 },
  { quarter: 'Q2', budget: 61500000, actual: 61100000 },
  { quarter: 'Q3', budget: 61500000, actual: 62400000 },
  { quarter: 'Q4', budget: 61500000, actual: 60700000 },
];

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

  // Computed totals
  const totalBudget = departments.reduce((s, d) => s + d.budget, 0);
  const totalActual = departments.reduce((s, d) => s + d.actual, 0);
  const totalVariance = totalBudget - totalActual;
  const totalVariancePct = ((totalVariance / totalBudget) * 100);
  const totalUtilization = (totalActual / totalBudget) * 100;

  const favorableCount = departments.filter((d) => d.variance >= 0).length;
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
    </div>
  );
}
