'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Landmark,
  RefreshCw,
  Check,
  X,
  Clock,
  AlertTriangle,
  Download,
  Plus,
  Eye,
  Trash2,
  ArrowRightLeft,
  FileText,
  TrendingUp,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Calendar,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';

// ============================================================
// Types
// ============================================================

interface SettlementItem {
  id: string;
  bookingId?: string;
  channelBookingRef?: string;
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
  roomType?: string;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  receivedAmount: number;
  discrepancy: number;
  status: string;
  matchedAt?: string;
  createdAt: string;
  settlement?: {
    id: string;
    settlementRef: string;
    channelCode: string;
    periodFrom: string;
    periodTo: string;
    status: string;
  };
}

interface Settlement {
  id: string;
  connectionId: string;
  channelCode: string;
  settlementRef: string;
  periodFrom: string;
  periodTo: string;
  totalBookings: number;
  totalGross: number;
  totalCommission: number;
  totalNet: number;
  totalReceived: number;
  currency: string;
  settlementDate?: string;
  dueDate?: string;
  status: string;
  notes?: string;
  settlementItems: SettlementItem[];
  createdAt: string;
}

interface SettlementStats {
  total: number;
  totalSettled: number;
  pending: number;
  disputed: number;
  totalGross: number;
  totalCommission: number;
  totalNet: number;
  totalReceived: number;
}

interface ChannelSummary {
  channelCode: string;
  totalGross: number;
  totalCommission: number;
  totalNet: number;
  totalReceived: number;
  outstanding: number;
  count: number;
  pending: number;
  received: number;
  disputed: number;
}

interface DiscrepancyItem {
  id: string;
  settlementId: string;
  bookingId?: string;
  channelBookingRef?: string;
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
  roomType?: string;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  receivedAmount: number;
  discrepancy: number;
  status: string;
  settlement?: {
    id: string;
    settlementRef: string;
    channelCode: string;
    periodFrom: string;
    periodTo: string;
    status: string;
  };
}

// ============================================================
// Component
// ============================================================

