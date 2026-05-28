'use client';

import { useTranslations } from 'next-intl';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { usePropertyId } from '@/hooks/use-property';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import { cn } from '@/lib/utils';
import {
  Loader2,
  ChefHat,
  Clock,
  CheckCircle,
  AlertTriangle,
  Timer,
  RefreshCw,
  X,
  Flame,
  Wifi,
  WifiOff,
  UtensilsCrossed,
} from 'lucide-react';

interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  notes?: string;
  status: string;
  menuItem: {
    id: string;
    name: string;
    price: number;
    preparationTime?: number;
    kitchenStation?: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  kitchenStatus: string;
  totalAmount: number;
  guestName?: string;
  notes?: string;
  createdAt: string;
  kitchenStartedAt?: string;
  kitchenCompletedAt?: string;
  table?: {
    id: string;
    number: string;
    name?: string;
    area?: string;
  };
  items: OrderItem[];
}

const orderTypeLabels: Record<string, string> = {
  dine_in: 'Dine In',
  takeout: 'Takeout',
  delivery: 'Delivery',
  room_service: 'Room Service',
};

const kitchenStatusConfig: Record<string, { color: string; bgColor: string; borderColor: string }> = {
  pending: {
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
  },
  cooking: {
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
  },
  ready: {
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
  },
  completed: {
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-300',
  },
};

// Item-level status configuration
const itemStatusConfig: Record<string, { label: string; bgClass: string; textClass: string; dotClass: string }> = {
  pending: {
    label: 'Pending',
    bgClass: 'bg-amber-50 border-amber-200',
    textClass: 'text-amber-700 dark:text-amber-300',
    dotClass: 'bg-amber-400',
  },
  preparing: {
    label: 'Preparing',
    bgClass: 'bg-amber-50 border-amber-200',
    textClass: 'text-amber-700 dark:text-amber-300',
    dotClass: 'bg-amber-500',
  },
  ready: {
    label: 'Ready',
    bgClass: 'bg-emerald-50 border-emerald-200',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    dotClass: 'bg-emerald-500',
  },
  served: {
    label: 'Served',
    bgClass: 'bg-gray-50 border-gray-200',
    textClass: 'text-gray-500 dark:text-gray-400',
    dotClass: 'bg-gray-400',
  },
  cancelled: {
    label: 'Cancelled',
    bgClass: 'bg-red-50 border-red-200',
    textClass: 'text-red-500 dark:text-red-400',
    dotClass: 'bg-red-500',
  },
};

