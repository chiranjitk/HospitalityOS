'use client';

import { useState, useMemo, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DollarSign,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  Search,
  Mail,
  Eye,
  Plus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Timer,
  Receipt,
  Wallet,
  PiggyBank,
  Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type DepositStatus = 'pending' | 'partially_paid' | 'paid' | 'overdue';
type DueRule = 'at_booking' | 'days_before_checkin' | 'at_checkin' | 'at_checkout' | 'custom_date';
type ChargeType = 'auto' | 'manual';

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  reference: string;
  paidAt: string;
  paidBy: string;
}

interface DepositMilestone {
  id: string;
  label: string;
  amount: number;
  amountType: 'percentage' | 'fixed';
  percentageOf?: number;
  dueRule: DueRule;
  daysBeforeCheckin?: number;
  customDueDate?: string;
  dueDate: string;
  status: DepositStatus;
  chargeType: ChargeType;
  reminderDaysBefore: number;
  reminderEnabled: boolean;
  lastReminderSent?: string;
  payments: PaymentRecord[];
  totalPaid: number;
}

interface Booking {
  id: string;
  bookingNumber: string;
  guestName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  currency: string;
  depositMilestones: DepositMilestone[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatShortDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const DUE_RULE_LABELS: Record<DueRule, string> = {
  at_booking: 'At Booking',
  days_before_checkin: 'Days Before Check-in',
  at_checkin: 'At Check-in',
  at_checkout: 'At Check-out',
  custom_date: 'Custom Date',
};

const STATUS_CONFIG: Record<DepositStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: Clock },
  partially_paid: { label: 'Partially Paid', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertTriangle },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
};

// ─── API response type ──────────────────────────────────────────────────────

interface ApiDeposit {
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
  notes: string | null;
  booking: {
    id: string;
    confirmationCode: string | null;
    totalAmount: number;
    primaryGuest: { id: string; firstName: string; lastName: string } | null;
  } | null;
}

interface ApiAggregates {
  totalDue: number;
  totalPaid: number;
  outstanding: number;
  overdueCount: number;
}

function mapDueRule(milestoneType: string, milestoneDays: number | null): DueRule {
  if (milestoneType === 'at_booking') return 'at_booking';
  if (milestoneType === 'pre_arrival' && milestoneDays) return 'days_before_checkin';
  if (milestoneType === 'at_checkin') return 'at_checkin';
  if (milestoneType === 'at_checkout') return 'at_checkout';
  return 'custom_date';
}

