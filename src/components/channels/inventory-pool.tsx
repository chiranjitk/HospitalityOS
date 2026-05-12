'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Database,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Layers,
  BarChart3,
  Activity,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
  Scale,
  Percent,
  ArrowUpDown,
  Calculator,
} from 'lucide-react';
import { toast } from 'sonner';

// =====================================================
// TYPES
// =====================================================

interface PoolChannel {
  id: string;
  connectionId: string;
  channelCode: string;
  weight: number;
  minAllocation: number;
  maxAllocation: number | null;
  priority: number;
  isActive: boolean;
}

interface Pool {
  id: string;
  tenantId: string;
  propertyId: string | null;
  name: string;
  description: string | null;
  roomTypeId: string | null;
  totalRooms: number;
  bufferRooms: number;
  overbookingLimit: number;
  allocationStrategy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  poolChannels: PoolChannel[];
}

interface PoolStats {
  totalPools: number;
  totalRoomsPooled: number;
  activeChannels: number;
  avgUtilization: number;
}

interface ChannelConnection {
  id: string;
  channel: string;
  displayName: string | null;
  status: string;
}

interface AllocationResult {
  date: string;
  sellableRooms: number;
  allocations: Array<{
    connectionId: string;
    displayName: string;
    channelCode: string;
    allocated: number;
  }>;
}

interface PoolData {
  pools: Pool[];
  stats: PoolStats;
}

// =====================================================
// STRATEGY INFO
// =====================================================

