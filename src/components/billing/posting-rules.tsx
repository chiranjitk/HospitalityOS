'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Plus,
  Loader2,
  RefreshCw,
  FileText,
  Settings,
  BookOpen,
  DollarSign,
  Tag,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';

interface RevenueAccount {
  id: string;
  code: string;
  name: string;
  type: 'revenue' | 'expense' | 'liability' | 'asset';
  category: string;
  status: 'active' | 'inactive';
  description?: string;
  createdAt: string;
}

interface PostingRule {
  id: string;
  name: string;
  description?: string;
  chargeCategory: string;
  chargeType: string;
  revenueAccountId: string;
  revenueAccount?: RevenueAccount;
  taxTreatment: string;
  autoPost: boolean;
  status: 'active' | 'inactive';
  conditions?: string;
  createdAt: string;
  updatedAt: string;
}

const ACCOUNT_TYPES = [
  { value: 'revenue', label: 'Revenue', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-950', dot: 'bg-emerald-500' },
  { value: 'expense', label: 'Expense', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-950', dot: 'bg-red-500' },
  { value: 'liability', label: 'Liability', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-950', dot: 'bg-amber-500' },
  { value: 'asset', label: 'Asset', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-950', dot: 'bg-blue-500' },
];

const CHARGE_CATEGORIES = [
  { value: 'room', label: 'Room' },
  { value: 'food_beverage', label: 'Food & Beverage' },
  { value: 'service', label: 'Services' },
  { value: 'amenity', label: 'Amenities' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'minibar', label: 'Minibar' },
  { value: 'parking', label: 'Parking' },
  { value: 'telephone', label: 'Telephone' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
];

const TAX_TREATMENTS = [
  { value: 'taxable', label: 'Taxable' },
  { value: 'tax_exempt', label: 'Tax Exempt' },
  { value: 'tax_inclusive', label: 'Tax Inclusive' },
  { value: 'zero_rated', label: 'Zero Rated' },
];

export default function PostingRules() {
  const { toast } = useToast();
  const t = useTranslations('billing');
  const [rules, setRules] = useState<PostingRule[]>([]);
  const [accounts, setAccounts] = useState<RevenueAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('rules');

  // Dialog states
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<PostingRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Rule form
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    chargeCategory: 'room',
    chargeType: '',
    revenueAccountId: '',
    taxTreatment: 'taxable',
    autoPost: true,
    conditions: '',
  });

  // Account form
  const [accountForm, setAccountForm] = useState({
    code: '',
    name: '',
    type: 'revenue' as 'revenue' | 'expense' | 'liability' | 'asset',
    category: '',
    description: '',
  });

  // Fetch data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rulesRes, accountsRes] = await Promise.all([
        fetch('/api/posting-rules'),
        fetch('/api/revenue-accounts'),
      ]);
      const rulesResult = await rulesRes.json();
      const accountsResult = await accountsRes.json();
      if (rulesResult.success) setRules(rulesResult.data || []);
      if (accountsResult.success) setAccounts(accountsResult.data || []);
    } catch {
      toast({ title: t('prError'), description: t('prFailedToLoadData'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Create/Update Rule
  const handleSaveRule = async () => {
    if (!ruleForm.name || !ruleForm.chargeType || !ruleForm.revenueAccountId) {
      toast({ title: t('prValidationError'), description: t('prRuleFieldsRequired'), variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...ruleForm,
        conditions: ruleForm.conditions ? ruleForm.conditions : undefined,
      };
      const url = isEditing && selectedRule ? `/api/posting-rules/${selectedRule.id}` : '/api/posting-rules';
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: t('prSuccess'), description: isEditing ? t('prRuleUpdated') : t('prRuleCreated') });
        closeRuleDialog();
        fetchData();
      } else {
        toast({ title: t('prError'), description: result.error?.message || t('prFailedToSaveRule'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('prError'), description: t('prFailedToSaveRule'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Create Account
  const handleSaveAccount = async () => {
    if (!accountForm.code || !accountForm.name) {
      toast({ title: t('prValidationError'), description: t('prCodeAndNameRequired'), variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/revenue-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountForm),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: t('prSuccess'), description: t('prAccountCreated') });
        setIsAccountDialogOpen(false);
        resetAccountForm();
        fetchData();
      } else {
        toast({ title: t('prError'), description: result.error?.message || t('prFailedToCreateAccount'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('prError'), description: t('prFailedToCreateAccount'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle auto-post
  const handleToggleAutoPost = async (rule: PostingRule) => {
    try {
      const res = await fetch(`/api/posting-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoPost: !rule.autoPost }),
      });
      const result = await res.json();
      if (result.success) {
        fetchData();
      } else {
        toast({ title: t('prError'), description: t('prFailedToToggleAutoPost'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('prError'), description: t('prFailedToToggleAutoPost'), variant: 'destructive' });
    }
  };

  // Toggle rule status
  const handleToggleStatus = async (rule: PostingRule) => {
    try {
      const res = await fetch(`/api/posting-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: rule.status === 'active' ? 'inactive' : 'active' }),
      });
      const result = await res.json();
      if (result.success) {
        fetchData();
      } else {
        toast({ title: t('prError'), description: t('prFailedToUpdateStatus'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('prError'), description: t('prFailedToUpdateStatus'), variant: 'destructive' });
    }
  };

  const openEditRule = (rule: PostingRule) => {
    setSelectedRule(rule);
    setIsEditing(true);
    setRuleForm({
      name: rule.name,
      description: rule.description || '',
      chargeCategory: rule.chargeCategory,
      chargeType: rule.chargeType,
      revenueAccountId: rule.revenueAccountId,
      taxTreatment: rule.taxTreatment,
      autoPost: rule.autoPost,
      conditions: rule.conditions || '',
    });
    setIsRuleDialogOpen(true);
  };

  const closeRuleDialog = () => {
    setIsRuleDialogOpen(false);
    setIsEditing(false);
    setSelectedRule(null);
    resetRuleForm();
  };

  const resetRuleForm = () => {
    setRuleForm({ name: '', description: '', chargeCategory: 'room', chargeType: '', revenueAccountId: '', taxTreatment: 'taxable', autoPost: true, conditions: '' });
  };

  const resetAccountForm = () => {
    setAccountForm({ code: '', name: '', type: 'revenue', category: '', description: '' });
  };

  const getAccountTypeBadge = (type: string) => {
    const t = ACCOUNT_TYPES.find(a => a.value === type);
    return (
      <Badge variant="secondary" className={cn(t?.bg, t?.color, 'gap-1')}>
        <span className={cn('h-1.5 w-1.5 rounded-full', t?.dot)} />
        {t?.label || type}
      </Badge>
    );
  };

  const filteredRules = rules.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.chargeCategory.toLowerCase().includes(q) || r.chargeType.toLowerCase().includes(q);
  });

  const filteredAccounts = accounts.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
  });

  const stats = {
    totalRules: rules.length,
    activeRules: rules.filter(r => r.status === 'active').length,
    autoPostRules: rules.filter(r => r.autoPost).length,
    totalAccounts: accounts.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('prTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('prDescription')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('prRefresh')}
          </Button>
          {activeTab === 'rules' ? (
            <Button onClick={() => { resetRuleForm(); setIsEditing(false); setIsRuleDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              {t('prAddRule')}
            </Button>
          ) : (
            <Button onClick={() => { resetAccountForm(); setIsAccountDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              {t('prAddAccount')}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        <Card className="p-4 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <FileText className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalRules}</div>
              <div className="text-xs text-muted-foreground">{t('prTotalRules')}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.activeRules}</div>
              <div className="text-xs text-muted-foreground">{t('prActiveRules')}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <ToggleRight className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.autoPostRules}</div>
              <div className="text-xs text-muted-foreground">{t('prAutoPostStat')}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <BookOpen className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalAccounts}</div>
              <div className="text-xs text-muted-foreground">{t('prAccounts')}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={activeTab === 'rules' ? t('prSearchRules') : t('prSearchAccounts')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="rules">
            <FileText className="h-4 w-4 mr-1.5" />
            {t('prTabRules')}
          </TabsTrigger>
          <TabsTrigger value="accounts">
            <BookOpen className="h-4 w-4 mr-1.5" />
            {t('prTabAccounts')}
          </TabsTrigger>
        </TabsList>

        {/* Posting Rules Tab */}
        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Layers className="h-12 w-12 mb-4" />
                  <p>{t('prNoRulesFound')}</p>
                  <p className="text-sm mt-1">{t('prCreateRuleToStart')}</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('prHeaderRuleName')}</TableHead>
                        <TableHead>{t('prHeaderChargeCategory')}</TableHead>
                        <TableHead>{t('prHeaderChargeType')}</TableHead>
                        <TableHead>{t('prHeaderRevenueAccount')}</TableHead>
                        <TableHead>{t('prHeaderTax')}</TableHead>
                        <TableHead>{t('prHeaderAutoPost')}</TableHead>
                        <TableHead>{t('prHeaderStatus')}</TableHead>
                        <TableHead className="text-right">{t('prHeaderActions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRules.map((rule) => (
                        <TableRow key={rule.id} className={cn(
                          'transition-colors hover:bg-muted/50',
                          rule.status === 'inactive' && 'opacity-60',
                        )}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{rule.name}</p>
                              {rule.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">{rule.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              {rule.chargeCategory.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{rule.chargeType}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {rule.revenueAccount ? (
                                <>
                                  <span className="font-mono text-xs text-muted-foreground">{rule.revenueAccount.code}</span>
                                  <span className="text-sm">{rule.revenueAccount.name}</span>
                                </>
                              ) : (
                                <span className="text-sm text-muted-foreground">{t('prNotAssigned')}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs capitalize">
                              {rule.taxTreatment.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={rule.autoPost}
                              onCheckedChange={() => handleToggleAutoPost(rule)}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'cursor-pointer text-xs',
                                rule.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                              )}
                              onClick={() => handleToggleStatus(rule)}
                            >
                              {rule.status === 'active' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                              {rule.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => openEditRule(rule)}>
                              <Pencil className="h-3 w-3 mr-1" />
                              {t('prEdit')}
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
        </TabsContent>

        {/* Revenue Accounts Tab */}
        <TabsContent value="accounts" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mb-4" />
                  <p>{t('prNoAccountsFound')}</p>
                  <p className="text-sm mt-1">{t('prCreateAccountToStart')}</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('prHeaderCode')}</TableHead>
                        <TableHead>{t('prHeaderName')}</TableHead>
                        <TableHead>{t('prHeaderType')}</TableHead>
                        <TableHead>{t('prHeaderAccountCategory')}</TableHead>
                        <TableHead>{t('prHeaderStatus')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAccounts.map((account) => (
                        <TableRow key={account.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <span className="font-mono font-medium text-sm">{account.code}</span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{account.name}</p>
                              {account.description && (
                                <p className="text-xs text-muted-foreground">{account.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getAccountTypeBadge(account.type)}</TableCell>
                          <TableCell className="text-sm">{account.category || '—'}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-xs',
                                account.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                              )}
                            >
                              {account.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Rule Dialog */}
      <Dialog open={isRuleDialogOpen} onOpenChange={closeRuleDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? t('prEditRuleTitle') : t('prAddRuleTitle')}</DialogTitle>
            <DialogDescription>
              {isEditing ? t('prEditRuleDesc') : t('prAddRuleDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="ruleName">{t('prLabelRuleName')}</Label>
              <Input
                id="ruleName"
                placeholder={t('prPlaceholderRuleName')}
                value={ruleForm.name}
                onChange={(e) => setRuleForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ruleDescription">{t('prLabelDescription')}</Label>
              <Textarea
                placeholder={t('prPlaceholderDescription')}
                value={ruleForm.description}
                onChange={(e) => setRuleForm(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="chargeCategory">{t('prLabelChargeCategory')}</Label>
                <Select
                  value={ruleForm.chargeCategory}
                  onValueChange={(value) => setRuleForm(prev => ({ ...prev, chargeCategory: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('prPlaceholderChargeCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {CHARGE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="chargeType">{t('prLabelChargeType')}</Label>
                <Input
                  id="chargeType"
                  placeholder={t('prPlaceholderChargeType')}
                  value={ruleForm.chargeType}
                  onChange={(e) => setRuleForm(prev => ({ ...prev, chargeType: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="revenueAccountId">{t('prLabelRevenueAccount')}</Label>
              <Select
                value={ruleForm.revenueAccountId}
                onValueChange={(value) => setRuleForm(prev => ({ ...prev, revenueAccountId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('prPlaceholderRevenueAccount')} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.status === 'active').map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} — {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxTreatment">{t('prLabelTaxTreatment')}</Label>
              <Select
                value={ruleForm.taxTreatment}
                onValueChange={(value) => setRuleForm(prev => ({ ...prev, taxTreatment: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_TREATMENTS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>{t('prLabelAutoPost')}</Label>
                <p className="text-xs text-muted-foreground">{t('prAutoPostDesc')}</p>
              </div>
              <Switch
                checked={ruleForm.autoPost}
                onCheckedChange={(checked) => setRuleForm(prev => ({ ...prev, autoPost: checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conditions">{t('prLabelConditions')}</Label>
              <Textarea
                placeholder='{"roomType": "standard", "minStay": 1}'
                value={ruleForm.conditions}
                onChange={(e) => setRuleForm(prev => ({ ...prev, conditions: e.target.value }))}
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRuleDialog}>{t('prCancel')}</Button>
            <Button onClick={handleSaveRule} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? t('prUpdateRule') : t('prCreateRule')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Account Dialog */}
      <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('prAddAccountTitle')}</DialogTitle>
            <DialogDescription>
              {t('prAddAccountDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountCode">{t('prLabelAccountCode')}</Label>
                <Input
                  id="accountCode"
                  placeholder={t('prPlaceholderAccountCode')}
                  value={accountForm.code}
                  onChange={(e) => setAccountForm(prev => ({ ...prev, code: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountType">{t('prLabelAccountType')}</Label>
                <Select
                  value={accountForm.type}
                  onValueChange={(value) => setAccountForm(prev => ({ ...prev, type: value as 'revenue' | 'expense' | 'liability' | 'asset' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountName">{t('prLabelAccountName')}</Label>
              <Input
                id="accountName"
                placeholder={t('prPlaceholderAccountName')}
                value={accountForm.name}
                onChange={(e) => setAccountForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountCategory">{t('prLabelCategory')}</Label>
              <Input
                id="accountCategory"
                placeholder={t('prPlaceholderCategory')}
                value={accountForm.category}
                onChange={(e) => setAccountForm(prev => ({ ...prev, category: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountDescription">{t('prLabelAccountDescription')}</Label>
              <Textarea
                placeholder={t('prPlaceholderOptional')}
                value={accountForm.description}
                onChange={(e) => setAccountForm(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAccountDialogOpen(false)}>{t('prCancel')}</Button>
            <Button onClick={handleSaveAccount} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('prCreateAccount')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
