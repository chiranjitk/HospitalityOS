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
  ArrowRightLeft,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Calculator,
  DollarSign,
  Percent,
  CircleDollarSign,
  Target,
  TrendingUp,
  Info,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Filter,
  Search,
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

interface DerivationRule {
  id: string;
  tenantId: string;
  propertyId: string | null;
  name: string;
  description: string | null;
  connectionId: string | null;
  sourceRatePlanId: string;
  channelCode: string | null;
  operation: string;
  adjustmentValue: number;
  roundingMethod: string;
  minRate: number | null;
  maxRate: number | null;
  floorRate: number | null;
  ceilingRate: number | null;
  appliesTo: string;
  specificDates: string | null;
  priority: number;
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
  sourceRatePlanName: string;
  connectionDisplayName: string | null;
  connectionChannel: string | null;
}

interface CalculateResult {
  baseRate: number;
  derivedRate: number;
  ruleName: string;
  operation: string;
  adjustmentValue: number;
  roundingMethod: string;
  floorRate: number | null;
  ceilingRate: number | null;
}

interface RuleFormData {
  name: string;
  description: string;
  connectionId: string;
  sourceRatePlanId: string;
  operation: string;
  adjustmentValue: number;
  roundingMethod: string;
  minRate: string;
  maxRate: string;
  floorRate: string;
  ceilingRate: string;
  appliesTo: string;
  priority: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
}

// ============================================
// CONSTANTS
// ============================================

const OPERATION_LABELS: Record<string, string> = {
  percentage: 'Percentage (%)',
  fixed_amount: 'Fixed Amount ($)',
  margin: 'Margin (%)',
  competitor_match: 'Competitor Match (%)',
};

const OPERATION_DESCRIPTIONS: Record<string, string> = {
  percentage: 'Add/subtract a percentage from the base rate',
  fixed_amount: 'Add/subtract a fixed dollar amount from the base rate',
  margin: 'Apply a margin to derive the selling price (base / (1 - margin%))',
  competitor_match: 'Set rate as a percentage of the base rate',
};

const ROUNDING_LABELS: Record<string, string> = {
  nearest: 'Nearest',
  up: 'Round Up',
  down: 'Round Down',
  none: 'No Rounding (2 decimals)',
};

const APPLIES_TO_LABELS: Record<string, string> = {
  all: 'All Days',
  weekdays: 'Weekdays (Mon–Fri)',
  weekends: 'Weekends (Sat–Sun)',
  specific_dates: 'Specific Date Ranges',
};

const CURRENT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ============================================
// COMPONENT
// ============================================

