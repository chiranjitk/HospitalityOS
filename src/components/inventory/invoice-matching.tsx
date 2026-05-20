'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  FileCheck2,
  Plus,
  Search,
  Eye,
  Loader2,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Ban,
  MinusCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InvoiceMatchLine {
  id?: string;
  itemDescription: string;
  poQty: number;
  invoiceQty: number;
  receivedQty: number;
  poUnitPrice: number;
  invoiceUnitPrice: number;
  lineStatus?: string;
  varianceAmount?: number;
  notes?: string;
}

interface InvoiceMatch {
  id: string;
  poNumber: string;
  invoiceNumber: string;
  vendorName: string;
  invoiceDate: string;
  invoiceAmount: number;
  poAmount: number;
  receivedAmount: number;
  matchStatus: string;
  varianceAmount: number;
  variancePercent: number;
  tolerancePercent: number;
  matchedBy?: string;
  matchedAt?: string;
  notes?: string;
  lines: InvoiceMatchLine[];
  createdAt: string;
}

interface Stats {
  matched: number;
  pending: number;
  variance: number;
  disputed: number;
  totalVarianceAmount: number;
}

// ─── Status Config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  matched: { label: 'Matched', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  variance: { label: 'Variance', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
  disputed: { label: 'Disputed', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: Ban },
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function InvoiceMatching() {
  const [matches, setMatches] = useState<InvoiceMatch[]>([]);
  const [stats, setStats] = useState<Stats>({ matched: 0, pending: 0, variance: 0, disputed: 0, totalVarianceAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<InvoiceMatch | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form state
  const [formData, setFormData] = useState({
    poNumber: '',
    invoiceNumber: '',
    vendorName: '',
    invoiceDate: '',
    invoiceAmount: 0,
    poAmount: 0,
    receivedAmount: 0,
    tolerancePercent: 5,
    notes: '',
    lines: [] as InvoiceMatchLine[],
  });

  // ─── Fetch Data ───────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('matchStatus', statusFilter);
      if (search) params.append('search', search);

      const response = await fetch(`/api/invoice-matching?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setMatches(data.data || []);

        // Compute stats from status distribution
        const dist = data.stats?.statusDistribution || [];
        const compute = (status: string) => dist.find((d: { matchStatus: string }) => d.matchStatus === status)?._count || 0;
        setStats({
          matched: compute('matched'),
          pending: compute('pending'),
          variance: compute('variance'),
          disputed: compute('disputed'),
          totalVarianceAmount: dist.reduce((sum: number, d: { matchStatus: string; _sum: { varianceAmount: number | null } }) =>
            (d.matchStatus === 'variance' || d.matchStatus === 'pending') ? sum + (d._sum?.varianceAmount || 0) : sum, 0),
        });
      }
    } catch (error) {
      console.error('Error fetching invoice matches:', error);
      toast.error('Failed to fetch invoice matches');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void fetchData();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── Create Match ─────────────────────────────────────────────────────
  const handleOpenCreateDialog = () => {
    setFormData({
      poNumber: '',
      invoiceNumber: '',
      vendorName: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      invoiceAmount: 0,
      poAmount: 0,
      receivedAmount: 0,
      tolerancePercent: 5,
      notes: '',
      lines: [],
    });
    setCreateDialogOpen(true);
  };

  const handleAddLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, {
        itemDescription: '',
        poQty: 0,
        invoiceQty: 0,
        receivedQty: 0,
        poUnitPrice: 0,
        invoiceUnitPrice: 0,
      }],
    });
  };

  const handleRemoveLine = (index: number) => {
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index),
    });
  };

  const handleLineChange = (index: number, field: keyof InvoiceMatchLine, value: string | number) => {
    const newLines = [...formData.lines];
    (newLines[index] as Record<string, unknown>)[field] = value;
    setFormData({ ...formData, lines: newLines });
  };

  const handleCreateMatch = async () => {
    if (!formData.poNumber || !formData.invoiceNumber || !formData.invoiceDate) {
      toast.error('PO#, Invoice#, and Invoice Date are required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/invoice-matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          lines: formData.lines.filter(l => l.itemDescription),
        }),
      });

      const data = await response.json();

      if (data.success) {
        const result = data.data;
        if (result.matchStatus === 'matched') {
          toast.success('Invoice auto-matched within tolerance!');
        } else if (result.matchStatus === 'variance') {
          toast.warning('Invoice created with variance — requires review');
        } else {
          toast.success('Invoice match record created');
        }
        setCreateDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to create invoice match');
      }
    } catch (error) {
      console.error('Error creating invoice match:', error);
      toast.error('Failed to create invoice match');
    } finally {
      setSaving(false);
    }
  };

  // ─── Approve / Reject ────────────────────────────────────────────────
  const handleApprove = async (id: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/invoice-matching/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchStatus: 'matched' }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Invoice match approved');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to approve');
      }
    } catch (error) {
      toast.error('Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (id: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/invoice-matching/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchStatus: 'disputed' }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Invoice marked as disputed');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to reject');
      }
    } catch (error) {
      toast.error('Failed to reject');
    } finally {
      setSaving(false);
    }
  };

  // ─── Computed Values ─────────────────────────────────────────────────
  const autoMatchPreview = useMemo(() => {
    if (formData.poAmount <= 0) return null;
    const varianceAmount = Math.abs(formData.invoiceAmount - formData.poAmount);
    const variancePercent = (varianceAmount / formData.poAmount) * 100;
    return {
      varianceAmount,
      variancePercent,
      willAutoMatch: variancePercent <= formData.tolerancePercent,
    };
  }, [formData.invoiceAmount, formData.poAmount, formData.tolerancePercent]);

  const renderStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = config.icon;
    return (
      <Badge className={cn('text-xs font-medium gap-1', config.color)}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // ─── Main Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileCheck2 className="h-6 w-6 text-primary" />
            Invoice Matching
          </h2>
          <p className="text-muted-foreground">3-way match: Purchase Orders, Invoices & Goods Received</p>
        </div>
        <Button onClick={handleOpenCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Match
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
        <Card className="p-4 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Matched</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.matched}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-red-500/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Variance</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{stats.variance}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Pending</div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-gray-500/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gray-500/10">
              <Ban className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Disputed</div>
              <div className="text-xl font-bold text-gray-600 dark:text-gray-400">{stats.disputed}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-200 hover:-translate-y-0.5 col-span-2 md:col-span-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Variance</div>
              <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(stats.totalVarianceAmount)}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by PO#, Invoice#, Vendor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Matches Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5" />
            Invoice Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileCheck2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No invoice matches found</p>
              <p className="text-sm mt-1">Create a new match to get started</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead className="hidden sm:table-cell">Vendor</TableHead>
                    <TableHead className="hidden md:table-cell">Invoice Date</TableHead>
                    <TableHead className="text-right">PO Amount</TableHead>
                    <TableHead className="text-right">Invoice Amount</TableHead>
                    <TableHead className="text-right">Variance %</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match) => (
                    <TableRow key={match.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{match.poNumber}</code>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{match.invoiceNumber}</code>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm font-medium">{match.vendorName || '—'}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {formatDate(match.invoiceDate)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(match.poAmount)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(match.invoiceAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          'text-sm font-medium',
                          match.variancePercent <= match.tolerancePercent ? 'text-emerald-600 dark:text-emerald-400' :
                          match.variancePercent <= match.tolerancePercent * 2 ? 'text-amber-600 dark:text-amber-400' :
                          'text-red-600 dark:text-red-400',
                        )}>
                          {match.variancePercent.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>{renderStatusBadge(match.matchStatus)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedMatch(match); setViewDialogOpen(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(match.matchStatus === 'variance' || match.matchStatus === 'pending') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-emerald-600 hover:text-emerald-700"
                                onClick={() => handleApprove(match.id)}
                                disabled={saving}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleReject(match.id)}
                                disabled={saving}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Match Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-primary" />
              Create Invoice Match
            </DialogTitle>
            <DialogDescription>
              Enter PO and invoice details. Auto-match will apply if variance is within tolerance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Header fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>PO # *</Label>
                <Input
                  placeholder="PO-2025-001"
                  value={formData.poNumber}
                  onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Invoice # *</Label>
                <Input
                  placeholder="INV-2025-001"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Input
                  placeholder="Vendor name"
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Invoice Date *</Label>
                <Input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>PO Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.poAmount || ''}
                  onChange={(e) => setFormData({ ...formData, poAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Invoice Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.invoiceAmount || ''}
                  onChange={(e) => setFormData({ ...formData, invoiceAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Received Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.receivedAmount || ''}
                  onChange={(e) => setFormData({ ...formData, receivedAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tolerance %</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={formData.tolerancePercent}
                  onChange={(e) => setFormData({ ...formData, tolerancePercent: parseFloat(e.target.value) || 5 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  placeholder="Optional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>

            {/* Auto-match Preview */}
            {autoMatchPreview && (
              <div className={cn(
                'rounded-lg p-3 flex items-center gap-3',
                autoMatchPreview.willAutoMatch
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800',
              )}>
                {autoMatchPreview.willAutoMatch ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                )}
                <div className="text-sm">
                  {autoMatchPreview.willAutoMatch ? (
                    <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                      Will auto-match — Variance {autoMatchPreview.variancePercent.toFixed(2)}% is within {formData.tolerancePercent}% tolerance
                    </span>
                  ) : (
                    <span className="text-red-700 dark:text-red-300 font-medium">
                      Will flag as variance — {autoMatchPreview.variancePercent.toFixed(2)}% exceeds {formData.tolerancePercent}% tolerance ({formatCurrency(autoMatchPreview.varianceAmount)} difference)
                    </span>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
              </div>
              {formData.lines.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
                  No line items. Click &quot;Add Line&quot; to add item details.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-1">
                    <div className="col-span-3">Item</div>
                    <div className="col-span-1">PO Qty</div>
                    <div className="col-span-1">Inv Qty</div>
                    <div className="col-span-1">Recv Qty</div>
                    <div className="col-span-2">PO Price</div>
                    <div className="col-span-2">Inv Price</div>
                    <div className="col-span-1"></div>
                  </div>
                  {formData.lines.map((line, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <Input
                          placeholder="Item description"
                          value={line.itemDescription}
                          onChange={(e) => handleLineChange(index, 'itemDescription', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          type="number"
                          placeholder="0"
                          value={line.poQty || ''}
                          onChange={(e) => handleLineChange(index, 'poQty', parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          type="number"
                          placeholder="0"
                          value={line.invoiceQty || ''}
                          onChange={(e) => handleLineChange(index, 'invoiceQty', parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          type="number"
                          placeholder="0"
                          value={line.receivedQty || ''}
                          onChange={(e) => handleLineChange(index, 'receivedQty', parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={line.poUnitPrice || ''}
                          onChange={(e) => handleLineChange(index, 'poUnitPrice', parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={line.invoiceUnitPrice || ''}
                          onChange={(e) => handleLineChange(index, 'invoiceUnitPrice', parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLine(index)}
                          className="h-8 w-8 p-0"
                        >
                          <MinusCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateMatch} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Match Detail Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-primary" />
              Invoice Match Detail
            </DialogTitle>
            <DialogDescription>
              {selectedMatch?.poNumber} — {selectedMatch?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedMatch && (
            <div className="space-y-4 py-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                {renderStatusBadge(selectedMatch.matchStatus)}
                <span className="text-xs text-muted-foreground">
                  Created {formatDate(selectedMatch.createdAt)}
                </span>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">PO #</Label>
                  <code className="text-sm bg-muted px-2 py-1 rounded font-mono">{selectedMatch.poNumber}</code>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Invoice #</Label>
                  <code className="text-sm bg-muted px-2 py-1 rounded font-mono">{selectedMatch.invoiceNumber}</code>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Vendor</Label>
                  <div className="text-sm font-medium">{selectedMatch.vendorName || '—'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Invoice Date</Label>
                  <div className="text-sm">{formatDate(selectedMatch.invoiceDate)}</div>
                </div>
              </div>

              <Separator />

              {/* Amounts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">PO Amount</Label>
                  <div className="text-lg font-bold">{formatCurrency(selectedMatch.poAmount)}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Invoice Amount</Label>
                  <div className="text-lg font-bold">{formatCurrency(selectedMatch.invoiceAmount)}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Received Amount</Label>
                  <div className="text-lg font-bold">{formatCurrency(selectedMatch.receivedAmount)}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Variance</Label>
                  <div className={cn(
                    'text-lg font-bold',
                    selectedMatch.variancePercent <= selectedMatch.tolerancePercent
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400',
                  )}>
                    {selectedMatch.variancePercent.toFixed(2)}% ({formatCurrency(selectedMatch.varianceAmount)})
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Tolerance: {selectedMatch.tolerancePercent}% ·
                {selectedMatch.matchedBy && <> Matched by: {selectedMatch.matchedBy} ·</>}
                {selectedMatch.matchedAt && <> Matched at: {formatDate(selectedMatch.matchedAt)}</>}
              </div>

              {/* Line Items */}
              {selectedMatch.lines && selectedMatch.lines.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Line Items</Label>
                    <div className="border rounded-lg">
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">PO Qty</TableHead>
                            <TableHead className="text-right">Inv Qty</TableHead>
                            <TableHead className="text-right">Recv Qty</TableHead>
                            <TableHead className="text-right">PO Price</TableHead>
                            <TableHead className="text-right">Inv Price</TableHead>
                            <TableHead className="text-right">Variance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedMatch.lines.map((line, idx) => (
                            <TableRow key={line.id || idx}>
                              <TableCell className="text-sm">{line.itemDescription}</TableCell>
                              <TableCell className="text-right text-sm">{line.poQty}</TableCell>
                              <TableCell className="text-right text-sm">{line.invoiceQty}</TableCell>
                              <TableCell className="text-right text-sm">{line.receivedQty}</TableCell>
                              <TableCell className="text-right text-sm">{formatCurrency(line.poUnitPrice)}</TableCell>
                              <TableCell className="text-right text-sm">{formatCurrency(line.invoiceUnitPrice)}</TableCell>
                              <TableCell className={cn(
                                'text-right text-sm font-medium',
                                (line.varianceAmount || 0) === 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400',
                              )}>
                                {formatCurrency(line.varianceAmount || 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedMatch.notes && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Notes</Label>
                    <div className="text-sm bg-muted p-3 rounded-lg">{selectedMatch.notes}</div>
                  </div>
                </>
              )}

              {/* Actions for variance items */}
              {(selectedMatch.matchStatus === 'variance' || selectedMatch.matchStatus === 'pending') && (
                <>
                  <Separator />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => { handleReject(selectedMatch.id); setViewDialogOpen(false); }}
                      disabled={saving}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject / Dispute
                    </Button>
                    <Button
                      onClick={() => { handleApprove(selectedMatch.id); setViewDialogOpen(false); }}
                      disabled={saving}
                    >
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve Match
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
