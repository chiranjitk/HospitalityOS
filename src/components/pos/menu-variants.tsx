'use client';

import { useTranslations } from 'next-intl';

import { useState, useEffect, useCallback } from 'react';
import { usePropertyId } from '@/hooks/use-property';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Search, Plus, Loader2, Layers, Edit, Trash2, Wand2 } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
}

interface Variant {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  sku?: string;
  calories?: number;
  isAvailable: boolean;
  isDefault: boolean;
  sortOrder: number;
  menuItem?: MenuItem;
}

export default function MenuVariants() {
const t = useTranslations('pos');
  const { propertyId } = usePropertyId();
  const { formatCurrency } = useCurrency();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [itemFilter, setItemFilter] = useState('all');
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editVariant, setEditVariant] = useState<Variant | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Single form
  const [form, setForm] = useState({ menuItemId: '', name: '', price: '', sku: '', calories: '', isAvailable: true, isDefault: false, sortOrder: '0' });

  // Bulk form
  const [bulkForm, setBulkForm] = useState({ menuItemId: '', sizes: [{ name: 'Small', price: '' }, { name: 'Medium', price: '' }, { name: 'Large', price: '' }] });

  const fetchData = useCallback(async () => {
    if (!propertyId) return;
    try {
      const [varRes, itemsRes] = await Promise.all([
        fetch(`/api/menu-variants?propertyId=${propertyId}${itemFilter !== 'all' ? `&menuItemId=${itemFilter}` : ''}`),
        fetch(`/api/menu-items?propertyId=${propertyId}&limit=200`),
      ]);
      const varData = await varRes.json();
      const itemsData = await itemsRes.json();
      if (varData.success) setVariants(varData.data);
      if (itemsData.success) setMenuItems(itemsData.data);
    } catch { toast.error('Failed to fetch data'); }
    finally { setLoading(false); }
  }, [propertyId, itemFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => setForm({ menuItemId: '', name: '', price: '', sku: '', calories: '', isAvailable: true, isDefault: false, sortOrder: '0' });

  const handleSave = async () => {
    if (!form.menuItemId || !form.name || !form.price || !propertyId) { toast.error('Menu item, name, and price are required'); return; }
    setSaving(true);
    try {
      const method = editVariant ? 'PUT' : 'POST';
      const res = await fetch('/api/menu-variants', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editVariant ? { id: editVariant.id } : {}),
          propertyId,
          menuItemId: form.menuItemId,
          name: form.name,
          price: parseFloat(form.price),
          sku: form.sku || undefined,
          calories: form.calories ? parseInt(form.calories, 10) : undefined,
          isAvailable: form.isAvailable,
          isDefault: form.isDefault,
          sortOrder: parseInt(form.sortOrder, 10) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editVariant ? 'Variant updated' : 'Variant created');
        setAddOpen(false); setEditVariant(null); resetForm(); fetchData();
      } else toast.error(data.error?.message || 'Failed to save');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleBulkCreate = async () => {
    if (!bulkForm.menuItemId || !propertyId) { toast.error('Select a menu item'); return; }
    const validSizes = bulkForm.sizes.filter(s => s.name && s.price);
    if (validSizes.length === 0) { toast.error('Add at least one size with a name and price'); return; }
    setSaving(true);
    try {
      await Promise.all(validSizes.map((s, i) =>
        fetch('/api/menu-variants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertyId, menuItemId: bulkForm.menuItemId, name: s.name, price: parseFloat(s.price), isDefault: i === 0, sortOrder: i }),
        })
      ));
      toast.success(`${validSizes.length} variants created`);
      setBulkOpen(false);
      setBulkForm({ menuItemId: '', sizes: [{ name: 'Small', price: '' }, { name: 'Medium', price: '' }, { name: 'Large', price: '' }] });
      fetchData();
    } catch { toast.error('Failed to create variants'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/menu-variants?id=${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { toast.success('Deleted'); fetchData(); }
      else toast.error(data.error?.message || 'Failed to delete');
    } catch { toast.error('Failed to delete'); }
    setDeleteId(null);
  };

  const openEdit = (v: Variant) => {
    setEditVariant(v);
    setForm({ menuItemId: v.menuItemId, name: v.name, price: v.price.toString(), sku: v.sku || '', calories: v.calories?.toString() || '', isAvailable: v.isAvailable, isDefault: v.isDefault, sortOrder: v.sortOrder.toString() });
  };

  if (!propertyId) return <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><Layers className="h-12 w-12 mb-4" /><p className="text-lg font-medium">No Property Selected</p></div>;
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Menu Variants / Sizes</h1>
        <p className="text-muted-foreground">Manage size variants for menu items</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Variants</CardTitle><Layers className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{variants.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active</CardTitle><Layers className="h-4 w-4 text-emerald-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">{variants.filter(v => v.isAvailable).length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Items With Variants</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{new Set(variants.map(v => v.menuItemId)).size}</div></CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search variants..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={itemFilter} onValueChange={setItemFilter}>
              <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="All Items" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                {menuItems.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Dialog open={bulkOpen} onOpenChange={o => { setBulkOpen(o); if (!o) setBulkForm({ menuItemId: '', sizes: [{ name: 'Small', price: '' }, { name: 'Medium', price: '' }, { name: 'Large', price: '' }] }); }}>
              <DialogTrigger asChild>
                <Button variant="outline"><Wand2 className="h-4 w-4 mr-2" /> Bulk Create</Button>
              </DialogTrigger>
            </Dialog>
            <Dialog open={addOpen} onOpenChange={o => { setAddOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700" onClick={resetForm}><Plus className="h-4 w-4 mr-2" /> Add Variant</Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Variants List */}
      <div className="space-y-4">
        {variants.filter(v => !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.menuItem?.name.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-12"><Layers className="h-12 w-12 text-muted-foreground mb-4" /><h3 className="text-lg font-semibold">No Variants Found</h3><p className="text-muted-foreground">{search ? 'Try adjusting your search' : 'Create your first variant'}</p></CardContent></Card>
        ) : variants.filter(v => !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.menuItem?.name.toLowerCase().includes(search.toLowerCase())).map(variant => (
          <Card key={variant.id} className={!variant.isAvailable ? 'opacity-60' : ''}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center"><Layers className="h-5 w-5 text-emerald-600" /></div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{variant.name}</p>
                    {variant.isDefault && <Badge className="text-xs bg-amber-100 text-amber-700">Default</Badge>}
                    {!variant.isAvailable && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{variant.menuItem?.name || 'Unknown Item'} · {formatCurrency(variant.price)}{variant.sku && ` · SKU: ${variant.sku}`}{variant.calories && ` · ${variant.calories} cal`}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(variant)}><Edit className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => setDeleteId(variant.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={addOpen || !!editVariant} onOpenChange={o => { if (!o) { setAddOpen(false); setEditVariant(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editVariant ? 'Edit Variant' : 'Add Variant'}</DialogTitle><DialogDescription>{editVariant ? 'Update variant details' : 'Add a new size variant'}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Menu Item *</Label>
              <Select value={form.menuItemId} onValueChange={v => setForm({ ...form, menuItemId: v })}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>{menuItems.map(item => <SelectItem key={item.id} value={item.id}>{item.name} ({formatCurrency(item.price)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Variant Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Small, Medium, Large" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Price *</Label><Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
              <div className="space-y-2"><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Calories</Label><Input type="number" value={form.calories} onChange={e => setForm({ ...form, calories: e.target.value })} placeholder="Optional" /></div>
              <div className="space-y-2"><Label>Sort Order</Label><Input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2"><Switch checked={form.isAvailable} onCheckedChange={v => setForm({ ...form, isAvailable: v })} /><Label>Available</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.isDefault} onCheckedChange={v => setForm({ ...form, isDefault: v })} /><Label>Default Variant</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setEditVariant(null); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-emerald-500 to-teal-600">{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{editVariant ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Dialog */}
      <Dialog open={bulkOpen} onOpenChange={o => { setBulkOpen(o); if (!o) setBulkForm({ menuItemId: '', sizes: [{ name: 'Small', price: '' }, { name: 'Medium', price: '' }, { name: 'Large', price: '' }] }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bulk Create Variants</DialogTitle><DialogDescription>Quickly add multiple sizes for a menu item</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Menu Item *</Label>
              <Select value={bulkForm.menuItemId} onValueChange={v => setBulkForm({ ...bulkForm, menuItemId: v })}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>{menuItems.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-3">
              {bulkForm.sizes.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input placeholder="Size name" value={s.name} onChange={e => { const ns = [...bulkForm.sizes]; ns[i] = { ...ns[i], name: e.target.value }; setBulkForm({ ...bulkForm, sizes: ns }); }} className="flex-1" />
                  <Input type="number" step="0.01" placeholder="Price" value={s.price} onChange={e => { const ns = [...bulkForm.sizes]; ns[i] = { ...ns[i], price: e.target.value }; setBulkForm({ ...bulkForm, sizes: ns }); }} className="w-32" />
                  {bulkForm.sizes.length > 1 && <Button size="sm" variant="ghost" onClick={() => setBulkForm({ ...bulkForm, sizes: bulkForm.sizes.filter((_, j) => j !== i) })}>✕</Button>}
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setBulkForm({ ...bulkForm, sizes: [...bulkForm.sizes, { name: '', price: '' }] })}><Plus className="h-3 w-3 mr-1" /> Add Size</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkCreate} disabled={saving} className="bg-gradient-to-r from-emerald-500 to-teal-600">{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Variant</AlertDialogTitle><AlertDialogDescription>Are you sure?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
