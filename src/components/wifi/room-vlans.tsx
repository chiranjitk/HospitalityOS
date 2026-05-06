'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/hooks/use-toast';
import { usePropertyId } from '@/hooks/use-property';
import { useFeature } from '@/contexts/FeatureFlagsContext';
import {
  Layers, Plus, Trash2, Edit2, RefreshCw, Download,
  Shield, AlertCircle, CheckCircle2, XCircle,
  Building, Loader2, Search, Zap, ChevronDown, Eye, Copy,
  Network, Cpu, Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface RoomVlan {
  id: string;
  roomNumber: string;
  vlanId: number;
  subnet: string;
  gateway: string;
  parentInterfaceId: string | null;
  parentInterfaceName: string | null;
  role: string;
  mtu: number;
  floor: number;
  roomType: 'standard' | 'suite' | 'conference' | 'vip';
  status: 'active' | 'maintenance' | 'disabled';
  bandwidthPolicyId: string | null;
  bandwidthPolicyName: string | null;
  firewallEnabled: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NetworkInterface {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string | null;
}

interface BandwidthPolicy {
  id: string;
  name: string;
  downloadRate: string;
  uploadRate: string;
}

interface FloorConfig {
  floor: number;
  roomRange: string;
}

interface BulkGenerateForm {
  vlanBaseId: number;
  subnetBase: string;
  floors: FloorConfig[];
  roomType: 'standard' | 'suite' | 'conference' | 'vip';
  parentInterfaceId: string;
  role: string;
  mtu: number;
}

interface RoomVlanForm {
  roomNumber: string;
  vlanId: number;
  subnet: string;
  gateway: string;
  parentInterfaceId: string;
  role: string;
  mtu: number;
  floor: number;
  roomType: 'standard' | 'suite' | 'conference' | 'vip';
  bandwidthPolicyId: string;
  description: string;
  status: 'active' | 'maintenance' | 'disabled';
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const API_BASE = '/api/wifi/network/room-vlans';

const ROOM_TYPE_BADGE: Record<string, string> = {
  standard: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  suite: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-700',
  conference: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-700',
  vip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
  maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700',
  disabled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700',
};

const ROLE_OPTIONS = [
  { value: 'guest', label: 'Guest', description: 'Guest room network — isolated VLAN per room' },
  { value: 'wan', label: 'WAN', description: 'Wide Area Network / uplink' },
  { value: 'lan', label: 'LAN', description: 'Local Area Network / staff network' },
  { value: 'wifi', label: 'WiFi', description: 'Wireless network' },
  { value: 'management', label: 'Management', description: 'Out-of-band management' },
  { value: 'dmz', label: 'DMZ', description: 'Demilitarized Zone' },
  { value: 'iot', label: 'IoT', description: 'Internet of Things devices' },
  { value: 'unused', label: 'Unused', description: 'Interface not in use' },
];

const ROLE_BADGE: Record<string, string> = {
  guest: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-700',
  wan: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-700',
  lan: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700',
  wifi: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-700',
  management: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  dmz: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700',
  iot: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700',
  unused: 'bg-slate-100 text-slate-500 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200 dark:border-slate-700',
};

const emptyForm: RoomVlanForm = {
  roomNumber: '',
  vlanId: 1001,
  subnet: '',
  gateway: '',
  parentInterfaceId: '',
  role: 'guest',
  mtu: 1500,
  floor: 1,
  roomType: 'standard',
  bandwidthPolicyId: '',
  description: '',
  status: 'active',
};

const emptyBulkForm: BulkGenerateForm = {
  vlanBaseId: 1001,
  subnetBase: '10.1',
  floors: [{ floor: 1, roomRange: '101-110' }],
  roomType: 'standard',
  parentInterfaceId: '',
  role: 'guest',
  mtu: 1500,
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

/** Parse a room range string like "101-110" or "101,102,103,105" into an array of room numbers */
function parseRoomRange(range: string): number[] {
  const rooms: number[] = [];
  const parts = range.split(',').map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) rooms.push(i);
      }
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n)) rooms.push(n);
    }
  }
  return rooms;
}