export function RateDerivationRules() {
  // Data
  const [rules, setRules] = useState<DerivationRule[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterConnection, setFilterConnection] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DerivationRule | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<DerivationRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Calculate Preview
  const [previewRuleId, setPreviewRuleId] = useState<string>('');
  const [previewBaseRate, setPreviewBaseRate] = useState<string>('100');
  const [previewResult, setPreviewResult] = useState<CalculateResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState<RuleFormData>({
    name: '',
    description: '',
    connectionId: '',
    sourceRatePlanId: '',
    operation: 'percentage',
    adjustmentValue: 0,
    roundingMethod: 'nearest',
    minRate: '',
    maxRate: '',
    floorRate: '',
    ceilingRate: '',
    appliesTo: 'all',
    priority: 0,
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

      const [rulesRes, ratePlansRes, connectionsRes] = await Promise.all([
        fetch(`/api/channels/rate-derivation?${params}`),
        fetch(`/api/pms/rate-plans?tenantId=${'current'}`),
        fetch(`/api/channels/connections`),
      ]);

      const [rulesData, rpData, connData] = await Promise.all([
        rulesRes.json(),
        ratePlansRes.json(),
        connectionsRes.json(),
      ]);

      if (rulesData.success) setRules(rulesData.data || []);
      if (rpData.success) setRatePlans(rpData.data || []);
      if (connData.success) setConnections(connData.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load rate derivation data');
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

  // ============================================
  // FORM HELPERS
  // ============================================
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      connectionId: '',
      sourceRatePlanId: '',
      operation: 'percentage',
      adjustmentValue: 0,
      roundingMethod: 'nearest',
      minRate: '',
      maxRate: '',
      floorRate: '',
      ceilingRate: '',
      appliesTo: 'all',
      priority: 0,
      isActive: true,
      effectiveFrom: '',
      effectiveTo: '',
    });
    setEditingRule(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (rule: DerivationRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      connectionId: rule.connectionId || '',
      sourceRatePlanId: rule.sourceRatePlanId,
      operation: rule.operation,
      adjustmentValue: rule.adjustmentValue,
      roundingMethod: rule.roundingMethod,
      minRate: rule.minRate?.toString() || '',
      maxRate: rule.maxRate?.toString() || '',
      floorRate: rule.floorRate?.toString() || '',
      ceilingRate: rule.ceilingRate?.toString() || '',
      appliesTo: rule.appliesTo,
      priority: rule.priority,
      isActive: rule.isActive,
      effectiveFrom: rule.effectiveFrom ? rule.effectiveFrom.split('T')[0] : '',
      effectiveTo: rule.effectiveTo ? rule.effectiveTo.split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  // ============================================
  // CRUD OPERATIONS
  // ============================================
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Rule name is required');
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
        sourceRatePlanId: formData.sourceRatePlanId,
        channelCode: formData.connectionId
          ? connections.find(c => c.id === formData.connectionId)?.channel || null
          : null,
        operation: formData.operation,
        adjustmentValue: parseFloat(String(formData.adjustmentValue)) || 0,
        roundingMethod: formData.roundingMethod,
        minRate: formData.minRate ? parseFloat(formData.minRate) : null,
        maxRate: formData.maxRate ? parseFloat(formData.maxRate) : null,
        floorRate: formData.floorRate ? parseFloat(formData.floorRate) : null,
        ceilingRate: formData.ceilingRate ? parseFloat(formData.ceilingRate) : null,
        appliesTo: formData.appliesTo,
        priority: formData.priority,
        isActive: formData.isActive,
        effectiveFrom: formData.effectiveFrom || null,
        effectiveTo: formData.effectiveTo || null,
      };

      const url = editingRule
        ? '/api/channels/rate-derivation'
        : '/api/channels/rate-derivation';
      const method = editingRule ? 'PUT' : 'POST';

      const body = editingRule
        ? { id: editingRule.id, ...payload }
        : payload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editingRule ? 'Rule updated successfully' : 'Rule created successfully');
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to save rule');
      }
    } catch {
      toast.error('Network error saving rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRule) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/channels/rate-derivation', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingRule.id }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Rule deleted successfully');
        setDeleteDialogOpen(false);
        setDeletingRule(null);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to delete rule');
      }
    } catch {
      toast.error('Network error deleting rule');
    } finally {
      setDeleting(false);
    }
  };

  // ============================================
  // CALCULATE PREVIEW
  // ============================================
  const handleCalculatePreview = async () => {
    if (!previewRuleId) {
      toast.error('Select a rule to preview');
      return;
    }
    const baseRate = parseFloat(previewBaseRate);
    if (!baseRate || baseRate < 0) {
      toast.error('Enter a valid base rate');
      return;
    }

    setPreviewLoading(true);
    setPreviewResult(null);
    try {
      const res = await fetch('/api/channels/rate-derivation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calculate', baseRate, ruleId: previewRuleId }),
      });
      const data = await res.json();

      if (data.success) {
        setPreviewResult(data.data);
      } else {
        toast.error(data.error?.message || 'Calculation failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setPreviewLoading(false);
    }
  };

  // ============================================
  // FILTERED RULES
  // ============================================
  const filteredRules = rules.filter(rule => {
    if (filterConnection !== 'all' && rule.connectionId !== filterConnection) return false;
    if (filterStatus === 'active' && !rule.isActive) return false;
    if (filterStatus === 'inactive' && rule.isActive) return false;
    return true;
  });

  // ============================================
  // RENDER HELPERS
  // ============================================
  const getOperationIcon = (op: string) => {
    switch (op) {
      case 'percentage': return <Percent className="h-4 w-4" />;
      case 'fixed_amount': return <CircleDollarSign className="h-4 w-4" />;
      case 'margin': return <TrendingUp className="h-4 w-4" />;
      case 'competitor_match': return <Target className="h-4 w-4" />;
      default: return <ArrowRightLeft className="h-4 w-4" />;
    }
  };

  const getOperationBadge = (op: string, val: number) => {
    const sign = val >= 0 ? '+' : '';
    const display = op === 'fixed_amount'
      ? `${sign}$${val.toFixed(2)}`
      : op === 'margin'
        ? `${val}% margin`
        : `${sign}${val}%`;

    const colorClass = val < 0
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0';

    return <Badge className={`${colorClass} gap-1 text-xs`}>{display}</Badge>;
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
        <Skeleton className="h-20 rounded-lg" />
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
            <ArrowRightLeft className="h-6 w-6 text-primary" />
            Rate Derivation Rules
          </h1>
          <p className="text-muted-foreground mt-1">
            Automatically derive channel-specific rates from your base/master rate plans
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <ArrowRightLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{rules.length}</p>
                <p className="text-xs text-muted-foreground">Total Rules</p>
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
                  {rules.filter(r => r.isActive).length}
                </p>
                <p className="text-xs text-muted-foreground">Active Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <XCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                  {rules.filter(r => !r.isActive).length}
                </p>
                <p className="text-xs text-muted-foreground">Inactive Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <Percent className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-700 dark:text-violet-400 tabular-nums">
                  {new Set(rules.filter(r => r.isActive).map(r => r.sourceRatePlanId)).size}
                </p>
                <p className="text-xs text-muted-foreground">Rate Plans Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calculate Preview Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Rate Derivation Preview
          </CardTitle>
          <CardDescription className="text-xs">
            Enter a base rate and select a rule to see the derived channel rate
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
                  value={previewBaseRate}
                  onChange={(e) => setPreviewBaseRate(e.target.value)}
                  className="pl-9"
                  placeholder="100.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="space-y-2 flex-1 min-w-0">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Derivation Rule
              </Label>
              <Select value={previewRuleId} onValueChange={setPreviewRuleId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a rule" />
                </SelectTrigger>
                <SelectContent>
                  {rules.filter(r => r.isActive).map((rule) => (
                    <SelectItem key={rule.id} value={rule.id}>
                      {rule.name} — {rule.sourceRatePlanName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleCalculatePreview}
              disabled={previewLoading || !previewRuleId || !previewBaseRate}
              className="gap-2"
            >
              {previewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              Calculate
            </Button>
          </div>

          {/* Preview Result */}
          {previewResult && (
            <div className="mt-4 p-4 rounded-lg border bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Base Rate</p>
                  <p className="text-lg font-bold tabular-nums">${previewResult.baseRate.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Operation</p>
                  <p className="text-sm font-medium flex items-center gap-1">
                    {getOperationIcon(previewResult.operation)}
                    {OPERATION_LABELS[previewResult.operation]}
                    <Badge variant="outline" className="text-[10px] ml-1">
                      {previewResult.adjustmentValue >= 0 ? '+' : ''}{previewResult.adjustmentValue}
                      {previewResult.operation === 'fixed_amount' ? '' : '%'}
                    </Badge>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rounding</p>
                  <p className="text-sm font-medium">{ROUNDING_LABELS[previewResult.roundingMethod]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Derived Rate</p>
                  <p className={`text-lg font-bold tabular-nums ${previewResult.derivedRate !== previewResult.baseRate ? (previewResult.derivedRate > previewResult.baseRate ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400') : ''}`}>
                    ${previewResult.derivedRate.toFixed(2)}
                  </p>
                </div>
              </div>
              {(previewResult.floorRate || previewResult.ceilingRate) && (
                <div className="mt-2 pt-2 border-t flex items-center gap-4 text-xs text-muted-foreground">
                  {previewResult.floorRate && <span>Floor: ${previewResult.floorRate.toFixed(2)}</span>}
                  {previewResult.ceilingRate && <span>Ceiling: ${previewResult.ceilingRate.toFixed(2)}</span>}
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
              {filteredRules.length} of {rules.length} rules
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules Table */}
      {filteredRules.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead>Source Rate Plan</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Adjustment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applies To</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => (
                    <TableRow key={rule.id} className={!rule.isActive ? 'opacity-60' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[180px]">{rule.name}</p>
                          {rule.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{rule.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {rule.sourceRatePlanName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {rule.connectionChannel ? (
                          <Badge variant="secondary" className="text-xs">
                            {rule.connectionChannel}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">All</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          {getOperationIcon(rule.operation)}
                          <span className="capitalize">
                            {rule.operation.replace('_', ' ')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getOperationBadge(rule.operation, rule.adjustmentValue)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            rule.isActive
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400 border-0'
                          }
                        >
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{APPLIES_TO_LABELS[rule.appliesTo] || rule.appliesTo}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold tabular-nums">{rule.priority}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(rule)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingRule(rule);
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
            <h3 className="text-lg font-semibold mb-2">No Rules Found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              {rules.length > 0
                ? 'No rules match the current filters. Try adjusting your filter criteria.'
                : 'Create your first rate derivation rule to automatically calculate channel-specific rates from your base rate plans.'}
            </p>
            {rules.length === 0 && (
              <Button onClick={openCreateDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create First Rule
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
              <p className="font-medium text-foreground">How Rate Derivation Works</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>Percentage:</strong> Add/subtract a percentage from the base rate (e.g., BAR - 5%)</li>
                <li><strong>Fixed Amount:</strong> Add/subtract a fixed amount (e.g., BAR + $10)</li>
                <li><strong>Margin:</strong> Apply a margin markup (e.g., base rate / (1 - 15%))</li>
                <li><strong>Competitor Match:</strong> Set rate as a percentage of the base (e.g., base * 1.10)</li>
              </ul>
              <p className="text-xs">
                Rules are evaluated by priority (highest first). Floor/ceiling constraints always take precedence.
                Effective date ranges allow scheduling rules for specific periods.
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
              {editingRule ? 'Edit Rate Derivation Rule' : 'Create Rate Derivation Rule'}
            </DialogTitle>
            <DialogDescription>
              {editingRule
                ? 'Modify the rate derivation rule configuration'
                : 'Define how channel-specific rates are derived from a source rate plan'}
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
                <Label>Rule Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Booking.com -10% from BAR"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description for this rule..."
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* Source & Target */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Source & Target
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Rate Plan *</Label>
                  <Select
                    value={formData.sourceRatePlanId}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, sourceRatePlanId: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rate plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {ratePlans.map((rp) => (
                        <SelectItem key={rp.id} value={rp.id}>
                          {rp.name} ({rp.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Channel Connection</Label>
                  <Select
                    value={formData.connectionId}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, connectionId: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All channels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">All Channels (no specific connection)</SelectItem>
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
                  <Label>Operation Type</Label>
                  <Select
                    value={formData.operation}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, operation: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(OPERATION_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {OPERATION_DESCRIPTIONS[formData.operation]}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Adjustment Value *</Label>
                  <Input
                    type="number"
                    value={formData.adjustmentValue}
                    onChange={(e) => setFormData(prev => ({ ...prev, adjustmentValue: parseFloat(e.target.value) || 0 }))}
                    placeholder="e.g., -5 or 10"
                    step="0.01"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.operation === 'fixed_amount'
                      ? 'Positive to add, negative to subtract'
                      : formData.operation === 'margin'
                        ? 'Margin percentage (e.g., 20 for 20% margin)'
                        : 'Positive to increase, negative to decrease'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Rounding Method</Label>
                <Select
                  value={formData.roundingMethod}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, roundingMethod: val }))}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROUNDING_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Rate Constraints */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Rate Constraints
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Floor Rate</Label>
                  <Input
                    type="number"
                    value={formData.floorRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, floorRate: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, ceilingRate: e.target.value }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Min Rate</Label>
                  <Input
                    type="number"
                    value={formData.minRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, minRate: e.target.value }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Max Rate</Label>
                  <Input
                    type="number"
                    value={formData.maxRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxRate: e.target.value }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Floor/Ceiling are hard limits that override the derived rate. Min/Max are advisory limits.
              </p>
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
                    min="0"
                    max="100"
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher priority rules are evaluated first
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Effective From</Label>
                  <Input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData(prev => ({ ...prev, effectiveFrom: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Effective To</Label>
                  <Input
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData(prev => ({ ...prev, effectiveTo: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">
                  Only active rules are applied during rate derivation
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { resetForm(); setDialogOpen(false); }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : editingRule ? (
                <Pencil className="h-4 w-4 mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Rate Derivation Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingRule?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RateDerivationRules;
