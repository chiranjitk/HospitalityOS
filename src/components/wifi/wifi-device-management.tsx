'use client';

/**
 * Multi-Device Management — F9: Multi-Device Auto-Registration
 *
 * Manage guest device registrations, view device groups, configure
 * auto-auth settings, and monitor multi-device usage.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Smartphone,
  Laptop,
  Tablet,
  Watch,
  Monitor,
  Cpu,
  ToggleLeft,
  ToggleRight,
  Search,
  Plus,
  Trash2,
  Shield,
  Edit,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Loader2,
  Users,
  Wifi,
  Zap,
  Settings,
  Eye,
  Ban,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface DeviceGuest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
}

interface DeviceProperty {
  id: string;
  name: string;
}

interface WiFiDevice {
  id: string;
  tenantId: string;
  guestId: string;
  propertyId?: string | null;
  macAddress: string;
  deviceName?: string | null;
  deviceType?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  isApproved: boolean;
  firstSeen: string;
  lastSeen: string;
  autoAuth: boolean;
  createdAt: string;
  updatedAt: string;
  guest: DeviceGuest;
  property?: DeviceProperty | null;
}

interface GuestDeviceGroup {
  guestId: string;
  guestName: string;
  guestEmail?: string | null;
  devices: WiFiDevice[];
  deviceCount: number;
}

interface DeviceStats {
  totalDevices: number;
  activeGuests: number;
  autoAuthEnabled: number;
  avgDevicesPerGuest: number;
}

// ─── Device Type Icons ─────────────────────────────────────────────────────────

function DeviceTypeIcon({ type, className = 'h-4 w-4' }: { type?: string | null; className?: string }) {
  switch (type) {
    case 'phone':
      return <Smartphone className={className} />;
    case 'laptop':
      return <Laptop className={className} />;
    case 'tablet':
      return <Tablet className={className} />;
    case 'watch':
      return <Watch className={className} />;
    case 'tv':
      return <Monitor className={className} />;
    default:
      return <Cpu className={className} />;
  }
}

function getDeviceTypeLabel(type?: string | null): string {
  switch (type) {
    case 'phone': return 'Phone';
    case 'laptop': return 'Laptop';
    case 'tablet': return 'Tablet';
    case 'watch': return 'Watch';
    case 'tv': return 'TV';
    default: return 'Other';
  }
}

function getDeviceTypeColor(type?: string | null): string {
  switch (type) {
    case 'phone': return 'text-blue-500';
    case 'laptop': return 'text-purple-500';
    case 'tablet': return 'text-orange-500';
    case 'watch': return 'text-primary';
    case 'tv': return 'text-rose-500';
    default: return 'text-gray-500';
  }
}

function getDeviceTypeBg(type?: string | null): string {
  switch (type) {
    case 'phone': return 'bg-blue-50 dark:bg-blue-950/30';
    case 'laptop': return 'bg-purple-50 dark:bg-purple-950/30';
    case 'tablet': return 'bg-orange-50 dark:bg-orange-950/30';
    case 'watch': return 'bg-primary/10 dark:bg-primary/10';
    case 'tv': return 'bg-rose-50 dark:bg-rose-950/30';
    default: return 'bg-gray-50 dark:bg-gray-950/30';
  }
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function WiFiDeviceManagement() {
  const { toast } = useToast();

  // Data state
  const [devices, setDevices] = useState<WiFiDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DeviceStats>({
    totalDevices: 0,
    activeGuests: 0,
    autoAuthEnabled: 0,
    avgDevicesPerGuest: 0,
  });

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');

  // Expanded row
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Guest group expansion state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Dialog state
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<WiFiDevice | null>(null);

  // Settings state
  const [maxDevices, setMaxDevices] = useState(5);
  const [defaultAutoAuth, setDefaultAutoAuth] = useState(true);
  const [autoCleanupDays, setAutoCleanupDays] = useState(30);
  const [savingDeviceSettings, setSavingDeviceSettings] = useState(false);

  // Form state
  const [registerForm, setRegisterForm] = useState({
    guestId: '',
    macAddress: '',
    deviceName: '',
    deviceType: 'phone',
    ipAddress: '',
    propertyId: '',
  });

  const [editForm, setEditForm] = useState({
    deviceName: '',
    deviceType: '',
    isApproved: true,
    autoAuth: true,
    ipAddress: '',
  });

  // Available properties (deduplicated from device list)
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);

  // ─── Fetch Device Settings on Mount ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/wifi/devices/settings');
        const data = await res.json();
        if (data.success) {
          const s = data.data;
          if (s.maxDevicesPerGuest !== undefined) setMaxDevices(s.maxDevicesPerGuest);
          if (s.defaultAutoAuth !== undefined) setDefaultAutoAuth(s.defaultAutoAuth);
          if (s.autoCleanupDays !== undefined) setAutoCleanupDays(s.autoCleanupDays);
        }
      } catch {
        // use defaults on failure
      }
    })();
  }, []);

  // ─── Save Device Settings ──────────────────────────────────────────────────
  const handleSaveDeviceSettings = async () => {
    try {
      setSavingDeviceSettings(true);
      const res = await fetch('/api/wifi/devices/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxDevicesPerGuest: maxDevices,
          defaultAutoAuth,
          autoCleanupDays,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Settings Saved', description: 'Device management settings updated.' });
      } else {
        toast({ title: 'Save Failed', description: data.error || 'Failed to save settings', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSavingDeviceSettings(false);
    }
  };

  // ─── Fetch Devices ──────────────────────────────────────────────────────────

  // Inline fetch logic inside the effect to avoid lint rule about setState in effects.
  // The async callback satisfies the rule because setState calls happen inside the
  // async .then() micro-task, not synchronously in the effect body.
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set('search', searchQuery);
        if (deviceTypeFilter !== 'all') params.set('deviceType', deviceTypeFilter);
        if (statusFilter !== 'all') params.set('isApproved', statusFilter);
        if (propertyFilter !== 'all') params.set('propertyId', propertyFilter);
        params.set('limit', '100');

        const res = await fetch(`/api/wifi/devices?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();

        if (cancelled) return;

        if (data.success && Array.isArray(data.data)) {
          setDevices(data.data);

          const guestIds = new Set(data.data.map((d: WiFiDevice) => d.guestId));
          const autoAuthCount = data.data.filter((d: WiFiDevice) => d.autoAuth).length;
          setStats({
            totalDevices: data.pagination?.total || data.data.length,
            activeGuests: guestIds.size,
            autoAuthEnabled: autoAuthCount,
            avgDevicesPerGuest: guestIds.size > 0
              ? Math.round((data.pagination?.total || data.data.length) / guestIds.size * 10) / 10
              : 0,
          });

          const uniqueProps = new Map<string, { id: string; name: string }>();
          data.data.forEach((d: WiFiDevice) => {
            if (d.property) {
              uniqueProps.set(d.property.id, d.property);
            }
          });
          setProperties(Array.from(uniqueProps.values()));
        } else {
          setDevices([]);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        // AbortError is expected on cleanup — silently ignore it
        if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) return;
        console.error('Failed to fetch devices:', error);
        toast({ title: 'Error', description: 'Failed to fetch devices', variant: 'destructive' });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; if (!controller.signal.aborted) controller.abort('Component cleanup'); };
  }, [searchQuery, deviceTypeFilter, statusFilter, propertyFilter, fetchKey, toast]);

  // Trigger a manual refresh (bump fetchKey to re-run the effect)
  const fetchDevices = useCallback(() => {
    setFetchKey(k => k + 1);
  }, []);

  // ─── Build Guest Groups (derived from devices — no effect needed) ─────────

  const guestGroups = useMemo(() => {
    const groupMap = new Map<string, GuestDeviceGroup>();
    devices.forEach(device => {
      if (!groupMap.has(device.guestId)) {
        groupMap.set(device.guestId, {
          guestId: device.guestId,
          guestName: `${device.guest.firstName} ${device.guest.lastName}`,
          guestEmail: device.guest.email,
          devices: [],
          deviceCount: 0,
        });
      }
      const group = groupMap.get(device.guestId)!;
      group.devices.push(device);
      group.deviceCount = group.devices.length;
    });
    return Array.from(groupMap.values()).sort((a, b) => b.deviceCount - a.deviceCount);
  }, [devices]);

  // ─── Toggle Auto-Auth ───────────────────────────────────────────────────────

  const handleToggleAutoAuth = async (device: WiFiDevice) => {
    try {
      const res = await fetch(`/api/wifi/devices/${device.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoAuth: !device.autoAuth }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Updated',
          description: `Auto-auth ${device.autoAuth ? 'disabled' : 'enabled'} for ${device.deviceName || device.macAddress}`,
        });
        fetchDevices();
      } else {
        toast({ title: 'Error', description: data.error || 'Update failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update auto-auth', variant: 'destructive' });
    }
  };

  // ─── Toggle Approval ────────────────────────────────────────────────────────

  const handleToggleApproval = async (device: WiFiDevice) => {
    try {
      const res = await fetch(`/api/wifi/devices/${device.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved: !device.isApproved }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Updated',
          description: `Device ${device.isApproved ? 'revoked' : 'approved'}`,
        });
        fetchDevices();
      } else {
        toast({ title: 'Error', description: data.error || 'Update failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update device status', variant: 'destructive' });
    }
  };

  // ─── Register Device ────────────────────────────────────────────────────────

  const handleRegister = async () => {
    if (!registerForm.guestId || !registerForm.macAddress) {
      toast({ title: 'Error', description: 'Guest ID and MAC address are required', variant: 'destructive' });
      return;
    }

    const cleaned = registerForm.macAddress.replace(/[^0-9a-fA-F]/g, '');
    if (cleaned.length !== 12) {
      toast({ title: 'Error', description: 'Invalid MAC address format (expected 12 hex digits)', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        guestId: registerForm.guestId,
        macAddress: registerForm.macAddress,
        deviceName: registerForm.deviceName || undefined,
        deviceType: registerForm.deviceType || undefined,
        ipAddress: registerForm.ipAddress || undefined,
        propertyId: registerForm.propertyId || undefined,
      };

      const res = await fetch('/api/wifi/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Success', description: data.message || 'Device registered successfully' });
        setRegisterDialogOpen(false);
        setRegisterForm({ guestId: '', macAddress: '', deviceName: '', deviceType: 'phone', ipAddress: '', propertyId: '' });
        fetchDevices();
      } else {
        toast({ title: 'Error', description: data.error || 'Registration failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to register device', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Edit Device ────────────────────────────────────────────────────────────

  const openEdit = (device: WiFiDevice) => {
    setSelectedDevice(device);
    setEditForm({
      deviceName: device.deviceName || '',
      deviceType: device.deviceType || 'other',
      isApproved: device.isApproved,
      autoAuth: device.autoAuth,
      ipAddress: device.ipAddress || '',
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedDevice) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/wifi/devices/${selectedDevice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Success', description: 'Device updated successfully' });
        setEditDialogOpen(false);
        setSelectedDevice(null);
        fetchDevices();
      } else {
        toast({ title: 'Error', description: data.error || 'Update failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update device', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete Device ──────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!selectedDevice) return;
    try {
      const res = await fetch(`/api/wifi/devices/${selectedDevice.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Success', description: 'Device removed successfully' });
        setDeleteDialogOpen(false);
        setSelectedDevice(null);
        fetchDevices();
      } else {
        toast({ title: 'Error', description: data.error || 'Delete failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete device', variant: 'destructive' });
    }
  };

  // ─── Toggle Group Expansion ─────────────────────────────────────────────────

  const toggleGroup = (guestId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(guestId)) {
        next.delete(guestId);
      } else {
        next.add(guestId);
      }
      return next;
    });
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Multi-Device Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage guest device registrations, auto-authentication, and multi-device policies
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDevices}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setRegisterDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Register Device
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/5 dark:bg-primary/10 p-2.5">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.totalDevices}</p>
              <p className="text-xs text-muted-foreground">Total Devices</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/5 dark:bg-primary/10 p-2.5">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.activeGuests}</p>
              <p className="text-xs text-muted-foreground">Active Guests</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2.5">
              <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.autoAuthEnabled}</p>
              <p className="text-xs text-muted-foreground">Auto-Auth Enabled</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 p-2.5">
              <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.avgDevicesPerGuest}</p>
              <p className="text-xs text-muted-foreground">Avg Devices/Guest</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="devices" className="w-full">
        <TabsList>
          <TabsTrigger value="devices" className="gap-1.5">
            <Smartphone className="h-4 w-4" />
            Device Registry
          </TabsTrigger>
          <TabsTrigger value="guests" className="gap-1.5">
            <Users className="h-4 w-4" />
            Guest Groups
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* ─── Device Registry Tab ─────────────────────────────────────────── */}
        <TabsContent value="devices" className="space-y-4">
          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by guest name, MAC, or device name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={deviceTypeFilter} onValueChange={setDeviceTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Device Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="laptop">Laptop</SelectItem>
                    <SelectItem value="tablet">Tablet</SelectItem>
                    <SelectItem value="watch">Watch</SelectItem>
                    <SelectItem value="tv">TV</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="true">Approved</SelectItem>
                    <SelectItem value="false">Revoked</SelectItem>
                  </SelectContent>
                </Select>
                {properties.length > 0 && (
                  <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue placeholder="Property" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      {properties.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Device Table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : devices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-muted/50 p-4 mb-3">
                    <Smartphone className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {searchQuery || deviceTypeFilter !== 'all' || statusFilter !== 'all'
                      ? 'No matching devices'
                      : 'No registered devices'}
                  </h3>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {searchQuery || deviceTypeFilter !== 'all' || statusFilter !== 'all'
                      ? 'Try adjusting your search or filters'
                      : 'Register a device to get started'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Guest Name</TableHead>
                        <TableHead className="w-[150px]">MAC Address</TableHead>
                        <TableHead className="hidden md:table-cell">Device Name</TableHead>
                        <TableHead className="w-[100px]">Type</TableHead>
                        <TableHead className="hidden lg:table-cell">Property</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="w-[100px]">Auto-Auth</TableHead>
                        <TableHead className="hidden xl:table-cell w-[100px]">First Seen</TableHead>
                        <TableHead className="hidden lg:table-cell w-[100px]">Last Seen</TableHead>
                        <TableHead className="text-right w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {devices.map((device) => (
                        <React.Fragment key={device.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedRowId(expandedRowId === device.id ? null : device.id)}
                          >
                            <TableCell>
                              <p className="text-sm font-medium">
                                {device.guest.firstName} {device.guest.lastName}
                              </p>
                              {device.guest.email && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[160px]">
                                  {device.guest.email}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs">{device.macAddress}</span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-sm text-muted-foreground truncate block max-w-[150px]">
                                {device.deviceName || '—'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <div className={`rounded-md p-1 ${getDeviceTypeBg(device.deviceType)}`}>
                                  <DeviceTypeIcon type={device.deviceType} className={`h-3.5 w-3.5 ${getDeviceTypeColor(device.deviceType)}`} />
                                </div>
                                <span className="text-xs">{getDeviceTypeLabel(device.deviceType)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <span className="text-xs text-muted-foreground">
                                {device.property?.name || '—'}
                              </span>
                            </TableCell>
                            <TableCell>
                              {device.isApproved ? (
                                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Approved
                                </Badge>
                              ) : (
                                <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs gap-1">
                                  <XCircle className="h-3 w-3" />
                                  Revoked
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={device.autoAuth}
                                onCheckedChange={() => handleToggleAutoAuth(device)}
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </TableCell>
                            <TableCell className="hidden xl:table-cell">
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(device.firstSeen), { addSuffix: true })}
                              </span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-0.5">
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); openEdit(device); }}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => { e.stopPropagation(); handleToggleApproval(device); }}
                                >
                                  {device.isApproved ? (
                                    <Ban className="h-3.5 w-3.5 text-amber-500" />
                                  ) : (
                                    <CheckCircle className="h-3.5 w-3.5 text-primary" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => { e.stopPropagation(); setSelectedDevice(device); setDeleteDialogOpen(true); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {/* Expanded Row Details */}
                          {expandedRowId === device.id && (
                            <TableRow>
                              <TableCell colSpan={10} className="bg-muted/30 px-6 py-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <span className="text-muted-foreground block">MAC Address</span>
                                    <span className="font-mono font-medium">{device.macAddress}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block">IP Address</span>
                                    <span className="font-mono">{device.ipAddress || 'Not available'}</span>
                                  </div>
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground block">User Agent</span>
                                    <span className="break-all leading-relaxed">{device.userAgent || 'Not available'}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block">First Seen</span>
                                    <span>{format(new Date(device.firstSeen), 'PPp')}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block">Last Seen</span>
                                    <span>{format(new Date(device.lastSeen), 'PPp')}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block">Registered</span>
                                    <span>{format(new Date(device.createdAt), 'PPp')}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block">Property</span>
                                    <span>{device.property?.name || 'None assigned'}</span>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Guest Groups Tab ─────────────────────────────────────────────── */}
        <TabsContent value="guests" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : guestGroups.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted/50 p-4 mb-3">
                  <Users className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">No guest devices registered</h3>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Registered devices will appear grouped by guest here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {guestGroups.map((group) => (
                <Collapsible
                  key={group.guestId}
                  open={expandedGroups.has(group.guestId)}
                  onOpenChange={() => toggleGroup(group.guestId)}
                >
                  <Card className="border-0 shadow-sm">
                    <CollapsibleTrigger className="w-full">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-gradient-to-br from-primary to-primary/70 p-2 text-white font-bold text-xs">
                            {group.guestName.charAt(0)}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium">{group.guestName}</p>
                            {group.guestEmail && (
                              <p className="text-[10px] text-muted-foreground">{group.guestEmail}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-xs font-medium">
                                {group.deviceCount} devices
                              </Badge>
                              <span className={`text-xs font-medium ${group.deviceCount >= maxDevices ? 'text-red-500' : 'text-muted-foreground'}`}>
                                Max: {group.deviceCount}/{maxDevices}
                              </span>
                            </div>
                            {group.deviceCount >= maxDevices && (
                              <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-0.5">
                                <AlertTriangle className="h-3 w-3" />
                                Device limit reached
                              </p>
                            )}
                          </div>
                          <div className="text-muted-foreground">
                            {expandedGroups.has(group.guestId) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4">
                        <Separator className="mb-3" />
                        <div className="grid gap-2">
                          {group.devices.map((device) => (
                            <div
                              key={device.id}
                              className="flex items-center justify-between rounded-lg border bg-background p-3 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`rounded-md p-1.5 ${getDeviceTypeBg(device.deviceType)}`}>
                                  <DeviceTypeIcon type={device.deviceType} className={`h-4 w-4 ${getDeviceTypeColor(device.deviceType)}`} />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{device.deviceName || getDeviceTypeLabel(device.deviceType)}</p>
                                  <p className="text-[10px] text-muted-foreground font-mono">{device.macAddress}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {device.isApproved ? (
                                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px]">
                                    Approved
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-[10px]">
                                    Revoked
                                  </Badge>
                                )}
                                <Switch
                                  checked={device.autoAuth}
                                  onCheckedChange={() => handleToggleAutoAuth(device)}
                                  size="sm"
                                />
                                <span className="text-[10px] text-muted-foreground hidden sm:inline w-20 text-right">
                                  {formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}
                                </span>
                                <div className="flex gap-0.5">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(device)}>
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => { setSelectedDevice(device); setDeleteDialogOpen(true); }}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Settings Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="settings" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                Device Registration Policy
              </CardTitle>
              <CardDescription>
                Configure global settings for multi-device registration and auto-authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Max Devices Per Guest */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Max Devices Per Guest</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={maxDevices}
                      onChange={(e) => setMaxDevices(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                      className="w-20 text-center text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Maximum number of devices each guest can register. Default is 5.
                </p>
                {/* Visual progress indicators for device limits */}
                <div className="space-y-2">
                  {guestGroups.filter(g => g.deviceCount > 0).slice(0, 5).map((group) => {
                    const pct = Math.min(100, (group.deviceCount / maxDevices) * 100);
                    return (
                      <div key={group.guestId} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-32 truncate">{group.guestName}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums w-10 text-right">
                          {group.deviceCount}/{maxDevices}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Default Auto-Auth Behavior */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    {defaultAutoAuth ? (
                      <ToggleRight className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Label className="text-sm font-medium">Default Auto-Auth Behavior</Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    When enabled, newly registered devices will automatically authenticate on reconnect
                  </p>
                </div>
                <Switch
                  checked={defaultAutoAuth}
                  onCheckedChange={setDefaultAutoAuth}
                />
              </div>

              <Separator />

              {/* Auto-Cleanup Inactive Devices */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Auto-Cleanup Inactive Devices</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Automatically remove devices that haven&apos;t been seen within the threshold
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={autoCleanupDays}
                    onChange={(e) => setAutoCleanupDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 30)))}
                    className="w-24 text-center text-sm"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  {devices.filter(d => {
                    const daysSince = (Date.now() - new Date(d.lastSeen).getTime()) / (1000 * 60 * 60 * 24);
                    return daysSince > autoCleanupDays;
                  }).length} devices would be cleaned up with current threshold
                </div>
              </div>

              {/* Save Settings Button */}
              <Button
                className="w-full"
                onClick={handleSaveDeviceSettings}
                disabled={savingDeviceSettings}
              >
                {savingDeviceSettings ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {savingDeviceSettings ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>

          {/* Auto-Auth Legend */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Auto-Authentication Flow
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-primary/10 p-1">
                      <Smartphone className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-xs font-medium">1. Device Connects</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Guest device connects to WiFi. Captive portal captures the MAC address.
                  </p>
                </div>
                <div className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-blue-500/10 p-1">
                      <Search className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <span className="text-xs font-medium">2. MAC Lookup</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    System checks if the MAC is registered, approved, and has auto-auth enabled.
                  </p>
                </div>
                <div className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-purple-500/10 p-1">
                      <Zap className="h-3.5 w-3.5 text-purple-500" />
                    </div>
                    <span className="text-xs font-medium">3. Auto-Authenticate</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    If eligible, the device is silently authenticated without showing the captive portal.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Register Device Dialog ───────────────────────────────────────────── */}
      <Dialog open={registerDialogOpen} onOpenChange={(open) => {
        if (!open) setRegisterForm({ guestId: '', macAddress: '', deviceName: '', deviceType: 'phone', ipAddress: '', propertyId: '' });
        setRegisterDialogOpen(open);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register New Device</DialogTitle>
            <DialogDescription>
              Add a new device for a guest. The device will be auto-approved and enrolled in auto-authentication.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Guest ID *</Label>
              <Input
                value={registerForm.guestId}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, guestId: e.target.value }))}
                placeholder="Enter guest UUID"
              />
            </div>
            <div className="space-y-2">
              <Label>MAC Address *</Label>
              <Input
                value={registerForm.macAddress}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, macAddress: e.target.value.toUpperCase() }))}
                placeholder="AA:BB:CC:DD:EE:FF"
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Device Name</Label>
                <Input
                  value={registerForm.deviceName}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, deviceName: e.target.value }))}
                  placeholder="e.g. John's iPhone"
                />
              </div>
              <div className="space-y-2">
                <Label>Device Type</Label>
                <Select value={registerForm.deviceType} onValueChange={(v) => setRegisterForm(prev => ({ ...prev, deviceType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="laptop">Laptop</SelectItem>
                    <SelectItem value="tablet">Tablet</SelectItem>
                    <SelectItem value="watch">Watch</SelectItem>
                    <SelectItem value="tv">TV</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>IP Address</Label>
                <Input
                  value={registerForm.ipAddress}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, ipAddress: e.target.value }))}
                  placeholder="192.168.1.x"
                />
              </div>
              {properties.length > 0 && (
                <div className="space-y-2">
                  <Label>Property</Label>
                  <Select value={registerForm.propertyId} onValueChange={(v) => setRegisterForm(prev => ({ ...prev, propertyId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              Device will be auto-approved and auto-authentication will be enabled by default.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRegister} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Register Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Device Dialog ───────────────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        if (!open) setSelectedDevice(null);
        setEditDialogOpen(open);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
            <DialogDescription>
              Update device information, approval status, and auto-auth settings.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Device Name</Label>
              <Input
                value={editForm.deviceName}
                onChange={(e) => setEditForm(prev => ({ ...prev, deviceName: e.target.value }))}
                placeholder="e.g. John's iPhone"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Device Type</Label>
                <Select value={editForm.deviceType} onValueChange={(v) => setEditForm(prev => ({ ...prev, deviceType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="laptop">Laptop</SelectItem>
                    <SelectItem value="tablet">Tablet</SelectItem>
                    <SelectItem value="watch">Watch</SelectItem>
                    <SelectItem value="tv">TV</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>IP Address</Label>
                <Input
                  value={editForm.ipAddress}
                  onChange={(e) => setEditForm(prev => ({ ...prev, ipAddress: e.target.value }))}
                  placeholder="192.168.1.x"
                />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Approved</Label>
                <p className="text-xs text-muted-foreground">Device is authorized to access the network</p>
              </div>
              <Switch
                checked={editForm.isApproved}
                onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isApproved: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Auto-Authenticate</Label>
                <p className="text-xs text-muted-foreground">Device will bypass captive portal on reconnect</p>
              </div>
              <Switch
                checked={editForm.autoAuth}
                onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, autoAuth: checked }))}
              />
            </div>
            {selectedDevice && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1">
                <p><span className="font-medium">MAC:</span> <span className="font-mono">{selectedDevice.macAddress}</span></p>
                <p><span className="font-medium">Guest:</span> {selectedDevice.guest.firstName} {selectedDevice.guest.lastName}</p>
                <p><span className="font-medium">Registered:</span> {format(new Date(selectedDevice.createdAt), 'PPp')}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ──────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!open) setSelectedDevice(null);
        setDeleteDialogOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Device</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedDevice && (
                <>
                  This will remove <span className="font-medium">{selectedDevice.deviceName || selectedDevice.macAddress}</span>
                  {' '}from <span className="font-medium">{selectedDevice.guest.firstName} {selectedDevice.guest.lastName}</span>.
                  The device will no longer be able to auto-authenticate and will need to re-register.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove Device
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
