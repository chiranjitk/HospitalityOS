'use client';

/**
 * MAC Auth Component
 *
 * MAC address whitelist management for automatic device authentication.
 * Supports add/edit/delete, check MAC, import/export.
 * Direct DB access via /api/wifi/mac-auth (no freeradius-service proxy).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
  Monitor,
  Plus,
  Trash2,
  Edit,
  Loader2,
  RefreshCw,
  Search,
  Download,
  Upload,
  CheckCircle,
  XCircle,
  Shield,
  Eye,
  Fingerprint,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface WiFiPlan {
  id: string;
  name: string;
  downloadSpeed?: number;
  uploadSpeed?: number;
  validityDays?: number;
  validityMinutes?: number;
  dataLimitMB?: number;
  status: string;
}

interface MacAuthEntry {
  id: string;
  macAddress: string;
  username?: string | null;
  guestName?: string | null;
  description?: string | null;
  autoLogin: boolean;
  validFrom?: string;
  validUntil?: string | null;
  lastSeenAt?: string | null;
  status: string;
  bandwidthDown?: number | null;
  bandwidthUp?: number | null;
  sessionTimeout?: number | null;
  dataLimitMB?: number | null;
  groupName?: string | null;
  planId?: string | null;
  loginCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────────

interface MacAuthProps {
  propertyId?: string;
}

export default function MacAuth({ propertyId }: MacAuthProps) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<MacAuthEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MacAuthEntry | null>(null);
  const [savingEntry, setSavingEntry] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);

  // Import dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  // Check MAC state
  const [checkMacInput, setCheckMacInput] = useState('');
  const [checkMacResult, setCheckMacResult] = useState<{ found: boolean; entry?: MacAuthEntry } | null>(null);
  const [checkingMac, setCheckingMac] = useState(false);

  // Plans
  const [plans, setPlans] = useState<WiFiPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  // Form
  const [form, setForm] = useState({
    macAddress: '',
    username: '',
    guestName: '',
    description: '',
    autoLogin: true,
    validFrom: '',
    validUntil: '',
    bandwidthDown: '',
    bandwidthUp: '',
    sessionTimeout: '',
    dataLimitMB: '',
    groupName: '',
  });

  // ─── Fetch Entries ──────────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (propertyId) params.set('propertyId', propertyId);
      if (activeStatusFilter !== 'all') params.set('status', activeStatusFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/wifi/mac-auth?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setEntries(data.data);
      } else {
        setEntries([]);
      }
    } catch (error) {
      console.error('Failed to fetch MAC auth entries:', error);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeStatusFilter, searchQuery, propertyId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ─── Fetch Plans ────────────────────────────────────────────────────────────

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/wifi/plans?status=active');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPlans(data.data);
      }
    } catch {
      // plans are optional
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  // ─── Plan Change Handler ────────────────────────────────────────────────────

  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);
    if (!planId) {
      setForm(prev => ({ ...prev, bandwidthDown: '', bandwidthUp: '', sessionTimeout: '', dataLimitMB: '', groupName: '', validUntil: '' }));
      return;
    }
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      const minutes = plan.validityMinutes || (plan.validityDays ? plan.validityDays * 1440 : 0);
      const validUntil = minutes
        ? new Date(Date.now() + minutes * 60 * 1000).toISOString().split('T')[0]
        : '';
      const sessionTimeout = minutes ? String(minutes) : '';
      setForm(prev => ({
        ...prev,
        bandwidthDown: plan.downloadSpeed ? String(plan.downloadSpeed) : '',
        bandwidthUp: plan.uploadSpeed ? String(plan.uploadSpeed) : '',
        sessionTimeout,
        dataLimitMB: plan.dataLimitMB ? String(plan.dataLimitMB) : '',
        groupName: plan.name,
        validUntil: prev.validUntil || validUntil,
      }));
    }
  };

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({ macAddress: '', username: '', guestName: '', description: '', autoLogin: true, validFrom: '', validUntil: '', bandwidthDown: '', bandwidthUp: '', sessionTimeout: '', dataLimitMB: '', groupName: '' });
    setSelectedPlanId('');
    setEditingEntry(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (entry: MacAuthEntry) => {
    setEditingEntry(entry);
    setSelectedPlanId(entry.planId || '');
    setForm({
      macAddress: entry.macAddress,
      username: entry.username || '',
      guestName: entry.guestName || '',
      description: entry.description || '',
      autoLogin: entry.autoLogin,
      validFrom: entry.validFrom ? entry.validFrom.split('T')[0] : '',
      validUntil: entry.validUntil ? entry.validUntil.split('T')[0] : '',
      bandwidthDown: entry.bandwidthDown ? String(entry.bandwidthDown) : '',
      bandwidthUp: entry.bandwidthUp ? String(entry.bandwidthUp) : '',
      sessionTimeout: entry.sessionTimeout ? String(entry.sessionTimeout) : '',
      dataLimitMB: entry.dataLimitMB ? String(entry.dataLimitMB) : '',
      groupName: entry.groupName || '',
    });
    setDialogOpen(true);
  };

  // ─── CRUD Operations ────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.macAddress.trim()) {
      toast({ title: 'Error', description: 'MAC address is required', variant: 'destructive' });
      return;
    }

    // Basic MAC format validation
    const cleaned = form.macAddress.replace(/[^0-9a-fA-F]/g, '');
    if (cleaned.length !== 12) {
      toast({ title: 'Error', description: 'Invalid MAC address format', variant: 'destructive' });
      return;
    }

    setSavingEntry(true);
    try {
      const payload = {
        macAddress: form.macAddress,
        username: form.username || undefined,
        guestName: form.guestName || undefined,
        description: form.description || undefined,
        autoLogin: form.autoLogin,
        validFrom: form.validFrom || undefined,
        validUntil: form.validUntil || undefined,
        bandwidthDown: form.bandwidthDown || undefined,
        bandwidthUp: form.bandwidthUp || undefined,
        sessionTimeout: form.sessionTimeout || undefined,
        dataLimitMB: form.dataLimitMB || undefined,
        groupName: form.groupName || undefined,
        planId: selectedPlanId || undefined,
      };

      let res: Response;
      let action: string;

      if (editingEntry) {
        // Update
        res = await fetch('/api/wifi/mac-auth', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingEntry.id, ...payload }),
        });
        action = 'updated';
      } else {
        // Create
        res = await fetch('/api/wifi/mac-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, propertyId: propertyId || undefined }),
        });
        action = 'created';
      }

      const data = await res.json();

      if (data.success) {
        toast({ title: 'Success', description: `MAC entry ${action} successfully` });
        setDialogOpen(false);
        resetForm();
        fetchEntries();
      } else {
        toast({
          title: 'Error',
          description: data.error?.message || data.error || `Failed to ${action} entry`,
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: `Failed to save MAC entry`, variant: 'destructive' });
    } finally {
      setSavingEntry(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteEntryId) return;
    try {
      const deleteParams = new URLSearchParams();
      if (propertyId) deleteParams.set('propertyId', propertyId);
      deleteParams.set('id', deleteEntryId);
      const res = await fetch(`/api/wifi/mac-auth?${deleteParams.toString()}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Success', description: 'MAC entry deleted' });
        fetchEntries();
      } else {
        toast({ title: 'Error', description: data.error?.message || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeleteEntryId(null);
    }
  };

  // ─── Check MAC ──────────────────────────────────────────────────────────────

  const handleCheckMac = async () => {
    if (!checkMacInput.trim()) return;
    setCheckingMac(true);
    setCheckMacResult(null);
    try {
      const checkParams = new URLSearchParams();
      if (propertyId) checkParams.set('propertyId', propertyId);
      checkParams.set('check', checkMacInput.trim());
      const res = await fetch(`/api/wifi/mac-auth?${checkParams.toString()}`);
      const data = await res.json();
      setCheckMacResult({
        found: data.found && data.data ? true : false,
        entry: data.data || undefined,
      });
    } catch {
      setCheckMacResult({ found: false });
    } finally {
      setCheckingMac(false);
    }
  };

  // ─── Import / Export ────────────────────────────────────────────────────────

  const handleImport = async () => {
    const macs = importText.split('\n').map(m => m.trim()).filter(Boolean);
    if (macs.length === 0) {
      toast({ title: 'Error', description: 'No MAC addresses found in import', variant: 'destructive' });
      return;
    }
    setImporting(true);
    try {
      const res = await fetch('/api/wifi/mac-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', macs, propertyId: propertyId || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        const { created, skipped } = data.data || {};
        toast({
          title: 'Import Complete',
          description: `Imported ${created} MAC addresses${skipped ? `, ${skipped} skipped` : ''}`,
        });
        setImportDialogOpen(false);
        setImportText('');
        fetchEntries();
      } else {
        toast({ title: 'Error', description: data.error?.message || 'Import failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Import failed', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = () => {
    const csv = ['MAC Address,Username,Guest Name,Description,Auto Login,Valid Until,Status,Bandwidth Down,Bandwidth Up,Session Timeout,Data Limit MB'];
    const csvEscape = (val: string | undefined | null) => {
      if (!val) return '';
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };
    entries.forEach(e => {
      csv.push(
        `${csvEscape(e.macAddress)},${csvEscape(e.username)},${csvEscape(e.guestName)},${csvEscape(e.description)},${e.autoLogin},${csvEscape(e.validUntil?.split('T')[0])},${csvEscape(e.status)},${e.bandwidthDown || ''},${e.bandwidthUp || ''},${e.sessionTimeout || ''},${e.dataLimitMB || ''}`
      );
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mac-whitelist.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'MAC whitelist exported as CSV' });
  };

  // ─── Status counts for filter tabs ─────────────────────────────────────────

  const statusCounts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            MAC Authentication
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage MAC address whitelist for automatic device authentication
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchEntries}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={entries.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add MAC
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{entries.length}</p>
              <p className="text-xs text-muted-foreground">Total Entries</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{statusCounts['active'] || 0}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-950/30 p-2">
              <XCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{statusCounts['expired'] || 0}</p>
              <p className="text-xs text-muted-foreground">Expired</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-950/30 p-2">
              <Monitor className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{statusCounts['inactive'] || 0}</p>
              <p className="text-xs text-muted-foreground">Inactive</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Check MAC */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Check if MAC is whitelisted</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. AA:BB:CC:DD:EE:FF"
                  value={checkMacInput}
                  onChange={(e) => setCheckMacInput(e.target.value.toUpperCase())}
                  className="pl-9 font-mono"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCheckMac(); }}
                />
              </div>
            </div>
            <Button variant="outline" onClick={handleCheckMac} disabled={checkingMac} className="mt-5 sm:mt-auto">
              {checkingMac ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
              Check MAC
            </Button>
            {checkMacResult && (
              <div className="flex items-center gap-2 mt-5 sm:mt-auto">
                {checkMacResult.found ? (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">
                    <CheckCircle className="h-3 w-3 mr-1" /> Whitelisted
                  </Badge>
                ) : (
                  <Badge className="bg-red-500 hover:bg-red-600 text-white border-0">
                    <XCircle className="h-3 w-3 mr-1" /> Not Found
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search + Status Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by MAC, username, or guest name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          {['all', 'active', 'inactive', 'expired'].map((status) => (
            <button
              key={status}
              onClick={() => setActiveStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeStatusFilter === status
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && (statusCounts[status] || 0) > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground">({statusCounts[status]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Fingerprint className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">
                {searchQuery || activeStatusFilter !== 'all'
                  ? 'No matching MAC auth entries'
                  : 'No MAC auth entries'}
              </h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {searchQuery || activeStatusFilter !== 'all'
                  ? 'Try adjusting your search or filter'
                  : 'Add MAC addresses to enable automatic device authentication'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">MAC Address</TableHead>
                    <TableHead>Guest Name</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead className="hidden lg:table-cell">Auto Login</TableHead>
                    <TableHead className="hidden sm:table-cell">Valid Until</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Seen</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <p className="font-mono text-sm font-medium">{entry.macAddress}</p>
                        {entry.groupName && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{entry.groupName}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{entry.guestName || entry.username || '—'}</p>
                        {entry.guestName && entry.username && (
                          <p className="text-[10px] text-muted-foreground">@{entry.username}</p>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-xs text-muted-foreground max-w-[150px] truncate">{entry.description || '—'}</p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Switch checked={entry.autoLogin} disabled size="sm" />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-xs">
                          {entry.validUntil ? new Date(entry.validUntil).toLocaleDateString() : '—'}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {entry.lastSeenAt ? formatDistanceToNow(new Date(entry.lastSeenAt)) + ' ago' : 'Never'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {entry.status === 'active' && (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">Active</Badge>
                        )}
                        {entry.status === 'inactive' && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                        {entry.status === 'expired' && (
                          <Badge className="bg-gray-500 hover:bg-gray-600 text-white border-0 text-xs">Expired</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(entry)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteEntryId(entry.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit MAC Entry' : 'Add MAC Address'}</DialogTitle>
            <DialogDescription>
              {editingEntry ? 'Update MAC whitelist entry' : 'Add a device MAC address for automatic authentication'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>MAC Address *</Label>
              <Input
                value={form.macAddress}
                onChange={(e) => setForm(prev => ({ ...prev, macAddress: e.target.value.toUpperCase() }))}
                placeholder="AA:BB:CC:DD:EE:FF"
                className="font-mono"
                disabled={!!editingEntry}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username (optional)</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Link to RADIUS user"
                />
              </div>
              <div className="space-y-2">
                <Label>Guest Name</Label>
                <Input
                  value={form.guestName}
                  onChange={(e) => setForm(prev => ({ ...prev, guestName: e.target.value }))}
                  placeholder="Guest display name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. John's laptop"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm(prev => ({ ...prev, validFrom: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm(prev => ({ ...prev, validUntil: e.target.value }))}
                />
              </div>
            </div>
            {/* WiFi Plan Selector */}
            {plans.length > 0 && (
              <div className="space-y-2">
                <Label>WiFi Plan</Label>
                <Select value={selectedPlanId} onValueChange={handlePlanChange}>
                  <SelectTrigger><SelectValue placeholder="Select a plan or enter custom values" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__custom__">Custom</SelectItem>
                    {plans.map(plan => (
                      <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Download (Mbps)</Label>
                <Input
                  type="number"
                  value={form.bandwidthDown}
                  onChange={(e) => { setForm(prev => ({ ...prev, bandwidthDown: e.target.value })); setSelectedPlanId(''); }}
                  placeholder="e.g. 20"
                />
              </div>
              <div className="space-y-2">
                <Label>Upload (Mbps)</Label>
                <Input
                  type="number"
                  value={form.bandwidthUp}
                  onChange={(e) => { setForm(prev => ({ ...prev, bandwidthUp: e.target.value })); setSelectedPlanId(''); }}
                  placeholder="e.g. 10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Session Timeout (min)</Label>
                <Input
                  type="number"
                  value={form.sessionTimeout}
                  onChange={(e) => { setForm(prev => ({ ...prev, sessionTimeout: e.target.value })); setSelectedPlanId(''); }}
                  placeholder="e.g. 2880"
                />
              </div>
              <div className="space-y-2">
                <Label>Data Limit (MB)</Label>
                <Input
                  type="number"
                  value={form.dataLimitMB}
                  onChange={(e) => { setForm(prev => ({ ...prev, dataLimitMB: e.target.value })); setSelectedPlanId(''); }}
                  placeholder="e.g. 500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={form.autoLogin}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, autoLogin: checked }))}
              />
              <Label>Enable auto-login</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={savingEntry}>
              {savingEntry && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingEntry ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import MAC Addresses</DialogTitle>
            <DialogDescription>
              Paste one MAC address per line. Each will be added to the whitelist.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"AA:BB:CC:DD:EE:FF\n11:22:33:44:55:66\n..."}
              className="font-mono min-h-[200px]"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {importText.split('\n').filter(m => m.trim()).length} MAC addresses detected
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEntryId} onOpenChange={(open) => { if (!open) setDeleteEntryId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete MAC Entry</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the MAC address from the whitelist. The device will no longer auto-authenticate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
