'use client';

/**
 * WiFi Portal Ad Campaigns — F2
 *
 * Manage monetized WiFi portal ad campaigns: creation, tracking,
 * analytics, and performance monitoring.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Megaphone,
  Plus,
  Edit,
  Trash2,
  Eye,
  MousePointerClick,
  DollarSign,
  BarChart3,
  TrendingUp,
  Search,
  Loader2,
  Play,
  Pause,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AdCampaign {
  id: string;
  name: string;
  advertiser: string;
  creativeUrl: string;
  creativeType: string;
  linkUrl: string | null;
  slot: string;
  priority: number;
  impressions: number;
  clicks: number;
  revenue: number;
  status: string;
  startDate: string;
  endDate: string;
  maxBudget: number | null;
  spentBudget: number;
  targeting: string;
  createdAt: string;
  updatedAt: string;
}

interface CampaignStats {
  overview: {
    totalCampaigns: number;
    activeCampaigns: number;
    totalImpressions: number;
    totalClicks: number;
    ctr: number;
    totalRevenue: number;
    totalSpentBudget: number;
    totalBudget: number;
  };
  slotBreakdown: Record<string, { impressions: number; clicks: number; revenue: number; count: number }>;
  topAdvertisers: { advertiser: string; impressions: number; clicks: number; revenue: number; campaigns: number }[];
  dailyTrend: { date: string; impressions: number; clicks: number; revenue: number }[];
}

interface CampaignFormData {
  name: string;
  advertiser: string;
  creativeType: string;
  creativeUrl: string;
  linkUrl: string;
  slot: string;
  priority: number;
  startDate: string;
  endDate: string;
  maxBudget: string;
  targeting: string;
}

const emptyForm: CampaignFormData = {
  name: '',
  advertiser: '',
  creativeType: 'image',
  creativeUrl: '',
  linkUrl: '',
  slot: 'banner',
  priority: 0,
  startDate: '',
  endDate: '',
  maxBudget: '',
  targeting: '{}',
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs gap-1"><Play className="h-3 w-3" />Active</Badge>;
    case 'draft':
      return <Badge className="bg-gray-400 hover:bg-gray-500 text-white border-0 text-xs gap-1">Draft</Badge>;
    case 'paused':
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs gap-1"><Pause className="h-3 w-3" />Paused</Badge>;
    case 'completed':
      return <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-0 text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Completed</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

function getSlotBadge(slot: string) {
  const colors: Record<string, string> = {
    banner: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300',
    interstitial: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
    footer: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300',
    sidebar: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  };
  return (
    <Badge variant="outline" className={`text-xs border-0 ${colors[slot] || ''}`}>
      {slot}
    </Badge>
  );
}

function getCreativeTypeBadge(type: string) {
  switch (type) {
    case 'image':
      return <Badge variant="secondary" className="text-xs">Image</Badge>;
    case 'video':
      return <Badge variant="secondary" className="text-xs">Video</Badge>;
    case 'html':
      return <Badge variant="secondary" className="text-xs">HTML</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{type}</Badge>;
  }
}

function formatCurrency(value: number) {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function WifiAdCampaigns() {
  const { toast } = useToast();

  // Data state
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [slotFilter, setSlotFilter] = useState<string>('all');

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<AdCampaign | null>(null);
  const [formData, setFormData] = useState<CampaignFormData>(emptyForm);

  // Loading states
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [fetchKey, setFetchKey] = useState(0);

  // ─── Fetch Campaigns ──────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (slotFilter !== 'all') params.set('slot', slotFilter);
        if (searchQuery) params.set('search', searchQuery);
        params.set('limit', '100');

        const res = await fetch(`/api/wifi/ad-campaigns?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();

        if (cancelled) return;
        if (data.success && data.data?.campaigns) {
          setCampaigns(data.data.campaigns);
        } else {
          setCampaigns([]);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to fetch campaigns:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [statusFilter, slotFilter, searchQuery, fetchKey]);

  // ─── Fetch Stats ──────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setStatsLoading(true);
      try {
        const res = await fetch('/api/wifi/ad-campaigns/stats', { signal: controller.signal });
        const data = await res.json();

        if (cancelled) return;
        if (data.success && data.data) {
          setStats(data.data);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to fetch stats:', error);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [fetchKey]);

  // ─── Refresh ──────────────────────────────────────────────────────────────────

  const refreshData = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  // ─── Form Helpers ─────────────────────────────────────────────────────────────

  const handleFormChange = (field: keyof CampaignFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'Campaign name is required';
    if (!formData.advertiser.trim()) return 'Advertiser is required';
    if (!formData.creativeUrl.trim()) return 'Creative URL is required';
    if (!formData.startDate) return 'Start date is required';
    if (!formData.endDate) return 'End date is required';
    if (new Date(formData.startDate) >= new Date(formData.endDate)) return 'Start date must be before end date';
    if (formData.maxBudget && parseFloat(formData.maxBudget) < 0) return 'Max budget cannot be negative';
    if (formData.targeting.trim()) {
      try {
        JSON.parse(formData.targeting);
      } catch {
        return 'Targeting must be valid JSON';
      }
    }
    return null;
  };

  // ─── Create Campaign ──────────────────────────────────────────────────────────

  const handleCreate = async () => {
    const error = validateForm();
    if (error) {
      toast({ title: 'Validation Error', description: error, variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/wifi/ad-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          advertiser: formData.advertiser,
          creativeType: formData.creativeType,
          creativeUrl: formData.creativeUrl,
          linkUrl: formData.linkUrl || null,
          slot: formData.slot,
          priority: parseInt(String(formData.priority)) || 0,
          status: 'active',
          startDate: new Date(formData.startDate).toISOString(),
          endDate: new Date(formData.endDate).toISOString(),
          maxBudget: formData.maxBudget ? parseFloat(formData.maxBudget) : null,
          targeting: formData.targeting.trim() || '{}',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Campaign Created', description: `"${formData.name}" has been created.` });
        setCreateDialogOpen(false);
        setFormData(emptyForm);
        refreshData();
      } else {
        toast({ title: 'Create Failed', description: data.error?.message || 'Failed to create campaign', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create campaign', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Edit Campaign ────────────────────────────────────────────────────────────

  const openEdit = (campaign: AdCampaign) => {
    setSelectedCampaign(campaign);
    setFormData({
      name: campaign.name,
      advertiser: campaign.advertiser,
      creativeType: campaign.creativeType,
      creativeUrl: campaign.creativeUrl,
      linkUrl: campaign.linkUrl || '',
      slot: campaign.slot,
      priority: campaign.priority,
      startDate: format(new Date(campaign.startDate), 'yyyy-MM-dd'),
      endDate: format(new Date(campaign.endDate), 'yyyy-MM-dd'),
      maxBudget: campaign.maxBudget?.toString() || '',
      targeting: campaign.targeting || '{}',
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedCampaign) return;
    const error = validateForm();
    if (error) {
      toast({ title: 'Validation Error', description: error, variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/wifi/ad-campaigns/${selectedCampaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          advertiser: formData.advertiser,
          creativeType: formData.creativeType,
          creativeUrl: formData.creativeUrl,
          linkUrl: formData.linkUrl || null,
          slot: formData.slot,
          priority: parseInt(String(formData.priority)) || 0,
          startDate: new Date(formData.startDate).toISOString(),
          endDate: new Date(formData.endDate).toISOString(),
          maxBudget: formData.maxBudget ? parseFloat(formData.maxBudget) : null,
          targeting: formData.targeting.trim() || '{}',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Campaign Updated', description: `"${formData.name}" has been updated.` });
        setEditDialogOpen(false);
        setSelectedCampaign(null);
        setFormData(emptyForm);
        refreshData();
      } else {
        toast({ title: 'Update Failed', description: data.error?.message || 'Failed to update campaign', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update campaign', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete Campaign ──────────────────────────────────────────────────────────

  const openDelete = (campaign: AdCampaign) => {
    setSelectedCampaign(campaign);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedCampaign) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/wifi/ad-campaigns/${selectedCampaign.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Campaign Deleted', description: `"${selectedCampaign.name}" has been deleted.` });
        setDeleteDialogOpen(false);
        setSelectedCampaign(null);
        refreshData();
      } else {
        toast({ title: 'Delete Failed', description: data.error?.message || 'Failed to delete campaign', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete campaign', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  // ─── Toggle Status ────────────────────────────────────────────────────────────

  const handleToggleStatus = async (campaign: AdCampaign) => {
    let newStatus: string;
    switch (campaign.status) {
      case 'draft': newStatus = 'active'; break;
      case 'active': newStatus = 'paused'; break;
      case 'paused': newStatus = 'active'; break;
      case 'completed': return;
      default: return;
    }

    try {
      setTogglingId(campaign.id);
      const res = await fetch(`/api/wifi/ad-campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Status Changed', description: `"${campaign.name}" is now ${newStatus}.` });
        refreshData();
      } else {
        toast({ title: 'Status Change Failed', description: data.error?.message || 'Failed to change status', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to change status', variant: 'destructive' });
    } finally {
      setTogglingId(null);
    }
  };

  // ─── View Campaign ────────────────────────────────────────────────────────────

  const openView = (campaign: AdCampaign) => {
    setSelectedCampaign(campaign);
    setViewDialogOpen(true);
  };

  // ─── Computed ─────────────────────────────────────────────────────────────────

  const filteredCampaigns = campaigns.filter((c) => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && !c.advertiser.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const maxDailyImpressions = stats?.dailyTrend ? Math.max(...stats.dailyTrend.map((d) => d.impressions), 1) : 1;
  const maxDailyRevenue = stats?.dailyTrend ? Math.max(...stats.dailyTrend.map((d) => d.revenue), 1) : 1;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Ad Campaigns
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            WiFi portal ad monetization and campaign management
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => { setFormData(emptyForm); setCreateDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2.5">
              <Megaphone className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats?.overview.activeCampaigns ?? 0}</p>
              <p className="text-xs text-muted-foreground">Active Campaigns</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/5 dark:bg-primary/10 p-2.5">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats?.overview.totalImpressions?.toLocaleString() ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Impressions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2.5">
              <MousePointerClick className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats?.overview.totalClicks?.toLocaleString() ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Clicks</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 p-2.5">
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats?.overview.ctr ?? 0}%</p>
              <p className="text-xs text-muted-foreground">CTR</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-1.5">
            <Megaphone className="h-4 w-4" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* ─── Campaigns Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="campaigns" className="space-y-4">
          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or advertiser..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={slotFilter} onValueChange={setSlotFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Slot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Slots</SelectItem>
                    <SelectItem value="banner">Banner</SelectItem>
                    <SelectItem value="interstitial">Interstitial</SelectItem>
                    <SelectItem value="footer">Footer</SelectItem>
                    <SelectItem value="sidebar">Sidebar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Campaigns Table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-muted/50 p-4 mb-3">
                    <Megaphone className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground">No campaigns found</h3>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Create your first ad campaign to get started
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden md:table-cell">Advertiser</TableHead>
                        <TableHead>Slot</TableHead>
                        <TableHead className="hidden lg:table-cell">Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell text-right">Impr.</TableHead>
                        <TableHead className="hidden lg:table-cell text-right">Clicks</TableHead>
                        <TableHead className="hidden md:table-cell text-right">CTR</TableHead>
                        <TableHead className="hidden xl:table-cell min-w-[120px]">Budget</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCampaigns.map((campaign) => {
                        const budgetPct = campaign.maxBudget ? Math.min((campaign.spentBudget / campaign.maxBudget) * 100, 100) : 0;
                        const ctr = campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(1) : '0.0';

                        return (
                          <TableRow key={campaign.id} className="hover:bg-muted/50">
                            <TableCell>
                              <p className="text-sm font-medium max-w-[180px] truncate">{campaign.name}</p>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-sm text-muted-foreground">{campaign.advertiser}</span>
                            </TableCell>
                            <TableCell>{getSlotBadge(campaign.slot)}</TableCell>
                            <TableCell className="hidden lg:table-cell">{getCreativeTypeBadge(campaign.creativeType)}</TableCell>
                            <TableCell>
                              <button
                                onClick={() => handleToggleStatus(campaign)}
                                disabled={togglingId === campaign.id || campaign.status === 'completed'}
                                className="cursor-pointer disabled:cursor-not-allowed"
                              >
                                {togglingId === campaign.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  getStatusBadge(campaign.status)
                                )}
                              </button>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-right">
                              <span className="text-sm tabular-nums">{campaign.impressions.toLocaleString()}</span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-right">
                              <span className="text-sm tabular-nums">{campaign.clicks.toLocaleString()}</span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-right">
                              <span className="text-sm tabular-nums">{ctr}%</span>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell">
                              {campaign.maxBudget ? (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span>{formatCurrency(campaign.spentBudget)}</span>
                                    <span>{formatCurrency(campaign.maxBudget)}</span>
                                  </div>
                                  <Progress value={budgetPct} className="h-1.5" />
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">No limit</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-0.5">
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openView(campaign)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(campaign)}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openDelete(campaign)}>
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              </div>
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
        </TabsContent>

        {/* ─── Analytics Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="analytics" className="space-y-4">
          {statsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : stats ? (
            <>
              {/* Performance Overview */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs text-muted-foreground">Total Revenue</span>
                    </div>
                    <p className="text-xl font-bold tabular-nums">{formatCurrency(stats.overview.totalRevenue)}</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs text-muted-foreground">Budget Utilized</span>
                    </div>
                    <p className="text-xl font-bold tabular-nums">
                      {stats.overview.totalBudget > 0
                        ? `${Math.round((stats.overview.totalSpentBudget / stats.overview.totalBudget) * 100)}%`
                        : 'N/A'}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MousePointerClick className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs text-muted-foreground">Avg CTR</span>
                    </div>
                    <p className="text-xl font-bold tabular-nums">{stats.overview.ctr}%</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Megaphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs text-muted-foreground">Total Campaigns</span>
                    </div>
                    <p className="text-xl font-bold tabular-nums">{stats.overview.totalCampaigns}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Impressions Over Time */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4 text-primary" />
                      Impressions Over Time
                    </CardTitle>
                    <CardDescription>Last 30 days daily impressions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stats.dailyTrend.length > 0 ? (
                      <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                        {stats.dailyTrend.map((day, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <span className="text-[11px] text-muted-foreground w-[72px] shrink-0 tabular-nums">
                              {day.date.slice(5)}
                            </span>
                            <div className="flex-1">
                              <Progress value={(day.impressions / maxDailyImpressions) * 100} className="h-2.5" />
                            </div>
                            <span className="text-[11px] font-medium tabular-nums w-[52px] text-right shrink-0">
                              {day.impressions.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No trend data available</p>
                    )}
                  </CardContent>
                </Card>

                {/* Clicks by Slot */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MousePointerClick className="h-4 w-4 text-amber-600" />
                      Performance by Slot
                    </CardTitle>
                    <CardDescription>Impressions, clicks, and revenue per ad slot</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(stats.slotBreakdown).length > 0 ? (
                      <div className="space-y-4">
                        {Object.entries(stats.slotBreakdown)
                          .sort(([, a], [, b]) => b.revenue - a.revenue)
                          .map(([slot, data]) => {
                            const slotMaxImpressions = Math.max(...Object.values(stats.slotBreakdown).map((s) => s.impressions), 1);
                            return (
                              <div key={slot} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  {getSlotBadge(slot)}
                                  <span className="text-xs font-semibold tabular-nums">{formatCurrency(data.revenue)}</span>
                                </div>
                                <Progress value={(data.impressions / slotMaxImpressions) * 100} className="h-2" />
                                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                                  <span>{data.impressions.toLocaleString()} impressions</span>
                                  <span>{data.clicks.toLocaleString()} clicks</span>
                                  <span>{data.count} campaigns</span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No slot data available</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Top Advertisers */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    Top Advertisers by Revenue
                  </CardTitle>
                  <CardDescription>Performance breakdown by advertiser</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.topAdvertisers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Advertiser</TableHead>
                            <TableHead className="text-right">Campaigns</TableHead>
                            <TableHead className="text-right">Impressions</TableHead>
                            <TableHead className="text-right">Clicks</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stats.topAdvertisers.map((adv, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{adv.advertiser}</TableCell>
                              <TableCell className="text-right tabular-nums">{adv.campaigns}</TableCell>
                              <TableCell className="text-right tabular-nums">{adv.impressions.toLocaleString()}</TableCell>
                              <TableCell className="text-right tabular-nums">{adv.clicks.toLocaleString()}</TableCell>
                              <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(adv.revenue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No advertiser data available</p>
                  )}
                </CardContent>
              </Card>

              {/* Revenue Over Time */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-purple-600" />
                    Daily Revenue Trend
                  </CardTitle>
                  <CardDescription>Last 30 days daily revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.dailyTrend.length > 0 ? (
                    <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                      {stats.dailyTrend.map((day, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <span className="text-[11px] text-muted-foreground w-[72px] shrink-0 tabular-nums">
                            {day.date.slice(5)}
                          </span>
                          <div className="flex-1">
                            <Progress value={(day.revenue / maxDailyRevenue) * 100} className="h-2.5" />
                          </div>
                          <span className="text-[11px] font-medium tabular-nums w-[60px] text-right shrink-0">
                            {formatCurrency(day.revenue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No revenue trend data available</p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-16">
              <p className="text-sm text-muted-foreground">Unable to load analytics data</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Create Campaign Dialog ───────────────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Ad Campaign
            </DialogTitle>
            <DialogDescription>Add a new ad campaign for the WiFi portal</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-name">Campaign Name *</Label>
                <Input id="create-name" value={formData.name} onChange={(e) => handleFormChange('name', e.target.value)} placeholder="e.g., Summer Hotel Promo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-advertiser">Advertiser *</Label>
                <Input id="create-advertiser" value={formData.advertiser} onChange={(e) => handleFormChange('advertiser', e.target.value)} placeholder="e.g., Local Restaurant" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-type">Creative Type</Label>
                <Select value={formData.creativeType} onValueChange={(v) => handleFormChange('creativeType', v)}>
                  <SelectTrigger id="create-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-slot">Ad Slot</Label>
                <Select value={formData.slot} onValueChange={(v) => handleFormChange('slot', v)}>
                  <SelectTrigger id="create-slot"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banner">Banner</SelectItem>
                    <SelectItem value="interstitial">Interstitial</SelectItem>
                    <SelectItem value="footer">Footer</SelectItem>
                    <SelectItem value="sidebar">Sidebar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-creativeUrl">Creative URL *</Label>
              <Input id="create-creativeUrl" value={formData.creativeUrl} onChange={(e) => handleFormChange('creativeUrl', e.target.value)} placeholder="https://example.com/ad-image.jpg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-linkUrl">Link URL</Label>
              <Input id="create-linkUrl" value={formData.linkUrl} onChange={(e) => handleFormChange('linkUrl', e.target.value)} placeholder="https://example.com/landing-page" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-startDate">Start Date *</Label>
                <Input id="create-startDate" type="date" value={formData.startDate} onChange={(e) => handleFormChange('startDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-endDate">End Date *</Label>
                <Input id="create-endDate" type="date" value={formData.endDate} onChange={(e) => handleFormChange('endDate', e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-priority">Priority</Label>
                <Input id="create-priority" type="number" min={0} value={formData.priority} onChange={(e) => handleFormChange('priority', parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-maxBudget">Max Budget (₹)</Label>
                <Input id="create-maxBudget" type="number" min={0} step={0.01} value={formData.maxBudget} onChange={(e) => handleFormChange('maxBudget', e.target.value)} placeholder="Leave empty for no limit" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-targeting">Targeting (JSON)</Label>
              <Textarea id="create-targeting" value={formData.targeting} onChange={(e) => handleFormChange('targeting', e.target.value)} placeholder='{"guestType": "all", "roomType": "deluxe"}' rows={3} className="font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Campaign Dialog ─────────────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Edit Campaign
            </DialogTitle>
            <DialogDescription>Update campaign details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Campaign Name *</Label>
                <Input id="edit-name" value={formData.name} onChange={(e) => handleFormChange('name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-advertiser">Advertiser *</Label>
                <Input id="edit-advertiser" value={formData.advertiser} onChange={(e) => handleFormChange('advertiser', e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-type">Creative Type</Label>
                <Select value={formData.creativeType} onValueChange={(v) => handleFormChange('creativeType', v)}>
                  <SelectTrigger id="edit-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-slot">Ad Slot</Label>
                <Select value={formData.slot} onValueChange={(v) => handleFormChange('slot', v)}>
                  <SelectTrigger id="edit-slot"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banner">Banner</SelectItem>
                    <SelectItem value="interstitial">Interstitial</SelectItem>
                    <SelectItem value="footer">Footer</SelectItem>
                    <SelectItem value="sidebar">Sidebar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-creativeUrl">Creative URL *</Label>
              <Input id="edit-creativeUrl" value={formData.creativeUrl} onChange={(e) => handleFormChange('creativeUrl', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-linkUrl">Link URL</Label>
              <Input id="edit-linkUrl" value={formData.linkUrl} onChange={(e) => handleFormChange('linkUrl', e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-startDate">Start Date *</Label>
                <Input id="edit-startDate" type="date" value={formData.startDate} onChange={(e) => handleFormChange('startDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-endDate">End Date *</Label>
                <Input id="edit-endDate" type="date" value={formData.endDate} onChange={(e) => handleFormChange('endDate', e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <Input id="edit-priority" type="number" min={0} value={formData.priority} onChange={(e) => handleFormChange('priority', parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-maxBudget">Max Budget (₹)</Label>
                <Input id="edit-maxBudget" type="number" min={0} step={0.01} value={formData.maxBudget} onChange={(e) => handleFormChange('maxBudget', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-targeting">Targeting (JSON)</Label>
              <Textarea id="edit-targeting" value={formData.targeting} onChange={(e) => handleFormChange('targeting', e.target.value)} rows={3} className="font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Dialog ─────────────────────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              Delete Campaign
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">&quot;{selectedCampaign?.name}&quot;</span>?
              This action cannot be undone and will remove all associated tracking data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── View Details Dialog ──────────────────────────────────────────────── */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Campaign Details
            </DialogTitle>
            <DialogDescription>Full campaign details and metrics</DialogDescription>
          </DialogHeader>
          {selectedCampaign && (
            <div className="grid gap-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Name</span>
                  <span className="font-medium">{selectedCampaign.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Advertiser</span>
                  <span>{selectedCampaign.advertiser}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Status</span>
                  {getStatusBadge(selectedCampaign.status)}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Slot</span>
                  {getSlotBadge(selectedCampaign.slot)}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Creative Type</span>
                  {getCreativeTypeBadge(selectedCampaign.creativeType)}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Priority</span>
                  <span>{selectedCampaign.priority}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-xs mb-1">Creative URL</span>
                  <span className="font-mono text-xs break-all">{selectedCampaign.creativeUrl}</span>
                </div>
                {selectedCampaign.linkUrl && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground block text-xs mb-1">Link URL</span>
                    <span className="font-mono text-xs break-all">{selectedCampaign.linkUrl}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <span className="text-muted-foreground block text-xs mb-2">Performance</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-lg font-bold tabular-nums">{selectedCampaign.impressions.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">Impressions</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-lg font-bold tabular-nums">{selectedCampaign.clicks.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">Clicks</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-lg font-bold tabular-nums">
                      {selectedCampaign.impressions > 0
                        ? ((selectedCampaign.clicks / selectedCampaign.impressions) * 100).toFixed(2)
                        : '0.00'}%
                    </p>
                    <p className="text-[11px] text-muted-foreground">CTR</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-lg font-bold tabular-nums">{formatCurrency(selectedCampaign.revenue)}</p>
                    <p className="text-[11px] text-muted-foreground">Revenue</p>
                  </div>
                </div>
              </div>

              {selectedCampaign.maxBudget && (
                <div className="space-y-2">
                  <span className="text-muted-foreground block text-xs mb-1">Budget Usage</span>
                  <div className="flex items-center justify-between text-xs">
                    <span>{formatCurrency(selectedCampaign.spentBudget)} spent</span>
                    <span>{formatCurrency(selectedCampaign.maxBudget)} budget</span>
                  </div>
                  <Progress value={Math.min((selectedCampaign.spentBudget / selectedCampaign.maxBudget) * 100, 100)} className="h-2" />
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Start Date</span>
                  <span>{format(new Date(selectedCampaign.startDate), 'PPP')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">End Date</span>
                  <span>{format(new Date(selectedCampaign.endDate), 'PPP')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Created</span>
                  <span>{formatDistanceToNow(new Date(selectedCampaign.createdAt), { addSuffix: true })}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Updated</span>
                  <span>{formatDistanceToNow(new Date(selectedCampaign.updatedAt), { addSuffix: true })}</span>
                </div>
              </div>

              {selectedCampaign.targeting && selectedCampaign.targeting !== '{}' && (
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Targeting</span>
                  <pre className="text-xs font-mono bg-muted/50 rounded-lg p-3 overflow-x-auto">{selectedCampaign.targeting}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
