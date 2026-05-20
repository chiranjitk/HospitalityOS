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
  Percent,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Calculator,
  DollarSign,
  Copy,
  Info,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  BarChart3,
  Clock,
  TrendingUp,
  CircleDollarSign,
  CalendarDays,
  ArrowRightLeft,
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

interface CommissionConfig {
  id: string;
  tenantId: string;
  propertyId: string | null;
  connectionId: string;
  channelCode: string;
  commissionType: string;
  baseCommission: number;
  currency: string;
  commissionModel: string;
  billingCycle: string;
  paymentTerms: number;
  vatApplicable: boolean;
  vatRate: number;
  includedInRate: boolean;
  minCommission: number | null;
  maxCommission: number | null;
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
  connectionDisplayName: string;
  connectionChannel: string;
  connectionStatus: string;
  totalAccrued: number;
  totalInvoiced: number;
  totalPaid: number;
  totalPending: number;
}

interface CalculationResult {
  configId: string;
  channelCode: string;
  bookingAmount: number;
  commissionAmount: number;
  breakdown: Record<string, unknown>;
  vatApplicable: boolean;
  vatRate: number;
  vatAmount: number;
  totalOwed: number;
  netToHotel: number;
  currency: string;
  commissionModel: string;
  minApplied: boolean;
  maxApplied: boolean;
  includedInRate: boolean;
}

interface ChannelSummary {
  channelCode: string;
  totalConfigs: number;
  activeConfigs: number;
  avgCommissionRate: number;
}

interface ConfigFormData {
  connectionId: string;
  channelCode: string;
  commissionType: string;
  baseCommission: number;
  currency: string;
  commissionModel: string;
  billingCycle: string;
  paymentTerms: number;
  vatApplicable: boolean;
  vatRate: number;
  includedInRate: boolean;
  minCommission: string;
  maxCommission: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
}

// ============================================
// CONSTANTS
// ============================================

const COMMISSION_TYPE_LABELS: Record<string, string> = {
  percentage: 'Percentage (%)',
  fixed_amount: 'Fixed Amount',
  tiered: 'Tiered',
};

const COMMISSION_MODEL_LABELS: Record<string, string> = {
  gross: 'Gross',
  net: 'Net',
  hybrid: 'Hybrid',
};

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  bi_weekly: 'Bi-Weekly',
  weekly: 'Weekly',
  per_booking: 'Per Booking',
};

const CURRENT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ============================================
// COMPONENT
// ============================================

