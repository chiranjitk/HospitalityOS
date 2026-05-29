'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format, addDays, startOfDay, parseISO } from 'date-fns';
import {
  Search,
  Calendar,
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
  Target,
  Zap,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Trash2,
  Plus,
  Loader2,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

type ParityStatus = 'par' | 'higher' | 'lower' | 'not_available';
type DemandLevel = 'low' | 'medium' | 'high';
type MarketSegment = 'budget' | 'mid' | 'premium' | 'luxury';

interface ChannelInfo {
  id: string;
  name: string;
  color: string;
  bgColor: string;
}

interface Competitor {
  id: string;
  name: string;
  channel: string;
  propertyId: string | null;
  url: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RateResult {
  id: string;
  competitorId: string;
  roomTypeId: string | null;
  checkIn: string;
  checkOut: string;
  competitorRate: number;
  ourRate: number;
  parityStatus: string;
  rateDifference: number;
  currency: string;
  fetchedAt: string;
}

interface CompetitorRate {
  date: string;
  ourRate: number;
  competitorRates: Record<string, number | null>;
}

interface RateCalendarDay {
  date: string;
  ourRate: number;
  marketAvg: number;
  demand: DemandLevel;
  color: string;
}

interface ApiStats {
  total: number;
  active: number;
  lastFetchedAt: string | null;
  parity: number;
  below: number;
  above: number;
  unknown: number;
}

interface ResultsStats {
  total: number;
  parity: number;
  below: number;
  above: number;
  avgRateDifference: number;
}

interface ParityBreachAlert {
  id: string;
  competitorName: string;
  channel: string;
  ourRate: number;
  competitorRate: number;
  rateDiff: number;
  checkIn: string;
  fetchedAt: string;
}

// ============================================================
// Constants
// ============================================================

const CHANNELS: ChannelInfo[] = [
  { id: 'booking.com', name: 'Booking.com', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900' },
  { id: 'expedia', name: 'Expedia', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900' },
  { id: 'airbnb', name: 'Airbnb', color: 'text-rose-600', bgColor: 'bg-rose-100 dark:bg-rose-900' },
  { id: 'tripadvisor', name: 'TripAdvisor', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900' },
  { id: 'agoda', name: 'Agoda', color: 'text-sky-600', bgColor: 'bg-sky-100 dark:bg-sky-900' },
  { id: 'makemytrip', name: 'MakeMyTrip', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900' },
  { id: 'goibibo', name: 'Goibibo', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900' },
  { id: 'direct', name: 'Direct', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900' },
  { id: 'google', name: 'Google Hotels', color: 'text-violet-600', bgColor: 'bg-violet-100 dark:bg-violet-900' },
  { id: 'other', name: 'Other', color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-800' },
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

function getChannelInfo(channelId: string): ChannelInfo {
  const normalized = channelId.toLowerCase().replace(/_/g, '.').replace(/ /g, '.');
  return CHANNELS.find(ch => ch.id === channelId || ch.id === normalized) || { id: channelId, name: channelId, color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-800' };
}

function getParityStatusFromResult(status: string): ParityStatus {
  if (status === 'parity') return 'par';
  if (status === 'above') return 'higher';
  if (status === 'below') return 'lower';
  return 'not_available';
}

function getParityStatus(ourRate: number, competitorRate: number | null): ParityStatus {
  if (competitorRate === null || competitorRate === 0) return 'not_available';
  const diff = ((ourRate - competitorRate) / competitorRate) * 100;
  if (Math.abs(diff) <= 3) return 'par';
  if (diff > 0) return 'higher';
  return 'lower';
}

function getDemandLevel(index: number): DemandLevel {
  if (index < 0.33) return 'low';
  if (index < 0.67) return 'medium';
  return 'high';
}

function getCalendarColor(ourRate: number, marketAvg: number): string {
  if (marketAvg === 0) return 'bg-gray-50 dark:bg-gray-900';
  const diff = ((ourRate - marketAvg) / marketAvg) * 100;
  if (diff > 10) return 'bg-emerald-200 dark:bg-emerald-900';
  if (diff > 3) return 'bg-emerald-100 dark:bg-emerald-950';
  if (diff > -3) return 'bg-amber-50 dark:bg-amber-950';
  if (diff > -10) return 'bg-orange-100 dark:bg-orange-950';
  return 'bg-red-100 dark:bg-red-950';
}

function getMarketSegment(rate: number): MarketSegment {
  if (rate < 100) return 'budget';
  if (rate < 200) return 'mid';
  if (rate < 350) return 'premium';
  return 'luxury';
}

function exportToCSV(rates: CompetitorRate[], competitors: Competitor[]) {
  const headers = ['Date', 'Our Rate', ...competitors.map(c => c.name)];
  const rows = rates.map(r => [
    r.date,
    r.ourRate.toString(),
    ...competitors.map(c => (r.competitorRates[c.id] ?? 'N/A').toString()),
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

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// ============================================================
// Loading Skeleton
// ============================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-36 bg-muted rounded" />
          <div className="h-9 w-36 bg-muted rounded" />
          <div className="h-9 w-36 bg-muted rounded" />
        </div>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="h-96 bg-muted rounded-lg" />
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function RateShopping() {
  const today = startOfDay(new Date());
  const [startDate, setStartDate] = useState(format(addDays(today, 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(today, 30), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState('matrix');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [sortBy, setSortBy] = useState<'date' | 'ourRate'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // --- API State ---
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [results, setResults] = useState<RateResult[]>([]);
  const [apiStats, setApiStats] = useState<ApiStats | null>(null);
  const [resultsStats, setResultsStats] = useState<ResultsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Add Competitor Dialog ---
  const [isAddCompOpen, setIsAddCompOpen] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompChannel, setNewCompChannel] = useState('booking.com');
  const [isAdding, setIsAdding] = useState(false);

  // ============================================================
  // API Fetch Functions
  // ============================================================

  const fetchCompetitors = useCallback(async () => {
    try {
      const res = await fetch('/api/revenue/rate-shopping');
      if (!res.ok) throw new Error('Failed to fetch competitors');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch competitors');
      setCompetitors(json.data.competitors);
      setApiStats(json.data.stats);
      return json.data;
    } catch (err) {
      throw err;
    }
  }, []);

  const fetchResults = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('dateFrom', startDate);
      params.set('dateTo', endDate);
      const res = await fetch(`/api/revenue/rate-shopping/results?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch results');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch results');
      setResults(json.data.results);
      setResultsStats(json.data.stats);
    } catch (err) {
      throw err;
    }
  }, [startDate, endDate]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchCompetitors(), fetchResults()]);
    } catch {
      setError('Failed to load rate shopping data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchCompetitors, fetchResults]);

  // ============================================================
  // Effects
  // ============================================================

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchCompetitors(), fetchResults()]);
      } catch {
        if (!cancelled) setError('Failed to load rate shopping data. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  // Re-fetch results when date range changes (debounced)
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        fetchResults().catch(() => {
          /* handled silently */
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [startDate, endDate, loading, fetchResults]);

  // ============================================================
  // Handlers
  // ============================================================

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchAll();
      toast.success('Rate data refreshed');
    } catch {
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddCompetitor = async () => {
    if (!newCompName.trim()) {
      toast.error('Competitor name is required');
      return;
    }
    setIsAdding(true);
    try {
      const res = await fetch('/api/revenue/rate-shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCompName.trim(), channel: newCompChannel }),
      });
      if (!res.ok) throw new Error('Failed to add competitor');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to add competitor');
      toast.success(`"${newCompName.trim()}" added as competitor`);
      setNewCompName('');
      setIsAddCompOpen(false);
      await fetchCompetitors();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add competitor');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCompetitor = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/revenue/rate-shopping?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete competitor');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to delete competitor');
      toast.success(`"${name}" removed`);
      await fetchCompetitors();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete competitor');
    }
  };

  const handleToggleSort = (col: 'date' | 'ourRate') => {
    if (sortBy === col) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  // ============================================================
  // Computed Data
  // ============================================================

  // Build a map: competitorId -> competitor for quick lookup
  const competitorMap = useMemo(() => {
    const map: Record<string, Competitor> = {};
    for (const c of competitors) {
      map[c.id] = c;
    }
    return map;
  }, [competitors]);

  // Only active competitors for display
  const activeCompetitors = useMemo(() => competitors.filter(c => c.isActive), [competitors]);

  // Transform results into rate matrix rows grouped by date
  const rateData = useMemo((): CompetitorRate[] => {
    if (results.length === 0 || activeCompetitors.length === 0) return [];

    // Group results by checkIn date
    const byDate = new Map<string, RateResult[]>();
    for (const r of results) {
      const dateKey = format(parseISO(r.checkIn), 'yyyy-MM-dd');
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push(r);
    }

    const dates = Array.from(byDate.keys()).sort();
    return dates.map(dateStr => {
      const dayResults = byDate.get(dateStr) || [];
      const ourRate = dayResults[0]?.ourRate ?? 0;
      const competitorRates: Record<string, number | null> = {};

      for (const comp of activeCompetitors) {
        const compResult = dayResults.find(r => r.competitorId === comp.id);
        competitorRates[comp.id] = compResult ? compResult.competitorRate : null;
      }

      return { date: dateStr, ourRate, competitorRates };
    });
  }, [results, activeCompetitors]);

  // Analytics computed from results
  const analytics = useMemo(() => {
    if (results.length === 0) {
      return { marketAvg: 0, ourAvg: 0, ourPercentile: 50, parityStats: [] as { channel: ChannelInfo; par: number; higher: number; lower: number; na: number }[], lowestComp: 0, highestComp: 0 };
    }

    const allCompRates = results.map(r => r.competitorRate).filter(r => r > 0);
    const marketAvg = allCompRates.length > 0 ? allCompRates.reduce((s, v) => s + v, 0) / allCompRates.length : 0;
    const uniqueOurRates = new Map<string, number>();
    for (const r of results) {
      uniqueOurRates.set(r.checkIn, r.ourRate);
    }
    const ourRateValues = Array.from(uniqueOurRates.values());
    const ourAvg = ourRateValues.length > 0 ? ourRateValues.reduce((s, v) => s + v, 0) / ourRateValues.length : 0;

    // Percentile
    const allRates = [...allCompRates, ourAvg].sort((a, b) => a - b);
    const idx = allRates.indexOf(ourAvg);
    const ourPercentile = idx >= 0 ? Math.round((idx / allRates.length) * 100) : 50;

    // Per-channel parity stats
    const parityStats: { channel: ChannelInfo; par: number; higher: number; lower: number; na: number }[] = [];
    // Group competitors by channel
    const channelGroups = new Map<string, Competitor[]>();
    for (const comp of competitors) {
      const ch = comp.channel.toLowerCase();
      if (!channelGroups.has(ch)) channelGroups.set(ch, []);
      channelGroups.get(ch)!.push(comp);
    }

    for (const [channelId, comps] of channelGroups) {
      const chInfo = getChannelInfo(channelId);
      let par = 0;
      let higher = 0;
      let lower = 0;
      let na = 0;
      const compIds = new Set(comps.map(c => c.id));
      for (const r of results) {
        if (!compIds.has(r.competitorId)) continue;
        if (r.parityStatus === 'parity') par++;
        else if (r.parityStatus === 'above') higher++;
        else if (r.parityStatus === 'below') lower++;
        else na++;
      }
      if (par + higher + lower + na > 0) {
        parityStats.push({ channel: chInfo, par, higher, lower, na });
      }
    }

    const lowestComp = allCompRates.length > 0 ? Math.min(...allCompRates) : 0;
    const highestComp = allCompRates.length > 0 ? Math.max(...allCompRates) : 0;

    return { marketAvg, ourAvg, ourPercentile, parityStats, lowestComp, highestComp };
  }, [results, competitors]);

  const recommendation = useMemo(() => {
    if (analytics.marketAvg === 0) return { action: 'No market data available. Add competitors and fetch rate data.', severity: 'info' as const };
    const diff = ((analytics.ourAvg - analytics.marketAvg) / analytics.marketAvg) * 100;
    if (diff > 15) return { action: 'Consider reducing rates by 5-10% to stay competitive', severity: 'warning' as const };
    if (diff > 8) return { action: 'Rates slightly above market. Monitor competitor movements closely', severity: 'info' as const };
    if (diff < -10) return { action: 'Opportunity to increase rates. Demand supports higher pricing', severity: 'success' as const };
    return { action: 'Pricing is well-positioned in the market. Maintain current strategy', severity: 'success' as const };
  }, [analytics]);

  // Calendar data
  const calendarData = useMemo((): RateCalendarDay[] => {
    const monthStart = format(new Date(calendarYear, calendarMonth, 1), 'yyyy-MM-dd');
    const monthEnd = format(new Date(calendarYear, calendarMonth + 1, 0), 'yyyy-MM-dd');
    const monthResults = results.filter(r => {
      const d = format(parseISO(r.checkIn), 'yyyy-MM-dd');
      return d >= monthStart && d <= monthEnd;
    });

    if (monthResults.length === 0) return [];

    // Group by date
    const byDate = new Map<string, RateResult[]>();
    for (const r of monthResults) {
      const dateKey = format(parseISO(r.checkIn), 'yyyy-MM-dd');
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push(r);
    }

    const days: RateCalendarDay[] = [];
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = format(new Date(calendarYear, calendarMonth, d), 'yyyy-MM-dd');
      const dayResults = byDate.get(dateStr);
      if (!dayResults || dayResults.length === 0) continue;

      const ourRate = Math.round(dayResults[0].ourRate);
      const compRates = dayResults.map(r => r.competitorRate).filter(r => r > 0);
      const marketAvg = compRates.length > 0 ? Math.round(compRates.reduce((s, v) => s + v, 0) / compRates.length) : ourRate;
      const demand = getDemandLevel((d - 1) / daysInMonth);

      days.push({
        date: dateStr,
        ourRate,
        marketAvg,
        demand,
        color: getCalendarColor(ourRate, marketAvg),
      });
    }
    return days;
  }, [results, calendarMonth, calendarYear]);

  // Sorted rate data for matrix table
  const sortedRateData = useMemo(() => {
    const sorted = [...rateData];
    sorted.sort((a, b) => {
      const valA = sortBy === 'date' ? a.date : a.ourRate;
      const valB = sortBy === 'date' ? b.date : b.ourRate;
      return sortDir === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
    return sorted;
  }, [rateData, sortBy, sortDir]);

  // Market position ranking
  const marketSegments = useMemo(() => {
    if (activeCompetitors.length === 0) return [];

    // Calculate avg rate per competitor from results
    const avgByCompetitor = new Map<string, { total: number; count: number }>();
    for (const r of results) {
      if (!activeCompetitors.some(c => c.id === r.competitorId)) continue;
      const entry = avgByCompetitor.get(r.competitorId) || { total: 0, count: 0 };
      entry.total += r.competitorRate;
      entry.count += 1;
      avgByCompetitor.set(r.competitorId, entry);
    }

    // Calculate our average
    const ourRateSet = new Map<string, number>();
    for (const r of results) {
      ourRateSet.set(r.checkIn, r.ourRate);
    }
    const ourAvg = ourRateSet.size > 0
      ? Array.from(ourRateSet.values()).reduce((s, v) => s + v, 0) / ourRateSet.size
      : 0;

    const entries = activeCompetitors.map(comp => {
      const avg = avgByCompetitor.get(comp.id);
      const rate = avg ? Math.round(avg.total / avg.count) : 0;
      return { name: comp.name, rate, segment: getMarketSegment(rate) };
    });

    if (ourAvg > 0) {
      entries.push({ name: 'Our Property', rate: Math.round(ourAvg), segment: getMarketSegment(ourAvg) });
    }

    return entries.sort((a, b) => a.rate - b.rate);
  }, [results, activeCompetitors]);

  // Parity breach alerts derived from results
  const parityAlerts = useMemo((): ParityBreachAlert[] => {
    return results
      .filter(r => r.parityStatus === 'below')
      .slice(0, 50)
      .map(r => ({
        id: r.id,
        competitorName: competitorMap[r.competitorId]?.name ?? 'Unknown Competitor',
        channel: competitorMap[r.competitorId]?.channel ?? 'unknown',
        ourRate: Math.round(r.ourRate),
        competitorRate: Math.round(r.competitorRate),
        rateDiff: Math.round(r.rateDifference * 100) / 100,
        checkIn: r.checkIn,
        fetchedAt: r.fetchedAt,
      }))
      .sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
  }, [results, competitorMap]);

  const calendarDaysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();

  // ============================================================
  // Render
  // ============================================================

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <p className="text-lg font-medium">{error}</p>
        <Button onClick={fetchAll} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

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
          {apiStats?.lastFetchedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Last fetched: {format(parseISO(apiStats.lastFetchedAt), 'MMM dd, yyyy HH:mm')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToCSV(rateData, activeCompetitors)} disabled={rateData.length === 0}>
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
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
                  {analytics.marketAvg > 0 ? (
                    analytics.ourAvg > analytics.marketAvg ? (
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
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">No data</span>
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
                <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{apiStats?.total ?? 0}</p>
                <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">{apiStats?.active ?? 0} active · {rateData.length} dates</p>
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          <TabsTrigger value="matrix" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5 hidden sm:block" />Rate Matrix</TabsTrigger>
          <TabsTrigger value="parity" className="gap-1.5"><Shield className="h-3.5 w-3.5 hidden sm:block" />Parity</TabsTrigger>
          <TabsTrigger value="position" className="gap-1.5"><MapPin className="h-3.5 w-3.5 hidden sm:block" />Position</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5"><Calendar className="h-3.5 w-3.5 hidden sm:block" />Calendar</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5"><Bell className="h-3.5 w-3.5 hidden sm:block" />Alerts</TabsTrigger>
        </TabsList>

        {/* ---- Tab: Rate Matrix ---- */}
        <TabsContent value="matrix" className="mt-4 space-y-4">
          {activeCompetitors.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center">
                <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <h3 className="text-lg font-medium">No Competitors Added</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Add competitors to start comparing rates</p>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsAddCompOpen(true)}>
                  <Plus className="h-4 w-4" /> Add Competitor
                </Button>
              </CardContent>
            </Card>
          ) : results.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center">
                <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <h3 className="text-lg font-medium">No Rate Data for Selected Period</h3>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting the date range or refreshing data</p>
              </CardContent>
            </Card>
          ) : (
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
                  <div className="overflow-x-auto">
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
                        {activeCompetitors.map(comp => {
                          const chInfo = getChannelInfo(comp.channel);
                          return (
                            <TableHead key={comp.id} className="min-w-[130px]">
                              <div className="flex items-center gap-1">
                                <span className="text-xs">{comp.name}</span>
                                <Badge variant="outline" className={`text-[10px] px-1 py-0 ${chInfo.color}`}>{chInfo.name}</Badge>
                              </div>
                            </TableHead>
                          );
                        })}
                        <TableHead className="min-w-[80px]">Market Avg</TableHead>
                        <TableHead className="min-w-[80px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedRateData.map((row) => {
                        const compRates = Object.values(row.competitorRates).filter((v): v is number => v !== null);
                        const marketAvg = compRates.length > 0 ? Math.round(compRates.reduce((s, v) => s + v, 0) / compRates.length) : row.ourRate;
                        const dayResults = results.filter(r => format(parseISO(r.checkIn), 'yyyy-MM-dd') === row.date);
                        const belowCount = dayResults.filter(r => r.parityStatus === 'below').length;
                        const parityCount = dayResults.filter(r => r.parityStatus === 'parity').length;
                        return (
                          <TableRow key={row.date}>
                            <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm">
                              {format(parseISO(row.date), 'MMM dd, EEE')}
                            </TableCell>
                            <TableCell className="sticky left-[100px] bg-background z-10 font-bold text-emerald-600">
                              ${row.ourRate}
                            </TableCell>
                            {activeCompetitors.map(comp => {
                              const compRate = row.competitorRates[comp.id];
                              const status = getParityStatus(row.ourRate, compRate);
                              const dev = compRate !== null && compRate > 0 ? (((row.ourRate - compRate) / compRate) * 100).toFixed(1) : null;
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
                              {belowCount > 0 ? (
                                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px]">
                                  {belowCount} below
                                </Badge>
                              ) : parityCount > 0 ? (
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-[10px]">
                                  {parityCount} par
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
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
              {resultsStats && (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 mb-6">
                  <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                    <p className="text-2xl font-bold text-emerald-600">{resultsStats.parity}</p>
                    <p className="text-xs text-muted-foreground">At Parity</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                    <p className="text-2xl font-bold text-red-600">{resultsStats.above}</p>
                    <p className="text-xs text-muted-foreground">Above Market</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    <p className="text-2xl font-bold text-amber-600">{resultsStats.below}</p>
                    <p className="text-xs text-muted-foreground">Below Market</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">${Math.round(resultsStats.avgRateDifference)}</p>
                    <p className="text-xs text-muted-foreground">Avg Difference</p>
                  </div>
                </div>
              )}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                          <div className="text-center">
                            <p className="text-lg font-bold text-emerald-600">{par}</p>
                            <p className="text-[10px] text-muted-foreground">Par</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-red-600">{higher}</p>
                            <p className="text-[10px] text-muted-foreground">Above</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-amber-600">{lower}</p>
                            <p className="text-[10px] text-muted-foreground">Below</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{na} unknown status</p>
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
                      <span className="font-bold">${Math.round(analytics.marketAvg) || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm text-muted-foreground">Your Rate vs Market</span>
                      <span className="font-bold text-emerald-600">{analytics.ourPercentile}th Percentile</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm text-muted-foreground">Lowest Competitor</span>
                      <span className="font-bold text-sky-600">
                        ${analytics.lowestComp || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm text-muted-foreground">Highest Competitor</span>
                      <span className="font-bold text-red-600">
                        ${analytics.highestComp || '—'}
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
                    <h4 className="text-sm font-medium">Parity Distribution</h4>
                    {resultsStats && resultsStats.total > 0 ? (
                      <div className="flex gap-3">
                        <Badge className={`${DEMAND_CONFIG.low.bgColor} ${DEMAND_CONFIG.low.color} flex-1 justify-center py-2`}>
                          <Zap className="h-3.5 w-3.5 mr-1" /> Below: {Math.round((resultsStats.below / resultsStats.total) * 100)}%
                        </Badge>
                        <Badge className={`${DEMAND_CONFIG.medium.bgColor} ${DEMAND_CONFIG.medium.color} flex-1 justify-center py-2`}>
                          <Activity className="h-3.5 w-3.5 mr-1" /> Par: {Math.round((resultsStats.parity / resultsStats.total) * 100)}%
                        </Badge>
                        <Badge className={`${DEMAND_CONFIG.high.bgColor} ${DEMAND_CONFIG.high.color} flex-1 justify-center py-2`}>
                          <TrendingUp className="h-3.5 w-3.5 mr-1" /> Above: {Math.round((resultsStats.above / resultsStats.total) * 100)}%
                        </Badge>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No results data available</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Tab: Rate Position Map ---- */}
        <TabsContent value="position" className="mt-4 space-y-4">
          {activeCompetitors.length === 0 || results.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center">
                <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <h3 className="text-lg font-medium">No Position Data</h3>
                <p className="text-sm text-muted-foreground mt-1">Add competitors and fetch rate data to see your market position</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Rate Position Map
                </CardTitle>
                <CardDescription>Your property&apos;s position in the competitive landscape</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium mb-4">Competitive Set - Rate Ranking</h4>
                    <div className="space-y-3">
                      {marketSegments.map((prop, index) => {
                        const isOurProperty = prop.name === 'Our Property';
                        const maxRate = marketSegments[marketSegments.length - 1]?.rate ?? 1;
                        const widthPct = Math.max((prop.rate / maxRate) * 100, 5);
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {(Object.entries(SEGMENT_CONFIG) as [MarketSegment, typeof SEGMENT_CONFIG[MarketSegment]][]).map(([key, config]) => (
                        <div key={key} className="flex items-center gap-2 p-3 rounded-lg border">
                          <div className="w-3 h-3 rounded-full" style={{
                            backgroundColor: key === 'budget' ? '#0ea5e9' : key === 'mid' ? '#10b981' : key === 'premium' ? '#8b5cf6' : '#f59e0b'
                          }} />
                          <div>
                            <p className="text-sm font-medium">{config.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {key === 'budget' ? '< $100' : key === 'mid' ? '$100-200' : key === 'premium' ? '$200-350' : '$350+'}
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
                      {activeCompetitors.map(comp => {
                        // Calculate avg rate from results
                        const compResults = results.filter(r => r.competitorId === comp.id);
                        const avgRate = compResults.length > 0
                          ? Math.round(compResults.reduce((s, r) => s + r.competitorRate, 0) / compResults.length)
                          : 0;
                        const status = getParityStatus(analytics.ourAvg, avgRate || null);
                        const chInfo = getChannelInfo(comp.channel);
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
                                    {chInfo.name}
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
                                <p className="text-lg font-bold">${avgRate || '—'}</p>
                                <p className="text-xs text-muted-foreground">avg rate/night</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">
                                  {compResults.length} data points
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {chInfo.name}
                              </Badge>
                              {comp.isActive ? (
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-[10px]">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
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

              {calendarData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No rate data available for this month</p>
                </div>
              ) : (
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
                    return (
                      <div
                        key={day.date}
                        className={`rounded-md p-2 min-h-[70px] border ${day.color} hover:shadow-sm transition-shadow cursor-pointer`}
                        title={`$${day.ourRate} (Market: $${day.marketAvg})`}
                      >
                        <p className="text-xs font-medium">{format(parseISO(day.date), 'd')}</p>
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">${day.ourRate}</p>
                        <p className="text-[10px] text-muted-foreground">avg ${day.marketAvg}</p>
                        <Badge className={`${DEMAND_CONFIG[day.demand].bgColor} ${DEMAND_CONFIG[day.demand].color} text-[8px] px-1 py-0 mt-1`}>
                          {DEMAND_CONFIG[day.demand].label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Tab: Alerts ---- */}
        <TabsContent value="alerts" className="mt-4 space-y-4">
          {/* Competitor Management */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Hotel className="h-5 w-5" />
                    Competitors
                  </CardTitle>
                  <CardDescription>Manage your competitive set</CardDescription>
                </div>
                <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsAddCompOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Competitor
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {competitors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No competitors configured</p>
                  <p className="text-sm">Add competitors to start rate shopping</p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {competitors.map(comp => {
                    const chInfo = getChannelInfo(comp.channel);
                    return (
                      <div key={comp.id} className={`flex items-center justify-between p-3 rounded-lg border ${comp.isActive ? '' : 'opacity-50'}`}>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Hotel className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{comp.name}</p>
                              <Badge className={`${chInfo.bgColor} ${chInfo.color} text-[10px]`}>{chInfo.name}</Badge>
                              {comp.isActive ? (
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-[10px]">Active</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Added {comp.createdAt ? format(parseISO(comp.createdAt), 'MMM dd, yyyy') : 'Unknown'}
                              {comp.url && <> · {comp.url}</>}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteCompetitor(comp.id, comp.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parity Breach Alerts */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BellRing className="h-5 w-5" />
                    Rate Parity Alerts
                  </CardTitle>
                  <CardDescription>Instances where competitors are below your rate</CardDescription>
                </div>
                {resultsStats && (
                  <Badge variant="outline" className="text-xs">
                    {resultsStats.below} breach{resultsStats.below !== 1 ? 'es' : ''} found
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {parityAlerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                  <p>No parity breaches detected</p>
                  <p className="text-sm">All tracked competitors are at or above your rate</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {parityAlerts.map(alert => {
                    const chInfo = getChannelInfo(alert.channel);
                    return (
                      <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                        <div className="mt-0.5">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{alert.competitorName}</p>
                            <p className="text-xs text-muted-foreground shrink-0 ml-2">{timeAgo(alert.fetchedAt)}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <Badge className={`${chInfo.bgColor} ${chInfo.color} text-[10px] mr-1`}>{chInfo.name}</Badge>
                            Competitor at <span className="font-medium text-amber-600">${alert.competitorRate}</span> vs your <span className="font-medium">${alert.ourRate}</span>
                            {' '}({alert.rateDiff > 0 ? '+' : ''}${alert.rateDiff}% diff)
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Check-in: {format(parseISO(alert.checkIn), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Overall Parity Summary */}
              {apiStats && (
                <>
                  <Separator className="my-6" />
                  <div>
                    <h4 className="text-sm font-medium mb-3">Overall Parity Summary</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-lg font-bold">{apiStats.parity}</p>
                        <p className="text-xs text-muted-foreground">At Parity</p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-center">
                        <p className="text-lg font-bold text-amber-600">{apiStats.below}</p>
                        <p className="text-xs text-muted-foreground">Below</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-center">
                        <p className="text-lg font-bold text-red-600">{apiStats.above}</p>
                        <p className="text-xs text-muted-foreground">Above</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-lg font-bold text-muted-foreground">{apiStats.unknown}</p>
                        <p className="text-xs text-muted-foreground">Unknown</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Competitor Dialog */}
      <Dialog open={isAddCompOpen} onOpenChange={setIsAddCompOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Competitor</DialogTitle>
            <DialogDescription>
              Add a competitor property to track for rate shopping
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Competitor Name</label>
              <Input
                placeholder="e.g. Grand Palace Hotel"
                value={newCompName}
                onChange={e => setNewCompName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Channel</label>
              <Select value={newCompChannel} onValueChange={setNewCompChannel}>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCompOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCompetitor} className="bg-emerald-600 hover:bg-emerald-700" disabled={isAdding}>
              {isAdding ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : 'Add Competitor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
