'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Users, Eye,
  MousePointer, ShoppingCart, CreditCard, CheckCircle2, XCircle,
  ArrowRight, Clock, Mail, Phone, Search, CalendarDays,
  Shield, Star, ThumbsUp, Flame, Timer, Gift, Percent,
  ArrowLeftRight, Globe, ExternalLink, Copy, RotateCcw,
  Activity, Zap, Filter, RefreshCw, AlertTriangle,
  ChevronRight, ChevronDown, Tag, BadgePercent, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────
interface FunnelStage {
  name: string;
  visitors: number;
  dropoff: number;
  conversionRate: number;
  icon: React.ComponentType<{ className?: string }>;
}

interface AbandonedBooking {
  id: string;
  guestName: string;
  email: string;
  phone: string;
  abandonTime: string;
  roomSearched: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  value: number;
  recoveryStage: 'new' | 'reminded_1h' | 'reminded_24h' | 'reminded_72h' | 'recovered' | 'lost';
  recoveryChannel: string | null;
}

interface RecoveryCampaign {
  id: string;
  name: string;
  type: 'email_1h' | 'email_24h' | 'email_72h' | 'discount' | 'retarget';
  sentCount: number;
  recoveredCount: number;
  recoveryRate: number;
  revenueRecovered: number;
  status: 'active' | 'paused';
}

interface ConversionTrend {
  date: string;
  directBookings: number;
  otaBookings: number;
  directRevenue: number;
  otaRevenue: number;
  conversionRate: number;
}

