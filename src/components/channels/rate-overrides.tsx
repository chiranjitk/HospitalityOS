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
  Calculator,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  DollarSign,
  Percent,
  Equal,
  ArrowRight,
  Filter,
  Search,
  Info,
  CheckCircle2,
  XCircle,
  TrendingDown,
  TrendingUp,
  CalendarDays,
  BarChart3,
  CircleDollarSign,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface ChannelConnection {
  id: string;
  channel: string;
  displayName: string | null;
  status: string;
}

interface RoomType {
  id: string;
  name: string;
  code?: string;
}

interface RatePlan {
  id: string;
  name: string;
  code: string;
}

interface RateOverride {
  id: string;
  tenantId: string;
  propertyId: string | null;
  connectionId: string | null;
  channelCode: string;
  name: string;
  description: string | null;
  roomTypeId: string | null;
  ratePlanId: string | null;
  overrideType: string;
  overrideValue: number;
  currency: string;
  minRate: number | null;
  maxRate: number | null;
  appliesTo: string;
  specificDates: string | null;
  priority: number;
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
  connectionDisplayName: string | null;
  connectionChannel: string | null;
  roomTypeName: string | null;
  ratePlanName: string | null;
}

interface CalculateResult {
  baseRate: number;
  finalRate: number;
  difference: number;
  differencePercent: number;
  currency: string;
  overridesApplied: number;
  breakdown: Array<{
    overrideId: string;
    overrideName: string;
    overrideType: string;
    overrideValue: number;
    rateBefore: number;
    rateAfter: number;
  }>;
  date: string;
  connectionId: string;
  channelCode: string;
}

interface OverrideFormData {
  name: string;
  description: string;
  channelCode: string;
  connectionId: string;
  roomTypeId: string;
  ratePlanId: string;
  overrideType: string;
  overrideValue: number;
  currency: string;
  minRate: string;
  maxRate: string;
  appliesTo: string;
  specificDatesStart: string;
  specificDatesEnd: string;
  priority: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
}

// ============================================
// CONSTANTS
// ============================================

const OVERRIDE_TYPE_LABELS: Record<string, string> = {
  percentage: 'Percentage (%)',
  fixed_amount: 'Fixed Amount ($)',
  set_to: 'Set To ($)',
};

const OVERRIDE_TYPE_DESCRIPTIONS: Record<string, string> = {
  percentage: 'Add/subtract a percentage from the rate (e.g., -5% for Expedia)',
  fixed_amount: 'Add/subtract a fixed dollar amount (e.g., +$10 for weekend rates)',
  set_to: 'Override and set to a specific flat amount (e.g., $250 for suites)',
};

const APPLIES_TO_LABELS: Record<string, string> = {
  all: 'All Days',
  weekdays: 'Weekdays (Mon–Fri)',
  weekends: 'Weekends (Sat–Sun)',
  specific_dates: 'Specific Date Ranges',
};

const CHANNEL_OPTIONS = [
  { value: 'expedia', label: 'Expedia' },
  { value: 'bookingcom', label: 'Booking.com' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'google_hotel', label: 'Google Hotel Ads' },
  { value: 'direct', label: 'Direct Website' },
  { value: 'agoda', label: 'Agoda' },
  { value: 'vrbo', label: 'Vrbo' },
  { value: 'hotelscom', label: 'Hotels.com' },
  { value: 'tripadvisor', label: 'TripAdvisor' },
  { value: 'other', label: 'Other' },
];

const CURRENT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ============================================
// COMPONENT
// ============================================

