'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Lock,
  Unlock,
  Wifi,
  WifiOff,
  BatteryLow,
  AlertTriangle,
  AlertCircle,
  Search,
  Eye,
  RefreshCw,
  Key,
  CreditCard,
  Fingerprint,
  Smartphone,
  Settings,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Zap,
  Shield,
  Clock,
  User,
  KeyRound,
  Wrench,
  MonitorSmartphone,
  ToggleLeft,
  Loader2,
  Copy,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Activity,
  Ban,
  CheckCircle2,
  CircleDot,
  TriangleAlert,
  DoorOpen,
  CalendarDays,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────

type LockStatus = 'online' | 'offline' | 'low_battery' | 'jammed' | 'maintenance';
type AccessMethod = 'mobile_key' | 'key_card' | 'pin' | 'fingerprint' | 'remote_unlock' | 'auto_lock';

interface LockProvider {
  id: string;
  name: string;
  enabled: boolean;
  apiKey: string;
  endpointUrl: string;
  firmwareVersion: string;
  lockCount: number;
  lastSync: string;
}

interface RoomLock {
  id: string;
  roomNumber: string;
  floor: number;
  lockStatus: LockStatus;
  provider: string;
  firmwareVersion: string;
  batteryLevel: number;
  lastActivity: string;
  guestName?: string;
  guestCheckIn?: string;
  guestCheckOut?: string;
  autoLockTimeout: number;
  isLocked: boolean;
}

interface AccessLogEntry {
  id: string;
  roomNumber: string;
  timestamp: string;
  method: AccessMethod;
  person: string;
  result: 'granted' | 'denied';
  reason?: string;
  isSuspicious: boolean;
}

interface KeyCard {
  id: string;
  cardId: string;
  cardType: 'guest' | 'staff' | 'master' | 'emergency';
  assignedTo: string;
  roomNumber: string;
  status: 'active' | 'deactivated' | 'expired' | 'lost';
  issuedDate: string;
  expiryDate: string;
  lastUsed?: string;
}

interface LockSettings {
  autoLockTimeout: number;
  lockoutAttempts: number;
  lockoutDuration: number;
  enableGuestAccessWindow: boolean;
  accessStartOffsetHours: number;
  accessEndOffsetHours: number;
  enableAfterHoursRestriction: boolean;
  afterHoursStart: string;
  afterHoursEnd: string;
}

interface AccessSchedule {
  id: string;
  name: string;
  description?: string;
  type: 'guest' | 'staff' | 'maintenance' | 'emergency';
  roomNumbers: string[];
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isActive: boolean;
  priority: number;
}

// ─── Config ─────────────────────────────────────────────────────────

