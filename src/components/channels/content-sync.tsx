'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Image as ImageIcon,
  RefreshCw,
  Play,
  Eye,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Globe,
  FileText,
  Hotel,
  Camera,
  Shield,
  MapPin,
  Layers,
  Filter,
  Search,
  Info,
  ToggleLeft,
  ArrowUpDown,
  History,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface SyncRecord {
  id: string;
  tenantId: string;
  propertyId: string | null;
  connectionId: string | null;
  contentType: string;
  syncType: string;
  status: string;
  totalItems: number;
  syncedItems: number;
  failedItems: number;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  connectionDisplayName: string | null;
  connectionChannel: string | null;
}

interface ContentField {
  id?: string;
  fieldType: string;
  label?: string;
  sourceValue: string | null;
  mappedValue: string | null;
  syncEnabled: boolean;
  syncStatus: string;
  lastSyncedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ChannelConnection {
  id: string;
  channel: string;
  displayName: string | null;
  status: string;
}

interface SyncStats {
  totalSyncs: number;
  completedSyncs: number;
  failedSyncs: number;
  fieldsMapped: number;
}

interface PreviewData {
  fields: ContentField[];
  property: { id: string; name: string } | null;
  message?: string;
}

// ============================================
// CONSTANTS
// ============================================

const CURRENT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const CONTENT_TYPES = [
  { value: 'hotel_info', label: 'Hotel Info', icon: Hotel },
  { value: 'photos', label: 'Photos', icon: Camera },
  { value: 'amenities', label: 'Amenities', icon: Layers },
  { value: 'facilities', label: 'Facilities', icon: Layers },
  { value: 'policies', label: 'Policies', icon: Shield },
  { value: 'descriptions', label: 'Descriptions', icon: FileText },
  { value: 'area_info', label: 'Area Info', icon: MapPin },
];

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  completed: { className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0', label: 'Completed' },
  processing: { className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0', label: 'Processing' },
  pending: { className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0', label: 'Pending' },
  failed: { className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0', label: 'Failed' },
  partial: { className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0', label: 'Partial' },
  synced: { className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0', label: 'Synced' },
  skipped: { className: 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400 border-0', label: 'Skipped' },
};

const SYNC_STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  completed: CheckCircle2,
  processing: Loader2,
  pending: Clock,
  failed: XCircle,
  partial: AlertCircle,
};

// ============================================
// COMPONENT
// ============================================

export function ContentSync() {
  // Data
  const [syncHistory, setSyncHistory] = useState<SyncRecord[]>([]);
  const [contentFields, setContentFields] = useState<ContentField[]>([]);
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterConnection, setFilterConnection] = useState<string>('all');
  const [filterContentType, setFilterContentType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Sync action
  const [syncing, setSyncing] = useState(false);
  const [syncingContentType, setSyncingContentType] = useState<string | null>(null);

  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<SyncRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Active content type tab
  const [activeContentType, setActiveContentType] = useState<string>('all');

  // ============================================
  // FETCH DATA
  // ============================================
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tenantId: 'current' });

      const [syncRes, statsRes, fieldsRes, connRes] = await Promise.all([
        fetch(`/api/channels/content-sync?${params}`),
        fetch(`/api/channels/content-sync?${params}&include=stats`),
        fetch(`/api/channels/content-sync?${params}&include=fields`),
        fetch(`/api/channels/connections?tenantId=${'current'}`),
      ]);

      const [syncData, statsData, fieldsData, connData] = await Promise.all([
        syncRes.json(),
        statsRes.json(),
        fieldsRes.json(),
        connRes.json(),
      ]);

      if (syncData.success) setSyncHistory(syncData.data || []);
      if (statsData.success) setStats(statsData.data);
      if (fieldsData.success) setContentFields(fieldsData.data || []);
      if (connData.success) {
        const connList = connData.data?.connections || connData.data || [];
        setConnections(Array.isArray(connList) ? connList : []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load content sync data');
    } finally {
      setLoading(false);
    }
  }, []);

  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    fetchAllData();
  });

  // ============================================
  // SYNC ACTION
  // ============================================
  const handleSync = async (contentType: string, connectionId?: string) => {
    setSyncing(true);
    setSyncingContentType(contentType);
    try {
      const res = await fetch('/api/channels/content-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          tenantId: 'current',
          connectionId: connectionId || null,
          contentTypes: [contentType],
          syncType: 'full',
        }),
      });

      const data = await res.json();

