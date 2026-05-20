'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Target,
  Loader2,
  Plus,
  RefreshCw,
  DollarSign,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Trash2,
  CheckCircle2,
  Edit2,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// --- Types ---
interface Property { id: string; name: string; }

interface FinancialAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
  category: string;
}

interface BudgetLine {
  id: string;
  budgetId: string;
  accountId: string;
  period: number;
  budgetedAmt: number;
  actualAmt: number;
  variance: number;
  pctUsed: number;
  financialAccount: FinancialAccount;
}

interface Budget {
  id: string;
  propertyId: string | null;
  name: string;
  fiscalYear: number;
  periodType: string;
  status: string;
  totalBudget: number;
  totalActual: number;
  variance: number;
  notes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  lines: BudgetLine[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  closed: { label: 'Closed', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
};

export default function BudgetManagementPage() {
  const { toast } = useToast();

  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aggregates, setAggregates] = useState({ totalBudget: 0, totalActual: 0, totalVariance: 0 });

  // Detail view
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [activeTab, setActiveTab] = useState('list');

  // Dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ name: '', periodType: 'monthly', notes: '' });

  // Accounts for dialog
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);

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

  // Fetch accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch('/api/revenue-accounts');
        const result = await res.json();
        if (result.success) setAccounts(result.data || []);
      } catch { /* ignore */ }
    };
    fetchAccounts();
  }, []);

  // Fetch budgets
  const fetchBudgets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ fiscalYear: String(fiscalYear) });
      if (selectedPropertyId !== 'all') params.set('propertyId', selectedPropertyId);

      const res = await fetch(`/api/financials/budgets?${params}`);
      const result = await res.json();
      if (result.success) {
        setBudgets(result.data || []);
        setAggregates(result.aggregates || { totalBudget: 0, totalActual: 0, totalVariance: 0 });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch budgets', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedPropertyId, fiscalYear, toast]);

  // Initial load
  useEffect(() => {
    if (!fiscalYear) return;
    (async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ fiscalYear: String(fiscalYear) });
        if (selectedPropertyId !== 'all') params.set('propertyId', selectedPropertyId);
        const res = await fetch(`/api/financials/budgets?${params}`);
        const result = await res.json();
        if (result.success) {
          setBudgets(result.data || []);
          setAggregates(result.aggregates || { totalBudget: 0, totalActual: 0, totalVariance: 0 });
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch budgets', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedPropertyId, fiscalYear, toast]);

  // Fetch single budget
  const fetchBudgetDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/financials/budgets/${id}`);
      const result = await res.json();
      if (result.success) {
        setSelectedBudget(result.data);
        setActiveTab('detail');
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch budget details', variant: 'destructive' });
    }
  };

  // Create budget
  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Validation', description: 'Budget name is required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/financials/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedPropertyId !== 'all' ? selectedPropertyId : undefined,
          name: form.name,
          fiscalYear,
          periodType: form.periodType,
          status: 'draft',
          notes: form.notes || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Budget created' });
        setIsDialogOpen(false);
        setForm({ name: '', periodType: 'monthly', notes: '' });
        fetchBudgets();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to create budget', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create budget', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Approve budget
  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/financials/budgets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Approved', description: 'Budget approved successfully' });
        fetchBudgets();
        if (selectedBudget?.id === id) fetchBudgetDetail(id);
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to approve budget', variant: 'destructive' });
    }
  };

  // Delete budget
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/financials/budgets/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Deleted', description: 'Budget deleted' });
        fetchBudgets();
        if (selectedBudget?.id === id) { setSelectedBudget(null); setActiveTab('list'); }
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const formatCurrency = (amount: number) => `$${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Budget Management
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Plan, track, and analyze departmental budgets</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:w-48 h-10"><SelectValue placeholder="All Properties" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(fiscalYear)} onValueChange={v => setFiscalYear(parseInt(v))}>
            <SelectTrigger className="w-28 h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>FY {y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchBudgets}><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /></Button>
          <Button onClick={() => { setForm({ name: '', periodType: 'monthly', notes: '' }); setIsDialogOpen(true); }} className="bg-gradient-to-r from-teal-600 to-teal-500 hover:shadow-lg hover:shadow-teal-500/20 transition-all">
            <Plus className="h-4 w-4 mr-1.5" />New Budget
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 shrink-0"><DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
            <div className="min-w-0">
              <div className="text-base sm:text-xl font-bold truncate">{formatCurrency(aggregates.totalBudget)}</div>
              <div className="text-xs text-muted-foreground">Total Budget</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 shrink-0"><TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" /></div>
            <div className="min-w-0">
              <div className="text-base sm:text-xl font-bold truncate">{formatCurrency(aggregates.totalActual)}</div>
              <div className="text-xs text-muted-foreground">Total Actual</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${aggregates.totalVariance >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              {aggregates.totalVariance >= 0 ? <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />}
            </div>
            <div className="min-w-0">
              <div className={`text-base sm:text-xl font-bold truncate ${aggregates.totalVariance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(Math.abs(aggregates.totalVariance))}
              </div>
              <div className="text-xs text-muted-foreground">{aggregates.totalVariance >= 0 ? 'Under Budget' : 'Over Budget'}</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list" className="gap-1.5"><Target className="h-4 w-4" /> Budget List</TabsTrigger>
          {selectedBudget && <TabsTrigger value="detail" className="gap-1.5"><Eye className="h-4 w-4" /> Budget Detail</TabsTrigger>}
        </TabsList>

        {/* List */}
        <TabsContent value="list" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : budgets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Target className="h-12 w-12 mb-3 opacity-30" />
                  <p className="font-medium">No budgets found for FY {fiscalYear}</p>
                  <Button className="mt-4" onClick={() => setIsDialogOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Create Budget</Button>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>FY</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budgets.map(budget => {
                        const variancePct = budget.totalBudget > 0 ? ((budget.totalActual / budget.totalBudget) * 100) : 0;
                        return (
                          <TableRow key={budget.id}>
                            <TableCell className="font-medium text-sm">{budget.name}</TableCell>
                            <TableCell className="text-sm">{budget.fiscalYear}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs capitalize">{budget.periodType}</Badge></TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(budget.totalBudget)}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(budget.totalActual)}</TableCell>
                            <TableCell className={cn('text-right text-sm font-medium', budget.variance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                              {budget.variance >= 0 ? '+' : ''}{formatCurrency(budget.variance)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('text-xs', STATUS_CONFIG[budget.status]?.color)}>
                                {STATUS_CONFIG[budget.status]?.label || budget.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onClick={() => fetchBudgetDetail(budget.id)}><Eye className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
                                  {budget.status === 'draft' && (
                                    <DropdownMenuItem onClick={() => handleApprove(budget.id)}><CheckCircle2 className="h-4 w-4 mr-2" />Approve</DropdownMenuItem>
                                  )}
                                  {(budget.status === 'draft') && (
                                    <DropdownMenuItem onClick={() => handleDelete(budget.id)} className="text-red-600 dark:text-red-400"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Detail */}
        {selectedBudget && (
          <TabsContent value="detail" className="mt-4 space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedBudget.name}</h3>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
                      <span>FY {selectedBudget.fiscalYear}</span>
                      <span className="capitalize">{selectedBudget.periodType}</span>
                      <Badge variant="outline" className={cn('text-xs', STATUS_CONFIG[selectedBudget.status]?.color)}>{STATUS_CONFIG[selectedBudget.status]?.label}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-3 text-right">
                    <div>
                      <div className="text-xs text-muted-foreground">Budget</div>
                      <div className="font-bold">{formatCurrency(selectedBudget.totalBudget)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Actual</div>
                      <div className="font-bold">{formatCurrency(selectedBudget.totalActual)}</div>
                    </div>
                  </div>
                </div>
                <Progress value={selectedBudget.totalBudget > 0 ? Math.min((selectedBudget.totalActual / selectedBudget.totalBudget) * 100, 100) : 0} className="h-2 mt-4" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{formatCurrency(selectedBudget.totalActual)} spent</span>
                  <span>{selectedBudget.totalBudget > 0 ? ((selectedBudget.totalActual / selectedBudget.totalBudget) * 100).toFixed(1) : '0.0'}% of budget</span>
                </div>
              </CardContent>
            </Card>

            {/* Budget Lines */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Budget Lines</CardTitle></CardHeader>
              <CardContent className="p-0">
                {selectedBudget.lines.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No budget lines defined. Add lines through the API.</p>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Budgeted</TableHead>
                          <TableHead className="text-right">Actual</TableHead>
                          <TableHead className="text-right">Variance</TableHead>
                          <TableHead className="text-right">% Used</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedBudget.lines.map(line => (
                          <TableRow key={line.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">{line.financialAccount.code}</span>
                                <span className="text-sm font-medium">{line.financialAccount.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{line.period}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(line.budgetedAmt)}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(line.actualAmt)}</TableCell>
                            <TableCell className={cn('text-right text-sm font-medium', line.variance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                              {line.variance >= 0 ? '+' : ''}{formatCurrency(line.variance)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className={cn('text-xs', line.pctUsed > 100 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : line.pctUsed > 80 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400')}>
                                {line.pctUsed.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Budget</DialogTitle>
            <DialogDescription>Define a new budget for FY {fiscalYear}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5"><Label>Budget Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Operations Budget" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Period Type</Label>
                <Select value={form.periodType} onValueChange={v => setForm(f => ({ ...f, periodType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Fiscal Year</Label><Input disabled value={String(fiscalYear)} /></div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}Create Budget</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
