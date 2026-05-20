'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  RefreshCw,
  Users,
  Activity,
  CircleDot,
  Loader2,
  Filter,
  Eye,
  Edit,
  Coins,
  CreditCard,
  Zap,
  ShieldCheck,
  Wrench,
  Gamepad2,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Heart,
  Gift,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────

interface CasinoTable {
  id: string;
  propertyId: string;
  name: string;
  gameType: string;
  tableNumber: number;
  minBet: number;
  maxBet: number;
  status: string;
  dealerName: string | null;
  isActive: boolean;
  transactionCount: number;
  createdAt: string;
}

interface CasinoTransaction {
  id: string;
  tableId: string;
  guestId: string | null;
  folioId: string | null;
  bookingId: string | null;
  transactionType: string;
  amount: number;
  currency: string;
  chipColor: string | null;
  pitBossApproval: string | null;
  table: { id: string; name: string; gameType: string; tableNumber: number };
  createdAt: string;
}

interface GameTypeBreakdown {
  gameType: string;
  count: number;
}

interface TypeBreakdown {
  type: string;
  count: number;
  amount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

const GAME_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  poker: { label: 'Poker', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', icon: '🃏' },
  blackjack: { label: 'Blackjack', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: '🂡' },
  roulette: { label: 'Roulette', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: '🎡' },
  baccarat: { label: 'Baccarat', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300', icon: '🎴' },
  craps: { label: 'Craps', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300', icon: '🎲' },
};

const TABLE_STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  open: { label: 'Open', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', dotColor: 'bg-emerald-500' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300', dotColor: 'bg-gray-400' },
  maintenance: { label: 'Maintenance', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', dotColor: 'bg-amber-500' },
  reserved: { label: 'Reserved', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', dotColor: 'bg-blue-500' },
};

const TX_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  chip_buy: { label: 'Chip Buy', color: 'text-emerald-600', icon: ArrowUpRight },
  chip_cash: { label: 'Chip Cash', color: 'text-sky-600', icon: ArrowDownRight },
  bet: { label: 'Bet', color: 'text-amber-600', icon: Gamepad2 },
  win: { label: 'Win', color: 'text-emerald-600', icon: TrendingUp },
  tip: { label: 'Tip', color: 'text-violet-600', icon: Heart },
  comp: { label: 'Comp', color: 'text-pink-600', icon: Gift },
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
};

const formatTime = (iso: string) => {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

// ── Component ──────────────────────────────────────────────────────────

export default function ResortCasino() {
  // ── State ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('tables');
  const [tables, setTables] = useState<CasinoTable[]>([]);
  const [transactions, setTransactions] = useState<CasinoTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gameTypeFilter, setGameTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [txTypeFilter, setTxTypeFilter] = useState('all');

  // Stats
  const [tableStats, setTableStats] = useState({ openTables: 0, totalTables: 0, todayRevenue: 0, gameTypeBreakdown: [] as GameTypeBreakdown[] });
  const [txStats, setTxStats] = useState({ todayChipBuy: 0, todayChipCash: 0, todayPayouts: 0, todayTotalBets: 0, todayComps: 0, todayTransactionCount: 0, todayNetRevenue: 0, typeBreakdown: [] as TypeBreakdown[] });

  // Dialog
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [showTxDialog, setShowTxDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [tableForm, setTableForm] = useState({ propertyId: '', name: '', gameType: 'poker', tableNumber: '', minBet: '0', maxBet: '0', status: 'open', dealerName: '' });
  const [txForm, setTxForm] = useState({ tableId: '', transactionType: 'chip_buy', amount: '0', chipColor: '', pitBossApproval: '' });

  // ── Data Fetching ───────────────────────────────────────────────

  const fetchTables = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (gameTypeFilter !== 'all') params.set('gameType', gameTypeFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('limit', '50');

      const res = await fetch(`/api/resort/casino/tables?${params}`);
      const json = await res.json();
      if (json.success) {
        setTables(json.data);
        setTableStats(json.stats);
      }
    } catch {
      toast.error('Failed to load casino tables');
    } finally {
      setLoading(false);
    }
  }, [search, gameTypeFilter, statusFilter]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (txTypeFilter !== 'all') params.set('transactionType', txTypeFilter);
      params.set('limit', '100');

      const res = await fetch(`/api/resort/casino/transactions?${params}`);
      const json = await res.json();
      if (json.success) {
        setTransactions(json.data);
        setTxStats(json.stats);
      }
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [search, txTypeFilter]);

  useEffect(() => {
    if (activeTab === 'tables') fetchTables();
    else fetchTransactions();
  }, [activeTab, fetchTables, fetchTransactions]);

  // Auto-refresh transactions every 30s
  useEffect(() => {
    if (activeTab !== 'transactions') return;
    const interval = setInterval(fetchTransactions, 30000);
    return () => clearInterval(interval);
  }, [activeTab, fetchTransactions]);

  // ── Handlers ────────────────────────────────────────────────────

  const handleCreateTable = async () => {
    if (!tableForm.name || !tableForm.gameType || tableForm.tableNumber === '') {
      toast.error('Please fill in required fields');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/resort/casino/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...tableForm,
          tableNumber: parseInt(tableForm.tableNumber),
          minBet: parseFloat(tableForm.minBet),
          maxBet: parseFloat(tableForm.maxBet),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Casino table created successfully');
        setShowTableDialog(false);
        setTableForm({ propertyId: '', name: '', gameType: 'poker', tableNumber: '', minBet: '0', maxBet: '0', status: 'open', dealerName: '' });
        fetchTables();
      } else {
        toast.error(json.error || 'Failed to create table');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTransaction = async () => {
    if (!txForm.tableId || !txForm.transactionType || txForm.amount === '' || parseFloat(txForm.amount) <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/resort/casino/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...txForm,
          amount: parseFloat(txForm.amount),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Transaction recorded successfully');
        setShowTxDialog(false);
        setTxForm({ tableId: '', transactionType: 'chip_buy', amount: '0', chipColor: '', pitBossApproval: '' });
        fetchTransactions();
      } else {
        toast.error(json.error || 'Failed to record transaction');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Casino & Gaming</h2>
          <p className="text-muted-foreground">Pit boss dashboard — table management, live transactions, and revenue</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { if (activeTab === 'tables') fetchTables(); else fetchTransactions(); }} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
          {activeTab === 'tables' ? (
            <Button size="sm" onClick={() => setShowTableDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Table
            </Button>
          ) : (
            <Button size="sm" onClick={() => setShowTxDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Record Transaction
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {activeTab === 'tables' ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><CircleDot className="h-3.5 w-3.5 text-emerald-500" />Open Tables</CardDescription>
              <CardTitle className="text-2xl">{tableStats.openTables} <span className="text-sm font-normal text-muted-foreground">/ {tableStats.totalTables}</span></CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />Today&apos;s Revenue</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(tableStats.todayRevenue)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-violet-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><Gamepad2 className="h-3.5 w-3.5" />Game Types</CardDescription>
              <CardTitle className="text-2xl">{tableStats.gameTypeBreakdown.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-sky-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Activity</CardDescription>
              <CardTitle className="flex items-center gap-1.5 text-2xl"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />Live</CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><Coins className="h-3.5 w-3.5" />Chip Sales</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(txStats.todayChipBuy)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-red-500" />Payouts</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(txStats.todayPayouts)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />Net Revenue</CardDescription>
              <CardTitle className={cn('text-2xl', txStats.todayNetRevenue >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {txStats.todayNetRevenue >= 0 ? <TrendingUp className="inline h-4 w-4 mr-1" /> : <TrendingDown className="inline h-4 w-4 mr-1" />}
                {formatCurrency(Math.abs(txStats.todayNetRevenue))}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-sky-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" />Transactions</CardDescription>
              <CardTitle className="text-2xl">{txStats.todayTransactionCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearch(''); }}>
        <TabsList>
          <TabsTrigger value="tables">
            <Gamepad2 className="h-4 w-4 mr-1.5" />
            Table Status
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <Activity className="h-4 w-4 mr-1.5" />
            Live Transactions
            {activeTab === 'transactions' && (
              <span className="ml-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tables Tab ─────────────────────────────────────────── */}
        <TabsContent value="tables" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search table name or dealer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={gameTypeFilter} onValueChange={setGameTypeFilter}>
              <SelectTrigger className="w-[160px]"><Filter className="h-4 w-4 mr-1.5" /><SelectValue placeholder="Game Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Games</SelectItem>
                {Object.entries(GAME_TYPE_CONFIG).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.icon} {val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(TABLE_STATUS_CONFIG).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table Status Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : tables.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Gamepad2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" /><p className="text-muted-foreground">No casino tables found</p></CardContent></Card>
          ) : (
            <>
              {/* Game Type Badges */}
              <div className="flex flex-wrap gap-2">
                {tableStats.gameTypeBreakdown.map(g => {
                  const cfg = GAME_TYPE_CONFIG[g.gameType];
                  return (
                    <Badge key={g.gameType} className={cn('gap-1', cfg?.color)}>
                      {cfg?.icon} {cfg?.label}: {g.count}
                    </Badge>
                  );
                })}
              </div>

              {/* Grid */}
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tables.map(table => {
                  const gameCfg = GAME_TYPE_CONFIG[table.gameType] || { label: table.gameType, color: 'bg-gray-100 text-gray-800', icon: '🎲' };
                  const statusCfg = TABLE_STATUS_CONFIG[table.status] || { label: table.status, color: 'bg-gray-100 text-gray-800', dotColor: 'bg-gray-400' };

                  return (
                    <Card key={table.id} className={cn('transition-all hover:shadow-md', table.status === 'open' && 'ring-1 ring-emerald-200 dark:ring-emerald-800')}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-lg">
                              {gameCfg.icon}
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm">{table.name}</h4>
                              <p className="text-xs text-muted-foreground">Table #{table.tableNumber}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={cn('h-2 w-2 rounded-full', statusCfg.dotColor)} />
                            <Badge className={cn('text-[10px] h-5', statusCfg.color)}>{statusCfg.label}</Badge>
                          </div>
                        </div>

                        <Badge className={cn('mb-3 text-[10px]', gameCfg.color)}>{gameCfg.icon} {gameCfg.label}</Badge>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded bg-muted/50">
                            <p className="text-muted-foreground">Min Bet</p>
                            <p className="font-semibold">{formatCurrency(table.minBet)}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/50">
                            <p className="text-muted-foreground">Max Bet</p>
                            <p className="font-semibold">{formatCurrency(table.maxBet)}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2 border-t text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{table.transactionCount} txns</span>
                          {table.dealerName && (
                            <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" />{table.dealerName}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Transactions Tab ───────────────────────────────────── */}
        <TabsContent value="transactions" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={txTypeFilter} onValueChange={setTxTypeFilter}>
              <SelectTrigger className="w-[160px]"><Filter className="h-4 w-4 mr-1.5" /><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(TX_TYPE_CONFIG).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type Breakdown Chips */}
          <div className="flex flex-wrap gap-2">
            {txStats.typeBreakdown.map(b => {
              const cfg = TX_TYPE_CONFIG[b.type] || { label: b.type, color: 'text-gray-600', icon: Activity };
              return (
                <Badge key={b.type} variant="outline" className="gap-1.5 text-xs">
                  <cfg.icon className={cn('h-3 w-3', cfg.color)} />
                  {cfg.label}: {b.count} ({formatCurrency(b.amount)})
                </Badge>
              );
            })}
          </div>

          {/* Pit Boss Quick Stats */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <Card className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Bets</p>
              <p className="text-lg font-bold">{formatCurrency(txStats.todayTotalBets)}</p>
            </Card>
            <Card className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Chip Cash-Ins</p>
              <p className="text-lg font-bold">{formatCurrency(txStats.todayChipCash)}</p>
            </Card>
            <Card className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Comps Issued</p>
              <p className="text-lg font-bold">{formatCurrency(txStats.todayComps)}</p>
            </Card>
          </div>

          {/* Live Transaction Feed */}
          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    Live Transaction Feed
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">{transactions.length} transactions</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[500px]">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Time</TableHead>
                        <TableHead>Table</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="hidden md:table-cell">Chip</TableHead>
                        <TableHead className="hidden lg:table-cell">Approval</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No transactions recorded yet</TableCell>
                        </TableRow>
                      ) : transactions.map(tx => {
                        const txCfg = TX_TYPE_CONFIG[tx.transactionType] || { label: tx.transactionType, color: 'text-gray-600', icon: Activity };
                        const TxIcon = txCfg.icon;
                        const isPositive = ['chip_buy', 'bet', 'comp'].includes(tx.transactionType);

                        return (
                          <TableRow key={tx.id} className="hover:bg-muted/30">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(tx.createdAt)}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{tx.table?.name || '—'}</span>
                                <Badge variant="outline" className="text-[10px] h-5 hidden sm:inline-flex">
                                  {tx.table?.gameType}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <TxIcon className={cn('h-3.5 w-3.5', txCfg.color)} />
                                <span className={cn('text-sm font-medium', txCfg.color)}>{txCfg.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={cn('text-sm font-semibold', isPositive ? 'text-emerald-600' : 'text-red-600')}>
                                {isPositive ? '+' : '-'}{formatCurrency(tx.amount)}
                              </span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {tx.chipColor ? (
                                <Badge variant="outline" className="text-[10px] gap-1">
                                  <span className={cn('h-2 w-2 rounded-full', tx.chipColor === 'red' ? 'bg-red-500' : tx.chipColor === 'blue' ? 'bg-blue-500' : tx.chipColor === 'green' ? 'bg-emerald-500' : tx.chipColor === 'black' ? 'bg-gray-800' : 'bg-amber-500')} />
                                  {tx.chipColor}
                                </Badge>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                              {tx.pitBossApproval || '—'}
                            </TableCell>
                          </TableRow>
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
      </Tabs>

      {/* ── Create Table Dialog ─────────────────────────────────── */}
      <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Gamepad2 className="h-5 w-5" />Add Casino Table</DialogTitle>
            <DialogDescription>Register a new gaming table in the pit</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label>Table Name <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g., Royal Flush" value={tableForm.name} onChange={e => setTableForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label>Table Number <span className="text-red-500">*</span></Label>
                <Input type="number" placeholder="e.g., 1" value={tableForm.tableNumber} onChange={e => setTableForm(f => ({ ...f, tableNumber: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Game Type <span className="text-red-500">*</span></Label>
                <Select value={tableForm.gameType} onValueChange={v => setTableForm(f => ({ ...f, gameType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(GAME_TYPE_CONFIG).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.icon} {val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={tableForm.status} onValueChange={v => setTableForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TABLE_STATUS_CONFIG).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Bet ($)</Label>
                <Input type="number" placeholder="0" value={tableForm.minBet} onChange={e => setTableForm(f => ({ ...f, minBet: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Max Bet ($)</Label>
                <Input type="number" placeholder="0" value={tableForm.maxBet} onChange={e => setTableForm(f => ({ ...f, maxBet: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dealer Name</Label>
              <Input placeholder="Optional dealer name" value={tableForm.dealerName} onChange={e => setTableForm(f => ({ ...f, dealerName: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTableDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTable} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Transaction Dialog ───────────────────────────── */}
      <Dialog open={showTxDialog} onOpenChange={setShowTxDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Record Transaction</DialogTitle>
            <DialogDescription>Log a new casino transaction</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Table <span className="text-red-500">*</span></Label>
              <Select value={txForm.tableId} onValueChange={v => setTxForm(f => ({ ...f, tableId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a table" /></SelectTrigger>
                <SelectContent>
                  {tables.filter(t => t.status === 'open').map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} (#{t.tableNumber}) — {GAME_TYPE_CONFIG[t.gameType]?.icon} {GAME_TYPE_CONFIG[t.gameType]?.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Transaction Type <span className="text-red-500">*</span></Label>
                <Select value={txForm.transactionType} onValueChange={v => setTxForm(f => ({ ...f, transactionType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TX_TYPE_CONFIG).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount ($) <span className="text-red-500">*</span></Label>
                <Input type="number" placeholder="0" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Chip Color</Label>
                <Select value={txForm.chipColor} onValueChange={v => setTxForm(f => ({ ...f, chipColor: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="red">Red</SelectItem>
                    <SelectItem value="blue">Blue</SelectItem>
                    <SelectItem value="green">Green</SelectItem>
                    <SelectItem value="black">Black</SelectItem>
                    <SelectItem value="white">White</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pit Boss Approval</Label>
                <Input placeholder="Optional" value={txForm.pitBossApproval} onChange={e => setTxForm(f => ({ ...f, pitBossApproval: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTxDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTransaction} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Record Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
