'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import {
  Shield, ShieldCheck, ShieldAlert, Hotel, Users, Activity,
  AlertTriangle, Crown, Settings, Wifi, Lock, Info,
} from 'lucide-react';
import { ADDON_SUBCATEGORIES, FEATURES } from '@/lib/feature-flags';

// ─── Types ───────────────────────────────────────────────────────────
interface LicenseCheckResult {
  allowed: boolean; current: number; limit: number; percent: number;
  isUnlimited: boolean; isWarning: boolean; isExceeded: boolean;
  moduleKey: string; moduleName: string; hardLimit: boolean;
}
interface EntitlementRow {
  id: string; moduleKey: string; moduleName: string; limitType: string;
  limitValue: number; currentUsage: number; peakUsage: number;
  warningThreshold: number; hardLimit: boolean; isValid: boolean;
}
interface LicenseOverview {
  baseLimits: { rooms: LicenseCheckResult; properties: LicenseCheckResult; users: LicenseCheckResult };
  entitlements: LicenseCheckResult[]; warnings: LicenseCheckResult[]; exceeded: LicenseCheckResult[];
  plan: string; tenantId: string;
}

// ─── Subcategory Icons ───────────────────────────────────────────────
const SUB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Guest Experience': Activity, 'Facility Management': Settings, 'Connectivity': Wifi,
  'Revenue & Channels': Activity, 'Marketing & CRM': Users, 'Analytics': Activity,
  'Events': Activity, 'Resort & Leisure': Crown, 'Staff Management': Users,
  'Security': Shield, 'Integrations & Automation': Settings, 'Enterprise': Crown, 'System': Settings,
};

// ─── Plan badge config ───────────────────────────────────────────────
const PLAN_STYLES: Record<string, { border: string; bg: string; text: string; Icon: React.ComponentType<{ className?: string }> }> = {
  enterprise: { border: 'border-violet-500/30', bg: 'bg-violet-500/10', text: 'text-violet-700 dark:text-violet-400', Icon: Crown },
  professional: { border: 'border-teal-500/30', bg: 'bg-teal-500/10', text: 'text-teal-700 dark:text-teal-400', Icon: ShieldCheck },
  starter: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', Icon: ShieldCheck },
  trial: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', Icon: ShieldAlert },
};

// ─── Helpers ─────────────────────────────────────────────────────────
function getProgressClass(percent: number, isExceeded: boolean) {
  if (isExceeded || percent >= 95) return '[&>[data-slot=progress-indicator]]:bg-red-500';
  if (percent >= 80) return '[&>[data-slot=progress-indicator]]:bg-amber-500';
  return '[&>[data-slot=progress-indicator]]:bg-emerald-500';
}

function getStatusBadge(percent: number, isExceeded: boolean, isUnlimited: boolean) {
  if (isUnlimited) return <Badge variant="outline" className="gap-1 text-xs border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"><ShieldCheck className="h-3 w-3" />Unlimited</Badge>;
  if (isExceeded || percent >= 95) return <Badge variant="destructive" className="gap-1 text-xs"><ShieldAlert className="h-3 w-3" />Critical</Badge>;
  if (percent >= 80) return <Badge variant="warning" className="gap-1 text-xs"><AlertTriangle className="h-3 w-3" />Warning</Badge>;
  return <Badge variant="success" className="gap-1 text-xs"><ShieldCheck className="h-3 w-3" />OK</Badge>;
}

function getPlanBadge(plan: string) {
  const p = plan.toLowerCase();
  const style = PLAN_STYLES[p] || PLAN_STYLES.trial;
  const Icon = style.Icon;
  return (
    <Badge variant="outline" className={`gap-1.5 ${style.border} ${style.bg} ${style.text} text-sm px-3 py-1`}>
      <Icon className="h-3.5 w-3.5" />
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </Badge>
  );
}

