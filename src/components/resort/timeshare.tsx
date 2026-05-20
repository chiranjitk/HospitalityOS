'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Building2,
  Calendar,
  DollarSign,
  Users,
  Plus,
  Search,
  RefreshCw,
  Star,
  TrendingUp,
  CreditCard,
  MapPin,
  Hash,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Filter,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────

interface TimeshareUnit {
  id: string;
  propertyId: string;
  unitNumber: string;
  roomTypeId: string;
  seasonType: string;
  weekNumber: number | null;
  pointsValue: number;
  usageType: string;
  isActive: boolean;
  activeOwnerships: number;
  ownerships: { id: string; ownerName: string; status: string }[];
  createdAt: string;
}

interface TimeshareOwnership {
  id: string;
  unitId: string;
  ownerId: string | null;
  ownerName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  startDate: string;
  endDate: string | null;
  purchasePrice: number;
  annualMf: number;
  status: string;
  notes: string | null;
  unit: { id: string; unitNumber: string; seasonType: string; pointsValue: number; usageType: string };
  createdAt: string;
}

interface Stats {
  totalUnits: number;
  activeUnits: number;
  totalOwnerships: number;
  totalAnnualMF: number;
}

interface OwnershipStats {
  activeCount: number;
  expiredCount: number;
  totalAnnualMF: number;
  totalPurchaseValue: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

const SEASON_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual',
  seasonal: 'Seasonal',
  floating: 'Floating',
  fixed_week: 'Fixed Week',
};

const USAGE_TYPE_LABELS: Record<string, string> = {
  full_ownership: 'Full Ownership',
  fractional: 'Fractional',
  points: 'Points-Based',
  right_to_use: 'Right to Use',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  transferred: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  forfeited: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
};

// ── Component ──────────────────────────────────────────────────────────

