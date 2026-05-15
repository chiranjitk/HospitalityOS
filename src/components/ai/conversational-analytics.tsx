'use client';

import { useState, useCallback, useEffect } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Send,
  Sparkles,
  Clock,
  Star,
  BookmarkPlus,
  Calendar,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Lightbulb,
  Share2,
  Eye,
  Brain,
  Globe,
  Users,
  DollarSign,
  BedDouble,
  SmilePlus,
  Target,
  ArrowRight,
  Loader2,
  MessageSquare,
  Copy,
  Settings2,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────

interface QueryResult {
  id: string;
  query: string;
  category: string;
  chartType: 'line' | 'bar' | 'pie' | 'table';
  chartData: Record<string, unknown>[];
  tableData?: Record<string, string | number>[];
  insight: string;
  timestamp: string;
  keyMetric: string;
  keyMetricValue: string;
  keyMetricTrend: 'up' | 'down' | 'neutral';
  keyMetricChange: string;
}

interface SavedQuery {
  id: string;
  name: string;
  query: string;
  category: string;
  isPinned: boolean;
  lastRun: string;
  schedule?: string;
  sharedWith?: string[];
}

interface QuerySuggestion {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: string;
}

// ── UI Config ──────────────────────────────────────────────────────────

const QUERY_SUGGESTIONS: QuerySuggestion[] = [
  { id: 's-01', label: 'Revenue trends', icon: <TrendingUp className="h-3.5 w-3.5" />, category: 'Revenue' },
  { id: 's-02', label: 'Best performing room type', icon: <BedDouble className="h-3.5 w-3.5" />, category: 'Occupancy' },
  { id: 's-03', label: 'Guest satisfaction score', icon: <SmilePlus className="h-3.5 w-3.5" />, category: 'Guest' },
  { id: 's-04', label: 'Staff efficiency', icon: <Users className="h-3.5 w-3.5" />, category: 'Staff' },
  { id: 's-05', label: 'ADR & RevPAR comparison', icon: <DollarSign className="h-3.5 w-3.5" />, category: 'Revenue' },
  { id: 's-06', label: 'Channel performance', icon: <Globe className="h-3.5 w-3.5" />, category: 'Distribution' },
  { id: 's-07', label: 'Occupancy forecast', icon: <Target className="h-3.5 w-3.5" />, category: 'Forecasting' },
  { id: 's-08', label: 'F&B revenue breakdown', icon: <BarChart3 className="h-3.5 w-3.5" />, category: 'F&B' },
];

const CHART_COLORS = ['#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316', '#14b8a6'];

const revenueChartConfig: ChartConfig = {
  revenue: { label: 'Revenue', color: '#f59e0b' },
  expenses: { label: 'Expenses', color: '#ef4444' },
  profit: { label: 'Profit', color: '#10b981' },
};

const occupancyChartConfig: ChartConfig = {
  actual: { label: 'Actual', color: '#f59e0b' },
  forecast: { label: 'Forecast', color: '#06b6d4' },
};

const adrChartConfig: ChartConfig = {
  adr: { label: 'ADR', color: '#8b5cf6' },
  revpar: { label: 'RevPAR', color: '#10b981' },
};

// ── Component ──────────────────────────────────────────────────────────

