'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Calculator,
  Baby,
  Bed,
  BedDouble,
  X,
  Check,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

interface GuestRateConfig {
  id: string;
  connectionId?: string;
  channelCode: string;
  roomTypeId?: string;
  ratePlanId?: string;
  maxAdults: number;
  maxChildren: number;
  maxTotalGuests: number;
  infantAgeMax: number;
  childAgeMin: number;
  childAgeMax: number;
  adultAgeMin: number;
  extraAdultRate: number;
  extraAdultType: string;
  extraChildRate: number;
  extraChildType: string;
  cribRate: number;
  cribAvailable: boolean;
  extraBedRate: number;
  extraBedAvailable: boolean;
  rollawayRate: number;
  rollawayAvailable: boolean;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GuestRateStats {
  total: number;
  active: number;
  avgMaxGuests: number;
  cribAvailable: number;
  extraBedAvailable: number;
}

interface CalculationResult {
  baseRate: number;
  nights: number;
  baseTotal: number;
  adults: number;
  children: number;
  extraAdults: number;
  extraAdultCharge: number;
  extraChildCharge: number;
  grandTotal: number;
  breakdown: {
    extraAdults: { guest: string; amount: number; type: string }[];
    extraChildren: { guest: string; amount: number; type: string }[];
  };
  config: {
    maxAdults: number;
    maxChildren: number;
    maxTotalGuests: number;
    extraAdultType: string;
    extraChildType: string;
    currency: string;
  };
}

// ============================================================
// Constants
// ============================================================

const CHANNEL_CODES = [
  { value: 'booking_com', label: 'Booking.com' },
  { value: 'expedia', label: 'Expedia' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'agoda', label: 'Agoda' },
  { value: 'vrbo', label: 'Vrbo' },
  { value: 'google_hotel', label: 'Google Hotel' },
  { value: 'make_my_trip', label: 'MakeMyTrip' },
  { value: 'priceline', label: 'Priceline' },
  { value: 'hotels_com', label: 'Hotels.com' },
  { value: 'direct', label: 'Direct' },
  { value: 'other', label: 'Other' },
];

const RATE_TYPES = [
  { value: 'per_night', label: 'Per Night' },
  { value: 'per_stay', label: 'Per Stay' },
  { value: 'percentage_of_rate', label: '% of Rate' },
  { value: 'free', label: 'Free' },
  { value: 'sharing_bed', label: 'Sharing Bed' },
  { value: 'extra_bed', label: 'Extra Bed' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'THB', 'AED', 'SGD', 'CAD'];

// ============================================================
// Helpers
// ============================================================

function getChannelLabel(code: string) {
  return CHANNEL_CODES.find(c => c.value === code)?.label || code.replace(/_/g, ' ');
}

function getRateTypeLabel(type: string) {
  return RATE_TYPES.find(r => r.value === type)?.label || type.replace(/_/g, ' ');
}

// ============================================================
// Component
// ============================================================

export default function ChannelGuestRates() {
  const [configs, setConfigs] = useState<GuestRateConfig[]>([]);
  const [stats, setStats] = useState<GuestRateStats>({
    total: 0, active: 0, avgMaxGuests: 0, cribAvailable: 0, extraBedAvailable: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterRoomType, setFilterRoomType] = useState<string>('all');

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<GuestRateConfig | null>(null);
  const [calcDialogOpen, setCalcDialogOpen] = useState(false);
  const [calcConfigId, setCalcConfigId] = useState<string>('');
  const [calcResult, setCalcResult] = useState<CalculationResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    channelCode: '',
    connectionId: '',
    roomTypeId: '',
    ratePlanId: '',
    maxAdults: 2,
    maxChildren: 1,
    maxTotalGuests: 3,
    infantAgeMax: 2,
    childAgeMin: 2,
    childAgeMax: 12,
    adultAgeMin: 13,
    extraAdultRate: 0,
    extraAdultType: 'per_night',
    extraChildRate: 0,
    extraChildType: 'per_night',
    cribRate: 0,
    cribAvailable: true,
    extraBedRate: 0,
    extraBedAvailable: true,
    rollawayRate: 0,
    rollawayAvailable: false,
    currency: 'USD',
  });

  // Calculator state
  const [calcForm, setCalcForm] = useState({
    baseRate: 150,
    adults: 2,
    children: 0,
    nights: 1,
  });

  // ---- Fetch ----
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterChannel !== 'all') params.set('channelCode', filterChannel);
      if (filterRoomType !== 'all') params.set('roomTypeId', filterRoomType);