export function ChannelRateOverrides() {
  // Data
  const [overrides, setOverrides] = useState<RateOverride[]>([]);
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterConnection, setFilterConnection] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterRoomType, setFilterRoomType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOverride, setEditingOverride] = useState<RateOverride | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingOverride, setDeletingOverride] = useState<RateOverride | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Calculator
  const [calcConnectionId, setCalcConnectionId] = useState<string>('');
  const [calcBaseRate, setCalcBaseRate] = useState<string>('150');
  const [calcDate, setCalcDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [calcResult, setCalcResult] = useState<CalculateResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Form data
  const defaultFormData: OverrideFormData = {
    name: '',
    description: '',
    channelCode: '',
    connectionId: '',
    roomTypeId: '',
    ratePlanId: '',
    overrideType: 'percentage',
    overrideValue: 0,
    currency: 'USD',
    minRate: '',
    maxRate: '',
    appliesTo: 'all',
    specificDatesStart: '',
    specificDatesEnd: '',
    priority: 0,
    isActive: true,
    effectiveFrom: '',
    effectiveTo: '',
  };
  const [formData, setFormData] = useState<OverrideFormData>(defaultFormData);

  // ============================================
  // FETCH DATA
  // ============================================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tenantId: 'current' });

      const [overridesRes, connectionsRes, roomTypesRes, ratePlansRes] = await Promise.all([
        fetch(`/api/channels/rate-overrides?${params}`),
        fetch(`/api/channels/connections?tenantId=${'current'}`),
        fetch(`/api/pms/room-types?tenantId=${'current'}`),
        fetch(`/api/pms/rate-plans?tenantId=${'current'}`),
      ]);

      const [overridesData, connData, rtData, rpData] = await Promise.all([
        overridesRes.json(),
        connectionsRes.json(),
        roomTypesRes.json(),
        ratePlansRes.json(),
      ]);

      if (overridesData.success) setOverrides(overridesData.data || []);
      if (connData.success) setConnections(connData.data || []);
      if (rtData.success) setRoomTypes(rpData.data || []);
      if (rpData.success) setRatePlans(rpData.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load rate overrides');
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
    setFormData(defaultFormData);
    setEditingOverride(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (override: RateOverride) => {
    setEditingOverride(override);

    let specificDatesStart = '';
    let specificDatesEnd = '';
    if (override.specificDates) {
      try {
        const ranges = JSON.parse(override.specificDates);
        if (ranges.length > 0) {
          specificDatesStart = ranges[0].start || '';
          specificDatesEnd = ranges[0].end || '';
        }
      } catch { /* ignore */ }
    }

    setFormData({
      name: override.name,
      description: override.description || '',
      channelCode: override.channelCode,
      connectionId: override.connectionId || '',
      roomTypeId: override.roomTypeId || '',
      ratePlanId: override.ratePlanId || '',
      overrideType: override.overrideType,
      overrideValue: override.overrideValue,
      currency: override.currency,
      minRate: override.minRate?.toString() || '',
      maxRate: override.maxRate?.toString() || '',
      appliesTo: override.appliesTo,
      specificDatesStart,
      specificDatesEnd,
      priority: override.priority,
      isActive: override.isActive,
      effectiveFrom: override.effectiveFrom ? override.effectiveFrom.split('T')[0] : '',
      effectiveTo: override.effectiveTo ? override.effectiveTo.split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  // ============================================
  // CRUD
  // ============================================
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Override name is required');
      return;
    }
    if (!formData.channelCode) {
      toast.error('Channel is required');
      return;
    }

    setSaving(true);
    try {
      let specificDates: string | null = null;
      if (formData.appliesTo === 'specific_dates' && formData.specificDatesStart && formData.specificDatesEnd) {
        specificDates = JSON.stringify([{ start: formData.specificDatesStart, end: formData.specificDatesEnd }]);
      }

      const payload = {
        tenantId: 'current',
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        channelCode: formData.channelCode,
        connectionId: formData.connectionId || null,
        roomTypeId: formData.roomTypeId || null,
        ratePlanId: formData.ratePlanId || null,
        overrideType: formData.overrideType,
        overrideValue: parseFloat(String(formData.overrideValue)) || 0,
        currency: formData.currency,
        minRate: formData.minRate ? parseFloat(formData.minRate) : null,
        maxRate: formData.maxRate ? parseFloat(formData.maxRate) : null,
        appliesTo: formData.appliesTo,
        specificDates,
        priority: formData.priority,
        isActive: formData.isActive,
        effectiveFrom: formData.effectiveFrom || null,
        effectiveTo: formData.effectiveTo || null,
      };

      const url = '/api/channels/rate-overrides';
      const method = editingOverride ? 'PUT' : 'POST';
      const body = editingOverride ? { id: editingOverride.id, ...payload } : payload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editingOverride ? 'Override updated' : 'Override created');
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to save override');
      }
    } catch {
      toast.error('Network error saving override');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingOverride) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/channels/rate-overrides', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingOverride.id }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Override deleted');
        setDeleteDialogOpen(false);
        setDeletingOverride(null);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to delete override');
      }
    } catch {
      toast.error('Network error deleting override');
    } finally {
      setDeleting(false);
    }
  };

  // ============================================
  // CALCULATOR
  // ============================================
  const handleCalculate = async () => {
    if (!calcConnectionId) {
      toast.error('Select a channel connection');
      return;
    }
    const baseRate = parseFloat(calcBaseRate);
    if (!baseRate || baseRate < 0) {
      toast.error('Enter a valid base rate');
      return;
    }

    setCalcLoading(true);
    setCalcResult(null);
    try {
      const res = await fetch('/api/channels/rate-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calculate',
          baseRate,
          connectionId: calcConnectionId,
          date: calcDate,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setCalcResult(data.data);
      } else {
        toast.error(data.error?.message || 'Calculation failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCalcLoading(false);
    }
  };

  // ============================================
  // FILTERED DATA
  // ============================================
  const filteredOverrides = overrides.filter(o => {
    if (filterConnection !== 'all' && o.connectionId !== filterConnection) return false;
    if (filterChannel !== 'all' && o.channelCode !== filterChannel) return false;
    if (filterRoomType !== 'all' && o.roomTypeId !== filterRoomType) return false;
    if (filterStatus === 'active' && !o.isActive) return false;
    if (filterStatus === 'inactive' && o.isActive) return false;
    return true;
  });

  // ============================================
  // RENDER HELPERS
  // ============================================
  const getOverrideTypeIcon = (type: string) => {
    switch (type) {
      case 'percentage': return <Percent className="h-4 w-4" />;
      case 'fixed_amount': return <DollarSign className="h-4 w-4" />;
      case 'set_to': return <Equal className="h-4 w-4" />;
      default: return <Calculator className="h-4 w-4" />;
    }
  };

  const getOverrideTypeBadge = (type: string, value: number) => {
    let display = '';
    let colorClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-400 border-0';

    switch (type) {
      case 'percentage':
        display = `${value >= 0 ? '+' : ''}${value}%`;
        colorClass = value < 0
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0'
          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0';
        break;
      case 'fixed_amount':
        display = `${value >= 0 ? '+' : ''}$${value.toFixed(2)}`;
        colorClass = value < 0
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0'
          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0';
        break;
      case 'set_to':
        display = `→ $${value.toFixed(2)}`;
        colorClass = 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-0';
        break;
    }

    return <Badge className={`${colorClass} gap-1 text-xs`}>{display}</Badge>;
  };

  const getOverrideTypeColor = (type: string) => {
    switch (type) {
      case 'percentage': return 'text-blue-600 dark:text-blue-400';
      case 'fixed_amount': return 'text-amber-600 dark:text-amber-400';
      case 'set_to': return 'text-violet-600 dark:text-violet-400';
      default: return 'text-muted-foreground';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Stats
  const totalOverrides = overrides.length;
  const activeOverrides = overrides.filter(o => o.isActive).length;
  const percentageCount = overrides.filter(o => o.overrideType === 'percentage').length;
  const fixedCount = overrides.filter(o => o.overrideType === 'fixed_amount').length;
  const setToCount = overrides.filter(o => o.overrideType === 'set_to').length;

  // ============================================
  // LOADING
  // ============================================
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-72 rounded" />
            <Skeleton className="h-4 w-96 mt-2 rounded" />
          </div>
          <Skeleton className="h-10 w-32 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-32 rounded-lg" />
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
            <Calculator className="h-6 w-6 text-primary" />
            Channel Rate Overrides
          </h1>
          <p className="text-muted-foreground mt-1">
            Set rule-based rate adjustments per channel on top of your base rates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Override
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{totalOverrides}</p>
                <p className="text-xs text-muted-foreground">Total Overrides</p>
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
                  {activeOverrides}
                </p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Percent className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                  {percentageCount}
                </p>
                <p className="text-xs text-muted-foreground">Percentage</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <CircleDollarSign className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-700 dark:text-violet-400 tabular-nums">
                  {fixedCount + setToCount}
                </p>
                <p className="text-xs text-muted-foreground">Fixed / Set To</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rate Override Calculator */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Rate Override Calculator
          </CardTitle>
          <CardDescription className="text-xs">
            Enter a base rate and select a channel to see the overridden rate with breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Base Rate
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="number"
                  value={calcBaseRate}
                  onChange={(e) => setCalcBaseRate(e.target.value)}
                  className="pl-9"
                  placeholder="150.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="space-y-2 flex-1 min-w-0">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Channel Connection
              </Label>
              <Select value={calcConnectionId} onValueChange={setCalcConnectionId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a channel" />
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

            <div className="space-y-2 min-w-[160px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Date
              </Label>
              <Input
                type="date"
                value={calcDate}
                onChange={(e) => setCalcDate(e.target.value)}
              />
            </div>

            <Button
              onClick={handleCalculate}
              disabled={calcLoading || !calcConnectionId || !calcBaseRate}
              className="gap-2"
            >
              {calcLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              Calculate
            </Button>
          </div>

          {/* Calculator Result */}
          {calcResult && (
            <div className="mt-4 p-4 rounded-lg border bg-muted/30 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Base Rate</p>
                  <p className="text-lg font-bold tabular-nums">${calcResult.baseRate.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Final Rate</p>
                  <div className="flex items-center gap-2">
                    <p className={`text-lg font-bold tabular-nums ${calcResult.difference < 0 ? 'text-red-600 dark:text-red-400' : calcResult.difference > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                      ${calcResult.finalRate.toFixed(2)}
                    </p>
                    {calcResult.difference !== 0 && (
                      calcResult.difference < 0
                        ? <TrendingDown className="h-4 w-4 text-red-500" />
                        : <TrendingUp className="h-4 w-4 text-emerald-500" />
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Difference</p>
                  <p className={`text-sm font-semibold tabular-nums ${calcResult.difference < 0 ? 'text-red-600 dark:text-red-400' : calcResult.difference > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                    {calcResult.difference >= 0 ? '+' : ''}{calcResult.difference.toFixed(2)} ({calcResult.differencePercent >= 0 ? '+' : ''}{calcResult.differencePercent}%)
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Overrides Applied</p>
                  <p className="text-sm font-semibold tabular-nums">{calcResult.overridesApplied}</p>
                </div>
              </div>

              {/* Breakdown */}
              {calcResult.breakdown.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Breakdown</p>
                  {calcResult.breakdown.map((step, i) => (
                    <div key={step.overrideId} className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-2 min-w-[140px]">
                        {getOverrideTypeIcon(step.overrideType)}
                        <span className="truncate font-medium">{step.overrideName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground tabular-nums">${step.rateBefore.toFixed(2)}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-semibold tabular-nums">${step.rateAfter.toFixed(2)}</span>
                      </div>
                      {step.rateBefore !== step.rateAfter && (
                        <Badge variant="outline" className="text-[10px]">
                          {step.overrideType === 'percentage' ? `${step.overrideValue}%` : step.overrideType === 'fixed_amount' ? `$${step.overrideValue}` : 'set'}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Channel
              </Label>
              <Select value={filterChannel} onValueChange={setFilterChannel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  {CHANNEL_OPTIONS.map(ch => (
                    <SelectItem key={ch.value} value={ch.value}>{ch.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 flex-1 min-w-0">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Connection
              </Label>
              <Select value={filterConnection} onValueChange={setFilterConnection}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All connections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Connections</SelectItem>
                  {connections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.displayName || conn.channel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 flex-1 min-w-0">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Room Type
              </Label>
              <Select value={filterRoomType} onValueChange={setFilterRoomType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All room types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Room Types</SelectItem>
                  {roomTypes.map((rt) => (
                    <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-[120px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full">
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
              {filteredOverrides.length} of {overrides.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overrides Table */}
      {filteredOverrides.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Name</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Room Type</TableHead>
                    <TableHead>Rate Plan</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Applies To</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOverrides.map((override) => (
                    <TableRow key={override.id} className={!override.isActive ? 'opacity-60' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[160px]">{override.name}</p>
                          {override.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[160px]">{override.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {override.channelCode.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {override.roomTypeName ? (
                          <span className="text-xs">{override.roomTypeName}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">All</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {override.ratePlanName ? (
                          <span className="text-xs">{override.ratePlanName}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">All</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1.5 text-xs font-medium capitalize ${getOverrideTypeColor(override.overrideType)}`}>
                          {getOverrideTypeIcon(override.overrideType)}
                          <span className="hidden sm:inline">{override.overrideType.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getOverrideTypeBadge(override.overrideType, override.overrideValue)}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{APPLIES_TO_LABELS[override.appliesTo] || override.appliesTo}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold tabular-nums">{override.priority}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            override.isActive
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400 border-0'
                          }
                        >
                          {override.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(override)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingOverride(override);
                              setDeleteDialogOpen(true);
                            }}
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
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Search className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Overrides Found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              {overrides.length > 0
                ? 'No overrides match the current filters. Try adjusting your criteria.'
                : 'Create your first rate override to set channel-specific price adjustments on top of base rates.'}
            </p>
            {overrides.length === 0 && (
              <Button onClick={openCreateDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create First Override
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">How Rate Overrides Work</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>Percentage:</strong> Add/subtract a percentage from the rate (e.g., Expedia gets -5% on BAR rates)</li>
                <li><strong>Fixed Amount:</strong> Add/subtract a fixed dollar amount (e.g., Airbnb gets +$10 on weekend rates)</li>
                <li><strong>Set To:</strong> Override the rate to a specific flat amount (e.g., suites set to $250 on Airbnb)</li>
              </ul>
              <p className="text-xs">
                Overrides are applied in priority order (highest first). Min/Max constraints are always enforced.
                Rate overrides are different from derivation rules — overrides are direct price adjustments applied on top of the base rate for a specific channel.
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
              {editingOverride ? 'Edit Rate Override' : 'Create Rate Override'}
            </DialogTitle>
            <DialogDescription>
              {editingOverride
                ? 'Modify the channel rate override configuration'
                : 'Define a rate adjustment rule that will be applied on top of base rates for a specific channel'}
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
                <Label>Override Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Expedia -5% on BAR rates"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description..."
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* Channel & Scope */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Channel & Scope
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel *</Label>
                  <Select
                    value={formData.channelCode}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, channelCode: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNEL_OPTIONS.map(ch => (
                        <SelectItem key={ch.value} value={ch.value}>{ch.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Connection</Label>
                  <Select
                    value={formData.connectionId}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, connectionId: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All connections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">All Connections</SelectItem>
                      {connections
                        .filter(c => !formData.channelCode || c.channel === formData.channelCode)
                        .map((conn) => (
                          <SelectItem key={conn.id} value={conn.id}>
                            {conn.displayName || conn.channel}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Room Type</Label>
                  <Select
                    value={formData.roomTypeId}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, roomTypeId: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All room types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">All Room Types</SelectItem>
                      {roomTypes.map((rt) => (
                        <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rate Plan</Label>
                  <Select
                    value={formData.ratePlanId}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, ratePlanId: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All rate plans" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">All Rate Plans</SelectItem>
                      {ratePlans.map((rp) => (
                        <SelectItem key={rp.id} value={rp.id}>{rp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Override Logic */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Override Logic
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Override Type</Label>
                  <Select
                    value={formData.overrideType}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, overrideType: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(OVERRIDE_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {OVERRIDE_TYPE_DESCRIPTIONS[formData.overrideType]}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Override Value *</Label>
                  <div className="relative">
                    {formData.overrideType === 'fixed_amount' || formData.overrideType === 'set_to' ? (
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    ) : null}
                    <Input
                      type="number"
                      value={formData.overrideValue}
                      onChange={(e) => setFormData(prev => ({ ...prev, overrideValue: parseFloat(e.target.value) || 0 }))}
                      placeholder={formData.overrideType === 'percentage' ? '-5' : '10.00'}
                      step="0.01"
                      className={formData.overrideType !== 'percentage' ? 'pl-9' : ''}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formData.overrideType === 'percentage'
                      ? 'Positive to increase, negative to decrease'
                      : formData.overrideType === 'fixed_amount'
                        ? 'Positive to add, negative to subtract'
                        : 'The flat rate to set'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Rate (floor)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="number"
                      value={formData.minRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, minRate: e.target.value }))}
                      placeholder="50.00"
                      step="0.01"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Max Rate (ceiling)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="number"
                      value={formData.maxRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxRate: e.target.value }))}
                      placeholder="500.00"
                      step="0.01"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Schedule & Priority */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Schedule & Priority
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Applies To</Label>
                  <Select
                    value={formData.appliesTo}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, appliesTo: val }))}
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

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground">Higher priority overrides are applied first</p>
                </div>
              </div>

              {formData.appliesTo === 'specific_dates' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={formData.specificDatesStart}
                      onChange={(e) => setFormData(prev => ({ ...prev, specificDatesStart: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={formData.specificDatesEnd}
                      onChange={(e) => setFormData(prev => ({ ...prev, specificDatesEnd: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Effective From</Label>
                  <Input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData(prev => ({ ...prev, effectiveFrom: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Effective To</Label>
                  <Input
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData(prev => ({ ...prev, effectiveTo: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
                <Label className="text-sm">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {editingOverride ? 'Update Override' : 'Create Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rate Override</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingOverride?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ChannelRateOverrides;
