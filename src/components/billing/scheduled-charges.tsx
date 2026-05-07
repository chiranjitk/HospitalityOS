'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Plus,
  Loader2,
  RefreshCw,
  Calendar,
  DollarSign,
  Clock,
  Play,
  Pause,
  Zap,
  History,
  AlertCircle,
  CheckCircle2,
  Timer,
  Repeat,
  CreditCard,
  TrendingUp,
  Eye,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, differenceInHours, differenceInDays } from 'date-fns';

interface Booking {
  id: string;
  confirmationCode: string;
  primaryGuest: { firstName: string; lastName: string };
  room?: { number: string };
}

interface ScheduledCharge {
  id: string;
  description: string;
  bookingId: string;
  folioId?: string;
  amount: number;
  currency: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'once';
  nextExecution?: string;
  startDate: string;
  endDate?: string;
  lastExecution?: string;
  totalExecuted: number;
  status: 'active' | 'paused' | 'completed';
  chargeType: string;
  booking?: Booking;
  folio?: { id: string; folioNumber: string; status: string; balance: number };
  createdAt: string;
}

interface ExecutionHistory {
  id: string;
  scheduledChargeId: string;
  amount: number;
  currency: string;
  executedAt: string;
  status: 'success' | 'failed';
  folioLineItemId?: string;
  error?: string;
}

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'once', label: 'Once' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-emerald-500' },
  { value: 'paused', label: 'Paused', color: 'bg-amber-500' },
  { value: 'completed', label: 'Completed', color: 'bg-gray-500' },
];

