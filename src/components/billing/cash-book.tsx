'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  BookOpen,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Printer,
  Calendar,
  Loader2,
  Inbox,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Category = 'Opening' | 'Income' | 'Expense' | 'Payment' | 'Refund' | 'Closing';

interface CashEntry {
  id: string;
  time: string;
  description: string;
  category: Category;
  amount: number;
  balance: number;
  approvalStatus: 'approved' | 'pending' | 'rejected';
  approvedBy: string | null;
  paymentMethod: string;
  reference: string | null;
}

interface CashBookData {
  id: string;
  date: string;
  openingBalance: number;
  closingBalance: number;
  status: 'open' | 'closed' | 'approved';
  entries: CashEntry[];
}

interface Property {
  id: string;
  name: string;
  slug: string;
  type: string;
}

const categoryColors: Record<Category, string> = {
  Opening: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  Income: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  Expense: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  Payment: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  Refund: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  Closing: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export default function CashBook() {
  const { toast } = useToast();

  // State for selectors
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedProperty, setSelectedProperty] = useState('');

  // State for data
  const [properties, setProperties] = useState<Property[]>([]);
  const [cashBook, setCashBook] = useState<CashBookData | null>(null);
  const [entries, setEntries] = useState<CashEntry[]>([]);

  // State for loading/error
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add transaction form
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Income' as Category,
    paymentMethod: 'cash',
  });

  // Fetch properties on mount
  useEffect(() => {
    async function fetchProperties() {
      setLoadingProperties(true);
      try {
        const res = await fetch('/api/properties');
        const json = await res.json();
        if (json.success && json.data?.length > 0) {
          setProperties(json.data);
          setSelectedProperty(json.data[0].id);
        } else {
          setProperties([]);
        }
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load properties. Please refresh the page.',
          variant: 'destructive',
        });
        setProperties([]);
      } finally {
        setLoadingProperties(false);
      }
    }
    fetchProperties();
  }, [toast]);

  // Fetch cash book data
  const fetchCashBook = useCallback(async () => {
    if (!selectedProperty || !selectedDate) return;

    setLoadingData(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/accounting/cash-book?propertyId=${encodeURIComponent(selectedProperty)}&date=${encodeURIComponent(selectedDate)}`
      );
      const json = await res.json();
      if (json.success) {
        setCashBook(json.data);
        setEntries(json.data?.entries || []);
      } else {
        setError(json.error?.message || 'Failed to load cash book data');
        setCashBook(null);
        setEntries([]);
        toast({
          title: 'Error',
          description: json.error?.message || 'Failed to load cash book data',
          variant: 'destructive',
        });
      }
    } catch {
      const msg = 'Network error. Please check your connection and try again.';
      setError(msg);
      setCashBook(null);
      setEntries([]);
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  }, [selectedProperty, selectedDate, toast]);

  // Fetch cash book when date or property changes
  useEffect(() => {
    if (selectedProperty && selectedDate) {
      fetchCashBook();
    }
  }, [selectedProperty, selectedDate, fetchCashBook]);

  // Computed summary stats from API data
  const openingBalance = cashBook?.openingBalance ?? (entries.length > 0 ? entries[0].amount : 0);
  const closingBalance = cashBook?.closingBalance ?? (entries.length > 0 ? entries[entries.length - 1].balance : 0);
  const totalIncome = entries
    .filter((t) => t.category === 'Income')
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = entries
    .filter((t) => t.category === 'Expense' || t.category === 'Refund')
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  // Add transaction handler
  const handleAddTransaction = async () => {
    if (!formData.description || !formData.amount || !cashBook?.id) return;

    setSubmitting(true);
    try {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const timeStr = `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;

      const res = await fetch('/api/accounting/cash-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashBookId: cashBook.id,
          time: timeStr,
          description: formData.description,
          category: formData.category,
          amount: formData.amount,
          paymentMethod: formData.paymentMethod,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast({
          title: 'Transaction Added',
          description: `"${formData.description}" has been recorded successfully.`,
        });
        setFormData({ description: '', amount: '', category: 'Income', paymentMethod: 'cash' });
        setShowAddForm(false);
        fetchCashBook();
      } else {
        toast({
          title: 'Error',
          description: json.error?.message || 'Failed to add transaction',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Network error. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Cash Book
          </h2>
          <p className="text-muted-foreground">
            Daily cash transaction management and reconciliation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white"
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={loadingData || !cashBook}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Date & Property Selector */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-44"
          />
        </div>
        <Select value={selectedProperty} onValueChange={setSelectedProperty}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={loadingProperties ? 'Loading...' : 'Select property'} />
          </SelectTrigger>
          <SelectContent>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Day Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950 dark:to-sky-950">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Opening Balance</p>
            <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
              {loadingData ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> : `$${openingBalance.toLocaleString()}`}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Income</p>
            <div className="flex items-center gap-1">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
                {loadingData ? <Loader2 className="h-5 w-5 animate-spin text-emerald-600" /> : `$${totalIncome.toLocaleString()}`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Expense</p>
            <div className="flex items-center gap-1">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
              <p className="text-xl font-bold text-red-900 dark:text-red-100">
                {loadingData ? <Loader2 className="h-5 w-5 animate-spin text-red-600" /> : `$${totalExpense.toLocaleString()}`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Net Movement</p>
            <p className={`text-xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-emerald-900 dark:text-emerald-100' : 'text-red-900 dark:text-red-100'}`}>
              {loadingData ? (
                <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
              ) : (
                `$${totalIncome - totalExpense >= 0 ? '+' : ''}${(totalIncome - totalExpense).toLocaleString()}`
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950 dark:to-emerald-950 col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Closing Balance</p>
            <p className="text-xl font-bold text-teal-900 dark:text-teal-100">
              {loadingData ? <Loader2 className="h-5 w-5 animate-spin text-teal-600" /> : `$${closingBalance.toLocaleString()}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add Transaction Form */}
      {showAddForm && (
        <Card className="border-0 shadow-sm border-l-4 border-l-teal-500">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Plus className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <h3 className="font-semibold">New Transaction</h3>
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Transaction description"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v as Category })}>
                  <SelectTrigger disabled={submitting}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Income">Income</SelectItem>
                    <SelectItem value="Expense">Expense</SelectItem>
                    <SelectItem value="Payment">Payment</SelectItem>
                    <SelectItem value="Refund">Refund</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={formData.paymentMethod} onValueChange={(v) => setFormData({ ...formData, paymentMethod: v })}>
                  <SelectTrigger disabled={submitting}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white"
                  onClick={handleAddTransaction}
                  disabled={submitting || !formData.description || !formData.amount}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)} disabled={submitting}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Transaction Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            {loadingData ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                <span className="ml-3 text-muted-foreground">Loading transactions...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Failed to load data</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={fetchCashBook}>
                  Retry
                </Button>
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Inbox className="h-10 w-10 text-muted-300 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No transactions found for this date</p>
                <p className="text-xs text-muted-foreground mt-1">Select a different date or add a new transaction.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-24">Time</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Approval</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                        {tx.time}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{tx.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={categoryColors[tx.category]}>{tx.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-semibold ${tx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : tx.amount < 0 ? 'text-red-500 dark:text-red-400' : ''}`}>
                          {tx.amount > 0 ? '+' : tx.amount < 0 ? '-' : ''}${Math.abs(tx.amount).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${tx.balance.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {tx.approvalStatus === 'approved' ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-xs text-muted-foreground">{tx.approvedBy}</span>
                          </div>
                        ) : tx.approvalStatus === 'pending' ? (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-xs text-amber-600 dark:text-amber-400">Pending</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                            <span className="text-xs text-red-600 dark:text-red-400">Rejected</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
