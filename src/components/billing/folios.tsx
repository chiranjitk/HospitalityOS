'use client';

import { useTranslations } from 'next-intl';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { useTax } from '@/contexts/TaxContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
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
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Plus,
  Search,
  Loader2,
  DollarSign,
  CreditCard,
  Eye,
  Trash2,
  Receipt,
  Calendar,
  User,
  Building2,
  RefreshCw,
  X,
  Percent,
  Scissors,
  ArrowRightLeft,
  Clock,
  Zap,
  CheckCircle2,
  AlertCircle,
  Globe2,
  Shield,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns'; // Keep for non-standard date formatting

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface Booking {
  id: string;
  confirmationCode: string;
  checkIn: string;
  checkOut: string;
  primaryGuest: Guest;
  room?: { id: string; number: string };
  roomType?: { id: string; name: string };
}

interface LineItem {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  serviceDate: string;
  taxRate: number;
  taxAmount: number;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
}

interface Folio {
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
  invoiceNumber?: string;
  createdAt: string;
  booking: Booking;
  lineItems?: LineItem[];
  payments?: Payment[];
  _count?: {
    lineItems: number;
    payments: number;
  };
}

const folioStatuses = [
  { value: 'open', label: 'Open', color: 'bg-gradient-to-r from-blue-500 to-blue-400' },
  { value: 'partially_paid', label: 'Partially Paid', color: 'bg-gradient-to-r from-amber-500 to-amber-400' },
  { value: 'paid', label: 'Paid', color: 'bg-gradient-to-r from-emerald-500 to-teal-400' },
  { value: 'closed', label: 'Closed', color: 'bg-gradient-to-r from-gray-500 to-gray-400' },
];

const lineItemCategories = [
  { value: 'room', label: 'Room Charge' },
  { value: 'food', label: 'Food & Beverage' },
  { value: 'service', label: 'Services' },
  { value: 'amenity', label: 'Amenities' },
  { value: 'tax', label: 'Tax' },
  { value: 'discount', label: 'Discount' },
  { value: 'other', label: 'Other' },
];

const CONVERSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default function Folios() {
const t = useTranslations('billing');
  const { toast } = useToast();
  const { formatCurrency, currency: displayCurrency } = useCurrency();
  const { formatDate, formatTime, formatDateTime, settings } = useTimezone();
  const { taxes, getTaxesForCategory, calculateTax, formatTaxRate } = useTax();
  const { user } = useAuth();
  const [folios, setFolios] = useState<Folio[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Multi-currency conversion
  const [conversionCache, setConversionCache] = useState<Map<string, { rate: number; timestamp: number }>>(new Map());
  const [convertedAmounts, setConvertedAmounts] = useState<Map<string, number>>(new Map());

  const convertAmount = useCallback(async (amount: number, from: string, to: string): Promise<number | null> => {
    if (from === to || !amount) return amount;
    const cacheKey = `${from}-${to}`;
    const now = Date.now();
    const cached = conversionCache.get(cacheKey);
    if (cached && now - cached.timestamp < CONVERSION_CACHE_TTL) {
      return Math.round(amount * cached.rate * 100) / 100;
    }
    try {
      const res = await fetch(`/api/billing/exchange-rates/convert?amount=${amount}&from=${from}&to=${to}`);
      const result = await res.json();
      if (result.success) {
        const { rate, convertedAmount } = result.data;
        setConversionCache(prev => { const next = new Map(prev); next.set(cacheKey, { rate, timestamp: now }); return next; });
        return convertedAmount;
      }
    } catch { /* silent */ }
    return null;
  }, [conversionCache]);

  const loadConversion = useCallback(async (amount: number, folioCurrency: string, key: string) => {
    if (folioCurrency === displayCurrency.code || !amount) return;
    const result = await convertAmount(amount, folioCurrency, displayCurrency.code);
    if (result !== null) {
      setConvertedAmounts(prev => { const next = new Map(prev); next.set(key, result); return next; });
    }
  }, [convertAmount, displayCurrency.code]);

  // Load conversions for folio list
  useEffect(() => {
    if (!folios.length) return;
    const displayCode = displayCurrency.code;
    folios.forEach(folio => {
      if (folio.currency && folio.currency !== displayCode && folio.totalAmount > 0) {
        loadConversion(folio.totalAmount, folio.currency, `total-${folio.id}`);
        loadConversion(folio.balance, folio.currency, `balance-${folio.id}`);
      }
    });
  }, [folios, displayCurrency.code, loadConversion]);

  const formatWithConversion = useCallback((amount: number, folioCurrency: string | undefined, key: string): React.ReactNode => {
    const cur = folioCurrency || displayCurrency.code;
    if (cur !== displayCurrency.code && folioCurrency) {
      const converted = convertedAmounts.get(key);
      const symbolMap: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', AUD: 'A$', CAD: 'C$', CHF: 'CHF', SGD: 'S$', AED: 'د.إ' };
      const sym = symbolMap[folioCurrency] || folioCurrency;
      return (
        <span className="inline-flex items-center gap-1">
          <span>{formatCurrency(amount)}</span>
          {converted !== undefined && (
            <span className="text-xs text-muted-foreground">(≈ {sym}{converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
          )}
        </span>
      );
    }
    return <span>{formatCurrency(amount)}</span>;
  }, [displayCurrency.code, formatCurrency, convertedAmounts]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isSplitOpen, setIsSplitOpen] = useState(false);
  const [selectedFolio, setSelectedFolio] = useState<Folio | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Split folio state
  const [splitType, setSplitType] = useState<'items' | 'amount'>('items');
  const [selectedLineItemIds, setSelectedLineItemIds] = useState<string[]>([]);
  const [splitAmount, setSplitAmount] = useState('');
  const [targetGuestId, setTargetGuestId] = useState('');
  const [splitGuests, setSplitGuests] = useState<Guest[]>([]);
  const [isLoadingGuests, setIsLoadingGuests] = useState(false);

  // Form state for creating folio
  const [createFormData, setCreateFormData] = useState({
    propertyId: '',
    bookingId: '',
    guestId: '',
  });

  // Audit trail state
  const [auditEntries, setAuditEntries] = useState<Array<{
    id: string;
    action: string;
    description: string;
    category?: string;
    amount?: number;
    quantity?: number;
    userName?: string;
    source: string;
    createdAt: string;
  }>>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Form state for adding line item
  const [lineItemFormData, setLineItemFormData] = useState({
    description: '',
    category: 'room',
    quantity: '1',
    unitPrice: '',
    useAutoTax: true,
  });

  // Calculate applicable taxes for the selected category
  const applicableTaxes = useMemo(() => {
    return getTaxesForCategory(lineItemFormData.category);
  }, [lineItemFormData.category, getTaxesForCategory]);

  // Calculate tax preview for the form
  const taxPreview = useMemo(() => {
    const amount = parseFloat(lineItemFormData.unitPrice || '0') * parseInt(lineItemFormData.quantity || '1');
    if (amount <= 0) return null;
    return calculateTax(amount, lineItemFormData.category);
  }, [lineItemFormData.unitPrice, lineItemFormData.quantity, lineItemFormData.category, calculateTax]);

  // Fetch bookings for dropdown
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await fetch('/api/bookings?limit=100');
        const result = await response.json();
        if (result.success) {
          // Filter bookings without folios
          setBookings(result.data);
          if (result.data.length > 0) {
            setCreateFormData(prev => ({
              ...prev,
              bookingId: result.data[0].id,
              guestId: result.data[0].primaryGuest?.id,
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching bookings:', error);
      }
    };
    fetchBookings();
  }, []);

  // Fetch folios
  const fetchFolios = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/folios?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setFolios(result.data);
      }
    } catch (error) {
      console.error('Error fetching folios:', error);
      toast({
        title: 'Error',
        description: t('failedToFetch'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchFolios();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [statusFilter, searchQuery]);

  // Fetch audit trail for folio
  const fetchAuditTrail = async (folioId: string) => {
    setIsLoadingAudit(true);
    try {
      const response = await fetch(`/api/folios/${folioId}/audit`);
      const result = await response.json();
      if (result.success) {
        setAuditEntries(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching audit trail:', error);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // View folio details
  const viewFolioDetails = async (folioId: string) => {
    try {
      const response = await fetch(`/api/folios/${folioId}`);
      const result = await response.json();

      if (result.success) {
        setSelectedFolio(result.data);
        setIsDetailOpen(true);
        fetchAuditTrail(folioId);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load folio details',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching folio details:', error);
    }
  };

  // Create folio
  const handleCreate = async () => {
    if (!createFormData.bookingId) {
      toast({
        title: 'Validation Error',
        description: t('selectBooking'),
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const selectedBooking = bookings.find(b => b.id === createFormData.bookingId);
      
      const response = await fetch('/api/folios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: user?.tenantId,
          bookingId: createFormData.bookingId,
          guestId: selectedBooking?.primaryGuest?.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: t('folioCreated'),
        });
        setIsCreateOpen(false);
        fetchFolios();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create folio',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating folio:', error);
      toast({
        title: 'Error',
        description: 'Failed to create folio',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Add line item
  const handleAddLineItem = async () => {
    if (!selectedFolio || !lineItemFormData.description || !lineItemFormData.unitPrice) {
      toast({
        title: 'Validation Error',
        description: t('fillRequiredFields'),
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Calculate taxes using TaxContext
      const amount = parseFloat(lineItemFormData.unitPrice) * parseInt(lineItemFormData.quantity);
      const taxResult = calculateTax(amount, lineItemFormData.category);
      
      const response = await fetch(`/api/folios/${selectedFolio.id}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: lineItemFormData.description,
          category: lineItemFormData.category,
          quantity: parseInt(lineItemFormData.quantity),
          unitPrice: parseFloat(lineItemFormData.unitPrice),
          taxRate: taxResult.totalTax > 0 ? (taxResult.totalTax / amount) * 100 : 0,
          taxAmount: taxResult.totalTax,
          appliedTaxes: taxResult.taxes.map(t => ({
            taxId: t.tax.id,
            name: t.tax.name,
            rate: t.tax.rate,
            type: t.tax.type,
            amount: t.amount,
          })),
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: t('lineItemAdded'),
        });
        setIsAddItemOpen(false);
        setLineItemFormData({
          description: '',
          category: 'room',
          quantity: '1',
          unitPrice: '',
          useAutoTax: true,
        });
        // Refresh folio details and audit trail
        viewFolioDetails(selectedFolio.id);
        fetchFolios();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to add line item',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error adding line item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add line item',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Remove line item
  const handleRemoveLineItem = async (lineItemId: string) => {
    if (!selectedFolio) return;

    try {
      const response = await fetch(`/api/folios/${selectedFolio.id}/line-items?lineItemId=${lineItemId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: t('lineItemRemoved'),
        });
        // Refresh folio details and audit trail
        viewFolioDetails(selectedFolio.id);
        fetchFolios();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to remove line item',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error removing line item:', error);
    }
  };

  // Split folio
  const openSplitDialog = () => {
    setSplitType('items');
    setSelectedLineItemIds([]);
    setSplitAmount('');
    setTargetGuestId('');
    setIsSplitOpen(true);
    // Fetch guests for target selector
    setIsLoadingGuests(true);
    fetch('/api/guests?limit=200')
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setSplitGuests(result.data);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingGuests(false));
  };

  const handleSplitFolio = async () => {
    if (!selectedFolio) return;

    if (!targetGuestId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a target guest',
        variant: 'destructive',
      });
      return;
    }

    if (splitType === 'items' && selectedLineItemIds.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one line item',
        variant: 'destructive',
      });
      return;
    }

    if (splitType === 'amount' && (!splitAmount || parseFloat(splitAmount) <= 0)) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid split amount',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        targetGuestId,
        splitType,
      };

      if (splitType === 'items') {
        payload.lineItemIds = selectedLineItemIds;
      } else {
        payload.amount = parseFloat(splitAmount);
      }

      const response = await fetch(`/api/folios/${selectedFolio.id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Folio split successfully',
        });
        setIsSplitOpen(false);
        // Refresh current folio details and list
        viewFolioDetails(selectedFolio.id);
        fetchFolios();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to split folio',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error splitting folio:', error);
      toast({
        title: 'Error',
        description: 'Failed to split folio',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleLineItemSelection = (lineItemId: string) => {
    setSelectedLineItemIds(prev =>
      prev.includes(lineItemId)
        ? prev.filter(id => id !== lineItemId)
        : [...prev, lineItemId]
    );
  };

  // Compute split preview
  const splitPreview = useMemo(() => {
    if (!selectedFolio) return null;

    if (splitType === 'items') {
      const selectedItems = (selectedFolio.lineItems || []).filter(item =>
        selectedLineItemIds.includes(item.id)
      );
      const newSubtotal = selectedItems.reduce((sum, item) => sum + item.totalAmount, 0);
      const newTaxes = selectedItems.reduce((sum, item) => sum + item.taxAmount, 0);
      const newTotal = newSubtotal + newTaxes;
      const sourceRemaining = selectedFolio.totalAmount - newTotal;
      return { newSubtotal, newTaxes, newTotal, sourceRemaining };
    }

    const amt = parseFloat(splitAmount) || 0;
    if (amt <= 0) return null;

    const ratio = selectedFolio.totalAmount > 0 ? amt / selectedFolio.totalAmount : 1;
    const newSubtotal = Math.round(selectedFolio.subtotal * ratio * 100) / 100;
    const newTaxes = Math.round(selectedFolio.taxes * ratio * 100) / 100;
    const newTotal = newSubtotal + newTaxes;
    const sourceRemaining = selectedFolio.totalAmount - newTotal;
    return { newSubtotal, newTaxes, newTotal, sourceRemaining };
  }, [selectedFolio, splitType, selectedLineItemIds, splitAmount]);

  // Close folio
  const handleCloseFolio = async (folioId: string) => {
    try {
      const response = await fetch(`/api/folios/${folioId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: t('folioClosed'),
        });
        setIsDetailOpen(false);
        fetchFolios();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to close folio',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error closing folio:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const option = folioStatuses.find(o => o.value === status);
    return (
      <Badge variant="secondary" className={cn('text-white px-2.5 py-0.5 rounded-full text-xs font-medium', option?.color)}>
        {option?.label || status}
      </Badge>
    );
  };

  const getPaymentPercentage = (folio: Folio) => {
    if (folio.totalAmount === 0) return 100;
    return Math.min(100, (folio.paidAmount / folio.totalAmount) * 100);
  };

  // Auto room posting state
  const [autoPostingStatus, setAutoPostingStatus] = useState<{
    lastExecution: { timestamp: string; chargesPosted: number; errorCount: number } | null;
    pendingChargeCount: number;
  } | null>(null);
  const [isPostingCharges, setIsPostingCharges] = useState(false);

  // Fetch auto-posting status
  useEffect(() => {
    const fetchAutoPostingStatus = async () => {
      try {
        const response = await fetch('/api/cron/auto-room-posting');
        const result = await response.json();
        if (result.success) {
          setAutoPostingStatus(result.data);
        }
      } catch (error) {
        console.error('Error fetching auto-posting status:', error);
      }
    };
    fetchAutoPostingStatus();
  }, []);

  // Manual trigger: post room charges now
  const handlePostRoomCharges = async () => {
    setIsPostingCharges(true);
    try {
      // Get the first property from user's tenant
      const propsRes = await fetch('/api/properties?limit=1');
      const propsResult = await propsRes.json();
      if (!propsResult.success || !propsResult.data?.length) {
        toast({
          title: 'Error',
          description: 'No property found for auto-posting',
          variant: 'destructive',
        });
        return;
      }

      const propertyId = propsResult.data[0].id;
      const response = await fetch('/api/cron/auto-room-posting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const result = await response.json();

      if (result.success) {
        const { chargesPosted, bookingsProcessed, errors } = result.data;
        toast({
          title: 'Room Charges Posted',
          description: `${chargesPosted} charge${chargesPosted !== 1 ? 's' : ''} posted across ${bookingsProcessed} booking${bookingsProcessed !== 1 ? 's' : ''}${errors.length > 0 ? ` (${errors.length} warning${errors.length !== 1 ? 's' : ''})` : ''}`,
          variant: errors.length > 0 ? 'default' : 'default',
        });
        // Refresh folios and auto-posting status
        fetchFolios();
        // Re-fetch status
        const statusRes = await fetch('/api/cron/auto-room-posting');
        const statusResult = await statusRes.json();
        if (statusResult.success) {
          setAutoPostingStatus(statusResult.data);
        }
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to post room charges',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error posting room charges:', error);
      toast({
        title: 'Error',
        description: 'Failed to post room charges',
        variant: 'destructive',
      });
    } finally {
      setIsPostingCharges(false);
    }
  };

  // Stats
  const openFolios = folios.filter(f => f.status === 'open').length;
  const totalBalance = folios.reduce((sum, f) => sum + f.balance, 0);
  const totalRevenue = folios.reduce((sum, f) => sum + f.paidAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Folios
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('foliosDesc')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchFolios}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Folio
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <FileText className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent">{folios.length}</div>
              <div className="text-xs text-muted-foreground">{t('totalFolios')}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Receipt className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent">{openFolios}</div>
              <div className="text-xs text-muted-foreground">{t('openFolios')}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <DollarSign className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-red-400 bg-clip-text text-transparent">{formatCurrency(totalBalance)}</div>
              <div className="text-xs text-muted-foreground">Outstanding</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <CreditCard className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-cyan-400 bg-clip-text text-transparent">{formatCurrency(totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">Collected</div>
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
                  placeholder="t('searchFolios')"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatus')}</SelectItem>
                {folioStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Auto Room Posting Status */}
      <Card className="border-dashed border-muted-foreground/20">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
                <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">Auto Room Charge Posting</h3>
                  <Badge variant="outline" className="text-xs font-normal">
                    Automated
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {autoPostingStatus?.lastExecution ? (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last run: {formatDateTime(autoPostingStatus.lastExecution.timestamp)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Not yet run
                    </span>
                  )}
                  {autoPostingStatus?.lastExecution && (
                    <span className="flex items-center gap-1">
                      {autoPostingStatus.lastExecution.errorCount > 0 ? (
                        <AlertCircle className="h-3 w-3 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      )}
                      {autoPostingStatus.lastExecution.chargesPosted} charge{autoPostingStatus.lastExecution.chargesPosted !== 1 ? 's' : ''} posted
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Receipt className="h-3 w-3" />
                    Pending today: {autoPostingStatus?.pendingChargeCount ?? 0}
                  </span>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePostRoomCharges}
              disabled={isPostingCharges}
              className="shrink-0"
            >
              {isPostingCharges ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Post Room Charges Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Folios Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : folios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>{t('noFoliosFound')}</p>
              <p className="text-sm">{t('createFirstFolio')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folios.map((folio) => (
                    <TableRow key={folio.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <div>
                          <p className="font-mono font-medium">{folio.folioNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(folio.createdAt)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {folio.booking?.primaryGuest?.firstName} {folio.booking?.primaryGuest?.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {folio.booking?.primaryGuest?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{folio.booking?.confirmationCode}</p>
                          {folio.booking?.room && (
                            <p className="text-xs text-muted-foreground">Room {folio.booking.room.number}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{formatCurrency(folio.totalAmount)}</span>
                          {folio.currency && folio.currency !== displayCurrency.code && (
                            <Globe2 className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {formatWithConversion(folio.totalAmount, folio.currency, `total-${folio.id}`)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[100px]">
                          <div className="flex justify-between text-sm mb-1">
                            <span>{formatCurrency(folio.paidAmount)}</span>
                            <span className="text-muted-foreground">{getPaymentPercentage(folio).toFixed(0)}%</span>
                          </div>
                          <Progress value={getPaymentPercentage(folio)} className="h-1.5" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          'font-medium',
                          folio.balance > 0
                            ? 'bg-gradient-to-r from-amber-600 to-red-500 bg-clip-text text-transparent'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent'
                        )}>
                          {formatCurrency(folio.balance)}
                        </span>
                        <span className="text-[11px] text-muted-foreground block">
                          {formatWithConversion(folio.balance, folio.currency, `balance-${folio.id}`)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(folio.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewFolioDetails(folio.id)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Folio Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create {t('newFolio')}</DialogTitle>
            <DialogDescription>
              Create a folio for a booking
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bookingId">Booking</Label>
              <Select
                value={createFormData.bookingId}
                onValueChange={(value) => {
                  const booking = bookings.find(b => b.id === value);
                  setCreateFormData(prev => ({
                    ...prev,
                    bookingId: value,
                    guestId: booking?.primaryGuest?.id || '',
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select booking" />
                </SelectTrigger>
                <SelectContent>
                  {bookings.map(booking => (
                    <SelectItem key={booking.id} value={booking.id}>
                      {booking.confirmationCode} - {booking.primaryGuest?.firstName} {booking.primaryGuest?.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {createFormData.bookingId && (
              <Card className="p-4 bg-muted/50">
                {(() => {
                  const booking = bookings.find(b => b.id === createFormData.bookingId);
                  return booking ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{booking.primaryGuest?.firstName} {booking.primaryGuest?.lastName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}</span>
                      </div>
                      {booking.room && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>Room {booking.room.number}</span>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Folio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folio Details Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Folio {selectedFolio?.folioNumber}
            </DialogTitle>
            <DialogDescription>
              {t('viewAndManage')}
            </DialogDescription>
          </DialogHeader>
          {selectedFolio && (
            <Tabs defaultValue="details" className="flex-1 flex flex-col">
              <TabsList className="shrink-0">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="audit" className="flex items-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  Audit
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="flex-1 overflow-y-auto pr-2 -mr-2">
            <div className="space-y-6 mt-4">
              {/* Guest & Booking Info */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Guest</span>
                  </div>
                  <p className="font-medium">
                    {selectedFolio.booking?.primaryGuest?.firstName} {selectedFolio.booking?.primaryGuest?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedFolio.booking?.primaryGuest?.email}
                  </p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Booking</span>
                  </div>
                  <p className="font-medium">{selectedFolio.booking?.confirmationCode}</p>
                  {selectedFolio.booking?.room && (
                    <p className="text-sm text-muted-foreground">Room {selectedFolio.booking.room.number}</p>
                  )}
                </Card>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{t('lineItems')}</h3>
                  {selectedFolio.status === 'open' && (
                    <Button size="sm" onClick={() => setIsAddItemOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Item
                    </Button>
                  )}
                </div>
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('description')}</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        {selectedFolio.status === 'open' && <TableHead></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedFolio.lineItems?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="text-sm">{item.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(item.serviceDate)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {item.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.taxAmount)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.totalAmount)}</TableCell>
                          {selectedFolio.status === 'open' && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-600 dark:text-red-400"
                                onClick={() => handleRemoveLineItem(item.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {(!selectedFolio.lineItems || selectedFolio.lineItems.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={selectedFolio.status === 'open' ? 7 : 6} className="text-center text-muted-foreground">
                            {t('noLineItems')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>

              {/* Totals */}
              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(selectedFolio.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxes</span>
                    <span>{formatCurrency(selectedFolio.taxes)}</span>
                  </div>
                  {selectedFolio.discount > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedFolio.discount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    <span>{formatCurrency(selectedFolio.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-cyan-600 dark:text-cyan-400">
                    <span>Paid</span>
                    <span>{formatCurrency(selectedFolio.paidAmount)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Balance</span>
                    <span className={selectedFolio.balance > 0 ? 'text-amber-600' : 'text-emerald-600 dark:text-emerald-400'}>
                      {formatCurrency(selectedFolio.balance)}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Payments */}
              {selectedFolio.payments && selectedFolio.payments.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Payments</h3>
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedFolio.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{formatDate(payment.createdAt)}</TableCell>
                            <TableCell className="capitalize">{payment.method}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {payment.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(payment.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              )}

              {/* Actions */}
              {(selectedFolio.status === 'open' || selectedFolio.status === 'partially_paid') && (
                <div className="shrink-0 pt-4 flex gap-2">
                  {(selectedFolio.lineItems && selectedFolio.lineItems.length > 0) && (
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={openSplitDialog}
                    >
                      <Scissors className="h-4 w-4 mr-2" />
                      Split Folio
                    </Button>
                  )}
                  {selectedFolio.status === 'open' && selectedFolio.balance === 0 && (
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => handleCloseFolio(selectedFolio.id)}
                    >
                      Close Folio
                    </Button>
                  )}
                </div>
              )}
            </div>
              </TabsContent>

              {/* Audit Tab */}
              <TabsContent value="audit" className="flex-1 overflow-y-auto pr-2 -mr-2">
                <div className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Line Item Audit Trail
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Track all changes to folio line items
                      </p>
                    </div>
                  </div>

                  {isLoadingAudit ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : auditEntries.length === 0 ? (
                    <Card className="p-8">
                      <div className="flex flex-col items-center text-center text-muted-foreground">
                        <Shield className="h-10 w-10 mb-3 opacity-30" />
                        <p className="font-medium">No audit entries yet</p>
                        <p className="text-sm mt-1">Audit entries will appear when line items are added or removed.</p>
                      </div>
                    </Card>
                  ) : (
                    <Card>
                      <ScrollArea className="max-h-96">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[40px]"></TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>User</TableHead>
                              <TableHead>Source</TableHead>
                              <TableHead>Time</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {auditEntries.map((entry) => (
                              <TableRow key={entry.id}>
                                <TableCell>
                                  {entry.action === 'created' ? (
                                    <PlusCircle className="h-4 w-4 text-emerald-500" />
                                  ) : (
                                    <MinusCircle className="h-4 w-4 text-red-500" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  <p className="text-sm font-medium">{entry.description}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {entry.action === 'created' ? 'Added' : 'Removed'}
                                    {entry.quantity ? ` (${entry.quantity}x)` : ''}
                                  </p>
                                </TableCell>
                                <TableCell>
                                  {entry.category && (
                                    <Badge variant="outline" className="capitalize text-xs">
                                      {entry.category}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {entry.amount !== null && entry.amount !== undefined ? (
                                    <span className={cn(
                                      'text-sm font-medium',
                                      entry.action === 'deleted' ? 'text-red-600 dark:text-red-400 line-through' : ''
                                    )}>
                                      {formatCurrency(entry.amount)}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {entry.userName || 'System'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="text-xs capitalize">
                                    {entry.source}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDateTime(entry.createdAt)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Split Folio Dialog */}
      <Dialog open={isSplitOpen} onOpenChange={setIsSplitOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5" />
              Split Folio
            </DialogTitle>
            <DialogDescription>
              Split charges from folio {selectedFolio?.folioNumber} to a new folio for another guest.
            </DialogDescription>
          </DialogHeader>
          {selectedFolio && (
            <div className="grid gap-4 flex-1 overflow-y-auto pr-2 -mr-2">
              {/* Split Type Selector */}
              <div className="space-y-2">
                <Label>Split By</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={splitType === 'items' ? 'default' : 'outline'}
                    size="sm"
                    className="w-full"
                    onClick={() => setSplitType('items')}
                  >
                    Selected Items
                  </Button>
                  <Button
                    type="button"
                    variant={splitType === 'amount' ? 'default' : 'outline'}
                    size="sm"
                    className="w-full"
                    onClick={() => setSplitType('amount')}
                  >
                    Custom Amount
                  </Button>
                </div>
              </div>

              {/* Split Content based on type */}
              {splitType === 'items' ? (
                <div className="space-y-2">
                  <Label>Select Line Items to Move</Label>
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {(!selectedFolio.lineItems || selectedFolio.lineItems.length === 0) ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No line items available to split.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {selectedFolio.lineItems.map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={selectedLineItemIds.includes(item.id)}
                              onCheckedChange={() => toggleLineItemSelection(item.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.description}</p>
                              <p className="text-xs text-muted-foreground">
                                <Badge variant="outline" className="capitalize text-xs mr-1">{item.category}</Badge>
                                {formatDate(item.serviceDate)}
                              </p>
                            </div>
                            <span className="text-sm font-medium whitespace-nowrap">
                              {formatCurrency(item.totalAmount + item.taxAmount)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedLineItemIds.length > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{selectedLineItemIds.length} item(s) selected</span>
                      <span>
                        Select All
                        <Checkbox
                          className="ml-1 inline-block align-middle"
                          checked={selectedFolio.lineItems && selectedLineItemIds.length === selectedFolio.lineItems.length}
                          onCheckedChange={(checked) => {
                            if (checked && selectedFolio.lineItems) {
                              setSelectedLineItemIds(selectedFolio.lineItems.map(item => item.id));
                            } else {
                              setSelectedLineItemIds([]);
                            }
                          }}
                        />
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="splitAmount">Split Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {selectedFolio.currency || 'USD'}
                    </span>
                    <Input
                      id="splitAmount"
                      type="number"
                      min="0.01"
                      max={selectedFolio.totalAmount - selectedFolio.paidAmount}
                      step="0.01"
                      placeholder="0.00"
                      value={splitAmount}
                      onChange={(e) => setSplitAmount(e.target.value)}
                      className="pl-16"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Remaining balance: {formatCurrency(Math.max(0, selectedFolio.totalAmount - selectedFolio.paidAmount))}
                  </p>
                </div>
              )}

              {/* Target Guest Selector */}
              <div className="space-y-2">
                <Label htmlFor="targetGuest">Target Guest</Label>
                {isLoadingGuests ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading guests...
                  </div>
                ) : (
                  <Select value={targetGuestId} onValueChange={setTargetGuestId}>
                    <SelectTrigger id="targetGuest">
                      <SelectValue placeholder="Select target guest" />
                    </SelectTrigger>
                    <SelectContent>
                      {splitGuests.filter(g => g.id !== selectedFolio.booking?.primaryGuest?.id).map((guest) => (
                        <SelectItem key={guest.id} value={guest.id}>
                          {guest.firstName} {guest.lastName}
                          {guest.email && <span className="text-muted-foreground ml-1">({guest.email})</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Separator />

              {/* Split Preview */}
              {splitPreview && (
                <Card className="p-4 bg-muted/50">
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                    <ArrowRightLeft className="h-4 w-4" />
                    Split Preview
                  </h4>
                  <div className="space-y-3">
                    {/* Source Folio Remaining */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Source Folio (Remaining)</p>
                      <div className="flex justify-between text-sm">
                        <span>{selectedFolio.folioNumber}</span>
                        <span className="font-medium">
                          {formatCurrency(Math.max(0, splitPreview.sourceRemaining))}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {/* New Folio */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">New Folio (Will be created)</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>{formatCurrency(splitPreview.newSubtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Taxes</span>
                          <span>{formatCurrency(splitPreview.newTaxes)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-semibold">
                          <span>New Folio Total</span>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(splitPreview.newTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSplitOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSplitFolio}
              disabled={isSaving || !targetGuestId || (splitType === 'items' && selectedLineItemIds.length === 0) || (splitType === 'amount' && (!splitAmount || parseFloat(splitAmount) <= 0))}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Scissors className="h-4 w-4 mr-2" />
              Split Folio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Line Item Dialog */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('addLineItem')}</DialogTitle>
            <DialogDescription>
              {t('addLineItemDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="description">{t('description')}</Label>
              <Input
                id="description"
                placeholder="e.g., Room Service"
                value={lineItemFormData.description}
                onChange={(e) => setLineItemFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={lineItemFormData.category}
                onValueChange={(value) => setLineItemFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {lineItemCategories.map(cat => (
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
                  value={lineItemFormData.quantity}
                  onChange={(e) => setLineItemFormData(prev => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitPrice">Unit Price</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={lineItemFormData.unitPrice}
                  onChange={(e) => setLineItemFormData(prev => ({ ...prev, unitPrice: e.target.value }))}
                />
              </div>
            </div>
            
            {/* Applicable Taxes Display */}
            {applicableTaxes.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Applicable Taxes (Auto-applied)
                </Label>
                <div className="flex flex-wrap gap-2">
                  {applicableTaxes.map(tax => (
                    <Badge key={tax.id} variant={tax.enabled ? "default" : "secondary"} className="text-xs">
                      {tax.name} ({formatTaxRate(tax)})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Tax Calculation Preview */}
            {taxPreview && (
              <Card className="p-4 bg-muted/50">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(taxPreview.subtotal)}</span>
                  </div>
                  {taxPreview.taxes.map((t, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t.tax.name}:</span>
                      <span>{formatCurrency(t.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-medium border-t pt-2">
                    <span>Total Tax:</span>
                    <span className="text-amber-600 dark:text-amber-400">{formatCurrency(taxPreview.totalTax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(taxPreview.total)}</span>
                  </div>
                </div>
              </Card>
            )}
            
            {lineItemFormData.unitPrice && !taxPreview && (
              <Card className="p-4 bg-muted/50">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Line Total:</span>
                  <span className="font-bold">
                    {formatCurrency(parseFloat(lineItemFormData.unitPrice) * parseInt(lineItemFormData.quantity || '1'))}
                  </span>
                </div>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLineItem} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
