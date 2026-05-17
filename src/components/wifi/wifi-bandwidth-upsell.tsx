'use client';

/**
 * Bandwidth Upsell Management — F1
 *
 * WiFi speed upgrade purchases, revenue tracking, and plan configuration
 * for captive portal bandwidth upsell.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
  Zap,
  Search,
  Eye,
  RefreshCw,
  DollarSign,
  TrendingUp,
  ArrowRight,
  Loader2,
  Wifi,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Package,
  Receipt,
  Undo2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface UpgradeGuest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
}

interface UpgradePlan {
  id: string;
  name: string;
}

interface UpgradeProperty {
  id: string;
  name: string;
}

interface BandwidthUpgrade {
  id: string;
  tenantId: string;
  guestId?: string | null;
  propertyId?: string | null;
  sessionId?: string | null;
  username?: string | null;
  fromPlanId: string;
  toPlanId: string;
  amount: number;
  currency: string;
  folioId?: string | null;
  paymentStatus: string;
  coaStatus?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  guest?: UpgradeGuest | null;
  property?: UpgradeProperty | null;
  fromPlan?: UpgradePlan | null;
  toPlan?: UpgradePlan | null;
}

interface UpgradeStats {
  totalRevenue: number;
  currency: string;
  totalUpgradesSold: number;
  averageUpsellAmount: number;
  conversionRate: number;
  popularPaths: { from: string; to: string; count: number; revenue: number }[];
  revenueTrend: { date: string; revenue: number; upgrades: number }[];
}

interface UpgradeTier {
  fromPlan: string;
  toPlan: string;
  price: number;
  enabled: boolean;
}

// ─── Helper Functions ──────────────────────────────────────────────────────────

function getPaymentBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs gap-1"><CheckCircle className="h-3 w-3" />Completed</Badge>;
    case 'pending':
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
    case 'failed':
      return <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
    case 'refunded':
      return <Badge className="bg-gray-400 hover:bg-gray-500 text-white border-0 text-xs gap-1"><Undo2 className="h-3 w-3" />Refunded</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

function getCoaBadge(status?: string | null) {
  switch (status) {
    case 'applied':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px]">Applied</Badge>;
    case 'pending':
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-[10px]">Pending</Badge>;
    case 'failed':
      return <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-[10px]">Failed</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">N/A</Badge>;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function WiFiBandwidthUpsell() {
  const { toast } = useToast();

  // Data state
  const [upgrades, setUpgrades] = useState<BandwidthUpgrade[]>([]);
  const [stats, setStats] = useState<UpgradeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('30');

  // Dialog state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedUpgrade, setSelectedUpgrade] = useState<BandwidthUpgrade | null>(null);

  // Settings state
  const [upsellEnabled, setUpsellEnabled] = useState(true);
  const [chargeToRoom, setChargeToRoom] = useState(true);
  const [defaultCurrency, setDefaultCurrency] = useState('INR');
  const [tiers, setTiers] = useState<UpgradeTier[]>([
    { fromPlan: 'Free', toPlan: 'Standard', price: 99, enabled: true },
    { fromPlan: 'Free', toPlan: 'Premium', price: 199, enabled: true },
    { fromPlan: 'Free', toPlan: 'Ultra', price: 399, enabled: true },
    { fromPlan: 'Standard', toPlan: 'Premium', price: 149, enabled: true },
    { fromPlan: 'Standard', toPlan: 'Ultra', price: 349, enabled: true },
    { fromPlan: 'Premium', toPlan: 'Ultra', price: 249, enabled: false },
  ]);

  // Loading states for async actions
  const [refunding, setRefunding] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingTiers, setSavingTiers] = useState(false);

  // ─── Fetch Settings on Mount ─────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/wifi/bandwidth-upgrade/settings', { signal: controller.signal });
        const data = await res.json();

        if (cancelled) return;
        if (data.success && data.data) {
          const s = data.data;
          if (typeof s.upsellEnabled === 'boolean') setUpsellEnabled(s.upsellEnabled);
          if (typeof s.chargeToRoom === 'boolean') setChargeToRoom(s.chargeToRoom);
          if (typeof s.defaultCurrency === 'string' && s.defaultCurrency) setDefaultCurrency(s.defaultCurrency);
          if (Array.isArray(s.tiers) && s.tiers.length > 0) {
            setTiers(s.tiers.map((t: Record<string, unknown>) => ({
              fromPlan: String(t.fromPlan || ''),
              toPlan: String(t.toPlan || ''),
              price: Number(t.price) || 0,
              enabled: Boolean(t.enabled),
            })));
          }
        }
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to fetch bandwidth upsell settings:', error);
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, []);

  // ─── Fetch Upgrades ────────────────────────────────────────────────────────

  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.set('paymentStatus', statusFilter);
        if (dateRange !== 'all') params.set('startDate', new Date(Date.now() - parseInt(dateRange) * 86400000).toISOString());
        params.set('limit', '100');

        const res = await fetch(`/api/wifi/bandwidth-upgrade?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();

        if (cancelled) return;
        if (data.success && Array.isArray(data.data)) {
          setUpgrades(data.data);
        } else {
          setUpgrades([]);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to fetch upgrades:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [statusFilter, dateRange, fetchKey]);

  // ─── Fetch Stats ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setStatsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('days', dateRange === 'all' ? '365' : dateRange);
        const res = await fetch(`/api/wifi/bandwidth-upgrade/stats?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();

        if (cancelled) return;
        if (data.success && data.data) {
          setStats(data.data);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to fetch upgrade stats:', error);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [dateRange, fetchKey]);

  // ─── Refresh ────────────────────────────────────────────────────────────────

  const refreshData = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  // ─── View Details ───────────────────────────────────────────────────────────

  const openView = (upgrade: BandwidthUpgrade) => {
    setSelectedUpgrade(upgrade);
    setViewDialogOpen(true);
  };

  // ─── Refund ─────────────────────────────────────────────────────────────────

  const openRefund = (upgrade: BandwidthUpgrade) => {
    setSelectedUpgrade(upgrade);
    setRefundDialogOpen(true);
  };

  const handleRefund = async () => {
    if (!selectedUpgrade) return;
    try {
      setRefunding(true);
      const res = await fetch(`/api/wifi/bandwidth-upgrade/${selectedUpgrade.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refund' }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Refund Processed', description: 'The bandwidth upgrade has been refunded.' });
        setRefundDialogOpen(false);
        setSelectedUpgrade(null);
        refreshData();
      } else {
        toast({ title: 'Refund Failed', description: data.error || 'Failed to process refund', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to process refund', variant: 'destructive' });
    } finally {
      setRefunding(false);
    }
  };

  // ─── Toggle Tier ────────────────────────────────────────────────────────────

  const toggleTier = (index: number) => {
    setTiers((prev) => prev.map((t, i) => i === index ? { ...t, enabled: !t.enabled } : t));
  };

  // ─── Popular Paths: max count for progress bar ─────────────────────────────

  const maxPathCount = stats?.popularPaths?.[0]?.count || 1;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Bandwidth Upsell
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            WiFi speed upgrade purchases and revenue
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Revenue Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/5 dark:bg-primary/10 p-2.5">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats?.currency || '₹'}{stats?.totalRevenue?.toLocaleString() ?? '0'}</p>
              <p className="text-xs text-muted-foreground">Total Upsell Revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/5 dark:bg-primary/10 p-2.5">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats?.totalUpgradesSold ?? 0}</p>
              <p className="text-xs text-muted-foreground">Upgrades Sold</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2.5">
              <Receipt className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats?.currency || '₹'}{stats?.averageUpsellAmount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Avg Upsell Amount</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 p-2.5">
              <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats?.conversionRate ?? 0}%</p>
              <p className="text-xs text-muted-foreground">Conversion Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transactions" className="w-full">
        <TabsList>
          <TabsTrigger value="transactions" className="gap-1.5">
            <Receipt className="h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="paths" className="gap-1.5">
            <ArrowRight className="h-4 w-4" />
            Upgrade Paths
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* ─── Transactions Tab ───────────────────────────────────────────── */}
        <TabsContent value="transactions" className="space-y-4">
          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by guest name or username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-full sm:w-[130px]">
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 Days</SelectItem>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                    <SelectItem value="90">Last 90 Days</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : upgrades.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-muted/50 p-4 mb-3">
                    <Zap className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground">No upgrade transactions found</h3>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Bandwidth upgrade purchases will appear here
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Guest</TableHead>
                        <TableHead className="hidden md:table-cell w-[100px]">Username</TableHead>
                        <TableHead className="w-[100px]">From Plan</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="w-[100px]">To Plan</TableHead>
                        <TableHead className="w-[80px]">Amount</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="hidden lg:table-cell w-[80px]">CoA</TableHead>
                        <TableHead className="hidden xl:table-cell w-[100px]">Created</TableHead>
                        <TableHead className="text-right w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upgrades.map((u) => (
                        <TableRow key={u.id} className="hover:bg-muted/50">
                          <TableCell>
                            {u.guest ? (
                              <p className="text-sm font-medium">{u.guest.firstName} {u.guest.lastName}</p>
                            ) : (
                              <span className="text-xs text-muted-foreground">{u.username || 'N/A'}</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="font-mono text-xs">{u.username || '—'}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-normal">{u.fromPlan?.name || 'Unknown'}</Badge>
                          </TableCell>
                          <TableCell>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{u.toPlan?.name || 'Unknown'}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold tabular-nums">
                              {u.currency === 'INR' ? '₹' : '$'}{u.amount}
                            </span>
                          </TableCell>
                          <TableCell>{getPaymentBadge(u.paymentStatus)}</TableCell>
                          <TableCell className="hidden lg:table-cell">{getCoaBadge(u.coaStatus)}</TableCell>
                          <TableCell className="hidden xl:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-0.5">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openView(u)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {u.paymentStatus === 'completed' && (
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openRefund(u)}>
                                  <Undo2 className="h-3.5 w-3.5 text-orange-500" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Upgrade Paths Tab ──────────────────────────────────────────── */}
        <TabsContent value="paths" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Popular Upgrade Paths</CardTitle>
              <CardDescription>Most common plan upgrade transitions</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : stats?.popularPaths && stats.popularPaths.length > 0 ? (
                <div className="space-y-4">
                  {stats.popularPaths.map((path, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-normal">{path.from}</Badge>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <Badge variant="secondary" className="text-xs">{path.to}</Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{path.count} upgrades</span>
                          <span className="text-xs font-semibold tabular-nums">{stats.currency}{path.revenue.toLocaleString()}</span>
                        </div>
                      </div>
                      <Progress value={(path.count / maxPathCount) * 100} className="h-2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">No upgrade path data available yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue Trend */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Revenue Trend</CardTitle>
              <CardDescription>Daily upsell revenue</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.revenueTrend && stats.revenueTrend.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {[...stats.revenueTrend].reverse().map((day, index) => {
                    const maxRev = Math.max(...stats.revenueTrend.map((d) => d.revenue), 1);
                    return (
                      <div key={index} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">{day.date}</span>
                        <div className="flex-1">
                          <Progress value={(day.revenue / maxRev) * 100} className="h-3" />
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-semibold tabular-nums">{stats.currency}{day.revenue.toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground block">{day.upgrades} upgrades</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">No trend data available yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Settings Tab ───────────────────────────────────────────────── */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* General Settings */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4 text-amber-600" />
                  Upsell Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Enable Bandwidth Upsell</Label>
                    <p className="text-xs text-muted-foreground">Show upsell options in captive portal</p>
                  </div>
                  <Switch checked={upsellEnabled} onCheckedChange={setUpsellEnabled} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Charge to Room</Label>
                    <p className="text-xs text-muted-foreground">Automatically add charges to guest folio</p>
                  </div>
                  <Switch checked={chargeToRoom} onCheckedChange={setChargeToRoom} />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Default Currency</Label>
                  <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full"
                  disabled={savingSettings}
                  onClick={async () => {
                    try {
                      setSavingSettings(true);
                      const res = await fetch('/api/wifi/bandwidth-upgrade/settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ upsellEnabled, chargeToRoom, defaultCurrency, tiers }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        toast({ title: 'Settings Saved', description: 'Upsell settings updated successfully' });
                      } else {
                        toast({ title: 'Save Failed', description: data.error || 'Failed to save settings', variant: 'destructive' });
                      }
                    } catch {
                      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
                    } finally {
                      setSavingSettings(false);
                    }
                  }}
                >
                  {savingSettings && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Settings
                </Button>
              </CardContent>
            </Card>

            {/* Upgrade Tiers */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-amber-600" />
                  Upgrade Tiers
                </CardTitle>
                <CardDescription>Configure available upgrade paths and pricing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {tiers.map((tier, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <Switch
                      checked={tier.enabled}
                      onCheckedChange={() => toggleTier(index)}
                      size="sm"
                    />
                    <div className="flex-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-normal">{tier.fromPlan}</Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <Badge variant="secondary" className="text-xs">{tier.toPlan}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">₹</span>
                      <Input
                        type="number"
                        value={tier.price}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setTiers((prev) => prev.map((t, i) => i === index ? { ...t, price: val } : t));
                        }}
                        className="w-20 h-8 text-xs text-right"
                        disabled={!tier.enabled}
                      />
                    </div>
                  </div>
                ))}

                <Button
                  className="w-full mt-4"
                  disabled={savingTiers}
                  onClick={async () => {
                    try {
                      setSavingTiers(true);
                      const res = await fetch('/api/wifi/bandwidth-upgrade/settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ upsellEnabled, chargeToRoom, defaultCurrency, tiers }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        toast({ title: 'Tiers Saved', description: 'Upgrade tier configuration updated' });
                      } else {
                        toast({ title: 'Save Failed', description: data.error || 'Failed to save tiers', variant: 'destructive' });
                      }
                    } catch {
                      toast({ title: 'Error', description: 'Failed to save tiers', variant: 'destructive' });
                    } finally {
                      setSavingTiers(false);
                    }
                  }}
                >
                  {savingTiers && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Tiers
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── View Details Dialog ─────────────────────────────────────────────── */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Upgrade Details
            </DialogTitle>
            <DialogDescription>Full upgrade transaction details</DialogDescription>
          </DialogHeader>
          {selectedUpgrade && (
            <div className="grid gap-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Guest</span>
                  <span className="font-medium">{selectedUpgrade.guest ? `${selectedUpgrade.guest.firstName} ${selectedUpgrade.guest.lastName}` : selectedUpgrade.username || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Username</span>
                  <span className="font-mono">{selectedUpgrade.username || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Plan Upgrade</span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs">{selectedUpgrade.fromPlan?.name || 'Unknown'}</Badge>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <Badge variant="secondary" className="text-xs">{selectedUpgrade.toPlan?.name || 'Unknown'}</Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Amount</span>
                  <span className="text-lg font-bold">
                    {selectedUpgrade.currency === 'INR' ? '₹' : '$'}{selectedUpgrade.amount}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Payment Status</span>
                  {getPaymentBadge(selectedUpgrade.paymentStatus)}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">CoA Status</span>
                  {getCoaBadge(selectedUpgrade.coaStatus)}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Session ID</span>
                  <span className="font-mono text-xs break-all">{selectedUpgrade.sessionId || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Property</span>
                  <span>{selectedUpgrade.property?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Activated At</span>
                  <span>{selectedUpgrade.activatedAt ? format(new Date(selectedUpgrade.activatedAt), 'PPp') : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Expires At</span>
                  <span>{selectedUpgrade.expiresAt ? format(new Date(selectedUpgrade.expiresAt), 'PPp') : 'N/A'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-xs mb-1">Created At</span>
                  <span>{format(new Date(selectedUpgrade.createdAt), 'PPp')}</span>
                </div>
              </div>
              {selectedUpgrade.folioId && (
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Folio ID</span>
                  <span className="font-mono text-xs">{selectedUpgrade.folioId}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Refund Dialog ──────────────────────────────────────────────────── */}
      <AlertDialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Undo2 className="h-4 w-4 text-orange-500" />
              Refund Upgrade
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to refund the bandwidth upgrade of{' '}
              <span className="font-semibold">{selectedUpgrade?.currency === 'INR' ? '₹' : '$'}{selectedUpgrade?.amount}</span> for{' '}
              <span className="font-medium">{selectedUpgrade?.guest ? `${selectedUpgrade.guest?.firstName} ${selectedUpgrade.guest?.lastName}` : selectedUpgrade?.username}</span>?
              The guest&apos;s bandwidth will be reverted to{' '}
              <span className="font-medium">{selectedUpgrade?.fromPlan?.name || 'previous plan'}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRefund} disabled={refunding} className="bg-orange-600 hover:bg-orange-700">
              {refunding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Process Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
