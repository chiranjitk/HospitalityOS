'use client';

import { useTranslations } from 'next-intl';

import { useState, useEffect, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { usePropertyId } from '@/hooks/use-property';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Search, Plus, Loader2, ConciergeBell, Clock, BedDouble, User,
  ChevronRight, Minus, Send, AlertCircle, CheckCircle, UtensilsCrossed,
  Coffee, Sun, Moon, Star, Package, Truck, MapPin,
} from 'lucide-react';

interface RoomWithGuest {
  id: string;
  number: string;
  floor?: number;
  guestName: string;
  bookingId: string;
  bookingStatus: string;
  activeOrders: number;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
  category?: { id: string; name: string };
}

interface RoomServiceOrder {
  id: string;
  orderNumber: string;
  roomNumber: string;
  guestName: string;
  status: string;
  priority: string;
  orderCategory: string;
  totalAmount: number;
  estimatedDelivery: number;
  createdAt: string;
}

const orderCategoryIcons: Record<string, React.ReactNode> = {
  breakfast: <Coffee className="h-4 w-4" />,
  lunch: <Sun className="h-4 w-4" />,
  dinner: <Moon className="h-4 w-4" />,
  snacks: <Package className="h-4 w-4" />,
  beverages: <UtensilsCrossed className="h-4 w-4" />,
  amenities: <Star className="h-4 w-4" />,
};

const priorityColors: Record<string, string> = {
  normal: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200',
  rush: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200',
  vip: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200',
};

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200',
  confirmed: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200',
  preparing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200',
  in_transit: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200',
  delivered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200',
};

const availableDrivers = [
  { id: '1', name: 'Raj K.', role: 'Driver' },
  { id: '2', name: 'Priya S.', role: 'Driver' },
  { id: '3', name: 'Amit M.', role: 'Bellboy' },
  { id: '4', name: 'Sunita R.', role: 'Driver' },
];

type OrderType = RoomServiceOrder;