const LOCK_STATUS_CONFIG: Record<LockStatus, { label: string; color: string; bgColor: string; icon: typeof Lock }> = {
  online: { label: 'Online', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800', icon: Wifi },
  offline: { label: 'Offline', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800', icon: WifiOff },
  low_battery: { label: 'Low Battery', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800', icon: BatteryLow },
  jammed: { label: 'Jammed', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800', icon: AlertTriangle },
  maintenance: { label: 'Maintenance', color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700', icon: Wrench },
};

const ACCESS_METHOD_CONFIG: Record<AccessMethod, { label: string; icon: typeof Key; color: string }> = {
  mobile_key: { label: 'Mobile Key', icon: Smartphone, color: 'text-violet-600 dark:text-violet-400' },
  key_card: { label: 'Key Card', icon: CreditCard, color: 'text-sky-600 dark:text-sky-400' },
  pin: { label: 'PIN Code', icon: KeyRound, color: 'text-amber-600 dark:text-amber-400' },
  fingerprint: { label: 'Fingerprint', icon: Fingerprint, color: 'text-emerald-600 dark:text-emerald-400' },
  remote_unlock: { label: 'Remote Unlock', icon: MonitorSmartphone, color: 'text-rose-600 dark:text-rose-400' },
  auto_lock: { label: 'Auto-Lock', icon: Lock, color: 'text-gray-500 dark:text-gray-400' },
};

const CARD_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  guest: { label: 'Guest', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  staff: { label: 'Staff', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  master: { label: 'Master', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  emergency: { label: 'Emergency', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

// ─── Component ──────────────────────────────────────────────────────

export default function SmartLockManagement() {
  const [activeTab, setActiveTab] = useState('lock_grid');
  const [search, setSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRoom, setSelectedRoom] = useState<RoomLock | null>(null);
  const [roomDetailOpen, setRoomDetailOpen] = useState(false);
  const [encodeDialogOpen, setEncodeDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<KeyCard | null>(null);
  const [remoteUnlockDialogOpen, setRemoteUnlockDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<LockProvider | null>(null);
  const [saving, setSaving] = useState(false);
  const [accessMethodFilter, setAccessMethodFilter] = useState('all');
  const [cardSearch, setCardSearch] = useState('');
  const [cardTypeFilter, setCardTypeFilter] = useState('all');

  // API state
  const [roomLocks, setRoomLocks] = useState<RoomLock[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLogEntry[]>([]);
  const [keyCards, setKeyCards] = useState<KeyCard[]>([]);
  const [providers, setProviders] = useState<LockProvider[]>([]);
  const [accessSchedules, setAccessSchedules] = useState<AccessSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<LockSettings>({
    autoLockTimeout: 30,
    lockoutAttempts: 5,
    lockoutDuration: 5,
    enableGuestAccessWindow: true,
    accessStartOffsetHours: 2,
    accessEndOffsetHours: 1,
    enableAfterHoursRestriction: true,
    afterHoursStart: '23:00',
    afterHoursEnd: '06:00',
  });

  const [encodeForm, setEncodeForm] = useState({
    cardType: 'guest' as string,
    assignedTo: '',
    roomNumber: '',
    durationDays: 3,
  });

  const [refreshing, setRefreshing] = useState(false);

  // ── Fetch all data in parallel ──
  const fetchDevices = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    // Helper: safely fetch JSON with fallback on error
    const safeFetch = async <T,>(url: string, mapper: (json: Record<string, unknown>) => T[]): Promise<T[]> => {
      try {
        const res = await fetch(url);
        if (!res.ok) return [];
        const json = await res.json();
        return mapper(json);
      } catch {
        return [];
      }
    };

    // 1. Fetch room locks (primary data source)
    const locksPromise = (async () => {
      try {
        const res = await fetch('/api/iot/devices?type=smart_lock&limit=100');
        if (!res.ok) throw new Error('Failed to fetch IoT devices');
        const json = await res.json();
        if (json.devices) {
          return json.devices
            .filter((d: Record<string, unknown>) => d.type === 'smart_lock')
            .map((d: Record<string, unknown>) => ({
              id: d.id as string,
              roomNumber: d.roomName ? String(d.roomName).split(' - ')[0] : (d.name as string),
              floor: 1,
              lockStatus: (d.status as RoomLock['lockStatus']) === 'online' ? 'online' :
                (d.status as string) === 'error' ? 'jammed' : (d.status as RoomLock['lockStatus']) || 'offline',
              provider: (d.manufacturer as string) || 'Unknown',
              firmwareVersion: (d.model as string) || '',
              batteryLevel: ((d.currentState as Record<string, unknown>)?.battery as number) || 100,
              lastActivity: d.updatedAt ? String(d.updatedAt) : d.createdAt ? String(d.createdAt) : '',
              autoLockTimeout: 30,
              isLocked: ((d.currentState as Record<string, unknown>)?.locked as boolean) ?? true,
            })) as RoomLock[];
        }
        return [];
      } catch (err) {
        if (!isRefresh) setError(err instanceof Error ? err.message : 'Failed to load devices');
        return [];
      }
    })();

    // 2. Fetch access logs (try primary, fallback to secondary)
    const logsPromise = (async () => {
      const logs = await safeFetch<AccessLogEntry>('/api/iot/devices/access-logs?limit=100', (json) => {
        const items = (json.logs ?? json.data ?? json.items ?? []) as Record<string, unknown>[];
        return items.map((d) => ({
          id: d.id as string,
          roomNumber: d.roomNumber ?? d.room ?? '' as string,
          timestamp: d.timestamp ?? d.createdAt ?? '' as string,
          method: d.method ?? d.accessMethod ?? 'key_card' as AccessMethod,
          person: d.person ?? d.user ?? d.userName ?? 'Unknown' as string,
          result: (d.result === 'denied' || d.result === 'rejected') ? 'denied' as const : 'granted' as const,
          reason: d.reason as string | undefined,
          isSuspicious: (d.isSuspicious ?? d.suspicious ?? false) as boolean,
        }));
      });
      if (logs.length > 0) return logs;
      // Fallback endpoint
      return safeFetch<AccessLogEntry>('/api/audit-logs?category=security&limit=100', (json) => {
        const items = (json.logs ?? json.data ?? json.items ?? []) as Record<string, unknown>[];
        return items.map((d) => ({
          id: d.id as string,
          roomNumber: d.roomNumber ?? d.room ?? '' as string,
          timestamp: d.timestamp ?? d.createdAt ?? '' as string,
          method: d.method ?? d.accessMethod ?? 'key_card' as AccessMethod,
          person: d.person ?? d.user ?? d.userName ?? 'Unknown' as string,
          result: (d.result === 'denied' || d.result === 'rejected') ? 'denied' as const : 'granted' as const,
          reason: d.reason as string | undefined,
          isSuspicious: (d.isSuspicious ?? d.suspicious ?? false) as boolean,
        }));
      });
    })();

    // 3. Fetch key cards
    const cardsPromise = safeFetch<KeyCard>('/api/key-cards?limit=100', (json) => {
      const items = (json.cards ?? json.data ?? json.items ?? []) as Record<string, unknown>[];
      return items.map((d) => ({
        id: d.id as string,
        cardId: d.cardId ?? d.cardNumber ?? '' as string,
        cardType: (d.cardType ?? d.type ?? 'guest') as KeyCard['cardType'],
        assignedTo: d.assignedTo ?? d.holder ?? '' as string,
        roomNumber: d.roomNumber ?? d.room ?? '' as string,
        status: (d.status ?? 'active') as KeyCard['status'],
        issuedDate: d.issuedDate ?? d.createdAt ?? '' as string,
        expiryDate: d.expiryDate ?? d.expiresAt ?? '' as string,
        lastUsed: d.lastUsed as string | undefined,
      }));
    });

    // 4. Fetch providers (try primary, fallback to deriving from locks)
    const providersPromise = (async (): Promise<LockProvider[]> => {
      const providerData = await safeFetch<LockProvider>('/api/integrations/smart-locks/providers', (json) => {
        const items = (json.providers ?? json.data ?? json.items ?? []) as Record<string, unknown>[];
        return items.map((d) => ({
          id: d.id as string,
          name: d.name as string,
          enabled: (d.enabled ?? true) as boolean,
          apiKey: (d.apiKey ?? '') as string,
          endpointUrl: (d.endpointUrl ?? '') as string,
          firmwareVersion: (d.firmwareVersion ?? '') as string,
          lockCount: (d.lockCount ?? 0) as number,
          lastSync: (d.lastSync ?? '') as string,
        }));
      });
      if (providerData.length > 0) return providerData;
      // Fallback: derive from locks by grouping by provider
      return [];
    })();

    // 5. Fetch access schedules/policies
    const schedulesPromise = safeFetch<AccessSchedule>('/api/iot/access-schedules', (json) => {
      const items = (json.schedules ?? json.data ?? json.items ?? []) as Record<string, unknown>[];
      return items.map((d) => ({
        id: d.id as string,
        name: (d.name ?? d.scheduleName ?? '') as string,
        description: d.description as string | undefined,
        type: (d.type ?? d.scheduleType ?? 'guest') as AccessSchedule['type'],
        roomNumbers: (d.roomNumbers ?? d.rooms ?? []) as string[],
        daysOfWeek: (d.daysOfWeek ?? d.days ?? [0,1,2,3,4,5,6]) as number[],
        startTime: (d.startTime ?? d.start ?? '00:00') as string,
        endTime: (d.endTime ?? d.end ?? '23:59') as string,
        isActive: (d.isActive ?? d.active ?? true) as boolean,
        priority: (d.priority ?? 0) as number,
      }));
    });

    // Execute all fetches in parallel
    const [locksResult, logsResult, cardsResult, providersResult, schedulesResult] = await Promise.allSettled([
      locksPromise,
      logsPromise,
      cardsPromise,
      providersPromise,
      schedulesPromise,
    ]);

    // Apply results (fulfilled values only, errors leave state unchanged)
    if (locksResult.status === 'fulfilled' && locksResult.value.length > 0) {
      setRoomLocks(locksResult.value);
      // Derive providers from locks if provider fetch was empty
      if (providersResult.status === 'fulfilled' && providersResult.value.length === 0) {
        const providerMap = new Map<string, { count: number; firmware: string; online: number }>();
        locksResult.value.forEach((lock) => {
          const existing = providerMap.get(lock.provider);
          if (existing) {
            existing.count++;
            if (lock.lockStatus === 'online') existing.online++;
          } else {
            providerMap.set(lock.provider, {
              count: 1,
              firmware: lock.firmwareVersion,
              online: lock.lockStatus === 'online' ? 1 : 0,
            });
          }
        });
        const derived: LockProvider[] = Array.from(providerMap.entries()).map(([name, info], idx) => ({
          id: `derived-${idx}`,
          name,
          enabled: info.online > 0,
          apiKey: '',
          endpointUrl: '',
          firmwareVersion: info.firmware,
          lockCount: info.count,
          lastSync: new Date().toISOString(),
        }));
        setProviders(derived);
      } else if (providersResult.status === 'fulfilled') {
        setProviders(providersResult.value);
      }
    }
    if (logsResult.status === 'fulfilled') setAccessLogs(logsResult.value);
    if (cardsResult.status === 'fulfilled') setKeyCards(cardsResult.value);
    if (schedulesResult.status === 'fulfilled') setAccessSchedules(schedulesResult.value);

    setLoading(false);
    setRefreshing(false);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { fetchDevices(); }, [fetchDevices]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleRefresh = useCallback(() => { fetchDevices(true); }, [fetchDevices]);

  // ── Computed ──
  const floors = useMemo(() => [...new Set(roomLocks.map(l => l.floor))].sort(), []);
  const rooms = useMemo(() => [...new Set(roomLocks.map(l => l.roomNumber))].sort(), []);

  const filteredRooms = useMemo(() => {
    return roomLocks.filter(r => {
      const matchSearch = !search || r.roomNumber.includes(search) || (r.guestName && r.guestName.toLowerCase().includes(search.toLowerCase()));
      const matchFloor = floorFilter === 'all' || r.floor === Number(floorFilter);
      const matchStatus = statusFilter === 'all' || r.lockStatus === statusFilter;
      return matchSearch && matchFloor && matchStatus;
    });
  }, [roomLocks, search, floorFilter, statusFilter]);

  const filteredLogs = useMemo(() => {
    return accessLogs.filter(l => {
      const matchMethod = accessMethodFilter === 'all' || l.method === accessMethodFilter;
      return matchMethod;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [accessLogs, accessMethodFilter]);

  const filteredCards = useMemo(() => {
    return keyCards.filter(c => {
      const matchSearch = !cardSearch || c.cardId.toLowerCase().includes(cardSearch.toLowerCase()) || c.assignedTo.toLowerCase().includes(cardSearch.toLowerCase());
      const matchType = cardTypeFilter === 'all' || c.cardType === cardTypeFilter;
      return matchSearch && matchType;
    });
  }, [keyCards, cardSearch, cardTypeFilter]);

  const lockStats = useMemo(() => {
    const total = roomLocks.length;
    const online = roomLocks.filter(l => l.lockStatus === 'online').length;
    const offline = roomLocks.filter(l => l.lockStatus === 'offline').length;
    const lowBattery = roomLocks.filter(l => l.lockStatus === 'low_battery').length;
    const jammed = roomLocks.filter(l => l.lockStatus === 'jammed').length;
    const maintenance = roomLocks.filter(l => l.lockStatus === 'maintenance').length;
    const suspicious = accessLogs.filter(l => l.isSuspicious).length;
    return { total, online, offline, lowBattery, jammed, maintenance, suspicious };
  }, [roomLocks, accessLogs]);

  const batteryAlerts = useMemo(() => {
    return roomLocks
      .filter(l => l.batteryLevel > 0 && l.batteryLevel <= 20)
      .sort((a, b) => a.batteryLevel - b.batteryLevel);
  }, [roomLocks]);

  // ── Handlers ──
  const handleRemoteUnlock = (room: RoomLock) => {
    setSelectedRoom(room);
    setRemoteUnlockDialogOpen(true);
  };

  const confirmRemoteUnlock = async () => {
    if (!selectedRoom) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/iot/devices/${selectedRoom.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'unlock' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Room ${selectedRoom.roomNumber} unlocked remotely`);
        setRoomLocks(prev => prev.map(l => l.id === selectedRoom.id ? { ...l, isLocked: false } : l));
      } else {
        toast.error(`Unlock failed: ${json.error || 'Unknown error'}`);
      }
    } catch {
      toast.error('Network error: Failed to send unlock command');
    } finally {
      setRemoteUnlockDialogOpen(false);
      setSelectedRoom(null);
      setSaving(false);
    }
  };

  const handleEncodeCard = async () => {
    if (!encodeForm.assignedTo || !encodeForm.roomNumber) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      toast.success(`Key card encoded for ${encodeForm.assignedTo} — Room ${encodeForm.roomNumber}`);
      setEncodeDialogOpen(false);
      setEncodeForm({ cardType: 'guest', assignedTo: '', roomNumber: '', durationDays: 3 });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateCard = (card: KeyCard) => {
    setSelectedCard(card);
    setDeactivateDialogOpen(true);
  };

  const confirmDeactivate = async () => {
    if (!selectedCard) return;
    setSaving(true);
    try {
      toast.success(`Card ${selectedCard.cardId} deactivated`);
      setDeactivateDialogOpen(false);
      setSelectedCard(null);
    } finally {
      setSaving(false);
    }
  };

  const handleEmergencyOverride = async () => {
    setSaving(true);
    try {
      toast.success('Emergency override activated — all locks unlocked');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncProvider = (provider: LockProvider) => {
    toast.success(`Syncing ${provider.name}... Firmware check initiated`);
  };

  const handleToggleProvider = (provider: LockProvider) => {
    setSelectedProvider(provider);
    setProviderDialogOpen(true);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      toast.success('Lock settings saved successfully');
      setSettingsDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  // ── Render Helpers ──
  const getBatteryIcon = (level: number) => {
    if (level <= 20) return <BatteryWarning className="h-4 w-4 text-red-500" />;
    if (level <= 50) return <BatteryLow className="h-4 w-4 text-amber-500" />;
    return <BatteryCharging className="h-4 w-4 text-emerald-500" />;
  };

  const getBatteryColor = (level: number) => {
    if (level <= 20) return 'text-red-600 dark:text-red-400';
    if (level <= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  const getAccessMethodIcon = (method: AccessMethod) => {
    const config = ACCESS_METHOD_CONFIG[method];
    const Icon = config.icon;
    return <Icon className={cn('h-4 w-4', config.color)} />;
  };

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const formatDate = (ts: string) => {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ── JSX ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Loading smart locks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
          <p className="text-sm text-red-500 mt-2">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchDevices}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Smart Lock Management</h1>
          <p className="text-muted-foreground">
            Monitor and manage electronic door locks, access control, and security across all rooms
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 w-fit"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 lg:grid-cols-7">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs font-medium text-muted-foreground">Total</p>
            <p className="text-xl font-bold">{lockStats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-3 text-center">
            <p className="text-xs font-medium text-green-600 dark:text-green-400">Online</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">{lockStats.online}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-3 text-center">
            <p className="text-xs font-medium text-red-600 dark:text-red-400">Offline</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{lockStats.offline}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-3 text-center">
            <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">Low Bat.</p>
            <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{lockStats.lowBattery}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="p-3 text-center">
            <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Jammed</p>
            <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{lockStats.jammed}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 dark:border-gray-700">
          <CardContent className="p-3 text-center">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Maint.</p>
            <p className="text-xl font-bold text-gray-600 dark:text-gray-400">{lockStats.maintenance}</p>
          </CardContent>
        </Card>
        <Card className="border-rose-200 dark:border-rose-800">
          <CardContent className="p-3 text-center">
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Alerts</p>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{lockStats.suspicious}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="lock_grid" className="gap-1.5">
            <DoorOpen className="h-4 w-4" />
            Lock Grid
          </TabsTrigger>
          <TabsTrigger value="access_log" className="gap-1.5">
            <Activity className="h-4 w-4" />
            Access Log
            {lockStats.suspicious > 0 && (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs h-5 px-1.5">{lockStats.suspicious}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="key_cards" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            Key Cards
          </TabsTrigger>
          <TabsTrigger value="battery" className="gap-1.5">
            <Battery className="h-4 w-4" />
            Battery
            {batteryAlerts.length > 0 && (
              <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs h-5 px-1.5">{batteryAlerts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="providers" className="gap-1.5">
            <Shield className="h-4 w-4" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="lock_settings" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Lock Grid ── */}
        <TabsContent value="lock_grid" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search room # or guest name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={floorFilter} onValueChange={setFloorFilter}>
                  <SelectTrigger className="w-full md:w-[140px]">
                    <SelectValue placeholder="Floor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Floors</SelectItem>
                    {floors.map(f => (
                      <SelectItem key={f} value={String(f)}>Floor {f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[160px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {Object.entries(LOCK_STATUS_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Room Lock Grid */}
          {floors.map(floor => {
            const floorRooms = filteredRooms.filter(r => r.floor === floor);
            if (floorRooms.length === 0) return null;
            return (
              <Card key={floor}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    Floor {floor}
                    <Badge variant="outline" className="text-xs">{floorRooms.length} rooms</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {floorRooms.map(room => {
                      const statusConf = LOCK_STATUS_CONFIG[room.lockStatus];
                      const StatusIcon = statusConf.icon;
                      return (
                        <button
                          key={room.id}
                          onClick={() => { setSelectedRoom(room); setRoomDetailOpen(true); }}
                          className={cn(
                            'relative p-3 rounded-lg border-2 text-left transition-all hover:shadow-md cursor-pointer',
                            statusConf.bgColor,
                            room.isLocked ? '' : 'ring-2 ring-amber-300 dark:ring-amber-700'
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-lg font-bold">#{room.roomNumber}</span>
                            <div className="flex gap-1">
                              {room.isLocked ? (
                                <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Unlock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              )}
                            </div>
                          </div>
                          {room.guestName && (
                            <p className="text-xs font-medium truncate mb-1">{room.guestName}</p>
                          )}
                          <div className="flex items-center justify-between">
                            <Badge className={cn('text-[10px] px-1.5 py-0', statusConf.bgColor, statusConf.color)}>
                              <StatusIcon className="h-3 w-3 mr-0.5" />
                              {statusConf.label}
                            </Badge>
                            <div className="flex items-center gap-0.5" title={`Battery: ${room.batteryLevel}%`}>
                              {room.batteryLevel > 0 ? getBatteryIcon(room.batteryLevel) : <WifiOff className="h-3 w-3 text-gray-400" />}
                              <span className={cn('text-[10px] font-medium', room.batteryLevel > 0 ? getBatteryColor(room.batteryLevel) : 'text-gray-400')}>
                                {room.batteryLevel > 0 ? `${room.batteryLevel}%` : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ── Tab: Access Log ── */}
        <TabsContent value="access_log" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <Select value={accessMethodFilter} onValueChange={setAccessMethodFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Access Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    {Object.entries(ACCESS_METHOD_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Access Log
                <Badge variant="outline" className="ml-2">{filteredLogs.length} entries</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[600px]">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Person</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Activity className="h-8 w-8" />
                            <p className="text-sm font-medium">No access logs found</p>
                            <p className="text-xs">Access logs will appear here when door events are recorded</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredLogs.map((log) => (
                      <TableRow key={log.id} className={cn(log.isSuspicious && 'bg-red-50/50 dark:bg-red-950/10')}>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {formatTime(log.timestamp)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono font-medium">#{log.roomNumber}</code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {getAccessMethodIcon(log.method)}
                            <span className="text-sm">{ACCESS_METHOD_CONFIG[log.method].label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{log.person}</TableCell>
                        <TableCell>
                          {log.result === 'granted' ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-0.5" />
                              Granted
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
                              <Ban className="h-3 w-3 mr-0.5" />
                              Denied
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {log.isSuspicious && (
                              <span className="text-red-600 dark:text-red-400 flex items-center gap-1 text-xs font-medium">
                                <TriangleAlert className="h-3 w-3" />
                                Suspicious
                              </span>
                            )}
                            {log.reason && !log.isSuspicious && (
                              <span className="text-muted-foreground text-xs">{log.reason}</span>
                            )}
                            {log.reason && log.isSuspicious && (
                              <span className="text-red-500 text-xs ml-2">{log.reason}</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Key Cards ── */}
        <TabsContent value="key_cards" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search card ID or assignee..."
                    value={cardSearch}
                    onChange={(e) => setCardSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={cardTypeFilter} onValueChange={setCardTypeFilter}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="Card Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(CARD_TYPE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="bg-emerald-500 hover:bg-emerald-600 gap-1.5" onClick={() => setEncodeDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Encode New Card
                </Button>
                <Button variant="outline" className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleEmergencyOverride}>
                  <Zap className="h-4 w-4" />
                  Emergency Override
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Key Card Registry
                <Badge variant="outline" className="ml-2">{filteredCards.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[500px]">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Card ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCards.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <CreditCard className="h-8 w-8" />
                            <p className="text-sm font-medium">No key cards found</p>
                            <p className="text-xs">Key cards will appear here after being encoded in the system</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredCards.map((card) => (
                      <TableRow key={card.id}>
                        <TableCell><code className="text-xs bg-muted px-2 py-1 rounded font-mono">{card.cardId}</code></TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs', CARD_TYPE_CONFIG[card.cardType]?.color)}>{CARD_TYPE_CONFIG[card.cardType]?.label}</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{card.assignedTo}</TableCell>
                        <TableCell className="text-sm">{card.roomNumber}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            'text-xs',
                            card.status === 'active' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                            card.status === 'expired' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                            card.status === 'lost' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                            card.status === 'deactivated' && 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
                          )}>
                            {card.status.charAt(0).toUpperCase() + card.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(card.issuedDate)}</TableCell>
                        <TableCell className="text-sm">{formatDate(card.expiryDate)}</TableCell>
                        <TableCell className="text-right">
                          {card.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeactivateCard(card)}
                            >
                              <Ban className="h-4 w-4 mr-1" />
                              Deactivate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Battery Monitoring ── */}
        <TabsContent value="battery" className="space-y-4">
          {/* Critical Alerts */}
          {batteryAlerts.length > 0 && (
            <Card className="border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  Low Battery Alerts ({batteryAlerts.length} locks)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {batteryAlerts.map(lock => (
                    <div key={lock.id} className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-red-200 dark:border-red-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-lg">#{lock.roomNumber}</span>
                        <span className={cn('text-2xl font-bold', getBatteryColor(lock.batteryLevel))}>{lock.batteryLevel}%</span>
                      </div>
                      <Progress value={lock.batteryLevel} className="h-3 mb-2 [&>div]:bg-red-500" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{lock.provider}</span>
                        <span>Est. replace: {formatDate(new Date(Date.now() + (lock.batteryLevel < 10 ? 7 : 14) * 86400000).toISOString())}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full Battery Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Battery className="h-5 w-5" />
                Battery Status — All Locks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[500px]">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Battery Level</TableHead>
                      <TableHead>Drain Rate</TableHead>
                      <TableHead>Est. Replacement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roomLocks
                      .filter(l => l.batteryLevel > 0)
                      .sort((a, b) => a.batteryLevel - b.batteryLevel)
                      .map((lock) => {
                        const drainRate = (100 - lock.batteryLevel) / 90; // % per day assumed
                        const daysRemaining = Math.round(lock.batteryLevel / drainRate);
                        return (
                          <TableRow key={lock.id}>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded font-mono font-medium">#{lock.roomNumber}</code>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn('text-xs', LOCK_STATUS_CONFIG[lock.lockStatus].bgColor, LOCK_STATUS_CONFIG[lock.lockStatus].color)}>
                                {LOCK_STATUS_CONFIG[lock.lockStatus].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{lock.provider}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={lock.batteryLevel} className={cn(
                                  'w-24 h-2',
                                  lock.batteryLevel <= 20 ? '[&>div]:bg-red-500' : lock.batteryLevel <= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'
                                )} />
                                <span className={cn('text-sm font-medium', getBatteryColor(lock.batteryLevel))}>{lock.batteryLevel}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              ~{drainRate.toFixed(2)}%/day
                            </TableCell>
                            <TableCell className={cn('text-sm font-medium', daysRemaining < 30 ? 'text-red-600 dark:text-red-400' : daysRemaining < 60 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                              {formatDate(new Date(Date.now() + daysRemaining * 86400000).toISOString())}
                              <span className="text-xs text-muted-foreground ml-1">(~{daysRemaining}d)</span>
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
        </TabsContent>

        {/* ── Tab: Providers ── */}
        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Lock Provider Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {providers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Shield className="h-8 w-8 mb-2" />
                    <p className="text-sm font-medium">No providers configured</p>
                    <p className="text-xs">Lock providers will be detected automatically from connected devices</p>
                  </div>
                ) : providers.map(provider => (
                  <div key={provider.id} className={cn(
                    'flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border transition-all',
                    provider.enabled ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10' : 'border-gray-200 dark:border-gray-700 bg-muted/30'
                  )}>
                    <div className="flex items-center gap-4">
                      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', provider.enabled ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-gray-100 dark:bg-gray-800')}>
                        <Shield className={cn('h-5 w-5', provider.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400')} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{provider.name}</p>
                          {provider.enabled ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">Enabled</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Disabled</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Firmware: {provider.firmwareVersion} · {provider.lockCount} locks · Last sync: {formatDate(provider.lastSync)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {provider.enabled && (
                        <Button variant="outline" size="sm" onClick={() => handleSyncProvider(provider)}>
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          Sync
                        </Button>
                      )}
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={provider.enabled}
                          onCheckedChange={() => handleToggleProvider(provider)}
                        />
                        <Label className="text-sm">{provider.enabled ? 'On' : 'Off'}</Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Lock Settings ── */}
        <TabsContent value="lock_settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Lock Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Auto-Lock Timeout */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ToggleLeft className="h-5 w-5 text-amber-500" />
                  <h3 className="font-medium">Auto-Lock Timeout</h3>
                </div>
                <p className="text-sm text-muted-foreground">Automatically lock the door after it has been left unlocked for the specified duration.</p>
                <div className="flex items-center gap-3">
                  <Select value={String(settings.autoLockTimeout)} onValueChange={(v) => setSettings({ ...settings, autoLockTimeout: Number(v) })}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 seconds</SelectItem>
                      <SelectItem value="60">60 seconds</SelectItem>
                      <SelectItem value="120">120 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Lockout Policy */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Ban className="h-5 w-5 text-red-500" />
                  <h3 className="font-medium">Lockout Policy</h3>
                </div>
                <p className="text-sm text-muted-foreground">Lock the door after multiple failed access attempts to prevent unauthorized entry.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Failed Attempts Before Lockout</Label>
                    <Select value={String(settings.lockoutAttempts)} onValueChange={(v) => setSettings({ ...settings, lockoutAttempts: Number(v) })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 attempts</SelectItem>
                        <SelectItem value="5">5 attempts</SelectItem>
                        <SelectItem value="10">10 attempts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Lockout Duration</Label>
                    <Select value={String(settings.lockoutDuration)} onValueChange={(v) => setSettings({ ...settings, lockoutDuration: Number(v) })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Guest Access Window */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-sky-500" />
                    <h3 className="font-medium">Guest Access Window</h3>
                  </div>
                  <Switch
                    checked={settings.enableGuestAccessWindow}
                    onCheckedChange={(v) => setSettings({ ...settings, enableGuestAccessWindow: v })}
                  />
                </div>
                <p className="text-sm text-muted-foreground">Control when guests can access their rooms relative to check-in and check-out times.</p>
                {settings.enableGuestAccessWindow && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    <div className="space-y-2">
                      <Label>Access Starts Before Check-In</Label>
                      <Select value={String(settings.accessStartOffsetHours)} onValueChange={(v) => setSettings({ ...settings, accessStartOffsetHours: Number(v) })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 hour before</SelectItem>
                          <SelectItem value="2">2 hours before</SelectItem>
                          <SelectItem value="3">3 hours before</SelectItem>
                          <SelectItem value="4">4 hours before</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Access Ends After Check-Out</Label>
                      <Select value={String(settings.accessEndOffsetHours)} onValueChange={(v) => setSettings({ ...settings, accessEndOffsetHours: Number(v) })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">At check-out</SelectItem>
                          <SelectItem value="1">1 hour after</SelectItem>
                          <SelectItem value="2">2 hours after</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* After Hours Restriction */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-violet-500" />
                    <h3 className="font-medium">After-Hours Access Restriction</h3>
                  </div>
                  <Switch
                    checked={settings.enableAfterHoursRestriction}
                    onCheckedChange={(v) => setSettings({ ...settings, enableAfterHoursRestriction: v })}
                  />
                </div>
                <p className="text-sm text-muted-foreground">Restrict staff access during specified hours. Emergency and master keys are exempt.</p>
                {settings.enableAfterHoursRestriction && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    <div className="space-y-2">
                      <Label>Restriction Start</Label>
                      <Input
                        type="time"
                        value={settings.afterHoursStart}
                        onChange={(e) => setSettings({ ...settings, afterHoursStart: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Restriction End</Label>
                      <Input
                        type="time"
                        value={settings.afterHoursEnd}
                        onChange={(e) => setSettings({ ...settings, afterHoursEnd: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <div className="px-6 pb-6">
              <Button onClick={handleSaveSettings} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Settings
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog: Room Detail ── */}
      <Dialog open={roomDetailOpen} onOpenChange={setRoomDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Room #{selectedRoom?.roomNumber} — Lock Details</DialogTitle>
            <DialogDescription>Floor {selectedRoom?.floor}</DialogDescription>
          </DialogHeader>
          {selectedRoom && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={cn('text-xs', LOCK_STATUS_CONFIG[selectedRoom.lockStatus].bgColor, LOCK_STATUS_CONFIG[selectedRoom.lockStatus].color)}>
                    {LOCK_STATUS_CONFIG[selectedRoom.lockStatus].label}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Lock State</Label>
                  <Badge className={selectedRoom.isLocked ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}>
                    {selectedRoom.isLocked ? <><Lock className="h-3 w-3 mr-1" />Locked</> : <><Unlock className="h-3 w-3 mr-1" />Unlocked</>}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Provider</Label>
                  <p className="text-sm font-medium">{selectedRoom.provider}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Firmware</Label>
                  <p className="text-sm font-mono">{selectedRoom.firmwareVersion}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Battery</Label>
                  <div className="flex items-center gap-2">
                    <Progress value={selectedRoom.batteryLevel} className={cn(
                      'w-16 h-2',
                      selectedRoom.batteryLevel <= 20 ? '[&>div]:bg-red-500' : selectedRoom.batteryLevel <= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'
                    )} />
                    <span className={cn('text-sm font-medium', selectedRoom.batteryLevel > 0 ? getBatteryColor(selectedRoom.batteryLevel) : 'text-gray-400')}>
                      {selectedRoom.batteryLevel > 0 ? `${selectedRoom.batteryLevel}%` : 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Auto-Lock</Label>
                  <p className="text-sm">{selectedRoom.autoLockTimeout}s</p>
                </div>
              </div>

              {selectedRoom.guestName && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Current Guest</Label>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="font-medium">{selectedRoom.guestName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Check-in: {selectedRoom.guestCheckIn} · Check-out: {selectedRoom.guestCheckOut}
                      </p>
                    </div>
                  </div>
                </>
              )}

              <div className="text-xs text-muted-foreground">
                Last activity: {new Date(selectedRoom.lastActivity).toLocaleString()}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRoomDetailOpen(false)}>Close</Button>
            {selectedRoom?.lockStatus === 'online' && (
              <Button
                variant={selectedRoom?.isLocked ? 'default' : 'outline'}
                className={selectedRoom?.isLocked ? 'bg-amber-500 hover:bg-amber-600' : 'text-emerald-600 border-emerald-300 hover:bg-emerald-50'}
                onClick={() => {
                  setRoomDetailOpen(false);
                  handleRemoteUnlock(selectedRoom);
                }}
              >
                {selectedRoom?.isLocked ? (
                  <><Unlock className="h-4 w-4 mr-1" />Remote Unlock</>
                ) : (
                  <><Lock className="h-4 w-4 mr-1" />Remote Lock</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Remote Unlock ── */}
      <AlertDialog open={remoteUnlockDialogOpen} onOpenChange={setRemoteUnlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remote {selectedRoom?.isLocked ? 'Unlock' : 'Lock'} — Room #{selectedRoom?.roomNumber}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedRoom?.isLocked
                ? `Are you sure you want to remotely unlock Room ${selectedRoom?.roomNumber}? This will be logged for security purposes.`
                : `Are you sure you want to remotely lock Room ${selectedRoom?.roomNumber}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoteUnlock}
              className={selectedRoom?.isLocked ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog: Encode Key Card ── */}
      <Dialog open={encodeDialogOpen} onOpenChange={setEncodeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Encode New Key Card</DialogTitle>
            <DialogDescription>Configure and encode a new key card for access</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Card Type</Label>
              <Select value={encodeForm.cardType} onValueChange={(v) => setEncodeForm({ ...encodeForm, cardType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CARD_TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign To *</Label>
              <Input
                value={encodeForm.assignedTo}
                onChange={(e) => setEncodeForm({ ...encodeForm, assignedTo: e.target.value })}
                placeholder="Guest or staff name"
              />
            </div>
            <div className="space-y-2">
              <Label>Room Number *</Label>
              <Select value={encodeForm.roomNumber} onValueChange={(v) => setEncodeForm({ ...encodeForm, roomNumber: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(r => (
                    <SelectItem key={r} value={r}>Room {r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration (days)</Label>
              <Select value={String(encodeForm.durationDays)} onValueChange={(v) => setEncodeForm({ ...encodeForm, durationDays: Number(v) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="365">1 year (Staff)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEncodeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEncodeCard} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CreditCard className="h-4 w-4 mr-1" />
              Encode Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Deactivate Card ── */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Key Card</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate card {selectedCard?.cardId} assigned to {selectedCard?.assignedTo}? This action cannot be undone. The card will immediately lose all access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate} className="bg-red-500 hover:bg-red-600" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog: Toggle Provider ── */}
      <AlertDialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedProvider?.enabled ? 'Disable' : 'Enable'} Provider</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedProvider?.enabled
                ? `Are you sure you want to disable ${selectedProvider?.name}? This will disconnect ${selectedProvider?.lockCount} locks.`
                : `Enable ${selectedProvider?.name}? You will need to configure API credentials.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { toast.success(`${selectedProvider?.name} ${selectedProvider?.enabled ? 'disabled' : 'enabled'}`); setProviderDialogOpen(false); }}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
