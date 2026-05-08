'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Search,
  Mail,
  MessageSquare,
  Send,
  RotateCcw,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  UserCheck,
  CreditCard,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  ArrowRight,
  Filter,
  RefreshCw,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface AbandonedBooking {
  id: string;
  guestEmail: string | null;
  guestPhone: string | null;
  roomTypeId: string | null;
  checkIn: string | null;
  checkOut: string | null;
  adults: number;
  children: number;
  selectedRate: number | null;
  currency: string;
  stepAbandoned: string;
  recoveryStatus: string;
  recoveryEmailSentAt: string | null;
  recoverySmsSentAt: string | null;
  recoveredAt: string | null;
  recoveryOffer: number | null;
  createdAt: string;
}

interface Stats {
  total: number;
  funnel: { search: number; room_select: number; guest_info: number; payment: number };
  recovery: { pending: number; emailed: number; smsSent: number; recovered: number; expired: number };
  totalRevenueRecovered: number;
  recoveryRate: number;
}

// ============================================================
// Constants
// ============================================================

const STEP_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  search: { label: 'Search', icon: <Search className="h-4 w-4" />, color: 'text-sky-600' },
  room_select: { label: 'Room Select', icon: <ShoppingCart className="h-4 w-4" />, color: 'text-violet-600' },
  guest_info: { label: 'Guest Info', icon: <UserCheck className="h-4 w-4" />, color: 'text-amber-600' },
  payment: { label: 'Payment', icon: <CreditCard className="h-4 w-4" />, color: 'text-red-600' },
};

