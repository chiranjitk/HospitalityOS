'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Plus, Trash2, CheckCircle, XCircle, Loader2,
  ArrowUpCircle, ArrowDownCircle, RefreshCw, DollarSign, CreditCard,
  Banknote, Smartphone, Building, FileText, ChevronLeft, ChevronRight,
  Shield, BarChart3, History, CalendarDays, AlertTriangle, TrendingUp,
  TrendingDown, Wallet, ClipboardCheck, UserCheck, Clock, CircleDot,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'receipt', label: 'Receipt', icon: ArrowDownCircle, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' },
  { id: 'payment', label: 'Payment', icon: ArrowUpCircle, color: 'text-red-600 bg-red-50 dark:bg-red-900/30' },
  { id: 'transfer_in', label: 'Transfer In', icon: ArrowDownCircle, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
  { id: 'transfer_out', label: 'Transfer Out', icon: ArrowUpCircle, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30' },
  { id: 'petty_cash', label: 'Petty Cash', icon: DollarSign, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' },
  { id: 'refund', label: 'Refund', icon: ArrowUpCircle, color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30' },
  { id: 'advance', label: 'Advance', icon: ArrowDownCircle, color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30' },
  { id: 'settlement', label: 'Settlement', icon: CreditCard, color: 'text-slate-600 bg-slate-50 dark:bg-slate-900/30' },
];

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'bank_transfer', label: 'Bank Transfer', icon: Building },
  { id: 'cheque', label: 'Cheque', icon: FileText },
  { id: 'online', label: 'Online', icon: CreditCard },
];

interface Transaction {
  id: string;
  time: string;
  description: string;
  category: string;
  amount: number;
  reference?: string;
  paymentMethod: string;
  approved: boolean;
}

interface CashBookData {
  id: string;
  date: string;
  openingBalance: number;
  closingBalance: number;
  status: string;
  preparedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  transactions: Transaction[];
}

interface ReportSummary {
  totalTransactions: number;
  totalReceipts: number;
  totalPayments: number;
  netChange: number;
  balance: number;
  byCategory: Record<string, { count: number; amount: number }>;
  byPaymentMethod: Record<string, { count: number; amount: number }>;
}

interface HistoryEntry {
  id: string;
  date: string;
  openingBalance: number;
  closingBalance: number;
  status: string;
  transactions: Transaction[];
  preparedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export default function CashBook() {
  const [cashBook, setCashBook] = useState<CashBookData | null>(null);
  const [report, setReport] = useState<(CashBookData & { summary?: ReportSummary }) | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [propertyId] = useState('preview-property');

  // Add form
  const [formTime, setFormTime] = useState(new Date().toTimeString().slice(0, 5));
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState('receipt');
  const [formAmount, setFormAmount] = useState('');
  const [formRef, setFormRef] = useState('');
  const [formMethod, setFormMethod] = useState('cash');

  const fetchCashBook = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/accounting/cash-book?propertyId=${propertyId}&date=${currentDate}`);
      const json = await res.json();
      if (json.success) setCashBook(json.data);
    } catch (err) {
      console.error('Failed to fetch cash book:', err);
    } finally {
      setLoading(false);
    }
  }, [propertyId, currentDate]);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/accounting/cash-book?propertyId=${propertyId}&date=${currentDate}&action=report`);
      const json = await res.json();
      if (json.success) setReport(json.data);
    } catch (err) {
      console.error('Failed to fetch report:', err);
    }
  }, [propertyId, currentDate]);

  const fetchHistory = useCallback(async () => {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      const res = await fetch(`/api/accounting/cash-book?propertyId=${propertyId}&action=history&startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      if (json.success) setHistory(json.data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, [propertyId]);

  useEffect(() => { fetchCashBook(); fetchReport(); }, [fetchCashBook, fetchReport]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleDateChange = (direction: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + direction);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => setCurrentDate(new Date().toISOString().split('T')[0]);

  const handleAddEntry = async () => {
    if (!formDesc || !formAmount) { toast.error('Description and amount are required'); return; }
    if (!cashBook?.id) { toast.error('Cash book not available'); return; }
    try {
      setSaving(true);
      const res = await fetch('/api/accounting/cash-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashBookId: cashBook.id, time: formTime, description: formDesc,
          category: formCategory, amount: parseFloat(formAmount),
          reference: formRef || undefined, paymentMethod: formMethod,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Entry added');
        setShowAddDialog(false);
        resetForm();
        fetchCashBook(); fetchReport();
      } else { toast.error(json.error?.message || 'Failed to add entry'); }
    } catch { toast.error('Failed to add entry'); }
    finally { setSaving(false); }
  };

  const handleClose = async () => {
    if (!cashBook?.id) return;
    try {
      setSaving(true);
      const res = await fetch('/api/accounting/cash-book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', cashBookId: cashBook.id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Cash book closed for the day');
        fetchCashBook(); fetchReport(); fetchHistory();
      } else { toast.error(json.error?.message || 'Failed to close'); }
    } catch { toast.error('Failed to close cash book'); }
    finally { setSaving(false); }
  };

  const handleApprove = async () => {
    if (!cashBook?.id) return;
    try {
      setSaving(true);
      const res = await fetch('/api/accounting/cash-book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', cashBookId: cashBook.id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Cash book approved by manager');
        fetchCashBook(); fetchHistory();
      } else { toast.error(json.error?.message || 'Failed to approve'); }
    } catch { toast.error('Failed to approve'); }
    finally { setSaving(false); }
  };

  const handleAutoPopulate = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/accounting/cash-book?action=auto-populate&propertyId=${propertyId}&date=${currentDate}`, { method: 'GET' });
      const json = await res.json();
      if (json.success) {
        toast.success(`Auto-populated ${json.data.autoPopulated} entries from payments`);
        fetchCashBook(); fetchReport();
      } else { toast.error(json.error?.message || 'Auto-populate failed'); }
    } catch { toast.error('Auto-populate failed'); }
    finally { setSaving(false); }
  };

  const handleDeleteEntry = async (transactionId: string) => {
    try {
      const res = await fetch(`/api/accounting/cash-book?transactionId=${transactionId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('Entry removed'); fetchCashBook(); fetchReport(); }
    } catch { toast.error('Failed to remove entry'); }
  };

  const resetForm = () => {
    setFormTime(new Date().toTimeString().slice(0, 5));
    setFormDesc(''); setFormCategory('receipt'); setFormAmount('');
    setFormRef(''); setFormMethod('cash');
  };

  const isClosed = cashBook?.status === 'closed';
  const isAdjusted = cashBook?.status === 'adjusted';
  const isToday = currentDate === new Date().toISOString().split('T')[0];
  const isApproved = !!cashBook?.approvedAt;
  const categoryInfo = (catId: string) => CATEGORIES.find(c => c.id === catId) || CATEGORIES[0];
  const methodInfo = (methodId: string) => PAYMENT_METHODS.find(m => m.id === methodId) || PAYMENT_METHODS[0];

  // Compute running balance per transaction
  const getRunningBalance = (index: number) => {
    if (!cashBook) return 0;
    let bal = cashBook.openingBalance;
    for (let i = 0; i <= index && i < cashBook.transactions.length; i++) {
      const tx = cashBook.transactions[i];
      if (['receipt', 'transfer_in', 'advance'].includes(tx.category)) bal += tx.amount;
      else bal -= tx.amount;
    }
    return bal;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Daily Cash Book</h2>
          <p className="text-muted-foreground text-sm mt-1">Track all daily cash transactions with approval workflow</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={handleAutoPopulate} disabled={isClosed || saving} className="gap-2 text-sm">
            <RefreshCw className={cn('h-4 w-4', saving && 'animate-spin')} /> Auto Populate
          </Button>
          {!isClosed && (
            <Button onClick={handleClose} disabled={saving} variant="outline" className="gap-2 border-red-300 text-red-600 hover:bg-red-50 text-sm">
              <ClipboardCheck className="h-4 w-4" /> Close Day
            </Button>
          )}
          {isClosed && !isApproved && (
            <Button onClick={handleApprove} disabled={saving} className="gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm">
              <Shield className="h-4 w-4" /> Approve
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      {isClosed && (
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg border',
          isApproved ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        )}>
          {isApproved ? (
            <>
              <UserCheck className="h-5 w-5 text-emerald-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Cash book approved</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500">
                  Approved at {new Date(cashBook!.approvedAt!).toLocaleString()}
                  {cashBook?.approvedBy && ` • Approved by: ${cashBook.approvedBy}`}
                </p>
              </div>
              <Badge className="bg-emerald-600 text-white"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Cash book closed — pending approval</p>
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Closed at {cashBook?.preparedBy && `by ${cashBook.preparedBy}`} • Awaiting manager approval
                </p>
              </div>
              <Badge className="bg-amber-500 text-white"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>
            </>
          )}
        </div>
      )}

      {/* Date Navigator + Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 sm:col-span-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDateChange(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center px-2">
                <p className="text-xs font-semibold">
                  {new Date(currentDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                {isToday && <Badge variant="secondary" className="text-[10px] mt-0.5">Today</Badge>}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDateChange(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {!isToday && (
              <Button variant="ghost" size="sm" onClick={handleToday} className="text-[10px] h-6">
                Today
              </Button>
            )}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-sky-600" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Opening</p>
              <p className="text-base font-bold">${(cashBook?.openingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Closing</p>
              <p className={cn('text-base font-bold', (cashBook?.closingBalance || 0) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                ${(cashBook?.closingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Transactions</p>
              <p className="text-base font-bold">{cashBook?.transactions?.length || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transactions">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="transactions" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Transactions</TabsTrigger>
          <TabsTrigger value="report" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Report</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><History className="h-3.5 w-3.5" /> History</TabsTrigger>
        </TabsList>

        {/* ─── Transactions Tab ─── */}
        <TabsContent value="transactions" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              Entries ({cashBook?.transactions?.length || 0})
            </h3>
            {!isClosed && (
              <Button onClick={() => setShowAddDialog(true)} size="sm" className="gap-1 bg-teal-600 hover:bg-teal-700 text-white text-xs">
                <Plus className="h-3 w-3" /> Add Entry
              </Button>
            )}
          </div>

          <Card>
            <ScrollArea className="max-h-[500px]">
              <div className="divide-y">
                {/* Header Row */}
                <div className="flex items-center gap-3 p-3 bg-muted/50 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  <div className="w-9" />
                  <div className="flex-1 min-w-0">Description</div>
                  <div className="w-16 text-right">Category</div>
                  <div className="w-16 text-right">Method</div>
                  <div className="w-24 text-right">Amount</div>
                  <div className="w-24 text-right">Balance</div>
                  {!isClosed && <div className="w-7" />}
                </div>

                {(!cashBook?.transactions || cashBook.transactions.length === 0) && (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No transactions yet. Click &quot;Add Entry&quot; or &quot;Auto Populate&quot; to get started.
                  </div>
                )}

                {cashBook?.transactions?.map((tx, idx) => {
                  const cat = categoryInfo(tx.category);
                  const method = methodInfo(tx.paymentMethod);
                  const isIncome = ['receipt', 'transfer_in', 'advance'].includes(tx.category);
                  const runningBal = getRunningBalance(idx);

                  return (
                    <div key={tx.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', cat.color)}>
                        <cat.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{tx.description}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{tx.time}</span>
                          {tx.reference && <span className="font-mono text-[10px]">#{tx.reference}</span>}
                        </div>
                      </div>
                      <div className="w-16 text-right">
                        <Badge variant="secondary" className="text-[10px] px-1.5">{cat.label}</Badge>
                      </div>
                      <div className="w-16 text-right text-xs text-muted-foreground flex items-center justify-end gap-0.5">
                        <method.icon className="h-2.5 w-2.5" />
                        <span>{method.label}</span>
                      </div>
                      <div className="w-24 text-right">
                        <p className={cn('font-semibold text-sm', isIncome ? 'text-emerald-600' : 'text-red-600')}>
                          {isIncome ? '+' : '-'}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="w-24 text-right">
                        <p className="text-xs text-muted-foreground font-mono">
                          ${runningBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      {!isClosed && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600 shrink-0"
                          onClick={() => handleDeleteEntry(tx.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}

                {/* Footer Total */}
                {cashBook && cashBook.transactions.length > 0 && (
                  <div className="flex items-center justify-end gap-3 p-3 bg-muted/30">
                    <span className="text-sm font-medium text-muted-foreground">Net Change:</span>
                    <span className={cn('text-sm font-bold',
                      (cashBook.closingBalance - cashBook.openingBalance) >= 0 ? 'text-emerald-600' : 'text-red-600'
                    )}>
                      {(cashBook.closingBalance - cashBook.openingBalance) >= 0 ? '+' : ''}
                      ${(cashBook.closingBalance - cashBook.openingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* ─── Report Tab ─── */}
        <TabsContent value="report" className="space-y-4 mt-4">
          {report?.summary && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Receipts</p>
                  </div>
                  <p className="text-lg font-bold text-emerald-600">+${report.summary.totalReceipts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </Card>
                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Payments</p>
                  </div>
                  <p className="text-lg font-bold text-red-600">-${report.summary.totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </Card>
                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="h-4 w-4 text-violet-500" />
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Net Change</p>
                  </div>
                  <p className={cn('text-lg font-bold', report.summary.netChange >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {report.summary.netChange >= 0 ? '+' : ''}${report.summary.netChange.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </Card>
                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="h-4 w-4 text-sky-500" />
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Balance</p>
                  </div>
                  <p className="text-lg font-bold">${report.summary.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </Card>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">By Category</CardTitle></CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-64">
                      <div className="space-y-2">
                        {Object.entries(report.summary.byCategory).map(([cat, data]) => {
                          const info = categoryInfo(cat);
                          return (
                            <div key={cat} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div className={cn('w-6 h-6 rounded flex items-center justify-center', info.color)}>
                                  <info.icon className="h-3 w-3" />
                                </div>
                                <span>{info.label}</span>
                                <Badge variant="secondary" className="text-[10px]">{data.count}</Badge>
                              </div>
                              <span className="font-medium">${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          );
                        })}
                        {Object.keys(report.summary.byCategory).length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">No data yet</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">By Payment Method</CardTitle></CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-64">
                      <div className="space-y-2">
                        {Object.entries(report.summary.byPaymentMethod).map(([method, data]) => {
                          const info = methodInfo(method);
                          return (
                            <div key={method} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <info.icon className="h-4 w-4 text-muted-foreground" />
                                <span>{info.label}</span>
                                <Badge variant="secondary" className="text-[10px]">{data.count}</Badge>
                              </div>
                              <span className="font-medium">${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          );
                        })}
                        {Object.keys(report.summary.byPaymentMethod).length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">No data yet</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {!isApproved && isClosed && (
                <Button onClick={handleApprove} className="gap-2 bg-teal-600 hover:bg-teal-700 text-white w-full">
                  <Shield className="h-4 w-4" /> Approve Cash Book
                </Button>
              )}
            </>
          )}
        </TabsContent>

        {/* ─── History Tab ─── */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" /> Cash Book History (Last 30 Days)
                  </CardTitle>
                  <CardDescription className="mt-1">{history.length} entries found</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                {history.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No history entries yet
                  </div>
                )}
                <div className="divide-y">
                  {history.map(entry => {
                    const dateStr = new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    const txCount = entry.transactions?.length || 0;
                    const totalR = entry.transactions?.filter(t => ['receipt', 'transfer_in', 'advance'].includes(t.category)).reduce((s, t) => s + t.amount, 0) || 0;
                    const totalP = entry.transactions?.filter(t => ['payment', 'transfer_out', 'refund', 'petty_cash', 'settlement'].includes(t.category)).reduce((s, t) => s + t.amount, 0) || 0;
                    const entryApproved = !!entry.approvedAt;

                    return (
                      <button
                        key={entry.id}
                        onClick={() => {
                          const d = new Date(entry.date).toISOString().split('T')[0];
                          setCurrentDate(d);
                        }}
                        className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-lg bg-muted flex flex-col items-center justify-center shrink-0">
                          <span className="text-xs font-bold">{new Date(entry.date).getDate()}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(entry.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{dateStr}</p>
                            <Badge variant="secondary" className="text-[10px]">{txCount} entries</Badge>
                            {entry.status === 'closed' && !entryApproved && (
                              <Badge className="bg-amber-100 text-amber-700 text-[10px]">Pending</Badge>
                            )}
                            {entry.status === 'closed' && entryApproved && (
                              <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Approved</Badge>
                            )}
                            {entry.status === 'open' && (
                              <Badge variant="secondary" className="text-[10px]">Open</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="text-emerald-600">+${totalR.toFixed(2)}</span>
                            <span className="text-red-600">-${totalP.toFixed(2)}</span>
                            <span>Balance: ${entry.closingBalance.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn('font-bold text-sm', entry.closingBalance >= 0 ? 'text-foreground' : 'text-red-600')}>
                            ${entry.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Add Entry Dialog ─── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cash Entry</DialogTitle>
            <DialogDescription>Record a new transaction in the daily cash book</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Time</Label>
                <Input type="time" value={formTime} onChange={e => setFormTime(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Amount ($)</Label>
                <Input type="number" step="0.01" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Description *</Label>
              <Input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="e.g. Room payment - #1234" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={formMethod} onValueChange={setFormMethod}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Reference (optional)</Label>
              <Input value={formRef} onChange={e => setFormRef(e.target.value)} placeholder="Folio #, Invoice #, etc." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddEntry} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
