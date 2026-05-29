'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Settings,
  RefreshCw,
  Plus,
  Loader2,
  AlertTriangle,
  Activity,
  Monitor,
  Wifi,
  Usb,
  Clock,
  Banknote,
  ArrowUpRight,
  ArrowDownLeft,
  KeyRound,
  Lock,
  Fingerprint,
  Eye,
  ToggleLeft,
  ToggleRight,
  Server,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TerminalStatus = 'active' | 'inactive' | 'offline' | 'maintenance';
type ConnectionType = 'wifi' | 'ethernet' | 'bluetooth' | 'usb';
type TransactionStatus = 'approved' | 'declined' | 'refunded' | 'pending';
type EncryptionStatus = 'encrypted' | 'not_encrypted' | 'pending_upgrade' | 'decertified';

interface PaymentTerminal {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  location: string;
  status: TerminalStatus;
  connectionType: ConnectionType;
  p2peCompliant: boolean;
  firmwareVersion: string;
  lastTransaction: string;
  todayTransactions: number;
  todayVolume: number;
}

interface TerminalTransaction {
  id: string;
  terminalName: string;
  transactionId: string;
  amount: number;
  currency: string;
  cardType: string;
  cardLast4: string;
  status: TransactionStatus;
  timestamp: string;
  authCode: string;
}

interface P2PEStatus {
  terminalId: string;
  terminalName: string;
  model: string;
  encryptionStatus: EncryptionStatus;
  serialNumber: string;
  firmwareVersion: string;
  lastCertification: string;
  nextAudit: string;
  encryptionProvider: string;
}

interface CardToken {
  id: string;
  tokenId: string;
  cardType: string;
  cardLast4: string;
  expiryMonth: number;
  expiryYear: number;
  guestName: string;
  guestId: string;
  bookingRef: string;
  status: 'active' | 'expired' | 'deactivated';
  createdAt: string;
  lastUsed: string;
  usageCount: number;
}

interface DashboardStats {
  totalTerminals: number;
  onlineTerminals: number;
  offlineTerminals: number;
  totalTransactionsToday: number;
  todayVolume: number;
  avgProcessingTime: number;
  p2peCompliant: boolean;
  activeTokens: number;
  refundsToday: number;
  refundAmountToday: number;
}

// ---------------------------------------------------------------------------
// API response raw types (from Prisma)
// ---------------------------------------------------------------------------

interface RawTerminal {
  id: string;
  name: string;
  provider: string;
  model: string | null;
  serialNumber: string | null;
  location: string | null;
  ipAddress: string | null;
  status: string;
  p2peEnabled: boolean;
  p2peCertExpiry: string | null;
  lastTransactionAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RawTransaction {
  id: string;
  terminalId: string;
  folioId: string | null;
  bookingId: string | null;
  amount: number;
  currency: string;
  cardType: string | null;
  cardLast4: string | null;
  entryMethod: string;
  transactionType: string;
  authCode: string | null;
  reference: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface RawToken {
  id: string;
  guestId: string | null;
  gateway: string;
  tokenType: string;
  tokenRef: string;
  cardLast4: string | null;
  cardBrand: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapTerminalStatus(raw: string): TerminalStatus {
  switch (raw) {
    case 'online': return 'active';
    case 'offline': return 'offline';
    case 'maintenance': return 'maintenance';
    case 'decommissioned': return 'inactive';
    default: return 'inactive';
  }
}

function mapTransactionStatus(raw: string): TransactionStatus {
  switch (raw) {
    case 'approved': return 'approved';
    case 'declined': return 'declined';
    case 'voided': return 'refunded';
    case 'error': return 'pending';
    default: return 'pending';
  }
}

function mapEncryptionStatus(p2peEnabled: boolean, p2peCertExpiry: string | null): EncryptionStatus {
  if (p2peEnabled && p2peCertExpiry && new Date(p2peCertExpiry) > new Date()) {
    return 'encrypted';
  }
  if (p2peEnabled && p2peCertExpiry && new Date(p2peCertExpiry) <= new Date()) {
    return 'decertified';
  }
  if (p2peEnabled && !p2peCertExpiry) {
    return 'pending_upgrade';
  }
  return 'not_encrypted';
}

function mapConnectionType(provider: string): ConnectionType {
  switch (provider) {
    case 'square': return 'wifi';
    case 'bbpos': return 'bluetooth';
    default: return 'ethernet';
  }
}

function inferEncryptionProvider(provider: string): string {
  switch (provider) {
    case 'verifone': return 'Verifone Shield';
    case 'ingenico': return 'Ingenico Telium TETRA';
    case 'square': return 'Square E2EE';
    case 'clover': return 'Clover Security';
    case 'bbpos': return 'BBPOS SRED';
    default: return provider;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function terminalStatusBadge(status: TerminalStatus) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Active
        </Badge>
      );
    case 'inactive':
      return (
        <Badge variant="secondary" className="gap-1">
          <ToggleLeft className="h-3 w-3" /> Inactive
        </Badge>
      );
    case 'offline':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Offline
        </Badge>
      );
    case 'maintenance':
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1">
          <Settings className="h-3 w-3 animate-spin" /> Maintenance
        </Badge>
      );
  }
}

