'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Gauge,
  AlertTriangle,
  Loader2,
  Search,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { clampPositive, isValidCIDR } from '@/lib/wifi/validation';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BandwidthPool {
  id: string;
  name: string;
  subnet: string | null;
  vlanId: number | null;
  totalDownloadKbps: number;
  totalUploadKbps: number;
  enabled: boolean;
  createdAt: string;
}

interface PoolFormData {
  name: string;
  subnet: string;
  totalDownloadKbps: number;
  totalUploadKbps: number;
  enabled: boolean;
}

type DialogMode = 'create' | 'edit' | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBandwidth(kbps: number): string {
  if (kbps >= 1000000) {
    const gbit = kbps / 1000000;
    return `${gbit % 1 === 0 ? gbit.toFixed(0) : gbit} Gbit/s`;
  }
  return `${kbps / 1000} Mbit/s`;
}

function kbpsToMbps(kbps: number): number {
  return kbps / 1000;
}

function mbpsToKbps(mbps: number): number {
  return mbps * 1000;
}

const DEFAULT_FORM_DATA: PoolFormData = {
  name: '',
  subnet: '',
  totalDownloadKbps: mbpsToKbps(2000),
  totalUploadKbps: mbpsToKbps(2000),
  enabled: true,
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function BandwidthPoolManagement() {
  const { toast } = useToast();

  // State
  const [pools, setPools] = useState<BandwidthPool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedPool, setSelectedPool] = useState<BandwidthPool | null>(null);
  const [formData, setFormData] = useState<PoolFormData>(DEFAULT_FORM_DATA);
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reinitialize state
  const [isReinitializing, setIsReinitializing] = useState(false);

  // ─── Fetch pools ──────────────────────────────────────────────────────────

  const fetchPools = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/wifi/firewall/bandwidth-pools?limit=100');
      const result = await res.json();
      if (result.success) {
        setPools(Array.isArray(result.data) ? result.data : []);
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to fetch bandwidth pools',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching bandwidth pools:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch bandwidth pools',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  // ─── Filtered pools (client-side search) ─────────────────────────────────

  const filteredPools = useMemo(() => {
    if (!searchQuery.trim()) return pools;
    const query = searchQuery.toLowerCase();
    return pools.filter(
      (pool) =>
        pool.name.toLowerCase().includes(query) ||
        (pool.subnet && pool.subnet.toLowerCase().includes(query))
    );
  }, [pools, searchQuery]);

  // ─── Sorted pools by createdAt for class ID assignment ───────────────────

  const sortedPools = useMemo(() => {
    return [...filteredPools].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [filteredPools]);

  // Class ID map: pool.id → sequential number starting from 2
  const classIdMap = useMemo(() => {
    const map = new Map<string, number>();
    sortedPools.forEach((pool, index) => {
      map.set(pool.id, 2 + index);
    });
    return map;
  }, [sortedPools]);

  // ─── Form helpers ─────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormData(DEFAULT_FORM_DATA);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogMode('create');
    setSelectedPool(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (pool: BandwidthPool) => {
    setDialogMode('edit');
    setSelectedPool(pool);
    setFormData({
      name: pool.name,
      subnet: pool.subnet || '',
      totalDownloadKbps: pool.totalDownloadKbps,
      totalUploadKbps: pool.totalUploadKbps,
      enabled: pool.enabled,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (pool: BandwidthPool) => {
    setSelectedPool(pool);
    setIsDeleteOpen(true);
  };

  // ─── Validate form ───────────────────────────────────────────────────────

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'Pool name is required.';

    if (formData.subnet.trim() && !isValidCIDR(formData.subnet.trim())) {
      return 'Invalid subnet format. Use CIDR notation (e.g., 192.168.100.0/24).';
    }

    const downloadMbps = kbpsToMbps(formData.totalDownloadKbps);
    const uploadMbps = kbpsToMbps(formData.totalUploadKbps);

    if (downloadMbps < 100 || downloadMbps > 10000) {
      return 'Download bandwidth must be between 100 Mbps and 10000 Mbps (10 Gbit).';
    }
    if (uploadMbps < 100 || uploadMbps > 10000) {
      return 'Upload bandwidth must be between 100 Mbps and 10000 Mbps (10 Gbit).';
    }

    return null;
  };

  // ─── Create pool ──────────────────────────────────────────────────────────

  const handleCreate = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({ title: 'Validation Error', description: validationError, variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/wifi/firewall/bandwidth-pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          subnet: formData.subnet.trim() || null,
          totalDownloadKbps: formData.totalDownloadKbps,
          totalUploadKbps: formData.totalUploadKbps,
          enabled: formData.enabled,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: result.message || 'Bandwidth pool created successfully.' });
        setIsDialogOpen(false);
        resetForm();
        fetchPools();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create bandwidth pool.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating bandwidth pool:', error);
      toast({ title: 'Error', description: 'Failed to create bandwidth pool.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Update pool ──────────────────────────────────────────────────────────

  const handleUpdate = async () => {
    if (!selectedPool) return;

    const validationError = validateForm();
    if (validationError) {
      toast({ title: 'Validation Error', description: validationError, variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/wifi/firewall/bandwidth-pools/${selectedPool.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          subnet: formData.subnet.trim() || null,
          totalDownloadKbps: formData.totalDownloadKbps,
          totalUploadKbps: formData.totalUploadKbps,
          enabled: formData.enabled,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: result.message || 'Bandwidth pool updated successfully.' });
        setIsDialogOpen(false);
        setSelectedPool(null);
        resetForm();
        fetchPools();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update bandwidth pool.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating bandwidth pool:', error);
      toast({ title: 'Error', description: 'Failed to update bandwidth pool.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Delete pool ──────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!selectedPool) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/wifi/firewall/bandwidth-pools/${selectedPool.id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: result.message || 'Bandwidth pool deleted successfully.' });
        setIsDeleteOpen(false);
        setSelectedPool(null);
        fetchPools();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete bandwidth pool.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting bandwidth pool:', error);
      toast({ title: 'Error', description: 'Failed to delete bandwidth pool.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Reinitialize all pools ──────────────────────────────────────────────

  const handleReinitialize = async () => {
    setIsReinitializing(true);
    try {
      const res = await fetch('/api/wifi/firewall/bandwidth-pools/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await res.json();
      if (result.success) {
        const created = result.data?.created ?? 0;
        const failed = result.data?.failed ?? 0;
        const parts: string[] = [];
        if (created > 0) parts.push(`${created} TC class${created !== 1 ? 'es' : ''} created`);
        if (failed > 0) parts.push(`${failed} failed`);
        toast({
          title: 'Reinitialize Complete',
          description: parts.length > 0 ? parts.join(', ') + '.' : 'All TC classes reinitialized.',
        });
        fetchPools();
      } else {
        toast({
          title: 'Reinitialize Failed',
          description: result.error?.message || 'Failed to reinitialize TC classes.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error reinitializing TC classes:', error);
      toast({
        title: 'Error',
        description: 'Failed to reinitialize TC classes.',
        variant: 'destructive',
      });
    } finally {
      setIsReinitializing(false);
    }
  };

  // ─── Bandwidth input handlers ────────────────────────────────────────────

  const handleDownloadChange = (value: string) => {
    const mbps = parseFloat(value);
    if (value === '' || isNaN(mbps)) {
      setFormData((prev) => ({ ...prev, totalDownloadKbps: 0 }));
      return;
    }
    const clamped = clampPositive(mbps, 0, 10000, 0);
    setFormData((prev) => ({ ...prev, totalDownloadKbps: mbpsToKbps(clamped) }));
  };

  const handleUploadChange = (value: string) => {
    const mbps = parseFloat(value);
    if (value === '' || isNaN(mbps)) {
      setFormData((prev) => ({ ...prev, totalUploadKbps: 0 }));
      return;
    }
    const clamped = clampPositive(mbps, 0, 10000, 0);
    setFormData((prev) => ({ ...prev, totalUploadKbps: mbpsToKbps(clamped) }));
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            Bandwidth Pools
          </h2>
          <p className="text-sm text-muted-foreground">
            TC HTB pool classes for bandwidth shaping. Pool ID maps to class 1:N on ifb0/ifb1.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReinitialize}
            disabled={isReinitializing || pools.length === 0}
          >
            {isReinitializing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Reinitialize All
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Pool
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-primary/20 dark:border-primary/20 bg-primary/5 rounded-xl border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-primary">TC HTB Bandwidth Shaping</p>
              <p className="text-primary/80 mt-0.5">
                Each bandwidth pool corresponds to a <span className="font-semibold">TC HTB class 1:N</span> on{' '}
                <span className="font-mono text-xs bg-primary/10 px-1 py-0.5 rounded">ifb0</span> (download) and{' '}
                <span className="font-mono text-xs bg-primary/10 px-1 py-0.5 rounded">ifb1</span> (upload).
              </p>
              <p className="text-primary/60 mt-1">
                Use &quot;Reinitialize All&quot; to rebuild TC classes after changes. This will recreate the full class hierarchy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card className="rounded-xl border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by pool name or subnet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pools Table */}
      <Card className="rounded-xl border-0 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted/50 p-4 mb-3">
              <Gauge className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">
              {searchQuery ? 'No bandwidth pools match your search' : 'No bandwidth pools found'}
            </h3>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Create your first bandwidth pool to start shaping traffic'}
            </p>
          </div>
        ) : (
          <div className="max-h-[500px] overflow-auto">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-20">Class ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Subnet</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Upload</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPools.map((pool) => {
                  const classId = classIdMap.get(pool.id);

                  return (
                    <TableRow
                      key={pool.id}
                      className={cn('group transition-colors', !pool.enabled && 'opacity-60')}
                    >
                      {/* Class ID */}
                      <TableCell>
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-muted/80 text-xs font-bold tabular-nums">
                          {classId}
                        </span>
                      </TableCell>

                      {/* Name */}
                      <TableCell>
                        <span className="font-semibold text-sm">{pool.name}</span>
                      </TableCell>

                      {/* Subnet */}
                      <TableCell className="font-mono text-xs">
                        {pool.subnet || '—'}
                      </TableCell>

                      {/* Download */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">↓</span>
                          <span className="text-sm font-medium tabular-nums">
                            {formatBandwidth(pool.totalDownloadKbps)}
                          </span>
                        </div>
                      </TableCell>

                      {/* Upload */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">↑</span>
                          <span className="text-sm font-medium tabular-nums">
                            {formatBandwidth(pool.totalUploadKbps)}
                          </span>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        <Badge
                          variant={pool.enabled ? 'default' : 'secondary'}
                          className={cn(
                            'text-[11px] px-2.5 py-0.5',
                            pool.enabled
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                              : 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/10'
                          )}
                        >
                          <div
                            className={cn(
                              'w-1.5 h-1.5 rounded-full mr-1.5',
                              pool.enabled ? 'bg-emerald-500' : 'bg-gray-400'
                            )}
                          />
                          {pool.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Edit ${pool.name}`}
                            onClick={() => openEditDialog(pool)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            aria-label={`Delete ${pool.name}`}
                            onClick={() => openDeleteDialog(pool)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </div>
        )}
      </Card>

      {/* ─── Create / Edit Dialog ──────────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDialogOpen(false);
          setDialogMode(null);
          setSelectedPool(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              {dialogMode === 'create' ? 'Create Bandwidth Pool' : 'Edit Bandwidth Pool'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'create'
                ? 'Define a new TC HTB class for bandwidth shaping.'
                : `Editing "${selectedPool?.name}"`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="pool-name">
                Pool Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pool-name"
                placeholder="e.g. Guest, Office, Staff"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* Subnet */}
            <div className="grid gap-2">
              <Label htmlFor="pool-subnet">Subnet (optional)</Label>
              <Input
                id="pool-subnet"
                placeholder="192.168.100.0/24"
                value={formData.subnet}
                onChange={(e) => setFormData((prev) => ({ ...prev, subnet: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                CIDR notation. Leave empty to apply globally.
              </p>
            </div>

            {/* Bandwidth Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Download */}
              <div className="grid gap-2">
                <Label htmlFor="pool-download">Total Download (Mbps)</Label>
                <div className="relative">
                  <Input
                    id="pool-download"
                    type="number"
                    min={100}
                    max={10000}
                    step={100}
                    value={kbpsToMbps(formData.totalDownloadKbps) || ''}
                    onChange={(e) => handleDownloadChange(e.target.value)}
                    placeholder="2000"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    Mbps
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.totalDownloadKbps > 0
                    ? `= ${formatBandwidth(formData.totalDownloadKbps)}`
                    : '100 – 10,000 Mbps'}
                </p>
              </div>

              {/* Upload */}
              <div className="grid gap-2">
                <Label htmlFor="pool-upload">Total Upload (Mbps)</Label>
                <div className="relative">
                  <Input
                    id="pool-upload"
                    type="number"
                    min={100}
                    max={10000}
                    step={100}
                    value={kbpsToMbps(formData.totalUploadKbps) || ''}
                    onChange={(e) => handleUploadChange(e.target.value)}
                    placeholder="2000"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    Mbps
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.totalUploadKbps > 0
                    ? `= ${formatBandwidth(formData.totalUploadKbps)}`
                    : '100 – 10,000 Mbps'}
                </p>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Quick Presets
              </Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '100 Mbps', value: 100 },
                  { label: '500 Mbps', value: 500 },
                  { label: '1 Gbit', value: 1000 },
                  { label: '2 Gbit', value: 2000 },
                  { label: '5 Gbit', value: 5000 },
                  { label: '10 Gbit', value: 10000 },
                ].map((preset) => (
                  <Button
                    key={preset.value}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const kbps = mbpsToKbps(preset.value);
                      setFormData((prev) => ({
                        ...prev,
                        totalDownloadKbps: kbps,
                        totalUploadKbps: kbps,
                      }));
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Enabled Switch */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                {formData.enabled ? (
                  <ToggleRight className="h-5 w-5 text-emerald-500" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <Label className="text-sm font-medium">Enabled</Label>
                  <p className="text-xs text-muted-foreground">
                    {formData.enabled
                      ? 'TC HTB class will be active and shaping traffic'
                      : 'TC HTB class will be created but dormant'}
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, enabled: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setDialogMode(null);
                setSelectedPool(null);
                resetForm();
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={dialogMode === 'create' ? handleCreate : handleUpdate} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : dialogMode === 'create' ? (
                <Plus className="h-4 w-4 mr-2" />
              ) : (
                <Pencil className="h-4 w-4 mr-2" />
              )}
              {dialogMode === 'create' ? 'Create Pool' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ───────────────────────────────────────── */}
      <Dialog open={isDeleteOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDeleteOpen(false);
          setSelectedPool(null);
        }
      }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Delete Bandwidth Pool
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p>
                  Are you sure you want to delete{' '}
                  <span className="font-semibold text-foreground">{selectedPool?.name}</span>?
                </p>
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    This action cannot be undone. The corresponding TC HTB class will be removed on
                    the next reinitialize. Traffic previously shaped by this pool will fall back to
                    the default class.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteOpen(false);
                setSelectedPool(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Pool
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
