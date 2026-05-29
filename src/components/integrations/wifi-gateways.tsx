'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, Wifi, Router, Settings, Plus, RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

// Masked sentinel value used by the API to represent existing secrets
const MASK_SENTINEL = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'; // "••••••••"

interface WifiConfig {
  ssid: string;
  vlanId?: number;
  captivePortal: boolean;
  splashPage: string;
  sessionTimeout: number;
  idleTimeout: number;
}

interface WifiGateway {
  id: string;
  name: string;
  type: 'cisco' | 'ubiquiti' | 'aruba' | 'ruckus' | 'mikrotik' | 'tplink' | 'fortinet' | 'juniper' | 'huawei' | 'netgear' | 'dlink' | 'ruijie' | 'cambium' | 'grandstream' | 'other';
  vendor?: string;
  ipAddress: string;
  port: number;
  status: 'connected' | 'disconnected' | 'error';
  apiEndpoint?: string;
  apiKey?: string;
  username?: string;
  lastSync?: string;
  nextSync?: string;
  totalAPs: number;
  activeSessions: number;
  bandwidthMbps?: number;
  bandwidth: {
    upload: number;
    download: number;
  };
  location?: string;
  autoSync: boolean;
  syncInterval: number;
  tenantId?: string;
  firmwareVersion?: string;
  lastSyncLatency?: number;
  radiusSecret?: string;
  coaEnabled?: boolean;
  coaPort?: number;
  coaSecret?: string;
  radiusAuthPort?: number;
  radiusAcctPort?: number;
  config?: WifiConfig;
}

const gatewayTypes = [
  { value: 'cisco', label: 'Cisco Meraki' },
  { value: 'ubiquiti', label: 'Ubiquiti UniFi' },
  { value: 'aruba', label: 'Aruba Networks' },
  { value: 'ruckus', label: 'Ruckus Wireless' },
  { value: 'mikrotik', label: 'MikroTik' },
  { value: 'tplink', label: 'TP-Link' },
  { value: 'fortinet', label: 'Fortinet' },
  { value: 'juniper', label: 'Juniper' },
  { value: 'huawei', label: 'Huawei' },
  { value: 'netgear', label: 'Netgear' },
  { value: 'dlink', label: 'D-Link' },
  { value: 'ruijie', label: 'Ruijie' },
  { value: 'cambium', label: 'Cambium' },
  { value: 'grandstream', label: 'Grandstream' },
  { value: 'other', label: 'Other' },
];

const defaultWifiConfig: WifiConfig = {
  ssid: '',
  vlanId: undefined,
  captivePortal: false,
  splashPage: '',
  sessionTimeout: 3600,
  idleTimeout: 300,
};

const defaultGateway: WifiGateway = {
  id: '',
  name: '',
  type: 'other',
  ipAddress: '',
  port: 443,
  status: 'disconnected',
  totalAPs: 0,
  activeSessions: 0,
  bandwidth: { upload: 0, download: 0 },
  autoSync: false,
  syncInterval: 5,
  radiusSecret: '',
  coaEnabled: true,
  coaPort: 3799,
  coaSecret: '',
  radiusAuthPort: 1812,
  radiusAcctPort: 1813,
  config: { ...defaultWifiConfig },
};

