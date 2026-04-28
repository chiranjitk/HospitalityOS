'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CalendarDays,
  Loader2,
  Pencil,
  Download,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';

interface Property {
  id: string;
  name: string;
  currency: string;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  basePrice: number;
  totalRooms: number;
  propertyId: string;
}

interface Room {
  id: string;
  number: string;
  floor: number;
  status: string;
  roomTypeId: string;
  roomType?: RoomType;
}

interface Booking {
  id: string;
  confirmationCode: string;
  checkIn: string;
  checkOut: string;
  status: string;
  primaryGuest?: {
    firstName: string;
    lastName: string;
  };
  roomTypeId: string;
  roomId?: string;
}

interface AvailabilityData {
  date: string;
  roomTypeId: string;
  total: number;
  available: number;
  booked: number;
  blocked: number;
  price: number;
}

type ViewMode = 'daily' | 'weekly' | 'monthly';

export default function AvailabilityControl() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { formatDate, formatDateTime } = useTimezone();
  const t = useTranslations('pms');
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [inventoryLocks, setInventoryLocks] = useState<any[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Date range state
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 14));
  const [viewMode, setViewMode] = useState<ViewMode>('daily');

  // Edit dialog state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState<{
    date: Date;
    roomTypeId: string;
    available: number;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{open:boolean; title:string; message:string; onConfirm:()=>void}>({open:false, title:'', message:'', onConfirm:()=>{}});
  const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false);
  const [isEndCalendarOpen, setIsEndCalendarOpen] = useState(false);

  // Fetch properties
  useEffect(() => {
    const controller = new AbortController();
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties', { signal: controller.signal });
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`API error ${response.status}: ${errorText}`);
        }
        const result = await response.json();
        if (result.success) {
          setProperties(result.data);
          if (result.data.length > 0) {
            setSelectedProperty(result.data[0].id);
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Error fetching properties:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch properties',
          variant: 'destructive',
        });
      }
    };
    fetchProperties();
    return () => controller.abort();
  }, []);

  // Fetch data when property or date range changes
  const fetchData = useCallback(async () => {
    if (!selectedProperty) return;
    setIsLoading(true);

    try {
      // Fetch room types
      const roomTypesResponse = await fetch(selectedProperty !== 'all' ? `/api/room-types?propertyId=${selectedProperty}` : '/api/room-types');
      if (!roomTypesResponse.ok) {
        const errorText = await roomTypesResponse.text().catch(() => 'Unknown error');
        throw new Error(`API error ${roomTypesResponse.status}: ${errorText}`);
      }
      const roomTypesResult = await roomTypesResponse.json();
      if (roomTypesResult.success) {
        setRoomTypes(roomTypesResult.data);
      }

      // Fetch rooms
      const roomsResponse = await fetch(selectedProperty !== 'all' ? `/api/rooms?propertyId=${selectedProperty}` : '/api/rooms');
      if (!roomsResponse.ok) {
        const errorText = await roomsResponse.text().catch(() => 'Unknown error');
        throw new Error(`API error ${roomsResponse.status}: ${errorText}`);
      }
      const roomsResult = await roomsResponse.json();
      if (roomsResult.success) {
        setRooms(roomsResult.data);
      }

      // Fetch bookings for the date range
      const bookingsParams = new URLSearchParams({
        checkInFrom: startDate.toISOString(),
        checkInTo: endDate.toISOString(),
      });
      if (selectedProperty !== 'all') {
        bookingsParams.set('propertyId', selectedProperty);
      }
      const bookingsResponse = await fetch(`/api/bookings?${bookingsParams.toString()}`);
      if (!bookingsResponse.ok) {
        const errorText = await bookingsResponse.text().catch(() => 'Unknown error');
        throw new Error(`API error ${bookingsResponse.status}: ${errorText}`);
      }
      const bookingsResult = await bookingsResponse.json();
      if (bookingsResult.success) {
        setBookings(bookingsResult.data);
      }

      // Fetch inventory locks
      try {
        const locksResponse = await fetch(selectedProperty !== 'all' ? `/api/inventory-locks?propertyId=${selectedProperty}&active=true` : '/api/inventory-locks?active=true');
        if (locksResponse.ok) {
          const locksResult = await locksResponse.json();
          setInventoryLocks(locksResult.data || locksResult || []);
        }
      } catch { /* ignore lock fetch errors */ }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch availability data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedProperty, startDate, endDate, toast]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData();
    return () => controller.abort();
  }, [fetchData]);

  // Pre-index bookings by roomTypeId for O(1) lookup (Fix 5-D1)
  const bookingsByRoomType = useMemo(() => {
    const map = new Map<string, typeof bookings>();
    for (const b of bookings) {
      const arr = map.get(b.roomTypeId || '') || [];
      arr.push(b);
      map.set(b.roomTypeId || '', arr);
    }
    return map;
  }, [bookings]);

  const locksByRoomType = useMemo(() => {
    const map = new Map<string, typeof inventoryLocks>();
    for (const l of inventoryLocks) {
      const arr = map.get(l.roomTypeId || '') || [];
      arr.push(l);
      map.set(l.roomTypeId || '', arr);
    }
    return map;
  }, [inventoryLocks]);

  // Calculate availability for each date and room type
  const availabilityData = useMemo((): AvailabilityData[] => {
    const data: AvailabilityData[] = [];
    const dates = eachDayOfInterval({ start: startDate, end: endDate });

    dates.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd');

      roomTypes.forEach(roomType => {
        const totalRoomsForType = rooms.filter(r => r.roomTypeId === roomType.id).length;

        // Count bookings for this date and room type using pre-indexed map
        const bookingsForType = bookingsByRoomType.get(roomType.id) || [];
        const bookingsForDateAndType = bookingsForType.filter(booking => {
          const checkIn = parseISO(booking.checkIn);
          const checkOut = parseISO(booking.checkOut);
          const currentDate = parseISO(dateStr);
          return currentDate >= checkIn && currentDate < checkOut &&
            ['confirmed', 'checked_in'].includes(booking.status);
        });

        const booked = bookingsForDateAndType.length;
        const locksForType = locksByRoomType.get(roomType.id) || [];
        const blocked = locksForType.filter((l: any) =>
          new Date(l.startDate) <= date &&
          (!l.endDate || new Date(l.endDate) >= date)
        ).length;
        const available = totalRoomsForType - booked - blocked;

        data.push({
          date: dateStr,
          roomTypeId: roomType.id,
          total: totalRoomsForType,
          available: Math.max(0, available),
          booked,
          blocked,
          price: roomType.basePrice,
        });
      });
    });

    return data;
  }, [roomTypes, rooms, bookingsByRoomType, locksByRoomType, startDate, endDate]);

  // Get availability for a specific date and room type
  const getAvailability = (date: Date, roomTypeId: string): AvailabilityData | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availabilityData.find(d => d.date === dateStr && d.roomTypeId === roomTypeId);
  };

  // Get availability color
  const getAvailabilityColor = (available: number, total: number) => {
    if (total === 0) return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
    const percent = available / total;
    if (percent === 0) return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    if (percent <= 0.25) return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
    if (percent <= 0.5) return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
    if (percent <= 0.75) return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800';
  };

  // Navigate date range
  const navigateRange = (direction: 'prev' | 'next') => {
    const days = viewMode === 'daily' ? 1 : viewMode === 'weekly' ? 7 : 30;
    const delta = direction === 'prev' ? -days : days;

    setStartDate(prev => addDays(prev, delta));
    setEndDate(prev => addDays(prev, delta));
  };

  // Quick date range selections
  const setQuickRange = (range: 'today' | 'week' | 'month' | 'quarter') => {
    const today = new Date();
    switch (range) {
      case 'today':
        setStartDate(today);
        setEndDate(today);
        break;
      case 'week':
        setStartDate(startOfWeek(today));
        setEndDate(endOfWeek(today));
        break;
      case 'month':
        setStartDate(startOfMonth(today));
        setEndDate(endOfMonth(today));
        break;
      case 'quarter':
        setStartDate(today);
        setEndDate(addDays(today, 90));
        break;
    }
  };

  // Save availability edit
  const handleSaveAvailability = async () => {
    if (!editData) return;
    setConfirmDialog({open:true, title:'Update Availability', message:'Update availability?', onConfirm: async () => {
    setIsSaving(true);

    try {
      // Call the inventory API to update availability
      const response = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(editData.date, 'yyyy-MM-dd'),
          roomTypeId: editData.roomTypeId,
          available: editData.available,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Availability updated successfully',
        });
        setIsEditOpen(false);
        // Refresh data to reflect changes
        refreshData();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update availability',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update availability',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
    }});
    return;
  };

  // Refresh data
  const refreshData = () => {
    fetchData();
  };

  // Export to CSV
  const exportToCsv = () => {
    const headers = ['Date', 'Room Type', 'Total', 'Available', 'Booked', 'Blocked'];
    const rows = availabilityData.map(d => [
      d.date,
      roomTypes.find(rt => rt.id === d.roomTypeId)?.name || '',
      d.total.toString(),
      d.available.toString(),
      d.booked.toString(),
      d.blocked.toString(),
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `availability-${format(startDate, 'yyyy-MM-dd')}-${format(endDate, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: 'Availability exported to CSV',
    });
  };

  // Calculate stats
  const stats = useMemo(() => {
    const totalRooms = rooms.length;
    const avgOccupancy = availabilityData.length > 0
      ? Math.round(
          (1 - availabilityData.reduce((sum, d) => sum + d.available, 0) /
            availabilityData.reduce((sum, d) => sum + d.total, 0)) * 100
        ) || 0
      : 0;

    return {
      totalRooms,
      totalRoomTypes: roomTypes.length,
      avgOccupancy,
      dateRangeDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    };
  }, [rooms, roomTypes, availabilityData, startDate, endDate]);

  // Get dates to display based on view mode
  const displayDates = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Availability Control
          </h2>
          <p className="text-sm text-muted-foreground">
            View and manage room availability by date range
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCsv}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Property Select */}
            <div className="w-full lg:w-48">
              <Label className="text-xs text-muted-foreground mb-1 block">Property</Label>
              <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map(property => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="w-full lg:w-48">
              <Label className="text-xs text-muted-foreground mb-1 block">Start Date</Label>
              <Popover open={isStartCalendarOpen} onOpenChange={setIsStartCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {formatDate(startDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        setStartDate(date);
                        setIsStartCalendarOpen(false);
                      }
                    }}
                    disabled={(date) => date > endDate}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="w-full lg:w-48">
              <Label className="text-xs text-muted-foreground mb-1 block">End Date</Label>
              <Popover open={isEndCalendarOpen} onOpenChange={setIsEndCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {formatDate(endDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date) {
                        setEndDate(date);
                        setIsEndCalendarOpen(false);
                      }
                    }}
                    disabled={(date) => date < startDate}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Quick Range */}
            <div className="w-full lg:w-auto">
              <Label className="text-xs text-muted-foreground mb-1 block">Quick Select</Label>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setQuickRange('today')}>
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickRange('week')}>
                  Week
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickRange('month')}>
                  Month
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickRange('quarter')}>
                  Quarter
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.totalRooms}</div>
          <div className="text-xs text-muted-foreground">Total Rooms</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.totalRoomTypes}</div>
          <div className="text-xs text-muted-foreground">Room Types</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.avgOccupancy}%</div>
          <div className="text-xs text-muted-foreground">Avg Occupancy</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.dateRangeDays}</div>
          <div className="text-xs text-muted-foreground">Days Viewed</div>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
          <Button variant="outline" size="icon" aria-label="Previous period" onClick={() => navigateRange('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[200px] text-center font-medium text-sm">
            {formatDate(startDate)} - {formatDate(endDate)}
          </div>
          <Button variant="outline" size="icon" aria-label="Next period" onClick={() => navigateRange('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
          <Badge variant="outline" className="gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            Available
          </Badge>
          <Badge variant="outline" className="gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            Limited
          </Badge>
          <Badge variant="outline" className="gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            Sold Out
          </Badge>
        </div>
      </div>

      {/* Availability Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : roomTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mb-4" />
              <p>No room types found</p>
              <p className="text-sm">Create room types to view availability</p>
            </div>
          ) : (
            <>
              {displayDates.length > 14 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-md text-sm mb-4 mx-3">
                  Showing first 14 days of {displayDates.length}-day range. Narrow the date range or use pagination.
                </div>
              )}
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[150px]">
                        Room Type
                      </TableHead>
                      {displayDates.slice(0, 14).map((date, idx) => (
                        <TableHead
                          key={idx}
                          className={cn(
                            "text-center min-w-[80px]",
                            isToday(date) && "bg-primary/5"
                          )}
                        >
                          <div className="text-xs text-muted-foreground">
                            {format(date, 'EEE')}
                          </div>
                          <div className={cn(isToday(date) && "font-bold text-primary")}>
                            {format(date, 'd')}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roomTypes.map(roomType => (
                      <TableRow key={roomType.id}>
                        <TableCell className="sticky left-0 bg-background z-10 font-medium">
                          <div>{roomType.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {roomType.totalRooms} rooms
                          </div>
                        </TableCell>
                        {displayDates.slice(0, 14).map((date, idx) => {
                          const availability = getAvailability(date, roomType.id);
                          const isPast = date < new Date();

                          return (
                            <TableCell
                              key={idx}
                              className={cn(
                                "text-center p-2",
                                isToday(date) && "bg-primary/5"
                              )}
                            >
                              {availability && (
                                <div
                                  className={cn(
                                    "rounded-md p-2 text-sm font-medium border",
                                    getAvailabilityColor(availability.available, availability.total),
                                    !isPast && "cursor-pointer hover:opacity-80"
                                  )}
                                  onClick={() => {
                                    if (!isPast) {
                                      setEditData({
                                        date,
                                        roomTypeId: roomType.id,
                                        available: availability.available,
                                      });
                                      setIsEditOpen(true);
                                    }
                                  }}
                                >
                                  <div>{availability.available}/{availability.total}</div>
                                  <div className="text-xs opacity-70">
                                    {formatCurrency(availability.price)}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3 p-3">
                {roomTypes.map(roomType => {
                  const typeData = availabilityData.filter(d => d.roomTypeId === roomType.id);
                  const todayData = getAvailability(new Date(), roomType.id);
                  return (
                    <Card key={roomType.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{roomType.name}</div>
                        {todayData && (
                          <Badge className={cn(
                            "gap-1",
                            getAvailabilityColor(todayData.available, todayData.total)
                          )}>
                            {todayData.available}/{todayData.total} available
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{roomType.totalRooms} rooms | {formatCurrency(roomType.basePrice)}/night</p>
                      <div className="flex gap-2 mt-3">
                        <Button variant="outline" size="sm" className="flex-1 h-9 min-h-[44px]" onClick={() => {
                          setEditData({ date: new Date(), roomTypeId: roomType.id, available: todayData?.available || 0 });
                          setIsEditOpen(true);
                        }}>
                          <Pencil className="h-3 w-3 mr-1" />Edit Today
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 h-9 min-h-[44px]" onClick={exportToCsv}>
                          <Download className="h-3 w-3 mr-1" />Export
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Availability Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Availability</DialogTitle>
            <DialogDescription>
              Adjust the available room count for this date
            </DialogDescription>
          </DialogHeader>
          {editData && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <div className="text-sm font-medium">
                  {formatDateTime(editData.date)}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Room Type</Label>
                <div className="text-sm font-medium">
                  {roomTypes.find(rt => rt.id === editData.roomTypeId)?.name || 'Unknown'}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="available-count">Available Rooms</Label>
                <Input
                  id="available-count"
                  type="number"
                  value={editData.available}
                  onChange={(e) => setEditData(prev => prev ? { ...prev, available: parseInt(e.target.value) || 0 } : null)}
                  min="0"
                  max={rooms.filter(r => r.roomTypeId === editData.roomTypeId).length}
                />
                <p className="text-xs text-muted-foreground">
                  Total rooms for this type: {rooms.filter(r => r.roomTypeId === editData.roomTypeId).length}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAvailability} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Availability Detail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Availability Summary by Room Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {roomTypes.map(roomType => {
              const typeData = availabilityData.filter(d => d.roomTypeId === roomType.id);
              const totalAvailable = typeData.reduce((sum, d) => sum + d.available, 0);
              const totalRooms = typeData.reduce((sum, d) => sum + d.total, 0);
              const avgAvailability = totalRooms > 0 ? Math.round((totalAvailable / totalRooms) * 100) : 0;

              return (
                <div key={roomType.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="font-medium">{roomType.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {roomType.totalRooms} rooms | {formatCurrency(roomType.basePrice)}/night
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{avgAvailability}%</div>
                    <div className="text-xs text-muted-foreground">Avg Availability</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
    {confirmDialog.open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmDialog(prev => ({...prev, open: false}))}>
        <div className="bg-background rounded-lg border p-6 max-w-sm mx-4" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-semibold">{confirmDialog.title}</h3>
          <p className="text-sm text-muted-foreground mt-2">{confirmDialog.message}</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setConfirmDialog(prev => ({...prev, open: false}))}>Cancel</Button>
            <Button size="sm" onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({...prev, open: false})); }}>Confirm</Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
