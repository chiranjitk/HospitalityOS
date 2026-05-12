'use client';

/**
 * WiFi Privacy & GDPR Consent Management — F13
 *
 * View consent logs, manage GDPR compliance settings, and monitor
 * guest consent for WiFi data collection (EU GDPR, India IT Act).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  Shield,
  Search,
  Eye,
  Ban,
  RefreshCw,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Wifi,
  Settings,
  AlertTriangle,
  Users,
  Activity,
  Clock,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ConsentGuest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
}

interface ConsentProperty {
  id: string;
  name: string;
}

interface ConsentLog {
  id: string;
  tenantId: string;
  guestId?: string | null;
  propertyId?: string | null;
  sessionId: string;
  consentType: string;
  consentTextHash: string;
  ipAddress: string;
  macAddress?: string | null;
  userAgent?: string | null;
  optInMarketing: boolean;
  dataRetentionDays: number;
  expiresAt: string;
  createdAt: string;
  guest?: ConsentGuest | null;
  property?: ConsentProperty | null;
}

interface ConsentStats {
  totalConsents: number;
  marketingOptInRate: number;
  activeConsents: number;
  consentByType: { type: string; count: number }[];
  dailyTrend: { date: string; total: number; marketing: number; wifi_access: number; data_processing: number }[];
  marketingOptInCount: number;
  totalRecords: number;
}

// ─── Helper Functions ──────────────────────────────────────────────────────────

function getConsentTypeLabel(type: string): string {
  switch (type) {
    case 'wifi_access': return 'WiFi Access';
    case 'marketing': return 'Marketing';
    case 'data_processing': return 'Data Processing';
    default: return type;
  }
}

function getConsentTypeBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (type) {
    case 'wifi_access': return 'default';
    case 'marketing': return 'secondary';
    case 'data_processing': return 'outline';
    default: return 'outline';
  }
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function WiFiConsentManagement() {
  const { toast } = useToast();

  // Data state
  const [logs, setLogs] = useState<ConsentLog[]>([]);
  const [stats, setStats] = useState<ConsentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [consentTypeFilter, setConsentTypeFilter] = useState<string>('all');
  const [optInFilter, setOptInFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('30');

  // Dialog state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ConsentLog | null>(null);

  // Settings state
  const [consentText, setConsentText] = useState(
    'By connecting to our WiFi network, you agree to our terms of service and privacy policy. ' +
    'We may collect your device information (MAC address, IP address, device type) for network management, ' +
    'security monitoring, and service improvement purposes. Your data will be retained for the duration of ' +
    'your stay plus 90 days, in compliance with applicable data protection regulations including the EU GDPR ' +
    'and India IT Act 2000. You have the right to access, correct, or delete your personal data at any time ' +
    'by contacting our front desk or emailing privacy@hotel.com.'
  );
  const [requiredTypes, setRequiredTypes] = useState({
    wifi_access: true,
    marketing: false,
    data_processing: true,
  });
  const [retentionDays, setRetentionDays] = useState('90');
  const [showMarketingOptIn, setShowMarketingOptIn] = useState(true);
  const [cookiePolicyUrl, setCookiePolicyUrl] = useState('https://hotel.com/privacy/cookies');
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  // Loading states
  const [revoking, setRevoking] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Available properties
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);

  // ─── Fetch Settings on Mount ─────────────────────────────────────────────

  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/wifi/consent-logs/settings');
        const data = await res.json();

        if (cancelled) return;

        if (data.success) {
          const s = data.data;
          if (s.consentText !== undefined) setConsentText(s.consentText);
          if (s.requiredTypes) {
            setRequiredTypes({
              wifi_access: (s.requiredTypes as string[]).includes('wifi_access'),
              marketing: (s.requiredTypes as string[]).includes('marketing'),
              data_processing: (s.requiredTypes as string[]).includes('data_processing'),
            });
          }
          if (s.retentionDays !== undefined) setRetentionDays(String(s.retentionDays));
          if (s.showMarketingOptIn !== undefined) setShowMarketingOptIn(s.showMarketingOptIn);
          if (s.cookiePolicyUrl !== undefined) setCookiePolicyUrl(s.cookiePolicyUrl);
        }
      } catch {
        /* use defaults */
      } finally {
        if (!cancelled) setSettingsLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ─── Fetch Logs ─────────────────────────────────────────────────────────────

  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set('search', searchQuery);
        if (consentTypeFilter !== 'all') params.set('consentType', consentTypeFilter);
        if (optInFilter !== 'all') params.set('optInStatus', optInFilter);
        if (propertyFilter !== 'all') params.set('propertyId', propertyFilter);
        if (dateRange !== 'all') params.set('startDate', new Date(Date.now() - parseInt(dateRange) * 86400000).toISOString());
        params.set('limit', '100');

        const res = await fetch(`/api/wifi/consent-logs?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();

        if (cancelled) return;

        if (data.success && Array.isArray(data.data)) {
          setLogs(data.data);
          if (data.stats) {
            setStats({
              totalConsents: data.stats.totalConsents,
              marketingOptInRate: data.stats.marketingOptInRate,
              activeConsents: data.stats.activeConsents,
              consentByType: [],
              dailyTrend: [],
              marketingOptInCount: 0,
              totalRecords: data.stats.totalConsents,
            });
          }

          const uniqueProps = new Map<string, { id: string; name: string }>();
          data.data.forEach((d: ConsentLog) => {
            if (d.property) uniqueProps.set(d.property.id, d.property);
          });
          setProperties(Array.from(uniqueProps.values()));
        } else {
          setLogs([]);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to fetch consent logs:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [searchQuery, consentTypeFilter, optInFilter, propertyFilter, dateRange, fetchKey]);

  // ─── Fetch Stats ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setStatsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('days', dateRange === 'all' ? '365' : dateRange);
        const res = await fetch(`/api/wifi/consent-logs/stats?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();

        if (cancelled) return;
        if (data.success && data.data) {
          setStats(data.data);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to fetch consent stats:', error);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [dateRange, fetchKey]);

  // ─── Refresh ────────────────────────────────────────────────────────────────

  const refreshData = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  // ─── View Details ───────────────────────────────────────────────────────────

  const openView = (log: ConsentLog) => {
    setSelectedLog(log);
    setViewDialogOpen(true);
  };

  // ─── Revoke Consent ────────────────────────────────────────────────────────

  const openRevoke = (log: ConsentLog) => {
    setSelectedLog(log);
    setRevokeDialogOpen(true);
  };

  const handleRevoke = async () => {
    if (!selectedLog) return;
    try {
      setRevoking(true);
      const res = await fetch(`/api/wifi/consent-logs/${selectedLog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Consent Revoked', description: 'The consent record has been revoked successfully.' });
        setRevokeDialogOpen(false);
        setSelectedLog(null);
        refreshData();
      } else {
        toast({ title: 'Revoke Failed', description: data.error?.message || 'Failed to revoke consent', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to revoke consent', variant: 'destructive' });
    } finally {
      setRevoking(false);
    }
  };

  // ─── Save Settings ────────────────────────────────────────────────────────

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const res = await fetch('/api/wifi/consent-logs/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentText,
          requiredTypes: Object.entries(requiredTypes)
            .filter(([, v]) => v)
            .map(([k]) => k),
          retentionDays: parseInt(retentionDays, 10),
          showMarketingOptIn,
          cookiePolicyUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Settings Saved', description: 'Consent management settings updated.' });
      } else {
        toast({ title: 'Save Failed', description: data.error?.message || 'Failed to save settings', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSavingSettings(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const consentRate = stats ? (stats.totalRecords > 0 ? Math.round((stats.totalConsents / stats.totalRecords) * 100) : 0) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            WiFi Privacy & GDPR Consent
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage guest consent for WiFi data collection (EU GDPR, India IT Act)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-teal-50 dark:bg-teal-950/30 p-2.5">
              <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats?.totalConsents ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Total Consents</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2.5">
              <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats?.marketingOptInRate ?? 0}%</p>
              <p className="text-xs text-muted-foreground">Marketing Opt-In</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2.5">
              <CheckCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats?.activeConsents ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Active Consents</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 p-2.5">
              <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{consentRate}%</p>
              <p className="text-xs text-muted-foreground">Consent Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="logs" className="w-full">
        <TabsList>
          <TabsTrigger value="logs" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Consent Logs
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* ─── Consent Logs Tab ────────────────────────────────────────────── */}
        <TabsContent value="logs" className="space-y-4">
          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by IP, session ID, or guest name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={consentTypeFilter} onValueChange={setConsentTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Consent Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="wifi_access">WiFi Access</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="data_processing">Data Processing</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={optInFilter} onValueChange={setOptInFilter}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Marketing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Opted In</SelectItem>
                    <SelectItem value="false">Not Opted In</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-full sm:w-[130px]">
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 Days</SelectItem>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                    <SelectItem value="90">Last 90 Days</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
                {properties.length > 0 && (
                  <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue placeholder="Property" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Consent Logs Table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-muted/50 p-4 mb-3">
                    <Shield className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground">No consent logs found</h3>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Consent records will appear here when guests connect to WiFi
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">Guest</TableHead>
                        <TableHead className="w-[120px]">Consent Type</TableHead>
                        <TableHead className="w-[120px]">IP Address</TableHead>
                        <TableHead className="w-[100px]">Marketing</TableHead>
                        <TableHead className="hidden md:table-cell w-[80px]">Retention</TableHead>
                        <TableHead className="hidden lg:table-cell w-[100px]">Expires At</TableHead>
                        <TableHead className="hidden xl:table-cell w-[100px]">Created</TableHead>
                        <TableHead className="text-right w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-muted/50">
                          <TableCell>
                            {log.guest ? (
                              <div>
                                <p className="text-sm font-medium">{log.guest.firstName} {log.guest.lastName}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Anonymous</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getConsentTypeBadgeVariant(log.consentType)} className="text-xs">
                              {getConsentTypeLabel(log.consentType)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs">{log.ipAddress}</span>
                          </TableCell>
                          <TableCell>
                            {log.optInMarketing ? (
                              <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Yes
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-400 hover:bg-gray-500 text-white border-0 text-xs gap-1">
                                <XCircle className="h-3 w-3" />
                                No
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-xs text-muted-foreground">{log.dataRetentionDays} days</span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.expiresAt), 'MMM d, yyyy')}
                            </span>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-0.5">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openView(log)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openRevoke(log)}>
                                <Ban className="h-3.5 w-3.5 text-red-500" />
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
        </TabsContent>

        {/* ─── Settings Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Consent Text Editor */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-teal-600" />
                  Consent Text
                </CardTitle>
                <CardDescription>
                  The consent text shown to guests on the captive portal
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={consentText}
                  onChange={(e) => setConsentText(e.target.value)}
                  rows={8}
                  className="text-sm"
                  placeholder="Enter the consent text that will be displayed to guests..."
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{consentText.length} characters</span>
                  <Button variant="outline" size="sm" onClick={() => setPreviewDialogOpen(true)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-2" />
                    Preview
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Consent Configuration */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4 text-teal-600" />
                  Consent Configuration
                </CardTitle>
                <CardDescription>
                  Configure required consent types and privacy settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Required Consent Types</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="type-wifi"
                        checked={requiredTypes.wifi_access}
                        onCheckedChange={(checked) => setRequiredTypes((prev) => ({ ...prev, wifi_access: !!checked }))}
                      />
                      <Label htmlFor="type-wifi" className="text-sm">WiFi Access Consent</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="type-marketing"
                        checked={requiredTypes.marketing}
                        onCheckedChange={(checked) => setRequiredTypes((prev) => ({ ...prev, marketing: !!checked }))}
                      />
                      <Label htmlFor="type-marketing" className="text-sm">Marketing Communications</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="type-data"
                        checked={requiredTypes.data_processing}
                        onCheckedChange={(checked) => setRequiredTypes((prev) => ({ ...prev, data_processing: !!checked }))}
                      />
                      <Label htmlFor="type-data" className="text-sm">Data Processing Consent</Label>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="retention" className="text-sm font-medium">Default Data Retention Period</Label>
                  <Select value={retentionDays} onValueChange={setRetentionDays}>
                    <SelectTrigger id="retention" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 Days</SelectItem>
                      <SelectItem value="60">60 Days</SelectItem>
                      <SelectItem value="90">90 Days</SelectItem>
                      <SelectItem value="180">180 Days</SelectItem>
                      <SelectItem value="365">365 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Marketing Opt-In Visibility</Label>
                    <p className="text-xs text-muted-foreground">Show marketing opt-in checkbox on portal</p>
                  </div>
                  <Switch checked={showMarketingOptIn} onCheckedChange={setShowMarketingOptIn} />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="cookie-url" className="text-sm font-medium">Cookie Policy URL</Label>
                  <Input
                    id="cookie-url"
                    value={cookiePolicyUrl}
                    onChange={(e) => setCookiePolicyUrl(e.target.value)}
                    placeholder="https://hotel.com/privacy/cookies"
                    className="text-sm"
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={savingSettings}
                  onClick={handleSaveSettings}
                >
                  {savingSettings && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── View Details Dialog ─────────────────────────────────────────────── */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Consent Details
            </DialogTitle>
            <DialogDescription>Full consent record details</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="grid gap-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Guest</span>
                  <span className="font-medium">{selectedLog.guest ? `${selectedLog.guest.firstName} ${selectedLog.guest.lastName}` : 'Anonymous'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Consent Type</span>
                  <Badge variant={getConsentTypeBadgeVariant(selectedLog.consentType)}>
                    {getConsentTypeLabel(selectedLog.consentType)}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">IP Address</span>
                  <span className="font-mono">{selectedLog.ipAddress}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">MAC Address</span>
                  <span className="font-mono">{selectedLog.macAddress || 'Not captured'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Session ID</span>
                  <span className="font-mono text-xs break-all">{selectedLog.sessionId}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Marketing Opt-In</span>
                  {selectedLog.optInMarketing ? (
                    <Badge className="bg-emerald-500 text-white border-0 text-xs">Yes</Badge>
                  ) : (
                    <Badge className="bg-gray-400 text-white border-0 text-xs">No</Badge>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Data Retention</span>
                  <span>{selectedLog.dataRetentionDays} days</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Property</span>
                  <span>{selectedLog.property?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Expires At</span>
                  <span>{format(new Date(selectedLog.expiresAt), 'PPp')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Recorded At</span>
                  <span>{format(new Date(selectedLog.createdAt), 'PPp')}</span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs mb-1">User Agent</span>
                <span className="text-xs break-all leading-relaxed">{selectedLog.userAgent || 'Not captured'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs mb-1">Consent Text Hash (SHA-256)</span>
                <span className="font-mono text-xs break-all leading-relaxed">{selectedLog.consentTextHash}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Revoke Consent Dialog ──────────────────────────────────────────── */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Revoke Consent
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke consent for{' '}
              <span className="font-mono font-medium">{selectedLog?.ipAddress}</span>?
              This will mark the associated data for deletion per GDPR requirements.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-red-600 hover:bg-red-700"
            >
              {revoking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Revoke Consent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Preview Consent Dialog ─────────────────────────────────────────── */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-teal-600" />
              Consent Screen Preview
            </DialogTitle>
            <DialogDescription>How the consent screen appears to guests</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Wifi className="h-5 w-5 text-teal-600" />
              <span className="font-medium text-sm">Hotel WiFi — Terms & Privacy</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{consentText}</p>
            <Separator />
            {showMarketingOptIn && (
              <div className="flex items-center gap-2">
                <Checkbox checked disabled />
                <Label className="text-xs">I agree to receive marketing communications and special offers</Label>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox checked disabled />
              <Label className="text-xs">I have read and agree to the terms and privacy policy</Label>
            </div>
            {cookiePolicyUrl && (
              <a href={cookiePolicyUrl} className="text-xs text-teal-600 underline" target="_blank" rel="noopener noreferrer">
                Read our Cookie Policy
              </a>
            )}
            <Separator />
            <p className="text-[10px] text-muted-foreground/60">
              Data retention: {retentionDays} days | Required: {Object.entries(requiredTypes).filter(([, v]) => v).map(([k]) => getConsentTypeLabel(k)).join(', ')}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
