'use client';

import { useState, useEffect, useReducer, useCallback } from 'react';
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

// ─── Helpers ──────────────────────────────────────────────────────────────

// Icon lookup for funnel stages
const FUNNEL_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  landing: Globe,
  search: Search,
  room_select: ShoppingCart,
  guest_info: Users,
  payment: CreditCard,
  confirmation: CheckCircle2,
};

// Optimization tool icon lookup
const TOOL_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  urgency: Flame,
  social_proof: ThumbsUp,
  trust_badge: Shield,
  exit_popup: AlertTriangle,
  offer_bar: Gift,
};

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

// Build funnel stages from API data
const buildFunnelStages = (
  abandonedFunnel: Record<string, number> | undefined,
  seoFunnel: { pageViews: number; searchQueries: number; bookingAttempts: number; completedBookings: number; conversionRate: number } | undefined
): FunnelStage[] => {
  if (seoFunnel && seoFunnel.pageViews > 0) {
    const pageViews = seoFunnel.pageViews;
    const completed = seoFunnel.completedBookings;
    const convRate = seoFunnel.conversionRate;
    const stages = [
      { key: 'landing', name: 'Landing Page', visitors: pageViews, icon: Globe },
      { key: 'search', name: 'Search Results', visitors: seoFunnel.searchQueries, icon: Search },
      { key: 'room_select', name: 'Room Selection', visitors: Math.round(pageViews * 0.45), icon: ShoppingCart },
      { key: 'guest_info', name: 'Guest Details', visitors: seoFunnel.bookingAttempts, icon: Users },
      { key: 'payment', name: 'Payment', visitors: Math.round(completed * 1.4), icon: CreditCard },
      { key: 'confirmation', name: 'Confirmation', visitors: completed, icon: CheckCircle2 },
    ];
    return stages.map((s, idx) => ({
      name: s.name,
      visitors: s.visitors,
      dropoff: idx === 0 ? 0 : stages[idx - 1].visitors - s.visitors,
      conversionRate: parseFloat(((s.visitors / pageViews) * 100).toFixed(1)),
      icon: s.icon,
    }));
  }

  // Fallback: derive from abandoned bookings funnel counts
  if (abandonedFunnel) {
    const counts = [
      abandonedFunnel.search || 0,
      abandonedFunnel.room_select || 0,
      abandonedFunnel.guest_info || 0,
      abandonedFunnel.payment || 0,
    ];
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    // Estimate upstream numbers: assume 3x visitors for search level
    const landingVisitors = Math.round((abandonedFunnel.search || 0) * 3 + total);
    const searchVisitors = Math.round((abandonedFunnel.search || 0) * 2 + total);
    const allStages = [
      { name: 'Landing Page', visitors: landingVisitors, icon: Globe },
      { name: 'Search', visitors: searchVisitors, icon: Search },
      { name: 'Room Selection', visitors: counts[0] + counts[1] + counts[2] + counts[3], icon: ShoppingCart },
      { name: 'Guest Details', visitors: counts[1] + counts[2] + counts[3], icon: Users },
      { name: 'Payment', visitors: counts[2] + counts[3], icon: CreditCard },
      { name: 'Confirmation', visitors: Math.max(1, counts[3]), icon: CheckCircle2 },
    ];
    return allStages.map((s, idx) => ({
      name: s.name,
      visitors: s.visitors,
      dropoff: idx === 0 ? 0 : Math.max(0, allStages[idx - 1].visitors - s.visitors),
      conversionRate: parseFloat(((s.visitors / landingVisitors) * 100).toFixed(1)),
      icon: s.icon,
    }));
  }

  // Ultimate fallback — empty
  return [];
};

