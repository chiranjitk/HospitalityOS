'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Settings,
  Plus,
  Search,
  Loader2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
  Clock,
  DollarSign,
  Pencil,
  Smartphone,
  Gauge,
  Trash2,
  Star,
  RefreshCw,
  Wifi,
  Zap,
  ShieldCheck,
  MonitorSmartphone,
  CheckCircle2,
  XCircle,
  Crown,
  Info,
  Globe,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { usePropertyId } from '@/hooks/use-property';

interface PlanPool {
  id: string;
  poolId: string;
  priority: number;
  pool: {
    id: string;
    name: string;
  };
}

interface WiFiPlan {
  id: string;
  name: string;
  description: string | null;
  downloadSpeed: number;
  uploadSpeed: number;
  burstDownloadSpeed: number | null;
  burstUploadSpeed: number | null;
  dataLimit: number | null;
  sessionLimit: number | null;
  maxDevices: number;
  fupPolicyId: string | null;
  fupPolicyName?: string;
  sessionTimeoutSec: number | null;
  idleTimeoutSec: number | null;
  price: number;
  currency: string;
  priority: number;
  validityDays: number;
  validityMinutes: number;
  status: string;
  ipPoolId?: string | null;
  ipPool?: { id: string; name: string } | null;
  planPools?: PlanPool[];
  _count?: {
    vouchers: number;
    sessions: number;
  };
}

const planStatuses = [
  { value: 'active', label: 'Active', color: 'bg-emerald-500' },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-400' },
];

// Premium gradient presets for plan tiers based on speed
const getPlanTier = (downloadSpeed: number) => {
  if (downloadSpeed >= 100) return { label: 'Ultra', gradient: 'from-rose-500 via-pink-500 to-amber-500', accent: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800/50', glow: 'shadow-rose-500/10' };
  if (downloadSpeed >= 50) return { label: 'Premium', gradient: 'from-amber-500 via-orange-500 to-rose-500', accent: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800/50', glow: 'shadow-amber-500/10' };
  if (downloadSpeed >= 20) return { label: 'Pro', gradient: 'from-primary via-primary/80 to-primary/60', accent: 'text-primary', bg: 'bg-primary/5 dark:bg-primary/5', border: 'border-primary/20 dark:border-primary/20', glow: 'shadow-primary/10' };
  return { label: 'Basic', gradient: 'from-slate-400 via-slate-500 to-slate-600', accent: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-950/30', border: 'border-slate-200 dark:border-slate-800/50', glow: 'shadow-slate-500/10' };
};

const currencies = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'INR', label: 'INR (₹)' },
];

const formatDataSize = (mb: number | null | undefined): string => {
  if (!mb) return 'Unlimited';
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${mb} MB`;
};

const formatDuration = (minutes: number | null | undefined): string => {
  if (!minutes) return 'Unlimited';
  if (minutes >= 1440) return `${(minutes / 1440).toFixed(minutes % 1440 === 0 ? 0 : 1)} day${(minutes / 1440) >= 2 ? 's' : ''}`;
  if (minutes >= 60) return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} hr${(minutes / 60) >= 2 ? 's' : ''}`;
  return `${minutes} min`;
};

/** Convert a numeric value + unit (minutes|hours|days) to total minutes */
const calcValidityMinutes = (value: number, unit: string): number => {
  switch (unit) {
    case 'minutes': return value;
    case 'hours': return value * 60;
    case 'days': return value * 1440;
    default: return value * 1440;
  }
};

/** Convert a numeric value + unit (minutes|hours|days) to days (ceiling) */
const calcValidityDays = (value: number, unit: string): number => {
  const minutes = calcValidityMinutes(value, unit);
  return Math.max(1, Math.ceil(minutes / 1440));
};

/** Pick the best human-friendly unit for a given number of minutes */
const parseBestUnit = (totalMinutes: number): string => {
  if (totalMinutes >= 1440 && totalMinutes % 1440 === 0) return 'days';
  if (totalMinutes >= 60 && totalMinutes % 60 === 0) return 'hours';
  return 'minutes';
};

/** Convert total minutes back to a display value for the chosen unit */
const convertMinutesToDisplay = (totalMinutes: number, unit: string): number => {
  switch (unit) {
    case 'days': return totalMinutes / 1440;
    case 'hours': return totalMinutes / 60;
    default: return totalMinutes;
  }
};

/** Format seconds into a human-readable duration string */
const formatSeconds = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days > 0) return days > 1 ? `${days} days` : `${days} day`;
  if (hours > 0) return hours > 1 ? `${hours} hours` : `${hours} hour`;
  if (minutes > 0) return minutes > 1 ? `${minutes} min` : `${minutes} min`;
  return `${secs}s`;
};