      const res = await fetch(`/api/channels/guest-rates?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setConfigs(result.data || []);
        setStats(result.stats || stats);
      }
    } catch {
      toast.error('Failed to load guest rate configs');
    } finally {
      setLoading(false);
    }
  }, [filterChannel, filterRoomType]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filterChannel !== 'all') params.set('channelCode', filterChannel);
        if (filterRoomType !== 'all') params.set('roomTypeId', filterRoomType);

        const res = await fetch(`/api/channels/guest-rates?${params.toString()}`);
        const result = await res.json();
        if (result.success && active) {
          setConfigs(result.data || []);
          setStats(result.stats || { total: 0, active: 0, avgMaxGuests: 0, cribAvailable: 0, extraBedAvailable: 0 });
        }
      } catch {
        // silent
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [filterChannel, filterRoomType]);

  // ---- Form helpers ----
  const resetForm = () => {
    setFormData({
      channelCode: '', connectionId: '', roomTypeId: '', ratePlanId: '',
      maxAdults: 2, maxChildren: 1, maxTotalGuests: 3,
      infantAgeMax: 2, childAgeMin: 2, childAgeMax: 12, adultAgeMin: 13,
      extraAdultRate: 0, extraAdultType: 'per_night',
      extraChildRate: 0, extraChildType: 'per_night',
      cribRate: 0, cribAvailable: true,
      extraBedRate: 0, extraBedAvailable: true,
      rollawayRate: 0, rollawayAvailable: false,
      currency: 'USD',
    });
    setEditItem(null);
  };

  const openCreate = () => { resetForm(); setEditDialogOpen(true); };

  const openEdit = (item: GuestRateConfig) => {
    setEditItem(item);
    setFormData({
      channelCode: item.channelCode,
      connectionId: item.connectionId || '',
      roomTypeId: item.roomTypeId || '',
      ratePlanId: item.ratePlanId || '',
      maxAdults: item.maxAdults,
      maxChildren: item.maxChildren,
      maxTotalGuests: item.maxTotalGuests,
      infantAgeMax: item.infantAgeMax,
      childAgeMin: item.childAgeMin,
      childAgeMax: item.childAgeMax,
      adultAgeMin: item.adultAgeMin,
      extraAdultRate: item.extraAdultRate,
      extraAdultType: item.extraAdultType,
      extraChildRate: item.extraChildRate,
      extraChildType: item.extraChildType,
      cribRate: item.cribRate,
      cribAvailable: item.cribAvailable,
      extraBedRate: item.extraBedRate,
      extraBedAvailable: item.extraBedAvailable,
      rollawayRate: item.rollawayRate,
      rollawayAvailable: item.rollawayAvailable,
      currency: item.currency,
    });
    setEditDialogOpen(true);
  };

  // ---- Save (create or update) ----
  const handleSave = async () => {
    if (!formData.channelCode) {
      toast.error('Channel is required');
      return;
    }
    setSaving(true);
    try {
      const method = editItem ? 'PUT' : 'POST';
      const payload = editItem ? { id: editItem.id, ...formData } : formData;
      const res = await fetch('/api/channels/guest-rates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(editItem ? 'Config updated' : 'Config created');
        setEditDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  // ---- Delete ----
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this guest rate config? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/channels/guest-rates?id=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast.success('Config deleted');
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  // ---- Toggle active ----
  const handleToggleActive = async (item: GuestRateConfig) => {
    try {
      const res = await fetch('/api/channels/guest-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Config ${!item.isActive ? 'activated' : 'deactivated'}`);
        fetchData();
      }
    } catch {
      toast.error('Failed to toggle');
    }
  };

  // ---- Duplicate ----
  const handleDuplicate = async (item: GuestRateConfig) => {
    try {
      const res = await fetch('/api/channels/guest-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelCode: item.channelCode,
          connectionId: item.connectionId,
          roomTypeId: item.roomTypeId,
          ratePlanId: item.ratePlanId,
          maxAdults: item.maxAdults,
          maxChildren: item.maxChildren,
          maxTotalGuests: item.maxTotalGuests,
          infantAgeMax: item.infantAgeMax,
          childAgeMin: item.childAgeMin,
          childAgeMax: item.childAgeMax,
          adultAgeMin: item.adultAgeMin,
          extraAdultRate: item.extraAdultRate,
          extraAdultType: item.extraAdultType,
          extraChildRate: item.extraChildRate,
          extraChildType: item.extraChildType,
          cribRate: item.cribRate,
          cribAvailable: item.cribAvailable,
          extraBedRate: item.extraBedRate,
          extraBedAvailable: item.extraBedAvailable,
          rollawayRate: item.rollawayRate,
          rollawayAvailable: item.rollawayAvailable,
          currency: item.currency,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Config duplicated');
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to duplicate');
      }
    } catch {
      toast.error('Failed to duplicate');
    }
  };

  // ---- Calculator ----
  const handleCalculate = async () => {
    if (!calcConfigId) { toast.error('Select a config'); return; }
    setCalcLoading(true);
    setCalcResult(null);
    try {
      const res = await fetch('/api/channels/guest-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calculate',
          configId: calcConfigId,
          baseRate: calcForm.baseRate,
          adults: calcForm.adults,
          children: calcForm.children,
          nights: calcForm.nights,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setCalcResult(result.data);
      } else {
        toast.error(result.error?.message || 'Calculation failed');
      }
    } catch {
      toast.error('Calculation failed');
    } finally {
      setCalcLoading(false);
    }
  };

  // ---- Filtered configs ----
  const filteredConfigs = configs;

  // Unique channels for filter
  const uniqueChannels = [...new Set(configs.map(c => c.channelCode))].sort();

  // ---- Loading ----
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Guest Rates & Extra Beds</h1>
          <p className="text-muted-foreground">Configure extra adult/child rates and bed policies per channel</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={calcDialogOpen} onOpenChange={setCalcDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Calculator className="h-4 w-4 mr-2" />
                Rate Calculator
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Rate Calculator</DialogTitle>
                <DialogDescription>Calculate total rate with extra guest charges</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Guest Rate Config</Label>
                  <Select value={calcConfigId} onValueChange={setCalcConfigId}>
                    <SelectTrigger><SelectValue placeholder="Select a config" /></SelectTrigger>
                    <SelectContent>
                      {configs.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {getChannelLabel(c.channelCode)} - Max {c.maxAdults}A/{c.maxChildren}C
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Base Rate / Night</Label>
                    <Input type="number" step="0.01" value={calcForm.baseRate} onChange={e => setCalcForm(p => ({ ...p, baseRate: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Nights</Label>
                    <Input type="number" min={1} value={calcForm.nights} onChange={e => setCalcForm(p => ({ ...p, nights: parseInt(e.target.value) || 1 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Adults</Label>
                    <Input type="number" min={1} value={calcForm.adults} onChange={e => setCalcForm(p => ({ ...p, adults: parseInt(e.target.value) || 1 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Children</Label>
                    <Input type="number" min={0} value={calcForm.children} onChange={e => setCalcForm(p => ({ ...p, children: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>
                <Button className="w-full" onClick={handleCalculate} disabled={calcLoading}>
                  {calcLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
                  Calculate
                </Button>
                {calcResult && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Base Total ({calcResult.nights} nights)</span>
                      <span className="font-medium">${calcResult.baseTotal.toFixed(2)}</span>
                    </div>
                    {calcResult.breakdown.extraAdults.map((ea, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{ea.guest} ({ea.type})</span>
                        <span className="font-medium text-orange-600 dark:text-orange-400">+${ea.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    {calcResult.breakdown.extraChildren.map((ec, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{ec.guest} ({ec.type})</span>
                        <span className="font-medium text-amber-600 dark:text-amber-400">+${ec.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Grand Total</span>
                      <span className="text-emerald-600 dark:text-emerald-400">${calcResult.grandTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />Max {calcResult.config.maxAdults}A/{calcResult.config.maxChildren}C
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Extra Adult: {getRateTypeLabel(calcResult.config.extraAdultType)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Extra Child: {getRateTypeLabel(calcResult.config.extraChildType)}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Config
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <Users className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Configs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active Configs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-teal-500/10 to-teal-600/5 border-teal-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-500/20">
                <Users className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgMaxGuests}</p>
                <p className="text-xs text-muted-foreground">Avg Max Guests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Bed className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.cribAvailable}</p>
                <p className="text-xs text-muted-foreground">Crib Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <BedDouble className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.extraBedAvailable}</p>
                <p className="text-xs text-muted-foreground">Extra Bed Avail.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filterChannel} onValueChange={setFilterChannel}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Channel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                {uniqueChannels.map(ch => (
                  <SelectItem key={ch} value={ch}>{getChannelLabel(ch)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filterChannel !== 'all' || filterRoomType !== 'all') && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterChannel('all'); setFilterRoomType('all'); }}>
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {filteredConfigs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No guest rate configs found</p>
            <p className="text-sm text-muted-foreground">
              {filterChannel !== 'all'
                ? 'No configs for this channel filter'
                : 'Create your first guest rate config to get started'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[600px]">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Guest Limits</TableHead>
                    <TableHead>Age Thresholds</TableHead>
                    <TableHead className="text-right">Extra Adult</TableHead>
                    <TableHead className="text-right">Extra Child</TableHead>
                    <TableHead>Crib</TableHead>
                    <TableHead>Extra Bed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConfigs.map((config) => (
                    <TableRow key={config.id} className={!config.isActive ? 'opacity-60' : ''}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {getChannelLabel(config.channelCode)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <GuestBadge type="adult" count={config.maxAdults} />
                          <GuestBadge type="child" count={config.maxChildren} />
                          <GuestBadge type="total" count={config.maxTotalGuests} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>Infant &lt;{config.infantAgeMax}y</p>
                          <p>Child {config.childAgeMin}-{config.childAgeMax}y</p>
                          <p>Adult {config.adultAgeMin}y+</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm">
                          <span className="font-medium">
                            {config.extraAdultType === 'free' ? 'Free' : `${config.extraAdultRate}${config.extraAdultType === 'percentage_of_rate' ? '%' : ''}`}
                          </span>
                          <p className="text-xs text-muted-foreground">{getRateTypeLabel(config.extraAdultType)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm">
                          <span className="font-medium">
                            {config.extraChildType === 'free' || config.extraChildType === 'sharing_bed' ? 'Free' : `${config.extraChildRate}${config.extraChildType === 'percentage_of_rate' ? '%' : ''}`}
                          </span>
                          <p className="text-xs text-muted-foreground">{getRateTypeLabel(config.extraChildType)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center gap-0.5">
                          <Badge className={config.cribAvailable ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}>
                            {config.cribAvailable ? `$${config.cribRate}` : 'N/A'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center gap-0.5">
                          <Badge className={config.extraBedAvailable ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}>
                            {config.extraBedAvailable ? `$${config.extraBedRate}` : 'N/A'}
                          </Badge>
                          {config.rollawayAvailable && (
                            <span className="text-[10px] text-muted-foreground">Rollaway ${config.rollawayRate}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={config.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}>
                          {config.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleActive(config)} title={config.isActive ? 'Deactivate' : 'Activate'}>
                            {config.isActive ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-muted-foreground" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(config)} title="Edit">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(config)} title="Duplicate">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(config.id)} title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Guest Rate Config' : 'Create Guest Rate Config'}</DialogTitle>
            <DialogDescription>
              {editItem ? 'Modify extra guest rates and bed policies' : 'Define how extra guests and children are charged on this channel'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Channel Info */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Channel & Scope</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel *</Label>
                  <Select value={formData.channelCode} onValueChange={v => setFormData(p => ({ ...p, channelCode: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                    <SelectContent>
                      {CHANNEL_CODES.map(ch => (
                        <SelectItem key={ch.value} value={ch.value}>{ch.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={formData.currency} onValueChange={v => setFormData(p => ({ ...p, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Guest Limits */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Guest Limits</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Max Adults</Label>
                  <Input type="number" min={1} max={10} value={formData.maxAdults} onChange={e => setFormData(p => ({ ...p, maxAdults: parseInt(e.target.value) || 1 }))} />
                </div>
                <div className="space-y-2">
                  <Label>Max Children</Label>
                  <Input type="number" min={0} max={10} value={formData.maxChildren} onChange={e => setFormData(p => ({ ...p, maxChildren: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label>Max Total Guests</Label>
                  <Input type="number" min={1} max={20} value={formData.maxTotalGuests} onChange={e => setFormData(p => ({ ...p, maxTotalGuests: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
            </div>

            {/* Age Thresholds */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Age Thresholds</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Infant Max Age</Label>
                  <Input type="number" min={0} max={5} value={formData.infantAgeMax} onChange={e => setFormData(p => ({ ...p, infantAgeMax: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Child Min Age</Label>
                  <Input type="number" min={0} max={18} value={formData.childAgeMin} onChange={e => setFormData(p => ({ ...p, childAgeMin: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Child Max Age</Label>
                  <Input type="number" min={0} max={21} value={formData.childAgeMax} onChange={e => setFormData(p => ({ ...p, childAgeMax: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Adult Min Age</Label>
                  <Input type="number" min={10} max={30} value={formData.adultAgeMin} onChange={e => setFormData(p => ({ ...p, adultAgeMin: parseInt(e.target.value) || 13 }))} />
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Baby className="h-4 w-4 shrink-0" />
                <span>Infant: 0-{formData.infantAgeMax}y | Child: {formData.childAgeMin}-{formData.childAgeMax}y | Adult: {formData.adultAgeMin}y+</span>
              </div>
            </div>

            {/* Extra Adult Rates */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Extra Adult Charges</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rate Type</Label>
                  <Select value={formData.extraAdultType} onValueChange={v => setFormData(p => ({ ...p, extraAdultType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RATE_TYPES.filter(r => r.value !== 'sharing_bed' && r.value !== 'extra_bed').map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.extraAdultType !== 'free' && (
                  <div className="space-y-2">
                    <Label>Rate Value {formData.extraAdultType === 'percentage_of_rate' ? '(%)' : `(${formData.currency})`}</Label>
                    <Input type="number" step="0.01" min={0} value={formData.extraAdultRate} onChange={e => setFormData(p => ({ ...p, extraAdultRate: parseFloat(e.target.value) || 0 }))} />
                  </div>
                )}
              </div>
            </div>

            {/* Extra Child Rates */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Extra Child Charges</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rate Type</Label>
                  <Select value={formData.extraChildType} onValueChange={v => setFormData(p => ({ ...p, extraChildType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RATE_TYPES.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.extraChildType !== 'free' && formData.extraChildType !== 'sharing_bed' && (
                  <div className="space-y-2">
                    <Label>Rate Value {formData.extraChildType === 'percentage_of_rate' ? '(%)' : `(${formData.currency})`}</Label>
                    <Input type="number" step="0.01" min={0} value={formData.extraChildRate} onChange={e => setFormData(p => ({ ...p, extraChildRate: parseFloat(e.target.value) || 0 }))} />
                  </div>
                )}
              </div>
            </div>

            {/* Bed Policies */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Bed Policies</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Bed className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium">Crib</p>
                      <p className="text-xs text-muted-foreground">Portable crib for infants</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={formData.cribAvailable} onCheckedChange={v => setFormData(p => ({ ...p, cribAvailable: v }))} />
                    {formData.cribAvailable && (
                      <Input type="number" step="0.01" min={0} className="w-24" placeholder="0.00" value={formData.cribRate} onChange={e => setFormData(p => ({ ...p, cribRate: parseFloat(e.target.value) || 0 }))} />
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <BedDouble className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium">Extra Bed</p>
                      <p className="text-xs text-muted-foreground">Additional bed in room</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={formData.extraBedAvailable} onCheckedChange={v => setFormData(p => ({ ...p, extraBedAvailable: v }))} />
                    {formData.extraBedAvailable && (
                      <Input type="number" step="0.01" min={0} className="w-24" placeholder="0.00" value={formData.extraBedRate} onChange={e => setFormData(p => ({ ...p, extraBedRate: parseFloat(e.target.value) || 0 }))} />
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <BedDouble className="h-5 w-5 text-slate-600" />
                    <div>
                      <p className="text-sm font-medium">Rollaway Bed</p>
                      <p className="text-xs text-muted-foreground">Portable folding bed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={formData.rollawayAvailable} onCheckedChange={v => setFormData(p => ({ ...p, rollawayAvailable: v }))} />
                    {formData.rollawayAvailable && (
                      <Input type="number" step="0.01" min={0} className="w-24" placeholder="0.00" value={formData.rollawayRate} onChange={e => setFormData(p => ({ ...p, rollawayRate: parseFloat(e.target.value) || 0 }))} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              {editItem ? 'Update Config' : 'Create Config'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Guest Composition Badge
// ============================================================

function GuestBadge({ type, count }: { type: 'adult' | 'child' | 'total'; count: number }) {
  const styles = {
    adult: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    child: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    total: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  };

  const labels = {
    adult: `${count}A`,
    child: `${count}C`,
    total: `Total ${count}`,
  };

  const icons = {
    adult: <Users className="h-3 w-3" />,
    child: <Baby className="h-3 w-3" />,
    total: <Users className="h-3 w-3" />,
  };

  return (
    <Badge className={`${styles[type]} text-xs px-1.5 py-0`}>
      {icons[type]}
      <span className="ml-1">{labels[type]}</span>
    </Badge>
  );
}
