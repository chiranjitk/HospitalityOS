'use client';

import { useState } from 'react';
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

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const terminals: PaymentTerminal[] = [
  { id: 'pt-1', name: 'Front Desk Terminal 1', model: 'Verifone P400', serialNumber: 'VF-P400-48210', location: 'Lobby Front Desk', status: 'active', connectionType: 'ethernet', p2peCompliant: true, firmwareVersion: 'V3.4.2', lastTransaction: '2026-06-14T08:30:00Z', todayTransactions: 47, todayVolume: 185400 },
  { id: 'pt-2', name: 'Front Desk Terminal 2', model: 'Ingenico Lane/5000', serialNumber: 'IG-L5000-73109', location: 'Lobby Front Desk', status: 'active', connectionType: 'ethernet', p2peCompliant: true, firmwareVersion: 'V2.8.1', lastTransaction: '2026-06-14T08:25:00Z', todayTransactions: 32, todayVolume: 142800 },
  { id: 'pt-3', name: 'Restaurant POS', model: 'Square Terminal', serialNumber: 'SQ-TRM-55241', location: 'Main Restaurant', status: 'active', connectionType: 'wifi', p2peCompliant: true, firmwareVersion: 'V5.1.0', lastTransaction: '2026-06-14T08:28:00Z', todayTransactions: 63, todayVolume: 97200 },
  { id: 'pt-4', name: 'Bar Terminal', model: 'Square Terminal', serialNumber: 'SQ-TRM-55242', location: 'Poolside Bar', status: 'active', connectionType: 'wifi', p2peCompliant: true, firmwareVersion: 'V5.1.0', lastTransaction: '2026-06-14T08:20:00Z', todayTransactions: 28, todayVolume: 45600 },
  { id: 'pt-5', name: 'Spa Terminal', model: 'Verifone Engage', serialNumber: 'VF-ENG-29883', location: 'Wellness Spa', status: 'inactive', connectionType: 'wifi', p2peCompliant: true, firmwareVersion: 'V4.0.3', lastTransaction: '2026-06-13T18:00:00Z', todayTransactions: 0, todayVolume: 0 },
  { id: 'pt-6', name: 'Gift Shop POS', model: 'Clover Flex', serialNumber: 'CL-FLEX-66432', location: 'Gift Shop', status: 'active', connectionType: 'wifi', p2peCompliant: false, firmwareVersion: 'V3.2.0', lastTransaction: '2026-06-14T08:15:00Z', todayTransactions: 15, todayVolume: 32400 },
  { id: 'pt-7', name: 'Room Service Terminal', model: 'Ingenico Move/5000', serialNumber: 'IG-M5000-11988', location: 'Mobile / Room Service', status: 'offline', connectionType: 'bluetooth', p2peCompliant: true, firmwareVersion: 'V2.7.0', lastTransaction: '2026-06-14T06:45:00Z', todayTransactions: 8, todayVolume: 28500 },
  { id: 'pt-8', name: 'Valet Parking Terminal', model: 'BBPOS WisePad 3', serialNumber: 'BP-WP3-77105', location: 'Parking Garage', status: 'maintenance', connectionType: 'bluetooth', p2peCompliant: true, firmwareVersion: 'V1.9.5', lastTransaction: '2026-06-12T14:30:00Z', todayTransactions: 0, todayVolume: 0 },
];

const transactions: TerminalTransaction[] = [
  { id: 'tx-1', terminalName: 'Front Desk Terminal 1', transactionId: 'TXN-20260614083001', amount: 12500, currency: 'INR', cardType: 'Visa', cardLast4: '4242', status: 'approved', timestamp: '2026-06-14T08:30:00Z', authCode: 'A84721' },
  { id: 'tx-2', terminalName: 'Restaurant POS', transactionId: 'TXN-20260614082802', amount: 3200, currency: 'INR', cardType: 'Mastercard', cardLast4: '8888', status: 'approved', timestamp: '2026-06-14T08:28:00Z', authCode: 'B93812' },
  { id: 'tx-3', terminalName: 'Front Desk Terminal 2', transactionId: 'TXN-20260614082503', amount: 45000, currency: 'INR', cardType: 'Amex', cardLast4: '1001', status: 'approved', timestamp: '2026-06-14T08:25:00Z', authCode: 'C12943' },
  { id: 'tx-4', terminalName: 'Bar Terminal', transactionId: 'TXN-20260614082004', amount: 1800, currency: 'INR', cardType: 'Visa', cardLast4: '5567', status: 'approved', timestamp: '2026-06-14T08:20:00Z', authCode: 'D47231' },
  { id: 'tx-5', terminalName: 'Front Desk Terminal 1', transactionId: 'TXN-20260614081805', amount: 89000, currency: 'INR', cardType: 'RuPay', cardLast4: '3344', status: 'declined', timestamp: '2026-06-14T08:18:00Z', authCode: '' },
  { id: 'tx-6', terminalName: 'Gift Shop POS', transactionId: 'TXN-20260614081506', amount: 2400, currency: 'INR', cardType: 'Mastercard', cardLast4: '7790', status: 'approved', timestamp: '2026-06-14T08:15:00Z', authCode: 'E58194' },
  { id: 'tx-7', terminalName: 'Front Desk Terminal 2', transactionId: 'TXN-20260614081007', amount: 67000, currency: 'INR', cardType: 'Visa', cardLast4: '1234', status: 'refunded', timestamp: '2026-06-14T08:10:00Z', authCode: 'F69203' },
  { id: 'tx-8', terminalName: 'Restaurant POS', transactionId: 'TXN-20260614080508', amount: 5100, currency: 'INR', cardType: 'Amex', cardLast4: '2005', status: 'approved', timestamp: '2026-06-14T08:05:00Z', authCode: 'G71328' },
  { id: 'tx-9', terminalName: 'Room Service Terminal', transactionId: 'TXN-20260614064509', amount: 4200, currency: 'INR', cardType: 'Visa', cardLast4: '9087', status: 'approved', timestamp: '2026-06-14T06:45:00Z', authCode: 'H82451' },
  { id: 'tx-10', terminalName: 'Front Desk Terminal 1', transactionId: 'TXN-20260614063010', amount: 22000, currency: 'INR', cardType: 'Mastercard', cardLast4: '6612', status: 'approved', timestamp: '2026-06-14T06:30:00Z', authCode: 'I93567' },
];

