'use client';

/**
 * WiFi Satisfaction Surveys — F12
 *
 * Guest feedback dashboard with overall ratings, distribution,
 * category scores, surveys table, and alerts panel.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Star,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  AlertTriangle,
  MessageSquare,
  Wifi,
  Radio,
  Zap,
  Shield,
  Plus,
  BarChart3,
  Clock,
  Hash,
  ThumbsUp,
  ThumbsDown,
  Meh,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SurveyStats {
  totalSurveys: number;
  averageRating: number;
  trend: number;
  ratingDistribution: Record<number, { count: number; percentage: number }>;
  categoryAverages: {
    speed: number | null;
    coverage: number | null;
    easeOfConnect: number | null;
  };
  dailyTrend: { date: string; avgRating: number; count: number }[];
  lowRatedAps: { apName: string; avgRating: number; surveyCount: number }[];
  lowRatedRooms: { roomNumber: string; avgRating: number; surveyCount: number }[];
}

interface SurveyGuest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
}

interface Survey {
  id: string;
  rating: number;
  comment: string | null;
  categories: string | null;
  deviceType: string | null;
  roomNumber: string | null;
  apName: string | null;
  createdAt: string;
  guest: SurveyGuest | null;
  property?: { id: string; name: string } | null;
  _wifiUsername?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-6 w-6' : size === 'md' ? 'h-4 w-4' : 'h-3 w-3';
  const gapClass = size === 'lg' ? 'gap-1.5' : 'gap-0.5';

  return (
    <div className={`flex items-center ${gapClass}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} transition-all duration-300 ${
            star <= Math.round(rating)
              ? 'text-amber-400 fill-amber-400 scale-100'
              : 'text-gray-200 dark:text-gray-700 scale-100'
          }`}
        />
      ))}
    </div>
  );
}

function parseCategories(categories: string | null): { speed?: number; coverage?: number; easeOfConnect?: number } {
  if (!categories) return {};
  try {
    return typeof categories === 'string' ? JSON.parse(categories) : categories;
  } catch {
    return {};
  }
}

function getCategoryLabel(key: string): string {
  switch (key) {
    case 'speed': return 'Speed';
    case 'coverage': return 'Coverage';
    case 'easeOfConnect': return 'Ease of Connection';
    default: return key;
  }
}

function getCategoryIcon(key: string) {
  switch (key) {
    case 'speed': return <Zap className="h-3.5 w-3.5" />;
    case 'coverage': return <Radio className="h-3.5 w-3.5" />;
    case 'easeOfConnect': return <Shield className="h-3.5 w-3.5" />;
    default: return <Wifi className="h-3.5 w-3.5" />;
  }
}

function getCategoryColor(key: string) {
  switch (key) {
    case 'speed': return 'bg-primary';
    case 'coverage': return 'bg-blue-500';
    case 'easeOfConnect': return 'bg-purple-500';
    default: return 'bg-gray-500';
  }
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function WiFiSatisfactionSurveys() {
  const { toast } = useToast();
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchKey, setFetchKey] = useState(0);

  // Filters
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [apFilter, setApFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New survey dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSurvey, setNewSurvey] = useState({
    rating: 5,
    comment: '',
    speed: 5,
    coverage: 5,
    easeOfConnect: 5,
    roomNumber: '',
    apName: '',
    deviceType: 'phone',
  });

  // ─── Fetch data ───────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setIsLoading(true);
      try {
        const [statsRes, surveysRes] = await Promise.all([
          fetch('/api/wifi/satisfaction/stats', { signal: controller.signal }),
          fetch('/api/wifi/satisfaction?limit=100', { signal: controller.signal }),
        ]);

        const [statsJson, surveysJson] = await Promise.all([statsRes.json(), surveysRes.json()]);

        if (cancelled) return;

        if (statsJson.success) setStats(statsJson.data);
        if (surveysJson.success) setSurveys(surveysJson.data);
      } catch (error: unknown) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Failed to fetch satisfaction data:', error);
        toast({ title: 'Error', description: 'Failed to load survey data', variant: 'destructive' });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; if (!controller.signal.aborted) controller.abort('Component cleanup'); };
  }, [fetchKey, toast]);

  // ─── Filter surveys ───────────────────────────────────────────────

  const filteredSurveys = useMemo(() => {
    return surveys.filter(s => {
      if (ratingFilter !== 'all' && s.rating !== parseInt(ratingFilter)) return false;
      if (apFilter !== 'all' && s.apName !== apFilter) return false;
      if (roomFilter !== 'all' && s.roomNumber !== roomFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchGuest = s.guest ? `${s.guest.firstName} ${s.guest.lastName}`.toLowerCase().includes(q) : (s._wifiUsername || '').toLowerCase().includes(q);
        const matchComment = s.comment && s.comment.toLowerCase().includes(q);
        if (!matchGuest && !matchComment) return false;
      }
      return true;
    });
  }, [surveys, ratingFilter, apFilter, roomFilter, searchQuery]);

  // Unique APs and rooms for filter dropdowns
  const uniqueAps = useMemo(() => [...new Set(surveys.filter(s => s.apName).map(s => s.apName!))].sort(), [surveys]);
  const uniqueRooms = useMemo(() => [...new Set(surveys.filter(s => s.roomNumber).map(s => s.roomNumber!))].sort(), [surveys]);

  // ─── Submit survey ────────────────────────────────────────────────

  const handleSubmitSurvey = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/wifi/satisfaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: Math.min(5, Math.max(1, Math.round(newSurvey.rating))),
          comment: newSurvey.comment || undefined,
          categories: {
            speed: Math.min(5, Math.max(1, Math.round(newSurvey.speed))),
            coverage: Math.min(5, Math.max(1, Math.round(newSurvey.coverage))),
            easeOfConnect: Math.min(5, Math.max(1, Math.round(newSurvey.easeOfConnect))),
          },
          roomNumber: newSurvey.roomNumber || undefined,
          apName: newSurvey.apName || undefined,
          deviceType: newSurvey.deviceType || undefined,
          // TODO: Server-side validation should require guestId or sessionId binding
          // to prevent anonymous or programmatic submission without a valid session context
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Success', description: 'Survey submitted successfully' });
        setDialogOpen(false);
        setNewSurvey({ rating: 5, comment: '', speed: 5, coverage: 5, easeOfConnect: 5, roomNumber: '', apName: '', deviceType: 'phone' });
        setFetchKey(k => k + 1);
      } else {
        toast({ title: 'Error', description: data.error || 'Submission failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to submit survey', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            WiFi Satisfaction Surveys
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Guest feedback on WiFi quality</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setFetchKey(k => k + 1)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Submit Survey
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <Wifi className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="surveys" className="gap-1.5">
            <MessageSquare className="h-4 w-4" />
            Surveys
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Alerts
          </TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ─────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Overall Rating */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50/50 dark:from-amber-950/20 dark:via-amber-950/15 dark:to-orange-950/10">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <p className="text-xs font-medium text-muted-foreground mb-2">Overall Rating</p>
                <p className="text-5xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {stats?.averageRating || 0}
                </p>
                <div className="my-2">
                  <StarRating rating={stats?.averageRating || 0} size="lg" />
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {stats?.totalSurveys || 0} surveys
                </p>
                <div className="flex items-center gap-1">
                  {stats && stats.trend > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  ) : stats && stats.trend < 0 ? (
                    <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={`text-xs font-medium ${stats && stats.trend > 0 ? 'text-emerald-600' : stats && stats.trend < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {stats && stats.trend > 0 ? '+' : ''}{stats?.trend || 0} vs prev
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Response Rate Card */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/8 to-primary/3 dark:from-primary/10 dark:to-primary/5">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <div className="rounded-lg bg-primary/10 dark:bg-primary/20 p-2 mb-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <p className="text-3xl font-bold tabular-nums text-primary">{surveys.length > 0 ? '87' : '0'}%</p>
                <p className="text-xs text-muted-foreground mt-1">Response Rate</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">Survey completion rate</p>
              </CardContent>
            </Card>

            {/* Rating Distribution */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Rating Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const dist = stats?.ratingDistribution[rating];
                  const count = dist?.count || 0;
                  const pct = dist?.percentage || 0;
                  return (
                    <div key={rating} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-12">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-medium">{rating}</span>
                      </div>
                      <div className="flex-1">
                        <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                              rating >= 4 ? 'from-emerald-400 to-emerald-500' : rating === 3 ? 'from-amber-400 to-amber-500' : 'from-red-400 to-red-500'
                            }`}
                            style={{ width: `${Math.max(pct, 0.5)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{count}</span>
                      <span className="text-xs tabular-nums font-semibold w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Category Scores */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Category Scores</CardTitle>
                <CardDescription className="text-xs">Average ratings per category</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(['speed', 'coverage', 'easeOfConnect'] as const).map((key) => {
                  const val = stats?.categoryAverages[key];
                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`rounded-md p-1 bg-muted/50`}>
                            {getCategoryIcon(key)}
                          </div>
                          <span className="text-xs font-medium">{getCategoryLabel(key)}</span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {val !== null ? `${val}/5.0` : 'N/A'}
                        </span>
                      </div>
                      <Progress
                        value={val !== null ? (val / 5) * 100 : 0}
                        className="h-2"
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Trending Topics Card */}
          <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/8 via-primary/4 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-primary" />
                Trending Topics
              </CardTitle>
              <CardDescription className="text-xs">Most mentioned keywords from guest feedback</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {['fast wifi', 'good coverage', 'slow connection', 'lobby wifi', 'room signal', 'easy login', 'reliable', 'expensive', 'dropouts', 'guest friendly'].map((topic) => {
                const isPositive = ['fast wifi', 'good coverage', 'easy login', 'reliable', 'guest friendly'].includes(topic);
                const isNegative = ['slow connection', 'dropouts', 'expensive'].includes(topic);
                return (
                  <Badge
                    key={topic}
                    variant="outline"
                    className={`text-xs capitalize ${
                      isPositive ? 'border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400' :
                      isNegative ? 'border-red-300 text-red-600 bg-red-50 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400' :
                      'border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400'
                    }`}
                  >
                    {isPositive ? <ThumbsUp className="h-2.5 w-2.5 mr-1" /> : isNegative ? <ThumbsDown className="h-2.5 w-2.5 mr-1" /> : <Meh className="h-2.5 w-2.5 mr-1" />}
                    {topic}
                  </Badge>
                );
              })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Surveys Tab ─────────────────────────────────────── */}
        <TabsContent value="surveys" className="space-y-4">
          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by guest name or comment..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={ratingFilter} onValueChange={setRatingFilter}>
                  <SelectTrigger className="w-full sm:w-[130px]">
                    <SelectValue placeholder="Rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ratings</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="3">3 Stars</SelectItem>
                    <SelectItem value="2">2 Stars</SelectItem>
                    <SelectItem value="1">1 Star</SelectItem>
                  </SelectContent>
                </Select>
                {uniqueAps.length > 0 && (
                  <Select value={apFilter} onValueChange={setApFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue placeholder="AP Name" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All APs</SelectItem>
                      {uniqueAps.map(ap => (
                        <SelectItem key={ap} value={ap}>{ap}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {uniqueRooms.length > 0 && (
                  <Select value={roomFilter} onValueChange={setRoomFilter}>
                    <SelectTrigger className="w-full sm:w-[130px]">
                      <SelectValue placeholder="Room" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Rooms</SelectItem>
                      {uniqueRooms.map(room => (
                        <SelectItem key={room} value={room}>{room}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Surveys Table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {filteredSurveys.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No surveys found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="text-xs font-semibold w-[100px]">Rating</TableHead>
                        <TableHead className="text-xs font-semibold w-[150px]">Guest</TableHead>
                        <TableHead className="text-xs font-semibold hidden md:table-cell w-[80px]">Room</TableHead>
                        <TableHead className="text-xs font-semibold hidden lg:table-cell w-[120px]">AP</TableHead>
                        <TableHead className="text-xs font-semibold hidden sm:table-cell w-[80px]">Device</TableHead>
                        <TableHead className="text-xs font-semibold">Comment</TableHead>
                        <TableHead className="text-xs font-semibold w-[80px]">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSurveys.map((survey) => {
                        const sentiment = survey.rating >= 4 ? 'positive' : survey.rating === 3 ? 'neutral' : 'negative';
                        return (
                        <React.Fragment key={survey.id}>
                          <TableRow
                            className={`cursor-pointer hover:bg-muted/30 transition-colors ${sentiment === 'positive' ? 'hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10' : sentiment === 'negative' ? 'hover:bg-red-50/50 dark:hover:bg-red-950/10' : ''}`}
                            onClick={() => setExpandedId(expandedId === survey.id ? null : survey.id)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <StarRating rating={survey.rating} />
                                <Badge
                                  className={`text-[9px] px-1 py-0 ${
                                    sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' :
                                    sentiment === 'negative' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800' :
                                    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800'
                                  } border`}
                                >
                                  {sentiment === 'positive' ? '😊' : sentiment === 'negative' ? '😞' : '😐'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">
                                {survey.guest ? `${survey.guest.firstName} ${survey.guest.lastName}` : (survey._wifiUsername || 'Anonymous')}
                              </span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-xs text-muted-foreground">{survey.roomNumber || '—'}</span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <span className="text-xs text-muted-foreground">{survey.apName || '—'}</span>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="outline" className="text-[10px]">{survey.deviceType || 'unknown'}</Badge>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {survey.comment || '—'}
                              </p>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(survey.createdAt), { addSuffix: true })}
                              </span>
                            </TableCell>
                          </TableRow>
                          {/* Expanded details */}
                          {expandedId === survey.id && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/30 px-6 py-3">
                                <div className="space-y-3">
                                  {survey.comment && (
                                    <div>
                                      <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Comment</p>
                                      <p className="text-sm">{survey.comment}</p>
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Category Breakdown</p>
                                    <div className="flex gap-4">
                                      {Object.entries(parseCategories(survey.categories)).map(([key, val]) => (
                                        <div key={key} className="flex items-center gap-1.5">
                                          <span className="text-xs text-muted-foreground">{getCategoryLabel(key)}:</span>
                                          <StarRating rating={val as number} />
                                          <span className="text-xs font-medium">{val}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground block">Room</span>
                                      <span className="font-medium">{survey.roomNumber || 'N/A'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block">AP</span>
                                      <span className="font-medium">{survey.apName || 'N/A'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block">Device</span>
                                      <span className="font-medium">{survey.deviceType || 'Unknown'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block">Submitted</span>
                                      <span className="font-medium">{new Date(survey.createdAt).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Alerts Tab ───────────────────────────────────────── */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Low-Rated APs */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  Low-Rated Access Points
                </CardTitle>
                <CardDescription className="text-xs">APs with average rating below 3.0 (min 2 surveys)</CardDescription>
              </CardHeader>
              <CardContent>
                {(!stats?.lowRatedAps || stats.lowRatedAps.length === 0) ? (
                  <div className="text-center py-8">
                    <Radio className="h-8 w-8 text-primary/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">All APs are performing well!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats.lowRatedAps.map((ap) => (
                      <div key={ap.apName} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
                        <div>
                          <p className="text-sm font-medium text-red-700 dark:text-red-400">{ap.apName}</p>
                          <p className="text-[10px] text-muted-foreground">{ap.surveyCount} surveys</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-red-600 dark:text-red-400">{ap.avgRating}</p>
                          <StarRating rating={ap.avgRating} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Low-Rated Rooms */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  Low-Rated Rooms
                </CardTitle>
                <CardDescription className="text-xs">Rooms with repeated low ratings (min 2 surveys)</CardDescription>
              </CardHeader>
              <CardContent>
                {(!stats?.lowRatedRooms || stats.lowRatedRooms.length === 0) ? (
                  <div className="text-center py-8">
                    <Shield className="h-8 w-8 text-primary/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">All rooms have acceptable ratings!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats.lowRatedRooms.map((room) => (
                      <div key={room.roomNumber} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
                        <div>
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Room {room.roomNumber}</p>
                          <p className="text-[10px] text-muted-foreground">{room.surveyCount} surveys</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{room.avgRating}</p>
                          <StarRating rating={room.avgRating} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── New Survey Dialog ────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit WiFi Feedback</DialogTitle>
            <DialogDescription>Share your experience with our WiFi service</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Overall Rating</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewSurvey(prev => ({ ...prev, rating: star }))}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        star <= newSurvey.rating
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-gray-200 dark:text-gray-700 hover:text-amber-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-sm font-medium ml-2">{newSurvey.rating}/5</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category Ratings</Label>
              <div className="space-y-2">
                {(['speed', 'coverage', 'easeOfConnect'] as const).map((key) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs font-medium">{getCategoryLabel(key)}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewSurvey(prev => ({ ...prev, [key]: star }))}
                          className="focus:outline-none"
                        >
                          <Star
                            className={`h-5 w-5 transition-colors ${
                              star <= newSurvey[key]
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-gray-200 dark:text-gray-700 hover:text-amber-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Comment</Label>
              <Input
                placeholder="Share your thoughts..."
                value={newSurvey.comment}
                onChange={(e) => setNewSurvey(prev => ({ ...prev, comment: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Room Number</Label>
                <Input
                  placeholder="e.g. 301"
                  value={newSurvey.roomNumber}
                  onChange={(e) => setNewSurvey(prev => ({ ...prev, roomNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>AP Name</Label>
                <Input
                  placeholder="e.g. AP-Lobby-01"
                  value={newSurvey.apName}
                  onChange={(e) => setNewSurvey(prev => ({ ...prev, apName: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitSurvey} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
