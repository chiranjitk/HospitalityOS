'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ShieldCheck, ShieldAlert, FileCheck, Download, Search, Filter,
  Eye, DoorOpen, MessageSquare, Mail, CreditCard, Camera, Globe,
  AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw, Settings,
  BarChart3, TrendingUp, Users, Activity, ChevronDown, Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, subDays } from 'date-fns';

// ── Types ───────────────────────────────────────────────────────────

interface IdentityLog {
  id: string;
  tenantId: string;
  propertyId?: string | null;
  sessionId?: string | null;
  username: string;
  verificationMethod: string;
  verifiedIdentity?: string | null;
  verificationStatus: string;
  ipAddress: string;
  macAddress?: string | null;
  countryCode?: string | null;
  idType?: string | null;
  failureReason?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
}

interface VerificationStats {
  totalVerifications: number;
  verified: number;
  pending: number;
  failed: number;
  skipped: number;
  complianceRate: number;
  todayVerified: number;
  todayPending: number;
  todayFailed: number;
  todayTotal: number;
  methodBreakdown: { method: string; count: number; successRate: number }[];
  failureReasons: { reason: string; count: number }[];
  countryDistribution: { country: string; count: number }[];
}

interface ComplianceReport {
  period: string;
  totalSessions: number;
  verifiedSessions: number;
  unverifiedSessions: number;
  complianceRate: number;
  methodDistribution: { method: string; count: number; percentage: number }[];
  countryDistribution: { country: string; count: number }[];
  riskSessions: IdentityLog[];
}

// ── Constants ───────────────────────────────────────────────────────

const VERIFICATION_METHODS = [
  { value: 'none', label: 'None' },
  { value: 'room_number', label: 'Room Number' },
  { value: 'otp_sms', label: 'OTP SMS' },
  { value: 'otp_email', label: 'OTP Email' },
  { value: 'government_id', label: 'Government ID' },
  { value: 'selfie_verify', label: 'Selfie Verify' },
] as const;

const VERIFICATION_STATUSES = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'failed', label: 'Failed' },
  { value: 'skipped', label: 'Skipped' },
] as const;

const ID_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar' },
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'driving_license', label: 'Driving License' },
] as const;

const FAILURE_REASONS = [
  'Room number not found in PMS',
  'OTP expired',
  'OTP verification failed',
  'Invalid government ID',
  'ID document expired',
  'Face mismatch in selfie verification',
  'Network timeout during verification',
  'Guest denied consent',
  'Maximum retry attempts exceeded',
  'Other',
];

// ── Helper Functions ────────────────────────────────────────────────

function getMethodIcon(method: string, className = 'h-4 w-4') {
  switch (method) {
    case 'room_number': return <DoorOpen className={className} />;
    case 'otp_sms': return <MessageSquare className={className} />;
    case 'otp_email': return <Mail className={className} />;
    case 'government_id': return <CreditCard className={className} />;
    case 'selfie_verify': return <Camera className={className} />;
    default: return <ShieldAlert className={className} />;
  }
}