/** Generate preview rows from the bulk form */
function generatePreview(form: BulkGenerateForm): { roomNumber: string; vlanId: number; subnet: string; gateway: string; floor: number }[] {
  const rows: { roomNumber: string; vlanId: number; subnet: string; gateway: string; floor: number }[] = [];
  let vlanOffset = 0;

  for (const floorConfig of form.floors) {
    const rooms = parseRoomRange(floorConfig.roomRange);
    for (const roomNum of rooms) {
      const vlanId = form.vlanBaseId + vlanOffset;
      const subnet = `${form.subnetBase}.${Math.floor(vlanId / 256)}.${(vlanId % 256)}.0/24`;
      const gateway = `${form.subnetBase}.${Math.floor(vlanId / 256)}.${(vlanId % 256)}.1`;
      rows.push({
        roomNumber: String(roomNum),
        vlanId,
        subnet,
        gateway,
        floor: floorConfig.floor,
      });
      vlanOffset++;
    }
  }
  return rows;
}

/** Auto-calculate subnet from VLAN ID */
function autoSubnet(vlanId: number, base: string = '10.0'): string {
  return `${base}.${Math.floor(vlanId / 256)}.${(vlanId % 256)}.0/24`;
}

/** Auto-calculate gateway from VLAN ID */
function autoGateway(vlanId: number, base: string = '10.0'): string {
  return `${base}.${Math.floor(vlanId / 256)}.${(vlanId % 256)}.1`;
}