      if (data.success) {
        const results = data.data || [];
        const completed = results.filter((r: SyncRecord) => r.status === 'completed').length;
        const failed = results.filter((r: SyncRecord) => r.status === 'failed').length;

        if (failed > 0) {
          toast.warning(`Sync completed with ${failed} failure(s) and ${completed} success(es)`);
        } else {
          toast.success(`Content sync completed successfully for ${contentType}`);
        }
        fetchAllData();
      } else {
        toast.error(data.error?.message || 'Sync failed');
      }
    } catch {
      toast.error('Network error during sync');
    } finally {
      setSyncing(false);
      setSyncingContentType(null);
    }
  };

  // ============================================
  // PREVIEW ACTION
  // ============================================
  const handlePreview = async (contentType: string) => {
    setPreviewLoading(true);
    setPreviewOpen(true);
    setPreviewData(null);
    try {
      const res = await fetch('/api/channels/content-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          tenantId: 'current',
          connectionId: filterConnection !== 'all' ? filterConnection : null,
          contentType,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPreviewData(data.data);
      } else {
        toast.error(data.error?.message || 'Preview failed');
        setPreviewOpen(false);
      }
    } catch {
      toast.error('Network error during preview');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // ============================================
  // UPDATE FIELD
  // ============================================
  const handleToggleField = async (field: ContentField) => {
    try {
      const res = await fetch('/api/channels/content-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-field',
          tenantId: 'current',
          connectionId: filterConnection !== 'all' ? filterConnection : null,
          fieldId: field.id || null,
          fieldType: field.fieldType,
          syncEnabled: !field.syncEnabled,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setContentFields(prev =>
          prev.map(f => f.fieldType === field.fieldType ? { ...f, syncEnabled: !f.syncEnabled } : f)
        );
        toast.success(`Field ${field.label || field.fieldType} ${!field.syncEnabled ? 'enabled' : 'disabled'}`);
      } else {
        toast.error(data.error?.message || 'Update failed');
      }
    } catch {
      toast.error('Network error');
    }
  };

  // ============================================
  // DELETE RECORD
  // ============================================
  const handleDelete = async () => {
    if (!deletingRecord) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/channels/content-sync', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingRecord.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Sync record deleted');
        setDeleteDialogOpen(false);
        setDeletingRecord(null);
        fetchAllData();
      } else {
        toast.error(data.error?.message || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(false);
    }
  };

  // ============================================
  // FILTERED DATA
  // ============================================
  const filteredHistory = syncHistory.filter(record => {
    if (filterConnection !== 'all' && record.connectionId !== filterConnection) return false;
    if (filterContentType !== 'all' && record.contentType !== filterContentType) return false;
    if (filterStatus !== 'all' && record.status !== filterStatus) return false;
    return true;
  });

  const contentTypeLabel = (ct: string) =>
    CONTENT_TYPES.find(c => c.value === ct)?.label || ct;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-72 rounded" />
            <Skeleton className="h-4 w-96 mt-2 rounded" />
          </div>
          <Skeleton className="h-10 w-32 rounded" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-primary" />
            Content Sync
          </h1>
          <p className="text-muted-foreground mt-1">
            Push property content (photos, descriptions, amenities, policies) to connected OTA channels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchAllData} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <History className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{stats?.totalSyncs ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total Syncs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {stats?.completedSyncs ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400 tabular-nums">
                  {stats?.failedSyncs ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <ToggleLeft className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-700 dark:text-violet-400 tabular-nums">
                  {stats?.fieldsMapped ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Fields Mapped</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Type Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Content Types
          </CardTitle>
          <CardDescription className="text-xs">
            Select a content type to sync or preview
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map(ct => {
              const Icon = ct.icon;
              const isSyncing = syncing && syncingContentType === ct.value;
              return (
                <div key={ct.value} className="flex items-center gap-1">
                  <Button
                    variant={activeContentType === ct.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveContentType(ct.value)}
                    className="gap-1.5"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {ct.label}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSync(ct.value)}
                    disabled={syncing}
                    className="h-8 w-8 p-0"
                    title={`Sync ${ct.label}`}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePreview(ct.value)}
                    disabled={syncing}
                    className="h-8 w-8 p-0"
                    title={`Preview ${ct.label}`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Channel Connection
              </Label>
              <Select value={filterConnection} onValueChange={setFilterConnection}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  {connections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.displayName || conn.channel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-[150px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Content Type
              </Label>
              <Select value={filterContentType} onValueChange={setFilterContentType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {CONTENT_TYPES.map(ct => (
                    <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-[140px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground self-center">
              {filteredHistory.length} of {syncHistory.length} records
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync History Table */}
      {filteredHistory.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Date</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Content Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items Synced</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((record) => {
                    const statusBadge = STATUS_BADGE[record.status] || STATUS_BADGE.pending;
                    const StatusIcon = SYNC_STATUS_ICON[record.status] || Clock;
                    return (
                      <TableRow key={record.id}>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(record.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {record.connectionChannel ? (
                            <Badge variant="secondary" className="text-xs">
                              {record.connectionChannel}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">All</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-medium">
                            {contentTypeLabel(record.contentType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusBadge.className} gap-1 text-xs`}>
                            <StatusIcon className={`h-3 w-3 ${record.status === 'processing' ? 'animate-spin' : ''}`} />
                            {statusBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{record.syncedItems}</span>
                            <span className="text-muted-foreground">/{record.totalItems}</span>
                            {record.failedItems > 0 && (
                              <span className="text-red-500 ml-1">({record.failedItems} failed)</span>
                            )}
                            {record.contentType === 'photos' && record.totalItems > 0 && (
                              <span className="text-muted-foreground ml-1">photos</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(record.lastSyncAt)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingRecord(record);
                                setDeleteDialogOpen(true);
                              }}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Search className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Sync History</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              {syncHistory.length > 0
                ? 'No records match the current filters. Try adjusting your criteria.'
                : 'Start by selecting a content type above and clicking the play button to sync your property content to connected channels.'}
            </p>
            {syncHistory.length === 0 && (
              <Button
                onClick={() => handleSync('hotel_info')}
                disabled={syncing}
                size="sm"
              >
                {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Sync All Content
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Content Field Mapping Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            Content Field Mapping
          </CardTitle>
          <CardDescription className="text-xs">
            Manage which content fields are synced to channels. Toggle fields on/off to control what gets pushed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contentFields.length > 0 ? (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Value Preview</TableHead>
                    <TableHead>Last Synced</TableHead>
                    <TableHead className="text-center">Sync Enabled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contentFields.map((field) => {
                    const statusBadge = STATUS_BADGE[field.syncStatus] || STATUS_BADGE.pending;
                    return (
                      <TableRow key={field.id || field.fieldType}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {contentTypeLabel(field.fieldType)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusBadge.className} text-xs`}>
                            {statusBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                            {field.mappedValue || field.sourceValue || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(field.lastSyncedAt)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={field.syncEnabled}
                            onCheckedChange={() => handleToggleField(field)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-3 rounded-full bg-muted mb-3">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                No field mappings yet. Sync a content type to create field mappings automatically.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">How Content Sync Works</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>Hotel Info:</strong> Name, description, and contact details</li>
                <li><strong>Photos:</strong> Hotel and room photos pushed to channel galleries</li>
                <li><strong>Amenities &amp; Facilities:</strong> Property amenities and room facilities</li>
                <li><strong>Policies:</strong> Cancellation, check-in, and property policies</li>
                <li><strong>Descriptions:</strong> Full property and room type descriptions</li>
                <li><strong>Area Info:</strong> Local attractions and area information</li>
              </ul>
              <p className="text-xs">
                Use the preview button before syncing to verify what content will be pushed. Toggle individual fields to control sync granularity.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Content Sync Preview
            </DialogTitle>
            <DialogDescription>
              Review what content will be synced to the selected channel
            </DialogDescription>
          </DialogHeader>

          {previewLoading ? (
            <div className="space-y-4 py-8">
              <Skeleton className="h-6 w-64 rounded" />
              <Skeleton className="h-4 w-96 rounded" />
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-6 w-20 rounded" />
                </div>
              ))}
            </div>
          ) : previewData ? (
            <div className="space-y-4">
              {previewData.message ? (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-400">{previewData.message}</p>
                </div>
              ) : (
                <>
                  {previewData.property && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground">Property</p>
                      <p className="text-sm font-medium">{previewData.property.name}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Fields to Sync ({previewData.fields.filter(f => f.syncEnabled).length} of {previewData.fields.length})
                    </p>

                    {previewData.fields.map((field, idx) => (
                      <div
                        key={`${field.fieldType}-${idx}`}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          field.syncEnabled
                            ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                            : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded ${
                            field.syncEnabled
                              ? 'bg-emerald-100 dark:bg-emerald-900/30'
                              : 'bg-gray-100 dark:bg-gray-800'
                          }`}>
                            {field.syncEnabled ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <XCircle className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {field.label || contentTypeLabel(field.fieldType)}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[400px]">
                              {field.sourceValue
                                ? field.sourceValue.length > 80
                                  ? `${field.sourceValue.substring(0, 80)}...`
                                  : field.sourceValue
                                : 'No content available'}
                            </p>
                          </div>
                        </div>
                        <Badge className={`${STATUS_BADGE[field.syncStatus]?.className || ''} text-xs shrink-0 ml-2`}>
                          {STATUS_BADGE[field.syncStatus]?.label || field.syncStatus}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Sync Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this sync history record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingRecord && (
            <div className="p-3 rounded-lg bg-muted border text-sm space-y-1">
              <p><span className="font-medium">Content Type:</span> {contentTypeLabel(deletingRecord.contentType)}</p>
              <p><span className="font-medium">Channel:</span> {deletingRecord.connectionChannel || 'All'}</p>
              <p><span className="font-medium">Date:</span> {formatDate(deletingRecord.createdAt)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
