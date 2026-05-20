'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  ShieldAlert,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Calculator,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Filter,
  Search,
  Send,
  CreditCard,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface ChannelConnectionItem {
  id: string;
  channel: string;
  displayName: string | null;
  status: string;
}

interface CancellationPolicy {
  id: string;
  tenantId: string;
  propertyId: string | null;
  connectionId: string | null;
  channelCode: string;
  policyName: string;
  policyType: string;
  freeCancelBefore: number | null;
  penaltyType: string;
  penaltyValue: number;
  penaltyCurrency: string;
  noShowPolicy: boolean;
  noShowPenaltyType: string;
  noShowPenaltyValue: number;
  channelPolicyId: string | null;
  channelPolicyCode: string | null;
  syncEnabled: boolean;
  syncStatus: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  connection?: { id: string; channel: string; displayName: string | null; status: string } | null;
}

interface PenaltyResult {
  policyId: string;
  policyName: string;
  policyType: string;
  bookingAmount: number;
  penaltyAmount: number;
  refundAmount: number;
  isRefundable: boolean;
  isFreeCancellation: boolean;
  isNoShow: boolean;
  hoursUntilCheckIn: number;
  freeCancelBefore: number | null;
  penaltyDescription: string;
  penaltyCurrency: string;
  channelCode: string;
}

