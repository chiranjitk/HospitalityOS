'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Receipt,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Loader2,
  Search,
  Calculator,
  Send,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  Layers,
  Eye,
  EyeOff,
  Info,
  ChevronDown,
  Globe,
  Percent,
  Tag,
  CheckCircle2,
  XCircle,
  ArrowRight,
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

interface TaxMapping {
  id: string;
  tenantId: string;
  propertyId?: string | null;
  connectionId?: string | null;
  channelCode: string;
  internalTaxId?: string | null;
  internalTaxName: string;
  taxType: string;
  taxRate: number;
  displayMode: string;
  channelTaxCode?: string | null;
  channelTaxName?: string | null;
  appliesTo: string;
  isIncludedInRate: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  connection?: ChannelConnection | null;
}

interface TaxSummary {
  total: number;
  active: number;
  inclusive: number;
  exclusive: number;
  showSeparately: number;
}

interface PreviewBreakdown {
  id: string;
  taxName: string;
  channelTaxName: string;
  taxType: string;
  taxRate: number;
  displayMode: string;
  appliesTo: string;
  isIncludedInRate: boolean;
  taxAmount: number;
  channelTaxCode?: string | null;
}

interface PreviewResult {
  baseRate: number;
  netRate: number;
  inclusiveTaxes: number;
  exclusiveTaxes: number;
  totalTaxes: number;
  finalRate: number;
  breakdown: PreviewBreakdown[];
  channelCode: string;
  note: string;
}

interface SyncResult {
  connectionId: string;
  channelCode: string;
  channelName: string;
  totalMappings: number;
  syncedAt: string;
  status: string;
  message: string;
}

// ============================================
// CONSTANTS
// ============================================

const TAX_TYPES = [
  { value: 'occupancy', label: 'Occupancy Tax' },
  { value: 'vat', label: 'VAT' },
  { value: 'gst', label: 'GST' },
  { value: 'service_charge', label: 'Service Charge' },
  { value: 'city_tax', label: 'City Tax' },
  { value: 'tourism_tax', label: 'Tourism Tax' },
  { value: 'resort_fee', label: 'Resort Fee' },
  { value: 'other', label: 'Other' },
];

const DISPLAY_MODES = [
  { value: 'inclusive', label: 'Inclusive', description: 'Tax included in displayed rate' },
  { value: 'exclusive', label: 'Exclusive', description: 'Tax added on top of rate' },
  { value: 'show_separately', label: 'Show Separately', description: 'Tax shown as separate line item' },
];

const APPLIES_TO_OPTIONS = [
  { value: 'room_rate', label: 'Room Rate' },
  { value: 'total_amount', label: 'Total Amount' },
  { value: 'extra_charges', label: 'Extra Charges' },
  { value: 'specific_items', label: 'Specific Items' },
];

// ============================================
// HELPERS
// ============================================

function formatCurrency(amount: number): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function getTaxTypeLabel(value: string): string {
  return TAX_TYPES.find((t) => t.value === value)?.label || value;
}

function getDisplayModeLabel(value: string): string {
  return DISPLAY_MODES.find((d) => d.value === value)?.label || value;
}

function getAppliesToLabel(value: string): string {
  return APPLIES_TO_OPTIONS.find((a) => a.value === value)?.label || value;
}

function getDisplayModeBadge(mode: string) {
  switch (mode) {
    case 'inclusive':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 gap-1 text-xs">
          <Eye className="h-3 w-3" />Inclusive
        </Badge>
      );
    case 'exclusive':
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 gap-1 text-xs">
          <EyeOff className="h-3 w-3" />Exclusive
        </Badge>
      );
    case 'show_separately':
      return (
        <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-0 gap-1 text-xs">
          <Layers className="h-3 w-3" />Separate
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-xs">{mode}</Badge>;
  }
}

function getTaxTypeBadgeColor(type: string): string {
  switch (type) {
    case 'vat':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'gst':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 'service_charge':
      return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400';
    case 'city_tax':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    case 'tourism_tax':
      return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400';
    case 'resort_fee':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400';
  }
}

// ============================================
// FORM DEFAULTS
// ============================================

