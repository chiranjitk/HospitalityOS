'use client';

import { useTranslations } from 'next-intl';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CreditCard,
  Banknote,
  Building2,
  Wallet,
  Search,
  Loader2,
  DollarSign,
  Plus,
  Eye,
  RotateCcw,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard as CardIcon,
  Trash2,
  ArrowRightLeft,
  Info,
  SplitSquareHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Folio {
  id: string;
  folioNumber: string;
  balance: number;
  totalAmount: number;
  paidAmount: number;
  status: string;
  currency?: string;
  booking?: {
    id: string;
    confirmationCode: string;
    primaryGuest?: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
    };
  };
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  method: string;
  gateway?: string;
  cardType?: string;
  cardLast4?: string;
  transactionId?: string;
  reference?: string;
  status: string;
  refundAmount: number;
  refundReason?: string;
  refundedAt?: string;
  createdAt: string;
  processedAt?: string;
  folio: {
    id: string;
    folioNumber: string;
    booking?: {
      id: string;
      confirmationCode: string;
      primaryGuest?: {
        firstName: string;
        lastName: string;
        email?: string;
      };
    };
  };
  guest?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
}

interface SplitLine {
  id: string;
  method: string;
  amount: string;
  gateway: string;
  cardType: string;
  cardLast4: string;
  cardExpiry: string;
}

interface ConversionCacheEntry {
  rate: number;
  convertedAmount: number;
  timestamp: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPLIT_SEGMENT_COLORS = [
  'bg-gradient-to-r from-emerald-500 to-teal-400',
  'bg-gradient-to-r from-amber-500 to-orange-400',
  'bg-gradient-to-r from-violet-500 to-purple-400',
  'bg-gradient-to-r from-rose-500 to-pink-400',
  'bg-gradient-to-r from-cyan-500 to-sky-400',
];

const COMMON_CURRENCIES = [
  { code: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { code: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { code: 'GBP', label: 'GBP - British Pound', symbol: '£' },
  { code: 'INR', label: 'INR - Indian Rupee', symbol: '₹' },
  { code: 'JPY', label: 'JPY - Japanese Yen', symbol: '¥' },
  { code: 'AUD', label: 'AUD - Australian Dollar', symbol: 'A$' },
  { code: 'CAD', label: 'CAD - Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', label: 'CHF - Swiss Franc', symbol: 'CHF' },
  { code: 'SGD', label: 'SGD - Singapore Dollar', symbol: 'S$' },
  { code: 'AED', label: 'AED - UAE Dirham', symbol: 'د.إ' },
];

const paymentStatuses = [
  { value: 'pending', label: 'Pending', color: 'bg-gradient-to-r from-amber-500 to-amber-400', icon: Clock },
  { value: 'completed', label: 'Completed', color: 'bg-gradient-to-r from-emerald-500 to-teal-400', icon: CheckCircle },
  { value: 'failed', label: 'Failed', color: 'bg-gradient-to-r from-red-500 to-rose-400', icon: XCircle },
  { value: 'refunded', label: 'Refunded', color: 'bg-gradient-to-r from-gray-500 to-gray-400', icon: RotateCcw },
  { value: 'partially_refunded', label: 'Partial Refund', color: 'bg-gradient-to-r from-orange-500 to-amber-400', icon: RotateCcw },
];

const methodBadgeColors: Record<string, string> = {
  card: 'bg-gradient-to-r from-blue-500 to-blue-400',
  cash: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
  bank_transfer: 'bg-gradient-to-r from-amber-500 to-amber-400',
  wallet: 'bg-gradient-to-r from-teal-500 to-teal-400',
  check: 'bg-gradient-to-r from-gray-500 to-gray-400',
};

const paymentMethods = [
  { value: 'card', label: 'Credit/Debit Card', icon: CreditCard, description: 'Visa, Mastercard, Amex' },
  { value: 'cash', label: 'Cash', icon: Banknote, description: 'Cash payment' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Building2, description: 'Wire transfer' },
  { value: 'wallet', label: 'Digital Wallet', icon: Wallet, description: 'Apple Pay, Google Pay' },
  { value: 'check', label: 'Check', icon: CreditCard, description: 'Personal/Business check' },
];

const cardTypes = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'amex', label: 'American Express' },
  { value: 'discover', label: 'Discover' },
];

const gateways = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'square', label: 'Square' },
  { value: 'manual', label: 'Manual' },
];

const CONVERSION_FEE_PERCENT = 2.5;
const CONVERSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Helper: format amount with a specific currency symbol ────────────────────

