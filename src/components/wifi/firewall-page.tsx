'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  ShieldBan,
  ShieldAlert,
  Plus,
  Trash2,
  Edit2,
  Eye,
  Ban,
  Gauge,
  Clock,
  Zap,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Globe,
  Network,
  Lock,
  Unlock,
  Server,
  Route,
  Timer,
  LayoutGrid,
  Calendar,
  BarChart3,
  GitBranch,
  Copy,
  Check,
  Info,
  ChevronDown,
  ChevronRight,
  Play,
  Trash,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Lazy-loaded tab components ─────────────────────────────────────

const BandwidthScheduler = dynamic(
  () => import('./bandwidth-scheduler').then((m) => m.default),
  { ssr: false, loading: () => <TableSkeleton cols={6} rows={5} /> }
);
const BwPolicyDetails = dynamic(
  () => import('./bw-policy-details').then((m) => m.default),
  { ssr: false, loading: () => <TableSkeleton cols={6} rows={5} /> }
);
const WebCategories = dynamic(
  () => import('./web-categories').then((m) => m.default),
  { ssr: false, loading: () => <TableSkeleton cols={6} rows={5} /> }
);

// ─── Types ───────────────────────────────────────────────────────────

interface GuiRule {
  id: string;
  name: string;
  chain: string;
  protocol: string;
  sourceIp: string;
  destIp: string;
  destPort: string;
  action: string;
  enabled: boolean;
  comment: string;
  priority: number;
  handle: number;
  createdAt: string;
}

interface PortForward {
  id: string;
  name: string;
  protocol: string;
  externalPort: number;
  internalIp: string;
  internalPort: number;
  sourceIp: string;
  enabled: boolean;
  handle: number;
  createdAt: string;
}

interface RateLimit {
  id: string;
  name: string;
  targetIp: string;
  downloadRate: string;
  uploadRate: string;
  protocol: string;
  enabled: boolean;
  downloadHandle: number;
  uploadHandle: number;
  createdAt: string;
}

interface QuickBlock {
  id: string;
  type: string;
  value: string;
  reason: string;
  blockedAt: string;
  handle: number;
}

interface Preset {
  id: string;
  name: string;
  description: string;
  category: string;
  rules: { protocol: string; destPort: string; action: string }[];
}

interface Schedule {
  id: string;
  name: string;
  days: string;
  startTime: string;
  endTime: string;
  linkedRules?: number;
  enabled: boolean;
  createdAt?: string;
}

// ─── API Helper ──────────────────────────────────────────────────────

const API_BASE = '/api/nftables';

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

// ─── Shared Components ───────────────────────────────────────────────

function TableSkeleton({ cols = 6, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <div className="space-y-3">
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

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    accept: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
    drop: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700',
    reject: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-700',
    log: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700',
  };
  return (
    <Badge variant="outline" className={cn('text-xs font-semibold', colors[action] || '')}>
      {action.toUpperCase()}
    </Badge>
  );
}

function BlockTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    ip: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700',
    subnet: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-700',
    mac: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 border-pink-200 dark:border-pink-700',
  };
  return (
    <Badge variant="outline" className={cn('text-xs font-semibold', colors[type] || '')}>
      {type.toUpperCase()}
    </Badge>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    networking: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-700',
    'remote-access': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700',
    security: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700',
    'content-filter': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700',
  };
  return (
    <Badge variant="outline" className={cn('text-xs font-semibold', colors[category] || '')}>
      {category.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
    </Badge>
  );
}

