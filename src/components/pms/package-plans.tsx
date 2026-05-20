'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  Gift,
  Search,
  Loader2,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Eye,
  DollarSign,
  CalendarDays,
  Layers,
  Package,
  X,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// --- Types ---
interface PackageComponent {
  id: string;
  packagePlanId: string;
  componentType: string;
  referenceId?: string | null;
  referenceName?: string | null;
  includedQty: number;
  unitCost: number;
  isIncluded: boolean;
  sortOrder: number;
}

interface PackageRate {
  id: string;
  packagePlanId: string;
  roomTypeId: string;
  startDate: string;
  endDate: string;
  price: number;
  currency: string;
  minStay: number;
  maxStay?: number | null;
  status: string;
  roomType?: { id: string; name: string } | null;
}

interface PackagePlan {
  id: string;
  propertyId: string;
  name: string;
  description?: string | null;
  baseRoomTypeId: string;
  roomRateInclusive: boolean;
  startDate: string;
  endDate: string;
  minNights: number;
  maxNights?: number | null;
  totalBasePrice: number;
  currency: string;
  sortOrder: number;
  status: string;
  components: PackageComponent[];
  rates: PackageRate[];
  _count?: { components: number; rates: number };
  createdAt: string;
}

interface RoomType {
  id: string;
  name: string;
}

interface Property {
  id: string;
  name: string;
}

const COMPONENT_TYPES = [
  { value: 'meal', label: 'Meal' },
  { value: 'spa', label: 'Spa' },
  { value: 'airport_transfer', label: 'Airport Transfer' },
  { value: 'minibar', label: 'Minibar' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'late_checkout', label: 'Late Checkout' },
  { value: 'early_checkin', label: 'Early Check-in' },
  { value: 'other', label: 'Other' },
];

const getComponentLabel = (type: string) => COMPONENT_TYPES.find(c => c.value === type)?.label || type;

