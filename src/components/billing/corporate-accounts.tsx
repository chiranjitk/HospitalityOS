'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Building2,
  Plus,
  Loader2,
  RefreshCw,
  Pencil,
  Trash2,
  Search,
  DollarSign,
  Users,
  FileText,
  CreditCard,
  Star,
  Eye,
  X,
  Calendar,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CorporateAccount {
  id: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  taxId: string | null;
  industry: string | null;
  accountType: string;
  billingTerms: string;
  creditLimit: number;
  outstandingBalance: number;
  discountPercent: number;
  isPreferred: boolean;
  isActive: boolean;
  createdAt: string;
}

interface CorporateInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  total: number;
  paidAmount: number;
  balance: number;
  status: string;
  itemCount: number;
  createdAt: string;
}

interface CorporateAccountStats {
  total: number;
  active: number;
  corporate: number;
  government: number;
  travelAgent: number;
  totalOutstanding: number;
}

const ACCOUNT_TYPES = [
  { value: 'corporate', label: 'Corporate', color: 'bg-blue-500/10 text-blue-700' },
  { value: 'government', label: 'Government', color: 'bg-purple-500/10 text-purple-700' },
  { value: 'travel_agent', label: 'Travel Agent', color: 'bg-orange-500/10 text-orange-700' },
  { value: 'association', label: 'Association', color: 'bg-teal-500/10 text-teal-700' },
];

const BILLING_TERMS = [
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_45', label: 'Net 45' },
  { value: 'net_60', label: 'Net 60' },
];