const p2peStatuses: P2PEStatus[] = [
  { terminalId: 'pt-1', terminalName: 'Front Desk Terminal 1', model: 'Verifone P400', encryptionStatus: 'encrypted', serialNumber: 'VF-P400-48210', firmwareVersion: 'V3.4.2', lastCertification: '2026-03-15T00:00:00Z', nextAudit: '2026-09-15T00:00:00Z', encryptionProvider: 'Verifone Shield' },
  { terminalId: 'pt-2', terminalName: 'Front Desk Terminal 2', model: 'Ingenico Lane/5000', encryptionStatus: 'encrypted', serialNumber: 'IG-L5000-73109', firmwareVersion: 'V2.8.1', lastCertification: '2026-02-20T00:00:00Z', nextAudit: '2026-08-20T00:00:00Z', encryptionProvider: 'Ingenico Telium TETRA' },
  { terminalId: 'pt-3', terminalName: 'Restaurant POS', model: 'Square Terminal', encryptionStatus: 'encrypted', serialNumber: 'SQ-TRM-55241', firmwareVersion: 'V5.1.0', lastCertification: '2026-04-01T00:00:00Z', nextAudit: '2026-10-01T00:00:00Z', encryptionProvider: 'Square E2EE' },
  { terminalId: 'pt-4', terminalName: 'Bar Terminal', model: 'Square Terminal', encryptionStatus: 'encrypted', serialNumber: 'SQ-TRM-55242', firmwareVersion: 'V5.1.0', lastCertification: '2026-04-01T00:00:00Z', nextAudit: '2026-10-01T00:00:00Z', encryptionProvider: 'Square E2EE' },
  { terminalId: 'pt-5', terminalName: 'Spa Terminal', model: 'Verifone Engage', encryptionStatus: 'pending_upgrade', serialNumber: 'VF-ENG-29883', firmwareVersion: 'V4.0.3', lastCertification: '2025-11-10T00:00:00Z', nextAudit: '2026-07-10T00:00:00Z', encryptionProvider: 'Verifone Shield' },
  { terminalId: 'pt-6', terminalName: 'Gift Shop POS', model: 'Clover Flex', encryptionStatus: 'not_encrypted', serialNumber: 'CL-FLEX-66432', firmwareVersion: 'V3.2.0', lastCertification: '2025-06-01T00:00:00Z', nextAudit: '2026-06-30T00:00:00Z', encryptionProvider: 'None' },
  { terminalId: 'pt-7', terminalName: 'Room Service Terminal', model: 'Ingenico Move/5000', encryptionStatus: 'encrypted', serialNumber: 'IG-M5000-11988', firmwareVersion: 'V2.7.0', lastCertification: '2026-01-18T00:00:00Z', nextAudit: '2026-07-18T00:00:00Z', encryptionProvider: 'Ingenico Telium TETRA' },
  { terminalId: 'pt-8', terminalName: 'Valet Parking Terminal', model: 'BBPOS WisePad 3', encryptionStatus: 'decertified', serialNumber: 'BP-WP3-77105', firmwareVersion: 'V1.9.5', lastCertification: '2025-03-01T00:00:00Z', nextAudit: 'Overdue', encryptionProvider: 'BBPOS SRED' },
];

