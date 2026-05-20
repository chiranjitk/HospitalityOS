'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  RefreshCw,
  Check,
  X,
  Clock,
  Calendar,
  AlertTriangle,
  ArrowUpDown,
  ArrowRight,
  Users,
  DollarSign,
  BedDouble,
  Tag,
  FileText,
  Sparkles,
  ShieldCheck,
  ShieldX,
  Zap,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { useTranslations } from 'next-intl';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface BookingModificationItem {
  id: string;
  tenantId: string;
  propertyId: string | null;
  connectionId: string | null;
  channelCode: string;
  bookingId: string | null;
  channelBookingRef: string | null;
  modificationType: string;
  previousValue: string | null;
  newValue: string | null;
  previousCheckIn: string | null;
  newCheckIn: string | null;
  previousCheckOut: string | null;
  newCheckOut: string | null;
  previousRoomType: string | null;
  newRoomType: string | null;
  previousAdults: number | null;
  newAdults: number | null;
  previousChildren: number | null;
  newChildren: number | null;
  previousRate: number | null;
  newRate: number | null;
  priceDifference: number;
  status: string;
  autoApply: boolean;
  requiresApproval: boolean;
  requestedAt: string;
  processedAt: string | null;
  processedBy: string | null;
  rejectionReason: string | null;
  channelResponse: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ModificationStats {
  pending: number;
  approved: number;
  rejected: number;
  applied: number;
  failed: number;
  [key: string]: number;
}

const MODIFICATION_TYPE_LABELS: Record<string, string> = {
  date_change: 'Date Change',
  room_change: 'Room Change',
  guest_change: 'Guest Change',
  rate_change: 'Rate Change',
  addon_change: 'Addon Change',
  cancellation_part: 'Partial Cancel',
  name_change: 'Name Change',
  special_request: 'Special Request',
};

const MODIFICATION_TYPE_ICONS: Record<string, React.ElementType> = {
  date_change: Calendar,
  room_change: BedDouble,
  guest_change: Users,
  rate_change: DollarSign,
  addon_change: Tag,
  cancellation_part: X,
  name_change: FileText,
  special_request: Sparkles,
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────
export default function BookingModifications() {
  const t = useTranslations('channels');
  const { formatCurrency } = useCurrency();
  const { formatDate } = useTimezone();

  const [modifications, setModifications] = useState<BookingModificationItem[]>([]);
  const [stats, setStats] = useState<ModificationStats>({ pending: 0, approved: 0, rejected: 0, applied: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  // Dialogs
  const [detailItem, setDetailItem] = useState<BookingModificationItem | null>(null);
  const [rejectItem, setRejectItem] = useState<BookingModificationItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('modificationType', typeFilter);
      if (channelFilter !== 'all') params.set('channelCode', channelFilter);

      const response = await fetch(`/api/channels/booking-modifications?${params}`);
      const result = await response.json();

      if (result.success) {
        setModifications(result.data || []);
        setStats(result.stats || {});
        if (result.pagination) {
          setTotalPages(result.pagination.pages || 1);
          setTotal(result.pagination.total || 0);
        }
      } else {
        toast.error('Failed to load booking modifications');
      }
    } catch (error) {
      console.error('Error fetching booking modifications:', error);
      toast.error('Failed to load booking modifications');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, channelFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [statusFilter, typeFilter, channelFilter]);

  // ── Actions ──
  const handleApprove = async (item: BookingModificationItem) => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/channels/booking-modifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, action: 'approve' }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Modification approved and applied');
        setDetailItem(null);
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to approve');
      }
    } catch {
      toast.error('Failed to approve modification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectItem || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch('/api/channels/booking-modifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rejectItem.id, action: 'reject', rejectionReason: rejectReason }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Modification rejected');
        setRejectItem(null);
        setRejectReason('');
        setDetailItem(null);
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to reject');
      }
    } catch {
      toast.error('Failed to reject modification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApply = async (item: BookingModificationItem) => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/channels/booking-modifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, action: 'apply' }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Modification applied successfully');
        setDetailItem(null);
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to apply');
      }
    } catch {
      toast.error('Failed to apply modification');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Helpers ──
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
            <Clock className="h-3 w-3 mr-1" />Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800">
            <ShieldCheck className="h-3 w-3 mr-1" />Approved
          </Badge>
        );
      case 'applied':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
            <Check className="h-3 w-3 mr-1" />Applied
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">
            <ShieldX className="h-3 w-3 mr-1" />Rejected
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">
            <X className="h-3 w-3 mr-1" />Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getChangeSummary = (item: BookingModificationItem): string => {
    switch (item.modificationType) {
      case 'date_change':
        return `Check-in/out dates changed`;
      case 'room_change':
        return `${item.previousRoomType || 'N/A'} → ${item.newRoomType || 'N/A'}`;
      case 'guest_change':
        return `Guests: ${item.previousAdults ?? '?'}/${item.previousChildren ?? 0} → ${item.newAdults ?? '?'}/${item.newChildren ?? 0}`;
      case 'rate_change':
        return `${formatCurrency(item.previousRate || 0)} → ${formatCurrency(item.newRate || 0)}`;
      case 'addon_change':
        return item.newValue || 'Add-on change';
      case 'name_change':
        return `${item.previousValue || 'N/A'} → ${item.newValue || 'N/A'}`;
      case 'special_request':
        return item.newValue || 'Special request';
      case 'cancellation_part':
        return `Partial cancellation`;
      default:
        return 'Modification';
    }
  };

  const getTypeIcon = (type: string) => {
    const Icon = MODIFICATION_TYPE_ICONS[type] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  const activePendingCount = stats.pending || 0;

  // ── Unique channels for filter ──
  const uniqueChannels = [...new Set(modifications.map(m => m.channelCode))];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Booking Modifications</h1>
          <p className="text-muted-foreground">
            Handle OTA booking amendments — date, room, guest, and rate changes
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <ArrowUpDown className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activePendingCount}</p>
                <p className="text-xs text-muted-foreground">Pending Approval</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.applied || 0}</p>
                <p className="text-xs text-muted-foreground">Applied</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <ShieldX className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.rejected || 0}</p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Zap className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{modifications.filter(m => m.autoApply).length}</p>
                <p className="text-xs text-muted-foreground">Auto-Applied</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Channel</Label>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  {uniqueChannels.map(ch => (
                    <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(MODIFICATION_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(statusFilter !== 'all' || typeFilter !== 'all' || channelFilter !== 'all') && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9"
                  onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setChannelFilter('all'); }}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modifications Table */}
      <Card>
        <CardContent className="p-0">
          {modifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ArrowUpDown className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-medium">No booking modifications found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Modifications from OTA channels will appear here
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[520px]">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Date</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Booking Ref</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="min-w-[180px]">Change Summary</TableHead>
                    <TableHead className="text-right">Price Diff</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modifications.map((item) => (
                    <TableRow key={item.id} className="group">
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(new Date(item.requestedAt))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {item.channelCode}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-mono">{item.channelBookingRef || item.bookingId?.slice(0, 8) || 'N/A'}</span>
                          {item.autoApply && (
                            <Badge variant="outline" className="text-cyan-600 dark:text-cyan-400 mt-0.5 text-[10px] w-fit">
                              <Zap className="h-2.5 w-2.5 mr-0.5" />Auto
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getTypeIcon(item.modificationType)}
                          <span className="text-sm">
                            {MODIFICATION_TYPE_LABELS[item.modificationType] || item.modificationType}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {getChangeSummary(item)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.priceDifference > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{formatCurrency(item.priceDifference)}
                          </span>
                        ) : item.priceDifference < 0 ? (
                          <span className="text-red-600 dark:text-red-400">
                            {formatCurrency(item.priceDifference)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailItem(item)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── Detail Dialog ── */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailItem && getTypeIcon(detailItem.modificationType)}
              {detailItem ? MODIFICATION_TYPE_LABELS[detailItem.modificationType] || 'Modification' : ''} Details
            </DialogTitle>
            <DialogDescription>
              Full before/after comparison for this modification
            </DialogDescription>
          </DialogHeader>

          {detailItem && (
            <div className="space-y-4">
              {/* Status & Meta */}
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(detailItem.status)}
                <Badge variant="outline">{detailItem.channelCode}</Badge>
                {detailItem.autoApply && (
                  <Badge variant="outline" className="text-cyan-600 dark:text-cyan-400">
                    <Zap className="h-3 w-3 mr-1" />Auto-Apply
                  </Badge>
                )}
              </div>

              {/* Change Details */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Change Details
                </h4>

                {/* Date Change */}
                {detailItem.modificationType === 'date_change' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Previous Check-in</p>
                        <p className="text-sm font-medium line-through text-red-600/70">
                          {detailItem.previousCheckIn ? formatDate(new Date(detailItem.previousCheckIn)) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">New Check-in</p>
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {detailItem.newCheckIn ? formatDate(new Date(detailItem.newCheckIn)) : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Previous Check-out</p>
                        <p className="text-sm font-medium line-through text-red-600/70">
                          {detailItem.previousCheckOut ? formatDate(new Date(detailItem.previousCheckOut)) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">New Check-out</p>
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {detailItem.newCheckOut ? formatDate(new Date(detailItem.newCheckOut)) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Room Change */}
                {detailItem.modificationType === 'room_change' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Previous Room</p>
                      <p className="text-sm font-medium line-through text-red-600/70">
                        {detailItem.previousRoomType || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">New Room</p>
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {detailItem.newRoomType || 'N/A'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Guest Change */}
                {detailItem.modificationType === 'guest_change' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Previous Guests</p>
                      <p className="text-sm font-medium line-through text-red-600/70">
                        {detailItem.previousAdults ?? '?'} adults, {detailItem.previousChildren ?? 0} children
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">New Guests</p>
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {detailItem.newAdults ?? '?'} adults, {detailItem.newChildren ?? 0} children
                      </p>
                    </div>
                  </div>
                )}

                {/* Rate Change */}
                {detailItem.modificationType === 'rate_change' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Previous Rate</p>
                      <p className="text-sm font-medium line-through text-red-600/70">
                        {formatCurrency(detailItem.previousRate || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">New Rate</p>
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(detailItem.newRate || 0)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Generic value change */}
                {(detailItem.modificationType === 'name_change' ||
                  detailItem.modificationType === 'addon_change' ||
                  detailItem.modificationType === 'special_request') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Previous</p>
                      <p className="text-sm font-medium line-through text-red-600/70">
                        {detailItem.previousValue || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">New</p>
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {detailItem.newValue || 'N/A'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Price Difference */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Price Difference</span>
                    <span className={`text-lg font-bold ${detailItem.priceDifference > 0 ? 'text-emerald-600 dark:text-emerald-400' : detailItem.priceDifference < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      {detailItem.priceDifference > 0 ? '+' : ''}{formatCurrency(detailItem.priceDifference)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Booking Ref */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Ref: <span className="font-mono">{detailItem.channelBookingRef || detailItem.bookingId?.slice(0, 8) || 'N/A'}</span></span>
                <span>Requested: {formatDate(new Date(detailItem.requestedAt))}</span>
              </div>

              {/* Error message if failed */}
              {detailItem.errorMessage && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
                  <p className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    {detailItem.errorMessage}
                  </p>
                </div>
              )}

              {/* Rejection reason if rejected */}
              {detailItem.rejectionReason && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-700 dark:text-red-400">{detailItem.rejectionReason}</p>
                </div>
              )}

              {/* Auto-apply toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-sm font-medium">Auto-Apply</span>
                </div>
                <Switch
                  checked={detailItem.autoApply}
                  disabled={detailItem.status !== 'pending'}
                  onCheckedChange={async (checked) => {
                    try {
                      const response = await fetch('/api/channels/booking-modifications', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: detailItem.id, action: checked ? 'apply' : 'approve' }),
                      });
                      const result = await response.json();
                      if (result.success) {
                        toast.success(checked ? 'Set to auto-apply' : 'Auto-apply disabled');
                        fetchData();
                        setDetailItem(null);
                      }
                    } catch {
                      toast.error('Failed to update auto-apply');
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          {detailItem && detailItem.status === 'pending' && (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="destructive"
                onClick={() => { setRejectItem(detailItem); }}
                disabled={actionLoading}
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <div className="flex-1" />
              {detailItem.autoApply && (
                <Button
                  variant="outline"
                  onClick={() => handleApply(detailItem)}
                  disabled={actionLoading}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Apply Now
                </Button>
              )}
              <Button
                onClick={() => handleApprove(detailItem)}
                disabled={actionLoading}
              >
                <Check className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Reject Dialog ── */}
      <Dialog open={!!rejectItem} onOpenChange={() => { setRejectItem(null); setRejectReason(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <ShieldX className="h-5 w-5" />
              Reject Modification
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this {rejectItem ? MODIFICATION_TYPE_LABELS[rejectItem.modificationType] || 'modification' : 'modification'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {rejectItem && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm">
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <span className="font-medium">{MODIFICATION_TYPE_LABELS[rejectItem.modificationType]}</span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Summary:</span>{' '}
                  <span className="font-medium">{getChangeSummary(rejectItem)}</span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="e.g. Room not available for new dates, rate does not match our policy..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectItem(null); setRejectReason(''); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading || !rejectReason.trim()}>
              <X className="h-4 w-4 mr-2" />
              Reject Modification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
