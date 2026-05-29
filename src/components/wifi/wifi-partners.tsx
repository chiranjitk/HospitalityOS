'use client';

/**
 * WiFi Partner Management — F3
 *
 * Partner WiFi / Sponsored Access management with promo code flow.
 * KPI cards, partner CRUD, auth session logs, analytics charts.
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
  Handshake,
  Plus,
  Edit,
  Trash2,
  Users,
  DollarSign,
  BarChart3,
  ShieldCheck,
  Search,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Eye,
  XCircle,
  CheckCircle,
  Pause,
  Crown,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface WiFiPartner {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  partnerType: string;
  authMethod: string;
  costPerAuth: number;
  commission: number;
  maxDailyAuths?: number | null;
  activeAuths: number;
  totalAuths: number;
  totalRevenue: number;
  status: string;
  config?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WiFiPartnerAuth {
  id: string;
  tenantId: string;
  partnerId: string;
  guestId?: string | null;
  sessionId?: string | null;
  username: string;
  partnerRef?: string | null;
  partnerTier?: string | null;
  costToPartner: number;
  commission: number;
  ipAddress?: string | null;
  createdAt: string;
  partner?: { id: string; name: string };
}

interface PartnerStats {
  summary: {
    totalPartners: number;
    activePartners: number;
    totalAuths: number;
    totalAuthsAllTime: number;
    totalRevenue: number;
    totalCommission: number;
  };
  partnerBreakdown: {
    partnerId: string;
    partnerName: string;
    partnerType: string;
    auths: number;
    revenue: number;
    commission: number;
  }[];
  revenueByType: {
    partnerType: string;
    auths: number;
    revenue: number;
  }[];
  dailyTrend: {
    date: string;
    auths: number;
    revenue: number;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PARTNER_TYPE_LABELS: Record<string, string> = {
  loyalty: 'Loyalty',
  airline: 'Airline',
  credit_card: 'Credit Card',
  corporate: 'Corporate',
};

const PARTNER_TYPE_COLORS: Record<string, string> = {
  loyalty: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  airline: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  credit_card: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  corporate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const AUTH_METHOD_LABELS: Record<string, string> = {
  promo_code: 'Promo Code',
  auto_detect: 'Auto Detect',
  deep_link: 'Deep Link',
};

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs gap-1"><CheckCircle className="h-3 w-3" />Active</Badge>;
    case 'paused':
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs gap-1"><Pause className="h-3 w-3" />Paused</Badge>;
    case 'inactive':
      return <Badge className="bg-gray-400 hover:bg-gray-500 text-white border-0 text-xs gap-1"><XCircle className="h-3 w-3" />Inactive</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

const DEFAULT_CONFIG = JSON.stringify({
  apiEndpoint: '',
  apiKey: '',
  promoCode: '',
  sessionDuration: 3600,
  bandwidthLimit: null,
}, null, 2);

// ─── Component ──────────────────────────────────────────────────────────────────

export default function WifiPartners() {
  const { toast } = useToast();

  // ─── Data state ──────────────────────────────────────────────────────────
  const [partners, setPartners] = useState<WiFiPartner[]>([]);
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [authSessions, setAuthSessions] = useState<WiFiPartnerAuth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [authsLoading, setAuthsLoading] = useState(false);

  // ─── Filter state ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [authPartnerFilter, setAuthPartnerFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30');

  // ─── Dialog state ────────────────────────────────────────────────────────
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<WiFiPartner | null>(null);

  // ─── Form state ──────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    partnerType: 'loyalty',
    authMethod: 'promo_code',
    costPerAuth: 0,
    commission: 0,
    maxDailyAuths: '',
    config: DEFAULT_CONFIG,
  });

  // ─── Expand state ────────────────────────────────────────────────────────
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);
  const [expandedAuths, setExpandedAuths] = useState<WiFiPartnerAuth[]>([]);
  const [expandedLoading, setExpandedLoading] = useState(false);

  // ─── Action states ───────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [fetchKey, setFetchKey] = useState(0);
  const refreshData = useCallback(() => setFetchKey((k) => k + 1), []);

  // ─── Fetch Partners ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (typeFilter !== 'all') params.set('partnerType', typeFilter);
        if (searchQuery) params.set('search', searchQuery);
        params.set('limit', '100');

        const res = await fetch(`/api/wifi/partners?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();

        if (cancelled) return;
        if (data.success && Array.isArray(data.data)) {
          setPartners(data.data);
        } else {
          setPartners([]);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Failed to fetch partners:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; if (!controller.signal.aborted) controller.abort('Component cleanup'); };
  }, [statusFilter, typeFilter, searchQuery, fetchKey]);

  // ─── Fetch Stats ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setStatsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('days', dateRange === 'all' ? '365' : dateRange);
        const res = await fetch(`/api/wifi/partners/stats?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();

        if (cancelled) return;
        if (data.success && data.data) {
          setStats(data.data);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Failed to fetch partner stats:', error);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();

    return () => { cancelled = true; if (!controller.signal.aborted) controller.abort('Component cleanup'); };
  }, [dateRange, fetchKey]);

  // ─── Fetch Auth Sessions ─────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setAuthsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', '100');
        if (authPartnerFilter !== 'all') params.set('partnerId', authPartnerFilter);
        if (dateRange !== 'all') {
          const start = new Date(Date.now() - parseInt(dateRange) * 86400000).toISOString();
          params.set('startDate', start);
        }

        // Fetch auth sessions across all partners
        const res = await fetch(`/api/wifi/partners/stats?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();

        if (cancelled) return;

        // Get auth sessions from each partner
        const authRes = await fetch(`/api/wifi/partners?limit=100`, { signal: controller.signal });
        const authData = await authRes.json();

        if (cancelled) return;

        // Collect auth sessions from all partners
        if (authData.success && Array.isArray(authData.data)) {
          const allAuths: WiFiPartnerAuth[] = [];
          const partnerList = authData.data as WiFiPartner[];

          const filteredPartners = authPartnerFilter !== 'all'
            ? partnerList.filter((p) => p.id === authPartnerFilter)
            : partnerList;

          for (const partner of filteredPartners.slice(0, 10)) {
            try {
              const pParams = new URLSearchParams();
              pParams.set('limit', '20');
              if (dateRange !== 'all') {
                const start = new Date(Date.now() - parseInt(dateRange) * 86400000).toISOString();
                pParams.set('startDate', start);
              }
              const pRes = await fetch(`/api/wifi/partners/${partner.id}/auths?${pParams.toString()}`, { signal: controller.signal });
              const pData = await pRes.json();
              if (pData.success && Array.isArray(pData.data)) {
                allAuths.push(...pData.data);
              }
            } catch {
              // Skip individual partner errors
            }
          }

          setAuthSessions(allAuths);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Failed to fetch auth sessions:', error);
      } finally {
        if (!cancelled) setAuthsLoading(false);
      }
    })();

    return () => { cancelled = true; if (!controller.signal.aborted) controller.abort('Component cleanup'); };
  }, [authPartnerFilter, dateRange, fetchKey]);

  // ─── Expand partner to show recent auths ─────────────────────────────────

  const toggleExpand = async (partnerId: string) => {
    if (expandedPartner === partnerId) {
      setExpandedPartner(null);
      setExpandedAuths([]);
      return;
    }

    setExpandedPartner(partnerId);
    setExpandedLoading(true);
    try {
      const res = await fetch(`/api/wifi/partners/${partnerId}/auths?limit=10`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setExpandedAuths(data.data);
      } else {
        setExpandedAuths([]);
      }
    } catch {
      setExpandedAuths([]);
    } finally {
      setExpandedLoading(false);
    }
  };

  // ─── Create Partner ──────────────────────────────────────────────────────

  const openCreate = () => {
    setFormData({
      name: '',
      description: '',
      partnerType: 'loyalty',
      authMethod: 'promo_code',
      costPerAuth: 0,
      commission: 0,
      maxDailyAuths: '',
      config: DEFAULT_CONFIG,
    });
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Validation Error', description: 'Partner name is required', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/wifi/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          partnerType: formData.partnerType,
          authMethod: formData.authMethod,
          costPerAuth: formData.costPerAuth,
          commission: formData.commission,
          maxDailyAuths: formData.maxDailyAuths ? parseInt(formData.maxDailyAuths) : null,
          config: formData.config,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Partner Created', description: `${formData.name} has been added successfully.` });
        setCreateDialogOpen(false);
        refreshData();
      } else {
        toast({ title: 'Create Failed', description: data.error || 'Failed to create partner', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create partner', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Edit Partner ────────────────────────────────────────────────────────

  const openEdit = (partner: WiFiPartner) => {
    setSelectedPartner(partner);
    setFormData({
      name: partner.name,
      description: partner.description || '',
      partnerType: partner.partnerType,
      authMethod: partner.authMethod,
      costPerAuth: partner.costPerAuth,
      commission: partner.commission,
      maxDailyAuths: partner.maxDailyAuths ? String(partner.maxDailyAuths) : '',
      config: partner.config || DEFAULT_CONFIG,
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedPartner || !formData.name.trim()) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/wifi/partners/${selectedPartner.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          partnerType: formData.partnerType,
          authMethod: formData.authMethod,
          costPerAuth: formData.costPerAuth,
          commission: formData.commission,
          maxDailyAuths: formData.maxDailyAuths ? parseInt(formData.maxDailyAuths) : null,
          config: formData.config,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Partner Updated', description: `${formData.name} has been updated.` });
        setEditDialogOpen(false);
        setSelectedPartner(null);
        refreshData();
      } else {
        toast({ title: 'Update Failed', description: data.error || 'Failed to update partner', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update partner', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle Partner Status ───────────────────────────────────────────────

  const toggleStatus = async (partner: WiFiPartner) => {
    const newStatus = partner.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/wifi/partners/${partner.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Status Updated', description: `${partner.name} is now ${newStatus}.` });
        refreshData();
      } else {
        toast({ title: 'Update Failed', description: data.error || 'Failed to update status', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  // ─── Delete Partner ──────────────────────────────────────────────────────

  const openDelete = (partner: WiFiPartner) => {
    setSelectedPartner(partner);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedPartner) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/wifi/partners/${selectedPartner.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Partner Deleted', description: `${selectedPartner.name} has been removed.` });
        setDeleteDialogOpen(false);
        setSelectedPartner(null);
        refreshData();
      } else {
        toast({ title: 'Delete Failed', description: data.error || 'Failed to delete partner', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete partner', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  // ─── Analytics helpers ───────────────────────────────────────────────────

  const maxAuthsByPartner = stats?.partnerBreakdown?.[0]?.auths || 1;
  const maxDailyAuths = Math.max(...(stats?.dailyTrend?.map((d) => d.auths) || [1]), 1);
  const maxRevenueByType = Math.max(...(stats?.revenueByType?.map((r) => r.revenue) || [1]), 1);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Handshake className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Partner WiFi
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sponsored WiFi access via loyalty programs, airlines, and corporate partners
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Partner
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 p-2.5">
              <Handshake className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats?.summary?.activePartners ?? 0}</p>
              <p className="text-xs text-muted-foreground">Active Partners</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-sky-50 dark:bg-sky-950/30 p-2.5">
              <ShieldCheck className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats?.summary?.totalAuthsAllTime ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Auths</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2.5">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">₹{stats?.summary?.totalCommission?.toLocaleString() ?? '0'}</p>
              <p className="text-xs text-muted-foreground">Commission Earned</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2.5">
              <BarChart3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">₹{stats?.summary?.totalRevenue?.toLocaleString() ?? '0'}</p>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="partners" className="w-full">
        <TabsList>
          <TabsTrigger value="partners" className="gap-1.5">
            <Handshake className="h-4 w-4" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="auths" className="gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            Auth Sessions
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Partners Tab */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="partners" className="space-y-4">
          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search partners..."
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
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="loyalty">Loyalty</SelectItem>
                    <SelectItem value="airline">Airline</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Partners Table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : partners.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-muted/50 p-4 mb-3">
                    <Handshake className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground">No partners yet</h3>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Add a WiFi partner to enable sponsored access
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden md:table-cell">Type</TableHead>
                        <TableHead className="hidden lg:table-cell">Auth Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell text-right">Cost/Auth</TableHead>
                        <TableHead className="hidden lg:table-cell text-right">Commission</TableHead>
                        <TableHead className="hidden xl:table-cell text-right">Active</TableHead>
                        <TableHead className="hidden xl:table-cell text-right">Total Auths</TableHead>
                        <TableHead className="hidden xl:table-cell text-right">Revenue</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partners.map((partner) => (
                        <React.Fragment key={partner.id}>
                          <TableRow className="hover:bg-muted/50">
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => toggleExpand(partner.id)}
                              >
                                {expandedPartner === partner.id ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium">{partner.name}</p>
                                {partner.description && (
                                  <p className="text-xs text-muted-foreground max-w-[200px] truncate">{partner.description}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Badge className={`border-0 text-xs ${PARTNER_TYPE_COLORS[partner.partnerType] || ''}`}>
                                {PARTNER_TYPE_LABELS[partner.partnerType] || partner.partnerType}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <Badge variant="outline" className="text-xs">
                                {AUTH_METHOD_LABELS[partner.authMethod] || partner.authMethod}
                              </Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(partner.status)}</TableCell>
                            <TableCell className="hidden md:table-cell text-right">
                              <span className="text-sm tabular-nums">₹{partner.costPerAuth}</span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-right">
                              <span className="text-sm tabular-nums">{partner.commission}%</span>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell text-right">
                              <span className="text-sm tabular-nums">{partner.activeAuths}</span>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell text-right">
                              <span className="text-sm tabular-nums">{partner.totalAuths}</span>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell text-right">
                              <span className="text-sm font-medium tabular-nums">₹{partner.totalRevenue.toLocaleString()}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => toggleStatus(partner)}
                                  title={partner.status === 'active' ? 'Pause' : 'Activate'}
                                >
                                  {partner.status === 'active' ? (
                                    <Pause className="h-3.5 w-3.5 text-amber-500" />
                                  ) : (
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                  )}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(partner)}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openDelete(partner)}>
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Expandable Row: Recent Auth Sessions */}
                          {expandedPartner === partner.id && (
                            <TableRow>
                              <TableCell colSpan={11} className="bg-muted/30 px-8 py-4">
                                {expandedLoading ? (
                                  <div className="flex items-center justify-center py-6">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                  </div>
                                ) : expandedAuths.length === 0 ? (
                                  <div className="text-center py-6">
                                    <p className="text-xs text-muted-foreground">No auth sessions found for this partner</p>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">
                                      Recent Auth Sessions ({expandedAuths.length})
                                    </p>
                                    <div className="rounded-lg border overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-muted/50">
                                            <th className="text-left px-3 py-2 font-medium">Username</th>
                                            <th className="text-left px-3 py-2 font-medium">Ref</th>
                                            <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Tier</th>
                                            <th className="text-right px-3 py-2 font-medium">Cost</th>
                                            <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">Commission</th>
                                            <th className="text-left px-3 py-2 font-medium hidden md:table-cell">IP</th>
                                            <th className="text-right px-3 py-2 font-medium">Date</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {expandedAuths.map((auth) => (
                                            <tr key={auth.id} className="border-t">
                                              <td className="px-3 py-2 font-mono">{auth.username}</td>
                                              <td className="px-3 py-2">{auth.partnerRef || '—'}</td>
                                              <td className="px-3 py-2 hidden sm:table-cell">{auth.partnerTier || '—'}</td>
                                              <td className="px-3 py-2 text-right tabular-nums">₹{auth.costToPartner}</td>
                                              <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">₹{auth.commission}</td>
                                              <td className="px-3 py-2 hidden md:table-cell">{auth.ipAddress || '—'}</td>
                                              <td className="px-3 py-2 text-right text-muted-foreground">
                                                {formatDistanceToNow(new Date(auth.createdAt), { addSuffix: true })}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Auth Sessions Tab */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="auths" className="space-y-4">
          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by username or ref..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={authPartnerFilter} onValueChange={setAuthPartnerFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="All Partners" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Partners</SelectItem>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-full sm:w-[130px]">
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 Days</SelectItem>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                    <SelectItem value="90">Last 90 Days</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Auth Sessions Table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {authsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : authSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-muted/50 p-4 mb-3">
                    <ShieldCheck className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground">No auth sessions found</h3>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Promo code validations will appear here
                  </p>
                </div>
              ) : (
                <div className="overflow-auto max-h-96">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Guest</TableHead>
                        <TableHead className="hidden md:table-cell">Partner</TableHead>
                        <TableHead className="hidden sm:table-cell">Promo Code</TableHead>
                        <TableHead className="hidden lg:table-cell">Tier</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="hidden md:table-cell text-right">Commission</TableHead>
                        <TableHead className="hidden xl:table-cell">IP</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {authSessions.map((auth) => (
                        <TableRow key={auth.id} className="hover:bg-muted/50">
                          <TableCell>
                            <span className="font-mono text-xs">{auth.username}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-xs">{auth.partner?.name || '—'}</span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className="text-xs font-mono">{auth.partnerRef || '—'}</Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {auth.partnerTier ? (
                              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-0 text-xs">
                                {auth.partnerTier}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm tabular-nums">₹{auth.costToPartner}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-right">
                            <span className="text-sm tabular-nums">₹{auth.commission}</span>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            <span className="text-xs font-mono">{auth.ipAddress || '—'}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(auth.createdAt), { addSuffix: true })}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Analytics Tab */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Auths by Partner */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                  Auths by Partner
                </CardTitle>
                <CardDescription>Sponsored session count per partner</CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : stats?.partnerBreakdown && stats.partnerBreakdown.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {stats.partnerBreakdown.map((item, index) => (
                      <div key={index} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={`border-0 text-[10px] ${PARTNER_TYPE_COLORS[item.partnerType] || ''}`}>
                              {PARTNER_TYPE_LABELS[item.partnerType] || item.partnerType}
                            </Badge>
                            <span className="text-xs font-medium truncate max-w-[150px]">{item.partnerName}</span>
                          </div>
                          <span className="text-xs font-semibold tabular-nums">{item.auths} auths</span>
                        </div>
                        <Progress value={(item.auths / maxAuthsByPartner) * 100} className="h-2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground">No partner data available yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Revenue by Partner Type */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  Revenue by Partner Type
                </CardTitle>
                <CardDescription>Sponsored access revenue breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : stats?.revenueByType && stats.revenueByType.length > 0 ? (
                  <div className="space-y-3">
                    {stats.revenueByType.map((item, index) => (
                      <div key={index} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Badge className={`border-0 text-xs ${PARTNER_TYPE_COLORS[item.partnerType] || ''}`}>
                            {PARTNER_TYPE_LABELS[item.partnerType] || item.partnerType}
                          </Badge>
                          <div className="text-right">
                            <span className="text-xs font-semibold tabular-nums">₹{item.revenue.toLocaleString()}</span>
                            <span className="text-[10px] text-muted-foreground block">{item.auths} auths</span>
                          </div>
                        </div>
                        <Progress value={(item.revenue / maxRevenueByType) * 100} className="h-3" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground">No revenue data available yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Partners */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-600" />
                  Top Partners
                </CardTitle>
                <CardDescription>Highest revenue generating partners</CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : stats?.partnerBreakdown && stats.partnerBreakdown.length > 0 ? (
                  <div className="space-y-2">
                    {stats.partnerBreakdown.slice(0, 10).map((item, index) => (
                      <div key={index} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium">{item.partnerName}</p>
                            <p className="text-[10px] text-muted-foreground">{item.auths} auths</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">₹{item.revenue.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">₹{item.commission} commission</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground">No partner data available yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily Auth Trend */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-sky-600" />
                  Daily Auth Trend
                </CardTitle>
                <CardDescription>Sponsored WiFi sessions per day (last {dateRange === 'all' ? '365' : dateRange} days)</CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : stats?.dailyTrend && stats.dailyTrend.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {[...stats.dailyTrend].reverse().map((day, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">{day.date}</span>
                        <div className="flex-1">
                          <Progress value={(day.auths / maxDailyAuths) * 100} className="h-3" />
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-semibold tabular-nums">{day.auths} auths</span>
                          <span className="text-[10px] text-muted-foreground block">₹{day.revenue.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground">No daily trend data available yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Create Partner Dialog */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-purple-600" />
              Add WiFi Partner
            </DialogTitle>
            <DialogDescription>
              Create a new sponsored WiFi access partner
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-name">Partner Name *</Label>
              <Input
                id="create-name"
                placeholder="e.g. Marriott Bonvoy"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-desc">Description</Label>
              <Input
                id="create-desc"
                placeholder="Brief description of the partnership"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Partner Type</Label>
                <Select value={formData.partnerType} onValueChange={(v) => setFormData({ ...formData, partnerType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loyalty">Loyalty</SelectItem>
                    <SelectItem value="airline">Airline</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Auth Method</Label>
                <Select value={formData.authMethod} onValueChange={(v) => setFormData({ ...formData, authMethod: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="promo_code">Promo Code</SelectItem>
                    <SelectItem value="auto_detect">Auto Detect</SelectItem>
                    <SelectItem value="deep_link">Deep Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Cost/Auth (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.costPerAuth}
                  onChange={(e) => setFormData({ ...formData, costPerAuth: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Commission (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.commission}
                  onChange={(e) => setFormData({ ...formData, commission: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Daily Auth Limit</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={formData.maxDailyAuths}
                  onChange={(e) => setFormData({ ...formData, maxDailyAuths: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-config">Configuration (JSON)</Label>
              <Textarea
                id="create-config"
                className="font-mono text-xs min-h-[120px]"
                value={formData.config}
                onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                autoComplete="off"
              />
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  Include promoCode, apiEndpoint, apiKey, sessionDuration, bandwidthLimit
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  ⚠ API keys are sensitive — ensure proper access controls
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !formData.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Partner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Edit Partner Dialog */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-4 w-4 text-purple-600" />
              Edit Partner
            </DialogTitle>
            <DialogDescription>Update partner configuration</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Partner Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Input
                id="edit-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Partner Type</Label>
                <Select value={formData.partnerType} onValueChange={(v) => setFormData({ ...formData, partnerType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loyalty">Loyalty</SelectItem>
                    <SelectItem value="airline">Airline</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Auth Method</Label>
                <Select value={formData.authMethod} onValueChange={(v) => setFormData({ ...formData, authMethod: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="promo_code">Promo Code</SelectItem>
                    <SelectItem value="auto_detect">Auto Detect</SelectItem>
                    <SelectItem value="deep_link">Deep Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Cost/Auth (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.costPerAuth}
                  onChange={(e) => setFormData({ ...formData, costPerAuth: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Commission (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.commission}
                  onChange={(e) => setFormData({ ...formData, commission: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Daily Auth Limit</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={formData.maxDailyAuths}
                  onChange={(e) => setFormData({ ...formData, maxDailyAuths: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-config">Configuration (JSON)</Label>
              <Textarea
                id="edit-config"
                className="font-mono text-xs min-h-[120px]"
                value={formData.config}
                onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                autoComplete="off"
              />
              <div className="flex items-center justify-end">
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  ⚠ API keys are sensitive — ensure proper access controls
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving || !formData.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Delete Partner Dialog */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              Delete Partner
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold">{selectedPartner?.name}</span>?
              This will permanently remove the partner and all associated auth session records.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Partner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