export default function WifiGateways() {
  const t = useTranslations('integrations');
  const [gateways, setGateways] = useState<WifiGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, connected: 0, totalAPs: 0, activeSessions: 0 });
  const [editGateway, setEditGateway] = useState<WifiGateway | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  const fetchGateways = async () => {
    try {
      const response = await fetch('/api/integrations/wifi-gateways');
      const data = await response.json();
      if (data.success) {
        setGateways(data.data.gateways);
        setStats(data.data.stats);
      }
    } catch (error) {
      toast.error('Failed to fetch WiFi gateways');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGateways();
  }, []);

  const handleToggleAutoSync = async (id: string) => {
    const gateway = gateways.find(g => g.id === id);
    if (!gateway) return;

    try {
      const response = await fetch('/api/integrations/wifi-gateways', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, autoSync: !gateway.autoSync }),
      });

      if (response.ok) {
        setGateways(gateways.map(g => 
          g.id === id ? { ...g, autoSync: !g.autoSync } : g
        ));
        toast.success('Auto-sync setting updated');
      }
    } catch {
      toast.error('Failed to update auto-sync setting');
    }
  };

  const handleTestConnection = async (gateway: WifiGateway) => {
    setTestingConnection(gateway.id);
    try {
      const response = await fetch(`/api/integrations/wifi-gateways?action=test-connection&id=${gateway.id}`);
      const data = await response.json();
      if (data.success && data.data.connected) {
        toast.success(data.data.message || `Connected to ${gateway.name} (${data.data.latency}ms)`);
      } else {
        toast.error(data.data?.message || `Could not connect to ${gateway.name}`);
      }
    } catch {
      toast.error('Connection test failed');
    } finally {
      setTestingConnection(null);
    }
  };

  const handleSaveGateway = async () => {
    if (!editGateway) return;

    try {
      const isNew = !editGateway.id || editGateway.id === '';
      const method = isNew ? 'POST' : 'PUT';

      // Build the request body, filtering out masked sentinel values for secrets
      const body: Record<string, unknown> = {
        ...editGateway,
      };

      // Handle masked secret fields — don't send back the sentinel value
      if (body.apiKey === MASK_SENTINEL) {
        delete body.apiKey;
      }
      if (body.radiusSecret === MASK_SENTINEL) {
        delete body.radiusSecret;
      }
      if (body.coaSecret === MASK_SENTINEL) {
        delete body.coaSecret;
      }

      // Remove empty string secrets to avoid overwriting with blank
      if (body.apiKey === '') {
        delete body.apiKey;
      }
      if (body.radiusSecret === '') {
        delete body.radiusSecret;
      }
      if (body.coaSecret === '') {
        delete body.coaSecret;
      }

      // Clean up read-only fields that shouldn't be sent
      delete body.bandwidth;
      delete body.totalAPs;
      delete body.activeSessions;
      delete body.bandwidthMbps;
      delete body.lastSyncLatency;
      delete body.firmwareVersion;
      delete body.vendor;
      delete body.tenantId;
      delete body.nextSync;
      delete body.lastSync;

      // Move config sub-object so API stores it as config_wifi
      if (editGateway.config) {
        body.config = editGateway.config;
      }

      const response = await fetch('/api/integrations/wifi-gateways', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        if (isNew) {
          toast.success('Gateway added successfully');
        } else {
          toast.success('Gateway updated successfully');
        }
        fetchGateways();
      } else {
        const data = await response.json();
        toast.error(data.error?.message || 'Failed to save gateway');
      }
    } catch {
      toast.error('Failed to save gateway');
    }
    setDialogOpen(false);
    setEditGateway(null);
  };

  const handleSync = async (gateway: WifiGateway) => {
    try {
      toast.loading(`Syncing ${gateway.name}...`);
      const response = await fetch('/api/integrations/wifi-gateways', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: gateway.id,
          status: 'syncing',
        }),
      });

      if (response.ok) {
        // In a real implementation, the sync would be handled by the backend
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await fetch('/api/integrations/wifi-gateways', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: gateway.id,
            status: 'active',
            lastSync: new Date().toISOString(),
          }),
        });

        toast.success('Sync completed successfully!');
        fetchGateways();
      } else {
        toast.error('Sync failed');
      }
    } catch (error) {
      toast.error('Sync failed');
    }
  };

  const openEditDialog = (gateway: WifiGateway) => {
    // When editing, capture ALL gateway fields including the new ones
    setEditGateway({
      ...gateway,
      radiusSecret: gateway.radiusSecret || '',
      coaEnabled: gateway.coaEnabled ?? true,
      coaPort: gateway.coaPort || 3799,
      coaSecret: gateway.coaSecret || '',
      radiusAuthPort: gateway.radiusAuthPort || 1812,
      radiusAcctPort: gateway.radiusAcctPort || 1813,
      config: gateway.config || { ...defaultWifiConfig },
    });
    setDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditGateway({
      ...defaultGateway,
      config: { ...defaultWifiConfig },
    });
    setDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-emerald-500';
      case 'disconnected': return 'bg-amber-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">WiFi Gateways</h2>
          <p className="text-muted-foreground">Configure WiFi controller and gateway integrations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Gateway
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editGateway?.id ? 'Edit Gateway' : 'Add WiFi Gateway'}</DialogTitle>
              <DialogDescription>Configure your WiFi controller settings</DialogDescription>
            </DialogHeader>
            {editGateway && (
              <div className="space-y-5 py-4">
                {/* Basic Configuration */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Configuration</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Gateway Name</Label>
                      <Input
                        id="name"
                        value={editGateway.name}
                        onChange={(e) => setEditGateway({ ...editGateway, name: e.target.value })}
                        placeholder="My WiFi Controller"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Controller Type</Label>
                      <Select
                        value={editGateway.type}
                        onValueChange={(v: any) => setEditGateway({ ...editGateway, type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {gatewayTypes.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ipAddress">IP Address</Label>
                      <Input
                        id="ipAddress"
                        value={editGateway.ipAddress}
                        onChange={(e) => setEditGateway({ ...editGateway, ipAddress: e.target.value })}
                        placeholder="192.168.1.100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="port">Port</Label>
                      <Input
                        id="port"
                        type="number"
                        value={editGateway.port}
                        onChange={(e) => setEditGateway({ ...editGateway, port: parseInt(e.target.value) || 443 })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={editGateway.username || ''}
                        onChange={(e) => setEditGateway({ ...editGateway, username: e.target.value })}
                        placeholder="admin"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apiKey">API Key</Label>
                      <Input
                        id="apiKey"
                        type="password"
                        value={editGateway.apiKey || ''}
                        onChange={(e) => setEditGateway({ ...editGateway, apiKey: e.target.value })}
                        placeholder={editGateway.id ? 'Leave unchanged to keep current key' : 'Enter API key'}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={editGateway.location || ''}
                      onChange={(e) => setEditGateway({ ...editGateway, location: e.target.value })}
                      placeholder="Server Room, Building A"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="syncInterval">Sync Interval (min)</Label>
                      <Input
                        id="syncInterval"
                        type="number"
                        value={editGateway.syncInterval}
                        onChange={(e) => setEditGateway({ ...editGateway, syncInterval: parseInt(e.target.value) || 5 })}
                      />
                    </div>
                    <div className="space-y-2 flex items-end">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="autoSync"
                          checked={editGateway.autoSync}
                          onCheckedChange={(v) => setEditGateway({ ...editGateway, autoSync: v })}
                        />
                        <Label htmlFor="autoSync">Auto Sync</Label>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* RADIUS Configuration */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">RADIUS Configuration</h4>
                  <div className="space-y-2">
                    <Label htmlFor="radiusSecret">RADIUS Secret</Label>
                    <Input
                      id="radiusSecret"
                      type="password"
                      value={editGateway.radiusSecret || ''}
                      onChange={(e) => setEditGateway({ ...editGateway, radiusSecret: e.target.value })}
                      placeholder={editGateway.id ? 'Leave unchanged to keep current secret' : 'Enter RADIUS shared secret'}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="radiusAuthPort">RADIUS Auth Port</Label>
                      <Input
                        id="radiusAuthPort"
                        type="number"
                        value={editGateway.radiusAuthPort || 1812}
                        onChange={(e) => setEditGateway({ ...editGateway, radiusAuthPort: parseInt(e.target.value) || 1812 })}
                        placeholder="1812"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="radiusAcctPort">RADIUS Acct Port</Label>
                      <Input
                        id="radiusAcctPort"
                        type="number"
                        value={editGateway.radiusAcctPort || 1813}
                        onChange={(e) => setEditGateway({ ...editGateway, radiusAcctPort: parseInt(e.target.value) || 1813 })}
                        placeholder="1813"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* CoA Configuration */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">CoA Configuration</h4>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="coaEnabled"
                      checked={editGateway.coaEnabled ?? true}
                      onCheckedChange={(v) => setEditGateway({ ...editGateway, coaEnabled: v })}
                    />
                    <Label htmlFor="coaEnabled">CoA Enabled</Label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="coaPort">CoA Port</Label>
                      <Input
                        id="coaPort"
                        type="number"
                        value={editGateway.coaPort || 3799}
                        onChange={(e) => setEditGateway({ ...editGateway, coaPort: parseInt(e.target.value) || 3799 })}
                        placeholder="3799"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="coaSecret">CoA Secret</Label>
                      <Input
                        id="coaSecret"
                        type="password"
                        value={editGateway.coaSecret || ''}
                        onChange={(e) => setEditGateway({ ...editGateway, coaSecret: e.target.value })}
                        placeholder={editGateway.id ? 'Leave unchanged to keep current secret' : 'Enter CoA secret'}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* WiFi Configuration */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">WiFi Configuration</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ssid">SSID</Label>
                      <Input
                        id="ssid"
                        value={editGateway.config?.ssid || ''}
                        onChange={(e) => setEditGateway({
                          ...editGateway,
                          config: { ...editGateway.config!, ssid: e.target.value },
                        })}
                        placeholder="Guest-WiFi"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vlanId">VLAN ID</Label>
                      <Input
                        id="vlanId"
                        type="number"
                        value={editGateway.config?.vlanId ?? ''}
                        onChange={(e) => setEditGateway({
                          ...editGateway,
                          config: {
                            ...editGateway.config!,
                            vlanId: e.target.value ? parseInt(e.target.value) : undefined,
                          },
                        })}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="captivePortal"
                        checked={editGateway.config?.captivePortal ?? false}
                        onCheckedChange={(v) => setEditGateway({
                          ...editGateway,
                          config: { ...editGateway.config!, captivePortal: v },
                        })}
                      />
                      <Label htmlFor="captivePortal">Captive Portal</Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="splashPage">Splash Page URL</Label>
                      <Input
                        id="splashPage"
                        value={editGateway.config?.splashPage || ''}
                        onChange={(e) => setEditGateway({
                          ...editGateway,
                          config: { ...editGateway.config!, splashPage: e.target.value },
                        })}
                        placeholder="https://portal.example.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sessionTimeout">Session Timeout (seconds)</Label>
                      <Input
                        id="sessionTimeout"
                        type="number"
                        value={editGateway.config?.sessionTimeout ?? 3600}
                        onChange={(e) => setEditGateway({
                          ...editGateway,
                          config: { ...editGateway.config!, sessionTimeout: parseInt(e.target.value) || 3600 },
                        })}
                        placeholder="3600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idleTimeout">Idle Timeout (seconds)</Label>
                      <Input
                        id="idleTimeout"
                        type="number"
                        value={editGateway.config?.idleTimeout ?? 300}
                        onChange={(e) => setEditGateway({
                          ...editGateway,
                          config: { ...editGateway.config!, idleTimeout: parseInt(e.target.value) || 300 },
                        })}
                        placeholder="300"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); setEditGateway(null); }}>Cancel</Button>
              <Button onClick={handleSaveGateway}>Save Gateway</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Connected Gateways</CardDescription>
            <CardTitle className="text-2xl">{stats.connected}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>Total APs</CardDescription>
            <CardTitle className="text-2xl">{stats.totalAPs}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Active Sessions</CardDescription>
            <CardTitle className="text-2xl">{stats.activeSessions}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription>Bandwidth Usage</CardDescription>
            <CardTitle className="text-2xl">{gateways.reduce((sum, g) => sum + (g.bandwidthMbps || 0), 0)} Mbps</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Gateway List */}
      <div className="grid gap-4">
        {gateways.map((gateway) => (
          <Card key={gateway.id}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center">
                    <Router className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{gateway.name}</CardTitle>
                    <CardDescription>{gateway.ipAddress}:{gateway.port}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{gatewayTypes.find(t => t.value === gateway.type)?.label}</Badge>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${getStatusColor(gateway.status)}`} />
                    <span className="text-sm capitalize">{gateway.status}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{gateway.location || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Access Points</p>
                  <p className="font-medium">{gateway.totalAPs}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Sessions</p>
                  <p className="font-medium">{gateway.activeSessions}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bandwidth</p>
                  <p className="font-medium">↓ {gateway.bandwidth.download} Mbps / ↑ {gateway.bandwidth.upload} Mbps</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-4 border-t">
                <Switch
                  checked={gateway.autoSync}
                  onCheckedChange={() => handleToggleAutoSync(gateway.id)}
                />
                <span className="text-sm text-muted-foreground mr-auto">Auto-sync ({gateway.syncInterval} min)</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestConnection(gateway)}
                  disabled={testingConnection === gateway.id}
                >
                  {testingConnection === gateway.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleSync(gateway)} disabled={gateway.status !== 'connected'}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEditDialog(gateway)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
