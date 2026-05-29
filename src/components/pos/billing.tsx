'use client';

import { useTranslations } from 'next-intl';

import React, { useState, useEffect, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Loader2,
  Receipt,
  CreditCard,
  DollarSign,
  Printer,
  Split,
  Clock,
  CheckCircle2,
  ChevronRight,
  UtensilsCrossed,
  Wallet,
  X,
  History,
  Tag,
} from 'lucide-react';
import { OrderDiscount } from '@/components/pos/order-discounts';
import { format } from 'date-fns';
import { usePropertyId } from '@/hooks/use-property';

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
  };
}

interface Order {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  subtotal: number;
  taxes: number;
  totalAmount: number;
  discount: number;
  guestName?: string;
  notes?: string;
  createdAt: string;
  completedAt?: string;
  payments?: {
    id: string;
    amount: number;
    method: string;
    processedAt: string;
  }[];
  table?: {
    id: string;
    number: string;
    area?: string;
  };
  items: OrderItem[];
}

export default function POSBilling() {
const t = useTranslations('pos');
  const { propertyId } = usePropertyId();
  const { formatCurrency } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [tipAmount, setTipAmount] = useState('');
  const [splitCount, setSplitCount] = useState(2);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'billing' | 'recent'>('billing');
  const [recentPayments, setRecentPayments] = useState<Order[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // Tax rate
  const [taxRate, setTaxRate] = useState<number>(0);

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (propertyId) params.append('propertyId', propertyId);
      params.append('status', 'served,ready');
      if (search) params.append('search', search);

      const response = await fetch(`/api/orders?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setOrders(data.data);
      }
    } catch (error) {

      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [propertyId, search]);

  const fetchPropertyTaxRate = async () => {
    if (!propertyId) return;
    try {
      const res = await fetch(`/api/properties/${propertyId}`);
      const data = await res.json();
      if (data.success && data.data?.defaultTaxRate !== undefined) {
        setTaxRate(data.data.defaultTaxRate);
      }
    } catch {
      setTaxRate(0);
    }
  };

  const fetchRecentPayments = useCallback(async () => {
    if (!propertyId) return;
    setLoadingRecent(true);
    try {
      const params = new URLSearchParams();
      params.append('propertyId', propertyId);
      params.append('status', 'paid');

      const response = await fetch(`/api/orders?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setRecentPayments(data.data);
      }
    } catch (error) {

    } finally {
      setLoadingRecent(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if (propertyId) {
      fetchOrders();
      fetchPropertyTaxRate();
    }
  }, [fetchOrders, propertyId]);

  useEffect(() => {
    if (propertyId && activeTab === 'recent') {
      fetchRecentPayments();
    }
  }, [fetchRecentPayments, propertyId, activeTab]);

  const tip = parseFloat(tipAmount) || 0;
  const discountAmount = selectedOrder?.discount || 0;
  const currentTotal = selectedOrder
    ? selectedOrder.totalAmount + tip - discountAmount
    : 0;
  // Correct split-bill: first N-1 people pay floor share, last person pays the remainder
  // This ensures splitAmount * splitCount === currentTotal (no rounding drift)
  const splitAmount = isSplitMode
    ? Math.floor((currentTotal / splitCount) * 100) / 100
    : currentTotal;
  const lastSplitAmount = isSplitMode
    ? Math.round((currentTotal - splitAmount * (splitCount - 1)) * 100) / 100
    : currentTotal;

  const handleProcessPayment = async () => {
    if (!selectedOrder) return;
    setIsProcessing(true);
    const paymentAmt = isSplitMode ? splitAmount : currentTotal;
    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod,
          tipAmount: tip,
          splitCount: isSplitMode ? splitCount : undefined,
          paymentAmount: paymentAmt,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Payment processing failed');
      }

      toast.success(`${formatCurrency(data.data.payment.amount)} processed via ${paymentMethod}${isSplitMode ? ` (${splitCount} splits)` : ''}`);
      setSelectedOrder(null);
      setTipAmount('');
      setIsSplitMode(false);
      fetchOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!selectedOrder) return;
    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${selectedOrder.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; max-width: 320px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 16px; border-bottom: 1px dashed #000; padding-bottom: 12px; }
          .header h1 { font-size: 18px; }
          .header p { font-size: 12px; color: #666; }
          .info { margin-bottom: 12px; font-size: 12px; }
          .info p { margin: 4px 0; }
          .items { margin-bottom: 12px; }
          .item { display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .totals { font-size: 12px; }
          .totals p { display: flex; justify-content: space-between; margin: 4px 0; }
          .totals .total { font-weight: bold; font-size: 14px; }
          .footer { text-align: center; margin-top: 16px; font-size: 11px; color: #666; border-top: 1px dashed #000; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>RECEIPT</h1>
          <p>Order #${selectedOrder.orderNumber}</p>
          <p>${new Date(selectedOrder.createdAt).toLocaleString()}</p>
        </div>
        <div class="info">
          <p>Type: ${selectedOrder.orderType === 'dine_in' ? 'Dine In' : selectedOrder.orderType === 'room_service' ? 'Room Service' : selectedOrder.orderType}</p>
          ${selectedOrder.table ? `<p>Table: ${selectedOrder.table.number}${selectedOrder.table.area ? ' (' + selectedOrder.table.area + ')' : ''}</p>` : ''}
          ${selectedOrder.guestName ? `<p>Guest: ${selectedOrder.guestName}</p>` : ''}
        </div>
        <div class="divider"></div>
        <div class="items">
          ${selectedOrder.items.map(item => `<div class="item"><span>${item.menuItem.name} x${item.quantity}</span><span>${formatCurrency(item.totalAmount)}</span></div>`).join('')}
        </div>
        <div class="divider"></div>
        <div class="totals">
          <p><span>Subtotal</span><span>${formatCurrency(selectedOrder.subtotal)}</span></p>
          <p><span>Tax</span><span>${formatCurrency(selectedOrder.taxes)}</span></p>
          ${discountAmount > 0 ? `<p><span>Discount</span><span>-${formatCurrency(discountAmount)}</span></p>` : ''}
          ${tip > 0 ? `<p><span>Tip</span><span>${formatCurrency(tip)}</span></p>` : ''}
          <p class="total"><span>TOTAL</span><span>${formatCurrency(currentTotal)}</span></p>
        </div>
        <div class="footer">
          <p>Thank you for dining with us!</p>
        </div>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  const billableOrders = orders.filter(o => ['served', 'ready'].includes(o.status));

  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Receipt className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No Property Selected</p>
        <p className="text-sm">Please select a property to manage billing</p>
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
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            POS Billing
          </h2>
        </div>
        <p className="text-muted-foreground">
          Process payments and manage checkout for restaurant orders
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'billing' ? 'default' : 'outline'}
          onClick={() => setActiveTab('billing')}
          className={activeTab === 'billing' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : ''}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Active Billing
        </Button>
        <Button
          variant={activeTab === 'recent' ? 'default' : 'outline'}
          onClick={() => setActiveTab('recent')}
          className={activeTab === 'recent' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : ''}
        >
          <History className="h-4 w-4 mr-2" />
          Recent Payments
        </Button>
      </div>

      {activeTab === 'billing' ? (
        <>
          {/* Stats */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ready to Bill</CardTitle>
                <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{billableOrders.filter(o => o.status === 'ready').length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Served</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{billableOrders.filter(o => o.status === 'served').length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(billableOrders.reduce((sum, o) => sum + o.totalAmount, 0))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Order</CardTitle>
                <UtensilsCrossed className="h-4 w-4 text-violet-500 dark:text-violet-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(billableOrders.length ? billableOrders.reduce((sum, o) => sum + o.totalAmount, 0) / billableOrders.length : 0)}
                </div>
              </CardContent>
            </Card>
          </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders Ready for Billing</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by order number or guest..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <ScrollArea className="h-[500px]">
              {billableOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Receipt className="h-12 w-12 mb-4 opacity-50" />
                  <p>No orders ready for billing</p>
                  <p className="text-sm">Orders will appear here when served or ready</p>
                </div>
              ) : (
                billableOrders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => {
                      setSelectedOrder(order);
                      setTipAmount('');
                      setIsSplitMode(false);
                    }}
                    className={`w-full px-4 py-3 flex items-center justify-between border-b last:border-0 transition-colors hover:bg-muted/50 text-left ${
                      selectedOrder?.id === order.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        order.status === 'ready' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{order.orderNumber}</p>
                          <Badge variant="outline" className="text-xs">
                            {order.status === 'ready' ? 'Ready' : 'Served'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {order.table && <span>Table {order.table.number}</span>}
                          {order.guestName && <span>• {order.guestName}</span>}
                          <span>• {order.items.length} items</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">{formatCurrency(order.totalAmount)}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Payment Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Checkout</span>
              {selectedOrder && (
                <Badge variant="outline">{selectedOrder.orderNumber}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              {selectedOrder
                ? `Process payment for order ${selectedOrder.orderNumber}`
                : 'Select an order from the list to process payment'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedOrder ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CreditCard className="h-12 w-12 mb-4 opacity-50" />
                <p>No order selected</p>
                <p className="text-sm">Click an order to begin checkout</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Order Details */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Order</span>
                    <span className="font-medium">{selectedOrder.orderNumber}</span>
                  </div>
                  {selectedOrder.table && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Table</span>
                      <span>{selectedOrder.table.number} {selectedOrder.table.area && `(${selectedOrder.table.area})`}</span>
                    </div>
                  )}
                  {selectedOrder.guestName && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Guest</span>
                      <span>{selectedOrder.guestName}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Time</span>
                    <span>{format(new Date(selectedOrder.createdAt), 'h:mm a')}</span>
                  </div>
                </div>

                {/* Item Breakdown */}
                <div className="space-y-1">
                  <p className="text-sm font-medium">Items</p>
                  <ScrollArea className="max-h-32">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm py-1">
                        <span className="text-muted-foreground">
                          {item.menuItem.name} x{item.quantity}
                        </span>
                        <span>{formatCurrency(item.totalAmount)}</span>
                      </div>
                    ))}
                  </ScrollArea>
                </div>

                <Separator />

                {/* Discount */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Discounts</span>
                  <OrderDiscount
                    order={{
                      id: selectedOrder.id,
                      orderNumber: selectedOrder.orderNumber,
                      subtotal: selectedOrder.subtotal,
                      taxes: selectedOrder.taxes,
                      totalAmount: selectedOrder.totalAmount,
                      discount: selectedOrder.discount,
                    }}
                    onApply={() => {
                      fetchOrders();
                      // Re-fetch to get the updated discount
                      fetch(`/api/orders/${selectedOrder.id}?propertyId=${propertyId}`)
                        .then(r => r.json())
                        .then(data => {
                          if (data.success && data.data) {
                            setSelectedOrder(data.data);
                          }
                        })
                        .catch((error) => { console.error('Context: fetching selected order:', error); });
                    }}
                  />
                </div>

                {/* Totals */}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                    <span>{formatCurrency(selectedOrder.taxes)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        Discount
                      </span>
                      <span className="text-amber-600 dark:text-amber-400">-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  {tip > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tip</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(tip)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span>{formatCurrency(currentTotal)}</span>
                  </div>
                </div>

                <Separator />

                {/* Payment Method */}
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4" />
                          Cash
                        </div>
                      </SelectItem>
                      <SelectItem value="card">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Credit/Debit Card
                        </div>
                      </SelectItem>
                      <SelectItem value="room_charge">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Charge to Room
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tip */}
                <div className="space-y-2">
                  <Label>Tip Amount</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={tipAmount}
                      onChange={(e) => setTipAmount(e.target.value)}
                      className="flex-1"
                      min="0"
                      step="0.50"
                    />
                    <div className="flex gap-1">
                      {[10, 15, 20].map(pct => (
                        <Button
                          key={pct}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => setTipAmount((selectedOrder.subtotal * pct / 100).toFixed(2))}
                        >
                          {pct}%
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Split Bill */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Split Bill</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSplitMode(!isSplitMode)}
                    >
                      <Split className="h-3 w-3 mr-1" />
                      {isSplitMode ? 'Cancel Split' : 'Split Bill'}
                    </Button>
                  </div>
                  {isSplitMode && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Split between:</span>
                      <div className="flex items-center gap-1">
                        {[2, 3, 4, 5].map(n => (
                          <Button
                            key={n}
                            variant={splitCount === n ? 'default' : 'outline'}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setSplitCount(n)}
                          >
                            {n}
                          </Button>
                        ))}
                      </div>
                      <span className="text-sm font-medium ml-auto">
                        {formatCurrency(splitAmount)} / person
                        {splitCount > 1 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (last: {formatCurrency(lastSplitAmount)})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handlePrintReceipt}
                    disabled={!selectedOrder}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Receipt
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                    onClick={handleProcessPayment}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    {isSplitMode ? `Pay ${formatCurrency(splitAmount)}` : `Pay ${formatCurrency(currentTotal)}`}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
        </>
      ) : (
        <>
          {/* Recent Payments Section */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Payments Today</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {recentPayments.filter(o => {
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    return new Date(o.completedAt || o.createdAt) >= today;
                  }).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(recentPayments.reduce((sum, o) => sum + o.totalAmount, 0))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Payment</CardTitle>
                <UtensilsCrossed className="h-4 w-4 text-violet-500 dark:text-violet-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(recentPayments.length ? recentPayments.reduce((sum, o) => sum + o.totalAmount, 0) / recentPayments.length : 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
                <History className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{recentPayments.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Payments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingRecent ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : recentPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mb-4 opacity-50" />
                  <p>No recent payments</p>
                  <p className="text-sm">Completed payments will appear here</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  {recentPayments.map((order) => (
                    <div
                      key={order.id}
                      className="w-full px-4 py-3 flex items-center justify-between border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{order.orderNumber}</p>
                            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                              Paid
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {order.table && <span>Table {order.table.number}</span>}
                            {order.guestName && <span>• {order.guestName}</span>}
                            <span>• {format(new Date(order.completedAt || order.createdAt), 'MMM d, h:mm a')}</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(order.totalAmount)}</span>
                    </div>
                  ))}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
