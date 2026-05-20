'use client';

import { useState, useMemo } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  Banknote,
  Building2,
  Wallet,
  Plus,
  Trash2,
  Loader2,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Smartphone,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Folio {
  id: string;
  folioNumber: string;
  balance: number;
  totalAmount: number;
  paidAmount: number;
  currency?: string;
  booking?: {
    id: string;
    confirmationCode: string;
    primaryGuest?: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };
}

interface SplitMethodEntry {
  id: string;
  method: string;
  amount: string;
  cardType: string;
  cardLast4: string;
  reference: string;
}

interface SplitPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folio: Folio;
  onSuccess?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote, color: 'text-emerald-600 dark:text-emerald-400' },
  { value: 'card', label: 'Credit/Debit Card', icon: CreditCard, color: 'text-violet-600 dark:text-violet-400' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Building2, color: 'text-amber-600 dark:text-amber-400' },
  { value: 'upi', label: 'UPI', icon: Smartphone, color: 'text-cyan-600 dark:text-cyan-400' },
  { value: 'online', label: 'Online Payment', icon: Globe, color: 'text-rose-600 dark:text-rose-400' },
];

const CARD_TYPES = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'amex', label: 'American Express' },
  { value: 'discover', label: 'Discover' },
];

const SEGMENT_COLORS = [
  'bg-gradient-to-r from-emerald-500 to-teal-400',
  'bg-gradient-to-r from-violet-500 to-purple-400',
  'bg-gradient-to-r from-amber-500 to-orange-400',
  'bg-gradient-to-r from-cyan-500 to-sky-400',
  'bg-gradient-to-r from-rose-500 to-pink-400',
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function SplitPaymentDialog({
  open,
  onOpenChange,
  folio,
  onSuccess,
}: SplitPaymentDialogProps) {
  const { formatCurrency } = useCurrency();
  const [methods, setMethods] = useState<SplitMethodEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const totalBalance = folio.balance;

  const allocatedTotal = useMemo(() => {
    return methods.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
  }, [methods]);

  const remaining = useMemo(() => {
    return Math.max(0, totalBalance - allocatedTotal);
  }, [totalBalance, allocatedTotal]);

  const isOverBalance = useMemo(() => {
    return allocatedTotal > totalBalance + 0.005;
  }, [allocatedTotal, totalBalance]);

  const isFullyAllocated = useMemo(() => {
    return remaining <= 0.005 && allocatedTotal > 0;
  }, [remaining, allocatedTotal]);

  const isValid = useMemo(() => {
    if (methods.length < 2) return false;
    if (!isFullyAllocated || isOverBalance) return false;
    return methods.every((m) => {
      const amount = parseFloat(m.amount);
      return amount > 0 && !isNaN(amount);
    });
  }, [methods, isFullyAllocated, isOverBalance]);

  // Initialize with 2 default methods when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      const half = (totalBalance / 2).toFixed(2);
      setMethods([
        {
          id: `split-${Date.now()}-1`,
          method: 'card',
          amount: half,
          cardType: '',
          cardLast4: '',
          reference: '',
        },
        {
          id: `split-${Date.now()}-2`,
          method: 'cash',
          amount: half,
          cardType: '',
          cardLast4: '',
          reference: '',
        },
      ]);
    }
    onOpenChange(newOpen);
  };

  const addMethod = () => {
    setMethods((prev) => [
      ...prev,
      {
        id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        method: 'cash',
        amount: remaining > 0 ? remaining.toFixed(2) : '',
        cardType: '',
        cardLast4: '',
        reference: '',
      },
    ]);
  };

  const removeMethod = (id: string) => {
    if (methods.length <= 2) return;
    setMethods((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMethod = (id: string, field: keyof SplitMethodEntry, value: string) => {
    setMethods((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const handleSubmit = async () => {
    if (!isValid) return;

    setSaving(true);
    try {
      const paymentsPayload = methods.map((m) => ({
        method: m.method,
        amount: parseFloat(m.amount),
        cardType: m.method === 'card' ? m.cardType || undefined : undefined,
        cardLast4: m.method === 'card' ? m.cardLast4 || undefined : undefined,
        reference: m.reference || undefined,
      }));

      const response = await fetch('/api/payments/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folioId: folio.id,
          payments: paymentsPayload,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          `Split payment of ${formatCurrency(allocatedTotal)} processed across ${methods.length} methods`
        );
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error?.message || 'Failed to process split payment');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getMethodIcon = (methodValue: string) => {
    const method = PAYMENT_METHODS.find((m) => m.value === methodValue);
    return method?.icon || CreditCard;
  };

  const getMethodLabel = (methodValue: string) => {
    const method = PAYMENT_METHODS.find((m) => m.value === methodValue);
    return method?.label || methodValue;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Split Payment
          </DialogTitle>
          <DialogDescription>
            Split payment of {formatCurrency(totalBalance)} across multiple methods for folio{' '}
            <span className="font-mono font-medium">{folio.folioNumber}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Balance Summary */}
          <div className="rounded-xl bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Balance Due</span>
              <span className="text-lg font-bold">{formatCurrency(totalBalance)}</span>
            </div>

            {/* Progress bar */}
            {methods.length > 0 && (
              <div className="space-y-1">
                <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-muted-foreground/10">
                  {methods.map((m, i) => {
                    const amt = parseFloat(m.amount) || 0;
                    if (amt <= 0) return null;
                    const pct = Math.min((amt / totalBalance) * 100, 100);
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          'transition-all duration-300',
                          SEGMENT_COLORS[i % SEGMENT_COLORS.length]
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {methods.map((m, i) => {
                    const amt = parseFloat(m.amount) || 0;
                    if (amt <= 0) return null;
                    return (
                      <div key={m.id} className="flex items-center gap-1.5 text-xs">
                        <div
                          className={cn(
                            'h-2 w-2 rounded-sm',
                            SEGMENT_COLORS[i % SEGMENT_COLORS.length]
                          )}
                        />
                        <span className="text-muted-foreground">{getMethodLabel(m.method)}:</span>
                        <span className="font-medium">{formatCurrency(amt)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Remaining</span>
              <span
                className={cn(
                  'text-sm font-semibold',
                  isOverBalance
                    ? 'text-red-600 dark:text-red-400'
                    : isFullyAllocated
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                )}
              >
                {isOverBalance
                  ? `Over by ${formatCurrency(allocatedTotal - totalBalance)}`
                  : formatCurrency(remaining)}
              </span>
            </div>

            {isFullyAllocated && !isOverBalance && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Fully allocated — ready to submit</span>
              </div>
            )}

            {isOverBalance && (
              <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Total exceeds the folio balance</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Payment Method Cards */}
          <div className="space-y-3">
            {methods.map((entry, index) => {
              const Icon = getMethodIcon(entry.method);
              const methodInfo = PAYMENT_METHODS.find((m) => m.value === entry.method);

              return (
                <div
                  key={entry.id}
                  className="rounded-xl border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'p-1.5 rounded-md',
                          SEGMENT_COLORS[index % SEGMENT_COLORS.length]
                            .replace('bg-gradient-to-r', 'bg')
                            .split(' ')
                            .slice(0, 2)
                            .join(' ')
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-sm font-medium">
                        Method #{index + 1}
                      </span>
                    </div>
                    {methods.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-500"
                        onClick={() => removeMethod(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Method</Label>
                      <Select
                        value={entry.method}
                        onValueChange={(v) => updateMethod(entry.id, 'method', v)}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Amount</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={entry.amount}
                          onChange={(e) => updateMethod(entry.id, 'amount', e.target.value)}
                          className="h-9 pl-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card-specific fields */}
                  {entry.method === 'card' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Card Type</Label>
                        <Select
                          value={entry.cardType}
                          onValueChange={(v) => updateMethod(entry.id, 'cardType', v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            {CARD_TYPES.map((ct) => (
                              <SelectItem key={ct.value} value={ct.value}>
                                {ct.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Last 4</Label>
                        <Input
                          placeholder="4242"
                          maxLength={4}
                          value={entry.cardLast4}
                          onChange={(e) =>
                            updateMethod(
                              entry.id,
                              'cardLast4',
                              e.target.value.replace(/\D/g, '').slice(0, 4)
                            )
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Reference</Label>
                        <Input
                          placeholder="Optional"
                          value={entry.reference}
                          onChange={(e) => updateMethod(entry.id, 'reference', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Reference for non-card methods */}
                  {entry.method !== 'card' && (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Reference / Note (optional)
                      </Label>
                      <Input
                        placeholder="Transaction reference, check number, etc."
                        value={entry.reference}
                        onChange={(e) => updateMethod(entry.id, 'reference', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Method Button */}
          <Button
            variant="outline"
            onClick={addMethod}
            className="w-full h-9 border-dashed"
            disabled={methods.length >= 5}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Payment Method ({methods.length}/5)
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || saving}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg transition-all"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? 'Processing...' : `Pay ${formatCurrency(allocatedTotal)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
