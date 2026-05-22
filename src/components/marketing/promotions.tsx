'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';
import { format, parseISO, isWithinInterval, addDays } from 'date-fns';
import { useTranslations } from 'next-intl';
import {
  Tag,
  Plus,
  Search,
  Copy,
  Edit,
  Pause,
  Play,
  Trash2,
  Percent,
  DollarSign,
  Moon,
  Loader2,
  TagIcon,
  CalendarClock,
  Sparkles,
  AlertTriangle,
  X,
  RefreshCw,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Promotion {
  id: string;
  name: string;
  code: string;
  description: string | null;
  discountType: 'percentage' | 'fixed_amount' | 'free_night';
  discountValue: number;
  maxDiscount: number | null;
  minBookingValue: number | null;
  minNights: number | null;
  applicableRoomTypes: string;
  startsAt: string;
  endsAt: string;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerUser: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface PromotionStats {
  total: number;
  active: number;
  totalSavings: number;
  expiringSoon: number;
}

interface RoomType {
  id: string;
  name: string;
}

interface PromotionFormData {
  name: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed_amount' | 'free_night';
  discountValue: string;
  maxDiscount: string;
  minBookingValue: string;
  minNights: string;
  applicableRoomTypes: string[];
  startsAt: string;
  endsAt: string;
  maxUses: string;
  maxUsesPerUser: string;
  status: 'active' | 'paused';
}

const emptyForm: PromotionFormData = {
  name: '',
  code: '',
  description: '',
  discountType: 'percentage',
  discountValue: '',
  maxDiscount: '',
  minBookingValue: '',
  minNights: '',
  applicableRoomTypes: [],
  startsAt: '',
  endsAt: '',
  maxUses: '',
  maxUsesPerUser: '',
  status: 'active',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generatePromoCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'PROMO';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getStatusConfig(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    active: {
      label: 'Active',
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    },
    paused: {
      label: 'Paused',
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    },
    expired: {
      label: 'Expired',
      className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    },
    depleted: {
      label: 'Depleted',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    },
  };
  return map[status] || map.paused;
}

function getDiscountDisplay(promo: Promotion, currencySymbol: string): string {
  if (promo.discountType === 'percentage') return `${promo.discountValue}% OFF`;
  if (promo.discountType === 'fixed_amount') return `${currencySymbol}${promo.discountValue} OFF`;
  if (promo.discountType === 'free_night') return `${Math.round(promo.discountValue)} Free Night${Math.round(promo.discountValue) > 1 ? 's' : ''}`;
  return `${promo.discountValue} OFF`;
}

function getDiscountIcon(type: string) {
  if (type === 'percentage') return Percent;
  if (type === 'fixed_amount') return DollarSign;
  if (type === 'free_night') return Moon;
  return Tag;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Promotions() {
  const t = useTranslations('marketing');
  const { formatCurrency, currency } = useCurrency();

  // Data state
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [stats, setStats] = useState<PromotionStats>({ total: 0, active: 0, totalSavings: 0, expiringSoon: 0 });
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [discountFilter, setDiscountFilter] = useState('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PromotionFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ─── Data fetching ──────────────────────────────────────────────────────

  const fetchPromotions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.set('status', activeTab);
      if (searchQuery) params.set('search', searchQuery);
      if (discountFilter !== 'all') params.set('type', discountFilter);

      const res = await fetch(`/api/marketing/promotions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      if (json.success) {
        setPromotions(json.data?.promotions || []);
        if (json.data?.stats) setStats(json.data.stats);
      }
    } catch {
      toast.error('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, discountFilter]);

  const fetchRoomTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/room-types?limit=100');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setRoomTypes(json.data.map((rt: { id: string; name: string }) => ({ id: rt.id, name: rt.name })));
        }
      }
    } catch {
      // Room types are optional for the form; silently fail
    }
  }, []);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  useEffect(() => {
    fetchRoomTypes();
  }, [fetchRoomTypes]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setFormData({
      ...emptyForm,
      code: generatePromoCode(),
      startsAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endsAt: format(addDays(new Date(), 30), "yyyy-MM-dd'T'HH:mm"),
    });
    setDialogOpen(true);
  };

  const openEdit = (promo: Promotion) => {
    setEditingId(promo.id);
    const roomTypeIds: string[] = (() => {
      try { return JSON.parse(promo.applicableRoomTypes); } catch { return []; }
    })();
    setFormData({
      name: promo.name,
      code: promo.code,
      description: promo.description || '',
      discountType: promo.discountType as PromotionFormData['discountType'],
      discountValue: String(promo.discountValue),
      maxDiscount: promo.maxDiscount ? String(promo.maxDiscount) : '',
      minBookingValue: promo.minBookingValue ? String(promo.minBookingValue) : '',
      minNights: promo.minNights ? String(promo.minNights) : '',
      applicableRoomTypes: roomTypeIds,
      startsAt: format(parseISO(promo.startsAt), "yyyy-MM-dd'T'HH:mm"),
      endsAt: format(parseISO(promo.endsAt), "yyyy-MM-dd'T'HH:mm"),
      maxUses: promo.maxUses ? String(promo.maxUses) : '',
      maxUsesPerUser: promo.maxUsesPerUser ? String(promo.maxUsesPerUser) : '',
      status: (promo.status === 'active' || promo.status === 'paused') ? promo.status : 'paused',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.code.trim() || !formData.discountValue || !formData.startsAt || !formData.endsAt) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        discountValue: parseFloat(formData.discountValue),
        maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : null,
        minBookingValue: formData.minBookingValue ? parseFloat(formData.minBookingValue) : null,
        minNights: formData.minNights ? parseInt(formData.minNights, 10) : null,
        maxUses: formData.maxUses ? parseInt(formData.maxUses, 10) : null,
        maxUsesPerUser: formData.maxUsesPerUser ? parseInt(formData.maxUsesPerUser, 10) : null,
      };

      const url = editingId
        ? '/api/marketing/promotions'
        : '/api/marketing/promotions';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { id: editingId, ...payload } : payload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || err?.message || 'Failed to save promotion');
      }

      toast.success(editingId ? 'Promotion updated successfully' : 'Promotion created successfully');
      setDialogOpen(false);
      fetchPromotions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save promotion');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (promo: Promotion) => {
    const newStatus = promo.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch('/api/marketing/promotions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: promo.id, status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Promotion ${newStatus === 'active' ? 'activated' : 'paused'}`);
      fetchPromotions();
    } catch {
      toast.error('Failed to update promotion status');
    }
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const res = await fetch(`/api/marketing/promotions?id=${deletingId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Promotion deleted');
      setDeleteDialogOpen(false);
      setDeletingId(null);
      fetchPromotions();
    } catch {
      toast.error('Failed to delete promotion');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Promo code copied to clipboard');
  };

  const updateForm = (field: keyof PromotionFormData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ─── Derived data ─────────────────────────────────────────────────────────

  const roomTypeMap = new Map(roomTypes.map((rt) => [rt.id, rt.name]));

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Promotions &amp; Offers</h2>
          <p className="text-muted-foreground">Manage discount codes, seasonal packages, and special offers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPromotions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Promotion
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Promotions</CardTitle>
              <TagIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All promotions created</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Promotions</CardTitle>
              <Sparkles className="h-4 w-4 text-green-500 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.active}</div>
              <p className="text-xs text-muted-foreground">Currently running</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Savings Offered</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalSavings)}</div>
              <p className="text-xs text-muted-foreground">Cumulative discount value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
              <CalendarClock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.expiringSoon}</div>
              <p className="text-xs text-muted-foreground">Ending within 7 days</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs + Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="all">All Promotions</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
          </TabsList>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or code..."
                className="pl-9 w-full sm:w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <Select value={discountFilter} onValueChange={setDiscountFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                <SelectItem value="free_night">Free Night</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* All tabs share the same grid content — data is already filtered server-side */}
        <TabsContent value={activeTab} className="mt-0">
          {loading ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-2 w-full" />
                    <div className="flex gap-2">
                      <Skeleton className="h-7 w-16 rounded-full" />
                      <Skeleton className="h-7 w-16 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : promotions.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No promotions found"
              description={
                activeTab === 'all' && !searchQuery
                  ? 'Create your first promotional offer to attract more guests and boost bookings.'
                  : 'Try adjusting your search or filter criteria, or create a new promotion.'
              }
              action={
                activeTab === 'all' && !searchQuery
                  ? { label: 'Create Promotion', onClick: openCreate }
                  : undefined
              }
            />
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {promotions.map((promo) => {
                const statusCfg = getStatusConfig(promo.status);
                const DiscountIcon = getDiscountIcon(promo.discountType);
                const roomTypeIds: string[] = (() => {
                  try { return JSON.parse(promo.applicableRoomTypes); } catch { return []; }
                })();
                const usagePercent = promo.maxUses ? Math.min((promo.usedCount / promo.maxUses) * 100, 100) : null;
                const isExpiringSoon =
                  promo.status === 'active' &&
                  isWithinInterval(new Date(), { start: new Date(), end: addDays(new Date(), 7) }) &&
                  isWithinInterval(parseISO(promo.endsAt), { start: new Date(), end: addDays(new Date(), 7) });

                return (
                  <Card
                    key={promo.id}
                    className={`relative transition-shadow hover:shadow-md ${promo.status === 'expired' ? 'opacity-70' : ''}`}
                  >
                    {isExpiringSoon && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400 rounded-t-lg" />
                    )}

                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base font-semibold truncate">{promo.name}</CardTitle>
                        </div>
                        <Badge variant="secondary" className={statusCfg.className}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Promo code */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0 bg-muted rounded-md px-3 py-1.5">
                          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <code className="text-sm font-mono font-semibold tracking-wider truncate">{promo.code}</code>
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0" onClick={() => copyCode(promo.code)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Discount display */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 shrink-0">
                          <DiscountIcon className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-xl font-bold text-primary">
                          {getDiscountDisplay(promo, currency.symbol)}
                        </span>
                        {promo.discountType === 'percentage' && promo.maxDiscount && (
                          <span className="text-xs text-muted-foreground">max {formatCurrency(promo.maxDiscount)}</span>
                        )}
                      </div>

                      {/* Date range */}
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Valid: {format(parseISO(promo.startsAt), 'MMM d')} &ndash; {format(parseISO(promo.endsAt), 'MMM d, yyyy')}
                        </span>
                      </div>

                      {/* Usage progress */}
                      {promo.maxUses ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Usage</span>
                            <span className="font-medium">
                              {promo.usedCount} / {promo.maxUses}
                              {usagePercent !== null && usagePercent >= 90 && (
                                <AlertTriangle className="inline h-3 w-3 ml-1 text-amber-500" />
                              )}
                            </span>
                          </div>
                          <Progress value={usagePercent || 0} className="h-2" />
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          Used {promo.usedCount} times &bull; Unlimited uses
                        </div>
                      )}

                      {/* Restrictions */}
                      {(promo.minBookingValue || promo.minNights) && (
                        <div className="flex flex-wrap gap-1.5">
                          {promo.minBookingValue && (
                            <Badge variant="outline" className="text-xs font-normal">
                              Min booking {formatCurrency(promo.minBookingValue)}
                            </Badge>
                          )}
                          {promo.minNights && (
                            <Badge variant="outline" className="text-xs font-normal">
                              Min {promo.minNights} night{promo.minNights > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {promo.maxUsesPerUser && (
                            <Badge variant="outline" className="text-xs font-normal">
                              Max {promo.maxUsesPerUser} per user
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Room types */}
                      {roomTypeIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {roomTypeIds.map((rtId) => {
                            const name = roomTypeMap.get(rtId);
                            if (!name) return null;
                            return (
                              <Badge key={rtId} variant="secondary" className="text-xs">
                                {name}
                              </Badge>
                            );
                          })}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 pt-2 border-t">
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => openEdit(promo)}>
                          <Edit className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        {(promo.status === 'active' || promo.status === 'paused') && (
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => toggleStatus(promo)}>
                            {promo.status === 'active' ? (
                              <>
                                <Pause className="h-3.5 w-3.5 mr-1" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5 mr-1" />
                                Activate
                              </>
                            )}
                          </Button>
                        )}
                        <div className="flex-1" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => confirmDelete(promo.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Create / Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Promotion' : 'Create Promotion'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update your promotional offer details.' : 'Set up a new discount code, seasonal package, or special offer.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Basic Info */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Basic Info</h3>

              <div className="space-y-2">
                <Label htmlFor="promo-name">Name *</Label>
                <Input
                  id="promo-name"
                  placeholder="e.g., Summer Sale 20% Off"
                  value={formData.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="promo-code">Promo Code *</Label>
                <div className="flex gap-2">
                  <Input
                    id="promo-code"
                    placeholder="e.g., SUMMER20"
                    className="font-mono uppercase"
                    value={formData.code}
                    onChange={(e) => updateForm('code', e.target.value.toUpperCase())}
                  />
                  <Button variant="outline" onClick={() => updateForm('code', generatePromoCode())} type="button">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="promo-desc">Description</Label>
                <Textarea
                  id="promo-desc"
                  placeholder="Describe your promotion..."
                  rows={2}
                  value={formData.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                />
              </div>
            </section>

            {/* Discount */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Discount</h3>

              <div className="space-y-2">
                <Label>Discount Type *</Label>
                <Select
                  value={formData.discountType}
                  onValueChange={(v) => updateForm('discountType', v as PromotionFormData['discountType'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount ({currency.symbol})</SelectItem>
                    <SelectItem value="free_night">Free Night</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount-value">Discount Value *</Label>
                <div className="relative">
                  <Input
                    id="discount-value"
                    type="number"
                    min={0}
                    step={formData.discountType === 'percentage' ? '1' : '1'}
                    value={formData.discountValue}
                    onChange={(e) => updateForm('discountValue', e.target.value)}
                    className={
                      formData.discountType === 'free_night'
                        ? 'pr-20'
                        : formData.discountType === 'percentage'
                        ? 'pr-10'
                        : 'pr-14'
                    }
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    {formData.discountType === 'percentage'
                      ? '%'
                      : formData.discountType === 'fixed_amount'
                      ? currency.symbol
                      : formData.discountValue === '1'
                      ? 'night'
                      : 'nights'}
                  </span>
                </div>
              </div>

              {formData.discountType === 'percentage' && (
                <div className="space-y-2">
                  <Label htmlFor="max-discount">Max Discount Cap ({currency.symbol})</Label>
                  <Input
                    id="max-discount"
                    type="number"
                    min={0}
                    placeholder="e.g., 2000"
                    value={formData.maxDiscount}
                    onChange={(e) => updateForm('maxDiscount', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Maximum discount amount for percentage-based offers</p>
                </div>
              )}
            </section>

            {/* Restrictions */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Restrictions</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min-booking">Min Booking Value ({currency.symbol})</Label>
                  <Input
                    id="min-booking"
                    type="number"
                    min={0}
                    placeholder="e.g., 5000"
                    value={formData.minBookingValue}
                    onChange={(e) => updateForm('minBookingValue', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min-nights">Min Nights</Label>
                  <Input
                    id="min-nights"
                    type="number"
                    min={0}
                    placeholder="e.g., 2"
                    value={formData.minNights}
                    onChange={(e) => updateForm('minNights', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Applicable Room Types</Label>
                {roomTypes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No room types found. Room type filtering will be unavailable.</p>
                ) : (
                  <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                    {roomTypes.map((rt) => {
                      const isSelected = formData.applicableRoomTypes.includes(rt.id);
                      return (
                        <label
                          key={rt.id}
                          className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted rounded px-2 py-1"
                        >
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                updateForm('applicableRoomTypes', [...formData.applicableRoomTypes, rt.id]);
                              } else {
                                updateForm(
                                  'applicableRoomTypes',
                                  formData.applicableRoomTypes.filter((id) => id !== rt.id)
                                );
                              }
                            }}
                          />
                          <span>{rt.name}</span>
                        </label>
                      );
                    })}
                    <p className="text-xs text-muted-foreground pt-1">
                      Leave empty to apply to all room types
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Schedule */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Schedule</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="starts-at">Start Date *</Label>
                  <Input
                    id="starts-at"
                    type="datetime-local"
                    value={formData.startsAt}
                    onChange={(e) => updateForm('startsAt', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ends-at">End Date *</Label>
                  <Input
                    id="ends-at"
                    type="datetime-local"
                    value={formData.endsAt}
                    onChange={(e) => updateForm('endsAt', e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Usage Limits */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Usage Limits</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-uses">Max Total Uses</Label>
                  <Input
                    id="max-uses"
                    type="number"
                    min={0}
                    placeholder="e.g., 100"
                    value={formData.maxUses}
                    onChange={(e) => updateForm('maxUses', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave empty for unlimited</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-per-user">Max Uses Per User</Label>
                  <Input
                    id="max-per-user"
                    type="number"
                    min={0}
                    placeholder="e.g., 1"
                    value={formData.maxUsesPerUser}
                    onChange={(e) => updateForm('maxUsesPerUser', e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Status toggle */}
            {!editingId && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Status</Label>
                    <p className="text-xs text-muted-foreground">
                      {formData.status === 'active'
                        ? 'Promotion will be active immediately upon creation'
                        : 'Promotion will be created in paused state'}
                    </p>
                  </div>
                  <Switch
                    checked={formData.status === 'active'}
                    onCheckedChange={(checked) => updateForm('status', checked ? 'active' : 'paused')}
                  />
                </div>
              </section>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'Update Promotion' : 'Create Promotion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─────────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promotion</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The promotion code will be permanently removed and any existing
              bookings using this code will not be affected, but the code will no longer be valid for new bookings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Promotion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
