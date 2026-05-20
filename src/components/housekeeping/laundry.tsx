'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import {
  Shirt,
  Search,
  Loader2,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Clock,
  CheckCircle2,
  PlayCircle,
  Package,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Timer,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// --- Types ---
interface LaundryItem {
  id: string;
  propertyId: string;
  name: string;
  category: string;
  serviceType: string;
  unitPrice: number;
  currency: string;
  turnaroundHours: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

interface LaundryOrderItem {
  id: string;
  itemId: string;
  itemName: string;
  serviceType: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
  notes?: string | null;
}

interface LaundryOrder {
  id: string;
  propertyId: string;
  bookingId?: string | null;
  guestId?: string | null;
  roomId: string;
  orderType: string;
  status: string;
  totalItems: number;
  totalPrice: number;
  currency: string;
  paymentMethod: string;
  specialInstructions?: string | null;
  postedToFolio: boolean;
  receivedAt: string;
  readyAt?: string | null;
  deliveredAt?: string | null;
  notes?: string | null;
  items: LaundryOrderItem[];
  booking?: { id: string; confirmationCode: string; primaryGuest?: { id: string; firstName: string; lastName: string; email?: string | null } | null } | null;
  guest?: { id: string; firstName: string; lastName: string } | null;
  room?: { id: string; name?: string | null; roomNumber?: string | null } | null;
  folio?: { id: string; folioNumber: string; status: string } | null;
  createdAt: string;
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
  { value: 'guest', label: 'Guest' },
  { value: 'house', label: 'House' },
  { value: 'linen', label: 'Linen' },
  { value: 'uniform', label: 'Uniform' },
];

const SERVICE_TYPES = [
  { value: 'wash', label: 'Wash' },
  { value: 'dry_clean', label: 'Dry Clean' },
  { value: 'iron', label: 'Iron' },
  { value: 'wash_iron', label: 'Wash & Iron' },
  { value: 'press', label: 'Press' },
];

const ORDER_STATUSES: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  received: { label: 'Received', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: PlayCircle },
  ready: { label: 'Ready', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Package },
  delivered: { label: 'Delivered', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-gray-50 text-gray-500 border-gray-200', icon: X },
};

export default function LaundryPage() {
  const { toast } = useToast();

  // Shared
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  // Service items
  const [laundryItems, setLaundryItems] = useState<LaundryItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Orders
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Rooms
  const [rooms, setRooms] = useState<Room[]>([]);

  // Stats
  // Stats computed via useMemo below

  // Dialogs
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Item form
  const [itemForm, setItemForm] = useState({
    name: '',
    category: 'guest',
    serviceType: 'wash',
    unitPrice: '',
    turnaroundHours: '24',
    isActive: true,
  });

  // Order form — order items with qty
  const [orderRoomId, setOrderRoomId] = useState('');
  const [orderPaymentMethod, setOrderPaymentMethod] = useState('room_charge');
  const [orderSpecialInstructions, setOrderSpecialInstructions] = useState('');
  const [orderItems, setOrderItems] = useState<{ itemId: string; quantity: number; notes: string }[]>([
    { itemId: '', quantity: 1, notes: '' },
  ]);

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

  // Fetch service items
  const fetchItems = useCallback(async () => {
    if (!selectedPropertyId) return;
    setIsLoadingItems(true);
    try {
      const res = await fetch(`/api/laundry/items?propertyId=${selectedPropertyId}&limit=100`);
      const result = await res.json();
      if (result.success) setLaundryItems(result.data?.items || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch laundry items', variant: 'destructive' });
    } finally {
      setIsLoadingItems(false);
    }
  }, [selectedPropertyId, toast]);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!selectedPropertyId) return;
    setIsLoadingOrders(true);
    try {
      const params = new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' });
      if (orderStatusFilter !== 'all') params.set('status', orderStatusFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/laundry/orders?${params}`);
      const result = await res.json();
      if (result.success) {
        setOrders(result.data?.orders || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch laundry orders', variant: 'destructive' });
    } finally {
      setIsLoadingOrders(false);
    }
  }, [selectedPropertyId, orderStatusFilter, dateFrom, dateTo, toast]);

  // Compute stats
  const orderStats = useMemo(() => {
    const inProgress = orders.filter(o => o.status === 'in_progress').length;
    const today = new Date().toDateString();
    const revenueToday = orders
      .filter(o => new Date(o.receivedAt).toDateString() === today && o.status === 'delivered')
      .reduce((s, o) => s + o.totalPrice, 0);
    const turnaroundOrders = orders.filter(o => o.deliveredAt && o.receivedAt);
    const avgTurnaround = turnaroundOrders.length > 0
      ? turnaroundOrders.reduce((s, o) => s + (new Date(o.deliveredAt!).getTime() - new Date(o.receivedAt).getTime()) / 3600000, 0) / turnaroundOrders.length
      : 0;
    return { total: orders.length, inProgress, revenueToday, avgTurnaround };
  }, [orders]);

  useEffect(() => {
    if (!selectedPropertyId) return;
    (async () => {
      setIsLoadingItems(true);
      try {
        const res = await fetch(`/api/laundry/items?propertyId=${selectedPropertyId}&limit=100`);
        const result = await res.json();
        if (result.success) setLaundryItems(result.data?.items || []);
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch laundry items', variant: 'destructive' });
      } finally {
        setIsLoadingItems(false);
      }
    })();
  }, [selectedPropertyId, toast]);

  useEffect(() => {
    if (!selectedPropertyId) return;
    (async () => {
      setIsLoadingOrders(true);
      try {
        const params = new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' });
        if (orderStatusFilter !== 'all') params.set('status', orderStatusFilter);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
        const res = await fetch(`/api/laundry/orders?${params}`);
        const result = await res.json();
        if (result.success) setOrders(result.data?.orders || []);
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch laundry orders', variant: 'destructive' });
      } finally {
        setIsLoadingOrders(false);
      }
    })();
  }, [selectedPropertyId, orderStatusFilter, dateFrom, dateTo, toast]);

  // --- Create Item ---
  const handleCreateItem = async () => {
    if (!itemForm.name.trim() || !selectedPropertyId) {
      toast({ title: 'Validation', description: 'Item name is required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/laundry/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          name: itemForm.name,
          category: itemForm.category,
          serviceType: itemForm.serviceType,
          unitPrice: parseFloat(itemForm.unitPrice) || 0,
          turnaroundHours: parseInt(itemForm.turnaroundHours) || 24,
          isActive: itemForm.isActive,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Laundry item created' });
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
      const res = await fetch(`/api/laundry/items/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) { toast({ title: 'Deleted', description: 'Item deleted' }); fetchItems(); }
      else { toast({ title: 'Error', description: result.error || 'Delete failed', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Failed to delete item', variant: 'destructive' }); }
    finally { setActionLoading(null); }
  };

  // --- Create Order ---
  const addOrderItemRow = () => setOrderItems(prev => [...prev, { itemId: '', quantity: 1, notes: '' }]);
  const removeOrderItemRow = (idx: number) => setOrderItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const handleCreateOrder = async () => {
    if (!orderRoomId || !selectedPropertyId) {
      toast({ title: 'Validation', description: 'Room is required', variant: 'destructive' });
      return;
    }
    const validItems = orderItems.filter(oi => oi.itemId);
    if (validItems.length === 0) {
      toast({ title: 'Validation', description: 'At least one item is required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      // Find active booking for room
      const bookingRes = await fetch(`/api/bookings?propertyId=${selectedPropertyId}&status=checked_in&limit=50`);
      const bookingResult = await bookingRes.json();
      const activeBooking = bookingResult.data?.find(
        (b: { roomId?: string; room?: { id: string } }) => (b.roomId === orderRoomId || b.room?.id === orderRoomId)
      );

      const res = await fetch('/api/laundry/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          bookingId: activeBooking?.id || undefined,
          guestId: activeBooking?.primaryGuest?.id || undefined,
          roomId: orderRoomId,
          orderType: 'guest',
          paymentMethod: orderPaymentMethod,
          specialInstructions: orderSpecialInstructions || undefined,
          items: validItems.map(oi => {
            const item = laundryItems.find(i => i.id === oi.itemId);
            return { itemId: oi.itemId, itemName: item?.name || '', serviceType: item?.serviceType || 'wash', quantity: oi.quantity, unitPrice: item?.unitPrice || 0, notes: oi.notes || undefined };
          }),
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: `Laundry order #${result.data.id.slice(0, 8)} created` });
        setIsOrderDialogOpen(false);
        resetOrderForm();
        fetchOrders();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to create order', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create order', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Status transitions ---
  const transitionOrder = async (id: string, newStatus: string) => {
    setActionLoading(`trans-${id}`);
    try {
      const res = await fetch(`/api/laundry/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Updated', description: `Order status → ${newStatus.replace('_', ' ')}` });
        fetchOrders();
      } else {
        toast({ title: 'Error', description: result.error || 'Transition failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update order', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const resetItemForm = () => setItemForm({ name: '', category: 'guest', serviceType: 'wash', unitPrice: '', turnaroundHours: '24', isActive: true });
  const resetOrderForm = () => { setOrderRoomId(''); setOrderPaymentMethod('room_charge'); setOrderSpecialInstructions(''); setOrderItems([{ itemId: '', quantity: 1, notes: '' }]); };

  const formatCurrency = (amount: number) => `$${(amount || 0).toFixed(2)}`;

  const OrderStatusBadge = ({ status }: { status: string }) => {
    const cfg = ORDER_STATUSES[status] || ORDER_STATUSES.received;
    const Icon = cfg.icon;
    return <Badge variant="outline" className={cn('border font-medium gap-1', cfg.color)}><Icon className="h-3 w-3" />{cfg.label}</Badge>;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Shirt className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Laundry Management
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage laundry service items, orders, and statistics</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:w-48 h-10"><SelectValue placeholder="Property" /></SelectTrigger>
            <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { fetchItems(); fetchOrders(); }} className="min-w-[44px]"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <Tabs defaultValue="items" className="space-y-4">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          <TabsTrigger value="items" className="gap-1.5"><Shirt className="h-4 w-4" />Service Items</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5"><ShoppingCart className="h-4 w-4" />Orders</TabsTrigger>
          <TabsTrigger value="statistics" className="gap-1.5"><TrendingUp className="h-4 w-4" />Statistics</TabsTrigger>
        </TabsList>

        {/* ========== SERVICE ITEMS TAB ========== */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetItemForm(); setIsItemDialogOpen(true); }} className="bg-gradient-to-r from-teal-600 to-teal-500 hover:shadow-lg hover:shadow-teal-500/20 transition-all">
              <Plus className="h-4 w-4 mr-1.5" />Add Item
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {isLoadingItems ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : laundryItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Shirt className="h-12 w-12 mb-3 opacity-30" /><p className="font-medium">No service items</p>
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
                            <TableHead>Service</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Turnaround</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {laundryItems.map(item => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium text-sm">{item.name}</TableCell>
                              <TableCell><Badge variant="outline">{CATEGORIES.find(c => c.value === item.category)?.label || item.category}</Badge></TableCell>
                              <TableCell className="text-sm">{SERVICE_TYPES.find(s => s.value === item.serviceType)?.label || item.serviceType}</TableCell>
                              <TableCell className="text-right font-medium text-sm">{formatCurrency(item.unitPrice)}</TableCell>
                              <TableCell className="text-right text-sm">{item.turnaroundHours}h</TableCell>
                              <TableCell>
                                <Badge variant={item.isActive ? 'default' : 'secondary'} className={cn(item.isActive && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300')}>
                                  {item.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => handleDeleteItem(item.id)} className="text-red-600 dark:text-red-400"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem></DropdownMenuContent>
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
                    {laundryItems.map(item => (
                      <div key={item.id} className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{SERVICE_TYPES.find(s => s.value === item.serviceType)?.label} • {item.turnaroundHours}h</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">{formatCurrency(item.unitPrice)}</p>
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

        {/* ========== ORDERS TAB ========== */}
        <TabsContent value="orders" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2 flex-1">
              <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                <SelectTrigger className="w-full sm:w-40 h-10"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {Object.entries(ORDER_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-10 sm:w-40" />
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-10 sm:w-40" />
            </div>
            <Button onClick={() => { resetOrderForm(); setIsOrderDialogOpen(true); }} className="bg-gradient-to-r from-teal-600 to-teal-500 hover:shadow-lg transition-all">
              <Plus className="h-4 w-4 mr-1.5" />New Order
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingOrders ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mb-3 opacity-30" /><p className="font-medium">No orders found</p>
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <ScrollArea className="max-h-[500px]">
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order #</TableHead>
                            <TableHead>Guest</TableHead>
                            <TableHead>Room</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Items</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Received</TableHead>
                            <TableHead>Delivered</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orders.map(order => {
                            const guestName = order.booking?.primaryGuest
                              ? `${order.booking.primaryGuest.firstName} ${order.booking.primaryGuest.lastName}`
                              : order.guest ? `${order.guest.firstName} ${order.guest.lastName}` : '—';

                            return (
                              <TableRow key={order.id}>
                                <TableCell className="font-mono font-medium text-sm">#{order.id.slice(0, 8)}</TableCell>
                                <TableCell className="text-sm">{guestName}</TableCell>
                                <TableCell className="text-sm">Room {order.room?.roomNumber || order.room?.name || order.roomId.slice(0, 8)}</TableCell>
                                <TableCell className="text-sm capitalize">{order.orderType}</TableCell>
                                <TableCell className="text-right text-sm">{order.totalItems}</TableCell>
                                <TableCell className="text-right font-medium text-sm">{formatCurrency(order.totalPrice)}</TableCell>
                                <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                                <TableCell className="text-xs text-muted-foreground">{new Date(order.receivedAt).toLocaleString()}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : '—'}</TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!!actionLoading?.startsWith('trans-')}>
                                        {actionLoading === `trans-${order.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                      {order.status === 'received' && (
                                        <DropdownMenuItem onClick={() => transitionOrder(order.id, 'in_progress')}>
                                          <PlayCircle className="h-4 w-4 mr-2" />Mark In Progress
                                        </DropdownMenuItem>
                                      )}
                                      {order.status === 'in_progress' && (
                                        <DropdownMenuItem onClick={() => transitionOrder(order.id, 'ready')}>
                                          <Package className="h-4 w-4 mr-2" />Mark Ready
                                        </DropdownMenuItem>
                                      )}
                                      {order.status === 'ready' && (
                                        <DropdownMenuItem onClick={() => transitionOrder(order.id, 'delivered')}>
                                          <CheckCircle2 className="h-4 w-4 mr-2" />Mark Delivered
                                        </DropdownMenuItem>
                                      )}
                                      {['received', 'in_progress'].includes(order.status) && (
                                        <DropdownMenuItem onClick={() => transitionOrder(order.id, 'cancelled')} className="text-red-600 dark:text-red-400">
                                          <X className="h-4 w-4 mr-2" />Cancel
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      </div>
                    </ScrollArea>
                  </div>
                  {/* Mobile */}
                  <div className="md:hidden divide-y divide-border">
                    {orders.map(order => {
                      const guestName = order.booking?.primaryGuest
                        ? `${order.booking.primaryGuest.firstName} ${order.booking.primaryGuest.lastName}`
                        : order.guest ? `${order.guest.firstName} ${order.guest.lastName}` : '—';

                      return (
                        <div key={order.id} className="p-4 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-sm">#{order.id.slice(0, 8)}</span>
                                <OrderStatusBadge status={order.status} />
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">{guestName} • Room {order.room?.roomNumber || '—'}</p>
                            </div>
                            <p className="font-bold text-sm">{formatCurrency(order.totalPrice)}</p>
                          </div>
                          <div className="flex gap-2">
                            {order.status === 'received' && (
                              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => transitionOrder(order.id, 'in_progress')} disabled={!!actionLoading?.startsWith('trans-')}>
                                {actionLoading === `trans-${order.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <PlayCircle className="h-3 w-3 mr-1" />}In Progress
                              </Button>
                            )}
                            {order.status === 'in_progress' && (
                              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => transitionOrder(order.id, 'ready')} disabled={!!actionLoading?.startsWith('trans-')}>
                                {actionLoading === `trans-${order.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Package className="h-3 w-3 mr-1" />}Ready
                              </Button>
                            )}
                            {order.status === 'ready' && (
                              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => transitionOrder(order.id, 'delivered')} disabled={!!actionLoading?.startsWith('trans-')}>
                                {actionLoading === `trans-${order.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}Delivered
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== STATISTICS TAB ========== */}
        <TabsContent value="statistics" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-500/10 shrink-0"><ShoppingCart className="h-5 w-5 text-teal-600 dark:text-teal-400" /></div>
                <div><div className="text-2xl font-bold">{orderStats.total}</div><div className="text-xs text-muted-foreground">Total Orders</div></div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 shrink-0"><PlayCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
                <div><div className="text-2xl font-bold">{orderStats.inProgress}</div><div className="text-xs text-muted-foreground">In Progress</div></div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0"><DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></div>
                <div><div className="text-2xl font-bold">{formatCurrency(orderStats.revenueToday)}</div><div className="text-xs text-muted-foreground">Revenue Today</div></div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 shrink-0"><Timer className="h-5 w-5 text-purple-600 dark:text-purple-400" /></div>
                <div><div className="text-2xl font-bold">{orderStats.avgTurnaround.toFixed(1)}h</div><div className="text-xs text-muted-foreground">Avg Turnaround</div></div>
              </div>
            </Card>
          </div>

          {/* Order breakdown */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Order Status Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(ORDER_STATUSES).filter(([k]) => k !== 'cancelled').map(([key, cfg]) => {
                  const count = orders.filter(o => o.status === key).length;
                  const Icon = cfg.icon;
                  return (
                    <div key={key} className="flex items-center gap-2 p-3 rounded-lg border">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-lg font-bold">{count}</div>
                        <div className="text-xs text-muted-foreground">{cfg.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========== ADD ITEM DIALOG ========== */}
      <Dialog open={isItemDialogOpen} onOpenChange={open => { if (!open) resetItemForm(); setIsItemDialogOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle>Add Laundry Service Item</DialogTitle><DialogDescription>Create a new laundry service item</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))} placeholder="Shirt - Wash" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={itemForm.category} onValueChange={v => setItemForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Service Type</Label>
                <Select value={itemForm.serviceType} onValueChange={v => setItemForm(p => ({ ...p, serviceType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SERVICE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Unit Price</Label><Input type="number" step="0.01" value={itemForm.unitPrice} onChange={e => setItemForm(p => ({ ...p, unitPrice: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Turnaround (hrs)</Label><Input type="number" value={itemForm.turnaroundHours} onChange={e => setItemForm(p => ({ ...p, turnaroundHours: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsItemDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateItem} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== NEW ORDER DIALOG ========== */}
      <Dialog open={isOrderDialogOpen} onOpenChange={open => { if (!open) resetOrderForm(); setIsOrderDialogOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Laundry Order</DialogTitle><DialogDescription>Create a laundry order for a guest room</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Room *</Label>
              <Select value={orderRoomId} onValueChange={setOrderRoomId}>
                <SelectTrigger><SelectValue placeholder="Select room..." /></SelectTrigger>
                <SelectContent>{rooms.map(r => <SelectItem key={r.id} value={r.id}>Room {r.roomNumber || r.name || r.id.slice(0, 8)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={orderPaymentMethod} onValueChange={setOrderPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="room_charge">Room Charge</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Items</Label>
                <Button variant="ghost" size="sm" onClick={addOrderItemRow} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />Add Item</Button>
              </div>
              <div className="space-y-2">
                {orderItems.map((oi, idx) => {
                  const selItem = laundryItems.find(i => i.id === oi.itemId);
                  return (
                    <Card key={idx} className="p-3">
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-12 sm:col-span-5 space-y-1">
                          <Label className="text-xs text-muted-foreground">Item</Label>
                          <Select value={oi.itemId} onValueChange={v => { const ni = [...orderItems]; ni[idx] = { ...ni[idx], itemId: v }; setOrderItems(ni); }}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>{laundryItems.filter(i => i.isActive).map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({formatCurrency(i.unitPrice)})</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-4 sm:col-span-2 space-y-1">
                          <Label className="text-xs text-muted-foreground">Qty</Label>
                          <Input type="number" min="1" value={oi.quantity} onChange={e => { const ni = [...orderItems]; ni[idx] = { ...ni[idx], quantity: parseInt(e.target.value) || 1 }; setOrderItems(ni); }} className="h-9 text-sm" />
                        </div>
                        <div className="col-span-5 sm:col-span-3 space-y-1">
                          <Label className="text-xs text-muted-foreground">Notes</Label>
                          <Input value={oi.notes} onChange={e => { const ni = [...orderItems]; ni[idx] = { ...ni[idx], notes: e.target.value }; setOrderItems(ni); }} className="h-9 text-sm" placeholder="Optional" />
                        </div>
                        <div className="col-span-3 sm:col-span-2 flex items-end justify-center">
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-red-500" onClick={() => removeOrderItemRow(idx)} disabled={orderItems.length === 1}><X className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      {selItem && (
                        <div className="flex justify-end mt-1">
                          <span className="text-xs text-muted-foreground">Line: {formatCurrency(selItem.unitPrice * oi.quantity)}</span>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5"><Label>Special Instructions</Label><Textarea value={orderSpecialInstructions} onChange={e => setOrderSpecialInstructions(e.target.value)} rows={2} placeholder="e.g. Stain removal, delicate handling..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOrderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateOrder} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-1.5" />}Create Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
