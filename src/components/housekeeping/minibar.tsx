'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  Wine,
  Search,
  Loader2,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Save,
  AlertTriangle,
  CheckCircle2,
  Package,
  ShoppingBag,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// --- Types ---
interface MinibarItem {
  id: string;
  propertyId: string;
  name: string;
  category: string;
  sku?: string | null;
  costPrice: number;
  sellPrice: number;
  currency: string;
  imageUrl?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

interface MinibarSetupEntry {
  itemId: string;
  itemName: string;
  quantity: number;
  threshold: number;
}

interface MinibarConsumption {
  id: string;
  propertyId: string;
  bookingId: string;
  roomId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  postedToFolio: boolean;
  postedAt?: string | null;
  consumedAt: string;
  consumedBy?: string | null;
  notes?: string | null;
  booking?: { id: string; confirmationCode: string; primaryGuest?: { id: string; firstName: string; lastName: string } | null } | null;
  room?: { id: string; name?: string | null; roomNumber?: string | null } | null;
  folio?: { id: string; folioNumber: string } | null;
}

interface Room {
  id: string;
  name?: string | null;
  roomNumber?: string | null;
  floor?: number | null;
}

interface Property {
  id: string;
  name: string;
}

const CATEGORIES = [
  { value: 'beverage', label: 'Beverage' },
  { value: 'snack', label: 'Snack' },
  { value: 'premium', label: 'Premium' },
  { value: 'other', label: 'Other' },
];

export default function MinibarPage() {
  const { toast } = useToast();

  // Shared state
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  // Items catalog
  const [items, setItems] = useState<MinibarItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [itemCategoryFilter, setItemCategoryFilter] = useState('all');
  const [itemSearch, setItemSearch] = useState('');

  // Rooms (for setup and consumption)
  const [rooms, setRooms] = useState<Room[]>([]);

  // Room setup
  const [selectedSetupRoomId, setSelectedSetupRoomId] = useState<string>('');
  const [setupEntries, setSetupEntries] = useState<MinibarSetupEntry[]>([]);
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [isSavingSetup, setIsSavingSetup] = useState(false);

  // Consumption log
  const [consumptions, setConsumptions] = useState<MinibarConsumption[]>([]);
  const [isLoadingConsumption, setIsLoadingConsumption] = useState(false);
  const [consumptionRoomFilter, setConsumptionRoomFilter] = useState('all');
  const [consumptionPostedFilter, setConsumptionPostedFilter] = useState('all');

  // Dialogs
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isConsumptionDialogOpen, setIsConsumptionDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Item form
  const [itemForm, setItemForm] = useState({
    name: '',
    category: 'beverage',
    sku: '',
    costPrice: '',
    sellPrice: '',
    isActive: true,
  });

  // Consumption form
  const [consumptionForm, setConsumptionForm] = useState({
    roomId: '',
    itemId: '',
    itemName: '',
    quantity: '1',
    unitPrice: '',
    notes: '',
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

  // Fetch rooms
  useEffect(() => {
    const fetchRooms = async () => {
      if (!selectedPropertyId) return;
      try {
        const res = await fetch(`/api/rooms?propertyId=${selectedPropertyId}&limit=200`);
        const result = await res.json();
        if (result.success) setRooms(result.data || []);
      } catch { /* silent */ }
    };
    fetchRooms();
  }, [selectedPropertyId]);

  // Fetch items
  const fetchItems = useCallback(async () => {
    if (!selectedPropertyId) return;
    setIsLoadingItems(true);
    try {
      const params = new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' });
      if (itemCategoryFilter !== 'all') params.set('category', itemCategoryFilter);
      if (itemSearch) params.set('search', itemSearch);
      const res = await fetch(`/api/minibar/items?${params}`);
      const result = await res.json();
      if (result.success) setItems(result.data?.items || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch minibar items', variant: 'destructive' });
    } finally {
      setIsLoadingItems(false);
    }
  }, [selectedPropertyId, itemCategoryFilter, itemSearch, toast]);

  // Fetch setup for a room
  const fetchSetup = useCallback(async (roomId: string) => {
    if (!selectedPropertyId || !roomId) return;
    setIsLoadingSetup(true);
    try {
      const res = await fetch(`/api/minibar/setup?propertyId=${selectedPropertyId}&roomId=${roomId}`);
      const result = await res.json();
      if (result.success && result.data?.setups?.length > 0) {
        const parsed = JSON.parse(result.data.setups[0].itemJson || '[]');
        setSetupEntries(parsed);
      } else {
        setSetupEntries([]);
      }
    } catch {
      setSetupEntries([]);
    } finally {
      setIsLoadingSetup(false);
    }
  }, [selectedPropertyId]);

  // Fetch consumption log
  const fetchConsumption = useCallback(async () => {
    if (!selectedPropertyId) return;
    setIsLoadingConsumption(true);
    try {
      const params = new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' });
      if (consumptionRoomFilter !== 'all') params.set('roomId', consumptionRoomFilter);
      if (consumptionPostedFilter !== 'all') params.set('postedToFolio', consumptionPostedFilter);
      const res = await fetch(`/api/minibar/consumption?${params}`);
      const result = await res.json();
      if (result.success) setConsumptions(result.data?.consumptions || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch consumption log', variant: 'destructive' });
    } finally {
      setIsLoadingConsumption(false);
    }
  }, [selectedPropertyId, consumptionRoomFilter, consumptionPostedFilter, toast]);

  useEffect(() => {
    if (!selectedPropertyId) return;
    (async () => {
      setIsLoadingItems(true);
      try {
        const params = new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' });
        if (itemCategoryFilter !== 'all') params.set('category', itemCategoryFilter);
        const res = await fetch(`/api/minibar/items?${params}`);
        const result = await res.json();
        if (result.success) setItems(result.data?.items || []);
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch minibar items', variant: 'destructive' });
      } finally {
        setIsLoadingItems(false);
      }
    })();
  }, [selectedPropertyId, itemCategoryFilter, toast]);

  useEffect(() => {
    if (!selectedPropertyId) return;
    (async () => {
      setIsLoadingConsumption(true);
      try {
        const params = new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' });
        if (consumptionRoomFilter !== 'all') params.set('roomId', consumptionRoomFilter);
        if (consumptionPostedFilter !== 'all') params.set('postedToFolio', consumptionPostedFilter);
        const res = await fetch(`/api/minibar/consumption?${params}`);
        const result = await res.json();
        if (result.success) setConsumptions(result.data?.consumptions || []);
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch consumption log', variant: 'destructive' });
      } finally {
        setIsLoadingConsumption(false);
      }
    })();
  }, [selectedPropertyId, consumptionRoomFilter, consumptionPostedFilter, toast]);

  // Debounced item search
  useEffect(() => {
    const t = setTimeout(() => { if (itemSearch.length >= 2 || itemSearch.length === 0) fetchItems(); }, 400);
    return () => clearTimeout(t);
  }, [itemSearch, fetchItems]);

  // Fetch setup when room selected
  useEffect(() => {
    if (selectedSetupRoomId) {
      (async () => {
        if (!selectedPropertyId || !selectedSetupRoomId) return;
        setIsLoadingSetup(true);
        try {
          const res = await fetch(`/api/minibar/setup?propertyId=${selectedPropertyId}&roomId=${selectedSetupRoomId}`);
          const result = await res.json();
          if (result.success && result.data?.setups?.length > 0) {
            const parsed = JSON.parse(result.data.setups[0].itemJson || '[]');
            setSetupEntries(parsed);
          } else {
            setSetupEntries([]);
          }
        } catch {
          setSetupEntries([]);
        } finally {
          setIsLoadingSetup(false);
        }
      })();
    } else {
      (async () => { setSetupEntries([]); })();
    }
  }, [selectedPropertyId, selectedSetupRoomId]);

  // --- Create Item ---
  const handleCreateItem = async () => {
    if (!itemForm.name.trim() || !selectedPropertyId) {
      toast({ title: 'Validation', description: 'Item name is required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/minibar/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          name: itemForm.name,
          category: itemForm.category,
          sku: itemForm.sku || undefined,
          costPrice: parseFloat(itemForm.costPrice) || 0,
          sellPrice: parseFloat(itemForm.sellPrice) || 0,
          isActive: itemForm.isActive,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Minibar item created' });
        setIsItemDialogOpen(false);
        resetItemForm();
        fetchItems();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to create item', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create item', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    setActionLoading(`del-${id}`);
    try {
      const res = await fetch(`/api/minibar/items/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Deleted', description: 'Item deleted' });
        fetchItems();
      } else {
        toast({ title: 'Error', description: result.error || 'Delete failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete item', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  // --- Save Setup ---
  const handleSaveSetup = async () => {
    if (!selectedPropertyId || !selectedSetupRoomId) return;
    setIsSavingSetup(true);
    try {
      const res = await fetch('/api/minibar/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          roomId: selectedSetupRoomId,
          itemJson: setupEntries,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Saved', description: 'Room minibar setup saved' });
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to save setup', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save setup', variant: 'destructive' });
    } finally {
      setIsSavingSetup(false);
    }
  };

  // --- Log Consumption ---
  const handleLogConsumption = async () => {
    if (!consumptionForm.roomId || !consumptionForm.itemId || !selectedPropertyId) {
      toast({ title: 'Validation', description: 'Room and item are required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      // Find booking for the room
      const bookingRes = await fetch(`/api/bookings?propertyId=${selectedPropertyId}&status=checked_in&limit=50`);
      const bookingResult = await bookingRes.json();
      const activeBooking = bookingResult.data?.find(
        (b: { roomId?: string; room?: { id: string } }) => (b.roomId === consumptionForm.roomId || b.room?.id === consumptionForm.roomId)
      );

      if (!activeBooking) {
        toast({ title: 'No Active Booking', description: 'No checked-in booking found for this room', variant: 'destructive' });
        setIsSaving(false);
        return;
      }

      const selectedItem = items.find(i => i.id === consumptionForm.itemId);
      const unitPrice = parseFloat(consumptionForm.unitPrice) || selectedItem?.sellPrice || 0;

      const res = await fetch('/api/minibar/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          bookingId: activeBooking.id,
          roomId: consumptionForm.roomId,
          itemId: consumptionForm.itemId,
          itemName: consumptionForm.itemName || selectedItem?.name || '',
          quantity: parseInt(consumptionForm.quantity) || 1,
          unitPrice,
          notes: consumptionForm.notes || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Consumption Logged', description: `${consumptionForm.itemName || 'Item'} x${consumptionForm.quantity} logged` });
        setIsConsumptionDialogOpen(false);
        resetConsumptionForm();
        fetchConsumption();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to log consumption', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to log consumption', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Update setup entry
  const updateSetupEntry = (idx: number, field: string, value: number) => {
    setSetupEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const resetItemForm = () => {
    setItemForm({ name: '', category: 'beverage', sku: '', costPrice: '', sellPrice: '', isActive: true });
  };

  const resetConsumptionForm = () => {
    setConsumptionForm({ roomId: '', itemId: '', itemName: '', quantity: '1', unitPrice: '', notes: '' });
  };

  const formatCurrency = (amount: number) => `$${(amount || 0).toFixed(2)}`;

  const getCategoryLabel = (cat: string) => CATEGORIES.find(c => c.value === cat)?.label || cat;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Wine className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            Minibar Management
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage minibar inventory, room setup, and consumption</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:w-48 h-10"><SelectValue placeholder="Property" /></SelectTrigger>
            <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { fetchItems(); fetchConsumption(); }} className="min-w-[44px]">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          <TabsTrigger value="catalog" className="gap-1.5"><Package className="h-4 w-4" />Items Catalog</TabsTrigger>
          <TabsTrigger value="setup" className="gap-1.5"><Wine className="h-4 w-4" />Room Setup</TabsTrigger>
          <TabsTrigger value="consumption" className="gap-1.5"><ShoppingBag className="h-4 w-4" />Consumption Log</TabsTrigger>
        </TabsList>

        {/* ========== ITEMS CATALOG TAB ========== */}
        <TabsContent value="catalog" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search items..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} className="pl-9 h-10" />
            </div>
            <div className="flex gap-2">
              <Select value={itemCategoryFilter} onValueChange={setItemCategoryFilter}>
                <SelectTrigger className="w-full sm:w-36 h-10"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => { resetItemForm(); setIsItemDialogOpen(true); }} className="bg-gradient-to-r from-orange-600 to-orange-500 hover:shadow-lg hover:shadow-orange-500/20 transition-all">
                <Plus className="h-4 w-4 mr-1.5" />Add Item
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingItems ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Package className="h-12 w-12 mb-3 opacity-30" />
                  <p className="font-medium">No items found</p>
                  <Button className="mt-4" onClick={() => { resetItemForm(); setIsItemDialogOpen(true); }}><Plus className="h-4 w-4 mr-1.5" />Add Item</Button>
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <ScrollArea className="max-h-[500px]">
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead className="text-right">Cost Price</TableHead>
                            <TableHead className="text-right">Sell Price</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map(item => (
                            <TableRow key={item.id}>
                              <TableCell><p className="font-medium text-sm">{item.name}</p></TableCell>
                              <TableCell><Badge variant="outline">{getCategoryLabel(item.category)}</Badge></TableCell>
                              <TableCell className="text-sm font-mono">{item.sku || '—'}</TableCell>
                              <TableCell className="text-right text-sm">{formatCurrency(item.costPrice)}</TableCell>
                              <TableCell className="text-right font-medium text-sm">{formatCurrency(item.sellPrice)}</TableCell>
                              <TableCell>
                                <Badge variant={item.isActive ? 'default' : 'secondary'} className={cn(item.isActive && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300')}>
                                  {item.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem onClick={() => handleDeleteItem(item.id)} className="text-red-600 dark:text-red-400">
                                      <Trash2 className="h-4 w-4 mr-2" />Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </ScrollArea>
                  </div>
                  {/* Mobile cards */}
                  <div className="md:hidden divide-y divide-border">
                    {items.map(item => (
                      <div key={item.id} className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{getCategoryLabel(item.category)}{item.sku ? ` • SKU: ${item.sku}` : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">{formatCurrency(item.sellPrice)}</p>
                          <Badge variant={item.isActive ? 'default' : 'secondary'} className="text-xs">{item.isActive ? 'Active' : 'Off'}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== ROOM SETUP TAB ========== */}
        <TabsContent value="setup" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedSetupRoomId} onValueChange={setSelectedSetupRoomId}>
              <SelectTrigger className="w-full sm:w-64 h-10">
                <SelectValue placeholder="Select a room..." />
              </SelectTrigger>
              <SelectContent>
                {rooms.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    Room {r.roomNumber || r.name || r.id.slice(0, 8)}{r.floor != null ? ` • Floor ${r.floor}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSetupRoomId && (
              <Button onClick={handleSaveSetup} disabled={isSavingSetup || setupEntries.length === 0} className="bg-gradient-to-r from-orange-600 to-orange-500 hover:shadow-lg transition-all">
                {isSavingSetup ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                Save Setup
              </Button>
            )}
          </div>

          {!selectedSetupRoomId ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Wine className="h-12 w-12 mb-3 opacity-30" />
                <p className="font-medium">Select a room to view/setup minibar</p>
              </CardContent>
            </Card>
          ) : isLoadingSetup ? (
            <Card><CardContent className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></CardContent></Card>
          ) : setupEntries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Package className="h-12 w-12 mb-3 opacity-30" />
                <p className="font-medium">No items configured for this room</p>
                <p className="text-sm mt-1">Items from the catalog can be added to this room&apos;s setup</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {setupEntries.map((entry, idx) => {
                const needsRestock = entry.quantity <= entry.threshold;
                return (
                  <Card key={idx} className={cn('p-4 transition-all', needsRestock && 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30')}>
                    <div className="flex justify-between items-start mb-3">
                      <p className="font-semibold text-sm">{entry.itemName}</p>
                      {needsRestock && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" />Restock
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Current Qty</Label>
                        <Input
                          type="number"
                          min="0"
                          value={entry.quantity}
                          onChange={e => updateSetupEntry(idx, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-20 h-8 text-sm text-right"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Threshold</Label>
                        <Input
                          type="number"
                          min="0"
                          value={entry.threshold}
                          onChange={e => updateSetupEntry(idx, 'threshold', parseInt(e.target.value) || 0)}
                          className="w-20 h-8 text-sm text-right"
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ========== CONSUMPTION LOG TAB ========== */}
        <TabsContent value="consumption" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2 flex-1">
              <Select value={consumptionRoomFilter} onValueChange={setConsumptionRoomFilter}>
                <SelectTrigger className="w-full sm:w-44 h-10"><SelectValue placeholder="All Rooms" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  {rooms.slice(0, 20).map(r => (
                    <SelectItem key={r.id} value={r.id}>Room {r.roomNumber || r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={consumptionPostedFilter} onValueChange={setConsumptionPostedFilter}>
                <SelectTrigger className="w-full sm:w-40 h-10"><SelectValue placeholder="Posted" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Posted to Folio</SelectItem>
                  <SelectItem value="false">Not Posted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { resetConsumptionForm(); setIsConsumptionDialogOpen(true); }} className="bg-gradient-to-r from-orange-600 to-orange-500 hover:shadow-lg transition-all">
              <Plus className="h-4 w-4 mr-1.5" />Log Consumption
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingConsumption ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : consumptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <ShoppingBag className="h-12 w-12 mb-3 opacity-30" />
                  <p className="font-medium">No consumption records</p>
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <ScrollArea className="max-h-[500px]">
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Room</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Posted</TableHead>
                            <TableHead>Consumed At</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {consumptions.map(c => (
                            <TableRow key={c.id}>
                              <TableCell className="text-sm font-medium">Room {c.room?.roomNumber || c.room?.name || c.roomId.slice(0, 8)}</TableCell>
                              <TableCell>
                                <p className="text-sm font-medium">{c.itemName}</p>
                                {c.booking?.primaryGuest && <p className="text-xs text-muted-foreground">{c.booking.primaryGuest.firstName} {c.booking.primaryGuest.lastName}</p>}
                              </TableCell>
                              <TableCell className="text-right text-sm">{c.quantity}</TableCell>
                              <TableCell className="text-right text-sm">{formatCurrency(c.unitPrice)}</TableCell>
                              <TableCell className="text-right font-medium text-sm">{formatCurrency(c.totalPrice)}</TableCell>
                              <TableCell>
                                <Badge variant={c.postedToFolio ? 'default' : 'secondary'} className={cn(c.postedToFolio && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300')}>
                                  {c.postedToFolio ? 'Yes' : 'No'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{new Date(c.consumedAt).toLocaleString()}</TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(c.id); toast({ title: 'Copied', description: 'Consumption ID copied' }); }}>Copy ID</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </ScrollArea>
                  </div>
                  {/* Mobile */}
                  <div className="md:hidden divide-y divide-border">
                    {consumptions.map(c => (
                      <div key={c.id} className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-sm">{c.itemName}</p>
                            <p className="text-xs text-muted-foreground">Room {c.room?.roomNumber || '—'} • x{c.quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">{formatCurrency(c.totalPrice)}</p>
                            <Badge variant={c.postedToFolio ? 'default' : 'secondary'} className="text-xs">{c.postedToFolio ? 'Posted' : 'Pending'}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(c.consumedAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========== ADD ITEM DIALOG ========== */}
      <Dialog open={isItemDialogOpen} onOpenChange={open => { if (!open) resetItemForm(); setIsItemDialogOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Minibar Item</DialogTitle>
            <DialogDescription>Create a new item for the minibar catalog</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))} placeholder="Sparkling Water" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={itemForm.category} onValueChange={v => setItemForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>SKU</Label><Input value={itemForm.sku} onChange={e => setItemForm(p => ({ ...p, sku: e.target.value }))} placeholder="MB-001" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Cost Price</Label><Input type="number" step="0.01" value={itemForm.costPrice} onChange={e => setItemForm(p => ({ ...p, costPrice: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Sell Price</Label><Input type="number" step="0.01" value={itemForm.sellPrice} onChange={e => setItemForm(p => ({ ...p, sellPrice: e.target.value }))} /></div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={itemForm.isActive} onCheckedChange={v => setItemForm(p => ({ ...p, isActive: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsItemDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateItem} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== LOG CONSUMPTION DIALOG ========== */}
      <Dialog open={isConsumptionDialogOpen} onOpenChange={open => { if (!open) resetConsumptionForm(); setIsConsumptionDialogOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Consumption</DialogTitle>
            <DialogDescription>Record minibar item consumption for a guest room</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Room *</Label>
              <Select value={consumptionForm.roomId} onValueChange={v => setConsumptionForm(p => ({ ...p, roomId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select room..." /></SelectTrigger>
                <SelectContent>
                  {rooms.map(r => (
                    <SelectItem key={r.id} value={r.id}>Room {r.roomNumber || r.name || r.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Item *</Label>
              <Select value={consumptionForm.itemId} onValueChange={v => {
                const item = items.find(i => i.id === v);
                setConsumptionForm(p => ({ ...p, itemId: v, itemName: item?.name || '', unitPrice: item?.sellPrice?.toString() || '' }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select item..." /></SelectTrigger>
                <SelectContent>
                  {items.filter(i => i.isActive).map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.name} — {formatCurrency(i.sellPrice)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" min="1" value={consumptionForm.quantity} onChange={e => setConsumptionForm(p => ({ ...p, quantity: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Unit Price</Label><Input type="number" step="0.01" value={consumptionForm.unitPrice} onChange={e => setConsumptionForm(p => ({ ...p, unitPrice: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={consumptionForm.notes} onChange={e => setConsumptionForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            {consumptionForm.itemName && consumptionForm.quantity && (
              <Card className="p-3 bg-muted/30">
                <div className="flex justify-between text-sm">
                  <span>Total</span>
                  <span className="font-bold">{formatCurrency((parseFloat(consumptionForm.unitPrice) || 0) * (parseInt(consumptionForm.quantity) || 1))}</span>
                </div>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConsumptionDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleLogConsumption} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ShoppingBag className="h-4 w-4 mr-1.5" />}Log Consumption</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
