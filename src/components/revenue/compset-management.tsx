'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format, subDays, parseISO } from 'date-fns';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  BarChart3,
  Trophy,
  Plus,
  Settings,
  Star,
  MapPin,
  RefreshCw,
  Trash2,
  Edit3,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Minus,
  Crown,
  Medal,
  Calendar,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface CompSetSummary {
  id: string;
  name: string;
  description: string | null;
  segment: string;
  propertyId: string;
  propertyName: string;
  memberCount: number;
  metricsCount: number;
  latestRgi: number | null;
  latestAdrIndex: number | null;
  latestMpi: number | null;
  latestRevparIndex: number | null;
  latestDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CompSetMember {
  id: string;
  tenantId: string;
  competitiveSetId: string;
  hotelName: string;
  hotelCode: string | null;
  starRating: number | null;
  totalRooms: number | null;
  proximityKm: number | null;
  channel: string;
  competitorId: string | null;
  url: string | null;
  isActive: boolean;
  sortOrder: number;
  latestPrice: number | null;
  latestPriceDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MetricData {
  id: string;
  date: string;
  period: string;
  ourAdr: number;
  ourOccupancy: number;
  ourRevpar: number;
  compsetAdr: number;
  compsetOccupancy: number;
  compsetRevpar: number;
  adrIndex: number;
  mpi: number;
  rgi: number;
  revparIndex: number;
  compsetSize: number;
  ourRank: number | null;
  dataCompleteness: number;
  source: string;
  createdAt: string;
}

interface RankingEntry {
  name: string;
  adr: number;
  occupancy: number;
  revpar: number;
  isOurProperty: boolean;
  starRating: number | null;
  totalRooms: number | null;
  proximityKm: number | null;
}

// ============================================================
// Constants
// ============================================================

const SEGMENTS = [
  { value: 'primary', label: 'Primary', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  { value: 'secondary', label: 'Secondary', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300' },
  { value: 'luxury', label: 'Luxury', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  { value: 'budget', label: 'Budget', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  { value: 'resort', label: 'Resort', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300' },
  { value: 'extended_stay', label: 'Extended Stay', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300' },
];

function getIndexColor(value: number): { bg: string; text: string; label: string } {
  if (value > 110) return { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-700 dark:text-emerald-300', label: 'Outperforming' };
  if (value >= 90) return { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-700 dark:text-amber-300', label: 'At Market' };
  return { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-700 dark:text-red-300', label: 'Underperforming' };
}

function getIndexIcon(value: number) {
  if (value > 110) return <TrendingUp className="h-4 w-4 text-emerald-600" />;
  if (value >= 90) return <Minus className="h-4 w-4 text-amber-600" />;
  return <TrendingDown className="h-4 w-4 text-red-600" />;
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-5 w-5 text-amber-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
  return null;
}

// ============================================================
// Sparkline Component (simple div bar chart)
// ============================================================

function Sparkline({ data, color = 'bg-emerald-500', height = 32 }: { data: number[]; color?: string; height?: number }) {
  if (data.length === 0) return <div className="flex items-center gap-0.5 h-8 w-full" />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  return (
    <div className="flex items-end gap-0.5 h-8 w-full">
      {data.map((val, i) => {
        const pct = ((val - min) / range) * 100;
        return (
          <div
            key={i}
            className={`flex-1 rounded-sm ${color} opacity-80`}
            style={{ height: `${Math.max(pct, 4)}%`, minHeight: '2px' }}
            title={`${val.toFixed(1)}`}
          />
        );
      })}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function CompSetManagement() {
  const [activeTab, setActiveTab] = useState('sets');

  // --- Data State ---
  const [compSets, setCompSets] = useState<CompSetSummary[]>([]);
  const [selectedCompSet, setSelectedCompSet] = useState<CompSetSummary | null>(null);
  const [members, setMembers] = useState<CompSetMember[]>([]);
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [ourRank, setOurRank] = useState<number | null>(null);
  const [historicalTrend, setHistoricalTrend] = useState<{ date: string; rank: number | null; rgi: number | null }[]>([]);

  // --- UI State ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- Dialog State ---
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isEditMemberOpen, setIsEditMemberOpen] = useState(false);

  // --- Form State ---
  const [formData, setFormData] = useState({ name: '', description: '', segment: 'primary', propertyId: '' });
  const [memberForm, setMemberForm] = useState({
    hotelName: '',
    hotelCode: '',
    starRating: '',
    totalRooms: '',
    proximityKm: '',
    channel: 'direct',
    url: '',
  });
  const [editMemberId, setEditMemberId] = useState<string | null>(null);

  // --- Date Filter ---
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // ============================================================
  // API Functions
  // ============================================================

  const fetchCompSets = useCallback(async () => {
    try {
      const res = await fetch('/api/revenue/compset');
      if (!res.ok) throw new Error('Failed to fetch competitive sets');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to fetch');
      return json.data as CompSetSummary[];
    } catch (err) {
      console.error('Error fetching compsets:', err);
      throw err;
    }
  }, []);

  const fetchMembers = useCallback(async (compSetId: string) => {
    try {
      const res = await fetch(`/api/revenue/compset/${compSetId}/members`);
      if (!res.ok) throw new Error('Failed to fetch members');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to fetch');
      return json.data as CompSetMember[];
    } catch (err) {
      console.error('Error fetching members:', err);
      throw err;
    }
  }, []);

  const fetchMetrics = useCallback(async (compSetId: string) => {
    try {
      const params = new URLSearchParams({ startDate, endDate, period: 'daily' });
      const res = await fetch(`/api/revenue/compset/${compSetId}/metrics?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch metrics');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to fetch');
      return json.data.metrics as MetricData[];
    } catch (err) {
      console.error('Error fetching metrics:', err);
      throw err;
    }
  }, [startDate, endDate]);

  const fetchRanking = useCallback(async (compSetId: string) => {
    try {
      const res = await fetch(`/api/revenue/compset/${compSetId}/ranking?days=14`);
      if (!res.ok) throw new Error('Failed to fetch ranking');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to fetch');
      return json.data;
    } catch (err) {
      console.error('Error fetching ranking:', err);
      throw err;
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sets = await fetchCompSets();
      setCompSets(sets);
    } catch {
      setError('Failed to load competitive sets');
    } finally {
      setLoading(false);
    }
  }, [fetchCompSets]);

  // ============================================================
  // Effects
  // ============================================================

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // When selected compset changes, fetch its data
  useEffect(() => {
    if (!selectedCompSet) return;

    const loadCompSetData = async () => {
      try {
        const [membersData, metricsData, rankingData] = await Promise.all([
          fetchMembers(selectedCompSet.id),
          fetchMetrics(selectedCompSet.id),
          fetchRanking(selectedCompSet.id),
        ]);
        setMembers(membersData);
        setMetrics(metricsData);
        setRankings(rankingData.currentRanking || []);
        setOurRank(rankingData.ourRank ?? null);
        setHistoricalTrend(rankingData.historicalTrend || []);
      } catch {
        toast.error('Failed to load competitive set data');
      }
    };
    void loadCompSetData();
  }, [selectedCompSet, fetchMembers, fetchMetrics, fetchRanking]);

  // ============================================================
  // Handlers
  // ============================================================

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchAll();
      if (selectedCompSet) {
        const [membersData, metricsData, rankingData] = await Promise.all([
          fetchMembers(selectedCompSet.id),
          fetchMetrics(selectedCompSet.id),
          fetchRanking(selectedCompSet.id),
        ]);
        setMembers(membersData);
        setMetrics(metricsData);
        setRankings(rankingData.currentRanking || []);
        setOurRank(rankingData.ourRank ?? null);
        setHistoricalTrend(rankingData.historicalTrend || []);
      }
      toast.success('Data refreshed');
    } catch {
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateCompSet = async () => {
    if (!formData.name.trim() || !formData.propertyId) {
      toast.error('Name and property are required');
      return;
    }
    try {
      const res = await fetch('/api/revenue/compset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          segment: formData.segment,
          propertyId: formData.propertyId,
        }),
      });
      if (!res.ok) throw new Error('Failed to create');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed');
      toast.success(`"${formData.name}" created`);
      setIsCreateOpen(false);
      setFormData({ name: '', description: '', segment: 'primary', propertyId: '' });
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    }
  };

  const handleEditCompSet = async () => {
    if (!selectedCompSet) return;
    try {
      const res = await fetch(`/api/revenue/compset/${selectedCompSet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          segment: formData.segment,
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed');
      toast.success('Competitive set updated');
      setIsEditOpen(false);
      await fetchAll();
      // Update selected
      setSelectedCompSet((prev) => prev ? { ...prev, name: formData.name, description: formData.description, segment: formData.segment } : null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDeleteCompSet = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/revenue/compset/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed');
      toast.success(`"${name}" deactivated`);
      if (selectedCompSet?.id === id) {
        setSelectedCompSet(null);
        setMembers([]);
        setMetrics([]);
        setRankings([]);
      }
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleAddMember = async () => {
    if (!selectedCompSet || !memberForm.hotelName.trim()) {
      toast.error('Hotel name is required');
      return;
    }
    try {
      const res = await fetch(`/api/revenue/compset/${selectedCompSet.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelName: memberForm.hotelName.trim(),
          hotelCode: memberForm.hotelCode.trim() || null,
          starRating: parseFloat(memberForm.starRating) || null,
          totalRooms: parseInt(memberForm.totalRooms) || null,
          proximityKm: parseFloat(memberForm.proximityKm) || null,
          channel: memberForm.channel,
          url: memberForm.url.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to add member');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed');
      toast.success(`"${memberForm.hotelName}" added`);
      setIsAddMemberOpen(false);
      setMemberForm({ hotelName: '', hotelCode: '', starRating: '', totalRooms: '', proximityKm: '', channel: 'direct', url: '' });
      const updatedMembers = await fetchMembers(selectedCompSet.id);
      setMembers(updatedMembers);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add member');
    }
  };

  const handleUpdateMember = async () => {
    if (!selectedCompSet || !editMemberId) return;
    try {
      const res = await fetch(`/api/revenue/compset/${selectedCompSet.id}/members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: editMemberId,
          hotelName: memberForm.hotelName.trim(),
          hotelCode: memberForm.hotelCode.trim() || null,
          starRating: parseFloat(memberForm.starRating) || null,
          totalRooms: parseInt(memberForm.totalRooms) || null,
          proximityKm: parseFloat(memberForm.proximityKm) || null,
          channel: memberForm.channel,
          url: memberForm.url.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed');
      toast.success('Member updated');
      setIsEditMemberOpen(false);
      setEditMemberId(null);
      const updatedMembers = await fetchMembers(selectedCompSet.id);
      setMembers(updatedMembers);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDeleteMember = async (memberId: string, name: string) => {
    if (!selectedCompSet) return;
    try {
      const res = await fetch(`/api/revenue/compset/${selectedCompSet.id}/members?memberId=${memberId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed');
      toast.success(`"${name}" removed`);
      const updatedMembers = await fetchMembers(selectedCompSet.id);
      setMembers(updatedMembers);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  const handleCalculateMetrics = async () => {
    if (!selectedCompSet) return;
    try {
      const res = await fetch(`/api/revenue/compset/${selectedCompSet.id}/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, period: 'daily', source: 'manual' }),
      });
      if (!res.ok) throw new Error('Failed to calculate');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed');
      toast.success(json.data.message);
      const metricsData = await fetchMetrics(selectedCompSet.id);
      setMetrics(metricsData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to calculate metrics');
    }
  };

  const openEditDialog = (cs: CompSetSummary) => {
    setFormData({ name: cs.name, description: cs.description || '', segment: cs.segment, propertyId: cs.propertyId });
    setIsEditOpen(true);
  };

  const openEditMemberDialog = (member: CompSetMember) => {
    setEditMemberId(member.id);
    setMemberForm({
      hotelName: member.hotelName,
      hotelCode: member.hotelCode || '',
      starRating: member.starRating?.toString() || '',
      totalRooms: member.totalRooms?.toString() || '',
      proximityKm: member.proximityKm?.toString() || '',
      channel: member.channel,
      url: member.url || '',
    });
    setIsEditMemberOpen(true);
  };

  // ============================================================
  // Computed Values
  // ============================================================

  const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const previousMetric = metrics.length > 1 ? metrics[metrics.length - 2] : null;

  // ============================================================
  // Render: Loading
  // ============================================================

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-muted rounded" />
            <div className="h-4 w-72 bg-muted rounded" />
          </div>
          <div className="h-9 w-32 bg-muted rounded" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="h-96 bg-muted rounded-lg" />
      </div>
    );
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-emerald-600" />
            Competitive Set Management
          </h2>
          <p className="text-muted-foreground">ADR Index, MPI & RGI benchmarking against your market</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Compset
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="sets" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5 hidden sm:block" />Sets
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5" disabled={!selectedCompSet}>
            <Users className="h-3.5 w-3.5 hidden sm:block" />Members
          </TabsTrigger>
          <TabsTrigger value="benchmark" className="gap-1.5" disabled={!selectedCompSet}>
            <BarChart3 className="h-3.5 w-3.5 hidden sm:block" />Benchmark
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1.5" disabled={!selectedCompSet}>
            <Trophy className="h-3.5 w-3.5 hidden sm:block" />Ranking
          </TabsTrigger>
        </TabsList>

        {/* ---- Tab: Sets ---- */}
        <TabsContent value="sets" className="mt-4 space-y-4">
          {compSets.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center">
                <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <h3 className="text-lg font-medium">No Competitive Sets</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Create your first competitive set to start benchmarking
                </p>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> Create Compset
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {compSets.map((cs) => {
                const segmentInfo = SEGMENTS.find((s) => s.value === cs.segment) || SEGMENTS[0];
                const rgiColor = cs.latestRgi ? getIndexColor(cs.latestRgi) : null;
                return (
                  <Card
                    key={cs.id}
                    className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => {
                      setSelectedCompSet(cs);
                      setActiveTab('benchmark');
                    }}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <h3 className="font-semibold text-base truncate">{cs.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">{cs.propertyName}</p>
                        </div>
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(cs);
                            }}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCompSet(cs.id, cs.name);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-4">
                        <Badge className={`text-[11px] ${segmentInfo.color}`}>{segmentInfo.label}</Badge>
                        <span className="text-xs text-muted-foreground">{cs.memberCount} members</span>
                        {cs.metricsCount > 0 && (
                          <span className="text-xs text-muted-foreground">· {cs.metricsCount} metric days</span>
                        )}
                      </div>

                      {cs.latestRgi !== null ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div className={`rounded-md p-2 text-center ${rgiColor?.bg || ''}`}>
                            <p className="text-[10px] font-medium text-muted-foreground">RGI</p>
                            <p className={`text-lg font-bold ${rgiColor?.text || ''}`}>
                              {cs.latestRgi.toFixed(0)}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <div className="rounded-md p-2 text-center bg-muted/50">
                              <p className="text-[10px] text-muted-foreground">ADR Idx</p>
                              <p className="text-sm font-bold">{cs.latestAdrIndex?.toFixed(0) || '-'}</p>
                            </div>
                            <div className="rounded-md p-2 text-center bg-muted/50">
                              <p className="text-[10px] text-muted-foreground">MPI</p>
                              <p className="text-sm font-bold">{cs.latestMpi?.toFixed(0) || '-'}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md bg-muted/50 p-3 text-center">
                          <p className="text-xs text-muted-foreground">No metrics calculated yet</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Select this set and calculate metrics</p>
                        </div>
                      )}

                      {cs.latestDate && (
                        <p className="text-[10px] text-muted-foreground mt-2 text-right">
                          Updated {format(parseISO(cs.latestDate), 'MMM dd, yyyy')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ---- Tab: Members ---- */}
        <TabsContent value="members" className="mt-4 space-y-4">
          {selectedCompSet && (
            <>
              {/* Selected Compset Info */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900">
                        <Building2 className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{selectedCompSet.name}</CardTitle>
                        <CardDescription>
                          {selectedCompSet.propertyName} · {members.length} competitors
                        </CardDescription>
                      </div>
                    </div>
                    <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsAddMemberOpen(true)}>
                      <Plus className="h-4 w-4" /> Add Member
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {/* Members Table */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-0">
                  {members.length === 0 ? (
                    <div className="py-12 text-center">
                      <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No members in this competitive set</p>
                      <p className="text-xs text-muted-foreground mt-1">Add competitors to start benchmarking</p>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>Hotel Name</TableHead>
                            <TableHead className="hidden sm:table-cell">Stars</TableHead>
                            <TableHead className="hidden md:table-cell">Rooms</TableHead>
                            <TableHead className="hidden md:table-cell">Proximity</TableHead>
                            <TableHead className="hidden sm:table-cell">Channel</TableHead>
                            <TableHead className="text-right">Latest Rate</TableHead>
                            <TableHead className="w-20 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {members.map((member, idx) => (
                            <TableRow key={member.id}>
                              <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{member.hotelName}</p>
                                  {member.hotelCode && (
                                    <p className="text-xs text-muted-foreground">{member.hotelCode}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {member.starRating ? (
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star
                                        key={s}
                                        className={`h-3 w-3 ${s <= member.starRating! ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {member.totalRooms ? (
                                  <span className="text-sm">{member.totalRooms}</span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {member.proximityKm ? (
                                  <div className="flex items-center gap-1 text-xs">
                                    <MapPin className="h-3 w-3" />
                                    {member.proximityKm.toFixed(1)} km
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <Badge variant="outline" className="text-[10px]">{member.channel}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {member.latestPrice !== null ? (
                                  <div>
                                    <span className="font-semibold text-sm">${member.latestPrice.toFixed(0)}</span>
                                    {member.latestPriceDate && (
                                      <p className="text-[10px] text-muted-foreground">
                                        {format(parseISO(member.latestPriceDate), 'MMM dd')}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => openEditMemberDialog(member)}
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                    onClick={() => handleDeleteMember(member.id, member.hotelName)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ---- Tab: Benchmark ---- */}
        <TabsContent value="benchmark" className="mt-4 space-y-4">
          {selectedCompSet && (
            <>
              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-36"
                  />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-36"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleCalculateMetrics}>
                    <BarChart3 className="h-4 w-4" />
                    Calculate Metrics
                  </Button>
                </div>
              </div>

              {/* Index Cards */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {/* ADR Index */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-muted-foreground">ADR Index</p>
                      {latestMetric && getIndexIcon(latestMetric.adrIndex)}
                    </div>
                    <p className={`text-2xl font-bold ${latestMetric ? getIndexColor(latestMetric.adrIndex).text : 'text-muted-foreground'}`}>
                      {latestMetric ? latestMetric.adrIndex.toFixed(0) : '—'}
                    </p>
                    {previousMetric && latestMetric && (
                      <div className="flex items-center gap-1 mt-1">
                        {latestMetric.adrIndex > previousMetric.adrIndex ? (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        ) : latestMetric.adrIndex < previousMetric.adrIndex ? (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        ) : null}
                        <span className={`text-xs ${
                          latestMetric.adrIndex > previousMetric.adrIndex ? 'text-emerald-500' :
                          latestMetric.adrIndex < previousMetric.adrIndex ? 'text-red-500' : 'text-muted-foreground'
                        }`}>
                          {(latestMetric.adrIndex - previousMetric.adrIndex) > 0 ? '+' : ''}{(latestMetric.adrIndex - previousMetric.adrIndex).toFixed(1)} vs prev
                        </span>
                      </div>
                    )}
                    {latestMetric && (
                      <div className="mt-3">
                        <p className="text-[10px] text-muted-foreground mb-1">Our ADR: ${latestMetric.ourAdr.toFixed(0)} vs Compset: ${latestMetric.compsetAdr.toFixed(0)}</p>
                      </div>
                    )}
                    <div className="mt-2">
                      <Sparkline data={metrics.map((m) => m.adrIndex)} color="bg-emerald-500" />
                    </div>
                  </CardContent>
                </Card>

                {/* MPI */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-muted-foreground">MPI</p>
                      {latestMetric && getIndexIcon(latestMetric.mpi)}
                    </div>
                    <p className={`text-2xl font-bold ${latestMetric ? getIndexColor(latestMetric.mpi).text : 'text-muted-foreground'}`}>
                      {latestMetric ? latestMetric.mpi.toFixed(0) : '—'}
                    </p>
                    {previousMetric && latestMetric && (
                      <div className="flex items-center gap-1 mt-1">
                        {latestMetric.mpi > previousMetric.mpi ? (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        ) : latestMetric.mpi < previousMetric.mpi ? (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        ) : null}
                        <span className={`text-xs ${
                          latestMetric.mpi > previousMetric.mpi ? 'text-emerald-500' :
                          latestMetric.mpi < previousMetric.mpi ? 'text-red-500' : 'text-muted-foreground'
                        }`}>
                          {(latestMetric.mpi - previousMetric.mpi) > 0 ? '+' : ''}{(latestMetric.mpi - previousMetric.mpi).toFixed(1)} vs prev
                        </span>
                      </div>
                    )}
                    {latestMetric && (
                      <div className="mt-3">
                        <p className="text-[10px] text-muted-foreground">Our Occ: {latestMetric.ourOccupancy.toFixed(1)}% vs Compset: {latestMetric.compsetOccupancy.toFixed(1)}%</p>
                      </div>
                    )}
                    <div className="mt-2">
                      <Sparkline data={metrics.map((m) => m.mpi)} color="bg-sky-500" />
                    </div>
                  </CardContent>
                </Card>

                {/* RGI */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-muted-foreground">RGI</p>
                      {latestMetric && getIndexIcon(latestMetric.rgi)}
                    </div>
                    <p className={`text-2xl font-bold ${latestMetric ? getIndexColor(latestMetric.rgi).text : 'text-muted-foreground'}`}>
                      {latestMetric ? latestMetric.rgi.toFixed(0) : '—'}
                    </p>
                    {previousMetric && latestMetric && (
                      <div className="flex items-center gap-1 mt-1">
                        {latestMetric.rgi > previousMetric.rgi ? (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        ) : latestMetric.rgi < previousMetric.rgi ? (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        ) : null}
                        <span className={`text-xs ${
                          latestMetric.rgi > previousMetric.rgi ? 'text-emerald-500' :
                          latestMetric.rgi < previousMetric.rgi ? 'text-red-500' : 'text-muted-foreground'
                        }`}>
                          {(latestMetric.rgi - previousMetric.rgi) > 0 ? '+' : ''}{(latestMetric.rgi - previousMetric.rgi).toFixed(1)} vs prev
                        </span>
                      </div>
                    )}
                    {latestMetric && (
                      <div className="mt-3">
                        <Badge className={`text-[10px] ${getIndexColor(latestMetric.rgi).bg} ${getIndexColor(latestMetric.rgi).text}`}>
                          {getIndexColor(latestMetric.rgi).label}
                        </Badge>
                      </div>
                    )}
                    <div className="mt-2">
                      <Sparkline data={metrics.map((m) => m.rgi)} color="bg-amber-500" />
                    </div>
                  </CardContent>
                </Card>

                {/* RevPAR Index */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-muted-foreground">RevPAR Index</p>
                      {latestMetric && getIndexIcon(latestMetric.revparIndex)}
                    </div>
                    <p className={`text-2xl font-bold ${latestMetric ? getIndexColor(latestMetric.revparIndex).text : 'text-muted-foreground'}`}>
                      {latestMetric ? latestMetric.revparIndex.toFixed(0) : '—'}
                    </p>
                    {previousMetric && latestMetric && (
                      <div className="flex items-center gap-1 mt-1">
                        {latestMetric.revparIndex > previousMetric.revparIndex ? (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        ) : latestMetric.revparIndex < previousMetric.revparIndex ? (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        ) : null}
                        <span className={`text-xs ${
                          latestMetric.revparIndex > previousMetric.revparIndex ? 'text-emerald-500' :
                          latestMetric.revparIndex < previousMetric.revparIndex ? 'text-red-500' : 'text-muted-foreground'
                        }`}>
                          {(latestMetric.revparIndex - previousMetric.revparIndex) > 0 ? '+' : ''}{(latestMetric.revparIndex - previousMetric.revparIndex).toFixed(1)} vs prev
                        </span>
                      </div>
                    )}
                    {latestMetric && (
                      <div className="mt-3">
                        <p className="text-[10px] text-muted-foreground">Our RevPAR: ${latestMetric.ourRevpar.toFixed(0)} vs Compset: ${latestMetric.compsetRevpar.toFixed(0)}</p>
                      </div>
                    )}
                    <div className="mt-2">
                      <Sparkline data={metrics.map((m) => m.revparIndex)} color="bg-violet-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Metrics Table */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Daily Metrics Detail</CardTitle>
                    <Badge variant="outline" className="text-xs">{metrics.length} days</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {metrics.length === 0 ? (
                    <div className="py-12 text-center">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No metrics data available</p>
                      <p className="text-xs text-muted-foreground mt-1">Click &quot;Calculate Metrics&quot; to generate from booking data</p>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-background z-10">Date</TableHead>
                            <TableHead className="text-right">Our ADR</TableHead>
                            <TableHead className="text-right hidden sm:table-cell">Our Occ</TableHead>
                            <TableHead className="text-right">ADR Idx</TableHead>
                            <TableHead className="text-right hidden sm:table-cell">MPI</TableHead>
                            <TableHead className="text-right hidden md:table-cell">RGI</TableHead>
                            <TableHead className="text-right hidden md:table-cell">RevPAR Idx</TableHead>
                            <TableHead className="text-right hidden lg:table-cell">Rank</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...metrics].reverse().map((m) => {
                            const idxColor = getIndexColor(m.adrIndex);
                            const rgiColor = getIndexColor(m.rgi);
                            return (
                              <TableRow key={m.id}>
                                <TableCell className="sticky left-0 bg-background z-10 font-medium text-xs">
                                  {format(parseISO(m.date), 'MMM dd')}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium">
                                  ${m.ourAdr.toFixed(0)}
                                </TableCell>
                                <TableCell className="text-right text-sm hidden sm:table-cell">
                                  {m.ourOccupancy.toFixed(1)}%
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge className={`text-[11px] ${idxColor.bg} ${idxColor.text}`}>
                                    {m.adrIndex.toFixed(0)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right hidden sm:table-cell">
                                  <Badge className={`text-[11px] ${getIndexColor(m.mpi).bg} ${getIndexColor(m.mpi).text}`}>
                                    {m.mpi.toFixed(0)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right hidden md:table-cell">
                                  <Badge className={`text-[11px] ${rgiColor.bg} ${rgiColor.text}`}>
                                    {m.rgi.toFixed(0)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right hidden md:table-cell">
                                  <Badge className={`text-[11px] ${getIndexColor(m.revparIndex).bg} ${getIndexColor(m.revparIndex).text}`}>
                                    {m.revparIndex.toFixed(0)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right hidden lg:table-cell">
                                  {m.ourRank ? (
                                    <span className="font-semibold">{m.ourRank}/{m.compsetSize}</span>
                                  ) : '—'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ---- Tab: Ranking ---- */}
        <TabsContent value="ranking" className="mt-4 space-y-4">
          {selectedCompSet && (
            <>
              {/* Rank Summary */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                        <Trophy className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Competitive Position</CardTitle>
                        <CardDescription>
                          {selectedCompSet.name} · {rankings.length} hotels in set
                        </CardDescription>
                      </div>
                    </div>
                    {ourRank !== null && (
                      <div className="text-center">
                        <p className="text-3xl font-bold text-foreground">
                          #{ourRank}
                        </p>
                        <p className="text-xs text-muted-foreground">of {rankings.length}</p>
                      </div>
                    )}
                  </div>
                </CardHeader>
              </Card>

              {/* Historical Rank Trend */}
              {historicalTrend.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium mb-3">Rank Trend (Last 14 Days)</p>
                    <div className="flex items-end gap-1 h-16">
                      {historicalTrend.map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 flex flex-col items-center gap-1"
                        >
                          {h.rank !== null && (
                            <span className="text-[10px] text-muted-foreground">{h.rank}</span>
                          )}
                          <div
                            className={`w-full rounded-sm ${
                              h.rank === 1 ? 'bg-amber-400' :
                              h.rank === 2 ? 'bg-gray-400' :
                              h.rank === 3 ? 'bg-amber-700' :
                              h.isOurProperty ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                            }`}
                            style={{
                              height: h.rank ? `${Math.max(((rankings.length - h.rank) / rankings.length) * 100, 8)}%` : '0%',
                              minHeight: '4px',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-muted-foreground">
                        {historicalTrend[0]?.date ? format(parseISO(historicalTrend[0].date), 'MMM dd') : ''}
                      </span>
                      <span className="text-[9px] text-muted-foreground">Today</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Ranking Table */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-0">
                  {rankings.length === 0 ? (
                    <div className="py-12 text-center">
                      <Trophy className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No ranking data available</p>
                      <p className="text-xs text-muted-foreground mt-1">Calculate metrics first to see rankings</p>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Rank</TableHead>
                            <TableHead>Hotel</TableHead>
                            <TableHead className="hidden sm:table-cell">Stars</TableHead>
                            <TableHead className="text-right">ADR</TableHead>
                            <TableHead className="text-right hidden sm:table-cell">Occupancy</TableHead>
                            <TableHead className="text-right">RevPAR</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rankings.map((entry, idx) => (
                            <TableRow
                              key={entry.name}
                              className={entry.isOurProperty ? 'bg-emerald-50/50 dark:bg-emerald-950/30' : ''}
                            >
                              <TableCell>
                                <div className="flex items-center justify-center">
                                  {getRankIcon(idx + 1) || (
                                    <span className="text-sm font-medium text-muted-foreground">{idx + 1}</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {entry.isOurProperty && (
                                    <Badge className="text-[10px] bg-emerald-600 text-white">You</Badge>
                                  )}
                                  <span className="font-medium text-sm">{entry.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {entry.starRating ? (
                                  <div className="flex items-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star
                                        key={s}
                                        className={`h-3 w-3 ${s <= entry.starRating! ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium text-sm">
                                ${entry.adr.toFixed(0)}
                              </TableCell>
                              <TableCell className="text-right text-sm hidden sm:table-cell">
                                {entry.occupancy.toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={`font-bold text-sm ${entry.isOurProperty ? 'text-emerald-600' : ''}`}>
                                  ${entry.revpar.toFixed(0)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ---- Dialog: Create Compset ---- */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Competitive Set</DialogTitle>
            <DialogDescription>Group competitor hotels for benchmarking analysis</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cs-name">Name *</Label>
              <Input
                id="cs-name"
                placeholder="e.g., Downtown Primary Set"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs-desc">Description</Label>
              <Input
                id="cs-desc"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs-segment">Segment</Label>
              <Select value={formData.segment} onValueChange={(v) => setFormData((f) => ({ ...f, segment: v }))}>
                <SelectTrigger id="cs-segment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs-property">Property *</Label>
              <Select value={formData.propertyId} onValueChange={(v) => setFormData((f) => ({ ...f, propertyId: v }))}>
                <SelectTrigger id="cs-property">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set(compSets.map((c) => JSON.stringify({ id: c.propertyId, name: c.propertyName })))]
                    .map((json) => JSON.parse(json))
                    .map((p: { id: string; name: string }) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateCompSet}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Dialog: Edit Compset ---- */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Competitive Set</DialogTitle>
            <DialogDescription>Update competitive set details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-cs-name">Name</Label>
              <Input
                id="edit-cs-name"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cs-desc">Description</Label>
              <Input
                id="edit-cs-desc"
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Segment</Label>
              <Select value={formData.segment} onValueChange={(v) => setFormData((f) => ({ ...f, segment: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleEditCompSet}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Dialog: Add Member ---- */}
      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Competitor</DialogTitle>
            <DialogDescription>Add a hotel to the competitive set</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="mem-name">Hotel Name *</Label>
                <Input
                  id="mem-name"
                  placeholder="e.g., Hilton Downtown"
                  value={memberForm.hotelName}
                  onChange={(e) => setMemberForm((f) => ({ ...f, hotelName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mem-code">Chain Code</Label>
                <Input
                  id="mem-code"
                  placeholder="e.g., HILTON"
                  value={memberForm.hotelCode}
                  onChange={(e) => setMemberForm((f) => ({ ...f, hotelCode: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mem-channel">Channel</Label>
                <Select value={memberForm.channel} onValueChange={(v) => setMemberForm((f) => ({ ...f, channel: v }))}>
                  <SelectTrigger id="mem-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="booking.com">Booking.com</SelectItem>
                    <SelectItem value="expedia">Expedia</SelectItem>
                    <SelectItem value="airbnb">Airbnb</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mem-stars">Star Rating</Label>
                <Input
                  id="mem-stars"
                  type="number"
                  min="1"
                  max="5"
                  step="0.5"
                  placeholder="1-5"
                  value={memberForm.starRating}
                  onChange={(e) => setMemberForm((f) => ({ ...f, starRating: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mem-rooms">Total Rooms</Label>
                <Input
                  id="mem-rooms"
                  type="number"
                  placeholder="e.g., 250"
                  value={memberForm.totalRooms}
                  onChange={(e) => setMemberForm((f) => ({ ...f, totalRooms: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mem-proximity">Proximity (km)</Label>
                <Input
                  id="mem-proximity"
                  type="number"
                  step="0.1"
                  placeholder="e.g., 0.5"
                  value={memberForm.proximityKm}
                  onChange={(e) => setMemberForm((f) => ({ ...f, proximityKm: e.target.value }))}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="mem-url">URL</Label>
                <Input
                  id="mem-url"
                  placeholder="https://..."
                  value={memberForm.url}
                  onChange={(e) => setMemberForm((f) => ({ ...f, url: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddMemberOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleAddMember}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Dialog: Edit Member ---- */}
      <Dialog open={isEditMemberOpen} onOpenChange={setIsEditMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Competitor</DialogTitle>
            <DialogDescription>Update competitor details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-mem-name">Hotel Name *</Label>
                <Input
                  id="edit-mem-name"
                  value={memberForm.hotelName}
                  onChange={(e) => setMemberForm((f) => ({ ...f, hotelName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-mem-code">Chain Code</Label>
                <Input
                  id="edit-mem-code"
                  value={memberForm.hotelCode}
                  onChange={(e) => setMemberForm((f) => ({ ...f, hotelCode: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select value={memberForm.channel} onValueChange={(v) => setMemberForm((f) => ({ ...f, channel: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="booking.com">Booking.com</SelectItem>
                    <SelectItem value="expedia">Expedia</SelectItem>
                    <SelectItem value="airbnb">Airbnb</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-mem-stars">Star Rating</Label>
                <Input
                  id="edit-mem-stars"
                  type="number"
                  min="1"
                  max="5"
                  step="0.5"
                  value={memberForm.starRating}
                  onChange={(e) => setMemberForm((f) => ({ ...f, starRating: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-mem-rooms">Total Rooms</Label>
                <Input
                  id="edit-mem-rooms"
                  type="number"
                  value={memberForm.totalRooms}
                  onChange={(e) => setMemberForm((f) => ({ ...f, totalRooms: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-mem-proximity">Proximity (km)</Label>
                <Input
                  id="edit-mem-proximity"
                  type="number"
                  step="0.1"
                  value={memberForm.proximityKm}
                  onChange={(e) => setMemberForm((f) => ({ ...f, proximityKm: e.target.value }))}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-mem-url">URL</Label>
                <Input
                  id="edit-mem-url"
                  value={memberForm.url}
                  onChange={(e) => setMemberForm((f) => ({ ...f, url: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditMemberOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleUpdateMember}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
