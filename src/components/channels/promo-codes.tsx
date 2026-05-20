'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Tag,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Search,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Filter,
  Zap,
  Gift,
  CalendarDays,
  BarChart3,
  ArrowDownRight,
  Copy,
  Hash,
  Percent,
  DollarSign,
  Moon,
  Info,
  ShieldAlert,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// ============================================
// TYPES
// ============================================

interface ChannelConnectionItem {
  id: string;
  channel: string;
  displayName: string | null;
  status: string;
}

interface PromoCode {
  id: string;
  tenantId: string;
  propertyId: string | null;
  connectionId: string | null;
  channelCode: string;
  promoCode: string;
  promoName: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  currency: string;
  freeNights: number | null;
  minStay: number | null;
  maxStay: number | null;
  applicableRoomTypes: string | null;
  applicableRatePlans: string | null;
  validFrom: string;
  validTo: string;
  bookingWindowFrom: string | null;
  bookingWindowTo: string | null;
  stayDateFrom: string | null;
  stayDateTo: string | null;
  blackoutDates: string | null;
  usageLimit: number | null;
  usageCount: number;
  channelPromoId: string | null;
  channelPromoCode: string | null;
  syncStatus: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  connection?: { id: string; channel: string; displayName: string | null; status: string } | null;
  status?: string;
  isValid?: boolean;
  remaining?: number | null;
}

interface ValidationForm {
  promoCode: string;
  checkIn: string;
  checkOut: string;
  baseRate: string;
}

interface ValidationFormState {
  form: ValidationForm;
  result: ValidationFormResult | null;
  loading: boolean;
}

interface ValidationFormResult {
  isValid: boolean;
  promoCode: string;
  promoName?: string;
  reason?: string;
  errors?: string[];
  discountType?: string;
  discountValue?: number;
  currency?: string;
  freeNights?: number | null;
  nights?: number;
  baseRate: number;
  discountAmount: number;
  discountedRate: number;
  remaining?: number | null;
  description?: string;
}

