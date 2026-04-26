'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

// ─── Client-Side IP Validation ──────────────────────────────────────────────

function isValidIp(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => {
    const n = parseInt(p, 10);
    return !isNaN(n) && n >= 0 && n <= 255 && p === String(n);
  });
}

function ipToNum(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function cleanIp(ip: string): string {
  return ip.replace(/\/\d+$/, '').trim();
}

interface RangeError {
  index: number;
  message: string;
}

function validateFormRanges(ranges: IpPoolRange[]): { valid: boolean; errors: RangeError[] } {
  const errors: RangeError[] = [];
  const nums: { idx: number; start: number; end: number; label: string }[] = [];

  for (let i = 0; i < ranges.length; i++) {
    const s = cleanIp(ranges[i].startIp);
    const e = cleanIp(ranges[i].endIp);
    if (!s || !e) continue; // skip incomplete ranges

    if (!isValidIp(s)) {
      errors.push({ index: i, message: 'Invalid start IP address' });
      continue;
    }
    if (!isValidIp(e)) {
      errors.push({ index: i, message: 'Invalid end IP address' });
      continue;
    }
    if (ipToNum(s) > ipToNum(e)) {
      errors.push({ index: i, message: `Start IP (${s}) must be <= End IP (${e})` });
      continue;
    }
    nums.push({ idx: i, start: ipToNum(s), end: ipToNum(e), label: `${s}–${e}` });
  }

  // Check overlaps between completed ranges
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i].start <= nums[j].end && nums[j].start <= nums[i].end) {
        errors.push({
          index: nums[j].idx,
          message: `Overlaps with Range ${nums[i].idx + 1} (${nums[i].label})`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
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
  const [rangeErrors, setRangeErrors] = useState<RangeError[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gateway: '',
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
    setRangeErrors([]);
    if (!formData.name?.trim()) {
      toast({ title: 'Validation Error', description: 'Pool name is required', variant: 'destructive' });
      return;
    }
    const validRanges = formData.ranges.filter(r => r.startIp && r.endIp);
    if (validRanges.length === 0) {
      toast({ title: 'Validation Error', description: 'At least one IP range is required', variant: 'destructive' });
      return;
    }
    const clientValidation = validateFormRanges(formData.ranges);
    if (!clientValidation.valid) {
      setRangeErrors(clientValidation.errors);
      toast({ title: 'Validation Error', description: 'Fix the highlighted IP range errors', variant: 'destructive' });
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
        setRangeErrors([]);
        fetchPools();
      } else {
        // Show cross-pool overlap details from server
        const details = result.error?.details;
        if (Array.isArray(details) && details.length > 0) {
          setRangeErrors(details.map((msg: string, i: number) => ({ index: i, message: msg })));
          toast({
            title: 'IP Range Overlap Detected',
            description: details.slice(0, 2).join('. ')
              + (details.length > 2 ? ` (and ${details.length - 2} more)` : ''),
            variant: 'destructive',
          });
        } else {
          toast({ title: 'Error', description: result.error?.message || 'Failed to create pool', variant: 'destructive' });
        }
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
    setRangeErrors([]);
    const clientValidation = validateFormRanges(formData.ranges);
    if (!clientValidation.valid) {
      setRangeErrors(clientValidation.errors);
      toast({ title: 'Validation Error', description: 'Fix the highlighted IP range errors', variant: 'destructive' });
      return;
    }
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
        setRangeErrors([]);
        fetchPools();
      } else {
        const details = result.error?.details;
        if (Array.isArray(details) && details.length > 0) {
          setRangeErrors(details.map((msg: string, i: number) => ({ index: i, message: msg })));
          toast({
            title: 'IP Range Overlap Detected',
            description: details.slice(0, 2).join('. ')
              + (details.length > 2 ? ` (and ${details.length - 2} more)` : ''),
            variant: 'destructive',
          });
        } else {
          toast({ title: 'Error', description: result.error?.message || 'Failed to update pool', variant: 'destructive' });
        }
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
    setRangeErrors([]);
    setFormData({
      name: pool.name,
      description: pool.description || '',
      gateway: formatInet(pool.gateway),
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
      subnet: '',
      isDefault: false,
      enabled: true,
      ranges: [{ startIp: '', endIp: '', comment: '' }],
    });
    setRangeErrors([]);
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
                RADIUS checks the user&apos;s IP on every authentication attempt.
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

      {/* Pools Table */}
      <Card className="overflow-hidden">
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
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-8"></TableHead>
                <TableHead>Pool Name</TableHead>
                <TableHead>Subnet</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ranges</TableHead>
                <TableHead className="text-center">Total IPs</TableHead>
                <TableHead className="text-center">Plans</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pools.map((pool) => {
                const isExpanded = expandedPools.has(pool.id);
                const totalIps = countTotalIps(pool.ranges);

                return (
                  <React.Fragment key={pool.id}>
                    <TableRow
                      className={cn('cursor-pointer group', !pool.enabled && 'opacity-50')}
                      onClick={() => toggleExpand(pool.id)}
                    >
                      {/* Expand toggle */}
                      <TableCell className="w-8 px-2">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                      </TableCell>

                      {/* Name + badges */}
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <span className="font-semibold text-sm">{pool.name}</span>
                          {pool.isDefault && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700 text-[10px] px-1.5 py-0">
                              <Star className="h-2.5 w-2.5 mr-0.5 fill-amber-500" />
                              Default
                            </Badge>
                          )}
                        </div>
                        {pool.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{pool.description}</p>
                        )}
                      </TableCell>

                      {/* Subnet */}
                      <TableCell className="font-mono text-xs">
                        {pool.subnet ? formatInet(pool.subnet) : '—'}
                      </TableCell>

                      {/* Gateway */}
                      <TableCell className="font-mono text-xs">
                        {pool.gateway ? formatInet(pool.gateway) : '—'}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        <Badge variant={pool.enabled ? 'default' : 'secondary'} className={cn(
                          'text-[10px] px-2',
                          pool.enabled
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                            : 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/10'
                        )}>
                          <div className={cn('w-1.5 h-1.5 rounded-full mr-1.5', pool.enabled ? 'bg-emerald-500' : 'bg-gray-400')} />
                          {pool.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>

                      {/* Ranges count */}
                      <TableCell className="text-center">
                        <span className="text-sm font-medium">{pool._count.ranges}</span>
                      </TableCell>

                      {/* Total IPs */}
                      <TableCell className="text-center">
                        <span className="text-sm font-medium tabular-nums">
                          {totalIps > 0 ? totalIps.toLocaleString() : '—'}
                        </span>
                      </TableCell>

                      {/* Plans */}
                      <TableCell className="text-center">
                        {pool._count.plans > 0 ? (
                          <Badge variant="outline" className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-700 text-[10px]">
                            <Server className="h-2.5 w-2.5 mr-0.5" />
                            {pool._count.plans}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">0</span>
                        )}
                      </TableCell>

                      {/* Users */}
                      <TableCell className="text-center">
                        {pool._count.users > 0 ? (
                          <Badge variant="outline" className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-700 text-[10px]">
                            <UserCircle className="h-2.5 w-2.5 mr-0.5" />
                            {pool._count.users}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">0</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="View details" onClick={() => { setSelectedPool(pool); setIsDetailOpen(true); }}>
                            <Wifi className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit pool" onClick={() => openEditDialog(pool)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            aria-label="Delete pool"
                            onClick={() => { setSelectedPool(pool); setIsDeleteOpen(true); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded: IP Ranges sub-table */}
                    {isExpanded && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={10} className="p-0">
                          <div className="px-6 py-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                IP Ranges ({pool._count.ranges})
                              </span>
                            </div>
                            {pool.ranges.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2">No ranges configured</p>
                            ) : (
                              <div className="rounded-lg border bg-background overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                                      <TableHead className="text-xs">#</TableHead>
                                      <TableHead className="text-xs">Start IP</TableHead>
                                      <TableHead className="text-xs">End IP</TableHead>
                                      <TableHead className="text-xs">Label</TableHead>
                                      <TableHead className="text-xs text-center">IPs in Range</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {pool.ranges.map((range, idx) => (
                                      <TableRow key={range.id || idx}>
                                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                                        <TableCell className="font-mono text-xs font-medium">{formatInet(range.startIp)}</TableCell>
                                        <TableCell className="font-mono text-xs font-medium">{formatInet(range.endIp)}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{range.comment || '—'}</TableCell>
                                        <TableCell className="text-xs text-center tabular-nums">
                                          {range.total_ips !== undefined && range.total_ips > 0
                                            ? range.total_ips.toLocaleString()
                                            : (() => {
                                                if (!range.startIp || !range.endIp) return '—';
                                                try {
                                                  const s = range.startIp.replace(/\/\d+$/, '').split('.').reduce((a, o) => (a << 8) + parseInt(o), 0) >>> 0;
                                                  const e = range.endIp.replace(/\/\d+$/, '').split('.').reduce((a, o) => (a << 8) + parseInt(o), 0) >>> 0;
                                                  return Math.max(0, e - s + 1).toLocaleString();
                                                } catch { return '—'; }
                                              })()
                                          }
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              {formData.ranges.map((range, idx) => {
                const errorForRange = rangeErrors.filter(e => e.index === idx);
                const hasError = errorForRange.length > 0;
                return (
                <div key={idx} className={cn(
                  'rounded-lg border p-3 space-y-2',
                  hasError ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20' : 'border-border bg-muted/30'
                )}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Start IP</Label>
                      <Input
                        placeholder="10.0.0.1"
                        value={range.startIp}
                        onChange={(e) => { updateRange(idx, 'startIp', e.target.value); setRangeErrors(prev => prev.filter(er => er.index !== idx)); }}
                        className={cn('font-mono', hasError && 'border-red-300 dark:border-red-700 focus-visible:ring-red-400')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">End IP</Label>
                      <Input
                        placeholder="10.0.0.254"
                        value={range.endIp}
                        onChange={(e) => { updateRange(idx, 'endIp', e.target.value); setRangeErrors(prev => prev.filter(er => er.index !== idx)); }}
                        className={cn('font-mono', hasError && 'border-red-300 dark:border-red-700 focus-visible:ring-red-400')}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Label (optional)</Label>
                      <Input
                        placeholder="e.g., Floor 1, AP-01"
                        value={range.comment || ''}
                        onChange={(e) => updateRange(idx, 'comment', e.target.value)}
                      />
                    </div>
                    {formData.ranges.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-500 hover:text-red-600 shrink-0 mt-6"
                        onClick={() => removeRange(idx)}
                        aria-label="Remove range"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {hasError && (
                    <div className="flex items-start gap-1.5 rounded-md bg-red-100 dark:bg-red-950/40 px-2.5 py-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                      <span className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{errorForRange.map(e => e.message).join('; ')}</span>
                    </div>
                  )}
                </div>
                );
              })}
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
