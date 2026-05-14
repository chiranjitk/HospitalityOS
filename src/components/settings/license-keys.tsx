'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  Key,
  Plus,
  Copy,
  Check,
  X,
  Search,
  RefreshCw,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────
interface Plan {
  id: string;
  name: string;
  description?: string;
  price?: number;
  interval?: string;
}

interface LicenseKey {
  id: string;
  key: string;
  planId: string;
  planName?: string;
  status: 'active' | 'activated' | 'expired' | 'revoked';
  generatedFor?: string;
  note?: string;
  activatedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

interface KeysResponse {
  success: boolean;
  keys?: LicenseKey[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  stats?: {
    total: number;
    active: number;
    activated: number;
    expired: number;
    revoked: number;
  };
}

// ─── Constants ───────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof Shield }
> = {
  active: { label: 'Active', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20', icon: ShieldCheck },
  activated: { label: 'Activated', color: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/20', icon: Shield },
  expired: { label: 'Expired', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20', icon: ShieldAlert },
  revoked: { label: 'Revoked', color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20', icon: ShieldX },
};

const STATUS_TABS = ['all', 'active', 'activated', 'expired', 'revoked'] as const;

type StatusTab = (typeof STATUS_TABS)[number];

// ─── Component ───────────────────────────────────────────────────────
export default function LicenseKeysManagement() {
  // ── State ──────────────────────────────────────────────────────────
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, activated: 0, expired: 0, revoked: 0 });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 15;

  // Filtering
  const [statusFilter, setStatusFilter] = useState<StatusTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Generate form
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [keyCount, setKeyCount] = useState(1);
  const [genNote, setGenNote] = useState('');
  const [genRecipient, setGenRecipient] = useState('');
  const [genExpiryDays, setGenExpiryDays] = useState('');
  const [generating, setGenerating] = useState(false);

  // Recently generated keys
  const [recentlyGenerated, setRecentlyGenerated] = useState<LicenseKey[]>([]);
  const [showGeneratedKeys, setShowGeneratedKeys] = useState(false);

  // Revoke dialog
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokingKey, setRevokingKey] = useState<LicenseKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Copy state
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────
  const truncateKey = (key: string) => {
    if (key.length <= 20) return key;
    return `${key.slice(0, 8)}...${key.slice(-8)}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeyId(keyId);
      toast({ title: 'Copied!', description: 'License key copied to clipboard.' });
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard.', variant: 'destructive' });
    }
  };

  // ── Data Fetching ──────────────────────────────────────────────────
  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/registration/plans');
      const data = await res.json();
      if (data.success && data.plans) {
        setPlans(data.plans);
      }
    } catch {
      // Plans not available — generate will show empty select
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const fetchKeys = useCallback(async () => {
    setKeysLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/admin/license-keys?${params}`);
      const data: KeysResponse = await res.json();

      if (data.success) {
        setKeys(data.keys || []);
        setTotalPages(data.totalPages || 1);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch license keys.',
        variant: 'destructive',
      });
    } finally {
      setKeysLoading(false);
    }
  }, [currentPage, statusFilter, searchQuery]);

  useEffect(() => {
    const id = setTimeout(() => { fetchPlans(); }, 0);
    return () => clearTimeout(id);
  }, [fetchPlans]);

  useEffect(() => {
    const id = setTimeout(() => { fetchKeys(); }, 0);
    return () => clearTimeout(id);
  }, [fetchKeys]);

  // Reset page on filter/search change
  useEffect(() => {
    const id = setTimeout(() => { setCurrentPage(1); }, 0);
    return () => clearTimeout(id);
  }, [statusFilter, searchQuery]);

  // ── Generate Keys ──────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedPlanId) {
      toast({ title: 'Plan required', description: 'Please select a plan.', variant: 'destructive' });
      return;
    }
    if (keyCount < 1 || keyCount > 100) {
      toast({ title: 'Invalid count', description: 'Enter a number between 1 and 100.', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      const body: Record<string, unknown> = {
        planId: selectedPlanId,
        count: keyCount,
      };
      if (genNote.trim()) body.note = genNote.trim();
      if (genRecipient.trim()) body.generatedFor = genRecipient.trim();
      if (genExpiryDays && parseInt(genExpiryDays, 10) > 0) body.expiresInDays = parseInt(genExpiryDays, 10);

      const res = await fetch('/api/admin/license-keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success && data.keys) {
        setRecentlyGenerated(data.keys);
        setShowGeneratedKeys(true);
        toast({
          title: 'Keys Generated',
          description: `Successfully generated ${data.keys.length} license key${data.keys.length > 1 ? 's' : ''}.`,
        });
        // Reset form
        setGenNote('');
        setGenRecipient('');
        setGenExpiryDays('');
        setKeyCount(1);
        // Refresh table
        fetchKeys();
      } else {
        toast({
          title: 'Generation Failed',
          description: data.error || 'Failed to generate license keys.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to generate license keys.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  // ── Revoke Key ─────────────────────────────────────────────────────
  const handleRevoke = async () => {
    if (!revokingKey) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/admin/license-keys/${revokingKey.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'revoked' }),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Key Revoked', description: `License key ${truncateKey(revokingKey.key)} has been revoked.` });
        fetchKeys();
      } else {
        toast({
          title: 'Revoke Failed',
          description: data.error || 'Failed to revoke license key.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to revoke license key.',
        variant: 'destructive',
      });
    } finally {
      setRevoking(false);
      setRevokeDialogOpen(false);
      setRevokingKey(null);
    }
  };

  // ── Download keys as text ──────────────────────────────────────────
  const handleDownloadKeys = () => {
    if (recentlyGenerated.length === 0) return;
    const content = recentlyGenerated.map((k) => k.key).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `license-keys-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded', description: `${recentlyGenerated.length} keys saved to file.` });
  };

  // ── Render helpers ─────────────────────────────────────────────────
  const renderStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;
    const Icon = config.icon;
    return (
      <Badge
        variant="outline"
        className={`gap-1 text-xs font-medium ${config.color}`}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const renderStatsBadges = () => (
    <div className="flex flex-wrap gap-2 mt-3">
      <Badge variant="secondary" className="gap-1.5 px-3 py-1">
        <Key className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Total:</span>
        <span className="font-semibold text-foreground">{stats.total}</span>
      </Badge>
      <Badge variant="outline" className="gap-1.5 px-3 py-1 border-emerald-500/20 bg-emerald-500/5">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        <span className="text-emerald-700 dark:text-emerald-400">Active:</span>
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{stats.active}</span>
      </Badge>
      <Badge variant="outline" className="gap-1.5 px-3 py-1 border-teal-500/20 bg-teal-500/5">
        <Shield className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
        <span className="text-teal-700 dark:text-teal-400">Activated:</span>
        <span className="font-semibold text-teal-700 dark:text-teal-400">{stats.activated}</span>
      </Badge>
      <Badge variant="outline" className="gap-1.5 px-3 py-1 border-amber-500/20 bg-amber-500/5">
        <ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <span className="text-amber-700 dark:text-amber-400">Expired:</span>
        <span className="font-semibold text-amber-700 dark:text-amber-400">{stats.expired}</span>
      </Badge>
    </div>
  );

  const renderTableSkeleton = () => (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
          <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );

  // ── JSX ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-2">
              <Key className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
              License Key Management
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 ml-[2.875rem]">
            Generate, manage, and monitor license keys for your organization&apos;s subscription plans.
          </p>
          {renderStatsBadges()}
        </div>
        <Button
          onClick={() => setShowGeneratedKeys(false)}
          className="shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 shrink-0"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Gradient section divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ── Recently Generated Keys ───────────────────────────────── */}
      {showGeneratedKeys && recentlyGenerated.length > 0 && (
        <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 p-2">
                  <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Recently Generated</CardTitle>
                  <CardDescription>
                    {recentlyGenerated.length} key{recentlyGenerated.length > 1 ? 's' : ''} just created
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadKeys} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowGeneratedKeys(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto custom-scrollbar rounded-lg border bg-background/50 p-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Key</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentlyGenerated.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-mono text-xs">{key.key}</TableCell>
                      <TableCell>{renderStatusBadge(key.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(key.key, `recent-${key.id}`)}
                          className="h-7 w-7 p-0"
                        >
                          {copiedKeyId === `recent-${key.id}` ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Generate Keys Section ─────────────────────────────────── */}
      <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-2">
              <Plus className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle>Generate New Keys</CardTitle>
              <CardDescription>Create license keys for distribution to clients or team members</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Plan Select */}
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Plan <span className="text-red-500">*</span>
              </Label>
              {plansLoading ? (
                <Skeleton className="h-9 w-full rounded-xl" />
              ) : (
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger className="w-full rounded-xl transition-all duration-300 hover:border-primary/30 focus:ring-2 focus:ring-primary/10 hover:shadow-sm focus:shadow-md focus:shadow-primary/5">
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        <div className="flex items-center gap-2">
                          <span>{plan.name}</span>
                          {plan.price && (
                            <span className="text-xs text-muted-foreground">
                              ({plan.interval ? `$${plan.price}/${plan.interval}` : `$${plan.price}`})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Key Count */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Number of Keys <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={keyCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setKeyCount(Math.min(100, Math.max(1, val)));
                }}
                className="rounded-xl transition-all duration-300 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 hover:shadow-sm focus:shadow-md focus:shadow-primary/5"
                placeholder="1–100"
              />
            </div>

            {/* Recipient Name */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Recipient Name
              </Label>
              <Input
                value={genRecipient}
                onChange={(e) => setGenRecipient(e.target.value)}
                className="rounded-xl transition-all duration-300 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 hover:shadow-sm focus:shadow-md focus:shadow-primary/5"
                placeholder="Optional: who these keys are for"
              />
            </div>

            {/* Expiration Days */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Expiration Days
              </Label>
              <Input
                type="number"
                min={1}
                value={genExpiryDays}
                onChange={(e) => setGenExpiryDays(e.target.value)}
                className="rounded-xl transition-all duration-300 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 hover:shadow-sm focus:shadow-md focus:shadow-primary/5"
                placeholder="Optional: e.g. 365"
              />
            </div>

            {/* Note */}
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Note
              </Label>
              <Textarea
                value={genNote}
                onChange={(e) => setGenNote(e.target.value)}
                className="rounded-xl transition-all duration-300 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 hover:shadow-sm focus:shadow-md focus:shadow-primary/5 min-h-[2.5rem]"
                placeholder="Optional: internal note about this batch"
                rows={1}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button
              onClick={handleGenerate}
              disabled={generating || !selectedPlanId}
              className="shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              {generating ? 'Generating...' : 'Generate Keys'}
            </Button>
            {selectedPlanId && keyCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Will generate <span className="font-semibold text-foreground">{keyCount}</span> key{keyCount > 1 ? 's' : ''} for{' '}
                <span className="font-semibold text-foreground">{plans.find((p) => p.id === selectedPlanId)?.name || 'selected plan'}</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gradient section divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ── Keys Table ────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm rounded-2xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-slate-500/10 to-slate-500/5 p-2">
                <Key className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <CardTitle>All License Keys</CardTitle>
                <CardDescription>
                  {keysLoading ? 'Loading...' : `${stats.total} total keys`}
                </CardDescription>
              </div>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by key or recipient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl transition-all duration-300 hover:border-primary/30 focus:ring-2 focus:ring-primary/10 hover:shadow-sm focus:shadow-md focus:shadow-primary/5"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Tabs */}
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusTab)}>
            <TabsList className="bg-muted/60 p-1 rounded-lg">
              {STATUS_TABS.map((tab) => {
                const count =
                  tab === 'all'
                    ? stats.total
                    : stats[tab as keyof typeof stats];
                return (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="rounded-md text-xs font-medium capitalize px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    {tab}
                    {typeof count === 'number' && count > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] font-bold rounded-full bg-muted-foreground/10 text-muted-foreground">
                        {count}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          {/* Table */}
          <div className="rounded-lg border bg-background/50 overflow-hidden">
            <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Key</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Plan</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Generated For</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Activated At</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Expires At</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keysLoading ? (
                    renderTableSkeleton()
                  ) : keys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Key className="h-10 w-10 opacity-30" />
                          <p className="font-medium">No license keys found</p>
                          <p className="text-xs">
                            {searchQuery || statusFilter !== 'all'
                              ? 'Try adjusting your filters or search query'
                              : 'Generate your first batch of license keys above'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    keys.map((key) => (
                      <TableRow key={key.id} className="group">
                        <TableCell className="font-mono text-xs max-w-[200px]">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{truncateKey(key.key)}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(key.key, key.id)}
                              className="h-6 w-6 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              {copiedKeyId === key.id ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{key.planName || key.planId}</span>
                        </TableCell>
                        <TableCell>{renderStatusBadge(key.status)}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[150px] truncate">
                          {key.generatedFor || '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(key.activatedAt)}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(key.expiresAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(key.key, key.id)}
                              className="h-7 w-7 p-0 md:hidden"
                              title="Copy key"
                            >
                              {copiedKeyId === key.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            {(key.status === 'active' || key.status === 'activated') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setRevokingKey(key);
                                  setRevokeDialogOpen(true);
                                }}
                                className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-500/10 dark:text-red-400 dark:hover:text-red-300"
                                title="Revoke key"
                              >
                                <ShieldX className="h-3.5 w-3.5 mr-1" />
                                Revoke
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination */}
          {!keysLoading && keys.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages} &middot; {limit} keys per page
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="h-8 w-8 p-0 text-xs"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <>
                    <span className="text-xs text-muted-foreground px-1">...</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      className="h-8 w-8 p-0 text-xs"
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Revoke Confirmation Dialog ────────────────────────────── */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-500/10 p-2">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <DialogTitle>Revoke License Key</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              This action cannot be undone. The license key will be immediately deactivated and the
              associated user will lose access.
            </DialogDescription>
          </DialogHeader>
          {revokingKey && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key</p>
              <p className="font-mono text-sm break-all">{revokingKey.key}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">Plan:</span>
                <span className="text-xs font-medium">{revokingKey.planName || revokingKey.planId}</span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">For:</span>
                <span className="text-xs font-medium">{revokingKey.generatedFor || 'Unassigned'}</span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setRevokeDialogOpen(false);
                setRevokingKey(null);
              }}
              disabled={revoking}
              className="transition-all duration-200"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={revoking}
              className="shadow-md hover:shadow-lg transition-all duration-200"
            >
              {revoking ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldX className="h-4 w-4 mr-2" />
              )}
              {revoking ? 'Revoking...' : 'Revoke Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
