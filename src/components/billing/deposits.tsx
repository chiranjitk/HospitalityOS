'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Wallet,
  Loader2,
  Plus,
  RefreshCw,
  DollarSign,
  MoreHorizontal,
  Trash2,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// --- Types ---
interface Property { id: string; name: string; }

interface DepositSchedule {
  id: string;
  bookingId: string | null;
  name: string;
  milestoneType: string;
  milestoneDays: number | null;
  milestoneDate: string | null;
  percentOfTotal: number;
  fixedAmount: number | null;
  dueAmount: number;
  paidAmount: number;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  booking?: {
    id: string;
    confirmationCode: string;
    totalAmount: number;
    primaryGuest?: { id: string; firstName: string; lastName: string } | null;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: Clock },
  partially_paid: { label: 'Partially Paid', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertTriangle },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  waived: { label: 'Waived', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', icon: AlertCircle },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
};

const MILESTONE_LABELS: Record<string, string> = {
  at_booking: 'At Booking',
  pre_arrival: 'Pre-Arrival',
  at_checkin: 'At Check-in',
  custom: 'Custom',
};

export default function DepositSchedulesPage() {
  const { toast } = useToast();

  const [properties, setProperties] = useState<Property[]>([]);
  const [deposits, setDeposits] = useState<DepositSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [aggregates, setAggregates] = useState({ totalDue: 0, totalPaid: 0, outstanding: 0, overdueCount: 0 });

  // Dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: '', reference: '' });
  const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', milestoneType: 'at_booking', milestoneDays: '', milestoneDate: '',
    percentOfTotal: '100', fixedAmount: '', notes: '',
  });

  // Fetch
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

  const fetchDeposits = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/billing/deposits?${params}`);
      const result = await res.json();
      if (result.success) {
        setDeposits(result.data || []);
        setAggregates(result.aggregates || { totalDue: 0, totalPaid: 0, outstanding: 0, overdueCount: 0 });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch deposits', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, toast]);

  // Initial load
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ limit: '100' });
        if (statusFilter !== 'all') params.set('status', statusFilter);
        const res = await fetch(`/api/billing/deposits?${params}`);
        const result = await res.json();
        if (result.success) {
          setDeposits(result.data || []);
          setAggregates(result.aggregates || { totalDue: 0, totalPaid: 0, outstanding: 0, overdueCount: 0 });
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch deposits', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [statusFilter, toast]);

  // Create
  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Validation', description: 'Name is required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/billing/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          milestoneType: form.milestoneType,
          milestoneDays: form.milestoneDays ? parseInt(form.milestoneDays) : undefined,
          milestoneDate: form.milestoneDate || undefined,
          percentOfTotal: parseFloat(form.percentOfTotal) || 100,
          fixedAmount: form.fixedAmount ? parseFloat(form.fixedAmount) : undefined,
          notes: form.notes || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Deposit schedule created' });
        setIsDialogOpen(false);
        setForm({ name: '', milestoneType: 'at_booking', milestoneDays: '', milestoneDate: '', percentOfTotal: '100', fixedAmount: '', notes: '' });
        fetchDeposits();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create deposit', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Record payment
  const handlePayment = async () => {
    if (!selectedDepositId || !paymentForm.amount) return;
    setIsSaving(true);
    try {
      const deposit = deposits.find(d => d.id === selectedDepositId);
      if (!deposit) return;
      const newPaid = (deposit.paidAmount || 0) + parseFloat(paymentForm.amount);
      const newStatus = newPaid >= deposit.dueAmount ? 'paid' : 'partially_paid';

      const res = await fetch(`/api/billing/deposits/${selectedDepositId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paidAmount: newPaid,
          status: newStatus,
          paymentMethod: paymentForm.method || undefined,
          reference: paymentForm.reference || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Payment Recorded', description: `$${parseFloat(paymentForm.amount).toFixed(2)} applied` });
        setIsPaymentDialogOpen(false);
        setPaymentForm({ amount: '', method: '', reference: '' });
        fetchDeposits();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to record payment', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/billing/deposits/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Deleted', description: 'Deposit schedule deleted' });
        fetchDeposits();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const formatCurrency = (amount: number) => `$${(amount || 0).toFixed(2)}`;
  const collectionRate = aggregates.totalDue > 0 ? (aggregates.totalPaid / aggregates.totalDue) * 100 : 0;

  const filteredDeposits = deposits.filter(d => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const guestName = d.booking?.primaryGuest ? `${d.booking.primaryGuest.firstName} ${d.booking.primaryGuest.lastName}`.toLowerCase() : '';
    const code = (d.booking?.confirmationCode || '').toLowerCase();
    return d.name.toLowerCase().includes(term) || guestName.includes(term) || code.includes(term);
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Deposit Schedules
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Track booking deposits and payment milestones</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDeposits}><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /></Button>
          <Button onClick={() => setIsDialogOpen(true)} className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg transition-all">
            <Plus className="h-4 w-4 mr-1.5" />New Deposit
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
            <div><div className="text-xs text-muted-foreground">Total Due</div><div className="text-xl font-bold">{formatCurrency(aggregates.totalDue)}</div></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10"><CheckCircle2 className="h-5 w-5 text-emerald-500" /></div>
            <div><div className="text-xs text-muted-foreground">Collected</div><div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(aggregates.totalPaid)}</div></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10"><Clock className="h-5 w-5 text-amber-500" /></div>
            <div><div className="text-xs text-muted-foreground">Outstanding</div><div className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(aggregates.outstanding)}</div></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10"><AlertCircle className="h-5 w-5 text-red-500" /></div>
            <div><div className="text-xs text-muted-foreground">Overdue</div><div className="text-xl font-bold text-red-600 dark:text-red-400">{aggregates.overdueCount}</div></div>
          </div>
        </Card>
      </div>

      {/* Collection Rate */}
      <Card><CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Collection Rate</span>
          <span className="text-sm font-bold text-primary">{collectionRate.toFixed(1)}%</span>
        </div>
        <Progress value={collectionRate} className="h-2.5" />
      </CardContent></Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, guest, booking..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40 h-10"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : filteredDeposits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Wallet className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">No deposit schedules found</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deposit Name</TableHead>
                    <TableHead className="hidden md:table-cell">Booking</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeposits.map(dep => {
                    const remaining = dep.dueAmount - dep.paidAmount;
                    const statusCfg = STATUS_CONFIG[dep.status] || STATUS_CONFIG.pending;
                    const StatusIcon = statusCfg.icon;
                    return (
                      <TableRow key={dep.id}>
                        <TableCell className="font-medium text-sm">{dep.name}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="font-mono text-xs">{dep.booking?.confirmationCode || '—'}</div>
                          {dep.booking?.primaryGuest && (
                            <div className="text-xs text-muted-foreground">{dep.booking.primaryGuest.firstName} {dep.booking.primaryGuest.lastName}</div>
                          )}
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{MILESTONE_LABELS[dep.milestoneType] || dep.milestoneType}</Badge></TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(dep.dueAmount)}</TableCell>
                        <TableCell className={cn('text-right text-sm font-medium', dep.paidAmount >= dep.dueAmount ? 'text-emerald-600 dark:text-emerald-400' : remaining > 0 ? 'text-amber-600 dark:text-amber-400' : '')}>{formatCurrency(dep.paidAmount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs gap-1', statusCfg.color)}>
                            <StatusIcon className="h-3 w-3" />{statusCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {dep.milestoneDate ? new Date(dep.milestoneDate).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {dep.status !== 'paid' && dep.status !== 'waived' && (
                                <DropdownMenuItem onClick={() => { setSelectedDepositId(dep.id); setIsPaymentDialogOpen(true); }}>
                                  <CreditCard className="h-4 w-4 mr-2" />Record Payment
                                </DropdownMenuItem>
                              )}
                              {(dep.status === 'pending' || dep.status === 'overdue') && (
                                <DropdownMenuItem onClick={() => handleDelete(dep.id)} className="text-red-600 dark:text-red-400">
                                  <Trash2 className="h-4 w-4 mr-2" />Delete
                                </DropdownMenuItem>
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

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Deposit Schedule</DialogTitle><DialogDescription>Create a new deposit milestone</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5"><Label>Deposit Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Initial Deposit" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Milestone Type</Label>
                <Select value={form.milestoneType} onValueChange={v => setForm(f => ({ ...f, milestoneType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="at_booking">At Booking</SelectItem>
                    <SelectItem value="pre_arrival">Pre-Arrival</SelectItem>
                    <SelectItem value="at_checkin">At Check-in</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Days Before</Label><Input type="number" value={form.milestoneDays} onChange={e => setForm(f => ({ ...f, milestoneDays: e.target.value }))} placeholder="e.g. 30" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Percent of Total (%)</Label><Input type="number" value={form.percentOfTotal} onChange={e => setForm(f => ({ ...f, percentOfTotal: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Fixed Amount</Label><Input type="number" step="0.01" value={form.fixedAmount} onChange={e => setForm(f => ({ ...f, fixedAmount: e.target.value }))} placeholder="Optional" /></div>
            </div>
            <div className="space-y-1.5"><Label>Custom Date</Label><Input type="date" value={form.milestoneDate} onChange={e => setForm(f => ({ ...f, milestoneDate: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle><DialogDescription>Apply a payment to this deposit</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5"><Label>Payment Amount *</Label><Input type="number" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" autoFocus /></div>
            <div className="space-y-1.5"><Label>Payment Method</Label>
              <Select value={paymentForm.method} onValueChange={v => setPaymentForm(f => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Reference</Label><Input value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} placeholder="TXN-12345" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePayment} disabled={isSaving || !paymentForm.amount}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
