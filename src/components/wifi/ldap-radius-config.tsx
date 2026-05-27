'use client';

/**
 * AD/LDAP Integration Configuration for FreeRADIUS
 *
 * Comprehensive UI for configuring LDAP/Active Directory authentication
 * integration with the FreeRADIUS server. Supports multiple authentication
 * methods including LDAP Bind (PAP), MS-CHAPv2 (ntlm_auth), and EAP-TTLS + LDAP.
 *
 * Features:
 * - Feature flag toggle with confirmation dialogs
 * - Connection settings (server URL, Base DN, Bind DN, etc.)
 * - Three authentication method cards (PAP, MS-CHAPv2, EAP-TTLS)
 * - Attribute mapping configuration
 * - Auto-provisioning with group sync
 * - Status & diagnostics panel
 * - User search & sync
 */

import { useState, useEffect, useCallback } from 'react';
import { usePropertyId } from '@/hooks/use-property';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Network,
  Shield,
  ShieldCheck,
  Activity,
  Loader2,
  Eye,
  EyeOff,
  Search,
  RefreshCw,
  Play,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Settings,
  Database,
  KeyRound,
  Wifi,
  Zap,
  Info,
  Server,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LDAPConfig {
  enabled: boolean;
  serverUrl: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  searchFilter: string;
  security: 'ldaps' | 'starttls' | 'plain';
  connectionTimeout: number;
  poolMin: number;
  poolMax: number;
  // Auth methods
  authLdapBind: boolean;
  authMsChapv2: boolean;
  ntlmAuthPath: string;
  winbindDomain: string;
  authEapTtls: boolean;
  // Attribute mapping
  usernameAttribute: string;
  groupAttribute: string;
  filterGroup: string;
  // Auto-provisioning
  autoSyncGroups: boolean;
  autoAssignPlan: boolean;
  defaultPlanId: string;
  syncInterval: number;
  // Status fields (read-only from backend)
  status?: 'active' | 'inactive' | 'error';
  lastTestAt?: string;
  lastTestLatency?: number;
  connectionStatus?: 'connected' | 'disconnected' | 'error';
  freeradiusModuleStatus?: string;
  usersSyncedCount?: number;
  authMethodInUse?: string;
  errorMessage?: string;
}

interface WifiPlan {
  id: string;
  name: string;
  downloadSpeed: number;
  uploadSpeed: number;
  status: string;
}

interface LDAPSearchResult {
  userDn: string;
  username: string;
  groups: string[];
  status: string;
}

interface DiagnosticsResult {
  connectionStatus: string;
  freeradiusModuleStatus: string;
  bindTestPassed: boolean;
  searchTestPassed: boolean;
  authTestPassed: boolean;
  latency: number;
  errorMessage?: string;
  authMethodInUse: string;
  usersSyncedCount: number;
  lastTestAt?: string;
}

// ─── Default Form State ───────────────────────────────────────────────────────

