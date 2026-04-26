'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import {
  Network,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  RefreshCw,
  Star,
  ShieldCheck,
  ShieldX,
  Server,
  Wifi,
  UserCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  X,
  Globe,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface IpPoolRange {
  id?: string;
  poolId?: string;
  startIp: string;
  endIp: string;
  comment?: string;
  total_ips?: number;
}

interface IpPool {
  id: string;
  tenantId: string;
  propertyId: string | null;
  name: string;
  description: string | null;
  gateway: string | null;
  dnsServers: string | null;
  subnet: string | null;
  isDefault: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  ranges: IpPoolRange[];
  _count: {
    plans: number;
    users: number;
    ranges: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatInet(val: string | null | undefined): string {
  if (!val) return '—';
  // PostgreSQL inet may have /32 suffix for single IPs
  return val.replace(/\/32$/, '').replace(/\/\d+$/, '');
}

function countTotalIps(ranges: IpPoolRange[]): number {
  return ranges.reduce((sum, r) => {
    if (!r.startIp || !r.endIp) return sum;
    try {
      const start = r.startIp.replace(/\/\d+$/, '').split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
      const end = r.endIp.replace(/\/\d+$/, '').split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
      return sum + Math.max(0, end - start + 1);
    } catch {
      return sum;
    }
  }, 0);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function IpPoolManagement() {
  const { toast } = useToast();
  const [pools, setPools] = useState<IpPool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState({ totalPools: 0, activePools: 0, defaultPool: 'None', totalRanges: 0 });

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<IpPool | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedPools, setExpandedPools] = useState<Set<string>>(new Set());

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gateway: '',
    dnsServers: '8.8.8.8,8.8.4.4',
    subnet: '',
    isDefault: false,
    enabled: true,
    ranges: [{ startIp: '', endIp: '', comment: '' }] as IpPoolRange[],
  });

  const isInitialMount = useRef(true);

