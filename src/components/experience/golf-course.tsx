'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Plus,
  Calendar,
  Clock,
  Users,
  DollarSign,
  TrendingUp,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Eye,
  Filter,
  RefreshCw,
  Flag,
  Trophy,
  UserPlus,
  CreditCard,
  ArrowUpRight,
  MoreHorizontal,
  CircleDot,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { format, addDays, startOfWeek, subDays } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────

interface GolfCourse {
  id: string;
  name: string;
  description: string | null;
  holes: number;
  par: number;
  yardage: number | null;
  difficulty: string;
  facilities: string;
  isActive: boolean;
  _count?: { teeTimes: number };
}

interface GolfTeeTime {
  id: string;
  courseId: string;
  guestId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  players: number;
  maxPlayers: number;
  holes: number;
  greenFee: number;
  cartFee: number;
  clubRentalFee: number;
  totalAmount: number;
  status: string;
  guestName: string | null;
  guestPhone: string | null;
  notes: string | null;
  golfCourse?: { id: string; name: string; holes: number; par: number };
}

interface GolfMembership {
  id: string;
  guestId: string | null;
  membershipType: string;
  name: string;
  startDate: string;
  endDate: string;
  monthlyFee: number;
  joiningFee: number;
  totalPaid: number;
  status: string;
  autoRenew: boolean;
  notes: string | null;
}

// ── Constants ──────────────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  easy: { label: 'Easy', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: '⛳' },
  moderate: { label: 'Moderate', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: '🏁' },
  difficult: { label: 'Difficult', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', icon: '🏔️' },
  championship: { label: 'Championship', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: '🏆' },
};

