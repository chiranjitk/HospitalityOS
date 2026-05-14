'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGuestApp } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  FileText,
  Download,
  CreditCard,
  Receipt,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Loader2,
  Wallet,
  Building2,
  Smartphone,
  XCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface FolioLineItem {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  serviceDate: string;
  createdAt: string;
}

interface FolioData {
  id: string;
  folioNumber: string;
  subtotal: number;
  taxes: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  currency: string;
  status: string;
  lineItems: FolioLineItem[];
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    cardType?: string;
    cardLast4?: string;
    createdAt: string;
  }>;
}

interface PaymentGateway {
  id: string;
  name: string;
  provider: string;
  mode: string;
  feePercentage: number;
  feeFixed: number;
}

type PaymentStatus = 'idle' | 'fetching_config' | 'ready' | 'processing' | 'success' | 'failed';

const categoryIcons: Record<string, string> = {
  room: '🛏️',
  food_beverage: '🍽️',
  service: '🔧',
  tax: '📊',
  discount: '💰',
  amenity: '✨',
  other: '📦',
};

const gatewayIcons: Record<string, React.ElementType> = {
  stripe: Building2,
  razorpay: Smartphone,
  paypal: Wallet,
  manual: CreditCard,
};

export default function BillPage() {
  const router = useRouter();
  const { data: guestData, isLoading: guestLoading } = useGuestApp();
  const { toast } = useToast();

  const [folio, setFolio] = useState<FolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<string>('manual');
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [folioId, setFolioId] = useState<string | null>(null);
  const [lastPayment, setLastPayment] = useState<{
    transactionId: string;
    amount: number;
    method: string;
  } | null>(null);

  // Fetch detailed folio data
  useEffect(() => {
    const fetchFolio = async () => {
      if (!guestData) return;

      setIsLoading(true);
      try {
        const response = await fetch(`/api/folios?bookingId=${guestData.booking.id}`);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
          const fid = result.data[0].id;
          setFolioId(fid);

          const detailResponse = await fetch(`/api/folios/${fid}`);
          const detailResult = await detailResponse.json();

          if (detailResult.success) {
            setFolio(detailResult.data);
          }
        }
      } catch (error) {
        console.error('Error fetching folio:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFolio();
  }, [guestData]);

  // Fetch payment gateways when dialog opens
  const handleOpenPaymentDialog = async () => {
    setIsPaymentDialogOpen(true);
    setPaymentStatus('fetching_config');
    setPaymentError(null);

    try {
      const token = window.location.pathname.split('/')[2];
      const response = await fetch(`/api/guest-app/pay?token=${token}`);
      const result = await response.json();

      if (result.success) {
        setGateways(result.data.gateways || []);
        setSelectedGateway(
          result.data.gateways?.find((g: PaymentGateway) => g.provider !== 'manual')?.provider || 'manual'
        );
        setPaymentStatus('ready');
      } else {
        setPaymentError(result.error?.message || 'Failed to load payment options');
        setPaymentStatus('failed');
      }
    } catch (error) {
      console.error('Error fetching payment config:', error);
      setPaymentError('Could not connect to payment service');
      setPaymentStatus('failed');
    }
  };

  // Handle payment
  const handlePayment = async () => {
    if (!folioId) return;

    setPaymentStatus('processing');
    setPaymentError(null);

    try {
      const token = window.location.pathname.split('/')[2];
      const isCardPayment = selectedGateway !== 'manual';

      const response = await fetch('/api/guest-app/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          folioId,
          amount: folio?.balance || 0,
          method: isCardPayment ? 'card' : 'cash',
          gateway: selectedGateway,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setPaymentStatus('success');
        setLastPayment({
          transactionId: result.data.transactionId,
          amount: result.data.amount,
          method: result.data.method,
        });

        // Refresh folio data after a short delay
        setTimeout(async () => {
          try {
            const detailResponse = await fetch(`/api/folios/${folioId}`);
            const detailResult = await detailResponse.json();
            if (detailResult.success) {
              setFolio(detailResult.data);
            }
          } catch (e) {
            console.error('Error refreshing folio:', e);
          }
          // Also refresh the guest app data to update balance
          const guestAppResponse = await fetch(`/api/guest-app?token=${token}`);
          await guestAppResponse.json();
        }, 1500);
      } else {
        setPaymentStatus('failed');
        setPaymentError(result.error?.message || 'Payment processing failed');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      setPaymentStatus('failed');
      setPaymentError('Network error. Please try again.');
    }
  };

  const resetPaymentDialog = () => {
    setIsPaymentDialogOpen(false);
    setPaymentStatus('idle');
    setPaymentError(null);
    setSelectedGateway('manual');
    setLastPayment(null);
  };

  // Loading state
  if (guestLoading || isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!guestData) {
    return null;
  }

  const { bill, property, booking } = guestData;

  // Group line items by date
  const groupedItems = folio?.lineItems.reduce((groups: Record<string, FolioLineItem[]>, item) => {
    const date = format(new Date(item.serviceDate), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
    return groups;
  }, {}) || {};

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Your Bill</h2>
          <p className="text-sm text-muted-foreground">
            Booking #{booking.confirmationCode}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </div>

      {/* Balance Card */}
      <Card className={cn(
        'overflow-hidden',
        bill.balanceDue > 0 ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
      )}>
        <CardContent className="p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {bill.balanceDue > 0 ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">
                {bill.balanceDue > 0 ? 'Balance Due' : 'Paid in Full'}
              </span>
            </div>
            {bill.balanceDue > 0 && (
              <Badge className="bg-white/20 text-white border-0">
                Outstanding
              </Badge>
            )}
          </div>

          <div className="mb-4">
            <p className="text-white/80 text-sm">Total Amount</p>
            <p className="text-3xl font-bold">
              {bill.currency} {bill.balanceDue.toFixed(2)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-white/60 text-xs">Total Charges</p>
              <p className="font-semibold">{bill.currency} {bill.totalCharges.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs">Amount Paid</p>
              <p className="font-semibold">{bill.currency} {bill.totalPaid.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Pay */}
      {bill.balanceDue > 0 && (
        <Button
          className="w-full bg-gradient-to-r from-sky-500 to-indigo-600"
          onClick={handleOpenPaymentDialog}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Pay Now - {bill.currency} {bill.balanceDue.toFixed(2)}
        </Button>
      )}

      {/* Charges by Date */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Charges</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {Object.keys(groupedItems).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No charges yet</p>
              <p className="text-sm">Charges will appear here as you use hotel services</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              {Object.entries(groupedItems)
                .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                .map(([date, items]) => (
                  <div key={date}>
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                      <p className="text-xs font-medium text-muted-foreground">
                        {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                      </p>
                    </div>
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">
                            {categoryIcons[item.category] || '📦'}
                          </span>
                          <div>
                            <p className="text-sm font-medium">{item.description}</p>
                            {item.quantity > 1 && (
                              <p className="text-xs text-muted-foreground">
                                {item.quantity}x @ {bill.currency} {item.unitPrice.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="font-medium text-sm">
                          {bill.currency} {item.totalAmount.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Bill Summary */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Room Charges</span>
              <span>{bill.currency} {(bill.totalCharges * 0.7).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">F&B</span>
              <span>{bill.currency} {(bill.totalCharges * 0.15).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Services</span>
              <span>{bill.currency} {(bill.totalCharges * 0.08).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxes & Fees</span>
              <span>{bill.currency} {(bill.totalCharges * 0.07).toFixed(2)}</span>
            </div>

            <Separator />

            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{bill.currency} {bill.totalCharges.toFixed(2)}</span>
            </div>

            {bill.totalPaid > 0 && (
              <>
                <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                  <span>Paid</span>
                  <span>-{bill.currency} {bill.totalPaid.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Balance Due</span>
                  <span className={bill.balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600 dark:text-emerald-400'}>
                    {bill.currency} {bill.balanceDue.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      {folio && folio.payments.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Payment History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {folio.payments.map((payment) => (
              <div
                key={payment.id}
                className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize">{payment.method}</p>
                    {payment.cardLast4 && (
                      <p className="text-xs text-muted-foreground">
                        {payment.cardType} ****{payment.cardLast4}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(payment.createdAt), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
                <p className="font-medium text-emerald-600 dark:text-emerald-400">
                  +{bill.currency} {payment.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Help */}
      <Card className="bg-slate-50 dark:bg-slate-800/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center">
            Questions about your bill?{' '}
            <button
              onClick={() => router.push(`/guest/${window.location.pathname.split('/')[2]}/chat`)}
              className="text-sky-600 dark:text-sky-400 font-medium hover:underline"
            >
              Chat with front desk
            </button>
          </p>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={(open) => { if (!open) resetPaymentDialog(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Make Payment</DialogTitle>
            <DialogDescription>Choose a payment method to settle your balance</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Amount */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Amount to Pay</p>
              <p className="text-2xl font-bold mt-1">
                {bill.currency} {bill.balanceDue.toFixed(2)}
              </p>
            </div>

            {/* Success State */}
            {paymentStatus === 'success' && lastPayment && (
              <div className="space-y-4">
                <div className="flex flex-col items-center py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="font-semibold text-lg">Payment Successful</p>
                  <p className="text-sm text-muted-foreground">
                    TXN: {lastPayment.transactionId}
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={resetPaymentDialog}
                >
                  Done
                </Button>
              </div>
            )}

            {/* Processing State */}
            {paymentStatus === 'processing' && (
              <div className="flex flex-col items-center py-8 space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
                <div className="text-center">
                  <p className="font-medium">Processing Payment</p>
                  <p className="text-sm text-muted-foreground">
                    Please do not close this window...
                  </p>
                </div>
              </div>
            )}

            {/* Failed State */}
            {paymentStatus === 'failed' && (
              <div className="space-y-4">
                <div className="flex flex-col items-center py-4">
                  <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
                    <XCircle className="h-8 w-8 text-red-500" />
                  </div>
                  <p className="font-medium text-lg">Payment Failed</p>
                  <p className="text-sm text-red-600 dark:text-red-400 text-center">
                    {paymentError || 'An error occurred. Please try again.'}
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setPaymentStatus('ready');
                    setPaymentError(null);
                  }}
                >
                  Try Again
                </Button>
              </div>
            )}

            {/* Loading Gateways */}
            {paymentStatus === 'fetching_config' && (
              <div className="flex flex-col items-center py-8 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading payment options...</p>
              </div>
            )}

            {/* Gateway Selection (Ready State) */}
            {paymentStatus === 'ready' && (
              <>
                <div className="space-y-3">
                  {/* Pay at Front Desk */}
                  <button
                    onClick={() => setSelectedGateway('manual')}
                    className={cn(
                      'w-full p-3 rounded-lg border-2 flex items-center justify-between transition-colors',
                      selectedGateway === 'manual'
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Pay at Front Desk</p>
                        <p className="text-xs text-muted-foreground">Cash, card, or other method</p>
                      </div>
                    </div>
                    {selectedGateway === 'manual' && (
                      <CheckCircle2 className="h-5 w-5 text-sky-500" />
                    )}
                  </button>

                  {/* Card Payment Gateways */}
                  {gateways.filter(g => g.provider !== 'manual').map((gw) => {
                    const GatewayIcon = gatewayIcons[gw.provider] || CreditCard;
                    return (
                      <button
                        key={gw.id}
                        onClick={() => setSelectedGateway(gw.provider)}
                        className={cn(
                          'w-full p-3 rounded-lg border-2 flex items-center justify-between transition-colors',
                          selectedGateway === gw.provider
                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <GatewayIcon className="h-5 w-5 text-muted-foreground" />
                          <div className="text-left">
                            <p className="text-sm font-medium">{gw.name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground capitalize">
                                {gw.provider}
                              </p>
                              {gw.mode === 'test' && (
                                <Badge variant="outline" className="text-[10px] py-0">
                                  Test
                                </Badge>
                              )}
                              {gw.feePercentage > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{gw.feePercentage}% fee
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {selectedGateway === gw.provider && (
                          <CheckCircle2 className="h-5 w-5 text-sky-500" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {paymentError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{paymentError}</p>
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={resetPaymentDialog}>
                    Cancel
                  </Button>
                  <Button onClick={handlePayment}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pay {bill.currency} {bill.balanceDue.toFixed(2)}
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
