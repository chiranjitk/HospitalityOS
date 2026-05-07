'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Search,
  Send,
  Sparkles,
  Clock,
  Star,
  Bookmark,
  BookmarkPlus,
  Calendar,
  Filter,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieChartIcon,
  Lightbulb,
  Share2,
  Download,
  Eye,
  RefreshCw,
  Brain,
  Globe,
  Hotel,
  Users,
  DollarSign,
  BedDouble,
  SmilePlus,
  Zap,
  Target,
  ArrowRight,
  Loader2,
  MessageSquare,
  Copy,
  Plus,
  Trash2,
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

interface AnalysisTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  metrics: string[];
}

// ── Mock Data ──────────────────────────────────────────────────────────

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

const REVENUE_TREND_DATA = [
  { month: 'Jan', revenue: 4250000, expenses: 2850000, profit: 1400000 },
  { month: 'Feb', revenue: 3980000, expenses: 2780000, profit: 1200000 },
  { month: 'Mar', revenue: 4820000, expenses: 3010000, profit: 1810000 },
  { month: 'Apr', revenue: 5100000, expenses: 3200000, profit: 1900000 },
  { month: 'May', revenue: 5560000, expenses: 3350000, profit: 2210000 },
  { month: 'Jun', revenue: 5890000, expenses: 3420000, profit: 2470000 },
];

const ROOM_TYPE_DATA = [
  { name: 'Deluxe King', occupancy: 87, revenue: 1850000, adr: 8500 },
  { name: 'Premium Suite', occupancy: 82, revenue: 2200000, adr: 14500 },
  { name: 'Standard Twin', occupancy: 94, revenue: 1200000, adr: 5200 },
  { name: 'Family Room', occupancy: 78, revenue: 980000, adr: 6800 },
  { name: 'Presidential Suite', occupancy: 65, revenue: 1560000, adr: 28000 },
];

const SATISFACTION_DATA = [
  { category: 'Room Quality', score: 4.5, responses: 234 },
  { category: 'Staff Service', score: 4.7, responses: 312 },
  { category: 'Food & Beverage', score: 4.3, responses: 289 },
  { category: 'Cleanliness', score: 4.6, responses: 298 },
  { category: 'Check-in/out', score: 4.4, responses: 267 },
  { category: 'Amenities', score: 4.2, responses: 245 },
  { category: 'Location', score: 4.8, responses: 320 },
  { category: 'Value for Money', score: 4.1, responses: 210 },
];

const STAFF_EFFICIENCY_DATA = [
  { department: 'Front Office', tasks: 892, avgTime: '4.2min', satisfaction: 4.6 },
  { department: 'Housekeeping', tasks: 1245, avgTime: '22min', satisfaction: 4.4 },
  { department: 'F&B Service', tasks: 678, avgTime: '8.5min', satisfaction: 4.5 },
  { department: 'Kitchen', tasks: 567, avgTime: '18min', satisfaction: 4.3 },
  { department: 'Maintenance', tasks: 134, avgTime: '35min', satisfaction: 4.2 },
  { department: 'Security', tasks: 456, avgTime: '2.1min', satisfaction: 4.7 },
];

const ADR_REVPAR_DATA = [
  { month: 'Jan', adr: 7200, revpar: 5400, occupancy: 75 },
  { month: 'Feb', adr: 6800, revpar: 4900, occupancy: 72 },
  { month: 'Mar', adr: 7800, revpar: 5800, occupancy: 78 },
  { month: 'Apr', adr: 8200, revpar: 6200, occupancy: 82 },
  { month: 'May', adr: 8800, revpar: 6800, occupancy: 85 },
  { month: 'Jun', adr: 9200, revpar: 7200, occupancy: 88 },
];

const CHANNEL_DATA = [
  { name: 'Direct Booking', bookings: 245, revenue: 3200000, share: 35 },
  { name: 'Booking.com', bookings: 180, revenue: 2100000, share: 25 },
  { name: 'Expedia', bookings: 120, revenue: 1400000, share: 17 },
  { name: 'Agoda', bookings: 85, revenue: 980000, share: 12 },
  { name: 'Corporate', bookings: 65, revenue: 850000, share: 7 },
  { name: 'Walk-in', bookings: 40, revenue: 420000, share: 4 },
];

