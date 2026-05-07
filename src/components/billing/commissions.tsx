'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Percent,
  FileText,
  Search,
  Loader2,
  Plus,
  MoreHorizontal,
  RefreshCw,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Ban,
  ArrowRight,
  CalendarDays,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// --- Types ---
interface CommissionRule {
  id: string;
  propertyId: string;
  name: string;
  description?: string | null;
  sourceType: string;
  sourceId?: string | null;
  commissionType: string;
  rate: number;
  fixedAmount: number;
  minAmount: number;
  maxAmount?: number | null;
  isActive: boolean;
  validFrom: string;
  validUntil?: string | null;
  property?: { id: string; name: string } | null;
  _count?: { records: number };
  createdAt: string;
}

interface CommissionRecord {
  id: string;
  propertyId: string;
  ruleId: string;
  bookingId: string;
  sourceType: string;
  sourceName?: string | null;
  bookingAmount: number;
  commissionAmount: number;
  status: string;
  invoicedAt?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  rule?: { id: string; name: string; sourceType: string; commissionType: string; rate: number };
  booking?: { id: string; confirmationCode: string; totalAmount: number; status: string; primaryGuest?: { id: string; firstName: string; lastName: string } | null };
  property?: { id: string; name: string } | null;
  createdAt: string;
}

interface Property {
  id: string;
  name: string;
}

const SOURCE_TYPES = [
  { value: 'ota', label: 'OTA' },
  { value: 'travel_agent', label: 'Travel Agent' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'referral', label: 'Referral' },
  { value: 'direct', label: 'Direct' },
];

