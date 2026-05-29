'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  Building2,
  Users,
  Search,
  Loader2,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  RefreshCw,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  X,
  Eye,
  Banknote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';

// --- Types ---
interface TravelAgent {
  id: string;
  agencyName: string;
  code: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  commissionRate: number;
  commissionType: string;
  creditLimit: number;
  currentBalance: number;
  paymentTerms: string;
  status: string;
  isActive: boolean;
  property?: { id: string; name: string } | null;
  _count?: { invoices: number };
  createdAt: string;
}

interface CityLedgerItem {
  id: string;
  description: string;
  amount: number;
  quantity: number;
  folioId?: string | null;
}

interface CityLedgerInvoice {
  id: string;
  invoiceNumber: string;
  accountName: string;
  accountType: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  tax: number;
  total: number;
  paidAmount: number;
  currency: string;
  status: string;
  notes?: string | null;
  travelAgent?: { id: string; agencyName: string; code: string } | null;
  property?: { id: string; name: string } | null;
  items?: CityLedgerItem[];
  _count?: { items: number; payments: number };
  createdAt: string;
}

interface LedgerAggregates {
  totalOutstanding: number;
  totalInvoiced: number;
  totalPaid: number;
}

interface Property {
  id: string;
  name: string;
}

const PAYMENT_TERMS = [
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_45', label: 'Net 45' },
  { value: 'net_60', label: 'Net 60' },
];