const OCCUPANCY_FORECAST_DATA = [
  { date: 'Mon', actual: 78, forecast: 80 },
  { date: 'Tue', actual: 82, forecast: 81 },
  { date: 'Wed', actual: 85, forecast: 83 },
  { date: 'Thu', actual: 88, forecast: 86 },
  { date: 'Fri', actual: 92, forecast: 90 },
  { date: 'Sat', actual: 95, forecast: 94 },
  { date: 'Sun', actual: 88, forecast: 87 },
];

const FB_DATA = [
  { category: 'Restaurant', revenue: 1800000, orders: 4560 },
  { category: 'Room Service', revenue: 620000, orders: 1230 },
  { category: 'Bar & Lounge', revenue: 480000, orders: 2100 },
  { category: 'Poolside', revenue: 340000, orders: 890 },
  { category: 'Banquet', revenue: 890000, orders: 45 },
  { category: 'Minibar', revenue: 180000, orders: 3400 },
];

const MOCK_QUERY_RESULTS: QueryResult[] = [
  {
    id: 'qr-001', query: 'Show me revenue for last 6 months', category: 'Revenue', chartType: 'line',
    chartData: REVENUE_TREND_DATA, insight: 'Revenue has shown a strong upward trend, growing 38.6% from ₹42.5L in January to ₹58.9L in June. The profit margin has also improved from 32.9% to 41.9%, indicating better cost management alongside revenue growth.',
    timestamp: new Date(Date.now() - 120000).toISOString(), keyMetric: 'Total Revenue', keyMetricValue: '₹2.96 Cr', keyMetricTrend: 'up', keyMetricChange: '+38.6% vs Jan',
  },
  {
    id: 'qr-002', query: 'Compare occupancy this week vs last week', category: 'Occupancy', chartType: 'line',
    chartData: OCCUPANCY_FORECAST_DATA, insight: 'Weekend occupancy peaked at 95% on Saturday, which is 3% above forecast. Weekday averages are steady at 83%. Consider implementing dynamic pricing for the weekend peak.',
    timestamp: new Date(Date.now() - 600000).toISOString(), keyMetric: 'Avg Occupancy', keyMetricValue: '86.9%', keyMetricTrend: 'up', keyMetricChange: '+4.2% vs last week',
  },
  {
    id: 'qr-003', query: 'Best performing room type', category: 'Occupancy', chartType: 'bar',
    chartData: ROOM_TYPE_DATA, insight: 'Standard Twin rooms lead in occupancy at 94%, while Presidential Suite has the highest ADR at ₹28,000. Premium Suites generate the most revenue despite lower occupancy. Consider upselling Deluxe King guests to Premium Suites.',
    timestamp: new Date(Date.now() - 1200000).toISOString(), keyMetric: 'Top Performer', keyMetricValue: 'Standard Twin', keyMetricTrend: 'neutral', keyMetricChange: '94% occupancy',
  },
  {
    id: 'qr-004', query: 'Guest satisfaction score breakdown', category: 'Guest', chartType: 'bar',
    chartData: SATISFACTION_DATA, insight: 'Location (4.8) and Staff Service (4.7) are the highest-rated categories. Value for Money (4.1) and Amenities (4.2) have room for improvement. F&B satisfaction dropped 0.2 points this month.',
    timestamp: new Date(Date.now() - 1800000).toISOString(), keyMetric: 'Avg Score', keyMetricValue: '4.45/5.0', keyMetricTrend: 'up', keyMetricChange: '+0.12 vs last month',
  },
  {
    id: 'qr-005', query: 'Staff efficiency by department', category: 'Staff', chartType: 'table',
    chartData: [], tableData: STAFF_EFFICIENCY_DATA.map(d => ({ Department: d.department, 'Tasks Completed': d.tasks, 'Avg Time': d.avgTime, 'Satisfaction': `${d.satisfaction}/5.0` })),
    insight: 'Housekeeping handles the highest volume (1,245 tasks) with strong satisfaction. Security has the fastest response time (2.1 min). Front Office satisfaction improved by 0.3 points.',
    timestamp: new Date(Date.now() - 2400000).toISOString(), keyMetric: 'Total Tasks', keyMetricValue: '3,972', keyMetricTrend: 'up', keyMetricChange: '+12% vs last month',
  },
  {
    id: 'qr-006', query: 'ADR and RevPAR comparison', category: 'Revenue', chartType: 'area',
    chartData: ADR_REVPAR_DATA, insight: 'ADR has grown 27.8% from ₹7,200 to ₹9,200 over 6 months. RevPAR growth of 33.3% outpaces ADR growth, showing that both rate increases and occupancy gains are driving performance.',
    timestamp: new Date(Date.now() - 3600000).toISOString(), keyMetric: 'Current RevPAR', keyMetricValue: '₹7,200', keyMetricTrend: 'up', keyMetricChange: '+33.3% vs Jan',
  },
  {
    id: 'qr-007', query: 'Channel performance breakdown', category: 'Distribution', chartType: 'pie',
    chartData: CHANNEL_DATA, insight: 'Direct bookings lead at 35% share with highest revenue per booking (₹13,061). OTA contribution is 54% combined. Consider increasing direct booking incentives as OTA commissions average 15-18%.',
    timestamp: new Date(Date.now() - 5400000).toISOString(), keyMetric: 'Direct Share', keyMetricValue: '35%', keyMetricTrend: 'up', keyMetricChange: '+5% vs last quarter',
  },
  {
    id: 'qr-008', query: 'F&B revenue breakdown by outlet', category: 'F&B', chartType: 'bar',
    chartData: FB_DATA, insight: 'Main Restaurant drives 45% of F&B revenue. Room Service and Banquet are strong contributors. Minibar shows high order volume (3,400) with relatively low revenue — consider premium product placement.',
    timestamp: new Date(Date.now() - 7200000).toISOString(), keyMetric: 'Total F&B', keyMetricValue: '₹43.1L', keyMetricTrend: 'up', keyMetricChange: '+18.5% vs last month',
  },
];

