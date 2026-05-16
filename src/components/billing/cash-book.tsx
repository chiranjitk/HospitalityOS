'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Printer,
  Calendar,
} from 'lucide-react';

type Category = 'Opening' | 'Income' | 'Expense' | 'Payment' | 'Refund' | 'Closing';

interface CashTransaction {
  id: number;
  time: string;
  description: string;
  category: Category;
  amount: number;
  balance: number;
  approvedBy: string | null;
  approvalStatus: 'approved' | 'pending' | 'rejected';
}

const mockTransactions: CashTransaction[] = [
  { id: 1, time: '06:00 AM', description: 'Opening Balance', category: 'Opening', amount: 12500, balance: 12500, approvedBy: 'Night Auditor', approvalStatus: 'approved' },
  { id: 2, time: '07:15 AM', description: 'Room 101 — Walk-in payment', category: 'Income', amount: 289, balance: 12789, approvedBy: 'Front Desk', approvalStatus: 'approved' },
  { id: 3, time: '08:30 AM', description: 'Room 205 — Checkout settlement', category: 'Income', amount: 456, balance: 13245, approvedBy: 'Front Desk', approvalStatus: 'approved' },
  { id: 4, time: '09:00 AM', description: 'F&B Supplier — Fresh produce', category: 'Expense', amount: -850, balance: 12395, approvedBy: 'F&B Manager', approvalStatus: 'approved' },
  { id: 5, time: '09:45 AM', description: 'Room 310 — OTA refund (Booking.com)', category: 'Refund', amount: -199, balance: 12196, approvedBy: 'Revenue Mgr', approvalStatus: 'approved' },
  { id: 6, time: '10:30 AM', description: 'Laundry service — Linens', category: 'Expense', amount: -420, balance: 11776, approvedBy: 'HK Manager', approvalStatus: 'approved' },
  { id: 7, time: '11:15 AM', description: 'Room 402 — Direct booking payment', category: 'Income', amount: 549, balance: 12325, approvedBy: 'Front Desk', approvalStatus: 'approved' },
  { id: 8, time: '12:00 PM', description: 'Mini-bar restocking supplies', category: 'Expense', amount: -320, balance: 12005, approvedBy: null, approvalStatus: 'pending' },
  { id: 9, time: '01:30 PM', description: 'Room 108 — Extension payment', category: 'Payment', amount: 189, balance: 12194, approvedBy: 'Front Desk', approvalStatus: 'approved' },
  { id: 10, time: '02:00 PM', description: 'Taxi service for guest (Room 215)', category: 'Expense', amount: -75, balance: 12119, approvedBy: 'Concierge', approvalStatus: 'approved' },
  { id: 11, time: '03:15 PM', description: 'Corporate invoice payment — Acme Corp', category: 'Income', amount: 2400, balance: 14519, approvedBy: 'Accounts', approvalStatus: 'approved' },
  { id: 12, time: '04:00 PM', description: 'Maintenance supplies — Plumbing', category: 'Expense', amount: -180, balance: 14339, approvedBy: null, approvalStatus: 'pending' },
  { id: 13, time: '05:30 PM', description: 'Spa revenue deposit', category: 'Income', amount: 680, balance: 15019, approvedBy: 'Spa Manager', approvalStatus: 'approved' },
  { id: 14, time: '06:00 PM', description: 'Restaurant cash drop', category: 'Payment', amount: 1500, balance: 16519, approvedBy: 'F&B Manager', approvalStatus: 'approved' },
  { id: 15, time: '10:00 PM', description: 'Closing Balance', category: 'Closing', amount: 0, balance: 16519, approvedBy: null, approvalStatus: 'pending' },
];

const categoryColors: Record<Category, string> = {
  Opening: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  Income: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  Expense: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  Payment: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  Refund: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  Closing: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export default function CashBook() {
  const [selectedDate, setSelectedDate] = useState('2025-01-15');
  const [selectedProperty, setSelectedProperty] = useState('main');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ description: '', amount: '', category: 'Income' as Category });

  const openingBalance = mockTransactions[0]?.amount || 0;
  const totalIncome = mockTransactions.filter((t) => t.category === 'Income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = mockTransactions.filter((t) => t.category === 'Expense' || t.category === 'Refund').reduce((s, t) => s + Math.abs(t.amount), 0);
  const closingBalance = mockTransactions[mockTransactions.length - 1]?.balance || 0;

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
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white"
            onClick={() => setShowAddForm(!showAddForm)}
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
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="main">Grand Hotel — Main</SelectItem>
            <SelectItem value="annex">Grand Hotel — Annex</SelectItem>
            <SelectItem value="resort">Beach Resort</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Day Summary Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950 dark:to-sky-950">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Opening Balance</p>
            <p className="text-xl font-bold text-blue-900 dark:text-blue-100">${openingBalance.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Income</p>
            <div className="flex items-center gap-1">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">${totalIncome.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Expense</p>
            <div className="flex items-center gap-1">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
              <p className="text-xl font-bold text-red-900 dark:text-red-100">${totalExpense.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Net Movement</p>
            <p className={`text-xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-emerald-900 dark:text-emerald-100' : 'text-red-900 dark:text-red-100'}`}>
              ${totalIncome - totalExpense >= 0 ? '+' : ''}{(totalIncome - totalExpense).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950 dark:to-emerald-950 col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Closing Balance</p>
            <p className="text-xl font-bold text-teal-900 dark:text-teal-100">${closingBalance.toLocaleString()}</p>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Transaction description"
                />
              </div>
              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v as Category })}>
                  <SelectTrigger>
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
              <div className="flex items-end gap-2">
                <Button className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white">
                  Add
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
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
                {mockTransactions.map((tx) => (
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
                        {tx.amount > 0 ? '+' : ''}${tx.amount.toLocaleString()}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
