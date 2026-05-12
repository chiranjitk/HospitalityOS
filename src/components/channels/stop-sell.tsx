'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  RefreshCw,
  ShieldOff,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  CalendarDays,
  Trash2,
  ChevronRight,
  X,
  Lock,
  Unlock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Filter,
  Plus,
  Minus,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

// =====================================================
// TYPES
// =====================================================

interface StopSellEntry {
  id: string;
  channelId: string;
  channelName: string;
  channelCode: string;
  channelLogo?: string;
  channelColor?: string;
  roomTypeId: string;
  roomTypeName: string;
  propertyName: string;
  startDate: string;
  endDate: string;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  syncStatus: string;
  createdAt: string;
}

interface ChannelInfo {
  id: string;
  channel: string;
  displayName: string;
  status: string;
  propertyId: string | null;
  logo: string;
  color: string;
}

interface RoomTypeInfo {
  id: string;
  name: string;
  code: string;
  propertyId: string;
  propertyName: string;
}

interface SummaryData {
  totalActive: number;
  channelsAffected: number;
  roomTypesAffected: number;
  datesCovered: string;
}

interface StopSellResponse {
  success: boolean;
  data: {
    activeStopSells: StopSellEntry[];
    channels: ChannelInfo[];
    roomTypes: RoomTypeInfo[];
    summary: SummaryData;
  };
}

// =====================================================
// HELPERS
// =====================================================

const CHANNEL_COLORS: Record<string, string> = {
  booking: '#003580',
  expedia: '#FBB01C',
  airbnb: '#FF5A5F',
  agoda: '#5392F9',
  makemytrip: '#E4175C',
  goibibo: '#FF6161',
  hotelscom: '#D32F2F',
  priceline: '#E13300',
  trivago: '#003580',
  tripadvisor: '#34E0A1',
  direct: '#10B981',
};

function getChannelColor(code: string): string {
  if (CHANNEL_COLORS[code]) return CHANNEL_COLORS[code];
  if (code.includes('booking')) return CHANNEL_COLORS.booking;
  if (code.includes('expedia') || code.includes('hotels')) return CHANNEL_COLORS.expedia;
  if (code.includes('airbnb')) return CHANNEL_COLORS.airbnb;
  if (code.includes('agoda')) return CHANNEL_COLORS.agoda;
  if (code.includes('makemytrip') || code.includes('mmt')) return CHANNEL_COLORS.makemytrip;
  return '#6B7280';
}