const MOCK_SAVED_QUERIES: SavedQuery[] = [
  { id: 'sq-001', name: 'Monthly Revenue Dashboard', query: 'Show me revenue for last 6 months', category: 'Revenue', isPinned: true, lastRun: new Date(Date.now() - 120000).toISOString(), sharedWith: ['Finance Team', 'GM'] },
  { id: 'sq-002', name: 'Weekly Occupancy Check', query: 'Compare occupancy this week vs last week', category: 'Occupancy', isPinned: true, lastRun: new Date(Date.now() - 600000).toISOString(), schedule: 'Weekly - Every Monday' },
  { id: 'sq-003', name: 'Room Performance', query: 'Best performing room type', category: 'Occupancy', isPinned: false, lastRun: new Date(Date.now() - 1200000).toISOString() },
  { id: 'sq-004', name: 'Guest Satisfaction', query: 'Guest satisfaction score breakdown', category: 'Guest', isPinned: true, lastRun: new Date(Date.now() - 1800000).toISOString(), schedule: 'Monthly - 1st' },
  { id: 'sq-005', name: 'Channel Mix Analysis', query: 'Channel performance breakdown', category: 'Distribution', isPinned: false, lastRun: new Date(Date.now() - 5400000).toISOString(), sharedWith: ['Revenue Manager'] },
];