export function ChannelCommissionConfigPanel() {
  // Data
  const [configs, setConfigs] = useState<CommissionConfig[]>([]);
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [summaries, setSummaries] = useState<ChannelSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode
  const [activeTab, setActiveTab] = useState<'configs' | 'calculator' | 'summary'>('configs');

  // Filters
  const [filterConnection, setFilterConnection] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<CommissionConfig | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConfig, setDeletingConfig] = useState<CommissionConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Clone dialog
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloningConfig, setCloningConfig] = useState<CommissionConfig | null>(null);
  const [cloneTargetId, setCloneTargetId] = useState<string>('');
  const [cloning, setCloning] = useState(false);

  // Calculator
  const [calcConfigId, setCalcConfigId] = useState<string>('');
  const [calcAmount, setCalcAmount] = useState<string>('200');
  const [calcResult, setCalcResult] = useState<CalculationResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState<ConfigFormData>({
    connectionId: '',
    channelCode: '',
    commissionType: 'percentage',
    baseCommission: 15,
    currency: 'USD',
    commissionModel: 'gross',
    billingCycle: 'monthly',
    paymentTerms: 30,
    vatApplicable: false,
    vatRate: 0,
    includedInRate: false,
    minCommission: '',
    maxCommission: '',
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

      const [configsRes, connectionsRes, summaryRes] = await Promise.all([
        fetch(`/api/channels/commission-config?${params}`),
        fetch(`/api/channels/connections?${params}`),
        fetch(`/api/channels/commission-config?${params}&action=summary`),
      ]);

      const [configsData, connData, summaryData] = await Promise.all([
        configsRes.json(),
        connectionsRes.json(),
        summaryRes.json(),
      ]);

      if (configsData.success) setConfigs(configsData.data || []);
      if (connData.success) setConnections(connData.data || []);
      if (summaryData.success) setSummaries(summaryData.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load commission config data');
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
      connectionId: '',
      channelCode: '',
      commissionType: 'percentage',
      baseCommission: 15,
      currency: 'USD',
      commissionModel: 'gross',
      billingCycle: 'monthly',
      paymentTerms: 30,
      vatApplicable: false,
      vatRate: 0,
      includedInRate: false,
      minCommission: '',
      maxCommission: '',
      isActive: true,
      effectiveFrom: '',
      effectiveTo: '',
    });
    setEditingConfig(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (config: CommissionConfig) => {
    setEditingConfig(config);
    setFormData({
      connectionId: config.connectionId,
      channelCode: config.channelCode,
      commissionType: config.commissionType,
      baseCommission: config.baseCommission,
      currency: config.currency,
      commissionModel: config.commissionModel,
      billingCycle: config.billingCycle,
      paymentTerms: config.paymentTerms,
      vatApplicable: config.vatApplicable,
      vatRate: config.vatRate,
      includedInRate: config.includedInRate,
      minCommission: config.minCommission?.toString() || '',
      maxCommission: config.maxCommission?.toString() || '',
      isActive: config.isActive,
      effectiveFrom: config.effectiveFrom ? config.effectiveFrom.split('T')[0] : '',
      effectiveTo: config.effectiveTo ? config.effectiveTo.split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  // ============================================
  // CRUD
  // ============================================
  const handleSave = async () => {
    if (!formData.connectionId) {
      toast.error('Channel connection is required');
      return;
    }
    if (!formData.channelCode.trim()) {
      toast.error('Channel code is required');
      return;
    }

    setSaving(true);
    try {
      const conn = connections.find(c => c.id === formData.connectionId);
      const payload = {
        tenantId: 'current',
        connectionId: formData.connectionId,
        channelCode: formData.channelCode || (conn?.channel || ''),
        commissionType: formData.commissionType,
        baseCommission: formData.baseCommission,
        currency: formData.currency,
        commissionModel: formData.commissionModel,
        billingCycle: formData.billingCycle,
        paymentTerms: formData.paymentTerms,
        vatApplicable: formData.vatApplicable,
        vatRate: formData.vatRate,
        includedInRate: formData.includedInRate,
        minCommission: formData.minCommission ? parseFloat(formData.minCommission) : null,
        maxCommission: formData.maxCommission ? parseFloat(formData.maxCommission) : null,
        isActive: formData.isActive,
        effectiveFrom: formData.effectiveFrom || null,
        effectiveTo: formData.effectiveTo || null,
      };

      const method = editingConfig ? 'PUT' : 'POST';
      const body = editingConfig ? { id: editingConfig.id, ...payload } : payload;

      const res = await fetch('/api/channels/commission-config', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingConfig ? 'Config updated successfully' : 'Config created successfully');
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to save config');
      }
    } catch {
      toast.error('Network error saving config');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingConfig) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/channels/commission-config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingConfig.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Config deleted successfully');
        setDeleteDialogOpen(false);
        setDeletingConfig(null);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to delete config');
      }
    } catch {
      toast.error('Network error deleting config');
    } finally {
      setDeleting(false);
    }
  };

  const handleClone = async () => {
    if (!cloningConfig || !cloneTargetId) {
      toast.error('Select a target connection');
      return;
    }
    setCloning(true);
    try {
      const res = await fetch('/api/channels/commission-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clone',
          sourceConfigId: cloningConfig.id,
          targetConnectionId: cloneTargetId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Config cloned successfully');
        setCloneDialogOpen(false);
        setCloningConfig(null);
        setCloneTargetId('');
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to clone config');
      }
    } catch {
      toast.error('Network error cloning config');
    } finally {
      setCloning(false);
    }
  };

  // ============================================
  // CALCULATOR
  // ============================================
  const handleCalculate = async () => {
    if (!calcConfigId) {
      toast.error('Select a commission config');
      return;
    }
    const amount = parseFloat(calcAmount);
    if (!amount || amount < 0) {
      toast.error('Enter a valid booking amount');
      return;
    }

    setCalcLoading(true);
    setCalcResult(null);
    try {
      const res = await fetch('/api/channels/commission-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calculate', configId: calcConfigId, bookingAmount: amount }),
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
  const filteredConfigs = configs.filter(config => {
    if (filterConnection !== 'all' && config.connectionId !== filterConnection) return false;
    if (filterStatus === 'active' && !config.isActive) return false;
    if (filterStatus === 'inactive' && config.isActive) return false;
    return true;
  });

  // Stats
  const totalConfigs = configs.length;
  const activeConfigs = configs.filter(c => c.isActive).length;
  const avgRate = activeConfigs.length > 0
    ? configs.filter(c => c.isActive).reduce((sum, c) => sum + c.baseCommission, 0) / activeConfigs.length
    : 0;
  const totalAccrued = configs.reduce((sum, c) => sum + c.totalAccrued, 0);
  const totalPending = configs.reduce((sum, c) => sum + c.totalPending, 0);

  // ============================================
  // RENDER HELPERS
  // ============================================
  const getCommissionBadge = (type: string, rate: number) => {
    let colorClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0';
    let display = '';

    if (type === 'percentage' || type === 'tiered') {
      display = `${rate}%`;
      if (rate > 20) colorClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0';
      else if (rate > 15) colorClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0';
    } else {
      display = `$${rate.toFixed(2)}`;
    }

    return <Badge className={`${colorClass} gap-1 text-xs font-semibold tabular-nums`}>{display}</Badge>;
  };

  const getModelBadge = (model: string) => {
    const map: Record<string, string> = {
      gross: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0',
      net: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0',
      hybrid: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-0',
    };
    return <Badge className={`${map[model] || ''} text-[10px]`}>{model.toUpperCase()}</Badge>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
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
            <Skeleton className="h-8 w-72 rounded" />
            <Skeleton className="h-4 w-96 mt-2 rounded" />
          </div>
          <Skeleton className="h-10 w-32 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
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
            <Percent className="h-6 w-6 text-primary" />
            Channel Commission Config
          </h1>
          <p className="text-muted-foreground mt-1">
            Set and manage commission rates per OTA channel connection
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Config
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
                <p className="text-2xl font-bold tabular-nums">{totalConfigs}</p>
                <p className="text-xs text-muted-foreground">Total Configs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {avgRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Avg Commission</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <CircleDollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                  ${totalAccrued.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground">Total Accrued</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-700 dark:text-violet-400 tabular-nums">
                  ${totalPending.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground">Total Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
        <Button
          variant={activeTab === 'configs' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('configs')}
          className="gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          Configs
        </Button>
        <Button
          variant={activeTab === 'calculator' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('calculator')}
          className="gap-2"
        >
          <Calculator className="h-4 w-4" />
          Calculator
        </Button>
        <Button
          variant={activeTab === 'summary' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('summary')}
          className="gap-2"
        >
          <ArrowRightLeft className="h-4 w-4" />
          Summary
        </Button>
      </div>

      {/* ========== CONFIGS TAB ========== */}
      {activeTab === 'configs' && (
        <>
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
                <div className="space-y-2 min-w-[160px]">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
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
                  {filteredConfigs.length} of {configs.length} configs
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configs Table */}
          {filteredConfigs.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-y-auto">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Channel</TableHead>
                        <TableHead>Commission Type</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Billing Cycle</TableHead>
                        <TableHead>Payment Terms</TableHead>
                        <TableHead>VAT</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredConfigs.map((config) => (
                        <TableRow key={config.id} className={!config.isActive ? 'opacity-60' : ''}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm truncate max-w-[160px]">
                                {config.connectionDisplayName}
                              </p>
                              <Badge variant="secondary" className="text-[10px] mt-1">
                                {config.channelCode}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs capitalize">
                              {COMMISSION_TYPE_LABELS[config.commissionType] || config.commissionType}
                            </span>
                          </TableCell>
                          <TableCell>
                            {getCommissionBadge(config.commissionType, config.baseCommission)}
                          </TableCell>
                          <TableCell>
                            {getModelBadge(config.commissionModel)}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">
                              {BILLING_CYCLE_LABELS[config.billingCycle] || config.billingCycle}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs tabular-nums">{config.paymentTerms}d</span>
                          </TableCell>
                          <TableCell>
                            {config.vatApplicable ? (
                              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0 text-[10px]">
                                {config.vatRate}%
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">No</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                config.isActive
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400 border-0'
                              }
                            >
                              {config.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(config)}
                                className="h-8 w-8 p-0"
                                title="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCloningConfig(config);
                                  setCloneTargetId('');
                                  setCloneDialogOpen(true);
                                }}
                                className="h-8 w-8 p-0"
                                title="Clone"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDeletingConfig(config);
                                  setDeleteDialogOpen(true);
                                }}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Delete"
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
                <h3 className="text-lg font-semibold mb-2">No Commission Configs Found</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                  {configs.length > 0
                    ? 'No configs match the current filters. Try adjusting your filter criteria.'
                    : 'Create your first commission config to set OTA channel commission rates (e.g., Booking.com 15%, Expedia 18%).'}
                </p>
                {configs.length === 0 && (
                  <Button onClick={openCreateDialog} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Config
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
                  <p className="font-medium text-foreground">How Channel Commission Works</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li><strong>Percentage:</strong> A % of the booking amount (e.g., 15% of $200 = $30)</li>
                    <li><strong>Fixed Amount:</strong> A flat fee per booking (e.g., $25 per booking)</li>
                    <li><strong>Tiered:</strong> Graduated rates (base % for first $500, higher % for amounts above)</li>
                    <li><strong>Gross:</strong> Commission on total booking amount before deductions</li>
                    <li><strong>Net:</strong> Commission on net rate after taxes/fees are excluded</li>
                    <li><strong>Hybrid:</strong> Combination of gross and net calculation</li>
                  </ul>
                  <p className="text-xs">
                    Each channel connection can have one commission config. Use Clone to quickly copy settings to another channel.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ========== CALCULATOR TAB ========== */}
      {activeTab === 'calculator' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Commission Calculator
            </CardTitle>
            <CardDescription>
              Enter a booking amount and select a commission config to see the full commission breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Commission Config
                </Label>
                <Select value={calcConfigId} onValueChange={setCalcConfigId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a config" />
                  </SelectTrigger>
                  <SelectContent>
                    {configs.filter(c => c.isActive).map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.connectionDisplayName} — {config.baseCommission}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Booking Amount
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="number"
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(e.target.value)}
                    className="pl-9"
                    placeholder="200.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleCalculate}
                  disabled={calcLoading || !calcConfigId || !calcAmount}
                  className="gap-2 w-full"
                >
                  {calcLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4" />
                  )}
                  Calculate Commission
                </Button>
              </div>
            </div>

            {/* Calculation Result */}
            {calcResult && (
              <div className="mt-6 space-y-4">
                <div className="p-4 rounded-lg border bg-muted/30">
                  <h4 className="text-sm font-semibold mb-3">Commission Breakdown</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Booking Amount</p>
                      <p className="text-lg font-bold tabular-nums">${calcResult.bookingAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Commission</p>
                      <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
                        -${calcResult.commissionAmount.toFixed(2)}
                      </p>
                    </div>
                    {calcResult.vatApplicable && calcResult.vatAmount > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground">VAT ({calcResult.vatRate}%)</p>
                        <p className="text-lg font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                          -${calcResult.vatAmount.toFixed(2)}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Net to Hotel</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        ${calcResult.netToHotel.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Channel</p>
                    <Badge variant="outline">{calcResult.channelCode}</Badge>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Commission Model</p>
                    {getModelBadge(calcResult.commissionModel)}
                  </div>
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Total Owed</p>
                    <p className="text-sm font-bold tabular-nums">${calcResult.totalOwed.toFixed(2)} {calcResult.currency}</p>
                  </div>
                  {calcResult.includedInRate && (
                    <div className="p-3 rounded-lg border bg-amber-50 dark:bg-amber-900/20 col-span-full">
                      <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Commission is already included in the displayed rate
                      </p>
                    </div>
                  )}
                  {calcResult.minApplied && (
                    <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 col-span-full">
                      <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Minimum commission floor was applied
                      </p>
                    </div>
                  )}
                  {calcResult.maxApplied && (
                    <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 col-span-full">
                      <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Maximum commission cap was applied
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {configs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  No commission configs available for calculation.
                </p>
                <Button onClick={openCreateDialog} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create a Config First
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========== SUMMARY TAB ========== */}
      {activeTab === 'summary' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Per-Channel Commission Summary
            </CardTitle>
            <CardDescription>
              Overview of commission settings and rates across all connected channels
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summaries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {summaries.map((summary) => (
                  <div key={summary.channelCode} className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className="text-xs font-semibold">
                        {summary.channelCode}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {summary.activeConfigs}/{summary.totalConfigs} active
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Avg Rate</span>
                        <span className="text-sm font-bold tabular-nums">{summary.avgCommissionRate}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            summary.avgCommissionRate > 20 ? 'bg-red-500' :
                            summary.avgCommissionRate > 15 ? 'bg-amber-500' :
                            'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(summary.avgCommissionRate * 2.5, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No channel summary data available yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========== CREATE/EDIT DIALOG ========== */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? 'Edit Commission Config' : 'Create Commission Config'}
            </DialogTitle>
            <DialogDescription>
              {editingConfig
                ? 'Modify the channel commission configuration'
                : 'Set commission rate and terms for a channel connection'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Channel Connection */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Channel & Rate
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel Connection *</Label>
                  <Select
                    value={formData.connectionId}
                    onValueChange={(val) => {
                      const conn = connections.find(c => c.id === val);
                      setFormData(prev => ({
                        ...prev,
                        connectionId: val,
                        channelCode: conn?.channel || prev.channelCode,
                      }));
                    }}
                    disabled={!!editingConfig}
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

                <div className="space-y-2">
                  <Label>Channel Code *</Label>
                  <Input
                    value={formData.channelCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, channelCode: e.target.value }))}
                    placeholder="e.g., booking_com, expedia"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Commission Type</Label>
                  <Select
                    value={formData.commissionType}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, commissionType: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(COMMISSION_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    {formData.commissionType === 'fixed_amount' ? 'Commission Amount ($)' : 'Commission Rate (%)'}
                  </Label>
                  <Input
                    type="number"
                    value={formData.baseCommission}
                    onChange={(e) => setFormData(prev => ({ ...prev, baseCommission: parseFloat(e.target.value) || 0 }))}
                    placeholder={formData.commissionType === 'fixed_amount' ? '25.00' : '15'}
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (&euro;)</SelectItem>
                      <SelectItem value="GBP">GBP (&pound;)</SelectItem>
                      <SelectItem value="INR">INR (&curren;)</SelectItem>
                      <SelectItem value="AED">AED (AED)</SelectItem>
                      <SelectItem value="JPY">JPY (&yen;)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Commission</Label>
                  <Input
                    type="number"
                    value={formData.minCommission}
                    onChange={(e) => setFormData(prev => ({ ...prev, minCommission: e.target.value }))}
                    placeholder="Optional floor"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Commission</Label>
                  <Input
                    type="number"
                    value={formData.maxCommission}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxCommission: e.target.value }))}
                    placeholder="Optional cap"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Billing & Payment */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Billing & Payment
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Commission Model</Label>
                  <Select
                    value={formData.commissionModel}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, commissionModel: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(COMMISSION_MODEL_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Billing Cycle</Label>
                  <Select
                    value={formData.billingCycle}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, billingCycle: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(BILLING_CYCLE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Payment Terms (days)</Label>
                  <Input
                    type="number"
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: parseInt(e.target.value) || 30 }))}
                    min="0"
                    step="1"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* VAT & Options */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Info className="h-4 w-4" />
                Tax & Options
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>VAT Rate (%)</Label>
                  <Input
                    type="number"
                    value={formData.vatRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, vatRate: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    step="0.1"
                    disabled={!formData.vatApplicable}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Effective From</Label>
                  <Input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData(prev => ({ ...prev, effectiveFrom: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Effective To</Label>
                  <Input
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData(prev => ({ ...prev, effectiveTo: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>VAT Applicable</Label>
                    <p className="text-xs text-muted-foreground">Whether VAT applies to the commission</p>
                  </div>
                  <Switch
                    checked={formData.vatApplicable}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, vatApplicable: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Included in Rate</Label>
                    <p className="text-xs text-muted-foreground">Commission is already included in displayed rate</p>
                  </div>
                  <Switch
                    checked={formData.includedInRate}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, includedInRate: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Active</Label>
                    <p className="text-xs text-muted-foreground">Enable this commission configuration</p>
                  </div>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingConfig ? 'Update Config' : 'Create Config'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== DELETE DIALOG ========== */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Commission Config</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the commission config for{' '}
              <strong>{deletingConfig?.connectionDisplayName}</strong>? This action cannot be undone.
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
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== CLONE DIALOG ========== */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clone Commission Config</DialogTitle>
            <DialogDescription>
              Copy commission settings from{' '}
              <strong>{cloningConfig?.connectionDisplayName}</strong> to another channel connection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Target Channel Connection</Label>
              <Select value={cloneTargetId} onValueChange={setCloneTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target connection" />
                </SelectTrigger>
                <SelectContent>
                  {connections
                    .filter(c => c.id !== cloningConfig?.connectionId)
                    .filter(c => !configs.some(cfg => cfg.connectionId === c.id))
                    .map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        {conn.displayName || conn.channel}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {connections.filter(c => c.id !== cloningConfig?.connectionId).filter(c => !configs.some(cfg => cfg.connectionId === c.id)).length === 0 && (
                <p className="text-xs text-muted-foreground">All other connections already have configs.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleClone}
              disabled={cloning || !cloneTargetId}
              className="gap-2"
            >
              {cloning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Clone Config
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
