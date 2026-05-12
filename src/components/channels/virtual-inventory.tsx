'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  ChevronRight,
  Box,
  Zap,
  Link2,
  Unlink,
  Calculator,
  Calendar,
  BarChart3,
  ArrowLeftRight,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

interface PhysicalRoomType {
  id: string;
  name: string;
  code: string;
  totalRooms: number;
}

interface VirtualMapping {
  id: string;
  tenantId: string;
  virtualRoomTypeId: string;
  physicalRoomTypeId: string;
  connectionId: string | null;
  channelCode: string | null;
  externalRoomId: string | null;
  externalRoomName: string | null;
  rateMultiplier: number;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  physicalRoomType?: PhysicalRoomType;
}

interface VirtualRoomType {
  id: string;
  tenantId: string;
  propertyId: string | null;
  name: string;
  description: string | null;
  aggregationType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  virtualMappings?: VirtualMapping[];
}

interface InventoryDay {
  date: string;
  available: number;
  total: number;
}

interface Stats {
  totalCount: number;
  activeCount: number;
  totalMappings: number;
  totalCapacity: number;
  uniquePhysicalRooms: number;
}

// ============================================================
// Aggregation type config
// ============================================================

const AGGREGATION_TYPES: Record<string, { label: string; color: string; description: string }> = {
  single: { label: 'Single', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', description: 'One physical room type maps to one virtual type' },
  grouped: { label: 'Grouped', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', description: 'Multiple physical types combined into one virtual type' },
  derived: { label: 'Derived', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', description: 'Rate-adjusted variant based on a physical type' },
  flexible: { label: 'Flexible', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400', description: 'Dynamic grouping that changes based on availability' },
};

// ============================================================
// Main Component
// ============================================================

export default function VirtualInventory() {
  const [virtualTypes, setVirtualTypes] = useState<VirtualRoomType[]>([]);
  const [physicalRoomTypes, setPhysicalRoomTypes] = useState<PhysicalRoomType[]>([]);
  const [stats, setStats] = useState<Stats>({ totalCount: 0, activeCount: 0, totalMappings: 0, totalCapacity: 0, uniquePhysicalRooms: 0 });
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Selected items
  const [selectedVrt, setSelectedVrt] = useState<VirtualRoomType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VirtualRoomType | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAggregationType, setFormAggregationType] = useState('single');
  const [formPropertyId, setFormPropertyId] = useState('');

  // Mapping form state
  const [mapPhysicalTypeId, setMapPhysicalTypeId] = useState('');
  const [mapChannelCode, setMapChannelCode] = useState('');
  const [mapExternalRoomName, setMapExternalRoomName] = useState('');
  const [mapRateMultiplier, setMapRateMultiplier] = useState(1);
  const [mapPriority, setMapPriority] = useState(0);
  const [mappingSaving, setMappingSaving] = useState(false);

  // Inventory calculator state
  const [invStartDate, setInvStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [invEndDate, setInvEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [invDays, setInvDays] = useState<InventoryDay[]>([]);
  const [invLoading, setInvLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/channels/virtual-inventory?include=mappings');
      const result = await response.json();
      if (result.success) {
        setVirtualTypes(result.data);
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Error fetching virtual inventory:', error);
      toast.error('Failed to load virtual inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPhysicalRoomTypes = useCallback(async () => {
    try {
      const response = await fetch('/api/room-types');
      const result = await response.json();
      if (result.success) {
        setPhysicalRoomTypes((result.data || []).map((rt: any) => ({
          id: rt.id,
          name: rt.name,
          code: rt.code || rt.name.toLowerCase().replace(/\s+/g, '-'),
          totalRooms: rt.totalRooms || 0,
        })));
      }
    } catch (error) {
      console.error('Error fetching room types:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchPhysicalRoomTypes();
  }, [fetchData, fetchPhysicalRoomTypes]);

  // --- Handlers ---

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormAggregationType('single');
    setFormPropertyId('');
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      const response = await fetch('/api/channels/virtual-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || null,
          aggregationType: formAggregationType,
          propertyId: formPropertyId || null,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Virtual room type created');
        setShowCreateDialog(false);
        resetForm();
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to create');
      }
    } catch {
      toast.error('Failed to create virtual room type');
    }
  };

  const handleEdit = async () => {
    if (!selectedVrt || !formName.trim()) return;
    try {
      const response = await fetch('/api/channels/virtual-inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedVrt.id,
          name: formName.trim(),
          description: formDescription.trim() || null,
          aggregationType: formAggregationType,
          propertyId: formPropertyId || null,
          isActive: selectedVrt.isActive,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Virtual room type updated');
        setShowEditDialog(false);
        resetForm();
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const response = await fetch(`/api/channels/virtual-inventory?id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Virtual room type deleted');
        setShowDeleteDialog(false);
        setDeleteTarget(null);
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  const openEditDialog = (vrt: VirtualRoomType) => {
    setSelectedVrt(vrt);
    setFormName(vrt.name);
    setFormDescription(vrt.description || '');
    setFormAggregationType(vrt.aggregationType);
    setFormPropertyId(vrt.propertyId || '');
    setShowEditDialog(true);
  };

  const handleToggleActive = async (vrt: VirtualRoomType) => {
    try {
      const response = await fetch('/api/channels/virtual-inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: vrt.id, isActive: !vrt.isActive }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(vrt.isActive ? 'Virtual room type deactivated' : 'Virtual room type activated');
        fetchData();
      }
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  // --- Mapping handlers ---

  const openMappingDialog = (vrt: VirtualRoomType) => {
    setSelectedVrt(vrt);
    setMapPhysicalTypeId('');
    setMapChannelCode('');
    setMapExternalRoomName('');
    setMapRateMultiplier(1);
    setMapPriority(0);
    setShowMappingDialog(true);
  };

  const handleAddMapping = async () => {
    if (!selectedVrt || !mapPhysicalTypeId) {
      toast.error('Physical room type is required');
      return;
    }
    setMappingSaving(true);
    try {
      const response = await fetch('/api/channels/virtual-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-mapping',
          virtualRoomTypeId: selectedVrt.id,
          physicalRoomTypeId: mapPhysicalTypeId,
          channelCode: mapChannelCode || null,
          externalRoomName: mapExternalRoomName || null,
          rateMultiplier: mapRateMultiplier,
          priority: mapPriority,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Mapping added');
        setMapPhysicalTypeId('');
        setMapChannelCode('');
        setMapExternalRoomName('');
        setMapRateMultiplier(1);
        setMapPriority(0);
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to add mapping');
      }
    } catch {
      toast.error('Failed to add mapping');
    } finally {
      setMappingSaving(false);
    }
  };

  const handleRemoveMapping = async (mappingId: string) => {
    try {
      const response = await fetch(`/api/channels/virtual-inventory?action=remove-mapping&mappingId=${mappingId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Mapping removed');
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to remove mapping');
      }
    } catch {
      toast.error('Failed to remove mapping');
    }
  };

  const handleUpdateMappingMultiplier = async (mappingId: string, rateMultiplier: number) => {
    try {
      const response = await fetch('/api/channels/virtual-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-mapping',
          mappingId,
          rateMultiplier,
        }),
      });
      const result = await response.json();
      if (result.success) {
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to update mapping');
      }
    } catch {
      toast.error('Failed to update mapping');
    }
  };

  // --- Inventory calculator ---

  const openInventoryDialog = (vrt: VirtualRoomType) => {
    setSelectedVrt(vrt);
    setInvDays([]);
    setShowInventoryDialog(true);
  };

  const handleCalculateInventory = async () => {
    if (!selectedVrt || !invStartDate || !invEndDate) return;
    setInvLoading(true);
    try {
      const response = await fetch('/api/channels/virtual-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calculate-inventory',
          virtualRoomTypeId: selectedVrt.id,
          startDate: invStartDate,
          endDate: invEndDate,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setInvDays(result.data.days);
      } else {
        toast.error(result.error?.message || 'Failed to calculate inventory');
      }
    } catch {
      toast.error('Failed to calculate inventory');
    } finally {
      setInvLoading(false);
    }
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Virtual Inventory</h1>
          <p className="text-muted-foreground">Create derived room types for channel-specific mapping</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Create Virtual Type
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <Layers className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalCount}</p>
                <p className="text-xs text-muted-foreground">Virtual Types</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeCount}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Link2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalMappings}</p>
                <p className="text-xs text-muted-foreground">Total Mappings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Box className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.uniquePhysicalRooms}</p>
                <p className="text-xs text-muted-foreground">Physical Types</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/20">
                <BarChart3 className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalCapacity}</p>
                <p className="text-xs text-muted-foreground">Total Capacity</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Virtual Room Types List */}
      <div className="space-y-4">
        {virtualTypes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="p-4 rounded-full bg-muted">
                <Layers className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium">No Virtual Room Types</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Create virtual room types to map physical rooms to channels with different names and rates.
                </p>
              </div>
              <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create First Virtual Type
              </Button>
            </CardContent>
          </Card>
        ) : (
          virtualTypes.map((vrt) => {
            const aggConfig = AGGREGATION_TYPES[vrt.aggregationType] || AGGREGATION_TYPES.single;
            const mappingCount = vrt.virtualMappings?.length || 0;
            const totalPhysicalRooms = (vrt.virtualMappings || []).reduce(
              (sum, m) => sum + (m.physicalRoomType?.totalRooms || 0), 0
            );

            return (
              <Card key={vrt.id} className={!vrt.isActive ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <CardTitle className="text-lg">{vrt.name}</CardTitle>
                        <Badge className={aggConfig.color}>{aggConfig.label}</Badge>
                        {!vrt.isActive && (
                          <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                        )}
                      </div>
                      {vrt.description && (
                        <CardDescription className="mt-1">{vrt.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openInventoryDialog(vrt)} title="Calculate Inventory">
                        <Calculator className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleToggleActive(vrt)} title={vrt.isActive ? 'Deactivate' : 'Activate'}>
                        {vrt.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openMappingDialog(vrt)} title="Manage Mappings">
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(vrt)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeleteTarget(vrt); setShowDeleteDialog(true); }} title="Delete">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Visual mapping representation */}
                  {mappingCount > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        <span className="flex items-center gap-1">
                          <Box className="h-3.5 w-3.5" />
                          {mappingCount} physical type{mappingCount !== 1 ? 's' : ''} mapped
                        </span>
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-3.5 w-3.5" />
                          {totalPhysicalRooms} total rooms
                        </span>
                      </div>

                      {/* Visual aggregation diagram */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Virtual type node */}
                        <div className="px-3 py-2 rounded-lg border-2 border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-900/20 min-w-[120px] text-center">
                          <div className="text-xs text-muted-foreground mb-0.5">Virtual</div>
                          <div className="text-sm font-semibold truncate max-w-[120px]" title={vrt.name}>{vrt.name}</div>
                        </div>

                        <ArrowLeftRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                        {/* Physical type nodes */}
                        <div className="flex flex-wrap gap-2">
                          {(vrt.virtualMappings || []).map((mapping) => (
                            <div
                              key={mapping.id}
                              className="px-3 py-2 rounded-lg border bg-card hover:bg-accent transition-colors min-w-[100px] text-center group relative"
                            >
                              <div className="text-xs text-muted-foreground mb-0.5">
                                Physical
                                {mapping.rateMultiplier !== 1 && (
                                  <span className="ml-1 text-amber-600 dark:text-amber-400">x{mapping.rateMultiplier}</span>
                                )}
                              </div>
                              <div className="text-sm font-medium truncate max-w-[120px]" title={mapping.physicalRoomType?.name}>
                                {mapping.physicalRoomType?.name || mapping.physicalRoomTypeId.slice(0, 8)}
                              </div>
                              {mapping.physicalRoomType && (
                                <div className="text-xs text-muted-foreground">{mapping.physicalRoomType.totalRooms} rooms</div>
                              )}
                              {mapping.externalRoomName && (
                                <div className="mt-1 flex items-center gap-1 justify-center">
                                  <Copy className="h-2.5 w-2.5" />
                                  <span className="text-xs text-cyan-600 dark:text-cyan-400">{mapping.externalRoomName}</span>
                                </div>
                              )}
                              {/* Quick multiplier control */}
                              <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Slider
                                  min={0.5}
                                  max={3}
                                  step={0.1}
                                  value={[mapping.rateMultiplier]}
                                  onValueChange={([val]) => handleUpdateMappingMultiplier(mapping.id, val)}
                                  className="w-[80px] mx-auto"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Unlink className="h-4 w-4" />
                        No physical room types mapped yet
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ============================================================ */}
      {/* CREATE DIALOG */}
      {/* ============================================================ */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Virtual Room Type</DialogTitle>
            <DialogDescription>
              Define a virtual room type that maps to one or more physical room types for channel distribution.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name *</Label>
              <Input
                id="create-name"
                placeholder="e.g., Suite - Booking.com"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-desc">Description</Label>
              <Textarea
                id="create-desc"
                placeholder="Optional description..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-type">Aggregation Type</Label>
              <Select value={formAggregationType} onValueChange={setFormAggregationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AGGREGATION_TYPES).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <span>{cfg.label}</span>
                        <span className="text-xs text-muted-foreground">- {cfg.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!formName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* EDIT DIALOG */}
      {/* ============================================================ */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Virtual Room Type</DialogTitle>
            <DialogDescription>Update the virtual room type details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Aggregation Type</Label>
              <Select value={formAggregationType} onValueChange={setFormAggregationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AGGREGATION_TYPES).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <span>{cfg.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!formName.trim()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* MAPPING DIALOG */}
      {/* ============================================================ */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Mappings</DialogTitle>
            <DialogDescription>
              Map physical room types to &quot;{selectedVrt?.name}&quot;. Set channel-specific names and rate multipliers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing mappings */}
            {selectedVrt?.virtualMappings && selectedVrt.virtualMappings.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Current Mappings</Label>
                <ScrollArea className="max-h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Physical Room Type</TableHead>
                        <TableHead>Channel Name</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedVrt.virtualMappings.map((mapping) => (
                        <TableRow key={mapping.id}>
                          <TableCell className="font-medium">
                            {mapping.physicalRoomType?.name || mapping.physicalRoomTypeId.slice(0, 8)}
                          </TableCell>
                          <TableCell>
                            {mapping.externalRoomName || (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={mapping.rateMultiplier !== 1 ? 'default' : 'outline'}>
                              x{mapping.rateMultiplier}
                            </Badge>
                          </TableCell>
                          <TableCell>{mapping.priority}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveMapping(mapping.id)}
                              className="h-7 w-7"
                            >
                              <Unlink className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}

            <Separator />

            {/* Add new mapping form */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Add Physical Room Type</Label>
              <div className="space-y-3">
                <Select value={mapPhysicalTypeId} onValueChange={setMapPhysicalTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select physical room type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {physicalRoomTypes.map((rt) => (
                      <SelectItem key={rt.id} value={rt.id}>
                        {rt.name} ({rt.totalRooms} rooms)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Channel Code</Label>
                    <Input
                      placeholder="e.g., booking, expedia"
                      value={mapChannelCode}
                      onChange={(e) => setMapChannelCode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">External Room Name</Label>
                    <Input
                      placeholder="Channel display name"
                      value={mapExternalRoomName}
                      onChange={(e) => setMapExternalRoomName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Rate Multiplier: x{mapRateMultiplier}</Label>
                    <Slider
                      min={0.5}
                      max={3}
                      step={0.1}
                      value={[mapRateMultiplier]}
                      onValueChange={([val]) => setMapRateMultiplier(val)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Priority</Label>
                    <Input
                      type="number"
                      min={0}
                      value={mapPriority}
                      onChange={(e) => setMapPriority(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <Button onClick={handleAddMapping} disabled={!mapPhysicalTypeId || mappingSaving} className="w-full">
                  {mappingSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Add Mapping
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMappingDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* INVENTORY CALCULATOR DIALOG */}
      {/* ============================================================ */}
      <Dialog open={showInventoryDialog} onOpenChange={setShowInventoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Inventory Calculator</DialogTitle>
            <DialogDescription>
              Calculate available inventory for &quot;{selectedVrt?.name}&quot; across a date range.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-end gap-4">
              <div className="space-y-1 flex-1">
                <Label className="text-sm">Start Date</Label>
                <Input
                  type="date"
                  value={invStartDate}
                  onChange={(e) => setInvStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-sm">End Date</Label>
                <Input
                  type="date"
                  value={invEndDate}
                  onChange={(e) => setInvEndDate(e.target.value)}
                />
              </div>
              <Button onClick={handleCalculateInventory} disabled={invLoading}>
                {invLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
                Calculate
              </Button>
            </div>

            {invDays.length > 0 && (
              <ScrollArea className="max-h-72">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-[200px]">Availability</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invDays.map((day) => {
                      const pct = day.total > 0 ? Math.round((day.available / day.total) * 100) : 0;
                      const isWeekend = new Date(day.date).getDay() === 0 || new Date(day.date).getDay() === 6;
                      return (
                        <TableRow key={day.date} className={isWeekend ? 'bg-muted/30' : ''}>
                          <TableCell className="font-medium flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            {isWeekend && <Badge variant="outline" className="text-xs px-1.5 py-0">W</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={day.available === 0 ? 'text-red-500 font-medium' : 'font-medium'}>
                              {day.available}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{day.total}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={pct} className="h-2 flex-1" />
                              <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            {invDays.length > 0 && (
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <span>Avg availability: {Math.round(invDays.reduce((s, d) => s + d.available, 0) / invDays.length)} rooms/night</span>
                <span>Min: {Math.min(...invDays.map(d => d.available))}</span>
                <span>Max: {Math.max(...invDays.map(d => d.available))}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInventoryDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DELETE CONFIRMATION */}
      {/* ============================================================ */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Virtual Room Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This will also remove all its mappings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
