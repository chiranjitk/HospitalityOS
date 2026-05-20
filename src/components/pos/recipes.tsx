'use client';

import { useTranslations } from 'next-intl';

import { useState, useEffect, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Loader2, ChefHat, Search, Trash2, Eye, Edit, X } from 'lucide-react';
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
import { usePropertyId } from '@/hooks/use-property';
import { cn } from '@/lib/utils';

interface Ingredient { name: string; quantity: number; unit: string; costPerUnit: number; sortOrder: number; }
interface Recipe {
  id: string; menuItemId: string; instructions?: string; prepTime: number; cookTime: number; yield: number; costPerServing: number;
  menuItem: { id: string; name: string; price: number; category?: { id: string; name: string } };
  ingredients: Ingredient[];
}

export default function Recipes() {
const t = useTranslations('pos');
  const { propertyId } = usePropertyId();
  const { formatCurrency } = useCurrency();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [menuItems, setMenuItems] = useState<{ id: string; name: string; price: number; category?: { id: string; name: string } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({ menuItemId: '', instructions: '', prepTime: 0, cookTime: 0, yield: 1, ingredients: [{ name: '', quantity: 0, unit: 'g', costPerUnit: 0, sortOrder: 0 }] });

  const fetchData = useCallback(async () => {
    if (!propertyId) return;
    try {
      const [recipesRes, menuRes] = await Promise.all([
        fetch(`/api/recipes?propertyId=${propertyId}`),
        fetch(`/api/menu-items?propertyId=${propertyId}`),
      ]);
      const recipesData = await recipesRes.json();
      const menuData = await menuRes.json();
      if (recipesData.success) setRecipes(recipesData.data);
      if (menuData.success) setMenuItems(menuData.data);
    } catch { /* silently ignore */ } finally { setLoading(false); }
  }, [propertyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setForm({ menuItemId: '', instructions: '', prepTime: 0, cookTime: 0, yield: 1, ingredients: [{ name: '', quantity: 0, unit: 'g', costPerUnit: 0, sortOrder: 0 }] });
    setEditingRecipe(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const openEdit = (r: Recipe) => {
    setEditingRecipe(r);
    setForm({ menuItemId: r.menuItemId, instructions: r.instructions || '', prepTime: r.prepTime, cookTime: r.cookTime, yield: r.yield, ingredients: r.ingredients.length > 0 ? r.ingredients : [{ name: '', quantity: 0, unit: 'g', costPerUnit: 0, sortOrder: 0 }] });
    setDialogOpen(true);
  };

  const addIngredient = () => setForm(f => ({ ...f, ingredients: [...f.ingredients, { name: '', quantity: 0, unit: 'g', costPerUnit: 0, sortOrder: f.ingredients.length }] }));
  const removeIngredient = (idx: number) => setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));
  const updateIngredient = (idx: number, field: string, value: string | number) => {
    setForm(f => ({ ...f, ingredients: f.ingredients.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing) }));
  };

  const totalCost = form.ingredients.reduce((s, i) => s + (i.quantity * i.costPerUnit), 0);
  const costPerServing = form.yield > 0 ? totalCost / form.yield : totalCost;
  const sellingPrice = menuItems.find(m => m.id === form.menuItemId)?.price || 0;
  const foodCostPct = sellingPrice > 0 ? (costPerServing / sellingPrice) * 100 : 0;
  const profitMargin = sellingPrice > 0 ? ((sellingPrice - costPerServing) / sellingPrice) * 100 : 0;

  const save = async () => {
    if (!form.menuItemId) { toast.error('Select a menu item'); return; }
    setSaving(true);
    try {
      const url = editingRecipe ? '/api/recipes' : '/api/recipes';
      const method = editingRecipe ? 'PUT' : 'POST';
      const body = editingRecipe ? { ...form, id: editingRecipe.id } : form;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) { toast.success(editingRecipe ? 'Recipe updated' : 'Recipe created'); setDialogOpen(false); fetchData(); } else toast.error(data.error?.message || 'Failed');
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const confirmDeleteRecipe = (id: string) => {
    setPendingDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const deleteRecipe = async () => {
    if (!pendingDeleteId) return;
    try { const res = await fetch(`/api/recipes?id=${pendingDeleteId}`, { method: 'DELETE' }); const data = await res.json(); if (data.success) { toast.success('Recipe deleted'); fetchData(); } else toast.error('Failed'); } catch { toast.error('Failed'); } finally { setDeleteDialogOpen(false); setPendingDeleteId(null); }
  };

  const categories = [...new Set(menuItems.map(m => m.category?.name).filter(Boolean))];
  const filtered = recipes.filter(r => {
    const matchSearch = !search || r.menuItem.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || r.menuItem.category?.name === categoryFilter;
    return matchSearch && matchCat;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!propertyId) return <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><ChefHat className="h-12 w-12 mb-4" /><p>No Property Selected</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Recipes</h1><p className="text-muted-foreground">Manage recipes and food costs</p></div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Recipe</Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search recipes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem>{categories.map(c => <SelectItem key={c} value={c || ''}>{c}</SelectItem>)}</SelectContent></Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12"><ChefHat className="h-12 w-12 text-muted-foreground mb-4" /><h3 className="text-lg font-semibold">No Recipes Found</h3><p className="text-muted-foreground">Add your first recipe to track food costs</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const margin = r.menuItem.price > 0 ? ((r.menuItem.price - r.costPerServing) / r.menuItem.price) * 100 : 0;
            return (
              <Card key={r.id} className="hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{r.menuItem.name}</h3>
                      <Badge variant="outline" className="text-xs">{r.menuItem.category?.name}</Badge>
                      <Badge variant="outline" className="text-xs">{r.ingredients.length} ingredients</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>Cost: {formatCurrency(r.costPerServing)}/serving</span>
                      <span>Sells: {formatCurrency(r.menuItem.price)}</span>
                      <span className={cn('font-medium', margin > 70 ? 'text-emerald-600' : margin > 50 ? 'text-amber-600' : 'text-red-600')}>Margin: {margin.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setViewingRecipe(r); setDetailOpen(true); }}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => confirmDeleteRecipe(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRecipe ? 'Edit Recipe' : 'Add Recipe'}</DialogTitle><DialogDescription>Define ingredients and calculate food costs</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <Select value={form.menuItemId} onValueChange={v => setForm(f => ({ ...f, menuItemId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select menu item" /></SelectTrigger>
              <SelectContent>{menuItems.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({formatCurrency(m.price)})</SelectItem>)}</SelectContent>
            </Select>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div><label className="text-xs font-medium">Prep Time (min)</label><Input type="number" value={form.prepTime} onChange={e => setForm(f => ({ ...f, prepTime: +e.target.value }))} /></div>
              <div><label className="text-xs font-medium">Cook Time (min)</label><Input type="number" value={form.cookTime} onChange={e => setForm(f => ({ ...f, cookTime: +e.target.value }))} /></div>
              <div><label className="text-xs font-medium">Yield (servings)</label><Input type="number" min={1} value={form.yield} onChange={e => setForm(f => ({ ...f, yield: +e.target.value }))} /></div>
            </div>
            <Textarea placeholder="Cooking instructions..." value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} />
            <Separator />
            <div className="flex items-center justify-between"><h4 className="font-medium">Ingredients</h4><Button size="sm" variant="outline" onClick={addIngredient}><Plus className="h-3 w-3 mr-1" />Add</Button></div>
            {form.ingredients.map((ing, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_80px_80px_32px] gap-2 items-center">
                <Input placeholder="Ingredient name" value={ing.name} onChange={e => updateIngredient(idx, 'name', e.target.value)} />
                <Input type="number" placeholder="Qty" value={ing.quantity || ''} onChange={e => updateIngredient(idx, 'quantity', +e.target.value)} />
                <Select value={ing.unit} onValueChange={v => updateIngredient(idx, 'unit', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['g', 'kg', 'ml', 'L', 'pcs', 'tsp', 'tbsp'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
                <Input type="number" placeholder="Cost/unit" value={ing.costPerUnit || ''} onChange={e => updateIngredient(idx, 'costPerUnit', +e.target.value)} />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeIngredient(idx)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-muted-foreground">Total Cost:</span><p className="font-bold">{formatCurrency(totalCost)}</p></div>
              <div><span className="text-muted-foreground">Cost/Serving:</span><p className="font-bold">{formatCurrency(costPerServing)}</p></div>
              <div><span className="text-muted-foreground">Selling Price:</span><p className="font-bold">{formatCurrency(sellingPrice)}</p></div>
              <div><span className="text-muted-foreground">Food Cost:</span><p className={cn('font-bold', foodCostPct > 35 ? 'text-red-600' : foodCostPct > 25 ? 'text-amber-600' : 'text-emerald-600')}>{foodCostPct.toFixed(1)}%</p></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}{editingRecipe ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewingRecipe?.menuItem.name}</DialogTitle></DialogHeader>
          {viewingRecipe && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">Prep:</span><p>{viewingRecipe.prepTime} min</p></div>
                <div><span className="text-muted-foreground">Cook:</span><p>{viewingRecipe.cookTime} min</p></div>
                <div><span className="text-muted-foreground">Yield:</span><p>{viewingRecipe.yield} servings</p></div>
              </div>
              {viewingRecipe.instructions && <div><span className="text-sm text-muted-foreground">Instructions:</span><p className="text-sm mt-1">{viewingRecipe.instructions}</p></div>}
              <Separator />
              <h4 className="font-medium">Ingredients ({viewingRecipe.ingredients.length})</h4>
              <div className="space-y-1">{viewingRecipe.ingredients.map((ing, i) => (
                <div key={i} className="flex justify-between text-sm p-2 rounded border"><span>{ing.name}</span><span>{ing.quantity} {ing.unit} ({formatCurrency(ing.quantity * ing.costPerUnit)})</span></div>
              ))}</div>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">Cost/Serving:</span><p className="font-bold">{formatCurrency(viewingRecipe.costPerServing)}</p></div>
                <div><span className="text-muted-foreground">Selling Price:</span><p className="font-bold">{formatCurrency(viewingRecipe.menuItem.price)}</p></div>
                <div><span className="text-muted-foreground">Margin:</span><p className="font-bold">{((viewingRecipe.menuItem.price - viewingRecipe.costPerServing) / viewingRecipe.menuItem.price * 100).toFixed(1)}%</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recipe</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this recipe? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteRecipe}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
