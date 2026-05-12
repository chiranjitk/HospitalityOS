'use client';

import { useTranslations } from 'next-intl';

import { useState, useEffect, useCallback } from 'react';
import { usePropertyId } from '@/hooks/use-property';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Loader2,
  CalendarDays,
  Users,
  Clock,
  UserX,
  CheckCircle,
  Ban,
  ArrowRight,
  List,
  LayoutGrid,
  Phone,
  Filter,
  Edit,
} from 'lucide-react';

interface TableInfo {
  id: string;
  number: string;
  name?: string | null;
  capacity: number;
  area?: string | null;
  status: string;
}

interface Reservation {
  id: string;
  propertyId: string;
  tableId?: string | null;
  guestName: string;
  guestPhone: string;
  guestEmail?: string | null;
  partySize: number;
  date: string;
  time: string;
  duration: number;
  specialRequests?: string | null;
  occasion?: string | null;
  status: string;
  source: string;
  notes?: string | null;
  seatedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  table?: TableInfo | null;
}

interface ReservationStats {
  todayTotal: number;
  todayConfirmed: number;
  todaySeated: number;
  todayNoShows: number;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string; bgColor: string }> = {
  pending: { label: 'Pending', variant: 'outline', color: 'text-yellow-700 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-950' },
  confirmed: { label: 'Confirmed', variant: 'outline', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  seated: { label: 'Seated', variant: 'outline', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950' },
  completed: { label: 'Completed', variant: 'secondary', color: 'text-gray-700 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-900' },
  no_show: { label: 'No Show', variant: 'destructive', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950' },
  cancelled: { label: 'Cancelled', variant: 'destructive', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950' },
};

const VALID_TRANSITIONS: Record<string, { action: string; toStatus: string; icon: React.ReactNode; className: string }[]> = {
  pending: [
    { action: 'Confirm', toStatus: 'confirmed', icon: <CheckCircle className="h-3 w-3" />, className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50' },
    { action: 'Cancel', toStatus: 'cancelled', icon: <Ban className="h-3 w-3" />, className: 'text-red-600 hover:text-red-700 hover:bg-red-50' },
  ],
  confirmed: [
    { action: 'Seat', toStatus: 'seated', icon: <ArrowRight className="h-3 w-3" />, className: 'text-green-600 hover:text-green-700 hover:bg-green-50' },
    { action: 'No Show', toStatus: 'no_show', icon: <UserX className="h-3 w-3" />, className: 'text-orange-600 hover:text-orange-700 hover:bg-orange-50' },
    { action: 'Cancel', toStatus: 'cancelled', icon: <Ban className="h-3 w-3" />, className: 'text-red-600 hover:text-red-700 hover:bg-red-50' },
  ],
  seated: [
    { action: 'Complete', toStatus: 'completed', icon: <CheckCircle className="h-3 w-3" />, className: 'text-gray-600 hover:text-gray-700 hover:bg-gray-50' },
    { action: 'No Show', toStatus: 'no_show', icon: <UserX className="h-3 w-3" />, className: 'text-orange-600 hover:text-orange-700 hover:bg-orange-50' },
    { action: 'Cancel', toStatus: 'cancelled', icon: <Ban className="h-3 w-3" />, className: 'text-red-600 hover:text-red-700 hover:bg-red-50' },
  ],
  completed: [],
  no_show: [],
  cancelled: [],
};

const OCCASIONS = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'business', label: 'Business' },
  { value: 'date_night', label: 'Date Night' },
  { value: 'family', label: 'Family' },
  { value: 'other', label: 'Other' },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(time: string) {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

function todayISO() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function Reservations() {
  const { propertyId } = usePropertyId();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReservationStats>({ todayTotal: 0, todayConfirmed: 0, todaySeated: 0, todayNoShows: 0 });

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [guestSearch, setGuestSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(todayISO());

  // Create/Edit dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [formData, setFormData] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    reservationDate: todayISO(),
    reservationTime: '18:00',
    partySize: '2',
    tableId: '',
    specialRequests: '',
    occasion: '',
    notes: '',
  });

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const fetchReservations = useCallback(async () => {
    if (!propertyId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('propertyId', propertyId);
      params.append('limit', limit.toString());
      params.append('page', page.toString());

      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (guestSearch) params.append('guestName', guestSearch);
      if (dateFilter) params.append('date', dateFilter);

      const [resRes, statsRes] = await Promise.all([
        fetch(`/api/reservations?${params.toString()}`),
        fetch(`/api/reservations?propertyId=${propertyId}&stats=true`),
      ]);

      const resData = await resRes.json();
      const statsData = await statsRes.json();

      if (resData.success) {
        setReservations(resData.data);
        setTotalPages(resData.pagination?.totalPages || 1);
      }
      if (statsData.success) {
        setStats(statsData.data);
      }
    } catch (error) {

      toast.error('Failed to fetch reservations');
    } finally {
      setLoading(false);
    }
  }, [propertyId, statusFilter, guestSearch, dateFilter, page]);

  const fetchAvailableTables = useCallback(async () => {
    if (!propertyId) return;
    try {
      const res = await fetch(`/api/tables?propertyId=${propertyId}&status=available&limit=100`);
      const data = await res.json();
      if (data.success) {
        setAvailableTables(data.data);
      }
    } catch (error) {

    }
  }, [propertyId]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  useEffect(() => {
    if (createOpen) fetchAvailableTables();
  }, [createOpen, fetchAvailableTables]);

  const openEditDialog = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setFormData({
      guestName: reservation.guestName,
      guestPhone: reservation.guestPhone,
      guestEmail: reservation.guestEmail || '',
      reservationDate: new Date(reservation.date).toISOString().split('T')[0],
      reservationTime: reservation.time,
      partySize: String(reservation.partySize),
      tableId: reservation.tableId || '',
      specialRequests: reservation.specialRequests || '',
      occasion: reservation.occasion || '',
      notes: reservation.notes || '',
    });
    setCreateOpen(true);
  };

  const closeDialog = () => {
    setCreateOpen(false);
    setEditingReservation(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      guestName: '',
      guestPhone: '',
      guestEmail: '',
      reservationDate: todayISO(),
      reservationTime: '18:00',
      partySize: '2',
      tableId: '',
      specialRequests: '',
      occasion: '',
      notes: '',
    });
  };

  // Create or Update reservation
  const handleCreate = async () => {
    if (!formData.guestName.trim()) {
      toast.error('Guest name is required');
      return;
    }
    if (!formData.guestPhone.trim()) {
      toast.error('Guest phone is required');
      return;
    }
    if (!formData.reservationDate) {
      toast.error('Reservation date is required');
      return;
    }
    if (!formData.reservationTime) {
      toast.error('Reservation time is required');
      return;
    }
    if (parseInt(formData.partySize, 10) < 1) {
      toast.error('Party size must be at least 1');
      return;
    }

    const isEditing = !!editingReservation;

    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        guestName: formData.guestName,
        guestPhone: formData.guestPhone,
        partySize: parseInt(formData.partySize, 10),
        date: formData.reservationDate,
        time: formData.reservationTime,
        specialRequests: formData.specialRequests || undefined,
        occasion: formData.occasion || undefined,
        notes: formData.notes || undefined,
      };

      if (isEditing) {
        body.id = editingReservation.id;
      } else {
        body.propertyId = propertyId;
      }

      if (formData.guestEmail) body.guestEmail = formData.guestEmail;
      if (formData.tableId && formData.tableId !== 'none') body.tableId = formData.tableId;

      const res = await fetch('/api/reservations', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(isEditing ? 'Reservation updated successfully' : 'Reservation created successfully');
        closeDialog();
        fetchReservations();
      } else {
        toast.error(data.error?.message || (isEditing ? 'Failed to update reservation' : 'Failed to create reservation'));
      }
    } catch (error) {

      toast.error(isEditing ? 'Failed to update reservation' : 'Failed to create reservation');
    } finally {
      setCreating(false);
    }
  };

  // Status transition
  const handleStatusTransition = async (reservationId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/reservations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reservationId, status: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Reservation ${newStatus.replace('_', ' ')}`);
        fetchReservations();
      } else {
        toast.error(data.error?.message || 'Failed to update reservation');
      }
    } catch (error) {

      toast.error('Failed to update reservation');
    }
  };

  // Delete (soft cancel)
  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/reservations?id=${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Reservation cancelled');
        fetchReservations();
      } else {
        toast.error(data.error?.message || 'Failed to cancel reservation');
      }
    } catch {
      toast.error('Failed to cancel reservation');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  // Walk-in quick add
  const handleWalkIn = () => {
    setEditingReservation(null);
    resetForm();
    setFormData(prev => ({
      ...prev,
      reservationDate: todayISO(),
      reservationTime: nowTime(),
    }));
    setCreateOpen(true);
  };

  // Group today's reservations by time for timeline
  const todayReservations = reservations.filter(r => {
    const rDate = new Date(r.date).toISOString().split('T')[0];
    return rDate === todayISO();
  });

  const now = new Date();
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Reservations</h1>
        <p className="text-muted-foreground">
          Manage restaurant reservations, track guests, and seat diners
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Reservations</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayTotal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.todayConfirmed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seated Now</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.todaySeated}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No Shows</CardTitle>
            <UserX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.todayNoShows}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by guest name..."
                value={guestSearch}
                onChange={(e) => { setGuestSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-36">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="seated">Seated</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              className="w-full md:w-44"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleWalkIn}>
                <Phone className="h-4 w-4 mr-1" />
                Walk-in
              </Button>
              <Dialog open={createOpen} onOpenChange={(open) => { if (!open) closeDialog(); else if (!editingReservation) { resetForm(); } }}>
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700">
                  <Plus className="h-4 w-4 mr-2" />
                  New Reservation
                </Button>
                <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingReservation ? 'Edit Reservation' : 'New Reservation'}</DialogTitle>
                    <DialogDescription>{editingReservation ? 'Update reservation details' : 'Create a new restaurant reservation'}</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Guest Name *</Label>
                        <Input
                          value={formData.guestName}
                          onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Guest Phone *</Label>
                        <Input
                          value={formData.guestPhone}
                          onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                          placeholder="+1 555 123 4567"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Guest Email</Label>
                        <Input
                          type="email"
                          value={formData.guestEmail}
                          onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                          placeholder="john@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Party Size *</Label>
                        <Select
                          value={formData.partySize}
                          onValueChange={(v) => setFormData({ ...formData, partySize: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map(n => (
                              <SelectItem key={n} value={n.toString()}>{n} {n === 1 ? 'guest' : 'guests'}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date *</Label>
                        <Input
                          type="date"
                          value={formData.reservationDate}
                          onChange={(e) => setFormData({ ...formData, reservationDate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Time *</Label>
                        <Input
                          type="time"
                          value={formData.reservationTime}
                          onChange={(e) => setFormData({ ...formData, reservationTime: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Table (Optional)</Label>
                        <Select
                          value={formData.tableId}
                          onValueChange={(v) => setFormData({ ...formData, tableId: v })}
                        >
                          <SelectTrigger><SelectValue placeholder="Auto-assign" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Auto-assign</SelectItem>
                            {availableTables.map(t => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.number} — {t.capacity} seats{t.area ? ` (${t.area})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Occasion</Label>
                        <Select
                          value={formData.occasion}
                          onValueChange={(v) => setFormData({ ...formData, occasion: v })}
                        >
                          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {OCCASIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Special Requests</Label>
                      <Textarea
                        value={formData.specialRequests}
                        onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                        placeholder="Allergies, dietary requirements, seating preferences..."
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Internal Notes</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Staff-only notes..."
                        rows={2}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                    <Button
                      onClick={handleCreate}
                      disabled={creating}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600"
                    >
                      {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {editingReservation ? 'Save Changes' : 'Create Reservation'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {/* View toggle */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-r-none"
              >
                <List className="h-4 w-4 mr-1" /> List
              </Button>
              <Button
                variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('timeline')}
                className="rounded-l-none"
              >
                <LayoutGrid className="h-4 w-4 mr-1" /> Timeline
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List View */}
      {viewMode === 'list' && (
        <>
          {reservations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Reservations Found</h3>
                <p className="text-muted-foreground text-center">
                  {guestSearch || statusFilter !== 'all' || dateFilter !== todayISO()
                    ? 'Try adjusting your filters'
                    : 'Create your first reservation to get started'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1fr_1fr_0.7fr_0.7fr_0.8fr_1fr_0.6fr_auto] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground">
                <span>Guest</span>
                <span>Date & Time</span>
                <span>Party</span>
                <span>Table</span>
                <span>Status</span>
                <span>Occasion</span>
                <span>Source</span>
                <span className="text-right">Actions</span>
              </div>

              {/* Reservation rows */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {reservations.map((reservation) => {
                  const sc = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.pending;
                  const transitions = VALID_TRANSITIONS[reservation.status] || [];
                  const isPast = new Date(reservation.date) < new Date(todayISO()) && reservation.status === 'confirmed';
                  const timeStr = `${formatDate(reservation.date)} ${formatTime(reservation.time)}`;
                  const isToday = new Date(reservation.date).toISOString().split('T')[0] === todayISO();
                  const isUpcoming = isToday && reservation.time >= currentTimeStr && reservation.status === 'confirmed';

                  return (
                    <Card
                      key={reservation.id}
                      className={`${isUpcoming ? 'ring-1 ring-blue-300 dark:ring-blue-700' : ''} transition-all hover:shadow-sm`}
                    >
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_0.7fr_0.7fr_0.8fr_1fr_0.6fr_auto] gap-2 md:gap-2 items-center">
                          {/* Guest */}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{reservation.guestName}</p>
                            <p className="text-xs text-muted-foreground truncate">{reservation.guestPhone}</p>
                          </div>

                          {/* Date & Time */}
                          <div className="min-w-0">
                            <p className="text-sm">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {timeStr}
                            </p>
                            <p className="text-xs text-muted-foreground">{reservation.duration} min</p>
                          </div>

                          {/* Party Size */}
                          <div>
                            <p className="text-sm">
                              <Users className="h-3 w-3 inline mr-1" />
                              {reservation.partySize}
                            </p>
                          </div>

                          {/* Table */}
                          <div>
                            {reservation.table ? (
                              <Badge variant="outline" className="text-xs">
                                {reservation.table.number}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Unassigned</span>
                            )}
                          </div>

                          {/* Status */}
                          <div>
                            <Badge
                              variant={sc.variant}
                              className={`${sc.color} ${sc.bgColor} border text-xs`}
                            >
                              {sc.label}
                            </Badge>
                            {isUpcoming && (
                              <p className="text-xs text-blue-500 mt-0.5">Upcoming</p>
                            )}
                            {isPast && (
                              <p className="text-xs text-amber-500 mt-0.5">Past due</p>
                            )}
                          </div>

                          {/* Occasion */}
                          <div className="min-w-0">
                            {reservation.occasion ? (
                              <span className="text-xs capitalize">{reservation.occasion.replace('_', ' ')}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                            {reservation.specialRequests && (
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]" title={reservation.specialRequests}>
                                📝 {reservation.specialRequests}
                              </p>
                            )}
                          </div>

                          {/* Source */}
                          <div>
                            <span className="text-xs text-muted-foreground capitalize">{reservation.source}</span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => openEditDialog(reservation)}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                <span className="hidden lg:inline">Edit</span>
                              </Button>
                            )}
                            {transitions.map((t) => (
                              <Button
                                key={t.toStatus}
                                variant="ghost"
                                size="sm"
                                className={`h-7 px-2 text-xs ${t.className}`}
                                onClick={() => handleStatusTransition(reservation.id, t.toStatus)}
                              >
                                {t.icon}
                                <span className="hidden lg:inline ml-1">{t.action}</span>
                              </Button>
                            ))}
                            {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => setDeleteId(reservation.id)}
                              >
                                <Ban className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <>
          {todayReservations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Reservations Today</h3>
                <p className="text-muted-foreground text-center">
                  All reservation slots are open for today
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {(() => {
                // Group by time slot (30 min blocks)
                const grouped: Record<string, Reservation[]> = {};
                todayReservations
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .forEach(r => {
                    // Round to nearest 30 min
                    const [h, m] = r.time.split(':').map(Number);
                    const roundedMin = Math.floor(m / 30) * 30;
                    const slotKey = `${String(h).padStart(2, '0')}:${String(roundedMin).padStart(2, '0')}`;
                    if (!grouped[slotKey]) grouped[slotKey] = [];
                    grouped[slotKey].push(r);
                  });

                return Object.entries(grouped).map(([slot, items]) => {
                  const isCurrentSlot = slot <= currentTimeStr && slot >= currentTimeStr.slice(0, 4) + '0';
                  return (
                    <div key={slot}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`text-sm font-semibold min-w-[60px] ${isCurrentSlot ? 'text-primary' : 'text-muted-foreground'}`}>
                          {formatTime(slot)}
                        </div>
                        <div className={`h-px flex-1 ${isCurrentSlot ? 'bg-primary/30' : 'bg-border'}`} />
                        {isCurrentSlot && (
                          <Badge variant="default" className="text-xs bg-primary">Now</Badge>
                        )}
                      </div>
                      <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ml-[75px]">
                        {items.map((r) => {
                          const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                          const transitions = VALID_TRANSITIONS[r.status] || [];
                          return (
                            <Card key={r.id} className={`border-l-4 ${r.status === 'seated' ? 'border-l-green-500' : r.status === 'confirmed' ? 'border-l-blue-500' : r.status === 'no_show' ? 'border-l-red-500' : r.status === 'cancelled' ? 'border-l-gray-400' : 'border-l-yellow-500'}`}>
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm truncate">{r.guestName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3 inline mr-0.5" />
                                      {formatTime(r.time)} · <Users className="h-3 w-3 inline mr-0.5" />{r.partySize}
                                      {r.table && <> · {r.table.number}</>}
                                    </p>
                                    {r.specialRequests && (
                                      <p className="text-xs text-muted-foreground mt-1 truncate" title={r.specialRequests}>
                                        📝 {r.specialRequests}
                                      </p>
                                    )}
                                    {r.occasion && (
                                      <p className="text-xs mt-0.5">🎂 <span className="capitalize">{r.occasion.replace('_', ' ')}</span></p>
                                    )}
                                  </div>
                                  <Badge variant={sc.variant} className={`${sc.color} ${sc.bgColor} border text-xs shrink-0`}>
                                    {sc.label}
                                  </Badge>
                                </div>
                                {(transitions.length > 0 || (r.status === 'pending' || r.status === 'confirmed')) && (
                                  <div className="flex gap-1 mt-2 pt-2 border-t border-muted">
                                    {(r.status === 'pending' || r.status === 'confirmed') && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                        onClick={() => openEditDialog(r)}
                                      >
                                        <Edit className="h-3 w-3 mr-1" />
                                        Edit
                                      </Button>
                                    )}
                                    {transitions.map(t => (
                                      <Button
                                        key={t.toStatus}
                                        variant="ghost"
                                        size="sm"
                                        className={`h-6 px-2 text-xs ${t.className}`}
                                        onClick={() => handleStatusTransition(r.id, t.toStatus)}
                                      >
                                        {t.icon}
                                        <span className="ml-1">{t.action}</span>
                                      </Button>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Reservation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this reservation? This action can be noted but the reservation will be marked as cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep Reservation</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cancel Reservation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
