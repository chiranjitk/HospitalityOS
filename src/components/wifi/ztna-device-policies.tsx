'use client';

/**
 * ZTNA Device Policies Component
 *
 * Zero Trust Network Access management for StaySuite HospitalityOS.
 * Provides device policy CRUD, group management, device assignments,
 * and audit logging with trust level segmentation.
 *
 * Data source: /api/wifi/firewall/device-policies/*
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Loader2,
  Search,
  Filter,
  Play,
  ChevronDown,
  ChevronRight,
  Fingerprint,
  Users,
  FileText,
  Ban,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────────────

type TrustLevel = 'trusted' | 'standard' | 'restricted' | 'quarantine';
type ContentFilterLevel = 'none' | 'basic' | 'strict' | 'custom';
type MatchType = 'manual' | 'mac_oui' | 'vlan' | 'ssid' | 'device_type';
type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'assigned'
  | 'revoked'
  | 'applied'
  | 'error';

interface DevicePolicy {
  id: string;
  name: string;
  description: string | null;
  trustLevel: TrustLevel;
  bandwidthDown: number;
  bandwidthUp: number;
  contentFilter: ContentFilterLevel;
  sessionTimeout: number;
  maxDevices: number;
  autoApplyOnAuth: boolean;
  scheduleId: string | null;
  scheduleName?: string | null;
  active: boolean;
  deviceCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DeviceGroup {
  id: string;
  name: string;
  description: string | null;
  matchType: MatchType;
  matchCriteria: string;
  defaultPolicyId: string | null;
  defaultPolicyName?: string | null;
  deviceCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DeviceAssignment {
  id: string;
  macAddress: string;
  ipAddress: string | null;
  policyId: string;
  policyName: string;
  trustLevel: TrustLevel;
  source: string;
  appliedAt: string;
  lastSeen: string | null;
  status: 'active' | 'inactive' | 'expired';
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  entityType: 'policy' | 'group' | 'assignment' | 'system';
  entityId: string | null;
  entityName: string | null;
  macAddress: string | null;
  details: string | null;
  performedBy: string;
}

interface ZtnaStats {
  totalPolicies: number;
  activeAssignments: number;
  quarantinedDevices: number;
  trustDistribution: Record<TrustLevel, number>;
}

interface ScheduleOption {
  id: string;
  name: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const API_BASE = '/api/wifi/firewall';

const TRUST_LEVEL_CONFIG: Record<
  TrustLevel,
  {
    label: string;
    icon: React.ElementType;
    className: string;
    bgClass: string;
  }
> = {
  trusted: {
    label: 'Trusted',
    icon: ShieldCheck,
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
    bgClass: 'bg-emerald-500',
  },
  standard: {
    label: 'Standard',
    icon: Shield,
    className:
      'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-700',
    bgClass: 'bg-sky-500',
  },
  restricted: {
    label: 'Restricted',
    icon: ShieldAlert,
    className:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-700',
    bgClass: 'bg-orange-500',
  },
  quarantine: {
    label: 'Quarantine',
    icon: ShieldOff,
    className:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700',
    bgClass: 'bg-red-500',
  },
};

const CONTENT_FILTER_OPTIONS: {
  value: ContentFilterLevel;
  label: string;
}[] = [
  { value: 'none', label: 'None' },
  { value: 'basic', label: 'Basic' },
  { value: 'strict', label: 'Strict' },
  { value: 'custom', label: 'Custom' },
];

const MATCH_TYPE_OPTIONS: { value: MatchType; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'mac_oui', label: 'MAC OUI Prefix' },
  { value: 'vlan', label: 'VLAN Tag' },
  { value: 'ssid', label: 'SSID Match' },
  { value: 'device_type', label: 'Device Type' },
];

const MATCH_TYPE_HINTS: Record<MatchType, string> = {
  manual:
    'JSON array of MAC addresses: ["AA:BB:CC:DD:EE:FF", "11:22:33:44:55:66"]',
  mac_oui:
    'JSON array of OUI prefixes: ["00:1A:2B", "A4:83:E7"]',
  vlan:
    'JSON array of VLAN IDs: [100, 200, 300]',
  ssid:
    'JSON array of SSID names: ["GuestWiFi", "StaffWiFi"]',
  device_type:
    'JSON object with device types: {"mobile": true, "iot": true, "desktop": false}',
};

const AUDIT_ACTION_COLORS: Record<AuditAction, string> = {
  created:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
  updated:
    'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-700',
  deleted:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700',
  assigned:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-700',
  revoked:
    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-700',
  applied:
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700',
  error:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700',
};

const EMPTY_POLICY_FORM = {
  name: '',
  description: '',
  trustLevel: 'standard' as TrustLevel,
  bandwidthDown: 10240,
  bandwidthUp: 5120,
  contentFilter: 'basic' as ContentFilterLevel,
  sessionTimeout: 1440,
  maxDevices: 3,
  autoApplyOnAuth: false,
  scheduleId: '',
};

const EMPTY_GROUP_FORM = {
  name: '',
  description: '',
  matchType: 'manual' as MatchType,
  matchCriteria: '[]',
  defaultPolicyId: '',
};

const EMPTY_ASSIGN_FORM = {
  policyId: '',
  macAddress: '',
};

// ─── API Helper ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: { message: string } }> {
  return fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  }).then(async (res) => {
    const result = await res.json();
    if (!res.ok)
      throw new Error(result.error?.message || `Request failed (${res.status})`);
    return result;
  });
}

// ─── Shared Sub-Components ──────────────────────────────────────────────────────

function TrustLevelBadge({ level }: { level: TrustLevel }) {
  const config = TRUST_LEVEL_CONFIG[level];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn('text-xs font-semibold gap-1', config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function MatchTypeBadge({ type }: { type: MatchType }) {
  const colors: Record<MatchType, string> = {
    manual: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    mac_oui: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700',
    vlan: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700',
    ssid: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-700',
    device_type: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 border-pink-200 dark:border-pink-700',
  };
  const labels: Record<MatchType, string> = {
    manual: 'Manual',
    mac_oui: 'MAC OUI',
    vlan: 'VLAN',
    ssid: 'SSID',
    device_type: 'Device Type',
  };
  return (
    <Badge variant="outline" className={cn('text-xs font-semibold', colors[type])}>
      {labels[type]}
    </Badge>
  );
}

function AuditActionBadge({ action }: { action: AuditAction }) {
  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-semibold capitalize', AUDIT_ACTION_COLORS[action] || '')}
    >
      {action}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
    inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    expired: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-700',
  };
  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-semibold capitalize', colors[status] || '')}
    >
      {status}
    </Badge>
  );
}

function TableSkeleton({ cols = 6, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function formatKbps(kbps: number): string {
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  }
  return `${kbps} Kbps`;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function tryParseJson(str: string | null): Record<string, unknown> | null {
  if (!str) return null;
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

// ─── Stats Cards ────────────────────────────────────────────────────────────────

function StatsCards({ stats, loading }: { stats: ZtnaStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const totalDevices = Object.values(stats.trustDistribution).reduce((a, b) => a + b, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Policies */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Policies
              </p>
              <p className="text-2xl font-bold mt-1">{stats.totalPolicies}</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2.5">
              <Shield className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Assignments */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Active Assignments
              </p>
              <p className="text-2xl font-bold mt-1">{stats.activeAssignments}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-2.5">
              <Fingerprint className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quarantined Devices */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Quarantined
              </p>
              <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
                {stats.quarantinedDevices}
              </p>
            </div>
            <div className="rounded-xl bg-red-500/10 p-2.5">
              <ShieldOff className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trust Distribution */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Trust Distribution
            </p>
            <p className="text-xs text-muted-foreground">{totalDevices} devices</p>
          </div>
          <div className="flex items-center gap-1 h-6 rounded-full overflow-hidden bg-muted">
            {(Object.keys(TRUST_LEVEL_CONFIG) as TrustLevel[]).map((level) => {
              const count = stats.trustDistribution[level] || 0;
              const pct = totalDevices > 0 ? (count / totalDevices) * 100 : 0;
              if (pct === 0) return null;
              return (
                <Tooltip key={level}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn('h-full transition-all duration-500', TRUST_LEVEL_CONFIG[level].bgClass)}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <span className="text-xs font-medium">
                      {TRUST_LEVEL_CONFIG[level].label}: {count} ({pct.toFixed(1)}%)
                    </span>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {(Object.keys(TRUST_LEVEL_CONFIG) as TrustLevel[]).map((level) => {
              const count = stats.trustDistribution[level] || 0;
              if (count === 0) return null;
              return (
                <span key={level} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className={cn('inline-block w-2 h-2 rounded-full', TRUST_LEVEL_CONFIG[level].bgClass)} />
                  {TRUST_LEVEL_CONFIG[level].label} ({count})
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Policies Sub-tab ───────────────────────────────────────────────────────────

function PoliciesTab({
  policies,
  loading,
  statsLoading,
  stats,
  schedules,
  onRefresh,
}: {
  policies: DevicePolicy[];
  loading: boolean;
  statsLoading: boolean;
  stats: ZtnaStats | null;
  schedules: ScheduleOption[];
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<DevicePolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTrust, setFilterTrust] = useState<string>('all');
  const [form, setForm] = useState(EMPTY_POLICY_FORM);

  const resetForm = () => {
    setForm(EMPTY_POLICY_FORM);
    setEditingPolicy(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (policy: DevicePolicy) => {
    setEditingPolicy(policy);
    setForm({
      name: policy.name,
      description: policy.description || '',
      trustLevel: policy.trustLevel,
      bandwidthDown: policy.bandwidthDown,
      bandwidthUp: policy.bandwidthUp,
      contentFilter: policy.contentFilter,
      sessionTimeout: policy.sessionTimeout,
      maxDevices: policy.maxDevices,
      autoApplyOnAuth: policy.autoApplyOnAuth,
      scheduleId: policy.scheduleId || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Policy name is required',
        variant: 'destructive',
      });
      return;
    }
    if (form.bandwidthDown < 0 || form.bandwidthUp < 0) {
      toast({
        title: 'Validation Error',
        description: 'Bandwidth values must be non-negative',
        variant: 'destructive',
      });
      return;
    }
    if (form.sessionTimeout < 1) {
      toast({
        title: 'Validation Error',
        description: 'Session timeout must be at least 1 minute',
        variant: 'destructive',
      });
      return;
    }
    if (form.maxDevices < 1) {
      toast({
        title: 'Validation Error',
        description: 'Max devices must be at least 1',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingPolicy) {
        await apiFetch(`${API_BASE}/device-policies/${editingPolicy.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...form,
            scheduleId: form.scheduleId || null,
          }),
        });
        toast({ title: 'Success', description: `Policy "${form.name}" updated` });
      } else {
        await apiFetch(`${API_BASE}/device-policies`, {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            scheduleId: form.scheduleId || null,
          }),
        });
        toast({ title: 'Success', description: `Policy "${form.name}" created` });
      }
      setDialogOpen(false);
      resetForm();
      await onRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save policy';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`${API_BASE}/device-policies/${deleteId}`, { method: 'DELETE' });
      toast({ title: 'Success', description: 'Policy deleted' });
      await onRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete policy';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      await apiFetch(`${API_BASE}/device-policies/apply`, { method: 'POST' });
      toast({
        title: 'Policies Applied',
        description: 'All active policies have been applied to nftables',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to apply policies';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggleActive = async (policy: DevicePolicy) => {
    setTogglingId(policy.id);
    try {
      await apiFetch(`${API_BASE}/device-policies/${policy.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !policy.active }),
      });
      toast({
        title: 'Success',
        description: `Policy "${policy.name}" ${policy.active ? 'deactivated' : 'activated'}`,
      });
      await onRefresh();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to toggle policy',
        variant: 'destructive',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const filteredPolicies = policies.filter((p) => {
    if (filterTrust !== 'all' && p.trustLevel !== filterTrust) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) {
    return <TableSkeleton cols={8} rows={5} />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search policies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={filterTrust} onValueChange={setFilterTrust}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Trust Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trust Levels</SelectItem>
            {(Object.keys(TRUST_LEVEL_CONFIG) as TrustLevel[]).map((level) => (
              <SelectItem key={level} value={level}>
                {TRUST_LEVEL_CONFIG[level].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleApply}
          disabled={applying || policies.length === 0}
        >
          {applying ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Apply Policies
        </Button>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Policy
        </Button>
      </div>

      {/* Table */}
      {filteredPolicies.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No device policies"
          description={
            search || filterTrust !== 'all'
              ? 'No policies match the current filters. Try adjusting your search or filters.'
              : 'Create your first device policy to define trust levels and access controls.'
          }
          action={
            search || filterTrust !== 'all'
              ? undefined
              : { label: 'New Policy', onClick: openCreate }
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-auto">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Name</TableHead>
                    <TableHead>Trust Level</TableHead>
                    <TableHead>Bandwidth</TableHead>
                    <TableHead>Content Filter</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-center">Devices</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPolicies.map((policy) => (
                    <TableRow
                      key={policy.id}
                      className={cn(!policy.active && 'opacity-50')}
                    >
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">{policy.name}</span>
                          {policy.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-40">
                              {policy.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <TrustLevelBadge level={policy.trustLevel} />
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <span className="text-muted-foreground">↓</span>{' '}
                          <span className="font-mono">{formatKbps(policy.bandwidthDown)}</span>
                          <br />
                          <span className="text-muted-foreground">↑</span>{' '}
                          <span className="font-mono">{formatKbps(policy.bandwidthUp)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {policy.contentFilter}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={policy.active}
                          onCheckedChange={() => handleToggleActive(policy)}
                          disabled={togglingId === policy.id}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-medium tabular-nums">
                          {policy.deviceCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(policy)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => setDeleteId(policy.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
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

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPolicy ? 'Edit Device Policy' : 'New Device Policy'}
            </DialogTitle>
            <DialogDescription>
              {editingPolicy
                ? 'Update the device access policy settings'
                : 'Define trust level, bandwidth limits, and content filtering for devices'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>Policy Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Guest Standard, IoT Quarantine"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of this policy..."
                rows={2}
              />
            </div>

            {/* Trust Level */}
            <div className="space-y-2">
              <Label>Trust Level *</Label>
              <Select
                value={form.trustLevel}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, trustLevel: v as TrustLevel }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TRUST_LEVEL_CONFIG) as TrustLevel[]).map((level) => {
                    const Icon = TRUST_LEVEL_CONFIG[level].icon;
                    return (
                      <SelectItem key={level} value={level}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {TRUST_LEVEL_CONFIG[level].label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Bandwidth */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bandwidth Down (Kbps)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.bandwidthDown}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      bandwidthDown: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Bandwidth Up (Kbps)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.bandwidthUp}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      bandwidthUp: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            {/* Content Filter + Session Timeout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Content Filter</Label>
                <Select
                  value={form.contentFilter}
                  onValueChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      contentFilter: v as ContentFilterLevel,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Session Timeout (min)</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.sessionTimeout}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      sessionTimeout: parseInt(e.target.value) || 1440,
                    }))
                  }
                />
              </div>
            </div>

            {/* Max Devices */}
            <div className="space-y-2">
              <Label>Max Devices Per Session</Label>
              <Input
                type="number"
                min="1"
                value={form.maxDevices}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    maxDevices: parseInt(e.target.value) || 1,
                  }))
                }
              />
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <Label>Schedule (Optional)</Label>
              <Select
                value={form.scheduleId || '__none__'}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    scheduleId: v === '__none__' ? '' : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No Schedule</SelectItem>
                  {schedules.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auto-apply */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Auto-apply on Auth</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically assign this policy when a device authenticates
                </p>
              </div>
              <Switch
                checked={form.autoApplyOnAuth}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, autoApplyOnAuth: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPolicy ? 'Update Policy' : 'Create Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Device Policy</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this policy. Devices assigned to this
              policy will revert to default access rules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Groups Sub-tab ─────────────────────────────────────────────────────────────

function GroupsTab({
  groups,
  policies,
  loading,
  onRefresh,
}: {
  groups: DeviceGroup[];
  policies: DevicePolicy[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DeviceGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_GROUP_FORM);

  const resetForm = () => {
    setForm(EMPTY_GROUP_FORM);
    setEditingGroup(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (group: DeviceGroup) => {
    setEditingGroup(group);
    setForm({
      name: group.name,
      description: group.description || '',
      matchType: group.matchType,
      matchCriteria: group.matchCriteria,
      defaultPolicyId: group.defaultPolicyId || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Group name is required',
        variant: 'destructive',
      });
      return;
    }

    // Validate JSON
    try {
      JSON.parse(form.matchCriteria);
    } catch {
      toast({
        title: 'Validation Error',
        description: 'Match criteria must be valid JSON',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingGroup) {
        await apiFetch(`${API_BASE}/device-groups/${editingGroup.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...form,
            defaultPolicyId: form.defaultPolicyId || null,
          }),
        });
        toast({ title: 'Success', description: `Group "${form.name}" updated` });
      } else {
        await apiFetch(`${API_BASE}/device-groups`, {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            defaultPolicyId: form.defaultPolicyId || null,
          }),
        });
        toast({ title: 'Success', description: `Group "${form.name}" created` });
      }
      setDialogOpen(false);
      resetForm();
      await onRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save group';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`${API_BASE}/device-groups/${deleteId}`, { method: 'DELETE' });
      toast({ title: 'Success', description: 'Group deleted' });
      await onRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete group';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const filteredGroups = groups.filter((g) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        g.name.toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) {
    return <TableSkeleton cols={6} rows={5} />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Group
        </Button>
      </div>

      {/* Table */}
      {filteredGroups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No device groups"
          description={
            search
              ? 'No groups match your search. Try a different query.'
              : 'Create device groups to automatically categorize devices by MAC, VLAN, SSID, or device type.'
          }
          action={
            search ? undefined : { label: 'New Group', onClick: openCreate }
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-auto">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Match Type</TableHead>
                    <TableHead>Match Criteria</TableHead>
                    <TableHead>Default Policy</TableHead>
                    <TableHead className="text-center">Devices</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGroups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">{group.name}</span>
                          {group.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-40">
                              {group.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <MatchTypeBadge type={group.matchType} />
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded break-all block">
                            {group.matchCriteria.length > 60
                              ? group.matchCriteria.substring(0, 60) + '...'
                              : group.matchCriteria}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {group.defaultPolicyName || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-medium tabular-nums">
                          {group.deviceCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(group)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => setDeleteId(group.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
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

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? 'Edit Device Group' : 'New Device Group'}
            </DialogTitle>
            <DialogDescription>
              {editingGroup
                ? 'Update device group configuration'
                : 'Group devices by MAC OUI, VLAN, SSID, or device type for bulk policy assignment'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>Group Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. IoT Devices, Staff Mobile"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Brief description..."
                rows={2}
              />
            </div>

            {/* Match Type */}
            <div className="space-y-2">
              <Label>Match Type *</Label>
              <Select
                value={form.matchType}
                onValueChange={(v) => {
                  setForm((p) => ({
                    ...p,
                    matchType: v as MatchType,
                    matchCriteria: MATCH_TYPE_HINTS[v as MatchType].split(':')[0] === 'JSON'
                      ? MATCH_TYPE_HINTS[v as MatchType].split(' ').slice(0, 2).join(' ')
                      : '',
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATCH_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Match Criteria */}
            <div className="space-y-2">
              <Label>Match Criteria (JSON) *</Label>
              <Textarea
                value={form.matchCriteria}
                onChange={(e) =>
                  setForm((p) => ({ ...p, matchCriteria: e.target.value }))
                }
                placeholder={MATCH_TYPE_HINTS[form.matchType]}
                rows={4}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {MATCH_TYPE_HINTS[form.matchType]}
              </p>
            </div>

            {/* Default Policy */}
            <div className="space-y-2">
              <Label>Default Policy</Label>
              <Select
                value={form.defaultPolicyId || '__none__'}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    defaultPolicyId: v === '__none__' ? '' : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No default policy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No Default Policy</SelectItem>
                  {policies.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <TrustLevelBadge level={p.trustLevel} />
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingGroup ? 'Update Group' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Device Group</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this device group. Devices in this
              group will need to be reassigned manually.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Assignments Sub-tab ────────────────────────────────────────────────────────

function AssignmentsTab({
  assignments,
  policies,
  loading,
  onRefresh,
}: {
  assignments: DeviceAssignment[];
  policies: DevicePolicy[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState(EMPTY_ASSIGN_FORM);
  const [search, setSearch] = useState('');
  const [filterTrust, setFilterTrust] = useState<string>('all');
  const [filterPolicy, setFilterPolicy] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const handleAssign = async () => {
    if (!assignForm.policyId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a policy',
        variant: 'destructive',
      });
      return;
    }
    if (!assignForm.macAddress.trim()) {
      toast({
        title: 'Validation Error',
        description: 'MAC address is required',
        variant: 'destructive',
      });
      return;
    }
    const macRegex = /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/;
    if (!macRegex.test(assignForm.macAddress.trim())) {
      toast({
        title: 'Validation Error',
        description: 'Invalid MAC address format (expected: AA:BB:CC:DD:EE:FF)',
        variant: 'destructive',
      });
      return;
    }

    setAssigning(true);
    try {
      await apiFetch(`${API_BASE}/device-policies/assign`, {
        method: 'POST',
        body: JSON.stringify({
          policyId: assignForm.policyId,
          macAddress: assignForm.macAddress.trim(),
        }),
      });
      toast({
        title: 'Success',
        description: `Device ${assignForm.macAddress.trim()} assigned to policy`,
      });
      setAssignDialogOpen(false);
      setAssignForm(EMPTY_ASSIGN_FORM);
      await onRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to assign device';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeId) return;
    setRevoking(revokeId);
    try {
      await apiFetch(`${API_BASE}/device-policies/revoke`, {
        method: 'POST',
        body: JSON.stringify({ assignmentId: revokeId }),
      });
      toast({ title: 'Success', description: 'Device assignment revoked' });
      await onRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to revoke assignment';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setRevoking(null);
      setRevokeId(null);
      setRevokeDialogOpen(false);
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    if (filterTrust !== 'all' && a.trustLevel !== filterTrust) return false;
    if (filterPolicy !== 'all' && a.policyId !== filterPolicy) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.macAddress.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return <TableSkeleton cols={8} rows={5} />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by MAC address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 font-mono"
          />
        </div>
        <Select value={filterTrust} onValueChange={setFilterTrust}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Trust Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trust Levels</SelectItem>
            {(Object.keys(TRUST_LEVEL_CONFIG) as TrustLevel[]).map((level) => (
              <SelectItem key={level} value={level}>
                {TRUST_LEVEL_CONFIG[level].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPolicy} onValueChange={setFilterPolicy}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Policy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Policies</SelectItem>
            {policies.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button size="sm" onClick={() => setAssignDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Assign Device
        </Button>
      </div>

      {/* Table */}
      {filteredAssignments.length === 0 ? (
        <EmptyState
          icon={Fingerprint}
          title="No device assignments"
          description={
            search || filterTrust !== 'all' || filterPolicy !== 'all' || filterStatus !== 'all'
              ? 'No assignments match the current filters.'
              : 'Assign devices to policies to enforce trust-level access controls.'
          }
          action={
            search || filterTrust !== 'all' || filterPolicy !== 'all' || filterStatus !== 'all'
              ? undefined
              : { label: 'Assign Device', onClick: () => setAssignDialogOpen(true) }
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-auto">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MAC Address</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Policy</TableHead>
                    <TableHead>Trust Level</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <span className="font-mono text-xs font-medium">
                          {assignment.macAddress}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {assignment.ipAddress || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{assignment.policyName}</span>
                      </TableCell>
                      <TableCell>
                        <TrustLevelBadge level={assignment.trustLevel} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {assignment.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(assignment.appliedAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(assignment.lastSeen)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={assignment.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              disabled={revoking === assignment.id}
                              onClick={() => {
                                setRevokeId(assignment.id);
                                setRevokeDialogOpen(true);
                              }}
                            >
                              {revoking === assignment.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Ban className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Revoke Assignment</TooltipContent>
                        </Tooltip>
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

      {/* Assign Dialog */}
      <Dialog
        open={assignDialogOpen}
        onOpenChange={(open) => {
          if (!open) setAssignForm(EMPTY_ASSIGN_FORM);
          setAssignDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Device to Policy</DialogTitle>
            <DialogDescription>
              Manually assign a device MAC address to a trust-level policy.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Policy *</Label>
              <Select
                value={assignForm.policyId}
                onValueChange={(v) =>
                  setAssignForm((p) => ({ ...p, policyId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a policy..." />
                </SelectTrigger>
                <SelectContent>
                  {policies.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <TrustLevelBadge level={p.trustLevel} />
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>MAC Address *</Label>
              <Input
                value={assignForm.macAddress}
                onChange={(e) =>
                  setAssignForm((p) => ({
                    ...p,
                    macAddress: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="AA:BB:CC:DD:EE:FF"
                className="font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAssign();
                }}
              />
              <p className="text-xs text-muted-foreground">
                Enter the MAC address in AA:BB:CC:DD:EE:FF format
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignForm(EMPTY_ASSIGN_FORM);
                setAssignDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={assigning}>
              {assigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <AlertDialog
        open={revokeDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeId(null);
            setRevokeDialogOpen(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Device Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the policy assignment from this device. The device
              will revert to default network access rules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Audit Log Sub-tab ──────────────────────────────────────────────────────────

function AuditLogTab({
  auditLogs,
  loading,
  onRefresh,
}: {
  auditLogs: AuditLogEntry[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntityType, setFilterEntityType] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filteredLogs = auditLogs.filter((log) => {
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (filterEntityType !== 'all' && log.entityType !== filterEntityType)
      return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (log.macAddress || '').toLowerCase().includes(q) ||
        (log.entityName || '').toLowerCase().includes(q) ||
        (log.performedBy || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) {
    return <TableSkeleton cols={6} rows={8} />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by MAC, entity, user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {(
              ['created', 'updated', 'deleted', 'assigned', 'revoked', 'applied', 'error'] as AuditAction[]
            ).map((action) => (
              <SelectItem key={action} value={action}>
                <span className="capitalize">{action}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterEntityType} onValueChange={setFilterEntityType}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="policy">Policy</SelectItem>
            <SelectItem value="group">Group</SelectItem>
            <SelectItem value="assignment">Assignment</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Table */}
      {filteredLogs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No audit entries"
          description={
            search || filterAction !== 'all' || filterEntityType !== 'all'
              ? 'No audit log entries match the current filters.'
              : 'Audit trail will appear here as policies, groups, and assignments are modified.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-auto">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>MAC Address</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Performed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const details = tryParseJson(log.details);
                    const isExpanded = expandedRow === log.id;
                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <AuditActionBadge action={log.action} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs capitalize">
                              {log.entityType}
                            </Badge>
                            {log.entityName && (
                              <span className="text-xs font-medium truncate max-w-[100px]">
                                {log.entityName}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground">
                            {log.macAddress || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {details ? (
                            <div>
                              <button
                                onClick={() =>
                                  setExpandedRow(isExpanded ? null : log.id)
                                }
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                                {isExpanded ? 'Hide' : 'Show'} details
                              </button>
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="mt-1 overflow-hidden"
                                  >
                                    <pre className="text-[10px] font-mono bg-muted p-2 rounded max-w-[300px] overflow-x-auto whitespace-pre-wrap">
                                      {JSON.stringify(details, null, 2)}
                                    </pre>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                              {log.details || '—'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {log.performedBy || '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function ZtnaDevicePolicies() {
  const { toast } = useToast();

  // Data state
  const [policies, setPolicies] = useState<DevicePolicy[]>([]);
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [assignments, setAssignments] = useState<DeviceAssignment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<ZtnaStats | null>(null);
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);

  // Loading state
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [auditLogsLoading, setAuditLogsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await apiFetch<ZtnaStats>(`${API_BASE}/device-policies/stats`);
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch {
      // Set default stats so UI still renders
      setStats({
        totalPolicies: 0,
        activeAssignments: 0,
        quarantinedDevices: 0,
        trustDistribution: { trusted: 0, standard: 0, restricted: 0, quarantine: 0 },
      });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchPolicies = useCallback(async () => {
    try {
      setPoliciesLoading(true);
      const res = await apiFetch<DevicePolicy[]>(`${API_BASE}/device-policies`);
      if (res.success && res.data) {
        setPolicies(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      setPolicies([]);
    } finally {
      setPoliciesLoading(false);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      setGroupsLoading(true);
      const res = await apiFetch<DeviceGroup[]>(`${API_BASE}/device-groups`);
      if (res.success && res.data) {
        setGroups(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    try {
      setAssignmentsLoading(true);
      // Assignments are part of the policies response or a sub-endpoint
      const res = await apiFetch<DeviceAssignment[]>(
        `${API_BASE}/device-policies/assignments`
      );
      if (res.success && res.data) {
        setAssignments(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      setAssignments([]);
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setAuditLogsLoading(true);
      const res = await apiFetch<AuditLogEntry[]>(
        `${API_BASE}/device-policies/audit`
      );
      if (res.success && res.data) {
        setAuditLogs(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLogsLoading(false);
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await apiFetch<{ id: string; name: string }[]>(
        `${API_BASE}/schedules`
      );
      if (res.success && res.data) {
        setSchedules(
          Array.isArray(res.data)
            ? res.data.map((s) => ({ id: s.id, name: s.name }))
            : []
        );
      }
    } catch {
      setSchedules([]);
    }
  }, []);

  // Master refresh
  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchStats(),
      fetchPolicies(),
      fetchGroups(),
      fetchAssignments(),
      fetchAuditLogs(),
    ]);
  }, [fetchStats, fetchPolicies, fetchGroups, fetchAssignments, fetchAuditLogs]);

  useEffect(() => {
    refreshAll();
    fetchSchedules();
  }, [refreshAll, fetchSchedules]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Zero Trust Network Access
          </h2>
          <p className="text-sm text-muted-foreground">
            Device trust segmentation, policy management, and audit trail for
            hotel guest networks
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh All
        </Button>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats} loading={statsLoading} />

      {/* Sub-tabs */}
      <Tabs defaultValue="policies" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="policies" className="flex-1">
            <Shield className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
            Policies
            {policies.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4">
                {policies.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex-1">
            <Users className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
            Groups
            {groups.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4">
                {groups.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="assignments" className="flex-1">
            <Fingerprint className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
            Assignments
            {assignments.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4">
                {assignments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex-1">
            <FileText className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policies">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            <PoliciesTab
              policies={policies}
              loading={policiesLoading}
              statsLoading={statsLoading}
              stats={stats}
              schedules={schedules}
              onRefresh={refreshAll}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="groups">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            <GroupsTab
              groups={groups}
              policies={policies}
              loading={groupsLoading}
              onRefresh={refreshAll}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="assignments">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            <AssignmentsTab
              assignments={assignments}
              policies={policies}
              loading={assignmentsLoading}
              onRefresh={refreshAll}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="audit">
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            <AuditLogTab
              auditLogs={auditLogs}
              loading={auditLogsLoading}
              onRefresh={refreshAll}
            />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
