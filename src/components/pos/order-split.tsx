'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Scissors, Minus, Plus, Loader2, Copy } from 'lucide-react';

interface OrderItemData { id: string; menuItemId: string; name: string; quantity: number; unitPrice: number; notes?: string; }

interface OrderSplitProps {
  order: { id: string; orderNumber: string; items: OrderItemData[]; subtotal: number; taxes: number; totalAmount: number };
  onSplit?: () => void;
}

export function OrderSplit({ order, onSplit }: OrderSplitProps) {
  const [splits, setSplits] = useState<number[][]>([order.items.map((_, i) => i)]);
  const [splitting, setSplitting] = useState(false);

  const addSplit = () => setSplits(prev => [...prev, []]);
  const removeSplit = (idx: number) => {
    if (splits.length <= 1) return;
    setSplits(prev => prev.filter((_, i) => i !== idx));
  };

  const assignToSplit = (itemIdx: number, splitIdx: number) => {
    setSplits(prev => prev.map((s, i) => i === splitIdx ? [...s, itemIdx] : s.filter(x => x !== itemIdx)));
  };

  const splitEqually = () => {
    const n = splits.length;
    const newSplits = Array.from({ length: n }, () => [] as number[]);
    order.items.forEach((_, idx) => newSplits[idx % n].push(idx));
    setSplits(newSplits);
  };

  const getSplitTotal = (splitIdx: number) => {
    return splits[splitIdx].reduce((sum, itemIdx) => sum + order.items[itemIdx].unitPrice * order.items[itemIdx].quantity, 0);
  };

  const allAssigned = splits.every(s => s.length === 0) || order.items.every((_, i) => splits.some(s => s.includes(i)));

  const doSplit = async () => {
    if (!allAssigned || splits.filter(s => s.length > 0).length < 2) {
      toast.error('Assign items to at least 2 splits');
      return;
    }

    setSplitting(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          splits: splits.filter(s => s.length > 0).map(s => ({
            items: s.map(i => order.items[i].id),
            notes: '',
          })),
        }),
      });
      const data = await res.json();
      if (data.success) { toast.success(`Order split into ${splits.filter(s => s.length > 0).length} orders`); onSplit?.(); }
      else toast.error(data.error?.message || 'Failed to split');
    } catch { toast.error('Failed'); } finally { setSplitting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="h-4 w-4" />
          <h3 className="font-semibold">Split Order {order.orderNumber}</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={splitEqually}><Copy className="h-3 w-3 mr-1" />Split Equally</Button>
          <Button variant="outline" size="sm" onClick={addSplit}><Plus className="h-3 w-3 mr-1" />Add Split</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {splits.map((split, splitIdx) => (
          <Card key={splitIdx}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Split {splitIdx + 1}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">${getSplitTotal(splitIdx).toFixed(2)}</span>
                  {splits.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSplit(splitIdx)}><Minus className="h-3 w-3" /></Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {split.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">No items assigned</p>
              ) : split.map(itemIdx => {
                const item = order.items[itemIdx];
                return (
                  <div key={itemIdx} className="flex justify-between text-sm p-1 rounded bg-muted/30">
                    <span>{item.name} x{item.quantity}</span>
                    <span>${(item.unitPrice * item.quantity).toFixed(2)}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Items with assignment */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Assign Items to Splits</h4>
        {order.items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between p-2 rounded border">
            <div>
              <span className="text-sm font-medium">{item.name}</span>
              <span className="text-xs text-muted-foreground ml-2">x{item.quantity} - ${(item.unitPrice * item.quantity).toFixed(2)}</span>
            </div>
            <div className="flex gap-1">
              {splits.map((_, splitIdx) => (
                <Button
                  key={splitIdx}
                  variant={splits[splitIdx].includes(idx) ? 'default' : 'outline'}
                  size="sm"
                  className={`h-6 w-6 p-0 text-xs ${splits[splitIdx].includes(idx) ? 'bg-emerald-600' : ''}`}
                  onClick={() => assignToSplit(idx, splitIdx)}
                >
                  {splitIdx + 1}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button onClick={doSplit} disabled={splitting || !allAssigned} className="w-full bg-emerald-600 hover:bg-emerald-700">
        {splitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Scissors className="h-4 w-4 mr-2" />}
        Split Order
      </Button>
    </div>
  );
}

export default OrderSplit;