const MOCK_TEMPLATES: AnalysisTemplate[] = [
  { id: 't-001', name: 'Revenue Performance', description: 'Comprehensive revenue analysis with trends, ADR, RevPAR', icon: <DollarSign className="h-5 w-5" />, color: 'from-emerald-500 to-teal-600', metrics: ['Revenue', 'ADR', 'RevPAR', 'GOPPAR'] },
  { id: 't-002', name: 'Guest Segmentation', description: 'Understand your guest demographics and preferences', icon: <Users className="h-5 w-5" />, color: 'from-violet-500 to-purple-600', metrics: ['Segments', 'Nationality', 'Purpose', 'Loyalty Tier'] },
  { id: 't-003', name: 'Operational Efficiency', description: 'Staff performance, task completion, response times', icon: <Zap className="h-5 w-5" />, color: 'from-amber-500 to-orange-600', metrics: ['Task Completion', 'Response Time', 'Satisfaction', 'Efficiency Score'] },
  { id: 't-004', name: 'Financial Health', description: 'P&L overview, cost ratios, and budget variance', icon: <TrendingUp className="h-5 w-5" />, color: 'from-sky-500 to-blue-600', metrics: ['Revenue', 'Expenses', 'Profit Margin', 'Budget Variance'] },
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
  const [queryHistory, setQueryHistory] = useState<QueryResult[]>(MOCK_QUERY_RESULTS);
  const [selectedResult, setSelectedResult] = useState<QueryResult | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(MOCK_SAVED_QUERIES);
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderMetric, setBuilderMetric] = useState('revenue');
  const [builderPeriod, setBuilderPeriod] = useState('6m');
  const [builderCompare, setBuilderCompare] = useState(false);

  // ── Handlers ─────────────────────────────────────────────────────

  const handleSubmitQuery = useCallback(() => {
    if (!queryInput.trim()) return;
    setIsQuerying(true);

    setTimeout(() => {
      const matched = MOCK_QUERY_RESULTS.find(qr =>
        queryInput.toLowerCase().includes('revenue') && qr.category === 'Revenue' ||
        queryInput.toLowerCase().includes('occupancy') && qr.category === 'Occupancy' ||
        queryInput.toLowerCase().includes('satisfaction') && qr.category === 'Guest' ||
        queryInput.toLowerCase().includes('staff') && qr.category === 'Staff' ||
        queryInput.toLowerCase().includes('adr') && qr.query.includes('ADR') ||
        queryInput.toLowerCase().includes('channel') && qr.category === 'Distribution' ||
        queryInput.toLowerCase().includes('f&b') && qr.category === 'F&B' ||
        queryInput.toLowerCase().includes('room type') && qr.query.includes('room type') ||
        queryInput.toLowerCase().includes('forecast') && qr.query.includes('forecast'),
      );

      const result = matched || MOCK_QUERY_RESULTS[Math.floor(Math.random() * MOCK_QUERY_RESULTS.length)];
      const newResult: QueryResult = {
        ...result,
        id: `qr-${Date.now()}`,
        query: queryInput,
        timestamp: new Date().toISOString(),
      };

      setQueryHistory(prev => [newResult, ...prev]);
      setSelectedResult(newResult);
      setIsQuerying(false);
      setQueryInput('');
      toast.success('Query processed', { description: 'Results generated successfully' });
    }, 1500);
  }, [queryInput]);

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

  const handleBuilderRun = () => {
    setIsQuerying(true);
    setTimeout(() => {
      const result = MOCK_QUERY_RESULTS[0];
      const newResult: QueryResult = {
        ...result,
        id: `qr-${Date.now()}`,
        query: `Custom: ${builderMetric} analysis (${builderPeriod}${builderCompare ? ' with comparison' : ''})`,
        timestamp: new Date().toISOString(),
      };
      setQueryHistory(prev => [newResult, ...prev]);
      setSelectedResult(newResult);
      setIsQuerying(false);
      setShowBuilder(false);
      toast.success('Custom query processed');
    }, 1500);
  };

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
                      <Share2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toast.success('Query copied')}>
                      <Copy className="h-3.5 w-3.5" />
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
                    <Button size="sm" className="h-7 text-xs flex-1" onClick={() => {
                      const matchResult = MOCK_QUERY_RESULTS.find(qr => qr.query === sq.query);
                      if (matchResult) {
                        setSelectedResult(matchResult);
                        setActiveTab('query');
                      }
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
                              <Copy className="h-3.5 w-3.5" />
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
            {MOCK_TEMPLATES.map(template => (
              <Card key={template.id} className="hover:shadow-lg transition-all cursor-pointer" onClick={() => {
                const qr = MOCK_QUERY_RESULTS[0];
                setSelectedResult(qr);
                setActiveTab('query');
                toast.info(`Opening ${template.name} template`);
              }}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={cn('p-3 rounded-xl bg-gradient-to-br text-white shrink-0', template.color)}>
                      {template.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm">{template.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.metrics.map(m => (
                          <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                        ))}
                      </div>
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
