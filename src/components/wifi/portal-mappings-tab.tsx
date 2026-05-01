'use client';

/**
 * Pool Mappings Tab — Maps IP pools/subnets to captive portal instances.
 *
 * Each mapping ties a Captive Portal to a VLAN, SSID, and/or subnet,
 * so the RADIUS server knows which portal page to serve for a given
 * network segment.
 *
 * API: /api/wifi/portal/mappings (REST: GET/POST)
 *      /api/wifi/portal/mappings/[id] (GET/PUT/DELETE)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  ArrowRightLeft,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  RefreshCw,
  Search,
  Info,
  Wifi,
  Network,
  Globe,
  Monitor,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePropertyId } from '@/hooks/use-property';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface PortalMappingEntry {
  id: string;
  propertyId: string;
  portalId: string;
  vlanId: number | null;
  ssid: string | null;
  subnet: string | null;
  priority: number;
  fallbackPortalId: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  captivePortal?: { id: string; name: string } | null;
  property?: { id: string; name: string } | null;
}

interface PortalOption {
  id: string;
  name: string;
}

interface MappingForm {
  portalId: string;
  vlanId: string;
  ssid: string;
  subnet: string;
  priority: number;
  enabled: boolean;
}

const EMPTY_FORM: MappingForm = {
  portalId: '',
  vlanId: '',
  ssid: '',
  subnet: '',
  priority: 0,
  enabled: true,
};

// ─── Component ──────────────────────────────────────────────────────────────────

export default function PortalMappingsTab() {
  const { toast } = useToast();
  const { propertyId } = usePropertyId();

  const [mappings, setMappings] = useState<PortalMappingEntry[]>([]);
  const [portals, setPortals] = useState<PortalOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PortalMappingEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<MappingForm>({ ...EMPTY_FORM });

  // ─── API Helpers ─────────────────────────────────────────────────────────────

  const buildUrl = (base: string, params?: Record<string, string>) => {
    const url = new URL(base, window.location.origin);
    if (propertyId) url.searchParams.set('propertyId', propertyId);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  };

  const fetchPortals = useCallback(async () => {
    try {
      const res = await fetch('/api/wifi/portal/instances');
      const data = await res.json();
      if (data.success && data.data) {
        setPortals(Array.isArray(data.data)
          ? data.data.map((p: any) => ({ id: p.id, name: p.name }))
          : []);
      }
    } catch (error) {
      console.error('Failed to fetch portal instances:', error);
    }
  }, []);

  const fetchMappings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(buildUrl('/api/wifi/portal/mappings'));
      const data = await res.json();
      if (data.success && data.data) {
        setMappings(Array.isArray(data.data) ? data.data : []);
      } else {
        setMappings([]);
      }
    } catch (error) {
      console.error('Failed to fetch portal mappings:', error);
      setMappings([]);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchPortals();
    fetchMappings();
  }, [fetchPortals, fetchMappings]);

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingEntry(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (entry: PortalMappingEntry) => {
    setEditingEntry(entry);
    setForm({
      portalId: entry.portalId,
      vlanId: entry.vlanId !== null ? String(entry.vlanId) : '',
      ssid: entry.ssid || '',
      subnet: entry.subnet || '',
      priority: entry.priority,
      enabled: entry.enabled,
    });
    setDialogOpen(true);
  };

  // ─── CRUD Operations ────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.portalId) {
      toast({ title: 'Validation Error', description: 'Please select a portal instance', variant: 'destructive' });
      return;
    }
    if (!propertyId) {
      toast({ title: 'Error', description: 'No property selected', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let res: Response;
      if (editingEntry) {
        // Update
        res = await fetch(`/api/wifi/portal/mappings/${editingEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vlanId: form.vlanId ? parseInt(form.vlanId, 10) : null,
            ssid: form.ssid || null,
            subnet: form.subnet || null,
            priority: form.priority,
            enabled: form.enabled,
          }),
        });
      } else {
        // Create
        res = await fetch('/api/wifi/portal/mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId,
            portalId: form.portalId,
            vlanId: form.vlanId ? parseInt(form.vlanId, 10) : null,
            ssid: form.ssid || null,
            subnet: form.subnet || null,
            priority: form.priority,
            enabled: form.enabled,
          }),
        });
      }

      const data = await res.json();
      if (data.success) {
        toast({
          title: editingEntry ? 'Mapping Updated' : 'Mapping Created',
          description: editingEntry
            ? 'Portal mapping updated successfully'
            : 'New portal-to-network mapping created',
        });
        setDialogOpen(false);
        resetForm();
        fetchMappings();
      } else {
        toast({
          title: 'Error',
          description: data.error?.message || 'Failed to save mapping',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Network Error', description: 'Failed to save mapping', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/wifi/portal/mappings/${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Deleted', description: 'Portal mapping removed' });
        fetchMappings();
      } else {
        toast({ title: 'Error', description: data.error?.message || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network Error', description: 'Failed to delete mapping', variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const handleToggle = async (entry: PortalMappingEntry) => {
    try {
      const res = await fetch(`/api/wifi/portal/mappings/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !entry.enabled }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: entry.enabled ? 'Mapping Disabled' : 'Mapping Enabled',
          description: `${entry.captivePortal?.name || 'Portal'} mapping is now ${entry.enabled ? 'disabled' : 'enabled'}`,
        });
        fetchMappings();
      } else {
        toast({ title: 'Error', description: data.error?.message || 'Failed to toggle', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network Error', description: 'Failed to toggle mapping', variant: 'destructive' });
    }
  };

  // ─── Filtering ──────────────────────────────────────────────────────────────

  const filteredMappings = mappings.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (m.captivePortal?.name || '').toLowerCase().includes(q) ||
      (m.ssid || '').toLowerCase().includes(q) ||
      (m.subnet || '').toLowerCase().includes(q) ||
      String(m.vlanId || '').includes(q) ||
      (m.property?.name || '').toLowerCase().includes(q)
    );
  });

  const enabledCount = mappings.filter(m => m.enabled).length;
  const disabledCount = mappings.length - enabledCount;

  // ─── Portal name lookup ─────────────────────────────────────────────────────

  const getPortalName = (entry: PortalMappingEntry) => {
    return entry.captivePortal?.name || 'Unknown Portal';
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-800 dark:bg-teal-950/30">
        <Info className="h-5 w-5 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-teal-800 dark:text-teal-300">Pool / Network Mappings</p>
          <p className="text-xs text-teal-700/80 dark:text-teal-400/70 mt-1">
            Map captive portal instances to VLANs, SSIDs, and IP subnets. The RADIUS server uses these mappings
            to determine which portal page to serve for a given network segment.
          </p>
        </div>
      </div>

      {/* Stats + Actions Row */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{mappings.length}</span>
            <span className="text-sm text-muted-foreground">mapping{mappings.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {enabledCount} active
            </span>
            {disabledCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                {disabledCount} inactive
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchMappings} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-1.5', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Mapping
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by portal, SSID, subnet, VLAN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Mappings Table / Cards */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredMappings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <ArrowRightLeft className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">
                {searchQuery ? 'No matching mappings' : 'No pool mappings yet'}
              </h3>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Create a mapping to link a captive portal instance to a VLAN, SSID, or IP subnet'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop: Table view */}
              <div className="hidden sm:block max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Portal Instance</TableHead>
                      <TableHead>SSID</TableHead>
                      <TableHead>VLAN</TableHead>
                      <TableHead>Subnet</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMappings.map((entry) => (
                      <TableRow key={entry.id} className={cn(!entry.enabled && 'opacity-50')}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Monitor className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{getPortalName(entry)}</p>
                              {entry.property?.name && (
                                <p className="text-[10px] text-muted-foreground">{entry.property.name}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.ssid ? (
                            <div className="flex items-center gap-1.5">
                              <Wifi className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm font-mono">{entry.ssid}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">&mdash;</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.vlanId !== null ? (
                            <Badge variant="outline" className="text-xs font-mono">
                              <Network className="h-3 w-3 mr-1" />
                              VLAN {entry.vlanId}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">&mdash;</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.subnet ? (
                            <span className="font-mono text-xs bg-muted/60 px-2 py-0.5 rounded">{entry.subnet}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">&mdash;</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{entry.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={entry.enabled}
                            onCheckedChange={() => handleToggle(entry)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(entry)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteId(entry.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: Card view */}
              <div className="sm:hidden divide-y">
                {filteredMappings.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn('p-4 space-y-3', !entry.enabled && 'opacity-50')}
                  >
                    {/* Portal name + toggle */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Monitor className="h-4 w-4 text-teal-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{getPortalName(entry)}</p>
                          {entry.property?.name && (
                            <p className="text-[10px] text-muted-foreground">{entry.property.name}</p>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={entry.enabled}
                        onCheckedChange={() => handleToggle(entry)}
                      />
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">SSID:</span>
                        <span className="ml-1">{entry.ssid || '—'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">VLAN:</span>
                        <span className="ml-1">{entry.vlanId !== null ? entry.vlanId : '—'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Priority:</span>
                        <span className="ml-1">{entry.priority}</span>
                      </div>
                    </div>
                    {entry.subnet && (
                      <div className="flex items-center gap-1 text-xs">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Subnet:</span>
                        <span className="ml-1 font-mono">{entry.subnet}</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(entry)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteId(entry.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit Pool Mapping' : 'Add Pool Mapping'}</DialogTitle>
            <DialogDescription>
              {editingEntry
                ? 'Update the network-to-portal mapping configuration'
                : 'Create a new mapping to link a portal instance to a network segment'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Portal Instance Select */}
            <div className="space-y-2">
              <Label>Portal Instance *</Label>
              {editingEntry ? (
                <Input
                  value={portals.find(p => p.id === form.portalId)?.name || 'Assigned Portal'}
                  disabled
                  className="bg-muted"
                />
              ) : (
                <Select value={form.portalId} onValueChange={(v) => setForm(prev => ({ ...prev, portalId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a portal instance" />
                  </SelectTrigger>
                  <SelectContent>
                    {portals.length === 0 ? (
                      <SelectItem value="_none" disabled>No portal instances available</SelectItem>
                    ) : (
                      portals.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[10px] text-muted-foreground">
                {editingEntry
                  ? 'Portal cannot be changed after creation'
                  : 'The captive portal to serve for this network segment'}
              </p>
            </div>

            {/* SSID */}
            <div className="space-y-2">
              <Label>SSID</Label>
              <Input
                value={form.ssid}
                onChange={(e) => setForm(prev => ({ ...prev, ssid: e.target.value }))}
                placeholder="e.g. Hotel_Guest, Staff_WiFi"
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">WiFi network name (optional)</p>
            </div>

            {/* VLAN + Subnet Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>VLAN ID</Label>
                <Input
                  type="number"
                  value={form.vlanId}
                  onChange={(e) => setForm(prev => ({ ...prev, vlanId: e.target.value }))}
                  placeholder="e.g. 100"
                  className="font-mono"
                />
                <p className="text-[10px] text-muted-foreground">VLAN tag (optional)</p>
              </div>
              <div className="space-y-2">
                <Label>Subnet</Label>
                <Input
                  value={form.subnet}
                  onChange={(e) => setForm(prev => ({ ...prev, subnet: e.target.value }))}
                  placeholder="e.g. 10.10.10.0/24"
                  className="font-mono"
                />
                <p className="text-[10px] text-muted-foreground">CIDR subnet (optional)</p>
              </div>
            </div>

            {/* Priority + Enabled Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
                <p className="text-[10px] text-muted-foreground">Higher = matched first</p>
              </div>
              <div className="flex items-end space-x-2 pb-1">
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, enabled: checked }))}
                />
                <Label className="text-sm">Enabled</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || (!editingEntry && !form.portalId)} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingEntry ? 'Update Mapping' : 'Create Mapping'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pool Mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              This mapping will be permanently removed. The portal will no longer be
              associated with this network segment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