interface OptimizationTool {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  type: 'urgency' | 'social_proof' | 'trust_badge' | 'exit_popup' | 'offer_bar';
  impact: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────
const FUNNEL_STAGES: FunnelStage[] = [
  { name: 'Landing Page', visitors: 48520, dropoff: 0, conversionRate: 100, icon: Globe },
  { name: 'Search Results', visitors: 36390, dropoff: 12130, conversionRate: 75.0, icon: Search },
  { name: 'Room Selection', visitors: 21834, dropoff: 14556, conversionRate: 45.0, icon: ShoppingCart },
  { name: 'Guest Details', visitors: 15284, dropoff: 6550, conversionRate: 31.5, icon: Users },
  { name: 'Payment', visitors: 10699, dropoff: 4585, conversionRate: 22.0, icon: CreditCard },
  { name: 'Confirmation', visitors: 7703, dropoff: 2996, conversionRate: 15.9, icon: CheckCircle2 },
];

const MOCK_ABANDONED: AbandonedBooking[] = [
  { id: 'ab1', guestName: 'Sarah Mitchell', email: 'sarah.m@email.com', phone: '+1-555-0101', abandonTime: '2026-05-07T14:23:00Z', roomSearched: 'Deluxe Ocean View Suite', checkIn: '2026-06-15', checkOut: '2026-06-18', guests: 2, value: 1890, recoveryStage: 'new', recoveryChannel: null },
  { id: 'ab2', guestName: 'James Cooper', email: 'j.cooper@email.com', phone: '+1-555-0102', abandonTime: '2026-05-07T12:05:00Z', roomSearched: 'Premium King Room', checkIn: '2026-05-20', checkOut: '2026-05-22', guests: 1, value: 520, recoveryStage: 'reminded_1h', recoveryChannel: 'email' },
  { id: 'ab3', guestName: 'Elena Rodriguez', email: 'elena.r@email.com', phone: '+1-555-0103', abandonTime: '2026-05-07T10:30:00Z', roomSearched: 'Family Suite (2BR)', checkIn: '2026-07-01', checkOut: '2026-07-07', guests: 4, value: 3420, recoveryStage: 'reminded_24h', recoveryChannel: 'email' },
  { id: 'ab4', guestName: 'David Park', email: 'd.park@email.com', phone: '+1-555-0104', abandonTime: '2026-05-06T18:45:00Z', roomSearched: 'Standard Double Room', checkIn: '2026-05-25', checkOut: '2026-05-26', guests: 2, value: 340, recoveryStage: 'reminded_72h', recoveryChannel: 'email' },
  { id: 'ab5', guestName: 'Maria Chen', email: 'm.chen@email.com', phone: '+1-555-0105', abandonTime: '2026-05-06T16:20:00Z', roomSearched: 'Penthouse Suite', checkIn: '2026-06-10', checkOut: '2026-06-14', guests: 2, value: 4800, recoveryStage: 'recovered', recoveryChannel: 'email' },
  { id: 'ab6', guestName: 'Robert Taylor', email: 'r.taylor@email.com', phone: '+1-555-0106', abandonTime: '2026-05-06T09:10:00Z', roomSearched: 'Deluxe King Room', checkIn: '2026-06-05', checkOut: '2026-06-08', guests: 1, value: 960, recoveryStage: 'recovered', recoveryChannel: 'discount' },
  { id: 'ab7', guestName: 'Lisa Wang', email: 'l.wang@email.com', phone: '+1-555-0107', abandonTime: '2026-05-05T22:30:00Z', roomSearched: 'Garden View Room', checkIn: '2026-05-30', checkOut: '2026-06-02', guests: 2, value: 680, recoveryStage: 'lost', recoveryChannel: null },
  { id: 'ab8', guestName: 'Michael Brown', email: 'm.brown@email.com', phone: '+1-555-0108', abandonTime: '2026-05-05T15:00:00Z', roomSearched: 'Executive Suite', checkIn: '2026-06-20', checkOut: '2026-06-23', guests: 2, value: 2670, recoveryStage: 'new', recoveryChannel: null },
  { id: 'ab9', guestName: 'Anna Kowalski', email: 'a.kowalski@email.com', phone: '+1-555-0109', abandonTime: '2026-05-05T11:15:00Z', roomSearched: 'Junior Suite', checkIn: '2026-07-10', checkOut: '2026-07-13', guests: 2, value: 1560, recoveryStage: 'reminded_1h', recoveryChannel: 'email' },
  { id: 'ab10', guestName: 'Thomas Lee', email: 't.lee@email.com', phone: '+1-555-0110', abandonTime: '2026-05-04T20:40:00Z', roomSearched: 'Standard Twin Room', checkIn: '2026-05-28', checkOut: '2026-05-30', guests: 2, value: 440, recoveryStage: 'reminded_24h', recoveryChannel: 'sms' },
  { id: 'ab11', guestName: 'Priya Sharma', email: 'p.sharma@email.com', phone: '+1-555-0111', abandonTime: '2026-05-04T14:55:00Z', roomSearched: 'Honeymoon Suite', checkIn: '2026-06-15', checkOut: '2026-06-19', guests: 2, value: 3200, recoveryStage: 'recovered', recoveryChannel: 'discount' },
  { id: 'ab12', guestName: 'Chris Anderson', email: 'c.anderson@email.com', phone: '+1-555-0112', abandonTime: '2026-05-04T08:20:00Z', roomSearched: 'Deluxe Twin Room', checkIn: '2026-06-01', checkOut: '2026-06-03', guests: 2, value: 720, recoveryStage: 'lost', recoveryChannel: null },
];

const MOCK_RECOVERY_CAMPAIGNS: RecoveryCampaign[] = [
  { id: 'rc1', name: '1-Hour Reminder', type: 'email_1h', sentCount: 1840, recoveredCount: 368, recoveryRate: 20.0, revenueRecovered: 645200, status: 'active' },
  { id: 'rc2', name: '24-Hour Follow-up', type: 'email_24h', sentCount: 1520, recoveredCount: 274, recoveryRate: 18.0, revenueRecovered: 489600, status: 'active' },
  { id: 'rc3', name: '72-Hour Last Chance', type: 'email_72h', sentCount: 1280, recoveredCount: 154, recoveryRate: 12.0, revenueRecovered: 312400, status: 'active' },
  { id: 'rc4', name: '10% Discount Offer', type: 'discount', sentCount: 640, recoveredCount: 166, recoveryRate: 25.9, revenueRecovered: 534800, status: 'active' },
  { id: 'rc5', name: 'Retargeting Ads', type: 'retarget', sentCount: 3200, recoveredCount: 224, recoveryRate: 7.0, revenueRecovered: 398600, status: 'paused' },
];

const MOCK_TRENDS: ConversionTrend[] = [
  { date: 'May 1', directBookings: 45, otaBookings: 32, directRevenue: 28350, otaRevenue: 17920, conversionRate: 14.2 },
  { date: 'May 2', directBookings: 52, otaBookings: 28, directRevenue: 32800, otaRevenue: 15680, conversionRate: 15.8 },
  { date: 'May 3', directBookings: 48, otaBookings: 35, directRevenue: 30240, otaRevenue: 19600, conversionRate: 14.9 },
  { date: 'May 4', directBookings: 61, otaBookings: 30, directRevenue: 38430, otaRevenue: 16800, conversionRate: 16.7 },
  { date: 'May 5', directBookings: 55, otaBookings: 33, directRevenue: 34650, otaRevenue: 18480, conversionRate: 15.5 },
  { date: 'May 6', directBookings: 67, otaBookings: 29, directRevenue: 42210, otaRevenue: 16240, conversionRate: 17.3 },
  { date: 'May 7', directBookings: 72, otaBookings: 31, directRevenue: 45360, otaRevenue: 17360, conversionRate: 18.1 },
];

const MOCK_TOOLS: OptimizationTool[] = [
  { id: 'tool1', name: 'Limited Rooms Alert', description: 'Show "Only X rooms left at this price" for high-demand dates', icon: Flame, enabled: true, type: 'urgency', impact: '+12% conversion' },
  { id: 'tool2', name: 'Deal Countdown Timer', description: 'Display countdown for time-sensitive rate offers', icon: Timer, enabled: true, type: 'urgency', impact: '+8% conversion' },
  { id: 'tool3', name: 'Recent Bookings Ticker', description: 'Show real-time counter of recent bookings on property', icon: TrendingUp, enabled: true, type: 'social_proof', impact: '+15% conversion' },
  { id: 'tool4', name: 'Review Highlights', description: 'Display top-rated guest reviews on booking page', icon: Star, enabled: true, type: 'social_proof', impact: '+10% conversion' },
  { id: 'tool5', name: 'Free Cancellation Badge', description: 'Prominently display free cancellation policy', icon: Shield, enabled: true, type: 'trust_badge', impact: '+7% conversion' },
  { id: 'tool6', name: 'Best Price Guarantee', description: 'Show "Lowest price guaranteed or we match it" badge', icon: BadgePercent, enabled: true, type: 'trust_badge', impact: '+9% conversion' },
  { id: 'tool7', name: 'Secure Payment Seal', description: 'Display SSL/security badges during checkout', icon: Shield, enabled: false, type: 'trust_badge', impact: '+5% conversion' },
  { id: 'tool8', name: 'Exit-Intent Popup', description: 'Show special offer when guest tries to leave the booking page', icon: AlertTriangle, enabled: false, type: 'exit_popup', impact: '+18% recovery' },
  { id: 'tool9', name: 'Limited-Time Offer Bar', description: 'Animated top bar showing current promotions and deals', icon: Gift, enabled: true, type: 'offer_bar', impact: '+11% conversion' },
  { id: 'tool10', name: 'Guest Photo Gallery', description: 'Show guest-uploaded photos from social media', icon: ThumbsUp, enabled: false, type: 'social_proof', impact: '+6% conversion' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────
const RECOVERY_STAGE_STYLES: Record<string, string> = {
  new: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300',
  reminded_1h: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  reminded_24h: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  reminded_72h: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300',
  recovered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  lost: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const RECOVERY_STAGE_LABELS: Record<string, string> = {
  new: 'New',
  reminded_1h: '1h Reminder',
  reminded_24h: '24h Follow-up',
  reminded_72h: '72h Last Chance',
  recovered: 'Recovered',
  lost: 'Lost',
};

const getTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

// ─── Component ────────────────────────────────────────────────────────────
export default function ConversionEngine() {
  const [activeTab, setActiveTab] = useState('funnel');
  const [abandonedBookings, setAbandonedBookings] = useState<AbandonedBooking[]>(MOCK_ABANDONED);
  const [recoveryCampaigns] = useState<RecoveryCampaign[]>(MOCK_RECOVERY_CAMPAIGNS);
  const [optimizationTools, setOptimizationTools] = useState<OptimizationTool[]>(MOCK_TOOLS);
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [offerBarText, setOfferBarText] = useState('Summer Sale! Save 20% on stays before June 30');
  const [offerBarEnabled, setOfferBarEnabled] = useState(true);
  const [countdownTarget, setCountdownTarget] = useState('2026-06-30T23:59:59Z');
  const [countdownTime, setCountdownTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [recentBookingsCount, setRecentBookingsCount] = useState(847);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.max(0, new Date(countdownTarget).getTime() - Date.now());
      setCountdownTime({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdownTarget]);

  // Simulate recent bookings counter
  useEffect(() => {
    const interval = setInterval(() => {
      setRecentBookingsCount(prev => prev + Math.floor(Math.random() * 3));
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const filteredBookings = abandonedBookings.filter(b => {
    const matchSearch = b.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.roomSearched.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStage = stageFilter === 'all' || b.recoveryStage === stageFilter;
    return matchSearch && matchStage;
  });

  const totalAbandoned = abandonedBookings.length;
  const totalRecovered = abandonedBookings.filter(b => b.recoveryStage === 'recovered').length;
  const totalLost = abandonedBookings.filter(b => b.recoveryStage === 'lost').length;
  const totalAbandonedValue = abandonedBookings.reduce((a, b) => a + b.value, 0);
  const totalRecoveredValue = abandonedBookings.filter(b => b.recoveryStage === 'recovered').reduce((a, b) => a + b.value, 0);
  const overallRecoveryRate = totalAbandoned > 0 ? ((totalRecovered / totalAbandoned) * 100).toFixed(1) : '0';

  const totalCampaignRecovered = recoveryCampaigns.reduce((a, c) => a + c.recoveredCount, 0);
  const totalCampaignRevenue = recoveryCampaigns.reduce((a, c) => a + c.revenueRecovered, 0);
  const avgRecoveryRate = recoveryCampaigns.length > 0
    ? (recoveryCampaigns.reduce((a, c) => a + c.recoveryRate, 0) / recoveryCampaigns.length).toFixed(1)
    : '0';

  const totalDirectBookings = MOCK_TRENDS.reduce((a, t) => a + t.directBookings, 0);
  const totalOtaBookings = MOCK_TRENDS.reduce((a, t) => a + t.otaBookings, 0);
  const totalDirectRevenue = MOCK_TRENDS.reduce((a, t) => a + t.directRevenue, 0);
  const totalOtaRevenue = MOCK_TRENDS.reduce((a, t) => a + t.otaRevenue, 0);
  const commissionRate = 0.20;
  const otaCommissionSaved = totalOtaRevenue * commissionRate - totalOtaRevenue * 0;

  const handleRecoveryAction = (bookingId: string, action: 'email' | 'sms' | 'discount' | 'retarget') => {
    setAbandonedBookings(prev => prev.map(b =>
      b.id === bookingId
        ? { ...b, recoveryChannel: action, recoveryStage: 'reminded_1h' as const }
        : b
    ));
    const labels: Record<string, string> = {
      email: 'Reminder email sent',
      sms: 'SMS reminder sent',
      discount: 'Discount offer sent',
      retarget: 'Added to retargeting list',
    };
    toast.success(labels[action] || 'Action completed');
  };

  const toggleTool = (toolId: string) => {
    setOptimizationTools(prev => prev.map(t =>
      t.id === toolId ? { ...t, enabled: !t.enabled } : t
    ));
  };

  const getChannelSourceData = () => [
    { name: 'Direct', value: totalDirectBookings, fill: '#10b981' },
    { name: 'Booking.com', value: Math.round(totalOtaBookings * 0.45), fill: '#3b82f6' },
    { name: 'Expedia', value: Math.round(totalOtaBookings * 0.30), fill: '#f59e0b' },
    { name: 'Airbnb', value: Math.round(totalOtaBookings * 0.15), fill: '#ef4444' },
    { name: 'Others', value: Math.round(totalOtaBookings * 0.10), fill: '#8b5cf6' },
  ];

  const getFunnelDropoffData = () => FUNNEL_STAGES.slice(1).map(s => ({
    name: s.name,
    dropoff: s.dropoff,
    fill: '#ef4444',
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversion Engine</h1>
          <p className="text-muted-foreground">
            Optimize direct booking conversions and recover abandoned bookings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
            <Activity className="h-3 w-3 mr-1" />
            Live
          </Badge>
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Conversion Rate</p>
                <p className="text-xl font-bold">{FUNNEL_STAGES[FUNNEL_STAGES.length - 1].conversionRate}%</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Abandoned Bookings</p>
                <p className="text-xl font-bold">{totalAbandoned}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Recovery Rate</p>
                <p className="text-xl font-bold">{overallRecoveryRate}%</p>
              </div>
              <RotateCcw className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950 dark:to-pink-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Recovered Revenue</p>
                <p className="text-xl font-bold">${totalRecoveredValue.toLocaleString()}</p>
              </div>
              <DollarSign className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="funnel">Booking Funnel</TabsTrigger>
          <TabsTrigger value="abandoned">Abandoned Recovery</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="preview">Widget Preview</TabsTrigger>
        </TabsList>

        {/* ─── Booking Funnel Tab ────────────────────────────────────── */}
        <TabsContent value="funnel" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Visual Funnel */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Booking Funnel</CardTitle>
                <CardDescription>Visitor progression through each booking stage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {FUNNEL_STAGES.map((stage, idx) => {
                    const StageIcon = stage.icon;
                    const widthPercent = (stage.visitors / FUNNEL_STAGES[0].visitors) * 100;
                    const isFirst = idx === 0;
                    return (
                      <div key={stage.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <StageIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{stage.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">{stage.visitors.toLocaleString()}</span>
                            {!isFirst && (
                              <>
                                <span className="text-red-500 dark:text-red-400 text-xs">
                                  -{stage.dropoff.toLocaleString()} ({((stage.dropoff / FUNNEL_STAGES[idx - 1].visitors) * 100).toFixed(1)}%)
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="relative h-10 rounded-lg bg-muted overflow-hidden">
                          <div
                            className={cn(
                              'absolute inset-y-0 left-0 rounded-lg transition-all duration-700',
                              isFirst
                                ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                                : idx === FUNNEL_STAGES.length - 1
                                  ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                                  : 'bg-gradient-to-r from-cyan-400 to-sky-500'
                            )}
                            style={{ width: `${widthPercent}%` }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-foreground">
                            {stage.conversionRate}% conversion
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Drop-off Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Drop-off Analysis</CardTitle>
                <CardDescription>Where guests leave the funnel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getFunnelDropoffData()} margin={{ left: 0 }}>
                      <XAxis dataKey="name" fontSize={10} tickLine={false} />
                      <YAxis fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Drop-offs']} />
                      <Bar dataKey="dropoff" radius={[4, 4, 0, 0]}>
                        {getFunnelDropoffData().map((_, idx) => (
                          <Cell key={idx} fill={['#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c'][idx % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-semibold">Key Insights</h4>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-muted-foreground">
                        <strong>Largest drop-off:</strong> Search Results to Room Selection (-25.0%)
                      </p>
                    </div>
                    <div className="flex items-start gap-2 text-xs">
                      <TrendingDown className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      <p className="text-muted-foreground">
                        <strong>Second largest:</strong> Room Selection to Guest Details (-35.1%)
                      </p>
                    </div>
                    <div className="flex items-start gap-2 text-xs">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <p className="text-muted-foreground">
                        <strong>Best rate:</strong> Payment to Confirmation (72.0%)
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Conversion Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversion Rate Trend (7 Days)</CardTitle>
              <CardDescription>Daily conversion rate progression</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MOCK_TRENDS} margin={{ left: 0, right: 10 }}>
                    <defs>
                      <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="date" fontSize={11} tickLine={false} />
                    <YAxis domain={[10, 22]} fontSize={11} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(value: number) => [`${value}%`, 'Conversion Rate']} />
                    <Area type="monotone" dataKey="conversionRate" stroke="#10b981" strokeWidth={2} fill="url(#convGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Abandoned Recovery Tab ─────────────────────────────────── */}
        <TabsContent value="abandoned" className="space-y-4 mt-4">
          {/* Recovery Campaign Stats */}
          <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Total Abandoned Value</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">${totalAbandonedValue.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Total Recovered</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${totalRecoveredValue.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Campaign Recoveries</p>
                <p className="text-lg font-bold">{totalCampaignRecovered}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Avg Recovery Rate</p>
                <p className="text-lg font-bold">{avgRecoveryRate}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Recovery Campaigns */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recovery Campaign Performance</CardTitle>
              <CardDescription>Automated sequences to recover abandoned bookings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recoveryCampaigns.map((campaign) => (
                  <div key={campaign.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                        campaign.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-gray-100 dark:bg-gray-800'
                      )}>
                        {campaign.type.includes('email') || campaign.type === 'discount' ? (
                          <Mail className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Globe className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{campaign.name}</span>
                          <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                            {campaign.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {campaign.sentCount} sent &middot; {campaign.recoveredCount} recovered
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{campaign.recoveryRate}%</p>
                        <p className="text-xs text-muted-foreground">Recovery Rate</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">${(campaign.revenueRecovered / 1000).toFixed(1)}K</p>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Abandoned Bookings List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Abandoned Bookings</CardTitle>
              <CardDescription>Recent bookings that were not completed</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1 max-w-sm focus-within:ring-2 focus-within:ring-primary/20 rounded-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or room..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="reminded_1h">1h Reminded</SelectItem>
                    <SelectItem value="reminded_24h">24h Reminded</SelectItem>
                    <SelectItem value="reminded_72h">72h Reminded</SelectItem>
                    <SelectItem value="recovered">Recovered</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bookings */}
              <ScrollArea className="max-h-[480px]">
                <div className="space-y-2">
                  {filteredBookings.map((booking) => {
                    const isExpanded = expandedBooking === booking.id;
                    return (
                      <div key={booking.id} className="rounded-lg border bg-muted/20">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                              {booking.guestName.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{booking.guestName}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {booking.roomSearched} &middot; {booking.checkIn} to {booking.checkOut}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <Badge className={cn('text-[10px]', RECOVERY_STAGE_STYLES[booking.recoveryStage])}>
                              {RECOVERY_STAGE_LABELS[booking.recoveryStage]}
                            </Badge>
                            <span className="text-sm font-semibold">${booking.value.toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground">{getTimeAgo(booking.abandonTime)}</span>
                            <Button variant="ghost" size="sm" onClick={() => setExpandedBooking(isExpanded ? null : booking.id)}>
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-0 border-t">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                              <div>
                                <p className="text-muted-foreground">Email</p>
                                <p className="font-medium">{booking.email}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Phone</p>
                                <p className="font-medium">{booking.phone}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Guests</p>
                                <p className="font-medium">{booking.guests}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Booking Value</p>
                                <p className="font-medium text-emerald-600 dark:text-emerald-400">${booking.value.toLocaleString()}</p>
                              </div>
                            </div>
                            {booking.recoveryStage !== 'recovered' && booking.recoveryStage !== 'lost' && (
                              <div className="flex flex-wrap gap-2 mt-3">
                                <Button size="sm" variant="outline" onClick={() => handleRecoveryAction(booking.id, 'email')}>
                                  <Mail className="h-3.5 w-3.5 mr-1.5" /> Send Reminder
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleRecoveryAction(booking.id, 'sms')}>
                                  <Phone className="h-3.5 w-3.5 mr-1.5" /> Send SMS
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleRecoveryAction(booking.id, 'discount')}>
                                  <BadgePercent className="h-3.5 w-3.5 mr-1.5" /> Offer Discount
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleRecoveryAction(booking.id, 'retarget')}>
                                  <Globe className="h-3.5 w-3.5 mr-1.5" /> Add to Retargeting
                                </Button>
                              </div>
                            )}
                            {booking.recoveryStage === 'recovered' && (
                              <div className="flex items-center gap-2 mt-3 text-sm text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Booking recovered via {booking.recoveryChannel}</span>
                              </div>
                            )}
                            {booking.recoveryStage === 'lost' && (
                              <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                                <XCircle className="h-4 w-4" />
                                <span>Booking lost — no recovery action taken</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Optimization Tab ───────────────────────────────────────── */}
        <TabsContent value="optimization" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Optimization Tools */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  Conversion Optimization Tools
                </CardTitle>
                <CardDescription>Toggle tools to boost direct booking conversion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {optimizationTools.map((tool) => {
                    const ToolIcon = tool.icon;
                    const typeColors: Record<string, string> = {
                      urgency: 'text-amber-600 dark:text-amber-400',
                      social_proof: 'text-cyan-600 dark:text-cyan-400',
                      trust_badge: 'text-emerald-600 dark:text-emerald-400',
                      exit_popup: 'text-rose-600 dark:text-rose-400',
                      offer_bar: 'text-violet-600 dark:text-violet-400',
                    };
                    return (
                      <div
                        key={tool.id}
                        className={cn(
                          'p-4 rounded-xl border transition-all',
                          tool.enabled
                            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20'
                            : 'border-border bg-muted/20 opacity-75'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            <div className={cn('w-9 h-9 rounded-lg bg-background flex items-center justify-center shrink-0', typeColors[tool.type])}>
                              <ToolIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm">{tool.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tool.description}</p>
                              <Badge variant="outline" className="text-[10px] mt-1.5 text-emerald-600 dark:text-emerald-400">
                                {tool.impact}
                              </Badge>
                            </div>
                          </div>
                          <Switch checked={tool.enabled} onCheckedChange={() => toggleTool(tool.id)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Special Offer Bar Config */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-5 w-5 text-violet-500" />
                  Special Offer Bar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Offer Bar</Label>
                  <Switch checked={offerBarEnabled} onCheckedChange={setOfferBarEnabled} />
                </div>
                <div className="space-y-2">
                  <Label>Offer Text</Label>
                  <Input value={offerBarText} onChange={(e) => setOfferBarText(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Offer Expires</Label>
                  <Input type="datetime-local" value={countdownTarget.slice(0, 16)} onChange={(e) => setCountdownTarget(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* Exit Intent Config */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-500" />
                  Exit-Intent Popup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Exit-Intent Popup</Label>
                  <Switch defaultChecked={false} />
                </div>
                <div className="space-y-2">
                  <Label>Popup Title</Label>
                  <Input defaultValue="Wait! Don't miss out on the best rate" />
                </div>
                <div className="space-y-2">
                  <Label>Discount Offer</Label>
                  <Select defaultValue="10">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5% Off</SelectItem>
                      <SelectItem value="10">10% Off</SelectItem>
                      <SelectItem value="15">15% Off</SelectItem>
                      <SelectItem value="20">20% Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Trigger After (seconds)</Label>
                  <Input type="number" defaultValue="30" min={5} max={120} />
                </div>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    <strong>A/B Test Active:</strong> Variant A (10% off) vs Variant B (free breakfast).
                    Variant A performing 23% better.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Performance Tab ────────────────────────────────────────── */}
        <TabsContent value="performance" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Direct vs OTA */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Direct vs OTA Bookings</CardTitle>
                <CardDescription>Booking volume comparison (7 days)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={MOCK_TRENDS} margin={{ left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="date" fontSize={11} tickLine={false} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="directBookings" fill="#10b981" name="Direct" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="otaBookings" fill="#f59e0b" name="OTA" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span>Direct: {totalDirectBookings} ({((totalDirectBookings / (totalDirectBookings + totalOtaBookings)) * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span>OTA: {totalOtaBookings} ({((totalOtaBookings / (totalDirectBookings + totalOtaBookings)) * 100).toFixed(0)}%)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Revenue by Source */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue by Source</CardTitle>
                <CardDescription>Direct vs OTA revenue distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-56 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getChannelSourceData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {getChannelSourceData().map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, 'Bookings']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Conversion Trend */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Conversion Rate Trend</CardTitle>
                <CardDescription>Daily direct booking conversion rate (7 days)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={MOCK_TRENDS} margin={{ left: 0, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="date" fontSize={11} tickLine={false} />
                      <YAxis domain={[10, 22]} fontSize={11} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(value: number) => [`${value}%`, 'Conversion Rate']} />
                      <Line type="monotone" dataKey="conversionRate" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5 }} activeDot={{ r: 7 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Commission Savings */}
          <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Commission Savings Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-xl bg-background border">
                  <p className="text-sm text-muted-foreground">Direct Booking Revenue</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${totalDirectRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">No commission — 100% yours</p>
                </div>
                <div className="p-4 rounded-xl bg-background border">
                  <p className="text-sm text-muted-foreground">OTA Revenue (est. 20% commission)</p>
                  <p className="text-2xl font-bold">${totalOtaRevenue.toLocaleString()}</p>
                  <p className="text-xs text-red-500 mt-1">Commission paid: ${(totalOtaRevenue * commissionRate).toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl bg-background border">
                  <p className="text-sm text-muted-foreground">Savings from Direct Bookings</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">+${(totalDirectRevenue * commissionRate).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Commission saved by driving direct traffic</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Widget Preview Tab ─────────────────────────────────────── */}
        <TabsContent value="preview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-5 w-5 text-violet-500" />
                Live Widget Preview
              </CardTitle>
              <CardDescription>Preview how conversion optimization widgets appear to guests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Offer Bar Preview */}
              {offerBarEnabled && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Special Offer Bar</Label>
                  <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-6 py-3 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Gift className="h-5 w-5 animate-pulse" />
                      <span className="font-semibold text-sm">{offerBarText}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Timer className="h-4 w-4" />
                      <span className="font-mono">
                        {String(countdownTime.days).padStart(2, '0')}d{' '}
                        {String(countdownTime.hours).padStart(2, '0')}h{' '}
                        {String(countdownTime.minutes).padStart(2, '0')}m{' '}
                        {String(countdownTime.seconds).padStart(2, '0')}s
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Booking Search Bar */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Booking Search Bar</Label>
                <div className="border rounded-xl p-6 bg-background space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full overflow-hidden">
                      <Image src="/images/cryptsk-logo.png" alt="Cryptsk" width={32} height={32} className="object-contain w-full h-full" />
                    </div>
                    <span className="font-bold text-lg">StaySuite</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Check-in</p>
                      <div className="border rounded-lg px-3 py-2 text-sm bg-muted/50">Jun 15, 2026</div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Check-out</p>
                      <div className="border rounded-lg px-3 py-2 text-sm bg-muted/50">Jun 18, 2026</div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Guests</p>
                      <div className="border rounded-lg px-3 py-2 text-sm bg-muted/50">2 Adults</div>
                    </div>
                    <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white w-full h-10">
                      Search Availability
                    </Button>
                  </div>
                </div>
              </div>

              {/* Trust Badges */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Trust Badges</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="border rounded-lg p-4 flex flex-col items-center text-center gap-2 bg-background">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-xs font-semibold">Free Cancellation</p>
                    <p className="text-[10px] text-muted-foreground">Cancel up to 24h before</p>
                  </div>
                  <div className="border rounded-lg p-4 flex flex-col items-center text-center gap-2 bg-background">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                      <BadgePercent className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-xs font-semibold">Best Price Guarantee</p>
                    <p className="text-[10px] text-muted-foreground">Lowest rate or we match</p>
                  </div>
                  <div className="border rounded-lg p-4 flex flex-col items-center text-center gap-2 bg-background">
                    <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <p className="text-xs font-semibold">Secure Payment</p>
                    <p className="text-[10px] text-muted-foreground">256-bit SSL encrypted</p>
                  </div>
                  <div className="border rounded-lg p-4 flex flex-col items-center text-center gap-2 bg-background">
                    <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900 flex items-center justify-center">
                      <Star className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <p className="text-xs font-semibold">4.8 / 5 Rating</p>
                    <p className="text-[10px] text-muted-foreground">Based on 2,340 reviews</p>
                  </div>
                </div>
              </div>

              {/* Social Proof */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Recent Bookings Counter</Label>
                  <div className="border rounded-lg p-4 bg-background">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          <span className="text-emerald-600 dark:text-emerald-400">{recentBookingsCount.toLocaleString()}</span> bookings made today
                        </p>
                        <p className="text-xs text-muted-foreground">Guests are booking right now</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {['Deluxe Suite', 'Ocean View', 'Family Room'].map(room => (
                        <Badge key={room} variant="secondary" className="text-[10px]">
                          <Flame className="h-3 w-3 mr-1 text-orange-500" />
                          {room} — 2 left
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Review Highlights</Label>
                  <div className="border rounded-lg p-4 bg-background space-y-3">
                    <div className="flex items-start gap-2">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
                      <p className="text-sm italic">&quot;Exceptional service and beautiful rooms. Will definitely return!&quot;</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
                      <p className="text-sm italic">&quot;Best hotel experience we&apos;ve had. The staff went above and beyond.&quot;</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
                      <p className="text-sm italic">&quot;Perfect location, amazing views, and incredibly comfortable beds.&quot;</p>
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      from 2,340 verified reviews
                    </p>
                  </div>
                </div>
              </div>

              {/* Urgency Indicators */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Urgency Indicators</Label>
                <div className="border rounded-lg p-4 bg-background">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                      <Flame className="h-4 w-4 text-red-500 animate-pulse" />
                      <span className="text-sm font-semibold text-red-700 dark:text-red-400">Only 3 rooms left at this price!</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <Timer className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                        Deal expires in {countdownTime.days}d {countdownTime.hours}h {countdownTime.minutes}m
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                      <Activity className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">12 people viewing this room</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