// Build optimization tools from active promotions
const buildOptimizationTools = (promotions: Record<string, unknown>[]): OptimizationTool[] => {
  const tools: OptimizationTool[] = [];

  // Offer bar tool — from active promotions
  const activePromos = promotions.filter((p: Record<string, unknown>) => p.status === 'active');
  if (activePromos.length > 0) {
    const promo = activePromos[0];
    tools.push({
      id: 'tool-offer-bar',
      name: (promo.name as string) || 'Special Offer Bar',
      description: `Active promotion: ${promo.discountType === 'percentage' ? `${promo.discountValue}% off` : `$${promo.discountValue} off`}`,
      icon: Gift,
      enabled: true,
      type: 'offer_bar',
      impact: `${activePromos.length} active promo${activePromos.length > 1 ? 's' : ''}`,
    });
  }

  // Urgency tool
  const percentagePromos = promotions.filter(
    (p: Record<string, unknown>) => p.discountType === 'percentage' && (p.discountValue as number) >= 15
  );
  if (percentagePromos.length > 0) {
    tools.push({
      id: 'tool-urgency',
      name: 'Urgency Timer',
      description: 'Display countdown timers on limited-time promotions',
      icon: Flame,
      enabled: true,
      type: 'urgency',
      impact: `${percentagePromos.length} high-value promo${percentagePromos.length > 1 ? 's' : ''}`,
    });
  }

  // Trust badge tool — always available
  tools.push({
    id: 'tool-trust-badge',
    name: 'Trust Badges',
    description: 'Display security badges, free cancellation, and best price guarantee',
    icon: Shield,
    enabled: true,
    type: 'trust_badge',
    impact: '4.8 / 5 rating',
  });

  // Social proof — derived from booking data
  tools.push({
    id: 'tool-social-proof',
    name: 'Social Proof',
    description: 'Show recent bookings, reviews, and popularity indicators',
    icon: ThumbsUp,
    enabled: true,
    type: 'social_proof',
    impact: 'Live counter',
  });

  // Exit popup
  tools.push({
    id: 'tool-exit-popup',
    name: 'Exit-Intent Popup',
    description: 'Display a last-chance offer when guests try to leave the booking flow',
    icon: AlertTriangle,
    enabled: false,
    type: 'exit_popup',
    impact: 'Recover 5-15%',
  });

  return tools;
};

// ─── Data State ────────────────────────────────────────────────────────────
interface ConversionDataState {
  abandonedBookings: AbandonedBooking[];
  recoveryCampaigns: RecoveryCampaign[];
  conversionTrends: ConversionTrend[];
  funnelStages: FunnelStage[];
  optimizationTools: OptimizationTool[];
  recentBookingsCount: number;
  loading: boolean;
  error: string | null;
}

type ConversionDataAction =
  | { type: 'SET_LOADING' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_DATA'; payload: Partial<ConversionDataState> };

const initialState: ConversionDataState = {
  abandonedBookings: [],
  recoveryCampaigns: [],
  conversionTrends: [],
  funnelStages: [],
  optimizationTools: [],
  recentBookingsCount: 0,
  loading: true,
  error: null,
};

function dataReducer(state: ConversionDataState, action: ConversionDataAction): ConversionDataState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: true, error: null };
    case 'SET_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'SET_DATA':
      return { ...state, loading: false, ...action.payload };
    default:
      return state;
  }
}

