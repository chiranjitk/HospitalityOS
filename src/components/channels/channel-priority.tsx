'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowUpDown,
  Star,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  RefreshCw,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Globe,
  Zap,
  TrendingUp,
  BarChart3,
  Weight,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

// =====================================================
// TYPES
// =====================================================

interface ConnectionInfo {
  id: string;
  channel: string;
  displayName: string;
  status: string;
  lastSyncAt?: string | null;
}

interface ChannelPriorityItem {
  id: string;
  tenantId: string;
  propertyId: string | null;
  connectionId: string;
  channelCode: string;
  priority: number;
  syncOrder: number;
  preferredChannel: boolean;
  inventoryWeight: number;
  rateWeight: number;
  bookingWeight: number;
  maxInventoryPercent: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  connection: ConnectionInfo | null;
}

interface UnconfiguredConnection {
  id: string;
  channel: string;
  displayName: string;
  status: string;
}

interface PriorityData {
  priorities: ChannelPriorityItem[];
  unconfigured: UnconfiguredConnection[];
  summary: {
    totalConfigured: number;
    totalUnconfigured: number;
    preferredChannel: { id: string; channelCode: string; connectionId: string } | null;
    avgPriority: number;
  };
}

// =====================================================
// HELPERS
// =====================================================

function getPriorityColor(priority: number): string {
  if (priority <= 3) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800';
  if (priority <= 6) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800';
  return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
}

function getPriorityLabel(priority: number): string {
  if (priority <= 2) return 'Critical';
  if (priority <= 4) return 'High';
  if (priority <= 6) return 'Medium';
  if (priority <= 8) return 'Low';
  return 'Minimal';
}