export default function ScheduledCharges() {
  const { toast } = useToast();
  const [charges, setCharges] = useState<ScheduledCharge[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<ScheduledCharge | null>(null);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    bookingId: '',
    chargeType: 'room',
    description: '',
    amount: '',
    currency: 'USD',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly' | 'once',
    startDate: '',
    endDate: '',
  });

  // Fetch bookings
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await fetch('/api/bookings?status=checked_in&limit=100');
        const result = await res.json();
        if (result.success) setBookings(result.data || []);
      } catch {
        // silent
      }
    };
    fetchBookings();
  }, []);

  // Fetch charges
  const fetchCharges = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      const res = await fetch(`/api/scheduled-charges?${params.toString()}`);
      const result = await res.json();
      if (result.success) setCharges(result.data || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load scheduled charges', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCharges();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchCharges]);

  // Create charge
  const handleCreate = async () => {
    if (!formData.bookingId || !formData.amount || !formData.startDate || !formData.description) {
      toast({ title: 'Validation Error', description: 'Booking, amount, description, and start date are required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        endDate: formData.endDate || undefined,
      };
      const res = await fetch('/api/scheduled-charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Scheduled charge created' });
        setIsCreateOpen(false);
        resetForm();
        fetchCharges();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create charge', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Pause/Resume
  const handleTogglePause = async (charge: ScheduledCharge) => {
    const action = charge.status === 'active' ? 'pause' : 'resume';
    try {
      const res = await fetch(`/api/scheduled-charges/${charge.id}/${action}`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: `Charge ${action}d` });
        fetchCharges();
      } else {
        toast({ title: 'Error', description: result.error?.message || `Failed to ${action}`, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: `Failed to ${action}`, variant: 'destructive' });
    }
  };

  // Execute now
  const handleExecuteNow = async (chargeId: string) => {
    setIsExecuting(chargeId);
    try {
      const res = await fetch(`/api/scheduled-charges/${chargeId}/execute`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Charge executed successfully' });
        fetchCharges();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to execute', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to execute charge', variant: 'destructive' });
    } finally {
      setIsExecuting(null);
    }
  };

  // View history
  const handleViewHistory = async (charge: ScheduledCharge) => {
    setSelectedCharge(charge);
    setIsLoadingHistory(true);
    setIsHistoryOpen(true);
    try {
      const res = await fetch(`/api/scheduled-charges/${charge.id}/history`);
      const result = await res.json();
      if (result.success) {
        setExecutionHistory(result.data || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load history', variant: 'destructive' });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const resetForm = () => {
    setFormData({ bookingId: '', chargeType: 'room', description: '', amount: '', currency: 'USD', frequency: 'daily', startDate: '', endDate: '' });
  };

  const formatCurrency = (amount: number, currency?: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  };

  const getNextExecutionCountdown = (nextExecution: string) => {
    try {
      const now = new Date();
      const target = new Date(nextExecution);
      if (target <= now) return 'Overdue';
      const hours = differenceInHours(target, now);
      if (hours < 24) return `${hours}h remaining`;
      const days = differenceInDays(target, now);
      return `${days}d remaining`;
    } catch {
      return '';
    }
  };

  const getStatusBadge = (status: string) => {
    const s = STATUS_OPTIONS.find(o => o.value === status);
    return (
      <Badge variant="secondary" className={cn('text-white', s?.color)}>
        {s?.label || status}
      </Badge>
    );
  };

  const getFrequencyBadge = (frequency: string) => {
    const f = FREQUENCIES.find(o => o.value === frequency);
    return (
      <Badge variant="outline" className="text-xs capitalize">
        <Repeat className="h-3 w-3 mr-1" />
        {f?.label || frequency}
      </Badge>
    );
  };

  const filteredCharges = charges.filter(charge => {
    if (activeTab === 'active') return charge.status === 'active';
    if (activeTab === 'history') return charge.status === 'completed' || charge.status === 'paused';
    return true;
  });

  // Summary stats
  const stats = useMemo(() => {
    const activeCharges = charges.filter(c => c.status === 'active');
    const monthlyProjection = activeCharges.reduce((sum, c) => {
      const mul = c.frequency === 'daily' ? 30 : c.frequency === 'weekly' ? 4.3 : c.frequency === 'monthly' ? 1 : 0;
      return sum + (c.amount * mul);
    }, 0);
    const totalExecuted = charges.reduce((sum, c) => sum + c.totalExecuted, 0);
    return {
      totalActive: activeCharges.length,
      monthlyProjection,
      totalExecuted,
    };
  }, [charges]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Scheduled Charges
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage recurring and one-time scheduled charges
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchCharges}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Charge
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10">
              <Zap className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent">
                {stats.totalActive}
              </div>
              <div className="text-xs text-muted-foreground">Total Active</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-violet-500/10">
              <TrendingUp className="h-5 w-5 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-400 bg-clip-text text-transparent">
                {formatCurrency(stats.monthlyProjection)}
              </div>
              <div className="text-xs text-muted-foreground">Monthly Projection</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10">
              <BarChart3 className="h-5 w-5 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-400 bg-clip-text text-transparent">
                {stats.totalExecuted}
              </div>
              <div className="text-xs text-muted-foreground">Total Executed</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search charges..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs & Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">
            <Zap className="h-4 w-4 mr-1.5" />
            Active Charges
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-1.5" />
            History
          </TabsTrigger>
          <TabsTrigger value="all">
            <CreditCard className="h-4 w-4 mr-1.5" />
            All
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCharges.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Repeat className="h-12 w-12 mb-4" />
                  <p>No scheduled charges found</p>
                  <p className="text-sm mt-1">Create a new scheduled charge to get started</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Booking</TableHead>
                        <TableHead>Folio</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Next Execution</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCharges.map((charge) => {
                        const isOverdue = charge.status === 'active' && charge.nextExecution && new Date(charge.nextExecution) < new Date();

                        return (
                          <TableRow
                            key={charge.id}
                            className={cn(
                              'transition-colors hover:bg-muted/50',
                              isOverdue && 'bg-red-50/50 dark:bg-red-950/10',
                            )}
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{charge.description}</p>
                                <p className="text-xs text-muted-foreground capitalize">{charge.chargeType}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {charge.booking ? (
                                <div>
                                  <p className="text-sm font-medium">{charge.booking.confirmationCode}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {charge.booking.primaryGuest?.firstName} {charge.booking.primaryGuest?.lastName}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs text-muted-foreground">
                                {charge.folio?.folioNumber || '—'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-sm">
                                {formatCurrency(charge.amount, charge.currency)}
                              </span>
                            </TableCell>
                            <TableCell>{getFrequencyBadge(charge.frequency)}</TableCell>
                            <TableCell>
                              {charge.nextExecution ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-sm">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    {format(new Date(charge.nextExecution), 'MMM d, yyyy')}
                                  </div>
                                  {charge.status === 'active' && (
                                    <span className={cn(
                                      'text-[10px] font-medium flex items-center gap-1',
                                      isOverdue ? 'text-red-500' : 'text-muted-foreground',
                                    )}>
                                      <Timer className="h-3 w-3" />
                                      {getNextExecutionCountdown(charge.nextExecution)}
                                      {isOverdue && (
                                        <span className="relative flex h-1.5 w-1.5 ml-1">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(charge.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {charge.status === 'active' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleTogglePause(charge)}
                                      title="Pause"
                                    >
                                      <Pause className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleExecuteNow(charge.id)}
                                      disabled={isExecuting === charge.id}
                                      title="Execute Now"
                                    >
                                      {isExecuting === charge.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Play className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  </>
                                )}
                                {charge.status === 'paused' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleTogglePause(charge)}
                                    title="Resume"
                                  >
                                    <Play className="h-3.5 w-3.5 text-emerald-500" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewHistory(charge)}
                                  title="View History"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </div>
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
        </div>
      </Tabs>

      {/* Create Charge Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Scheduled Charge</DialogTitle>
            <DialogDescription>
              Set up a recurring or one-time charge for a booking
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="bookingId">Booking *</Label>
              <Select
                value={formData.bookingId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, bookingId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select booking" />
                </SelectTrigger>
                <SelectContent>
                  {bookings.length === 0 ? (
                    <SelectItem value="_none" disabled>No active bookings</SelectItem>
                  ) : (
                    bookings.map(booking => (
                      <SelectItem key={booking.id} value={booking.id}>
                        {booking.confirmationCode} — {booking.primaryGuest?.firstName} {booking.primaryGuest?.lastName}
                        {booking.room ? ` (Room ${booking.room.number})` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="chargeType">Charge Type</Label>
                <Select
                  value={formData.chargeType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, chargeType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="room">Room</SelectItem>
                    <SelectItem value="food_beverage">Food & Beverage</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="amenity">Amenity</SelectItem>
                    <SelectItem value="laundry">Laundry</SelectItem>
                    <SelectItem value="minibar">Minibar</SelectItem>
                    <SelectItem value="parking">Parking</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency *</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value as 'daily' | 'weekly' | 'monthly' | 'once' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chargeDescription">Description *</Label>
              <Input
                id="chargeDescription"
                placeholder="e.g., Daily room rate charge"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="chargeAmount">Amount *</Label>
                <Input
                  id="chargeAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chargeCurrency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="AED">AED (د.إ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date (optional)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Charge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Execution History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Execution History</DialogTitle>
            <DialogDescription>
              {selectedCharge && (
                <span>
                  {selectedCharge.description} — {formatCurrency(selectedCharge.amount, selectedCharge.currency)} ({selectedCharge.frequency})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px]">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : executionHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mb-2" />
                <p className="text-sm">No execution history</p>
              </div>
            ) : (
              <ScrollArea className="max-h-80">
                <div className="space-y-2">
                  {executionHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border',
                        entry.status === 'success' ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800' : 'bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-800',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {entry.status === 'success' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{formatCurrency(entry.amount, entry.currency)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(entry.executedAt), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-xs text-white',
                            entry.status === 'success' ? 'bg-emerald-500' : 'bg-red-500',
                          )}
                        >
                          {entry.status}
                        </Badge>
                        {entry.error && (
                          <p className="text-xs text-red-500 mt-1 max-w-[150px] truncate">{entry.error}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
