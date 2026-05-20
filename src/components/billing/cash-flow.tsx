'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
  Wallet,
  Loader2,
  RefreshCw,
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Edit2,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// --- Types ---
interface Property { id: string; name: string; }

interface CashFlowEntry {
  id: string;
  propertyId: string | null;
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
  notes: string | null;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FORECAST_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  actual: { label: 'Actual', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  projected: { label: 'Projected', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  adjusted: { label: 'Adjusted', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

export default function CashFlowForecastPage() {
  const { toast } = useToast();

  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [year, setYear] = useState(new Date().getFullYear());

  const [forecasts, setForecasts] = useState<CashFlowEntry[]>([]);
  const [aggregates, setAggregates] = useState({ totalInflow: 0, totalOutflow: 0, netCashFlow: 0 });
  const [isLoading, setIsLoading] = useState(false);

  // Dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editEntry, setEditEntry] = useState<CashFlowEntry | null>(null);
  const [form, setForm] = useState({
    month: '1', openingBalance: '0', totalInflow: '0', totalOutflow: '0',
    roomRevenue: '0', fbRevenue: '0', otherRevenue: '0',
    payrollExpense: '0', opexExpense: '0', capexExpense: '0',
    forecastType: 'projected', notes: '',
  });

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

  // Fetch forecasts
  const fetchForecasts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (selectedPropertyId !== 'all') params.set('propertyId', selectedPropertyId);

      const res = await fetch(`/api/financials/cash-flow?${params}`);
      const result = await res.json();
      if (result.success) {
        setForecasts(result.data || []);
        setAggregates(result.aggregates || { totalInflow: 0, totalOutflow: 0, netCashFlow: 0 });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch cash flow data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedPropertyId, year, toast]);

  // Initial load
  useEffect(() => {
    if (!selectedPropertyId || !year) return;
    (async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ year: String(year) });
        if (selectedPropertyId !== 'all') params.set('propertyId', selectedPropertyId);
        const res = await fetch(`/api/financials/cash-flow?${params}`);
        const result = await res.json();
        if (result.success) {
          setForecasts(result.data || []);
          setAggregates(result.aggregates || { totalInflow: 0, totalOutflow: 0, netCashFlow: 0 });
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch cash flow data', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedPropertyId, year, toast]);

  const openCreateDialog = () => {
    setEditEntry(null);
    setForm({ month: '1', openingBalance: '0', totalInflow: '0', totalOutflow: '0', roomRevenue: '0', fbRevenue: '0', otherRevenue: '0', payrollExpense: '0', opexExpense: '0', capexExpense: '0', forecastType: 'projected', notes: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (entry: CashFlowEntry) => {
    setEditEntry(entry);
    const month = new Date(entry.period).getMonth() + 1;
    setForm({
      month: String(month),
      openingBalance: String(entry.openingBalance || 0),
      totalInflow: String(entry.totalInflow || 0),
      totalOutflow: String(entry.totalOutflow || 0),
      roomRevenue: String(entry.roomRevenue || 0),
      fbRevenue: String(entry.fbRevenue || 0),
      otherRevenue: String(entry.otherRevenue || 0),
      payrollExpense: String(entry.payrollExpense || 0),
      opexExpense: String(entry.opexExpense || 0),
      capexExpense: String(entry.capexExpense || 0),
      forecastType: entry.forecastType,
      notes: entry.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const period = `${year}-${form.month.padStart(2, '0')}-01`;
      const totalInflow = parseFloat(form.totalInflow) || 0;
      const totalOutflow = parseFloat(form.totalOutflow) || 0;

      const res = await fetch('/api/financials/cash-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedPropertyId !== 'all' ? selectedPropertyId : undefined,
          period,
          openingBalance: parseFloat(form.openingBalance) || 0,
          totalInflow,
          totalOutflow,
          roomRevenue: parseFloat(form.roomRevenue) || 0,
          fbRevenue: parseFloat(form.fbRevenue) || 0,
          otherRevenue: parseFloat(form.otherRevenue) || 0,
          payrollExpense: parseFloat(form.payrollExpense) || 0,
          opexExpense: parseFloat(form.opexExpense) || 0,
          capexExpense: parseFloat(form.capexExpense) || 0,
          forecastType: form.forecastType,
          notes: form.notes || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Cash flow forecast saved' });
        setIsDialogOpen(false);
        fetchForecasts();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to save', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save forecast', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount: number) => `$${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getMonthEntry = (month: number) => {
    return forecasts.find(f => {
      const d = new Date(f.period);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Cash Flow Forecast
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Monthly cash flow projections and tracking</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:w-48 h-10"><SelectValue placeholder="All Properties" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
            <SelectTrigger className="w-28 h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchForecasts}><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /></Button>
          <Button onClick={openCreateDialog} className="bg-gradient-to-r from-amber-600 to-amber-500 hover:shadow-lg hover:shadow-amber-500/20 transition-all">
            <Plus className="h-4 w-4 mr-1.5" />Add Month
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0"><ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
            <div className="min-w-0">
              <div className="text-base sm:text-xl font-bold truncate">{formatCurrency(aggregates.totalInflow)}</div>
              <div className="text-xs text-muted-foreground">Total Inflow</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 shrink-0"><ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" /></div>
            <div className="min-w-0">
              <div className="text-base sm:text-xl font-bold truncate">{formatCurrency(aggregates.totalOutflow)}</div>
              <div className="text-xs text-muted-foreground">Total Outflow</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${aggregates.netCashFlow >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              <DollarSign className={`h-4 w-4 ${aggregates.netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
            </div>
            <div className="min-w-0">
              <div className={`text-base sm:text-xl font-bold truncate ${aggregates.netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(aggregates.netCashFlow)}
              </div>
              <div className="text-xs text-muted-foreground">Net Cash Flow</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Monthly Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Inflow</TableHead>
                    <TableHead className="text-right">Outflow</TableHead>
                    <TableHead className="text-right">Net Flow</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Room Rev.</TableHead>
                    <TableHead className="hidden md:table-cell text-right">F&B Rev.</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Payroll</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                    const entry = getMonthEntry(month);
                    return (
                      <TableRow key={month}>
                        <TableCell className="font-medium text-sm">{MONTH_NAMES[month - 1]} {year}</TableCell>
                        {entry ? (
                          <>
                            <TableCell className="text-right text-sm">{formatCurrency(entry.openingBalance)}</TableCell>
                            <TableCell className="text-right text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(entry.totalInflow)}</TableCell>
                            <TableCell className="text-right text-sm text-red-600 dark:text-red-400">{formatCurrency(entry.totalOutflow)}</TableCell>
                            <TableCell className={cn('text-right text-sm font-medium', entry.netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                              {entry.netCashFlow >= 0 ? '+' : ''}{formatCurrency(entry.netCashFlow)}
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold">{formatCurrency(entry.closingBalance)}</TableCell>
                            <TableCell className="hidden md:table-cell text-right text-sm">{formatCurrency(entry.roomRevenue)}</TableCell>
                            <TableCell className="hidden md:table-cell text-right text-sm">{formatCurrency(entry.fbRevenue)}</TableCell>
                            <TableCell className="hidden lg:table-cell text-right text-sm">{formatCurrency(entry.payrollExpense)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('text-xs', FORECAST_TYPE_CONFIG[entry.forecastType]?.color)}>
                                {FORECAST_TYPE_CONFIG[entry.forecastType]?.label || entry.forecastType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(entry)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell colSpan={9} className="text-center text-muted-foreground text-sm py-3">No data</TableCell>
                            <TableCell />
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={openCreateDialog}>
                                <Plus className="h-3 w-3 mr-1" />Add
                              </Button>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEntry ? 'Edit' : 'Add'} Cash Flow Forecast</DialogTitle>
            <DialogDescription>{MONTH_NAMES[(parseInt(form.month) || 1) - 1]} {year}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Select value={form.month} onValueChange={v => setForm(f => ({ ...f, month: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Forecast Type</Label>
                <Select value={form.forecastType} onValueChange={v => setForm(f => ({ ...f, forecastType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="projected">Projected</SelectItem>
                    <SelectItem value="actual">Actual</SelectItem>
                    <SelectItem value="adjusted">Adjusted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Opening Balance</Label>
              <Input type="number" step="0.01" value={form.openingBalance} onChange={e => setForm(f => ({ ...f, openingBalance: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Total Inflow</Label><Input type="number" step="0.01" value={form.totalInflow} onChange={e => setForm(f => ({ ...f, totalInflow: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Total Outflow</Label><Input type="number" step="0.01" value={form.totalOutflow} onChange={e => setForm(f => ({ ...f, totalOutflow: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label>Net Cash Flow</Label>
                <Input type="text" disabled value={formatCurrency((parseFloat(form.totalInflow) || 0) - (parseFloat(form.totalOutflow) || 0))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Room Revenue</Label><Input type="number" step="0.01" value={form.roomRevenue} onChange={e => setForm(f => ({ ...f, roomRevenue: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>F&B Revenue</Label><Input type="number" step="0.01" value={form.fbRevenue} onChange={e => setForm(f => ({ ...f, fbRevenue: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Other Revenue</Label><Input type="number" step="0.01" value={form.otherRevenue} onChange={e => setForm(f => ({ ...f, otherRevenue: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Payroll</Label><Input type="number" step="0.01" value={form.payrollExpense} onChange={e => setForm(f => ({ ...f, payrollExpense: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>OpEx</Label><Input type="number" step="0.01" value={form.opexExpense} onChange={e => setForm(f => ({ ...f, opexExpense: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>CapEx</Label><Input type="number" step="0.01" value={form.capexExpense} onChange={e => setForm(f => ({ ...f, capexExpense: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}{editEntry ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
