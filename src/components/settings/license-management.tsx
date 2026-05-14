'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ADDON_SUBCATEGORIES, FEATURES } from '@/lib/feature-flags';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Users,
  Hotel,
  Wifi,
  AlertTriangle,
  RefreshCw,
  Edit2,
  BarChart3,
  Settings,
  Crown,
  Eye,
  TrendingUp,
  Loader2,
  X,
  Check,
  Lock,
  Info,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────
interface LicenseCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  percent: number;
  isUnlimited: boolean;
  isWarning: boolean;
  isExceeded: boolean;
  moduleKey: string;
  moduleName: string;
  hardLimit: boolean;
}

interface EntitlementRow {
  id: string;
  moduleKey: string;
  moduleName: string;
  limitType: string;
  limitValue: number;
  currentUsage: number;
  peakUsage: number;
  warningThreshold: number;
  hardLimit: boolean;
  isValid: boolean;
  billingDimension: string | null;
  pricePerUnit: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

interface LicenseOverview {
  baseLimits: {
    rooms: LicenseCheckResult;
    properties: LicenseCheckResult;
    users: LicenseCheckResult;
  };
  entitlements: LicenseCheckResult[];
  warnings: LicenseCheckResult[];
  exceeded: LicenseCheckResult[];
  plan: string;
  tenantId: string;
}

interface UsageHistoryEntry {
  sampledAt: string;
  usageValue: number;
  limitValue: number;
  usagePercent: number;
}

// ─── Module Icon Map ─────────────────────────────────────────────────
const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  wifi: Wifi,
  pos: Settings,
  crm: Users,
  channel_manager: Activity,
  guest_experience: Crown,
  reports: BarChart3,
  staff_management: Users,
  events: Activity,
  parking: Eye,
  surveillance: Eye,
  iot: Settings,
};

// ─── Subcategory Icons (for tenant view) ─────────────────────────────
const SUB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Guest Experience': Activity,
  'Facility Management': Settings,
  'Connectivity': Wifi,
  'Revenue & Channels': Activity,
  'Marketing & CRM': Users,
  'Analytics': Activity,
  'Events': Activity,
  'Resort & Leisure': Crown,
  'Staff Management': Users,
  'Security': Shield,
  'Integrations & Automation': Settings,
  'Enterprise': Crown,
  'System': Settings,
};

// ─── Color Helpers ───────────────────────────────────────────────────
function getProgressClass(percent: number, isExceeded: boolean) {
  if (isExceeded || percent >= 95)
    return '[&>[data-slot=progress-indicator]]:bg-red-500';
  if (percent >= 80)
    return '[&>[data-slot=progress-indicator]]:bg-amber-500';
  return '[&>[data-slot=progress-indicator]]:bg-emerald-500';
}

function getStatusBadge(
  percent: number,
  isExceeded: boolean,
  isUnlimited: boolean
) {
  if (isUnlimited)
    return (
      <Badge variant="outline" className="gap-1 text-xs border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="h-3 w-3" />
        Unlimited
      </Badge>
    );
  if (isExceeded)
    return (
      <Badge variant="destructive" className="gap-1 text-xs">
        <ShieldAlert className="h-3 w-3" />
        Exceeded
      </Badge>
    );
  if (percent >= 95)
    return (
      <Badge variant="destructive" className="gap-1 text-xs">
        <ShieldAlert className="h-3 w-3" />
        Critical
      </Badge>
    );
  if (percent >= 80)
    return (
      <Badge variant="warning" className="gap-1 text-xs">
        <AlertTriangle className="h-3 w-3" />
        Warning
      </Badge>
    );
  return (
    <Badge variant="success" className="gap-1 text-xs">
      <ShieldCheck className="h-3 w-3" />
      OK
    </Badge>
  );
}

