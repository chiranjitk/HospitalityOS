'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Check,
  X,
  Plug,
  Unplug,
  TestTube,
  RefreshCw,
  Settings,
  Wifi,
  Share2,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConnectionItem {
  id: string;
  platform: string;
  propertyId?: string | null;
  status: string;
  accountId?: string | null;
  pixelId?: string | null;
  hasCredentials: boolean;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  connectionMode?: string;
  totalBookings?: number;
  totalRevenue?: number;
  createdAt: string;
  updatedAt: string;
}

interface ConnectionsData {
  connections: ConnectionItem[];
}

interface TestResult {
  platform: string;
  healthy: boolean;
  error: string | null;
}

interface GoogleFormState {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string;
  accountId: string;
}

interface MetaFormState {
  appId: string;
  appSecret: string;
  accessToken: string;
  accountId: string;
  pixelId: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AdPlatformConnections() {
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testingPlatform, setTestingPlatform] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Dialogs
  const [googleDialogOpen, setGoogleDialogOpen] = useState(false);
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  // Google form
  const [googleForm, setGoogleForm] = useState<GoogleFormState>({
    developerToken: '',
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    customerId: '',
    accountId: '',
  });

  // Meta form
  const [metaForm, setMetaForm] = useState<MetaFormState>({
    appId: '',
    appSecret: '',
    accessToken: '',
    accountId: '',
    pixelId: '',
  });