const INVOICE_STATUSES: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  sent: { label: 'Sent', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  partial: { label: 'Partial', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  paid: { label: 'Paid', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  overdue: { label: 'Overdue', color: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-50 text-gray-500 border-gray-200' },
};

export default function CityLedgerPage() {
  const { toast } = useToast();
  const t = useTranslations('billing');

  // Shared state
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  // Travel agents
  const [agents, setAgents] = useState<TravelAgent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const [agentStatusFilter, setAgentStatusFilter] = useState('all');

  // City ledger
  const [invoices, setInvoices] = useState<CityLedgerInvoice[]>([]);
  const [ledgerAggs, setLedgerAggs] = useState<LedgerAggregates | null>(null);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [invoiceSearch, setInvoiceSearch] = useState('');

  // Dialogs
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<CityLedgerInvoice | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Agent form
  const [agentForm, setAgentForm] = useState({
    agencyName: '',
    code: '',
    contactPerson: '',
    email: '',
    phone: '',
    commissionRate: '10',
    commissionType: 'percentage',
    creditLimit: '5000',
    paymentTerms: 'net_30',
    status: 'active',
    notes: '',
  });

  // Invoice form
  const [invoiceForm, setInvoiceForm] = useState({
    accountName: '',
    accountType: 'travel_agent' as string,
    travelAgentId: '',
    invoiceNumber: '',
    invoiceDate: '',
    dueDate: '',
    currency: 'USD',
    notes: '',
  });

  const [lineItems, setLineItems] = useState<{ description: string; amount: string; quantity: string; folioId: string }[]>([
    { description: '', amount: '', quantity: '1', folioId: '' },
  ]);

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'bank_transfer',
    reference: '',
    paidAt: '',
  });

  // Fetch properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch('/api/properties');
        const result = await res.json();
        if (result.success) {
          setProperties(result.data);
          if (result.data.length > 0) {
            setSelectedPropertyId(result.data[0].id);
          }
        }
      } catch {
        toast({ title: t('clError'), description: t('clFailedToFetchProperties'), variant: 'destructive' });
      }
    };
    fetchProperties();
  }, [toast]);

  // Fetch travel agents
  const fetchAgents = useCallback(async () => {
    if (!selectedPropertyId) return;
    setIsLoadingAgents(true);
    try {
      const params = new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' });
      if (agentStatusFilter !== 'all') params.set('status', agentStatusFilter);
      if (agentSearch) params.set('search', agentSearch);
      const res = await fetch(`/api/travel-agents?${params}`);
      const result = await res.json();
      if (result.success) setAgents(result.data || []);
    } catch {
      toast({ title: t('clError'), description: t('clFailedToFetchAgents'), variant: 'destructive' });
    } finally {
      setIsLoadingAgents(false);
    }
  }, [selectedPropertyId, agentStatusFilter, agentSearch, toast]);

  // Fetch city ledger
  const fetchInvoices = useCallback(async () => {
    if (!selectedPropertyId) return;
    setIsLoadingInvoices(true);
    try {
      const params = new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' });
      if (invoiceStatusFilter !== 'all') params.set('status', invoiceStatusFilter);
      if (invoiceSearch) params.set('search', invoiceSearch);
      const res = await fetch(`/api/city-ledger?${params}`);
      const result = await res.json();
      if (result.success) {
        setInvoices(result.data || []);
        setLedgerAggs(result.aggregates || null);
      }
    } catch {
      toast({ title: t('clError'), description: t('clFailedToFetchLedger'), variant: 'destructive' });
    } finally {
      setIsLoadingInvoices(false);
    }
  }, [selectedPropertyId, invoiceStatusFilter, invoiceSearch, toast]);

  useEffect(() => {
    if (!selectedPropertyId) return;
    (async () => {
      setIsLoadingAgents(true);
      try {
        const params = new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' });
        if (agentStatusFilter !== 'all') params.set('status', agentStatusFilter);
        const res = await fetch(`/api/travel-agents?${params}`);
        const result = await res.json();
        if (result.success) setAgents(result.data || []);
      } catch {
        toast({ title: t('clError'), description: t('clFailedToFetchAgents'), variant: 'destructive' });
      } finally {
        setIsLoadingAgents(false);
      }
    })();
  }, [selectedPropertyId, agentStatusFilter, toast]);

  useEffect(() => {
    if (!selectedPropertyId) return;
    (async () => {
      setIsLoadingInvoices(true);
      try {
        const params = new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' });
        if (invoiceStatusFilter !== 'all') params.set('status', invoiceStatusFilter);
        const res = await fetch(`/api/city-ledger?${params}`);
        const result = await res.json();
        if (result.success) {
          setInvoices(result.data || []);
          setLedgerAggs(result.aggregates || null);
        }
      } catch {
        toast({ title: t('clError'), description: t('clFailedToFetchLedger'), variant: 'destructive' });
      } finally {
        setIsLoadingInvoices(false);
      }
    })();
  }, [selectedPropertyId, invoiceStatusFilter, toast]);

  // Debounced search for agents
  useEffect(() => {
    const t = setTimeout(() => {
      if (agentSearch.length >= 2 || agentSearch.length === 0) fetchAgents();
    }, 400);
    return () => clearTimeout(t);
  }, [agentSearch, fetchAgents]);

  // Debounced search for invoices
  useEffect(() => {
    const t = setTimeout(() => {
      if (invoiceSearch.length >= 2 || invoiceSearch.length === 0) fetchInvoices();
    }, 400);
    return () => clearTimeout(t);
  }, [invoiceSearch, fetchInvoices]);

  // --- Agent CRUD ---
  const handleCreateAgent = async () => {
    if (!agentForm.agencyName.trim() || !agentForm.code.trim() || !selectedPropertyId) {
      toast({ title: t('clValidation'), description: t('clAgentFieldsRequired'), variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/travel-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...agentForm,
          propertyId: selectedPropertyId,
          commissionRate: parseFloat(agentForm.commissionRate) || 0,
          creditLimit: parseFloat(agentForm.creditLimit) || 0,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: t('clSuccess'), description: t('clAgentCreated') });
        setIsAgentDialogOpen(false);
        resetAgentForm();
        fetchAgents();
      } else {
        toast({ title: t('clError'), description: result.error || t('clFailedToCreateAgent'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('clError'), description: t('clFailedToCreateAgent'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    setActionLoading(`del-agent-${id}`);
    try {
      const res = await fetch(`/api/travel-agents/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: t('clDeleted'), description: t('clAgentDeleted') });
        fetchAgents();
      } else {
        toast({ title: t('clError'), description: result.error || t('clDeleteFailed'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('clError'), description: t('clFailedToDeleteAgent'), variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const resetAgentForm = () => {
    setAgentForm({
      agencyName: '', code: '', contactPerson: '', email: '', phone: '',
      commissionRate: '10', commissionType: 'percentage', creditLimit: '5000',
      paymentTerms: 'net_30', status: 'active', notes: '',
    });
  };

  // --- Invoice CRUD ---
  const addLineItem = () => setLineItems(prev => [...prev, { description: '', amount: '', quantity: '1', folioId: '' }]);
  const removeLineItem = (idx: number) => setLineItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const handleCreateInvoice = async () => {
    if (!invoiceForm.accountName.trim() || !invoiceForm.invoiceNumber.trim() || !invoiceForm.invoiceDate || !invoiceForm.dueDate || !selectedPropertyId) {
      toast({ title: t('clValidation'), description: t('clInvoiceFieldsRequired'), variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const items = lineItems
        .filter(i => i.description.trim() && parseFloat(i.amount) > 0)
        .map(i => ({ description: i.description, amount: parseFloat(i.amount) || 0, quantity: parseInt(i.quantity) || 1, folioId: i.folioId || undefined }));

      const res = await fetch('/api/city-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...invoiceForm, propertyId: selectedPropertyId, items }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: t('clSuccess'), description: t('clInvoiceCreated') });
        setIsInvoiceDialogOpen(false);
        resetInvoiceForm();
        fetchInvoices();
      } else {
        toast({ title: t('clError'), description: result.error || t('clFailedToCreateInvoice'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('clError'), description: t('clFailedToCreateInvoice'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetInvoiceForm = () => {
    setInvoiceForm({ accountName: '', accountType: 'travel_agent', travelAgentId: '', invoiceNumber: '', invoiceDate: '', dueDate: '', currency: 'USD', notes: '' });
    setLineItems([{ description: '', amount: '', quantity: '1', folioId: '' }]);
  };

  // --- Record Payment ---
  const openPaymentDialog = (inv: CityLedgerInvoice) => {
    setSelectedInvoice(inv);
    setPaymentForm({ amount: ((inv.total - inv.paidAmount) || 0).toFixed(2), paymentMethod: 'bank_transfer', reference: '', paidAt: '' });
    setIsPaymentDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice || parseFloat(paymentForm.amount) <= 0) {
      toast({ title: t('clValidation'), description: t('clPaymentAmountMustBePositive'), variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/city-ledger/${selectedInvoice.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(paymentForm.amount),
          paymentMethod: paymentForm.paymentMethod,
          reference: paymentForm.reference,
          paidAt: paymentForm.paidAt || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: t('clPaymentRecorded'), description: `Payment of $${paymentForm.amount} recorded` });
        setIsPaymentDialogOpen(false);
        fetchInvoices();
      } else {
        toast({ title: t('clError'), description: result.error || t('clPaymentFailed'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('clError'), description: t('clFailedToRecordPayment'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Status transitions ---
  const updateInvoiceStatus = async (id: string, status: string) => {
    setActionLoading(`status-${id}`);
    try {
      const res = await fetch(`/api/city-ledger/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: t('clUpdated'), description: `${t('clStatusChanged')} ${status}` });
        fetchInvoices();
      } else {
        toast({ title: t('clError'), description: result.error || t('clStatusUpdateFailed'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('clError'), description: t('clFailedToUpdateStatus'), variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount: number) => `$${(amount || 0).toFixed(2)}`;

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = INVOICE_STATUSES[status] || INVOICE_STATUSES.draft;
    return (
      <Badge variant="outline" className={cn('border font-medium', cfg.color)}>
        {cfg.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t('clTitle')}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t('clDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:w-48 h-10">
              <SelectValue placeholder={t('clSelectProperty')} />
            </SelectTrigger>
            <SelectContent>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="travel-agents" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="travel-agents" className="gap-1.5">
            <Users className="h-4 w-4" /> {t('clTabTravelAgents')}
          </TabsTrigger>
          <TabsTrigger value="city-ledger" className="gap-1.5">
            <FileText className="h-4 w-4" /> {t('clTabCityLedger')}
          </TabsTrigger>
        </TabsList>

        {/* ========== TRAVEL AGENTS TAB ========== */}
        <TabsContent value="travel-agents" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t('clSearchAgents')} value={agentSearch} onChange={e => setAgentSearch(e.target.value)} className="pl-9 h-10" />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={agentStatusFilter} onValueChange={setAgentStatusFilter}>
                <SelectTrigger className="w-full sm:w-36 h-10"><SelectValue placeholder={t('clAllStatus')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('clAllStatus')}</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => { resetAgentForm(); setIsAgentDialogOpen(true); }} className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 transition-all">
                <Plus className="h-4 w-4 mr-1.5" />{t('clAddAgent')}
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingAgents ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Users className="h-12 w-12 mb-3 opacity-30" />
                  <p className="font-medium">{t('clNoAgentsFound')}</p>
                  <Button className="mt-4" onClick={() => { resetAgentForm(); setIsAgentDialogOpen(true); }}><Plus className="h-4 w-4 mr-1.5" />{t('clAddAgent')}</Button>
                </div>
              ) : (
                <div className="hidden md:block">
                  <ScrollArea className="max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('clHeaderAgency')}</TableHead>
                          <TableHead>{t('clHeaderCode')}</TableHead>
                          <TableHead>{t('clHeaderContact')}</TableHead>
                          <TableHead className="text-right">{t('clHeaderCommission')}</TableHead>
                          <TableHead className="text-right">{t('clHeaderCreditLimit')}</TableHead>
                          <TableHead className="text-right">{t('clHeaderBalance')}</TableHead>
                          <TableHead>{t('clHeaderTerms')}</TableHead>
                          <TableHead>{t('clHeaderStatus')}</TableHead>
                          <TableHead className="text-right">{t('clHeaderActions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agents.map(agent => (
                          <TableRow key={agent.id}>
                            <TableCell>
                              <p className="font-medium text-sm">{agent.agencyName}</p>
                              {agent.email && <p className="text-xs text-muted-foreground">{agent.email}</p>}
                            </TableCell>
                            <TableCell><Badge variant="outline" className="font-mono">{agent.code}</Badge></TableCell>
                            <TableCell>
                              <p className="text-sm">{agent.contactPerson || '—'}</p>
                              {agent.phone && <p className="text-xs text-muted-foreground">{agent.phone}</p>}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {agent.commissionType === 'percentage' ? `${agent.commissionRate}%` : formatCurrency(agent.commissionRate)}
                            </TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(agent.creditLimit)}</TableCell>
                            <TableCell className={cn('text-right text-sm font-medium', agent.currentBalance > agent.creditLimit * 0.8 ? 'text-red-600 dark:text-red-400' : '')}>
                              {formatCurrency(agent.currentBalance)}
                            </TableCell>
                            <TableCell className="text-sm">{PAYMENT_TERMS.find(t => t.value === agent.paymentTerms)?.label || agent.paymentTerms}</TableCell>
                            <TableCell>
                              <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className={cn(agent.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : '')}>
                                {agent.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!!actionLoading?.startsWith('del-agent')}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => handleDeleteAgent(agent.id)} className="text-red-600 dark:text-red-400">
                                    <Trash2 className="h-4 w-4 mr-2" />{t('clDelete')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border">
                {agents.map(agent => (
                  <div key={agent.id} className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">{agent.agencyName}</p>
                        <p className="text-xs text-muted-foreground">{agent.contactPerson} • {agent.email || '—'}</p>
                      </div>
                      <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>{agent.status}</Badge>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{t('clMobileCode')} <Badge variant="outline" className="font-mono ml-1">{agent.code}</Badge></span>
                      <span>{t('clMobileComm')} {agent.commissionType === 'percentage' ? `${agent.commissionRate}%` : formatCurrency(agent.commissionRate)}</span>
                      <span>{t('clMobileBalance')} <span className="font-medium text-foreground">{formatCurrency(agent.currentBalance)}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== CITY LEDGER TAB ========== */}
        <TabsContent value="city-ledger" className="space-y-4">
          {/* Stats Cards */}
          {ledgerAggs && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <Card className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 shrink-0"><AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" /></div>
                  <div className="min-w-0">
                    <div className="text-base sm:text-xl font-bold truncate">{formatCurrency(ledgerAggs.totalOutstanding)}</div>
                    <div className="text-xs text-muted-foreground">{t('clOutstanding')}</div>
                  </div>
                </div>
              </Card>
              <Card className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10 shrink-0"><Clock className="h-4 w-4 text-red-600 dark:text-red-400" /></div>
                  <div className="min-w-0">
                    <div className="text-base sm:text-xl font-bold truncate">{formatCurrency(ledgerAggs.totalOutstanding)}</div>
                    <div className="text-xs text-muted-foreground">{t('clOverdue')}</div>
                  </div>
                </div>
              </Card>
              <Card className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0"><CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
                  <div className="min-w-0">
                    <div className="text-base sm:text-xl font-bold truncate">{formatCurrency(ledgerAggs.totalPaid)}</div>
                    <div className="text-xs text-muted-foreground">{t('clTotalPaid')}</div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Filters + Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t('clSearchInvoices')} value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} className="pl-9 h-10" />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                <SelectTrigger className="w-full sm:w-40 h-10"><SelectValue placeholder={t('clAllStatus')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('clAllStatus')}</SelectItem>
                  {Object.entries(INVOICE_STATUSES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => { resetInvoiceForm(); setIsInvoiceDialogOpen(true); }} className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 transition-all">
                <Plus className="h-4 w-4 mr-1.5" />{t('clCreateInvoice')}
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingInvoices ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-3 opacity-30" />
                  <p className="font-medium">{t('clNoInvoicesFound')}</p>
                  <Button className="mt-4" onClick={() => { resetInvoiceForm(); setIsInvoiceDialogOpen(true); }}><Plus className="h-4 w-4 mr-1.5" />{t('clCreateInvoice')}</Button>
                </div>
              ) : (
                <div className="hidden md:block">
                  <ScrollArea className="max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('clHeaderInvoiceNum')}</TableHead>
                          <TableHead>{t('clHeaderAccount')}</TableHead>
                          <TableHead>{t('clHeaderType')}</TableHead>
                          <TableHead className="text-right">{t('clHeaderAmount')}</TableHead>
                          <TableHead>{t('clHeaderDueDate')}</TableHead>
                          <TableHead>{t('clHeaderStatus')}</TableHead>
                          <TableHead className="text-right">{t('clHeaderPaid')}</TableHead>
                          <TableHead className="text-right">{t('clHeaderActions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map(inv => (
                          <TableRow key={inv.id}>
                            <TableCell><p className="font-mono font-medium text-sm">{inv.invoiceNumber}</p></TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">{inv.accountName}</p>
                              {inv.travelAgent && <p className="text-xs text-muted-foreground">{inv.travelAgent.agencyName}</p>}
                            </TableCell>
                            <TableCell><Badge variant="outline">{inv.accountType.replace('_', ' ')}</Badge></TableCell>
                            <TableCell className="text-right font-semibold text-sm">{formatCurrency(inv.total)}</TableCell>
                            <TableCell className="text-sm">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</TableCell>
                            <TableCell><StatusBadge status={inv.status} /></TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(inv.paidAmount)}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!!actionLoading?.startsWith('status-')}>
                                    {actionLoading === `status-${inv.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {!['paid', 'cancelled'].includes(inv.status) && (
                                    <>
                                      <DropdownMenuItem onClick={() => updateInvoiceStatus(inv.id, 'sent')}><FileText className="h-4 w-4 mr-2" />{t('clMarkSent')}</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openPaymentDialog(inv)}><CreditCard className="h-4 w-4 mr-2" />{t('clRecordPayment')}</DropdownMenuItem>
                                      <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => openPaymentDialog(inv)}><CreditCard className="h-4 w-4 mr-2" />{t('clRecordPayment')}</DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </>
                                  )}
                                  {inv.status === 'draft' && (
                                    <DropdownMenuItem onClick={() => updateInvoiceStatus(inv.id, 'cancelled')} className="text-red-600 dark:text-red-400">
                                      <X className="h-4 w-4 mr-2" />{t('clCancel')}
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border">
                {invoices.map(inv => (
                  <div key={inv.id} className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-mono font-semibold text-sm">{inv.invoiceNumber}</p>
                        <p className="text-sm text-muted-foreground">{inv.accountName}</p>
                      </div>
                      <StatusBadge status={inv.status} />
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{t('clMobileTotal')} <span className="font-medium text-foreground">{formatCurrency(inv.total)}</span></span>
                      <span>{t('clMobilePaid')} <span className="font-medium text-foreground">{formatCurrency(inv.paidAmount)}</span></span>
                    </div>
                    {!['paid', 'cancelled'].includes(inv.status) && (
                      <Button size="sm" variant="outline" className="w-full h-9" onClick={() => openPaymentDialog(inv)}>
                        <CreditCard className="h-3.5 w-3.5 mr-1.5" />{t('clRecordPayment')}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========== ADD AGENT DIALOG ========== */}
      <Dialog open={isAgentDialogOpen} onOpenChange={open => { if (!open) resetAgentForm(); setIsAgentDialogOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('clAddAgentTitle')}</DialogTitle>
            <DialogDescription>{t('clAddAgentDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{t('clLabelAgencyName')}</Label><Input value={agentForm.agencyName} onChange={e => setAgentForm(p => ({ ...p, agencyName: e.target.value }))} placeholder={t('clPlaceholderAgencyName')} /></div>
              <div className="space-y-1.5"><Label>{t('clLabelCode')}</Label><Input value={agentForm.code} onChange={e => setAgentForm(p => ({ ...p, code: e.target.value }))} placeholder={t('clPlaceholderCode')} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{t('clLabelContactPerson')}</Label><Input value={agentForm.contactPerson} onChange={e => setAgentForm(p => ({ ...p, contactPerson: e.target.value }))} placeholder={t('clPlaceholderContactPerson')} /></div>
              <div className="space-y-1.5"><Label>{t('clLabelEmail')}</Label><Input type="email" value={agentForm.email} onChange={e => setAgentForm(p => ({ ...p, email: e.target.value }))} placeholder={t('clPlaceholderEmail')} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{t('clLabelPhone')}</Label><Input value={agentForm.phone} onChange={e => setAgentForm(p => ({ ...p, phone: e.target.value }))} placeholder={t('clPlaceholderPhone')} /></div>
              <div className="space-y-1.5">
                <Label>{t('clLabelCommission')}</Label>
                <div className="flex gap-2">
                  <Input type="number" value={agentForm.commissionRate} onChange={e => setAgentForm(p => ({ ...p, commissionRate: e.target.value }))} className="flex-1" />
                  <Select value={agentForm.commissionType} onValueChange={v => setAgentForm(p => ({ ...p, commissionType: v }))}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">{t('clPercent')}</SelectItem>
                      <SelectItem value="flat">{t('clFlat')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{t('clLabelCreditLimit')}</Label><Input type="number" value={agentForm.creditLimit} onChange={e => setAgentForm(p => ({ ...p, creditLimit: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label>{t('clLabelPaymentTerms')}</Label>
                <Select value={agentForm.paymentTerms} onValueChange={v => setAgentForm(p => ({ ...p, paymentTerms: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_TERMS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>{t('clLabelStatus')}</Label>
              <Select value={agentForm.status} onValueChange={v => setAgentForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{t('clLabelNotes')}</Label><Textarea value={agentForm.notes} onChange={e => setAgentForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAgentDialogOpen(false)}>{t('clCancel')}</Button>
            <Button onClick={handleCreateAgent} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}{t('clCreateAgent')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== CREATE INVOICE DIALOG ========== */}
      <Dialog open={isInvoiceDialogOpen} onOpenChange={open => { if (!open) resetInvoiceForm(); setIsInvoiceDialogOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('clCreateInvoiceTitle')}</DialogTitle>
            <DialogDescription>{t('clCreateInvoiceDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{t('clLabelInvoiceNumber')}</Label><Input value={invoiceForm.invoiceNumber} onChange={e => setInvoiceForm(p => ({ ...p, invoiceNumber: e.target.value }))} placeholder={t('clPlaceholderInvoiceNumber')} /></div>
              <div className="space-y-1.5">
                <Label>{t('clLabelAccountType')}</Label>
                <Select value={invoiceForm.accountType} onValueChange={v => setInvoiceForm(p => ({ ...p, accountType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="travel_agent">{t('clTravelAgent')}</SelectItem>
                    <SelectItem value="corporate">{t('clCorporate')}</SelectItem>
                    <SelectItem value="direct_bill">{t('clDirectBill')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>{t('clLabelAccountName')}</Label><Input value={invoiceForm.accountName} onChange={e => setInvoiceForm(p => ({ ...p, accountName: e.target.value }))} placeholder={t('clPlaceholderAccountName')} /></div>
            {invoiceForm.accountType === 'travel_agent' && (
              <div className="space-y-1.5">
                <Label>{t('clLabelLinkTravelAgent')}</Label>
                <Select value={invoiceForm.travelAgentId} onValueChange={v => setInvoiceForm(p => ({ ...p, travelAgentId: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('clSelectAgent')} /></SelectTrigger>
                  <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.agencyName} ({a.code})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{t('clLabelInvoiceDate')}</Label><Input type="date" value={invoiceForm.invoiceDate} onChange={e => setInvoiceForm(p => ({ ...p, invoiceDate: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>{t('clLabelDueDate')}</Label><Input type="date" value={invoiceForm.dueDate} onChange={e => setInvoiceForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
            </div>

            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">{t('clLabelLineItems')}</Label>
                <Button variant="ghost" size="sm" onClick={addLineItem} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />{t('clAddItem')}</Button>
              </div>
              <div className="space-y-2">
                {lineItems.map((item, idx) => (
                  <Card key={idx} className="p-3">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-12 sm:col-span-5 space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('clLabelItemDescription')}</Label>
                        <Input placeholder={t('clPlaceholderItemDescription')} value={item.description} onChange={e => { const ni = [...lineItems]; ni[idx] = { ...ni[idx], description: e.target.value }; setLineItems(ni); }} className="h-9 text-sm" />
                      </div>
                      <div className="col-span-4 sm:col-span-2 space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('clLabelItemAmount')}</Label>
                        <Input type="number" placeholder="0.00" value={item.amount} onChange={e => { const ni = [...lineItems]; ni[idx] = { ...ni[idx], amount: e.target.value }; setLineItems(ni); }} className="h-9 text-sm" />
                      </div>
                      <div className="col-span-3 sm:col-span-2 space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('clLabelQty')}</Label>
                        <Input type="number" min="1" value={item.quantity} onChange={e => { const ni = [...lineItems]; ni[idx] = { ...ni[idx], quantity: e.target.value }; setLineItems(ni); }} className="h-9 text-sm" />
                      </div>
                      <div className="col-span-3 sm:col-span-2 space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('clLabelFolioId')}</Label>
                        <Input placeholder={t('clPlaceholderOptional')} value={item.folioId} onChange={e => { const ni = [...lineItems]; ni[idx] = { ...ni[idx], folioId: e.target.value }; setLineItems(ni); }} className="h-9 text-sm" />
                      </div>
                      <div className="col-span-1 flex items-end justify-center">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-red-500" onClick={() => removeLineItem(idx)} disabled={lineItems.length === 1}><X className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="flex justify-end mt-1">
                      <span className="text-xs text-muted-foreground">
                        {t('clLineTotal')} {formatCurrency((parseFloat(item.amount) || 0) * (parseInt(item.quantity) || 1))}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
            <Card className="p-4 bg-muted/30">
              <div className="flex justify-end space-y-1 max-w-[200px] ml-auto">
                <div className="flex justify-between text-sm w-full"><span>{t('clSubtotal')}</span><span className="font-medium">{formatCurrency(lineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0) * (parseInt(i.quantity) || 1), 0))}</span></div>
              </div>
            </Card>
            <div className="space-y-1.5"><Label>{t('clLabelNotes')}</Label><Textarea value={invoiceForm.notes} onChange={e => setInvoiceForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>{t('clCancel')}</Button>
            <Button onClick={handleCreateInvoice} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}{t('clCreateInvoice')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== RECORD PAYMENT DIALOG ========== */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('clRecordPaymentTitle')}</DialogTitle>
            <DialogDescription>
              {t('clInvoice')}: {selectedInvoice?.invoiceNumber} • {t('clOutstandingLabel')}: {formatCurrency((selectedInvoice?.total || 0) - (selectedInvoice?.paidAmount || 0))}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5"><Label>{t('clLabelPaymentAmount')}</Label><Input type="number" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>{t('clLabelPaymentMethod')}</Label>
              <Select value={paymentForm.paymentMethod} onValueChange={v => setPaymentForm(p => ({ ...p, paymentMethod: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">{t('clBankTransfer')}</SelectItem>
                  <SelectItem value="cash">{t('clCash')}</SelectItem>
                  <SelectItem value="credit_card">{t('clCreditCard')}</SelectItem>
                  <SelectItem value="check">{t('clCheck')}</SelectItem>
                  <SelectItem value="other">{t('clOther')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{t('clLabelReference')}</Label><Input value={paymentForm.reference} onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))} placeholder={t('clPlaceholderReference')} /></div>
            <div className="space-y-1.5"><Label>{t('clLabelPaymentDate')}</Label><Input type="date" value={paymentForm.paidAt} onChange={e => setPaymentForm(p => ({ ...p, paidAt: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>{t('clCancel')}</Button>
            <Button onClick={handleRecordPayment} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Banknote className="h-4 w-4 mr-1.5" />}{t('clRecordPayment')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