function getPlanBadge(plan: string) {
  const p = plan.toLowerCase();
  if (p === 'enterprise' || p === 'premium')
    return (
      <Badge variant="outline" className="gap-1 border-violet-500/20 bg-violet-500/5 text-violet-700 dark:text-violet-400">
        <Crown className="h-3 w-3" />
        {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </Badge>
    );
  if (p === 'professional')
    return (
      <Badge variant="outline" className="gap-1 border-teal-500/20 bg-teal-500/5 text-teal-700 dark:text-teal-400">
        <ShieldCheck className="h-3 w-3" />
        {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </Badge>
    );
  if (p === 'trial')
    return (
      <Badge variant="outline" className="gap-1 border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400">
        <ShieldAlert className="h-3 w-3" />
        Trial
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1 border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400">
      <ShieldCheck className="h-3 w-3" />
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </Badge>
  );
}

// ─── Component ───────────────────────────────────────────────────────
export default function LicenseManagement() {
  const { isPlatformAdmin } = useAuth();

  // ── State ──────────────────────────────────────────────────────────
  const [overview, setOverview] = useState<LicenseOverview | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementRow[]>([]);
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Usage history chart (platform admin only)
  const [historyModule, setHistoryModule] = useState<string>('');
  const [historyDays, setHistoryDays] = useState<string>('30');
  const [historyData, setHistoryData] = useState<UsageHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Edit dialog (platform admin only)
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEnt, setEditingEnt] = useState<EntitlementRow | null>(null);
  const [editLimit, setEditLimit] = useState('');
  const [editThreshold, setEditThreshold] = useState('');
  const [editHardLimit, setEditHardLimit] = useState(true);
  const [saving, setSaving] = useState(false);

  // Confirmation dialog for lowering limits below current usage
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingLimitSave, setPendingLimitSave] = useState<{ limit: number; threshold: number } | null>(null);
  const pendingSaveRef = useRef(false);

  // ── Data Fetching ──────────────────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/license/overview');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => 'Unknown error')}`);
      }
      const data = await res.json();
      if (data.success && data.data) {
        setOverview(data.data);
        if (!historyModule && data.data.entitlements.length > 0) {
          setHistoryModule(data.data.entitlements[0].moduleKey);
        }
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch license overview.',
        variant: 'destructive',
      });
    }
  }, [historyModule]);

  const fetchEntitlements = useCallback(async () => {
    try {
      const res = await fetch('/api/license/entitlements');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => 'Unknown error')}`);
      }
      const data = await res.json();
      if (data.success && data.data) {
        setEntitlements(data.data.entitlements || []);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch entitlements.',
        variant: 'destructive',
      });
    }
  }, []);

  const fetchFeatureFlags = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/feature-flags');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => 'Unknown error')}`);
      }
      const data = await res.json();
      if (data.success && data.data) {
        setEnabledFeatures(data.data.enabledFeatures || []);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch feature flags.',
        variant: 'destructive',
      });
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    if (isPlatformAdmin) {
      await Promise.all([fetchOverview(), fetchEntitlements()]);
    } else {
      await Promise.all([fetchOverview(), fetchEntitlements(), fetchFeatureFlags()]);
    }
    setLoading(false);
  }, [fetchOverview, fetchEntitlements, fetchFeatureFlags, isPlatformAdmin]);

  useEffect(() => {
    const id = setTimeout(() => { fetchAllData(); }, 0);
    return () => clearTimeout(id);
  }, [fetchAllData]);

  // Fetch usage history when module or days change (platform admin)
  const fetchHistory = useCallback(async () => {
    if (!historyModule) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/license/usage/history?moduleKey=${encodeURIComponent(historyModule)}&days=${historyDays}`
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => 'Unknown error')}`);
      }
      const data = await res.json();
      if (data.success && data.data) {
        setHistoryData(data.data.history || []);
      }
    } catch {
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyModule, historyDays]);

  useEffect(() => {
    if (isPlatformAdmin) {
      const id = setTimeout(() => { fetchHistory(); }, 0);
      return () => clearTimeout(id);
    }
  }, [fetchHistory, isPlatformAdmin]);

  // ── Refresh Usage ──────────────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (isPlatformAdmin) {
        // Platform admin: POST to refresh usage counters
        const res = await fetch('/api/license/usage/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => 'Unknown error')}`);
        }
        const data = await res.json();
        if (data.success) {
          setLastRefresh(new Date());
          toast({
            title: 'Usage Refreshed',
            description: `Usage counters refreshed for ${data.data?.count ?? 0} modules.`,
          });
        } else {
          toast({
            title: 'Refresh Failed',
            description: data.error || 'Failed to refresh usage.',
            variant: 'destructive',
          });
        }
      } else {
        // Tenant admin: simple data reload
        await fetchAllData();
        toast({ title: 'Refreshed', description: 'Subscription data reloaded.' });
      }
    } catch {
      toast({
        title: 'Error',
        description: isPlatformAdmin
          ? 'Failed to refresh usage counters.'
          : 'Failed to reload subscription data.',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  // ── Edit Entitlement (Platform Admin) ──────────────────────────────
  const openEditDialog = (ent: EntitlementRow) => {
    setEditingEnt(ent);
    setEditLimit(ent.limitValue.toString());
    setEditThreshold(Math.round(ent.warningThreshold * 100).toString());
    setEditHardLimit(ent.hardLimit);
    setEditDialogOpen(true);
  };

  const executeSaveEntitlement = async (newLimit: number, newThreshold: number) => {
    if (!editingEnt) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/license/entitlements/${encodeURIComponent(editingEnt.moduleKey)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            limitValue: newLimit,
            warningThreshold: newThreshold / 100,
            hardLimit: editHardLimit,
          }),
        }
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => 'Unknown error')}`);
      }
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Entitlement Updated',
          description: `${editingEnt.moduleName} limits saved successfully.`,
        });
        setEditDialogOpen(false);
        setEditingEnt(null);
        await fetchAllData();
        await fetchHistory();
      } else {
        toast({
          title: 'Update Failed',
          description: data.error || 'Failed to update entitlement.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save entitlement changes.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      setPendingLimitSave(null);
      pendingSaveRef.current = false;
    }
  };

  const handleSaveEntitlement = async () => {
    if (!editingEnt) return;

    const newLimit = parseInt(editLimit, 10);
    const newThreshold = parseInt(editThreshold, 10);

    if (isNaN(newLimit) || newLimit < 0) {
      toast({
        title: 'Invalid Limit',
        description: 'Limit value must be 0 or greater (0 = unlimited).',
        variant: 'destructive',
      });
      return;
    }
    if (isNaN(newThreshold) || newThreshold < 1 || newThreshold > 100) {
      toast({
        title: 'Invalid Threshold',
        description: 'Warning threshold must be between 1 and 100.',
        variant: 'destructive',
      });
      return;
    }

    // Check if new limit is lower than current usage
    if (newLimit > 0 && newLimit < editingEnt.currentUsage) {
      setPendingLimitSave({ limit: newLimit, threshold: newThreshold });
      setConfirmDialogOpen(true);
      return;
    }

    await executeSaveEntitlement(newLimit, newThreshold);
  };

  const handleConfirmLowerLimit = async () => {
    if (!pendingLimitSave) return;
    setConfirmDialogOpen(false);
    await executeSaveEntitlement(pendingLimitSave.limit, pendingLimitSave.threshold);
  };

  // ── Derived Data (Tenant Admin) ────────────────────────────────────
  const enabledAddons = Object.values(FEATURES).filter(
    (f) => f.category === 'addons' && enabledFeatures.includes(f.id)
  );
  const groupedAddons = Object.entries(ADDON_SUBCATEGORIES)
    .map(([key, info]) => ({
      key,
      name: info.name,
      description: info.description,
      features: enabledAddons.filter((f) => f.subcategory === key),
    }))
    .filter((g) => g.features.length > 0);
  const getEntitlementFor = (moduleKey: string) =>
    entitlements.find((e) => e.moduleKey === moduleKey);

  // ── Render Helpers ─────────────────────────────────────────────────
  const renderLimitCard = (
    title: string,
    icon: React.ComponentType<{ className?: string }>,
    result: LicenseCheckResult,
    gradientFrom: string,
    gradientTo: string,
    iconColor: string
  ) => {
    const Icon = icon;
    return (
      <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} p-2.5`}
              >
                <Icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">Base Module</p>
              </div>
            </div>
            {getStatusBadge(result.percent, result.isExceeded, result.isUnlimited)}
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight">
                {result.isUnlimited ? '\u221E' : result.current.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">
                {result.isUnlimited ? 'unlimited' : `/ ${result.limit.toLocaleString()}`}
              </span>
            </div>
            <Progress
              value={result.isUnlimited ? 0 : Math.min(result.percent, 100)}
              className={`h-2 ${getProgressClass(result.percent, result.isExceeded)}`}
            />
            {!result.isUnlimited && (
              <p className="text-xs text-muted-foreground">
                {Math.round(result.percent)}% utilized
                {result.percent >= 80 && result.percent < 95 && ' \u2014 approaching limit'}
                {result.percent >= 95 && ' \u2014 critically high'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderOverviewSkeleton = () => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-2 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderSkeleton = (count: number) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-2 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderTableSkeleton = () => (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-36" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );

  // ── Chart config ───────────────────────────────────────────────────
  const chartConfig = {
    usageValue: {
      label: 'Usage',
      color: 'hsl(var(--chart-1))',
    },
  };

  // ── Available modules for history dropdown ──────────────────────────
  const availableModules = overview?.entitlements?.map((e) => ({
    key: e.moduleKey,
    name: e.moduleName,
  })) ?? [];

  // ── JSX ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-2">
              <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
              Licensing &amp; Subscription
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 ml-[2.875rem]">
            {isPlatformAdmin
              ? 'Monitor usage, manage module entitlements, and review license limits.'
              : 'View your current plan, usage, and enabled modules.'}
          </p>
          {overview?.plan && (
            <div className="ml-[2.875rem] mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Current Plan:</span>
              {getPlanBadge(overview.plan)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isPlatformAdmin && overview?.plan && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Read-only &middot; Tenant ID: {overview.tenantId.slice(0, 8)}&hellip;</span>
            </div>
          )}
          {isPlatformAdmin && lastRefresh && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Last refresh: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant={isPlatformAdmin ? 'default' : 'outline'}
            className="shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {refreshing
              ? 'Refreshing...'
              : isPlatformAdmin
                ? 'Refresh Usage'
                : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Gradient section divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ── Section A: Base Module Usage (ALWAYS VISIBLE) ──────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="rounded-lg bg-gradient-to-br from-slate-500/10 to-slate-500/5 p-1.5">
            <ShieldCheck className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold">
            Base Module {isPlatformAdmin ? '(PMS)' : 'Usage'}
          </h3>
        </div>
        {loading ? (
          renderOverviewSkeleton()
        ) : overview ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {renderLimitCard(
              'Rooms',
              Hotel,
              overview.baseLimits.rooms,
              'from-violet-500/10',
              'to-violet-500/5',
              'text-violet-600 dark:text-violet-400'
            )}
            {renderLimitCard(
              'Properties',
              Activity,
              overview.baseLimits.properties,
              'from-cyan-500/10',
              'to-cyan-500/5',
              'text-cyan-600 dark:text-cyan-400'
            )}
            {renderLimitCard(
              'Users',
              Users,
              overview.baseLimits.users,
              'from-orange-500/10',
              'to-orange-500/5',
              'text-orange-600 dark:text-orange-400'
            )}
          </div>
        ) : (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="py-12 flex flex-col items-center text-muted-foreground">
              <Shield className="h-10 w-10 opacity-30 mb-2" />
              <p className="font-medium">No subscription data available</p>
              <p className="text-xs mt-1">Contact your administrator for more details.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Section B: Warning Banner (ALWAYS VISIBLE) ────────────── */}
      {overview && (overview.exceeded.length > 0 || overview.warnings.length > 0) && (
        <div
          className={`rounded-2xl border px-5 py-4 transition-all duration-300 ${
            overview.exceeded.length > 0
              ? 'border-red-500/30 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent'
              : 'border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`shrink-0 rounded-lg p-2 ${
                overview.exceeded.length > 0
                  ? 'bg-red-500/15'
                  : 'bg-amber-500/15'
              }`}
            >
              <AlertTriangle
                className={`h-5 w-5 ${
                  overview.exceeded.length > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4
                className={`text-sm font-semibold ${
                  overview.exceeded.length > 0
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {overview.exceeded.length > 0
                  ? `${overview.exceeded.length} limit(s) exceeded`
                  : `${overview.warnings.length} module(s) approaching limits`}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {[...overview.exceeded, ...overview.warnings]
                  .map(
                    (w) =>
                      `${w.moduleName}: ${w.current}/${w.limit === 0 ? '\u221E' : w.limit} (${Math.round(w.percent)}%)`
                  )
                  .join(' \u00B7 ')}
              </p>
              {!isPlatformAdmin && (
                <p className="text-xs mt-2 text-muted-foreground italic">
                  Contact your administrator to request a limit increase or plan upgrade.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gradient section divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ── Section C: Add-on Module Entitlements Table (PLATFORM ADMIN ONLY) ── */}
      {isPlatformAdmin && (
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 p-2">
                  <Settings className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <CardTitle>Add-on Module Entitlements</CardTitle>
                  <CardDescription>
                    {loading
                      ? 'Loading...'
                      : `${entitlements.length} module${entitlements.length !== 1 ? 's' : ''} configured`}
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-background/50 overflow-hidden">
              <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Module</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Limit Type</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Usage</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Peak</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Hard Limit</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Warning At</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      renderTableSkeleton()
                    ) : entitlements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Shield className="h-10 w-10 opacity-30" />
                            <p className="font-medium">No add-on modules configured</p>
                            <p className="text-xs">
                              Enable module feature flags to create entitlements
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      entitlements.map((ent) => {
                        const percent =
                          ent.limitValue === 0
                            ? 0
                            : (ent.currentUsage / ent.limitValue) * 100;
                        const isExceeded =
                          ent.limitValue > 0 && ent.currentUsage > ent.limitValue;

                        const ModuleIcon =
                          MODULE_ICONS[ent.moduleKey] || Settings;

                        return (
                          <TableRow key={ent.id} className="group">
                            {/* Module Name + Icon */}
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <div className="rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 p-1.5 shrink-0">
                                  <ModuleIcon className="h-4 w-4 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {ent.moduleName}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground font-mono">
                                    {ent.moduleKey}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            {/* Limit Type */}
                            <TableCell>
                              <span className="text-xs text-muted-foreground capitalize">
                                {ent.limitType.replace(/_/g, ' ')}
                              </span>
                            </TableCell>

                            {/* Usage */}
                            <TableCell>
                              <div className="space-y-1 min-w-[120px]">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-sm font-semibold">
                                    {ent.currentUsage.toLocaleString()}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {ent.limitValue === 0
                                      ? '(unlimited)'
                                      : `/ ${ent.limitValue.toLocaleString()}`}
                                  </span>
                                </div>
                                <Progress
                                  value={
                                    ent.limitValue === 0
                                      ? 0
                                      : Math.min(percent, 100)
                                  }
                                  className={`h-1.5 ${getProgressClass(percent, isExceeded)}`}
                                />
                              </div>
                            </TableCell>

                            {/* Peak */}
                            <TableCell className="hidden md:table-cell">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <TrendingUp className="h-3 w-3" />
                                {ent.peakUsage.toLocaleString()}
                              </div>
                            </TableCell>

                            {/* Hard Limit Toggle */}
                            <TableCell className="hidden lg:table-cell">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      ent.hardLimit
                                        ? 'border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-400'
                                        : 'border-muted-foreground/20 bg-muted/30 text-muted-foreground'
                                    }`}
                                  >
                                    {ent.hardLimit ? 'Enforced' : 'Soft'}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {ent.hardLimit
                                    ? 'Access is blocked when limit is exceeded'
                                    : 'Usage continues but a warning is shown'}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>

                            {/* Warning Threshold */}
                            <TableCell className="hidden lg:table-cell">
                              <span className="text-xs font-medium text-muted-foreground">
                                {Math.round(ent.warningThreshold * 100)}%
                              </span>
                            </TableCell>

                            {/* Status */}
                            <TableCell>
                              {getStatusBadge(percent, isExceeded, ent.limitValue === 0)}
                            </TableCell>

                            {/* Edit */}
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(ent)}
                                className="h-7 w-7 p-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                title={`Edit ${ent.moduleName}`}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section D: Enabled Modules (TENANT ADMIN ONLY) ────────── */}
      {!isPlatformAdmin && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-lg bg-gradient-to-br from-violet-500/10 to-violet-500/5 p-1.5">
              <Settings className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold">Enabled Modules</h3>
            {!loading && (
              <Badge variant="outline" className="ml-2 text-xs font-normal">
                {enabledAddons.length} addon{enabledAddons.length !== 1 ? 's' : ''} active
              </Badge>
            )}
          </div>
          {loading ? (
            renderSkeleton(6)
          ) : groupedAddons.length === 0 ? (
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="py-12 flex flex-col items-center text-muted-foreground">
                <Shield className="h-10 w-10 opacity-30 mb-2" />
                <p className="font-medium">No addon modules enabled</p>
                <p className="text-xs mt-1">Ask your administrator to enable modules for your plan.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {groupedAddons.map((group) => {
                const GroupIcon = SUB_ICONS[group.key] || Settings;
                return (
                  <div key={group.key}>
                    <div className="flex items-center gap-2 mb-3">
                      <GroupIcon className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-semibold">{group.name}</h4>
                      <span className="text-xs text-muted-foreground">
                        {group.features.length} module{group.features.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {group.features.map((feature) => {
                        const ent = getEntitlementFor(feature.id);
                        const pct =
                          ent && ent.limitValue > 0
                            ? (ent.currentUsage / ent.limitValue) * 100
                            : 0;
                        const exceeded =
                          !!ent && ent.limitValue > 0 && ent.currentUsage > ent.limitValue;
                        const unlimited = !ent || ent.limitValue === 0;
                        return (
                          <Card
                            key={feature.id}
                            className="border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 rounded-2xl"
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="rounded-lg bg-gradient-to-br from-violet-500/10 to-violet-500/5 p-1.5 shrink-0">
                                    <GroupIcon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                                  </div>
                                  <p className="text-sm font-medium truncate">{feature.name}</p>
                                </div>
                                {getStatusBadge(pct, exceeded, unlimited)}
                              </div>
                              {ent ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-lg font-bold">
                                      {unlimited ? '\u221E' : ent.currentUsage.toLocaleString()}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {unlimited
                                        ? 'unlimited'
                                        : `/ ${ent.limitValue.toLocaleString()}`}
                                    </span>
                                  </div>
                                  {!unlimited && (
                                    <Progress
                                      value={Math.min(pct, 100)}
                                      className={`h-1.5 ${getProgressClass(pct, exceeded)}`}
                                    />
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No usage limits configured</p>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Gradient section divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ── Section E: Usage History Chart (PLATFORM ADMIN ONLY) ──── */}
      {isPlatformAdmin && (
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-2">
                  <BarChart3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle>Usage History</CardTitle>
                  <CardDescription>
                    Track module usage trends over time
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={historyModule}
                  onValueChange={setHistoryModule}
                >
                  <SelectTrigger className="w-[180px] rounded-xl">
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModules.map((m) => (
                      <SelectItem key={m.key} value={m.key}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={historyDays} onValueChange={setHistoryDays}>
                  <SelectTrigger className="w-[110px] rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-[280px] w-full rounded-xl" />
              </div>
            ) : historyData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="h-10 w-10 opacity-30 mb-2" />
                <p className="font-medium">No usage history available</p>
                <p className="text-xs mt-1">
                  Usage data will appear here after the first refresh cycle
                </p>
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <BarChart data={historyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="sampledAt"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val: string) => {
                      try {
                        const d = new Date(val);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      } catch {
                        return val;
                      }
                    }}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    width={40}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(label: string) => {
                          try {
                            return new Date(label).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            });
                          } catch {
                            return label;
                          }
                        }}
                        formatter={(value: number) => [value.toLocaleString(), 'Usage']}
                      />
                    }
                  />
                  <Bar
                    dataKey="usageValue"
                    fill="var(--color-usageValue)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Section F: Contact Admin Footer (TENANT ADMIN ONLY) ───── */}
      {!isPlatformAdmin && (
        <div className="rounded-2xl border border-muted bg-muted/30 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-lg bg-primary/10 p-2">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Need to upgrade or modify?</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Contact your administrator to upgrade your plan, enable additional modules, or
                request changes to your subscription limits.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Entitlement Dialog (PLATFORM ADMIN ONLY) ─────────── */}
      {isPlatformAdmin && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Edit2 className="h-5 w-5 text-primary" />
                </div>
                <DialogTitle>Edit Entitlement</DialogTitle>
              </div>
              <DialogDescription className="pt-2">
                {editingEnt
                  ? `Configure limits for ${editingEnt.moduleName}`
                  : 'Configure module limits'}
              </DialogDescription>
            </DialogHeader>

            {editingEnt && (
              <div className="space-y-4 pt-2">
                {/* Module info */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Module
                  </p>
                  <p className="text-sm font-medium">{editingEnt.moduleName}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {editingEnt.moduleKey} &middot; {editingEnt.limitType.replace(/_/g, ' ')}
                  </p>
                </div>

                {/* Current usage summary */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border bg-muted/20 p-2">
                    <p className="text-lg font-bold">
                      {editingEnt.currentUsage.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Current</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-2">
                    <p className="text-lg font-bold">
                      {editingEnt.limitValue.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Limit</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-2">
                    <p className="text-lg font-bold">
                      {editingEnt.peakUsage.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Peak</p>
                  </div>
                </div>

                {/* Limit Value */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Limit Value
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={editLimit}
                    onChange={(e) => setEditLimit(e.target.value)}
                    className="rounded-xl transition-all duration-300 focus:ring-2 focus:ring-primary/10 hover:border-primary/30"
                    placeholder="0 = unlimited"
                  />
                  <p className="text-xs text-muted-foreground">
                    Set to 0 for unlimited usage
                  </p>
                </div>

                {/* Warning Threshold */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Warning Threshold (%)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={editThreshold}
                    onChange={(e) => setEditThreshold(e.target.value)}
                    className="rounded-xl transition-all duration-300 focus:ring-2 focus:ring-primary/10 hover:border-primary/30"
                    placeholder="80"
                  />
                  <p className="text-xs text-muted-foreground">
                    Show warning when usage reaches this percentage of the limit
                  </p>
                </div>

                {/* Hard Limit Toggle */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Hard Limit</Label>
                    <p className="text-xs text-muted-foreground">
                      Block access when the limit is exceeded
                    </p>
                  </div>
                  <Switch
                    checked={editHardLimit}
                    onCheckedChange={setEditHardLimit}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setEditingEnt(null);
                }}
                disabled={saving}
                className="transition-all duration-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEntitlement}
                disabled={saving}
                className="shadow-md hover:shadow-lg transition-all duration-200"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Confirm Lower Limit AlertDialog (PLATFORM ADMIN ONLY) ── */}
      {isPlatformAdmin && (
        <AlertDialog
          open={confirmDialogOpen}
          onOpenChange={(open) => {
            setConfirmDialogOpen(open);
            if (!open) setPendingLimitSave(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-amber-500/10 p-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <AlertDialogTitle>Lower Limit Below Current Usage</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="pt-2">
                {editingEnt && pendingLimitSave
                  ? `Current usage (${editingEnt.currentUsage.toLocaleString()}) exceeds the new limit (${pendingLimitSave.limit.toLocaleString()}). Some features may become unavailable.`
                  : 'Current usage exceeds the new limit. Some features may become unavailable.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleConfirmLowerLimit}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {saving ? 'Saving...' : 'Confirm & Save'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
