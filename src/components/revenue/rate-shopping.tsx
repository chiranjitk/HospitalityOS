'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format, addDays, differenceInDays, startOfDay } from 'date-fns';
import {
  Search,
  Calendar,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  MapPin,
  Bell,
  BellRing,
  FileDown,
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Hotel,
  Globe,
  Eye,
  Target,
  Zap,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

type Channel = 'booking_com' | 'expedia' | 'airbnb' | 'tripadvisor' | 'agoda' | 'makemytrip' | 'goibibo' | 'direct';
type ParityStatus = 'par' | 'higher' | 'lower' | 'not_available';
type DemandLevel = 'low' | 'medium' | 'high';
type MarketSegment = 'budget' | 'mid' | 'premium' | 'luxury';

interface ChannelInfo {
  id: Channel;
  name: string;
  color: string;
  bgColor: string;
}

interface CompetitorRate {
  date: string;
  ourRate: number;
  competitorRates: Record<string, number | null>;
}

interface ParityAlert {
  id: string;
  channel: Channel;
  threshold: number;
  isActive: boolean;
  createdAt: string;
  channelName: string;
}

interface RateCalendarDay {
  date: string;
  ourRate: number;
  marketAvg: number;
  demand: DemandLevel;
  color: string;
}

interface CompetitorProperty {
  id: string;
  name: string;
  starRating: number;
  segment: MarketSegment;
  avgRate: number;
  distance: number;
  channels: Channel[];
}

// ============================================================
// Constants
// ============================================================

const CHANNELS: ChannelInfo[] = [
  { id: 'booking_com', name: 'Booking.com', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900' },
  { id: 'expedia', name: 'Expedia', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900' },
  { id: 'airbnb', name: 'Airbnb', color: 'text-rose-600', bgColor: 'bg-rose-100 dark:bg-rose-900' },
  { id: 'tripadvisor', name: 'TripAdvisor', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900' },
  { id: 'agoda', name: 'Agoda', color: 'text-sky-600', bgColor: 'bg-sky-100 dark:bg-sky-900' },
  { id: 'makemytrip', name: 'MakeMyTrip', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900' },
  { id: 'goibibo', name: 'Goibibo', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900' },
  { id: 'direct', name: 'Direct', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900' },
];

const ROOM_TYPES = [
  { value: 'all', label: 'All Room Types' },
  { value: 'standard', label: 'Standard Room' },
  { value: 'deluxe', label: 'Deluxe Room' },
  { value: 'superior', label: 'Superior Room' },
  { value: 'suite', label: 'Suite' },
  { value: 'presidential', label: 'Presidential Suite' },
];

const COMPETITOR_PROPERTIES: CompetitorProperty[] = [
  {
    id: 'comp-1',
    name: 'Grand Palace Hotel',
    starRating: 5,
    segment: 'luxury',
    avgRate: 285,
    distance: 0.3,
    channels: ['booking_com', 'expedia', 'direct', 'tripadvisor'],
  },
  {
    id: 'comp-2',
    name: 'City View Inn',
    starRating: 4,
    segment: 'premium',
    avgRate: 195,
    distance: 0.5,
    channels: ['booking_com', 'expedia', 'airbnb', 'agoda', 'makemytrip'],
  },
  {
    id: 'comp-3',
    name: 'Marina Bay Resort',
    starRating: 5,
    segment: 'luxury',
    avgRate: 310,
    distance: 1.2,
    channels: ['booking_com', 'expedia', 'direct', 'tripadvisor', 'agoda'],
  },
  {
    id: 'comp-4',
    name: 'Comfort Stay Express',
    starRating: 3,
    segment: 'mid',
    avgRate: 120,
    distance: 0.8,
    channels: ['booking_com', 'expedia', 'agoda', 'makemytrip', 'goibibo'],
  },
  {
    id: 'comp-5',
    name: 'Heritage Boutique Hotel',
    starRating: 4,
    segment: 'premium',
    avgRate: 175,
    distance: 0.4,
    channels: ['booking_com', 'expedia', 'airbnb', 'tripadvisor', 'makemytrip'],
  },
  {
    id: 'comp-6',
    name: 'Budget Lodge Plus',
    starRating: 2,
    segment: 'budget',
    avgRate: 75,
    distance: 1.5,
    channels: ['booking_com', 'agoda', 'makemytrip', 'goibibo'],
  },
];

const PARITY_STATUS_CONFIG: Record<ParityStatus, { label: string; color: string; icon: React.ReactNode }> = {
  par: {
    label: 'Par',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  higher: {
    label: 'Higher',
    color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    icon: <ArrowUpRight className="h-3.5 w-3.5" />,
  },
  lower: {
    label: 'Lower',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    icon: <ArrowDownRight className="h-3.5 w-3.5" />,
  },
  not_available: {
    label: 'N/A',
    color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    icon: <Minus className="h-3.5 w-3.5" />,
  },
};

const DEMAND_CONFIG: Record<DemandLevel, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Low', color: 'text-sky-600', bgColor: 'bg-sky-100 dark:bg-sky-900' },
  medium: { label: 'Medium', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900' },
  high: { label: 'High', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900' },
};

const SEGMENT_CONFIG: Record<MarketSegment, { label: string; color: string; bgColor: string }> = {
  budget: { label: 'Budget', color: 'text-sky-700', bgColor: 'bg-sky-100 dark:bg-sky-900' },
  mid: { label: 'Mid-Range', color: 'text-emerald-700', bgColor: 'bg-emerald-100 dark:bg-emerald-900' },
  premium: { label: 'Premium', color: 'text-violet-700', bgColor: 'bg-violet-100 dark:bg-violet-900' },
  luxury: { label: 'Luxury', color: 'text-amber-700', bgColor: 'bg-amber-100 dark:bg-amber-900' },
};

// ============================================================
// Helpers
// ============================================================

function generateRateData(startDate: Date, endDate: Date, roomType: string): CompetitorRate[] {
  const days = differenceInDays(endDate, startDate) + 1;
  const rates: CompetitorRate[] = [];
  const baseRate = roomType === 'standard' ? 150 : roomType === 'deluxe' ? 220 : roomType === 'superior' ? 280 : roomType === 'suite' ? 380 : 550;
  const weekendMultiplier = 1.25;
  const weekdayMultiplier = 1.0;

  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
    const isPeak = date.getMonth() >= 10 || (date.getMonth() >= 5 && date.getMonth() <= 7);
    const seasonalMult = isPeak ? 1.3 : 1.0;
    const noise = () => 0.95 + Math.random() * 0.1;

    const ourRate = Math.round(baseRate * (isWeekend ? weekendMultiplier : weekdayMultiplier) * seasonalMult * noise());

    const competitorRates: Record<string, number | null> = {};
    COMPETITOR_PROPERTIES.forEach((comp) => {
      const compNoise = () => 0.92 + Math.random() * 0.16;
      const segmentFactor = comp.segment === 'luxury' ? 1.4 : comp.segment === 'premium' ? 1.1 : comp.segment === 'mid' ? 0.85 : 0.6;
      const rate = Math.round(ourRate * segmentFactor * compNoise());
      if (Math.random() > 0.1) {
        competitorRates[comp.id] = rate;
      } else {
        competitorRates[comp.id] = null;
      }
    });

    rates.push({
      date: format(date, 'yyyy-MM-dd'),
      ourRate,
      competitorRates,
    });
  }
  return rates;
}

function getParityStatus(ourRate: number, competitorRate: number | null): ParityStatus {
  if (competitorRate === null) return 'not_available';
  const diff = ((ourRate - competitorRate) / competitorRate) * 100;
  if (Math.abs(diff) <= 3) return 'par';
  if (diff > 0) return 'higher';
  return 'lower';
}

function getDemandLevel(occupancyHint: number): DemandLevel {
  if (occupancyHint < 40) return 'low';
  if (occupancyHint < 70) return 'medium';
  return 'high';
}

function getCalendarColor(ourRate: number, marketAvg: number): string {
  const diff = ((ourRate - marketAvg) / marketAvg) * 100;
  if (diff > 10) return 'bg-emerald-200 dark:bg-emerald-900'; // higher
  if (diff > 3) return 'bg-emerald-100 dark:bg-emerald-950'; // slightly higher
  if (diff > -3) return 'bg-amber-50 dark:bg-amber-950'; // par
  if (diff > -10) return 'bg-orange-100 dark:bg-orange-950'; // slightly lower
  return 'bg-red-100 dark:bg-red-950'; // much lower
}

function exportToCSV(rates: CompetitorRate[]) {
  const headers = ['Date', 'Our Rate', ...COMPETITOR_PROPERTIES.map(c => c.name)];
  const rows = rates.map(r => [
    r.date,
    r.ourRate.toString(),
    ...COMPETITOR_PROPERTIES.map(c => (r.competitorRates[c.id] ?? 'N/A').toString()),
  ]);
  const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rate-shopping-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV exported successfully');
}

// ============================================================
// Main Component
// ============================================================

export default function RateShopping() {
  const today = startOfDay(new Date());
  const [startDate, setStartDate] = useState(format(addDays(today, 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(today, 30), 'yyyy-MM-dd'));
  const [roomType, setRoomType] = useState('standard');
  const [activeTab, setActiveTab] = useState('matrix');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<ParityAlert[]>([
    { id: 'alert-1', channel: 'booking_com', threshold: 10, isActive: true, createdAt: '2024-01-15', channelName: 'Booking.com' },
    { id: 'alert-2', channel: 'expedia', threshold: 15, isActive: true, createdAt: '2024-02-01', channelName: 'Expedia' },
    { id: 'alert-3', channel: 'airbnb', threshold: 20, isActive: false, createdAt: '2024-03-10', channelName: 'Airbnb' },
  ]);
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [newAlertThreshold, setNewAlertThreshold] = useState(10);
  const [newAlertChannel, setNewAlertChannel] = useState<Channel>('booking_com');
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [sortBy, setSortBy] = useState<'date' | 'ourRate'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Generate mock rate data
  const rateData = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return generateRateData(start, end, roomType);
  }, [startDate, endDate, roomType]);

  // Computed analytics
  const analytics = useMemo(() => {
    const allRates = rateData.flatMap(r => Object.values(r.competitorRates).filter((v): v is number => v !== null));
    const marketAvg = allRates.length > 0 ? allRates.reduce((s, v) => s + v, 0) / allRates.length : 0;
    const ourAvg = rateData.length > 0 ? rateData.reduce((s, r) => s + r.ourRate, 0) / rateData.length : 0;
    const ourPercentile = (() => {
      const sorted = [...allRates, ourAvg].sort((a, b) => a - b);
      return Math.round((sorted.indexOf(ourAvg) / sorted.length) * 100);
    })();

    const parityStats = CHANNELS.map(ch => {
      let par = 0;
      let higher = 0;
      let lower = 0;
      let na = 0;
      rateData.forEach(r => {
        const chRate = COMPETITOR_PROPERTIES.find(c => c.channels.includes(ch.id))
          ? r.competitorRates[COMPETITOR_PROPERTIES.find(c => c.channels.includes(ch.id))!.id]
          : null;
        const status = getParityStatus(r.ourRate, chRate);
        if (status === 'par') par++;
        else if (status === 'higher') higher++;
        else if (status === 'lower') lower++;
        else na++;
      });
      return { channel: ch, par, higher, lower, na };
    });

    return { marketAvg, ourAvg, ourPercentile, parityStats };
  }, [rateData]);

  const recommendation = useMemo(() => {
    const diff = ((analytics.ourAvg - analytics.marketAvg) / analytics.marketAvg) * 100;
    if (diff > 15) return { action: 'Consider reducing rates by 5-10% to stay competitive', severity: 'warning' as const };
    if (diff > 8) return { action: 'Rates slightly above market. Monitor competitor movements closely', severity: 'info' as const };
    if (diff < -10) return { action: 'Opportunity to increase rates. Demand supports higher pricing', severity: 'success' as const };
    return { action: 'Pricing is well-positioned in the market. Maintain current strategy', severity: 'success' as const };
  }, [analytics]);

  // Calendar data
  const calendarData = useMemo((): RateCalendarDay[] => {
    const days = generateRateData(new Date(calendarYear, calendarMonth, 1), new Date(calendarYear, calendarMonth + 1, 0), roomType);
    return days.map(d => {
      const compRates = Object.values(d.competitorRates).filter((v): v is number => v !== null);
      const marketAvg = compRates.length > 0 ? compRates.reduce((s, v) => s + v, 0) / compRates.length : d.ourRate;
      return {
        date: d.date,
        ourRate: d.ourRate,
        marketAvg: Math.round(marketAvg),
        demand: getDemandLevel(30 + Math.random() * 60),
        color: getCalendarColor(d.ourRate, marketAvg),
      };
    });
  }, [calendarMonth, calendarYear, roomType]);

  const sortedRateData = useMemo(() => {
    const sorted = [...rateData];
    sorted.sort((a, b) => {
      const valA = sortBy === 'date' ? a.date : a.ourRate;
      const valB = sortBy === 'date' ? b.date : b.ourRate;
      return sortDir === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
    return sorted;
  }, [rateData, sortBy, sortDir]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Rate data refreshed');
    }, 800);
  }, []);

  const handleToggleSort = (col: 'date' | 'ourRate') => {
    if (sortBy === col) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const handleAddAlert = () => {
    const channelInfo = CHANNELS.find(c => c.id === newAlertChannel);
    if (!channelInfo) return;
    const newAlert: ParityAlert = {
      id: `alert-${Date.now()}`,
      channel: newAlertChannel,
      channelName: channelInfo.name,
      threshold: newAlertThreshold,
      isActive: true,
      createdAt: format(new Date(), 'yyyy-MM-dd'),
    };
    setAlerts(prev => [...prev, newAlert]);
    setIsAlertDialogOpen(false);
    toast.success(`Parity alert added for ${channelInfo.name}`);
  };

  const handleToggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a));
  };

  const handleDeleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    toast.success('Alert removed');
  };

  const calendarDaysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();

  // Market position calculation
  const marketSegments = useMemo(() => {
    const allRates = COMPETITOR_PROPERTIES.map(c => ({ name: c.name, rate: c.avgRate, segment: c.segment }));
    const ourBaseRate = roomType === 'standard' ? 150 : roomType === 'deluxe' ? 220 : roomType === 'superior' ? 280 : roomType === 'suite' ? 380 : 550;
    const sorted = [...allRates, { name: 'Our Property', rate: ourBaseRate, segment: 'premium' }].sort((a, b) => a.rate - b.rate);
    return sorted;
  }, [roomType]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6 text-emerald-600" />
            Rate Shopping Tool
          </h2>
          <p className="text-muted-foreground">Competitor rate intelligence and parity monitoring</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={roomType} onValueChange={setRoomType}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROOM_TYPES.map(rt => (
                <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-36"
          />
          <Input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-36"
          />
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToCSV(rateData)}>
            <FileDown className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.success('PDF report generated')}>
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Avg Our Rate</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">${Math.round(analytics.ourAvg)}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Selected period</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <DollarSign className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Market Average</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">${Math.round(analytics.marketAvg)}</p>
                <div className="flex items-center gap-1 mt-1">
                  {analytics.ourAvg > analytics.marketAvg ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-red-500" />
                      <span className="text-xs text-red-500">
                        +{((analytics.ourAvg - analytics.marketAvg) / analytics.marketAvg * 100).toFixed(1)}% vs market
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3 w-3 text-emerald-500" />
                      <span className="text-xs text-emerald-500">
                        {((analytics.ourAvg - analytics.marketAvg) / analytics.marketAvg * 100).toFixed(1)}% vs market
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <BarChart3 className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Market Percentile</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{analytics.ourPercentile}th</p>
                <Progress value={analytics.ourPercentile} className="h-2 mt-2" />
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <Target className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Competitors Tracked</p>
                <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{COMPETITOR_PROPERTIES.length}</p>
                <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">{rateData.length} dates analyzed</p>
              </div>
              <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                <Hotel className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="matrix" className="gap-1.5"><Table className="h-3.5 w-3.5 hidden sm:block" />Rate Matrix</TabsTrigger>
          <TabsTrigger value="parity" className="gap-1.5"><Shield className="h-3.5 w-3.5 hidden sm:block" />Parity</TabsTrigger>
          <TabsTrigger value="position" className="gap-1.5"><MapPin className="h-3.5 w-3.5 hidden sm:block" />Position</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5"><Calendar className="h-3.5 w-3.5 hidden sm:block" />Calendar</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5"><Bell className="h-3.5 w-3.5 hidden sm:block" />Alerts</TabsTrigger>
        </TabsList>

        {/* ---- Tab: Rate Matrix ---- */}
        <TabsContent value="matrix" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Competitor Rate Matrix
                  </CardTitle>
                  <CardDescription>Your rates vs competitors across channels and dates</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {rateData.length} dates shown
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[100px] cursor-pointer select-none" onClick={() => handleToggleSort('date')}>
                        <div className="flex items-center gap-1">
                          Date <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead className="sticky left-[100px] bg-background z-10 min-w-[90px] cursor-pointer select-none" onClick={() => handleToggleSort('ourRate')}>
                        <div className="flex items-center gap-1 text-emerald-600">
                          Our Rate <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      {COMPETITOR_PROPERTIES.map(comp => (
                        <TableHead key={comp.id} className="min-w-[120px]">
                          <div className="flex items-center gap-1">
                            <span className="text-xs">{comp.name}</span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">{comp.starRating}★</Badge>
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="min-w-[80px]">Market Avg</TableHead>
                      <TableHead className="min-w-[80px]">Demand</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRateData.map((row) => {
                      const compRates = Object.values(row.competitorRates).filter((v): v is number => v !== null);
                      const marketAvg = compRates.length > 0 ? Math.round(compRates.reduce((s, v) => s + v, 0) / compRates.length) : row.ourRate;
                      const demand = getDemandLevel(30 + Math.random() * 60);
                      return (
                        <TableRow key={row.date}>
                          <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm">
                            {format(new Date(row.date), 'MMM dd, EEE')}
                          </TableCell>
                          <TableCell className="sticky left-[100px] bg-background z-10 font-bold text-emerald-600">
                            ${row.ourRate}
                          </TableCell>
                          {COMPETITOR_PROPERTIES.map(comp => {
                            const compRate = row.competitorRates[comp.id];
                            const status = getParityStatus(row.ourRate, compRate);
                            const dev = compRate !== null ? (((row.ourRate - compRate) / compRate) * 100).toFixed(1) : null;
                            return (
                              <TableCell key={comp.id}>
                                {compRate !== null ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-medium ${status === 'higher' ? 'text-red-600' : status === 'lower' ? 'text-emerald-600' : ''}`}>
                                      ${compRate}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PARITY_STATUS_CONFIG[status].color}`}>
                                      {dev !== null && dev !== '0.0' ? `${status === 'higher' ? '+' : ''}${dev}%` : 'par'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">N/A</span>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="font-medium">${marketAvg}</TableCell>
                          <TableCell>
                            <Badge className={`${DEMAND_CONFIG[demand].bgColor} ${DEMAND_CONFIG[demand].color} text-[10px]`}>
                              {DEMAND_CONFIG[demand].label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Tab: Rate Parity Dashboard ---- */}
        <TabsContent value="parity" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Rate Parity Dashboard
              </CardTitle>
              <CardDescription>Parity status across distribution channels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {analytics.parityStats.map(({ channel, par, higher, lower, na }) => {
                  const total = par + higher + lower + na;
                  const parPct = total > 0 ? Math.round((par / total) * 100) : 0;
                  const bestChannel = parPct >= 60;
                  return (
                    <div key={channel.id} className={`rounded-lg border p-4 ${bestChannel ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <Badge className={`${channel.bgColor} ${channel.color} text-xs`}>
                          {channel.name}
                        </Badge>
                        {bestChannel && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1 text-emerald-600">
                            {PARITY_STATUS_CONFIG.par.icon} Par
                          </span>
                          <span className="font-medium">{parPct}%</span>
                        </div>
                        <Progress value={parPct} className="h-2" />
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div className="text-center">
                            <p className="text-lg font-bold text-emerald-600">{par}</p>
                            <p className="text-[10px] text-muted-foreground">Par</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-red-600">{higher}</p>
                            <p className="text-[10px] text-muted-foreground">Higher</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-amber-600">{lower}</p>
                            <p className="text-[10px] text-muted-foreground">Lower</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{na} dates with no data</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Price Intelligence */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Price Intelligence
              </CardTitle>
              <CardDescription>AI-driven rate optimization insights</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Market Overview</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm text-muted-foreground">Market Average Rate</span>
                      <span className="font-bold">${Math.round(analytics.marketAvg)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm text-muted-foreground">Your Rate vs Market</span>
                      <span className="font-bold text-emerald-600">{analytics.ourPercentile}th Percentile</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm text-muted-foreground">Lowest Competitor</span>
                      <span className="font-bold text-sky-600">
                        ${Math.round(Math.min(...COMPETITOR_PROPERTIES.map(c => c.avgRate * 0.9)))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm text-muted-foreground">Highest Competitor</span>
                      <span className="font-bold text-red-600">
                        ${Math.round(Math.max(...COMPETITOR_PROPERTIES.map(c => c.avgRate * 1.1)))}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Recommendations</h4>
                  <div className={`p-4 rounded-lg border ${
                    recommendation.severity === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
                      : recommendation.severity === 'info'
                      ? 'bg-sky-50 dark:bg-sky-950 border-sky-200 dark:border-sky-800'
                      : 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800'
                  }`}>
                    <div className="flex items-start gap-3">
                      {recommendation.severity === 'warning' ? (
                        <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <h4 className="font-medium text-sm mb-1">
                          {recommendation.severity === 'warning' ? 'Price Adjustment Recommended' : 'Pricing Status'}
                        </h4>
                        <p className="text-sm text-muted-foreground">{recommendation.action}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Demand Indicators</h4>
                    <div className="flex gap-3">
                      <Badge className={`${DEMAND_CONFIG.low.bgColor} ${DEMAND_CONFIG.low.color} flex-1 justify-center py-2`}>
                        <Zap className="h-3.5 w-3.5 mr-1" /> Low: 35%
                      </Badge>
                      <Badge className={`${DEMAND_CONFIG.medium.bgColor} ${DEMAND_CONFIG.medium.color} flex-1 justify-center py-2`}>
                        <Activity className="h-3.5 w-3.5 mr-1" /> Medium: 40%
                      </Badge>
                      <Badge className={`${DEMAND_CONFIG.high.bgColor} ${DEMAND_CONFIG.high.color} flex-1 justify-center py-2`}>
                        <TrendingUp className="h-3.5 w-3.5 mr-1" /> High: 25%
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Tab: Rate Position Map ---- */}
        <TabsContent value="position" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Rate Position Map
              </CardTitle>
              <CardDescription>Your property&apos;s position in the competitive landscape</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Market Segment Position */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-4">Competitive Set - Rate Ranking</h4>
                  <div className="space-y-3">
                    {marketSegments.map((prop, index) => {
                      const isOurProperty = prop.name === 'Our Property';
                      const maxRate = marketSegments[marketSegments.length - 1].rate;
                      const widthPct = (prop.rate / maxRate) * 100;
                      return (
                        <div key={prop.name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono w-5 text-right ${isOurProperty ? 'text-emerald-600 font-bold' : 'text-muted-foreground'}`}>
                                #{index + 1}
                              </span>
                              <span className={`font-medium ${isOurProperty ? 'text-emerald-600' : ''}`}>
                                {prop.name}
                                {isOurProperty && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-[10px] ml-1">YOU</Badge>}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`${SEGMENT_CONFIG[prop.segment].bgColor} ${SEGMENT_CONFIG[prop.segment].color} text-[10px]`}>
                                {SEGMENT_CONFIG[prop.segment].label}
                              </Badge>
                              <span className={`font-bold ${isOurProperty ? 'text-emerald-600' : ''}`}>${prop.rate}</span>
                            </div>
                          </div>
                          <div className="relative">
                            <div className="h-6 rounded-full bg-muted/50 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isOurProperty
                                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                                    : 'bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-500'
                                }`}
                                style={{ width: `${widthPct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* Market Segments Legend */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Market Segments</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(Object.entries(SEGMENT_CONFIG) as [MarketSegment, typeof SEGMENT_CONFIG[MarketSegment]][]).map(([key, config]) => (
                      <div key={key} className="flex items-center gap-2 p-3 rounded-lg border">
                        <div className="w-3 h-3 rounded-full" style={{
                          backgroundColor: key === 'budget' ? '#0ea5e9' : key === 'mid' ? '#10b981' : key === 'premium' ? '#8b5cf6' : '#f59e0b'
                        }} />
                        <div>
                          <p className="text-sm font-medium">{config.label}</p>
                          <p className="text-xs text-muted-foreground">
                            ${key === 'budget' ? '50-100' : key === 'mid' ? '100-180' : key === 'premium' ? '180-300' : '$300+'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Competitor Overview Cards */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Competitor Properties</h4>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {COMPETITOR_PROPERTIES.map(comp => {
                      const deviation = (((analytics.ourAvg - comp.avgRate) / comp.avgRate) * 100).toFixed(1);
                      const status = getParityStatus(analytics.ourAvg, comp.avgRate);
                      return (
                        <div key={comp.id} className="p-4 rounded-lg border hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="p-2 rounded-lg bg-muted">
                                <Hotel className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{comp.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {comp.starRating}★ · {comp.distance}km away
                                </p>
                              </div>
                            </div>
                            <Badge className={`${PARITY_STATUS_CONFIG[status].color} text-[10px]`}>
                              {PARITY_STATUS_CONFIG[status].icon}
                              {PARITY_STATUS_CONFIG[status].label}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div>
                              <p className="text-lg font-bold">${comp.avgRate}</p>
                              <p className="text-xs text-muted-foreground">avg rate/night</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-medium ${parseFloat(deviation) > 0 ? 'text-red-600' : parseFloat(deviation) < 0 ? 'text-emerald-600' : ''}`}>
                                {parseFloat(deviation) > 0 ? '+' : ''}{deviation}%
                              </p>
                              <p className="text-xs text-muted-foreground">vs our rate</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {comp.channels.map(ch => {
                              const chInfo = CHANNELS.find(c => c.id === ch);
                              return chInfo ? (
                                <Badge key={ch} variant="outline" className="text-[10px] px-1.5 py-0">
                                  {chInfo.name}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Tab: Rate Shopping Calendar ---- */}
        <TabsContent value="calendar" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Rate Shopping Calendar
                  </CardTitle>
                  <CardDescription>Color-coded calendar showing rate positioning</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); }
                    else setCalendarMonth(m => m - 1);
                  }}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium min-w-[140px] text-center">
                    {format(new Date(calendarYear, calendarMonth, 1), 'MMMM yyyy')}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => {
                    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); }
                    else setCalendarMonth(m => m + 1);
                  }}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Calendar Legend */}
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-emerald-200 dark:bg-emerald-900" />
                  <span className="text-xs text-muted-foreground">Above market (+10%+)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-950" />
                  <span className="text-xs text-muted-foreground">Slightly above (+3-10%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-amber-50 dark:bg-amber-950" />
                  <span className="text-xs text-muted-foreground">Par (-3% to +3%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-orange-100 dark:bg-orange-950" />
                  <span className="text-xs text-muted-foreground">Below market (-3 to -10%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-950" />
                  <span className="text-xs text-muted-foreground">Far below (-10%+)</span>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="p-1" />
                ))}
                {calendarData.map(day => {
                  const demand = getDemandLevel(30 + Math.random() * 60);
                  return (
                    <div
                      key={day.date}
                      className={`rounded-md p-2 min-h-[70px] border ${day.color} hover:shadow-sm transition-shadow cursor-pointer`}
                      title={`$${day.ourRate} (Market: $${day.marketAvg})`}
                    >
                      <p className="text-xs font-medium">{format(new Date(day.date), 'd')}</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">${day.ourRate}</p>
                      <p className="text-[10px] text-muted-foreground">avg ${day.marketAvg}</p>
                      <Badge className={`${DEMAND_CONFIG[demand].bgColor} ${DEMAND_CONFIG[demand].color} text-[8px] px-1 py-0 mt-1`}>
                        {DEMAND_CONFIG[demand].label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Tab: Alerts ---- */}
        <TabsContent value="alerts" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BellRing className="h-5 w-5" />
                    Rate Parity Alerts
                  </CardTitle>
                  <CardDescription>Get notified when competitor rates breach your thresholds</CardDescription>
                </div>
                <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsAlertDialogOpen(true)}>
                  <Bell className="h-4 w-4" />
                  Add Alert
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No parity alerts configured</p>
                  <p className="text-sm">Add alerts to monitor rate changes across channels</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map(alert => {
                    const channelInfo = CHANNELS.find(c => c.id === alert.channel);
                    return (
                      <div key={alert.id} className={`flex items-center justify-between p-4 rounded-lg border ${alert.isActive ? '' : 'opacity-60'}`}>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950">
                            <AlertTriangle className={`h-5 w-5 ${alert.isActive ? 'text-amber-500' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {channelInfo?.name ?? alert.channelName}
                              </p>
                              <Badge variant={alert.isActive ? 'default' : 'secondary'} className="text-xs">
                                {alert.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Alert if competitor drops below <span className="font-medium text-foreground">{alert.threshold}%</span> of our rate
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">Created: {alert.createdAt}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={alert.isActive}
                            onCheckedChange={() => handleToggleAlert(alert.id)}
                          />
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteAlert(alert.id)}>
                            <Trash2Icon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Alert History Mock */}
              <Separator className="my-6" />
              <div>
                <h4 className="text-sm font-medium mb-3">Recent Alert Triggers</h4>
                <div className="space-y-2">
                  {[
                    { time: '2 hours ago', channel: 'Booking.com', message: 'Competitor rate dropped 12% below your rate', severity: 'warning' },
                    { time: '5 hours ago', channel: 'Expedia', message: 'Rate parity restored — within 3% threshold', severity: 'success' },
                    { time: '1 day ago', channel: 'Agoda', message: 'New competitor listing found at 18% below market', severity: 'info' },
                    { time: '2 days ago', channel: 'MakeMyTrip', message: 'Flash sale detected — competitor offering 20% off', severity: 'warning' },
                  ].map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <div className={`mt-0.5 ${entry.severity === 'warning' ? 'text-amber-500' : entry.severity === 'success' ? 'text-emerald-500' : 'text-sky-500'}`}>
                        {entry.severity === 'warning' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{entry.channel}</p>
                          <p className="text-xs text-muted-foreground">{entry.time}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">{entry.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Alert Dialog */}
      <Dialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Rate Parity Alert</DialogTitle>
            <DialogDescription>
              Get notified when a competitor&apos;s rate drops below a threshold
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Channel</label>
              <Select value={newAlertChannel} onValueChange={(v) => setNewAlertChannel(v as Channel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map(ch => (
                    <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Threshold (%)</label>
              <p className="text-xs text-muted-foreground">Alert when competitor rate is this % below your rate</p>
              <Input
                type="number"
                min={1}
                max={50}
                value={newAlertThreshold}
                onChange={e => setNewAlertThreshold(parseInt(e.target.value) || 10)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAlertDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddAlert} className="bg-emerald-600 hover:bg-emerald-700">Add Alert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small icon for delete (avoiding adding a new import)
function Trash2Icon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}
