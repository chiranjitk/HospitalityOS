'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CalendarCheck, Plus, Search, Loader2, Eye, RefreshCw,
  CheckCircle, Clock, Users, DollarSign, XCircle, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Experience {
  id: string;
  name: string;
  basePrice: number;
  maxParticipants: number;
}

interface Booking {
  id: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  bookingDate: string;
  bookingTime: string;
  numberOfGuests: number;
  totalPrice: number;
  specialRequests?: string;
  status: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  experience?: Experience;
  createdAt: string;
}

interface Summary {
  totalBookings: number;
  todayBookings: number;
  confirmedBookings: number;
  revenue: number;
}

const statusFlow = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500',
  confirmed: 'bg-blue-500',
  in_progress: 'bg-purple-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const defaultForm = {
  experienceId: '',
  guestName: '',
  guestEmail: '',
  guestPhone: '',
  bookingDate: format(new Date(), 'yyyy-MM-dd'),
  bookingTime: '10:00',
  numberOfGuests: 1,
  specialRequests: '',
};

export default function ExperienceBookings() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expFilter, setExpFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(defaultForm);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (expFilter !== 'all') params.append('experienceId', expFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/experience-bookings?${params}`);
      const result = await res.json();
      if (result.success) {
        setBookings(result.data);
        if (result.summary) setSummary(result.summary);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch bookings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, expFilter, startDate, endDate, toast]);

  const fetchExperiences = useCallback(async () => {
    try {
      const res = await fetch('/api/experiences?status=active');
      const result = await res.json();
      if (result.success) {
        setExperiences(
          result.data.map((e: { id: string; name: string; basePrice: number; maxParticipants: number }) => ({
            id: e.id,
            name: e.name,
            basePrice: e.basePrice,
            maxParticipants: e.maxParticipants,
          }))
        );
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchBookings();
    fetchExperiences();
  }, [fetchBookings, fetchExperiences]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        // Search is client-side filtered
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCreate = async () => {
    if (!formData.experienceId || !formData.guestName || !formData.bookingDate || !formData.bookingTime) {
      toast({
        title: 'Validation Error',
        description: 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (formData.numberOfGuests < 1 || formData.numberOfGuests > 20) {
      toast({
        title: 'Validation Error',
        description: 'Number of guests must be between 1 and 20',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/experience-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Booking created successfully' });
        setIsCreateOpen(false);
        setFormData(defaultForm);
        fetchBookings();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create booking',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create booking',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const res = await fetch('/api/experience-bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const result = await res.json();
      if (result.success) {
        toast({
          title: 'Success',
          description: `Booking ${statusLabels[newStatus]?.toLowerCase() || newStatus}`,
        });
        fetchBookings();
        if (selectedBooking?.id === id) {
          setIsDetailOpen(false);
        }
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update status',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update booking',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = async (id: string) => {
    await handleStatusUpdate(id, 'cancelled');
  };

  const filteredBookings = bookings.filter(
    (b) =>
      !searchQuery ||
      b.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.experience?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.guestEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.guestPhone?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => (
    <Badge
      variant="secondary"
      className={cn('text-white', statusColors[status] || 'bg-gray-500')}
    >
      {statusLabels[status] || status}
    </Badge>
  );

  const getNextAction = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Confirm', icon: CheckCircle, newStatus: 'confirmed', color: 'text-blue-600 dark:text-blue-400' };
      case 'confirmed':
        return { label: 'Start', icon: Clock, newStatus: 'in_progress', color: 'text-purple-600 dark:text-purple-400' };
      case 'in_progress':
        return { label: 'Complete', icon: CheckCircle, newStatus: 'completed', color: 'text-primary' };
      default:
        return null;
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setExpFilter('all');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
  };

  const hasActiveFilters = statusFilter !== 'all' || expFilter !== 'all' || startDate || endDate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Experience Bookings
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage experience reservations and track fulfillment
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchBookings}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setFormData(defaultForm);
              setIsCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <CalendarCheck className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary?.totalBookings ?? 0}</div>
              <div className="text-xs text-muted-foreground">Total Bookings</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary?.todayBookings ?? 0}</div>
              <div className="text-xs text-muted-foreground">Today&apos;s Bookings</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <CheckCircle className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary?.confirmedBookings ?? 0}</div>
              <div className="text-xs text-muted-foreground">Confirmed</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {formatCurrency(summary?.revenue ?? 0)}
              </div>
              <div className="text-xs text-muted-foreground">Revenue</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by guest, experience, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statusFlow.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={expFilter} onValueChange={setExpFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Experience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Experiences</SelectItem>
                {experiences.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && 'bg-muted')}
            >
              <Filter className="h-4 w-4 mr-2" />
              Date Range
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
          {/* Date Range Filters */}
          {showFilters && (
            <div className="flex flex-col sm:flex-row gap-4 mt-4 pt-4 border-t">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full sm:w-44"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full sm:w-44"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CalendarCheck className="h-12 w-12 mb-4" />
              <p className="font-medium">No bookings found</p>
              <p className="text-sm mt-1">
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Create your first booking to get started'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="sm:hidden space-y-3 p-4">
                {filteredBookings.map((b) => {
                  const action = getNextAction(b.status);
                  return (
                    <div key={b.id} className="p-3 rounded-lg border">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{b.guestName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {b.experience?.name}
                          </p>
                        </div>
                        {getStatusBadge(b.status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 mb-2">
                        <span className="flex items-center gap-1">
                          <CalendarCheck className="h-3 w-3" />
                          {format(new Date(b.bookingDate), 'MMM d')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {b.bookingTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {b.numberOfGuests}
                        </span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(b.totalPrice)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8"
                          onClick={() => {
                            setSelectedBooking(b);
                            setIsDetailOpen(true);
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        {action && (
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn('flex-1 h-8', action.color)}
                            onClick={() => handleStatusUpdate(b.id, action.newStatus)}
                          >
                            {action.label}
                          </Button>
                        )}
                        {b.status !== 'cancelled' && b.status !== 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-red-500 hover:text-red-600"
                            onClick={() => handleCancel(b.id)}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">ID</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead>Experience</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Guests</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings.map((b) => {
                        const action = getNextAction(b.status);
                        return (
                          <TableRow key={b.id}>
                            <TableCell>
                              <span className="text-xs text-muted-foreground font-mono">
                                {b.id.slice(0, 8)}...
                              </span>
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{b.guestName}</p>
                              {b.guestEmail && (
                                <p className="text-xs text-muted-foreground">{b.guestEmail}</p>
                              )}
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{b.experience?.name || '-'}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">
                                {format(new Date(b.bookingDate), 'MMM d, yyyy')}
                              </p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{b.bookingTime}</p>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{b.numberOfGuests}</span>
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(b.status)}</TableCell>
                            <TableCell className="text-right">
                              <span className="font-medium">
                                {formatCurrency(b.totalPrice)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedBooking(b);
                                    setIsDetailOpen(true);
                                  }}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                {action && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(action.color)}
                                    onClick={() => handleStatusUpdate(b.id, action.newStatus)}
                                  >
                                    {action.label}
                                  </Button>
                                )}
                                {b.status !== 'cancelled' && b.status !== 'completed' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600"
                                    onClick={() => handleCancel(b.id)}
                                  >
                                    <XCircle className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Booking Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Experience Booking</DialogTitle>
            <DialogDescription>Book a guest for an experience</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Experience *</Label>
              <Select
                value={formData.experienceId}
                onValueChange={(v) => setFormData((p) => ({ ...p, experienceId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select experience" />
                </SelectTrigger>
                <SelectContent>
                  {experiences.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} ({formatCurrency(e.basePrice)}/guest)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Guest Name *</Label>
              <Input
                placeholder="Full name"
                value={formData.guestName}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, guestName: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="guest@email.com"
                  value={formData.guestEmail}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, guestEmail: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="+1 234 567 8900"
                  value={formData.guestPhone}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, guestPhone: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.bookingDate}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, bookingDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Time *</Label>
                <Input
                  type="time"
                  value={formData.bookingTime}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, bookingTime: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Guests (1-20)</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={formData.numberOfGuests}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      numberOfGuests: Math.min(20, Math.max(1, parseInt(e.target.value) || 1)),
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Special Requests</Label>
              <Textarea
                placeholder="Any dietary restrictions, accessibility needs, etc."
                value={formData.specialRequests}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, specialRequests: e.target.value }))
                }
                rows={3}
              />
            </div>
            {/* Price preview */}
            {formData.experienceId && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Total</span>
                  <span className="font-semibold">
                    {formatCurrency(
                      (experiences.find((e) => e.id === formData.experienceId)?.basePrice || 0) *
                      formData.numberOfGuests
                    )}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.numberOfGuests} guest{formData.numberOfGuests > 1 ? 's' : ''} &times; {formatCurrency(experiences.find((e) => e.id === formData.experienceId)?.basePrice || 0)}/guest
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booking Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">
                  {selectedBooking.id.slice(0, 8)}...
                </span>
                {getStatusBadge(selectedBooking.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Experience</span>
                  <p className="font-medium">{selectedBooking.experience?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Guest</span>
                  <p className="font-medium">{selectedBooking.guestName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date</span>
                  <p className="font-medium">
                    {format(new Date(selectedBooking.bookingDate), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Time</span>
                  <p className="font-medium">{selectedBooking.bookingTime}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Guests</span>
                  <p className="font-medium flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {selectedBooking.numberOfGuests}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount</span>
                  <p className="font-medium">{formatCurrency(selectedBooking.totalPrice)}</p>
                </div>
              </div>

              {/* Contact Info */}
              {(selectedBooking.guestEmail || selectedBooking.guestPhone) && (
                <div className="text-sm space-y-1 p-3 bg-muted rounded-lg">
                  {selectedBooking.guestEmail && (
                    <p className="text-muted-foreground">{selectedBooking.guestEmail}</p>
                  )}
                  {selectedBooking.guestPhone && (
                    <p className="text-muted-foreground">{selectedBooking.guestPhone}</p>
                  )}
                </div>
              )}

              {/* Special Requests */}
              {selectedBooking.specialRequests && (
                <div>
                  <span className="text-sm text-muted-foreground">Special Requests</span>
                  <p className="text-sm p-3 bg-muted rounded-lg mt-1">
                    {selectedBooking.specialRequests}
                  </p>
                </div>
              )}

              {/* Cancellation Reason */}
              {selectedBooking.cancellationReason && (
                <div>
                  <span className="text-sm text-muted-foreground">Cancellation Reason</span>
                  <p className="text-sm p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg mt-1 text-red-700 dark:text-red-400">
                    {selectedBooking.cancellationReason}
                  </p>
                </div>
              )}

              {/* Timestamps */}
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Created: {format(new Date(selectedBooking.createdAt), 'MMM d, yyyy HH:mm')}</p>
                {selectedBooking.confirmedAt && (
                  <p>Confirmed: {format(new Date(selectedBooking.confirmedAt), 'MMM d, yyyy HH:mm')}</p>
                )}
                {selectedBooking.completedAt && (
                  <p>Completed: {format(new Date(selectedBooking.completedAt), 'MMM d, yyyy HH:mm')}</p>
                )}
                {selectedBooking.cancelledAt && (
                  <p>Cancelled: {format(new Date(selectedBooking.cancelledAt), 'MMM d, yyyy HH:mm')}</p>
                )}
              </div>

              {/* Status Flow Actions */}
              {selectedBooking.status !== 'completed' && selectedBooking.status !== 'cancelled' && (
                <div className="flex gap-2 pt-2">
                  {getNextAction(selectedBooking.status) && (
                    <Button
                      className="flex-1"
                      onClick={() =>
                        handleStatusUpdate(
                          selectedBooking.id,
                          getNextAction(selectedBooking.status)!.newStatus
                        )
                      }
                    >
                      {getNextAction(selectedBooking.status)?.label}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleCancel(selectedBooking.id)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