const RECOVERY_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  emailed: { label: 'Email Sent', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300' },
  sms_sent: { label: 'SMS Sent', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300' },
  recovered: { label: 'Recovered', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

const FUNNEL_STEPS = ['search', 'room_select', 'guest_info', 'payment'];

// ============================================================
// Component
// ============================================================

export default function AbandonedBookings() {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<AbandonedBooking[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, funnel: { search: 0, room_select: 0, guest_info: 0, payment: 0 }, recovery: { pending: 0, emailed: 0, smsSent: 0, recovered: 0, expired: 0 }, totalRevenueRecovered: 0, recoveryRate: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStep, setFilterStep] = useState('all');
  const [activeTab, setActiveTab] = useState('list');
  const [recoverDialog, setRecoverDialog] = useState<AbandonedBooking | null>(null);
  const [recoverChannel, setRecoverChannel] = useState<'email' | 'sms'>('email');
  const [recoverOffer, setRecoverOffer] = useState(10);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('recoveryStatus', filterStatus);
      if (filterStep !== 'all') params.set('stepAbandoned', filterStep);
      const res = await fetch(`/api/marketing/abandoned-bookings?${params}`);
      const json = await res.json();
      if (json.success) {
        setBookings(json.data.bookings || []);
        setStats(json.data.stats || { total: 0, funnel: { search: 0, room_select: 0, guest_info: 0, payment: 0 }, recovery: { pending: 0, emailed: 0, smsSent: 0, recovered: 0, expired: 0 }, totalRevenueRecovered: 0, recoveryRate: 0 });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load abandoned bookings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterStep, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = bookings.filter((b) =>
    b.guestEmail?.toLowerCase().includes(search.toLowerCase()) ||
    b.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleRecover = async () => {
    if (!recoverDialog) return;
    try {
      const res = await fetch('/api/marketing/abandoned-bookings/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recoverDialog.id, channel: recoverChannel, offerPercent: recoverOffer }),
      });
      const json = await res.json();
      if (json.success) toast({ title: 'Success', description: `${recoverChannel === 'email' ? 'Email' : 'SMS'} sent` });
      else toast({ title: 'Error', description: json.error, variant: 'destructive' });
      setRecoverDialog(null);
      fetchData();
    } catch {
      toast({ title: 'Error', description: 'Failed to send recovery', variant: 'destructive' });
    }
  };

  const getFunnelPercent = (step: string) => {
    const total = stats.total || 1;
    return Math.round((stats.funnel[step as keyof typeof stats.funnel] / total) * 100);
  };

  const getRecoveryPercent = (status: string) => {
    const total = stats.total || 1;
    return Math.round((stats.recovery[status as keyof typeof stats.recovery] / total) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-amber-600" />
            Abandoned Booking Recovery
          </h2>
          <p className="text-muted-foreground">Track and recover abandoned booking funnels with email/SMS campaigns</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Total Abandoned</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{stats.total}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{stats.recovery.pending} pending recovery</p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <ShoppingCart className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Recovered</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{stats.recovery.recovered}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{stats.recoveryRate}% recovery rate</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <CheckCircle2 className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950 dark:to-sky-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-sky-700 dark:text-sky-400">Revenue Recovered</p>
                <p className="text-2xl font-bold text-sky-900 dark:text-sky-100">${stats.totalRevenueRecovered.toLocaleString()}</p>
                <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">From recovered bookings</p>
              </div>
              <div className="p-3 rounded-full bg-sky-200 dark:bg-sky-800">
                <DollarSign className="h-6 w-6 text-sky-700 dark:text-sky-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Recovery Rate</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{stats.recoveryRate}%</p>
                <Progress value={stats.recoveryRate} className="h-2 mt-2" />
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <TrendingUp className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5 hidden sm:block" />Bookings List</TabsTrigger>
          <TabsTrigger value="funnel" className="gap-1.5"><Filter className="h-3.5 w-3.5 hidden sm:block" />Funnel Analysis</TabsTrigger>
        </TabsList>

        {/* ---- Tab: Bookings List ---- */}
        <TabsContent value="list" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by email or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Recovery Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="emailed">Emailed</SelectItem>
                <SelectItem value="sms_sent">SMS Sent</SelectItem>
                <SelectItem value="recovered">Recovered</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStep} onValueChange={setFilterStep}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Abandoned Step" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Steps</SelectItem>
                <SelectItem value="search">Search</SelectItem>
                <SelectItem value="room_select">Room Select</SelectItem>
                <SelectItem value="guest_info">Guest Info</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No abandoned bookings found.</div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Guest</TableHead>
                        <TableHead className="hidden md:table-cell">Dates</TableHead>
                        <TableHead>Step</TableHead>
                        <TableHead className="hidden sm:table-cell">Rate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Created</TableHead>
                        <TableHead className="w-[100px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{b.guestEmail || 'Anonymous'}</p>
                              {b.guestPhone && <p className="text-xs text-muted-foreground">{b.guestPhone}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="text-xs">
                              {b.checkIn && <span>{format(new Date(b.checkIn), 'MMM dd')}</span>}
                              {b.checkIn && b.checkOut && <span> → </span>}
                              {b.checkOut && <span>{format(new Date(b.checkOut), 'MMM dd')}</span>}
                              <br />
                              <span className="text-muted-foreground">{b.adults} adults, {b.children} children</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs gap-1">
                              {STEP_LABELS[b.stepAbandoned]?.icon}
                              {STEP_LABELS[b.stepAbandoned]?.label || b.stepAbandoned}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell font-medium">
                            {b.selectedRate ? `$${b.selectedRate}` : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${RECOVERY_STATUS_CONFIG[b.recoveryStatus]?.color || ''} text-xs capitalize`}>
                              {RECOVERY_STATUS_CONFIG[b.recoveryStatus]?.label || b.recoveryStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {format(new Date(b.createdAt), 'MMM dd, HH:mm')}
                          </TableCell>
                          <TableCell>
                            {(b.recoveryStatus === 'pending' || b.recoveryStatus === 'emailed') && (
                              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => { setRecoverDialog(b); setRecoverChannel('email'); setRecoverOffer(10); }}>
                                <Send className="h-3 w-3" /> Recover
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Tab: Funnel Visualization ---- */}
        <TabsContent value="funnel" className="mt-4 space-y-4">
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Abandonment Funnel */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Filter className="h-5 w-5" />Abandonment Funnel</CardTitle>
                <CardDescription>Where guests drop off during the booking process</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {FUNNEL_STEPS.map((step, i) => {
                    const count = stats.funnel[step as keyof typeof stats.funnel];
                    const pct = getFunnelPercent(step);
                    const nextStep = FUNNEL_STEPS[i + 1];
                    const dropoff = nextStep
                      ? count - stats.funnel[nextStep as keyof typeof stats.funnel]
                      : 0;
                    const dropoffPct = count > 0 ? Math.round((dropoff / count) * 100) : 0;

                    return (
                      <div key={step}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={STEP_LABELS[step]?.color}>{STEP_LABELS[step]?.icon}</span>
                            <span className="text-sm font-medium">{STEP_LABELS[step]?.label}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="font-bold">{count}</span>
                            <span className="text-muted-foreground">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-8 rounded-lg bg-muted/50 overflow-hidden">
                          <div
                            className="h-full rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                        {nextStep && dropoff > 0 && (
                          <div className="flex items-center justify-center my-2">
                            <div className="flex items-center gap-1 text-xs text-red-500">
                              <ArrowRight className="h-3 w-3" />
                              <span>{dropoff} drop-off ({dropoffPct}%)</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recovery Performance */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5" />Recovery Performance</CardTitle>
                <CardDescription>Recovery status distribution and metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(['pending', 'emailed', 'sms_sent', 'recovered', 'expired'] as const).map((status) => {
                    const count = stats.recovery[status];
                    const pct = getRecoveryPercent(status);
                    const config = RECOVERY_STATUS_CONFIG[status];

                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge className={`${config.color} text-xs`}>{config.label}</Badge>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-bold">{count}</span>
                            <span className="text-muted-foreground">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-6 rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              status === 'recovered' ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                              status === 'expired' ? 'bg-gradient-to-r from-red-400 to-red-500' :
                              status === 'pending' ? 'bg-gradient-to-r from-gray-300 to-gray-400' :
                              status === 'emailed' ? 'bg-gradient-to-r from-sky-400 to-sky-500' :
                              'bg-gradient-to-r from-violet-400 to-violet-500'
                            }`}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  <Separator className="my-4" />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Revenue Recovered</p>
                      <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">${stats.totalRevenueRecovered.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950">
                      <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Recovery Rate</p>
                      <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{stats.recoveryRate}%</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Recovery Dialog */}
      <Dialog open={recoverDialog !== null} onOpenChange={(open) => { if (!open) setRecoverDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Recovery Message</DialogTitle>
            <DialogDescription>Send a recovery email or SMS to encourage the guest to complete their booking.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {recoverDialog && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <p><span className="text-muted-foreground">Guest:</span> {recoverDialog.guestEmail || 'Anonymous'}</p>
                <p><span className="text-muted-foreground">Rate:</span> {recoverDialog.selectedRate ? `$${recoverDialog.selectedRate}` : 'N/A'}</p>
                <p><span className="text-muted-foreground">Abandoned at:</span> {STEP_LABELS[recoverDialog.stepAbandoned]?.label}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Recovery Channel</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={recoverChannel === 'email' ? 'default' : 'outline'}
                  className="gap-2"
                  onClick={() => setRecoverChannel('email')}
                >
                  <Mail className="h-4 w-4" /> Email
                </Button>
                <Button
                  variant={recoverChannel === 'sms' ? 'default' : 'outline'}
                  className="gap-2"
                  onClick={() => setRecoverChannel('sms')}
                  disabled={!recoverDialog?.guestPhone}
                >
                  <MessageSquare className="h-4 w-4" /> SMS
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Discount Offer: {recoverOffer}%</Label>
              <input
                type="range"
                min={0}
                max={25}
                step={5}
                value={recoverOffer}
                onChange={(e) => setRecoverOffer(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span className="font-medium text-foreground">{recoverOffer}% off</span>
                <span>25%</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRecoverDialog(null)}>Cancel</Button>
            <Button className="gap-2" onClick={handleRecover}>
              <Send className="h-4 w-4" />
              Send {recoverChannel === 'email' ? 'Email' : 'SMS'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
