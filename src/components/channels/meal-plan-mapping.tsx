'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
  UtensilsCrossed,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Coffee,
  Sunset,
  Moon,
  Wine,
  ArrowRight,
  Filter,
  Search,
  Upload,
  DollarSign,
  Info,
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

interface MealPlanMapping {
  id: string;
  tenantId: string;
  propertyId: string | null;
  connectionId: string | null;
  internalMealPlanId: string;
  internalMealPlanName: string;
  channelCode: string;
  channelMealPlanCode: string;
  channelMealPlanName: string | null;
  mealPlanType: string;
  includesBreakfast: boolean;
  includesLunch: boolean;
  includesDinner: boolean;
  includesDrinks: boolean;
  supplementAmount: number | null;
  supplementType: string | null;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  connectionDisplayName: string | null;
  connectionChannel: string | null;
}

interface MappingStats {
  total: number;
  active: number;
  inactive: number;
  byType: Record<string, number>;
}

interface MappingFormData {
  internalMealPlanName: string;
  connectionId: string;
  channelCode: string;
  channelMealPlanCode: string;
  channelMealPlanName: string;
  mealPlanType: string;
  includesBreakfast: boolean;
  includesLunch: boolean;
  includesDinner: boolean;
  includesDrinks: boolean;
  supplementAmount: string;
  supplementType: string;
  currency: string;
  isActive: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const MEAL_PLAN_TYPE_LABELS: Record<string, string> = {
  room_only: 'Room Only',
  bed_breakfast: 'Bed & Breakfast',
  breakfast_included: 'Breakfast Included',
  half_board: 'Half Board',
  full_board: 'Full Board',
  all_inclusive: 'All Inclusive',
  lunch_included: 'Lunch Included',
  dinner_included: 'Dinner Included',
  custom: 'Custom',
};

const MEAL_PLAN_TYPE_COLORS: Record<string, string> = {
  room_only: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400 border-0',
  bed_breakfast: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0',
  breakfast_included: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0',
  half_board: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0',
  full_board: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-0',
  all_inclusive: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-0',
  lunch_included: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-0',
  dinner_included: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-0',
  custom: 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-400 border-0',
};

const SUPPLEMENT_TYPE_LABELS: Record<string, string> = {
  per_night: 'Per Night',
  per_stay: 'Per Stay',
  per_person_per_night: 'Per Person / Night',
  percentage: 'Percentage',
};

// ============================================
// COMPONENT
// ============================================

export function MealPlanMappingManager() {
  // Data
  const [mappings, setMappings] = useState<MealPlanMapping[]>([]);
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [stats, setStats] = useState<MappingStats>({ total: 0, active: 0, inactive: 0, byType: {} });
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterConnection, setFilterConnection] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<MealPlanMapping | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingMapping, setDeletingMapping] = useState<MealPlanMapping | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk sync
  const [syncing, setSyncing] = useState(false);

  // Form data
  const [formData, setFormData] = useState<MappingFormData>({
    internalMealPlanName: '',
    connectionId: '',
    channelCode: '',
    channelMealPlanCode: '',
    channelMealPlanName: '',
    mealPlanType: 'bed_breakfast',
    includesBreakfast: false,
    includesLunch: false,
    includesDinner: false,
    includesDrinks: false,
    supplementAmount: '',
    supplementType: 'per_night',
    currency: 'USD',
    isActive: true,
  });

  // ============================================
  // FETCH DATA
  // ============================================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mappingsRes, connectionsRes] = await Promise.all([
        fetch(`/api/channels/meal-plan-mapping?tenantId=${'current'}`),
        fetch(`/api/channels/connections`),
      ]);

      const [mappingsData, connData] = await Promise.all([
        mappingsRes.json(),
        connectionsRes.json(),
      ]);

      if (mappingsData.success) {
        setMappings(mappingsData.data || []);
        setStats(mappingsData.stats || { total: 0, active: 0, inactive: 0, byType: {} });
      }
      if (connData.success) setConnections(connData.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load meal plan mapping data');
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
      internalMealPlanName: '',
      connectionId: '',
      channelCode: '',
      channelMealPlanCode: '',
      channelMealPlanName: '',
      mealPlanType: 'bed_breakfast',
      includesBreakfast: false,
      includesLunch: false,
      includesDinner: false,
      includesDrinks: false,
      supplementAmount: '',
      supplementType: 'per_night',
      currency: 'USD',
      isActive: true,
    });
    setEditingMapping(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (mapping: MealPlanMapping) => {
    setEditingMapping(mapping);
    setFormData({
      internalMealPlanName: mapping.internalMealPlanName,
      connectionId: mapping.connectionId || '',
      channelCode: mapping.channelCode,
      channelMealPlanCode: mapping.channelMealPlanCode,
      channelMealPlanName: mapping.channelMealPlanName || '',
      mealPlanType: mapping.mealPlanType,
      includesBreakfast: mapping.includesBreakfast,
      includesLunch: mapping.includesLunch,
      includesDinner: mapping.includesDinner,
      includesDrinks: mapping.includesDrinks,
      supplementAmount: mapping.supplementAmount?.toString() || '',
      supplementType: mapping.supplementType || 'per_night',
      currency: mapping.currency,
      isActive: mapping.isActive,
    });
    setDialogOpen(true);
  };

  // ============================================
  // CRUD OPERATIONS
  // ============================================
  const handleSave = async () => {
    if (!formData.internalMealPlanName.trim()) {
      toast.error('Internal meal plan name is required');
      return;
    }
    if (!formData.channelCode.trim()) {
      toast.error('Channel code is required');
      return;
    }
    if (!formData.channelMealPlanCode.trim()) {
      toast.error('Channel meal plan code is required');
      return;
    }

    setSaving(true);
    try {
      const connection = connections.find(c => c.id === formData.connectionId);
      const payload = {
        tenantId: 'current',
        connectionId: formData.connectionId || null,
        internalMealPlanId: editingMapping?.internalMealPlanId || crypto.randomUUID(),
        internalMealPlanName: formData.internalMealPlanName.trim(),
        channelCode: formData.channelCode.trim() || (connection?.channel || ''),
        channelMealPlanCode: formData.channelMealPlanCode.trim(),
        channelMealPlanName: formData.channelMealPlanName.trim() || null,
        mealPlanType: formData.mealPlanType,
        includesBreakfast: formData.includesBreakfast,
        includesLunch: formData.includesLunch,
        includesDinner: formData.includesDinner,
        includesDrinks: formData.includesDrinks,
        supplementAmount: formData.supplementAmount ? parseFloat(formData.supplementAmount) : null,
        supplementType: formData.supplementType || 'per_night',
        currency: formData.currency || 'USD',
        isActive: formData.isActive,
      };

      const url = '/api/channels/meal-plan-mapping';
      const method = editingMapping ? 'PUT' : 'POST';
      const body = editingRulePayload(payload, editingMapping);

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editingMapping ? 'Mapping updated successfully' : 'Mapping created successfully');
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to save mapping');
      }
    } catch {
      toast.error('Network error saving mapping');
    } finally {
      setSaving(false);
    }
  };

  const editingRulePayload = (payload: Record<string, unknown>, editingMapping: MealPlanMapping | null) => {
    return editingMapping ? { id: editingMapping.id, ...payload } : payload;
  };

  const handleDelete = async () => {
    if (!deletingMapping) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/channels/meal-plan-mapping', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingMapping.id }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Mapping deleted successfully');
        setDeleteDialogOpen(false);
        setDeletingMapping(null);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to delete mapping');
      }
    } catch {
      toast.error('Network error deleting mapping');
    } finally {
      setDeleting(false);
    }
  };

  // ============================================
  // BULK SYNC
  // ============================================
  const handleBulkSync = async () => {
    if (!filterConnection || filterConnection === 'all') {
      toast.error('Select a channel connection first to sync');
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch('/api/channels/meal-plan-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-sync',
          connectionId: filterConnection,
          tenantId: 'current',
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`Successfully pushed ${data.data.mappingsPushed} meal plan mappings to ${data.data.channel}`);
      } else {
        toast.error(data.error?.message || 'Bulk sync failed');
      }
    } catch {
      toast.error('Network error during bulk sync');
    } finally {
      setSyncing(false);
    }
  };

  // ============================================
  // FILTERED MAPPINGS
  // ============================================
  const filteredMappings = mappings.filter(m => {
    if (filterConnection !== 'all' && m.connectionId !== filterConnection) return false;
    if (filterType !== 'all' && m.mealPlanType !== filterType) return false;
    if (filterStatus === 'active' && !m.isActive) return false;
    if (filterStatus === 'inactive' && m.isActive) return false;
    return true;
  });

  // ============================================
  // RENDER HELPERS
  // ============================================
  const getIncludesBadges = (mapping: MealPlanMapping) => {
    const items: { included: boolean; icon: React.ReactNode; label: string }[] = [
      { included: mapping.includesBreakfast, icon: <Coffee className="h-3 w-3" />, label: 'B' },
      { included: mapping.includesLunch, icon: <Sunset className="h-3 w-3" />, label: 'L' },
      { included: mapping.includesDinner, icon: <Moon className="h-3 w-3" />, label: 'D' },
      { included: mapping.includesDrinks, icon: <Wine className="h-3 w-3" />, label: '🥂' },
    ];

    return (
      <div className="flex items-center gap-1">
        {items.map(item => (
          <Badge
            key={item.label}
            variant={item.included ? 'default' : 'outline'}
            className={`h-6 w-6 flex items-center justify-center p-0 text-[10px] ${
              item.included
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0'
                : 'opacity-40'
            }`}
            title={item.included ? `${item.label} Included` : `${item.label} Not Included`}
          >
            {item.included ? item.icon : <XCircle className="h-2.5 w-2.5" />}
          </Badge>
        ))}
      </div>
    );
  };

  const getSupplementDisplay = (mapping: MealPlanMapping) => {
    if (!mapping.supplementAmount) return <span className="text-xs text-muted-foreground">—</span>;
    const typeLabel = SUPPLEMENT_TYPE_LABELS[mapping.supplementType || 'per_night'] || mapping.supplementType;
    return (
      <div className="flex flex-col">
        <span className="text-xs font-medium tabular-nums">
          {mapping.supplementType === 'percentage'
            ? `${mapping.supplementAmount}%`
            : `${mapping.currency} ${mapping.supplementAmount.toFixed(2)}`}
        </span>
        <span className="text-[10px] text-muted-foreground">{typeLabel}</span>
      </div>
    );
  };

  const topTypes = Object.entries(stats.byType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-16 rounded-lg" />
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
            <UtensilsCrossed className="h-6 w-6 text-primary" />
            Meal Plan Mapping
          </h1>
          <p className="text-muted-foreground mt-1">
            Map your internal meal plans to channel-specific codes used by OTAs and booking platforms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Mapping
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <UtensilsCrossed className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Mappings</p>
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

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <XCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                  {stats.inactive}
                </p>
                <p className="text-xs text-muted-foreground">Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <ArrowRight className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-700 dark:text-violet-400 tabular-nums">
                  {topTypes.length}
                </p>
                <p className="text-xs text-muted-foreground">Plan Types Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Bulk Sync */}
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
                Meal Plan Type
              </Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(MEAL_PLAN_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
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

            <div className="flex items-center gap-2 self-center">
              <Button
                onClick={handleBulkSync}
                disabled={syncing || filterConnection === 'all'}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Push to Channel
              </Button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{filteredMappings.length} of {mappings.length} mappings</span>
            {topTypes.length > 0 && (
              <span className="flex items-center gap-1">
                &middot; Top types:
                {topTypes.map(([type, count]) => (
                  <Badge key={type} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {MEAL_PLAN_TYPE_LABELS[type] || type}: {count}
                  </Badge>
                ))}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mappings Table */}
      {filteredMappings.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Internal Plan</TableHead>
                    <TableHead className="min-w-[130px]">Type</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Channel Code</TableHead>
                    <TableHead>Channel Name</TableHead>
                    <TableHead className="min-w-[120px]">Includes</TableHead>
                    <TableHead className="min-w-[100px]">Supplement</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMappings.map((mapping) => (
                    <TableRow key={mapping.id} className={!mapping.isActive ? 'opacity-60' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{mapping.internalMealPlanName}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {mapping.internalMealPlanId.slice(0, 8)}...
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${MEAL_PLAN_TYPE_COLORS[mapping.mealPlanType] || ''}`}>
                          {MEAL_PLAN_TYPE_LABELS[mapping.mealPlanType] || mapping.mealPlanType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {mapping.connectionChannel ? (
                          <Badge variant="secondary" className="text-xs">
                            {mapping.connectionChannel}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{mapping.channelCode}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono font-medium">{mapping.channelMealPlanCode}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{mapping.channelMealPlanName || '—'}</span>
                      </TableCell>
                      <TableCell>
                        {getIncludesBadges(mapping)}
                      </TableCell>
                      <TableCell>
                        {getSupplementDisplay(mapping)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            mapping.isActive
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400 border-0'
                          }
                        >
                          {mapping.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(mapping)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingMapping(mapping);
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
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Search className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Mappings Found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              {mappings.length > 0
                ? 'No mappings match the current filters. Try adjusting your filter criteria.'
                : 'Create your first meal plan mapping to link internal meal plans with channel-specific codes used by OTAs.'}
            </p>
            {mappings.length === 0 && (
              <Button onClick={openCreateDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create First Mapping
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
              <p className="font-medium text-foreground">About Meal Plan Mapping</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>Booking.com:</strong> Uses numeric codes — 1=Room Only, 2=Bed & Breakfast, 3=Half Board, 4=Full Board, 7=All Inclusive</li>
                <li><strong>Expedia:</strong> Uses string codes — RO, BB, HB, FB, AI</li>
                <li><strong>Supplements:</strong> Define additional charges for meal upgrades (per night, per stay, per person, or percentage)</li>
                <li><strong>Bulk Sync:</strong> Push all active mappings to a specific channel connection at once</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMapping ? 'Edit Meal Plan Mapping' : 'Create Meal Plan Mapping'}
            </DialogTitle>
            <DialogDescription>
              {editingMapping
                ? 'Modify the meal plan mapping configuration'
                : 'Map your internal meal plan to a channel-specific meal plan code'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Internal Meal Plan */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4" />
                Internal Meal Plan
              </h3>
              <div className="space-y-2">
                <Label>Meal Plan Name *</Label>
                <Input
                  value={formData.internalMealPlanName}
                  onChange={(e) => setFormData(prev => ({ ...prev, internalMealPlanName: e.target.value }))}
                  placeholder="e.g., Bed & Breakfast, Half Board"
                />
              </div>
            </div>

            <Separator />

            {/* Channel Connection */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Channel Connection
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel Connection</Label>
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
                    onChange={(e) => setFormData(prev => ({ ...prev, channelCode: e.target.value }))}
                    placeholder="e.g., booking, expedia"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Channel Meal Plan */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Channel Meal Plan
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel Meal Plan Code *</Label>
                  <Input
                    value={formData.channelMealPlanCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, channelMealPlanCode: e.target.value }))}
                    placeholder="e.g., 1, BB, 7"
                  />
                  <p className="text-xs text-muted-foreground">
                    The code used by the channel (e.g., Booking.com uses 1-7)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Channel Meal Plan Name</Label>
                  <Input
                    value={formData.channelMealPlanName}
                    onChange={(e) => setFormData(prev => ({ ...prev, channelMealPlanName: e.target.value }))}
                    placeholder="e.g., Bed and Breakfast"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Meal Plan Type */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4" />
                Meal Plan Type
              </h3>
              <div className="space-y-2">
                <Label>Plan Type</Label>
                <Select
                  value={formData.mealPlanType}
                  onValueChange={(val) => {
                    const autoIncludes: Record<string, { includesBreakfast: boolean; includesLunch: boolean; includesDinner: boolean; includesDrinks: boolean }> = {
                      room_only: { includesBreakfast: false, includesLunch: false, includesDinner: false, includesDrinks: false },
                      bed_breakfast: { includesBreakfast: true, includesLunch: false, includesDinner: false, includesDrinks: false },
                      breakfast_included: { includesBreakfast: true, includesLunch: false, includesDinner: false, includesDrinks: false },
                      half_board: { includesBreakfast: true, includesLunch: false, includesDinner: true, includesDrinks: false },
                      full_board: { includesBreakfast: true, includesLunch: true, includesDinner: true, includesDrinks: false },
                      all_inclusive: { includesBreakfast: true, includesLunch: true, includesDinner: true, includesDrinks: true },
                      lunch_included: { includesBreakfast: false, includesLunch: true, includesDinner: false, includesDrinks: false },
                      dinner_included: { includesBreakfast: false, includesLunch: false, includesDinner: true, includesDrinks: false },
                      custom: { includesBreakfast: false, includesLunch: false, includesDinner: false, includesDrinks: false },
                    };
                    const inc = autoIncludes[val] || autoIncludes.custom;
                    setFormData(prev => ({ ...prev, mealPlanType: val, ...inc }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MEAL_PLAN_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Includes Checkboxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includesBreakfast"
                    checked={formData.includesBreakfast}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, includesBreakfast: !!checked }))}
                  />
                  <Label htmlFor="includesBreakfast" className="text-xs flex items-center gap-1 cursor-pointer">
                    <Coffee className="h-3.5 w-3.5" />
                    Breakfast
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includesLunch"
                    checked={formData.includesLunch}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, includesLunch: !!checked }))}
                  />
                  <Label htmlFor="includesLunch" className="text-xs flex items-center gap-1 cursor-pointer">
                    <Sunset className="h-3.5 w-3.5" />
                    Lunch
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includesDinner"
                    checked={formData.includesDinner}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, includesDinner: !!checked }))}
                  />
                  <Label htmlFor="includesDinner" className="text-xs flex items-center gap-1 cursor-pointer">
                    <Moon className="h-3.5 w-3.5" />
                    Dinner
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includesDrinks"
                    checked={formData.includesDrinks}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, includesDrinks: !!checked }))}
                  />
                  <Label htmlFor="includesDrinks" className="text-xs flex items-center gap-1 cursor-pointer">
                    <Wine className="h-3.5 w-3.5" />
                    Drinks
                  </Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Supplement */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Supplement
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={formData.supplementAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, supplementAmount: e.target.value }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={formData.supplementType}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, supplementType: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SUPPLEMENT_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input
                    value={formData.currency}
                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                    placeholder="USD"
                    maxLength={3}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Active</Label>
                <p className="text-xs text-muted-foreground">Only active mappings are included in channel syncs</p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: !!checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingMapping ? 'Update Mapping' : 'Create Mapping'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meal Plan Mapping</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the mapping for &quot;{deletingMapping?.internalMealPlanName}&quot;?
              This action cannot be undone. The channel will no longer receive this meal plan during syncs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
