'use client';

/**
 * RADIUS Users Tab — Manual user management for WiFi Access page.
 *
 * Provides CRUD for RADIUS users (stored in FreeRADIUS native SQL schema:
 * radcheck, radreply, radusergroup tables via freeradius-service).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Plus,
  Trash2,
  Edit,
  Loader2,
  RefreshCw,
  UserCircle,
  Wifi,
  Clock,
  ArrowDownToLine,
  Shield,
  CalendarDays,
  Gauge,
  ArrowUpDown,
  Download,
  Upload,
  FileSpreadsheet,
  Network,
  Ban,
  UserX,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  CheckSquare,
  Square,
  X,
  ChevronDown,
  UserCog,
  Monitor,
  Smartphone,
  Tablet,
  Star,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TwoFactorSetupModal } from '@/components/auth/two-factor-setup-modal';
import { csvSafeEscape } from '@/lib/wifi/validation';
import { formatDistanceToNow } from 'date-fns';
import {
  readBandwidthMbps,
  readDataLimitMB,
  getBandwidthDisplay,
  getDataLimitDisplay,
  getSessionTimeoutDisplay,
  getValidityDisplay,
} from '@/lib/wifi/utils/attribute-readers';
/**
 * Browser-compatible CSV parser — replaces csv-parse/sync which is Node.js-only.
 * Handles quoted fields, escaped quotes, and standard CSV formatting.
 */
function parseCSV(text: string, options?: { columns?: boolean; skip_empty_lines?: boolean; trim?: boolean }): Record<string, string>[] {
  const opts = { columns: false, skip_empty_lines: true, trim: true, ...options };
  const lines = text.split(/\r?\n/);
  const rows: string[][] = [];

  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (const line of lines) {
    let i = 0;
    // If not in a quoted multiline field, start fresh
    if (!inQuotes) {
      currentRow = [];
      currentField = '';
    }

    while (i < line.length) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            currentField += '"';
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          currentField += ch;
          i++;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i++;
        } else if (ch === ',') {
          currentRow.push(opts.trim ? currentField.trim() : currentField);
          currentField = '';
          i++;
        } else {
          currentField += ch;
          i++;
        }
      }
    }

    // End of line
    if (inQuotes) {
      // Multiline quoted field — add newline and continue to next line
      currentField += '\n';
    } else {
      currentRow.push(opts.trim ? currentField.trim() : currentField);
      if (opts.skip_empty_lines && currentRow.every(f => f === '')) {
        // skip empty line
      } else {
        rows.push(currentRow);
      }
    }
  }

  if (!opts.columns) return rows.map(r => {
    const obj: Record<string, string> = {};
    r.forEach((v, i) => obj[i.toString()] = v);
    return obj;
  });

  // Use first row as headers
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface FupPolicyInfo {
  id: string;
  name: string;
  cycleType: string;
  dataLimitMb: number;
  dataLimitUnit: string;
  applicableOn: string;
}

interface RadiusUser {
  id: string;
  username: string;
  password: string;
  group: string;
  attributes?: Record<string, string>;
  downloadSpeed?: number;
  uploadSpeed?: number;
  sessionTimeout?: number;
  dataLimit?: number;
  createdAt?: string;
  updatedAt?: string;
  guestId?: string;
  bookingId?: string;
  userType?: string;
  status?: string;
  validUntil?: string;
  fupPolicy?: FupPolicyInfo | null;
  ipPoolId?: string;
  ipPoolName?: string;
  ipPoolSource?: string;
  totalBytesIn?: number;
  totalBytesOut?: number;
  // Enriched fields from v_wifi_users view
  guest_first_name?: string;
  guest_last_name?: string;
  room_number?: string;
  property_name?: string;
  plan_name?: string;
  sessionCount?: number;
  deviceCount?: number;
  activeDeviceCount?: number;
}

interface UserDevice {
  id: string;
  macAddress: string;
  deviceName: string | null;
  deviceType: string | null;
  ipAddress: string | null;
  isPrimary: boolean;
  isActive: boolean;
  source: string;
  firstSeen: string | null;
  lastSeen: string | null;
}