function getPriorityDot(priority: number): string {
  if (priority <= 3) return 'bg-emerald-500';
  if (priority <= 6) return 'bg-amber-500';
  return 'bg-red-500';
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function ChannelPrioritySettings() {
  const [data, setData] = useState<PriorityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit dialog state
  const [editingItem, setEditingItem] = useState<ChannelPriorityItem | null>(null);
  const [editForm, setEditForm] = useState({
    priority: 5,
    inventoryWeight: 1,
    rateWeight: 1,
    bookingWeight: 1,
    maxInventoryPercent: 100,
    notes: '',
    isActive: true,
  });

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingFor, setCreatingFor] = useState<UnconfiguredConnection | null>(null);
  const [createForm, setCreateForm] = useState({
    priority: 5,
    inventoryWeight: 1,
    rateWeight: 1,
    bookingWeight: 1,
    maxInventoryPercent: 100,
  });

  // Refresh function — must be declared before useEffect that depends on it
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/channels/priority');
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error?.message || 'Failed to load');
        }
      } catch {
        if (cancelled) return;
        setError('Network error — please retry');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const priorities = useMemo(() => data?.priorities || [], [data]);
  const unconfigured = useMemo(() => data?.unconfigured || [], [data]);
  const summary = useMemo(() => data?.summary, [data]);

  // =====================================================
  // ACTIONS
  // =====================================================

  const handleMoveUp = useCallback(async (index: number) => {
    if (index <= 0) return;
    const newItems = [...priorities];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];

    const reorderPayload = newItems.map((item, idx) => ({
      id: item.id,
      priority: idx + 1,
      syncOrder: idx + 1,
    }));

    try {
      const res = await fetch('/api/channels/priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', items: reorderPayload }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Priority order updated');
        refresh();
      } else {
        toast.error('Failed to reorder');
      }
    } catch {
      toast.error('Network error');
    }
  }, [priorities, refresh]);

  const handleMoveDown = useCallback(async (index: number) => {
    if (index >= priorities.length - 1) return;
    const newItems = [...priorities];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];

    const reorderPayload = newItems.map((item, idx) => ({
      id: item.id,
      priority: idx + 1,
      syncOrder: idx + 1,
    }));

    try {
      const res = await fetch('/api/channels/priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', items: reorderPayload }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Priority order updated');
        refresh();
      } else {
        toast.error('Failed to reorder');
      }
    } catch {
      toast.error('Network error');
    }
  }, [priorities, refresh]);

  const handleSetPreferred = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/channels/priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-preferred', id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Preferred channel updated');
        refresh();
      } else {
        toast.error('Failed to set preferred channel');
      }
    } catch {
      toast.error('Network error');
    }
  }, [refresh]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/channels/priority?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success('Priority config removed');
        refresh();
      } else {
        toast.error('Failed to remove');
      }
    } catch {
      toast.error('Network error');
    }
  }, [refresh]);

  const handleOpenEdit = useCallback((item: ChannelPriorityItem) => {
    setEditingItem(item);
    setEditForm({
      priority: item.priority,
      inventoryWeight: item.inventoryWeight,
      rateWeight: item.rateWeight,
      bookingWeight: item.bookingWeight,
      maxInventoryPercent: item.maxInventoryPercent,
      notes: item.notes || '',
      isActive: item.isActive,
    });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      const res = await fetch('/api/channels/priority', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingItem.id, ...editForm }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Priority updated');
        setEditingItem(null);
        refresh();
      } else {
        toast.error(json.error?.message || 'Failed to update');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }, [editingItem, editForm, refresh]);

  const handleCreate = useCallback(async () => {
    if (!creatingFor) return;
    setSaving(true);
    try {
      const res = await fetch('/api/channels/priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: creatingFor.id,
          channelCode: creatingFor.channel,
          ...createForm,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Priority config created');
        setCreateDialogOpen(false);
        setCreatingFor(null);
        refresh();
      } else {
        toast.error(json.error?.message || 'Failed to create');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }, [creatingFor, createForm, refresh]);

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <XCircle className="h-12 w-12 text-red-500" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Channel Priority</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure the order and weights in which channels receive inventory updates and bookings
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unconfigured.length > 0 && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Channel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Channel Priority</DialogTitle>
                  <DialogDescription>Select an unconfigured channel to add priority settings.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {unconfigured.map((conn) => (
                    <button
                      key={conn.id}
                      onClick={() => setCreatingFor(conn)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                        creatingFor?.id === conn.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {conn.displayName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{conn.displayName}</p>
                        <p className="text-xs text-muted-foreground">{conn.channel}</p>
                      </div>
                    </button>
                  ))}

                  {creatingFor && (
                    <div className="space-y-4 pt-2 border-t mt-2">
                      <p className="text-sm font-medium">Configure {creatingFor.displayName}</p>
                      <div className="space-y-2">
                        <Label className="text-xs">Priority (1=highest)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={createForm.priority}
                          onChange={(e) => setCreateForm((f) => ({ ...f, priority: parseInt(e.target.value) || 5 }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Inventory Weight: {createForm.inventoryWeight}x</Label>
                        <Slider
                          value={[createForm.inventoryWeight]}
                          onValueChange={([v]) => setCreateForm((f) => ({ ...f, inventoryWeight: v }))}
                          min={0}
                          max={3}
                          step={0.1}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Max Inventory %: {createForm.maxInventoryPercent}%</Label>
                        <Slider
                          value={[createForm.maxInventoryPercent]}
                          onValueChange={([v]) => setCreateForm((f) => ({ ...f, maxInventoryPercent: v }))}
                          min={0}
                          max={100}
                          step={5}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setCreateDialogOpen(false); setCreatingFor(null); }}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={!creatingFor || saving}>
                    {saving ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2.5 dark:bg-blue-950/40">
                <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Channels Configured</p>
                <p className="text-2xl font-bold">{summary?.totalConfigured || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {summary?.totalUnconfigured || 0} unconfigured
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-50 p-2.5 dark:bg-amber-950/40">
                <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Preferred Channel</p>
                <p className="text-sm font-bold truncate">
                  {summary?.preferredChannel
                    ? priorities.find((p) => p.id === summary.preferredChannel.id)?.connection?.displayName || summary.preferredChannel.channelCode
                    : 'Not set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-950/40">
                <ArrowUpDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Avg Priority</p>
                <p className="text-2xl font-bold">{summary?.avgPriority || 0}</p>
                <p className="text-xs text-muted-foreground">1=highest, 10=lowest</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-50 p-2.5 dark:bg-purple-950/40">
                <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">High Priority</p>
                <p className="text-2xl font-bold">
                  {priorities.filter((p) => p.priority <= 3).length}
                </p>
                <p className="text-xs text-muted-foreground">channels with priority 1-3</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">How Channel Priority Works</p>
              <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
                <li><strong>Priority 1</strong> channels get inventory updates first during sync cycles</li>
                <li><strong>Preferred Channel</strong> receives top allocation when inventory is scarce</li>
                <li><strong>Inventory Weight</strong> controls the proportion of rooms allocated (e.g., 2x = double share)</li>
                <li><strong>Max Inventory %</strong> caps the maximum percentage of total rooms a channel can receive</li>
                <li><strong>Rate/Booking Weights</strong> influence pricing and booking allocation strategies</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Priority List */}
      {priorities.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Priority Order</h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> High (1-3)</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> Medium (4-6)</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Low (7-10)</div>
            </div>
          </div>

          <div className="space-y-2">
            {priorities.map((item, index) => {
              const conn = item.connection;
              const displayName = conn?.displayName || item.channelCode;
              const channelName = conn?.channel || item.channelCode;

              return (
                <Card key={item.id} className={`transition-all ${!item.isActive ? 'opacity-60' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      {/* Left: Rank + Channel info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Rank number */}
                        <div className={`flex items-center justify-center w-10 h-10 rounded-lg border font-bold text-sm ${getPriorityColor(item.priority)}`}>
                          {index + 1}
                        </div>

                        {/* Channel info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{displayName}</span>
                            {item.preferredChannel && (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800 text-[10px] gap-1">
                                <Star className="h-3 w-3" /> Preferred
                              </Badge>
                            )}
                            {!item.isActive && (
                              <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{channelName}</span>
                            <div className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${getPriorityDot(item.priority)}`} />
                              <span className="text-xs text-muted-foreground">
                                Priority {item.priority} · {getPriorityLabel(item.priority)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Weight indicators */}
                      <div className="hidden lg:flex items-center gap-4 text-xs">
                        <div className="text-center px-3 py-1 rounded bg-muted/50">
                          <p className="text-muted-foreground">Inv</p>
                          <p className="font-bold">{item.inventoryWeight}x</p>
                        </div>
                        <div className="text-center px-3 py-1 rounded bg-muted/50">
                          <p className="text-muted-foreground">Rate</p>
                          <p className="font-bold">{item.rateWeight}x</p>
                        </div>
                        <div className="text-center px-3 py-1 rounded bg-muted/50">
                          <p className="text-muted-foreground">Book</p>
                          <p className="font-bold">{item.bookingWeight}x</p>
                        </div>
                        <div className="text-center px-3 py-1 rounded bg-muted/50">
                          <p className="text-muted-foreground">Max %</p>
                          <p className="font-bold">{item.maxInventoryPercent}%</p>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          title="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === priorities.length - 1}
                          title="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        {!item.preferredChannel && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => handleSetPreferred(item.id)}
                            title="Set as preferred"
                          >
                            <Star className="h-3 w-3 mr-1" /> Set Preferred
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleOpenEdit(item)}
                          title="Edit"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(item.id)}
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <ArrowUpDown className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-muted-foreground font-medium">No channel priorities configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                {unconfigured.length > 0
                  ? `Click "Add Channel" to configure ${unconfigured.length} unconfigured channel(s).`
                  : 'Connect OTA channels first to set priorities.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unconfigured channels prompt */}
      {unconfigured.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{unconfigured.length} Unconfigured Channel(s)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {unconfigured.map((c) => c.displayName).join(', ')} — Add priority settings to control sync order.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Priority Settings</DialogTitle>
            <DialogDescription>
              {editingItem?.connection?.displayName || editingItem?.channelCode}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Priority */}
            <div className="space-y-2">
              <Label>Priority (1=highest, 10=lowest)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={editForm.priority}
                onChange={(e) => setEditForm((f) => ({ ...f, priority: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)) }))}
              />
              <p className="text-xs text-muted-foreground">
                Current: {getPriorityLabel(editForm.priority)} priority
              </p>
            </div>

            <Separator />

            {/* Weights */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Weight className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Allocation Weights</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Inventory Weight</Label>
                  <span className="text-xs font-medium">{editForm.inventoryWeight}x</span>
                </div>
                <Slider
                  value={[editForm.inventoryWeight]}
                  onValueChange={([v]) => setEditForm((f) => ({ ...f, inventoryWeight: v }))}
                  min={0}
                  max={3}
                  step={0.1}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Rate Weight</Label>
                  <span className="text-xs font-medium">{editForm.rateWeight}x</span>
                </div>
                <Slider
                  value={[editForm.rateWeight]}
                  onValueChange={([v]) => setEditForm((f) => ({ ...f, rateWeight: v }))}
                  min={0}
                  max={3}
                  step={0.1}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Booking Weight</Label>
                  <span className="text-xs font-medium">{editForm.bookingWeight}x</span>
                </div>
                <Slider
                  value={[editForm.bookingWeight]}
                  onValueChange={([v]) => setEditForm((f) => ({ ...f, bookingWeight: v }))}
                  min={0}
                  max={3}
                  step={0.1}
                />
              </div>
            </div>

            <Separator />

            {/* Max Inventory % */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Max Inventory %</Label>
                <span className="text-sm font-bold">{editForm.maxInventoryPercent}%</span>
              </div>
              <Slider
                value={[editForm.maxInventoryPercent]}
                onValueChange={([v]) => setEditForm((f) => ({ ...f, maxInventoryPercent: v }))}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Maximum percentage of total inventory this channel can receive
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes about this priority config..."
                rows={2}
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Inactive channels are skipped during sync</p>
              </div>
              <Switch
                checked={editForm.isActive}
                onCheckedChange={(checked) => setEditForm((f) => ({ ...f, isActive: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ChannelPrioritySettings;
