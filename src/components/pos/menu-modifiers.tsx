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
import { Search, Plus, Loader2, ListChecks, Edit, Trash2, Eye, GripVertical, X } from 'lucide-react';

interface ModifierOption {
  id?: string;
  name: string;
  priceAdjustment: number;
  isAvailable: boolean;
  isDefault: boolean;
  sortOrder: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  selectionType: string;
  minSelections: number;
  maxSelections: number;
  isAvailable: boolean;
  options: ModifierOption[];
  items: { id: string; name: string }[];
  _count?: { items: number };
}

interface MenuItem {
  id: string;
  name: string;
}

const emptyOption = (): ModifierOption => ({
  name: '',
  priceAdjustment: 0,
  isAvailable: true,
  isDefault: false,
  sortOrder: 0,
});

export default function MenuModifiers() {
const t = useTranslations('pos');
  const { propertyId } = usePropertyId();
  const { formatCurrency } = useCurrency();
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [addOpen, setAddOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<ModifierGroup | null>(null);
  const [viewGroup, setViewGroup] = useState<ModifierGroup | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    selectionType: 'optional',
    minSelections: '0',
    maxSelections: '1',
    isAvailable: true,
    selectedItemIds: [] as string[],
    options: [emptyOption()],
  });

  const fetchData = useCallback(async () => {
    if (!propertyId) return;
    try {
      const [groupsRes, itemsRes] = await Promise.all([
        fetch(`/api/menu-modifiers?propertyId=${propertyId}${search ? `&search=${search}` : ''}`),
        fetch(`/api/menu-items?propertyId=${propertyId}&limit=200`),
      ]);
      const groupsData = await groupsRes.json();
      const itemsData = await itemsRes.json();
      if (groupsData.success) setGroups(groupsData.data);
      if (itemsData.success) setMenuItems(itemsData.data);
    } catch {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [propertyId, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setForm({
      name: '',
      selectionType: 'optional',
      minSelections: '0',
      maxSelections: '1',
      isAvailable: true,
      selectedItemIds: [],
      options: [emptyOption()],
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Group name is required'); return; }
    if (form.options.some(o => !o.name.trim())) { toast.error('All options must have a name'); return; }
    if (!propertyId) return;

    setSaving(true);
    try {
      const url = editGroup ? '/api/menu-modifiers' : '/api/menu-modifiers';
      const method = editGroup ? 'PUT' : 'POST';
      const body = {
        ...(editGroup ? { id: editGroup.id } : {}),
        propertyId,
        name: form.name,
        selectionType: form.selectionType,
        minSelections: parseInt(form.minSelections, 10),
        maxSelections: parseInt(form.maxSelections, 10),
        isAvailable: form.isAvailable,
        itemIds: form.selectedItemIds,
        options: form.options.map((o, i) => ({ ...o, sortOrder: i })),
      };

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) {
        toast.success(editGroup ? 'Modifier group updated' : 'Modifier group created');
        setAddOpen(false);
        setEditGroup(null);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to save');
      }
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/menu-modifiers?id=${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { toast.success('Deleted'); fetchData(); }
      else toast.error(data.error?.message || 'Failed to delete');
    } catch { toast.error('Failed to delete'); }
    setDeleteId(null);
  };

  const openEdit = (g: ModifierGroup) => {
    setEditGroup(g);
    setForm({
      name: g.name,
      selectionType: g.selectionType,
      minSelections: g.minSelections.toString(),
      maxSelections: g.maxSelections.toString(),
      isAvailable: g.isAvailable,
      selectedItemIds: g.items.map(i => i.id),
      options: g.options.length > 0 ? g.options.map(o => ({ name: o.name, priceAdjustment: o.priceAdjustment, isAvailable: o.isAvailable, isDefault: o.isDefault, sortOrder: o.sortOrder })) : [emptyOption()],
    });
  };

  const updateOption = (idx: number, field: keyof ModifierOption, value: string | number | boolean) => {
    setForm(prev => {
      const newOptions = [...prev.options];
      newOptions[idx] = { ...newOptions[idx], [field]: value };
      return { ...prev, options: newOptions };
    });
  };

  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <ListChecks className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No Property Selected</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Menu Modifiers</h1>
        <p className="text-muted-foreground">Manage modifier groups for menu items (sizes, toppings, extras)</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Groups</CardTitle><ListChecks className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{groups.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Groups</CardTitle><ListChecks className="h-4 w-4 text-emerald-500" /></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600">{groups.filter(g => g.isAvailable).length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Options</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{groups.reduce((sum, g) => sum + g.options.length, 0)}</div></CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search modifier groups..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Dialog open={addOpen} onOpenChange={o => { setAddOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700" onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" /> Add Modifier Group
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Groups List */}
      <div className="space-y-4">
        {groups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ListChecks className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No Modifier Groups</h3>
              <p className="text-muted-foreground">{search ? 'Try adjusting your search' : 'Create your first modifier group'}</p>
            </CardContent>
          </Card>
        ) : groups.map(group => (
          <Card key={group.id} className={!group.isAvailable ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">{group.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {group.options.length} options · {group._count?.items || group.items.length} items · {group.selectionType === 'required' ? 'Required' : 'Optional'}
                    {group.selectionType === 'required' && <span> ({group.minSelections}-{group.maxSelections})</span>}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={group.isAvailable ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600'}>
                    {group.isAvailable ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setViewGroup(group)}><Eye className="h-3 w-3" /></Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => openEdit(group)}><Edit className="h-3 w-3" /></Button>
                  <Button size="sm" variant="outline" className="h-8 text-red-600" onClick={() => setDeleteId(group.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {group.options.map(opt => (
                  <Badge key={opt.id || opt.name} variant={opt.isDefault ? 'default' : 'outline'} className="text-xs">
                    {opt.name}
                    {opt.priceAdjustment !== 0 && <span className="ml-1">{opt.priceAdjustment > 0 ? '+' : ''}{formatCurrency(opt.priceAdjustment)}</span>}
                    {opt.isDefault && <span className="ml-1">★</span>}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewGroup} onOpenChange={o => !o && setViewGroup(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{viewGroup?.name}</DialogTitle><DialogDescription>Modifier group details</DialogDescription></DialogHeader>
          {viewGroup && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-4 pr-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Type:</span> <Badge>{viewGroup.selectionType}</Badge></div>
                  <div><span className="text-muted-foreground">Selections:</span> {viewGroup.minSelections}-{viewGroup.maxSelections}</div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Options ({viewGroup.options.length})</h4>
                  <div className="space-y-2">
                    {viewGroup.options.map(opt => (
                      <div key={opt.id} className="flex items-center justify-between p-2 rounded border">
                        <div>
                          <span className="font-medium">{opt.name}</span>
                          {opt.priceAdjustment !== 0 && <span className="ml-2 text-sm text-muted-foreground">{opt.priceAdjustment > 0 ? '+' : ''}{formatCurrency(opt.priceAdjustment)}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {opt.isDefault && <Badge className="text-xs">Default</Badge>}
                          {!opt.isAvailable && <Badge variant="secondary" className="text-xs">Unavailable</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Applied To ({viewGroup.items.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewGroup.items.map(item => <Badge key={item.id} variant="outline">{item.name}</Badge>)}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={addOpen || !!editGroup} onOpenChange={o => { if (!o) { setAddOpen(false); setEditGroup(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editGroup ? 'Edit Modifier Group' : 'Create Modifier Group'}</DialogTitle><DialogDescription>{editGroup ? 'Update modifier group details' : 'Add a new modifier group'}</DialogDescription></DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-4 py-4 pr-4">
              <div className="space-y-2">
                <Label>Group Name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Size, Extra Toppings" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Selection Type</Label>
                  <Select value={form.selectionType} onValueChange={v => setForm({ ...form, selectionType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="required">Required</SelectItem><SelectItem value="optional">Optional</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Available</Label>
                  <div className="flex items-center gap-2 pt-2"><Switch checked={form.isAvailable} onCheckedChange={v => setForm({ ...form, isAvailable: v })} /><span className="text-sm">{form.isAvailable ? 'Yes' : 'No'}</span></div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Min Selections</Label><Input type="number" value={form.minSelections} onChange={e => setForm({ ...form, minSelections: e.target.value })} /></div>
                <div className="space-y-2"><Label>Max Selections</Label><Input type="number" value={form.maxSelections} onChange={e => setForm({ ...form, maxSelections: e.target.value })} /></div>
              </div>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2"><Label className="text-sm font-medium">Applies To Menu Items</Label></div>
                <Select onValueChange={v => { if (!form.selectedItemIds.includes(v)) setForm({ ...form, selectedItemIds: [...form.selectedItemIds, v] }); }}>
                  <SelectTrigger><SelectValue placeholder="+ Add menu item" /></SelectTrigger>
                  <SelectContent>
                    {menuItems.filter(i => !form.selectedItemIds.includes(i.id)).map(item => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.selectedItemIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {form.selectedItemIds.map(id => {
                      const item = menuItems.find(i => i.id === id);
                      return item ? (
                        <Badge key={id} variant="secondary" className="cursor-pointer" onClick={() => setForm({ ...form, selectedItemIds: form.selectedItemIds.filter(x => x !== id) })}>
                          {item.name} <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium">Options ({form.options.length})</Label>
                  <Button size="sm" variant="outline" onClick={() => setForm({ ...form, options: [...form.options, emptyOption()] })}><Plus className="h-3 w-3 mr-1" /> Add Option</Button>
                </div>
                <div className="space-y-3">
                  {form.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                        <Input placeholder="Option name" value={opt.name} onChange={e => updateOption(idx, 'name', e.target.value)} className="h-8" />
                        <Input type="number" step="0.01" placeholder="Price adj." value={opt.priceAdjustment} onChange={e => updateOption(idx, 'priceAdjustment', parseFloat(e.target.value) || 0)} className="h-8" />
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1"><input type="checkbox" checked={opt.isDefault} onChange={e => updateOption(idx, 'isDefault', e.target.checked)} className="rounded" /><span className="text-xs">Default</span></div>
                          <div className="flex items-center gap-1"><input type="checkbox" checked={opt.isAvailable} onChange={e => updateOption(idx, 'isAvailable', e.target.checked)} className="rounded" /><span className="text-xs">Available</span></div>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500" onClick={() => setForm({ ...form, options: form.options.filter((_, i) => i !== idx) })}><X className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setEditGroup(null); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-emerald-500 to-teal-600">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{editGroup ? 'Save Changes' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Modifier Group</AlertDialogTitle><AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
