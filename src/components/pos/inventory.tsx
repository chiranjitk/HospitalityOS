'use client';

import { useState, useEffect } from 'react';
import { usePropertyId } from '@/hooks/use-property';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Search, Plus, Loader2, Package, Edit, Trash2, AlertTriangle,
  ArrowUpCircle, ArrowDownCircle, History, DollarSign, TrendingDown,
  ChevronDown, ChevronUp,
} from 'lucide-react';

// ---- Types ----
interface InventoryItem {
  id: string;
  name: string;
  category?: string | null;
  currentStock: number;
  unit: string;
  unitCost: number;
  lowStockThreshold: number;
  reorderLevel: number;
  supplierName?: string | null;
  supplierContact?: string | null;
  status: string;
  lastRestocked?: string | null;
  value?: number;
  _count?: { movements: number };
}

interface StockMovement {
  id: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  note?: string | null;
  createdAt: string;
  performedBy?: string;
}

interface InventoryStats {
  totalItems: number;
  lowStockAlerts: number;
  outOfStock: number;
  totalValue: number;
}

// ---- Constants ----
const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'boxes', 'bottles', 'packs', 'cans'];
const CATEGORIES = ['Produce', 'Dairy', 'Meat', 'Seafood', 'Beverages', 'Dry Goods', 'Condiments', 'Cleaning', 'Other'];
const REASONS = ['Received', 'Waste', 'Transfer', 'Inventory Count', 'Damage', 'Other'];