export default function WifiPlans() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [plans, setPlans] = useState<WiFiPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [summary, setSummary] = useState({
    totalPlans: 0,
    activePlans: 0,
    avgPrice: 0,
    totalUsers: 0,
  });

  const [fupPolicies, setFupPolicies] = useState<Array<{ id: string; name: string }>>([]);
  const [ipPools, setIpPools] = useState<Array<{ id: string; name: string; isDefault: boolean }>>([]);
  const [selectedPoolIds, setSelectedPoolIds] = useState<string[]>([]);
  const [defaultPlanId, setDefaultPlanId] = useState<string | null>(null);
  const { propertyId } = usePropertyId();

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<WiFiPlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    downloadSpeed: '10',
    uploadSpeed: '5',
    burstDownloadSpeed: '',
    burstUploadSpeed: '',
    dataLimit: '',
    sessionLimit: '',
    maxDevices: '1',
    fupPolicyId: '',
    price: '0',
    currency: 'USD',
    priority: '0',
    validityValue: '1',
    validityUnit: 'days',
    status: 'active',
    sessionTimeout: '',
    idleTimeout: '',
    unlimitedData: true,
    unlimitedSession: true,
  });

  // Fetch plans
  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const [planRes, fupRes, poolRes] = await Promise.all([
        fetch(`/api/wifi/plans?${params.toString()}`),
        fetch('/api/wifi/radius?action=fap-policies-list'),
        fetch('/api/wifi/ip-pools'),
      ]);
      const result = await planRes.json();
      const fupResult = await fupRes.json();

      if (fupResult.success && Array.isArray(fupResult.data)) {
        setFupPolicies(fupResult.data.map((p: { id: string; name: string; isEnabled: boolean }) => ({
          id: p.id,
          name: `${p.name}${p.isEnabled ? '' : ' (disabled)'}`
        })));
      }
      if (poolRes.ok) {
        const poolResult = await poolRes.json();
        if (poolResult.success && Array.isArray(poolResult.data)) {
          setIpPools(poolResult.data.map((p: { id: string; name: string; isDefault: boolean }) => ({
            id: p.id,
            name: `${p.name}${p.isDefault ? ' (default)' : ''}`
          })));
        }
      }

      if (result.success) {
        setPlans(result.data);
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch WiFi plans',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch default plan ID from AAA config
  useEffect(() => {
    if (!propertyId) return;
    fetch(`/api/wifi/aaa?propertyId=${propertyId}`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data?.defaultPlanId) {
          setDefaultPlanId(result.data.defaultPlanId);
        }
      })
      .catch(() => {});
  }, [propertyId]);

  useEffect(() => {
    fetchPlans();
  }, [statusFilter]);

  const isInitialMount = useRef(true);

  // Debounced search
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchPlans();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Create plan
  const handleCreate = async () => {
    if (!formData.name || !formData.downloadSpeed || !formData.uploadSpeed) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/wifi/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          downloadSpeed: parseInt(formData.downloadSpeed),
          uploadSpeed: parseInt(formData.uploadSpeed),
          burstDownloadSpeed: formData.burstDownloadSpeed ? parseInt(formData.burstDownloadSpeed) : null,
          burstUploadSpeed: formData.burstUploadSpeed ? parseInt(formData.burstUploadSpeed) : null,
          dataLimit: formData.unlimitedData ? null : (formData.dataLimit ? parseInt(formData.dataLimit) : null),
          sessionLimit: formData.unlimitedSession ? null : (formData.sessionLimit ? parseInt(formData.sessionLimit) : null),
          maxDevices: parseInt(formData.maxDevices),
          fupPolicyId: formData.fupPolicyId && formData.fupPolicyId !== 'none' ? formData.fupPolicyId : undefined,
          ipPoolIds: selectedPoolIds.length > 0
            ? selectedPoolIds.map((poolId, index) => ({ poolId, priority: index }))
            : undefined,
          price: parseFloat(formData.price),
          currency: formData.currency,
          priority: parseInt(formData.priority),
          validityDays: calcValidityDays(parseInt(formData.validityValue) || 1, formData.validityUnit),
          validityMinutes: calcValidityMinutes(parseInt(formData.validityValue) || 1, formData.validityUnit),
          sessionTimeoutSec: formData.sessionTimeout ? parseInt(formData.sessionTimeout) : null,
          idleTimeoutSec: formData.idleTimeout ? parseInt(formData.idleTimeout) : null,
          status: formData.status,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'WiFi plan created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchPlans();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to create plan',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update plan
  const handleUpdate = async () => {
    if (!selectedPlan) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/wifi/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPlan.id,
          name: formData.name,
          description: formData.description || null,
          downloadSpeed: parseInt(formData.downloadSpeed),
          uploadSpeed: parseInt(formData.uploadSpeed),
          burstDownloadSpeed: formData.burstDownloadSpeed ? parseInt(formData.burstDownloadSpeed) : null,
          burstUploadSpeed: formData.burstUploadSpeed ? parseInt(formData.burstUploadSpeed) : null,
          dataLimit: formData.unlimitedData ? null : (formData.dataLimit ? parseInt(formData.dataLimit) : null),
          sessionLimit: formData.unlimitedSession ? null : (formData.sessionLimit ? parseInt(formData.sessionLimit) : null),
          maxDevices: parseInt(formData.maxDevices),
          fupPolicyId: formData.fupPolicyId && formData.fupPolicyId !== 'none' ? formData.fupPolicyId : null,
          ipPoolIds: selectedPoolIds.length > 0
            ? selectedPoolIds.map((poolId, index) => ({ poolId, priority: index }))
            : [],
          price: parseFloat(formData.price),
          currency: formData.currency,
          priority: parseInt(formData.priority),
          validityDays: calcValidityDays(parseInt(formData.validityValue) || 1, formData.validityUnit),
          validityMinutes: calcValidityMinutes(parseInt(formData.validityValue) || 1, formData.validityUnit),
          sessionTimeoutSec: formData.sessionTimeout ? parseInt(formData.sessionTimeout) : null,
          idleTimeoutSec: formData.idleTimeout ? parseInt(formData.idleTimeout) : null,
          status: formData.status,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'WiFi plan updated successfully',
        });
        setIsEditOpen(false);
        setSelectedPlan(null);
        fetchPlans();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to update plan',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete plan
  const handleDelete = async () => {
    if (!selectedPlan) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/wifi/plans?id=${selectedPlan.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message || 'WiFi plan deleted successfully',
        });
        setIsDeleteOpen(false);
        setSelectedPlan(null);
        fetchPlans();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete plan',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (plan: WiFiPlan) => {
    setSelectedPlan(plan);
    const unit = parseBestUnit(plan.validityMinutes || plan.validityDays * 1440);
    // Populate multi-pool selections: prefer planPools (junction), fallback to legacy ipPoolId
    const poolIds = plan.planPools && plan.planPools.length > 0
      ? plan.planPools.sort((a, b) => a.priority - b.priority).map(pp => pp.poolId)
      : plan.ipPoolId
        ? [plan.ipPoolId]
        : [];
    setSelectedPoolIds(poolIds);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      downloadSpeed: plan.downloadSpeed.toString(),
      uploadSpeed: plan.uploadSpeed.toString(),
      burstDownloadSpeed: plan.burstDownloadSpeed?.toString() || '',
      burstUploadSpeed: plan.burstUploadSpeed?.toString() || '',
      dataLimit: plan.dataLimit?.toString() || '',
      sessionLimit: plan.sessionLimit?.toString() || '',
      maxDevices: (plan.maxDevices ?? 1).toString(),
      fupPolicyId: plan.fupPolicyId?.toString() || '',
      price: plan.price.toString(),
      currency: plan.currency,
      priority: plan.priority.toString(),
      validityValue: convertMinutesToDisplay(plan.validityMinutes || plan.validityDays * 1440, unit).toString(),
      validityUnit: unit,
      status: plan.status,
      sessionTimeout: plan.sessionTimeoutSec?.toString() || '',
      idleTimeout: plan.idleTimeoutSec?.toString() || '',
      unlimitedData: !plan.dataLimit,
      unlimitedSession: !plan.sessionLimit,
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (plan: WiFiPlan) => {
    setSelectedPlan(plan);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      downloadSpeed: '10',
      uploadSpeed: '5',
      burstDownloadSpeed: '',
      burstUploadSpeed: '',
      dataLimit: '',
      sessionLimit: '',
      maxDevices: '1',
      fupPolicyId: '',
      price: '0',
      currency: 'USD',
      priority: '0',
      validityValue: '1',
      validityUnit: 'days',
      status: 'active',
      sessionTimeout: '',
      idleTimeout: '',
      unlimitedData: true,
      unlimitedSession: true,
    });
    setSelectedPoolIds([]);
  };

  const getStatusBadge = (status: string) => {
    const option = planStatuses.find(o => o.value === status);
    return (
      <Badge variant="secondary" className={cn('text-white', option?.color)}>
        {option?.label || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            WiFi Access Plans
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure premium WiFi service plans and guest connectivity
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPlans}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Plan
          </Button>
        </div>
      </div>

      {/* Stats — Premium stat cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-primary/5" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 shadow-sm">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight">{summary.totalPlans}</div>
              <div className="text-xs text-muted-foreground font-medium">Total Plans</div>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-primary/5" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 shadow-sm">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight">{summary.activePlans}</div>
              <div className="text-xs text-muted-foreground font-medium">Active Plans</div>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-amber-500/5" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm">
              <Smartphone className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight">{summary.totalUsers}</div>
              <div className="text-xs text-muted-foreground font-medium">Total Users</div>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-primary/5" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 shadow-sm">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight">{formatCurrency(summary.avgPrice)}</div>
              <div className="text-xs text-muted-foreground font-medium">Avg Price</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search plans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm bg-background"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-32 h-8 text-sm bg-background">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {planStatuses.map(status => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Plans Grid — Premium cards */}
      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-48" />
              <div className="space-y-3 pt-2">
                <div className="flex gap-3">
                  <Skeleton className="h-2 flex-1 rounded-full" />
                  <Skeleton className="h-2 flex-1 rounded-full" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Wifi}
          title="No WiFi plans found"
          description="Create your first service plan to start offering WiFi connectivity to your guests"
          action={{ label: 'Create Plan', onClick: () => { resetForm(); setIsCreateOpen(true); } }}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const tier = getPlanTier(plan.downloadSpeed);
            const isDefault = defaultPlanId === plan.id;
            const isFeatured = plan.priority > 0;
            const isFree = plan.price === 0;
            const maxSpeed = 200; // reference max for progress bars
            const dlPct = Math.min((plan.downloadSpeed / maxSpeed) * 100, 100);
            const ulPct = Math.min((plan.uploadSpeed / maxSpeed) * 100, 100);

            return (
              <div
                key={plan.id}
                className={cn(
                  'group relative overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:-translate-y-1',
                  plan.status === 'inactive'
                    ? 'opacity-50 grayscale-[30%]'
                    : 'hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20',
                  isFeatured && plan.status === 'active' && 'ring-1 ring-amber-400/40 dark:ring-amber-500/30 hover:shadow-amber-500/5',
                  isDefault && plan.status === 'active' && !isFeatured && 'ring-1 ring-primary/40 dark:ring-primary/30 hover:shadow-primary/5',
                )}
              >
                {/* Top gradient accent bar */}
                <div className={cn(
                  'h-1 w-full bg-gradient-to-r',
                  plan.status === 'active' ? tier.gradient : 'from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700'
                )} />

                {/* Card content */}
                <div className="p-5 space-y-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base tracking-tight">{plan.name}</h3>
                        {isFeatured && plan.status === 'active' && (
                          <span className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                            'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                          )}>
                            <Crown className="h-3 w-3" />
                            Featured
                          </span>
                        )}
                        {isDefault && !isFeatured && plan.status === 'active' && (
                          <span className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                            'bg-gradient-to-r from-primary to-primary/70 text-primary-foreground shadow-sm'
                          )}>
                            <ShieldCheck className="h-3 w-3" />
                            Default
                          </span>
                        )}
                        {isDefault && isFeatured && plan.status === 'active' && (
                          <span className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                            'bg-gradient-to-r from-primary to-primary/70 text-primary-foreground shadow-sm'
                          )}>
                            <ShieldCheck className="h-3 w-3" />
                            Default
                          </span>
                        )}
                      </div>
                      {plan.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{plan.description}</p>
                      )}
                    </div>
                    {getStatusBadge(plan.status)}
                  </div>

                  {/* Tier badge */}
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      tier.bg, tier.accent
                    )}>
                      <Zap className="h-3 w-3" />
                      {tier.label} Tier
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDuration(plan.validityMinutes)} validity
                    </span>
                  </div>

                  {/* Speed visualization */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-medium">
                        <ArrowDownToLine className="h-3.5 w-3.5 text-primary" />
                        Download
                      </div>
                      <span className="font-bold text-primary">{plan.downloadSpeed} Mbps{plan.burstDownloadSpeed ? ` → ${plan.burstDownloadSpeed} burst` : ''}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-primary/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700 ease-out"
                        style={{ width: `${dlPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-medium">
                        <ArrowUpFromLine className="h-3.5 w-3.5 text-amber-500" />
                        Upload
                      </div>
                      <span className="font-bold text-amber-600 dark:text-amber-400">{plan.uploadSpeed} Mbps{plan.burstUploadSpeed ? ` → ${plan.burstUploadSpeed} burst` : ''}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-amber-500/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-700 ease-out"
                        style={{ width: `${ulPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Specs grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Database className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{formatDataSize(plan.dataLimit)}</span>
                    </div>
                    {plan.sessionLimit ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{formatDuration(plan.sessionLimit)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Unlimited</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MonitorSmartphone className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{plan.maxDevices ?? 1} device{(plan.maxDevices ?? 1) > 1 ? 's' : ''}</span>
                    </div>
                    {(plan as Record<string, unknown>).fupPolicy ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Gauge className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{(plan as Record<string, unknown>).fupPolicy?.name || 'FUP'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Gauge className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">No FUP</span>
                      </div>
                    )}
                    {plan.idleTimeoutSec ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                        <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Idle: {formatSeconds(plan.idleTimeoutSec)}</span>
                        {plan.sessionTimeoutSec ? (
                          <span className="truncate"> · Session: {formatSeconds(plan.sessionTimeoutSec)}</span>
                        ) : null}
                      </div>
                    ) : plan.sessionTimeoutSec ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Session: {formatSeconds(plan.sessionTimeoutSec)}</span>
                      </div>
                    ) : null}
                    {/* Multi-pool assignment display */}
                    {plan.planPools && plan.planPools.length > 0 ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground col-span-2 flex-wrap">
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Pools:</span>
                        <div className="flex flex-wrap gap-1">
                          {plan.planPools
                            .sort((a, b) => a.priority - b.priority)
                            .map(pp => (
                              <Badge key={pp.poolId} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                {pp.pool.name}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    ) : (plan as Record<string, unknown>).ipPool?.name ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Pool: {(plan as Record<string, unknown>).ipPool?.name as string}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Any pool</span>
                      </div>
                    )}
                  </div>

                  {/* Price + Stats divider */}
                  <div className="flex items-center justify-between pt-3 border-t border-dashed">
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{plan._count?.vouchers || 0} vouchers</span>
                      <span className="w-px h-3 bg-border" />
                      <span>{plan._count?.sessions || 0} sessions</span>
                    </div>
                    <div className={cn(
                      'text-right',
                      isFree ? 'text-primary' : ''
                    )}>
                      {isFree ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-bold">Free</span>
                        </div>
                      ) : (
                        <div>
                          <div className="text-lg font-bold tracking-tight">{formatCurrency(plan.price)}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs rounded-lg transition-colors"
                      onClick={() => openEditDialog(plan)}
                    >
                      <Pencil className="h-3 w-3 mr-1.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-red-600 hover:border-red-200 dark:hover:text-red-400 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      onClick={() => openDeleteDialog(plan)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setIsEditOpen(false);
          setSelectedPlan(null);
        }
      }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditOpen ? 'Edit WiFi Plan' : 'Create WiFi Plan'}</DialogTitle>
            <DialogDescription>
              {isEditOpen ? 'Update the WiFi plan details' : 'Configure a new WiFi service plan'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Plan Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Premium WiFi"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Plan description..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="downloadSpeed">Download Speed (Mbps) *</Label>
                <Input
                  id="downloadSpeed"
                  type="number"
                  min="1"
                  value={formData.downloadSpeed}
                  onChange={(e) => setFormData(prev => ({ ...prev, downloadSpeed: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uploadSpeed">Upload Speed (Mbps) *</Label>
                <Input
                  id="uploadSpeed"
                  type="number"
                  min="1"
                  value={formData.uploadSpeed}
                  onChange={(e) => setFormData(prev => ({ ...prev, uploadSpeed: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="burstDownloadSpeed" className="flex items-center gap-1.5">
                  Burst Download (Mbps)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Max ceil rate user can burst to when spare pool capacity exists. Leave empty for no burst (ceil = rate).</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="burstDownloadSpeed"
                  type="number"
                  min="0"
                  placeholder="e.g., 15 (leave empty for no burst)"
                  value={formData.burstDownloadSpeed}
                  onChange={(e) => setFormData(prev => ({ ...prev, burstDownloadSpeed: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="burstUploadSpeed" className="flex items-center gap-1.5">
                  Burst Upload (Mbps)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Max ceil rate user can burst to when spare pool capacity exists. Leave empty for no burst (ceil = rate).</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="burstUploadSpeed"
                  type="number"
                  min="0"
                  placeholder="e.g., 10 (leave empty for no burst)"
                  value={formData.burstUploadSpeed}
                  onChange={(e) => setFormData(prev => ({ ...prev, burstUploadSpeed: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dataLimit">Data Limit (MB)</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.unlimitedData}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, unlimitedData: checked }))}
                    />
                    <span className="text-xs text-muted-foreground">Unlimited</span>
                  </div>
                </div>
                <Input
                  id="dataLimit"
                  type="number"
                  min="0"
                  placeholder="e.g., 1024"
                  value={formData.dataLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, dataLimit: e.target.value }))}
                  disabled={formData.unlimitedData}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sessionLimit">Session Limit (min)</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.unlimitedSession}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, unlimitedSession: checked }))}
                    />
                    <span className="text-xs text-muted-foreground">Unlimited</span>
                  </div>
                </div>
                <Input
                  id="sessionLimit"
                  type="number"
                  min="0"
                  placeholder="e.g., 60"
                  value={formData.sessionLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, sessionLimit: e.target.value }))}
                  disabled={formData.unlimitedSession}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxDevices">Max Devices</Label>
              <Input
                id="maxDevices"
                type="number"
                min="1"
                max="10"
                value={formData.maxDevices}
                onChange={(e) => setFormData(prev => ({ ...prev, maxDevices: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Maximum simultaneous devices per guest (1 = phone only, 2 = phone + laptop)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fupPolicyId">FUP Policy</Label>
              <Select value={formData.fupPolicyId} onValueChange={(v) => setFormData(prev => ({ ...prev, fupPolicyId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="None (no data cap)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (no data cap)</SelectItem>
                  {fupPolicies.map(fp => (
                    <SelectItem key={fp.id} value={fp.id}>{fp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Apply Fair Usage Policy to throttle/block after data limit
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <Label>IP Pool Assignment</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Select one or more IP pools for this plan. Users on this plan will only be able to connect from these pools. Order determines priority (top = highest). If none selected, any enabled pool is allowed.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {ipPools.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No IP pools configured. Create pools in IP Pool management first.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-md border bg-background p-2">
                  {ipPools.map(pool => {
                    const isSelected = selectedPoolIds.includes(pool.id);
                    const priority = selectedPoolIds.indexOf(pool.id);
                    return (
                      <div
                        key={pool.id}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2.5 py-2 cursor-pointer transition-colors text-sm',
                          isSelected
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'hover:bg-muted/50 border border-transparent'
                        )}
                        onClick={() => {
                          setSelectedPoolIds(prev => {
                            if (isSelected) {
                              return prev.filter(id => id !== pool.id);
                            }
                            return [...prev, pool.id];
                          });
                        }}
                      >
                        <div className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                        )}>
                          {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 font-medium">{pool.name}</span>
                        {isSelected && priority >= 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                            P{priority + 1}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedPoolIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPoolIds.map((poolId, idx) => {
                    const pool = ipPools.find(p => p.id === poolId);
                    return pool ? (
                      <Badge
                        key={poolId}
                        variant="outline"
                        className="text-[11px] gap-1 pr-1 cursor-grab"
                      >
                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-muted-foreground">#{idx + 1}</span>
                        {pool.name}
                        <button
                          type="button"
                          className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5 transition-colors"
                          onClick={() => setSelectedPoolIds(prev => prev.filter(id => id !== poolId))}
                        >
                          <XCircle className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {selectedPoolIds.length === 0
                  ? 'No pool restriction — users can connect from any enabled pool'
                  : `${selectedPoolIds.length} pool${selectedPoolIds.length > 1 ? 's' : ''} assigned. Priority order: ${selectedPoolIds.map((id, i) => {
                      const pool = ipPools.find(p => p.id === id);
                      return `${i + 1}:${pool?.name || 'unknown'}`;
                    }).join(' → ')}`}
              </p>
            </div>
            {/* Price & Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map(currency => (
                      <SelectItem key={currency.value} value={currency.value}>
                        {currency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Validity Period */}
            <div className="space-y-2">
              <Label>Validity Period</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={formData.validityValue}
                  onChange={(e) => setFormData(prev => ({ ...prev, validityValue: e.target.value }))}
                  className="w-20 shrink-0"
                  placeholder="1"
                />
                <Select value={formData.validityUnit} onValueChange={(v) => setFormData(prev => ({ ...prev, validityUnit: v }))}>
                  <SelectTrigger className="w-20 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="w-20">
                    <SelectItem value="minutes">Mins</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                = {formatDuration(calcValidityMinutes(parseInt(formData.validityValue) || 1, formData.validityUnit))} total
              </p>
            </div>
            {/* Session Timeout & Idle Timeout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="sessionTimeout">Session Timeout</Label>
                  <span className="text-[10px] text-muted-foreground font-normal">(seconds)</span>
                </div>
                <Input
                  id="sessionTimeout"
                  type="number"
                  min="0"
                  placeholder="e.g., 86400"
                  value={formData.sessionTimeout}
                  onChange={(e) => setFormData(prev => ({ ...prev, sessionTimeout: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground">
                  Max session duration. 0 or empty = no limit
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="idleTimeout">Idle Timeout</Label>
                  <span className="text-[10px] text-muted-foreground font-normal">(seconds)</span>
                </div>
                <Input
                  id="idleTimeout"
                  type="number"
                  min="0"
                  placeholder="e.g., 300"
                  value={formData.idleTimeout}
                  onChange={(e) => setFormData(prev => ({ ...prev, idleTimeout: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground">
                  Max inactivity. 0 or empty = no limit
                </p>
              </div>
            </div>
            {/* Priority & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  min="0"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Higher priority shows first</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {planStatuses.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setIsEditOpen(false);
              setSelectedPlan(null);
            }}>
              Cancel
            </Button>
            <Button onClick={isEditOpen ? handleUpdate : handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditOpen ? 'Update Plan' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete WiFi Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedPlan?.name}&quot;?
              {selectedPlan?._count && (selectedPlan._count.vouchers > 0 || selectedPlan._count.sessions > 0) && (
                <p className="mt-2 text-amber-600 dark:text-amber-400">
                  This plan has associated vouchers or sessions. It will be deactivated instead of deleted.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
