'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  CreditCard,
  Loader2,
  Plus,
  RefreshCw,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreHorizontal,
  Trash2,
  CalendarDays,
  Search,
  Percent,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// --- Types ---
interface Property { id: string; name: string; }

interface FinancingPlan {
  id: string;
  propertyId: string | null;
  name: string;
  provider: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  durationMonths: number;
  minInstallment: number | null;
  maxInstallments: number;
  isActive: boolean;
  terms: string | null;
  createdAt: string;
  _installments?: { count: number; totalAmount: number; paidAmount: number };
}

interface FinancingInstallment {
  id: string;
  financingPlanId: string;
  folioId: string | null;
  bookingId: string | null;
  guestId: string | null;
  totalAmount: number;
  installmentAmount: number;
  installmentNumber: number;
  dueDate: string;
  paidAmount: number;
  status: string;
  paidAt: string | null;
  paymentRef: string | null;
  financingPlan: { id: string; name: string; provider: string; interestRate: number };
}

const PROVIDER_LABELS: Record<string, string> = {
  internal: 'Internal',
  klarna: 'Klarna',
  affirm: 'Affirm',
  afterpay: 'Afterpay',
};

const INSTALLMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  default: { label: 'Default', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

export default function FinancingPage() {
  const { toast } = useToast();

  const [properties, setProperties] = useState<Property[]>([]);
  const [plans, setPlans] = useState<FinancingPlan[]>([]);
  const [installments, setInstallments] = useState<FinancingInstallment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInstallments, setIsLoadingInstallments] = useState(false);
  const [aggregates, setAggregates] = useState({ totalAmount: 0, totalPaid: 0, outstanding: 0 });
  const [selectedPlanId, setSelectedPlanId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isInstallmentDialogOpen, setIsInstallmentDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: '', provider: 'internal', minAmount: '0', maxAmount: '10000',
    interestRate: '0', durationMonths: '12', minInstallment: '', maxInstallments: '12',
    isActive: true, terms: '',
  });
  const [installmentForm, setInstallmentForm] = useState({
    financingPlanId: '', totalAmount: '', installmentAmount: '', installmentNumber: '1',
    dueDate: '', paymentRef: '',
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

  // Fetch plans
  const fetchPlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/billing/financing');
      const result = await res.json();
      if (result.success) setPlans(result.data || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch financing plans', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch installments
  const fetchInstallments = useCallback(async () => {
    setIsLoadingInstallments(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (selectedPlanId !== 'all') params.set('financingPlanId', selectedPlanId);
      const res = await fetch(`/api/billing/financing/installments?${params}`);
      const result = await res.json();
      if (result.success) {
        setInstallments(result.data || []);
        setAggregates(result.aggregates || { totalAmount: 0, totalPaid: 0, outstanding: 0 });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch installments', variant: 'destructive' });
    } finally {
      setIsLoadingInstallments(false);
    }
  }, [selectedPlanId, toast]);

  // Initial load
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/billing/financing');
        const result = await res.json();
        if (result.success) setPlans(result.data || []);
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch financing plans', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [toast]);

  useEffect(() => {
    (async () => {
      setIsLoadingInstallments(true);
      try {
        const params = new URLSearchParams({ limit: '100' });
        if (selectedPlanId !== 'all') params.set('financingPlanId', selectedPlanId);
        const res = await fetch(`/api/billing/financing/installments?${params}`);
        const result = await res.json();
        if (result.success) {
          setInstallments(result.data || []);
          setAggregates(result.aggregates || { totalAmount: 0, totalPaid: 0, outstanding: 0 });
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch installments', variant: 'destructive' });
      } finally {
        setIsLoadingInstallments(false);
      }
    })();
  }, [selectedPlanId, toast]);

  // Create plan
  const handleCreatePlan = async () => {
    if (!planForm.name.trim()) {
      toast({ title: 'Validation', description: 'Plan name is required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/billing/financing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: planForm.name,
          provider: planForm.provider,
          minAmount: parseFloat(planForm.minAmount) || 0,
          maxAmount: parseFloat(planForm.maxAmount) || 0,
          interestRate: parseFloat(planForm.interestRate) || 0,
          durationMonths: parseInt(planForm.durationMonths) || 12,
          minInstallment: planForm.minInstallment ? parseFloat(planForm.minInstallment) : undefined,
          maxInstallments: parseInt(planForm.maxInstallments) || 12,
          isActive: planForm.isActive,
          terms: planForm.terms || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Financing plan created' });
        setIsPlanDialogOpen(false);
        setPlanForm({ name: '', provider: 'internal', minAmount: '0', maxAmount: '10000', interestRate: '0', durationMonths: '12', minInstallment: '', maxInstallments: '12', isActive: true, terms: '' });
        fetchPlans();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create plan', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Create installment
  const handleCreateInstallment = async () => {
    if (!installmentForm.financingPlanId || !installmentForm.totalAmount || !installmentForm.dueDate) {
      toast({ title: 'Validation', description: 'Plan, amount, and due date are required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/billing/financing/installments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          financingPlanId: installmentForm.financingPlanId,
          totalAmount: parseFloat(installmentForm.totalAmount),
          installmentAmount: parseFloat(installmentForm.installmentAmount) || parseFloat(installmentForm.totalAmount),
          installmentNumber: parseInt(installmentForm.installmentNumber) || 1,
          dueDate: installmentForm.dueDate,
          paymentRef: installmentForm.paymentRef || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Installment created' });
        setIsInstallmentDialogOpen(false);
        fetchInstallments();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create installment', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount: number) => `$${(amount || 0).toFixed(2)}`;

  const filteredInstallments = installments.filter(inst => {
    if (!searchTerm) return true;
    return inst.financingPlan.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            BNPL / Financing
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage buy-now-pay-later plans and installment schedules</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchPlans(); fetchInstallments(); }}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setIsPlanDialogOpen(true)} className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 transition-all">
            <Plus className="h-4 w-4 mr-1.5" />New Plan
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 shrink-0"><DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
            <div className="min-w-0"><div className="text-base sm:text-xl font-bold truncate">{formatCurrency(aggregates.totalAmount)}</div><div className="text-xs text-muted-foreground">Total Financed</div></div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0"><CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
            <div className="min-w-0"><div className="text-base sm:text-xl font-bold truncate">{formatCurrency(aggregates.totalPaid)}</div><div className="text-xs text-muted-foreground">Total Paid</div></div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 shrink-0"><Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" /></div>
            <div className="min-w-0"><div className="text-base sm:text-xl font-bold truncate">{formatCurrency(aggregates.outstanding)}</div><div className="text-xs text-muted-foreground">Outstanding</div></div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="plans" className="gap-1.5"><Percent className="h-4 w-4" /> Financing Plans</TabsTrigger>
          <TabsTrigger value="installments" className="gap-1.5"><CalendarDays className="h-4 w-4" /> Installments</TabsTrigger>
        </TabsList>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : plans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <CreditCard className="h-12 w-12 mb-3 opacity-30" />
                <p className="font-medium">No financing plans configured</p>
                <Button className="mt-4" onClick={() => setIsPlanDialogOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Create Plan</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map(plan => (
                <Card key={plan.id} className="hover:shadow-lg transition-all duration-200">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{plan.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{PROVIDER_LABELS[plan.provider] || plan.provider}</Badge>
                          <Badge variant={plan.isActive ? 'default' : 'secondary'} className={cn('text-xs', plan.isActive && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300')}>
                            {plan.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{plan.interestRate}%</div>
                        <div className="text-xs text-muted-foreground">APR</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs">Amount Range</div>
                        <div className="font-medium">{formatCurrency(plan.minAmount)} – {formatCurrency(plan.maxAmount)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Duration</div>
                        <div className="font-medium">{plan.durationMonths} months</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Max Installments</div>
                        <div className="font-medium">{plan.maxInstallments}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Active Plans</div>
                        <div className="font-medium">{plan._installments?.count || 0}</div>
                      </div>
                    </div>
                    {plan._installments && plan._installments.count > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Financed: {formatCurrency(plan._installments.totalAmount)}</span>
                          <span>Paid: {formatCurrency(plan._installments.paidAmount)}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Installments Tab */}
        <TabsContent value="installments" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by plan name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-10" />
            </div>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger className="w-full sm:w-48 h-10"><SelectValue placeholder="All Plans" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => { setInstallmentForm({ financingPlanId: plans[0]?.id || '', totalAmount: '', installmentAmount: '', installmentNumber: '1', dueDate: '', paymentRef: '' }); setIsInstallmentDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1.5" />Add Installment
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingInstallments ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : filteredInstallments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mb-3 opacity-30" />
                  <p className="font-medium">No installments found</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plan</TableHead>
                        <TableHead>Installment #</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInstallments.map(inst => {
                        const statusCfg = INSTALLMENT_STATUS[inst.status] || INSTALLMENT_STATUS.pending;
                        const remaining = inst.totalAmount - inst.paidAmount;
                        return (
                          <TableRow key={inst.id}>
                            <TableCell className="text-sm font-medium">{inst.financingPlan.name}</TableCell>
                            <TableCell className="text-sm">#{inst.installmentNumber}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(inst.totalAmount)}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{formatCurrency(inst.installmentAmount)}</TableCell>
                            <TableCell className={cn('text-right text-sm', inst.paidAmount >= inst.installmentAmount ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>{formatCurrency(inst.paidAmount)}</TableCell>
                            <TableCell className="text-sm">{new Date(inst.dueDate).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('text-xs', statusCfg.color)}>{statusCfg.label}</Badge>
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
      </Tabs>

      {/* Create Plan Dialog */}
      <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Financing Plan</DialogTitle><DialogDescription>Configure a new BNPL/financing plan</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5"><Label>Plan Name *</Label><Input value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 6-Month Easy Pay" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Provider</Label>
                <Select value={planForm.provider} onValueChange={v => setPlanForm(f => ({ ...f, provider: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="klarna">Klarna</SelectItem>
                    <SelectItem value="affirm">Affirm</SelectItem>
                    <SelectItem value="afterpay">Afterpay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Interest Rate (%)</Label><Input type="number" step="0.1" value={planForm.interestRate} onChange={e => setPlanForm(f => ({ ...f, interestRate: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Min Amount</Label><Input type="number" step="0.01" value={planForm.minAmount} onChange={e => setPlanForm(f => ({ ...f, minAmount: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Max Amount</Label><Input type="number" step="0.01" value={planForm.maxAmount} onChange={e => setPlanForm(f => ({ ...f, maxAmount: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Duration (months)</Label><Input type="number" value={planForm.durationMonths} onChange={e => setPlanForm(f => ({ ...f, durationMonths: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Max Installments</Label><Input type="number" value={planForm.maxInstallments} onChange={e => setPlanForm(f => ({ ...f, maxInstallments: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Min Installment ($)</Label><Input type="number" step="0.01" value={planForm.minInstallment} onChange={e => setPlanForm(f => ({ ...f, minInstallment: e.target.value }))} placeholder="Optional" /></div>
            <div className="space-y-1.5"><Label>Terms & Conditions</Label><Input value={planForm.terms} onChange={e => setPlanForm(f => ({ ...f, terms: e.target.value }))} placeholder="Brief terms..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPlanDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePlan} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}Create Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Installment Dialog */}
      <Dialog open={isInstallmentDialogOpen} onOpenChange={setIsInstallmentDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle>Add Installment</DialogTitle><DialogDescription>Create a new installment schedule entry</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Financing Plan *</Label>
              <Select value={installmentForm.financingPlanId} onValueChange={v => setInstallmentForm(f => ({ ...f, financingPlanId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Total Amount *</Label><Input type="number" step="0.01" value={installmentForm.totalAmount} onChange={e => setInstallmentForm(f => ({ ...f, totalAmount: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Installment Amount</Label><Input type="number" step="0.01" value={installmentForm.installmentAmount} onChange={e => setInstallmentForm(f => ({ ...f, installmentAmount: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Installment #</Label><Input type="number" value={installmentForm.installmentNumber} onChange={e => setInstallmentForm(f => ({ ...f, installmentNumber: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Due Date *</Label><Input type="date" value={installmentForm.dueDate} onChange={e => setInstallmentForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Payment Reference</Label><Input value={installmentForm.paymentRef} onChange={e => setInstallmentForm(f => ({ ...f, paymentRef: e.target.value }))} placeholder="Optional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInstallmentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateInstallment} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