export default function PackagePlansPage() {
  const { toast } = useToast();

  // Shared
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  // Data
  const [packages, setPackages] = useState<PackagePlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Room types
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRateOpen, setIsRateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PackagePlan | null>(null);

  // Create form
  const [pkgForm, setPkgForm] = useState({
    name: '',
    description: '',
    baseRoomTypeId: '',
    roomRateInclusive: false,
    startDate: '',
    endDate: '',
    minNights: '1',
    maxNights: '',
    status: 'active',
  });

  const [formComponents, setFormComponents] = useState<{
    componentType: string; name: string; includedQty: string; unitCost: string; isIncluded: boolean;
  }[]>([{ componentType: 'meal', name: '', includedQty: '1', unitCost: '0', isIncluded: true }]);

  // Rate form
  const [rateForm, setRateForm] = useState({
    roomTypeId: '',
    startDate: '',
    endDate: '',
    price: '',
    minStay: '1',
    maxStay: '',
    status: 'active',
  });

  // Fetch properties
  useEffect(() => {
    const fetchProps = async () => {
      try {
        const res = await fetch('/api/properties');
        const result = await res.json();
        if (result.success) {
          setProperties(result.data);
          if (result.data.length > 0) setSelectedPropertyId(result.data[0].id);
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch properties', variant: 'destructive' });
      }
    };
    fetchProps();
  }, [toast]);

  // Fetch room types
  useEffect(() => {
    const fetchRT = async () => {
      if (!selectedPropertyId) return;
      try {
        const res = await fetch(`/api/room-types?propertyId=${selectedPropertyId}&limit=100`);
        const result = await res.json();
        if (result.success) setRoomTypes(result.data || []);
      } catch { /* silent */ }
    };
    fetchRT();
  }, [selectedPropertyId]);

  // Fetch packages
  const fetchPackages = useCallback(async () => {
    if (!selectedPropertyId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/packages?${params}`);
      const result = await res.json();
      if (result.success) setPackages(result.data?.packages || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch packages', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedPropertyId, statusFilter, toast]);

  useEffect(() => {
    if (!selectedPropertyId) return;
    (async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' });
        if (statusFilter !== 'all') params.set('status', statusFilter);
        const res = await fetch(`/api/packages?${params}`);
        const result = await res.json();
        if (result.success) setPackages(result.data?.packages || []);
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch packages', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedPropertyId, statusFilter, toast]);

  // Debounced search (client-side filter since API doesn't support search)
  const filteredPackages = packages.filter(pkg => {
    if (!searchQuery) return true;
    return pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.description?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // --- Create Package ---
  const addComponent = () => setFormComponents(prev => [...prev, { componentType: 'meal', name: '', includedQty: '1', unitCost: '0', isIncluded: true }]);
  const removeComponent = (idx: number) => setFormComponents(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const handleCreate = async () => {
    if (!pkgForm.name.trim() || !pkgForm.baseRoomTypeId || !pkgForm.startDate || !pkgForm.endDate || !selectedPropertyId) {
      toast({ title: 'Validation', description: 'Name, room type, and dates are required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const components = formComponents
        .filter(c => c.name.trim())
        .map((c, idx) => ({
          componentType: c.componentType,
          referenceName: c.name,
          includedQty: parseInt(c.includedQty) || 1,
          unitCost: parseFloat(c.unitCost) || 0,
          isIncluded: c.isIncluded,
          sortOrder: idx,
        }));

      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          name: pkgForm.name,
          description: pkgForm.description || undefined,
          baseRoomTypeId: pkgForm.baseRoomTypeId,
          roomRateInclusive: pkgForm.roomRateInclusive,
          startDate: pkgForm.startDate,
          endDate: pkgForm.endDate,
          minNights: parseInt(pkgForm.minNights) || 1,
          maxNights: pkgForm.maxNights ? parseInt(pkgForm.maxNights) : undefined,
          status: pkgForm.status,
          components: components.length > 0 ? components : undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Package plan created' });
        setIsCreateOpen(false);
        resetForm();
        fetchPackages();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to create package', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create package', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Add Rate ---
  const handleAddRate = async () => {
    if (!selectedPackage || !rateForm.roomTypeId || !rateForm.startDate || !rateForm.endDate || !selectedPropertyId) {
      toast({ title: 'Validation', description: 'Room type and dates are required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/packages/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          packagePlanId: selectedPackage.id,
          roomTypeId: rateForm.roomTypeId,
          startDate: rateForm.startDate,
          endDate: rateForm.endDate,
          price: parseFloat(rateForm.price) || 0,
          minStay: parseInt(rateForm.minStay) || 1,
          maxStay: rateForm.maxStay ? parseInt(rateForm.maxStay) : undefined,
          status: rateForm.status,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Rate added' });
        setIsRateOpen(false);
        resetRateForm();
        fetchPackages();
        // Refresh selected package detail
        const updated = packages.find(p => p.id === selectedPackage.id);
        if (updated) {
          const detailRes = await fetch(`/api/packages?propertyId=${selectedPropertyId}&limit=100`);
          const detailResult = await detailRes.json();
          if (detailResult.success) {
            const refreshedPkg = detailResult.data?.packages?.find((p: PackagePlan) => p.id === selectedPackage.id);
            if (refreshedPkg) setSelectedPackage(refreshedPkg);
          }
        }
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to add rate', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add rate', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Delete ---
  const handleDelete = async (id: string) => {
    setActionLoading(`del-${id}`);
    try {
      const res = await fetch(`/api/packages/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) { toast({ title: 'Deleted', description: 'Package deleted' }); fetchPackages(); }
      else { toast({ title: 'Error', description: result.error || 'Delete failed', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' }); }
    finally { setActionLoading(null); }
  };

  const resetForm = () => {
    setPkgForm({ name: '', description: '', baseRoomTypeId: '', roomRateInclusive: false, startDate: '', endDate: '', minNights: '1', maxNights: '', status: 'active' });
    setFormComponents([{ componentType: 'meal', name: '', includedQty: '1', unitCost: '0', isIncluded: true }]);
  };

  const resetRateForm = () => setRateForm({ roomTypeId: '', startDate: '', endDate: '', price: '', minStay: '1', maxStay: '', status: 'active' });

  const formatCurrency = (amount: number) => `$${(amount || 0).toFixed(2)}`;

  const getRoomTypeName = (id: string) => roomTypes.find(rt => rt.id === id)?.name || id.slice(0, 8);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Gift className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            Package Plans
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage room packages with components and rates</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:w-48 h-10"><SelectValue placeholder="Property" /></SelectTrigger>
            <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchPackages} className="min-w-[44px]"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="bg-gradient-to-r from-rose-600 to-rose-500 hover:shadow-lg hover:shadow-rose-500/20 transition-all">
            <Plus className="h-4 w-4 mr-1.5" />Create Package
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search packages..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40 h-10"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Package Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : filteredPackages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Gift className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">No packages found</p>
              <Button className="mt-4" onClick={() => { resetForm(); setIsCreateOpen(true); }}><Plus className="h-4 w-4 mr-1.5" />Create Package</Button>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Package Name</TableHead>
                        <TableHead>Base Room Type</TableHead>
                        <TableHead className="text-center">Components</TableHead>
                        <TableHead className="text-right">Base Price</TableHead>
                        <TableHead className="text-center">Nights</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPackages.map(pkg => (
                        <TableRow key={pkg.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedPackage(pkg); setIsDetailOpen(true); }}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{pkg.name}</p>
                                {pkg.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{pkg.description}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{getRoomTypeName(pkg.baseRoomTypeId)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="font-medium">{pkg.components?.length || pkg._count?.components || 0}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm">{formatCurrency(pkg.totalBasePrice)}</TableCell>
                          <TableCell className="text-center text-sm">{pkg.minNights}{pkg.maxNights ? `-${pkg.maxNights}` : '+'}</TableCell>
                          <TableCell>
                            <Badge variant={pkg.status === 'active' ? 'default' : 'secondary'} className={cn(pkg.status === 'active' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300')}>
                              {pkg.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <p>{new Date(pkg.startDate).toLocaleDateString()} → {new Date(pkg.endDate).toLocaleDateString()}</p>
                          </TableCell>
                          <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!!actionLoading?.startsWith('del-')}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => { setSelectedPackage(pkg); setIsDetailOpen(true); }}>
                                  <Eye className="h-4 w-4 mr-2" />View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedPackage(pkg); resetRateForm(); setIsRateOpen(true); }}>
                                  <DollarSign className="h-4 w-4 mr-2" />Add Rate
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(pkg.id)} className="text-red-600 dark:text-red-400">
                                  <Trash2 className="h-4 w-4 mr-2" />Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border">
                {filteredPackages.map(pkg => (
                  <div key={pkg.id} className="p-4 space-y-2 cursor-pointer active:bg-muted/50" onClick={() => { setSelectedPackage(pkg); setIsDetailOpen(true); }}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-semibold text-sm">{pkg.name}</p>
                          <p className="text-xs text-muted-foreground">{getRoomTypeName(pkg.baseRoomTypeId)} • {pkg.components?.length || 0} components</p>
                        </div>
                      </div>
                      <Badge variant={pkg.status === 'active' ? 'default' : 'secondary'} className="text-xs">{pkg.status}</Badge>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Price: <span className="font-medium text-foreground">{formatCurrency(pkg.totalBasePrice)}</span></span>
                      <span>Nights: <span className="font-medium text-foreground">{pkg.minNights}{pkg.maxNights ? `-${pkg.maxNights}` : '+'}</span></span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(pkg.startDate).toLocaleDateString()} → {new Date(pkg.endDate).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ========== CREATE PACKAGE DIALOG ========== */}
      <Dialog open={isCreateOpen} onOpenChange={open => { if (!open) resetForm(); setIsCreateOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Package Plan</DialogTitle>
            <DialogDescription>Define a room package with included components</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Package Name *</Label><Input value={pkgForm.name} onChange={e => setPkgForm(p => ({ ...p, name: e.target.value }))} placeholder="Honeymoon Package" /></div>
              <div className="space-y-1.5">
                <Label>Base Room Type *</Label>
                <Select value={pkgForm.baseRoomTypeId} onValueChange={v => setPkgForm(p => ({ ...p, baseRoomTypeId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select room type..." /></SelectTrigger>
                  <SelectContent>{roomTypes.map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={pkgForm.description} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Package description..." /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Start Date *</Label><Input type="date" value={pkgForm.startDate} onChange={e => setPkgForm(p => ({ ...p, startDate: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>End Date *</Label><Input type="date" value={pkgForm.endDate} onChange={e => setPkgForm(p => ({ ...p, endDate: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5"><Label>Min Nights</Label><Input type="number" min="1" value={pkgForm.minNights} onChange={e => setPkgForm(p => ({ ...p, minNights: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Max Nights</Label><Input type="number" value={pkgForm.maxNights} onChange={e => setPkgForm(p => ({ ...p, maxNights: e.target.value }))} placeholder="No max" /></div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={pkgForm.status} onValueChange={v => setPkgForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-5">
                <Label>Room Rate Inclusive</Label>
                <Switch checked={pkgForm.roomRateInclusive} onCheckedChange={v => setPkgForm(p => ({ ...p, roomRateInclusive: v }))} />
              </div>
            </div>

            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Components</Label>
                <Button variant="ghost" size="sm" onClick={addComponent} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />Add Component</Button>
              </div>
              <div className="space-y-2">
                {formComponents.map((comp, idx) => (
                  <Card key={idx} className="p-3">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-12 sm:col-span-3 space-y-1">
                        <Label className="text-xs text-muted-foreground">Type</Label>
                        <Select value={comp.componentType} onValueChange={v => { const nc = [...formComponents]; nc[idx] = { ...nc[idx], componentType: v }; setFormComponents(nc); }}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{COMPONENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-12 sm:col-span-3 space-y-1">
                        <Label className="text-xs text-muted-foreground">Name</Label>
                        <Input placeholder="Component name" value={comp.name} onChange={e => { const nc = [...formComponents]; nc[idx] = { ...nc[idx], name: e.target.value }; setFormComponents(nc); }} className="h-9 text-sm" />
                      </div>
                      <div className="col-span-4 sm:col-span-2 space-y-1">
                        <Label className="text-xs text-muted-foreground">Qty</Label>
                        <Input type="number" min="1" value={comp.includedQty} onChange={e => { const nc = [...formComponents]; nc[idx] = { ...nc[idx], includedQty: e.target.value }; setFormComponents(nc); }} className="h-9 text-sm" />
                      </div>
                      <div className="col-span-4 sm:col-span-2 space-y-1">
                        <Label className="text-xs text-muted-foreground">Cost</Label>
                        <Input type="number" step="0.01" value={comp.unitCost} onChange={e => { const nc = [...formComponents]; nc[idx] = { ...nc[idx], unitCost: e.target.value }; setFormComponents(nc); }} className="h-9 text-sm" />
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex items-center justify-center">
                        <Switch checked={comp.isIncluded} onCheckedChange={v => { const nc = [...formComponents]; nc[idx] = { ...nc[idx], isIncluded: v }; setFormComponents(nc); }} className="scale-75" />
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex items-end justify-center">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-red-500" onClick={() => removeComponent(idx)} disabled={formComponents.length === 1}><X className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Gift className="h-4 w-4 mr-1.5" />}Create Package</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== PACKAGE DETAIL DIALOG ========== */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedPackage && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  {selectedPackage.name}
                </DialogTitle>
                <DialogDescription>
                  {getRoomTypeName(selectedPackage.baseRoomTypeId)} • {formatCurrency(selectedPackage.totalBasePrice)} base price • {selectedPackage.minNights}-{selectedPackage.maxNights || '∞'} nights
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                {selectedPackage.description && <p className="text-sm text-muted-foreground">{selectedPackage.description}</p>}

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">Period: {new Date(selectedPackage.startDate).toLocaleDateString()} → {new Date(selectedPackage.endDate).toLocaleDateString()}</Badge>
                  <Badge variant={selectedPackage.status === 'active' ? 'default' : 'secondary'}>{selectedPackage.status}</Badge>
                  <Badge variant="outline">{selectedPackage.roomRateInclusive ? 'Room rate inclusive' : 'Room rate exclusive'}</Badge>
                </div>

                <Separator />

                {/* Components */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    Components ({selectedPackage.components?.length || 0})
                  </h4>
                  {selectedPackage.components && selectedPackage.components.length > 0 ? (
                    <div className="space-y-2">
                      {selectedPackage.components.map(comp => (
                        <div key={comp.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="text-xs">{getComponentLabel(comp.componentType)}</Badge>
                            <div>
                              <p className="text-sm font-medium">{comp.referenceName || comp.componentType}</p>
                              <p className="text-xs text-muted-foreground">Qty: {comp.includedQty} • Cost: {formatCurrency(comp.unitCost)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {comp.isIncluded ? (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs">Included</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Extra</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No components defined</p>
                  )}
                </div>

                <Separator />

                {/* Rates per Room Type */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      Rates per Room Type ({selectedPackage.rates?.length || 0})
                    </h4>
                    <Button size="sm" variant="outline" onClick={() => { resetRateForm(); setIsRateOpen(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Add Rate
                    </Button>
                  </div>
                  {selectedPackage.rates && selectedPackage.rates.length > 0 ? (
                    <ScrollArea className="max-h-48">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Room Type</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead className="text-center">Stay</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedPackage.rates.map(rate => (
                            <TableRow key={rate.id}>
                              <TableCell className="text-sm">{rate.roomType?.name || getRoomTypeName(rate.roomTypeId)}</TableCell>
                              <TableCell className="text-right font-medium text-sm">{formatCurrency(rate.price)}</TableCell>
                              <TableCell className="text-xs">{new Date(rate.startDate).toLocaleDateString()} → {new Date(rate.endDate).toLocaleDateString()}</TableCell>
                              <TableCell className="text-center text-xs">{rate.minStay}{rate.maxStay ? `-${rate.maxStay}` : '+'}</TableCell>
                              <TableCell><Badge variant={rate.status === 'active' ? 'default' : 'secondary'} className="text-xs">{rate.status}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground">No rates defined yet</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ========== ADD RATE DIALOG ========== */}
      <Dialog open={isRateOpen} onOpenChange={setIsRateOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Package Rate</DialogTitle>
            <DialogDescription>Set a rate for this package on a specific room type</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Room Type *</Label>
              <Select value={rateForm.roomTypeId} onValueChange={v => setRateForm(p => ({ ...p, roomTypeId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select room type..." /></SelectTrigger>
                <SelectContent>{roomTypes.map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Price *</Label><Input type="number" step="0.01" value={rateForm.price} onChange={e => setRateForm(p => ({ ...p, price: e.target.value }))} placeholder="0.00" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Start Date *</Label><Input type="date" value={rateForm.startDate} onChange={e => setRateForm(p => ({ ...p, startDate: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>End Date *</Label><Input type="date" value={rateForm.endDate} onChange={e => setRateForm(p => ({ ...p, endDate: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Min Stay</Label><Input type="number" min="1" value={rateForm.minStay} onChange={e => setRateForm(p => ({ ...p, minStay: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Max Stay</Label><Input type="number" value={rateForm.maxStay} onChange={e => setRateForm(p => ({ ...p, maxStay: e.target.value }))} placeholder="No max" /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={rateForm.status} onValueChange={v => setRateForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRateOpen(false)}>Cancel</Button>
            <Button onClick={handleAddRate} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <DollarSign className="h-4 w-4 mr-1.5" />}Add Rate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
