'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  TrendingUp,
  Building2,
  Wifi,
  Globe,
  Shield,
  Zap,
  Crown,
  CheckCircle2,
  XCircle,
  Calculator,
  ArrowRight,
  IndianRupee,
  BarChart3,
  Users,
  Server,
  Cloud,
  HardDrive,
  Star,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
  LineChart,
  Gift,
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
  MapPin,
  AlertCircle,
  Wrench,
} from 'lucide-react';

/* ──────────────────────── DATA ──────────────────────── */

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
  {
    name: 'Hotelogix',
    pricing: '₹330–₹500/room/mo',
    priceNum: 415,
    deployment: 'Cloud',
    modules: 10,
    wifi: false,
    gateway: false,
    onPrem: false,
    color: 'text-sky-600',
  },
  {
    name: 'eZee Absolute',
    pricing: '₹4,500–₹15,000/mo',
    priceNum: 9750,
    deployment: 'Cloud',
    modules: 12,
    wifi: false,
    gateway: false,
    onPrem: false,
    color: 'text-violet-600',
  },
  {
    name: 'Cloudbeds',
    pricing: '$50–80/mo (<20 rooms)',
    priceNum: 5500,
    deployment: 'Cloud',
    modules: 11,
    wifi: false,
    gateway: false,
    onPrem: false,
    color: 'text-teal-600',
  },
  {
    name: 'DJUBO',
    pricing: '₹2,639–₹8,000/mo',
    priceNum: 5320,
    deployment: 'Cloud',
    modules: 8,
    wifi: false,
    gateway: false,
    onPrem: false,
    color: 'text-rose-600',
  },
  {
    name: 'Oracle OPERA',
    pricing: '$22,855+ setup + $2.25/room',
    priceNum: 190000,
    deployment: 'On-Prem/Cloud',
    modules: 15,
    wifi: false,
    gateway: false,
    onPrem: true,
    color: 'text-red-700',
  },
];

const wifiCompetitors = [
  { name: 'Spotipo', pricing: '$59–$79/location/mo', type: 'Cloud captive portal' },
  { name: 'StayFi', pricing: '$15–$19/month', type: 'Cloud WiFi marketing' },
  { name: 'YesSpot', pricing: '$0.15–0.25/user', type: 'Cloud hotspot (MikroTik)' },
  { name: 'Nomadix EG1000', pricing: '$999+ hardware', type: 'On-premise gateway' },
  { name: 'Adentro', pricing: '$150–$250/location/mo', type: 'Cloud captive portal' },
  { name: 'MikroTik Router', pricing: '₹6,000 one-time', type: 'Hardware only' },
];

type CloudTier = 'starter' | 'professional' | 'enterprise';
type OnPremTier = 'professional' | 'enterprise';

interface CloudPlan {
  id: CloudTier;
  name: string;
  price: number;
  rooms: number;
  properties: number;
  users: number;
  modules: string[];
  popular?: boolean;
}

const cloudPlans: CloudPlan[] = [
  {
    id: 'starter',
    name: 'Starter Cloud',
    price: 4999,
    rooms: 30,
    properties: 1,
    users: 5,
    modules: [
      'Dashboard', 'PMS', 'Bookings', 'Front Desk', 'Guests',
      'Housekeeping', 'Billing', 'Settings', 'Help', 'Reports', 'Notifications',
    ],
  },
  {
    id: 'professional',
    name: 'Professional Cloud',
    price: 9999,
    rooms: 80,
    properties: 2,
    users: 15,
    modules: [
      'Dashboard', 'PMS', 'Bookings', 'Front Desk', 'Guests',
      'Housekeeping', 'Billing', 'Settings', 'Help', 'Reports', 'Notifications',
      'Guest Experience', 'POS & Restaurant', 'CRM & Marketing',
      'Channel Manager', 'WiFi RADIUS',
    ],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise Cloud',
    price: 17999,
    rooms: 200,
    properties: 5,
    users: 30,
    modules: [
      'All Cloud-Compatible Modules',
    ],
  },
];

interface OnPremPlan {
  id: OnPremTier;
  name: string;
  monthly: number;
  setup: number;
  rooms: number;
  properties: number;
  users: string;
  features: string[];
  popular?: boolean;
}

