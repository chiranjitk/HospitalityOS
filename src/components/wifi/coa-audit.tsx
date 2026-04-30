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

import React, { useState, useEffect } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Zap,
  Server,
  User,
  AlertTriangle,
  Filter,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface CoaAuditEntry {
  id: string;
  timestamp: string;
  username: string;
  coaType: string;       // maps from RadiusCoaLog.action (bandwidth, disconnect)
  policyName?: string;
  result: 'success' | 'failed' | 'timeout' | 'pending';
  errorMessage?: string;
  nasIp?: string;        // maps from nasIpAddress
  triggeredBy?: string;  // api, manual, system, auto, data_cap, checkout
  responseCode?: string; // CoA-ACK, Disconnect-ACK, CoA-NAK
  attributes?: string;   // JSON: RADIUS CoA attributes sent
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

const COA_TYPE_COLORS: Record<string, string> = {
  'bandwidth': 'bg-cyan-500',
  'disconnect': 'bg-red-500',
  'data_cap_disconnect': 'bg-amber-500',
  'session_timeout': 'bg-emerald-500',
  'bandwidth_change': 'bg-violet-500',
  'policy_update': 'bg-teal-500',
};

const COA_TYPE_LABELS: Record<string, string> = {
  'bandwidth': 'Bandwidth Change',
  'disconnect': 'Disconnect',
  'data_cap_disconnect': 'Data Cap Disconnect',
  'session_timeout': 'Session Timeout',
  'bandwidth_change': 'Bandwidth Change',
  'policy_update': 'Policy Update',
};

const TRIGGER_BADGE: Record<string, { color: string; icon: typeof Zap }> = {
  'api': { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Zap },
  'manual': { color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', icon: User },
  'system': { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: Server },
  'auto': { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Activity },
  'data_cap': { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertTriangle },
  'checkout': { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: FileText },
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
  const [searchQuery, setSearchQuery] = useState('');
  const [coaTypeFilter, setCoaTypeFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ─── Fetch (for Refresh button) ───────────────────────────────────────────

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  // ─── Fetch (auto on filter/search change) ────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.append('username', searchQuery);
        if (coaTypeFilter !== 'all') params.append('coaType', coaTypeFilter);
        if (resultFilter !== 'all') params.append('result', resultFilter);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const [listRes, statsRes] = await Promise.all([
          fetch(`/api/wifi/radius?action=coa-audit-list&${params.toString()}`),
          fetch('/api/wifi/radius?action=coa-audit-stats'),
        ]);
        if (cancelled) return;
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
        if (cancelled) return;
        setEntries([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [searchQuery, coaTypeFilter, resultFilter, startDate, endDate, refreshKey]);

  const parseAttributes = (attrStr: string): Record<string, string> | null => {
    if (!attrStr) return null;
    try {
      if (attrStr.startsWith('{')) return JSON.parse(attrStr);
      // Parse radclient-style attributes
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

  const getResultBadge = (result: string) => {
    if (result === 'success') {
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">
          <CheckCircle className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    }
    if (result === 'failed') {
      return (
        <Badge className="bg-red-500 hover:bg-red-600 text-white border-0">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    }
    if (result === 'timeout') {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Timeout
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-400 hover:bg-gray-500 text-white border-0">
        Pending
      </Badge>
    );
  };

  const getCoaTypeBadge = (type: string) => {
    if (!type) return <span className="text-muted-foreground text-xs">N/A</span>;
    const color = COA_TYPE_COLORS[type] || 'bg-gray-500';
    const label = COA_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return (
      <Badge className={`${color} hover:${color} text-white border-0 text-xs`}>
        {label}
      </Badge>
    );
  };

  const getTriggerBadge = (trigger: string) => {
    if (!trigger) return null;
    const config = TRIGGER_BADGE[trigger] || TRIGGER_BADGE['system'];
    const Icon = config.icon;
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', config.color)}>
        <Icon className="h-3 w-3" />
        {trigger}
      </span>
    );
  };

  // Unique CoA types for filter
  const coaTypes = Array.from(new Set(entries.map(e => e.coaType).filter(Boolean)));

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            CoA Audit Trail
          </h2>
          <p className="text-sm text-muted-foreground">
            Change of Authorization log — bandwidth changes, session disconnects, and policy enforcement
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Activity className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{stats.totalToday}</div>
              <div className="text-xs text-muted-foreground">Total CoA Operations</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{stats.successCount}</div>
              <div className="text-xs text-muted-foreground">Successful</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{stats.failedCount}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <TrendingUp className="h-4 w-4 text-teal-500 dark:text-teal-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-teal-600 dark:text-teal-400">{stats.successRate}%</div>
              <div className="text-xs text-muted-foreground">Success Rate</div>
            </div>
          </div>
        </Card>
      </div>

      {/* By Type Breakdown */}
      {stats.byType && stats.byType.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Breakdown by Type</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.byType.map((item, idx) => (
                <Badge key={`${item.coaType || item.type}-${item.result}-${idx}`} variant="outline" className="text-xs">
                  {getCoaTypeBadge(item.coaType || item.type)}
                  <span className="ml-1 font-medium">{item.count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={coaTypeFilter} onValueChange={setCoaTypeFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {coaTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {COA_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="timeout">Timeout</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-auto"
                placeholder="From"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-auto"
                placeholder="To"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <GitBranch className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">No CoA audit entries</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                CoA audit entries will appear when bandwidth changes or session disconnects are triggered
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>NAS IP</TableHead>
                    <TableHead>Triggered By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const parsedAttrs = parseAttributes(entry.attributes || '');
                    return (
                      <Collapsible
                        key={entry.id}
                        open={expandedRow === entry.id}
                        onOpenChange={(open) => setExpandedRow(open ? entry.id : null)}
                      >
                        <TableRow className={cn(
                          entry.result === 'failed' && 'bg-red-50/30 dark:bg-red-950/10',
                          entry.result === 'timeout' && 'bg-amber-50/30 dark:bg-amber-950/10',
                          'cursor-pointer'
                        )}>
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <ChevronDown className={cn(
                                  'h-4 w-4 transition-transform',
                                  expandedRow === entry.id && 'rotate-180'
                                )} />
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{formatTimestamp(entry.timestamp)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{entry.username}</p>
                            {entry.propertyName && (
                              <p className="text-xs text-muted-foreground">{entry.propertyName}</p>
                            )}
                          </TableCell>
                          <TableCell>{getCoaTypeBadge(entry.coaType)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {getResultBadge(entry.result)}
                              {entry.responseCode && (
                                <span className="text-[10px] font-mono text-muted-foreground">{entry.responseCode}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-mono text-muted-foreground">{entry.nasIp || '—'}</p>
                          </TableCell>
                          <TableCell>{getTriggerBadge(entry.triggeredBy || 'system')}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={7} className="p-0">
                            <CollapsibleContent>
                              <div className="bg-muted/30 px-6 py-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                  {/* Error Message */}
                                  <div className="col-span-2 sm:col-span-3">
                                    <p className="text-xs text-muted-foreground mb-1">Error Details</p>
                                    {entry.errorMessage ? (
                                      <div className="flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3 text-red-500 dark:text-red-400" />
                                        <p className="text-sm text-red-600 dark:text-red-400">{entry.errorMessage}</p>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">No errors</p>
                                    )}
                                  </div>

                                  {/* Session ID */}
                                  {entry.policyName && (
                                    <div>
                                      <p className="text-xs text-muted-foreground">Policy</p>
                                      <p className="text-sm font-medium">{entry.policyName}</p>
                                    </div>
                                  )}

                                  {/* Response Code */}
                                  <div>
                                    <p className="text-xs text-muted-foreground">Response Code</p>
                                    <p className="text-sm font-mono">{entry.responseCode || '—'}</p>
                                  </div>

                                  {/* Triggered By */}
                                  <div>
                                    <p className="text-xs text-muted-foreground">Triggered By</p>
                                    <p className="text-sm">{entry.triggeredBy || '—'}</p>
                                  </div>

                                  {/* RADIUS Attributes */}
                                  <div className="col-span-2 sm:col-span-3">
                                    <p className="text-xs text-muted-foreground mb-1">RADIUS Attributes Sent</p>
                                    {parsedAttrs ? (
                                      <div className="bg-background rounded-md border p-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                          {Object.entries(parsedAttrs).map(([key, value]) => (
                                            <div key={key} className="text-xs">
                                              <span className="font-mono text-cyan-600 dark:text-cyan-400">{key}</span>
                                              <span className="text-muted-foreground mx-1">=</span>
                                              <span className="font-mono">{value}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">No attributes recorded</p>
                                    )}
                                  </div>

                                  {/* Entry ID */}
                                  <div className="col-span-2 sm:col-span-3">
                                    <p className="text-[10px] font-mono text-muted-foreground/50">
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
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