const cardTokens: CardToken[] = [
  { id: 'tk-1', tokenId: 'tok_visa_4242_a8f2', cardType: 'Visa', cardLast4: '4242', expiryMonth: 12, expiryYear: 2027, guestName: 'James Anderson', guestId: 'gst-101', bookingRef: 'BK-2026-0847', status: 'active', createdAt: '2026-06-12T14:00:00Z', lastUsed: '2026-06-14T08:30:00Z', usageCount: 5 },
  { id: 'tk-2', tokenId: 'tok_mc_8888_b3c7', cardType: 'Mastercard', cardLast4: '8888', expiryMonth: 8, expiryYear: 2027, guestName: 'Maria Chen', guestId: 'gst-102', bookingRef: 'BK-2026-0848', status: 'active', createdAt: '2026-06-13T10:00:00Z', lastUsed: '2026-06-14T08:28:00Z', usageCount: 3 },
  { id: 'tk-3', tokenId: 'tok_amex_1001_d1e9', cardType: 'Amex', cardLast4: '1001', expiryMonth: 3, expiryYear: 2028, guestName: 'Priya Patel', guestId: 'gst-103', bookingRef: 'BK-2026-0849', status: 'active', createdAt: '2026-06-11T16:00:00Z', lastUsed: '2026-06-14T08:25:00Z', usageCount: 7 },
  { id: 'tk-4', tokenId: 'tok_visa_1234_e4f0', cardType: 'Visa', cardLast4: '1234', expiryMonth: 6, expiryYear: 2026, guestName: 'Tom Williams', guestId: 'gst-104', bookingRef: 'BK-2026-0850', status: 'expired', createdAt: '2026-01-05T09:00:00Z', lastUsed: '2026-06-14T08:10:00Z', usageCount: 22 },
  { id: 'tk-5', tokenId: 'tok_rupay_3344_f5a1', cardType: 'RuPay', cardLast4: '3344', expiryMonth: 11, expiryYear: 2027, guestName: 'Ahmed Hassan', guestId: 'gst-105', bookingRef: 'BK-2026-0851', status: 'active', createdAt: '2026-06-14T07:00:00Z', lastUsed: '2026-06-14T07:00:00Z', usageCount: 1 },
  { id: 'tk-6', tokenId: 'tok_mc_7790_g6b2', cardType: 'Mastercard', cardLast4: '7790', expiryMonth: 2, expiryYear: 2026, guestName: 'Lisa Nakamura', guestId: 'gst-106', bookingRef: 'BK-2026-0852', status: 'deactivated', createdAt: '2026-02-20T12:00:00Z', lastUsed: '2026-06-10T15:00:00Z', usageCount: 14 },
  { id: 'tk-7', tokenId: 'tok_visa_9087_h7c3', cardType: 'Visa', cardLast4: '9087', expiryMonth: 9, expiryYear: 2027, guestName: 'Sarah Johnson', guestId: 'gst-107', bookingRef: 'BK-2026-0853', status: 'active', createdAt: '2026-06-11T16:00:00Z', lastUsed: '2026-06-14T06:45:00Z', usageCount: 9 },
];

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
// Component
// ---------------------------------------------------------------------------

export function PaymentTerminals() {
  const { formatCurrency } = useCurrency();

  // Stats
  const totalTerminals = terminals.length;
  const activeTerminals = terminals.filter(t => t.status === 'active').length;
  const totalTransactions = terminals.reduce((sum, t) => sum + t.todayTransactions, 0);
  const p2peCompliantCount = terminals.filter(t => t.p2peCompliant).length;
  const p2peCompliancePercent = totalTerminals > 0
    ? ((p2peCompliantCount / totalTerminals) * 100).toFixed(0)
    : '0';
  const totalVolume = terminals.reduce((sum, t) => sum + t.todayVolume, 0);

  // State
  const [activeTab, setActiveTab] = useState('registry');
  const [refreshing, setRefreshing] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deactivateTokenId, setDeactivateTokenId] = useState<string | null>(null);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      toast.success('Terminal data refreshed');
    }, 1200);
  };

  const handleAddTerminal = () => {
    setAddDialogOpen(false);
    toast.success('New terminal registration initiated. Follow pairing instructions on the device.');
  };

  const handleDeactivateToken = () => {
    if (!deactivateTokenId) return;
    toast.success('Card token deactivated successfully');
    setDeactivateTokenId(null);
  };

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
                  <Input id="term-name" placeholder="e.g. Lobby Terminal 3" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select>
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
                    <Select>
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
                  <Input id="term-location" placeholder="e.g. Front Desk, Restaurant, Spa" />
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
                <Button onClick={handleAddTerminal}>
                  Register Terminal
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
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
        <TabsList className="grid w-full grid-cols-4">
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
                    {terminals.map((terminal) => (
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
                    ))}
                  </TableBody>
                </Table>
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
                    {transactions.map((tx) => (
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
                    ))}
                  </TableBody>
                </Table>
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
                    p2peStatuses.filter(p => p.encryptionStatus === 'encrypted').length === p2peStatuses.length
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
                    {p2peStatuses.map((p2pe) => (
                      <TableRow key={p2pe.terminalId}>
                        <TableCell className="font-medium text-sm">{p2pe.terminalName}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{p2pe.model}</TableCell>
                        <TableCell>{encryptionStatusBadge(p2pe.encryptionStatus)}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{p2pe.encryptionProvider}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {formatDate(p2pe.lastCertification)}
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
                              formatDate(p2pe.nextAudit)
                            )}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                    {cardTokens.map((token) => (
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
                        <TableCell className="hidden sm:table-cell text-sm">{token.usageCount}x</TableCell>
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
                    ))}
                  </TableBody>
                </Table>
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
