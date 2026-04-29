'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, UtensilsCrossed, Clock, CheckCircle, ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem { name: string; quantity: number; price: number; status: string; }
interface OrderData { orderNumber: string; items: OrderItem[]; totalAmount: number; status: string; createdAt: string; estimatedWait: number; }

export default function CustomerDisplay() {
  const { formatCurrency } = useCurrency();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [promotionalMessage] = useState('👋 Welcome! Enjoy your meal at StaySuite Restaurant');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tableId = params.get('table');
    if (!tableId) { setLoading(false); return; }

    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/pos/customer-display?tableId=${tableId}`);
        const data = await res.json();
        if (data.success) setOrder(data.data);
      } catch (_err) {
        // Network or parse error fetching order — polling will retry
      }
      setLoading(false);
    };

    fetchOrder();
    const interval = setInterval(fetchOrder, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-500';
      case 'confirmed': case 'preparing': return 'bg-blue-500';
      case 'ready': return 'bg-emerald-500';
      case 'served': return 'bg-teal-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Order Placed';
      case 'confirmed': return 'Confirmed';
      case 'preparing': return 'Preparing';
      case 'ready': return 'Ready';
      case 'served': return 'Served';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'preparing': return <ChefHat className="h-8 w-8" />;
      case 'ready': return <CheckCircle className="h-8 w-8" />;
      default: return <Clock className="h-8 w-8" />;
    }
  };

  if (loading) return <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-gray-400" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-black dark:to-gray-950 p-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-lg">
        {promotionalMessage && (
          <div className="text-center mb-8 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <p className="text-xl">{promotionalMessage}</p>
          </div>
        )}

        {!order ? (
          <div className="text-center py-20">
            <UtensilsCrossed className="h-20 w-20 mx-auto text-gray-300 dark:text-gray-700 mb-6" />
            <h2 className="text-2xl font-bold text-gray-600 dark:text-gray-400 mb-2">No Active Order</h2>
            <p className="text-gray-500 dark:text-gray-600">Your order will appear here once placed</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className={cn('inline-flex items-center gap-3 px-6 py-3 rounded-full text-white text-lg font-semibold', getStatusColor(order.status))}>
                {getStatusIcon(order.status)}
                {getStatusLabel(order.status)}
              </div>
              <p className="mt-4 text-gray-500 dark:text-gray-400">Order #{order.orderNumber}</p>
            </div>

            <Card className="mb-6 overflow-hidden">
              <CardContent className="p-0">
                <div className="divide-y">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-500">{item.quantity}</div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total</p>
                <p className="text-4xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(order.totalAmount)}</p>
                {(order.status === 'pending' || order.status === 'confirmed' || order.status === 'preparing') && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <Clock className="h-5 w-5" />
                      <span>Estimated: ~{order.estimatedWait} minutes</span>
                    </div>
                  </div>
                )}
                {order.status === 'ready' && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-emerald-600 dark:text-emerald-400 text-lg font-semibold">🎉 Your order is ready for pickup!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <p className="text-center mt-8 text-xs text-gray-400">StaySuite Restaurant • Auto-refreshes every 10 seconds</p>
      </div>
    </div>
  );
}
