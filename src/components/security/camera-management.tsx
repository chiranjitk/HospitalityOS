'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Camera,
  CameraOff,
  Plus,
  Pencil,
  Trash2,
  Settings,
  Eye,
  RefreshCw,
  MapPin,
  Wifi,
  WifiOff,
  Radio,
  Shield,
  Play,
  Pause,
  Circle,
  AlertTriangle,
  Search,
  Loader2,
  MoreHorizontal,
  FolderOpen,
  Layers,
  CheckCircle2,
  XCircle,
  Info,
  VideoOff,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SectionGuard } from '@/components/common/section-guard';

// ============================================================
// Types
// ============================================================

interface Camera {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'maintenance';
  isRecording: boolean;
  streamUrl?: string;
  streamType: string;
  groupId?: string;
  groupName?: string | null;
  posX?: number;
  posY?: number;
  propertyId: string;
  propertyName?: string;
}

interface CameraGroup {
  id: string;
  name: string;
  description?: string | null;
  propertyId: string;
  propertyName?: string;
  cameraCount?: number;
}

interface Property {
  id: string;
  name: string;
}

interface CameraStats {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
  recording: number;
}

interface CameraFormData {
  name: string;
  location: string;
  propertyId: string;
  groupId: string;
  streamUrl: string;
  streamType: string;
  status: 'online' | 'offline' | 'maintenance';
  isRecording: boolean;
  posX?: number;
  posY?: number;
}

interface GroupFormData {
  name: string;
  description: string;
  propertyId: string;
}

// ============================================================
// Constants
// ============================================================

const STREAM_TYPES = [
  { value: 'rtsp', label: 'RTSP' },
  { value: 'rtmp', label: 'RTMP' },
  { value: 'hls', label: 'HLS' },
  { value: 'webrtc', label: 'WebRTC' },
  { value: 'onvif', label: 'ONVIF' },
] as const;

const STREAM_HELP_TEXT: Record<string, string> = {
  rtsp: 'Enter RTSP URL (e.g., rtsp://user:pass@192.168.1.100:554/stream1). Note: RTSP streams are converted to HLS via your media server (go2rtc/mediamtx).',
  rtmp: 'Enter RTMP push URL from your media server. Stream will be converted to HLS for playback.',
  hls: 'Enter direct HLS URL (e.g., http://your-server:8080/camera1/stream.m3u8). This is the preferred format for browser playback.',
  webrtc: 'Enter WebRTC signaling URL. Requires a WebRTC gateway (e.g., mediamtx).',
  onvif: 'Enter ONVIF discovery URL or camera IP. The system will use ONVIF Profile S for streaming. Note: ONVIF requires a media server proxy for browser playback.',
};

const EMPTY_CAMERA_FORM: CameraFormData = {
  name: '',
  location: '',
  propertyId: '',
  groupId: '',
  streamUrl: '',
  streamType: 'rtsp',
  status: 'online',
  isRecording: false,
  posX: undefined,
  posY: undefined,
};

const EMPTY_GROUP_FORM: GroupFormData = {
  name: '',
  description: '',
  propertyId: '',
};

// ============================================================
// Stream Test Player
// ============================================================