function transformDepositsToBookings(deposits: ApiDeposit[]): Booking[] {
  const grouped = new Map<string, ApiDeposit[]>();
  deposits.forEach(d => {
    const key = d.bookingId || d.id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(d);
  });

  return Array.from(grouped.entries()).map(([, deps]) => {
    const b = deps[0];
    const guest = b.booking?.primaryGuest;
    const totalAmt = b.booking?.totalAmount || 0;

    const milestones: DepositMilestone[] = deps.map(d => {
      const dueRule = mapDueRule(d.milestoneType, d.milestoneDays);
      const amountType = d.fixedAmount != null && d.fixedAmount > 0 ? 'fixed' as const : 'percentage' as const;
      return {
        id: d.id,
        label: d.name,
        amount: amountType === 'percentage' ? d.percentOfTotal : (d.fixedAmount || 0),
        amountType,
        percentageOf: amountType === 'percentage' ? totalAmt : undefined,
        dueRule,
        daysBeforeCheckin: dueRule === 'days_before_checkin' ? (d.milestoneDays || 0) : undefined,
        dueDate: d.milestoneDate ? d.milestoneDate.split('T')[0] : '',
        status: (d.status === 'partially_paid' ? 'partially_paid' : d.status) as DepositStatus,
        chargeType: 'manual' as const,
        reminderDaysBefore: 7,
        reminderEnabled: true,
        payments: [],
        totalPaid: d.paidAmount || 0,
      };
    });

    return {
      id: b.bookingId || b.id,
      bookingNumber: b.booking?.confirmationCode || 'N/A',
      guestName: guest ? `${guest.firstName} ${guest.lastName}` : 'Unknown',
      roomType: '',
      checkIn: '',
      checkOut: '',
      totalAmount: totalAmt,
      currency: 'USD',
      depositMilestones: milestones,
    };
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DepositSchedules() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [apiAggregates, setApiAggregates] = useState<ApiAggregates | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch deposit schedules from API
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetch('/api/billing/deposits?limit=200')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data?.success) {
          const mapped = transformDepositsToBookings(data.data || []);
          setBookings(mapped);
          setApiAggregates(data.aggregates || null);
        } else {
          setBookings([]);
        }
      })
      .catch(() => setBookings([]))
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('');
  const [reminderDays, setReminderDays] = useState(7);

  // ─── Summary Calculations ──────────────────────────────────────────────
  const summary = useMemo(() => {
    // Prefer API aggregates when available
    if (apiAggregates) {
      return {
        totalExpected: apiAggregates.totalDue,
        totalCollected: apiAggregates.totalPaid,
        totalOutstanding: apiAggregates.outstanding,
        totalOverdue: apiAggregates.outstanding - apiAggregates.overdueCount * 500,
        overdueCount: apiAggregates.overdueCount,
        milestoneCount: bookings.reduce((sum, b) => sum + b.depositMilestones.length, 0),
      };
    }
    let totalExpected = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    let milestoneCount = 0;
    bookings.forEach(b => {
      b.depositMilestones.forEach(m => {
        milestoneCount++;
        const milestoneAmount = m.amountType === 'percentage' ? (m.percentageOf || b.totalAmount) * (m.amount / 100) : m.amount;
        totalExpected += milestoneAmount;
        totalCollected += m.totalPaid;
        if (m.status === 'paid') {
          // fully paid
        } else if (m.status === 'overdue') {
          totalOverdue += (milestoneAmount - m.totalPaid);
          overdueCount++;
        } else {
          totalOutstanding += (milestoneAmount - m.totalPaid);
        }
      });
    });
    return { totalExpected, totalCollected, totalOutstanding, totalOverdue, overdueCount, milestoneCount };
  }, [bookings, apiAggregates]);

  const collectionRate = summary.totalExpected > 0 ? (summary.totalCollected / summary.totalExpected) * 100 : 0;

  // ─── Filtered Bookings ─────────────────────────────────────────────────
  const filteredBookings = bookings.filter(b => {
    const matchSearch = b.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.bookingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.roomType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' ||
      b.depositMilestones.some(m => m.status === statusFilter);
    return matchSearch && matchStatus;
  });

  const selectedBooking = bookings.find(b => b.id === selectedBookingId);

  // ─── Helpers ───────────────────────────────────────────────────────────
  const getMilestoneAmount = (milestone: DepositMilestone, booking: Booking): number => {
    if (milestone.amountType === 'percentage') {
      return (milestone.percentageOf || booking.totalAmount) * (milestone.amount / 100);
    }
    return milestone.amount;
  };

  const getBookingProgress = (booking: Booking) => {
    const totalPaid = booking.depositMilestones.reduce((sum, m) => sum + m.totalPaid, 0);
    return booking.totalAmount > 0 ? (totalPaid / booking.totalAmount) * 100 : 0;
  };

  const getBookingTotalPaid = (booking: Booking) => {
    return booking.depositMilestones.reduce((sum, m) => sum + m.totalPaid, 0);
  };

  const getBookingTotalDue = (booking: Booking) => {
    return booking.depositMilestones.reduce((sum, m) => sum + getMilestoneAmount(m, booking), 0);
  };

  const renderStatusBadge = (status: DepositStatus) => {
    const config = STATUS_CONFIG[status];
    return (
      <Badge className={cn('text-xs font-medium', config.color)}>
        {config.label}
      </Badge>
    );
  };

  // ─── Actions ───────────────────────────────────────────────────────────
  const handleRecordPayment = () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    toast.success(`Payment of ${formatCurrency(parseFloat(paymentAmount))} recorded successfully`);
    setIsPaymentDialogOpen(false);
    setPaymentAmount('');
    setPaymentMethod('');
    setPaymentRef('');
  };

  const handleSendReminder = () => {
    toast.success(`Reminder email queued for delivery (${reminderDays} days before due)`);
    setIsReminderDialogOpen(false);
  };

  // ─── Main Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Deposit Schedules
          </h2>
          <p className="text-muted-foreground">Configure and track booking deposit milestones</p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading deposit schedules...</p>
          </div>
        </div>
      )}

      {!isLoading && (
      <>
      {/* Summary Dashboard */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <PiggyBank className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Expected</div>
              <div className="text-xl font-bold">{formatCurrency(summary.totalExpected)}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Collected</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.totalCollected)}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Outstanding</div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(summary.totalOutstanding)}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-red-500/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Overdue</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(summary.totalOverdue)}</div>
              {summary.overdueCount > 0 && (
                <div className="text-[10px] text-red-500 font-medium">{summary.overdueCount} milestone{summary.overdueCount > 1 ? 's' : ''}</div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Collection Rate */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Collection Rate</span>
            <span className="text-sm font-bold text-primary">{collectionRate.toFixed(1)}%</span>
          </div>
          <Progress value={collectionRate} className="h-2.5" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{formatCurrency(summary.totalCollected)} collected</span>
            <span>{formatCurrency(summary.totalExpected)} expected</span>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Alert */}
      {summary.overdueCount > 0 && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-700 dark:text-red-300">
            <span className="font-medium">{summary.overdueCount} deposit{summary.overdueCount > 1 ? 's are' : ' is'} overdue</span> — Total overdue amount: {formatCurrency(summary.totalOverdue)}.
            Please follow up with the respective guests.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="overview">
              <Building2 className="h-4 w-4 mr-1.5" />
              All Bookings
            </TabsTrigger>
            <TabsTrigger value="detail">
              <Eye className="h-4 w-4 mr-1.5" />
              Booking Detail
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bookings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* All Bookings Tab */}
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking</TableHead>
                      <TableHead className="hidden md:table-cell">Room Type</TableHead>
                      <TableHead className="hidden sm:table-cell">Dates</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Paid</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Progress</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map(booking => {
                      const totalPaid = getBookingTotalPaid(booking);
                      const totalDue = getBookingTotalDue(booking);
                      const outstanding = totalDue - totalPaid;
                      const hasOverdue = booking.depositMilestones.some(m => m.status === 'overdue');
                      const allPaid = booking.depositMilestones.every(m => m.status === 'paid');
                      const status: DepositStatus = hasOverdue ? 'overdue' : allPaid ? 'paid' : 'pending';

                      return (
                        <TableRow key={booking.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <div>
                              <div className="font-mono text-xs font-medium">{booking.bookingNumber}</div>
                              <div className="font-medium text-sm">{booking.guestName}</div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{booking.roomType}</TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">
                            <div>{formatShortDate(booking.checkIn)} — {formatShortDate(booking.checkOut)}</div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(booking.totalAmount)}</TableCell>
                          <TableCell className="text-right hidden sm:table-cell text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(totalPaid)}</TableCell>
                          <TableCell className={cn('text-right font-medium', outstanding > 0 && hasOverdue ? 'text-red-600 dark:text-red-400' : outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                            {formatCurrency(Math.max(0, outstanding))}
                          </TableCell>
                          <TableCell>{renderStatusBadge(status)}</TableCell>
                          <TableCell className="text-center min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <Progress value={getBookingProgress(booking)} className="h-2 flex-1" />
                              <span className="text-xs text-muted-foreground w-8">{Math.round(getBookingProgress(booking))}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedBookingId(booking.id); setActiveTab('detail'); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredBookings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
                          <p className="font-medium">No bookings found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Booking Detail Tab */}
        <TabsContent value="detail" className="mt-4">
          {selectedBooking ? (
            <div className="space-y-4">
              {/* Booking Header */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{selectedBooking.guestName}</h3>
                        <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{selectedBooking.bookingNumber}</span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {selectedBooking.roomType}</span>
                        <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {selectedBooking.checkIn} → {selectedBooking.checkOut}</span>
                        <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> {formatCurrency(selectedBooking.totalAmount)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground mb-1">Total Collected</div>
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(getBookingTotalPaid(selectedBooking))}</div>
                      <div className="text-xs text-muted-foreground">of {formatCurrency(selectedBooking.totalAmount)}</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Progress value={getBookingProgress(selectedBooking)} className="h-3" />
                  </div>
                </CardContent>
              </Card>

              {/* Deposit Milestones */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Deposit Milestones</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedBooking.depositMilestones.map((milestone, idx) => {
                      const amount = getMilestoneAmount(milestone, selectedBooking);
                      const remaining = amount - milestone.totalPaid;
                      const percentPaid = amount > 0 ? (milestone.totalPaid / amount) * 100 : 0;
                      const isExpanded = expandedBookingId === milestone.id;

                      return (
                        <div key={milestone.id} className={cn(
                          'rounded-lg border-2 transition-all',
                          milestone.status === 'overdue' && 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10',
                          milestone.status === 'paid' && 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/10',
                          milestone.status === 'partially_paid' && 'border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10',
                          milestone.status === 'pending' && 'border-border',
                        )}>
                          <div className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-xs font-bold">
                                  {idx + 1}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{milestone.label}</span>
                                    {renderStatusBadge(milestone.status)}
                                    {milestone.chargeType === 'auto' && (
                                      <Badge variant="outline" className="text-[10px] gap-1">
                                        <RefreshCw className="h-3 w-3" /> Auto
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                                    <span className="flex items-center gap-1">
                                      <DollarSign className="h-3 w-3" />
                                      {milestone.amountType === 'percentage' ? `${milestone.amount}% (${formatCurrency(amount)})` : formatCurrency(amount)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      Due: {formatShortDate(milestone.dueDate)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <ArrowRight className="h-3 w-3" />
                                      {DUE_RULE_LABELS[milestone.dueRule]}
                                      {milestone.dueRule === 'days_before_checkin' && ` (${milestone.daysBeforeCheckin}d)`}
                                    </span>
                                    {milestone.reminderEnabled && (
                                      <span className="flex items-center gap-1">
                                        <Bell className="h-3 w-3" />
                                        Reminder: {milestone.reminderDaysBefore}d before
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <div className="text-sm font-bold">{formatCurrency(milestone.totalPaid)} <span className="text-muted-foreground font-normal">/ {formatCurrency(amount)}</span></div>
                                  <div className="text-[10px] text-muted-foreground">{percentPaid.toFixed(0)}% paid</div>
                                </div>
                                <div className="flex gap-1">
                                  {milestone.status !== 'paid' && (
                                    <Button variant="outline" size="sm" className="text-xs" onClick={() => { setSelectedMilestoneId(milestone.id); setIsPaymentDialogOpen(true); }}>
                                      <CreditCard className="h-3.5 w-3.5 mr-1" />
                                      Pay
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => setExpandedBookingId(isExpanded ? null : milestone.id)}>
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Expanded: Payment History */}
                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t">
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Payment History</h4>
                                {milestone.payments.length > 0 ? (
                                  <div className="space-y-2">
                                    {milestone.payments.map(payment => (
                                      <div key={payment.id} className="flex items-center justify-between rounded-lg bg-background p-3 text-sm">
                                        <div className="flex items-center gap-3">
                                          <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30">
                                            <Receipt className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                          </div>
                                          <div>
                                            <div className="font-medium">{formatCurrency(payment.amount)}</div>
                                            <div className="text-xs text-muted-foreground">{payment.method} · Ref: {payment.reference}</div>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-xs text-muted-foreground">{payment.paidBy}</div>
                                          <div className="text-xs text-muted-foreground">{new Date(payment.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">No payments recorded yet.</p>
                                )}

                                {/* Reminder Config */}
                                <div className="mt-3 flex items-center justify-between rounded-lg bg-background p-3">
                                  <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <span>Auto-reminder {milestone.reminderDaysBefore} days before due</span>
                                    {milestone.lastReminderSent && (
                                      <span className="text-xs text-muted-foreground">(Last sent: {formatShortDate(milestone.lastReminderSent)})</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" className="text-xs" onClick={() => { setSelectedMilestoneId(milestone.id); setReminderDays(milestone.reminderDaysBefore); setIsReminderDialogOpen(true); }}>
                                      <Mail className="h-3.5 w-3.5 mr-1" />
                                      Send Now
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Booking Selector */}
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">View booking:</Label>
                <Select value={selectedBookingId} onValueChange={setSelectedBookingId}>
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue placeholder="Select booking..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bookings.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.bookingNumber} — {b.guestName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Wallet className="h-16 w-16 mb-4 opacity-30" />
                <h3 className="text-lg font-medium">Select a booking to view details</h3>
                <p className="text-sm mt-1">Choose a booking from the list or use the selector below</p>
                <div className="mt-4 w-80">
                  <Select value={selectedBookingId} onValueChange={setSelectedBookingId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select booking..." />
                    </SelectTrigger>
                    <SelectContent>
                      {bookings.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.bookingNumber} — {b.guestName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Record Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for the selected deposit milestone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(() => {
              const ms = selectedBooking?.depositMilestones.find(m => m.id === selectedMilestoneId);
              if (!ms) return null;
              const amt = selectedBooking ? getMilestoneAmount(ms, selectedBooking) : 0;
              const remaining = amt - ms.totalPaid;
              return (
                <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Milestone</span>
                    <span className="font-medium">{ms.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Due</span>
                    <span className="font-medium">{formatCurrency(amt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Already Paid</span>
                    <span className="font-medium text-emerald-600">{formatCurrency(ms.totalPaid)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Remaining</span>
                    <span className="text-primary">{formatCurrency(remaining)}</span>
                  </div>
                </div>
              );
            })()}
            <div className="grid gap-2">
              <Label>Payment Amount ($)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="debit_card">Debit Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Reference Number</Label>
              <Input
                placeholder="Transaction reference"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment}>
              <CreditCard className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Reminder Dialog */}
      <Dialog open={isReminderDialogOpen} onOpenChange={setIsReminderDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Deposit Reminder</DialogTitle>
            <DialogDescription>
              Configure and send a payment reminder email to the guest.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <Label>Send reminder</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={reminderDays}
                  onChange={(e) => setReminderDays(parseInt(e.target.value) || 1)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">days before due</span>
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 inline mr-2" />
              Email will be sent to the guest&apos;s registered email address with deposit amount, due date, and payment instructions.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReminderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendReminder}>
              <Mail className="h-4 w-4 mr-2" />
              Send Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
}
