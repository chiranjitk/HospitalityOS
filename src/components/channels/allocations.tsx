'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Building2,
  PieChart,
  TrendingDown,
  Percent,
  CalendarDays,
  Save,
  RotateCcw,
  Equal,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

// =====================================================
// TYPES
// =====================================================

interface ChannelInfo {
  id: string;
  channel: string;
  displayName: string;
  status: string;
}

interface ChannelAllocationEntry {
  allocated: number;
  used: number;
  connectionId: string;
}

interface AllocationRow {
  roomTypeId: string;
  roomTypeName: string;
  roomTypeCode: string;
  date: string;
  totalRooms: number;
  booked: number;
  available: number;
  channels: Record<string, ChannelAllocationEntry>;
  freeSale: number;
  overbooked: boolean;
}

interface ChannelSummaryItem {
  channelId: string;
  channel: string;
  displayName: string;
  status: string;
  totalAllocated: number;
  totalUsed: number;
  utilizationRate: number;
  freeSale: number;
}

interface AllocationSummary {
  totalRoomTypes: number;
  totalRooms: number;
  totalAllocated: number;
  totalFreeSale: number;
  utilizationRate: number;
  dateRange: { startDate: string; endDate: string; days: number };
  totalBooked: number;
}

interface AllocationData {
  allocations: AllocationRow[];
  channels: ChannelInfo[];
  channelSummary: ChannelSummaryItem[];
  summary: AllocationSummary;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getCellColor(allocated: number, available: number, overbooked: boolean): string {
  if (overbooked) return 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400';
  if (available <= 0) return 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400';
  if (allocated === 0) return 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400';
  const ratio = allocated / available;
  if (ratio >= 0.9) return 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400';
  return 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400';
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function ChannelAllocations() {
  // State
  const [data, setData] = useState<AllocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date range state - default to 7 days
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [endDate, setEndDate] = useState(formatDate(new Date(Date.now() + 6 * 86400000)));
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);

  // Edit state - tracks changed allocations: key = `${connectionId}-${roomTypeId}`, value = number
  const [editBuffer, setEditBuffer] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Property ID
  const [propertyId, setPropertyId] = useState<string>('');

  // Fetch allocation data
  const fetchAllocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (propertyId) params.set('propertyId', propertyId);
      params.set('startDate', startDate);
      params.set('endDate', endDate);

      const res = await fetch(`/api/channels/allocations?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setData(json.data);
        setEditBuffer({});
        setHasChanges(false);
        setSelectedDateIndex(0);
      } else {
        setError(json.error?.message || 'Failed to load allocations');
      }
    } catch {
      setError('Network error — please retry');
    } finally {
      setLoading(false);
    }
  }, [propertyId, startDate, endDate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchAllocations();
      if (!cancelled) {
        setEditBuffer({});
        setHasChanges(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchAllocations]);


  // Computed values
  const channels = useMemo(() => data?.channels || [], [data]);
  const allocations = useMemo(() => data?.allocations || [], [data]);
  const summary = useMemo(() => data?.summary, [data]);
  const channelSummary = useMemo(() => data?.channelSummary || [], [data]);

  // Unique room types from allocations
  const roomTypes = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    for (const a of allocations) {
      if (!map.has(a.roomTypeId)) {
        map.set(a.roomTypeId, { id: a.roomTypeId, name: a.roomTypeName, code: a.roomTypeCode });
      }
    }
    return Array.from(map.values());
  }, [allocations]);

  // Unique dates
  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const a of allocations) set.add(a.date);
    return Array.from(set).sort();
  }, [allocations]);

  const selectedDate = dates[selectedDateIndex] || '';

  // Filter allocations for selected date
  const selectedDateAllocations = useMemo(
    () => allocations.filter((a) => a.date === selectedDate),
    [allocations, selectedDate]
  );

  // Edit handlers
  const handleAllocationChange = useCallback((connectionId: string, roomTypeId: string, value: number) => {
    const key = `${connectionId}-${roomTypeId}-${selectedDate}`;
    setEditBuffer((prev) => {
      const next = { ...prev, [key]: value };
      setHasChanges(true);
      return next;
    });
  }, [selectedDate]);

  const getAllocatedValue = useCallback(
    (connectionId: string, roomTypeId: string): number => {
      const key = `${connectionId}-${roomTypeId}-${selectedDate}`;
      if (editBuffer[key] !== undefined) return editBuffer[key];
      const row = selectedDateAllocations.find((a) => a.roomTypeId === roomTypeId);
      if (row?.channels) {
        const ch = row.channels[channels.find((c) => c.id === connectionId)?.channel || ''];
        if (ch) return ch.allocated;
      }
      return 0;
    },
    [editBuffer, selectedDate, selectedDateAllocations, channels]
  );

  // Quick action: Distribute evenly
  const handleDistributeEvenly = useCallback(() => {
    if (channels.length === 0) return;
    const newBuffer: Record<string, number> = { ...editBuffer };
    for (const rt of roomTypes) {
      const row = selectedDateAllocations.find((a) => a.roomTypeId === rt.id);
      if (!row) continue;
      const available = row.available;
      if (available <= 0) continue;
      const perChannel = Math.floor(available / channels.length);
      for (const ch of channels) {
        const key = `${ch.id}-${rt.id}-${selectedDate}`;
        newBuffer[key] = perChannel;
      }
    }
    setEditBuffer(newBuffer);
    setHasChanges(true);
    toast.info('Distributed rooms evenly across channels');
  }, [channels, roomTypes, selectedDateAllocations, selectedDate, editBuffer]);

  // Quick action: Reset all
  const handleResetAll = useCallback(() => {
    setEditBuffer({});
    setHasChanges(false);
    toast.info('All allocation changes reset');
  }, []);

  // Save allocations
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const savePromises = Object.entries(editBuffer).map(async ([key, value]) => {
        const [connectionId, roomTypeId, dateStr] = key.split('-');
        // Find the matching channel connection
        const ch = channels.find((c) => c.id === connectionId);
        if (!ch) return;

        const res = await fetch('/api/channels/allocations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId,
            roomTypeId,
            startDate: dateStr,
            endDate: dateStr,
            allocationCount: value,
            closed: value === 0,
          }),
        });
        return res.json();
      });

      await Promise.all(savePromises);
      setEditBuffer({});
      setHasChanges(false);
      toast.success('Allocations saved successfully');
      fetchAllocations();
    } catch {
      toast.error('Failed to save allocations');
    } finally {
      setSaving(false);
    }
  }, [editBuffer, channels, fetchAllocations]);

  // Calculate real-time totals from buffer
  const liveTotalAllocated = useMemo(() => {
    let total = 0;
    for (const rt of roomTypes) {
      const row = selectedDateAllocations.find((a) => a.roomTypeId === rt.id);
      if (!row) continue;
      for (const ch of channels) {
        total += getAllocatedValue(ch.id, rt.id);
      }
    }
    return total;
  }, [roomTypes, selectedDateAllocations, channels, getAllocatedValue]);

  const liveTotalFreeSale = useMemo(() => {
    let total = 0;
    for (const rt of roomTypes) {
      const row = selectedDateAllocations.find((a) => a.roomTypeId === rt.id);
      if (!row) continue;
      const channelSum = channels.reduce((s, ch) => s + getAllocatedValue(ch.id, rt.id), 0);
      total += Math.max(0, row.available - channelSum);
    }
    return total;
  }, [roomTypes, selectedDateAllocations, channels, getAllocatedValue]);

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) {
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
          <h2 className="text-2xl font-bold tracking-tight">Channel Allocations</h2>
        </div>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <XCircle className="h-12 w-12 text-red-500" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={fetchAllocations}>
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data || roomTypes.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Channel Allocations</h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <Building2 className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No room types found. Set up room types and channel connections first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalRoomsSelectedDate = selectedDateAllocations.reduce((s, a) => s + a.totalRooms, 0);
  const totalBookedSelectedDate = selectedDateAllocations.reduce((s, a) => s + a.booked, 0);
  const totalAvailableSelectedDate = totalRoomsSelectedDate - totalBookedSelectedDate;
  const utilizationPct = totalAvailableSelectedDate > 0
    ? Math.round((liveTotalAllocated / totalAvailableSelectedDate) * 100)
    : 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Channel Allocations</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Assign room inventory to specific channels per day
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
              Unsaved changes
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={fetchAllocations} disabled={saving}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Saving...' : 'Save Allocations'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2.5 dark:bg-blue-950/40">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Rooms</p>
                <p className="text-2xl font-bold">{summary?.totalRooms || 0}</p>
                <p className="text-xs text-muted-foreground">{summary?.totalRoomTypes || 0} room types</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-50 p-2.5 dark:bg-purple-950/40">
                <PieChart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Allocated to Channels</p>
                <p className="text-2xl font-bold">{liveTotalAllocated}</p>
                <p className="text-xs text-muted-foreground">of {totalAvailableSelectedDate} available</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-950/40">
                <TrendingDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Free Sale</p>
                <p className="text-2xl font-bold">{liveTotalFreeSale}</p>
                <p className="text-xs text-muted-foreground">rooms unallocated</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-50 p-2.5 dark:bg-amber-950/40">
                <Percent className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Utilization Rate</p>
                <p className="text-2xl font-bold">{utilizationPct}%</p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      utilizationPct >= 90 ? 'bg-amber-500' : utilizationPct >= 70 ? 'bg-blue-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(utilizationPct, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Range Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Date Range:</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40 h-9 text-sm"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40 h-9 text-sm"
              />
            </div>
            <Separator orientation="vertical" className="hidden md:block h-6" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {formatDisplayDate(startDate)} — {formatDisplayDate(endDate)}
              </span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{dates.length} days</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleDistributeEvenly} disabled={channels.length === 0}>
          <Equal className="h-4 w-4 mr-1" /> Distribute Evenly
        </Button>
        <Button variant="outline" size="sm" onClick={handleResetAll} disabled={!hasChanges}>
          <RotateCcw className="h-4 w-4 mr-1" /> Reset All
        </Button>
        <div className="flex-1" />
        {channels.length === 0 && (
          <p className="text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            No active channel connections. Add OTA connections first.
          </p>
        )}
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedDateIndex(Math.max(0, selectedDateIndex - 1))}
          disabled={selectedDateIndex === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-1 overflow-x-auto pb-1 max-w-full">
          {dates.map((d, i) => {
            const dayRows = allocations.filter((a) => a.date === d);
            const hasOverbooking = dayRows.some((r) => r.overbooked);
            const isSelected = i === selectedDateIndex;
            const isToday = d === formatDate(new Date());
            return (
              <button
                key={d}
                onClick={() => setSelectedDateIndex(i)}
                className={`px-3 py-1.5 text-xs rounded-md border whitespace-nowrap transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : hasOverbooking
                      ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400'
                      : isToday
                        ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400'
                        : 'hover:bg-muted border-border'
                }`}
              >
                {formatDisplayDate(d)}
                {isToday && !isSelected && (
                  <span className="ml-1 text-[10px] opacity-70">Today</span>
                )}
              </button>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedDateIndex(Math.min(dates.length - 1, selectedDateIndex + 1))}
          disabled={selectedDateIndex === dates.length - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Allocation Grid */}
      {channels.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px] overflow-auto">
              <div className="min-w-[600px]">
                {/* Grid Header */}
                <div className="grid sticky top-0 bg-background z-10 border-b" style={{ gridTemplateColumns: `180px repeat(${channels.length}, 100px) 100px` }}>
                  <div className="p-3 text-xs font-semibold text-muted-foreground border-r">Room Type</div>
                  {channels.map((ch) => (
                    <div key={ch.id} className="p-3 text-xs font-semibold text-muted-foreground border-r text-center truncate" title={ch.displayName}>
                      {ch.displayName}
                    </div>
                  ))}
                  <div className="p-3 text-xs font-semibold text-muted-foreground text-center">Free Sale</div>
                </div>

                {/* Grid Rows */}
                {roomTypes.map((rt) => {
                  const row = selectedDateAllocations.find((a) => a.roomTypeId === rt.id);
                  const totalRooms = row?.totalRooms || 0;
                  const booked = row?.booked || 0;
                  const available = row?.available || 0;
                  const channelSum = channels.reduce((s, ch) => s + getAllocatedValue(ch.id, rt.id), 0);
                  const freeSale = Math.max(0, available - channelSum);
                  const isOverbooked = channelSum > available;

                  return (
                    <div
                      key={rt.id}
                      className={`grid border-b hover:bg-muted/50 transition-colors ${isOverbooked ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}
                      style={{ gridTemplateColumns: `180px repeat(${channels.length}, 100px) 100px` }}
                    >
                      {/* Room Type Cell */}
                      <div className="p-3 border-r flex flex-col justify-center">
                        <span className="text-sm font-medium truncate">{rt.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {totalRooms} total · {booked} booked · {available} avail
                        </span>
                      </div>

                      {/* Channel Allocation Cells */}
                      {channels.map((ch) => {
                        const allocated = getAllocatedValue(ch.id, rt.id);
                        const channelData = row?.channels?.[ch.channel];
                        const used = channelData?.used || 0;
                        const cellColor = getCellColor(allocated, available, isOverbooked);
                        const bufferKey = `${ch.id}-${rt.id}-${selectedDate}`;
                        const isEdited = editBuffer[bufferKey] !== undefined;

                        return (
                          <div key={ch.id} className="p-1.5 border-r flex items-center justify-center">
                            <div className={`w-full text-center rounded-md border p-1.5 transition-colors ${cellColor}`}>
                              <Input
                                type="number"
                                min={0}
                                max={available}
                                value={allocated}
                                onChange={(e) => handleAllocationChange(ch.id, rt.id, Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full h-7 text-center text-sm p-0 bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-primary/50"
                              />
                              <span className="text-[10px] block mt-0.5 opacity-60">
                                {used}/{allocated} used
                              </span>
                              {isEdited && (
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Free Sale Cell */}
                      <div className="p-1.5 flex items-center justify-center">
                        <div className={`w-full text-center rounded-md border p-2 ${
                          freeSale === 0
                            ? 'bg-gray-100 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                            : freeSale < 3
                              ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                              : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                        }`}>
                          <span className={`text-lg font-bold ${
                            freeSale === 0 ? 'text-gray-400' : freeSale < 3 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                          }`}>
                            {freeSale}
                          </span>
                          <span className="text-[10px] block opacity-60">free</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
            <p className="text-muted-foreground text-center">
              No active channel connections found.<br />
              Connect OTA channels first to manage allocations.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Color Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium">Legend:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/50 dark:border-emerald-700" />
          Under limit
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200 dark:bg-amber-900/50 dark:border-amber-700" />
          Near limit (&ge;90%)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-200 dark:bg-red-900/50 dark:border-red-700" />
          Over-allocated
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200 dark:bg-gray-800 dark:border-gray-700" />
          No allocation
        </div>
      </div>

      {/* Channel Allocation Summary Cards */}
      {channelSummary.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Channel Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {channelSummary.map((ch) => (
              <Card key={ch.channelId}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {ch.displayName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{ch.displayName}</p>
                        <p className="text-xs text-muted-foreground">{ch.channel}</p>
                      </div>
                    </div>
                    <Badge
                      variant={ch.utilizationRate >= 0.9 ? 'destructive' : ch.utilizationRate >= 0.5 ? 'default' : 'secondary'}
                      className="text-[10px]"
                    >
                      {Math.round(ch.utilizationRate * 100)}% used
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-lg font-bold">{ch.totalAllocated}</p>
                      <p className="text-[10px] text-muted-foreground">Allocated</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold">{ch.totalUsed}</p>
                      <p className="text-[10px] text-muted-foreground">Used</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{ch.freeSale}</p>
                      <p className="text-[10px] text-muted-foreground">Available</p>
                    </div>
                  </div>
                  <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        ch.utilizationRate >= 0.9 ? 'bg-red-500' : ch.utilizationRate >= 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(Math.round(ch.utilizationRate * 100), 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Allocation History (from sync logs) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Allocation Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {summary?.totalBooked && summary.totalBooked > 0 ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Active Bookings Detected</p>
                  <p className="text-xs text-muted-foreground">
                    {summary.totalBooked} active booking(s) across the date range — allocations are consuming from channel pools
                  </p>
                </div>
              </div>
              {hasChanges && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Unsaved Changes</p>
                    <p className="text-xs text-muted-foreground">
                      You have unsaved allocation modifications. Click &quot;Save Allocations&quot; to persist changes.
                    </p>
                  </div>
                </div>
              )}
              {allocations.some((a) => a.overbooked) && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Over-allocation Detected</p>
                    <p className="text-xs text-muted-foreground">
                      One or more room types have total channel allocations exceeding available rooms. Consider reducing allocations.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent allocation activity. Active bookings will appear here as they consume channel allocations.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ChannelAllocations;
