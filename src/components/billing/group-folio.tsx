'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Plus,
  Trash2,
  CreditCard,
  FileText,
  X,
  Lock,
  RefreshCw,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Users,
  Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GroupFolio {
  id: string;
  tenantId: string;
  propertyId: string;
  groupBookingId: string;
  organizerGuestId: string | null;
  status: string;
  subtotal: number;
  taxes: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  folioItems: GroupFolioItem[];
  payments: GroupFolioPayment[];
}

interface GroupFolioItem {
  id: string;
  groupFolioId: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  taxRate: number;
  taxAmount: number;
  serviceDate: string;
  referenceType: string | null;
  referenceId: string | null;
  postedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GroupFolioPayment {
  id: string;
  tenantId: string;
  propertyId: string;
  groupFolioId: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  description: string | null;
  processedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FOLIO_STATUSES: Record<string, { label: string; color: string }> = {
  open: {
    label: 'Open',
    color: 'bg-gradient-to-r from-blue-500 to-blue-400',
  },
  partially_paid: {
    label: 'Partially Paid',
    color: 'bg-gradient-to-r from-amber-500 to-amber-400',
  },
  paid: {
    label: 'Paid',
    color: 'bg-gradient-to-r from-emerald-500 to-teal-400',
  },
  closed: {
    label: 'Closed',
    color: 'bg-gradient-to-r from-gray-500 to-gray-400',
  },
};

const ITEM_CATEGORIES = [
  { value: 'room_charge', label: 'Room Charge' },
  { value: 'food_beverage', label: 'Food & Beverage' },
  { value: 'function', label: 'Function / Event' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'spa', label: 'Spa & Wellness' },
  { value: 'minibar', label: 'Minibar' },
  { value: 'parking', label: 'Parking' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
  { value: 'adjustment', label: 'Adjustment' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'complementary', label: 'Complementary' },
  { value: 'room_charge', label: 'Room Charge' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GroupFolioComponent() {
  const params = useParams();
  const groupBookingId = params?.id as string;
  const { toast } = useToast();

  // State
  const [folio, setFolio] = useState<GroupFolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog states
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  // Form states
  const [itemForm, setItemForm] = useState({
    description: '',
    category: 'miscellaneous',
    quantity: '1',
    unitPrice: '',
    taxRate: '0',
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'bank_transfer',
    reference: '',
    description: '',
  });

  // Editing state
  const [editingItem, setEditingItem] = useState<GroupFolioItem | null>(null);

  const isClosed = folio?.status === 'closed';

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  const fetchFolio = useCallback(async () => {
    if (!groupBookingId) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/group-bookings/${groupBookingId}/folio`);
      const result = await res.json();

      if (result.success) {
        setFolio(result.data);
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to load group folio',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load group folio',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [groupBookingId, toast]);

  useEffect(() => {
    fetchFolio();
  }, [fetchFolio]);

  // ---------------------------------------------------------------------------
  // Add Item
  // ---------------------------------------------------------------------------

  const handleAddItem = async () => {
    if (!itemForm.description || !itemForm.unitPrice) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in description and unit price',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/group-bookings/${groupBookingId}/folio/items`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: itemForm.description,
            category: itemForm.category,
            quantity: parseInt(itemForm.quantity) || 1,
            unitPrice: parseFloat(itemForm.unitPrice) || 0,
            taxRate: parseFloat(itemForm.taxRate) || 0,
          }),
        }
      );

      const result = await res.json();

      if (result.success) {
        toast({
          title: 'Item Added',
          description: `Added "${itemForm.description}" to folio`,
        });
        setAddItemOpen(false);
        resetItemForm();
        fetchFolio();
      } else {
        toast({
          title: 'Error',
          description:
            result.error?.message || 'Failed to add line item',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to add line item',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Update Item
  // ---------------------------------------------------------------------------

  const handleUpdateItem = async () => {
    if (!editingItem || !itemForm.description || !itemForm.unitPrice) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/group-bookings/${groupBookingId}/folio/items`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: editingItem.id,
            description: itemForm.description,
            category: itemForm.category,
            quantity: parseInt(itemForm.quantity) || 1,
            unitPrice: parseFloat(itemForm.unitPrice) || 0,
            taxRate: parseFloat(itemForm.taxRate) || 0,
          }),
        }
      );

      const result = await res.json();

      if (result.success) {
        toast({
          title: 'Item Updated',
          description: `Updated "${itemForm.description}"`,
        });
        setEditingItem(null);
        resetItemForm();
        fetchFolio();
      } else {
        toast({
          title: 'Error',
          description:
            result.error?.message || 'Failed to update line item',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update line item',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Delete Item
  // ---------------------------------------------------------------------------

  const handleDeleteItem = async (itemId: string, description: string) => {
    try {
      const res = await fetch(
        `/api/group-bookings/${groupBookingId}/folio/items?itemId=${itemId}`,
        {
          method: 'DELETE',
        }
      );

      const result = await res.json();

      if (result.success) {
        toast({
          title: 'Item Removed',
          description: `Removed "${description}" from folio`,
        });
        fetchFolio();
      } else {
        toast({
          title: 'Error',
          description:
            result.error?.message || 'Failed to remove line item',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to remove line item',
        variant: 'destructive',
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Record Payment
  // ---------------------------------------------------------------------------

  const handleRecordPayment = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid payment amount',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/group-bookings/${groupBookingId}/folio/payments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(paymentForm.amount),
            method: paymentForm.method,
            reference: paymentForm.reference || undefined,
            description: paymentForm.description || undefined,
          }),
        }
      );

      const result = await res.json();

      if (result.success) {
        toast({
          title: 'Payment Recorded',
          description: `Payment of ${parseFloat(paymentForm.amount).toFixed(2)} recorded`,
        });
        setPaymentOpen(false);
        setPaymentForm({
          amount: '',
          method: 'bank_transfer',
          reference: '',
          description: '',
        });
        fetchFolio();
      } else {
        toast({
          title: 'Error',
          description:
            result.error?.message || 'Failed to record payment',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to record payment',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Close Folio
  // ---------------------------------------------------------------------------

  const handleCloseFolio = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/group-bookings/${groupBookingId}/folio`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed' }),
        }
      );

      const result = await res.json();

      if (result.success) {
        toast({
          title: 'Folio Closed',
          description: 'Group folio has been closed successfully',
        });
        setCloseConfirmOpen(false);
        fetchFolio();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to close folio',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to close folio',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const resetItemForm = () => {
    setItemForm({
      description: '',
      category: 'miscellaneous',
      quantity: '1',
      unitPrice: '',
      taxRate: '0',
    });
  };

  const openEditDialog = (item: GroupFolioItem) => {
    setEditingItem(item);
    setItemForm({
      description: item.description,
      category: item.category,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      taxRate: String(item.taxRate),
    });
    setAddItemOpen(true);
  };

  const closeDialogs = () => {
    setAddItemOpen(false);
    setEditingItem(null);
    resetItemForm();
  };

  const getStatusBadge = (status: string) => {
    const config = FOLIO_STATUSES[status] || {
      label: status,
      color: 'bg-gray-500',
    };
    return (
      <Badge
        variant="secondary"
        className={cn(
          'text-white px-2.5 py-0.5 rounded-full text-xs font-medium',
          config.color
        )}
      >
        {config.label}
      </Badge>
    );
  };

  const getCategoryLabel = (category: string) => {
    const cat = ITEM_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  const getMethodLabel = (method: string) => {
    const m = PAYMENT_METHODS.find((p) => p.value === method);
    return m?.label || method;
  };

  const formatCurrency = (amount: number) => {
    const cur = folio?.currency || 'USD';
    const symbolMap: Record<string, string> = {
      USD: '$',
      EUR: '\u20AC',
      GBP: '\u00A3',
      INR: '\u20B9',
    };
    const sym = symbolMap[cur] || cur;
    return `${sym}${amount.toFixed(2)}`;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Group Folio
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage supplementary charges and payments for this group booking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchFolio}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {!isClosed && (
            <>
              <Button size="sm" onClick={() => setPaymentOpen(true)}>
                <CreditCard className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
              <Button size="sm" onClick={() => setCloseConfirmOpen(true)}>
                <Lock className="h-4 w-4 mr-2" />
                Close Folio
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-slate-500/10">
              <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="mt-0.5">
                {folio && getStatusBadge(folio.status)}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <DollarSign className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Subtotal</div>
              <div className="text-lg font-bold">
                {formatCurrency(folio?.subtotal || 0)}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Receipt className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-bold">
                {formatCurrency(folio?.totalAmount || 0)}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Paid</div>
              <div className="text-lg font-bold">
                {formatCurrency(folio?.paidAmount || 0)}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'p-2 rounded-lg',
                (folio?.balance ?? 0) > 0
                  ? 'bg-amber-500/10'
                  : 'bg-emerald-500/10'
              )}
            >
              <AlertCircle
                className={cn(
                  'h-4 w-4',
                  (folio?.balance ?? 0) > 0
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-emerald-500 dark:text-emerald-400'
                )}
              />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Balance</div>
              <div
                className={cn(
                  'text-lg font-bold',
                  (folio?.balance ?? 0) > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                )}
              >
                {formatCurrency(folio?.balance || 0)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Line Items Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Line Items
              <Badge variant="outline" className="text-xs font-normal">
                {folio?.folioItems?.length || 0}
              </Badge>
            </CardTitle>
            {!isClosed && (
              <Button size="sm" onClick={() => setAddItemOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(!folio?.folioItems || folio.folioItems.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No line items yet</p>
              {!isClosed && (
                <p className="text-xs mt-1">
                  Click &quot;Add Item&quot; to add supplementary charges
                </p>
              )}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Category
                    </TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Date
                    </TableHead>
                    {!isClosed && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folio.folioItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell>
                        <span className="font-medium text-sm">
                          {item.description}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(item.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {item.taxRate > 0
                          ? `${item.taxRate}% (${formatCurrency(item.taxAmount)})`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(item.totalAmount)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {format(new Date(item.serviceDate), 'MMM d, yyyy')}
                      </TableCell>
                      {!isClosed && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => openEditDialog(item)}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                              onClick={() =>
                                handleDeleteItem(item.id, item.description)
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {/* Items Subtotal Row */}
                  <TableRow className="bg-muted/30 font-medium">
                    <TableCell colSpan={5} className="text-right text-sm">
                      Items Subtotal
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(
                        (folio?.folioItems || []).reduce(
                          (sum, item) => sum + item.totalAmount,
                          0
                        )
                      )}
                    </TableCell>
                    <TableCell colSpan={isClosed ? 2 : 3} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payments
              <Badge variant="outline" className="text-xs font-normal">
                {folio?.payments?.length || 0}
              </Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(!folio?.payments || folio.payments.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CreditCard className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No payments recorded</p>
              {!isClosed && (
                <p className="text-xs mt-1">
                  Click &quot;Record Payment&quot; to add a payment
                </p>
              )}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Reference
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folio.payments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-muted/50">
                      <TableCell className="text-sm">
                        {format(
                          new Date(payment.createdAt),
                          'MMM d, yyyy HH:mm'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getMethodLabel(payment.method)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {payment.description || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-xs',
                            payment.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : payment.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400'
                          )}
                        >
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground font-mono">
                        {payment.reference || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Payments Total Row */}
                  <TableRow className="bg-muted/30 font-medium">
                    <TableCell colSpan={3} className="text-right text-sm">
                      Total Payments
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(
                        (folio?.payments || []).reduce(
                          (sum, p) =>
                            sum +
                            (p.status === 'completed' ? p.amount : 0),
                          0
                        )
                      )}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Folio Totals Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Subtotal (incl. child folios)
              </span>
              <span className="font-medium">
                {formatCurrency(folio?.subtotal || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Taxes</span>
              <span className="font-medium">
                {formatCurrency(folio?.taxes || 0)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-semibold text-base">
                {formatCurrency(folio?.totalAmount || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Paid</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {formatCurrency(folio?.paidAmount || 0)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="font-semibold">Balance Due</span>
              <span
                className={cn(
                  'text-xl font-bold',
                  (folio?.balance ?? 0) > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                )}
              >
                {formatCurrency(folio?.balance || 0)}
              </span>
            </div>
            {folio?.closedAt && (
              <div className="text-xs text-muted-foreground text-right pt-2">
                Closed on {format(new Date(folio.closedAt), 'MMM d, yyyy HH:mm')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Item Dialog */}
      <Dialog open={addItemOpen} onOpenChange={closeDialogs}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Line Item' : 'Add Line Item'}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? 'Update the line item details'
                : 'Add a supplementary charge to the group folio'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                placeholder="e.g., Meeting Room Rental"
                value={itemForm.description}
                onChange={(e) =>
                  setItemForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={itemForm.category}
                onValueChange={(val) =>
                  setItemForm((prev) => ({ ...prev, category: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={itemForm.quantity}
                  onChange={(e) =>
                    setItemForm((prev) => ({
                      ...prev,
                      quantity: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitPrice">Unit Price *</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={itemForm.unitPrice}
                  onChange={(e) =>
                    setItemForm((prev) => ({
                      ...prev,
                      unitPrice: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                step="0.1"
                min="0"
                value={itemForm.taxRate}
                onChange={(e) =>
                  setItemForm((prev) => ({
                    ...prev,
                    taxRate: e.target.value,
                  }))
                }
              />
            </div>

            {/* Preview */}
            {itemForm.unitPrice && itemForm.quantity && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Line Total</span>
                  <span className="font-medium">
                    {formatCurrency(
                      (parseFloat(itemForm.unitPrice) || 0) *
                        (parseInt(itemForm.quantity) || 1)
                    )}
                  </span>
                </div>
                {parseFloat(itemForm.taxRate) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Tax ({itemForm.taxRate}%)
                    </span>
                    <span className="text-muted-foreground">
                      {formatCurrency(
                        ((parseFloat(itemForm.unitPrice) || 0) *
                          (parseInt(itemForm.quantity) || 1) *
                          (parseFloat(itemForm.taxRate) || 0)) /
                          100
                      )}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Total with Tax</span>
                  <span>
                    {formatCurrency(
                      (parseFloat(itemForm.unitPrice) || 0) *
                        (parseInt(itemForm.quantity) || 1) *
                        (1 + (parseFloat(itemForm.taxRate) || 0) / 100)
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>
              Cancel
            </Button>
            <Button
              onClick={editingItem ? handleUpdateItem : handleAddItem}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingItem ? 'Update Item' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment towards the group folio balance
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Current Balance
              </span>
              <span className="font-semibold text-lg">
                {formatCurrency(folio?.balance || 0)}
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount *</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    amount: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-method">Payment Method *</Label>
              <Select
                value={paymentForm.method}
                onValueChange={(val) =>
                  setPaymentForm((prev) => ({ ...prev, method: val }))
                }
              >
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label htmlFor="payment-reference">
                Reference{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="payment-reference"
                placeholder="e.g., Transaction ID, Cheque #"
                value={paymentForm.reference}
                onChange={(e) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    reference: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-description">
                Description{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="payment-description"
                placeholder="e.g., Group deposit payment"
                value={paymentForm.description}
                onChange={(e) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Folio Confirmation Dialog */}
      <Dialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Close Group Folio</DialogTitle>
            <DialogDescription>
              Are you sure you want to close this group folio? This action
              cannot be undone. If there is an outstanding balance, the folio
              will be marked as partially paid instead of closed.
            </DialogDescription>
          </DialogHeader>

          {folio && folio.balance > 0.01 && (
            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Outstanding Balance
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  The folio has a remaining balance of{' '}
                  <strong>{formatCurrency(folio.balance)}</strong>. The folio
                  will be marked as &quot;Partially Paid&quot; rather than
                  &quot;Closed&quot;.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCloseFolio}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Close Folio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