  // Fetch pools
  const fetchPools = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      const res = await fetch(`/api/wifi/ip-pools?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setPools(result.data);
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Error fetching IP pools:', error);
      toast({ title: 'Error', description: 'Failed to fetch IP pools', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, toast]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  // Debounced search
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchPools();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchPools]);

  // Create pool
  const handleCreate = async () => {
    if (!formData.name?.trim()) {
      toast({ title: 'Validation Error', description: 'Pool name is required', variant: 'destructive' });
      return;
    }
    const validRanges = formData.ranges.filter(r => r.startIp && r.endIp);
    if (validRanges.length === 0) {
      toast({ title: 'Validation Error', description: 'At least one IP range is required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/wifi/ip-pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          ranges: validRanges,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: result.message || 'IP pool created successfully' });
        setIsCreateOpen(false);
        resetForm();
        fetchPools();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create pool', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error creating IP pool:', error);
      toast({ title: 'Error', description: 'Failed to create IP pool', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Update pool
  const handleUpdate = async () => {
    if (!selectedPool) return;
    setIsSaving(true);
    try {
      const validRanges = formData.ranges.filter(r => r.startIp && r.endIp);
      const res = await fetch('/api/wifi/ip-pools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPool.id,
          ...formData,
          ranges: validRanges,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: result.message || 'IP pool updated successfully' });
        setIsEditOpen(false);
        setSelectedPool(null);
        fetchPools();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to update pool', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error updating IP pool:', error);
      toast({ title: 'Error', description: 'Failed to update IP pool', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete pool
  const handleDelete = async () => {
    if (!selectedPool) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/wifi/ip-pools?id=${selectedPool.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: result.message || 'IP pool deleted successfully' });
        if (result.unassigned?.plans || result.unassigned?.users) {
          toast({
            title: 'Assignments Cleared',
            description: `${result.unassigned.plans} plans and ${result.unassigned.users} users were unassigned from this pool`,
          });
        }
        setIsDeleteOpen(false);
        setSelectedPool(null);
        fetchPools();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to delete pool', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error deleting IP pool:', error);
      toast({ title: 'Error', description: 'Failed to delete IP pool', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (pool: IpPool) => {
    setSelectedPool(pool);
    setFormData({
      name: pool.name,
      description: pool.description || '',
      gateway: formatInet(pool.gateway),
      dnsServers: pool.dnsServers || '8.8.8.8,8.8.4.4',
      subnet: formatInet(pool.subnet),
      isDefault: pool.isDefault,
      enabled: pool.enabled,
      ranges: pool.ranges.length > 0
        ? pool.ranges.map(r => ({
            startIp: formatInet(r.startIp),
            endIp: formatInet(r.endIp),
            comment: r.comment || '',
          }))
        : [{ startIp: '', endIp: '', comment: '' }],
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      gateway: '',
      dnsServers: '8.8.8.8,8.8.4.4',
      subnet: '',
      isDefault: false,
      enabled: true,
      ranges: [{ startIp: '', endIp: '', comment: '' }],
    });
  };

  // Range management
  const addRange = () => {
    setFormData(prev => ({
      ...prev,
      ranges: [...prev.ranges, { startIp: '', endIp: '', comment: '' }],
    }));
  };

  const removeRange = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ranges: prev.ranges.filter((_, i) => i !== index),
    }));
  };

  const updateRange = (index: number, field: keyof IpPoolRange, value: string) => {
    setFormData(prev => ({
      ...prev,
      ranges: prev.ranges.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    }));
  };

  const toggleExpand = (poolId: string) => {
    setExpandedPools(prev => {
      const next = new Set(prev);
      if (next.has(poolId)) next.delete(poolId);
      else next.add(poolId);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Network className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            IP Pool Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Define IP address pools and restrict user access by assigned pool
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPools}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Pool
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <Network className="h-4 w-4 text-teal-500 dark:text-teal-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.totalPools}</div>
              <div className="text-xs text-muted-foreground">Total Pools</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.activePools}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Star className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-lg font-bold truncate">{summary.defaultPool}</div>
              <div className="text-xs text-muted-foreground">Default Pool</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <MapPin className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.totalRanges}</div>
              <div className="text-xs text-muted-foreground">IP Ranges</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-teal-800 dark:text-teal-200">IP Pool Priority Chain</p>
              <p className="text-teal-700 dark:text-teal-300 mt-0.5">
                <span className="font-semibold">User Override</span> → <span className="font-semibold">Plan Pool</span> → <span className="font-semibold">Default Pool</span> → No restriction (allow all)
              </p>
              <p className="text-teal-600 dark:text-teal-400 mt-1">
                Assign pools to Plans for bulk assignment. Users can override their plan&apos;s pool for individual exceptions.
                FreeRADIUS checks the user&apos;s IP on every authentication attempt.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by pool name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pools List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : pools.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted/50 p-4 mb-3">
            <Network className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">No IP pools found</h3>
          <p className="text-xs text-muted-foreground/60 mt-1">Create your first IP pool to restrict user access</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pools.map((pool) => {
            const isExpanded = expandedPools.has(pool.id);
            const totalIps = countTotalIps(pool.ranges);

            return (
              <Card key={pool.id} className={cn(
                'overflow-hidden transition-all duration-200',
                !pool.enabled && 'opacity-50'
              )}>
                {/* Pool Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(pool.id)}
                >
                  {/* Expand toggle */}
                  <div className="shrink-0">
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>

                  {/* Status indicator */}
                  <div className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    pool.enabled ? 'bg-emerald-500' : 'bg-gray-400'
                  )} />

                  {/* Name & badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{pool.name}</span>
                      {pool.isDefault && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700 text-[10px] px-1.5 py-0">
                          <Star className="h-2.5 w-2.5 mr-0.5 fill-amber-500" />
                          Default
                        </Badge>
                      )}
                      {!pool.enabled && (
                        <Badge variant="secondary" className="bg-gray-500/10 text-gray-500 text-[10px] px-1.5 py-0">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    {pool.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{pool.description}</p>
                    )}
                  </div>

                  {/* Quick stats */}
                  <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    {pool.subnet && (
                      <span className="font-mono">{formatInet(pool.subnet)}</span>
                    )}
                    <span>{pool._count.ranges} range{pool._count.ranges !== 1 ? 's' : ''}</span>
                    {totalIps > 0 && <span>{totalIps.toLocaleString()} IPs</span>}
                  </div>

                  {/* Assignment counts */}
                  <div className="hidden md:flex items-center gap-3 shrink-0">
                    {pool._count.plans > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-700">
                        <Server className="h-2.5 w-2.5 mr-0.5" />
                        {pool._count.plans} plan{pool._count.plans !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {pool._count.users > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-700">
                        <UserCircle className="h-2.5 w-2.5 mr-0.5" />
                        {pool._count.users} override{pool._count.users !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedPool(pool); setIsDetailOpen(true); }}>
                      <Wifi className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(pool)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => { setSelectedPool(pool); setIsDeleteOpen(true); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expanded: Ranges */}
                {isExpanded && (
                  <div className="border-t bg-muted/20 px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        IP Ranges ({pool._count.ranges})
                      </span>
                      {pool.gateway && (
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          Gateway: {formatInet(pool.gateway)}
                        </Badge>
                      )}
                      {pool.dnsServers && (
                        <Badge variant="outline" className="text-[10px]">
                          DNS: {pool.dnsServers}
                        </Badge>
                      )}
                    </div>
                    {pool.ranges.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No ranges configured</p>
                    ) : (
                      <div className="space-y-1.5">
                        {pool.ranges.map((range, idx) => (
                          <div key={range.id || idx} className="flex items-center gap-3 bg-background rounded-lg px-3 py-2 text-xs">
                            <Badge variant="outline" className="font-mono text-[11px] shrink-0">
                              {formatInet(range.startIp)}
                            </Badge>
                            <span className="text-muted-foreground">→</span>
                            <Badge variant="outline" className="font-mono text-[11px] shrink-0">
                              {formatInet(range.endIp)}
                            </Badge>
                            {range.comment && (
                              <span className="text-muted-foreground truncate">({range.comment})</span>
                            )}
                            {range.total_ips !== undefined && range.total_ips > 0 && (
                              <span className="ml-auto text-muted-foreground shrink-0">
                                {range.total_ips.toLocaleString()} IPs
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => {
        if (!open) { setIsCreateOpen(false); setIsEditOpen(false); setSelectedPool(null); }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditOpen ? 'Edit IP Pool' : 'Create IP Pool'}</DialogTitle>
            <DialogDescription>
              {isEditOpen ? 'Update the IP pool configuration' : 'Define a new IP address pool for user access restriction'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Pool Name */}
            <div className="space-y-2">
              <Label htmlFor="pool-name">Pool Name *</Label>
              <Input
                id="pool-name"
                placeholder="e.g., Guest VLAN, Premium WiFi, Staff Network"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="pool-desc">Description</Label>
              <Textarea
                id="pool-desc"
                placeholder="Pool description..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Network Config */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pool-subnet">Subnet (CIDR)</Label>
                <Input
                  id="pool-subnet"
                  placeholder="e.g., 10.0.0.0/24"
                  value={formData.subnet}
                  onChange={(e) => setFormData(prev => ({ ...prev, subnet: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pool-gateway">Gateway</Label>
                <Input
                  id="pool-gateway"
                  placeholder="e.g., 10.0.0.1"
                  value={formData.gateway}
                  onChange={(e) => setFormData(prev => ({ ...prev, gateway: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pool-dns">DNS Servers</Label>
                <Input
                  id="pool-dns"
                  placeholder="8.8.8.8,8.8.4.4"
                  value={formData.dnsServers}
                  onChange={(e) => setFormData(prev => ({ ...prev, dnsServers: e.target.value }))}
                />
              </div>
            </div>

            {/* Flags */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <Label className="text-sm font-medium">Default Pool</Label>
                  <p className="text-xs text-muted-foreground">Applied when no pool is assigned</p>
                </div>
                <Switch
                  checked={formData.isDefault}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <Label className="text-sm font-medium">Enabled</Label>
                  <p className="text-xs text-muted-foreground">Pool is active for enforcement</p>
                </div>
                <Switch
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
                />
              </div>
            </div>

            {/* IP Ranges */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">IP Ranges *</Label>
                <Button variant="outline" size="sm" onClick={addRange}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Range
                </Button>
              </div>

              {formData.ranges.map((range, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Start IP</Label>
                      <Input
                        placeholder="10.0.0.1"
                        value={range.startIp}
                        onChange={(e) => updateRange(idx, 'startIp', e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">End IP</Label>
                      <Input
                        placeholder="10.0.0.254"
                        value={range.endIp}
                        onChange={(e) => updateRange(idx, 'endIp', e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Label</Label>
                      <Input
                        placeholder="Floor 1, AP-01..."
                        value={range.comment || ''}
                        onChange={(e) => updateRange(idx, 'comment', e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                  {formData.ranges.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 shrink-0 mt-5"
                      onClick={() => removeRange(idx)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setIsEditOpen(false);
              setSelectedPool(null);
            }}>
              Cancel
            </Button>
            <Button onClick={isEditOpen ? handleUpdate : handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditOpen ? 'Update Pool' : 'Create Pool'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPool?.name}
              {selectedPool?.isDefault && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700">
                  <Star className="h-3 w-3 mr-0.5 fill-amber-500" />
                  Default
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>IP pool details and assignments</DialogDescription>
          </DialogHeader>
          {selectedPool && (
            <div className="space-y-4 py-2">
              {/* Network Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Subnet</span>
                  <p className="font-mono">{formatInet(selectedPool.subnet)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Gateway</span>
                  <p className="font-mono">{formatInet(selectedPool.gateway)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">DNS</span>
                  <p className="font-mono text-xs">{selectedPool.dnsServers || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="flex items-center gap-1.5">
                    {selectedPool.enabled
                      ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      : <ShieldX className="h-3.5 w-3.5 text-gray-500" />
                    }
                    {selectedPool.enabled ? 'Active' : 'Disabled'}
                  </p>
                </div>
              </div>

              {/* Assignments */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Assignments</p>
                <div className="flex gap-3">
                  <Badge variant="outline" className="bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <Server className="h-3 w-3 mr-1" />
                    {selectedPool._count.plans} Plan{selectedPool._count.plans !== 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="outline" className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    <UserCircle className="h-3 w-3 mr-1" />
                    {selectedPool._count.users} User Override{selectedPool._count.users !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>

              {/* Ranges */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  IP Ranges ({selectedPool._count.ranges})
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedPool.ranges.map((range, idx) => (
                    <div key={range.id || idx} className="flex items-center gap-2 bg-muted/30 rounded px-3 py-1.5 text-xs">
                      <span className="font-mono">{formatInet(range.startIp)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono">{formatInet(range.endIp)}</span>
                      {range.comment && <span className="text-muted-foreground">({range.comment})</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete IP Pool</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedPool?.name}&quot;?
              {selectedPool && (selectedPool._count.plans > 0 || selectedPool._count.users > 0) && (
                <p className="mt-2 text-amber-600 dark:text-amber-400">
                  This pool is assigned to {selectedPool._count.plans} plans and {selectedPool._count.users} users.
                  Assignments will be cleared before deletion.
                </p>
              )}
              {selectedPool?.isDefault && (
                <p className="mt-2 text-red-600 dark:text-red-400 font-medium">
                  This is the default pool! Users without specific pool assignments will have no IP restriction.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
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