const STRATEGY_INFO: Record<string, { label: string; icon: any; description: string; detail: string }> = {
  equal: {
    label: 'Equal',
    icon: Scale,
    description: 'Rooms are distributed equally across all channels',
    detail: 'Each channel gets the same base allocation (totalRooms ÷ channelCount). Remainder rooms are distributed one each to channels in order.',
  },
  priority: {
    label: 'Priority',
    icon: ArrowUpDown,
    description: 'Higher-priority channels are allocated rooms first',
    detail: 'Channels are sorted by priority (higher first). Each gets up to its maxAllocation until rooms run out. Use this to favor your best-performing channels.',
  },
  weighted: {
    label: 'Weighted',
    icon: BarChart3,
    description: 'Rooms are distributed proportionally by weight',
    detail: 'Each channel\'s allocation is proportional to its weight relative to the total weight. Fractional rooms are distributed using largest-remainder method.',
  },
  percentage: {
    label: 'Percentage',
    icon: Percent,
    description: 'Weight field is treated as percentage (0-100)',
    detail: 'Each channel\'s weight represents its share percentage of the pool. Weights are normalized to 100% before distribution.',
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStrategyBadgeColor(strategy: string): string {
  switch (strategy) {
    case 'equal': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800';
    case 'priority': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800';
    case 'weighted': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800';
    case 'percentage': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800';
    default: return '';
  }
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function InventoryPooling() {
  // State
  const [data, setData] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pool form dialog
  const [showPoolDialog, setShowPoolDialog] = useState(false);
  const [editingPool, setEditingPool] = useState<Pool | null>(null);
  const [saving, setSaving] = useState(false);

  // Channel dialog
  const [showChannelDialog, setShowChannelDialog] = useState(false);
  const [selectedPoolForChannel, setSelectedPoolForChannel] = useState<Pool | null>(null);

  // Channel connections (available to add)
  const [connections, setConnections] = useState<ChannelConnection[]>([]);

  // Calculator dialog
  const [showCalcDialog, setShowCalcDialog] = useState(false);
  const [calcPoolId, setCalcPoolId] = useState<string>('');
  const [calcStartDate, setCalcStartDate] = useState(formatDate(new Date()));
  const [calcEndDate, setCalcEndDate] = useState(formatDate(new Date(Date.now() + 13 * 86400000)));
  const [calcResults, setCalcResults] = useState<AllocationResult[] | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Expanded pool (for details)
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);

  // Strategy info expanded
  const [showStrategyInfo, setShowStrategyInfo] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTotalRooms, setFormTotalRooms] = useState(0);
  const [formBufferRooms, setFormBufferRooms] = useState(0);
  const [formOverbooking, setFormOverbooking] = useState(0);
  const [formStrategy, setFormStrategy] = useState('equal');

  // Channel add form
  const [channelFormConnectionId, setChannelFormConnectionId] = useState('');
  const [channelFormWeight, setChannelFormWeight] = useState(1);
  const [channelFormMinAlloc, setChannelFormMinAlloc] = useState(0);
  const [channelFormMaxAlloc, setChannelFormMaxAlloc] = useState<string>('');
  const [channelFormPriority, setChannelFormPriority] = useState(0);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/channels/inventory-pool');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error?.message || 'Failed to load inventory pools');
      }
    } catch {
      setError('Network error — please retry');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch available connections
  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/channels/connections?status=active');
      const json = await res.json();
      if (json.success && json.data) {
        setConnections(json.data.connections || json.data || []);
      }
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchData();
      if (!cancelled) await fetchConnections();
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => data?.stats, [data]);
  const pools = useMemo(() => data?.pools || [], [data]);

  // Reset form
  const resetPoolForm = useCallback(() => {
    setFormName('');
    setFormDescription('');
    setFormTotalRooms(0);
    setFormBufferRooms(0);
    setFormOverbooking(0);
    setFormStrategy('equal');
    setEditingPool(null);
  }, []);

  const resetChannelForm = useCallback(() => {
    setChannelFormConnectionId('');
    setChannelFormWeight(1);
    setChannelFormMinAlloc(0);
    setChannelFormMaxAlloc('');
    setChannelFormPriority(0);
  }, []);

  // Open create pool dialog
  const handleCreatePool = useCallback(() => {
    resetPoolForm();
    setShowPoolDialog(true);
  }, [resetPoolForm]);

  // Open edit pool dialog
  const handleEditPool = useCallback((pool: Pool) => {
    setEditingPool(pool);
    setFormName(pool.name);
    setFormDescription(pool.description || '');
    setFormTotalRooms(pool.totalRooms);
    setFormBufferRooms(pool.bufferRooms);
    setFormOverbooking(pool.overbookingLimit);
    setFormStrategy(pool.allocationStrategy);
    setShowPoolDialog(true);
  }, []);

  // Save pool
  const handleSavePool = useCallback(async () => {
    if (!formName.trim()) {
      toast.error('Pool name is required');
      return;
    }
    setSaving(true);
    try {
      const url = '/api/channels/inventory-pool';
      const method = editingPool ? 'PUT' : 'POST';
      const body = {
        ...(editingPool ? { id: editingPool.id } : {}),
        name: formName.trim(),
        description: formDescription.trim() || null,
        totalRooms: Number(formTotalRooms),
        bufferRooms: Number(formBufferRooms),
        overbookingLimit: Number(formOverbooking),
        allocationStrategy: formStrategy,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(editingPool ? 'Pool updated successfully' : 'Pool created successfully');
        setShowPoolDialog(false);
        resetPoolForm();
        fetchData();
      } else {
        toast.error(json.error?.message || 'Failed to save pool');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }, [editingPool, formName, formDescription, formTotalRooms, formBufferRooms, formOverbooking, formStrategy, resetPoolForm, fetchData]);

  // Delete pool
  const handleDeletePool = useCallback(async (pool: Pool) => {
    if (!confirm(`Delete "${pool.name}"? This will also remove all daily allocation records.`)) return;
    try {
      const res = await fetch('/api/channels/inventory-pool', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pool.id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Pool deleted successfully');
        fetchData();
      } else {
        toast.error(json.error?.message || 'Failed to delete pool');
      }
    } catch {
      toast.error('Network error');
    }
  }, [fetchData]);

  // Open add channel dialog
  const handleOpenAddChannel = useCallback((pool: Pool) => {
    setSelectedPoolForChannel(pool);
    resetChannelForm();
    setShowChannelDialog(true);
  }, [resetChannelForm]);

  // Add channel to pool
  const handleAddChannel = useCallback(async () => {
    if (!selectedPoolForChannel || !channelFormConnectionId) {
      toast.error('Please select a channel');
      return;
    }

    const conn = connections.find(c => c.id === channelFormConnectionId);
    if (!conn) {
      toast.error('Channel not found');
      return;
    }

    try {
      const res = await fetch('/api/channels/inventory-pool?action=add-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId: selectedPoolForChannel.id,
          connectionId: channelFormConnectionId,
          channelCode: conn.channel,
          weight: Number(channelFormWeight),
          minAllocation: Number(channelFormMinAlloc),
          maxAllocation: channelFormMaxAlloc ? Number(channelFormMaxAlloc) : null,
          priority: Number(channelFormPriority),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Channel added to pool');
        setShowChannelDialog(false);
        resetChannelForm();
        fetchData();
      } else {
        toast.error(json.error?.message || 'Failed to add channel');
      }
    } catch {
      toast.error('Network error');
    }
  }, [selectedPoolForChannel, channelFormConnectionId, connections, channelFormWeight, channelFormMinAlloc, channelFormMaxAlloc, channelFormPriority, resetChannelForm, fetchData]);

  // Remove channel from pool
  const handleRemoveChannel = useCallback(async (poolId: string, connectionId: string) => {
    if (!confirm('Remove this channel from the pool?')) return;
    try {
      const res = await fetch('/api/channels/inventory-pool?action=remove-channel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId, connectionId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Channel removed from pool');
        fetchData();
      } else {
        toast.error(json.error?.message || 'Failed to remove channel');
      }
    } catch {
      toast.error('Network error');
    }
  }, [fetchData]);

  // Calculate allocations
  const handleCalculate = useCallback(async () => {
    if (!calcPoolId) {
      toast.error('Select a pool');
      return;
    }
    setCalculating(true);
    setCalcResults(null);
    try {
      const res = await fetch('/api/channels/inventory-pool?action=calculate-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId: calcPoolId,
          startDate: calcStartDate,
          endDate: calcEndDate,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCalcResults(json.data.results);
        toast.success(`Allocations calculated for ${json.data.results.length} days`);
      } else {
        toast.error(json.error?.message || 'Failed to calculate allocations');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCalculating(false);
    }
  }, [calcPoolId, calcStartDate, calcEndDate]);

  // Toggle pool active
  const handleToggleActive = useCallback(async (pool: Pool) => {
    try {
      const res = await fetch('/api/channels/inventory-pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pool.id, isActive: !pool.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(pool.isActive ? 'Pool deactivated' : 'Pool activated');
        fetchData();
      }
    } catch {
      toast.error('Network error');
    }
  }, [fetchData]);

  // =====================================================
  // RENDER: Loading
  // =====================================================
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  // =====================================================
  // RENDER: Error
  // =====================================================
  if (error) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <XCircle className="h-12 w-12 text-red-500" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // =====================================================
  // RENDER: Main UI
  // =====================================================
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Inventory Pooling</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create shared inventory pools across channels to maximize occupancy
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={handleCreatePool}>
            <Plus className="h-4 w-4 mr-1" /> Create Pool
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2.5 dark:bg-blue-950/40">
                <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Pools</p>
                <p className="text-2xl font-bold">{stats?.totalPools ?? 0}</p>
                <p className="text-xs text-muted-foreground">active pools</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-50 p-2.5 dark:bg-purple-950/40">
                <Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Rooms Pooled</p>
                <p className="text-2xl font-bold">{stats?.totalRoomsPooled ?? 0}</p>
                <p className="text-xs text-muted-foreground">total rooms</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-950/40">
                <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active Channels</p>
                <p className="text-2xl font-bold">{stats?.activeChannels ?? 0}</p>
                <p className="text-xs text-muted-foreground">in pools</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-50 p-2.5 dark:bg-amber-950/40">
                <BarChart3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Avg Utilization</p>
                <p className="text-2xl font-bold">{stats?.avgUtilization ?? 0}%</p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      (stats?.avgUtilization ?? 0) >= 90 ? 'bg-red-500' : (stats?.avgUtilization ?? 0) >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(stats?.avgUtilization ?? 0, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calculator Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Allocation Calculator</CardTitle>
          </div>
          <CardDescription>Calculate daily allocations for a pool across a date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Pool</Label>
              <Select value={calcPoolId} onValueChange={setCalcPoolId}>
                <SelectTrigger className="w-56 h-9 text-sm">
                  <SelectValue placeholder="Select pool..." />
                </SelectTrigger>
                <SelectContent>
                  {pools.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Start Date</Label>
              <Input type="date" value={calcStartDate} onChange={e => setCalcStartDate(e.target.value)} className="w-40 h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">End Date</Label>
              <Input type="date" value={calcEndDate} onChange={e => setCalcEndDate(e.target.value)} className="w-40 h-9 text-sm" />
            </div>
            <Button size="sm" onClick={handleCalculate} disabled={!calcPoolId || calculating}>
              {calculating ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Calculator className="h-4 w-4 mr-1" />}
              {calculating ? 'Calculating...' : 'Calculate'}
            </Button>
          </div>

          {/* Calculation Results */}
          {calcResults && calcResults.length > 0 && (
            <div className="mt-4 space-y-3">
              <ScrollArea className="max-h-96 overflow-auto">
                {calcResults.map((day) => (
                  <div key={day.date} className="border rounded-lg p-3 mb-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{formatDisplayDate(day.date)}</span>
                      <Badge variant="outline" className="text-xs">
                        {day.sellableRooms} sellable
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {day.allocations.map((alloc) => (
                        <div key={alloc.connectionId} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-24 truncate" title={alloc.displayName}>
                            {alloc.displayName}
                          </span>
                          <div className="flex-1">
                            <Progress
                              value={day.sellableRooms > 0 ? (alloc.allocated / day.sellableRooms) * 100 : 0}
                              className="h-3"
                            />
                          </div>
                          <span className="text-sm font-semibold w-12 text-right">{alloc.allocated}</span>
                          <span className="text-xs text-muted-foreground w-16 text-right">
                            {day.sellableRooms > 0 ? Math.round((alloc.allocated / day.sellableRooms) * 100) : 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Strategy Explanation */}
      <Card>
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowStrategyInfo(!showStrategyInfo)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Allocation Strategies</CardTitle>
            </div>
            {showStrategyInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CardHeader>
        {showStrategyInfo && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(STRATEGY_INFO).map(([key, info]) => {
                const IconComp = info.icon;
                return (
                  <div key={key} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <IconComp className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline" className={getStrategyBadgeColor(key)}>
                        {info.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{info.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{info.detail}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Pool List */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Pools</h3>
        {pools.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <Database className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground text-center">
                No inventory pools yet.<br />
                Create your first pool to start sharing inventory across channels.
              </p>
              <Button onClick={handleCreatePool}>
                <Plus className="h-4 w-4 mr-1" /> Create Pool
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pools.map((pool) => {
              const isExpanded = expandedPoolId === pool.id;
              const sellable = Math.max(0, pool.totalRooms - pool.bufferRooms);
              const stratInfo = STRATEGY_INFO[pool.allocationStrategy] || STRATEGY_INFO.equal;
              const StratIcon = stratInfo.icon;

              return (
                <Card key={pool.id} className={!pool.isActive ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    {/* Pool Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setExpandedPoolId(isExpanded ? null : pool.id)}
                          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Database className="h-5 w-5 text-primary" />
                          </div>
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{pool.name}</h4>
                            <Badge variant="outline" className={getStrategyBadgeColor(pool.allocationStrategy)}>
                              <StratIcon className="h-3 w-3 mr-1" /> {stratInfo.label}
                            </Badge>
                            {!pool.isActive && (
                              <Badge variant="secondary" className="text-xs">Inactive</Badge>
                            )}
                          </div>
                          {pool.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{pool.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Switch
                          checked={pool.isActive}
                          onCheckedChange={() => handleToggleActive(pool)}
                        />
                        <Button variant="outline" size="sm" onClick={() => handleEditPool(pool)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleDeletePool(pool)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex flex-wrap items-center gap-4 mt-3 ml-14">
                      <div className="text-center">
                        <p className="text-lg font-bold">{pool.totalRooms}</p>
                        <p className="text-[10px] text-muted-foreground">Total Rooms</p>
                      </div>
                      <Separator orientation="vertical" className="h-8" />
                      <div className="text-center">
                        <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{pool.bufferRooms}</p>
                        <p className="text-[10px] text-muted-foreground">Buffer</p>
                      </div>
                      <Separator orientation="vertical" className="h-8" />
                      <div className="text-center">
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{sellable}</p>
                        <p className="text-[10px] text-muted-foreground">Sellable</p>
                      </div>
                      <Separator orientation="vertical" className="h-8" />
                      <div className="text-center">
                        <p className="text-lg font-bold">{pool.poolChannels.filter(c => c.isActive).length}</p>
                        <p className="text-[10px] text-muted-foreground">Channels</p>
                      </div>
                    </div>

                    {/* Expanded: Channel Management */}
                    {isExpanded && (
                      <div className="mt-4 ml-14 border rounded-lg p-4 bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="text-sm font-semibold">Pool Channels</h5>
                          <Button size="sm" variant="outline" onClick={() => handleOpenAddChannel(pool)}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Add Channel
                          </Button>
                        </div>

                        {pool.poolChannels.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            No channels in this pool. Add channels to start distributing inventory.
                          </p>
                        ) : (
                          <ScrollArea className="max-h-64 overflow-auto">
                            <div className="space-y-2">
                              {pool.poolChannels.map((ch) => {
                                const conn = connections.find(c => c.id === ch.connectionId);
                                const displayName = conn?.displayName || conn?.channel || ch.channelCode;

                                return (
                                  <div key={ch.id} className="flex items-center gap-3 border rounded-lg p-3 bg-background">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium truncate">{displayName}</span>
                                        <Badge variant="outline" className="text-[10px]">{ch.channelCode}</Badge>
                                        {!ch.isActive && (
                                          <Badge variant="secondary" className="text-[10px]">Off</Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                        <span>Weight: <b>{ch.weight}</b></span>
                                        <span>Min: <b>{ch.minAllocation}</b></span>
                                        <span>Max: <b>{ch.maxAllocation ?? '∞'}</b></span>
                                        <span>Priority: <b>{ch.priority}</b></span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {pool.poolChannels.length > 1 && sellable > 0 && (
                                        <span className="text-xs text-muted-foreground w-16 text-right">
                                          {ch.weight > 0 ? Math.round((ch.weight / pool.poolChannels.reduce((s, c) => s + c.weight, 0)) * 100) : 0}%
                                        </span>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-7 w-7 p-0"
                                        onClick={() => handleRemoveChannel(pool.id, ch.connectionId)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        )}

                        {/* Distribution visualization */}
                        {pool.poolChannels.length > 0 && sellable > 0 && (
                          <div className="mt-4">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Distribution Preview ({stratInfo.label} strategy)</p>
                            <div className="flex h-6 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
                              {pool.poolChannels.filter(c => c.isActive).map((ch, i) => {
                                const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500', 'bg-cyan-500', 'bg-pink-500', 'bg-teal-500'];
                                const totalWeight = pool.poolChannels.filter(c => c.isActive).reduce((s, c) => s + c.weight, 0);
                                const pct = totalWeight > 0 ? (ch.weight / totalWeight) * 100 : 0;
                                return (
                                  <div
                                    key={ch.id}
                                    className={`${colors[i % colors.length]} transition-all`}
                                    style={{ width: `${Math.max(pct, 2)}%` }}
                                    title={`${ch.channelCode}: ${Math.round(pct)}%`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================================================== */}
      {/* Create/Edit Pool Dialog */}
      {/* ===================================================== */}
      <Dialog open={showPoolDialog} onOpenChange={(open) => { setShowPoolDialog(open); if (!open) resetPoolForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPool ? 'Edit Pool' : 'Create Inventory Pool'}</DialogTitle>
            <DialogDescription>
              {editingPool ? 'Update pool settings and allocation strategy.' : 'Set up a shared inventory pool for channel distribution.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Pool Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Deluxe Room Pool"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Rooms</Label>
                <Input
                  type="number"
                  min={0}
                  value={formTotalRooms}
                  onChange={(e) => setFormTotalRooms(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Buffer Rooms</Label>
                <Input
                  type="number"
                  min={0}
                  value={formBufferRooms}
                  onChange={(e) => setFormBufferRooms(Number(e.target.value))}
                />
                <p className="text-[10px] text-muted-foreground">Rooms reserved for direct/overbooking</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Overbooking Limit</Label>
                <Input
                  type="number"
                  min={0}
                  value={formOverbooking}
                  onChange={(e) => setFormOverbooking(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Allocation Strategy</Label>
                <Select value={formStrategy} onValueChange={setFormStrategy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STRATEGY_INFO).map(([key, info]) => (
                      <SelectItem key={key} value={key}>{info.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formTotalRooms > 0 && (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>
                    Sellable rooms: <b>{Math.max(0, formTotalRooms - formBufferRooms)}</b> of {formTotalRooms}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPoolDialog(false); resetPoolForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSavePool} disabled={saving || !formName.trim()}>
              {saving ? 'Saving...' : editingPool ? 'Update Pool' : 'Create Pool'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================================================== */}
      {/* Add Channel Dialog */}
      {/* ===================================================== */}
      <Dialog open={showChannelDialog} onOpenChange={(open) => { setShowChannelDialog(open); if (!open) resetChannelForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Channel to Pool</DialogTitle>
            <DialogDescription>
              Add a channel connection to &quot;{selectedPoolForChannel?.name}&quot; for inventory distribution.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Channel Connection *</Label>
              <Select value={channelFormConnectionId} onValueChange={setChannelFormConnectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a channel..." />
                </SelectTrigger>
                <SelectContent>
                  {connections
                    .filter(c => {
                      // Filter out channels already in this pool
                      if (!selectedPoolForChannel) return true;
                      return !selectedPoolForChannel.poolChannels.some(pc => pc.connectionId === c.id);
                    })
                    .map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.displayName || c.channel} ({c.channel})
                      </SelectItem>
                    ))
                  }
                  {connections.filter(c => {
                    if (!selectedPoolForChannel) return true;
                    return !selectedPoolForChannel.poolChannels.some(pc => pc.connectionId === c.id);
                  }).length === 0 && (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No available channels. All connections are already in this pool.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Weight</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={channelFormWeight}
                  onChange={(e) => setChannelFormWeight(Number(e.target.value))}
                />
                <p className="text-[10px] text-muted-foreground">Proportion share</p>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  min={0}
                  value={channelFormPriority}
                  onChange={(e) => setChannelFormPriority(Number(e.target.value))}
                />
                <p className="text-[10px] text-muted-foreground">Higher = first served</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Allocation</Label>
                <Input
                  type="number"
                  min={0}
                  value={channelFormMinAlloc}
                  onChange={(e) => setChannelFormMinAlloc(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Allocation</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Unlimited"
                  value={channelFormMaxAlloc}
                  onChange={(e) => setChannelFormMaxAlloc(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowChannelDialog(false); resetChannelForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddChannel} disabled={!channelFormConnectionId}>
              Add Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InventoryPooling;