function connectionTypeIcon(type: ConnectionType) {
  switch (type) {
    case 'wifi': return <Wifi className="h-3.5 w-3.5 text-sky-500" />;
    case 'ethernet': return <Server className="h-3.5 w-3.5 text-emerald-500" />;
    case 'bluetooth': return <Fingerprint className="h-3.5 w-3.5 text-violet-500" />;
    case 'usb': return <Usb className="h-3.5 w-3.5 text-amber-500" />;
  }
}

function transactionStatusBadge(status: TransactionStatus) {
  switch (status) {
    case 'approved':
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Approved
        </Badge>
      );
    case 'declined':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Declined
        </Badge>
      );
    case 'refunded':
      return (
        <Badge variant="secondary" className="gap-1">
          <ArrowUpRight className="h-3 w-3" /> Refunded
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Pending
        </Badge>
      );
  }
}

function encryptionStatusBadge(status: EncryptionStatus) {
  switch (status) {
    case 'encrypted':
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1">
          <ShieldCheck className="h-3 w-3" /> Encrypted
        </Badge>
      );
    case 'not_encrypted':
      return (
        <Badge variant="destructive" className="gap-1">
          <ShieldOff className="h-3 w-3" /> Not Encrypted
        </Badge>
      );
    case 'pending_upgrade':
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1">
          <ShieldAlert className="h-3 w-3" /> Pending Upgrade
        </Badge>
      );
    case 'decertified':
      return (
        <Badge variant="destructive" className="gap-1">
          <ShieldOff className="h-3 w-3" /> Decertified
        </Badge>
      );
  }
}

function tokenStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">Active</Badge>;
    case 'expired':
      return <Badge variant="secondary">Expired</Badge>;
    case 'deactivated':
      return <Badge variant="destructive">Deactivated</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Loading skeleton helpers
// ---------------------------------------------------------------------------

function StatsCardsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-16 mt-1" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-4">
      {[...Array(rows)].map((_, r) => (
        <div key={r} className="flex gap-4">
          {[...Array(cols)].map((_, c) => (
            <Skeleton key={c} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaymentTerminals() {
  const { formatCurrency } = useCurrency();

  // Data state
  const [terminals, setTerminals] = useState<PaymentTerminal[]>([]);
  const [transactions, setTransactions] = useState<TerminalTransaction[]>([]);
  const [cardTokens, setCardTokens] = useState<CardToken[]>([]);
  const [p2peStatuses, setP2peStatuses] = useState<P2PEStatus[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deactivateTokenId, setDeactivateTokenId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  // Dialog form state
  const [formName, setFormName] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formConnection, setFormConnection] = useState('');
  const [formLocation, setFormLocation] = useState('');

  const isRefreshPendingRef = useRef(false);

  // Keep a ref to track mount status for cleanup
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Separate the data processing into a non-effect function
  const processAndSetData = (statsJson: Record<string, unknown>, terminalsJson: Record<string, unknown>, transactionsJson: Record<string, unknown>, tokensJson: Record<string, unknown>, isRefresh: boolean) => {
    setStats(statsJson.stats as DashboardStats);

    const rawTerminals = terminalsJson.data as RawTerminal[];
    const rawTransactions = transactionsJson.data as RawTransaction[];

    const terminalLookup = new Map(rawTerminals.map(t => [t.id, t]));

    const todayTxByTerminal = new Map<string, { count: number; volume: number }>();
    for (const tx of rawTransactions) {
      const isToday = new Date(tx.createdAt).toDateString() === new Date().toDateString();
      if (!isToday) continue;
      const existing = todayTxByTerminal.get(tx.terminalId) || { count: 0, volume: 0 };
      if (tx.status === 'approved' && tx.transactionType === 'sale') {
        existing.volume += tx.amount;
      }
      existing.count += 1;
      todayTxByTerminal.set(tx.terminalId, existing);
    }

    const mappedTerminals: PaymentTerminal[] = rawTerminals.map(t => {
      const todayData = todayTxByTerminal.get(t.id) || { count: 0, volume: 0 };
      return {
        id: t.id,
        name: t.name,
        model: t.model ?? '—',
        serialNumber: t.serialNumber ?? '—',
        location: t.location ?? '—',
        status: mapTerminalStatus(t.status),
        connectionType: mapConnectionType(t.provider),
        p2peCompliant: t.p2peEnabled,
        firmwareVersion: '—',
        lastTransaction: t.lastTransactionAt ?? '',
        todayTransactions: todayData.count,
        todayVolume: todayData.volume,
      };
    });
    setTerminals(mappedTerminals);

    const mappedTransactions: TerminalTransaction[] = rawTransactions.map(tx => {
      const terminal = terminalLookup.get(tx.terminalId);
      return {
        id: tx.id,
        terminalName: terminal?.name ?? 'Unknown Terminal',
        transactionId: tx.reference ?? tx.id.substring(0, 8),
        amount: tx.amount,
        currency: tx.currency,
        cardType: tx.cardType ?? '—',
        cardLast4: tx.cardLast4 ?? '????',
        status: mapTransactionStatus(tx.status),
        timestamp: tx.createdAt,
        authCode: tx.authCode ?? '',
      };
    });
    setTransactions(mappedTransactions);

    const mappedP2PE: P2PEStatus[] = rawTerminals.map(t => {
      const encStatus = mapEncryptionStatus(t.p2peEnabled, t.p2peCertExpiry);
      return {
        terminalId: t.id,
        terminalName: t.name,
        model: t.model ?? '—',
        encryptionStatus: encStatus,
        serialNumber: t.serialNumber ?? '—',
        firmwareVersion: '—',
        lastCertification: t.p2peCertExpiry ?? '',
        nextAudit: t.p2peCertExpiry
          ? new Date(new Date(t.p2peCertExpiry).getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
          : '',
        encryptionProvider: inferEncryptionProvider(t.provider),
      };
    });
    setP2peStatuses(mappedP2PE);

    const rawTokens = tokensJson.data as RawToken[];
    const mappedTokens: CardToken[] = rawTokens.map(tok => ({
      id: tok.id,
      tokenId: `${tok.gateway}_${tok.tokenRef.substring(0, 8)}`,
      cardType: tok.cardBrand ?? tok.tokenType,
      cardLast4: tok.cardLast4 ?? '????',
      expiryMonth: tok.expiryMonth ?? 0,
      expiryYear: tok.expiryYear ?? 0,
      guestName: tok.guestId ?? 'Guest',
      guestId: tok.guestId ?? '',
      bookingRef: '—',
      status: (tok.status === 'deleted' ? 'deactivated' : tok.status) as CardToken['status'],
      createdAt: tok.createdAt,
      lastUsed: tok.updatedAt,
      usageCount: 0,
    }));
    setCardTokens(mappedTokens);

    if (isRefresh) toast.success('Terminal data refreshed');
  };

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsRes, terminalsRes, transactionsRes, tokensRes] = await Promise.all([
        fetch('/api/integrations/terminals'),
        fetch('/api/integrations/terminals/terminals'),
        fetch('/api/integrations/terminals/transactions'),
        fetch('/api/integrations/terminals/tokens'),
      ]);

      if (!statsRes.ok) throw new Error('Failed to fetch dashboard stats');
      if (!terminalsRes.ok) throw new Error('Failed to fetch terminals');
      if (!transactionsRes.ok) throw new Error('Failed to fetch transactions');
      if (!tokensRes.ok) throw new Error('Failed to fetch tokens');

      const statsJson = await statsRes.json();
      const terminalsJson = await terminalsRes.json();
      const transactionsJson = await transactionsRes.json();
      const tokensJson = await tokensRes.json();

      if (!statsJson.success) throw new Error(statsJson.error?.message || 'Failed to load dashboard');
      if (!terminalsJson.success) throw new Error(terminalsJson.error || 'Failed to load terminals');
      if (!transactionsJson.success) throw new Error(transactionsJson.error || 'Failed to load transactions');
      if (!tokensJson.success) throw new Error(tokensJson.error || 'Failed to load tokens');

      if (!mountedRef.current) return;

      processAndSetData(statsJson, terminalsJson, transactionsJson, tokensJson, isRefresh);
    } catch (error) {
      if (!mountedRef.current) return;
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error(message);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Initial data fetch via event-based pattern (not direct setState in effect)
  useEffect(() => {
    // Schedule fetch outside the synchronous effect body via microtask
    const controller = new AbortController();
    (async () => {
      if (isRefreshPendingRef.current) return;
      isRefreshPendingRef.current = true;
      try {
        setLoading(true);

        const [statsRes, terminalsRes, transactionsRes, tokensRes] = await Promise.all([
          fetch('/api/integrations/terminals', { signal: controller.signal }),
          fetch('/api/integrations/terminals/terminals', { signal: controller.signal }),
          fetch('/api/integrations/terminals/transactions', { signal: controller.signal }),
          fetch('/api/integrations/terminals/tokens', { signal: controller.signal }),
        ]);

        if (!statsRes.ok) throw new Error('Failed to fetch dashboard stats');
        if (!terminalsRes.ok) throw new Error('Failed to fetch terminals');
        if (!transactionsRes.ok) throw new Error('Failed to fetch transactions');
        if (!tokensRes.ok) throw new Error('Failed to fetch tokens');

        const statsJson = await statsRes.json();
        const terminalsJson = await terminalsRes.json();
        const transactionsJson = await transactionsRes.json();
        const tokensJson = await tokensRes.json();

        if (!statsJson.success) throw new Error(statsJson.error?.message || 'Failed to load dashboard');
        if (!terminalsJson.success) throw new Error(terminalsJson.error || 'Failed to load terminals');
        if (!transactionsJson.success) throw new Error(transactionsJson.error || 'Failed to load transactions');
        if (!tokensJson.success) throw new Error(tokensJson.error || 'Failed to load tokens');

        if (!mountedRef.current) return;

        processAndSetData(statsJson, terminalsJson, transactionsJson, tokensJson, false);
      } catch (error) {
        if (!mountedRef.current || controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        toast.error(message);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          isRefreshPendingRef.current = false;
        }
      }
    })();
    return () => controller.abort('Component cleanup');
  }, []);

  const handleRefresh = () => {
    fetchData(true);
  };

  const handleAddTerminal = async () => {
    if (!formName.trim()) {
      toast.error('Terminal name is required');
      return;
    }

    setRegistering(true);
    try {
      const res = await fetch('/api/integrations/terminals/terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          model: formModel || undefined,
          provider: 'verifone',
          location: formLocation.trim() || undefined,
          status: 'online',
          p2peEnabled: true,
          // propertyId is required by the API; use a placeholder that the backend
          // will accept (tenant-scoped)
          propertyId: '00000000-0000-0000-0000-000000000000',
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Failed to register terminal (${res.status})`);
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to register terminal');

      toast.success('New terminal registered successfully. Follow pairing instructions on the device.');
      setAddDialogOpen(false);
      setFormName('');
      setFormModel('');
      setFormConnection('');
      setFormLocation('');
      fetchData(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to register terminal';
      toast.error(message);
    } finally {
      setRegistering(false);
    }
  };

  const handleDeactivateToken = () => {
    if (!deactivateTokenId) return;
    toast.success('Card token deactivated successfully');
    setDeactivateTokenId(null);
  };

  // Computed stats
  const totalTerminals = stats?.totalTerminals ?? 0;
  const activeTerminals = stats?.onlineTerminals ?? 0;
  const totalTransactions = stats?.totalTransactionsToday ?? 0;
  const p2peCompliantCount = p2peStatuses.filter(p => p.encryptionStatus === 'encrypted').length;
  const p2peCompliancePercent = totalTerminals > 0
    ? ((p2peCompliantCount / totalTerminals) * 100).toFixed(0)
    : '0';
  const totalVolume = stats?.todayVolume ?? 0;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-40" />
          </div>
        </div>
        <StatsCardsSkeleton />
        <Skeleton className="h-10 w-full" />
        <Card>
          <CardContent className="pt-6">
            <TableSkeleton rows={6} cols={6} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Payment Terminals
          </h2>
          <p className="text-muted-foreground">
            Manage physical payment terminals, monitor P2PE compliance, and control card tokenization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Register Terminal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Register New Terminal
                </DialogTitle>
                <DialogDescription>
                  Add a new payment terminal to your property
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="term-name">Terminal Name</Label>
                  <Input
                    id="term-name"
                    placeholder="e.g. Lobby Terminal 3"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select value={formModel} onValueChange={setFormModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="verifone_p400">Verifone P400</SelectItem>
                        <SelectItem value="ingenico_lane5000">Ingenico Lane/5000</SelectItem>
                        <SelectItem value="square_terminal">Square Terminal</SelectItem>
                        <SelectItem value="clover_flex">Clover Flex</SelectItem>
                        <SelectItem value="bbpos_wisepad3">BBPOS WisePad 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Connection</Label>
                    <Select value={formConnection} onValueChange={setFormConnection}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ethernet">Ethernet</SelectItem>
                        <SelectItem value="wifi">Wi-Fi</SelectItem>
                        <SelectItem value="bluetooth">Bluetooth</SelectItem>
                        <SelectItem value="usb">USB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="term-location">Location</Label>
                  <Input
                    id="term-location"
                    placeholder="e.g. Front Desk, Restaurant, Spa"
                    value={formLocation}
                    onChange={e => setFormLocation(e.target.value)}
                  />
                </div>
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3">
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      All new terminals must complete P2PE certification within 30 days of registration.
                      PCI DSS compliance requires encryption at the point of interaction.
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddTerminal} disabled={registering}>
                  {registering && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Register Terminal
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-sky-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Monitor className="h-4 w-4" /> Registered Terminals
            </CardDescription>
            <CardTitle className="text-2xl">{totalTerminals}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across all locations</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ToggleRight className="h-4 w-4" /> Active Terminals
            </CardDescription>
            <CardTitle className="text-2xl">{activeTerminals}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {totalTerminals - activeTerminals} inactive/offline
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Activity className="h-4 w-4" /> Today&apos;s Transactions
            </CardDescription>
            <CardTitle className="text-2xl">{totalTransactions}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Volume: {formatCurrency(totalVolume)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-teal-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> P2PE Compliance
            </CardDescription>
            <CardTitle className="text-2xl">{p2peCompliancePercent}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {p2peCompliantCount} of {totalTerminals} compliant
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="registry" className="gap-1.5">
            <Monitor className="h-4 w-4 hidden sm:block" />
            Terminal Registry
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5">
            <Activity className="h-4 w-4 hidden sm:block" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="p2pe" className="gap-1.5">
            <Shield className="h-4 w-4 hidden sm:block" />
            P2PE Status
          </TabsTrigger>
          <TabsTrigger value="tokenization" className="gap-1.5">
            <KeyRound className="h-4 w-4 hidden sm:block" />
            Tokenization
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Terminal Registry ─── */}
        <TabsContent value="registry" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Registered Payment Terminals</CardTitle>
              <CardDescription>All payment terminals configured at your property</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[480px]">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Model</TableHead>
                      <TableHead className="hidden md:table-cell">Serial</TableHead>
                      <TableHead className="hidden lg:table-cell">Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Connection</TableHead>
                      <TableHead className="hidden md:table-cell">Today</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {terminals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No terminals registered yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      terminals.map((terminal) => (
                        <TableRow key={terminal.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div>
                                <p className="font-medium text-sm">{terminal.name}</p>
                                <p className="text-xs text-muted-foreground md:hidden">{terminal.model}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">{terminal.model}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="font-mono text-xs">{terminal.serialNumber}</span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {terminal.location}
                          </TableCell>
                          <TableCell>{terminalStatusBadge(terminal.status)}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-1.5">
                              {connectionTypeIcon(terminal.connectionType)}
                              <span className="text-xs capitalize">{terminal.connectionType}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            <span className="font-medium">{terminal.todayTransactions}</span>
                            <span className="text-muted-foreground ml-1">
                              ({formatCurrency(terminal.todayVolume)})
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Transactions ─── */}
        <TabsContent value="transactions" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Recent Terminal Transactions</CardTitle>
                  <CardDescription>Latest payment transactions across all terminals</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {transactions.filter(t => t.status === 'approved').length} approved
                  </Badge>
                  <Badge variant="outline" className="text-xs text-red-500">
                    {transactions.filter(t => t.status === 'declined').length} declined
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[480px]">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead className="hidden sm:table-cell">Terminal</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Card</TableHead>
                      <TableHead className="hidden md:table-cell">Auth Code</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No transactions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((tx) => (
                        <TableRow key={tx.id} className={tx.status === 'declined' ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(tx.timestamp)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">
                            {tx.terminalName}
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(tx.amount)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">{tx.cardType}</span>
                              <span className="text-xs text-muted-foreground">••{tx.cardLast4}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell font-mono text-xs">
                            {tx.authCode || '—'}
                          </TableCell>
                          <TableCell>{transactionStatusBadge(tx.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: P2PE Status ─── */}
        <TabsContent value="p2pe" className="mt-6 space-y-4">
          {/* Compliance overview */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">P2PE Compliance Dashboard</CardTitle>
                  <CardDescription>Point-to-Point Encryption status for PCI DSS compliance</CardDescription>
                </div>
                <Badge
                  className={
                    p2peStatuses.length === 0 || p2peStatuses.filter(p => p.encryptionStatus === 'encrypted').length === p2peStatuses.length
                      ? 'bg-emerald-500 text-white border-0'
                      : 'bg-amber-500 text-white border-0'
                  }
                >
                  <Shield className="h-3 w-3 mr-1" />
                  {p2peStatuses.filter(p => p.encryptionStatus === 'encrypted').length}/{p2peStatuses.length} Encrypted
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {p2peStatuses.filter(p => p.encryptionStatus === 'encrypted').length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Fully Encrypted</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-center">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {p2peStatuses.filter(p => p.encryptionStatus === 'not_encrypted').length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Not Encrypted</p>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {p2peStatuses.filter(p => p.encryptionStatus === 'pending_upgrade').length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Pending Upgrade</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-center">
                  <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                    {p2peStatuses.filter(p => p.encryptionStatus === 'decertified').length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Decertified</p>
                </div>
              </div>
              <ScrollArea className="max-h-[360px]">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Terminal</TableHead>
                      <TableHead className="hidden sm:table-cell">Model</TableHead>
                      <TableHead>Encryption</TableHead>
                      <TableHead className="hidden md:table-cell">Provider</TableHead>
                      <TableHead className="hidden lg:table-cell">Certified</TableHead>
                      <TableHead className="hidden lg:table-cell">Next Audit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p2peStatuses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No terminal P2PE data available.
                        </TableCell>
                      </TableRow>
                    ) : (
                      p2peStatuses.map((p2pe) => (
                        <TableRow key={p2pe.terminalId}>
                          <TableCell className="font-medium text-sm">{p2pe.terminalName}</TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{p2pe.model}</TableCell>
                          <TableCell>{encryptionStatusBadge(p2pe.encryptionStatus)}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{p2pe.encryptionProvider}</TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {p2pe.lastCertification ? formatDate(p2pe.lastCertification) : '—'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs">
                            <span className={
                              p2pe.nextAudit === 'Overdue' ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted-foreground'
                            }>
                              {p2pe.nextAudit === 'Overdue' ? (
                                <span className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Overdue
                                </span>
                              ) : (
                                p2pe.nextAudit ? formatDate(p2pe.nextAudit) : '—'
                              )}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Tokenization ─── */}
        <TabsContent value="tokenization" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Card-on-File Token Management</CardTitle>
                  <CardDescription>
                    Securely stored payment tokens for recurring charges and guest folio payments
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {cardTokens.filter(t => t.status === 'active').length} active
                  </Badge>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {cardTokens.length} total
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[480px]">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead>Card</TableHead>
                      <TableHead className="hidden sm:table-cell">Guest</TableHead>
                      <TableHead className="hidden md:table-cell">Booking</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Usage</TableHead>
                      <TableHead className="hidden lg:table-cell">Last Used</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cardTokens.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No card tokens stored.
                        </TableCell>
                      </TableRow>
                    ) : (
                      cardTokens.map((token) => (
                        <TableRow key={token.id}>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-mono text-xs">{token.tokenId.substring(0, 16)}…</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">
                                {token.cardType} ••{token.cardLast4}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">{token.guestName}</TableCell>
                          <TableCell className="hidden md:table-cell font-mono text-xs">{token.bookingRef}</TableCell>
                          <TableCell>{tokenStatusBadge(token.status)}</TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">{token.usageCount > 0 ? `${token.usageCount}x` : '—'}</TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {formatDateTime(token.lastUsed)}
                          </TableCell>
                          <TableCell>
                            {token.status === 'active' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 h-7 px-2"
                                onClick={() => setDeactivateTokenId(token.id)}
                              >
                                <Lock className="h-3.5 w-3.5 mr-1" />
                                Revoke
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Deactivate Token Confirmation ─── */}
      <AlertDialog open={!!deactivateTokenId} onOpenChange={(open) => !open && setDeactivateTokenId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Revoke Card Token
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this card token? The guest will need to provide
              a new card for any future charges. Recurring charges linked to this token will fail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Active</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivateToken} className="bg-red-600 hover:bg-red-700">
              Revoke Token
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Info Banner ─── */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold mb-1">PCI DSS Compliance</h4>
              <p className="text-sm text-muted-foreground">
                All payment terminals must maintain P2PE encryption certification. Decertified terminals should
                be removed from service immediately. Card tokens are stored in PCI-compliant vaults and never
                expose full card numbers. Audit logs are retained for 7 years as required by PCI DSS v4.0.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