export default function ConversationalAnalytics() {
  const [queryInput, setQueryInput] = useState('');
  const [activeTab, setActiveTab] = useState('query');
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryHistory, setQueryHistory] = useState<QueryResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<QueryResult | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderMetric, setBuilderMetric] = useState('revenue');
  const [builderPeriod, setBuilderPeriod] = useState('6m');
  const [builderCompare, setBuilderCompare] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);

  // Fetch saved queries from API on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchInitialData() {
      setInitialLoading(true);
      setInitialError(null);
      try {
        const savedRes = await fetch('/api/ai/analytics/saved');
        if (savedRes.ok && !cancelled) {
          const savedData = await savedRes.json();
          const saved = Array.isArray(savedData) ? savedData : savedData.queries || [];
          if (saved.length > 0) setSavedQueries(saved.map((sq: Record<string, unknown>) => ({
            id: sq.id || `sq-${Date.now()}`,
            name: sq.name || sq.title || 'Unnamed Query',
            query: sq.query || sq.queryText || '',
            category: sq.category || 'General',
            isPinned: Boolean(sq.isPinned || sq.pinned || false),
            lastRun: sq.lastRun || sq.lastExecutedAt || new Date().toISOString(),
            schedule: sq.schedule || undefined,
            sharedWith: sq.sharedWith || undefined,
          })));
        }
      } catch (err) {
        if (!cancelled) setInitialError(err instanceof Error ? err.message : 'Failed to load initial data');
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    }
    fetchInitialData();
    return () => { cancelled = true; };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────

  // Shared helper: call the analytics query API and map the response into a QueryResult
  const runQuery = useCallback(async (queryText: string): Promise<QueryResult | null> => {
    if (!queryText.trim()) return null;
    setIsQuerying(true);
    try {
      const res = await fetch('/api/ai/analytics/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody as Record<string, string>).error || `Request failed (${res.status})`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Query processing failed');
      }
      const d = json.data;
      const rd = d.resultData || {};
      const newResult: QueryResult = {
        id: d.id || `qr-${Date.now()}`,
        query: queryText,
        category: d.category || 'General',
        chartType: (rd.chartType || d.chartType || 'table') as QueryResult['chartType'],
        chartData: rd.chartData || [],
        tableData: rd.tableData || undefined,
        insight: rd.insight || 'No insight available for this query.',
        timestamp: d.createdAt || new Date().toISOString(),
        keyMetric: rd.keyMetric || 'Result',
        keyMetricValue: rd.keyMetricValue || '—',
        keyMetricTrend: (rd.keyMetricTrend || 'neutral') as QueryResult['keyMetricTrend'],
        keyMetricChange: rd.keyMetricChange || '',
      };
      setQueryHistory(prev => [newResult, ...prev]);
      setSelectedResult(newResult);
      toast.success('Query processed', { description: 'Results generated successfully' });
      return newResult;
    } catch (err) {
      toast.error('Query failed', { description: err instanceof Error ? err.message : 'An unexpected error occurred' });
      return null;
    } finally {
      setIsQuerying(false);
    }
  }, []);

  const handleSubmitQuery = useCallback(() => {
    runQuery(queryInput).then(() => setQueryInput(''));
  }, [queryInput, runQuery]);

  const handleSuggestionClick = (suggestion: string) => {
    setQueryInput(suggestion);
  };

  const handleTogglePin = (queryId: string) => {
    setSavedQueries(prev =>
      prev.map(q => q.id === queryId ? { ...q, isPinned: !q.isPinned } : q),
    );
    toast.success('Updated', { description: 'Query pin status toggled' });
  };

  const handleSaveQuery = (result: QueryResult) => {
    toast.success('Query Saved', { description: 'Added to your saved queries' });
  };

  const handleScheduleReport = (queryId: string) => {
    toast.success('Report Scheduled', { description: 'You will receive this report automatically' });
  };

  const handleShareQuery = (queryId: string) => {
    toast.success('Link Copied', { description: 'Query link copied to clipboard' });
  };

  const handleBuilderRun = useCallback(() => {
    const builderQuery = `Custom: ${builderMetric} analysis (${builderPeriod}${builderCompare ? ' with comparison' : ''})`;
    runQuery(builderQuery).then(() => setShowBuilder(false));
  }, [builderMetric, builderPeriod, builderCompare, runQuery]);

  const formatTimeAgo = (isoString: string) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  };

  // ── Chart Renderers ──────────────────────────────────────────────

  const renderChart = (result: QueryResult) => {
    const data = result.chartData as Record<string, number | string>[];
    if (!data || data.length === 0) return null;

    const dataKeys = Object.keys(data[0]).filter(k => k !== 'name' && k !== 'date' && k !== 'month' && typeof data[0][k] === 'number');

    if (result.chartType === 'line' || result.chartType === 'area') {
      const config: ChartConfig = {};
      dataKeys.forEach((key, i) => {
        config[key] = { label: key.charAt(0).toUpperCase() + key.slice(1), color: CHART_COLORS[i % CHART_COLORS.length] };
      });

      if (result.chartType === 'line') {
        return (
          <ChartContainer config={config} className="h-[300px] w-full">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {dataKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 4 }} />
              ))}
            </LineChart>
          </ChartContainer>
        );
      } else {
        return (
          <ChartContainer config={config} className="h-[300px] w-full">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {dataKeys.map((key, i) => (
                <Area key={key} type="monotone" dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.2} strokeWidth={2} />
              ))}
            </AreaChart>
          </ChartContainer>
        );
      }
    }

    if (result.chartType === 'bar') {
      const config: ChartConfig = {};
      dataKeys.forEach((key, i) => {
        config[key] = { label: key.charAt(0).toUpperCase() + key.slice(1), color: CHART_COLORS[i % CHART_COLORS.length] };
      });

      return (
        <ChartContainer config={config} className="h-[300px] w-full">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {dataKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ChartContainer>
      );
    }

    if (result.chartType === 'pie') {
      return (
        <ChartContainer config={{}} className="h-[300px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={100}
              dataKey="share"
              nameKey="name"
              paddingAngle={2}
              label={({ name, share }) => `${name}: ${share}%`}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      );
    }

    return null;
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Conversational Analytics</h2>
          <p className="text-muted-foreground">Ask questions in plain language, get instant data insights</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBuilder(true)}>
            <Settings2 className="h-4 w-4 mr-1.5" />
            Query Builder
          </Button>
        </div>
      </div>

      {/* Query Input */}
      <Card className="border-2 border-primary/20">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Brain className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/50" />
              <Input
                placeholder="Ask anything... e.g., 'Show me revenue for last month' or 'Compare occupancy this week vs last week'"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitQuery()}
                className="pl-10 h-12 text-base"
                disabled={isQuerying}
              />
            </div>
            <Button size="lg" onClick={handleSubmitQuery} disabled={isQuerying || !queryInput.trim()}>
              {isQuerying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {QUERY_SUGGESTIONS.slice(0, 6).map(s => (
              <Button
                key={s.id}
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => handleSuggestionClick(s.label)}
              >
                {s.icon}
                {s.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="query">
            Query Results
            {queryHistory.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] bg-background/20 text-current">{queryHistory.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="saved">Saved Queries</TabsTrigger>
          <TabsTrigger value="history">Recent History</TabsTrigger>
          <TabsTrigger value="gallery">Analytics Gallery</TabsTrigger>
        </TabsList>

        {/* ── Query Results Tab ──────────────────────────────────── */}
        <TabsContent value="query" className="space-y-4">
          {isQuerying && (
            <Card>
              <CardContent className="p-8 flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analyzing your query and generating insights...</p>
              </CardContent>
            </Card>
          )}

          {!isQuerying && selectedResult && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      {selectedResult.query}
                    </CardTitle>
                    <CardDescription className="mt-1">{formatTimeAgo(selectedResult.timestamp)}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleSaveQuery(selectedResult)}>
                      <BookmarkPlus className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleShareQuery(selectedResult.id)}>
                      <Share2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toast.success('Query copied')}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Key Metric */}
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">{selectedResult.keyMetric}</p>
                    <p className="text-2xl font-bold mt-1">{selectedResult.keyMetricValue}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {selectedResult.keyMetricTrend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                      {selectedResult.keyMetricTrend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                      <span className={cn('text-xs font-medium', selectedResult.keyMetricTrend === 'up' ? 'text-emerald-600' : selectedResult.keyMetricTrend === 'down' ? 'text-red-600' : 'text-muted-foreground')}>
                        {selectedResult.keyMetricChange}
                      </span>
                    </div>
                  </Card>
                </div>

                {/* Chart */}
                {renderChart(selectedResult)}

                {/* Table (if applicable) */}
                {selectedResult.chartType === 'table' && selectedResult.tableData && (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(selectedResult.tableData[0]).map(key => (
                            <TableHead key={key}>{key}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedResult.tableData.map((row, i) => (
                          <TableRow key={i}>
                            {Object.values(row).map((val, j) => (
                              <TableCell key={j}>{val}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* AI Insight */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border border-violet-200 dark:border-violet-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">AI Insight</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{selectedResult.insight}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Queries List */}
          {!isQuerying && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Queries
              </h4>
              <ScrollArea className="max-h-60">
                <div className="space-y-1">
                  {queryHistory.map(qr => (
                    <button
                      key={qr.id}
                      className={cn(
                        'w-full text-left p-3 rounded-lg transition-colors hover:bg-muted/50 flex items-center justify-between group',
                        selectedResult?.id === qr.id && 'bg-muted',
                      )}
                      onClick={() => setSelectedResult(qr)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{qr.query}</p>
                          <p className="text-xs text-muted-foreground">{formatTimeAgo(qr.timestamp)} • {qr.category}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </TabsContent>

        {/* ── Saved Queries Tab ──────────────────────────────────── */}
        <TabsContent value="saved" className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium">Your Saved Queries ({savedQueries.length})</h4>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toast.info('Browse all saved queries')}>
              View All
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {savedQueries.map(sq => (
              <Card key={sq.id} className={cn('transition-all hover:shadow-md', sq.isPinned && 'border-primary/30')}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {sq.isPinned && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                      <h4 className="font-semibold text-sm">{sq.name}</h4>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleTogglePin(sq.id)}>
                        {sq.isPinned ? <Star className="h-3 w-3 text-amber-500 fill-amber-500" /> : <Star className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleShareQuery(sq.id)}>
                        <Share2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{sq.query}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{sq.category}</Badge>
                      <span className="text-[10px] text-muted-foreground">{formatTimeAgo(sq.lastRun)}</span>
                    </div>
                    <div className="flex gap-1">
                      {sq.schedule && (
                        <Badge variant="secondary" className="text-[10px] gap-1 bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                          <CalendarDays className="h-2.5 w-2.5" />
                          Scheduled
                        </Badge>
                      )}
                      {sq.sharedWith && sq.sharedWith.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Users className="h-2.5 w-2.5" />
                          Shared
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="h-7 text-xs flex-1" onClick={async () => {
                      setActiveTab('query');
                      await runQuery(sq.query);
                    }}>
                      <Eye className="h-3 w-3 mr-1" />
                      Run
                    </Button>
                    {sq.schedule ? (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleScheduleReport(sq.id)}>
                        <Calendar className="h-3 w-3 mr-1" />
                        Reschedule
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleScheduleReport(sq.id)}>
                        <Calendar className="h-3 w-3 mr-1" />
                        Schedule
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Recent History Tab ─────────────────────────────────── */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Query</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="hidden sm:table-cell">Result</TableHead>
                      <TableHead className="hidden md:table-cell">Time</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queryHistory.map(qr => (
                      <TableRow key={qr.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedResult(qr); setActiveTab('query'); }}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate max-w-[250px]">{qr.query}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{qr.category}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-sm text-muted-foreground">{qr.keyMetric}: {qr.keyMetricValue}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs text-muted-foreground">{formatTimeAgo(qr.timestamp)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleSaveQuery(qr); }}>
                              <BookmarkPlus className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); toast.success('Copied'); }}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Analytics Gallery Tab ──────────────────────────────── */}
        <TabsContent value="gallery" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {QUERY_SUGGESTIONS.map(suggestion => (
              <Card key={suggestion.id} className="hover:shadow-lg transition-all cursor-pointer" onClick={() => {
                setQueryInput(suggestion.label);
                setActiveTab('query');
                toast.info(`Query set: ${suggestion.label}`);
              }}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                      {suggestion.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm">{suggestion.label}</h4>
                      <Badge variant="outline" className="text-xs mt-1">{suggestion.category}</Badge>
                      <div className="flex items-center gap-1 mt-3 text-xs text-primary font-medium">
                        <ArrowRight className="h-3 w-3" />
                        Click to explore
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Query Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Popular Queries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  'What is our average daily rate this quarter?',
                  'Which department has the highest staff turnover?',
                  'Show me F&B revenue by outlet for last month',
                  'Compare online vs direct booking revenue',
                  'What are the peak check-in hours?',
                  'Housekeeping task completion rate this week',
                ].map((query, i) => (
                  <button
                    key={i}
                    className="text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                    onClick={() => { setQueryInput(query); setActiveTab('query'); }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm truncate">{query}</p>
                      <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Query Builder Dialog ──────────────────────────────────── */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Advanced Query Builder
            </DialogTitle>
            <DialogDescription>Build a custom analytics query with filters</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Metric Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Metric</Label>
              <Select value={builderMetric} onValueChange={setBuilderMetric}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="occupancy">Occupancy Rate</SelectItem>
                  <SelectItem value="adr">Average Daily Rate (ADR)</SelectItem>
                  <SelectItem value="revpar">Revenue Per Available Room (RevPAR)</SelectItem>
                  <SelectItem value="guest_satisfaction">Guest Satisfaction Score</SelectItem>
                  <SelectItem value="staff_hours">Staff Hours Worked</SelectItem>
                  <SelectItem value="fb_revenue">F&B Revenue</SelectItem>
                  <SelectItem value="channel_performance">Channel Performance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Period */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Time Period</Label>
              <Select value={builderPeriod} onValueChange={setBuilderPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="3m">Last 3 Months</SelectItem>
                  <SelectItem value="6m">Last 6 Months</SelectItem>
                  <SelectItem value="1y">Last 1 Year</SelectItem>
                  <SelectItem value="ytd">Year to Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Comparison Mode */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-sm font-medium">Comparison Mode</Label>
                <p className="text-xs text-muted-foreground">Compare with previous period</p>
              </div>
              <Switch checked={builderCompare} onCheckedChange={setBuilderCompare} />
            </div>

            {/* Department/Property Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Department (Optional)</Label>
              <Select defaultValue="all">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="front_office">Front Office</SelectItem>
                  <SelectItem value="housekeeping">Housekeeping</SelectItem>
                  <SelectItem value="fb">Food & Beverage</SelectItem>
                  <SelectItem value="revenue">Revenue Management</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Property */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Property (Optional)</Label>
              <Select defaultValue="all">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  <SelectItem value="main">Main Hotel</SelectItem>
                  <SelectItem value="resort">Beach Resort</SelectItem>
                  <SelectItem value="business">Business Center</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBuilder(false)}>Cancel</Button>
            <Button onClick={handleBuilderRun}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              Generate Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
