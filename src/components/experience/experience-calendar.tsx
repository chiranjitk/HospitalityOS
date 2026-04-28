'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  DollarSign,
  Loader2,
  CalendarDays,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay, isToday, isBefore, startOfMonth, endOfMonth } from 'date-fns';

interface ExperienceSummary {
  id: string;
  name: string;
  category: string | null;
  maxParticipants: number;
}

interface CalendarBooking {
  id: string;
  experienceId: string;
  experience: ExperienceSummary;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  bookingDate: string;
  bookingTime: string;
  numberOfGuests: number;
  totalPrice: number;
  status: string;
  specialRequests: string | null;
}

interface DailySummary {
  date: string;
  totalBookings: number;
  totalGuests: number;
  totalRevenue: number;
  maxCapacity: number;
  status: 'available' | 'few_left' | 'fully_booked' | 'unavailable';
}

interface CalendarData {
  month: number;
  year: number;
  bookingsByDate: Record<string, CalendarBooking[]>;
  dailySummary: DailySummary[];
  experiences: ExperienceSummary[];
}

const statusColors: Record<string, string> = {
  confirmed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  completed: 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
};

const dayStatusColors: Record<string, string> = {
  available: 'border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10',
  few_left: 'border-amber-200 dark:border-amber-900 hover:bg-amber-50 dark:hover:bg-amber-950/30',
  fully_booked: 'border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/30',
  unavailable: 'border-gray-200 dark:border-gray-800 opacity-50',
};

const dayStatusDots: Record<string, string> = {
  available: 'bg-primary',
  few_left: 'bg-amber-500',
  fully_booked: 'bg-red-500',
  unavailable: 'bg-gray-400',
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function ExperienceCalendar() {
  const { toast } = useToast();
  const [data, setData] = useState<CalendarData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [experienceFilter, setExperienceFilter] = useState<string>('all');
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchCalendar = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        month: String(currentMonth),
        year: String(currentYear),
      });
      if (experienceFilter !== 'all') {
        params.append('experienceId', experienceFilter);
      }

      const response = await fetch(`/api/experience-calendar?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch calendar data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, currentYear, experienceFilter, toast]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const goToPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today.getMonth() + 1);
    setCurrentYear(today.getFullYear());
  };

  const handleDayClick = (date: string) => {
    const bookings = data?.bookingsByDate[date] || [];
    if (bookings.length > 0 || !isBefore(new Date(date), new Date())) {
      setSelectedDate(date);
      setIsDetailOpen(true);
    }
  };

  // Generate calendar grid
  const getCalendarGrid = () => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();

    const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    // Previous month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const m = currentMonth === 1 ? 12 : currentMonth - 1;
      const y = currentMonth === 1 ? currentYear - 1 : currentYear;
      days.push({
        date: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        day,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        day,
        isCurrentMonth: true,
      });
    }

    // Next month days to fill the grid
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const m = currentMonth === 12 ? 1 : currentMonth + 1;
      const y = currentMonth === 12 ? currentYear + 1 : currentYear;
      days.push({
        date: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        day,
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const calendarDays = getCalendarGrid();
  const selectedBookings = selectedDate && data?.bookingsByDate[selectedDate]
    ? data.bookingsByDate[selectedDate]
    : [];
  const selectedSummary = data?.dailySummary.find(d => d.date === selectedDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Experience Calendar
          </h2>
          <p className="text-sm text-muted-foreground">
            View and manage experience scheduling and availability
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={experienceFilter} onValueChange={setExperienceFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="All Experiences" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Experiences</SelectItem>
              {data?.experiences.map(exp => (
                <SelectItem key={exp.id} value={exp.id}>
                  {exp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          {/* Calendar Navigation */}
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="text-lg font-semibold min-w-[200px] text-center">
                  {monthNames[currentMonth - 1]} {currentYear}
                </h3>
                <Button variant="outline" size="icon" onClick={goToNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={goToToday}>
                <Calendar className="h-4 w-4 mr-2" />
                Today
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {/* Legend */}
            <div className="flex gap-4 mb-4 flex-wrap text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Few Slots Left</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>Fully Booked</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                <span>Past / Unavailable</span>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {calendarDays.map((dayInfo, idx) => {
                const summary = data?.dailySummary.find(d => d.date === dayInfo.date);
                const bookings = data?.bookingsByDate[dayInfo.date] || [];
                const isTodayDate = isToday(new Date(dayInfo.date));
                const status = summary?.status || 'unavailable';

                return (
                  <button
                    key={idx}
                    onClick={() => dayInfo.isCurrentMonth && handleDayClick(dayInfo.date)}
                    disabled={!dayInfo.isCurrentMonth}
                    className={cn(
                      'min-h-[80px] sm:min-h-[100px] p-2 bg-background border text-left transition-colors relative',
                      dayStatusColors[status],
                      !dayInfo.isCurrentMonth && 'opacity-30 cursor-default',
                      dayInfo.isCurrentMonth && 'cursor-pointer',
                      isTodayDate && 'ring-2 ring-primary ring-inset',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isTodayDate && 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs'
                        )}
                      >
                        {dayInfo.day}
                      </span>
                      {dayInfo.isCurrentMonth && bookings.length > 0 && (
                        <div className={cn('w-2 h-2 rounded-full', dayStatusDots[status])} />
                      )}
                    </div>

                    {dayInfo.isCurrentMonth && bookings.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{summary?.totalGuests || 0}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <DollarSign className="h-3 w-3" />
                          <span className="truncate">
                            ${summary?.totalRevenue.toLocaleString() || '0'}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? format(new Date(selectedDate), 'EEEE, MMMM d, yyyy') : ''}
            </DialogTitle>
            <DialogDescription>
              {selectedSummary ? `${selectedSummary.totalBookings} bookings · ${selectedSummary.totalGuests} guests · $${selectedSummary.totalRevenue.toLocaleString()} revenue` : 'No bookings'}
            </DialogDescription>
          </DialogHeader>

          {selectedBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 mb-3" />
              <p>No bookings for this date</p>
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              {selectedBookings.map(booking => (
                <div
                  key={booking.id}
                  className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{booking.experience.name}</p>
                      {booking.experience.category && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          {booking.experience.category}
                        </Badge>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', statusColors[booking.status])}
                    >
                      {booking.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                    <div>
                      <span className="text-muted-foreground">Guest: </span>
                      <span>{booking.guestName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time: </span>
                      <span>{booking.bookingTime}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Guests: </span>
                      <span>{booking.numberOfGuests}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Price: </span>
                      <span>${booking.totalPrice.toLocaleString()}</span>
                    </div>
                  </div>
                  {booking.specialRequests && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      &ldquo;{booking.specialRequests}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
