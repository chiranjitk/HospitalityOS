'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
  Crown,
  Plus,
  Edit,
  Copy,
  Trash2,
  RefreshCw,
  Loader2,
  Star,
  Building2,
  Users,
  DoorOpen,
  HardDrive,
  Cloud,
  Wifi,
  Shield,
  BarChart3,
  Package,
  ChevronDown,
  ChevronRight,
  Lock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  IndianRupee,
  DollarSign,
  Euro,
  PoundSterling,
  Gem,
  Sparkles,
  GripVertical,
  Eye,
  EyeOff,
  Settings,
  Blocks,
  Info,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';

// =====================================================
// TYPES
// =====================================================

interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  deploymentType: 'cloud' | 'onprem' | 'both';
  setupFee: number;
  maxProperties: number;
  maxUsers: number;
  maxRoomsPerProperty: number;
  maxStaff: number;
  storageLimitMb: number;
  trialDays: number | null;
  isPopular: boolean;
  isCustom: boolean;
  isActive: boolean;
  sortOrder: number;
  parsedFeatures: string[];
  parsedAddonModules: AddonPricingItem[];
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AddonPricingItem {
  featureId: string;
  included: boolean;
  monthlyPrice: number;
}

interface FeatureCatalogItem {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory: string | null;
  icon: string | null;
  alwaysEnabled: boolean;
  locked: boolean;
  dependencies: string[];
  menuItems: string[];
  apiRoutes: string[];
  defaultLimits: { limitType: string; limitValue: number; moduleName: string } | null;
}

interface AddonGroup {
  subcategory: string;
  subcategoryInfo: { name: string; description: string; icon: string };
  features: FeatureCatalogItem[];
}

interface FeaturesCatalog {
  baseFeatures: FeatureCatalogItem[];
  addonFeatures: FeatureCatalogItem[];
  addonGroups: AddonGroup[];
  moduleDefaultConfigs: Record<string, { limitType: string; limitValue: number; moduleName: string }>;
  categoryInfo: Record<string, { name: string; description: string; locked: boolean }>;
  subcategoryInfo: Record<string, { name: string; description: string; icon: string }>;
  totalBaseFeatures: number;
  totalAddonFeatures: number;
}

interface ModuleLimitConfig {
  moduleKey: string;
  moduleName: string;
  limitType: string;
  limitValue: number;
  hardLimit: boolean;
  warningThreshold: number;
}

// =====================================================
// CONSTANTS
// =====================================================

const CURRENCIES = [
  { value: 'INR', symbol: '₹', label: 'INR (₹)' },
  { value: 'USD', symbol: '$', label: 'USD ($)' },
  { value: 'EUR', symbol: '€', label: 'EUR (€)' },
  { value: 'GBP', symbol: '£', label: 'GBP (£)' },
  { value: 'AED', symbol: 'د.إ', label: 'AED (د.إ)' },
];

const DEPLOYMENT_TYPES = [
  { value: 'cloud', label: 'Cloud', icon: Cloud },
  { value: 'onprem', label: 'On-Premise', icon: HardDrive },
  { value: 'both', label: 'Both', icon: Blocks },
];

const LIMIT_TYPES = [
  { value: 'concurrent_users', label: 'Concurrent Users' },
  { value: 'users', label: 'Users' },
  { value: 'rooms', label: 'Rooms' },
  { value: 'properties', label: 'Properties' },
  { value: 'devices', label: 'Devices' },
  { value: 'bookings', label: 'Bookings' },
  { value: 'staff', label: 'Staff' },
];

// =====================================================
// HELPERS
// =====================================================

