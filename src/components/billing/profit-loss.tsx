'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Search,
  Loader2,
  RefreshCw,
  Download,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  CalendarDays,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// --- Types ---
interface Property {
  id: string;
  name: string;
}

interface RevenueCategory {
  category: string;
  label: string;
  amount: number;
}

interface PnLData {
  revenue: { total: number; byCategory: RevenueCategory[]; accounts: { code: string; name: string; category: string; total: number }[] };
  expenses: { total: number; byCategory: RevenueCategory[]; accounts: { code: string; name: string; category: string; total: number }[] };
  netProfit: number;
  profitMargin: number;
  period: { dateFrom?: string; dateTo?: string };
}

const CATEGORY_COLORS: Record<string, string> = {
  room: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  f_b: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  spa: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  events: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  parking: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export default function ProfitLossStatement() {
  const { toast } = useToast();

  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(0);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const [pnlData, setPnlData] = useState<PnLData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch properties
  useEffect(() => {
    const fetchProps = async () => {
      try {
        const res = await fetch('/api/properties');
        const result = await res.json();
        if (result.success) setProperties(result.data);
      } catch { /* ignore */ }
    };
    fetchProps();
  }, []);

  // Fetch P&L
  const fetchPnL = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPropertyId !== 'all') params.set('propertyId', selectedPropertyId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/financials/profit-loss?${params}`);
      const result = await res.json();
      if (result.success) setPnlData(result.data);
      else toast({ title: 'Error', description: result.error || 'Failed to fetch P&L', variant: 'destructive' });
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch P&L data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedPropertyId, dateFrom, dateTo, toast]);

  // Initial load
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedPropertyId !== 'all') params.set('propertyId', selectedPropertyId);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
        const res = await fetch(`/api/financials/profit-loss?${params}`);
        const result = await res.json();
        if (result.success) setPnlData(result.data);
        else toast({ title: 'Error', description: result.error || 'Failed to fetch P&L', variant: 'destructive' });
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch P&L data', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedPropertyId, dateFrom, dateTo, toast]);

  // Export
  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedPropertyId !== 'all') params.set('propertyId', selectedPropertyId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('format', 'csv');

      const res = await fetch(`/api/financials/profit-loss/export?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pnl-${dateFrom}-to-${dateTo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Exported', description: 'P&L statement exported as CSV' });
      }
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' });
    }
  };

  const formatCurrency = (amount: number) => `$${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  const allCategories = [
    ...(pnlData?.revenue.byCategory || []),
    ...(pnlData?.expenses.byCategory || []),
  ];
  const maxCategoryAmount = Math.max(...allCategories.map(c => c.amount), 1);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            P&L Statement
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Revenue vs Expense breakdown by category</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:w-48 h-10"><SelectValue placeholder="All Properties" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-10 w-36" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-10 w-36" />
          <Button variant="outline" size="sm" onClick={fetchPnL} className="min-w-[44px]">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : pnlData ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0"><ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
                <div className="min-w-0">
                  <div className="text-base sm:text-xl font-bold truncate">{formatCurrency(pnlData.revenue.total)}</div>
                  <div className="text-xs text-muted-foreground">Total Revenue</div>
                </div>
              </div>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-lg bg-red-500/10 shrink-0"><ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" /></div>
                <div className="min-w-0">
                  <div className="text-base sm:text-xl font-bold truncate">{formatCurrency(pnlData.expenses.total)}</div>
                  <div className="text-xs text-muted-foreground">Total Expenses</div>
                </div>
              </div>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${pnlData.netProfit >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  <DollarSign className={`h-4 w-4 ${pnlData.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
                </div>
                <div className="min-w-0">
                  <div className={`text-base sm:text-xl font-bold truncate ${pnlData.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(pnlData.netProfit)}
                  </div>
                  <div className="text-xs text-muted-foreground">Net Profit</div>
                </div>
              </div>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10 shrink-0"><TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" /></div>
                <div className="min-w-0">
                  <div className="text-base sm:text-xl font-bold truncate">{pnlData.profitMargin.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Profit Margin</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Category Breakdown Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Revenue by Category</CardTitle></CardHeader>
              <CardContent>
                {pnlData.revenue.byCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No revenue data</p>
                ) : (
                  <div className="space-y-3">
                    {pnlData.revenue.byCategory.map(cat => (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{cat.label}</span>
                          <span className="font-medium">{formatCurrency(cat.amount)}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.other}`}
                            style={{ width: `${(cat.amount / maxCategoryAmount) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Expenses by Category</CardTitle></CardHeader>
              <CardContent>
                {pnlData.expenses.byCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No expense data</p>
                ) : (
                  <div className="space-y-3">
                    {pnlData.expenses.byCategory.map(cat => (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{cat.label}</span>
                          <span className="font-medium">{formatCurrency(cat.amount)}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.other}`}
                            style={{ width: `${(cat.amount / maxCategoryAmount) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Account Tables */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Account-Level Detail</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pnlData.revenue.accounts.map((acc, i) => (
                      <TableRow key={`rev-${i}`} className="bg-emerald-50/30 dark:bg-emerald-950/10">
                        <TableCell><Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200">Revenue</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{acc.code}</TableCell>
                        <TableCell className="text-sm font-medium">{acc.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{acc.category}</Badge></TableCell>
                        <TableCell className="text-right text-sm font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(acc.total)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{pnlData.revenue.total > 0 ? ((acc.total / pnlData.revenue.total) * 100).toFixed(1) : '0.0'}%</TableCell>
                      </TableRow>
                    ))}
                    {pnlData.expenses.accounts.map((acc, i) => (
                      <TableRow key={`exp-${i}`} className="bg-red-50/30 dark:bg-red-950/10">
                        <TableCell><Badge variant="outline" className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200">Expense</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{acc.code}</TableCell>
                        <TableCell className="text-sm font-medium">{acc.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{acc.category}</Badge></TableCell>
                        <TableCell className="text-right text-sm font-medium text-red-600 dark:text-red-400">{formatCurrency(acc.total)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{pnlData.expenses.total > 0 ? ((acc.total / pnlData.expenses.total) * 100).toFixed(1) : '0.0'}%</TableCell>
                      </TableRow>
                    ))}
                    {pnlData.revenue.accounts.length === 0 && pnlData.expenses.accounts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                          <p className="font-medium">No journal entries found for this period</p>
                          <p className="text-xs mt-1">Post journal entries to see P&L data</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