const stockStatus = (item: InventoryItem) => {
  if (item.currentStock <= 0) return { label: 'Out of Stock', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
  if (item.currentStock <= item.lowStockThreshold) return { label: 'Low Stock', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
  return { label: 'In Stock', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };
};

// ---- Component ----
export default function InventoryManagement() {
  const { propertyId } = usePropertyId();
  const { formatCurrency } = useCurrency();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<InventoryStats>({ totalItems: 0, lowStockAlerts: 0, outOfStock: 0, totalValue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialog states
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // History dialog
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '', category: '', currentStock: '0', unit: 'pcs', unitCost: '0',
    lowStockThreshold: '10', reorderLevel: '5', supplierName: '', supplierContact: '',
  });

  const [adjustForm, setAdjustForm] = useState({ quantity: '', reason: 'Received', note: '' });

  // ---- Data Fetching ----
  const doFetchItems = async (pid: string, cat: string, stat: string, srch: string) => {
    try {
      const params = new URLSearchParams({ propertyId: pid });
      if (cat !== 'all') params.append('category', cat);
      if (stat !== 'all') params.append('status', stat);
      if (srch) params.append('search', srch);

      const res = await fetch(`/api/inventory?${params}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.data || []);
      }
    } catch {
      toast.error('Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  };

  const doFetchStats = async (pid: string) => {
    try {
      const res = await fetch(`/api/inventory?stats=true&propertyId=${pid}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch {
      // Silent fail for stats
    }
  };

  useEffect(() => {
    if (propertyId) {
      doFetchItems(propertyId, categoryFilter, statusFilter, search);
      doFetchStats(propertyId);
    }
  }, [propertyId, categoryFilter, statusFilter, search]);

  // ---- Form Helpers ----
  const resetForm = () => {
    setForm({
      name: '', category: '', currentStock: '0', unit: 'pcs', unitCost: '0',
      lowStockThreshold: '10', reorderLevel: '5', supplierName: '', supplierContact: '',
    });
  };

  const openEdit = (item: InventoryItem) => {
    setEditItem(item);
    setForm({
      name: item.name,
      category: item.category || '',
      currentStock: item.currentStock.toString(),
      unit: item.unit,
      unitCost: item.unitCost.toString(),
      lowStockThreshold: item.lowStockThreshold.toString(),
      reorderLevel: item.reorderLevel.toString(),
      supplierName: item.supplierName || '',
      supplierContact: item.supplierContact || '',
    });
  };

  const openAdjust = (item: InventoryItem) => {
    setAdjustItem(item);
    setAdjustForm({ quantity: '', reason: 'Received', note: '' });
  };

  // ---- CRUD Handlers ----
  const handleSave = async () => {
    if (!form.name.trim() || !propertyId) {
      toast.error('Item name is required');
      return;
    }
    if (parseFloat(form.unitCost) < 0) {
      toast.error('Unit cost cannot be negative');
      return;
    }
    setSaving(true);
    try {
      const method = editItem ? 'PUT' : 'POST';
      const body = {
        ...(editItem ? { id: editItem.id } : {}),
        propertyId,
        name: form.name,
        category: form.category || undefined,
        currentStock: parseFloat(form.currentStock) || 0,
        unit: form.unit,
        unitCost: parseFloat(form.unitCost) || 0,
        lowStockThreshold: parseFloat(form.lowStockThreshold) || 0,
        reorderLevel: parseFloat(form.reorderLevel) || 0,
        supplierName: form.supplierName || undefined,
        supplierContact: form.supplierContact || undefined,
      };
      const res = await fetch('/api/inventory', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editItem ? 'Item updated' : 'Item created');
        setAddOpen(false);
        setEditItem(null);
        resetForm();
        if (propertyId) {
          doFetchItems(propertyId, categoryFilter, statusFilter, search);
          doFetchStats(propertyId);
        }
      } else {
        toast.error(data.error?.message || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjust = async () => {
    if (!adjustItem || !adjustForm.quantity) {
      toast.error('Quantity is required');
      return;
    }
    const qty = parseFloat(adjustForm.quantity);
    if (isNaN(qty) || qty === 0) {
      toast.error('Quantity must be a non-zero number');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/inventory/${adjustItem.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: qty,
          reason: adjustForm.reason,
          note: adjustForm.note || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Stock ${qty > 0 ? 'added' : 'removed'}: ${Math.abs(qty)} ${adjustItem.unit}`);
        setAdjustItem(null);
        setAdjustForm({ quantity: '', reason: 'Received', note: '' });
        if (propertyId) {
          doFetchItems(propertyId, categoryFilter, statusFilter, search);
          doFetchStats(propertyId);
        }
      } else {
        toast.error(data.error?.message || 'Failed to adjust stock');
      }
    } catch {
      toast.error('Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/inventory?id=${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Item deleted');
        if (propertyId) {
          doFetchItems(propertyId, categoryFilter, statusFilter, search);
          doFetchStats(propertyId);
        }
      } else {
        toast.error(data.error?.message || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleteId(null);
    }
  };

  const fetchMovements = async (item: InventoryItem) => {
    setHistoryItem(item);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/inventory/${item.id}/adjust`);
      const data = await res.json();
      if (data.success) {
        setMovements(data.data || []);
      }
    } catch {
      setMovements([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ---- Render ----
  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Package className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No Property Selected</p>
        <p className="text-sm">Please select a property to manage inventory</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const lowStockItems = items.filter(i => i.currentStock > 0 && i.currentStock <= i.lowStockThreshold);
  const outOfStockItems = items.filter(i => i.currentStock <= 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Inventory & Stock Management</h1>
        <p className="text-muted-foreground">Track restaurant ingredient and supply stock levels</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.lowStockAlerts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.outOfStock}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalValue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alerts Banner */}
      {lowStockItems.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Low Stock Alerts ({lowStockItems.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
              {lowStockItems.map(item => (
                <Badge
                  key={item.id}
                  variant="outline"
                  className="text-xs border-amber-300 dark:border-amber-700 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                  onClick={() => openAdjust(item)}
                >
                  {item.name}: {item.currentStock} {item.unit} (threshold: {item.lowStockThreshold})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Out of Stock Banner */}
      {outOfStockItems.length > 0 && (
        <Card className="border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-800 dark:text-red-200 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Out of Stock ({outOfStockItems.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
              {outOfStockItems.map(item => (
                <Badge
                  key={item.id}
                  variant="outline"
                  className="text-xs border-red-300 dark:border-red-700 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                  onClick={() => openAdjust(item)}
                >
                  {item.name} — {item.unit}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters + Add Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={addOpen} onOpenChange={o => { setAddOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700" onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Items Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Item Name</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-right p-3 font-medium">Current Stock</th>
                  <th className="text-left p-3 font-medium">Unit</th>
                  <th className="text-right p-3 font-medium">Unit Cost</th>
                  <th className="text-right p-3 font-medium">Value</th>
                  <th className="text-right p-3 font-medium">Low Threshold</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Last Restocked</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-muted-foreground">
                      <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No inventory items found</p>
                      <p className="text-sm mt-1">
                        {search || categoryFilter !== 'all' || statusFilter !== 'all'
                          ? 'Try adjusting your filters'
                          : 'Add your first inventory item to get started'}
                      </p>
                    </td>
                  </tr>
                ) : items.map(item => {
                  const status = stockStatus(item);
                  const itemValue = (Number(item.currentStock) * Number(item.unitCost));
                  return (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div className="font-medium">{item.name}</div>
                        {item.supplierName && (
                          <div className="text-xs text-muted-foreground">{item.supplierName}</div>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{item.category || '—'}</td>
                      <td className="p-3 text-right font-mono">
                        <span className={status.color}>{Number(item.currentStock).toLocaleString()}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">{item.unit}</td>
                      <td className="p-3 text-right">{formatCurrency(Number(item.unitCost))}</td>
                      <td className="p-3 text-right font-medium">{formatCurrency(itemValue)}</td>
                      <td className="p-3 text-right text-muted-foreground">{Number(item.lowStockThreshold).toLocaleString()}</td>
                      <td className="p-3">
                        <Badge className={status.bg} variant="outline">
                          {status.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {item.lastRestocked
                          ? new Date(item.lastRestocked).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            title="Adjust Stock"
                            onClick={() => openAdjust(item)}
                          >
                            {item.currentStock > 0 ? <ArrowDownCircle className="h-3 w-3" /> : <ArrowUpCircle className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            title="Stock History"
                            onClick={() => fetchMovements(item)}
                          >
                            <History className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            title="Edit Item"
                            onClick={() => openEdit(item)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-red-600 dark:text-red-400 hover:text-red-700"
                            title="Delete Item"
                            onClick={() => setDeleteId(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ===== Add/Edit Item Dialog ===== */}
      <Dialog open={addOpen || !!editItem} onOpenChange={o => { if (!o) { setAddOpen(false); setEditItem(null); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle>
            <DialogDescription>{editItem ? 'Update item details and thresholds' : 'Add a new item to track stock levels'}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-4 py-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="item-name">Item Name *</Label>
                  <Input id="item-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Chicken Breast" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock">Current Stock</Label>
                  <Input id="stock" type="number" step="0.01" value={form.currentStock} onChange={e => setForm({ ...form, currentStock: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost">Unit Cost</Label>
                  <Input id="cost" type="number" step="0.01" value={form.unitCost} onChange={e => setForm({ ...form, unitCost: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="threshold">Low Stock Threshold</Label>
                  <Input id="threshold" type="number" step="0.01" value={form.lowStockThreshold} onChange={e => setForm({ ...form, lowStockThreshold: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reorder">Reorder Level</Label>
                  <Input id="reorder" type="number" step="0.01" value={form.reorderLevel} onChange={e => setForm({ ...form, reorderLevel: e.target.value })} />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier Name</Label>
                  <Input id="supplier" value={form.supplierName} onChange={e => setForm({ ...form, supplierName: e.target.value })} placeholder="e.g., Fresh Farms Inc." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier-contact">Supplier Contact</Label>
                  <Input id="supplier-contact" value={form.supplierContact} onChange={e => setForm({ ...form, supplierContact: e.target.value })} placeholder="Phone or email" />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setEditItem(null); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-emerald-500 to-teal-600">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Stock Adjustment Dialog ===== */}
      <Dialog open={!!adjustItem} onOpenChange={o => !o && setAdjustItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Stock: {adjustItem?.name}</DialogTitle>
            <DialogDescription>
              Current stock: <span className="font-semibold">{adjustItem?.currentStock}</span> {adjustItem?.unit}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={adjustForm.quantity.startsWith('-') || adjustForm.quantity === '' ? 'outline' : 'default'}
                  className={adjustForm.quantity !== '' && !adjustForm.quantity.startsWith('-') ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  onClick={() => setAdjustForm({ ...adjustForm, quantity: Math.abs(parseFloat(adjustForm.quantity) || 0).toString() })}
                >
                  <ArrowUpCircle className="h-4 w-4 mr-1" /> Add Stock
                </Button>
                <Button
                  type="button"
                  variant={adjustForm.quantity.startsWith('-') ? 'default' : 'outline'}
                  className={adjustForm.quantity.startsWith('-') ? 'bg-red-600 hover:bg-red-700' : ''}
                  onClick={() => setAdjustForm({ ...adjustForm, quantity: (-Math.abs(parseFloat(adjustForm.quantity) || 0)).toString() })}
                >
                  <ArrowDownCircle className="h-4 w-4 mr-1" /> Remove Stock
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adj-qty">Quantity *</Label>
              <Input
                id="adj-qty"
                type="number"
                step="0.01"
                value={adjustForm.quantity}
                onChange={e => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                placeholder="e.g., 10 or -5"
              />
              {adjustItem && adjustForm.quantity && (
                <p className="text-xs text-muted-foreground">
                  Resulting stock: {Math.max(0, Number(adjustItem.currentStock) + Number(adjustForm.quantity)).toFixed(2)} {adjustItem.unit}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={adjustForm.reason} onValueChange={v => setAdjustForm({ ...adjustForm, reason: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adj-note">Note</Label>
              <Textarea
                id="adj-note"
                value={adjustForm.note}
                onChange={e => setAdjustForm({ ...adjustForm, note: e.target.value })}
                placeholder="Optional notes about this adjustment"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustItem(null)}>Cancel</Button>
            <Button onClick={handleAdjust} disabled={saving} className="bg-gradient-to-r from-emerald-500 to-teal-600">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Adjust Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Stock Movement History Dialog ===== */}
      <Dialog open={!!historyItem} onOpenChange={o => !o && setHistoryItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Stock History: {historyItem?.name}</DialogTitle>
            <DialogDescription>
              {historyItem?._count?.movements || 0} recorded movements
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No movement history</p>
                <p className="text-sm mt-1">Stock adjustments will appear here</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {movements.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-1 font-mono font-medium ${m.quantity >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {m.quantity >= 0 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {m.quantity >= 0 ? '+' : ''}{Number(m.quantity).toFixed(2)}
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">{m.reason}</div>
                        {m.note && <div className="text-xs text-muted-foreground mt-0.5">{m.note}</div>}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {Number(m.previousStock).toFixed(2)} → {Number(m.newStock).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {new Date(m.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {historyItem && !loadingHistory && movements.length > 0 && (
            <DialogFooter>
              <Button variant="outline" onClick={() => openAdjust(historyItem)}>
                <ArrowUpCircle className="h-4 w-4 mr-1" /> Adjust Stock
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirmation ===== */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inventory Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action will soft-delete the item and its stock data will be preserved for audit purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