interface WiFiPlan {
  id: string;
  name: string;
  description: string | null;
  downloadSpeed: number;  // Mbps (stored as-is in DB)
  uploadSpeed: number;    // Mbps (stored as-is in DB)
  dataLimit: number | null; // MB (null = unlimited)
  sessionLimit: number | null;
  validityDays: number;
  price: number;
  status: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function RadiusUsersTab({ onUsersChanged }: { onUsersChanged?: () => void }) {
  const { toast } = useToast();

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const [users, setUsers] = useState<RadiusUser[]>([]);
  const [wifiPlans, setWifiPlans] = useState<WiFiPlan[]>([]);
  const [ipPools, setIpPools] = useState<Array<{ id: string; name: string; isDefault: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [userTypeFilter, setUserTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<Record<string, string>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<RadiusUser | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  // Status change dialog state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDialogData, setStatusDialogData] = useState<{ user: RadiusUser; newStatus: 'active' | 'suspended' | 'deactivated' } | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusChanging, setStatusChanging] = useState(false);

  // Reset quota & reactivate dialog state
  const [resetQuotaUser, setResetQuotaUser] = useState<RadiusUser | null>(null);
  const [resetQuotaChanging, setResetQuotaChanging] = useState(false);
  const originalSessionTimeout = useRef<number | undefined>(undefined);
  const [guestInfoOpen, setGuestInfoOpen] = useState(false);

  // Device management dialog state
  const [devicesDialogOpen, setDevicesDialogOpen] = useState(false);
  const [devicesUser, setDevicesUser] = useState<RadiusUser | null>(null);
  const [userDevices, setUserDevices] = useState<UserDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [addingDevice, setAddingDevice] = useState(false);
  const [newMacInput, setNewMacInput] = useState('');
  const [newDeviceNameInput, setNewDeviceNameInput] = useState('');
  const [newDeviceTypeInput, setNewDeviceTypeInput] = useState('unknown');

  const [form, setForm] = useState({
    username: '',
    password: '',
    userType: 'guest' as 'guest' | 'staff' | 'admin' | 'service',
    planId: '',
    ipPoolId: 'none',
    group: '',
    downloadSpeed: 10,
    uploadSpeed: 5,
    sessionTimeout: 1440,
    dataLimit: 0, // 0 = unlimited
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    roomNumber: '',
  });

  // ─── Fetch Users & Plans ────────────────────────────────────────────────

  const fetchPlans = useCallback(async () => {
    try {
      const [planRes, poolRes] = await Promise.all([
        fetch('/api/wifi/plans?status=active'),
        fetch('/api/wifi/ip-pools'),
      ]);
      const data = await planRes.json();
      if (data.success && data.data) {
        setWifiPlans(Array.isArray(data.data) ? data.data : []);
      }
      if (poolRes.ok) {
        const poolData = await poolRes.json();
        if (poolData.success && poolData.data) {
          setIpPools(poolData.data.map((p: { id: string; name: string; isDefault: boolean }) => ({
            id: p.id,
            name: `${p.name}${p.isDefault ? ' (default)' : ''}`
          })));
        }
      }
    } catch (error) {
      console.error('Failed to fetch WiFi plans:', error);
      toast({ title: 'Error', description: 'Failed to fetch WiFi plans', variant: 'destructive' });
    }
  }, [toast]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/wifi/radius?action=users');
      const data = await res.json();
      if (data.success && data.data) {
        setUsers(Array.isArray(data.data) ? data.data : []);
      }
    } catch (error) {
      console.error('Failed to fetch RADIUS users:', error);
      toast({ title: 'Error', description: 'Failed to fetch RADIUS users', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchPlans();
  }, [fetchUsers, fetchPlans]);

  // ─── Device Management Functions ──────────────────────────────────────────────
  const getDeviceTypeIcon = (type: string | null) => {
    switch (type) {
      case 'phone': return <Smartphone className="h-3.5 w-3.5" />;
      case 'tablet': return <Tablet className="h-3.5 w-3.5" />;
      case 'laptop': case 'desktop': return <Monitor className="h-3.5 w-3.5" />;
      default: return <Monitor className="h-3.5 w-3.5 text-muted-foreground/60" />;
    }
  };

  const getDeviceTypeBadge = (type: string | null) => {
    switch (type) {
      case 'phone': return <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Phone</Badge>;
      case 'tablet': return <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Tablet</Badge>;
      case 'laptop': return <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Laptop</Badge>;
      case 'desktop': return <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Desktop</Badge>;
      case 'iot': return <Badge variant="secondary" className="text-[9px] px-1.5 py-0">IoT</Badge>;
      default: return <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">Unknown</Badge>;
    }
  };

  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      pms_credentials: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      room_number: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      voucher: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      mac_whitelist: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      admin: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      open_access: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
      login: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    };
    const label = source.replace(/_/g, ' ');
    return (
      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${colors[source] || 'bg-muted text-muted-foreground'}`}>
        {label}
      </span>
    );
  };

  const openDevicesDialog = async (user: RadiusUser) => {
    setDevicesUser(user);
    setDevicesDialogOpen(true);
    setNewMacInput('');
    setNewDeviceNameInput('');
    setNewDeviceTypeInput('unknown');
    setDevicesLoading(true);
    try {
      const res = await fetch(`/api/wifi/users/${user.id}/devices`);
      const data = await res.json();
      if (data.success) {
        setUserDevices(data.data || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load devices', variant: 'destructive' });
    } finally {
      setDevicesLoading(false);
    }
  };

  const toggleDeviceActive = async (device: UserDevice) => {
    try {
      const res = await fetch(`/api/wifi/users/${devicesUser?.id}/devices`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device.id, isActive: !device.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        setUserDevices(prev => prev.map(d => d.id === device.id ? { ...d, isActive: !d.isActive } : d));
        toast({ title: 'Device updated', description: `${device.macAddress} ${!device.isActive ? 'activated' : 'deactivated'}` });
        fetchUsers(); // Refresh device counts
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update device', variant: 'destructive' });
    }
  };

  const setDevicePrimary = async (device: UserDevice) => {
    try {
      const res = await fetch(`/api/wifi/users/${devicesUser?.id}/devices`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device.id, isPrimary: true }),
      });
      const data = await res.json();
      if (data.success) {
        setUserDevices(prev => prev.map(d => ({ ...d, isPrimary: d.id === device.id })));
        toast({ title: 'Primary device set', description: device.macAddress });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to set primary device', variant: 'destructive' });
    }
  };

  const removeDevice = async (device: UserDevice) => {
    try {
      const res = await fetch(`/api/wifi/users/${devicesUser?.id}/devices?deviceId=${device.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setUserDevices(prev => prev.filter(d => d.id !== device.id));
        toast({ title: 'Device removed', description: device.macAddress });
        fetchUsers();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to remove device', variant: 'destructive' });
    }
  };

  const addDevice = async () => {
    if (!newMacInput.trim()) return;
    setAddingDevice(true);
    try {
      const res = await fetch(`/api/wifi/users/${devicesUser?.id}/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macAddress: newMacInput, deviceName: newDeviceNameInput || undefined, deviceType: newDeviceTypeInput || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: data.message || 'Device added', description: newMacInput });
        setNewMacInput('');
        setNewDeviceNameInput('');
        setNewDeviceTypeInput('unknown');
        // Reload devices
        openDevicesDialog(devicesUser!);
      } else {
        toast({ title: 'Error', description: data.error?.message || 'Failed to add device', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add device', variant: 'destructive' });
    } finally {
      setAddingDevice(false);
    }
  };

  // ─── Form Helpers ──────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({ username: '', password: '', userType: 'guest', planId: '', ipPoolId: 'none', group: '', downloadSpeed: 10, uploadSpeed: 5, sessionTimeout: 1440, dataLimit: 0, firstName: '', lastName: '', email: '', phone: '', roomNumber: '' });
    setEditingUser(null);
    setGuestInfoOpen(false);
  };

  // When a plan is selected, auto-fill bandwidth, timeout, and data limit
  const handlePlanSelect = (planId: string) => {
    const plan = wifiPlans.find(p => p.id === planId);
    if (plan) {
      const groupName = plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || '';
      setForm(prev => ({
        ...prev,
        planId: plan.id,
        group: groupName,
        downloadSpeed: plan.downloadSpeed,
        uploadSpeed: plan.uploadSpeed,
        sessionTimeout: (plan.validityMinutes || plan.validityDays * 1440),
        dataLimit: plan.dataLimit || 0,
      }));
    } else {
      setForm(prev => ({ ...prev, planId: '' }));
    }
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (user: RadiusUser) => {
    setEditingUser(user);
    // Parse bandwidth from attributes (vendor-agnostic — checks ALL known vendor attrs)
    const { downloadMbps: attrDown, uploadMbps: attrUp } = readBandwidthMbps(user.attributes);
    // Fallback to stored fields when vendor attrs are missing (user created via UI)
    const downSpeed = attrDown || user.downloadSpeed || 0;
    const upSpeed = attrUp || user.uploadSpeed || 0;

    // Parse data limit from attributes (vendor-agnostic — checks ALL known data-limit attrs)
    let dataLimitVal = readDataLimitMB(user.attributes) || 0;
    if (dataLimitVal <= 0 && user.dataLimit && user.dataLimit > 0) {
      dataLimitVal = user.dataLimit;
    }

    // Match user group to a plan for pre-selection (handle both plan_xxx and xxx formats)
    const userGroup = (user.group || '').toLowerCase();
    const cleanUserGroup = stripPlanPrefix(userGroup);
    const matchedPlan = wifiPlans.find(p => {
      const groupName = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      return groupName === cleanUserGroup || groupName === userGroup;
    });

    const sessionMins = getSessionMinutes(user);
    originalSessionTimeout.current = sessionMins;

    setForm({
      username: user.username,
      password: '', // Never load existing password; use "Change Password" flow
      userType: (user.userType as 'guest' | 'staff' | 'admin' | 'service') || 'guest',
      group: user.group || '',
      downloadSpeed: downSpeed,
      uploadSpeed: upSpeed,
      sessionTimeout: sessionMins,
      dataLimit: dataLimitVal,
      planId: matchedPlan?.id || '',
      ipPoolId: user.ipPoolId || 'none',
      firstName: user.guestName || '',
      lastName: '',
      email: '',
      phone: '',
      roomNumber: '',
    });
    setGuestInfoOpen(!!user.guestName);
    setDialogOpen(true);
  };

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.username.trim()) {
      toast({ title: 'Error', description: 'Username is required', variant: 'destructive' });
      return;
    }
    if (!editingUser && !form.password.trim()) {
      toast({ title: 'Error', description: 'Password is required for new users', variant: 'destructive' });
      return;
    }

    setSavingUser(true);
    try {
      const action = editingUser ? 'update-user' : 'create-user';
      // validUntil = account expiry (plan validity, managed by backend).
      // sessionTimeout = per-session limit (how long each WiFi login lasts).
      // For NEW users, backend computes validUntil from the plan's validityMinutes.
      // For EDITING, preserve existing validUnless sessionTimeout was changed.
      let validUntil: string | undefined;
      if (editingUser) {
        if (form.sessionTimeout !== originalSessionTimeout.current) {
          validUntil = new Date(Date.now() + form.sessionTimeout * 60 * 1000).toISOString();
        } else {
          validUntil = editingUser.validUntil || new Date(Date.now() + form.sessionTimeout * 60 * 1000).toISOString();
        }
      }
      // For create-user, omit validUntil — backend derives it from plan validity.
      const body = editingUser
        ? { id: editingUser.id, ...form, validUntil }
        : (({ validUntil: _, ...rest }) => rest)({ ...form, validUntil });

      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        toast({ title: 'Error', description: `Request failed (${res.status}): ${errText}`, variant: 'destructive' });
        return;
      }
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Success', description: `User ${editingUser ? 'updated' : 'created'} successfully` });
        setDialogOpen(false);
        resetForm();
        fetchUsers();
        onUsersChanged?.();
      } else {
        toast({ title: 'Error', description: data.error || `Failed to ${editingUser ? 'update' : 'create'} user`, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: `Failed to ${editingUser ? 'update' : 'create'} user`, variant: 'destructive' });
    } finally {
      setSavingUser(false);
    }
  };

  const openStatusDialog = (user: RadiusUser, newStatus: 'active' | 'suspended' | 'deactivated') => {
    setStatusDialogData({ user, newStatus });
    setStatusReason('');
    setStatusDialogOpen(true);
  };

  const handleStatusChangeConfirm = async () => {
    if (!statusDialogData) return;
    const { user, newStatus } = statusDialogData;
    const actionLabel = newStatus === 'active' ? 'Activate' : newStatus === 'suspended' ? 'Suspend' : 'Deactivate';

    setStatusChanging(true);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change-user-status',
          id: user.id,
          status: newStatus,
          reason: statusReason.trim() || `Manual ${actionLabel.toLowerCase()} by staff`,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        toast({ title: 'Error', description: `${actionLabel} failed (${res.status}): ${errText}`, variant: 'destructive' });
        return;
      }

      const data = await res.json();
      if (data.success) {
        toast({ title: 'Status Changed', description: `${user.username}: ${data.message || `${actionLabel}d successfully`}` });
        setStatusDialogOpen(false);
        fetchUsers();
        onUsersChanged?.();
      } else {
        toast({ title: 'Error', description: data.error || `Failed to ${actionLabel.toLowerCase()} user`, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: `Failed to ${actionLabel.toLowerCase()} user`, variant: 'destructive' });
    } finally {
      setStatusChanging(false);
    }
  };

  const handleResetQuotaReactivate = async () => {
    if (!resetQuotaUser) return;
    setResetQuotaChanging(true);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset-quota-reactivate',
          id: resetQuotaUser.id,
          reason: `Quota reset by staff`,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        toast({ title: 'Error', description: `Reset quota failed (${res.status}): ${errText}`, variant: 'destructive' });
        return;
      }

      const data = await res.json();
      if (data.success) {
        toast({ title: 'Quota Reset', description: data.message || `${resetQuotaUser.username}: quota reset & reactivated` });
        setResetQuotaUser(null);
        fetchUsers();
        onUsersChanged?.();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to reset quota', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to reset quota', variant: 'destructive' });
    } finally {
      setResetQuotaChanging(false);
    }
  };

  const [forceDelete, setForceDelete] = useState(false);

  // Bulk selection & delete state
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkDeleteStep, setBulkDeleteStep] = useState<'warning' | 'mfa' | 'mfa-setup' | 'deleting' | null>(null);
  const [bulkForceDelete, setBulkForceDelete] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteResult, setBulkDeleteResult] = useState<{ deleted: number; skipped: number; errors: number } | null>(null);
  const [admin2FAEnabled, setAdmin2FAEnabled] = useState<boolean | null>(null);
  const [showInline2FASetup, setShowInline2FASetup] = useState(false);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [searchQuery, groupFilter, userTypeFilter, statusFilter]);

  // ─── Filtering (must be before selection logic) ────────────────────────────

  const filteredUsers = users.filter(u => {
    if (groupFilter !== 'all' && stripPlanPrefix(u.group || '') !== groupFilter && u.group !== groupFilter) return false;
    if (userTypeFilter !== 'all' && (u.userType || 'guest') !== userTypeFilter) return false;
    if (statusFilter !== 'all' && (u.status || 'active') !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return u.username.toLowerCase().includes(q) || (u.group || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Pagination
  const totalUsers = filteredUsers.length;
  const totalPagesUsers = Math.ceil(totalUsers / perPage);
  const startIdxUsers = (page - 1) * perPage;
  const endIdxUsers = startIdxUsers + perPage;
  const paginatedUsers = filteredUsers.slice(startIdxUsers, endIdxUsers);

  const allFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.has(u.id));
  const someFilteredSelected = filteredUsers.some(u => selectedUserIds.has(u.id)) && !allFilteredSelected;

  const toggleUserSelect = (id: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const clearSelection = () => {
    setSelectedUserIds(new Set());
  };

  const check2FAStatus = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/2fa/status');
      const data = await res.json();
      const enabled = data.success && data.enabled;
      setAdmin2FAEnabled(enabled);
      return enabled;
    } catch {
      setAdmin2FAEnabled(false);
      return false;
    }
  };

  const openBulkDelete = () => {
    setBulkForceDelete(false);
    setMfaCode('');
    setMfaError('');
    setBulkDeleteResult(null);
    setBulkDeleteStep('warning');
  };

  const closeBulkDelete = () => {
    setBulkDeleteStep(null);
    setMfaCode('');
    setMfaError('');
    setBulkForceDelete(false);
    setBulkDeleteResult(null);
  };

  const handleMfaVerify = async () => {
    if (!mfaCode.trim() || mfaCode.replace(/\s/g, '').length !== 6) {
      setMfaError('Please enter a valid 6-digit code');
      return;
    }
    setMfaVerifying(true);
    setMfaError('');
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaCode.replace(/\s/g, '') }),
      });
      const data = await res.json();
      if (data.success && data.verified) {
        setBulkDeleteStep('deleting');
        await executeBulkDelete(true);
      } else if (data.error && data.error.toLowerCase().includes('not set up')) {
        // Redirect to the 2FA setup prompt
        setBulkDeleteStep('mfa-setup');
      } else {
        setMfaError(data.error || 'Invalid verification code');
      }
    } catch {
      setMfaError('Verification failed. Please try again.');
    } finally {
      setMfaVerifying(false);
    }
  };

  const executeBulkDelete = async (mfaVerified: boolean) => {
    setBulkDeleting(true);
    try {
      const idsToDelete = Array.from(selectedUserIds);
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-delete-users',
          userIds: idsToDelete,
          force: bulkForceDelete,
          mfaVerified,
        }),
      });
      const data = await res.json();

      if (data.code === 'MFA_REQUIRED') {
        setBulkDeleteStep('mfa');
        return;
      }

      if (data.success) {
        setBulkDeleteResult({
          deleted: data.deleted || 0,
          skipped: (data.skipped || []).length,
          errors: (data.errors || []).length,
        });
        setSelectedUserIds(new Set());
        fetchUsers();
        onUsersChanged?.();
      } else {
        toast({ title: 'Error', description: data.error || 'Bulk delete failed', variant: 'destructive' });
        closeBulkDelete();
      }
    } catch {
      toast({ title: 'Error', description: 'Bulk delete request failed', variant: 'destructive' });
      closeBulkDelete();
    } finally {
      setBulkDeleting(false);
    }
  };

  // Resolve the user object for the delete dialog
  const deleteUser = deleteUserId ? users.find(u => u.id === deleteUserId) : null;
  const isDeleteUserActive = deleteUser?.status === 'active';

  // Single-user delete MFA state
  const [singleDeleteMfaStep, setSingleDeleteMfaStep] = useState<'confirm' | 'mfa' | 'mfa-setup' | 'deleting' | null>(null);
  const [singleDeleteMfaCode, setSingleDeleteMfaCode] = useState('');
  const [singleDeleteMfaError, setSingleDeleteMfaError] = useState('');
  const [singleDeleteMfaVerifying, setSingleDeleteMfaVerifying] = useState(false);

  const handleDeleteRequest = () => {
    // When user clicks Delete on the warning dialog, proceed to MFA flow
    // Keep deleteUserId set so deleteUser is available for the MFA dialogs
    setSingleDeleteMfaCode('');
    setSingleDeleteMfaError('');
    setSingleDeleteMfaStep('confirm');
  };

  const handleSingleDeleteProceedMfa = async () => {
    const has2FA = await check2FAStatus();
    setSingleDeleteMfaStep(has2FA ? 'mfa' : 'mfa-setup');
  };

  const handleSingleDeleteMfaVerify = async () => {
    if (!singleDeleteMfaCode.trim() || singleDeleteMfaCode.replace(/\s/g, '').length !== 6) {
      setSingleDeleteMfaError('Please enter a valid 6-digit code');
      return;
    }
    setSingleDeleteMfaVerifying(true);
    setSingleDeleteMfaError('');
    try {
      const verifyRes = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: singleDeleteMfaCode.replace(/\s/g, '') }),
      });
      const verifyData = await verifyRes.json();
      if (verifyData.success && verifyData.verified) {
        setSingleDeleteMfaStep('deleting');
        await executeSingleDelete();
      } else if (verifyData.error && verifyData.error.toLowerCase().includes('not set up')) {
        setSingleDeleteMfaStep('mfa-setup');
      } else {
        setSingleDeleteMfaError(verifyData.error || 'Invalid verification code');
      }
    } catch {
      setSingleDeleteMfaError('Verification failed. Please try again.');
    } finally {
      setSingleDeleteMfaVerifying(false);
    }
  };

  const executeSingleDelete = async () => {
    if (!deleteUserId) return;
    try {
      const body: Record<string, unknown> = { action: 'delete-user', id: deleteUserId, mfaVerified: true };
      if (forceDelete) body.force = true;

      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      // Handle active user blocked (409)
      if (!res.ok && data.code === 'ACTIVE_USER_BLOCKED') {
        toast({
          title: 'Active User Blocked',
          description: `${data.details?.username || 'User'} is currently active. Deactivate the user first, or enable "Force Delete" to proceed.`,
          variant: 'destructive',
        });
        return;
      }

      if (!res.ok) {
        toast({ title: 'Error', description: data.error || `Delete failed (${res.status})`, variant: 'destructive' });
        return;
      }

      if (data.success) {
        toast({ title: 'Success', description: 'User deleted successfully' });
        fetchUsers();
        onUsersChanged?.();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to delete user', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' });
    } finally {
      setDeleteUserId(null);
      setForceDelete(false);
      setSingleDeleteMfaStep(null);
    }
  };

  const closeSingleDeleteMfa = () => {
    setSingleDeleteMfaStep(null);
    setSingleDeleteMfaCode('');
    setSingleDeleteMfaError('');
  };

  /** Strip the 'plan_' prefix that the backend prepends to RADIUS group names */
  const stripPlanPrefix = (group: string) => group.replace(/^plan_/, '');

  // ─── Display Helpers ──────────────────────────────────────────────────────

  // ─── CSV Export ─────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    const exportData = filteredUsers.length > 0 ? filteredUsers : users;
    if (exportData.length === 0) {
      toast({ title: 'No data', description: 'No users to export', variant: 'destructive' });
      return;
    }
    const headers = ['Username', 'User Type', 'Group', 'Download (Mbps)', 'Upload (Mbps)', 'Session Timeout (min)', 'Data Limit (MB)', 'Valid Until', 'Status', 'Created'];
    const rows = exportData.map(u => [
      u.username,
      u.userType || 'guest',
      u.group || '',
      u.downloadSpeed ?? '',
      u.uploadSpeed ?? '',
      getSessionMinutes(u),
      u.dataLimit || 0,
      u.validUntil || '',
      u.status || 'active',
      u.createdAt || '',
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => csvSafeEscape(cell)).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `radius-users-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${exportData.length} users exported to CSV` });
  };

  // ─── CSV Import ─────────────────────────────────────────────────────────

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const records = parseCSV(text, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
        if (records.length === 0) {
          toast({ title: 'Error', description: 'CSV file is empty', variant: 'destructive' });
          return;
        }
        setImportPreview(records);
        setImportErrors([]);
        setImportDialogOpen(true);
      } catch (err) {
        toast({ title: 'Parse Error', description: 'Could not parse CSV file. Check the format.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    let created = 0;
    let errors: string[] = [];

    for (const row of importPreview) {
      const username = (row['Username'] || row['username'] || '').trim();
      const password = (row['Password'] || row['password'] || '').trim();
      if (!username || !password) {
        errors.push(`${username || '(no username)'}: missing username or password`);
        continue;
      }
      const userType = (row['User Type'] || row['user_type'] || row['userType'] || 'guest').trim().toLowerCase();
      const group = (row['Group'] || row['group'] || '').trim();
      const downloadSpeed = parseInt(row['Download (Mbps)'] || row['download_speed'] || row['downloadSpeed'] || '10') || 10;
      const uploadSpeed = parseInt(row['Upload (Mbps)'] || row['upload_speed'] || row['uploadSpeed'] || '5') || 5;
      const sessionTimeout = parseInt(row['Session Timeout (min)'] || row['session_timeout'] || row['sessionTimeout'] || '1440') || 1440;
      const dataLimit = parseInt(row['Data Limit (MB)'] || row['data_limit'] || row['dataLimit'] || '0') || 0;
      // Omit validUntil — backend derives it from plan validity (not sessionTimeout).

      try {
        const res = await fetch('/api/wifi/radius', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create-user', username, password, userType, group, downloadSpeed, uploadSpeed, sessionTimeout, dataLimit }),
        });
        const data = await res.json();
        if (data.success) {
          created++;
        } else {
          errors.push(`${username}: ${data.error || 'failed'}`);
        }
      } catch {
        errors.push(`${username}: network error`);
      }
    }

    setImporting(false);
    setImportDialogOpen(false);
    setImportPreview([]);
    fetchUsers();
    onUsersChanged?.();

    toast({
      title: `Import complete: ${created} created`,
      description: errors.length > 0 ? `${errors.length} errors — check details` : 'All users imported successfully',
      variant: errors.length > 0 ? 'destructive' : 'default',
    });
  };

  // ─── Display Helpers ──────────────────────────────────────────────────────

  const getGroupBadge = (group: string, fallbackPlanName?: string) => {
    // Strip 'plan_' prefix for matching (backend stores groups as plan_xxx)
    const cleanGroup = stripPlanPrefix(group);
    const matchingPlan = wifiPlans.find(p => {
      const groupName = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      // Generate the RADIUS group name with plan ID suffix (same as planNameToGroupName)
      const shortId = p.id.replace(/-/g, '').substring(0, 8);
      const groupWithId = `${groupName}_${shortId}`;
      return groupName === cleanGroup || groupName === group || groupWithId === cleanGroup || groupWithId === group;
    });
    if (matchingPlan) {
      const downMbps = matchingPlan.downloadSpeed;
      if (downMbps >= 100) return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0">{matchingPlan.name}</Badge>;
      if (downMbps >= 50) return <Badge className="bg-violet-500 hover:bg-violet-600 text-white border-0">{matchingPlan.name}</Badge>;
      if (downMbps >= 20) return <Badge className="bg-sky-500 hover:bg-sky-600 text-white border-0">{matchingPlan.name}</Badge>;
      return <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">{matchingPlan.name}</Badge>;
    }
    // Fallback: use plan_name from WiFiUser table (available even after RADIUS records are deleted on revoke)
    if (fallbackPlanName) {
      const fbPlan = wifiPlans.find(p => p.name === fallbackPlanName);
      if (fbPlan) {
        const downMbps = fbPlan.downloadSpeed;
        if (downMbps >= 100) return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0">{fbPlan.name}</Badge>;
        if (downMbps >= 50) return <Badge className="bg-violet-500 hover:bg-violet-600 text-white border-0">{fbPlan.name}</Badge>;
        if (downMbps >= 20) return <Badge className="bg-sky-500 hover:bg-sky-600 text-white border-0">{fbPlan.name}</Badge>;
        return <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">{fbPlan.name}</Badge>;
      }
      return <Badge variant="outline">{fallbackPlanName}</Badge>;
    }
    // No matching plan — display cleaned-up name (without plan_ prefix, title-cased)
    if (cleanGroup === 'none') return <Badge variant="outline" className="text-muted-foreground">No Plan</Badge>;
    const displayName = cleanGroup.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return <Badge variant="outline">{displayName}</Badge>;
  };

  const getUserBandwidthDisplay = (user: RadiusUser): string => {
    const display = getBandwidthDisplay(user.attributes);
    if (display !== 'N/A') return display;
    return `${user.downloadSpeed || 0}M/${user.uploadSpeed || 0}M`;
  };

  /** Session timeout in human-readable format (vendor-agnostic) */
  const getSessionDisplay = (user: RadiusUser): string => {
    return getSessionTimeoutDisplay(user.attributes?.['Session-Timeout'], user.sessionTimeout);
  };

  /** Raw minutes for the edit form */
  const getSessionMinutes = (user: RadiusUser): number => {
    const timeout = user.attributes?.['Session-Timeout'];
    if (timeout) return Math.round(Number(timeout) / 60);
    return user.sessionTimeout || 1440;
  };

  /** Data limit: "Unlimited", "5.0 GB", "500 MB" (vendor-agnostic) */
  const getDataLimit = (user: RadiusUser): string => {
    return getDataLimitDisplay(user.attributes, user.dataLimit);
  };

  /** Valid-until relative to now: "5d left", "< 1 day", "Expired" */
  const getUserValidityDisplay = (user: RadiusUser): { text: string; className: string } => {
    return getValidityDisplay(user.validUntil);
  };

  /** FUP Policy display: formatted data limit with cycle */
  const getFupPolicyDisplay = (user: RadiusUser) => {
    if (!user.fupPolicy) return null;
    const { dataLimitMb, dataLimitUnit, cycleType, applicableOn, name } = user.fupPolicy;
    const limitStr = dataLimitUnit === 'gb' ? `${dataLimitMb} GB` : (dataLimitMb >= 1024 ? `${(dataLimitMb / 1024).toFixed(1)} GB` : `${dataLimitMb} MB`);
    const cycleLabel = cycleType === 'daily' ? '/day' : cycleType === 'weekly' ? '/wk' : '/mo';
    const dirIcon = applicableOn === 'download' ? <ArrowDownToLine className="h-3 w-3" /> : applicableOn === 'upload' ? <ArrowUpDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />;
    return { name, limitStr, cycleLabel, dirIcon };
  };

  const getUserTypeLabel = (user: RadiusUser): string => {
    if (user.userType) {
      const labels: Record<string, string> = {
        guest: 'Guest',
        staff: 'Staff',
        admin: 'Admin',
        service: 'Service',
      };
      return labels[user.userType] || user.userType;
    }
    if (user.guestId && user.bookingId) return 'Guest';
    if (user.bookingId) return 'Booking';
    return 'Guest';
  };

  const getUserTypeBadgeColor = (user: RadiusUser): string => {
    switch (user.userType) {
      case 'staff': return 'bg-violet-500/10 text-violet-600 dark:text-violet-400';
      case 'admin': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'service': return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400';
      default: return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
    }
  };

  const getUserStatusBadge = (user: RadiusUser) => {
    switch (user.status) {
      case 'active': return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">Active</Badge>;
      case 'suspended': return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs">Suspended</Badge>;
      case 'deactivated': return <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs">Deactivated</Badge>;
      case 'revoked': return <Badge className="bg-rose-700 hover:bg-rose-800 text-white border-0 text-xs flex items-center gap-1"><Ban className="h-3 w-3" /> Revoked</Badge>;
      case 'expired': return <Badge className="bg-gray-500 hover:bg-gray-600 text-white border-0 text-xs">Expired</Badge>;
      default: return null;
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5" />
            RADIUS Users
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage WiFi authentication users and access credentials
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => document.getElementById('csv-import-input')?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <input
            id="csv-import-input"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportFileSelect}
          />
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Users className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{users.length}</div>
              <div className="text-xs text-muted-foreground">Total Users</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{users.filter(u => u.status === 'active').length}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Ban className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{users.filter(u => u.status === 'suspended' || u.status === 'deactivated').length}</div>
              <div className="text-xs text-muted-foreground">Suspended/Off</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <UserCircle className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{users.filter(u => u.guestId || u.bookingId).length}</div>
              <div className="text-xs text-muted-foreground">Guest Users</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Plans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                {wifiPlans.filter(p => p.status === 'active').map(plan => {
                  const groupName = plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || '';
                  return (
                    <SelectItem key={groupName} value={groupName}>{plan.name}</SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="guest">🧑‍💼 Guest</SelectItem>
                <SelectItem value="staff">👷 Staff</SelectItem>
                <SelectItem value="admin">🛡️ Admin</SelectItem>
                <SelectItem value="service">🔌 Service</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">🟢 Active</SelectItem>
                <SelectItem value="suspended">🟡 Suspended</SelectItem>
                <SelectItem value="deactivated">🔴 Deactivated</SelectItem>
                <SelectItem value="revoked">🚫 Revoked</SelectItem>
                <SelectItem value="expired">⚪ Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {/* Bulk Action Bar */}
          {selectedUserIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-b bg-destructive/5 dark:bg-destructive/10">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allFilteredSelected}
                  ref={(el) => {
                    if (el) {
                      (el as unknown as HTMLInputElement).dataset.state = someFilteredSelected ? 'indeterminate' : allFilteredSelected ? 'checked' : 'unchecked';
                    }
                  }}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all users"
                />
                <span className="text-sm font-medium">
                  {selectedUserIds.size} user{selectedUserIds.size !== 1 ? 's' : ''} selected
                  {selectedUserIds.size !== filteredUsers.length && filteredUsers.length > 0 && (
                    <button onClick={toggleSelectAll} className="ml-2 text-xs text-primary hover:underline">
                      Select all {filteredUsers.length}
                    </button>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
                <Button variant="destructive" size="sm" onClick={openBulkDelete}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete Selected
                </Button>
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Users className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">No RADIUS users found</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {searchQuery || groupFilter !== 'all' || userTypeFilter !== 'all'
                  ? 'Try clearing filters or search terms'
                  : 'Add a user manually or import from CSV'}
              </p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-auto">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px] pr-0">
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all users"
                      />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Guest Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Bandwidth</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Data Cap</TableHead>
                    <TableHead>FUP Policy</TableHead>
                    <TableHead>IP Pool</TableHead>
                    <TableHead>Devices</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => {
                    const validity = getUserValidityDisplay(user);
                    const typeLabel = getUserTypeLabel(user);
                    return (
                      <TableRow key={user.id} className={selectedUserIds.has(user.id) ? 'bg-destructive/5 dark:bg-destructive/10' : ''}>
                        <TableCell className="pr-0">
                          <Checkbox
                            checked={selectedUserIds.has(user.id)}
                            onCheckedChange={() => toggleUserSelect(user.id)}
                            aria-label={`Select ${user.username}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate max-w-[140px]" title={user.username}>{user.username}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getUserTypeBadgeColor(user)}`}>{typeLabel}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(user.guest_first_name || user.guest_last_name) ? (
                            <span className="text-xs text-muted-foreground">
                              {[user.guest_first_name, user.guest_last_name].filter(Boolean).join(' ')}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getUserStatusBadge(user) || <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{getGroupBadge(user.group || 'none', user.plan_name)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs font-mono">
                            <ArrowDownToLine className="h-3 w-3 text-primary" />
                            <span>{getUserBandwidthDisplay(user)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1 text-xs">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span>{getSessionDisplay(user)}</span>
                              <span className="text-[9px] text-muted-foreground/60">session</span>
                            </div>
                            {user.validUntil && (
                              <div className="flex items-center gap-1 text-[10px]">
                                <CalendarDays className="h-2.5 w-2.5 text-muted-foreground/60" />
                                <span className={validity.className}>{validity.text}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium">{getDataLimit(user)}</span>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const fup = getFupPolicyDisplay(user);
                            if (!fup) return <span className="text-xs text-muted-foreground">—</span>;
                            return (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1">
                                  <Gauge className="h-3 w-3 text-orange-500" />
                                  <span className="text-xs font-medium text-orange-600 dark:text-orange-400">{fup.name}</span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  {fup.dirIcon}
                                  <span>{fup.limitStr}{fup.cycleLabel}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {user.ipPoolName ? (
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                              <Network className="h-2.5 w-2.5 mr-0.5" />
                              {user.ipPoolName}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Inherit</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => openDevicesDialog(user)}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors hover:bg-primary/10',
                              (user.deviceCount || 0) > 0
                                ? 'text-primary cursor-pointer'
                                : 'text-muted-foreground cursor-pointer hover:text-primary'
                            )}
                          >
                            <Monitor className="h-3.5 w-3.5" />
                            <span>{(user.activeDeviceCount ?? 0)}/{user.deviceCount ?? 0}</span>
                          </button>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {user.status === 'active' ? (
                              <>
                                <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50" title="Suspend User" onClick={() => openStatusDialog(user, 'suspended')}>
                                  <Ban className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" title="Deactivate User" onClick={() => openStatusDialog(user, 'deactivated')}>
                                  <UserX className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 hover:bg-primary/5" title="Activate User" onClick={() => openStatusDialog(user, 'active')}>
                                <UserCheck className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Reset Quota & Reactivate" onClick={() => setResetQuotaUser(user)}>
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(user)} title="Edit User">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteUserId(user.id)} title="Delete User">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
          {totalPagesUsers > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Showing {startIdxUsers + 1}-{Math.min(endIdxUsers, totalUsers)} of {totalUsers}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                {Array.from({ length: totalPagesUsers }, (_, i) => i + 1).map(p => (
                  <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => setPage(p)} className="w-8 h-8">{p}</Button>
                ))}
                <Button variant="outline" size="sm" disabled={page >= totalPagesUsers} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit RADIUS User' : 'Add RADIUS User'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user credentials and bandwidth limits' : 'Create a new WiFi user for RADIUS authentication'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="guest101"
                  disabled={!!editingUser}
                />
              </div>
              <div className="space-y-2">
                <Label>{editingUser ? 'New Password (leave blank to keep)' : 'Password *'}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>User Type</Label>
              <Select value={form.userType} onValueChange={(value) => setForm(prev => ({ ...prev, userType: value as typeof prev.userType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="guest">
                    <span className="flex items-center gap-2">
                      <UserCircle className="h-3.5 w-3.5 text-blue-500" />
                      Guest — Hotel guest / visitor
                    </span>
                  </SelectItem>
                  <SelectItem value="staff">
                    <span className="flex items-center gap-2">
                      <UserCircle className="h-3.5 w-3.5 text-violet-500" />
                      Staff — Hotel employee
                    </span>
                  </SelectItem>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-2">
                      <UserCircle className="h-3.5 w-3.5 text-amber-500" />
                      Admin — System administrator
                    </span>
                  </SelectItem>
                  <SelectItem value="service">
                    <span className="flex items-center gap-2">
                      <UserCircle className="h-3.5 w-3.5 text-cyan-500" />
                      Service — IoT / device account
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Determines which bandwidth schedules apply to this user</p>
            </div>

            <div className="space-y-2">
              <Label>WiFi Plan</Label>
              <Select value={form.planId} onValueChange={handlePlanSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan (auto-fills settings)" />
                </SelectTrigger>
                <SelectContent>
                  {wifiPlans.filter(p => p.status === 'active').map(plan => {
                    const downMbps = plan.downloadSpeed;
                    const upMbps = plan.uploadSpeed;
                    const dataLabel = plan.dataLimit
                      ? (plan.dataLimit >= 1024 ? `${(plan.dataLimit / 1024).toFixed(1)} GB` : `${plan.dataLimit} MB`)
                      : 'Unlimited';
                    return (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} — {downMbps}/{upMbps} Mbps, {plan.validityDays}d, {dataLabel}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Selecting a plan auto-fills bandwidth, timeout, and data limit below</p>
            </div>

            <div className="space-y-2">
              <Label>IP Pool Override</Label>
              <Select value={form.ipPoolId} onValueChange={(v) => setForm(prev => ({ ...prev, ipPoolId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Inherit from Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Inherit from Plan</SelectItem>
                  {ipPools.map(pool => (
                    <SelectItem key={pool.id} value={pool.id}>{pool.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Override the plan&apos;s IP pool. User will only be allowed from this pool&apos;s IP ranges.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Download Speed (Mbps)</Label>
                <Input
                  type="number"
                  value={form.downloadSpeed}
                  onChange={(e) => setForm(prev => ({ ...prev, downloadSpeed: parseInt(e.target.value) || 10 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Upload Speed (Mbps)</Label>
                <Input
                  type="number"
                  value={form.uploadSpeed}
                  onChange={(e) => setForm(prev => ({ ...prev, uploadSpeed: parseInt(e.target.value) || 10 }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Session Timeout (minutes)</Label>
                <Input
                  type="number"
                  value={form.sessionTimeout}
                  onChange={(e) => setForm(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) || 1440 }))}
                />
                <p className="text-[10px] text-muted-foreground">{form.sessionTimeout >= 1440 ? `${(form.sessionTimeout / 1440).toFixed(1)} days` : `${Math.round(form.sessionTimeout / 60)} hours`}</p>
              </div>
              <div className="space-y-2">
                <Label>Data Limit (MB) <span className="text-muted-foreground font-normal">— 0 = unlimited</span></Label>
                <Input
                  type="number"
                  min={0}
                  value={form.dataLimit}
                  onChange={(e) => setForm(prev => ({ ...prev, dataLimit: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* ─── Guest Information (optional, collapsible) ─── */}
            <Collapsible open={guestInfoOpen} onOpenChange={setGuestInfoOpen}>
              <Separator className="my-1" />
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <UserCog className="h-4 w-4" />
                    Guest Information <span className="font-normal">(optional)</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 transition-transform duration-200',
                      guestInfoOpen && 'rotate-180'
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-1">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={form.firstName}
                      onChange={(e) => setForm(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={form.lastName}
                      onChange={(e) => setForm(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Smith"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="guest@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1 555 123 4567"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Room Number</Label>
                    <Input
                      value={form.roomNumber}
                      onChange={(e) => setForm(prev => ({ ...prev, roomNumber: e.target.value }))}
                      placeholder="301"
                      className="sm:max-w-[200px]"
                    />
                  </div>
                </div>
                {form.firstName && form.lastName && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Consent logs &amp; GDPR pages will show &quot;{form.firstName} {form.lastName}&quot; instead of &quot;Anonymous&quot;.
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={savingUser}>
              {savingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Confirmation Dialog */}
      <AlertDialog open={statusDialogOpen} onOpenChange={(open) => { if (!open) { setStatusDialogData(null); setStatusReason(''); } setStatusDialogOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {statusDialogData?.newStatus === 'suspended' && <Ban className="h-5 w-5 text-amber-500" />}
              {statusDialogData?.newStatus === 'deactivated' && <UserX className="h-5 w-5 text-red-500" />}
              {statusDialogData?.newStatus === 'active' && <UserCheck className="h-5 w-5 text-emerald-500" />}
              {statusDialogData?.newStatus === 'suspended' ? 'Suspend User' : statusDialogData?.newStatus === 'deactivated' ? 'Deactivate User' : 'Activate User'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusDialogData && (statusDialogData.newStatus === 'active'
                ? <span>Re-activate "{statusDialogData.user.username}" - they will be able to authenticate to WiFi again.</span>
                : statusDialogData.newStatus === 'suspended'
                ? <span>Suspend "{statusDialogData.user.username}" - their RADIUS credentials will be removed and they won&apos;t be able to log in until reactivated.</span>
                : <span>Deactivate "{statusDialogData.user.username}" - this will permanently remove their RADIUS credentials.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Reason (optional)</label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              placeholder="Enter reason for this status change..."
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value.slice(0, 500))}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{statusReason.length}/500</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStatusChangeConfirm}
              disabled={statusChanging}
              className={statusDialogData?.newStatus === 'suspended' ? 'bg-amber-500 hover:bg-amber-600 text-white' : statusDialogData?.newStatus === 'deactivated' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}
            >
              {statusChanging && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {statusDialogData?.newStatus === 'suspended' ? 'Suspend' : statusDialogData?.newStatus === 'deactivated' ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Quota & Reactivate Dialog */}
      <AlertDialog open={!!resetQuotaUser} onOpenChange={(open) => { if (!open) setResetQuotaUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-blue-500" />
              Reset Quota & Reactivate
            </AlertDialogTitle>
            <AlertDialogDescription>
              {resetQuotaUser && (
                <div className="space-y-3">
                  <p>Reset data usage for <strong>{resetQuotaUser.username}</strong> and reactivate their WiFi access.</p>
                  <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Status</span>
                      <span className={cn(
                        resetQuotaUser.status === 'active' ? 'text-emerald-600' :
                        resetQuotaUser.status === 'suspended' ? 'text-amber-600' : 'text-red-600'
                      )}>{resetQuotaUser.status || 'unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Download Used</span>
                      <span>{resetQuotaUser.totalBytesOut ? formatBytes(Number(resetQuotaUser.totalBytesOut)) : '0 B'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Upload Used</span>
                      <span>{resetQuotaUser.totalBytesIn ? formatBytes(Number(resetQuotaUser.totalBytesIn)) : '0 B'}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">This will: reset download/upload counters to 0, set status to active, re-enable RADIUS credentials, and clear any FUP throttle logs.</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetQuotaReactivate}
              disabled={resetQuotaChanging}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {resetQuotaChanging && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset & Reactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUserId && !singleDeleteMfaStep} onOpenChange={(open) => { if (!open) { setDeleteUserId(null); setForceDelete(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete RADIUS User
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span>
                This will permanently delete <span className="font-semibold">{deleteUser?.username}</span>. This action cannot be undone.
              </span>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                <p className="text-xs font-semibold text-destructive">All associated data will be deleted:</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-none">
                  <li>✕ RADIUS credentials (radcheck, radreply, radusergroup)</li>
                  <li>✕ Active session — disconnected immediately</li>
                  <li>✕ Session history (WiFiSession)</li>
                  <li>✕ Auth logs (radacct, radpostauth)</li>
                  <li>✕ Device profiles (DeviceProfile)</li>
                  <li>✕ WiFi user account</li>
                </ul>
              </div>
              {isDeleteUserActive && (
                <span className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="text-sm">
                    This user is currently <span className="font-semibold">active</span> with a live session. Enable "Force Delete" to disconnect and delete.
                  </span>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {isDeleteUserActive && (
            <div className="flex items-center gap-2 px-6 pb-4">
              <input
                id="force-delete-checkbox"
                type="checkbox"
                checked={forceDelete}
                onChange={(e) => setForceDelete(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-destructive focus:ring-destructive/50"
              />
              <label htmlFor="force-delete-checkbox" className="text-sm font-medium text-muted-foreground cursor-pointer">
                Force Delete (disconnect & delete active user)
              </label>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRequest}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <ShieldCheck className="h-4 w-4 mr-1" />
              {forceDelete ? 'Force Delete with MFA' : 'Delete with MFA'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single User Delete — MFA Confirmation & Verify */}
      <Dialog open={singleDeleteMfaStep === 'confirm'} onOpenChange={(open) => { if (!open) closeSingleDeleteMfa(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Deletion of {deleteUser?.username}
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. MFA verification will be required.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <p className="text-xs font-semibold text-destructive">All associated data will be deleted:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-none">
              <li>✕ RADIUS credentials</li>
              <li>✕ Active session — disconnected immediately</li>
              <li>✕ Session history & Auth logs</li>
              <li>✕ Device profiles & WiFi user account</li>
            </ul>
          </div>
          {isDeleteUserActive && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={forceDelete}
                onChange={(e) => setForceDelete(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-destructive focus:ring-destructive/50"
              />
              <span className="text-sm font-medium text-muted-foreground">Force Delete (disconnect & delete active user)</span>
            </label>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeSingleDeleteMfa}>Cancel</Button>
            <Button variant="destructive" onClick={handleSingleDeleteProceedMfa}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Proceed with MFA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single User Delete — MFA Not Set Up */}
      <Dialog open={singleDeleteMfaStep === 'mfa-setup'} onOpenChange={(open) => { if (!open) closeSingleDeleteMfa(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Shield className="h-5 w-5" />
              MFA Setup Required
            </DialogTitle>
            <DialogDescription>
              Multi-factor authentication must be enabled on your admin account before you can delete users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-950">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Your account does not have 2FA enabled
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    To protect against unauthorized deletions, all admin delete operations require MFA verification. Please set up 2FA on your account first.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
            <Button variant="outline" onClick={closeSingleDeleteMfa}>Cancel</Button>
            <Button onClick={() => setShowInline2FASetup(true)}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Set Up 2FA Now
            </Button>
            <Button variant="secondary" onClick={async () => {
              const has2FA = await check2FAStatus();
              if (has2FA) {
                setSingleDeleteMfaStep('mfa');
                toast({ title: '2FA Detected', description: 'You can now proceed with MFA verification' });
              } else {
                toast({ title: '2FA Not Found', description: 'Please set up 2FA first using the button above', variant: 'destructive' });
              }
            }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              I&apos;ve Enabled 2FA — Check Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single User Delete — MFA Verification */}
      <Dialog open={singleDeleteMfaStep === 'mfa'} onOpenChange={(open) => { if (!open) closeSingleDeleteMfa(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              MFA Verification Required
            </DialogTitle>
            <DialogDescription>
              Enter the 6-digit code from your authenticator app to confirm deletion of {deleteUser?.username}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="single-mfa-code">Authentication Code</Label>
              <Input
                id="single-mfa-code"
                placeholder="000000"
                value={singleDeleteMfaCode}
                onChange={(e) => { setSingleDeleteMfaCode(e.target.value); setSingleDeleteMfaError(''); }}
                maxLength={7}
                className="text-center text-2xl font-mono tracking-[0.5em] h-14"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSingleDeleteMfaVerify(); }}
              />
            </div>
            {singleDeleteMfaError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {singleDeleteMfaError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              This verifies your identity as an administrator before deleting the user.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSingleDeleteMfaStep('confirm')} disabled={singleDeleteMfaVerifying}>Back</Button>
            <Button variant="destructive" onClick={handleSingleDeleteMfaVerify} disabled={singleDeleteMfaVerifying || singleDeleteMfaCode.replace(/\s/g, '').length !== 6}>
              {singleDeleteMfaVerifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Verify & Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single User Delete — Deleting */}
      <Dialog open={singleDeleteMfaStep === 'deleting'} onOpenChange={(open) => { if (!open) closeSingleDeleteMfa(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Deleting User...
            </DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!open) { setImportPreview([]); setImportErrors([]); } setImportDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import CSV — Preview
            </DialogTitle>
            <DialogDescription>
              {importPreview.length} user{importPreview.length !== 1 ? 's' : ''} found in file. Review before importing.
              {' '}CSV format: Username, Password, User Type, Group, Download (Mbps), Upload (Mbps), Session Timeout (min), Data Limit (MB)
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto border rounded-lg">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Username</TableHead>
                  <TableHead className="text-xs">Password</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Group</TableHead>
                  <TableHead className="text-xs">Down</TableHead>
                  <TableHead className="text-xs">Up</TableHead>
                  <TableHead className="text-xs">Timeout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreview.slice(0, 50).map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-mono">{row['Username'] || row['username'] || '—'}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">••••••</TableCell>
                    <TableCell className="text-xs">{row['User Type'] || row['user_type'] || row['userType'] || 'guest'}</TableCell>
                    <TableCell className="text-xs">{row['Group'] || row['group'] || 'none'}</TableCell>
                    <TableCell className="text-xs">{row['Download (Mbps)'] || row['download_speed'] || '10'}</TableCell>
                    <TableCell className="text-xs">{row['Upload (Mbps)'] || row['upload_speed'] || '5'}</TableCell>
                    <TableCell className="text-xs">{row['Session Timeout (min)'] || row['session_timeout'] || '1440'}</TableCell>
                  </TableRow>
                ))}
                {importPreview.length > 50 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-xs text-center text-muted-foreground py-2">
                      ... and {importPreview.length - 50} more rows
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setImportPreview([]); setImportErrors([]); setImportDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleImportConfirm} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Upload className="h-4 w-4 mr-2" />
              Import {importPreview.length} User{importPreview.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Bulk Delete — Step 1: Warning Dialog */}
      <Dialog open={bulkDeleteStep === 'warning'} onOpenChange={(open) => { if (!open) closeBulkDelete(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete {selectedUserIds.size} User{selectedUserIds.size !== 1 ? 's' : ''}?
            </DialogTitle>
            <DialogDescription className="sr-only">
              Confirm bulk deletion of selected RADIUS users
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              You are about to permanently delete <span className="font-semibold text-foreground">{selectedUserIds.size} RADIUS user{selectedUserIds.size !== 1 ? 's' : ''}</span>. This action cannot be undone.
            </p>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-destructive">The following data will be permanently deleted for each user:</p>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-none">
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">✕</span>
                  <span><strong>RADIUS credentials</strong> — radcheck, radreply, radusergroup entries</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">✕</span>
                  <span><strong>All active sessions</strong> — Users will be disconnected immediately</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">✕</span>
                  <span><strong>Session history</strong> — All WiFiSession records</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">✕</span>
                  <span><strong>Auth logs</strong> — radacct accounting records & radpostauth entries</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">✕</span>
                  <span><strong>Device profiles</strong> — DeviceProfile fingerprints & auto-auth data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">✕</span>
                  <span><strong>WiFi user account</strong> — The user record itself</span>
                </li>
              </ul>
            </div>
            {filteredUsers.filter(u => selectedUserIds.has(u.id) && u.status === 'active').length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-600 dark:bg-amber-950">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {filteredUsers.filter(u => selectedUserIds.has(u.id) && u.status === 'active').length} active user{filteredUsers.filter(u => selectedUserIds.has(u.id) && u.status === 'active').length !== 1 ? 's' : ''} selected
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Active users have live WiFi sessions. Without force delete, they will be skipped.
                    </p>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bulkForceDelete}
                        onChange={(e) => setBulkForceDelete(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-destructive focus:ring-destructive/50"
                      />
                      <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Force Delete (disconnect & delete active users)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeBulkDelete}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              const has2FA = await check2FAStatus();
              setBulkDeleteStep(has2FA ? 'mfa' : 'mfa-setup');
            }}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Proceed with MFA Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete — Step 2a: MFA Not Set Up */}
      <Dialog open={bulkDeleteStep === 'mfa-setup'} onOpenChange={(open) => { if (!open) closeBulkDelete(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Shield className="h-5 w-5" />
              MFA Setup Required
            </DialogTitle>
            <DialogDescription>
              Multi-factor authentication must be enabled on your admin account before you can delete users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-950">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Your account does not have 2FA enabled
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    To protect against unauthorized deletions, all admin delete operations require MFA verification. Please set up 2FA on your account first.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
            <Button variant="outline" onClick={closeBulkDelete}>Cancel</Button>
            <Button onClick={() => setShowInline2FASetup(true)}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Set Up 2FA Now
            </Button>
            <Button variant="secondary" onClick={async () => {
              const has2FA = await check2FAStatus();
              if (has2FA) {
                setBulkDeleteStep('mfa');
                toast({ title: '2FA Detected', description: 'You can now proceed with MFA verification' });
              } else {
                toast({ title: '2FA Not Found', description: 'Please set up 2FA first using the button above', variant: 'destructive' });
              }
            }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              I&apos;ve Enabled 2FA — Check Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete — Step 2b: MFA Verification */}
      <Dialog open={bulkDeleteStep === 'mfa'} onOpenChange={(open) => { if (!open) closeBulkDelete(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              MFA Verification Required
            </DialogTitle>
            <DialogDescription>
              Enter the 6-digit code from your authenticator app to confirm deletion of {selectedUserIds.size} user{selectedUserIds.size !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Authentication Code</Label>
              <Input
                id="mfa-code"
                placeholder="000000"
                value={mfaCode}
                onChange={(e) => { setMfaCode(e.target.value); setMfaError(''); }}
                maxLength={7}
                className="text-center text-2xl font-mono tracking-[0.5em] h-14"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleMfaVerify(); }}
              />
            </div>
            {mfaError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {mfaError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              This verifies your identity as an administrator before performing the bulk delete operation.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBulkDeleteStep('warning')} disabled={mfaVerifying}>Back</Button>
            <Button variant="destructive" onClick={handleMfaVerify} disabled={mfaVerifying || mfaCode.replace(/\s/g, '').length !== 6}>
              {mfaVerifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Verify & Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete — Step 3: In-progress / Result */}
      <Dialog open={bulkDeleteStep === 'deleting' || !!bulkDeleteResult} onOpenChange={(open) => { if (!open) closeBulkDelete(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bulkDeleting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Deleting Users...
                </>
              ) : bulkDeleteResult ? (
                <>
                  {bulkDeleteResult.errors > 0 ? (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  )}
                  Bulk Delete Complete
                </>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              {bulkDeleting
                ? `Processing ${selectedUserIds.size} user deletions...`
                : undefined}
            </DialogDescription>
          </DialogHeader>
          {bulkDeleteResult && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950 p-3">
                  <div className="text-2xl font-bold text-emerald-600">{bulkDeleteResult.deleted}</div>
                  <div className="text-xs text-emerald-600/70">Deleted</div>
                </div>
                <div className="rounded-lg border bg-amber-50 dark:bg-amber-950 p-3">
                  <div className="text-2xl font-bold text-amber-600">{bulkDeleteResult.skipped}</div>
                  <div className="text-xs text-amber-600/70">Skipped</div>
                </div>
                <div className="rounded-lg border bg-red-50 dark:bg-red-950 p-3">
                  <div className="text-2xl font-bold text-red-600">{bulkDeleteResult.errors}</div>
                  <div className="text-xs text-red-600/70">Errors</div>
                </div>
              </div>
              {bulkDeleteResult.skipped > 0 && (
                <p className="text-xs text-muted-foreground">
                  Skipped users were active and force delete was not enabled.
                </p>
              )}
            </div>
          )}
          {bulkDeleteResult && (
            <DialogFooter>
              <Button onClick={closeBulkDelete}>Done</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Inline 2FA Setup Modal — accessible from MFA setup dialogs */}
      <TwoFactorSetupModal
        open={showInline2FASetup}
        onOpenChange={setShowInline2FASetup}
        onSuccess={async () => {
          setShowInline2FASetup(false);
          setAdmin2FAEnabled(true);
          // Auto-transition to MFA verification step after setup
          if (singleDeleteMfaStep === 'mfa-setup') {
            setSingleDeleteMfaStep('mfa');
          }
          if (bulkDeleteStep === 'mfa-setup') {
            setBulkDeleteStep('mfa');
          }
          toast({ title: '2FA Enabled', description: 'You can now proceed with MFA verification' });
        }}
      />

      {/* Device Management Dialog */}
      <Dialog open={devicesDialogOpen} onOpenChange={(open) => { setDevicesDialogOpen(open); if (!open) setUserDevices([]); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              Registered Devices
              {devicesUser && (
                <span className="text-sm font-normal text-muted-foreground">
                  — {devicesUser.username}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Manage MAC devices registered for this user. Active devices can authenticate; inactive devices are blocked.
            </DialogDescription>
          </DialogHeader>

          {devicesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add Device Form */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <p className="text-sm font-medium mb-3">Register New Device</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="MAC Address (e.g. AA:BB:CC:DD:EE:FF)"
                    value={newMacInput}
                    onChange={(e) => setNewMacInput(e.target.value.toUpperCase())}
                    className="font-mono text-sm flex-1"
                  />
                  <Input
                    placeholder="Device Name (optional)"
                    value={newDeviceNameInput}
                    onChange={(e) => setNewDeviceNameInput(e.target.value)}
                    className="text-sm sm:w-48"
                  />
                  <select
                    value={newDeviceTypeInput}
                    onChange={(e) => setNewDeviceTypeInput(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="phone">Phone</option>
                    <option value="tablet">Tablet</option>
                    <option value="laptop">Laptop</option>
                    <option value="desktop">Desktop</option>
                    <option value="iot">IoT</option>
                  </select>
                  <Button
                    size="sm"
                    onClick={addDevice}
                    disabled={addingDevice || !newMacInput.trim()}
                  >
                    {addingDevice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Add
                  </Button>
                </div>
              </div>

              {/* Device List */}
              {userDevices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Monitor className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No devices registered for this user</p>
                  <p className="text-xs mt-1">Devices will be captured automatically when the user logs in</p>
                </div>
              ) : (
                <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                  {userDevices.map((device) => (
                    <div key={device.id} className={cn(
                      'flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors',
                      !device.isActive && 'opacity-50'
                    )}>
                      <div className="shrink-0">{getDeviceTypeIcon(device.deviceType)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium truncate" title={device.macAddress}>{device.macAddress}</span>
                          {device.isPrimary && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" title="Primary device" />}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {getDeviceTypeBadge(device.deviceType)}
                          {getSourceBadge(device.source)}
                          {device.isActive ? (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Inactive</Badge>
                          )}
                        </div>
                        {device.ipAddress && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">IP: {device.ipAddress} · Last seen: {device.lastSeen ? formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true }) : 'never'}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className={device.isActive ? 'text-green-600 hover:text-green-700 hover:bg-green-50' : 'text-muted-foreground hover:text-green-600 hover:bg-green-50'} onClick={() => toggleDeviceActive(device)} title={device.isActive ? 'Deactivate device' : 'Activate device'}>
                          {device.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                        {!device.isPrimary && device.isActive && (
                          <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={() => setDevicePrimary(device)} title="Set as primary device">
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/80 hover:bg-destructive/10" onClick={() => removeDevice(device)} title="Remove device">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {userDevices.length > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Total: {userDevices.length} devices</span>
                  <span>Active: {userDevices.filter(d => d.isActive).length} · Inactive: {userDevices.filter(d => !d.isActive).length}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
