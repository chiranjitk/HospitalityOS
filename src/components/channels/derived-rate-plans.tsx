'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Calculator,
  DollarSign,
  Percent,
  CircleDollarSign,
  TrendingUp,
  Target,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Eye,
  ArrowUpDown,
  Filter,
  Search,
  CalendarDays,
  Zap,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface RatePlan {
  id: string;
  name: string;
  code: string;
  basePrice: number;
  currency: string;
  status: string;
}

interface ChannelConnection {
  id: string;
  channel: string;
  displayName: string | null;
  status: string;
}

interface DerivedRatePlan {
  id: string;
  tenantId: string;
  propertyId: string | null;
  name: string;
  description: string | null;
  connectionId: string | null;
  channelCode: string;
  sourceRatePlanId: string;
  roomTypeId: string | null;
  derivationType: string;
  adjustmentValue: number;
  roundingMethod: string;
  floorRate: number | null;
  ceilingRate: number | null;
  minStay: number | null;
  maxStay: number | null;
  appliesTo: string;
  specificDates: string | null;
  autoSync: boolean;
  syncInterval: number;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
  sourceRatePlanName: string;
  sourceBasePrice: number;
  connectionDisplayName: string | null;
  connectionChannel: string | null;
}

interface PreviewRow {
  date: string;
  sourceRate: number;
  derivedRate: number;
  adjustmentApplied: number;
  applies: boolean;
}

interface Snapshot {
  id: string;
  tenantId: string;
  derivedPlanId: string;
  date: string;
  sourceRate: number;
  derivedRate: number;
  adjustmentApplied: number;
  createdAt: string;
}

interface FormData {
  name: string;
  description: string;
  connectionId: string;
  channelCode: string;
  sourceRatePlanId: string;
  roomTypeId: string;
  derivationType: string;
  adjustmentValue: number;
  roundingMethod: string;
  floorRate: string;
  ceilingRate: string;
  minStay: string;
  maxStay: string;
  appliesTo: string;
  specificDates: string;
  autoSync: boolean;
  syncInterval: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
}

// ============================================
// CONSTANTS
// ============================================

const DERIVATION_LABELS: Record<string, string> = {
  percentage: 'Percentage (%)',
  fixed_amount: 'Fixed Amount ($)',
  margin: 'Margin (%)',
  seasonal_percentage: 'Seasonal (%)',
  competitor_based: 'Competitor Match (%)',
};

const DERIVATION_DESCRIPTIONS: Record<string, string> = {
  percentage: 'Add/subtract a percentage from the source rate',
  fixed_amount: 'Add/subtract a fixed dollar amount from the source rate',
  margin: 'Apply a margin to derive the selling price (base / (1 - margin%))',
  seasonal_percentage: 'Seasonal percentage adjustment (e.g., peak season +15%)',
  competitor_based: 'Set rate as a percentage of the source rate',
};

const ROUNDING_LABELS: Record<string, string> = {
  nearest: 'Nearest',
  up: 'Round Up',
  down: 'Round Down',
  none: 'No Rounding (2 decimals)',
};

const APPLIES_TO_LABELS: Record<string, string> = {
  all: 'All Days',
  weekdays: 'Weekdays (Mon\u2013Fri)',
  weekends: 'Weekends (Sat\u2013Sun)',
  specific_dates: 'Specific Date Ranges',
};

const 'current' = '00000000-0000-0000-0000-000000000001';

// ============================================
// COMPONENT
// ============================================

