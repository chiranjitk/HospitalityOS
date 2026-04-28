'use client';

import { useTranslations } from 'next-intl';

import { useState } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Percent, DollarSign, Tag, Shield, Loader2, History, CheckCircle } from 'lucide-react';

interface OrderDiscountProps {
  order: { id: string; orderNumber: string; subtotal: number; taxes: number; totalAmount: number; discount: number };
  onApply?: () => void;
}

const presetValues = { percentage: [5, 10, 15, 20, 25, 30], fixed: [5, 10, 15, 20, 25, 50] };
const reasons = ['Staff meal', 'Loyalty', 'Manager approval', 'Promotion', 'Complaint recovery', 'Happy hour', 'Early bird', 'Birthday', 'Other'];

export function OrderDiscount({ order, onApply }: OrderDiscountProps) {
 order, onApply }: OrderDiscountProps) {const t = useTranslations('pos');
  const { formatCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [authPin, setAuthPin] = useState('');
  const [needAuth, setNeedAuth] = useState(false);
  const [applying, setApplying] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const discountAmount = type === 'percentage' ? (order.subtotal * (parseFloat(value) || 0)) / 100 : parseFloat(value) || 0;
  const exceedsLimit = type === 'percentage' && (parseFloat(value) || 0) > 20;
  const finalTotal = Math.max(order.totalAmount - discountAmount, 0);

  const applyDiscount = async () => {
    if (!parseFloat(value) || parseFloat(value) <= 0) { toast.error('Enter a discount value'); return; }
    if (!reason) { toast.error('Select a reason'); return; }
    if (exceedsLimit && !authPin) { setNeedAuth(true); return; }

    setApplying(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/discount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, value: parseFloat(value), reason, couponCode: couponCode || undefined, authorizedBy: authPin || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Discount of ${formatCurrency(discountAmount)} applied`);
        setHistory(prev => [{ type, value: parseFloat(value), reason, createdAt: new Date().toISOString() }, ...prev]);
        setOpen(false); setValue(''); setReason(''); setCouponCode(''); setAuthPin(''); setNeedAuth(false);
        onApply?.();
      } else toast.error(data.error?.message || 'Failed');
    } catch { toast.error('Failed'); } finally { setApplying(false); }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
        <Tag className="h-4 w-4 mr-1" />Discount
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Apply Discount</DialogTitle><DialogDescription>Order {order.orderNumber} — Subtotal: {formatCurrency(order.subtotal)}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={type === 'percentage' ? 'default' : 'outline'} className={type === 'percentage' ? 'bg-emerald-600' : ''} onClick={() => setType('percentage')}><Percent className="h-4 w-4 mr-1" />%</Button>
              <Button variant={type === 'fixed' ? 'default' : 'outline'} className={type === 'fixed' ? 'bg-emerald-600' : ''} onClick={() => setType('fixed')}><DollarSign className="h-4 w-4 mr-1" />Fixed</Button>
            </div>

            <div className="flex gap-2 flex-wrap">
              {presetValues[type].map(v => (
                <Button key={v} variant="outline" size="sm" className={value == String(v) ? 'border-emerald-500 bg-emerald-50' : ''} onClick={() => setValue(String(v))}>
                  {type === 'percentage' ? `${v}%` : formatCurrency(v)}
                </Button>
              ))}
              <Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder={type === 'percentage' ? 'Custom %' : 'Custom $'} className="w-28" />
            </div>

            {exceedsLimit && <div className="flex items-center gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-700 text-sm"><Shield className="h-4 w-4" />Discounts over 20% require manager authorization</div>}

            <Select value={reason} onValueChange={setReason}><SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger><SelectContent>{reasons.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>

            {needAuth && <div><label className="text-sm font-medium">Manager PIN</label><Input type="password" value={authPin} onChange={e => setAuthPin(e.target.value)} placeholder="Enter PIN" /></div>}

            <Input value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="Coupon code (optional)" />

            <Separator />

            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-amber-600"><span>Discount ({type === 'percentage' ? `${value}%` : formatCurrency(parseFloat(value) || 0)})</span><span>-{formatCurrency(discountAmount)}</span></div>}
              <Separator />
              <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatCurrency(finalTotal)}</span></div>
            </div>

            {history.length > 0 && (
              <div className="space-y-1"><h4 className="text-sm font-medium flex items-center gap-1"><History className="h-3 w-3" />Recent Discounts</h4>
                {history.slice(0, 3).map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground p-1"><CheckCircle className="h-3 w-3 text-emerald-500" /><span>{h.type === 'percentage' ? `${h.value}%` : `$${h.value}`} — {h.reason}</span></div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={applyDiscount} disabled={applying || !parseFloat(value) || !reason} className="bg-emerald-600 hover:bg-emerald-700">
              {applying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Tag className="h-4 w-4 mr-1" />}Apply Discount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default OrderDiscount;