interface PolicyFormData {
  policyName: string;
  connectionId: string;
  channelCode: string;
  policyType: string;
  freeCancelBefore: string;
  penaltyType: string;
  penaltyValue: string;
  penaltyCurrency: string;
  noShowPolicy: boolean;
  noShowPenaltyType: string;
  noShowPenaltyValue: string;
  channelPolicyId: string;
  channelPolicyCode: string;
  syncEnabled: boolean;
  isActive: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const POLICY_TYPE_OPTIONS: Record<string, { label: string; description: string; color: string }> = {
  free_cancellation: { label: 'Free Cancellation', description: 'Guests can cancel without penalty before deadline', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0' },
  non_refundable: { label: 'Non-Refundable', description: 'No refund on cancellation', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0' },
  partial_refund: { label: 'Partial Refund', description: 'Partial refund based on penalty rules', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0' },
  flexible: { label: 'Flexible (Airbnb)', description: 'Free cancellation up to 24h before check-in', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-0' },
  moderate: { label: 'Moderate (Airbnb)', description: 'Free cancellation up to 5 days before check-in', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0' },
  strict: { label: 'Strict (Airbnb)', description: '50% refund up to 14 days before check-in', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-0' },
  super_strict: { label: 'Super Strict (Airbnb)', description: '50% refund up to 30 days before check-in', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500 border-0' },
  custom: { label: 'Custom', description: 'Fully customizable cancellation rules', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-400 border-0' },
};

const PENALTY_TYPE_LABELS: Record<string, string> = {
  percentage: 'Percentage (%)',
  fixed_amount: 'Fixed Amount',
  nights: 'Number of Nights',
};

// ============================================
// COMPONENT
// ============================================

export function ChannelCancellationPolicies() {
  // Data
  const [policies, setPolicies] = useState<CancellationPolicy[]>([]);
  const [connections, setConnections] = useState<ChannelConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Summary stats
  const [stats, setStats] = useState({ total: 0, active: 0, synced: 0, failed: 0, pending: 0 });

  // Filters
  const [filterConnection, setFilterConnection] = useState<string>('all');
  const [filterPolicyType, setFilterPolicyType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<CancellationPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPolicy, setDeletingPolicy] = useState<CancellationPolicy | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Penalty calculator
  const [calcPolicyId, setCalcPolicyId] = useState<string>('');
  const [calcBookingAmount, setCalcBookingAmount] = useState<string>('500');
  const [calcCheckInDate, setCalcCheckInDate] = useState<string>('');
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcResult, setCalcResult] = useState<PenaltyResult | null>(null);

  // Form data
  const emptyForm: PolicyFormData = {
    policyName: '',
    connectionId: '',
    channelCode: '',
    policyType: 'free_cancellation',
    freeCancelBefore: '',
    penaltyType: 'percentage',
    penaltyValue: '',
    penaltyCurrency: 'USD',
    noShowPolicy: true,
    noShowPenaltyType: 'nights',
    noShowPenaltyValue: '1',
    channelPolicyId: '',
    channelPolicyCode: '',
    syncEnabled: true,
    isActive: true,
  };
  const [formData, setFormData] = useState<PolicyFormData>(emptyForm);

  // ============================================
  // FETCH DATA
  // ============================================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [policiesRes, connectionsRes] = await Promise.all([
        fetch('/api/channels/cancellation-policy'),
        fetch('/api/channels/connections'),
      ]);

      const [policiesData, connData] = await Promise.all([
        policiesRes.json(),
        connectionsRes.json(),
      ]);

      if (policiesData.success) {
        setPolicies(policiesData.data.policies || []);
        setStats(policiesData.data.summary || { total: 0, active: 0, synced: 0, failed: 0, pending: 0 });
      }
      if (connData.success) setConnections(connData.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load cancellation policies');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data fetch
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    fetchData();
  });

  // Set default check-in date (3 days from now)
  useEffect(() => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    setCalcCheckInDate(date.toISOString().slice(0, 16));
  }, []);

  // ============================================
  // FORM HELPERS
  // ============================================
  const resetForm = () => {
    setFormData(emptyForm);
    setEditingPolicy(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (policy: CancellationPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      policyName: policy.policyName,
      connectionId: policy.connectionId || '',
      channelCode: policy.channelCode,
      policyType: policy.policyType,
      freeCancelBefore: policy.freeCancelBefore?.toString() || '',
      penaltyType: policy.penaltyType,
      penaltyValue: policy.penaltyValue.toString(),
      penaltyCurrency: policy.penaltyCurrency,
      noShowPolicy: policy.noShowPolicy,
      noShowPenaltyType: policy.noShowPenaltyType,
      noShowPenaltyValue: policy.noShowPenaltyValue.toString(),
      channelPolicyId: policy.channelPolicyId || '',
      channelPolicyCode: policy.channelPolicyCode || '',
      syncEnabled: policy.syncEnabled,
      isActive: policy.isActive,
    });
    setDialogOpen(true);
  };

  // ============================================
  // CRUD OPERATIONS
  // ============================================
  const handleSave = async () => {
    if (!formData.policyName.trim()) {
      toast.error('Policy name is required');
      return;
    }
    if (!formData.channelCode) {
      toast.error('Channel code is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        connectionId: formData.connectionId || null,
        channelCode: formData.channelCode,
        policyName: formData.policyName.trim(),
        policyType: formData.policyType,
        freeCancelBefore: formData.freeCancelBefore ? parseInt(formData.freeCancelBefore, 10) : null,
        penaltyType: formData.penaltyType,
        penaltyValue: parseFloat(formData.penaltyValue) || 0,
        penaltyCurrency: formData.penaltyCurrency,
        noShowPolicy: formData.noShowPolicy,
        noShowPenaltyType: formData.noShowPenaltyType,
        noShowPenaltyValue: parseFloat(formData.noShowPenaltyValue) || 1,
        channelPolicyId: formData.channelPolicyId || null,
        channelPolicyCode: formData.channelPolicyCode || null,
        syncEnabled: formData.syncEnabled,
        isActive: formData.isActive,
      };

      const url = '/api/channels/cancellation-policy';
      const method = editingPolicy ? 'PUT' : 'POST';
      const body = editingPolicy
        ? { id: editingPolicy.id, ...payload }
        : payload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editingPolicy ? 'Policy updated successfully' : 'Policy created successfully');
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to save policy');
      }
    } catch {
      toast.error('Network error saving policy');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // BULK SYNC
  // ============================================
  const handleBulkSync = async () => {
    if (!filterConnection || filterConnection === 'all') {
      toast.error('Select a channel connection to sync');
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch('/api/channels/cancellation-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', connectionId: filterConnection }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.data.message);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Sync failed');
      }
    } catch {
      toast.error('Network error during sync');
    } finally {
      setSyncing(false);
    }
  };

  // ============================================
  // DELETE
  // ============================================
  const handleDelete = async () => {
    if (!deletingPolicy) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/channels/cancellation-policy?id=${deletingPolicy.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Policy deleted successfully');
        setDeleteDialogOpen(false);
        setDeletingPolicy(null);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to delete policy');
      }
    } catch {
      toast.error('Network error deleting policy');
    } finally {
      setDeleting(false);
    }
  };

  // ============================================
  // PENALTY CALCULATOR
  // ============================================
  const handleCalculatePenalty = async () => {
    if (!calcPolicyId) {
      toast.error('Select a cancellation policy');
      return;
    }
    const amount = parseFloat(calcBookingAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid booking amount');
      return;
    }
    if (!calcCheckInDate) {
      toast.error('Select a check-in datetime');
      return;
    }

    setCalcLoading(true);
    setCalcResult(null);
    try {
      const res = await fetch('/api/channels/cancellation-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calculate-penalty',
          policyId: calcPolicyId,
          bookingAmount: amount,
          checkInDatetime: new Date(calcCheckInDate).toISOString(),
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
  // FILTERED POLICIES
  // ============================================
  const filteredPolicies = policies.filter((p) => {
    if (filterConnection !== 'all' && p.connectionId !== filterConnection) return false;
    if (filterPolicyType !== 'all' && p.policyType !== filterPolicyType) return false;
    if (filterStatus === 'active' && !p.isActive) return false;
    if (filterStatus === 'inactive' && p.isActive) return false;
    return true;
  });

  // ============================================
  // RENDER HELPERS
  // ============================================
  const getPolicyTypeBadge = (type: string) => {
    const config = POLICY_TYPE_OPTIONS[type];
    if (!config) return <Badge variant="outline">{type.replace('_', ' ')}</Badge>;
    return <Badge className={`${config.color} text-xs`}>{config.label}</Badge>;
  };

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Synced
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
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
          <Skeleton className="h-10 w-32 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
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
            <ShieldAlert className="h-6 w-6 text-primary" />
            Cancellation Policy Sync
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and sync cancellation policies across your OTA channels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Policy
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <ShieldAlert className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Policies</p>
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
                  {stats.active}
                </p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-sky-500/10 to-sky-600/5 border-sky-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/20">
                <Send className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-sky-700 dark:text-sky-400 tabular-nums">
                  {stats.synced}
                </p>
                <p className="text-xs text-muted-foreground">Synced</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400 tabular-nums">
                  {stats.failed}
                </p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Penalty Calculator */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Penalty Calculator
          </CardTitle>
          <CardDescription className="text-xs">
            Calculate cancellation penalty for a booking based on policy rules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-end gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Cancellation Policy
              </Label>
              <Select value={calcPolicyId} onValueChange={setCalcPolicyId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a policy" />
                </SelectTrigger>
                <SelectContent>
                  {policies.filter((p) => p.isActive).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.policyName} — {p.channelCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-[140px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Booking Amount
              </Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="number"
                  value={calcBookingAmount}
                  onChange={(e) => setCalcBookingAmount(e.target.value)}
                  className="pl-9"
                  placeholder="500.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="space-y-2 min-w-[200px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Check-in Datetime
              </Label>
              <Input
                type="datetime-local"
                value={calcCheckInDate}
                onChange={(e) => setCalcCheckInDate(e.target.value)}
              />
            </div>

            <Button
              onClick={handleCalculatePenalty}
              disabled={calcLoading || !calcPolicyId || !calcBookingAmount}
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
            <div className="mt-4 p-4 rounded-lg border bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Booking Amount</p>
                  <p className="text-lg font-bold tabular-nums">${calcResult.bookingAmount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Penalty Amount</p>
                  <p className={`text-lg font-bold tabular-nums ${calcResult.penaltyAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {calcResult.penaltyAmount > 0 ? '-' : ''}${calcResult.penaltyAmount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Refund Amount</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    ${calcResult.refundAmount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Result</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {calcResult.isFreeCancellation ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">
                        Free Cancellation
                      </Badge>
                    ) : calcResult.isNoShow ? (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs">
                        No-Show
                      </Badge>
                    ) : calcResult.isRefundable ? (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs">
                        Partial Refund
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs">
                        <Ban className="h-3 w-3 mr-1" />
                        Non-Refundable
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Hours until check-in:</span> {calcResult.hoursUntilCheckIn}h
                  {calcResult.freeCancelBefore != null && (
                    <span className="ml-4">
                      <span className="font-medium">Free cancel window:</span> {calcResult.freeCancelBefore}h
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium">Description:</span> {calcResult.penaltyDescription}
                </p>
              </div>
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
                Channel Connection
              </Label>
              <Select value={filterConnection} onValueChange={setFilterConnection}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  {connections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.displayName || conn.channel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-[180px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Policy Type
              </Label>
              <Select value={filterPolicyType} onValueChange={setFilterPolicyType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(POLICY_TYPE_OPTIONS).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-[130px]">
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkSync}
                disabled={syncing || !filterConnection || filterConnection === 'all'}
                className="gap-1"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Sync to Channel
              </Button>
              <span className="text-xs text-muted-foreground self-center whitespace-nowrap">
                {filteredPolicies.length} of {policies.length} policies
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Policies Table */}
      {filteredPolicies.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Policy Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Free Cancel Before</TableHead>
                    <TableHead>Penalty</TableHead>
                    <TableHead>No-Show</TableHead>
                    <TableHead>Sync Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPolicies.map((policy) => (
                    <TableRow key={policy.id} className={!policy.isActive ? 'opacity-60' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[180px]">{policy.policyName}</p>
                          <p className="text-xs text-muted-foreground">
                            {policy.channelPolicyCode ? (
                              <span className="font-mono">{policy.channelPolicyCode}</span>
                            ) : (
                              'Internal'
                            )}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getPolicyTypeBadge(policy.policyType)}
                      </TableCell>
                      <TableCell>
                        {policy.connection ? (
                          <Badge variant="secondary" className="text-xs">
                            {policy.connection.displayName || policy.connection.channel}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {policy.channelCode}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {policy.freeCancelBefore != null ? (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {policy.freeCancelBefore}h
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {policy.penaltyType === 'percentage' && policy.penaltyValue > 0 ? (
                            `${policy.penaltyValue}%`
                          ) : policy.penaltyType === 'fixed_amount' ? (
                            `${policy.penaltyCurrency} ${policy.penaltyValue}`
                          ) : policy.penaltyType === 'nights' ? (
                            `${policy.penaltyValue} night${policy.penaltyValue !== 1 ? 's' : ''}`
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">None</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        {policy.noShowPolicy ? (
                          <span className="text-xs">
                            {policy.noShowPenaltyType === 'nights'
                              ? `${policy.noShowPenaltyValue} night${policy.noShowPenaltyValue !== 1 ? 's' : ''}`
                              : policy.noShowPenaltyType === 'percentage'
                                ? `${policy.noShowPenaltyValue}%`
                                : `${policy.penaltyCurrency} ${policy.noShowPenaltyValue}`}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {getSyncStatusBadge(policy.syncStatus)}
                          {!policy.syncEnabled && (
                            <span className="text-[10px] text-muted-foreground">Sync disabled</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(policy)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingPolicy(policy);
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
            <h3 className="text-lg font-semibold mb-2">No Policies Found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              {policies.length > 0
                ? 'No policies match the current filters. Try adjusting your filter criteria.'
                : 'Create your first cancellation policy to start syncing across OTA channels.'}
            </p>
            {policies.length === 0 && (
              <Button onClick={openCreateDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create First Policy
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
              <p className="font-medium text-foreground">How Cancellation Policy Sync Works</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>Booking.com:</strong> Uses non-refundable or free cancellation with a deadline (hours before check-in)</li>
                <li><strong>Airbnb:</strong> Uses Flexible, Moderate, Strict, or Super Strict cancellation tiers</li>
                <li><strong>Expedia:</strong> Supports percentage-based or fixed-amount penalties</li>
                <li><strong>Custom:</strong> Fully configurable penalty type (percentage, fixed amount, or nights)</li>
              </ul>
              <p className="text-xs">
                Select a channel connection and click &quot;Sync to Channel&quot; to push all active policies.
                Different channels require different policy formats — the system automatically adapts.
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
              {editingPolicy ? 'Edit Cancellation Policy' : 'Create Cancellation Policy'}
            </DialogTitle>
            <DialogDescription>
              {editingPolicy
                ? 'Modify the cancellation policy configuration'
                : 'Define a cancellation policy to sync across OTA channels'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Info className="h-4 w-4" />
                Basic Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Policy Name *</Label>
                  <Input
                    value={formData.policyName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, policyName: e.target.value }))}
                    placeholder="e.g., Standard Free Cancellation"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Policy Type *</Label>
                  <Select
                    value={formData.policyType}
                    onValueChange={(val) => {
                      setFormData((prev) => ({ ...prev, policyType: val }));
                      // Auto-fill Airbnb defaults
                      if (val === 'flexible') {
                        setFormData((prev) => ({ ...prev, freeCancelBefore: '24' }));
                      } else if (val === 'moderate') {
                        setFormData((prev) => ({ ...prev, freeCancelBefore: '120' }));
                      } else if (val === 'strict') {
                        setFormData((prev) => ({ ...prev, freeCancelBefore: '336', penaltyValue: '50' }));
                      } else if (val === 'super_strict') {
                        setFormData((prev) => ({ ...prev, freeCancelBefore: '720', penaltyValue: '50' }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(POLICY_TYPE_OPTIONS).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          {cfg.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {POLICY_TYPE_OPTIONS[formData.policyType] && (
                    <p className="text-xs text-muted-foreground">
                      {POLICY_TYPE_OPTIONS[formData.policyType].description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Channel Configuration */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Channel Configuration
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel Connection</Label>
                  <Select
                    value={formData.connectionId}
                    onValueChange={(val) => {
                      setFormData((prev) => ({ ...prev, connectionId: val }));
                      // Auto-fill channel code from connection
                      const conn = connections.find((c) => c.id === val);
                      if (conn) {
                        setFormData((prev) => ({ ...prev, channelCode: conn.channel }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select connection" />
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

                <div className="space-y-2">
                  <Label>Channel Code *</Label>
                  <Input
                    value={formData.channelCode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, channelCode: e.target.value }))}
                    placeholder="e.g., booking_com, airbnb"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel Policy ID</Label>
                  <Input
                    value={formData.channelPolicyId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, channelPolicyId: e.target.value }))}
                    placeholder="External policy ID from channel"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Channel Policy Code</Label>
                  <Input
                    value={formData.channelPolicyCode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, channelPolicyCode: e.target.value }))}
                    placeholder="External policy code"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Cancellation Rules */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Cancellation Rules
              </h3>

              <div className="space-y-2">
                <Label>Free Cancellation Deadline (hours before check-in)</Label>
                <Input
                  type="number"
                  value={formData.freeCancelBefore}
                  onChange={(e) => setFormData((prev) => ({ ...prev, freeCancelBefore: e.target.value }))}
                  placeholder="e.g., 48 for 2 days"
                  min="0"
                />
                <p className="text-xs text-muted-foreground">
                  Guests can cancel for free if they cancel at least this many hours before check-in
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Late Penalty Type</Label>
                  <Select
                    value={formData.penaltyType}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, penaltyType: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PENALTY_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Penalty Value</Label>
                  <Input
                    type="number"
                    value={formData.penaltyValue}
                    onChange={(e) => setFormData((prev) => ({ ...prev, penaltyValue: e.target.value }))}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={formData.penaltyCurrency}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, penaltyCurrency: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="INR">INR</SelectItem>
                      <SelectItem value="AUD">AUD</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                      <SelectItem value="JPY">JPY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* No-Show Policy */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  No-Show Policy
                </h3>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Enabled</Label>
                  <Switch
                    checked={formData.noShowPolicy}
                    onCheckedChange={(val) => setFormData((prev) => ({ ...prev, noShowPolicy: val }))}
                  />
                </div>
              </div>

              {formData.noShowPolicy && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>No-Show Penalty Type</Label>
                    <Select
                      value={formData.noShowPenaltyType}
                      onValueChange={(val) => setFormData((prev) => ({ ...prev, noShowPenaltyType: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PENALTY_TYPE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>No-Show Penalty Value</Label>
                    <Input
                      type="number"
                      value={formData.noShowPenaltyValue}
                      onChange={(e) => setFormData((prev) => ({ ...prev, noShowPenaltyValue: e.target.value }))}
                      placeholder="1"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Sync Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Sync & Status</h3>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.syncEnabled}
                    onCheckedChange={(val) => setFormData((prev) => ({ ...prev, syncEnabled: val }))}
                  />
                  <Label className="text-sm">Sync Enabled</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(val) => setFormData((prev) => ({ ...prev, isActive: val }))}
                  />
                  <Label className="text-sm">Active</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPolicy ? 'Update Policy' : 'Create Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Cancellation Policy</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingPolicy?.policyName}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