export default function SettlementReconciliation() {
  const { formatCurrency } = useCurrency();
  const { formatDate } = useTimezone();

  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [stats, setStats] = useState<SettlementStats>({
    total: 0, totalSettled: 0, pending: 0, disputed: 0,
    totalGross: 0, totalCommission: 0, totalNet: 0, totalReceived: 0,
  });
  const [channelSummary, setChannelSummary] = useState<ChannelSummary[]>([]);
  const [discrepancyItems, setDiscrepancyItems] = useState<DiscrepancyItem[]>([]);
  const [discrepancyStats, setDiscrepancyStats] = useState({ totalItems: 0, totalDiscrepancy: 0 });
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterConnection, setFilterConnection] = useState<string>('all');
  const [filterPeriodFrom, setFilterPeriodFrom] = useState('');
  const [filterPeriodTo, setFilterPeriodTo] = useState('');

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newItemRows, setNewItemRows] = useState<number[]>([0]);
  const [newItems, setNewItems] = useState<Record<number, any>>({});

  // Mark received dialog
  const [markReceivedDialog, setMarkReceivedDialog] = useState<{ open: boolean; settlement: Settlement | null }>({
    open: false, settlement: null,
  });
  const [markAmount, setMarkAmount] = useState('');
  const [markLoading, setMarkLoading] = useState(false);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterConnection !== 'all') params.set('connectionId', filterConnection);
      if (filterPeriodFrom) params.set('periodFrom', filterPeriodFrom);
      if (filterPeriodTo) params.set('periodTo', filterPeriodTo);

      const [listRes, summaryRes, discRes] = await Promise.all([
        fetch(`/api/channels/settlement?${params.toString()}`),
        fetch('/api/channels/settlement?action=summary'),
        fetch('/api/channels/settlement?action=discrepancy-report'),
      ]);

      const listData = await listRes.json();
      const summaryData = await summaryRes.json();
      const discData = await discRes.json();

      if (listData.success) {
        setSettlements(listData.data || []);
        setStats(listData.stats || stats);
      }
      if (summaryData.success) {
        setChannelSummary(summaryData.data || []);
      }
      if (discData.success) {
        setDiscrepancyItems(discData.data || []);
        setDiscrepancyStats(discData.stats || { totalItems: 0, totalDiscrepancy: 0 });
      }
    } catch (error) {
      toast.error('Failed to load settlement data');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterConnection, filterPeriodFrom, filterPeriodTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Handlers ----

  const handleReconcile = async (settlementId: string) => {
    setReconciling(settlementId);
    try {
      const res = await fetch('/api/channels/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reconcile', settlementId }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(result.message || 'Reconciliation complete');
        fetchData();
      } else {
        toast.error(result.error?.message || 'Reconciliation failed');
      }
    } catch {
      toast.error('Reconciliation failed');
    } finally {
      setReconciling(null);
    }
  };

  const handleMarkReceived = async () => {
    if (!markReceivedDialog.settlement) return;
    setMarkLoading(true);
    try {
      const res = await fetch('/api/channels/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark-received',
          settlementId: markReceivedDialog.settlement.id,
          amountReceived: parseFloat(markAmount) || 0,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(result.message || 'Settlement updated');
        setMarkReceivedDialog({ open: false, settlement: null });
        setMarkAmount('');
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update settlement');
    } finally {
      setMarkLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch('/api/channels/settlement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Status updated');
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to update status');
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this settlement? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/channels/settlement?id=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast.success('Settlement deleted');
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete settlement');
    }
  };

  const handleCreateSettlement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const items = Object.values(newItems).filter(Boolean);
    const payload = {
      connectionId: formData.get('connectionId'),
      channelCode: formData.get('channelCode'),
      settlementRef: formData.get('settlementRef'),
      periodFrom: formData.get('periodFrom'),
      periodTo: formData.get('periodTo'),
      totalBookings: parseInt(formData.get('totalBookings') as string) || 0,
      totalGross: parseFloat(formData.get('totalGross') as string) || 0,
      totalCommission: parseFloat(formData.get('totalCommission') as string) || 0,
      totalNet: parseFloat(formData.get('totalNet') as string) || 0,
      totalReceived: parseFloat(formData.get('totalReceived') as string) || 0,
      currency: formData.get('currency') || 'USD',
      settlementDate: formData.get('settlementDate') || undefined,
      dueDate: formData.get('dueDate') || undefined,
      notes: formData.get('notes') || '',
      items: items.length > 0 ? items : undefined,
    };

    try {
      const res = await fetch('/api/channels/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Settlement created successfully');
        setCreateDialogOpen(false);
        setNewItemRows([0]);
        setNewItems({});
        (form as HTMLFormElement).reset();
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to create settlement');
      }
    } catch {
      toast.error('Failed to create settlement');
    } finally {
      setCreateLoading(false);
    }
  };

  const addNewItemRow = () => {
    const idx = newItemRows.length > 0 ? Math.max(...newItemRows) + 1 : 0;
    setNewItemRows([...newItemRows, idx]);
  };

  const removeNewItemRow = (idx: number) => {
    setNewItemRows(newItemRows.filter(i => i !== idx));
    const updated = { ...newItems };
    delete updated[idx];
    setNewItems(updated);
  };

  const updateNewItem = (idx: number, field: string, value: any) => {
    setNewItems(prev => ({
      ...prev,
      [idx]: { ...prev[idx], [field]: value },
    }));
  };

  // ---- Status Badges ----

  const getSettlementStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><Check className="h-3 w-3 mr-1" />Received</Badge>;
      case 'reconciled':
        return <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"><Check className="h-3 w-3 mr-1" />Reconciled</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'disputed':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><X className="h-3 w-3 mr-1" />Disputed</Badge>;
      case 'partial':
        return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"><AlertTriangle className="h-3 w-3 mr-1" />Partial</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><Check className="h-3 w-3 mr-1" />Matched</Badge>;
      case 'discrepancy':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><AlertTriangle className="h-3 w-3 mr-1" />Discrepancy</Badge>;
      case 'missing':
        return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"><X className="h-3 w-3 mr-1" />Missing</Badge>;
      case 'overpaid':
        return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"><TrendingUp className="h-3 w-3 mr-1" />Overpaid</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // ---- Filtered settlements ----

  const filteredSettlements = settlements.filter(s => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return s.status === 'pending';
    if (activeTab === 'received') return s.status === 'received' || s.status === 'reconciled';
    if (activeTab === 'disputed') return s.status === 'disputed';
    if (activeTab === 'partial') return s.status === 'partial';
    return true;
  });

  // ---- Loading state ----

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settlement Reconciliation</h1>
          <p className="text-muted-foreground">Match OTA invoices with internal booking records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Settlement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Settlement</DialogTitle>
                <DialogDescription>Enter OTA settlement details and line items</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSettlement} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="channelCode">Channel Code</Label>
                    <Select name="channelCode" required>
                      <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="booking_com">Booking.com</SelectItem>
                        <SelectItem value="expedia">Expedia</SelectItem>
                        <SelectItem value="airbnb">Airbnb</SelectItem>
                        <SelectItem value="agoda">Agoda</SelectItem>
                        <SelectItem value="vrbo">Vrbo</SelectItem>
                        <SelectItem value="google_hotel">Google Hotel</SelectItem>
                        <SelectItem value="make_my_trip">MakeMyTrip</SelectItem>
                        <SelectItem value="priceline">Priceline</SelectItem>
                        <SelectItem value="hotels_com">Hotels.com</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settlementRef">Settlement Reference</Label>
                    <Input name="settlementRef" placeholder="e.g. INV-2024-001" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="periodFrom">Period From</Label>
                    <Input name="periodFrom" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="periodTo">Period To</Label>
                    <Input name="periodTo" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalGross">Total Gross</Label>
                    <Input name="totalGross" type="number" step="0.01" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalCommission">Total Commission</Label>
                    <Input name="totalCommission" type="number" step="0.01" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalNet">Total Net</Label>
                    <Input name="totalNet" type="number" step="0.01" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select name="currency" defaultValue="USD">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="INR">INR</SelectItem>
                        <SelectItem value="JPY">JPY</SelectItem>
                        <SelectItem value="AUD">AUD</SelectItem>
                        <SelectItem value="THB">THB</SelectItem>
                        <SelectItem value="AED">AED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input name="dueDate" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settlementDate">Settlement Date</Label>
                    <Input name="settlementDate" type="date" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input name="notes" placeholder="Optional notes" />
                  </div>
                  <input type="hidden" name="totalBookings" value={newItemRows.length} />
                  <input type="hidden" name="totalReceived" value="0" />
                </div>

                {/* Items */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Line Items</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addNewItemRow}>
                      <Plus className="h-3 w-3 mr-1" /> Add Item
                    </Button>
                  </div>
                  <ScrollArea className="max-h-60">
                    {newItemRows.map(idx => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-2 items-end">
                        <Input placeholder="Guest name" onChange={e => updateNewItem(idx, 'guestName', e.target.value)} />
                        <Input placeholder="Channel booking ref" onChange={e => updateNewItem(idx, 'channelBookingRef', e.target.value)} />
                        <Input type="date" onChange={e => updateNewItem(idx, 'checkIn', e.target.value || undefined)} />
                        <div className="flex gap-1">
                          <Input type="number" step="0.01" placeholder="Gross" className="flex-1" onChange={e => updateNewItem(idx, 'grossAmount', parseFloat(e.target.value) || 0)} />
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeNewItemRow(idx)}>
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createLoading}>
                    {createLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Create Settlement
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <FileText className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Settlements</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalSettled)}</p>
                <p className="text-xs text-muted-foreground">Total Settled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.pending)}</p>
                <p className="text-xs text-muted-foreground">Pending Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.disputed)}</p>
                <p className="text-xs text-muted-foreground">Disputed Amount</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-500/10 to-teal-600/5 border-teal-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-500/20">
                <DollarSign className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalCommission)}</p>
                <p className="text-xs text-muted-foreground">Total Commissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="reconciled">Reconciled</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="w-[160px]"
              value={filterPeriodFrom}
              onChange={e => setFilterPeriodFrom(e.target.value)}
              placeholder="Period From"
            />
            <Input
              type="date"
              className="w-[160px]"
              value={filterPeriodTo}
              onChange={e => setFilterPeriodTo(e.target.value)}
              placeholder="Period To"
            />
            {(filterStatus !== 'all' || filterPeriodFrom || filterPeriodTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterStatus('all');
                  setFilterPeriodFrom('');
                  setFilterPeriodTo('');
                }}
              >
                <X className="h-3 w-3 mr-1" /> Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Settlements</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="received">Received</TabsTrigger>
          <TabsTrigger value="partial">Partial</TabsTrigger>
          <TabsTrigger value="disputed" className="text-red-600 dark:text-red-400">
            Disputed
          </TabsTrigger>
          <TabsTrigger value="discrepancy">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Discrepancies ({discrepancyStats.totalItems})
          </TabsTrigger>
          <TabsTrigger value="summary">
            <TrendingUp className="h-4 w-4 mr-1" />
            Summary
          </TabsTrigger>
        </TabsList>

        {/* ---- All/Pending/Received/Disputed Tabs ---- */}
        {['all', 'pending', 'received', 'partial', 'disputed'].includes(activeTab) && (
          <TabsContent value={activeTab} className="mt-4">
            {filteredSettlements.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Landmark className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No settlements found</p>
                  <p className="text-sm text-muted-foreground">
                    {activeTab === 'all'
                      ? 'Create your first settlement to get started'
                      : `No ${activeTab} settlements`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[600px]">
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Channel</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Bookings</TableHead>
                          <TableHead className="text-right">Gross</TableHead>
                          <TableHead className="text-right">Commission</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                          <TableHead className="text-right">Received</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSettlements.map((settlement) => {
                          const isExpanded = expandedRow === settlement.id;
                          const hasDiscrepancy = settlement.settlementItems.some(
                            i => i.status === 'discrepancy' || i.discrepancy !== 0
                          );
                          return (
                            <>
                              <TableRow
                                key={settlement.id}
                                className={hasDiscrepancy ? 'bg-red-50/50 dark:bg-red-950/10' : ''}
                              >
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => setExpandedRow(isExpanded ? null : settlement.id)}
                                  >
                                    {isExpanded
                                      ? <ChevronUp className="h-4 w-4" />
                                      : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{settlement.settlementRef}</span>
                                    <span className="text-xs text-muted-foreground">{settlement.currency}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="capitalize">{settlement.channelCode.replace(/_/g, ' ')}</Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-sm">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    {formatDate(new Date(settlement.periodFrom))}
                                    <span className="text-muted-foreground">→</span>
                                    {formatDate(new Date(settlement.periodTo))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-medium">{settlement.totalBookings}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(settlement.totalGross)}</TableCell>
                                <TableCell className="text-right text-orange-600 dark:text-orange-400">
                                  {formatCurrency(settlement.totalCommission)}
                                </TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(settlement.totalNet)}</TableCell>
                                <TableCell className="text-right">
                                  <span className={settlement.totalReceived < settlement.totalNet ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                    {formatCurrency(settlement.totalReceived)}
                                  </span>
                                </TableCell>
                                <TableCell>{getSettlementStatusBadge(settlement.status)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleReconcile(settlement.id)}
                                      disabled={reconciling === settlement.id}
                                    >
                                      {reconciling === settlement.id
                                        ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                        : <ArrowRightLeft className="h-3 w-3 mr-1" />}
                                      Reconcile
                                    </Button>
                                    {(settlement.status === 'pending' || settlement.status === 'partial') && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setMarkReceivedDialog({ open: true, settlement });
                                          setMarkAmount(String(settlement.totalNet - settlement.totalReceived));
                                        }}
                                      >
                                        <Download className="h-3 w-3 mr-1" />
                                        Receive
                                      </Button>
                                    )}
                                    {settlement.status === 'disputed' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleUpdateStatus(settlement.id, 'pending')}
                                      >
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Re-open
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => handleDelete(settlement.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>

                              {/* Expanded detail */}
                              {isExpanded && (
                                <TableRow>
                                  <TableCell colSpan={11} className="bg-muted/30 p-4">
                                    <div className="space-y-4">
                                      {/* Summary header */}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                        <div className="text-sm">
                                          <span className="text-muted-foreground">Settlement Date:</span>
                                          <p className="font-medium">
                                            {settlement.settlementDate ? formatDate(new Date(settlement.settlementDate)) : 'N/A'}
                                          </p>
                                        </div>
                                        <div className="text-sm">
                                          <span className="text-muted-foreground">Due Date:</span>
                                          <p className="font-medium">
                                            {settlement.dueDate ? formatDate(new Date(settlement.dueDate)) : 'N/A'}
                                          </p>
                                        </div>
                                        <div className="text-sm">
                                          <span className="text-muted-foreground">Outstanding:</span>
                                          <p className="font-medium text-amber-600">
                                            {formatCurrency(settlement.totalNet - settlement.totalReceived)}
                                          </p>
                                        </div>
                                        <div className="text-sm">
                                          <span className="text-muted-foreground">Items:</span>
                                          <p className="font-medium">
                                            {settlement.settlementItems.filter(i => i.status === 'matched').length} matched
                                          </p>
                                        </div>
                                        <div className="text-sm">
                                          <span className="text-muted-foreground">Discrepancies:</span>
                                          <p className="font-medium text-red-600">
                                            {settlement.settlementItems.filter(i => i.status === 'discrepancy').length}
                                          </p>
                                        </div>
                                        <div className="text-sm">
                                          <span className="text-muted-foreground">Missing:</span>
                                          <p className="font-medium text-orange-600">
                                            {settlement.settlementItems.filter(i => i.status === 'missing').length}
                                          </p>
                                        </div>
                                      </div>

                                      {settlement.notes && (
                                        <div className="text-sm bg-background rounded p-3 border">
                                          <span className="text-muted-foreground">Notes: </span>
                                          {settlement.notes}
                                        </div>
                                      )}

                                      {/* Items table */}
                                      {settlement.settlementItems.length > 0 ? (
                                        <ScrollArea className="max-h-72">
                                          <div className="overflow-x-auto">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Booking Ref</TableHead>
                                                <TableHead>Guest</TableHead>
                                                <TableHead>Check-in</TableHead>
                                                <TableHead>Check-out</TableHead>
                                                <TableHead>Room</TableHead>
                                                <TableHead className="text-right">Gross</TableHead>
                                                <TableHead className="text-right">Commission</TableHead>
                                                <TableHead className="text-right">Net</TableHead>
                                                <TableHead className="text-right">Received</TableHead>
                                                <TableHead className="text-right">Discrepancy</TableHead>
                                                <TableHead>Status</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {settlement.settlementItems.map(item => (
                                                <TableRow
                                                  key={item.id}
                                                  className={
                                                    item.discrepancy !== 0 || item.status === 'discrepancy'
                                                      ? 'bg-red-50/50 dark:bg-red-950/10'
                                                      : ''
                                                  }
                                                >
                                                  <TableCell className="text-sm">
                                                    {item.channelBookingRef || item.bookingId?.slice(0, 8) || '—'}
                                                  </TableCell>
                                                  <TableCell>
                                                    <div className="flex items-center gap-1">
                                                      <Users className="h-3 w-3 text-muted-foreground" />
                                                      {item.guestName || '—'}
                                                    </div>
                                                  </TableCell>
                                                  <TableCell className="text-sm">
                                                    {item.checkIn ? formatDate(new Date(item.checkIn)) : '—'}
                                                  </TableCell>
                                                  <TableCell className="text-sm">
                                                    {item.checkOut ? formatDate(new Date(item.checkOut)) : '—'}
                                                  </TableCell>
                                                  <TableCell className="text-sm">{item.roomType || '—'}</TableCell>
                                                  <TableCell className="text-right text-sm">{formatCurrency(item.grossAmount)}</TableCell>
                                                  <TableCell className="text-right text-sm text-orange-600">{formatCurrency(item.commissionAmount)}</TableCell>
                                                  <TableCell className="text-right text-sm font-medium">{formatCurrency(item.netAmount)}</TableCell>
                                                  <TableCell className="text-right text-sm">{formatCurrency(item.receivedAmount)}</TableCell>
                                                  <TableCell className={`text-right text-sm font-bold ${item.discrepancy !== 0 ? 'text-red-600' : ''}`}>
                                                    {item.discrepancy !== 0
                                                      ? `${item.discrepancy > 0 ? '+' : ''}${formatCurrency(item.discrepancy)}`
                                                      : '—'}
                                                  </TableCell>
                                                  <TableCell>{getItemStatusBadge(item.status)}</TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                          </div>
                                        </ScrollArea>
                                      ) : (
                                        <p className="text-sm text-muted-foreground py-4 text-center">
                                          No line items for this settlement. Reconcile to match bookings.
                                        </p>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* ---- Discrepancy Report Tab ---- */}
        <TabsContent value="discrepancy" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Discrepancy Report
              </CardTitle>
              <CardDescription>
                {discrepancyStats.totalItems} items with discrepancies totaling {formatCurrency(discrepancyStats.totalDiscrepancy)}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {discrepancyItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Check className="h-12 w-12 text-emerald-500 mb-4" />
                  <p className="text-muted-foreground">No discrepancies found</p>
                  <p className="text-sm text-muted-foreground">All settlements are properly matched</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Settlement Ref</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Booking Ref</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead className="text-right">Discrepancy</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discrepancyItems.map(item => (
                        <TableRow key={item.id} className="bg-red-50/50 dark:bg-red-950/10">
                          <TableCell className="font-medium">{item.settlement?.settlementRef || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {item.settlement?.channelCode?.replace(/_/g, ' ') || '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{item.channelBookingRef || '—'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              {item.guestName || '—'}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.checkIn ? formatDate(new Date(item.checkIn)) : '—'}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.netAmount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.receivedAmount)}</TableCell>
                          <TableCell className="text-right font-bold text-red-600">
                            {item.discrepancy > 0 ? '+' : ''}{formatCurrency(item.discrepancy)}
                          </TableCell>
                          <TableCell>{getItemStatusBadge(item.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Summary Tab ---- */}
        <TabsContent value="summary" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Channel Summary Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Financial Summary by Channel
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {channelSummary.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Landmark className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No settlement data available</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-96">
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Channel</TableHead>
                          <TableHead className="text-right">Gross</TableHead>
                          <TableHead className="text-right">Commission</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                          <TableHead className="text-right">Received</TableHead>
                          <TableHead className="text-right">Outstanding</TableHead>
                          <TableHead className="text-center">Settlements</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {channelSummary.map(ch => (
                          <TableRow key={ch.channelCode}>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {ch.channelCode.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(ch.totalGross)}</TableCell>
                            <TableCell className="text-right text-orange-600">{formatCurrency(ch.totalCommission)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(ch.totalNet)}</TableCell>
                            <TableCell className="text-right text-emerald-600">{formatCurrency(ch.totalReceived)}</TableCell>
                            <TableCell className={`text-right font-medium ${ch.outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {formatCurrency(ch.outstanding)}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-sm">{ch.count}</span>
                              {ch.pending > 0 && (
                                <Badge className="ml-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-1.5 py-0">
                                  {ch.pending}p
                                </Badge>
                              )}
                              {ch.disputed > 0 && (
                                <Badge className="ml-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-1.5 py-0">
                                  {ch.disputed}d
                                </Badge>
                              )}
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

            {/* Overall Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Overall Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Total Gross Revenue</span>
                    <span className="text-lg font-bold">{formatCurrency(stats.totalGross)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                    <span className="text-sm font-medium">Total Commissions Paid</span>
                    <span className="text-lg font-bold text-orange-600">-{formatCurrency(stats.totalCommission)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Net Revenue (After Commission)</span>
                    <span className="text-lg font-bold">{formatCurrency(stats.totalNet)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                    <span className="text-sm font-medium">Total Received</span>
                    <span className="text-lg font-bold text-emerald-600">{formatCurrency(stats.totalReceived)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                    <span className="text-sm font-medium">Outstanding Amount</span>
                    <span className="text-lg font-bold text-amber-600">
                      {formatCurrency(stats.totalNet - stats.totalReceived)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <span className="text-sm font-medium">Disputed Amount</span>
                    <span className="text-lg font-bold text-red-600">{formatCurrency(stats.disputed)}</span>
                  </div>
                </div>

                {/* Completion bar */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Recovery Rate</span>
                    <span className="font-medium">
                      {stats.totalNet > 0
                        ? `${((stats.totalReceived / stats.totalNet) * 100).toFixed(1)}%`
                        : '0%'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${stats.totalNet > 0 ? Math.min((stats.totalReceived / stats.totalNet) * 100, 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Mark Received Dialog */}
      <Dialog
        open={markReceivedDialog.open}
        onOpenChange={(open) => {
          if (!open) setMarkReceivedDialog({ open: false, settlement: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Settlement as Received</DialogTitle>
            <DialogDescription>
              {markReceivedDialog.settlement && (
                <>Recording payment for settlement <strong>{markReceivedDialog.settlement.settlementRef}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {markReceivedDialog.settlement && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Net Amount:</span>
                  <span className="font-medium">{formatCurrency(markReceivedDialog.settlement.totalNet)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Already Received:</span>
                  <span className="font-medium">{formatCurrency(markReceivedDialog.settlement.totalReceived)}</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mark-amount">Amount Received</Label>
                  <Input
                    id="mark-amount"
                    type="number"
                    step="0.01"
                    value={markAmount}
                    onChange={e => setMarkAmount(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkReceivedDialog({ open: false, settlement: null })}>Cancel</Button>
            <Button onClick={handleMarkReceived} disabled={markLoading || !markAmount}>
              {markLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