function formatAmountWithCurrency(amount: number, currencyCode: string): string {
  const found = COMMON_CURRENCIES.find(c => c.code === currencyCode);
  if (found) {
    if (currencyCode === 'JPY') return `${found.symbol}${Math.round(amount).toLocaleString()}`;
    return `${found.symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${currencyCode} ${amount.toFixed(2)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Payments() {
  const t = useTranslations('billing');
  const { toast } = useToast();
  const { formatCurrency, currency: displayCurrency } = useCurrency();
  const { formatDate, formatTime, formatDateTime, settings } = useTimezone();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [folios, setFolios] = useState<Folio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [summary, setSummary] = useState({
    totalAmount: 0,
    totalRefunded: 0,
    count: 0,
  });

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [isSplitSuccessOpen, setIsSplitSuccessOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Single payment form state
  const [paymentMode, setPaymentMode] = useState<'single' | 'split'>('single');
  const [formData, setFormData] = useState({
    folioId: '',
    amount: '',
    method: 'card',
    gateway: 'manual',
    cardType: '',
    cardLast4: '',
    cardExpiry: '',
    reference: '',
    paymentCurrency: '',
  });

  // Split payment state
  const [splitLines, setSplitLines] = useState<SplitLine[]>([]);
  const [splitSuccessSummary, setSplitSuccessSummary] = useState<{
    totalAmount: number;
    methods: string[];
    transactionIds: string[];
  } | null>(null);

  // Multi-currency state
  const [conversionCache, setConversionCache] = useState<Map<string, ConversionCacheEntry>>(new Map());
  const [isConverting, setIsConverting] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [conversionRate, setConversionRate] = useState<number | null>(null);
  const [conversionFee, setConversionFee] = useState<number>(0);

  // Refund form state
  const [refundData, setRefundData] = useState({
    amount: '',
    reason: '',
  });

  // ─── Derived state ────────────────────────────────────────────────────────

  const selectedFolio = folios.find(f => f.id === formData.folioId);
  const selectedMethod = paymentMethods.find(m => m.value === formData.method);

  const splitAllocated = useMemo(() => {
    return splitLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
  }, [splitLines]);

  const splitRemaining = useMemo(() => {
    if (!selectedFolio) return 0;
    return Math.max(0, selectedFolio.balance - splitAllocated);
  }, [selectedFolio, splitAllocated]);

  const splitIsOverBalance = useMemo(() => {
    if (!selectedFolio) return false;
    return splitAllocated > selectedFolio.balance + 0.005;
  }, [selectedFolio, splitAllocated]);

  const splitIsFullyAllocated = useMemo(() => {
    if (!selectedFolio) return false;
    return splitRemaining <= 0.005 && splitAllocated > 0;
  }, [selectedFolio, splitRemaining, splitAllocated]);

  // ─── Currency conversion ──────────────────────────────────────────────────

  const convertCurrency = useCallback(async (amount: number, from: string, to: string): Promise<{ rate: number; converted: number } | null> => {
    if (from === to || !amount) return { rate: 1, converted: amount };
    const cacheKey = `${from}-${to}-${amount}`;
    const now = Date.now();
    const cached = conversionCache.get(cacheKey);
    if (cached && now - cached.timestamp < CONVERSION_CACHE_TTL) {
      setConversionRate(cached.rate);
      setConvertedAmount(cached.convertedAmount);
      setConversionFee(Math.round(cached.convertedAmount * CONVERSION_FEE_PERCENT / 100 * 100) / 100);
      return { rate: cached.rate, converted: cached.convertedAmount };
    }

    setIsConverting(true);
    try {
      const res = await fetch(`/api/billing/exchange-rates/convert?amount=${amount}&from=${from}&to=${to}`);
      const result = await res.json();
      if (result.success) {
        const { rate: r, convertedAmount: ca } = result.data;
        const fee = Math.round(ca * CONVERSION_FEE_PERCENT / 100 * 100) / 100;
        setConversionRate(r);
        setConvertedAmount(ca);
        setConversionFee(fee);
        setConversionCache(prev => {
          const next = new Map(prev);
          next.set(cacheKey, { rate: r, convertedAmount: ca, timestamp: now });
          return next;
        });
        return { rate: r, converted: ca };
      }
    } catch {
      // silently fail
    } finally {
      setIsConverting(false);
    }
    return null;
  }, [conversionCache]);

  // Derived: should we show conversion?
  const shouldShowConversion = useMemo(() => {
    if (!formData.folioId || !formData.paymentCurrency) return false;
    const folio = folios.find(f => f.id === formData.folioId);
    const amount = parseFloat(formData.amount) || 0;
    return amount > 0 && folio?.currency && formData.paymentCurrency !== folio.currency;
  }, [formData.folioId, formData.paymentCurrency, formData.amount, folios]);

  // Auto-convert when payment currency changes
  useEffect(() => {
    if (!shouldShowConversion) return;
    let cancelled = false;
    const run = async () => {
      const folio = folios.find(f => f.id === formData.folioId);
      const amount = parseFloat(formData.amount) || 0;
      if (folio?.currency) {
        const result = await convertCurrency(amount, formData.paymentCurrency, folio.currency);
        if (!cancelled) {
          if (result) {
            setConvertedAmount(result.convertedAmount);
            setConversionRate(result.rate);
            setConversionFee(Math.round(result.convertedAmount * CONVERSION_FEE_PERCENT / 100 * 100) / 100);
          } else {
            setConvertedAmount(null);
            setConversionRate(null);
            setConversionFee(0);
          }
        }
      } else {
        if (!cancelled) {
          setConvertedAmount(null);
          setConversionRate(null);
          setConversionFee(0);
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [shouldShowConversion, formData.paymentCurrency, formData.amount, formData.folioId, folios, convertCurrency]);

  // ─── Data fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchFolios = async () => {
      try {
        const response = await fetch('/api/folios?limit=100');
        const result = await response.json();
        if (result.success) {
          const foliosWithBalance = result.data.filter((f: Folio) => f.balance > 0);
          setFolios(foliosWithBalance);
          if (foliosWithBalance.length > 0) {
            const firstFolio = foliosWithBalance[0];
            setFormData(prev => ({
              ...prev,
              folioId: firstFolio.id,
              amount: firstFolio.balance.toString(),
              paymentCurrency: firstFolio.currency || displayCurrency.code,
            }));
          }
        }
      } catch (error) {

      }
    };
    fetchFolios();
  }, [displayCurrency.code]);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (methodFilter !== 'all') params.append('method', methodFilter);

      const response = await fetch(`/api/payments?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setPayments(result.data);
        setSummary(result.summary);
      }
    } catch (error) {

      toast({
        title: 'Error',
        description: 'Failed to fetch payments',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter, methodFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchPayments();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ─── Form helpers (must be before handleCreate due to hoisting) ────────────────

  const refreshFolios = async () => {
    try {
      const response = await fetch('/api/folios?limit=100');
      const result = await response.json();
      if (result.success) {
        setFolios(result.data.filter((f: Folio) => f.balance > 0));
      }
    } catch (error) {

    }
  };

  const resetForm = () => {
    const firstFolio = folios[0];
    setFormData({
      folioId: firstFolio?.id || '',
      amount: firstFolio?.balance?.toString() || '',
      method: 'card',
      gateway: 'manual',
      cardType: '',
      cardLast4: '',
      cardExpiry: '',
      reference: '',
      paymentCurrency: firstFolio?.currency || displayCurrency.code,
    });
    setPaymentMode('single');
    setSplitLines([]);
    setConvertedAmount(null);
    setConversionRate(null);
    setConversionFee(0);
  };

  // ─── Payment details ──────────────────────────────────────────────────────

  const viewPaymentDetails = async (paymentId: string) => {
    try {
      const response = await fetch(`/api/payments/${paymentId}`);
      const result = await response.json();

      if (result.success) {
        setSelectedPayment(result.data);
        setIsDetailOpen(true);
      }
    } catch (error) {

    }
  };

  // ─── Single payment creation ──────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!formData.folioId || !formData.amount || !formData.method) {
      toast({ title: 'Validation Error', description: t('fillRequiredFields'), variant: 'destructive' });
      return;
    }
    if (parseFloat(formData.amount) <= 0) {
      toast({ title: 'Validation Error', description: 'Amount must be greater than 0', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folioId: formData.folioId,
          amount: parseFloat(formData.amount),
          currency: formData.paymentCurrency || selectedFolio?.currency || displayCurrency.code,
          method: formData.method,
          gateway: formData.gateway,
          cardType: formData.cardType || undefined,
          cardLast4: formData.cardLast4 || undefined,
          cardExpiry: formData.cardExpiry || undefined,
          reference: formData.reference || undefined,
          exchangeRate: conversionRate || undefined,
          conversionFee: conversionFee || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({ title: 'Success', description: t('paymentProcessed') });
        setIsCreateOpen(false);
        resetForm();
        fetchPayments();
        refreshFolios();
      } else {
        toast({ title: 'Error', description: result.error?.message || t('failedToProcess'), variant: 'destructive' });
      }
    } catch (error) {

      toast({ title: 'Error', description: t('failedToProcess'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [formData, selectedFolio, displayCurrency.code, conversionRate, conversionFee, t]);

  // ─── Split payment creation ───────────────────────────────────────────────

  const addSplitLine = () => {
    setSplitLines(prev => [...prev, {
      id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      method: 'cash',
      amount: splitRemaining > 0 ? splitRemaining.toFixed(2) : '',
      gateway: 'manual',
      cardType: '',
      cardLast4: '',
      cardExpiry: '',
    }]);
  };

  const removeSplitLine = (id: string) => {
    setSplitLines(prev => prev.filter(l => l.id !== id));
  };

  const updateSplitLine = (id: string, field: keyof SplitLine, value: string) => {
    setSplitLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleSplitPayment = async () => {
    if (!formData.folioId) {
      toast({ title: 'Validation Error', description: 'Please select a folio', variant: 'destructive' });
      return;
    }
    if (splitLines.length < 2) {
      toast({ title: 'Validation Error', description: 'At least 2 payment methods are required for split payment', variant: 'destructive' });
      return;
    }
    if (splitLines.some(l => !l.amount || parseFloat(l.amount) <= 0)) {
      toast({ title: 'Validation Error', description: 'All split lines must have a valid amount', variant: 'destructive' });
      return;
    }
    if (splitRemaining > 0.005) {
      toast({ title: 'Validation Error', description: 'All funds must be allocated. Remaining balance must be 0 to submit.', variant: 'destructive' });
      return;
    }
    if (splitIsOverBalance) {
      toast({ title: 'Validation Error', description: 'Total allocated exceeds folio balance', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const createdPayments: string[] = [];
    const usedMethods: string[] = [];

    try {
      // Create a payment record for each split line sequentially
      for (let i = 0; i < splitLines.length; i++) {
        const line = splitLines[i];
        const methodInfo = paymentMethods.find(m => m.value === line.method);

        const response = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folioId: formData.folioId,
            amount: parseFloat(line.amount),
            currency: formData.paymentCurrency || selectedFolio?.currency || displayCurrency.code,
            method: line.method,
            gateway: line.method === 'card' ? line.gateway : line.method === 'cash' ? 'manual' : line.gateway,
            cardType: line.method === 'card' ? line.cardType || undefined : undefined,
            cardLast4: line.method === 'card' ? line.cardLast4 || undefined : undefined,
            cardExpiry: line.method === 'card' ? line.cardExpiry || undefined : undefined,
            reference: `Split ${i + 1}/${splitLines.length}${formData.reference ? ` - ${formData.reference}` : ''}`,
          }),
        });

        const result = await response.json();
        if (result.success) {
          createdPayments.push(result.data.transactionId);
          usedMethods.push(methodInfo?.label || line.method.replace('_', ' '));
        } else {
          toast({
            title: 'Partial Error',
            description: `Split ${i + 1} failed: ${result.error?.message || 'Unknown error'}`,
            variant: 'destructive',
          });
        }
      }

      if (createdPayments.length > 0) {
        setSplitSuccessSummary({
          totalAmount: splitAllocated,
          methods: usedMethods,
          transactionIds: createdPayments,
        });
        setIsSplitSuccessOpen(true);
        setIsCreateOpen(false);
        resetForm();
        fetchPayments();
        refreshFolios();
      }
    } catch (error) {

      toast({ title: 'Error', description: 'Failed to process split payment', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Refund ───────────────────────────────────────────────────────────────

  const handleRefund = async () => {
    if (!selectedPayment || !refundData.amount || !refundData.reason) {
      toast({ title: 'Validation Error', description: t('fillRequiredFields'), variant: 'destructive' });
      return;
    }
    const refundAmount = parseFloat(refundData.amount);
    if (refundAmount <= 0 || refundAmount > selectedPayment.amount - selectedPayment.refundAmount) {
      toast({ title: 'Validation Error', description: 'Invalid refund amount', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/payments/${selectedPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refundAmount, refundReason: refundData.reason }),
      });

      const result = await response.json();

      if (result.success) {
        toast({ title: 'Success', description: t('refundProcessed') });
        setIsRefundOpen(false);
        setRefundData({ amount: '', reason: '' });
        fetchPayments();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to process refund', variant: 'destructive' });
      }
    } catch (error) {

      toast({ title: 'Error', description: 'Failed to process refund', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateOpen(true);
    // Pre-populate with 2 split lines
    const firstFolio = folios[0];
    if (firstFolio) {
      setSplitLines([
        {
          id: 'split-init-1',
          method: 'card',
          amount: (firstFolio.balance / 2).toFixed(2),
          gateway: 'manual',
          cardType: '',
          cardLast4: '',
          cardExpiry: '',
        },
        {
          id: 'split-init-2',
          method: 'cash',
          amount: (firstFolio.balance / 2).toFixed(2),
          gateway: 'manual',
          cardType: '',
          cardLast4: '',
          cardExpiry: '',
        },
      ]);
    }
  };

  // ─── Badge helpers ────────────────────────────────────────────────────────

  const getStatusBadge = (status: string) => {
    const option = paymentStatuses.find(o => o.value === status);
    const Icon = option?.icon || Clock;
    return (
      <Badge variant="secondary" className={cn('text-white gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', option?.color)}>
        <Icon className="h-3 w-3" />
        {option?.label || status}
      </Badge>
    );
  };

  const getMethodBadge = (method: string) => {
    const methodOption = paymentMethods.find(m => m.value === method);
    const Icon = methodOption?.icon || CreditCard;
    return (
      <Badge variant="secondary" className={cn('text-white gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', methodBadgeColors[method] || 'bg-gray-500')}>
        <Icon className="h-3 w-3" />
        {methodOption?.label || method.replace('_', ' ')}
      </Badge>
    );
  };

  // ─── Stats ────────────────────────────────────────────────────────────────

  const pendingPayments = payments.filter(p => p.status === 'pending').length;
  const todayPayments = payments.filter(p => {
    const today = new Date().toDateString();
    return new Date(p.createdAt).toDateString() === today;
  }).reduce((sum, p) => sum + p.amount, 0);

  // ─── Render: Split Progress Bar ───────────────────────────────────────────

  const renderSplitIndicator = () => {
    if (splitLines.length === 0 || !selectedFolio) return null;
    const total = selectedFolio.balance;
    if (total <= 0) return null;

    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Payment Split</p>
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted">
          {splitLines.map((line, i) => {
            const amt = parseFloat(line.amount) || 0;
            if (amt <= 0) return null;
            const pct = Math.min((amt / total) * 100, 100);
            return (
              <div
                key={line.id}
                className={cn('transition-all duration-300', SPLIT_SEGMENT_COLORS[i % SPLIT_SEGMENT_COLORS.length])}
                style={{ width: `${pct}%` }}
                title={`${paymentMethods.find(m => m.value === line.method)?.label}: ${formatCurrency(amt)}`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          {splitLines.map((line, i) => {
            const amt = parseFloat(line.amount) || 0;
            if (amt <= 0) return null;
            const methodInfo = paymentMethods.find(m => m.value === line.method);
            const pct = ((amt / total) * 100).toFixed(0);
            return (
              <div key={line.id} className="flex items-center gap-1.5 text-xs">
                <div className={cn('h-2.5 w-2.5 rounded-sm', SPLIT_SEGMENT_COLORS[i % SPLIT_SEGMENT_COLORS.length])} />
                <span className="text-muted-foreground">{methodInfo?.label}:</span>
                <span className="font-medium">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── Render: Split Line Card ──────────────────────────────────────────────

  const renderSplitLine = (line: SplitLine, index: number) => {
    const methodInfo = paymentMethods.find(m => m.value === line.method);
    const Icon = methodInfo?.icon || CreditCard;

    return (
      <Card key={line.id} className="p-4 border-dashed">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded-md', SPLIT_SEGMENT_COLORS[index % SPLIT_SEGMENT_COLORS.length].replace('bg-gradient-to-r', 'bg').split(' ').slice(0, 2).join(' '))}>
              <Icon className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-medium">Split #{index + 1}</span>
          </div>
          {splitLines.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-red-500"
              onClick={() => removeSplitLine(line.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Method</Label>
            <Select value={line.method} onValueChange={(v) => updateSplitLine(line.id, 'method', v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={line.amount}
                onChange={(e) => updateSplitLine(line.id, 'amount', e.target.value)}
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
        </div>

        {line.method === 'card' && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Card Type</Label>
              <Select value={line.cardType} onValueChange={(v) => updateSplitLine(line.id, 'cardType', v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  {cardTypes.map(ct => (
                    <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Last 4</Label>
              <Input
                placeholder="4242"
                maxLength={4}
                value={line.cardLast4}
                onChange={(e) => updateSplitLine(line.id, 'cardLast4', e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Expiry</Label>
              <Input
                placeholder="MM/YY"
                maxLength={5}
                value={line.cardExpiry}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, '');
                  if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2);
                  updateSplitLine(line.id, 'cardExpiry', v.slice(0, 5));
                }}
                className="h-7 text-xs"
              />
            </div>
          </div>
        )}
      </Card>
    );
  };

  // ─── Render: Multi-currency info ──────────────────────────────────────────

  const renderCurrencyConversion = () => {
    const folioCurrency = selectedFolio?.currency || displayCurrency.code;
    const paymentCur = formData.paymentCurrency;

    if (!paymentCur || paymentCur === folioCurrency) return null;
    const amount = parseFloat(formData.amount) || 0;
    if (amount <= 0) return null;

    return (
      <Card className="p-3 border-dashed border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1.5 text-xs flex-1 min-w-0">
            <p className="font-medium text-amber-700 dark:text-amber-300">Currency Conversion</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">You pay:</span>
              <span>{formatAmountWithCurrency(amount, paymentCur)}</span>
            </div>
            {isConverting ? (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Converting...
              </div>
            ) : conversionRate !== null && convertedAmount !== null ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Exchange rate:</span>
                  <span>1 {paymentCur} = {conversionRate.toFixed(4)} {folioCurrency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Folio receives:</span>
                  <span className="font-medium">{formatAmountWithCurrency(convertedAmount, folioCurrency)}</span>
                </div>
                {conversionFee > 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>Conversion fee ({CONVERSION_FEE_PERCENT}%):</span>
                    <span>{formatAmountWithCurrency(conversionFee, folioCurrency)}</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No exchange rate available for {paymentCur} to {folioCurrency}</p>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payments
          </h2>
          <p className="text-sm text-muted-foreground">{t('paymentsDesc')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPayments}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg transition-all">
            <Plus className="h-4 w-4 mr-2" />
            New Payment
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <CreditCard className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent">{summary.count}</div>
              <div className="text-xs text-muted-foreground">{t('totalPayments')}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <DollarSign className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent">{formatCurrency(summary.totalAmount)}</div>
              <div className="text-xs text-muted-foreground">{t('totalProcessed')}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent">{pendingPayments}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <CheckCircle className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-cyan-400 bg-clip-text text-transparent">{formatCurrency(todayPayments)}</div>
              <div className="text-xs text-muted-foreground">Today</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 rounded-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search payments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {paymentMethods.map(method => (
                  <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatus')}</SelectItem>
                {paymentStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mb-4" />
              <p>{t('noPaymentsFound')}</p>
              <p className="text-sm">{t('processFirstPayment')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Folio</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm">{payment.transactionId}</p>
                          {payment.reference && (
                            <p className="text-xs text-muted-foreground">{payment.reference}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-sm">{payment.folio?.folioNumber}</p>
                      </TableCell>
                      <TableCell>
                        {payment.folio?.booking?.primaryGuest ? (
                          <div>
                            <p className="text-sm">
                              {payment.folio.booking.primaryGuest.firstName} {payment.folio.booking.primaryGuest.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">{payment.folio.booking.primaryGuest.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getMethodBadge(payment.method)}
                          {payment.cardLast4 && (
                            <p className="text-xs text-muted-foreground">****{payment.cardLast4}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{formatCurrency(payment.amount)}</p>
                          {payment.refundAmount > 0 && (
                            <p className="text-xs text-red-600 dark:text-red-400">
                              -{formatCurrency(payment.refundAmount)} refunded
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{formatDate(payment.createdAt)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(payment.createdAt))} ago
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => viewPaymentDetails(payment.id)} title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {payment.status === 'completed' && payment.refundAmount < payment.amount && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600 dark:text-amber-400"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setRefundData({ amount: '', reason: '' });
                                setIsRefundOpen(true);
                              }}
                              title="Refund"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════ Create Payment Dialog (Single + Split Tabs) ═══════════════════ */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{t('processPayment')}</DialogTitle>
            <DialogDescription>{t('recordPayment')}</DialogDescription>
          </DialogHeader>

          <Tabs value={paymentMode} onValueChange={(v) => setPaymentMode(v as 'single' | 'split')} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full shrink-0">
              <TabsTrigger value="single" className="flex-1 gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                Single Payment
              </TabsTrigger>
              <TabsTrigger value="split" className="flex-1 gap-1.5">
                <SplitSquareHorizontal className="h-3.5 w-3.5" />
                Split Payment
              </TabsTrigger>
            </TabsList>

            {/* ──── Shared: Folio Selection ──── */}
            <div className="grid gap-4 pt-4 flex-1 overflow-y-auto pr-2 -mr-2">
              <div className="space-y-2">
                <Label htmlFor="folioId">{t('selectFolio')}</Label>
                <Select
                  value={formData.folioId}
                  onValueChange={(value) => {
                    const folio = folios.find(f => f.id === value);
                    setFormData(prev => ({
                      ...prev,
                      folioId: value,
                      amount: folio?.balance?.toString() || '',
                      paymentCurrency: folio?.currency || displayCurrency.code,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select folio" />
                  </SelectTrigger>
                  <SelectContent>
                    {folios.map(folio => (
                      <SelectItem key={folio.id} value={folio.id}>
                        {folio.folioNumber} — Balance: {formatCurrency(folio.balance)}{folio.currency ? ` (${folio.currency})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Folio Info */}
              {selectedFolio && (
                <Card className="p-4 bg-muted/50">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Guest:</span>
                      <span>{selectedFolio.booking?.primaryGuest?.firstName} {selectedFolio.booking?.primaryGuest?.lastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Amount:</span>
                      <span>{formatCurrency(selectedFolio.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Already Paid:</span>
                      <span className="text-cyan-600 dark:text-cyan-400">{formatCurrency(selectedFolio.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Outstanding Balance:</span>
                      <span className="text-amber-600 dark:text-amber-400">{formatCurrency(selectedFolio.balance)}</span>
                    </div>
                  </div>
                </Card>
              )}

              {/* ──── Single Payment Tab ──── */}
              <TabsContent value="single" className="space-y-4 mt-0">
                {/* Currency Selector */}
                <div className="space-y-2">
                  <Label>Payment Currency</Label>
                  <Select
                    value={formData.paymentCurrency}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, paymentCurrency: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_CURRENCIES.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount">{t('paymentAmount')}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {COMMON_CURRENCIES.find(c => c.code === formData.paymentCurrency)?.symbol || formData.paymentCurrency}
                    </span>
                    <Input
                      id="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      className="pl-12"
                    />
                  </div>
                  {selectedFolio && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setFormData(prev => ({ ...prev, amount: selectedFolio.balance.toFixed(2) }))}>
                        Full Amount
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setFormData(prev => ({ ...prev, amount: (selectedFolio.balance / 2).toFixed(2) }))}>
                        50%
                      </Button>
                    </div>
                  )}
                </div>

                {/* Currency Conversion Info */}
                {renderCurrencyConversion()}

                {/* Payment Method */}
                <div className="space-y-2">
                  <Label>{t('paymentMethodLabel')}</Label>
                  <RadioGroup
                    value={formData.method}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, method: value }))}
                    className="grid grid-cols-2 gap-2"
                  >
                    {paymentMethods.map(method => {
                      const Icon = method.icon;
                      return (
                        <Label
                          key={method.value}
                          htmlFor={`single-${method.value}`}
                          className={cn(
                            'flex items-center gap-3 p-3 border rounded-lg cursor-pointer',
                            formData.method === method.value && 'border-primary bg-primary/5'
                          )}
                        >
                          <RadioGroupItem value={method.value} id={`single-${method.value}`} className="sr-only" />
                          <Icon className="h-5 w-5" />
                          <div>
                            <p className="text-sm font-medium">{method.label}</p>
                            <p className="text-xs text-muted-foreground">{method.description}</p>
                          </div>
                        </Label>
                      );
                    })}
                  </RadioGroup>
                </div>

                {/* Card Details */}
                {formData.method === 'card' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="gateway">Payment Gateway</Label>
                      <Select value={formData.gateway} onValueChange={(v) => setFormData(prev => ({ ...prev, gateway: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select gateway" /></SelectTrigger>
                        <SelectContent>
                          {gateways.map(gw => (
                            <SelectItem key={gw.value} value={gw.value}>{gw.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cardType">Card Type</Label>
                        <Select value={formData.cardType} onValueChange={(v) => setFormData(prev => ({ ...prev, cardType: v }))}>
                          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                          <SelectContent>
                            {cardTypes.map(ct => (
                              <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cardLast4">Last 4 Digits</Label>
                        <Input
                          id="cardLast4"
                          placeholder="4242"
                          maxLength={4}
                          value={formData.cardLast4}
                          onChange={(e) => setFormData(prev => ({ ...prev, cardLast4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cardExpiry">Expiry</Label>
                        <Input
                          id="cardExpiry"
                          placeholder="MM/YY"
                          maxLength={5}
                          value={formData.cardExpiry}
                          onChange={(e) => {
                            let v = e.target.value.replace(/\D/g, '');
                            if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2);
                            setFormData(prev => ({ ...prev, cardExpiry: v.slice(0, 5) }));
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Reference */}
                <div className="space-y-2">
                  <Label htmlFor="reference">Reference / Notes</Label>
                  <Input
                    id="reference"
                    placeholder="Optional reference or notes..."
                    value={formData.reference}
                    onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                  />
                </div>
              </TabsContent>

              {/* ──── Split Payment Tab ──── */}
              <TabsContent value="split" className="space-y-4 mt-0">
                {/* Running Totals Summary Bar */}
                {selectedFolio && (
                  <Card className="p-4 bg-muted/50">
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment Summary</p>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-lg bg-background/80 p-2.5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Due</p>
                          <p className="text-sm font-bold">{formatCurrency(selectedFolio.balance)}</p>
                        </div>
                        <div className="rounded-lg bg-background/80 p-2.5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Allocated</p>
                          <p className={cn('text-sm font-bold', splitIsOverBalance ? 'text-red-600 dark:text-red-400' : splitIsFullyAllocated ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                            {formatCurrency(splitAllocated)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-background/80 p-2.5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Remaining</p>
                          <p className={cn('text-sm font-bold', splitIsFullyAllocated ? 'text-emerald-600 dark:text-emerald-400' : splitIsOverBalance ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
                            {formatCurrency(splitRemaining)}
                          </p>
                        </div>
                      </div>
                      <Progress
                        value={selectedFolio.balance > 0 ? Math.min((splitAllocated / selectedFolio.balance) * 100, 100) : 0}
                        className={cn(
                          'h-2.5',
                          splitIsFullyAllocated && '[&>div]:bg-emerald-500',
                          splitIsOverBalance && '[&>div]:bg-red-500',
                          !splitIsFullyAllocated && !splitIsOverBalance && '[&>div]:bg-amber-500',
                        )}
                      />
                      {splitIsFullyAllocated && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Fully allocated — ready to process
                        </p>
                      )}
                      {!splitIsFullyAllocated && !splitIsOverBalance && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {formatCurrency(splitRemaining)} remaining — allocate full balance before submitting
                        </p>
                      )}
                      {splitIsOverBalance && (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Total exceeds folio balance by {formatCurrency(splitAllocated - selectedFolio.balance)}
                        </p>
                      )}
                    </div>
                  </Card>
                )}

                {/* Split Indicator */}
                {renderSplitIndicator()}

                {/* Split Lines */}
                <ScrollArea className="max-h-64 overflow-y-auto">
                  <div className="space-y-3">
                    {splitLines.map((line, i) => renderSplitLine(line, i))}
                  </div>
                </ScrollArea>

                {/* Add Split Line */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={addSplitLine}
                  disabled={splitRemaining <= 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment Method
                </Button>

                {/* Reference */}
                <div className="space-y-2">
                  <Label htmlFor="splitReference">Reference / Notes</Label>
                  <Input
                    id="splitReference"
                    placeholder="Optional reference or notes..."
                    value={formData.reference}
                    onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                  />
                </div>
              </TabsContent>
            </div>

            {/* ──── Footer ──── */}
            <DialogFooter className="shrink-0 pt-2">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              {paymentMode === 'single' ? (
                <Button
                  onClick={handleCreate}
                  disabled={isSaving}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg transition-all"
                >
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Process Payment
                </Button>
              ) : (
                <Button
                  onClick={handleSplitPayment}
                  disabled={isSaving || splitIsOverBalance || !splitIsFullyAllocated || splitLines.length < 2}
                  className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-md hover:shadow-lg transition-all"
                >
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Process Split Payment ({splitLines.length} methods)
                </Button>
              )}
            </DialogFooter>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ Split Payment Success Dialog ═══════════════════ */}
      <Dialog open={isSplitSuccessOpen} onOpenChange={setIsSplitSuccessOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-5 w-5" />
              Payment Successful
            </DialogTitle>
          </DialogHeader>
          {splitSuccessSummary && (
            <div className="space-y-4 py-2">
              <div className="text-center py-4">
                <p className="text-3xl font-bold">{formatCurrency(splitSuccessSummary.totalAmount)}</p>
                <p className="text-sm text-muted-foreground mt-1">Total split payment received</p>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium">Payment received via:</p>
                <div className="space-y-2">
                  {splitSuccessSummary.methods.map((method, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={cn('h-2.5 w-2.5 rounded-sm', SPLIT_SEGMENT_COLORS[i % SPLIT_SEGMENT_COLORS.length].replace('bg-gradient-to-r', 'bg').split(' ').slice(0, 2).join(' '))} />
                      <span className="text-sm">{method}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p>Transaction IDs:</p>
                {splitSuccessSummary.transactionIds.map((txId, i) => (
                  <p key={i} className="font-mono">{txId}</p>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsSplitSuccessOpen(false)} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ Payment Details Dialog ═══════════════════ */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Details
            </DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction ID</span>
                    <span className="font-mono">{selectedPayment.transactionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    {getStatusBadge(selectedPayment.status)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span className="capitalize">{selectedPayment.method.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Currency</span>
                    <span className="uppercase">{selectedPayment.currency}</span>
                  </div>
                  {selectedPayment.gateway && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gateway</span>
                      <span className="capitalize">{selectedPayment.gateway}</span>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">{formatCurrency(selectedPayment.amount)}</span>
                  </div>
                  {selectedPayment.refundAmount > 0 && (
                    <>
                      <div className="flex justify-between text-red-600 dark:text-red-400">
                        <span>Refunded</span>
                        <span>-{formatCurrency(selectedPayment.refundAmount)}</span>
                      </div>
                      {selectedPayment.refundReason && (
                        <div className="text-xs text-muted-foreground mt-1">Reason: {selectedPayment.refundReason}</div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Net Amount</span>
                    <span>{formatCurrency(selectedPayment.amount - selectedPayment.refundAmount)}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Folio</span>
                    <span className="font-mono">{selectedPayment.folio?.folioNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDateTime(selectedPayment.createdAt)}</span>
                  </div>
                  {selectedPayment.processedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processed</span>
                      <span>{formatDateTime(selectedPayment.processedAt)}</span>
                    </div>
                  )}
                </div>
              </Card>

              {selectedPayment.cardLast4 && (
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <CardIcon className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium capitalize">{selectedPayment.cardType}</p>
                      <p className="text-sm text-muted-foreground">****{selectedPayment.cardLast4}</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ Refund Dialog ═══════════════════ */}
      <Dialog open={isRefundOpen} onOpenChange={setIsRefundOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
              Process Refund
            </DialogTitle>
            <DialogDescription>
              {t('refundPayment')} {selectedPayment?.transactionId}
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="grid gap-4 py-4">
              <Card className="p-4 bg-muted/50">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original Amount</span>
                    <span>{formatCurrency(selectedPayment.amount)}</span>
                  </div>
                  {selectedPayment.refundAmount > 0 && (
                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                      <span>Already Refunded</span>
                      <span>{formatCurrency(selectedPayment.refundAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold">
                    <span>Available for Refund</span>
                    <span>{formatCurrency(selectedPayment.amount - selectedPayment.refundAmount)}</span>
                  </div>
                </div>
              </Card>
              <div className="space-y-2">
                <Label htmlFor="refundAmount">Refund Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="refundAmount"
                    type="number"
                    min="0"
                    max={selectedPayment.amount - selectedPayment.refundAmount}
                    step="0.01"
                    placeholder="0.00"
                    value={refundData.amount}
                    onChange={(e) => setRefundData(prev => ({ ...prev, amount: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="refundReason">Reason for Refund</Label>
                <Textarea
                  id="refundReason"
                  placeholder="Enter reason for refund..."
                  value={refundData.reason}
                  onChange={(e) => setRefundData(prev => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRefundOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRefund} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Process Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