function StreamTestPlayer({ streamUrl, onStatus }: { streamUrl: string; onStatus: (ok: boolean) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<ReturnType<typeof Object> | null>(null);
  const nativeRef = useRef<{ loadedmetadata: (() => void) | null; error: (() => void) | null }>({
    loadedmetadata: null,
    error: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!videoRef.current || !streamUrl) return;
    let cancelled = false;

    const init = async () => {
      try {
        const Hls = (await import('hls.js')).default;

        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hlsRef.current = hls;
          hls.loadSource(streamUrl);
          hls.attachMedia(videoRef.current!);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled) return;
            setLoading(false);
            onStatus(true);
            videoRef.current?.play().catch(() => { /* autoplay blocked */ });
          });

          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) {
              if (!cancelled) { setLoading(false); onStatus(false); }
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
              else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
              else hls.destroy();
            }
          });
        } else if (videoRef.current!.canPlayType('application/vnd.apple.mpegurl')) {
          const handleMeta = () => { if (!cancelled) { setLoading(false); onStatus(true); } };
          const handleError = () => { if (!cancelled) { setLoading(false); onStatus(false); } };
          nativeRef.current = { loadedmetadata: handleMeta, error: handleError };
          videoRef.current!.addEventListener('loadedmetadata', handleMeta);
          videoRef.current!.addEventListener('error', handleError);
          videoRef.current!.src = streamUrl;
        }
      } catch {
        if (!cancelled) { setLoading(false); onStatus(false); }
      }
    };

    init();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        (hlsRef.current as unknown as { destroy: () => void }).destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        if (nativeRef.current.loadedmetadata) videoRef.current.removeEventListener('loadedmetadata', nativeRef.current.loadedmetadata);
        if (nativeRef.current.error) videoRef.current.removeEventListener('error', nativeRef.current.error);
        nativeRef.current = { loadedmetadata: null, error: null };
        videoRef.current.src = '';
      }
    };
  }, [streamUrl, onStatus]);

  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
      <video ref={videoRef} className="w-full h-full object-contain" muted autoPlay playsInline />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function CameraManagement() {
  // --- Data State ---
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [groups, setGroups] = useState<CameraGroup[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [stats, setStats] = useState<CameraStats>({ total: 0, online: 0, offline: 0, maintenance: 0, recording: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // --- Filter State ---
  const [filterProperty, setFilterProperty] = useState('all');
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchText, setSearchText] = useState('');

  // --- Camera Dialog State ---
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [cameraFormMode, setCameraFormMode] = useState<'create' | 'edit'>('create');
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null);
  const [cameraForm, setCameraForm] = useState<CameraFormData>(EMPTY_CAMERA_FORM);
  const [cameraSubmitting, setCameraSubmitting] = useState(false);

  // --- Group Dialog State ---
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupFormMode, setGroupFormMode] = useState<'create' | 'edit'>('create');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormData>(EMPTY_GROUP_FORM);
  const [groupSubmitting, setGroupSubmitting] = useState(false);

  // --- Delete Dialog ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'camera' | 'group'; id: string; name: string } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // --- Test Stream Dialog ---
  const [testStreamOpen, setTestStreamOpen] = useState(false);
  const [testStreamCamera, setTestStreamCamera] = useState<Camera | null>(null);
  const [testStreamStatus, setTestStreamStatus] = useState<'loading' | 'success' | 'fail'>('loading');

  // --- Grid View Dialog ---
  const [gridViewOpen, setGridViewOpen] = useState(false);
  const [gridCameras, setGridCameras] = useState<(string | null)[]>([null, null, null, null]);

  // ============================================================
  // Data fetching
  // ============================================================

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [camRes, grpRes] = await Promise.all([
        fetch('/api/security/cameras'),
        fetch('/api/security/camera-groups'),
      ]);
      const camData = await camRes.json();
      const grpData = await grpRes.json();

      if (camData.success) {
        setCameras(camData.data.cameras);
        setProperties(camData.data.properties);
        setStats(camData.data.stats);
      } else {
        toast.error('Failed to load cameras');
      }

      if (grpData.success) {
        setGroups(grpData.data.groups);
      } else {
        // Fallback: use groups from cameras response
        if (camData.success) setGroups(camData.data.groups || []);
      }
    } catch {
      toast.error('Failed to load camera data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
     
  }, []);

  // ============================================================
  // Filtering
  // ============================================================

  const filteredGroupsByProperty = filterProperty === 'all'
    ? groups
    : groups.filter(g => g.propertyId === filterProperty);

  const filteredCameras = cameras.filter(c => {
    if (filterProperty !== 'all' && c.propertyId !== filterProperty) return false;
    if (filterGroup !== 'all' && c.groupId !== filterGroup) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.location.toLowerCase().includes(q) || (c.propertyName || '').toLowerCase().includes(q);
    }
    return true;
  });

  // ============================================================
  // Camera CRUD handlers
  // ============================================================

  const openCreateCamera = () => {
    setCameraFormMode('create');
    setEditingCameraId(null);
    setCameraForm({ ...EMPTY_CAMERA_FORM, propertyId: properties[0]?.id || '' });
    setCameraDialogOpen(true);
  };

  const openEditCamera = (camera: Camera) => {
    setCameraFormMode('edit');
    setEditingCameraId(camera.id);
    setCameraForm({
      name: camera.name,
      location: camera.location || '',
      propertyId: camera.propertyId,
      groupId: camera.groupId || '',
      streamUrl: camera.streamUrl || '',
      streamType: camera.streamType || 'rtsp',
      status: camera.status,
      isRecording: camera.isRecording,
      posX: camera.posX,
      posY: camera.posY,
    });
    setCameraDialogOpen(true);
  };

  const handleSaveCamera = async () => {
    if (!cameraForm.name.trim()) { toast.error('Camera name is required'); return; }
    if (!cameraForm.propertyId) { toast.error('Property is required'); return; }

    setCameraSubmitting(true);
    try {
      const isEdit = cameraFormMode === 'edit';

      const body = isEdit
        ? {
            id: editingCameraId,
            name: cameraForm.name.trim(),
            location: cameraForm.location.trim() || '',
            status: cameraForm.status,
            isRecording: cameraForm.isRecording,
            groupId: cameraForm.groupId || null,
          }
        : {
            name: cameraForm.name.trim(),
            location: cameraForm.location.trim() || undefined,
            propertyId: cameraForm.propertyId,
            groupId: cameraForm.groupId || undefined,
            streamUrl: cameraForm.streamUrl.trim() || undefined,
            streamType: cameraForm.streamType,
          };

      const res = await fetch('/api/security/cameras', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(isEdit ? 'Camera updated' : 'Camera created');
        setCameraDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Operation failed');
      }
    } catch {
      toast.error('Failed to save camera');
    } finally {
      setCameraSubmitting(false);
    }
  };

  const toggleRecording = async (camera: Camera) => {
    try {
      const res = await fetch('/api/security/cameras', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: camera.id, isRecording: !camera.isRecording }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(camera.isRecording ? 'Recording stopped' : 'Recording started');
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to toggle recording');
      }
    } catch {
      toast.error('Failed to toggle recording');
    }
  };

  const confirmDeleteCamera = (camera: Camera) => {
    setDeleteTarget({ type: 'camera', id: camera.id, name: camera.name });
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      const endpoint = deleteTarget.type === 'camera'
        ? '/api/security/cameras'
        : '/api/security/camera-groups';
      const res = await fetch(`${endpoint}?id=${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(`${deleteTarget.type === 'camera' ? 'Camera' : 'Group'} deleted`);
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Delete failed');
      }
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ============================================================
  // Group CRUD handlers
  // ============================================================

  const openCreateGroup = () => {
    setGroupFormMode('create');
    setEditingGroupId(null);
    setGroupForm({ ...EMPTY_GROUP_FORM, propertyId: properties[0]?.id || '' });
    setGroupDialogOpen(true);
  };

  const openEditGroup = (group: CameraGroup) => {
    setGroupFormMode('edit');
    setEditingGroupId(group.id);
    setGroupForm({
      name: group.name,
      description: group.description || '',
      propertyId: group.propertyId,
    });
    setGroupDialogOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) { toast.error('Group name is required'); return; }
    if (!groupForm.propertyId) { toast.error('Property is required'); return; }

    setGroupSubmitting(true);
    try {
      const isEdit = groupFormMode === 'edit';
      const body = {
        ...(isEdit && { id: editingGroupId }),
        name: groupForm.name.trim(),
        description: groupForm.description.trim() || undefined,
        propertyId: groupForm.propertyId,
      };

      const res = await fetch('/api/security/camera-groups', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(isEdit ? 'Group updated' : 'Group created');
        setGroupDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Operation failed');
      }
    } catch {
      toast.error('Failed to save group');
    } finally {
      setGroupSubmitting(false);
    }
  };

  const confirmDeleteGroup = (group: CameraGroup) => {
    setDeleteTarget({ type: 'group', id: group.id, name: group.name });
    setDeleteDialogOpen(true);
  };

  // ============================================================
  // Test stream
  // ============================================================

  const openTestStream = (camera: Camera) => {
    setTestStreamCamera(camera);
    setTestStreamStatus('loading');
    setTestStreamOpen(true);
  };

  // ============================================================
  // Status badge helpers
  // ============================================================

  const statusBadge = (status: string) => {
    const cfg: Record<string, { cls: string; icon: React.ReactNode }> = {
      online: {
        cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        icon: <Wifi className="h-3 w-3 mr-1" />,
      },
      offline: {
        cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
        icon: <WifiOff className="h-3 w-3 mr-1" />,
      },
      maintenance: {
        cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
        icon: <AlertTriangle className="h-3 w-3 mr-1" />,
      },
    };
    const entry = cfg[status] || cfg.offline;
    return (
      <Badge variant="outline" className={cn('capitalize text-xs gap-0.5', entry.cls)}>
        {entry.icon}{status}
      </Badge>
    );
  };

  const streamTypeBadge = (type: string) => (
    <Badge variant="outline" className="bg-muted text-muted-foreground border border-border text-xs uppercase font-mono">
      {type}
    </Badge>
  );

  // Property-specific groups for camera form
  const groupsForCameraForm = cameraForm.propertyId
    ? groups.filter(g => g.propertyId === cameraForm.propertyId)
    : groups;

  // ============================================================
  // Render
  // ============================================================

  return (
    <SectionGuard permission="surveillance.manage">
      <div className="space-y-6">
        {/* ===== Header ===== */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Camera Management
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage surveillance cameras, groups, and stream configurations
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setGridCameras([null, null, null, null]); setGridViewOpen(true); }}>
              <LayoutGrid className="h-4 w-4 mr-2" />
              Grid View
            </Button>
            <Button onClick={fetchData} disabled={isLoading} variant="outline" size="sm">
              <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ===== Stats Cards ===== */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          {[
            { label: 'Total Cameras', value: stats.total, Icon: Camera, color: 'text-sky-500 dark:text-sky-400', bg: 'bg-sky-500/10' },
            { label: 'Online', value: stats.online, Icon: Wifi, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Offline', value: stats.offline, Icon: WifiOff, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-500/10' },
            { label: 'Recording', value: stats.recording, Icon: Radio, color: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-500/10' },
          ].map(({ label, value, Icon, color, bg }) => (
            <Card key={label} className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn('p-2.5 rounded-lg', bg)}>
                  <Icon className={cn('h-4 w-4', color)} />
                </div>
                <div>
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* ===== Tabs ===== */}
        <Tabs defaultValue="cameras" className="space-y-4">
          <TabsList>
            <TabsTrigger value="cameras" className="gap-1.5">
              <Camera className="h-4 w-4" /> Cameras
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-1.5">
              <Layers className="h-4 w-4" /> Groups
            </TabsTrigger>
          </TabsList>

          {/* ==================== Cameras Tab ==================== */}
          <TabsContent value="cameras" className="space-y-4">
            {/* Filter bar */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search cameras..."
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={filterProperty} onValueChange={v => { setFilterProperty(v); setFilterGroup('all'); }}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <BuildingIcon className="h-4 w-4 mr-1.5 text-muted-foreground" />
                      <SelectValue placeholder="All Properties" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterGroup} onValueChange={setFilterGroup}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <FolderOpen className="h-4 w-4 mr-1.5 text-muted-foreground" />
                      <SelectValue placeholder="All Groups" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Groups</SelectItem>
                      {filteredGroupsByProperty.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <Shield className="h-4 w-4 mr-1.5 text-muted-foreground" />
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={openCreateCamera}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Camera
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Camera table */}
            {isLoading ? (
              <Card>
                <CardContent className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded" />
                  ))}
                </CardContent>
              </Card>
            ) : filteredCameras.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground font-medium">No cameras found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {cameras.length === 0
                      ? 'Add your first camera to get started.'
                      : 'Try adjusting your filters.'}
                  </p>
                  {cameras.length === 0 && (
                    <Button className="mt-4" onClick={openCreateCamera}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Camera
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <div className="max-h-[600px] overflow-y-auto">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Name</TableHead>
                        <TableHead className="hidden md:table-cell">Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden sm:table-cell">Stream</TableHead>
                        <TableHead className="hidden lg:table-cell">Group</TableHead>
                        <TableHead className="hidden lg:table-cell">Property</TableHead>
                        <TableHead>Rec</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCameras.map(camera => (
                        <TableRow key={camera.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {camera.status === 'online'
                                ? <Camera className="h-4 w-4 text-emerald-500 shrink-0" />
                                : <CameraOff className="h-4 w-4 text-red-400 shrink-0" />}
                              <span className="font-medium truncate max-w-[200px]">{camera.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                            {camera.location || '—'}
                          </TableCell>
                          <TableCell>{statusBadge(camera.status)}</TableCell>
                          <TableCell className="hidden sm:table-cell">{streamTypeBadge(camera.streamType)}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {camera.groupName
                              ? <Badge variant="secondary" className="text-xs">{camera.groupName}</Badge>
                              : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {camera.propertyName || '—'}
                          </TableCell>
                          <TableCell>
                            {camera.isRecording && (
                              <div className="flex items-center gap-1">
                                <Circle className="h-2.5 w-2.5 fill-red-500 text-red-500 animate-pulse" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditCamera(camera)}>
                                  <Pencil className="h-4 w-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleRecording(camera)}>
                                  {camera.isRecording
                                    ? <><Pause className="h-4 w-4 mr-2" /> Stop Recording</>
                                    : <><Play className="h-4 w-4 mr-2" /> Start Recording</>}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openTestStream(camera)} disabled={!camera.streamUrl}>
                                  <Eye className="h-4 w-4 mr-2" /> Test Stream
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => confirmDeleteCamera(camera)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ==================== Groups Tab ==================== */}
          <TabsContent value="groups" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {groups.length} group{groups.length !== 1 ? 's' : ''} configured
              </p>
              <Button size="sm" onClick={openCreateGroup}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Group
              </Button>
            </div>

            {isLoading ? (
              <Card>
                <CardContent className="p-4 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded" />
                  ))}
                </CardContent>
              </Card>
            ) : groups.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground font-medium">No groups configured</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Organize your cameras into groups for easier management.
                  </p>
                  <Button className="mt-4" onClick={openCreateGroup}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Group
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map(group => {
                  const camCount = cameras.filter(c => c.groupId === group.id).length;
                  return (
                    <Card key={group.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate">{group.name}</span>
                          </div>
                          {group.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 pl-6">{group.description}</p>
                          )}
                          <div className="flex items-center gap-3 pl-6 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Camera className="h-3 w-3" />
                              {camCount} camera{camCount !== 1 ? 's' : ''}
                            </span>
                            {group.propertyName && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {group.propertyName}
                              </span>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditGroup(group)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => confirmDeleteGroup(group)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ============================================================ */}
        {/* Camera Add/Edit Dialog                                         */}
        {/* ============================================================ */}
        <Dialog open={cameraDialogOpen} onOpenChange={setCameraDialogOpen}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {cameraFormMode === 'create' ? (
                  <span className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add Camera</span>
                ) : (
                  <span className="flex items-center gap-2"><Pencil className="h-5 w-5" /> Edit Camera</span>
                )}
              </DialogTitle>
              <DialogDescription>
                {cameraFormMode === 'create'
                  ? 'Configure a new surveillance camera for your property.'
                  : 'Update the camera configuration.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="cam-name">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="cam-name"
                  placeholder="e.g. Lobby Entrance"
                  value={cameraForm.name}
                  onChange={e => setCameraForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="cam-location">Location</Label>
                <Input
                  id="cam-location"
                  placeholder="e.g. Main Lobby, Floor 1"
                  value={cameraForm.location}
                  onChange={e => setCameraForm(f => ({ ...f, location: e.target.value }))}
                />
              </div>

              {/* Property */}
              <div className="space-y-2">
                <Label>Property <span className="text-destructive">*</span></Label>
                <Select
                  value={cameraForm.propertyId}
                  onValueChange={v => setCameraForm(f => ({ ...f, propertyId: v, groupId: '' }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Group */}
              <div className="space-y-2">
                <Label>Camera Group</Label>
                <Select
                  value={cameraForm.groupId || '__none__'}
                  onValueChange={v => setCameraForm(f => ({ ...f, groupId: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="No group" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No Group</SelectItem>
                    {groupsForCameraForm.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Stream Type (only for create) */}
              {cameraFormMode === 'create' && (
                <div className="space-y-2">
                  <Label>Stream Type <span className="text-destructive">*</span></Label>
                  <Select
                    value={cameraForm.streamType}
                    onValueChange={v => setCameraForm(f => ({ ...f, streamType: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STREAM_TYPES.map(st => (
                        <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {STREAM_HELP_TEXT[cameraForm.streamType] && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5 mt-1">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {STREAM_HELP_TEXT[cameraForm.streamType]}
                    </p>
                  )}
                </div>
              )}

              {/* Stream URL (only for create) */}
              {cameraFormMode === 'create' && (
                <div className="space-y-2">
                  <Label htmlFor="cam-stream-url">Stream URL</Label>
                  <Input
                    id="cam-stream-url"
                    placeholder={
                      cameraForm.streamType === 'rtsp'
                        ? 'rtsp://user:pass@192.168.1.100:554/stream1'
                        : cameraForm.streamType === 'hls'
                          ? 'http://server:8080/camera1/stream.m3u8'
                          : 'Enter stream URL...'
                    }
                    value={cameraForm.streamUrl}
                    onChange={e => setCameraForm(f => ({ ...f, streamUrl: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
              )}

              <Separator />

              {/* Status (only for edit) */}
              {cameraFormMode === 'edit' && (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={cameraForm.status}
                    onValueChange={v => setCameraForm(f => ({ ...f, status: v as CameraFormData['status'] }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Recording toggle (only for edit) */}
              {cameraFormMode === 'edit' && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label>Recording</Label>
                    <p className="text-xs text-muted-foreground">Toggle continuous recording for this camera</p>
                  </div>
                  <Switch
                    checked={cameraForm.isRecording}
                    onCheckedChange={v => setCameraForm(f => ({ ...f, isRecording: v }))}
                  />
                </div>
              )}

              {/* Position (optional, both modes) */}
              <div className="space-y-2">
                <Label>Map Position <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Pos X</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={cameraForm.posX ?? ''}
                      onChange={e => setCameraForm(f => ({
                        ...f,
                        posX: e.target.value ? Number(e.target.value) : undefined,
                      }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Pos Y</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={cameraForm.posY ?? ''}
                      onChange={e => setCameraForm(f => ({
                        ...f,
                        posY: e.target.value ? Number(e.target.value) : undefined,
                      }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCameraDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveCamera} disabled={cameraSubmitting}>
                {cameraSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {cameraFormMode === 'create' ? 'Create Camera' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============================================================ */}
        {/* Group Add/Edit Dialog                                          */}
        {/* ============================================================ */}
        <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>
                {groupFormMode === 'create' ? (
                  <span className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add Camera Group</span>
                ) : (
                  <span className="flex items-center gap-2"><Pencil className="h-5 w-5" /> Edit Camera Group</span>
                )}
              </DialogTitle>
              <DialogDescription>
                {groupFormMode === 'create'
                  ? 'Create a group to organize your cameras.'
                  : 'Update the camera group details.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="grp-name">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="grp-name"
                  placeholder="e.g. Entrance Cameras"
                  value={groupForm.name}
                  onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="grp-desc">Description</Label>
                <Input
                  id="grp-desc"
                  placeholder="Optional description"
                  value={groupForm.description}
                  onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Property <span className="text-destructive">*</span></Label>
                <Select
                  value={groupForm.propertyId}
                  onValueChange={v => setGroupForm(f => ({ ...f, propertyId: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveGroup} disabled={groupSubmitting}>
                {groupSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {groupFormMode === 'create' ? 'Create Group' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============================================================ */}
        {/* Delete Confirmation Dialog                                     */}
        {/* ============================================================ */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirm Deletion
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
                {deleteTarget?.type === 'group' && (
                  <span className="block mt-1 text-amber-600 dark:text-amber-400">
                    Cameras in this group will become unassigned.
                  </span>
                )}
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteSubmitting}>
                {deleteSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============================================================ */}
        {/* Test Stream Dialog                                             */}
        {/* ============================================================ */}
        <Dialog open={testStreamOpen} onOpenChange={setTestStreamOpen}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[640px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Test Stream — {testStreamCamera?.name}
              </DialogTitle>
              <DialogDescription>
                Verifying connectivity to the camera stream.
              </DialogDescription>
            </DialogHeader>

            {testStreamCamera?.streamUrl ? (
              <div className="space-y-4">
                <StreamTestPlayer
                  streamUrl={testStreamCamera.streamUrl}
                  onStatus={ok => setTestStreamStatus(ok ? 'success' : 'fail')}
                />
                <div className="flex items-center gap-2 text-sm">
                  {testStreamStatus === 'loading' && (
                    <Badge variant="secondary" className="gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Connecting...
                    </Badge>
                  )}
                  {testStreamStatus === 'success' && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Stream Connected
                    </Badge>
                  )}
                  {testStreamStatus === 'fail' && (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" /> Stream Unavailable
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground font-mono truncate max-w-[400px]">
                    {testStreamCamera.streamUrl}
                  </span>
                </div>
                {testStreamStatus === 'fail' && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-300">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">Stream connection failed</p>
                        <p className="text-xs mt-1">
                          Possible causes: incorrect URL, network restrictions, media server not running, or camera is offline.
                          Verify the stream URL and ensure your media server is accessible.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <VideoOff className="h-10 w-10 mx-auto mb-2" />
                <p>No stream URL configured for this camera.</p>
                <p className="text-sm mt-1">Edit the camera to add a stream URL.</p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setTestStreamOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* ============================================================ */}
        {/* Grid View Dialog                                               */}
        {/* ============================================================ */}
        <Dialog open={gridViewOpen} onOpenChange={setGridViewOpen}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5" />
                Camera Grid View
              </DialogTitle>
              <DialogDescription>
                Monitor up to 4 camera streams simultaneously.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gridCameras.map((camId, idx) => {
                const selectedCamera = camId ? cameras.find(c => c.id === camId) : null;
                const onlineCameras = cameras.filter(c => c.status === 'online' && c.streamUrl);
                return (
                  <div key={idx} className="relative bg-black rounded-lg overflow-hidden min-h-[200px]">
                    {/* Camera selector dropdown */}
                    <div className="absolute top-2 left-2 right-2 z-10">
                      <Select
                        value={camId || '__none__'}
                        onValueChange={v => setGridCameras(prev => {
                          const next = [...prev];
                          next[idx] = v === '__none__' ? null : v;
                          return next;
                        })}
                      >
                        <SelectTrigger className="h-7 text-xs bg-black/70 text-white border-white/20 backdrop-blur-sm">
                          <SelectValue placeholder="Select camera" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No camera</SelectItem>
                          {onlineCameras.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Video player */}
                    {selectedCamera?.streamUrl ? (
                      <StreamTestPlayer
                        streamUrl={selectedCamera.streamUrl}
                        onStatus={() => {}}
                      />
                    ) : (
                      <div className="aspect-video flex items-center justify-center">
                        <VideoOff className="h-8 w-8 text-white/30" />
                      </div>
                    )}

                    {/* Camera name overlay */}
                    {selectedCamera && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-1.5">
                        <span className="text-xs text-white font-medium truncate block">
                          {selectedCamera.name}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setGridViewOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SectionGuard>
  );
}

// ============================================================
// Inline SVG icon for building (property) selector
// ============================================================

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" />
      <path d="M12 10h.01" /><path d="M12 14h.01" />
      <path d="M16 10h.01" /><path d="M16 14h.01" />
      <path d="M8 10h.01" /><path d="M8 14h.01" />
    </svg>
  );
}