// ─── Data Fetcher (outside component) ──────────────────────────────────────
async function fetchConversionData(): Promise<Partial<ConversionDataState>> {
  const result: Partial<ConversionDataState> = {};

  const [abandonedRes, seoRes, promoRes] = await Promise.all([
    fetch('/api/marketing/abandoned-bookings'),
    fetch('/api/marketing/seo-analytics?days=7'),
    fetch('/api/marketing/promotions?status=active'),
  ]);

  // Process abandoned bookings
  if (abandonedRes.ok) {
    const abandonedJson = await abandonedRes.json();
    if (abandonedJson.success) {
      const { bookings, stats: apiStats } = abandonedJson.data;
      const funnel = apiStats.funnel || {};
      const recovery = apiStats.recovery || {};

      const mappedBookings: AbandonedBooking[] = (bookings || []).map((b: Record<string, unknown>) => ({
        id: b.id,
        guestName: b.guestEmail || b.guestPhone || 'Guest',
        email: b.guestEmail || '',
        phone: b.guestPhone || '',
        abandonTime: b.createdAt || '',
        roomSearched: b.roomTypeId || '',
        checkIn: b.checkIn ? new Date(b.checkIn).toISOString().split('T')[0] : '',
        checkOut: b.checkOut ? new Date(b.checkOut).toISOString().split('T')[0] : '',
        guests: b.adults || 1,
        value: b.selectedRate || 0,
        recoveryStage: b.recoveryStatus === 'recovered' ? 'recovered' : b.recoveryStatus === 'expired' ? 'lost' : 'new',
        recoveryChannel: null,
      }));
      result.abandonedBookings = mappedBookings;

      // Derive recovery campaigns from stats
      const mappedCampaigns: RecoveryCampaign[] = [];
      if (recovery.pending) mappedCampaigns.push({ id: 'rc0', name: 'Pending', type: 'email_1h' as const, sentCount: recovery.pending, recoveredCount: 0, recoveryRate: 0, revenueRecovered: 0, status: 'active' as const });
      if (recovery.emailed) mappedCampaigns.push({ id: 'rc1', name: 'Email Reminders', type: 'email_24h' as const, sentCount: recovery.emailed, recoveredCount: recovery.recovered || 0, recoveryRate: apiStats.recoveryRate || 0, revenueRecovered: apiStats.totalRevenueRecovered || 0, status: 'active' as const });
      if (recovery.smsSent) mappedCampaigns.push({ id: 'rc2', name: 'SMS Reminders', type: 'discount' as const, sentCount: recovery.smsSent, recoveredCount: 0, recoveryRate: 0, revenueRecovered: 0, status: 'active' as const });
      if (recovery.recovered) mappedCampaigns.push({ id: 'rc3', name: 'Recovered', type: 'retarget' as const, sentCount: mappedBookings.length, recoveredCount: recovery.recovered, recoveryRate: apiStats.recoveryRate || 0, revenueRecovered: apiStats.totalRevenueRecovered || 0, status: 'active' as const });
      result.recoveryCampaigns = mappedCampaigns;

      // Build funnel stages from abandoned bookings funnel
      const builtFunnel = buildFunnelStages(funnel, undefined);
      if (builtFunnel.length > 0) result.funnelStages = builtFunnel;
    }
  }

  // Process SEO analytics (trends + funnel + summary)
  if (seoRes.ok) {
    const seoJson = await seoRes.json();
    if (seoJson.success) {
      const { bookingTrend, conversionFunnel, summary } = seoJson.data;

      // Map booking trend to ConversionTrend
      const trends: ConversionTrend[] = (bookingTrend || []).slice(-7).map((t: Record<string, unknown>) => ({
        date: t.date ? (t.date as string).slice(5) : '',
        directBookings: t.directBookings || 0,
        otaBookings: t.otaBookings || 0,
        directRevenue: t.directRevenue || 0,
        otaRevenue: t.otaRevenue || 0,
        conversionRate: summary?.directBookingShare
          ? parseFloat(((summary.directBookings / Math.max(summary.totalBookings, 1)) * 100).toFixed(1))
          : 0,
      }));
      result.conversionTrends = trends;

      // Build funnel stages from SEO analytics if available (overrides abandoned-based)
      if (conversionFunnel) {
        const builtFunnel = buildFunnelStages(undefined, conversionFunnel);
        if (builtFunnel.length > 0) result.funnelStages = builtFunnel;
      }

      if (summary) {
        result.recentBookingsCount = summary.totalBookings || 0;
      }
    }
  }

  // Process promotions for optimization tools
  if (promoRes.ok) {
    const promoJson = await promoRes.json();
    if (promoJson.success) {
      const { promotions } = promoJson.data;
      result.optimizationTools = buildOptimizationTools(promotions || []);
    }
  }

  return result;
}

