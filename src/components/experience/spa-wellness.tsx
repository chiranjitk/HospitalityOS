'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
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
  Calendar,
  Clock,
  Users,
  Star,
  TrendingUp,
  Heart,
  Sparkles,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  MapPin,
  DollarSign,
  UserCircle,
  Award,
  ThumbsUp,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────

interface SpaAppointment {
  id: string;
  time: string;
  guestName: string;
  guestRoom: string;
  treatment: string;
  therapist: string;
  room: string;
  duration: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'no_show' | 'cancelled';
  price: number;
}

interface SpaTreatment {
  id: string;
  name: string;
  category: 'massage' | 'facial' | 'body' | 'wellness' | 'beauty';
  duration: number;
  price: number;
  description: string;
  therapistCount: number;
  rating: number;
  totalBookings: number;
  isActive: boolean;
}

interface SpaTherapist {
  id: string;
  name: string;
  avatar: string;
  specialties: string[];
  schedule: string;
  rating: number;
  totalSessions: number;
  availability: 'available' | 'busy' | 'off' | 'break';
  todayAppointments: number;
  revenue: number;
}

interface RevenueByType {
  type: string;
  revenue: number;
  percentage: number;
  sessions: number;
  growth: number;
}

// ── Mock Data removed — now fetched from API ──

// ── Constants ──────────────────────────────────────────────────────────