  const fetchConnections = useCallback(async () => {
    try {
      const response = await fetch('/api/ads/connections');
      const data = await response.json();
      if (data.success) {
        setConnections((data.data as ConnectionsData).connections);
      }
    } catch {
      toast.error('Failed to load ad platform connections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleTestConnection = useCallback(async (platform: string, id: string) => {
    setTestingId(id);
    setTestingPlatform(platform);

    try {
      const response = await fetch('/api/ads/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, id }),
      });

      const data = await response.json();
      if (data.success) {
        const result = data.data as TestResult;
        if (result.healthy) {
          toast.success(`${platform === 'google' ? 'Google Ads' : 'Meta Ads'} connection is healthy`);
        } else {
          toast.error(`Connection failed: ${result.error || 'Unknown error'}`);
        }
        fetchConnections();
      } else {
        toast.error(data.error?.message || 'Connection test failed');
      }
    } catch {
      toast.error('Connection test failed');
    } finally {
      setTestingId(null);
      setTestingPlatform(null);
    }
  }, []);

  const handleDisconnect = useCallback(async (platform: string, id: string) => {
    try {
      const response = await fetch(`/api/ads/connections?platform=${platform}&id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`${platform === 'google' ? 'Google Ads' : 'Meta Ads'} connection revoked`);
        fetchConnections();
      } else {
        toast.error(data.error?.message || 'Failed to disconnect');
      }
    } catch {
      toast.error('Failed to disconnect');
    }
  }, []);

  const handleSaveGoogle = async () => {
    try {
      const response = await fetch('/api/ads/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'google',
          propertyId: selectedPropertyId,
          ...googleForm,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Google Ads connection saved');
        setGoogleDialogOpen(false);
        resetGoogleForm();
        fetchConnections();
      } else {
        toast.error(data.error?.message || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save Google Ads connection');
    }
  };

  const handleSaveMeta = async () => {
    try {
      const response = await fetch('/api/ads/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'meta',
          propertyId: selectedPropertyId || undefined,
          ...metaForm,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Meta Ads connection saved');
        setMetaDialogOpen(false);
        resetMetaForm();
        fetchConnections();
      } else {
        toast.error(data.error?.message || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save Meta Ads connection');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/ads/sync', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        const { results } = data.data;
        for (const r of results) {
          toast.success(`${r.platform}: synced ${r.synced} campaigns`);
          for (const e of r.errors) {
            toast.error(e);
          }
        }
        fetchConnections();
      } else {
        toast.error(data.error?.message || 'Sync failed');
      }
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const resetGoogleForm = () => {
    setGoogleForm({
      developerToken: '',
      clientId: '',
      clientSecret: '',
      refreshToken: '',
      customerId: '',
      accountId: '',
    });
    setEditingId(null);
    setSelectedPropertyId('');
  };

  const resetMetaForm = () => {
    setMetaForm({
      appId: '',
      appSecret: '',
      accessToken: '',
      accountId: '',
      pixelId: '',
    });
    setEditingId(null);
    setSelectedPropertyId('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white"><Check className="h-3 w-3 mr-1" />Connected</Badge>;
      case 'error':
        return <Badge className="bg-red-500 hover:bg-red-600 text-white"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      case 'disconnected':
        return <Badge variant="outline"><X className="h-3 w-3 mr-1" />Disconnected</Badge>;
      default:
        return <Badge variant="secondary"><Settings className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'google':
        return (
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Wifi className="h-6 w-6 text-white" />
          </div>
        );
      case 'meta':
        return (
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-400 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Share2 className="h-6 w-6 text-white" />
          </div>
        );
      default:
        return (
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-gray-500 to-gray-400 flex items-center justify-center shadow-lg shadow-gray-500/20">
            <Plug className="h-6 w-6 text-white" />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const googleConnections = connections.filter((c) => c.platform === 'google');
  const metaConnections = connections.filter((c) => c.platform === 'meta');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ad Platform Connections</h2>
          <p className="text-muted-foreground">Connect and manage Google Ads and Meta Ads API integrations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync All
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription>Google Ads</CardDescription>
            <CardTitle className="text-2xl">{googleConnections.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {googleConnections.filter((c) => c.status === 'connected').length} connected
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription>Meta Ads</CardDescription>
            <CardTitle className="text-2xl">{metaConnections.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {metaConnections.filter((c) => c.status === 'connected').length} connected
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Platforms</CardDescription>
            <CardTitle className="text-2xl">{connections.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {connections.filter((c) => c.status === 'connected').length} active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Connection Cards */}
      <div className="grid gap-6">
        {/* ─── Google Ads Section ────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getPlatformIcon('google')}
                <div>
                  <CardTitle className="text-lg">Google Ads</CardTitle>
                  <CardDescription>Search, Display & Hotel campaigns</CardDescription>
                </div>
              </div>
              <Dialog open={googleDialogOpen} onOpenChange={(open) => { setGoogleDialogOpen(open); if (!open) resetGoogleForm(); }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plug className="h-4 w-4 mr-2" />
                    Connect Google Ads
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Connect Google Ads</DialogTitle>
                    <DialogDescription>
                      Enter your Google Ads API credentials. All secrets are encrypted at rest.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Property ID <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="Property to link this connection to"
                        value={selectedPropertyId}
                        onChange={(e) => setSelectedPropertyId(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Developer Token <span className="text-red-500">*</span></Label>
                        <Input
                          type="password"
                          placeholder="xxxxxxxxxx"
                          value={googleForm.developerToken}
                          onChange={(e) => setGoogleForm({ ...googleForm, developerToken: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Client ID</Label>
                        <Input
                          placeholder="xxxx.apps.googleusercontent.com"
                          value={googleForm.clientId}
                          onChange={(e) => setGoogleForm({ ...googleForm, clientId: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Client Secret <span className="text-red-500">*</span></Label>
                        <Input
                          type="password"
                          placeholder="GOCSPX-xxxx"
                          value={googleForm.clientSecret}
                          onChange={(e) => setGoogleForm({ ...googleForm, clientSecret: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Refresh Token <span className="text-red-500">*</span></Label>
                        <Input
                          type="password"
                          placeholder="1//0xxxx"
                          value={googleForm.refreshToken}
                          onChange={(e) => setGoogleForm({ ...googleForm, refreshToken: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Customer ID <span className="text-red-500">*</span></Label>
                        <Input
                          placeholder="123-456-7890"
                          value={googleForm.customerId}
                          onChange={(e) => setGoogleForm({ ...googleForm, customerId: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Account ID</Label>
                        <Input
                          placeholder="(same as customer ID)"
                          value={googleForm.accountId}
                          onChange={(e) => setGoogleForm({ ...googleForm, accountId: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                      <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        All credentials are encrypted using AES-256-GCM before storage.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setGoogleDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveGoogle} disabled={!googleForm.developerToken || !googleForm.clientSecret || !googleForm.refreshToken || !googleForm.customerId || !selectedPropertyId}>
                      Save Connection
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {googleConnections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wifi className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No Google Ads connections configured</p>
              </div>
            ) : (
              <div className="space-y-3">
                {googleConnections.map((conn) => (
                  <div key={conn.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-sm">Account: {conn.accountId || 'Not set'}</p>
                        <p className="text-xs text-muted-foreground">
                          {conn.propertyId ? `Property: ${conn.propertyId.slice(0, 8)}…` : 'No property linked'}
                          {conn.connectionMode ? ` · Mode: ${conn.connectionMode}` : ''}
                        </p>
                        {conn.lastSyncedAt && (
                          <p className="text-xs text-muted-foreground">
                            Last synced: {format(new Date(conn.lastSyncedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                        )}
                        {conn.lastError && (
                          <p className="text-xs text-red-500 mt-0.5">{conn.lastError}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(conn.status)}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection('google', conn.id)}
                        disabled={testingId === conn.id}
                      >
                        {testingId === conn.id && testingPlatform === 'google' ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <TestTube className="h-3 w-3 mr-1" />
                        )}
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 dark:text-red-400"
                        onClick={() => handleDisconnect('google', conn.id)}
                      >
                        <Unplug className="h-3 w-3 mr-1" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Meta Ads Section ──────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getPlatformIcon('meta')}
                <div>
                  <CardTitle className="text-lg">Meta Ads</CardTitle>
                  <CardDescription>Facebook & Instagram campaigns</CardDescription>
                </div>
              </div>
              <Dialog open={metaDialogOpen} onOpenChange={(open) => { setMetaDialogOpen(open); if (!open) resetMetaForm(); }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plug className="h-4 w-4 mr-2" />
                    Connect Meta Ads
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Connect Meta Ads</DialogTitle>
                    <DialogDescription>
                      Enter your Meta Marketing API credentials. All secrets are encrypted at rest.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Property ID <span className="text-muted-foreground">(optional)</span></Label>
                      <Input
                        placeholder="Link to a specific property (optional)"
                        value={selectedPropertyId}
                        onChange={(e) => setSelectedPropertyId(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>App ID <span className="text-red-500">*</span></Label>
                        <Input
                          placeholder="123456789"
                          value={metaForm.appId}
                          onChange={(e) => setMetaForm({ ...metaForm, appId: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ad Account ID <span className="text-red-500">*</span></Label>
                        <Input
                          placeholder="act_123456789"
                          value={metaForm.accountId}
                          onChange={(e) => setMetaForm({ ...metaForm, accountId: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>App Secret <span className="text-red-500">*</span></Label>
                      <Input
                        type="password"
                        placeholder="abcdef123456"
                        value={metaForm.appSecret}
                        onChange={(e) => setMetaForm({ ...metaForm, appSecret: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Access Token <span className="text-red-500">*</span></Label>
                      <Input
                        type="password"
                        placeholder="EAAxxxx"
                        value={metaForm.accessToken}
                        onChange={(e) => setMetaForm({ ...metaForm, accessToken: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pixel ID <span className="text-muted-foreground">(optional)</span></Label>
                      <Input
                        placeholder="123456789"
                        value={metaForm.pixelId}
                        onChange={(e) => setMetaForm({ ...metaForm, pixelId: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                      <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        All credentials are encrypted using AES-256-GCM before storage.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setMetaDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveMeta} disabled={!metaForm.appId || !metaForm.appSecret || !metaForm.accessToken || !metaForm.accountId}>
                      Save Connection
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {metaConnections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Share2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No Meta Ads connections configured</p>
              </div>
            ) : (
              <div className="space-y-3">
                {metaConnections.map((conn) => (
                  <div key={conn.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-sm">Account: {conn.accountId || 'Not set'}</p>
                        <p className="text-xs text-muted-foreground">
                          {conn.propertyId ? `Property: ${conn.propertyId.slice(0, 8)}…` : 'No property linked'}
                          {conn.pixelId ? ` · Pixel: ${conn.pixelId}` : ''}
                        </p>
                        {conn.lastSyncedAt && (
                          <p className="text-xs text-muted-foreground">
                            Last synced: {format(new Date(conn.lastSyncedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                        )}
                        {conn.lastError && (
                          <p className="text-xs text-red-500 mt-0.5">{conn.lastError}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(conn.status)}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection('meta', conn.id)}
                        disabled={testingId === conn.id}
                      >
                        {testingId === conn.id && testingPlatform === 'meta' ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <TestTube className="h-3 w-3 mr-1" />
                        )}
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 dark:text-red-400"
                        onClick={() => handleDisconnect('meta', conn.id)}
                      >
                        <Unplug className="h-3 w-3 mr-1" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AdPlatformConnections;