function formatCurrency(amount: number, currency: string): string {
  const c = CURRENCIES.find((c) => c.value === currency) ?? CURRENCIES[0];
  return `${c.symbol}${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getCurrencyIcon(currency: string) {
  switch (currency) {
    case 'INR': return IndianRupee;
    case 'USD': return DollarSign;
    case 'EUR': return Euro;
    case 'GBP': return PoundSterling;
    case 'AED': return Gem;
    default: return DollarSign;
  }
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function PlanBuilder() {
  const { toast } = useToast();
  const t = useTranslations('billing');

  // ── Data State ──
  const [plans, setPlans] = useState<Plan[]>([]);
  const [catalog, setCatalog] = useState<FeaturesCatalog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('all-plans');

  // ── Editor State ──
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);

  // ── Form State ──
  const [form, setForm] = useState({
    displayName: '',
    description: '',
    name: '',
    currency: 'INR',
    deploymentType: 'cloud' as 'cloud' | 'onprem' | 'both',
    monthlyPrice: 0,
    yearlyPrice: 0,
    setupFee: 0,
    trialDays: 14,
    isPopular: false,
    isCustom: false,
    isActive: true,
    maxProperties: 1,
    maxUsers: 5,
    maxRoomsPerProperty: 50,
    maxStaff: 10,
    storageLimitMb: 1000,
  });

  const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(new Set());
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
  const [moduleLimits, setModuleLimits] = useState<ModuleLimitConfig[]>([]);
  const [addonPricing, setAddonPricing] = useState<Record<string, { monthlyPrice: number; setupFee: number }>>({});

  // ── Fetch Data ──
  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/plan-builder');
      const data = await res.json();
      if (data.success) {
        setPlans(data.data);
      } else {
        toast({ title: t('pbError'), description: data.error || t('pbFailedToFetchPlans'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('pbError'), description: t('pbNetworkErrorFetchingPlans'), variant: 'destructive' });
    }
  }, [toast]);

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/plan-builder/features-catalog');
      const data = await res.json();
      if (data.success) {
        setCatalog(data.data);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchPlans(), fetchCatalog()]).finally(() => setIsLoading(false));
  }, [fetchPlans, fetchCatalog]);

  // ── Feature Toggle ──
  const toggleFeature = (featureId: string, featureConfig: FeatureCatalogItem | undefined) => {
    if (!catalog) return;

    if (enabledFeatures.has(featureId)) {
      // Turning OFF a feature
      setEnabledFeatures((prev) => {
        const next = new Set(prev);
        next.delete(featureId);
        // Remove any dependents
        if (featureConfig) {
          for (const cfg of catalog.addonFeatures) {
            if (cfg.dependencies?.includes(featureId) && next.has(cfg.id)) {
              next.delete(cfg.id);
              toast({
                title: t('pbDependencyRemoved'),
                description: t('pbDependencyDisabled', { name: cfg.name, required: featureConfig.name }),
              });
            }
          }
        }
        return next;
      });
      setExpandedFeatures((prev) => {
        const next = new Set(prev);
        next.delete(featureId);
        return next;
      });
    } else {
      // Turning ON a feature
      const next = new Set(enabledFeatures);
      next.add(featureId);
      // Auto-enable dependencies
      if (featureConfig?.dependencies) {
        for (const dep of featureConfig.dependencies) {
          if (!next.has(dep)) {
            next.add(dep);
            const depCfg = catalog.addonFeatures.find((f) => f.id === dep);
            toast({
              title: t('pbDependencyEnabled'),
              description: t('pbDependencyAutoEnabled', { name: depCfg?.name || dep, feature: featureConfig.name }),
            });
          }
        }
      }
      setEnabledFeatures(next);
    }
  };

  // ── Module Limits ──
  const updateModuleLimit = (moduleKey: string, field: keyof ModuleLimitConfig, value: unknown) => {
    setModuleLimits((prev) => {
      const existing = prev.find((m) => m.moduleKey === moduleKey);
      if (existing) {
        return prev.map((m) => (m.moduleKey === moduleKey ? { ...m, [field]: value } : m));
      }
      const catalogItem = catalog?.addonFeatures.find((f) => f.id === moduleKey);
      const defaultConfig = catalogItem?.defaultLimits;
      return [
        ...prev,
        {
          moduleKey,
          moduleName: catalogItem?.name || moduleKey,
          limitType: defaultConfig?.limitType || 'users',
          limitValue: defaultConfig?.limitValue || 10,
          hardLimit: true,
          warningThreshold: 80,
          [field]: value,
        },
      ];
    });
  };

  // ── Form Helpers ──
  const resetForm = () => {
    setForm({
      displayName: '',
      description: '',
      name: '',
      currency: 'INR',
      deploymentType: 'cloud',
      monthlyPrice: 0,
      yearlyPrice: 0,
      setupFee: 0,
      trialDays: 14,
      isPopular: false,
      isCustom: false,
      isActive: true,
      maxProperties: 1,
      maxUsers: 5,
      maxRoomsPerProperty: 50,
      maxStaff: 10,
      storageLimitMb: 1000,
    });
    setEnabledFeatures(new Set());
    setExpandedFeatures(new Set());
    setModuleLimits([]);
    setAddonPricing({});
    setEditingPlan(null);
  };

  const openCreateEditor = () => {
    resetForm();
    // Auto-enable all base features
    if (catalog) {
      setEnabledFeatures(new Set(catalog.baseFeatures.map((f) => f.id)));
    }
    setIsEditorOpen(true);
    setActiveTab('editor');
  };

  const openEditEditor = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      displayName: plan.displayName,
      description: plan.description,
      name: plan.name,
      currency: plan.currency,
      deploymentType: plan.deploymentType,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      setupFee: plan.setupFee,
      trialDays: plan.trialDays ?? 0,
      isPopular: plan.isPopular,
      isCustom: plan.isCustom,
      isActive: plan.isActive,
      maxProperties: plan.maxProperties,
      maxUsers: plan.maxUsers,
      maxRoomsPerProperty: plan.maxRoomsPerProperty,
      maxStaff: plan.maxStaff,
      storageLimitMb: plan.storageLimitMb,
    });
    setEnabledFeatures(new Set(plan.parsedFeatures));
    setExpandedFeatures(new Set());

    // Rebuild module limits from plan data
    const limits: ModuleLimitConfig[] = [];
    if (catalog) {
      for (const fid of plan.parsedFeatures) {
        const catItem = catalog.addonFeatures.find((f) => f.id === fid);
        if (catItem?.defaultLimits) {
          limits.push({
            moduleKey: fid,
            moduleName: catItem.name,
            limitType: catItem.defaultLimits.limitType,
            limitValue: catItem.defaultLimits.limitValue,
            hardLimit: true,
            warningThreshold: 80,
          });
        }
      }
    }
    setModuleLimits(limits);

    // Build addon pricing
    const pricing: Record<string, { monthlyPrice: number; setupFee: number }> = {};
    for (const addon of plan.parsedAddonModules) {
      pricing[addon.featureId] = { monthlyPrice: addon.monthlyPrice, setupFee: 0 };
    }
    setAddonPricing(pricing);

    setIsEditorOpen(true);
    setActiveTab('editor');
  };

  // ── Save Plan ──
  const handleSave = async () => {
    if (!form.displayName.trim()) {
      toast({ title: t('pbValidationError'), description: t('pbDisplayNameRequired'), variant: 'destructive' });
      return;
    }
    setIsSaving(true);

    try {
      // Build features array (base features are auto-included by the API)
      const featuresArray = Array.from(enabledFeatures);

      // Build addon pricing for the API
      const addonPricingArray = catalog
        ? catalog.addonFeatures.map((f) => ({
            featureId: f.id,
            included: enabledFeatures.has(f.id),
            monthlyPrice: enabledFeatures.has(f.id)
              ? (addonPricing[f.id]?.monthlyPrice ?? 0)
              : (addonPricing[f.id]?.monthlyPrice ?? f.defaultLimits ? 999 : 999),
          }))
        : [];

      // Build limits array
      const limitsArray = moduleLimits.map((m) => ({
        moduleKey: m.moduleKey,
        limitType: m.limitType,
        limitValue: m.limitValue,
      }));

      const body = {
        displayName: form.displayName.trim(),
        description: form.description,
        name: form.name || slugify(form.displayName),
        currency: form.currency,
        deploymentType: form.deploymentType,
        monthlyPrice: form.monthlyPrice,
        yearlyPrice: form.yearlyPrice,
        setupFee: form.setupFee,
        trialDays: form.trialDays || null,
        isPopular: form.isPopular,
        isCustom: form.isCustom,
        isActive: form.isActive,
        maxProperties: form.maxProperties,
        maxUsers: form.maxUsers,
        maxRoomsPerProperty: form.maxRoomsPerProperty,
        maxStaff: form.maxStaff,
        storageLimitMb: form.storageLimitMb,
        features: featuresArray,
        addonPricing: addonPricingArray,
        limits: limitsArray,
      };

      const url = editingPlan
        ? `/api/admin/plan-builder/${editingPlan.id}`
        : '/api/admin/plan-builder';
      const method = editingPlan ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        toast({
          title: editingPlan ? t('pbPlanUpdated') : t('pbPlanCreated'),
          description: data.message || t(editingPlan ? 'pbPlanUpdatedDesc' : 'pbPlanCreatedDesc', { name: form.displayName }),
        });
        setIsEditorOpen(false);
        resetForm();
        await fetchPlans();
        setActiveTab('all-plans');
      } else {
        toast({ title: t('pbError'), description: data.error || t(editingPlan ? 'pbFailedToUpdatePlan' : 'pbFailedToCreatePlan'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('pbError'), description: t('pbNetworkErrorSavingPlan'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Duplicate Plan ──
  const handleDuplicate = async (plan: Plan) => {
    try {
      const res = await fetch(`/api/admin/plan-builder/${plan.id}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast({ title: t('pbDuplicated'), description: data.message });
        await fetchPlans();
      } else {
        toast({ title: t('pbError'), description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: t('pbError'), description: t('pbFailedToDuplicatePlan'), variant: 'destructive' });
    }
  };

  // ── Delete Plan ──
  const confirmDelete = () => {
    if (!planToDelete) return;
    fetch(`/api/admin/plan-builder/${planToDelete.id}`, { method: 'DELETE' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          toast({ title: t('pbDeleted'), description: data.message });
          fetchPlans();
        } else {
          toast({ title: t('pbError'), description: data.error, variant: 'destructive' });
        }
      })
      .catch(() => toast({ title: t('pbError'), description: t('pbFailedToDeletePlan'), variant: 'destructive' }))
      .finally(() => {
        setDeleteDialogOpen(false);
        setPlanToDelete(null);
      });
  };

  // ── Toggle Active ──
  const handleToggleActive = async (plan: Plan) => {
    try {
      const res = await fetch(`/api/admin/plan-builder/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !plan.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: plan.isActive ? t('pbPlanDeactivated') : t('pbPlanActivated'), description: t(plan.isActive ? 'pbPlanNowInactive' : 'pbPlanNowActive', { name: plan.displayName }) });
        await fetchPlans();
      }
    } catch {
      toast({ title: t('pbError'), description: t('pbFailedToToggleStatus'), variant: 'destructive' });
    }
  };

  // ── Computed Values ──
  const includedCount = useMemo(() => {
    if (!catalog) return { base: 0, addons: 0 };
    const baseCount = catalog.baseFeatures.length;
    const addonCount = catalog.addonFeatures.filter((f) => enabledFeatures.has(f.id)).length;
    return { base: baseCount, addons: addonCount };
  }, [catalog, enabledFeatures]);

  const excludedAddons = useMemo(() => {
    if (!catalog) return [];
    return catalog.addonFeatures.filter((f) => !enabledFeatures.has(f.id));
  }, [catalog, enabledFeatures]);

  // ── Loading State ──
  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ──── HEADER ──── */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            {t('pbTitle')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('pbDesc')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchPlans(); fetchCatalog(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('pbRefresh')}
          </Button>
          <Button size="sm" onClick={openCreateEditor} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('pbCreateNewPlan')}
          </Button>
        </div>
      </div>

      {/* ──── STATS BAR ──── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Package className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{plans.length}</div>
              <div className="text-xs text-muted-foreground">{t('pbTotalPlans')}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{plans.filter((p) => p.isActive).length}</div>
              <div className="text-xs text-muted-foreground">{t('pbActivePlans')}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{plans.reduce((s, p) => s + p.subscriberCount, 0)}</div>
              <div className="text-xs text-muted-foreground">{t('pbTotalSubscribers')}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Blocks className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{catalog?.totalAddonFeatures ?? 0}</div>
              <div className="text-xs text-muted-foreground">{t('pbAddonModules')}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* ──── TABS ──── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-auto p-1 bg-muted/50">
          <TabsTrigger value="all-plans" className="gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <Package className="h-4 w-4" />
            {t('pbAllPlans')}
          </TabsTrigger>
          <TabsTrigger
            value="editor"
            className="gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white"
            disabled={!isEditorOpen}
          >
            <Edit className="h-4 w-4" />
            {editingPlan ? t('pbEditPlan', { name: editingPlan.displayName }) : t('pbCreateNewPlan')}
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════ TAB 1: ALL PLANS ═══════════════════ */}
        <TabsContent value="all-plans" className="!flex-none">
          {plans.length === 0 ? (
            <Card className="rounded-2xl border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="p-4 rounded-full bg-muted">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">{t('pbNoPlansYet')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{t('pbNoPlansYetDesc')}</p>
                </div>
                <Button onClick={openCreateEditor} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('pbCreateFirstPlan')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((plan) => {
                const CurrencyIcon = getCurrencyIcon(plan.currency);
                const featureCount = plan.parsedFeatures.length;
                return (
                  <Card
                    key={plan.id}
                    className={cn(
                      'relative flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1 rounded-2xl',
                      plan.isPopular ? 'border-amber-500/50 shadow-md shadow-amber-500/10' : 'border-border/40',
                      !plan.isActive && 'opacity-60'
                    )}
                  >
                    {/* Popular badge */}
                    {plan.isPopular && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl flex items-center gap-1">
                          <Star className="h-3 w-3 fill-current" /> {t('pbPopular')}
                        </div>
                      </div>
                    )}

                    {/* Active indicator */}
                    <div className={cn(
                      'absolute top-0 left-0 text-xs font-bold px-3 py-1 rounded-tl-2xl rounded-br-xl flex items-center gap-1',
                      plan.isActive
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'bg-slate-500/10 text-slate-500'
                    )}>
                      <div className={cn('w-1.5 h-1.5 rounded-full', plan.isActive ? 'bg-emerald-500' : 'bg-slate-400')} />
                      {plan.isActive ? t('pbActive') : t('pbInactive')}
                    </div>

                    <CardHeader className="text-center pb-2 pt-6">
                      <div className="mx-auto mb-2 p-3 rounded-full bg-muted w-fit">
                        {plan.deploymentType === 'onprem' ? (
                          <HardDrive className="h-6 w-6 text-amber-600" />
                        ) : plan.deploymentType === 'both' ? (
                          <Blocks className="h-6 w-6 text-violet-600" />
                        ) : (
                          <Cloud className="h-6 w-6 text-emerald-600" />
                        )}
                      </div>
                      <CardTitle className="text-lg">{plan.displayName}</CardTitle>
                      <CardDescription className="text-xs line-clamp-2">{plan.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="flex-1 space-y-4">
                      {/* Price */}
                      <div className="text-center">
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-3xl font-bold">{formatCurrency(plan.monthlyPrice, plan.currency)}</span>
                          <span className="text-muted-foreground">{t('pbPerMonth')}</span>
                        </div>
                        {plan.yearlyPrice > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('pbAnnual', { price: formatCurrency(plan.yearlyPrice, plan.currency) })}
                            <Badge variant="secondary" className="text-[10px] ml-1 bg-emerald-500/10 text-emerald-600">
                              {t('pbSave2mo')}
                            </Badge>
                          </p>
                        )}
                        {plan.setupFee > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {t('pbPlusSetup', { amount: formatCurrency(plan.setupFee, plan.currency) })}
                          </p>
                        )}
                      </div>

                      <Separator />

                      {/* Limits Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <p className="text-sm font-bold">{plan.maxProperties === 9999 ? '∞' : plan.maxProperties}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{t('pbProperties')}</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <p className="text-sm font-bold">{plan.maxUsers === 999 ? '∞' : plan.maxUsers}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{t('pbUsers')}</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <p className="text-sm font-bold">{plan.maxRoomsPerProperty === 9999 ? '∞' : plan.maxRoomsPerProperty}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{t('pbRooms')}</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <p className="text-sm font-bold">{featureCount}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{t('pbModules')}</p>
                        </div>
                      </div>

                      <Separator />

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        <Badge variant="outline" className="text-[10px]">
                          <CurrencyIcon className="h-3 w-3 mr-1" />
                          {plan.currency}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {plan.deploymentType}
                        </Badge>
                        {plan.trialDays && plan.trialDays > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {t('pbDaysTrial', { days: plan.trialDays })}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">
                          {t('pbSubscribers', { count: plan.subscriberCount })}
                        </Badge>
                      </div>
                    </CardContent>

                    {/* Actions */}
                    <div className="border-t px-4 py-3 flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 gap-1.5 text-xs h-8"
                        onClick={() => openEditEditor(plan)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                        {t('pbEdit')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 gap-1.5 text-xs h-8"
                        onClick={() => handleDuplicate(plan)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {t('pbDuplicate')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 gap-1.5 text-xs h-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => { setPlanToDelete(plan); setDeleteDialogOpen(true); }}
                        disabled={plan.subscriberCount > 0}
                        title={plan.subscriberCount > 0 ? t('pbCannotDeleteSubscribers') : t('pbDeletePlan')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('pbDelete')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleToggleActive(plan)}
                        title={plan.isActive ? t('pbDeactivate') : t('pbActivate')}
                      >
                        {plan.isActive ? (
                          <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                        ) : (
                          <Eye className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════ TAB 2: PLAN EDITOR ═══════════════════ */}
        <TabsContent value="editor" className="!flex-none">
          {!isEditorOpen ? (
            <Card className="rounded-2xl border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="p-4 rounded-full bg-muted">
                  <Edit className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">{t('pbNoPlanSelected')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{t('pbNoPlanSelectedDesc')}</p>
                </div>
                <Button onClick={openCreateEditor} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('pbCreateNewPlan')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6 max-w-5xl mx-auto">
              {/* Editor Header */}
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {editingPlan ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                    {editingPlan ? t('pbEditingPlan', { name: editingPlan.displayName }) : t('pbCreateNewPlan')}
                  </CardTitle>
                  <CardDescription>
                    {editingPlan ? t('pbModifyPlanDetails') : t('pbConfigureNewPlan')}
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Editor Sections — natural page flow, no height constraint */}
              {/* Section A: Basic Info */}
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    {t('pbBasicInformation')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="displayName">{t('pbDisplayNameLabel')}</Label>
                      <Input
                        id="displayName"
                        placeholder="e.g. Professional Plan"
                        value={form.displayName}
                        onChange={(e) => {
                          setForm((p) => ({
                            ...p,
                            displayName: e.target.value,
                            name: !editingPlan ? slugify(e.target.value) : p.name,
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slug">{t('pbPlanSlug')}</Label>
                      <Input
                        id="slug"
                        placeholder="auto-generated-slug"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">{t('pbDescription')}</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of this plan..."
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>{t('pbCurrency')}</Label>
                      <Select value={form.currency} onValueChange={(v) => setForm((p) => ({ ...p, currency: v }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pbDeployment')}</Label>
                      <Select value={form.deploymentType} onValueChange={(v: 'cloud' | 'onprem' | 'both') => setForm((p) => ({ ...p, deploymentType: v }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPLOYMENT_TYPES.map((d) => (
                            <SelectItem key={d.value} value={d.value}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pbTrialDays')}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.trialDays}
                        onChange={(e) => setForm((p) => ({ ...p, trialDays: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pbSetupFee')}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.setupFee}
                        onChange={(e) => setForm((p) => ({ ...p, setupFee: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{t('pbMonthlyPrice')}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.monthlyPrice}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setForm((p) => ({ ...p, monthlyPrice: val, yearlyPrice: val * 10 }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pbYearlyPrice')}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.yearlyPrice}
                        onChange={(e) => setForm((p) => ({ ...p, yearlyPrice: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="flex items-end gap-4 pb-1">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={form.isPopular}
                          onCheckedChange={(v) => setForm((p) => ({ ...p, isPopular: v }))}
                        />
                        <Label className="text-sm flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-500" />
                          {t('pbPopular')}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={form.isCustom}
                          onCheckedChange={(v) => setForm((p) => ({ ...p, isCustom: v }))}
                        />
                        <Label className="text-sm flex items-center gap-1">
                          <Settings className="h-3.5 w-3.5 text-violet-500" />
                          {t('pbCustom')}
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section B: Base Limits */}
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-emerald-500" />
                    {t('pbBaseLimits')}
                  </CardTitle>
                  <CardDescription>{t('pbBaseLimitsDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { key: 'maxProperties' as const, label: t('pbProperties'), icon: Building2, min: 1 },
                      { key: 'maxUsers' as const, label: t('pbUsers'), icon: Users, min: 1 },
                      { key: 'maxRoomsPerProperty' as const, label: t('pbRoomsPerProperty'), icon: DoorOpen, min: 1 },
                      { key: 'maxStaff' as const, label: t('pbStaff'), icon: Users, min: 1 },
                      { key: 'storageLimitMb' as const, label: t('pbStorageMb'), icon: HardDrive, min: 100 },
                    ].map(({ key, label, icon: Icon, min }) => (
                      <div key={key} className="space-y-2">
                        <Label className="text-xs flex items-center gap-1">
                          <Icon className="h-3 w-3" />
                          {label}
                        </Label>
                        <Input
                          type="number"
                          min={min}
                          value={form[key]}
                          onChange={(e) => setForm((p) => ({ ...p, [key]: parseInt(e.target.value) || min }))}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Section C: Module Selection */}
              <Card className="rounded-2xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Blocks className="h-4 w-4 text-violet-500" />
                        {t('pbModuleSelection')}
                      </CardTitle>
                      <CardDescription className="mt-1">{t('pbModuleSelectionDesc')}</CardDescription>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                        {t('pbIncludedModules', { count: includedCount.base + includedCount.addons })}
                      </Badge>
                      <Badge variant="outline">
                        {t('pbAvailableAddons', { count: excludedAddons.length })}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {catalog && (
                    <>
                      {/* Base Features (locked) */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">{t('pbBaseModulesAlwaysEnabled')}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {t('pbModulesCount', { count: catalog.baseFeatures.length })}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {catalog.baseFeatures.map((f) => (
                            <div
                              key={f.id}
                              className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/50 border border-border/50"
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{f.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{f.description}</p>
                              </div>
                              <Lock className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Addon Features by Subcategory */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="h-4 w-4 text-violet-500" />
                          <span className="text-sm font-semibold">{t('pbAddonModules')}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {t('pbAvailable', { count: catalog.addonFeatures.length })}
                          </Badge>
                        </div>
                        <Accordion type="multiple" className="space-y-2">
                          {catalog.addonGroups.map((group) => (
                            <AccordionItem
                              key={group.subcategory}
                              value={group.subcategory}
                              className="border rounded-lg px-1"
                            >
                              <AccordionTrigger className="text-sm font-medium py-3 hover:no-underline">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-muted-foreground">
                                      {group.features.filter((f) => enabledFeatures.has(f.id)).length}/{group.features.length}
                                    </span>
                                    {group.subcategoryInfo.name}
                                  </div>
                                  {group.features.filter((f) => enabledFeatures.has(f.id)).length === group.features.length && (
                                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                                      {t('pbAllIncluded')}
                                    </Badge>
                                  )}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="pb-2 space-y-1.5">
                                {group.features.map((feature) => {
                                  const isEnabled = enabledFeatures.has(feature.id);
                                  const isExpanded = expandedFeatures.has(feature.id);
                                  const depMissing = feature.dependencies?.some(
                                    (d) => !enabledFeatures.has(d) && !catalog.baseFeatures.find((b) => b.id === d)
                                  );

                                  return (
                                    <div key={feature.id} className="space-y-1">
                                      <div
                                        className={cn(
                                          'flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer',
                                          isEnabled
                                            ? 'bg-emerald-500/5 border-emerald-500/30'
                                            : 'bg-muted/30 border-border/50 hover:bg-muted/50'
                                        )}
                                        onClick={() => toggleFeature(feature.id, feature)}
                                      >
                                        {/* Checkbox indicator */}
                                        <div className={cn(
                                          'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                                          isEnabled
                                            ? 'bg-emerald-500 border-emerald-500'
                                            : 'border-muted-foreground/40'
                                        )}>
                                          {isEnabled && <CheckCircle2 className="h-4 w-4 text-white" />}
                                        </div>

                                        {/* Feature Info */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <p className={cn('text-sm font-medium', !isEnabled && 'text-muted-foreground')}>
                                              {feature.name}
                                            </p>
                                            {feature.defaultLimits && (
                                              <Badge variant="outline" className="text-[10px]">
                                                {feature.defaultLimits.limitType}: {feature.defaultLimits.limitValue}
                                              </Badge>
                                            )}
                                            {depMissing && (
                                              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                                                {t('pbNeeds')}: {feature.dependencies?.filter(d => !enabledFeatures.has(d) && !catalog.baseFeatures.find(b => b.id === d)).join(', ')}
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="text-[11px] text-muted-foreground truncate">{feature.description}</p>
                                        </div>

                                        {/* Price */}
                                        <div className="text-right shrink-0">
                                          {isEnabled ? (
                                            <span className="text-xs font-medium text-emerald-600">{t('pbIncluded')}</span>
                                          ) : (
                                            <span className="text-xs text-muted-foreground">
                                              {addonPricing[feature.id]?.monthlyPrice
                                                ? formatCurrency(addonPricing[feature.id].monthlyPrice, form.currency)
                                                : formatCurrency(999, form.currency)}
                                              {t('pbPerMonth')}
                                            </span>
                                          )}
                                        </div>

                                        {/* Expand arrow */}
                                        {isEnabled && (
                                          <ChevronDown className={cn(
                                            'h-4 w-4 text-muted-foreground shrink-0 transition-transform',
                                            isExpanded && 'rotate-180'
                                          )} />
                                        )}
                                      </div>

                                      {/* Configure expandable */}
                                      {isEnabled && isExpanded && (
                                        <div className="ml-8 p-3 bg-muted/30 rounded-lg border border-border/50 space-y-3">
                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                              <Label className="text-xs">{t('pbAddonMonthlyPrice')}</Label>
                                              <div className="flex items-center gap-1">
                                                <span className="text-xs text-muted-foreground">{CURRENCIES.find(c => c.value === form.currency)?.symbol}</span>
                                                <Input
                                                  type="number"
                                                  min={0}
                                                  className="h-7 text-xs"
                                                  value={addonPricing[feature.id]?.monthlyPrice ?? 0}
                                                  onChange={(e) =>
                                                    setAddonPricing((prev) => ({
                                                      ...prev,
                                                      [feature.id]: {
                                                        monthlyPrice: parseFloat(e.target.value) || 0,
                                                        setupFee: prev[feature.id]?.setupFee ?? 0,
                                                      },
                                                    }))
                                                  }
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                              </div>
                                              <p className="text-[10px] text-muted-foreground">{t('pbIncludedInPlanPrice')}</p>
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-xs">{t('pbAddonSetupFee')}</Label>
                                              <div className="flex items-center gap-1">
                                                <span className="text-xs text-muted-foreground">{CURRENCIES.find(c => c.value === form.currency)?.symbol}</span>
                                                <Input
                                                  type="number"
                                                  min={0}
                                                  className="h-7 text-xs"
                                                  value={addonPricing[feature.id]?.setupFee ?? 0}
                                                  onChange={(e) =>
                                                    setAddonPricing((prev) => ({
                                                      ...prev,
                                                      [feature.id]: {
                                                        monthlyPrice: prev[feature.id]?.monthlyPrice ?? 0,
                                                        setupFee: parseFloat(e.target.value) || 0,
                                                      },
                                                    }))
                                                  }
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                              </div>
                                            </div>
                                          </div>
                                          {feature.dependencies && feature.dependencies.length > 0 && (
                                            <div className="flex items-start gap-2 p-2 rounded bg-amber-500/5 border border-amber-500/10">
                                              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                              <div className="text-[11px] text-muted-foreground">
                                                <span className="font-medium text-amber-700">{t('pbDependenciesLabel')}:</span>{' '}
                                                {feature.dependencies.map((d) => {
                                                  const depCfg = catalog.addonFeatures.find((f) => f.id === d) || catalog.baseFeatures.find((f) => f.id === d);
                                                  return depCfg?.name || d;
                                                }).join(', ')}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Section D: Module Limits Configuration */}
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    {t('pbModuleLimitsConfig')}
                  </CardTitle>
                  <CardDescription>{t('pbModuleLimitsConfigDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {moduleLimits.length === 0 ? (
                    <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                      <Info className="h-4 w-4" />
                      {t('pbEnableAddonsToConfigure')}
                    </div>
                  ) : (
                    <ScrollArea className="max-h-96">
                      <div className="space-y-3">
                        {moduleLimits.map((ml) => (
                          <div key={ml.moduleKey} className="p-3 rounded-lg border space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">{ml.moduleName}</p>
                              <Badge variant="outline" className="text-[10px]">{ml.moduleKey}</Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">{t('pbLimitType')}</Label>
                                <Select
                                  value={ml.limitType}
                                  onValueChange={(v) => updateModuleLimit(ml.moduleKey, 'limitType', v)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {LIMIT_TYPES.map((lt) => (
                                      <SelectItem key={lt.value} value={lt.value} className="text-xs">
                                        {lt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">{t('pbLimitValue')}</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-8 text-xs"
                                  value={ml.limitValue}
                                  onChange={(e) => updateModuleLimit(ml.moduleKey, 'limitValue', parseInt(e.target.value) || 0)}
                                />
                              </div>
                              <div className="space-y-1 flex items-end">
                                <div className="flex items-center gap-2 pb-1">
                                  <Switch
                                    checked={ml.hardLimit}
                                    onCheckedChange={(v) => updateModuleLimit(ml.moduleKey, 'hardLimit', v)}
                                  />
                                  <Label className="text-xs">{t('pbHardLimit')}</Label>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">{t('pbWarningThreshold', { threshold: ml.warningThreshold })}</Label>
                                <Slider
                                  value={[ml.warningThreshold]}
                                  onValueChange={([v]) => updateModuleLimit(ml.moduleKey, 'warningThreshold', v)}
                                  min={50}
                                  max={100}
                                  step={5}
                                  className="py-1"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Section E: Add-on Pricing */}
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                    {t('pbAddonPricing')}
                  </CardTitle>
                  <CardDescription>
                    {t('pbAddonPricingDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {excludedAddons.length === 0 ? (
                    <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                      <Info className="h-4 w-4" />
                      {t('pbAllModulesIncluded')}
                    </div>
                  ) : (
                    <ScrollArea className="max-h-96">
                      <div className="space-y-2">
                        {excludedAddons.map((addon) => (
                          <div key={addon.id} className="flex items-center gap-3 p-3 rounded-lg border">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{addon.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{addon.description}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="space-y-1 w-28">
                                <Label className="text-[10px] text-muted-foreground">{t('pbMonthlyPriceLabel')}</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-7 text-xs"
                                  value={addonPricing[addon.id]?.monthlyPrice ?? 999}
                                  onChange={(e) =>
                                    setAddonPricing((prev) => ({
                                      ...prev,
                                      [addon.id]: {
                                        monthlyPrice: parseFloat(e.target.value) || 0,
                                        setupFee: prev[addon.id]?.setupFee ?? 0,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1 w-28">
                                <Label className="text-[10px] text-muted-foreground">{t('pbSetupFeeLabel')}</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-7 text-xs"
                                  value={addonPricing[addon.id]?.setupFee ?? 0}
                                  onChange={(e) =>
                                    setAddonPricing((prev) => ({
                                      ...prev,
                                      [addon.id]: {
                                        monthlyPrice: prev[addon.id]?.monthlyPrice ?? 999,
                                        setupFee: parseFloat(e.target.value) || 0,
                                      },
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* End editor sections */}

              {/* Save / Cancel Buttons — always at bottom of page */}
              <div className="flex items-center justify-between gap-4 pt-6 pb-8 border-t mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditorOpen(false);
                    resetForm();
                    setActiveTab('all-plans');
                  }}
                >
                  {t('pbCancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !form.displayName.trim()}
                  className="gap-2 min-w-[140px]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('pbSaving')}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      {editingPlan ? t('pbUpdatePlan') : t('pbCreatePlan')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ──── DELETE CONFIRMATION DIALOG ──── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pbDeletePlan')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pbDeletePlanConfirm', { name: planToDelete?.displayName ?? '' })}
              {planToDelete && planToDelete.subscriberCount > 0 && (
                <span className="block mt-2 text-red-600 font-medium">
                  {t('pbCannotDeleteHasSubscribers', { count: planToDelete.subscriberCount })}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('pbCancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={planToDelete ? planToDelete.subscriberCount > 0 : false}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t('pbDeletePlan')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