export default function CorporateAccounts() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [stats, setStats] = useState<CorporateAccountStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CorporateAccount | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<CorporateAccount | null>(null);
  const [invoices, setInvoices] = useState<CorporateInvoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    taxId: '',
    website: '',
    industry: '',
    accountType: 'corporate',
    billingTerms: 'net_30',
    creditLimit: '',
    discountPercent: '',
    isPreferred: false,
  });

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/corporate-accounts');
      const result = await res.json();
      if (result.success) {
        setAccounts(result.data);
        setStats(result.stats);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch corporate accounts', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const resetForm = () => {
    setFormData({
      companyName: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
      taxId: '',
      website: '',
      industry: '',
      accountType: 'corporate',
      billingTerms: 'net_30',
      creditLimit: '',
      discountPercent: '',
      isPreferred: false,
    });
    setEditingAccount(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (account: CorporateAccount) => {
    setEditingAccount(account);
    setFormData({
      companyName: account.companyName,
      contactName: account.contactName || '',
      contactEmail: account.contactEmail || '',
      contactPhone: account.contactPhone || '',
      address: '',
      city: account.city || '',
      state: account.state || '',
      country: account.country || '',
      postalCode: '',
      taxId: account.taxId || '',
      website: '',
      industry: account.industry || '',
      accountType: account.accountType,
      billingTerms: account.billingTerms,
      creditLimit: account.creditLimit.toString(),
      discountPercent: account.discountPercent.toString(),
      isPreferred: account.isPreferred,
    });
    setIsDialogOpen(true);
  };

  const openDetail = async (account: CorporateAccount) => {
    setSelectedAccount(account);
    setIsDetailOpen(true);
    setIsInvoicesLoading(true);
    try {
      const res = await fetch(`/api/corporate-accounts/${account.id}/invoices`);
      const result = await res.json();
      if (result.success) {
        setInvoices(result.data.invoices || []);
      }
    } catch {
      // silent
    } finally {
      setIsInvoicesLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.companyName) {
      toast({ title: 'Validation Error', description: 'Company name is required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        creditLimit: parseFloat(formData.creditLimit) || 0,
        discountPercent: parseFloat(formData.discountPercent) || 0,
      };

      if (editingAccount) {
        const res = await fetch('/api/corporate-accounts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingAccount.id, ...payload }),
        });
        const result = await res.json();
        if (result.success) {
          toast({ title: 'Success', description: 'Account updated' });
          setIsDialogOpen(false);
          fetchAccounts();
        } else {
          toast({ title: 'Error', description: result.error?.message || 'Failed to update', variant: 'destructive' });
        }
      } else {
        const res = await fetch('/api/corporate-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (result.success) {
          toast({ title: 'Success', description: 'Corporate account created' });
          setIsDialogOpen(false);
          fetchAccounts();
        } else {
          toast({ title: 'Error', description: result.error?.message || 'Failed to create', variant: 'destructive' });
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save account', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (accountId: string) => {
    try {
      const res = await fetch(`/api/corporate-accounts?id=${accountId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Account deactivated' });
        fetchAccounts();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to deactivate account', variant: 'destructive' });
    }
  };

  const getAccountTypeLabel = (value: string) => ACCOUNT_TYPES.find((t) => t.value === value)?.label || value;
  const getAccountTypeColor = (value: string) => ACCOUNT_TYPES.find((t) => t.value === value)?.color || '';
  const getBillingTermsLabel = (value: string) => BILLING_TERMS.find((t) => t.value === value)?.label || value;

  const filtered = accounts.filter(
    (a) =>
      !searchQuery ||
      a.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.taxId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-teal-600" />
            Corporate Accounts
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage corporate billing accounts with payment terms and credit limits
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAccounts}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New Account
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-teal-500/10">
                <Building2 className="h-4 w-4 text-teal-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.active}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.corporate}</div>
                <div className="text-xs text-muted-foreground">Corporate</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <CreditCard className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.government}</div>
                <div className="text-xs text-muted-foreground">Government</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <ArrowUpRight className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.travelAgent}</div>
                <div className="text-xs text-muted-foreground">Travel Agent</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <DollarSign className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">${stats.totalOutstanding.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Outstanding</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company name, contact, or tax ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Account Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Building2 className="h-12 w-12 mb-4" />
          <p>No corporate accounts found</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((account) => (
            <Card key={account.id} className={cn(
              'hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5',
              !account.isActive && 'opacity-60'
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-2 rounded-lg bg-teal-500/10 shrink-0">
                      <Building2 className="h-4 w-4 text-teal-600" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{account.companyName}</CardTitle>
                      <p className="text-xs text-muted-foreground truncate">
                        {account.contactName || 'No contact'} {account.city ? `· ${account.city}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {account.isPreferred && (
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={cn('text-xs', getAccountTypeColor(account.accountType))}>
                    {getAccountTypeLabel(account.accountType)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {getBillingTermsLabel(account.billingTerms)}
                  </Badge>
                  {!account.isActive && (
                    <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">Inactive</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Credit Limit</p>
                    <p className="text-sm font-semibold">${account.creditLimit.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className={cn(
                      'text-sm font-semibold',
                      account.outstandingBalance > 0
                        ? 'text-red-600'
                        : 'text-emerald-600'
                    )}>
                      ${account.outstandingBalance.toLocaleString()}
                    </p>
                  </div>
                </div>

                {account.discountPercent > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Discount: <span className="font-medium text-foreground">{account.discountPercent}%</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openDetail(account)}>
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Details
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(account)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(account.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-teal-600" />
              {editingAccount ? 'Edit Corporate Account' : 'New Corporate Account'}
            </DialogTitle>
            <DialogDescription>
              Set up billing terms and credit limits for direct billing
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[400px] overflow-y-auto">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                placeholder="Enter company name"
                value={formData.companyName}
                onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input
                  placeholder="Full name"
                  value={formData.contactName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, contactName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  placeholder="email@company.com"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input
                  placeholder="+1 234 567 890"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tax ID / GSTIN</Label>
                <Input
                  placeholder="Tax registration number"
                  value={formData.taxId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, taxId: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select
                  value={formData.accountType}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, accountType: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Billing Terms</Label>
                <Select
                  value={formData.billingTerms}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, billingTerms: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_TERMS.map((term) => (
                      <SelectItem key={term.value} value={term.value}>
                        {term.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Credit Limit ($)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData((prev) => ({ ...prev, creditLimit: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Discount (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  placeholder="0"
                  value={formData.discountPercent}
                  onChange={(e) => setFormData((prev) => ({ ...prev, discountPercent: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input
                  placeholder="e.g., Technology, Healthcare"
                  value={formData.industry}
                  onChange={(e) => setFormData((prev) => ({ ...prev, industry: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setIsDialogOpen(false); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingAccount ? 'Update Account' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-teal-600" />
              {selectedAccount?.companyName}
            </DialogTitle>
            <DialogDescription>
              Account details and invoice history
            </DialogDescription>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <Badge variant="outline" className={cn('mt-1', getAccountTypeColor(selectedAccount.accountType))}>
                    {getAccountTypeLabel(selectedAccount.accountType)}
                  </Badge>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Terms</p>
                  <p className="text-sm font-medium mt-1">{getBillingTermsLabel(selectedAccount.billingTerms)}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Credit Limit</p>
                  <p className="text-sm font-medium mt-1">${selectedAccount.creditLimit.toLocaleString()}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                  <p className={cn('text-sm font-medium mt-1', selectedAccount.outstandingBalance > 0 ? 'text-red-600' : 'text-emerald-600')}>
                    ${selectedAccount.outstandingBalance.toLocaleString()}
                  </p>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedAccount.contactName && (
                  <div><span className="text-muted-foreground">Contact:</span> {selectedAccount.contactName}</div>
                )}
                {selectedAccount.contactEmail && (
                  <div><span className="text-muted-foreground">Email:</span> {selectedAccount.contactEmail}</div>
                )}
                {selectedAccount.contactPhone && (
                  <div><span className="text-muted-foreground">Phone:</span> {selectedAccount.contactPhone}</div>
                )}
                {selectedAccount.taxId && (
                  <div><span className="text-muted-foreground">Tax ID:</span> {selectedAccount.taxId}</div>
                )}
                {selectedAccount.city && (
                  <div><span className="text-muted-foreground">Location:</span> {selectedAccount.city}{selectedAccount.state ? `, ${selectedAccount.state}` : ''}</div>
                )}
                {selectedAccount.industry && (
                  <div><span className="text-muted-foreground">Industry:</span> {selectedAccount.industry}</div>
                )}
              </div>

              {/* Invoices */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Recent Invoices
                </h4>
                {isInvoicesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No invoices found for this account</p>
                ) : (
                  <ScrollArea className="max-h-[240px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.slice(0, 10).map((inv) => (
                          <TableRow key={inv.id} className="hover:bg-muted/50">
                            <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                            <TableCell className="text-xs">{new Date(inv.invoiceDate).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right text-sm">${inv.total.toLocaleString()}</TableCell>
                            <TableCell className={cn('text-right text-sm font-medium', inv.balance > 0 ? 'text-red-600' : 'text-emerald-600')}>
                              ${inv.balance.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('text-xs',
                                inv.status === 'paid' && 'bg-emerald-500/10 text-emerald-700',
                                inv.status === 'overdue' && 'bg-red-500/10 text-red-700',
                                inv.status === 'sent' && 'bg-blue-500/10 text-blue-700',
                              )}>
                                {inv.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