export function DerivedRatePlans() {
  // Data
  const [plans, setPlans] = useState<DerivedRatePlan[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterConnection, setFilterConnection] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<DerivedRatePlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<DerivedRatePlan | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Preview / Generate
  const [previewPlanId, setPreviewPlanId] = useState<string>('');
  const [previewStart, setPreviewStart] = useState<string>(new Date().toISOString().split('T')[0]);
  const [previewEnd, setPreviewEnd] = useState<string>(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [previewBaseRate, setPreviewBaseRate] = useState<string>('');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Snapshots
  const [snapshotPlanId, setSnapshotPlanId] = useState<string>('');
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    connectionId: '',
    channelCode: '',
    sourceRatePlanId: '',
    roomTypeId: '',
    derivationType: 'percentage',
    adjustmentValue: 0,
    roundingMethod: 'nearest',
    floorRate: '',
    ceilingRate: '',
    minStay: '',
    maxStay: '',
    appliesTo: 'all',
    specificDates: '',
    autoSync: true,
    syncInterval: 60,
    isActive: true,
    effectiveFrom: '',
    effectiveTo: '',
  });

  // ============================================
  // FETCH DATA
  // ============================================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tenantId: 'current' });

      const [plansRes, rpRes, connRes] = await Promise.all([
        fetch(`/api/channels/derived-rate-plans?${params}`),
        fetch(`/api/pms/rate-plans?tenantId=${'current'}`),
        fetch(`/api/channels/connections`),
      ]);

      const [plansData, rpData, connData] = await Promise.all([
        plansRes.json(),
        rpRes.json(),
        connRes.json(),
      ]);

      if (plansData.success) setPlans(plansData.data || []);
      if (rpData.success) setRatePlans(rpData.data || []);
      if (connData.success) setConnections(connData.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load derived rate plans');
    } finally {
      setLoading(false);
    }
  }, []);

  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    fetchData();
  });

  // ============================================
  // FORM HELPERS
  // ============================================
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      connectionId: '',
      channelCode: '',
      sourceRatePlanId: '',
      roomTypeId: '',
      derivationType: 'percentage',
      adjustmentValue: 0,
      roundingMethod: 'nearest',
      floorRate: '',
      ceilingRate: '',
      minStay: '',
      maxStay: '',
      appliesTo: 'all',
      specificDates: '',
      autoSync: true,
      syncInterval: 60,
      isActive: true,
      effectiveFrom: '',
      effectiveTo: '',
    });
    setEditingPlan(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (plan: DerivedRatePlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      connectionId: plan.connectionId || '',
      channelCode: plan.channelCode,
      sourceRatePlanId: plan.sourceRatePlanId,
      roomTypeId: plan.roomTypeId || '',
      derivationType: plan.derivationType,
      adjustmentValue: plan.adjustmentValue,
      roundingMethod: plan.roundingMethod,
      floorRate: plan.floorRate?.toString() || '',
      ceilingRate: plan.ceilingRate?.toString() || '',
      minStay: plan.minStay?.toString() || '',
      maxStay: plan.maxStay?.toString() || '',
      appliesTo: plan.appliesTo,
      specificDates: plan.specificDates || '',
      autoSync: plan.autoSync,
      syncInterval: plan.syncInterval,
      isActive: plan.isActive,
      effectiveFrom: plan.effectiveFrom ? plan.effectiveFrom.split('T')[0] : '',
      effectiveTo: plan.effectiveTo ? plan.effectiveTo.split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  // ============================================
  // CRUD
  // ============================================
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Plan name is required');
      return;
    }
    if (!formData.sourceRatePlanId) {
      toast.error('Source rate plan is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tenantId: 'current',
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        connectionId: formData.connectionId || null,
        channelCode: formData.channelCode,
        sourceRatePlanId: formData.sourceRatePlanId,
        roomTypeId: formData.roomTypeId || null,
        derivationType: formData.derivationType,
        adjustmentValue: parseFloat(String(formData.adjustmentValue)) || 0,
        roundingMethod: formData.roundingMethod,
        floorRate: formData.floorRate ? parseFloat(formData.floorRate) : null,
        ceilingRate: formData.ceilingRate ? parseFloat(formData.ceilingRate) : null,
        minStay: formData.minStay ? parseInt(formData.minStay) : null,
        maxStay: formData.maxStay ? parseInt(formData.maxStay) : null,
        appliesTo: formData.appliesTo,
        specificDates: formData.specificDates.trim() || null,
        autoSync: formData.autoSync,
        syncInterval: formData.syncInterval,
        isActive: formData.isActive,
        effectiveFrom: formData.effectiveFrom || null,
        effectiveTo: formData.effectiveTo || null,
      };

      const method = editingPlan ? 'PUT' : 'POST';
      const body = editingPlan ? { id: editingPlan.id, ...payload } : payload;

      const res = await fetch('/api/channels/derived-rate-plans', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editingPlan ? 'Plan updated successfully' : 'Plan created successfully');
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to save plan');
      }
    } catch {
      toast.error('Network error saving plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPlan) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/channels/derived-rate-plans', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingPlan.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Plan deleted successfully');
        setDeleteDialogOpen(false);
        setDeletingPlan(null);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to delete plan');
      }
    } catch {
      toast.error('Network error deleting plan');
    } finally {
      setDeleting(false);
    }
  };

  // ============================================
  // PREVIEW / GENERATE / SYNC
  // ============================================
  const handlePreview = async () => {
    if (!previewPlanId) {
      toast.error('Select a derived rate plan');
      return;
    }
    setPreviewLoading(true);
    setPreviewRows([]);
    try {
      const params = new URLSearchParams({
        action: 'preview',
        planId: previewPlanId,
        startDate: previewStart,
        endDate: previewEnd,
      });
      if (previewBaseRate) params.set('baseRate', previewBaseRate);

      const res = await fetch(`/api/channels/derived-rate-plans?${params}`);
      const data = await res.json();
      if (data.success) {
        setPreviewRows(data.data.rows || []);
      } else {
        toast.error(data.error?.message || 'Preview failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!previewPlanId) {
      toast.error('Select a derived rate plan');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/channels/derived-rate-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          planId: previewPlanId,
          startDate: previewStart,
          endDate: previewEnd,
          baseRate: previewBaseRate ? parseFloat(previewBaseRate) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Generated ${data.data.count} snapshots`);
        handlePreview(); // refresh preview
      } else {
        toast.error(data.error?.message || 'Generation failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSync = async (planId: string) => {
    setSyncingId(planId);
    try {
      const res = await fetch('/api/channels/derived-rate-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', planId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Sync completed');
        fetchData();
      } else {
        toast.error(data.error?.message || 'Sync failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSyncingId(null);
    }
  };

  const handleLoadSnapshots = async () => {
    if (!snapshotPlanId) return;
    setSnapshotsLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'snapshots',
        derivedPlanId: snapshotPlanId,
        startDate: previewStart,
        endDate: previewEnd,
      });
      const res = await fetch(`/api/channels/derived-rate-plans?${params}`);
      const data = await res.json();
      if (data.success) {
        setSnapshots(data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setSnapshotsLoading(false);
    }
  };

  // ============================================
  // FILTERED PLANS
  // ============================================
  const filteredPlans = plans.filter((plan) => {
    if (filterConnection !== 'all' && plan.connectionId !== filterConnection) return false;
    if (filterSource !== 'all' && plan.sourceRatePlanId !== filterSource) return false;
    if (filterStatus === 'active' && !plan.isActive) return false;
    if (filterStatus === 'inactive' && plan.isActive) return false;
    return true;
  });

  // ============================================
  // RENDER HELPERS
  // ============================================
  const getDerivationIcon = (type: string) => {
    switch (type) {
      case 'percentage': return <Percent className="h-4 w-4" />;
      case 'fixed_amount': return <CircleDollarSign className="h-4 w-4" />;
      case 'margin': return <TrendingUp className="h-4 w-4" />;
      case 'seasonal_percentage': return <CalendarDays className="h-4 w-4" />;
      case 'competitor_based': return <Target className="h-4 w-4" />;
      default: return <GitBranch className="h-4 w-4" />;
    }
  };

  const getAdjustmentBadge = (type: string, val: number) => {
    const sign = val >= 0 ? '+' : '';
    const display = type === 'fixed_amount'
      ? `${sign}$${val.toFixed(2)}`
      : type === 'margin'
        ? `${val}% margin`
        : `${sign}${val}%`;

    const colorClass = val < 0
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0';

    return <Badge className={`${colorClass} gap-1 text-xs`}>{display}</Badge>;
  };

  const getSyncStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline" className="text-xs">Never</Badge>;
    switch (status) {
      case 'success':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Success</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
      case 'partial':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs gap-1"><Clock className="h-3 w-3" />Partial</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '\u2014';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '\u2014';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-80 rounded" />
            <Skeleton className="h-4 w-96 mt-2 rounded" />
          </div>
          <Skeleton className="h-10 w-40 rounded" />
        </div>
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-primary" />
            Derived Rate Plans
          </h1>
          <p className="text-muted-foreground mt-1">
            Create channel-specific rate plans derived from master rate plans with automatic adjustments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Derived Plan
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <GitBranch className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{plans.length}</p>
                <p className="text-xs text-muted-foreground">Total Plans</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {plans.filter((r) => r.isActive).length}
                </p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <Zap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-700 dark:text-violet-400 tabular-nums">
                  {plans.filter((r) => r.autoSync).length}
                </p>
                <p className="text-xs text-muted-foreground">Auto-Sync Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Upload className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                  {plans.filter((r) => r.lastSyncStatus === 'success').length}
                </p>
                <p className="text-xs text-muted-foreground">Last Sync OK</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Plans | Rate Generator | Comparison */}
      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans">Derived Plans</TabsTrigger>
          <TabsTrigger value="generator">Rate Generator</TabsTrigger>
          <TabsTrigger value="snapshots">Rate Snapshots</TabsTrigger>
        </TabsList>

        {/* ============================================ */}
        {/* PLANS TAB */}
        {/* ============================================ */}
        <TabsContent value="plans" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-end gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Filter className="h-3 w-3" />
                    Channel Connection
                  </Label>
                  <Select value={filterConnection} onValueChange={setFilterConnection}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All channels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Channels</SelectItem>
                      {connections.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.displayName || c.channel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Source Rate Plan
                  </Label>
                  <Select value={filterSource} onValueChange={setFilterSource}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All rate plans" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Rate Plans</SelectItem>
                      {ratePlans.map((rp) => (
                        <SelectItem key={rp.id} value={rp.id}>
                          {rp.name} ({rp.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 min-w-[140px]">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground self-center">
                  {filteredPlans.length} of {plans.length} plans
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plans Table */}
          {filteredPlans.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Name</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Source Plan</TableHead>
                        <TableHead>Derivation</TableHead>
                        <TableHead>Adjustment</TableHead>
                        <TableHead>Floor / Ceiling</TableHead>
                        <TableHead>Auto Sync</TableHead>
                        <TableHead>Last Sync</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPlans.map((plan) => (
                        <TableRow key={plan.id} className={!plan.isActive ? 'opacity-60' : ''}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm truncate max-w-[160px]">{plan.name}</p>
                              {plan.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[160px]">{plan.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {plan.connectionChannel ? (
                              <Badge variant="secondary" className="text-xs">{plan.connectionChannel}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">{plan.channelCode || '\u2014'}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-mono">{plan.sourceRatePlanName}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs">
                              {getDerivationIcon(plan.derivationType)}
                              <span className="capitalize">{plan.derivationType.replace('_', ' ')}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getAdjustmentBadge(plan.derivationType, plan.adjustmentValue)}</TableCell>
                          <TableCell>
                            <div className="text-xs space-y-0.5">
                              {plan.floorRate != null && <p className="text-muted-foreground">Floor: <span className="font-medium text-foreground">${plan.floorRate}</span></p>}
                              {plan.ceilingRate != null && <p className="text-muted-foreground">Ceil: <span className="font-medium text-foreground">${plan.ceilingRate}</span></p>}
                              {plan.floorRate == null && plan.ceilingRate == null && <span className="text-muted-foreground">\u2014</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            {plan.autoSync ? (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">On</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Off</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {getSyncStatusBadge(plan.lastSyncStatus)}
                              {plan.lastSyncAt && (
                                <p className="text-[10px] text-muted-foreground">{formatDateTime(plan.lastSyncAt)}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={plan.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0' : 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400 border-0'}>
                              {plan.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSync(plan.id)}
                                disabled={syncingId === plan.id}
                                className="h-8 w-8 p-0"
                                title="Sync to channel"
                              >
                                {syncingId === plan.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Upload className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(plan)} className="h-8 w-8 p-0">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setDeletingPlan(plan); setDeleteDialogOpen(true); }}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Search className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Derived Rate Plans</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                  {plans.length > 0
                    ? 'No plans match the current filters. Try adjusting your filter criteria.'
                    : 'Create your first derived rate plan to automatically calculate channel-specific rates from your master rate plans.'}
                </p>
                {plans.length === 0 && (
                  <Button onClick={openCreateDialog} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Plan
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================ */}
        {/* RATE GENERATOR TAB */}
        {/* ============================================ */}
        <TabsContent value="generator" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Rate Generator & Preview
              </CardTitle>
              <CardDescription className="text-xs">
                Select a derived plan and date range to preview or generate derived rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Derived Plan</Label>
                  <Select value={previewPlanId} onValueChange={setPreviewPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.filter((r) => r.isActive).map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} ({plan.sourceRatePlanName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Start Date</Label>
                  <Input type="date" value={previewStart} onChange={(e) => setPreviewStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">End Date</Label>
                  <Input type="date" value={previewEnd} onChange={(e) => setPreviewEnd(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Base Rate (optional)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input type="number" value={previewBaseRate} onChange={(e) => setPreviewBaseRate(e.target.value)} className="pl-9" placeholder="From rate plan" min="0" step="0.01" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Button onClick={handlePreview} disabled={previewLoading || !previewPlanId} variant="outline" className="gap-2">
                  {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  Preview Rates
                </Button>
                <Button onClick={handleGenerate} disabled={generating || !previewPlanId || previewRows.length === 0} className="gap-2">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                  Generate & Save
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview Table */}
          {previewRows.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Source vs Derived Rate Comparison
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Source Rate</TableHead>
                        <TableHead className="text-right">Adjustment</TableHead>
                        <TableHead className="text-right">Derived Rate</TableHead>
                        <TableHead className="text-center">Applies</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, idx) => (
                        <TableRow key={idx} className={!row.applies ? 'opacity-50' : ''}>
                          <TableCell className="text-xs font-mono">{row.date}</TableCell>
                          <TableCell className="text-right font-mono text-sm">${row.sourceRate.toFixed(2)}</TableCell>
                          <TableCell className={`text-right font-mono text-sm ${row.adjustmentApplied > 0 ? 'text-emerald-600 dark:text-emerald-400' : row.adjustmentApplied < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                            {row.adjustmentApplied >= 0 ? '+' : ''}{row.adjustmentApplied.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">${row.derivedRate.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            {row.applies ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================ */}
        {/* SNAPSHOTS TAB */}
        {/* ============================================ */}
        <TabsContent value="snapshots" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-end gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Derived Plan</Label>
                  <Select value={snapshotPlanId} onValueChange={setSnapshotPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">From</Label>
                  <Input type="date" value={previewStart} onChange={(e) => setPreviewStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">To</Label>
                  <Input type="date" value={previewEnd} onChange={(e) => setPreviewEnd(e.target.value)} />
                </div>
                <Button onClick={handleLoadSnapshots} disabled={!snapshotPlanId || snapshotsLoading} variant="outline" className="gap-2">
                  {snapshotsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Load
                </Button>
              </div>
            </CardContent>
          </Card>

          {snapshots.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Source Rate</TableHead>
                        <TableHead className="text-right">Derived Rate</TableHead>
                        <TableHead className="text-right">Adjustment</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshots.map((snap) => (
                        <TableRow key={snap.id}>
                          <TableCell className="text-xs font-mono">{new Date(snap.date).toISOString().split('T')[0]}</TableCell>
                          <TableCell className="text-right font-mono text-sm">${snap.sourceRate.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">${snap.derivedRate.toFixed(2)}</TableCell>
                          <TableCell className={`text-right font-mono text-sm ${snap.adjustmentApplied > 0 ? 'text-emerald-600 dark:text-emerald-400' : snap.adjustmentApplied < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                            {snap.adjustmentApplied >= 0 ? '+' : ''}{snap.adjustmentApplied.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDateTime(snap.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            snapshotPlanId && !snapshotsLoading && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <BarChart3 className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Snapshots Found</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    Generate rates for this plan first using the Rate Generator tab, then come back to view the saved snapshots.
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">How Derived Rate Plans Work</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>Percentage:</strong> e.g., &quot;Booking.com BAR&quot; = Master BAR - 5%</li>
                <li><strong>Fixed Amount:</strong> e.g., &quot;Expedia Corporate&quot; = Master Corporate + $10</li>
                <li><strong>Margin:</strong> e.g., base rate / (1 - 15% margin)</li>
                <li><strong>Seasonal:</strong> Apply seasonal percentage adjustments for peak/off-peak</li>
                <li><strong>Competitor Based:</strong> Set rate as a percentage of the source rate</li>
              </ul>
              <p className="text-xs">
                Floor/ceiling constraints always take precedence. Auto-sync pushes derived rates to the configured channel at regular intervals.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? 'Edit Derived Rate Plan' : 'Create Derived Rate Plan'}
            </DialogTitle>
            <DialogDescription>
              {editingPlan
                ? 'Modify the derived rate plan configuration'
                : 'Define a channel-specific rate plan derived from a master rate plan'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Info className="h-4 w-4" />
                Basic Information
              </h3>
              <div className="space-y-2">
                <Label>Plan Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Booking.com BAR - 5%"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description..."
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* Source & Target */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Source & Target Channel
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Rate Plan *</Label>
                  <Select
                    value={formData.sourceRatePlanId}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, sourceRatePlanId: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rate plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {ratePlans.map((rp) => (
                        <SelectItem key={rp.id} value={rp.id}>
                          {rp.name} ({rp.code}) - ${rp.basePrice}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Channel Connection</Label>
                  <Select
                    value={formData.connectionId}
                    onValueChange={(val) => {
                      const conn = connections.find((c) => c.id === val);
                      setFormData((prev) => ({
                        ...prev,
                        connectionId: val,
                        channelCode: conn?.channel || prev.channelCode,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>
                          {conn.displayName || conn.channel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Derivation Logic */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Derivation Logic
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Derivation Type</Label>
                  <Select
                    value={formData.derivationType}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, derivationType: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DERIVATION_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {DERIVATION_DESCRIPTIONS[formData.derivationType]}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Adjustment Value *</Label>
                  <Input
                    type="number"
                    value={formData.adjustmentValue}
                    onChange={(e) => setFormData((prev) => ({ ...prev, adjustmentValue: parseFloat(e.target.value) || 0 }))}
                    placeholder="e.g., -5 or 10"
                    step="0.01"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.derivationType === 'fixed_amount'
                      ? 'Positive to add, negative to subtract'
                      : formData.derivationType === 'margin'
                        ? 'Margin percentage (e.g., 20 for 20% margin)'
                        : 'Positive to increase, negative to decrease'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rounding Method</Label>
                  <Select
                    value={formData.roundingMethod}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, roundingMethod: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROUNDING_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Applies To</Label>
                  <Select
                    value={formData.appliesTo}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, appliesTo: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(APPLIES_TO_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Rate Constraints */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Rate Constraints
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Floor Rate</Label>
                  <Input
                    type="number"
                    value={formData.floorRate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, floorRate: e.target.value }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Ceiling Rate</Label>
                  <Input
                    type="number"
                    value={formData.ceilingRate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ceilingRate: e.target.value }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Min Stay</Label>
                  <Input
                    type="number"
                    value={formData.minStay}
                    onChange={(e) => setFormData((prev) => ({ ...prev, minStay: e.target.value }))}
                    placeholder="Nights"
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Max Stay</Label>
                  <Input
                    type="number"
                    value={formData.maxStay}
                    onChange={(e) => setFormData((prev) => ({ ...prev, maxStay: e.target.value }))}
                    placeholder="Nights"
                    min="1"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Sync & Status */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Sync & Status
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex items-center gap-3 col-span-2">
                  <Switch
                    checked={formData.autoSync}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, autoSync: checked }))}
                  />
                  <div>
                    <Label>Auto Sync</Label>
                    <p className="text-xs text-muted-foreground">Push rates automatically</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Sync Interval (min)</Label>
                  <Input
                    type="number"
                    value={formData.syncInterval}
                    onChange={(e) => setFormData((prev) => ({ ...prev, syncInterval: parseInt(e.target.value) || 60 }))}
                    min="1"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
                  />
                  <div>
                    <Label>Active</Label>
                    <p className="text-xs text-muted-foreground">Enable this plan</p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Effective Dates */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Effective Dates (optional)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Effective From</Label>
                  <Input type="date" value={formData.effectiveFrom} onChange={(e) => setFormData((prev) => ({ ...prev, effectiveFrom: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Effective To</Label>
                  <Input type="date" value={formData.effectiveTo} onChange={(e) => setFormData((prev) => ({ ...prev, effectiveTo: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPlan ? 'Update Plan' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Derived Rate Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingPlan?.name}&quot;? This will also delete all associated rate snapshots. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
