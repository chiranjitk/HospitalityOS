'use client';

import { useTranslations } from 'next-intl';
import React, { useState, useEffect, useMemo } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Crown,
  Zap,
  Rocket,
  Building2,
  Check,
  X,
  Plus,
  Edit,
  Loader2,
  RefreshCw,
  Users,
  Home,
  DoorOpen,
  Database,
  Sparkles,
  Shield,
  BarChart3,
  Clock,
  Cloud,
  HardDrive,
  Wifi,
  Globe,
  TrendingUp,
  Star,
  Target,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  IndianRupee,
  CheckCircle2,
  XCircle,
  ArrowRight,
  MonitorSmartphone,
  Radio,
  Lock,
  Utensils,
  Megaphone,
  CalendarDays,
  UserCog,
  Camera,
  Cpu,
  Bot,
  Workflow,
  Link2,
  CircleDollarSign,
  Hotel,
  LineChart,
  Gift,
  Wrench,
  Hammer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import dynamic from 'next/dynamic';

const PlanBuilder = dynamic(() => import('@/components/billing/plan-builder'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

/* ──────────────────────── TYPES ──────────────────────── */

interface PlanFeature {
  name: string;
  included: boolean;
  limit?: string;
}

interface SaaSPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: number;
  yearlyPrice: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly';
  deploymentType: 'cloud' | 'onprem';
  setupFee: number;
  maxProperties: number;
  maxUsers: number;
  maxRooms: number;
  storageLimitMb: number;
  features: PlanFeature[];
  addonModules: AddonModuleDef[];
  isPopular?: boolean;
  isCustom?: boolean;
  status: string;
  subscriberCount: number;
  sortOrder: number;
}

interface AddonModuleDef {
  name: string;
  price: number;
  cloud: boolean;
  onPrem: boolean;
  category: string;
}

/* ──────────────────────── STATIC DATA ──────────────────────── */

const marketData = {
  indiaHospitality: { value2025: 24.36, value2026: 27.96, unit: 'Billion USD' },
  globalPMS: { value2026: 5.74, cagr: 8.8, unit: 'Billion USD' },
  cloudPMSRevenue: 2.4,
  cloudPMSPercent: 65,
  indiaRooms: '3.5M+',
  aiAdoption: 60,
  techBudgetExpansion: 76,
  gstHotel: '5% (≤₹7,500/day)',
  gstSaaS: '18%',
};

const competitors = [
  { name: 'Hotelogix', pricing: '₹330–₹500/room/mo', modules: 10, wifi: false, gateway: false, onPrem: false, deployment: 'Cloud' },
  { name: 'eZee Absolute', pricing: '₹4,500–₹15,000/mo', modules: 12, wifi: false, gateway: false, onPrem: false, deployment: 'Cloud' },
  { name: 'Cloudbeds', pricing: '$50–80/mo (<20 rooms)', modules: 11, wifi: false, gateway: false, onPrem: false, deployment: 'Cloud' },
  { name: 'DJUBO', pricing: '₹2,639–₹8,000/mo', modules: 8, wifi: false, gateway: false, onPrem: false, deployment: 'Cloud' },
  { name: 'Oracle OPERA', pricing: '$22,855+ setup', modules: 15, wifi: false, gateway: false, onPrem: true, deployment: 'On-Prem/Cloud' },
];

const wifiCompetitors = [
  { name: 'Spotipo', pricing: '$59–$79/location/mo', type: 'Cloud captive portal' },
  { name: 'StayFi', pricing: '$15–$19/month', type: 'Cloud WiFi marketing' },
  { name: 'YesSpot', pricing: '$0.15–0.25/user', type: 'Cloud hotspot (MikroTik)' },
  { name: 'Nomadix EG1000', pricing: '$999+ hardware', type: 'On-premise gateway' },
  { name: 'MikroTik Router', pricing: '₹6,000 one-time', type: 'Hardware only' },
];

const DEFAULT_ADDON_MODULES: AddonModuleDef[] = [
  { name: 'WiFi RADIUS (Cloud)', price: 1499, cloud: true, onPrem: true, category: 'network', icon: Radio },
  { name: 'WiFi Gateway (On-Prem only)', price: 3999, cloud: false, onPrem: true, category: 'network', icon: Wifi },
  { name: 'Room VLAN Isolation', price: 999, cloud: false, onPrem: true, category: 'network', icon: Lock },
  { name: 'ZTNA Security', price: 999, cloud: false, onPrem: true, category: 'network', icon: Shield },
  { name: 'POS & Restaurant', price: 1999, cloud: true, onPrem: true, category: 'operations', icon: Utensils },
  { name: 'Staff Management', price: 999, cloud: true, onPrem: true, category: 'operations', icon: UserCog },
  { name: 'Surveillance', price: 1999, cloud: true, onPrem: true, category: 'operations', icon: Camera },
  { name: 'Chain Management', price: 2499, cloud: true, onPrem: true, category: 'operations', icon: Link2 },
  { name: 'Revenue Management', price: 1499, cloud: true, onPrem: true, category: 'revenue', icon: LineChart },
  { name: 'Channel Manager', price: 1499, cloud: true, onPrem: true, category: 'revenue', icon: Globe },
  { name: 'CRM & Marketing', price: 999, cloud: true, onPrem: true, category: 'revenue', icon: Users },
  { name: 'Digital Advertising', price: 999, cloud: true, onPrem: true, category: 'revenue', icon: Megaphone },
  { name: 'Guest Experience Module', price: 999, cloud: true, onPrem: true, category: 'experience', icon: Star },
  { name: 'Events / MICE', price: 999, cloud: true, onPrem: true, category: 'experience', icon: CalendarDays },
  { name: 'IoT Smart Hotel', price: 1499, cloud: true, onPrem: true, category: 'intelligence', icon: Cpu },
  { name: 'AI Assistant', price: 1999, cloud: true, onPrem: true, category: 'intelligence', icon: Bot },
  { name: 'Automation & Workflows', price: 999, cloud: true, onPrem: true, category: 'intelligence', icon: Workflow },
];

const categoryLabels: Record<string, { label: string; icon: React.ElementType }> = {
  network: { label: 'Network & Security', icon: Shield },
  operations: { label: 'Operations', icon: Wrench },
  revenue: { label: 'Revenue & Growth', icon: CircleDollarSign },
  experience: { label: 'Guest Experience', icon: Star },
  intelligence: { label: 'Intelligence & AI', icon: Sparkles },
};

const gatewayHardware = [
  {
    id: 'mikrotik-base',
    name: 'MikroTik Base',
    tier: 'Entry',
    price: 45000,
    maxRooms: 30,
    features: ['MikroTik hAP ac³', 'RADIUS Server', 'Captive Portal', 'Basic Bandwidth Mgmt'],
    missing: ['VLAN Isolation'],
  },
  {
    id: 'intel-nuc-standard',
    name: 'Intel NUC Standard',
    tier: 'Recommended',
    price: 75000,
    maxRooms: 80,
    features: ['Intel NUC i5 + 16GB RAM', 'Full RADIUS + Captive Portal', 'Advanced Bandwidth Mgmt', 'Room VLAN Isolation', 'ZTNA Security'],
    missing: [],
  },
  {
    id: 'intel-nuc-premium',
    name: 'Intel NUC Premium',
    tier: 'Enterprise',
    price: 120000,
    maxRooms: 200,
    features: ['Intel NUC i7 + 32GB RAM', 'Full Gateway Suite', 'Advanced VLAN + ZTNA', 'IoT Bridge Support', 'Redundant Configuration', 'Priority Hardware Support'],
    missing: [],
  },
];

/* ──────────────────────── HELPERS ──────────────────────── */

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

/* ──────────────────────── MAIN COMPONENT ──────────────────────── */

export default function SaaSPlans() {
  const t = useTranslations('billing');
  const { toast } = useToast();
  const { formatCurrency, currency } = useCurrency();
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [tenants, setTenants] = useState<Array<{ id: string; plan: string; name: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SaaSPlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [showWifiCompetitors, setShowWifiCompetitors] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [selectedHardware, setSelectedHardware] = useState<string>('intel-nuc-standard');
  const [addonModules, setAddonModules] = useState<AddonModuleDef[]>(DEFAULT_ADDON_MODULES);
  const [editingAddonName, setEditingAddonName] = useState<string | null>(null);
  const [editingAddonPrice, setEditingAddonPrice] = useState<string>('');
  const [isSavingAddons, setIsSavingAddons] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    displayName: '',
    description: '',
    price: '',
    maxProperties: '',
    maxUsers: '',
    maxRooms: '',
    storageLimitMb: '',
  });

  // Fetch plans
  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const plansResponse = await fetch('/api/admin/plans');
      const plansResult = await plansResponse.json();
      if (plansResult.success) {
        setPlans(plansResult.data);
      } else {
        throw new Error(plansResult.error || 'Failed to fetch plans');
      }
      try {
        const tenantsResponse = await fetch('/api/admin/tenants');
        const tenantsResult = await tenantsResponse.json();
        if (tenantsResult.success) {
          setTenants(tenantsResult.data.tenants);
          if (!selectedTenantId && tenantsResult.data.tenants.length > 0) {
            setSelectedTenantId(tenantsResult.data.tenants[0].id);
          }
        }
      } catch { /* Non-critical */ }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch plan data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  // Computed
  const cloudPlans = useMemo(() => plans.filter(p => p.deploymentType === 'cloud'), [plans]);
  const onPremPlans = useMemo(() => plans.filter(p => p.deploymentType === 'onprem'), [plans]);
  const totalSubscribers = plans.reduce((sum, p) => sum + p.subscriberCount, 0);
  const totalRevenue = plans.reduce((sum, p) => sum + (p.price * p.subscriberCount), 0);

  // Add-on toggle
  const toggleAddon = (name: string) => {
    setSelectedAddons(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  // Addon price editing
  const startEditAddon = (mod: AddonModuleDef) => {
    setEditingAddonName(mod.name);
    setEditingAddonPrice(mod.price.toString());
  };

  const saveAddonPrice = (name: string) => {
    const newPrice = parseFloat(editingAddonPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      toast({ title: 'Invalid Price', description: 'Enter a valid price', variant: 'destructive' });
      return;
    }
    setAddonModules(prev => prev.map(m => m.name === name ? { ...m, price: newPrice } : m));
    setEditingAddonName(null);
    setEditingAddonPrice('');
    toast({ title: 'Price Updated', description: `${name} → ${formatINR(newPrice)}/mo` });
  };

  const cancelEditAddon = () => {
    setEditingAddonName(null);
    setEditingAddonPrice('');
  };

  const resetAddonPrices = () => {
    setAddonModules(DEFAULT_ADDON_MODULES);
    toast({ title: 'Reset', description: 'All addon prices reset to defaults' });
  };

  // Calculator total
  const calculatorTotal = useMemo(() => {
    const addonsCost = addonModules
      .filter(m => selectedAddons.has(m.name))
      .reduce((sum, m) => sum + m.price, 0);
    const hw = gatewayHardware.find(h => h.id === selectedHardware);
    return { addonsMonthly: addonsCost, hardwareOneTime: hw?.price || 0 };
  }, [selectedAddons, selectedHardware, addonModules]);

  // Update plan
  const handleUpdate = async () => {
    if (!selectedPlan) return;
    setIsSaving(true);
    try {
      const updatedValues = {
        displayName: formData.displayName,
        description: formData.description,
        price: parseFloat(formData.price) || selectedPlan.price,
        maxProperties: parseInt(formData.maxProperties) || selectedPlan.maxProperties,
        maxUsers: parseInt(formData.maxUsers) || selectedPlan.maxUsers,
        maxRooms: parseInt(formData.maxRooms) || selectedPlan.maxRooms,
        storageLimitMb: parseInt(formData.storageLimitMb) || selectedPlan.storageLimitMb,
      };
      const response = await fetch(`/api/admin/plans/${selectedPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedValues),
      });
      const result = await response.json();
      if (result.success) {
        setPlans(plans.map(p => p.id === selectedPlan.id ? { ...p, ...updatedValues } : p));
        toast({ title: 'Success', description: result.message || 'Plan updated successfully' });
        setIsEditOpen(false);
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to update plan', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update plan', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Subscribe tenant
  const handleSubscribe = async (planId: string) => {
    if (!selectedTenantId) {
      toast({ title: 'No Tenant Selected', description: 'Please select a tenant first.', variant: 'destructive' });
      return;
    }
    setSubscribingPlanId(planId);
    try {
      const plan = plans.find(p => p.id === planId);
      if (!plan) return;
      const response = await fetch('/api/admin/tenants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTenantId,
          plan: plan.name,
          limits: { properties: plan.maxProperties, users: plan.maxUsers, rooms: plan.maxRooms, storage: plan.storageLimitMb },
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Plan changed', description: `Tenant updated to ${plan.displayName} plan.` });
        fetchPlans();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to update plan', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update plan', variant: 'destructive' });
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const editPlan = (plan: SaaSPlan) => {
    setSelectedPlan(plan);
    setFormData({
      displayName: plan.displayName,
      description: plan.description,
      price: plan.price.toString(),
      maxProperties: plan.maxProperties.toString(),
      maxUsers: plan.maxUsers.toString(),
      maxRooms: plan.maxRooms.toString(),
      storageLimitMb: plan.storageLimitMb.toString(),
    });
    setIsEditOpen(true);
  };

  const getPlanIcon = (plan: SaaSPlan) => {
    if (plan.deploymentType === 'onprem') return <HardDrive className="h-6 w-6" />;
    if (plan.name.includes('enterprise')) return <Crown className="h-6 w-6" />;
    if (plan.name.includes('professional')) return <Rocket className="h-6 w-6" />;
    if (plan.name.includes('starter')) return <Zap className="h-6 w-6" />;
    return <Cloud className="h-6 w-6" />;
  };

  const getPlanColor = (plan: SaaSPlan) => {
    if (plan.deploymentType === 'onprem') return 'text-amber-600 dark:text-amber-400';
    if (plan.name.includes('enterprise')) return 'text-amber-600 dark:text-amber-400';
    if (plan.name.includes('professional')) return 'text-orange-600 dark:text-orange-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  /* ──────────── RENDER ──────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            SaaS Plans & Licensing
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage pricing, plans, and add-ons for the Indian hospitality market
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPlans}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Users className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalSubscribers}</div>
              <div className="text-xs text-muted-foreground">Total Subscribers</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <BarChart3 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatINR(totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">Monthly Revenue</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Building2 className="h-4 w-4 text-orange-500 dark:text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{plans.filter(p => p.subscriberCount > 0).length}</div>
              <div className="text-xs text-muted-foreground">Active Plans</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Wifi className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{onPremPlans.reduce((s, p) => s + p.subscriberCount, 0)}</div>
              <div className="text-xs text-muted-foreground">On-Prem (Gateway)</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tenant Selector */}
      {tenants.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium">Subscribe Tenant</Label>
              <p className="text-xs text-muted-foreground mb-2">Select which tenant to assign a plan to</p>
              <Select value={selectedTenantId || ''} onValueChange={setSelectedTenantId}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Select a tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map(tenant => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.plan})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="plans" className="space-y-6">
        <TabsList className="h-auto p-1 bg-muted/50 flex-wrap">
          <TabsTrigger value="plans" className="gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <Package className="h-4 w-4" /> Plans
          </TabsTrigger>
          <TabsTrigger value="market" className="gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <BarChart3 className="h-4 w-4" /> Market Intel
          </TabsTrigger>
          <TabsTrigger value="addons" className="gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <Layers className="h-4 w-4" /> Add-On Modules
          </TabsTrigger>
          <TabsTrigger value="hardware" className="gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <MonitorSmartphone className="h-4 w-4" /> Gateway Hardware
          </TabsTrigger>
          <TabsTrigger value="calculator" className="gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <IndianRupee className="h-4 w-4" /> Calculator
          </TabsTrigger>
          <TabsTrigger value="builder" className="gap-2 data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
            <Hammer className="h-4 w-4" /> Plan Builder
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════ PLANS TAB ═══════════════════ */}
        <TabsContent value="plans">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Cloud Plans */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Cloud className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Cloud Plans</h3>
                    <p className="text-xs text-muted-foreground">RADIUS authentication only · No gateway · Hosted infrastructure</p>
                  </div>
                </div>
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                  {cloudPlans.map(plan => (
                    <Card
                      key={plan.id}
                      className={cn(
                        'relative flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
                        plan.isPopular ? 'border-amber-500/50 shadow-md shadow-amber-500/10' : 'border-border/40'
                      )}
                    >
                      {plan.isPopular && (
                        <div className="absolute top-0 right-0">
                          <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                            <Star className="h-3 w-3" /> Popular
                          </div>
                        </div>
                      )}
                      <CardHeader className="text-center pb-2">
                        <div className={cn('mx-auto mb-2 p-3 rounded-full bg-muted', getPlanColor(plan))}>
                          {getPlanIcon(plan)}
                        </div>
                        <CardTitle className="text-lg">{plan.displayName}</CardTitle>
                        <CardDescription className="text-xs">{plan.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <div className="text-center mb-4">
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-bold">{formatINR(plan.price)}</span>
                            <span className="text-muted-foreground">/month</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Annual: {formatINR(plan.yearlyPrice)}/yr <Badge variant="secondary" className="text-[10px] ml-1 bg-emerald-500/10 text-emerald-600">Save 2mo</Badge>
                          </p>
                          <p className="text-xs text-muted-foreground">{plan.subscriberCount} subscribers</p>
                        </div>
                        <Separator className="my-3" />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-sm font-bold">{plan.maxProperties}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">Properties</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-sm font-bold">{plan.maxUsers}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">Users</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-sm font-bold">{plan.maxRooms === 9999 ? '∞' : plan.maxRooms}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">Rooms</p>
                          </div>
                        </div>
                        <Separator className="my-3" />
                        <ScrollArea className="h-36">
                          <div className="space-y-1.5">
                            {plan.features.map((feature, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                {feature.included ? (
                                  <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                ) : (
                                  <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                                <span className={feature.included ? '' : 'text-muted-foreground'}>{feature.name}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                      <CardFooter className="flex flex-col gap-2">
                        <Button
                          className="w-full"
                          variant={plan.isPopular ? 'default' : 'outline'}
                          disabled={subscribingPlanId === plan.id}
                          onClick={() => handleSubscribe(plan.id)}
                        >
                          {subscribingPlanId === plan.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
                          Subscribe
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => editPlan(plan)}>
                          <Edit className="h-3 w-3 mr-2" /> Edit Plan
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>

                {/* Cloud limitation note */}
                <Card className="mt-4 border-border/40">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Cloud Deployment Limitation</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Cloud deployment only supports RADIUS authentication. Full WiFi Gateway (Captive Portal, Bandwidth Management, Room VLAN, ZTNA) requires the On-Premise box. This is a network architecture constraint — not a product limitation.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* On-Prem Plans */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                    <HardDrive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">On-Premise Plans</h3>
                    <p className="text-xs text-muted-foreground">Full WiFi Gateway + Captive Portal + VLAN + ZTNA · Data sovereignty</p>
                  </div>
                </div>
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
                  {onPremPlans.map(plan => (
                    <Card
                      key={plan.id}
                      className={cn(
                        'relative flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
                        plan.isPopular ? 'border-amber-500/50 shadow-md shadow-amber-500/10' : 'border-border/40'
                      )}
                    >
                      {plan.isPopular && (
                        <div className="absolute top-0 right-0">
                          <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                            <Crown className="h-3 w-3" /> Recommended
                          </div>
                        </div>
                      )}
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          <div className={cn('p-3 rounded-full bg-muted', getPlanColor(plan))}>
                            {getPlanIcon(plan)}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{plan.displayName}</CardTitle>
                            <CardDescription className="text-xs">{plan.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <div className="mb-4">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold">{formatINR(plan.price)}</span>
                            <span className="text-muted-foreground">/month</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-700 dark:text-amber-400">
                              + {formatINR(plan.setupFee)} one-time setup
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Annual: {formatINR(plan.yearlyPrice)}/yr <Badge variant="secondary" className="text-[10px] ml-1 bg-emerald-500/10 text-emerald-600">Save 2mo</Badge>
                          </p>
                          <p className="text-xs text-muted-foreground">{plan.subscriberCount} subscribers</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-sm font-bold">{plan.maxProperties === 999 ? '∞' : plan.maxProperties}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">Properties</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-sm font-bold">{plan.maxUsers === 999 ? '∞' : plan.maxUsers}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">Users</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-sm font-bold">{plan.maxRooms === 9999 ? '∞' : plan.maxRooms}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">Rooms</p>
                          </div>
                        </div>
                        <Separator className="my-3" />
                        <ScrollArea className="h-40">
                          <div className="space-y-1.5">
                            {plan.features.map((feature, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                {feature.included ? (
                                  <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                ) : (
                                  <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                                <span className={feature.included ? '' : 'text-muted-foreground'}>{feature.name}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                      <CardFooter className="flex flex-col gap-2">
                        <Button
                          className="w-full bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20"
                          disabled={subscribingPlanId === plan.id}
                          onClick={() => handleSubscribe(plan.id)}
                        >
                          {subscribingPlanId === plan.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
                          Contact Sales
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => editPlan(plan)}>
                          <Edit className="h-3 w-3 mr-2" /> Edit Plan
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════ MARKET INTEL TAB ═══════════════════ */}
        <TabsContent value="market">
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Building2} label="India Hospitality Market (2026)" value="$27.96B" change="+14.8% YoY" changeType="up" sub="from $24.36B in 2025" />
              <StatCard icon={Globe} label="Global Hotel PMS Market (2026)" value="$5.74B" change="CAGR 8.8%" changeType="up" sub="Cloud: 65% of revenue" />
              <StatCard icon={Users} label="India Hotel Rooms" value="3.5M+" change="76% expanding tech" changeType="up" sub="budgets growing" />
              <StatCard icon={Sparkles} label="AI Adoption Rate" value="60%" change="of hotels planning AI" changeType="up" sub="within coming years" />
            </div>

            {/* Market Segmentation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/20 dark:to-orange-950/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Hotel className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <CardTitle className="text-lg">Budget Hotels</CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground">60% of Indian market</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> Price-sensitive, need affordable PMS</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> WiFi is primary tech need</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> GST: 5% on rooms ≤₹7,500/day</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="border-orange-500/20 bg-gradient-to-br from-orange-50/80 to-amber-50/80 dark:from-orange-950/20 dark:to-amber-950/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    <CardTitle className="text-lg">Midscale Hotels</CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground">25% of Indian market</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" /> Growing tech budgets rapidly</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" /> Need integrated PMS + WiFi</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" /> Ideal for Professional plan</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/80 to-yellow-50/80 dark:from-amber-950/20 dark:to-yellow-950/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <CardTitle className="text-lg">Luxury Hotels</CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground">15% of Indian market</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> Demand full gateway + VLAN</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> On-prem data sovereignty</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> Ideal for Enterprise On-Prem</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Competitor Comparison */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Competitor Pricing Benchmark</h3>
                  <p className="text-xs text-muted-foreground">How StaySuite compares to Indian PMS market leaders</p>
                </div>
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-3 px-4 font-semibold">Product</th>
                          <th className="text-left py-3 px-4 font-semibold">Pricing</th>
                          <th className="text-center py-3 px-4 font-semibold">Modules</th>
                          <th className="text-center py-3 px-4 font-semibold">Deployment</th>
                          <th className="text-center py-3 px-4 font-semibold">WiFi</th>
                          <th className="text-center py-3 px-4 font-semibold">Gateway</th>
                          <th className="text-center py-3 px-4 font-semibold">On-Prem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {competitors.map(c => (
                          <tr key={c.name} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4 font-medium">{c.name}</td>
                            <td className="py-3 px-4 text-muted-foreground">{c.pricing}</td>
                            <td className="py-3 px-4 text-center">{c.modules}</td>
                            <td className="py-3 px-4 text-center"><Badge variant="secondary" className="text-xs">{c.deployment}</Badge></td>
                            <td className="py-3 px-4 text-center">{c.wifi ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}</td>
                            <td className="py-3 px-4 text-center">{c.gateway ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}</td>
                            <td className="py-3 px-4 text-center">{c.onPrem ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}</td>
                          </tr>
                        ))}
                        <tr className="bg-amber-500/5 border-b-0">
                          <td className="py-3 px-4 font-bold text-amber-700 dark:text-amber-400">StaySuite</td>
                          <td className="py-3 px-4 font-medium text-amber-700 dark:text-amber-400">₹4,999–₹24,999/mo</td>
                          <td className="py-3 px-4 text-center font-bold text-amber-700 dark:text-amber-400">31+</td>
                          <td className="py-3 px-4 text-center"><Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0 text-xs">Cloud + On-Prem</Badge></td>
                          <td className="py-3 px-4 text-center"><CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                          <td className="py-3 px-4 text-center"><CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                          <td className="py-3 px-4 text-center"><CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* WiFi Competitor Gap */}
              <Card className="mt-4 border-amber-500/30 bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <CardTitle className="text-lg">WiFi/Gateway — The Competitor Gap</CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowWifiCompetitors(!showWifiCompetitors)} className="text-amber-700 dark:text-amber-400">
                      {showWifiCompetitors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {showWifiCompetitors ? 'Hide' : 'Show'} WiFi Solutions
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No Indian PMS includes WiFi gateway. Hotels pay extra — StaySuite is the only integrated solution.
                  </p>
                </CardHeader>
                {showWifiCompetitors && (
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-amber-200/30 dark:border-amber-800/30">
                            <th className="text-left py-2 px-3 font-semibold">WiFi Solution</th>
                            <th className="text-left py-2 px-3 font-semibold">Pricing</th>
                            <th className="text-left py-2 px-3 font-semibold">Type</th>
                            <th className="text-center py-2 px-3 font-semibold">Integrated PMS?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wifiCompetitors.map(w => (
                            <tr key={w.name} className="border-b last:border-0 border-amber-200/20 dark:border-amber-800/20">
                              <td className="py-2 px-3 font-medium">{w.name}</td>
                              <td className="py-2 px-3 text-muted-foreground">{w.pricing}</td>
                              <td className="py-2 px-3"><Badge variant="outline" className="text-xs">{w.type}</Badge></td>
                              <td className="py-2 px-3 text-center"><XCircle className="h-4 w-4 text-red-400 mx-auto" /></td>
                            </tr>
                          ))}
                          <tr className="bg-amber-500/10">
                            <td className="py-2 px-3 font-bold text-amber-700 dark:text-amber-400">StaySuite Gateway</td>
                            <td className="py-2 px-3 font-medium text-amber-700 dark:text-amber-400">Included in On-Prem plans</td>
                            <td className="py-2 px-3"><Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0 text-xs">Full Gateway</Badge></td>
                            <td className="py-2 px-3 text-center"><CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>

            {/* GST Info */}
            <Card className="border-border/40">
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex items-center gap-3 flex-1 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                      <IndianRupee className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Hotel Room GST</p>
                      <p className="text-xs text-muted-foreground">5% for tariffs ≤₹7,500/day</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-1 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                      <IndianRupee className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">SaaS GST</p>
                      <p className="text-xs text-muted-foreground">18% applicable on all cloud subscriptions</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════ ADD-ON MODULES TAB ═══════════════════ */}
        <TabsContent value="addons">
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Add-On Modules</h3>
                  <p className="text-xs text-muted-foreground">{addonModules.length} add-on modules · Click price to edit</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={resetAddonPrices}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Reset Prices
              </Button>
            </div>
            {(['network', 'operations', 'revenue', 'experience', 'intelligence'] as const).map(cat => {
              const catInfo = categoryLabels[cat];
              const CatIcon = catInfo.icon;
              const modules = addonModules.filter(m => m.category === cat);
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <CatIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{catInfo.label}</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {modules.map(mod => {
                      const ModIcon = mod.icon;
                      const isEditing = editingAddonName === mod.name;
                      return (
                        <Card key={mod.name} className={cn("transition-all duration-200 hover:shadow-md hover:border-amber-500/30", isEditing && "border-amber-500 shadow-md shadow-amber-500/10")}>
                          <CardContent className="pt-4 pb-4 px-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
                                <ModIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium leading-tight">{mod.name}</p>
                                {isEditing ? (
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <span className="text-sm text-muted-foreground">₹</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      className="h-7 text-sm w-24 px-1.5"
                                      value={editingAddonPrice}
                                      onChange={(e) => setEditingAddonPrice(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveAddonPrice(mod.name);
                                        if (e.key === 'Escape') cancelEditAddon();
                                      }}
                                      autoFocus
                                    />
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-500/10" onClick={() => saveAddonPrice(mod.name)}>
                                      <Check className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10" onClick={cancelEditAddon}>
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    className="text-lg font-bold mt-1 hover:text-amber-600 transition-colors cursor-pointer group text-left"
                                    onClick={() => startEditAddon(mod)}
                                    title="Click to edit price"
                                  >
                                    {formatINR(mod.price)}<span className="text-xs font-normal text-muted-foreground">/mo</span>
                                    <Edit className="h-3 w-3 ml-1.5 inline opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                  </button>
                                )}
                                <div className="flex gap-1.5 mt-1.5">
                                  {mod.cloud && <Badge variant="secondary" className="text-[10px]"><Cloud className="h-2.5 w-2.5 mr-0.5" />Cloud</Badge>}
                                  {mod.onPrem && <Badge variant="outline" className="text-[10px]"><HardDrive className="h-2.5 w-2.5 mr-0.5" />On-Prem</Badge>}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ═══════════════════ GATEWAY HARDWARE TAB ═══════════════════ */}
        <TabsContent value="hardware">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                <MonitorSmartphone className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Gateway Hardware</h3>
                <p className="text-xs text-muted-foreground">On-premise hardware for full WiFi gateway capabilities</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {gatewayHardware.map((hw) => (
                <Card
                  key={hw.id}
                  className={cn(
                    'transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
                    hw.tier === 'Recommended' ? 'border-amber-500/50 shadow-md shadow-amber-500/10 relative overflow-hidden' : 'border-border/40'
                  )}
                >
                  {hw.tier === 'Recommended' && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                        <Star className="h-3 w-3" /> Popular
                      </div>
                    </div>
                  )}
                  <CardHeader>
                    <Badge
                      variant={hw.tier === 'Recommended' ? 'default' : 'outline'}
                      className={cn('w-fit text-xs', hw.tier === 'Recommended' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0' : '')}
                    >
                      {hw.tier}
                    </Badge>
                    <CardTitle className="text-lg">{hw.name}</CardTitle>
                    <CardDescription>For properties ≤{hw.maxRooms} rooms</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-2xl font-bold">{formatINR(hw.price)} <span className="text-sm font-normal text-muted-foreground">one-time</span></p>
                    <Separator />
                    <ul className="space-y-2 text-sm">
                      {hw.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> {f}</li>
                      ))}
                      {hw.missing.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-muted-foreground"><XCircle className="h-3.5 w-3.5" /> {f}</li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant={hw.tier === 'Recommended' ? 'default' : 'outline'}
                      className={cn('w-full', hw.tier === 'Recommended' ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20' : '')}
                    >
                      Configure
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════ CALCULATOR TAB ═══════════════════ */}
        <TabsContent value="calculator">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                <IndianRupee className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Pricing Calculator</h3>
                <p className="text-xs text-muted-foreground">Estimate total monthly cost with add-ons and hardware</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Base Plan Selection */}
              <Card className="border-border/40">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4 text-amber-500" /> 1. Select Base Plan
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {plans.map(plan => (
                    <button
                      key={plan.id}
                      className="w-full text-left p-3 rounded-lg border border-border/40 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all"
                      onClick={() => {
                        // Toggle plan selection — this is a simple calculator, not real subscription
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{plan.displayName}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {plan.deploymentType === 'cloud' ? (
                              <Badge variant="secondary" className="text-[10px]"><Cloud className="h-2.5 w-2.5 mr-0.5" />Cloud</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]"><HardDrive className="h-2.5 w-2.5 mr-0.5" />On-Prem</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{formatINR(plan.price)}/mo</p>
                          {plan.setupFee > 0 && <p className="text-[10px] text-muted-foreground">+{formatINR(plan.setupFee)} setup</p>}
                        </div>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Add-Ons Selection */}
              <Card className="border-border/40">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-4 w-4 text-amber-500" /> 2. Select Add-Ons
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {addonModules.map(mod => (
                        <button
                          key={mod.name}
                          className={cn(
                            'w-full text-left p-2.5 rounded-lg border transition-all',
                            selectedAddons.has(mod.name)
                              ? 'border-amber-500/50 bg-amber-500/5'
                              : 'border-border/40 hover:border-amber-500/30'
                          )}
                          onClick={() => toggleAddon(mod.name)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {selectedAddons.has(mod.name) ? (
                                <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
                              )}
                              <span className="text-xs font-medium">{mod.name}</span>
                            </div>
                            <span className="text-xs font-bold">{formatINR(mod.price)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Hardware + Summary */}
              <div className="space-y-4">
                <Card className="border-border/40">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MonitorSmartphone className="h-4 w-4 text-amber-500" /> 3. Gateway Hardware
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {gatewayHardware.map(hw => (
                      <button
                        key={hw.id}
                        className={cn(
                          'w-full text-left p-2.5 rounded-lg border transition-all',
                          selectedHardware === hw.id
                            ? 'border-amber-500/50 bg-amber-500/5'
                            : 'border-border/40 hover:border-amber-500/30'
                        )}
                        onClick={() => setSelectedHardware(hw.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium">{hw.name}</p>
                            <p className="text-[10px] text-muted-foreground">≤{hw.maxRooms} rooms</p>
                          </div>
                          <span className="text-xs font-bold">{formatINR(hw.price)}</span>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                {/* Summary */}
                <Card className="border-amber-500/30 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <IndianRupee className="h-4 w-4 text-amber-500" /> Estimated Cost
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Add-Ons Monthly</span>
                      <span className="font-bold">{formatINR(calculatorTotal.addonsMonthly)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Hardware (one-time)</span>
                      <span className="font-bold">{formatINR(calculatorTotal.hardwareOneTime)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Add-Ons + GST (18%)</span>
                      <span className="font-bold">{formatINR(Math.round(calculatorTotal.addonsMonthly * 1.18))}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">* Base plan price not included. Select a base plan above and add to this total.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════ PLAN BUILDER TAB ═══════════════════ */}
        <TabsContent value="builder">
          <PlanBuilder />
        </TabsContent>
      </Tabs>

      {/* Edit Plan Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Plan: {selectedPlan?.displayName}
            </DialogTitle>
            <DialogDescription>Update plan details and limits</DialogDescription>
          </DialogHeader>
          {selectedPlan && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input id="displayName" value={formData.displayName} onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price (₹/month)</Label>
                  <Input id="price" type="number" min="0" value={formData.price} onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={2} />
              </div>
              <Separator />
              <h4 className="font-medium">Resource Limits</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxProperties">Max Properties</Label>
                  <Input id="maxProperties" type="number" min="1" value={formData.maxProperties} onChange={(e) => setFormData(prev => ({ ...prev, maxProperties: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxUsers">Max Users</Label>
                  <Input id="maxUsers" type="number" min="1" value={formData.maxUsers} onChange={(e) => setFormData(prev => ({ ...prev, maxUsers: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxRooms">Max Rooms</Label>
                  <Input id="maxRooms" type="number" min="1" value={formData.maxRooms} onChange={(e) => setFormData(prev => ({ ...prev, maxRooms: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storageLimitMb">Storage (MB)</Label>
                  <Input id="storageLimitMb" type="number" min="100" value={formData.storageLimitMb} onChange={(e) => setFormData(prev => ({ ...prev, storageLimitMb: e.target.value }))} />
                </div>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Deployment: <span className="font-medium text-foreground">{selectedPlan.deploymentType === 'cloud' ? '☁️ Cloud' : '🖥️ On-Premise'}</span>
                  {' · '}Subscribers: <span className="font-medium text-foreground">{selectedPlan.subscriberCount}</span>
                  {selectedPlan.setupFee > 0 && ` · Setup: ${formatINR(selectedPlan.setupFee)}`}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ──────────────────────── STAT CARD COMPONENT ──────────────────────── */

function StatCard({ icon: Icon, label, value, change, changeType, sub }: {
  icon: React.ElementType; label: string; value: string; change: string; changeType: 'up' | 'down'; sub: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 shrink-0">
            <Icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <TrendingUp className={cn('h-3.5 w-3.5', changeType === 'up' ? 'text-emerald-600' : 'text-red-500')} />
          <span className={cn('text-xs font-medium', changeType === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>{change}</span>
          <span className="text-xs text-muted-foreground">· {sub}</span>
        </div>
      </CardContent>
    </Card>
  );
}
