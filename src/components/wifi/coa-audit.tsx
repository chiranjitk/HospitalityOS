'use client';

/**
 * CoA Audit Component
 *
 * CoA (Change of Authorization) audit trail viewer.
 * Shows timestamp, username, action type, result, NAS IP, triggered by.
 * Expandable rows for full details (RADIUS attributes, error message, response code).
 *
 * Data source: RadiusCoaLog table via /api/wifi/radius?action=coa-audit-list, coa-audit-stats
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  GitBranch,
  Search,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  TrendingUp,
  Activity,
  Clock,
  ChevronDown,
  ChevronRight,
  Zap,
  Server,
  User,
  AlertTriangle,
  Filter,
  FileText,
  MonitorDot,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface CoaAuditEntry {
  id: string;
  timestamp: string;
  username: string;
  coaType: string;
  policyName?: string;
  result: string;
  errorMessage?: string;
  nasIp?: string;
  triggeredBy?: string;
  responseCode?: string;
  attributes?: string;
  propertyName?: string;
}

interface CoaAuditStats {
  totalToday: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  byType: { type: string; coaType: string; count: number }[];
}

// ─── CoA Type Colors ────────────────────────────────────────────────────────────

const COA_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  'bandwidth':            { color: 'bg-cyan-500',            label: 'Bandwidth Change' },
  'disconnect':           { color: 'bg-red-500',             label: 'Disconnect' },
  'data_cap_disconnect':  { color: 'bg-amber-500',          label: 'Data Cap DC' },
  'session_timeout':      { color: 'bg-emerald-500',        label: 'Session Timeout' },
  'bandwidth_change':     { color: 'bg-violet-500',         label: 'Bandwidth Change' },
  'policy_update':        { color: 'bg-teal-500',           label: 'Policy Update' },
};

const TRIGGER_CONFIG: Record<string, { color: string; icon: typeof Zap; label: string }> = {
  'api':       { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',     icon: Zap,        label: 'API' },
  'manual':    { color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', icon: User,   label: 'Manual' },
  'system':    { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',         icon: Server,    label: 'System' },
  'auto':      { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Activity, label: 'Auto' },
  'data_cap':  { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',  icon: AlertTriangle, label: 'Data Cap' },
  'checkout':  { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: FileText, label: 'Checkout' },
};

// ─── Component ──────────────────────────────────────────────────────────────────

export default function CoaAudit() {
  const [entries, setEntries] = useState<CoaAuditEntry[]>([]);
  const [stats, setStats] = useState<CoaAuditStats>({
    totalToday: 0,
    successCount: 0,
    failedCount: 0,
    successRate: 0,
    byType: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Filter state (local, applied on Search click only)
  const [searchQuery, setSearchQuery] = useState('');
  const [coaTypeFilter, setCoaTypeFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Applied filters (what was last searched)
  const appliedFiltersRef = useRef({
    searchQuery: '', coaTypeFilter: 'all', resultFilter: 'all',
    startDate: '', endDate: '',
  });

  // ─── Fetch data (no auto-refresh, only on demand) ──────────────────────────

  const fetchAudit = async () => {
    setIsLoading(true);
    try {
      const f = appliedFiltersRef.current;
      const params = new URLSearchParams();
      if (f.searchQuery) params.append('username', f.searchQuery);
      if (f.coaTypeFilter !== 'all') params.append('coaType', f.coaTypeFilter);
      if (f.resultFilter !== 'all') params.append('result', f.resultFilter);
      if (f.startDate) params.append('startDate', f.startDate);
      if (f.endDate) params.append('endDate', f.endDate);

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/wifi/radius?action=coa-audit-list&${params.toString()}`),
        fetch('/api/wifi/radius?action=coa-audit-stats'),
      ]);
      const listData = await listRes.json();
      const statsData = await statsRes.json();

      if (listData.success && listData.data) {
        setEntries(Array.isArray(listData.data) ? listData.data : []);
      } else {
        setEntries([]);
      }
      if (statsData.success && statsData.data) {
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Failed to fetch CoA audit:', error);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load once on mount only — no auto-refresh
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        const [listRes, statsRes] = await Promise.all([
          fetch(`/api/wifi/radius?action=coa-audit-list&${params.toString()}`),
          fetch('/api/wifi/radius?action=coa-audit-stats'),
        ]);
        const listData = await listRes.json();
        const statsData = await statsRes.json();

        if (listData.success && listData.data) {
          setEntries(Array.isArray(listData.data) ? listData.data : []);
        } else {
          setEntries([]);
        }
        if (statsData.success && statsData.data) {
          setStats(statsData.data);
        }
      } catch (error) {
        console.error('Failed to fetch CoA audit:', error);
        setEntries([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Manual refresh: re-fetch with same applied filters
  const handleRefresh = () => {
    fetchAudit();
  };

  // Apply filters: snapshot current filter values and fetch
  const handleSearch = () => {
    appliedFiltersRef.current = {
      searchQuery, coaTypeFilter, resultFilter, startDate, endDate,
    };
    fetchAudit();
  };

  // Clear all filters
  const handleClear = () => {
    setSearchQuery('');
    setCoaTypeFilter('all');
    setResultFilter('all');
    setStartDate('');
    setEndDate('');
    appliedFiltersRef.current = {
      searchQuery: '', coaTypeFilter: 'all', resultFilter: 'all',
      startDate: '', endDate: '',
    };
    fetchAudit();
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const parseAttributes = (attrStr: string): Record<string, string> | null => {
    if (!attrStr) return null;
    try {
      if (attrStr.startsWith('{')) return JSON.parse(attrStr);
      const attrs: Record<string, string> = {};
      attrStr.split('\n').forEach(line => {
        const match = line.match(/^(.+?)\s*=\s*"?(.*?)"?\s*$/);
        if (match) attrs[match[1].trim()] = match[2].trim();
      });
      return Object.keys(attrs).length > 0 ? attrs : null;
    } catch {
      return null;
    }
  };

  const formatTimestamp = (ts: string) => {
    if (!ts) return '—';
    const date = new Date(ts);
    return date.toLocaleString();
  };

  // ─── Sub-components ──────────────────────────────────────────────────────

  const ResultBadge = ({ result }: { result: string }) => {
    if (result === 'success') return (
      <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 shrink-0">
        <CheckCircle className="h-3 w-3 mr-1" />Success
      </Badge>
    );
    if (result === 'failed') return (
      <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 shrink-0">
        <XCircle className="h-3 w-3 mr-1" />Failed
      </Badge>
    );
    if (result === 'timeout') return (
      <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 shrink-0">
        <AlertTriangle className="h-3 w-3 mr-1" />Timeout
      </Badge>
    );
    return (
      <Badge className="bg-gray-400 hover:bg-gray-500 text-white border-0 shrink-0">Pending</Badge>
    );
  };

  const CoaTypeBadge = ({ type }: { type: string }) => {
    if (!type) return <span className="text-muted-foreground text-xs">N/A</span>;
    const config = COA_TYPE_CONFIG[type] || { color: 'bg-gray-500', label: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) };
    return <Badge className={`${config.color} text-white border-0 text-xs shrink-0`}>{config.label}</Badge>;
  };

  const TriggerBadge = ({ trigger }: { trigger: string }) => {
    if (!trigger) return null;
    const config = TRIGGER_CONFIG[trigger] || TRIGGER_CONFIG['system'];
    const Icon = config.icon;
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', config.color)}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

  // Unique CoA types from data for filter dropdown
  const coaTypes = Array.from(new Set(entries.map(e => e.coaType).filter(Boolean)));

  // Check if any filter is active
  const hasActiveFilters = searchQuery || coaTypeFilter !== 'all' || resultFilter !== 'all' || startDate || endDate;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            CoA Audit Trail
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Change of Authorization logs — bandwidth changes, session disconnects, policy enforcement
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Activity className="h-4 w-4 text-cyan-500" />
            </div>
            <div>
              <div className="text-xl font-bold tabular-nums">{stats.totalToday}</div>
              <div className="text-[11px] text-muted-foreground">Total Operations</div>
            </div>
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-xl font-bold tabular-nums text-emerald-600">{stats.successCount}</div>
              <div className="text-[11px] text-muted-foreground">Successful</div>
            </div>
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <div className="text-xl font-bold tabular-nums text-red-600">{stats.failedCount}</div>
              <div className="text-[11px] text-muted-foreground">Failed</div>
            </div>
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <TrendingUp className="h-4 w-4 text-teal-500" />
            </div>
            <div>
              <div className="text-xl font-bold tabular-nums text-teal-600">{stats.successRate}%</div>
              <div className="text-[11px] text-muted-foreground">Success Rate</div>
            </div>
          </div>
        </Card>
      </div>

      {/* By Type Breakdown */}
      {stats.byType && stats.byType.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">Breakdown:</span>
          {stats.byType.map((item, idx) => (
            <Badge key={`${item.coaType || item.type}-${idx}`} variant="outline" className="text-xs gap-1">
              <CoaTypeBadge type={item.coaType || item.type} />
              <span className="font-semibold">{item.count}</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <Select value={coaTypeFilter} onValueChange={setCoaTypeFilter}>
                <SelectTrigger className="h-9 text-sm w-full sm:w-40">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {coaTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {COA_TYPE_CONFIG[type]?.label || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={resultFilter} onValueChange={setResultFilter}>
                <SelectTrigger className="h-9 text-sm w-full sm:w-32">
                  <SelectValue placeholder="Result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 text-sm w-36"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 text-sm w-36"
                />
              </div>
              <div className="flex gap-2 ml-auto">
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={handleClear} className="h-8 text-xs">
                    Clear
                  </Button>
                )}
                <Button size="sm" onClick={handleSearch} disabled={isLoading} className="h-8 text-xs">
                  <Search className="h-3 w-3 mr-1" />
                  Search
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading CoA logs...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted/50 p-3 mb-3">
                <MonitorDot className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">No CoA audit entries</h3>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">
                Entries will appear here when bandwidth changes or session disconnects are triggered via RADIUS CoA
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="max-h-[480px] overflow-y-auto">
                <Table>
                  <TableHeader sticky>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-9" />
                      <TableHead className="min-w-[160px]">Timestamp</TableHead>
                      <TableHead className="min-w-[160px]">Username</TableHead>
                      <TableHead className="min-w-[120px]">Action</TableHead>
                      <TableHead className="min-w-[100px]">Result</TableHead>
                      <TableHead className="min-w-[110px]">NAS IP</TableHead>
                      <TableHead className="min-w-[100px]">Trigger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const parsedAttrs = parseAttributes(entry.attributes || '');
                      const isExpanded = expandedRow === entry.id;
                      const isFailed = entry.result === 'failed';

                      return (
                        <Collapsible
                          key={entry.id}
                          open={isExpanded}
                          onOpenChange={(open) => setExpandedRow(open ? entry.id : null)}
                        >
                          {/* Main row */}
                          <TableRow
                            className={cn(
                              'cursor-pointer transition-colors',
                              isFailed && !isExpanded && 'bg-red-50/40 dark:bg-red-950/10',
                              isExpanded && 'bg-muted/40',
                            )}
                          >
                            <TableCell className="py-2.5">
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-transparent">
                                  {isExpanded
                                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  }
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>{formatTimestamp(entry.timestamp)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <p className="text-sm font-medium leading-tight">{entry.username}</p>
                              {entry.propertyName && (
                                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{entry.propertyName}</p>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <CoaTypeBadge type={entry.coaType} />
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="flex flex-col gap-0.5">
                                <ResultBadge result={entry.result} />
                                {entry.responseCode && (
                                  <span className="text-[10px] font-mono text-muted-foreground leading-none">{entry.responseCode}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <span className="text-xs font-mono text-muted-foreground">{entry.nasIp || '—'}</span>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <TriggerBadge trigger={entry.triggeredBy || 'system'} />
                            </TableCell>
                          </TableRow>

                          {/* Expanded detail row */}
                          <TableRow>
                            <TableCell colSpan={7} className="p-0">
                              <CollapsibleContent>
                                <div className="bg-muted/30 border-t px-5 py-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {/* Error Message */}
                                    <div className={cn(isFailed && 'col-span-1')}>
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Error</p>
                                      {entry.errorMessage ? (
                                        <div className="flex items-start gap-1.5 bg-red-50 dark:bg-red-950/20 rounded px-2 py-1.5">
                                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                                          <p className="text-xs text-red-600 dark:text-red-400">{entry.errorMessage}</p>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground">None</p>
                                      )}
                                    </div>

                                    {/* Response Code */}
                                    <div>
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Response</p>
                                      <span className="text-sm font-mono">{entry.responseCode || '—'}</span>
                                    </div>

                                    {/* Triggered By */}
                                    <div>
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Triggered By</p>
                                      <TriggerBadge trigger={entry.triggeredBy || 'system'} />
                                    </div>

                                    {/* RADIUS Attributes */}
                                    <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">RADIUS Attributes</p>
                                      {parsedAttrs ? (
                                        <div className="bg-background rounded-lg border p-2.5">
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                                            {Object.entries(parsedAttrs).map(([key, value]) => (
                                              <div key={key} className="text-xs flex gap-1">
                                                <span className="font-mono text-cyan-600 dark:text-cyan-400 shrink-0">{key}</span>
                                                <span className="text-muted-foreground shrink-0">=</span>
                                                <span className="font-mono break-all">{value}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground">No attributes recorded</p>
                                      )}
                                    </div>

                                    {/* Entry ID */}
                                    <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                                      <p className="text-[10px] font-mono text-muted-foreground/40">
                                        ID: {entry.id}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </TableCell>
                          </TableRow>
                        </Collapsible>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