/** Generate mock nftables rules for firewall preview */
function generateNftablesRules(roomVlans: RoomVlan[]): string {
  if (roomVlans.length === 0) return '# No active room VLANs to generate rules for.\n';

  const lines: string[] = [];
  lines.push('#!/usr/sbin/nft -f');
  lines.push('# Room-VLAN Isolation Rules — Generated by StaySuite');
  lines.push(`# ${new Date().toISOString()}`);
  lines.push('# ──────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('table inet room_vlan_isolation {');

  // Chain declarations
  lines.push('  chain forward {');
  lines.push('    type filter hook forward priority 0; policy drop;');
  lines.push('  }');
  lines.push('');
  lines.push('  chain input {');
  lines.push('    type filter hook input priority 0; policy accept;');
  lines.push('  }');
  lines.push('');

  for (const rv of roomVlans) {
    if (rv.status !== 'active') continue;
    const subnet = rv.subnet.replace('/24', '');
    lines.push(`  # Room ${rv.roomNumber} — VLAN ${rv.vlanId}`);
    lines.push(`  chain vlan_${rv.vlanId}_out {`);
    lines.push(`    type filter hook forward priority 0; policy drop;`);
    lines.push(`    # Allow DHCP`);
    lines.push(`    udp dport { 67, 68 } accept`);
    lines.push(`    # Allow DNS`);
    lines.push(`    udp dport 53 accept`);
    lines.push(`    tcp dport 53 accept`);
    lines.push(`    # Allow HTTP/HTTPS`);
    lines.push(`    tcp dport { 80, 443 } accept`);
    lines.push(`    # Block inter-room traffic`);
    lines.push(`    iifname "vlan${rv.vlanId}" ip saddr ${subnet}.0/24 ip daddr ${subnet}.0/24 drop`);
    lines.push(`    # Allow established connections`);
    lines.push(`    ct state established,related accept`);
    lines.push(`    # Default drop`);
    lines.push(`    counter drop`);
    lines.push(`  }`);
    lines.push('');
  }

  lines.push('}');
  return lines.join('\n');
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function RoomVlanManager() {
  const { enabled, isLoading: featureLoading } = useFeature('room_vlan_isolation');
  const { propertyId } = usePropertyId();
  const { toast } = useToast();

  // ── State ──
  const [roomVlans, setRoomVlans] = useState<RoomVlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bandwidthPolicies, setBandwidthPolicies] = useState<BandwidthPolicy[]>([]);
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoomVlanForm>({ ...emptyForm });

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState<BulkGenerateForm>({ ...emptyBulkForm });

  const [firewallOpen, setFirewallOpen] = useState(false);
  const [firewallRules, setFirewallRules] = useState('');
  const [copied, setCopied] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Data fetchers ──

  const fetchRoomVlans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (propertyId) params.set('propertyId', propertyId);
      const res = await fetch(`${API_BASE}?${params.toString()}`);
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        // Map API response to UI types
        const mapped = result.data.map((rv: Record<string, unknown>) => ({
          ...rv,
          parentInterfaceName: (rv.parentInterface as Record<string, unknown> | null)?.name || null,
          bandwidthPolicyName: (rv.bandwidthPolicy as Record<string, unknown> | null)?.name || null,
          firewallEnabled: Boolean(rv.firewallRulesGenerated),
        }));
        setRoomVlans(mapped as RoomVlan[]);
      } else {
        setRoomVlans([]);
      }
    } catch {
      setRoomVlans([]);
      toast({ title: 'Error', description: 'Failed to load room VLANs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [propertyId, toast]);

  const fetchInterfaces = useCallback(async () => {
    try {
      const res = await fetch('/api/wifi/network/interfaces');
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        // Only ethernet and bridge types as VLAN parents (same as VLANs tab)
        setInterfaces(result.data.filter((i: NetworkInterface) => i.type === 'ethernet' || i.type === 'bridge'));
      }
    } catch {
      // Silently ignore
    }
  }, []);

  const fetchBandwidthPolicies = useCallback(async () => {
    try {
      const res = await fetch('/api/wifi/firewall/bandwidth-policies');
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        setBandwidthPolicies(result.data);
      }
    } catch {
      // Silently ignore — bandwidth policy select will show empty
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await fetchRoomVlans();
      if (!cancelled) {
        await Promise.all([fetchInterfaces(), fetchBandwidthPolicies()]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [fetchRoomVlans, fetchInterfaces, fetchBandwidthPolicies]);

  // ── Computed ──

  // ── Feature gate ──
  if (featureLoading) {
    return null;
  }
  if (!enabled) {
    return null;
  }

  const floors = Array.from(new Set(roomVlans.map((rv) => rv.floor))).sort((a, b) => a - b);

  const filteredVlans = roomVlans
    .filter((rv) => search === '' || rv.roomNumber.toLowerCase().includes(search.toLowerCase()))
    .filter((rv) => floorFilter === 'all' || rv.floor === parseInt(floorFilter, 10))
    .filter((rv) => statusFilter === 'all' || rv.status === statusFilter)
    .sort((a, b) => {
      const floorComp = a.floor - b.floor;
      if (floorComp !== 0) return floorComp;
      return parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10);
    });

  const totalCount = roomVlans.length;
  const activeCount = roomVlans.filter((rv) => rv.status === 'active').length;
  const maintenanceCount = roomVlans.filter((rv) => rv.status === 'maintenance' || rv.status === 'disabled').length;
  const firewallRulesGenerated = roomVlans.some((rv) => rv.firewallEnabled);

  // ── CRUD handlers ──

  function openAddForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormOpen(true);
  }

  function openEditForm(rv: RoomVlan) {
    setEditingId(rv.id);
    setForm({
      roomNumber: rv.roomNumber,
      vlanId: rv.vlanId,
      subnet: rv.subnet,
      gateway: rv.gateway,
      parentInterfaceId: rv.parentInterfaceId || '',
      role: rv.role || 'guest',
      mtu: rv.mtu || 1500,
      floor: rv.floor,
      roomType: rv.roomType,
      bandwidthPolicyId: rv.bandwidthPolicyId || '',
      description: rv.description || '',
      status: rv.status,
    });
    setFormOpen(true);
  }

  function handleVlanIdChange(vlanId: number) {
    const base = bulkForm.subnetBase || '10.0';
    setForm((prev) => ({
      ...prev,
      vlanId,
      subnet: prev.subnet || autoSubnet(vlanId, base),
      gateway: prev.gateway || autoGateway(vlanId, base),
    }));
  }

  async function handleSave() {
    if (!form.roomNumber.trim()) {
      toast({ title: 'Validation Error', description: 'Room number is required', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        const res = await fetch(`${API_BASE}/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, propertyId }),
        });
        const result = await res.json();
        if (result.success) {
          toast({ title: 'Room VLAN Updated', description: `Room ${form.roomNumber} has been updated.` });
        } else {
          toast({ title: 'Error', description: result.error?.message || 'Failed to update', variant: 'destructive' });
        }
      } else {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, propertyId }),
        });
        const result = await res.json();
        if (result.success) {
          toast({ title: 'Room VLAN Created', description: `Room ${form.roomNumber} has been added.` });
        } else {
          toast({ title: 'Error', description: result.error?.message || 'Failed to create', variant: 'destructive' });
        }
      }
      setFormOpen(false);
      fetchRoomVlans();
    } catch {
      toast({ title: 'Error', description: 'Failed to save room VLAN', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`${API_BASE}/${deleteId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Room VLAN Deleted', description: 'The mapping has been removed.' });
        fetchRoomVlans();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete room VLAN', variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  }

  async function handleToggleStatus(id: string) {
    const rv = roomVlans.find((r) => r.id === id);
    if (!rv) return;
    const newStatus = rv.status === 'active' ? 'disabled' : 'active';
    try {
      await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, propertyId }),
      });
      setRoomVlans(roomVlans.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
      toast({ title: 'Status Updated', description: `Room ${rv.roomNumber} is now ${newStatus}` });
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  }

  // ── Bulk generate ──

  function openBulkDialog() {
    setBulkForm({ ...emptyBulkForm });
    setBulkOpen(true);
  }

  function addBulkFloor() {
    const maxFloor = bulkForm.floors.length > 0 ? Math.max(...bulkForm.floors.map((f) => f.floor)) : 0;
    setBulkForm((prev) => ({
      ...prev,
      floors: [...prev.floors, { floor: maxFloor + 1, roomRange: '' }],
    }));
  }

  function removeBulkFloor(index: number) {
    setBulkForm((prev) => ({
      ...prev,
      floors: prev.floors.filter((_, i) => i !== index),
    }));
  }

  function updateBulkFloor(index: number, field: keyof FloorConfig, value: string | number) {
    setBulkForm((prev) => ({
      ...prev,
      floors: prev.floors.map((f, i) => (i === index ? { ...f, [field]: value } : f)),
    }));
  }

  async function handleBulkGenerate() {
    const preview = generatePreview(bulkForm);
    if (preview.length === 0) {
      toast({ title: 'No Rooms', description: 'Configure at least one floor with valid room ranges', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          propertyId,
          mappings: preview.map((p) => ({
            ...p,
            roomType: bulkForm.roomType,
            status: 'active',
          })),
          parentInterfaceId: bulkForm.parentInterfaceId || undefined,
          role: bulkForm.role,
          mtu: bulkForm.mtu,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'VLANs Generated', description: `${preview.length} room-VLAN mappings have been created.` });
        setBulkOpen(false);
        fetchRoomVlans();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Bulk generation failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to generate room VLANs', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  // ── Firewall preview ──

  function openFirewallPreview() {
    setFirewallRules(generateNftablesRules(roomVlans));
    setFirewallOpen(true);
  }

  function handleCopyRules() {
    navigator.clipboard.writeText(firewallRules).then(() => {
      setCopied(true);
      toast({ title: 'Copied', description: 'Firewall rules copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'destructive' });
    });
  }

  function handleApplyRules() {
    toast({
      title: 'Firewall Rules Queued',
      description: 'Rules would be pushed to the gateway. In production, this applies via the firewall service.',
    });
    setFirewallOpen(false);
  }

  // ── Stats cards ──

  const statsCardsData = [
    {
      title: 'Total Room VLANs',
      value: totalCount,
      icon: Building,
      color: 'text-teal-600 dark:text-teal-400',
      bg: 'bg-teal-500/10',
    },
    {
      title: 'Active',
      value: activeCount,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
      badge: activeCount > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : '',
    },
    {
      title: 'Maintenance / Disabled',
      value: maintenanceCount,
      icon: AlertCircle,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
      badge: maintenanceCount > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : '',
    },
    {
      title: 'Firewall Rules',
      value: firewallRulesGenerated ? 'Generated' : 'None',
      icon: Shield,
      color: firewallRulesGenerated ? 'text-teal-600 dark:text-teal-400' : 'text-muted-foreground',
      bg: firewallRulesGenerated ? 'bg-teal-500/10' : 'bg-muted',
    },
  ];

  // ── Preview rows for bulk dialog ──
  const bulkPreview = generatePreview(bulkForm);

  // ── Render ──

  if (featureLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCardsData.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden">
              <div className={cn('absolute top-0 left-0 right-0 h-1', stat.badge ? '' : 'bg-gradient-to-r from-teal-500 to-emerald-500')} />
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.title}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', stat.bg)}>
                    <Icon className={cn('h-5 w-5', stat.color)} />
                  </div>
                </div>
                {stat.badge && (
                  <Badge variant="outline" className={cn('mt-2 text-xs', stat.badge)}>
                    {stat.title === 'Active' ? 'Online' : stat.title === 'Maintenance / Disabled' ? 'Needs Attention' : ''}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Action Bar ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search room number…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Floor filter */}
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="All Floors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Floors</SelectItem>
                {floors.map((f) => (
                  <SelectItem key={f} value={String(f)}>Floor {f}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />

            {/* Action buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={openBulkDialog} className="gap-1.5">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Generate VLANs</span>
              </Button>
              <Button variant="outline" size="sm" onClick={openFirewallPreview} className="gap-1.5">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Firewall Rules</span>
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={fetchRoomVlans}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={openAddForm} className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add VLAN</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Data Table or Empty State ── */}
      {filteredVlans.length === 0 && !loading ? (
        <EmptyState
          icon={Layers}
          title="No Room VLANs Configured"
          description="Generate room VLANs in bulk or add individual mappings to enable per-room network isolation."
          action={{
            label: 'Generate VLANs',
            onClick: openBulkDialog,
          }}
          className="py-16"
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-teal-500 to-emerald-500" />
          <CardContent className="p-0">
            <div className="max-h-[32rem] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Room Number</TableHead>
                    <TableHead className="w-20">VLAN ID</TableHead>
                    <TableHead className="w-36">Interface</TableHead>
                    <TableHead className="w-24">Role</TableHead>
                    <TableHead className="w-40">Subnet</TableHead>
                    <TableHead className="w-16">Floor</TableHead>
                    <TableHead className="w-24">Room Type</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-20">Firewall</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVlans.map((rv) => (
                    <TableRow key={rv.id} className={cn(rv.status !== 'active' && 'opacity-60')}>
                      {/* Room Number */}
                      <TableCell>
                        <span className="font-semibold text-sm">{rv.roomNumber}</span>
                      </TableCell>
                      {/* VLAN ID */}
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {rv.vlanId}
                        </Badge>
                      </TableCell>
                      {/* Parent Interface */}
                      <TableCell>
                        {rv.parentInterfaceName ? (
                          <div className="flex items-center gap-1.5">
                            <Network className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-mono text-xs">{rv.parentInterfaceName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {/* Role */}
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs font-medium capitalize', ROLE_BADGE[rv.role] || ROLE_BADGE.unused)}>
                          {rv.role}
                        </Badge>
                      </TableCell>
                      {/* Subnet */}
                      <TableCell className="font-mono text-xs">{rv.subnet}</TableCell>
                      {/* Floor */}
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{rv.floor}</span>
                      </TableCell>
                      {/* Room Type */}
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs font-medium capitalize', ROOM_TYPE_BADGE[rv.roomType])}>
                          {rv.roomType}
                        </Badge>
                      </TableCell>
                      {/* Status */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rv.status === 'active'}
                            onCheckedChange={() => handleToggleStatus(rv.id)}
                            className="scale-75"
                          />
                          <Badge variant="outline" className={cn('text-xs capitalize', STATUS_BADGE[rv.status])}>
                            {rv.status}
                          </Badge>
                        </div>
                      </TableCell>
                      {/* Firewall */}
                      <TableCell>
                        {rv.firewallEnabled ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            </TooltipTrigger>
                            <TooltipContent>Firewall rules active</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <XCircle className="h-4 w-4 text-red-400" />
                            </TooltipTrigger>
                            <TooltipContent>No firewall rules</TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditForm(rv)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => setDeleteId(rv.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state extra buttons ── */}
      {roomVlans.length === 0 && (
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={openBulkDialog} className="gap-2">
            <Zap className="h-4 w-4" />
            Generate VLANs
          </Button>
          <Button variant="outline" onClick={openAddForm} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Single VLAN
          </Button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ADD / EDIT DIALOG
          ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Room VLAN' : 'Add Room VLAN'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the room-VLAN mapping.' : 'Create a new room-VLAN mapping for network isolation.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Room Number & VLAN ID */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Room Number *</Label>
                <Input
                  value={form.roomNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, roomNumber: e.target.value }))}
                  placeholder="e.g. 101"
                />
              </div>
              <div className="space-y-2">
                <Label>VLAN ID *</Label>
                <Input
                  type="number"
                  value={form.vlanId}
                  onChange={(e) => handleVlanIdChange(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. 1001"
                  min={1}
                  max={4094}
                />
              </div>
            </div>

            {/* Parent Interface & Role */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Network className="h-3.5 w-3.5" />
                  Parent Interface
                </Label>
                <Select value={form.parentInterfaceId || '__none__'} onValueChange={(v) => setForm((prev) => ({ ...prev, parentInterfaceId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select interface…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No interface</SelectItem>
                    {interfaces.map((iface) => (
                      <SelectItem key={iface.id} value={iface.id}>
                        <span className="flex items-center gap-2">
                          <span className="font-mono">{iface.name}</span>
                          <span className="text-muted-foreground text-xs capitalize">{iface.type}</span>
                          {iface.status === 'up' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  Role
                </Label>
                <Select value={form.role} onValueChange={(v) => setForm((prev) => ({ ...prev, role: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <span className="flex items-center justify-between gap-4">
                          <span>{r.label}</span>
                          <span className="text-xs text-muted-foreground max-w-[140px] truncate">{r.description}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Subnet & Gateway */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subnet</Label>
                <Input
                  value={form.subnet}
                  onChange={(e) => setForm((prev) => ({ ...prev, subnet: e.target.value }))}
                  placeholder="e.g. 10.0.3.0/28"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label>Gateway</Label>
                <Input
                  value={form.gateway}
                  onChange={(e) => setForm((prev) => ({ ...prev, gateway: e.target.value }))}
                  placeholder="e.g. 10.0.3.1"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            {/* Floor & Room Type */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Floor</Label>
                <Input
                  type="number"
                  value={form.floor}
                  onChange={(e) => setForm((prev) => ({ ...prev, floor: parseInt(e.target.value, 10) || 1 }))}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>MTU</Label>
                <Input
                  type="number"
                  value={form.mtu}
                  onChange={(e) => setForm((prev) => ({ ...prev, mtu: parseInt(e.target.value, 10) || 1500 }))}
                  min={576}
                  max={9000}
                />
              </div>
              <div className="space-y-2">
                <Label>Room Type</Label>
                <Select value={form.roomType} onValueChange={(v) => setForm((prev) => ({ ...prev, roomType: v as RoomVlanForm['roomType'] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="suite">Suite</SelectItem>
                    <SelectItem value="conference">Conference</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bandwidth Plan */}
            <div className="space-y-2">
              <Label>Bandwidth Plan</Label>
              <Select value={form.bandwidthPolicyId || '__none__'} onValueChange={(v) => setForm((prev) => ({ ...prev, bandwidthPolicyId: v === '__none__' ? '' : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Default (no policy)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Default (no policy)</SelectItem>
                  {bandwidthPolicies.map((bp) => (
                    <SelectItem key={bp.id} value={bp.id}>
                      {bp.name} ({bp.downloadRate}/{bp.uploadRate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((prev) => ({ ...prev, status: v as RoomVlanForm['status'] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.roomNumber.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          BULK GENERATE DIALOG
          ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Generate Room VLANs</DialogTitle>
            <DialogDescription>
              Configure VLAN parameters and floor/room ranges to generate room-VLAN mappings in bulk.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* VLAN Base & Subnet Base */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>VLAN Base ID</Label>
                <Input
                  type="number"
                  value={bulkForm.vlanBaseId}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, vlanBaseId: parseInt(e.target.value, 10) || 1001 }))}
                  min={1}
                  max={4094}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">First VLAN ID (subsequent rooms increment from here)</p>
              </div>
              <div className="space-y-2">
                <Label>Subnet Base</Label>
                <Input
                  value={bulkForm.subnetBase}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, subnetBase: e.target.value }))}
                  placeholder="e.g. 10.1"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Base subnet prefix (e.g. 10.1 → 10.1.x.y)</p>
              </div>
            </div>

            {/* Parent Interface & Role & MTU */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Network className="h-3.5 w-3.5" />
                  Trunk Interface
                </Label>
                <Select value={bulkForm.parentInterfaceId || '__none__'} onValueChange={(v) => setBulkForm((prev) => ({ ...prev, parentInterfaceId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select interface…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No interface</SelectItem>
                    {interfaces.map((iface) => (
                      <SelectItem key={iface.id} value={iface.id}>
                        <span className="font-mono">{iface.name}</span>
                        <span className="text-muted-foreground text-xs capitalize ml-2">({iface.type})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">All room VLANs trunked on this interface</p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  Role
                </Label>
                <Select value={bulkForm.role} onValueChange={(v) => setBulkForm((prev) => ({ ...prev, role: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" />
                  MTU
                </Label>
                <Input
                  type="number"
                  value={bulkForm.mtu}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, mtu: parseInt(e.target.value, 10) || 1500 }))}
                  min={576}
                  max={9000}
                  className="font-mono"
                />
              </div>
            </div>

            {/* Default Room Type */}
            <div className="space-y-2">
              <Label>Default Room Type</Label>
              <Select value={bulkForm.roomType} onValueChange={(v) => setBulkForm((prev) => ({ ...prev, roomType: v as BulkGenerateForm['roomType'] }))}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="suite">Suite</SelectItem>
                  <SelectItem value="conference">Conference</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Floor Configuration */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Floor Configuration</Label>
                <Button variant="outline" size="sm" onClick={addBulkFloor} className="gap-1.5 h-8">
                  <Plus className="h-3.5 w-3.5" />
                  Add Floor
                </Button>
              </div>

              <div className="space-y-3">
                {bulkForm.floors.map((fc, index) => (
                  <div key={index} className="flex items-end gap-3">
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs text-muted-foreground">Floor</Label>
                      <Input
                        type="number"
                        value={fc.floor}
                        onChange={(e) => updateBulkFloor(index, 'floor', parseInt(e.target.value, 10) || 1)}
                        min={1}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1 flex-[2]">
                      <Label className="text-xs text-muted-foreground">Room Range</Label>
                      <Input
                        value={fc.roomRange}
                        onChange={(e) => updateBulkFloor(index, 'roomRange', e.target.value)}
                        placeholder="e.g. 101-110 or 101,102,105"
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                    {bulkForm.floors.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive shrink-0"
                        onClick={() => removeBulkFloor(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Table */}
            {bulkPreview.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Preview ({bulkPreview.length} room{bulkPreview.length !== 1 ? 's' : ''})
                </Label>
                <div className="max-h-48 overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Room</TableHead>
                        <TableHead className="text-xs">VLAN</TableHead>
                        <TableHead className="text-xs">Subnet</TableHead>
                        <TableHead className="text-xs">Gateway</TableHead>
                        <TableHead className="text-xs">Floor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkPreview.slice(0, 50).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs font-medium">{row.roomNumber}</TableCell>
                          <TableCell className="font-mono text-xs">{row.vlanId}</TableCell>
                          <TableCell className="font-mono text-xs">{row.subnet}</TableCell>
                          <TableCell className="font-mono text-xs">{row.gateway}</TableCell>
                          <TableCell className="text-xs">{row.floor}</TableCell>
                        </TableRow>
                      ))}
                      {bulkPreview.length > 50 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-2">
                            … and {bulkPreview.length - 50} more rooms
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkGenerate} disabled={bulkPreview.length === 0 || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Zap className="h-4 w-4 mr-2" />
              Generate {bulkPreview.length} VLAN{bulkPreview.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          FIREWALL PREVIEW DIALOG
          ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={firewallOpen} onOpenChange={setFirewallOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              Firewall Rule Preview
            </DialogTitle>
            <DialogDescription>
              Generated nftables rules for room-VLAN isolation. Review before applying to the gateway.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Code block */}
            <div className="relative">
              <div className="absolute top-2 right-2 flex gap-1 z-10">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs bg-background/90 backdrop-blur"
                  onClick={handleCopyRules}
                >
                  <Copy className="h-3 w-3" />
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <pre className="bg-zinc-950 text-zinc-100 dark:bg-zinc-900 dark:text-zinc-100 rounded-lg p-4 pr-24 text-xs font-mono leading-relaxed overflow-auto max-h-[32rem] scrollbar-thin">
                {firewallRules}
              </pre>
            </div>

            <p className="text-xs text-muted-foreground">
              These rules isolate each room-VLAN from others while allowing essential services (DHCP, DNS, HTTP/HTTPS).
              Inter-room traffic is blocked at the firewall level.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFirewallOpen(false)}>Close</Button>
            <Button
              onClick={handleApplyRules}
              className="gap-2"
              disabled={roomVlans.filter((rv) => rv.status === 'active').length === 0}
            >
              <Shield className="h-4 w-4" />
              Apply Rules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          DELETE CONFIRMATION (inline in-card)
          ══════════════════════════════════════════════════════════════════════ */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteId(null)}>
          <Card className="w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                Delete Room VLAN
              </CardTitle>
              <CardDescription className="text-sm">
                Are you sure you want to delete this room-VLAN mapping? This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardFooter className="gap-2 pt-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleDelete}>
                Delete
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