// ─── Component ───────────────────────────────────────────────────────
export default function MySubscription() {
  const [overview, setOverview] = useState<LicenseOverview | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementRow[]>([]);
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Data Fetching ──────────────────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/license/overview');
      const data = await res.json();
      if (data.success && data.data) setOverview(data.data);
    } catch { toast({ title: 'Error', description: 'Failed to fetch subscription overview.', variant: 'destructive' }); }
  }, []);

  const fetchEntitlements = useCallback(async () => {
    try {
      const res = await fetch('/api/license/entitlements');
      const data = await res.json();
      if (data.success && data.data) setEntitlements(data.data.entitlements || []);
    } catch { toast({ title: 'Error', description: 'Failed to fetch entitlements.', variant: 'destructive' }); }
  }, []);

  const fetchFeatureFlags = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/feature-flags');
      const data = await res.json();
      if (data.success && data.data) setEnabledFeatures(data.data.enabledFeatures || []);
    } catch { toast({ title: 'Error', description: 'Failed to fetch feature flags.', variant: 'destructive' }); }
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchOverview(), fetchEntitlements(), fetchFeatureFlags()]);
    setLoading(false);
  }, [fetchOverview, fetchEntitlements, fetchFeatureFlags]);

  useEffect(() => {
    const id = setTimeout(() => { fetchAllData(); }, 0);
    return () => clearTimeout(id);
  }, [fetchAllData]);

  // ── Derived Data ───────────────────────────────────────────────────
  const enabledAddons = Object.values(FEATURES).filter(
    (f) => f.category === 'addons' && enabledFeatures.includes(f.id)
  );
  const groupedAddons = Object.entries(ADDON_SUBCATEGORIES)
    .map(([key, info]) => ({ key, name: info.name, description: info.description, features: enabledAddons.filter((f) => f.subcategory === key) }))
    .filter((g) => g.features.length > 0);
  const getEntitlementFor = (moduleKey: string) => entitlements.find((e) => e.moduleKey === moduleKey);

  // ── Render Helpers ─────────────────────────────────────────────────
  const renderLimitCard = (
    title: string, icon: React.ComponentType<{ className?: string }>, result: LicenseCheckResult,
    gradientFrom: string, gradientTo: string, iconColor: string
  ) => {
    const Icon = icon;
    return (
      <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} p-2.5`}>
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
              <span className="text-2xl font-bold tracking-tight">{result.isUnlimited ? '∞' : result.current.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground">{result.isUnlimited ? 'unlimited' : `/ ${result.limit.toLocaleString()}`}</span>
            </div>
            <Progress value={result.isUnlimited ? 0 : Math.min(result.percent, 100)} className={`h-2 ${getProgressClass(result.percent, result.isExceeded)}`} />
            {!result.isUnlimited && (
              <p className="text-xs text-muted-foreground">
                {Math.round(result.percent)}% utilized
                {result.percent >= 80 && result.percent < 95 && ' — approaching limit'}
                {result.percent >= 95 && ' — critically high'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSkeleton = (count: number) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-1.5"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-16" /></div>
            </div>
            <div className="space-y-2"><Skeleton className="h-7 w-20" /><Skeleton className="h-2 w-full" /></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // ── JSX ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Section 1: Header ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-2">
              <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
              My Subscription
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 ml-[2.875rem]">View your current plan, usage, and enabled modules.</p>
          {overview?.plan && (
            <div className="ml-[2.875rem] mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Current Plan:</span>
              {getPlanBadge(overview.plan)}
            </div>
          )}
        </div>
        {overview?.plan && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            <span>Read-only · Tenant ID: {overview.tenantId.slice(0, 8)}…</span>
          </div>
        )}
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ── Section 2: Base Module Cards ─────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="rounded-lg bg-gradient-to-br from-slate-500/10 to-slate-500/5 p-1.5">
            <ShieldCheck className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold">Base Module Usage</h3>
        </div>
        {loading ? renderSkeleton(3) : overview ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {renderLimitCard('Rooms', Hotel, overview.baseLimits.rooms, 'from-violet-500/10', 'to-violet-500/5', 'text-violet-600 dark:text-violet-400')}
            {renderLimitCard('Properties', Activity, overview.baseLimits.properties, 'from-cyan-500/10', 'to-cyan-500/5', 'text-cyan-600 dark:text-cyan-400')}
            {renderLimitCard('Users', Users, overview.baseLimits.users, 'from-orange-500/10', 'to-orange-500/5', 'text-orange-600 dark:text-orange-400')}
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

      {/* ── Section 3: Warning Banner ────────────────────────────── */}
      {overview && (overview.exceeded.length > 0 || overview.warnings.length > 0) && (
        <div className={`rounded-2xl border px-5 py-4 transition-all duration-300 ${
          overview.exceeded.length > 0
            ? 'border-red-500/30 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent'
            : 'border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`shrink-0 rounded-lg p-2 ${overview.exceeded.length > 0 ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
              <AlertTriangle className={`h-5 w-5 ${overview.exceeded.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`text-sm font-semibold ${overview.exceeded.length > 0 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {overview.exceeded.length > 0
                  ? `${overview.exceeded.length} limit(s) exceeded`
                  : `${overview.warnings.length} module(s) approaching limits`}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {overview.warnings.map((w) => `${w.moduleName}: ${w.current}/${w.limit === 0 ? '∞' : w.limit} (${Math.round(w.percent)}%)`).join(' · ')}
              </p>
              <p className="text-xs mt-2 text-muted-foreground italic">Contact your administrator to request a limit increase or plan upgrade.</p>
            </div>
          </div>
        </div>
      )}

      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ── Section 4: Enabled Modules ───────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="rounded-lg bg-gradient-to-br from-violet-500/10 to-violet-500/5 p-1.5">
            <Settings className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="text-lg font-semibold">Enabled Modules</h3>
          {!loading && <Badge variant="outline" className="ml-2 text-xs font-normal">{enabledAddons.length} addon{enabledAddons.length !== 1 ? 's' : ''} active</Badge>}
        </div>
        {loading ? renderSkeleton(6) : groupedAddons.length === 0 ? (
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
                    <span className="text-xs text-muted-foreground">{group.features.length} module{group.features.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.features.map((feature) => {
                      const ent = getEntitlementFor(feature.id);
                      const pct = ent && ent.limitValue > 0 ? (ent.currentUsage / ent.limitValue) * 100 : 0;
                      const exceeded = !!ent && ent.limitValue > 0 && ent.currentUsage > ent.limitValue;
                      const unlimited = !ent || ent.limitValue === 0;
                      return (
                        <Card key={feature.id} className="border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
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
                                  <span className="text-lg font-bold">{unlimited ? '∞' : ent.currentUsage.toLocaleString()}</span>
                                  <span className="text-xs text-muted-foreground">{unlimited ? 'unlimited' : `/ ${ent.limitValue.toLocaleString()}`}</span>
                                </div>
                                {!unlimited && <Progress value={Math.min(pct, 100)} className={`h-1.5 ${getProgressClass(pct, exceeded)}`} />}
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

      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ── Section 5: Footer Note ───────────────────────────────── */}
      <div className="rounded-2xl border border-muted bg-muted/30 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-lg bg-primary/10 p-2">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold">Need to upgrade or modify?</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Contact your administrator to upgrade your plan, enable additional modules, or request changes to your subscription limits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