const RECORD_STATUSES: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  accrued: { label: 'Accrued', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  invoiced: { label: 'Invoiced', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: FileText },
  paid: { label: 'Paid', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  waived: { label: 'Waived', color: 'bg-gray-50 text-gray-500 border-gray-200', icon: Ban },
};

export default function CommissionsPage() {
  const { toast } = useToast();

  // Shared state
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  // Rules
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [ruleSearch, setRuleSearch] = useState('');

  // Records
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [outstandingCommissions, setOutstandingCommissions] = useState<number>(0);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [recordStatusFilter, setRecordStatusFilter] = useState('all');
  const [recordSourceTypeFilter, setRecordSourceTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Dialogs
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Rule form
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    sourceType: 'ota',
    sourceId: '',
    commissionType: 'percentage',
    rate: '10',
    fixedAmount: '0',
    minAmount: '0',
    maxAmount: '',
    isActive: true,
    validFrom: '',
    validUntil: '',
  });

  // Aggregate stats
  // stats computed via useMemo below

  // Fetch properties
  useEffect(() => {
    const fetchProps = async () => {
      try {
        const res = await fetch('/api/properties');
        const result = await res.json();
        if (result.success) {
          setProperties(result.data);
          if (result.data.length > 0) setSelectedPropertyId(result.data[0].id);
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch properties', variant: 'destructive' });
      }
    };
    fetchProps();
  }, [toast]);

  // Fetch rules
  const fetchRules = useCallback(async () => {
    if (!selectedPropertyId) return;
    setIsLoadingRules(true);
    try {
      const params = new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' });
      if (ruleSearch) params.set('search', ruleSearch);
      const res = await fetch(`/api/commissions/rules?${params}`);
      const result = await res.json();
      if (result.success) setRules(result.data || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch commission rules', variant: 'destructive' });
    } finally {
      setIsLoadingRules(false);
    }
  }, [selectedPropertyId, ruleSearch, toast]);

  // Fetch records
  const fetchRecords = useCallback(async () => {
    if (!selectedPropertyId) return;
    setIsLoadingRecords(true);
    try {
      const params = new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' });
      if (recordStatusFilter !== 'all') params.set('status', recordStatusFilter);
      if (recordSourceTypeFilter !== 'all') params.set('sourceType', recordSourceTypeFilter);
      const res = await fetch(`/api/commissions/records?${params}`);
      const result = await res.json();
      if (result.success) {
        setRecords(result.data || []);
        setOutstandingCommissions(result.aggregates?.outstandingCommissions || 0);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch commission records', variant: 'destructive' });
    } finally {
      setIsLoadingRecords(false);
    }
  }, [selectedPropertyId, recordStatusFilter, recordSourceTypeFilter, toast]);

  useEffect(() => {
    if (!selectedPropertyId) return;
    (async () => {
      setIsLoadingRules(true);
      try {
        const res = await fetch(`/api/commissions/rules?${new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' })}`);
        const result = await res.json();
        if (result.success) setRules(result.data || []);
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch commission rules', variant: 'destructive' });
      } finally {
        setIsLoadingRules(false);
      }
    })();
  }, [selectedPropertyId, toast]);

  useEffect(() => {
    if (!selectedPropertyId) return;
    (async () => {
      setIsLoadingRecords(true);
      try {
        const params = new URLSearchParams({ propertyId: selectedPropertyId, limit: '100' });
        if (recordStatusFilter !== 'all') params.set('status', recordStatusFilter);
        if (recordSourceTypeFilter !== 'all') params.set('sourceType', recordSourceTypeFilter);
        const res = await fetch(`/api/commissions/records?${params}`);
        const result = await res.json();
        if (result.success) {
          setRecords(result.data || []);
          setOutstandingCommissions(result.aggregates?.outstandingCommissions || 0);
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch commission records', variant: 'destructive' });
      } finally {
        setIsLoadingRecords(false);
      }
    })();
  }, [selectedPropertyId, recordStatusFilter, recordSourceTypeFilter, toast]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { if (ruleSearch.length >= 2 || ruleSearch.length === 0) fetchRules(); }, 400);
    return () => clearTimeout(t);
  }, [ruleSearch, fetchRules]);

  // Compute stats from records
  const stats = useMemo(() => {
    const accrued = records.filter(r => r.status === 'accrued').reduce((s, r) => s + r.commissionAmount, 0);
    const invoiced = records.filter(r => r.status === 'invoiced').reduce((s, r) => s + r.commissionAmount, 0);
    const paid = records.filter(r => r.status === 'paid').reduce((s, r) => s + r.commissionAmount, 0);
    return { totalAccrued: accrued + invoiced, totalPaid: paid, outstanding: outstandingCommissions };
  }, [records, outstandingCommissions]);

  // --- Create Rule ---
  const handleCreateRule = async () => {
    if (!ruleForm.name.trim() || !ruleForm.validFrom || !selectedPropertyId) {
      toast({ title: 'Validation', description: 'Name and valid from date are required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/commissions/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ruleForm,
          propertyId: selectedPropertyId,
          rate: parseFloat(ruleForm.rate) || 0,
          fixedAmount: parseFloat(ruleForm.fixedAmount) || 0,
          minAmount: parseFloat(ruleForm.minAmount) || 0,
          maxAmount: ruleForm.maxAmount ? parseFloat(ruleForm.maxAmount) : undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Commission rule created' });
        setIsRuleDialogOpen(false);
        resetRuleForm();
        fetchRules();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to create rule', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create rule', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Delete Rule ---
  const handleDeleteRule = async (id: string) => {
    setActionLoading(`del-${id}`);
    try {
      const res = await fetch(`/api/commissions/rules/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Deleted', description: 'Commission rule deleted' });
        fetchRules();
      } else {
        toast({ title: 'Error', description: result.error || 'Delete failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete rule', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  // --- Status Transition ---
  const transitionRecord = async (id: string, newStatus: string) => {
    setActionLoading(`trans-${id}`);
    try {
      const res = await fetch(`/api/commissions/records/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Updated', description: `Record moved to ${newStatus}` });
        fetchRecords();
      } else {
        toast({ title: 'Error', description: result.error || 'Transition failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to transition record', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const resetRuleForm = () => {
    setRuleForm({
      name: '', description: '', sourceType: 'ota', sourceId: '',
      commissionType: 'percentage', rate: '10', fixedAmount: '0',
      minAmount: '0', maxAmount: '', isActive: true, validFrom: '', validUntil: '',
    });
  };

  const formatCurrency = (amount: number) => `$${(amount || 0).toFixed(2)}`;

  const RecordStatusBadge = ({ status }: { status: string }) => {
    const cfg = RECORD_STATUSES[status] || RECORD_STATUSES.accrued;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={cn('border font-medium gap-1', cfg.color)}>
        <Icon className="h-3 w-3" />{cfg.label}
      </Badge>
    );
  };

  const getSourceLabel = (type: string) => SOURCE_TYPES.find(s => s.value === type)?.label || type;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Percent className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            Commission Management
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage commission rules and track payments</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:w-48 h-10"><SelectValue placeholder="Property" /></SelectTrigger>
            <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { fetchRules(); fetchRecords(); }} className="min-w-[44px]">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rules" className="gap-1.5"><FileText className="h-4 w-4" /> Rules</TabsTrigger>
          <TabsTrigger value="records" className="gap-1.5"><TrendingUp className="h-4 w-4" /> Records</TabsTrigger>
        </TabsList>

        {/* ========== RULES TAB ========== */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search rules..." value={ruleSearch} onChange={e => setRuleSearch(e.target.value)} className="pl-9 h-10" />
            </div>
            <Button onClick={() => { resetRuleForm(); setIsRuleDialogOpen(true); }} className="bg-gradient-to-r from-violet-600 to-violet-500 hover:shadow-lg hover:shadow-violet-500/20 transition-all">
              <Plus className="h-4 w-4 mr-1.5" />Add Rule
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingRules ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-3 opacity-30" />
                  <p className="font-medium">No commission rules found</p>
                  <Button className="mt-4" onClick={() => { resetRuleForm(); setIsRuleDialogOpen(true); }}><Plus className="h-4 w-4 mr-1.5" />Add Rule</Button>
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <ScrollArea className="max-h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Source Type</TableHead>
                            <TableHead>Commission</TableHead>
                            <TableHead>Rate</TableHead>
                            <TableHead>Valid Period</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rules.map(rule => {
                            const now = new Date();
                            const validFrom = new Date(rule.validFrom);
                            const validUntil = rule.validUntil ? new Date(rule.validUntil) : null;
                            const isActive = rule.isActive && validFrom <= now && (!validUntil || validUntil >= now);

                            return (
                              <TableRow key={rule.id}>
                                <TableCell>
                                  <p className="font-medium text-sm">{rule.name}</p>
                                  {rule.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{rule.description}</p>}
                                </TableCell>
                                <TableCell><Badge variant="outline">{getSourceLabel(rule.sourceType)}</Badge></TableCell>
                                <TableCell className="text-sm">{rule.commissionType === 'percentage' ? 'Percentage' : rule.commissionType === 'flat' ? 'Flat' : 'Tiered'}</TableCell>
                                <TableCell className="text-sm font-medium">
                                  {rule.commissionType === 'percentage' ? `${rule.rate}%` : formatCurrency(rule.fixedAmount)}
                                </TableCell>
                                <TableCell className="text-xs">
                                  <p>{validFrom.toLocaleDateString()}{validUntil ? ` → ${validUntil.toLocaleDateString()}` : ' → ongoing'}</p>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={isActive ? 'default' : 'secondary'} className={cn(isActive && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300')}>
                                    {isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!!actionLoading?.startsWith('del-')}>
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                      <DropdownMenuItem onClick={() => handleDeleteRule(rule.id)} className="text-red-600 dark:text-red-400">
                                        <Trash2 className="h-4 w-4 mr-2" />Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                  {/* Mobile cards */}
                  <div className="md:hidden divide-y divide-border">
                    {rules.map(rule => (
                      <div key={rule.id} className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-sm">{rule.name}</p>
                            <p className="text-xs text-muted-foreground">{getSourceLabel(rule.sourceType)} • {rule.commissionType}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {rule.commissionType === 'percentage' ? `${rule.rate}%` : formatCurrency(rule.fixedAmount)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(rule.validFrom).toLocaleDateString()} → {rule.validUntil ? new Date(rule.validUntil).toLocaleDateString() : 'ongoing'}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== RECORDS TAB ========== */}
        <TabsContent value="records" className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 shrink-0"><DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" /></div>
                <div className="min-w-0">
                  <div className="text-base sm:text-xl font-bold truncate">{formatCurrency(stats.totalAccrued)}</div>
                  <div className="text-xs text-muted-foreground">Total Accrued</div>
                </div>
              </div>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0"><CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
                <div className="min-w-0">
                  <div className="text-base sm:text-xl font-bold truncate">{formatCurrency(stats.totalPaid)}</div>
                  <div className="text-xs text-muted-foreground">Total Paid</div>
                </div>
              </div>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-lg bg-red-500/10 shrink-0"><AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" /></div>
                <div className="min-w-0">
                  <div className="text-base sm:text-xl font-bold truncate">{formatCurrency(stats.outstanding)}</div>
                  <div className="text-xs text-muted-foreground">Outstanding</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={recordStatusFilter} onValueChange={setRecordStatusFilter}>
              <SelectTrigger className="w-full sm:w-36 h-10"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(RECORD_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={recordSourceTypeFilter} onValueChange={setRecordSourceTypeFilter}>
              <SelectTrigger className="w-full sm:w-36 h-10"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {SOURCE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-10 sm:w-40" placeholder="From" />
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-10 sm:w-40" placeholder="To" />
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingRecords ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : records.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mb-3 opacity-30" />
                  <p className="font-medium">No commission records found</p>
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <ScrollArea className="max-h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Booking</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead className="text-right">Booking Amt</TableHead>
                            <TableHead className="text-right">Commission</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Accrued Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {records.map(rec => (
                            <TableRow key={rec.id}>
                              <TableCell>
                                <p className="font-mono text-sm font-medium">{rec.booking?.confirmationCode || rec.bookingId.slice(0, 8)}</p>
                                {rec.booking?.primaryGuest && (
                                  <p className="text-xs text-muted-foreground">{rec.booking.primaryGuest.firstName} {rec.booking.primaryGuest.lastName}</p>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{getSourceLabel(rec.sourceType)}</Badge>
                                {rec.sourceName && <p className="text-xs text-muted-foreground mt-0.5">{rec.sourceName}</p>}
                              </TableCell>
                              <TableCell className="text-right text-sm">{formatCurrency(rec.bookingAmount)}</TableCell>
                              <TableCell className="text-right font-semibold text-sm">{formatCurrency(rec.commissionAmount)}</TableCell>
                              <TableCell><RecordStatusBadge status={rec.status} /></TableCell>
                              <TableCell className="text-sm text-muted-foreground">{new Date(rec.createdAt).toLocaleDateString()}</TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!!actionLoading?.startsWith('trans-')}>
                                      {actionLoading === `trans-${rec.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    {rec.status === 'accrued' && (
                                      <>
                                        <DropdownMenuItem onClick={() => transitionRecord(rec.id, 'invoiced')}>
                                          <ArrowRight className="h-4 w-4 mr-2" />Mark Invoiced
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => transitionRecord(rec.id, 'waived')} className="text-red-600 dark:text-red-400">
                                          <Ban className="h-4 w-4 mr-2" />Waive
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    {rec.status === 'invoiced' && (
                                      <>
                                        <DropdownMenuItem onClick={() => transitionRecord(rec.id, 'paid')}>
                                          <CheckCircle2 className="h-4 w-4 mr-2" />Mark Paid
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => transitionRecord(rec.id, 'waived')} className="text-red-600 dark:text-red-400">
                                          <Ban className="h-4 w-4 mr-2" />Waive
                                        </DropdownMenuItem>
                                      </>
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
                  {/* Mobile cards */}
                  <div className="md:hidden divide-y divide-border">
                    {records.map(rec => (
                      <div key={rec.id} className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-mono font-semibold text-sm">{rec.booking?.confirmationCode || rec.bookingId.slice(0, 8)}</p>
                            <p className="text-xs text-muted-foreground">{getSourceLabel(rec.sourceType)}{rec.sourceName ? ` • ${rec.sourceName}` : ''}</p>
                          </div>
                          <RecordStatusBadge status={rec.status} />
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Booking: <span className="font-medium text-foreground">{formatCurrency(rec.bookingAmount)}</span></span>
                          <span>Commission: <span className="font-medium text-foreground">{formatCurrency(rec.commissionAmount)}</span></span>
                        </div>
                        <div className="flex gap-2">
                          {rec.status === 'accrued' && (
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => transitionRecord(rec.id, 'invoiced')} disabled={!!actionLoading?.startsWith('trans-')}>
                              {actionLoading === `trans-${rec.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ArrowRight className="h-3 w-3 mr-1" />}
                              Mark Invoiced
                            </Button>
                          )}
                          {rec.status === 'invoiced' && (
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => transitionRecord(rec.id, 'paid')} disabled={!!actionLoading?.startsWith('trans-')}>
                              {actionLoading === `trans-${rec.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                              Mark Paid
                            </Button>
                          )}
                          {['accrued', 'invoiced'].includes(rec.status) && (
                            <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 dark:text-red-400" onClick={() => transitionRecord(rec.id, 'waived')}>
                              <Ban className="h-3 w-3 mr-1" />Waive
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========== ADD RULE DIALOG ========== */}
      <Dialog open={isRuleDialogOpen} onOpenChange={open => { if (!open) resetRuleForm(); setIsRuleDialogOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Commission Rule</DialogTitle>
            <DialogDescription>Define commission rules for different booking sources</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))} placeholder="OTA Booking Commission" /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={ruleForm.description} onChange={e => setRuleForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Source Type</Label>
                <Select value={ruleForm.sourceType} onValueChange={v => setRuleForm(p => ({ ...p, sourceType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Commission Type</Label>
                <Select value={ruleForm.commissionType} onValueChange={v => setRuleForm(p => ({ ...p, commissionType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="flat">Flat Amount</SelectItem>
                    <SelectItem value="tiered">Tiered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Rate (%)</Label><Input type="number" value={ruleForm.rate} onChange={e => setRuleForm(p => ({ ...p, rate: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Fixed Amount</Label><Input type="number" value={ruleForm.fixedAmount} onChange={e => setRuleForm(p => ({ ...p, fixedAmount: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Min Amount</Label><Input type="number" value={ruleForm.minAmount} onChange={e => setRuleForm(p => ({ ...p, minAmount: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Max Amount</Label><Input type="number" value={ruleForm.maxAmount} onChange={e => setRuleForm(p => ({ ...p, maxAmount: e.target.value }))} placeholder="No limit" /></div>
              <div className="space-y-1.5"><Label>Source ID</Label><Input value={ruleForm.sourceId} onChange={e => setRuleForm(p => ({ ...p, sourceId: e.target.value }))} placeholder="Optional" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Valid From *</Label><Input type="date" value={ruleForm.validFrom} onChange={e => setRuleForm(p => ({ ...p, validFrom: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Valid Until</Label><Input type="date" value={ruleForm.validUntil} onChange={e => setRuleForm(p => ({ ...p, validUntil: e.target.value }))} /></div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={ruleForm.isActive} onCheckedChange={v => setRuleForm(p => ({ ...p, isActive: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRuleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRule} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}Create Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