const APPOINTMENT_STATUS: Record<string, { label: string; color: string; badgeClass: string }> = {
  scheduled: { label: 'Scheduled', color: 'bg-sky-500', badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  in_progress: { label: 'In Progress', color: 'bg-amber-500', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  completed: { label: 'Completed', color: 'bg-emerald-500', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  no_show: { label: 'No Show', color: 'bg-red-500', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500', badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  massage: { label: 'Massage', color: 'from-violet-500 to-purple-600', icon: '💆' },
  facial: { label: 'Facial', color: 'from-pink-500 to-rose-600', icon: '✨' },
  body: { label: 'Body', color: 'from-amber-500 to-orange-600', icon: '🌿' },
  wellness: { label: 'Wellness', color: 'from-emerald-500 to-teal-600', icon: '🧘' },
  beauty: { label: 'Beauty', color: 'from-cyan-500 to-blue-600', icon: '💄' },
};

const THERAPIST_AVAILABILITY: Record<string, { label: string; color: string; dotClass: string }> = {
  available: { label: 'Available', color: 'bg-emerald-500', dotClass: 'bg-emerald-500' },
  busy: { label: 'With Guest', color: 'bg-amber-500', dotClass: 'bg-amber-500' },
  break: { label: 'On Break', color: 'bg-sky-500', dotClass: 'bg-sky-500' },
  off: { label: 'Off Duty', color: 'bg-gray-400', dotClass: 'bg-gray-400' },
};

const TIME_SLOTS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];

// ── Component ──────────────────────────────────────────────────────────

export default function SpaWellness() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState('appointments');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTreatmentDetailOpen, setIsTreatmentDetailOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<SpaAppointment | null>(null);
  const [selectedTreatment, setSelectedTreatment] = useState<SpaTreatment | null>(null);
  const [revenuePeriod, setRevenuePeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // ── API Data State ────────────────────────────────────────────────
  const [appointments, setAppointments] = useState<SpaAppointment[]>([]);
  const [treatments, setTreatments] = useState<SpaTreatment[]>([]);
  const [therapists, setTherapists] = useState<SpaTherapist[]>([]);
  const [revenue, setRevenue] = useState<RevenueByType[]>([]);
  const [spaLoading, setSpaLoading] = useState(true);
  const [spaError, setSpaError] = useState<string | null>(null);

  // Top-level stats from API
  const [apiStats, setApiStats] = useState<Record<string, number> | null>(null);
  // Full revenue stats (today/week/month) from API
  interface ApiPeriodStats {
    bookings: number;
    revenue: number;
    avgSpendPerGuest: number;
    occupancy: number;
    topTreatment: string;
    noShows: number;
    cancellations: number;
    revenueVsLastMonth?: number;
  }
  interface ApiRevenueStats {
    today: ApiPeriodStats;
    thisWeek: ApiPeriodStats;
    thisMonth: ApiPeriodStats;
    byCategory: RevenueByType[];
    revenueTrend: Array<{ date: string; revenue: number; bookings: number; avgRating: number }>;
  }
  const [apiRevenueStats, setApiRevenueStats] = useState<ApiRevenueStats | null>(null);

  const fetchSpaData = useCallback(async () => {
    setSpaLoading(true);
    setSpaError(null);
    try {
      const res = await fetch('/api/experience/spa');
      if (!res.ok) throw new Error('Failed to fetch spa data');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to fetch spa data');

      const { appointments: apiApts, treatments: apiTrts, therapists: apiThs, revenueStats } = json.data;

      // Map appointments
      const mappedApts: SpaAppointment[] = (apiApts || []).map((a: Record<string, unknown>) => ({
        id: a.id,
        time: a.startTime || '',
        guestName: a.guestName || 'Guest',
        guestRoom: a.roomNumber || '',
        treatment: a.treatmentName || '',
        therapist: a.therapistName || '',
        room: a.location || '',
        duration: a.duration || 60,
        status: (a.status || 'scheduled') as SpaAppointment['status'],
        price: a.price || 0,
      }));

      // Map treatments
      const mappedTrts: SpaTreatment[] = (apiTrts || []).map((t: Record<string, unknown>) => ({
        id: t.id,
        name: t.name || '',
        category: (t.category || 'massage').toLowerCase() as SpaTreatment['category'],
        duration: t.duration || 60,
        price: t.price || 0,
        description: t.description || '',
        therapistCount: 1,
        rating: t.rating || 4.5,
        totalBookings: t.popularity || 0,
        isActive: t.status === 'active',
      }));

      // Map therapists
      const mappedThs: SpaTherapist[] = (apiThs || []).map((t: Record<string, unknown>) => {
        const specs = Array.isArray(t.specialization) ? t.specialization : [];
        return {
          id: t.id,
          name: t.name || '',
          avatar: (t.name || '').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
          specialties: specs as string[],
          schedule: `${t.shiftStart || '09:00'} - ${t.shiftEnd || '18:00'}`,
          rating: t.rating || 4.5,
          totalSessions: 0,
          availability: (t.status || 'available') as SpaTherapist['availability'],
          todayAppointments: 0,
          revenue: 0,
        };
      });

      // Map revenue by category
      const mappedRev: RevenueByType[] = (revenueStats?.byCategory || []).map((c: Record<string, unknown>) => {
        const cat = (c.category || 'Other').charAt(0).toUpperCase() + (c.category || 'Other').slice(1);
        return {
          type: cat,
          revenue: Number(c.revenue) || 0,
          percentage: Number(c.percentage) || 0,
          sessions: Number(c.bookings) || 0,
          growth: 0,
        };
      });

      setAppointments(mappedApts);
      setTreatments(mappedTrts);
      setTherapists(mappedThs);
      setRevenue(mappedRev);

      // Store top-level stats
      if (json.stats) setApiStats(json.stats);
      // Store full revenue period stats
      if (revenueStats) setApiRevenueStats(revenueStats);
    } catch (err) {
      console.error('Error fetching spa data:', err);
      setSpaError(err instanceof Error ? err.message : 'Failed to load spa data');
    } finally {
      setSpaLoading(false);
    }
  }, []);

  useEffect(() => { fetchSpaData(); }, [fetchSpaData]);

  // ── Computed values (ALL hooks must be before any conditional returns) ──

  const today = new Date();
  const calendarDate = format(today, 'EEEE, MMMM d, yyyy');

  const stats = useMemo(() => {
    const todayBookings = apiStats?.todayBookings ?? appointments.length;
    const availableTherapists = therapists.filter(t => t.availability === 'available').length;
    const weekRevenue = apiRevenueStats?.thisWeek?.revenue ?? 0;
    const satisfaction = therapists.length > 0
      ? parseFloat((therapists.reduce((sum, t) => sum + t.rating, 0) / therapists.length).toFixed(1))
      : 0;
    return { todayBookings, availableTherapists, weekRevenue, satisfaction };
  }, [appointments, therapists, apiStats, apiRevenueStats]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return a.guestName.toLowerCase().includes(q) || a.treatment.toLowerCase().includes(q) || a.therapist.toLowerCase().includes(q);
      }
      return true;
    });
  }, [searchQuery, statusFilter, appointments]);

  const filteredTreatments = useMemo(() => {
    return treatments.filter(t => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [searchQuery, categoryFilter, treatments]);

  const filteredTherapists = useMemo(() => {
    if (!searchQuery) return therapists;
    const q = searchQuery.toLowerCase();
    return therapists.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.specialties.some(s => s.toLowerCase().includes(q))
    );
  }, [searchQuery, therapists]);

  const totalRevenue = useMemo(() => revenue.reduce((s, r) => s + r.revenue, 0), [revenue]);
  const maxRevenue = useMemo(() => revenue.length > 0 ? Math.max(...revenue.map(r => r.revenue)) : 1, [revenue]);

  // ── Loading / Error guards (AFTER all hooks) ──────────────────────

  if (spaLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (spaError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-muted-foreground">{spaError}</p>
        <Button variant="outline" onClick={fetchSpaData}>Try Again</Button>
      </div>
    );
  }

  // ── Handlers ───────────────────────────────────────────────────────

  const handleAppointmentAction = (action: string) => {
    toast({ title: 'Success', description: `Appointment ${action} successfully` });
    setIsDetailOpen(false);
  };

  const handleToggleTreatment = (treatment: SpaTreatment) => {
    toast({
      title: treatment.isActive ? 'Treatment Deactivated' : 'Treatment Activated',
      description: `${treatment.name} is now ${treatment.isActive ? 'inactive' : 'active'}`,
    });
  };

  // ── Helper: render stars ──────────────────────────────────────────

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn(
            'h-3 w-3',
            i <= Math.round(rating) ? 'text-amber-500 fill-amber-500' : 'text-gray-300 dark:text-gray-600'
          )}
        />
      ))}
      <span className="text-xs ml-1 text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );

  // ── Helper: format duration ──────────────────────────────────────

  const formatDuration = (min: number) => {
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // ── Render: Appointment status badge ─────────────────────────────

  const renderStatusBadge = (status: string) => {
    const cfg = APPOINTMENT_STATUS[status];
    if (!cfg) return null;
    return (
      <Badge variant="secondary" className={cn('text-xs font-medium gap-1', cfg.badgeClass)}>
        <span className={cn('h-1.5 w-1.5 rounded-full', cfg.color)} />
        {cfg.label}
      </Badge>
    );
  };

  // ── Render: Stat cards ───────────────────────────────────────────

  const renderStatCards = () => (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-400 bg-clip-text text-transparent">
              {stats.todayBookings}
            </div>
            <div className="text-xs text-muted-foreground">Today&apos;s Bookings</div>
          </div>
        </div>
      </Card>
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
            <UserCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent">
              {stats.availableTherapists}
            </div>
            <div className="text-xs text-muted-foreground">Available Therapists</div>
          </div>
        </div>
      </Card>
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-400 bg-clip-text text-transparent">
              {formatCurrency(stats.weekRevenue)}
            </div>
            <div className="text-xs text-muted-foreground">Revenue This Week</div>
          </div>
        </div>
      </Card>
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg shadow-pink-500/20">
            <Heart className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-rose-400 bg-clip-text text-transparent">
              {stats.satisfaction}/5.0
            </div>
            <div className="text-xs text-muted-foreground">Guest Satisfaction</div>
          </div>
        </div>
      </Card>
    </div>
  );

  // ── Render: Appointments tab ─────────────────────────────────────

  const renderAppointments = () => (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h3 className="font-semibold text-sm">{calendarDate}</h3>
              <p className="text-xs text-muted-foreground">
                {filteredAppointments.length} appointments
              </p>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="max-h-[520px]">
          {/* Time grid header */}
          <div className="sticky top-0 bg-background z-10 grid grid-cols-[70px_1fr] border-b px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground">Time</span>
            <span className="text-xs font-medium text-muted-foreground">Appointment Details</span>
          </div>

          {TIME_SLOTS.map(slot => {
            const appointments = filteredAppointments.filter(a => a.time === slot);
            if (appointments.length === 0) {
              return (
                <div
                  key={slot}
                  className="grid grid-cols-[70px_1fr] border-b px-4 py-2 min-h-[48px] items-center opacity-40"
                >
                  <span className="text-xs font-mono text-muted-foreground">{slot}</span>
                  <span className="text-xs text-muted-foreground italic">Available</span>
                </div>
              );
            }
            return (
              <React.Fragment key={slot}>
                {appointments.map((apt, idx) => (
                  <div
                    key={apt.id}
                    className={cn(
                      'grid grid-cols-[70px_1fr] border-b px-4 py-3 min-h-[56px] items-center cursor-pointer transition-colors hover:bg-muted/50',
                      idx === 0 && 'border-t',
                      apt.status === 'completed' && 'bg-emerald-50/30 dark:bg-emerald-950/10',
                      apt.status === 'no_show' && 'bg-red-50/30 dark:bg-red-950/10',
                      apt.status === 'cancelled' && 'opacity-50',
                    )}
                    onClick={() => { setSelectedAppointment(apt); setIsDetailOpen(true); }}
                  >
                    <span className="text-xs font-mono font-medium text-muted-foreground">
                      {idx === 0 ? slot : ''}
                    </span>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        APPOINTMENT_STATUS[apt.status]?.color || 'bg-gray-400'
                      )} />
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-1 sm:gap-4 items-center">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{apt.guestName}</span>
                            <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                              Room {apt.guestRoom}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{apt.treatment}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground hidden md:inline">
                            <UserCircle className="h-3 w-3 inline mr-1" />
                            {apt.therapist}
                          </span>
                          <span className="text-xs text-muted-foreground hidden lg:inline">
                            <MapPin className="h-3 w-3 inline mr-1" />
                            {apt.room}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {formatDuration(apt.duration)}
                          </span>
                          {renderStatusBadge(apt.status)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </React.Fragment>
            );
          })}
        </ScrollArea>
      </CardContent>
    </Card>
  );

  // ── Render: Treatment Catalog tab ────────────────────────────────

  const renderTreatmentCatalog = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search treatments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="massage">Massage</SelectItem>
            <SelectItem value="facial">Facial</SelectItem>
            <SelectItem value="body">Body</SelectItem>
            <SelectItem value="wellness">Wellness</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredTreatments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Heart className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">No treatments found</p>
          <p className="text-sm">Try adjusting your search or filter criteria</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTreatments.map(treatment => {
          const cat = CATEGORY_CONFIG[treatment.category];
          return (
            <Card
              key={treatment.id}
              className={cn(
                'overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group cursor-pointer',
                !treatment.isActive && 'opacity-60',
              )}
              onClick={() => { setSelectedTreatment(treatment); setIsTreatmentDetailOpen(true); }}
            >
              <div className={cn('h-2 bg-gradient-to-r', cat?.color || 'from-gray-400 to-gray-500')} />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat?.icon || '💆'}</span>
                    <Badge variant="secondary" className="text-[10px]">{cat?.label || treatment.category}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {!treatment.isActive && (
                      <Badge variant="outline" className="text-[10px] text-red-500 border-red-200">Inactive</Badge>
                    )}
                    <Switch
                      checked={treatment.isActive}
                      onCheckedChange={() => handleToggleTreatment(treatment)}
                      onClick={(e) => e.stopPropagation()}
                      className="scale-75"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-sm">{treatment.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{treatment.description}</p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDuration(treatment.duration)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Users className="h-2.5 w-2.5" />
                    {treatment.therapistCount} therapist{treatment.therapistCount > 1 ? 's' : ''}
                  </Badge>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <span className="font-bold text-base bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent">
                      {formatCurrency(treatment.price)}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1">/ session</span>
                  </div>
                  {renderStars(treatment.rating)}
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{treatment.totalBookings} bookings</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); setSelectedTreatment(treatment); setIsTreatmentDetailOpen(true); }}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}
    </div>
  );

  // ── Render: Therapists tab ───────────────────────────────────────

  const renderTherapists = () => (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[520px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Therapist</TableHead>
                <TableHead className="hidden md:table-cell">Specialties</TableHead>
                <TableHead className="hidden sm:table-cell">Schedule</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="hidden sm:table-cell">Today</TableHead>
                <TableHead className="hidden lg:table-cell">Revenue</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTherapists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>No therapists found</p>
                    <p className="text-xs">Try adjusting your search</p>
                  </TableCell>
                </TableRow>
              ) : (
              filteredTherapists.map(therapist => {
                const avail = THERAPIST_AVAILABILITY[therapist.availability];
                return (
                  <TableRow key={therapist.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br',
                          therapist.availability === 'available' ? 'from-emerald-500 to-teal-600' :
                          therapist.availability === 'busy' ? 'from-amber-500 to-orange-600' :
                          therapist.availability === 'off' ? 'from-gray-400 to-gray-500' :
                          'from-sky-500 to-blue-600',
                        )}>
                          {therapist.avatar}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{therapist.name}</p>
                          <p className="text-xs text-muted-foreground">{therapist.totalSessions} total sessions</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {therapist.specialties.slice(0, 3).map(s => (
                          <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                        ))}
                        {therapist.specialties.length > 3 && (
                          <Badge variant="outline" className="text-[10px]">+{therapist.specialties.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {therapist.schedule}
                      </div>
                    </TableCell>
                    <TableCell>
                      {renderStars(therapist.rating)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-sm font-medium">{therapist.todayAppointments}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="font-medium text-sm">{formatCurrency(therapist.revenue)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn('text-xs gap-1', avail?.badgeClass || '')}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', avail?.dotClass)} />
                        {avail?.label || therapist.availability}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              }))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  // ── Render: Revenue tab ──────────────────────────────────────────

  const renderRevenue = () => {
    const periodRevenue = revenuePeriod === 'daily'
      ? (apiRevenueStats?.today?.revenue ?? 0)
      : revenuePeriod === 'weekly'
        ? (apiRevenueStats?.thisWeek?.revenue ?? 0)
        : (apiRevenueStats?.thisMonth?.revenue ?? totalRevenue);
    const periodLabel = revenuePeriod === 'daily' ? 'Today' : revenuePeriod === 'weekly' ? 'This Week' : 'This Month';
    return (
      <div className="space-y-6">
        {/* Period selector + summary */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly'] as const).map(p => (
              <Button
                key={p}
                variant={revenuePeriod === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRevenuePeriod(p)}
                className="capitalize"
              >
                {p}
              </Button>
            ))}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-400 bg-clip-text text-transparent">
              {formatCurrency(periodRevenue)}
            </p>
            <p className="text-xs text-muted-foreground">
              {periodLabel} Total
            </p>
          </div>
        </div>

        {/* Revenue by treatment type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Revenue by Treatment Type
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {revenue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <DollarSign className="h-8 w-8 mb-2 opacity-40" />
                <p className="font-medium">No revenue data available</p>
                <p className="text-sm">Revenue data will appear as bookings are completed</p>
              </div>
            ) : (
            revenue.map(item => (
              <div key={item.type} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.type}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {item.sessions} sessions
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{item.percentage}%</span>
                    <span className="font-semibold">{formatCurrency(item.revenue)}</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px] gap-0.5',
                        item.growth > 10
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
                      )}
                    >
                      <TrendingUp className="h-2.5 w-2.5" />
                      +{item.growth}%
                    </Badge>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-700"
                    style={{ width: `${(item.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
              </div>
            )))}
          </CardContent>
        </Card>

        {/* Quick stats row */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Sparkles className="h-4 w-4 text-violet-500 dark:text-violet-400" />
              </div>
              <div>
                <div className="text-xl font-bold">{revenue.reduce((s, r) => s + r.sessions, 0)}</div>
                <div className="text-[10px] text-muted-foreground">Total Sessions</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <DollarSign className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <div className="text-xl font-bold">{formatCurrency(apiRevenueStats?.thisMonth?.avgSpendPerGuest ?? 0)}</div>
                <div className="text-[10px] text-muted-foreground">Avg Revenue/Session</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <ThumbsUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              </div>
              <div>
                <div className="text-xl font-bold">{apiRevenueStats?.thisMonth
                  ? Math.round(((apiRevenueStats.thisMonth.bookings - (apiRevenueStats.thisMonth.noShows ?? 0)) / Math.max(apiRevenueStats.thisMonth.bookings, 1)) * 100) + '%'
                  : '—'}</div>
                <div className="text-[10px] text-muted-foreground">Show-Up Rate</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Award className="h-4 w-4 text-pink-500 dark:text-pink-400" />
              </div>
              <div>
                <div className="text-xl font-bold">{apiRevenueStats?.thisMonth?.occupancy
                  ? Math.min(apiRevenueStats.thisMonth.occupancy, 100) + '%'
                  : '—'}</div>
                <div className="text-[10px] text-muted-foreground">Occupancy Rate</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // ── Render: Appointment Detail dialog ────────────────────────────

  const renderAppointmentDetail = () => {
    if (!selectedAppointment) return null;
    const apt = selectedAppointment;
    return (
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              Appointment Details
            </DialogTitle>
            <DialogDescription>{apt.treatment}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Guest</p>
                <p className="font-medium text-sm">{apt.guestName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Room</p>
                <p className="font-medium text-sm">{apt.guestRoom}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Time</p>
                <p className="font-medium text-sm">{apt.time} ({formatDuration(apt.duration)})</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Price</p>
                <p className="font-medium text-sm">{formatCurrency(apt.price)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Therapist</p>
                <p className="font-medium text-sm">{apt.therapist}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Room</p>
                <p className="font-medium text-sm">{apt.room}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              {renderStatusBadge(apt.status)}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {apt.status === 'scheduled' && (
              <>
                <Button variant="outline" onClick={() => handleAppointmentAction('cancelled')} className="text-red-500 border-red-200 hover:bg-red-50">
                  Cancel
                </Button>
                <Button onClick={() => handleAppointmentAction('started')}>
                  Start Treatment
                </Button>
              </>
            )}
            {apt.status === 'in_progress' && (
              <Button onClick={() => handleAppointmentAction('completed')}>
                Complete
              </Button>
            )}
            {(apt.status === 'completed' || apt.status === 'no_show') && (
              <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ── Render: Treatment Detail dialog ──────────────────────────────

  const renderTreatmentDetail = () => {
    if (!selectedTreatment) return null;
    const tr = selectedTreatment;
    const cat = CATEGORY_CONFIG[tr.category];
    return (
      <Dialog open={isTreatmentDetailOpen} onOpenChange={setIsTreatmentDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">{cat?.icon}</span>
              {tr.name}
            </DialogTitle>
            <DialogDescription>{tr.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Category</p>
                <Badge variant="secondary">{cat?.label || tr.category}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-medium text-sm flex items-center gap-1">
                  <Clock className="h-3 w-3" />{formatDuration(tr.duration)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Price</p>
                <p className="font-bold text-lg">{formatCurrency(tr.price)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Rating</p>
                {renderStars(tr.rating)}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Bookings</p>
                <p className="font-medium text-sm">{tr.totalBookings}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant="secondary" className={cn(tr.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-700')}>
                  {tr.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Estimated Revenue</p>
              <p className="font-bold text-xl bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent">
                {formatCurrency(tr.price * tr.totalBookings)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTreatmentDetailOpen(false)}>Close</Button>
            <Button>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Treatment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ── Main render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Spa &amp; Wellness Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage appointments, treatments, therapists, and wellness revenue
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSpaData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Stats */}
      {renderStatCards()}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearchQuery(''); setStatusFilter('all'); setCategoryFilter('all'); }}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="appointments" className="text-xs sm:text-sm">
            <Calendar className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Appointments
          </TabsTrigger>
          <TabsTrigger value="treatments" className="text-xs sm:text-sm">
            <Heart className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Treatments
          </TabsTrigger>
          <TabsTrigger value="therapists" className="text-xs sm:text-sm">
            <Users className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Therapists
          </TabsTrigger>
          <TabsTrigger value="revenue" className="text-xs sm:text-sm">
            <TrendingUp className="h-4 w-4 mr-1.5 hidden sm:inline" />
            Revenue
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="appointments">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Search by guest, treatment, or therapist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 mb-4"
              />
            </div>
            {renderAppointments()}
          </TabsContent>

          <TabsContent value="treatments">
            {renderTreatmentCatalog()}
          </TabsContent>

          <TabsContent value="therapists">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Search therapists by name or specialty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {renderTherapists()}
          </TabsContent>

          <TabsContent value="revenue">
            {renderRevenue()}
          </TabsContent>
        </div>
      </Tabs>

      {/* Dialogs */}
      {renderAppointmentDetail()}
      {renderTreatmentDetail()}

      {/* New Appointment dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Appointment</DialogTitle>
            <DialogDescription>Book a spa appointment for a guest</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Guest Name</Label>
                <Input placeholder="Search guest..." />
              </div>
              <div className="space-y-2">
                <Label>Room Number</Label>
                <Input placeholder="e.g., 301" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Treatment</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Select treatment" /></SelectTrigger>
                <SelectContent>
                  {treatments.filter(t => t.isActive).map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} — {formatCurrency(t.price)} ({formatDuration(t.duration)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" defaultValue={format(today, 'yyyy-MM-dd')} />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select time" /></SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(slot => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Therapist</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Auto-assign or select" /></SelectTrigger>
                <SelectContent>
                  {therapists.filter(t => t.availability === 'available').map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Special requests or preferences..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => { toast({ title: 'Success', description: 'Appointment created' }); setIsCreateOpen(false); }}>
              <Plus className="h-4 w-4 mr-2" />
              Book Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
