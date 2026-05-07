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
import { Switch } from '@/components/ui/switch';
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
  Lock,
  Unlock,
  Wifi,
  WifiOff,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  BatteryWarning,
  CreditCard,
  Smartphone,
  Key,
  Shield,
  Settings,
  RefreshCw,
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  QrCode,
  Radio,
  DoorOpen,
  Fingerprint,
  Clock,
  User,
  MapPin,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LockProvider = 'assa_abloy' | 'salto_ks' | 'dormakaba';

type LockStatus = 'online' | 'offline' | 'low_battery' | 'maintenance';

type AccessMethod = 'mobile_key' | 'key_card' | 'pin_code' | 'fingerprint' | 'front_desk';

interface LockProviderConfig {
  id: string;
  provider: LockProvider;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'configuring';
  lockCount: number;
  onlineCount: number;
  lastSync: string;
  apiEndpoint: string;
  apiKey: string;
  firmware: string;
  protocol: string;
}

interface RoomLock {
  id: string;
  roomNumber: string;
  floor: number;
  lockType: string;
  provider: LockProvider;
  status: LockStatus;
  batteryLevel: number;
  lastActivity: string;
  firmwareVersion: string;
  signalStrength: number;
}

interface AccessLogEntry {
  id: string;
  timestamp: string;
  guestName: string;
  roomNumber: string;
  method: AccessMethod;
  direction: 'entry' | 'exit';
  status: 'granted' | 'denied';
  reason?: string;
}