export default function KitchenDisplay() {
const t = useTranslations('pos');
  const { formatCurrency } = useCurrency();
  const { propertyId } = usePropertyId();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [stats, setStats] = useState({
    pending: 0,
    cooking: 0,
    ready: 0,
    completed: 0,
    avgWaitTime: 0,
  });

  const [stationFilter, setStationFilter] = useState<string>('all');
  const kitchenStations = ['all', 'Grill', 'Sauté', 'Fryer', 'Salad', 'Dessert', 'Bar', 'Unassigned'];

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (propertyId) params.append('propertyId', propertyId);
      params.append('status', 'pending,confirmed,preparing,ready,served');
      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        const allOrders: Order[] = data.data;
        setOrders(allOrders);

        const activeOrders = allOrders.filter((o: Order) =>
          ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)
        );

        const pending = activeOrders.filter((o: Order) => o.kitchenStatus === 'pending').length;
        const cooking = activeOrders.filter((o: Order) => o.kitchenStatus === 'cooking').length;
        const ready = activeOrders.filter((o: Order) => o.kitchenStatus === 'ready').length;
        const completed = allOrders.filter((o: Order) => o.status === 'served').length;

        const pendingOrders = activeOrders.filter((o: Order) => o.kitchenStatus === 'pending');
        let totalWait = 0;
        pendingOrders.forEach((o: Order) => {
          const wait = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
          totalWait += wait;
        });
        const avgWaitTime = pendingOrders.length > 0 ? totalWait / pendingOrders.length : 0;

        setStats({ pending, cooking, ready, completed, avgWaitTime });
      }
    } catch (error) {
      toast.error('Failed to load kitchen orders');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  // M-57: WebSocket connection for real-time updates
  // NOTE: fetchOrders is intentionally NOT in the dependency array here.
  // The fetchOrders callback only depends on `propertyId` (see useCallback below),
  // and propertyId IS in the dep array. Adding fetchOrders would cause the socket
  // to disconnect and reconnect on every re-render that creates a new fetchOrders
  // closure, which is undesirable for maintaining a persistent socket connection.
  // The stale closure concern is mitigated because fetchOrders is stable as long
  // as propertyId doesn't change.
  useEffect(() => {
    if (!propertyId) return;

    const socket = io('/?XTransformPort=3003', {
      path: '/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('kitchen:subscribe', { propertyId });
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('connect_error', () => {
      setSocketConnected(false);
    });

    socket.on('kitchen:order', () => {
      fetchOrders();
    });

    socket.on('kitchen:item-status', () => {
      fetchOrders();
    });

    socket.on('order:created', () => {
      fetchOrders();
    });

    socket.on('order:updated', () => {
      fetchOrders();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [propertyId]);

  useEffect(() => {
    fetchOrders();
    pollingRef.current = setInterval(fetchOrders, 30000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchOrders]);

  const updateKitchenStatus = async (orderId: string, kitchenStatus: string) => {
    try {
      let newStatus = '';
      if (kitchenStatus === 'cooking') newStatus = 'preparing';
      else if (kitchenStatus === 'ready') newStatus = 'ready';
      else if (kitchenStatus === 'completed') newStatus = 'served';

      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: orderId,
          kitchenStatus,
          status: newStatus || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Order ${kitchenStatus === 'completed' ? 'marked as served' : kitchenStatus === 'ready' ? 'ready for pickup' : 'updated'}`);
        fetchOrders();
      } else {
        toast.error(data.error?.message || 'Failed to update order');
      }
    } catch (error) {
      toast.error('Failed to update order');
    }
  };

  // Update individual item status
  const updateItemStatus = async (orderId: string, itemId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/item-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        // Optimistically update the local state
        setOrders(prev => prev.map(order => {
          if (order.id !== orderId) return order;
          return {
            ...order,
            items: order.items.map(item => {
              if (item.id !== itemId) return item;
              return { ...item, status: newStatus };
            }),
          };
        }));
      } else {
        toast.error(data.error?.message || 'Failed to update item status');
      }
    } catch (error) {
      toast.error('Failed to update item status');
    }
  };

  const getWaitTime = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    return Math.floor(diff / 60000);
  };

  const getWaitTimeColor = (minutes: number) => {
    if (minutes < 10) return 'text-emerald-600 dark:text-emerald-400';
    if (minutes < 20) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getItemPrepTime = (item: OrderItem) => {
    // Show preparation time if the item is being prepared or ready
    const prepMinutes = item.menuItem.preparationTime;
    if (!prepMinutes) return null;
    return prepMinutes;
  };

  // Get the next valid status transitions for an item
  const getNextItemStatuses = (currentStatus: string): string[] => {
    switch (currentStatus) {
      case 'pending':
        return ['preparing', 'cancelled'];
      case 'preparing':
        return ['ready', 'cancelled'];
      case 'ready':
        return ['served'];
      case 'served':
        return [];
      case 'cancelled':
        return [];
      default:
        return [];
    }
  };

  const filterOrdersByStation = (orderList: Order[]) => {
    if (stationFilter === 'all' || stationFilter === 'Unassigned') return orderList;
    return orderList.filter(order =>
      order.items.some(item =>
        item.menuItem.kitchenStation?.toLowerCase() === stationFilter.toLowerCase()
      )
    );
  };

  // Helper to render an order card with item-level statuses
  const renderOrderItems = (order: Order) => (
    <div className="space-y-2">
      {order.items.map((item) => {
        const statusConf = itemStatusConfig[item.status] || itemStatusConfig.pending;
        const nextStatuses = getNextItemStatuses(item.status);
        const prepTime = getItemPrepTime(item);

        return (
          <div
            key={item.id}
            className={cn(
              'rounded-lg border p-2.5 transition-all',
              statusConf.bgClass,
              item.status === 'served' && 'opacity-60',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                  <span className="font-bold text-base">{item.quantity}x</span>
                  <div className={cn('w-2 h-2 rounded-full', statusConf.dotClass)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{item.menuItem.name}</p>
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4 flex-shrink-0', statusConf.textClass, statusConf.bgClass, 'border-current/20')}>
                      {statusConf.label}
                    </Badge>
                  </div>
                  {item.notes && (
                    <p className="text-xs text-muted-foreground italic mt-0.5 truncate">{item.notes}</p>
                  )}
                  {prepTime && (item.status === 'preparing') && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Timer className="h-2.5 w-2.5" />
                      Est. {prepTime} min
                    </p>
                  )}
                  {item.menuItem.kitchenStation && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {item.menuItem.kitchenStation}
                    </p>
                  )}
                </div>
              </div>
              {/* Item status action buttons */}
              {nextStatuses.length > 0 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {nextStatuses.map((ns) => (
                    <Button
                      key={ns}
                      size="sm"
                      variant="outline"
                      className={cn(
                        'h-6 px-1.5 text-[10px] font-medium',
                        ns === 'preparing' && 'border-amber-300 text-amber-700 hover:bg-amber-100',
                        ns === 'ready' && 'border-emerald-300 text-emerald-700 hover:bg-emerald-100',
                        ns === 'served' && 'border-gray-300 text-gray-600 hover:bg-gray-100',
                        ns === 'cancelled' && 'border-red-300 text-red-600 hover:bg-red-50',
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateItemStatus(order.id, item.id, ns);
                      }}
                    >
                      {ns === 'preparing' && <ChefHat className="h-3 w-3 mr-0.5" />}
                      {ns === 'ready' && <CheckCircle className="h-3 w-3 mr-0.5" />}
                      {ns === 'served' && <UtensilsCrossed className="h-3 w-3 mr-0.5" />}
                      <span className="capitalize hidden sm:inline">{ns}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const pendingOrders = filterOrdersByStation(orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status) && o.kitchenStatus === 'pending'));
  const cookingOrders = filterOrdersByStation(orders.filter(o => o.kitchenStatus === 'cooking'));
  const readyOrders = filterOrdersByStation(orders.filter(o => o.kitchenStatus === 'ready'));
  const completedOrders = filterOrdersByStation(orders.filter(o => o.status === 'served').slice(-10));

  const clearCompleted = () => {
    setOrders(prev => prev.filter(o => o.status !== 'served'));
  };

  // Calculate per-order item status summary
  const getOrderItemSummary = (order: Order) => {
    const counts = { pending: 0, preparing: 0, ready: 0, served: 0, cancelled: 0 };
    order.items.forEach(item => {
      if (counts[item.status as keyof typeof counts] !== undefined) {
        counts[item.status as keyof typeof counts]++;
      }
    });
    return counts;
  };

  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <ChefHat className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No Property Selected</p>
        <p className="text-sm">Please select a property to view kitchen orders</p>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Kitchen Display System</h1>
          <p className="text-muted-foreground">Real-time kitchen order management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4 mr-2" />Refresh
          </Button>
          <div className="flex items-center gap-2">
            <div className={cn('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full', socketConnected ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400')}>
              {socketConnected ? <><Wifi className="h-3 w-3" /><span>Live</span></> : <><WifiOff className="h-3 w-3" /><span>Reconnecting</span></>}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Timer className="h-4 w-4" />Auto-refresh: 30s
            </div>
          </div>
        </div>
      </div>

      {/* Station Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Flame className="h-4 w-4 text-orange-500 flex-shrink-0" />
        {kitchenStations.map(station => (
          <Button key={station} size="sm" variant={stationFilter === station ? 'default' : 'outline'} className={cn(stationFilter === station ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 flex-shrink-0' : 'flex-shrink-0')} onClick={() => setStationFilter(station)}>
            {station === 'all' ? 'All Stations' : station}
          </Button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />Pending</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-amber-700 dark:text-amber-300">{stats.pending}</div>{stats.avgWaitTime > 0 && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Avg wait: {stats.avgWaitTime.toFixed(0)} min</p>}</CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><ChefHat className="h-4 w-4 text-orange-600 dark:text-orange-400" />Cooking</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-orange-700 dark:text-orange-300">{stats.cooking}</div></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />Ready</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{stats.ready}</div></CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><CheckCircle className="h-4 w-4 text-slate-600" />Served</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-slate-700">{stats.completed}</div></CardContent>
        </Card>
      </div>

      {/* Orders Columns */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-4">
        {/* Pending Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <h2 className="text-lg font-semibold">Pending ({pendingOrders.length})</h2>
          </div>
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-4 pr-4">
              {pendingOrders.length === 0 ? (
                <Card className="border-dashed"><CardContent className="flex items-center justify-center py-8 text-muted-foreground">No pending orders</CardContent></Card>
              ) : (
                pendingOrders.map((order) => {
                  const waitTime = getWaitTime(order.createdAt);
                  const itemSummary = getOrderItemSummary(order);
                  return (
                    <Card key={order.id} className={cn(kitchenStatusConfig.pending.bgColor, kitchenStatusConfig.pending.borderColor, 'border-2')}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                          <Badge className={cn(kitchenStatusConfig.pending.bgColor, kitchenStatusConfig.pending.color)}>{orderTypeLabels[order.orderType]}</Badge>
                        </div>
                        <CardDescription className="flex items-center justify-between">
                          <span>{order.table ? `Table ${order.table.number}` : order.guestName || 'No guest'}</span>
                          <span className={cn('flex items-center gap-1', getWaitTimeColor(waitTime))}><Clock className="h-3 w-3" />{waitTime}m</span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Item-level status summary */}
                        {order.items.length > 1 && (
                          <div className="flex items-center gap-1.5 text-[10px]">
                            {itemSummary.preparing > 0 && <Badge variant="outline" className="h-4 px-1 text-[10px] border-amber-300 text-amber-700">{itemSummary.preparing} prep</Badge>}
                            {itemSummary.ready > 0 && <Badge variant="outline" className="h-4 px-1 text-[10px] border-emerald-300 text-emerald-700">{itemSummary.ready} done</Badge>}
                            {itemSummary.served > 0 && <Badge variant="outline" className="h-4 px-1 text-[10px] border-gray-300 text-gray-500">{itemSummary.served} served</Badge>}
                          </div>
                        )}
                        {renderOrderItems(order)}
                        {order.notes && (
                          <div className="pt-2 border-t border-amber-200">
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3 w-3 inline mr-1" />{order.notes}</p>
                          </div>
                        )}
                        <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => updateKitchenStatus(order.id, 'cooking')}>
                          <ChefHat className="h-4 w-4 mr-2" />Start Cooking
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Cooking Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            <h2 className="text-lg font-semibold">Cooking ({cookingOrders.length})</h2>
          </div>
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-4 pr-4">
              {cookingOrders.length === 0 ? (
                <Card className="border-dashed"><CardContent className="flex items-center justify-center py-8 text-muted-foreground">No orders cooking</CardContent></Card>
              ) : (
                cookingOrders.map((order) => {
                  const waitTime = getWaitTime(order.createdAt);
                  const cookingTime = order.kitchenStartedAt ? getWaitTime(order.kitchenStartedAt) : 0;
                  const itemSummary = getOrderItemSummary(order);
                  return (
                    <Card key={order.id} className={cn(kitchenStatusConfig.cooking.bgColor, kitchenStatusConfig.cooking.borderColor, 'border-2')}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                          <Badge className={cn(kitchenStatusConfig.cooking.bgColor, kitchenStatusConfig.cooking.color)}>{orderTypeLabels[order.orderType]}</Badge>
                        </div>
                        <CardDescription className="flex items-center justify-between">
                          <span>{order.table ? `Table ${order.table.number}` : order.guestName || 'No guest'}</span>
                          <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1"><ChefHat className="h-3 w-3" />{cookingTime}m cooking</span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {order.items.length > 1 && (
                          <div className="flex items-center gap-1.5 text-[10px]">
                            {itemSummary.pending > 0 && <Badge variant="outline" className="h-4 px-1 text-[10px] border-amber-300 text-amber-700">{itemSummary.pending} pending</Badge>}
                            {itemSummary.preparing > 0 && <Badge variant="outline" className="h-4 px-1 text-[10px] border-amber-300 text-amber-700">{itemSummary.preparing} prep</Badge>}
                            {itemSummary.ready > 0 && <Badge variant="outline" className="h-4 px-1 text-[10px] border-emerald-300 text-emerald-700">{itemSummary.ready} done</Badge>}
                            {itemSummary.served > 0 && <Badge variant="outline" className="h-4 px-1 text-[10px] border-gray-300 text-gray-500">{itemSummary.served} served</Badge>}
                          </div>
                        )}
                        {renderOrderItems(order)}
                        {order.notes && (
                          <div className="pt-2 border-t border-orange-200">
                            <p className="text-xs font-medium text-orange-700 dark:text-orange-300"><AlertTriangle className="h-3 w-3 inline mr-1" />{order.notes}</p>
                          </div>
                        )}
                        <Button className="w-full bg-emerald-500 hover:bg-emerald-600" onClick={() => updateKitchenStatus(order.id, 'ready')}>
                          <CheckCircle className="h-4 w-4 mr-2" />Mark Ready
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Ready Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <h2 className="text-lg font-semibold">Ready ({readyOrders.length})</h2>
          </div>
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-4 pr-4">
              {readyOrders.length === 0 ? (
                <Card className="border-dashed"><CardContent className="flex items-center justify-center py-8 text-muted-foreground">No orders ready</CardContent></Card>
              ) : (
                readyOrders.map((order) => {
                  const readyTime = order.kitchenCompletedAt ? getWaitTime(order.kitchenCompletedAt) : 0;
                  const itemSummary = getOrderItemSummary(order);
                  return (
                    <Card key={order.id} className={cn(kitchenStatusConfig.ready.bgColor, kitchenStatusConfig.ready.borderColor, 'border-2')}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                          <Badge className={cn(kitchenStatusConfig.ready.bgColor, kitchenStatusConfig.ready.color)}>{orderTypeLabels[order.orderType]}</Badge>
                        </div>
                        <CardDescription className="flex items-center justify-between">
                          <span>{order.table ? `Table ${order.table.number}` : order.guestName || 'No guest'}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Ready {readyTime}m</span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {order.items.length > 1 && (
                          <div className="flex items-center gap-1.5 text-[10px]">
                            {itemSummary.preparing > 0 && <Badge variant="outline" className="h-4 px-1 text-[10px] border-amber-300 text-amber-700">{itemSummary.preparing} still cooking</Badge>}
                            {itemSummary.ready > 0 && <Badge variant="outline" className="h-4 px-1 text-[10px] border-emerald-300 text-emerald-700">{itemSummary.ready} ready</Badge>}
                            {itemSummary.served > 0 && <Badge variant="outline" className="h-4 px-1 text-[10px] border-gray-300 text-gray-500">{itemSummary.served} served</Badge>}
                          </div>
                        )}
                        {renderOrderItems(order)}
                        <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
                          <span className="text-sm font-medium">Total: {formatCurrency(order.totalAmount)}</span>
                          <Badge className="bg-emerald-500 text-white">READY TO SERVE</Badge>
                        </div>
                        <Button className="w-full bg-slate-600 hover:bg-slate-700" onClick={() => updateKitchenStatus(order.id, 'completed')}>
                          <CheckCircle className="h-4 w-4 mr-2" />Mark Served
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Completed/Served Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-slate-400" />
              <h2 className="text-lg font-semibold">Served ({completedOrders.length})</h2>
            </div>
            {completedOrders.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCompleted} className="text-muted-foreground hover:text-red-500"><X className="h-3 w-3 mr-1" />Clear</Button>
            )}
          </div>
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-4 pr-4">
              {completedOrders.length === 0 ? (
                <Card className="border-dashed"><CardContent className="flex items-center justify-center py-8 text-muted-foreground">No orders served</CardContent></Card>
              ) : (
                completedOrders.map((order) => (
                  <Card key={order.id} className={cn(kitchenStatusConfig.completed.bgColor, kitchenStatusConfig.completed.borderColor, 'border-2 opacity-75')}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                        <Badge className={cn(kitchenStatusConfig.completed.bgColor, kitchenStatusConfig.completed.color)}>{orderTypeLabels[order.orderType]}</Badge>
                      </div>
                      <CardDescription className="flex items-center justify-between">
                        <span>{order.table ? `Table ${order.table.number}` : order.guestName || 'No guest'}</span>
                        <span className="text-slate-500 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Served</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {renderOrderItems(order)}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <span className="text-sm font-medium">Total: {formatCurrency(order.totalAmount)}</span>
                        <Badge className="bg-slate-500 text-white">SERVED</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