export default function ResortTimeshare() {
  // ── State ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('units');
  const [units, setUnits] = useState<TimeshareUnit[]>([]);
  const [ownerships, setOwnerships] = useState<TimeshareOwnership[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUnits: 0, activeUnits: 0, totalOwnerships: 0, totalAnnualMF: 0 });
  const [ownershipStats, setOwnershipStats] = useState<OwnershipStats>({ activeCount: 0, expiredCount: 0, totalAnnualMF: 0, totalPurchaseValue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [seasonFilter, setSeasonFilter] = useState('all');
  const [usageFilter, setUsageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialog state
  const [showUnitDialog, setShowUnitDialog] = useState(false);
  const [showOwnershipDialog, setShowOwnershipDialog] = useState(false);
  const [editingUnit, setEditingUnit] = useState<TimeshareUnit | null>(null);
  const [editingOwnership, setEditingOwnership] = useState<TimeshareOwnership | null>(null);

  // Form state
  const [unitForm, setUnitForm] = useState({ propertyId: '', unitNumber: '', roomTypeId: '', seasonType: 'annual', weekNumber: '', pointsValue: '0', usageType: 'full_ownership' });
  const [ownershipForm, setOwnershipForm] = useState({ unitId: '', ownerName: '', ownerEmail: '', ownerPhone: '', startDate: '', endDate: '', purchasePrice: '0', annualMf: '0', status: 'active', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'unit' | 'ownership'; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Data Fetching ───────────────────────────────────────────────

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (seasonFilter !== 'all') params.set('seasonType', seasonFilter);
      if (usageFilter !== 'all') params.set('usageType', usageFilter);
      params.set('limit', '50');

      const res = await fetch(`/api/resort/timeshare/units?${params}`);
      const json = await res.json();
      if (json.success) {
        setUnits(json.data);
        setStats(json.stats);
      }
    } catch {
      toast.error('Failed to load timeshare units');
    } finally {
      setLoading(false);
    }
  }, [search, seasonFilter, usageFilter]);

  const fetchOwnerships = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('limit', '50');

      const res = await fetch(`/api/resort/timeshare/ownerships?${params}`);
      const json = await res.json();
      if (json.success) {
        setOwnerships(json.data);
        setOwnershipStats(json.stats);
      }
    } catch {
      toast.error('Failed to load ownership records');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    if (activeTab === 'units') fetchUnits();
    else fetchOwnerships();
  }, [activeTab, fetchUnits, fetchOwnerships]);

  // ── Handlers ────────────────────────────────────────────────────

  const openEditUnit = (unit: TimeshareUnit) => {
    setEditingUnit(unit);
    setUnitForm({
      propertyId: unit.propertyId,
      unitNumber: unit.unitNumber,
      roomTypeId: '',
      seasonType: unit.seasonType,
      weekNumber: unit.weekNumber ? String(unit.weekNumber) : '',
      pointsValue: String(unit.pointsValue),
      usageType: unit.usageType,
    });
    setShowUnitDialog(true);
  };

  const openEditOwnership = (o: TimeshareOwnership) => {
    setEditingOwnership(o);
    setOwnershipForm({
      unitId: o.unitId,
      ownerName: o.ownerName,
      ownerEmail: o.ownerEmail || '',
      ownerPhone: o.ownerPhone || '',
      startDate: o.startDate.substring(0, 10),
      endDate: o.endDate ? o.endDate.substring(0, 10) : '',
      purchasePrice: String(o.purchasePrice),
      annualMf: String(o.annualMf),
      status: o.status,
      notes: o.notes || '',
    });
    setShowOwnershipDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const url = deleteTarget.type === 'unit'
        ? `/api/resort/timeshare/units/${deleteTarget.id}`
        : `/api/resort/timeshare/ownerships/${deleteTarget.id}`;
      const res = await fetch(url, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success(`${deleteTarget.type === 'unit' ? 'Unit' : 'Ownership'} deleted successfully`);
        setDeleteTarget(null);
        if (deleteTarget.type === 'unit') fetchUnits(); else fetchOwnerships();
      } else {
        toast.error(json.error || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateUnit = async () => {
    if (!unitForm.unitNumber || !unitForm.propertyId) {
      toast.error('Please fill in required fields');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        ...unitForm,
        weekNumber: unitForm.weekNumber ? parseInt(unitForm.weekNumber) : null,
        pointsValue: parseInt(unitForm.pointsValue),
      };
      const isEdit = !!editingUnit;
      const url = isEdit ? `/api/resort/timeshare/units/${editingUnit.id}` : '/api/resort/timeshare/units';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(isEdit ? 'Timeshare unit updated' : 'Timeshare unit created successfully');
        setShowUnitDialog(false);
        setEditingUnit(null);
        setUnitForm({ propertyId: '', unitNumber: '', roomTypeId: '', seasonType: 'annual', weekNumber: '', pointsValue: '0', usageType: 'full_ownership' });
        fetchUnits();
      } else {
        toast.error(json.error || 'Failed to save unit');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOwnership = async () => {
    if (!ownershipForm.unitId || !ownershipForm.ownerName || !ownershipForm.startDate) {
      toast.error('Please fill in required fields');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        ...ownershipForm,
        purchasePrice: parseFloat(ownershipForm.purchasePrice),
        annualMf: parseFloat(ownershipForm.annualMf),
      };
      const isEdit = !!editingOwnership;
      const url = isEdit ? `/api/resort/timeshare/ownerships/${editingOwnership.id}` : '/api/resort/timeshare/ownerships';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(isEdit ? 'Ownership record updated' : 'Ownership record created successfully');
        setShowOwnershipDialog(false);
        setEditingOwnership(null);
        setOwnershipForm({ unitId: '', ownerName: '', ownerEmail: '', ownerPhone: '', startDate: '', endDate: '', purchasePrice: '0', annualMf: '0', status: 'active', notes: '' });
        fetchOwnerships();
      } else {
        toast.error(json.error || 'Failed to save ownership');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Timeshare & Vacation Ownership</h2>
          <p className="text-muted-foreground">Manage timeshare unit inventory, ownership records, and maintenance fees</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { if (activeTab === 'units') fetchUnits(); else fetchOwnerships(); }} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
          {activeTab === 'units' ? (
            <Button size="sm" onClick={() => { setEditingUnit(null); setShowUnitDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" />
              Add Unit
            </Button>
          ) : (
            <Button size="sm" onClick={() => { setEditingOwnership(null); setShowOwnershipDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" />
              Add Ownership
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {activeTab === 'units' ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />Total Units</CardDescription>
              <CardTitle className="text-2xl">{stats.totalUnits}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Active Units</CardDescription>
              <CardTitle className="text-2xl">{stats.activeUnits}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-sky-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Active Owners</CardDescription>
              <CardTitle className="text-2xl">{stats.totalOwnerships}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-violet-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" />Annual MF Total</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(stats.totalAnnualMF)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Active Ownerships</CardDescription>
              <CardTitle className="text-2xl">{ownershipStats.activeCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-gray-400">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Expired</CardDescription>
              <CardTitle className="text-2xl">{ownershipStats.expiredCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />Total Purchase Value</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(ownershipStats.totalPurchaseValue)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-violet-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" />Annual MF Collected</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(ownershipStats.totalAnnualMF)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearch(''); }}>
        <TabsList>
          <TabsTrigger value="units">
            <Building2 className="h-4 w-4 mr-1.5" />
            Units Inventory
          </TabsTrigger>
          <TabsTrigger value="ownerships">
            <Users className="h-4 w-4 mr-1.5" />
            Ownership Records
          </TabsTrigger>
        </TabsList>

        {/* ── Units Tab ──────────────────────────────────────────── */}
        <TabsContent value="units" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search unit number..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={seasonFilter} onValueChange={setSeasonFilter}>
              <SelectTrigger className="w-[160px]"><Filter className="h-4 w-4 mr-1.5" /><SelectValue placeholder="Season Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Seasons</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="seasonal">Seasonal</SelectItem>
                <SelectItem value="floating">Floating</SelectItem>
                <SelectItem value="fixed_week">Fixed Week</SelectItem>
              </SelectContent>
            </Select>
            <Select value={usageFilter} onValueChange={setUsageFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Usage Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Usage Types</SelectItem>
                <SelectItem value="full_ownership">Full Ownership</SelectItem>
                <SelectItem value="fractional">Fractional</SelectItem>
                <SelectItem value="points">Points-Based</SelectItem>
                <SelectItem value="right_to_use">Right to Use</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Units Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : units.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" /><p className="text-muted-foreground">No timeshare units found</p></CardContent></Card>
          ) : (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {units.map(unit => (
                <Card key={unit.id} className={cn('transition-all hover:shadow-md', !unit.isActive && 'opacity-60')}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">Unit #{unit.unitNumber}</h4>
                          <p className="text-xs text-muted-foreground">{USAGE_TYPE_LABELS[unit.usageType] || unit.usageType}</p>
                        </div>
                      </div>
                      <Badge variant={unit.isActive ? 'default' : 'secondary'} className={cn('text-[10px]', unit.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : '')}>
                        {unit.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                      <div className="p-2 rounded bg-muted/50">
                        <p className="text-muted-foreground">Season</p>
                        <p className="font-medium">{SEASON_TYPE_LABELS[unit.seasonType] || unit.seasonType}</p>
                      </div>
                      <div className="p-2 rounded bg-muted/50">
                        <p className="text-muted-foreground">Points Value</p>
                        <p className="font-medium flex items-center gap-1"><Star className="h-3 w-3 text-amber-500" />{unit.pointsValue.toLocaleString()}</p>
                      </div>
                      {unit.weekNumber && (
                        <div className="p-2 rounded bg-muted/50">
                          <p className="text-muted-foreground">Week #</p>
                          <p className="font-medium">{unit.weekNumber}</p>
                        </div>
                      )}
                      <div className="p-2 rounded bg-muted/50">
                        <p className="text-muted-foreground">Owners</p>
                        <p className="font-medium">{unit.activeOwnerships} active</p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEditUnit(unit)}>
                        <Edit className="h-3 w-3 mr-1" />Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ type: 'unit', id: unit.id, name: `Unit #${unit.unitNumber}` })}>
                        <Trash2 className="h-3 w-3 mr-1" />Delete
                      </Button>
                    </div>

                    {/* Expandable ownerships */}
                    {unit.ownerships && unit.ownerships.length > 0 && (
                      <div>
                        <button className="flex items-center gap-1 text-xs text-primary font-medium" onClick={() => setExpandedUnit(expandedUnit === unit.id ? null : unit.id)}>
                          {expandedUnit === unit.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {unit.ownerships.length} Ownership(s)
                        </button>
                        {expandedUnit === unit.id && (
                          <div className="mt-2 space-y-1">
                            {unit.ownerships.map(o => (
                              <div key={o.id} className="text-xs p-2 rounded bg-muted/30 flex items-center justify-between">
                                <span className="font-medium">{o.ownerName}</span>
                                <Badge variant="outline" className="text-[10px] h-5">{o.status}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Ownerships Tab ─────────────────────────────────────── */}
        <TabsContent value="ownerships" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by owner name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><Filter className="h-4 w-4 mr-1.5" /><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
                <SelectItem value="forfeited">Forfeited</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ownership Table */}
          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[500px]">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Owner</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="hidden md:table-cell">Purchase Price</TableHead>
                        <TableHead className="hidden md:table-cell">Annual MF</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Start Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ownerships.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No ownership records found</TableCell>
                        </TableRow>
                      ) : ownerships.map(o => (
                        <TableRow key={o.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{o.ownerName}</p>
                              <p className="text-xs text-muted-foreground">{o.ownerEmail || 'No email'}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">#{o.unit?.unitNumber || '—'}</p>
                              <p className="text-xs text-muted-foreground">{o.unit?.usageType || ''}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{formatCurrency(o.purchasePrice)}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{formatCurrency(o.annualMf)}/yr</TableCell>
                          <TableCell>
                            <Badge className={cn('text-[10px] h-5', STATUS_COLORS[o.status] || '')}>{o.status}</Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{new Date(o.startDate).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit" onClick={() => openEditOwnership(o)}><Edit className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Delete" onClick={() => setDeleteTarget({ type: 'ownership', id: o.id, name: o.ownerName })}><Trash2 className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="View"><Eye className="h-3.5 w-3.5" /></Button>
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
        </TabsContent>
      </Tabs>

      {/* ── Create Unit Dialog ──────────────────────────────────── */}
      <Dialog open={showUnitDialog} onOpenChange={setShowUnitDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUnit ? 'Edit' : 'Add'} Timeshare Unit</DialogTitle>
            <DialogDescription>Configure a new timeshare unit for vacation ownership</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit Number <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g., T-101" value={unitForm.unitNumber} onChange={e => setUnitForm(f => ({ ...f, unitNumber: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Points Value</Label>
                <Input type="number" placeholder="0" value={unitForm.pointsValue} onChange={e => setUnitForm(f => ({ ...f, pointsValue: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Season Type</Label>
                <Select value={unitForm.seasonType} onValueChange={v => setUnitForm(f => ({ ...f, seasonType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                    <SelectItem value="floating">Floating</SelectItem>
                    <SelectItem value="fixed_week">Fixed Week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Usage Type</Label>
                <Select value={unitForm.usageType} onValueChange={v => setUnitForm(f => ({ ...f, usageType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_ownership">Full Ownership</SelectItem>
                    <SelectItem value="fractional">Fractional</SelectItem>
                    <SelectItem value="points">Points-Based</SelectItem>
                    <SelectItem value="right_to_use">Right to Use</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {unitForm.seasonType === 'fixed_week' && (
              <div className="space-y-2">
                <Label>Week Number</Label>
                <Input type="number" placeholder="1-52" value={unitForm.weekNumber} onChange={e => setUnitForm(f => ({ ...f, weekNumber: e.target.value }))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnitDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateUnit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingUnit ? 'Update' : 'Create'} Unit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Ownership Dialog ──────────────────────────────── */}
      <Dialog open={showOwnershipDialog} onOpenChange={setShowOwnershipDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingOwnership ? 'Edit' : 'Add'} Ownership Record</DialogTitle>
            <DialogDescription>Register a new timeshare ownership</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Owner Name <span className="text-red-500">*</span></Label>
                <Input placeholder="Full name" value={ownershipForm.ownerName} onChange={e => setOwnershipForm(f => ({ ...f, ownerName: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="owner@email.com" value={ownershipForm.ownerEmail} onChange={e => setOwnershipForm(f => ({ ...f, ownerEmail: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input placeholder="+1-555-0100" value={ownershipForm.ownerPhone} onChange={e => setOwnershipForm(f => ({ ...f, ownerPhone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Purchase Price <span className="text-red-500">*</span></Label>
                <Input type="number" placeholder="0" value={ownershipForm.purchasePrice} onChange={e => setOwnershipForm(f => ({ ...f, purchasePrice: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Annual Maintenance Fee</Label>
                <Input type="number" placeholder="0" value={ownershipForm.annualMf} onChange={e => setOwnershipForm(f => ({ ...f, annualMf: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date <span className="text-red-500">*</span></Label>
                <Input type="date" value={ownershipForm.startDate} onChange={e => setOwnershipForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={ownershipForm.status} onValueChange={v => setOwnershipForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="transferred">Transferred</SelectItem>
                    <SelectItem value="forfeited">Forfeited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input placeholder="Optional notes..." value={ownershipForm.notes} onChange={e => setOwnershipForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOwnershipDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateOwnership} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingOwnership ? 'Update' : 'Create'} Ownership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ──────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === 'unit' ? 'Unit' : 'Ownership'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium">{deleteTarget?.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