function getMethodLabel(method: string) {
  return VERIFICATION_METHODS.find(m => m.value === method)?.label || method;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'verified':
      return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 gap-1"><CheckCircle2 className="h-3 w-3" />Verified</Badge>;
    case 'pending':
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
    case 'failed':
      return <Badge className="bg-red-600 hover:bg-red-700 text-white border-0 gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
    case 'skipped':
      return <Badge variant="secondary" className="gap-1">Skipped</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getComplianceBadge(rate: number) {
  if (rate >= 95) return { label: `${rate.toFixed(1)}% Compliant`, className: 'bg-primary/10 dark:bg-primary/10 text-primary', icon: <ShieldCheck className="h-4 w-4 text-primary" /> };
  if (rate >= 80) return { label: `${rate.toFixed(1)}% Compliant`, className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', icon: <ShieldAlert className="h-4 w-4 text-amber-600" /> };
  return { label: `${rate.toFixed(1)}% Compliant`, className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300', icon: <ShieldAlert className="h-4 w-4 text-red-600" /> };
}

function maskIdentity(identity: string | null | undefined, method: string): string {
  if (!identity) return '—';
  if (method === 'government_id' || method === 'selfie_verify') {
    if (identity.length <= 4) return '****';
    return `****${identity.slice(-4)}`;
  }
  if (method === 'otp_sms' || method === 'otp_email') {
    const atIndex = identity.indexOf('@');
    if (atIndex > 0) {
      const local = identity.substring(0, atIndex);
      const domain = identity.substring(atIndex);
      if (local.length <= 2) return `*${domain}`;
      return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}${domain}`;
    }
    if (identity.length <= 3) return `***${identity.slice(-1)}`;
    return `${identity[0]}${'*'.repeat(identity.length - 3)}${identity.slice(-2)}`;
  }
  if (method === 'room_number') {
    if (identity.length <= 1) return `Room ****`;
    return `Room ${'*'.repeat(identity.length - 1)}${identity.slice(-1)}`;
  }
  if (identity.length <= 4) return '****';
  return `${'*'.repeat(identity.length - 4)}${identity.slice(-4)}`;
}

function getIdTypeLabel(idType: string | null | undefined) {
  return ID_TYPES.find(t => t.value === idType)?.label || idType || '—';
}

const METHOD_COLORS: Record<string, string> = {
  room_number: 'bg-primary',
  otp_sms: 'bg-blue-500',
  otp_email: 'bg-violet-500',
  government_id: 'bg-amber-500',
  selfie_verify: 'bg-rose-500',
  none: 'bg-gray-400',
};

// ── Main Component ─────────────────────────────────────────────────

export default function WiFiIdentityVerification() {
  const { toast } = useToast();

  // Data state
  const [logs, setLogs] = useState<IdentityLog[]>([]);
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [selectedLog, setSelectedLog] = useState<IdentityLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filter state
  const [methodFilter, setMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Dialog state
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showFailDialog, setShowFailDialog] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [showComplianceReport, setShowComplianceReport] = useState(false);

  // Settings saving state
  const [savingSettings, setSavingSettings] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    requiredMethods: {
      room_number: true,
      otp_sms: true,
      otp_email: true,
      government_id: false,
      selfie_verify: false,
    },
    autoVerifyRoomNumber: true,
    otpExpirySeconds: 300,
    otpMaxRetries: 3,
    enableSmsOtp: true,
    enableEmailOtp: true,
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // ── Data fetching ───────────────────────────────────────────────

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (methodFilter !== 'all') params.append('verificationMethod', methodFilter);
      if (statusFilter !== 'all') params.append('verificationStatus', statusFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (searchQuery) params.append('search', searchQuery);
      params.append('limit', String(pageSize));
      params.append('offset', String((page - 1) * pageSize));

      const res = await fetch(`/api/wifi/identity-logs?${params}`);
      if (!res.ok) {
        toast({ title: 'Error', description: `Failed to load identity logs (${res.status})`, variant: 'destructive' });
        return;
      }
      const json = await res.json();
      if (json.success) {
        setLogs(json.data || []);
        setTotal(json.pagination?.total || 0);
      } else {
        toast({ title: 'Error', description: json.error?.message || 'Failed to load identity logs', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load identity logs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [methodFilter, statusFilter, startDate, endDate, searchQuery, page, pageSize]);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await fetch('/api/wifi/identity-logs/stats');
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch {
      // Stats are supplementary; don't block UI
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load data and stats on mount and when dependencies change
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Load settings on mount
  useEffect(() => {
    let cancelled = false;
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/wifi/identity-logs/settings');
        const data = await res.json();
        if (!cancelled && data.success) {
          const s = data.data;
          if (s.requiredMethods && Array.isArray(s.requiredMethods)) {
            setSettings(prev => ({
              ...prev,
              requiredMethods: {
                ...prev.requiredMethods,
                room_number: s.requiredMethods.includes('room_number'),
                otp_sms: s.requiredMethods.includes('otp_sms'),
                otp_email: s.requiredMethods.includes('otp_email'),
                government_id: s.requiredMethods.includes('government_id'),
                selfie_verify: s.requiredMethods.includes('selfie_verify'),
              },
            }));
          }
          if (s.autoVerifyRoomNumber !== undefined) setSettings(prev => ({ ...prev, autoVerifyRoomNumber: s.autoVerifyRoomNumber }));
          if (s.enableSmsOtp !== undefined) setSettings(prev => ({ ...prev, enableSmsOtp: s.enableSmsOtp }));
          if (s.enableEmailOtp !== undefined) setSettings(prev => ({ ...prev, enableEmailOtp: s.enableEmailOtp }));
          if (s.otpExpirySeconds !== undefined) setSettings(prev => ({ ...prev, otpExpirySeconds: s.otpExpirySeconds }));
          if (s.otpMaxRetries !== undefined) setSettings(prev => ({ ...prev, otpMaxRetries: s.otpMaxRetries }));
        }
      } catch { /* use defaults */ }
    };
    fetchSettings();
    return () => { cancelled = true; };
  }, []);

  // Reset page to 1 when filters change
  const prevMethodFilter = React.useRef(methodFilter);
  const prevStatusFilter = React.useRef(statusFilter);
  const prevSearchQuery = React.useRef(searchQuery);
  useEffect(() => {
    if (prevMethodFilter.current !== methodFilter || prevStatusFilter.current !== statusFilter || prevSearchQuery.current !== searchQuery) {
      prevMethodFilter.current = methodFilter;
      prevStatusFilter.current = statusFilter;
      prevSearchQuery.current = searchQuery;
      setPage(1);
    }
  });

  // ── Actions ────────────────────────────────────────────────────

  const handleVerify = async (id: string) => {
    try {
      const res = await fetch(`/api/wifi/identity-logs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationStatus: 'verified', verifiedAt: new Date().toISOString() }),
      });
      if (!res.ok) {
        toast({ title: 'Error', description: `Verification request failed (${res.status})`, variant: 'destructive' });
        return;
      }
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Verified', description: 'Identity verified successfully' });
        fetchLogs();
        fetchStats();
      } else {
        toast({ title: 'Error', description: json.error?.message || 'Verification failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Verification failed', variant: 'destructive' });
    }
  };

  const handleMarkFailed = async () => {
    if (!selectedLog || !failReason) return;
    try {
      const res = await fetch(`/api/wifi/identity-logs/${selectedLog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationStatus: 'failed', failureReason: failReason }),
      });
      if (!res.ok) {
        toast({ title: 'Error', description: `Update request failed (${res.status})`, variant: 'destructive' });
        return;
      }
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Marked as Failed', description: 'Record updated successfully' });
        setShowFailDialog(false);
        setFailReason('');
        fetchLogs();
        fetchStats();
      } else {
        toast({ title: 'Error', description: json.error?.message || 'Update failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Update failed', variant: 'destructive' });
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      params.append('format', 'csv');
      const res = await fetch(`/api/wifi/identity-logs/export?${params}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `identity-verification-logs-${startDate}-to-${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: 'CSV exported successfully' });
    } catch {
      toast({ title: 'Error', description: 'Failed to export CSV', variant: 'destructive' });
    }
  };

  const handleGenerateReport = async () => {
    try {
      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      const res = await fetch(`/api/wifi/identity-logs/stats?${params}`);
      if (!res.ok) {
        toast({ title: 'Error', description: `Failed to generate report (${res.status})`, variant: 'destructive' });
        return;
      }
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        // Fetch risk sessions (failed/skipped) from the API for the report's date range
        const riskParams = new URLSearchParams();
        riskParams.append('startDate', startDate);
        riskParams.append('endDate', endDate);
        riskParams.append('verificationStatus', 'failed');
        riskParams.append('limit', '5');
        riskParams.append('offset', '0');
        const [riskRes1, riskRes2] = await Promise.all([
          fetch(`/api/wifi/identity-logs?${riskParams}`).then(r => r.json()),
          fetch(`/api/wifi/identity-logs?${new URLSearchParams({ ...Object.fromEntries(riskParams), verificationStatus: 'skipped' })}`).then(r => r.json()),
        ]);
        const riskLogs = [
          ...(riskRes1.success ? (riskRes1.data || []) : []),
          ...(riskRes2.success ? (riskRes2.data || []) : []),
        ].slice(0, 10);

        const report: ComplianceReport = {
          period: `${startDate} to ${endDate}`,
          totalSessions: d.totalVerifications,
          verifiedSessions: d.verified,
          unverifiedSessions: d.totalVerifications - d.verified,
          complianceRate: d.complianceRate,
          methodDistribution: (d.methodBreakdown || []).map((m: { method: string; count: number; successRate: number }) => ({
            method: m.method,
            count: m.count,
            percentage: d.totalVerifications > 0 ? (m.count / d.totalVerifications) * 100 : 0,
          })),
          countryDistribution: d.countryDistribution || [],
          riskSessions: riskLogs,
        };
        setComplianceReport(report);
        setShowComplianceReport(true);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to generate compliance report', variant: 'destructive' });
    }
  };

  // ── Settings persistence ─────────────────────────────────────

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const requiredMethodsList = Object.entries(settings.requiredMethods)
        .filter(([, enabled]) => enabled)
        .map(([method]) => method);
      const res = await fetch('/api/wifi/identity-logs/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requiredMethods: requiredMethodsList,
          autoVerifyRoomNumber: settings.autoVerifyRoomNumber,
          enableSmsOtp: settings.enableSmsOtp,
          enableEmailOtp: settings.enableEmailOtp,
          otpExpirySeconds: settings.otpExpirySeconds,
          otpMaxRetries: settings.otpMaxRetries,
        }),
      });
      if (!res.ok) {
        toast({ title: 'Error', description: `Failed to save settings (${res.status})`, variant: 'destructive' });
        return;
      }
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Settings Saved', description: 'Identity verification settings updated.' });
      } else {
        toast({ title: 'Save Failed', description: data.error || 'Failed to save settings', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Derived data ───────────────────────────────────────────────

  const complianceBadge = getComplianceBadge(stats?.complianceRate || 0);
  const totalPages = Math.ceil(total / pageSize);

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Identity Verification &amp; KYC</h2>
              <p className="text-sm text-muted-foreground">
                Regulatory compliance for WiFi access (India IT Act, GDPR, UAE, Saudi Arabia)
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge className={`text-sm font-semibold px-3 py-1 ${complianceBadge.className}`}>
            {complianceBadge.icon}
            {complianceBadge.label}
          </Badge>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            of sessions verified in last 90 days
          </span>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Dashboard</span></TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><FileCheck className="h-4 w-4" /><span className="hidden sm:inline">Verification Logs</span></TabsTrigger>
          <TabsTrigger value="compliance" className="gap-1.5"><ShieldCheck className="h-4 w-4" /><span className="hidden sm:inline">Compliance Report</span></TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Settings className="h-4 w-4" /><span className="hidden sm:inline">Settings</span></TabsTrigger>
        </TabsList>

        {/* ═══════════ DASHBOARD TAB ═══════════ */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Verification Rate */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Verification Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {statsLoading ? '...' : `${(stats?.complianceRate || 0).toFixed(1)}%`}
                </div>
                <div className="mt-2 space-y-1">
                  <Progress value={stats?.complianceRate || 0} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Current</span>
                    <span className="text-amber-600 font-medium">Target: 95%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sessions Today */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Sessions Today</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{statsLoading ? '...' : stats?.todayTotal || 0}</div>
                <div className="flex gap-3 mt-2 text-xs">
                  <span className="text-primary font-medium">
                    <CheckCircle2 className="inline h-3 w-3 mr-0.5" />{stats?.todayVerified || 0} verified
                  </span>
                  <span className="text-amber-600 font-medium">
                    <Clock className="inline h-3 w-3 mr-0.5" />{stats?.todayPending || 0} pending
                  </span>
                  <span className="text-red-600 font-medium">
                    <XCircle className="inline h-3 w-3 mr-0.5" />{stats?.todayFailed || 0} failed
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Total Verifications */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Total Verifications</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{statsLoading ? '...' : stats?.totalVerifications || 0}</div>
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{stats?.verified || 0} verified</span>
                  <span>{stats?.failed || 0} failed</span>
                  <span>{stats?.skipped || 0} skipped</span>
                </div>
              </CardContent>
            </Card>

            {/* Pending Verifications */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{statsLoading ? '...' : stats?.pending || 0}</div>
                <p className="text-xs text-muted-foreground mt-2">Require manual attention</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Method Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Method Breakdown</CardTitle>
                <CardDescription>Verification methods used by guests</CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="space-y-3"><div className="h-4 bg-muted rounded animate-pulse w-full" /><div className="h-4 bg-muted rounded animate-pulse w-3/4" /><div className="h-4 bg-muted rounded animate-pulse w-1/2" /></div>
                ) : stats?.methodBreakdown && stats.methodBreakdown.length > 0 ? (
                  <div className="space-y-4">
                    {stats.methodBreakdown.map(m => {
                      const maxCount = Math.max(...stats!.methodBreakdown.map(x => x.count), 1);
                      const pct = (m.count / maxCount) * 100;
                      return (
                        <div key={m.method} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {getMethodIcon(m.method, 'h-3.5 w-3.5')}
                              <span className="font-medium">{getMethodLabel(m.method)}</span>
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground">
                              <span>{m.count} sessions</span>
                              <span className="text-primary font-medium">{m.successRate.toFixed(0)}% success</span>
                            </div>
                          </div>
                          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${METHOD_COLORS[m.method] || 'bg-gray-400'}`}
                              style={{ width: `${pct}%`, transition: 'width 0.6s ease' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No verification data yet</p>
                )}
              </CardContent>
            </Card>

            {/* Top Failure Reasons */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Failure Reasons</CardTitle>
                <CardDescription>Common reasons for verification failures</CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="space-y-3"><div className="h-4 bg-muted rounded animate-pulse w-full" /><div className="h-4 bg-muted rounded animate-pulse w-3/4" /></div>
                ) : stats?.failureReasons && stats.failureReasons.length > 0 ? (
                  <div className="space-y-3">
                    {stats.failureReasons.map((f, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 text-xs font-bold">
                            {i + 1}
                          </div>
                          <span className="text-sm">{f.reason || 'Unknown'}</span>
                        </div>
                        <Badge variant="secondary">{f.count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No failures recorded</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════ LOGS TAB ═══════════ */}
        <TabsContent value="logs" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by username, IP..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={methodFilter} onValueChange={setMethodFilter}>
                  <SelectTrigger><SelectValue placeholder="Method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    {VERIFICATION_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    {VERIFICATION_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1" />
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{total} log entries found</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={fetchLogs}><RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh</Button>
                  <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-3.5 w-3.5 mr-1" />Export CSV</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[520px] overflow-auto">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Verified Identity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">IP Address</TableHead>
                      <TableHead className="hidden lg:table-cell">Country</TableHead>
                      <TableHead className="hidden lg:table-cell">ID Type</TableHead>
                      <TableHead className="hidden xl:table-cell">Verified At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12">
                          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Loading verification logs...</p>
                        </TableCell>
                      </TableRow>
                    ) : logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12">
                          <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                          <p className="text-sm text-muted-foreground">No verification logs found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map(log => (
                        <TableRow key={log.id} className="group">
                          <TableCell>
                            <span className="font-mono text-sm">{log.username}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1.5">
                              {getMethodIcon(log.verificationMethod, 'h-3 w-3')}
                              <span className="hidden sm:inline">{getMethodLabel(log.verificationMethod)}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-mono">
                              {maskIdentity(log.verifiedIdentity, log.verificationMethod)}
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(log.verificationStatus)}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm font-mono text-muted-foreground">{log.ipAddress}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {log.countryCode ? (
                              <span className="flex items-center gap-1 text-sm"><Globe className="h-3 w-3" />{log.countryCode}</span>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">{getIdTypeLabel(log.idType)}</TableCell>
                          <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                            {log.verifiedAt ? format(new Date(log.verifiedAt), 'MMM d, HH:mm') : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="View details" onClick={() => { setSelectedLog(log); setShowDetailsDialog(true); }}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {log.verificationStatus === 'pending' && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary/80" title="Verify" onClick={() => handleVerify(log.id)}>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {log.verificationStatus !== 'failed' && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700" title="Mark failed" onClick={() => { setSelectedLog(log); setShowFailDialog(true); }}>
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </div>
            </CardContent>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({total} entries)
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ═══════════ COMPLIANCE TAB ═══════════ */}
        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Compliance Report Generator</CardTitle>
              <CardDescription>Generate regulatory compliance reports for WiFi identity verification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={handleGenerateReport} className="flex-1 gap-2"><FileCheck className="h-4 w-4" />Generate Report</Button>
                  <Button variant="outline" onClick={handleExport} className="gap-2"><Download className="h-4 w-4" />Export CSV</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {complianceReport && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Report Summary: {complianceReport.period}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50 space-y-1">
                      <p className="text-sm text-muted-foreground">Total WiFi Sessions</p>
                      <p className="text-2xl font-bold">{complianceReport.totalSessions}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-primary/5 dark:bg-primary/10 space-y-1">
                      <p className="text-sm text-muted-foreground">Verified Sessions</p>
                      <p className="text-2xl font-bold text-primary">{complianceReport.verifiedSessions}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 space-y-1">
                      <p className="text-sm text-muted-foreground">Unverified Sessions (Risk)</p>
                      <p className="text-2xl font-bold text-red-700 dark:text-red-400">{complianceReport.unverifiedSessions}</p>
                    </div>
                    <div className="p-4 rounded-lg space-y-1">
                      <p className="text-sm text-muted-foreground">Compliance Rate</p>
                      <p className={`text-2xl font-bold ${complianceReport.complianceRate >= 95 ? 'text-primary' : complianceReport.complianceRate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                        {complianceReport.complianceRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Method Distribution</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {complianceReport.methodDistribution.map(m => (
                        <div key={m.method} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getMethodIcon(m.method, 'h-3.5 w-3.5')}
                            <span className="text-sm">{getMethodLabel(m.method)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-24 bg-muted rounded-full h-2 overflow-hidden">
                              <div className={`h-full rounded-full ${METHOD_COLORS[m.method] || 'bg-gray-400'}`} style={{ width: `${m.percentage}%` }} />
                            </div>
                            <span className="text-sm text-muted-foreground w-16 text-right">{m.count} ({m.percentage.toFixed(1)}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Country Distribution of IDs</CardTitle></CardHeader>
                  <CardContent>
                    {complianceReport.countryDistribution.length > 0 ? (
                      <div className="space-y-3">
                        {complianceReport.countryDistribution.map(c => (
                          <div key={c.country} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">{c.country}</span>
                            </div>
                            <Badge variant="secondary">{c.count}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No country data available</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {complianceReport.riskSessions.length > 0 && (
                <Card className="border-red-200 dark:border-red-900">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-red-700 dark:text-red-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />Risk Sessions (Unverified)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-64 overflow-auto">
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>IP Address</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {complianceReport.riskSessions.map(s => (
                            <TableRow key={s.id}>
                              <TableCell className="font-mono text-sm">{s.username}</TableCell>
                              <TableCell><Badge variant="outline" className="gap-1">{getMethodIcon(s.verificationMethod, 'h-3 w-3')}{getMethodLabel(s.verificationMethod)}</Badge></TableCell>
                              <TableCell>{getStatusBadge(s.verificationStatus)}</TableCell>
                              <TableCell className="font-mono text-sm">{s.ipAddress}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{format(new Date(s.createdAt), 'MMM d, HH:mm')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ═══════════ SETTINGS TAB ═══════════ */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Required Verification Methods</CardTitle>
                <CardDescription>Select which methods guests can use to verify identity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(settings.requiredMethods).map(([method, enabled]) => (
                  <div key={method} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-3">
                      {getMethodIcon(method)}
                      <div>
                        <Label className="font-medium">{getMethodLabel(method)}</Label>
                        <p className="text-xs text-muted-foreground">
                          {method === 'room_number' && 'Verify against PMS room database'}
                          {method === 'otp_sms' && 'Send one-time password via SMS'}
                          {method === 'otp_email' && 'Send one-time password via email'}
                          {method === 'government_id' && 'Guest uploads government-issued ID'}
                          {method === 'selfie_verify' && 'AI-based facial matching'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={checked => {
                        if (checked === false) {
                          const enabledCount = Object.values(settings.requiredMethods).filter(Boolean).length;
                          if (enabledCount <= 1) {
                            toast({ title: 'Cannot disable', description: 'At least one verification method must be enabled.', variant: 'destructive' });
                            return;
                          }
                        }
                        setSettings(s => ({ ...s, requiredMethods: { ...s.requiredMethods, [method]: checked } }));
                      }}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Auto-Verify Settings</CardTitle>
                <CardDescription>Configure automatic verification rules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Auto-verify room numbers against PMS</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically verify guests who provide a valid room number matching an active booking
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoVerifyRoomNumber}
                    onCheckedChange={checked => setSettings(s => ({ ...s, autoVerifyRoomNumber: checked }))}
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Enable SMS OTP</Label>
                      <p className="text-xs text-muted-foreground">Allow guests to verify via SMS</p>
                    </div>
                    <Switch
                      checked={settings.enableSmsOtp}
                      onCheckedChange={checked => setSettings(s => ({ ...s, enableSmsOtp: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Enable Email OTP</Label>
                      <p className="text-xs text-muted-foreground">Allow guests to verify via email</p>
                    </div>
                    <Switch
                      checked={settings.enableEmailOtp}
                      onCheckedChange={checked => setSettings(s => ({ ...s, enableEmailOtp: checked }))}
                    />
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="otpExpiry">OTP Expiry (seconds)</Label>
                    <Input
                      id="otpExpiry"
                      type="number"
                      value={settings.otpExpirySeconds}
                      onChange={e => setSettings(s => ({ ...s, otpExpirySeconds: parseInt(e.target.value) || 300 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="otpRetries">Max OTP Retries</Label>
                    <Input
                      id="otpRetries"
                      type="number"
                      value={settings.otpMaxRetries}
                      onChange={e => setSettings(s => ({ ...s, otpMaxRetries: parseInt(e.target.value) || 3 }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Button className="gap-2" disabled={savingSettings} onClick={handleSaveSettings}>
                {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Details Dialog ─── */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Verification Log Details
            </DialogTitle>
            <DialogDescription>Full details of this identity verification entry</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label className="text-muted-foreground">Username</Label><p className="font-mono mt-0.5">{selectedLog.username}</p></div>
                <div><Label className="text-muted-foreground">Session ID</Label><p className="font-mono mt-0.5 text-sm text-muted-foreground">{selectedLog.sessionId || '—'}</p></div>
                <div>
                  <Label className="text-muted-foreground">Verification Method</Label>
                  <div className="mt-0.5"><Badge variant="outline" className="gap-1.5">{getMethodIcon(selectedLog.verificationMethod)}{getMethodLabel(selectedLog.verificationMethod)}</Badge></div>
                </div>
                <div><Label className="text-muted-foreground">Status</Label><div className="mt-0.5">{getStatusBadge(selectedLog.verificationStatus)}</div></div>
                <div><Label className="text-muted-foreground">Verified Identity</Label><p className="font-mono mt-0.5">{maskIdentity(selectedLog.verifiedIdentity, selectedLog.verificationMethod)}</p></div>
                <div><Label className="text-muted-foreground">ID Type</Label><p className="mt-0.5">{getIdTypeLabel(selectedLog.idType)}</p></div>
                <div><Label className="text-muted-foreground">IP Address</Label><p className="font-mono mt-0.5">{selectedLog.ipAddress}</p></div>
                <div><Label className="text-muted-foreground">MAC Address</Label><p className="font-mono mt-0.5">{selectedLog.macAddress || '—'}</p></div>
                <div><Label className="text-muted-foreground">Country</Label><p className="mt-0.5">{selectedLog.countryCode ? <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{selectedLog.countryCode}</span> : '—'}</p></div>
                <div><Label className="text-muted-foreground">Created</Label><p className="mt-0.5 text-sm">{format(new Date(selectedLog.createdAt), 'PPP p')}</p></div>
                <div><Label className="text-muted-foreground">Verified At</Label><p className="mt-0.5 text-sm">{selectedLog.verifiedAt ? format(new Date(selectedLog.verifiedAt), 'PPP p') : '—'}</p></div>
                {selectedLog.failureReason && (
                  <div className="col-span-2"><Label className="text-muted-foreground">Failure Reason</Label><p className="mt-0.5 text-sm text-red-600">{selectedLog.failureReason}</p></div>
                )}
              </div>
              <Separator />
              <div className="flex justify-end gap-2">
                {selectedLog.verificationStatus === 'pending' && (
                  <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => { handleVerify(selectedLog.id); setShowDetailsDialog(false); }}>
                    <CheckCircle2 className="h-4 w-4" />Verify Identity
                  </Button>
                )}
                {selectedLog.verificationStatus !== 'failed' && (
                  <Button variant="destructive" className="gap-2" onClick={() => { setShowDetailsDialog(false); setShowFailDialog(true); }}>
                    <XCircle className="h-4 w-4" />Mark Failed
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Fail Reason Dialog ─── */}
      <Dialog open={showFailDialog} onOpenChange={setShowFailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Mark Verification as Failed</DialogTitle>
            <DialogDescription>Select or enter a reason for the verification failure</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={failReason} onValueChange={setFailReason}>
              <SelectTrigger><SelectValue placeholder="Select a reason..." /></SelectTrigger>
              <SelectContent>
                {FAILURE_REASONS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Or enter a custom reason..."
              value={failReason}
              onChange={e => setFailReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowFailDialog(false); setFailReason(''); }}>Cancel</Button>
            <Button variant="destructive" disabled={!failReason} onClick={handleMarkFailed}>
              Confirm Failure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}