const onPremPlans: OnPremPlan[] = [
  {
    id: 'professional',
    name: 'Professional On-Prem',
    monthly: 14999,
    setup: 75000,
    rooms: 80,
    properties: 2,
    users: '15',
    features: [
      'Full WiFi Gateway + Captive Portal',
      'Bandwidth Management',
      'Room VLAN Isolation',
      'ZTNA Security',
      'All Base + Professional Modules',
      'On-Premise Data Sovereignty',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise On-Prem',
    monthly: 24999,
    setup: 150000,
    rooms: 200,
    properties: 10,
    users: 'Unlimited',
    features: [
      'Everything in Professional',
      'Multi-Property Management',
      'Chain Management Module',
      'AI Assistant',
      'Automation & Workflows',
      'Priority Support & SLA',
    ],
    popular: true,
  },
];

interface AddonModule {
  name: string;
  price: number;
  cloud: boolean;
  onPrem: boolean;
  icon: React.ElementType;
  category: 'network' | 'operations' | 'revenue' | 'experience' | 'intelligence';
}

const addonModules: AddonModule[] = [
  { name: 'WiFi & Network (Cloud RADIUS)', price: 1499, cloud: true, onPrem: true, icon: Radio, category: 'network' },
  { name: 'WiFi Gateway (On-Prem only)', price: 3999, cloud: false, onPrem: true, icon: Wifi, category: 'network' },
  { name: 'Room VLAN Isolation', price: 999, cloud: false, onPrem: true, icon: Lock, category: 'network' },
  { name: 'ZTNA', price: 999, cloud: false, onPrem: true, icon: Shield, category: 'network' },
  { name: 'POS & Restaurant', price: 1999, cloud: true, onPrem: true, icon: Utensils, category: 'operations' },
  { name: 'Revenue Management', price: 1499, cloud: true, onPrem: true, icon: LineChart, category: 'revenue' },
  { name: 'Channel Manager', price: 1499, cloud: true, onPrem: true, icon: Globe, category: 'revenue' },
  { name: 'CRM & Marketing', price: 999, cloud: true, onPrem: true, icon: Users, category: 'revenue' },
  { name: 'Digital Advertising', price: 999, cloud: true, onPrem: true, icon: Megaphone, category: 'revenue' },
  { name: 'Events / MICE', price: 999, cloud: true, onPrem: true, icon: CalendarDays, category: 'experience' },
  { name: 'Staff Management', price: 999, cloud: true, onPrem: true, icon: UserCog, category: 'operations' },
  { name: 'Surveillance', price: 1999, cloud: true, onPrem: true, icon: Camera, category: 'operations' },
  { name: 'IoT Smart Hotel', price: 1499, cloud: true, onPrem: true, icon: Cpu, category: 'intelligence' },
  { name: 'AI Assistant', price: 1999, cloud: true, onPrem: true, icon: Bot, category: 'intelligence' },
  { name: 'Automation & Workflows', price: 999, cloud: true, onPrem: true, icon: Workflow, category: 'intelligence' },
  { name: 'Chain Management', price: 2499, cloud: true, onPrem: true, icon: Link2, category: 'operations' },
];

const categoryLabels: Record<AddonModule['category'], { label: string; icon: React.ElementType }> = {
  network: { label: 'Network & Security', icon: Shield },
  operations: { label: 'Operations', icon: Wrench },
  revenue: { label: 'Revenue & Growth', icon: CircleDollarSign },
  experience: { label: 'Guest Experience', icon: Star },
  intelligence: { label: 'Intelligence & AI', icon: Sparkles },
};

/* ──────────────────────── HELPERS ──────────────────────── */

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

/* ──────────────────────── SECTION A: MARKET INTELLIGENCE ──────────────────────── */

function MarketIntelligence() {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <BarChart3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Market Intelligence</h2>
          <p className="text-sm text-muted-foreground">Indian Hospitality Tech Landscape 2025–2026</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="India Hospitality Market (2026)"
          value="$27.96B"
          change="+14.8% YoY"
          changeType="up"
          sub="from $24.36B in 2025"
        />
        <StatCard
          icon={Globe}
          label="Global Hotel PMS Market (2026)"
          value="$5.74B"
          change="CAGR 8.8%"
          changeType="up"
          sub="Cloud: 65% of revenue"
        />
        <StatCard
          icon={Users}
          label="India Hotel Rooms"
          value="3.5M+"
          change="76% expanding tech"
          changeType="up"
          sub="budgets growing"
        />
        <StatCard
          icon={Zap}
          label="AI Adoption Rate"
          value="60%"
          change="of hotels planning AI"
          changeType="up"
          sub="within coming years"
        />
      </div>

      {/* Market Segmentation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/20 dark:to-orange-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Hotel className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-lg">Budget Hotels</CardTitle>
            </div>
            <CardDescription>60% of Indian market</CardDescription>
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
            <CardDescription>25% of Indian market</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" /> Growing tech budgets rapidly</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" /> Need integrated PMS + WiFi</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" /> Ideal for StaySuite Professional</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/80 to-yellow-50/80 dark:from-amber-950/20 dark:to-yellow-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-lg">Luxury Hotels</CardTitle>
            </div>
            <CardDescription>15% of Indian market</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> Demand full gateway + VLAN</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> On-prem data sovereignty</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" /> Ideal for StaySuite Enterprise</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* GST & Tax Info */}
      <Card className="border-border/40">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-3 flex-1 p-3 rounded-lg bg-muted/50">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <IndianRupee className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Hotel Room GST</p>
                <p className="text-xs text-muted-foreground">5% for tariffs ≤₹7,500/day (reduced from 12% in Sept 2025)</p>
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
    </section>
  );
}

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
          <TrendingUp className={`h-3.5 w-3.5 ${changeType === 'up' ? 'text-emerald-600' : 'text-red-500'}`} />
          <span className={`text-xs font-medium ${changeType === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{change}</span>
          <span className="text-xs text-muted-foreground">· {sub}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────── SECTION B: COMPETITOR COMPARISON ──────────────────────── */

function CompetitorComparison() {
  const [showWifi, setShowWifi] = useState(false);
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Competitor Pricing Benchmark</h2>
          <p className="text-sm text-muted-foreground">How StaySuite compares to Indian PMS market leaders</p>
        </div>
      </div>

      {/* PMS Competitors Table */}
      <Card>
        <CardContent className="pt-6 p-0">
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
                {competitors.map((c) => (
                  <tr key={c.name} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-medium">{c.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{c.pricing}</td>
                    <td className="py-3 px-4 text-center">{c.modules}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="secondary" className="text-xs">{c.deployment}</Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {c.wifi ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {c.gateway ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {c.onPrem ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                    </td>
                  </tr>
                ))}
                {/* StaySuite Row */}
                <tr className="bg-amber-500/5 border-b-0">
                  <td className="py-3 px-4 font-bold text-amber-700 dark:text-amber-400">StaySuite</td>
                  <td className="py-3 px-4 font-medium text-amber-700 dark:text-amber-400">₹4,999–₹24,999/mo</td>
                  <td className="py-3 px-4 text-center font-bold text-amber-700 dark:text-amber-400">31+</td>
                  <td className="py-3 px-4 text-center">
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0 text-xs">Cloud + On-Prem</Badge>
                  </td>
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
      <Card className="border-amber-500/30 bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-lg">WiFi/Gateway — The Competitor Gap</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowWifi(!showWifi)}
              className="text-amber-700 dark:text-amber-400"
            >
              {showWifi ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showWifi ? 'Hide' : 'Show'} WiFi Solutions
            </Button>
          </div>
          <CardDescription>
            No Indian PMS includes WiFi gateway. Hotels pay extra — StaySuite is the only integrated solution.
          </CardDescription>
        </CardHeader>
        {showWifi && (
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
                  {wifiCompetitors.map((w) => (
                    <tr key={w.name} className="border-b last:border-0 border-amber-200/20 dark:border-amber-800/20">
                      <td className="py-2 px-3 font-medium">{w.name}</td>
                      <td className="py-2 px-3 text-muted-foreground">{w.pricing}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-xs">{w.type}</Badge>
                      </td>
                      <td className="py-2 px-3 text-center"><XCircle className="h-4 w-4 text-red-400 mx-auto" /></td>
                    </tr>
                  ))}
                  <tr className="bg-amber-500/10">
                    <td className="py-2 px-3 font-bold text-amber-700 dark:text-amber-400">StaySuite Gateway</td>
                    <td className="py-2 px-3 font-medium text-amber-700 dark:text-amber-400">Included in On-Prem plans</td>
                    <td className="py-2 px-3">
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0 text-xs">Full Gateway (RADIUS + Captive + BW)</Badge>
                    </td>
                    <td className="py-2 px-3 text-center"><CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>
    </section>
  );
}

/* ──────────────────────── SECTION C: PRICING RECOMMENDATION ──────────────────────── */

function PricingRecommendation() {
  return (
    <section className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <Package className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">StaySuite Pricing</h2>
          <p className="text-sm text-muted-foreground">Recommended tiers for Cloud and On-Premise deployment</p>
        </div>
      </div>

      <Tabs defaultValue="cloud" className="space-y-6">
        <TabsList className="h-auto p-1 bg-muted/50">
          <TabsTrigger value="cloud" className="gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <Cloud className="h-4 w-4" /> Cloud Plans
          </TabsTrigger>
          <TabsTrigger value="onprem" className="gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <HardDrive className="h-4 w-4" /> On-Premise Plans
          </TabsTrigger>
          <TabsTrigger value="addons" className="gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <Layers className="h-4 w-4" /> Add-On Modules
          </TabsTrigger>
          <TabsTrigger value="hardware" className="gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <MonitorSmartphone className="h-4 w-4" /> Gateway Hardware
          </TabsTrigger>
        </TabsList>

        {/* Cloud Plans */}
        <TabsContent value="cloud">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cloudPlans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                  plan.popular
                    ? 'border-amber-500/50 shadow-md shadow-amber-500/10'
                    : 'border-border/40'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                      <Star className="h-3 w-3" /> Most Popular
                    </div>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">{formatINR(plan.price)}</span>
                    <span className="text-muted-foreground">/month</span>
                  </CardDescription>
                  <p className="text-xs text-muted-foreground mt-1">
                    Annual: {formatINR(plan.price * 10)}/yr <Badge variant="success" className="text-[10px] ml-1">Save 2 months</Badge>
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{plan.rooms}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rooms</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{plan.properties}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Properties</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{plan.users}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Users</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Included Modules</p>
                    {plan.modules.map((m) => (
                      <div key={m} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20'
                        : ''
                    }`}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    Get Started <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          <Card className="mt-6 border-border/40">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Cloud Limitation Note</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cloud deployment can only provide RADIUS authentication features. Full WiFi Gateway (Captive Portal, Bandwidth Management, Room VLAN, ZTNA) requires the On-Premise box. This is a network architecture constraint — not a product limitation.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* On-Premise Plans */}
        <TabsContent value="onprem">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {onPremPlans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                  plan.popular
                    ? 'border-amber-500/50 shadow-md shadow-amber-500/10'
                    : 'border-border/40'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                      <Crown className="h-3 w-3" /> Recommended
                    </div>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="space-y-1">
                    <div>
                      <span className="text-3xl font-bold text-foreground">{formatINR(plan.monthly)}</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-700 dark:text-amber-400">
                        + {formatINR(plan.setup)} one-time setup
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Annual: {formatINR(plan.monthly * 10)}/yr <Badge variant="success" className="text-[10px] ml-1">Save 2 months</Badge>
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{plan.rooms}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rooms</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{plan.properties}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Properties</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{plan.users}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Users</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Key Features</p>
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20'
                        : ''
                    }`}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    Contact Sales <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Add-On Modules */}
        <TabsContent value="addons">
          <div className="space-y-6">
            {(['network', 'operations', 'revenue', 'experience', 'intelligence'] as const).map((cat) => {
              const catInfo = categoryLabels[cat];
              const CatIcon = catInfo.icon;
              const modules = addonModules.filter((m) => m.category === cat);
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <CatIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{catInfo.label}</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {modules.map((mod) => {
                      const ModIcon = mod.icon;
                      return (
                        <Card key={mod.name} className="transition-all duration-200 hover:shadow-md hover:border-amber-500/30">
                          <CardContent className="pt-4 pb-4 px-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
                                <ModIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium leading-tight">{mod.name}</p>
                                <p className="text-lg font-bold mt-1">{formatINR(mod.price)}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
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

        {/* Gateway Hardware */}
        <TabsContent value="hardware">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-border/40 hover:shadow-md transition-all duration-300">
              <CardHeader>
                <Badge variant="outline" className="w-fit text-xs">Entry</Badge>
                <CardTitle className="text-lg">MikroTik Base</CardTitle>
                <CardDescription>For small properties ≤30 rooms</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold">₹45,000 <span className="text-sm font-normal text-muted-foreground">one-time</span></p>
                <Separator />
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> MikroTik hAP ac³</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> RADIUS Server</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> Captive Portal</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> Basic Bandwidth Mgmt</li>
                  <li className="flex items-center gap-2"><XCircle className="h-3.5 w-3.5 text-muted-foreground" /> No VLAN Isolation</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">Configure</Button>
              </CardFooter>
            </Card>

            <Card className="border-amber-500/50 shadow-md shadow-amber-500/10 hover:shadow-lg transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0">
                <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                  <Star className="h-3 w-3" /> Popular
                </div>
              </div>
              <CardHeader>
                <Badge className="w-fit bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0 text-xs">Recommended</Badge>
                <CardTitle className="text-lg">Intel NUC Standard</CardTitle>
                <CardDescription>For mid-size properties ≤80 rooms</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold">₹75,000 <span className="text-sm font-normal text-muted-foreground">one-time</span></p>
                <Separator />
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> Intel NUC i5 + 16GB RAM</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> Full RADIUS + Captive Portal</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> Advanced Bandwidth Mgmt</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> Room VLAN Isolation</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> ZTNA Security</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20">Configure</Button>
              </CardFooter>
            </Card>

            <Card className="border-border/40 hover:shadow-md transition-all duration-300">
              <CardHeader>
                <Badge variant="outline" className="w-fit text-xs">Enterprise</Badge>
                <CardTitle className="text-lg">Intel NUC Premium</CardTitle>
                <CardDescription>For large properties ≤200 rooms</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold">₹1,20,000 <span className="text-sm font-normal text-muted-foreground">one-time</span></p>
                <Separator />
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> Intel NUC i7 + 32GB RAM</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> Full Gateway Suite</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> Multi-property Support</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> IoT Hub Integration</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-amber-500" /> 24/7 Remote Monitoring</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">Contact Sales</Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

/* ──────────────────────── SECTION D: PRICING CALCULATOR ──────────────────────── */

function PricingCalculator() {
  const [deployment, setDeployment] = useState<'cloud' | 'onprem'>('cloud');
  const [rooms, setRooms] = useState(30);
  const [properties, setProperties] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');

  const availableAddons = useMemo(() => {
    if (deployment === 'cloud') return addonModules.filter((m) => m.cloud);
    return addonModules.filter((m) => m.onPrem);
  }, [deployment]);

  const baseCost = useMemo(() => {
    if (deployment === 'cloud') {
      if (rooms <= 30 && properties <= 1) return 4999;
      if (rooms <= 80 && properties <= 2) return 9999;
      return 17999;
    } else {
      if (rooms <= 80 && properties <= 2) return 14999;
      return 24999;
    }
  }, [deployment, rooms, properties]);

  const setupCost = useMemo(() => {
    if (deployment !== 'onprem') return 0;
    if (rooms <= 80 && properties <= 2) return 75000;
    return 150000;
  }, [deployment, rooms, properties]);

  const addonCost = useMemo(() => {
    return Array.from(selectedAddons).reduce((sum, name) => {
      const mod = addonModules.find((m) => m.name === name);
      return sum + (mod?.price || 0);
    }, 0);
  }, [selectedAddons]);

  const monthlyTotal = baseCost + addonCost;
  const annualTotal = billing === 'annual' ? monthlyTotal * 10 + setupCost : monthlyTotal * 12 + setupCost;
  const effectiveMonthly = billing === 'annual' ? annualTotal / 12 : monthlyTotal;
  const savings = billing === 'annual' ? monthlyTotal * 2 : 0;

  const toggleAddon = (name: string) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const currentPlanName = useMemo(() => {
    if (deployment === 'cloud') {
      if (rooms <= 30 && properties <= 1) return 'Starter Cloud';
      if (rooms <= 80 && properties <= 2) return 'Professional Cloud';
      return 'Enterprise Cloud';
    } else {
      if (rooms <= 80 && properties <= 2) return 'Professional On-Prem';
      return 'Enterprise On-Prem';
    }
  }, [deployment, rooms, properties]);

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <Calculator className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pricing Calculator</h2>
          <p className="text-sm text-muted-foreground">Configure your StaySuite deployment and estimate costs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Deployment Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Deployment Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setDeployment('cloud'); setSelectedAddons(new Set()); }}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      deployment === 'cloud'
                        ? 'border-amber-500 bg-amber-500/5'
                        : 'border-border hover:border-amber-500/30'
                    }`}
                  >
                    <Cloud className={`h-5 w-5 ${deployment === 'cloud' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                    <div className="text-left">
                      <p className="text-sm font-medium">Cloud</p>
                      <p className="text-[10px] text-muted-foreground">RADIUS only</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setDeployment('onprem'); setSelectedAddons(new Set()); }}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      deployment === 'onprem'
                        ? 'border-amber-500 bg-amber-500/5'
                        : 'border-border hover:border-amber-500/30'
                    }`}
                  >
                    <HardDrive className={`h-5 w-5 ${deployment === 'onprem' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                    <div className="text-left">
                      <p className="text-sm font-medium">On-Premise</p>
                      <p className="text-[10px] text-muted-foreground">Full Gateway</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Rooms & Properties */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Number of Rooms</label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={rooms}
                    onChange={(e) => setRooms(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Number of Properties</label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={properties}
                    onChange={(e) => setProperties(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-10"
                  />
                </div>
              </div>

              {/* Billing Cycle */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Billing Cycle</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setBilling('monthly')}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${
                      billing === 'monthly'
                        ? 'border-border bg-muted/30'
                        : 'border-border hover:border-amber-500/30'
                    }`}
                  >
                    <p className="text-sm font-medium">Monthly</p>
                    <p className="text-[10px] text-muted-foreground">No commitment</p>
                  </button>
                  <button
                    onClick={() => setBilling('annual')}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${
                      billing === 'annual'
                        ? 'border-amber-500 bg-amber-500/5'
                        : 'border-border hover:border-amber-500/30'
                    }`}
                  >
                    <p className="text-sm font-medium">Annual</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">2 months free!</p>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add-on Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add-On Modules</CardTitle>
              <CardDescription>Select additional modules beyond your plan&apos;s included features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {availableAddons.map((mod) => {
                  const ModIcon = mod.icon;
                  const isSelected = selectedAddons.has(mod.name);
                  return (
                    <label
                      key={mod.name}
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border ${
                        isSelected
                          ? 'border-amber-500/50 bg-amber-500/5'
                          : 'border-transparent hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleAddon(mod.name)}
                        className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                      />
                      <ModIcon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-amber-600' : 'text-muted-foreground'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{mod.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatINR(mod.price)}/mo</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cost Summary */}
        <div className="lg:col-span-2">
          <Card className="sticky top-4 border-amber-500/30 shadow-lg shadow-amber-500/5">
            <CardHeader className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-t-2xl">
              <CardTitle className="text-base flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-amber-600" /> Cost Estimate
              </CardTitle>
              <CardDescription>Based on your configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Selected Plan</span>
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0">{currentPlanName}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Deployment</span>
                  <span className="font-medium capitalize">{deployment === 'cloud' ? 'Cloud' : 'On-Premise'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rooms / Properties</span>
                  <span className="font-medium">{rooms} / {properties}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Base Plan</span>
                  <span className="font-medium">{formatINR(baseCost)}/mo</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Add-Ons ({selectedAddons.size})</span>
                  <span className="font-medium">{formatINR(addonCost)}/mo</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Monthly Subtotal</span>
                  <span className="font-semibold">{formatINR(monthlyTotal)}/mo</span>
                </div>
                {setupCost > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">One-Time Setup</span>
                    <span className="font-medium">{formatINR(setupCost)}</span>
                  </div>
                )}
              </div>

              <Separator />

              {billing === 'annual' && savings > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Gift className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    You save {formatINR(savings * 12)}/year with annual billing!
                  </p>
                </div>
              )}

              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <p className="text-xs text-muted-foreground mb-1">
                  {billing === 'annual' ? 'Annual Total' : 'Yearly Estimate'}
                </p>
                <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">
                  {formatINR(billing === 'annual' ? annualTotal : monthlyTotal * 12 + setupCost)}
                  <span className="text-sm font-normal text-muted-foreground">/yr</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Effective: {formatINR(Math.round(effectiveMonthly))}/mo
                  {setupCost > 0 && billing === 'annual' && ` (incl. setup amortized)`}
                </p>
              </div>

              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 h-11">
                Get Custom Quote <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-[10px] text-center text-muted-foreground">
                Prices exclusive of 18% GST. Final pricing may vary based on custom requirements.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── SECTION E: VALUE PROPOSITION ──────────────────────── */

function ValueProposition() {
  const tcoData = [
    { category: 'PMS (Hotelogix Pro)', standalone: 9600, staysuite: 0 },
    { category: 'WiFi Captive Portal (Spotipo)', standalone: 5500, staysuite: 0 },
    { category: 'WiFi Gateway (Nomadix)', standalone: 0, staysuite: 0 },
    { category: 'POS System', standalone: 3000, staysuite: 0 },
    { category: 'CRM & Marketing', standalone: 2000, staysuite: 0 },
    { category: 'Channel Manager', standalone: 2500, staysuite: 0 },
    { category: 'Revenue Management', standalone: 3000, staysuite: 0 },
    { category: 'StaySuite Professional On-Prem', standalone: 0, staysuite: 14999 },
  ];

  const totalStandalone = tcoData.reduce((s, d) => s + d.standalone, 0);
  const totalStaySuite = tcoData.reduce((s, d) => s + d.staysuite, 0);
  const savings = totalStandalone - totalStaySuite;
  const savingsPercent = Math.round((savings / totalStandalone) * 100);

  const differentiators = [
    {
      icon: Wifi,
      title: 'Only Integrated WiFi Gateway',
      description: 'No other PMS offers RADIUS + Captive Portal + Bandwidth Management + VLAN + ZTNA in a single box.',
    },
    {
      icon: Layers,
      title: '31+ Modules vs 8–12',
      description: 'StaySuite covers PMS, WiFi, POS, CRM, IoT, AI — competitors need 4–6 separate tools.',
    },
    {
      icon: HardDrive,
      title: 'True On-Premise Option',
      description: 'Only Oracle OPERA offers on-prem, at $22K+ setup. StaySuite gives data sovereignty affordably.',
    },
    {
      icon: Shield,
      title: 'Zero Trust Network Access',
      description: 'Built-in ZTNA for guest and staff network isolation — enterprise security for every hotel.',
    },
  ];

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Value Proposition</h2>
          <p className="text-sm text-muted-foreground">Why StaySuite wins on total cost and capability</p>
        </div>
      </div>

      {/* Key Differentiators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {differentiators.map((d) => {
          const DIcon = d.icon;
          return (
            <Card key={d.title} className="transition-all duration-300 hover:shadow-md hover:border-amber-500/30">
              <CardContent className="pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 mb-3">
                  <DIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold mb-1">{d.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{d.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* TCO Comparison */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <CardTitle className="text-lg">Total Cost of Ownership — Monthly (80-room hotel)</CardTitle>
          </div>
          <CardDescription>StaySuite vs buying separate tools from different vendors</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tcoData.map((d) => {
              const isStaySuite = d.staysuite > 0;
              const amount = isStaySuite ? d.staysuite : d.standalone;
              if (amount === 0 && !isStaySuite) {
                // Standalone cost that's 0 doesn't apply (like Nomadix which is one-time)
                return null;
              }
              const maxAmount = Math.max(totalStandalone, totalStaySuite);
              const width = Math.max(2, (amount / maxAmount) * 100);
              return (
                <div key={d.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className={`font-medium ${isStaySuite ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
                      {d.category}
                    </span>
                    <span className="font-medium">{formatINR(amount)}/mo</span>
                  </div>
                  <div className="h-6 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isStaySuite
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                          : 'bg-muted-foreground/30'
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Separate Tools</p>
              <p className="text-xl font-bold">{formatINR(totalStandalone)}</p>
              <p className="text-xs text-muted-foreground">/month</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1 font-medium">StaySuite On-Prem</p>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{formatINR(totalStaySuite)}</p>
              <p className="text-xs text-muted-foreground">/month (all-in-one)</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1 font-medium">Monthly Savings</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formatINR(savings)}</p>
              <p className="text-xs text-muted-foreground">{savingsPercent}% reduction</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ROI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20">
                <TrendingUp className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-lg font-bold">3-Month ROI</p>
                <p className="text-xs text-muted-foreground">On-Premise Professional</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">
              {formatINR(savings * 3 - 75000)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Net savings after 3 months (incl. ₹75K setup). Annual savings: <strong>{formatINR(savings * 12)}</strong>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20">
                <MapPin className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-lg font-bold">Market Position</p>
                <p className="text-xs text-muted-foreground">Price-to-feature ratio</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">4.7×</p>
            <p className="text-sm text-muted-foreground mt-1">
              More modules per ₹1,000 spent vs Hotelogix. Only product with WiFi gateway at any price point.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

/* ──────────────────────── MAIN PAGE ──────────────────────── */

export default function PricingStrategyPage() {
  const [activeSection, setActiveSection] = useState<string>('all');

  const sections = [
    { id: 'all', label: 'Overview', icon: BarChart3 },
    { id: 'market', label: 'Market Intel', icon: TrendingUp },
    { id: 'competitors', label: 'Competitors', icon: Target },
    { id: 'pricing', label: 'Pricing', icon: Package },
    { id: 'calculator', label: 'Calculator', icon: Calculator },
    { id: 'value', label: 'Value', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight">StaySuite</h1>
                <p className="text-[10px] text-muted-foreground leading-none">Licensing & Pricing Strategy</p>
              </div>
            </div>
            <Badge variant="outline" className="hidden sm:flex gap-1 border-amber-500/30 text-amber-700 dark:text-amber-400">
              <Star className="h-3 w-3" /> 31+ Modules · HospitalityOS
            </Badge>
          </div>
        </div>
      </header>

      {/* Section Navigation */}
      <nav className="border-b bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-thin">
            {sections.map((s) => {
              const SIcon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeSection === s.id
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <SIcon className="h-3.5 w-3.5" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16">
          {/* Hero Banner */}
          {activeSection === 'all' && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-8 sm:p-12">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15),transparent_50%)]" />
              <div className="relative z-10">
                <Badge className="bg-white/20 text-white border-0 mb-4 hover:bg-white/30">2025–2026 Pricing Strategy</Badge>
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                  Complete HospitalityOS<br />with WiFi Gateway
                </h1>
                <p className="text-white/80 text-base sm:text-lg max-w-2xl">
                  The only Indian PMS with 31+ integrated modules and full WiFi gateway support —
                  RADIUS, Captive Portal, Bandwidth Management, VLAN, ZTNA in a single on-premise box.
                </p>
                <div className="flex flex-wrap gap-3 mt-6">
                  <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <Wifi className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-medium">Full Gateway</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <Layers className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-medium">31+ Modules</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <Server className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-medium">Cloud + On-Prem</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <Shield className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-medium">ZTNA Built-in</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeSection === 'all' || activeSection === 'market') && <MarketIntelligence />}
          {(activeSection === 'all' || activeSection === 'competitors') && <CompetitorComparison />}
          {(activeSection === 'all' || activeSection === 'pricing') && <PricingRecommendation />}
          {(activeSection === 'all' || activeSection === 'calculator') && <PricingCalculator />}
          {(activeSection === 'all' || activeSection === 'value') && <ValueProposition />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-amber-500 to-orange-500">
                <Building2 className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm font-semibold">StaySuite HospitalityOS</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Pricing data based on Indian market research Q1 2026. All prices exclusive of 18% GST. Subject to change.
            </p>
            <Badge variant="secondary" className="text-[10px]">v2.0 Strategy</Badge>
          </div>
        </div>
      </footer>


    </div>
  );
}
