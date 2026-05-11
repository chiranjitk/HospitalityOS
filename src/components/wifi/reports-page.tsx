'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  Upload,
  Users,
  Globe,
  Clock,
  Search,
  Filter,
  FileDown,
  FileText,
  RefreshCw,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Server,
  Ticket,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  Shield,
  Radio,
  Zap,
  Eye,
  MoreHorizontal,
  ChevronDown,
  Calendar,
  Wifi,
  ArrowUpDown,
  Copy,
  Trash2,
  Plus,
  Settings,
  Play,
  Pause,
  Square,
  Monitor,
  Thermometer,
  Loader2,
  FileCheck,
  History,
  Bell,
  Network,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePropertyId } from '@/hooks/use-property';

// ==================== LAZY-LOADED TAB COMPONENTS ====================

const CoaAuditTab = lazy(() => import('./coa-audit'));
const UserStatusHistoryTab = lazy(() => import('./user-status-history'));
const SyslogTab = lazy(() => import('./syslog-tab'));

// ==================== LOADING SPINNER ====================

function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

// ==================== HELPERS ====================

function formatBytes(bytes: number) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatMB(mb: number) {
  if (mb >= 1048576) return `${(mb / 1048576).toFixed(2)} TB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function formatDuration(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ==================== SVG GAUGE ====================

function CircularGauge({ value, label, color, size = 120 }: { value: number; label: string; color: string; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const colorMap: Record<string, { stroke: string; text: string }> = {
    teal: { stroke: 'stroke-teal-500', text: 'text-teal-600 dark:text-teal-400' },
    amber: { stroke: 'stroke-amber-500', text: 'text-amber-600 dark:text-amber-400' },
    emerald: { stroke: 'stroke-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
    red: { stroke: 'stroke-red-500', text: 'text-red-600 dark:text-red-400' },
  };
  const c = colorMap[color] || colorMap.teal;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" className="stroke-muted/30" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={c.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size, marginTop: -size - 4 }}>
        <span className={cn('text-2xl font-bold', c.text)}>{value}%</span>
      </div>
      <span className="text-xs font-medium text-muted-foreground mt-1">{label}</span>
    </div>
  );
}

// ==================== TAB TYPES ====================

type TabId = 'bandwidth' | 'user-bw' | 'web-surfing' | 'nat-logs' | 'voucher' | 'sys-health' | 'coa-audit' | 'user-status-history' | 'syslog';

function SortIcon({ col, isActive }: { col: string; isActive: boolean }) {
  return <ArrowUpDown className={cn('h-3 w-3 ml-1 inline', isActive ? 'opacity-100' : 'opacity-30')} />;
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'bandwidth', label: 'Bandwidth Usage', icon: BarChart3 },
  { id: 'user-bw', label: 'User Bandwidth', icon: Users },
  { id: 'web-surfing', label: 'Web Surfing', icon: Globe },
  { id: 'nat-logs', label: 'NAT Logs', icon: Shield },
  { id: 'syslog', label: 'Syslog Forwarding', icon: Radio },
  { id: 'voucher', label: 'Voucher Report', icon: Ticket },
  { id: 'sys-health', label: 'System Health', icon: Activity },
  { id: 'coa-audit', label: 'CoA Audit', icon: FileCheck },
  { id: 'user-status-history', label: 'User History', icon: History },
];

// ==================== MAIN COMPONENT ====================

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('bandwidth');
  const tabsRef = useRef<HTMLDivElement>(null);

  const scrollToTab = (tabId: string) => {
    setActiveTab(tabId as TabId);
    // Scroll the clicked tab into view
    setTimeout(() => {
      const el = document.getElementById(`tab-btn-${tabId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 50);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Tab Navigation */}
        <div className="relative">
          <div ref={tabsRef} className="flex gap-1 rounded-lg bg-muted/50 p-1 overflow-x-auto scrollbar-thin" style={{ scrollbarWidth: 'thin' }}>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-btn-${tab.id}`}
                  onClick={() => scrollToTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap shrink-0',
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          {/* Scroll hint arrows */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none rounded-r-lg" />
        </div>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          {activeTab === 'bandwidth' && <BandwidthUsageTab />}
          {activeTab === 'user-bw' && <UserBandwidthTab />}
          {activeTab === 'web-surfing' && <WebSurfingTab />}
          {activeTab === 'nat-logs' && <NATLogsTab />}
          {activeTab === 'voucher' && <VoucherReportTab />}
          {activeTab === 'sys-health' && <SystemHealthTab />}
          {activeTab === 'coa-audit' && (
            <Suspense fallback={<LoadingSpinner message="Loading CoA Audit..." />}>
              <CoaAuditTab />
            </Suspense>
          )}
          {activeTab === 'user-status-history' && (
            <Suspense fallback={<LoadingSpinner message="Loading User History..." />}>
              <UserStatusHistoryTab />
            </Suspense>
          )}
          {activeTab === 'syslog' && (
            <Suspense fallback={<LoadingSpinner message="Loading Syslog Forwarding..." />}>
              <SyslogTab />
            </Suspense>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ==================== TAB 1: BANDWIDTH USAGE ====================

// Custom Recharts tooltip matching shadcn/ui theme
function BandwidthChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-lg text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium">{formatMB(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

function BandwidthUsageTab() {
  const [dateRange, setDateRange] = useState('30');
  const [property, setProperty] = useState('all');
  const [bandwidthData, setBandwidthData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { propertyId, properties } = usePropertyId();

  const fetchBandwidth = useCallback(async (range: string) => {
    setLoading(true);
    try {
      const days = range === 'today' ? 1 : range === '7' ? 7 : 30;
      const endDate = new Date().toISOString().split('T')[0];
      const start = new Date();
      start.setDate(start.getDate() - days);
      const startDate = start.toISOString().split('T')[0];
      const params = new URLSearchParams({ startDate, endDate });
      if (property !== 'all' && propertyId) params.set('propertyId', propertyId);
      const res = await fetch(`/api/wifi/reports/bandwidth?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setBandwidthData(result.data || []);
      } else {
        toast({ title: 'Error', description: typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to fetch bandwidth data', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to fetch bandwidth data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, property, propertyId]);

  useEffect(() => {
    fetchBandwidth(dateRange);
  }, [dateRange, fetchBandwidth]);

  const filteredData = useMemo(() => {
    const count = dateRange === 'today' ? 1 : dateRange === '7' ? 7 : 30;
    return bandwidthData.slice(-count);
  }, [bandwidthData, dateRange]);

  // Prepare chart data with formatted date labels
  const chartData = useMemo(() => {
    return filteredData.map(d => ({
      ...d,
      dateLabel: formatDate(d.date),
    }));
  }, [filteredData]);

  const summary = useMemo(() => {
    if (filteredData.length === 0) return { totalDown: 0, totalUp: 0, uniqueUsers: 0, peakTime: '—', activeSessions: 0 };
    const totalDown = filteredData.reduce((s, d) => s + d.download, 0);
    const totalUp = filteredData.reduce((s, d) => s + d.upload, 0);
    const uniqueUsers = Math.max(...filteredData.map(d => d.users));
    const peakDay = filteredData.reduce((a, b) => a.download > b.download ? a : b);
    const activeSessions = filteredData[filteredData.length - 1]?.activeSessions || 0;
    return { totalDown, totalUp, uniqueUsers, peakTime: peakDay?.peakTime || '—', activeSessions };
  }, [filteredData]);

  if (loading) return <LoadingSpinner message="Loading bandwidth data..." />;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Period:</span>
            </div>
            <div className="flex gap-2">
              {[
                { value: 'today', label: 'Today' },
                { value: '7', label: '7 Days' },
                { value: '30', label: '30 Days' },
              ].map((p) => (
                <Button key={p.value} variant={dateRange === p.value ? 'default' : 'outline'} size="sm" onClick={() => setDateRange(p.value)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="hidden sm:block w-px h-6 bg-border" />
            <Select value={property} onValueChange={setProperty}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const headers = 'Date,Download (MB),Upload (MB),Total (MB),Users,Peak Time,Active Sessions';
                const rows = filteredData.map(d => `${d.date},${d.download},${d.upload},${d.total},${d.users},${d.peakTime},${d.activeSessions}`);
                const csv = [headers, ...rows].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `bandwidth-report-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast({ title: 'Exported', description: 'CSV file downloaded' });
              }}>
                <FileDown className="h-3.5 w-3.5 mr-1.5" /> CSV
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF
                  </Button>
                </TooltipTrigger>
                <TooltipContent>PDF export coming soon — uses print for now</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard icon={Download} label="Total Download" value={formatMB(summary.totalDown)} color="teal" />
        <SummaryCard icon={Upload} label="Total Upload" value={formatMB(summary.totalUp)} color="amber" />
        <SummaryCard icon={Users} label="Unique Users" value={summary.uniqueUsers.toString()} color="emerald" />
        <SummaryCard icon={Clock} label="Peak Usage" value={summary.peakTime} color="amber" />
        <SummaryCard icon={Wifi} label="Active Sessions" value={summary.activeSessions.toString()} color="emerald" />
      </div>

      {/* Recharts AreaChart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Daily Bandwidth</CardTitle>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-teal-500" /> Download</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500" /> Upload</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientDownload" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradientUpload" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatMB(v)}
                  width={65}
                />
                <RechartsTooltip content={<BandwidthChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="download"
                  name="Download"
                  stroke="#14b8a6"
                  fill="url(#gradientDownload)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="upload"
                  name="Upload"
                  stroke="#f59e0b"
                  fill="url(#gradientUpload)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
              No bandwidth data available for the selected period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detailed Usage Data</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
          <div className="max-h-96 overflow-x-auto overflow-y-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs whitespace-nowrap">Date</TableHead>
                  <TableHead className="text-xs whitespace-nowrap text-right hidden sm:table-cell">DL (MB)</TableHead>
                  <TableHead className="text-xs whitespace-nowrap text-right hidden sm:table-cell">UL (MB)</TableHead>
                  <TableHead className="text-xs whitespace-nowrap text-right">Total</TableHead>
                  <TableHead className="text-xs whitespace-nowrap text-right hidden md:table-cell">Users</TableHead>
                  <TableHead className="text-xs whitespace-nowrap text-right hidden md:table-cell">Peak</TableHead>
                  <TableHead className="text-xs whitespace-nowrap hidden lg:table-cell">Peak Time</TableHead>
                  <TableHead className="text-xs whitespace-nowrap text-right hidden lg:table-cell">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((day) => (
                  <TableRow key={day.date} className="hover:bg-muted/30">
                    <TableCell className="text-xs sm:text-sm font-medium whitespace-nowrap">{formatDate(day.date)}</TableCell>
                    <TableCell className="text-right text-teal-600 dark:text-teal-400 font-mono text-xs sm:text-sm hidden sm:table-cell">{day.download.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-amber-600 dark:text-amber-400 font-mono text-xs sm:text-sm hidden sm:table-cell">{day.upload.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-xs sm:text-sm font-medium whitespace-nowrap">{day.total.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs sm:text-sm hidden md:table-cell">{day.users}</TableCell>
                    <TableCell className="text-right text-xs sm:text-sm hidden md:table-cell">{day.peakUsers || day.users}</TableCell>
                    <TableCell className="hidden lg:table-cell"><Badge variant="secondary" className="text-xs">{day.peakTime}</Badge></TableCell>
                    <TableCell className="text-right hidden lg:table-cell"><Badge variant={day.activeSessions > 0 ? 'default' : 'secondary'} className="text-xs">{day.activeSessions}</Badge></TableCell>
                  </TableRow>
                ))}
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-xs">
                      No data found for the selected period. Bandwidth data is sourced from RADIUS accounting sessions.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, trend, color }: { icon: React.ElementType; label: string; value: string; trend?: number; color: string }) {
  const colorClasses: Record<string, string> = {
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold truncate">{value}</p>
        </div>
        {trend !== undefined && (
          <div className={cn('flex items-center gap-0.5 text-xs font-medium', trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
    </Card>
  );
}

// ==================== TAB 2: USER BANDWIDTH ====================

// Custom Recharts tooltip for user bar chart
function UserBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-lg text-xs">
      <p className="font-medium mb-1 truncate max-w-48">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium">{formatMB(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

function UserBandwidthTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string>('totalDown');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [usersData, setUsersData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      params.set('limit', '100');
      const res = await fetch(`/api/wifi/reports/user-bandwidth?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setUsersData(result.data || []);
      } else {
        toast({ title: 'Error', description: typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to fetch user bandwidth', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to fetch user bandwidth', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    let users = [...usersData];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      users = users.filter(u =>
        u.username.toLowerCase().includes(q) || u.ip.toLowerCase().includes(q) || (u.mac && u.mac.toLowerCase().includes(q))
      );
    }
    users.sort((a, b) => {
      const aVal = a[sortKey as keyof typeof a] as number | string;
      const bVal = b[sortKey as keyof typeof b] as number | string;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
    return users;
  }, [usersData, searchQuery, sortKey, sortDir]);

  const topDownloaders = useMemo(() => [...usersData].sort((a, b) => b.totalDown - a.totalDown).slice(0, 10), [usersData]);
  const topUploaders = useMemo(() => [...usersData].sort((a, b) => b.totalUp - a.totalUp).slice(0, 10), [usersData]);

  // Prepare chart data for Recharts
  const downloadChartData = useMemo(() =>
    [...topDownloaders].reverse().map(u => ({
      name: u.username.split('.').slice(-2).join('.'), // Short name
      fullName: u.username,
      download: u.totalDown,
      upload: u.totalUp,
    })),
    [topDownloaders]
  );

  const uploadChartData = useMemo(() =>
    [...topUploaders].reverse().map(u => ({
      name: u.username.split('.').slice(-2).join('.'),
      fullName: u.username,
      download: u.totalDown,
      upload: u.totalUp,
    })),
    [topUploaders]
  );

  const planAgg = useMemo(() => {
    const plans: Record<string, { count: number; totalDown: number; totalUp: number }> = {};
    usersData.forEach(u => {
      const plan = u.plan || 'Unknown';
      if (!plans[plan]) plans[plan] = { count: 0, totalDown: 0, totalUp: 0 };
      plans[plan].count++;
      plans[plan].totalDown += u.totalDown;
      plans[plan].totalUp += u.totalUp;
    });
    return plans;
  }, [usersData]);

  const summaryStats = useMemo(() => {
    if (usersData.length === 0) return { totalUsers: 0, totalBw: 0, avgPerUser: 0, topConsumer: '—' };
    const totalBw = usersData.reduce((s, u) => s + u.totalDown + u.totalUp, 0);
    const top = usersData.reduce((a, b) => a.totalDown + a.totalUp > b.totalDown + b.totalUp ? a : b);
    return {
      totalUsers: usersData.length,
      totalBw,
      avgPerUser: totalBw / usersData.length,
      topConsumer: top.username,
    };
  }, [usersData]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  if (loading) return <LoadingSpinner message="Loading user bandwidth..." />;

  return (
    <div className="space-y-4">
      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by username, IP, or MAC address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={Users} label="Total Users" value={summaryStats.totalUsers.toString()} color="emerald" />
        <SummaryCard icon={BarChart3} label="Total Bandwidth" value={formatMB(summaryStats.totalBw)} color="teal" />
        <SummaryCard icon={TrendingUp} label="Avg / User" value={formatMB(summaryStats.avgPerUser)} color="amber" />
        <SummaryCard icon={Download} label="Top Consumer" value={summaryStats.topConsumer.split('.').slice(-2).join('.')} color="teal" />
      </div>

      {/* Top 10 Charts with Recharts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4 text-teal-500 dark:text-teal-400" /> Top 10 by Download
            </CardTitle>
          </CardHeader>
          <CardContent>
            {downloadChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={downloadChartData} layout="vertical" margin={{ top: 0, right: 10, left: 80, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatMB(v)} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={75} />
                  <RechartsTooltip content={<UserBarTooltip />} />
                  <Bar dataKey="download" name="Download" fill="#14b8a6" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">No data</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-amber-500 dark:text-amber-400" /> Top 10 by Upload
            </CardTitle>
          </CardHeader>
          <CardContent>
            {uploadChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={uploadChartData} layout="vertical" margin={{ top: 0, right: 10, left: 80, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatMB(v)} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={75} />
                  <RechartsTooltip content={<UserBarTooltip />} />
                  <Bar dataKey="upload" name="Upload" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Aggregate Cards */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Average Usage per Plan Tier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(planAgg).map(([plan, data]) => {
              const avgDown = Math.round(data.totalDown / data.count);
              const avgUp = Math.round(data.totalUp / data.count);
              const total = avgDown + avgUp;
              const downPct = total > 0 ? (avgDown / total) * 100 : 50;
              return (
                <div key={plan} className="rounded-lg border p-3">
                  <Badge variant={plan.includes('VIP') ? 'default' : plan.includes('Premium') ? 'secondary' : 'outline'} className="mb-2 text-xs">{plan}</Badge>
                  <p className="text-xs text-muted-foreground">{data.count} user{data.count !== 1 ? 's' : ''}</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-teal-600 dark:text-teal-400">↓ {formatMB(avgDown)}</span>
                      <span className="text-amber-600 dark:text-amber-400">↑ {formatMB(avgUp)}</span>
                    </div>
                    <div className="flex gap-0.5 h-2">
                      <div className="bg-gradient-to-r from-teal-400 to-emerald-400 rounded-l-sm transition-all" style={{ width: `${downPct}%` }} />
                      <div className="bg-gradient-to-r from-amber-400 to-orange-400 rounded-r-sm transition-all" style={{ width: `${100 - downPct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Down</span>
                      <span>Up</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">User Bandwidth Details</CardTitle>
          <CardDescription>Click a row to expand session history</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
          <div className="max-h-96 overflow-x-auto overflow-y-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer text-xs whitespace-nowrap" onClick={() => handleSort('username')}>Username <SortIcon col="username" isActive={sortKey === 'username'} /></TableHead>
                  <TableHead className="cursor-pointer text-xs whitespace-nowrap hidden sm:table-cell" onClick={() => handleSort('ip')}>IP <SortIcon col="ip" isActive={sortKey === 'ip'} /></TableHead>
                  <TableHead className="text-xs whitespace-nowrap hidden md:table-cell">MAC</TableHead>
                  <TableHead className="text-xs whitespace-nowrap hidden lg:table-cell">Plan</TableHead>
                  <TableHead className="cursor-pointer text-xs whitespace-nowrap text-right hidden md:table-cell" onClick={() => handleSort('sessions')}>Sessions <SortIcon col="sessions" isActive={sortKey === 'sessions'} /></TableHead>
                  <TableHead className="cursor-pointer text-xs whitespace-nowrap text-right" onClick={() => handleSort('totalDown')}>DL <SortIcon col="totalDown" isActive={sortKey === 'totalDown'} /></TableHead>
                  <TableHead className="cursor-pointer text-xs whitespace-nowrap text-right" onClick={() => handleSort('totalUp')}>UL <SortIcon col="totalUp" isActive={sortKey === 'totalUp'} /></TableHead>
                  <TableHead className="cursor-pointer text-xs whitespace-nowrap text-right hidden lg:table-cell" onClick={() => handleSort('avgDuration')}>Avg Dur <SortIcon col="avgDuration" isActive={sortKey === 'avgDuration'} /></TableHead>
                  <TableHead className="text-xs whitespace-nowrap hidden lg:table-cell">Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <React.Fragment key={user.username}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setExpandedUser(expandedUser === user.username ? null : user.username)}
                    >
                      <TableCell className="text-xs sm:text-sm font-medium whitespace-nowrap">{user.username}</TableCell>
                      <TableCell className="font-mono text-xs sm:text-sm hidden sm:table-cell">{user.ip}</TableCell>
                      <TableCell className="font-mono text-[10px] sm:text-xs text-muted-foreground hidden md:table-cell">{user.mac}</TableCell>
                      <TableCell className="hidden lg:table-cell"><Badge variant="outline" className="text-[10px] sm:text-xs">{user.plan}</Badge></TableCell>
                      <TableCell className="text-right text-xs sm:text-sm hidden md:table-cell">{user.sessions}</TableCell>
                      <TableCell className="text-right text-teal-600 dark:text-teal-400 font-mono text-xs sm:text-sm">{formatMB(user.totalDown)}</TableCell>
                      <TableCell className="text-right text-amber-600 dark:text-amber-400 font-mono text-xs sm:text-sm">{formatMB(user.totalUp)}</TableCell>
                      <TableCell className="text-right text-xs sm:text-sm hidden lg:table-cell">{formatDuration(user.avgDuration)}</TableCell>
                      <TableCell className="text-[10px] sm:text-xs text-muted-foreground hidden lg:table-cell">{user.lastSeen ? new Date(user.lastSeen).toLocaleDateString() : '—'}</TableCell>
                    </TableRow>
                    {expandedUser === user.username && (
                      <TableRow className="bg-muted/10">
                        <TableCell colSpan={9}>
                          <div className="p-3 ml-4">
                            <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Clock className="h-3 w-3" /> Session History for {user.username}</p>
                            {user.sessionHistory && user.sessionHistory.length > 0 ? (
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-[10px] sm:text-xs whitespace-nowrap">Session</TableHead>
                                      <TableHead className="text-[10px] sm:text-xs whitespace-nowrap">Start</TableHead>
                                      <TableHead className="text-[10px] sm:text-xs whitespace-nowrap">End</TableHead>
                                      <TableHead className="text-[10px] sm:text-xs whitespace-nowrap hidden sm:table-cell">NAS</TableHead>
                                      <TableHead className="text-[10px] sm:text-xs whitespace-nowrap text-right">DL</TableHead>
                                      <TableHead className="text-[10px] sm:text-xs whitespace-nowrap text-right">UL</TableHead>
                                      <TableHead className="text-[10px] sm:text-xs whitespace-nowrap text-right">Duration</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {user.sessionHistory.map((s: any) => (
                                      <TableRow key={s.id}>
                                        <TableCell className="font-mono text-[10px] sm:text-xs whitespace-nowrap">{s.id.substring(0, 8)}...</TableCell>
                                        <TableCell className="text-[10px] sm:text-xs whitespace-nowrap">{s.start ? new Date(s.start).toLocaleString() : '—'}</TableCell>
                                        <TableCell className="text-[10px] sm:text-xs whitespace-nowrap">{s.end ? new Date(s.end).toLocaleString() : 'Active'}</TableCell>
                                        <TableCell className="font-mono text-[10px] sm:text-xs text-muted-foreground hidden sm:table-cell">{s.nas || '—'}</TableCell>
                                        <TableCell className="text-[10px] sm:text-xs text-right text-teal-600 dark:text-teal-400 font-mono whitespace-nowrap">{formatMB(s.download)}</TableCell>
                                        <TableCell className="text-[10px] sm:text-xs text-right text-amber-600 dark:text-amber-400 font-mono whitespace-nowrap">{formatMB(s.upload)}</TableCell>
                                        <TableCell className="text-[10px] sm:text-xs text-right whitespace-nowrap">{formatDuration(s.duration)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No session history available</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8 text-xs">
                      {usersData.length === 0
                        ? 'No user bandwidth data. Data is sourced from RADIUS accounting sessions.'
                        : 'No users match your search.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== TAB 3: WEB SURFING ====================

function WebSurfingTab() {
  const [domainSearch, setDomainSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [surfingLogs, setSurfingLogs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [dataSource, setDataSource] = useState<string>('demo');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const ALL_CATEGORIES = [
    { value: 'social_media', label: 'Social Media' },
    { value: 'video', label: 'Video' },
    { value: 'streaming', label: 'Streaming' },
    { value: 'shopping', label: 'Shopping' },
    { value: 'tech', label: 'Technology' },
    { value: 'communication', label: 'Communication' },
    { value: 'news', label: 'News' },
    { value: 'food', label: 'Food & Dining' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'education', label: 'Education' },
    { value: 'travel', label: 'Travel' },
    { value: 'gaming', label: 'Gaming' },
    { value: 'other', label: 'Other' },
  ];

  const catColors: Record<string, string> = {
    social_media: 'text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30',
    video: 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30',
    streaming: 'text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/30',
    shopping: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
    tech: 'text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/30',
    communication: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
    news: 'text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30',
    food: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
    entertainment: 'text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-100 dark:bg-fuchsia-900/30',
    education: 'text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/30',
    travel: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30',
    gaming: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
    other: 'text-gray-600 bg-gray-100 dark:bg-gray-800/30',
  };

  const catGradient: Record<string, string> = {
    social_media: '#8b5cf6',
    video: '#f43f5e',
    streaming: '#ec4899',
    shopping: '#f59e0b',
    tech: '#0ea5e9',
    communication: '#3b82f6',
    news: '#14b8a6',
    food: '#f97316',
    entertainment: '#d946ef',
    education: '#06b6d4',
    travel: '#10b981',
    gaming: '#ef4444',
    other: '#6b7280',
  };

  const handleExportCSV = useCallback(() => {
    const headers = 'Domain,Source IP,Src Port,Dest IP,Dest Port,Interface,Guest Name,Category,Connections,Bytes,Last Accessed';
    const rows = surfingLogs.map(l => `${l.domain},${l.sourceIp || l.source_ip},${l.srcPort || ''},${l.destIp || ''},${l.destPort || ''},${l.inIface || ''},${l.guestName || ''},${l.category},${l.connections},${l.totalBytes},${l.lastAccess || l.last_access}`);
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `web-surfing-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Web surfing CSV downloaded' });
  }, [surfingLogs, toast]);

  const fetchWebSurfing = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (domainSearch) params.set('search', domainSearch);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      const res = await fetch(`/api/wifi/reports/web-surfing?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setSurfingLogs(result.data || []);
        setSummary(result.summary || null);
        setCategories(result.categories || []);
        setDataSource(result.dataSource || 'demo');
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to fetch web surfing logs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [domainSearch, categoryFilter, toast]);

  useEffect(() => {
    fetchWebSurfing();
  }, [fetchWebSurfing]);

  const filteredLogs = useMemo(() => {
    let logs = [...surfingLogs];
    if (domainSearch) {
      const q = domainSearch.toLowerCase();
      logs = logs.filter(l => l.domain.includes(q) || (l.sourceIp || l.source_ip || '').includes(q) || (l.guestName || '').toLowerCase().includes(q));
    }
    if (categoryFilter !== 'all') {
      logs = logs.filter(l => l.category === categoryFilter);
    }
    return logs;
  }, [surfingLogs, domainSearch, categoryFilter]);

  const topDomains = useMemo(() => {
    const counts: Record<string, { domain: string; bytes: number; count: number }> = {};
    surfingLogs.forEach(l => {
      if (!counts[l.domain]) counts[l.domain] = { domain: l.domain, bytes: 0, count: 0 };
      counts[l.domain].bytes += l.totalBytes;
      counts[l.domain].count += l.connections;
    });
    return Object.values(counts).sort((a, b) => b.bytes - a.bytes).slice(0, 20);
  }, [surfingLogs]);

  const maxDomainBytes = topDomains[0]?.bytes || 1;

  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    surfingLogs.forEach(l => { cats[l.category] = (cats[l.category] || 0) + l.totalBytes; });
    const total = Object.values(cats).reduce((s, v) => s + v, 0);
    return Object.entries(cats).map(([name, bytes]) => ({ name, bytes, pct: total > 0 ? (bytes / total) * 100 : 0 })).sort((a, b) => b.bytes - a.bytes);
  }, [surfingLogs]);

  const pieGradient = useMemo(() => {
    return categoryBreakdown.reduce<{ result: string; cumulative: number }>((acc, c) => {
      const start = acc.cumulative;
      const end = start + c.pct;
      const segment = `${catGradient[c.name] || '#6b7280'} ${start.toFixed(1)}% ${end.toFixed(1)}%`;
      return { result: acc.result ? `${acc.result}, ${segment}` : segment, cumulative: end };
    }, { result: '', cumulative: 0 }).result;
  }, [categoryBreakdown]);

  if (loading) return <LoadingSpinner message="Loading web surfing logs..." />;

  return (
    <div className="space-y-4">
      {/* Privacy Notice + Data Source */}
      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
        <Eye className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Domain-level access logs only. Full URL tracking disabled for guest privacy (GDPR/PIPL).</p>
          <Badge variant={dataSource === 'clickhouse' ? 'default' : 'secondary'} className={cn('mt-1 text-xs', dataSource === 'clickhouse' && 'bg-emerald-600')}>
            <Database className="h-3 w-3 mr-1" />
            {dataSource === 'clickhouse' ? 'ClickHouse Live' : dataSource === 'ulogd2' ? 'ulogd2 Live' : 'Demo Data'}
          </Badge>
        </div>
      </div>

      {/* 4 Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3 sm:p-4"><div className="flex items-center gap-2 sm:gap-3 min-w-0"><Globe className="h-6 w-6 sm:h-8 sm:w-8 text-violet-500 flex-shrink-0" /><div className="min-w-0"><p className="text-[10px] sm:text-xs text-muted-foreground truncate">Total Domains</p><p className="text-lg sm:text-xl font-bold truncate">{(summary.totalDomains || 0).toLocaleString()}</p></div></div></Card>
          <Card className="p-3 sm:p-4"><div className="flex items-center gap-2 sm:gap-3 min-w-0"><Activity className="h-6 w-6 sm:h-8 sm:w-8 text-teal-500 flex-shrink-0" /><div className="min-w-0"><p className="text-[10px] sm:text-xs text-muted-foreground truncate">Total Traffic</p><p className="text-lg sm:text-xl font-bold truncate">{formatBytes(summary.totalBytes || 0)}</p></div></div></Card>
          <Card className="p-3 sm:p-4"><div className="flex items-center gap-2 sm:gap-3 min-w-0"><Users className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500 flex-shrink-0" /><div className="min-w-0"><p className="text-[10px] sm:text-xs text-muted-foreground truncate">Unique Users</p><p className="text-lg sm:text-xl font-bold truncate">{(summary.uniqueUsers || 0).toLocaleString()}</p></div></div></Card>
          <Card className="p-3 sm:p-4"><div className="flex items-center gap-2 sm:gap-3 min-w-0"><TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-rose-500 flex-shrink-0" /><div className="min-w-0"><p className="text-[10px] sm:text-xs text-muted-foreground truncate">Top Category</p><p className="text-lg sm:text-xl font-bold capitalize truncate">{(summary.topCategory || 'other').replace('_', ' ')}</p></div></div></Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search domain, IP, or guest name..." value={domainSearch} onChange={(e) => setDomainSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {ALL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleExportCSV}><FileDown className="h-3.5 w-3.5 mr-1.5" /> Export</Button>
          </div>
        </CardContent>
      </Card>

      {/* Top Domains + Category Pie */}
      <div className="grid md:grid-cols-3 gap-3 sm:gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">Top 20 Most Visited Domains</CardTitle></CardHeader>
          <CardContent className="overflow-hidden">
            <ScrollArea className="max-h-64">
              <div className="space-y-1.5">
                {topDomains.map((d, i) => (
                  <div key={d.domain} className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-[10px] sm:text-xs text-muted-foreground w-4 sm:w-5 flex-shrink-0">{i + 1}</span>
                    <span className="text-[10px] sm:text-xs font-mono w-20 sm:w-36 truncate flex-shrink-0">{d.domain}</span>
                    <div className="flex-1 h-2.5 sm:h-3 bg-muted rounded-sm overflow-hidden min-w-0">
                      <div className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-sm" style={{ width: `${(d.bytes / maxDomainBytes) * 100}%` }} />
                    </div>
                    <span className="text-[10px] sm:text-xs text-muted-foreground w-12 sm:w-16 text-right flex-shrink-0">{formatBytes(d.bytes)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">Category Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              {categoryBreakdown.length > 0 ? (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full" style={{ background: `conic-gradient(${pieGradient})` }} />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-muted flex items-center justify-center"><span className="text-xs text-muted-foreground">No data</span></div>
              )}
              <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 w-full">
                {categoryBreakdown.map(c => (
                  <div key={c.name} className="flex items-center justify-between text-[10px] sm:text-xs">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: catGradient[c.name] }} />
                      <span className="truncate">{c.name.replace('_', ' ')}</span>
                    </span>
                    <span className="font-medium flex-shrink-0">{c.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Domain Access Logs Table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base">Domain Access Logs</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-hidden">
          <div className="max-h-96 overflow-x-auto overflow-y-auto">
            <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs whitespace-nowrap">Timestamp</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Domain</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Source IP</TableHead>
                    <TableHead className="text-xs whitespace-nowrap hidden lg:table-cell">Src Port</TableHead>
                    <TableHead className="text-xs whitespace-nowrap hidden lg:table-cell">Dest IP</TableHead>
                    <TableHead className="text-xs whitespace-nowrap hidden lg:table-cell">Dst Port</TableHead>
                    <TableHead className="text-xs whitespace-nowrap hidden xl:table-cell">Interface</TableHead>
                    <TableHead className="text-xs whitespace-nowrap hidden sm:table-cell">Guest Name</TableHead>
                    <TableHead className="text-xs whitespace-nowrap hidden md:table-cell">Category</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">Conns</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">Bytes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground text-xs">No web surfing data available. Data will appear once the DNS logging pipeline is active.</TableCell></TableRow>
                  ) : filteredLogs.slice(0, 200).map((log, idx) => (
                    <TableRow key={log.id || `${log.domain}-${log.sourceIp || log.source_ip}-${idx}`} className="hover:bg-muted/30">
                      <TableCell className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">{new Date(log.timestamp || log.lastAccess || log.last_access).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs sm:text-sm max-w-[100px] sm:max-w-[180px] truncate">{log.domain}</TableCell>
                      <TableCell className="font-mono text-[10px] sm:text-xs text-teal-600 dark:text-teal-400 whitespace-nowrap">{log.sourceIp || log.source_ip}</TableCell>
                      <TableCell className="font-mono text-[10px] sm:text-xs text-muted-foreground hidden lg:table-cell">{log.srcPort || <span className="text-muted-foreground/50">—</span>}</TableCell>
                      <TableCell className="font-mono text-[10px] sm:text-xs text-muted-foreground hidden lg:table-cell">{log.destIp || <span className="text-muted-foreground/50">—</span>}</TableCell>
                      <TableCell className="font-mono text-[10px] sm:text-xs text-muted-foreground hidden lg:table-cell">{log.destPort || 443}</TableCell>
                      <TableCell className="text-[10px] sm:text-xs hidden xl:table-cell">
                        {log.inIface ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono h-5">{log.inIface}</Badge>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="text-[10px] sm:text-xs hidden sm:table-cell">{log.guestName || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className={cn('text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium', catColors[log.category] || catColors.other)}>
                          {(log.category || 'other').replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-[10px] sm:text-sm">{log.connections}</TableCell>
                      <TableCell className="text-right font-mono text-[10px] sm:text-sm">{formatBytes(log.totalBytes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== TAB 4: NAT LOGS ====================

function NATLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [dataSource, setDataSource] = useState<string>('demo');
  const [searchQuery, setSearchQuery] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [guestOnly, setGuestOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const handleExportCSV = useCallback(() => {
    const headers = 'Timestamp,Source IP:Port,NAT IP:Port,Dest IP:Port,Proto,Event Type,Download,Upload,Packets,Duration(s),Domain,Guest Name,Action';
    const rows = logs.map(l => `${l.timestamp},${l.source_ip}:${l.src_port},${l.nat_src_ip || ''}:${l.nat_src_port || ''},${l.dest_ip}:${l.dst_port},${l.proto},${l.event_type || '-'},${l.bytes_orig || 0},${l.bytes_reply || 0},${l.packets || 0},${l.duration || 0},${l.domain || ''},${l.guestName || ''},${l.action || 'allow'}`);
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nat-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'NAT logs CSV downloaded' });
  }, [logs, toast]);

  const fetchNATLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('sourceIp', searchQuery);
      if (protocolFilter !== 'all') params.set('protocol', protocolFilter);
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (guestOnly) params.set('guestOnly', 'true');
      const res = await fetch(`/api/wifi/reports/nat-logs?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setLogs(result.data || []);
        setSummary(result.summary || null);
        setDataSource(result.dataSource || 'demo');
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to fetch NAT logs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, protocolFilter, actionFilter, guestOnly, toast]);

  useEffect(() => { fetchNATLogs(); }, [fetchNATLogs]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => (l.source_ip || l.sourceIp || '').includes(q) || (l.dest_ip || l.destIp || '').includes(q) || (l.guestName || '').toLowerCase().includes(q));
    }
    if (protocolFilter !== 'all') result = result.filter(l => (l.proto || l.protocol) === protocolFilter);
    if (actionFilter !== 'all') result = result.filter(l => l.action === actionFilter);
    return result;
  }, [logs, searchQuery, protocolFilter, actionFilter]);

  if (loading) return <LoadingSpinner message="Loading NAT logs..." />;

  // Format timestamp with date
  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
      const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      return `${date} ${time}`;
    } catch {
      return ts;
    }
  };

  return (
    <div className="space-y-4">
      {/* IPDR Badge + Data Source */}
      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
        <Shield className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">NAT connection logs for IPDR compliance (TRAI). Data retained for minimum 1 year.</p>
          <div className="flex gap-2 mt-1">
            <Badge variant={dataSource === 'clickhouse' ? 'default' : 'secondary'} className={cn('text-xs', dataSource === 'clickhouse' && 'bg-emerald-600')}>
              <Database className="h-3 w-3 mr-1" />
              {dataSource === 'clickhouse' ? 'ClickHouse Live' : dataSource === 'ulogd2' ? 'ulogd2 Live' : 'Demo Data'}
            </Badge>
            <Badge variant="outline" className="text-xs"><Shield className="h-3 w-3 mr-1" />IPDR Compliant</Badge>
          </div>
        </div>
      </div>

      {/* 4 Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3 sm:p-4"><div className="flex items-center gap-2 sm:gap-3 min-w-0"><Activity className="h-6 w-6 sm:h-8 sm:w-8 text-sky-500 flex-shrink-0" /><div className="min-w-0"><p className="text-[10px] sm:text-xs text-muted-foreground truncate">Total Connections</p><p className="text-lg sm:text-xl font-bold truncate">{(summary.totalConnections || 0).toLocaleString()}</p></div></div></Card>
          <Card className="p-3 sm:p-4"><div className="flex items-center gap-2 sm:gap-3 min-w-0"><Download className="h-6 w-6 sm:h-8 sm:w-8 text-teal-500 flex-shrink-0" /><div className="min-w-0"><p className="text-[10px] sm:text-xs text-muted-foreground truncate">Total Traffic</p><p className="text-lg sm:text-xl font-bold truncate">{formatBytes(summary.totalBytes || 0)}</p></div></div></Card>
          <Card className="p-3 sm:p-4"><div className="flex items-center gap-2 sm:gap-3 min-w-0"><Users className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500 flex-shrink-0" /><div className="min-w-0"><p className="text-[10px] sm:text-xs text-muted-foreground truncate">Unique Sources</p><p className="text-lg sm:text-xl font-bold truncate">{(summary.uniqueSources || 0).toLocaleString()}</p></div></div></Card>
          <Card className="p-3 sm:p-4"><div className="flex items-center gap-2 sm:gap-3 min-w-0"><Network className="h-6 w-6 sm:h-8 sm:w-8 text-violet-500 flex-shrink-0" /><div className="min-w-0"><p className="text-[10px] sm:text-xs text-muted-foreground truncate">Top Protocol</p><p className="text-lg sm:text-xl font-bold uppercase truncate">{summary.topProtocol || 'tcp'}</p></div></div></Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search IP, domain, or guest name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={protocolFilter} onValueChange={setProtocolFilter}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Proto</SelectItem>
                <SelectItem value="tcp">TCP</SelectItem>
                <SelectItem value="udp">UDP</SelectItem>
                <SelectItem value="icmp">ICMP</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="allow">Allow</SelectItem>
                <SelectItem value="deny">Deny</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={guestOnly ? 'default' : 'outline'}
              size="sm"
              className={cn('w-full sm:w-auto', guestOnly && 'bg-emerald-600 hover:bg-emerald-700')}
              onClick={() => setGuestOnly(!guestOnly)}
            >
              <Users className="h-3.5 w-3.5 mr-1.5" />
              {guestOnly ? 'Guests Only' : 'All Traffic'}
            </Button>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleExportCSV}><FileDown className="h-3.5 w-3.5 mr-1.5" /> Export</Button>
          </div>
        </CardContent>
      </Card>

      {/* NAT Logs Table */}
      <Card>
        <CardContent className="p-0 overflow-hidden">
          <div className="max-h-[500px] overflow-x-auto overflow-y-auto">
              <Table className="min-w-max">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="text-[10px] sm:text-xs whitespace-nowrap">Timestamp</TableHead>
                    <TableHead className="text-[10px] sm:text-xs whitespace-nowrap">Source</TableHead>
                    <TableHead className="text-[10px] sm:text-xs whitespace-nowrap hidden sm:table-cell">NAT</TableHead>
                    <TableHead className="text-[10px] sm:text-xs whitespace-nowrap hidden lg:table-cell">Dest</TableHead>
                    <TableHead className="text-[10px] sm:text-xs whitespace-nowrap">Proto</TableHead>
                    <TableHead className="text-[10px] sm:text-xs whitespace-nowrap hidden sm:table-cell">Event</TableHead>
                    <TableHead className="text-[10px] sm:text-xs whitespace-nowrap text-right">↓ DL</TableHead>
                    <TableHead className="text-[10px] sm:text-xs whitespace-nowrap text-right">↑ UL</TableHead>
                    <TableHead className="text-[10px] sm:text-xs whitespace-nowrap text-right hidden md:table-cell">Pkts</TableHead>
                    <TableHead className="text-[10px] sm:text-xs whitespace-nowrap hidden md:table-cell">Domain</TableHead>
                    <TableHead className="text-[10px] sm:text-xs whitespace-nowrap hidden lg:table-cell">Guest</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground text-xs">No NAT log data available. Data will appear once the conntrack logging pipeline is active.</TableCell></TableRow>
                  ) : filteredLogs.slice(0, 200).map((log, idx) => (
                    <TableRow key={log.id || `nat-${idx}`} className={cn('hover:bg-muted/30', (log.action === 'deny') && 'bg-red-50/50 dark:bg-red-950/10')}>
                      <TableCell className="text-[10px] sm:text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] sm:text-xs whitespace-nowrap">
                        <span className="text-teal-600 dark:text-teal-400">{log.source_ip || log.sourceIp}</span>:<span className="text-muted-foreground">{log.src_port || log.sourcePort}</span>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] sm:text-xs whitespace-nowrap hidden sm:table-cell">
                        {log.nat_src_ip ? (
                          <span className="text-violet-600 dark:text-violet-400">{log.nat_src_ip}<span className="text-muted-foreground">:{log.nat_src_port}</span></span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] sm:text-xs whitespace-nowrap hidden lg:table-cell">
                        <span className="text-amber-600 dark:text-amber-400">{log.dest_ip || log.destIp}</span>:<span className="text-muted-foreground">{log.dst_port || log.destPort}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={(log.proto || log.protocol) === 'tcp' ? 'default' : 'outline'} className="text-[10px] sm:text-xs uppercase font-mono">
                          {log.proto || log.protocol}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {(log.event_type || log.eventType) && (
                          <Badge variant="outline" className={cn('text-[10px] sm:text-xs font-mono', (log.event_type || log.eventType) === 'DESTROY' && 'text-red-500 border-red-200 dark:border-red-800', (log.event_type || log.eventType) === 'NEW' && 'text-emerald-500 border-emerald-200 dark:border-emerald-800')}>
                            {log.event_type || log.eventType}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-[10px] sm:text-xs font-mono text-teal-600 dark:text-teal-400 whitespace-nowrap">{formatBytes(log.bytes_orig || 0)}</TableCell>
                      <TableCell className="text-right text-[10px] sm:text-xs font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap">{formatBytes(log.bytes_reply || 0)}</TableCell>
                      <TableCell className="text-right text-[10px] sm:text-xs font-mono hidden md:table-cell">{(log.packets || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-[10px] sm:text-xs font-mono max-w-[100px] sm:max-w-[120px] truncate hidden md:table-cell">{log.domain || '—'}</TableCell>
                      <TableCell className="text-[10px] sm:text-xs hidden lg:table-cell">{log.guestName || <span className="text-muted-foreground">—</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== TAB 5: VOUCHER REPORT ====================

interface VoucherRow {
  id: string;
  code: string;
  planName: string;
  guestName: string | null;
  status: string;
  isUsed: boolean;
  validFrom: string;
  validUntil: string;
  usedAt: string | null;
  issuedTo: string | null;
  issuedAt: string | null;
  notes: string | null;
  propertyName: string;
  createdAt: string;
}

interface VoucherSummary {
  total: number;
  active: number;
  used: number;
  expired: number;
  revoked: number;
  redemptionRate: number;
  expiringSoon: number;
}

interface PlanBreakdown {
  planId: string;
  planName: string;
  total: number;
  used: number;
  active: number;
  expired: number;
  redemptionRate: number;
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  used: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  expired: 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400',
  revoked: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function VoucherReportTab() {
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [summary, setSummary] = useState<VoucherSummary | null>(null);
  const [planBreakdown, setPlanBreakdown] = useState<PlanBreakdown[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/wifi/reports/voucher?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setSummary(result.data?.summary || null);
        setPlanBreakdown(result.data?.planBreakdown || []);
        setVouchers(result.data?.vouchers || []);
      } else {
        toast({ title: 'Error', description: typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to fetch voucher report', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to fetch voucher report', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, toast]);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  const handleExportCSV = useCallback(() => {
    const headers = 'Code,Plan,Guest,Status,Used,Valid From,Valid Until,Used At,Issued To,Issued At,Notes';
    const rows = vouchers.map(v => [
      v.code, v.planName, v.guestName || '', v.status, v.isUsed ? 'Yes' : 'No',
      v.validFrom, v.validUntil, v.usedAt || '', v.issuedTo || '', v.issuedAt || '', v.notes || '',
    ].map(f => `"${f}"`).join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voucher-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Voucher report CSV downloaded' });
  }, [vouchers, toast]);

  if (loading) return <LoadingSpinner message="Loading voucher report..." />;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Status:</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'used', label: 'Used' },
                { value: 'expired', label: 'Expired' },
                { value: 'revoked', label: 'Revoked' },
              ].map((s) => (
                <Button key={s.value} variant={statusFilter === s.value ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s.value)}>
                  {s.label}
                  {summary && s.value !== 'all' && (
                    <span className="ml-1.5 text-xs opacity-70">{summary[s.value as keyof VoucherSummary] as number || 0}</span>
                  )}
                </Button>
              ))}
            </div>
            <div className="hidden sm:block w-px h-6 bg-border" />
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code or issued to..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <FileDown className="h-3.5 w-3.5 mr-1.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={fetchVouchers}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <SummaryCard icon={Ticket} label="Total Vouchers" value={summary.total.toString()} color="teal" />
          <SummaryCard icon={CheckCircle2} label="Active" value={summary.active.toString()} color="emerald" />
          <SummaryCard icon={Wifi} label="Used (Redeemed)" value={summary.used.toString()} color="teal" />
          <SummaryCard icon={AlertTriangle} label="Redemption Rate" value={`${summary.redemptionRate.toFixed(0)}%`} color="amber" />
          <SummaryCard icon={Clock} label="Expiring Soon" value={summary.expiringSoon.toString()} color={summary.expiringSoon > 0 ? 'red' : 'emerald'} />
        </div>
      )}

      {/* Plan Breakdown */}
      {planBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Plan Adoption
            </CardTitle>
            <CardDescription>Voucher usage breakdown by WiFi plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {planBreakdown.map((plan) => (
                <div key={plan.planId} className="rounded-lg border p-3 space-y-2">
                  <p className="text-sm font-medium truncate">{plan.planName}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{plan.total} voucher{plan.total !== 1 ? 's' : ''}</span>
                    <Badge className={cn('text-xs', statusColors[plan.active > 0 ? 'active' : 'expired'])}>
                      {plan.active} active
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Redeemed</span>
                      <span>{plan.redemptionRate.toFixed(0)}%</span>
                    </div>
                    <div className="flex h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-teal-400 to-emerald-400 transition-all rounded-full"
                        style={{ width: `${plan.redemptionRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400">{plan.used} used</span>
                    <span className="text-gray-500">{plan.expired} expired</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Voucher Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Voucher Details</CardTitle>
          <CardDescription>
            {vouchers.length} voucher{vouchers.length !== 1 ? 's' : ''} found
            {statusFilter !== 'all' && ` (filtered: ${statusFilter})`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
          <div className="max-h-96 overflow-x-auto overflow-y-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs whitespace-nowrap">Code</TableHead>
                  <TableHead className="text-xs whitespace-nowrap hidden sm:table-cell">Plan</TableHead>
                  <TableHead className="text-xs whitespace-nowrap">Guest</TableHead>
                  <TableHead className="text-xs whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-xs whitespace-nowrap hidden md:table-cell">Validity</TableHead>
                  <TableHead className="text-xs whitespace-nowrap hidden lg:table-cell">Used At</TableHead>
                  <TableHead className="text-xs whitespace-nowrap hidden lg:table-cell">Issued</TableHead>
                  <TableHead className="text-xs whitespace-nowrap text-right hidden xl:table-cell">Property</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.map((v) => (
                  <TableRow key={v.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Ticket className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="font-mono font-medium text-[10px] sm:text-sm">{v.code}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(v.code);
                            toast({ title: 'Copied', description: `Voucher code ${v.code} copied to clipboard` });
                          }}
                        >
                          <Copy className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell"><Badge variant="outline" className="text-[10px] sm:text-xs">{v.planName}</Badge></TableCell>
                    <TableCell className="text-[10px] sm:text-xs">
                      {v.guestName ? (
                        <span className="font-medium">{v.guestName}</span>
                      ) : v.issuedTo ? (
                        <span>{v.issuedTo}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-[10px] sm:text-xs', statusColors[v.status] || '')}>
                        {v.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] sm:text-xs text-muted-foreground hidden md:table-cell">
                      <div>{new Date(v.validFrom).toLocaleDateString()}</div>
                      <div>→ {new Date(v.validUntil).toLocaleDateString()}</div>
                    </TableCell>
                    <TableCell className="text-[10px] sm:text-xs hidden lg:table-cell">
                      {v.usedAt ? new Date(v.usedAt).toLocaleString() : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-[10px] sm:text-xs hidden lg:table-cell">
                      {v.issuedAt ? new Date(v.issuedAt).toLocaleDateString() : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-[10px] sm:text-xs text-muted-foreground truncate max-w-32 hidden xl:table-cell">{v.propertyName}</TableCell>
                  </TableRow>
                ))}
                {vouchers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-xs">
                      {searchQuery || statusFilter !== 'all'
                        ? 'No vouchers match your filters.'
                        : 'No vouchers found. Create vouchers from the WiFi Management section.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== TAB 6: SYSTEM HEALTH ====================

// --- Helper: Color coding for metric thresholds ---
function getMetricColor(value: number): { bg: string; text: string; icon: string; spark: string } {
  if (value > 80) return { bg: 'bg-red-500/10 dark:bg-red-500/15', text: 'text-red-600 dark:text-red-400', icon: 'text-red-500 dark:text-red-400', spark: '#f43f5e' };
  if (value > 60) return { bg: 'bg-amber-500/10 dark:bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', icon: 'text-amber-500 dark:text-amber-400', spark: '#f59e0b' };
  return { bg: 'bg-teal-500/10 dark:bg-teal-500/15', text: 'text-teal-600 dark:text-teal-400', icon: 'text-teal-500 dark:text-teal-400', spark: '#14b8a6' };
}

// --- Helper: SVG sparkline ---
function MiniSparkline({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
    </svg>
  );
}

// --- Helper: format HH:MM:SS from epoch (handles both seconds and ms timestamps) ---
function formatTime(ts: number): string {
  // Real-time history uses ms timestamps, RRD uses seconds
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const d = new Date(ms);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// --- Helper: format bandwidth (input: bytes/sec → output: human-readable Kbps/Mbps/Gbps) ---
function formatBandwidth(bytesPerSec: number): string {
  // Convert bytes/sec to bits/sec, then to human-readable units
  const bps = bytesPerSec * 8;
  const gbps = bps / 1_000_000_000;
  const mbps = bps / 1_000_000;
  const kbps = bps / 1_000;
  if (gbps >= 1) return `${gbps.toFixed(1)} Gbps`;
  if (mbps >= 1) return `${mbps.toFixed(1)} Mbps`;
  if (kbps >= 1) return `${kbps.toFixed(0)} Kbps`;
  if (bytesPerSec > 0) return `${bytesPerSec.toFixed(0)} B/s`;
  return '0 B/s';
}

// Keep formatMbps as alias for backward compat (re-export)
const formatMbps = formatBandwidth;

// --- Helper: format session time HH:MM:SS ---
function formatSessionTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// --- Helper: format bytes with color ---
function formatBytesColored(bytes: number): { text: string; color: string } {
  const gb = bytes / (1024 * 1024 * 1024);
  const mb = bytes / (1024 * 1024);
  if (gb >= 1) return { text: `${gb.toFixed(1)} GB`, color: gb > 10 ? 'text-amber-600 dark:text-amber-400' : 'text-teal-600 dark:text-teal-400' };
  return { text: `${mb.toFixed(1)} MB`, color: 'text-muted-foreground' };
}

// --- Range selector component ---
function RangeSelector({ value, onChange, ranges }: { value: string; onChange: (r: string) => void; ranges?: string[] }) {
  const opts = ranges || ['1h', '6h', '24h', '7d', '30d', '1y'];
  return (
    <div className="flex gap-1">
      {opts.map(r => (
        <Button key={r} variant={value === r ? 'default' : 'outline'} size="sm" className="h-7 px-2.5 text-xs" onClick={() => onChange(r)}>
          {r}
        </Button>
      ))}
    </div>
  );
}

// --- Custom health chart tooltip ---
function HealthChartTooltip({ active, payload, label, unit = 'Mbps' }: { active?: boolean; payload?: any[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-lg text-xs">
      <p className="font-medium mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium tabular-nums">
            {entry.value != null ? (unit === '%' ? `${entry.value.toFixed(1)}%` : formatMbps(entry.value)) : '—'}
          </span>
        </p>
      ))}
    </div>
  );
}

// --- Interface colors map ---
const IFACE_COLORS = ['#14b8a6', '#f97316', '#06b6d4', '#f43f5e', '#8b5cf6', '#eab308'];

// ==================== MAIN SYSTEM HEALTH TAB ====================

function SystemHealthTab() {
  const { toast } = useToast();

  // Shared metrics state (polled every 2s)
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Alerts state
  const [alertRules, setAlertRules] = useState<any[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [alertHistory, setAlertHistory] = useState<any[]>([]);

  // Active users state
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userBwRange, setUserBwRange] = useState('24h');

  // Add rule dialog
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ metric: 'cpu', operator: '>', threshold: '', label: '' });

  // Interfaces tab
  const [selectedIface, setSelectedIface] = useState<string>('');
  const [ifaceHistRange, setIfaceHistRange] = useState('24h');
  const [ifaceHistData, setIfaceHistData] = useState<any>(null);
  const [ifaceHistLoading, setIfaceHistLoading] = useState(false);

  // System resources tab
  const [cpuRange, setCpuRange] = useState('24h');
  const [memRange, setMemRange] = useState('24h');
  const [diskRange, setDiskRange] = useState('24h');
  const [cpuHistData, setCpuHistData] = useState<any>(null);
  const [memHistData, setMemHistData] = useState<any>(null);
  const [diskHistData, setDiskHistData] = useState<any>(null);

  // New resource graphs state
  const [loadRange, setLoadRange] = useState('24h');
  const [swapRange, setSwapRange] = useState('24h');
  const [diskIoRange, setDiskIoRange] = useState('24h');
  const [thermalRange, setThermalRange] = useState('24h');
  const [netErrRange, setNetErrRange] = useState('24h');
  const [tcpRange, setTcpRange] = useState('24h');
  const [loadHistData, setLoadHistData] = useState<any>(null);
  const [swapHistData, setSwapHistData] = useState<any>(null);
  const [diskIoHistData, setDiskIoHistData] = useState<any>(null);
  const [thermalHistData, setThermalHistData] = useState<any>(null);
  const [netErrHistData, setNetErrHistData] = useState<any>(null);
  const [tcpHistData, setTcpHistData] = useState<any>(null);

  // User bandwidth graph
  const [userBwData, setUserBwData] = useState<any>(null);

  // Active Users history graphs
  const [sessionHistRange, setSessionHistRange] = useState('24h');
  const [sessionHistData, setSessionHistData] = useState<any>(null);
  const [authHistRange, setAuthHistRange] = useState('24h');
  const [authHistData, setAuthHistData] = useState<any>(null);

  // --- Fetch metrics every 2s ---
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/wifi/health?action=metrics');
      const result = await res.json();
      if (result.success) {
        setMetrics(result.data);
        // Auto-select first interface
        if (result.data?.interfaces?.length && !selectedIface) {
          setSelectedIface(result.data.interfaces[0].name);
        }
        if (loading) setLoading(false);
      } else {
        // Log API errors for debugging (only first time)
        if (loading) {
          console.warn('[SystemHealth] metrics API error:', result.error);
          setLoading(false);
        }
      }
    } catch (err) {
      if (loading) {
        console.warn('[SystemHealth] metrics fetch error:', err);
        setLoading(false);
      }
    }
  }, [selectedIface, loading]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  // --- Fetch alerts ---
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/wifi/health?action=alerts');
      const result = await res.json();
      if (result.success) {
        const d = result.data;
        setAlertRules(d?.rules || []);
        setActiveAlerts(d?.active || []);
        setAlertHistory(d?.history || []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // --- Fetch active users ---
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/wifi/health?action=active-users');
      const result = await res.json();
      if (result.success) setActiveUsers(result.data || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 10000);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  // --- Fetch interface history ---
  useEffect(() => {
    if (!selectedIface) return;
    let cancelled = false;
    (async () => {
      setIfaceHistLoading(true);
      try {
        const res = await fetch(`/api/wifi/health?action=rrd-graph&type=interface&name=${selectedIface}&range=${ifaceHistRange}`);
        const result = await res.json();
        if (!cancelled && result.success) setIfaceHistData(result.data);
      } catch { /* silent */ }
      if (!cancelled) setIfaceHistLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedIface, ifaceHistRange]);

  // --- Fetch system resource history ---
  useEffect(() => {
    let cancelled = false;
    const loadGraph = async (type: string, range: string, setter: (d: any) => void) => {
      try {
        const res = await window.fetch(`/api/wifi/health?action=rrd-graph&type=${type}&range=${range}`);
        const result = await res.json();
        if (!cancelled && result.success) setter(result.data);
      } catch { /* silent */ }
    };
    loadGraph('cpu', cpuRange, setCpuHistData);
    loadGraph('memory', memRange, setMemHistData);
    loadGraph('disk', diskRange, setDiskHistData);
    return () => { cancelled = true; };
  }, [cpuRange, memRange, diskRange]);

  // --- Fetch new resource history ---
  useEffect(() => {
    let cancelled = false;
    const fetchRrd = async (type: string, range: string, setter: (d: any) => void) => {
      try {
        const res = await window.fetch(`/api/wifi/health?action=rrd-graph&type=${type}&range=${range}`);
        const result = await res.json();
        if (!cancelled && result.success) setter(result.data);
      } catch { /* silent */ }
    };
    fetchRrd('load', loadRange, setLoadHistData);
    fetchRrd('swap', swapRange, setSwapHistData);
    fetchRrd('disk-io', diskIoRange, setDiskIoHistData);
    fetchRrd('thermal', thermalRange, setThermalHistData);
    fetchRrd('network-errors', netErrRange, setNetErrHistData);
    fetchRrd('tcp', tcpRange, setTcpHistData);
    return () => { cancelled = true; };
  }, [loadRange, swapRange, diskIoRange, thermalRange, netErrRange, tcpRange]);

  // --- Fetch user bandwidth graph ---
  useEffect(() => {
    if (!selectedUser) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wifi/reports/bandwidth-graph?source=user&name=${encodeURIComponent(selectedUser)}&range=${userBwRange}`);
        const result = await res.json();
        if (!cancelled && result.success) setUserBwData(result);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [selectedUser, userBwRange]);

  // --- Fetch active sessions and auth history ---
  useEffect(() => {
    let cancelled = false;
    const fetchRrd = async (type: string, range: string, setter: (d: any) => void) => {
      try {
        const res = await window.fetch(`/api/wifi/health?action=rrd-graph&type=${type}&range=${range}`);
        const result = await res.json();
        if (!cancelled && result.success) setter(result.data);
      } catch { /* silent */ }
    };
    fetchRrd('active-sessions', sessionHistRange, setSessionHistData);
    fetchRrd('auth-stats', authHistRange, setAuthHistData);
    return () => { cancelled = true; };
  }, [sessionHistRange, authHistRange]);

  // --- Acknowledge alert ---
  const handleAckAlert = async (alertId: string) => {
    try {
      await fetch('/api/wifi/health?action=acknowledge-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      });
      setActiveAlerts(prev => prev.filter(a => a.id !== alertId));
      toast({ title: 'Alert Acknowledged' });
    } catch {
      toast({ title: 'Error', description: 'Failed to acknowledge alert', variant: 'destructive' });
    }
  };

  // --- Save alert rules ---
  const handleSaveRule = async () => {
    if (!newRule.threshold) return;
    try {
      const res = await fetch('/api/wifi/health?action=set-alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: [...alertRules, { ...newRule, threshold: parseFloat(newRule.threshold), enabled: true }] }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Rule Saved' });
        setShowAddRule(false);
        setNewRule({ metric: 'cpu', operator: '>', threshold: '', label: '' });
        fetchAlerts();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save rule', variant: 'destructive' });
    }
  };

  // --- Toggle rule ---
  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await fetch('/api/wifi/health?action=set-alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: alertRules.map(r => r.id === ruleId ? { ...r, enabled } : r),
        }),
      });
      setAlertRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled } : r));
    } catch { /* silent */ }
  };

  // --- Derived values ---
  const cpuPct = metrics?.cpu?.usage ?? 0;
  const ramPct = metrics?.memory?.percent ?? 0;
  const diskPct = metrics?.disk?.percent ?? 0;
  const cores = metrics?.cpu?.cores ?? 0;
  const totalRam = metrics?.memory?.total ?? 0;
  const totalDisk = metrics?.disk?.total ?? 0;
  const interfaces = metrics?.interfaces ?? [];
  const history = metrics?.history ?? {};

  // New derived values
  const loadAvg = metrics?.loadAvg ?? [0, 0, 0];
  const swapPct = metrics?.swap?.percent ?? 0;
  const cpuTemp = metrics?.thermal?.cpu_temp ?? 0;
  const diskIoReads = metrics?.diskIo?.reads ?? 0;
  const diskIoWrites = metrics?.diskIo?.writes ?? 0;
  const netErrors = metrics?.netErrors ?? { rx_err: 0, tx_err: 0, rx_drop: 0, tx_drop: 0 };
  const tcpStates = metrics?.tcp ?? { established: 0, time_wait: 0, close_wait: 0, syn_recv: 0 };

  // Build real-time bandwidth chart data (last 60 points)
  const bwChartData = useMemo(() => {
    if (!history?.timestamps?.length) return [];
    const ts = history.timestamps;
    const ifaces = history.interfaces || {};
    const start = Math.max(0, ts.length - 60);
    return ts.slice(start).map((t: number, i: number) => {
      const point: any = { time: formatTime(t) };
      Object.entries(ifaces).forEach(([name, speeds]: [string, any]) => {
        point[`${name}_rx`] = speeds?.rxSpeed?.[start + i] ?? 0;
        point[`${name}_tx`] = speeds?.txSpeed?.[start + i] ?? 0;
      });
      return point;
    });
  }, [history]);

  // Compute RRD chart data helper
  const buildRrdChartData = useCallback((rrdData: any) => {
    if (!rrdData?.timestamps?.length) return [];
    const ds = rrdData.data || {};
    return rrdData.timestamps.map((ts: number, i: number) => {
      const point: any = { time: formatTime(ts) };
      let hasValid = false;
      Object.entries(ds).forEach(([key, arr]: [string, any]) => {
        const val = arr?.[i];
        point[key] = (val !== null && val !== undefined && !isNaN(val)) ? Number(val) : 0;
        if (point[key] !== 0) hasValid = true;
      });
      return point;
    }).filter((point: any, idx: number, arr: any[]) => {
      // Keep point if it's the last one or if next point is different (avoid duplicate timestamps)
      if (idx === arr.length - 1) return true;
      return point.time !== arr[idx + 1].time;
    });
  }, []);

  const ifaceHistChartData = useMemo(() => buildRrdChartData(ifaceHistData), [ifaceHistData, buildRrdChartData]);
  const cpuHistChartData = useMemo(() => buildRrdChartData(cpuHistData), [cpuHistData, buildRrdChartData]);
  const memHistChartData = useMemo(() => buildRrdChartData(memHistData), [memHistData, buildRrdChartData]);
  const diskHistChartData = useMemo(() => buildRrdChartData(diskHistData), [diskHistData, buildRrdChartData]);
  const loadHistChartData = useMemo(() => buildRrdChartData(loadHistData), [loadHistData, buildRrdChartData]);
  const swapHistChartData = useMemo(() => buildRrdChartData(swapHistData), [swapHistData, buildRrdChartData]);
  const diskIoHistChartData = useMemo(() => buildRrdChartData(diskIoHistData), [diskIoHistData, buildRrdChartData]);
  const thermalHistChartData = useMemo(() => buildRrdChartData(thermalHistData), [thermalHistData, buildRrdChartData]);
  const netErrHistChartData = useMemo(() => buildRrdChartData(netErrHistData), [netErrHistData, buildRrdChartData]);
  const tcpHistChartData = useMemo(() => buildRrdChartData(tcpHistData), [tcpHistData, buildRrdChartData]);
  const sessionHistChartData = useMemo(() => buildRrdChartData(sessionHistData), [sessionHistData, buildRrdChartData]);
  const authHistChartData = useMemo(() => buildRrdChartData(authHistData), [authHistData, buildRrdChartData]);

  // User BW chart data
  const userBwChartData = useMemo(() => {
    if (!userBwData?.timestamps?.length) return [];
    return userBwData.timestamps.map((ts: number, i: number) => ({
      time: formatTime(ts),
      download: userBwData.data?.in?.[i] ?? 0,
      upload: userBwData.data?.out?.[i] ?? 0,
    }));
  }, [userBwData]);

  // Build bandwidth chart config
  const bwChartConfig = useMemo((): ChartConfig => {
    const cfg: ChartConfig = {};
    interfaces.forEach((iface: any, i: number) => {
      const color = IFACE_COLORS[i % IFACE_COLORS.length];
      cfg[`${iface.name}_rx`] = { label: `${iface.name} ↓`, color };
      cfg[`${iface.name}_tx`] = { label: `${iface.name} ↑`, color };
    });
    return cfg;
  }, [interfaces]);

  // Active users sort
  const [userSortKey, setUserSortKey] = useState<string>('username');
  const [userSortDir, setUserSortDir] = useState<'asc' | 'desc'>('asc');
  const sortedUsers = useMemo(() => {
    const sorted = [...activeUsers].sort((a, b) => {
      const aVal = a[userSortKey] ?? '';
      const bVal = b[userSortKey] ?? '';
      const cmp = typeof aVal === 'number' && typeof bVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return userSortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [activeUsers, userSortKey, userSortDir]);

  const handleUserSort = (key: string) => {
    if (userSortKey === key) setUserSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setUserSortKey(key); setUserSortDir('asc'); }
  };

  // Summary stats for active users (before early return — hooks must be before conditional returns)
  const totalUserBw = useMemo(() =>
    activeUsers.reduce((sum: number, u: any) => sum + (u.inputBytes || 0) + (u.outputBytes || 0), 0),
    [activeUsers]
  );

  // Metric card data (pure computation, no hooks)
  const getMetricCards = () => [
    { label: 'CPU', value: cpuPct, icon: Cpu, history: history?.cpu },
    { label: 'RAM', value: ramPct, icon: MemoryStick, history: history?.memory },
    { label: 'Disk', value: diskPct, icon: HardDrive, history: history?.disk },
    { label: 'Active Alerts', value: activeAlerts.length, icon: Bell, history: null },
  ];

  if (loading && !metrics) return <LoadingSpinner message="Loading system health..." />;

  const metricCards = getMetricCards();

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
        <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
        <TabsTrigger value="interfaces" className="text-xs sm:text-sm">Interfaces</TabsTrigger>
        <TabsTrigger value="resources" className="text-xs sm:text-sm">Resources</TabsTrigger>
        <TabsTrigger value="users" className="text-xs sm:text-sm">Active Users</TabsTrigger>
        <TabsTrigger value="alerts" className="text-xs sm:text-sm">Alerts</TabsTrigger>
      </TabsList>

      {/* ==================== SUB-TAB 1: OVERVIEW ==================== */}
      <TabsContent value="overview" className="space-y-4">
        {/* Top row: 4 metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metricCards.map(card => {
            const mc = card.label === 'Active Alerts'
              ? (card.value > 0 ? { bg: 'bg-red-500/10 dark:bg-red-500/15', text: 'text-red-600 dark:text-red-400', icon: 'text-red-500 dark:text-red-400', spark: '#f43f5e' } : { bg: 'bg-teal-500/10 dark:bg-teal-500/15', text: 'text-teal-600 dark:text-teal-400', icon: 'text-teal-500 dark:text-teal-400', spark: '#14b8a6' })
              : getMetricColor(card.value);
            const Icon = card.icon;
            return (
              <Card key={card.label} className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-lg', mc.bg)}>
                    <Icon className={cn('h-4 w-4', mc.icon)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className={cn('text-2xl font-bold tabular-nums leading-tight', mc.text)}>
                      {card.label === 'Active Alerts' ? card.value : `${Math.round(card.value)}%`}
                    </p>
                  </div>
                  {card.history && card.history.length > 1 && (
                    <MiniSparkline data={card.history.slice(-20)} color={mc.spark} />
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Middle: Real-time interface bandwidth graph */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="h-4 w-4 text-muted-foreground" />
                Real-time Interface Bandwidth
              </CardTitle>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {interfaces.map((iface: any, i: number) => (
                  <span key={iface.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: IFACE_COLORS[i % IFACE_COLORS.length] }} />
                    <span className="font-mono">{iface.name}</span>
                  </span>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {bwChartData.length > 0 ? (
              <ChartContainer config={bwChartConfig} className="h-[280px] w-full">
                <AreaChart data={bwChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    {interfaces.map((iface: any, i: number) => {
                      const c = IFACE_COLORS[i % IFACE_COLORS.length];
                      return (
                        <React.Fragment key={iface.name}>
                          <linearGradient id={`grad-${iface.name}-rx`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={c} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={c} stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id={`grad-${iface.name}-tx`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={c} stopOpacity={0.15} />
                            <stop offset="95%" stopColor={c} stopOpacity={0.01} />
                          </linearGradient>
                        </React.Fragment>
                      );
                    })}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatMbps(v)} width={70} />
                  <ChartTooltip content={<HealthChartTooltip />} />
                  {interfaces.map((iface: any, i: number) => {
                    const c = IFACE_COLORS[i % IFACE_COLORS.length];
                    return (
                      <React.Fragment key={iface.name}>
                        <Area type="monotone" dataKey={`${iface.name}_rx`} name={`${iface.name} ↓`} stroke={c} fill={`url(#grad-${iface.name}-rx)`} strokeWidth={1.5} dot={false} />
                        <Area type="monotone" dataKey={`${iface.name}_tx`} name={`${iface.name} ↑`} stroke={c} fill={`url(#grad-${iface.name}-tx)`} strokeWidth={1} strokeDasharray="4 2" dot={false} />
                      </React.Fragment>
                    );
                  })}
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">Waiting for data...</div>
            )}
          </CardContent>
        </Card>

        {/* Bottom: Active alerts panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Active Alerts
              {activeAlerts.length > 0 && (
                <Badge variant="destructive" className="ml-1">{activeAlerts.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeAlerts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                No active alerts — everything looks good!
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activeAlerts.map((alert: any) => (
                  <div key={alert.id} className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{alert.label || `${alert.metric} ${alert.operator} ${alert.threshold}`}</p>
                      <p className="text-xs text-muted-foreground">Value: <span className="font-mono tabular-nums">{alert.value}</span> · Triggered {alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleString() : 'recently'}</p>
                    </div>
                    {!alert.acknowledged && (
                      <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => handleAckAlert(alert.id)}>Acknowledge</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ==================== SUB-TAB 2: INTERFACES ==================== */}
      <TabsContent value="interfaces" className="space-y-4">
        {/* Interface selector */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Interface:</span>
              {interfaces.map((iface: any) => (
                <Button key={iface.name} variant={selectedIface === iface.name ? 'default' : 'outline'} size="sm" className="font-mono text-xs" onClick={() => setSelectedIface(iface.name)}>
                  <Wifi className="h-3 w-3 mr-1.5" />
                  {iface.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Real-time graph for selected interface */}
        {selectedIface && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-mono">{selectedIface} — Real-time Traffic</CardTitle>
            </CardHeader>
            <CardContent>
              {bwChartData.length > 0 ? (
                <ChartContainer config={{
                  rx: { label: 'Download', color: '#14b8a6' },
                  tx: { label: 'Upload', color: '#f97316' },
                }} className="h-[260px] w-full">
                  <AreaChart data={bwChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="iface-rx-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="iface-tx-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatMbps(v)} width={70} />
                    <ChartTooltip content={<HealthChartTooltip />} />
                    <Area type="monotone" dataKey={`${selectedIface}_rx`} name="Download" stroke="#14b8a6" fill="url(#iface-rx-grad)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey={`${selectedIface}_tx`} name="Upload" stroke="#f97316" fill="url(#iface-tx-grad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">Waiting for data...</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Historical RRD graph */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-mono">{selectedIface} — Historical</CardTitle>
              <RangeSelector value={ifaceHistRange} onChange={setIfaceHistRange} />
            </div>
          </CardHeader>
          <CardContent>
            {ifaceHistLoading ? (
              <div className="flex items-center justify-center h-[260px]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : ifaceHistChartData.length > 0 ? (
              <ChartContainer config={{
                rx: { label: 'Download (RX)', color: '#14b8a6' },
                tx: { label: 'Upload (TX)', color: '#f97316' },
              }} className="h-[260px] w-full">
                <LineChart data={ifaceHistChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatBandwidth(v)} width={70} />
                  <ChartTooltip content={<HealthChartTooltip />} />
                  <Line type="monotone" dataKey="rx" name="Download (RX)" stroke="#14b8a6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="tx" name="Upload (TX)" stroke="#f97316" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">No historical data available</div>
            )}
          </CardContent>
        </Card>

        {/* Stats summary bar */}
        {(() => {
          const iface = interfaces.find((i: any) => i.name === selectedIface);
          if (!iface) return null;
          const rxCol = formatBytesColored(iface.rxBytes || 0);
          const txCol = formatBytesColored(iface.txBytes || 0);
          return (
            <Card className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Current ↓</p>
                  <p className="text-lg font-bold tabular-nums text-teal-600 dark:text-teal-400">{formatMbps(iface.rxSpeed || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current ↑</p>
                  <p className="text-lg font-bold tabular-nums text-orange-600 dark:text-orange-400">{formatMbps(iface.txSpeed || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Received</p>
                  <p className={cn('text-lg font-bold tabular-nums', rxCol.color)}>{rxCol.text}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Transmitted</p>
                  <p className={cn('text-lg font-bold tabular-nums', txCol.color)}>{txCol.text}</p>
                </div>
              </div>
            </Card>
          );
        })()}
      </TabsContent>

      {/* ==================== SUB-TAB 3: SYSTEM RESOURCES ==================== */}
      <TabsContent value="resources" className="space-y-4">
        {/* Three resource cards: CPU, RAM, Disk */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* CPU */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-teal-500 dark:text-teal-400" /> CPU
                </CardTitle>
                <span className={cn('text-2xl font-bold tabular-nums', getMetricColor(cpuPct).text)}>{Math.round(cpuPct)}%</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 transition-all duration-700" style={{ width: `${cpuPct}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <RangeSelector value={cpuRange} onChange={setCpuRange} ranges={['1h', '6h', '24h', '7d', '30d']} />
              </div>
              {cpuHistChartData.length > 0 ? (
                <ChartContainer config={{ usage: { label: 'CPU', color: '#14b8a6' } }} className="h-[160px] w-full">
                  <AreaChart data={cpuHistChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cpu-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} width={40} />
                    <ChartTooltip content={<HealthChartTooltip unit="%" />} />
                    <Area type="monotone" dataKey="usage" name="CPU" stroke="#14b8a6" fill="url(#cpu-grad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-xs text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>

          {/* RAM */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-orange-500 dark:text-orange-400" /> RAM
                </CardTitle>
                <span className={cn('text-2xl font-bold tabular-nums', getMetricColor(ramPct).text)}>{Math.round(ramPct)}%</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all duration-700" style={{ width: `${ramPct}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <RangeSelector value={memRange} onChange={setMemRange} ranges={['1h', '6h', '24h', '7d', '30d']} />
              </div>
              {memHistChartData.length > 0 ? (
                <ChartContainer config={{ percent: { label: 'RAM', color: '#f97316' } }} className="h-[160px] w-full">
                  <AreaChart data={memHistChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mem-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} width={40} />
                    <ChartTooltip content={<HealthChartTooltip unit="%" />} />
                    <Area type="monotone" dataKey="percent" name="RAM" stroke="#f97316" fill="url(#mem-grad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-xs text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>

          {/* Disk */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-rose-500 dark:text-rose-400" /> Disk
                </CardTitle>
                <span className={cn('text-2xl font-bold tabular-nums', getMetricColor(diskPct).text)}>{Math.round(diskPct)}%</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-500 transition-all duration-700" style={{ width: `${diskPct}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <RangeSelector value={diskRange} onChange={setDiskRange} ranges={['1h', '6h', '24h', '7d', '30d']} />
              </div>
              {diskHistChartData.length > 0 ? (
                <ChartContainer config={{ percent: { label: 'Disk', color: '#f43f5e' } }} className="h-[160px] w-full">
                  <AreaChart data={diskHistChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="disk-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} width={40} />
                    <ChartTooltip content={<HealthChartTooltip unit="%" />} />
                    <Area type="monotone" dataKey="percent" name="Disk" stroke="#f43f5e" fill="url(#disk-grad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-xs text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>
          {/* Load Average */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-teal-500 dark:text-teal-400" /> Load Average
                </CardTitle>
                <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                  <span className="text-teal-600 dark:text-teal-400">{loadAvg[0]?.toFixed(2)}</span>
                  <span className="text-orange-600 dark:text-orange-400">{loadAvg[1]?.toFixed(2)}</span>
                  <span className="text-rose-600 dark:text-rose-400">{loadAvg[2]?.toFixed(2)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>1m / 5m / 15m</span>
                <RangeSelector value={loadRange} onChange={setLoadRange} ranges={['1h', '6h', '24h', '7d', '30d']} />
              </div>
              {loadHistChartData.length > 0 ? (
                <ChartContainer config={{
                  load1: { label: '1 min', color: '#14b8a6' },
                  load5: { label: '5 min', color: '#f97316' },
                  load15: { label: '15 min', color: '#f43f5e' },
                }} className="h-[160px] w-full">
                  <LineChart data={loadHistChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="time" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={40} />
                    <ChartTooltip content={<HealthChartTooltip />} />
                    <Line type="monotone" dataKey="load1" name="1 min" stroke="#14b8a6" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="load5" name="5 min" stroke="#f97316" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="load15" name="15 min" stroke="#f43f5e" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-xs text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>

          {/* Swap */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4 text-amber-500 dark:text-amber-400" /> Swap
                </CardTitle>
                <span className={cn('text-2xl font-bold tabular-nums', getMetricColor(swapPct).text)}>{swapPct > 0 ? `${Math.round(swapPct)}%` : '—'}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all duration-700" style={{ width: `${swapPct}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <RangeSelector value={swapRange} onChange={setSwapRange} ranges={['1h', '6h', '24h', '7d', '30d']} />
              </div>
              {swapHistChartData.length > 0 ? (
                <ChartContainer config={{ percent: { label: 'Swap', color: '#eab308' } }} className="h-[160px] w-full">
                  <AreaChart data={swapHistChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="swap-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#eab308" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} width={40} />
                    <ChartTooltip content={<HealthChartTooltip unit="%" />} />
                    <Area type="monotone" dataKey="percent" name="Swap" stroke="#eab308" fill="url(#swap-grad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-xs text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>

          {/* Disk I/O */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4 text-teal-500 dark:text-teal-400" /> Disk I/O
                </CardTitle>
                <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                  <span className="text-teal-600 dark:text-teal-400">R: {formatBandwidth(diskIoReads)}</span>
                  <span className="text-orange-600 dark:text-orange-400">W: {formatBandwidth(diskIoWrites)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <RangeSelector value={diskIoRange} onChange={setDiskIoRange} ranges={['1h', '6h', '24h', '7d', '30d']} />
              </div>
              {diskIoHistChartData.length > 0 ? (
                <ChartContainer config={{
                  read_bytes: { label: 'Read', color: '#14b8a6' },
                  write_bytes: { label: 'Write', color: '#f97316' },
                }} className="h-[160px] w-full">
                  <LineChart data={diskIoHistChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="time" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatBandwidth(v)} width={55} />
                    <ChartTooltip content={<HealthChartTooltip />} />
                    <Line type="monotone" dataKey="read_bytes" name="Read" stroke="#14b8a6" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="write_bytes" name="Write" stroke="#f97316" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-xs text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Second row of resource cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* CPU Temperature */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-red-500 dark:text-red-400" /> CPU Temperature
                </CardTitle>
                <span className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{cpuTemp.toFixed(1)}°C</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <RangeSelector value={thermalRange} onChange={setThermalRange} ranges={['1h', '6h', '24h', '7d', '30d']} />
              </div>
              {thermalHistChartData.length > 0 ? (
                <ChartContainer config={{ cpu_temp: { label: 'CPU Temp', color: '#f43f5e' } }} className="h-[160px] w-full">
                  <AreaChart data={thermalHistChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="thermal-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v: number) => `${v}°C`} width={40} />
                    <ChartTooltip content={<HealthChartTooltip unit="°C" />} />
                    <Area type="monotone" dataKey="cpu_temp" name="CPU Temp" stroke="#f43f5e" fill="url(#thermal-grad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-xs text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>

          {/* Network Errors */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500 dark:text-rose-400" /> Network Errors
                </CardTitle>
                <span className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  {((netErrors.rx_err || 0) + (netErrors.tx_err || 0)).toLocaleString()}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <RangeSelector value={netErrRange} onChange={setNetErrRange} ranges={['1h', '6h', '24h', '7d', '30d']} />
              </div>
              {netErrHistChartData.length > 0 ? (
                <ChartContainer config={{
                  rx_err: { label: 'RX Errors', color: '#f43f5e' },
                  tx_err: { label: 'TX Errors', color: '#eab308' },
                }} className="h-[160px] w-full">
                  <LineChart data={netErrHistChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="time" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={45} />
                    <ChartTooltip content={<HealthChartTooltip />} />
                    <Line type="monotone" dataKey="rx_err" name="RX Errors" stroke="#f43f5e" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="tx_err" name="TX Errors" stroke="#eab308" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-xs text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>

          {/* TCP Connections */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Network className="h-4 w-4 text-teal-500 dark:text-teal-400" /> TCP Connections
                </CardTitle>
                <span className="text-2xl font-bold tabular-nums text-teal-600 dark:text-teal-400">{tcpStates.established?.toLocaleString() ?? 0}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <RangeSelector value={tcpRange} onChange={setTcpRange} ranges={['1h', '6h', '24h', '7d', '30d']} />
              </div>
              {tcpHistChartData.length > 0 ? (
                <ChartContainer config={{
                  established: { label: 'Established', color: '#14b8a6' },
                  time_wait: { label: 'Time Wait', color: '#eab308' },
                  close_wait: { label: 'Close Wait', color: '#f43f5e' },
                  syn_recv: { label: 'SYN Recv', color: '#8b5cf6' },
                }} className="h-[160px] w-full">
                  <AreaChart data={tcpHistChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tcp-est-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="tcp-tw-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#eab308" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="tcp-cw-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="tcp-syn-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="time" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={40} />
                    <ChartTooltip content={<HealthChartTooltip />} />
                    <Area type="monotone" dataKey="syn_recv" name="SYN Recv" stroke="#8b5cf6" fill="url(#tcp-syn-grad)" stackId="tcp" strokeWidth={1} dot={false} />
                    <Area type="monotone" dataKey="close_wait" name="Close Wait" stroke="#f43f5e" fill="url(#tcp-cw-grad)" stackId="tcp" strokeWidth={1} dot={false} />
                    <Area type="monotone" dataKey="time_wait" name="Time Wait" stroke="#eab308" fill="url(#tcp-tw-grad)" stackId="tcp" strokeWidth={1} dot={false} />
                    <Area type="monotone" dataKey="established" name="Established" stroke="#14b8a6" fill="url(#tcp-est-grad)" stackId="tcp" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-xs text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary bar */}
        <Card className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">CPU Cores</p>
              <p className="text-lg font-bold tabular-nums">{cores}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total RAM</p>
              <p className="text-lg font-bold tabular-nums">{formatBytes(totalRam)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Disk</p>
              <p className="text-lg font-bold tabular-nums">{formatBytes(totalDisk)}</p>
            </div>
          </div>
        </Card>
      </TabsContent>

      {/* ==================== SUB-TAB 4: ACTIVE USERS ==================== */}
      <TabsContent value="users" className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="default" className="text-sm px-3 py-1">
            <Users className="h-3 w-3 mr-1.5" />
            {activeUsers.length} active sessions
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            Total bandwidth: <span className="font-mono ml-1">{formatBytes(totalUserBw)}</span>
          </Badge>
        </div>

        {/* Active Sessions History */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-500 dark:text-teal-400" /> Active Sessions — History
              </CardTitle>
              <RangeSelector value={sessionHistRange} onChange={setSessionHistRange} ranges={['1h', '6h', '24h', '7d', '30d']} />
            </div>
          </CardHeader>
          <CardContent>
            {sessionHistChartData.length > 0 ? (
              <ChartContainer config={{ count: { label: 'Sessions', color: '#14b8a6' } }} className="h-[260px] w-full">
                <AreaChart data={sessionHistChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="session-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={45} />
                  <ChartTooltip content={<HealthChartTooltip />} />
                  <Area type="monotone" dataKey="count" name="Sessions" stroke="#14b8a6" fill="url(#session-grad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">No session history data</div>
            )}
          </CardContent>
        </Card>

        {/* Authentication Stats */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Authentication Stats
              </CardTitle>
              <RangeSelector value={authHistRange} onChange={setAuthHistRange} ranges={['1h', '6h', '24h', '7d', '30d']} />
            </div>
          </CardHeader>
          <CardContent>
            {authHistChartData.length > 0 ? (
              <ChartContainer config={{
                accept: { label: 'Accept', color: '#10b981' },
                reject: { label: 'Reject', color: '#f43f5e' },
              }} className="h-[260px] w-full">
                <AreaChart data={authHistChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="auth-accept-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="auth-reject-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={45} />
                  <ChartTooltip content={<HealthChartTooltip />} />
                  <Area type="monotone" dataKey="accept" name="Accept" stroke="#10b981" fill="url(#auth-accept-grad)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="reject" name="Reject" stroke="#f43f5e" fill="url(#auth-reject-grad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">No authentication stats data</div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ==================== SUB-TAB 5: ALERTS ==================== */}
      <TabsContent value="alerts" className="space-y-4">
        {/* Alert Rules Configuration */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" /> Alert Rules
              </CardTitle>
              <Button size="sm" onClick={() => setShowAddRule(true)}>
                <Plus className="h-3 w-3 mr-1.5" /> Add Rule
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-hidden">
            <div className="max-h-64 overflow-x-auto overflow-y-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs whitespace-nowrap">Metric</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Condition</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">Threshold</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Label</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">No alert rules configured</TableCell>
                    </TableRow>
                  ) : alertRules.map((rule: any) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium capitalize">{rule.metric}</TableCell>
                      <TableCell className="font-mono text-sm">{rule.operator}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{rule.threshold}</TableCell>
                      <TableCell className="text-sm">{rule.label || '—'}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={rule.enabled} onCheckedChange={(checked) => handleToggleRule(rule.id, checked)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Active Alerts
              {activeAlerts.length > 0 && <Badge variant="destructive" className="ml-1">{activeAlerts.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeAlerts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                All clear — no active alerts
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {activeAlerts.map((alert: any) => (
                  <div key={alert.id} className={cn(
                    'flex items-center gap-3 rounded-lg border p-3',
                    alert.acknowledged
                      ? 'border-slate-200 bg-slate-50 dark:bg-slate-900/20 dark:border-slate-700'
                      : 'border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700'
                  )}>
                    <AlertTriangle className={cn('h-4 w-4 shrink-0', alert.acknowledged ? 'text-muted-foreground' : 'text-amber-500 dark:text-amber-400')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{alert.label || `${alert.metric} ${alert.operator} ${alert.threshold}`}</p>
                      <p className="text-xs text-muted-foreground">
                        Current: <span className="font-mono tabular-nums">{alert.value}</span> · Threshold: <span className="font-mono">{alert.threshold}</span>
                        {alert.triggeredAt && <span className="ml-2">{new Date(alert.triggeredAt).toLocaleString()}</span>}
                      </p>
                    </div>
                    {!alert.acknowledged && (
                      <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => handleAckAlert(alert.id)}>
                        <Check className="h-3 w-3 mr-1" /> Ack
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alert History */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" /> Alert History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alertHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No resolved alerts in history</p>
            ) : (
              <ScrollArea className="max-h-64">
                <div className="space-y-1.5">
                  {alertHistory.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{item.label || `${item.metric} ${item.operator} ${item.threshold}`}</p>
                        <p className="text-xs text-muted-foreground">
                          Triggered: {item.triggeredAt ? new Date(item.triggeredAt).toLocaleString() : '—'}
                          {item.resolvedAt && <span> · Resolved: {new Date(item.resolvedAt).toLocaleString()}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Add Rule Dialog */}
        <Dialog open={showAddRule} onOpenChange={setShowAddRule}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Alert Rule</DialogTitle>
              <DialogDescription>Configure a new alert threshold for system monitoring.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Metric</Label>
                <Select value={newRule.metric} onValueChange={v => setNewRule(p => ({ ...p, metric: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpu">CPU Usage</SelectItem>
                    <SelectItem value="memory">RAM Usage</SelectItem>
                    <SelectItem value="disk">Disk Usage</SelectItem>
                    <SelectItem value="interface_rx">Interface RX Speed</SelectItem>
                    <SelectItem value="interface_tx">Interface TX Speed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Operator</Label>
                  <Select value={newRule.operator} onValueChange={v => setNewRule(p => ({ ...p, operator: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value=">">&gt; Greater than</SelectItem>
                      <SelectItem value=">=">&ge; Greater or equal</SelectItem>
                      <SelectItem value="<">&lt; Less than</SelectItem>
                      <SelectItem value="<=">&le; Less or equal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Threshold</Label>
                  <Input
                    type="number"
                    value={newRule.threshold}
                    onChange={e => setNewRule(p => ({ ...p, threshold: e.target.value }))}
                    placeholder="e.g. 80"
                    className="tabular-nums"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Label (optional)</Label>
                <Input
                  value={newRule.label}
                  onChange={e => setNewRule(p => ({ ...p, label: e.target.value }))}
                  placeholder="e.g. High CPU usage warning"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddRule(false)}>Cancel</Button>
              <Button onClick={handleSaveRule} disabled={!newRule.threshold}>Save Rule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TabsContent>
    </Tabs>
  );
}