interface KeyCard {
  id: string;
  cardNumber: string;
  guestName: string;
  roomNumber: string;
  provider: LockProvider;
  status: 'active' | 'expired' | 'cancelled';
  issuedAt: string;
  expiresAt: string;
  accessCount: number;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const lockProviders: LockProviderConfig[] = [
  {
    id: 'lp-1',
    provider: 'assa_abloy',
    name: 'ASSA ABLOY Visionline',
    description: 'Enterprise-grade RFID door locks with BLE mobile key support and real-time status monitoring.',
    status: 'connected',
    lockCount: 124,
    onlineCount: 118,
    lastSync: '2026-06-14T08:32:00Z',
    apiEndpoint: 'https://api.assaabloy.com/v2/visionline',
    apiKey: '••••••••a8f2',
    firmware: 'V4.2.1',
    protocol: 'BLE 5.0 + RFID (MIFARE DESFire)',
  },
  {
    id: 'lp-2',
    provider: 'salto_ks',
    name: 'SALTO KS (Key)',
    description: 'Cloud-based smart access platform with SALTO Virtual Network for wireless updates and audit trails.',
    status: 'connected',
    lockCount: 86,
    onlineCount: 82,
    lastSync: '2026-06-14T08:28:00Z',
    apiEndpoint: 'https://api.saltoks.com/v1',
    apiKey: '••••••••b3c7',
    firmware: 'V3.8.4',
    protocol: 'SALTO SVN + BLE 4.2',
  },
  {
    id: 'lp-3',
    provider: 'dormakaba',
    name: 'Dormakaba (orcativo / SAFLOK)',
    description: 'High-security electronic locks with RFID/NFC and mobile credentials via dormakaba mobile access.',
    status: 'configuring',
    lockCount: 42,
    onlineCount: 0,
    lastSync: '2026-06-13T16:45:00Z',
    apiEndpoint: 'https://api.dormakaba.com/connect',
    apiKey: '••••••••d1e9',
    firmware: 'V5.0.0-beta',
    protocol: 'NFC + RFID (iCLASS SE)',
  },
];

const roomLocks: RoomLock[] = [
  { id: 'rl-1', roomNumber: '101', floor: 1, lockType: 'Visionline VingCard', provider: 'assa_abloy', status: 'online', batteryLevel: 92, lastActivity: '2026-06-14T08:15:00Z', firmwareVersion: 'V4.2.1', signalStrength: 95 },
  { id: 'rl-2', roomNumber: '102', floor: 1, lockType: 'Visionline VingCard', provider: 'assa_abloy', status: 'online', batteryLevel: 87, lastActivity: '2026-06-14T07:50:00Z', firmwareVersion: 'V4.2.1', signalStrength: 88 },
  { id: 'rl-3', roomNumber: '103', floor: 1, lockType: 'Visionline VingCard', provider: 'assa_abloy', status: 'low_battery', batteryLevel: 12, lastActivity: '2026-06-14T06:30:00Z', firmwareVersion: 'V4.2.0', signalStrength: 72 },
  { id: 'rl-4', roomNumber: '201', floor: 2, lockType: 'SALTO XS4', provider: 'salto_ks', status: 'online', batteryLevel: 78, lastActivity: '2026-06-14T08:20:00Z', firmwareVersion: 'V3.8.4', signalStrength: 91 },
  { id: 'rl-5', roomNumber: '202', floor: 2, lockType: 'SALTO XS4', provider: 'salto_ks', status: 'online', batteryLevel: 65, lastActivity: '2026-06-14T07:45:00Z', firmwareVersion: 'V3.8.4', signalStrength: 84 },
  { id: 'rl-6', roomNumber: '203', floor: 2, lockType: 'SALTO XS4', provider: 'salto_ks', status: 'offline', batteryLevel: 0, lastActivity: '2026-06-13T22:10:00Z', firmwareVersion: 'V3.8.3', signalStrength: 0 },
  { id: 'rl-7', roomNumber: '301', floor: 3, lockType: 'Dormakaba SAFLOK', provider: 'dormakaba', status: 'maintenance', batteryLevel: 45, lastActivity: '2026-06-14T04:00:00Z', firmwareVersion: 'V5.0.0-beta', signalStrength: 60 },
  { id: 'rl-8', roomNumber: '302', floor: 3, lockType: 'Dormakaba SAFLOK', provider: 'dormakaba', status: 'maintenance', batteryLevel: 50, lastActivity: '2026-06-14T04:00:00Z', firmwareVersion: 'V5.0.0-beta', signalStrength: 55 },
  { id: 'rl-9', roomNumber: '104', floor: 1, lockType: 'Visionline VingCard', provider: 'assa_abloy', status: 'online', batteryLevel: 100, lastActivity: '2026-06-14T08:22:00Z', firmwareVersion: 'V4.2.1', signalStrength: 97 },
  { id: 'rl-10', roomNumber: '204', floor: 2, lockType: 'SALTO XS4', provider: 'salto_ks', status: 'online', batteryLevel: 83, lastActivity: '2026-06-14T08:05:00Z', firmwareVersion: 'V3.8.4', signalStrength: 90 },
  { id: 'rl-11', roomNumber: '105', floor: 1, lockType: 'Visionline VingCard', provider: 'assa_abloy', status: 'low_battery', batteryLevel: 8, lastActivity: '2026-06-14T05:45:00Z', firmwareVersion: 'V4.1.9', signalStrength: 65 },
  { id: 'rl-12', roomNumber: '205', floor: 2, lockType: 'SALTO XS4', provider: 'salto_ks', status: 'online', batteryLevel: 71, lastActivity: '2026-06-14T07:30:00Z', firmwareVersion: 'V3.8.4', signalStrength: 86 },
];

const accessLogs: AccessLogEntry[] = [
  { id: 'al-1', timestamp: '2026-06-14T08:22:15Z', guestName: 'James Anderson', roomNumber: '104', method: 'mobile_key', direction: 'entry', status: 'granted' },
  { id: 'al-2', timestamp: '2026-06-14T08:20:30Z', guestName: 'Maria Chen', roomNumber: '201', method: 'key_card', direction: 'entry', status: 'granted' },
  { id: 'al-3', timestamp: '2026-06-14T08:18:45Z', guestName: 'David Kumar', roomNumber: '301', method: 'pin_code', direction: 'entry', status: 'denied', reason: 'Expired PIN' },
  { id: 'al-4', timestamp: '2026-06-14T08:15:00Z', guestName: 'Sarah Johnson', roomNumber: '101', method: 'fingerprint', direction: 'entry', status: 'granted' },
  { id: 'al-5', timestamp: '2026-06-14T08:10:20Z', guestName: 'James Anderson', roomNumber: '104', method: 'mobile_key', direction: 'exit', status: 'granted' },
  { id: 'al-6', timestamp: '2026-06-14T07:55:10Z', guestName: 'Priya Patel', roomNumber: '202', method: 'key_card', direction: 'entry', status: 'granted' },
  { id: 'al-7', timestamp: '2026-06-14T07:50:00Z', guestName: 'Tom Williams', roomNumber: '102', method: 'mobile_key', direction: 'exit', status: 'granted' },
  { id: 'al-8', timestamp: '2026-06-14T07:45:30Z', guestName: 'Emily Brown', roomNumber: '203', method: 'key_card', direction: 'entry', status: 'denied', reason: 'Card cancelled' },
  { id: 'al-9', timestamp: '2026-06-14T07:30:00Z', guestName: 'Ahmed Hassan', roomNumber: '205', method: 'front_desk', direction: 'entry', status: 'granted' },
  { id: 'al-10', timestamp: '2026-06-14T07:20:15Z', guestName: 'Lisa Nakamura', roomNumber: '204', method: 'mobile_key', direction: 'entry', status: 'granted' },
  { id: 'al-11', timestamp: '2026-06-14T06:30:00Z', guestName: 'Robert Müller', roomNumber: '103', method: 'key_card', direction: 'exit', status: 'granted' },
  { id: 'al-12', timestamp: '2026-06-14T05:45:00Z', guestName: 'Unknown', roomNumber: '105', method: 'key_card', direction: 'entry', status: 'denied', reason: 'Unregistered card' },
];

const keyCards: KeyCard[] = [
  { id: 'kc-1', cardNumber: 'KF-4821-0091', guestName: 'James Anderson', roomNumber: '104', provider: 'assa_abloy', status: 'active', issuedAt: '2026-06-12T14:00:00Z', expiresAt: '2026-06-16T12:00:00Z', accessCount: 14 },
  { id: 'kc-2', cardNumber: 'KF-4821-0092', guestName: 'Maria Chen', roomNumber: '201', provider: 'salto_ks', status: 'active', issuedAt: '2026-06-13T10:00:00Z', expiresAt: '2026-06-17T12:00:00Z', accessCount: 8 },
  { id: 'kc-3', cardNumber: 'KF-4821-0093', guestName: 'Sarah Johnson', roomNumber: '101', provider: 'assa_abloy', status: 'active', issuedAt: '2026-06-11T16:00:00Z', expiresAt: '2026-06-15T12:00:00Z', accessCount: 22 },
  { id: 'kc-4', cardNumber: 'KF-4821-0094', guestName: 'Emily Brown', roomNumber: '203', provider: 'salto_ks', status: 'cancelled', issuedAt: '2026-06-10T09:00:00Z', expiresAt: '2026-06-14T12:00:00Z', accessCount: 5 },
  { id: 'kc-5', cardNumber: 'KF-4821-0095', guestName: 'Priya Patel', roomNumber: '202', provider: 'salto_ks', status: 'active', issuedAt: '2026-06-13T14:00:00Z', expiresAt: '2026-06-18T12:00:00Z', accessCount: 11 },
  { id: 'kc-6', cardNumber: 'KF-4821-0096', guestName: 'Ahmed Hassan', roomNumber: '205', provider: 'assa_abloy', status: 'active', issuedAt: '2026-06-14T07:00:00Z', expiresAt: '2026-06-19T12:00:00Z', accessCount: 2 },
  { id: 'kc-7', cardNumber: 'KF-4821-0097', guestName: 'Tom Williams', roomNumber: '102', provider: 'assa_abloy', status: 'expired', issuedAt: '2026-06-08T12:00:00Z', expiresAt: '2026-06-13T12:00:00Z', accessCount: 31 },
  { id: 'kc-8', cardNumber: 'KF-4821-0098', guestName: 'Lisa Nakamura', roomNumber: '204', provider: 'salto_ks', status: 'active', issuedAt: '2026-06-12T10:00:00Z', expiresAt: '2026-06-16T12:00:00Z', accessCount: 18 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const providerLabels: Record<LockProvider, { label: string; color: string; bgGradient: string }> = {
  assa_abloy: { label: 'ASSA ABLOY', color: 'text-sky-600 dark:text-sky-400', bgGradient: 'from-sky-500/20 to-cyan-500/20' },
  salto_ks: { label: 'SALTO KS', color: 'text-violet-600 dark:text-violet-400', bgGradient: 'from-violet-500/20 to-purple-500/20' },
  dormakaba: { label: 'Dormakaba', color: 'text-amber-600 dark:text-amber-400', bgGradient: 'from-amber-500/20 to-orange-500/20' },
};

function providerBadge(provider: LockProvider) {
  const info = providerLabels[provider];
  return (
    <Badge variant="secondary" className={`text-xs font-medium ${info.color}`}>
      {info.label}
    </Badge>
  );
}

function lockStatusBadge(status: LockStatus) {
  switch (status) {
    case 'online':
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1">
          <Wifi className="h-3 w-3" /> Online
        </Badge>
      );
    case 'offline':
      return (
        <Badge variant="destructive" className="gap-1">
          <WifiOff className="h-3 w-3" /> Offline
        </Badge>
      );
    case 'low_battery':
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1">
          <BatteryLow className="h-3 w-3" /> Low Battery
        </Badge>
      );
    case 'maintenance':
      return (
        <Badge variant="secondary" className="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 gap-1">
          <Settings className="h-3 w-3" /> Maintenance
        </Badge>
      );
  }
}

function connectionStatusBadge(status: string) {
  switch (status) {
    case 'connected':
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Connected
        </Badge>
      );
    case 'disconnected':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Disconnected
        </Badge>
      );
    case 'configuring':
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Configuring
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function accessMethodIcon(method: AccessMethod) {
  switch (method) {
    case 'mobile_key':
      return <Smartphone className="h-4 w-4 text-sky-500" />;
    case 'key_card':
      return <CreditCard className="h-4 w-4 text-violet-500" />;
    case 'pin_code':
      return <Key className="h-4 w-4 text-amber-500" />;
    case 'fingerprint':
      return <Fingerprint className="h-4 w-4 text-emerald-500" />;
    case 'front_desk':
      return <DoorOpen className="h-4 w-4 text-orange-500" />;
  }
}

function accessMethodLabel(method: AccessMethod) {
  switch (method) {
    case 'mobile_key': return 'Mobile Key';
    case 'key_card': return 'Key Card';
    case 'pin_code': return 'PIN Code';
    case 'fingerprint': return 'Fingerprint';
    case 'front_desk': return 'Front Desk';
  }
}

function batteryIcon(level: number) {
  if (level > 60) return <BatteryFull className="h-4 w-4 text-emerald-500" />;
  if (level > 25) return <BatteryMedium className="h-4 w-4 text-amber-500" />;
  return <BatteryWarning className="h-4 w-4 text-red-500" />;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function keyCardStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">Active</Badge>;
    case 'expired':
      return <Badge variant="secondary">Expired</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SmartLocks() {
  const { formatCurrency } = useCurrency();

  // Stats derived from mock data
  const totalLocks = lockProviders.reduce((sum, p) => sum + p.lockCount, 0);
  const onlineLocks = lockProviders.reduce((sum, p) => sum + p.onlineCount, 0);
  const offlineLocks = roomLocks.filter(l => l.status === 'offline').length;
  const lowBatteryLocks = roomLocks.filter(l => l.status === 'low_battery').length;

  // State
  const [activeTab, setActiveTab] = useState('providers');
  const [refreshing, setRefreshing] = useState(false);
  const [encodeDialogOpen, setEncodeDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<LockProvider>('assa_abloy');
  const [cancelCardId, setCancelCardId] = useState<string | null>(null);
  const [encoding, setEncoding] = useState(false);

  // Form state for encoding
  const [encodeRoom, setEncodeRoom] = useState('');
  const [encodeGuest, setEncodeGuest] = useState('');
  const [encodeExpiry, setEncodeExpiry] = useState('');

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      toast.success('Lock data refreshed');
    }, 1200);
  };

