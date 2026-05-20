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
  Users,
  Plus,
  Trash2,
  Edit,
  Loader2,
  Eye,
  EyeOff,
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

export default function RadiusUsersTab() {
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
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const originalSessionTimeout = useRef<number | undefined>(undefined);
  const [form, setForm] = useState({
    username: '',
    password: '',
    userType: 'guest' as 'guest' | 'staff' | 'admin' | 'service',
    planId: '',
    ipPoolId: 'none',
    group: 'standard-guests',
    downloadSpeed: 10,
    uploadSpeed: 5,
    sessionTimeout: 1440,
    dataLimit: 0, // 0 = unlimited
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

  // ─── Form Helpers ──────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({ username: '', password: '', userType: 'guest', planId: '', ipPoolId: 'none', group: 'standard-guests', downloadSpeed: 10, uploadSpeed: 5, sessionTimeout: 1440, dataLimit: 0 });
    setEditingUser(null);
  };

  // When a plan is selected, auto-fill bandwidth, timeout, and data limit
  const handlePlanSelect = (planId: string) => {
    const plan = wifiPlans.find(p => p.id === planId);
    if (plan) {
      const groupName = plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'standard-guests';
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
      password: user.password || '',
      userType: (user.userType as 'guest' | 'staff' | 'admin' | 'service') || 'guest',
      group: user.group || 'standard-guests',
      downloadSpeed: downSpeed,
      uploadSpeed: upSpeed,
      sessionTimeout: sessionMins,
      dataLimit: dataLimitVal,
      planId: matchedPlan?.id || '',
      ipPoolId: user.ipPoolId || 'none',
    });
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

  // Resolve the user object for the delete dialog
  const deleteUser = deleteUserId ? users.find(u => u.id === deleteUserId) : null;
  const isDeleteUserActive = deleteUser?.status === 'active';

  const handleDelete = async () => {
    if (!deleteUserId) return;
    try {
      const body: Record<string, unknown> = { action: 'delete-user', id: deleteUserId };
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
          description: `${data.details.username} is currently active. Deactivate the user first, or enable "Force Delete" to proceed.`,
          variant: 'destructive',
        });
        return; // keep dialog open so user can enable force
      }

      if (!res.ok) {
        toast({ title: 'Error', description: data.error || `Delete failed (${res.status})`, variant: 'destructive' });
        return;
      }

      if (data.success) {
        toast({ title: 'Success', description: 'User deleted successfully' });
        fetchUsers();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to delete user', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' });
    } finally {
      setDeleteUserId(null);
      setForceDelete(false);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Strip the 'plan_' prefix that the backend prepends to RADIUS group names */
  const stripPlanPrefix = (group: string) => group.replace(/^plan_/, '');

  // ─── Filtering ────────────────────────────────────────────────────────────

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

  // ─── Display Helpers ──────────────────────────────────────────────────────

  // ─── CSV Export ─────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    const exportData = filteredUsers.length > 0 ? filteredUsers : users;
    if (exportData.length === 0) {
      toast({ title: 'No data', description: 'No users to export', variant: 'destructive' });
      return;
    }
    const headers = ['Username', 'Password', 'User Type', 'Group', 'Download (Mbps)', 'Upload (Mbps)', 'Session Timeout (min)', 'Data Limit (MB)', 'Valid Until', 'Status', 'Created'];
    const rows = exportData.map(u => [
      u.username,
      u.password,
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
    const csvContent = [headers, ...rows].map(row => row.map(cell => {
      const str = String(cell);
      // Escape CSV: wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')).join('\n');
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
      const group = (row['Group'] || row['group'] || 'standard-guests').trim();
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

    toast({
      title: `Import complete: ${created} created`,
      description: errors.length > 0 ? `${errors.length} errors — check details` : 'All users imported successfully',
      variant: errors.length > 0 ? 'destructive' : 'default',
    });
    if (errors.length > 0) {
      console.warn('CSV Import Errors:', errors);
    }
  };

  // ─── Display Helpers ──────────────────────────────────────────────────────

  const getGroupBadge = (group: string) => {
    // Strip 'plan_' prefix for matching (backend stores groups as plan_xxx)
    const cleanGroup = stripPlanPrefix(group);
    const matchingPlan = wifiPlans.find(p => {
      const groupName = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      return groupName === cleanGroup || groupName === group;
    });
    if (matchingPlan) {
      const downMbps = matchingPlan.downloadSpeed;
      if (downMbps >= 100) return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0">{matchingPlan.name}</Badge>;
      if (downMbps >= 50) return <Badge className="bg-violet-500 hover:bg-violet-600 text-white border-0">{matchingPlan.name}</Badge>;
      if (downMbps >= 20) return <Badge className="bg-sky-500 hover:bg-sky-600 text-white border-0">{matchingPlan.name}</Badge>;
      return <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">{matchingPlan.name}</Badge>;
    }
    // No matching plan — display cleaned-up name (without plan_ prefix, title-cased)
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
      case 'revoked': return <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs">Revoked</Badge>;
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
                  const groupName = plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'standard-guests';
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
                <SelectItem value="expired">⚪ Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
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
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Bandwidth</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Data Cap</TableHead>
                    <TableHead>FUP Policy</TableHead>
                    <TableHead>IP Pool</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const validity = getUserValidityDisplay(user);
                    const typeLabel = getUserTypeLabel(user);
                    return (
                      <TableRow key={user.id}>
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
                          {getUserStatusBadge(user) || <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{getGroupBadge(user.group || 'standard-guests')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs">
                              {visiblePasswords.has(user.id) ? user.password : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(user.id)}
                              className="text-muted-foreground hover:text-foreground p-0.5"
                            >
                              {visiblePasswords.has(user.id)
                                ? <EyeOff className="h-3 w-3" />
                                : <Eye className="h-3 w-3" />}
                            </button>
                          </div>
                        </TableCell>
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
        </CardContent>
      </Card>

      {/* Add/Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
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
      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => { if (!open) { setDeleteUserId(null); setForceDelete(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete RADIUS User</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>
                This will permanently delete <span className="font-semibold">{deleteUser?.username}</span> from the RADIUS server. They will no longer be able to authenticate to WiFi.
              </span>
              {isDeleteUserActive && (
                <span className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="text-sm">
                    This user is currently <span className="font-semibold">active</span>. Deactivating or suspending is recommended instead of deletion. Enable "Force Delete" below to override this safety check.
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
                Force Delete (bypass active user protection)
              </label>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={forceDelete ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
            >
              {forceDelete ? 'Force Delete' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                    <TableCell className="text-xs">{row['Group'] || row['group'] || 'standard-guests'}</TableCell>
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
    </div>
  );
}