function ChainBadge({ chain }: { chain: string }) {
  const colors: Record<string, string> = {
    firewallchains: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-700',
    firewallchainsdn: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
    frchainspre: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700',
    frchainspost: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-700',
    firewallchains_conn: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700',
    firewallchainsdn_conn: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700',
  };
  const labels: Record<string, string> = {
    firewallchains: 'Uplink',
    firewallchainsdn: 'Downlink',
    frchainspre: 'NAT Pre',
    frchainspost: 'NAT Post',
    firewallchains_conn: 'Uplink CT',
    firewallchainsdn_conn: 'Downlink CT',
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn('text-xs font-semibold cursor-default', colors[chain] || '')}>
          {labels[chain] || chain}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-mono text-xs">{chain}</p>
        <p className="text-xs text-muted-foreground">
          {CHAIN_OPTIONS.flatMap((g) => g.chains).find((c) => c.value === chain)?.description}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

const RATE_PRESETS = [
  { label: '512 Kbps', value: '512kbit' },
  { label: '1 Mbps', value: '1mbit' },
  { label: '2 Mbps', value: '2mbit' },
  { label: '5 Mbps', value: '5mbit' },
  { label: '10 Mbps', value: '10mbit' },
  { label: '20 Mbps', value: '20mbit' },
  { label: '50 Mbps', value: '50mbit' },
  { label: '100 Mbps', value: '100mbit' },
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CHAIN_OPTIONS = [
  {
    group: 'inet mangle',
    chains: [
      { value: 'firewallchains', label: 'Uplink Filter', description: 'mangle prerouting — filter outbound guest traffic' },
      { value: 'firewallchainsdn', label: 'Downlink Filter', description: 'mangle postrouting — filter inbound guest traffic' },
      { value: 'firewallchains_conn', label: 'Uplink Conntrack', description: 'mangle prerouting — stateful uplink connection marking' },
      { value: 'firewallchainsdn_conn', label: 'Downlink Conntrack', description: 'mangle postrouting — stateful downlink connection marking' },
    ],
  },
  {
    group: 'inet nat',
    chains: [
      { value: 'frchainspre', label: 'NAT Prerouting', description: 'nat prerouting — DNAT / Port Forward rules' },
      { value: 'frchainspost', label: 'NAT Postrouting', description: 'nat postrouting — SNAT / Masquerade rules' },
    ],
  },
] as const;

// ─── Main Firewall Page ─────────────────────────────────────────────

export default function FirewallPage() {
  const [activeTab, setActiveTab] = useState('rules');

  const tabs = [
    { id: 'rules', label: 'Rules', icon: ShieldCheck },
    { id: 'port-forward', label: 'Port Forwarding', icon: Route },
    { id: 'rate-limit', label: 'Rate Limiting', icon: Gauge },
    { id: 'quick-block', label: 'Quick Block', icon: Ban },
    { id: 'schedules', label: 'Schedules', icon: Clock },
    { id: 'presets', label: 'Presets', icon: LayoutGrid },
    { id: 'bw-scheduler', label: 'BW Scheduler', icon: Calendar },
    { id: 'bw-policies', label: 'BW Policies', icon: BarChart3 },
    { id: 'web-categories', label: 'Web Categories', icon: ShieldAlert },
    { id: 'chain-architecture', label: 'Chain Architecture', icon: GitBranch },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-teal-600 dark:text-teal-400" />
          Firewall Management
        </h2>
        <p className="text-muted-foreground">
          Manage nftables firewall rules, port forwarding, rate limiting, and security presets
        </p>
      </div>

      {/* Sticky Tab Navigation */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-1">
        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-background text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'rules' && <RulesTab />}
      {activeTab === 'port-forward' && <PortForwardTab />}
      {activeTab === 'rate-limit' && <RateLimitTab />}
      {activeTab === 'quick-block' && <QuickBlockTab />}
      {activeTab === 'schedules' && <SchedulesTab />}
      {activeTab === 'presets' && <PresetsTab />}
      {activeTab === 'bw-scheduler' && <BandwidthScheduler />}
      {activeTab === 'bw-policies' && <BwPolicyDetails />}
      {activeTab === 'web-categories' && <WebCategories />}
      {activeTab === 'chain-architecture' && <ChainArchitectureTab />}
    </div>
  );
}

// ─── Tab 1: Rules ───────────────────────────────────────────────────

function RulesTab() {
  const { toast } = useToast();
  const [rules, setRules] = useState<GuiRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<GuiRule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ protocol: 'all', action: 'all', chain: 'all' });

  const [form, setForm] = useState({
    name: '',
    chain: 'firewallchains',
    protocol: 'tcp',
    sourceIp: '',
    destIp: '',
    destPort: '',
    action: 'accept',
    comment: '',
    enabled: true,
  });

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<GuiRule[]>(`${API_BASE}/gui-rules`);
      if (res.success && res.data) {
        setRules(res.data);
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Failed to load firewall rules',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const openAdd = () => {
    setEditingRule(null);
    setForm({ name: '', chain: 'firewallchains', protocol: 'tcp', sourceIp: '', destIp: '', destPort: '', action: 'accept', comment: '', enabled: true });
    setDialogOpen(true);
  };

  const openEdit = (r: GuiRule) => {
    setEditingRule(r);
    setForm({
      name: r.name,
      chain: r.chain || 'firewallchains',
      protocol: r.protocol,
      sourceIp: r.sourceIp || '',
      destIp: r.destIp || '',
      destPort: r.destPort || '',
      action: r.action,
      comment: r.comment || '',
      enabled: r.enabled,
    });
    setDialogOpen(true);
  };

  const saveRule = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Validation Error', description: 'Rule name is required', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      if (editingRule) {
        await apiFetch(`${API_BASE}/gui-rules/${editingRule.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        toast({ title: 'Rule Updated', description: `${form.name} has been updated.` });
      } else {
        const maxP = rules.length > 0 ? Math.max(...rules.map((r) => r.priority)) : 0;
        await apiFetch(`${API_BASE}/gui-rules`, {
          method: 'POST',
          body: JSON.stringify({ ...form, priority: maxP + 10 }),
        });
        toast({ title: 'Rule Created', description: `${form.name} has been created.` });
      }
      setDialogOpen(false);
      await fetchRules();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save rule';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`${API_BASE}/gui-rules/${deleteId}`, { method: 'DELETE' });
      toast({ title: 'Rule Deleted', description: 'Firewall rule has been removed.' });
      await fetchRules();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete rule';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const toggleRule = async (id: string) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;
    try {
      await apiFetch(`${API_BASE}/gui-rules/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      setRules(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
      toast({ title: rule.enabled ? 'Rule Disabled' : 'Rule Enabled' });
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle rule', variant: 'destructive' });
    }
  };

  const moveRule = async (id: string, dir: 'up' | 'down') => {
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex((r) => r.id === id);
    if ((dir === 'up' && idx <= 0) || (dir === 'down' && idx >= sorted.length - 1)) return;

    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    const tempP = sorted[idx].priority;
    sorted[idx] = { ...sorted[idx], priority: sorted[swapIdx].priority };
    sorted[swapIdx] = { ...sorted[swapIdx], priority: tempP };
    setRules(sorted);

    try {
      await Promise.all([
        apiFetch(`${API_BASE}/gui-rules/${sorted[idx].id}`, {
          method: 'PUT',
          body: JSON.stringify({ priority: sorted[idx].priority }),
        }),
        apiFetch(`${API_BASE}/gui-rules/${sorted[swapIdx].id}`, {
          method: 'PUT',
          body: JSON.stringify({ priority: sorted[swapIdx].priority }),
        }),
      ]);
    } catch {
      toast({ title: 'Error', description: 'Failed to reorder rules', variant: 'destructive' });
      await fetchRules();
    }
  };

  const filteredRules = rules
    .filter((r) => filters.chain === 'all' || r.chain === filters.chain)
    .filter((r) => filters.protocol === 'all' || r.protocol === filters.protocol)
    .filter((r) => filters.action === 'all' || r.action === filters.action)
    .sort((a, b) => a.priority - b.priority);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
        <TableSkeleton cols={9} rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filters.protocol} onValueChange={(v) => setFilters((p) => ({ ...p, protocol: v }))}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Protocol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Proto</SelectItem>
            <SelectItem value="tcp">TCP</SelectItem>
            <SelectItem value="udp">UDP</SelectItem>
            <SelectItem value="icmp">ICMP</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.chain} onValueChange={(v) => setFilters((p) => ({ ...p, chain: v }))}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Chain" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Chains</SelectItem>
            {CHAIN_OPTIONS.map((group) => (
              <SelectItem key={group.group} value={group.chains.map((c) => c.value).join(',')} disabled className="pointer-events-none text-muted-foreground font-semibold text-xs">
                {group.group}
              </SelectItem>
            ))}
            {CHAIN_OPTIONS.flatMap((g) => g.chains).map((chain) => (
              <SelectItem key={chain.value} value={chain.value} className="pl-6">
                {chain.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.action} onValueChange={(v) => setFilters((p) => ({ ...p, action: v }))}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="accept">Accept</SelectItem>
            <SelectItem value="drop">Drop</SelectItem>
            <SelectItem value="reject">Reject</SelectItem>
            <SelectItem value="log">Log</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={fetchRules}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Rules Table */}
      {filteredRules.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No firewall rules"
          description={
            filters.protocol !== 'all' || filters.action !== 'all' || filters.chain !== 'all'
              ? 'No rules match the current filters. Try adjusting your filters.'
              : 'Create your first firewall rule to control network traffic.'
          }
          action={filters.protocol === 'all' && filters.action === 'all' && filters.chain === 'all' ? { label: 'Add Rule', onClick: openAdd } : undefined}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Pri</TableHead>
                    <TableHead className="w-28">Chain</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Dest</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="w-16">On</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => (
                    <TableRow key={rule.id} className={cn(!rule.enabled && 'opacity-50')}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveRule(rule.id, 'up')}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Move Up</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveRule(rule.id, 'down')}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Move Down</TooltipContent>
                          </Tooltip>
                          <span className="ml-1 font-mono text-xs font-bold">{rule.priority}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ChainBadge chain={rule.chain} />
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">{rule.name}</span>
                          {rule.comment && (
                            <p className="text-xs text-muted-foreground truncate max-w-40">{rule.comment}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {rule.protocol.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{rule.sourceIp || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{rule.destIp || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{rule.destPort || '—'}</TableCell>
                      <TableCell>
                        <ActionBadge action={rule.action} />
                      </TableCell>
                      <TableCell>
                        <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}>
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
                                onClick={() => setDeleteId(rule.id)}
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
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Rule' : 'Add Firewall Rule'}</DialogTitle>
            <DialogDescription>
              {editingRule ? 'Modify the existing firewall rule.' : 'Create a new custom firewall rule.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rule Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Allow PMS Access"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Chain *</Label>
              <Select value={form.chain} onValueChange={(v) => setForm((p) => ({ ...p, chain: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select chain" />
                </SelectTrigger>
                <SelectContent>
                  {CHAIN_OPTIONS.map((group) => (
                    <SelectItem key={group.group} value={group.chains.map((c) => c.value).join(',')} disabled className="pointer-events-none text-muted-foreground font-semibold text-xs">
                      {group.group}
                    </SelectItem>
                  ))}
                  {CHAIN_OPTIONS.flatMap((g) => g.chains).map((chain) => (
                    <SelectItem key={chain.value} value={chain.value} className="pl-6">
                      <div className="flex flex-col">
                        <span>{chain.label}</span>
                        <span className="text-xs text-muted-foreground font-normal">{chain.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The nftables chain where this rule will be inserted. Each chain serves a different purpose in the packet processing pipeline.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Protocol</Label>
                <Select value={form.protocol} onValueChange={(v) => setForm((p) => ({ ...p, protocol: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="udp">UDP</SelectItem>
                    <SelectItem value="icmp">ICMP</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={form.action} onValueChange={(v) => setForm((p) => ({ ...p, action: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accept">Accept</SelectItem>
                    <SelectItem value="drop">Drop</SelectItem>
                    <SelectItem value="reject">Reject</SelectItem>
                    <SelectItem value="log">Log</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source IP / CIDR</Label>
                <Input
                  value={form.sourceIp}
                  onChange={(e) => setForm((p) => ({ ...p, sourceIp: e.target.value }))}
                  placeholder="e.g. 10.0.0.0/24"
                />
              </div>
              <div className="space-y-2">
                <Label>Dest IP / CIDR</Label>
                <Input
                  value={form.destIp}
                  onChange={(e) => setForm((p) => ({ ...p, destIp: e.target.value }))}
                  placeholder="e.g. 10.0.0.50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Destination Port</Label>
              <Input
                value={form.destPort}
                onChange={(e) => setForm((p) => ({ ...p, destPort: e.target.value }))}
                placeholder="e.g. 5432 or 8000-9000"
              />
            </div>
            <div className="space-y-2">
              <Label>Comment</Label>
              <Input
                value={form.comment}
                onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={form.enabled} onCheckedChange={(c) => setForm((p) => ({ ...p, enabled: c }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveRule} disabled={!form.name.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? 'Update' : 'Create'} Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this firewall rule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteRule} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Tab 2: Port Forwarding ─────────────────────────────────────────

function PortForwardTab() {
  const { toast } = useToast();
  const [forwards, setForwards] = useState<PortForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFwd, setEditingFwd] = useState<PortForward | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    protocol: 'tcp',
    externalPort: '',
    internalIp: '',
    internalPort: '',
    sourceIp: '',
    enabled: true,
  });

  const fetchForwards = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<PortForward[]>(`${API_BASE}/port-forwards`);
      if (res.success && res.data) setForwards(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load port forwards', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchForwards();
  }, [fetchForwards]);

  const openAdd = () => {
    setEditingFwd(null);
    setForm({ name: '', protocol: 'tcp', externalPort: '', internalIp: '', internalPort: '', sourceIp: '', enabled: true });
    setDialogOpen(true);
  };

  const openEdit = (f: PortForward) => {
    setEditingFwd(f);
    setForm({
      name: f.name,
      protocol: f.protocol,
      externalPort: String(f.externalPort),
      internalIp: f.internalIp,
      internalPort: String(f.internalPort),
      sourceIp: f.sourceIp || '',
      enabled: f.enabled,
    });
    setDialogOpen(true);
  };

  const saveForward = async () => {
    if (!form.name.trim() || !form.externalPort || !form.internalIp || !form.internalPort) {
      toast({ title: 'Validation Error', description: 'Name, ports, and internal IP are required', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const body = {
        ...form,
        externalPort: parseInt(form.externalPort, 10),
        internalPort: parseInt(form.internalPort, 10),
      };
      if (editingFwd) {
        await apiFetch(`${API_BASE}/port-forwards/${editingFwd.id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast({ title: 'Port Forward Updated', description: `${form.name} has been updated.` });
      } else {
        await apiFetch(`${API_BASE}/port-forwards`, { method: 'POST', body: JSON.stringify(body) });
        toast({ title: 'Port Forward Created', description: `${form.name} has been created.` });
      }
      setDialogOpen(false);
      await fetchForwards();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save port forward';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteForward = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`${API_BASE}/port-forwards/${deleteId}`, { method: 'DELETE' });
      toast({ title: 'Port Forward Deleted' });
      await fetchForwards();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const toggleForward = async (id: string) => {
    const fwd = forwards.find((f) => f.id === id);
    if (!fwd) return;
    try {
      await apiFetch(`${API_BASE}/port-forwards/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !fwd.enabled }),
      });
      setForwards(forwards.map((f) => (f.id === id ? { ...f, enabled: !fwd.enabled } : f)));
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle port forward', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-40" />
        </div>
        <TableSkeleton cols={7} rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Route className="h-4 w-4" />
          {forwards.length} port forward{forwards.length !== 1 ? 's' : ''} configured
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchForwards}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Port Forward
          </Button>
        </div>
      </div>

      {/* Table */}
      {forwards.length === 0 ? (
        <EmptyState
          icon={Route}
          title="No port forwarding rules"
          description="Set up port forwarding to route external traffic to internal services like RDP, CCTV, or PMS."
          action={{ label: 'Add Port Forward', onClick: openAdd }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Ext Port</TableHead>
                    <TableHead>Internal IP</TableHead>
                    <TableHead>Int Port</TableHead>
                    <TableHead>Source Restriction</TableHead>
                    <TableHead className="w-16">On</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forwards.map((fwd) => (
                    <TableRow key={fwd.id} className={cn(!fwd.enabled && 'opacity-50')}>
                      <TableCell className="font-medium text-sm">{fwd.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">{fwd.protocol.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{fwd.externalPort}</TableCell>
                      <TableCell className="font-mono text-sm">{fwd.internalIp}</TableCell>
                      <TableCell className="font-mono text-sm">{fwd.internalPort}</TableCell>
                      <TableCell className="font-mono text-xs">{fwd.sourceIp || '—'}</TableCell>
                      <TableCell>
                        <Switch checked={fwd.enabled} onCheckedChange={() => toggleForward(fwd.id)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(fwd)}>
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
                                onClick={() => setDeleteId(fwd.id)}
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
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFwd ? 'Edit Port Forward' : 'Add Port Forward'}</DialogTitle>
            <DialogDescription>
              Configure DNAT port forwarding rule for external-to-internal traffic routing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. RDP to Front Desk"
              />
            </div>
            <div className="space-y-2">
              <Label>Protocol</Label>
              <Select value={form.protocol} onValueChange={(v) => setForm((p) => ({ ...p, protocol: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tcp">TCP</SelectItem>
                  <SelectItem value="udp">UDP</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>External Port *</Label>
                <Input
                  type="number"
                  value={form.externalPort}
                  onChange={(e) => setForm((p) => ({ ...p, externalPort: e.target.value }))}
                  placeholder="e.g. 3389"
                />
              </div>
              <div className="space-y-2">
                <Label>Internal Port *</Label>
                <Input
                  type="number"
                  value={form.internalPort}
                  onChange={(e) => setForm((p) => ({ ...p, internalPort: e.target.value }))}
                  placeholder="e.g. 3389"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Internal IP *</Label>
              <Input
                value={form.internalIp}
                onChange={(e) => setForm((p) => ({ ...p, internalIp: e.target.value }))}
                placeholder="e.g. 10.0.0.50"
              />
            </div>
            <div className="space-y-2">
              <Label>Source IP Restriction (optional)</Label>
              <Input
                value={form.sourceIp}
                onChange={(e) => setForm((p) => ({ ...p, sourceIp: e.target.value }))}
                placeholder="e.g. 203.0.113.0/24"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={form.enabled} onCheckedChange={(c) => setForm((p) => ({ ...p, enabled: c }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveForward} disabled={!form.name.trim() || !form.externalPort || !form.internalIp || !form.internalPort || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingFwd ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Port Forward</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this port forwarding rule? External traffic will no longer be routed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteForward} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Tab 3: Rate Limiting ───────────────────────────────────────────

function RateLimitTab() {
  const { toast } = useToast();
  const [limits, setLimits] = useState<RateLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLimit, setEditingLimit] = useState<RateLimit | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    targetIp: '',
    downloadRate: '5mbit',
    uploadRate: '2mbit',
    protocol: 'all',
    enabled: true,
  });

  const fetchLimits = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<RateLimit[]>(`${API_BASE}/rate-limits`);
      if (res.success && res.data) setLimits(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load rate limits', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  const openAdd = () => {
    setEditingLimit(null);
    setForm({ name: '', targetIp: '', downloadRate: '5mbit', uploadRate: '2mbit', protocol: 'all', enabled: true });
    setDialogOpen(true);
  };

  const openEdit = (l: RateLimit) => {
    setEditingLimit(l);
    setForm({
      name: l.name,
      targetIp: l.targetIp,
      downloadRate: l.downloadRate,
      uploadRate: l.uploadRate,
      protocol: l.protocol,
      enabled: l.enabled,
    });
    setDialogOpen(true);
  };

  const saveLimit = async () => {
    if (!form.name.trim() || !form.targetIp.trim()) {
      toast({ title: 'Validation Error', description: 'Name and target IP/CIDR are required', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      if (editingLimit) {
        await apiFetch(`${API_BASE}/rate-limits/${editingLimit.id}`, { method: 'PUT', body: JSON.stringify(form) });
        toast({ title: 'Rate Limit Updated', description: `${form.name} has been updated.` });
      } else {
        await apiFetch(`${API_BASE}/rate-limits`, { method: 'POST', body: JSON.stringify(form) });
        toast({ title: 'Rate Limit Created', description: `${form.name} has been created.` });
      }
      setDialogOpen(false);
      await fetchLimits();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save rate limit';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteLimit = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`${API_BASE}/rate-limits/${deleteId}`, { method: 'DELETE' });
      toast({ title: 'Rate Limit Deleted' });
      await fetchLimits();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const toggleLimit = async (id: string) => {
    const limit = limits.find((l) => l.id === id);
    if (!limit) return;
    try {
      await apiFetch(`${API_BASE}/rate-limits/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !limit.enabled }),
      });
      setLimits(limits.map((l) => (l.id === id ? { ...l, enabled: !limit.enabled } : l)));
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle rate limit', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-40" />
        </div>
        <TableSkeleton cols={6} rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Gauge className="h-4 w-4" />
          {limits.length} rate limit{limits.length !== 1 ? 's' : ''} configured
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLimits}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Rate Limit
          </Button>
        </div>
      </div>

      {/* Table */}
      {limits.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="No rate limits"
          description="Control bandwidth usage per IP or subnet for guests, IoT devices, or specific networks."
          action={{ label: 'Add Rate Limit', onClick: openAdd }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Target IP/CIDR</TableHead>
                    <TableHead>Download</TableHead>
                    <TableHead>Upload</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead className="w-16">On</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {limits.map((limit) => (
                    <TableRow key={limit.id} className={cn(!limit.enabled && 'opacity-50')}>
                      <TableCell className="font-medium text-sm">{limit.name}</TableCell>
                      <TableCell className="font-mono text-sm">{limit.targetIp}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <ArrowDown className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                          <span className="text-sm font-mono">{limit.downloadRate}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <ArrowUp className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                          <span className="text-sm font-mono">{limit.uploadRate}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">{limit.protocol.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        <Switch checked={limit.enabled} onCheckedChange={() => toggleLimit(limit.id)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(limit)}>
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
                                onClick={() => setDeleteId(limit.id)}
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
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLimit ? 'Edit Rate Limit' : 'Add Rate Limit'}</DialogTitle>
            <DialogDescription>
              Configure bandwidth limits for a specific IP address or subnet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Limit IoT devices"
              />
            </div>
            <div className="space-y-2">
              <Label>Target IP/CIDR *</Label>
              <Input
                value={form.targetIp}
                onChange={(e) => setForm((p) => ({ ...p, targetIp: e.target.value }))}
                placeholder="e.g. 10.0.2.0/24"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Download Rate</Label>
                <Select value={form.downloadRate} onValueChange={(v) => setForm((p) => ({ ...p, downloadRate: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RATE_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Upload Rate</Label>
                <Select value={form.uploadRate} onValueChange={(v) => setForm((p) => ({ ...p, uploadRate: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RATE_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Protocol</Label>
              <Select value={form.protocol} onValueChange={(v) => setForm((p) => ({ ...p, protocol: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="tcp">TCP</SelectItem>
                  <SelectItem value="udp">UDP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={form.enabled} onCheckedChange={(c) => setForm((p) => ({ ...p, enabled: c }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveLimit} disabled={!form.name.trim() || !form.targetIp.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingLimit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rate Limit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this bandwidth limit?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteLimit} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Tab 4: Quick Block ─────────────────────────────────────────────

function QuickBlockTab() {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<QuickBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocking, setBlocking] = useState(false);
  const [type, setType] = useState('ip');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchBlocks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<QuickBlock[]>(`${API_BASE}/quick-blocks`);
      if (res.success && res.data) setBlocks(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load quick blocks', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const handleBlock = async () => {
    if (!value.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter a value to block', variant: 'destructive' });
      return;
    }
    try {
      setBlocking(true);
      await apiFetch(`${API_BASE}/quick-blocks`, {
        method: 'POST',
        body: JSON.stringify({ type, value: value.trim(), reason: reason.trim() || 'Manual block' }),
      });
      toast({ title: 'Blocked', description: `${type.toUpperCase()} ${value} has been blocked.` });
      setValue('');
      setReason('');
      await fetchBlocks();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to block';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setBlocking(false);
    }
  };

  const unblock = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`${API_BASE}/quick-blocks/${deleteId}`, { method: 'DELETE' });
      toast({ title: 'Unblocked', description: 'Block has been removed.' });
      await fetchBlocks();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to unblock';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const typePlaceholder: Record<string, string> = {
    ip: 'e.g. 103.21.44.5',
    subnet: 'e.g. 198.51.100.0/24',
    mac: 'e.g. AA:BB:CC:DD:EE:FF',
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <TableSkeleton cols={5} rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Add Form */}
      <Card className="border-teal-200 bg-teal-50/30 dark:bg-teal-950/10 dark:border-teal-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            Quick Block
          </CardTitle>
          <CardDescription>
            Instantly block an IP address, subnet, or MAC address from accessing the network.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ip">IP</SelectItem>
                <SelectItem value="subnet">Subnet</SelectItem>
                <SelectItem value="mac">MAC</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={typePlaceholder[type]}
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleBlock()}
            />
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleBlock()}
            />
            <Button onClick={handleBlock} disabled={blocking || !value.trim()}>
              {blocking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
              Block
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Blocks */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ShieldBan className="h-4 w-4 text-muted-foreground" />
          Recent Blocks
          <Badge variant="secondary" className="text-xs">{blocks.length}</Badge>
        </h3>
        <Button variant="outline" size="sm" onClick={fetchBlocks}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {blocks.length === 0 ? (
        <EmptyState
          icon={ShieldBan}
          title="No active blocks"
          description="Blocked IPs, subnets, and MAC addresses will appear here. Use the form above to add one."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Blocked At</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blocks.map((block) => (
                    <TableRow key={block.id}>
                      <TableCell>
                        <BlockTypeBadge type={block.type} />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{block.value}</TableCell>
                      <TableCell className="text-sm">{block.reason}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {block.blockedAt ? new Date(block.blockedAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-teal-600 dark:text-teal-400 hover:text-teal-700 hover:bg-teal-50"
                              onClick={() => setDeleteId(block.id)}
                            >
                              <Unlock className="h-3.5 w-3.5 mr-1" />
                              Unblock
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove block</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unblock Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this block? The entry will be able to access the network again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={unblock}>
              Unblock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Tab 5: Schedules ───────────────────────────────────────────────

function SchedulesTab() {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  const [form, setForm] = useState({
    name: '',
    days: [true, true, true, true, true, false, false],
    startTime: '09:00',
    endTime: '18:00',
    enabled: true,
  });

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/wifi/firewall/schedules');
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          setSchedules(result.data);
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load schedules', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const openAdd = () => {
    setEditingSchedule(null);
    setForm({ name: '', days: [true, true, true, true, true, false, false], startTime: '09:00', endTime: '18:00', enabled: true });
    setDialogOpen(true);
  };

  const openEdit = (s: Schedule) => {
    setEditingSchedule(s);
    const daysArr = typeof s.days === 'string'
      ? s.days.split(',').map((d) => d === '1')
      : Array.isArray(s.days)
        ? s.days
        : [true, true, true, true, true, false, false];
    setForm({
      name: s.name,
      days: daysArr.length === 7 ? daysArr : [true, true, true, true, true, false, false],
      startTime: s.startTime || '09:00',
      endTime: s.endTime || '18:00',
      enabled: s.enabled,
    });
    setDialogOpen(true);
  };

  const saveSchedule = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Validation Error', description: 'Schedule name is required', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const body = {
        ...form,
        days: form.days.join(','),
      };
      if (editingSchedule) {
        const res = await fetch(`/api/wifi/firewall/schedules/${editingSchedule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          toast({ title: 'Schedule Updated', description: `${form.name} has been updated.` });
        } else {
          const err = await res.json();
          throw new Error(err.error?.message || 'Update failed');
        }
      } else {
        const res = await fetch('/api/wifi/firewall/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          toast({ title: 'Schedule Created', description: `${form.name} has been created.` });
        } else {
          const err = await res.json();
          throw new Error(err.error?.message || 'Create failed');
        }
      }
      setDialogOpen(false);
      await fetchSchedules();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save schedule';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.map((d, i) => (i === idx ? !d : d)),
    }));
  };

  const isScheduleActiveNow = (schedule: Schedule) => {
    if (!schedule.enabled) return false;
    const now = new Date();
    const dayOfWeek = now.getDay();
    // JS: 0=Sun, 1=Mon... our array: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    const mappedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const daysArr = typeof schedule.days === 'string'
      ? schedule.days.split(',').map((d) => d === '1')
      : Array.isArray(schedule.days) ? schedule.days : [true, true, true, true, true, false, false];
    if (!daysArr[mappedDay]) return false;
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return currentTime >= (schedule.startTime || '00:00') && currentTime <= (schedule.endTime || '23:59');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-40" />
        </div>
        <TableSkeleton cols={5} rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Timer className="h-4 w-4" />
          Time-based rule scheduling (linking to rules coming soon)
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSchedules}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Schedule
          </Button>
        </div>
      </div>

      {/* Table */}
      {schedules.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No schedules"
          description="Create time-based schedules to automatically enable or disable firewall rules at specific times."
          action={{ label: 'Add Schedule', onClick: openAdd }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Linked Rules</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => {
                    const activeNow = isScheduleActiveNow(schedule);
                    const daysArr = typeof schedule.days === 'string'
                      ? schedule.days.split(',').map((d) => (d === '1' ? DAY_LABELS : '·'))
                      : Array.isArray(schedule.days)
                        ? schedule.days.map((d, i) => (d ? DAY_LABELS[i] : '·'))
                        : DAY_LABELS;
                    return (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-medium text-sm">{schedule.name}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {daysArr.map((d, i) => (
                              <span
                                key={i}
                                className={cn(
                                  'text-xs px-1.5 py-0.5 rounded font-mono',
                                  d !== '·' ? 'bg-muted text-foreground' : 'text-muted-foreground/40'
                                )}
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{schedule.startTime || '—'}</TableCell>
                        <TableCell className="font-mono text-sm">{schedule.endTime || '—'}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              activeNow
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700'
                                : schedule.enabled
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                            )}
                          >
                            {activeNow ? 'Active' : schedule.enabled ? 'Scheduled' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {schedule.linkedRules ?? 0} rules
                        </TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(schedule)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'Add Schedule'}</DialogTitle>
            <DialogDescription>
              Define a time window for rule activation. Days are Mon through Sun.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Schedule Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Business Hours"
              />
            </div>
            <div className="space-y-2">
              <Label>Active Days</Label>
              <div className="flex gap-2">
                {DAY_LABELS.map((day, idx) => (
                  <Button
                    key={day}
                    variant={form.days[idx] ? 'default' : 'outline'}
                    size="sm"
                    className="w-12"
                    onClick={() => toggleDay(idx)}
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={form.enabled} onCheckedChange={(c) => setForm((p) => ({ ...p, enabled: c }))} />
            </div>
            <p className="text-xs text-muted-foreground">
              Schedule-to-rule attachment will be available in a future update.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveSchedule} disabled={!form.name.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSchedule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 6: Presets ─────────────────────────────────────────────────

function PresetsTab() {
  const { toast } = useToast();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyId, setApplyId] = useState<string | null>(null);
  const [sourceIp, setSourceIp] = useState('');
  const [applying, setApplying] = useState(false);

  const fetchPresets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<Preset[]>(`${API_BASE}/presets`);
      if (res.success && res.data) setPresets(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load presets', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const applyPreset = async () => {
    if (!applyId) return;
    try {
      setApplying(true);
      const res = await apiFetch<{ message: string }>(`${API_BASE}/presets/${applyId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ sourceIp: sourceIp.trim() || undefined }),
      });
      toast({ title: 'Preset Applied', description: res.data?.message || 'Preset has been applied successfully.' });
      setApplyId(null);
      setSourceIp('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to apply preset';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const selectedPreset = presets.find((p) => p.id === applyId);

  const categoryIcons: Record<string, React.ElementType> = {
    networking: Network,
    'remote-access': Globe,
    security: Lock,
    'content-filter': ShieldAlert,
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LayoutGrid className="h-4 w-4" />
          {presets.length} preset templates available
        </div>
        <Button variant="outline" size="sm" onClick={fetchPresets}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Preset Cards Grid */}
      {presets.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No presets available"
          description="Preset templates will appear here when the nftables-service is running."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {presets.map((preset) => {
            const Icon = categoryIcons[preset.category] || Shield;
            return (
              <Card
                key={preset.id}
                className="transition-all hover:shadow-md hover:border-teal-300 dark:hover:border-teal-700"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <CardTitle className="text-base">{preset.name}</CardTitle>
                    </div>
                    <CategoryBadge category={preset.category} />
                  </div>
                  <CardDescription className="mt-2">{preset.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {preset.rules.length} rule{preset.rules.length !== 1 ? 's' : ''}
                    </div>
                    <Button size="sm" onClick={() => setApplyId(preset.id)}>
                      <Zap className="h-3.5 w-3.5 mr-1" />
                      Apply
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Apply Preset Dialog */}
      <Dialog open={!!applyId} onOpenChange={() => { setApplyId(null); setSourceIp(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Preset</DialogTitle>
            <DialogDescription>
              Review and apply the selected preset template.
            </DialogDescription>
          </DialogHeader>
          {selectedPreset && (
            <div className="space-y-4 py-4">
              <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{selectedPreset.name}</span>
                  <CategoryBadge category={selectedPreset.category} />
                </div>
                <p className="text-sm text-muted-foreground">{selectedPreset.description}</p>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Rules to be created:</p>
                  {selectedPreset.rules.map((rule, i) => (
                    <div key={i} className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{rule.protocol.toUpperCase()}</Badge>
                      <span>port {rule.destPort}</span>
                      <ActionBadge action={rule.action} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Source IP (optional)</Label>
                <Input
                  value={sourceIp}
                  onChange={(e) => setSourceIp(e.target.value)}
                  placeholder="e.g. 10.0.0.50"
                />
                <p className="text-xs text-muted-foreground">
                  Restrict these rules to a specific source IP or CIDR. Leave empty for any source.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setApplyId(null); setSourceIp(''); }}>
              Cancel
            </Button>
            <Button onClick={applyPreset} disabled={applying}>
              {applying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Zap className="h-4 w-4 mr-2" />
              Confirm Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Chain Architecture ─────────────────────────────────────────

// Static chain architecture data from production nftables service
interface ChainInfo {
  name: string;
  table: string;
  type: 'Base Hook' | 'Regular' | 'GUI Custom';
  direction: 'Ingress' | 'Egress' | 'Both' | 'N/A';
  status: 'System' | 'GUI';
  description: string;
  priority?: number;
}

const CHAIN_DATA: ChainInfo[] = [
  // ── inet mangle ──
  { name: 'prerouting', table: 'mangle', type: 'Base Hook', direction: 'Ingress', status: 'System', description: 'Packet mangling before routing decision' },
  { name: 'postrouting', table: 'mangle', type: 'Base Hook', direction: 'Egress', status: 'System', description: 'Packet mangling after routing decision' },
  { name: 'open', table: 'mangle', type: 'Regular', direction: 'Both', status: 'System', description: 'Mark packets for authenticated/open access' },
  { name: 'accountingup', table: 'mangle', type: 'Regular', direction: 'Egress', status: 'System', description: 'Per-IP upload traffic accounting counter' },
  { name: 'accountingdn', table: 'mangle', type: 'Regular', direction: 'Ingress', status: 'System', description: 'Per-IP download traffic accounting counter' },
  { name: 'acctup', table: 'mangle', type: 'Regular', direction: 'Egress', status: 'System', description: 'Aggregated upload accounting' },
  { name: 'acctdn', table: 'mangle', type: 'Regular', direction: 'Ingress', status: 'System', description: 'Aggregated download accounting' },
  { name: 'gwacctup', table: 'mangle', type: 'Regular', direction: 'Egress', status: 'System', description: 'Gateway upload accounting' },
  { name: 'gwacctdn', table: 'mangle', type: 'Regular', direction: 'Ingress', status: 'System', description: 'Gateway download accounting' },
  { name: 'poolacctup', table: 'mangle', type: 'Regular', direction: 'Egress', status: 'System', description: 'Pool-based upload accounting' },
  { name: 'poolacctdn', table: 'mangle', type: 'Regular', direction: 'Ingress', status: 'System', description: 'Pool-based download accounting' },
  { name: 'firewallchains', table: 'mangle', type: 'GUI Custom', direction: 'Egress', status: 'GUI', description: 'GUI uplink filter rules (ingress mangle)' },
  { name: 'firewallchainsdn', table: 'mangle', type: 'GUI Custom', direction: 'Ingress', status: 'GUI', description: 'GUI downlink filter rules (egress mangle)' },
  { name: 'firewallchains_conn', table: 'mangle', type: 'GUI Custom', direction: 'Egress', status: 'GUI', description: 'GUI conntrack uplink (stateful filtering)' },
  { name: 'firewallchainsdn_conn', table: 'mangle', type: 'GUI Custom', direction: 'Ingress', status: 'GUI', description: 'GUI conntrack downlink (stateful filtering)' },

  // ── inet nat ──
  { name: 'prerouting', table: 'nat', type: 'Base Hook', direction: 'Ingress', status: 'System', description: 'NAT prerouting — DNAT before routing' },
  { name: 'postrouting', table: 'nat', type: 'Base Hook', direction: 'Egress', status: 'System', description: 'NAT postrouting — SNAT/Masquerade after routing' },
  { name: 'open', table: 'nat', type: 'Regular', direction: 'Both', status: 'System', description: 'NAT bypass for authenticated traffic' },
  { name: 'proxy', table: 'nat', type: 'Regular', direction: 'Both', status: 'System', description: 'Transparent proxy redirect rules' },
  { name: 'frchainspre', table: 'nat', type: 'GUI Custom', direction: 'Ingress', status: 'GUI', description: 'GUI NAT prerouting rules (port forwarding, DNAT)' },
  { name: 'frchainspost', table: 'nat', type: 'GUI Custom', direction: 'Egress', status: 'GUI', description: 'GUI NAT postrouting rules (SNAT, masquerade)' },

  // ── inet filter ──
  { name: 'input', table: 'filter', type: 'Base Hook', direction: 'Ingress', status: 'System', description: 'Filter packets destined for the local system' },
  { name: 'drop_log', table: 'filter', type: 'Regular', direction: 'Ingress', status: 'System', description: 'Log and drop rejected packets' },
  { name: 'intranetuploadaccounting', table: 'filter', type: 'Regular', direction: 'Egress', status: 'System', description: 'Intranet upload traffic filter/accounting' },

  // ── inet security ──
  { name: 'syn_flood', table: 'security', type: 'Regular', direction: 'Ingress', status: 'System', description: 'SYN flood protection (priority -300)', priority: -300 },
  { name: 'invalid_packets', table: 'security', type: 'Regular', direction: 'Both', status: 'System', description: 'Drop invalid/malformed packets (priority -299)', priority: -299 },
  { name: 'port_scan', table: 'security', type: 'Regular', direction: 'Ingress', status: 'System', description: 'Port scan detection & blocking (priority -160)', priority: -160 },
  { name: 'ssh_protection', table: 'security', type: 'Regular', direction: 'Ingress', status: 'System', description: 'SSH brute-force protection (priority -155)', priority: -155 },
  { name: 'dns_protection', table: 'security', type: 'Regular', direction: 'Ingress', status: 'System', description: 'DNS amplification protection (priority -150)', priority: -150 },
  { name: 'icmp_limit', table: 'security', type: 'Regular', direction: 'Ingress', status: 'System', description: 'ICMP rate limiting (priority -140)', priority: -140 },
];

const SYSTEM_CHAIN_COUNT = CHAIN_DATA.filter((c) => c.status === 'System').length;
const GUI_CHAIN_COUNT = CHAIN_DATA.filter((c) => c.status === 'GUI').length;

// ─── Chain Architecture Tab Types ────────────────────────────────────

interface ChainArchFlowItem {
  type: 'set_jump' | 'gui_chain' | 'system_chain';
  set?: string;
  chain?: string;
  description: string;
  managed?: boolean;
}

interface ChainArchHook {
  priority: string;
  flow: ChainArchFlowItem[];
}

interface ChainArchTable {
  hooks: Record<string, ChainArchHook>;
  guiChains: string[];
}

interface ChainArchData {
  tables: Record<string, ChainArchTable>;
  securityHooks: { chain: string; table: string; priority: number; description: string }[];
  sets: { name: string; type: string; flags?: string; description: string }[];
  systemChains: Record<string, string[]>;
}

interface ChainStatusData {
  guiChains: Record<string, { exists: boolean; table: string; ruleCount: number }>;
  ruleCounts: { guiRules: number; enabledGuiRules: number; portForwards: number; rateLimits: number };
  appliedConfig: boolean;
  mode: string;
}

// ─── Chain Architecture Tab ──────────────────────────────────────────

function ChainArchitectureTab() {
  const { toast } = useToast();
  const [archData, setArchData] = useState<ChainArchData | null>(null);
  const [statusData, setStatusData] = useState<ChainStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [configPreview, setConfigPreview] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    mangle: true,
    nat: true,
    security: true,
    sets: true,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [archRes, statusRes] = await Promise.all([
        apiFetch<ChainArchData>(`${API_BASE}/chain-architecture`),
        apiFetch<ChainStatusData>(`${API_BASE}/status`),
      ]);
      if (archRes.success && archRes.data) setArchData(archRes.data);
      if (statusRes.success && statusRes.data) setStatusData(statusRes.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load chain architecture', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchConfigPreview = async () => {
    try {
      setConfigLoading(true);
      const res = await apiFetch<{ config: string }>(`${API_BASE}/config/preview`);
      if (res.success && res.data) {
        setConfigPreview(res.data.config);
        setShowConfig(true);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch config preview', variant: 'destructive' });
    } finally {
      setConfigLoading(false);
    }
  };

  const copyConfig = async () => {
    if (!configPreview) return;
    try {
      await navigator.clipboard.writeText(configPreview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied', description: 'Config copied to clipboard' });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
    }
  };

  const applyConfig = async () => {
    try {
      setApplying(true);
      await apiFetch(`${API_BASE}/apply`, { method: 'POST' });
      toast({ title: 'Configuration Applied', description: 'nftables rules have been reloaded.' });
      await fetchData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to apply configuration';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const flushGuiChains = async () => {
    try {
      setFlushing(true);
      await apiFetch(`${API_BASE}/flush-gui`, { method: 'POST' });
      toast({ title: 'GUI Chains Flushed', description: 'All GUI-managed chains have been flushed.' });
      await fetchData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to flush GUI chains';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setFlushing(false);
    }
  };

  const getRuleCount = (chainName: string): number => {
    if (!statusData?.guiChains) return 0;
    return statusData.guiChains[chainName]?.ruleCount ?? 0;
  };

  // ── Loading Skeleton ──
  if (loading || !archData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3.5 w-80" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  const totalGuiRules = statusData?.ruleCounts?.guiRules ?? 0;
  const totalGuiChains = Object.keys(archData.tables).reduce(
    (sum, t) => sum + archData.tables[t].guiChains.length, 0
  ) + archData.securityHooks.length;
  const totalSets = archData.sets.length;

  return (
    <div className="space-y-6">
      {/* ── Section Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/20">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">nftables Chain Architecture</h3>
            <p className="text-sm text-muted-foreground">
              Production chain flow &middot; <span className="font-mono text-xs">{statusData?.mode ?? 'simulation'} mode</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={flushGuiChains} disabled={flushing} className="text-xs text-destructive hover:text-destructive">
            {flushing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Trash className="h-3.5 w-3.5 mr-1.5" />}
            Flush GUI
          </Button>
          <Button size="sm" onClick={applyConfig} disabled={applying} className="text-xs bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-sm">
            {applying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            Apply Config
          </Button>
        </div>
      </motion.div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'GUI Chains', value: Object.values(archData.tables).reduce((s, t) => s + t.guiChains.length, 0), icon: Unlock, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/40' },
          { label: 'GUI Rules', value: totalGuiRules, icon: ShieldCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
          { label: 'Security Hooks', value: archData.securityHooks.length, icon: ShieldAlert, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40' },
          { label: 'nftables Sets', value: totalSets, icon: Server, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/40' },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className="bg-card/80 backdrop-blur-sm border-border/60 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn('flex items-center justify-center w-10 h-10 rounded-lg', card.bg)}>
                    <card.icon className={cn('h-5 w-5', card.color)} />
                  </div>
                  <div>
                    <p className={cn('text-2xl font-bold', card.color)}>{card.value}</p>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── inet mangle Table ── */}
      {/* ════════════════════════════════════════════════════════════ */}
      {archData.tables['inet mangle'] && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="bg-card/80 backdrop-blur-sm border-border/60 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-teal-500 to-emerald-400" />
            <CardHeader className="pb-2">
              <button
                onClick={() => toggleSection('mangle')}
                className="flex items-center justify-between w-full text-left"
              >
                <CardTitle className="text-sm tracking-tight flex items-center gap-2">
                  <span className="font-mono px-2 py-0.5 rounded text-xs font-bold bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-200 dark:border-teal-700">
                    inet mangle
                  </span>
                  <Badge variant="outline" className="text-[10px] font-medium">
                    {archData.tables['inet mangle'].guiChains.length} GUI chains
                  </Badge>
                </CardTitle>
                {expandedSections.mangle ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CardHeader>
            <AnimatePresence>
              {expandedSections.mangle && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <CardContent className="pt-0 pb-4 space-y-5">
                    {/* prerouting hook */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">prerouting hook</span>
                        <Badge variant="outline" className="text-[10px] font-mono">priority: mangle</Badge>
                      </div>
                      <div className="space-y-1.5 ml-3">
                        {archData.tables['inet mangle'].hooks.prerouting?.flow.map((item, idx) => (
                          <ChainFlowItem key={idx} item={item} ruleCount={item.type === 'gui_chain' ? getRuleCount(item.chain ?? '') : undefined} />
                        ))}
                      </div>
                    </div>

                    {/* postrouting hook */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">postrouting hook</span>
                        <Badge variant="outline" className="text-[10px] font-mono">priority: mangle</Badge>
                      </div>
                      <div className="space-y-1.5 ml-3">
                        {archData.tables['inet mangle'].hooks.postrouting?.flow.map((item, idx) => (
                          <ChainFlowItem key={idx} item={item} ruleCount={item.type === 'gui_chain' ? getRuleCount(item.chain ?? '') : undefined} />
                        ))}
                      </div>
                    </div>

                    {/* Regular GUI chains (conn chains) */}
                    {archData.tables['inet mangle'].guiChains.filter((c) => c.includes('_conn')).length > 0 && (
                      <div className="mt-2 rounded-lg border border-dashed border-teal-300 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-950/20 p-3">
                        <p className="text-xs font-semibold text-teal-700 dark:text-teal-300 mb-2 flex items-center gap-1.5">
                          <GitBranch className="h-3 w-3" />
                          Regular Chains (GUI conntrack)
                        </p>
                        <div className="space-y-1.5">
                          {archData.tables['inet mangle'].guiChains.filter((c) => c.includes('_conn')).map((chainName) => (
                            <div key={chainName} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-teal-100/50 dark:bg-teal-900/20">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-cyan-500" />
                                <span className="font-mono text-xs font-semibold text-teal-700 dark:text-teal-300">{chainName}</span>
                                <Badge variant="outline" className="text-[10px] bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700">
                                  GUI
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">{getRuleCount(chainName)} rules</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── inet nat Table ── */}
      {/* ════════════════════════════════════════════════════════════ */}
      {archData.tables['inet nat'] && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <Card className="bg-card/80 backdrop-blur-sm border-border/60 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-400" />
            <CardHeader className="pb-2">
              <button
                onClick={() => toggleSection('nat')}
                className="flex items-center justify-between w-full text-left"
              >
                <CardTitle className="text-sm tracking-tight flex items-center gap-2">
                  <span className="font-mono px-2 py-0.5 rounded text-xs font-bold bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-700">
                    inet nat
                  </span>
                  <Badge variant="outline" className="text-[10px] font-medium">
                    {archData.tables['inet nat'].guiChains.length} GUI chains
                  </Badge>
                </CardTitle>
                {expandedSections.nat ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CardHeader>
            <AnimatePresence>
              {expandedSections.nat && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <CardContent className="pt-0 pb-4 space-y-5">
                    {/* prerouting */}
                    {archData.tables['inet nat'].hooks.prerouting && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">prerouting</span>
                          <Badge variant="outline" className="text-[10px] font-mono">priority: dstnat</Badge>
                        </div>
                        <div className="space-y-1.5 ml-3">
                          {archData.tables['inet nat'].hooks.prerouting.flow.map((item, idx) => (
                            <ChainFlowItem key={idx} item={item} ruleCount={item.type === 'gui_chain' ? getRuleCount(item.chain ?? '') : undefined} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* postrouting */}
                    {archData.tables['inet nat'].hooks.postrouting && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">postrouting</span>
                          <Badge variant="outline" className="text-[10px] font-mono">priority: srcnat</Badge>
                        </div>
                        <div className="space-y-1.5 ml-3">
                          {archData.tables['inet nat'].hooks.postrouting.flow.map((item, idx) => (
                            <ChainFlowItem key={idx} item={item} ruleCount={item.type === 'gui_chain' ? getRuleCount(item.chain ?? '') : undefined} />
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── inet security ── */}
      {/* ════════════════════════════════════════════════════════════ */}
      {archData.securityHooks.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <Card className="bg-card/80 backdrop-blur-sm border-border/60 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-amber-500 to-rose-500" />
            <CardHeader className="pb-2">
              <button
                onClick={() => toggleSection('security')}
                className="flex items-center justify-between w-full text-left"
              >
                <CardTitle className="text-sm tracking-tight flex items-center gap-2">
                  <span className="font-mono px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-700">
                    inet security
                  </span>
                  <Badge variant="outline" className="text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700">
                    Not GUI-managed
                  </Badge>
                </CardTitle>
                {expandedSections.security ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CardHeader>
            <AnimatePresence>
              {expandedSections.security && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <CardContent className="pt-0 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {archData.securityHooks.map((hook) => (
                        <div
                          key={hook.chain}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/60 hover:bg-muted/50 transition-colors"
                        >
                          <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold truncate">{hook.chain}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-700">
                                {hook.priority}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">{hook.description}</p>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-muted-foreground/50 shrink-0 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="text-xs max-w-xs">
                              <p className="font-mono">{hook.chain} ({hook.priority})</p>
                              <p className="text-muted-foreground">{hook.description}</p>
                              <p className="text-muted-foreground mt-1">Security chains are system-managed and cannot be edited from the GUI.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── nftables Sets ── */}
      {/* ════════════════════════════════════════════════════════════ */}
      {archData.sets.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.33 }}>
          <Card className="bg-card/80 backdrop-blur-sm border-border/60 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-400" />
            <CardHeader className="pb-2">
              <button
                onClick={() => toggleSection('sets')}
                className="flex items-center justify-between w-full text-left"
              >
                <CardTitle className="text-sm tracking-tight flex items-center gap-2">
                  <Server className="h-4 w-4 text-violet-500" />
                  nftables Sets
                  <Badge variant="outline" className="text-[10px] font-medium">
                    {archData.sets.length} sets
                  </Badge>
                </CardTitle>
                {expandedSections.sets ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CardHeader>
            <AnimatePresence>
              {expandedSections.sets && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <CardContent className="pt-0 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {archData.sets.map((set) => (
                        <div
                          key={set.name}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/20 border border-border/60 hover:bg-muted/40 transition-colors"
                        >
                          <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-xs font-semibold">{set.name}</span>
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {set.type}
                              </Badge>
                              {set.flags && (
                                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-700">
                                  {set.flags}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">{set.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── Config Preview ── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
        <Card className="bg-card/80 backdrop-blur-sm border-border/60 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm tracking-tight flex items-center gap-2">
                <Eye className="h-4 w-4 text-teal-500" />
                Generated nftables Configuration
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={fetchConfigPreview} disabled={configLoading} className="text-xs">
                  {configLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
                  {showConfig ? 'Refresh Preview' : 'View Config Preview'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <AnimatePresence>
            {showConfig && configPreview && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <CardContent className="pt-0 pb-4">
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-muted-foreground">
                        Generated at: {new Date().toLocaleTimeString()} &middot; {statusData?.mode ?? 'simulation'} mode
                      </span>
                      <Button variant="ghost" size="sm" onClick={copyConfig} className="h-7 text-xs">
                        {copied ? <Check className="h-3 w-3 mr-1 text-emerald-500" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                    <pre className="bg-zinc-950 dark:bg-zinc-900 text-zinc-200 rounded-lg p-4 overflow-x-auto text-[11px] font-mono leading-relaxed border border-zinc-800 max-h-96 scrollbar-thin">
                      <code>{configPreview}</code>
                    </pre>
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* ── Legend ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1"
      >
        <span className="font-medium text-foreground/70">Legend:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-teal-500" /> GUI Chain
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/40" /> System Chain
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-500" /> nftables Set
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500" /> Security Hook
        </span>
      </motion.div>
    </div>
  );
}

// ── Chain Architecture Sub-components ───────────────────────────────

function ChainFlowItem({ item, ruleCount }: { item: ChainArchFlowItem; ruleCount?: number }) {
  const isGui = item.type === 'gui_chain';
  const isSet = item.type === 'set_jump';

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 px-3 py-1.5 rounded-md border transition-colors',
        isGui
          ? 'border-l-4 border-l-teal-500 bg-teal-50/80 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 hover:bg-teal-100/80 dark:hover:bg-teal-950/50'
          : isSet
            ? 'border-l-4 border-l-violet-400 bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800'
            : 'bg-muted/30 border border-border/60 hover:bg-muted/50'
      )}
    >
      <ArrowRight className={cn('h-3 w-3 shrink-0', isGui ? 'text-teal-500' : isSet ? 'text-violet-400' : 'text-muted-foreground/40')} />

      {isSet && (
        <Badge variant="outline" className="text-[10px] font-mono bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-700 shrink-0">
          set
        </Badge>
      )}

      <span className={cn(
        'font-mono text-xs font-medium truncate',
        isGui ? 'text-teal-700 dark:text-teal-300' : isSet ? 'text-violet-700 dark:text-violet-300' : 'text-muted-foreground'
      )}>
        {isSet ? item.set : item.chain}
      </span>

      {isGui && (
        <Badge className="text-[10px] bg-teal-600 text-white border-0 hover:bg-teal-600 shrink-0">
          GUI
        </Badge>
      )}

      <span className="text-[11px] text-muted-foreground truncate ml-auto">{item.description}</span>

      {isGui && ruleCount !== undefined && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 shrink-0">
              <div className={cn('w-1.5 h-1.5 rounded-full', ruleCount > 0 ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
              <span className={cn('text-[11px] font-mono font-semibold', ruleCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                {ruleCount}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            {ruleCount} rule{ruleCount !== 1 ? 's' : ''} in this chain
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