const DEFAULT_CONFIG: LDAPConfig = {
  enabled: false,
  serverUrl: '',
  baseDn: '',
  bindDn: '',
  bindPassword: '',
  searchFilter: '(sAMAccountName=%{User-Name})',
  security: 'ldaps',
  connectionTimeout: 30,
  poolMin: 5,
  poolMax: 20,
  authLdapBind: false,
  authMsChapv2: false,
  ntlmAuthPath: '/usr/bin/ntlm_auth',
  winbindDomain: '',
  authEapTtls: false,
  usernameAttribute: 'sAMAccountName',
  groupAttribute: 'memberOf',
  filterGroup: '',
  autoSyncGroups: false,
  autoAssignPlan: false,
  defaultPlanId: '',
  syncInterval: 60,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LDAPRadiusConfig() {
  const { toast } = useToast();
  const { propertyId } = usePropertyId();

  // ── Loading states ──
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [searching, setSearching] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // ── Confirmation dialogs ──
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false);
  const [pendingToggleState, setPendingToggleState] = useState(false);

  // ── Form config ──
  const [config, setConfig] = useState<LDAPConfig>({ ...DEFAULT_CONFIG });

  // ── Password visibility ──
  const [showBindPassword, setShowBindPassword] = useState(false);

  // ── WiFi plans for auto-assign dropdown ──
  const [wifiPlans, setWifiPlans] = useState<WifiPlan[]>([]);

  // ── Search results ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LDAPSearchResult[]>([]);

  // ── Diagnostics ──
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);

  // ─── Fetch config from API ────────────────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/wifi/radius-ldap?propertyId=${propertyId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setConfig(prev => ({ ...prev, ...data.data }));
        setDiagnostics(data.diagnostics ?? null);
      }
      // Even if no config exists, we show the setup form with defaults
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load LDAP configuration. You can still set up a new configuration below.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [propertyId, toast]);

  // ─── Fetch WiFi plans ─────────────────────────────────────────────────────

  const fetchWifiPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/wifi/plans?status=active');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setWifiPlans(data.data.filter((p: WifiPlan) => p.status === 'active'));
      }
    } catch {
      // Plans are optional — don't block the page
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchWifiPlans();
  }, [fetchConfig, fetchWifiPlans]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const updateConfig = (updates: Partial<LDAPConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
      case 'connected':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            {status === 'active' ? 'Active' : 'Connected'}
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
            <AlertCircle className="h-3 w-3 mr-1" />
            {status === 'disconnected' ? 'Disconnected' : 'Inactive'}
          </Badge>
        );
    }
  };

  // ─── Feature Flag Toggle ──────────────────────────────────────────────────

  const handleToggleRequest = (newState: boolean) => {
    setPendingToggleState(newState);
    setToggleDialogOpen(true);
  };

  const handleToggleConfirm = async () => {
    setToggleDialogOpen(false);
    setToggling(true);
    try {
      const res = await fetch('/api/wifi/radius-ldap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          action: 'toggle',
          enabled: pendingToggleState,
        }),
      });
      const data = await res.json();
      if (data.success) {
        updateConfig({ enabled: pendingToggleState, status: pendingToggleState ? 'active' : 'inactive' });
        toast({
          title: pendingToggleState ? 'LDAP Enabled' : 'LDAP Disabled',
          description: pendingToggleState
            ? 'LDAP authentication is now active for your WiFi guests.'
            : 'LDAP authentication has been disabled. SQL-based auth remains active.',
        });
        // Re-fetch to get latest status
        fetchConfig();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to toggle LDAP integration.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to toggle LDAP integration.',
        variant: 'destructive',
      });
    } finally {
      setToggling(false);
    }
  };

  // ─── Save Configuration ──────────────────────────────────────────────────

  const handleSave = async () => {
    if (!config.serverUrl || !config.baseDn) {
      toast({
        title: 'Validation Error',
        description: 'LDAP Server URL and Base DN are required.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/wifi/radius-ldap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          action: 'save',
          ...config,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Configuration Saved',
          description: 'LDAP configuration has been saved successfully.',
        });
        fetchConfig();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to save LDAP configuration.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save LDAP configuration.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // ─── Test Connection ─────────────────────────────────────────────────────

  const handleTestConnection = async () => {
    if (!config.serverUrl || !config.baseDn) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in Server URL and Base DN before testing.',
        variant: 'destructive',
      });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch('/api/wifi/radius-ldap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          action: 'test',
          serverUrl: config.serverUrl,
          baseDn: config.baseDn,
          bindDn: config.bindDn,
          bindPassword: config.bindPassword,
          security: config.security,
          connectionTimeout: config.connectionTimeout,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const latency = data.latency ?? 0;
        toast({
          title: 'Connection Successful',
          description: `Successfully connected to LDAP server. Latency: ${latency}ms`,
        });
        updateConfig({
          connectionStatus: 'connected',
          lastTestAt: new Date().toISOString(),
          lastTestLatency: latency,
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: data.error || 'Could not connect to the LDAP server. Check your settings and try again.',
          variant: 'destructive',
        });
        updateConfig({ connectionStatus: 'error', errorMessage: data.error });
      }
    } catch {
      toast({
        title: 'Connection Failed',
        description: 'Could not reach the API. The service may be unavailable.',
        variant: 'destructive',
      });
      updateConfig({ connectionStatus: 'error' });
    } finally {
      setTesting(false);
    }
  };

  // ─── Run Diagnostics ─────────────────────────────────────────────────────

  const handleRunDiagnostics = async () => {
    setRunningDiagnostics(true);
    try {
      const res = await fetch('/api/wifi/radius-ldap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, action: 'diagnostics' }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setDiagnostics(data.data);
        toast({
          title: 'Diagnostics Complete',
          description: 'Diagnostics check finished. See results below.',
        });
      } else {
        toast({
          title: 'Diagnostics Failed',
          description: data.error || 'Failed to run diagnostics.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Diagnostics Failed',
        description: 'Failed to run diagnostics.',
        variant: 'destructive',
      });
    } finally {
      setRunningDiagnostics(false);
    }
  };

  // ─── User Search ──────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a search query (username, email, or name).',
        variant: 'destructive',
      });
      return;
    }
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch('/api/wifi/radius-ldap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          action: 'search',
          query: searchQuery,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSearchResults(data.data);
        if (data.data.length === 0) {
          toast({
            title: 'No Results',
            description: 'No users found matching your search query.',
          });
        }
      } else {
        toast({
          title: 'Search Failed',
          description: data.error || 'Failed to search LDAP directory.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Search Failed',
        description: 'Failed to search LDAP directory.',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  // ─── Sync Groups ─────────────────────────────────────────────────────────

  const handleSyncGroups = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/wifi/radius-ldap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, action: 'sync' }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Sync Complete',
          description: data.message || `Synced ${data.count ?? 0} users/groups successfully.`,
        });
        fetchConfig();
      } else {
        toast({
          title: 'Sync Failed',
          description: data.error || 'Failed to sync groups.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync groups.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  // ─── View Logs ───────────────────────────────────────────────────────────

  const handleViewLogs = () => {
    toast({
      title: 'Logs',
      description: 'Opening RADIUS LDAP module logs...',
    });
    // In production, this would open a log viewer dialog or navigate to a logs page
  };

  // ─── Determine if the feature is configured (for conditional sections) ────

  const isConfigured = config.serverUrl && config.baseDn;

  // ─── Loading State ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-60 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ─── 1. Feature Flag Header ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Network className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">AD / LDAP Integration</CardTitle>
                <CardDescription className="mt-1">
                  Authenticate WiFi guests using your corporate Active Directory or LDAP directory.
                  Corporate users can sign in with their existing credentials.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end gap-1">
                {getStatusBadge(config.status ?? (config.enabled ? 'active' : 'inactive'))}
                {toggling && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Updating...
                  </span>
                )}
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => handleToggleRequest(checked)}
                disabled={toggling}
                aria-label="Toggle LDAP integration"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Toggle Confirmation Dialog */}
      <AlertDialog open={toggleDialogOpen} onOpenChange={setToggleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingToggleState ? 'Enable LDAP Authentication' : 'Disable LDAP Authentication'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingToggleState
                ? 'This will enable LDAP authentication for your WiFi guests. Corporate users will be able to authenticate using their AD/LDAP credentials. Your existing SQL-based guest authentication will remain active as fallback.'
                : 'This will disable LDAP authentication. All guests will authenticate via the existing SQL-based system only.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleConfirm}>
              {pendingToggleState ? 'Enable' : 'Disable'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── 2. Connection Settings ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Connection Settings</CardTitle>
          </div>
          <CardDescription>
            Configure your LDAP/AD server connection parameters. Use LDAPS for encrypted communication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Server URL */}
            <div className="space-y-2">
              <Label htmlFor="ldap-server-url">
                LDAP/AD Server URL
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                id="ldap-server-url"
                placeholder="ldaps://ad.corp.com:636"
                value={config.serverUrl}
                onChange={(e) => updateConfig({ serverUrl: e.target.value })}
              />
            </div>

            {/* Security */}
            <div className="space-y-2">
              <Label htmlFor="ldap-security">Security</Label>
              <Select
                value={config.security}
                onValueChange={(val) => updateConfig({ security: val as LDAPConfig['security'] })}
              >
                <SelectTrigger id="ldap-security">
                  <SelectValue placeholder="Select security mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ldaps">LDAPS (port 636)</SelectItem>
                  <SelectItem value="starttls">StartTLS</SelectItem>
                  <SelectItem value="plain">Plain LDAP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Base DN */}
            <div className="space-y-2">
              <Label htmlFor="ldap-base-dn">
                Base DN
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                id="ldap-base-dn"
                placeholder="DC=corp,DC=com"
                value={config.baseDn}
                onChange={(e) => updateConfig({ baseDn: e.target.value })}
              />
            </div>

            {/* Bind DN */}
            <div className="space-y-2">
              <Label htmlFor="ldap-bind-dn">Bind DN</Label>
              <Input
                id="ldap-bind-dn"
                placeholder="CN=readonly,OU=ServiceAccounts,DC=corp,DC=com"
                value={config.bindDn}
                onChange={(e) => updateConfig({ bindDn: e.target.value })}
              />
            </div>

            {/* Bind Password */}
            <div className="space-y-2">
              <Label htmlFor="ldap-bind-password">Bind Password</Label>
              <div className="relative">
                <Input
                  id="ldap-bind-password"
                  type={showBindPassword ? 'text' : 'password'}
                  placeholder="Enter bind password"
                  value={config.bindPassword}
                  onChange={(e) => updateConfig({ bindPassword: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowBindPassword(!showBindPassword)}
                  aria-label={showBindPassword ? 'Hide password' : 'Show password'}
                >
                  {showBindPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Search Filter */}
            <div className="space-y-2">
              <Label htmlFor="ldap-search-filter">Search Filter</Label>
              <Input
                id="ldap-search-filter"
                placeholder="(sAMAccountName=%{User-Name})"
                value={config.searchFilter}
                onChange={(e) => updateConfig({ searchFilter: e.target.value })}
              />
            </div>

            {/* Connection Timeout */}
            <div className="space-y-2">
              <Label htmlFor="ldap-timeout">Connection Timeout (seconds)</Label>
              <Input
                id="ldap-timeout"
                type="number"
                min={5}
                max={120}
                value={config.connectionTimeout}
                onChange={(e) => updateConfig({ connectionTimeout: parseInt(e.target.value) || 30 })}
              />
            </div>

            {/* Pool Size — Min and Max side by side */}
            <div className="space-y-2">
              <Label>Connection Pool Size</Label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    placeholder="Min"
                    value={config.poolMin}
                    onChange={(e) => updateConfig({ poolMin: parseInt(e.target.value) || 5 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Min</p>
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    placeholder="Max"
                    value={config.poolMax}
                    onChange={(e) => updateConfig({ poolMax: parseInt(e.target.value) || 20 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Max</p>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Action buttons */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !config.serverUrl}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── 3. Authentication Method Card ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Authentication Method</CardTitle>
          </div>
          <CardDescription>
            Choose how FreeRADIUS authenticates users against your LDAP/AD directory.
            You can enable multiple methods simultaneously.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* LDAP Bind (PAP) */}
            <Card className={cn(
              'border transition-all duration-200',
              config.authLdapBind ? 'border-primary bg-primary/5' : 'border-border'
            )}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      config.authLdapBind ? 'bg-primary/20' : 'bg-muted'
                    )}>
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">LDAP Bind (PAP)</p>
                      <p className="text-xs text-muted-foreground">OpenLDAP, 389DS, cloud LDAP</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.authLdapBind}
                    onCheckedChange={(checked) => updateConfig({ authLdapBind: checked })}
                    aria-label="Enable LDAP Bind authentication"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Authenticates by binding to LDAP as the user. Supports PAP protocol only.
                  Compatible with most LDAP implementations including OpenLDAP and 389 Directory Server.
                </p>
              </CardContent>
            </Card>

            {/* MS-CHAPv2 (ntlm_auth) */}
            <Card className={cn(
              'border transition-all duration-200',
              config.authMsChapv2 ? 'border-primary bg-primary/5' : 'border-border'
            )}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      config.authMsChapv2 ? 'bg-primary/20' : 'bg-muted'
                    )}>
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">MS-CHAPv2 (ntlm_auth)</p>
                      <p className="text-xs text-muted-foreground">Active Directory</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.authMsChapv2}
                    onCheckedChange={(checked) => updateConfig({ authMsChapv2: checked })}
                    aria-label="Enable MS-CHAPv2 authentication"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Uses ntlm_auth helper to validate against AD. Requires Samba/winbind installed on the RADIUS server.
                </p>
                {config.authMsChapv2 && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="space-y-1">
                      <Label className="text-xs">ntlm_auth Path</Label>
                      <Input
                        className="h-8 text-xs"
                        defaultValue="/usr/bin/ntlm_auth"
                        value={config.ntlmAuthPath}
                        onChange={(e) => updateConfig({ ntlmAuthPath: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Winbind Domain</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="CORP"
                        value={config.winbindDomain}
                        onChange={(e) => updateConfig({ winbindDomain: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* EAP-TTLS + LDAP */}
            <Card className={cn(
              'border transition-all duration-200',
              config.authEapTtls ? 'border-primary bg-primary/5' : 'border-border'
            )}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      config.authEapTtls ? 'bg-primary/20' : 'bg-muted'
                    )}>
                      <Wifi className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">EAP-TTLS + LDAP</p>
                      <p className="text-xs text-muted-foreground">802.1X / WPA2-Enterprise</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.authEapTtls}
                    onCheckedChange={(checked) => updateConfig({ authEapTtls: checked })}
                    aria-label="Enable EAP-TTLS authentication"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  EAP-TTLS outer tunnel with LDAP inner auth. Requires TLS certificates configured on the RADIUS server.
                  Ideal for enterprise WiFi with 802.1X.
                </p>
                {config.authEapTtls && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Ensure TLS certificates are configured in FreeRADIUS before enabling.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* ─── 4. Attribute Mapping ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Attribute Mapping</CardTitle>
          </div>
          <CardDescription>
            Map LDAP directory attributes to RADIUS authentication fields.
            These mappings determine how user accounts are looked up and authorized.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Username Attribute */}
            <div className="space-y-2">
              <Label htmlFor="ldap-username-attr">
                Username Attribute
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 ml-1 inline text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    The LDAP attribute that stores the username. For Active Directory, this is typically &quot;sAMAccountName&quot;. For OpenLDAP, use &quot;uid&quot;.
                  </TooltipContent>
                </Tooltip>
              </Label>
              <Input
                id="ldap-username-attr"
                defaultValue="sAMAccountName"
                value={config.usernameAttribute}
                onChange={(e) => updateConfig({ usernameAttribute: e.target.value })}
              />
            </div>

            {/* Group Attribute */}
            <div className="space-y-2">
              <Label htmlFor="ldap-group-attr">
                Group Attribute
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 ml-1 inline text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    The LDAP attribute that lists user group memberships. For AD, this is &quot;memberOf&quot;. For OpenLDAP with groupOfNames, also &quot;memberOf&quot;.
                  </TooltipContent>
                </Tooltip>
              </Label>
              <Input
                id="ldap-group-attr"
                defaultValue="memberOf"
                value={config.groupAttribute}
                onChange={(e) => updateConfig({ groupAttribute: e.target.value })}
              />
            </div>

            {/* Filter Group */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ldap-filter-group">
                Filter Group (optional)
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 ml-1 inline text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Only allow authentication for users in this specific AD/LDAP group. Leave empty to allow all directory users. Example: CN=WiFiUsers,OU=Groups,DC=corp,DC=com
                  </TooltipContent>
                </Tooltip>
              </Label>
              <Input
                id="ldap-filter-group"
                placeholder="CN=WiFiUsers,OU=Groups,DC=corp,DC=com"
                value={config.filterGroup}
                onChange={(e) => updateConfig({ filterGroup: e.target.value })}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            These attribute mappings tell FreeRADIUS how to look up users in your directory and determine their group
            memberships for authorization policies. The filter group restricts access to members of a specific group.
          </p>
        </CardContent>
      </Card>

      {/* ─── 5. Auto-Provisioning ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Auto-Provisioning</CardTitle>
          </div>
          <CardDescription>
            Automatically sync AD groups and assign WiFi plans based on directory memberships.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4">
            {/* Auto-sync groups */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-sync-groups">Auto-sync groups</Label>
                <p className="text-xs text-muted-foreground">
                  Periodically sync AD/LDAP groups to local RADIUS groups
                </p>
              </div>
              <Switch
                id="auto-sync-groups"
                checked={config.autoSyncGroups}
                onCheckedChange={(checked) => updateConfig({ autoSyncGroups: checked })}
                aria-label="Toggle auto-sync groups"
              />
            </div>

            <Separator />

            {/* Auto-assign WiFi plan */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-assign-plan">Auto-assign WiFi plan from AD groups</Label>
                <p className="text-xs text-muted-foreground">
                  Map AD group memberships to specific WiFi plans automatically
                </p>
              </div>
              <Switch
                id="auto-assign-plan"
                checked={config.autoAssignPlan}
                onCheckedChange={(checked) => updateConfig({ autoAssignPlan: checked })}
                aria-label="Toggle auto-assign WiFi plan"
              />
            </div>

            {/* Default WiFi plan selector — visible when auto-assign is on */}
            {config.autoAssignPlan && (
              <div className="ml-0 sm:ml-6 space-y-2 pl-0 sm:pl-4 border-l-0 sm:border-l-2 border-primary/20">
                <Label htmlFor="default-plan">Default WiFi Plan</Label>
                <Select
                  value={config.defaultPlanId}
                  onValueChange={(val) => updateConfig({ defaultPlanId: val })}
                >
                  <SelectTrigger id="default-plan">
                    <SelectValue placeholder="Select a WiFi plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {wifiPlans.length === 0 ? (
                      <SelectItem value="_none" disabled>No active plans available</SelectItem>
                    ) : (
                      wifiPlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} — {plan.downloadSpeed}/{plan.uploadSpeed} Mbps
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {wifiPlans.length === 0 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    No active WiFi plans found. Create plans in the Plans tab first.
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Sync Interval */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="space-y-0.5">
                <Label htmlFor="sync-interval">Sync Interval</Label>
                <p className="text-xs text-muted-foreground">
                  How often to poll AD/LDAP for group changes
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="sync-interval"
                  type="number"
                  min={5}
                  max={1440}
                  className="w-24"
                  value={config.syncInterval}
                  onChange={(e) => updateConfig({ syncInterval: parseInt(e.target.value) || 60 })}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">minutes</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── 6. Status & Diagnostics ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Status & Diagnostics</CardTitle>
          </div>
          <CardDescription>
            Monitor the LDAP connection health and FreeRADIUS module status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Connection Status */}
            <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Connection Status</p>
              <div className="mt-1">
                {getStatusBadge(diagnostics?.connectionStatus ?? config.connectionStatus)}
              </div>
            </div>

            {/* Last Test */}
            <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Last Test</p>
              <p className="text-sm font-medium">
                {config.lastTestAt
                  ? `${new Date(config.lastTestAt).toLocaleString()}`
                  : 'Never tested'}
              </p>
              {config.lastTestLatency != null && (
                <p className="text-xs text-muted-foreground">{config.lastTestLatency}ms latency</p>
              )}
            </div>

            {/* FreeRADIUS Module Status */}
            <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">FreeRADIUS Module</p>
              <p className={cn(
                'text-sm font-medium',
                diagnostics?.freeradiusModuleStatus === 'loaded' ? 'text-emerald-600' :
                diagnostics?.freeradiusModuleStatus === 'error' ? 'text-red-600' : 'text-muted-foreground'
              )}>
                {diagnostics?.freeradiusModuleStatus ?? 'Unknown'}
              </p>
            </div>

            {/* Auth Method In Use */}
            <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Auth Method</p>
              <p className="text-sm font-medium">
                {diagnostics?.authMethodInUse ?? config.authMethodInUse ?? 'Not configured'}
              </p>
            </div>

            {/* Users Synced */}
            <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Users Synced</p>
              <p className="text-sm font-medium">
                {(diagnostics?.usersSyncedCount ?? config.usersSyncedCount) ?? 0}
              </p>
            </div>

            {/* Diagnostics Check Results */}
            {diagnostics && (
              <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Diagnostics Checks</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="outline" className={cn(
                    diagnostics.bindTestPassed ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : 'bg-red-500/10 text-red-600 border-red-200'
                  )}>
                    {diagnostics.bindTestPassed ? '✓ Bind' : '✗ Bind'}
                  </Badge>
                  <Badge variant="outline" className={cn(
                    diagnostics.searchTestPassed ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : 'bg-red-500/10 text-red-600 border-red-200'
                  )}>
                    {diagnostics.searchTestPassed ? '✓ Search' : '✗ Search'}
                  </Badge>
                  <Badge variant="outline" className={cn(
                    diagnostics.authTestPassed ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : 'bg-red-500/10 text-red-600 border-red-200'
                  )}>
                    {diagnostics.authTestPassed ? '✓ Auth' : '✗ Auth'}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Diagnostics error message */}
          {(diagnostics?.errorMessage || config.errorMessage) && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">
                {diagnostics?.errorMessage ?? config.errorMessage}
              </p>
            </div>
          )}

          <Separator className="my-2" />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleViewLogs}>
              <FileText className="h-4 w-4 mr-2" />
              View Logs
            </Button>
            <Button
              variant="outline"
              onClick={handleRunDiagnostics}
              disabled={runningDiagnostics || !isConfigured}
            >
              {runningDiagnostics ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Run Diagnostics
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── 7. User Search & Sync (visible when configured) ──────────── */}
      {isConfigured && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">User Search & Sync</CardTitle>
            </div>
            <CardDescription>
              Search for users in your AD/LDAP directory and sync group memberships to local RADIUS groups.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search bar */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Search by username, email, or display name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search
              </Button>
              <Button
                variant="outline"
                onClick={handleSyncGroups}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Groups
              </Button>
            </div>

            {/* Search Results Table */}
            {searchResults.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User DN</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Groups</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((user, index) => (
                        <TableRow key={`${user.userDn}-${index}`}>
                          <TableCell className="font-mono text-xs max-w-[300px] truncate">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate block cursor-default">{user.userDn}</span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md break-all">
                                {user.userDn}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.groups.length > 0 ? (
                                user.groups.slice(0, 3).map((group, gIdx) => (
                                  <Badge key={gIdx} variant="secondary" className="text-xs">
                                    {group.split(',').find(c => c.startsWith('CN='))?.replace('CN=', '') ?? group}
                                    {gIdx === 2 && user.groups.length > 3 && ` +${user.groups.length - 3}`}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">No groups</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              user.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' :
                              user.status === 'error' ? 'bg-red-500/10 text-red-600 border-red-200' :
                              'bg-muted text-muted-foreground border-border'
                            )}>
                              {user.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t border-border px-4 py-2 bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    {searchResults.length} user{searchResults.length !== 1 ? 's' : ''} found
                  </p>
                </div>
              </div>
            )}

            {/* Empty state when no search has been performed */}
            {searchResults.length === 0 && !searching && searchQuery && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Search className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No users found matching your search.</p>
                <p className="text-xs text-muted-foreground">Try adjusting your search query.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Save button at the bottom for convenience ────────────────── */}
      <div className="flex justify-end pb-4">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-2" />
          )}
          Save All Configuration
        </Button>
      </div>
    </div>
  );
}
