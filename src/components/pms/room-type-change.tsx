'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  ArrowRightLeft,
  Plus,
  Search,
  Eye,
  Loader2,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  History,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PropertyInfo {
  id: string;
  name: string;
}

interface RoomInfo {
  id: string;
  number: string;
  floor: number;
  status: string;
  roomTypeId?: string;
}

interface RoomTypeInfo {
  id: string;
  name: string;
  code: string;
  basePrice: number;
}

interface RoomTypeChangeRecord {
  id: string;
  roomId: string;
  oldRoomTypeId: string;
  newRoomTypeId: string;
  reason: string | null;
  rateDifference: number;
  chargeApplied: boolean;
  chargeAmount: number;
  status: string;
  requestedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
  room: RoomInfo | null;
  oldRoomType: RoomTypeInfo | null;
  newRoomType: RoomTypeInfo | null;
}

// ─── Status Config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  requested: { label: 'Pending', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  approved: { label: 'Approved', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', icon: CheckCircle2 },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function RoomTypeChange() {
  const [changes, setChanges] = useState<RoomTypeChangeRecord[]>([]);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeInfo[]>([]);
  const [properties, setProperties] = useState<PropertyInfo[]>([]);
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('requests');

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedChange, setSelectedChange] = useState<RoomTypeChangeRecord | null>(null);

  // Create form
  const [formData, setFormData] = useState({
    roomId: '',
    newRoomTypeId: '',
    reason: '',
    notes: '',
  });

  // Stats
  const stats = {
    pending: changes.filter(c => c.status === 'requested').length,
    approved: changes.filter(c => c.status === 'approved').length,
    completed: changes.filter(c => c.status === 'completed').length,
    total: changes.length,
  };

  // ─── Fetch Data ───────────────────────────────────────────────────────

  // Fetch properties
  useEffect(() => {
    const controller = new AbortController();
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setProperties(result.data || []);
          }
        }
      } catch (error) {
        console.error('Operation failed:', error);
      }
    };
    fetchProperties();
    return () => controller.abort('Component cleanup');
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (search) params.append('search', search);
      if (selectedProperty !== 'all') params.append('propertyId', selectedProperty);

      const response = await fetch(`/api/pms/room-type-change?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setChanges(data.data || []);
        if (data.meta) {
          setRooms(data.meta.rooms || []);
          setRoomTypes(data.meta.roomTypes || []);
        }
      }
    } catch (error) {
      toast.error('Failed to fetch room type changes');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, selectedProperty]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void fetchData();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── Computed ─────────────────────────────────────────────────────────
  const selectedRoom = rooms.find(r => r.id === formData.roomId);
  const selectedNewType = roomTypes.find(t => t.id === formData.newRoomTypeId);
  const currentRoomType = selectedRoom ? roomTypes.find(t => t.id === selectedRoom.roomTypeId) : null;

  const rateDiffPreview = (() => {
    if (!currentRoomType || !selectedNewType) return null;
    return selectedNewType.basePrice - currentRoomType.basePrice;
  })();

  const changeType = (() => {
    if (!rateDiffPreview) return null;
    if (rateDiffPreview > 0) return 'upgrade' as const;
    if (rateDiffPreview < 0) return 'downgrade' as const;
    return 'lateral' as const;
  })();

  // ─── Actions ──────────────────────────────────────────────────────────
  const handleOpenCreateDialog = () => {
    setFormData({ roomId: '', newRoomTypeId: '', reason: '', notes: '' });
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.roomId || !formData.newRoomTypeId) {
      toast.error('Please select a room and new room type');
      return;
    }

    if (!selectedRoom) {
      toast.error('Room not found');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/pms/room-type-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: formData.roomId,
          oldRoomTypeId: selectedRoom.roomTypeId,
          newRoomTypeId: formData.newRoomTypeId,
          reason: formData.reason,
          notes: formData.notes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Room type change request created');
        setCreateDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to create request');
      }
    } catch (error) {
      toast.error('Failed to create room type change request');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/pms/room-type-change/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Room type change approved');
        fetchData();
        if (viewDialogOpen) setViewDialogOpen(false);
      } else {
        toast.error(data.error || 'Failed to approve');
      }
    } catch {
      toast.error('Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (id: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/pms/room-type-change/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Room type change completed — room updated');
        fetchData();
        if (viewDialogOpen) setViewDialogOpen(false);
      } else {
        toast.error(data.error || 'Failed to complete');
      }
    } catch {
      toast.error('Failed to complete');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (id: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/pms/room-type-change/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Room type change rejected');
        fetchData();
        if (viewDialogOpen) setViewDialogOpen(false);
      } else {
        toast.error(data.error || 'Failed to reject');
      }
    } catch {
      toast.error('Failed to reject');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedChange) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/pms/room-type-change/${selectedChange.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Room type change request cancelled');
        setCancelDialogOpen(false);
        setSelectedChange(null);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to cancel');
      }
    } catch {
      toast.error('Failed to cancel');
    } finally {
      setSaving(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.requested;
    const Icon = config.icon;
    return (
      <Badge className={cn('text-xs font-medium gap-1', config.color)}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getChangeTypeInfo = (record: RoomTypeChangeRecord) => {
    if (record.rateDifference > 0) return { label: 'Upgrade', color: 'text-emerald-600 dark:text-emerald-400', Icon: ArrowUpRight };
    if (record.rateDifference < 0) return { label: 'Downgrade', color: 'text-orange-600 dark:text-orange-400', Icon: ArrowDownRight };
    return { label: 'Lateral', color: 'text-slate-600 dark:text-slate-400', Icon: ArrowRightLeft };
  };

  // ─── Main Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-primary" />
            Room Type Changes
          </h2>
          <p className="text-muted-foreground">Manage room type changes during guest stays</p>
        </div>
        <Button onClick={handleOpenCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Changes</div>
              <div className="text-xl font-bold">{stats.total}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Pending</div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-sky-500/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10">
              <CheckCircle2 className="h-5 w-5 text-sky-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Approved</div>
              <div className="text-xl font-bold text-sky-600 dark:text-sky-400">{stats.approved}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Completed</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs with Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'requests' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('requests')}
          >
            <ArrowRightLeft className="h-4 w-4 mr-1.5" />
            Requests
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('history')}
          >
            <History className="h-4 w-4 mr-1.5" />
            History
          </Button>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full sm:w-56"
            />
          </div>
          {properties.length > 1 && (
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : changes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ArrowRightLeft className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No room type change requests</p>
                <p className="text-sm mt-1">Click &quot;New Request&quot; to create one</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room</TableHead>
                      <TableHead className="hidden sm:table-cell">Old Type</TableHead>
                      <TableHead className="hidden sm:table-cell">New Type</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead className="text-right hidden md:table-cell">Rate Diff</TableHead>
                      <TableHead className="hidden lg:table-cell">Requested</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {changes.map((record) => {
                      const ctInfo = getChangeTypeInfo(record);
                      return (
                        <TableRow key={record.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-sm">
                              {record.room?.number || '—'}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">
                              Floor {record.room?.floor || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">
                            {record.oldRoomType?.name || '—'}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm font-medium">
                            {record.newRoomType?.name || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-xs gap-1', ctInfo.color)}>
                              <ctInfo.Icon className="h-3 w-3" />
                              {ctInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className={cn(
                            'text-right hidden md:table-cell text-sm font-medium',
                            record.rateDifference > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                            record.rateDifference < 0 ? 'text-orange-600 dark:text-orange-400' :
                            'text-muted-foreground',
                          )}>
                            {record.rateDifference > 0 ? '+' : ''}{formatCurrency(record.rateDifference)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {formatDate(record.createdAt)}
                          </TableCell>
                          <TableCell>{renderStatusBadge(record.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedChange(record); setViewDialogOpen(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {record.status === 'requested' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-sky-600 hover:text-sky-700"
                                    onClick={() => handleApprove(record.id)}
                                    disabled={saving}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => handleReject(record.id)}
                                    disabled={saving}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {record.status === 'approved' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-emerald-600 hover:text-emerald-700"
                                  onClick={() => handleComplete(record.id)}
                                  disabled={saving}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
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
            )}
          </CardContent>
        </Card>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card>
          <CardContent className="pt-6">
            {changes.filter(c => c.status === 'completed' || c.status === 'rejected').length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No completed or rejected changes</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-4">
                  {changes
                    .filter(c => c.status === 'completed' || c.status === 'rejected')
                    .map((record) => {
                      const ctInfo = getChangeTypeInfo(record);
                      return (
                        <div key={record.id} className="flex gap-3 items-start">
                          <div className="shrink-0 mt-1">
                            <div className={cn(
                              'w-2 h-2 rounded-full',
                              record.status === 'completed' ? 'bg-emerald-500' : 'bg-red-500',
                            )} />
                          </div>
                          <div className="flex-1 pb-4 border-l-2 border-muted pl-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <span className="font-medium text-sm flex items-center gap-2">
                                Room {record.room?.number}: {record.oldRoomType?.name}
                                <ChevronRight className="h-3 w-3" />
                                {record.newRoomType?.name}
                                <Badge variant="outline" className={cn('text-xs gap-1', ctInfo.color)}>
                                  <ctInfo.Icon className="h-3 w-3" />
                                  {ctInfo.label}
                                </Badge>
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(record.createdAt)}
                              </span>
                            </div>
                            {record.reason && (
                              <p className="text-sm text-muted-foreground mt-0.5">{record.reason}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Rate difference: {record.rateDifference > 0 ? '+' : ''}{formatCurrency(record.rateDifference)}
                              {record.completedAt && ` · Completed ${formatDate(record.completedAt)}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              New Room Type Change
            </DialogTitle>
            <DialogDescription>
              Select a room and the new room type to create a change request.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Room Selection */}
            <div className="space-y-2">
              <Label>Room *</Label>
              <Select value={formData.roomId} onValueChange={(v) => setFormData({ ...formData, roomId: v, newRoomTypeId: '' })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms
                    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        Room {r.number} (Floor {r.floor}) — {roomTypes.find(t => t.id === r.roomTypeId)?.name || 'Unknown'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Current Room Type Display */}
            {currentRoomType && (
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Current Room Type</div>
                <div className="font-medium">{currentRoomType.name} ({currentRoomType.code})</div>
                <div className="text-sm text-muted-foreground">Base rate: {formatCurrency(currentRoomType.basePrice)}/night</div>
              </div>
            )}

            {/* New Room Type Selection */}
            <div className="space-y-2">
              <Label>New Room Type *</Label>
              <Select value={formData.newRoomTypeId} onValueChange={(v) => setFormData({ ...formData, newRoomTypeId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new room type" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes
                    .filter(t => t.id !== selectedRoom?.roomTypeId)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.code}) — {formatCurrency(t.basePrice)}/night
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rate Difference Preview */}
            {rateDiffPreview !== null && changeType && (
              <div className={cn(
                'rounded-lg p-3 flex items-center gap-3',
                changeType === 'upgrade' ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800' :
                changeType === 'downgrade' ? 'bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800' :
                'bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800',
              )}>
                {changeType === 'upgrade' ? <ArrowUpRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" /> :
                 changeType === 'downgrade' ? <ArrowDownRight className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" /> :
                 <ArrowRightLeft className="h-5 w-5 text-slate-600 dark:text-slate-400 shrink-0" />}
                <div className="text-sm">
                  <span className={cn('font-medium capitalize', changeType === 'upgrade' ? 'text-emerald-700 dark:text-emerald-300' : changeType === 'downgrade' ? 'text-orange-700 dark:text-orange-300' : 'text-slate-700 dark:text-slate-300')}>
                    {changeType}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    Rate difference: {rateDiffPreview > 0 ? '+' : ''}{formatCurrency(rateDiffPreview)}/night
                  </span>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label>Reason *</Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Why is this room type change needed?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !formData.roomId || !formData.newRoomTypeId || !formData.reason}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Detail Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Room Type Change Detail
            </DialogTitle>
            <DialogDescription>
              Room {selectedChange?.room?.number || 'Unknown'}
            </DialogDescription>
          </DialogHeader>
          {selectedChange && (() => {
            const ctInfo = getChangeTypeInfo(selectedChange);
            return (
              <div className="space-y-4 py-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  {renderStatusBadge(selectedChange.status)}
                  <Badge variant="outline" className={cn('text-xs gap-1', ctInfo.color)}>
                    <ctInfo.Icon className="h-3.5 w-3.5" />
                    {ctInfo.label}
                  </Badge>
                </div>

                {/* Room Change Visual */}
                <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
                  <div className="rounded-lg border-2 border-muted p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Current Type</div>
                    <div className="font-semibold">{selectedChange.oldRoomType?.name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{selectedChange.oldRoomType?.code}</div>
                    <div className="text-sm font-medium mt-2">{formatCurrency(selectedChange.oldRoomType?.basePrice || 0)}<span className="text-xs text-muted-foreground">/night</span></div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="p-2 rounded-full bg-primary/10">
                      <ArrowRightLeft className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <div className="rounded-lg border-2 border-primary/50 p-4 text-center bg-primary/5">
                    <div className="text-xs text-primary mb-1">New Type</div>
                    <div className="font-semibold text-primary">{selectedChange.newRoomType?.name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{selectedChange.newRoomType?.code}</div>
                    <div className="text-sm font-medium mt-2">{formatCurrency(selectedChange.newRoomType?.basePrice || 0)}<span className="text-xs text-muted-foreground">/night</span></div>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Room:</span>
                    <span className="ml-1 font-medium">#{selectedChange.room?.number} (Floor {selectedChange.room?.floor})</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rate Difference:</span>
                    <span className={cn('ml-1 font-medium', ctInfo.color)}>
                      {selectedChange.rateDifference > 0 ? '+' : ''}{formatCurrency(selectedChange.rateDifference)}/night
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Requested:</span>
                    <span className="ml-1">{formatDate(selectedChange.createdAt)}</span>
                  </div>
                  {selectedChange.approvedAt && (
                    <div>
                      <span className="text-muted-foreground">Approved:</span>
                      <span className="ml-1">{formatDate(selectedChange.approvedAt)}</span>
                    </div>
                  )}
                  {selectedChange.completedAt && (
                    <div>
                      <span className="text-muted-foreground">Completed:</span>
                      <span className="ml-1">{formatDate(selectedChange.completedAt)}</span>
                    </div>
                  )}
                </div>

                {selectedChange.reason && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Reason</Label>
                    <div className="text-sm bg-muted p-3 rounded-lg">{selectedChange.reason}</div>
                  </div>
                )}

                {selectedChange.notes && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Notes</Label>
                    <div className="text-sm bg-muted p-3 rounded-lg">{selectedChange.notes}</div>
                  </div>
                )}

                {/* Actions */}
                <Separator />
                <div className="flex justify-between gap-2">
                  {selectedChange.status === 'requested' && (
                    <>
                      <Button
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => { setCancelDialogOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => handleReject(selectedChange.id)}
                          disabled={saving}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          onClick={() => handleApprove(selectedChange.id)}
                          disabled={saving}
                        >
                          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                      </div>
                    </>
                  )}
                  {selectedChange.status === 'approved' && (
                    <div className="flex justify-end">
                      <Button
                        onClick={() => handleComplete(selectedChange.id)}
                        disabled={saving}
                      >
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Complete Change
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Change Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this room type change request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-500 hover:bg-red-600"
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