interface PromoFormData {
  promoCode: string;
  promoName: string;
  description: string;
  connectionId: string;
  channelCode: string;
  discountType: string;
  discountValue: string;
  currency: string;
  freeNights: string;
  minStay: string;
  maxStay: string;
  applicableRoomTypes: string;
  applicableRatePlans: string;
  validFrom: string;
  validTo: string;
  bookingWindowFrom: string;
  bookingWindowTo: string;
  stayDateFrom: string;
  stayDateTo: string;
  usageLimit: string;
  channelPromoCode: string;
  isActive: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const DISCOUNT_TYPE_OPTIONS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  percentage: { label: 'Percentage Off', icon: <Percent className="h-4 w-4" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0' },
  fixed_amount: { label: 'Fixed Amount Off', icon: <DollarSign className="h-4 w-4" />, color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-0' },
  free_nights: { label: 'Free Nights', icon: <Moon className="h-4 w-4" />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0' },
};

function generatePromoCode(): string {
  const prefixes = ['SUMMER', 'WINTER', 'SPRING', 'FALL', 'EARLY', 'LAST', 'FLASH', 'WEEKEND', 'MEMBER', 'LOYAL', 'SAVE', 'DEAL'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(Math.random() * 90 + 10);
  const suffix = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `${prefix}${num}${suffix}`;
}

// ============================================
// COMPONENT
// ============================================

export function ChannelPromoCodes() {
  // Data
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [connections, setConnections] = useState<ChannelConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Summary stats
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, upcoming: 0, totalUsage: 0, synced: 0 });

  // Filters
  const [filterConnection, setFilterConnection] = useState<string>('all');
  const [filterValidity, setFilterValidity] = useState<string>('all');
  const [filterSync, setFilterSync] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPromo, setDeletingPromo] = useState<PromoCode | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Validation tool
  const [validation, setValidation] = useState<ValidationFormState>({
    form: { promoCode: '', checkIn: '', checkOut: '', baseRate: '200' },
    result: null,
    loading: false,
  });

  // Form data
  const emptyForm: PromoFormData = {
    promoCode: '',
    promoName: '',
    description: '',
    connectionId: '',
    channelCode: '',
    discountType: 'percentage',
    discountValue: '15',
    currency: 'USD',
    freeNights: '',
    minStay: '',
    maxStay: '',
    applicableRoomTypes: '',
    applicableRatePlans: '',
    validFrom: '',
    validTo: '',
    bookingWindowFrom: '',
    bookingWindowTo: '',
    stayDateFrom: '',
    stayDateTo: '',
    usageLimit: '',
    channelPromoCode: '',
    isActive: true,
  };
  const [formData, setFormData] = useState<PromoFormData>(emptyForm);

  // ============================================
  // FETCH DATA
  // ============================================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [promosRes, connectionsRes] = await Promise.all([
        fetch('/api/channels/promo-codes'),
        fetch('/api/channels/connections'),
      ]);

      const [promosData, connData] = await Promise.all([
        promosRes.json(),
        connectionsRes.json(),
      ]);

      if (promosData.success) {
        setPromos(promosData.data.promos || []);
        setStats(promosData.data.summary || { total: 0, active: 0, expired: 0, upcoming: 0, totalUsage: 0, synced: 0 });
      }
      if (connData.success) setConnections(connData.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  }, []);

  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    fetchData();
  });

  // Set default validation dates
  useEffect(() => {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 7);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 3);
    setValidation((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        checkIn: format(checkIn, 'yyyy-MM-dd'),
        checkOut: format(checkOut, 'yyyy-MM-dd'),
      },
    }));
  }, []);

  // ============================================
  // FORM HELPERS
  // ============================================
  const resetForm = () => {
    setFormData(emptyForm);
    setEditingPromo(null);
  };

  const openCreateDialog = () => {
    resetForm();
    // Set default validFrom to today and validTo to 30 days
    const today = format(new Date(), 'yyyy-MM-dd');
    const thirty = format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    setFormData((prev) => ({ ...prev, validFrom: today, validTo: thirty }));
    setDialogOpen(true);
  };

  const openEditDialog = (promo: PromoCode) => {
    setEditingPromo(promo);
    setFormData({
      promoCode: promo.promoCode,
      promoName: promo.promoName,
      description: promo.description || '',
      connectionId: promo.connectionId || '',
      channelCode: promo.channelCode,
      discountType: promo.discountType,
      discountValue: promo.discountValue.toString(),
      currency: promo.currency,
      freeNights: promo.freeNights?.toString() || '',
      minStay: promo.minStay?.toString() || '',
      maxStay: promo.maxStay?.toString() || '',
      applicableRoomTypes: promo.applicableRoomTypes || '',
      applicableRatePlans: promo.applicableRatePlans || '',
      validFrom: format(new Date(promo.validFrom), 'yyyy-MM-dd'),
      validTo: format(new Date(promo.validTo), 'yyyy-MM-dd'),
      bookingWindowFrom: promo.bookingWindowFrom ? format(new Date(promo.bookingWindowFrom), 'yyyy-MM-dd') : '',
      bookingWindowTo: promo.bookingWindowTo ? format(new Date(promo.bookingWindowTo), 'yyyy-MM-dd') : '',
      stayDateFrom: promo.stayDateFrom ? format(new Date(promo.stayDateFrom), 'yyyy-MM-dd') : '',
      stayDateTo: promo.stayDateTo ? format(new Date(promo.stayDateTo), 'yyyy-MM-dd') : '',
      usageLimit: promo.usageLimit?.toString() || '',
      channelPromoCode: promo.channelPromoCode || '',
      isActive: promo.isActive,
    });
    setDialogOpen(true);
  };

  // ============================================
  // CRUD OPERATIONS
  // ============================================
  const handleSave = async () => {
    if (!formData.promoName.trim()) {
      toast.error('Promo name is required');
      return;
    }
    if (!formData.promoCode.trim()) {
      toast.error('Promo code is required');
      return;
    }
    if (!formData.channelCode) {
      toast.error('Channel code is required');
      return;
    }
    if (!formData.validFrom || !formData.validTo) {
      toast.error('Validity period is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        connectionId: formData.connectionId || null,
        channelCode: formData.channelCode,
        promoCode: formData.promoCode.trim().toUpperCase(),
        promoName: formData.promoName.trim(),
        description: formData.description.trim() || null,
        discountType: formData.discountType,
        discountValue: parseFloat(formData.discountValue) || 0,
        currency: formData.currency,
        freeNights: formData.freeNights ? parseInt(formData.freeNights, 10) : null,
        minStay: formData.minStay ? parseInt(formData.minStay, 10) : null,
        maxStay: formData.maxStay ? parseInt(formData.maxStay, 10) : null,
        applicableRoomTypes: formData.applicableRoomTypes.trim() || null,
        applicableRatePlans: formData.applicableRatePlans.trim() || null,
        validFrom: formData.validFrom,
        validTo: formData.validTo,
        bookingWindowFrom: formData.bookingWindowFrom || null,
        bookingWindowTo: formData.bookingWindowTo || null,
        stayDateFrom: formData.stayDateFrom || null,
        stayDateTo: formData.stayDateTo || null,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit, 10) : null,
        channelPromoCode: formData.channelPromoCode.trim() || null,
        isActive: formData.isActive,
      };

      const url = '/api/channels/promo-codes';
      const method = editingPromo ? 'PUT' : 'POST';
      const body = editingPromo ? { id: editingPromo.id, ...payload } : payload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editingPromo ? 'Promo code updated successfully' : 'Promo code created successfully');
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to save promo code');
      }
    } catch {
      toast.error('Network error saving promo code');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // SYNC
  // ============================================
  const handleSync = async (promoId?: string) => {
    const connId = promoId
      ? promos.find((p) => p.id === promoId)?.connectionId
      : filterConnection;

    if (!connId || connId === 'all') {
      toast.error('Select a channel connection to sync');
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch('/api/channels/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', connectionId: connId, ...(promoId ? { promoId } : {}) }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.data.message);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Sync failed');
      }
    } catch {
      toast.error('Network error during sync');
    } finally {
      setSyncing(false);
    }
  };

  // ============================================
  // DELETE
  // ============================================
  const handleDelete = async () => {
    if (!deletingPromo) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/channels/promo-codes?id=${deletingPromo.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Promo code deleted successfully');
        setDeleteDialogOpen(false);
        setDeletingPromo(null);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to delete promo code');
      }
    } catch {
      toast.error('Network error deleting promo code');
    } finally {
      setDeleting(false);
    }
  };

  // ============================================
  // VALIDATION TOOL
  // ============================================
  const handleValidate = async () => {
    if (!validation.form.promoCode.trim()) {
      toast.error('Enter a promo code');
      return;
    }
    if (!validation.form.checkIn || !validation.form.checkOut) {
      toast.error('Enter check-in and check-out dates');
      return;
    }

    setValidation((prev) => ({ ...prev, loading: true, result: null }));
    try {
      const res = await fetch('/api/channels/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate',
          promoCode: validation.form.promoCode.trim(),
          checkIn: validation.form.checkIn,
          checkOut: validation.form.checkOut,
          baseRate: parseFloat(validation.form.baseRate) || 0,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setValidation((prev) => ({ ...prev, result: data.data }));
      } else {
        toast.error(data.error?.message || 'Validation failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setValidation((prev) => ({ ...prev, loading: false }));
    }
  };

  // ============================================
  // FILTERED PROMOS
  // ============================================
  const filteredPromos = promos.filter((p) => {
    if (filterConnection !== 'all' && p.connectionId !== filterConnection) return false;
    if (filterValidity === 'active' && p.status !== 'active') return false;
    if (filterValidity === 'expired' && p.status !== 'expired') return false;
    if (filterValidity === 'upcoming' && p.status !== 'upcoming') return false;
    if (filterSync === 'synced' && p.syncStatus !== 'synced') return false;
    if (filterSync === 'pending' && p.syncStatus !== 'pending') return false;
    if (filterSync === 'failed' && p.syncStatus !== 'failed') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.promoCode.toLowerCase().includes(q) ||
        p.promoName.toLowerCase().includes(q) ||
        p.channelCode.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ============================================
  // RENDER HELPERS
  // ============================================
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800/30 dark:text-slate-400 border-0 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      case 'upcoming':
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs">
            <CalendarDays className="h-3 w-3 mr-1" />
            Upcoming
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-xs">{status || 'Unknown'}</Badge>;
    }
  };

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Synced
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const getDiscountBadge = (type: string, value: number, currency?: string) => {
    const cfg = DISCOUNT_TYPE_OPTIONS[type];
    switch (type) {
      case 'percentage':
        return (
          <Badge className={`${cfg?.color || ''} text-xs font-mono`}>
            {value}% OFF
          </Badge>
        );
      case 'fixed_amount':
        return (
          <Badge className={`${cfg?.color || ''} text-xs font-mono`}>
            {currency || 'USD'} {value} OFF
          </Badge>
        );
      case 'free_nights':
        return (
          <Badge className={`${cfg?.color || ''} text-xs font-mono`}>
            {value} FREE
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-xs">{value}</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-72 rounded" />
            <Skeleton className="h-4 w-96 mt-2 rounded" />
          </div>
          <Skeleton className="h-10 w-32 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Tag className="h-6 w-6 text-primary" />
            Promo Code Distribution
          </h1>
          <p className="text-muted-foreground mt-1">
            Create promotional rate codes and distribute them to OTA channels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Promo
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <Tag className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Promos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {stats.active}
                </p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                  {stats.expired}
                </p>
                <p className="text-xs text-muted-foreground">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-sky-500/10 to-sky-600/5 border-sky-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/20">
                <BarChart3 className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-sky-700 dark:text-sky-400 tabular-nums">
                  {stats.totalUsage}
                </p>
                <p className="text-xs text-muted-foreground">Total Usage</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Promo Validation Tool */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Search className="h-4 w-4" />
            Promo Validation Tool
          </CardTitle>
          <CardDescription className="text-xs">
            Test if a promo code is valid for specific dates and see the discounted rate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-end gap-4">
            <div className="space-y-2 min-w-[160px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Promo Code
              </Label>
              <Input
                value={validation.form.promoCode}
                onChange={(e) => setValidation((prev) => ({ ...prev, form: { ...prev.form, promoCode: e.target.value.toUpperCase() } }))}
                placeholder="e.g. SUMMER25"
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-2 min-w-[150px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Check-in
              </Label>
              <Input
                type="date"
                value={validation.form.checkIn}
                onChange={(e) => setValidation((prev) => ({ ...prev, form: { ...prev.form, checkIn: e.target.value } }))}
              />
            </div>
            <div className="space-y-2 min-w-[150px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Check-out
              </Label>
              <Input
                type="date"
                value={validation.form.checkOut}
                onChange={(e) => setValidation((prev) => ({ ...prev, form: { ...prev.form, checkOut: e.target.value } }))}
              />
            </div>
            <div className="space-y-2 min-w-[120px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Base Rate ($)
              </Label>
              <Input
                type="number"
                value={validation.form.baseRate}
                onChange={(e) => setValidation((prev) => ({ ...prev, form: { ...prev.form, baseRate: e.target.value } }))}
                placeholder="200"
                min="0"
                step="0.01"
              />
            </div>
            <Button
              onClick={handleValidate}
              disabled={validation.loading || !validation.form.promoCode}
              className="gap-2"
            >
              {validation.loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Validate
            </Button>
          </div>

          {/* Validation Result */}
          {validation.result && (
            <div className="mt-4 p-4 rounded-lg border bg-muted/30">
              {validation.result.isValid ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      Valid Promo Code: {validation.result.promoCode}
                    </span>
                    {getStatusBadge('active')}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Promo Name</p>
                      <p className="text-sm font-semibold">{validation.result.promoName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Discount</p>
                      <div className="mt-1">
                        {getDiscountBadge(
                          validation.result.discountType || 'percentage',
                          validation.result.discountValue || 0,
                          validation.result.currency
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Base Rate</p>
                      <p className="text-sm font-semibold tabular-nums">${validation.result.baseRate.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Discounted Rate</p>
                      <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        ${validation.result.discountedRate.toFixed(2)}
                      </p>
                      {validation.result.discountAmount > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <ArrowDownRight className="h-3 w-3 text-emerald-500" />
                          Save ${validation.result.discountAmount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                  {validation.result.remaining !== null && validation.result.remaining !== undefined && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Remaining uses:</span> {validation.result.remaining}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-400">
                      Invalid: {validation.result.promoCode}
                    </p>
                    {validation.result.errors && validation.result.errors.length > 0 ? (
                      <ul className="mt-1 text-sm text-muted-foreground list-disc list-inside space-y-0.5">
                        {validation.result.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">{validation.result.reason}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Search className="h-3 w-3" />
                Search
              </Label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code, name, or channel..."
                className="h-9"
              />
            </div>
            <div className="space-y-2 min-w-[180px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Channel
              </Label>
              <Select value={filterConnection} onValueChange={setFilterConnection}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="All channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  {connections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.displayName || conn.channel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-[140px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Validity
              </Label>
              <Select value={filterValidity} onValueChange={setFilterValidity}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-[130px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Sync
              </Label>
              <Select value={filterSync} onValueChange={setFilterSync}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="synced">Synced</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSync()}
                disabled={syncing || !filterConnection || filterConnection === 'all'}
                className="gap-1"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Sync All
              </Button>
              <span className="text-xs text-muted-foreground self-center whitespace-nowrap">
                {filteredPromos.length} of {promos.length}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Promo Codes Table */}
      {filteredPromos.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Valid Period</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sync</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPromos.map((promo) => (
                    <TableRow key={promo.id} className={!promo.isActive ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs font-mono font-semibold bg-muted px-1.5 py-0.5 rounded">
                            {promo.promoCode}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                            onClick={() => {
                              navigator.clipboard.writeText(promo.promoCode);
                              toast.success('Copied!');
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-sm truncate max-w-[180px]">{promo.promoName}</p>
                        {promo.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{promo.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {getDiscountBadge(promo.discountType, promo.discountValue, promo.currency)}
                      </TableCell>
                      <TableCell>
                        {promo.connection ? (
                          <Badge variant="secondary" className="text-xs">
                            {promo.connection.displayName || promo.connection.channel}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {promo.channelCode}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <p>{formatDate(promo.validFrom)} — {formatDate(promo.validTo)}</p>
                          {promo.minStay && <p className="text-muted-foreground">Min {promo.minStay} nights</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <span className="font-medium tabular-nums">{promo.usageCount}</span>
                          {promo.usageLimit ? (
                            <span className="text-muted-foreground"> / {promo.usageLimit}</span>
                          ) : (
                            <span className="text-muted-foreground"> / ∞</span>
                          )}
                          {promo.usageLimit && promo.usageLimit > 0 && (
                            <div className="mt-1 w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  promo.usageCount >= promo.usageLimit
                                    ? 'bg-red-500'
                                    : promo.usageCount >= promo.usageLimit * 0.8
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, (promo.usageCount / promo.usageLimit) * 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(promo.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {getSyncStatusBadge(promo.syncStatus)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSync(promo.id)}
                            disabled={syncing || !promo.connectionId}
                            className="h-8 w-8 p-0"
                            title="Sync to channel"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(promo)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingPromo(promo);
                              setDeleteDialogOpen(true);
                            }}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Tag className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Promo Codes Found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              {promos.length > 0
                ? 'No promo codes match the current filters. Try adjusting your search criteria.'
                : 'Create your first promo code to distribute promotional rates across OTA channels.'}
            </p>
            {promos.length === 0 && (
              <Button onClick={openCreateDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create First Promo
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">How Promo Code Distribution Works</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>Percentage:</strong> Apply a percentage discount (e.g., 25% off) to the nightly rate</li>
                <li><strong>Fixed Amount:</strong> Subtract a fixed amount per night (e.g., $50 off)</li>
                <li><strong>Free Nights:</strong> Get N free nights for stays of M+ nights</li>
                <li><strong>Booking Window:</strong> Restrict when the promo can be booked (separate from stay dates)</li>
                <li><strong>Blackout Dates:</strong> Block specific date ranges from promo eligibility</li>
                <li><strong>Usage Limits:</strong> Cap total redemptions across all channels</li>
              </ul>
              <p className="text-xs">
                Select a channel connection and click &quot;Sync All&quot; to push active promos to the OTA.
                Use the validation tool to test promo codes before distribution.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPromo ? 'Edit Promo Code' : 'Create Promo Code'}
            </DialogTitle>
            <DialogDescription>
              {editingPromo
                ? 'Modify the promotional rate code configuration'
                : 'Define a new promo code to distribute across OTA channels'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Info className="h-4 w-4" />
                Basic Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Promo Code *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.promoCode}
                      onChange={(e) => setFormData((prev) => ({ ...prev, promoCode: e.target.value.toUpperCase() }))}
                      placeholder="e.g. SUMMER25"
                      className="font-mono uppercase"
                      disabled={!!editingPromo}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData((prev) => ({ ...prev, promoCode: generatePromoCode() }))}
                      disabled={!!editingPromo}
                      title="Auto-generate"
                    >
                      <Hash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Promo Name *</Label>
                  <Input
                    value={formData.promoName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, promoName: e.target.value }))}
                    placeholder="Summer 25% Off"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description of this promotion..."
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* Channel Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Send className="h-4 w-4" />
                Channel Distribution
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel Connection</Label>
                  <Select
                    value={formData.connectionId}
                    onValueChange={(val) => {
                      const conn = connections.find((c) => c.id === val);
                      setFormData((prev) => ({
                        ...prev,
                        connectionId: val,
                        channelCode: conn?.channel || prev.channelCode,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>
                          {conn.displayName || conn.channel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Channel Code *</Label>
                  <Input
                    value={formData.channelCode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, channelCode: e.target.value }))}
                    placeholder="booking_com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Channel Promo Code (optional)</Label>
                <Input
                  value={formData.channelPromoCode}
                  onChange={(e) => setFormData((prev) => ({ ...prev, channelPromoCode: e.target.value }))}
                  placeholder="External promo code from the channel"
                />
              </div>
            </div>

            <Separator />

            {/* Discount Configuration */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Discount Configuration
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select
                    value={formData.discountType}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, discountType: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DISCOUNT_TYPE_OPTIONS).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">{cfg.icon} {cfg.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.discountType !== 'free_nights' ? (
                  <div className="space-y-2">
                    <Label>Discount Value *</Label>
                    <Input
                      type="number"
                      value={formData.discountValue}
                      onChange={(e) => setFormData((prev) => ({ ...prev, discountValue: e.target.value }))}
                      min="0"
                      step="0.01"
                      placeholder={formData.discountType === 'percentage' ? '25' : '50'}
                    />
                  </div>
                ) : null}
                {formData.discountType === 'free_nights' ? (
                  <div className="space-y-2">
                    <Label>Free Nights</Label>
                    <Input
                      type="number"
                      value={formData.freeNights}
                      onChange={(e) => setFormData((prev) => ({ ...prev, freeNights: e.target.value }))}
                      min="1"
                      placeholder="1"
                    />
                  </div>
                ) : null}
                {formData.discountType === 'fixed_amount' ? (
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(val) => setFormData((prev) => ({ ...prev, currency: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="JPY">JPY (¥)</SelectItem>
                        <SelectItem value="AUD">AUD (A$)</SelectItem>
                        <SelectItem value="CAD">CAD (C$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            </div>

            <Separator />

            {/* Validity & Booking */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Validity & Booking Windows
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valid From *</Label>
                  <Input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData((prev) => ({ ...prev, validFrom: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valid To *</Label>
                  <Input
                    type="date"
                    value={formData.validTo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, validTo: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Booking Window From</Label>
                  <Input
                    type="date"
                    value={formData.bookingWindowFrom}
                    onChange={(e) => setFormData((prev) => ({ ...prev, bookingWindowFrom: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">When guests can start booking</p>
                </div>
                <div className="space-y-2">
                  <Label>Booking Window To</Label>
                  <Input
                    type="date"
                    value={formData.bookingWindowTo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, bookingWindowTo: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Last date to book using this promo</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Stay Date From</Label>
                  <Input
                    type="date"
                    value={formData.stayDateFrom}
                    onChange={(e) => setFormData((prev) => ({ ...prev, stayDateFrom: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Earliest check-in date</p>
                </div>
                <div className="space-y-2">
                  <Label>Stay Date To</Label>
                  <Input
                    type="date"
                    value={formData.stayDateTo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, stayDateTo: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Latest check-out date</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Restrictions & Usage */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Restrictions & Usage Limits
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Min Stay (nights)</Label>
                  <Input
                    type="number"
                    value={formData.minStay}
                    onChange={(e) => setFormData((prev) => ({ ...prev, minStay: e.target.value }))}
                    placeholder="No minimum"
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Stay (nights)</Label>
                  <Input
                    type="number"
                    value={formData.maxStay}
                    onChange={(e) => setFormData((prev) => ({ ...prev, maxStay: e.target.value }))}
                    placeholder="No maximum"
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Usage Limit</Label>
                  <Input
                    type="number"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData((prev) => ({ ...prev, usageLimit: e.target.value }))}
                    placeholder="Unlimited"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Applicable Room Types</Label>
                  <Input
                    value={formData.applicableRoomTypes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, applicableRoomTypes: e.target.value }))}
                    placeholder='Comma-separated IDs: "rt1, rt2"'
                  />
                  <p className="text-xs text-muted-foreground">Leave empty for all room types</p>
                </div>
                <div className="space-y-2">
                  <Label>Applicable Rate Plans</Label>
                  <Input
                    value={formData.applicableRatePlans}
                    onChange={(e) => setFormData((prev) => ({ ...prev, applicableRatePlans: e.target.value }))}
                    placeholder='Comma-separated IDs: "rp1, rp2"'
                  />
                  <p className="text-xs text-muted-foreground">Leave empty for all rate plans</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Status */}
            <div className="flex items-center justify-between">
              <Label htmlFor="promo-active" className="text-sm font-medium">
                Active
              </Label>
              <Switch
                id="promo-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingPromo ? (
                'Update Promo'
              ) : (
                'Create Promo'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promo Code</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingPromo?.promoCode}</strong> ({deletingPromo?.promoName})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