  const handleEncodeCard = () => {
    if (!encodeRoom || !encodeGuest || !encodeExpiry) {
      toast.error('Please fill all fields');
      return;
    }
    setEncoding(true);
    setTimeout(() => {
      setEncoding(false);
      setEncodeDialogOpen(false);
      toast.success(`Key card encoded for Room ${encodeRoom} via ${providerLabels[selectedProvider].label}`);
      setEncodeRoom('');
      setEncodeGuest('');
      setEncodeExpiry('');
    }, 2000);
  };

  const handleCancelCard = () => {
    if (!cancelCardId) return;
    toast.success('Key card cancelled successfully');
    setCancelCardId(null);
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Lock className="h-6 w-6" />
            Smart Lock Hardware
          </h2>
          <p className="text-muted-foreground">
            Manage door lock providers, monitor lock status, track access, and encode key cards
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={encodeDialogOpen} onOpenChange={setEncodeDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Encode Key Card
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Encode Key Card
                </DialogTitle>
                <DialogDescription>
                  Create and encode a new key card for guest room access
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Lock Provider</Label>
                  <Select
                    value={selectedProvider}
                    onValueChange={(v) => setSelectedProvider(v as LockProvider)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assa_abloy">ASSA ABLOY Visionline</SelectItem>
                      <SelectItem value="salto_ks">SALTO KS</SelectItem>
                      <SelectItem value="dormakaba">Dormakaba SAFLOK</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="encode-room">Room Number</Label>
                  <Input
                    id="encode-room"
                    value={encodeRoom}
                    onChange={(e) => setEncodeRoom(e.target.value)}
                    placeholder="e.g. 204"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="encode-guest">Guest Name</Label>
                  <Input
                    id="encode-guest"
                    value={encodeGuest}
                    onChange={(e) => setEncodeGuest(e.target.value)}
                    placeholder="e.g. Maria Chen"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="encode-expiry">Expiry Date & Time</Label>
                  <Input
                    id="encode-expiry"
                    type="datetime-local"
                    value={encodeExpiry}
                    onChange={(e) => setEncodeExpiry(e.target.value)}
                  />
                </div>
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3">
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Ensure the key card encoder is connected and powered on before encoding.
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEncodeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEncodeCard} disabled={encoding}>
                  {encoding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Radio className="h-4 w-4 mr-2" />
                  Encode Card
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
              <Lock className="h-4 w-4" /> Connected Locks
            </CardDescription>
            <CardTitle className="text-2xl">{totalLocks}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across {lockProviders.length} providers</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Wifi className="h-4 w-4" /> Online Locks
            </CardDescription>
            <CardTitle className="text-2xl">{onlineLocks}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {totalLocks > 0 ? ((onlineLocks / totalLocks) * 100).toFixed(1) : 0}% uptime
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <WifiOff className="h-4 w-4" /> Offline Alerts
            </CardDescription>
            <CardTitle className="text-2xl">{offlineLocks}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <BatteryLow className="h-4 w-4" /> Battery Low
            </CardDescription>
            <CardTitle className="text-2xl">{lowBatteryLocks}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Below 20% battery level</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="providers" className="gap-1.5">
            <Radio className="h-4 w-4 hidden sm:block" />
            Lock Providers
          </TabsTrigger>
          <TabsTrigger value="status" className="gap-1.5">
            <MapPin className="h-4 w-4 hidden sm:block" />
            Lock Status
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <Activity className="h-4 w-4 hidden sm:block" />
            Access Logs
          </TabsTrigger>
          <TabsTrigger value="keycards" className="gap-1.5">
            <CreditCard className="h-4 w-4 hidden sm:block" />
            Key Cards
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Lock Providers ─── */}
        <TabsContent value="providers" className="mt-6 space-y-4">
          {lockProviders.map((provider) => {
            const info = providerLabels[provider.provider];
            const uptime = provider.lockCount > 0
              ? ((provider.onlineCount / provider.lockCount) * 100).toFixed(1)
              : '0';
            return (
              <Card key={provider.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${info.bgGradient} flex items-center justify-center shrink-0`}>
                        <Lock className={`h-6 w-6 ${info.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{provider.name}</CardTitle>
                        <CardDescription className="mt-1">{provider.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {connectionStatusBadge(provider.status)}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setConfigDialogOpen(true);
                          toast.info(`Opening ${provider.name} configuration`);
                        }}
                      >
                        <Settings className="h-4 w-4 mr-1.5" />
                        Configure
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Locks</p>
                      <p className="font-semibold text-lg">{provider.lockCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Online</p>
                      <p className="font-semibold text-lg text-emerald-600 dark:text-emerald-400">{provider.onlineCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Uptime</p>
                      <p className="font-semibold text-lg">{uptime}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Protocol</p>
                      <p className="font-semibold text-sm">{provider.protocol}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground mb-1">API Endpoint</p>
                      <p className="font-mono text-xs truncate">{provider.apiEndpoint}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground mb-1">API Key</p>
                      <p className="font-mono text-xs">{provider.apiKey}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Firmware</p>
                      <p className="font-mono text-xs">{provider.firmware}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Last synced: {formatDateTime(provider.lastSync)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ─── Tab: Lock Status ─── */}
        <TabsContent value="status" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Room-by-Room Lock Status</CardTitle>
                  <CardDescription>Real-time status of all door locks in the property</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {roomLocks.filter(l => l.status === 'online').length} online
                  </Badge>
                  <Badge variant="outline" className="text-xs text-red-500">
                    {roomLocks.filter(l => l.status === 'offline').length} offline
                  </Badge>
                  <Badge variant="outline" className="text-xs text-amber-500">
                    {roomLocks.filter(l => l.status === 'low_battery').length} low battery
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[480px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room</TableHead>
                      <TableHead className="hidden sm:table-cell">Floor</TableHead>
                      <TableHead>Lock Type</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Battery</TableHead>
                      <TableHead className="hidden md:table-cell">Signal</TableHead>
                      <TableHead className="hidden lg:table-cell">Last Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roomLocks.map((lock) => (
                      <TableRow key={lock.id}>
                        <TableCell className="font-semibold">{lock.roomNumber}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          Floor {lock.floor}
                        </TableCell>
                        <TableCell className="text-sm">{lock.lockType}</TableCell>
                        <TableCell>{providerBadge(lock.provider)}</TableCell>
                        <TableCell>{lockStatusBadge(lock.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {batteryIcon(lock.batteryLevel)}
                            <div className="w-16">
                              <Progress
                                value={lock.batteryLevel}
                                className={`h-2 ${
                                  lock.batteryLevel > 60 ? '[&>div]:bg-emerald-500' :
                                  lock.batteryLevel > 25 ? '[&>div]:bg-amber-500' :
                                  '[&>div]:bg-red-500'
                                }`}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8">{lock.batteryLevel}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${
                              lock.signalStrength > 80 ? 'bg-emerald-500' :
                              lock.signalStrength > 50 ? 'bg-amber-500' :
                              lock.signalStrength > 0 ? 'bg-red-500' : 'bg-gray-300'
                            }`} />
                            <span className="text-xs text-muted-foreground">{lock.signalStrength}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {formatDateTime(lock.lastActivity)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Access Logs ─── */}
        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Door Access Events</CardTitle>
                  <CardDescription>Recent door access activity across all locks</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {accessLogs.filter(l => l.status === 'granted').length} granted
                  </Badge>
                  <Badge variant="outline" className="text-xs text-red-500">
                    {accessLogs.filter(l => l.status === 'denied').length} denied
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
                      <TableHead>Guest</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="hidden sm:table-cell">Direction</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessLogs.map((log) => (
                      <TableRow key={log.id} className={log.status === 'denied' ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(log.timestamp)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{log.guestName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">{log.roomNumber}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {accessMethodIcon(log.method)}
                            <span className="text-sm">{accessMethodLabel(log.method)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {log.direction === 'entry' ? (
                              <><Unlock className="h-3 w-3 mr-1" /> Entry</>
                            ) : (
                              <><Lock className="h-3 w-3 mr-1" /> Exit</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.status === 'granted' ? (
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Granted
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" /> Denied
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {log.reason || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Key Card Encoding ─── */}
        <TabsContent value="keycards" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Key Card Management</CardTitle>
                  <CardDescription>Encode, manage, and track all key cards in the system</CardDescription>
                </div>
                <Button size="sm" onClick={() => setEncodeDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Encode New Card
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[480px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Card Number</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Accesses</TableHead>
                      <TableHead className="hidden md:table-cell">Expires</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keyCards.map((card) => (
                      <TableRow key={card.id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-mono text-sm">{card.cardNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{card.guestName}</TableCell>
                        <TableCell className="font-semibold">{card.roomNumber}</TableCell>
                        <TableCell>{providerBadge(card.provider)}</TableCell>
                        <TableCell>{keyCardStatusBadge(card.status)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {card.accessCount}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {formatDateTime(card.expiresAt)}
                        </TableCell>
                        <TableCell>
                          {card.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 h-7 px-2"
                              onClick={() => setCancelCardId(card.id)}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Cancel
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

      {/* ─── Provider Config Dialog ─── */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Lock Provider Configuration
            </DialogTitle>
            <DialogDescription>
              Manage connection settings and firmware for the lock provider
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cfg-endpoint">API Endpoint</Label>
              <Input id="cfg-endpoint" placeholder="https://api.provider.com/v1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-key">API Key</Label>
              <Input id="cfg-key" type="password" placeholder="Enter API key" />
            </div>
            <div className="space-y-2">
              <Label>Firmware Auto-Update</Label>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Auto-update firmware</p>
                  <p className="text-xs text-muted-foreground">Automatically push firmware updates to locks</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Battery Alert Threshold</Label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-6">10%</span>
                <Progress value={20} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground w-6">100%</span>
              </div>
              <p className="text-xs text-muted-foreground">Alert when battery drops below 20%</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              setConfigDialogOpen(false);
              toast.success('Provider configuration saved');
            }}>
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Cancel Card Confirmation ─── */}
      <AlertDialog open={!!cancelCardId} onOpenChange={(open) => !open && setCancelCardId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Cancel Key Card
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this key card? The guest will no longer be able to access
              their room with this card. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Card Active</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelCard} className="bg-red-600 hover:bg-red-700">
              Cancel Key Card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Info Banner ─── */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold mb-1">Lock Integration Best Practices</h4>
              <p className="text-sm text-muted-foreground">
                Ensure all lock firmware is up to date for optimal security. Monitor battery levels proactively
                and schedule replacements before locks go offline. The system automatically revokes expired key
                cards and sends low-battery alerts to maintenance teams.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