const emptyForm = {
  connectionId: '',
  channelCode: '',
  internalTaxName: '',
  taxType: 'occupancy',
  taxRate: 0,
  displayMode: 'inclusive',
  channelTaxCode: '',
  channelTaxName: '',
  appliesTo: 'room_rate',
  isIncludedInRate: true,
  isActive: true,
};

type FormData = typeof emptyForm;

// ============================================
// COMPONENT
// ============================================

export default function TaxMappingDashboard() {
  // State: data
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [mappings, setMappings] = useState<TaxMapping[]>([]);
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionsLoading, setConnectionsLoading] = useState(true);

  // State: filters
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('all');
  const [selectedTaxType, setSelectedTaxType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // State: dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<TaxMapping | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);

  // State: delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // State: preview
  const [previewRate, setPreviewRate] = useState<string>('100');
  const [previewConnectionId, setPreviewConnectionId] = useState<string>('');
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // State: sync
  const [syncConnectionId, setSyncConnectionId] = useState<string>('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // ============================================
  // FETCH CONNECTIONS
  // ============================================
  useEffect(() => {
    let cancelled = false;
    async function fetchConnections() {
      setConnectionsLoading(true);
      try {
        const res = await fetch('/api/channels/connections');
        const data = await res.json();
        if (cancelled) return;
        if (data.success && Array.isArray(data.data)) {
          setConnections(data.data);
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching connections:', err);
      } finally {
        if (!cancelled) setConnectionsLoading(false);
      }
    }
    fetchConnections();
    return () => { cancelled = true; };
  }, []);

  // ============================================
  // FETCH MAPPINGS
  // ============================================
  const [filterVersion, setFilterVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedConnectionId && selectedConnectionId !== 'all') {
          params.set('connectionId', selectedConnectionId);
        }
        if (selectedTaxType && selectedTaxType !== 'all') {
          params.set('taxType', selectedTaxType);
        }
        if (statusFilter !== 'all') {
          params.set('isActive', String(statusFilter === 'active'));
        }
        const res = await fetch(`/api/channels/tax-mapping?${params}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setMappings(data.data.mappings || []);
          setSummary(data.data.summary || null);
        } else {
          toast.error(data.error?.message || 'Failed to fetch tax mappings');
        }
      } catch {
        if (!cancelled) toast.error('Network error fetching tax mappings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [selectedConnectionId, selectedTaxType, statusFilter, filterVersion]);

  const refreshMappings = useCallback(() => {
    setFilterVersion((v) => v + 1);
  }, []);

  // ============================================
  // FILTERED MAPPINGS
  // ============================================
  const filteredMappings = searchQuery
    ? mappings.filter(
        (m) =>
          m.internalTaxName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.channelCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (m.channelTaxCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (m.channelTaxName || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : mappings;

  // ============================================
  // DIALOG HANDLERS
  // ============================================
  function openCreateDialog() {
    setEditingMapping(null);
    setFormData({
      ...emptyForm,
      connectionId: selectedConnectionId !== 'all' ? selectedConnectionId : '',
    });
    setDialogOpen(true);
  }

  function openEditDialog(mapping: TaxMapping) {
    setEditingMapping(mapping);
    setFormData({
      connectionId: mapping.connectionId || '',
      channelCode: mapping.channelCode,
      internalTaxName: mapping.internalTaxName,
      taxType: mapping.taxType,
      taxRate: mapping.taxRate,
      displayMode: mapping.displayMode,
      channelTaxCode: mapping.channelTaxCode || '',
      channelTaxName: mapping.channelTaxName || '',
      appliesTo: mapping.appliesTo,
      isIncludedInRate: mapping.isIncludedInRate,
      isActive: mapping.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formData.internalTaxName.trim()) {
      toast.error('Internal Tax Name is required');
      return;
    }

    setSubmitting(true);
    try {
      const selectedConn = connections.find((c) => c.id === formData.connectionId);
      const payload = {
        ...formData,
        channelCode: selectedConn ? selectedConn.channel : formData.channelCode,
        taxRate: parseFloat(String(formData.taxRate)) || 0,
      };

      const res = editingMapping
        ? await fetch('/api/channels/tax-mapping', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingMapping.id, ...payload }),
          })
        : await fetch('/api/channels/tax-mapping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const data = await res.json();

      if (data.success) {
        toast.success(editingMapping ? 'Tax mapping updated successfully' : 'Tax mapping created successfully');
        setDialogOpen(false);
        refreshMappings();
      } else {
        toast.error(data.error?.message || 'Operation failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  // ============================================
  // DELETE HANDLER
  // ============================================
  function confirmDelete(id: string) {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/channels/tax-mapping?id=${deletingId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Tax mapping deleted');
        setDeleteDialogOpen(false);
        refreshMappings();
      } else {
        toast.error(data.error?.message || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(false);
    }
  }

  // ============================================
  // TOGGLE ACTIVE
  // ============================================
  async function toggleActive(mapping: TaxMapping) {
    try {
      const res = await fetch('/api/channels/tax-mapping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mapping.id, isActive: !mapping.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(mapping.isActive ? 'Mapping deactivated' : 'Mapping activated');
        refreshMappings();
      } else {
        toast.error(data.error?.message || 'Failed to toggle');
      }
    } catch {
      toast.error('Network error');
    }
  }

  // ============================================
  // PREVIEW
  // ============================================
  async function handlePreview() {
    const rate = parseFloat(previewRate);
    if (!rate || rate <= 0) {
      toast.error('Please enter a valid base rate');
      return;
    }
    if (!previewConnectionId) {
      toast.error('Please select a channel connection');
      return;
    }

    setPreviewLoading(true);
    setPreviewExpanded(false);
    try {
      const res = await fetch('/api/channels/tax-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          baseRate: rate,
          connectionId: previewConnectionId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewResult(data.data);
      } else {
        toast.error(data.error?.message || 'Preview failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setPreviewLoading(false);
    }
  }

  // ============================================
  // BULK SYNC
  // ============================================
  async function handleBulkSync() {
    if (!syncConnectionId) {
      toast.error('Please select a channel to sync');
      return;
    }
    setSyncLoading(true);
    try {
      const res = await fetch('/api/channels/tax-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-sync',
          connectionId: syncConnectionId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncResult(data.data);
        toast.success(data.data.message || 'Tax mappings synced successfully');
      } else {
        toast.error(data.error?.message || 'Sync failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSyncLoading(false);
    }
  }

  // ============================================
  // LOADING STATE
  // ============================================
  if (connectionsLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 rounded" />
            <Skeleton className="h-4 w-96 mt-2 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <TooltipProvider>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Receipt className="h-6 w-6 text-primary" />
              Tax Mapping
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure how taxes are displayed and calculated per OTA channel
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={refreshMappings} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Mapping
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-500/20">
                    <Layers className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{summary.total}</p>
                    <p className="text-xs text-muted-foreground">Total Mappings</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20">
                    <Eye className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{summary.inclusive}</p>
                    <p className="text-xs text-muted-foreground">Inclusive Taxes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <EyeOff className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">{summary.exclusive}</p>
                    <p className="text-xs text-muted-foreground">Exclusive Taxes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-sky-500/10 to-sky-600/5 border-sky-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/20">
                    <Globe className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-sky-700 dark:text-sky-400 tabular-nums">{summary.active}</p>
                    <p className="text-xs text-muted-foreground">Active Channels</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Channel Connection
                </Label>
                <Select value={selectedConnectionId} onValueChange={(val) => setSelectedConnectionId(val)}>
                  <SelectTrigger className="w-full">
                    <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="All Connections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Connections</SelectItem>
                    {connections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.displayName || c.channel}
                        {c.status !== 'active' && (
                          <span className="ml-2 text-xs text-muted-foreground">({c.status})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tax Type
                </Label>
                <Select value={selectedTaxType} onValueChange={(val) => setSelectedTaxType(val)}>
                  <SelectTrigger className="w-full">
                    <Percent className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {TAX_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </Label>
                <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as 'all' | 'active' | 'inactive')}>
                  <SelectTrigger className="w-full">
                    <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Search
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Tax name, code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-96 rounded-lg" />
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredMappings.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Receipt className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? 'No Matching Tax Mappings' : 'No Tax Mappings Yet'}
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                {searchQuery
                  ? 'Try adjusting your search or filters to find what you are looking for.'
                  : 'Configure how taxes are displayed and calculated per OTA channel. Start by adding your first tax mapping.'}
              </p>
              {!searchQuery && (
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tax Mapping
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mappings Table */}
        {!loading && filteredMappings.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Tax Mappings
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {filteredMappings.length} mapping{filteredMappings.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tax Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead>Display Mode</TableHead>
                      <TableHead>Channel Tax Code</TableHead>
                      <TableHead>Included</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{mapping.internalTaxName}</p>
                            {mapping.connection?.displayName && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {mapping.connection.displayName}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`border-0 text-xs ${getTaxTypeBadgeColor(mapping.taxType)}`}>
                            {getTaxTypeLabel(mapping.taxType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {mapping.taxRate}%
                        </TableCell>
                        <TableCell>{getDisplayModeBadge(mapping.displayMode)}</TableCell>
                        <TableCell>
                          {mapping.channelTaxCode ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                                  {mapping.channelTaxCode}
                                </code>
                              </TooltipTrigger>
                              <TooltipContent>
                                {mapping.channelTaxName || mapping.channelTaxCode}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={mapping.isIncludedInRate}
                            disabled
                            className="pointer-events-none"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(mapping)}
                            className="h-7 w-7 p-0"
                          >
                            {mapping.isActive ? (
                              <ToggleRight className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(mapping)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => confirmDelete(mapping.id)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
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
        )}

        {/* Tax Preview Calculator */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Tax Preview Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Channel Connection
                </Label>
                <Select value={previewConnectionId} onValueChange={(val) => setPreviewConnectionId(val)}>
                  <SelectTrigger className="w-full">
                    <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.displayName || c.channel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Base Room Rate
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="100.00"
                    value={previewRate}
                    onChange={(e) => setPreviewRate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  &nbsp;
                </Label>
                <Button onClick={handlePreview} disabled={previewLoading || !previewConnectionId} className="w-full">
                  {previewLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4 mr-2" />
                  )}
                  Calculate Preview
                </Button>
              </div>

              {previewResult && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Final Rate
                  </Label>
                  <div className="text-2xl font-bold text-primary tabular-nums">
                    {formatCurrency(previewResult.finalRate)}
                  </div>
                </div>
              )}
            </div>

            {/* Preview Breakdown */}
            {previewResult && previewResult.breakdown.length > 0 && (
              <div className="border rounded-lg">
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  onClick={() => setPreviewExpanded(!previewExpanded)}
                >
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-medium">Tax Breakdown</span>
                    <span className="text-muted-foreground">Base: {formatCurrency(previewResult.baseRate)}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">Net: {formatCurrency(previewResult.netRate)}</span>
                    <span className="text-amber-600 dark:text-amber-400">+Taxes: {formatCurrency(previewResult.totalTaxes)}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold text-primary">{formatCurrency(previewResult.finalRate)}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${previewExpanded ? 'rotate-180' : ''}`} />
                </button>

                {previewExpanded && (
                  <div className="border-t p-3 space-y-2">
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tax</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead>Applies To</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewResult.breakdown.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.channelTaxName}</TableCell>
                            <TableCell>
                              <Badge className={`border-0 text-xs ${getTaxTypeBadgeColor(item.taxType)}`}>
                                {getTaxTypeLabel(item.taxType)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{item.taxRate}%</TableCell>
                            <TableCell>{getDisplayModeBadge(item.displayMode)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{getAppliesToLabel(item.appliesTo)}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {formatCurrency(item.taxAmount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                    <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                      <Info className="h-3 w-3" />
                      <span>{previewResult.note}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {previewResult && previewResult.breakdown.length === 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                <Info className="h-4 w-4" />
                <span>{previewResult.note || 'No active tax mappings configured for this channel.'}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bulk Sync */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Send className="h-4 w-4" />
              Bulk Sync to Channel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="space-y-2 flex-1 w-full sm:w-auto">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Channel to Sync
                </Label>
                <Select value={syncConnectionId} onValueChange={(val) => setSyncConnectionId(val)}>
                  <SelectTrigger className="w-full">
                    <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.filter((c) => c.status === 'active').map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.displayName || c.channel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleBulkSync} disabled={syncLoading || !syncConnectionId}>
                {syncLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Sync Tax Configuration
              </Button>
            </div>

            {syncResult && (
              <div className="mt-4 flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">{syncResult.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Synced at {new Date(syncResult.syncedAt).toLocaleString()} — {syncResult.totalMappings} mapping(s)
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingMapping ? 'Edit Tax Mapping' : 'Add Tax Mapping'}</DialogTitle>
              <DialogDescription>
                {editingMapping
                  ? 'Update the tax mapping configuration for this channel.'
                  : 'Configure how an internal tax maps to a channel tax.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Internal Tax Name */}
              <div className="space-y-2">
                <Label htmlFor="internalTaxName" className="text-sm font-medium">
                  Internal Tax Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="internalTaxName"
                  placeholder="e.g. State Occupancy Tax"
                  value={formData.internalTaxName}
                  onChange={(e) => setFormData({ ...formData, internalTaxName: e.target.value })}
                />
              </div>

              {/* Channel Connection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Channel Connection</Label>
                <Select
                  value={formData.connectionId}
                  onValueChange={(val) => {
                    const conn = connections.find((c) => c.id === val);
                    setFormData({
                      ...formData,
                      connectionId: val,
                      channelCode: conn ? conn.channel : formData.channelCode,
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Select connection" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.displayName || c.channel}
                        {c.status !== 'active' && ` (${c.status})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Channel Tax Code */}
              <div className="space-y-2">
                <Label htmlFor="channelTaxCode" className="text-sm font-medium">Channel Tax Code</Label>
                <Input
                  id="channelTaxCode"
                  placeholder="e.g. TX_OCC_STD"
                  value={formData.channelTaxCode}
                  onChange={(e) => setFormData({ ...formData, channelTaxCode: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  The tax code used by the OTA channel
                </p>
              </div>

              {/* Channel Tax Name */}
              <div className="space-y-2">
                <Label htmlFor="channelTaxName" className="text-sm font-medium">Channel Tax Name</Label>
                <Input
                  id="channelTaxName"
                  placeholder="e.g. Occupancy Tax"
                  value={formData.channelTaxName}
                  onChange={(e) => setFormData({ ...formData, channelTaxName: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Display name shown on the OTA channel
                </p>
              </div>

              {/* Tax Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tax Type</Label>
                <Select
                  value={formData.taxType}
                  onValueChange={(val) => setFormData({ ...formData, taxType: val })}
                >
                  <SelectTrigger className="w-full">
                    <Percent className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tax Rate */}
              <div className="space-y-2">
                <Label htmlFor="taxRate" className="text-sm font-medium">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                  className="max-w-32"
                />
              </div>

              {/* Display Mode */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Display Mode</Label>
                <Select
                  value={formData.displayMode}
                  onValueChange={(val) => setFormData({ ...formData, displayMode: val })}
                >
                  <SelectTrigger className="w-full">
                    <Layers className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPLAY_MODES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        <span className="flex flex-col">
                          <span>{d.label}</span>
                          <span className="text-xs text-muted-foreground">{d.description}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Applies To */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Applies To</Label>
                <Select
                  value={formData.appliesTo}
                  onValueChange={(val) => setFormData({ ...formData, appliesTo: val })}
                >
                  <SelectTrigger className="w-full">
                    <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLIES_TO_OPTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Toggles */}
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Included in Rate</Label>
                  <p className="text-xs text-muted-foreground">Tax is already included in the displayed rate</p>
                </div>
                <Switch
                  checked={formData.isIncludedInRate}
                  onCheckedChange={(val) => setFormData({ ...formData, isIncludedInRate: val })}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Active</Label>
                  <p className="text-xs text-muted-foreground">This mapping is currently in use</p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(val) => setFormData({ ...formData, isActive: val })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : editingMapping ? (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                {editingMapping ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Tax Mapping</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this tax mapping? This action cannot be undone. The tax configuration will be removed from the channel.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