export default function RoomService() {
const t = useTranslations('pos');
  const { propertyId } = usePropertyId();
  const { formatCurrency } = useCurrency();
  const [rooms, setRooms] = useState<RoomWithGuest[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeOrders, setActiveOrders] = useState<RoomServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Driver assignment state
  const [driverAssignments, setDriverAssignments] = useState<Record<string, { driverName: string; driverId: string; assignedAt: string; estimatedMinutes: number }>>({});
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [dispatchingOrder, setDispatchingOrder] = useState<OrderType | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('25');
  const [assigningDriver, setAssigningDriver] = useState(false);

  // Selected room for ordering
  const [selectedRoom, setSelectedRoom] = useState<RoomWithGuest | null>(null);
  const [selectedItems, setSelectedItems] = useState<{ menuItemId: string; quantity: number; notes: string }[]>([]);
  const [orderCategory, setOrderCategory] = useState('breakfast');
  const [priority, setPriority] = useState('normal');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [creating, setCreating] = useState(false);
  const [menuCategoryFilter, setMenuCategoryFilter] = useState('all');

  const fetchRooms = useCallback(async () => {
    if (!propertyId) return;
    try {
      const res = await fetch(`/api/room-service/rooms?propertyId=${propertyId}`);
      const data = await res.json();
      if (data.success) setRooms(data.data);
    } catch {

    }
  }, [propertyId]);

  const fetchMenuItems = useCallback(async () => {
    if (!propertyId) return;
    try {
      const res = await fetch(`/api/menu-items?propertyId=${propertyId}`);
      const data = await res.json();
      if (data.success) setMenuItems(data.data);
    } catch {

    }
  }, [propertyId]);

  const fetchActiveOrders = useCallback(async () => {
    if (!propertyId) return;
    try {
      const res = await fetch(`/api/room-service?propertyId=${propertyId}&status=pending,confirmed,preparing,in_transit`);
      const data = await res.json();
      if (data.success) setActiveOrders(data.data);
    } catch {

    }
  }, [propertyId]);

  useEffect(() => {
    if (propertyId) {
      Promise.all([fetchRooms(), fetchMenuItems(), fetchActiveOrders()]).finally(() => setLoading(false));
    }
  }, [fetchRooms, fetchMenuItems, fetchActiveOrders, propertyId]);

  // Auto-refresh active orders
  useEffect(() => {
    const interval = setInterval(fetchActiveOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchActiveOrders]);

  const toggleItem = (menuItemId: string) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.menuItemId === menuItemId);
      if (existing) {
        if (existing.quantity > 1) return prev.map(i => i.menuItemId === menuItemId ? { ...i, quantity: i.quantity - 1 } : i);
        return prev.filter(i => i.menuItemId !== menuItemId);
      }
      return [...prev, { menuItemId, quantity: 1, notes: '' }];
    });
  };

  const increaseItem = (menuItemId: string) => {
    setSelectedItems(prev => prev.map(i => i.menuItemId === menuItemId ? { ...i, quantity: i.quantity + 1 } : i));
  };

  const updateItemNotes = (menuItemId: string, notes: string) => {
    setSelectedItems(prev => prev.map(i => i.menuItemId === menuItemId ? { ...i, notes } : i));
  };

  const calculateTotal = () => {
    const subtotal = selectedItems.reduce((sum, item) => {
      const mi = menuItems.find(m => m.id === item.menuItemId);
      return sum + (mi?.price || 0) * item.quantity;
    }, 0);
    const serviceCharge = subtotal * 0.05; // 5% room service charge
    return { subtotal, serviceCharge, total: subtotal + serviceCharge };
  };

  const getEstimatedDelivery = () => {
    const base = 25;
    if (priority === 'rush') return base - 10;
    return base;
  };

  const createOrder = async () => {
    if (!selectedRoom || !propertyId || selectedItems.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch('/api/room-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          roomNumber: selectedRoom.number,
          bookingId: selectedRoom.bookingId,
          guestName: selectedRoom.guestName,
          orderCategory,
          priority,
          specialInstructions: specialInstructions || undefined,
          items: selectedItems,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Room service order created');
        setSelectedRoom(null);
        setSelectedItems([]);
        setSpecialInstructions('');
        fetchActiveOrders();
        fetchRooms();
      } else {
        toast.error(data.error?.message || 'Failed to create order');
      }
    } catch {
      toast.error('Failed to create order');
    } finally {
      setCreating(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch('/api/room-service', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Order status updated');
        fetchActiveOrders();
      } else {
        toast.error(data.error?.message || 'Failed to update order');
      }
    } catch {
      toast.error('Failed to update order');
    }
  };

  const openDispatchDialog = (order: OrderType) => {
    setDispatchingOrder(order);
    setSelectedDriverId('');
    setEstimatedTime('25');
    setDispatchDialogOpen(true);
  };

  const assignAndDispatch = async () => {
    if (!dispatchingOrder || !selectedDriverId) return;
    setAssigningDriver(true);
    try {
      const driver = availableDrivers.find(d => d.id === selectedDriverId);
      if (!driver) return;
      const res = await fetch('/api/room-service/driver-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: dispatchingOrder.id,
          driverId: selectedDriverId,
          estimatedMinutes: parseInt(estimatedTime, 10),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDriverAssignments(prev => ({
          ...prev,
          [dispatchingOrder.id]: {
            driverName: driver.name,
            driverId: driver.id,
            assignedAt: new Date().toISOString(),
            estimatedMinutes: parseInt(estimatedTime, 10),
          },
        }));
        toast.success(`Order dispatched to ${driver.name} (ETA: ${estimatedTime} min)`);
        setDispatchDialogOpen(false);
        setDispatchingOrder(null);
        fetchActiveOrders();
      } else {
        toast.error(data.error?.message || 'Failed to assign driver');
      }
    } catch {
      toast.error('Failed to assign driver');
    } finally {
      setAssigningDriver(false);
    }
  };

  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <ConciergeBell className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No Property Selected</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const { subtotal, serviceCharge, total } = calculateTotal();
  const filteredRooms = rooms.filter(r =>
    !search || r.number.includes(search) || r.guestName.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(menuItems.map(m => m.category?.name).filter(Boolean))];
  const filteredMenuItems = menuItems.filter(m =>
    m.isAvailable && (menuCategoryFilter === 'all' || m.category?.name === menuCategoryFilter)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Room Service</h1>
        <p className="text-muted-foreground">Manage in-room dining orders for hotel guests</p>
      </div>

      {/* Active Room Service Orders */}
      {activeOrders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Active Deliveries ({activeOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-96">
              <div className="space-y-2">
                {activeOrders.map(order => (
                  <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow gap-3">
                    <div className="flex items-center gap-3">
                      <BedDouble className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Room {order.roomNumber}</span>
                          <span className="text-sm text-muted-foreground">{order.guestName}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className={statusColors[order.status]} variant="outline">{order.status}</Badge>
                          <Badge className={priorityColors[order.priority]} variant="outline">{order.priority}</Badge>
                          <span className="text-xs text-muted-foreground">{order.orderNumber}</span>
                        </div>
                        {/* Driver assignment info for in_transit orders */}
                        {order.status === 'in_transit' && driverAssignments[order.id] && (
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              {driverAssignments[order.id].driverName}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              ETA ~{driverAssignments[order.id].estimatedMinutes} min
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:flex-nowrap">
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(order.totalAmount)}</p>
                        <p className="text-xs text-muted-foreground">{order.orderCategory} • ~{order.estimatedDelivery} min</p>
                      </div>
                      {order.status === 'confirmed' && (
                        <Button size="sm" onClick={() => updateOrderStatus(order.id, 'preparing')}>
                          Start Preparing
                        </Button>
                      )}
                      {order.status === 'preparing' && (
                        <Button size="sm" onClick={() => openDispatchDialog(order)}>
                          <Truck className="h-4 w-4 mr-1" />
                          Dispatch
                        </Button>
                      )}
                      {order.status === 'in_transit' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => toast.info('Live tracking not available in demo')}>
                            <MapPin className="h-4 w-4 mr-1" />
                            Track
                          </Button>
                          <Button size="sm" className="bg-emerald-600" onClick={() => updateOrderStatus(order.id, 'delivered')}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Delivered
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Room List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BedDouble className="h-5 w-5" />
              Rooms
            </CardTitle>
            <CardDescription>Occupied rooms with checked-in guests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search room or guest..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredRooms.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BedDouble className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No occupied rooms found</p>
                  </div>
                ) : (
                  filteredRooms.map(room => (
                    <div
                      key={room.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedRoom?.id === room.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                          : 'hover:border-muted-foreground/50 hover:shadow-sm'
                      }`}
                      onClick={() => setSelectedRoom(room)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center font-bold text-sm">
                            {room.number}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Room {room.number}</span>
                              <Badge variant="outline" className="text-xs">{room.bookingStatus}</Badge>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                              <User className="h-3 w-3" />
                              {room.guestName}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {room.activeOrders > 0 && (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200" variant="outline">
                              {room.activeOrders} active
                            </Badge>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Panel - Order Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ConciergeBell className="h-5 w-5" />
              New Order
            </CardTitle>
            <CardDescription>
              {selectedRoom ? `Order for Room ${selectedRoom.number} - ${selectedRoom.guestName}` : 'Select a room to start an order'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedRoom ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <BedDouble className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No Room Selected</p>
                <p className="text-sm">Select a room from the left panel</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Order Category */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {Object.entries(orderCategoryIcons).map(([key, icon]) => (
                    <Button
                      key={key}
                      variant={orderCategory === key ? 'default' : 'outline'}
                      size="sm"
                      className={orderCategory === key ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      onClick={() => setOrderCategory(key)}
                    >
                      <span className="mr-1">{icon}</span>
                      <span className="capitalize text-xs">{key}</span>
                    </Button>
                  ))}
                </div>

                {/* Priority */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Priority:</span>
                  <div className="flex gap-2">
                    {(['normal', 'rush', 'vip'] as const).map(p => (
                      <Button key={p} variant={priority === p ? 'default' : 'outline'} size="sm"
                        className={priority === p ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                        onClick={() => setPriority(p)}>
                        <span className="capitalize">{p}</span>
                      </Button>
                    ))}
                  </div>
                  {priority === 'rush' && (
                    <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200" variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      ~{getEstimatedDelivery()} min
                    </Badge>
                  )}
                </div>

                {/* Menu Category Filter */}
                <Select value={menuCategoryFilter} onValueChange={setMenuCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c} value={c || ''}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Menu Items */}
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {filteredMenuItems.map(item => {
                      const selected = selectedItems.find(s => s.menuItemId === item.id);
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                            selected ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => toggleItem(item.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
                          </div>
                          {selected && (
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={e => { e.stopPropagation(); toggleItem(item.id); }}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-sm font-medium">{selected.quantity}</span>
                              <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={e => { e.stopPropagation(); increaseItem(item.id); }}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                <Separator />

                {/* Order Summary */}
                {selectedItems.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Order Summary</h4>
                    <ScrollArea className="h-32">
                      {selectedItems.map(item => {
                        const mi = menuItems.find(m => m.id === item.menuItemId);
                        if (!mi) return null;
                        return (
                          <div key={item.menuItemId} className="flex justify-between py-1">
                            <span className="text-sm">{mi.name} x{item.quantity}</span>
                            <span className="text-sm">{formatCurrency(mi.price * item.quantity)}</span>
                          </div>
                        );
                      })}
                    </ScrollArea>
                    <Separator />
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                      <div className="flex justify-between text-amber-600 dark:text-amber-400"><span>Room Service (5%)</span><span>{formatCurrency(serviceCharge)}</span></div>
                      <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatCurrency(total)}</span></div>
                    </div>
                  </div>
                )}

                <Input placeholder="Special instructions..." value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} />

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setSelectedRoom(null); setSelectedItems([]); }}>
                    Cancel
                  </Button>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={creating || selectedItems.length === 0} onClick={createOrder}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                    Place Order
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Driver Assignment Dialog */}
      <Dialog open={dispatchDialogOpen} onOpenChange={(open) => { setDispatchDialogOpen(open); if (!open) setDispatchingOrder(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Assign Driver &amp; Dispatch
            </DialogTitle>
            <DialogDescription>
              {dispatchingOrder && (
                <>
                  Order {dispatchingOrder.orderNumber} — Room {dispatchingOrder.roomNumber} ({dispatchingOrder.guestName})
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="driver-select">Select Driver / Courier</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger id="driver-select">
                  <SelectValue placeholder="Choose a driver..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDrivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      <span className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {driver.name}
                        <Badge variant="outline" className="text-xs ml-1">{driver.role}</Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eta-select">Estimated Delivery Time</Label>
              <Select value={estimatedTime} onValueChange={setEstimatedTime}>
                <SelectTrigger id="eta-select">
                  <SelectValue placeholder="Select ETA" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      15 minutes
                    </span>
                  </SelectItem>
                  <SelectItem value="20">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      20 minutes
                    </span>
                  </SelectItem>
                  <SelectItem value="25">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      25 minutes
                    </span>
                  </SelectItem>
                  <SelectItem value="30">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      30 minutes
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedDriverId && (
              <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                <p className="text-muted-foreground">
                  <strong>{availableDrivers.find(d => d.id === selectedDriverId)?.name}</strong> will be assigned to deliver to{' '}
                  <strong>Room {dispatchingOrder?.roomNumber}</strong> with an ETA of <strong>{estimatedTime} min</strong>.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDispatchDialogOpen(false); setDispatchingOrder(null); }}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!selectedDriverId || assigningDriver}
              onClick={assignAndDispatch}
            >
              {assigningDriver ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Truck className="h-4 w-4 mr-1" />}
              Assign &amp; Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