const TEE_STATUS: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
  available: { label: 'Available', dotClass: 'bg-emerald-500', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  reserved: { label: 'Reserved', dotClass: 'bg-sky-500', badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  checked_in: { label: 'Checked In', dotClass: 'bg-amber-500', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  completed: { label: 'Completed', dotClass: 'bg-emerald-600', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  cancelled: { label: 'Cancelled', dotClass: 'bg-gray-400', badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  no_show: { label: 'No Show', dotClass: 'bg-red-500', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const MEMBERSHIP_STATUS: Record<string, { label: string; badgeClass: string }> = {
  active: { label: 'Active', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  expired: { label: 'Expired', badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  cancelled: { label: 'Cancelled', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  suspended: { label: 'Suspended', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
};

// ── Component ──────────────────────────────────────────────────────

export default function GolfCourseManagement() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState('courses');
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false);
  const [isTeeTimeDialogOpen, setIsTeeTimeDialogOpen] = useState(false);
  const [isMembershipDialogOpen, setIsMembershipDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<GolfCourse | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('');

  // Data states
  const [courses, setCourses] = useState<GolfCourse[]>([]);
  const [teeTimes, setTeeTimes] = useState<GolfTeeTime[]>([]);
  const [memberships, setMemberships] = useState<GolfMembership[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [courseForm, setCourseForm] = useState({ name: '', description: '', holes: 18, par: 72, yardage: 0, difficulty: 'moderate', facilities: '' });
  const [teeTimeForm, setTeeTimeForm] = useState({ courseId: '', date: '', startTime: '', endTime: '', players: 1, maxPlayers: 4, holes: 18, greenFee: 0, cartFee: 0, clubRentalFee: 0, guestName: '', guestPhone: '', notes: '' });
  const [membershipForm, setMembershipForm] = useState({ name: '', membershipType: 'annual', startDate: '', endDate: '', monthlyFee: 0, joiningFee: 0, autoRenew: false, notes: '' });

  // ── Data fetching ───────────────────────────────────────────────

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (difficultyFilter !== 'all') params.set('difficulty', difficultyFilter);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/experience/golf/courses?${params}`);
      const json = await res.json();
      if (json.success) setCourses(json.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load courses', variant: 'destructive' });
    }
    setLoading(false);
  }, [difficultyFilter, searchQuery, toast]);

  const fetchTeeTimes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('date', selectedDate);
      if (selectedCourse) params.set('courseId', selectedCourse);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/experience/golf/tee-times?${params}`);
      const json = await res.json();
      if (json.success) setTeeTimes(json.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load tee times', variant: 'destructive' });
    }
    setLoading(false);
  }, [selectedDate, selectedCourse, statusFilter, toast]);

  const fetchMemberships = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/experience/golf/memberships?${params}`);
      const json = await res.json();
      if (json.success) setMemberships(json.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load memberships', variant: 'destructive' });
    }
    setLoading(false);
  }, [statusFilter, searchQuery, toast]);

  useEffect(() => {
    const load = () => {
      if (activeTab === 'courses') fetchCourses();
      else if (activeTab === 'tee-times') fetchTeeTimes();
      else if (activeTab === 'memberships') fetchMemberships();
    };
    load();
  }, [activeTab]);

  // ── Stats ───────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const todayBookings = teeTimes.filter(t => t.status !== 'cancelled').length;
    const availableSlots = teeTimes.filter(t => t.status === 'available').length;
    const todayRevenue = teeTimes.filter(t => t.status === 'completed').reduce((s, t) => s + t.totalAmount, 0);
    const activeMemberships = memberships.filter(m => m.status === 'active').length;
    return { todayBookings, availableSlots, todayRevenue, activeMemberships };
  }, [teeTimes, memberships]);

  // ── Handlers ────────────────────────────────────────────────────

  const handleCreateCourse = async () => {
    try {
      const res = await fetch('/api/experience/golf/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...courseForm, propertyId: '00000000-0000-0000-0000-000000000001' }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: 'Course created successfully' });
        setIsCourseDialogOpen(false);
        setCourseForm({ name: '', description: '', holes: 18, par: 72, yardage: 0, difficulty: 'moderate', facilities: '' });
        fetchCourses();
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create course', variant: 'destructive' });
    }
  };

  const handleCreateTeeTime = async () => {
    try {
      const totalAmount = (parseFloat(String(teeTimeForm.greenFee)) + parseFloat(String(teeTimeForm.cartFee)) + parseFloat(String(teeTimeForm.clubRentalFee))) * teeTimeForm.players;
      const res = await fetch('/api/experience/golf/tee-times', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...teeTimeForm,
          date: selectedDate,
          totalAmount,
          status: teeTimeForm.guestName ? 'reserved' : 'available',
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: 'Tee time created successfully' });
        setIsTeeTimeDialogOpen(false);
        fetchTeeTimes();
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create tee time', variant: 'destructive' });
    }
  };

  const handleCreateMembership = async () => {
    try {
      const res = await fetch('/api/experience/golf/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...membershipForm, propertyId: '00000000-0000-0000-0000-000000000001' }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: 'Membership created successfully' });
        setIsMembershipDialogOpen(false);
        fetchMemberships();
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create membership', variant: 'destructive' });
    }
  };

  const handleTeeTimeAction = (id: string, action: string) => {
    toast({ title: 'Success', description: `Tee time ${action}` });
  };

  // ── Render: Stats Cards ────────────────────────────────────────

  const renderStatsCards = () => (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600">{stats.todayBookings}</div>
            <div className="text-xs text-muted-foreground">Today&apos;s Bookings</div>
          </div>
        </div>
      </Card>
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-sky-600">{stats.availableSlots}</div>
            <div className="text-xs text-muted-foreground">Available Slots</div>
          </div>
        </div>
      </Card>
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(stats.todayRevenue)}</div>
            <div className="text-xs text-muted-foreground">Today&apos;s Revenue</div>
          </div>
        </div>
      </Card>
      <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-violet-600">{stats.activeMemberships}</div>
            <div className="text-xs text-muted-foreground">Active Memberships</div>
          </div>
        </div>
      </Card>
    </div>
  );

  // ── Render: Courses Tab ────────────────────────────────────────

  const renderCourses = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search courses..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="moderate">Moderate</SelectItem>
            <SelectItem value="difficult">Difficult</SelectItem>
            <SelectItem value="championship">Championship</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditingCourse(null); setIsCourseDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Add Course
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map(course => {
          const diff = DIFFICULTY_CONFIG[course.difficulty] || DIFFICULTY_CONFIG.moderate;
          let facilities: string[] = [];
          try { facilities = JSON.parse(course.facilities || '{}'); } catch { /* ignore */ }
          return (
            <Card key={course.id} className={cn('overflow-hidden transition-all hover:shadow-lg group', !course.isActive && 'opacity-60')}>
              <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-600" />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-base">{course.name}</h3>
                    {course.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{course.description}</p>}
                  </div>
                  <Badge variant="secondary" className={cn('text-xs shrink-0', diff.color)}>
                    {diff.icon} {diff.label}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-lg font-bold">{course.holes}</div>
                    <div className="text-[10px] text-muted-foreground">Holes</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-lg font-bold">{course.par}</div>
                    <div className="text-[10px] text-muted-foreground">Par</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-lg font-bold">{course.yardage ? `${(course.yardage / 1000).toFixed(1)}k` : '-'}</div>
                    <div className="text-[10px] text-muted-foreground">Yards</div>
                  </div>
                </div>

                {facilities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {facilities.map((f: string) => (
                      <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{course._count?.teeTimes || 0} tee times</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="h-3 w-3" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {courses.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <Flag className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No courses found</p>
          </div>
        )}
      </div>
    </div>
  );

  // ── Render: Tee Times Tab ───────────────────────────────────────

  const renderTeeTimes = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 items-center">
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-40" />
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="reserved">Reserved</SelectItem>
              <SelectItem value="checked_in">Checked In</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setIsTeeTimeDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />New Tee Time
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[520px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Players</TableHead>
                  <TableHead className="hidden sm:table-cell">Holes</TableHead>
                  <TableHead className="hidden md:table-cell">Fees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teeTimes.map(tt => {
                  const st = TEE_STATUS[tt.status] || TEE_STATUS.available;
                  return (
                    <TableRow key={tt.id} className={cn(tt.status === 'cancelled' && 'opacity-50')}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-mono">{format(new Date(tt.startTime), 'HH:mm')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{tt.golfCourse?.name || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{tt.guestName || <span className="text-muted-foreground italic">Open</span>}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{tt.players}/{tt.maxPlayers}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm">{tt.holes}h</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm font-medium">{formatCurrency(tt.totalAmount)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn('text-xs gap-1', st.badgeClass)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', st.dotClass)} />
                          {st.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {tt.status === 'reserved' && (
                              <DropdownMenuItem onClick={() => handleTeeTimeAction(tt.id, 'checked in')}>
                                <CheckCircle2 className="h-4 w-4 mr-2" />Check In
                              </DropdownMenuItem>
                            )}
                            {tt.status !== 'completed' && tt.status !== 'cancelled' && (
                              <DropdownMenuItem onClick={() => handleTeeTimeAction(tt.id, 'cancelled')} className="text-red-600">
                                <XCircle className="h-4 w-4 mr-2" />Cancel
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {teeTimes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No tee times for this date
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  // ── Render: Memberships Tab ────────────────────────────────────

  const renderMemberships = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search memberships..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setIsMembershipDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />New Membership
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[520px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden sm:table-cell">Period</TableHead>
                  <TableHead className="hidden md:table-cell">Monthly Fee</TableHead>
                  <TableHead className="hidden lg:table-cell">Total Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberships.map(m => {
                  const ms = MEMBERSHIP_STATUS[m.status] || MEMBERSHIP_STATUS.active;
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{m.name}</p>
                          {m.autoRenew && <Badge variant="outline" className="text-[10px] mt-1">Auto-renew</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{m.membershipType}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="text-sm">
                          <span>{format(new Date(m.startDate), 'MMM d, yyyy')}</span>
                          <span className="text-muted-foreground mx-1">→</span>
                          <span>{format(new Date(m.endDate), 'MMM d, yyyy')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm font-medium">{formatCurrency(m.monthlyFee)}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm">{formatCurrency(m.totalPaid)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn('text-xs', ms.badgeClass)}>{ms.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {memberships.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No memberships found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  // ── Main Render ────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {renderStatsCards()}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="courses" className="gap-2">
            <Flag className="h-4 w-4" />Courses
          </TabsTrigger>
          <TabsTrigger value="tee-times" className="gap-2">
            <Clock className="h-4 w-4" />Tee Times
          </TabsTrigger>
          <TabsTrigger value="memberships" className="gap-2">
            <Trophy className="h-4 w-4" />Memberships
          </TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-4">{renderCourses()}</TabsContent>
        <TabsContent value="tee-times" className="mt-4">{renderTeeTimes()}</TabsContent>
        <TabsContent value="memberships" className="mt-4">{renderMemberships()}</TabsContent>
      </Tabs>

      {/* Course Dialog */}
      <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCourse ? 'Edit Course' : 'Add Golf Course'}</DialogTitle>
            <DialogDescription>Set up a new golf course for your property</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Name</Label>
                <Input value={courseForm.name} onChange={(e) => setCourseForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Championship Course" />
              </div>
              <div>
                <Label>Holes</Label>
                <Select value={String(courseForm.holes)} onValueChange={(v) => setCourseForm(f => ({ ...f, holes: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9">9 Holes</SelectItem>
                    <SelectItem value="18">18 Holes</SelectItem>
                    <SelectItem value="27">27 Holes</SelectItem>
                    <SelectItem value="36">36 Holes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Par</Label>
                <Input type="number" value={courseForm.par} onChange={(e) => setCourseForm(f => ({ ...f, par: parseInt(e.target.value) || 72 }))} />
              </div>
              <div>
                <Label>Yardage</Label>
                <Input type="number" value={courseForm.yardage} onChange={(e) => setCourseForm(f => ({ ...f, yardage: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Difficulty</Label>
                <Select value={courseForm.difficulty} onValueChange={(v) => setCourseForm(f => ({ ...f, difficulty: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="difficult">Difficult</SelectItem>
                    <SelectItem value="championship">Championship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea value={courseForm.description} onChange={(e) => setCourseForm(f => ({ ...f, description: e.target.value }))} placeholder="Course description..." rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCourseDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCourse}>Create Course</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tee Time Dialog */}
      <Dialog open={isTeeTimeDialogOpen} onOpenChange={setIsTeeTimeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Tee Time</DialogTitle>
            <DialogDescription>Create a new tee time booking</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Course</Label>
                <Select value={teeTimeForm.courseId} onValueChange={(v) => setTeeTimeForm(f => ({ ...f, courseId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>
                    {courses.filter(c => c.isActive).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Time</Label>
                <Input type="time" value={teeTimeForm.startTime} onChange={(e) => setTeeTimeForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div>
                <Label>End Time</Label>
                <Input type="time" value={teeTimeForm.endTime} onChange={(e) => setTeeTimeForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
              <div>
                <Label>Players</Label>
                <Input type="number" min={1} max={4} value={teeTimeForm.players} onChange={(e) => setTeeTimeForm(f => ({ ...f, players: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label>Holes</Label>
                <Select value={String(teeTimeForm.holes)} onValueChange={(v) => setTeeTimeForm(f => ({ ...f, holes: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9">9 Holes</SelectItem>
                    <SelectItem value="18">18 Holes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Green Fee</Label>
                <Input type="number" value={teeTimeForm.greenFee} onChange={(e) => setTeeTimeForm(f => ({ ...f, greenFee: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Cart Fee</Label>
                <Input type="number" value={teeTimeForm.cartFee} onChange={(e) => setTeeTimeForm(f => ({ ...f, cartFee: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Club Rental</Label>
                <Input type="number" value={teeTimeForm.clubRentalFee} onChange={(e) => setTeeTimeForm(f => ({ ...f, clubRentalFee: parseFloat(e.target.value) || 0 }))} />
              </div>
              <Separator className="col-span-2" />
              <div>
                <Label>Guest Name</Label>
                <Input value={teeTimeForm.guestName} onChange={(e) => setTeeTimeForm(f => ({ ...f, guestName: e.target.value }))} placeholder="Optional" />
              </div>
              <div>
                <Label>Guest Phone</Label>
                <Input value={teeTimeForm.guestPhone} onChange={(e) => setTeeTimeForm(f => ({ ...f, guestPhone: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTeeTimeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTeeTime}>Create Tee Time</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Membership Dialog */}
      <Dialog open={isMembershipDialogOpen} onOpenChange={setIsMembershipDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Membership</DialogTitle>
            <DialogDescription>Create a new golf membership</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Member Name</Label>
                <Input value={membershipForm.name} onChange={(e) => setMembershipForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
              </div>
              <div>
                <Label>Membership Type</Label>
                <Select value={membershipForm.membershipType} onValueChange={(v) => setMembershipForm(f => ({ ...f, membershipType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monthly Fee</Label>
                <Input type="number" value={membershipForm.monthlyFee} onChange={(e) => setMembershipForm(f => ({ ...f, monthlyFee: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={membershipForm.startDate} onChange={(e) => setMembershipForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={membershipForm.endDate} onChange={(e) => setMembershipForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
              <div>
                <Label>Joining Fee</Label>
                <Input type="number" value={membershipForm.joiningFee} onChange={(e) => setMembershipForm(f => ({ ...f, joiningFee: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <Switch checked={membershipForm.autoRenew} onCheckedChange={(v) => setMembershipForm(f => ({ ...f, autoRenew: v }))} />
                <Label>Auto-renew membership</Label>
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={membershipForm.notes} onChange={(e) => setMembershipForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMembershipDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateMembership}>Create Membership</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