// ─── Component ────────────────────────────────────────────────────────────
export default function ConversionEngine() {
  const [activeTab, setActiveTab] = useState('funnel');
  const [data, dispatch] = useReducer(dataReducer, initialState);
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [offerBarText, setOfferBarText] = useState('Summer Sale! Save 20% on stays before June 30');
  const [offerBarEnabled, setOfferBarEnabled] = useState(true);
  const [countdownTarget, setCountdownTarget] = useState('2026-06-30T23:59:59Z');
  const [countdownTime, setCountdownTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Destructure from reducer state
  const {
    abandonedBookings, recoveryCampaigns, conversionTrends,
    funnelStages, optimizationTools, recentBookingsCount,
    loading, error,
  } = data;

  const fetchData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING' });
    try {
      const result = await fetchConversionData();
      dispatch({ type: 'SET_DATA', payload: result });
    } catch (err) {
      console.error('Error fetching conversion data:', err);
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Failed to load conversion data' });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'SET_LOADING' });
    fetchConversionData().then(result => {
      if (!cancelled) dispatch({ type: 'SET_DATA', payload: result });
    }).catch(err => {
      if (!cancelled) dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Failed to load conversion data' });
    });
    return () => { cancelled = true; };
  }, []);

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

  const totalDirectBookings = conversionTrends.reduce((a, t) => a + t.directBookings, 0);
  const totalOtaBookings = conversionTrends.reduce((a, t) => a + t.otaBookings, 0);
  const totalDirectRevenue = conversionTrends.reduce((a, t) => a + t.directRevenue, 0);
  const totalOtaRevenue = conversionTrends.reduce((a, t) => a + t.otaRevenue, 0);
  const commissionRate = 0.20;
  const otaCommissionSaved = totalOtaRevenue * commissionRate - totalOtaRevenue * 0;

  const handleRecoveryAction = (bookingId: string, action: 'email' | 'sms' | 'discount' | 'retarget') => {
    const updated = data.abandonedBookings.map(b =>
      b.id === bookingId
        ? { ...b, recoveryChannel: action, recoveryStage: 'reminded_1h' as const }
        : b
    );
    dispatch({ type: 'SET_DATA', payload: { abandonedBookings: updated } });
    const labels: Record<string, string> = {
      email: 'Reminder email sent',
      sms: 'SMS reminder sent',
      discount: 'Discount offer sent',
      retarget: 'Added to retargeting list',
    };
    toast.success(labels[action] || 'Action completed');
  };

  const toggleTool = (toolId: string) => {
    const updated = data.optimizationTools.map(t =>
      t.id === toolId ? { ...t, enabled: !t.enabled } : t
    );
    dispatch({ type: 'SET_DATA', payload: { optimizationTools: updated } });
  };

  const emptyTrends = conversionTrends.length === 0;
  const hasFunnelData = funnelStages.length > 0;

  const getChannelSourceData = () => {
    const direct = totalDirectBookings || 1;
    const ota = totalOtaBookings;
    const data = [
      { name: 'Direct', value: direct, fill: '#10b981' },
    ];
    if (ota > 0) {
      data.push({ name: 'OTA', value: ota, fill: '#f59e0b' });
    }
    return data;
  };

  const getFunnelDropoffData = () => funnelStages.slice(1).map(s => ({
    name: s.name,
    dropoff: s.dropoff,
    fill: '#ef4444',
  }));

  // Compute dynamic insights from funnel data
  const getFunnelInsights = () => {
    if (funnelStages.length < 3) return null;
    const dropoffs = funnelStages.slice(1).map((s, idx) => ({
      stage: s.name,
      prevStage: funnelStages[idx].name,
      dropoff: s.dropoff,
      rate: funnelStages[idx].visitors > 0
        ? parseFloat(((s.dropoff / funnelStages[idx].visitors) * 100).toFixed(1))
        : 0,
    }));
    dropoffs.sort((a, b) => b.rate - a.rate);
    const largest = dropoffs[0];
    const second = dropoffs[1];
    // Best rate = highest retention (lowest dropoff %)
    const best = dropoffs[dropoffs.length - 1];
    const retentionRate = best.prevVisitors > 0
      ? parseFloat((100 - best.rate).toFixed(1))
      : 0;
    return { largest, second, best: { ...best, retentionRate } };
  };

  const funnelInsights = getFunnelInsights();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

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
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-2 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Conversion Rate</p>
                <p className="text-xl font-bold">{recoveryCampaigns.length > 0 ? recoveryCampaigns.find(c => c.name === 'Recovered')?.recoveryRate || 0 : hasFunnelData ? funnelStages[funnelStages.length - 1].conversionRate : 0}%</p>
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          <TabsTrigger value="funnel">Booking Funnel</TabsTrigger>
          <TabsTrigger value="abandoned">Abandoned Recovery</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="preview">Widget Preview</TabsTrigger>
        </TabsList>

        {/* ─── Booking Funnel Tab ────────────────────────────────────── */}
        <TabsContent value="funnel" className="space-y-4 mt-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {/* Visual Funnel */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Booking Funnel</CardTitle>
                <CardDescription>Visitor progression through each booking stage</CardDescription>
              </CardHeader>
              <CardContent>
                {hasFunnelData ? (
                  <div className="space-y-3">
                    {funnelStages.map((stage, idx) => {
                      const StageIcon = stage.icon;
                      const widthPercent = (stage.visitors / funnelStages[0].visitors) * 100;
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
                              {!isFirst && stage.dropoff > 0 && (
                                <span className="text-red-500 dark:text-red-400 text-xs">
                                  -{stage.dropoff.toLocaleString()} ({((stage.dropoff / funnelStages[idx - 1].visitors) * 100).toFixed(1)}%)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="relative h-10 rounded-lg bg-muted overflow-hidden">
                            <div
                              className={cn(
                                'absolute inset-y-0 left-0 rounded-lg transition-all duration-700',
                                isFirst
                                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                                  : idx === funnelStages.length - 1
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
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">No funnel data available yet.</p>
                    <p className="text-xs mt-1">Funnel data will appear once bookings are created.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Drop-off Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Drop-off Analysis</CardTitle>
                <CardDescription>Where guests leave the funnel</CardDescription>
              </CardHeader>
              <CardContent>
                {hasFunnelData && getFunnelDropoffData().length > 0 ? (
                  <>
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
                        {funnelInsights?.largest && (
                          <div className="flex items-start gap-2 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-muted-foreground">
                              <strong>Largest drop-off:</strong> {funnelInsights.largest.prevStage} to {funnelInsights.largest.stage} (-{funnelInsights.largest.rate}%)
                            </p>
                          </div>
                        )}
                        {funnelInsights?.second && (
                          <div className="flex items-start gap-2 text-xs">
                            <TrendingDown className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                            <p className="text-muted-foreground">
                              <strong>Second largest:</strong> {funnelInsights.second.prevStage} to {funnelInsights.second.stage} (-{funnelInsights.second.rate}%)
                            </p>
                          </div>
                        )}
                        {funnelInsights?.best && (
                          <div className="flex items-start gap-2 text-xs">
                            <TrendingUp className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                            <p className="text-muted-foreground">
                              <strong>Best retention:</strong> {funnelInsights.best.prevStage} to {funnelInsights.best.stage} ({funnelInsights.best.retentionRate}%)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <TrendingDown className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">No drop-off data yet.</p>
                  </div>
                )}
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
              {emptyTrends ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">No trend data available for the selected period.</p>
                  <p className="text-xs mt-1">Data will appear as bookings come in.</p>
                </div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={conversionTrends} margin={{ left: 0, right: 10 }}>
                      <defs>
                        <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="date" fontSize={11} tickLine={false} />
                      <YAxis fontSize={11} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(value: number) => [`${value}%`, 'Conversion Rate']} />
                      <Area type="monotone" dataKey="conversionRate" stroke="#10b981" strokeWidth={2} fill="url(#convGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Abandoned Recovery Tab ─────────────────────────────────── */}
        <TabsContent value="abandoned" className="space-y-4 mt-4">
          {/* Recovery Campaign Stats */}
          <div className="grid gap-2 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
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
              {recoveryCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <RotateCcw className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">No recovery campaigns active.</p>
                  <p className="text-xs mt-1">Campaigns will appear as abandoned bookings come in.</p>
                </div>
              ) : (
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
              )}
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
                {filteredBookings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ShoppingCart className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">
                      {totalAbandoned === 0
                        ? 'No abandoned bookings yet.'
                        : 'No bookings match your search.'}
                    </p>
                    <p className="text-xs mt-1">
                      {totalAbandoned === 0
                        ? 'Abandoned bookings will appear here when guests start but do not complete a booking.'
                        : 'Try adjusting your search or filter.'}
                    </p>
                  </div>
                ) : (
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
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Optimization Tab ───────────────────────────────────────── */}
        <TabsContent value="optimization" className="space-y-4 mt-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
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
                {optimizationTools.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Sparkles className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">No optimization tools configured yet.</p>
                    <p className="text-xs mt-1">Create promotions to enable offer bars and urgency tools.</p>
                  </div>
                ) : (
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
                )}
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
                  <Switch
                    checked={optimizationTools.find(t => t.type === 'exit_popup')?.enabled || false}
                    onCheckedChange={() => toggleTool('tool-exit-popup')}
                  />
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
                {optimizationTools.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      <strong>Tip:</strong> Exit-intent popups can recover 5-15% of abandoning visitors. Combine with an active promotion for best results.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Performance Tab ────────────────────────────────────────── */}
        <TabsContent value="performance" className="space-y-4 mt-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {/* Direct vs OTA */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Direct vs OTA Bookings</CardTitle>
                <CardDescription>Booking volume comparison (7 days)</CardDescription>
              </CardHeader>
              <CardContent>
                {emptyTrends ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">No performance data yet.</p>
                  </div>
                ) : (
                  <>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={conversionTrends} margin={{ left: 0 }}>
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
                        <span>Direct: {totalDirectBookings} ({totalDirectBookings + totalOtaBookings > 0 ? ((totalDirectBookings / (totalDirectBookings + totalOtaBookings)) * 100).toFixed(0) : 0}%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <span>OTA: {totalOtaBookings} ({totalDirectBookings + totalOtaBookings > 0 ? ((totalOtaBookings / (totalDirectBookings + totalOtaBookings)) * 100).toFixed(0) : 0}%)</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Revenue by Source */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue by Source</CardTitle>
                <CardDescription>Direct vs OTA revenue distribution</CardDescription>
              </CardHeader>
              <CardContent>
                {emptyTrends ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <DollarSign className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">No revenue data yet.</p>
                  </div>
                ) : (
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
                )}
              </CardContent>
            </Card>

            {/* Conversion Trend */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Conversion Rate Trend</CardTitle>
                <CardDescription>Daily direct booking conversion rate (7 days)</CardDescription>
              </CardHeader>
              <CardContent>
                {emptyTrends ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <TrendingUp className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">No trend data available.</p>
                  </div>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={conversionTrends} margin={{ left: 0, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="date" fontSize={11} tickLine={false} />
                        <YAxis fontSize={11} tickFormatter={(v) => `${v}%`} />
                        <Tooltip formatter={(value: number) => [`${value}%`, 'Conversion Rate']} />
                        <Line type="monotone" dataKey="conversionRate" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5 }} activeDot={{ r: 7 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
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
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Recent Bookings Counter</Label>
                  <div className="border rounded-lg p-4 bg-background">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          <span className="text-emerald-600 dark:text-emerald-400">{recentBookingsCount.toLocaleString()}</span> total bookings
                        </p>
                        <p className="text-xs text-muted-foreground">All-time booking volume</p>
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
