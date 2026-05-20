'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Gauge,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  X,
  ShieldCheck,
  BarChart3,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

// =====================================================
// TYPES
// =====================================================

interface BookingLimit {
  id: string;
  tenantId: string;
  propertyId: string | null;
  connectionId: string | null;
  channelCode: string;
  roomTypeId: string | null;
  startDate: string;
  endDate: string;
  maxBookings: number;
  usedBookings: number;
  appliesTo: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  connectionDisplayName: string;
  roomTypeName: string | null;
  utilization: number;
  remaining: number;
  isExceeded: boolean;
  isNearCapacity: boolean;
}

interface LimitStats {
  totalLimits: number;
  activeLimits: number;
  nearCapacity: number;
  exceeded: number;
}

interface ChannelConnection {
  id: string;
  channel: string;
  displayName: string | null;
  status: string;
}

interface RoomType {
  id: string;
  name: string;
  propertyId: string;
}

// =====================================================
// UTILITIES
// =====================================================

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getUtilColor(utilization: number): string {
  if (utilization >= 0.9) return 'text-red-600 dark:text-red-400';
  if (utilization >= 0.7) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function getUtilBarColor(utilization: number): string {
  if (utilization >= 0.9) return 'bg-red-500';
  if (utilization >= 0.7) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getUtilBgColor(utilization: number): string {
  if (utilization >= 0.9) return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800';
  if (utilization >= 0.7) return 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800';
  return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800';
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function ChannelBookingLimits() {
  // State
  const [limits, setLimits] = useState<BookingLimit[]>([]);
  const [stats, setStats] = useState<LimitStats>({ totalLimits: 0, activeLimits: 0, nearCapacity: 0, exceeded: 0 });
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterConnectionId, setFilterConnectionId] = useState<string>('all');
  const [filterRoomTypeId, setFilterRoomTypeId] = useState<string>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLimit, setEditingLimit] = useState<BookingLimit | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  // Form state
  const [formConnectionId, setFormConnectionId] = useState('');
  const [formChannelCode, setFormChannelCode] = useState('');
  const [formRoomTypeId, setFormRoomTypeId] = useState('');
  const [formAppliesTo, setFormAppliesTo] = useState<string>('all_room_types');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formMaxBookings, setFormMaxBookings] = useState(0);
  const [formPriority, setFormPriority] = useState(0);

  // Bulk form state
  const [bulkConnectionId, setBulkConnectionId] = useState('');
  const [bulkChannelCode, setBulkChannelCode] = useState('');
  const [bulkRoomTypeId, setBulkRoomTypeId] = useState('');
  const [bulkAppliesTo, setBulkAppliesTo] = useState<string>('all_room_types');
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [bulkMaxBookings, setBulkMaxBookings] = useState(0);
  const [bulkSaving, setBulkSaving] = useState(false);

  // =====================================================
  // DATA FETCHING
  // =====================================================

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/channels/connections');
      const json = await res.json();
      if (json.success && json.data) {
        const conns = Array.isArray(json.data) ? json.data : (json.data.connections || json.data);
        setConnections(conns);
      }
    } catch {
      // Ignore
    }
  }, []);

  const fetchRoomTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/channels/booking-limits');
      // Room types loaded from a general endpoint if available
      const res2 = await fetch('/api/pms/room-types');
      const json2 = await res2.json();
      if (json2.success && json2.data) {
        const rts = Array.isArray(json2.data) ? json2.data : [];
        setRoomTypes(rts);
      }
    } catch {
      // Ignore
    }
  }, []);

  const fetchLimits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterConnectionId && filterConnectionId !== 'all') params.set('connectionId', filterConnectionId);
      if (filterRoomTypeId && filterRoomTypeId !== 'all') params.set('roomTypeId', filterRoomTypeId);

      const res = await fetch(`/api/channels/booking-limits?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setLimits(json.data.limits || []);
        setStats(json.data.stats || { totalLimits: 0, activeLimits: 0, nearCapacity: 0, exceeded: 0 });
      } else {
        setError(json.error?.message || 'Failed to load booking limits');
      }
    } catch {
      setError('Network error — please retry');
    } finally {
      setLoading(false);
    }
  }, [filterConnectionId, filterRoomTypeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchConnections();
      await fetchRoomTypes();
      if (!cancelled) await fetchLimits();
    })();
    return () => { cancelled = true; };
  }, [fetchConnections, fetchRoomTypes, fetchLimits]);

  // =====================================================
  // FORM HANDLERS
  // =====================================================

  const resetForm = useCallback(() => {
    setFormConnectionId('');
    setFormChannelCode('');
    setFormRoomTypeId('');
    setFormAppliesTo('all_room_types');
    setFormStartDate('');
    setFormEndDate('');
    setFormMaxBookings(0);
    setFormPriority(0);
    setEditingLimit(null);
  }, []);

  const openCreateDialog = useCallback(() => {
    resetForm();
    setDialogOpen(true);
  }, [resetForm]);

  const openEditDialog = useCallback((limit: BookingLimit) => {
    setEditingLimit(limit);
    setFormConnectionId(limit.connectionId || '');
    setFormChannelCode(limit.channelCode);
    setFormRoomTypeId(limit.roomTypeId || '');
    setFormAppliesTo(limit.appliesTo);
    setFormStartDate(new Date(limit.startDate).toISOString().split('T')[0]);
    setFormEndDate(new Date(limit.endDate).toISOString().split('T')[0]);
    setFormMaxBookings(limit.maxBookings);
    setFormPriority(limit.priority);
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formChannelCode || !formStartDate || !formEndDate) {
      toast.error('Channel code, start date, and end date are required');
      return;
    }

    setSaving(true);
    try {
      if (editingLimit) {
        const res = await fetch('/api/channels/booking-limits', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingLimit.id,
            maxBookings: formMaxBookings,
            endDate: formEndDate,
            priority: formPriority,
            appliesTo: formAppliesTo,
          }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success('Booking limit updated');
          setDialogOpen(false);
          fetchLimits();
        } else {
          toast.error(json.error?.message || 'Failed to update');
        }
      } else {
        const res = await fetch('/api/channels/booking-limits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId: formConnectionId || undefined,
            channelCode: formChannelCode,
            roomTypeId: formRoomTypeId || undefined,
            startDate: formStartDate,
            endDate: formEndDate,
            maxBookings: formMaxBookings,
            appliesTo: formAppliesTo,
            priority: formPriority,
          }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success('Booking limit created');
          setDialogOpen(false);
          fetchLimits();
        } else {
          toast.error(json.error?.message || 'Failed to create');
        }
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }, [editingLimit, formChannelCode, formStartDate, formEndDate, formConnectionId, formRoomTypeId, formAppliesTo, formMaxBookings, formPriority, fetchLimits]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/channels/booking-limits?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success('Booking limit deleted');
        fetchLimits();
      } else {
        toast.error(json.error?.message || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    }
  }, [fetchLimits]);

  const handleToggleActive = useCallback(async (limit: BookingLimit) => {
    try {
      const res = await fetch('/api/channels/booking-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: limit.id, isActive: !limit.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(limit.isActive ? 'Limit deactivated' : 'Limit activated');
        fetchLimits();
      } else {
        toast.error(json.error?.message || 'Failed to toggle');
      }
    } catch {
      toast.error('Network error');
    }
  }, [fetchLimits]);

  const handleRecalculate = useCallback(async () => {
    setRecalculating(true);
    try {
      const res = await fetch('/api/channels/booking-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recalculate' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data.message);
        fetchLimits();
      } else {
        toast.error(json.error?.message || 'Recalculation failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setRecalculating(false);
    }
  }, [fetchLimits]);

  // Bulk apply handler
  const handleBulkApply = useCallback(async () => {
    if (!bulkChannelCode || !bulkStartDate || !bulkEndDate) {
      toast.error('Channel code, start date, and end date are required');
      return;
    }

    setBulkSaving(true);
    try {
      const targets: Array<{ roomTypeId?: string; startDate: string; endDate: string }> = [];

      if (bulkAppliesTo === 'all_room_types') {
        // Create one limit per date in range for all room types
        const start = new Date(bulkStartDate);
        const end = new Date(bulkEndDate);
        const cursor = new Date(start);
        while (cursor <= end) {
          targets.push({ startDate: cursor.toISOString().split('T')[0], endDate: cursor.toISOString().split('T')[0] });
          cursor.setDate(cursor.getDate() + 1);
        }
      } else {
        // Create one limit for the date range for a specific room type
        if (!bulkRoomTypeId) {
          toast.error('Select a room type for specific room type mode');
          setBulkSaving(false);
          return;
        }
        targets.push({
          roomTypeId: bulkRoomTypeId,
          startDate: bulkStartDate,
          endDate: bulkEndDate,
        });
      }

      let created = 0;
      let failed = 0;
      for (const target of targets) {
        const res = await fetch('/api/channels/booking-limits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId: bulkConnectionId || undefined,
            channelCode: bulkChannelCode,
            roomTypeId: target.roomTypeId || bulkRoomTypeId || undefined,
            startDate: target.startDate,
            endDate: target.endDate,
            maxBookings: bulkMaxBookings,
            appliesTo: bulkAppliesTo === 'all_room_types' && bulkRoomTypeId ? 'specific_room_type' : bulkAppliesTo,
          }),
        });
        const json = await res.json();
        if (json.success) created++;
        else failed++;
      }

      toast.success(`Bulk apply: ${created} created, ${failed} failed`);
      setBulkDialogOpen(false);
      fetchLimits();
    } catch {
      toast.error('Network error');
    } finally {
      setBulkSaving(false);
    }
  }, [bulkChannelCode, bulkStartDate, bulkEndDate, bulkAppliesTo, bulkRoomTypeId, bulkConnectionId, bulkMaxBookings, fetchLimits]);

  // Connection selection handler for form
  const handleFormConnectionChange = useCallback((val: string) => {
    setFormConnectionId(val);
    const conn = connections.find((c) => c.id === val);
    setFormChannelCode(conn?.channel || '');
  }, [connections]);

  const handleBulkConnectionChange = useCallback((val: string) => {
    setBulkConnectionId(val);
    const conn = connections.find((c) => c.id === val);
    setBulkChannelCode(conn?.channel || '');
  }, [connections]);

  // =====================================================
  // RENDER
  // =====================================================

  if (loading && limits.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Booking Limits</h2>
        </div>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <XCircle className="h-12 w-12 text-red-500" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={fetchLimits}>
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Booking Limits</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Set maximum booking limits per channel to prevent over-consumption
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={recalculating}>
            <RefreshCw className={`h-4 w-4 mr-1 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Recalculating...' : 'Recalculate Usage'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)}>
            <Copy className="h-4 w-4 mr-1" /> Bulk Apply
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1" /> Add Limit
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2.5 dark:bg-blue-950/40">
                <Gauge className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Limits</p>
                <p className="text-2xl font-bold">{stats.totalLimits}</p>
                <p className="text-xs text-muted-foreground">across all channels</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-950/40">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active</p>
                <p className="text-2xl font-bold">{stats.activeLimits}</p>
                <p className="text-xs text-muted-foreground">limits enforced</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-50 p-2.5 dark:bg-amber-950/40">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Near Capacity</p>
                <p className="text-2xl font-bold">{stats.nearCapacity}</p>
                <p className="text-xs text-muted-foreground">70-90% utilized</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-50 p-2.5 dark:bg-red-950/40">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Exceeded</p>
                <p className="text-2xl font-bold">{stats.exceeded}</p>
                <p className="text-xs text-muted-foreground">at or above limit</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={filterConnectionId} onValueChange={setFilterConnectionId}>
                <SelectTrigger className="w-48 h-9 text-sm">
                  <SelectValue placeholder="All Channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  {connections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayName || c.channel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterRoomTypeId} onValueChange={setFilterRoomTypeId}>
                <SelectTrigger className="w-48 h-9 text-sm">
                  <SelectValue placeholder="All Room Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Room Types</SelectItem>
                  {roomTypes.map((rt) => (
                    <SelectItem key={rt.id} value={rt.id}>
                      {rt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={fetchLimits}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Limits Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Channel Booking Limits
            {limits.length > 0 && (
              <Badge variant="secondary" className="text-xs">{limits.length} limits</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {limits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Gauge className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground text-center">
                No booking limits configured.<br />
                Click &quot;Add Limit&quot; to set maximum bookings per channel.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[480px] overflow-auto">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Channel</TableHead>
                    <TableHead className="min-w-[100px]">Room Type</TableHead>
                    <TableHead className="min-w-[180px]">Date Range</TableHead>
                    <TableHead className="text-center min-w-[60px]">Max</TableHead>
                    <TableHead className="text-center min-w-[60px]">Used</TableHead>
                    <TableHead className="text-center min-w-[80px]">Remaining</TableHead>
                    <TableHead className="min-w-[140px]">Utilization</TableHead>
                    <TableHead className="min-w-[90px]">Status</TableHead>
                    <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {limits.map((limit) => {
                    const utilPct = limit.maxBookings > 0 ? Math.round(limit.utilization * 100) : 0;
                    return (
                      <TableRow key={limit.id} className={!limit.isActive ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                              {limit.connectionDisplayName.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm truncate">{limit.connectionDisplayName}</p>
                              <p className="text-[10px] text-muted-foreground">{limit.channelCode}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {limit.roomTypeName || (
                              <Badge variant="outline" className="text-[10px]">All Types</Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(limit.startDate)} — {formatDate(limit.endDate)}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {limit.appliesTo === 'all_room_types' ? 'All room types' : 'Specific type'}
                          </p>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm font-semibold">{limit.maxBookings}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-semibold ${getUtilColor(limit.utilization)}`}>
                            {limit.usedBookings}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm">
                            {limit.remaining === Infinity ? '∞' : limit.remaining}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={Math.min(utilPct, 100)}
                              className="h-2 w-16"
                            />
                            <span className={`text-xs font-medium whitespace-nowrap ${getUtilColor(limit.utilization)}`}>
                              {utilPct}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {limit.isExceeded ? (
                            <Badge variant="destructive" className="text-[10px]">Exceeded</Badge>
                          ) : limit.isNearCapacity ? (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-400 text-[10px]">Near Capacity</Badge>
                          ) : limit.isActive ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400 text-[10px]">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleToggleActive(limit)}
                              title={limit.isActive ? 'Deactivate' : 'Activate'}
                            >
                              <Switch checked={limit.isActive} className="scale-75 pointer-events-none" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openEditDialog(limit)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(limit.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Color Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium">Utilization:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          &lt; 70% (healthy)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-500" />
          70-90% (warning)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500" />
          &gt; 90% (critical)
        </div>
      </div>

      {/* Info Banner */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
            <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">How Booking Limits Work</p>
              <p className="text-xs text-muted-foreground mt-1">
                Booking limits prevent any single channel from consuming too many bookings. When a channel reaches its limit,
                new bookings from that channel will be blocked. Use &quot;Recalculate Usage&quot; to sync actual booking counts.
                Limits can apply to all room types or a specific room type, with date ranges and priorities.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ======================= CREATE/EDIT DIALOG ======================= */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLimit ? 'Edit Booking Limit' : 'Create Booking Limit'}</DialogTitle>
            <DialogDescription>
              {editingLimit
                ? 'Update the booking limit configuration.'
                : 'Set a maximum booking limit for a channel.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Connection */}
            <div className="grid gap-2">
              <Label className="text-sm">Channel Connection</Label>
              <Select value={formConnectionId} onValueChange={handleFormConnectionChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select connection..." />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayName || c.channel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Channel Code (auto-filled or manual) */}
            <div className="grid gap-2">
              <Label className="text-sm">Channel Code</Label>
              <Input
                value={formChannelCode}
                onChange={(e) => setFormChannelCode(e.target.value)}
                placeholder="e.g., booking.com, expedia"
                className="h-9"
                disabled={!!editingLimit}
              />
            </div>

            {/* Applies To */}
            <div className="grid gap-2">
              <Label className="text-sm">Applies To</Label>
              <Select value={formAppliesTo} onValueChange={setFormAppliesTo}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_room_types">All Room Types</SelectItem>
                  <SelectItem value="specific_room_type">Specific Room Type</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Room Type (conditional) */}
            {formAppliesTo === 'specific_room_type' && (
              <div className="grid gap-2">
                <Label className="text-sm">Room Type</Label>
                <Select value={formRoomTypeId} onValueChange={setFormRoomTypeId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select room type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map((rt) => (
                      <SelectItem key={rt.id} value={rt.id}>
                        {rt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-sm">Start Date</Label>
                <Input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="h-9"
                  disabled={!!editingLimit}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm">End Date</Label>
                <Input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Max Bookings */}
            <div className="grid gap-2">
              <Label className="text-sm">Max Bookings</Label>
              <Input
                type="number"
                min={0}
                value={formMaxBookings}
                onChange={(e) => setFormMaxBookings(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-9"
                placeholder="0 = unlimited"
              />
              <p className="text-[10px] text-muted-foreground">Set to 0 for no limit</p>
            </div>

            {/* Priority */}
            <div className="grid gap-2">
              <Label className="text-sm">Priority</Label>
              <Input
                type="number"
                min={0}
                value={formPriority}
                onChange={(e) => setFormPriority(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">Higher priority limits are evaluated first</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingLimit ? 'Update Limit' : 'Create Limit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================= BULK APPLY DIALOG ======================= */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Apply Booking Limits</DialogTitle>
            <DialogDescription>
              Set a booking limit for a channel across all room types or a specific date range.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Connection */}
            <div className="grid gap-2">
              <Label className="text-sm">Channel Connection</Label>
              <Select value={bulkConnectionId} onValueChange={handleBulkConnectionChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select connection..." />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayName || c.channel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Channel Code */}
            <div className="grid gap-2">
              <Label className="text-sm">Channel Code</Label>
              <Input
                value={bulkChannelCode}
                onChange={(e) => setBulkChannelCode(e.target.value)}
                placeholder="e.g., booking.com"
                className="h-9"
              />
            </div>

            {/* Applies To */}
            <div className="grid gap-2">
              <Label className="text-sm">Apply Mode</Label>
              <Select value={bulkAppliesTo} onValueChange={setBulkAppliesTo}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_room_types">All Room Types (per day)</SelectItem>
                  <SelectItem value="specific_room_type">Specific Room Type (date range)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Room Type (conditional) */}
            {bulkAppliesTo === 'specific_room_type' && (
              <div className="grid gap-2">
                <Label className="text-sm">Room Type</Label>
                <Select value={bulkRoomTypeId} onValueChange={setBulkRoomTypeId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select room type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map((rt) => (
                      <SelectItem key={rt.id} value={rt.id}>
                        {rt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-sm">Start Date</Label>
                <Input
                  type="date"
                  value={bulkStartDate}
                  onChange={(e) => setBulkStartDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm">End Date</Label>
                <Input
                  type="date"
                  value={bulkEndDate}
                  onChange={(e) => setBulkEndDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Max Bookings */}
            <div className="grid gap-2">
              <Label className="text-sm">Max Bookings</Label>
              <Input
                type="number"
                min={0}
                value={bulkMaxBookings}
                onChange={(e) => setBulkMaxBookings(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-9"
              />
            </div>

            {/* Bulk summary */}
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-xs font-medium mb-1">Bulk Apply Summary</p>
              {bulkAppliesTo === 'all_room_types' && bulkStartDate && bulkEndDate ? (() => {
                const start = new Date(bulkStartDate);
                const end = new Date(bulkEndDate);
                const days = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
                return (
                  <p className="text-xs text-muted-foreground">
                    Will create <strong>{days}</strong> daily limit(s) across all room types.
                  </p>
                );
              })() : bulkAppliesTo === 'specific_room_type' && bulkRoomTypeId ? (
                <p className="text-xs text-muted-foreground">
                  Will create 1 limit for the selected room type over the date range.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Configure the options above to see the summary.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkApply} disabled={bulkSaving || !bulkChannelCode || !bulkStartDate || !bulkEndDate}>
              {bulkSaving ? 'Applying...' : 'Apply Limits'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ChannelBookingLimits;