function syncStatusBadge(status: string) {
  switch (status) {
    case 'synced':
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-100">Synced</Badge>;
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-100">Pending</Badge>;
    case 'failed':
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-100">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function StopSellManager() {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StopSellResponse | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<string[]>([]);
  const [formClosedToArrival, setFormClosedToArrival] = useState(false);
  const [formClosedToDeparture, setFormClosedToDeparture] = useState(false);
  const [formReason, setFormReason] = useState('');

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'apply' | 'remove' | 'removeAll';
    message: string;
    action: () => void;
  }>({ open: false, type: 'apply', message: '', action: () => {} });

  // Extend dialog
  const [extendDialog, setExtendDialog] = useState(false);
  const [extendDays, setExtendDays] = useState(7);

  // Filter state
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterRoomType, setFilterRoomType] = useState<string>('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/channels/stop-sell');
      const json: StopSellResponse = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError('Failed to load stop-sell data');
      }
    } catch {
      setError('Network error loading stop-sell data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => { await fetchData(); })();
  }, [fetchData]);

  // Select all / deselect helpers
  const toggleSelectAllChannels = () => {
    if (!data) return;
    const allIds = data.data.channels.map((c) => c.id);
    if (selectedChannels.length === allIds.length) {
      setSelectedChannels([]);
    } else {
      setSelectedChannels(allIds);
    }
  };

  const toggleSelectAllRoomTypes = () => {
    if (!data) return;
    const allIds = data.data.roomTypes.map((rt) => rt.id);
    if (selectedRoomTypes.length === allIds.length) {
      setSelectedRoomTypes([]);
    } else {
      setSelectedRoomTypes(allIds);
    }
  };

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleRoomType = (id: string) => {
    setSelectedRoomTypes((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  // Apply stop-sell
  const handleApply = () => {
    if (!formStartDate || !formEndDate) {
      toast.error('Please select a date range');
      return;
    }
    const chCount = selectedChannels.length === 0 && data
      ? data.data.channels.length
      : selectedChannels.length;
    const rtCount = selectedRoomTypes.length === 0 && data
      ? data.data.roomTypes.length
      : selectedRoomTypes.length;

    setConfirmDialog({
      open: true,
      type: 'apply',
      message: `Apply stop-sell across ${chCount} channel(s) and ${rtCount} room type(s) from ${formStartDate} to ${formEndDate}? This will close availability on all selected channels.`,
      action: async () => {
        setConfirmDialog((p) => ({ ...p, open: false }));
        setActionLoading(true);
        try {
          const res = await fetch('/api/channels/stop-sell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'apply',
              channelIds: selectedChannels.length > 0 ? selectedChannels : undefined,
              roomTypeIds: selectedRoomTypes.length > 0 ? selectedRoomTypes : undefined,
              startDate: formStartDate,
              endDate: formEndDate,
              closedToArrival: formClosedToArrival,
              closedToDeparture: formClosedToDeparture,
              reason: formReason,
            }),
          });
          const json = await res.json();
          if (json.success) {
            toast.success(json.data.message);
            setFormOpen(false);
            resetForm();
            fetchData();
          } else {
            toast.error(json.error?.message || 'Failed to apply stop-sell');
          }
        } catch {
          toast.error('Network error');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // Remove single stop-sell
  const handleRemoveSingle = (entry: StopSellEntry) => {
    setConfirmDialog({
      open: true,
      type: 'remove',
      message: `Remove stop-sell for "${entry.roomTypeName}" on "${entry.channelName}" (${entry.startDate} to ${entry.endDate})?`,
      action: async () => {
        setConfirmDialog((p) => ({ ...p, open: false }));
        setActionLoading(true);
        try {
          const res = await fetch('/api/channels/stop-sell', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'remove',
              channelIds: [entry.channelId],
              roomTypeIds: [entry.roomTypeId],
              startDate: entry.startDate,
              endDate: entry.endDate,
            }),
          });
          const json = await res.json();
          if (json.success) {
            toast.success(json.data.message);
            fetchData();
          } else {
            toast.error(json.error?.message || 'Failed to remove');
          }
        } catch {
          toast.error('Network error');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // Remove all stop-sells
  const handleRemoveAll = () => {
    if (!data || data.data.activeStopSells.length === 0) {
      toast.info('No active stop-sells to remove');
      return;
    }
    setConfirmDialog({
      open: true,
      type: 'removeAll',
      message: `Remove ALL ${data.data.activeStopSells.length} active stop-sell restrictions? This will re-open all channels.`,
      action: async () => {
        setConfirmDialog((p) => ({ ...p, open: false }));
        setActionLoading(true);
        try {
          const allStarts = data.data.activeStopSells.map((s) => s.startDate);
          const allEnds = data.data.activeStopSells.map((s) => s.endDate);
          const globalStart = allStarts.sort()[0];
          const globalEnd = allEnds.sort().reverse()[0];
          const res = await fetch('/api/channels/stop-sell', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'remove',
              startDate: globalStart,
              endDate: globalEnd,
            }),
          });
          const json = await res.json();
          if (json.success) {
            toast.success(json.data.message);
            fetchData();
          } else {
            toast.error(json.error?.message || 'Failed to remove');
          }
        } catch {
          toast.error('Network error');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // Close ALL channels immediately
  const handleCloseAllChannels = () => {
    setConfirmDialog({
      open: true,
      type: 'apply',
      message: 'EMERGENCY: Close ALL channels immediately? This will stop all new bookings from all connected channels until reopened.',
      action: async () => {
        setConfirmDialog((p) => ({ ...p, open: false }));
        setActionLoading(true);
        try {
          const today = new Date().toISOString().split('T')[0];
          const future = new Date();
          future.setFullYear(future.getFullYear() + 1);
          const futureStr = future.toISOString().split('T')[0];
          const res = await fetch('/api/channels/stop-sell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'apply',
              startDate: today,
              endDate: futureStr,
              reason: 'Emergency closure',
            }),
          });
          const json = await res.json();
          if (json.success) {
            toast.success(json.data.message);
            fetchData();
          } else {
            toast.error(json.error?.message || 'Failed to close channels');
          }
        } catch {
          toast.error('Network error');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // Open ALL channels
  const handleOpenAllChannels = () => {
    setConfirmDialog({
      open: true,
      type: 'removeAll',
      message: 'Open ALL channels? This will remove all stop-sell restrictions and re-enable bookings on all channels.',
      action: async () => {
        setConfirmDialog((p) => ({ ...p, open: false }));
        setActionLoading(true);
        try {
          const today = new Date().toISOString().split('T')[0];
          const future = new Date();
          future.setFullYear(future.getFullYear() + 1);
          const futureStr = future.toISOString().split('T')[0];
          const res = await fetch('/api/channels/stop-sell', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'remove',
              startDate: today,
              endDate: futureStr,
            }),
          });
          const json = await res.json();
          if (json.success) {
            toast.success(json.data.message);
            fetchData();
          } else {
            toast.error(json.error?.message || 'Failed to open channels');
          }
        } catch {
          toast.error('Network error');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // Extend all stop-sells
  const handleExtendAll = async () => {
    if (!data || data.data.activeStopSells.length === 0) {
      toast.info('No active stop-sells to extend');
      setExtendDialog(false);
      return;
    }
    setExtendDialog(false);
    setActionLoading(true);
    try {
      // Remove existing then re-apply with extended dates
      const allEnds = data.data.activeStopSells.map((s) => new Date(s.endDate));
      const latestEnd = new Date(Math.max(...allEnds.map((d) => d.getTime())));
      const newEnd = new Date(latestEnd);
      newEnd.setDate(newEnd.getDate() + extendDays);

      // Collect unique channel-roomtype combos
      const combos = new Map<string, { channelId: string; roomTypeId: string; closedToArrival: boolean; closedToDeparture: boolean }>();
      for (const ss of data.data.activeStopSells) {
        const key = `${ss.channelId}::${ss.roomTypeId}`;
        if (!combos.has(key)) {
          combos.set(key, {
            channelId: ss.channelId,
            roomTypeId: ss.roomTypeId,
            closedToArrival: ss.closedToArrival,
            closedToDeparture: ss.closedToDeparture,
          });
        }
      }

      const allStarts = data.data.activeStopSells.map((s) => s.startDate);
      const earliestStart = allStarts.sort()[0];

      const chIds = [...new Set(data.data.activeStopSells.map((s) => s.channelId))];
      const rtIds = [...new Set(data.data.activeStopSells.map((s) => s.roomTypeId))];

      const res = await fetch('/api/channels/stop-sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          channelIds: chIds,
          roomTypeIds: rtIds,
          startDate: earliestStart,
          endDate: newEnd.toISOString().split('T')[0],
          reason: `Extended by ${extendDays} days`,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Stop-sells extended by ${extendDays} days`);
        fetchData();
      } else {
        toast.error(json.error?.message || 'Failed to extend');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const resetForm = () => {
    setFormStartDate('');
    setFormEndDate('');
    setSelectedChannels([]);
    setSelectedRoomTypes([]);
    setFormClosedToArrival(false);
    setFormClosedToDeparture(false);
    setFormReason('');
  };

  // Filtered stop-sells
  const filteredStopSells = (() => {
    if (!data) return [];
    let list = data.data.activeStopSells;
    if (filterChannel !== 'all') {
      list = list.filter((s) => s.channelId === filterChannel);
    }
    if (filterRoomType !== 'all') {
      list = list.filter((s) => s.roomTypeId === filterRoomType);
    }
    if (filterDateStart) {
      list = list.filter((s) => s.endDate >= filterDateStart);
    }
    if (filterDateEnd) {
      list = list.filter((s) => s.startDate <= filterDateEnd);
    }
    return list;
  })();

  // Calendar helpers
  const calendarStopSellsForDate = (date: Date) => {
    if (!data) return [];
    return data.data.activeStopSells.filter((s) => {
      const start = parseISO(s.startDate);
      const end = parseISO(s.endDate);
      return date >= start && date <= end;
    });
  };

  const selectedDateDetails = selectedDate ? calendarStopSellsForDate(selectedDate) : [];

  // Calendar grid
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { activeStopSells, channels, roomTypes, summary } = data.data;
  const hasActiveStopSells = activeStopSells.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bulk Stop-Sell Management</h1>
          <p className="text-muted-foreground">Quickly close/open rooms across multiple channels</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Emergency Banner */}
      <div
        className={`rounded-lg border-2 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          hasActiveStopSells
            ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800'
            : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
        }`}
      >
        <div className="flex items-center gap-3">
          {hasActiveStopSells ? (
            <ShieldOff className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
          ) : (
            <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          )}
          <div>
            <p className={`font-semibold ${hasActiveStopSells ? 'text-red-800 dark:text-red-200' : 'text-emerald-800 dark:text-emerald-200'}`}>
              {hasActiveStopSells ? `Stop-Sell Active — ${summary.totalActive} restriction(s)` : 'All Channels Open'}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasActiveStopSells
                ? `${summary.channelsAffected} channel(s) affected across ${summary.datesCovered}`
                : 'No active stop-sell restrictions. All channels are accepting bookings.'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCloseAllChannels}
            disabled={actionLoading}
          >
            <Lock className="h-4 w-4 mr-2" />
            CLOSE ALL
          </Button>
          <Button
            variant="default"
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleOpenAllChannels}
            disabled={actionLoading}
          >
            <Unlock className="h-4 w-4 mr-2" />
            OPEN ALL
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <ShieldOff className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.totalActive}</p>
                <p className="text-xs text-muted-foreground">Active Stop-Sells</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <CalendarDays className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.channelsAffected}</p>
                <p className="text-xs text-muted-foreground">Channels Affected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Lock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.roomTypesAffected}</p>
                <p className="text-xs text-muted-foreground">Room Types Affected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-sky-500/10 to-sky-600/5 border-sky-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/20">
                <Calendar className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-lg font-bold leading-tight">{summary.datesCovered}</p>
                <p className="text-xs text-muted-foreground">Date Range</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form + Calendar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Apply Stop-Sell Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Apply Stop-Sell
              </CardTitle>
              <CardDescription>Close availability on selected channels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Channel Select */}
              {channels.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Channels</Label>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={toggleSelectAllChannels}>
                      {selectedChannels.length === channels.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2">
                    {channels.map((ch) => (
                      <label key={ch.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={selectedChannels.includes(ch.id)}
                          onCheckedChange={() => toggleChannel(ch.id)}
                        />
                        <span className="truncate">{ch.displayName}</span>
                      </label>
                    ))}
                  </div>
                  {selectedChannels.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">None selected = all channels</p>
                  )}
                </div>
              )}

              {/* Room Type Select */}
              {roomTypes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Room Types</Label>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={toggleSelectAllRoomTypes}>
                      {selectedRoomTypes.length === roomTypes.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2">
                    {roomTypes.map((rt) => (
                      <label key={rt.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={selectedRoomTypes.includes(rt.id)}
                          onCheckedChange={() => toggleRoomType(rt.id)}
                        />
                        <span className="truncate">{rt.name}</span>
                      </label>
                    ))}
                  </div>
                  {selectedRoomTypes.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">None selected = all room types</p>
                  )}
                </div>
              )}

              {/* Options */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Options</Label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={formClosedToArrival}
                    onCheckedChange={(c) => setFormClosedToArrival(!!c)}
                  />
                  <div className="flex items-center gap-1">
                    <ArrowDownToLine className="h-3 w-3" />
                    Closed to Arrival
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={formClosedToDeparture}
                    onCheckedChange={(c) => setFormClosedToDeparture(!!c)}
                  />
                  <div className="flex items-center gap-1">
                    <ArrowUpFromLine className="h-3 w-3" />
                    Closed to Departure
                  </div>
                </label>
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <Label className="text-xs">Reason (optional)</Label>
                <Textarea
                  placeholder="e.g., Maintenance work, emergency closure..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
              </div>

              {/* Submit */}
              <Button
                className="w-full bg-red-600 hover:bg-red-700"
                onClick={handleApply}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShieldOff className="h-4 w-4 mr-2" />
                )}
                Apply Stop-Sell
              </Button>
            </CardContent>
          </Card>

          {/* Calendar View */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Stop-Sell Calendar
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[100px] text-center">
                    {format(calendarMonth, 'MMM yyyy')}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                    {day}
                  </div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const stops = calendarStopSellsForDate(day);
                  const hasStop = stops.length > 0;
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, calendarMonth);
                  const uniqueChannels = [...new Set(stops.map((s) => s.channelCode))];

                  return (
                    <button
                      key={day.toISOString()}
                      className={`relative h-8 text-xs rounded transition-colors flex items-center justify-center ${
                        isSelected
                          ? 'ring-2 ring-primary'
                          : ''
                      } ${
                        isCurrentMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground/40'
                      } ${
                        hasStop
                          ? 'bg-red-100 dark:bg-red-900/40 font-semibold'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedDate(isSelected ? null : day)}
                    >
                      {format(day, 'd')}
                      {hasStop && (
                        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {uniqueChannels.slice(0, 3).map((code) => (
                            <div
                              key={code}
                              className="w-1 h-1 rounded-full"
                              style={{ backgroundColor: getChannelColor(code) }}
                            />
                          ))}
                          {uniqueChannels.length > 3 && (
                            <span className="text-[8px] leading-none">+</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected date details */}
              {selectedDate && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  <p className="text-xs font-medium">
                    Stop-sells on {format(selectedDate, 'MMM dd, yyyy')}
                  </p>
                  {selectedDateDetails.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No stop-sells on this date</p>
                  ) : (
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {selectedDateDetails.map((ss) => (
                        <div key={ss.id} className="flex items-center gap-2 text-xs">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getChannelColor(ss.channelCode) }}
                          />
                          <span className="truncate">{ss.channelName}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate text-muted-foreground">{ss.roomTypeName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Table + Bulk Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters + Bulk Actions */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters:</span>
                </div>
                <div className="flex flex-wrap gap-2 flex-1">
                  <select
                    className="text-xs border rounded-md px-2 py-1.5 bg-background"
                    value={filterChannel}
                    onChange={(e) => setFilterChannel(e.target.value)}
                  >
                    <option value="all">All Channels</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>{ch.displayName}</option>
                    ))}
                  </select>
                  <select
                    className="text-xs border rounded-md px-2 py-1.5 bg-background"
                    value={filterRoomType}
                    onChange={(e) => setFilterRoomType(e.target.value)}
                  >
                    <option value="all">All Room Types</option>
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </select>
                  <Input
                    type="date"
                    className="text-xs w-32 h-8"
                    value={filterDateStart}
                    onChange={(e) => setFilterDateStart(e.target.value)}
                    placeholder="From"
                  />
                  <Input
                    type="date"
                    className="text-xs w-32 h-8"
                    value={filterDateEnd}
                    onChange={(e) => setFilterDateEnd(e.target.value)}
                    placeholder="To"
                  />
                  {(filterChannel !== 'all' || filterRoomType !== 'all' || filterDateStart || filterDateEnd) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setFilterChannel('all');
                        setFilterRoomType('all');
                        setFilterDateStart('');
                        setFilterDateEnd('');
                      }}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                <Button variant="destructive" size="sm" onClick={handleRemoveAll} disabled={actionLoading || !hasActiveStopSells}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Remove All Stop-Sells
                </Button>
                <Button variant="outline" size="sm" onClick={() => setExtendDialog(true)} disabled={actionLoading || !hasActiveStopSells}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Extend All by X Days
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Active Stop-Sells Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldOff className="h-4 w-4" />
                Active Stop-Sells
              </CardTitle>
              <CardDescription>
                Showing {filteredStopSells.length} of {activeStopSells.length} restriction(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredStopSells.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShieldCheck className="h-12 w-12 text-emerald-500 mb-3" />
                  <p className="text-sm font-medium">No active stop-sells</p>
                  <p className="text-xs text-muted-foreground">
                    {activeStopSells.length > 0
                      ? 'Try adjusting your filters'
                      : 'All channels are open and accepting bookings'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Cards */}
                  <div className="sm:hidden space-y-3 max-h-96 overflow-y-auto">
                    {filteredStopSells.map((ss) => (
                      <div key={ss.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: getChannelColor(ss.channelCode) }}
                            >
                              {ss.channelLogo || ss.channelCode.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{ss.channelName}</p>
                              <p className="text-xs text-muted-foreground">{ss.roomTypeName}</p>
                            </div>
                          </div>
                          {syncStatusBadge(ss.syncStatus)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {ss.startDate} to {ss.endDate}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {ss.closedToArrival && (
                            <Badge variant="outline" className="text-xs">
                              <ArrowDownToLine className="h-3 w-3 mr-1" />
                              CTA
                            </Badge>
                          )}
                          {ss.closedToDeparture && (
                            <Badge variant="outline" className="text-xs">
                              <ArrowUpFromLine className="h-3 w-3 mr-1" />
                              CTD
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                          onClick={() => handleRemoveSingle(ss)}
                          disabled={actionLoading}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden sm:block">
                    <ScrollArea className="max-h-96">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Channel</TableHead>
                            <TableHead>Room Type</TableHead>
                            <TableHead>Dates</TableHead>
                            <TableHead className="text-center">CTA</TableHead>
                            <TableHead className="text-center">CTD</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredStopSells.map((ss) => (
                            <TableRow key={ss.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-7 h-7 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                    style={{ backgroundColor: getChannelColor(ss.channelCode) }}
                                  >
                                    {ss.channelLogo || ss.channelCode.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{ss.channelName}</p>
                                    {ss.propertyName && (
                                      <p className="text-xs text-muted-foreground">{ss.propertyName}</p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{ss.roomTypeName}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 text-sm">
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>{ss.startDate}</span>
                                  <span className="text-muted-foreground">to</span>
                                  <span>{ss.endDate}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {ss.closedToArrival ? (
                                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700">
                                    <ArrowDownToLine className="h-3 w-3 mr-1" />
                                    Yes
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {ss.closedToDeparture ? (
                                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700">
                                    <ArrowUpFromLine className="h-3 w-3 mr-1" />
                                    Yes
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>{syncStatusBadge(ss.syncStatus)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 h-8"
                                  onClick={() => handleRemoveSingle(ss)}
                                  disabled={actionLoading}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                                  Remove
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((p) => ({ ...p, open }))}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {confirmDialog.type === 'apply' ? 'Confirm Stop-Sell' : 'Confirm Removal'}
            </DialogTitle>
            <DialogDescription>{confirmDialog.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDialog((p) => ({ ...p, open: false }))}>
              Cancel
            </Button>
            <Button
              variant={confirmDialog.type === 'remove' || confirmDialog.type === 'removeAll' ? 'destructive' : 'default'}
              className={confirmDialog.type === 'apply' ? 'bg-red-600 hover:bg-red-700' : ''}
              onClick={confirmDialog.action}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {confirmDialog.type === 'apply' ? 'Apply Stop-Sell' : 'Confirm Removal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Dialog */}
      <Dialog open={extendDialog} onOpenChange={setExtendDialog}>
        <DialogContent className="w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Extend All Stop-Sells</DialogTitle>
            <DialogDescription>Extend all active stop-sell restrictions by a specified number of days.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-sm">Days to Extend</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={extendDays}
              onChange={(e) => setExtendDays(parseInt(e.target.value) || 7)}
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialog(false)}>Cancel</Button>
            <Button onClick={handleExtendAll} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Extend by {extendDays} Days
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default StopSellManager;
